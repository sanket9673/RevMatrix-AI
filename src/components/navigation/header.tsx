"use client";

import * as React from "react";
import {
  Bell,
  Search,
  CheckCircle2,
  AlertCircle,
  CreditCard,
  ChevronDown,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Header() {
  const [liveMode, setLiveMode] = React.useState(false);
  const [showPaymentMenu, setShowPaymentMenu] = React.useState(false);

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-zinc-800/80 bg-zinc-950/80 px-6 backdrop-blur-md">
      {/* Left: Breadcrumbs */}
      <div className="flex items-center space-x-1.5 text-sm font-medium">
        <span className="text-zinc-500">Workspace</span>
        <span className="text-zinc-700">/</span>
        <span className="text-zinc-200">Executive Overview</span>
      </div>

      {/* Center: Live Indicators */}
      <div className="hidden items-center space-x-4 md:flex">
        {/* System Health */}
        <div className="flex items-center space-x-2 bg-zinc-900/60 border border-zinc-850 px-3 py-1 rounded-full text-xs text-zinc-300">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
          </span>
          <span className="font-medium text-zinc-400">System Operational</span>
          <span className="text-zinc-700">|</span>
          <span className="text-[10px] font-mono text-zinc-500">Vercel Cron Active</span>
        </div>

        {/* Razorpay Mode Switcher */}
        <div className="relative">
          <button
            onClick={() => setShowPaymentMenu(!showPaymentMenu)}
            className={cn(
              "flex items-center space-x-1.5 rounded-full px-3 py-1 text-xs font-semibold font-mono border transition-all duration-200",
              liveMode
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/15"
                : "bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/15"
            )}
          >
            <CreditCard className="h-3.5 w-3.5" />
            <span>{liveMode ? "Razorpay Live Mode" : "Razorpay Test Mode"}</span>
            <ChevronDown className="h-3 w-3 opacity-60" />
          </button>

          {showPaymentMenu && (
            <>
              {/* Overlay click-out */}
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowPaymentMenu(false)}
              />
              <div className="absolute left-0 mt-2 z-50 w-48 rounded-lg border border-zinc-800 bg-zinc-900 p-1 shadow-xl">
                <button
                  onClick={() => {
                    setLiveMode(false);
                    setShowPaymentMenu(false);
                  }}
                  className={cn(
                    "flex w-full items-center justify-between rounded px-3 py-2 text-left text-xs font-medium transition-colors hover:bg-zinc-800",
                    !liveMode ? "text-amber-400 bg-zinc-850/40" : "text-zinc-400"
                  )}
                >
                  <span>Test Mode (Default)</span>
                  {!liveMode && <CheckCircle2 className="h-3.5 w-3.5" />}
                </button>
                <button
                  onClick={() => {
                    setLiveMode(true);
                    setShowPaymentMenu(false);
                  }}
                  className={cn(
                    "flex w-full items-center justify-between rounded px-3 py-2 text-left text-xs font-medium transition-colors hover:bg-zinc-800",
                    liveMode ? "text-emerald-400 bg-zinc-850/40" : "text-zinc-400"
                  )}
                >
                  <span>Live Production</span>
                  {liveMode && <CheckCircle2 className="h-3.5 w-3.5" />}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Right: Actions & User */}
      <div className="flex items-center space-x-3.5">
        {/* Search CTA Trigger */}
        <button className="flex h-9 items-center space-x-2.5 rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 text-xs text-zinc-450 hover:bg-zinc-900/80 hover:text-zinc-200 transition-all select-none">
          <Search className="h-3.5 w-3.5 text-zinc-500" />
          <span className="hidden sm:inline">Search records...</span>
          <kbd className="hidden rounded bg-zinc-950 border border-zinc-850 px-1.5 py-0.5 text-[9px] font-mono text-zinc-500 sm:inline-block">
            ⌘K
          </kbd>
        </button>

        {/* Notifications */}
        <button className="relative rounded-lg border border-zinc-800 bg-zinc-900/40 p-2 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200 transition-all">
          <Bell className="h-4 w-4" />
          {/* Notification Alert Dot */}
          <span className="absolute right-1.5 top-1.5 flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-450 opacity-75"></span>
            <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-500"></span>
          </span>
        </button>

        {/* Avatar */}
        <div className="relative h-8 w-8 overflow-hidden rounded-full border border-zinc-850 bg-zinc-900">
          <div className="flex h-full w-full items-center justify-center bg-zinc-800 text-xs font-semibold font-mono text-zinc-200">
            SC
          </div>
        </div>
      </div>
    </header>
  );
}
