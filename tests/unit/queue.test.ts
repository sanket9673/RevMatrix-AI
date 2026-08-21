import { ServerlessQueueManager } from '@/lib/system/queue';
import { prisma } from '@/lib/prisma';
import { LoopType, WorkflowStatus } from '@prisma/client';

describe('ServerlessQueueManager', () => {
  let queueManager: ServerlessQueueManager;

  beforeEach(async () => {
    queueManager = new ServerlessQueueManager();
    // Clean up database tables
    await prisma.reasoningTrace.deleteMany();
    await prisma.auditLog.deleteMany();
    await prisma.recoveryWorkflow.deleteMany();
    await prisma.transaction.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test('should fetch and lock due workflows atomically', async () => {
    // 1. Create a transaction
    const tx = await prisma.transaction.create({
      data: {
        razorpayId: 'pay_test_queue',
        loopType: LoopType.TRANSACT_FAILURE,
        amount: 100,
        customerEmail: 'test@example.com',
      },
    });

    // 2. Create workflows (one due, one not due)
    const dueWorkflow = await prisma.recoveryWorkflow.create({
      data: {
        transactionId: tx.id,
        status: WorkflowStatus.PENDING,
        nextCheckAt: new Date(Date.now() - 1000), // in the past
        idempotencyKey: 'key_due',
      },
    });

    const futureWorkflow = await prisma.recoveryWorkflow.create({
      data: {
        transactionId: tx.id,
        status: WorkflowStatus.PENDING,
        nextCheckAt: new Date(Date.now() + 100000), // in the future
        idempotencyKey: 'key_future',
      },
    });

    // 3. Fetch and lock due workflows
    const locked = await queueManager.fetchAndLockDueWorkflows(5);

    expect(locked).toHaveLength(1);
    expect(locked[0].id).toBe(dueWorkflow.id);
    expect(locked[0].status).toBe(WorkflowStatus.IN_PROGRESS);

    // 4. Verify in DB that it is marked IN_PROGRESS
    const updated = await prisma.recoveryWorkflow.findUnique({
      where: { id: dueWorkflow.id },
    });
    expect(updated?.status).toBe(WorkflowStatus.IN_PROGRESS);

    // 5. Verify the future one remains PENDING
    const futureDb = await prisma.recoveryWorkflow.findUnique({
      where: { id: futureWorkflow.id },
    });
    expect(futureDb?.status).toBe(WorkflowStatus.PENDING);
  });

  test('should mark workflow completed, scheduled, or failed correctly', async () => {
    const tx = await prisma.transaction.create({
      data: {
        razorpayId: 'pay_test_queue_complete',
        loopType: LoopType.TRANSACT_FAILURE,
        amount: 200,
        customerEmail: 'test2@example.com',
      },
    });

    const workflow = await prisma.recoveryWorkflow.create({
      data: {
        transactionId: tx.id,
        status: WorkflowStatus.PENDING,
        nextCheckAt: new Date(),
        idempotencyKey: 'key_complete',
      },
    });

    // Mark COMPLETED (RECOVERED)
    const completed = await queueManager.markWorkflowComplete(workflow.id, 'COMPLETED', { success: true });
    expect(completed.status).toBe(WorkflowStatus.RECOVERED);
    expect(completed.completedAt).toBeDefined();
    expect(completed.metrics).toEqual({ success: true });

    // Mark SCHEDULED
    const nextCheck = new Date(Date.now() + 600000);
    const scheduled = await queueManager.markWorkflowComplete(workflow.id, 'SCHEDULED', undefined, nextCheck);
    expect(scheduled.status).toBe(WorkflowStatus.ACTION_SCHEDULED);
    expect(new Date(scheduled.nextCheckAt).getTime()).toBeCloseTo(nextCheck.getTime(), -3); // close enough

    // Mark FAILED
    const failed = await queueManager.markWorkflowComplete(workflow.id, 'FAILED', { error: 'failed final' });
    expect(failed.status).toBe(WorkflowStatus.FAILED);
    expect(failed.metrics).toEqual({ error: 'failed final' });
  });
});
