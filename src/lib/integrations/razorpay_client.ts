import Razorpay from 'razorpay';
import { env } from '@/lib/config';
import { AsyncLocalStorage } from 'async_hooks';
import crypto from 'crypto';
import {
  CreatePaymentLinkInput,
  RazorpayPaymentLinkResponse,
  RazorpayPaymentDetails,
  RazorpayInvoiceDetails,
  RazorpayApiError
} from '@/types/razorpay';

const requestContext = new AsyncLocalStorage<{ idempotencyKey?: string }>();

export class RazorpayApiErrorImpl extends Error implements RazorpayApiError {
  statusCode: number;
  code: string;
  description: string;
  field?: string | null;
  source?: string | null;

  constructor(statusCode: number, code: string, description: string, field?: string | null, source?: string | null) {
    super(description || code || 'Razorpay API Error');
    this.name = 'RazorpayApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.description = description;
    this.field = field;
    this.source = source;
  }
}

function parseError(err: any): RazorpayApiErrorImpl {
  if (err instanceof RazorpayApiErrorImpl) {
    return err;
  }

  const statusCode = err.statusCode || (err.response ? err.response.status : 500);

  let errorCode = 'UNKNOWN_ERROR';
  let description = err.message || 'An unknown error occurred';
  let field = null;
  let source = null;

  if (err.error) {
    errorCode = err.error.code || errorCode;
    description = err.error.description || description;
    field = err.error.field || null;
    source = err.error.source || null;
  } else if (err.code) {
    errorCode = err.code;
    description = `Network error: ${err.message}`;
  }

  return new RazorpayApiErrorImpl(statusCode, errorCode, description, field, source);
}

export class RazorpayClientWrapper {
  public client: Razorpay;

