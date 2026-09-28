/**
 * Tüm sayfalardaki HTML <select> / Form.Select ve Dropdown / Combobox elemanlarında
 * Boşluk (Space) tuşuna basıldığında açılır menünün (dropdown popup)
 * açılmasını tamamen engelleyip, sıradaki seçeneğin doğrudan seçilmesini ve
 * en sondaysa tekrar başa dönülmesini sağlar.
 * 
 * Mouse ile tıklandığında ise normal açılır menü açılmaya devam eder.
 */
export function initGlobalSelectSpaceInterceptor() {
  if (typeof window === "undefined") return;

  const handleSpace = (e: KeyboardEvent) => {
    // Sadece standart Boşluk (Space) tuşu kontrol edilir (Ctrl, Alt, Meta olmadan)
    if (
      (e.key === " " || e.code === "Space" || e.keyCode === 32) &&
      !e.ctrlKey &&
      !e.altKey &&
      !e.metaKey
    ) {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      // 1. Hedef bir HTML <select> / Form.Select elemanı ise
      if (target.tagName === "SELECT" || target instanceof HTMLSelectElement) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        if (e.type === "keydown") {
          const selectEl = target as HTMLSelectElement;
          const options = Array.from(selectEl.options).filter((opt) => !opt.disabled);
          if (options.length <= 1) return;

          const currentIdx = options.findIndex(
            (opt) => opt.value === selectEl.value || opt.selected
          );
          const nextIdx = currentIdx < 0 || currentIdx >= options.length - 1 ? 0 : currentIdx + 1;
          const nextOption = options[nextIdx];

          if (nextOption) {
            // React Controlled Component uyumluluğu için native prototype setter çağrılır
            const nativeSelectValueSetter = Object.getOwnPropertyDescriptor(
              window.HTMLSelectElement.prototype,
              "value"
            )?.set;

            if (nativeSelectValueSetter) {
              nativeSelectValueSetter.call(selectEl, nextOption.value);
            } else {
              selectEl.value = nextOption.value;
            }

            selectEl.selectedIndex = Array.from(selectEl.options).indexOf(nextOption);

            selectEl.dispatchEvent(new Event("input", { bubbles: true }));
            selectEl.dispatchEvent(new Event("change", { bubbles: true }));

            // Tarayıcının işletim sistemi düzeyindeki popup menüsünü engellemek için blur/focus döngüsü
            try {
              selectEl.blur();
              selectEl.focus();
            } catch {}
          }
        }
        return;
      }

      // 2. Hedef bir Bootstrap Dropdown Toggle veya custom Combobox / Select butonu ise
      const toggleBtn = target.closest<HTMLElement>(
        ".dropdown-toggle, [data-bs-toggle='dropdown'], [role='combobox'], .form-select"
      );
      if (toggleBtn) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        if (e.type === "keydown") {
          const dropdownContainer = toggleBtn.closest<HTMLElement>(".dropdown, [data-dropdown]") || toggleBtn.parentElement;
          if (dropdownContainer) {
            const menuItems = Array.from(
              dropdownContainer.querySelectorAll<HTMLElement>(
                ".dropdown-item:not(.disabled):not(:disabled), [role='option']:not([aria-disabled='true'])"
              )
            );

            if (menuItems.length > 0) {
              const activeIdx = menuItems.findIndex(
                (it) => it.classList.contains("active") || it.getAttribute("aria-selected") === "true"
              );
              const nextIdx = activeIdx < 0 || activeIdx >= menuItems.length - 1 ? 0 : activeIdx + 1;
              menuItems[nextIdx]?.click();
            }
          }
        }
        return;
      }
    }
  };

  // Capture aşamasında (true) ve passive: false ile tarayıcı menü açılışını engelle
  window.addEventListener("keydown", handleSpace, { capture: true, passive: false });
  window.addEventListener("keypress", handleSpace, { capture: true, passive: false });
  window.addEventListener("keyup", handleSpace, { capture: true, passive: false });
}
