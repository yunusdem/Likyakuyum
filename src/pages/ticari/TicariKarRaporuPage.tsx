import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Badge, Button, Card, Col, Form, Row, Spinner, Table } from "react-bootstrap";
import { IconChartBar, IconPrinter } from "@tabler/icons-react";
import ERPToolbar from "../../components/common/ERPToolbar";
import { useToast } from "../../context/ToastContext";
import { CompanyService } from "../../services/companyService";
import { KarRaporu, StokGrup, TicariService, miktarYaz } from "../../services/ticariService";
import { htmlYazdir, karRaporuHtml, tl, zamanYaz } from "./ticariRaporCikti";

/**
 * Ticari › Kâr Raporu (docs/TICARI_ADISYON_YOL_HARITASI.md, TA15). Maliyet: hareketli ağırlıklı ortalama (satış anındaki); gelir KDV hariç,
 * iskonto ve iade düşülmüş. Ürün / grup / gün kırılımı, fire ve sayım farkı maliyeti. Maliyet bilgisi stok yönetim yetkisine açık.
 */
const bugun = () => new Date().toLocaleDateString("en-CA");
const ayBasi = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toLocaleDateString("en-CA"); };
const yuzde = (n: number | null) => (n === null ? "—" : `%${n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
const renk = (n: number) => (n < 0 ? "text-danger" : n > 0 ? "text-success" : "");

type Siralama = "kar" | "gelir" | "karYuzde" | "ad";

const Kutu: React.FC<{ baslik: string; deger: string; alt?: string; renk?: string }> = ({ baslik, deger, alt, renk: r }) => (
  <Card className="border shadow-xs h-100">
    <Card.Body className="py-2">
      <div className="small text-muted">{baslik}</div>
      <div className={`fs-5 fw-bold ${r || ""}`}>{deger}</div>
      {alt && <div className="small text-muted">{alt}</div>}
    </Card.Body>
  </Card>
);

export const TicariKarRaporuPage: React.FC = () => {
  const { showError } = useToast();
  const [baslangic, setBaslangic] = useState(ayBasi());
  const [bitis, setBitis] = useState(bugun());
  const [grupId, setGrupId] = useState<number | null>(null);
  const [gruplar, setGruplar] = useState<StokGrup[]>([]);
  const [arama, setArama] = useState("");
  const [siralama, setSiralama] = useState<Siralama>("kar");
  const [rapor, setRapor] = useState<KarRaporu | null>(null);
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
      setRapor(await TicariService.karRaporu({ baslangic, bitis, grupId }));
    } catch (e: any) {
      setRapor(null);
      setHata(e?.message || "Rapor alınamadı.");
    } finally {
      setYukleniyor(false);
    }
  }, [baslangic, bitis, grupId]);

  useEffect(() => { void getir(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const urunler = useMemo(() => {
    const q = arama.trim().toLocaleLowerCase("tr-TR");
    const l = (rapor?.urunler || []).filter((u) => !q || u.ad.toLocaleLowerCase("tr-TR").includes(q) || u.kod.toLocaleLowerCase("tr-TR").includes(q));
    return [...l].sort((a, b) => siralama === "ad" ? a.ad.localeCompare(b.ad, "tr") : siralama === "karYuzde" ? (b.karYuzde ?? -1e9) - (a.karYuzde ?? -1e9) : b[siralama] - a[siralama]);
  }, [rapor, arama, siralama]);

  const yazdir = () => {
    if (!rapor) return;
    const g = gruplar.find((x) => x.stokGrupId === grupId)?.ad || "";
    if (!htmlYazdir(karRaporuHtml(rapor, firmaAdi, g ? `Grup: ${g}` : ""))) showError("Yazdırma penceresi açılamadı (açılır pencere engelli olabilir).");
  };

  const r = rapor, t = r?.toplam;
  const enCokGun = r?.gunler.reduce((m, g) => Math.max(m, Math.abs(g.gelir), Math.abs(g.kar)), 0) || 0;
  return (
    <div className="container-fluid py-3">
      <ERPToolbar pageTitle="X- Kâr Raporu" pageIcon={<IconChartBar size={20} />} hideNew hideSave hideDelete hideSearch hideNavigation
        onPrint={r ? yazdir : undefined} hidePrint={!r} onRefresh={getir} disabled={yukleniyor} />
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
              <Form.Label className="small mb-1">Grup</Form.Label>
              <Form.Select size="sm" aria-label="Grup" value={grupId ?? ""} onChange={(e) => setGrupId(e.target.value ? Number(e.target.value) : null)}>
                <option value="">Hepsi</option>
                {gruplar.map((g) => <option key={g.stokGrupId} value={g.stokGrupId}>{g.ad}</option>)}
              </Form.Select>
            </Col>
            <Col xs={6} md={2}>
              <Form.Label className="small mb-1">Ürün ara</Form.Label>
              <Form.Control size="sm" aria-label="Ürün ara" placeholder="Ad ya da kod" value={arama} onChange={(e) => setArama(e.target.value)} />
            </Col>
            <Col xs={12} md={4} className="d-flex gap-2 justify-content-md-end">
              <Button size="sm" variant="primary" onClick={getir} disabled={yukleniyor}>{yukleniyor ? <Spinner size="sm" /> : "Raporla"}</Button>
              <Button size="sm" variant="outline-secondary" disabled={!r} onClick={yazdir}><IconPrinter size={15} className="me-1" />A4</Button>
            </Col>
          </Row>
        </Card.Body>
      </Card>
      {hata && <Alert variant="danger" className="py-2">{hata}</Alert>}
      {r && t && (
        <>
          <Row className="g-2 mb-3">
            <Col xs={6} lg={2}><Kutu baslik="Gelir (KDV hariç)" deger={`${tl(t.gelir)} TL`} alt={`${r.urunler.length} ürün`} /></Col>
            <Col xs={6} lg={2}><Kutu baslik="Satılan malın maliyeti" deger={`${tl(t.maliyet)} TL`} /></Col>
            <Col xs={6} lg={2}><Kutu baslik="Brüt kâr" deger={`${tl(t.brutKar)} TL`} alt={yuzde(t.karYuzde)} renk={renk(t.brutKar)} /></Col>
            <Col xs={6} lg={2}><Kutu baslik="Fire maliyeti" deger={`${tl(t.fireMaliyet)} TL`} renk={t.fireMaliyet ? "text-danger" : ""} /></Col>
            <Col xs={6} lg={2}><Kutu baslik="Sayım farkı" deger={`${tl(t.sayimFarkMaliyet)} TL`} renk={renk(t.sayimFarkMaliyet)} alt={Math.abs(t.parcalamaFarki || 0) > 0.004 ? `Parçalama farkı −${tl(t.parcalamaFarki || 0)} TL` : undefined} /></Col>
            <Col xs={6} lg={2}><Kutu baslik="Net kâr" deger={`${tl(t.netKar)} TL`} renk={renk(t.netKar)} /></Col>
          </Row>
          {t.maliyetsizKalem > 0 && (
            <Alert variant="warning" className="py-2 small">{t.maliyetsizKalem} üründe maliyet bilinmiyor (giriş fişi ya da alış fiyatı yok); bu satışlar maliyetsiz sayıldı.</Alert>
          )}
          <Row className="g-3">
            <Col xl={8}>
              <Card className="border shadow-xs mb-3">
                <Card.Header className="py-2 d-flex align-items-center gap-2">
                  <span className="fw-semibold small me-auto">Ürünler</span>
                  <Form.Select size="sm" style={{ width: 170 }} aria-label="Sıralama" value={siralama} onChange={(e) => setSiralama(e.target.value as Siralama)}>
                    <option value="kar">Kâra göre</option>
                    <option value="gelir">Gelire göre</option>
                    <option value="karYuzde">Kâr yüzdesine göre</option>
                    <option value="ad">Ada göre</option>
                  </Form.Select>
                </Card.Header>
                <div style={{ maxHeight: 520, overflow: "auto" }}>
                  <Table size="sm" hover className="mb-0 small" aria-label="Ürün kârları">
                    <thead className="sticky-top bg-body">
                      <tr><th>Ürün</th><th className="text-end">Net miktar</th><th className="text-end">Gelir</th><th className="text-end">Maliyet</th><th className="text-end">Kâr</th>
                        <th className="text-end">Kâr %</th><th className="text-end">Ort. maliyet</th><th className="text-end">Son alış</th><th className="text-end">Fire</th><th className="text-end">Sayım</th></tr>
                    </thead>
                    <tbody>
                      {urunler.map((u) => (
                        <tr key={u.stokKartId}>
                          <td>
                            <div className="fw-semibold">{u.ad}</div>
                            <div className="text-muted" style={{ fontSize: 11 }}>{[u.kod, u.grup].filter(Boolean).join(" · ")}
                              {u.maliyetsizMiktar > 0 && <Badge bg="warning" text="dark" className="ms-1">maliyet yok</Badge>}
                              {u.iadeMiktar > 0 && <Badge bg="secondary" className="ms-1">iade {miktarYaz(u.iadeMiktar)}</Badge>}</div>
                          </td>
                          <td className="text-end text-nowrap">{miktarYaz(u.netMiktar)} {u.birim}</td>
                          <td className="text-end">{tl(u.gelir)}</td>
                          <td className="text-end">{tl(u.maliyet)}</td>
                          <td className={`text-end fw-semibold ${renk(u.kar)}`}>{tl(u.kar)}</td>
                          <td className={`text-end ${renk(u.kar)}`}>{yuzde(u.karYuzde)}</td>
                          <td className="text-end">{tl(u.ortMaliyet)}</td>
                          <td className="text-end text-muted">{u.sonAlis === null ? "—" : tl(u.sonAlis)}</td>
                          <td className={`text-end ${u.fireMaliyet ? "text-danger" : "text-muted"}`}>{u.fireMaliyet ? `${tl(u.fireMaliyet)}` : "—"}</td>
                          <td className={`text-end ${renk(u.sayimFarkMaliyet)}`}>{u.sayimFarkMaliyet ? tl(u.sayimFarkMaliyet) : "—"}</td>
                        </tr>
                      ))}
                      {!urunler.length && <tr><td colSpan={10} className="text-center text-muted py-3">Bu dönemde satış, fire ya da sayım yok.</td></tr>}
                    </tbody>
                  </Table>
                </div>
              </Card>
            </Col>
            <Col xl={4}>
              <Card className="border shadow-xs mb-3">
                <Card.Header className="py-2 fw-semibold small">Gruplar</Card.Header>
                <Table size="sm" className="mb-0 small" aria-label="Grup kârları">
                  <thead><tr><th>Grup</th><th className="text-end">Gelir</th><th className="text-end">Maliyet</th><th className="text-end">Kâr</th></tr></thead>
                  <tbody>
                    {r.gruplar.map((g) => (
                      <tr key={g.grup}><td>{g.grup}</td><td className="text-end">{tl(g.gelir)}</td><td className="text-end">{tl(g.maliyet)}</td><td className={`text-end fw-semibold ${renk(g.kar)}`}>{tl(g.kar)}</td></tr>
                    ))}
                  </tbody>
                </Table>
              </Card>
              <Card className="border shadow-xs mb-3">
                <Card.Header className="py-2 fw-semibold small">Günler</Card.Header>
                <Card.Body className="py-2" aria-label="Günlük kâr">
                  {r.gunler.map((g) => (
                    <div key={g.gun} className="mb-2">
                      <div className="d-flex small"><span className="me-auto">{zamanYaz(g.gun)}</span><span className="text-muted me-2">{tl(g.gelir)}</span><span className={`fw-semibold ${renk(g.kar)}`}>{tl(g.kar)}</span></div>
                      {/* Tema Bootstrap renk değişkenlerini tanımlamıyor: sabit renkler */}
                      <div style={{ position: "relative", height: 8, background: "#eef1f4", borderRadius: 4 }}>
                        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${enCokGun ? (Math.abs(g.gelir) / enCokGun) * 100 : 0}%`, background: "#c9dcf5", borderRadius: 4 }} />
                        <div style={{ position: "absolute", left: 0, top: 2, bottom: 2, width: `${enCokGun ? (Math.abs(g.kar) / enCokGun) * 100 : 0}%`, background: g.kar < 0 ? "#dc3545" : "#198754", borderRadius: 3 }} />
                      </div>
                    </div>
                  ))}
                  {!r.gunler.length && <div className="text-muted small">Satış yok.</div>}
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </>
      )}
    </div>
  );
};

export default TicariKarRaporuPage;
