import React, { useEffect, useState } from "react";
import { Alert, Badge, Button, Form, Modal, Spinner } from "react-bootstrap";
import { IconBell, IconBike, IconCheck, IconPackage, IconPhone, IconShoppingBag } from "@tabler/icons-react";
import { PaketBilgisi, PaketListesi, PaketOzeti } from "../../services/adisyonService";
import { para } from "../../services/ticariService";
import { PAKET_DURUM, paketMusteriDenetle, sureYaz, telefonYaz } from "../../../Backend/src/services/adisyon/adisyonHesap";

/**
 * Paket servis / gel-al (docs/TICARI_ADISYON_YOL_HARITASI.md, TA28, D8): süren siparişler durum sütunlarında (hazırlanıyor / yolda /
 * teslim edildi — ödeme bekliyor), hızlı durum düğmeleri, yeni paket / gel-al için müşteri penceresi (telefonla önceki sipariş bulunur).
 * Ödeme ve teslim bağımsızdır: ikisi de bitince sipariş "biten"lere geçer.
 */
export const PaketMusteriModal: React.FC<{
  acik: boolean; tur: 2 | 3; ilk?: Partial<PaketBilgisi> | null; baslik: string;
  musteriBul?: (tel: string) => Promise<{ ad: string | null; adres: string | null; siparisSayisi: number } | null>;
  onOnay: (b: PaketBilgisi) => Promise<void>; kapat: () => void;
}> = ({ acik, tur, ilk, baslik, musteriBul, onOnay, kapat }) => {
  const [tel, setTel] = useState(""), [ad, setAd] = useState(""), [adres, setAdres] = useState(""), [not, setNot] = useState("");
  const [bulunan, setBulunan] = useState<string | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [mesgul, setMesgul] = useState(false);
  useEffect(() => {
    if (!acik) return;
    setTel(ilk?.tel ? telefonYaz(ilk.tel) : ""); setAd(ilk?.ad || ""); setAdres(ilk?.adres || ""); setNot(ilk?.not || ""); setBulunan(null); setHata(null);
  }, [acik, ilk]);
  if (!acik) return null;
  const ara = async () => {
    if (!musteriBul || !tel.trim()) return;
    try {
      const m = await musteriBul(tel);
      if (!m) { setBulunan("Bu numarayla önceki sipariş yok."); return; }
      if (!ad.trim() && m.ad) setAd(m.ad);
      if (tur === 2 && !adres.trim() && m.adres) setAdres(m.adres);
      setBulunan(`Kayıtlı müşteri — önceki sipariş sayısı: ${m.siparisSayisi}`);
    } catch { /* arama yardımcıdır; hata girişi engellemez */ }
  };
  const onayla = async () => {
    const d = paketMusteriDenetle({ tur, ad, tel, adres, not });
    if ("hata" in d) { setHata(d.hata); return; }
    setMesgul(true); setHata(null);
    try { await onOnay({ tur: d.tur, ad: d.ad, tel: d.tel, adres: d.adres, not: d.not }); } catch (e: any) { setHata(e?.message || "Kaydedilemedi."); } finally { setMesgul(false); }
  };
  return (
    <Modal show onHide={kapat} centered>
      <Modal.Header closeButton className="py-2"><Modal.Title className="h6 mb-0">{baslik}</Modal.Title></Modal.Header>
      <Modal.Body>
        <Form.Group className="mb-2">
          <Form.Label className="small fw-bold mb-1">Telefon{tur === 2 ? "" : " (isteğe bağlı)"}</Form.Label>
          <Form.Control aria-label="Telefon" inputMode="tel" placeholder="0532 123 45 67" value={tel} autoFocus onChange={(e) => setTel(e.target.value)} onBlur={() => void ara()} onKeyDown={(e) => { if (e.key === "Enter") void ara(); }} />
          {bulunan && <Form.Text>{bulunan}</Form.Text>}
        </Form.Group>
        <Form.Group className="mb-2">
          <Form.Label className="small fw-bold mb-1">Müşteri adı</Form.Label>
          <Form.Control aria-label="Müşteri adı" maxLength={100} value={ad} onChange={(e) => setAd(e.target.value)} />
        </Form.Group>
        {tur === 2 && (
          <Form.Group className="mb-2">
            <Form.Label className="small fw-bold mb-1">Adres</Form.Label>
            <Form.Control as="textarea" rows={2} aria-label="Adres" maxLength={400} value={adres} onChange={(e) => setAdres(e.target.value)} />
          </Form.Group>
        )}
        <Form.Group>
          <Form.Label className="small fw-bold mb-1">Not (kurye / mutfak)</Form.Label>
          <Form.Control aria-label="Not" maxLength={250} placeholder="Ör. zile basmayın, kapıda kartla ödeyecek" value={not} onChange={(e) => setNot(e.target.value)} />
        </Form.Group>
        {hata && <Alert variant="danger" className="py-2 small mt-2 mb-0">{hata}</Alert>}
      </Modal.Body>
      <Modal.Footer className="py-2">
        <Button variant="outline-secondary" onClick={kapat}>Vazgeç</Button>
        <Button variant="success" disabled={mesgul} onClick={() => void onayla()}>{mesgul ? <Spinner size="sm" /> : "Devam"}</Button>
      </Modal.Footer>
    </Modal>
  );
};

