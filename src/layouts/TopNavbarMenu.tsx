import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { DashboardMenu } from "../routes/DashboardRoute";
import { menuyuKullaniciyaSuz, menuyuSuz } from "../config/modulKatalogu";
import { useKullaniciYetkisi } from "../hooks/useKullaniciYetkisi";
import { solMenuyuBirlestir } from "../config/solMenuBirlesimi";
import { getAppBrand } from "../utils/brandHelper";
import {
  getThemeForMenu,
  getSubmenuIcon,
} from "./Sidebar";
import {
  IconChevronDown,
  IconArrowRight,
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
  const containerRef = useRef<HTMLDivElement>(null);
  const hoverTimeoutRef = useRef<any>(null);

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
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Route değiştiğinde menüyü kapat
  useEffect(() => {
    setActiveDropdownIndex(null);
  }, [location.pathname]);

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
      window.open(cleanTo, "_blank", "noopener,noreferrer");
      return;
    }
    navigateWithDashboardHop(to);
  };

  const isItemActive = (link?: string): boolean => {
    if (!link) return false;
    const clean = link.startsWith("/") ? link : `/${link}`;
    return currentPath === clean || currentPath.startsWith(`${clean}/`);
  };

  return (
    <nav
      ref={containerRef}
      className="top-navbar-menu-container w-100 shadow-sm position-sticky top-0"
      style={{
        zIndex: 1060,
        backgroundColor: "#ffffff",
        borderBottom: "1px solid rgba(0, 0, 0, 0.12)",
        overflow: "visible",
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
          font-size: 11px !important;
          font-weight: 600 !important;
          color: #334155 !important;
          padding: 2.5px 5.5px !important;
          border-radius: 3px !important;
          border: 1px solid transparent !important;
          background: transparent !important;
          white-space: nowrap !important;
          line-height: 1.25 !important;
          transition: background-color 0.12s ease, border-color 0.12s ease, color 0.12s ease !important;
          user-select: none !important;
          text-decoration: none !important;
        }
        .desktop-menubar-btn:hover {
          background-color: #e0f2fe !important;
          border-color: #bae6fd !important;
          color: #0369a1 !important;
        }
        .desktop-menubar-btn.active {
          color: #0284c7 !important;
          font-weight: 700 !important;
        }
        .desktop-menubar-btn.open {
          background-color: #bde0fe !important;
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
          padding: 4px 12px !important;
          font-size: 11.5px !important;
          color: #1e293b !important;
          text-decoration: none !important;
          transition: background-color 0.1s ease, color 0.1s ease !important;
          white-space: nowrap !important;
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
          padding: 5px 10px;
          background-color: #f8fafc;
          border: 1px solid #f1f5f9;
          border-radius: 6px;
          text-decoration: none;
          color: #1e293b;
          font-size: 11.5px;
          transition: all 0.12s ease-in-out;
          margin-bottom: 4px;
          white-space: nowrap;
        }
        .mega-clean-link:hover {
          background-color: #ffffff;
          border-color: #38bdf8;
          box-shadow: 0 3px 10px rgba(56, 189, 248, 0.12);
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
      `}</style>

      <div
        className="d-flex align-items-center justify-content-between p-0 w-100"
        style={{ overflow: "visible" }}
      >
        {/* 1. EN SOLDA YEŞİL BRAND ALANI (ALTIN YALDIZLI YAZI VE ŞIK FERAH GENİŞLİK) */}
        <div
          className="brand-logo topbar-brand-box d-flex align-items-center flex-shrink-0 px-3"
          style={{
            background: "linear-gradient(135deg, #059669 0%, #047857 45%, #064e3b 100%)",
            minHeight: "36px",
            minWidth: "148px",
            borderRight: "1px solid rgba(0, 0, 0, 0.15)",
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

        {/* 2. ORTA BÖLÜM: 8 ALANIN HEPSİ TAM SIĞACAK ŞEKİLDE SIRALI MODÜL MENÜLERİ (TEK SATIR, ASLA WRAP ETMEZ) */}
        <div
          className="topbar-menu-items d-flex align-items-center flex-grow-1 px-1 py-0.5 flex-nowrap"
          style={{ overflow: "visible", whiteSpace: "nowrap", minWidth: 0 }}
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

            return (
              <React.Fragment key={index}>
                {index > 0 && <span className="topbar-menu-divider" aria-hidden="true" />}
                <div
                  className="position-relative d-inline-flex align-items-center"
                  style={{ overflow: "visible" }}
                  onMouseEnter={() => handleMouseEnter(index)}
                  onMouseLeave={handleMouseLeave}
                >
                  {/* Modül Butonu: Masaüstü Windows Menü Çubuğu Tarzı Kompakt Düğme (İkonlu) */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (hasChildren) {
                        setActiveDropdownIndex(isOpen ? null : index);
                      } else if (menu.link) {
                        navigateWithDashboardHop(menu.link);
                      }
                    }}
                    className={`desktop-menubar-btn d-flex align-items-center gap-1 ${
                      isOpen ? "open" : isMenuChildActive || isItemActive(menu.link) ? "active" : ""
                    }`}
                    style={{ cursor: "pointer" }}
                  >
                    {menu.icon && (
                      <span
                        className="menu-icon-wrap d-inline-flex align-items-center justify-content-center flex-shrink-0"
                        style={{
                          color: isOpen || isMenuChildActive || isItemActive(menu.link) ? "#0284c7" : theme.color || "#64748b",
                          fontSize: "0.78rem",
                        }}
                      >
                        {React.isValidElement(menu.icon)
                          ? React.cloneElement(menu.icon as React.ReactElement<any>, { size: 13 })
                          : menu.icon}
                      </span>
                    )}
                    <span className="menu-title-text">{menu.title}</span>
                  </button>

                  {/* 4. MOD: STANDART AŞAĞI AÇILIR LİSTE (KOMPAKT DESKTOP DROPDOWN - EN ÜSTTE MENÜ ADI YAZMAZ, İKONLU) */}
                  {hasChildren && isOpen && !isMegaMenu && (
                    <div
                      className="position-absolute shadow-lg bg-white border animate-dropdown-fade desktop-dropdown-menu"
                      style={{
                        top: "calc(100% + 1px)",
                        left: index >= 6 ? "auto" : 0,
                        right: index >= 6 ? 0 : "auto",
                        minWidth: "220px",
                        maxWidth: "340px",
                        zIndex: 1250,
                        maxHeight: "82vh",
                        overflowY: "auto",
                      }}
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
                                className="text-secondary fw-bold text-uppercase px-2.5 py-1 border-top border-bottom bg-light"
                                style={{ fontSize: "10px", letterSpacing: "0.5px" }}
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
                                    className="text-secondary fw-bold text-uppercase pb-1 mb-2 border-bottom"
                                    style={{ fontSize: "0.72rem", letterSpacing: "0.6px" }}
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
                                            <span className="text-truncate fw-medium" style={{ fontSize: "0.82rem" }}>
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
                                    <span className="text-truncate fw-medium" style={{ fontSize: "0.82rem" }}>
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
                                  <span className="text-truncate fw-medium" style={{ fontSize: "0.82rem" }}>
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
              </div>
            </React.Fragment>
            );
          })}
        </div>

        {/* 3. EN SAĞDA: Vezne Adı, Kullanıcı Adı, Tarih ve Saat (Daha Düzgün, Kompakt ve Tam Sığacak Şekilde) */}
        <div
          className="topbar-info-box d-flex flex-column justify-content-center flex-shrink-0 px-2 py-0.5 border-start user-select-none ms-auto"
          style={{
            minWidth: "116px",
            maxWidth: "145px",
            lineHeight: 1.22,
            backgroundColor: "#f8fafc",
            borderColor: "#cbd5e1",
          }}
        >
          {/* Vezne Adı */}
          <div className="d-flex align-items-center justify-content-between gap-1 text-nowrap" title={`Vezne: ${cleanVezne}`}>
            <span className="text-secondary" style={{ fontSize: "9px", fontWeight: 600 }}>Vezne</span>
            <span className="text-dark fw-bold text-truncate font-monospace" style={{ fontSize: "9.5px", maxWidth: "80px" }}>
              {cleanVezne}
            </span>
          </div>

          {/* Kullanıcı Adı */}
          <div className="d-flex align-items-center justify-content-between gap-1 text-nowrap" title={`Kullanıcı: ${displayName}`}>
            <span className="text-secondary" style={{ fontSize: "9px", fontWeight: 600 }}>Kul.</span>
            <span className="text-primary fw-bold text-truncate" style={{ fontSize: "9.5px", maxWidth: "80px" }}>
              {displayName}
            </span>
          </div>

          {/* Tarih ve Canlı Saat */}
          <div className="d-flex align-items-center justify-content-between gap-1 text-nowrap font-monospace" style={{ fontSize: "9px" }} title="Tarih ve Saat">
            <span className="text-muted" style={{ fontSize: "8.5px" }}>{currentDate}</span>
            <span className="fw-bold text-dark px-1 rounded bg-white border" style={{ fontSize: "9px" }}>
              {currentTime}
            </span>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default TopNavbarMenu;
