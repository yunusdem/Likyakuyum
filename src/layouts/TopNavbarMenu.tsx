import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { DashboardMenu } from "../routes/DashboardRoute";
import { menuyuSuz } from "../config/modulKatalogu";
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

  const gorunenMenu = useMemo(
    () => solMenuyuBirlestir(menuyuSuz(DashboardMenu, user?.merkez?.moduller)),
    [user?.merkez?.moduller]
  );

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

        /* 6. MOD MODERN MEGA MENÜ ELEMANLARI (YAZILAR ASLA ÜST ÜSTE BİNMEZ, ARMA YOK) */
        .mega-clean-link {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 12px;
          background-color: #f8fafc;
          border: 1px solid #f1f5f9;
          border-radius: 8px;
          text-decoration: none;
          color: #1e293b;
          transition: all 0.15s ease-in-out;
          margin-bottom: 6px;
          white-space: nowrap;
        }
        .mega-clean-link:hover {
          background-color: #ffffff;
          border-color: #38bdf8;
          box-shadow: 0 4px 14px rgba(56, 189, 248, 0.15);
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
        {/* 1. EN SOLDA YEŞİL BRAND ALANI (1. SİDEBARDTAKİ GİBİ ALTIN YALDIZLI YAZI VE AYNI ARKA PLAN) */}
        {/* 6. MODDA KULLANICI İSTEĞİ: "solundaki arma kısmını vs kaldır" -> Arma ikonu kaldırıldı, sadece yaldızlı yazı var */}
        <div
          className="brand-logo topbar-brand-box d-flex align-items-center flex-shrink-0 px-3"
          style={{
            background: "linear-gradient(135deg, #059669 0%, #047857 45%, #064e3b 100%)",
            minHeight: "42px",
            borderRight: "1px solid rgba(0, 0, 0, 0.15)",
            boxShadow: "0 2px 6px rgba(4, 120, 87, 0.2)",
          }}
        >
          <Link
            to="/dashboard"
            className="d-flex align-items-center text-decoration-none py-1 overflow-hidden"
            style={{ minWidth: 0, cursor: "pointer" }}
            title="Ana Sayfa"
          >
            <img
              src="/images/logo/logo.svg"
              alt="Likya Kuyum Logo"
              className="site-logo-img flex-shrink-0 me-2"
              style={{ width: "26px", height: "26px", objectFit: "contain", display: "inline-block" }}
            />
            <span
              className="fw-bold site-logo-text text-nowrap"
              style={{ fontSize: "1.08rem" }}
            >
              <span className="brand-text-likya">{brand.prefix}</span>{" "}
              <span className="brand-text-kuyum">{brand.suffix}</span>
            </span>
          </Link>
        </div>

        {/* 2. ORTA BÖLÜM: 8 ALANIN HEPSİ TAM SIĞACAK ŞEKİLDE SIRALI MODÜL MENÜLERİ (TEK SATIR, ASLA WRAP ETMEZ) */}
        <div
          className="d-flex align-items-center gap-1 flex-grow-1 px-2 py-1 flex-nowrap"
          style={{ overflow: "visible", whiteSpace: "nowrap" }}
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
              <div
                key={index}
                className="position-relative"
                style={{ overflow: "visible" }}
                onMouseEnter={() => handleMouseEnter(index)}
                onMouseLeave={handleMouseLeave}
              >
                {/* Modül Butonu: Üzerine gelince (Hover) otomatik açılır, tıklanınca da açılır */}
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
                  className={`btn btn-sm d-flex align-items-center gap-1.5 px-2 py-1 rounded-2 border-0 transition-all ${
                    isMenuChildActive || isItemActive(menu.link)
                      ? "bg-primary text-white shadow-xs fw-bold"
                      : isOpen
                      ? "bg-light text-primary fw-bold border border-primary-subtle shadow-xs"
                      : "btn-light text-secondary fw-semibold hover-bg-light"
                  }`}
                  style={{
                    fontSize: "0.76rem",
                    transition: "all 0.15s ease",
                    whiteSpace: "nowrap",
                    cursor: "pointer",
                  }}
                >
                  {menu.icon && (
                    <span
                      className="d-inline-flex align-items-center justify-content-center rounded-circle flex-shrink-0"
                      style={{
                        width: "18px",
                        height: "18px",
                        backgroundColor:
                          isMenuChildActive || isItemActive(menu.link)
                            ? "rgba(255,255,255,0.25)"
                            : theme.bg,
                        color:
                          isMenuChildActive || isItemActive(menu.link)
                            ? "#ffffff"
                            : theme.color,
                        fontSize: "0.68rem",
                      }}
                    >
                      {menu.icon}
                    </span>
                  )}
                  <span>{menu.title}</span>
                  {hasChildren && (
                    <IconChevronDown
                      size={12}
                      className={`flex-shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}
                      style={{ opacity: 0.7 }}
                    />
                  )}
                </button>

                {/* 4. MOD: STANDART AŞAĞI AÇILIR LİSTE (KOMPAKT) */}
                {hasChildren && isOpen && !isMegaMenu && (
                  <div
                    className="position-absolute shadow-lg bg-white rounded-3 border p-1.5 animate-dropdown-fade"
                    style={{
                      top: "calc(100% + 4px)",
                      left: 0,
                      minWidth: "250px",
                      maxWidth: "340px",
                      zIndex: 1250,
                      borderColor: "rgba(0, 0, 0, 0.18)",
                      backgroundColor: "#ffffff",
                      boxShadow: "0 18px 40px rgba(0, 0, 0, 0.25)",
                      maxHeight: "80vh",
                      overflowY: "auto",
                    }}
                    onMouseEnter={() => handleMouseEnter(index)}
                    onMouseLeave={handleMouseLeave}
                  >
                    <div className="d-flex flex-column gap-0.5">
                      {menu.children?.map((child, cIdx) => {
                        const childTitle = child.title || child.name || "";
                        if (child.children && child.children.length > 0) {
                          return (
                            <div key={cIdx} className="px-1 py-1">
                              <div
                                className="text-muted fw-bold text-uppercase px-2 py-0.5"
                                style={{ fontSize: "0.68rem", letterSpacing: "0.5px" }}
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
                                    className={`sidebar-flyout-item ${
                                      isActive ? "active text-primary fw-bold" : ""
                                    }`}
                                    style={{ padding: "5px 8px", fontSize: "0.8rem" }}
                                  >
                                    {getSubmenuIcon(subTitle)}
                                    <span>{subTitle}</span>
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
                              className={`sidebar-flyout-item ${
                                isActive ? "active text-primary fw-bold" : ""
                              }`}
                              style={{ padding: "5px 8px", fontSize: "0.8rem" }}
                            >
                              {getSubmenuIcon(childTitle)}
                              <span>{childTitle}</span>
                            </Link>
                          );
                        }
                      })}
                    </div>
                  </div>
                )}

                {/* 6. MOD: MODERN ÇOK SÜTUNLU YATAY MEGA PANEL */}
                {/* KULLANICI TALEBİ: "solundaki arma kısmını vs kaldır, yazı üstüne vs gelmesin, üzerine gelince otomatik açılsın" */}
                {hasChildren && isOpen && isMegaMenu && (
                  <div
                    className="position-absolute bg-white rounded-3 border p-3 animate-dropdown-fade"
                    style={{
                      top: "calc(100% + 4px)",
                      ...getDropdownAlignment(),
                      width: "740px",
                      maxWidth: "calc(100vw - 30px)",
                      zIndex: 1250,
                      borderColor: "rgba(0, 0, 0, 0.12)",
                      backgroundColor: "#ffffff",
                      boxShadow: "0 22px 50px -10px rgba(15, 23, 42, 0.22), 0 0 0 1px rgba(15, 23, 42, 0.05)",
                    }}
                    onMouseEnter={() => handleMouseEnter(index)}
                    onMouseLeave={handleMouseLeave}
                  >
                    {/* Üst Bilgi Başlığı (Arma/Logo Yok, Temiz ve Şık Modern Başlık) */}
                    <div className="d-flex align-items-center justify-content-between pb-2 mb-2.5 border-bottom">
                      <div className="d-flex align-items-center gap-2">
                        <span
                          style={{
                            width: "8px",
                            height: "8px",
                            borderRadius: "50%",
                            backgroundColor: theme.color,
                          }}
                        />
                        <span className="fw-bold text-dark fs-6 text-uppercase" style={{ letterSpacing: "0.5px" }}>
                          {menu.title}
                        </span>
                      </div>
                      <span className="badge bg-light text-secondary border px-2 py-1 small">
                        {menu.children?.reduce((acc, c) => acc + (c.children?.length || 1), 0)} İşlem Sayfası
                      </span>
                    </div>

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
            );
          })}
        </div>

        {/* 3. EN SAĞDA: Vezne Adı, Kullanıcı Adı, Tarih ve Saat (Küçük Alt Alta) */}
        <div
          className="d-none d-lg-flex flex-column align-items-end justify-content-center flex-shrink-0 px-2.5 py-0.5 border-start text-end user-select-none"
          style={{ minWidth: "125px", lineHeight: 1.25, fontSize: "11px", borderColor: "rgba(0,0,0,0.08)" }}
        >
          {/* Vezne Adı */}
          <div className="d-flex align-items-center gap-1 font-monospace text-nowrap" title={`Vezne: ${cleanVezne}`}>
            <span className="text-secondary" style={{ fontSize: "10px" }}>Vezne:</span>
            <strong className="text-dark text-truncate" style={{ maxWidth: "125px" }}>{cleanVezne}</strong>
          </div>

          {/* Kullanıcı Adı */}
          <div className="d-flex align-items-center gap-1 text-nowrap" title={`Kullanıcı: ${displayName}`}>
            <span className="text-secondary" style={{ fontSize: "10px" }}>Kullanıcı:</span>
            <strong className="text-primary text-truncate" style={{ maxWidth: "125px" }}>{displayName}</strong>
          </div>

          {/* Tarih ve Canlı Saat */}
          <div className="d-flex align-items-center gap-1 text-nowrap font-monospace" style={{ fontSize: "10px" }} title="Tarih ve Saat">
            <span className="text-secondary">{currentDate}</span>
            <span className="fw-bold text-dark">{currentTime}</span>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default TopNavbarMenu;
