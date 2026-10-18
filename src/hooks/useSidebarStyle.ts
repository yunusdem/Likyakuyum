import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";

export type SidebarStyleType = "hover" | "classic" | "flyout" | "topbar" | "dual" | "megamenu" | "drawer";

export const SIDEBAR_STYLES: {
  id: SidebarStyleType;
  number: number;
  title: string;
  subtitle: string;
  description: string;
  badge: string;
}[] = [
  {
    id: "hover",
    number: 1,
    title: "1. Akıllı Hover Menü",
    subtitle: "Mouse ile Gelince Açılan",
    description: "Sidebar üzerine mouse ile gelince otomatik açılır, üstünden ayrılınca mini ikon moduna geri döner.",
    badge: "Kompakt & Hızlı",
  },
  {
    id: "classic",
    number: 2,
    title: "2. Klasik Sabit Menü",
    subtitle: "Mevcut Standart Akordeon",
    description: "Sol tarafta sabit dikey menü, tıklandığında alt başlıklar dikey akordeon olarak aşağı doğru açılır.",
    badge: "Standart",
  },
  {
    id: "flyout",
    number: 3,
    title: "3. Yan Açılır Kart Menü",
    subtitle: "Sağda Açılan Flyout Panel",
    description: "Tıklanınca alta doğru açılmak yerine, altındaki alanlar sidebarın hemen sağında bağımsız şık kartta çıkar.",
    badge: "Görsel Tarzı",
  },
  {
    id: "topbar",
    number: 4,
    title: "4. Header Üstü Yatay Menü",
    subtitle: "En Üstte Sabit Tek Satır Menü",
    description: "Sol menü gizlenir. En solda yeşil Likya alanı ve sağında tek satırda sıralı menüler sayfa kaydırılsa da sabit kalır.",
    badge: "Geniş Ekran",
  },
  {
    id: "dual",
    number: 5,
    title: "5. Çift Kademeli İkon Menü",
    subtitle: "Yeşil Başlık + İkon Çubuğu + Alt Panel",
    description: "En üstte yeşil Likya logosu, solda dar ikon şeridi ve yanında seçilen modüle ait alt başlıkları listeleyen panel.",
    badge: "Kurumsal ERP",
  },
  {
    id: "megamenu",
    number: 6,
    title: "6. Modern Yatay Mega Menü",
    subtitle: "Çok Sütunlu Üst Mega Panel",
    description: "En üstte yeşil Likya alanı ve modern hap butonlar; tıklandığında kategorileri ferah sütunlar halinde sunan mega menü.",
    badge: "Yeni Nesil UI",
  },
];

export const VALID_SIDEBAR_STYLES: SidebarStyleType[] = [
  "hover", "classic", "flyout", "topbar", "dual", "megamenu",
];

export function sanitizeSidebarStyle(val: unknown): SidebarStyleType {
  if (val === undefined || val === null) return "classic";
  if (typeof val === "number" || (typeof val === "string" && !isNaN(Number(val)) && val.trim() !== "")) {
    const num = Number(val);
    const found = SIDEBAR_STYLES.find((s) => s.number === num);
    if (found) return found.id;
  }
  const s = String(val).trim().toLowerCase();
  if (s === "drawer" || s === "mega" || s.includes("megamenu")) return "megamenu";
  if (s === "topbar" || s === "header" || s.includes("topbar") || s.includes("yatay")) return "topbar";
  if (s === "hover" || s.includes("hover")) return "hover";
  if (s === "classic" || s.includes("klasik") || s.includes("classic")) return "classic";
  if (s === "flyout" || s.includes("flyout")) return "flyout";
  if (s === "dual" || s.includes("dual")) return "dual";
  if (VALID_SIDEBAR_STYLES.includes(s as SidebarStyleType)) return s as SidebarStyleType;
  return "classic";
}

export function useSidebarStyle(): SidebarStyleType {
  const { user } = useAuth();

  const resolveCurrentStyle = useCallback((): SidebarStyleType => {
    // 1. Önce aktif localStorage görünüm ayarı (en hızlı ve doğrudan kullanıcı seçimi)
    try {
      const cached = localStorage.getItem("kuyumcu_active_appearance");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed?.sidebarStyle !== undefined && parsed?.sidebarStyle !== null) {
          return sanitizeSidebarStyle(parsed.sidebarStyle);
        }
      }
    } catch {}

    // 2. Ardından oturum kullanıcısının kayıtlı profili
    if (user?.appearance?.sidebarStyle !== undefined && user?.appearance?.sidebarStyle !== null) {
      return sanitizeSidebarStyle(user.appearance.sidebarStyle);
    }

    return "classic";
  }, [user?.appearance?.sidebarStyle]);

  const [style, setStyle] = useState<SidebarStyleType>(resolveCurrentStyle);

  useEffect(() => {
    const next = resolveCurrentStyle();
    setStyle(next);
    // DOM senkronizasyonu
    const currentDom = document.documentElement.getAttribute("data-sidebar-style");
    if (!currentDom || currentDom !== next) {
      document.documentElement.setAttribute("data-sidebar-style", next);
      document.body.setAttribute("data-sidebar-style", next);
    }
  }, [resolveCurrentStyle]);

  useEffect(() => {
    const handlePreview = (e: CustomEvent) => {
      if (e.detail?.sidebarStyle) {
        const s = sanitizeSidebarStyle(e.detail.sidebarStyle);
        setStyle(s);
        document.documentElement.setAttribute("data-sidebar-style", s);
        document.body.setAttribute("data-sidebar-style", s);
      }
    };

    const handleStorage = (e: StorageEvent) => {
      if (e.key === "kuyumcu_active_appearance" && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (parsed?.sidebarStyle) {
            const s = sanitizeSidebarStyle(parsed.sidebarStyle);
            setStyle(s);
            document.documentElement.setAttribute("data-sidebar-style", s);
            document.body.setAttribute("data-sidebar-style", s);
          }
        } catch {}
      }
    };

    window.addEventListener("kuyumcu_preview_appearance" as any, handlePreview);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener("kuyumcu_preview_appearance" as any, handlePreview);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  return sanitizeSidebarStyle(style);
}

export default useSidebarStyle;
