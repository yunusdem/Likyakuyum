import React, { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Badge, Button, Card, Col, Form, Row, Spinner, Table } from "react-bootstrap";
import { Navigate, useLocation, useSearchParams } from "react-router-dom";
import { IconArchive, IconDownload, IconFileTypePdf, IconPrinter, IconSearch, IconX } from "@tabler/icons-react";
import ERPToolbar from "components/common/ERPToolbar";
import {
  BELGE_DURUMLARI, BELGE_KAYNAKLARI, BelgeService, belgeDurumRozet, belgeNoMu, belgeSayi, belgeTarih,
  type BelgeFis, type BelgeIstek, type BelgeKaynak,
} from "../../services/belgeService";
import { ebelgeService } from "../../services/ebelgeService";

/**
 * Belge sayfası (sol menü H- Belge / Fiş PDF, adres /belge) — belgelerin oluştuğu ana alan.
 * Tüm kaynaklardaki belgeleri (e-Döviz fişi, fatura, e-İrsaliye, e-Gider) kesilmiş ya da kesilmemiş
 * durumlarıyla listeler; seçilen belgenin A4 PDF'ini önizler, indirir, yazdırır; döviz fişini arşive yazar.
 * Kaynak seçilmezse hepsi gelir (yönetici kararı 14.09.2026). Fiş ekranından `?fisId=` ile doğrudan açılır.
 * Şablon seçimi kaldırıldı: fiş tipine göre varsayılan şablon (ALFIS1 / STFIS1) otomatik kullanılır.
 * Bkz. docs/belgeverapor.md ve docs/belge-rapor-revizyon.md.
 */

const SAYFA_BOYUTU = 50;
const bugun = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

interface Onizleme { url: string; belgeNo: string; kaynak: string; onizleme: boolean; fis: BelgeFis | null; istek: BelgeIstek | null }

/** Eski adres (/raporlar/belge) → /belge; sorgu parametreleri (fisId, belgeNo) korunur. */
export const BelgeYonlendir: React.FC = () => {
  const { search } = useLocation();
  return <Navigate to={`/belge${search}`} replace />;
};

const dovizMi = (f: BelgeFis | null | undefined) => !f || f.kaynak === "DOVIZ";