const SUTUNLAR = [
  { anahtar: "hazirlaniyor", ad: "Hazırlanıyor", renk: "#d97706", suz: (p: PaketOzeti) => p.paketDurum === PAKET_DURUM.HAZIRLANIYOR },
  { anahtar: "yolda", ad: "Yolda", renk: "#2563eb", suz: (p: PaketOzeti) => p.paketDurum === PAKET_DURUM.YOLDA },
  { anahtar: "teslim", ad: "Teslim edildi — ödeme bekliyor", renk: "#16a34a", suz: (p: PaketOzeti) => p.paketDurum === PAKET_DURUM.TESLIM },
] as const;

/** Sabit renkli düğme (tema hover rengi takılmasın) */
const Dugme: React.FC<{ renk: string; onClick: () => void; children: React.ReactNode; disabled?: boolean; dolu?: boolean }> = ({ renk, onClick, children, disabled, dolu }) => (
  <button type="button" disabled={disabled} onClick={(e) => { e.stopPropagation(); onClick(); }}
    style={{ border: `1px solid ${renk}`, background: dolu ? renk : "#fff", color: dolu ? "#fff" : renk, borderRadius: 6, padding: "2px 8px", fontSize: 12, fontWeight: 700, opacity: disabled ? 0.5 : 1 }}>{children}</button>
);

