export interface ReasoningStep {
  id: string;
  stepNumber: number;
  timestamp: string;
  agentThought: string;
  toolCalled: string;
  toolInput: Record<string, any>;
  toolOutput: Record<string, any>;
  policyStatus: 'PASSED' | 'MODIFIED_BY_POLICY' | 'BLOCKED';
  policyReason?: string;
  proposedAction: string;
  executedAction: string;
}

export interface WorkflowTrace {
  id: string;
  title: string;
  customer: string;
  status: 'COMPLETED' | 'POLICY_INTERVENED' | 'HALTED';
  startedAt: string;
  steps: ReasoningStep[];
}

export interface AuditBlock {
  blockHeight: number;
  timestamp: string;
  workflowId: string;
  actor: 'AGENT_GEMINI' | 'POLICY_ENGINE' | 'HUMAN_OVERRIDE';
  actionExecuted: string;
  payload: Record<string, any>;
  prevHash: string;
  currentHash: string;
  verified?: boolean;
}

export const MOCK_WORKFLOW_TRACES: WorkflowTrace[] = [
  {
    id: "WF-8942-REFUND",
    title: "High-Value Refund Review",
    customer: "Stripe Enterprise (Merchant ID: M-4910)",
    status: "POLICY_INTERVENED",
    startedAt: "2026-08-22T01:15:20.000Z",
    steps: [
      {
        id: "ST-8942-1",
        stepNumber: 1,
        timestamp: "2026-08-22T01:15:22.000Z",
        agentThought: "Querying transaction history for reference payment txn_9a8f2c to verify the original purchase amount and customer payment state.",
        toolCalled: "fetch_transaction_details",
        toolInput: { transactionId: "txn_9a8f2c" },
        toolOutput: { status: "SUCCESS", amount: 500.00, currency: "USD", paymentMethod: "card_visa", completedAt: "2026-08-21T18:04:12Z" },
        policyStatus: "PASSED",
        proposedAction: "Fetch details of transaction txn_9a8f2c",
        executedAction: "Fetched details of transaction txn_9a8f2c"
      },
      {
        id: "ST-8942-2",
        stepNumber: 2,
        timestamp: "2026-08-22T01:15:25.000Z",
        agentThought: "The customer has requested a full refund of $500.00. I need to check the merchant's customer tier, refund policy, and past support history to retrieve their risk profile.",
        toolCalled: "get_customer_profile",
        toolInput: { customerId: "CUST-4910" },
        toolOutput: { tier: "Platinum", chargebackRate: 0.002, refundRatio: 0.04, riskTier: "Low" },
        policyStatus: "PASSED",
        proposedAction: "Retrieve profile for CUST-4910",
        executedAction: "Retrieved profile for CUST-4910"
      },
      {
        id: "ST-8942-3",
        stepNumber: 3,
        timestamp: "2026-08-22T01:15:28.000Z",
        agentThought: "The customer profile indicates low risk and Platinum tier. The payment was double-charged due to network latency, which is a verified technical issue. I will issue a full refund of $500.00.",
        toolCalled: "execute_refund",
        toolInput: { transactionId: "txn_9a8f2c", amount: 500.00, reason: "Verified network latency double charge" },
        toolOutput: { status: "POLICY_CAP_APPLIED", refundId: "ref_8a92f0", amountRequested: 500.00, amountApproved: 250.00, policyRule: "PR-102-MAX-REFUND" },
        policyStatus: "MODIFIED_BY_POLICY",
        policyReason: "Policy Rule #PR-102 capped refund from $500.00 to $250.00 because refunds exceeding $250.00 require human escalation or override. Capped amount applied.",
        proposedAction: "Execute full refund of $500.00",
        executedAction: "Execute capped refund of $250.00 (capped by Policy Engine)"
      }
    ]
  },
  {
    id: "WF-9011-ESC",
    title: "Platinum Customer Escalation",
    customer: "Acme Corp (Merchant ID: M-8012)",
    status: "COMPLETED",
    startedAt: "2026-08-22T02:22:00.000Z",
    steps: [
      {
        id: "ST-9011-1",
        stepNumber: 1,
        timestamp: "2026-08-22T02:22:02.000Z",
        agentThought: "Analyze open customer issues and customer support logs. The user complains of multiple failed payments and high friction in integration.",
        toolCalled: "fetch_support_history",
        toolInput: { customerId: "CUST-8012" },
        toolOutput: { openTickets: 3, lastTicketSubject: "Webhook delivery failure", integrationStatus: "DEGRADED" },
        policyStatus: "PASSED",
        proposedAction: "Get support ticket history for CUST-8012",
        executedAction: "Retrieved support ticket history for CUST-8012"
      },
      {
        id: "ST-9011-2",
        stepNumber: 2,
        timestamp: "2026-08-22T02:22:05.000Z",
        agentThought: "Calculate the sentiment score based on the ticket texts and integration errors. Sentiment analysis suggests a highly dissatisfied customer (score 0.12).",
        toolCalled: "analyze_sentiment",
        toolInput: { text: "The webhooks are failing, and we are losing sales. This is our third outreach." },
        toolOutput: { sentiment: "NEGATIVE", score: 0.12, severity: "HIGH" },
        policyStatus: "PASSED",
        proposedAction: "Run sentiment model on support ticket query",
        executedAction: "Completed sentiment analysis (Score: 0.12)"
      },
      {
        id: "ST-9011-3",
        stepNumber: 3,
        timestamp: "2026-08-22T02:22:09.000Z",
        agentThought: "A Platinum tier customer with 3 unresolved webhook issues and highly negative sentiment requires immediate escalation. I will route the account to Retention Specialist Tier-3.",
        toolCalled: "route_escalation",
        toolInput: { customerId: "CUST-8012", targetQueue: "Retention Specialist Tier-3", priority: "CRITICAL" },
        toolOutput: { status: "SUCCESS", queueId: "q_tier3_retention", assignedAgent: "Sarah Jenkins" },
        policyStatus: "PASSED",
        proposedAction: "Escalate account CUST-8012 to Retention Specialist Tier-3",
        executedAction: "Escalated account CUST-8012 to Retention Specialist Tier-3 (Assigned to Sarah Jenkins)"
      }
    ]
  },
  {
    id: "WF-9123-FRAUD",
    title: "High-Risk Transaction Shield",
    customer: "Anonymous Hub (Merchant ID: M-1193)",
    status: "HALTED",
    startedAt: "2026-08-22T03:05:40.000Z",
    steps: [
      {
        id: "ST-9123-1",
        stepNumber: 1,
        timestamp: "2026-08-22T03:05:42.000Z",
        agentThought: "A transaction request has been received from IP 198.51.100.42. Checking physical geo-location and device fingerprint validity.",
        toolCalled: "validate_network_context",
        toolInput: { ipAddress: "198.51.100.42", fingerprint: "dev-device-993" },
        toolOutput: { geoCountry: "Unknown / High Risk Proxy", isVPN: true, fingerprintAgeDays: 0.1 },
        policyStatus: "PASSED",
        proposedAction: "Verify IP and device history",
        executedAction: "Verified IP and device history (VPN detected)"
      },
      {
        id: "ST-9123-2",
        stepNumber: 2,
        timestamp: "2026-08-22T03:05:44.000Z",
        agentThought: "VPN is detected with a newly created device fingerprint from a high-risk geo proxy. Calculating overall transactional fraud risk score.",
        toolCalled: "compute_fraud_score",
        toolInput: { ip: "198.51.100.42", device: "dev-device-993", velocity24h: 14 },
        toolOutput: { fraudScore: 0.94, verdict: "HIGH_RISK" },
        policyStatus: "PASSED",
        proposedAction: "Compute fraud risk coefficient",
        executedAction: "Computed risk coefficient (Risk: 0.94)"
      },
      {
        id: "ST-9123-3",
        stepNumber: 3,
        timestamp: "2026-08-22T03:05:45.000Z",
        agentThought: "Risk score is 0.94, which exceeds the critical transaction block threshold (0.80). I must propose routing this transaction to secondary SMS multi-factor challenges.",
        toolCalled: "request_transaction_approval",
        toolInput: { customerId: "CUST-9872", amount: 99.99, action: "SMS_CHALLENGE" },
        toolOutput: { status: "BLOCKED_BY_POLICY", action: "HALT_EXECUTION", ruleViolated: "FR-901-RISK-LIMIT" },
        policyStatus: "BLOCKED",
        policyReason: "Policy Rule #FR-901 blocked this action. The risk score is 0.94 (threshold: 0.80). Transactions with risk score > 0.90 are halted immediately and blocked from any retry or challenge mechanism.",
        proposedAction: "Attempt transaction SMS challenge escalation",
        executedAction: "Transaction execution aborted and blocked by Fraud Policy Engine"
      }
    ]
  }
];

