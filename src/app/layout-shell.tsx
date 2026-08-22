"use client";

import * as React from "react";
import { Sidebar } from "@/components/navigation/sidebar";
import { Header } from "@/components/navigation/header";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Brain,
  PlayCircle,
  FolderLock,
  ShieldCheck,
} from "lucide-react";

export function LayoutShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = React.useState(false);
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);
  const pathname = usePathname();

  const navigationItems = [
    {
      name: "Executive Overview",
      href: "/",
      icon: LayoutDashboard,
    },
    {
      name: "Agentic Reasoning Inspector",
      href: "/reasoning",
      icon: Brain,
    },
    {
      name: "Live Benchmark Runner",
      href: "/benchmark",
      icon: PlayCircle,
    },
    {
      name: "Audit Explorer",
      href: "/audit",
      icon: FolderLock,
    },
  ];

  return (
    <div className="relative min-h-screen w-full">
      {/* Sidebar navigation panel (Desktop only) */}
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />

      {/* Mobile Navigation Drawer (Sheet) */}
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent onClose={() => setMobileNavOpen(false)} side="left" className="bg-zinc-950 border-r border-zinc-800 flex flex-col p-6">
          {/* Brand Header */}
          <div className="flex h-16 items-center px-2 border-b border-zinc-850 mb-4 shrink-0">
            <Link href="/" className="flex items-center gap-2.5" onClick={() => setMobileNavOpen(false)}>
              <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/30 shadow-[0_0_12px_rgba(16,185,129,0.2)]">
                <ShieldCheck className="h-5 w-5 text-emerald-500" />
                <div className="absolute inset-0 rounded-lg animate-pulse bg-emerald-500/5" />
              </div>
              <span className="text-base font-bold tracking-tight bg-gradient-to-r from-zinc-50 via-zinc-100 to-zinc-300 bg-clip-text text-transparent">
                RevMatrix<span className="text-emerald-500 font-medium">.ai</span>
              </span>
            </Link>
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 space-y-1.5 py-2">
            {navigationItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileNavOpen(false)}
                  className={cn(
                    "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 select-none",
                    isActive
                      ? "bg-zinc-900 text-zinc-50 shadow-sm border border-zinc-800/80"
                      : "text-zinc-400 hover:bg-zinc-900/40 hover:text-zinc-200"
                  )}
                >
                  {isActive && <div className="sidebar-active-indicator" />}
                  <item.icon
                    className={cn(
                      "h-5 w-5 shrink-0 transition-colors",
                      isActive ? "text-emerald-500" : "text-zinc-400 group-hover:text-zinc-300"
                    )}
                  />
                  <span className="truncate">{item.name}</span>
                </Link>
              );
            })}
          </nav>

          {/* User Profile Block */}
          <div className="border-t border-zinc-850 pt-4 mt-auto space-y-3 shrink-0">
            <div className="flex items-center gap-3 rounded-lg bg-zinc-900/30 border border-zinc-850/40 p-2">
              <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono text-sm font-semibold">
                SK
              </div>
              <div className="flex flex-col min-w-0">
                <span className="truncate text-xs font-semibold text-zinc-200">
                  Sanket Chavhan
                </span>
                <span className="truncate text-[10px] text-zinc-500">
                  sanket@revmatrix.ai
                </span>
              </div>
            </div>

            {/* Build version info */}
            <div className="flex items-center justify-between text-[10px] font-mono text-zinc-600 px-2 pt-1">
              <span>RevMatrix Node</span>
              <span className="bg-zinc-900/60 border border-zinc-850 px-1 rounded text-[9px] text-zinc-500">
                v2.4.0-prod
              </span>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Main Content Area */}
      <div
        className={cn(
          "flex min-h-screen flex-col transition-all duration-300 ease-in-out pl-0",
          collapsed ? "md:pl-16" : "md:pl-64"
        )}
      >
        {/* Header component */}
        <Header onMenuClick={() => setMobileNavOpen(true)} />

        {/* Core Dashboard Content Pane */}
        <main className="flex-1 p-4 sm:p-6 md:p-8 bg-zinc-950 bg-grid-pattern relative overflow-x-hidden">
          {/* Subtle global gradient glow */}
          <div className="pointer-events-none absolute right-10 top-10 -z-10 h-[300px] w-[300px] rounded-full bg-emerald-500/5 blur-[120px]" />
          <div className="pointer-events-none absolute left-20 bottom-10 -z-10 h-[300px] w-[300px] rounded-full bg-indigo-500/5 blur-[120px]" />
          {children}
        </main>
      </div>
    </div>
  );
}

