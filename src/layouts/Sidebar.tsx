import React, { Fragment, useState, useEffect, useRef, useCallback } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Accordion,
  Badge,
  Image,
  ListGroup,
  Nav,
  Dropdown,
} from "react-bootstrap";

//import custom types
import { MenuItemType } from "types/menuTypes";

import CustomToggle, { CustomToggleLevel2 } from "./SidebarMenuToggle";
import {
  IconX,
  IconLogin2,
  IconChevronUp,
  IconSettings,
  IconCheck,
  IconUser,
  IconClock,
  IconCalendar,
  IconCash,
} from "@tabler/icons-react";
import useMenu from "hooks/useMenu";
import { useAuth } from "../context/AuthContext";

// import required routes
import { getAssetPath } from "helper/assetPath";
import { DashboardMenu } from "routes/DashboardRoute";

interface SidebarProps {
  hideLogo: boolean;
  containerId?: string;
}

const Sidebar: React.FC<SidebarProps> = ({ hideLogo = false, containerId }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname;
  const { handleCollapsed, collapsed } = useMenu();
  const { user, logout } = useAuth();

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
        const currentMenu = DashboardMenu[pendingMenuIndexRef.current];
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
      const topMenuIndex = DashboardMenu.findIndex((menu) => {
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
          const el = document.querySelectorAll(".sidebar-menu-wrapper .nav-item.dropdown")[topMenuIndex];
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
  const displayRole = user?.role === "admin" || user?.isSysAdmin ? "Sistem Yöneticisi" : "Kasa Sorumlusu";

  const handleLogout = async (e: React.MouseEvent) => {
    e.preventDefault();
    await logout();
    navigate("/login", { replace: true });
  };

  const handleLinkClick = (e: React.MouseEvent, to: string) => {
    e.preventDefault();
    navigateWithDashboardHop(to);
  };

  //Generate Link
  const generateLink = (item: MenuItemType) => {
    const to = item.link?.startsWith("/") ? item.link : `/${item.link}`;
    return (
      <Link
        to={to}
        onClick={(e) => handleLinkClick(e, to)}
        className={`nav-link ${currentPath === to ? "active" : ""}`}>
        <span className="text">{item.name || item.title}</span>
        {item.badge && (
          <Badge
            className="ms-1"
            bg={item.badgecolor ? item.badgecolor : "primary"}>
            {item.badge}
          </Badge>
        )}
      </Link>
    );
  };

  return (
    <div
      id={containerId}
      className="d-flex flex-column h-100"
    >
      {/* 1. Brand Logo Header */}
      {hideLogo || (
        <div className="brand-logo d-flex align-items-center justify-content-between justify-content-xl-center px-3">
          <Link
            to="/dashboard"
            onClick={() => {
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
              <span className="brand-text-likya">Likya</span>{" "}
              <span className="brand-text-kuyum">Kuyum</span>
            </span>
          </Link>

          {/* Close Button ('X' - visible on all screens <1200px like Nest Hub, tablets, phones) */}
          <button
            type="button"
            className="btn btn-ghost p-1 d-flex d-xl-none align-items-center justify-content-center rounded-circle text-secondary"
            onClick={() => handleCollapsed("collapsed")}
            title="Menüyü Kapat"
          >
            <IconX size={22} />
          </button>
        </div>
      )}

      {/* 2. Scrollable Navigation Menu (Strictly below the logo) */}
      <div className="sidebar-menu-wrapper">
        <Accordion
          activeKey={activeMenuKey}
          onSelect={(k: any) => {
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
          {DashboardMenu.map(function (menu, index) {
            if (menu.grouptitle) {
              return (
                <Nav.Item key={index} as="li">
                  <div className="nav-heading">{menu.title}</div>
                  <hr className="mx-3 nav-line mb-1" />
                </Nav.Item>
              );
            } else {
              if (menu.children) {
                return (
                  <Fragment key={index}>
                    {/* Dropdown Parent Menu */}
                    <CustomToggle eventKey={index.toString()} icon={menu.icon}>
                      {menu.title}
                    </CustomToggle>
                    <Accordion.Collapse eventKey={index.toString()}>
                      <ListGroup as="ul" className="dropdown-menu sidebar-submenu-list flex-column show position-static bg-transparent py-1">
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
                                className="w-100"
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
                                      className="nav flex-column ps-3 py-1"
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
                                              className={`nav-link sidebar-sub-link py-1 px-3 ${currentPath === to2 ? "active" : ""
                                                }`}
                                            >
                                              <span className="text">
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
                              >
                                <Link
                                  to={to1}
                                  onClick={(e) => handleLinkClick(e, to1)}
                                  className={`nav-link sidebar-sub-link py-1 px-3 ${currentPath === to1 ? "active" : ""
                                    }`}
                                >
                                  <span className="text">
                                    {menuLevel1Item.name || menuLevel1Item.title}
                                  </span>
                                </Link>
                              </ListGroup.Item>
                            );
                          }
                        })}
                      </ListGroup>
                    </Accordion.Collapse>
                  </Fragment>
                );
              } else {
                const to = menu.link?.startsWith("/") ? menu.link : (menu.link ? `/${menu.link}` : "#");
                return (
                  <Nav.Item as="li" key={index}>
                    <Link
                      to={to}
                      onClick={(e) => handleLinkClick(e, to)}
                      className={`nav-link ${currentPath === to ? "active" : ""
                        }`}
                    >
                      {menu.icon && <span className="nav-icon">{menu.icon}</span>}
                      <span className="text">{menu.title}</span>
                    </Link>

                  </Nav.Item>
                );
              }
            }
          })}
        </Accordion>
      </div>

      {/* 3. Bottom User Profile Bar (Full Sidebar Width, Centered & Aesthetic) */}
      <div
        className="flex-shrink-0 border-top px-3 pt-3.5 pb-4 w-100"
        style={{
          borderColor: "#e2e8f0",
          background: "linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)",
          boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.8)",
          minHeight: "90px",
        }}
      >
        <div className="d-flex align-items-center justify-content-between w-100">
          {/* User Icon (Dark Gray with Online Dot) */}
          <div
            className="d-flex align-items-center justify-content-center rounded-circle flex-shrink-0 position-relative"
            style={{
              width: "40px",
              height: "40px",
              backgroundColor: "#ffffff",
              border: "1.5px solid #94a3b8",
              boxShadow: "0 2px 5px rgba(15, 23, 42, 0.08)",
            }}
            title={`Kullanıcı: ${displayName}`}
          >
            <IconUser size={22} strokeWidth={2.2} style={{ color: "#1e293b" }} />
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
              style={{ fontSize: "0.90rem", letterSpacing: "0.2px" }}
            >
              {displayName}
            </h6>

            {/* 2. Satır: Tarih ve Saat Yan Yana */}
            <div
              className="d-flex align-items-center justify-content-center gap-1.5 w-100 text-secondary"
              style={{ fontSize: "0.76rem", lineHeight: "1.2" }}
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
              style={{ fontSize: "0.76rem" }}
            >
              <span
                className="badge bg-primary-subtle text-primary border border-primary-subtle px-2 py-0.5 rounded-pill fw-semibold font-monospace d-inline-flex align-items-center gap-1 text-nowrap"
                style={{ letterSpacing: "0.3px", fontSize: "0.73rem" }}
                title={`Kullanıcı Vezne Numarası: ${user?.cashierCode || "01"}`}
              >
                <IconCash size={13} className="text-primary flex-shrink-0" />
                <span>Vezne: {user?.cashierCode || "01"}</span>
              </span>
            </div>
          </div>

          {/* Direct Logout Button */}
          <button
            type="button"
            onClick={handleLogout}
            className="btn btn-outline-danger btn-sm p-1.5 d-flex align-items-center justify-content-center rounded-3 flex-shrink-0 shadow-xs"
            title="Güvenli Çıkış Yap"
            style={{ width: "36px", height: "36px", transition: "all 0.2s ease" }}
          >
            <IconLogin2 size={19} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;

