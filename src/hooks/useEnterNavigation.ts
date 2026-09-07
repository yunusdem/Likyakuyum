import { useEffect } from "react";

/**
 * Global Enter-to-Next-Field hook
 * Allows ERP-style navigation across input/select fields using Enter key.
 */
export const useEnterNavigation = () => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Enter") return;

      const target = e.target as HTMLElement;
      if (!target) return;

      const tagName = target.tagName.toLowerCase();

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
