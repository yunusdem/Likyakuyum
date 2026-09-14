import React from "react";

/**
 * Metinden sadece rakamları ayıklar (isteğe bağlı maksimum uzunluk sınırı ile).
 * VKN, TCKN, Telefon, Posta Kodu, Sıra No vb. için kullanılır.
 */
export function onlyDigits(val: string | number | undefined | null, maxLength?: number): string {
  if (val === undefined || val === null) return "";
  const digits = String(val).replace(/\D/g, "");
  return maxLength ? digits.slice(0, maxLength) : digits;
}

/**
 * Sayısal ve ondalıklı değerler için sadece rakam, nokta ve virgül izin verir.
 * Miktar, tutar, kur, fiyat alanları için uygundur.
 */
export function onlyDecimal(val: string | number | undefined | null): string {
  if (val === undefined || val === null) return "";
  let sanitized = String(val).replace(/[^0-9.,]/g, "");
  const parts = sanitized.split(/[.,]/);
  if (parts.length > 2) {
    sanitized = parts[0] + "." + parts.slice(1).join("");
  }
  return sanitized;
}

/**
 * onKeyDown olayında harf girilmesini doğrudan engeller.
 * Sadece rakam, Backspace, Tab, Delete, Arrow, Enter ve Ctrl/Cmd kombinasyonlarına izin verir.
 */
export function blockNonNumericKeys(
  e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
  allowDecimal: boolean = false
) {
  const allowedControlKeys = [
    "Backspace",
    "Tab",
    "Enter",
    "Escape",
    "ArrowLeft",
    "ArrowRight",
    "ArrowUp",
    "ArrowDown",
    "Delete",
    "Home",
    "End",
    "PageUp",
    "PageDown",
    "F1",
    "F2",
    "F3",
    "F4",
    "F5",
    "F6",
    "F7",
    "F8",
    "F9",
    "F10",
    "F11",
    "F12",
  ];

  if (allowedControlKeys.includes(e.key)) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;

  if (allowDecimal && (e.key === "." || e.key === ",")) {
    const target = e.target as HTMLInputElement;
    const currentVal = target.value || "";
    // If text is selected and contains the dot/comma, replacement is allowed
    const hasSelection = target.selectionStart !== null && target.selectionEnd !== null && target.selectionStart !== target.selectionEnd;
    if (!currentVal.includes(".") && !currentVal.includes(",")) {
      return;
    }
    if (hasSelection) {
      const selectedText = currentVal.substring(target.selectionStart!, target.selectionEnd!);
      if (selectedText.includes(".") || selectedText.includes(",")) {
        return;
      }
    }
    e.preventDefault();
    return;
  }

  if (!/^[0-9]$/.test(e.key)) {
    e.preventDefault();
  }
}

/**
 * Global input & keydown interceptor.
 * Intercepts any inputs that are designated as numeric (type="number", inputMode="numeric"|"decimal", data-numeric, data-decimal)
 * to strictly prevent any letter or invalid character from being typed or pasted.
 */
export function initGlobalNumericInputInterceptor() {
  if (typeof window === "undefined" || (window as any).__numericInterceptorInitialized) {
    return;
  }
  (window as any).__numericInterceptorInitialized = true;

  const isNumericTarget = (el: HTMLElement | null): { isNumeric: boolean; allowDecimal: boolean } => {
    if (!el || !(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) {
      return { isNumeric: false, allowDecimal: false };
    }

    const type = el.getAttribute("type")?.toLowerCase();
    const inputMode = el.getAttribute("inputmode")?.toLowerCase();
    const isDecimalAttr = el.getAttribute("data-decimal") === "true";
    const isNumericAttr = el.getAttribute("data-numeric") === "true";
    const className = el.className || "";

    const isClassNumeric =
      className.includes("banknot-amount-input") ||
      className.includes("numeric-only") ||
      className.includes("decimal-only");

    if (type === "number" || inputMode === "decimal" || isDecimalAttr || className.includes("decimal-only")) {
      return { isNumeric: true, allowDecimal: true };
    }

    if (inputMode === "numeric" || isNumericAttr || isClassNumeric) {
      return { isNumeric: true, allowDecimal: false };
    }

    return { isNumeric: false, allowDecimal: false };
  };

  // 1. Keydown listener (Capture phase for early prevention)
  window.addEventListener(
    "keydown",
    (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const { isNumeric, allowDecimal } = isNumericTarget(target);
      if (!isNumeric) return;

      const allowedControlKeys = [
        "Backspace",
        "Tab",
        "Enter",
        "Escape",
        "ArrowLeft",
        "ArrowRight",
        "ArrowUp",
        "ArrowDown",
        "Delete",
        "Home",
        "End",
        "PageUp",
        "PageDown",
        "F1",
        "F2",
        "F3",
        "F4",
        "F5",
        "F6",
        "F7",
        "F8",
        "F9",
        "F10",
        "F11",
        "F12",
      ];

      if (allowedControlKeys.includes(e.key)) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      if (allowDecimal && (e.key === "." || e.key === ",")) {
        const input = target as HTMLInputElement;
        const currentVal = input.value || "";
        const hasSelection = input.selectionStart !== null && input.selectionEnd !== null && input.selectionStart !== input.selectionEnd;
        if (!currentVal.includes(".") && !currentVal.includes(",")) {
          return;
        }
        if (hasSelection) {
          const selectedText = currentVal.substring(input.selectionStart!, input.selectionEnd!);
          if (selectedText.includes(".") || selectedText.includes(",")) {
            return;
          }
        }
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      if (!/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        e.stopPropagation();
      }
    },
    true
  );

  // 2. Paste listener
  window.addEventListener(
    "paste",
    (e: ClipboardEvent) => {
      const target = e.target as HTMLElement;
      const { isNumeric, allowDecimal } = isNumericTarget(target);
      if (!isNumeric) return;

      const pastedText = e.clipboardData?.getData("text") || "";
      if (!pastedText) return;

      const cleanText = allowDecimal ? onlyDecimal(pastedText) : onlyDigits(pastedText);
      if (cleanText !== pastedText) {
        e.preventDefault();
        const input = target as HTMLInputElement;
        const start = input.selectionStart || 0;
        const end = input.selectionEnd || 0;
        const currentVal = input.value || "";
        const newVal = currentVal.substring(0, start) + cleanText + currentVal.substring(end);
        input.value = allowDecimal ? onlyDecimal(newVal) : onlyDigits(newVal);
        input.setSelectionRange(start + cleanText.length, start + cleanText.length);
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
      }
    },
    true
  );
}
