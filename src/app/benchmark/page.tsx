import * as React from 'react';
import { Metadata } from 'next';
import LiveBenchmarkStream from '@/components/live-benchmark-stream';
import { Zap, ShieldCheck } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Live Ingestion Benchmark Runner | RevMatrix-AI',
  description: 'Real-time performance testing, recovery validation, and automated policy bypass execution.',
};

export default function BenchmarkPage() {
  return (
    <div className="space-y-6">
      
      {/* Page Title & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-850 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="flex h-5 w-5 items-center justify-center rounded bg-indigo-500/10 border border-indigo-500/20">
              <Zap className="h-3 w-3 text-indigo-400" />
            </div>
            <span className="text-[10px] font-bold tracking-wider text-indigo-400 font-mono uppercase">
              System Performance Benchmark
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-50 md:text-3xl">
            Live Ingestion Benchmark Runner
          </h1>
          <p className="text-sm text-zinc-400">
            Intelligent recovery performance evaluation, fallback routing throughput, and active guardrail telemetry.
          </p>
        </div>

        {/* Live Engine Status Badge */}
        <div className="flex items-center gap-3 bg-zinc-900/60 border border-zinc-800/80 rounded-xl px-4 py-2.5 backdrop-blur-sm self-start sm:self-center">
          <div className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-400 opacity-75"></span>
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-indigo-500"></span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-zinc-500 font-mono font-medium">TELEMETRY AGENT</span>
            <span className="text-xs font-bold text-zinc-200 flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5 text-indigo-400" />
              Ingestion Stream Active
            </span>
          </div>
        </div>
      </div>

      {/* Main Interactive Live Stream Panel */}
      <LiveBenchmarkStream />
    </div>
  );
}
