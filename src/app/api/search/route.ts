import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { MOCK_WORKFLOW_TRACES, MOCK_AUDIT_BLOCKS } from '@/types/reasoning-audit';

export const dynamic = 'force-dynamic';

// Minimal mock version of mockRecoveryData from page.tsx for static search
const STATIC_RECOVERY_DATA = [
  { id: "WF-88912", entity: "Acme Corporation", strategy: "ERP Escalation - Net-30", value: "$14,250.00", status: "In Progress" },
  { id: "WF-72310", entity: "Stripe Tech Solutions", strategy: "Smart Retry Matrix - Att. 2", value: "$4,120.00", status: "Recovered" },
  { id: "WF-65492", entity: "Ananya Sharma", strategy: "SMS WhatsApp Dunning", value: "$1,850.00", status: "In Progress" },
  { id: "WF-55410", entity: "Novartis BioGroup", strategy: "Legal Notice Prep - Net-90", value: "$62,400.00", status: "Escalated" },
  { id: "WF-49912", entity: "Hyper Growth Labs", strategy: "Smart Retry Matrix - Att. 1", value: "$8,900.00", status: "Recovered" },
  { id: "WF-33120", entity: "Siddharth Mehta", strategy: "SMS WhatsApp Dunning", value: "$3,200.00", status: "Recovered" }
];

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get('q') || '';
  const cleanQuery = query.trim().toLowerCase();

  if (!cleanQuery) {
    return NextResponse.json({ transactions: [], workflows: [], auditLogs: [] });
  }

  try {
    // 1. Search Database
    const dbTransactions = await prisma.transaction.findMany({
      where: {
        OR: [
          { id: { contains: cleanQuery, mode: 'insensitive' } },
          { razorpayId: { contains: cleanQuery, mode: 'insensitive' } },
          { customerEmail: { contains: cleanQuery, mode: 'insensitive' } },
          { failureCode: { contains: cleanQuery, mode: 'insensitive' } },
        ]
      },
      take: 5
    });

    const dbWorkflows = await prisma.recoveryWorkflow.findMany({
      where: {
        OR: [
          { id: { contains: cleanQuery, mode: 'insensitive' } },
          { idempotencyKey: { contains: cleanQuery, mode: 'insensitive' } },
        ]
      },
      include: {
        transaction: true
      },
      take: 5
    });

    const dbAuditLogs = await prisma.auditLog.findMany({
      where: {
        OR: [
          { id: { contains: cleanQuery, mode: 'insensitive' } },
          { workflowId: { contains: cleanQuery, mode: 'insensitive' } },
          { action: { contains: cleanQuery, mode: 'insensitive' } },
          { actor: { contains: cleanQuery, mode: 'insensitive' } },
        ]
      },
      take: 5
    });

    // 2. Perform static fallback search to guarantee high-fidelity results for built-in dashboard cases
    const staticWorkflows = STATIC_RECOVERY_DATA.filter(item => 
      item.id.toLowerCase().includes(cleanQuery) || 
      item.entity.toLowerCase().includes(cleanQuery) || 
      item.strategy.toLowerCase().includes(cleanQuery) ||
      item.status.toLowerCase().includes(cleanQuery)
    ).map(w => ({
      id: w.id,
      transactionId: w.id,
      status: w.status,
      nextCheckAt: new Date().toISOString(),
      appliedDiscount: w.strategy.includes('5%') ? 5 : 0,
      netRecoveredGtv: parseFloat(w.value.replace(/[^0-9.]/g, '')),
      transaction: {
        razorpayId: `pay_${w.id}`,
        customerEmail: `${w.entity.toLowerCase().replace(/\s+/g, '')}@example.com`,
        amount: parseFloat(w.value.replace(/[^0-9.]/g, '')),
        currency: 'USD',
        loopType: w.id.includes('88912') || w.id.includes('55410') ? 'B2B_RECEIVABLE' : 'TRANSACT_FAILURE'
      }
    }));

    const staticTraces = MOCK_WORKFLOW_TRACES.filter(w =>
      w.id.toLowerCase().includes(cleanQuery) ||
      w.customer.toLowerCase().includes(cleanQuery) ||
      w.title.toLowerCase().includes(cleanQuery)
    ).map(t => ({
      id: t.id,
      title: t.title,
      customer: t.customer,
      status: t.status,
      startedAt: t.startedAt
    }));

    const staticAuditLogs = MOCK_AUDIT_BLOCKS.filter(b =>
      b.workflowId.toLowerCase().includes(cleanQuery) ||
      b.currentHash.toLowerCase().includes(cleanQuery) ||
      b.actionExecuted.toLowerCase().includes(cleanQuery) ||
      b.actor.toLowerCase().includes(cleanQuery)
    ).map(b => ({
      id: `block-${b.blockHeight}`,
      workflowId: b.workflowId,
      action: b.actionExecuted,
      actor: b.actor,
      currentHash: b.currentHash,
      createdAt: b.timestamp
    }));

    // Merge DB results and static fallback results
    const combinedWorkflows = [
      ...dbWorkflows.map(w => ({
        id: w.id,
        transactionId: w.transactionId,
        status: w.status,
        nextCheckAt: w.nextCheckAt,
        appliedDiscount: w.appliedDiscount,
        netRecoveredGtv: w.netRecoveredGtv,
        transaction: w.transaction
      })),
      ...staticWorkflows.filter(sw => !dbWorkflows.some(dw => dw.id === sw.id))
    ].slice(0, 5);

    const combinedAuditLogs = [
      ...dbAuditLogs.map(a => ({
        id: a.id,
        workflowId: a.workflowId,
        action: a.action,
        actor: a.actor,
        currentHash: a.currentHash,
        createdAt: a.createdAt
      })),
      ...staticAuditLogs.filter(sa => !dbAuditLogs.some(da => da.workflowId === sa.workflowId))
    ].slice(0, 5);

    return NextResponse.json({
      transactions: dbTransactions,
      workflows: combinedWorkflows,
      auditLogs: combinedAuditLogs,
      traces: staticTraces
    });

  } catch (error) {
    console.error('Search API execution error:', error);
    return NextResponse.json({ transactions: [], workflows: [], auditLogs: [] });
  }
}
