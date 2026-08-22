"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

export function Sheet({ open, onOpenChange, children }: SheetProps) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [open]);

  // Handle escape key
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        onOpenChange(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onOpenChange]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => onOpenChange(false)}
            className="fixed inset-0 bg-zinc-950/80 backdrop-blur-sm"
          />

          {/* Drawer Content wrapper */}
          {children}
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}

interface SheetContentProps extends Omit<React.ComponentPropsWithoutRef<typeof motion.div>, "children"> {
  children?: React.ReactNode;
  onClose: () => void;
  side?: "left" | "right";
}

export const SheetContent = React.forwardRef<HTMLDivElement, SheetContentProps>(
  ({ className, children, onClose, side = "left", ...props }, ref) => {
    const slideVariants = {
      left: {
        initial: { x: "-100%" },
        animate: { x: 0 },
        exit: { x: "-100%" },
      },
      right: {
        initial: { x: "100%" },
        animate: { x: 0 },
        exit: { x: "100%" },
      },
    };

    return (
      <motion.div
        ref={ref}
        initial="initial"
        animate="animate"
        exit="exit"
        variants={slideVariants[side]}
        transition={{ type: "spring", damping: 25, stiffness: 220 }}
        className={cn(
          "relative z-10 flex h-full w-3/4 max-w-sm flex-col border-r border-zinc-800 bg-zinc-950 p-6 text-zinc-100 shadow-2xl focus:outline-none",
          side === "right" && "ml-auto border-l border-r-0",
          className
        )}
        {...props}
      >
        {children}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-md p-1.5 text-zinc-500 hover:bg-zinc-900/60 hover:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        >
          <X className="h-4.5 w-4.5" />
          <span className="sr-only">Close</span>
        </button>
      </motion.div>
    );
  }
);
SheetContent.displayName = "SheetContent";
