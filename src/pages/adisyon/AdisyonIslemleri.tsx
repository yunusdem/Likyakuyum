import React, { useEffect, useState } from "react";
import { Alert, Button, Form, Modal, Spinner } from "react-bootstrap";
import { IconArrowsExchange, IconBan, IconCurrencyLira, IconGift, IconGiftOff, IconMinus, IconPlus, IconToolsKitchen } from "@tabler/icons-react";
import { AdisyonKalemi, MasaDurumu, MasaOzeti } from "../../services/adisyonService";
import { para } from "../../services/ticariService";
import { paraOku } from "../../utils/sayiGirisi";
import { IKRAM_NEDENLERI, IPTAL_NEDENLERI, KALEM_DURUM } from "../../../Backend/src/services/adisyon/adisyonHesap";
import { tartiBirimi } from "../../../Backend/src/services/ticari/ticariHesap";
import { MasaIzgarasi } from "./MasaIzgarasi";

/**
 * Masa işlemleri pencereleri (docs/TICARI_ADISYON_YOL_HARITASI.md, TA27, D6): kalem işlemleri (ikram / ikramı geri al / iptal /
 * başka masaya taşı / servis edildi; adetli kalemde miktar seçimi), neden seçimi (liste + açıklama; "Diğer"de zorunlu), hedef masa
 * seçimi (boş / dolu / herhangi). Düğmeler yetkiye göre çizilir; asıl denetim sunucuda.
 */
export type KalemIslemi = "ikram" | "ikram-geri" | "iptal" | "tasi" | "servis" | "fiyat";

export const KalemIslemModal: React.FC<{
  kalem: AdisyonKalemi | null; yetkiler: string[]; buyuk?: boolean;
  onSec: (islem: KalemIslemi, miktar: number) => void; kapat: () => void;
}> = ({ kalem, yetkiler, buyuk, onSec, kapat }) => {
  const [miktar, setMiktar] = useState(1);
  useEffect(() => { if (kalem) setMiktar(kalem.miktar); }, [kalem]);
  if (!kalem) return null;
  const tartili = !!tartiBirimi(kalem.birim);
  const adetli = !tartili && kalem.miktar > 1;
  const y = (x: string) => yetkiler.includes(x);
  const dugme: React.CSSProperties = { minHeight: buyuk ? 52 : 42, fontWeight: 600, display: "flex", alignItems: "center", gap: 8, justifyContent: "center" };
  return (
    <Modal show onHide={kapat} centered fullscreen={buyuk ? "sm-down" : undefined}>
      <Modal.Header closeButton className="py-2"><Modal.Title className="h6 mb-0">{kalem.ad}{kalem.porsiyonAd ? ` (${kalem.porsiyonAd})` : ""}</Modal.Title></Modal.Header>
      <Modal.Body>
        <div className="small text-muted mb-2">{tartili ? `${String(kalem.miktar).replace(".", ",")} ${kalem.birim}` : `${kalem.miktar} adet`} · {para(kalem.tutar)} TL{kalem.ikram ? " · İkram" : ""}{kalem.secimMetni ? ` · ${kalem.secimMetni}` : ""}</div>
        {adetli && (
          <div className="d-flex align-items-center gap-2 mb-3">
            <span className="small fw-bold">İşlem yapılacak adet</span>
            <Button variant="outline-secondary" size="sm" aria-label="Adet azalt" onClick={() => setMiktar((m) => Math.max(1, m - 1))}><IconMinus size={14} /></Button>
            <span className="fw-bold fs-5" style={{ minWidth: 30, textAlign: "center" }}>{miktar}</span>
            <Button variant="outline-secondary" size="sm" aria-label="Adet artır" onClick={() => setMiktar((m) => Math.min(kalem.miktar, m + 1))}><IconPlus size={14} /></Button>
            <span className="small text-muted">/ {kalem.miktar}</span>
          </div>
        )}
        <div className="d-grid gap-2">
          {kalem.durum === KALEM_DURUM.HAZIR && <Button variant="outline-success" style={dugme} onClick={() => onSec("servis", kalem.miktar)}><IconToolsKitchen size={18} />Servis edildi</Button>}
          {!kalem.ikram && y("ikram") && <Button variant="outline-info" style={dugme} onClick={() => onSec("ikram", miktar)}><IconGift size={18} />İkram{adetli ? ` (${miktar})` : ""}</Button>}
          {kalem.ikram && y("ikram") && <Button variant="outline-secondary" style={dugme} onClick={() => onSec("ikram-geri", kalem.miktar)}><IconGiftOff size={18} />İkramı geri al</Button>}
          {y("masa-tasi") && <Button variant="outline-primary" style={dugme} onClick={() => onSec("tasi", miktar)}><IconArrowsExchange size={18} />Başka masaya taşı{adetli ? ` (${miktar})` : ""}</Button>}
          {!kalem.ikram && y("fiyat") && <Button variant="outline-dark" style={dugme} onClick={() => onSec("fiyat", kalem.miktar)}><IconCurrencyLira size={18} />Fiyat değiştir</Button>}
          {y("iptal") && <Button variant="outline-danger" style={dugme} onClick={() => onSec("iptal", miktar)}><IconBan size={18} />İptal{adetli ? ` (${miktar})` : ""}</Button>}
          {!y("iptal") && !y("ikram") && !y("masa-tasi") && !y("fiyat") && kalem.durum !== KALEM_DURUM.HAZIR && <Alert variant="secondary" className="py-2 small mb-0">Bu kalem için işlem yetkiniz yok (ikram / iptal yetkili yapar).</Alert>}
        </div>
      </Modal.Body>
    </Modal>
  );
};

