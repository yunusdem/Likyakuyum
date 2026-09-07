import React, { useEffect } from "react";
import { useAuth } from "../../context/AuthContext";

/**
 * Calculates readable contrast text color (dark or light) based on background luminance
 */
export function getContrastColor(hex?: string, fallback = "#0f172a"): string {
  if (!hex) return fallback;
  const str = hex.replace("#", "").trim();
  if (str.length === 6) {
    const r = parseInt(str.substring(0, 2), 16) || 0;
    const g = parseInt(str.substring(2, 4), 16) || 0;
    const b = parseInt(str.substring(4, 6), 16) || 0;
    const yiq = (r * 299 + g * 587 + b * 114) / 1000;
    return yiq >= 140 ? "#0f172a" : "#f8fafc";
  }
  return fallback;
}

/**
 * Directly writes CSS custom properties to document.documentElement (instant, 0ms lag, zero React state re-render conflicts)
 */
export function applyAppearanceToDOM(appearance?: any) {
  if (!appearance) return;
  const root = document.documentElement;

  // 1. Program & Typography
  if (appearance.programBgColor) {
    root.style.setProperty("--user-program-bg", appearance.programBgColor);
    document.body.style.backgroundColor = appearance.programBgColor;
  }
  if (appearance.programTextColor) {
    root.style.setProperty("--user-program-text", appearance.programTextColor);
    document.body.style.color = appearance.programTextColor;
  }
  if (appearance.programFont) {
    root.style.setProperty("--user-program-font", appearance.programFont);
    document.body.style.fontFamily = appearance.programFont;
  }

  // 2. Windows & Panels
  if (appearance.windowBgColor) {
    root.style.setProperty("--user-window-bg", appearance.windowBgColor);
  }
  if (appearance.windowTextColor) {
    root.style.setProperty("--user-window-text", appearance.windowTextColor);
  }
  if (appearance.windowFocusColor) {
    root.style.setProperty("--user-window-focus", appearance.windowFocusColor);
  }

  // 3. Grid & Data Tables
  if (appearance.gridHeaderBgColor) {
    root.style.setProperty("--user-grid-header-bg", appearance.gridHeaderBgColor);
    root.style.setProperty("--user-grid-header-text", getContrastColor(appearance.gridHeaderBgColor, "#0f172a"));
  }
  if (appearance.gridBgColor) {
    root.style.setProperty("--user-grid-bg", appearance.gridBgColor);
    root.style.setProperty("--user-grid-text", appearance.programTextColor || getContrastColor(appearance.gridBgColor, "#0f172a"));
  }
  if (appearance.gridFont) {
    root.style.setProperty("--user-grid-font", appearance.gridFont);
  }

  // 4. Menu & Sidebar
  if (appearance.menuBgColor) {
    root.style.setProperty("--user-menu-bg", appearance.menuBgColor);
    root.style.setProperty("--user-menu-text", getContrastColor(appearance.menuBgColor, "#0f172a"));
  }
  if (appearance.menuSelectedBgColor) {
    root.style.setProperty("--user-menu-selected-bg", appearance.menuSelectedBgColor);
    root.style.setProperty("--user-menu-selected-text", getContrastColor(appearance.menuSelectedBgColor, "#ffffff"));
    root.style.setProperty("--bs-primary", appearance.menuSelectedBgColor);
  }
  if (appearance.menuFont) {
    root.style.setProperty("--user-menu-font", appearance.menuFont);
  }
  if (appearance.menuHeaderBgColor) {
    root.style.setProperty("--user-menu-header-bg", appearance.menuHeaderBgColor);
    root.style.setProperty("--user-menu-header-text", getContrastColor(appearance.menuHeaderBgColor, "#ffffff"));
  }
  if (appearance.menuHeaderFont) {
    root.style.setProperty("--user-menu-header-font", appearance.menuHeaderFont);
  }
  if (appearance.menuBackdropColor) {
    root.style.setProperty("--user-menu-backdrop", appearance.menuBackdropColor);
  }

  // 5. Buy & Sell Headers
  if (appearance.buyHeaderBgColor) {
    root.style.setProperty("--user-buy-header-bg", appearance.buyHeaderBgColor);
  }
  if (appearance.buyHeaderTextColor) {
    root.style.setProperty("--user-buy-header-text", appearance.buyHeaderTextColor);
  }
  if (appearance.sellHeaderBgColor) {
    root.style.setProperty("--user-sell-header-bg", appearance.sellHeaderBgColor);
  }
  if (appearance.sellHeaderTextColor) {
    root.style.setProperty("--user-sell-header-text", appearance.sellHeaderTextColor);
  }
}


/**
 * Enterprise Theme Applier for Kuyumcu ERP
 * Dynamically applies the logged-in user's Appearance (colors, fonts, grids, menus, headers)
 * configured in /ayarlar/kullanici-tanimlari (TODVZ_KULLANICI) across the entire application.
 */