  constructor(configOverride?: { keyId?: string; keySecret?: string }) {
    const keyId = configOverride?.keyId || env.RAZORPAY_KEY_ID;
    const keySecret = configOverride?.keySecret || env.RAZORPAY_KEY_SECRET;

    this.client = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });

    // Inject interceptor into the internal Axios client to set X-Idempotency-Key
    const rq = (this.client as any).api?.rq;
    if (rq && rq.interceptors) {
      rq.interceptors.request.use(
        (config: any) => {
          const store = requestContext.getStore();
          if (store?.idempotencyKey) {
            config.headers = config.headers || {};
            config.headers['X-Idempotency-Key'] = store.idempotencyKey;
          }
          return config;
        },
        (error: any) => {
          return Promise.reject(error);
        }
      );
    }
  }

  /**
   * Helper method to execute an asynchronous SDK task with retries.
   * Catch HTTP 429 (Rate Limit) errors and transient network error codes (e.g., ECONNRESET, ETIMEDOUT, 5xx responses).
   * Max retries = 3. Base delay = 100ms.
   * Jitter range: 0-50ms.
   */
  public async executeWithRetry<T>(fn: () => Promise<T>): Promise<T> {
    const maxRetries = 3;
    const baseDelay = 100;
    const jitterRange = 50;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (err: any) {
        const parsedErr = parseError(err);

        const isRateLimit = parsedErr.statusCode === 429;
        const isTransientNetwork = ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN', 'ECONNREFUSED'].includes(parsedErr.code);
        const isServerError = parsedErr.statusCode >= 500;

        const shouldRetry = (isRateLimit || isTransientNetwork || isServerError) && attempt < maxRetries;

        if (shouldRetry) {
          const delay = baseDelay * Math.pow(2, attempt) + Math.random() * jitterRange;
          console.warn(
            `[RazorpayClient] Transient error encountered (Status: ${parsedErr.statusCode}, Code: ${parsedErr.code}). Retrying attempt ${attempt + 1}/${maxRetries} in ${Math.round(
              delay
            )}ms. Error: ${parsedErr.description}`
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
        } else {
          console.error(
            `[RazorpayClient] Request failed permanently. Retries exhausted or non-retryable error (Status: ${parsedErr.statusCode}, Code: ${parsedErr.code}). Error: ${parsedErr.description}`
          );
          throw parsedErr;
        }
      }
    }

    throw new RazorpayApiErrorImpl(500, 'RETRY_EXHAUSTED', 'Retries exhausted');
  }

  /**
   * Create a new payment link.
   * Expire after 15 mins by default.
   */
  public async createPaymentLink(params: CreatePaymentLinkInput, idempotencyKey: string): Promise<RazorpayPaymentLinkResponse> {
    const defaultExpiry = Math.floor(Date.now() / 1000) + 15 * 60;
    const expireBy = params.expire_by || defaultExpiry;

    const requestData = {
      amount: params.amount,
      currency: params.currency,
      description: params.description,
      customer: params.customer,
      expire_by: expireBy,
      reference_id: params.reference_id,
      notes: {
        ...params.notes,
        idempotencyKey,
        source: 'RevMatrix-AI',
      },
    };

    return this.executeWithRetry(() => {
      return requestContext.run({ idempotencyKey }, () => {
        return this.client.paymentLink.create(requestData) as Promise<RazorpayPaymentLinkResponse>;
      });
    });
  }

  /**
   * Fetch payment details.
   */
  public async getPaymentDetails(paymentId: string): Promise<RazorpayPaymentDetails> {
    return this.executeWithRetry(() => {
      return this.client.payments.fetch(paymentId) as Promise<RazorpayPaymentDetails>;
    });
  }

  /**
   * Fetch invoice details.
   */
  public async getInvoiceDetails(invoiceId: string): Promise<RazorpayInvoiceDetails> {
    return this.executeWithRetry(() => {
      return this.client.invoices.fetch(invoiceId) as Promise<RazorpayInvoiceDetails>;
    });
  }

  /**
   * Apply early-settlement incentive/discount to an invoice and create/update line items or issue an updated payment link.
   */
  public async createInvoicePaymentHandle(
    invoiceId: string,
    discountPct: number,
    idempotencyKey: string
  ): Promise<any> {
    const currentInvoice = await this.getInvoiceDetails(invoiceId);

    if (currentInvoice.status === 'draft') {
      const updatedLineItems = (currentInvoice.line_items || []).map((item) => {
        const discountedAmount = Math.round(item.amount * (1 - discountPct / 100));
        return {
          ...item,
          amount: discountedAmount,
        };
      });

      // Update line items
      await this.executeWithRetry(() => {
        return requestContext.run({ idempotencyKey }, () => {
          return this.client.invoices.edit(invoiceId, { line_items: updatedLineItems });
        });
      });

      // Issue the invoice
      return this.executeWithRetry(() => {
        return requestContext.run({ idempotencyKey: `${idempotencyKey}-issue` }, () => {
          return this.client.invoices.issue(invoiceId);
        });
      });
    } else {
      // If invoice is already issued/paid/cancelled, we cannot modify the line items.
      // Instead, we issue an updated payment link handle associated with the invoice.
      const discountedAmount = Math.round(currentInvoice.amount * (1 - discountPct / 100));

      const paymentLinkInput: CreatePaymentLinkInput = {
        amount: discountedAmount,
        currency: currentInvoice.currency || 'INR',
        description: `Early settlement discount for invoice ${invoiceId}`,
        customer: {
          name: currentInvoice.customer_details?.name || 'Valued Customer',
          email: currentInvoice.customer_details?.email || 'customer@example.com',
          contact: currentInvoice.customer_details?.contact || '+919999999999',
        },
        notes: {
          original_invoice_id: invoiceId,
          discount_applied: `${discountPct}%`,
          idempotencyKey,
        },
      };

      return this.createPaymentLink(paymentLinkInput, idempotencyKey);
    }
  }

  /**
   * Verify Razorpay Webhook HMAC SHA-256 signature using timingSafeEqual to avoid timing attacks.
   */
  public verifyWebhookSignature(rawBody: string, signature: string, secret?: string): boolean {
    try {
      const webhookSecret = secret !== undefined ? secret : env.RAZORPAY_WEBHOOK_SECRET;
      if (!webhookSecret || !signature || !rawBody) {
        return false;
      }

      const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(rawBody)
        .digest('hex');

      const expectedBuffer = Buffer.from(expectedSignature, 'utf-8');
      const signatureBuffer = Buffer.from(signature, 'utf-8');

      if (expectedBuffer.length !== signatureBuffer.length) {
        return false;
      }

      return crypto.timingSafeEqual(expectedBuffer, signatureBuffer);
    } catch (err) {
      console.error('[RazorpayClient] Error verifying webhook signature:', err);
      return false;
    }
  }
}