export const NedenModal: React.FC<{
  tur: "ikram" | "iptal" | "adisyon-iptal" | null; baslik: string; buyuk?: boolean;
  onOnay: (neden: string, aciklama: string) => Promise<void>; kapat: () => void;
}> = ({ tur, baslik, buyuk, onOnay, kapat }) => {
  const [neden, setNeden] = useState("");
  const [aciklama, setAciklama] = useState("");
  const [mesgul, setMesgul] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  useEffect(() => { setNeden(""); setAciklama(""); setHata(null); }, [tur]);
  if (!tur) return null;
  const liste: readonly string[] = tur === "ikram" ? IKRAM_NEDENLERI : IPTAL_NEDENLERI;
  const gecerli = !!neden && (neden !== "Diğer" || aciklama.trim().length >= 3);
  const onayla = async () => {
    setMesgul(true); setHata(null);
    try { await onOnay(neden, aciklama.trim()); } catch (e: any) { setHata(e?.message || "Yapılamadı."); } finally { setMesgul(false); }
  };
  return (
    <Modal show onHide={kapat} centered fullscreen={buyuk ? "sm-down" : undefined}>
      <Modal.Header closeButton className="py-2"><Modal.Title className="h6 mb-0">{baslik}</Modal.Title></Modal.Header>
      <Modal.Body>
        <div className="small fw-bold mb-1">Neden</div>
        <div className="d-grid gap-2 mb-2">
          {liste.map((n) => (
            <button key={n} type="button" aria-pressed={neden === n} onClick={() => setNeden(n)}
              style={{ minHeight: buyuk ? 46 : 38, borderRadius: 8, textAlign: "left", padding: "6px 12px", fontWeight: 600, border: `2px solid ${neden === n ? (tur === "ikram" ? "#0891b2" : "#dc2626") : "#cbd5e1"}`, background: neden === n ? (tur === "ikram" ? "#ecfeff" : "#fef2f2") : "#fff", color: "#0f172a" }}>{n}</button>
          ))}
        </div>
        <Form.Control as="textarea" rows={2} aria-label="Açıklama" maxLength={150} placeholder={neden === "Diğer" ? "Açıklama (zorunlu)" : "Açıklama (isteğe bağlı)"} value={aciklama} onChange={(e) => setAciklama(e.target.value)} />
        {tur === "adisyon-iptal" && <Alert variant="warning" className="py-2 small mt-2 mb-0">Adisyondaki bütün kalemler iptal edilir ve masa boşalır. Mutfakta hazırlanan ürünler için iptal fişi basılır.</Alert>}
        {hata && <Alert variant="danger" className="py-2 small mt-2 mb-0">{hata}</Alert>}
      </Modal.Body>
      <Modal.Footer className="py-2">
        <Button variant="outline-secondary" onClick={kapat}>Vazgeç</Button>
        <Button variant={tur === "ikram" ? "info" : "danger"} disabled={!gecerli || mesgul} onClick={() => void onayla()} style={{ minHeight: buyuk ? 48 : undefined }}>{mesgul ? <Spinner size="sm" /> : tur === "ikram" ? "İkram et" : "İptal et"}</Button>
      </Modal.Footer>
    </Modal>
  );
};

