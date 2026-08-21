import { GET } from '@/app/api/cron/process-due-recoveries/route';
import { prisma } from '@/lib/prisma';
import { NextRequest } from 'next/server';
import { LoopType, WorkflowStatus } from '@prisma/client';

describe('Vercel Cron API Route', () => {
  beforeEach(async () => {
    // Clean up
    await prisma.reasoningTrace.deleteMany();
    await prisma.auditLog.deleteMany();
    await prisma.recoveryWorkflow.deleteMany();
    await prisma.transaction.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test('should return 401 Unauthorized if authorization header is invalid when CRON_SECRET is set', async () => {
    process.env.CRON_SECRET = 'secret_cron_key';
    const req = new NextRequest('http://localhost:3000/api/cron/process-due-recoveries', {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer wrong_key',
      },
    });

    const res = await GET(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe('Unauthorized CRON trigger');
  });

  test('should process due workflows, invoke mock orchestrator, and mark complete', async () => {
    process.env.CRON_SECRET = 'secret_cron_key';
    process.env.GEMINI_API_KEY = 'AIzaSy_your_gemini_mock';
    
    // Create a transaction and workflow that is due
    const tx = await prisma.transaction.create({
      data: {
        razorpayId: 'pay_cron_test',
        loopType: LoopType.TRANSACT_FAILURE,
        amount: 300,
        customerEmail: 'cron@example.com',
        failureCode: 'INSUFFICIENT_FUNDS',
      },
    });

    const workflow = await prisma.recoveryWorkflow.create({
      data: {
        transactionId: tx.id,
        status: WorkflowStatus.PENDING,
        nextCheckAt: new Date(Date.now() - 5000), // in the past
        idempotencyKey: 'cron_key_1',
      },
    });

    const { RazorpayClientWrapper } = require('@/lib/integrations/razorpay_client');
    const getPaymentDetailsSpy = jest.spyOn(RazorpayClientWrapper.prototype, 'getPaymentDetails')
      .mockResolvedValue({
        id: 'pay_cron_test',
        status: 'failed',
        amount: 30000,
        currency: 'INR',
        method: 'card',
        email: 'cron@example.com',
        contact: '+919999999999',
      });

    const req = new NextRequest('http://localhost:3000/api/cron/process-due-recoveries', {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer secret_cron_key',
      },
    });

    const res = await GET(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.processedCount).toBe(1);
    expect(data.failedCount).toBe(0);
    expect(data.workflowsHandled).toHaveLength(1);
    expect(data.workflowsHandled[0]).toEqual({ id: workflow.id, status: 'COMPLETED' });

    // Verify workflow state was updated to COMPLETED (RECOVERED)
    const updatedWorkflow = await prisma.recoveryWorkflow.findUnique({
      where: { id: workflow.id },
      include: { auditLogs: true, reasoningTraces: true }
    });
    expect(updatedWorkflow?.status).toBe(WorkflowStatus.RECOVERED);
    expect(updatedWorkflow?.completedAt).toBeDefined();

    // Verify reasoning traces and audit logs
    expect(updatedWorkflow?.auditLogs).toHaveLength(1);
    expect(updatedWorkflow?.auditLogs[0].action).toBe('EXECUTED_RECOVERY_LOOP');
    expect(updatedWorkflow?.reasoningTraces).toHaveLength(1);
    expect(updatedWorkflow?.reasoningTraces[0].toolCalled).toBe('RETRY_GATEWAY_ALTERNATIVE');

    getPaymentDetailsSpy.mockRestore();
  });
});
