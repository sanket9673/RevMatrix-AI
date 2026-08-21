import { FunctionDeclaration, Type } from '@google/genai';
import {
  FetchCustomerHistoryInput,
  FetchCustomerHistoryOutput,
  EvaluatePolicyBoundsInput,
  EvaluatePolicyBoundsOutput,
} from '../../types/agent';

// Gemini Function Declarations using official SDK types
export const fetchCustomerHistoryDeclaration: FunctionDeclaration = {
  name: 'fetchCustomerHistory',
  description: 'Retrieves customer payment success rates, lifetime value, and outstanding invoice counts.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      customerId: {
        type: Type.STRING,
        description: 'The unique ID of the customer.',
      },
    },
    required: ['customerId'],
  },
};

export const evaluatePolicyBoundsDeclaration: FunctionDeclaration = {
  name: 'evaluatePolicyBounds',
  description: 'Queries RevMatrix-AI governance policy rules for maximum allowed discounts and retries by customer segment.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      customerSegment: {
        type: Type.STRING,
        description: 'The segment tier of the customer.',
        enum: ['SMB', 'MID_MARKET', 'ENTERPRISE'],
      },
      proposedIntervention: {
        type: Type.STRING,
        description: 'The action being considered for execution.',
        enum: [
          'RETRY_GATEWAY_ALTERNATIVE',
          'OFFER_PAYMENT_PLAN',
          'EMIT_DISCOUNT_INCENTIVE',
          'ESCALATE_TO_ACCOUNT_EXEC',
          'PAUSE_COLLECTIONS',
        ],
      },
    },
    required: ['customerSegment', 'proposedIntervention'],
  },
};

export const agentTools = [
  {
    functionDeclarations: [
      fetchCustomerHistoryDeclaration,
      evaluatePolicyBoundsDeclaration,
    ],
  },
];

// Mock tool execution implementations
export async function executeFetchCustomerHistory(
  input: FetchCustomerHistoryInput
): Promise<FetchCustomerHistoryOutput> {
  // Mock data execution - replace with database query in production
  return {
    customerId: input.customerId,
    paymentSuccessRate: 0.88,
    outstandingInvoiceCount: 2,
    totalRevenueLifetime: 145000,
  };
}

export async function executeEvaluatePolicyBounds(
  input: EvaluatePolicyBoundsInput
): Promise<EvaluatePolicyBoundsOutput> {
  // Mock governance policy evaluation
  const segmentLimits: Record<string, { maxDiscount: number; maxRetries: number; reqApproval: boolean }> = {
    SMB: { maxDiscount: 10, maxRetries: 3, reqApproval: false },
    MID_MARKET: { maxDiscount: 15, maxRetries: 2, reqApproval: false },
    ENTERPRISE: { maxDiscount: 20, maxRetries: 1, reqApproval: true },
  };

  const limit = segmentLimits[input.customerSegment] || { maxDiscount: 5, maxRetries: 1, reqApproval: true };

  return {
    allowed: true,
    maxAllowableDiscountPercent: limit.maxDiscount,
    maxRetryAttempts: limit.maxRetries,
    requiresHumanApproval: limit.reqApproval || input.proposedIntervention === 'ESCALATE_TO_ACCOUNT_EXEC',
  };
}
