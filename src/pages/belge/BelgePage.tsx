import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Badge, Button, Card, Col, Form, Row, Spinner, Table } from "react-bootstrap";
import { useSearchParams } from "react-router-dom";
import { IconArchive, IconDownload, IconFileTypePdf, IconPrinter, IconSearch, IconX } from "@tabler/icons-react";
import ERPToolbar from "components/common/ERPToolbar";
import {
  BelgeService, belgeDurumRozet, belgeNoMu, belgeSayi, belgeTarih,
  type BelgeFis, type BelgeIstek, type BelgeSablon,
} from "../../services/belgeService";

/**
 * Belge / Fiş PDF sayfası (sol menü H- Belge / Fiş PDF)
 * Alış ve satış fişlerini listeler; seçilen fişin GİB e-Döviz düzenindeki A4 PDF'ini
 * önizler, indirir veya sunucu arşivine yazar. Fiş ekranından `?fisId=` ile doğrudan açılır.
 * Bkz. docs/belgeverapor.md.
 */

const SAYFA_BOYUTU = 50;
const bugun = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const gunOnce = (g: number) => {
  const d = new Date(); d.setDate(d.getDate() - g);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
};

interface Onizleme { url: string; belgeNo: string; kaynak: string; onizleme: boolean; istek: BelgeIstek }

