import { GoogleGenAI, Type, Schema } from '@google/genai';
import {
  Transaction,
  CustomerContext,
  AgentDecisionResult,
  ReasoningStep,
  FetchCustomerHistoryInput,
  EvaluatePolicyBoundsInput,
} from '../../types/agent';
import { SYSTEM_INSTRUCTIONS, buildInitialUserPrompt } from './prompts';
import {
  agentTools,
  executeFetchCustomerHistory,
  executeEvaluatePolicyBounds,
} from './tools';

const decisionSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    diagnosis: {
      type: Type.STRING,
      description: 'Primary diagnosis category for transaction failure.',
    },
    justification: {
      type: Type.STRING,
      description: 'Detailed explanation of why this diagnosis and strategy were chosen.',
    },
    recommendedIntervention: {
      type: Type.STRING,
      description: 'Recommended recovery intervention action.',
    },
    proposedDiscountPercent: {
      type: Type.NUMBER,
      description: 'Proposed discount percentage (0 if none).',
    },
    requiresHumanApproval: {
      type: Type.BOOLEAN,
      description: 'Flag indicating whether human review is required before execution.',
    },
  },
  required: [
    'diagnosis',
    'justification',
    'recommendedIntervention',
    'proposedDiscountPercent',
    'requiresHumanApproval',
  ],
};

export class AgentOrchestrator {
  private ai: GoogleGenAI;
  private modelName: string;

  constructor(apiKey?: string, modelName = 'gemini-2.5-flash') {
    this.ai = new GoogleGenAI({ apiKey: apiKey || process.env.GEMINI_API_KEY });
    this.modelName = modelName;
  }

  public async diagnoseAndPlan(
    transaction: Transaction,
    context: CustomerContext
  ): Promise<AgentDecisionResult> {
    const trace: ReasoningStep[] = [];
    let stepCounter = 1;

    const recordStep = (
      type: ReasoningStep['type'],
      content: string,
      metadata?: Record<string, unknown>
    ) => {
      trace.push({
        stepNumber: stepCounter++,
        timestamp: new Date().toISOString(),
        type,
        content,
        metadata,
      });
    };

    recordStep('THOUGHT', 'Initiating multi-step diagnostic reasoning loop for transaction recovery.');

    const contents: any[] = [
      {
        role: 'user',
        parts: [{ text: buildInitialUserPrompt(transaction as any, context as any) }],
      },
    ];

    const maxToolHops = 3;
    let hopCount = 0;

    while (hopCount < maxToolHops) {
      hopCount++;

      const response = await this.ai.models.generateContent({
        model: this.modelName,
        contents,
        config: {
          systemInstruction: SYSTEM_INSTRUCTIONS,
          tools: agentTools,
        },
      });

      const candidate = response.candidates?.[0];
      if (!candidate) throw new Error('No candidate returned from Gemini model.');

      const modelPart = candidate.content?.parts?.[0];
      contents.push(candidate.content);

      // Check for Thought text output
      if (modelPart?.text) {
        recordStep('THOUGHT', modelPart.text);
      }

      // Check if model emitted Function Calls
      const functionCalls = response.functionCalls;
      if (functionCalls && functionCalls.length > 0) {
        for (const call of functionCalls) {
          recordStep('TOOL_CALL', `Executing tool: ${call.name}`, {
            args: call.args,
          });

          let toolResult: any;
          if (call.name === 'fetchCustomerHistory') {
            toolResult = await executeFetchCustomerHistory(call.args as unknown as FetchCustomerHistoryInput);
          } else if (call.name === 'evaluatePolicyBounds') {
            toolResult = await executeEvaluatePolicyBounds(call.args as unknown as EvaluatePolicyBoundsInput);
          } else {
            toolResult = { error: `Unknown tool name: ${call.name}` };
          }

          recordStep('TOOL_RESPONSE', `Tool ${call.name} execution completed.`, {
            result: toolResult,
          });

          // Append tool response into conversation context
          contents.push({
            role: 'user',
            parts: [
              {
                functionResponse: {
                  name: call.name,
                  response: toolResult,
                },
              },
            ],
          });
        }
      } else {
        // No function calls emitted, ready to generate final structured outcome
        break;
      }
    }

    // Request structured output for final decision step
    recordStep('THOUGHT', 'Synthesizing final structured decision based on tool outputs.');

    const finalResponse = await this.ai.models.generateContent({
      model: this.modelName,
      contents,
      config: {
        systemInstruction: SYSTEM_INSTRUCTIONS,
        responseMimeType: 'application/json',
        responseSchema: decisionSchema,
      },
    });

    const finalResultText = finalResponse.text || '{}';
    const parsedDecision = JSON.parse(finalResultText);

    recordStep('FINAL_DECISION', 'Formulated structured intervention proposal.', parsedDecision);

    return {
      transactionId: transaction.id,
      diagnosis: parsedDecision.diagnosis,
      justification: parsedDecision.justification,
      recommendedIntervention: parsedDecision.recommendedIntervention,
      proposedDiscountPercent: parsedDecision.proposedDiscountPercent ?? 0,
      requiresHumanApproval: parsedDecision.requiresHumanApproval ?? false,
      reasoningTrace: trace,
    };
  }
}
