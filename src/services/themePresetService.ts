import { UserService } from "./userService";
import { AuthService } from "./authService";

export interface ThemePreset {
  id: string;
  name: string;
  badge: string;
  badgeColor: string;
  description: string;
  previewBg: string;
  previewText: string;
  previewAccent: string;
  previewFont: string;
  appearance: {
    enableProgramTheme?: boolean;
    programBgColor?: string;
    programTextColor?: string;
    programFont?: string;
    gridHeaderBgColor?: string;
    gridBgColor?: string;
    gridFont?: string;
    windowBgColor?: string;
    windowTextColor?: string;
    windowFocusColor?: string;

    enableMenuTheme?: boolean;
    menuBgColor?: string;
    menuSelectedBgColor?: string;
    menuFont?: string;
    menuHeaderBgColor?: string;
    menuHeaderFont?: string;
    menuBackdropColor?: string;

    enableBuyHeaderTheme?: boolean;
    buyHeaderBgColor?: string;
    buyHeaderTextColor?: string;

    enableSellHeaderTheme?: boolean;
    sellHeaderBgColor?: string;
    sellHeaderTextColor?: string;
  };
}

export const THEME_PRESETS: ThemePreset[] = [
  // 1. AÇIK MAVİ
  {
    id: "saas-slate-indigo",
    name: "Açık Mavi",
    badge: "Ferah",
    badgeColor: "primary",
    description: "Ferah açık mavi ekran, koyu lacivert yazılar ve canlı mavi vurgular",
    previewBg: "#eef6ff",
    previewText: "#0c2d57",
    previewAccent: "#1d4ed8",
    previewFont: "Plus Jakarta Sans, Inter, sans-serif",
    appearance: {
      enableProgramTheme: true,
      programBgColor: "#eef6ff",
      programTextColor: "#0c2d57",
      programFont: "Plus Jakarta Sans, Inter, sans-serif",
      gridHeaderBgColor: "#bfdbfe",
      gridBgColor: "#ffffff",
      gridFont: "Plus Jakarta Sans, sans-serif",
      windowBgColor: "#f8fbff",
      windowTextColor: "#0c2d57",
      windowFocusColor: "#1d4ed8",

      enableMenuTheme: true,
      menuBgColor: "#dbeafe",
      menuSelectedBgColor: "#1d4ed8",
      menuFont: "Plus Jakarta Sans, sans-serif",
      menuHeaderBgColor: "#1e3a8a",
      menuHeaderFont: "Plus Jakarta Sans, sans-serif",
      menuBackdropColor: "#93c5fd",

      enableBuyHeaderTheme: true,
      buyHeaderBgColor: "#dcfce7",
      buyHeaderTextColor: "#166534",

      enableSellHeaderTheme: true,
      sellHeaderBgColor: "#dbeafe",
      sellHeaderTextColor: "#1e40af",
    },
  },

  // 2. ALTIN SARISI
  {
    id: "snow-white-gold",
    name: "Altın Sarısı",
    badge: "Kuyumcu",
    badgeColor: "warning",
    description: "Sıcak krem zemin, altın sarısı başlıklar ve koyu kahve yazılar",
    previewBg: "#fef9e7",
    previewText: "#451a03",
    previewAccent: "#d97706",
    previewFont: "Outfit, sans-serif",
    appearance: {
      enableProgramTheme: true,
      programBgColor: "#fef9e7",
      programTextColor: "#451a03",
      programFont: "Outfit, sans-serif",
      gridHeaderBgColor: "#fde68a",
      gridBgColor: "#fffdf7",
      gridFont: "Outfit, sans-serif",
      windowBgColor: "#fffdf5",
      windowTextColor: "#451a03",
      windowFocusColor: "#d97706",

      enableMenuTheme: true,
      menuBgColor: "#fef3c7",
      menuSelectedBgColor: "#d97706",
      menuFont: "Outfit, sans-serif",
      menuHeaderBgColor: "#92400e",
      menuHeaderFont: "Outfit, sans-serif",
      menuBackdropColor: "#fcd34d",

      enableBuyHeaderTheme: true,
      buyHeaderBgColor: "#fef3c7",
      buyHeaderTextColor: "#92400e",

      enableSellHeaderTheme: true,
      sellHeaderBgColor: "#ffedd5",
      sellHeaderTextColor: "#c2410c",
    },
  },

  // 3. ZÜMRÜT YEŞİLİ
  {
    id: "corporate-blue",
    name: "Zümrüt Yeşili",
    badge: "Doğal",
    badgeColor: "success",
    description: "Göz yormayan nane yeşili ekran ve canlı zümrüt yeşili vurgular",
    previewBg: "#ecfdf5",
    previewText: "#064e3b",
    previewAccent: "#059669",
    previewFont: "Inter, sans-serif",
    appearance: {
      enableProgramTheme: true,
      programBgColor: "#ecfdf5",
      programTextColor: "#064e3b",
      programFont: "Inter, sans-serif",
      gridHeaderBgColor: "#a7f3d0",
      gridBgColor: "#ffffff",
      gridFont: "Inter, sans-serif",
      windowBgColor: "#f6fef9",
      windowTextColor: "#064e3b",
      windowFocusColor: "#059669",

      enableMenuTheme: true,
      menuBgColor: "#d1fae5",
      menuSelectedBgColor: "#059669",
      menuFont: "Inter, sans-serif",
      menuHeaderBgColor: "#065f46",
      menuHeaderFont: "Inter, sans-serif",
      menuBackdropColor: "#6ee7b7",

      enableBuyHeaderTheme: true,
      buyHeaderBgColor: "#d1fae5",
      buyHeaderTextColor: "#065f46",

      enableSellHeaderTheme: true,
      sellHeaderBgColor: "#fef9c3",
      sellHeaderTextColor: "#854d0e",
    },
  },

  // 4. SADE BEYAZ & GRİ
  {
    id: "delphi-classic",
    name: "Sade Beyaz & Gri",
    badge: "Klasik",
    badgeColor: "secondary",
    description: "Abartısız sade beyaz ve gri tonlar, net siyah yazılar",
    previewBg: "#f3f4f6",
    previewText: "#111827",
    previewAccent: "#374151",
    previewFont: "Tahoma, sans-serif",
    appearance: {
      enableProgramTheme: true,
      programBgColor: "#f3f4f6",
      programTextColor: "#111827",
      programFont: "Tahoma, sans-serif",
      gridHeaderBgColor: "#d1d5db",
      gridBgColor: "#ffffff",
      gridFont: "Tahoma, sans-serif",
      windowBgColor: "#ffffff",
      windowTextColor: "#111827",
      windowFocusColor: "#374151",

      enableMenuTheme: true,
      menuBgColor: "#e5e7eb",
      menuSelectedBgColor: "#374151",
      menuFont: "Tahoma, sans-serif",
      menuHeaderBgColor: "#1f2937",
      menuHeaderFont: "Tahoma, sans-serif",
      menuBackdropColor: "#9ca3af",

      enableBuyHeaderTheme: true,
      buyHeaderBgColor: "#e5e7eb",
      buyHeaderTextColor: "#111827",

      enableSellHeaderTheme: true,
      sellHeaderBgColor: "#f3f4f6",
      sellHeaderTextColor: "#374151",
    },
  },

  // 5. GÜL KURUSU & PEMBE
  {
    id: "rose-luxury",
    name: "Gül Kurusu & Pembe",
    badge: "Şık",
    badgeColor: "danger",
    description: "Yumuşak pembe zemin, gül kurusu menü ve koyu bordo yazılar",
    previewBg: "#fff1f2",
    previewText: "#4c0519",
    previewAccent: "#e11d48",
    previewFont: "Playfair Display, Georgia, serif",
    appearance: {
      enableProgramTheme: true,
      programBgColor: "#fff1f2",
      programTextColor: "#4c0519",
      programFont: "Playfair Display, Georgia, serif",
      gridHeaderBgColor: "#fecdd3",
      gridBgColor: "#ffffff",
      gridFont: "Playfair Display, serif",
      windowBgColor: "#fff8f9",
      windowTextColor: "#4c0519",
      windowFocusColor: "#e11d48",

      enableMenuTheme: true,
      menuBgColor: "#ffe4e6",
      menuSelectedBgColor: "#e11d48",
      menuFont: "Playfair Display, serif",
      menuHeaderBgColor: "#9f1239",
      menuHeaderFont: "Playfair Display, serif",
      menuBackdropColor: "#fda4af",

      enableBuyHeaderTheme: true,
      buyHeaderBgColor: "#ffe4e6",
      buyHeaderTextColor: "#9f1239",

      enableSellHeaderTheme: true,
      sellHeaderBgColor: "#ffedd5",
      sellHeaderTextColor: "#9a3412",
    },
  },

  // 6. MOR & LAVANTA
  {
    id: "purple-lavender",
    name: "Mor & Lavanta",
    badge: "Özel",
    badgeColor: "info",
    description: "Yumuşak lavanta ekran, canlı mor menü ve koyu mor yazılar",
    previewBg: "#f5f3ff",
    previewText: "#2e1065",
    previewAccent: "#7c3aed",
    previewFont: "Plus Jakarta Sans, sans-serif",
    appearance: {
      enableProgramTheme: true,
      programBgColor: "#f5f3ff",
      programTextColor: "#2e1065",
      programFont: "Plus Jakarta Sans, sans-serif",
      gridHeaderBgColor: "#ddd6fe",
      gridBgColor: "#ffffff",
      gridFont: "Plus Jakarta Sans, sans-serif",
      windowBgColor: "#faf8ff",
      windowTextColor: "#2e1065",
      windowFocusColor: "#7c3aed",

      enableMenuTheme: true,
      menuBgColor: "#ede9fe",
      menuSelectedBgColor: "#7c3aed",
      menuFont: "Plus Jakarta Sans, sans-serif",
      menuHeaderBgColor: "#4c1d95",
      menuHeaderFont: "Plus Jakarta Sans, sans-serif",
      menuBackdropColor: "#c4b5fd",

      enableBuyHeaderTheme: true,
      buyHeaderBgColor: "#ede9fe",
      buyHeaderTextColor: "#5b21b6",

      enableSellHeaderTheme: true,
      sellHeaderBgColor: "#fce7f3",
      sellHeaderTextColor: "#9d174d",
    },
  },
];

