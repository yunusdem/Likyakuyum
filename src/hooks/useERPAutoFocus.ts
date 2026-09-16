import { useEffect, RefObject } from "react";

interface AutoFocusOptions {
  /**
   * İsteğe bağlı belirli bir alan seçici (örneğin 'input[name="kod"]' veya '#cariKod')
   */
  preferredSelector?: string;
  /**
   * Yükleme durumu bittiğinde tetiklenmesi için bağımlılıklar
   */
  dependencies?: any[];
  /**
   * Odaklanma gecikmesi (ms)
   */
  delay?: number;
  /**
   * Kapsayıcı ref (tüm sayfa yerine belirli bir form/kart içinde aramak için)
   */
  containerRef?: RefObject<HTMLElement | null>;
}

export const useERPAutoFocus = (options: AutoFocusOptions = {}) => {
  const { preferredSelector, dependencies = [], delay = 100, containerRef } = options;

  useEffect(() => {
    const timer = setTimeout(() => {
      const root = containerRef?.current || document;

      // 1. Tercih edilen seçici varsa önce onu dene
      if (preferredSelector) {
        const preferredEl = root.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
          preferredSelector
        );
        const isReadOnly = preferredEl && "readOnly" in preferredEl && Boolean((preferredEl as HTMLInputElement).readOnly);
        if (preferredEl && !preferredEl.disabled && !isReadOnly && preferredEl.offsetParent !== null) {
          preferredEl.focus();
          if ("select" in preferredEl && typeof preferredEl.select === "function" && (preferredEl as HTMLInputElement).type !== "checkbox" && (preferredEl as HTMLInputElement).type !== "radio") {
            preferredEl.select();
          }
          return;
        }
      }

      // 2. Sayfadaki tüm görünür, düzenlenebilir input/select/textarea elemanlarını bul
      const candidates = Array.from(
        root.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
          'input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]):not([disabled]):not([readonly]), select:not([disabled]):not([readonly]), textarea:not([disabled]):not([readonly])'
        )
      ).filter((el) => el.offsetParent !== null); // görünür olanlar

      if (candidates.length === 0) return;

      // 3. İlk boş olanı tercih et; hepsi doluysa ilk etkin olanı al
      const firstEmpty = candidates.find((el) => !el.value || el.value.trim() === "");
      const target = firstEmpty || candidates[0];

      if (target) {
        target.focus();
        if ("select" in target && typeof target.select === "function") {
          target.select();
        }
      }
    }, delay);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preferredSelector, delay, ...dependencies]);
};

export default useERPAutoFocus;
