import * as React from "react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface TabsContextValue {
  value: string;
  onValueChange?: (value: string) => void;
}

const TabsContext = React.createContext<TabsContextValue | undefined>(undefined);

export interface TabsProps extends React.HTMLAttributes<HTMLDivElement> {
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
}

const Tabs = React.forwardRef<HTMLDivElement, TabsProps>(
  ({ defaultValue, value, onValueChange, className, children, ...props }, ref) => {
    const [localValue, setLocalValue] = React.useState(value || defaultValue || "");

    React.useEffect(() => {
      if (value !== undefined) {
        setLocalValue(value);
      }
    }, [value]);

    const handleValueChange = React.useCallback(
      (val: string) => {
        if (value === undefined) {
          setLocalValue(val);
        }
        onValueChange?.(val);
      },
      [value, onValueChange]
    );

    return (
      <TabsContext.Provider value={{ value: localValue, onValueChange: handleValueChange }}>
        <div ref={ref} className={cn("space-y-4", className)} {...props}>
          {children}
        </div>
      </TabsContext.Provider>
    );
  }
);
Tabs.displayName = "Tabs";

const TabsList = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "inline-flex h-11 items-center justify-center rounded-lg bg-zinc-900/60 p-1 text-zinc-400 border border-zinc-800/80 backdrop-blur-md",
      className
    )}
    {...props}
  />
));
TabsList.displayName = "TabsList";

export interface TabsTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
}

const TabsTrigger = React.forwardRef<HTMLButtonElement, TabsTriggerProps>(
  ({ className, value, children, ...props }, ref) => {
    const context = React.useContext(TabsContext);
    if (!context) throw new Error("TabsTrigger must be used within Tabs");

    const isActive = context.value === value;

    return (
      <button
        ref={ref}
        type="button"
        role="tab"
        aria-selected={isActive}
        onClick={() => context.onValueChange?.(value)}
        className={cn(
          "relative inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-1.5 text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 disabled:pointer-events-none disabled:opacity-50 select-none z-10",
          isActive ? "text-zinc-50" : "text-zinc-400 hover:text-zinc-200",
          className
        )}
        {...props}
      >
        {isActive && (
          <motion.div
            layoutId="active-tab-glow"
            className="absolute inset-0 rounded-md bg-zinc-800/80 border border-zinc-700/50 shadow-inner z-[-1]"
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
          />
        )}
        {children}
      </button>
    );
  }
);
TabsTrigger.displayName = "TabsTrigger";

export interface TabsContentProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
}

const TabsContent = React.forwardRef<HTMLDivElement, TabsContentProps>(
  ({ className, value, children, ...props }, ref) => {
    const context = React.useContext(TabsContext);
    if (!context) throw new Error("TabsContent must be used within Tabs");

    const isActive = context.value === value;

    if (!isActive) return null;

    return (
      <div
        ref={ref}
        role="tabpanel"
        className={cn(
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950",
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
TabsContent.displayName = "TabsContent";

export { Tabs, TabsList, TabsTrigger, TabsContent };
