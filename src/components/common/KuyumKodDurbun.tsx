import React, { useState, useEffect, useRef } from "react";
import { Button, Form, InputGroup, Modal, Table } from "react-bootstrap";
import { IconBinoculars, IconSearch } from "@tabler/icons-react";
import { KUYUM_KODLARI, kuyumKoduBul } from "../../../Backend/src/services/kuyumKodlari";

/**
 * Kuyumculukla ilgili GİB KDV kodu (805, 808, 230 …) kutusu + dürbünü — docs/EBANKA_FATURALANDIRMA_YOL_HARITASI.md EF29–EF34.
 * Sarraf fişi, Hızlı Satış ve e-Banka "Belge kes" aynı listeyi kullanır. Kod elle de yazılabilir; F3 dürbünü açar.
 */
export const KuyumKodDurbun: React.FC<{
  value: string;
  onChange: (kod: string) => void;
  disabled?: boolean;
  isInvalid?: boolean;
  width?: number;
  inputRef?: React.Ref<HTMLInputElement>;
  onKeyDown?: (e: React.KeyboardEvent<any>) => void;
  onAdvance?: () => void;
}> = ({ value, onChange, disabled, isInvalid, width = 58, inputRef, onKeyDown, onAdvance }) => {
  const [acik, setAcik] = useState(false);
  const [modalArama, setModalArama] = useState("");
  const [seciliIndex, setSeciliIndex] = useState(0);
  const modalInputRef = useRef<HTMLInputElement | null>(null);
  const pendingAdvanceRef = useRef(false);

  const secili = kuyumKoduBul(value);
  const baslik = secili ? `${secili.kod} — ${secili.ad}` : value ? "Kuyumculuk kodlarında yok" : "Kod seçin (F3)";

  const filtrele = (arama: string) => {
    const t = arama.trim().toLowerCase();
    if (!t) return KUYUM_KODLARI;
    return KUYUM_KODLARI.filter(
      (k) =>
        k.kod.toLowerCase().includes(t) ||
        k.ad.toLowerCase().includes(t) ||
        (k.tur === "OZELMATRAH" ? "özel matrah" : "istisna").includes(t)
    );
  };

  const modalListesi = filtrele(modalArama);

  useEffect(() => {
    if (acik) {
      setSeciliIndex(0);
      setTimeout(() => {
        modalInputRef.current?.focus();
        modalInputRef.current?.select();
      }, 60);
    }
  }, [acik]);

  const triggerAdvance = () => {
    requestAnimationFrame(() => onAdvance?.());
    setTimeout(() => onAdvance?.(), 50);
    setTimeout(() => onAdvance?.(), 150);
    setTimeout(() => onAdvance?.(), 250);
  };

  const secVeKapat = (kod: string) => {
    onChange(kod);
    pendingAdvanceRef.current = true;
    setAcik(false);
    triggerAdvance();
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "F3") {
      e.preventDefault();
      setModalArama(value);
      setAcik(true);
      return;
    }
    if (e.key === "Enter") {
      const val = value.trim();
      if (!val) {
        e.preventDefault();
        triggerAdvance();
        onKeyDown?.(e);
        return;
      }
      const matches = filtrele(val);
      if (matches.length === 1) {
        e.preventDefault();
        onChange(matches[0].kod);
        triggerAdvance();
        return;
      } else {
        e.preventDefault();
        setModalArama(val);
        setSeciliIndex(0);
        setAcik(true);
        return;
      }
    }
    onKeyDown?.(e);
  };

  return (
    <>
      <InputGroup size="sm" style={{ width: width + 34, flexWrap: "nowrap" }}>
        <Form.Control
          ref={inputRef}
          value={value}
          maxLength={20}
          disabled={disabled}
          isInvalid={isInvalid || (!!value && !secili)}
          title={baslik}
          className="font-monospace text-center px-1"
          style={{ width }}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleInputKeyDown}
        />
        <Button
          type="button"
          tabIndex={-1}
          variant="outline-secondary"
          className="px-2 py-0 d-flex align-items-center"
          disabled={disabled}
          title="F3) Kuyumculuk KDV kodu seçimi"
          onClick={() => {
            setModalArama(value);
            setAcik(true);
          }}
        >
          <IconBinoculars size={14} />
        </Button>
      </InputGroup>

      <Modal
        show={acik}
        onHide={() => setAcik(false)}
        onExited={() => {
          if (pendingAdvanceRef.current) {
            pendingAdvanceRef.current = false;
            onAdvance?.();
          }
        }}
        centered
        size="lg"
        restoreFocus={false}
        enforceFocus={false}
        autoFocus={false}
      >
        <Modal.Header closeButton className="py-2">
          <Modal.Title className="fs-6 fw-bold">Kuyumculuk KDV kodları (GİB)</Modal.Title>
        </Modal.Header>
        <div className="p-2 border-bottom bg-light">
          <InputGroup size="sm">
            <InputGroup.Text className="bg-white">
              <IconSearch size={14} />
            </InputGroup.Text>
            <Form.Control
              ref={modalInputRef}
              type="text"
              placeholder="Kod veya açıklama ile ara... (Yukarı/Aşağı ok ile gezinin, Enter ile seçin)"
              value={modalArama}
              onChange={(e) => {
                setModalArama(e.target.value);
                setSeciliIndex(0);
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setSeciliIndex((prev) => Math.min(prev + 1, modalListesi.length - 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setSeciliIndex((prev) => Math.max(prev - 1, 0));
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  if (modalListesi[seciliIndex]) {
                    secVeKapat(modalListesi[seciliIndex].kod);
                  } else if (modalListesi.length > 0) {
                    secVeKapat(modalListesi[0].kod);
                  }
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  setAcik(false);
                }
              }}
            />
          </InputGroup>
        </div>
        <Modal.Body className="p-0" style={{ maxHeight: "380px", overflowY: "auto" }}>
          <Table size="sm" hover className="mb-0 small align-middle">
            <thead className="table-light sticky-top">
              <tr>
                <th style={{ width: 70 }}>Kod</th>
                <th style={{ width: 120 }}>Tür</th>
                <th>Açıklama</th>
              </tr>
            </thead>
            <tbody>
              {modalListesi.length === 0 ? (
                <tr>
                  <td colSpan={3} className="text-center text-muted py-3">
                    Eşleşen KDV kodu bulunamadı.
                  </td>
                </tr>
              ) : (
                modalListesi.map((k, idx) => (
                  <tr
                    key={k.kod}
                    style={{ cursor: "pointer" }}
                    className={idx === seciliIndex ? "table-primary fw-semibold" : (k.kod === value ? "table-active" : undefined)}
                    onClick={() => secVeKapat(k.kod)}
                    onMouseEnter={() => setSeciliIndex(idx)}
                  >
                    <td className="font-monospace fw-bold">{k.kod}</td>
                    <td>{k.tur === "OZELMATRAH" ? "Özel matrah" : "İstisna"}</td>
                    <td>{k.ad}</td>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
          <div className="small text-muted p-2 border-top">
            Altın satırı KDV %0 ile seçilen kodla, işçilik ayrı satırda KDV'li gider. 805 seçiliyken gümüş satırlarına 808 yazılır.
            Özel matrah (805, 808) → fatura tipi ÖZELMATRAH; istisna (230, 231, 232, 301) → İSTİSNA.
          </div>
        </Modal.Body>
      </Modal>
    </>
  );
};

export default KuyumKodDurbun;
