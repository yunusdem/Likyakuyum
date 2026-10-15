import React, { Fragment, useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  IconArrowBarLeft,
  IconArrowBarRight,
  IconMaximize,
  IconMinimize,
  IconChartLine,
  IconScan,
  IconDiamond,
  IconReceipt2,
  IconShoppingCart,
  IconBuildingBank,
  IconArrowsExchange,
  IconFileCertificate,
  IconRefresh,
  IconEye,
  IconChartCandle,
  IconShoppingBag,
  IconBolt,
  IconDeviceTv,
  IconCash,
  IconUser,
  IconCalendar,
  IconClock,
  IconChevronRight,
  IconChevronLeft,
} from "@tabler/icons-react";
import { Container, ListGroup, Button } from "react-bootstrap";

//import custom components
import UserMenu from "./UserMenu";
import DestekZil from "components/destek/DestekZil";
import MasakModal from "components/masak/MasakModal";
import MasakMenu from "components/masak/MasakMenu";
import { TvKatalogMenuSecimModal } from "components/katalog/TvKatalogMenuSecimModal";
import { useAuth } from "../../context/AuthContext";
import { UST_KISAYOLLAR, modulAcikMi } from "../../config/modulKatalogu";
import HeaderThemeSelector from "components/theme/HeaderThemeSelector";
import { getAppBrand } from "../../utils/brandHelper";
import { CashDeskService } from "../../services/cashDeskService";
import useSidebarStyle from "../../hooks/useSidebarStyle";

//import custom hooks
import useMenu from "hooks/useMenu";

const quickActions = [
  {
    title: "Kur",
    to: "/kur/anlik-fiyat-listesi",
    icon: <IconChartLine size={16} strokeWidth={2.2} style={{ color: "#1d4ed8" }} />,
  },
  {
    title: "Vezne İzleme",
    to: "/vezne/izleme",
    icon: <IconEye size={16} strokeWidth={2.2} style={{ color: "#0e7490" }} />,
  },
  {
    title: "Fiyat",
    to: "/etiket/barkod-basimi",
    icon: <IconScan size={16} strokeWidth={2.2} style={{ color: "#047857" }} />,
  },
  {
    title: "Sarraf",
    to: "/vezne/genel-sarraf-fisi",
    icon: <IconDiamond size={16} strokeWidth={2.2} style={{ color: "#b45309" }} />,
  },
  {
    title: "Döviz",
    to: "/vezne/doviz-fisi",
    icon: <IconReceipt2 size={16} strokeWidth={2.2} style={{ color: "#0369a1" }} />,
  },
  {
    title: "Perakende",
    to: "/vezne/perakende-fisi-kayit",
    icon: <IconShoppingCart size={16} strokeWidth={2.2} style={{ color: "#b91c1c" }} />,
  },
  {
    // Ticari satış fişi (docs/TICARI_ISLEMLER_YOL_HARITASI.md, T18); yalnız Ticari İşlemler modülü açık firmada
    title: "Satış Fişi",
    to: "/ticari/satis-fisi",
    icon: <IconShoppingBag size={16} strokeWidth={2.2} style={{ color: "#c2410c" }} />,
  },
  {
    // Hızlı Satış (docs/HIZLI_SATIS_YOL_HARITASI.md, H3): en son kullanılan açık modülün dokunmatik satış ekranı
    title: "Hızlı Satış",
    to: "/hizli-satis",
    icon: <IconBolt size={16} strokeWidth={2.2} style={{ color: "#15803d" }} />,
  },
  {
    title: "Banka",
    to: "/banka/hareketler",
    icon: <IconBuildingBank size={16} strokeWidth={2.2} style={{ color: "#334155" }} />,
  },
  {
    title: "C. Hareket",
    to: "/cari/hareket-kayit",
    icon: <IconArrowsExchange size={16} strokeWidth={2.2} style={{ color: "#6d28d9" }} />,
  },
  {
    title: "e-Belge",
    to: "/e-belge",
    icon: <IconFileCertificate size={16} strokeWidth={2.2} style={{ color: "#1e3a8a" }} />,
  },
];


