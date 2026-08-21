"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain,
  ShieldCheck,
  ShieldAlert,
  XCircle,
  Database,
  ArrowRight,
  ChevronRight,
  Copy,
  Check,
  Clock,
  Play,
  Settings,
  AlertTriangle,
  UserCheck
} from "lucide-react";
import {
  MOCK_WORKFLOW_TRACES,
  WorkflowTrace,
  ReasoningStep
} from "@/types/reasoning-audit";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function ReasoningTraceViewer() {
  const [selectedWorkflowId, setSelectedWorkflowId] = React.useState<string>(
    MOCK_WORKFLOW_TRACES[0].id
  );
  const [activeStepIndex, setActiveStepIndex] = React.useState<number>(0);
  const [copiedKey, setCopiedKey] = React.useState<string | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = React.useState<boolean>(false);
  const [expandedPayload, setExpandedPayload] = React.useState<{
    input: boolean;
    output: boolean;
  }>({ input: false, output: false });

  // Reset active step and expanded state when changing workflow
  React.useEffect(() => {
    setActiveStepIndex(0);
    setExpandedPayload({ input: false, output: false });
  }, [selectedWorkflowId]);

  const currentWorkflow = React.useMemo(() => {
    return MOCK_WORKFLOW_TRACES.find((w) => w.id === selectedWorkflowId) || MOCK_WORKFLOW_TRACES[0];
  }, [selectedWorkflowId]);

  const activeStep = React.useMemo(() => {
    return currentWorkflow.steps[activeStepIndex] || currentWorkflow.steps[0];
  }, [currentWorkflow, activeStepIndex]);

  const policyInterventionsCount = React.useMemo(() => {
    return currentWorkflow.steps.filter((s) => s.policyStatus !== "PASSED").length;
  }, [currentWorkflow]);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return "success";
      case "POLICY_INTERVENED":
        return "warning";
      case "HALTED":
        return "danger";
      default:
        return "default";
    }
  };

  const getPolicyBadge = (status: 'PASSED' | 'MODIFIED_BY_POLICY' | 'BLOCKED') => {
    switch (status) {
      case "PASSED":
        return (
          <Badge variant="success" className="gap-1.5 py-1 px-3">
            <ShieldCheck className="h-3.5 w-3.5" />
            PASSED
          </Badge>
        );
      case "MODIFIED_BY_POLICY":
        return (
          <Badge variant="warning" className="gap-1.5 py-1 px-3">
            <ShieldAlert className="h-3.5 w-3.5 text-amber-400" />
            MODIFIED
          </Badge>
        );
      case "BLOCKED":
        return (
          <Badge variant="danger" className="gap-1.5 py-1 px-3">
            <XCircle className="h-3.5 w-3.5 text-rose-400" />
            BLOCKED
          </Badge>
        );
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Sidebar Selector & Metadata */}
      <div className="lg:col-span-4 space-y-6">
        {/* Selection Card */}
        <Card className="border-zinc-800 bg-zinc-900/20 backdrop-blur-md">
          <CardContent className="p-5 space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold tracking-wider text-zinc-500 uppercase">
                Select Active Workflow
              </label>
              <div className="relative">
                <select
                  value={selectedWorkflowId}
                  onChange={(e) => setSelectedWorkflowId(e.target.value)}
                  className="w-full h-11 bg-zinc-950/80 border border-zinc-850 rounded-lg px-3.5 py-2 text-zinc-100 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all appearance-none cursor-pointer"
                >
                  {MOCK_WORKFLOW_TRACES.map((w) => (
                    <option key={w.id} value={w.id} className="bg-zinc-950 text-zinc-100">
                      {w.id} - {w.title}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 border-l-4 border-r-4 border-t-4 border-transparent border-t-zinc-400 w-0 h-0" />
              </div>
            </div>

            {/* Workflow Info Subcard */}
            <div className="rounded-lg bg-zinc-950/40 border border-zinc-850/60 p-4 space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="text-zinc-500">Status</span>
                <Badge variant={getStatusColor(currentWorkflow.status)}>
                  {currentWorkflow.status.replace("_", " ")}
                </Badge>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-zinc-500">Target</span>
                <span className="font-semibold text-zinc-300 max-w-[200px] truncate">
                  {currentWorkflow.customer}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-zinc-500">Started At</span>
                <span className="font-mono text-zinc-400">
                  {new Date(currentWorkflow.startedAt).toLocaleTimeString()}
                </span>
              </div>
              <div className="h-px bg-zinc-850/60 my-2" />
              <div className="grid grid-cols-2 gap-2 pt-1 text-center">
                <div className="bg-zinc-900/60 border border-zinc-850/40 p-2.5 rounded-lg">
                  <div className="text-lg font-bold text-zinc-100 font-mono">
                    {currentWorkflow.steps.length}
                  </div>
                  <div className="text-[10px] text-zinc-500 font-medium">TOTAL STEPS</div>
                </div>
                <div className={cn(
                  "border p-2.5 rounded-lg",
                  policyInterventionsCount > 0
                    ? "bg-amber-500/5 border-amber-500/20"
                    : "bg-zinc-900/60 border-zinc-850/40"
                )}>
                  <div className={cn(
                    "text-lg font-bold font-mono",
                    policyInterventionsCount > 0 ? "text-amber-400" : "text-zinc-100"
                  )}>
                    {policyInterventionsCount}
                  </div>
                  <div className="text-[10px] text-zinc-500 font-medium">INTERVENTIONS</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Timeline Path */}
        <Card className="border-zinc-800 bg-zinc-900/20 backdrop-blur-md">
          <CardContent className="p-5">
            <h4 className="text-xs font-semibold tracking-wider text-zinc-500 uppercase mb-4">
              Agent Execution Steps
            </h4>
            <div className="relative pl-6 space-y-6">
              {/* Connecting line */}
              <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-gradient-to-b from-emerald-500/80 via-zinc-800 to-zinc-900/40" />

              {currentWorkflow.steps.map((step, idx) => {
                const isActive = activeStepIndex === idx;
                const isPassed = step.policyStatus === "PASSED";
                const isBlocked = step.policyStatus === "BLOCKED";

                return (
                  <div
                    key={step.id}
                    onClick={() => setActiveStepIndex(idx)}
                    className="relative cursor-pointer group"
                  >
                    {/* Bullet */}
                    <div
                      className={cn(
                        "absolute -left-[20px] top-1.5 flex h-[23px] w-[23px] items-center justify-center rounded-full border text-[10px] font-mono font-bold transition-all duration-300",
                        isActive
                          ? "bg-emerald-500/20 border-emerald-400 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.35)] scale-110"
                          : isBlocked
                          ? "bg-rose-500/10 border-rose-500/30 text-rose-400"
                          : !isPassed
                          ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                          : "bg-zinc-950 border-zinc-850 text-zinc-400 group-hover:border-zinc-700"
                      )}
                    >
                      {step.stepNumber}
                    </div>

                    <div className={cn(
                      "p-3 rounded-lg border transition-all duration-200",
                      isActive
                        ? "bg-zinc-900/80 border-zinc-800 text-zinc-100 shadow-inner"
                        : "bg-transparent border-transparent hover:bg-zinc-900/30 hover:border-zinc-850/50"
                    )}>
                      <div className="flex items-center justify-between mb-1">
                        <span className={cn(
                          "text-xs font-semibold font-mono tracking-tight",
                          isActive ? "text-emerald-400" : "text-zinc-300"
                        )}>
                          {step.toolCalled}
                        </span>
                        <span className="text-[10px] text-zinc-500 font-mono">
                          {new Date(step.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-400 line-clamp-1">
                        {step.agentThought}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Detail View */}
      <div className="lg:col-span-8 space-y-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={`${selectedWorkflowId}-${activeStepIndex}`}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.25 }}
            className="space-y-6"
          >
            {/* Step Header */}
            <Card className="border-zinc-800/80 bg-zinc-900/30 backdrop-blur-md relative overflow-hidden">
              <div className="absolute right-0 top-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />
              <CardContent className="p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold font-mono text-emerald-400 tracking-wider uppercase bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
                        STEP {activeStep.stepNumber} OF {currentWorkflow.steps.length}
                      </span>
                      <span className="text-xs text-zinc-500 font-mono flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(activeStep.timestamp).toISOString()}
                      </span>
                    </div>
                    <h2 className="text-lg font-bold text-zinc-50 tracking-tight flex items-center gap-2">
                      <Database className="h-4.5 w-4.5 text-emerald-500" />
                      Tool Call: <span className="text-zinc-200 font-mono text-base font-medium">{activeStep.toolCalled}</span>
                    </h2>
                  </div>

                  <div className="flex items-center gap-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsDetailsModalOpen(true)}
                      className="text-[11px] h-8 bg-zinc-900 border-zinc-805 hover:bg-zinc-800 text-zinc-350 hover:text-zinc-100 cursor-pointer"
                    >
                      Inspect Step Details
                    </Button>
                    {getPolicyBadge(activeStep.policyStatus)}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Thought Process (Internal Reasoning) */}
            <Card className="border-zinc-800 bg-zinc-900/10 backdrop-blur-md">
              <CardContent className="p-6 space-y-3">
                <div className="flex items-center gap-2 border-b border-zinc-850 pb-2.5">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                    <Brain className="h-4.5 w-4.5 text-emerald-400" />
                  </div>
                  <h3 className="text-sm font-semibold tracking-wide text-zinc-200 uppercase">
                    Gemini Agent Inner Monologue / Reasoning
                  </h3>
                </div>
                <div className="relative rounded-lg bg-zinc-950/70 border border-zinc-850/80 p-4 font-mono text-sm leading-relaxed text-zinc-300 shadow-inner">
                  <div className="absolute top-2 left-2 text-zinc-800 text-3xl font-serif leading-none select-none pointer-events-none">“</div>
                  <p className="pl-4 pr-2 whitespace-pre-line relative z-10">{activeStep.agentThought}</p>
                </div>
              </CardContent>
            </Card>

            {/* Collapsible Accordions for Tool Payload */}
            <div className="space-y-4">
              {/* Tool Input Accordion */}
              <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/20 overflow-hidden transition-all duration-300 hover:border-zinc-700/65">
                <button
                  onClick={() => setExpandedPayload(prev => ({ ...prev, input: !prev.input }))}
                  className="w-full flex items-center justify-between p-4 bg-zinc-900/40 text-left cursor-pointer transition-colors hover:bg-zinc-900/60"
                >
                  <div className="flex items-center gap-2.5">
                    <ChevronRight className={cn(
                      "h-4 w-4 text-zinc-500 transition-transform duration-300",
                      expandedPayload.input && "rotate-90"
                    )} />
                    <span className="text-xs font-bold tracking-wider text-zinc-300 font-mono">
                      [+] TOOL INPUT PAYLOAD
                    </span>
                  </div>
                  <span className="text-[10px] text-zinc-500 font-mono">
                    {Object.keys(activeStep.toolInput).length} parameters
                  </span>
                </button>

                <AnimatePresence initial={false}>
                  {expandedPayload.input && (
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: "auto" }}
                      exit={{ height: 0 }}
                      transition={{ duration: 0.25, ease: "easeInOut" }}
                    >
                      <div className="border-t border-zinc-850 p-4 bg-zinc-950/90 relative">
                        <button
                          onClick={() => copyToClipboard(JSON.stringify(activeStep.toolInput, null, 2), "input")}
                          className="absolute right-6 top-6 p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700 transition-all cursor-pointer active:scale-95 z-10"
                        >
                          {copiedKey === "input" ? (
                            <Check className="h-3.5 w-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </button>
                        <pre className="font-mono text-xs text-zinc-300 overflow-x-auto max-h-60 p-2 rounded selection:bg-emerald-500/20 selection:text-emerald-400">
                          <code>{JSON.stringify(activeStep.toolInput, null, 2)}</code>
                        </pre>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Tool Output Accordion */}
              <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/20 overflow-hidden transition-all duration-300 hover:border-zinc-700/65">
                <button
                  onClick={() => setExpandedPayload(prev => ({ ...prev, output: !prev.output }))}
                  className="w-full flex items-center justify-between p-4 bg-zinc-900/40 text-left cursor-pointer transition-colors hover:bg-zinc-900/60"
                >
                  <div className="flex items-center gap-2.5">
                    <ChevronRight className={cn(
                      "h-4 w-4 text-zinc-500 transition-transform duration-300",
                      expandedPayload.output && "rotate-90"
                    )} />
                    <span className="text-xs font-bold tracking-wider text-zinc-300 font-mono">
                      [+] TOOL OUTPUT PAYLOAD
                    </span>
                  </div>
                  <span className="text-[10px] text-zinc-500 font-mono">
                    {Object.keys(activeStep.toolOutput).length} keys returned
                  </span>
                </button>

                <AnimatePresence initial={false}>
                  {expandedPayload.output && (
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: "auto" }}
                      exit={{ height: 0 }}
                      transition={{ duration: 0.25, ease: "easeInOut" }}
                    >
                      <div className="border-t border-zinc-850 p-4 bg-zinc-950/90 relative">
                        <button
                          onClick={() => copyToClipboard(JSON.stringify(activeStep.toolOutput, null, 2), "output")}
                          className="absolute right-6 top-6 p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700 transition-all cursor-pointer active:scale-95 z-10"
                        >
                          {copiedKey === "output" ? (
                            <Check className="h-3.5 w-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </button>
                        <pre className="font-mono text-xs text-zinc-300 overflow-x-auto max-h-60 p-2 rounded selection:bg-emerald-500/20 selection:text-emerald-400">
                          <code>{JSON.stringify(activeStep.toolOutput, null, 2)}</code>
                        </pre>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Proposed vs Executed Action Diff Card */}
            <Card className={cn(
              "border backdrop-blur-md overflow-hidden",
              activeStep.policyStatus === "PASSED"
                ? "border-zinc-800/80 bg-zinc-900/10"
                : activeStep.policyStatus === "MODIFIED_BY_POLICY"
                ? "border-amber-500/30 bg-amber-500/[0.02]"
                : "border-rose-500/30 bg-rose-500/[0.02]"
            )}>
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center gap-2 border-b border-zinc-850/80 pb-3">
                  <UserCheck className="h-4.5 w-4.5 text-emerald-400" />
                  <h3 className="text-sm font-semibold tracking-wide text-zinc-200 uppercase">
                    Action Execution Diff Engine
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Proposed Action */}
                  <div className="p-4 rounded-lg bg-zinc-950/60 border border-zinc-850/50 space-y-1">
                    <span className="text-[10px] font-bold text-zinc-500 font-mono tracking-wide uppercase">
                      PROPOSED BY GEMINI AGENT
                    </span>
                    <p className="text-sm font-medium text-zinc-300">
                      {activeStep.proposedAction}
                    </p>
                  </div>

                  {/* Executed Action */}
                  <div className={cn(
                    "p-4 rounded-lg border space-y-1",
                    activeStep.policyStatus === "PASSED"
                      ? "bg-zinc-950/60 border-zinc-850/50"
                      : activeStep.policyStatus === "MODIFIED_BY_POLICY"
                      ? "bg-amber-500/10 border-amber-500/20 text-amber-300"
                      : "bg-rose-500/10 border-rose-500/20 text-rose-300"
                  )}>
                    <span className={cn(
                      "text-[10px] font-bold font-mono tracking-wide uppercase flex items-center gap-1",
                      activeStep.policyStatus === "PASSED"
                        ? "text-zinc-500"
                        : activeStep.policyStatus === "MODIFIED_BY_POLICY"
                        ? "text-amber-400"
                        : "text-rose-400"
                    )}>
                      {activeStep.policyStatus === "PASSED" ? (
                        "EXECUTED SYSTEM ACTION"
                      ) : (
                        <>
                          <Settings className="h-3 w-3 animate-spin" />
                          POLICY INTERVENED ACTION
                        </>
                      )}
                    </span>
                    <p className="text-sm font-medium">
                      {activeStep.executedAction}
                    </p>
                  </div>
                </div>

                {/* Policy Alert Context (Violated Rule Callout) */}
                {activeStep.policyStatus !== "PASSED" && activeStep.policyReason && (
                  <div className={cn(
                    "p-4 rounded-lg border text-sm flex items-start gap-3",
                    activeStep.policyStatus === "MODIFIED_BY_POLICY"
                      ? "bg-amber-500/5 border-amber-500/20 text-amber-200"
                      : "bg-rose-500/5 border-rose-500/20 text-rose-200"
                  )}>
                    <AlertTriangle className={cn(
                      "h-5 w-5 shrink-0 mt-0.5",
                      activeStep.policyStatus === "MODIFIED_BY_POLICY" ? "text-amber-400" : "text-rose-400"
                    )} />
                    <div className="space-y-1">
                      <span className="font-bold tracking-tight">Policy Intervened Violation Details:</span>
                      <p className="text-zinc-400 text-xs font-mono leading-relaxed">
                        {activeStep.policyReason}
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* STEP DETAILS MODAL */}
      <Dialog open={isDetailsModalOpen} onOpenChange={setIsDetailsModalOpen}>
        <DialogContent onClose={() => setIsDetailsModalOpen(false)} className="max-w-2xl border-zinc-800 bg-zinc-900/95 shadow-2xl backdrop-blur-md">
          <DialogHeader>
            <DialogTitle className="text-zinc-50 flex items-center gap-2">
              <span>Step {activeStep.stepNumber} Execution Inspector</span>
              {getPolicyBadge(activeStep.policyStatus)}
            </DialogTitle>
            <DialogDescription className="text-xs mt-1 text-zinc-400">
              Complete diagnostic data and inputs/outputs parameters for tool call: <strong className="text-zinc-200">{activeStep.toolCalled}</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 my-2 max-h-[420px] overflow-y-auto pr-2 text-xs font-mono">
            {/* Timestamp & Tool */}
            <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-zinc-950/60 border border-zinc-850">
              <div>
                <span className="text-zinc-500 block text-[10px] uppercase">Timestamp</span>
                <span className="font-semibold text-zinc-200">{new Date(activeStep.timestamp).toISOString()}</span>
              </div>
              <div>
                <span className="text-zinc-500 block text-[10px] uppercase">Tool Executed</span>
                <span className="font-semibold text-zinc-200">{activeStep.toolCalled}</span>
              </div>
            </div>

            {/* Inner Thought */}
            <div className="space-y-1">
              <span className="text-zinc-500 block text-[10px] uppercase font-bold">Inner Thought / Rationale</span>
              <p className="p-3 bg-zinc-950/40 rounded border border-zinc-850 text-zinc-300 font-sans leading-relaxed">
                {activeStep.agentThought}
              </p>
            </div>

            {/* Tool Input Payload */}
            <div className="space-y-1">
              <span className="text-zinc-500 block text-[10px] uppercase font-bold">Tool Input Payload</span>
              <pre className="p-3 bg-zinc-950/90 rounded border border-zinc-850 overflow-x-auto text-zinc-300 max-h-36">
                <code>{JSON.stringify(activeStep.toolInput, null, 2)}</code>
              </pre>
            </div>

            {/* Tool Output Payload */}
            <div className="space-y-1">
              <span className="text-zinc-500 block text-[10px] uppercase font-bold">Tool Output Result</span>
              <pre className="p-3 bg-zinc-950/90 rounded border border-zinc-850 overflow-x-auto text-zinc-300 max-h-36">
                <code>{JSON.stringify(activeStep.toolOutput, null, 2)}</code>
              </pre>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsDetailsModalOpen(false)}
              className="bg-zinc-800 border-zinc-700 hover:bg-zinc-700 text-zinc-200 cursor-pointer"
            >
              Close Inspector
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
