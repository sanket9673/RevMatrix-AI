import Groq from 'groq-sdk';
import { PolicyEngine } from '../guardrails/policy_engine';
import { executeFetchCustomerHistory, executeEvaluatePolicyBounds } from './tools';

// OpenAI-style tools declaration
const GROQ_TOOLS: Groq.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'fetchCustomerHistory',
      description: 'Retrieves past payment success rates and outstanding invoice count for a customer.',
      parameters: {
        type: 'object',
        properties: {
          customerEmail: { type: 'string', description: 'The customer email address' },
          customerId: { type: 'string', description: 'The unique ID of the customer.' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'evaluatePolicyBounds',
      description: 'Queries policy rules for max allowable discount and retry count for a customer segment.',
      parameters: {
        type: 'object',
        properties: {
          segment: { type: 'string', description: 'Customer segment (SMB, MID_MARKET, ENTERPRISE)' },
          customerSegment: { type: 'string', description: 'Customer segment (SMB, MID_MARKET, ENTERPRISE)' },
        },
      },
    },
  },
];

async function callGroqWithBackoff<T>(fn: () => Promise<T>, maxRetries = 5): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      if ((error?.status === 429 || error?.message?.includes('429')) && attempt < maxRetries - 1) {
        const delayMs = Math.pow(2, attempt) * 4000 + Math.random() * 2000;
        console.warn(`[Groq HTTP 429] Rate limited. Retrying in ${(delayMs / 1000).toFixed(1)}s...`);
        await new Promise(res => setTimeout(res, delayMs));
      } else {
        throw error;
      }
    }
  }
  throw new Error('Max retries exceeded for Groq API call');
}

export class GroqAgentOrchestrator {
  private groq: Groq;
  private policyEngine = new PolicyEngine();
  private resolvedModelName: string | null = null;

  constructor(apiKey?: string) {
    this.groq = new Groq({ apiKey: apiKey || process.env.GROQ_API_KEY });
  }

  private async getModelName(): Promise<string> {
    if (this.resolvedModelName) return this.resolvedModelName;

    const preferred = 'llama-3.3-70b-versatile';
    try {
      const list = await callGroqWithBackoff(() => this.groq.models.list());
      const ids = list.data.map((m: any) => m.id);
      if (ids.includes(preferred)) {
        this.resolvedModelName = preferred;
      } else {
        // Fallback options in sandbox/evaluation environment
        const sandboxFallbacks = [
          'openai/gpt-oss-safeguard-20b',
          'groq/compound',
          'openai/gpt-oss-120b',
          'openai/gpt-oss-20b',
          'qwen/qwen3.6-27b'
        ];
        const found = sandboxFallbacks.find(id => ids.includes(id));
        this.resolvedModelName = found || preferred;
      }
    } catch (e) {
      this.resolvedModelName = preferred;
    }
    return this.resolvedModelName;
  }

  async diagnoseAndPlan(transaction: any, historyContext: any = {}) {
    const startTime = Date.now();
    const modelToUse = await this.getModelName();
    const systemPrompt = `You are RevMatrix-AI's autonomous revenue recovery agent.
Your task is to analyze failed transaction / overdue invoice events and recommend the optimal recovery strategy.
Use the available tools (fetchCustomerHistory, evaluatePolicyBounds) to gather context before finalizing your plan.
Output your final recommendation as JSON containing:
{
  "transactionId": string,
  "diagnosis": string,
  "justification": string,
  "recommendedIntervention": "INSTANT_RETRY" | "SEND_DUNNING_PAYMENT_LINK" | "EMIT_DISCOUNT_INCENTIVE" | "ESCALATE_TO_HUMAN" | "HARD_STOP_FRAUD",
  "proposedDiscountPercent": number (0-5)
}`;

    const messages: Groq.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: `Analyze this recovery scenario:\nTransaction Data: ${JSON.stringify(transaction)}\nHistory Context: ${JSON.stringify(historyContext)}`,
      },
    ];

    const reasoningSteps: any[] = [];
    let stepNumber = 1;

    // Multi-turn tool calling loop (max 3 turns)
    for (let turn = 0; turn < 3; turn++) {
      const response = await callGroqWithBackoff(() => this.groq.chat.completions.create({
        model: modelToUse,
        messages,
        tools: turn === 2 ? undefined : GROQ_TOOLS,
        tool_choice: turn === 2 ? undefined : 'auto',
        temperature: 0.1,
        response_format: turn === 2 ? { type: 'json_object' } : undefined,
      }));

      const choice = response.choices[0];
      const message = choice.message;
      messages.push(message as any);

      if (message.tool_calls && message.tool_calls.length > 0) {
        for (const toolCall of message.tool_calls) {
          const fnName = toolCall.function.name;
          const args = JSON.parse(toolCall.function.arguments || '{}');
          let toolResult: any = {};

          if (fnName === 'fetchCustomerHistory') {
            const customerId = args.customerId || args.customerEmail || transaction.customerId || transaction.customerEmail || 'cust_unknown';
            toolResult = await executeFetchCustomerHistory({ customerId });
          } else if (fnName === 'evaluatePolicyBounds') {
            let customerSegment = args.customerSegment || args.segment || historyContext.customerSegment || 'SMB';
            if (customerSegment === 'MidMarket' || customerSegment === 'MID_MARKET') {
              customerSegment = 'MID_MARKET';
            } else if (customerSegment === 'Enterprise' || customerSegment === 'ENTERPRISE') {
              customerSegment = 'ENTERPRISE';
            } else {
              customerSegment = 'SMB';
            }

            let proposedIntervention: any = 'RETRY_GATEWAY_ALTERNATIVE';
            if (transaction.errorMessage === 'suspected_fraud' || transaction.errorCode === 'BAD_REQUEST_PAYMENT_POSSIBLE_FRAUD') {
              proposedIntervention = 'ESCALATE_TO_ACCOUNT_EXEC';
            } else if (transaction.invoiceId) {
              proposedIntervention = 'OFFER_PAYMENT_PLAN';
            }

            toolResult = await executeEvaluatePolicyBounds({ customerSegment, proposedIntervention });
          }

          reasoningSteps.push({
            stepNumber: stepNumber++,
            thoughtProcess: message.content || `Calling tool ${fnName}`,
            toolCalled: fnName,
            toolInput: args,
            toolOutput: toolResult,
          });

          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify(toolResult),
          } as any);
        }
      } else {
        // Final response received
        let parsedDecision: any = {};
        try {
          parsedDecision = JSON.parse(message.content || '{}');
        } catch (e) {
          parsedDecision = {
            transactionId: transaction.id,
            diagnosis: 'SOFT_TECHNICAL_FAILURE',
            justification: message.content || 'Default recovery strategy',
            recommendedIntervention: 'SEND_DUNNING_PAYMENT_LINK',
            proposedDiscountPercent: 0,
          };
        }

        const latencyMs = Date.now() - startTime;
        return {
          decision: parsedDecision,
          reasoningSteps,
          latencyMs,
          provider: 'GROQ_LLAMA_3.3_70B',
          isFallback: false,
        };
      }
    }

    throw new Error('Groq tool loop exceeded maximum turns');
  }
}
