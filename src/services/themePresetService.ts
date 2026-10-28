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
  // 1. MODERN KURUMSAL VE SAAS (Slate & Indigo)
  {
    id: "saas-slate-indigo",
    name: "Modern Kurumsal & SaaS (Slate & Indigo)",
    badge: "SaaS Popüler",
    badgeColor: "primary",
    description: "Slate arkaplan, Indigo (#6366f1) vurgular, ferah paneller ve Plus Jakarta Sans fontu",
    previewBg: "#f8fafc",
    previewText: "#0f172a",
    previewAccent: "#6366f1",
    previewFont: "Plus Jakarta Sans, Inter, sans-serif",
    appearance: {
      enableProgramTheme: true,
      programBgColor: "#f8fafc",
      programTextColor: "#0f172a",
      programFont: "Plus Jakarta Sans, Inter, sans-serif",
      gridHeaderBgColor: "#e2e8f0",
      gridBgColor: "#ffffff",
      gridFont: "Plus Jakarta Sans, sans-serif",
      windowBgColor: "#ffffff",
      windowTextColor: "#0f172a",
      windowFocusColor: "#6366f1",

      enableMenuTheme: true,
      menuBgColor: "#ffffff",
      menuSelectedBgColor: "#6366f1",
      menuFont: "Plus Jakarta Sans, sans-serif",
      menuHeaderBgColor: "#0f172a",
      menuHeaderFont: "Plus Jakarta Sans, sans-serif",
      menuBackdropColor: "#0f172a",

      enableBuyHeaderTheme: true,
      buyHeaderBgColor: "#ecfdf5",
      buyHeaderTextColor: "#047857",

      enableSellHeaderTheme: true,
      sellHeaderBgColor: "#eef2ff",
      sellHeaderTextColor: "#4338ca",
    },
  },

  // 2. KAR BEYAZI & ZARİF ALTIN
  {
    id: "snow-white-gold",
    name: "Kar Beyazı & Zarif Altın",
    badge: "Lüks Beyaz",
    badgeColor: "warning",
    description: "Kuyumcu vitrini ferahlığında saf beyaz zemin ve zarif altın sarısı vurgular",
    previewBg: "#ffffff",
    previewText: "#18181b",
    previewAccent: "#d97706",
    previewFont: "Outfit, sans-serif",
    appearance: {
      enableProgramTheme: true,
      programBgColor: "#ffffff",
      programTextColor: "#18181b",
      programFont: "Outfit, sans-serif",
      gridHeaderBgColor: "#fffbeb",
      gridBgColor: "#ffffff",
      gridFont: "Outfit, sans-serif",
      windowBgColor: "#ffffff",
      windowTextColor: "#18181b",
      windowFocusColor: "#d97706",

      enableMenuTheme: true,
      menuBgColor: "#ffffff",
      menuSelectedBgColor: "#d97706",
      menuFont: "Outfit, sans-serif",
      menuHeaderBgColor: "#ffffff",
      menuHeaderFont: "Outfit, sans-serif",
      menuBackdropColor: "#fffbeb",

      enableBuyHeaderTheme: true,
      buyHeaderBgColor: "#f0fdf4",
      buyHeaderTextColor: "#15803d",

      enableSellHeaderTheme: true,
      sellHeaderBgColor: "#fff7ed",
      sellHeaderTextColor: "#c2410c",
    },
  },

  // 3. KURUMSAL AYDINLIK & KRALİYET MAVİSİ
  {
    id: "corporate-blue",
    name: "Kurumsal Aydınlık & Kraliyet Mavisi",
    badge: "ERP Standart",
    badgeColor: "primary",
    description: "Gözü yormayan aydınlık çalışma ortamı ve güçlü safir mavi aksanlar",
    previewBg: "#f8fafc",
    previewText: "#0f172a",
    previewAccent: "#2563eb",
    previewFont: "Inter, sans-serif",
    appearance: {
      enableProgramTheme: true,
      programBgColor: "#f8fafc",
      programTextColor: "#0f172a",
      programFont: "Inter, sans-serif",
      gridHeaderBgColor: "#e0f2fe",
      gridBgColor: "#ffffff",
      gridFont: "Inter, sans-serif",
      windowBgColor: "#ffffff",
      windowTextColor: "#0f172a",
      windowFocusColor: "#2563eb",

      enableMenuTheme: true,
      menuBgColor: "#ffffff",
      menuSelectedBgColor: "#2563eb",
      menuFont: "Inter, sans-serif",
      menuHeaderBgColor: "#f1f5f9",
      menuHeaderFont: "Inter, sans-serif",
      menuBackdropColor: "#000000",

      enableBuyHeaderTheme: true,
      buyHeaderBgColor: "#e0f2fe",
      buyHeaderTextColor: "#0369a1",

      enableSellHeaderTheme: true,
      sellHeaderBgColor: "#fef3c7",
      sellHeaderTextColor: "#b45309",
    },
  },

  // 9. KLASİK MASAÜSTÜ ERP (Delphi/Windows)
  {
    id: "delphi-classic",
    name: "Klasik Masaüstü ERP (Delphi/Windows)",
    badge: "Masaüstü Klasik",
    badgeColor: "secondary",
    description: "Geleneksel kuyumcu masaüstü yazılımlarına alışkın kullanıcılar için",
    previewBg: "#f4f4f4",
    previewText: "#000000",
    previewAccent: "#000080",
    previewFont: "Tahoma, sans-serif",
    appearance: {
      enableProgramTheme: true,
      programBgColor: "#f4f4f4",
      programTextColor: "#000000",
      programFont: "Tahoma, sans-serif",
      gridHeaderBgColor: "#cbe5ff",
      gridBgColor: "#ffffff",
      gridFont: "Tahoma, sans-serif",
      windowBgColor: "#ffffff",
      windowTextColor: "#000000",
      windowFocusColor: "#000080",

      enableMenuTheme: true,
      menuBgColor: "#bfe0ff",
      menuSelectedBgColor: "#ff80ff",
      menuFont: "Tahoma, sans-serif",
      menuHeaderBgColor: "#000080",
      menuHeaderFont: "Tahoma, sans-serif",
      menuBackdropColor: "#ff8080",

      enableBuyHeaderTheme: true,
      buyHeaderBgColor: "#cbe5ff",
      buyHeaderTextColor: "#000080",

      enableSellHeaderTheme: true,
      sellHeaderBgColor: "#ffe0c0",
      sellHeaderTextColor: "#804000",
    },
  },

  // 10. ROSE GOLD & PIRLANTA
  {
    id: "rose-luxury",
    name: "Rose Gold & Pırlanta Serif",
    badge: "Mücevher Şık",
    badgeColor: "danger",
    description: "Pırlanta, mücevher ve zarif serif tipografiye sahip lüks vitrin",
    previewBg: "#fff1f2",
    previewText: "#4c0519",
    previewAccent: "#e11d48",
    previewFont: "Playfair Display, Georgia, serif",
    appearance: {
      enableProgramTheme: true,
      programBgColor: "#fff1f2",
      programTextColor: "#4c0519",
      programFont: "Playfair Display, Georgia, serif",
      gridHeaderBgColor: "#ffe4e6",
      gridBgColor: "#ffffff",
      gridFont: "Playfair Display, serif",
      windowBgColor: "#ffffff",
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
