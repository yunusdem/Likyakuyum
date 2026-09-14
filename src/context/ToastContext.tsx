import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { Alert } from "react-bootstrap";
import { IconCheck, IconAlertCircle, IconInfoCircle, IconAlertTriangle } from "@tabler/icons-react";

export type ToastType = "success" | "danger" | "warning" | "info";

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType, duration?: number) => void;
  showSuccess: (message: string, duration?: number) => void;
  showError: (message: string, duration?: number) => void;
  showWarning: (message: string, duration?: number) => void;
  showInfo: (message: string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((message: string, type: ToastType = "info", duration = 3500) => {
    const id = Math.random().toString(36).substring(2, 9);
    const newToast: ToastItem = { id, message, type, duration };

    setToasts((prev) => [...prev, newToast]);

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
  }, [removeToast]);

  const showSuccess = useCallback((msg: string, dur = 3500) => showToast(msg, "success", dur), [showToast]);
  const showError = useCallback((msg: string, dur = 4000) => showToast(msg, "danger", dur), [showToast]);
  const showWarning = useCallback((msg: string, dur = 3500) => showToast(msg, "warning", dur), [showToast]);
  const showInfo = useCallback((msg: string, dur = 3500) => showToast(msg, "info", dur), [showToast]);

  // Global event listener for non-React or cross-component triggers
  useEffect(() => {
    const handleCustomToast = (e: any) => {
      if (e.detail?.message) {
        showToast(e.detail.message, e.detail.type || "info", e.detail.duration || 3500);
      }
    };
    window.addEventListener("erp-toast", handleCustomToast);
    return () => window.removeEventListener("erp-toast", handleCustomToast);
  }, [showToast]);

  return (
    <ToastContext.Provider value={{ showToast, showSuccess, showError, showWarning, showInfo }}>
      {children}

      {/* Ekranın Sağ Alt Köşesindeki Sabit Toast Kapsayıcısı */}
      {toasts.length > 0 && (
        <div className="erp-toast-container">
          {toasts.map((toast) => {
            const variant = toast.type === "danger" ? "danger" : toast.type;
            return (
              <Alert
                key={toast.id}
                variant={variant}
                className="erp-toast-item d-flex align-items-center justify-content-between py-2.5 px-3 mb-0 border-0"
                dismissible
                onClose={() => removeToast(toast.id)}
              >
                <div className="d-flex align-items-center gap-2 me-3">
                  {toast.type === "success" && <IconCheck size={18} className="text-success flex-shrink-0" />}
                  {toast.type === "danger" && <IconAlertCircle size={18} className="text-danger flex-shrink-0" />}
                  {toast.type === "warning" && <IconAlertTriangle size={18} className="text-warning flex-shrink-0" />}
                  {toast.type === "info" && <IconInfoCircle size={18} className="text-info flex-shrink-0" />}
                  <span style={{ fontSize: "13px", fontWeight: 500 }}>{toast.message}</span>
                </div>
              </Alert>
            );
          })}
        </div>
      )}
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Fallback: trigger via window event if outside provider
    return {
      showToast: (message: string, type: ToastType = "info", duration = 3500) => {
        window.dispatchEvent(new CustomEvent("erp-toast", { detail: { message, type, duration } }));
      },
      showSuccess: (message: string, duration = 3500) => {
        window.dispatchEvent(new CustomEvent("erp-toast", { detail: { message, type: "success", duration } }));
      },
      showError: (message: string, duration = 4000) => {
        window.dispatchEvent(new CustomEvent("erp-toast", { detail: { message, type: "danger", duration } }));
      },
      showWarning: (message: string, duration = 3500) => {
        window.dispatchEvent(new CustomEvent("erp-toast", { detail: { message, type: "warning", duration } }));
      },
      showInfo: (message: string, duration = 3500) => {
        window.dispatchEvent(new CustomEvent("erp-toast", { detail: { message, type: "info", duration } }));
      },
    };
  }
  return ctx;
};
