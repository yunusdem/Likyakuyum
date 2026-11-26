import React, { useCallback, useEffect, useState } from "react";
import { Alert, Badge, Button, ButtonGroup, Card, Col, Form, Row, Spinner, Table } from "react-bootstrap";
import { IconPrinter, IconReportMoney } from "@tabler/icons-react";
import ERPToolbar from "../../components/common/ERPToolbar";
import { useToast } from "../../context/ToastContext";
import { CashDeskService, VezneItem } from "../../services/cashDeskService";
import { CompanyService } from "../../services/companyService";
import { GunSonuRaporu, TicariService, miktarYaz } from "../../services/ticariService";
import { RaporBicimi, gunSonuHtml, htmlYazdir, tl } from "./ticariRaporCikti";
import { Link } from "react-router-dom";
import { AdisyonService } from "../../services/adisyonService";
import { useSayfaErisimi } from "../../hooks/useSayfaErisimi";

/**
 * Ticari › Gün Sonu Raporu (docs/TICARI_ADISYON_YOL_HARITASI.md, TA7). Tarih aralığı / kasiyer / vezne süzgeci; satış, iskonto,
 * iade, KDV oranları, ödeme türleri, gruplar, ürünler, kasiyerler ve saat dağılımı. 80 mm ve A4 yazdırma.
 */
const bugun = () => new Date().toLocaleDateString("en-CA");

const Kutu: React.FC<{ baslik: string; deger: string; alt?: string; renk?: string }> = ({ baslik, deger, alt, renk }) => (
  <Card className="border shadow-xs h-100">
    <Card.Body className="py-2">
      <div className="small text-muted">{baslik}</div>
      <div className={`fs-5 fw-bold ${renk || ""}`}>{deger}</div>
      {alt && <div className="small text-muted">{alt}</div>}
    </Card.Body>
  </Card>
);

