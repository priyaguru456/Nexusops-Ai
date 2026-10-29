import React, { createContext, useContext, useState, useCallback } from "react";
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from "lucide-react";

export type ToastType = "success" | "error" | "info" | "warning";

export interface ToastMessage {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
}

interface ToastContextType {
  show: (type: ToastType, message: string, title?: string) => void;
  success: (message: string, title?: string) => void;
  error: (message: string, title?: string) => void;
  info: (message: string, title?: string) => void;
  warning: (message: string, title?: string) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

let externalToast: ToastContextType | null = null;

export const toast = {
  success: (msg: string, title?: string) => externalToast?.success(msg, title),
  error: (msg: string, title?: string) => externalToast?.error(msg, title),
  info: (msg: string, title?: string) => externalToast?.info(msg, title),
  warning: (msg: string, title?: string) => externalToast?.warning(msg, title),
};

export function ToastProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    (type: ToastType, message: string, title?: string) => {
      const id = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      setToasts((prev) => [...prev, { id, type, title, message }]);
      setTimeout(() => {
        dismiss(id);
      }, 4000);
    },
    [dismiss]
  );

  const success = useCallback((msg: string, title?: string) => show("success", msg, title), [show]);
  const error = useCallback((msg: string, title?: string) => show("error", msg, title), [show]);
  const info = useCallback((msg: string, title?: string) => show("info", msg, title), [show]);
  const warning = useCallback((msg: string, title?: string) => show("warning", msg, title), [show]);

  const contextValue = { show, success, error, info, warning, dismiss };
  externalToast = contextValue;

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-md w-full px-4 pointer-events-none">
        {toasts.map((t) => {
          const config = {
            success: {
              icon: CheckCircle2,
              border: "border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/80 text-emerald-900 dark:text-emerald-100",
              iconColor: "text-emerald-600 dark:text-emerald-400",
            },
            error: {
              icon: AlertCircle,
              border: "border-rose-500/30 bg-rose-50 dark:bg-rose-950/80 text-rose-900 dark:text-rose-100",
              iconColor: "text-rose-600 dark:text-rose-400",
            },
            warning: {
              icon: AlertTriangle,
              border: "border-amber-500/30 bg-amber-50 dark:bg-amber-950/80 text-amber-900 dark:text-amber-100",
              iconColor: "text-amber-600 dark:text-amber-400",
            },
            info: {
              icon: Info,
              border: "border-blue-500/30 bg-blue-50 dark:bg-blue-950/80 text-blue-900 dark:text-blue-100",
              iconColor: "text-blue-600 dark:text-blue-400",
            },
          }[t.type];

          const IconComponent = config.icon;

          return (
            <div
              key={t.id}
              className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl border shadow-lg backdrop-blur-md transition-all duration-300 animate-in fade-in slide-in-from-bottom-5 ${config.border}`}
            >
              <IconComponent className={`w-5 h-5 mt-0.5 shrink-0 ${config.iconColor}`} />
              <div className="flex-1 min-w-0">
                {t.title && <div className="font-semibold text-sm leading-tight">{t.title}</div>}
                <div className="text-sm opacity-90 break-words">{t.message}</div>
              </div>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1"
                aria-label="Dismiss toast"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextType {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
