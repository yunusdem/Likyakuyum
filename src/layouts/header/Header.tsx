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
  IconArrowsExchange,
  IconFileCertificate,
  IconShieldCheck,
  IconDownload,
} from "@tabler/icons-react";
import { Container, ListGroup, Button, Dropdown, Badge } from "react-bootstrap";

//import custom components
import UserMenu from "./UserMenu";
import NoficationList from "components/common/NoficationList";
import MasakModal from "components/masak/MasakModal";
import { MASAK_LISTS } from "data/masakData";

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
    title: "Cari Hareket Kayıt",
    to: "/cari/hareket-kayit",
    icon: <IconArrowsExchange size={19} strokeWidth={2} className="text-purple" style={{ color: "#7c3aed" }} />,
  },
  {
    title: "E- Belge",
    to: "/e-belge",
    icon: <IconFileCertificate size={19} strokeWidth={2} className="text-primary" />,
  },
];


const Header: React.FC = () => {
  const [isNoficationOpen, setIsNotificationOpen] = useState<boolean>(false);
  const [isMasakModalOpen, setIsMasakModalOpen] = useState<boolean>(false);
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

                {/* MASAK Quick Action Dropdown (Beside E-Belge) */}
                <Dropdown align="end" className="d-inline-flex">
                  <Dropdown.Toggle
                    as="div"
                    className="d-flex flex-column align-items-center justify-content-center text-decoration-none px-2 py-1 rounded-2 quick-action-btn"
                    style={{ cursor: "pointer" }}
                    id="dropdown-masak-quick"
                  >
                    <span className="d-flex align-items-center justify-content-center mb-1 position-relative">
                      <IconShieldCheck size={19} strokeWidth={2} style={{ color: "#dc2626" }} />
                    </span>
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: 700,
                        color: "#dc2626",
                        lineHeight: 1,
                        whiteSpace: "nowrap",
                      }}
                    >
                      MASAK
                    </span>
                  </Dropdown.Toggle>

                  <Dropdown.Menu
                    className="shadow-lg border-0 py-2"
                    style={{
                      minWidth: "380px",
                      maxWidth: "420px",
                      borderRadius: "10px",
                      zIndex: 1060,
                    }}
                  >
                    <div className="px-3 py-2 border-bottom d-flex align-items-center justify-content-between">
                      <div>
                        <div className="fw-bold text-dark d-flex align-items-center gap-1.5" style={{ fontSize: "13px" }}>
                          <IconShieldCheck size={17} className="text-danger" />
                          MASAK Malvarlığı Dondurulanlar
                        </div>
                        <div className="text-muted" style={{ fontSize: "11px" }}>
                          T.C. Hazine ve Maliye Bakanlığı Resmi Listeleri
                        </div>
                      </div>
                      <Badge bg="danger" style={{ fontSize: "10px" }}>Resmi Liste</Badge>
                    </div>

                    <div className="py-1">
                      {MASAK_LISTS.map((item) => (
                        <a
                          key={item.key}
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          download={item.filename}
                          className="dropdown-item px-3 py-2 d-flex align-items-center justify-content-between text-wrap"
                          style={{ whiteSpace: "normal" }}
                        >
                          <div className="d-flex align-items-center gap-2 me-2">
                            <span
                              className="badge px-1.5 py-1 rounded"
                              style={{
                                backgroundColor: item.badgeBg,
                                color: item.badgeText,
                                fontSize: "11px",
                                minWidth: "32px",
                                textAlign: "center",
                              }}
                            >
                              {item.code}
                            </span>
                            <div>
                              <div className="fw-semibold text-dark" style={{ fontSize: "12px", lineHeight: 1.3 }}>
                                {item.shortTitle}
                              </div>
                              <div className="text-muted" style={{ fontSize: "10.5px" }}>
                                {item.lawReference}
                              </div>
                            </div>
                          </div>
                          <span
                            className="btn btn-sm btn-outline-danger p-1 rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
                            style={{ width: "26px", height: "26px" }}
                            title="Excel İndir (.xlsx)"
                          >
                            <IconDownload size={13} />
                          </span>
                        </a>
                      ))}
                    </div>

                    <div className="px-3 pt-2 pb-1 border-top mt-1 d-flex align-items-center justify-content-between">
                      <Link
                        to="/ayarlar/masak-dondurulanlar"
                        className="text-primary text-decoration-none fw-semibold small d-flex align-items-center gap-1"
                      >
                        <span>Tüm Listeleri & Mevzuatı Aç</span>
                      </Link>
                      <button
                        type="button"
                        className="btn btn-sm btn-link text-secondary text-decoration-none p-0 small"
                        onClick={() => setIsMasakModalOpen(true)}
                      >
                        Detaylı İncele
                      </button>
                    </div>
                  </Dropdown.Menu>
                </Dropdown>
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

            {/* Mobile MASAK Button */}
            <button
              type="button"
              onClick={() => setIsMasakModalOpen(true)}
              className="d-flex align-items-center gap-1 text-decoration-none px-2 py-1 rounded-pill bg-light border text-nowrap quick-action-mobile-pill btn p-0"
            >
              <IconShieldCheck size={16} strokeWidth={2} style={{ color: "#dc2626" }} />
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  color: "#dc2626",
                }}
              >
                MASAK
              </span>
            </button>
          </div>
        </Container>
      </header>

      {/* MASAK Detailed Modal */}
      <MasakModal
        show={isMasakModalOpen}
        onHide={() => setIsMasakModalOpen(false)}
      />

      <NoficationList
        isOpen={isNoficationOpen}
        onClose={() => setIsNotificationOpen(false)}
      />
    </Fragment>
  );
};

export default Header;
