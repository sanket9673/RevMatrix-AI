import * as fs from 'fs';
import * as path from 'path';

// --- TYPE DEFINITIONS ---

export type LoopType = 1 | 2;

export type Loop1FailureReason = 
  | 'gateway_timeout' 
  | 'expired_card' 
  | 'insufficient_balance' 
  | 'suspected_fraud';

export type Loop2OverdueReason = 
  | 'forgotten_invoice' 
  | 'cashflow_gap' 
  | 'billing_dispute' 
  | 'uncontactable_debtor';

export interface SyntheticCase {
  id: string;
  loop: LoopType;
  amount: number;
  currency: string;
  timestamp: string;
  customer: {
    id: string;
    tier: 'SMB' | 'MidMarket' | 'Enterprise';
    historicalScore: number; // 0 to 100
  };
  loop1Details?: {
    failureReason: Loop1FailureReason;
    paymentMethod: 'credit_card' | 'debit_card' | 'upi' | 'netbanking';
    gatewayErrorCode: string;
    attemptCount: number;
  };
  loop2Details?: {
    overdueReason: Loop2OverdueReason;
    daysOverdue: number;
    disputeFlag: boolean;
    lastContactDaysAgo: number;
  };
}

export interface GroundTruthLabel {
  id: string;
  isRecoverable: boolean;
  expectedOptimalAction: 
    | 'INSTANT_RETRY' 
    | 'FALLBACK_GATEWAY' 
    | 'SEND_DUNNING_PAYMENT_LINK' 
    | 'OFFER_DISCOUNT_PAYMENT_PLAN' 
    | 'FRAUD_QUARANTINE' 
    | 'PAUSE_COLLECTIONS_DISPUTE' 
    | 'HUMAN_ESCALATION';
  maxAllowableDiscountPct: number;
  maxRetryCount: number;
  expectedPolicyPass: boolean;
  recoveryPotentialAmount: number;
}

// --- DETERMINISTIC SEEDED RANDOM GENERATOR ---

class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  next(): number {
    const x = Math.sin(this.seed++) * 10000;
    return x - Math.floor(x);
  }

  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  intRange(min: number, max: number): number {
    return Math.floor(this.range(min, max));
  }

  pick<T>(arr: T[]): T {
    return arr[this.intRange(0, arr.length)];
  }

  shuffle<T>(arr: T[]): T[] {
    const shuffled = [...arr];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = this.intRange(0, i + 1);
      const temp = shuffled[i];
      shuffled[i] = shuffled[j];
      shuffled[j] = temp;
    }
    return shuffled;
  }
}

// --- GENERATOR LOGIC ---

