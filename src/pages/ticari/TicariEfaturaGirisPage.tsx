import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Alert, Badge, Button, ButtonGroup, Card, Col, Form, InputGroup, Row, Spinner, Table } from "react-bootstrap";
import { IconFileImport, IconInbox, IconPlus, IconUpload } from "@tabler/icons-react";
import ERPToolbar from "../../components/common/ERPToolbar";
import { LookupModal } from "../../components/common/LookupModal";
import { useToast } from "../../context/ToastContext";
import { CariKartItem, CariService } from "../../services/cariService";
import { EfaturaAlimSecimi, EfaturaGelenSatiri, EfaturaOnizleme, StokKart, TicariService, miktarYaz, para } from "../../services/ticariService";
import { birimCarpani } from "../../../Backend/src/services/ticari/efaturaBirim";
import { StokKartSecici } from "./StokKartSecici";
import { YETKI_YOK_MESAJI, useTicariYetki } from "./useTicariYetki";

/**
 * Ticari › e-Faturadan Stok Girişi (docs/TICARI_ADISYON_YOL_HARITASI.md, TA14). Kaynak: e-Belge gelen kutusu (ICE'den yalnız okunur)
 * ya da UBL XML dosyası. Kalemler kartlarla eşleşir (hatırlanan / barkod / kod / ad); kullanıcı kart seçer, yeni kart açar ya da atlar;
 * birim çarpanı (1 fatura birimi = kaç kart birimi) önerilir. "Stoğa al" Stok Giriş Fişi yazar; aynı fatura iki kez alınamaz.
 */
type Secim = { mod: "kart" | "yeni" | "atla"; kart: { stokKartId: number; kod: string; ad: string; birim: string; sktTakibi?: boolean } | null; carpan: string; hatirla: boolean;
  /** Son kullanma tarihi / parti (TA16): faturada varsa dolu gelir; SKT takipli kartta zorunlu */
  skt: string; partiNo: string };
const KAYNAK_ADI: Record<string, string> = { hatirlanan: "hatırlanan", barkod: "barkod", kod: "kod", ad: "ad" };
const sayi = (v: string) => { const s = String(v ?? "").trim(); const n = Number(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s); return Number.isFinite(n) ? n : NaN; };
const metin = (n: number | null | undefined) => (n === null || n === undefined ? "" : String(n).replace(".", ","));

