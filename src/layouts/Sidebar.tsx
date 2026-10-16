import React, { Fragment, useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Accordion,
  Badge,
  ListGroup,
  Nav,
} from "react-bootstrap";

//import custom types
import { MenuItemType } from "types/menuTypes";

import CustomToggle, { CustomToggleLevel2 } from "./SidebarMenuToggle";
import {
  IconX,
  IconChevronRight,
  IconLogin2,
  IconKey,
  IconLicense,
  IconUser,
  IconClock,
  IconCalendar,
  IconCash,
  IconFilePlus,
  IconFilePencil,
  IconFileSpreadsheet,
  IconListDetails,
  IconId,
  IconBarcode,
  IconTrendingUp,
  IconArrowsExchange,
  IconEye,
  IconDeviceTv,
  IconLock,
  IconCreditCard,
  IconShoppingCart,
  IconArrowBackUp,
  IconBuildingStore,
  IconSettings,
  IconUserCheck,
  IconPrinter,
  IconNumbers,
  IconRefresh,
  IconShieldExclamation,
  IconBuilding,
  IconFileText,
  IconPercentage,
  IconChartBar,
  IconCoins,
  IconShieldCheck,
  IconNfc,
} from "@tabler/icons-react";
import useMenu from "hooks/useMenu";
import { useAuth } from "../context/AuthContext";
import { CashDeskService } from "../services/cashDeskService";

import { DashboardMenu } from "routes/DashboardRoute";
import { menuyuKullaniciyaSuz, menuyuSuz } from "../config/modulKatalogu";
import { useKullaniciYetkisi } from "../hooks/useKullaniciYetkisi";
import { solMenuyuBirlestir } from "../config/solMenuBirlesimi";
import { SistemService } from "../services/sistemService";
import { getAppBrand } from "../utils/brandHelper";
import useSidebarStyle from "../hooks/useSidebarStyle";

interface SidebarProps {
  hideLogo: boolean;
  containerId?: string;
}

export interface MenuVisualTheme {
  bg: string;
  color: string;
  borderColor?: string;
}

export const MENU_THEMES: Record<string, MenuVisualTheme> = {
  vezne: { bg: "#fef3c7", color: "#d97706", borderColor: "#fde68a" }, // Gold/Amber
  kasa: { bg: "#dcfce7", color: "#16a34a", borderColor: "#bbf7d0" }, // Emerald/Green
  kur: { bg: "#e0e7ff", color: "#4f46e5", borderColor: "#c7d2fe" }, // Indigo
  cari: { bg: "#ffedd5", color: "#ea580c", borderColor: "#fed7aa" }, // Warm Orange (like Müşterilerim in screenshot)
  yonetici: { bg: "#f3e8ff", color: "#9333ea", borderColor: "#e9d5ff" }, // Purple/Violet
  banka: { bg: "#e0f2fe", color: "#0284c7", borderColor: "#bae6fd" }, // Sky Blue / Cyan (like İş Ortaklarım in screenshot)
  raporlar: { bg: "#fce7f3", color: "#db2777", borderColor: "#fbcfe8" }, // Rose/Pink
  ebelge: { bg: "#fee2e2", color: "#dc2626", borderColor: "#fecaca" }, // Soft Red
  etiket: { bg: "#ccfbf1", color: "#0d9488", borderColor: "#99f6e4" }, // Teal
  perakende: { bg: "#ecfdf5", color: "#059669", borderColor: "#a7f3d0" }, // Mint/Emerald
  ayarlar: { bg: "#f1f5f9", color: "#475569", borderColor: "#e2e8f0" }, // Slate
};

const FALLBACK_PALETTES: MenuVisualTheme[] = [
  { bg: "#e0f2fe", color: "#0284c7", borderColor: "#bae6fd" },
  { bg: "#ffedd5", color: "#ea580c", borderColor: "#fed7aa" },
  { bg: "#fef3c7", color: "#d97706", borderColor: "#fde68a" },
  { bg: "#dcfce7", color: "#16a34a", borderColor: "#bbf7d0" },
  { bg: "#f3e8ff", color: "#9333ea", borderColor: "#e9d5ff" },
  { bg: "#ccfbf1", color: "#0d9488", borderColor: "#99f6e4" },
  { bg: "#fce7f3", color: "#db2777", borderColor: "#fbcfe8" },
];

export const getThemeForMenu = (menu: MenuItemType, index: number): MenuVisualTheme => {
  if (menu.key && MENU_THEMES[menu.key]) {
    return MENU_THEMES[menu.key];
  }
  const title = (menu.title || "").toLowerCase();
  if (title.includes("vezne")) return MENU_THEMES.vezne;
  if (title.includes("kasa")) return MENU_THEMES.kasa;
  if (title.includes("kur")) return MENU_THEMES.kur;
  if (title.includes("cari")) return MENU_THEMES.cari;
  if (title.includes("yönetici") || title.includes("yonetici")) return MENU_THEMES.yonetici;
  if (title.includes("banka") || title.includes("pos")) return MENU_THEMES.banka;
  if (title.includes("rapor")) return MENU_THEMES.raporlar;
  if (title.includes("belge") || title.includes("e-belge")) return MENU_THEMES.ebelge;
  if (title.includes("etiket") || title.includes("barkod")) return MENU_THEMES.etiket;
  if (title.includes("perakende") || title.includes("satış")) return MENU_THEMES.perakende;
  if (title.includes("ayar")) return MENU_THEMES.ayarlar;

  return FALLBACK_PALETTES[index % FALLBACK_PALETTES.length];
};

