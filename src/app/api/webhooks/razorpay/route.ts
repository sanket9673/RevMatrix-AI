import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { RazorpayClientWrapper } from '@/lib/integrations/razorpay_client';
import { LoopType } from '@prisma/client';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const signature = req.headers.get('x-razorpay-signature') || '';
  
  // Read the raw request body text to verify signature
  const rawBody = await req.text();

  const razorpayClient = new RazorpayClientWrapper();
  
  // 1. Signature Verification
  const isVerified = razorpayClient.verifyWebhookSignature(rawBody, signature);
  if (!isVerified) {
    return NextResponse.json({ error: 'Unauthorized signature mismatch' }, { status: 401 });
  }

  // Parse webhook payload
  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch (err) {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const eventName = payload.event;
  const eventId = payload.event_id || payload.id || '';
  
  // Supported events check
  if (eventName !== 'payment.failed' && eventName !== 'invoice.overdue' && eventName !== 'payment_link.paid') {
    // Return 200 OK for unhandled event types so Razorpay doesn't retry
    return NextResponse.json({ received: true, ignored: true }, { status: 200 });
  }

  const paymentEntity = payload.payload?.payment?.entity;
  const invoiceEntity = payload.payload?.invoice?.entity;
  const paymentLinkEntity = payload.payload?.payment_link?.entity;

  const entity = paymentEntity || invoiceEntity || paymentLinkEntity;
  if (!entity) {
    return NextResponse.json({ error: 'Missing payload entity content' }, { status: 400 });
  }

  const entityId = entity.id || '';

  // 2. Idempotency & Deduplication
  // Using eventId (unique to each webhook) or entityId + eventName
  const idempotencyKey = eventId ? `${eventId}:${eventName}` : `${entityId}:${eventName}`;
  const idempotencyHash = crypto.createHash('sha256').update(idempotencyKey).digest('hex');

  // Check if this idempotency hash has already been processed
  const existingTransaction = await prisma.transaction.findUnique({
    where: { idempotencyHash },
    include: { workflows: true },
  });

  if (existingTransaction) {
    const workflowId = existingTransaction.workflows[0]?.id || null;
    return NextResponse.json({ received: true, duplicate: true, workflowId }, { status: 200 });
  }

  // Handle payment_link.paid specifically to mark workflow complete externally
  if (eventName === 'payment_link.paid') {
    const originalInvoiceId = entity.notes?.original_invoice_id || '';
    const linkIdempotencyKey = entity.notes?.idempotencyKey || '';
    
    // Find matching workflow
    const matchingWorkflow = await prisma.recoveryWorkflow.findFirst({
      where: {
        OR: [
          { idempotencyKey: linkIdempotencyKey },
          { transaction: { razorpayId: originalInvoiceId } }
        ]
      }
    });

    if (matchingWorkflow) {
      await prisma.recoveryWorkflow.update({
        where: { id: matchingWorkflow.id },
        data: {
          status: 'RECOVERED',
          completedAt: new Date(),
          netRecoveredGtv: entity.amount ? Number(entity.amount) / 100 : 0,
        }
      });
      return NextResponse.json({ received: true, workflowId: matchingWorkflow.id, action: 'EXTERNAL_RECOVERY_MARK' }, { status: 200 });
    }
    
    return NextResponse.json({ received: true, message: 'No matching active workflow found' }, { status: 200 });
  }

  // 3. Record Creation within a Prisma Transaction
  try {
    const loopType = eventName === 'payment.failed' ? LoopType.TRANSACT_FAILURE : LoopType.B2B_RECEIVABLE;
    
    // Extract metadata
    const amountInMajor = entity.amount ? Number(entity.amount) / 100 : 0;
    const currency = entity.currency || 'INR';
    const customerEmail = entity.email || entity.customer_details?.email || 'customer@example.com';
    const failureCode = entity.error_code || (eventName === 'invoice.overdue' ? 'INVOICE_OVERDUE' : null);
    const dueDate = entity.due_date ? new Date(entity.due_date * 1000) : null;

    const result = await prisma.$transaction(async (tx) => {
      // Create/Update Transaction
      const transactionRecord = await tx.transaction.upsert({
        where: { razorpayId: entityId },
        update: {
          failureCode,
          dueDate,
          idempotencyHash,
        },
        create: {
          razorpayId: entityId,
          loopType,
          amount: amountInMajor,
          currency,
          customerEmail,
          failureCode,
          dueDate,
          idempotencyHash,
        },
      });

      // Create RecoveryWorkflow
      const workflowRecord = await tx.recoveryWorkflow.create({
        data: {
          transactionId: transactionRecord.id,
          status: 'PENDING',
          nextCheckAt: new Date(), // run immediately
          idempotencyKey,
        },
      });

      return { transactionRecord, workflowRecord };
    });

    return NextResponse.json(
      { received: true, workflowId: result.workflowRecord.id },
      { status: 200 }
    );
  } catch (err: any) {
    console.error('Error processing webhook transaction:', err);
    return NextResponse.json({ error: 'Database transaction failed', details: err.message }, { status: 500 });
  }
}
