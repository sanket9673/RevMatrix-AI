import { POST } from '@/app/api/webhooks/razorpay/route';
import { prisma } from '@/lib/prisma';
import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { LoopType, WorkflowStatus } from '@prisma/client';

// Mock env variables for the webhook secret
jest.mock('@/lib/config', () => ({
  env: {
    RAZORPAY_KEY_ID: 'mock_key_id',
    RAZORPAY_KEY_SECRET: 'mock_key_secret',
    RAZORPAY_WEBHOOK_SECRET: 'webhook_secret_key',
  },
}));

describe('Razorpay Webhook API Route', () => {
  const secret = 'webhook_secret_key';

  beforeEach(async () => {
    // Clean up
    await prisma.reasoningTrace.deleteMany();
    await prisma.auditLog.deleteMany();
    await prisma.recoveryWorkflow.deleteMany();
    await prisma.transaction.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  function createMockRequest(payload: any, signatureOverride?: string): NextRequest {
    const rawBody = JSON.stringify(payload);
    const signature = signatureOverride !== undefined 
      ? signatureOverride 
      : crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

    return new NextRequest('http://localhost:3000/api/webhooks/razorpay', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-razorpay-signature': signature,
      },
      body: rawBody,
    });
  }

  test('should return 401 Unauthorized for invalid signature', async () => {
    const payload = { event: 'payment.failed' };
    const req = createMockRequest(payload, 'invalid-signature-value');

    const res = await POST(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toContain('Unauthorized signature mismatch');
  });

  test('should return 200 OK and ignore unsupported webhook events', async () => {
    const payload = {
      event: 'order.paid',
      event_id: 'evt_unsupported',
      payload: {
        payment: { entity: { id: 'pay_xyz', amount: 1000 } }
      }
    };
    const req = createMockRequest(payload);

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ignored).toBe(true);
  });

  test('should successfully ingest payment.failed webhook and spawn workflow', async () => {
    const payload = {
      event: 'payment.failed',
      event_id: 'evt_failed_123',
      payload: {
        payment: {
          entity: {
            id: 'pay_fail_999',
            amount: 50000, // Rs. 500
            currency: 'INR',
            email: 'failed_customer@example.com',
            error_code: 'INSUFFICIENT_BALANCE',
          }
        }
      }
    };

    const req = createMockRequest(payload);
    const res = await POST(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.received).toBe(true);
    expect(data.workflowId).toBeDefined();

    // Verify record in Transaction
    const tx = await prisma.transaction.findUnique({
      where: { razorpayId: 'pay_fail_999' },
      include: { workflows: true },
    });
    expect(tx).toBeDefined();
    expect(tx?.loopType).toBe(LoopType.TRANSACT_FAILURE);
    expect(tx?.amount).toBe(500); // 50000 / 100
    expect(tx?.customerEmail).toBe('failed_customer@example.com');
    expect(tx?.failureCode).toBe('INSUFFICIENT_BALANCE');
    expect(tx?.workflows).toHaveLength(1);
    expect(tx?.workflows[0].status).toBe(WorkflowStatus.PENDING);
    expect(tx?.workflows[0].id).toBe(data.workflowId);
  });

  test('should skip record creation and return 200 early on duplicate event payloads', async () => {
    const payload = {
      event: 'invoice.overdue',
      event_id: 'evt_overdue_456',
      payload: {
        invoice: {
          entity: {
            id: 'inv_overdue_1',
            amount: 150000, // Rs. 1500
            currency: 'INR',
            customer_details: {
              email: 'invoice_cust@example.com',
            },
            due_date: Math.floor(Date.now() / 1000) + 86400,
          }
        }
      }
    };

    // 1. First trigger
    const req1 = createMockRequest(payload);
    const res1 = await POST(req1);
    expect(res1.status).toBe(200);
    const data1 = await res1.json();
    expect(data1.duplicate).toBeUndefined();

    // 2. Second trigger with identical event ID
    const req2 = createMockRequest(payload);
    const res2 = await POST(req2);
    expect(res2.status).toBe(200);
    const data2 = await res2.json();
    expect(data2.duplicate).toBe(true);
    expect(data2.workflowId).toBe(data1.workflowId);

    // Verify only 1 Transaction was created
    const count = await prisma.transaction.count({
      where: { razorpayId: 'inv_overdue_1' }
    });
    expect(count).toBe(1);
  });
});
