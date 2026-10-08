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
} from "@tabler/icons-react";
import { Container, ListGroup, Button } from "react-bootstrap";

//import custom components
import UserMenu from "./UserMenu";
import DestekZil from "components/destek/DestekZil";
import MasakModal from "components/masak/MasakModal";
import MasakMenu from "components/masak/MasakMenu";
import { useAuth } from "../../context/AuthContext";
import { UST_KISAYOLLAR, modulAcikMi } from "../../config/modulKatalogu";
import HeaderThemeSelector from "components/theme/HeaderThemeSelector";
import { getAppBrand } from "../../utils/brandHelper";

//import custom hooks
import useMenu from "hooks/useMenu";

const quickActions = [
  {
    title: "Kur",
    to: "/kur/anlik-fiyat-listesi",
    icon: <IconChartLine size={19} strokeWidth={2.2} style={{ color: "#1d4ed8" }} />,
  },
  {
    title: "Vezne İzleme",
    to: "/vezne/izleme",
    icon: <IconEye size={19} strokeWidth={2.2} style={{ color: "#0e7490" }} />,
  },
  {
    title: "Fiyat",
    to: "/etiket/barkod-basimi",
    icon: <IconScan size={19} strokeWidth={2.2} style={{ color: "#047857" }} />,
  },
  {
    title: "Sarraf",
    to: "/vezne/genel-sarraf-fisi",
    icon: <IconDiamond size={19} strokeWidth={2.2} style={{ color: "#b45309" }} />,
  },
  {
    title: "Döviz",
    to: "/vezne/doviz-fisi",
    icon: <IconReceipt2 size={19} strokeWidth={2.2} style={{ color: "#0369a1" }} />,
  },
  {
    title: "Perakende",
    to: "/vezne/perakende-fisi-kayit",
    icon: <IconShoppingCart size={19} strokeWidth={2.2} style={{ color: "#b91c1c" }} />,
  },
  {
    title: "Banka",
    to: "/banka/hareketler",
    icon: <IconBuildingBank size={19} strokeWidth={2.2} style={{ color: "#334155" }} />,
  },
  {
    title: "C. Hareket",
    to: "/cari/hareket-kayit",
    icon: <IconArrowsExchange size={19} strokeWidth={2.2} style={{ color: "#6d28d9" }} />,
  },
  {
    title: "e-Belge",
    to: "/e-belge",
    icon: <IconFileCertificate size={19} strokeWidth={2.2} style={{ color: "#1e3a8a" }} />,
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
  const [isMasakModalOpen, setIsMasakModalOpen] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const { handleCollapsed, collapsed } = useMenu();

  const isExpanded = collapsed === "expanded" || !collapsed;

  const toggleSidebar = () => {
    handleCollapsed(isExpanded ? "collapsed" : "expanded");
  };

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

  return (
    <Fragment>
      <header className="navbar-glass bg-white border-bottom sticky-top shadow-xs">
        <Container fluid className="px-2 px-lg-3 py-0.5">
          <div className="d-flex align-items-center justify-content-between w-100">
            {/* Left Area: Toggle & Title / Desktop Quick Actions */}
            <div className="d-flex align-items-center gap-1 gap-lg-2">
              <button
                type="button"
                className="btn btn-light border p-0 d-flex align-items-center justify-content-center rounded-2 sidebar-toggle-btn shadow-xs"
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

              {/* Mobile Brand Title */}
              <div className="d-inline-flex d-md-none align-items-center ms-1">
                <img
                  src="/images/logo/logo.svg"
                  alt="Likya Kuyum Logo"
                  className="flex-shrink-0 me-1.5"
                  style={{ width: "26px", height: "26px", objectFit: "contain" }}
                />
                <span className="fw-bold fs-6 text-nowrap">
                  <span className="brand-text-likya">{getAppBrand(user).prefix}</span>{" "}
                  <span className="brand-text-kuyum">{getAppBrand(user).suffix}</span>
                </span>
              </div>


              {/* Desktop Quick Actions (Icon + Text Label) */}
              <div className="d-none d-md-flex align-items-center gap-2 gap-lg-2.5 ms-2 border-start ps-3">
                {gorunenKisayollar.map((action, idx) => (
                  <Link
                    key={idx}
                    to={action.to}
                    onClick={(e) => {
                      e.preventDefault();
                      navigateWithDashboardHop(action.to);
                    }}
                    className="d-flex flex-column align-items-center justify-content-center text-decoration-none px-2 py-0.5 rounded-2 quick-action-btn"
                  >
                    <span className="d-flex align-items-center justify-content-center" style={{ marginBottom: "2px" }}>
                      {action.icon}
                    </span>
                    <span
                      style={{
                        fontSize: "11px",
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

                {/* MASAK Quick Action Dropdown (Beside E-Belge) */}
                {masakAcik && <MasakMenu onUpdate={() => setIsMasakModalOpen(true)} />}

                {/* Piyasa: herkese açık, modül kataloğunda yok (kapatılamaz) */}
                <Link
                  to="/piyasa"
                  onClick={(e) => {
                    e.preventDefault();
                    navigateWithDashboardHop("/piyasa");
                  }}
                  className="d-flex flex-column align-items-center justify-content-center text-decoration-none px-2 py-0.5 rounded-2 quick-action-btn"
                >
                  <span className="d-flex align-items-center justify-content-center" style={{ marginBottom: "2px" }}>
                    <IconChartCandle size={19} strokeWidth={2.2} style={{ color: "#b8860b" }} />
                  </span>
                  <span style={{ fontSize: "11px", fontWeight: 700, color: "#b8860b", lineHeight: 1, whiteSpace: "nowrap", letterSpacing: "-0.1px" }}>
                    Piyasa
                  </span>
                </Link>
              </div>
            </div>

            {/* Right Area: Action Icons (Theme Selector, Fullscreen, Notification, User Menu) */}
            <ListGroup
              bsPrefix="list-unstyled"
              as={"ul"}
              className="d-flex align-items-center mb-0 gap-1.5"
            >
              {/* Theme Quick Selector Dropdown & Modal */}
              <ListGroup.Item as="li" className="me-1">
                <HeaderThemeSelector />
              </ListGroup.Item>

              {/* Sayfa Yenileme Butonu */}
              <ListGroup.Item as="li">
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

              {/* Fullscreen Toggle Button */}
              <ListGroup.Item as="li">
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

              {/* Destek zili: sayaç, sağ panel, Talep Oluştur (docs/DESTEK_VE_BILDIRIM_YOL_HARITASI.md) */}
              <ListGroup.Item as="li">
                <DestekZil />
              </ListGroup.Item>

              {/* User Profile Menu */}
              <ListGroup.Item as="li">
                <UserMenu />
              </ListGroup.Item>
            </ListGroup>
          </div>

          {/* Mobile Quick Actions Sub-Bar (Horizontal Scrollable Strip) */}
          <div className="d-flex d-md-none align-items-center gap-2 pt-2 pb-1 border-top mt-1 header-quick-actions-mobile">
            {gorunenKisayollar.map((action, idx) => (
              <Link
                key={idx}
                to={action.to}
                onClick={(e) => {
                  e.preventDefault();
                  navigateWithDashboardHop(action.to);
                }}
                className="d-flex align-items-center gap-1 text-decoration-none px-2 py-1 rounded-pill bg-light border text-nowrap quick-action-mobile-pill"
              >
                <span>{action.icon}</span>
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 500,
                    color: "#000000",
                  }}
                >
                  {action.title}
                </span>
              </Link>
            ))}

            {masakAcik && <MasakMenu mobile onUpdate={() => setIsMasakModalOpen(true)} />}

            <Link
              to="/piyasa"
              onClick={(e) => {
                e.preventDefault();
                navigateWithDashboardHop("/piyasa");
              }}
              className="d-flex align-items-center gap-1 text-decoration-none px-2 py-1 rounded-pill bg-light border text-nowrap quick-action-mobile-pill"
            >
              <IconChartCandle size={16} strokeWidth={2} style={{ color: "#b8860b" }} />
              <span style={{ fontSize: "11px", fontWeight: 700, color: "#b8860b" }}>Piyasa</span>
            </Link>
          </div>
        </Container>
      </header>

      {/* MASAK Detailed Modal */}
      <MasakModal
        show={isMasakModalOpen}
        onHide={() => setIsMasakModalOpen(false)}
      />

    </Fragment>
  );
};

export default Header;
