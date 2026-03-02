"use client";

import { createContext, useContext, useState, useCallback } from "react";

type ToastType = "pending" | "success" | "error";

interface Toast {
  id:      number;
  type:    ToastType;
  message: string;
}

interface ToastContextValue {
  pending: (msg: string) => number;
  success: (msg: string, id?: number) => void;
  error:   (msg: string, id?: number) => void;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let nextId = 1;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const add = useCallback((type: ToastType, message: string, id?: number): number => {
    const toastId = id ?? nextId++;
    setToasts((prev) => {
      const filtered = prev.filter((t) => t.id !== toastId);
      return [...filtered, { id: toastId, type, message }];
    });

    // Auto dismiss success/error sau 4 giây
    if (type !== "pending") {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== toastId));
      }, 4000);
    }

    return toastId;
  }, []);

  const pending = useCallback((msg: string) => add("pending", msg), [add]);
  const success = useCallback((msg: string, id?: number) => add("success", msg, id), [add]);
  const error   = useCallback((msg: string, id?: number) => add("error",   msg, id), [add]);
  const dismiss = useCallback((id: number) => setToasts((prev) => prev.filter((t) => t.id !== id)), []);

  return (
    <ToastContext.Provider value={{ pending, success, error, dismiss }}>
      {children}

      {/* Toast container */}
      <div className="fixed bottom-4 right-4 flex flex-col gap-2 z-50">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-mono shadow-lg border transition-all ${
              toast.type === "pending"
                ? "bg-zinc-900 border-zinc-700 text-zinc-300"
                : toast.type === "success"
                ? "bg-emerald-950 border-emerald-700 text-emerald-300"
                : "bg-red-950 border-red-700 text-red-300"
            }`}
          >
            {toast.type === "pending" && (
              <div className="w-3.5 h-3.5 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />
            )}
            {toast.type === "success" && <span>✓</span>}
            {toast.type === "error"   && <span>✕</span>}
            <span>{toast.message}</span>
            <button
              onClick={() => dismiss(toast.id)}
              className="ml-2 opacity-50 hover:opacity-100 text-xs"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}