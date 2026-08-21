"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Brain,
  PlayCircle,
  FolderLock,
  User,
  ShieldCheck,
  Menu,
  ChevronLeft,
} from "lucide-react";
import { motion } from "framer-motion";

interface SidebarProps {
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
}

export function Sidebar({ collapsed, setCollapsed }: SidebarProps) {
  const pathname = usePathname();

  const navigationItems = [
    {
      name: "Executive Overview",
      href: "/",
      icon: LayoutDashboard,
      shortcut: "⌘1",
    },
    {
      name: "Agentic Reasoning Inspector",
      href: "/reasoning",
      icon: Brain,
      shortcut: "⌘2",
    },
    {
      name: "Live Benchmark Runner",
      href: "/runner",
      icon: PlayCircle,
      shortcut: "⌘3",
    },
    {
      name: "Audit Explorer",
      href: "/audit",
      icon: FolderLock,
      shortcut: "⌘4",
    },
  ];

  return (
    <aside
      className={cn(
        "fixed bottom-0 left-0 top-0 z-40 flex flex-col border-r border-zinc-800/80 bg-zinc-950 transition-all duration-300 ease-in-out",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Brand Header */}
      <div className="flex h-16 items-center justify-between px-4 border-b border-zinc-850">
        <Link href="/" className="flex items-center gap-2.5 overflow-hidden">
          {/* Glowing Emblem */}
          <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/30 shadow-[0_0_12px_rgba(16,185,129,0.2)]">
            <ShieldCheck className="h-5 w-5 text-emerald-500" />
            <div className="absolute inset-0 rounded-lg animate-pulse bg-emerald-500/5" />
          </div>
          {!collapsed && (
            <motion.span
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="text-base font-bold tracking-tight bg-gradient-to-r from-zinc-50 via-zinc-100 to-zinc-300 bg-clip-text text-transparent"
            >
              RevMatrix<span className="text-emerald-500 font-medium">.ai</span>
            </motion.span>
          )}
        </Link>

        {/* Toggle Collapse Button */}
        {!collapsed && (
          <button
            onClick={() => setCollapsed(true)}
            className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-900/60 hover:text-zinc-200"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}
        {collapsed && (
          <button
            onClick={() => setCollapsed(false)}
            className="absolute left-1/2 top-4 -translate-x-1/2 rounded-md p-1.5 text-zinc-500 hover:bg-zinc-900/60 hover:text-zinc-200"
          >
            <Menu className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 space-y-1.5 p-3">
        {navigationItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 select-none",
                isActive
                  ? "bg-zinc-900 text-zinc-50 shadow-sm border border-zinc-800/80"
                  : "text-zinc-400 hover:bg-zinc-900/40 hover:text-zinc-200"
              )}
            >
              {/* Active Indicator Pill */}
              {isActive && <div className="sidebar-active-indicator" />}

              <item.icon
                className={cn(
                  "h-5 w-5 shrink-0 transition-colors",
                  isActive ? "text-emerald-500" : "text-zinc-400 group-hover:text-zinc-300"
                )}
              />

              {!collapsed && (
                <div className="flex flex-1 items-center justify-between">
                  <span className="truncate">{item.name}</span>
                  <kbd className="hidden rounded bg-zinc-900/90 border border-zinc-800 px-1.5 py-0.5 text-[10px] font-medium font-mono text-zinc-500 shadow-inner group-hover:inline-block">
                    {item.shortcut}
                  </kbd>
                </div>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom Block */}
      <div className="border-t border-zinc-850 p-3 space-y-3 bg-zinc-950/60 backdrop-blur-sm">
        {/* User Profile Block */}
        <div
          className={cn(
            "flex items-center gap-3 rounded-lg bg-zinc-900/30 border border-zinc-850/40 p-2",
            collapsed ? "justify-center p-1" : ""
          )}
        >
          <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono text-sm font-semibold">
            SK
          </div>
          {!collapsed && (
            <div className="flex flex-col min-w-0">
              <span className="truncate text-xs font-semibold text-zinc-200">
                Sanket Chavhan
              </span>
              <span className="truncate text-[10px] text-zinc-500">
                sanket@revmatrix.ai
              </span>
            </div>
          )}
        </div>

        {/* Build version info */}
        {!collapsed && (
          <div className="flex items-center justify-between text-[10px] font-mono text-zinc-600 px-2">
            <span>RevMatrix Node</span>
            <span className="bg-zinc-900/60 border border-zinc-850 px-1 rounded text-[9px] text-zinc-500">
              v2.4.0-prod
            </span>
          </div>
        )}
      </div>
    </aside>
  );
}
