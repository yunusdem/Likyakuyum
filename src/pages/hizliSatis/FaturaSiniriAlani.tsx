import React, { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { Col, Form, Row } from "react-bootstrap";
import { HizliSatisService } from "../../services/hizliSatisService";

/**
 * Firma Tanımları › Limitler: Hızlı Satış fatura sınırı (H12, varsayılan 12.000 TL). Değer TODVZ_HIZLI_SATIS_AYAR'da
 * (eski TODVZ_TANIM'e kolon eklenmedi, U1); Firma Tanımları kaydedilirken bu alan da kaydedilir.
 */
export interface FaturaSiniriAlaniRef {
  kaydet: () => Promise<void>;
}

const FaturaSiniriAlani = forwardRef<FaturaSiniriAlaniRef, { labelStyle?: React.CSSProperties }>(({ labelStyle }, ref) => {
  const [deger, setDeger] = useState("");
  const [ilk, setIlk] = useState<string | null>(null);

  useEffect(() => {
    HizliSatisService.yetki()
      .then((y) => { setDeger(String(y.faturaSiniri)); setIlk(String(y.faturaSiniri)); })
      .catch(() => setIlk(null));
  }, []);

  useImperativeHandle(ref, () => ({
    kaydet: async () => {
      if (ilk === null || deger === ilk) return;
      const n = Number(deger);
      if (!Number.isFinite(n) || n < 0) throw new Error("Hızlı satış fatura sınırı 0 ya da pozitif bir tutar olmalı.");
      const a = await HizliSatisService.ayarKaydet({ faturaSiniri: n });
      setDeger(String(a.faturaSiniri));
      setIlk(String(a.faturaSiniri));
    },
  }), [deger, ilk]);

  if (ilk === null) return null;
  return (
    <Form.Group as={Row} className="mb-2 align-items-center g-2">
      <Form.Label column style={labelStyle} className="small fw-semibold text-secondary text-start text-nowrap pe-1 mb-0" title="Bu tutar ve üzerindeki Perakende/Ticari hızlı satışta alıcı bilgisi istenir (0 = kapalı)">
        Fatura Sınırı (Hızlı Satış):
      </Form.Label>
      <Col>
        <Form.Control type="number" min={0} value={deger} onChange={(e) => setDeger(e.target.value)}
          className="bg-white border font-monospace text-end" style={{ maxWidth: "100px" }} aria-label="Hızlı satış fatura sınırı" />
      </Col>
    </Form.Group>
  );
});

FaturaSiniriAlani.displayName = "FaturaSiniriAlani";
export default FaturaSiniriAlani;
