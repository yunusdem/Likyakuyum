import React, { useState, useEffect, useRef, useCallback } from "react";
import { Modal, Form, Button } from "react-bootstrap";
import { IconCash, IconX, IconCheck, IconRotate } from "@tabler/icons-react";
import { parseDecimal, formatTutar } from "../../utils/numericInput";

export interface ParaUstuApplyPayload {
  alinanPara: number;
  paraUstu: number;
}

interface ParaUstuModalProps {
  show: boolean;
  onClose: () => void;
  fisToplamTutar: number;
  initialAlinanPara?: number;
  initialParaUstu?: number;
  tlKurusSayisi?: number;
  onApply: (data: ParaUstuApplyPayload) => void;
}

export const ParaUstuModal: React.FC<ParaUstuModalProps> = ({
  show,
  onClose,
  fisToplamTutar,
  initialAlinanPara = 0,
  initialParaUstu = 0,
  tlKurusSayisi = 2,
  onApply,
}) => {
  const [alinanParaStr, setAlinanParaStr] = useState<string>("");
  const alinanInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!show) return;
    if (initialAlinanPara > 0) {
      setAlinanParaStr(formatTutar(initialAlinanPara, tlKurusSayisi));
    } else if (initialParaUstu > 0 && fisToplamTutar > 0) {
      setAlinanParaStr(formatTutar(fisToplamTutar + initialParaUstu, tlKurusSayisi));
    } else {
      setAlinanParaStr("");
    }
    setTimeout(() => {
      alinanInputRef.current?.focus();
      alinanInputRef.current?.select();
    }, 80);
  }, [show, initialAlinanPara, initialParaUstu, fisToplamTutar, tlKurusSayisi]);

  const alinanNum = Math.max(0, parseDecimal(alinanParaStr));
  const toplamNum = Math.max(0, Number(fisToplamTutar) || 0);
  const paraUstuNum = alinanNum > toplamNum ? Math.round((alinanNum - toplamNum) * 100) / 100 : 0;
  const eksikNum = alinanNum > 0 && alinanNum < toplamNum ? Math.round((toplamNum - alinanNum) * 100) / 100 : 0;

  const handleKaydet = useCallback(() => {
    onApply({
      alinanPara: alinanNum,
      paraUstu: paraUstuNum,
    });
    onClose();
  }, [alinanNum, paraUstuNum, onApply, onClose]);

  const handleTemizle = useCallback(() => {
    setAlinanParaStr("");
    onApply({ alinanPara: 0, paraUstu: 0 });
    onClose();
  }, [onApply, onClose]);

  useEffect(() => {
    if (!show) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      } else if (e.key === "F1" || e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        handleKaydet();
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [show, onClose, handleKaydet]);

  return (
    <Modal show={show} onHide={onClose} centered backdrop="static" size="sm" style={{ zIndex: 1065 }}>
      <Modal.Header closeButton className="py-2 px-3 bg-light">
        <Modal.Title className="fs-6 fw-bold d-flex align-items-center gap-2 mb-0">
          <IconCash size={18} className="text-success" />
          <span>Para Üstü Hesabı (F12)</span>
        </Modal.Title>
      </Modal.Header>
      <Modal.Body className="p-3">
        <div className="mb-2">
          <Form.Label className="small fw-semibold text-secondary mb-1">Fiş Toplam Tutarı (TL)</Form.Label>
          <Form.Control
            size="sm"
            type="text"
            readOnly
            value={formatTutar(toplamNum, tlKurusSayisi)}
            className="text-end fw-bold bg-light font-monospace"
          />
        </div>

        <div className="mb-2">
          <Form.Label className="small fw-semibold text-primary mb-1">Alınan Para (TL)</Form.Label>
          <Form.Control
            ref={alinanInputRef}
            size="sm"
            type="text"
            inputMode="decimal"
            placeholder="0,00"
            value={alinanParaStr}
            onChange={(e) => setAlinanParaStr(e.target.value)}
            className="text-end fw-bold font-monospace border-primary"
            style={{ fontSize: "15px" }}
          />
        </div>

        <div className="p-2 rounded border bg-light mt-3">
          <div className="d-flex justify-content-between align-items-center">
            <span className="small fw-bold text-secondary">Para Üstü (TL):</span>
            <span className={`fs-5 fw-bold font-monospace ${paraUstuNum > 0 ? "text-success" : "text-dark"}`}>
              {formatTutar(paraUstuNum, tlKurusSayisi)} TL
            </span>
          </div>
          {eksikNum > 0 && (
            <div className="d-flex justify-content-between align-items-center mt-1 text-danger small fw-semibold">
              <span>Eksik Tutar:</span>
              <span className="font-monospace">{formatTutar(eksikNum, tlKurusSayisi)} TL</span>
            </div>
          )}
        </div>
      </Modal.Body>
      <Modal.Footer className="py-2 px-3 bg-light d-flex justify-content-between">
        <Button size="sm" variant="outline-secondary" onClick={handleTemizle} className="d-inline-flex align-items-center gap-1">
          <IconRotate size={14} /> Sıfırla
        </Button>
        <div className="d-flex gap-2">
          <Button size="sm" variant="secondary" onClick={onClose} className="d-inline-flex align-items-center gap-1">
            <IconX size={14} /> İptal
          </Button>
          <Button size="sm" variant="success" onClick={handleKaydet} className="d-inline-flex align-items-center gap-1 fw-bold">
            <IconCheck size={14} /> Kaydet (Enter)
          </Button>
        </div>
      </Modal.Footer>
    </Modal>
  );
};
