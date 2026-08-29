"use client";

import * as React from "react";
import {
  TrendingUp,
  RefreshCw,
  AlertCircle,
  ArrowUpRight,
  Filter,
  CheckCircle2,
  Clock,
  ExternalLink,
  ShieldCheck,
  Search,
  Download,
  AlertTriangle,
  Play,
  Check,
  Zap,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MOCK_AUDIT_BLOCKS } from "@/types/reasoning-audit";

// Define the Interface for active recovery instance
interface TraceStep {
  time: string;
  agent: string;
  action: string;
  details: string;
  status: "success" | "warning" | "info" | "error";
}

interface RecoveryInstance {
  id: string;
  timestamp: string;
  entity: string;
  loop: "Loop 1" | "Loop 2";
  loopName: string;
  value: string;
  strategy: string;
  sla: string;
  status: "In Progress" | "Recovered" | "Escalated";
  traceSteps: TraceStep[];
}

// Complete mock dataset representing active recovery feeds
const mockRecoveryData: RecoveryInstance[] = [
  {
    id: "WF-88912",
    timestamp: "2 mins ago",
    entity: "Acme Corporation",
    loop: "Loop 2",
    loopName: "B2B Receivables",
    value: "$14,250.00",
    strategy: "ERP Escalation - Net-30",
    sla: "14m remaining",
    status: "In Progress",
    traceSteps: [
      {
        time: "10:42:01 AM",
        agent: "Policy Router",
        action: "Ingest Account Status",
        details: "Detected past due invoice ($14,250.00) for Acme Corp (Net-30 agreement). Risk score: 0.42",
        status: "info",
      },
      {
        time: "10:42:05 AM",
        agent: "Strategy Assigner",
        action: "Assign Strategy Model",
        details: "Assigned 'B2B Escalation Path A'. Activating Autonomous Vendor Outreach Program.",
        status: "success",
      },
      {
        time: "10:43:10 AM",
        agent: "Communication Node",
        action: "Dispatch Email Outreach",
        details: "Sent customized payment notice to AP department with polite-firm semantic structure.",
        status: "success",
      },
      {
        time: "10:44:00 AM",
        agent: "ERP Sync Agent",
        action: "Verify Ledger Updates",
        details: "Checked ERP ledger. Payment status: PENDING. Next retry schedule in 4 hours.",
        status: "warning",
      },
    ],
  },
  {
    id: "WF-72310",
    timestamp: "12 mins ago",
    entity: "Stripe Tech Solutions",
    loop: "Loop 1",
    loopName: "Card Failures",
    value: "$4,120.00",
    strategy: "Smart Retry Matrix - Att. 2",
    sla: "Automated",
    status: "Recovered",
    traceSteps: [
      {
        time: "10:30:15 AM",
        agent: "Webhook Listener",
        action: "Ingested Razorpay Webhook",
        details: "Failed payment payload received. Error code: insufficient_funds. Original charge: $4,120.00",
        status: "info",
      },
      {
        time: "10:30:20 AM",
        agent: "Smart Retry Matrix",
        action: "Predict Next Recovery Time",
        details: "Identified optimal recovery window: Fridays 10:30 AM based on Stripe Tech payroll historicals.",
        status: "success",
      },
      {
        time: "10:31:00 AM",
        agent: "Payment Gate Agent",
        action: "Trigger Smart Retry Attempt 2",
        details: "Dispatched payment request payload via fallback terminal Razorpay_C2.",
        status: "info",
      },
      {
        time: "10:31:12 AM",
        agent: "Verification Node",
        action: "Acknowledge Success Signature",
        details: "Payment settled. Received authorization signature: tx_9921b3. Recovered: $4,120.00",
        status: "success",
      },
    ],
  },
  {
    id: "WF-65492",
    timestamp: "45 mins ago",
    entity: "Ananya Sharma",
    loop: "Loop 1",
    loopName: "UPI Retries",
    value: "$1,850.00",
    strategy: "SMS WhatsApp Dunning",
    sla: "4m remaining",
    status: "In Progress",
    traceSteps: [
      {
        time: "09:58:00 AM",
        agent: "Webhook Listener",
        action: "Ingested UPI Payment Fail",
        details: "UPI request failed. Reason: customer_abandoned.",
        status: "warning",
      },
      {
        time: "09:58:15 AM",
        agent: "Dunning Broker",
        action: "Trigger WhatsApp Flow",
        details: "Sent interactive payment link via WhatsApp API template: UPI_Failed_Retry_V1.",
        status: "success",
      },
      {
        time: "10:15:30 AM",
        agent: "Link Tracker",
        action: "Register User Interaction",
        details: "User opened the link. Form rendered. Session active.",
        status: "info",
      },
    ],
  },
  {
    id: "WF-55410",
    timestamp: "1 hour ago",
    entity: "Novartis BioGroup",
    loop: "Loop 2",
    loopName: "B2B Receivables",
    value: "$62,400.00",
    strategy: "Legal Notice Prep - Net-90",
    sla: "Breached (2h)",
    status: "Escalated",
    traceSteps: [
      {
        time: "08:43:00 AM",
        agent: "Chronos Scheduler",
        action: "Evaluate Account Health",
        details: "Account past due by 90 days. Total unpaid invoice value: $62,400.00. Credit score: LOW.",
        status: "error",
      },
      {
        time: "08:44:00 AM",
        agent: "Outreach Node",
        action: "Final Notice Delivery",
        details: "Sent certified dunning notice to receivables@novartis.com. Blocked API keys.",
        status: "warning",
      },
      {
        time: "09:00:00 AM",
        agent: "Policy Router",
        action: "Escalate to Legal",
        details: "Exceeded recovery limit (SLA limit 30 days past Net-60). Forwarding case file to legal team.",
        status: "error",
      },
    ],
  },
  {
    id: "WF-49912",
    timestamp: "3 hours ago",
    entity: "Hyper Growth Labs",
    loop: "Loop 1",
    loopName: "Card Failures",
    value: "$8,900.00",
    strategy: "Smart Retry Matrix - Att. 1",
    sla: "Automated",
    status: "Recovered",
    traceSteps: [
      {
        time: "07:22:15 AM",
        agent: "Webhook Listener",
        action: "Ingested Stripe Payment Fail",
        details: "Failed payment payload received. Error code: transaction_not_allowed.",
        status: "info",
      },
      {
        time: "07:23:00 AM",
        agent: "Smart Retry Matrix",
        action: "Trigger Smart Retry Attempt 1",
        details: "Retried on fallback terminal Stripe_B1. Payment succeeded.",
        status: "success",
      },
    ],
  },
  {
    id: "WF-33120",
    timestamp: "5 hours ago",
    entity: "Siddharth Mehta",
    loop: "Loop 1",
    loopName: "UPI Retries",
    value: "$3,200.00",
    strategy: "SMS WhatsApp Dunning",
    sla: "Automated",
    status: "Recovered",
    traceSteps: [
      {
        time: "05:10:00 AM",
        agent: "Webhook Listener",
        action: "Ingested UPI Payment Fail",
        details: "UPI payment request timed out. Value: $3,200.00",
        status: "info",
      },
      {
        time: "05:11:00 AM",
        agent: "Dunning Broker",
        action: "Trigger SMS Alert",
        details: "SMS sent to customer containing high-priority payment retry link.",
        status: "success",
      },
      {
        time: "05:14:22 AM",
        agent: "Verification Node",
        action: "Verify Ledger Updates",
        details: "Ledger updated. User paid via alternative Net Banking option. Recovered: $3,200.00",
        status: "success",
      },
    ],
  },
];

