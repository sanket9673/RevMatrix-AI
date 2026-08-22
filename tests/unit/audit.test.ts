import { CryptographicAuditLogger } from '@/lib/system/audit';
import { prisma } from '@/lib/prisma';
import { LoopType, WorkflowStatus } from '@prisma/client';
import crypto from 'crypto';

describe('CryptographicAuditLogger', () => {
  let auditLogger: CryptographicAuditLogger;
  let workflowId: string;

  beforeEach(async () => {
    auditLogger = new CryptographicAuditLogger();
    // Clean up
    await prisma.reasoningTrace.deleteMany();
    await prisma.auditLog.deleteMany();
    await prisma.recoveryWorkflow.deleteMany();
    await prisma.transaction.deleteMany();

    // Create a workflow to associate audit logs with
    const tx = await prisma.transaction.create({
      data: {
        razorpayId: 'pay_test_audit',
        loopType: LoopType.TRANSACT_FAILURE,
        amount: 50,
        customerEmail: 'audit@example.com',
      },
    });

    const workflow = await prisma.recoveryWorkflow.create({
      data: {
        transactionId: tx.id,
        status: WorkflowStatus.PENDING,
        nextCheckAt: new Date(),
        idempotencyKey: 'key_audit',
      },
    });
    workflowId = workflow.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test('should append genesis audit log with default previous hash', async () => {
    const actor = 'TEST_RUNNER';
    const action = 'START_WORKFLOW';
    const payload = { start: true };

    const log = await auditLogger.appendLog(workflowId, actor, action, payload);

    expect(log.workflowId).toBe(workflowId);
    expect(log.actor).toBe(actor);
    expect(log.action).toBe(action);
    expect(log.payload).toEqual(payload);
    expect(log.previousHash).toBe('0'.repeat(64));
    expect(log.currentHash).toHaveLength(64);

    // Verify hash matches manual recalculation
    const expectedHashInput = `${'0'.repeat(64)}:${workflowId}:${actor}:${action}:${JSON.stringify(payload)}:${log.createdAt.toISOString()}`;
    const expectedHash = crypto.createHash('sha256').update(expectedHashInput).digest('hex');
    expect(log.currentHash).toBe(expectedHash);
  });

  test('should chain consecutive audit logs cryptographically', async () => {
    // 1. Genesis block
    const log1 = await auditLogger.appendLog(workflowId, 'TEST', 'ACTION_1', { step: 1 });

    // Wait a brief moment to ensure separate timestamps
    await new Promise((resolve) => setTimeout(resolve, 50));

    // 2. Second block (rich realistic financial payload)
    const richPayload = {
      diagnosis: 'CASHFLOW_DELAY',
      recommendedIntervention: 'EMIT_DISCOUNT_INCENTIVE',
      proposedDiscountPercent: 10,
      policyResult: {
        allowed: true,
        status: 'POLICY_CAP_APPLIED',
        violations: [
          {
            rule: 'POL_DISC_LIMIT',
            message: 'Discount exceeds standard segment allowance'
          }
        ],
        modifiedProposal: {
          proposedDiscountPercent: 5,
          paymentLinkTTLMinutes: 15
        }
      },
      payment_link_id: 'plink_K1xX98231a'
    };

    const log2 = await auditLogger.appendLog(
      workflowId,
      'AGENT_GEMINI_POLICY_BOUNDED',
      'EXECUTED_RECOVERY_LOOP',
      richPayload
    );

    expect(log2.previousHash).toBe(log1.currentHash);
    expect(log2.currentHash).not.toBe(log1.currentHash);

    // Verify chain link logic
    const expectedHashInput = `${log1.currentHash}:${workflowId}:AGENT_GEMINI_POLICY_BOUNDED:EXECUTED_RECOVERY_LOOP:${JSON.stringify(richPayload)}:${log2.createdAt.toISOString()}`;
    const expectedHash = crypto.createHash('sha256').update(expectedHashInput).digest('hex');
    expect(log2.currentHash).toBe(expectedHash);
  });
});
