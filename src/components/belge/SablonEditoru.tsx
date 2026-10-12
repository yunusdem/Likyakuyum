import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { Alert, Badge, Button, ButtonGroup, Dropdown, Form, InputGroup, Spinner } from "react-bootstrap";
import {
  IconArrowBackUp, IconArrowForwardUp, IconCheck, IconCopy, IconDeviceFloppy, IconLock, IconTrash, IconX,
  IconZoomIn, IconZoomOut, IconArrowsMaximize, IconChevronUp, IconChevronDown,
} from "@tabler/icons-react";
import type { BelgeOge, BelgeSablon, Sahne } from "../../../Backend/src/services/belge/sablonCekirdek";
import { BelgeService, type BelgeGorseli, type SablonDenetimHatasi } from "../../services/belgeService";
import { sablonHtml } from "../../utils/belgeSablon/htmlCiz";
import {
  OGE_ADLARI, alanEkle, metindenTablo, ogeBoyutla, ogeGuncelle, ogeKopyala, ogeSil, ogeSirala, ogeTasi, tabloMetni, yeniOge,
  type EklenebilirTip,
} from "../../utils/belgeSablon/editorYardim";

/**
 * Görsel şablon editörü (docs/FIS_TASARIM_YOL_HARITASI.md, 4.4 ve Faz 5).
 * Ortada şablon, örnek veriyle canlı çizilir; üstündeki kutular sürüklenerek taşınır, sağ-alt köşeden boyutlanır.
 * Sağ panel seçili öğenin özellikleri; sol panel öğe ekleme ve kullanılabilir alanlar. Kayıt sunucuda denetlenir
 * (zorunlu öğeler, alan adları); hata varsa kaydedilmez ve hatalı öğe seçilebilir.
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
const sayiOku = (v: string) => { const n = parseFloat(String(v).replace(",", ".")); return Number.isFinite(n) ? n : undefined; };
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
  const [jsonMetni, setJsonMetni] = useState("");
  const [jsonHata, setJsonHata] = useState<string | null>(null);
  const tuval = useRef<HTMLDivElement>(null);
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

  const oge: BelgeOge | null = secili !== null ? (sablon.ogeler[secili] ?? null) : null;
  useEffect(() => { setJsonMetni(oge ? JSON.stringify(oge, null, 2) : ""); setJsonHata(null); }, [oge]);
  useEffect(() => { if (secili !== null && secili >= sablon.ogeler.length) setSecili(null); }, [sablon, secili]);

  const enAlt = useMemo(() => Math.max(0, ...(cizim?.sahne.ogeKutulari || []).filter(k => k.gorunur).map(k => k.y + k.h)), [cizim]);
  const ekle = (tip: EklenebilirTip, gorsel?: string) => {
    const y = kopya(sablon);
    y.ogeler.push(yeniOge(y, tip, enAlt + 6, gorsel));
    degistir(y);
    setSecili(y.ogeler.length - 1);
  };
  const guncelle = (alanlar_: Record<string, unknown>, anahtar?: string) => { if (secili !== null) degistir(ogeGuncelle(sablon, secili, alanlar_), anahtar ? `${secili}:${anahtar}` : undefined); };

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
      if (e.key === "Delete" && !sablon.ogeler[secili]?.zorunlu) { e.preventDefault(); degistir(ogeSil(sablon, secili)); setSecili(null); return; }
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

  // ── Özellik paneli yardımcıları
  const o: any = oge;
  // Düz fonksiyon (bileşen değil): her çizimde yeniden bağlanıp odağı kaybetmesin
  const sayiAlani = (ad: string, etiket: string, adim = 0.5) => (
    <Form.Group className="mb-1" key={ad}>
      <Form.Label className="mb-0" style={{ fontSize: 11 }}>{etiket}</Form.Label>
      <Form.Control size="sm" type="number" step={adim} value={typeof o?.[ad] === "number" ? Math.round(o[ad] * 100) / 100 : ""} onChange={(e) => guncelle({ [ad]: sayiOku(e.target.value) }, ad)} />
    </Form.Group>
  );
  const alanEtiketi = (yol: string) => {
    const v = yol.split(".").reduce<any>((x, k) => (x == null ? undefined : x[k]), alanlar?.ornek);
    return v === undefined || v === null ? "" : typeof v === "object" ? "" : String(v);
  };
  const ara = alanAra.toLocaleLowerCase("tr-TR");
  const gorunenAlanlar = (alanlar?.alanlar || []).filter((a) => !ara || a.toLocaleLowerCase("tr-TR").includes(ara) || (alanlar?.aciklamalar?.[a] || "").toLocaleLowerCase("tr-TR").includes(ara));
  const kutular = cizim?.sahne.ogeKutulari || [];
  const k0 = cizim?.sahne.kenar || 0;

  return (
    <div className="d-flex flex-column" style={{ height: "calc(100vh - 170px)", minHeight: 560 }}>
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
                  {firmaGorselleri.filter((g) => g.tur === (t === "logo" ? "LOGO" : "IMZA")).map((g) => (
                    <Dropdown.Item key={g.id} onClick={() => ekle(t, g.ad)}><img src={g.dataUrl} alt="" style={{ height: 20, maxWidth: 50, objectFit: "contain" }} className="me-2" />{g.ad}</Dropdown.Item>
                  ))}
                  {!firmaGorselleri.some((g) => g.tur === (t === "logo" ? "LOGO" : "IMZA")) && <Dropdown.ItemText className="small text-muted">Önce "Logolar ve İmzalar"dan yükleyin.</Dropdown.ItemText>}
                </Dropdown.Menu>
              </Dropdown>
            ) : (
              <Button key={t} size="sm" variant="outline-primary" className="py-0 px-2" style={{ fontSize: 12 }} onClick={() => ekle(t)}>{OGE_ADLARI[t]}</Button>
            ))}
          </div>
          <div className="fw-bold small mb-1">Alanlar</div>
          <div className="text-muted mb-1" style={{ fontSize: 11 }}>Tıklayınca seçili metne eklenir; seçili metin yoksa yeni metin olarak eklenir.</div>
          <Form.Control size="sm" placeholder="Ara…" value={alanAra} onChange={(e) => setAlanAra(e.target.value)} className="mb-1" />
          <div style={{ fontSize: 11 }}>
            {gorunenAlanlar.map((a) => (
              <div key={a} role="button" className="py-1 border-bottom" title={`{{${a}}}`}
                onClick={() => { const r = alanEkle(sablon, secili, a, enAlt); degistir(r.sablon); setSecili(r.yeni); }}>
                <code style={{ fontSize: 11 }}>{a}</code>
                {alanlar?.aciklamalar?.[a] && <div style={{ fontSize: 10.5 }}>{alanlar.aciklamalar[a]}</div>}
                {alanEtiketi(a) && <div className="text-muted text-truncate">örn. {alanEtiketi(a)}</div>}
              </div>
            ))}
            {alanlar && Object.entries(alanlar.listeler).map(([kaynak, l]) => (
              <div key={kaynak} className="mt-2 text-muted">Liste <code>{kaynak}</code> (yalnız liste öğesinde): {l.map((x) => <code key={x} className="me-1">{x}</code>)}</div>
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
                return (
                  <div key={k.i} title={`${og.ad || OGE_ADLARI[og.tip] || og.tip}${og.id ? ` (${og.id})` : ""}${og.zorunlu ? " · zorunlu" : ""}`}
                    onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); setSecili(k.i); setSurukleme({ i: k.i, mod: "tasi", x0: e.clientX, y0: e.clientY, dx: 0, dy: 0 }); }}
                    style={{
                      position: "absolute", left: `${k0 + k.x + dx}pt`, top: `${k0 + k.y + dy}pt`, width: `${Math.max(2, k.g + dg)}pt`, height: `${Math.max(2, k.h + dh)}pt`,
                      outline: seciliMi ? "1.5px solid #0d6efd" : k.gorunur ? "1px dashed rgba(13,110,253,.35)" : "1px dotted rgba(120,120,120,.6)",
                      background: seciliMi ? "rgba(13,110,253,.06)" : "transparent", cursor: "move", zIndex: seciliMi ? 3 : 2,
                    }}>
                    {og.zorunlu && <IconLock size={9} style={{ position: "absolute", right: 1, top: 1, color: "#b26a00" }} />}
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
        <div className="border-start p-2" style={{ width: 280, minWidth: 280, overflowY: "auto" }}>
          {!o ? (
            <div className="small text-muted">
              Bir öğeyi seçmek için üzerine tıklayın. Sürükleyerek taşıyın, sağ-alt köşeden boyutlandırın.<br /><br />
              Klavye: oklar 0,5 pt (Shift ile 5 pt) kaydırır · Delete siler · Ctrl+D kopyalar · Ctrl+Z / Ctrl+Y geri al / yinele.<br /><br />
              <IconLock size={12} /> işaretli öğeler yasal zorunlu alanlardır: yeri ve boyutu değişir, silinemez.
            </div>
          ) : (
            <>
              <div className="d-flex align-items-center gap-1 mb-2">
                <Badge bg="secondary">{OGE_ADLARI[o.tip] || o.tip}</Badge>
                <span className="small text-truncate">{o.ad || o.id}</span>
                {o.zorunlu && <Badge bg="warning" text="dark" className="ms-auto"><IconLock size={11} /> Zorunlu</Badge>}
              </div>
              <div className="d-flex gap-1 mb-2">
                <Button size="sm" variant="outline-secondary" title="Kopyala (Ctrl+D)" onClick={() => { const r = ogeKopyala(sablon, secili!); degistir(r.sablon); setSecili(r.yeni); }}><IconCopy size={14} /></Button>
                <Button size="sm" variant="outline-secondary" title="Arkaya al" onClick={() => { const r = ogeSirala(sablon, secili!, -1); degistir(r.sablon); setSecili(r.yeni); }}><IconChevronDown size={14} /></Button>
                <Button size="sm" variant="outline-secondary" title="Öne al" onClick={() => { const r = ogeSirala(sablon, secili!, 1); degistir(r.sablon); setSecili(r.yeni); }}><IconChevronUp size={14} /></Button>
                <Button size="sm" variant="outline-danger" className="ms-auto" disabled={!!o.zorunlu} title={o.zorunlu ? "Zorunlu öğe silinemez" : "Sil (Delete)"} onClick={() => { degistir(ogeSil(sablon, secili!)); setSecili(null); }}><IconTrash size={14} /></Button>
              </div>

              {o.tip === "cizgi" ? (
                <div className="d-grid gap-1" style={{ gridTemplateColumns: "1fr 1fr" }}>
                  {sayiAlani("x1", "x1")}{sayiAlani("y1", "y1")}{sayiAlani("x2", "x2")}{sayiAlani("y2", "y2")}
                </div>
              ) : o.tip !== "filigran" && (
                <div className="d-grid gap-1" style={{ gridTemplateColumns: "1fr 1fr" }}>
                  {sayiAlani("x", "Soldan (x, pt)")}{sayiAlani("y", "Üstten (y, pt)")}
                  {o.tip === "qr" ? sayiAlani("boyut", "Kenar (pt)") : sayiAlani("g", "Genişlik (g)")}
                  {["kutu", "resim", "logo", "imza"].includes(o.tip) && sayiAlani("h", "Yükseklik (h)")}
                  {["metin", "satirlar", "tablo", "liste"].includes(o.tip) && sayiAlani("boyut", "Yazı boyutu")}
                  {["tablo", "liste"].includes(o.tip) && sayiAlani("satirH", "Satır yüksekliği")}
                  {(o.tip === "tablo" || (o.tip === "liste" && !o.sutunlar)) && sayiAlani("etiketG", "Etiket genişliği")}
                  {o.tip === "satirlar" && sayiAlani("aralik", "Satır arası")}
                  {["kutu", "cizgi"].includes(o.tip) && sayiAlani("kalinlik", "Çizgi kalınlığı", 0.25)}
                </div>
              )}

              {(o.tip === "metin" || o.tip === "filigran") && (
                <Form.Group className="mt-2">
                  <Form.Label className="mb-0" style={{ fontSize: 11 }}>Yazı (alan: {"{{alan}}"}, kalın: **yazı**)</Form.Label>
                  <Form.Control as="textarea" rows={3} size="sm" value={o.metin ?? ""} onChange={(e) => guncelle({ metin: e.target.value }, "metin")} />
                </Form.Group>
              )}
              {o.tip === "satirlar" && (
                <Form.Group className="mt-2">
                  <Form.Label className="mb-0" style={{ fontSize: 11 }}>Satırlar (her satır ayrı; "?" ile başlayan, alanı boşsa basılmaz)</Form.Label>
                  <Form.Control as="textarea" rows={5} size="sm" value={(o.satirlar || []).join("\n")} onChange={(e) => guncelle({ satirlar: e.target.value.split("\n") }, "satirlar")} />
                </Form.Group>
              )}
              {(o.tip === "tablo" || (o.tip === "liste" && !o.sutunlar)) && (
                <Form.Group className="mt-2">
                  <Form.Label className="mb-0" style={{ fontSize: 11 }}>Satırlar: Etiket | Değer (kalın: | *, koşul: | ?{"{{alan}}"})</Form.Label>
                  <Form.Control as="textarea" rows={5} size="sm" value={tabloMetni(o.satirlar)} onChange={(e) => guncelle({ satirlar: metindenTablo(e.target.value) }, "satirlar")} />
                </Form.Group>
              )}
              {o.tip === "qr" && (
                <Form.Group className="mt-2">
                  <Form.Label className="mb-0" style={{ fontSize: 11 }}>Karekod içeriği</Form.Label>
                  <Form.Control size="sm" value={o.icerik ?? ""} onChange={(e) => guncelle({ icerik: e.target.value }, "icerik")} />
                </Form.Group>
              )}
              {(o.tip === "logo" || o.tip === "imza") && (
                <Form.Group className="mt-2">
                  <Form.Label className="mb-0" style={{ fontSize: 11 }}>Görsel</Form.Label>
                  <Form.Select size="sm" value={o.gorsel ?? ""} onChange={(e) => guncelle({ gorsel: e.target.value })}>
                    {!firmaGorselleri.some((g) => g.ad === o.gorsel) && <option value={o.gorsel}>{o.gorsel || "(seçin)"} — yok</option>}
                    {firmaGorselleri.filter((g) => g.tur === (o.tip === "logo" ? "LOGO" : "IMZA")).map((g) => <option key={g.id} value={g.ad}>{g.ad}</option>)}
                  </Form.Select>
                </Form.Group>
              )}

              {["metin", "satirlar", "tablo", "liste"].includes(o.tip) && (
                <div className="d-flex flex-wrap gap-2 mt-2 align-items-center">
                  {o.tip !== "tablo" && o.tip !== "liste" && (
                    <Form.Check type="checkbox" id="kalin" label="Kalın" checked={!!o.kalin} onChange={(e) => guncelle({ kalin: e.target.checked || undefined })} />
                  )}
                  {o.tip === "metin" && <Form.Check type="checkbox" id="alt" label="Altı çizili" checked={!!o.altCizgi} onChange={(e) => guncelle({ altCizgi: e.target.checked || undefined })} />}
                  {(o.tip === "tablo" || o.tip === "liste") && <Form.Check type="checkbox" id="kd" label="Değerler kalın" checked={!!o.kalinDeger} onChange={(e) => guncelle({ kalinDeger: e.target.checked || undefined })} />}
                  {(o.tip === "tablo" || o.tip === "liste") && <Form.Check type="checkbox" id="cer" label="Hücre çizgisi" checked={(o.cerceve ?? "hucre") === "hucre"} onChange={(e) => guncelle({ cerceve: e.target.checked ? "hucre" : "yok" })} />}
                  <Form.Select size="sm" style={{ width: 110 }} value={(o.tip === "tablo" || o.tip === "liste") ? (o.hizaDeger || "right") : (o.hiza || "left")}
                    onChange={(e) => guncelle(o.tip === "tablo" || o.tip === "liste" ? { hizaDeger: e.target.value } : { hiza: e.target.value })}>
                    <option value="left">Sola</option><option value="center">Ortaya</option><option value="right">Sağa</option>
                  </Form.Select>
                </div>
              )}
              {o.tip === "metin" && (
                <InputGroup size="sm" className="mt-2">
                  <InputGroup.Text style={{ fontSize: 11 }}>Renk</InputGroup.Text>
                  <Form.Control type="color" value={o.renk || "#000000"} onChange={(e) => guncelle({ renk: e.target.value }, "renk")} />
                </InputGroup>
              )}
              {o.tip === "kutu" && (
                <InputGroup size="sm" className="mt-2">
                  <InputGroup.Text style={{ fontSize: 11 }}>Zemin</InputGroup.Text>
                  <Form.Control type="color" value={o.zemin || "#ffffff"} onChange={(e) => guncelle({ zemin: e.target.value }, "zemin")} />
                  <Button variant="outline-secondary" onClick={() => guncelle({ zemin: undefined })}>Yok</Button>
                </InputGroup>
              )}
              {o.tip === "cizgi" && <Form.Check className="mt-2" type="checkbox" id="kes" label="Kesikli" checked={!!o.kesikli} onChange={(e) => guncelle({ kesikli: e.target.checked || undefined })} />}

              <Form.Group className="mt-2">
                <Form.Label className="mb-0" style={{ fontSize: 11 }}>Koşul (alan doluysa basılır; tersi için başına !)</Form.Label>
                <Form.Control size="sm" disabled={!!o.zorunlu} value={o.kosul ?? ""} placeholder="ör. {{ettn}}" onChange={(e) => guncelle({ kosul: e.target.value || undefined }, "kosul")} />
              </Form.Group>
              <Form.Check className="mt-1" type="checkbox" id="dar" label="Boşsa alttakiler yukarı kaysın" checked={!!o.daralt} onChange={(e) => guncelle({ daralt: e.target.checked || undefined })} />

              <details className="mt-3">
                <summary className="small fw-semibold">Gelişmiş (JSON)</summary>
                <Form.Control as="textarea" rows={10} size="sm" className="mt-1 font-monospace" style={{ fontSize: 11 }} value={jsonMetni} onChange={(e) => { setJsonMetni(e.target.value); setJsonHata(null); }} />
                {jsonHata && <div className="text-danger small">{jsonHata}</div>}
                <Button size="sm" className="mt-1" variant="outline-primary" onClick={() => {
                  try {
                    const yeni = JSON.parse(jsonMetni);
                    if (!yeni || typeof yeni !== "object" || Array.isArray(yeni) || typeof yeni.tip !== "string") throw new Error("Öğe { \"tip\": … } biçiminde olmalı.");
                    const y = kopya(sablon); y.ogeler[secili!] = yeni; degistir(y);
                  } catch (err: any) { setJsonHata(err?.message || "JSON okunamadı."); }
                }}>Uygula</Button>
              </details>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
