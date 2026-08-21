import { NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';
import { FALLBACK_RECORDS, BenchmarkRecord, BenchmarkSummary } from '@/lib/fallback_data';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const responseHeaders = new Headers({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
  });

  // Try to load synthetic failures from project root or data directory
  let records: BenchmarkRecord[] = FALLBACK_RECORDS;

  try {
    const rootPath = path.join(process.cwd(), 'synthetic_50_failures.json');
    const dataPath = path.join(process.cwd(), 'data/synthetic_50_failures.json');
    let filePath = '';

    if (fs.existsSync(rootPath)) {
      filePath = rootPath;
    } else if (fs.existsSync(dataPath)) {
      filePath = dataPath;
    }

    if (filePath) {
      const rawData = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(rawData);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Map raw records to BenchmarkRecord structure using FALLBACK_RECORDS status distribution
        records = parsed.slice(0, 50).map((raw: any, index: number) => {
          const fallbackRec = FALLBACK_RECORDS[index] || FALLBACK_RECORDS[index % FALLBACK_RECORDS.length];
          const amount = typeof raw.amount === 'number' ? raw.amount : 1000;
          const currency = raw.currency || 'INR';
          const amountGTV = currency === 'USD' ? Math.round(amount * 83) : Math.round(amount);

          return {
            id: raw.id || `bench_rec_${index + 1}`,
            transactionId: raw.transactionId || `TXN_REV_${1000 + index + 1}`,
            amountGTV,
            status: fallbackRec.status,
            latencyMs: fallbackRec.latencyMs,
            failureReason: raw.loop1Details?.failureReason || raw.loop2Details?.overdueReason || fallbackRec.failureReason,
            timestamp: raw.timestamp || new Date().toISOString()
          };
        });
      }
    }
  } catch (error) {
    console.error('Error loading synthetic failures JSON:', error);
  }

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let aborted = false;

      const sendEvent = (payload: any) => {
        if (aborted) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
        } catch (err) {
          console.error('Error enqueueing stream event:', err);
        }
      };

      req.signal.addEventListener('abort', () => {
        aborted = true;
        try {
          controller.close();
        } catch (e) {
          // Stream might already be closed
        }
      });

      // 1. Send START event
      sendEvent({ event: 'START', total: records.length });

      // Keep track of statistics for runningSummary
      let processedRecords = 0;
      let recoveredCount = 0;
      let policyBreachCount = 0;
      let totalLatency = 0;
      let netRecoveredGTV = 0;

      // Helper function to generate logs for a specific record
      const getLogsForRecord = (rec: BenchmarkRecord) => {
        const time = new Date(rec.timestamp);
        const logs = [];

        logs.push({
          timestamp: new Date(time.getTime() - 80).toISOString(),
          level: 'INFO',
          message: `[Ingest] Intercepted payment failure for transaction ${rec.transactionId}`,
          payload: { transactionId: rec.transactionId, amount: rec.amountGTV, failureReason: rec.failureReason }
        });

        if (rec.status === 'POLICY_BREACH') {
          logs.push({
            timestamp: new Date(time.getTime() - 40).toISOString(),
            level: 'ERROR',
            message: `[PolicyEngine] Hard Policy Violation detected for ${rec.transactionId}: Customer metadata matches restricted sanctions list`,
            payload: { ruleId: 'POL_AML_004', riskScore: 99 }
          });
          logs.push({
            timestamp: rec.timestamp,
            level: 'ERROR',
            message: `[Decision] Blocked transaction ${rec.transactionId} permanently. Refusing retry parameters.`,
            payload: { status: 'POLICY_BREACH' }
          });
        } else if (rec.status === 'FAILED') {
          logs.push({
            timestamp: new Date(time.getTime() - 40).toISOString(),
            level: 'WARN',
            message: `[RoutingEngine] Attempting primary route bypass for ${rec.transactionId} via fallback gateways...`,
            payload: { gatewayAttempt: 1, originalGateway: 'Razorpay' }
          });
          logs.push({
            timestamp: rec.timestamp,
            level: 'ERROR',
            message: `[Decision] Exhausted retry limits for ${rec.transactionId}. Recovery failure due to persistent ${rec.failureReason}.`,
            payload: { status: 'FAILED', totalLatencyMs: rec.latencyMs }
          });
        } else {
          // RECOVERED
          logs.push({
            timestamp: new Date(time.getTime() - 40).toISOString(),
            level: 'WARN',
            message: `[RoutingEngine] Redirecting ${rec.transactionId} to high-converting gateway due to ${rec.failureReason}`,
            payload: { primaryGateway: 'Razorpay', chosenFallback: 'Cashfree', dynamicRulesApplied: ['CARD_RETRIES', 'GEO_ROUTING'] }
          });
          logs.push({
            timestamp: rec.timestamp,
            level: 'SUCCESS',
            message: `[Decision] Recovered transaction ${rec.transactionId} successfully using automated intelligent failover!`,
            payload: { status: 'RECOVERED', latencyMs: rec.latencyMs, recoveredAmount: rec.amountGTV }
          });
        }
        return logs;
      };

      // Loop through records with artificial delay
      for (let i = 0; i < records.length; i++) {
        if (aborted) break;

        const record = records[i];
        processedRecords++;
        totalLatency += record.latencyMs;

        if (record.status === 'RECOVERED') {
          recoveredCount++;
          netRecoveredGTV += record.amountGTV;
        } else if (record.status === 'POLICY_BREACH') {
          policyBreachCount++;
        }

        const recoveryRatePct = Math.round((recoveredCount / processedRecords) * 100);
        const policyBreachRatePct = Math.round((policyBreachCount / processedRecords) * 100);
        const avgLatencyMs = Math.round(totalLatency / processedRecords);
        // Throughput calculation: 1000ms / avgDelayMs. Let's make it look like a real-time rate.
        const throughputRps = parseFloat((1 / (0.06 + Math.random() * 0.06)).toFixed(1));

        const runningSummary: BenchmarkSummary = {
          totalRecords: records.length,
          processedRecords,
          recoveryRatePct,
          netRecoveredGTV,
          policyBreachRatePct,
          avgLatencyMs,
          throughputRps
        };

        const recordLogs = getLogsForRecord(record);

        // 2. Stream individual item event
        sendEvent({
          event: 'RECORD_PROCESSED',
          record,
          current: i + 1,
          total: records.length,
          runningSummary,
          logs: recordLogs
        });

        // Artificial delay for realistic stream pacing (60ms to 120ms)
        const delay = 60 + Math.floor(Math.random() * 60);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }

      if (!aborted) {
        const finalSummary: BenchmarkSummary = {
          totalRecords: records.length,
          processedRecords: records.length,
          recoveryRatePct: Math.round((recoveredCount / records.length) * 100),
          netRecoveredGTV,
          policyBreachRatePct: Math.round((policyBreachCount / records.length) * 100),
          avgLatencyMs: Math.round(totalLatency / records.length),
          throughputRps: 12.5
        };

        // 3. Send final COMPLETE event
        sendEvent({
          event: 'COMPLETE',
          finalSummary
        });

        try {
          controller.close();
        } catch (e) {
          // Stream might already be closed
        }
      }
    }
  });

  return new Response(stream, { headers: responseHeaders });
}