export const getSubmenuIcon = (name: string) => {
  const raw = name || "";
  const n = raw.toLowerCase();

  // 1. İskonto Tanımları -> IconPercentage (%)
  if (
    raw.includes("İskonto") ||
    raw.includes("iskonto") ||
    n.includes("iskonto") ||
    n.includes("i̇skonto") ||
    n.includes("indirim")
  ) {
    return <IconPercentage size={16} className="sidebar-sub-icon flex-shrink-0" />;
  }

  // 2. Banknot Tanımları -> IconCash
  if (n.includes("banknot")) {
    return <IconCash size={16} className="sidebar-sub-icon flex-shrink-0" />;
  }

  // 3. İstatistik Tanımları -> IconChartBar
  if (
    raw.includes("İstatistik") ||
    raw.includes("istatistik") ||
    n.includes("istatistik") ||
    n.includes("i̇statistik")
  ) {
    return <IconChartBar size={16} className="sidebar-sub-icon flex-shrink-0" />;
  }

  // 4. Vezne Tanımları -> IconBuildingStore
  if (n.includes("vezne tanım") || n.includes("vezne tanim")) {
    return <IconBuildingStore size={16} className="sidebar-sub-icon flex-shrink-0" />;
  }

  // 5. Kullanıcı Tanımları -> IconUser
  if (n.includes("kullanıcı") || n.includes("kullanici") || n.includes("aktivasyon")) {
    return <IconUser size={16} className="sidebar-sub-icon flex-shrink-0" />;
  }

  // 6. Yazıcı Tanımları -> IconPrinter
  if (n.includes("yazıcı") || n.includes("yazici")) {
    return <IconPrinter size={16} className="sidebar-sub-icon flex-shrink-0" />;
  }

  // 7. Ürün Tanımları -> IconCoins
  if (n.includes("ürün tanım") || n.includes("urun tanim") || n.includes("urun tanım")) {
    return <IconCoins size={16} className="sidebar-sub-icon flex-shrink-0" />;
  }

  // 8. MASAK -> IconShieldCheck
  if (n.includes("masak")) {
    return <IconShieldCheck size={16} className="sidebar-sub-icon flex-shrink-0" />;
  }

  // 9. Numaratörler -> IconNumbers
  if (n.includes("numara") || n.includes("numaratör")) {
    return <IconNumbers size={16} className="sidebar-sub-icon flex-shrink-0" />;
  }

  // 10. Firma Tanımları -> IconBuildingStore
  if (n.includes("firma")) {
    return <IconBuildingStore size={16} className="sidebar-sub-icon flex-shrink-0" />;
  }

  // 11. RFID İşlemleri -> IconNfc
  if (n.includes("rfid")) {
    return <IconNfc size={16} className="sidebar-sub-icon flex-shrink-0 text-amber-500" />;
  }

  if (
    n.includes("fisi kayit") ||
    n.includes("fişi kayıt") ||
    n.includes("hesap kayit") ||
    n.includes("hesap kayıt") ||
    n.includes("kart kayit") ||
    n.includes("kart kayıt") ||
    n.includes("hareket kayit") ||
    n.includes("hareket kayıt") ||
    n.includes("dekont kayit") ||
    n.includes("dekont kayıt") ||
    n.includes("transfer kayit") ||
    n.includes("transfer kayıt") ||
    n.includes("hızlı") ||
    n.includes("ekle")
  ) {
    return <IconFilePlus size={16} className="sidebar-sub-icon flex-shrink-0" />;
  }
  if (
    n.includes("duzeltme") ||
    n.includes("düzeltme") ||
    n.includes("duzenle") ||
    n.includes("düzenle")
  ) {
    return <IconFilePencil size={16} className="sidebar-sub-icon flex-shrink-0" />;
  }
  if (
    n.includes("rapor") ||
    n.includes("ekstre") ||
    n.includes("analiz") ||
    n.includes("defter")
  ) {
    return <IconFileSpreadsheet size={16} className="sidebar-sub-icon flex-shrink-0" />;
  }
  if (n.includes("liste") || n.includes("hareketler")) {
    return <IconListDetails size={16} className="sidebar-sub-icon flex-shrink-0" />;
  }
  if (n.includes("kart") || n.includes("müşteri") || n.includes("musteri")) {
    return <IconId size={16} className="sidebar-sub-icon flex-shrink-0" />;
  }
  if (n.includes("barkod") || n.includes("etiket") || n.includes("ürün") || n.includes("urun")) {
    return <IconBarcode size={16} className="sidebar-sub-icon flex-shrink-0" />;
  }
  if (n.includes("fiyat") || n.includes("kur")) {
    return <IconTrendingUp size={16} className="sidebar-sub-icon flex-shrink-0" />;
  }
  if (n.includes("para") || n.includes("sayim") || n.includes("sayım") || n.includes("say")) {
    return <IconCash size={16} className="sidebar-sub-icon flex-shrink-0" />;
  }
  if (n.includes("transfer") || n.includes("tahsilat")) {
    return <IconArrowsExchange size={16} className="sidebar-sub-icon flex-shrink-0" />;
  }
  if (n.includes("izleme") || n.includes("kontrol")) {
    return <IconEye size={16} className="sidebar-sub-icon flex-shrink-0" />;
  }
  if (n.includes("pano")) {
    return <IconDeviceTv size={16} className="sidebar-sub-icon flex-shrink-0" />;
  }
  if (n.includes("emanet")) {
    return <IconLock size={16} className="sidebar-sub-icon flex-shrink-0" />;
  }
  if (n.includes("pos") || n.includes("banka")) {
    return <IconCreditCard size={16} className="sidebar-sub-icon flex-shrink-0" />;
  }
  if (n.includes("satış") || n.includes("satis")) {
    return <IconShoppingCart size={16} className="sidebar-sub-icon flex-shrink-0" />;
  }
  if (n.includes("alış") || n.includes("alis") || n.includes("iade")) {
    return <IconArrowBackUp size={16} className="sidebar-sub-icon flex-shrink-0" />;
  }
  if (n.includes("vitrin") || n.includes("stok")) {
    return <IconBuildingStore size={16} className="sidebar-sub-icon flex-shrink-0" />;
  }
  if (n.includes("devir") || n.includes("servis")) {
    return <IconRefresh size={16} className="sidebar-sub-icon flex-shrink-0" />;
  }
  if (n.includes("tanim") || n.includes("tanım") || n.includes("ayar")) {
    return <IconSettings size={16} className="sidebar-sub-icon flex-shrink-0" />;
  }
  return <IconFileText size={16} className="sidebar-sub-icon flex-shrink-0" />;
};

