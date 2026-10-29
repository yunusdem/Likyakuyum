import React, { useEffect, useState } from "react";
import { Alert, Badge, Button, Card, Col, Form, InputGroup, Row, Spinner, Table } from "react-bootstrap";
import { IconArrowBackUp, IconCheck, IconEye, IconPercentage, IconPlus, IconX } from "@tabler/icons-react";
import ERPToolbar from "../../components/common/ERPToolbar";
import { LookupModal } from "../../components/common/LookupModal";
import { useToast } from "../../context/ToastContext";
import { CariKartItem, CariService } from "../../services/cariService";
import { ProductDefinitionService, ProductItem } from "../../services/productDefinitionService";
import { FiyatIslemiGecmisKaydi, FiyatIslemiGirdi, FiyatIslemiOnizleme, FiyatListesi, StokGrup, StokKart, TicariService, para } from "../../services/ticariService";
import { StokKartSecici } from "./StokKartSecici";
import { YETKI_YOK_MESAJI, useTicariYetki } from "./useTicariYetki";

/**
 * O- Fiyat İşlemleri (docs/TICARI_GERI_BILDIRIM_YOL_HARITASI.md İş 11, G11, G13, G14): hedef × liste × alan × işlem × yuvarlama →
 * önizleme (eski → yeni, atlananlar) → Uygula + kesin onay → geçmiş ve "Geri al".
 */
const ATLANMA: Record<string, string> = { para: "Para birimi farklı", alisYok: "Alış fiyatı yok", fiyatYok: "Fiyatı yok" };

