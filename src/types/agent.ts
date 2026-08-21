export type Loop1TechnicalCategory =
  | 'TECHNICAL_TIMEOUT'
  | 'INSUFFICIENT_BALANCE'
  | 'EXPIRED_INSTRUMENT'
  | 'UNKNOWN_GATEWAY_ERROR';

export type Loop2BusinessCategory =
  | 'INVOICE_MISPLACEMENT'
  | 'CASHFLOW_DELAY'
  | 'DISPUTE_ESCALATION'
  | 'UNRESOLVED_TERMS';

export type DiagnosisCategory = Loop1TechnicalCategory | Loop2BusinessCategory;

export type InterventionType =
  | 'RETRY_GATEWAY_ALTERNATIVE'
  | 'OFFER_PAYMENT_PLAN'
  | 'EMIT_DISCOUNT_INCENTIVE'
  | 'ESCALATE_TO_ACCOUNT_EXEC'
  | 'PAUSE_COLLECTIONS';

export interface Transaction {
  id: string;
  customerId: string;
  amount: number;
  currency: string;
  errorCode?: string;
  errorMessage?: string;
  invoiceId?: string;
  createdAt: string;
}

export interface CustomerContext {
  customerSegment: 'SMB' | 'MID_MARKET' | 'ENTERPRISE';
  tenureMonths: number;
  openDisputesCount: number;
  rawInvoiceLogs?: string[];
}

export interface ReasoningStep {
  stepNumber: number;
  timestamp: string;
  type: 'THOUGHT' | 'TOOL_CALL' | 'TOOL_RESPONSE' | 'FINAL_DECISION';
  content: string;
  metadata?: Record<string, unknown>;
}

export interface FetchCustomerHistoryInput {
  customerId: string;
}

export interface FetchCustomerHistoryOutput {
  customerId: string;
  paymentSuccessRate: number; // e.g., 0.85 (85%)
  outstandingInvoiceCount: number;
  totalRevenueLifetime: number;
}

export interface EvaluatePolicyBoundsInput {
  customerSegment: 'SMB' | 'MID_MARKET' | 'ENTERPRISE';
  proposedIntervention: InterventionType;
}

export interface EvaluatePolicyBoundsOutput {
  allowed: boolean;
  maxAllowableDiscountPercent: number;
  maxRetryAttempts: number;
  requiresHumanApproval: boolean;
  reason?: string;
}

export interface AgentDecisionResult {
  transactionId: string;
  diagnosis: DiagnosisCategory;
  justification: string;
  recommendedIntervention: InterventionType;
  proposedDiscountPercent: number;
  requiresHumanApproval: boolean;
  reasoningTrace: ReasoningStep[];
}