/**
 * Finds the matching preset ID based on current appearance or saved ID
 */
export function getActivePresetId(appearance?: any): string {
  if (typeof window !== "undefined") {
    const savedId = localStorage.getItem("kuyumcu_active_theme_id");
    if (savedId && THEME_PRESETS.some((p) => p.id === savedId)) {
      return savedId;
    }
  }

  if (!appearance) return "saas-slate-indigo";

  // Match by colors
  const matched = THEME_PRESETS.find(
    (p) =>
      p.appearance.programBgColor?.toLowerCase() === appearance.programBgColor?.toLowerCase() &&
      p.appearance.menuSelectedBgColor?.toLowerCase() === appearance.menuSelectedBgColor?.toLowerCase()
  );

  return matched ? matched.id : "saas-slate-indigo";
}

/**
 * Applies a theme preset instantly:
 * 1. Writes to localStorage (appearance + active theme id + pano background)
 * 2. Emits kuyumcu_preview_appearance for instant 0ms DOM update
 * 3. Persists to backend via UserService.updateMyAppearance
 * 4. Refreshes auth profile
 */
export async function applyThemePreset(
  preset: ThemePreset,
  currentUserAppearance?: any,
  refreshUser?: () => Promise<void>
): Promise<void> {
  if (!preset.appearance) return;

  const newAppearance = {
    ...currentUserAppearance,
    ...preset.appearance,
  };

  // 1. Local Storage immediate save
  try {
    localStorage.setItem("kuyumcu_active_appearance", JSON.stringify(newAppearance));
    localStorage.setItem("kuyumcu_active_theme_id", preset.id);
    if (newAppearance.programBgColor) {
      localStorage.setItem("pano_active_theme_bg", newAppearance.programBgColor);
    }
    const storedUser = AuthService.getUser();
    if (storedUser) {
      storedUser.appearance = newAppearance;
      localStorage.setItem("kuyumcu_erp_user", JSON.stringify(storedUser));
    }
  } catch (e) {
    console.warn("Theme storage error:", e);
  }

  // 2. Broadcast to UserThemeApplier (0ms instant DOM styling)
  window.dispatchEvent(
    new CustomEvent("kuyumcu_preview_appearance", { detail: newAppearance })
  );

  // 3. Persist to backend database (TODVZ_KULLANICI)
  try {
    await UserService.updateMyAppearance(newAppearance);
    if (refreshUser) {
      await refreshUser();
    }
  } catch (err) {
    console.warn("Backend theme save error:", err);
  }
}

/**
 * Applies custom appearance fields:
 */
export async function applyCustomAppearance(
  newAppearance: any,
  refreshUser?: () => Promise<void>
): Promise<void> {
  try {
    localStorage.setItem("kuyumcu_active_appearance", JSON.stringify(newAppearance));
    if (newAppearance.programBgColor) {
      localStorage.setItem("pano_active_theme_bg", newAppearance.programBgColor);
    }
    const storedUser = AuthService.getUser();
    if (storedUser) {
      storedUser.appearance = newAppearance;
      localStorage.setItem("kuyumcu_erp_user", JSON.stringify(storedUser));
    }
  } catch (e) {
    console.warn("Appearance storage error:", e);
  }

  window.dispatchEvent(
    new CustomEvent("kuyumcu_preview_appearance", { detail: newAppearance })
  );

  try {
    await UserService.updateMyAppearance(newAppearance);
    if (refreshUser) {
      await refreshUser();
    }
  } catch (err) {
    console.warn("Backend appearance save error:", err);
  }
}
