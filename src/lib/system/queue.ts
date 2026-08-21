import { prisma } from '@/lib/prisma';
import { RecoveryWorkflow, WorkflowStatus } from '@prisma/client';

export class ServerlessQueueManager {
  /**
   * Fetches and locks due workflows atomically using SELECT ... FOR UPDATE SKIP LOCKED
   * to guarantee concurrent instances never double-pick the same workflow.
   */
  public async fetchAndLockDueWorkflows(batchSize: number = 10): Promise<RecoveryWorkflow[]> {
    const workflows = await prisma.$queryRaw<RecoveryWorkflow[]>`
      UPDATE "RecoveryWorkflow"
      SET status = 'IN_PROGRESS'::"WorkflowStatus", "updatedAt" = NOW()
      WHERE id IN (
        SELECT id 
        FROM "RecoveryWorkflow" 
        WHERE status = 'PENDING'::"WorkflowStatus" AND "nextCheckAt" <= (NOW() AT TIME ZONE 'utc')
        ORDER BY "nextCheckAt" ASC
        FOR UPDATE SKIP LOCKED
        LIMIT ${batchSize}
      )
      RETURNING *;
    `;
    return workflows;
  }

  /**
   * Updates workflow status, completedAt (if finished), metrics (as JSON), and optionally
   * schedules the next loop iteration (nextCheckAt).
   */
  public async markWorkflowComplete(
    id: string,
    status: 'COMPLETED' | 'FAILED' | 'SCHEDULED',
    metrics?: Record<string, any>,
    nextCheckAt?: Date
  ): Promise<RecoveryWorkflow> {
    let dbStatus: WorkflowStatus;

    switch (status) {
      case 'COMPLETED':
        dbStatus = WorkflowStatus.RECOVERED;
        break;
      case 'FAILED':
        dbStatus = WorkflowStatus.FAILED;
        break;
      case 'SCHEDULED':
        dbStatus = WorkflowStatus.ACTION_SCHEDULED;
        break;
      default:
        const exhaustCheck: never = status;
        throw new Error(`Unhandled workflow status: ${exhaustCheck}`);
    }

    const data: any = {
      status: dbStatus,
      metrics: metrics || null,
      updatedAt: new Date(),
    };

    if (status === 'COMPLETED') {
      data.completedAt = new Date();
    }

    if (nextCheckAt) {
      data.nextCheckAt = nextCheckAt;
    }

    return prisma.recoveryWorkflow.update({
      where: { id },
      data,
    });
  }
}
