import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";

export type SidebarStyleType =
  | "hover"
  | "classic"
  | "flyout"
  | "topbar"
  | "dual"
  | "megamenu"
  | "drawer"
  | "compact"
  | "wide"
  | "floating"
  | "right"
  | "ribbon"
  | "dock"
  | "railgrid"
  | "tree"
  | "command"
  | "pillbar"
  | "iconbar"
  | "centered"
  | "cmdbar"
  | "fullgrid"
  | "splitbar";

export type SidebarOrientation = "vertical" | "horizontal";

export const SIDEBAR_STYLES: {
  id: SidebarStyleType;
  number: number;
  title: string;
  subtitle: string;
  description: string;
  badge: string;
  orientation: SidebarOrientation;
}[] = [
  {
    id: "hover",
    number: 1,
    title: "Akıllı Hover Menü",
    subtitle: "Mouse ile Gelince Açılan",
    description: "Sidebar üzerine mouse ile gelince otomatik açılır, üstünden ayrılınca mini ikon moduna geri döner.",
    badge: "Kompakt & Hızlı",
    orientation: "vertical",
  },
  {
    id: "classic",
    number: 2,
    title: "Klasik Sabit Menü",
    subtitle: "Mevcut Standart Akordeon",
    description: "Sol tarafta sabit dikey menü, tıklandığında alt başlıklar dikey akordeon olarak aşağı doğru açılır.",
    badge: "Standart",
    orientation: "vertical",
  },
  {
    id: "flyout",
    number: 3,
    title: "Yan Açılır Kart Menü",
    subtitle: "Sağda Açılan Flyout Panel",
    description: "Tıklanınca alta doğru açılmak yerine, altındaki alanlar sidebarın hemen sağında bağımsız şık kartta çıkar.",
    badge: "Görsel Tarzı",
    orientation: "vertical",
  },
  {
    id: "topbar",
    number: 4,
    title: "Header Üstü Yatay Menü",
    subtitle: "En Üstte Sabit Tek Satır Menü",
    description: "Sol menü gizlenir. En solda yeşil Likya alanı ve sağında tek satırda sıralı menüler sayfa kaydırılsa da sabit kalır.",
    badge: "Geniş Ekran",
    orientation: "horizontal",
  },
  {
    id: "dual",
    number: 5,
    title: "Çift Kademeli İkon Menü",
    subtitle: "Yeşil Başlık + İkon Çubuğu + Alt Panel",
    description: "En üstte yeşil Likya logosu, solda dar ikon şeridi ve yanında seçilen modüle ait alt başlıkları listeleyen panel.",
    badge: "Kurumsal ERP",
    orientation: "vertical",
  },
  {
    id: "megamenu",
    number: 6,
    title: "Modern Yatay Mega Menü",
    subtitle: "Çok Sütunlu Üst Mega Panel",
    description: "En üstte yeşil Likya alanı ve modern hap butonlar; tıklandığında kategorileri ferah sütunlar halinde sunan mega menü.",
    badge: "Yeni Nesil UI",
    orientation: "horizontal",
  },
  {
    id: "compact",
    number: 7,
    title: "Ultra Kompakt Dar Menü",
    subtitle: "Dar 215px Sabit Sol Menü",
    description: "Daha küçük yazı ve sıkı satır aralıklarıyla ekranda maksimum çalışma alanı bırakan kompakt sol menü.",
    badge: "Küçük Menü",
    orientation: "vertical",
  },
  {
    id: "wide",
    number: 8,
    title: "Geniş Konforlu Menü",
    subtitle: "320px Ferah Kart Görünümlü Menü",
    description: "Büyük butonlar, belirgin ikonlar ve geniş okunabilir başlıklarla dokunmatik ve büyük ekranlar için ferah sol menü.",
    badge: "Büyük Menü",
    orientation: "vertical",
  },
  {
    id: "floating",
    number: 9,
    title: "Yüzen Ada Menü",
    subtitle: "Yuvarlatılmış Yüzen Sol Kart",
    description: "Kenarlardan boşluklu, yuvarlatılmış köşeli ve yumuşak gölgeli bağımsız yüzen sol menü paneli.",
    badge: "Modern Ada",
    orientation: "vertical",
  },
  {
    id: "right",
    number: 10,
    title: "Sağ Sabit Menü",
    subtitle: "Sağ Kenara Sabit Dikey Menü",
    description: "Sağ kenar navigasyonu tercih edenler için ekranın sağ tarafına sabitlenmiş tam özellikli dikey akordeon menü.",
    badge: "Sağ Yerleşim",
    orientation: "vertical",
  },
  {
    id: "ribbon",
    number: 11,
    title: "Şerit Sekmeli Üst Menü",
    subtitle: "İki Katlı İkonlu Ofis Şerit Menü",
    description: "Üstte kategori sekmeleri, altında seçili modülün alt sayfalarını tek tıkla sunan büyük ofis şerit (Ribbon) menüsü.",
    badge: "Büyük Header",
    orientation: "horizontal",
  },
  {
    id: "dock",
    number: 12,
    title: "Koyu Kompakt Üst Bar",
    subtitle: "İnce Koyu Üst Dock + 3 Sütunlu Kart",
    description: "Üstte ince koyu renkli ikon odaklı şerit; üzerine gelindiğinde alt sayfaları 3 sütunlu kompakt kartlarda açar.",
    badge: "Küçük Header",
    orientation: "horizontal",
  },
  {
    id: "railgrid",
    number: 13,
    title: "İkonlu Kutu Grid Menü",
    subtitle: "2 Sütunlu Uygulama Kutucukları",
    description: "Liste yerine renkli 2 sütunlu büyük uygulama kartları sunar; bir kutuya tıklayınca modül içi odaklı ekran açılır.",
    badge: "Kutu Grid",
    orientation: "vertical",
  },
  {
    id: "tree",
    number: 14,
    title: "Klasör Ağacı (Tree) Menü",
    subtitle: "Çoklu Açılabilir Hiyerarşik Ağaç",
    description: "Birden fazla modülü aynı anda açık tutabilen, kılavuz çizgili ve üstte Hepsini Aç/Kapat düğmeli klasör ağacı menüsü.",
    badge: "Klasör Ağacı",
    orientation: "vertical",
  },
  {
    id: "command",
    number: 15,
    title: "Arama Odaklı Akıllı Menü",
    subtitle: "Üstte Canlı Arama + Hızlı Filtreleme",
    description: "Sidebar en üstünde sabit hızlı arama kutusu ile tüm ekranlara yazarak anında ulaşın, modül sayaçlarını tek bakışta görün.",
    badge: "Akıllı Arama",
    orientation: "vertical",
  },
  {
    id: "pillbar",
    number: 16,
    title: "Yüzen Hap Üst Menü",
    subtitle: "Yuvarlatılmış Yüzen Kapsül Bar",
    description: "Ekran üstünde kenarlardan boşluklu, tamamen yuvarlatılmış modern kapsül üst çubuk ve yumuşak açılır kartlar.",
    badge: "Yüzen Kapsül",
    orientation: "horizontal",
  },
  {
    id: "iconbar",
    number: 17,
    title: "Büyük İkonlu Üst Bar",
    subtitle: "Üstte İkon + Altta Başlık Araç Çubuğu",
    description: "Her modülü büyük renkli ikonu ve altında net başlığıyla sergileyen ferah, dokunmatik uyumlu üst araç çubuğu.",
    badge: "Büyük İkonlu",
    orientation: "horizontal",
  },
  {
    id: "centered",
    number: 18,
    title: "Ortalanmış Çift Satır Bar",
    subtitle: "Ortada Marka + Altta Çizgili Sekmeler",
    description: "Üst satırda marka ortada, vezne ve saat yanlarda; alt satırda ortalanmış alt çizgili zarif yatay menü çubuğu.",
    badge: "Ortalanmış",
    orientation: "horizontal",
  },
  {
    id: "cmdbar",
    number: 19,
    title: "Üst Arama & Komut Çubuğu",
    subtitle: "Header İçi Canlı Ekran Arama",
    description: "Üst çubuk içine gömülü canlı arama kutusuyla tüm modül ve ekranlara yazarak anında ulaşın, hızlıca geçiş yapın.",
    badge: "Komut Barı",
    orientation: "horizontal",
  },
  {
    id: "fullgrid",
    number: 20,
    title: "Tam Ekran Uygulama Çekmecesi",
    subtitle: "Minimal Bar + Tüm Modüller Izgarası",
    description: "Sade üst bar ve tek tıkla açılan tam genişlikte 'Tüm Modüller' ekranı ile tüm sayfaları tek bakışta görün.",
    badge: "Uygulama Izgarası",
    orientation: "horizontal",
  },
  {
    id: "splitbar",
    number: 21,
    title: "İkili Panel Üst Menü",
    subtitle: "Zümrüt Bar + Sol/Sağ Bölünmüş Panel",
    description: "Zümrüt vurgulu üst çubuk; açıldığında solda tüm modüller, sağda seçili modülün alt sayfaları canlı olarak listelenir.",
    badge: "İkili Panel",
    orientation: "horizontal",
  },
];

