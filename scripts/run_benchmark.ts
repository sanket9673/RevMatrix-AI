import * as fs from 'fs';
import * as path from 'path';
import { PolicyEngine } from '../src/lib/guardrails/policy_engine';
import { ProposedIntervention } from '../src/types/guardrails';

// --- TYPE DEFINITIONS ---

export type LoopType = 1 | 2;

export interface SyntheticCase {
  id: string;
  loop: LoopType;
  amount: number;
  currency: string;
  timestamp: string;
  customer: {
    id: string;
    tier: 'SMB' | 'MidMarket' | 'Enterprise';
    historicalScore: number;
  };
  loop1Details?: {
    failureReason: string;
    paymentMethod: string;
    gatewayErrorCode: string;
    attemptCount: number;
  };
  loop2Details?: {
    overdueReason: string;
    daysOverdue: number;
    disputeFlag: boolean;
    lastContactDaysAgo: number;
  };
}

export interface GroundTruthLabel {
  id: string;
  isRecoverable: boolean;
  expectedOptimalAction: string;
  maxAllowableDiscountPct: number;
  maxRetryCount: number;
  expectedPolicyPass: boolean;
  recoveryPotentialAmount: number;
}

export interface ExecutionTrace {
  caseId: string;
  loop: LoopType;
  recommendedAction: string;
  appliedDiscountPct: number;
  policyCheckPassed: boolean;
  policyViolations: string[];
  executionStatus: 'SUCCESS' | 'FAILED' | 'BLOCKED_BY_POLICY';
  recoveredAmount: number;
  groundTruthMatch: boolean;
  processingTimeMs: number;
}

export interface BenchmarkSummary {
  timestamp: string;
  totalEvaluated: number;
  loop1Cases: number;
  loop2Cases: number;
  recoverableCount: number;
  actualRecoveredCount: number;
  metrics: {
    CR_dual: number;
    NRY: number;
    PCR: number;
    avgLatencyMs: number;
  };
  traces: ExecutionTrace[];
}

// --- METRIC SCORING FUNCTIONS ---

export function calculateCRDual(recoveredCount: number, recoverableCount: number): number {
  if (recoverableCount <= 0) return 0;
  return recoveredCount / recoverableCount;
}

export function calculateNRY(
  recoveredOriginalAmountSum: number,
  discountsSum: number,
  recoverableOriginalAmountSum: number
): number {
  if (recoverableOriginalAmountSum <= 0) return 0;
  return (recoveredOriginalAmountSum - discountsSum) / recoverableOriginalAmountSum;
}

export function calculatePCR(zeroViolationCount: number, totalCases: number): number {
  if (totalCases <= 0) return 0;
  return zeroViolationCount / totalCases;
}

// --- MOCKED ORCHESTRATOR HARNESS ---

