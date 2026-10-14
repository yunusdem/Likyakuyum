import { useState, useEffect } from "react";
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

export function useSidebarStyle(): SidebarStyleType {
  const { user } = useAuth();
  const [style, setStyle] = useState<SidebarStyleType>(() => {
    try {
      const cached = localStorage.getItem("kuyumcu_active_appearance");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed?.sidebarStyle) return parsed.sidebarStyle as SidebarStyleType;
      }
    } catch {}
    return (user?.appearance?.sidebarStyle as SidebarStyleType) || "classic";
  });

  useEffect(() => {
    if (user?.appearance?.sidebarStyle) {
      setStyle(user.appearance.sidebarStyle as SidebarStyleType);
    }
  }, [user?.appearance?.sidebarStyle]);

  useEffect(() => {
    const handlePreview = (e: CustomEvent) => {
      if (e.detail?.sidebarStyle) {
        setStyle(e.detail.sidebarStyle as SidebarStyleType);
      }
    };
    window.addEventListener("kuyumcu_preview_appearance" as any, handlePreview);
    return () => {
      window.removeEventListener("kuyumcu_preview_appearance" as any, handlePreview);
    };
  }, []);

  const normalizedStyle = style === "drawer" ? "megamenu" : style;
  return normalizedStyle;
}

export default useSidebarStyle;
