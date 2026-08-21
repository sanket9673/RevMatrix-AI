import { RazorpayClientWrapper } from '@/lib/integrations/razorpay_client';
import crypto from 'crypto';

// Mock env configuration for testing
jest.mock('@/lib/config', () => ({
  env: {
    RAZORPAY_KEY_ID: 'mock_key_id',
    RAZORPAY_KEY_SECRET: 'mock_key_secret',
    RAZORPAY_WEBHOOK_SECRET: 'mock_webhook_secret',
  },
}));

describe('RazorpayClientWrapper', () => {
  let wrapper: RazorpayClientWrapper;

  beforeEach(() => {
    wrapper = new RazorpayClientWrapper();
  });

  describe('Webhook Signature Verification', () => {
    const secret = 'super_secret_webhook_key';
    const payload = JSON.stringify({
      entity: 'event',
      account_id: 'acc_123',
      event: 'payment_link.paid',
    });

    const validSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    test('should return true for a valid signature and payload', () => {
      const isValid = wrapper.verifyWebhookSignature(payload, validSignature, secret);
      expect(isValid).toBe(true);
    });

    test('should return false for tampered payload', () => {
      const tamperedPayload = payload + ' ';
      const isValid = wrapper.verifyWebhookSignature(tamperedPayload, validSignature, secret);
      expect(isValid).toBe(false);
    });

    test('should return false for invalid signature', () => {
      const invalidSignature = 'a'.repeat(64);
      const isValid = wrapper.verifyWebhookSignature(payload, invalidSignature, secret);
      expect(isValid).toBe(false);
    });

    test('should return false if signature length does not match expected length', () => {
      const shortSignature = 'short_sig';
      const isValid = wrapper.verifyWebhookSignature(payload, shortSignature, secret);
      expect(isValid).toBe(false);
    });

    test('should return false and handle missing or empty inputs gracefully without throwing', () => {
      expect(wrapper.verifyWebhookSignature('', validSignature, secret)).toBe(false);
      expect(wrapper.verifyWebhookSignature(payload, '', secret)).toBe(false);
      
      // When secret is not passed, it should fall back to env.RAZORPAY_WEBHOOK_SECRET
      const envSignature = crypto
        .createHmac('sha256', 'mock_webhook_secret')
        .update(payload)
        .digest('hex');
      expect(wrapper.verifyWebhookSignature(payload, envSignature)).toBe(true);

      // Verify that passing empty string for secret returns false
      expect(wrapper.verifyWebhookSignature(payload, envSignature, '')).toBe(false);
    });
  });

  describe('Rate Limit Handling & Retry Backoff (HTTP 429)', () => {
    let rq: any;
    let mockAdapter: jest.Mock;

    beforeEach(() => {
      jest.useFakeTimers();
      rq = (wrapper.client as any).api.rq;
      mockAdapter = jest.fn();
      rq.defaults.adapter = mockAdapter;
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('should retry on HTTP 429 on attempts 1 and 2, and succeed on attempt 3', async () => {
      const err429 = new Error('Too many requests');
      (err429 as any).response = {
        status: 429,
        data: {
          error: {
            code: 'TOO_MANY_REQUESTS',
            description: 'Rate limit exceeded',
          },
        },
      };

      const successResponse = {
        data: { id: 'plink_123', status: 'created', short_url: 'https://rzp.io/i/xyz' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      };

      mockAdapter
        .mockImplementationOnce(() => Promise.reject(err429))
        .mockImplementationOnce(() => Promise.reject(err429))
        .mockImplementationOnce(() => Promise.resolve(successResponse));

      const input = {
        amount: 10000,
        currency: 'INR',
        description: 'Test integration payment link',
        customer: {
          name: 'Jane Doe',
          email: 'jane@example.com',
          contact: '+919876543210',
        },
      };

      const promise = wrapper.createPaymentLink(input, 'idemp-key-1');
      await jest.runAllTimersAsync();
      const result = await promise;

      expect(result.id).toBe('plink_123');
      expect(mockAdapter).toHaveBeenCalledTimes(3);
    });

    test('should throw a retry exhaustion error after 3 retries (4 attempts total) on continuous HTTP 429', async () => {
      const err429 = new Error('Too many requests');
      (err429 as any).response = {
        status: 429,
        data: {
          error: {
            code: 'TOO_MANY_REQUESTS',
            description: 'Rate limit exceeded permanently',
          },
        },
      };

      mockAdapter.mockImplementation(() => Promise.reject(err429));

      const input = {
        amount: 10000,
        currency: 'INR',
        description: 'Test integration payment link failure',
        customer: {
          name: 'Jane Doe',
          email: 'jane@example.com',
          contact: '+919876543210',
        },
      };

      let caughtError: any = null;
      const promise = wrapper.createPaymentLink(input, 'idemp-key-2').catch((err) => {
        caughtError = err;
      });

      await jest.runAllTimersAsync();
      await promise;

      expect(caughtError).toBeDefined();
      expect(caughtError.message).toContain('Rate limit exceeded permanently');
      expect(mockAdapter).toHaveBeenCalledTimes(4); // 1 initial + 3 retries
    });
  });

  describe('Idempotency Header Injection & TTL', () => {
    let rq: any;
    let mockAdapter: jest.Mock;

    beforeEach(() => {
      rq = (wrapper.client as any).api.rq;
      mockAdapter = jest.fn();
      rq.defaults.adapter = mockAdapter;
    });

    test('should inject the X-Idempotency-Key header with the exact key provided', async () => {
      const successResponse = {
        data: { id: 'plink_987', status: 'created' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      };

      mockAdapter.mockResolvedValue(successResponse);

      const input = {
        amount: 25000,
        currency: 'INR',
        description: 'Idempotency test link',
        customer: {
          name: 'Alex Smith',
          email: 'alex@example.com',
          contact: '+919999999999',
        },
      };

      const key = 'test-idemp-uuid-value';
      await wrapper.createPaymentLink(input, key);

      expect(mockAdapter).toHaveBeenCalledTimes(1);
      const config = mockAdapter.mock.calls[0][0];
      expect(config.headers['X-Idempotency-Key']).toBe(key);
    });

    test('should set default expire_by timestamp to approximately 15 minutes in the future', async () => {
      const successResponse = {
        data: { id: 'plink_777', status: 'created' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      };

      mockAdapter.mockResolvedValue(successResponse);

      const input = {
        amount: 25000,
        currency: 'INR',
        description: 'TTL test link',
        customer: {
          name: 'Alex Smith',
          email: 'alex@example.com',
          contact: '+919999999999',
        },
      };

      const beforeExecution = Math.floor(Date.now() / 1000);
      await wrapper.createPaymentLink(input, 'ttl-key');
      const afterExecution = Math.floor(Date.now() / 1000);

      expect(mockAdapter).toHaveBeenCalledTimes(1);
      const config = mockAdapter.mock.calls[0][0];
      const requestData = JSON.parse(config.data);

      const expectedTTL = 15 * 60; // 15 minutes in seconds
      expect(requestData.expire_by).toBeGreaterThanOrEqual(beforeExecution + expectedTTL);
      expect(requestData.expire_by).toBeLessThanOrEqual(afterExecution + expectedTTL);
    });
  });

  describe('Invoice Settlement Discount & Handles', () => {
    let rq: any;
    let mockAdapter: jest.Mock;

    beforeEach(() => {
      rq = (wrapper.client as any).api.rq;
      mockAdapter = jest.fn();
      rq.defaults.adapter = mockAdapter;
    });

    test('should update draft invoice line items and issue it', async () => {
      const draftInvoice = {
        id: 'inv_draft123',
        status: 'draft',
        amount: 100000,
        currency: 'INR',
        line_items: [
          { id: 'item_1', name: 'Item 1', amount: 60000, quantity: 1 },
          { id: 'item_2', name: 'Item 2', amount: 40000, quantity: 1 },
        ],
      };

      const updatedInvoice = {
        ...draftInvoice,
        line_items: [
          { id: 'item_1', name: 'Item 1', amount: 54000, quantity: 1 },
          { id: 'item_2', name: 'Item 2', amount: 36000, quantity: 1 },
        ],
      };

      const issuedInvoice = {
        ...updatedInvoice,
        status: 'issued',
      };

      mockAdapter
        .mockResolvedValueOnce({ data: draftInvoice, status: 200, statusText: 'OK', config: {} }) // fetch invoice details
        .mockResolvedValueOnce({ data: updatedInvoice, status: 200, statusText: 'OK', config: {} }) // edit invoice details
        .mockResolvedValueOnce({ data: issuedInvoice, status: 200, statusText: 'OK', config: {} }); // issue invoice

      const result = await wrapper.createInvoicePaymentHandle('inv_draft123', 10, 'key-draft');

      expect(result.status).toBe('issued');
      expect(mockAdapter).toHaveBeenCalledTimes(3);

      // Verify draft edit called with correct discounted line items
      const editConfig = mockAdapter.mock.calls[1][0];
      expect(editConfig.method).toBe('patch');
      expect(JSON.parse(editConfig.data).line_items[0].amount).toBe(54000);
      expect(JSON.parse(editConfig.data).line_items[1].amount).toBe(36000);

      // Verify idempotency headers passed in patch and post calls
      expect(editConfig.headers['X-Idempotency-Key']).toBe('key-draft');
      const issueConfig = mockAdapter.mock.calls[2][0];
      expect(issueConfig.headers['X-Idempotency-Key']).toBe('key-draft-issue');
    });

    test('should create a discounted payment link if the invoice is already issued/paid/cancelled', async () => {
      const issuedInvoice = {
        id: 'inv_issued789',
        status: 'issued',
        amount: 100000,
        currency: 'INR',
        customer_details: {
          name: 'Bob Marley',
          email: 'bob@example.com',
          contact: '+919998887776',
        },
      };

      const createdPaymentLink = {
        id: 'plink_inv_789',
        status: 'created',
        amount: 90000,
        currency: 'INR',
        short_url: 'https://rzp.io/i/discounted',
      };

      mockAdapter
        .mockResolvedValueOnce({ data: issuedInvoice, status: 200, statusText: 'OK', config: {} }) // fetch invoice
        .mockResolvedValueOnce({ data: createdPaymentLink, status: 200, statusText: 'OK', config: {} }); // create payment link

      const result = await wrapper.createInvoicePaymentHandle('inv_issued789', 10, 'key-issued');

      expect(result.id).toBe('plink_inv_789');
      expect(result.amount).toBe(90000);
      expect(mockAdapter).toHaveBeenCalledTimes(2);

      const paymentLinkConfig = mockAdapter.mock.calls[1][0];
      expect(paymentLinkConfig.method).toBe('post');
      expect(paymentLinkConfig.headers['X-Idempotency-Key']).toBe('key-issued');

      const body = JSON.parse(paymentLinkConfig.data);
      expect(body.amount).toBe(90000);
      expect(body.notes.original_invoice_id).toBe('inv_issued789');
      expect(body.notes.discount_applied).toBe('10%');
    });
  });
});
