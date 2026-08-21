import { PolicyEngine } from '@/lib/guardrails/policy_engine';
import { ProposedIntervention } from '@/types/guardrails';

describe('PolicyEngine Guardrail Layer', () => {
  let engine: PolicyEngine;

  beforeEach(() => {
    engine = new PolicyEngine();
  });

  describe('Configuration & Instantiation', () => {
    test('should instantiate with default configuration', () => {
      const config = engine.getConfig();
      expect(config.maxDiscountPercent).toBe(5.0);
      expect(config.maxRetriesPer24h).toBe(2);
      expect(config.linkTTLMinutes).toBe(15);
      expect(config.fraudBlockList).toEqual([
        'BAD_REQUEST_PAYMENT_POSSIBLE_FRAUD',
        'RISK_CHECK_FAILED',
      ]);
    });

    test('should accept custom configuration overrides', () => {
      const customEngine = new PolicyEngine({
        maxDiscountPercent: 10.0,
        maxRetriesPer24h: 5,
        linkTTLMinutes: 60,
        fraudBlockList: ['CUSTOM_FRAUD_CODE'],
      });
      const config = customEngine.getConfig();
      expect(config.maxDiscountPercent).toBe(10.0);
      expect(config.maxRetriesPer24h).toBe(5);
      expect(config.linkTTLMinutes).toBe(60);
      expect(config.fraudBlockList).toEqual(['CUSTOM_FRAUD_CODE']);
    });
  });

  describe('Fraud Stop Checks', () => {
    test('should halt with HALTED_POLICY_BLOCK when failureCode is BAD_REQUEST_PAYMENT_POSSIBLE_FRAUD', () => {
      const proposal: ProposedIntervention = {
        transactionId: 'tx_fraud_1',
        proposedDiscountPercent: 2.0,
        retryCount: 0,
        failureCode: 'BAD_REQUEST_PAYMENT_POSSIBLE_FRAUD',
        paymentLinkTTLMinutes: 10,
      };

      const result = engine.validateIntervention(proposal);
      expect(result.allowed).toBe(false);
      expect(result.status).toBe('HALTED_POLICY_BLOCK');
      expect(result.reason).toContain('matches fraud blacklist');
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0]).toEqual({
        rule: 'FRAUD_BLOCK_LIST',
        message: expect.stringContaining('BAD_REQUEST_PAYMENT_POSSIBLE_FRAUD'),
        actionTaken: 'BLOCKED',
      });
    });

    test('should halt with HALTED_POLICY_BLOCK when failureCode is RISK_CHECK_FAILED', () => {
      const proposal: ProposedIntervention = {
        transactionId: 'tx_fraud_2',
        proposedDiscountPercent: 2.0,
        retryCount: 0,
        failureCode: 'RISK_CHECK_FAILED',
        paymentLinkTTLMinutes: 10,
      };

      const result = engine.validateIntervention(proposal);
      expect(result.allowed).toBe(false);
      expect(result.status).toBe('HALTED_POLICY_BLOCK');
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].rule).toBe('FRAUD_BLOCK_LIST');
      expect(result.violations[0].actionTaken).toBe('BLOCKED');
    });

    test('should pass fraud checks and approve when failureCode is a legitimate error code like INSUFFICIENT_FUNDS', () => {
      const proposal: ProposedIntervention = {
        transactionId: 'tx_legit_1',
        proposedDiscountPercent: 2.0,
        retryCount: 0,
        failureCode: 'INSUFFICIENT_FUNDS',
        paymentLinkTTLMinutes: 10,
      };

      const result = engine.validateIntervention(proposal);
      expect(result.allowed).toBe(true);
      expect(result.status).toBe('APPROVED');
      expect(result.violations).toHaveLength(0);
    });
  });

  describe('Retry Limit Checks', () => {
    test('should approve when retryCount is 0 or 1', () => {
      const proposal0: ProposedIntervention = {
        transactionId: 'tx_retry_0',
        proposedDiscountPercent: 2.0,
        retryCount: 0,
        failureCode: 'INSUFFICIENT_FUNDS',
        paymentLinkTTLMinutes: 10,
      };

      const proposal1: ProposedIntervention = {
        transactionId: 'tx_retry_1',
        proposedDiscountPercent: 2.0,
        retryCount: 1,
        failureCode: 'INSUFFICIENT_FUNDS',
        paymentLinkTTLMinutes: 10,
      };

      expect(engine.validateIntervention(proposal0).allowed).toBe(true);
      expect(engine.validateIntervention(proposal0).status).toBe('APPROVED');
      expect(engine.validateIntervention(proposal1).allowed).toBe(true);
      expect(engine.validateIntervention(proposal1).status).toBe('APPROVED');
    });

    test('should reject with REJECTED_EXCEEDED_LIMITS when retryCount is 2 or higher', () => {
      const proposal2: ProposedIntervention = {
        transactionId: 'tx_retry_2',
        proposedDiscountPercent: 2.0,
        retryCount: 2,
        failureCode: 'INSUFFICIENT_FUNDS',
        paymentLinkTTLMinutes: 10,
      };

      const proposal3: ProposedIntervention = {
        transactionId: 'tx_retry_3',
        proposedDiscountPercent: 2.0,
        retryCount: 3,
        failureCode: 'INSUFFICIENT_FUNDS',
        paymentLinkTTLMinutes: 10,
      };

      const result2 = engine.validateIntervention(proposal2);
      expect(result2.allowed).toBe(false);
      expect(result2.status).toBe('REJECTED_EXCEEDED_LIMITS');
      expect(result2.violations).toHaveLength(1);
      expect(result2.violations[0]).toEqual({
        rule: 'MAX_RETRIES_PER_24H',
        message: expect.stringContaining('Retry limit exceeded'),
        actionTaken: 'BLOCKED',
      });

      const result3 = engine.validateIntervention(proposal3);
      expect(result3.allowed).toBe(false);
      expect(result3.status).toBe('REJECTED_EXCEEDED_LIMITS');
    });
  });

  describe('Discount Capping Checks', () => {
    test('should approve un-modified when proposedDiscountPercent is within limits', () => {
      const proposal: ProposedIntervention = {
        transactionId: 'tx_discount_3',
        proposedDiscountPercent: 3.0,
        retryCount: 0,
        failureCode: 'INSUFFICIENT_FUNDS',
        paymentLinkTTLMinutes: 10,
      };

      const result = engine.validateIntervention(proposal);
      expect(result.allowed).toBe(true);
      expect(result.status).toBe('APPROVED');
      expect(result.modifiedProposal).toBeUndefined();
      expect(result.violations).toHaveLength(0);
    });

    test('should cap discount to MAX_DISCOUNT_PERCENT and return POLICY_CAP_APPLIED when discount exceeds limit', () => {
      const proposal: ProposedIntervention = {
        transactionId: 'tx_discount_8',
        proposedDiscountPercent: 8.0,
        retryCount: 0,
        failureCode: 'INSUFFICIENT_FUNDS',
        paymentLinkTTLMinutes: 10,
      };

      const result = engine.validateIntervention(proposal);
      expect(result.allowed).toBe(true);
      expect(result.status).toBe('POLICY_CAP_APPLIED');
      expect(result.modifiedProposal).toBeDefined();
      expect(result.modifiedProposal?.proposedDiscountPercent).toBe(5.0);
      expect(result.modifiedProposal?.transactionId).toBe('tx_discount_8');
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0]).toEqual({
        rule: 'MAX_DISCOUNT_PERCENT',
        message: expect.stringContaining('Proposed discount of 8% exceeds'),
        actionTaken: 'CAPPED',
      });
    });

    test('should handle 0% and negative discount percentages correctly without capping', () => {
      const proposal0: ProposedIntervention = {
        transactionId: 'tx_discount_0',
        proposedDiscountPercent: 0,
        retryCount: 0,
        failureCode: 'INSUFFICIENT_FUNDS',
        paymentLinkTTLMinutes: 10,
      };

      const proposalNeg: ProposedIntervention = {
        transactionId: 'tx_discount_neg',
        proposedDiscountPercent: -2.5,
        retryCount: 0,
        failureCode: 'INSUFFICIENT_FUNDS',
        paymentLinkTTLMinutes: 10,
      };

      const result0 = engine.validateIntervention(proposal0);
      expect(result0.allowed).toBe(true);
      expect(result0.status).toBe('APPROVED');
      expect(result0.modifiedProposal).toBeUndefined();

      const resultNeg = engine.validateIntervention(proposalNeg);
      expect(resultNeg.allowed).toBe(true);
      expect(resultNeg.status).toBe('APPROVED');
      expect(resultNeg.modifiedProposal).toBeUndefined();
    });
  });

  describe('Link TTL Enforcement Checks', () => {
    test('should approve un-modified when paymentLinkTTLMinutes is within limits', () => {
      const proposal: ProposedIntervention = {
        transactionId: 'tx_ttl_10',
        proposedDiscountPercent: 2.0,
        retryCount: 0,
        failureCode: 'INSUFFICIENT_FUNDS',
        paymentLinkTTLMinutes: 10,
      };

      const result = engine.validateIntervention(proposal);
      expect(result.allowed).toBe(true);
      expect(result.status).toBe('APPROVED');
      expect(result.modifiedProposal).toBeUndefined();
    });

    test('should cap paymentLinkTTLMinutes to LINK_TTL_MINUTES and return POLICY_CAP_APPLIED when TTL exceeds limit', () => {
      const proposal: ProposedIntervention = {
        transactionId: 'tx_ttl_30',
        proposedDiscountPercent: 2.0,
        retryCount: 0,
        failureCode: 'INSUFFICIENT_FUNDS',
        paymentLinkTTLMinutes: 30,
      };

      const result = engine.validateIntervention(proposal);
      expect(result.allowed).toBe(true);
      expect(result.status).toBe('POLICY_CAP_APPLIED');
      expect(result.modifiedProposal).toBeDefined();
      expect(result.modifiedProposal?.paymentLinkTTLMinutes).toBe(15);
      expect(result.modifiedProposal?.proposedDiscountPercent).toBe(2.0);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0]).toEqual({
        rule: 'LINK_TTL_MINUTES',
        message: expect.stringContaining('payment link TTL of 30 minutes exceeds'),
        actionTaken: 'CAPPED',
      });
    });
  });

  describe('Combined Matrix & Precedence Tests', () => {
    test('should enforce both discount and TTL caps simultaneously when both exceed limits', () => {
      const proposal: ProposedIntervention = {
        transactionId: 'tx_both_exceeded',
        proposedDiscountPercent: 12.0,
        retryCount: 0,
        failureCode: 'INSUFFICIENT_FUNDS',
        paymentLinkTTLMinutes: 45,
      };

      const result = engine.validateIntervention(proposal);
      expect(result.allowed).toBe(true);
      expect(result.status).toBe('POLICY_CAP_APPLIED');
      expect(result.modifiedProposal).toBeDefined();
      expect(result.modifiedProposal?.proposedDiscountPercent).toBe(5.0);
      expect(result.modifiedProposal?.paymentLinkTTLMinutes).toBe(15);
      expect(result.violations).toHaveLength(2);
      expect(result.violations.map((v) => v.rule)).toContain('MAX_DISCOUNT_PERCENT');
      expect(result.violations.map((v) => v.rule)).toContain('LINK_TTL_MINUTES');
    });

    test('should prioritize fraud block over discount capping and retry checks', () => {
      const proposal: ProposedIntervention = {
        transactionId: 'tx_fraud_precedence',
        proposedDiscountPercent: 10.0, // exceeds cap
        retryCount: 3, // exceeds retry limit
        failureCode: 'RISK_CHECK_FAILED', // fraud code
        paymentLinkTTLMinutes: 45, // exceeds TTL cap
      };

      const result = engine.validateIntervention(proposal);
      expect(result.allowed).toBe(false);
      // Fraud takes strict priority
      expect(result.status).toBe('HALTED_POLICY_BLOCK');
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].rule).toBe('FRAUD_BLOCK_LIST');
    });

    test('should prioritize retry limit check over discount capping and TTL checks', () => {
      const proposal: ProposedIntervention = {
        transactionId: 'tx_retry_precedence',
        proposedDiscountPercent: 10.0, // exceeds cap
        retryCount: 3, // exceeds retry limit
        failureCode: 'INSUFFICIENT_FUNDS', // normal code
        paymentLinkTTLMinutes: 45, // exceeds TTL cap
      };

      const result = engine.validateIntervention(proposal);
      expect(result.allowed).toBe(false);
      // Retry limit check takes precedence over capping
      expect(result.status).toBe('REJECTED_EXCEEDED_LIMITS');
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].rule).toBe('MAX_RETRIES_PER_24H');
    });
  });
});
