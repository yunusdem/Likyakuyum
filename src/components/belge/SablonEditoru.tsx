import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { Alert, Badge, Button, ButtonGroup, Dropdown, Form, Spinner } from "react-bootstrap";
import {
  IconAlertTriangle, IconArrowBackUp, IconArrowForwardUp, IconCheck, IconDeviceFloppy, IconUpload, IconX,
  IconZoomIn, IconZoomOut, IconArrowsMaximize,
} from "@tabler/icons-react";
import { ustUsteBinenler, type BelgeSablon, type Sahne } from "../../../Backend/src/services/belge/sablonCekirdek";
import { BelgeService, type BelgeGorseli, type SablonDenetimHatasi } from "../../services/belgeService";
import { sablonHtml } from "../../utils/belgeSablon/htmlCiz";
import {
  OGE_ADLARI, alanEkle, ogeBoyutla, ogeKopyala, ogeSil, ogeTasi, yeniOge,
  type EklenebilirTip,
} from "../../utils/belgeSablon/editorYardim";
import { OzellikPaneli } from "./OzellikPaneli";

/**
 * Görsel şablon editörü (docs/FIS_TASARIM_YOL_HARITASI.md, 4.4 ve Faz 5).
 * Ortada şablon, örnek veriyle canlı çizilir; üstündeki kutular sürüklenerek taşınır, sağ-alt köşeden boyutlanır.
 * Sağ panel seçili öğenin özellikleri; sol panel öğe ekleme ve kullanılabilir alanlar. Kayıt sunucuda denetlenir
 * (yapı ve alan adları; yasal alan kilidi yok — bölüm 11, K12); hata varsa kaydedilmez ve hatalı öğe seçilebilir.
 * Üst üste binen öğeler kırmızı çerçeveyle gösterilir, kayıt engellenmez (K17). Logo / imza düğmesi doğrudan
 * dosya seçtirip yükler (K16).
 */

interface Props {
  tur: string;
  turAdi: string;
  baslangic: BelgeSablon;
  /** Başlangıç şablonu kayıtlı değil (örnekten / dosyadan): ilk açılışta da "kaydedilmedi" sayılır. */
  kayitsizBaslangic?: boolean;
  satim: boolean;
  onKaydedildi: (mesaj: string) => void;
  onKapat: () => void;
}

const PX = 96 / 72; // 1 pt kaç CSS pikseli
const GECMIS_AZAMI = 60;
const kopya = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
const AZAMI_GORSEL = 1024 * 1024;
const EKLENEBILIR: EklenebilirTip[] = ["metin", "satirlar", "tablo", "kutu", "cizgi", "qr", "logo", "imza"];

type Surukleme = { i: number; mod: "tasi" | "boyut"; x0: number; y0: number; dx: number; dy: number };

/** Şablon + geri al / yinele geçmişi (saf; aynı alana 0,9 sn içinde art arda yazım tek adım) */
type Durum = { sablon: BelgeSablon; gecmis: BelgeSablon[]; ileri: BelgeSablon[]; son: { anahtar: string; zaman: number } | null };
type Eylem = { tur: "degistir"; yeni: BelgeSablon; anahtar?: string; zaman: number } | { tur: "geri" } | { tur: "ileri" };
function durumAzalt(d: Durum, e: Eylem): Durum {
  switch (e.tur) {
    case "degistir": {
      if (JSON.stringify(e.yeni) === JSON.stringify(d.sablon)) return d;
      const birlesir = !!e.anahtar && d.son?.anahtar === e.anahtar && e.zaman - d.son.zaman < 900;
      return {
        sablon: e.yeni, ileri: [],
        gecmis: birlesir ? d.gecmis : [...d.gecmis.slice(-(GECMIS_AZAMI - 1)), d.sablon],
        son: e.anahtar ? { anahtar: e.anahtar, zaman: e.zaman } : null,
      };
    }
    case "geri":
      if (!d.gecmis.length) return d;
      return { sablon: d.gecmis[d.gecmis.length - 1], gecmis: d.gecmis.slice(0, -1), ileri: [d.sablon, ...d.ileri], son: null };
    case "ileri":
      if (!d.ileri.length) return d;
      return { sablon: d.ileri[0], gecmis: [...d.gecmis, d.sablon], ileri: d.ileri.slice(1), son: null };
  }
}

