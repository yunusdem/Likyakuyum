import React, { Fragment, useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  IconArrowBarLeft,
  IconArrowBarRight,
  IconBell,
  IconMaximize,
  IconMinimize,
  IconChartLine,
  IconScan,
  IconDiamond,
  IconReceipt2,
  IconShoppingCart,
  IconBuildingBank,
  IconUserPlus,
  IconFileCertificate,
} from "@tabler/icons-react";
import { Container, ListGroup, Navbar, Button } from "react-bootstrap";

//import custom components
import UserMenu from "./UserMenu";
import Flex from "components/common/Flex";
import NoficationList from "components/common/NoficationList";

//import custom hooks
import useMenu from "hooks/useMenu";

const quickActions = [
  {
    title: "Kur",
    to: "/kur/anlik-fiyat-listesi",
    icon: <IconChartLine size={19} strokeWidth={2} className="text-primary" />,
  },
  {
    title: "Fiyat Gör",
    to: "/vezne/fiyat-kontrolu",
    icon: <IconScan size={19} strokeWidth={2} className="text-success" />,
  },
  {
    title: "Sarraf Fişi",
    to: "/vezne/genel-sarraf-fisi",
    icon: <IconDiamond size={19} strokeWidth={2} className="text-warning" />,
  },
  {
    title: "Döviz Fişi",
    to: "/vezne/doviz-fisi",
    icon: <IconReceipt2 size={19} strokeWidth={2} className="text-info" />,
  },
  {
    title: "Parekende Fişi",
    to: "/vezne/perakende-fisi",
    icon: <IconShoppingCart size={19} strokeWidth={2} className="text-danger" />,
  },
  {
    title: "Banka",
    to: "/banka/hesap-kartlari",
    icon: <IconBuildingBank size={19} strokeWidth={2} className="text-secondary" />,
  },
  {
    title: "Cari Kayıt",
    to: "/cari/kart-kayit",
    icon: <IconUserPlus size={19} strokeWidth={2} className="text-purple" style={{ color: "#7c3aed" }} />,
  },
  {
    title: "E- Belge",
    to: "/e-belge",
    icon: <IconFileCertificate size={19} strokeWidth={2} className="text-primary" />,
  },
];


const Header: React.FC = () => {
  const [isNoficationOpen, setIsNotificationOpen] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const { handleCollapsed, collapsed } = useMenu();

  const isExpanded = collapsed === "expanded" || !collapsed;

  const toggleSidebar = () => {
    handleCollapsed(isExpanded ? "collapsed" : "expanded");
  };

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
        <Container fluid className="px-2 px-lg-4 py-1">
          <div className="d-flex align-items-center justify-content-between w-100">
            {/* Left Area: Toggle & Title / Desktop Quick Actions */}
            <div className="d-flex align-items-center gap-2">
              <button
                type="button"
                className="btn btn-light border p-2 d-flex align-items-center justify-content-center rounded-2 sidebar-toggle-btn shadow-xs"
                onClick={toggleSidebar}
                title={isExpanded ? "Menüyü Daralt / Kapat" : "Menüyü Genişlet / Aç"}
                style={{ width: "38px", height: "38px" }}
              >
                {isExpanded ? (
                  <IconArrowBarLeft
                    size={20}
                    strokeWidth={2}
                    className="text-dark"
                  />
                ) : (
                  <IconArrowBarRight
                    size={20}
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
                  className="flex-shrink-0 me-2"
                  style={{ width: "32px", height: "32px", objectFit: "contain" }}
                />
                <span className="fw-bold fs-6 text-nowrap">
                  <span className="brand-text-likya">Likya</span>{" "}
                  <span className="brand-text-kuyum">Kuyum</span>
                </span>
              </div>


              {/* Desktop Quick Actions (Icon + Text Label) */}
              <div className="d-none d-md-flex align-items-center gap-1 gap-lg-2 ms-2 border-start ps-3">
                {quickActions.map((action, idx) => (
                  <Link
                    key={idx}
                    to={action.to}
                    className="d-flex flex-column align-items-center justify-content-center text-decoration-none px-2 py-1 rounded-2 quick-action-btn"
                  >
                    <span className="d-flex align-items-center justify-content-center mb-1">
                      {action.icon}
                    </span>
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: 600,
                        color: "#64748b",
                        lineHeight: 1,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {action.title}
                    </span>
                  </Link>
                ))}
              </div>
            </div>

            {/* Right Area: Action Icons (Fullscreen, Notification, User Menu) */}
            <ListGroup
              bsPrefix="list-unstyled"
              as={"ul"}
              className="d-flex align-items-center mb-0 gap-1 gap-md-2"
            >
              {/* Fullscreen Toggle Button */}
              <ListGroup.Item as="li">
                <Button
                  variant="ghost"
                  className="btn-icon rounded-circle d-flex align-items-center justify-content-center text-secondary p-2"
                  onClick={toggleFullscreen}
                  title={isFullscreen ? "Tam Ekrandan Çık" : "Tam Ekran Yap"}
                >
                  {isFullscreen ? (
                    <IconMinimize size={20} strokeWidth={1.75} />
                  ) : (
                    <IconMaximize size={20} strokeWidth={1.75} />
                  )}
                </Button>
              </ListGroup.Item>

              {/* Notification Bell */}
              <ListGroup.Item as="li">
                <Button
                  variant="ghost"
                  className="position-relative btn-icon rounded-circle text-secondary p-2"
                  onClick={() => setIsNotificationOpen(true)}
                  title="Bildirimler"
                >
                  <IconBell size={20} />
                  <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger mt-2 ms-n2" style={{ fontSize: "9px" }}>
                    2<span className="visually-hidden">okunmamış bildirim</span>
                  </span>
                </Button>
              </ListGroup.Item>

              {/* User Profile Menu */}
              <ListGroup.Item as="li">
                <UserMenu />
              </ListGroup.Item>
            </ListGroup>
          </div>

          {/* Mobile Quick Actions Sub-Bar (Horizontal Scrollable Strip) */}
          <div className="d-flex d-md-none align-items-center gap-2 pt-2 pb-1 border-top mt-1 header-quick-actions-mobile">
            {quickActions.map((action, idx) => (
              <Link
                key={idx}
                to={action.to}
                className="d-flex align-items-center gap-1 text-decoration-none px-2 py-1 rounded-pill bg-light border text-nowrap quick-action-mobile-pill"
              >
                <span>{action.icon}</span>
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 600,
                    color: "#475569",
                  }}
                >
                  {action.title}
                </span>
              </Link>
            ))}
          </div>
        </Container>
      </header>



      <NoficationList
        isOpen={isNoficationOpen}
        onClose={() => setIsNotificationOpen(false)}
      />
    </Fragment>
  );
};

export default Header;
