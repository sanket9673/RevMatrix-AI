import {
  ProposedIntervention,
  PolicyValidationResult,
  PolicyEngineConfig,
  PolicyViolation,
} from '@/types/guardrails';

export class PolicyEngine {
  public static readonly MAX_DISCOUNT_PERCENT = 5.0;
  public static readonly MAX_RETRIES_PER_24H = 2;
  public static readonly LINK_TTL_MINUTES = 15;
  public static readonly FRAUD_BLOCK_LIST = [
    'BAD_REQUEST_PAYMENT_POSSIBLE_FRAUD',
    'RISK_CHECK_FAILED',
  ];

  private readonly config: Required<PolicyEngineConfig>;

  constructor(config?: PolicyEngineConfig) {
    this.config = {
      maxDiscountPercent: config?.maxDiscountPercent ?? PolicyEngine.MAX_DISCOUNT_PERCENT,
      maxRetriesPer24h: config?.maxRetriesPer24h ?? PolicyEngine.MAX_RETRIES_PER_24H,
      linkTTLMinutes: config?.linkTTLMinutes ?? PolicyEngine.LINK_TTL_MINUTES,
      fraudBlockList: config?.fraudBlockList ?? PolicyEngine.FRAUD_BLOCK_LIST,
    };
  }

  public getConfig(): Readonly<PolicyEngineConfig> {
    return this.config;
  }

  public isFraudCode(code: string): boolean {
    return this.config.fraudBlockList.includes(code);
  }

  public validateIntervention(proposal: ProposedIntervention): PolicyValidationResult {
    const violations: PolicyViolation[] = [];

    // Rule 1 (Fraud Hard-Stop): If failureCode matches fraud blacklist, halt workflow.
    if (proposal.failureCode && this.isFraudCode(proposal.failureCode)) {
      const message = `Transaction flagged for potential fraud. Failure code '${proposal.failureCode}' matches fraud blacklist.`;
      const violation: PolicyViolation = {
        rule: 'FRAUD_BLOCK_LIST',
        message,
        actionTaken: 'BLOCKED',
      };
      return {
        allowed: false,
        reason: message,
        status: 'HALTED_POLICY_BLOCK',
        violations: [violation],
      };
    }

    // Rule 2 (Retry Limit Check): If retryCount >= maxRetriesPer24h, reject validation.
    if (proposal.retryCount >= this.config.maxRetriesPer24h) {
      const message = `Retry limit exceeded. Attempt ${proposal.retryCount} equals or exceeds the maximum of ${this.config.maxRetriesPer24h} attempts.`;
      const violation: PolicyViolation = {
        rule: 'MAX_RETRIES_PER_24H',
        message,
        actionTaken: 'BLOCKED',
      };
      return {
        allowed: false,
        reason: message,
        status: 'REJECTED_EXCEEDED_LIMITS',
        violations: [violation],
      };
    }

    // Rule 3 (Discount Cap Engine) & Rule 4 (Link TTL Enforcement)
    let modifiedDiscount = proposal.proposedDiscountPercent;
    let modifiedTTL = proposal.paymentLinkTTLMinutes;
    let hasCapsApplied = false;

    if (proposal.proposedDiscountPercent > this.config.maxDiscountPercent) {
      modifiedDiscount = this.config.maxDiscountPercent;
      hasCapsApplied = true;
      violations.push({
        rule: 'MAX_DISCOUNT_PERCENT',
        message: `Proposed discount of ${proposal.proposedDiscountPercent}% exceeds the maximum limit of ${this.config.maxDiscountPercent}%. Capped to ${this.config.maxDiscountPercent}%.`,
        actionTaken: 'CAPPED',
      });
    }

    if (proposal.paymentLinkTTLMinutes > this.config.linkTTLMinutes) {
      modifiedTTL = this.config.linkTTLMinutes;
      hasCapsApplied = true;
      violations.push({
        rule: 'LINK_TTL_MINUTES',
        message: `Proposed payment link TTL of ${proposal.paymentLinkTTLMinutes} minutes exceeds the maximum limit of ${this.config.linkTTLMinutes} minutes. Capped to ${this.config.linkTTLMinutes} minutes.`,
        actionTaken: 'CAPPED',
      });
    }

    if (hasCapsApplied) {
      const modifiedProposal: ProposedIntervention = {
        ...proposal,
        proposedDiscountPercent: modifiedDiscount,
        paymentLinkTTLMinutes: modifiedTTL,
      };

      return {
        allowed: true,
        reason: 'Policy validation successful with automatically applied caps.',
        status: 'POLICY_CAP_APPLIED',
        modifiedProposal,
        violations,
      };
    }

    return {
      allowed: true,
      status: 'APPROVED',
      violations: [],
    };
  }
}
