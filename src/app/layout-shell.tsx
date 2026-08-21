"use client";

import * as React from "react";
import { Sidebar } from "@/components/navigation/sidebar";
import { Header } from "@/components/navigation/header";
import { cn } from "@/lib/utils";

export function LayoutShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = React.useState(false);

  return (
    <div className="relative min-h-screen w-full">
      {/* Sidebar navigation panel */}
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />

      {/* Main Content Area */}
      <div
        className={cn(
          "flex min-h-screen flex-col transition-all duration-300 ease-in-out",
          collapsed ? "pl-16" : "pl-64"
        )}
      >
        {/* Header component */}
        <Header />

        {/* Core Dashboard Content Pane */}
        <main className="flex-1 p-6 md:p-8 bg-zinc-950 bg-grid-pattern relative overflow-x-hidden">
          {/* Subtle global gradient glow */}
          <div className="pointer-events-none absolute right-10 top-10 -z-10 h-[300px] w-[300px] rounded-full bg-emerald-500/5 blur-[120px]" />
          <div className="pointer-events-none absolute left-20 bottom-10 -z-10 h-[300px] w-[300px] rounded-full bg-indigo-500/5 blur-[120px]" />
          {children}
        </main>
      </div>
    </div>
  );
}
