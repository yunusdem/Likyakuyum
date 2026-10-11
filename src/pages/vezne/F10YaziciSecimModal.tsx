import React, { useEffect, useState, useRef, useMemo } from "react";
import { Modal, Button, Form, Badge } from "react-bootstrap";
import { IconPrinter, IconCheck, IconX, IconSettings } from "@tabler/icons-react";
import { YaziciItem } from "../../services/printerService";
import { UserProfileDto } from "../../services/userService";

export interface F10YaziciSecimModalProps {
  show: boolean;
  onHide: () => void;
  printers: YaziciItem[];
  user?: UserProfileDto | { printerId?: string } | null;
  defaultPrinterId?: number | null;
  onConfirm: (selectedPrinter: YaziciItem, copies: number) => void;
  isSaving?: boolean;
}

export const F10YaziciSecimModal: React.FC<F10YaziciSecimModalProps> = ({
  show,
  onHide,
  printers,
  user,
  defaultPrinterId,
  onConfirm,
  isSaving = false,
}) => {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [copies, setCopies] = useState<number>(1);
  const selectRef = useRef<HTMLSelectElement | null>(null);

  // Kullanıcı tanımlarındaki yazıcıyı eşleştir
  const userPrinter = useMemo(() => {
    const raw = String(user?.printerId || "").trim();
    if (!raw || !printers || printers.length === 0) return null;
    return (
      printers.find(
        (p) =>
          String(p.siraNo) === raw ||
          String(p.id) === raw ||
          (p.ad && p.ad.toLowerCase() === raw.toLowerCase())
      ) || null
    );
  }, [user?.printerId, printers]);

  // Modal açıldığında varsayılan olarak kullanıcı tanımlarındaki yazıcıyı seç
  useEffect(() => {
    if (!show) return;

    let targetPrinter: YaziciItem | null = null;
    if (userPrinter) {
      targetPrinter = userPrinter;
    } else if (defaultPrinterId) {
      targetPrinter = printers.find((p) => p.id === defaultPrinterId) || null;
    }

    if (!targetPrinter && printers.length > 0) {
      targetPrinter = printers.find((p) => p.siraNo === 1 || p.id === 1) || printers[0];
    }

    if (targetPrinter) {
      setSelectedId(targetPrinter.id);
      const initialCopies =
        targetPrinter.kopyaSayisi && Number(targetPrinter.kopyaSayisi) > 0
          ? Number(targetPrinter.kopyaSayisi)
          : 1;
      setCopies(initialCopies);
    }

    // Modal açılınca seçiciye odaklan
    setTimeout(() => {
      if (selectRef.current) {
        selectRef.current.focus();
      }
    }, 100);
  }, [show, userPrinter, defaultPrinterId, printers]);

  const activePrinter = useMemo(() => {
    if (!selectedId || !printers) return null;
    return printers.find((p) => p.id === selectedId) || null;
  }, [selectedId, printers]);

  const isUserPrinterSelected = useMemo(() => {
    if (!activePrinter || !userPrinter) return false;
    return activePrinter.id === userPrinter.id;
  }, [activePrinter, userPrinter]);

  const handleConfirm = () => {
    if (!activePrinter) return;
    onConfirm(activePrinter, copies);
  };

  // Keyboard navigation: Enter onayla, Escape kapat
  useEffect(() => {
    if (!show) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        handleConfirm();
      } else if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onHide();
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [show, activePrinter, copies, onConfirm, onHide]);

  return (
    <Modal
      show={show}
      onHide={onHide}
      size="sm"
      centered
      backdrop="static"
      keyboard={false}
      style={{ zIndex: 1060 }}
    >
      <Modal.Header closeButton className="py-2 px-3 bg-light border-bottom">
        <Modal.Title className="fs-6 fw-bold d-flex align-items-center gap-2 mb-0">
          <IconPrinter size={18} className="text-primary" />
          <span>Doğrudan Yazdırma (F10)</span>
        </Modal.Title>
      </Modal.Header>

      <Modal.Body className="p-3">
        <Form.Group className="mb-3">
          <div className="d-flex align-items-center justify-content-between mb-1.5">
            <Form.Label className="small fw-bold text-secondary mb-0">
              Yazıcı Seçimi:
            </Form.Label>
            {isUserPrinterSelected && (
              <Badge bg="success" className="d-flex align-items-center gap-1 py-1 px-1.5 fw-normal" style={{ fontSize: "11px" }}>
                <IconCheck size={12} />
                Kullanıcı Tanımı
              </Badge>
            )}
          </div>

          <Form.Select
            ref={selectRef}
            size="sm"
            className="fw-semibold text-dark shadow-sm"
            style={{ fontSize: "13px", height: "36px" }}
            value={selectedId || ""}
            onChange={(e) => {
              const val = e.target.value ? Number(e.target.value) : null;
              setSelectedId(val);
              if (val) {
                const found = printers.find((p) => p.id === val);
                if (found && found.kopyaSayisi && Number(found.kopyaSayisi) > 0) {
                  setCopies(Number(found.kopyaSayisi));
                }
              }
            }}
          >
            {printers.length === 0 ? (
              <option value="">Tanımlı yazıcı bulunamadı</option>
            ) : (
              printers.map((p) => {
                const isUserPref = userPrinter && (p.id === userPrinter.id || p.siraNo === userPrinter.siraNo);
                return (
                  <option key={p.id} value={p.id}>
                    {p.siraNo ? `#${p.siraNo} - ` : ""}{p.ad || "Yazıcı"} {isUserPref ? "(Kullanıcı)" : ""}
                  </option>
                );
              })
            )}
          </Form.Select>
        </Form.Group>

        {activePrinter && (
          <div className="p-2 mb-3 rounded bg-light border text-muted small" style={{ fontSize: "11.5px" }}>
            <div className="d-flex align-items-center justify-content-between mb-1">
              <span>Bağlantı Türü / Cihaz:</span>
              <strong className="text-dark font-monospace">{activePrinter.cihazAdi || activePrinter.baglantiNoktasi || "Varsayılan Port"}</strong>
            </div>
            <div className="d-flex align-items-center justify-content-between">
              <span>Baskı Modu:</span>
              <Badge bg={activePrinter.belgeYaziciModu === 0 ? "secondary" : "info"} className="text-uppercase" style={{ fontSize: "10px" }}>
                {activePrinter.belgeYaziciModu === 0 ? "A4 Sürücüsü" : "Termal POS Fiş"}
              </Badge>
            </div>
          </div>
        )}

        <Form.Group className="mb-2">
          <div className="d-flex align-items-center justify-content-between">
            <Form.Label className="small fw-semibold text-secondary mb-0">
              Kopya Sayısı:
            </Form.Label>
            <Form.Control
              type="number"
              size="sm"
              min={1}
              max={10}
              className="text-center font-monospace fw-bold"
              style={{ width: "70px", height: "30px", fontSize: "13px" }}
              value={copies}
              onChange={(e) => setCopies(Math.max(1, parseInt(e.target.value, 10) || 1))}
            />
          </div>
        </Form.Group>

        <div className="text-center mt-3 pt-2 border-top text-secondary small" style={{ fontSize: "11px" }}>
          <span><kbd className="bg-light text-dark border">Enter</kbd> Yazdır & Kaydet</span>
          <span className="mx-2">•</span>
          <span><kbd className="bg-light text-dark border">ESC</kbd> İptal</span>
        </div>
      </Modal.Body>

      <Modal.Footer className="py-2 px-3 bg-light border-top d-flex justify-content-between">
        <Button
          variant="outline-secondary"
          size="sm"
          onClick={onHide}
          disabled={isSaving}
          className="d-flex align-items-center gap-1 px-3"
          style={{ fontSize: "12px" }}
        >
          <IconX size={15} />
          <span>İptal (ESC)</span>
        </Button>

        <Button
          variant="primary"
          size="sm"
          onClick={handleConfirm}
          disabled={!activePrinter || isSaving}
          className="d-flex align-items-center gap-1 px-3 fw-bold"
          style={{ fontSize: "12px" }}
        >
          <IconCheck size={16} />
          <span>{isSaving ? "Kaydediliyor..." : "Yazdır ve Kaydet"}</span>
        </Button>
      </Modal.Footer>
    </Modal>
  );
};
