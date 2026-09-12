import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Badge, Button, Card, Col, Form, Row, Spinner, Table } from "react-bootstrap";
import { useParams } from "react-router-dom";
import { IconDownload, IconFileSpreadsheet, IconFileTypePdf, IconPrinter, IconReportAnalytics, IconSearch, IconX } from "@tabler/icons-react";
import ERPToolbar from "components/common/ERPToolbar";
import { CashDeskService, type VezneItem } from "../../services/cashDeskService";
import { ProductDefinitionService, type ProductItem } from "../../services/productDefinitionService";
import { CariService, type CariKartItem } from "../../services/cariService";
import {
  RAPOR_MENU, RaporService, raporBicimle, raporSayisalMi,
  type RaporParametre, type RaporParametreDegerleri, type RaporTanim, type RaporVeri,
} from "../../services/raporService";

/**
 * Tek rapor sayfası (G- Raporlar altındaki 9 rapor): /raporlar/:yol
 * Sunucudan gelen rapor tanımına göre üstte parametre şeridi, altta grid; PDF önizleme (A4),
 * PDF/Excel indir, yazdır. Bkz. docs/raporlar.md.
 */

const gun = (kaydir = 0) => { const d = new Date(); d.setDate(d.getDate() + kaydir);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit" }).format(d); };
const varsayilanDeger = (v?: string | number | null): string => {
  if (v === "bugun") return gun(0);
  if (typeof v === "string" && /^-\d+g$/.test(v)) return gun(-Number(v.slice(1, -1)));
  return v === null || v === undefined ? "" : String(v);
};

/** Tanımdaki parametrelerden başlangıç değerleri (tarihAralik → baslangic+bitis, saatAralik → baslangicSaat+bitisSaat, kurSecimi → kurTuru+kurTarihi+kurAlani) */
function baslangicDegerleri(parametreler: RaporParametre[]): RaporParametreDegerleri {
  const d: RaporParametreDegerleri = {};
  for (const p of parametreler) {
    switch (p.tip) {
      case "tarihAralik": d.baslangic = varsayilanDeger(p.varsayilan ?? "-30g"); d.bitis = gun(0); break;
      case "saatAralik": d.baslangicSaat = "00:00"; d.bitisSaat = "23:59"; break;
      case "kurSecimi": d.kurTuru = 0; d.kurTarihi = gun(0); d.kurAlani = "alis"; break;
      case "tarih": d[p.ad] = varsayilanDeger(p.varsayilan ?? "bugun"); break;
      default: d[p.ad] = varsayilanDeger(p.varsayilan);
    }
  }
  return d;
}

export const RaporPage: React.FC = () => {
  const { yol } = useParams<{ yol: string }>();
  const menu = useMemo(() => RAPOR_MENU.find(m => m.yol === yol), [yol]);
  const kod = menu?.kod;

  const [tanim, setTanim] = useState<RaporTanim | null>(null);
  const [degerler, setDegerler] = useState<RaporParametreDegerleri>({});
  const [veri, setVeri] = useState<RaporVeri | null>(null);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [dosyaIsi, setDosyaIsi] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [vezneler, setVezneler] = useState<VezneItem[]>([]);
  const [paralar, setParalar] = useState<ProductItem[]>([]);
  const [cariler, setCariler] = useState<CariKartItem[]>([]);
  const istekNo = useRef(0);

  useEffect(() => () => { if (pdfUrl) URL.revokeObjectURL(pdfUrl); }, [pdfUrl]);

  // Tanım + arama listeleri
  useEffect(() => {
    if (!kod) return;
    setTanim(null); setVeri(null); setPdfUrl(null); setHata(null);
    RaporService.tanim(kod).then(t => { setTanim(t); setDegerler(baslangicDegerleri(t.parametreler)); })
      .catch(e => setHata(e?.message || "Rapor tanımı alınamadı."));
    const tipler = new Set<string>();
    RaporService.tanim(kod).then(t => {
      t.parametreler.forEach(p => tipler.add(p.tip));
      if (tipler.has("vezne")) CashDeskService.getVezneler().then(setVezneler).catch(() => setVezneler([]));
      if (tipler.has("para")) ProductDefinitionService.getProducts().then(setParalar).catch(() => setParalar([]));
      if (tipler.has("cari")) CariService.getCariKartlar().then(setCariler).catch(() => setCariler([]));
    }).catch(() => undefined);
  }, [kod]);

  const zorunluEksik = useMemo(() => {
    if (!tanim) return null;
    for (const p of tanim.parametreler) {
      if (!p.zorunlu) continue;
      if (p.tip === "tarihAralik" && (!degerler.baslangic || !degerler.bitis)) return "Tarih aralığı zorunludur.";
      if (p.tip !== "tarihAralik" && p.tip !== "saatAralik" && p.tip !== "kurSecimi" && !degerler[p.ad]) return `${p.etiket} zorunludur.`;
    }
    if (degerler.baslangic && degerler.bitis && String(degerler.baslangic) > String(degerler.bitis)) return "Başlangıç tarihi bitişten sonra olamaz.";
    return null;
  }, [tanim, degerler]);

  const listele = useCallback(async () => {
    if (!kod || !tanim) return;
    if (zorunluEksik) { setHata(zorunluEksik); return; }
    const id = ++istekNo.current;
    setYukleniyor(true); setHata(null);
    try {
      const v = await RaporService.veri(kod, degerler);
      if (id !== istekNo.current) return;
      setVeri(v);
      if (v.sinirAsildi) setHata(`Rapor ${v.toplamKayit.toLocaleString("tr-TR")} satır üretiyor; üst sınır ${(v.tanim.ustSinir || 5000).toLocaleString("tr-TR")}. Tarih aralığını daraltın.`);
    } catch (e: any) { if (id === istekNo.current) { setVeri(null); setHata(e?.message || "Rapor alınamadı."); } }
    finally { if (id === istekNo.current) setYukleniyor(false); }
  }, [kod, tanim, degerler, zorunluEksik]);

  // Tanım gelince zorunlu parametreler doluysa otomatik listele
  useEffect(() => { if (tanim && !zorunluEksik) void listele(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tanim]);

  const pdfOnizle = async () => {
    if (!kod) return; if (zorunluEksik) { setHata(zorunluEksik); return; }
    setDosyaIsi(true); setHata(null);
    try { const url = await RaporService.pdfBlobUrl(kod, degerler); setPdfUrl(o => { if (o) URL.revokeObjectURL(o); return url; }); }
    catch (e: any) { setHata(e?.message || "PDF üretilemedi."); }
    finally { setDosyaIsi(false); }
  };
  const pdfIndir = async () => { if (!kod) return; setDosyaIsi(true); setHata(null);
    try { await RaporService.pdfIndir(kod, degerler, kod); } catch (e: any) { setHata(e?.message || "PDF indirilemedi."); } finally { setDosyaIsi(false); } };
  const excelIndir = async () => { if (!kod) return; setDosyaIsi(true); setHata(null);
    try { await RaporService.excelIndir(kod, degerler, kod); } catch (e: any) { setHata(e?.message || "Excel indirilemedi."); } finally { setDosyaIsi(false); } };
  const yazdir = async () => {
    if (!kod) return; setDosyaIsi(true); setHata(null);
    try {
      const url = await RaporService.pdfBlobUrl(kod, degerler);
      const f = document.createElement("iframe");
      f.style.position = "fixed"; f.style.right = "0"; f.style.bottom = "0"; f.style.width = "0"; f.style.height = "0"; f.style.border = "0";
      f.src = url;
      f.onload = () => { try { f.contentWindow?.focus(); f.contentWindow?.print(); } catch { window.open(url, "_blank", "noopener"); } setTimeout(() => { URL.revokeObjectURL(url); f.remove(); }, 60000); };
      document.body.appendChild(f);
    } catch (e: any) { setHata(e?.message || "Yazdırma çıktısı alınamadı."); }
    finally { setDosyaIsi(false); }
  };
  const temizle = () => { if (tanim) { setDegerler(baslangicDegerleri(tanim.parametreler)); setVeri(null); setPdfUrl(null); setHata(null); } };
  const set = (ad: string, v: string | number) => setDegerler(o => ({ ...o, [ad]: v }));

  const alan = (p: RaporParametre) => {
    const etiket = <Form.Label className="small fw-semibold text-secondary mb-1">{p.etiket}{p.zorunlu && <span className="text-danger"> *</span>}</Form.Label>;
    switch (p.tip) {
      case "tarih": return <Col md={2} key={p.ad}>{etiket}<Form.Control size="sm" type="date" value={String(degerler[p.ad] ?? "")} onChange={e => set(p.ad, e.target.value)} /></Col>;
      case "tarihAralik": return <React.Fragment key={p.ad}>
        <Col md={2}>{etiket}<Form.Control size="sm" type="date" value={String(degerler.baslangic ?? "")} onChange={e => set("baslangic", e.target.value)} /></Col>
        <Col md={2}><Form.Label className="small fw-semibold text-secondary mb-1">Bitiş</Form.Label><Form.Control size="sm" type="date" value={String(degerler.bitis ?? "")} onChange={e => set("bitis", e.target.value)} /></Col>
      </React.Fragment>;
      case "saatAralik": return <React.Fragment key={p.ad}>
        <Col md={1}>{etiket}<Form.Control size="sm" type="time" value={String(degerler.baslangicSaat ?? "00:00")} onChange={e => set("baslangicSaat", e.target.value)} /></Col>
        <Col md={1}><Form.Label className="small fw-semibold text-secondary mb-1">Bitiş saat</Form.Label><Form.Control size="sm" type="time" value={String(degerler.bitisSaat ?? "23:59")} onChange={e => set("bitisSaat", e.target.value)} /></Col>
      </React.Fragment>;
      case "vezne": return <Col md={2} key={p.ad}>{etiket}<Form.Select size="sm" value={String(degerler[p.ad] ?? "")} onChange={e => set(p.ad, e.target.value)}>
        <option value="">Tüm vezneler</option>{vezneler.map(v => <option key={v.id} value={v.id}>{v.kod} — {v.ad}</option>)}</Form.Select></Col>;
      case "para": return <Col md={2} key={p.ad}>{etiket}<Form.Select size="sm" value={String(degerler[p.ad] ?? "")} onChange={e => set(p.ad, e.target.value)}>
        <option value="">Tüm paralar</option>{paralar.map(v => <option key={v.id} value={v.id}>{v.kod} — {v.ad}</option>)}</Form.Select></Col>;
      case "cari": return <Col md={3} key={p.ad}>{etiket}<Form.Select size="sm" value={String(degerler[p.ad] ?? "")} onChange={e => set(p.ad, e.target.value)}>
        <option value="">{p.zorunlu ? "Cari seçin…" : "Tüm cariler"}</option>{cariler.map(v => <option key={v.id} value={v.id}>{v.kod} — {v.ad}</option>)}</Form.Select></Col>;
      case "fisTipi": return <Col md={1} key={p.ad}>{etiket}<Form.Select size="sm" value={String(degerler[p.ad] ?? "")} onChange={e => set(p.ad, e.target.value)}>
        <option value="">Tümü</option><option value="0">Alış</option><option value="1">Satış</option></Form.Select></Col>;
      case "kurSecimi": return <React.Fragment key={p.ad}>
        <Col md={2}>{etiket}<Form.Select size="sm" value={String(degerler.kurTuru ?? 0)} onChange={e => set("kurTuru", Number(e.target.value))}>
          <option value={0}>Anlık gişe kuru</option><option value={2}>Saklanan kur (tarihli)</option></Form.Select></Col>
        {Number(degerler.kurTuru) === 2 && <Col md={2}><Form.Label className="small fw-semibold text-secondary mb-1">Kur tarihi</Form.Label>
          <Form.Control size="sm" type="date" value={String(degerler.kurTarihi ?? "")} onChange={e => set("kurTarihi", e.target.value)} /></Col>}
        <Col md={1}><Form.Label className="small fw-semibold text-secondary mb-1">Alan</Form.Label><Form.Select size="sm" value={String(degerler.kurAlani ?? "alis")} onChange={e => set("kurAlani", e.target.value)}>
          <option value="alis">Alış</option><option value="satis">Satış</option></Form.Select></Col>
      </React.Fragment>;
      case "kmt": return <Col md={2} key={p.ad}>{etiket}<Form.Select size="sm" value={String(degerler[p.ad] ?? "")} onChange={e => set(p.ad, e.target.value)}>
        <option value="">Kur + Miktar + TL</option><option value="K">Kur</option><option value="M">Miktar</option><option value="T">TL</option></Form.Select></Col>;
      default: return <Col md={3} key={p.ad}>{etiket}<Form.Control size="sm" value={String(degerler[p.ad] ?? "")} onChange={e => set(p.ad, e.target.value)} /></Col>;
    }
  };

  // Grid: grup başlıkları + ara toplam + genel toplam (PDF ile aynı mantık)
  const gridSatirlari = useMemo(() => {
    if (!veri || !tanim) return [] as { tur: "grup" | "satir" | "araToplam" | "toplam"; satir: Record<string, any>; etiket?: string }[];
    const kolonlar = tanim.kolonlar, toplamli = kolonlar.some(k => k.toplam);
    const toplam = (s: Record<string, any>[]) => { const t: Record<string, any> = {}; for (const k of kolonlar) if (k.toplam) t[k.anahtar] = s.reduce((a, r) => a + (Number(r[k.anahtar]) || 0), 0); return t; };
    const cikti: { tur: "grup" | "satir" | "araToplam" | "toplam"; satir: Record<string, any>; etiket?: string }[] = [];
    if (tanim.grup) {
      let i = 0; const g = tanim.grup;
      while (i < veri.satirlar.length) {
        const a = veri.satirlar[i][g.anahtar]; const uyeler: Record<string, any>[] = [];
        while (i < veri.satirlar.length && veri.satirlar[i][g.anahtar] === a) uyeler.push(veri.satirlar[i++]);
        cikti.push({ tur: "grup", satir: uyeler[0], etiket: g.baslik.replace(/\{\{\s*([\w.]+)\s*(?:\|\w+)?\s*\}\}/g, (_m, yol) => String(uyeler[0][yol] ?? "")) });
        for (const s of uyeler) cikti.push({ tur: "satir", satir: s });
        if (g.altToplam !== false && toplamli) cikti.push({ tur: "araToplam", satir: toplam(uyeler), etiket: `Ara toplam (${uyeler.length})` });
      }
    } else for (const s of veri.satirlar) cikti.push({ tur: "satir", satir: s });
    if (toplamli && veri.satirlar.length) cikti.push({ tur: "toplam", satir: toplam(veri.satirlar), etiket: `GENEL TOPLAM (${veri.satirlar.length})` });
    return cikti;
  }, [veri, tanim]);

  if (!menu) return <div className="container-fluid py-3"><Alert variant="warning">Rapor bulunamadı: {yol}</Alert></div>;

  return (
    <div className="container-fluid py-2 px-3">
      <ERPToolbar
        pageTitle={menu.ad}
        pageIcon={<IconReportAnalytics size={20} />}
        onSearch={listele}
        onRefresh={listele}
        onClear={temizle}
        onPrint={veri && !veri.sinirAsildi ? yazdir : undefined}
        hideDelete
        disabled={yukleniyor || dosyaIsi || !tanim}
        rightContent={<span className="text-muted text-nowrap d-none d-md-inline" style={{ fontSize: "0.78rem" }}>
          {tanim ? `${tanim.kagit === "A4-yatay" ? "A4 yatay" : "A4 dikey"} · ${veri ? `${veri.toplamKayit.toLocaleString("tr-TR")} kayıt` : "—"}` : "Tanım yükleniyor…"}
        </span>}
      />

      {hata && <Alert variant={veri?.sinirAsildi ? "warning" : "danger"} dismissible onClose={() => setHata(null)} className="py-2 mt-2">{hata}</Alert>}
      {tanim?.aciklama && <div className="text-muted small mt-2">{tanim.aciklama}</div>}

      <Card className="shadow-sm border-0 my-2">
        <Card.Body className="p-3">
          {!tanim ? <Spinner size="sm" animation="border" /> : (
            <Form onSubmit={e => { e.preventDefault(); void listele(); }}>
              <fieldset disabled={yukleniyor || dosyaIsi}>
                <Row className="g-2 align-items-end">
                  {tanim.parametreler.map(alan)}
                  <Col md="auto" className="d-flex gap-1 ms-auto">
                    <Button type="submit" size="sm" variant="primary" title="Listele"><IconSearch size={15} /> Listele</Button>
                    <Button size="sm" variant="outline-danger" onClick={pdfOnizle} disabled={!veri || veri.sinirAsildi} title="A4 PDF önizleme"><IconFileTypePdf size={15} /> PDF</Button>
                    <Button size="sm" variant="outline-primary" onClick={pdfIndir} disabled={!veri || veri.sinirAsildi} title="PDF indir"><IconDownload size={15} /></Button>
                    <Button size="sm" variant="outline-success" onClick={excelIndir} disabled={!veri || veri.sinirAsildi} title="Excel indir"><IconFileSpreadsheet size={15} /> Excel</Button>
                    <Button size="sm" variant="outline-secondary" onClick={yazdir} disabled={!veri || veri.sinirAsildi} title="Yazdır"><IconPrinter size={15} /></Button>
                  </Col>
                </Row>
              </fieldset>
            </Form>
          )}
        </Card.Body>
      </Card>

      <Row className="g-3">
        <Col xl={pdfUrl ? 6 : 12}>
          <Card className="shadow-sm border-0">
            <Card.Body className="p-0">
              {veri?.filtreOzeti && <div className="px-3 py-2 small text-muted border-bottom">{veri.filtreOzeti}</div>}
              <div className="table-responsive" style={{ maxHeight: "68vh" }}>
                <Table hover size="sm" className="mb-0 align-middle" style={{ fontSize: "0.82rem" }}>
                  <thead className="table-light sticky-top"><tr>
                    {tanim?.kolonlar.map(k => <th key={k.anahtar} className={k.hiza === "center" ? "text-center" : raporSayisalMi(k.bicim) || k.hiza === "right" ? "text-end" : ""}>{k.baslik}</th>)}
                  </tr></thead>
                  <tbody>
                    {gridSatirlari.map((g, i) => {
                      if (g.tur === "grup") return <tr key={i} className="table-secondary"><td colSpan={tanim!.kolonlar.length} className="fw-bold">{g.etiket}</td></tr>;
                      const kalin = g.tur !== "satir";
                      return <tr key={i} className={g.tur === "toplam" ? "table-primary fw-bold" : g.tur === "araToplam" ? "table-light fw-semibold" : undefined}>
                        {tanim!.kolonlar.map((k, ki) => {
                          const v = g.satir[k.anahtar];
                          const metin = kalin && !k.toplam ? (ki === 0 || (!raporSayisalMi(k.bicim) && !tanim!.kolonlar.slice(0, ki).some(x => !raporSayisalMi(x.bicim))) ? g.etiket : "") : raporBicimle(v, k.bicim);
                          return <td key={k.anahtar} className={`${k.hiza === "center" ? "text-center" : raporSayisalMi(k.bicim) || k.hiza === "right" ? "text-end text-nowrap" : ""}`}>{metin}</td>;
                        })}
                      </tr>;
                    })}
                    {!gridSatirlari.length && <tr><td colSpan={tanim?.kolonlar.length || 1} className="text-center text-muted py-4">
                      {yukleniyor ? <><Spinner size="sm" animation="border" /> Yükleniyor…</> : veri ? "Seçilen ölçütlerde kayıt bulunamadı." : "Parametreleri seçip Listele'ye basın."}
                    </td></tr>}
                  </tbody>
                </Table>
              </div>
              {(tanim?.dipnot || veri?.ekDipnot) && <div className="px-3 py-2 small text-muted border-top" style={{ whiteSpace: "pre-wrap" }}>{[tanim?.dipnot, veri?.ekDipnot].filter(Boolean).join("\n")}</div>}
            </Card.Body>
          </Card>
        </Col>
        {pdfUrl && (
          <Col xl={6}>
            <Card className="shadow-sm border-0 h-100">
              <Card.Header className="d-flex align-items-center gap-2 py-2 bg-white">
                <IconFileTypePdf size={18} className="text-danger" /><strong>{menu.ad}</strong><Badge bg="light" text="dark">A4 önizleme</Badge>
                <Button size="sm" variant="light" className="ms-auto" onClick={() => setPdfUrl(null)}><IconX size={15} /></Button>
              </Card.Header>
              <Card.Body className="p-0"><iframe title="Rapor PDF" src={pdfUrl} style={{ width: "100%", height: "74vh", border: 0 }} /></Card.Body>
            </Card>
          </Col>
        )}
      </Row>
    </div>
  );
};

export default RaporPage;
