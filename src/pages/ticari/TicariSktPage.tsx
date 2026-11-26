import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Badge, Button, Card, Col, Form, Row, Spinner, Table } from "react-bootstrap";
import { IconCalendarExclamation, IconPrinter } from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";
import ERPToolbar from "../../components/common/ERPToolbar";
import { useToast } from "../../context/ToastContext";
import { CompanyService } from "../../services/companyService";
import { SktRaporu, SktSatiri, StokGrup, TicariService, miktarYaz } from "../../services/ticariService";
import { htmlYazdir, sktRaporuHtml, tl, zamanYaz } from "./ticariRaporCikti";

/**
 * Ticari › SKT Yaklaşanlar (docs/TICARI_ADISYON_YOL_HARITASI.md, TA16). SKT girişte yazılır; satışta parti seçilmediği için eldeki stok
 * en yeni girişlere dağıtılarak hangi partiden ne kaldığı tahmin edilir. Süresi geçmiş, bugün dolan ve eşik içinde dolacak partiler.
 */
const DURUM: Record<SktSatiri["durum"], { ad: string; renk: string }> = {
  gecti: { ad: "Süresi geçti", renk: "danger" }, bugun: { ad: "Bugün doluyor", renk: "warning" }, yaklasiyor: { ad: "Yaklaşıyor", renk: "info" }, uzak: { ad: "Uzak", renk: "secondary" },
};
const kalanYazi = (g: number) => (g < 0 ? `${-g} gün geçti` : g === 0 ? "bugün" : `${g} gün`);

const Kutu: React.FC<{ baslik: string; deger: string; alt: string; renk: string }> = ({ baslik, deger, alt, renk }) => (
  <Card className={`border border-${renk} shadow-xs h-100`}>
    <Card.Body className="py-2">
      <div className="small text-muted">{baslik}</div>
      <div className={`fs-5 fw-bold text-${renk}`}>{deger}</div>
      <div className="small text-muted">{alt}</div>
    </Card.Body>
  </Card>
);

