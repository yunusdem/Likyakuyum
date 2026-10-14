import { useEffect } from "react";
import { ekranAdi, girisSirasiService, girisSirasiSonraki, kayitliEkran, sirayiKoru } from "../services/girisSirasiService";
import { gorunurSirala, yerlesimVarMi } from "../services/yerlesimService";
import { isCtrlNEvent, triggerGlobalNewRecord } from "../utils/keyboardShortcuts";

const isDittoKey = (e: KeyboardEvent): boolean => {
  if (
    e.key === '"' ||
    e.key === '“' ||
    e.key === '”' ||
    e.key === '„' ||
    e.key === '«' ||
    e.key === '»' ||
    e.key === 'é' ||
    e.key === 'É' ||
    e.key === '`' ||
    e.key === '´' ||
    e.key === '§'
  ) {
    return true;
  }
  if (e.code === "Backquote") return true;
  if (e.code === "Digit2" && e.shiftKey) return true;
  if ((e.keyCode === 222 || e.keyCode === 192) && !e.ctrlKey && !e.altKey && !e.metaKey) {
    return true;
  }
  return false;
};

const setNativeValue = (
  element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement,
  value: string
) => {
  let valueSetter: ((v: any) => void) | undefined;
  if (element instanceof HTMLInputElement) {
    valueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value"
    )?.set;
  } else if (element instanceof HTMLSelectElement) {
    valueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLSelectElement.prototype,
      "value"
    )?.set;
  } else if (element instanceof HTMLTextAreaElement) {
    valueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      "value"
    )?.set;
  }

  const tracker = (element as any)._valueTracker;
  if (tracker) {
    tracker.setValue("___reset_tracker___");
  }

  if (valueSetter) {
    valueSetter.call(element, value);
  } else {
    element.value = value;
  }

  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
};

const isVisibleFast = (el: HTMLElement): boolean => {
  if (el.style.display === "none" || el.style.visibility === "hidden" || el.hasAttribute("aria-hidden")) {
    return false;
  }
  if (typeof (el as any).checkVisibility === "function") {
    return (el as any).checkVisibility({ checkOpacity: false, checkVisibilityCSS: true });
  }
  return el.offsetWidth > 0 || el.offsetHeight > 0 || el.getClientRects().length > 0;
};

const SELECTOR =
  'input:not([type="hidden"]):not([disabled]):not([readonly]), select:not([disabled]):not([readonly])';

/**
 * Global Enter-to-Next-Field hook
 * Allows ERP-style navigation across input/select fields using Enter key with 0ms instant transition.
 */
