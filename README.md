# RevMatrix-AI — Real-Time Payment Failure Recovery Engine & Live Benchmark Streamer

[![Next.js](https://img.shields.io/badge/Next.js-14.2.8-000000?logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Prisma](https://img.shields.io/badge/Prisma-5.22.0-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io/)
[![Google Gemini AI](https://img.shields.io/badge/Google%20Gemini-1.5%20Pro-4285F4?logo=googlegemini&logoColor=white)](https://ai.google.dev/)
[![Docker](https://img.shields.io/badge/Docker-PostgreSQL-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-3.4-38B2AC?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)

An enterprise-grade autonomous payment recovery platform and real-time streaming telemetry dashboard built with Next.js 14 App Router, Server-Sent Events (SSE), PostgreSQL (Prisma ORM), Razorpay Webhook Ingestion.

RevMatrix-AI intercepts failed e-commerce/FinTech transactions, applies policy-safe retry routing, and streams execution metrics live to an interactive pitch presentation interface.

**Live Demo URL:** [https://revmatrix-ai.netlify.app/](https://rev-matrix-ai.vercel.app/)

---

## 1. System Overview & Problem Statement

In high-volume payment processing (e-commerce, SaaS, digital services), failed transactions account for billions in lost Gross Transaction Value (GTV). Standard payment gateway retries either fail due to naive repetition or breach customer friction policies.

**RevMatrix-AI** solves payment drop-offs through an intelligent, policy-governed recovery pipeline:

1. **Autonomous Webhook Ingestion:** Ingests live Razorpay transaction failure events (`payment.failed`) with HMAC-SHA256 signature verification.
2. **AI-Driven Recovery Routing:** Leverages Google Gemini AI to analyze failure codes (e.g., PG timeouts, auth errors, network glitches) and generate real-time smart routing and retry strategies.
3. **Policy-Safe Guardrails:** Enforces strict compliance rules (maximum retry limits, user friction thresholds) to keep the Policy Breach Rate below target limits.
4. **Real-Time Live SSE Streamer:** Streams transaction telemetry item-by-item over HTTP Server-Sent Events (SSE) directly to an interactive Next.js dashboard equipped with auto-scrolling terminal logs, throughput meters, and gauge cards.
5. **Zero-Latency Static Fallback System:** Includes an instant backup switch supplying pre-rendered 50-record trace payloads to ensure zero network-dependent friction during live pitch video recordings or offline panel reviews.

---

## 2. Key Engineering Highlights

- **HTTP Server-Sent Events (SSE) Pipeline:** Real-time data delivery via standard Web `ReadableStream` (`text/event-stream`), broadcasting item-by-item JSON events (`data: JSON\n\n`) with low-overhead HTTP connection persistence.
- **Resource Leak & Connection Management:** Implements `req.signal.addEventListener('abort', ...)` and component cleanup hooks (`eventSource.close()`) to destroy dangling streams and prevent server memory leaks.
- **Dual-Engine Benchmark Architecture:** Provides an instant UI toggle switching between live server execution and pre-computed static backup data (`src/lib/fallback_data.ts`) with no layout shifts or state breakage.
- **Prisma ORM & PostgreSQL Data Layer:** Strictly typed relational schema tracking `BenchmarkRun`, `BenchmarkRecord`, `PaymentFailure`, `PolicyRule`, and `AuditLog` entities.
- **INR Currency & Metrics Formatting:** Formats recovered financial volume in Indian Rupees (`₹48,50,000`) alongside real-time throughput (`records/sec`), Recovery Rate (%), and Policy Breach Rate (%).
- **Interactive Terminal UI:** Features a dark-themed log console built with Lucide React icons, real-time log-level filtering (`INFO`, `SUCCESS`, `WARN`, `ERROR`), search queries, metadata inspection drawers, and auto-scroll controls.

---

## 3. Architecture & System Pipeline

### Request & Streaming Architecture

```mermaid
graph TD;
    classDef client fill:#1e293b,stroke:#475569,stroke-width:1px,color:#94a3b8;
    classDef security fill:#1e1b4b,stroke:#818cf8,stroke-width:2px,color:#c7d2fe;
    classDef api fill:#0f172a,stroke:#38bdf8,stroke-width:2px,color:#38bdf8;
    classDef service fill:#064e3b,stroke:#10b981,stroke-width:2px,color:#a7f3d0;
    classDef storage fill:#581c87,stroke:#a855f7,stroke-width:2px,color:#f3e8ff;
    classDef external fill:#451a03,stroke:#f97316,stroke-width:2px,color:#ffedd5;

    Client["Next.js React Client<br>(/benchmark UI)"]:::client
    SSEHandler["SSE Route Handler<br>(/api/benchmark/stream)"]:::api
    FallbackEngine["Static Fallback Engine<br>(fallback_data.ts)"]:::service

    subgraph CoreEngine ["RevMatrix Recovery Core"]
        RazorpayIngest["Razorpay Webhook Handler<br>(HMAC Signature Validator)"]:::security
        GeminiEngine["Google Gemini AI<br>(Failure Reason Analysis)"]:::service
        PolicyChecker["Policy Safety Rules<br>(Breach Guardrails)"]:::service
    end

    subgraph PersistenceLayer ["Persistence Layer"]
        PostgresDB[("PostgreSQL Database<br>(Prisma ORM)")]:::storage
        SyntheticData[("synthetic_50_failures.json<br>(Dataset Engine)")]:::external
    end

    %% Execution Flow
    Client -- "1. EventSource / SSE Connect" --> SSEHandler
    Client -. "Fallback Mode Toggle" .-> FallbackEngine
    RazorpayIngest --> PolicyChecker
    PolicyChecker --> GeminiEngine
    GeminiEngine --> PostgresDB
    SSEHandler --> SyntheticData
    SSEHandler -- "2. Stream Chunk (data: JSON)" --> Client
    PostgresDB --> SSEHandler
```

### Database Entity-Relationship Diagram (ERD)

```mermaid
erDiagram
    BENCHMARK_RUN ||--|{ BENCHMARK_RECORD : contains
    PAYMENT_FAILURE ||--o| BENCHMARK_RECORD : resolves
    POLICY_RULE ||--o{ AUDIT_LOG : enforces

    BENCHMARK_RUN {
        string id PK
        int totalRecords
        float recoveryRatePct
        float netRecoveredGTV
        float policyBreachRatePct
        datetime createdAt
    }
    BENCHMARK_RECORD {
        string id PK
        string runId FK
        string transactionId
        float amountGTV
        string status "SUCCESS | FAILED | RECOVERED | POLICY_BREACH"
        int latencyMs
        string failureReason
        datetime timestamp
    }
    PAYMENT_FAILURE {
        string id PK
        string razorpayPaymentId
        float amount
        string currency
        string errorCode
        string errorDescription
        string status
        datetime createdAt
    }
    POLICY_RULE {
        string id PK
        string ruleName
        int maxRetriesAllowed
        float maxBreachThresholdPct
        boolean isActive
    }
    AUDIT_LOG {
        string id PK
        string level "INFO | WARN | ERROR | SUCCESS"
        string message
        string metadataJson
        datetime createdAt
    }
```

---

## 4. Repository Structure

```text
revmatrix-ai/
├── .github/
│   └── workflows/
│       └── ci.yml             # Automated build & type-check pipeline
├── prisma/
│   ├── schema.prisma          # PostgreSQL relational database schema
│   └── seed.ts                # Database seeding script
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── benchmark/
│   │   │   │   └── stream/
│   │   │   │       └── route.ts  # SSE stream handler (ReadableStream event-stream)
│   │   │   └── webhooks/
│   │   │       └── razorpay/
│   │   │           └── route.ts  # Webhook ingestion with HMAC verification
│   │   ├── benchmark/
│   │   │   └── page.tsx       # Live Benchmark Streamer route page
│   │   ├── favicon.ico
│   │   ├── globals.css        # Tailwind CSS global styles & dark terminal theme
│   │   ├── layout.tsx         # App root layout with Navigation Sidebar
│   │   └── page.tsx           # Main application dashboard
│   ├── components/
│   │   ├── live-benchmark-stream.tsx # Interactive streamer dashboard component
│   │   ├── navigation/
│   │   │   └── sidebar.tsx    # Application sidebar navigation
│   │   └── ui/                # Reusable UI elements (cards, badges, buttons)
│   └── lib/
│       ├── db.ts              # Prisma database client singleton
│       ├── fallback_data.ts   # Pre-rendered 50-record fallback backup payload
│       ├── gemini.ts          # Google Gemini AI API wrapper
│       └── utils.ts           # INR currency & string utility formatters
├── public/                    # Static assets and icons
├── synthetic_50_failures.json # 50-record benchmark dataset file
├── .env                       # Local environment variable configuration
├── .gitignore                 # Standard Git exclusion file
├── docker-compose.yml         # PostgreSQL Docker setup
├── next.config.mjs            # Next.js configuration
├── package.json               # Project dependencies & execution scripts
├── README.md                  # System documentation
└── tsconfig.json              # TypeScript compiler configuration
```

---

## 5. API Reference & Contract Specification

### Summary of Endpoints

| Method | Endpoint | Description | Auth / Format |
| --- | --- | --- | --- |
| **GET** | `/api/benchmark/stream` | Stream 50 benchmark records item-by-item | `text/event-stream` |
| **POST** | `/api/webhooks/razorpay` | Ingest live Razorpay failure webhooks | `X-Razorpay-Signature` |
| **GET** | `/benchmark` | Interactive Benchmark Telemetry Dashboard | HTML / React Client |

### Endpoint Details

#### 1. GET `/api/benchmark/stream`

Streams 50 benchmark execution events sequentially over an HTTP persistent connection.

- **Request Headers:**
  ```text
  Accept: text/event-stream
  Cache-Control: no-cache
  ```

- **SSE Stream Events Payload Example (`data: JSON\n\n`):**

  - **Event 1: Start Event**
    ```json
    {
      "event": "START",
      "total": 50
    }
    ```

  - **Event 2: Record Processed Event**
    ```json
    {
      "event": "RECORD_PROCESSED",
      "current": 1,
      "total": 50,
      "record": {
        "id": "rec_001",
        "transactionId": "txn_88219401",
        "amountGTV": 125000,
        "status": "RECOVERED",
        "latencyMs": 42,
        "failureReason": "GATEWAY_TIMEOUT",
        "timestamp": "2026-08-21T23:00:00.000Z"
      },
      "runningSummary": {
        "totalRecords": 50,
        "processedRecords": 1,
        "recoveryRatePct": 100.0,
        "netRecoveredGTV": 125000,
        "policyBreachRatePct": 0.0,
        "avgLatencyMs": 42.0,
        "throughputRps": 12.5
      }
    }
    ```

  - **Event 3: Complete Event**
    ```json
    {
      "event": "COMPLETE",
      "finalSummary": {
        "totalRecords": 50,
        "processedRecords": 50,
        "recoveryRatePct": 88.0,
        "netRecoveredGTV": 4850000,
        "policyBreachRatePct": 2.0,
        "avgLatencyMs": 38.4,
        "throughputRps": 15.2
      }
    }
    ```

#### 2. POST `/api/webhooks/razorpay`

Ingests transaction failure notifications directly from Razorpay.

- **Headers:**
  ```text
  Content-Type: application/json
  X-Razorpay-Signature: <HMAC-SHA256-Signature>
  ```

- **Request Body:**
  ```json
  {
    "entity": "event",
    "account_id": "acc_00000000000001",
    "event": "payment.failed",
    "payload": {
      "payment": {
        "entity": {
          "id": "pay_K1xX98231aXYZ",
          "amount": 500000,
          "currency": "INR",
          "status": "failed",
          "error_code": "BAD_REQUEST_ERROR",
          "error_description": "Payment authorization timed out at issuer bank"
        }
      }
    }
  }
  ```

- **Response 200 OK:**
  ```json
  {
    "status": "accepted",
    "message": "Payment failure event ingested and recovery route triggered",
    "paymentId": "pay_K1xX98231aXYZ"
  }
  ```

---

## 6. Local Setup, Execution & Testing

### 1. Environment Initialization

Clone the repository and install dependencies:

```bash
# 1. Clone repository
git clone https://github.com/sanket9673/revmatrix-ai.git
cd revmatrix-ai

# 2. Install Node.js dependencies
npm install

# 3. Configure environment variables
cp .env.example .env
```

### 2. Start PostgreSQL Database (Docker)

Launch the local PostgreSQL container on port 5432:

```bash
docker run --name revmatrix-postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=revmatrix_ai \
  -p 5432:5432 -d postgres:15
```

### 3. Sync Database & Push Prisma Schema

Push the relational database schema and generate the Prisma Client:

```bash
npx prisma db push
```

### 4. Start Next.js Web Application

Launch the development server:

```bash
npm run dev
```

Available routes:
- Live Benchmark Dashboard: http://localhost:3000/benchmark
- SSE Benchmark Stream API: http://localhost:3000/api/benchmark/stream
- Razorpay Webhook Endpoint: http://localhost:3000/api/webhooks/razorpay

### 5. Execute CLI Benchmark Runner

To execute the 50-record benchmark runner directly from your command line:

```bash
# Runs in LIVE mode (requires GROQ_API_KEY in your .env file)
npm run run:benchmark

# Runs in OFFLINE MOCKED mode (safe for verifying pipeline mechanics without API keys or quota consumption)
npm run run:benchmark -- --mock
```

*Note: If no `GROQ_API_KEY` is present in the environment variables, the script will automatically fallback to the offline mocked mode, ensuring zero setup friction.*

---

## 6. Multi-Provider Resilient AI Architecture

To ensure high availability, low latency, and operational resilience, RevMatrix-AI utilizes a **Multi-Provider Agent Architecture** consisting of a primary high-performance provider and a secondary fallback provider:

1. **Primary LLM Target: `llama-3.3-70b-versatile` (with automatic sandbox routing to `openai/gpt-oss-safeguard-20b` depending on Groq API quota allocation)**
   - **Characteristics:** Groq benchmark path utilizes Pre-Context Bundling (single-turn execution with pre-fetched customer & policy context) for rate-limit efficiency, while multi-hop tool calling is implemented in the Gemini engine.
   - **Pre-Context Bundling:** To bypass latency and rate limits of round-trip tool execution, transaction context, CRM history, and policy bounds are programmatically pre-fetched and bundled into the prompt context.
   - **Role:** Handles all transaction diagnosis and recovery routing requests initially.
   - **Sandbox Routing & Fallbacks:** If the primary `llama-3.3-70b-versatile` model is not present in the hosting environment (e.g. sandbox routers), `GroqAgentOrchestrator` automatically queries list models and routes to an available sandbox-compatible model (such as `openai/gpt-oss-safeguard-20b`), ensuring seamless local evaluation.
   - **Constraints:** Equipped with an automated exponential backoff mechanism in `GroqAgentOrchestrator` to transparently handle transient HTTP 429 rate limit errors.

2. **Secondary Fallback LLM: Google AI Studio gemini-2.5-flash** (used in production API routes)
   - **Characteristics:** Comprehensive multi-hop function calling, complex thought/reasoning trace preservation.
   - **Role:** Acts as the default engine for webhook integrations and cron-based background recovery workflows.
   - **Thought Preservation:** Implements full candidate content passing in the conversation history without stripping out functionCall metadata or inner thought signatures.

---

## 7. Live Groq AI Benchmark Results

The following metrics represent actual live Groq execution metrics across all 50 synthetic failures, calculated with `IsFallback: FALSE` for all records using the verified live results:

| Metric | Value | Description |
| :--- | :--- | :--- |
| **Total Scenarios Evaluated** | 50 | Total number of synthetic transaction/invoice failure cases. |
| **Dual-Loop Conversion Rate ($\text{CR}_{\text{dual}}$)** | 80.56% | Rate of successful automated recovery over total recoverable cases. |
| **Net Recovered Yield ($\text{NRY}$)** | 71.60% | ₹55,25,192.71 / ₹77,17,113.04 @ 83.0 USD/INR. |
| **Policy Compliance Rate ($\text{PCR}$)** | 100.00% | Percentage of actions completely free from un-intercepted policy breaches (0 breaches). |
| **Average Execution Latency** | 3656.58 ms | Average processing and decision latency of the Groq agent (including pre-context fetching). |
| **Binary Recovery Precision** | 77.78% | Precision of predicting whether a transaction failure is recoverable. |
| **Binary Recovery Recall** | 97.22% | Recall of predicting whether a transaction failure is recoverable. |
| **Binary Recovery F1 Score** | 86.42% | Harmonic mean of recovery precision and recall. |
| **Action Prediction Accuracy** | 70.00% | Accuracy of the recommended action matching the ground truth optimal action. |

### Financial Recovery Totals (Normalized @ 83.0 USD/INR):
- **Total Recoverable:** ₹77,17,113.04
- **Total Recovered:** ₹57,60,377.44
- **Total Discounts Offered:** ₹2,35,184.73
- **Net Recovered Yield:** ₹55,25,192.71

*Strategy evaluation using live Groq LLM inference over deterministic context fixtures.*

*Note on Offline Mock Mode: The `--mock` CLI flag runs a 100% offline, deterministic rule-based simulation of the pipeline for offline testing without API keys. For live AI judgment metrics evaluated against Groq LLM, refer to `BENCHMARK_RESULTS.json`.*

*Note on Action Accuracy (70.00%): While the LLM achieves 97.22% recall in identifying recoverable cases, its specific strategy recommendation (e.g. dynamic payment link vs instant retry) varies slightly on borderline cashflow delays, demonstrating real non-deterministic strategy selection.*

---

## 8. Environment Variable Reference

Ensure your `.env` file contains the following configurations:

```env
# Database Connection (PostgreSQL)
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/revmatrix_ai?schema=public"

# Razorpay API Credentials
RAZORPAY_KEY_ID="rzp_test_your_key_id_here"
RAZORPAY_KEY_SECRET="your_razorpay_key_secret_here"
RAZORPAY_WEBHOOK_SECRET="your_webhook_secret_here"

# Google Gemini AI Credentials
GEMINI_API_KEY="AIzaSy_your_gemini_api_key_here"

# Groq API Credentials
GROQ_API_KEY="gsk_your_groq_api_key_here"

# Next.js Application URL
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

---

## 9. Author & Submission Contact

- **Author:** Sanket Kisan Chavhan
- **Project:** RevMatrix-AI
- **GitHub Repository:** [https://github.com/sanket9673/revmatrix-ai](https://github.com/sanket9673/revmatrix-ai)
- **Email Contact:** [sanketch9673@gmail.com](mailto:sanketch9673@gmail.com)

---

## 10. Production CI/CD Pipeline & Deployment

The application features a production-ready automated CI/CD pipeline configured at `.github/workflows/ci-cd.yml` with 4 key parallel/sequential jobs:

1. **`security-scan`**: Scans the codebase for hardcoded credentials/secrets using Gitleaks and audits package vulnerabilities using `npm audit --audit-level=high`.
2. **`typecheck-and-lint`**: Verifies type safety and code quality by running `npx tsc --noEmit` and `npm run lint`.
3. **`run-tests-and-benchmark`**: Executes Jest unit tests (`npm run test`), Vitest benchmark tests (`npm run test:benchmark`), and validates benchmark engine calculation performance by running `npm run run:benchmark`.
4. **`build-verification`**: Verifies successful Next.js compilation via `npm run build` using mock environment variables.

### Scheduled Cron Tasks (Netlify)
Relies on Netlify Scheduled Functions (or external cron triggers) executing `/api/cron/process-due-recoveries` to process overdue accounts and failed transactions in the recovery queue.

---

## 11. Technical Disclosures & Honest Framing

To support the Hackathon Evaluation panel, we provide the following honest technical disclosures regarding simulation parameters and live demo pipelines:

- **Benchmark Execution & Deterministic Fixtures:** Executing `npm run run:benchmark` triggers live scoring calculations over a randomized synthetic transaction failure dataset (located in `data/`). However, to guarantee reproducible automated testing and avoid rate limits, Agent tools (`tools.ts`) currently utilize deterministic context fixtures across all environment runs to guarantee reproducible testing; live database-backed CRM integration is architected for production expansion.
- **Telemetry Replay Mode on Live Pitches:** To prevent exposing live API keys or triggering excessive live provider endpoints during pitches, the `/benchmark` UI tab operates in replay stream mode. It replays real-world execution logs and run traces with artificial pacing (60ms–120ms delays) to simulate live webhook traffic safely.
- **Monetary Aggregation & Currency Normalization:** The synthetic dataset contains mixed transactions in both USD ($) and INR (₹). Summing raw values across different currencies produces inaccurate metrics. The benchmark pipeline normalizes all monetary aggregates to Indian Rupees (₹) using a fixed exchange rate constant of **1 USD = ₹83.0**. All financial totals displayed in `BENCHMARK_RESULTS.json` and CLI run summaries are represented in normalized INR (`₹`).

---

### 🧑⚖️ Judge Verification & Offline Testing Guide

To test the evaluation pipeline without burning API quotas or requiring an external key:
```bash
# Run full benchmark offline using deterministic rule mock engine
npm run run:benchmark -- --mock

# Run unit and benchmark test suites
npm run test           # Passes 38/38 Jest tests
npm run test:benchmark # Passes 11/11 Vitest tests
```
For the verified live Groq AI evaluation results, refer directly to `BENCHMARK_RESULTS.json`.
