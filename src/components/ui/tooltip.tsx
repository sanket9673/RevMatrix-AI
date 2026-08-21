"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";

interface TooltipProps {
  children: React.ReactNode;
  delayDuration?: number;
}

interface TooltipContextType {
  open: boolean;
  setOpen: (open: boolean) => void;
  delayDuration: number;
}

const TooltipContext = React.createContext<TooltipContextType | undefined>(undefined);

export function TooltipProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export function Tooltip({ children, delayDuration = 300 }: TooltipProps) {
  const [open, setOpen] = React.useState(false);
  return (
    <TooltipContext.Provider value={{ open, setOpen, delayDuration }}>
      <div className="relative inline-block">{children}</div>
    </TooltipContext.Provider>
  );
}

export function TooltipTrigger({ children, asChild }: { children: React.ReactNode; asChild?: boolean }) {
  const context = React.useContext(TooltipContext);
  if (!context) throw new Error("TooltipTrigger must be used within Tooltip");

  const timerRef = React.useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      context.setOpen(true);
    }, context.delayDuration);
  };

  const handleMouseLeave = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    context.setOpen(false);
  };

  React.useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <div
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleMouseEnter}
      onBlur={handleMouseLeave}
      className="inline-block"
    >
      {children}
    </div>
  );
}

export function TooltipContent({
  className,
  children,
  side = "top",
  ...props
}: Omit<React.ComponentPropsWithoutRef<typeof motion.div>, "children"> & {
  children?: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
}) {
  const context = React.useContext(TooltipContext);
  if (!context) throw new Error("TooltipContent must be used within Tooltip");

  const sideClasses = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2",
  };

  return (
    <AnimatePresence>
      {context.open && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.15 }}
          className={cn(
            "absolute z-50 overflow-hidden rounded-md border border-zinc-850 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-50 shadow-md animate-in fade-in-0 zoom-in-95 pointer-events-none whitespace-nowrap",
            sideClasses[side],
            className
          )}
          {...props}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