export const TicariGunSonuPage: React.FC = () => {
  const { showError } = useToast();
  const [baslangic, setBaslangic] = useState(bugun());
  const [bitis, setBitis] = useState(bugun());
  const [kasiyerId, setKasiyerId] = useState<number | null>(null);
  const [vezneId, setVezneId] = useState<number | null>(null);
  const [vezneler, setVezneler] = useState<VezneItem[]>([]);
  const [rapor, setRapor] = useState<GunSonuRaporu | null>(null);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [firmaAdi, setFirmaAdi] = useState("");
  // Adisyon açıksa gün sonu uyarısı (TA40): açık masa / paket varken satışları eksik kalır
  const adisyonAcik = useSayfaErisimi()("/adisyon/masalar");
  const [acikAdisyon, setAcikAdisyon] = useState<{ sayi: number; tutar: number } | null>(null);

  useEffect(() => {
    CashDeskService.getVezneler().then(setVezneler).catch(() => setVezneler([]));
    CompanyService.getDefinitions().then((d) => setFirmaAdi(String(d?.FIRMA_ADI || "").trim())).catch(() => undefined);
  }, []);

  const getir = useCallback(async () => {
    setYukleniyor(true);
    setHata(null);
    if (adisyonAcik) AdisyonService.acikOzet().then(setAcikAdisyon).catch(() => setAcikAdisyon(null));
    try {
      setRapor(await TicariService.gunSonu({ baslangic, bitis, kasiyerId, vezneId }));
    } catch (e: any) {
      setRapor(null);
      setHata(e?.message || "Rapor alınamadı.");
    } finally {
      setYukleniyor(false);
    }
  }, [baslangic, bitis, kasiyerId, vezneId, adisyonAcik]);

  useEffect(() => { void getir(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const yazdir = (b: RaporBicimi) => {
    if (rapor && !htmlYazdir(gunSonuHtml(rapor, firmaAdi, b))) showError("Yazdırma penceresi açılamadı (açılır pencere engelli olabilir).");
  };

  const r = rapor;
  return (
    <div className="container-fluid py-3">
      <ERPToolbar pageTitle="S- Gün Sonu Raporu" pageIcon={<IconReportMoney size={20} />} hideNew hideSave hideDelete hideSearch hideNavigation
        onPrint={r ? () => yazdir("A4") : undefined} hidePrint={!r} onRefresh={getir} disabled={yukleniyor} />
      <Card className="border shadow-xs mb-3">
        <Card.Body className="py-2">
          <Row className="g-2 align-items-end">
            <Col xs={6} md={2}>
              <Form.Label className="small mb-1">Başlangıç</Form.Label>
              <Form.Control type="date" size="sm" aria-label="Başlangıç" value={baslangic} onChange={(e) => setBaslangic(e.target.value)} />
            </Col>
            <Col xs={6} md={2}>
              <Form.Label className="small mb-1">Bitiş</Form.Label>
              <Form.Control type="date" size="sm" aria-label="Bitiş" value={bitis} onChange={(e) => setBitis(e.target.value)} />
            </Col>
            <Col xs={6} md={2}>
              <Form.Label className="small mb-1">Kasiyer</Form.Label>
              <Form.Select size="sm" aria-label="Kasiyer" value={kasiyerId ?? ""} onChange={(e) => setKasiyerId(e.target.value ? Number(e.target.value) : null)}>
                <option value="">Hepsi</option>
                {(r?.kasiyerSecenekleri || []).map((k) => <option key={k.kullaniciId} value={k.kullaniciId}>{k.ad}</option>)}
              </Form.Select>
            </Col>
            <Col xs={6} md={2}>
              <Form.Label className="small mb-1">Vezne</Form.Label>
              <Form.Select size="sm" aria-label="Vezne" value={vezneId ?? ""} onChange={(e) => setVezneId(e.target.value ? Number(e.target.value) : null)}>
                <option value="">Hepsi</option>
                {vezneler.map((v) => <option key={v.id} value={v.id}>{[v.kod, v.ad].filter(Boolean).join(" - ")}</option>)}
              </Form.Select>
            </Col>
            <Col xs={12} md={4} className="d-flex gap-2 justify-content-md-end">
              <Button size="sm" variant="primary" onClick={getir} disabled={yukleniyor}>{yukleniyor ? <Spinner size="sm" /> : "Raporla"}</Button>
              <ButtonGroup size="sm">
                <Button variant="outline-secondary" disabled={!r} onClick={() => yazdir("80")}><IconPrinter size={15} className="me-1" />80 mm</Button>
                <Button variant="outline-secondary" disabled={!r} onClick={() => yazdir("A4")}><IconPrinter size={15} className="me-1" />A4</Button>
              </ButtonGroup>
            </Col>
          </Row>
        </Card.Body>
      </Card>
      {hata && <Alert variant="danger" className="py-2">{hata}</Alert>}
      {acikAdisyon && acikAdisyon.sayi > 0 && (
        <Alert variant="warning" className="py-2 d-flex align-items-center gap-2">
          <b>Açık adisyon var: {acikAdisyon.sayi} ({tl(acikAdisyon.tutar)} TL).</b> Bu satışlar ödenince fişe yazılır; gün sonundan önce kapatın.
          <Link to="/adisyon/masalar" className="ms-auto btn btn-sm btn-outline-dark">Masalara git</Link>
        </Alert>
      )}
      {r && (
        <>
          <Row className="g-2 mb-3">
            <Col xs={6} lg={2}><Kutu baslik="Net satış" deger={`${tl(r.satis.net)} TL`} alt={`${r.satis.adet} fiş`} /></Col>
            <Col xs={6} lg={2}><Kutu baslik="İskonto" deger={`${tl(r.satis.iskonto)} TL`} alt={`brüt ${tl(r.satis.brut)}`} /></Col>
            <Col xs={6} lg={2}><Kutu baslik="İade" deger={`${tl(r.iade.net)} TL`} alt={`${r.iade.adet} fiş`} renk={r.iade.net ? "text-danger" : ""} /></Col>
            <Col xs={6} lg={2}><Kutu baslik="Net (satış − iade)" deger={`${tl(r.net.net)} TL`} alt={`matrah ${tl(r.net.matrah)} · KDV ${tl(r.net.kdv)}`} renk="text-success" /></Col>
            <Col xs={6} lg={2}><Kutu baslik="Nakit" deger={`${tl(r.odemeler.filter((o) => o.tur === "Nakit").reduce((a, o) => a + o.net, 0))} TL`} /></Col>
            <Col xs={6} lg={2}><Kutu baslik="POS / Kart" deger={`${tl(r.odemeler.filter((o) => o.tur === "POS / Kart").reduce((a, o) => a + o.net, 0))} TL`} /></Col>
          </Row>
          <Row className="g-3">
            <Col xl={4}>
              <Card className="border shadow-xs mb-3">
                <Card.Header className="py-2 fw-semibold small">Ödeme türleri</Card.Header>
                <Table size="sm" className="mb-0 small">
                  <thead><tr><th>Tür</th><th className="text-end">Satış</th><th className="text-end">İade</th><th className="text-end">Net</th></tr></thead>
                  <tbody>
                    {r.odemeler.map((o) => (
                      <tr key={`${o.tur}|${o.paraKodu}`}>
                        <td>{o.tur}{o.paraKodu !== "TL" && <span className="text-muted"> ({o.paraKodu} {miktarYaz(o.dovizMiktar || 0)})</span>}</td>
                        <td className="text-end">{tl(o.satis)}</td><td className="text-end">{tl(o.iade)}</td><td className="text-end fw-semibold">{tl(o.net)}</td>
                      </tr>
                    ))}
                    {r.odemesiz !== 0 && <tr><td>Ödemesiz kalan</td><td /><td /><td className="text-end fw-semibold text-warning">{tl(r.odemesiz)}</td></tr>}
                    {!r.odemeler.length && !r.odemesiz && <tr><td colSpan={4} className="text-muted text-center">Kayıt yok</td></tr>}
                  </tbody>
                </Table>
              </Card>
              <Card className="border shadow-xs mb-3">
                <Card.Header className="py-2 fw-semibold small">KDV oranları (net)</Card.Header>
                <Table size="sm" className="mb-0 small">
                  <thead><tr><th>Oran</th><th className="text-end">Matrah</th><th className="text-end">KDV</th><th className="text-end">Toplam</th></tr></thead>
                  <tbody>
                    {r.kdvOranlari.map((k) => <tr key={k.oran}><td>%{k.oran}</td><td className="text-end">{tl(k.matrah)}</td><td className="text-end">{tl(k.kdv)}</td><td className="text-end">{tl(k.toplam)}</td></tr>)}
                    {!r.kdvOranlari.length && <tr><td colSpan={4} className="text-muted text-center">Kayıt yok</td></tr>}
                  </tbody>
                </Table>
              </Card>
              <Card className="border shadow-xs mb-3">
                <Card.Header className="py-2 fw-semibold small">Kasiyerler</Card.Header>
                <Table size="sm" className="mb-0 small">
                  <thead><tr><th>Kasiyer</th><th className="text-end">Satış</th><th className="text-end">İade</th><th className="text-end">Net</th></tr></thead>
                  <tbody>
                    {r.kasiyerler.map((k) => <tr key={String(k.kullaniciId)}><td>{k.ad}</td><td className="text-end">{k.satisAdet}</td><td className="text-end">{k.iadeAdet}</td><td className="text-end">{tl(k.net)}</td></tr>)}
                    {!r.kasiyerler.length && <tr><td colSpan={4} className="text-muted text-center">Kayıt yok</td></tr>}
                  </tbody>
                </Table>
              </Card>
              <Card className="border shadow-xs">
                <Card.Header className="py-2 fw-semibold small">Saatlere göre</Card.Header>
                <Table size="sm" className="mb-0 small">
                  <thead><tr><th>Saat</th><th className="text-end">Satış fişi</th><th className="text-end">Net</th></tr></thead>
                  <tbody>
                    {r.saatler.map((s) => (
                      <tr key={s.saat}><td>{String(s.saat).padStart(2, "0")}:00</td><td className="text-end">{s.adet}</td>
                        <td className="text-end"><div className="d-flex align-items-center justify-content-end gap-2">
                          <div className="bg-primary-subtle rounded" style={{ height: 8, width: `${Math.max(2, Math.round((60 * Math.abs(s.net)) / Math.max(1, ...r.saatler.map((x) => Math.abs(x.net)))))}px` }} />{tl(s.net)}
                        </div></td></tr>
                    ))}
                    {!r.saatler.length && <tr><td colSpan={3} className="text-muted text-center">Kayıt yok</td></tr>}
                  </tbody>
                </Table>
              </Card>
            </Col>
            <Col xl={8}>
              <Card className="border shadow-xs mb-3">
                <Card.Header className="py-2 fw-semibold small">Gruplar</Card.Header>
                <Table size="sm" className="mb-0 small" hover>
                  <thead><tr><th>Grup</th><th className="text-end">Kalem</th><th className="text-end">Satış</th><th className="text-end">İade</th><th className="text-end">Net</th></tr></thead>
                  <tbody>
                    {r.gruplar.map((g) => <tr key={g.grup}><td>{g.grup}</td><td className="text-end">{g.kalem}</td><td className="text-end">{tl(g.satis)}</td><td className="text-end">{tl(g.iade)}</td><td className="text-end fw-semibold">{tl(g.net)}</td></tr>)}
                    {!r.gruplar.length && <tr><td colSpan={5} className="text-muted text-center">Bu aralıkta Ticari fiş yok.</td></tr>}
                  </tbody>
                </Table>
              </Card>
              <Card className="border shadow-xs">
                <Card.Header className="py-2 fw-semibold small d-flex justify-content-between">
                  <span>Ürünler</span><span className="text-muted">{r.urunler.length} kalem</span>
                </Card.Header>
                <Table size="sm" className="mb-0 small" hover responsive>
                  <thead><tr><th>Kod</th><th>Ürün</th><th>Grup</th><th className="text-end">Satılan</th><th className="text-end">İade</th><th className="text-end">Net miktar</th><th className="text-end">Satış</th><th className="text-end">İade</th><th className="text-end">Net</th></tr></thead>
                  <tbody>
                    {r.urunler.map((u, i) => (
                      <tr key={`${u.stokKartId ?? "s"}-${i}`}>
                        <td className="text-muted">{u.kod || <Badge bg="light" text="dark" className="border fw-normal">serbest</Badge>}</td><td>{u.ad}</td><td className="text-muted">{u.grup}</td>
                        <td className="text-end">{miktarYaz(u.satisMiktar)} {u.birim}</td><td className="text-end">{u.iadeMiktar ? miktarYaz(u.iadeMiktar) : ""}</td>
                        <td className="text-end">{miktarYaz(u.netMiktar)}</td><td className="text-end">{tl(u.satis)}</td><td className="text-end">{u.iade ? tl(u.iade) : ""}</td><td className="text-end fw-semibold">{tl(u.net)}</td>
                      </tr>
                    ))}
                    {!r.urunler.length && <tr><td colSpan={9} className="text-muted text-center">Bu aralıkta Ticari fiş yok.</td></tr>}
                  </tbody>
                </Table>
              </Card>
            </Col>
          </Row>
        </>
      )}
    </div>
  );
};

export default TicariGunSonuPage;