export default function Dashboard() {
  const [activeTab, setActiveTab] = React.useState<string>("all");
  const [statusFilter, setStatusFilter] = React.useState<string>("ALL");
  const [searchQuery, setSearchQuery] = React.useState<string>("");
  const [refreshing, setRefreshing] = React.useState<boolean>(false);
  const [selectedWorkflow, setSelectedWorkflow] = React.useState<RecoveryInstance | null>(null);
  const [isModalOpen, setIsModalOpen] = React.useState<boolean>(false);
  const [data, setData] = React.useState<RecoveryInstance[]>(mockRecoveryData);
  const [isLoading, setIsLoading] = React.useState<boolean>(false);


  // Watch URL params to auto-open specific workflow modal from search clicks
  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const wId = params.get("w");
      if (wId) {
        const found = mockRecoveryData.find((w) => w.id === wId);
        if (found) {
          setSelectedWorkflow(found);
          setIsModalOpen(true);
        }
      }
    }
  }, []);

  // Trigger simulated refresh loader
  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
    }, 750);
  };

  // Generate and download a security audit log CSV file
  const handleExportAuditLog = () => {
    const headers = ["Block Height", "Timestamp", "Workflow ID", "Actor", "Action Executed", "SHA-256 Hash"];
    const rows = MOCK_AUDIT_BLOCKS.map((b) => [
      `Block #${b.blockHeight}`,
      b.timestamp,
      b.workflowId,
      b.actor,
      b.actionExecuted,
      b.currentHash,
    ]);

    const csvContent = [
      headers,
      ...rows,
    ]
      .map((e) => e.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `revmatrix_security_audit_log_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filter items based on selected tab, status, and search query
  const filteredData = React.useMemo(() => {
    return data.filter((item) => {
      // Filter by tab
      if (activeTab === "loop1" && item.loop !== "Loop 1") return false;
      if (activeTab === "loop2" && item.loop !== "Loop 2") return false;

      // Filter by status
      if (statusFilter !== "ALL") {
        if (statusFilter === "PENDING" && item.status !== "In Progress") return false;
        if (statusFilter === "RECOVERED" && item.status !== "Recovered") return false;
        if (statusFilter === "HALTED_POLICY_BLOCK" && item.status !== "Escalated") return false;
      }

      // Filter by search query
      if (searchQuery.trim() !== "") {
        const query = searchQuery.toLowerCase();
        const matchesId = item.id.toLowerCase().includes(query);
        const matchesEntity = item.entity.toLowerCase().includes(query);
        const matchesStrategy = item.strategy.toLowerCase().includes(query);
        return matchesId || matchesEntity || matchesStrategy;
      }

      return true;
    });
  }, [data, activeTab, statusFilter, searchQuery]);

  return (
    <div className="space-y-8">
      {/* Upper Title Strip */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-50 md:text-3xl">
            Autonomous Revenue Recovery Engine
          </h1>
          <p className="text-sm text-zinc-400">
            Real-time agentic orchestration, ledger synchronization, and policy enforcement metrics.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh} className="h-9">
            <RefreshCw className={cn("mr-2 h-3.5 w-3.5", refreshing ? "animate-spin text-emerald-500" : "")} />
            Refresh
          </Button>
          <Button variant="emerald" size="sm" onClick={handleExportAuditLog} className="h-9 cursor-pointer">
            <Download className="mr-2 h-3.5 w-3.5" />
            Export Audit Log
          </Button>
        </div>
      </div>

      {/* SECTION 1: HERO DYNAMIC METRIC STRIP */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric Card 1 */}
        <div className="transition-all duration-200">
          <Card className="relative overflow-hidden">
            <div className="absolute right-0 top-0 h-24 w-24 bg-amber-500/5 blur-2xl" />
            <CardHeader className="flex flex-row items-center justify-between p-4 sm:p-5 pb-2 sm:pb-2">
              <CardDescription className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Total At-Risk Revenue
              </CardDescription>
              <Badge variant="warning" className="text-[10px]">
                <AlertTriangle className="mr-1 h-3 w-3" /> Warning
              </Badge>
            </CardHeader>
            <CardContent className="p-4 sm:p-5 pt-0 sm:pt-0">
              <div className="text-xl sm:text-2xl font-bold font-mono tracking-tight text-zinc-50 truncate" title="$1,248,500.00">
                $1,248,500.00
              </div>
              <div className="mt-1 flex items-center space-x-1 text-xs text-amber-500">
                <span className="font-semibold">+12.4%</span>
                <span className="text-zinc-500">vs last cycle</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Metric Card 2 */}
        <div className="transition-all duration-200">
          <Card className="relative overflow-hidden">
            <div className="absolute right-0 top-0 h-24 w-24 bg-emerald-500/5 blur-2xl" />
            <CardHeader className="flex flex-row items-center justify-between p-4 sm:p-5 pb-2 sm:pb-2">
              <CardDescription className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Net Recovered Yield
              </CardDescription>
              <Badge variant="success" pulse className="text-[10px]">
                Active Rec.
              </Badge>
            </CardHeader>
            <CardContent className="p-4 sm:p-5 pt-0 sm:pt-0">
              <div className="text-xl sm:text-2xl font-bold font-mono tracking-tight text-emerald-400 truncate" title="$892,100.00">
                $892,100.00
              </div>
              <div className="mt-1 flex items-center justify-between text-xs text-emerald-500">
                <span className="font-semibold">71.4% Recovery Rate</span>
                <span className="text-zinc-400">+$142,300 last 24h</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Metric Card 3 */}
        <div className="transition-all duration-200">
          <Card className="relative overflow-hidden">
            <div className="absolute right-0 top-0 h-24 w-24 bg-indigo-500/5 blur-2xl" />
            <CardHeader className="flex flex-row items-center justify-between p-4 sm:p-5 pb-2 sm:pb-2">
              <CardDescription className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Dual-Loop Conversion %
              </CardDescription>
              <Zap className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent className="p-4 sm:p-5 pt-0 sm:pt-0">
              <div className="text-xl sm:text-2xl font-bold font-mono tracking-tight text-zinc-50 truncate" title="84.2%">
                84.2%
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-xs text-zinc-400">
                <span className="text-emerald-400 font-mono">Loop 1: 91.2%</span>
                <span className="text-zinc-650">|</span>
                <span className="text-indigo-400 font-mono">Loop 2: 77.2%</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Metric Card 4 */}
        <div className="transition-all duration-200">
          <Card className="relative overflow-hidden">
            <div className="absolute right-0 top-0 h-24 w-24 bg-emerald-500/5 blur-2xl" />
            <CardHeader className="flex flex-row items-center justify-between p-4 sm:p-5 pb-2 sm:pb-2">
              <CardDescription className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Policy Compliance Rate
              </CardDescription>
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent className="p-4 sm:p-5 pt-0 sm:pt-0">
              <div className="text-xl sm:text-2xl font-bold font-mono tracking-tight text-zinc-50 truncate" title="99.8%">
                99.8%
              </div>
              <div className="mt-1 flex items-center space-x-1 text-xs text-zinc-500">
                <span className="font-semibold text-emerald-500">0 SLA breaches</span>
                <span>across 1,420 triggers</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* SECTION 2: INTERACTIVE CONTROLS & LOOP SWITCHER */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between bg-zinc-950/40 p-4 rounded-xl border border-zinc-900 shadow-lg">
        <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab} className="w-full lg:w-auto overflow-x-auto">
          <TabsList className="bg-zinc-950 border-zinc-850 p-1">
            <TabsTrigger value="all" className="text-xs px-3">All Active Workflows</TabsTrigger>
            <TabsTrigger value="loop1" className="text-xs px-3">Loop 1 (Transact - Card/UPI)</TabsTrigger>
            <TabsTrigger value="loop2" className="text-xs px-3">Loop 2 (B2B Receivables)</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 w-full lg:w-auto">
          {/* Status Dropdown Filter */}
          <div className="relative w-full sm:w-48">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full h-8 bg-zinc-950 border border-zinc-850 rounded-lg px-3 py-1 text-zinc-300 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-all appearance-none cursor-pointer"
            >
              <option value="ALL">All Statuses</option>
              <option value="PENDING">PENDING (In Progress)</option>
              <option value="RECOVERED">RECOVERED</option>
              <option value="HALTED_POLICY_BLOCK">HALTED_POLICY_BLOCK (Escalated)</option>
            </select>
            <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 border-l-4 border-r-4 border-t-4 border-transparent border-t-zinc-400 w-0 h-0" />
          </div>

          {/* Search filter input */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              placeholder="Filter by ID, entity, or strategy..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-zinc-850 bg-zinc-950/80 pl-8 pr-4 py-1 h-8 text-xs text-zinc-150 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 focus:bg-zinc-950 transition-all shadow-inner"
            />
          </div>
        </div>
      </div>

      {/* SECTION 3: ACTIVE RECOVERY FEED (REAL-TIME INTERACTIVE DATA TABLE) */}
      <span className="text-xs font-semibold text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-full flex items-center gap-1.5 w-fit mb-3">
        <ShieldCheck className="h-3.5 w-3.5" />
        DEMO DATA | SIMULATED FEED
      </span>
      <Card className="border border-zinc-900 bg-zinc-900/20 backdrop-blur-md">
        <CardContent className="p-0">
          {isLoading || refreshing ? (
            // Loading Skeleton State
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <div className="h-4 w-24 animate-pulse rounded bg-zinc-800" />
                <div className="h-4 w-32 animate-pulse rounded bg-zinc-800" />
                <div className="h-4 w-16 animate-pulse rounded bg-zinc-800" />
                <div className="h-4 w-20 animate-pulse rounded bg-zinc-800" />
              </div>
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex justify-between items-center py-4 border-b border-zinc-800/40">
                  <div className="space-y-2">
                    <div className="h-4 w-20 animate-pulse rounded bg-zinc-800" />
                    <div className="h-3 w-16 animate-pulse rounded bg-zinc-900" />
                  </div>
                  <div className="h-4 w-40 animate-pulse rounded bg-zinc-800" />
                  <div className="h-4 w-16 animate-pulse rounded bg-zinc-800" />
                  <div className="h-4 w-24 animate-pulse rounded bg-zinc-800" />
                  <div className="h-8 w-24 animate-pulse rounded bg-zinc-800" />
                </div>
              ))}
            </div>
          ) : filteredData.length === 0 ? (
            // Empty State
            <div className="flex flex-col items-center justify-center py-16 px-4">
              <div className="rounded-full bg-zinc-900/60 p-4 border border-zinc-800/50 mb-3 shadow-inner">
                <AlertCircle className="h-8 w-8 text-zinc-500" />
              </div>
              <h3 className="text-zinc-300 font-semibold text-sm">No Recovery Workflows Found</h3>
              <p className="text-zinc-500 text-xs mt-1 text-center max-w-xs">
                Your search filters did not return any records. Try clearing the search query or changing active tabs.
              </p>
            </div>
          ) : (
            // High density records table
            <div>
                {/* Mobile/Tablet Card View (< md) */}
                <div className="block md:hidden space-y-4 p-4">
                  {filteredData.map((row) => (
                    <div key={row.id} className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="font-mono text-sm font-semibold text-zinc-200">{row.id}</div>
                        <Badge
                          variant={
                            row.status === "Recovered"
                              ? "success"
                              : row.status === "Escalated"
                              ? "danger"
                              : "warning"
                          }
                          className="text-[10px]"
                        >
                          {row.status}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-zinc-500 block">Entity</span>
                          <span className="text-zinc-200 font-medium">{row.entity}</span>
                        </div>
                        <div>
                          <span className="text-zinc-500 block">Recovery Value</span>
                          <span className="text-zinc-100 font-mono font-bold">{row.value}</span>
                        </div>
                        <div>
                          <span className="text-zinc-500 block">Loop Context</span>
                          <span className="text-zinc-350">{row.loopName}</span>
                        </div>
                        <div>
                          <span className="text-zinc-500 block">SLA</span>
                          <span className="text-zinc-400 font-mono">{row.sla}</span>
                        </div>
                      </div>
                      <div className="border-t border-zinc-850 pt-2.5 flex items-center justify-between">
                        <span className="text-[11px] text-zinc-500 font-mono">{row.timestamp}</span>
                        <Button
                          variant="secondary"
                          size="sm"
                          className="text-[11px] h-7 bg-zinc-950 border-zinc-800 hover:bg-zinc-800 text-zinc-350 hover:text-zinc-100"
                          onClick={() => {
                            setSelectedWorkflow(row);
                            setIsModalOpen(true);
                          }}
                        >
                          View Trace <ExternalLink className="ml-1 h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop Table View (>= md) */}
                <div className="hidden md:block w-full overflow-x-auto rounded-lg border border-zinc-800">
                  <Table className="min-w-[800px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[120px] text-xs font-semibold uppercase tracking-wider">Workflow ID</TableHead>
                        <TableHead className="text-xs font-semibold uppercase tracking-wider">Entity / Account</TableHead>
                        <TableHead className="text-xs font-semibold uppercase tracking-wider">Loop Context</TableHead>
                        <TableHead className="text-xs font-semibold uppercase tracking-wider text-right">Recovery Value</TableHead>
                        <TableHead className="text-xs font-semibold uppercase tracking-wider">Agentic Strategy</TableHead>
                        <TableHead className="text-xs font-semibold uppercase tracking-wider">SLA Status</TableHead>
                        <TableHead className="text-xs font-semibold uppercase tracking-wider">Status</TableHead>
                        <TableHead className="w-[140px] text-right text-xs font-semibold uppercase tracking-wider"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredData.map((row) => (
                        <TableRow key={row.id}>
                          {/* ID & Timestamp */}
                          <TableCell className="align-middle">
                            <div className="font-mono text-zinc-200 font-medium">{row.id}</div>
                            <div className="text-[10px] text-zinc-500 mt-0.5">{row.timestamp}</div>
                          </TableCell>

                          {/* Entity */}
                          <TableCell className="align-middle font-medium text-zinc-250">
                            {row.entity}
                          </TableCell>

                          {/* Loop Context */}
                          <TableCell className="align-middle">
                            <Badge
                              variant={row.loop === "Loop 1" ? "info" : "purple"}
                              className="text-[10px]"
                            >
                              {row.loopName}
                            </Badge>
                          </TableCell>

                          {/* Risk/Recovery Value */}
                          <TableCell className="align-middle text-right font-mono font-bold text-zinc-100">
                            {row.value}
                          </TableCell>

                          {/* Agentic Strategy */}
                          <TableCell className="align-middle text-zinc-400 text-xs">
                            {row.strategy}
                          </TableCell>

                          {/* SLA */}
                          <TableCell className="align-middle">
                            <div className="flex items-center space-x-1.5 text-xs text-zinc-400 font-mono">
                              <Clock className={cn("h-3.5 w-3.5", row.sla.includes("Breached") ? "text-rose-500" : "text-zinc-500")} />
                              <span className={cn(row.sla.includes("Breached") ? "text-rose-450 font-semibold" : "")}>
                                {row.sla}
                              </span>
                            </div>
                          </TableCell>

                          {/* Status */}
                          <TableCell className="align-middle">
                            <Badge
                              variant={
                                row.status === "Recovered"
                                  ? "success"
                                  : row.status === "Escalated"
                                  ? "danger"
                                  : "warning"
                              }
                              className="text-[10px]"
                            >
                              {row.status}
                            </Badge>
                          </TableCell>

                          {/* Action */}
                          <TableCell className="align-middle text-right">
                            <Button
                              variant="secondary"
                              size="sm"
                              className="text-[11px] h-8 bg-zinc-900 border-zinc-800 hover:bg-zinc-800 text-zinc-350 hover:text-zinc-100"
                              onClick={() => {
                                setSelectedWorkflow(row);
                                setIsModalOpen(true);
                              }}
                            >
                              View Trace <ExternalLink className="ml-1.5 h-3 w-3" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
        </CardContent>
      </Card>

      {/* WORKFLOW REASONING TRACE DIALOG MODAL */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        {selectedWorkflow && (
          <DialogContent onClose={() => setIsModalOpen(false)} className="w-[95vw] max-w-lg sm:max-w-2xl max-h-[90vh] overflow-y-auto p-4 sm:p-6 rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl">
            <DialogHeader>
              <div className="flex items-center justify-between pr-6">
                <div>
                  <DialogTitle className="text-zinc-50 flex items-center gap-2">
                    <span>Reasoning Trace - {selectedWorkflow.id}</span>
                    <Badge variant={selectedWorkflow.loop === "Loop 1" ? "info" : "purple"}>
                      {selectedWorkflow.loopName}
                    </Badge>
                  </DialogTitle>
                  <DialogDescription className="text-xs mt-1 text-zinc-400">
                    Audit log of autonomous decision steps, LLM routing logic, and system payloads for <strong className="text-zinc-200">{selectedWorkflow.entity}</strong>.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            {/* Trace Steps Content */}
            <div className="space-y-4 my-2 max-h-[380px] overflow-y-auto pr-2">
              <div className="flex items-center justify-between rounded-lg bg-zinc-950/60 border border-zinc-850 p-3 text-xs font-mono">
                <div>
                  <span className="text-zinc-500">Value:</span>{" "}
                  <span className="font-bold text-zinc-200">{selectedWorkflow.value}</span>
                </div>
                <div>
                  <span className="text-zinc-500">SLA:</span>{" "}
                  <span className="font-bold text-zinc-200">{selectedWorkflow.sla}</span>
                </div>
                <div>
                  <span className="text-zinc-500">Workflow Status:</span>{" "}
                  <span className={cn(
                    "font-bold",
                    selectedWorkflow.status === "Recovered" ? "text-emerald-450" :
                    selectedWorkflow.status === "Escalated" ? "text-rose-450" : "text-amber-450"
                  )}>{selectedWorkflow.status}</span>
                </div>
              </div>

              {/* Step-by-step Timeline */}
              <div className="relative border-l border-zinc-800 pl-4 ml-2 space-y-5 py-1">
                {selectedWorkflow.traceSteps.map((step, idx) => (
                  <div key={idx} className="relative">
                    {/* Pulsing indicator bullet */}
                    <div className={cn(
                      "absolute -left-[22px] top-1 h-3.5 w-3.5 rounded-full border-2 border-zinc-900 flex items-center justify-center",
                      step.status === "success" ? "bg-emerald-500" :
                      step.status === "warning" ? "bg-amber-500" :
                      step.status === "error" ? "bg-rose-500" : "bg-sky-500"
                    )}>
                      {step.status === "success" && <div className="h-1 w-1 bg-zinc-950 rounded-full" />}
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="font-semibold text-zinc-350 bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 rounded font-mono">
                          {step.agent}
                        </span>
                        <span className="font-mono text-zinc-500">{step.time}</span>
                      </div>
                      <h4 className="text-xs font-semibold text-zinc-200">
                        {step.action}
                      </h4>
                      <p className="text-xs text-zinc-400 bg-zinc-950/30 p-2 rounded border border-zinc-850/40">
                        {step.details}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setIsModalOpen(false)}
                className="bg-zinc-800 border-zinc-700 hover:bg-zinc-700 text-zinc-200"
              >
                Close Trace
              </Button>
              <Button
                variant="emerald"
                size="sm"
                onClick={() => alert(`Initiating manual override request for ${selectedWorkflow.id}`)}
              >
                Manual Override Action
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