const Header: React.FC = () => {
  const navigate = useNavigate();
  // Yönetim panelinden firmaya kapatılan üst kısayollar çizilmez (adres → modül kodu: config/modulKatalogu.ts)
  const { user } = useAuth();
  const acikModuller = user?.merkez?.moduller;
  const gorunenKisayollar = quickActions.filter((a) => {
    const kisayol = UST_KISAYOLLAR.find((k) => k.to === a.to);
    return !kisayol || modulAcikMi(acikModuller, kisayol.key);
  });
  const masakAcik = modulAcikMi(acikModuller, "ust:masak");
  const piyasaAcik = modulAcikMi(acikModuller, "ust:piyasa");
  const [isMasakModalOpen, setIsMasakModalOpen] = useState<boolean>(false);
  const [isTvMenuModalOpen, setIsTvMenuModalOpen] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const { handleCollapsed, collapsed } = useMenu();

  const isExpanded = collapsed === "expanded" || !collapsed;

  const toggleSidebar = () => {
    handleCollapsed(isExpanded ? "collapsed" : "expanded");
  };

  const desktopScrollRef = React.useRef<HTMLDivElement>(null);
  const mobileScrollRef = React.useRef<HTMLDivElement>(null);
  const [desktopCanScrollLeft, setDesktopCanScrollLeft] = useState<boolean>(false);
  const [desktopCanScrollRight, setDesktopCanScrollRight] = useState<boolean>(false);
  const [mobileCanScrollLeft, setMobileCanScrollLeft] = useState<boolean>(false);
  const [mobileCanScrollRight, setMobileCanScrollRight] = useState<boolean>(false);

  const checkDesktopScroll = useCallback(() => {
    const el = desktopScrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setDesktopCanScrollLeft(scrollLeft > 6);
    setDesktopCanScrollRight(scrollLeft + clientWidth < scrollWidth - 6);
  }, []);

  const checkMobileScroll = useCallback(() => {
    const el = mobileScrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setMobileCanScrollLeft(scrollLeft > 6);
    setMobileCanScrollRight(scrollLeft + clientWidth < scrollWidth - 6);
  }, []);

  const scrollDesktop = (direction: "left" | "right") => {
    if (desktopScrollRef.current) {
      desktopScrollRef.current.scrollBy({
        left: direction === "right" ? 180 : -180,
        behavior: "smooth",
      });
    }
  };

  const scrollMobile = (direction: "left" | "right") => {
    if (mobileScrollRef.current) {
      mobileScrollRef.current.scrollBy({
        left: direction === "right" ? 150 : -150,
        behavior: "smooth",
      });
    }
  };

  useEffect(() => {
    checkDesktopScroll();
    checkMobileScroll();
    const timer = setTimeout(() => {
      checkDesktopScroll();
      checkMobileScroll();
    }, 150);
    return () => clearTimeout(timer);
  }, [checkDesktopScroll, checkMobileScroll, gorunenKisayollar.length, isExpanded]);

  useEffect(() => {
    const dEl = desktopScrollRef.current;
    const mEl = mobileScrollRef.current;
    if (!dEl && !mEl) return;
    const ro = new ResizeObserver(() => {
      checkDesktopScroll();
      checkMobileScroll();
    });
    if (dEl) ro.observe(dEl);
    if (mEl) ro.observe(mEl);
    return () => ro.disconnect();
  }, [checkDesktopScroll, checkMobileScroll]);

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

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  const sidebarStyle = useSidebarStyle();
  const isHeaderNav = sidebarStyle === "topbar" || sidebarStyle === "megamenu";

  const displayName = user?.fullName || user?.username || "Admin";

  return (
    <Fragment>
      <header className="navbar-glass bg-white border-bottom sticky-top shadow-xs">
        <style>{`
          .header-quick-actions-desktop::-webkit-scrollbar,
          .header-quick-actions-mobile::-webkit-scrollbar {
            display: none !important;
            width: 0 !important;
            height: 0 !important;
          }
          .quick-action-btn {
            transition: all 0.15s ease;
            min-width: 36px;
            cursor: pointer;
          }
          .quick-action-btn:hover {
            background-color: rgba(0, 0, 0, 0.05) !important;
          }
          .quick-action-mobile-pill {
            transition: all 0.15s ease;
            flex-shrink: 0 !important;
          }
          .quick-action-mobile-pill:active {
            transform: scale(0.96);
          }
          .quick-actions-scroll-arrow {
            position: absolute;
            top: 50%;
            transform: translateY(-50%);
            border: none;
            padding: 0;
            display: flex;
            align-items: center;
            cursor: pointer;
            z-index: 5;
            transition: all 0.2s ease;
          }
          .quick-actions-scroll-arrow .arrow-circle {
            width: 22px;
            height: 22px;
            background: rgba(255, 255, 255, 0.85);
            backdrop-filter: blur(4px);
            border: 1px solid rgba(0, 0, 0, 0.14);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #334155;
            opacity: 0.72;
            box-shadow: 0 1px 4px rgba(0, 0, 0, 0.12);
            transition: all 0.15s ease;
          }
          .quick-actions-scroll-arrow:hover .arrow-circle {
            opacity: 1 !important;
            transform: scale(1.1);
            background: #ffffff;
            color: #0f172a;
            box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
          }
        `}</style>
        <Container fluid className="px-2 px-lg-3 py-0.5">
          <div className="d-flex align-items-center justify-content-between w-100 flex-nowrap" style={{ minWidth: 0 }}>
            {/* Left Area: Toggle & Title / Desktop Quick Actions */}
            <div className="d-flex align-items-center gap-1 gap-lg-2 flex-grow-1 min-w-0 overflow-hidden me-2" style={{ minWidth: 0 }}>
              <button
                type="button"
                className="btn btn-light border p-0 d-flex align-items-center justify-content-center rounded-2 sidebar-toggle-btn shadow-xs flex-shrink-0"
                onClick={toggleSidebar}
                title={isExpanded ? "Menüyü Daralt / Kapat" : "Menüyü Genişlet / Aç"}
                style={{ width: "32px", height: "32px" }}
              >
                {isExpanded ? (
                  <IconArrowBarLeft
                    size={18}
                    strokeWidth={2}
                    className="text-dark"
                  />
                ) : (
                  <IconArrowBarRight
                    size={18}
                    strokeWidth={2}
                    className="text-dark"
                  />
                )}
              </button>

              {/* Mobile & Tablet Brand Title (Yeşil Arka Planlı Marka Alanı) */}
              <Link
                to="/dashboard"
                className="d-inline-flex d-lg-none align-items-center ms-1 px-2.5 py-1 rounded-2 text-decoration-none flex-shrink-0 header-mobile-brand-box"
                style={{
                  background: "linear-gradient(135deg, #059669 0%, #047857 45%, #064e3b 100%)",
                  boxShadow: "0 2px 6px rgba(4, 120, 87, 0.25)",
                  border: "1px solid rgba(255, 255, 255, 0.2)",
                  height: "32px",
                }}
                title="Ana Sayfa"
              >
                <img
                  src="/images/logo/logo.svg"
                  alt="Likya Kuyum Logo"
                  className="site-logo-img flex-shrink-0 me-1.5"
                  style={{
                    width: "20px",
                    height: "20px",
                    objectFit: "contain",
                    filter: "drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3))",
                  }}
                />
                <span
                  className="fw-bold site-logo-text text-nowrap d-inline-flex align-items-center"
                  style={{
                    fontSize: "0.88rem",
                    filter: "drop-shadow(0 1px 2px rgba(0, 0, 0, 0.45))",
                  }}
                >
                  <span className="brand-text-likya">{getAppBrand(user).prefix}</span>{" "}
                  <span className="brand-text-kuyum ms-1">{getAppBrand(user).suffix}</span>
                </span>
              </Link>

              {/* Desktop Quick Actions (Icon + Text Label) - Asla Sağ Araçları İtmez, Gerekirse Yatay Kaydırılır */}
              <div className="d-none d-lg-flex align-items-center flex-grow-1 min-w-0 position-relative overflow-hidden ms-2 border-start ps-2 ps-xl-3">
                {desktopCanScrollLeft && (
                  <button
                    type="button"
                    onClick={() => scrollDesktop("left")}
                    className="quick-actions-scroll-arrow start-0 ps-0.5"
                    style={{
                      height: "100%",
                      width: "30px",
                      background: "linear-gradient(to left, rgba(255,255,255,0), rgba(255,255,255,0.92) 55%, #ffffff 100%)",
                      justifyContent: "flex-start",
                    }}
                    title="Geri kaydır"
                  >
                    <span className="arrow-circle">
                      <IconChevronLeft size={13} strokeWidth={2.4} />
                    </span>
                  </button>
                )}

                <div
                  ref={desktopScrollRef}
                  onScroll={checkDesktopScroll}
                  className="d-flex align-items-center gap-1 gap-xl-2 flex-nowrap header-quick-actions-desktop w-100"
                  style={{
                    overflowX: "auto",
                    scrollbarWidth: "none",
                    msOverflowStyle: "none",
                    WebkitOverflowScrolling: "touch",
                    minWidth: 0,
                    maxWidth: "100%",
                  }}
                  onWheel={(e) => {
                    if (e.deltaY !== 0) {
                      e.currentTarget.scrollLeft += e.deltaY;
                    }
                  }}
                >
                {gorunenKisayollar.map((action, idx) => (
                  <Link
                    key={idx}
                    to={action.to}
                    onClick={(e) => {
                      e.preventDefault();
                      navigateWithDashboardHop(action.to);
                    }}
                    className="d-flex flex-column align-items-center justify-content-center text-decoration-none px-1 px-xl-1.5 py-0.5 rounded-2 quick-action-btn flex-shrink-0"
                  >
                    <span className="d-flex align-items-center justify-content-center" style={{ marginBottom: "1px" }}>
                      {action.icon}
                    </span>
                    <span
                      style={{
                        fontSize: "10px",
                        fontWeight: 500,
                        color: "#000000",
                        lineHeight: 1,
                        whiteSpace: "nowrap",
                        letterSpacing: "-0.1px",
                      }}
                    >
                      {action.title}
                    </span>
                  </Link>
                ))}

                {/* MASAK Quick Action Dropdown */}
                {masakAcik && (
                  <div className="flex-shrink-0">
                    <MasakMenu onUpdate={() => setIsMasakModalOpen(true)} />
                  </div>
                )}

                {/* Piyasa */}
                {piyasaAcik && (
                  <Link
                    to="/piyasa"
                    onClick={(e) => {
                      e.preventDefault();
                      navigateWithDashboardHop("/piyasa");
                    }}
                    className="d-flex flex-column align-items-center justify-content-center text-decoration-none px-1 px-xl-1.5 py-0.5 rounded-2 quick-action-btn flex-shrink-0"
                  >
                    <span className="d-flex align-items-center justify-content-center" style={{ marginBottom: "1px" }}>
                      <IconChartCandle size={16} strokeWidth={2.2} style={{ color: "#b8860b" }} />
                    </span>
                    <span style={{ fontSize: "10px", fontWeight: 700, color: "#b8860b", lineHeight: 1, whiteSpace: "nowrap", letterSpacing: "-0.1px" }}>
                      Piyasa
                    </span>
                  </Link>
                )}

                {/* Menü Aç: Katalog & TV Menü Seçim Butonu */}
                <button
                  type="button"
                  onClick={() => setIsTvMenuModalOpen(true)}
                  className="btn p-0 border-0 bg-transparent d-flex flex-column align-items-center justify-content-center text-decoration-none px-1 px-xl-1.5 py-0.5 rounded-2 quick-action-btn flex-shrink-0"
                  title="Katalog & TV Menü Aç (Altın & Özel Ürünler)"
                  style={{ cursor: "pointer" }}
                >
                  <span className="d-flex align-items-center justify-content-center" style={{ marginBottom: "1px" }}>
                    <IconDeviceTv size={16} strokeWidth={2.2} style={{ color: "#0284c7" }} />
                  </span>
                  <span
                    style={{
                      fontSize: "10px",
                      fontWeight: 700,
                      color: "#0284c7",
                      lineHeight: 1,
                      whiteSpace: "nowrap",
                      letterSpacing: "-0.1px",
                    }}
                  >
                    Katalog Aç
                  </span>
                </button>
                </div>

                {desktopCanScrollRight && (
                  <button
                    type="button"
                    onClick={() => scrollDesktop("right")}
                    className="quick-actions-scroll-arrow end-0 pe-0.5"
                    style={{
                      height: "100%",
                      width: "32px",
                      background: "linear-gradient(to right, rgba(255,255,255,0), rgba(255,255,255,0.92) 55%, #ffffff 100%)",
                      justifyContent: "flex-end",
                    }}
                    title="Daha fazla göster (Sağa kaydır)"
                  >
                    <span className="arrow-circle">
                      <IconChevronRight size={13} strokeWidth={2.4} />
                    </span>
                  </button>
                )}
              </div>
            </div>

            {/* Right Area: Action Icons (Theme Selector, Fullscreen, Notification, User Menu) */}
            <ListGroup
              bsPrefix="list-unstyled"
              as={"ul"}
              className="d-flex align-items-center mb-0 gap-1 gap-sm-1.5 flex-shrink-0 ms-auto"
            >
              {/* Theme Quick Selector Dropdown & Modal */}
              <ListGroup.Item as="li" className="me-0.5 flex-shrink-0">
                <HeaderThemeSelector />
              </ListGroup.Item>

              {/* Sayfa Yenileme Butonu (Masaüstü & Tablet) */}
              <ListGroup.Item as="li" className="d-none d-sm-block flex-shrink-0">
                <Button
                  variant="ghost"
                  className="btn-icon rounded-circle d-flex align-items-center justify-content-center text-secondary p-0"
                  onClick={() => window.location.reload()}
                  title="Sayfayı Yenile (F5)"
                  style={{ width: "32px", height: "32px" }}
                >
                  <IconRefresh size={18} strokeWidth={1.75} />
                </Button>
              </ListGroup.Item>

              {/* Fullscreen Toggle Button (Masaüstü & Tablet) */}
              <ListGroup.Item as="li" className="d-none d-sm-block flex-shrink-0">
                <Button
                  variant="ghost"
                  className="btn-icon rounded-circle d-flex align-items-center justify-content-center text-secondary p-0"
                  onClick={toggleFullscreen}
                  title={isFullscreen ? "Tam Ekrandan Çık" : "Tam Ekran Yap"}
                  style={{ width: "32px", height: "32px" }}
                >
                  {isFullscreen ? (
                    <IconMinimize size={18} strokeWidth={1.75} />
                  ) : (
                    <IconMaximize size={18} strokeWidth={1.75} />
                  )}
                </Button>
              </ListGroup.Item>

              {/* Destek zili: sayaç, sağ panel, Talep Oluştur */}
              <ListGroup.Item as="li" className="flex-shrink-0">
                <DestekZil />
              </ListGroup.Item>

              {/* User Profile Menu / Çıkış Yap */}
              <ListGroup.Item as="li" className="flex-shrink-0">
                <UserMenu />
              </ListGroup.Item>
            </ListGroup>
          </div>

          {/* Mobile & Tablet Quick Actions Sub-Bar (Horizontal Scrollable Strip) */}
          <div className="d-flex d-lg-none position-relative w-100 mt-1">
            {mobileCanScrollLeft && (
              <button
                type="button"
                onClick={() => scrollMobile("left")}
                className="quick-actions-scroll-arrow start-0 ps-1"
                style={{
                  height: "100%",
                  width: "34px",
                  background: "linear-gradient(to left, rgba(255,255,255,0), rgba(255,255,255,0.92) 55%, #ffffff 100%)",
                  justifyContent: "flex-start",
                }}
                title="Geri kaydır"
              >
                <span className="arrow-circle">
                  <IconChevronLeft size={13} strokeWidth={2.4} />
                </span>
              </button>
            )}

            <div
              ref={mobileScrollRef}
              onScroll={checkMobileScroll}
              className="d-flex align-items-center gap-1.5 pt-2 pb-1 border-top header-quick-actions-mobile w-100 flex-nowrap"
              style={{
                overflowX: "auto",
                scrollbarWidth: "none",
                msOverflowStyle: "none",
                WebkitOverflowScrolling: "touch",
              }}
            >
              {gorunenKisayollar.map((action, idx) => (
                <Link
                  key={idx}
                  to={action.to}
                  onClick={(e) => {
                    e.preventDefault();
                    navigateWithDashboardHop(action.to);
                  }}
                  className="d-flex align-items-center gap-1 text-decoration-none px-2 py-1 rounded-pill bg-light border text-nowrap quick-action-mobile-pill flex-shrink-0"
                >
                  <span className="d-inline-flex align-items-center justify-content-center">{action.icon}</span>
                  <span
                    style={{
                      fontSize: "10px",
                      fontWeight: 500,
                      color: "#000000",
                      lineHeight: 1,
                    }}
                  >
                    {action.title}
                  </span>
                </Link>
              ))}

              {masakAcik && (
                <div className="flex-shrink-0">
                  <MasakMenu mobile onUpdate={() => setIsMasakModalOpen(true)} />
                </div>
              )}

              {piyasaAcik && (
                <Link
                  to="/piyasa"
                  onClick={(e) => {
                    e.preventDefault();
                    navigateWithDashboardHop("/piyasa");
                  }}
                  className="d-flex align-items-center gap-1 text-decoration-none px-2 py-1 rounded-pill bg-light border text-nowrap quick-action-mobile-pill flex-shrink-0"
                >
                  <IconChartCandle size={16} strokeWidth={2} style={{ color: "#b8860b" }} />
                  <span style={{ fontSize: "10px", fontWeight: 700, color: "#b8860b" }}>Piyasa</span>
                </Link>
              )}

              {/* Mobil Menü Aç Butonu */}
              <button
                type="button"
                onClick={() => setIsTvMenuModalOpen(true)}
                className="d-flex align-items-center gap-1 text-decoration-none px-2 py-1 rounded-pill bg-light border text-nowrap quick-action-mobile-pill btn p-0 flex-shrink-0"
                style={{ cursor: "pointer" }}
                title="Katalog & TV Menü Aç"
              >
                <IconDeviceTv size={16} strokeWidth={2} style={{ color: "#0284c7" }} />
                <span style={{ fontSize: "10px", fontWeight: 700, color: "#0284c7" }}>Katalog Aç</span>
              </button>
            </div>

            {mobileCanScrollRight && (
              <button
                type="button"
                onClick={() => scrollMobile("right")}
                className="quick-actions-scroll-arrow end-0 pe-1"
                style={{
                  height: "100%",
                  width: "34px",
                  background: "linear-gradient(to right, rgba(255,255,255,0), rgba(255,255,255,0.92) 55%, #ffffff 100%)",
                  justifyContent: "flex-end",
                }}
                title="Daha fazla göster (Sağa kaydır)"
              >
                <span className="arrow-circle">
                  <IconChevronRight size={13} strokeWidth={2.4} />
                </span>
              </button>
            )}
          </div>
        </Container>
      </header>

      {/* MASAK Detailed Modal */}
      <MasakModal
        show={isMasakModalOpen}
        onHide={() => setIsMasakModalOpen(false)}
      />

      {/* Katalog & TV Menü Seçim Modalı */}
      <TvKatalogMenuSecimModal
        show={isTvMenuModalOpen}
        onClose={() => setIsTvMenuModalOpen(false)}
      />

    </Fragment>
  );
};

export default Header;
