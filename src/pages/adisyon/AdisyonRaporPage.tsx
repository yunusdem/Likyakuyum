import React, { useCallback, useEffect, useState } from "react";
import { Alert, Badge, Button, Card, Col, Form, InputGroup, Row, Spinner, Table } from "react-bootstrap";
import { IconPrinter, IconReportAnalytics } from "@tabler/icons-react";
import { Link } from "react-router-dom";
import ERPToolbar from "../../components/common/ERPToolbar";
import { useToast } from "../../context/ToastContext";
import { CompanyService } from "../../services/companyService";
import { AdisyonRaporu, AdisyonService } from "../../services/adisyonService";
import { para } from "../../services/ticariService";
import { htmlYazdir, RaporBicimi } from "../ticari/ticariRaporCikti";
import { adisyonRaporHtml, servisPaylari } from "./adisyonRaporCikti";
import { AdisyonKapananlar } from "./AdisyonKapananlar";
import { sureYaz } from "../../../Backend/src/services/adisyon/adisyonHesap";

/**
 * Adisyon › Raporlar (docs/TICARI_ADISYON_YOL_HARITASI.md, TA40, D10): gün sonu — ciro (adisyon fişleri, Ticari gün sonuyla aynı gün
 * kuralı), ödeme türleri, satış türü, garsonlar, servis ücreti dağıtımı (İş K. 51: çalışanlara eşit), ürünler, ikram / iptal ve
 * nedenleri, açık adisyonlar (varsa gün sonu uyarısı). 80 mm ve A4 yazdırma.
 */
const bugun = () => new Date().toLocaleDateString("en-CA");
const miktar = (n: number) => Number(n).toLocaleString("tr-TR", { maximumFractionDigits: 4 });

const Kutu: React.FC<{ baslik: string; deger: string; alt?: string; renk?: string }> = ({ baslik, deger, alt, renk }) => (
  <Card className="border shadow-xs h-100">
    <Card.Body className="py-2">
      <div className="small text-muted">{baslik}</div>
      <div className="fs-5 fw-bold" style={renk ? { color: renk } : undefined}>{deger}</div>
      {alt && <div className="small text-muted">{alt}</div>}
    </Card.Body>
  </Card>
);
const Bolum: React.FC<{ baslik: string; children: React.ReactNode; sag?: React.ReactNode }> = ({ baslik, children, sag }) => (
  <Card className="border shadow-xs h-100">
    <Card.Header className="bg-light py-2 small fw-bold d-flex align-items-center">{baslik}<span className="ms-auto">{sag}</span></Card.Header>
    <Card.Body className="p-0">{children}</Card.Body>
  </Card>
);

