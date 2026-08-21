import * as React from "react";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:
    | "default"
    | "secondary"
    | "outline"
    | "ghost"
    | "destructive"
    | "emerald";
  size?: "default" | "sm" | "lg" | "icon";
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", loading = false, disabled, children, ...props }, ref) => {
    const baseStyles =
      "inline-flex items-center justify-center rounded-lg text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]";

    const variants = {
      default:
        "bg-zinc-100 text-zinc-950 hover:bg-zinc-200 shadow-md",
      secondary:
        "bg-zinc-800 text-zinc-100 hover:bg-zinc-700/80 border border-zinc-700/50",
      outline:
        "border border-zinc-800 bg-transparent text-zinc-300 hover:bg-zinc-900/60 hover:text-zinc-100 hover:border-zinc-700",
      ghost:
        "text-zinc-400 hover:bg-zinc-900/60 hover:text-zinc-100",
      destructive:
        "bg-rose-600 text-zinc-100 hover:bg-rose-700 shadow-lg shadow-rose-900/20",
      emerald:
        "bg-emerald-600 text-zinc-50 hover:bg-emerald-500 shadow-lg shadow-emerald-950/30 font-semibold border border-emerald-500/20",
    };

    const sizes = {
      default: "h-10 px-4 py-2",
      sm: "h-9 rounded-md px-3 text-xs",
      lg: "h-11 rounded-md px-8 text-base",
      icon: "h-10 w-10",
    };

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      >
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin text-current" />}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";

export { Button };
