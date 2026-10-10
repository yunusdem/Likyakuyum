import React from "react";
import { Badge, Form } from "react-bootstrap";
import { PaketDto } from "../services/adminApi";
import { URUN_ROZET_RENGI } from "./paketOrtak";

/**
 * Lisans ürünleri (docs/LISANS_URUN_PAKETLERI.md): çoklu seçim. ERP (hepsi) işaretlenince diğerleri de işaretli görünür
 * ve kilitlenir; kayda yalnız ERP gider (diğerleri zaten içindedir).
 */
const UrunSecici: React.FC<{ urunler: PaketDto[]; secili: string[]; onDegistir: (s: string[]) => void; disabled?: boolean; kimlik: string }> = ({
  urunler,
  secili,
  onDegistir,
  disabled,
  kimlik,
}) => {
  const hepsiSecili = urunler.some((u) => u.hepsi && secili.includes(u.paketKodu));
  const degistir = (u: PaketDto, ac: boolean) => {
    if (u.hepsi) return onDegistir(ac ? [u.paketKodu] : []);
    onDegistir(ac ? [...secili, u.paketKodu] : secili.filter((k) => k !== u.paketKodu));
  };

  return (
    <div className="d-flex flex-wrap gap-3">
      {urunler.map((u) => (
        <Form.Check
          key={u.paketKodu}
          id={`${kimlik}-${u.paketKodu}`}
          type="checkbox"
          className="mb-0"
          checked={secili.includes(u.paketKodu) || (hepsiSecili && !u.hepsi)}
          disabled={disabled || (hepsiSecili && !u.hepsi)}
          onChange={(e) => degistir(u, e.target.checked)}
          label={<span style={{ color: URUN_ROZET_RENGI[u.paketKodu] }} className="fw-semibold">{u.ad}</span>}
        />
      ))}
    </div>
  );
};

/** Firmalar listesi / lisans tablosu rozetleri */
export const UrunRozetleri: React.FC<{ urunler: string[]; adlar?: Record<string, string>; kisa?: boolean }> = ({ urunler, adlar, kisa }) => (
  <span className="d-inline-flex flex-wrap gap-1">
    {urunler.map((u) => (
      <Badge key={u} bg="" style={{ background: URUN_ROZET_RENGI[u] || "#6c757d" }} title={adlar?.[u] || u}>
        {kisa ? (u === "erp" ? "ERP" : u.charAt(0).toUpperCase()) : adlar?.[u] || u}
      </Badge>
    ))}
  </span>
);

export default UrunSecici;
