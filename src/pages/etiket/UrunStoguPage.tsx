import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Badge, Button, Card, Col, Form, InputGroup, Modal, Row, Spinner, Table } from "react-bootstrap";
import {
  IconCoin, IconDiamond, IconDownload, IconFileSpreadsheet, IconFileTypePdf, IconSearch, IconX, IconTrendingUp, IconTrendingDown,
  IconPackage, IconCash, IconScale, IconUserSearch, IconFilter,
} from "@tabler/icons-react";
import ERPToolbar from "../../components/common/ERPToolbar";
import LookupModal, { LookupColumn } from "../../components/common/LookupModal";
import { CariService, CariKartItem } from "../../services/cariService";
import { UrunStokService, UrunStokFiltre, UrunStokSecenekler, UrunStokSonuc, UrunStokTipi } from "../../services/urunStokService";

/**
 * I- Etiket İşlemleri › I- Altın Ürün Stoğu / J- Özel Ürün Stoğu.
 * Sayfa açılışında liste boştur; "Filtrele" ile yüklenir (hiçbir filtre seçilmezse tümü). Stok + alış (maliyet) + satış + kâr/zarar; PDF / Excel sunucuda üretilir.
 */

interface Props { tip: UrunStokTipi }

const bugun = () => new Date().toISOString().slice(0, 10);
const sayi = (v: number | null | undefined, hane = 2) =>
  v === null || v === undefined ? "" : Number(v).toLocaleString("tr-TR", { minimumFractionDigits: hane, maximumFractionDigits: hane });
const tarihTr = (g: string | null) => (g ? g.split("-").reverse().join(".") : "");

