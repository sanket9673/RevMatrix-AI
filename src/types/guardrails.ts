export interface ProposedIntervention {
  transactionId: string;
  proposedDiscountPercent: number;
  retryCount: number;
  failureCode: string;
  paymentLinkTTLMinutes: number;
  metadata?: Record<string, unknown>;
}

export interface PolicyViolation {
  rule: string;
  message: string;
  actionTaken: 'BLOCKED' | 'CAPPED' | 'FLAGGED';
}

export interface PolicyValidationResult {
  allowed: boolean;
  reason?: string;
  status: 'APPROVED' | 'POLICY_CAP_APPLIED' | 'HALTED_POLICY_BLOCK' | 'REJECTED_EXCEEDED_LIMITS';
  modifiedProposal?: ProposedIntervention;
  violations: PolicyViolation[];
}

export interface PolicyEngineConfig {
  maxDiscountPercent?: number;
  maxRetriesPer24h?: number;
  linkTTLMinutes?: number;
  fraudBlockList?: string[];
}

export class PolicyViolationError extends Error {
  public readonly violations: PolicyViolation[];

  constructor(message: string, violations: PolicyViolation[] = []) {
    super(message);
    this.name = 'PolicyViolationError';
    this.violations = violations;
    Object.setPrototypeOf(this, PolicyViolationError.prototype);
  }
}