/** Kalem fiyatı değiştirme (K1, TA25): yeni birim fiyat (KDV dahil) + neden; yetki "fiyat" (sunucuda denetlenir) */
export const FiyatModal: React.FC<{ kalem: AdisyonKalemi | null; buyuk?: boolean; onOnay: (fiyat: number, neden: string) => Promise<void>; kapat: () => void }> = ({ kalem, buyuk, onOnay, kapat }) => {
  const [fiyat, setFiyat] = useState("");
  const [neden, setNeden] = useState("");
  const [mesgul, setMesgul] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  useEffect(() => { setFiyat(kalem ? String(kalem.birimFiyat).replace(".", ",") : ""); setNeden(""); setHata(null); }, [kalem]);
  if (!kalem) return null;
  const f = paraOku(fiyat);
  const gecerli = Number.isFinite(f) && f >= 0 && Math.abs(f - kalem.birimFiyat) > 0.004 && neden.trim().length >= 3;
  const onayla = async () => { setMesgul(true); setHata(null); try { await onOnay(Math.round(f * 100) / 100, neden.trim()); } catch (e: any) { setHata(e?.message || "Yapılamadı."); } finally { setMesgul(false); } };
  return (
    <Modal show onHide={kapat} centered fullscreen={buyuk ? "sm-down" : undefined}>
      <Modal.Header closeButton className="py-2"><Modal.Title className="h6 mb-0">Fiyat değiştir: {kalem.ad}{kalem.porsiyonAd ? ` (${kalem.porsiyonAd})` : ""}</Modal.Title></Modal.Header>
      <Modal.Body>
        <div className="small text-muted mb-2">Şimdiki birim fiyat {para(kalem.birimFiyat)} TL{kalem.ilkFiyat !== null && kalem.ilkFiyat !== undefined ? ` (ilk fiyat ${para(kalem.ilkFiyat)} TL)` : ""} · {kalem.miktar % 1 ? String(kalem.miktar).replace(".", ",") : kalem.miktar} {kalem.birim}</div>
        <Form.Label className="small fw-bold mb-1">Yeni birim fiyat (KDV dahil, TL)</Form.Label>
        <Form.Control autoFocus inputMode="decimal" aria-label="Yeni birim fiyat" className="text-end fw-bold mb-2" style={{ fontSize: 20 }} value={fiyat} onChange={(e) => setFiyat(e.target.value.replace(/[^0-9.,]/g, ""))} />
        {Number.isFinite(f) && f >= 0 && <div className="small mb-2">Kalem tutarı: <b>{para(Math.round(kalem.miktar * f * 100) / 100)} TL</b> (şimdi {para(kalem.tutar)} TL)</div>}
        <Form.Label className="small fw-bold mb-1">Neden (zorunlu)</Form.Label>
        <Form.Control aria-label="Fiyat değişikliği nedeni" maxLength={100} placeholder="Örn. kampanya, yanlış fiyat" value={neden} onChange={(e) => setNeden(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && gecerli && !mesgul) void onayla(); }} />
        {hata && <Alert variant="danger" className="py-2 small mt-2 mb-0">{hata}</Alert>}
      </Modal.Body>
      <Modal.Footer className="py-2">
        <Button variant="outline-secondary" onClick={kapat}>Vazgeç</Button>
        <Button variant="dark" disabled={!gecerli || mesgul} style={{ minHeight: buyuk ? 48 : undefined }} onClick={() => void onayla()}>{mesgul ? <Spinner size="sm" /> : "Fiyatı değiştir"}</Button>
      </Modal.Footer>
    </Modal>
  );
};

