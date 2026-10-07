/**
 * ERP Shortcut Utility: Triggers the adjacent binoculars / lookup button
 * when the user presses F12 on an input field.
 */
export const triggerAdjacentBinoculars = (activeEl: HTMLElement | null): boolean => {
  if (!activeEl) return false;

  // If focus is on an input, select, or textarea
  const isFormEl = ["INPUT", "SELECT", "TEXTAREA"].includes(activeEl.tagName) || activeEl.isContentEditable;
  if (!isFormEl) return false;

  // 1. Check parent container (input-group, d-flex, td, form-group, etc.)
  const container = activeEl.closest(".input-group, .d-flex, td, tr, .form-group, .position-relative, div");
  if (container) {
    const buttons = Array.from(container.querySelectorAll<HTMLButtonElement>("button, [role='button'], .btn"));
    for (const btn of buttons) {
      if (btn === activeEl || btn.disabled) continue;

      const hasBinocularsIcon = btn.querySelector(".tabler-icon-binoculars") !== null ||
        btn.querySelector("svg") !== null;
      const titleMatches = Boolean(
        btn.title && /ara|seç|bul|lookup|müşteri|cari|ürün|banka|pos|iskonto|istatistik|kod|hesap/i.test(btn.title)
      );
      const ariaMatches = Boolean(
        btn.getAttribute("aria-label") && /ara|seç|bul|lookup/i.test(btn.getAttribute("aria-label") || "")
      );

      if (hasBinocularsIcon || titleMatches || ariaMatches) {
        btn.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, view: window }));
        btn.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, view: window }));
        btn.click();
        return true;
      }
    }
  }

  // 2. Check next siblings directly
  let sibling: Element | null = activeEl.nextElementSibling;
  while (sibling) {
    if (sibling.tagName === "BUTTON" || sibling.classList.contains("btn")) {
      const btn = sibling as HTMLButtonElement;
      if (!btn.disabled) {
        btn.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, view: window }));
        btn.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, view: window }));
        btn.click();
        return true;
      }
    }
    const innerBtn = sibling.querySelector<HTMLButtonElement>("button, .btn");
    if (innerBtn && !innerBtn.disabled) {
      innerBtn.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, view: window }));
      innerBtn.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, view: window }));
      innerBtn.click();
      return true;
    }
    sibling = sibling.nextElementSibling;
  }

  return false;
};
