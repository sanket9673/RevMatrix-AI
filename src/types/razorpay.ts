export interface CreatePaymentLinkInput {
  amount: number; // in paise (e.g., 50000 for Rs. 500)
  currency: string;
  description: string;
  customer: {
    name: string;
    email: string;
    contact: string;
  };
  expire_by?: number; // Unix timestamp
  notes?: Record<string, string>;
  reference_id?: string;
}

export interface RazorpayPaymentLinkResponse {
  id: string;
  status: 'created' | 'cancelled' | 'paid' | 'expired';
  short_url: string;
  amount: number; // in paise
  currency: string;
  expire_by: number;
  notes: Record<string, string>;
  description: string;
  customer: {
    name?: string;
    email?: string;
    contact?: string;
  };
  reference_id?: string;
  amount_paid?: number;
  created_at?: number;
}

export interface RazorpayPaymentDetails {
  id: string; // payment ID
  status: 'captured' | 'failed' | 'authorized';
  amount: number; // in paise
  currency: string;
  method: string;
  email: string;
  contact: string;
  error_code?: string | null;
  error_description?: string | null;
  error_reason?: string | null;
  error_source?: string | null;
  error_step?: string | null;
  notes?: Record<string, string>;
}

export interface RazorpayInvoiceDetails {
  id: string;
  status: 'draft' | 'issued' | 'paid' | 'cancelled' | 'expired';
  amount: number; // in paise
  currency: string;
  customer_details?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  line_items?: Array<{
    id?: string;
    name: string;
    amount: number; // in paise
    quantity: number;
  }>;
  discount_details?: {
    discount_amount?: number;
  };
  short_url?: string;
  expire_by?: number;
  notes?: Record<string, string>;
}

export interface RazorpayWebhookEvent<T = any> {
  entity: 'event';
  account_id: string;
  event: 'payment.failed' | 'invoice.overdue' | 'payment_link.paid';
  payload: T;
}

export interface PaymentFailedWebhookPayload {
  payment: {
    entity: RazorpayPaymentDetails;
  };
}

export interface InvoiceOverdueWebhookPayload {
  invoice: {
    entity: RazorpayInvoiceDetails;
  };
}

export interface PaymentLinkPaidWebhookPayload {
  payment_link: {
    entity: RazorpayPaymentLinkResponse;
  };
  payment?: {
    entity: RazorpayPaymentDetails;
  };
}

export interface RazorpayApiError {
  statusCode: number;
  code: string;
  description: string;
  field?: string | null;
  source?: string | null;
}
