import React, { useEffect, useMemo, useState } from "react";
import { Badge, Button, Form, Modal } from "react-bootstrap";
import { IconMinus, IconPlus } from "@tabler/icons-react";
import { MenuUrunu, SecenekGrubu } from "../../services/adisyonService";
import { para } from "../../services/ticariService";
import { kalemBirimFiyati, secimDenetle, secimMetni } from "../../../Backend/src/services/adisyon/adisyonHesap";
import { BekleyenKalem } from "./adisyonBekleyen";

/**
 * Ürün seçenekleri (TA28): porsiyon, seçenek grupları (zorunlu tek seçim / çoklu ücretli), not, miktar. Fiyat canlı hesaplanır
 * (ön izleme; asıl fiyatı sunucu hesaplar). Zorunlu grup seçilmeden "Ekle" kapalı.
 */
export const UrunSecimModal: React.FC<{
  urun: MenuUrunu | null;
  gruplar: SecenekGrubu[];
  /** Tartılı üründe tartıdan gelen miktar (değiştirilmez) */
  sabitMiktar?: number | null;
  onEkle: (k: Omit<BekleyenKalem, "anahtar">) => void;
  kapat: () => void;
  buyuk?: boolean;
}> = ({ urun, gruplar, sabitMiktar, onEkle, kapat, buyuk }) => {
  const [porsiyonId, setPorsiyonId] = useState<number | null>(null);
  const [secilen, setSecilen] = useState<number[]>([]);
  const [notu, setNotu] = useState("");
  const [miktar, setMiktar] = useState(1);
  useEffect(() => {
    if (!urun) return;
    const p = urun.porsiyonlar;
    setPorsiyonId(p.length ? (p.find((x) => x.carpan === 1) ?? p[0]).porsiyonId : null);
    setSecilen([]); setNotu(""); setMiktar(1);
  }, [urun]);
  const urunGruplari = useMemo(() => (urun ? urun.secenekGrupIdler.map((id) => gruplar.find((g) => g.sgId === id)).filter(Boolean) as SecenekGrubu[] : []), [urun, gruplar]);
  if (!urun) return null;
  const denetim = secimDenetle(urunGruplari, secilen);
  const porsiyon = urun.porsiyonlar.find((p) => p.porsiyonId === porsiyonId) || null;
  const birimFiyat = urun.fiyat === null ? 0 : kalemBirimFiyati(urun.fiyat, porsiyon?.carpan ?? 1, porsiyon?.fiyat ?? null, "hata" in denetim ? 0 : denetim.ekFiyat);
  const adet = sabitMiktar ?? miktar;
  const sec = (g: SecenekGrubu, id: number) => {
    const grupIdleri = g.secenekler.map((s) => s.secenekId);
    if (g.coklu) setSecilen((o) => (o.includes(id) ? o.filter((x) => x !== id) : [...o, id]));
    else setSecilen((o) => (o.includes(id) && !g.zorunlu ? o.filter((x) => x !== id) : [...o.filter((x) => !grupIdleri.includes(x)), id]));
  };
  const ekle = () => {
    if ("hata" in denetim || urun.fiyat === null) return;
    onEkle({ stokKartId: urun.stokKartId, ad: urun.ad, miktar: adet, birim: urun.birim, tartili: urun.tartili, porsiyonId, porsiyonAd: porsiyon?.ad ?? null,
      secenekIdler: denetim.secimler.map((s) => s.secenekId), secimMetni: secimMetni(denetim.secimler), notu: notu.trim().slice(0, 200), birimFiyat });
  };
  const dugme = buyuk ? { minHeight: 48, minWidth: 64, fontSize: 16 } : { minHeight: 38, minWidth: 56 };
  // Seçim düğmeleri sabit renkli: dokunmatik ekranda takılı kalan üzerinde durma (hover) rengi seçili sanılmasın
  const secimStili = (secili: boolean, renk: string): React.CSSProperties => ({ ...dugme, borderRadius: 8, padding: "4px 12px", fontWeight: 600, lineHeight: 1.15,
    border: `2px solid ${secili ? renk : "#cbd5e1"}`, background: secili ? renk : "#ffffff", color: secili ? "#ffffff" : "#0f172a" });
  return (
    <Modal show onHide={kapat} centered size={buyuk ? undefined : "lg"} fullscreen={buyuk ? "sm-down" : undefined}>
      <Modal.Header closeButton className="py-2">
        <Modal.Title className="h6 mb-0">{urun.ad} <span className="text-muted fw-normal ms-2">{para(birimFiyat)} TL</span></Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {urun.porsiyonlar.length > 0 && (
          <div className="mb-3">
            <div className="small fw-bold mb-1">Porsiyon</div>
            <div className="d-flex flex-wrap gap-2">
              {urun.porsiyonlar.map((p) => (
                <button key={p.porsiyonId} type="button" aria-pressed={p.porsiyonId === porsiyonId} style={secimStili(p.porsiyonId === porsiyonId, "#1d4ed8")} onClick={() => setPorsiyonId(p.porsiyonId)}>
                  {p.ad}<div style={{ fontSize: 11 }}>{para(urun.fiyat === null ? 0 : kalemBirimFiyati(urun.fiyat, p.carpan, p.fiyat, 0))}</div>
                </button>
              ))}
            </div>
          </div>
        )}
        {urunGruplari.map((g) => (
          <div key={g.sgId} className="mb-3">
            <div className="small fw-bold mb-1">{g.ad} {g.zorunlu && <Badge bg="warning" text="dark">Zorunlu</Badge>} <span className="text-muted fw-normal">{g.coklu ? "birden çok seçilebilir" : "tek seçim"}</span></div>
            <div className="d-flex flex-wrap gap-2">
              {g.secenekler.map((s) => (
                <button key={s.secenekId} type="button" aria-pressed={secilen.includes(s.secenekId)} style={secimStili(secilen.includes(s.secenekId), "#15803d")} onClick={() => sec(g, s.secenekId)}>
                  {s.ad}{s.ekFiyat > 0 && <div style={{ fontSize: 11 }}>+{para(s.ekFiyat)}</div>}
                </button>
              ))}
            </div>
          </div>
        ))}
        <Form.Group className="mb-3">
          <Form.Label className="small fw-bold mb-1">Not</Form.Label>
          <Form.Control size={buyuk ? "lg" : "sm"} aria-label="Ürün notu" maxLength={200} value={notu} onChange={(e) => setNotu(e.target.value)} placeholder="Mutfağa not" />
        </Form.Group>
        {sabitMiktar ? (
          <div className="small">Miktar: <b>{String(sabitMiktar).replace(".", ",")} {urun.birim}</b> (tartıdan)</div>
        ) : (
          <div className="d-flex align-items-center gap-2">
            <span className="small fw-bold">Adet</span>
            <Button variant="outline-secondary" style={dugme} aria-label="Azalt" onClick={() => setMiktar((m) => Math.max(1, m - 1))}><IconMinus size={16} /></Button>
            <span className="fw-bold fs-5" style={{ minWidth: 36, textAlign: "center" }}>{miktar}</span>
            <Button variant="outline-secondary" style={dugme} aria-label="Artır" onClick={() => setMiktar((m) => Math.min(999, m + 1))}><IconPlus size={16} /></Button>
          </div>
        )}
        {"hata" in denetim && <div className="small text-danger mt-2">{denetim.hata}</div>}
      </Modal.Body>
      <Modal.Footer className="py-2">
        <span className="me-auto fw-bold">Tutar: {para(Math.round(birimFiyat * adet * 100) / 100)} TL</span>
        <Button variant="outline-secondary" onClick={kapat}>Vazgeç</Button>
        <Button variant="success" style={dugme} disabled={"hata" in denetim || urun.fiyat === null} onClick={ekle}>Ekle</Button>
      </Modal.Footer>
    </Modal>
  );
};

export default UrunSecimModal;