class MockedAgentOrchestrator {
  diagnoseAndPlan(sCase: SyntheticCase): {
    recommendedAction: string;
    proposedDiscountPercent: number;
    justification: string;
  } {
    // Standard mock orchestrator logic simulating diagnosis
    if (sCase.loop === 1) {
      const details = sCase.loop1Details!;
      if (details.failureReason === 'gateway_timeout') {
        return {
          recommendedAction: 'INSTANT_RETRY',
          proposedDiscountPercent: 0,
          justification: 'Gateway timeout detected. Initiating network-level instant retry.',
        };
      } else if (details.failureReason === 'expired_card') {
        // In 1 case out of 6, the mock orchestrator makes an error and proposes retry to test action mismatch
        if (sCase.id === 'case_l1_5') {
          return {
            recommendedAction: 'INSTANT_RETRY',
            proposedDiscountPercent: 0,
            justification: 'Mistakenly attempting retry on expired card.',
          };
        }
        return {
          recommendedAction: 'SEND_DUNNING_PAYMENT_LINK',
          proposedDiscountPercent: 0,
          justification: 'Card expired. Emitting secure update payment details link.',
        };
      } else if (details.failureReason === 'insufficient_balance') {
        // Mistakenly propose retry for 1 case to test mismatch
        if (sCase.id === 'case_l1_12') {
          return {
            recommendedAction: 'INSTANT_RETRY',
            proposedDiscountPercent: 0,
            justification: 'Mistakenly retrying insufficient balance transaction.',
          };
        }
        return {
          recommendedAction: 'SEND_DUNNING_PAYMENT_LINK',
          proposedDiscountPercent: 0,
          justification: 'Insufficient balance decline. Sending alternative payment link.',
        };
      } else if (details.failureReason === 'suspected_fraud') {
        // Escalate to quarantine
        return {
          recommendedAction: 'FRAUD_QUARANTINE',
          proposedDiscountPercent: 0,
          justification: 'High fraud risk profile. Quarantining transaction for review.',
        };
      }
    } else {
      const details = sCase.loop2Details!;
      if (details.overdueReason === 'forgotten_invoice') {
        // 1 case proposes 10% discount (which violates policy limit 5.0%)
        if (sCase.id === 'case_l2_8') {
          return {
            recommendedAction: 'SEND_DUNNING_PAYMENT_LINK',
            proposedDiscountPercent: 10,
            justification: 'Forgotten invoice. Proposing discount incentive above limit to test capping.',
          };
        }
        return {
          recommendedAction: 'SEND_DUNNING_PAYMENT_LINK',
          proposedDiscountPercent: 5,
          justification: 'Forgotten invoice. Resending notification with 5% discount.',
        };
      } else if (details.overdueReason === 'cashflow_gap') {
        // Offer payment plan with 10% discount (will trigger policy cap of 5%)
        return {
          recommendedAction: 'OFFER_DISCOUNT_PAYMENT_PLAN',
          proposedDiscountPercent: 10,
          justification: 'Client experiencing temporary cashflow delay. Proposing payment plan.',
        };
      } else if (details.overdueReason === 'billing_dispute') {
        return {
          recommendedAction: 'PAUSE_COLLECTIONS_DISPUTE',
          proposedDiscountPercent: 0,
          justification: 'Active billing dispute. Pausing automated dunning.',
        };
      } else if (details.overdueReason === 'uncontactable_debtor') {
        return {
          recommendedAction: 'HUMAN_ESCALATION',
          proposedDiscountPercent: 0,
          justification: 'No communication from debtor. Escalating to account representative.',
        };
      }
    }

    return {
      recommendedAction: 'HUMAN_ESCALATION',
      proposedDiscountPercent: 0,
      justification: 'Unrecognized scenario. Escalating.',
    };
  }
}

// --- RUNNER WORKFLOW ---