export const BelgePage: React.FC = () => {
  const [searchParams] = useSearchParams();

  const [tip, setTip] = useState<number | "">("");
  const [baslangic, setBaslangic] = useState<string>(gunOnce(30));
  const [bitis, setBitis] = useState<string>(bugun());
  const [arama, setArama] = useState<string>("");
  const [sayfa, setSayfa] = useState<number>(1);

  const [sablonlar, setSablonlar] = useState<BelgeSablon[]>([]);
  const [sablonKod, setSablonKod] = useState<string>("");
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

  useEffect(() => {
    BelgeService.sablonlar("BELGE").then(setSablonlar).catch(() => setSablonlar([]));
  }, []);

  const listele = useCallback(async (p = 1, ek?: { arama?: string; tip?: number | "" }) => {
    const id = ++istekNo.current;
    const aramaDeger = ek?.arama ?? arama;
    const tipDeger = ek?.tip ?? tip;
    if (baslangic && bitis && baslangic > bitis) { setHata("Başlangıç tarihi bitişten sonra olamaz."); return; }
    setYukleniyor(true); setHata(null);
    try {
      // Belge numarası yazılmışsa tarih aralığına bakılmaz; numara tek başına bulur.
      const numara = belgeNoMu(aramaDeger);
      const sonuc = await BelgeService.fisler({
        tip: tipDeger, arama: aramaDeger,
        baslangic: numara ? undefined : baslangic || undefined,
        bitis: numara ? undefined : bitis || undefined,
        sayfa: p, boyut: SAYFA_BOYUTU,
      });
      if (id !== istekNo.current) return;
      setKayitlar(sonuc.kayitlar); setToplam(sonuc.toplam); setSayfa(p);
    } catch (e: any) {
      if (id !== istekNo.current) return;
      setKayitlar([]); setToplam(0); setHata(e?.message || "Fişler listelenemedi.");
    } finally { if (id === istekNo.current) setYukleniyor(false); }
  }, [arama, tip, baslangic, bitis]);

  const onizle = useCallback(async (istek: BelgeIstek, belgeNo: string) => {
    setPdfYukleniyor(true); setHata(null); setBilgi(null);
    try {
      const p = await BelgeService.pdfBlobUrl({ ...istek, kod: sablonKod || undefined, bicim: "a4" });
      setOnizleme(o => { if (o) URL.revokeObjectURL(o.url); return { url: p.url, belgeNo, kaynak: p.kaynak, onizleme: p.onizleme, istek }; });
    } catch (e: any) { setHata(e?.message || "PDF önizlemesi açılamadı."); }
    finally { setPdfYukleniyor(false); }
  }, [sablonKod]);

  // Fiş ekranından gelen doğrudan açılış: /raporlar/belge?fisId=123 veya ?belgeNo=DIA2026...
  useEffect(() => {
    const fisId = Number(searchParams.get("fisId")) || 0;
    const belgeNo = (searchParams.get("belgeNo") || "").trim().toUpperCase();
    if (fisId) { void onizle({ fisId }, `Fiş ${fisId}`); void listele(1); }
    else if (belgeNo) { setArama(belgeNo); void onizle({ belgeNo }, belgeNo); void listele(1, { arama: belgeNo }); }
    else void listele(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const indir = async () => {
    if (!onizleme) return;
    setPdfYukleniyor(true); setHata(null);
    try { await BelgeService.indir({ ...onizleme.istek, kod: sablonKod || undefined }, onizleme.belgeNo); }
    catch (e: any) { setHata(e?.message || "PDF indirilemedi."); }
    finally { setPdfYukleniyor(false); }
  };

  const arsivle = async () => {
    if (!onizleme) return;
    setPdfYukleniyor(true); setHata(null); setBilgi(null);
    try {
      const s = await BelgeService.arsivle({ ...onizleme.istek, kod: sablonKod || undefined });
      setBilgi(`${s.belgeNo} arşive yazıldı (${s.kaynak === "ICE" ? "ICE resmî PDF" : "şablon çıktısı"}${s.onizleme ? ", önizleme" : ""}): ${s.yol}`);
    } catch (e: any) { setHata(e?.message || "Arşive yazılamadı."); }
    finally { setPdfYukleniyor(false); }
  };

  /** Yazdırma 80 mm dikey düzenle yapılır (yönetici kararı); ekrandaki A4 önizleme değişmez. */
  const yazdir = async () => {
    if (!onizleme) return;
    setPdfYukleniyor(true); setHata(null);
    try {
      const p = await BelgeService.pdfBlobUrl({ ...onizleme.istek, kod: sablonKod || undefined, bicim: "80" });
      const f = document.createElement("iframe");
      f.style.position = "fixed"; f.style.right = "0"; f.style.bottom = "0"; f.style.width = "0"; f.style.height = "0"; f.style.border = "0";
      f.src = p.url;
      f.onload = () => {
        try { f.contentWindow?.focus(); f.contentWindow?.print(); } catch { window.open(p.url, "_blank", "noopener"); }
        setTimeout(() => { URL.revokeObjectURL(p.url); f.remove(); }, 60000);
      };
      document.body.appendChild(f);
    } catch (e: any) { setHata(e?.message || "Yazdırma çıktısı alınamadı."); }
    finally { setPdfYukleniyor(false); }
  };

  const temizle = () => {
    setArama(""); setTip(""); setBaslangic(gunOnce(30)); setBitis(bugun()); setSayfa(1);
    void listele(1, { arama: "", tip: "" });
  };

  const sonSayfa = Math.max(Math.ceil(toplam / SAYFA_BOYUTU), 1);
  const uygunSablonlar = useMemo(() => sablonlar.filter(s => s.tur === "BELGE"), [sablonlar]);

  return (
    <div className="container-fluid py-2 px-3">
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
            Önizleme A4 · Yazdır/İndir 80 mm · {toplam} fiş
          </span>
        }
      />

      {hata && <Alert variant="danger" dismissible onClose={() => setHata(null)} className="py-2 mt-2">{hata}</Alert>}
      {bilgi && <Alert variant="success" dismissible onClose={() => setBilgi(null)} className="py-2 mt-2">{bilgi}</Alert>}

      <Row className="g-3 mt-1">
        {/* Sol: filtre + fiş listesi */}
        <Col xl={onizleme ? 5 : 12} lg={onizleme ? 6 : 12}>
          <Card className="shadow-sm border-0 mb-3">
            <Card.Body className="p-3">
              <Form onSubmit={e => { e.preventDefault(); void listele(1); }}>
                <fieldset disabled={yukleniyor}>
                  <Row className="g-2 align-items-end">
                    <Col md={onizleme ? 12 : 4}>
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
                    <Col md={onizleme ? 4 : 2}>
                      <Form.Label className="small fw-semibold text-secondary mb-1">Tip</Form.Label>
                      <Form.Select size="sm" value={tip} onChange={e => { const v = e.target.value === "" ? "" : Number(e.target.value); setTip(v); void listele(1, { tip: v }); }}>
                        <option value="">Alış + Satış</option>
                        <option value={0}>Alış (DIA)</option>
                        <option value={1}>Satış (DIS)</option>
                      </Form.Select>
                    </Col>
                    <Col md={onizleme ? 4 : 2}>
                      <Form.Label className="small fw-semibold text-secondary mb-1">Başlangıç</Form.Label>
                      <Form.Control size="sm" type="date" value={baslangic} onChange={e => setBaslangic(e.target.value)} />
                    </Col>
                    <Col md={onizleme ? 4 : 2}>
                      <Form.Label className="small fw-semibold text-secondary mb-1">Bitiş</Form.Label>
                      <Form.Control size="sm" type="date" value={bitis} onChange={e => setBitis(e.target.value)} />
                    </Col>
                    <Col md={onizleme ? 12 : 2}>
                      <Form.Label className="small fw-semibold text-secondary mb-1">Şablon</Form.Label>
                      <Form.Select size="sm" value={sablonKod} onChange={e => setSablonKod(e.target.value)} title="Boş bırakılırsa fiş tipine göre varsayılan şablon (ALFIS1 / STFIS1) kullanılır">
                        <option value="">Otomatik (fiş tipine göre)</option>
                        {uygunSablonlar.map(s => <option key={s.kod} value={s.kod}>{s.kod} — {s.ad}</option>)}
                      </Form.Select>
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
                      <th>Tip</th>
                      <th>Ünvan</th>
                      <th className="text-end">Miktar</th>
                      <th className="text-end">Tutar (TL)</th>
                      <th>Durum</th>
                      <th style={{ width: 90 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {kayitlar.map(f => {
                      const rozet = belgeDurumRozet(f);
                      const secili = onizleme?.istek.fisId === f.fisId || onizleme?.istek.belgeNo === f.belgeNo;
                      return (
                        <tr key={`${f.fisId}-${f.belgeNo}`} className={secili ? "table-primary" : undefined} style={{ cursor: "pointer" }} onDoubleClick={() => onizle({ fisId: f.fisId }, f.belgeNo)}>
                          <td className="font-monospace text-nowrap">{f.belgeNo}</td>
                          <td className="text-nowrap">{belgeTarih(f.tarih)}</td>
                          <td><Badge bg={f.fisTipi === 1 ? "primary" : "success"}>{f.tipAdi}</Badge></td>
                          <td className="text-truncate" style={{ maxWidth: 220 }} title={f.unvan}>{f.unvan || "-"}</td>
                          <td className="text-end text-nowrap">{belgeSayi(f.miktar)} {f.paraKodu}</td>
                          <td className="text-end text-nowrap fw-semibold">{belgeSayi(f.tutar)}</td>
                          <td><Badge bg={rozet.bg} text={rozet.text as any}>{rozet.etiket}</Badge></td>
                          <td className="text-end">
                            <Button size="sm" variant={secili ? "primary" : "outline-primary"} className="py-0 px-2" disabled={pdfYukleniyor} onClick={() => onizle({ fisId: f.fisId }, f.belgeNo)} title="PDF önizle">
                              <IconFileTypePdf size={15} /> PDF
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                    {!kayitlar.length && (
                      <tr><td colSpan={8} className="text-center text-muted py-4">
                        {yukleniyor ? <><Spinner size="sm" animation="border" /> Yükleniyor…</> : "Seçilen tarih ve filtrelerde fiş bulunamadı."}
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
                  : <Badge bg={onizleme.onizleme ? "warning" : "secondary"} text="dark">{onizleme.onizleme ? "Önizleme — GİB'e gönderilmemiş" : "Şablon çıktısı"}</Badge>}
                <div className="ms-auto d-flex gap-1">
                  <Button size="sm" variant="outline-secondary" onClick={yazdir} disabled={pdfYukleniyor} title="80 mm dikey düzende yazdır"><IconPrinter size={15} /> Yazdır</Button>
                  <Button size="sm" variant="outline-primary" onClick={indir} disabled={pdfYukleniyor} title="80 mm dikey düzende bilgisayarına indir"><IconDownload size={15} /> İndir</Button>
                  <Button size="sm" variant="primary" onClick={arsivle} disabled={pdfYukleniyor} title="Sunucu arşivine yaz (varsa üzerine yazar)"><IconArchive size={15} /> Arşivle</Button>
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
