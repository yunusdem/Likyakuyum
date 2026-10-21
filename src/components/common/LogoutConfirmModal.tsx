import React from "react";
import { Modal, Button } from "react-bootstrap";
import { IconLogout } from "@tabler/icons-react";

interface LogoutConfirmModalProps {
  show: boolean;
  onHide: () => void;
  onConfirm: () => void | Promise<void>;
  isLoading?: boolean;
}

export const LogoutConfirmModal: React.FC<LogoutConfirmModalProps> = ({
  show,
  onHide,
  onConfirm,
  isLoading = false,
}) => {
  return (
    <Modal
      show={show}
      onHide={onHide}
      centered
      backdrop="static"
      keyboard={!isLoading}
      contentClassName="border-0 shadow-lg"
      style={{ zIndex: 1060 }}
    >
      <Modal.Body className="p-4 text-center">
        <div
          className="mx-auto mb-3 d-flex align-items-center justify-content-center rounded-circle"
          style={{
            width: "60px",
            height: "60px",
            backgroundColor: "#fee2e2",
            color: "#dc2626",
          }}
        >
          <IconLogout size={30} strokeWidth={2} />
        </div>
        <h5 className="fw-bold mb-2 text-dark">Çıkış Yapmak İstiyor musunuz?</h5>
        <p className="text-muted small mb-4">
          Oturumunuz sonlandırılacaktır. Devam etmek istediğinize emin misiniz?
        </p>
        <div className="d-flex justify-content-center gap-2">
          <Button
            variant="light"
            className="px-4 py-2 border text-secondary fw-semibold rounded-2"
            onClick={onHide}
            disabled={isLoading}
            style={{ minWidth: "100px" }}
          >
            Hayır
          </Button>
          <Button
            variant="danger"
            className="px-4 py-2 fw-semibold rounded-2 d-flex align-items-center justify-content-center gap-1 shadow-sm"
            onClick={onConfirm}
            disabled={isLoading}
            style={{ minWidth: "130px" }}
            autoFocus
          >
            <IconLogout size={16} />
            <span>{isLoading ? "Çıkılıyor..." : "Evet, Çıkış Yap"}</span>
          </Button>
        </div>
      </Modal.Body>
    </Modal>
  );
};

export default LogoutConfirmModal;