export const FiyatIslemleriPage: React.FC = () => {
  const { showSuccess, showError } = useToast();
  const yetki = useTicariYetki();
  const [gruplar, setGruplar] = useState<StokGrup[]>([]);
  const [listeler, setListeler] = useState<FiyatListesi[]>([]);
  const [paralar, setParalar] = useState<ProductItem[]>([]);
  const [hedefTur, setHedefTur] = useState<"tumu" | "grup" | "tedarikci" | "secili">("grup");
  const [grupId, setGrupId] = useState("");
  const [tedarikci, setTedarikci] = useState<{ id: number; ad: string } | null>(null);
  const [cariler, setCariler] = useState<CariKartItem[] | null>(null);
  const [cariSecici, setCariSecici] = useState(false);
  const [secili, setSecili] = useState<StokKart[]>([]);
  const [kartSecici, setKartSecici] = useState(false);
  const [listeId, setListeId] = useState("");
  const [alan, setAlan] = useState<"satis" | "alis">("satis");
  const [islemTur, setIslemTur] = useState<"yuzde" | "tutar" | "alisKar">("yuzde");
  const [deger, setDeger] = useState("10");
  const [yuvarlama, setYuvarlama] = useState<"kurus" | "tl" | "99">("kurus");
  const [paraId, setParaId] = useState("");
  const [pasifler, setPasifler] = useState(false);
  const [aciklama, setAciklama] = useState("");
  const [onizleme, setOnizleme] = useState<FiyatIslemiOnizleme | null>(null);
  const [mesgul, setMesgul] = useState<"" | "onizle" | "uygula" | "geriAl">("");
  const [gecmis, setGecmis] = useState<FiyatIslemiGecmisKaydi[]>([]);

  const gecmisiYukle = () => TicariService.fiyatIslemiGecmis().then(setGecmis).catch(() => setGecmis([]));
  useEffect(() => {
    TicariService.gruplar().then(setGruplar).catch(() => setGruplar([]));
    TicariService.fiyatListeleri(true).then(setListeler).catch(() => setListeler([]));
    ProductDefinitionService.getProducts().then((l) => setParalar((l || []).filter((p) => Number(p.urunTipi) === 0 && !["TL", "TRY"].includes(String(p.kod).trim().toUpperCase())))).catch(() => setParalar([]));
    void gecmisiYukle();
  }, []);
  // Önizleme girdi değişince eskir
  useEffect(() => { setOnizleme(null); }, [hedefTur, grupId, tedarikci, secili, listeId, alan, islemTur, deger, yuvarlama, paraId, pasifler]);

  const girdi = (): FiyatIslemiGirdi => ({
    hedef: { tur: hedefTur, grupId: grupId ? Number(grupId) : null, cariId: tedarikci?.id ?? null, kartIdler: secili.map((k) => k.stokKartId) },
    fiyatListesiId: alan === "satis" && listeId ? Number(listeId) : null,
    alan,
    islem: { tur: islemTur, deger: Number(deger.replace(",", ".")) },
    yuvarlama,
    paraId: paraId ? Number(paraId) : null,
    pasifler,
    aciklama: aciklama.trim() || null,
  });
  const gecerli = Number.isFinite(Number(deger.replace(",", "."))) && deger.trim() !== "" && (hedefTur !== "grup" || grupId) && (hedefTur !== "tedarikci" || tedarikci) && (hedefTur !== "secili" || secili.length > 0);

  const onizle = async () => {
    if (!gecerli) return;
    setMesgul("onizle");
    try { setOnizleme(await TicariService.fiyatIslemiOnizle(girdi())); }
    catch (e: any) { showError(e?.message || "Önizleme alınamadı."); }
    finally { setMesgul(""); }
  };
  const uygula = async () => {
    if (!onizleme || !onizleme.degisecek) return;
    const g = girdi();
    const ozet = `${onizleme.degisecek} kartın ${alan === "alis" ? "alış" : "satış"} fiyatı${g.fiyatListesiId ? ` (${listeler.find((l) => l.fiyatListesiId === g.fiyatListesiId)?.ad} listesi)` : ""} değişecek${onizleme.atlanan ? `, ${onizleme.atlanan} kart atlanacak` : ""}.`;
    if (!window.confirm(`${ozet}\n\nUygulansın mı? (Geçmişten geri alınabilir)`)) return;
    setMesgul("uygula");
    try {
      const r = await TicariService.fiyatIslemiUygula(g);
      showSuccess(r.degisen ? `${r.degisen} kartın fiyatı güncellendi (işlem ${r.islemNo}).` : "Değişecek kart yok.");
      setOnizleme(null);
      void gecmisiYukle();
    } catch (e: any) { showError(e?.message || "Uygulanamadı."); }
    finally { setMesgul(""); }
  };
  const geriAl = async (g: FiyatIslemiGecmisKaydi) => {
    if (!window.confirm(`${g.islemNo}. işlem geri alınsın mı? ${g.kart} kartın fiyatı işlem öncesine döner.`)) return;
    setMesgul("geriAl");
    try { const r = await TicariService.fiyatIslemiGeriAl(g.islemNo); showSuccess(`${r.degisen} kartın fiyatı geri alındı (işlem ${r.islemNo}).`); void gecmisiYukle(); setOnizleme(null); }
    catch (e: any) { showError(e?.message || "Geri alınamadı."); }
    finally { setMesgul(""); }
  };

  const yonetebilir = yetki.yonetebilir;
  const sonGeriAlinabilir = gecmis.find((g) => !g.geriAlindi) || null;

  return (
    <div className="container-fluid p-2">
      <ERPToolbar pageTitle="O- Fiyat İşlemleri" pageIcon={<IconPercentage size={20} />} onRefresh={() => { setOnizleme(null); void gecmisiYukle(); }} hideSave hideDelete hideNew hidePrint />
      {!yetki.yukleniyor && !yonetebilir && <Alert variant="warning" className="py-2">{YETKI_YOK_MESAJI} Fiyat işlemi yapamazsınız.</Alert>}
      <Row className="g-2">
        <Col lg={4}>
          <Card className="border shadow-xs mb-2">
            <Card.Header className="bg-light py-2 fw-bold small">1. Hedef</Card.Header>
            <Card.Body className="p-2">
              <Form.Select size="sm" value={hedefTur} onChange={(e) => setHedefTur(e.target.value as any)} className="mb-2">
                <option value="grup">Ürün grubu</option><option value="tedarikci">Tedarikçi (toptancı)</option><option value="secili">Seçili kartlar</option><option value="tumu">Tüm kartlar</option>
              </Form.Select>
              {hedefTur === "grup" && <Form.Select size="sm" value={grupId} onChange={(e) => setGrupId(e.target.value)}><option value="">Grup seçin…</option>{gruplar.map((g) => <option key={g.stokGrupId} value={g.stokGrupId}>{g.ad} ({g.kartSayisi})</option>)}</Form.Select>}
              {hedefTur === "tedarikci" && (
                <InputGroup size="sm">
                  <Form.Control readOnly value={tedarikci?.ad || ""} placeholder="Tedarikçi cari seçin…" style={{ cursor: "pointer" }} onClick={async () => { if (!cariler) { try { setCariler(await CariService.getCariKartlar()); } catch { setCariler([]); } } setCariSecici(true); }} />
                  <Button variant="outline-primary" onClick={async () => { if (!cariler) { try { setCariler(await CariService.getCariKartlar()); } catch { setCariler([]); } } setCariSecici(true); }}>Seç</Button>
                </InputGroup>
              )}
              {hedefTur === "secili" && (
                <div>
                  <Button size="sm" variant="outline-primary" onClick={() => setKartSecici(true)}><IconPlus size={14} className="me-1" />Kart ekle</Button>
                  <div className="mt-1 d-flex flex-wrap gap-1">{secili.map((k) => <Badge key={k.stokKartId} bg="light" text="dark" className="border d-flex align-items-center gap-1">{k.kod} {k.ad}<IconX size={12} role="button" onClick={() => setSecili((p) => p.filter((x) => x.stokKartId !== k.stokKartId))} /></Badge>)}</div>
                </div>
              )}
              <Form.Check type="switch" id="pasifler" className="mt-2 small" label="Pasif kartlar da" checked={pasifler} onChange={(e) => setPasifler(e.target.checked)} />
            </Card.Body>
          </Card>
          <Card className="border shadow-xs mb-2">
            <Card.Header className="bg-light py-2 fw-bold small">2. Fiyat ve işlem</Card.Header>
            <Card.Body className="p-2">
              <Row className="g-2">
                <Col xs={6}><Form.Label className="small text-muted mb-1">Alan</Form.Label><Form.Select size="sm" value={alan} onChange={(e) => { setAlan(e.target.value as any); if (e.target.value === "alis") { setListeId(""); if (islemTur === "alisKar") setIslemTur("yuzde"); } }}><option value="satis">Satış fiyatı</option><option value="alis">Alış fiyatı</option></Form.Select></Col>
                <Col xs={6}><Form.Label className="small text-muted mb-1">Liste</Form.Label><Form.Select size="sm" value={listeId} disabled={alan === "alis"} onChange={(e) => setListeId(e.target.value)}><option value="">Ana liste</option>{listeler.map((l) => <option key={l.fiyatListesiId} value={l.fiyatListesiId}>{l.ad}</option>)}</Form.Select></Col>
                <Col xs={6}><Form.Label className="small text-muted mb-1">İşlem</Form.Label><Form.Select size="sm" value={islemTur} onChange={(e) => setIslemTur(e.target.value as any)}><option value="yuzde">Yüzde artır / azalt</option><option value="tutar">Tutar ekle / düş</option>{alan === "satis" && <option value="alisKar">Alış fiyatı × kâr %</option>}</Form.Select></Col>
                <Col xs={6}><Form.Label className="small text-muted mb-1">{islemTur === "tutar" ? "Tutar (eksi: düş)" : "Yüzde (eksi: azalt)"}</Form.Label><Form.Control size="sm" className="text-end" inputMode="decimal" value={deger} onChange={(e) => setDeger(e.target.value.replace(/[^0-9.,-]/g, ""))} /></Col>
                {islemTur === "tutar" && <Col xs={12}><Form.Label className="small text-muted mb-1">Para birimi (yalnız bu para birimindeki kartlar değişir)</Form.Label><Form.Select size="sm" value={paraId} onChange={(e) => setParaId(e.target.value)}><option value="">TL</option>{paralar.map((p) => <option key={p.id} value={p.id}>{String(p.kod).trim()}</option>)}</Form.Select></Col>}
                <Col xs={12}><Form.Label className="small text-muted mb-1">Yuvarlama</Form.Label><Form.Select size="sm" value={yuvarlama} onChange={(e) => setYuvarlama(e.target.value as any)}><option value="kurus">Kuruş (12,34)</option><option value="tl">Tam TL (12)</option><option value="99">,99 (11,99)</option></Form.Select></Col>
                <Col xs={12}><Form.Label className="small text-muted mb-1">Açıklama (geçmişte görünür)</Form.Label><Form.Control size="sm" maxLength={300} value={aciklama} onChange={(e) => setAciklama(e.target.value)} placeholder="Ör. Kasım zammı" /></Col>
              </Row>
              <div className="d-grid gap-1 mt-2">
                <Button variant="outline-primary" disabled={!gecerli || !yonetebilir || !!mesgul} onClick={() => void onizle()}>{mesgul === "onizle" ? <Spinner size="sm" className="me-1" /> : <IconEye size={16} className="me-1" />}Önizle</Button>
                <Button variant="dark" className="fw-bold" disabled={!onizleme || !onizleme.degisecek || !yonetebilir || !!mesgul} onClick={() => void uygula()}>{mesgul === "uygula" ? <Spinner size="sm" className="me-1" /> : <IconCheck size={16} className="me-1" />}Uygula{onizleme?.degisecek ? ` (${onizleme.degisecek} kart)` : ""}</Button>
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col lg={8}>
          <Card className="border shadow-xs mb-2">
            <Card.Header className="bg-light py-2 d-flex align-items-center gap-2"><span className="fw-bold small">3. Önizleme</span>
              {onizleme && <span className="small text-muted">{onizleme.toplam} kart · {onizleme.degisecek} değişecek · {onizleme.atlanan} atlanacak{onizleme.kesildi ? " · ilk 5.000 satır gösteriliyor" : ""}</span>}
            </Card.Header>
            <div className="table-responsive" style={{ maxHeight: "calc(100vh - 480px)", minHeight: 200 }}>
              <Table size="sm" bordered hover className="align-middle mb-0 text-nowrap">
                <thead className="table-light sticky-top"><tr className="small text-secondary"><th>Kod</th><th>Ürün</th><th>Para</th><th className="text-end">Eski</th><th className="text-end">Yeni</th><th>Durum</th></tr></thead>
                <tbody>
                  {!onizleme ? <tr><td colSpan={6} className="text-center py-4 text-muted">Hedefi ve işlemi seçip "Önizle"ye basın. Fiyatlar uygulamadan önce burada görünür.</td></tr>
                    : onizleme.satirlar.length === 0 ? <tr><td colSpan={6} className="text-center py-4 text-muted">Hedefte kart yok.</td></tr>
                    : onizleme.satirlar.map((s) => (
                      <tr key={s.stokKartId} className={s.atlandi ? "text-muted" : s.yeni !== s.eski ? "" : "text-muted"}>
                        <td className="font-monospace">{s.kod}</td><td>{s.ad}</td><td className="small">{s.paraKodu}</td>
                        <td className="text-end">{s.eski === null ? "—" : para(s.eski)}</td>
                        <td className={`text-end fw-bold ${s.atlandi ? "" : (s.yeni ?? 0) > (s.eski ?? 0) ? "text-success" : (s.yeni ?? 0) < (s.eski ?? 0) ? "text-danger" : ""}`}>{s.yeni === null ? "—" : para(s.yeni)}</td>
                        <td className="small">{s.atlandi ? <Badge bg="secondary">{ATLANMA[s.atlandi]}</Badge> : s.yeni === s.eski ? "değişmez" : ""}</td>
                      </tr>
                    ))}
                </tbody>
              </Table>
            </div>
          </Card>
          <Card className="border shadow-xs">
            <Card.Header className="bg-light py-2 d-flex align-items-center gap-2"><span className="fw-bold small">Geçmiş</span>
              {sonGeriAlinabilir && <Button size="sm" variant="outline-danger" className="ms-auto py-0" disabled={!yonetebilir || !!mesgul} onClick={() => void geriAl(sonGeriAlinabilir)}><IconArrowBackUp size={14} className="me-1" />Son işlemi geri al ({sonGeriAlinabilir.islemNo})</Button>}
            </Card.Header>
            <div className="table-responsive" style={{ maxHeight: 240 }}>
              <Table size="sm" bordered hover className="align-middle mb-0 text-nowrap small">
                <thead className="table-light sticky-top"><tr className="text-secondary"><th>İşlem</th><th>Tarih</th><th>Açıklama</th><th>Alan</th><th>Liste</th><th className="text-end">Kart</th><th>Kullanıcı</th><th></th></tr></thead>
                <tbody>
                  {gecmis.length === 0 ? <tr><td colSpan={8} className="text-center py-3 text-muted">Henüz işlem yok.</td></tr>
                    : gecmis.map((g) => (
                      <tr key={g.islemNo} className={g.geriAlindi ? "text-muted" : ""}>
                        <td>{g.islemNo}</td><td>{g.tarih ? new Date(g.tarih).toLocaleString("tr-TR") : ""}</td><td>{g.aciklama}</td><td>{g.alan === "ALIS" ? "Alış" : "Satış"}</td><td>{g.listeAdi || "Ana"}</td><td className="text-end">{g.kart}</td><td>{g.kullaniciAdi || ""}</td>
                        <td>{g.geriAlindi ? <Badge bg="secondary">geri alındı</Badge> : <Button size="sm" variant="link" className="py-0" disabled={!yonetebilir || !!mesgul} onClick={() => void geriAl(g)}>Geri al</Button>}</td>
                      </tr>
                    ))}
                </tbody>
              </Table>
            </div>
          </Card>
        </Col>
      </Row>
      <StokKartSecici show={kartSecici} onHide={() => setKartSecici(false)} onSelect={(k) => { setSecili((p) => (p.some((x) => x.stokKartId === k.stokKartId) ? p : [...p, k])); setKartSecici(false); }} />
      <LookupModal<CariKartItem>
        show={cariSecici} onHide={() => setCariSecici(false)} title="Tedarikçi Cari Seç" items={cariler || []} isLoading={!cariler}
        searchPlaceholder="Kod, ünvan ya da vergi no..."
        columns={[{ header: "Kod", width: "110px", render: (c) => <span className="font-monospace">{c.kod}</span>, highlight: true }, { header: "Ünvan", render: (c) => c.ad, highlight: true }]}
        filterFn={(c, t) => { const a = t.toLocaleLowerCase("tr-TR"); return String(c.kod || "").toLocaleLowerCase("tr-TR").includes(a) || String(c.ad || "").toLocaleLowerCase("tr-TR").includes(a); }}
        onSelect={(c) => { setTedarikci({ id: c.id, ad: c.ad }); setCariSecici(false); }} selectOnDoubleClick />
    </div>
  );
};

export default FiyatIslemleriPage;