export const TicariEfaturaGirisPage: React.FC = () => {
  const { showSuccess, showError, showWarning } = useToast();
  const yetki = useTicariYetki();
  const navigate = useNavigate();
  const [kaynakTuru, setKaynakTuru] = useState<"gelen" | "xml">("gelen");
  const [gelen, setGelen] = useState<EfaturaGelenSatiri[] | null>(null);
  const [kaynak, setKaynak] = useState<{ uuid?: string; xml?: string } | null>(null);
  const [o, setO] = useState<EfaturaOnizleme | null>(null);
  const [secim, setSecim] = useState<Record<number, Secim>>({});
  const [cari, setCari] = useState<{ id: number; kod: string; ad: string } | null>(null);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [isleniyor, setIsleniyor] = useState(false);
  const [kartSecici, setKartSecici] = useState<number | null>(null);
  const [cariSecici, setCariSecici] = useState(false);
  const [cariler, setCariler] = useState<CariKartItem[] | null>(null);
  const [sonuc, setSonuc] = useState<{ fisNo: string; stokGirisId: number; fark: number; yeniKartSayisi: number; uyari: string | null } | null>(null);
  const dosyaRef = useRef<HTMLInputElement>(null);

  const gelenYukle = () => { setGelen(null); TicariService.efGelenListe({}).then(setGelen).catch((e) => { setGelen([]); showError(e?.message || "Gelen kutusu okunamadı."); }); };
  useEffect(() => { gelenYukle(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onizlemeKur = (x: EfaturaOnizleme, k: { uuid?: string; xml?: string }) => {
    setO(x); setKaynak(k); setSonuc(null);
    setCari(x.cari ? { id: x.cari.cariKartId, kod: x.cari.kod, ad: x.cari.ad } : null);
    setSecim(Object.fromEntries(x.satirlar.map((s) => [s.sira, {
      mod: s.oneri.stokKartId ? "kart" : "yeni",
      kart: s.oneri.stokKartId && s.oneri.kart ? { stokKartId: s.oneri.stokKartId, ...s.oneri.kart } : null,
      carpan: metin(s.oneri.stokKartId ? s.oneri.carpan : birimCarpani(s.birimKodu, s.yeniKartBirimi) ?? 1),
      // Ada göre (tahmini) öneri kendiliğinden hatırlanmaz: yanlış eşleşme sessizce kalıcı olmasın; kod / barkod / önceki eşleşme hatırlanır
      hatirla: s.oneri.kaynak !== "ad",
      skt: s.skt || "", partiNo: s.partiNo || "",
    } as Secim])));
  };
  const gelenAc = async (uuid: string) => {
    setYukleniyor(true);
    try { onizlemeKur(await TicariService.efGelenOnizle(uuid), { uuid }); } catch (e: any) { showError(e?.message || "Fatura okunamadı."); } finally { setYukleniyor(false); }
  };
  const dosyaSecildi = async (f: File | undefined) => {
    if (!f) return;
    setYukleniyor(true);
    try { const xml = await f.text(); onizlemeKur(await TicariService.efXmlOnizle(xml), { xml }); } catch (e: any) { showError(e?.message || "XML okunamadı."); } finally { setYukleniyor(false); if (dosyaRef.current) dosyaRef.current.value = ""; }
  };

  const satirlar = useMemo(() => (o?.satirlar || []).map((s) => {
    const sc = secim[s.sira];
    const c = sayi(sc?.carpan || "");
    const birim = sc?.mod === "kart" ? sc.kart?.birim || "" : s.yeniKartBirimi;
    const miktar = c > 0 ? Math.round(s.miktar * c * 10000) / 10000 : null;
    return { s, sc, c, birim, miktar, net: miktar ? Math.round((s.netTutar / miktar) * 1_000_000) / 1_000_000 : null };
  }), [o, secim]);
  const ozet = useMemo(() => {
    const alinan = satirlar.filter((x) => x.sc?.mod !== "atla");
    return { alinan: alinan.length, atlanan: satirlar.length - alinan.length, eksik: alinan.filter((x) => (x.sc?.mod === "kart" && !x.sc.kart) || !(x.c > 0)).length,
      sktEksik: alinan.filter((x) => x.sc?.mod === "kart" && x.sc.kart?.sktTakibi && !x.sc.skt).length,
      yeniKart: alinan.filter((x) => x.sc?.mod === "yeni").length };
  }, [satirlar]);
  const degistir = (sira: number, d: Partial<Secim>) => setSecim((p) => ({ ...p, [sira]: { ...p[sira], ...d } }));

  const al = async () => {
    if (!o || !kaynak) return;
    if (!yetki.yonetebilir) { showError(YETKI_YOK_MESAJI); return; }
    if (!cari) { showWarning("Tedarikçi cari seçin."); return; }
    if (ozet.eksik) { showWarning(`${ozet.eksik} kalemde kart ya da çarpan eksik.`); return; }
    if (ozet.sktEksik) { showWarning(`${ozet.sktEksik} kalemde SKT takibi yapılan ürünün son kullanma tarihi eksik.`); return; }
    if (!window.confirm(`${o.fatura.faturaNo} stoğa alınsın mı? ${ozet.alinan} kalem girilecek${ozet.atlanan ? `, ${ozet.atlanan} kalem atlanacak` : ""}${ozet.yeniKart ? `; ${ozet.yeniKart} YENİ STOK KARTI açılacak` : ""}.`)) return;
    setIsleniyor(true);
    try {
      const g: EfaturaAlimSecimi[] = satirlar.map(({ s, sc, c }) => sc.mod === "atla" ? { sira: s.sira, atla: true }
        : sc.mod === "yeni" ? { sira: s.sira, yeniKart: { ad: s.ad, birim: s.yeniKartBirimi, kdvOrani: s.kdvOrani }, carpan: c, hatirla: sc.hatirla, skt: sc.skt || null, partiNo: sc.partiNo.trim() || null }
        : { sira: s.sira, stokKartId: sc.kart!.stokKartId, carpan: c, hatirla: sc.hatirla, skt: sc.skt || null, partiNo: sc.partiNo.trim() || null });
      const r = await TicariService.efAl(kaynak, { cariKartId: cari.id, satirlar: g });
      if (r.uyari) showWarning(r.uyari);
      setSonuc({ fisNo: r.fis.fisNo, stokGirisId: r.fis.stokGirisId, fark: r.fark, yeniKartSayisi: r.yeniKartSayisi, uyari: r.uyari });
      showSuccess(`${o.fatura.faturaNo} stoğa alındı: ${r.fis.fisNo}.`);
      if (kaynakTuru === "gelen") gelenYukle();
    } catch (e: any) { showError(e?.message || "Fatura stoğa alınamadı."); } finally { setIsleniyor(false); }
  };

  return (
    <div className="container-fluid py-3">
      <ERPToolbar pageTitle="W- e-Faturadan Stok Girişi" pageIcon={<IconFileImport size={20} />} hideNew hideSave hideDelete hidePrint hideSearch hideNavigation disabled={isleniyor} />
      {!yetki.yukleniyor && !yetki.yonetebilir && <Alert variant="warning" className="py-2">{YETKI_YOK_MESAJI}</Alert>}
      <Row className="g-3">
        <Col xl={3}>
          <Card className="border shadow-xs h-100">
            <Card.Header className="py-2 d-flex justify-content-between align-items-center">
              <ButtonGroup size="sm">
                <Button variant={kaynakTuru === "gelen" ? "primary" : "outline-primary"} onClick={() => setKaynakTuru("gelen")}><IconInbox size={15} className="me-1" />Gelen kutusu</Button>
                <Button variant={kaynakTuru === "xml" ? "primary" : "outline-primary"} onClick={() => setKaynakTuru("xml")}><IconUpload size={15} className="me-1" />XML dosyası</Button>
              </ButtonGroup>
              {yukleniyor && <Spinner size="sm" />}
            </Card.Header>
            {kaynakTuru === "gelen" ? (
              <Table size="sm" hover className="mb-0 small">
                <thead><tr><th>Fatura</th><th>Satıcı</th><th className="text-end">Tutar</th><th /></tr></thead>
                <tbody>
                  {(gelen || []).map((g) => (
                    <tr key={g.uuid} role="button" onClick={() => gelenAc(g.uuid)} className={kaynak?.uuid === g.uuid ? "table-active" : ""}>
                      <td>{g.belgeNo}<div className="text-muted">{g.tarih ? new Date(g.tarih).toLocaleDateString("tr-TR") : ""}</div></td>
                      <td>{g.saticiUnvan}<div className="text-muted">{g.saticiVkn}</div></td>
                      <td className="text-end">{g.tutar !== null ? `${para(g.tutar)} ${g.paraBirimi}` : ""}</td>
                      <td>{g.alindi ? <Badge bg="success">{g.alindi.fisNo}</Badge> : null}</td>
                    </tr>
                  ))}
                  {gelen && !gelen.length && <tr><td colSpan={4} className="text-muted text-center py-3">Gelen kutusunda e-Fatura yok. e-Belge › Gelen'den senkronize edin ya da XML dosyası yükleyin.</td></tr>}
                  {!gelen && <tr><td colSpan={4} className="text-center py-3"><Spinner size="sm" /></td></tr>}
                </tbody>
              </Table>
            ) : (
              <Card.Body>
                <Form.Control ref={dosyaRef} type="file" accept=".xml,text/xml,application/xml" aria-label="UBL XML dosyası" onChange={(e) => dosyaSecildi((e.target as HTMLInputElement).files?.[0])} />
                <div className="small text-muted mt-2">Tedarikçinin gönderdiği e-Fatura UBL (XML) dosyası. Fatura bilgileri ve kalemler dosyadan okunur.</div>
              </Card.Body>
            )}
          </Card>
        </Col>
        <Col xl={9}>
          {!o ? (
            <Card className="border shadow-xs h-100"><Card.Body className="text-muted small d-flex align-items-center justify-content-center">Soldan bir fatura seçin ya da XML dosyası yükleyin.</Card.Body></Card>
          ) : (
            <Card className="border shadow-xs">
              <Card.Body>
                <div className="d-flex flex-wrap justify-content-between gap-2 mb-2">
                  <div>
                    <h5 className="mb-1">{o.fatura.faturaNo} <Badge bg="light" text="dark" className="border">{o.fatura.faturaTipi}</Badge></h5>
                    <div className="small text-muted">{o.fatura.tarih} · {o.fatura.saticiUnvan} ({o.fatura.saticiVkn}) · ETTN {o.fatura.ettn}</div>
                  </div>
                  <div className="text-end"><div className="small text-muted">Ödenecek</div><div className="fs-5 fw-bold">{para(o.fatura.odenecek)} {o.fatura.paraBirimi}</div></div>
                </div>
                {o.engel && <Alert variant="danger" className="py-2">{o.engel}</Alert>}
                {o.alindi && <Alert variant="success" className="py-2">Bu fatura stoğa alındı: <a href="#" onClick={(e) => { e.preventDefault(); navigate(`/ticari/stok-giris-fisi?id=${o.alindi!.stokGirisId}`); }}>{o.alindi.fisNo}</a></Alert>}
                {sonuc && <Alert variant="success" className="py-2">Stok Giriş Fişi <a href="#" onClick={(e) => { e.preventDefault(); navigate(`/ticari/stok-giris-fisi?id=${sonuc.stokGirisId}`); }}>{sonuc.fisNo}</a> yazıldı{sonuc.yeniKartSayisi ? `, ${sonuc.yeniKartSayisi} yeni kart açıldı` : ""}.{sonuc.fark ? ` Fatura ile fark: ${para(sonuc.fark)} TL (atlanan kalem / yuvarlama).` : " Tutar faturayla aynı."}</Alert>}
                <Row className="g-2 align-items-end mb-2">
                  <Col md={6}>
                    <Form.Label className="small mb-1">Tedarikçi {o.cari ? <Badge bg="success" className="ms-1">VKN'den bulundu</Badge> : <Badge bg="warning" text="dark" className="ms-1">seçin</Badge>}</Form.Label>
                    <InputGroup size="sm"><Form.Control readOnly value={cari ? `${cari.kod} ${cari.ad}` : ""} placeholder="Cari seçin" />
                      <Button variant="outline-secondary" onClick={() => { setCariSecici(true); if (!cariler) CariService.getCariKartlar().then(setCariler).catch(() => setCariler([])); }}>Seç</Button></InputGroup>
                  </Col>
                  <Col md={6} className="small text-md-end">{ozet.alinan} kalem girilecek · {ozet.atlanan} atlanacak{ozet.eksik ? <> · <span className="text-danger">{ozet.eksik} eksik</span></> : null}</Col>
                </Row>
                <Table size="sm" className="small mb-2 align-middle" responsive>
                  <thead><tr><th>#</th><th>Fatura kalemi</th><th className="text-end">Miktar / Net</th><th style={{ minWidth: 220 }}>Stok kartı</th><th style={{ width: 80 }}>Çarpan</th><th className="text-end">Girecek</th><th style={{ width: 140 }}>SKT / Parti</th></tr></thead>
                  <tbody>
                    {satirlar.map(({ s, sc, c, birim, miktar, net }) => (
                      <tr key={s.sira} className={sc?.mod === "atla" ? "text-muted" : ""}>
                        <td>{s.sira}</td>
                        <td>{s.ad}<div className="text-muted">{[s.saticiKodu && `sat. ${s.saticiKodu}`, s.barkod && `barkod ${s.barkod}`, s.aliciKodu && `alıcı ${s.aliciKodu}`].filter(Boolean).join(" · ")}</div></td>
                        <td className="text-end text-nowrap">{miktarYaz(s.miktar)} {s.birimKodu}<div>{para(s.netTutar)}</div><div className="text-muted">%{s.kdvOrani}</div></td>
                        <td>
                          <Form.Select size="sm" aria-label={`${s.sira}. kalem işlem`} value={sc?.mod} onChange={(e) => degistir(s.sira, { mod: e.target.value as Secim["mod"] })}>
                            <option value="kart">Var olan kart</option><option value="yeni">Yeni kart aç ({s.yeniKartBirimi})</option><option value="atla">Atla</option>
                          </Form.Select>
                          {sc?.mod === "kart" && (
                            <div className="mt-1 d-flex align-items-center gap-1">
                              {sc.kart ? <span>{sc.kart.kod} {sc.kart.ad}</span> : <span className="text-danger">kart seçilmedi</span>}
                              {s.oneri.kaynak && sc.kart?.stokKartId === s.oneri.stokKartId && <Badge bg="info">{KAYNAK_ADI[s.oneri.kaynak]}</Badge>}
                              <Button size="sm" variant="link" className="p-0 ms-auto" onClick={() => setKartSecici(s.sira)}>değiştir</Button>
                            </div>
                          )}
                          {sc?.mod !== "atla" && (
                            <Form.Check className="mt-1" id={`hatirla-${s.sira}`} aria-label={`${s.sira}. kalem hatırla`} label="eşleşmeyi hatırla" checked={!!sc?.hatirla} onChange={(e) => degistir(s.sira, { hatirla: e.target.checked })} />
                          )}
                        </td>
                        <td><Form.Control size="sm" aria-label={`${s.sira}. kalem çarpan`} disabled={sc?.mod === "atla"} value={sc?.carpan || ""} isInvalid={sc?.mod !== "atla" && !(c > 0)}
                          onChange={(e) => degistir(s.sira, { carpan: e.target.value })} /></td>
                        <td className="text-end text-nowrap">{sc?.mod !== "atla" && miktar ? <>{miktarYaz(miktar)} {birim}<div className="text-muted">{para(net!, 4)} / {birim}</div></> : ""}</td>
                        <td>
                          <Form.Control size="sm" type="date" aria-label={`${s.sira}. kalem SKT`} disabled={sc?.mod === "atla"} value={sc?.skt || ""}
                            isInvalid={sc?.mod === "kart" && !!sc.kart?.sktTakibi && !sc.skt} onChange={(e) => degistir(s.sira, { skt: e.target.value })} />
                          <Form.Control size="sm" className="mt-1" placeholder="Parti" maxLength={40} aria-label={`${s.sira}. kalem parti`} disabled={sc?.mod === "atla"} value={sc?.partiNo || ""}
                            onChange={(e) => degistir(s.sira, { partiNo: e.target.value })} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
                <div className="d-flex justify-content-end">
                  <Button variant="success" disabled={isleniyor || !!o.engel || !!o.alindi || !!sonuc} onClick={al}><IconPlus size={16} className="me-1" />Stoğa al (Stok Giriş Fişi)</Button>
                </div>
              </Card.Body>
            </Card>
          )}
        </Col>
      </Row>
      <StokKartSecici show={kartSecici !== null} onHide={() => setKartSecici(null)}
        onSelect={(k: StokKart) => {
          const s = o?.satirlar.find((x) => x.sira === kartSecici);
          if (s) degistir(s.sira, { mod: "kart", kart: { stokKartId: k.stokKartId, kod: k.kod, ad: k.ad, birim: k.birim, sktTakibi: !!k.sktTakibi }, carpan: metin(birimCarpani(s.birimKodu, k.birim)) });
          setKartSecici(null);
        }} />
      <LookupModal<CariKartItem> show={cariSecici} onHide={() => setCariSecici(false)} title="Tedarikçi seç" items={cariler || []} isLoading={!cariler}
        columns={[{ header: "Kod", width: "120px", render: (x) => x.kod, highlight: true }, { header: "Ad", render: (x) => x.ad }, { header: "VKN", render: (x) => x.vergiKimlikNo || "" }]}
        filterFn={(x, t) => `${x.kod} ${x.ad} ${x.vergiKimlikNo || ""}`.toLocaleLowerCase("tr-TR").includes(t.toLocaleLowerCase("tr-TR"))}
        onSelect={(x) => { setCariSecici(false); setCari({ id: x.id, kod: x.kod, ad: x.ad }); }} />
    </div>
  );
};

export default TicariEfaturaGirisPage;