export const MOCK_AUDIT_BLOCKS: AuditBlock[] = [
  {
    blockHeight: 0,
    timestamp: "2026-08-22T00:00:00.000Z",
    workflowId: "SYSTEM-GENESIS",
    actor: "POLICY_ENGINE",
    actionExecuted: "GENESIS_BLOCK_INITIALIZED",
    payload: {
      version: "1.0.0",
      engine: "RevMatrix Policy v2.4.0",
      genesisSeed: "RevMatrix-AI-Secured-Chain"
    },
    prevHash: "0000000000000000000000000000000000000000000000000000000000000000",
    currentHash: "d8b872007715d201f1494211a58b33d4ac5be922b8455d11a9d18604432c5925"
  },
  {
    blockHeight: 1,
    timestamp: "2026-08-22T01:15:30.000Z",
    workflowId: "WF-8942-REFUND",
    actor: "AGENT_GEMINI",
    actionExecuted: "PROPOSE_HIGH_VALUE_REFUND",
    payload: {
      amount: 500,
      currency: "USD",
      reason: "Customer double charged due to network latency, escalated via high priority queue"
    },
    prevHash: "d8b872007715d201f1494211a58b33d4ac5be922b8455d11a9d18604432c5925",
    currentHash: "e6782ee5a47422fed10fde0ff0e899d05e6c9029148db5e38aa4c3a25d9a3862"
  },
  {
    blockHeight: 2,
    timestamp: "2026-08-22T01:15:32.000Z",
    workflowId: "WF-8942-REFUND",
    actor: "POLICY_ENGINE",
    actionExecuted: "ENFORCE_REFUND_LIMIT_CAP",
    payload: {
      originalAmount: 500,
      cappedAmount: 250,
      policyRule: "PR-102-MAX-REFUND",
      reason: "Refund exceeds standard agent authorization limit of $250. Capped amount applied."
    },
    prevHash: "e6782ee5a47422fed10fde0ff0e899d05e6c9029148db5e38aa4c3a25d9a3862",
    currentHash: "e3337e75f9802adcd14b23eb9e4f9cd180b57d24642d1f3974bd9c5e979a7b70"
  },
  {
    blockHeight: 3,
    timestamp: "2026-08-22T02:22:10.000Z",
    workflowId: "WF-9011-ESC",
    actor: "AGENT_GEMINI",
    actionExecuted: "ROUTE_ACCOUNT_ESCALATION",
    payload: {
      customerTier: "Platinum",
      unresolvedIssues: 3,
      sentimentScore: 0.12,
      targetQueue: "Retention Specialist Tier-3"
    },
    prevHash: "e3337e75f9802adcd14b23eb9e4f9cd180b57d24642d1f3974bd9c5e979a7b70",
    currentHash: "fa45c9dd3d3b3a24439cd67bdb6837bf61501829b17af7d7ea0ec28501cfdf0c"
  },
  {
    blockHeight: 4,
    timestamp: "2026-08-22T03:05:45.000Z",
    workflowId: "WF-9123-FRAUD",
    actor: "POLICY_ENGINE",
    actionExecuted: "BLOCK_TRANSACTION_FRAUD",
    payload: {
      customerId: "CUST-9872",
      ipAddress: "198.51.100.42",
      fingerprint: "dev-device-993",
      riskScore: 0.94,
      action: "HALT_EXECUTION"
    },
    prevHash: "fa45c9dd3d3b3a24439cd67bdb6837bf61501829b17af7d7ea0ec28501cfdf0c",
    currentHash: "83d6053525f54fdec38a0de2f6e79754dfb3ee1062a5aef5b20c44f047e49b3e"
  }
];