export const TicariSktPage: React.FC = () => {
  const { showError } = useToast();
  const navigate = useNavigate();
  const [gun, setGun] = useState("");
  const [grupId, setGrupId] = useState<number | null>(null);
  const [arama, setArama] = useState("");
  const [tumu, setTumu] = useState(false);
  const [gruplar, setGruplar] = useState<StokGrup[]>([]);
  const [rapor, setRapor] = useState<SktRaporu | null>(null);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [firmaAdi, setFirmaAdi] = useState("");

  useEffect(() => {
    TicariService.gruplar().then(setGruplar).catch(() => setGruplar([]));
    CompanyService.getDefinitions().then((d) => setFirmaAdi(String(d?.FIRMA_ADI || "").trim())).catch(() => undefined);
  }, []);

  const getir = useCallback(async () => {
    setYukleniyor(true);
    setHata(null);
    try {
      const r = await TicariService.sktYaklasan({ gun: gun.trim() === "" ? null : Number(gun), grupId, arama: arama.trim() || undefined, tumu });
      setRapor(r);
      if (gun.trim() === "") setGun(String(r.esikGun));
    } catch (e: any) {
      setRapor(null);
      setHata(e?.message || "Rapor alınamadı.");
    } finally {
      setYukleniyor(false);
    }
  }, [gun, grupId, arama, tumu]);

  useEffect(() => { void getir(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const yazdir = () => {
    if (!rapor) return;
    const g = gruplar.find((x) => x.stokGrupId === grupId)?.ad || "";
    if (!htmlYazdir(sktRaporuHtml(rapor, firmaAdi, g ? `Grup: ${g}` : ""))) showError("Yazdırma penceresi açılamadı (açılır pencere engelli olabilir).");
  };

  const r = rapor;
  const toplamDeger = useMemo(() => (r ? r.satirlar.reduce((t, x) => t + x.deger, 0) : 0), [r]);
  return (
    <div className="container-fluid py-3">
      <ERPToolbar pageTitle="Y- SKT Yaklaşanlar" pageIcon={<IconCalendarExclamation size={20} />} hideNew hideSave hideDelete hideSearch hideNavigation
        onPrint={r ? yazdir : undefined} hidePrint={!r} onRefresh={getir} disabled={yukleniyor} />
      <Card className="border shadow-xs mb-3">
        <Card.Body className="py-2">
          <Row className="g-2 align-items-end">
            <Col xs={6} md={2}>
              <Form.Label className="small mb-1">Kaç gün içinde</Form.Label>
              <Form.Control size="sm" inputMode="numeric" aria-label="Gün eşiği" value={gun} onChange={(e) => setGun(e.target.value.replace(/\D/g, "").slice(0, 4))}
                onKeyDown={(e) => { if (e.key === "Enter") void getir(); }} />
            </Col>
            <Col xs={6} md={2}>
              <Form.Label className="small mb-1">Grup</Form.Label>
              <Form.Select size="sm" aria-label="Grup" value={grupId ?? ""} onChange={(e) => setGrupId(e.target.value ? Number(e.target.value) : null)}>
                <option value="">Hepsi</option>
                {gruplar.map((g) => <option key={g.stokGrupId} value={g.stokGrupId}>{g.ad}</option>)}
              </Form.Select>
            </Col>
            <Col xs={6} md={3}>
              <Form.Label className="small mb-1">Ürün ara</Form.Label>
              <Form.Control size="sm" aria-label="Ürün ara" placeholder="Ad, kod ya da barkod" value={arama} onChange={(e) => setArama(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") void getir(); }} />
            </Col>
            <Col xs={6} md={2}>
              <Form.Check type="switch" id="skt-tumu" className="mb-1" label="Uzak olanlar da" checked={tumu} onChange={(e) => setTumu(e.target.checked)} />
            </Col>
            <Col xs={12} md={3} className="d-flex gap-2 justify-content-md-end">
              <Button size="sm" variant="primary" onClick={getir} disabled={yukleniyor}>{yukleniyor ? <Spinner size="sm" /> : "Raporla"}</Button>
              <Button size="sm" variant="outline-secondary" disabled={!r} onClick={yazdir}><IconPrinter size={15} className="me-1" />A4</Button>
            </Col>
          </Row>
        </Card.Body>
      </Card>
      {hata && <Alert variant="danger" className="py-2">{hata}</Alert>}
      {r && (
        <>
          <Row className="g-2 mb-3">
            <Col xs={6} lg={3}><Kutu baslik="Süresi geçmiş" deger={`${r.ozet.gecti.parti} parti`} alt={`${r.ozet.gecti.kart} ürün · ${tl(r.ozet.gecti.deger)} TL`} renk="danger" /></Col>
            <Col xs={6} lg={3}><Kutu baslik="Bugün doluyor" deger={`${r.ozet.bugun.parti} parti`} alt={`${r.ozet.bugun.kart} ürün · ${tl(r.ozet.bugun.deger)} TL`} renk="warning" /></Col>
            <Col xs={6} lg={3}><Kutu baslik={`${r.esikGun} gün içinde`} deger={`${r.ozet.yaklasiyor.parti} parti`} alt={`${r.ozet.yaklasiyor.kart} ürün · ${tl(r.ozet.yaklasiyor.deger)} TL`} renk="info" /></Col>
            <Col xs={6} lg={3}><Kutu baslik="Listelenen değer (alış)" deger={`${tl(toplamDeger)} TL`} alt={`${r.satirlar.length} parti · ${zamanYaz(r.bugun)}`} renk="secondary" /></Col>
          </Row>
          <Card className="border shadow-xs">
            <div style={{ maxHeight: "calc(100vh - 360px)", overflow: "auto" }}>
              <Table size="sm" hover className="mb-0 small align-middle" aria-label="SKT partileri">
                <thead className="sticky-top bg-body">
                  <tr><th>SKT</th><th>Kalan</th><th>Ürün</th><th>Parti</th><th>Giriş fişi</th><th className="text-end">Partide kalan</th><th className="text-end">Giriş miktarı</th><th className="text-end">Alış</th><th className="text-end">Değer</th></tr>
                </thead>
                <tbody>
                  {r.satirlar.map((x) => (
                    <tr key={`${x.stokGirisId}-${x.stokKartId}-${x.skt}-${x.partiNo}`}>
                      {/* Uygulama tablo teması satır sınıflarının zeminini eziyor: sol şerit + zemin satır içi */}
                      <td className="text-nowrap fw-semibold" style={x.durum === "gecti" ? { boxShadow: "inset 4px 0 0 #dc3545", background: "#fdecee" } : x.durum === "bugun" ? { boxShadow: "inset 4px 0 0 #ffc107", background: "#fff8e1" } : undefined}>{zamanYaz(x.skt)}</td>
                      <td className="text-nowrap"><Badge bg={DURUM[x.durum].renk} text={x.durum === "bugun" ? "dark" : undefined}>{kalanYazi(x.kalanGun)}</Badge></td>
                      <td><div className="fw-semibold">{x.ad}</div><div className="text-muted" style={{ fontSize: 11 }}>{[x.kod, x.grup].filter(Boolean).join(" · ")} · stok {miktarYaz(x.kartBakiye)} {x.birim}</div></td>
                      <td>{x.partiNo || "—"}</td>
                      <td className="text-nowrap"><Button size="sm" variant="link" className="p-0" onClick={() => navigate(`/ticari/stok-giris-fisi?id=${x.stokGirisId}`)}>{x.fisNo}</Button><div className="text-muted" style={{ fontSize: 11 }}>{zamanYaz(x.girisGunu)}</div></td>
                      <td className="text-end fw-semibold text-nowrap">{miktarYaz(x.kalan)} {x.birim}</td>
                      <td className="text-end text-muted text-nowrap">{miktarYaz(x.partiMiktar)}</td>
                      <td className="text-end">{tl(x.birimFiyat)}</td>
                      <td className="text-end">{tl(x.deger)}</td>
                    </tr>
                  ))}
                  {!r.satirlar.length && <tr><td colSpan={9} className="text-center text-muted py-4">{r.esikGun} gün içinde dolacak ya da süresi geçmiş parti yok.</td></tr>}
                </tbody>
              </Table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
};

export default TicariSktPage;
