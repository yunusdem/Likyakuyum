import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { DashboardMenu } from "../routes/DashboardRoute";
import { menuyuKullaniciyaSuz, menuyuSuz } from "../config/modulKatalogu";
import { useKullaniciYetkisi } from "../hooks/useKullaniciYetkisi";
import { solMenuyuBirlestir } from "../config/solMenuBirlesimi";
import { getAppBrand } from "../utils/brandHelper";
import { AlanDegistirDugmesi } from "../components/alan/AlanDegistir";
import {
  getThemeForMenu,
  getSubmenuIcon,
} from "./Sidebar";
import {
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconArrowRight,
  IconSearch,
  IconX,
  IconLayoutGrid,
} from "@tabler/icons-react";
import useSidebarStyle from "../hooks/useSidebarStyle";

import { CashDeskService } from "../services/cashDeskService";

export const TopNavbarMenu: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname;
  const brand = getAppBrand(user);
  const sidebarStyle = useSidebarStyle();
  const isMegaMenu = sidebarStyle === "megamenu" || sidebarStyle === "drawer";
  const isRibbon = sidebarStyle === "ribbon";
  const isDock = sidebarStyle === "dock";
  const isPillbar = sidebarStyle === "pillbar";
  const isIconbar = sidebarStyle === "iconbar";
  const isCentered = sidebarStyle === "centered";
  const isCmdbar = sidebarStyle === "cmdbar";
  const isFullgrid = sidebarStyle === "fullgrid";
  const isSplitbar = sidebarStyle === "splitbar";

  const [cmdQuery, setCmdQuery] = useState<string>("");
  const [cmdFocused, setCmdFocused] = useState<boolean>(false);
  const [fullgridOpen, setFullgridOpen] = useState<boolean>(false);
  const [splitHoverIdx, setSplitHoverIdx] = useState<number>(0);

  // Üst menü çubuğunun sağdaki kullanıcı/vezne kutusunun üstüne taşmaması için yatay kaydırma + yön okları
  const useScrollableTopRow = isRibbon || isCmdbar || isPillbar || isIconbar;
  const topRowScrollRef = useRef<HTMLDivElement>(null);
  const [topCanScrollLeft, setTopCanScrollLeft] = useState<boolean>(false);
  const [topCanScrollRight, setTopCanScrollRight] = useState<boolean>(false);
  const [dropdownAnchor, setDropdownAnchor] = useState<{ top: number; left: number } | null>(null);

  const checkTopRowScroll = useCallback(() => {
    const el = topRowScrollRef.current;
    if (!el) return;
    setTopCanScrollLeft(el.scrollLeft > 4);
    setTopCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  const scrollTopRow = useCallback((dir: "left" | "right") => {
    const el = topRowScrollRef.current;
    if (!el) return;
    setActiveDropdownIndex(null);
    el.scrollBy({ left: dir === "left" ? -240 : 240, behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (!useScrollableTopRow) return;
    const t = setTimeout(checkTopRowScroll, 80);
    window.addEventListener("resize", checkTopRowScroll);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", checkTopRowScroll);
    };
  }, [useScrollableTopRow, sidebarStyle, checkTopRowScroll]);

  const displayName = user?.fullName || user?.username || "Admin";

  const [currentDate, setCurrentDate] = useState<string>(() =>
    new Date().toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" })
  );
  const [currentTime, setCurrentTime] = useState<string>(() =>
    new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })
  );

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentDate(
        now.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" })
      );
      setCurrentTime(
        now.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })
      );
    }, 1000);
    return () => clearInterval(timer);
  }, []);

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

  const cleanVezne = (() => {
    const raw = (vezneName || user?.vezneAd || (user?.cashierCode ? `Vezne ${user.cashierCode}` : "Ana Vezne")).trim();
    return raw.replace(/^(vezne\s*[:\-]?\s*)+/i, "").trim() || raw;
  })();

  const [activeDropdownIndex, setActiveDropdownIndex] = useState<number | null>(null);
  const [activeRibbonIndex, setActiveRibbonIndex] = useState<number>(0);
  const [ribbonCanScrollLeft, setRibbonCanScrollLeft] = useState<boolean>(false);
  const [ribbonCanScrollRight, setRibbonCanScrollRight] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const ribbonScrollRef = useRef<HTMLDivElement>(null);
  const hoverTimeoutRef = useRef<any>(null);

  const checkRibbonScroll = useCallback(() => {
    const el = ribbonScrollRef.current;
    if (!el) return;
    setRibbonCanScrollLeft(el.scrollLeft > 4);
    setRibbonCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  const scrollRibbon = useCallback((dir: "left" | "right") => {
    const el = ribbonScrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir === "left" ? -280 : 280, behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (!isRibbon) return;
    const t = setTimeout(checkRibbonScroll, 60);
    window.addEventListener("resize", checkRibbonScroll);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", checkRibbonScroll);
    };
  }, [isRibbon, activeRibbonIndex, checkRibbonScroll]);

  // Kullanıcının kart menü yetkileri (harf listesi): yetkisiz ana menü / madde çizilmez
  const kullaniciYetkisi = useKullaniciYetkisi();
  const gorunenMenu = useMemo(() => {
    // Süzme boş dönerse menü boş kalır: eskiden tam menü (lisans + yetki süzmesiz) gösteriliyordu
    // (docs/YETKI_DASHBOARD_ISCILIK_YOL_HARITASI.md Y4)
    return solMenuyuBirlestir(menuyuKullaniciyaSuz(menuyuSuz(DashboardMenu, user?.merkez?.moduller), kullaniciYetkisi));
  }, [user?.merkez?.moduller, kullaniciYetkisi]);

  // Ribbon modunda aktif route'a karşılık gelen sekmeyi otomatik seç
  useEffect(() => {
    if (!isRibbon || gorunenMenu.length === 0) return;
    const matchedIdx = gorunenMenu.findIndex((m) => {
      if (m.grouptitle) return false;
      if (m.link) {
        const clean = m.link.startsWith("/") ? m.link : `/${m.link}`;
        if (currentPath === clean || currentPath.startsWith(`${clean}/`)) return true;
      }
      return m.children?.some((c) => {
        if (c.link) {
          const clean = c.link.startsWith("/") ? c.link : `/${c.link}`;
          if (currentPath === clean || currentPath.startsWith(`${clean}/`)) return true;
        }
        return c.children?.some((c2) => {
          if (!c2.link) return false;
          const clean = c2.link.startsWith("/") ? c2.link : `/${c2.link}`;
          return currentPath === clean || currentPath.startsWith(`${clean}/`);
        });
      });
    });
    if (matchedIdx >= 0) {
      setActiveRibbonIndex(matchedIdx);
    } else {
      const firstWithChildren = gorunenMenu.findIndex((m) => !m.grouptitle && m.children && m.children.length > 0);
      if (firstWithChildren >= 0) setActiveRibbonIndex(firstWithChildren);
    }
  }, [isRibbon, currentPath, gorunenMenu]);

  // Mouse ile üzerine gelince anında otomatik açılma (Hover)
  const handleMouseEnter = (index: number) => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setActiveDropdownIndex(index);
  };

  // Mouse ayrılınca yumuşak kapanma gecikmesi (kullanıcı alt menüye geçerken kapanmasın)
  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    hoverTimeoutRef.current = setTimeout(() => {
      setActiveDropdownIndex(null);
    }, 220);
  };

  // Dışarı tıklandığında menüyü kapat
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setActiveDropdownIndex(null);
        setFullgridOpen(false);
        setCmdFocused(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Route değiştiğinde menüyü kapat
  useEffect(() => {
    setActiveDropdownIndex(null);
    setFullgridOpen(false);
    setCmdFocused(false);
    setCmdQuery("");
  }, [location.pathname]);

  // 19. CMDBAR: Canlı arama sonuçları
  const cmdResults = useMemo(() => {
    const q = cmdQuery.trim().toLocaleLowerCase("tr-TR");
    if (!isCmdbar || !q) return [];
    const list: { title: string; parent: string; link: string; color: string }[] = [];
    gorunenMenu.forEach((m, idx) => {
      if (m.grouptitle) return;
      const t = getThemeForMenu(m, idx);
      if (m.link && (!m.children || m.children.length === 0)) {
        if ((m.title || "").toLocaleLowerCase("tr-TR").includes(q)) {
          list.push({ title: m.title, parent: "Ana Menü", link: m.link, color: t.color });
        }
      }
      m.children?.forEach((c) => {
        const cTitle = c.title || c.name || "";
        if (c.children && c.children.length > 0) {
          c.children.forEach((s) => {
            const sTitle = s.title || s.name || "";
            if (
              s.link &&
              (sTitle.toLocaleLowerCase("tr-TR").includes(q) ||
                cTitle.toLocaleLowerCase("tr-TR").includes(q) ||
                (m.title || "").toLocaleLowerCase("tr-TR").includes(q))
            ) {
              list.push({ title: sTitle, parent: `${m.title} › ${cTitle}`, link: s.link, color: t.color });
            }
          });
        } else if (
          c.link &&
          (cTitle.toLocaleLowerCase("tr-TR").includes(q) ||
            (m.title || "").toLocaleLowerCase("tr-TR").includes(q))
        ) {
          list.push({ title: cTitle, parent: m.title, link: c.link, color: t.color });
        }
      });
    });
    return list.slice(0, 18);
  }, [isCmdbar, cmdQuery, gorunenMenu]);

  const navigateWithDashboardHop = useCallback(
    (to: string) => {
      const normTarget = to.startsWith("/") ? to : `/${to}`;
      if (normTarget === "/dashboard" || normTarget === "/") {
        navigate("/dashboard");
        return;
      }
      navigate("/dashboard", { replace: true });
      setTimeout(() => {
        navigate(normTarget);
      }, 15);
    },
    [navigate]
  );

  const handleLinkClick = (e: React.MouseEvent, to: string) => {
    e.preventDefault();
    setActiveDropdownIndex(null);
    const cleanTo = to.startsWith("/") ? to : `/${to}`;
    if (cleanTo === "/kur/pano" || cleanTo.startsWith("/kur/pano?")) {
      const sw = window.screen.availWidth || window.innerWidth;
      const sh = window.screen.availHeight || window.innerHeight;
      window.open(cleanTo, "_blank", `width=${sw},height=${sh},left=0,top=0,menubar=no,toolbar=no,location=no,status=no,resizable=yes`);
      return;
    }
    navigateWithDashboardHop(to);
  };

  const isItemActive = (link?: string): boolean => {
    if (!link) return false;
    const clean = link.startsWith("/") ? link : `/${link}`;
    return currentPath === clean || currentPath.startsWith(`${clean}/`);
  };

  const activeRibbonMenu = useMemo(() => {
    if (!isRibbon) return null;
    const candidate = gorunenMenu[activeRibbonIndex];
    if (candidate && !candidate.grouptitle && candidate.children && candidate.children.length > 0) {
      return candidate;
    }
    return gorunenMenu.find((m) => !m.grouptitle && m.children && m.children.length > 0) || null;
  }, [isRibbon, gorunenMenu, activeRibbonIndex]);

  return (
    <nav
      ref={containerRef}
      className={`top-navbar-menu-container w-100 position-sticky top-0 ${
        isPillbar ? "topbar-pillbar-mode px-3 pt-1.5 pb-1" : "shadow-sm"
      } ${isDock ? "topbar-dock-mode" : isRibbon ? "topbar-ribbon-mode" : ""} ${
        isIconbar ? "topbar-iconbar-mode" : ""
      } ${isCentered ? "topbar-centered-mode" : ""} ${
        isSplitbar ? "topbar-splitbar-mode" : ""
      }`}
      style={{
        zIndex: 1060,
        backgroundColor: isPillbar
          ? "transparent"
          : isDock
          ? "#0f172a"
          : isSplitbar
          ? "#065f46"
          : "#ffffff",
        backgroundImage: isSplitbar
          ? "linear-gradient(90deg, #065f46 0%, #047857 50%, #064e3b 100%)"
          : undefined,
        borderBottom: isPillbar
          ? "none"
          : isDock
          ? "1px solid rgba(148, 163, 184, 0.25)"
          : isSplitbar
          ? "1px solid rgba(255, 255, 255, 0.18)"
          : "1px solid rgba(0, 0, 0, 0.12)",
        overflow: "visible",
        WebkitFontSmoothing: "antialiased",
        MozOsxFontSmoothing: "grayscale",
        textRendering: "optimizeLegibility",
      }}
    >
      <style>{`
        /* 1. SİDEBARTAKİ GİBİ ALTIN YALDIZLI PARLAK LİKYA ERP YAZISI */
        .topbar-brand-box .brand-text-likya,
        .topbar-brand-box .brand-text-kuyum {
          font-family: 'Cinzel', 'Playfair Display', 'Bodoni Moda', 'Marcellus', 'Georgia', serif, sans-serif !important;
          font-weight: 800 !important;
          background: linear-gradient(135deg, #FFFFDE 0%, #FDE075 35%, #E8B84B 70%, #B8822E 100%) !important;
          background-clip: text !important;
          -webkit-background-clip: text !important;
          -webkit-text-fill-color: transparent !important;
          color: #FDE075 !important;
          letter-spacing: 0.8px;
          display: inline-block;
          filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.45));
        }

        /* Desktop Menubar Buton Stilleri (Windows Menü Çubuğu Tarzı Kompakt ve Şık) */
        .desktop-menubar-btn {
          font-size: 11.5px !important;
          font-weight: 700 !important;
          color: #0f172a !important;
          padding: 3px 6.5px !important;
          border-radius: 4px !important;
          border: 1px solid transparent !important;
          background: transparent !important;
          white-space: nowrap !important;
          line-height: 1.25 !important;
          transition: background-color 0.12s ease, border-color 0.12s ease, color 0.12s ease !important;
          user-select: none !important;
          text-decoration: none !important;
          -webkit-font-smoothing: antialiased !important;
          -moz-osx-font-smoothing: grayscale !important;
          text-rendering: optimizeLegibility !important;
        }
        .desktop-menubar-btn:hover {
          background-color: #f1f5f9 !important;
          border-color: #cbd5e1 !important;
          color: #0284c7 !important;
        }
        .desktop-menubar-btn.active {
          color: #0284c7 !important;
          font-weight: 800 !important;
          background-color: #e0f2fe !important;
        }
        .desktop-menubar-btn.open {
          background-color: #e0f2fe !important;
          border-color: #90caf9 !important;
          color: #0284c7 !important;
        }

        /* İnce Bölüm Ayırıcı Çizgi */
        .topbar-menu-divider {
          display: inline-block;
          width: 1px;
          height: 13px;
          background-color: #cbd5e1;
          margin: 0 1.5px;
          flex-shrink: 0;
          opacity: 0.8;
        }

        /* Responsive Düzenlemeler - Ekran Küçüldüğünde Tam Sığma */
        @media (max-width: 1366px) {
          .desktop-menubar-btn {
            font-size: 10.5px !important;
            padding: 2px 4.5px !important;
          }
          .topbar-brand-box {
            min-width: 140px !important;
            padding-left: 10px !important;
            padding-right: 10px !important;
          }
        }
        @media (max-width: 1200px) {
          .desktop-menubar-btn {
            font-size: 10px !important;
            padding: 1.5px 3.5px !important;
          }
          .desktop-menubar-btn .menu-icon-wrap {
            display: none !important;
          }
          .topbar-menu-divider {
            margin: 0 1px !important;
          }
          .topbar-brand-box {
            min-width: 125px !important;
            padding-left: 6px !important;
            padding-right: 6px !important;
          }
          .topbar-brand-box .site-logo-text {
            font-size: 0.9rem !important;
          }
          .topbar-info-box {
            min-width: 105px !important;
            max-width: 125px !important;
            padding-left: 5px !important;
            padding-right: 5px !important;
          }
        }
        @media (max-width: 992px) {
          .desktop-menubar-btn {
            font-size: 9.5px !important;
            padding: 1px 2px !important;
          }
        }

        /* Desktop Menubar Açılır Liste */
        .desktop-dropdown-menu {
          background: #ffffff !important;
          border: 1px solid #cbd5e1 !important;
          border-radius: 3px !important;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.14), 0 2px 6px rgba(0, 0, 0, 0.06) !important;
          min-width: 210px !important;
          padding: 3px 0 !important;
        }
        .desktop-dropdown-item {
          display: flex !important;
          align-items: center !important;
          justify-content: space-between !important;
          padding: 5px 12px !important;
          font-size: 12px !important;
          font-weight: 600 !important;
          color: #0f172a !important;
          text-decoration: none !important;
          transition: background-color 0.1s ease, color 0.1s ease !important;
          white-space: nowrap !important;
          -webkit-font-smoothing: antialiased !important;
          -moz-osx-font-smoothing: grayscale !important;
        }
        .desktop-dropdown-item:hover {
          background-color: #e0f2fe !important;
          color: #0369a1 !important;
        }
        .desktop-dropdown-item.active {
          background-color: #eff6ff !important;
          color: #1d4ed8 !important;
          font-weight: 700 !important;
        }

        /* 6. MOD MODERN MEGA MENÜ ELEMANLARI (YAZILAR ASLA ÜST ÜSTE BİNMEZ, ARMA YOK) */
        .mega-clean-link {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 6px 11px;
          background-color: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          text-decoration: none;
          color: #0f172a;
          font-size: 12px;
          font-weight: 600;
          transition: all 0.12s ease-in-out;
          margin-bottom: 4px;
          white-space: nowrap;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }
        .mega-clean-link:hover {
          background-color: #ffffff;
          border-color: #38bdf8;
          box-shadow: 0 3px 10px rgba(56, 189, 248, 0.15);
          transform: translateX(2px);
          color: #0284c7;
        }
        .mega-clean-link.active {
          background-color: #eff6ff;
          border-color: #60a5fa;
          color: #1d4ed8;
          font-weight: 700;
        }

        .animate-dropdown-fade {
          animation: dropdownFadeIn 0.18s cubic-bezier(0.16, 1, 0.3, 1);
        }
        @keyframes dropdownFadeIn {
          from {
            opacity: 0;
            transform: translateY(4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        /* 11. MOD: ŞERİT SEKMELİ ÜST MENÜ (RIBBON) */
        .ribbon-tab-btn {
          font-size: 12px !important;
          font-weight: 700 !important;
          color: #334155 !important;
          padding: 6px 10px !important;
          border-radius: 6px 6px 0 0 !important;
          border: 1px solid transparent !important;
          border-bottom: 2px solid transparent !important;
          background: transparent !important;
          white-space: nowrap !important;
          transition: all 0.14s ease !important;
        }
        .ribbon-tab-btn:hover {
          background-color: #f1f5f9 !important;
          color: #0284c7 !important;
        }
        .ribbon-tab-btn.active {
          background-color: #f8fafc !important;
          color: #0284c7 !important;
          border-color: #e2e8f0 !important;
          border-bottom: 2px solid #0284c7 !important;
        }
        .ribbon-substrip-wrap {
          background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%);
          border-top: 1px solid #e2e8f0;
          position: relative;
        }
        .ribbon-substrip {
          overflow-x: auto;
          scrollbar-width: none;
          -ms-overflow-style: none;
          scroll-behavior: smooth;
        }
        .ribbon-substrip::-webkit-scrollbar {
          display: none !important;
          width: 0 !important;
          height: 0 !important;
        }
        .ribbon-scroll-arrow {
          width: 28px;
          height: 28px;
          border-radius: 6px;
          border: 1px solid #cbd5e1;
          background: #ffffff;
          color: #0f172a;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          cursor: pointer;
          transition: all 0.14s ease;
          box-shadow: 0 1px 3px rgba(15, 23, 42, 0.08);
        }
        .ribbon-scroll-arrow:hover:not(:disabled) {
          background: #e0f2fe;
          border-color: #38bdf8;
          color: #0284c7;
        }
        .ribbon-scroll-arrow:disabled {
          opacity: 0.35;
          cursor: default;
          box-shadow: none;
        }
        .ribbon-subchip {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          border-radius: 6px;
          background: #ffffff;
          border: 1px solid #dbe4ee;
          color: #1e293b;
          font-size: 11.5px;
          font-weight: 600;
          text-decoration: none;
          white-space: nowrap;
          transition: all 0.14s ease;
          flex-shrink: 0;
        }
        .ribbon-subchip:hover {
          background: #e0f2fe;
          border-color: #38bdf8;
          color: #0369a1;
          transform: translateY(-1px);
        }
        .ribbon-subchip.active {
          background: #0284c7;
          border-color: #0284c7;
          color: #ffffff !important;
          box-shadow: 0 2px 6px rgba(2, 132, 199, 0.25);
        }

        /* 12. MOD: KOYU KOMPAKT ÜST BAR (DOCK) */
        .topbar-dock-mode .desktop-menubar-btn {
          color: #e2e8f0 !important;
          padding: 3px 8px !important;
          border-radius: 999px !important;
          font-size: 11px !important;
        }
        .topbar-dock-mode .desktop-menubar-btn:hover {
          background-color: rgba(255, 255, 255, 0.12) !important;
          border-color: rgba(148, 163, 184, 0.35) !important;
          color: #ffffff !important;
        }
        .topbar-dock-mode .desktop-menubar-btn.active,
        .topbar-dock-mode .desktop-menubar-btn.open {
          background-color: #0284c7 !important;
          border-color: #38bdf8 !important;
          color: #ffffff !important;
        }
        .topbar-dock-mode .topbar-menu-divider {
          background-color: rgba(148, 163, 184, 0.3) !important;
        }
        .dock-tile-link {
          display: flex;
          align-items: center;
          gap: 7px;
          padding: 6px 9px;
          border-radius: 7px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          color: #0f172a;
          font-size: 11.5px;
          font-weight: 600;
          text-decoration: none;
          transition: all 0.12s ease;
          white-space: nowrap;
          overflow: hidden;
        }
        .dock-tile-link:hover {
          background: #0f172a;
          border-color: #0f172a;
          color: #ffffff;
        }
        .dock-tile-link.active {
          background: #0284c7;
          border-color: #0284c7;
          color: #ffffff;
        }

        /* 16. PILLBAR: Yüzen Kapsül Üst Menü */
        .pillbar-capsule {
          background: #ffffff;
          border: 1px solid #cbd5e1;
          border-radius: 999px;
          box-shadow: 0 8px 24px rgba(15, 23, 42, 0.1);
          padding: 3px 6px;
        }
        .topbar-pillbar-mode .desktop-menubar-btn {
          border-radius: 999px !important;
          padding: 4px 10px !important;
        }

        /* 17. ICONBAR: Büyük İkonlu Üst Araç Çubuğu */
        .iconbar-btn {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 3px;
          padding: 5px 9px;
          border-radius: 10px;
          border: 1px solid transparent;
          background: transparent;
          color: #0f172a;
          font-size: 11px;
          font-weight: 700;
          line-height: 1.15;
          transition: all 0.14s ease;
          white-space: nowrap;
        }
        .iconbar-btn:hover,
        .iconbar-btn.open,
        .iconbar-btn.active {
          background: #f0f9ff;
          border-color: #bae6fd;
          color: #0284c7;
        }

        /* 18. CENTERED: Ortalanmış Çift Satır Bar */
        .centered-nav-btn {
          padding: 6px 11px;
          border: none;
          border-bottom: 2.5px solid transparent;
          background: transparent;
          font-size: 12px;
          font-weight: 700;
          color: #334155;
          transition: all 0.14s ease;
          white-space: nowrap;
        }
        .centered-nav-btn:hover,
        .centered-nav-btn.open,
        .centered-nav-btn.active {
          color: #047857;
          border-bottom-color: #059669;
          background: rgba(5, 150, 105, 0.06);
        }

        /* 21. SPLITBAR: Zümrüt Bar + İkili Panel */
        .topbar-splitbar-mode .desktop-menubar-btn {
          color: rgba(255, 255, 255, 0.92) !important;
          border-radius: 6px !important;
          padding: 4px 8px !important;
        }
        .topbar-splitbar-mode .desktop-menubar-btn:hover,
        .topbar-splitbar-mode .desktop-menubar-btn.open,
        .topbar-splitbar-mode .desktop-menubar-btn.active {
          background-color: rgba(255, 255, 255, 0.18) !important;
          border-color: rgba(253, 224, 117, 0.55) !important;
          color: #fde075 !important;
        }
        .topbar-splitbar-mode .topbar-menu-divider {
          background-color: rgba(255, 255, 255, 0.25) !important;
        }

        /* Üst menü yatay kaydırma (scrollbar gizli, sağ/sol ok butonlu) */
        .topbar-menu-scrollable {
          overflow-x: auto !important;
          overflow-y: hidden !important;
          scrollbar-width: none !important;
          -ms-overflow-style: none !important;
          scroll-behavior: smooth;
        }
        .topbar-menu-scrollable::-webkit-scrollbar {
          display: none !important;
          width: 0 !important;
          height: 0 !important;
        }
      `}</style>

      {/* ─── 20. FULLGRID MODU: Minimalist Bar + Tam Ekran Uygulama Çekmecesi ─── */}
      {isFullgrid ? (
        <div className="position-relative w-100">
          <div className="d-flex align-items-center justify-content-between px-3 py-1.5 w-100 bg-white">
            <div className="d-flex align-items-center gap-2.5">
              <Link
                to="/dashboard"
                className="brand-logo topbar-brand-box d-flex align-items-center text-decoration-none px-2.5 py-1 rounded-2"
                style={{ background: "linear-gradient(135deg, #059669 0%, #047857 50%, #064e3b 100%)" }}
              >
                <img src="/images/logo/logo.svg" alt="Likya" className="me-1.5" style={{ width: "22px", height: "22px" }} />
                <span className="fw-bold site-logo-text text-nowrap" style={{ fontSize: "0.98rem" }}>
                  <span className="brand-text-likya">{brand.prefix}</span>{" "}
                  <span className="brand-text-kuyum">{brand.suffix}</span>
                </span>
              </Link>

              <AlanDegistirDugmesi yerlesim="ust" />

              <button
                type="button"
                onClick={() => setFullgridOpen((o) => !o)}
                className={`btn btn-sm fw-bold d-flex align-items-center gap-1.5 rounded-3 px-3 py-1.5 ${
                  fullgridOpen ? "btn-primary" : "btn-outline-primary"
                }`}
                style={{ fontSize: "12px" }}
              >
                <IconLayoutGrid size={16} />
                <span>Tüm Modüller</span>
                <IconChevronDown size={14} style={{ transform: fullgridOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
              </button>

              <span className="badge bg-light text-secondary border fw-semibold px-2.5 py-1.5 d-none d-xl-inline-flex align-items-center gap-1" style={{ fontSize: "11px" }}>
                Aktif Sayfa: <strong className="text-dark">{currentPath}</strong>
              </span>
            </div>

            <div className="d-flex align-items-center gap-3 small font-monospace">
              <span className="text-muted">Vezne: <strong className="text-dark">{cleanVezne}</strong></span>
              <span className="text-muted">Kul.: <strong className="text-primary">{displayName}</strong></span>
              <span className="px-2 py-0.5 rounded bg-light border fw-bold text-dark">{currentDate} {currentTime}</span>
            </div>
          </div>

          {fullgridOpen && (
            <div
              className="position-fixed bg-white border rounded-3 shadow-lg p-3 animate-dropdown-fade"
              style={{
                top: "52px",
                left: "12px",
                right: "12px",
                maxHeight: "calc(100vh - 76px)",
                overflowY: "auto",
                zIndex: 1350,
              }}
            >
              <div className="d-flex align-items-center justify-content-between mb-2.5 pb-2 border-bottom">
                <span className="fw-bold text-dark d-flex align-items-center gap-1.5">
                  <IconLayoutGrid size={18} className="text-primary" /> Tüm Modüller ve Ekranlar
                </span>
                <button type="button" className="btn btn-light btn-sm border" onClick={() => setFullgridOpen(false)}>
                  <IconX size={15} /> Kapat
                </button>
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                  gap: "12px",
                }}
              >
                {gorunenMenu.map((m, idx) => {
                  if (m.grouptitle) return null;
                  const theme = getThemeForMenu(m, idx);
                  return (
                    <div key={idx} className="rounded-3 border bg-light bg-opacity-50 p-2.5 d-flex flex-column gap-1">
                      <div className="d-flex align-items-center gap-2 pb-1.5 mb-1 border-bottom">
                        <span
                          className="d-inline-flex align-items-center justify-content-center rounded-2 flex-shrink-0"
                          style={{ width: "26px", height: "26px", backgroundColor: theme.bg, color: theme.color }}
                        >
                          {m.icon}
                        </span>
                        <span className="fw-bold text-dark text-truncate" style={{ fontSize: "0.84rem" }}>
                          {m.title}
                        </span>
                      </div>
                      {m.link && (!m.children || m.children.length === 0) ? (
                        <Link
                          to={m.link.startsWith("/") ? m.link : `/${m.link}`}
                          onClick={(e) => {
                            setFullgridOpen(false);
                            handleLinkClick(e, m.link!);
                          }}
                          className="desktop-dropdown-item rounded-2"
                        >
                          <span>{m.title}</span>
                        </Link>
                      ) : (
                        m.children?.flatMap((c, cIdx) => {
                          const cTitle = c.title || c.name || "";
                          if (c.children && c.children.length > 0) {
                            return c.children.map((s, sIdx) => {
                              const sTitle = s.title || s.name || "";
                              const to = s.link?.startsWith("/") ? s.link : `/${s.link}`;
                              return (
                                <Link
                                  key={`${cIdx}-${sIdx}`}
                                  to={to}
                                  onClick={(e) => {
                                    setFullgridOpen(false);
                                    handleLinkClick(e, to);
                                  }}
                                  className={`desktop-dropdown-item rounded-2 ${isItemActive(to) ? "active" : ""}`}
                                >
                                  <div className="d-flex align-items-center gap-1.5 overflow-hidden">
                                    {getSubmenuIcon(sTitle)}
                                    <span className="text-truncate">{sTitle}</span>
                                  </div>
                                </Link>
                              );
                            });
                          }
                          const to = c.link?.startsWith("/") ? c.link : `/${c.link}`;
                          return (
                            <Link
                              key={cIdx}
                              to={to}
                              onClick={(e) => {
                                setFullgridOpen(false);
                                handleLinkClick(e, to);
                              }}
                              className={`desktop-dropdown-item rounded-2 ${isItemActive(to) ? "active" : ""}`}
                            >
                              <div className="d-flex align-items-center gap-1.5 overflow-hidden">
                                {getSubmenuIcon(cTitle)}
                                <span className="text-truncate">{cTitle}</span>
                              </div>
                            </Link>
                          );
                        })
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : isCentered ? (
        /* ─── 18. CENTERED MODU: Üstte Ortalanmış Marka + Altta Çizgili Sekmeler ─── */
        <div className="w-100 bg-white">
          <div className="d-flex align-items-center justify-content-between px-3 py-1 border-bottom">
            <div className="d-flex align-items-center gap-2 small">
              <span className="badge bg-light text-dark border font-monospace">Vezne: {cleanVezne}</span>
              <AlanDegistirDugmesi yerlesim="ust" />
            </div>
            <Link
              to="/dashboard"
              className="brand-logo topbar-brand-box d-flex align-items-center text-decoration-none px-3 py-0.5 rounded-pill"
              style={{ background: "linear-gradient(135deg, #059669 0%, #047857 50%, #064e3b 100%)" }}
            >
              <img src="/images/logo/logo.svg" alt="Likya" className="me-2" style={{ width: "22px", height: "22px" }} />
              <span className="fw-bold site-logo-text text-nowrap" style={{ fontSize: "1.02rem" }}>
                <span className="brand-text-likya">{brand.prefix}</span>{" "}
                <span className="brand-text-kuyum">{brand.suffix}</span>
              </span>
            </Link>
            <div className="d-flex align-items-center gap-2 small font-monospace">
              <span className="fw-bold text-primary">{displayName}</span>
              <span className="px-1.5 py-0.5 rounded bg-light border text-dark">{currentDate} {currentTime}</span>
            </div>
          </div>

          <div className="d-flex align-items-center justify-content-center gap-1 px-2 bg-light bg-opacity-50" style={{ overflow: "visible" }}>
            {gorunenMenu.map((menu, index) => {
              if (menu.grouptitle) return null;
              const isOpen = activeDropdownIndex === index;
              const hasChildren = menu.children && menu.children.length > 0;
              return (
                <div
                  key={index}
                  className="position-relative d-inline-flex align-items-center"
                  onMouseEnter={() => handleMouseEnter(index)}
                  onMouseLeave={handleMouseLeave}
                >
                  <button
                    type="button"
                    onClick={() => {
                      if (hasChildren) setActiveDropdownIndex(isOpen ? null : index);
                      else if (menu.link) navigateWithDashboardHop(menu.link);
                    }}
                    className={`centered-nav-btn d-flex align-items-center gap-1 ${isOpen ? "open" : ""}`}
                  >
                    <span>{menu.title}</span>
                  </button>
                  {hasChildren && isOpen && (
                    <div
                      className="position-absolute shadow-lg bg-white border rounded-2 animate-dropdown-fade desktop-dropdown-menu"
                      style={{
                        top: "100%",
                        left: index >= 5 ? "auto" : 0,
                        right: index >= 5 ? 0 : "auto",
                        minWidth: "230px",
                        zIndex: 1250,
                        maxHeight: "75vh",
                        overflowY: "auto",
                      }}
                    >
                      {menu.children?.flatMap((child, cIdx) => {
                        const cTitle = child.title || child.name || "";
                        if (child.children && child.children.length > 0) {
                          return [
                            <div key={`h-${cIdx}`} className="fw-bold text-uppercase px-2.5 py-1 bg-light border-top border-bottom" style={{ fontSize: "10.5px" }}>
                              {cTitle}
                            </div>,
                            ...child.children.map((sub, sIdx) => {
                              const sTitle = sub.title || sub.name || "";
                              const to = sub.link?.startsWith("/") ? sub.link : `/${sub.link}`;
                              return (
                                <Link key={`${cIdx}-${sIdx}`} to={to} onClick={(e) => handleLinkClick(e, to)} className={`desktop-dropdown-item ${isItemActive(to) ? "active" : ""}`}>
                                  <div className="d-flex align-items-center gap-2 overflow-hidden">{getSubmenuIcon(sTitle)}<span className="text-truncate">{sTitle}</span></div>
                                </Link>
                              );
                            }),
                          ];
                        }
                        const to = child.link?.startsWith("/") ? child.link : `/${child.link}`;
                        return (
                          <Link key={cIdx} to={to} onClick={(e) => handleLinkClick(e, to)} className={`desktop-dropdown-item ${isItemActive(to) ? "active" : ""}`}>
                            <div className="d-flex align-items-center gap-2 overflow-hidden">{getSubmenuIcon(cTitle)}<span className="text-truncate">{cTitle}</span></div>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
      <div
        className={`d-flex align-items-center justify-content-between p-0 w-100 ${
          isPillbar ? "pillbar-capsule" : ""
        }`}
        style={{ overflow: "visible" }}
      >
        {/* 1. EN SOLDA YEŞİL BRAND ALANI */}
        <div
          className={`brand-logo topbar-brand-box d-flex align-items-center flex-shrink-0 px-3 ${
            isPillbar ? "rounded-pill ms-0.5" : ""
          }`}
          style={{
            background: "linear-gradient(135deg, #059669 0%, #047857 45%, #064e3b 100%)",
            minHeight: isIconbar ? "56px" : "36px",
            minWidth: "148px",
            borderRight: isPillbar ? "none" : "1px solid rgba(0, 0, 0, 0.15)",
            boxShadow: "0 2px 6px rgba(4, 120, 87, 0.2)",
          }}
        >
          <Link
            to="/dashboard"
            className="d-flex align-items-center text-decoration-none py-0.5 overflow-hidden w-100"
            style={{ minWidth: 0, cursor: "pointer" }}
            title="Ana Sayfa"
          >
            <img
              src="/images/logo/logo.svg"
              alt="Likya Kuyum Logo"
              className="site-logo-img flex-shrink-0 me-2"
              style={{ width: "24px", height: "24px", objectFit: "contain", display: "inline-block" }}
            />
            <span
              className="fw-bold site-logo-text text-nowrap"
              style={{ fontSize: "1.02rem" }}
            >
              <span className="brand-text-likya">{brand.prefix}</span>{" "}
              <span className="brand-text-kuyum">{brand.suffix}</span>
            </span>
          </Link>
        </div>

        {/* Alan Değiştir: üst menü stillerinde sol menü yerine burada (yalnız yetkili ve birden çok alanı olan kullanıcıda) */}
        <AlanDegistirDugmesi yerlesim="ust" />

        {/* 19. CMDBAR: Header İçi Canlı Arama Kutusu */}
        {isCmdbar && (
          <div className="position-relative mx-2 flex-shrink-0" style={{ width: "240px" }}>
            <div className="position-relative d-flex align-items-center">
              <IconSearch size={14} className="position-absolute text-muted" style={{ left: "10px", pointerEvents: "none" }} />
              <input
                type="text"
                value={cmdQuery}
                onFocus={() => setCmdFocused(true)}
                onChange={(e) => {
                  setCmdQuery(e.target.value);
                  setCmdFocused(true);
                }}
                placeholder="Ekran veya modül ara..."
                className="form-control form-control-sm ps-4 pe-4 rounded-pill bg-light border"
                style={{ fontSize: "11.5px", height: "30px" }}
              />
              {cmdQuery && (
                <button
                  type="button"
                  onClick={() => setCmdQuery("")}
                  className="btn btn-link p-0 position-absolute text-muted d-flex align-items-center"
                  style={{ right: "8px" }}
                >
                  <IconX size={13} />
                </button>
              )}
            </div>
            {cmdFocused && cmdQuery.trim().length > 0 && (
              <div
                className="position-absolute bg-white border rounded-3 shadow-lg p-1.5 animate-dropdown-fade"
                style={{ top: "calc(100% + 4px)", left: 0, width: "360px", maxHeight: "420px", overflowY: "auto", zIndex: 1350 }}
              >
                {cmdResults.length === 0 ? (
                  <div className="text-center text-muted py-3 small">Eşleşen ekran bulunamadı.</div>
                ) : (
                  cmdResults.map((res, rIdx) => {
                    const to = res.link.startsWith("/") ? res.link : `/${res.link}`;
                    return (
                      <Link
                        key={rIdx}
                        to={to}
                        onClick={(e) => {
                          setCmdFocused(false);
                          setCmdQuery("");
                          handleLinkClick(e, to);
                        }}
                        className="desktop-dropdown-item rounded-2 d-flex flex-column align-items-start py-1.5"
                      >
                        <div className="d-flex align-items-center gap-1.5 w-100">
                          <span style={{ width: "7px", height: "7px", borderRadius: "50%", backgroundColor: res.color, flexShrink: 0 }} />
                          <span className="fw-bold text-truncate">{res.title}</span>
                        </div>
                        <small className="text-muted ps-3" style={{ fontSize: "10px" }}>{res.parent}</small>
                      </Link>
                    );
                  })
                )}
              </div>
            )}
          </div>
        )}

        {/* 2. ORTA BÖLÜM: Taşma durumunda kullanıcı bilgilerinin üstüne binmez, sağ/sol oklarla kaydırılır */}
        <div className="d-flex align-items-center flex-grow-1 min-w-0" style={{ minWidth: 0, overflow: useScrollableTopRow ? "hidden" : "visible" }}>
          {useScrollableTopRow && (topCanScrollLeft || topCanScrollRight) && (
            <button
              type="button"
              className="ribbon-scroll-arrow ms-1"
              style={{ width: "24px", height: "24px" }}
              onClick={() => scrollTopRow("left")}
              disabled={!topCanScrollLeft}
              title="Menüyü sola kaydır"
              aria-label="Menüyü sola kaydır"
            >
              <IconChevronLeft size={14} strokeWidth={2.4} />
            </button>
          )}
          <div
            ref={useScrollableTopRow ? topRowScrollRef : undefined}
            onScroll={useScrollableTopRow ? checkTopRowScroll : undefined}
            className={`topbar-menu-items d-flex align-items-center flex-grow-1 px-1 py-0.5 flex-nowrap ${
              useScrollableTopRow ? "topbar-menu-scrollable" : ""
            }`}
            style={{
              overflow: useScrollableTopRow ? undefined : "visible",
              whiteSpace: "nowrap",
              minWidth: 0,
            }}
          >
          {gorunenMenu.map((menu, index) => {
            if (menu.grouptitle) return null;
            const theme = getThemeForMenu(menu, index);
            const isOpen = activeDropdownIndex === index;
            const hasChildren = menu.children && menu.children.length > 0;
            const isMenuChildActive =
              hasChildren &&
              menu.children?.some((c) => {
                const cLink = c.link;
                if (cLink && isItemActive(cLink)) return true;
                return c.children?.some((c2) => isItemActive(c2.link));
              });

            // Mega menünün ekran dışına taşmaması için dinamik hizalama
            const getDropdownAlignment = () => {
              if (index <= 2) return { left: 0, right: "auto" };
              if (index >= 5) return { right: 0, left: "auto" };
              return { left: "-140px", right: "auto" };
            };

            const captureAnchor = (el: HTMLElement | null) => {
              if (!el) return;
              const rect = el.getBoundingClientRect();
              const clampedLeft = Math.max(8, Math.min(rect.left, window.innerWidth - 260));
              setDropdownAnchor({ top: rect.bottom + 2, left: clampedLeft });
            };

            return (
              <React.Fragment key={index}>
                {index > 0 && <span className="topbar-menu-divider" aria-hidden="true" />}
                  <div
                    className="position-relative d-inline-flex align-items-center flex-shrink-0"
                    style={{ overflow: "visible" }}
                    onMouseEnter={(e) => {
                      if (!isRibbon) {
                        if (useScrollableTopRow) captureAnchor(e.currentTarget);
                        handleMouseEnter(index);
                        if (isSplitbar) setSplitHoverIdx(index);
                      }
                    }}
                    onMouseLeave={() => {
                      if (!isRibbon) handleMouseLeave();
                    }}
                  >
                    {/* Modül Butonu: Iconbar / Ribbon / Standart */}
                    {isIconbar ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (useScrollableTopRow) captureAnchor(e.currentTarget);
                          if (hasChildren) setActiveDropdownIndex(isOpen ? null : index);
                          else if (menu.link) navigateWithDashboardHop(menu.link);
                        }}
                        className={`iconbar-btn ${isOpen ? "open" : isMenuChildActive || isItemActive(menu.link) ? "active" : ""}`}
                        style={{ cursor: "pointer" }}
                      >
                        {menu.icon && (
                          <span
                            className="d-inline-flex align-items-center justify-content-center rounded-3"
                            style={{
                              width: "28px",
                              height: "28px",
                              backgroundColor: isOpen || isMenuChildActive ? theme.color : theme.bg,
                              color: isOpen || isMenuChildActive ? "#ffffff" : theme.color,
                            }}
                          >
                            {React.isValidElement(menu.icon)
                              ? React.cloneElement(menu.icon as React.ReactElement<any>, { size: 17 })
                              : menu.icon}
                          </span>
                        )}
                        <span>{menu.title}</span>
                      </button>
                    ) : (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (isRibbon) {
                          if (hasChildren) {
                            setActiveRibbonIndex(index);
                          } else if (menu.link) {
                            setActiveRibbonIndex(index);
                            navigateWithDashboardHop(menu.link);
                          }
                          return;
                        }
                        if (useScrollableTopRow) captureAnchor(e.currentTarget);
                        if (hasChildren) {
                          setActiveDropdownIndex(isOpen ? null : index);
                          if (isSplitbar) setSplitHoverIdx(index);
                        } else if (menu.link) {
                          navigateWithDashboardHop(menu.link);
                        }
                      }}
                      className={`${
                        isRibbon ? "ribbon-tab-btn" : "desktop-menubar-btn"
                      } d-flex align-items-center gap-1 ${
                        isRibbon
                          ? activeRibbonIndex === index
                            ? "active"
                            : ""
                          : isOpen
                          ? "open"
                          : isMenuChildActive || isItemActive(menu.link)
                          ? "active"
                          : ""
                      }`}
                      style={{ cursor: "pointer" }}
                    >
                      {menu.icon && (
                        <span
                          className="menu-icon-wrap d-inline-flex align-items-center justify-content-center flex-shrink-0"
                          style={{
                            color: isDock || isSplitbar
                              ? isOpen || isMenuChildActive || isItemActive(menu.link)
                                ? "#fde075"
                                : "#e2e8f0"
                              : isOpen || isMenuChildActive || isItemActive(menu.link) || (isRibbon && activeRibbonIndex === index)
                              ? "#0284c7"
                              : theme.color || "#64748b",
                            fontSize: "0.78rem",
                          }}
                        >
                          {React.isValidElement(menu.icon)
                            ? React.cloneElement(menu.icon as React.ReactElement<any>, { size: isRibbon ? 14 : 13 })
                            : menu.icon}
                        </span>
                      )}
                      <span className="menu-title-text">{menu.title}</span>
                    </button>
                    )}

                    {/* STANDART / PILLBAR / ICONBAR / CMDBAR AŞAĞI AÇILIR LİSTE */}
                    {hasChildren && isOpen && !isMegaMenu && !isRibbon && !isDock && !isSplitbar && (
                    <div
                      className={`${
                        useScrollableTopRow && dropdownAnchor ? "position-fixed" : "position-absolute"
                      } shadow-lg bg-white border animate-dropdown-fade desktop-dropdown-menu`}
                      style={
                        useScrollableTopRow && dropdownAnchor
                          ? {
                              top: `${dropdownAnchor.top}px`,
                              left: `${dropdownAnchor.left}px`,
                              minWidth: "220px",
                              maxWidth: "340px",
                              zIndex: 1350,
                              maxHeight: "82vh",
                              overflowY: "auto",
                            }
                          : {
                              top: "calc(100% + 1px)",
                              left: index >= 6 ? "auto" : 0,
                              right: index >= 6 ? 0 : "auto",
                              minWidth: "220px",
                              maxWidth: "340px",
                              zIndex: 1250,
                              maxHeight: "82vh",
                              overflowY: "auto",
                            }
                      }
                      onMouseEnter={() => handleMouseEnter(index)}
                      onMouseLeave={handleMouseLeave}
                    >
                    <div className="d-flex flex-column">
                      {menu.children?.map((child, cIdx) => {
                        const childTitle = child.title || child.name || "";
                        if (child.children && child.children.length > 0) {
                          return (
                            <div key={cIdx}>
                              <div
                                className="fw-bold text-uppercase px-2.5 py-1 border-top border-bottom bg-light"
                                style={{ fontSize: "11px", letterSpacing: "0.5px", color: "#0f172a" }}
                              >
                                {childTitle}
                              </div>
                              {child.children.map((subChild, sIdx) => {
                                const subTitle = subChild.title || subChild.name || "";
                                const subTo = subChild.link?.startsWith("/")
                                  ? subChild.link
                                  : `/${subChild.link}`;
                                const isActive = isItemActive(subTo);
                                return (
                                  <Link
                                    key={sIdx}
                                    to={subTo}
                                    onClick={(e) => handleLinkClick(e, subTo)}
                                    className={`desktop-dropdown-item ${
                                      isActive ? "active text-primary fw-bold" : ""
                                    }`}
                                  >
                                    <div className="d-flex align-items-center gap-2 overflow-hidden">
                                      {getSubmenuIcon(subTitle)}
                                      <span className="text-truncate">{subTitle}</span>
                                    </div>
                                  </Link>
                                );
                              })}
                            </div>
                          );
                        } else {
                          const to = child.link?.startsWith("/")
                            ? child.link
                            : `/${child.link}`;
                          const isActive = isItemActive(to);
                          return (
                            <Link
                              key={cIdx}
                              to={to}
                              onClick={(e) => handleLinkClick(e, to)}
                              className={`desktop-dropdown-item ${
                                isActive ? "active text-primary fw-bold" : ""
                              }`}
                            >
                              <div className="d-flex align-items-center gap-2 overflow-hidden">
                                {getSubmenuIcon(childTitle)}
                                <span className="text-truncate">{childTitle}</span>
                              </div>
                            </Link>
                          );
                        }
                      })}
                    </div>
                  </div>
                )}

                {/* 6. MOD: MODERN ÇOK SÜTUNLU YATAY MEGA PANEL (EN ÜSTTE MENÜ ADI YAZMAZ) */}
                {hasChildren && isOpen && isMegaMenu && (
                  <div
                    className="position-absolute bg-white rounded-2 border p-2.5 animate-dropdown-fade"
                    style={{
                      top: "calc(100% + 2px)",
                      ...getDropdownAlignment(),
                      width: "720px",
                      maxWidth: "calc(100vw - 30px)",
                      zIndex: 1250,
                      borderColor: "rgba(0, 0, 0, 0.15)",
                      backgroundColor: "#ffffff",
                      boxShadow: "0 18px 45px -10px rgba(15, 23, 42, 0.22), 0 0 0 1px rgba(15, 23, 42, 0.05)",
                    }}
                    onMouseEnter={() => handleMouseEnter(index)}
                    onMouseLeave={handleMouseLeave}
                  >
                    {/* Ferah Çok Sütunlu Sayfa Düzeni (Yazılar Asla Üst Üste Binmez, white-space: nowrap) */}
                    <div
                      style={{
                        maxHeight: "440px",
                        overflowY: "auto",
                        paddingRight: "4px",
                      }}
                    >
                      {/* Alt kategoriler varsa (ör: Altın Ürünler, Pırlanta Ürünler) */}
                      {menu.children?.some((c) => c.children && c.children.length > 0) ? (
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                            gap: "16px",
                          }}
                        >
                          {menu.children.map((child, cIdx) => {
                            const childTitle = child.title || child.name || "";
                            if (child.children && child.children.length > 0) {
                              return (
                                <div key={cIdx} className="d-flex flex-column">
                                  <div
                                    className="fw-bold text-uppercase pb-1 mb-2 border-bottom"
                                    style={{ fontSize: "0.75rem", letterSpacing: "0.6px", color: "#0f172a" }}
                                  >
                                    {childTitle}
                                  </div>
                                  <div className="d-flex flex-column gap-1">
                                    {child.children.map((subChild, sIdx) => {
                                      const subTitle = subChild.title || subChild.name || "";
                                      const subTo = subChild.link?.startsWith("/")
                                        ? subChild.link
                                        : `/${subChild.link}`;
                                      const isActive = isItemActive(subTo);
                                      return (
                                        <Link
                                          key={sIdx}
                                          to={subTo}
                                          onClick={(e) => handleLinkClick(e, subTo)}
                                          className={`mega-clean-link ${isActive ? "active" : ""}`}
                                          title={subTitle}
                                        >
                                          <div className="d-flex align-items-center gap-2 overflow-hidden me-2">
                                            <span
                                              style={{
                                                width: "6px",
                                                height: "6px",
                                                borderRadius: "50%",
                                                backgroundColor: isActive ? "#2563eb" : theme.color,
                                                flexShrink: 0,
                                              }}
                                            />
                                            <span className="text-truncate fw-semibold" style={{ fontSize: "0.85rem", color: "#0f172a" }}>
                                              {subTitle}
                                            </span>
                                          </div>
                                          <IconArrowRight
                                            size={14}
                                            className="flex-shrink-0 text-muted"
                                            style={{ opacity: isActive ? 1 : 0.4 }}
                                          />
                                        </Link>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            } else {
                              const to = child.link?.startsWith("/") ? child.link : `/${child.link}`;
                              const isActive = isItemActive(to);
                              return (
                                <Link
                                  key={cIdx}
                                  to={to}
                                  onClick={(e) => handleLinkClick(e, to)}
                                  className={`mega-clean-link ${isActive ? "active" : ""}`}
                                  title={childTitle}
                                >
                                  <div className="d-flex align-items-center gap-2 overflow-hidden me-2">
                                    <span
                                      style={{
                                        width: "6px",
                                        height: "6px",
                                        borderRadius: "50%",
                                        backgroundColor: isActive ? "#2563eb" : theme.color,
                                        flexShrink: 0,
                                      }}
                                    />
                                    <span className="text-truncate fw-semibold" style={{ fontSize: "0.85rem", color: "#0f172a" }}>
                                      {childTitle}
                                    </span>
                                  </div>
                                  <IconArrowRight
                                    size={14}
                                    className="flex-shrink-0 text-muted"
                                    style={{ opacity: isActive ? 1 : 0.4 }}
                                  />
                                </Link>
                              );
                            }
                          })}
                        </div>
                      ) : (
                        /* Düz Liste Halinde İse 2 Sütunlu Dengeli ve Ferah Dağılım */
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                            gap: "8px 14px",
                          }}
                        >
                          {menu.children?.map((child, cIdx) => {
                            const childTitle = child.title || child.name || "";
                            const to = child.link?.startsWith("/") ? child.link : `/${child.link}`;
                            const isActive = isItemActive(to);
                            return (
                              <Link
                                key={cIdx}
                                to={to}
                                onClick={(e) => handleLinkClick(e, to)}
                                className={`mega-clean-link ${isActive ? "active" : ""}`}
                                title={childTitle}
                              >
                                <div className="d-flex align-items-center gap-2 overflow-hidden me-2">
                                  <span
                                    style={{
                                      width: "6px",
                                      height: "6px",
                                      borderRadius: "50%",
                                      backgroundColor: isActive ? "#2563eb" : theme.color,
                                      flexShrink: 0,
                                    }}
                                  />
                                  <span className="text-truncate fw-semibold" style={{ fontSize: "0.85rem", color: "#0f172a" }}>
                                    {childTitle}
                                  </span>
                                </div>
                                <IconArrowRight
                                  size={14}
                                  className="flex-shrink-0 text-muted"
                                  style={{ opacity: isActive ? 1 : 0.4 }}
                                />
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {/* 12. MOD: KOYU KOMPAKT ÜST BAR - 3 SÜTUNLU KART PANELİ */}
                {hasChildren && isOpen && isDock && (
                  <div
                    className="position-absolute bg-white rounded-3 border p-2.5 animate-dropdown-fade"
                    style={{
                      top: "calc(100% + 4px)",
                      ...getDropdownAlignment(),
                      width: "780px",
                      maxWidth: "calc(100vw - 30px)",
                      zIndex: 1250,
                      borderColor: "#cbd5e1",
                      boxShadow: "0 20px 45px rgba(15, 23, 42, 0.28)",
                    }}
                    onMouseEnter={() => handleMouseEnter(index)}
                    onMouseLeave={handleMouseLeave}
                  >
                    <div
                      style={{
                        maxHeight: "420px",
                        overflowY: "auto",
                        display: "grid",
                        gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                        gap: "6px",
                      }}
                    >
                      {menu.children?.flatMap((child, cIdx) => {
                        const childTitle = child.title || child.name || "";
                        if (child.children && child.children.length > 0) {
                          return child.children.map((subChild, sIdx) => {
                            const subTitle = subChild.title || subChild.name || "";
                            const subTo = subChild.link?.startsWith("/") ? subChild.link : `/${subChild.link}`;
                            const isActive = isItemActive(subTo);
                            return (
                              <Link
                                key={`${cIdx}-${sIdx}`}
                                to={subTo}
                                onClick={(e) => handleLinkClick(e, subTo)}
                                className={`dock-tile-link ${isActive ? "active" : ""}`}
                                title={`${childTitle} › ${subTitle}`}
                              >
                                <span className="flex-shrink-0">{getSubmenuIcon(subTitle)}</span>
                                <span className="text-truncate">{subTitle}</span>
                              </Link>
                            );
                          });
                        }
                        const to = child.link?.startsWith("/") ? child.link : `/${child.link}`;
                        const isActive = isItemActive(to);
                        return (
                          <Link
                            key={cIdx}
                            to={to}
                            onClick={(e) => handleLinkClick(e, to)}
                            className={`dock-tile-link ${isActive ? "active" : ""}`}
                            title={childTitle}
                          >
                            <span className="flex-shrink-0">{getSubmenuIcon(childTitle)}</span>
                            <span className="text-truncate">{childTitle}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                )}
                {/* 21. MOD: SPLITBAR - SOL MODÜL LİSTESİ + SAĞ CANLI ALT SAYFA IZGARASI */}
                {hasChildren && isOpen && isSplitbar && (
                  <div
                    className="position-absolute bg-white rounded-3 border shadow-lg d-flex overflow-hidden animate-dropdown-fade"
                    style={{
                      top: "calc(100% + 4px)",
                      ...getDropdownAlignment(),
                      width: "800px",
                      maxWidth: "calc(100vw - 30px)",
                      height: "410px",
                      zIndex: 1250,
                      borderColor: "#cbd5e1",
                    }}
                    onMouseEnter={() => handleMouseEnter(index)}
                    onMouseLeave={handleMouseLeave}
                  >
                    {/* Sol Sütun: Tüm Modüller */}
                    <div className="border-end bg-light p-2 overflow-y-auto flex-shrink-0" style={{ width: "220px" }}>
                      {gorunenMenu.map((m, mIdx) => {
                        if (m.grouptitle || !m.children?.length) return null;
                        const mTheme = getThemeForMenu(m, mIdx);
                        const isSplitActive = splitHoverIdx === mIdx;
                        return (
                          <button
                            key={mIdx}
                            type="button"
                            onMouseEnter={() => setSplitHoverIdx(mIdx)}
                            onClick={() => setSplitHoverIdx(mIdx)}
                            className={`btn btn-sm w-100 d-flex align-items-center gap-2 text-start px-2 py-1.5 rounded-2 mb-1 border-0 ${
                              isSplitActive ? "bg-success text-white fw-bold shadow-xs" : "text-dark"
                            }`}
                            style={{ fontSize: "12px" }}
                          >
                            <span
                              className="d-inline-flex align-items-center justify-content-center rounded-1 flex-shrink-0"
                              style={{
                                width: "22px",
                                height: "22px",
                                backgroundColor: isSplitActive ? "rgba(255,255,255,0.2)" : mTheme.bg,
                                color: isSplitActive ? "#ffffff" : mTheme.color,
                              }}
                            >
                              {m.icon}
                            </span>
                            <span className="text-truncate">{m.title}</span>
                          </button>
                        );
                      })}
                    </div>
                    {/* Sağ Sütun: Seçili Modülün Alt Sayfaları */}
                    <div className="flex-grow-1 p-3 overflow-y-auto bg-white">
                      {(() => {
                        const targetMod = gorunenMenu[splitHoverIdx] || menu;
                        return (
                          <>
                            <div className="fw-bold text-success pb-1.5 mb-2.5 border-bottom" style={{ fontSize: "0.9rem" }}>
                              {targetMod.title}
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "8px" }}>
                              {targetMod.children?.flatMap((child, cIdx) => {
                                const cTitle = child.title || child.name || "";
                                if (child.children && child.children.length > 0) {
                                  return child.children.map((sub, sIdx) => {
                                    const sTitle = sub.title || sub.name || "";
                                    const to = sub.link?.startsWith("/") ? sub.link : `/${sub.link}`;
                                    return (
                                      <Link
                                        key={`${cIdx}-${sIdx}`}
                                        to={to}
                                        onClick={(e) => handleLinkClick(e, to)}
                                        className={`mega-clean-link mb-0 ${isItemActive(to) ? "active" : ""}`}
                                      >
                                        <div className="d-flex align-items-center gap-1.5 overflow-hidden">
                                          {getSubmenuIcon(sTitle)}
                                          <span className="text-truncate">{sTitle}</span>
                                        </div>
                                      </Link>
                                    );
                                  });
                                }
                                const to = child.link?.startsWith("/") ? child.link : `/${child.link}`;
                                return (
                                  <Link
                                    key={cIdx}
                                    to={to}
                                    onClick={(e) => handleLinkClick(e, to)}
                                    className={`mega-clean-link mb-0 ${isItemActive(to) ? "active" : ""}`}
                                  >
                                    <div className="d-flex align-items-center gap-1.5 overflow-hidden">
                                      {getSubmenuIcon(cTitle)}
                                      <span className="text-truncate">{cTitle}</span>
                                    </div>
                                  </Link>
                                );
                              })}
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                )}
              </div>
            </React.Fragment>
            );
          })}
          </div>
          {useScrollableTopRow && (topCanScrollLeft || topCanScrollRight) && (
            <button
              type="button"
              className="ribbon-scroll-arrow me-1"
              style={{ width: "24px", height: "24px" }}
              onClick={() => scrollTopRow("right")}
              disabled={!topCanScrollRight}
              title="Menüyü sağa kaydır"
              aria-label="Menüyü sağa kaydır"
            >
              <IconChevronRight size={14} strokeWidth={2.4} />
            </button>
          )}
        </div>

        {/* 3. EN SAĞDA: Vezne Adı, Kullanıcı Adı, Tarih ve Saat */}
        <div
          className={`topbar-info-box d-flex flex-column justify-content-center flex-shrink-0 px-2 py-0.5 border-start user-select-none ms-auto ${
            isPillbar ? "rounded-pill px-3 border" : ""
          }`}
          style={{
            minWidth: "125px",
            maxWidth: "155px",
            lineHeight: 1.25,
            backgroundColor: isDock ? "#1e293b" : isSplitbar ? "rgba(0,0,0,0.22)" : "#f8fafc",
            borderColor: isDock || isSplitbar ? "rgba(255, 255, 255, 0.2)" : "#cbd5e1",
          }}
        >
          {/* Vezne Adı */}
          <div className="d-flex align-items-center justify-content-between gap-1 text-nowrap" title={`Vezne: ${cleanVezne}`}>
            <span style={{ fontSize: "10px", fontWeight: 700, color: isDock || isSplitbar ? "#cbd5e1" : "#475569" }}>Vezne</span>
            <span className="font-monospace text-truncate" style={{ fontSize: "10.5px", fontWeight: 700, color: isDock || isSplitbar ? "#ffffff" : "#0f172a", maxWidth: "85px" }}>
              {cleanVezne}
            </span>
          </div>

          {/* Kullanıcı Adı */}
          <div className="d-flex align-items-center justify-content-between gap-1 text-nowrap" title={`Kullanıcı: ${displayName}`}>
            <span style={{ fontSize: "10px", fontWeight: 700, color: isDock || isSplitbar ? "#cbd5e1" : "#475569" }}>Kul.</span>
            <span className="text-truncate" style={{ fontSize: "10.5px", fontWeight: 700, color: isDock ? "#38bdf8" : isSplitbar ? "#fde075" : "#0284c7", maxWidth: "85px" }}>
              {displayName}
            </span>
          </div>

          {/* Tarih ve Canlı Saat */}
          <div className="d-flex align-items-center justify-content-between gap-1 text-nowrap font-monospace" title="Tarih ve Saat">
            <span style={{ fontSize: "9.5px", fontWeight: 600, color: isDock || isSplitbar ? "#e2e8f0" : "#475569" }}>{currentDate}</span>
            <span
              className="px-1 rounded border"
              style={{
                fontSize: "9.5px",
                fontWeight: 700,
                backgroundColor: isDock || isSplitbar ? "rgba(0,0,0,0.35)" : "#ffffff",
                borderColor: isDock || isSplitbar ? "rgba(255,255,255,0.22)" : "#e2e8f0",
                color: isDock || isSplitbar ? "#ffffff" : "#0f172a",
              }}
            >
              {currentTime}
            </span>
          </div>
        </div>
      </div>
      )}

      {/* 11. MOD (RIBBON): 2. SATIR - SEÇİLİ KATEGORİNİN ALT SAYFALARI TEK TIKLA ŞERİTTE (SCROLLBAR YOK, SAĞ/SOL OKLU) */}
      {isRibbon && activeRibbonMenu && activeRibbonMenu.children && activeRibbonMenu.children.length > 0 && (
        <div className="ribbon-substrip-wrap d-flex align-items-center gap-1.5 px-2 py-1.5 w-100">
          <button
            type="button"
            className="ribbon-scroll-arrow"
            onClick={() => scrollRibbon("left")}
            disabled={!ribbonCanScrollLeft}
            title="Sola kaydır"
            aria-label="Sola kaydır"
          >
            <IconChevronLeft size={16} strokeWidth={2.4} />
          </button>

          <div
            ref={ribbonScrollRef}
            onScroll={checkRibbonScroll}
            className="ribbon-substrip d-flex align-items-center gap-1.5 flex-grow-1"
            style={{ minWidth: 0 }}
          >
            <span
              className="badge bg-primary-subtle text-primary border border-primary-subtle fw-bold me-1 flex-shrink-0"
              style={{ fontSize: "10.5px" }}
            >
              {activeRibbonMenu.title}
            </span>
            {activeRibbonMenu.children.flatMap((child, cIdx) => {
              const childTitle = child.title || child.name || "";
              if (child.children && child.children.length > 0) {
                return [
                  <span
                    key={`grp-${cIdx}`}
                    className="text-uppercase fw-bold text-muted ms-2 me-0.5 flex-shrink-0"
                    style={{ fontSize: "10px", letterSpacing: "0.4px" }}
                  >
                    {childTitle}:
                  </span>,
                  ...child.children.map((subChild, sIdx) => {
                    const subTitle = subChild.title || subChild.name || "";
                    const subTo = subChild.link?.startsWith("/") ? subChild.link : `/${subChild.link}`;
                    const isActive = isItemActive(subTo);
                    return (
                      <Link
                        key={`${cIdx}-${sIdx}`}
                        to={subTo}
                        onClick={(e) => handleLinkClick(e, subTo)}
                        className={`ribbon-subchip ${isActive ? "active" : ""}`}
                      >
                        {getSubmenuIcon(subTitle)}
                        <span>{subTitle}</span>
                      </Link>
                    );
                  }),
                ];
              }
              const to = child.link?.startsWith("/") ? child.link : `/${child.link}`;
              const isActive = isItemActive(to);
              return (
                <Link
                  key={cIdx}
                  to={to}
                  onClick={(e) => handleLinkClick(e, to)}
                  className={`ribbon-subchip ${isActive ? "active" : ""}`}
                >
                  {getSubmenuIcon(childTitle)}
                  <span>{childTitle}</span>
                </Link>
              );
            })}
          </div>

          <button
            type="button"
            className="ribbon-scroll-arrow"
            onClick={() => scrollRibbon("right")}
            disabled={!ribbonCanScrollRight}
            title="Sağa kaydır"
            aria-label="Sağa kaydır"
          >
            <IconChevronRight size={16} strokeWidth={2.4} />
          </button>
        </div>
      )}
    </nav>
  );
};

export default TopNavbarMenu;
