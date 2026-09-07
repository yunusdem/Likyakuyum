import React from "react";
import { Modal, Button } from "react-bootstrap";
import { IconShieldLock, IconArrowRight, IconClockExclamation } from "@tabler/icons-react";

interface SessionExpiredModalProps {
  show: boolean;
  onConfirm: () => void;
}

export const SessionExpiredModal: React.FC<SessionExpiredModalProps> = ({ show, onConfirm }) => {
  return (
    <Modal
      show={show}
      onHide={() => {}}
      backdrop="static"
      keyboard={false}
      centered
      className="session-expired-modal"
    >
      <Modal.Body className="p-4 text-center">
        {/* Animated Warning Icon Circle */}
        <div
          className="mx-auto mb-3 d-flex align-items-center justify-content-center rounded-circle"
          style={{
            width: "72px",
            height: "72px",
            backgroundColor: "#fff7ed",
            border: "2px solid #fed7aa",
            color: "#ea580c",
          }}
        >
          <IconClockExclamation size={38} stroke={2} />
        </div>

        {/* Modal Title */}
        <h4 className="fw-bold text-dark mb-2">Oturum Süreniz Doldu</h4>

        {/* Informative Explanation */}
        <p className="text-secondary small mb-4 px-2" style={{ lineHeight: "1.6" }}>
          Güvenliğiniz amacıyla oturum süreniz sona ermiştir veya oturum anahtarınız (token) silinmiştir.
          Uygulamayı kullanmaya devam etmek için lütfen yeniden giriş yapınız.
        </p>

        {/* Confirm Action Button */}
        <div className="d-grid gap-2">
          <Button
            variant="primary"
            size="lg"
            onClick={onConfirm}
            className="fw-semibold py-2.5 d-flex align-items-center justify-content-center gap-2 shadow-sm"
            style={{
              background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
              border: "none",
            }}
          >
            <span>Tamam, Giriş Yap</span>
            <IconArrowRight size={18} />
          </Button>
        </div>
      </Modal.Body>
    </Modal>
  );
};

export default SessionExpiredModal;
