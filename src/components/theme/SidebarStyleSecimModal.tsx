import React, { useState, useEffect } from "react";
import { Modal, Button, Row, Col, Badge } from "react-bootstrap";
import {
  IconLayoutSidebar,
  IconCheck,
  IconLayoutNavbar,
} from "@tabler/icons-react";
import { SIDEBAR_STYLES, SidebarStyleType, SidebarOrientation, isHeaderNavStyle } from "../../hooks/useSidebarStyle";
import { SidebarStylePreview } from "./SidebarStylePreview";

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
  const [orientationTab, setOrientationTab] = useState<SidebarOrientation>(() =>
    isHeaderNavStyle(currentId) ? "horizontal" : "vertical"
  );

  useEffect(() => {
    if (show) {
      setOrientationTab(isHeaderNavStyle(currentId) ? "horizontal" : "vertical");
    }
  }, [show, currentId]);

  const filteredStyles = SIDEBAR_STYLES.filter((s) => s.orientation === orientationTab);

  return (
    <Modal show={show} onHide={onClose} size="xl" centered backdrop="static" className="sidebar-style-modal">
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

        {/* Dikey Menü (Sidebar) / Yatay Menü (Header) Seçici */}
        <div className="d-flex align-items-center gap-2 mb-3 flex-wrap">
          <Button
            variant={orientationTab === "vertical" ? "primary" : "outline-secondary"}
            size="sm"
            className="fw-semibold px-3 py-1.5 d-flex align-items-center gap-2 rounded-3"
            onClick={() => setOrientationTab("vertical")}
          >
            <IconLayoutSidebar size={16} />
            <span>Dikey Menü (Sidebar)</span>
            <Badge bg={orientationTab === "vertical" ? "light" : "secondary"} text={orientationTab === "vertical" ? "primary" : "light"} pill>
              {SIDEBAR_STYLES.filter((s) => s.orientation === "vertical").length}
            </Badge>
          </Button>
          <Button
            variant={orientationTab === "horizontal" ? "primary" : "outline-secondary"}
            size="sm"
            className="fw-semibold px-3 py-1.5 d-flex align-items-center gap-2 rounded-3"
            onClick={() => setOrientationTab("horizontal")}
          >
            <IconLayoutNavbar size={16} />
            <span>Yatay Menü (Header)</span>
            <Badge bg={orientationTab === "horizontal" ? "light" : "secondary"} text={orientationTab === "horizontal" ? "primary" : "light"} pill>
              {SIDEBAR_STYLES.filter((s) => s.orientation === "horizontal").length}
            </Badge>
          </Button>
        </div>

        <Row className="g-3">
          {filteredStyles.map((styleItem, idx) => {
            const isSelected = currentId === styleItem.id;
            return (
              <Col key={styleItem.id} xs={12} md={6} lg={4}>
                <div
                  onClick={() => {
                    onSelect(styleItem.id);
                    onClose();
                  }}
                  className={`p-3 rounded-3 border h-100 position-relative style-card-item d-flex flex-column justify-content-between ${
                    isSelected
                      ? "border-primary bg-primary-subtle bg-opacity-25 shadow-sm"
                      : "border-light-subtle bg-white hover-shadow"
                  }`}
                  style={{
                    borderWidth: isSelected ? "2px" : "1px",
                  }}
                >
                  <div>
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
                      {idx + 1}. {styleItem.title}
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
                  </div>

                  {/* Mini Şematik Önizleme */}
                  <SidebarStylePreview styleId={styleItem.id} isSelected={isSelected} />
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