function generateData() {
  const rng = new SeededRandom(42); // Seed for complete reproducibility

  const syntheticCases: SyntheticCase[] = [];
  const groundTruthLabels: GroundTruthLabel[] = [];

  // --- LOOP 1 CASES (25 Total) ---
  // Distribution: gateway_timeout (8), expired_card (6), insufficient_balance (7), suspected_fraud (4)
  const loop1Reasons: Loop1FailureReason[] = [];
  for (let i = 0; i < 8; i++) loop1Reasons.push('gateway_timeout');
  for (let i = 0; i < 6; i++) loop1Reasons.push('expired_card');
  for (let i = 0; i < 7; i++) loop1Reasons.push('insufficient_balance');
  for (let i = 0; i < 4; i++) loop1Reasons.push('suspected_fraud');

  const shuffledLoop1Reasons = rng.shuffle(loop1Reasons);

  // --- LOOP 2 CASES (25 Total) ---
  // Distribution: forgotten_invoice (8), cashflow_gap (7), billing_dispute (5), uncontactable_debtor (5)
  const loop2Reasons: Loop2OverdueReason[] = [];
  for (let i = 0; i < 8; i++) loop2Reasons.push('forgotten_invoice');
  for (let i = 0; i < 7; i++) loop2Reasons.push('cashflow_gap');
  for (let i = 0; i < 5; i++) loop2Reasons.push('billing_dispute');
  for (let i = 0; i < 5; i++) loop2Reasons.push('uncontactable_debtor');

  const shuffledLoop2Reasons = rng.shuffle(loop2Reasons);

  // Process Loop 1
  for (let i = 0; i < 25; i++) {
    const id = `case_l1_${i + 1}`;
    const reason = shuffledLoop1Reasons[i];
    const amount = Math.round(rng.range(50, 2500) * 100) / 100;
    const currency = rng.pick(['USD', 'INR']);
    const daysAgo = rng.intRange(1, 30);
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    const timestamp = date.toISOString();

    const tier = rng.pick(['SMB', 'MidMarket', 'Enterprise'] as const);
    const historicalScore = rng.intRange(40, 98);

    let gatewayErrorCode = 'UNKNOWN_GATEWAY_ERROR';
    if (reason === 'gateway_timeout') gatewayErrorCode = 'GATEWAY_TIMEOUT';
    else if (reason === 'expired_card') gatewayErrorCode = 'EXPIRED_CARD';
    else if (reason === 'insufficient_balance') gatewayErrorCode = 'INSUFFICIENT_BALANCE';
    else if (reason === 'suspected_fraud') gatewayErrorCode = 'BAD_REQUEST_PAYMENT_POSSIBLE_FRAUD';

    let attemptCount = 1;
    if (reason === 'gateway_timeout' && i % 4 === 0) {
      attemptCount = 2; // Trigger retry cap violation in policy check
    } else {
      attemptCount = rng.intRange(1, 2);
    }

    const paymentMethod = rng.pick(['credit_card', 'debit_card', 'upi', 'netbanking'] as const);

    const sCase: SyntheticCase = {
      id,
      loop: 1,
      amount,
      currency,
      timestamp,
      customer: {
        id: `cust_l1_${i + 1}`,
        tier,
        historicalScore,
      },
      loop1Details: {
        failureReason: reason,
        paymentMethod,
        gatewayErrorCode,
        attemptCount,
      },
    };

    let isRecoverable = true;
    let expectedOptimalAction: GroundTruthLabel['expectedOptimalAction'] = 'SEND_DUNNING_PAYMENT_LINK';
    let maxAllowableDiscountPct = 0;
    let maxRetryCount = 0;
    let expectedPolicyPass = true;

    if (reason === 'suspected_fraud') {
      isRecoverable = false;
      expectedOptimalAction = 'FRAUD_QUARANTINE';
      expectedPolicyPass = false;
    } else if (reason === 'gateway_timeout') {
      expectedOptimalAction = 'INSTANT_RETRY';
      maxRetryCount = 2;
      if (attemptCount >= 2) {
        expectedPolicyPass = false;
      }
    } else if (reason === 'expired_card') {
      expectedOptimalAction = 'SEND_DUNNING_PAYMENT_LINK';
    } else if (reason === 'insufficient_balance') {
      expectedOptimalAction = 'SEND_DUNNING_PAYMENT_LINK';
    }

    const label: GroundTruthLabel = {
      id,
      isRecoverable,
      expectedOptimalAction,
      maxAllowableDiscountPct,
      maxRetryCount,
      expectedPolicyPass,
      recoveryPotentialAmount: isRecoverable ? amount : 0,
    };

    syntheticCases.push(sCase);
    groundTruthLabels.push(label);
  }

  // Process Loop 2
  for (let i = 0; i < 25; i++) {
    const id = `case_l2_${i + 1}`;
    const reason = shuffledLoop2Reasons[i];
    const amount = Math.round(rng.range(500, 15000) * 100) / 100;
    const currency = rng.pick(['USD', 'INR']);
    const daysAgo = rng.intRange(15, 90);
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    const timestamp = date.toISOString();

    const tier = rng.pick(['SMB', 'MidMarket', 'Enterprise'] as const);
    const historicalScore = rng.intRange(30, 95);

    const daysOverdue = rng.intRange(10, 120);
    const disputeFlag = reason === 'billing_dispute';
    const lastContactDaysAgo = rng.intRange(1, 45);

    const sCase: SyntheticCase = {
      id,
      loop: 2,
      amount,
      currency,
      timestamp,
      customer: {
        id: `cust_l2_${i + 1}`,
        tier,
        historicalScore,
      },
      loop2Details: {
        overdueReason: reason,
        daysOverdue,
        disputeFlag,
        lastContactDaysAgo,
      },
    };

    let isRecoverable = true;
    let expectedOptimalAction: GroundTruthLabel['expectedOptimalAction'] = 'SEND_DUNNING_PAYMENT_LINK';
    let maxAllowableDiscountPct = 0;
    let maxRetryCount = 0;
    let expectedPolicyPass = true;

    if (reason === 'forgotten_invoice') {
      expectedOptimalAction = 'SEND_DUNNING_PAYMENT_LINK';
      maxAllowableDiscountPct = 5;
    } else if (reason === 'cashflow_gap') {
      expectedOptimalAction = 'OFFER_DISCOUNT_PAYMENT_PLAN';
      maxAllowableDiscountPct = 10;
    } else if (reason === 'billing_dispute') {
      isRecoverable = false;
      expectedOptimalAction = 'PAUSE_COLLECTIONS_DISPUTE';
    } else if (reason === 'uncontactable_debtor') {
      isRecoverable = false;
      expectedOptimalAction = 'HUMAN_ESCALATION';
    }

    const label: GroundTruthLabel = {
      id,
      isRecoverable,
      expectedOptimalAction,
      maxAllowableDiscountPct,
      maxRetryCount,
      expectedPolicyPass,
      recoveryPotentialAmount: isRecoverable ? amount : 0,
    };

    syntheticCases.push(sCase);
    groundTruthLabels.push(label);
  }

  const dataDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  fs.writeFileSync(
    path.join(dataDir, 'synthetic_50_failures.json'),
    JSON.stringify(syntheticCases, null, 2),
    'utf-8'
  );
  fs.writeFileSync(
    path.join(dataDir, 'ground_truth.json'),
    JSON.stringify(groundTruthLabels, null, 2),
    'utf-8'
  );

  console.log(`Successfully generated 50 synthetic test cases and labels:`);
  console.log(`- Created: data/synthetic_50_failures.json`);
  console.log(`- Created: data/ground_truth.json`);
  console.log(`- Loop 1 Cases: 25`);
  console.log(`- Loop 2 Cases: 25`);
}

generateData();
