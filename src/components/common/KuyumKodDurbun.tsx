import React, { useState } from "react";
import { Button, Form, InputGroup, Modal, Table } from "react-bootstrap";
import { IconBinoculars } from "@tabler/icons-react";
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
}> = ({ value, onChange, disabled, isInvalid, width = 58, inputRef, onKeyDown }) => {
  const [acik, setAcik] = useState(false);
  const secili = kuyumKoduBul(value);
  const baslik = secili ? `${secili.kod} — ${secili.ad}` : value ? "Kuyumculuk kodlarında yok" : "Kod seçin (F3)";
  return (
    <>
      <InputGroup size="sm" style={{ width: width + 34, flexWrap: "nowrap" }}>
        <Form.Control
          ref={inputRef}
          value={value}
          maxLength={3}
          disabled={disabled}
          isInvalid={isInvalid || (!!value && !secili)}
          title={baslik}
          className="font-monospace text-center px-1"
          style={{ width }}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
          onKeyDown={(e) => {
            if (e.key === "F3") {
              e.preventDefault();
              setAcik(true);
              return;
            }
            onKeyDown?.(e);
          }}
        />
        <Button type="button" tabIndex={-1} variant="outline-secondary" className="px-2 py-0 d-flex align-items-center" disabled={disabled} title="F3) Kuyumculuk KDV kodu seçimi" onClick={() => setAcik(true)}>
          <IconBinoculars size={14} />
        </Button>
      </InputGroup>
      <Modal show={acik} onHide={() => setAcik(false)} centered size="lg">
        <Modal.Header closeButton className="py-2">
          <Modal.Title className="fs-6 fw-bold">Kuyumculuk KDV kodları (GİB)</Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-0">
          <Table size="sm" hover className="mb-0 small align-middle">
            <thead className="table-light">
              <tr>
                <th style={{ width: 60 }}>Kod</th>
                <th style={{ width: 110 }}>Tür</th>
                <th>Açıklama</th>
              </tr>
            </thead>
            <tbody>
              {KUYUM_KODLARI.map((k) => (
                <tr key={k.kod} style={{ cursor: "pointer" }} className={k.kod === value ? "table-primary" : undefined}
                  onClick={() => {
                    onChange(k.kod);
                    setAcik(false);
                  }}>
                  <td className="font-monospace fw-bold">{k.kod}</td>
                  <td>{k.tur === "OZELMATRAH" ? "Özel matrah" : "İstisna"}</td>
                  <td>{k.ad}</td>
                </tr>
              ))}
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