export const VALID_SIDEBAR_STYLES: SidebarStyleType[] = [
  "hover",
  "classic",
  "flyout",
  "topbar",
  "dual",
  "megamenu",
  "compact",
  "wide",
  "floating",
  "right",
  "ribbon",
  "dock",
  "railgrid",
  "tree",
  "command",
  "pillbar",
  "iconbar",
  "centered",
  "cmdbar",
  "fullgrid",
  "splitbar",
];

export const HEADER_NAV_SIDEBAR_STYLES: SidebarStyleType[] = [
  "topbar",
  "megamenu",
  "drawer",
  "ribbon",
  "dock",
  "pillbar",
  "iconbar",
  "centered",
  "cmdbar",
  "fullgrid",
  "splitbar",
];

export function isHeaderNavStyle(val?: string | null): boolean {
  if (!val) return false;
  const s = String(val).trim().toLowerCase();
  return (
    s === "topbar" ||
    s === "megamenu" ||
    s === "drawer" ||
    s === "ribbon" ||
    s === "dock" ||
    s === "pillbar" ||
    s === "iconbar" ||
    s === "centered" ||
    s === "cmdbar" ||
    s === "fullgrid" ||
    s === "splitbar" ||
    s.includes("topbar") ||
    s.includes("megamenu") ||
    s.includes("ribbon") ||
    s.includes("dock") ||
    s.includes("pillbar") ||
    s.includes("iconbar") ||
    s.includes("centered") ||
    s.includes("cmdbar") ||
    s.includes("fullgrid") ||
    s.includes("splitbar") ||
    s.includes("header") ||
    s.includes("yatay")
  );
}

