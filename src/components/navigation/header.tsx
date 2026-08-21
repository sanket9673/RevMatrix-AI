"use client";

import * as React from "react";
import {
  Bell,
  Search as SearchIcon,
  CheckCircle2,
  AlertCircle,
  CreditCard,
  ChevronDown,
  Globe,
  Activity,
  Database,
  Key,
  Cpu,
  Server,
  Check,
  X,
  ShieldAlert,
  Clock,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SearchResultItem {
  id: string;
  type: "workflow" | "transaction" | "auditLog" | "trace";
  title: string;
  subtitle: string;
  url: string;
}

interface NotificationItem {
  id: string;
  title: string;
  description: string;
  time: string;
  unread: boolean;
  type: "policy" | "webhook" | "cron" | "security";
}

export function Header() {
  const [liveMode, setLiveMode] = React.useState(false);
  const [showPaymentMenu, setShowPaymentMenu] = React.useState(false);
  const [isProfileOpen, setIsProfileOpen] = React.useState(false);

  // Search States
  const [searchQuery, setSearchQuery] = React.useState("");
  const [showSearchResults, setShowSearchResults] = React.useState(false);
  const [searchResults, setSearchResults] = React.useState<SearchResultItem[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  // Notification States
  const [isNotificationsOpen, setIsNotificationsOpen] = React.useState(false);
  const [notifications, setNotifications] = React.useState<NotificationItem[]>([
    {
      id: "nt-1",
      title: "POLICY_BLOCK Intercepted",
      description: "Discount proposal of 10% on WF-88912 capped to 5% by deterministic rules.",
      time: "2 mins ago",
      unread: true,
      type: "policy",
    },
    {
      id: "nt-2",
      title: "payment.failed Webhook Ingested",
      description: "Webhook processed for charge pay_cron_test (₹300.00). Ingested into Queue.",
      time: "12 mins ago",
      unread: true,
      type: "webhook",
    },
    {
      id: "nt-3",
      title: "Vercel Cron Batch Completed",
      description: "process-due-recoveries queue process successfully executed 3 workflows.",
      time: "1 hour ago",
      unread: false,
      type: "cron",
    },
    {
      id: "nt-4",
      title: "SHA-256 Ledger Verified",
      description: "Tamper-proof ledger sequence validation completed for block height #4.",
      time: "3 hours ago",
      unread: false,
      type: "security",
    },
  ]);

  const unreadCount = notifications.filter((n) => n.unread).length;

  // Search action
  React.useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const delayDebounce = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`);
        if (res.ok) {
          const data = await res.json();
          const items: SearchResultItem[] = [];

          // Map workflows
          if (data.workflows) {
            data.workflows.forEach((w: any) => {
              items.push({
                id: w.id,
                type: "workflow",
                title: `Workflow: ${w.id}`,
                subtitle: `${w.transaction?.customerEmail || "B2B"} - ${w.status}`,
                url: `/?w=${w.id}`,
              });
            });
          }

          // Map traces
          if (data.traces) {
            data.traces.forEach((t: any) => {
              items.push({
                id: t.id,
                type: "trace",
                title: `Reasoning Trace: ${t.id}`,
                subtitle: `${t.title} (${t.customer})`,
                url: `/reasoning?w=${t.id}`,
              });
            });
          }

          // Map audit logs
          if (data.auditLogs) {
            data.auditLogs.forEach((a: any) => {
              items.push({
                id: a.id,
                type: "auditLog",
                title: `Audit Block: ${a.workflowId}`,
                subtitle: `${a.action} by ${a.actor}`,
                url: `/audit?block=${a.workflowId}`,
              });
            });
          }

          setSearchResults(items);
        }
      } catch (err) {
        console.error("Search fetch failed:", err);
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => clearTimeout(delayDebounce);
  }, [searchQuery]);

  // Keyboard shortcut CMD+K
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
        setShowSearchResults(true);
      }
      if (e.key === "Escape") {
        setShowSearchResults(false);
        setIsNotificationsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleMarkAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
  };

  const handleClearNotifications = () => {
    setNotifications([]);
  };

  const handleResultClick = (url: string) => {
    setShowSearchResults(false);
    window.location.href = url;
  };

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
        <div className="relative">
          <div className="flex h-9 items-center space-x-2.5 rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 text-xs text-zinc-400 hover:bg-zinc-900/80 hover:text-zinc-200 transition-all select-none">
            <SearchIcon className="h-3.5 w-3.5 text-zinc-500" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search records... (⌘K)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setShowSearchResults(true)}
              className="bg-transparent border-none outline-none text-zinc-250 w-32 sm:w-44 text-xs placeholder-zinc-500 focus:w-48 sm:focus:w-64 transition-all"
            />
          </div>

          {showSearchResults && searchQuery.trim() && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowSearchResults(false)}
              />
              <div className="absolute right-0 mt-2 z-50 w-72 sm:w-96 rounded-xl border border-zinc-850 bg-zinc-900/95 p-2 shadow-2xl backdrop-blur-md max-h-96 overflow-y-auto">
                <div className="px-3 py-1.5 text-[10px] font-bold font-mono tracking-wider text-zinc-500 uppercase border-b border-zinc-850">
                  Search Results
                </div>
                {isSearching ? (
                  <div className="p-4 text-center text-xs text-zinc-500 font-mono">
                    Searching database & mock indexes...
                  </div>
                ) : searchResults.length === 0 ? (
                  <div className="p-4 text-center text-xs text-zinc-500 font-mono">
                    No matching records found.
                  </div>
                ) : (
                  <div className="space-y-1 py-1">
                    {searchResults.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => handleResultClick(item.url)}
                        className="w-full flex flex-col items-start text-left p-2.5 rounded-lg hover:bg-zinc-800/80 transition-colors group"
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="text-xs font-semibold text-zinc-200 group-hover:text-emerald-450 transition-colors">
                            {item.title}
                          </span>
                          <span className="text-[9px] font-mono font-bold text-zinc-500 bg-zinc-950 border border-zinc-850/80 px-1.5 py-0.5 rounded uppercase">
                            {item.type}
                          </span>
                        </div>
                        <span className="text-[10px] text-zinc-500 mt-0.5 truncate w-full">
                          {item.subtitle}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Notifications Popover */}
        <div className="relative">
          <button
            onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
            className="relative rounded-lg border border-zinc-800 bg-zinc-900/40 p-2 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200 transition-all cursor-pointer"
          >
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[8px] font-bold text-white select-none">
                {unreadCount}
              </span>
            )}
          </button>

          {isNotificationsOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setIsNotificationsOpen(false)}
              />
              <div className="absolute right-0 mt-2 z-50 w-80 sm:w-96 rounded-xl border border-zinc-850 bg-zinc-900/95 p-3 shadow-2xl backdrop-blur-md flex flex-col max-h-[420px]">
                <div className="flex items-center justify-between pb-2.5 border-b border-zinc-800">
                  <div className="flex items-center gap-1.5">
                    <Bell className="h-4 w-4 text-emerald-400" />
                    <span className="text-xs font-bold text-zinc-200 uppercase tracking-wide">
                      Real-Time Security Notifications
                    </span>
                  </div>
                  <Badge variant="success" className="text-[9px]">
                    {unreadCount} New
                  </Badge>
                </div>

                <div className="flex-1 overflow-y-auto py-2 space-y-2 max-h-[300px]">
                  {notifications.length === 0 ? (
                    <div className="py-8 text-center text-xs text-zinc-500 font-mono">
                      No system notifications active.
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        className={cn(
                          "p-2.5 rounded-lg border text-xs flex gap-2.5 transition-all relative overflow-hidden",
                          n.unread
                            ? "bg-zinc-900/80 border-zinc-800/80 shadow-sm"
                            : "bg-zinc-950/20 border-zinc-900/40 opacity-70"
                        )}
                      >
                        {n.unread && (
                          <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-emerald-500" />
                        )}
                        {n.type === "policy" && (
                          <ShieldAlert className="h-4.5 w-4.5 text-amber-500 shrink-0 mt-0.5" />
                        )}
                        {n.type === "webhook" && (
                          <AlertCircle className="h-4.5 w-4.5 text-rose-500 shrink-0 mt-0.5" />
                        )}
                        {n.type === "cron" && (
                          <Activity className="h-4.5 w-4.5 text-sky-500 shrink-0 mt-0.5" />
                        )}
                        {n.type === "security" && (
                          <CheckCircle2 className="h-4.5 w-4.5 text-emerald-500 shrink-0 mt-0.5" />
                        )}
                        <div className="space-y-0.5">
                          <p className="font-bold text-zinc-200 leading-none flex items-center gap-1.5">
                            {n.title}
                            {n.unread && (
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block" />
                            )}
                          </p>
                          <p className="text-[11px] text-zinc-400 mt-1 leading-normal">
                            {n.description}
                          </p>
                          <span className="text-[9px] font-mono text-zinc-500 block pt-1">
                            {n.time}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="flex items-center justify-between border-t border-zinc-800 pt-2.5 mt-1 text-[10px]">
                  <button
                    onClick={handleMarkAllRead}
                    disabled={unreadCount === 0}
                    className="text-zinc-400 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    Mark all read
                  </button>
                  <button
                    onClick={handleClearNotifications}
                    disabled={notifications.length === 0}
                    className="text-rose-450 hover:text-rose-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    Clear all alerts
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Profile Avatar Button (System settings inspector) */}
        <button
          onClick={() => setIsProfileOpen(true)}
          className="relative h-8 w-8 overflow-hidden rounded-full border border-zinc-850 bg-zinc-900 hover:border-zinc-700 transition-all cursor-pointer"
        >
          <div className="flex h-full w-full items-center justify-center bg-zinc-800 text-xs font-semibold font-mono text-zinc-200">
            SC
          </div>
        </button>
      </div>

      {/* SYSTEM ENVIRONMENT PROFILE DETAILS MODAL */}
      {isProfileOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            onClick={() => setIsProfileOpen(false)}
            className="fixed inset-0 bg-zinc-950/80 backdrop-blur-sm"
          />

          <div className="relative z-10 w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-900 p-6 text-zinc-100 shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={() => setIsProfileOpen(false)}
              className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-zinc-950 transition-opacity hover:opacity-100 focus:outline-none cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="mb-4">
              <h2 className="text-base font-bold text-zinc-50 flex items-center gap-2">
                <Globe className="h-4.5 w-4.5 text-emerald-500" />
                System Environment Controls
              </h2>
              <p className="text-xs text-zinc-500 font-mono mt-0.5">
                RevMatrix-AI Local Orchestration Context
              </p>
            </div>

            {/* Environment details cards */}
            <div className="space-y-3.5 my-4">
              {/* Razorpay Test Mode Indicator */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-950/60 border border-zinc-850">
                <div className="flex items-center gap-2.5">
                  <CreditCard className="h-4.5 w-4.5 text-amber-400" />
                  <div>
                    <span className="text-xs font-semibold text-zinc-300 block">Razorpay Mode</span>
                    <span className="text-[10px] font-mono text-zinc-500">
                      ID: rzp_test_TSaYya...
                    </span>
                  </div>
                </div>
                <Badge variant={liveMode ? "success" : "warning"} className="font-mono text-[9px]">
                  {liveMode ? "PRODUCTION" : "TEST_MODE"}
                </Badge>
              </div>

              {/* Vercel Cron Active */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-950/60 border border-zinc-850">
                <div className="flex items-center gap-2.5">
                  <Activity className="h-4.5 w-4.5 text-sky-400 animate-pulse" />
                  <div>
                    <span className="text-xs font-semibold text-zinc-300 block">Vercel Cron Engine</span>
                    <span className="text-[10px] font-mono text-zinc-500">
                      Interval: 10 mins schedule
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-emerald-400 font-mono text-[10px] font-bold">
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
                  ACTIVE
                </div>
              </div>

              {/* Gemini Engine status */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-950/60 border border-zinc-850">
                <div className="flex items-center gap-2.5">
                  <Cpu className="h-4.5 w-4.5 text-emerald-400" />
                  <div>
                    <span className="text-xs font-semibold text-zinc-300 block">Gemini Engine Model</span>
                    <span className="text-[10px] font-mono text-zinc-500">
                      Routing and Multi-hop decisions
                    </span>
                  </div>
                </div>
                <Badge variant="purple" className="font-mono text-[9px]">
                  gemini-2.5-flash
                </Badge>
              </div>

              {/* Database connection details */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-950/60 border border-zinc-850">
                <div className="flex items-center gap-2.5">
                  <Database className="h-4.5 w-4.5 text-indigo-400" />
                  <div>
                    <span className="text-xs font-semibold text-zinc-300 block">Postgres Database Connection</span>
                    <span className="text-[10px] font-mono text-zinc-500">
                      postgresql://***:***@localhost:5432/revmatrix_ai
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-emerald-400 font-bold text-[10px]">
                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                  ONLINE
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-zinc-850">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setIsProfileOpen(false)}
                className="bg-zinc-800 border-zinc-700 hover:bg-zinc-700 text-zinc-200 text-xs cursor-pointer"
              >
                Close Settings
              </Button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
