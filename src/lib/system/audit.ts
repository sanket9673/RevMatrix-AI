import { createHash } from 'crypto';
import { prisma } from '@/lib/prisma';
import { AuditLog } from '@prisma/client';

export class CryptographicAuditLogger {
  /**
   * Appends a log entry to the audit log chain for a specific workflow.
   * Calculates a SHA-256 hash using the previous entry's hash to form a tamper-evident chain.
   */
  public async appendLog(
    workflowId: string,
    actor: string,
    action: string,
    payload: Record<string, any>
  ): Promise<AuditLog> {
    // 1. Fetch the latest AuditLog entry for this workflow
    const latestLog = await prisma.auditLog.findFirst({
      where: { workflowId },
      orderBy: { createdAt: 'desc' },
    });

    // 2. Set previous hash (defaulting to 64 zeros for the genesis log)
    const previousHash = latestLog ? latestLog.currentHash : '0'.repeat(64);

    // 3. Create the current timestamp
    const now = new Date();
    const isoTimestamp = now.toISOString();

    // 4. Compute the current SHA-256 hash
    const hashInput = `${previousHash}:${workflowId}:${actor}:${action}:${JSON.stringify(payload)}:${isoTimestamp}`;
    const currentHash = createHash('sha256').update(hashInput).digest('hex');

    // 5. Write the AuditLog record to the database
    return prisma.auditLog.create({
      data: {
        workflowId,
        actor,
        action,
        payload,
        previousHash,
        currentHash,
        createdAt: now,
      },
    });
  }
}