export function sanitizeSidebarStyle(val: unknown): SidebarStyleType {
  if (val === undefined || val === null) return "classic";
  if (typeof val === "number" || (typeof val === "string" && !isNaN(Number(val)) && val.trim() !== "")) {
    const num = Number(val);
    const found = SIDEBAR_STYLES.find((s) => s.number === num);
    if (found) return found.id;
  }
  const s = String(val).trim().toLowerCase();
  if (s === "drawer" || s === "mega" || s.includes("megamenu")) return "megamenu";
  if (s === "ribbon" || s.includes("ribbon") || s.includes("serit")) return "ribbon";
  if (s === "dock" || s.includes("dock")) return "dock";
  if (s === "pillbar" || s.includes("pillbar")) return "pillbar";
  if (s === "iconbar" || s.includes("iconbar")) return "iconbar";
  if (s === "centered" || s.includes("centered")) return "centered";
  if (s === "cmdbar" || s.includes("cmdbar")) return "cmdbar";
  if (s === "fullgrid" || s.includes("fullgrid")) return "fullgrid";
  if (s === "splitbar" || s.includes("splitbar")) return "splitbar";
  if (s === "topbar" || s === "header" || s.includes("topbar") || s.includes("yatay")) return "topbar";
  if (s === "compact" || s.includes("compact") || s.includes("kompakt")) return "compact";
  if (s === "wide" || s.includes("wide") || s.includes("genis")) return "wide";
  if (s === "floating" || s.includes("floating") || s.includes("yuzen")) return "floating";
  if (s === "right" || s.includes("right") || s.includes("sag")) return "right";
  if (s === "railgrid" || s.includes("railgrid") || s.includes("kutu")) return "railgrid";
  if (s === "tree" || s.includes("tree") || s.includes("agac") || s === "darkglass") return "tree";
  if (s === "command" || s.includes("command") || s.includes("arama")) return "command";
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
    const orientation: SidebarOrientation = isHeaderNavStyle(next) ? "horizontal" : "vertical";
    // DOM senkronizasyonu
    const currentDom = document.documentElement.getAttribute("data-sidebar-style");
    if (!currentDom || currentDom !== next) {
      document.documentElement.setAttribute("data-sidebar-style", next);
      document.body.setAttribute("data-sidebar-style", next);
    }
    document.documentElement.setAttribute("data-nav-orientation", orientation);
    document.body.setAttribute("data-nav-orientation", orientation);
  }, [resolveCurrentStyle]);

  useEffect(() => {
    const applyDom = (s: SidebarStyleType) => {
      const orientation: SidebarOrientation = isHeaderNavStyle(s) ? "horizontal" : "vertical";
      document.documentElement.setAttribute("data-sidebar-style", s);
      document.body.setAttribute("data-sidebar-style", s);
      document.documentElement.setAttribute("data-nav-orientation", orientation);
      document.body.setAttribute("data-nav-orientation", orientation);
    };

    const handlePreview = (e: CustomEvent) => {
      if (e.detail?.sidebarStyle) {
        const s = sanitizeSidebarStyle(e.detail.sidebarStyle);
        setStyle(s);
        applyDom(s);
      }
    };

    const handleStorage = (e: StorageEvent) => {
      if (e.key === "kuyumcu_active_appearance" && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (parsed?.sidebarStyle) {
            const s = sanitizeSidebarStyle(parsed.sidebarStyle);
            setStyle(s);
            applyDom(s);
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
