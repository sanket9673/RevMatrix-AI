import { AgentOrchestrator } from '@/lib/agent/orchestrator';
import { Transaction, CustomerContext } from '@/types/agent';
import { GoogleGenAI } from '@google/genai';

// Mock the GoogleGenAI client SDK
jest.mock('@google/genai', () => {
  const mockGenerateContent = jest.fn();
  return {
    GoogleGenAI: jest.fn().mockImplementation(() => {
      return {
        models: {
          generateContent: mockGenerateContent,
        },
      };
    }),
    Type: {
      OBJECT: 'OBJECT',
      STRING: 'STRING',
      NUMBER: 'NUMBER',
      INTEGER: 'INTEGER',
      BOOLEAN: 'BOOLEAN',
      ARRAY: 'ARRAY',
    },
  };
});

describe('AgentOrchestrator Multi-Step Pipeline', () => {
  let orchestrator: AgentOrchestrator;
  let mockGenAIInstance: any;

  beforeEach(() => {
    jest.clearAllMocks();
    orchestrator = new AgentOrchestrator('test-key', 'gemini-3.6-flash');
    mockGenAIInstance = new GoogleGenAI({ apiKey: 'test-key' });
  });

  test('should execute multi-step diagnostic tool loop and return final structured decision', async () => {
    const transaction: Transaction = {
      id: 'tx_123',
      customerId: 'cust_987',
      amount: 1200,
      currency: 'USD',
      errorCode: 'INSUFFICIENT_FUNDS',
      errorMessage: 'Declined due to insufficient balance.',
      createdAt: new Date().toISOString(),
    };

    const context: CustomerContext = {
      customerSegment: 'MID_MARKET',
      tenureMonths: 18,
      openDisputesCount: 0,
    };

    const generateContentMock = orchestrator['ai'].models.generateContent as jest.Mock;

    // Hop 1: Model calls fetchCustomerHistory
    generateContentMock.mockResolvedValueOnce({
      candidates: [
        {
          content: {
            role: 'model',
            parts: [{ text: 'Checking customer history first.' }],
          },
        },
      ],
      functionCalls: [
        {
          name: 'fetchCustomerHistory',
          args: { customerId: 'cust_987' },
        },
      ],
    });

    // Hop 2: Model calls evaluatePolicyBounds
    generateContentMock.mockResolvedValueOnce({
      candidates: [
        {
          content: {
            role: 'model',
            parts: [{ text: 'Now checking policy boundaries for discount intervention.' }],
          },
        },
      ],
      functionCalls: [
        {
          name: 'evaluatePolicyBounds',
          args: {
            customerSegment: 'MID_MARKET',
            proposedIntervention: 'EMIT_DISCOUNT_INCENTIVE',
          },
        },
      ],
    });

    // Hop 3: Model has no more function calls, breaks from loop
    generateContentMock.mockResolvedValueOnce({
      candidates: [
        {
          content: {
            role: 'model',
            parts: [{ text: 'Tool results collected. Ready to finalize strategy.' }],
          },
        },
      ],
      functionCalls: [],
    });

    // Final response (structured output matching decision schema)
    const finalDecisionJson = JSON.stringify({
      diagnosis: 'CASHFLOW_DELAY',
      justification: 'Customer is reliable and segment allows standard discount incentive to resolve minor cashflow hold.',
      recommendedIntervention: 'EMIT_DISCOUNT_INCENTIVE',
      proposedDiscountPercent: 10,
      requiresHumanApproval: false,
    });

    generateContentMock.mockResolvedValueOnce({
      text: finalDecisionJson,
    });

    const result = await orchestrator.diagnoseAndPlan(transaction, context);

    // Assert final decision mapping
    expect(result.transactionId).toBe('tx_123');
    expect(result.diagnosis).toBe('CASHFLOW_DELAY');
    expect(result.recommendedIntervention).toBe('EMIT_DISCOUNT_INCENTIVE');
    expect(result.proposedDiscountPercent).toBe(10);
    expect(result.requiresHumanApproval).toBe(false);

    // Verify reasoning trace captures all phases
    expect(result.reasoningTrace.length).toBeGreaterThan(0);
    const traceTypes = result.reasoningTrace.map((t) => t.type);

    expect(traceTypes).toContain('THOUGHT');
    expect(traceTypes).toContain('TOOL_CALL');
    expect(traceTypes).toContain('TOOL_RESPONSE');
    expect(traceTypes).toContain('FINAL_DECISION');

    // Confirm execution sequence recorded correctly
    const toolCalls = result.reasoningTrace.filter((t) => t.type === 'TOOL_CALL');
    expect(toolCalls[0].content).toContain('fetchCustomerHistory');
    expect(toolCalls[1].content).toContain('evaluatePolicyBounds');

    const toolResponses = result.reasoningTrace.filter((t) => t.type === 'TOOL_RESPONSE');
    expect(toolResponses[0].metadata?.result).toEqual({
      customerId: 'cust_987',
      paymentSuccessRate: 0.88,
      outstandingInvoiceCount: 2,
      totalRevenueLifetime: 145000,
    });
    expect(toolResponses[1].metadata?.result).toEqual({
      allowed: true,
      maxAllowableDiscountPercent: 15,
      maxRetryAttempts: 2,
      requiresHumanApproval: false,
    });

    // Ensure generateContent was called 4 times in total
    expect(generateContentMock).toHaveBeenCalledTimes(4);
  });

  test('should handle immediate direct decision without tool invocations', async () => {
    const transaction: Transaction = {
      id: 'tx_999',
      customerId: 'cust_111',
      amount: 500,
      currency: 'USD',
      createdAt: new Date().toISOString(),
    };

    const context: CustomerContext = {
      customerSegment: 'SMB',
      tenureMonths: 2,
      openDisputesCount: 5,
    };

    const generateContentMock = orchestrator['ai'].models.generateContent as jest.Mock;

    // Hop 1: Returns no function calls immediately
    generateContentMock.mockResolvedValueOnce({
      candidates: [
        {
          content: {
            role: 'model',
            parts: [{ text: 'Customer has active disputes. Escalate immediately.' }],
          },
        },
      ],
      functionCalls: [],
    });

    // Final response
    const finalDecisionJson = JSON.stringify({
      diagnosis: 'DISPUTE_ESCALATION',
      justification: 'High dispute count requires direct account executive oversight.',
      recommendedIntervention: 'ESCALATE_TO_ACCOUNT_EXEC',
      proposedDiscountPercent: 0,
      requiresHumanApproval: true,
    });

    generateContentMock.mockResolvedValueOnce({
      text: finalDecisionJson,
    });

    const result = await orchestrator.diagnoseAndPlan(transaction, context);

    expect(result.transactionId).toBe('tx_999');
    expect(result.diagnosis).toBe('DISPUTE_ESCALATION');
    expect(result.recommendedIntervention).toBe('ESCALATE_TO_ACCOUNT_EXEC');
    expect(result.proposedDiscountPercent).toBe(0);
    expect(result.requiresHumanApproval).toBe(true);

    expect(generateContentMock).toHaveBeenCalledTimes(2);
  });
});