/** Adisyon indirimi (K1, TA25): yüzde ya da tutar + neden; mevcut indirimi kaldırma. Yetki "indirim" (sunucuda denetlenir) */
export const IndirimModal: React.FC<{
  acik: boolean; mevcut: { tur: number; deger: number; neden: string | null } | null; buyuk?: boolean;
  onOnay: (g: { tur: number; deger?: number; neden?: string }) => Promise<void>; kapat: () => void;
}> = ({ acik, mevcut, buyuk, onOnay, kapat }) => {
  const [tur, setTur] = useState<1 | 2>(1);
  const [deger, setDeger] = useState("");
  const [neden, setNeden] = useState("");
  const [mesgul, setMesgul] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  useEffect(() => { if (acik) { setTur(mevcut?.tur === 2 ? 2 : 1); setDeger(mevcut ? String(mevcut.deger).replace(".", ",") : ""); setNeden(mevcut?.neden || ""); setHata(null); } }, [acik, mevcut]);
  if (!acik) return null;
  const d = paraOku(deger);
  const gecerli = Number.isFinite(d) && d > 0 && (tur === 2 || d <= 100) && neden.trim().length >= 3;
  const calis = async (g: { tur: number; deger?: number; neden?: string }) => { setMesgul(true); setHata(null); try { await onOnay(g); } catch (e: any) { setHata(e?.message || "Yapılamadı."); } finally { setMesgul(false); } };
  const sec: React.CSSProperties = { minHeight: buyuk ? 46 : 38, flex: 1, fontWeight: 600, borderRadius: 8 };
  return (
    <Modal show onHide={kapat} centered fullscreen={buyuk ? "sm-down" : undefined}>
      <Modal.Header closeButton className="py-2"><Modal.Title className="h6 mb-0">Adisyon indirimi</Modal.Title></Modal.Header>
      <Modal.Body>
        <div className="d-flex gap-2 mb-2" role="group" aria-label="İndirim türü">
          <button type="button" aria-pressed={tur === 1} onClick={() => setTur(1)} style={{ ...sec, border: `2px solid ${tur === 1 ? "#0f172a" : "#cbd5e1"}`, background: tur === 1 ? "#0f172a" : "#fff", color: tur === 1 ? "#fff" : "#0f172a" }}>Yüzde (%)</button>
          <button type="button" aria-pressed={tur === 2} onClick={() => setTur(2)} style={{ ...sec, border: `2px solid ${tur === 2 ? "#0f172a" : "#cbd5e1"}`, background: tur === 2 ? "#0f172a" : "#fff", color: tur === 2 ? "#fff" : "#0f172a" }}>Tutar (TL)</button>
        </div>
        <Form.Control autoFocus inputMode="decimal" aria-label={tur === 1 ? "İndirim yüzdesi" : "İndirim tutarı"} className="text-end fw-bold mb-2" style={{ fontSize: 20 }} placeholder={tur === 1 ? "%" : "TL"} value={deger} onChange={(e) => setDeger(e.target.value.replace(/[^0-9.,]/g, ""))} />
        <Form.Label className="small fw-bold mb-1">Neden (zorunlu)</Form.Label>
        <Form.Control aria-label="İndirim nedeni" maxLength={100} placeholder="Örn. müdavim, şikâyet telafisi" value={neden} onChange={(e) => setNeden(e.target.value)} />
        <div className="small text-muted mt-2">İndirim hesabın tamamına (ürünler + servis) uygulanır ve satış fişine iskonto olarak yazılır.</div>
        {hata && <Alert variant="danger" className="py-2 small mt-2 mb-0">{hata}</Alert>}
      </Modal.Body>
      <Modal.Footer className="py-2">
        {mevcut && <Button variant="outline-danger" className="me-auto" disabled={mesgul} onClick={() => void calis({ tur: 0 })}>İndirimi kaldır</Button>}
        <Button variant="outline-secondary" onClick={kapat}>Vazgeç</Button>
        <Button variant="dark" disabled={!gecerli || mesgul} style={{ minHeight: buyuk ? 48 : undefined }} onClick={() => void calis({ tur, deger: Math.round(d * 100) / 100, neden: neden.trim() })}>{mesgul ? <Spinner size="sm" /> : "İndirimi uygula"}</Button>
      </Modal.Footer>
    </Modal>
  );
};

/** Hedef masa seçimi: "bos" yalnız boş masalar (masa taşıma), "dolu" yalnız dolu (birleştirme), "hepsi" (ürün taşıma) */
export const HedefMasaModal: React.FC<{
  acik: boolean; baslik: string; durum: MasaDurumu | null; haric: number | null; tur: "bos" | "dolu" | "hepsi"; buyuk?: boolean;
  onSec: (m: MasaOzeti) => Promise<void>; kapat: () => void;
}> = ({ acik, baslik, durum, haric, tur, buyuk, onSec, kapat }) => {
  const [mesgul, setMesgul] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  useEffect(() => { setHata(null); }, [acik]);
  if (!acik) return null;
  const suzulmus: MasaDurumu | null = durum ? { bolgeler: durum.bolgeler.map((b) => ({ ...b, masalar: b.masalar.filter((m) => m.masaId !== haric && (tur === "hepsi" || (tur === "bos" ? !m.adisyon : !!m.adisyon))) })).filter((b) => b.masalar.length) } : null;
  const sec = async (m: MasaOzeti) => {
    setMesgul(true); setHata(null);
    try { await onSec(m); } catch (e: any) { setHata(e?.message || "Yapılamadı."); } finally { setMesgul(false); }
  };
  return (
    <Modal show onHide={kapat} centered size="lg" fullscreen={buyuk ? "sm-down" : undefined}>
      <Modal.Header closeButton className="py-2"><Modal.Title className="h6 mb-0">{baslik}</Modal.Title></Modal.Header>
      <Modal.Body style={{ opacity: mesgul ? 0.5 : 1, pointerEvents: mesgul ? "none" : undefined }}>
        {hata && <Alert variant="danger" className="py-2 small">{hata}</Alert>}
        {!suzulmus ? <Spinner size="sm" /> : !suzulmus.bolgeler.length ? <div className="text-muted small">{tur === "bos" ? "Boş masa yok." : tur === "dolu" ? "Birleştirilecek başka dolu masa yok." : "Masa yok."}</div> : <MasaIzgarasi durum={suzulmus} bolge="tumu" onSec={(m) => void sec(m)} buyuk={buyuk} />}
      </Modal.Body>
    </Modal>
  );
};
