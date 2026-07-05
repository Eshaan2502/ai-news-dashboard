"use client";

import * as React from "react";
import { CheckCircle2, XCircle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastVariant = "success" | "error" | "info";
type ToastItem = { id: number; title: string; description?: string; variant: ToastVariant };

type ToastInput = { title: string; description?: string; variant?: ToastVariant };

const ToastContext = React.createContext<{ toast: (t: ToastInput) => void } | null>(null);

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}

const ICON = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
} as const;

const ACCENT = {
  success: "text-emerald-700",
  error: "text-primary",
  info: "text-accent",
} as const;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);
  const counter = React.useRef(0);

  const remove = React.useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = React.useCallback(
    ({ title, description, variant = "success" }: ToastInput) => {
      const id = ++counter.current;
      setToasts((prev) => [...prev, { id, title, description, variant }]);
      setTimeout(() => remove(id), 4500);
    },
    [remove],
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[min(92vw,380px)] flex-col gap-2">
        {toasts.map((t) => {
          const Icon = ICON[t.variant];
          return (
            <div
              key={t.id}
              role="status"
              className="pointer-events-auto flex items-start gap-3 rounded-lg border border-border bg-card/95 p-3 shadow-xl backdrop-blur animate-fade-in"
            >
              <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", ACCENT[t.variant])} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">{t.title}</p>
                {t.description && <p className="mt-0.5 text-xs text-muted">{t.description}</p>}
              </div>
              <button
                onClick={() => remove(t.id)}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Dismiss"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
