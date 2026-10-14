/**
 * Global Keyboard Shortcut Utilities for Likya Kuyum ERP
 */

/**
 * Checks if the given keyboard event represents Ctrl+N (or Cmd+N on macOS).
 * Supports:
 * - Windows / Linux: Ctrl+N, Ctrl+n
 * - Mac: Control+N, Cmd+N (metaKey)
 * - Turkish and international keyboard layouts
 * - Case-insensitive and code-based matching
 * - Rejects Alt / AltGr combinations
 */
export const isCtrlNEvent = (e: KeyboardEvent): boolean => {
  if (!e.ctrlKey && !e.metaKey) return false;
  if (e.altKey) return false;

  const key = (e.key || "").toLowerCase();
  if (key === "n") return true;
  if (e.code === "KeyN") return true;
  if (e.keyCode === 78 || e.which === 78) return true;

  return false;
};

/**
 * Universally triggers the "Yeni Kayıt" / "Yeni Fiş" / "Yeni" action across any page.
 * Returns true if an action button was found and clicked, or an event was dispatched.
 */
export const triggerGlobalNewRecord = (): boolean => {
  // 1. If an active modal is open, check if it has a "Yeni Kayıt" button
  const openModal = document.querySelector(".modal.show, .modal[style*='display: block']");
  if (openModal) {
    const modalNewBtn = openModal.querySelector<HTMLElement>(
      "button[data-action='new']:not([disabled]), " +
      "button[title*='Yeni' i]:not([disabled]), " +
      "button[aria-label*='Yeni' i]:not([disabled]), " +
      ".btn-success:not([disabled])"
    );
    if (modalNewBtn && (modalNewBtn.textContent || "").toLowerCase().includes("yeni")) {
      modalNewBtn.click();
      return true;
    }
  }

  // 2. Check ERPToolbar's "Yeni Kayıt" button
  const erpNewBtn = document.querySelector<HTMLElement>(
    "button.erp-tb-btn[title*='Yeni Kayıt' i]:not([disabled]), " +
    "button.erp-tb-btn[aria-label*='Yeni Kayıt' i]:not([disabled]), " +
    "button.erp-tb-btn[data-action='new']:not([disabled])"
  );
  if (erpNewBtn) {
    erpNewBtn.click();
    return true;
  }

  // 3. Check any standard page button with title/aria-label/data-action
  const pageNewBtn = document.querySelector<HTMLElement>(
    "button[data-action='new']:not([disabled]), " +
    "button[title*='Yeni Kayıt' i]:not([disabled]), " +
    "button[aria-label*='Yeni Kayıt' i]:not([disabled]), " +
    "button[title*='Yeni Fiş' i]:not([disabled]), " +
    "button[aria-label*='Yeni Fiş' i]:not([disabled]), " +
    "button[title*='Yeni Kart' i]:not([disabled]), " +
    "button[aria-label*='Yeni Kart' i]:not([disabled]), " +
    "a[data-action='new']:not([disabled]), " +
    "a[title*='Yeni Kayıt' i]:not([disabled])"
  );
  if (pageNewBtn) {
    pageNewBtn.click();
    return true;
  }

  // 4. Look for visible buttons containing text "Yeni Kayıt" / "Yeni Fiş" / "Yeni Kart" / "+ Yeni"
  const allButtons = Array.from(
    document.querySelectorAll<HTMLElement>("button:not([disabled]), a.btn:not([disabled])")
  );
  const textBtn = allButtons.find((btn) => {
    if (btn.offsetParent === null) return false;
    const txt = (btn.textContent || "").trim().toLowerCase();
    return (
      txt === "yeni kayıt" ||
      txt === "yeni fiş" ||
      txt === "yeni kart" ||
      txt === "yeni hesap" ||
      txt.startsWith("+ yeni") ||
      txt === "yeni"
    );
  });
  if (textBtn) {
    textBtn.click();
    return true;
  }

  // 5. Dispatch custom event for pages or forms listening to 'erp:new-record'
  window.dispatchEvent(new CustomEvent("erp:new-record", { cancelable: true }));
  return false;
};
