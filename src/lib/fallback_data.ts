export interface BenchmarkRecord {
  id: string;
  transactionId: string;
  amountGTV: number;
  status: 'SUCCESS' | 'FAILED' | 'RECOVERED' | 'POLICY_BREACH';
  latencyMs: number;
  failureReason: string;
  timestamp: string;
}

export interface BenchmarkSummary {
  totalRecords: number;
  processedRecords: number;
  recoveryRatePct: number;
  netRecoveredGTV: number;
  policyBreachRatePct: number;
  avgLatencyMs: number;
  throughputRps: number;
}

export interface FallbackBenchmarkPayload {
  summary: BenchmarkSummary;
  records: BenchmarkRecord[];
  logs: Array<{
    timestamp: string;
    level: 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS';
    message: string;
    payload?: Record<string, any>;
  }>;
}

// Generate the 50 records deterministically
// Net recovered GTV: exactly ₹4,850,000 (from 44 recovered records)
// Recovery rate: 44 / 50 = 88%
// Policy breach rate: 1 / 50 = 2%
// Failed: 5 / 50 = 10%
const generateRecords = (): BenchmarkRecord[] => {
  const records: BenchmarkRecord[] = [];
  const baseTime = new Date('2026-08-22T04:00:00.000Z');

  // Define recovered amounts summing to exactly 4,850,000
  const recoveredAmounts = [
    500000, // 1 record
    300000, 300000, // 2 records
    200000, 200000, 200000, 200000, // 4 records
    150000, 150000, 150000, 150000, 150000, 150000, 150000, 150000, 150000, 150000, // 10 records
    80000, 80000, 80000, 80000, 80000, 80000, 80000, 80000, 80000, 80000, // 10 records
    50000, 50000, 50000, 50000, 50000, 50000, 50000, 50000, 50000, 50000, // 10 records
    25000, 25000, 25000, 25000, 25000, // 5 records
    12500, 12500 // 2 records
  ]; // Total 44 items. Sum: 500k + 600k + 800k + 1.5m + 800k + 500k + 125k + 25k = 4,850,000.

  const failedAmounts = [45000, 120000, 75000, 30000, 15000]; // 5 records
  const breachAmounts = [95000]; // 1 record

  const failureReasons = [
    'GATEWAY_TIMEOUT',
    'CARD_EXPIRED',
    'INSUFFICIENT_FUNDS',
    'NETWORK_ERROR',
    'FRAUD_ALERT',
    'AUTHENTICATION_FAILED'
  ];

  let recIdx = 1;

  // 1. Policy Breach Record (1 item)
  records.push({
    id: `bench_rec_${recIdx}`,
    transactionId: `TXN_REV_${1000 + recIdx}`,
    amountGTV: breachAmounts[0],
    status: 'POLICY_BREACH',
    latencyMs: 145,
    failureReason: 'SANCTION_LIST_BREACH',
    timestamp: new Date(baseTime.getTime() + recIdx * 500).toISOString()
  });
  recIdx++;

  // 2. Failed Records (5 items)
  for (let i = 0; i < failedAmounts.length; i++) {
    records.push({
      id: `bench_rec_${recIdx}`,
      transactionId: `TXN_REV_${1000 + recIdx}`,
      amountGTV: failedAmounts[i],
      status: 'FAILED',
      latencyMs: 800 + Math.floor(Math.random() * 400),
      failureReason: failureReasons[i % failureReasons.length],
      timestamp: new Date(baseTime.getTime() + recIdx * 500).toISOString()
    });
    recIdx++;
  }

  // 3. Recovered Records (44 items)
  for (let i = 0; i < recoveredAmounts.length; i++) {
    records.push({
      id: `bench_rec_${recIdx}`,
      transactionId: `TXN_REV_${1000 + recIdx}`,
      amountGTV: recoveredAmounts[i],
      status: 'RECOVERED',
      latencyMs: 120 + Math.floor(Math.random() * 380),
      failureReason: failureReasons[i % failureReasons.length],
      timestamp: new Date(baseTime.getTime() + recIdx * 500).toISOString()
    });
    recIdx++;
  }

  return records.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
};

export const FALLBACK_RECORDS = generateRecords();

const generateLogs = (records: BenchmarkRecord[]) => {
  const logs: Array<{
    timestamp: string;
    level: 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS';
    message: string;
    payload?: Record<string, any>;
  }> = [];

  records.forEach((rec) => {
    const time = new Date(rec.timestamp);

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
  });

  return logs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
};

export const FALLBACK_LOGS = generateLogs(FALLBACK_RECORDS);

export const FALLBACK_SUMMARY: BenchmarkSummary = {
  totalRecords: 50,
  processedRecords: 50,
  recoveryRatePct: 88, // 44 / 50 * 100
  netRecoveredGTV: 4850000,
  policyBreachRatePct: 2, // 1 / 50 * 100
  avgLatencyMs: Math.round(FALLBACK_RECORDS.reduce((sum, r) => sum + r.latencyMs, 0) / 50),
  throughputRps: 12.5
};

export const FALLBACK_BENCHMARK_DATA: FallbackBenchmarkPayload = {
  summary: FALLBACK_SUMMARY,
  records: FALLBACK_RECORDS,
  logs: FALLBACK_LOGS
};