const UrunStoguPage: React.FC<Props> = ({ tip }) => {
  const altin = tip === "altin";
  const birim = altin ? "HAS" : "USD";
  const baslik = altin ? "I- Altın Ürün Stoğu" : "J- Özel Ürün Stoğu";
  const dosyaAdi = altin ? "altin-urun-stogu" : "ozel-urun-stogu";

  const varsayilanFiltre = (): UrunStokFiltre => ({ baslangic: bugun(), bitis: bugun(), tarihTuru: "satis", durum: "tumu" });
  const [filtre, setFiltre] = useState<UrunStokFiltre>(varsayilanFiltre);   // ekrandaki seçim
  const [uygulanan, setUygulanan] = useState<UrunStokFiltre | null>(null); // Filtrele'ye basılan son filtre (PDF/Excel bunu kullanır)
  const [secenekler, setSecenekler] = useState<UrunStokSecenekler>({ ayarlar: [], gruplar: [], ureticiler: [], bankolar: [] });
  const [veri, setVeri] = useState<UrunStokSonuc | null>(null);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [dosyaIsi, setDosyaIsi] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  const [cariler, setCariler] = useState<CariKartItem[]>([]);
  const [cariAdi, setCariAdi] = useState("");
  const [cariModal, setCariModal] = useState(false);
  const istekNo = useRef(0);

  useEffect(() => {
    setVeri(null); setUygulanan(null); setCariAdi(""); setHata(null);
    setFiltre(varsayilanFiltre());
    UrunStokService.secenekler(tip).then(setSecenekler).catch(() => undefined);
  }, [tip]);

  const yukle = useCallback(async (f: UrunStokFiltre) => {
    const no = ++istekNo.current;
    setYukleniyor(true); setHata(null);
    try {
      const v = await UrunStokService.veri(tip, f);
      if (no === istekNo.current) { setVeri(v); setUygulanan(f); }
    } catch (e: any) {
      if (no === istekNo.current) setHata(e?.response?.data?.message || e?.message || "Liste alınamadı.");
    } finally {
      if (no === istekNo.current) setYukleniyor(false);
    }
  }, [tip]);

  const filtrele = () => { void yukle(filtre); };
  const yenile = () => { if (uygulanan) void yukle(uygulanan); };
  const temizle = () => { setFiltre(varsayilanFiltre()); setCariAdi(""); };

  const guncelle = (k: keyof UrunStokFiltre, v: any) => setFiltre((f) => ({ ...f, [k]: v === "" || v === "all" ? undefined : v }));

  const cariAc = async () => {
    if (!cariler.length) {
      try { setCariler(await CariService.getCariKartlar()); } catch { /* liste boş kalır */ }
    }
    setCariModal(true);
  };
  const cariTemizle = () => { setCariAdi(""); guncelle("cariKartId", undefined); };
  const cariKolonlar: LookupColumn<CariKartItem>[] = [
    { header: "Kod", width: "120px", render: (c) => <span className="font-monospace fw-bold text-primary">{c.kod}</span> },
    { header: "Cari Adı", render: (c) => <span className="fw-semibold">{c.ad}</span> },
  ];

  const ozet = useMemo(() => {
    const bul = (d: string) => veri?.ozet.find((o) => o.durum === d);
    return { stokta: bul("Stokta"), satildi: bul("Satıldı"), toplam: bul("Toplam") };
  }, [veri]);

  const pdfOnizle = async () => {
    setDosyaIsi(true); setHata(null);
    try { setPdfUrl(await UrunStokService.pdfBlobUrl(tip, uygulanan || filtre)); }
    catch (e: any) { setHata(e?.message || "PDF üretilemedi."); }
    finally { setDosyaIsi(false); }
  };
  const pdfIndir = async () => {
    setDosyaIsi(true); setHata(null);
    try { const f = uygulanan || filtre; await UrunStokService.pdfIndir(tip, f, `${dosyaAdi}-${f.baslangic || ""}-${f.bitis || ""}`); }
    catch (e: any) { setHata(e?.message || "PDF indirilemedi."); }
    finally { setDosyaIsi(false); }
  };
  const excelIndir = async () => {
    setDosyaIsi(true); setHata(null);
    try { const f = uygulanan || filtre; await UrunStokService.excelIndir(tip, f, `${dosyaAdi}-${f.baslangic || ""}-${f.bitis || ""}`); }
    catch (e: any) { setHata(e?.message || "Excel indirilemedi."); }
    finally { setDosyaIsi(false); }
  };
  const pdfKapat = () => { if (pdfUrl) URL.revokeObjectURL(pdfUrl); setPdfUrl(null); };

  const karRenk = (v: number) => (v > 0 ? "text-success" : v < 0 ? "text-danger" : "");
  const satirlar = veri?.satirlar || [];
  const bos = !veri || satirlar.length === 0;

  return (
    <div className="container-fluid p-2">
      <ERPToolbar
        pageTitle={baslik}
        pageIcon={altin ? <IconCoin size={20} /> : <IconDiamond size={20} />}
        onRefresh={yenile}
        hideNew hideSave hideDelete hideSearch hideNavigation hidePrint
        rightContent={
          <div className="d-flex gap-1">
            <Button size="sm" variant="outline-danger" onClick={pdfOnizle} disabled={bos || dosyaIsi} title="A4 PDF önizleme"><IconFileTypePdf size={15} /> PDF</Button>
            <Button size="sm" variant="outline-primary" onClick={pdfIndir} disabled={bos || dosyaIsi} title="PDF indir"><IconDownload size={15} /> İndir</Button>
            <Button size="sm" variant="outline-success" onClick={excelIndir} disabled={bos || dosyaIsi} title="Excel indir"><IconFileSpreadsheet size={15} /> Excel</Button>
          </div>
        }
      />

      {hata && <Alert variant="danger" dismissible onClose={() => setHata(null)} className="py-2 mb-2">{hata}</Alert>}

      {/* Özet kartları */}
      <Row className="g-2 mb-2">
        <Col xs={12} sm={6} md={3}>
          <Card className="border-0 shadow-xs bg-primary bg-opacity-10 h-100">
            <Card.Body className="p-2 d-flex align-items-center justify-content-between">
              <div>
                <div className="text-muted small fw-semibold">Stokta</div>
                <div className="fs-6 fw-bold text-primary">{ozet.stokta?.adet ?? 0} adet · {sayi(ozet.stokta?.miktar)} {altin ? "gr" : ""}</div>
                <div className="small text-muted">Maliyet {sayi(ozet.stokta?.maliyet, 4)} {birim} · {sayi(ozet.stokta?.maliyetTl)} TL</div>
              </div>
              <div className="p-2 bg-primary text-white rounded-3"><IconPackage size={22} /></div>
            </Card.Body>
          </Card>
        </Col>
        <Col xs={12} sm={6} md={3}>
          <Card className="border-0 shadow-xs bg-warning bg-opacity-10 h-100">
            <Card.Body className="p-2 d-flex align-items-center justify-content-between">
              <div>
                <div className="text-muted small fw-semibold">Satıldı</div>
                <div className="fs-6 fw-bold text-warning-emphasis">{ozet.satildi?.adet ?? 0} adet · {sayi(ozet.satildi?.miktar)} {altin ? "gr" : ""}</div>
                <div className="small text-muted">Satış {sayi(ozet.satildi?.satis, 4)} {birim} · {sayi(ozet.satildi?.satisTl)} TL</div>
              </div>
              <div className="p-2 bg-warning text-dark rounded-3"><IconScale size={22} /></div>
            </Card.Body>
          </Card>
        </Col>
        <Col xs={12} sm={6} md={3}>
          <Card className="border-0 shadow-xs bg-secondary bg-opacity-10 h-100">
            <Card.Body className="p-2 d-flex align-items-center justify-content-between">
              <div>
                <div className="text-muted small fw-semibold">Satış Maliyeti</div>
                <div className="fs-6 fw-bold text-dark">{sayi(ozet.satildi?.maliyet, 4)} {birim}</div>
                <div className="small text-muted">{sayi(ozet.satildi?.maliyetTl)} TL</div>
              </div>
              <div className="p-2 bg-secondary text-white rounded-3"><IconCash size={22} /></div>
            </Card.Body>
          </Card>
        </Col>
        <Col xs={12} sm={6} md={3}>
          <Card className={`border-0 shadow-xs ${(ozet.satildi?.karTl ?? 0) < 0 ? "bg-danger" : "bg-success"} bg-opacity-10 h-100`}>
            <Card.Body className="p-2 d-flex align-items-center justify-content-between">
              <div>
                <div className="text-muted small fw-semibold">Satış Kâr / Zarar</div>
                <div className={`fs-6 fw-bold ${karRenk(ozet.satildi?.karTl ?? 0)}`}>{sayi(ozet.satildi?.kar, 4)} {birim} · {sayi(ozet.satildi?.karTl)} TL</div>
                <div className="small text-muted">Kâr %{ozet.satildi?.karYuzde === null || ozet.satildi?.karYuzde === undefined ? "-" : sayi(ozet.satildi.karYuzde)}</div>
              </div>
              <div className={`p-2 ${(ozet.satildi?.karTl ?? 0) < 0 ? "bg-danger" : "bg-success"} text-white rounded-3`}>
                {(ozet.satildi?.karTl ?? 0) < 0 ? <IconTrendingDown size={22} /> : <IconTrendingUp size={22} />}
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Filtreler */}
      <Card className="border shadow-xs mb-2">
        <Card.Body className="p-2">
          <Row className="g-2 align-items-end">
            <Col xs={6} sm={4} md={2} lg={1}>
              <Form.Label className="small text-muted mb-1 fw-bold">Tarih türü</Form.Label>
              <Form.Select size="sm" value={filtre.tarihTuru || "satis"} onChange={(e) => guncelle("tarihTuru", e.target.value)}>
                <option value="satis">Satış tarihi</option>
                <option value="kayit">Kayıt tarihi</option>
              </Form.Select>
            </Col>
            <Col xs={6} sm={4} md={2} lg={1}>
              <Form.Label className="small text-muted mb-1 fw-bold">Başlangıç</Form.Label>
              <Form.Control size="sm" type="date" value={filtre.baslangic || ""} onChange={(e) => guncelle("baslangic", e.target.value)} />
            </Col>
            <Col xs={6} sm={4} md={2} lg={1}>
              <Form.Label className="small text-muted mb-1 fw-bold">Bitiş</Form.Label>
              <Form.Control size="sm" type="date" value={filtre.bitis || ""} onChange={(e) => guncelle("bitis", e.target.value)} />
            </Col>
            <Col xs={6} sm={4} md={2} lg={1}>
              <Form.Label className="small text-muted mb-1 fw-bold">Durum</Form.Label>
              <Form.Select size="sm" value={filtre.durum || "tumu"} onChange={(e) => guncelle("durum", e.target.value)}>
                <option value="tumu">Tümü</option>
                <option value="stokta">Stokta</option>
                <option value="satildi">Satıldı</option>
              </Form.Select>
            </Col>
            <Col xs={6} sm={4} md={2} lg={1}>
              <Form.Label className="small text-muted mb-1 fw-bold">Ayar</Form.Label>
              <Form.Select size="sm" value={filtre.ayar || "all"} onChange={(e) => guncelle("ayar", e.target.value)}>
                <option value="all">Tümü</option>
                {secenekler.ayarlar.map((a) => <option key={a} value={a}>{a}</option>)}
              </Form.Select>
            </Col>
            <Col xs={6} sm={4} md={2} lg={1}>
              <Form.Label className="small text-muted mb-1 fw-bold">Grup</Form.Label>
              <Form.Select size="sm" value={filtre.grupKodu || "all"} onChange={(e) => guncelle("grupKodu", e.target.value)}>
                <option value="all">Tümü</option>
                {secenekler.gruplar.map((g) => <option key={g} value={g}>{g}</option>)}
              </Form.Select>
            </Col>
            <Col xs={6} sm={4} md={2} lg={2}>
              <Form.Label className="small text-muted mb-1 fw-bold">Üretici</Form.Label>
              <Form.Select size="sm" value={filtre.ureticiFirma || "all"} onChange={(e) => guncelle("ureticiFirma", e.target.value)}>
                <option value="all">Tümü</option>
                {secenekler.ureticiler.map((u) => <option key={u} value={u}>{u}</option>)}
              </Form.Select>
            </Col>
            <Col xs={6} sm={4} md={2} lg={1}>
              <Form.Label className="small text-muted mb-1 fw-bold">Banko</Form.Label>
              <Form.Select size="sm" value={filtre.banko || "all"} onChange={(e) => guncelle("banko", e.target.value)}>
                <option value="all">Tümü</option>
                {secenekler.bankolar.map((b) => <option key={b} value={b}>{b}</option>)}
              </Form.Select>
            </Col>
            <Col xs={12} sm={6} md={4} lg={2}>
              <Form.Label className="small text-muted mb-1 fw-bold">Müşteri</Form.Label>
              <InputGroup size="sm">
                <Form.Control readOnly value={cariAdi} placeholder="Tümü" onClick={cariAc} style={{ cursor: "pointer" }} />
                {filtre.cariKartId ? (
                  <Button variant="outline-secondary" onClick={cariTemizle} title="Temizle"><IconX size={14} /></Button>
                ) : (
                  <Button variant="outline-secondary" onClick={cariAc} title="Cari seç"><IconUserSearch size={14} /></Button>
                )}
              </InputGroup>
            </Col>
            <Col xs={12} sm={6} md={4} lg={2}>
              <Form.Label className="small text-muted mb-1 fw-bold">Ara</Form.Label>
              <InputGroup size="sm">
                <InputGroup.Text><IconSearch size={14} /></InputGroup.Text>
                <Form.Control value={filtre.search || ""} onChange={(e) => guncelle("search", e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") filtrele(); }} placeholder="Barkod, ürün adı, orijinal kod, grup" />
                {filtre.search && <Button variant="outline-secondary" onClick={() => guncelle("search", "")}><IconX size={14} /></Button>}
              </InputGroup>
            </Col>
            <Col xs={12} sm={6} md={4} lg={2} className="d-flex gap-1">
              <Button size="sm" variant="primary" onClick={filtrele} disabled={yukleniyor} className="flex-grow-1">
                {yukleniyor ? <Spinner animation="border" size="sm" /> : <IconFilter size={15} />} Filtrele
              </Button>
              <Button size="sm" variant="outline-secondary" onClick={temizle} title="Filtreleri sıfırla"><IconX size={15} /></Button>
            </Col>
          </Row>
          {veri?.kurAciklama && <div className="small text-muted mt-2">{veri.kurAciklama} · Satılanlarda fatura günü kuru, stoktakilerde güncel kur.</div>}
        </Card.Body>
      </Card>

      {/* Liste */}
      <Card className="border shadow-xs">
        <Card.Body className="p-0">
          <div className="table-responsive" style={{ maxHeight: "calc(100vh - 360px)", minHeight: "300px" }}>
            <Table hover striped bordered size="sm" className="align-middle mb-0 text-nowrap">
              <thead className="table-light sticky-top">
                <tr>
                  <th>Kayıt</th>
                  <th>Grup-No</th>
                  <th>Barkod</th>
                  <th>{altin ? "Model" : "Mamul"}</th>
                  <th className="text-center">Ayar</th>
                  <th className="text-end">{altin ? "Gram" : "Miktar"}</th>
                  {altin && <th className="text-end">Has gr</th>}
                  <th className="text-end">Maliyet {birim}</th>
                  <th className="text-end">Maliyet TL</th>
                  <th className="text-end">Satış {birim}</th>
                  <th className="text-end">Satış TL</th>
                  <th className="text-end">Kâr {birim}</th>
                  <th className="text-end">Kâr TL</th>
                  <th className="text-end">Kâr %</th>
                  <th className="text-center">Durum</th>
                  <th>Satış T.</th>
                  <th>Fatura</th>
                  <th>Müşteri</th>
                  <th>Üretici</th>
                  <th>Banko</th>
                </tr>
              </thead>
              <tbody>
                {yukleniyor && !veri ? (
                  <tr><td colSpan={20} className="text-center py-4"><Spinner animation="border" size="sm" /> Yükleniyor…</td></tr>
                ) : !veri ? (
                  <tr><td colSpan={20} className="text-center text-muted py-5">Filtreleri seçip <b>Filtrele</b>'ye basın. Hiçbir şey seçilmezse tüm ürünler listelenir.</td></tr>
                ) : satirlar.length === 0 ? (
                  <tr><td colSpan={20} className="text-center text-muted py-4">Bu filtrelerle kayıt bulunamadı.</td></tr>
                ) : satirlar.map((s) => (
                  <tr key={s.urunId}>
                    <td>{tarihTr(s.tarih)}</td>
                    <td className="font-monospace">{s.grupUrun}</td>
                    <td className="font-monospace">{s.barkod}</td>
                    <td>{s.urunAdi}</td>
                    <td className="text-center">{s.ayar}</td>
                    <td className="text-end">{sayi(s.miktar)}{!altin && s.miktarBirimi ? ` ${s.miktarBirimi}` : ""}</td>
                    {altin && <td className="text-end">{sayi(s.hasGram, 4)}</td>}
                    <td className="text-end">{sayi(s.maliyet, 4)}{s.birim !== birim ? ` ${s.birim}` : ""}</td>
                    <td className="text-end">{sayi(s.maliyetTl)}</td>
                    <td className={`text-end ${s.satildi ? "" : "text-muted"}`} title={s.satildi ? "Fatura satırı (KDV hariç)" : "Etiket satış fiyatı"}>{sayi(s.satis, 4)}</td>
                    <td className={`text-end ${s.satildi ? "" : "text-muted"}`}>{sayi(s.satisTl)}</td>
                    <td className={`text-end fw-semibold ${s.satildi ? karRenk(s.kar) : "text-muted"}`}>{sayi(s.kar, 4)}</td>
                    <td className={`text-end fw-semibold ${s.satildi ? karRenk(s.karTl) : "text-muted"}`}>{sayi(s.karTl)}</td>
                    <td className={`text-end ${s.satildi ? karRenk(s.karTl) : "text-muted"}`}>{s.karYuzde === null ? "" : sayi(s.karYuzde)}</td>
                    <td className="text-center"><Badge bg={s.satildi ? "warning" : "success"} text={s.satildi ? "dark" : undefined}>{s.durum}</Badge></td>
                    <td>{tarihTr(s.satisTarihi)}</td>
                    <td className="font-monospace">{s.faturaNo}</td>
                    <td>{s.musteri}</td>
                    <td>{s.ureticiFirma}</td>
                    <td>{s.banko}</td>
                  </tr>
                ))}
              </tbody>
              {satirlar.length > 0 && ozet.toplam && (
                <tfoot className="table-light fw-bold">
                  <tr>
                    <td colSpan={5}>Toplam ({ozet.toplam.adet} adet)</td>
                    <td className="text-end">{sayi(ozet.toplam.miktar)}</td>
                    {altin && <td className="text-end">{sayi(ozet.toplam.hasGram, 4)}</td>}
                    <td className="text-end">{sayi(ozet.toplam.maliyet, 4)}</td>
                    <td className="text-end">{sayi(ozet.toplam.maliyetTl)}</td>
                    <td className="text-end">{sayi(ozet.toplam.satis, 4)}</td>
                    <td className="text-end">{sayi(ozet.toplam.satisTl)}</td>
                    <td className={`text-end ${karRenk(ozet.toplam.kar)}`}>{sayi(ozet.toplam.kar, 4)}</td>
                    <td className={`text-end ${karRenk(ozet.toplam.karTl)}`}>{sayi(ozet.toplam.karTl)}</td>
                    <td className="text-end">{ozet.toplam.karYuzde === null ? "" : sayi(ozet.toplam.karYuzde)}</td>
                    <td colSpan={6}></td>
                  </tr>
                </tfoot>
              )}
            </Table>
          </div>
        </Card.Body>
        <Card.Footer className="py-1 px-2 small text-muted d-flex justify-content-between">
          <span>{veri ? `${veri.toplamKayit} kayıt` : ""}{yukleniyor && veri ? " · yenileniyor…" : ""}</span>
          <span>{veri?.filtreOzeti}</span>
        </Card.Footer>
      </Card>

      <LookupModal<CariKartItem>
        show={cariModal}
        onHide={() => setCariModal(false)}
        title="Müşteri (Cari) Seçimi"
        items={cariler}
        columns={cariKolonlar}
        filterFn={(c, t) => { const k = t.toLowerCase(); return (c.kod || "").toLowerCase().includes(k) || (c.ad || "").toLowerCase().includes(k); }}
        onSelect={(c) => { setCariAdi(c.ad); guncelle("cariKartId", c.id); setCariModal(false); }}
      />

      <Modal show={!!pdfUrl} onHide={pdfKapat} size="xl" centered>
        <Modal.Header closeButton className="py-2">
          <Modal.Title className="fs-6 d-flex align-items-center gap-2"><IconFileTypePdf size={18} className="text-danger" />{baslik} — A4 önizleme</Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-0">{pdfUrl && <iframe title="PDF" src={pdfUrl} style={{ width: "100%", height: "80vh", border: 0 }} />}</Modal.Body>
        <Modal.Footer className="py-2">
          <Button size="sm" variant="outline-primary" onClick={pdfIndir} disabled={dosyaIsi}><IconDownload size={15} /> İndir</Button>
          <Button size="sm" variant="secondary" onClick={pdfKapat}><IconX size={15} /> Kapat</Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default UrunStoguPage;
