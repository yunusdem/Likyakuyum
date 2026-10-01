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
  return String(val).replace(/[^0-9.,\-]/g, "");
}

/**
 * Değer girildikten sonra tüm binlik basamakları (yüzler, binler, milyonlar, milyarlar) nokta '.' ile ayırır.
 * Örnek: "1000000" -> "1.000.000", "500000" -> "500.000", "5000" -> "5.000"
 * Kullanıcı virgül girmeden ASLA otomatik virgül veya kuruş (,00) koymaz.
 */
export function formatWithThousandDot(val: string | number | undefined | null): string {
  if (val === undefined || val === null || val === "") return "";
  const s = String(val).trim().replace(/\s/g, "");
  if (!s) return "";

  // 1. Kullanıcı virgül girmişse: virgül ondalık ayırıcıdır, tam kısmı binlik nokta ile formatla, virgül ve sonrasını koru
  if (s.includes(",")) {
    const parts = s.split(",");
    const intDigits = parts[0].replace(/\D/g, "");
    const formattedInt = intDigits ? intDigits.replace(/\B(?=(\d{3})+(?!\d))/g, ".") : "0";
    const decPart = parts.slice(1).join("").replace(/[^0-9]/g, "");
    return parts.length > 1 ? `${formattedInt},${decPart}` : formattedInt;
  }

  // 2. "0.5", "0.25" gibi 0 ile başlayan küçük ondalık sayılar
  if (s.startsWith("0.") || s.startsWith(".")) {
    return s;
  }

  // 3. Tüm tam sayılar ve binlikler (1000 -> 1.000, 1000000 -> 1.000.000)
  const rawDigits = s.replace(/\D/g, "");
  if (!rawDigits) return "";
  return rawDigits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/**
 * Miktar alanları için temizleme ve metin yönetimi.
 * Kullanıcı girdisini kesmez, sınırlandırmaz ve nokta (.) ile basamakları ayırır.
 * Kullanıcı virgül girmeden ASLA otomatik virgül koymaz.
 */
export function formatMiktar(val: string | number | undefined | null): string {
  if (val === undefined || val === null || val === "") return "";
  if (typeof val === "number") {
    if (isNaN(val)) return "";
    const str = String(val);
    if (str.includes(".")) {
      const parts = str.split(".");
      const formattedInt = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
      return `${formattedInt},${parts[1]}`;
    }
    return str.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  }
  return formatWithThousandDot(val);
}

/**
 * Binlik basamaklı ve/veya virgüllü metinleri doğru sayıya çevirir.
 * 1.000.000 -> 1000000, 5.000 -> 5000, 5000 -> 5000, 5000.50 -> 5000.5, 5000,50 -> 5000.5
 */
export function parseDecimal(val: any): number {
  if (val === null || val === undefined || val === "") return 0;
  if (typeof val === "number") return isNaN(val) ? 0 : val;
  const str = String(val).trim().replace(/\s/g, "");
  if (!str) return 0;

  // 1. Hem nokta hem virgül içeriyorsa
  if (str.includes(",") && str.includes(".")) {
    const lastComma = str.lastIndexOf(",");
    const lastDot = str.lastIndexOf(".");
    if (lastComma > lastDot) {
      // Türkçe: "500.000,50" -> noktalar binlik, virgül ondalık
      const clean = str.replace(/\./g, "").replace(",", ".");
      const num = parseFloat(clean);
      return isNaN(num) ? 0 : num;
    } else {
      // İngilizce: "500,000.50" -> virgüller binlik, nokta ondalık
      const clean = str.replace(/,/g, "");
      const num = parseFloat(clean);
      return isNaN(num) ? 0 : num;
    }
  }

  // 2. Sadece virgül içeriyorsa
  if (str.includes(",")) {
    const parts = str.split(",");
    if (parts.length > 2) {
      // Çoklu virgül ("1,000,000") -> binlik
      const clean = str.replace(/,/g, "");
      const num = parseFloat(clean);
      return isNaN(num) ? 0 : num;
    }
    const clean = str.replace(",", ".");
    const num = parseFloat(clean);
    return isNaN(num) ? 0 : num;
  }

  // 3. Sadece nokta içeriyorsa
  if (str.includes(".")) {
    // "0.5", "0.25", ".75" gibi 0 ile başlayan küçük ondalık sayılar
    if (str.startsWith("0.") || str.startsWith(".")) {
      const num = parseFloat(str);
      return isNaN(num) ? 0 : num;
    }
    // "500.000", "5.000", "1.000.000" gibi tüm sayılarda nokta binlik ayraçtır:
    const clean = str.replace(/\./g, "");
    const num = parseFloat(clean);
    return isNaN(num) ? 0 : num;
  }

  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

/**
 * Başında nokta veya virgül olan ondalık sayıların başına 0 ekler (,35 -> 0,35)
 */
export function normalizeDecimalInput(val: string | number | undefined | null): string {
  if (val === undefined || val === null) return "";
  const str = String(val).trim();
  if (str.startsWith(",") || str.startsWith(".")) {
    return "0" + str;
  }
  return str;
}

export const isDittoKey = (e: KeyboardEvent | React.KeyboardEvent): boolean => {
  const k = e.key;
  if (
    k === '"' ||
    k === '“' ||
    k === '”' ||
    k === '„' ||
    k === '«' ||
    k === '»' ||
    k === 'é' ||
    k === 'É' ||
    k === '`' ||
    k === '´' ||
    k === '§'
  ) {
    return true;
  }
  const code = (e as any).code;
  if (code === "Backquote") return true;
  if (code === "Digit2" && e.shiftKey) return true;
  const kc = (e as any).keyCode;
  if ((kc === 222 || kc === 192) && !e.ctrlKey && !e.altKey && !e.metaKey) {
    return true;
  }
  return false;
};

/**
 * onKeyDown olayında harf girilmesini doğrudan engeller.
 * Sadece rakam, Backspace, Tab, Delete, Arrow, Enter ve Ctrl/Cmd kombinasyonlarına izin verir.
 */
export function blockNonNumericKeys(
  e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
  allowDecimal: boolean = false
) {
  if (isDittoKey(e)) return;

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

  if (allowDecimal && (e.key === "." || e.key === "," || e.key === "-")) {
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

      // Allow ditto key in tables without blocking
      if (isDittoKey(e)) return;

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

      if (allowDecimal && (e.key === "." || e.key === "," || e.key === "-")) {
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

  // 3. Blur listener (e.g. ,35 or .35 becomes 0,35 or 0.35 when leaving the field)
  window.addEventListener(
    "blur",
    (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (!target || !(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) {
        return;
      }
      const { isNumeric, allowDecimal } = isNumericTarget(target);
      if (!isNumeric || !allowDecimal) return;

      const val = target.value;
      if (!val) return;

      const trimmed = val.trim();
      if (trimmed.startsWith(",") || trimmed.startsWith(".")) {
        const newVal = "0" + trimmed;
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
        const tracker = (target as any)._valueTracker;
        if (tracker) tracker.setValue("");
        if (setter) setter.call(target, newVal);
        else target.value = newVal;

        target.dispatchEvent(new Event("input", { bubbles: true }));
        target.dispatchEvent(new Event("change", { bubbles: true }));
      }
    },
    true
  );
}
