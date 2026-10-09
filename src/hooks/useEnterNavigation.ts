import { useEffect } from "react";

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

/**
 * Global Enter-to-Next-Field hook
 * Allows ERP-style navigation across input/select fields using Enter key.
 */
export const useEnterNavigation = () => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as Element;
      if (!target || !('tagName' in target)) return;
      const tagName = (target.tagName || "").toLowerCase();

      // ─── 1. Space Tuşu: Tüm select / combobox alanlarını açar ──────────────────
      if (e.key === " " || e.code === "Space") {
        if (tagName === "select" || target.classList.contains("form-select") || target.getAttribute("role") === "combobox") {
          if (tagName === "select") {
            const sel = target as HTMLSelectElement;
            if (typeof (sel as any).showPicker === "function") {
              e.preventDefault();
              try {
                (sel as any).showPicker();
              } catch {
                // If already open or showPicker throws
              }
              return;
            }
          }
        }
      }

      // ─── 2. " Tuşu: Tüm tablolarda üst satırdaki aynı sütunun değerini kopyalar ───
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

      // Don't intercept Enter on textareas (allows multi-line text)
      if (tagName === "textarea") return;

      // Don't intercept inside modal dialogs (modals manage their own keyboard focus & confirm actions)
      if (target.closest(".modal") || target.closest(".modal-content")) return;

      // Don't intercept if element manages its own custom Enter behavior (e.g. data grid)
      if (target.getAttribute("data-custom-enter") === "true") return;

      // Don't intercept Enter on buttons or submit inputs
      if (
        tagName === "button" ||
        (tagName === "input" && (target as HTMLInputElement).type === "submit")
      ) {
        return;
      }

      // Only handle input and select
      if (tagName !== "input" && tagName !== "select") return;

      // Scope search to closest modal, form, or document body
      const container =
        target.closest(".modal-content") ||
        target.closest("form") ||
        document.body;

      // Find all focusable input and select fields
      const selector =
        'input:not([type="hidden"]):not([disabled]):not([readonly]), select:not([disabled]):not([readonly])';

      const allElements = Array.from(
        container.querySelectorAll<HTMLElement>(selector)
      );

      // Filter visible elements only
      const visibleElements = allElements.filter((el) => {
        return el.offsetParent !== null && !el.hasAttribute("aria-hidden");
      });

      const currentIndex = visibleElements.indexOf(target);
      if (currentIndex >= 0 && currentIndex < visibleElements.length - 1) {
        e.preventDefault();
        const nextElement = visibleElements[currentIndex + 1];
        nextElement.focus();
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

    window.addEventListener("keydown", handleKeyDown, true);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, []);
};

export default useEnterNavigation;