export const SablonEditoru: React.FC<Props> = ({ tur, turAdi, baslangic, kayitsizBaslangic, satim, onKaydedildi, onKapat }) => {
  const [durum, gonder] = useReducer(durumAzalt, undefined, () => ({ sablon: kopya(baslangic), gecmis: [], ileri: [], son: null }));
  const { sablon, gecmis, ileri } = durum;
  const [kaydedilen] = useState(() => (kayitsizBaslangic ? "" : JSON.stringify(baslangic)));
  const [secili, setSecili] = useState<number | null>(null);
  const [zoom, setZoom] = useState(1);
  const [veri, setVeri] = useState<Record<string, any> | null>(null);
  const [gorseller, setGorseller] = useState<Record<string, string>>({});
  const [firmaGorselleri, setFirmaGorselleri] = useState<BelgeGorseli[]>([]);
  const [alanlar, setAlanlar] = useState<{ alanlar: string[]; listeler: Record<string, string[]>; ornek: Record<string, any>; aciklamalar?: Record<string, string> } | null>(null);
  const [alanAra, setAlanAra] = useState("");
  const [cizim, setCizim] = useState<{ html: string; sahne: Sahne } | null>(null);
  const [hatalar, setHatalar] = useState<SablonDenetimHatasi[]>([]);
  const [bilgi, setBilgi] = useState<{ type: "success" | "danger" | "info"; message: string } | null>(null);
  const [islem, setIslem] = useState<"kaydet" | "denetle" | null>(null);
  const [surukleme, setSurukleme] = useState<Surukleme | null>(null);
  const tuval = useRef<HTMLDivElement>(null);
  const dosyaGirdisi = useRef<HTMLInputElement>(null);
  const bekleyenYukleme = useRef<{ tur: "LOGO" | "IMZA"; coz: (ad: string | null) => void } | null>(null);
  const suruklemeRef = useRef<Surukleme | null>(null);
  suruklemeRef.current = surukleme;
  const degisti = JSON.stringify(sablon) !== kaydedilen;

  // ── Örnek veri, firma görselleri, alan kataloğu
  useEffect(() => {
    let iptal = false;
    Promise.all([BelgeService.sablonOnizle(tur, { satim }), BelgeService.gorseller().catch(() => [] as BelgeGorseli[]), BelgeService.sablonAlanlari(tur)])
      .then(([o, fg, a]) => {
        if (iptal) return;
        setVeri(o.veri || {});
        const harita: Record<string, string> = { ...(o.gorseller || {}) };
        for (const g of fg) harita[`firma:${g.ad}`] = g.dataUrl;
        setGorseller(harita); setFirmaGorselleri(fg); setAlanlar(a);
      })
      .catch((e: any) => setBilgi({ type: "danger", message: e?.message || "Örnek veri alınamadı." }));
    return () => { iptal = true; };
  }, [tur, satim]);

  // ── Canlı çizim (kısa gecikmeyle)
  useEffect(() => {
    if (!veri) return;
    let iptal = false;
    const t = setTimeout(() => {
      sablonHtml(sablon, veri, gorseller).then((s) => { if (!iptal) setCizim({ html: s.html, sahne: s.sahne }); }).catch(() => undefined);
    }, 80);
    return () => { iptal = true; clearTimeout(t); };
  }, [sablon, veri, gorseller]);

  // ── İlk açılışta sığdır
  const sigdir = useCallback(() => {
    const w = tuval.current?.clientWidth || 600;
    const sayfa = (cizim?.sahne.genislik || 227) * PX;
    setZoom(Math.max(0.3, Math.min(2.5, Math.floor(((w - 32) / sayfa) * 100) / 100)));
  }, [cizim?.sahne.genislik]);
  const ilkSigdirma = useRef(false);
  useEffect(() => { if (cizim && !ilkSigdirma.current) { ilkSigdirma.current = true; sigdir(); } }, [cizim, sigdir]);

  // ── Değişiklik (geçmişe yazar; aynı alana art arda yazım tek adım sayılır)
  const degistir = useCallback((yeni: BelgeSablon, anahtar?: string) => gonder({ tur: "degistir", yeni, anahtar, zaman: Date.now() }), []);
  const geriAl = useCallback(() => gonder({ tur: "geri" }), []);
  const yinele = useCallback(() => gonder({ tur: "ileri" }), []);

  useEffect(() => { if (secili !== null && secili >= sablon.ogeler.length) setSecili(null); }, [sablon, secili]);

  const enAlt = useMemo(() => Math.max(0, ...(cizim?.sahne.ogeKutulari || []).filter(k => k.gorunur).map(k => k.y + k.h)), [cizim]);
  const ekle = (tip: EklenebilirTip, gorsel?: string) => {
    const y = kopya(sablon);
    y.ogeler.push(yeniOge(y, tip, enAlt + 6, gorsel));
    degistir(y);
    setSecili(y.ogeler.length - 1);
  };

  // ── Logo / imza: dosya seçtirip doğrudan yükler (bölüm 11, K16); yüklenen görselin adını döner
  const gorselYukle = (tur: "LOGO" | "IMZA") => new Promise<string | null>((coz) => {
    bekleyenYukleme.current?.coz(null);
    bekleyenYukleme.current = { tur, coz };
    dosyaGirdisi.current?.click();
  });
  const dosyaSecildi = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    const bekleyen = bekleyenYukleme.current;
    bekleyenYukleme.current = null;
    if (!bekleyen) return;
    if (!f) { bekleyen.coz(null); return; }
    if (!/^image\/(png|jpeg)$/.test(f.type) && !/\.(png|jpe?g)$/i.test(f.name)) { setBilgi({ type: "danger", message: "Yalnızca PNG ve JPG görseller yüklenebilir." }); bekleyen.coz(null); return; }
    if (f.size > AZAMI_GORSEL) { setBilgi({ type: "danger", message: "Görsel çok büyük (en çok 1 MB)." }); bekleyen.coz(null); return; }
    const okuyucu = new FileReader();
    okuyucu.onerror = () => { setBilgi({ type: "danger", message: "Dosya okunamadı." }); bekleyen.coz(null); };
    okuyucu.onload = async () => {
      const dataUrl = String(okuyucu.result || "");
      // Ad dosya adından; aynı ad varsa sonuna sayı eklenir
      const kok = (f.name.replace(/\.[^.]+$/, "").replace(/[^\p{L}\p{N} _.-]/gu, " ").replace(/\s+/g, " ").trim() || (bekleyen.tur === "LOGO" ? "Logo" : "Kaşe")).slice(0, 34);
      const adlar = new Set(firmaGorselleri.map((g) => g.ad.toLocaleLowerCase("tr-TR")));
      let ad = /^[\p{L}\p{N}]/u.test(kok) ? kok : `G ${kok}`;
      for (let n = 2; adlar.has(ad.toLocaleLowerCase("tr-TR")); n++) ad = `${kok} ${n}`;
      try {
        const sonuc = await BelgeService.gorselEkle({ ad, tur: bekleyen.tur, dataUrl });
        const yeni: BelgeGorseli = { id: sonuc.id, ad: sonuc.ad || ad, tur: bekleyen.tur, dataUrl } as BelgeGorseli;
        setFirmaGorselleri((l) => [...l, yeni]);
        setGorseller((h) => ({ ...h, [`firma:${yeni.ad}`]: dataUrl }));
        setBilgi({ type: "success", message: `"${yeni.ad}" yüklendi.` });
        bekleyen.coz(yeni.ad);
      } catch (err: any) { setBilgi({ type: "danger", message: err?.message || "Görsel yüklenemedi." }); bekleyen.coz(null); }
    };
    okuyucu.readAsDataURL(f);
  };

  // ── Klavye: oklar (0,5 pt; Shift 5 pt), Delete, Ctrl+Z / Ctrl+Y, Ctrl+D
  useEffect(() => {
    const tus = (e: KeyboardEvent) => {
      const hedef = e.target as HTMLElement;
      if (hedef && (hedef.tagName === "INPUT" || hedef.tagName === "TEXTAREA" || hedef.tagName === "SELECT" || hedef.isContentEditable)) return;
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && e.key.toLowerCase() === "z") { e.preventDefault(); geriAl(); return; }
      if (ctrl && (e.key.toLowerCase() === "y" || (e.shiftKey && e.key.toLowerCase() === "z"))) { e.preventDefault(); yinele(); return; }
      if (secili === null) return;
      const adim = e.shiftKey ? 5 : 0.5;
      const ok: Record<string, [number, number]> = { ArrowLeft: [-adim, 0], ArrowRight: [adim, 0], ArrowUp: [0, -adim], ArrowDown: [0, adim] };
      if (ok[e.key]) { e.preventDefault(); degistir(ogeTasi(sablon, secili, ...ok[e.key]), `${secili}:ok`); return; }
      if (e.key === "Delete") { e.preventDefault(); degistir(ogeSil(sablon, secili)); setSecili(null); return; }
      if (ctrl && e.key.toLowerCase() === "d") { e.preventDefault(); const k = ogeKopyala(sablon, secili); degistir(k.sablon); setSecili(k.yeni); return; }
      if (e.key === "Escape") setSecili(null);
    };
    window.addEventListener("keydown", tus);
    return () => window.removeEventListener("keydown", tus);
  }, [sablon, secili, degistir, geriAl, yinele]);

  // ── Sürükleme
  useEffect(() => {
    if (!surukleme) return;
    const hareket = (e: MouseEvent) => setSurukleme((s) => s && { ...s, dx: (e.clientX - s.x0) / (zoom * PX), dy: (e.clientY - s.y0) / (zoom * PX) });
    const birak = () => {
      const s = suruklemeRef.current;
      if (s && (Math.abs(s.dx) >= 0.25 || Math.abs(s.dy) >= 0.25)) {
        degistir(s.mod === "tasi" ? ogeTasi(sablon, s.i, s.dx, s.dy) : ogeBoyutla(sablon, s.i, s.dx, s.dy));
      }
      setSurukleme(null);
    };
    window.addEventListener("mousemove", hareket);
    window.addEventListener("mouseup", birak);
    return () => { window.removeEventListener("mousemove", hareket); window.removeEventListener("mouseup", birak); };
  }, [surukleme, zoom, sablon, degistir]);

  // ── Kaydet / denetle
  const hataOgesi = (h: SablonDenetimHatasi) => (h.oge ? sablon.ogeler.findIndex((o) => o.id === h.oge) : -1);
  const denetle = async () => {
    setIslem("denetle"); setBilgi(null);
    try {
      const d = await BelgeService.sablonDenetle(tur, { sablon });
      setHatalar(d.hatalar || []);
      setBilgi(d.gecerli ? { type: "success", message: "Şablon geçerli; kaydedilebilir." } : { type: "danger", message: `${d.hatalar.length} hata var.` });
    } catch (e: any) { setBilgi({ type: "danger", message: e?.message || "Denetlenemedi." }); }
    finally { setIslem(null); }
  };
  const kaydet = async () => {
    if (binenler.size && !window.confirm(`${binenler.size} öğe üst üste geliyor (kırmızı çerçeveli); basılınca yazılar karışabilir. Yine de kaydedilsin mi?`)) return;
    setIslem("kaydet"); setBilgi(null);
    try {
      await BelgeService.sablonKaydet(tur, { sablon });
      setHatalar([]);
      onKaydedildi(`${turAdi} kaydedildi; fişler artık bu düzenle basılacak.`);
    } catch (e: any) {
      const h: SablonDenetimHatasi[] = e?.ayrinti?.hatalar || [];
      setHatalar(h);
      setBilgi({ type: "danger", message: h.length ? `Kaydedilmedi: ${h.length} hata. Hataya tıklayınca ilgili öğe seçilir.` : e?.message || "Kaydedilemedi." });
    } finally { setIslem(null); }
  };
  const kapat = () => { if (!degisti || window.confirm("Kaydedilmemiş değişiklikler kaybolacak. Çıkılsın mı?")) onKapat(); };

  const alanEtiketi = (yol: string) => {
    const v = yol.split(".").reduce<any>((x, k) => (x == null ? undefined : x[k]), alanlar?.ornek);
    return v === undefined || v === null ? "" : typeof v === "object" ? "" : String(v);
  };
  const ara = alanAra.toLocaleLowerCase("tr-TR");
  const gorunenAlanlar = (alanlar?.alanlar || []).filter((a) => !ara || a.toLocaleLowerCase("tr-TR").includes(ara) || (alanlar?.aciklamalar?.[a] || "").toLocaleLowerCase("tr-TR").includes(ara));
  const kutular = cizim?.sahne.ogeKutulari || [];
  // Üst üste binen öğeler (kırmızı çerçeve, kaydı engellemez — K17)
  const ciftler = useMemo(() => (cizim ? ustUsteBinenler(cizim.sahne) : []), [cizim]);
  const binenler = useMemo(() => new Set(ciftler.flat()), [ciftler]);
  const ogeAdi = (i: number) => { const x: any = sablon.ogeler[i]; return x ? x.ad || x.id || OGE_ADLARI[x.tip] || x.tip : ""; };
  const k0 = cizim?.sahne.kenar || 0;

  return (
    <div className="d-flex flex-column" style={{ height: "calc(100vh - 170px)", minHeight: 560 }}>
      <input ref={dosyaGirdisi} type="file" accept="image/png,image/jpeg" className="d-none" onChange={dosyaSecildi} />
      {/* Araç çubuğu */}
      <div className="d-flex flex-wrap align-items-center gap-2 p-2 border-bottom bg-light">
        <div className="fw-bold small me-2">Düzenleniyor: {turAdi}{degisti && <Badge bg="warning" text="dark" className="ms-2">Kaydedilmedi</Badge>}</div>
        <ButtonGroup size="sm">
          <Button variant="outline-secondary" title="Geri al (Ctrl+Z)" disabled={!gecmis.length} onClick={geriAl}><IconArrowBackUp size={15} /></Button>
          <Button variant="outline-secondary" title="Yinele (Ctrl+Y)" disabled={!ileri.length} onClick={yinele}><IconArrowForwardUp size={15} /></Button>
        </ButtonGroup>
        <ButtonGroup size="sm">
          <Button variant="outline-secondary" title="Uzaklaştır" onClick={() => setZoom((z) => Math.max(0.3, +(z - 0.1).toFixed(2)))}><IconZoomOut size={15} /></Button>
          <Button variant="outline-secondary" disabled style={{ minWidth: 54 }}>{Math.round(zoom * 100)}%</Button>
          <Button variant="outline-secondary" title="Yakınlaştır" onClick={() => setZoom((z) => Math.min(3, +(z + 0.1).toFixed(2)))}><IconZoomIn size={15} /></Button>
          <Button variant="outline-secondary" title="Sığdır" onClick={sigdir}><IconArrowsMaximize size={15} /></Button>
        </ButtonGroup>
        <div className="ms-auto d-flex gap-2">
          <Button size="sm" variant="outline-primary" disabled={!!islem} onClick={() => void denetle()}>
            {islem === "denetle" ? <Spinner size="sm" className="me-1" /> : <IconCheck size={15} className="me-1" />}Denetle
          </Button>
          <Button size="sm" variant="success" disabled={!!islem || !degisti} onClick={() => void kaydet()}>
            {islem === "kaydet" ? <Spinner size="sm" className="me-1" /> : <IconDeviceFloppy size={15} className="me-1" />}Kaydet
          </Button>
          <Button size="sm" variant="outline-secondary" disabled={!!islem} onClick={kapat}><IconX size={15} className="me-1" />Kapat</Button>
        </div>
      </div>
      {bilgi && <Alert variant={bilgi.type} dismissible onClose={() => setBilgi(null)} className="m-2 mb-0 py-1 small">{bilgi.message}</Alert>}
      {ciftler.length > 0 && (
        <div className="mx-2 mt-2 px-2 py-1 border border-danger rounded small text-danger d-flex flex-wrap gap-2 align-items-center" style={{ background: "#fff5f5" }}>
          <IconAlertTriangle size={15} /> Üst üste gelen yerler var (kırmızı çerçeveli). Kayıt yapılabilir ama basılınca yazılar karışabilir:
          {ciftler.slice(0, 6).map(([a, b]) => (
            <span key={`${a}-${b}`} role="button" className="text-decoration-underline" onClick={() => setSecili(a)}>{ogeAdi(a)} ↔ {ogeAdi(b)}</span>
          ))}
          {ciftler.length > 6 && <span>… (+{ciftler.length - 6})</span>}
        </div>
      )}
      {hatalar.length > 0 && (
        <div className="mx-2 mt-2 p-2 border border-danger rounded small" style={{ maxHeight: 120, overflowY: "auto", background: "#fff5f5" }}>
          {hatalar.map((h, n) => (
            <div key={n} role="button" className="text-danger" onClick={() => { const i = hataOgesi(h); if (i >= 0) setSecili(i); }}>
              • {h.oge ? <b>{h.oge}{h.alan ? ` › ${h.alan}` : ""}: </b> : null}{h.mesaj}
            </div>
          ))}
        </div>
      )}

      <div className="d-flex flex-grow-1" style={{ minHeight: 0 }}>
        {/* Sol: ekle + alanlar */}
        <div className="border-end p-2 d-flex flex-column" style={{ width: 220, minWidth: 220, overflowY: "auto" }}>
          <div className="fw-bold small mb-1">Öğe ekle</div>
          <div className="d-flex flex-wrap gap-1 mb-3">
            {EKLENEBILIR.map((t) => (t === "logo" || t === "imza") ? (
              <Dropdown key={t}>
                <Dropdown.Toggle size="sm" variant="outline-primary" className="py-0 px-2" style={{ fontSize: 12 }}>{OGE_ADLARI[t]}</Dropdown.Toggle>
                <Dropdown.Menu>
                  <Dropdown.Item onClick={async () => { const ad = await gorselYukle(t === "logo" ? "LOGO" : "IMZA"); if (ad) ekle(t, ad); }}>
                    <IconUpload size={14} className="me-2" />Bilgisayardan yükle…
                  </Dropdown.Item>
                  {firmaGorselleri.some((g) => g.tur === (t === "logo" ? "LOGO" : "IMZA")) && <Dropdown.Divider />}
                  {firmaGorselleri.filter((g) => g.tur === (t === "logo" ? "LOGO" : "IMZA")).map((g) => (
                    <Dropdown.Item key={g.id} onClick={() => ekle(t, g.ad)}><img src={g.dataUrl} alt="" style={{ height: 20, maxWidth: 50, objectFit: "contain" }} className="me-2" />{g.ad}</Dropdown.Item>
                  ))}
                </Dropdown.Menu>
              </Dropdown>
            ) : (
              <Button key={t} size="sm" variant="outline-primary" className="py-0 px-2" style={{ fontSize: 12 }} onClick={() => ekle(t)}>{OGE_ADLARI[t]}</Button>
            ))}
          </div>
          <div className="fw-bold small mb-1">Fişin bilgileri</div>
          <div className="text-muted mb-1" style={{ fontSize: 11 }}>Tıklayınca seçili yazının sonuna eklenir; seçili yazı yoksa fişin altına yeni yazı olarak eklenir.</div>
          <Form.Control size="sm" placeholder="Ara…" value={alanAra} onChange={(e) => setAlanAra(e.target.value)} className="mb-1" />
          <div style={{ fontSize: 11 }}>
            {gorunenAlanlar.map((a) => (
              <div key={a} role="button" className="py-1 border-bottom" title={`{{${a}}}`}
                onClick={() => { const r = alanEkle(sablon, secili, a, enAlt); degistir(r.sablon); setSecili(r.yeni); }}>
                <div className="fw-semibold">{alanlar?.aciklamalar?.[a] || a}</div>
                {alanEtiketi(a) && <div className="text-muted text-truncate">örn. {alanEtiketi(a)}</div>}
              </div>
            ))}
            {alanlar && Object.entries(alanlar.listeler).map(([kaynak, l]) => (
              <div key={kaynak} className="mt-2 text-muted">Satır bilgileri (ürün / döviz listesi seçiliyken sağ panelde, "Bilgi" kutusunda çıkar): {l.map((x) => alanlar?.aciklamalar?.[x] || x).join(", ")}</div>
            ))}
          </div>
        </div>

        {/* Orta: tuval */}
        <div ref={tuval} className="flex-grow-1 p-3" style={{ background: "#525659", overflow: "auto" }} onMouseDown={(e) => { if (e.target === e.currentTarget) setSecili(null); }}>
          {!cizim ? (
            <div className="text-white-50 small d-flex align-items-center gap-2 justify-content-center py-5"><Spinner size="sm" /> Hazırlanıyor…</div>
          ) : (
            <div style={{ zoom, width: "fit-content", margin: "0 auto", position: "relative", boxShadow: "0 4px 15px rgba(0,0,0,.35)", userSelect: "none" }}>
              <div dangerouslySetInnerHTML={{ __html: cizim.html }} />
              {kutular.map((k) => {
                const og = sablon.ogeler[k.i];
                if (!og || og.tip === "filigran") return null;
                const s = surukleme?.i === k.i ? surukleme : null;
                const dx = s?.mod === "tasi" ? s.dx : 0, dy = s?.mod === "tasi" ? s.dy : 0;
                const dg = s?.mod === "boyut" ? s.dx : 0, dh = s?.mod === "boyut" ? s.dy : 0;
                const seciliMi = secili === k.i;
                const binen = binenler.has(k.i);
                return (
                  <div key={k.i} title={`${og.ad || OGE_ADLARI[og.tip] || og.tip}${og.id ? ` (${og.id})` : ""}`}
                    onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); setSecili(k.i); setSurukleme({ i: k.i, mod: "tasi", x0: e.clientX, y0: e.clientY, dx: 0, dy: 0 }); }}
                    style={{
                      position: "absolute", left: `${k0 + k.x + dx}pt`, top: `${k0 + k.y + dy}pt`, width: `${Math.max(2, k.g + dg)}pt`, height: `${Math.max(2, k.h + dh)}pt`,
                      outline: seciliMi ? "1.5px solid #0d6efd" : binen ? "1.5px solid #dc3545" : k.gorunur ? "1px dashed rgba(13,110,253,.35)" : "1px dotted rgba(120,120,120,.6)",
                      background: seciliMi ? "rgba(13,110,253,.06)" : binen ? "rgba(220,53,69,.08)" : "transparent", cursor: "move", zIndex: seciliMi ? 3 : 2,
                    }}>
                    {seciliMi && (
                      <div title="Boyutlandır" onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); setSurukleme({ i: k.i, mod: "boyut", x0: e.clientX, y0: e.clientY, dx: 0, dy: 0 }); }}
                        style={{ position: "absolute", right: -4, bottom: -4, width: 8, height: 8, background: "#0d6efd", cursor: "nwse-resize" }} />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Sağ: özellikler */}
        <div className="border-start p-2" style={{ width: 310, minWidth: 310, overflowY: "auto" }}>
          {secili === null || !sablon.ogeler[secili] ? (
            <div className="small text-muted">
              Değiştirmek istediğiniz yerin üzerine tıklayın; özellikleri burada açılır.<br /><br />
              Taşımak için sürükleyin, boyutunu sağ-alt köşedeki mavi kareden değiştirin.<br /><br />
              Klavye: oklar az kaydırır (Shift ile daha çok) · Delete siler · Ctrl+D kopyalar · Ctrl+Z / Ctrl+Y geri al / yinele.
            </div>
          ) : (
            <OzellikPaneli sablon={sablon} secili={secili} katalog={alanlar} firmaGorselleri={firmaGorselleri}
              degistir={degistir} setSecili={setSecili} gorselYukle={gorselYukle} />
          )}
        </div>
      </div>
    </div>
  );
};
