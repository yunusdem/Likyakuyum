import React from "react";
import { Modal, Button, Row, Col, Badge } from "react-bootstrap";
import {
  IconLayoutSidebar,
  IconCheck,
  IconX,
  IconLayoutNavbar,
  IconLayoutColumns,
  IconLayoutGrid,
} from "@tabler/icons-react";
import { SIDEBAR_STYLES, SidebarStyleType } from "../../hooks/useSidebarStyle";

interface SidebarStyleSecimModalProps {
  show: boolean;
  onClose: () => void;
  selectedStyle: SidebarStyleType;
  onSelect: (style: SidebarStyleType) => void;
}

export const SidebarStyleSecimModal: React.FC<SidebarStyleSecimModalProps> = ({
  show,
  onClose,
  selectedStyle,
  onSelect,
}) => {
  const currentId = selectedStyle === "drawer" ? "megamenu" : selectedStyle;

  return (
    <Modal show={show} onHide={onClose} size="lg" centered backdrop="static" className="sidebar-style-modal">
      <Modal.Header closeButton className="bg-light py-2.5 px-3 border-bottom">
        <div className="d-flex align-items-center gap-2">
          <div
            className="d-flex align-items-center justify-content-center rounded-2 bg-primary text-white shadow-xs"
            style={{ width: "32px", height: "32px" }}
          >
            <IconLayoutSidebar size={20} strokeWidth={2} />
          </div>
          <div>
            <Modal.Title className="fs-6 fw-bold mb-0 text-dark">
              Sidebar &amp; Menü Yerleşim Düzeni Seçimi
            </Modal.Title>
            <small className="text-muted" style={{ fontSize: "12px" }}>
              Kullanım alışkanlığınıza en uygun menü yerleşim düzenini belirleyin
            </small>
          </div>
        </div>
      </Modal.Header>

      <Modal.Body className="p-3">
        <style>{`
          .style-card-item {
            transition: all 0.18s ease-in-out;
            cursor: pointer;
          }
          .style-card-item:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 18px rgba(0, 0, 0, 0.08) !important;
          }
        `}</style>

        <Row className="g-3">
          {SIDEBAR_STYLES.map((styleItem) => {
            const isSelected = currentId === styleItem.id;
            return (
              <Col key={styleItem.id} xs={12} md={6}>
                <div
                  onClick={() => {
                    onSelect(styleItem.id);
                    onClose();
                  }}
                  className={`p-3 rounded-3 border h-100 position-relative style-card-item ${
                    isSelected
                      ? "border-primary bg-primary-subtle bg-opacity-25 shadow-sm"
                      : "border-light-subtle bg-white hover-shadow"
                  }`}
                  style={{
                    borderWidth: isSelected ? "2px" : "1px",
                  }}
                >
                  <div className="d-flex align-items-center justify-content-between mb-2">
                    <span
                      className={`badge ${
                        isSelected ? "bg-primary text-white" : "bg-secondary-subtle text-secondary"
                      } rounded-pill px-2 py-0.5 small`}
                    >
                      {styleItem.badge}
                    </span>
                    {isSelected ? (
                      <span
                        className="d-inline-flex align-items-center justify-content-center rounded-circle bg-primary text-white shadow-xs"
                        style={{ width: "22px", height: "22px" }}
                      >
                        <IconCheck size={14} strokeWidth={3} />
                      </span>
                    ) : (
                      <Button
                        variant="outline-primary"
                        size="sm"
                        className="py-0 px-2 fw-semibold"
                        style={{ fontSize: "11px" }}
                      >
                        Seç
                      </Button>
                    )}
                  </div>

                  <h6 className={`mb-1 fw-bold ${isSelected ? "text-primary" : "text-dark"}`}>
                    {styleItem.title}
                  </h6>
                  <div className="text-secondary small fw-medium mb-1.5" style={{ fontSize: "12px" }}>
                    {styleItem.subtitle}
                  </div>
                  <p
                    className="text-muted small mb-2.5"
                    style={{ lineHeight: "1.35", fontSize: "0.8rem", minHeight: "36px" }}
                  >
                    {styleItem.description}
                  </p>

                  {/* Mini Şematik Önizleme */}
                  <div
                    className="rounded-2 p-1.5 border bg-white d-flex overflow-hidden"
                    style={{ height: "42px", borderColor: isSelected ? "#93c5fd" : "#e2e8f0" }}
                  >
                    {styleItem.id === "hover" && (
                      <div className="d-flex w-100 gap-1">
                        <div className="rounded-1 bg-primary" style={{ width: "14px", height: "100%" }} />
                        <div
                          className="flex-grow-1 rounded-1 bg-light border border-dashed d-flex align-items-center justify-content-center text-muted"
                          style={{ fontSize: "0.68rem" }}
                        >
                          Sayfa Alanı (Fare ile Genişler)
                        </div>
                      </div>
                    )}
                    {styleItem.id === "classic" && (
                      <div className="d-flex w-100 gap-1">
                        <div className="rounded-1 bg-primary" style={{ width: "32px", height: "100%" }} />
                        <div
                          className="flex-grow-1 rounded-1 bg-light border border-dashed d-flex align-items-center justify-content-center text-muted"
                          style={{ fontSize: "0.68rem" }}
                        >
                          Sayfa Alanı (Sabit Dikey Menü)
                        </div>
                      </div>
                    )}
                    {styleItem.id === "flyout" && (
                      <div className="d-flex w-100 gap-1 position-relative">
                        <div className="rounded-1 bg-primary" style={{ width: "26px", height: "100%" }} />
                        <div
                          className="rounded-1 border border-warning shadow-xs bg-white px-1 d-flex align-items-center text-warning-emphasis"
                          style={{ width: "45px", height: "90%", fontSize: "0.62rem", fontWeight: "bold" }}
                        >
                          Kart &gt;
                        </div>
                        <div
                          className="flex-grow-1 rounded-1 bg-light border border-dashed d-flex align-items-center justify-content-center text-muted"
                          style={{ fontSize: "0.68rem" }}
                        >
                          Sayfa
                        </div>
                      </div>
                    )}
                    {styleItem.id === "topbar" && (
                      <div className="d-flex flex-column w-100 gap-1">
                        <div className="d-flex w-100 gap-1" style={{ height: "12px" }}>
                          <div className="rounded-1 bg-success" style={{ width: "24px", height: "100%" }} />
                          <div className="rounded-1 bg-primary flex-grow-1" style={{ height: "100%" }} />
                        </div>
                        <div
                          className="flex-grow-1 rounded-1 bg-light border border-dashed d-flex align-items-center justify-content-center text-muted"
                          style={{ fontSize: "0.68rem" }}
                        >
                          Tam Genişlik Sayfa (En Üstte Sabit Menü)
                        </div>
                      </div>
                    )}
                    {styleItem.id === "dual" && (
                      <div className="d-flex w-100 gap-1">
                        <div className="rounded-1 bg-success" style={{ width: "12px", height: "100%" }} />
                        <div className="rounded-1 bg-primary-subtle border" style={{ width: "24px", height: "100%" }} />
                        <div
                          className="flex-grow-1 rounded-1 bg-light border border-dashed d-flex align-items-center justify-content-center text-muted"
                          style={{ fontSize: "0.68rem" }}
                        >
                          Sayfa Alanı
                        </div>
                      </div>
                    )}
                    {(styleItem.id === "megamenu" || styleItem.id === "drawer") && (
                      <div className="d-flex flex-column w-100 gap-1">
                        <div className="d-flex w-100 gap-1" style={{ height: "12px" }}>
                          <div className="rounded-1 bg-success" style={{ width: "24px", height: "100%" }} />
                          <div className="rounded-1 bg-info flex-grow-1" style={{ height: "100%" }} />
                        </div>
                        <div
                          className="flex-grow-1 rounded-1 bg-light border border-dashed d-flex align-items-center justify-content-center text-primary fw-medium"
                          style={{ fontSize: "0.68rem" }}
                        >
                          Çok Sütunlu Mega Panel
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </Col>
            );
          })}
        </Row>
      </Modal.Body>

      <Modal.Footer className="bg-light py-2 px-3 border-top d-flex justify-content-between">
        <small className="text-muted" style={{ fontSize: "12px" }}>
          💡 Seçtiğiniz düzen anında canlı olarak uygulanır.
        </small>
        <Button variant="secondary" size="sm" onClick={onClose} className="px-3">
          Kapat
        </Button>
      </Modal.Footer>
    </Modal>
  );
};
