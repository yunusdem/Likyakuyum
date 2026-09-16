import { useEffect, useState } from "react";
import { Col, Form, Row } from "react-bootstrap";
import { CariService, CariKartItem, CariLookups } from "../../services/cariService";
import { DurbunAlan, type SecimKolon } from "../rapor/RaporSecim";

/**
 * Alıcı cari seçimi — dürbünlü dar alan (yönetici isteği 16.09.2026): "Cari Ara" düğmesi ve geniş arama kutusu
 * kaldırıldı; kutu tıklanınca dürbün penceresi açılır, orada kod/ünvan/telefon/VKN ile süzülüp seçilir.
 * Seçilen cari kutuda "KOD — Ünvan (VKN)" olarak gösterilir. Cari modülü yalnızca okunur.
 */
const kolonlar: SecimKolon<CariKartItem>[] = [
  { baslik: "Kod", genislik: "110px", deger: c => <span className="font-monospace fw-bold">{c.kod}</span> },
  { baslik: "Ünvan / Ad", deger: c => c.ad },
  { baslik: "Telefon", genislik: "120px", deger: c => c.telefon || "-" },
  { baslik: "VKN / TCKN", genislik: "120px", deger: c => c.vergiKimlikNo || <span className="text-danger">Eksik</span> },
];
const arama = (c: CariKartItem) => [c.kod, c.ad, c.telefon, c.vergiKimlikNo, c.yetkiliKisi];

export default function EBelgeCariSec({ onSelect }: {
  onSelect: (cari: CariKartItem, lookups: CariLookups) => void;
}) {
  const [kayitlar, setKayitlar] = useState<CariKartItem[]>([]);
  const [lookups, setLookups] = useState<CariLookups | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [secili, setSecili] = useState<CariKartItem | null>(null);
  const [hata, setHata] = useState("");

  useEffect(() => {
    let iptal = false;
    Promise.all([CariService.getCariKartlar(), CariService.getLookups()])
      .then(([c, l]) => { if (!iptal) { setKayitlar(c); setLookups(l); } })
      .catch(e => { if (!iptal) setHata(e?.message || "Cari listesi alınamadı."); })
      .finally(() => { if (!iptal) setYukleniyor(false); });
    return () => { iptal = true; };
  }, []);

  const sec = (c: CariKartItem) => {
    if (!/^\d{10,11}$/.test(c.vergiKimlikNo?.trim() || "")) { setHata(`${c.kod} carisinin VKN/TCKN'si eksik; kartını düzeltip tekrar seçin.`); return; }
    setHata(""); setSecili(c);
    if (lookups) onSelect(c, lookups);
  };

  const metin = secili ? `${secili.kod} — ${secili.ad}${secili.vergiKimlikNo ? ` (${secili.vergiKimlikNo})` : ""}` : "";
  return <Row className="g-2 mb-2">
    <Col xs={12} md={6} lg={5}>
      <Form.Label className="small mb-1">Cari (dürbünden seçin)</Form.Label>
      <DurbunAlan<CariKartItem> value={metin} saltOkunur onChange={() => undefined} placeholder="Cari seçilmedi — dürbünle arayın" title="Alıcı cari seçimi"
        items={kayitlar} yukleniyor={yukleniyor} kolonlar={kolonlar} aramaAlanlari={arama} anahtar={c => String(c.id)}
        aramaYerTutucu="Cari kodu, ünvan, telefon veya vergi no ile arayın…" onSelect={sec} />
      {hata ? <div className="form-text text-danger mt-0">{hata}</div>
        : secili ? <div className="form-text text-success mt-0">Seçildi: {secili.ad}. Bilgiler alıcı alanlarına yazıldı.</div>
        : <div className="form-text mt-0">Kayıtlı cariyi seçince VKN, unvan, adres ve e-posta kendiliğinden dolar.</div>}
    </Col>
  </Row>;
}