export const BelgePage: React.FC = () => {
  const [searchParams] = useSearchParams();

  const [kaynak, setKaynak] = useState<BelgeKaynak | "">("");
  const [tip, setTip] = useState<number | "">("");
  const [durum, setDurum] = useState<string>("");
  const [baslangic, setBaslangic] = useState<string>(bugun());
  const [bitis, setBitis] = useState<string>(bugun());
  const [arama, setArama] = useState<string>("");
  const [sayfa, setSayfa] = useState<number>(1);

  const [kayitlar, setKayitlar] = useState<BelgeFis[]>([]);
  const [toplam, setToplam] = useState<number>(0);
  const [yukleniyor, setYukleniyor] = useState<boolean>(false);
  const [pdfYukleniyor, setPdfYukleniyor] = useState<boolean>(false);
  const [hata, setHata] = useState<string | null>(null);
  const [bilgi, setBilgi] = useState<string | null>(null);
  const [onizleme, setOnizleme] = useState<Onizleme | null>(null);
  const istekNo = useRef(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => () => { if (onizleme) URL.revokeObjectURL(onizleme.url); }, [onizleme]);

  const listele = useCallback(async (p = 1, ek?: { arama?: string; tip?: number | ""; kaynak?: BelgeKaynak | ""; durum?: string }) => {
    const id = ++istekNo.current;
    const aramaDeger = ek?.arama ?? arama;
    const tipDeger = ek?.tip ?? tip;
    const kaynakDeger = ek?.kaynak ?? kaynak;
    const durumDeger = ek?.durum ?? durum;
    if (baslangic && bitis && baslangic > bitis) { setHata("Başlangıç tarihi bitişten sonra olamaz."); return; }
    setYukleniyor(true); setHata(null);
    try {
      // Belge numarası yazılmışsa tarih aralığına bakılmaz; numara tek başına bulur.
      const numara = belgeNoMu(aramaDeger);
      const sonuc = await BelgeService.fisler({
        kaynak: kaynakDeger, tip: tipDeger, durum: durumDeger, arama: aramaDeger,
        baslangic: numara ? undefined : baslangic || undefined,
        bitis: numara ? undefined : bitis || undefined,
        sayfa: p, boyut: SAYFA_BOYUTU,
      });
      if (id !== istekNo.current) return;
      setKayitlar(sonuc.kayitlar); setToplam(sonuc.toplam); setSayfa(p);
    } catch (e: any) {
      if (id !== istekNo.current) return;
      setKayitlar([]); setToplam(0); setHata(e?.message || "Belgeler listelenemedi.");
    } finally { if (id === istekNo.current) setYukleniyor(false); }
  }, [arama, tip, kaynak, durum, baslangic, bitis]);

  /** Döviz fişi → Belge modülü PDF'i (gönderilmişse ICE resmî PDF'i); diğer kaynaklar → e-Belge kaynak önizlemesi. */
  const onizle = useCallback(async (fis: BelgeFis | null, istek: BelgeIstek | null, belgeNo: string) => {
    setPdfYukleniyor(true); setHata(null); setBilgi(null);
    try {
      if (fis && !dovizMi(fis)) {
        const url = await ebelgeService.kaynakPdf({ evrakTuru: fis.evrakTuru, belgeId: fis.fisId, belgeTuru: fis.belgeTuru, belgeNo: fis.belgeNo });
        setOnizleme(o => { if (o) URL.revokeObjectURL(o.url); return { url, belgeNo, kaynak: "KAYNAK", onizleme: fis.durum !== "GONDERILDI", fis, istek: null }; });
        return;
      }
      const i: BelgeIstek = istek || { fisId: fis?.fisId };
      const p = await BelgeService.pdfBlobUrl({ ...i, bicim: "a4" });
      setOnizleme(o => { if (o) URL.revokeObjectURL(o.url); return { url: p.url, belgeNo, kaynak: p.kaynak, onizleme: p.onizleme, fis, istek: i }; });
    } catch (e: any) { setHata(e?.message || "PDF önizlemesi açılamadı."); }
    finally { setPdfYukleniyor(false); }
  }, []);

  // Fiş ekranından gelen doğrudan açılış: /belge?fisId=123 veya ?belgeNo=DIA2026... (eski /raporlar/belge adresi yönlendirilir)
  useEffect(() => {
    const fisId = Number(searchParams.get("fisId")) || 0;
    const belgeNo = (searchParams.get("belgeNo") || "").trim().toUpperCase();
    if (fisId) { void onizle(null, { fisId }, `Fiş ${fisId}`); void listele(1); }
    else if (belgeNo) { setArama(belgeNo); void onizle(null, { belgeNo }, belgeNo); void listele(1, { arama: belgeNo }); }
    else void listele(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const blobIndir = (url: string, ad: string) => {
    const a = document.createElement("a");
    a.href = url; a.download = `${ad || "belge"}.pdf`; a.rel = "noopener";
    document.body.appendChild(a); a.click(); a.remove();
  };

  const indir = async () => {
    if (!onizleme) return;
    setPdfYukleniyor(true); setHata(null);
    try {
      if (onizleme.istek) await BelgeService.indir(onizleme.istek, onizleme.belgeNo);
      else blobIndir(onizleme.url, onizleme.belgeNo);
    } catch (e: any) { setHata(e?.message || "PDF indirilemedi."); }
    finally { setPdfYukleniyor(false); }
  };

  const arsivle = async () => {
    if (!onizleme?.istek) return;
    setPdfYukleniyor(true); setHata(null); setBilgi(null);
    try {
      const s = await BelgeService.arsivle(onizleme.istek);
      setBilgi(`${s.belgeNo} arşive yazıldı (${s.kaynak === "ICE" ? "ICE resmî PDF" : "şablon çıktısı"}${s.onizleme ? ", önizleme" : ""}): ${s.yol}`);
    } catch (e: any) { setHata(e?.message || "Arşive yazılamadı."); }
    finally { setPdfYukleniyor(false); }
  };

  const yazdirUrl = (url: string, birak: boolean) => {
    const f = document.createElement("iframe");
    f.style.position = "fixed"; f.style.right = "0"; f.style.bottom = "0"; f.style.width = "0"; f.style.height = "0"; f.style.border = "0";
    f.src = url;
    f.onload = () => {
      try { f.contentWindow?.focus(); f.contentWindow?.print(); } catch { window.open(url, "_blank", "noopener"); }
      setTimeout(() => { if (birak) URL.revokeObjectURL(url); f.remove(); }, 60000);
    };
    document.body.appendChild(f);
  };

  /** Döviz fişi 80 mm dikey düzenle yazdırılır (yönetici kararı); diğer kaynaklar A4 önizleme PDF'iyle. Ekrandaki A4 önizleme değişmez. */
  const yazdir = async () => {
    if (!onizleme) return;
    setPdfYukleniyor(true); setHata(null);
    try {
      if (onizleme.istek) { const p = await BelgeService.pdfBlobUrl({ ...onizleme.istek, bicim: "80" }); yazdirUrl(p.url, true); }
      else yazdirUrl(onizleme.url, false);
    } catch (e: any) { setHata(e?.message || "Yazdırma çıktısı alınamadı."); }
    finally { setPdfYukleniyor(false); }
  };

  const temizle = () => {
    setArama(""); setTip(""); setKaynak(""); setDurum(""); setBaslangic(bugun()); setBitis(bugun()); setSayfa(1);
    void listele(1, { arama: "", tip: "", kaynak: "", durum: "" });
  };

  const sonSayfa = Math.max(Math.ceil(toplam / SAYFA_BOYUTU), 1);
  const tipAktif = kaynak === "" || kaynak === "DOVIZ";
  const seciliMi = (f: BelgeFis) => !!onizleme && (onizleme.fis
    ? onizleme.fis.kaynak === f.kaynak && onizleme.fis.fisId === f.fisId && onizleme.fis.belgeNo === f.belgeNo
    : (onizleme.istek?.fisId === f.fisId && f.kaynak === "DOVIZ") || onizleme.istek?.belgeNo === f.belgeNo);

  return (
    <div className="w-100 pb-3" style={{ overflowX: "hidden" }}>
      <ERPToolbar
        pageTitle="Belge / Fiş PDF"
        pageIcon={<IconFileTypePdf size={20} />}
        onSearch={() => listele(1)}
        onRefresh={() => listele(sayfa)}
        onClear={temizle}
        onPrint={onizleme ? yazdir : undefined}
        hideDelete
        disabled={yukleniyor || pdfYukleniyor}
        rightContent={
          <span className="text-muted text-nowrap d-none d-md-inline" style={{ fontSize: "0.78rem" }}>
            Önizleme A4 · Döviz fişinde yazdır/indir 80 mm · {toplam} belge
          </span>
        }
      />

      {hata && <Alert variant="danger" dismissible onClose={() => setHata(null)} className="py-2 mt-2">{hata}</Alert>}
      {bilgi && <Alert variant="success" dismissible onClose={() => setBilgi(null)} className="py-2 mt-2">{bilgi}</Alert>}

      <Row className="g-3 mt-1">
        {/* Sol: filtre + belge listesi */}
        <Col xl={onizleme ? 5 : 12} lg={onizleme ? 6 : 12}>
          <Card className="shadow-sm border-0 mb-3">
            <Card.Body className="p-3">
              <Form onSubmit={e => { e.preventDefault(); void listele(1); }}>
                <fieldset disabled={yukleniyor}>
                  <Row className="g-2 align-items-end">
                    <Col md={onizleme ? 12 : 3}>
                      <Form.Label className="small fw-semibold text-secondary mb-1">Belge no / ünvan</Form.Label>
                      <div className="input-group input-group-sm">
                        <Form.Control
                          value={arama}
                          onChange={e => setArama(e.target.value)}
                          placeholder="DIA2026000000004 veya ünvan"
                          className="font-monospace"
                        />
                        <Button type="submit" variant="primary" title="Listele (Enter)"><IconSearch size={15} /></Button>
                      </div>
                    </Col>
                    <Col md={onizleme ? 6 : 2}>
                      <Form.Label className="small fw-semibold text-secondary mb-1">Kaynak</Form.Label>
                      <Form.Select size="sm" value={kaynak} title="Seçilmezse tüm kaynaklardaki belgeler listelenir"
                        onChange={e => { const v = e.target.value as BelgeKaynak | ""; const t = v === "" || v === "DOVIZ" ? tip : ""; setKaynak(v); setTip(t); void listele(1, { kaynak: v, tip: t }); }}>
                        <option value="">Tümü (bütün kaynaklar)</option>
                        {BELGE_KAYNAKLARI.map(k => <option key={k.kod} value={k.kod}>{k.ad}</option>)}
                      </Form.Select>
                    </Col>
                    <Col md={onizleme ? 6 : 2}>
                      <Form.Label className="small fw-semibold text-secondary mb-1">Tip</Form.Label>
                      <Form.Select size="sm" value={tip} disabled={!tipAktif} title={tipAktif ? "Döviz fişi tipi" : "Tip yalnızca döviz fişleri için"}
                        onChange={e => { const v = e.target.value === "" ? "" : Number(e.target.value); setTip(v); void listele(1, { tip: v }); }}>
                        <option value="">Alış + Satış</option>
                        <option value={0}>Alış</option>
                        <option value={1}>Satış</option>
                      </Form.Select>
                    </Col>
                    <Col md={onizleme ? 6 : 2}>
                      <Form.Label className="small fw-semibold text-secondary mb-1">Durum</Form.Label>
                      <Form.Select size="sm" value={durum} onChange={e => { setDurum(e.target.value); void listele(1, { durum: e.target.value }); }}>
                        <option value="">Tümü</option>
                        {BELGE_DURUMLARI.map(d => <option key={d.kod} value={d.kod}>{d.ad}</option>)}
                      </Form.Select>
                    </Col>
                    <Col md={onizleme ? 3 : 1}>
                      <Form.Label className="small fw-semibold text-secondary mb-1">Başlangıç</Form.Label>
                      <Form.Control size="sm" type="date" value={baslangic} onChange={e => setBaslangic(e.target.value)} />
                    </Col>
                    <Col md={onizleme ? 3 : 1}>
                      <Form.Label className="small fw-semibold text-secondary mb-1">Bitiş</Form.Label>
                      <Form.Control size="sm" type="date" value={bitis} onChange={e => setBitis(e.target.value)} />
                    </Col>
                  </Row>
                </fieldset>
              </Form>
            </Card.Body>
          </Card>

          <Card className="shadow-sm border-0">
            <Card.Body className="p-0">
              <div className="table-responsive" style={{ maxHeight: onizleme ? "62vh" : "70vh" }}>
                <Table hover size="sm" className="mb-0 align-middle" style={{ fontSize: "0.85rem" }}>
                  <thead className="table-light sticky-top">
                    <tr>
                      <th>Belge No</th>
                      <th>Tarih</th>
                      <th>Kaynak / Tip</th>
                      <th>Ünvan</th>
                      <th className="text-end">Miktar</th>
                      <th className="text-end">Tutar</th>
                      <th>Durum</th>
                      <th style={{ width: 90 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {kayitlar.map(f => {
                      const rozet = belgeDurumRozet(f);
                      const secili = seciliMi(f);
                      const doviz = f.kaynak === "DOVIZ";
                      return (
                        <tr key={`${f.kaynak}-${f.fisId}-${f.belgeNo}`} className={secili ? "table-primary" : undefined} style={{ cursor: "pointer" }} onDoubleClick={() => onizle(f, null, f.belgeNo)}>
                          <td className="font-monospace text-nowrap">{f.belgeNo}</td>
                          <td className="text-nowrap">{belgeTarih(f.tarih)}</td>
                          <td>
                            <Badge bg={doviz ? (f.fisTipi === 1 ? "primary" : "success") : f.kaynak === "IRSALIYE" ? "info" : f.kaynak === "GIDER" ? "dark" : "secondary"} text={f.kaynak === "IRSALIYE" ? "dark" : undefined}>
                              {doviz ? `e-Döviz ${f.tipAdi}` : f.tipAdi}
                            </Badge>
                          </td>
                          <td className="text-truncate" style={{ maxWidth: 220 }} title={f.unvan}>{f.unvan || "-"}</td>
                          <td className="text-end text-nowrap">{doviz ? `${belgeSayi(f.miktar || 0)} ${f.paraKodu}` : "-"}</td>
                          <td className="text-end text-nowrap fw-semibold">{belgeSayi(f.tutar)} {doviz ? "TL" : f.paraKodu || "TL"}</td>
                          <td>
                            <Badge bg={rozet.bg} text={rozet.text as any}>{rozet.etiket}</Badge>
                            {f.hata && <small className="d-block text-danger text-truncate" style={{ maxWidth: 200 }} title={f.hata}>{f.hata}</small>}
                          </td>
                          <td className="text-end">
                            <Button size="sm" variant={secili ? "primary" : "outline-primary"} className="py-0 px-2" disabled={pdfYukleniyor} onClick={() => onizle(f, null, f.belgeNo)} title="PDF önizle">
                              <IconFileTypePdf size={15} /> PDF
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                    {!kayitlar.length && (
                      <tr><td colSpan={8} className="text-center text-muted py-4">
                        {yukleniyor ? <><Spinner size="sm" animation="border" /> Yükleniyor…</> : "Seçilen tarih ve filtrelerde belge bulunamadı."}
                      </td></tr>
                    )}
                  </tbody>
                </Table>
              </div>
              <div className="d-flex justify-content-between align-items-center px-3 py-2 border-top small">
                <span className="text-muted">{toplam} kayıt · Sayfa {sayfa} / {sonSayfa}</span>
                <div className="d-flex gap-1">
                  <Button size="sm" variant="outline-secondary" disabled={yukleniyor || sayfa <= 1} onClick={() => listele(sayfa - 1)}>Önceki</Button>
                  <Button size="sm" variant="outline-secondary" disabled={yukleniyor || sayfa >= sonSayfa} onClick={() => listele(sayfa + 1)}>Sonraki</Button>
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>

        {/* Sağ: PDF önizleme */}
        {onizleme && (
          <Col xl={7} lg={6}>
            <Card className="shadow-sm border-0 h-100">
              <Card.Header className="d-flex flex-wrap align-items-center gap-2 py-2 bg-white">
                <IconFileTypePdf size={18} className="text-danger" />
                <strong className="font-monospace">{onizleme.belgeNo}</strong>
                {onizleme.kaynak === "ICE"
                  ? <Badge bg="success">ICE resmî PDF</Badge>
                  : onizleme.kaynak === "KAYNAK"
                    ? <Badge bg={onizleme.onizleme ? "warning" : "secondary"} text="dark">{onizleme.onizleme ? "Önizleme — GİB'e gönderilmemiş" : "Kaynak belge PDF'i"}</Badge>
                    : <Badge bg={onizleme.onizleme ? "warning" : "secondary"} text="dark">{onizleme.onizleme ? "Önizleme — GİB'e gönderilmemiş" : "Şablon çıktısı"}</Badge>}
                <div className="ms-auto d-flex gap-1">
                  <Button size="sm" variant="outline-secondary" onClick={yazdir} disabled={pdfYukleniyor} title={onizleme.istek ? "80 mm dikey düzende yazdır" : "Yazdır"}><IconPrinter size={15} /> Yazdır</Button>
                  <Button size="sm" variant="outline-primary" onClick={indir} disabled={pdfYukleniyor} title={onizleme.istek ? "80 mm dikey düzende bilgisayarına indir" : "Bilgisayarına indir"}><IconDownload size={15} /> İndir</Button>
                  {onizleme.istek && <Button size="sm" variant="primary" onClick={arsivle} disabled={pdfYukleniyor} title="Sunucu arşivine yaz (varsa üzerine yazar)"><IconArchive size={15} /> Arşivle</Button>}
                  <Button size="sm" variant="light" onClick={() => setOnizleme(null)} title="Kapat"><IconX size={15} /></Button>
                </div>
              </Card.Header>
              <Card.Body className="p-0 position-relative" style={{ minHeight: "70vh" }}>
                {pdfYukleniyor && (
                  <div className="position-absolute top-50 start-50 translate-middle"><Spinner animation="border" /></div>
                )}
                <iframe ref={iframeRef} title={`${onizleme.belgeNo} PDF`} src={onizleme.url} style={{ width: "100%", height: "78vh", border: 0 }} />
              </Card.Body>
            </Card>
          </Col>
        )}
      </Row>
    </div>
  );
};

export default BelgePage;
