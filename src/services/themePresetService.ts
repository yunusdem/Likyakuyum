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

  // 2. FINTECH VE ERP DASHBOARD (Zinc & Emerald)
  {
    id: "fintech-zinc-emerald",
    name: "Fintech & ERP Dashboard (Zinc & Emerald)",
    badge: "Fintech ERP",
    badgeColor: "success",
    description: "Finans & borsa panelleri için Zinc yüzeyler, Zümrüt Yeşili (#059669) ve DM Sans fontu",
    previewBg: "#fafafa",
    previewText: "#18181b",
    previewAccent: "#059669",
    previewFont: "DM Sans, sans-serif",
    appearance: {
      enableProgramTheme: true,
      programBgColor: "#fafafa",
      programTextColor: "#18181b",
      programFont: "DM Sans, sans-serif",
      gridHeaderBgColor: "#e4e4e7",
      gridBgColor: "#ffffff",
      gridFont: "DM Sans, sans-serif",
      windowBgColor: "#ffffff",
      windowTextColor: "#18181b",
      windowFocusColor: "#059669",

      enableMenuTheme: true,
      menuBgColor: "#18181b",
      menuSelectedBgColor: "#059669",
      menuFont: "DM Sans, sans-serif",
      menuHeaderBgColor: "#09090b",
      menuHeaderFont: "DM Sans, sans-serif",
      menuBackdropColor: "#18181b",

      enableBuyHeaderTheme: true,
      buyHeaderBgColor: "#dcfce7",
      buyHeaderTextColor: "#15803d",

      enableSellHeaderTheme: true,
      sellHeaderBgColor: "#fef3c7",
      sellHeaderTextColor: "#b45309",
    },
  },

  // 3. LÜKS, KUYUMCU VE E-TİCARET (Warm Charcoal & Gold)
  {
    id: "luxury-charcoal-gold",
    name: "Lüks Kuyumcu & Sarraf (Warm Charcoal & Gold)",
    badge: "Lüks Sarraf",
    badgeColor: "warning",
    description: "Kuyumcu & sarraf vitrini için sıcak kömür arayüz, gerçek altın sarısı (#d4af37) ve Playfair Display fontu",
    previewBg: "#fcfbf9",
    previewText: "#1c1917",
    previewAccent: "#d4af37",
    previewFont: "Playfair Display, Cinzel, serif",
    appearance: {
      enableProgramTheme: true,
      programBgColor: "#fcfbf9",
      programTextColor: "#1c1917",
      programFont: "Playfair Display, Cinzel, serif",
      gridHeaderBgColor: "#fef9c3",
      gridBgColor: "#ffffff",
      gridFont: "Cinzel, serif",
      windowBgColor: "#ffffff",
      windowTextColor: "#1c1917",
      windowFocusColor: "#d4af37",

      enableMenuTheme: true,
      menuBgColor: "#1c1b1a",
      menuSelectedBgColor: "#d4af37",
      menuFont: "Cinzel, serif",
      menuHeaderBgColor: "#121212",
      menuHeaderFont: "Playfair Display, serif",
      menuBackdropColor: "#1c1b1a",

      enableBuyHeaderTheme: true,
      buyHeaderBgColor: "#fef3c7",
      buyHeaderTextColor: "#92400e",

      enableSellHeaderTheme: true,
      sellHeaderBgColor: "#fef9c3",
      sellHeaderTextColor: "#b45309",
    },
  },

  // 4. MINIMALIST VE TECH (Neutral & Electric Blue)
  {
    id: "minimal-electric-blue",
    name: "Minimalist & Tech (Neutral & Electric Blue)",
    badge: "Tech Modern",
    badgeColor: "primary",
    description: "Yüksek kontrastlı nötr beyaz paneller, Royal Blue (#2563eb), Cyan vurgular ve Poppins fontu",
    previewBg: "#ffffff",
    previewText: "#09090b",
    previewAccent: "#2563eb",
    previewFont: "Poppins, sans-serif",
    appearance: {
      enableProgramTheme: true,
      programBgColor: "#ffffff",
      programTextColor: "#09090b",
      programFont: "Poppins, sans-serif",
      gridHeaderBgColor: "#f4f4f5",
      gridBgColor: "#ffffff",
      gridFont: "Poppins, sans-serif",
      windowBgColor: "#ffffff",
      windowTextColor: "#09090b",
      windowFocusColor: "#2563eb",

      enableMenuTheme: true,
      menuBgColor: "#09090b",
      menuSelectedBgColor: "#2563eb",
      menuFont: "Poppins, sans-serif",
      menuHeaderBgColor: "#18181b",
      menuHeaderFont: "Poppins, sans-serif",
      menuBackdropColor: "#09090b",

      enableBuyHeaderTheme: true,
      buyHeaderBgColor: "#ecfeff",
      buyHeaderTextColor: "#0891b2",

      enableSellHeaderTheme: true,
      sellHeaderBgColor: "#eff6ff",
      sellHeaderTextColor: "#1d4ed8",
    },
  },

  // 5. KAR BEYAZI & ZARİF ALTIN
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

  // 6. LÜKS GECE & ALTIN VARAK
  {
    id: "midnight-gold",
    name: "Lüks Gece & Altın Varak",
    badge: "Popüler Koyu",
    badgeColor: "warning",
    description: "Koyu gece şıklığı, altın sarısı vurgular ve çağdaş lüks tipografi",
    previewBg: "#0f172a",
    previewText: "#f8fafc",
    previewAccent: "#eab308",
    previewFont: "Outfit, Inter, sans-serif",
    appearance: {
      enableProgramTheme: true,
      programBgColor: "#0f172a",
      programTextColor: "#f8fafc",
      programFont: "Outfit, Inter, sans-serif",
      gridHeaderBgColor: "#1e293b",
      gridBgColor: "#0f172a",
      gridFont: "Outfit, sans-serif",
      windowBgColor: "#1e293b",
      windowTextColor: "#f8fafc",
      windowFocusColor: "#eab308",

      enableMenuTheme: true,
      menuBgColor: "#090d16",
      menuSelectedBgColor: "#eab308",
      menuFont: "Outfit, sans-serif",
      menuHeaderBgColor: "#020617",
      menuHeaderFont: "Outfit, sans-serif",
      menuBackdropColor: "#0f172a",

      enableBuyHeaderTheme: true,
      buyHeaderBgColor: "#1e293b",
      buyHeaderTextColor: "#38bdf8",

      enableSellHeaderTheme: true,
      sellHeaderBgColor: "#1e293b",
      sellHeaderTextColor: "#fbbf24",
    },
  },

  // 7. KURUMSAL AYDINLIK & KRALİYET MAVİSİ
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

  // 8. ZÜMRÜT YEŞİLİ & SARRAFİYE
  {
    id: "emerald-kuyumcu",
    name: "Zümrüt Yeşili & Sarrafiye",
    badge: "Sektörel Özel",
    badgeColor: "success",
    description: "Kuyumculuk ve sarrafiye sektörü için özel zümrüt yeşili paleti",
    previewBg: "#f0fdf4",
    previewText: "#064e3b",
    previewAccent: "#059669",
    previewFont: "Montserrat, sans-serif",
    appearance: {
      enableProgramTheme: true,
      programBgColor: "#f0fdf4",
      programTextColor: "#064e3b",
      programFont: "Montserrat, sans-serif",
      gridHeaderBgColor: "#dcfce7",
      gridBgColor: "#ffffff",
      gridFont: "Montserrat, sans-serif",
      windowBgColor: "#ffffff",
      windowTextColor: "#064e3b",
      windowFocusColor: "#059669",

      enableMenuTheme: true,
      menuBgColor: "#064e3b",
      menuSelectedBgColor: "#10b981",
      menuFont: "Montserrat, sans-serif",
      menuHeaderBgColor: "#022c22",
      menuHeaderFont: "Montserrat, sans-serif",
      menuBackdropColor: "#064e3b",

      enableBuyHeaderTheme: true,
      buyHeaderBgColor: "#dcfce7",
      buyHeaderTextColor: "#065f46",

      enableSellHeaderTheme: true,
      sellHeaderBgColor: "#fef9c3",
      sellHeaderTextColor: "#854d0e",
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

  // 11. OLED SAF SİYAH & MİNİMALİST
  {
    id: "oled-charcoal",
    name: "OLED Saf Siyah & Minimalist",
    badge: "OLED Dark",
    badgeColor: "dark",
    description: "Yüksek kontrast, ultra net yazı ve minimum göz yorgunluğu",
    previewBg: "#121212",
    previewText: "#ffffff",
    previewAccent: "#38bdf8",
    previewFont: "Poppins, sans-serif",
    appearance: {
      enableProgramTheme: true,
      programBgColor: "#121212",
      programTextColor: "#ffffff",
      programFont: "Poppins, sans-serif",
      gridHeaderBgColor: "#1e1e1e",
      gridBgColor: "#181818",
      gridFont: "Poppins, sans-serif",
      windowBgColor: "#1e1e1e",
      windowTextColor: "#ffffff",
      windowFocusColor: "#38bdf8",

      enableMenuTheme: true,
      menuBgColor: "#0a0a0a",
      menuSelectedBgColor: "#38bdf8",
      menuFont: "Poppins, sans-serif",
      menuHeaderBgColor: "#000000",
      menuHeaderFont: "Poppins, sans-serif",
      menuBackdropColor: "#121212",

      enableBuyHeaderTheme: true,
      buyHeaderBgColor: "#1e1e1e",
      buyHeaderTextColor: "#38bdf8",

      enableSellHeaderTheme: true,
      sellHeaderBgColor: "#1e1e1e",
      sellHeaderTextColor: "#f59e0b",
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
