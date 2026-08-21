import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ServerlessQueueManager } from '@/lib/system/queue';
import { CryptographicAuditLogger } from '@/lib/system/audit';
import { AgentOrchestrator } from '@/lib/agent/orchestrator';
import { PolicyEngine } from '@/lib/guardrails/policy_engine';
import { RazorpayClientWrapper } from '@/lib/integrations/razorpay_client';
import { Transaction as AgentTransaction, CustomerContext } from '@/types/agent';
import { ProposedIntervention } from '@/types/guardrails';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  return handleCron(req);
}

export async function POST(req: NextRequest) {
  return handleCron(req);
}

async function handleCron(req: NextRequest) {
  const startTime = Date.now();

  // 1. Authorization Check
  const authHeader = req.headers.get('Authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized CRON trigger' }, { status: 401 });
  }

  const queueManager = new ServerlessQueueManager();
  const auditLogger = new CryptographicAuditLogger();
  const policyEngine = new PolicyEngine();
  const razorpayClient = new RazorpayClientWrapper();
  
  // Try using GEMINI_API_KEY from environment, fall back to mock orchestrator if key is empty/placeholder
  const apiKey = process.env.GEMINI_API_KEY;
  const isMockOrchestrator = !apiKey || apiKey.startsWith('AIzaSy_your_gemini');
  const orchestrator = new AgentOrchestrator(apiKey);

  const lockedWorkflows = await queueManager.fetchAndLockDueWorkflows(10);
  
  let processedCount = 0;
  let failedCount = 0;
  const workflowsHandled: Array<{ id: string; status: string; error?: string }> = [];

  for (const workflow of lockedWorkflows) {
    try {
      // Retrieve the associated Transaction
      const dbTx = await prisma.transaction.findUnique({
        where: { id: workflow.transactionId },
      });

      if (!dbTx) {
        throw new Error(`Associated transaction ${workflow.transactionId} not found in database.`);
      }

      // a. Agent Orchestration Call
      const agentTx: AgentTransaction = {
        id: dbTx.id,
        customerId: dbTx.customerEmail,
        amount: dbTx.amount,
        currency: dbTx.currency,
        errorCode: dbTx.failureCode || undefined,
        errorMessage: dbTx.failureCode || undefined,
        createdAt: dbTx.createdAt.toISOString(),
      };

      // Mock or fetch customer context based on transaction amount
      let customerSegment: 'SMB' | 'MID_MARKET' | 'ENTERPRISE' = 'SMB';
      if (dbTx.amount >= 5000) {
        customerSegment = 'ENTERPRISE';
      } else if (dbTx.amount >= 1000) {
        customerSegment = 'MID_MARKET';
      }

      const customerContext: CustomerContext = {
        customerSegment,
        tenureMonths: 12,
        openDisputesCount: 0,
      };

      let recommendation: any;
      if (isMockOrchestrator) {
        // Fallback mock logic for local run/tests without key
        recommendation = {
          transactionId: agentTx.id,
          diagnosis: dbTx.loopType === 'TRANSACT_FAILURE' ? 'TECHNICAL_TIMEOUT' : 'CASHFLOW_DELAY',
          justification: 'Mock recommendation due to missing or invalid GEMINI_API_KEY.',
          recommendedIntervention: dbTx.loopType === 'TRANSACT_FAILURE' ? 'RETRY_GATEWAY_ALTERNATIVE' : 'EMIT_DISCOUNT_INCENTIVE',
          proposedDiscountPercent: dbTx.loopType === 'TRANSACT_FAILURE' ? 0 : 5.0,
          requiresHumanApproval: false,
          reasoningTrace: [],
        };
      } else {
        recommendation = await orchestrator.diagnoseAndPlan(agentTx, customerContext);
      }

      // b. Policy Validation
      const retryCount = await prisma.auditLog.count({
        where: {
          workflowId: workflow.id,
          action: 'EXECUTED_RECOVERY_LOOP',
        },
      });

      const policyProposal: ProposedIntervention = {
        transactionId: dbTx.id,
        proposedDiscountPercent: recommendation.proposedDiscountPercent,
        retryCount,
        failureCode: dbTx.failureCode || 'UNKNOWN_ERROR',
        paymentLinkTTLMinutes: 15,
      };

      const policyResult = policyEngine.validateIntervention(policyProposal);

      let discountPercent = recommendation.proposedDiscountPercent;
      let ttlMinutes = 15;

      if (!policyResult.allowed) {
        // Policy engine blocked action
        await auditLogger.appendLog(workflow.id, 'CRON_WORKER', 'POLICY_REJECTED', {
          recommendation,
          policyResult,
        });

        await queueManager.markWorkflowComplete(workflow.id, 'FAILED', {
          reason: policyResult.reason || 'Policy Engine rejected recovery intervention',
        });

        failedCount++;
        workflowsHandled.push({ id: workflow.id, status: 'FAILED', error: policyResult.reason });
        continue;
      }

      if (policyResult.status === 'POLICY_CAP_APPLIED' && policyResult.modifiedProposal) {
        discountPercent = policyResult.modifiedProposal.proposedDiscountPercent;
        ttlMinutes = policyResult.modifiedProposal.paymentLinkTTLMinutes;
      }

      // c. API Trigger
      const idempotencyKey = `cron-${workflow.id}-${retryCount}`;
      let apiStatus: any = {};

      if (recommendation.recommendedIntervention === 'EMIT_DISCOUNT_INCENTIVE' || recommendation.recommendedIntervention === 'OFFER_PAYMENT_PLAN') {
        if (dbTx.loopType === 'B2B_RECEIVABLE') {
          // B2B discount early settlement invoice handle
          const invoiceResult = await razorpayClient.createInvoicePaymentHandle(
            dbTx.razorpayId,
            discountPercent,
            idempotencyKey
          );
          apiStatus = {
            type: 'INVOICE_DISCOUNT',
            success: true,
            id: invoiceResult.id,
            url: invoiceResult.short_url || invoiceResult.payment_links?.web || '',
          };
        } else {
          // B2C Transaction failures
          const paiseAmount = Math.round(dbTx.amount * 100 * (1 - discountPercent / 100));
          const paymentLinkInput = {
            amount: paiseAmount,
            currency: dbTx.currency,
            description: `Recovery payment link with ${discountPercent}% discount`,
            customer: {
              name: 'Valued Customer',
              email: dbTx.customerEmail,
              contact: '+919999999999',
            },
            expire_by: Math.floor(Date.now() / 1000) + ttlMinutes * 60,
          };
          const linkResult = await razorpayClient.createPaymentLink(paymentLinkInput, idempotencyKey);
          apiStatus = {
            type: 'PAYMENT_LINK',
            success: true,
            id: linkResult.id,
            url: linkResult.short_url,
          };
        }
      } else {
        // Fallback for gateway retry, pause collections, escalate etc.
        if (dbTx.loopType === 'TRANSACT_FAILURE') {
          const details = await razorpayClient.getPaymentDetails(dbTx.razorpayId);
          apiStatus = { type: 'GATEWAY_RETRY_CHECK', success: true, status: details.status };
        } else {
          const details = await razorpayClient.getInvoiceDetails(dbTx.razorpayId);
          apiStatus = { type: 'INVOICE_STATUS_CHECK', success: true, status: details.status };
        }
      }

      // d. Cryptographic Log
      await auditLogger.appendLog(workflow.id, 'CRON_WORKER', 'EXECUTED_RECOVERY_LOOP', {
        recommendation,
        policyResult,
        apiStatus,
      });

      // Save reasoning trace info into DB
      await prisma.reasoningTrace.create({
        data: {
          workflowId: workflow.id,
          stepNumber: retryCount + 1,
          thoughtProcess: recommendation.justification,
          toolCalled: recommendation.recommendedIntervention,
          toolInput: policyProposal as any,
          toolOutput: policyResult as any,
          policyCheckPassed: policyResult.allowed,
        },
      });

      // e. Update Workflow State
      // Mark as completed if the action succeeded, otherwise we can schedule a check
      await queueManager.markWorkflowComplete(workflow.id, 'COMPLETED', {
        apiStatus,
        discountPercent,
        intervention: recommendation.recommendedIntervention,
      });

      // Update transactional appliedDiscount record
      await prisma.recoveryWorkflow.update({
        where: { id: workflow.id },
        data: {
          appliedDiscount: discountPercent,
        },
      });

      processedCount++;
      workflowsHandled.push({ id: workflow.id, status: 'COMPLETED' });
    } catch (err: any) {
      console.error(`Error processing workflow ID ${workflow.id}:`, err);
      failedCount++;
      workflowsHandled.push({ id: workflow.id, status: 'FAILED', error: err.message || String(err) });

      try {
        // Log the failure cryptographically to retain historical trails
        await auditLogger.appendLog(workflow.id, 'CRON_WORKER', 'RECOVERY_FAILED', {
          error: err.message || String(err),
        });

        // Determine if we should fail or reschedule
        const failedRetries = await prisma.auditLog.count({
          where: { workflowId: workflow.id, action: 'EXECUTED_RECOVERY_LOOP' },
        });

        if (failedRetries < 3) {
          // Reschedule the lock check 10 minutes in the future
          const nextCheck = new Date(Date.now() + 10 * 60 * 1000);
          await queueManager.markWorkflowComplete(workflow.id, 'SCHEDULED', { error: err.message }, nextCheck);
        } else {
          await queueManager.markWorkflowComplete(workflow.id, 'FAILED', { error: err.message });
        }
      } catch (logErr) {
        console.error(`Failed to handle lock release/failed state mark for ${workflow.id}:`, logErr);
      }
    }
  }

  const executionTimeMs = Date.now() - startTime;
  return NextResponse.json({
    processedCount,
    failedCount,
    executionTimeMs,
    workflowsHandled,
  });
}