const Sidebar: React.FC<SidebarProps> = ({ hideLogo = false, containerId }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname;
  const { handleCollapsed, collapsed } = useMenu();
  const { user, logout } = useAuth();
  // Kurulum (exe) sürümünde Lisans ve Sürüm sayfasının düğmesi gösterilir
  const [kurulumSurumu, setKurulumSurumu] = useState(false);
  useEffect(() => {
    SistemService.bilgi().then((b) => setKurulumSurumu(!!b.kurulum));
  }, []);
  // Yönetim panelinden firmaya kapatılan menüler hiç çizilmez (kısayol tuşları da yalnız görünen menüde çalışır).
  // Süzmeden sonra birleşik sol menü (Vezne/Kur, Kasa/Banka, Etiket/Perakende): docs/SOL_MENU_BIRLESTIRME.md
  // Kullanıcının kart menü yetkileri (harf listesi): yetkisiz ana menü / madde çizilmez
  const kullaniciYetkisi = useKullaniciYetkisi();
  const gorunenMenu = useMemo(() => {
    const filtered = solMenuyuBirlestir(menuyuKullaniciyaSuz(menuyuSuz(DashboardMenu, user?.merkez?.moduller), kullaniciYetkisi));
    const hasItems = filtered && filtered.some((item) => (item.children && item.children.length > 0) || item.link);
    // Emniyet: Menü hiçbir kullanıcıda kaybolmasın, süzme boş dönerse ana menüyü koru
    if (!hasItems) {
      return solMenuyuBirlestir(DashboardMenu);
    }
    return filtered;
  }, [user?.merkez?.moduller, kullaniciYetkisi]);
  const gorunenMenuRef = useRef(gorunenMenu);
  gorunenMenuRef.current = gorunenMenu;

  const sidebarStyle = useSidebarStyle();
  const [flyoutIndex, setFlyoutIndex] = useState<number | null>(null);
  const [flyoutPos, setFlyoutPos] = useState<{ top: number; left: number } | null>(null);
  const flyoutTimerRef = useRef<any>(null);
  const [activeDualIndex, setActiveDualIndex] = useState<number>(0);

  const clearFlyoutTimer = () => {
    if (flyoutTimerRef.current) {
      clearTimeout(flyoutTimerRef.current);
      flyoutTimerRef.current = null;
    }
  };

  const openFlyoutAt = (index: number, el: HTMLElement) => {
    clearFlyoutTimer();
    const rect = el.getBoundingClientRect();
    const targetMenu = gorunenMenu[index];
    
    // Alt öğe ve grup başlığı sayısını hesapla
    const totalItems = (targetMenu?.children || []).reduce(
      (acc, c) => acc + (c.children?.length ? c.children.length + 1 : 1),
      0
    );
    // Her öğe için ~34px + paddingler + emniyet payı
    const estimatedHeight = Math.min(window.innerHeight - 24, Math.max(160, totalItems * 35 + 28));
    
    // Eğer butonun hizasından başlarsa ekranın altına taşacaksa, kartı yukarı doğru kaydır
    let top = rect.top;
    if (top + estimatedHeight > window.innerHeight - 12) {
      top = Math.max(10, window.innerHeight - 12 - estimatedHeight);
    }
    top = Math.max(10, top);

    const left = rect.right + 6;
    setFlyoutPos({ top, left });
    setFlyoutIndex(index);
  };

  const closeFlyoutWithDelay = () => {
    clearFlyoutTimer();
    flyoutTimerRef.current = setTimeout(() => {
      setFlyoutIndex(null);
      setFlyoutPos(null);
    }, 160);
  };

  const closeFlyoutImmediate = () => {
    clearFlyoutTimer();
    setFlyoutIndex(null);
    setFlyoutPos(null);
  };

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(".sidebar-flyout-card") && !target.closest(".sidebar-flyout-trigger") && !target.closest(".sidebar-flyout-section")) {
        closeFlyoutImmediate();
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  useEffect(() => {
    closeFlyoutImmediate();
  }, [location.pathname]);

  const handleFlyoutToggle = (index: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (flyoutIndex === index) {
      closeFlyoutImmediate();
    } else {
      openFlyoutAt(index, e.currentTarget as HTMLElement);
    }
  };

  const [activeMenuKey, setActiveMenuKey] = useState<string>("");
  const [pendingMenuIndex, setPendingMenuIndex] = useState<number | null>(null);
  const pendingMenuIndexRef = useRef<number | null>(null);
  const pendingTimerRef = useRef<any>(null);

  const setPending = (idx: number | null) => {
    pendingMenuIndexRef.current = idx;
    setPendingMenuIndex(idx);
  };

  const [vezneName, setVezneName] = useState<string>("");

  useEffect(() => {
    let isMounted = true;
    CashDeskService.getVezneler()
      .then((list) => {
        if (!isMounted || !list || list.length === 0) return;
        const code = String(user?.cashierCode || "").trim();
        const vezneId = (user as any)?.vezneId;
        const matched = list.find(
          (v) =>
            (vezneId !== undefined && vezneId !== null && Number(v.id) === Number(vezneId)) ||
            String(v.id) === code ||
            (v.kod && v.kod.trim().toLowerCase() === code.toLowerCase())
        );
        if (matched) {
          setVezneName(matched.ad || matched.kod || `Vezne ${matched.id}`);
        } else if (list.length > 0) {
          setVezneName(list[0].ad || list[0].kod || `Vezne ${list[0].id}`);
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [user?.cashierCode, (user as any)?.vezneId]);

  const [currentDate, setCurrentDate] = useState<string>(() => {
    return new Date().toLocaleDateString("tr-TR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  });

  const [currentTime, setCurrentTime] = useState<string>(() => {
    return new Date().toLocaleTimeString("tr-TR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  });

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentDate(
        now.toLocaleDateString("tr-TR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        })
      );
      setCurrentTime(
        now.toLocaleTimeString("tr-TR", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Helper to extract prefix shortcut letter (e.g. "A-" -> "A")
  const getShortcutLetter = (text?: string): string | null => {
    if (!text) return null;
    const match = text.trim().match(/^([A-Za-zĞÜŞİÖÇğüşıöç])\s*[-–—]/);
    if (match) {
      const letter = match[1].toLocaleUpperCase("tr-TR");
      if (letter === "İ" || letter === "I" || letter === "ı" || letter === "i") return "I";
      return letter;
    }
    return null;
  };

  const normalizeLetter = (char: string): string => {
    const upper = char.toLocaleUpperCase("tr-TR");
    if (upper === "İ" || upper === "I" || upper === "ı" || upper === "i") return "I";
    return upper;
  };

  // Helper to normalize URL paths for comparison
  const normalizePath = (p?: string): string => {
    if (!p) return "";
    let clean = p.split("?")[0].split("#")[0].trim();
    if (!clean.startsWith("/")) clean = `/${clean}`;
    if (clean.length > 1 && clean.endsWith("/")) clean = clean.slice(0, -1);
    return clean.toLowerCase();
  };

  // Helper to check if a menu link matches the current route (including aliases and subroutes)
  const isRouteMatch = (itemLink?: string, current = location.pathname): boolean => {
    if (!itemLink) return false;
    const linkNorm = normalizePath(itemLink);
    const curNorm = normalizePath(current);
    if (!linkNorm || !curNorm) return false;
    if (linkNorm === curNorm) return true;

    // Direct alias mappings (exact sets of aliases for specific pages)
    const sarrafKayitAliases = ["/vezne/sarraf-fisi-kayit", "/vezne/sarraf-fisi", "/vezne/genel-sarraf-fisi"];
    if (sarrafKayitAliases.includes(curNorm) && sarrafKayitAliases.includes(linkNorm)) {
      return true;
    }

    const sarrafDuzeltmeAliases = ["/vezne/sarraf-fisi-duzeltme"];
    if (sarrafDuzeltmeAliases.includes(curNorm) && sarrafDuzeltmeAliases.includes(linkNorm)) {
      return true;
    }

    const dovizKayitAliases = ["/vezne/doviz-fisi-kayit", "/vezne/doviz-fisi"];
    if (dovizKayitAliases.includes(curNorm) && dovizKayitAliases.includes(linkNorm)) {
      return true;
    }

    const dovizDuzeltmeAliases = ["/vezne/doviz-fisi-duzeltme"];
    if (dovizDuzeltmeAliases.includes(curNorm) && dovizDuzeltmeAliases.includes(linkNorm)) {
      return true;
    }

    const perakendeKayitAliases = [
      "/vezne/perakende-fisi-kayit",
      "/vezne/perakende-fisi",
      "/vezne/perakende-fis",
      "/vezne/perakende",
      "/perakende/perakende-fisi-kayit",
      "/perakende/satis",
    ];
    if (perakendeKayitAliases.includes(curNorm) && perakendeKayitAliases.includes(linkNorm)) {
      return true;
    }

    const perakendeDuzeltmeAliases = [
      "/vezne/perakende-fisi-duzeltme",
      "/vezne/perakende-duzeltme",
      "/perakende/perakende-fisi-duzeltme",
    ];
    if (perakendeDuzeltmeAliases.includes(curNorm) && perakendeDuzeltmeAliases.includes(linkNorm)) {
      return true;
    }

    const transferKayitAliases = ["/vezne/transfer-kayit", "/vezne/vezne-transferi-kayit", "/vezne/vezne-transferi", "/vezne/transfer"];
    if (transferKayitAliases.includes(curNorm) && transferKayitAliases.includes(linkNorm)) {
      return true;
    }

    const transferDuzeltmeAliases = ["/vezne/transfer-duzeltme", "/vezne/vezne-transferi-duzeltme"];
    if (transferDuzeltmeAliases.includes(curNorm) && transferDuzeltmeAliases.includes(linkNorm)) {
      return true;
    }

    const vezneIzlemeAliases = ["/vezne/izleme", "/vezne/vezne-izleme"];
    if (vezneIzlemeAliases.includes(curNorm) && vezneIzlemeAliases.includes(linkNorm)) {
      return true;
    }

    const paraSayAliases = ["/vezne/para-say", "/vezne/para-sayma", "/vezne/vezne-para-say"];
    if (paraSayAliases.includes(curNorm) && paraSayAliases.includes(linkNorm)) {
      return true;
    }

    const barkodBasimiAliases = ["/etiket/barkod-basimi", "/etiket/barkod-fiyat"];
    if (barkodBasimiAliases.includes(curNorm) && barkodBasimiAliases.includes(linkNorm)) {
      return true;
    }

    const bankaHesapKartlariAliases = ["/banka/hesap-kartlari", "/banka/hesap-karti"];
    if (bankaHesapKartlariAliases.includes(curNorm) && bankaHesapKartlariAliases.includes(linkNorm)) {
      return true;
    }

    const posTanimlariAliases = ["/banka/pos-tanimlari", "/banka/pos-cihazi-tanimlari"];
    if (posTanimlariAliases.includes(curNorm) && posTanimlariAliases.includes(linkNorm)) {
      return true;
    }

    const bankaHareketlerAliases = ["/banka/hareketler", "/banka/hesap-hareketleri", "/ebanka/hareketler"];
    if (bankaHareketlerAliases.includes(curNorm) && bankaHareketlerAliases.includes(linkNorm)) {
      return true;
    }

    // e-Belge alt sayfaları (/e-belge/...)
    if (curNorm.startsWith("/e-belge") && (linkNorm === "/e-belge" || linkNorm.startsWith("/e-belge"))) {
      return true;
    }

    // Alt sayfalar için prefix eşleşmesi (örn: /raporlar/careks1)
    if (linkNorm !== "/" && curNorm.startsWith(`${linkNorm}/`)) {
      return true;
    }

    return false;
  };

  // Whenever the active route/page changes (from Header quick actions, direct URL, etc.):
  // Automatically find and open the corresponding menu accordion in the sidebar
  useEffect(() => {
    if (!currentPath || currentPath === "/" || currentPath === "/dashboard") {
      setActiveMenuKey("");
      return;
    }

    const matchedIndex = gorunenMenu.findIndex((menu) => {
      // 1. Direct top-level menu link
      if (menu.link && isRouteMatch(menu.link, currentPath)) {
        return true;
      }
      // 2. Child level 1 or level 2 links
      if (menu.children) {
        return menu.children.some((c1) => {
          if (c1.link && isRouteMatch(c1.link, currentPath)) {
            return true;
          }
          if (c1.children) {
            return c1.children.some((c2) => c2.link && isRouteMatch(c2.link, currentPath));
          }
          return false;
        });
      }
      return false;
    });

    if (matchedIndex !== -1) {
      setActiveMenuKey(matchedIndex.toString());
      setActiveDualIndex(matchedIndex);
      setTimeout(() => {
        const activeLinkEl = document.querySelector("#miniSidebar .sidebar-sub-link.active, #miniSidebar .nav-link.active");
        if (activeLinkEl) {
          activeLinkEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
      }, 120);
    }
  }, [currentPath, gorunenMenu]);

  // Reset pending and flyout state on route change
  useEffect(() => {
    setPending(null);
    setFlyoutIndex(null);
    if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current);
  }, [location.pathname]);

  const navigateWithDashboardHop = useCallback((to: string) => {
    const normTarget = to.startsWith("/") ? to : `/${to}`;
    if (normTarget === "/dashboard" || normTarget === "/") {
      navigate("/dashboard");
      return;
    }
    navigate("/dashboard", { replace: true });
    setTimeout(() => {
      navigate(normTarget);
    }, 15);
  }, [navigate]);

  // Global keyboard listener for sidebar navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 1. Ignore browser shortcut combinations (Cmd/Ctrl/Alt)
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      // 2. Escape closes open menu and clears pending state
      if (e.key === "Escape") {
        setPending(null);
        setActiveMenuKey("");
        if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current);
        return;
      }

      // 3. Only process single characters
      if (!e.key || typeof e.key !== "string" || e.key.length !== 1) return;

      // 4. Do nothing if user is currently typing in an input/textarea/select/editable field or modal
      const target = e.target as HTMLElement | null;
      if (target) {
        const tagName = target.tagName?.toUpperCase();
        if (tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT") {
          return;
        }
        if (target.isContentEditable || target.getAttribute("contenteditable") === "true") {
          return;
        }
        if (target.closest(".modal") || target.closest(".swal2-container") || target.closest(".popover")) {
          return;
        }
      }

      const pressed = normalizeLetter(e.key);

      // 5. If a menu is currently open/pending: check its sub-items first
      if (pendingMenuIndexRef.current !== null) {
        const currentMenu = gorunenMenuRef.current[pendingMenuIndexRef.current];
        if (currentMenu?.children) {
          const matchedChild = currentMenu.children.find((child) => {
            const childKey = getShortcutLetter(child.name || child.title);
            return childKey === pressed;
          });

          if (matchedChild && matchedChild.link) {
            e.preventDefault();
            setPending(null);
            if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current);
            const to = matchedChild.link.startsWith("/") ? matchedChild.link : `/${matchedChild.link}`;
            if (to === "/kur/pano" || to.startsWith("/kur/pano?")) {
              window.open(to, "_blank", "noopener,noreferrer");
              return;
            }
            navigateWithDashboardHop(to);
            return;
          }
        }
      }

      // 6. Otherwise check if pressed letter matches a top-level menu (e.g. A -> Vezne İşlemleri)
      const topMenuIndex = gorunenMenuRef.current.findIndex((menu) => {
        const menuKey = getShortcutLetter(menu.title);
        return menuKey === pressed;
      });

      if (topMenuIndex !== -1) {
        e.preventDefault();
        setActiveMenuKey(topMenuIndex.toString());
        setPending(topMenuIndex);
        if (collapsed === "collapsed") {
          handleCollapsed("expanded");
        }

        // Scroll opened menu into view
        setTimeout(() => {
          const el = document.querySelectorAll(".sidebar-menu-wrapper .sidebar-parent-item")[topMenuIndex];
          if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "nearest" });
          }
        }, 60);

        // Keep 7 second window for sub-item key selection
        if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current);
        pendingTimerRef.current = setTimeout(() => {
          setPending(null);
        }, 7000);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current);
    };
  }, [collapsed, handleCollapsed, navigateWithDashboardHop]);

  const displayName = user?.fullName || user?.username || "Admin";

  const handleLogout = async (e: React.MouseEvent) => {
    e.preventDefault();
    await logout();
    navigate("/login", { replace: true });
  };

  const handleLinkClick = (e: React.MouseEvent, to: string) => {
    e.preventDefault();
    if (window.innerWidth < 1200) {
      handleCollapsed("collapsed");
    } else if (collapsed === "collapsed") {
      handleCollapsed("expanded");
    }
    const cleanTo = to.startsWith("/") ? to : `/${to}`;
    if (cleanTo === "/kur/pano" || cleanTo.startsWith("/kur/pano?")) {
      window.open(cleanTo, "_blank", "noopener,noreferrer");
      return;
    }
    navigateWithDashboardHop(to);
  };

  return (
    <div
      id={containerId}
      className={`d-flex flex-column h-100 ${sidebarStyle === "dual" ? "sidebar-dual-mode" : ""}`}
    >
      {/* ─── DUAL MODU: Çift Kademeli İkon Şeridi + Yan Panel (Style 5) ─── */}
      {sidebarStyle === "dual" ? (
        <div className="d-flex flex-column h-100 w-100 overflow-hidden">
          {/* En Üstte Yeşil Brand Logo Başlığı (Likya ERP) */}
          <div className="brand-logo d-flex align-items-center justify-content-between justify-content-xl-center px-3 flex-shrink-0">
            <Link
              to="/dashboard"
              onClick={() => {
                if (window.innerWidth < 1200) {
                  handleCollapsed("collapsed");
                } else if (collapsed === "collapsed") {
                  handleCollapsed("expanded");
                }
                setActiveMenuKey("");
              }}
              className="d-flex align-items-center text-decoration-none py-1 overflow-hidden"
              style={{ minWidth: 0, cursor: "pointer" }}
              title="Ana Sayfa"
            >
              <img
                src="/images/logo/logo.svg"
                alt="Likya Kuyum Logo"
                className="site-logo-img flex-shrink-0 me-2"
                style={{ width: "36px", height: "36px", objectFit: "contain", display: "inline-block" }}
              />
              <span className="fw-bold site-logo-text text-nowrap" style={{ fontSize: "1.2rem" }}>
                <span className="brand-text-likya">{getAppBrand(user).prefix}</span>{" "}
                <span className="brand-text-kuyum">{getAppBrand(user).suffix}</span>
              </span>
            </Link>

            {/* Close Button ('X' - visible on all screens <1200px) */}
            <button
              type="button"
              className="btn btn-ghost p-1 d-flex d-xl-none align-items-center justify-content-center rounded-circle text-white"
              onClick={() => handleCollapsed("collapsed")}
              title="Menüyü Kapat"
            >
              <IconX size={22} />
            </button>
          </div>

          {/* Alt Kısım: Sol Dar İkon Şeridi (64px) + Sağ Alt Başlıklar Paneli (206px) */}
          <div className="d-flex flex-row flex-grow-1 overflow-hidden">
            {/* Sol Dar İkon Şeridi (64px) */}
            <div
              className="d-flex flex-column align-items-center flex-shrink-0 h-100 py-2 border-end"
              style={{
                width: "64px",
                backgroundColor: "var(--user-menu-bg, #ffffff)",
                borderColor: "#e2e8f0",
              }}
            >
              {/* Modül Butonları */}
              <div className="d-flex flex-column align-items-center gap-2 flex-grow-1 overflow-y-auto w-100 px-1 scrollbar-none">
              {gorunenMenu.map((m, idx) => {
                if (m.grouptitle) return null;
                const theme = getThemeForMenu(m, idx);
                const isDualActive = activeDualIndex === idx;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      if (collapsed === "collapsed") {
                        handleCollapsed("expanded");
                      }
                      setActiveDualIndex(idx);
                      if (m.link && (!m.children || m.children.length === 0)) {
                        navigateWithDashboardHop(m.link);
                      }
                    }}
                    title={m.title}
                    className={`btn p-0 d-flex align-items-center justify-content-center rounded-3 border-0 transition-all ${
                      isDualActive ? "shadow-sm" : ""
                    }`}
                    style={{
                      width: "42px",
                      height: "42px",
                      backgroundColor: isDualActive ? theme.color : theme.bg,
                      color: isDualActive ? "#ffffff" : theme.color,
                      border: isDualActive
                        ? `2px solid ${theme.color}`
                        : `1px solid ${theme.borderColor || "transparent"}`,
                    }}
                  >
                    {m.icon}
                  </button>
                );
              })}
            </div>

            {/* Alt Profil Butonu */}
            <div
              className="mt-auto d-flex align-items-center justify-content-center rounded-circle flex-shrink-0"
              style={{
                width: "36px",
                height: "36px",
                backgroundColor: "#f1f5f9",
                border: "1.5px solid #cbd5e1",
                cursor: "pointer",
              }}
              title={displayName}
              onClick={() => navigate("/sifre-degistir")}
            >
              <IconUser size={18} className="text-dark" />
            </div>
          </div>

          {/* Sağ Alt Başlıklar Paneli (204px) */}
          <div
            className="sidebar-dual-subpanel d-flex flex-column flex-grow-1 h-100 overflow-hidden"
            style={{
              width: "204px",
              backgroundColor: "#f8fafc",
            }}
          >
            {(() => {
              const activeModule = gorunenMenu[activeDualIndex] || gorunenMenu[0];
              const theme = getThemeForMenu(activeModule, activeDualIndex);
              return (
                <Fragment>
                  <div
                    className="p-3 border-bottom d-flex align-items-center justify-content-between flex-shrink-0"
                    style={{
                      borderColor: "#e2e8f0",
                      backgroundColor: "#ffffff",
                      minHeight: "65px",
                    }}
                  >
                    <div className="d-flex align-items-center gap-2 overflow-hidden">
                      <span
                        className="rounded-circle d-inline-flex align-items-center justify-content-center flex-shrink-0"
                        style={{
                          width: "24px",
                          height: "24px",
                          backgroundColor: theme.bg,
                          color: theme.color,
                          fontSize: "0.75rem",
                        }}
                      >
                        {activeModule.icon}
                      </span>
                      <span className="fw-bold text-dark text-truncate" style={{ fontSize: "0.86rem" }}>
                        {activeModule.title}
                      </span>
                    </div>
                  </div>

                  <div
                    className="flex-grow-1 overflow-y-auto p-2 d-flex flex-column gap-1"
                    style={{ paddingBottom: "36px" }}
                  >
                    {activeModule.children && activeModule.children.length > 0 ? (
                      activeModule.children.map((child1, c1Idx) => {
                        if (child1.children && child1.children.length > 0) {
                          return (
                            <div key={c1Idx} className="mb-2">
                              <div
                                className="text-muted fw-bold text-uppercase px-2 py-1 small"
                                style={{ fontSize: "0.68rem" }}
                              >
                                {child1.title}
                              </div>
                              {child1.children.map((child2, c2Idx) => {
                                const to2 = child2.link?.startsWith("/") ? child2.link : `/${child2.link}`;
                                const isActive = isRouteMatch(to2, currentPath);
                                return (
                                  <Link
                                    key={c2Idx}
                                    to={to2}
                                    onClick={(e) => handleLinkClick(e, to2)}
                                    className={`sidebar-flyout-item ${isActive ? "active text-primary fw-bold" : ""}`}
                                  >
                                    {getSubmenuIcon(child2.name || child2.title || "")}
                                    <span className="text-truncate">{child2.name || child2.title}</span>
                                  </Link>
                                );
                              })}
                            </div>
                          );
                        } else {
                          const to1 = child1.link?.startsWith("/") ? child1.link : `/${child1.link}`;
                          const isActive = isRouteMatch(to1, currentPath);
                          return (
                            <Link
                              key={c1Idx}
                              to={to1}
                              onClick={(e) => handleLinkClick(e, to1)}
                              className={`sidebar-flyout-item ${isActive ? "active text-primary fw-bold" : ""}`}
                            >
                              {getSubmenuIcon(child1.name || child1.title || "")}
                              <span className="text-truncate">{child1.name || child1.title}</span>
                            </Link>
                          );
                        }
                      })
                    ) : activeModule.link ? (
                      <Link
                        to={activeModule.link}
                        onClick={(e) => handleLinkClick(e, activeModule.link!)}
                        className="sidebar-flyout-item active"
                      >
                        <span>{activeModule.title}</span>
                      </Link>
                    ) : null}
                    <div style={{ height: "24px", flexShrink: 0 }} aria-hidden="true" />
                  </div>

                  <div className="p-2 border-top bg-white d-flex align-items-center justify-content-between flex-shrink-0">
                    <span className="small text-muted font-monospace">{currentTime}</span>
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="btn btn-outline-danger btn-sm p-1 rounded-2"
                      title="Çıkış"
                    >
                      <IconLogin2 size={15} />
                    </button>
                  </div>
                </Fragment>
              );
            })()}
          </div>
        </div>
      </div>
      ) : (
        <Fragment>
          {/* 1. Brand Logo Header */}
      {hideLogo || (
        <div className="brand-logo d-flex align-items-center justify-content-between justify-content-xl-center px-3">
          <Link
            to="/dashboard"
            onClick={() => {
              if (collapsed === "collapsed") {
                handleCollapsed("expanded");
              }
              setActiveMenuKey("");
              setPending(null);
              if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current);
            }}
            className="d-flex align-items-center text-decoration-none py-1 overflow-hidden"
            style={{ minWidth: 0, cursor: "pointer" }}
            title="Ana Sayfa (Tüm Menüleri Kapat)"
          >
            <img
              src="/images/logo/logo.svg"
              alt="Likya Kuyum Logo"
              className="site-logo-img flex-shrink-0 me-2"
              style={{ width: "38px", height: "38px", objectFit: "contain", display: "inline-block" }}
            />
            <span
              className="fw-bold site-logo-text text-nowrap"
              style={{ fontSize: "1.25rem" }}
            >
              <span className="brand-text-likya">{getAppBrand(user).prefix}</span>{" "}
              <span className="brand-text-kuyum">{getAppBrand(user).suffix}</span>
            </span>
          </Link>

          {/* Close Button ('X' - visible on all screens <1200px like Nest Hub, tablets, phones) */}
          <button
            type="button"
            className="btn btn-ghost p-1 d-flex d-xl-none align-items-center justify-content-center rounded-circle text-white"
            onClick={() => handleCollapsed("collapsed")}
            title="Menüyü Kapat"
          >
            <IconX size={22} />
          </button>
        </div>
      )}

      {/* 2. Scrollable Navigation Menu */}
      <div className="sidebar-menu-wrapper">
        <Accordion
          activeKey={activeMenuKey}
          onSelect={(k: any) => {
            if (collapsed === "collapsed") {
              handleCollapsed("expanded");
            }
            const nextKey = k ? String(k) : "";
            setActiveMenuKey(nextKey);
            const idx = parseInt(nextKey, 10);
            if (!isNaN(idx)) {
              setPending(idx);
              if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current);
              pendingTimerRef.current = setTimeout(() => {
                setPending(null);
              }, 7000);
            } else {
              setPending(null);
              if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current);
            }
          }}
          as="ul"
          className="navbar-nav flex-column mb-0"
        >
          {gorunenMenu.map(function (menu, index) {
            const theme = getThemeForMenu(menu, index);

            if (menu.grouptitle) {
              return (
                <div key={index} className="sidebar-menu-section nav-heading-section">
                  <Nav.Item as="li" className="nav-heading-item">
                    <div className="nav-heading">{menu.title}</div>
                  </Nav.Item>
                </div>
              );
            } else {
              if (menu.children) {
                const isFlyoutOpen = sidebarStyle === "flyout" && flyoutIndex === index;
                return (
                  <div
                    key={index}
                    className={`sidebar-menu-section position-relative ${sidebarStyle === "flyout" ? "sidebar-flyout-section" : ""}`}
                    onMouseEnter={(e) => {
                      if (sidebarStyle === "flyout") {
                        openFlyoutAt(index, e.currentTarget);
                      }
                    }}
                    onMouseLeave={() => {
                      if (sidebarStyle === "flyout") {
                        closeFlyoutWithDelay();
                      }
                    }}
                  >
                    {/* Dropdown Parent Menu with Colorful Icon Badge */}
                    {sidebarStyle === "flyout" ? (
                      <div
                        onClick={(e) => handleFlyoutToggle(index, e)}
                        className={`nav-link accordion-button sidebar-flyout-trigger d-flex align-items-center justify-content-between cursor-pointer ${
                          isFlyoutOpen ? "active" : ""
                        }`}
                        style={{ cursor: "pointer" }}
                        title={menu.title}
                      >
                        <div className="d-flex align-items-center gap-2 overflow-hidden w-100">
                          <span
                            className="sidebar-icon-pill d-inline-flex align-items-center justify-content-center rounded-2 p-1 flex-shrink-0"
                            style={{
                              width: "28px",
                              height: "28px",
                              backgroundColor: theme.bg,
                              color: theme.color,
                              border: `1px solid ${theme.borderColor || "transparent"}`,
                            }}
                          >
                            {menu.icon}
                          </span>
                          <span className="sidebar-menu-title fw-semibold text-dark text-truncate" style={{ fontSize: "0.88rem" }}>
                            {menu.title}
                          </span>
                        </div>
                        <IconChevronRight
                          size={15}
                          className={`sidebar-chevron text-secondary opacity-75 transition-transform flex-shrink-0 ${isFlyoutOpen ? "rotate-90 text-primary" : ""}`}
                        />
                      </div>
                    ) : (
                      <CustomToggle
                        eventKey={index.toString()}
                        icon={menu.icon}
                        theme={theme}
                      >
                        {menu.title}
                      </CustomToggle>
                    )}

                    {/* Style 3: Floating Card Popover to the RIGHT (Position: fixed ile viewport seviyesinde asla kesilmez!) */}
                    {sidebarStyle === "flyout" && isFlyoutOpen && flyoutPos && (
                      <div
                        className="sidebar-flyout-card position-fixed"
                        style={{
                          left: `${flyoutPos.left}px`,
                          top: `${flyoutPos.top}px`,
                          zIndex: 1350,
                          backgroundColor: "#ffffff",
                          border: "1.5px solid #cbd5e1",
                          borderRadius: "12px",
                          boxShadow: "0 22px 50px rgba(0, 0, 0, 0.28), 0 8px 20px rgba(0, 0, 0, 0.12)",
                          minWidth: "260px",
                          maxWidth: "340px",
                          maxHeight: `calc(100vh - ${flyoutPos.top + 14}px)`,
                          overflowY: "auto",
                          overflowX: "hidden",
                          padding: "8px 6px 16px 6px",
                        }}
                        onMouseEnter={clearFlyoutTimer}
                        onMouseLeave={closeFlyoutWithDelay}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="d-flex flex-column gap-1">
                          {menu.children.map(function (menuLevel1Item, menuLevel1Index) {
                            const l1Title = menuLevel1Item.title || menuLevel1Item.name || "";
                            if (menuLevel1Item.children && menuLevel1Item.children.length > 0) {
                              return (
                                <div key={menuLevel1Index} className="px-1 py-0.5">
                                  <div
                                    className="text-muted fw-bold text-uppercase px-2 py-1"
                                    style={{ fontSize: "0.7rem", letterSpacing: "0.5px" }}
                                  >
                                    {l1Title}
                                  </div>
                                  {menuLevel1Item.children.map(function (menuLevel2Item, menuLevel2Index) {
                                    const l2Title = menuLevel2Item.title || menuLevel2Item.name || "";
                                    const to2 = menuLevel2Item.link?.startsWith("/")
                                      ? menuLevel2Item.link
                                      : `/${menuLevel2Item.link}`;
                                    const isActive2 = isRouteMatch(to2, currentPath);
                                    return (
                                      <Link
                                        key={menuLevel2Index}
                                        to={to2}
                                        onClick={(e) => {
                                          setFlyoutIndex(null);
                                          setFlyoutPos(null);
                                          handleLinkClick(e, to2);
                                        }}
                                        className={`sidebar-flyout-item ${isActive2 ? "active text-primary fw-bold" : ""}`}
                                      >
                                        {getSubmenuIcon(l2Title)}
                                        <span>{l2Title}</span>
                                      </Link>
                                    );
                                  })}
                                </div>
                              );
                            } else {
                              const to1 = menuLevel1Item.link?.startsWith("/")
                                ? menuLevel1Item.link
                                : `/${menuLevel1Item.link}`;
                              const isActive1 = isRouteMatch(to1, currentPath);
                              return (
                                <Link
                                  key={menuLevel1Index}
                                  to={to1}
                                  onClick={(e) => {
                                    setFlyoutIndex(null);
                                    setFlyoutPos(null);
                                    handleLinkClick(e, to1);
                                  }}
                                  className={`sidebar-flyout-item ${isActive1 ? "active text-primary fw-bold" : ""}`}
                                >
                                  {getSubmenuIcon(l1Title)}
                                  <span>{l1Title}</span>
                                </Link>
                              );
                            }
                          })}
                          <div style={{ height: "16px", flexShrink: 0 }} aria-hidden="true" />
                        </div>
                      </div>
                    )}

                    {/* Normal Downward Accordion Collapse (Hidden in Flyout Mode) */}
                    {sidebarStyle !== "flyout" && (
                      <Accordion.Collapse eventKey={index.toString()}>
                        <ListGroup
                          as="ul"
                          className="sidebar-submenu-list flex-column show position-static bg-transparent py-1"
                        >
                          {menu.children.map(function (
                            menuLevel1Item,
                            menuLevel1Index
                          ) {
                            if (menuLevel1Item.children) {
                              return (
                                <ListGroup.Item
                                  as="li"
                                  bsPrefix="nav-item"
                                  key={menuLevel1Index}
                                  className="w-100 mb-0.5"
                                >
                                  {/* Nested Level 2 Accordion */}
                                  <Accordion
                                    activeKey={
                                      menuLevel1Item.children.some((c2) => isRouteMatch(c2.link, currentPath))
                                        ? `sub-${menuLevel1Index}`
                                        : undefined
                                    }
                                    defaultActiveKey={
                                      menuLevel1Item.children.some((c2) => isRouteMatch(c2.link, currentPath))
                                        ? `sub-${menuLevel1Index}`
                                        : ""
                                    }
                                    className="nav flex-column w-100 p-0 m-0"
                                  >
                                    <CustomToggleLevel2
                                      eventKey={`sub-${menuLevel1Index}`}
                                      href="#link"
                                    >
                                      {menuLevel1Item.title}
                                    </CustomToggleLevel2>
                                    <Accordion.Collapse eventKey={`sub-${menuLevel1Index}`}>
                                      <ListGroup
                                        as="ul"
                                        className="nav flex-column ps-2 py-1"
                                      >
                                        {menuLevel1Item.children.map(function (
                                          menuLevel2Item,
                                          menuLevel2Index
                                        ) {
                                          const to2 = menuLevel2Item.link?.startsWith("/")
                                            ? menuLevel2Item.link
                                            : `/${menuLevel2Item.link}`;
                                          const isActive2 = isRouteMatch(to2, currentPath);
                                          return (
                                            <ListGroup.Item
                                              key={menuLevel2Index}
                                              as="li"
                                              bsPrefix="nav-item"
                                            >
                                              <Link
                                                to={to2}
                                                onClick={(e) => handleLinkClick(e, to2)}
                                                className={`nav-link sidebar-sub-link py-1 px-2.5 ${
                                                  isActive2 ? "active" : ""
                                                }`}
                                              >
                                                {getSubmenuIcon(menuLevel2Item.name || menuLevel2Item.title || "")}
                                                <span className="text ms-1">
                                                  {menuLevel2Item.name || menuLevel2Item.title}
                                                </span>
                                              </Link>
                                            </ListGroup.Item>
                                          );
                                        })}
                                      </ListGroup>
                                    </Accordion.Collapse>
                                  </Accordion>
                                </ListGroup.Item>
                              );
                            } else {
                              const to1 = menuLevel1Item.link?.startsWith("/")
                                ? menuLevel1Item.link
                                : `/${menuLevel1Item.link}`;
                              const isActive1 = isRouteMatch(to1, currentPath);
                              return (
                                <ListGroup.Item
                                  as="li"
                                  bsPrefix="nav-item"
                                  key={menuLevel1Index}
                                  className="mb-0.5"
                                >
                                  <Link
                                    to={to1}
                                    onClick={(e) => handleLinkClick(e, to1)}
                                    className={`nav-link sidebar-sub-link py-1 px-2.5 ${
                                      isActive1 ? "active" : ""
                                    }`}
                                  >
                                    {getSubmenuIcon(menuLevel1Item.name || menuLevel1Item.title || "")}
                                    <span className="text ms-1">
                                      {menuLevel1Item.name || menuLevel1Item.title}
                                    </span>
                                  </Link>
                                </ListGroup.Item>
                              );
                            }
                          })}
                        </ListGroup>
                      </Accordion.Collapse>
                    )}
                  </div>
                );
              } else {
                const to = menu.link?.startsWith("/")
                  ? menu.link
                  : menu.link
                  ? `/${menu.link}`
                  : "#";
                const isTopActive = isRouteMatch(to, currentPath);
                return (
                  <div key={index} className="sidebar-menu-section">
                    <Nav.Item as="li" className="sidebar-parent-item">
                      <Link
                        to={to}
                        onClick={(e) => handleLinkClick(e, to)}
                        className={`sidebar-menu-btn nav-link d-flex align-items-center ${
                          isTopActive ? "active" : ""
                        }`}
                      >
                        {menu.icon && (
                          <span
                            className="sidebar-icon-pill d-inline-flex align-items-center justify-content-center flex-shrink-0"
                            style={{
                              backgroundColor: theme.bg,
                              color: theme.color,
                              border: `1px solid ${theme.borderColor || "transparent"}`,
                            }}
                          >
                            {menu.icon}
                          </span>
                        )}
                        <span className="sidebar-menu-title text flex-grow-1 text-truncate">
                          {menu.title}
                        </span>
                        {menu.badge && (
                          <Badge
                            className="ms-1"
                            bg={menu.badgecolor ? menu.badgecolor : "primary"}
                          >
                            {menu.badge}
                          </Badge>
                        )}
                      </Link>
                    </Nav.Item>
                  </div>
                );
              }
            }
          })}
          <div style={{ height: "48px", flexShrink: 0 }} aria-hidden="true" />
        </Accordion>
      </div>

      {/* 3. Bottom User Profile Bar (Full Sidebar Width, Centered & Aesthetic) */}
      <div
        className="flex-shrink-0 border-top px-3 pt-3 pb-3.5 w-100"
        style={{
          borderColor: "#e2e8f0",
          background: "linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)",
          boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.8)",
          minHeight: "88px",
        }}
      >
        <div className="d-flex align-items-center justify-content-between w-100">
          {/* User Icon (Dark Gray with Online Dot) */}
          <div
            className="d-flex align-items-center justify-content-center rounded-circle flex-shrink-0 position-relative"
            style={{
              width: "38px",
              height: "38px",
              backgroundColor: "#ffffff",
              border: "1.5px solid #94a3b8",
              boxShadow: "0 2px 5px rgba(15, 23, 42, 0.08)",
            }}
            title={`Kullanıcı: ${displayName}`}
          >
            <IconUser size={21} strokeWidth={2.2} style={{ color: "#1e293b" }} />
            <span
              className="position-absolute rounded-circle"
              style={{
                width: "9px",
                height: "9px",
                backgroundColor: "#10b981",
                border: "2px solid #ffffff",
                boxShadow: "0 0 4px #10b981",
                bottom: "-1px",
                right: "-1px",
              }}
              title="Çevrimiçi"
            />
          </div>

          {/* Ortalı Kullanıcı Bilgileri (1. Satır: İsim, 2. Satır: Tarih & Saat, 3. Satır: Vezne) */}
          <div className="d-flex flex-column align-items-center justify-content-center text-center flex-grow-1 px-1 overflow-hidden">
            {/* 1. Satır: Kullanıcı Adı */}
            <h6
              className="mb-1 text-truncate fw-bold text-dark w-100"
              style={{ fontSize: "0.88rem", letterSpacing: "0.2px" }}
            >
              {displayName}
            </h6>

            {/* 2. Satır: Tarih ve Saat Yan Yana */}
            <div
              className="d-flex align-items-center justify-content-center gap-1.5 w-100 text-secondary"
              style={{ fontSize: "0.75rem", lineHeight: "1.2" }}
            >
              <span className="d-inline-flex align-items-center gap-1 text-dark fw-semibold text-nowrap">
                <IconCalendar size={12} className="text-primary flex-shrink-0" />
                {currentDate}
              </span>
              <span className="text-muted opacity-50">•</span>
              <span className="d-inline-flex align-items-center gap-1 text-nowrap font-monospace fw-bold text-secondary">
                <IconClock size={12} className="text-secondary flex-shrink-0" />
                {currentTime}
              </span>
            </div>

            {/* 3. Satır: Vezne Adı */}
            <div
              className="d-flex align-items-center justify-content-center gap-1 w-100 mt-1"
              style={{ fontSize: "0.75rem" }}
            >
              {(() => {
                const raw = (vezneName || user?.vezneAd || user?.cashierCode || "Ana Vezne").trim();
                const cleaned = raw.replace(/^(vezne\s*[:\-]?\s*)+/i, "").trim() || raw;
                return (
                  <span
                    className="d-inline-flex align-items-center gap-1 text-nowrap font-monospace fw-semibold text-dark"
                    style={{ letterSpacing: "0.2px", fontSize: "0.74rem", color: "#000" }}
                    title={`Vezne: ${cleaned}`}
                  >
                    <IconCash size={14} className="text-dark flex-shrink-0" />
                    <span className="text-dark" style={{ color: "#000" }}>Vezne: {cleaned}</span>
                  </span>
                );
              })()}
            </div>
          </div>

          {/* Kilit ve Çıkış Butonları (Altlı Üstlü) */}
          <div className="d-flex flex-column gap-1 flex-shrink-0 align-items-center justify-content-center">
            {kurulumSurumu && (
              <button
                type="button"
                onClick={() => navigate("/lisans-surum")}
                className="btn btn-outline-secondary btn-sm p-0 d-flex align-items-center justify-content-center rounded-2 shadow-xs"
                title="Lisans ve Sürüm"
                style={{ width: "28px", height: "28px", transition: "all 0.2s ease" }}
              >
                <IconLicense size={15} />
              </button>
            )}
            {/* Anahtar / Şifre Değiştir */}
            <button
              type="button"
              onClick={() => navigate("/sifre-degistir")}
              className="btn btn-outline-secondary btn-sm p-0 d-flex align-items-center justify-content-center rounded-2 shadow-xs"
              title="Şifre Değiştir"
              style={{ width: "28px", height: "28px", transition: "all 0.2s ease" }}
            >
              <IconKey size={15} />
            </button>

            {/* Direct Logout Button */}
            <button
              type="button"
              onClick={handleLogout}
              className="btn btn-outline-danger btn-sm p-0 d-flex align-items-center justify-content-center rounded-2 shadow-xs"
              title="Güvenli Çıkış Yap"
              style={{ width: "28px", height: "28px", transition: "all 0.2s ease" }}
            >
              <IconLogin2 size={15} />
            </button>
          </div>
        </div>
      </div>
        </Fragment>
      )}
    </div>
  );
};

export default Sidebar;