export const useEnterNavigation = () => {
  useEffect(() => {
    // ─── 0. Ctrl+N / Cmd+N: Evrensel Yeni Kayıt / Yeni Fiş (Capture Aşamasında) ───
    const handleCaptureShortcuts = (e: KeyboardEvent) => {
      if (isCtrlNEvent(e)) {
        e.preventDefault();
        e.stopPropagation();
        triggerGlobalNewRecord();
        return;
      }
    };

    // ─── 1. Enter ile Alanlar Arası Geçiş & Hızlı Kısayollar (Bubble Aşamasında) ───
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const tagName = (target.tagName || "").toLowerCase();

      // ── Space Tuşu: Tüm select / combobox alanlarını açar ──
      if (e.key === " " || e.code === "Space") {
        if (tagName === "select" || target.classList.contains("form-select") || target.getAttribute("role") === "combobox") {
          if (tagName === "select") {
            const sel = target as HTMLSelectElement;
            if (typeof (sel as any).showPicker === "function") {
              e.preventDefault();
              try {
                (sel as any).showPicker();
              } catch {}
              return;
            }
          }
        }
      }

      // ── " Tuşu: Tüm tablolarda üst satırdaki aynı sütunun değerini kopyalar ──
      if (isDittoKey(e)) {
        const td = target.closest("td, th");
        const tr = target.closest("tr");
        const table = target.closest("table");

        if (td && tr && table) {
          e.preventDefault();
          e.stopPropagation();

          const tbody = tr.parentElement;
          if (tbody) {
            const allRows = Array.from(tbody.children).filter(
              (el): el is HTMLTableRowElement => el.tagName.toLowerCase() === "tr"
            );
            const currentRowIndex = allRows.indexOf(tr as HTMLTableRowElement);

            if (currentRowIndex > 0) {
              const prevTr = allRows[currentRowIndex - 1];
              const currentCells = Array.from(tr.children);
              const colIndex = currentCells.indexOf(td);

              if (colIndex >= 0 && colIndex < prevTr.children.length) {
                const prevTd = prevTr.children[colIndex] as HTMLElement;
                if (prevTd) {
                  const prevInput = prevTd.querySelector<
                    HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
                  >("input:not([type='hidden']), select, textarea");

                  let prevValue = "";
                  if (prevInput) {
                    prevValue = prevInput.value ?? "";
                  } else {
                    prevValue = (prevTd.textContent || "").trim();
                  }

                  if (
                    target instanceof HTMLInputElement ||
                    target instanceof HTMLSelectElement ||
                    target instanceof HTMLTextAreaElement
                  ) {
                    setNativeValue(target, prevValue);
                    if (target instanceof HTMLInputElement) {
                      try {
                        target.select();
                      } catch {}
                    }
                  }
                }
              }
            }
          }
          return;
        }
      }

      if (e.key !== "Enter") return;

      // Sayfa veya bileşen kendi Enter geçişini zaten yaptıysa (e.preventDefault() çağrıldıysa)
      // veya data-custom-enter varsa karışma (çakışma ve gecikmeyi önler)
      if (e.defaultPrevented) return;
      if (target.getAttribute("data-custom-enter") === "true") return;

      // Don't intercept Enter on textareas (allows multi-line text)
      if (tagName === "textarea") return;

      // Don't intercept inside modal dialogs (modals manage their own keyboard focus & confirm actions)
      if (target.closest(".modal") || target.closest(".modal-content")) return;

      // Don't intercept Enter on buttons or submit inputs
      if (
        tagName === "button" ||
        (tagName === "input" && (target as HTMLInputElement).type === "submit")
      ) {
        return;
      }

      // Only handle input and select
      if (tagName !== "input" && tagName !== "select") return;

      // Kapsamı tüm document yerine en yakın form/karta sınırla (100x daha hızlı DOM taraması)
      const container =
        target.closest(".modal-content") ||
        target.closest("form") ||
        target.closest(".card-body") ||
        target.closest(".card") ||
        target.closest("[data-ekran]") ||
        target.closest("[data-sayfa-icerik]") ||
        target.closest("main") ||
        document.body;

      const allElements = Array.from(container.querySelectorAll<HTMLElement>(SELECTOR));
      const visibleElements = allElements.filter(isVisibleFast);

      const ekran = ekranAdi(target);
      const hasYerlesim = yerlesimVarMi(ekran);
      const siraliAdaylar = hasYerlesim ? gorunurSirala(visibleElements) : visibleElements;

      let nextElement = girisSirasiSonraki(target, siraliAdaylar);

      // Kart sonunda bir sonraki karta veya bölüme geçiş desteği
      if (!nextElement && container !== document.body) {
        const globalElements = Array.from(document.body.querySelectorAll<HTMLElement>(SELECTOR)).filter(isVisibleFast);
        const globalCandidates = hasYerlesim ? gorunurSirala(globalElements) : globalElements;
        nextElement = girisSirasiSonraki(target, globalCandidates);
      }

      if (nextElement) {
        e.preventDefault();
        nextElement.focus();
        const siraliEkran = kayitliEkran(target);
        if (siraliEkran) sirayiKoru(target, nextElement, siraliEkran, siraliAdaylar);
        if (
          nextElement instanceof HTMLInputElement &&
          typeof nextElement.select === "function" &&
          nextElement.type !== "date" &&
          nextElement.type !== "checkbox" &&
          nextElement.type !== "radio"
        ) {
          nextElement.select();
        }
      }
    };

    void girisSirasiService.hazirla();
    const handleFocusIn = (e: FocusEvent) => {
      if (ekranAdi(e.target as Element | null)) void girisSirasiService.hazirla();
    };

    window.addEventListener("keydown", handleCaptureShortcuts, true);
    window.addEventListener("keydown", handleKeyDown, false);
    window.addEventListener("focusin", handleFocusIn, true);

    return () => {
      window.removeEventListener("keydown", handleCaptureShortcuts, true);
      window.removeEventListener("keydown", handleKeyDown, false);
      window.removeEventListener("focusin", handleFocusIn, true);
    };
  }, []);
};

export default useEnterNavigation;
