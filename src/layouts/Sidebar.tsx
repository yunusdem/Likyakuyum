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
  IconLogin2,
  IconKey,
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
} from "@tabler/icons-react";
import useMenu from "hooks/useMenu";
import { useAuth } from "../context/AuthContext";

// import required routes
import { DashboardMenu } from "routes/DashboardRoute";
import { menuyuSuz } from "../config/modulKatalogu";

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
  const n = (name || "").toLowerCase();
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
  if (n.includes("tanim") || n.includes("tanım") || n.includes("ayar")) {
    return <IconSettings size={16} className="sidebar-sub-icon flex-shrink-0" />;
  }
  if (n.includes("kullanıcı") || n.includes("kullanici") || n.includes("aktivasyon")) {
    return <IconUserCheck size={16} className="sidebar-sub-icon flex-shrink-0" />;
  }
  if (n.includes("yazıcı") || n.includes("yazici")) {
    return <IconPrinter size={16} className="sidebar-sub-icon flex-shrink-0" />;
  }
  if (n.includes("numara") || n.includes("numaratör")) {
    return <IconNumbers size={16} className="sidebar-sub-icon flex-shrink-0" />;
  }
  if (n.includes("devir") || n.includes("servis")) {
    return <IconRefresh size={16} className="sidebar-sub-icon flex-shrink-0" />;
  }
  if (n.includes("masak")) {
    return <IconShieldExclamation size={16} className="sidebar-sub-icon flex-shrink-0" />;
  }
  if (n.includes("firma")) {
    return <IconBuilding size={16} className="sidebar-sub-icon flex-shrink-0" />;
  }
  return <IconFileText size={16} className="sidebar-sub-icon flex-shrink-0" />;
};

const Sidebar: React.FC<SidebarProps> = ({ hideLogo = false, containerId }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname;
  const { handleCollapsed, collapsed } = useMenu();
  const { user, logout } = useAuth();
  // Yönetim panelinden firmaya kapatılan menüler hiç çizilmez (kısayol tuşları da yalnız görünen menüde çalışır)
  const gorunenMenu = useMemo(() => menuyuSuz(DashboardMenu, user?.merkez?.moduller), [user?.merkez?.moduller]);
  const gorunenMenuRef = useRef(gorunenMenu);
  gorunenMenuRef.current = gorunenMenu;

  const [activeMenuKey, setActiveMenuKey] = useState<string>("");
  const [pendingMenuIndex, setPendingMenuIndex] = useState<number | null>(null);
  const pendingMenuIndexRef = useRef<number | null>(null);
  const pendingTimerRef = useRef<any>(null);

  const setPending = (idx: number | null) => {
    pendingMenuIndexRef.current = idx;
    setPendingMenuIndex(idx);
  };

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

  // Reset pending state on route change
  useEffect(() => {
    setPending(null);
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
    if (collapsed === "collapsed") {
      handleCollapsed("expanded");
    }
    navigateWithDashboardHop(to);
  };

  return (
    <div
      id={containerId}
      className="d-flex flex-column h-100"
      onClick={() => {
        if (collapsed === "collapsed") {
          handleCollapsed("expanded");
        }
      }}
    >
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
              <span className="brand-text-likya">LİKYA</span>{" "}
              <span className="brand-text-kuyum">KUYUM</span>
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
                return (
                  <div key={index} className="sidebar-menu-section">
                    {/* Dropdown Parent Menu with Colorful Icon Badge */}
                    <CustomToggle
                      eventKey={index.toString()}
                      icon={menu.icon}
                      theme={theme}
                    >
                      {menu.title}
                    </CustomToggle>

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
                                  defaultActiveKey=""
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
                                                currentPath === to2 ? "active" : ""
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
                                    currentPath === to1 ? "active" : ""
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
                  </div>
                );
              } else {
                const to = menu.link?.startsWith("/")
                  ? menu.link
                  : menu.link
                  ? `/${menu.link}`
                  : "#";
                return (
                  <div key={index} className="sidebar-menu-section">
                    <Nav.Item as="li" className="sidebar-parent-item">
                      <Link
                        to={to}
                        onClick={(e) => handleLinkClick(e, to)}
                        className={`sidebar-menu-btn nav-link d-flex align-items-center ${
                          currentPath === to ? "active" : ""
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

            {/* 3. Satır: Vezne Numarası */}
            <div
              className="d-flex align-items-center justify-content-center gap-1 w-100 mt-1"
              style={{ fontSize: "0.75rem" }}
            >
              <span
                className="badge bg-primary-subtle text-primary border border-primary-subtle px-2 py-0.5 rounded-pill fw-semibold font-monospace d-inline-flex align-items-center gap-1 text-nowrap"
                style={{ letterSpacing: "0.3px", fontSize: "0.72rem" }}
                title={`Kullanıcı Vezne Numarası: ${user?.cashierCode || "01"}`}
              >
                <IconCash size={13} className="text-primary flex-shrink-0" />
                <span>Vezne: {user?.cashierCode || "01"}</span>
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => navigate("/sifre-degistir")}
            className="btn btn-outline-secondary btn-sm p-1.5 d-flex align-items-center justify-content-center rounded-3 flex-shrink-0 shadow-xs me-1"
            title="Şifre Değiştir"
            style={{ width: "34px", height: "34px", transition: "all 0.2s ease" }}
          >
            <IconKey size={18} />
          </button>

          {/* Direct Logout Button */}
          <button
            type="button"
            onClick={handleLogout}
            className="btn btn-outline-danger btn-sm p-1.5 d-flex align-items-center justify-content-center rounded-3 flex-shrink-0 shadow-xs"
            title="Güvenli Çıkış Yap"
            style={{ width: "34px", height: "34px", transition: "all 0.2s ease" }}
          >
            <IconLogin2 size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
