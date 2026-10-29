import React, { useEffect, useMemo, useState } from "react";
import { Alert, Badge, Button, Card, Col, Form, InputGroup, Row, Spinner, Table } from "react-bootstrap";
import { IconArrowsExchange, IconBinoculars, IconX } from "@tabler/icons-react";
import { useLocation, useNavigate } from "react-router-dom";
import ERPToolbar from "../../components/common/ERPToolbar";
import { useToast } from "../../context/ToastContext";
import { printReportTable } from "../../utils/printReport";
import { StokGrup, StokHareketSatiri, StokKart, TicariService, miktarYaz, para, saatYaz, tarihYaz } from "../../services/ticariService";
import { StokKartSecici } from "./StokKartSecici";

const ayBasi = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`; };
const bugun = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

type Veri = Awaited<ReturnType<typeof TicariService.hareketler>>;

/** I- Ürün Hareket Listesi (T19): bir ürünün (ya da tümünün) giriş / çıkışları, devir ve yürüyen bakiye */
export const UrunHareketListesiPage: React.FC = () => {
  const { showError } = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const [gruplar, setGruplar] = useState<StokGrup[]>([]);
  const [kart, setKart] = useState<StokKart | null>(null);
  const [secici, setSecici] = useState(false);
  const [bas, setBas] = useState(ayBasi());
  const [bit, setBit] = useState(bugun());
  const [tur, setTur] = useState("");
  const [grupId, setGrupId] = useState("");
  const [veri, setVeri] = useState<Veri | null>(null);
  const [yukleniyor, setYukleniyor] = useState(false);

  useEffect(() => {
    TicariService.gruplar().then(setGruplar).catch(() => setGruplar([]));
    // Tam kart listesi çekilmez (G2): adresteki kart kimlikle alınır, seçim penceresi sunucuda arar
    const id = Number(new URLSearchParams(location.search).get("kart"));
    if (id) TicariService.kart(id).then((k) => { if (k) { setKart(k); setBas(""); } }).catch(() => undefined);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const istek = React.useRef(0);
  const yukle = async () => {
    const no = ++istek.current;
    setYukleniyor(true);
    try {
      const v = await TicariService.hareketler({ stokKartId: kart?.stokKartId ?? null, baslangic: bas || undefined, bitis: bit || undefined, belgeTuru: tur ? Number(tur) : null, grupId: grupId ? Number(grupId) : null });
      // Süzgeç değişirken önceki istek geç dönerse sonucu yazılmaz
      if (no === istek.current) setVeri(v);
    }
    catch (e: any) { if (no === istek.current) showError(e?.message || "Hareketler alınamadı."); }
    finally { if (no === istek.current) setYukleniyor(false); }
  };
  useEffect(() => { void yukle(); }, [kart, bas, bit, tur, grupId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Kart kart gruplanmış görünüm: her kartın devri ve hareketleri
  const gruplu = useMemo(() => {
    const m = new Map<number, { stokKartId: number; kod: string; ad: string; birim: string; devir: number; satirlar: StokHareketSatiri[] }>();
    for (const d of veri?.devirler || []) m.set(d.stokKartId, { ...d, satirlar: [] });
    for (const s of veri?.satirlar || []) {
      if (!m.has(s.stokKartId)) m.set(s.stokKartId, { stokKartId: s.stokKartId, kod: s.kod, ad: s.ad, birim: s.birim, devir: 0, satirlar: [] });
      m.get(s.stokKartId)!.satirlar.push(s);
    }
    return [...m.values()].sort((a, b) => a.ad.localeCompare(b.ad, "tr"));
  }, [veri]);

  const belgeAc = (s: StokHareketSatiri) => navigate(s.belgeTuru === 1 ? `/ticari/stok-giris-fisi?id=${s.belgeId}` : `/ticari/satis-fisi-duzeltme?id=${s.belgeId}`);

  const yazdir = () => printReportTable({
    title: "Ürün Hareket Listesi",
    subtitle: `${kart ? `${kart.kod} ${kart.ad} · ` : ""}${bas ? tarihYaz(bas) : "Başlangıç"} – ${bit ? tarihYaz(bit) : "bugün"}`,
    columns: [
      { header: "Kod", key: "kod" }, { header: "Ürün", key: "ad" }, { header: "Tarih", render: (s: StokHareketSatiri) => `${tarihYaz(s.tarih)} ${saatYaz(s.tarih)}` },
      { header: "Belge", key: "belgeTuruAdi" }, { header: "Belge No", key: "belgeNo" }, { header: "Karşı Taraf", key: "karsiTaraf" },
      { header: "Giriş", render: (s: StokHareketSatiri) => miktarYaz(s.giris || null) }, { header: "Çıkış", render: (s: StokHareketSatiri) => miktarYaz(s.cikis || null) },
      { header: "Fiyat", render: (s: StokHareketSatiri) => para(s.birimFiyat) }, { header: "Bakiye", render: (s: StokHareketSatiri) => miktarYaz(s.bakiye) },
    ] as any,
    data: veri?.satirlar || [],
  });

  return (
    <div className="container-fluid p-2">
      <ERPToolbar pageTitle="I- Ürün Hareket Listesi" pageIcon={<IconArrowsExchange size={20} />} onRefresh={yukle} onPrint={yazdir} hideSave hideDelete hideNew />
      <Card className="border shadow-xs mb-2">
        <Card.Body className="p-2">
          <Row className="g-2 align-items-end">
            <Col md={4}>
              <Form.Label className="small text-muted mb-1 fw-bold">Ürün</Form.Label>
              <InputGroup size="sm">
                <Form.Control readOnly value={kart ? `${kart.kod} ${kart.ad}` : ""} placeholder="Tüm ürünler" onClick={() => setSecici(true)} style={{ cursor: "pointer" }} />
                {kart && <Button variant="outline-secondary" onClick={() => setKart(null)}><IconX size={14} /></Button>}
                <Button variant="outline-primary" onClick={() => setSecici(true)}><IconBinoculars size={14} /></Button>
              </InputGroup>
            </Col>
            <Col md={2}><Form.Label className="small text-muted mb-1 fw-bold">Başlangıç</Form.Label><Form.Control size="sm" type="date" value={bas} onChange={(e) => setBas(e.target.value)} /></Col>
            <Col md={2}><Form.Label className="small text-muted mb-1 fw-bold">Bitiş</Form.Label><Form.Control size="sm" type="date" value={bit} onChange={(e) => setBit(e.target.value)} /></Col>
            <Col md={2}>
              <Form.Label className="small text-muted mb-1 fw-bold">Belge</Form.Label>
              <Form.Select size="sm" value={tur} onChange={(e) => setTur(e.target.value)}><option value="">Hepsi</option><option value="1">Stok girişi</option><option value="2">Satış</option></Form.Select>
            </Col>
            <Col md={2}>
              <Form.Label className="small text-muted mb-1 fw-bold">Grup</Form.Label>
              <Form.Select size="sm" value={grupId} onChange={(e) => setGrupId(e.target.value)}><option value="">Tüm gruplar</option>{gruplar.map((g) => <option key={g.stokGrupId} value={g.stokGrupId}>{g.ad}</option>)}</Form.Select>
            </Col>
          </Row>
        </Card.Body>
      </Card>
      {veri?.kesildi && (
        <Alert variant="warning" className="py-2 small mb-2">
          Süzgece uyan {(veri.toplamSatir || 0).toLocaleString("tr-TR")} hareketten ilk {(veri.sinir || veri.satirlar.length).toLocaleString("tr-TR")} satır gösteriliyor; toplam giriş / çıkış bütün hareketler üzerinden hesaplandı. Ürün, tarih ya da grup ile daraltın.
        </Alert>
      )}
      <Card className="border shadow-xs">
        <div className="table-responsive" style={{ maxHeight: "calc(100vh - 280px)", minHeight: 300 }}>
          <Table bordered size="sm" className="align-middle mb-0 text-nowrap">
            <thead className="table-light sticky-top">
              <tr className="small text-secondary"><th>Tarih</th><th>Belge</th><th>Belge No</th><th>Karşı Taraf</th><th className="text-end">Giriş</th><th className="text-end">Çıkış</th><th className="text-end">Fiyat</th><th className="text-end">Bakiye</th></tr>
            </thead>
            <tbody>
              {yukleniyor ? <tr><td colSpan={8} className="text-center py-5"><Spinner size="sm" className="me-2" />Yükleniyor...</td></tr>
                : gruplu.length === 0 ? <tr><td colSpan={8} className="text-center py-5 text-muted">Bu süzgeçte hareket yok.</td></tr>
                : gruplu.map((g) => (
                  <React.Fragment key={g.stokKartId}>
                    <tr style={{ "--bs-table-bg": "#e7f1ff", "--bs-table-accent-bg": "#e7f1ff" } as any}><td colSpan={8} className="fw-bold"><span className="font-monospace">{g.kod}</span> {g.ad} <span className="text-muted small">({g.birim})</span></td></tr>
                    {!tur && bas && <tr className="small text-muted"><td colSpan={7} className="text-end fst-italic">Devir ({tarihYaz(bas)} öncesi)</td><td className="text-end fw-bold">{miktarYaz(g.devir)}</td></tr>}
                    {g.satirlar.map((s) => (
                      <tr key={s.stokHareketId} onDoubleClick={() => belgeAc(s)} style={{ cursor: "pointer" }} title="Çift tıklayınca belge açılır">
                        <td className="small">{tarihYaz(s.tarih)} <span className="text-muted">{saatYaz(s.tarih)}</span></td>
                        <td>{s.belgeTuru === 1 ? <Badge bg="success">Giriş</Badge> : <Badge bg="danger">Satış</Badge>}</td>
                        <td className="font-monospace small text-primary">{s.belgeNo}</td>
                        <td className="small text-truncate" style={{ maxWidth: 240 }}>{s.karsiTaraf}</td>
                        <td className="text-end text-success">{s.giris ? miktarYaz(s.giris) : ""}</td>
                        <td className="text-end text-danger">{s.cikis ? miktarYaz(s.cikis) : ""}</td>
                        <td className="text-end small">{para(s.birimFiyat)}</td>
                        <td className={`text-end fw-bold ${s.bakiye !== null && s.bakiye < 0 ? "text-danger" : ""}`}>{s.bakiye === null ? "" : miktarYaz(s.bakiye)}</td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
            </tbody>
            {veri && veri.satirlar.length > 0 && <tfoot className="table-light fw-bold small"><tr><td colSpan={4} className="text-end">Toplam</td><td className="text-end">{miktarYaz(veri.toplam.giris)}</td><td className="text-end">{miktarYaz(veri.toplam.cikis)}</td><td colSpan={2}></td></tr></tfoot>}
          </Table>
        </div>
      </Card>
      <StokKartSecici show={secici} onHide={() => setSecici(false)} onSelect={(k) => { setKart(k); setSecici(false); }} />
    </div>
  );
};

export default UrunHareketListesiPage;
