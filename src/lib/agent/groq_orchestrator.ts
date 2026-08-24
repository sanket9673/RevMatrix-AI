import Groq from 'groq-sdk';
import { PolicyEngine } from '../guardrails/policy_engine';
import { executeFetchCustomerHistory, executeEvaluatePolicyBounds } from './tools';

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
  private resolvedFallbackModel: string | null = null;

  constructor(apiKey?: string) {
    this.groq = new Groq({ apiKey: apiKey || process.env.GROQ_API_KEY });
    // Model Note - Primary LLM Target: llama-3.3-70b-versatile (with automatic sandbox routing to openai/gpt-oss-safeguard-20b depending on Groq API quota allocation).
    console.log("Primary LLM Target: llama-3.3-70b-versatile (with automatic sandbox routing to openai/gpt-oss-safeguard-20b depending on Groq API quota allocation).");
  }

  private async getModels(): Promise<{ selected: string; fallback: string }> {
    if (this.resolvedModelName && this.resolvedFallbackModel) {
      return { selected: this.resolvedModelName, fallback: this.resolvedFallbackModel };
    }

    // Flagship production model configurations
    const preferred = 'llama-3.3-70b-versatile';
    const fallback = 'llama-3.1-8b-instant';

    try {
      // Fetch available models from the Groq API provider
      const list = await callGroqWithBackoff(() => this.groq.models.list());
      const ids = list.data.map((m: any) => m.id);
      if (ids.includes(preferred)) {
        this.resolvedModelName = preferred;
        this.resolvedFallbackModel = fallback;
      } else {
        // Safe sandbox fallback routing: If flagship models are restricted or absent,
        // we automatically search for available sandbox-compatible alternative models
        const sandboxFallbacks = [
          'openai/gpt-oss-safeguard-20b',
          'groq/compound',
          'openai/gpt-oss-120b',
          'openai/gpt-oss-20b',
          'qwen/qwen3.6-27b'
        ];
        const found = sandboxFallbacks.find(id => ids.includes(id));
        this.resolvedModelName = found || preferred;
        this.resolvedFallbackModel = found || fallback;
      }
    } catch (e) {
      this.resolvedModelName = preferred;
      this.resolvedFallbackModel = fallback;
    }

    return { selected: this.resolvedModelName, fallback: this.resolvedFallbackModel };
  }

  async diagnoseAndPlan(transaction: any, historyContext: any = {}) {
    const startTime = Date.now();

    // 1. PRODUCTION PRE-CONTEXT BUNDLING (Pre-fetch tool context to eliminate round-trip API calls)
    const customerHistory = historyContext.customerHistory || 
      await executeFetchCustomerHistory({ customerId: transaction.customerId || transaction.customerEmail || 'customer@example.com' });

    let customerSegment = transaction.segment || historyContext.customerSegment || 'SMB';
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

    const policyBounds = historyContext.policyBounds || 
      await executeEvaluatePolicyBounds({ customerSegment, proposedIntervention });

    const systemPrompt = `You are RevMatrix-AI's autonomous revenue recovery engine.
Diagnose transaction failures / overdue invoices and recommend the optimal recovery strategy.

PRE-LOADED CONTEXT:
- Customer History: ${JSON.stringify(customerHistory)}
- Segment Policy Bounds: ${JSON.stringify(policyBounds)}

Output your recommendation strictly as JSON matching this schema:
{
  "transactionId": "${transaction.id}",
  "diagnosis": "TECHNICAL_TIMEOUT" | "INSUFFICIENT_FUNDS" | "EXPIRED_CARD" | "CASHFLOW_DELAY" | "BILLING_DISPUTE" | "SUSPECTED_FRAUD",
  "justification": "Concise 1-sentence reasoning",
  "recommendedIntervention": "INSTANT_RETRY" | "SEND_DUNNING_PAYMENT_LINK" | "EMIT_DISCOUNT_INCENTIVE" | "ESCALATE_TO_HUMAN" | "HARD_STOP_FRAUD",
  "proposedDiscountPercent": number (0-5)
}`;

    const messages: Groq.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: `Analyze payment event:\n${JSON.stringify(transaction)}`,
      },
    ];

    const { selected, fallback } = await this.getModels();
    let selectedModel = selected;
    let response;

    // 2. SINGLE-TURN API CALL WITH MODEL FALLBACK
    try {
      response = await callGroqWithBackoff(() => this.groq.chat.completions.create({
        model: selectedModel,
        messages,
        temperature: 0.1,
        response_format: { type: 'json_object' },
      }));
    } catch (err: any) {
      console.warn(`[Groq] Model call issue with ${selectedModel} (${err?.status || err?.message}). Falling back to ${fallback}...`);
      selectedModel = fallback;
      response = await callGroqWithBackoff(() => this.groq.chat.completions.create({
        model: selectedModel,
        messages,
        temperature: 0.1,
        response_format: { type: 'json_object' },
      }));
    }

    const content = response.choices[0]?.message?.content || '{}';
    let decision: any;
    try {
      decision = JSON.parse(content);
    } catch (e) {
      decision = {
        transactionId: transaction.id,
        diagnosis: 'TECHNICAL_TIMEOUT',
        justification: 'Automated recovery fallback due to parse exception',
        recommendedIntervention: 'SEND_DUNNING_PAYMENT_LINK',
        proposedDiscountPercent: 0,
      };
    }

    const latencyMs = Date.now() - startTime;
    const reasoningSteps = [
      {
        stepNumber: 1,
        thoughtProcess: 'Pre-bundled customer history and policy bounds into prompt context.',
        toolCalled: 'fetchCustomerHistory + evaluatePolicyBounds',
        toolInput: { customerEmail: transaction.customerEmail || transaction.customerId, segment: customerSegment },
        toolOutput: { customerHistory, policyBounds },
      },
      {
        stepNumber: 2,
        thoughtProcess: decision.justification,
        toolCalled: null,
        toolInput: null,
        toolOutput: decision,
      },
    ];

    return {
      decision,
      reasoningSteps,
      latencyMs,
      provider: `GROQ_${selectedModel.toUpperCase().replace(/-/g, '_')}`,
      isFallback: false,
    };
  }
}
