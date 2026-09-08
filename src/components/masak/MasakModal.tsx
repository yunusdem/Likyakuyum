import React from "react";
import { Modal, Button, Badge } from "react-bootstrap";
import {
  IconShieldCheck,
  IconDownload,
  IconExternalLink,
  IconFileSpreadsheet,
  IconInfoCircle,
} from "@tabler/icons-react";
import { MASAK_LISTS } from "data/masakData";
import { useNavigate } from "react-router-dom";

interface MasakModalProps {
  show: boolean;
  onHide: () => void;
}

export const MasakModal: React.FC<MasakModalProps> = ({ show, onHide }) => {
  const navigate = useNavigate();

  const handleNavigateToPage = () => {
    onHide();
    navigate("/ayarlar/masak-dondurulanlar");
  };

  return (
    <Modal show={show} onHide={onHide} size="lg" centered>
      <Modal.Header closeButton className="border-bottom pb-3">
        <div className="d-flex align-items-center gap-2">
          <div
            className="d-flex align-items-center justify-content-center rounded-3 text-white flex-shrink-0"
            style={{
              width: "42px",
              height: "42px",
              background: "linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)",
              boxShadow: "0 4px 10px rgba(220, 38, 38, 0.25)",
            }}
          >
            <IconShieldCheck size={24} strokeWidth={2} />
          </div>
          <div>
            <div className="d-flex align-items-center gap-2">
              <h5 className="modal-title fw-bold mb-0 text-dark">
                MASAK Malvarlığı Dondurulanlar Listeleri
              </h5>
              <Badge bg="danger" className="text-uppercase" style={{ fontSize: "10px" }}>
                Resmi Kaynak
              </Badge>
            </div>
            <p className="text-muted small mb-0 mt-0.5">
              T.C. Hazine ve Maliye Bakanlığı güncel terörizmin ve kitle imha silahlarının finansmanını önleme listeleri
            </p>
          </div>
        </div>
      </Modal.Header>

      <Modal.Body className="p-3 p-md-4">
        {/* Warning / Info Alert */}
        <div
          className="p-3 rounded-3 mb-3 d-flex align-items-start gap-2 border"
          style={{ backgroundColor: "#fef2f2", borderColor: "#fecaca" }}
        >
          <IconInfoCircle size={20} className="text-danger flex-shrink-0 mt-0.5" />
          <div style={{ fontSize: "12px", color: "#991b1b", lineHeight: 1.45 }}>
            <strong>Yasal Bilgilendirme (5549, 6415 ve 7262 S.K.):</strong> Kuyumculuk ve kıymetli maden sektöründe faaliyet gösteren yükümlüler, alım-satım ve cari işlemlerinde malvarlığı dondurulan kişi ve kuruluş listelerini kontrol etmekle yasal olarak yükümlüdür.
          </div>
        </div>

        {/* List items */}
        <div className="d-flex flex-column gap-2.5">
          {MASAK_LISTS.map((item) => (
            <div
              key={item.key}
              className="p-3 rounded-3 border bg-white shadow-xs d-flex flex-column flex-md-row align-items-start align-items-md-center justify-content-between gap-3 transition-all"
              style={{
                borderLeft: `4px solid ${item.accentColor}`,
                transition: "transform 0.15s ease, box-shadow 0.15s ease",
              }}
            >
              <div className="d-flex align-items-start gap-2.5 flex-grow-1">
                <span
                  className="badge fw-bold px-2 py-1.5 rounded-2 flex-shrink-0"
                  style={{
                    backgroundColor: item.badgeBg,
                    color: item.badgeText,
                    fontSize: "12px",
                    minWidth: "48px",
                    textAlign: "center",
                  }}
                >
                  {item.code}
                </span>

                <div>
                  <div className="fw-semibold text-dark" style={{ fontSize: "13.5px" }}>
                    {item.title}
                  </div>
                  <div className="text-muted mt-0.5" style={{ fontSize: "11.5px" }}>
                    {item.description}
                  </div>
                  <div className="mt-1">
                    <span
                      className="badge bg-light text-secondary border px-1.5 py-0.5"
                      style={{ fontSize: "10.5px" }}
                    >
                      Mevzuat: {item.lawReference}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="d-flex align-items-center gap-2 flex-shrink-0 w-100 w-md-auto justify-content-end">
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  download={item.filename}
                  className="btn btn-sm d-flex align-items-center gap-1.5 px-3 py-1.5 rounded-2 text-white fw-medium shadow-xs"
                  style={{
                    backgroundColor: item.accentColor,
                    borderColor: item.accentColor,
                    fontSize: "12px",
                  }}
                  title="Resmi Excel Tablosunu İndir"
                >
                  <IconDownload size={15} strokeWidth={2} />
                  <span>Excel İndir (.xlsx)</span>
                </a>

                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-sm btn-outline-secondary d-flex align-items-center justify-content-center p-1.5 rounded-2"
                  title="Bağlantıyı Yeni Sekmede Aç"
                >
                  <IconExternalLink size={15} />
                </a>
              </div>
            </div>
          ))}
        </div>
      </Modal.Body>

      <Modal.Footer className="border-top d-flex justify-content-between">
        <Button
          variant="outline-primary"
          size="sm"
          onClick={handleNavigateToPage}
          className="d-flex align-items-center gap-1.5"
        >
          <IconFileSpreadsheet size={16} />
          <span>MASAK Sayfasına Git</span>
        </Button>

        <Button variant="secondary" size="sm" onClick={onHide}>
          Kapat
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default MasakModal;