export const AdisyonRaporPage: React.FC = () => {
  const { showError } = useToast();
  const [baslangic, setBaslangic] = useState(bugun());
  const [bitis, setBitis] = useState(bugun());
  const [rapor, setRapor] = useState<AdisyonRaporu | null>(null);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [firmaAdi, setFirmaAdi] = useState("");
  const [calisan, setCalisan] = useState<number | null>(null);

  useEffect(() => { CompanyService.getDefinitions().then((d: any) => setFirmaAdi(String(d?.FIRMA_ADI || "").trim())).catch(() => undefined); }, []);
  const getir = useCallback(async () => {
    setYukleniyor(true); setHata(null);
    try { const r = await AdisyonService.rapor(baslangic, bitis); setRapor(r); setCalisan((c) => c ?? r.servisDagitimi.etkinGarson); } catch (e: any) { setRapor(null); setHata(e?.message || "Rapor alınamadı."); } finally { setYukleniyor(false); }
  }, [baslangic, bitis]);
  useEffect(() => { void getir(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const yazdir = (b: RaporBicimi) => { if (rapor && !htmlYazdir(adisyonRaporHtml(rapor, firmaAdi, b, calisan))) showError("Yazdırma penceresi açılamadı (açılır pencere engelli olabilir)."); };
  const r = rapor, o = r?.ozet;
  const paylar = r ? servisPaylari(r.servisDagitimi.toplam, calisan ?? 0) : [];

  return (
    <div className="container-fluid py-3">
      <ERPToolbar pageTitle="Adisyon Raporu" pageIcon={<IconReportAnalytics size={20} />} hideNew hideDelete hideSearch hideNavigation onPrint={r ? () => yazdir("A4") : undefined} hidePrint={!r} onRefresh={getir} disabled={yukleniyor} />
      <Card className="border shadow-xs mb-3">
        <Card.Body className="py-2 d-flex align-items-end gap-2 flex-wrap">
          <Form.Group><Form.Label className="small fw-bold mb-1">Başlangıç</Form.Label><Form.Control size="sm" type="date" aria-label="Başlangıç" value={baslangic} onChange={(e) => setBaslangic(e.target.value)} /></Form.Group>
          <Form.Group><Form.Label className="small fw-bold mb-1">Bitiş</Form.Label><Form.Control size="sm" type="date" aria-label="Bitiş" value={bitis} onChange={(e) => setBitis(e.target.value)} /></Form.Group>
          <Button size="sm" variant="primary" disabled={yukleniyor} onClick={() => void getir()}>{yukleniyor ? <Spinner size="sm" /> : "Getir"}</Button>
          <span className="ms-auto d-flex gap-2">
            <Button size="sm" variant="outline-secondary" disabled={!r} onClick={() => yazdir("80")}><IconPrinter size={15} className="me-1" />80 mm</Button>
            <Button size="sm" variant="outline-secondary" disabled={!r} onClick={() => yazdir("A4")}><IconPrinter size={15} className="me-1" />A4</Button>
          </span>
        </Card.Body>
      </Card>
      {hata && <Alert variant="danger" className="py-2">{hata}</Alert>}
      {!r && !hata && <Spinner size="sm" />}
      {r && o && (
        <>
          {r.acik.sayi > 0 && (
            <Alert variant="warning" className="py-2 d-flex align-items-center gap-2">
              <b>Açık adisyon var: {r.acik.sayi} ({para(r.acik.tutar)} TL).</b> Gün sonundan önce kapatın.
              <Link to="/adisyon/masalar" className="ms-auto btn btn-sm btn-outline-dark">Masalara git</Link>
            </Alert>
          )}
          <Row className="g-2 mb-3">
            <Col xs={6} md={3}><Kutu baslik={(o.iade || 0) > 0 ? "Net ciro" : "Ciro"} deger={`${para((o.iade || 0) > 0 ? o.netCiro ?? o.ciro : o.ciro)} TL`} alt={`${o.adisyon} adisyon · ${o.fis} fiş${(o.iade || 0) > 0 ? ` · Satış ${para(o.ciro)} − iade ${para(o.iade || 0)} (${o.iadeSayi})` : ""}`} renk="#15803d" /></Col>
            <Col xs={6} md={3}><Kutu baslik="Ortalama adisyon" deger={`${para(o.ortalama)} TL`} alt={o.kisi ? `Kişi başı ${para(o.kisiBasi)} TL (${o.kisi} kişi)` : undefined} /></Col>
            <Col xs={6} md={3}><Kutu baslik="İkram / iptal (değer)" deger={`${para(o.ikramDegeri)} / ${para(o.iptalDegeri)}`} alt={`${o.iptalAdisyon} iptal edilen adisyon`} renk="#b45309" /></Col>
            <Col xs={6} md={3}><Kutu baslik="Ortalama masa süresi" deger={o.ortalamaSure !== null ? sureYaz(o.ortalamaSure) : "—"} alt={`Ürün ${para(o.urunSatis)} · Servis ${para(o.servis)}${Math.abs(o.yuvarlama) > 0.004 ? ` · Yuvarlama ${para(o.yuvarlama)}` : ""}`} /></Col>
          </Row>
          <Row className="g-3">
            <Col lg={4}>
              <Bolum baslik="Ödeme türleri">
                <Table size="sm" className="mb-0"><tbody>
                  {r.odemeler.map((x) => <tr key={x.arac}><td>{x.ad}</td><td className="text-end">{para(x.tutar)}</td></tr>)}
                  <tr className="fw-bold"><td>Toplam</td><td className="text-end">{para(r.odemeler.reduce((t, x) => t + x.tutar, 0))}</td></tr>
                </tbody></Table>
              </Bolum>
            </Col>
            <Col lg={4}>
              <Bolum baslik="Satış türü">
                <Table size="sm" className="mb-0"><tbody>
                  {r.turler.map((x) => <tr key={x.tur}><td>{x.ad}</td><td className="text-end">{x.adisyon}</td><td className="text-end">{para(x.ciro)}</td></tr>)}
                  {!r.turler.length && <tr><td className="text-muted">Satış yok.</td></tr>}
                </tbody></Table>
              </Bolum>
            </Col>
            <Col lg={4}>
              <Bolum baslik="Servis ücreti dağıtımı" sag={<span className="text-muted fw-normal">eşit pay</span>}>
                <div className="p-2 small">
                  <div className="d-flex justify-content-between"><span>Toplanan</span><b>{para(r.servisDagitimi.toplam)} TL</b></div>
                  <InputGroup size="sm" className="my-1" style={{ maxWidth: 220 }}>
                    <InputGroup.Text>Çalışan</InputGroup.Text>
                    <Form.Control aria-label="Çalışan sayısı" type="number" min={0} value={calisan ?? ""} onChange={(e) => setCalisan(e.target.value === "" ? null : Math.max(0, Math.floor(Number(e.target.value))))} />
                  </InputGroup>
                  <div className="d-flex justify-content-between"><span>Kişi başı pay</span><b>{paylar.length ? `${para(paylar[0])} TL` : "—"}</b></div>
                  {r.servisDagitimi.toplayan.length > 0 && <div className="text-muted mt-1">Toplayan: {r.servisDagitimi.toplayan.map((x) => `${x.ad} ${para(x.toplanan)}`).join(", ")}</div>}
                </div>
              </Bolum>
            </Col>
            <Col lg={6}>
              <Bolum baslik="Garsonlar">
                <Table size="sm" className="mb-0" responsive>
                  <thead><tr><th>Garson</th><th className="text-end">Adisyon</th><th className="text-end">Ciro</th><th className="text-end">Servis</th><th className="text-end">İkram</th><th className="text-end">İptal</th></tr></thead>
                  <tbody>{r.garsonlar.map((x) => <tr key={x.ad}><td>{x.ad}</td><td className="text-end">{x.adisyon}</td><td className="text-end">{para(x.ciro)}</td><td className="text-end">{para(x.servis)}</td><td className="text-end">{x.ikram}</td><td className="text-end">{x.iptal}</td></tr>)}</tbody>
                </Table>
              </Bolum>
            </Col>
            <Col lg={6}>
              <Bolum baslik="Ürünler">
                <div style={{ maxHeight: 320, overflow: "auto" }}>
                  <Table size="sm" className="mb-0">
                    <thead><tr><th>Ürün</th><th className="text-end">Miktar</th><th className="text-end">Tutar</th><th className="text-end">İkram</th></tr></thead>
                    <tbody>{r.urunler.map((u) => <tr key={u.ad}><td>{u.ad}</td><td className="text-end">{miktar(u.miktar)} {u.birim !== "Adet" ? u.birim : ""}</td><td className="text-end">{para(u.tutar)}</td><td className="text-end">{u.ikramMiktar ? `${miktar(u.ikramMiktar)} (${para(u.ikramDeger)})` : ""}</td></tr>)}</tbody>
                  </Table>
                </div>
              </Bolum>
            </Col>
            <Col lg={12}>
              <Bolum baslik="İkram / iptal" sag={<span className="d-flex gap-1">{r.ikramIptal.nedenler.map((x) => <Badge key={`${x.tur}${x.neden}`} bg={x.tur === "ikram" ? "info" : "danger"}>{x.tur === "ikram" ? "İkram" : "İptal"}: {x.neden} ({x.adet}) {para(x.deger)}</Badge>)}</span>}>
                <Table size="sm" className="mb-0" responsive>
                  <thead><tr><th>Zaman</th><th>Adisyon</th><th>Yer</th><th>İşlem</th><th>Ürün</th><th>Neden</th><th>Yapan</th><th className="text-end">Değer</th></tr></thead>
                  <tbody>
                    {r.ikramIptal.satirlar.map((x, i) => (
                      <tr key={i}><td className="text-nowrap">{x.zaman.slice(11)}</td><td>{x.adisyonNo}</td><td>{x.yer}</td>
                        <td><span className="badge" style={{ background: x.tur === "ikram" ? "#0891b2" : "#dc2626" }}>{x.tur === "ikram" ? "İkram" : "İptal"}</span></td>
                        <td>{miktar(x.miktar)} {x.ad}</td><td>{x.neden}</td><td>{x.yapan}</td><td className="text-end">{para(x.deger)}</td></tr>
                    ))}
                    {!r.ikramIptal.satirlar.length && <tr><td colSpan={8} className="text-muted">İkram / iptal yok.</td></tr>}
                  </tbody>
                </Table>
              </Bolum>
            </Col>
            {r.acik.liste.length > 0 && (
              <Col lg={12}>
                <Bolum baslik={`Açık adisyonlar (${r.acik.sayi})`}>
                  <Table size="sm" className="mb-0" responsive>
                    <thead><tr><th>Adisyon</th><th>Yer</th><th>Garson</th><th>Süre</th><th className="text-end">Kalem</th><th className="text-end">Tutar</th></tr></thead>
                    <tbody>{r.acik.liste.map((x) => <tr key={x.adisyonId}><td>{x.adisyonNo}{x.hesapIstendi && <Badge bg="warning" text="dark" className="ms-1">Hesap istendi</Badge>}</td><td>{x.yer}</td><td>{x.garson}</td><td>{sureYaz(x.dakika)}</td><td className="text-end">{x.kalem}</td><td className="text-end">{para(x.tutar)}</td></tr>)}</tbody>
                  </Table>
                </Bolum>
              </Col>
            )}
            <Col lg={12}><AdisyonKapananlar gun={bitis} /></Col>
          </Row>
        </>
      )}
    </div>
  );
};

export default AdisyonRaporPage;
