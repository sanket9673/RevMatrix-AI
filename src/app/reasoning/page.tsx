import * as React from "react";
import { ReasoningTraceViewer } from "@/components/reasoning-trace-viewer";
import { Brain, Cpu } from "lucide-react";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Agentic Reasoning Inspector | RevMatrix-AI",
  description: "Inspect multi-step AI reasoning traces, internal monologues, and deterministic policy guardrails.",
};

export default function ReasoningInspectorPage() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/60 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="flex h-5 w-5 items-center justify-center rounded bg-emerald-500/10 border border-emerald-500/20">
              <Brain className="h-3 w-3 text-emerald-400" />
            </div>
            <span className="text-[10px] font-bold tracking-wider text-emerald-400 font-mono uppercase">
              AI Core Reasoning Logs
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-50 md:text-3xl">
            Agentic Reasoning Inspector
          </h1>
          <p className="text-sm text-zinc-400">
            Real-time verification of multi-step autonomous workflows and active guardrail modifications.
          </p>
        </div>

        {/* Live Engine Status Badge */}
        <div className="flex items-center gap-3 bg-zinc-900/60 border border-zinc-800/80 rounded-xl px-4 py-2.5 backdrop-blur-sm self-start sm:self-center">
          <div className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-zinc-500 font-mono font-medium">RECOVERY AGENT</span>
            <span className="text-xs font-bold text-zinc-200 flex items-center gap-1">
              <Cpu className="h-3 w-3 text-emerald-400" />
              Gemini 1.5 Pro Active
            </span>
          </div>
        </div>
      </div>

      {/* Main Interactive Trace View */}
      <ReasoningTraceViewer />
    </div>
  );
}