export const UserThemeApplier: React.FC = () => {
  const { user } = useAuth();

  useEffect(() => {
    // Apply initial user theme on mount and when auth user changes
    if (user?.appearance) {
      applyAppearanceToDOM(user.appearance);
    }
  }, [user?.appearance]);

  useEffect(() => {
    // Global listener for live theme events (direct DOM manipulation, no React state conflict)
    const handlePreview = (e: CustomEvent) => {
      if (e.detail) {
        applyAppearanceToDOM(e.detail);
      }
    };
    window.addEventListener("kuyumcu_preview_appearance" as any, handlePreview);
    return () => {
      window.removeEventListener("kuyumcu_preview_appearance" as any, handlePreview);
    };
  }, []);

  return (
    <style>{`
      /* ─────────────────────────────────────────────────────────────
         COMPREHENSIVE DYNAMIC THEME STYLES (TODVZ_KULLANICI)
         ───────────────────────────────────────────────────────────── */

      /* 1. Global Typography & Base Body */
      html,
      body, 
      .dashboard-layout-root, 
      #content, 
      .custom-container, 
      main,
      .company-definitions-container,
      .user-definitions-container {
        font-family: var(--user-program-font, "Segoe UI", "Inter", -apple-system, BlinkMacSystemFont, sans-serif) !important;
        background-color: var(--user-program-bg, #f8fafc) !important;
        color: var(--user-program-text, #0f172a) !important;
      }

      /* 2. Top Header / Navbar */
      #content > nav.navbar,
      .navbar,
      .top-header,
      header {
        background-color: var(--user-window-bg, #ffffff) !important;
        color: var(--user-window-text, #0f172a) !important;
        border-color: rgba(128, 128, 128, 0.15) !important;
      }
      #content > nav.navbar .nav-link,
      #content > nav.navbar .btn,
      #content > nav.navbar .text-dark,
      #content > nav.navbar span {
        color: var(--user-window-text, #0f172a) !important;
      }

      /* 3. Cards, Windows, Panels & Modals */
      .card,
      .card-body,
      .modal-content, 
      .modal-body,
      .modal-header,
      .modal-footer,
      .offcanvas,
      .dropdown-menu,
      .bg-white,
      .bg-body {
        background-color: var(--user-window-bg, #ffffff) !important;
        color: var(--user-window-text, #0f172a) !important;
        font-family: var(--user-program-font, inherit) !important;
      }

      /* Headings & Text within Windows */
      .card h1, .card h2, .card h3, .card h4, .card h5, .card h6,
      .card .h1, .card .h2, .card .h3, .card .h4, .card .h5, .card .h6,
      .card .text-dark,
      .modal h1, .modal h2, .modal h3, .modal h4, .modal h5, .modal h6,
      .modal .text-dark,
      .form-label,
      .form-check-label {
        color: var(--user-window-text, #0f172a) !important;
      }

      /* Secondary/Muted Text */
      .text-secondary,
      .text-muted {
        opacity: 0.85;
      }

      /* 4. Form Inputs & Selects */
      .form-control, 
      .form-select,
      .input-group-text {
        background-color: var(--user-window-bg, #ffffff) !important;
        color: var(--user-window-text, #0f172a) !important;
        border-color: rgba(128, 128, 128, 0.25) !important;
        font-family: var(--user-program-font, inherit) !important;
      }

      /* Input Focus Color */
      .form-control:focus, 
      .form-select:focus {
        border-color: var(--user-window-focus, #3b82f6) !important;
        box-shadow: 0 0 0 0.2rem rgba(59, 130, 246, 0.25) !important;
      }

      /* 5. Grids & Data Tables */
      table, 
      .table {
        background-color: var(--user-grid-bg, #ffffff) !important;
        font-family: var(--user-grid-font, var(--user-program-font, inherit)) !important;
        color: var(--user-grid-text, inherit) !important;
      }

      table th, 
      .table th, 
      table thead th, 
      .table thead th, 
      .table-light th,
      .table thead tr {
        background-color: var(--user-grid-header-bg, #cbe5ff) !important;
        color: var(--user-grid-header-text, #0f172a) !important;
        font-family: var(--user-grid-font, var(--user-program-font, inherit)) !important;
        font-weight: 600 !important;
        border-color: rgba(128, 128, 128, 0.2) !important;
      }

      table td, 
      .table td, 
      table tbody td, 
      .table tbody td,
      .table-striped > tbody > tr:nth-of-type(odd) > * {
        background-color: var(--user-grid-bg, #ffffff) !important;
        color: var(--user-grid-text, #0f172a) !important;
        font-family: var(--user-grid-font, var(--user-program-font, inherit)) !important;
        border-color: rgba(128, 128, 128, 0.15) !important;
      }

      /* 6. Sidebar & Menu Theme */
      #miniSidebar {
        background-color: var(--user-menu-bg, #ffffff) !important;
        font-family: var(--user-menu-font, var(--user-program-font, inherit)) !important;
        color: var(--user-menu-text, #0f172a) !important;
        border-color: rgba(128, 128, 128, 0.15) !important;
      }

      #miniSidebar .brand-logo {
        background-color: var(--user-menu-header-bg, var(--user-menu-bg, #ffffff)) !important;
        border-bottom: 1px solid rgba(128, 128, 128, 0.15);
      }

      #miniSidebar .brand-logo .site-logo-text:not(.gold-logo-text) {
        font-family: var(--user-menu-header-font, var(--user-menu-font, inherit)) !important;
        color: var(--user-menu-header-text, var(--user-menu-text, #0f172a)) !important;
      }

      #miniSidebar .nav-link,
      #miniSidebar .dropdown-toggle,
      #miniSidebar .accordion-button,
      #miniSidebar .nav-heading {
        font-family: var(--user-menu-font, var(--user-program-font, inherit)) !important;
        color: var(--user-menu-text, #0f172a) !important;
      }

      #miniSidebar .nav-link:hover,
      #miniSidebar .dropdown-toggle:hover {
        background-color: rgba(128, 128, 128, 0.08) !important;
      }

      #miniSidebar .nav-link.active,
      #miniSidebar .nav-link.active .text,
      #miniSidebar .nav-link.active span,
      #miniSidebar .nav-link.active svg,
      #miniSidebar .dropdown-item.active {
        background-color: var(--user-menu-selected-bg, #0284c7) !important;
        color: var(--user-menu-selected-text, #ffffff) !important;
        border-radius: 6px !important;
        outline: none !important;
        border: none !important;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.12) !important;
      }

      #miniSidebar .dropdown-menu {
        background-color: transparent !important;
      }

      #miniSidebar .upgrade-ui,
      #miniSidebar .upgrade-ui > div {
        background-color: var(--user-menu-bg, #ffffff) !important;
        color: var(--user-menu-text, #0f172a) !important;
      }

      #miniSidebar .upgrade-ui h6,
      #miniSidebar .upgrade-ui span {
        color: var(--user-menu-text, #0f172a) !important;
      }

      .sidebar-backdrop {
        background-color: var(--user-menu-backdrop, rgba(0, 0, 0, 0.5)) !important;
      }

      /* 7. Definition Pages (Ürün, Vezne, Yazıcı Tanımları) Theme Integration */
      .list-group-item.active,
      .list-group-item.active.bg-primary {
        background-color: var(--user-menu-selected-bg, var(--user-window-focus, #0284c7)) !important;
        border-color: var(--user-menu-selected-bg, var(--user-window-focus, #0284c7)) !important;
        color: var(--user-menu-selected-text, #ffffff) !important;
      }

      .list-group-item.active div,
      .list-group-item.active span:not(.badge),
      .list-group-item.active strong {
        color: var(--user-menu-selected-text, #ffffff) !important;
      }

      .nav-pills .nav-link.active {
        background-color: var(--user-menu-selected-bg, var(--user-window-focus, #0284c7)) !important;
        color: var(--user-menu-selected-text, #ffffff) !important;
      }

      .text-primary,
      h6.text-primary,
      h5.text-primary {
        color: var(--user-menu-selected-bg, var(--user-window-focus, #0284c7)) !important;
      }

      .badge.bg-primary {
        background-color: var(--user-menu-selected-bg, var(--user-window-focus, #0284c7)) !important;
        color: var(--user-menu-selected-text, #ffffff) !important;
      }

      /* 8. Action Toolbar & Tabs */
      .erp-action-toolbar-wrapper,
      .erp-action-toolbar-wrapper .card {
        background-color: var(--user-window-bg, #ffffff) !important;
        border-color: rgba(128, 128, 128, 0.2) !important;
      }

      .nav-tabs {
        border-color: rgba(128, 128, 128, 0.2) !important;
      }
      .nav-tabs .nav-link {
        color: var(--user-window-text, inherit) !important;
      }
      .nav-tabs .nav-link.active {
        background-color: var(--user-window-bg, #ffffff) !important;
        color: var(--user-window-focus, #0284c7) !important;
        border-color: rgba(128, 128, 128, 0.2) rgba(128, 128, 128, 0.2) var(--user-window-bg, #ffffff) !important;
      }

      /* 9. Buy & Sell Slip Headers */
      .buy-header, 
      [data-theme-role="buy-header"] {
        background-color: var(--user-buy-header-bg, #f0fdf4) !important;
        color: var(--user-buy-header-text, #166534) !important;
      }

      .sell-header, 
      [data-theme-role="sell-header"] {
        background-color: var(--user-sell-header-bg, #fef3c7) !important;
        color: var(--user-sell-header-text, #92400e) !important;
      }

    `}</style>
  );
};

export default UserThemeApplier;