export const PaketPaneli: React.FC<{
  liste: PaketListesi | null;
  onAc: (p: PaketOzeti) => void;
  onYeni: (tur: 2 | 3) => void;
  onDurum: (p: PaketOzeti, durum: number) => Promise<void>;
}> = ({ liste, onAc, onYeni, onDurum }) => {
  const [mesgul, setMesgul] = useState<number | null>(null);
  const [bitenAcik, setBitenAcik] = useState(false);
  const durum = async (p: PaketOzeti, d: number) => { setMesgul(p.adisyonId); try { await onDurum(p, d); } finally { setMesgul(null); } };
  const kart = (p: PaketOzeti) => (
    <div key={p.adisyonId} role="button" tabIndex={0} onClick={() => onAc(p)} onKeyDown={(e) => { if (e.key === "Enter") onAc(p); }} aria-label={`${p.tur === 3 ? "Gel-al" : "Paket"} ${p.musteriAd || ""}`}
      style={{ border: "1px solid #cbd5e1", borderRadius: 10, padding: "8px 10px", background: "#fff", marginBottom: 8, cursor: "pointer", boxShadow: "0 1px 2px rgba(0,0,0,.05)" }}>
      <div className="d-flex align-items-center gap-2">
        <span className="badge" style={{ background: p.tur === 3 ? "#7c3aed" : "#0f766e" }}>{p.tur === 3 ? "Gel-al" : "Paket"}</span>
        <span className="fw-bold text-truncate">{p.musteriAd}</span>
        <span className="ms-auto small text-muted text-nowrap">{sureYaz(p.dakika)}</span>
      </div>
      {p.musteriTel && <div className="small d-flex align-items-center gap-1"><IconPhone size={12} />{telefonYaz(p.musteriTel)}</div>}
      {p.musteriAdres && <div className="small text-muted text-truncate" title={p.musteriAdres}>{p.musteriAdres}</div>}
      {p.not && <div className="small fst-italic" style={{ color: "#b45309" }}>{p.not}</div>}
      <div className="d-flex align-items-center gap-2 mt-1 flex-wrap">
        <span className="fw-bold">{para(p.toplam)} TL</span>
        <span className="small text-muted">{p.kalemSayisi} kalem</span>
        {p.hazirlananSayisi > 0 && <span className="small" style={{ color: "#d97706" }}>{p.hazirlananSayisi} mutfakta</span>}
        {p.hazirSayisi > 0 && <span className="d-inline-flex align-items-center gap-1" style={{ background: "#16a34a", color: "#fff", borderRadius: 6, padding: "0 6px", fontSize: 12, fontWeight: 700 }}><IconBell size={12} />{p.hazirSayisi} hazır</span>}
        {p.odendi ? <Badge bg="success">Ödendi</Badge> : <Badge bg="light" text="dark" className="border">Ödenmedi</Badge>}
        <span className="ms-auto d-flex gap-1">
          {p.tur === 2 && p.paketDurum === PAKET_DURUM.HAZIRLANIYOR && <Dugme renk="#2563eb" dolu disabled={mesgul === p.adisyonId} onClick={() => void durum(p, PAKET_DURUM.YOLDA)}><IconBike size={13} /> Yola çıktı</Dugme>}
          {p.tur === 2 && p.paketDurum === PAKET_DURUM.YOLDA && <Dugme renk="#64748b" disabled={mesgul === p.adisyonId} onClick={() => void durum(p, PAKET_DURUM.HAZIRLANIYOR)}>Geri al</Dugme>}
          {((p.tur === 2 && p.paketDurum === PAKET_DURUM.YOLDA) || (p.tur === 3 && p.paketDurum === PAKET_DURUM.HAZIRLANIYOR)) &&
            <Dugme renk="#16a34a" dolu disabled={mesgul === p.adisyonId} onClick={() => void durum(p, PAKET_DURUM.TESLIM)}><IconCheck size={13} /> Teslim edildi</Dugme>}
        </span>
      </div>
    </div>
  );
  return (
    <div>
      <div className="d-flex gap-2 mb-3">
        <Button variant="success" className="fw-bold" onClick={() => onYeni(2)}><IconPackage size={17} className="me-1" />Yeni paket servis</Button>
        <Button variant="outline-success" className="fw-bold" onClick={() => onYeni(3)}><IconShoppingBag size={17} className="me-1" />Yeni gel-al</Button>
      </div>
      {!liste ? <Spinner size="sm" /> : (
        <>
          <div className="d-grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
            {SUTUNLAR.map((s) => {
              const l = liste.aktif.filter(s.suz);
              return (
                <div key={s.anahtar} className="rounded p-2" style={{ background: "#f8fafc", border: "1px solid #e2e8f0", minHeight: 120 }}>
                  <div className="fw-bold small mb-2 d-flex align-items-center gap-2" style={{ color: s.renk }}>{s.ad}<span className="badge" style={{ background: s.renk }}>{l.length}</span></div>
                  {l.length ? l.map(kart) : <div className="small text-muted">Yok.</div>}
                </div>
              );
            })}
          </div>
          {liste.biten.length > 0 && (
            <div className="mt-3">
              <Button size="sm" variant="link" className="p-0" onClick={() => setBitenAcik(!bitenAcik)}>Son 12 saatte biten ({liste.biten.length}) {bitenAcik ? "▲" : "▼"}</Button>
              {bitenAcik && (
                <div className="small mt-1">
                  {liste.biten.map((p) => (
                    <div key={p.adisyonId} className="d-flex gap-2 border-bottom py-1" role="button" onClick={() => onAc(p)}>
                      <span className="text-muted">{p.adisyonNo}</span><span>{p.tur === 3 ? "Gel-al" : "Paket"}</span><span className="fw-semibold">{p.musteriAd}</span>
                      <span className="ms-auto">{para(p.toplam)} TL</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};
