import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "success" | "warning" | "danger" | "info" | "purple";
  pulse?: boolean;
}

function Badge({ className, variant = "default", pulse = false, ...props }: BadgeProps) {
  const variantStyles = {
    default: "bg-zinc-800 text-zinc-100 border-zinc-700/50 hover:bg-zinc-700",
    secondary: "bg-zinc-900 text-zinc-400 border-zinc-800/80 hover:bg-zinc-800",
    success: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20",
    warning: "bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20",
    danger: "bg-rose-500/10 text-rose-400 border-rose-500/30 hover:bg-rose-500/20",
    info: "bg-sky-500/10 text-sky-400 border-sky-500/30 hover:bg-sky-500/20",
    purple: "bg-indigo-500/10 text-indigo-400 border-indigo-500/30 hover:bg-indigo-500/20",
  };

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold font-mono tracking-wide transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-zinc-950",
        variantStyles[variant],
        className
      )}
      {...props}
    >
      {pulse && variant === "success" && (
        <span className="relative mr-1.5 flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
        </span>
      )}
      {props.children}
    </div>
  );
}

export { Badge };