function run() {
  const dataDir = path.join(process.cwd(), 'data');
  const casesPath = path.join(dataDir, 'synthetic_50_failures.json');
  const labelsPath = path.join(dataDir, 'ground_truth.json');

  if (!fs.existsSync(casesPath) || !fs.existsSync(labelsPath)) {
    console.error('Error: Data files not found. Run generate:data first.');
    process.exit(1);
  }

  const cases: SyntheticCase[] = JSON.parse(fs.readFileSync(casesPath, 'utf-8'));
  const labels: GroundTruthLabel[] = JSON.parse(fs.readFileSync(labelsPath, 'utf-8'));

  const orchestrator = new MockedAgentOrchestrator();
  const policyEngine = new PolicyEngine();

  const traces: ExecutionTrace[] = [];

  let totalEvaluated = 0;
  let loop1Cases = 0;
  let loop2Cases = 0;
  let recoverableCount = 0;
  let actualRecoveredCount = 0;

  let recoveredOriginalAmountSum = 0;
  let discountsSum = 0;
  let recoverableOriginalAmountSum = 0;
  let zeroViolationCount = 0;
  let totalLatencyMs = 0;

  console.log('='.repeat(80));
  console.log(`STARTING OFFLINE BENCHMARK RUN (50 CASES)`);
  console.log('='.repeat(80));

  for (let i = 0; i < cases.length; i++) {
    const sCase = cases[i];
    const label = labels.find((l) => l.id === sCase.id);
    if (!label) {
      console.warn(`Label not found for case: ${sCase.id}`);
      continue;
    }

    totalEvaluated++;
    if (sCase.loop === 1) loop1Cases++;
    if (sCase.loop === 2) loop2Cases++;
    if (label.isRecoverable) {
      recoverableCount++;
      recoverableOriginalAmountSum += sCase.amount;
    }

    const start = Date.now();

    // 1. Diagnose
    const decision = orchestrator.diagnoseAndPlan(sCase);

    // 2. Validate Policy safety bounds
    const policyProposal: ProposedIntervention = {
      transactionId: sCase.id,
      proposedDiscountPercent: decision.proposedDiscountPercent,
      retryCount: sCase.loop === 1 ? sCase.loop1Details!.attemptCount : 0,
      failureCode: sCase.loop === 1 ? sCase.loop1Details!.gatewayErrorCode : sCase.loop2Details!.overdueReason,
      paymentLinkTTLMinutes: 15,
    };

    const policyResult = policyEngine.validateIntervention(policyProposal);

    // Determine applied discount
    let appliedDiscountPct = decision.proposedDiscountPercent;
    if (policyResult.status === 'POLICY_CAP_APPLIED' && policyResult.modifiedProposal) {
      appliedDiscountPct = policyResult.modifiedProposal.proposedDiscountPercent;
    }

    const processingTimeMs = Date.now() - start + Math.floor(Math.random() * 5); // Add minor mock jitter
    totalLatencyMs += processingTimeMs;

    // Check if the proposed action matches ground truth
    const groundTruthMatch = decision.recommendedAction === label.expectedOptimalAction;

    // Check policy violations
    const violations = policyResult.violations.map((v) => `${v.rule}: ${v.message}`);
    const policyCheckPassed = policyResult.allowed && violations.length === 0;

    if (policyCheckPassed) {
      zeroViolationCount++;
    }

    // 3. Simulate Provider Execution
    let executionStatus: ExecutionTrace['executionStatus'] = 'FAILED';
    let recoveredAmount = 0;

    if (!policyResult.allowed) {
      executionStatus = 'BLOCKED_BY_POLICY';
    } else if (label.isRecoverable && groundTruthMatch) {
      executionStatus = 'SUCCESS';
      recoveredAmount = sCase.amount;
      actualRecoveredCount++;
      recoveredOriginalAmountSum += sCase.amount;
      discountsSum += sCase.amount * (appliedDiscountPct / 100);
    } else {
      executionStatus = 'FAILED';
    }

    traces.push({
      caseId: sCase.id,
      loop: sCase.loop,
      recommendedAction: decision.recommendedAction,
      appliedDiscountPct,
      policyCheckPassed,
      policyViolations: violations,
      executionStatus,
      recoveredAmount,
      groundTruthMatch,
      processingTimeMs,
    });

    // Formatting pretty print for console progress log
    const statusSymbol = executionStatus === 'SUCCESS' ? '✓' : (executionStatus === 'BLOCKED_BY_POLICY' ? '⚠' : '✗');
    console.log(
      `[${sCase.id}] Loop ${sCase.loop} | Action: ${decision.recommendedAction.padEnd(28)} | Status: ${executionStatus.padEnd(18)} ${statusSymbol} | Violations: ${violations.length}`
    );
  }

  // Calculate live evaluation metrics strictly from iteration totals
  const CR_dual = calculateCRDual(actualRecoveredCount, recoverableCount);
  const NRY = calculateNRY(recoveredOriginalAmountSum, discountsSum, recoverableOriginalAmountSum);
  const PCR = calculatePCR(zeroViolationCount, totalEvaluated);
  const avgLatencyMs = totalLatencyMs / totalEvaluated;

  const summary: BenchmarkSummary = {
    timestamp: new Date().toISOString(),
    totalEvaluated,
    loop1Cases,
    loop2Cases,
    recoverableCount,
    actualRecoveredCount,
    metrics: {
      CR_dual,
      NRY,
      PCR,
      avgLatencyMs,
    },
    traces,
  };

  // Save to BENCHMARK_RESULTS.json
  fs.writeFileSync(
    path.join(process.cwd(), 'BENCHMARK_RESULTS.json'),
    JSON.stringify(summary, null, 2),
    'utf-8'
  );

  console.log('='.repeat(80));
  console.log(`BENCHMARK METRICS SUMMARY`);
  console.log('='.repeat(80));
  console.table({
    'Total Scenarios': totalEvaluated,
    'Loop 1 Cases': loop1Cases,
    'Loop 2 Cases': loop2Cases,
    'Recoverable Count': recoverableCount,
    'Recovered Count': actualRecoveredCount,
    'Dual-Loop Conversion Rate (CR_dual)': `${(CR_dual * 100).toFixed(2)}%`,
    'Net Recovered Yield (NRY)': `${(NRY * 100).toFixed(2)}%`,
    'Policy Compliance Rate (PCR)': `${(PCR * 100).toFixed(2)}%`,
    'Average Latency': `${avgLatencyMs.toFixed(2)} ms`,
  });
  console.log('='.repeat(80));
  console.log(`Traces exported to BENCHMARK_RESULTS.json`);
}

// Only execute when run directly as script
if (require.main === module) {
  run();
}
