import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
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

// Her bir bildirim için üzerine gelince duraklatan, çekilince devam eden bileşen
const ToastPopupItem: React.FC<{
  toast: ToastItem;
  onClose: (id: string) => void;
}> = ({ toast, onClose }) => {
  const [isHovered, setIsHovered] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const startTimer = useCallback(
    (delay: number) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (delay > 0) {
        timerRef.current = setTimeout(() => {
          onClose(toast.id);
        }, delay);
      }
    },
    [onClose, toast.id]
  );

  useEffect(() => {
    const initialDuration = toast.duration && toast.duration > 0 ? toast.duration : 3000;
    startTimer(initialDuration);
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [toast.duration, startTimer]);

  const handleMouseEnter = () => {
    setIsHovered(true);
    // Mouse üzerindeyken zamanlayıcıyı durdur, kaybolmasın
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    // Mouse çekilince 1.5 saniye sonra otomatik kaybolsun
    startTimer(1500);
  };

  const variant = toast.type === "danger" ? "danger" : toast.type;
  const titleMap: Record<ToastType, string> = {
    success: "İşlem Başarılı",
    danger: "Hata",
    warning: "Dikkat / Uyarı",
    info: "Bilgilendirme",
  };

  return (
    <Alert
      key={toast.id}
      variant={variant}
      className={`erp-toast-item alert-${variant} d-flex align-items-start gap-3 mb-0`}
      dismissible
      onClose={() => onClose(toast.id)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        cursor: "default",
        transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
        transform: isHovered ? "scale(1.02)" : "scale(1)",
        boxShadow: isHovered
          ? "0 25px 50px -12px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(0, 0, 0, 0.08)"
          : undefined,
      }}
    >
      <div
        className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0 mt-0.5"
        style={{
          width: "36px",
          height: "36px",
          backgroundColor:
            toast.type === "success"
              ? "#dcfce7"
              : toast.type === "danger"
              ? "#fee2e2"
              : toast.type === "warning"
              ? "#fef3c7"
              : "#e0f2fe",
        }}
      >
        {toast.type === "success" && <IconCheck size={20} className="text-success" />}
        {toast.type === "danger" && <IconAlertCircle size={20} className="text-danger" />}
        {toast.type === "warning" && <IconAlertTriangle size={20} className="text-warning" />}
        {toast.type === "info" && <IconInfoCircle size={20} className="text-info" />}
      </div>
      <div className="flex-grow-1 pe-3">
        <div className="fw-bold text-dark mb-1" style={{ fontSize: "14px" }}>
          {titleMap[toast.type] || "Bildirim"}
        </div>
        <div style={{ fontSize: "13px", color: "#475569", lineHeight: "1.4" }}>
          {toast.message}
        </div>
      </div>
    </Alert>
  );
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((message: string, type: ToastType = "info", duration = 3000) => {
    const id = Math.random().toString(36).substring(2, 9);
    const newToast: ToastItem = { id, message, type, duration };

    setToasts((prev) => [...prev, newToast]);
  }, []);

  const showSuccess = useCallback((msg: string, dur = 3000) => showToast(msg, "success", dur), [showToast]);
  const showError = useCallback((msg: string, dur = 4000) => showToast(msg, "danger", dur), [showToast]);
  const showWarning = useCallback((msg: string, dur = 3500) => showToast(msg, "warning", dur), [showToast]);
  const showInfo = useCallback((msg: string, dur = 3000) => showToast(msg, "info", dur), [showToast]);

  // Global event listener for non-React or cross-component triggers
  useEffect(() => {
    const handleCustomToast = (e: any) => {
      if (e.detail?.message) {
        showToast(e.detail.message, e.detail.type || "info", e.detail.duration || 3000);
      }
    };
    window.addEventListener("erp-toast", handleCustomToast);
    return () => window.removeEventListener("erp-toast", handleCustomToast);
  }, [showToast]);

  // Global auto-dismiss for any center popup notifications (.erp-toast-container) across all pages
  // Mouse üzerine gelince duraklatılır, çekilince kaybolur
  useEffect(() => {
    const handleNode = (node: Element) => {
      if (!node || !(node instanceof HTMLElement)) return;

      const toastItems: HTMLElement[] = [];
      if (node.classList?.contains("erp-toast-item") || (node.classList?.contains("alert") && node.closest(".erp-toast-container"))) {
        toastItems.push(node);
      }
      if (node.querySelectorAll) {
        node.querySelectorAll<HTMLElement>(".erp-toast-container .erp-toast-item, .erp-toast-container .alert").forEach((el) => {
          toastItems.push(el);
        });
      }

      toastItems.forEach((toastEl) => {
        if ((toastEl as any).__erp_auto_closed) return;
        if (
          toastEl.getAttribute("data-no-autoclose") === "true" ||
          toastEl.classList?.contains("erp-sticky-notification") ||
          toastEl.closest("[data-no-autoclose='true']")
        ) {
          return;
        }
        (toastEl as any).__erp_auto_closed = true;

        let timerId: NodeJS.Timeout | null = null;

        const dismissEl = () => {
          if (!toastEl.isConnected) return;
          const closeBtn = toastEl.querySelector<HTMLElement>(".btn-close, button.close, [data-bs-dismiss='alert']");
          if (closeBtn) {
            closeBtn.click();
          } else {
            toastEl.style.transition = "opacity 0.25s ease, transform 0.25s ease";
            toastEl.style.opacity = "0";
            toastEl.style.transform = "scale(0.95)";
            setTimeout(() => {
              if (toastEl.isConnected) {
                toastEl.style.display = "none";
              }
            }, 250);
          }
        };

        const scheduleDismiss = (delay: number) => {
          if (timerId) clearTimeout(timerId);
          timerId = setTimeout(() => {
            dismissEl();
          }, delay);
        };

        toastEl.addEventListener("mouseenter", () => {
          if (timerId) {
            clearTimeout(timerId);
            timerId = null;
          }
        });

        toastEl.addEventListener("mouseleave", () => {
          scheduleDismiss(1500);
        });

        // Başlangıçta 3.0 saniye sonra kaybolsun
        scheduleDismiss(3000);
      });
    };

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const addedNode of mutation.addedNodes) {
          if (addedNode.nodeType === Node.ELEMENT_NODE) {
            handleNode(addedNode as Element);
          }
        }
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    // Initial check
    document.querySelectorAll<HTMLElement>(".erp-toast-container .erp-toast-item, .erp-toast-container .alert").forEach((el) => {
      handleNode(el);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <ToastContext.Provider value={{ showToast, showSuccess, showError, showWarning, showInfo }}>
      {children}

      {/* Ekranın Tam Ortasında Beliren Estetik Popup Bildirim Kapsayıcısı */}
      {toasts.length > 0 && (
        <div className="erp-toast-container">
          {toasts.map((toast) => (
            <ToastPopupItem key={toast.id} toast={toast} onClose={removeToast} />
          ))}
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
      showToast: (message: string, type: ToastType = "info", duration = 3000) => {
        window.dispatchEvent(new CustomEvent("erp-toast", { detail: { message, type, duration } }));
      },
      showSuccess: (message: string, duration = 3000) => {
        window.dispatchEvent(new CustomEvent("erp-toast", { detail: { message, type: "success", duration } }));
      },
      showError: (message: string, duration = 4000) => {
        window.dispatchEvent(new CustomEvent("erp-toast", { detail: { message, type: "danger", duration } }));
      },
      showWarning: (message: string, duration = 3500) => {
        window.dispatchEvent(new CustomEvent("erp-toast", { detail: { message, type: "warning", duration } }));
      },
      showInfo: (message: string, duration = 3000) => {
        window.dispatchEvent(new CustomEvent("erp-toast", { detail: { message, type: "info", duration } }));
      },
    };
  }
  return ctx;
};

