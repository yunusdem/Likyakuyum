import React, { useEffect, useMemo, useState } from "react";
import { Alert, Badge, Button, Card, Col, Form, InputGroup, Row, Spinner, Table } from "react-bootstrap";
import { IconListNumbers, IconSearch } from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";
import ERPToolbar from "../../components/common/ERPToolbar";
import { useToast } from "../../context/ToastContext";
import { printReportTable } from "../../utils/printReport";
import { StokDurumSatiri, StokGrup, TicariService, miktarYaz, para, tarihYaz } from "../../services/ticariService";

/** H- Stok Durum Listesi (docs/TICARI_ISLEMLER_YOL_HARITASI.md, T19): tarih itibarıyla giriş / çıkış / kalan, son alışla değer, en az stok uyarısı */
export const StokDurumListesiPage: React.FC = () => {
  const { showError } = useToast();
  const navigate = useNavigate();
  const [veri, setVeri] = useState<Awaited<ReturnType<typeof TicariService.stokDurum>> | null>(null);
  const [gruplar, setGruplar] = useState<StokGrup[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [tarih, setTarih] = useState("");
  const [grupId, setGrupId] = useState("");
  const [arama, setArama] = useState("");
  const [yalnizEksik, setYalnizEksik] = useState(false);
  const [pasifler, setPasifler] = useState(false);
  const [sifirlar, setSifirlar] = useState(true);

  const istek = React.useRef(0);
  const yukle = async () => {
    const no = ++istek.current;
    setYukleniyor(true);
    try { const v = await TicariService.stokDurum({ tarih: tarih || undefined, grupId: grupId ? Number(grupId) : null, arama: arama.trim() || undefined, yalnizEksik, pasifler }); if (no === istek.current) setVeri(v); }
    catch (e: any) { if (no === istek.current) showError(e?.message || "Stok durumu alınamadı."); }
    finally { if (no === istek.current) setYukleniyor(false); }
  };
  useEffect(() => { TicariService.gruplar().then(setGruplar).catch(() => setGruplar([])); }, []);
  useEffect(() => { void yukle(); }, [tarih, grupId, yalnizEksik, pasifler]); // eslint-disable-line react-hooks/exhaustive-deps

  const satirlar = useMemo(() => (veri?.satirlar || []).filter((s) => sifirlar || s.bakiye !== 0 || s.giris !== 0), [veri, sifirlar]);
  const deger = useMemo(() => satirlar.reduce((a, s) => a + (s.deger || 0), 0), [satirlar]);

  const yazdir = () => printReportTable({
    title: "Stok Durum Listesi",
    subtitle: `${tarih ? `${tarihYaz(tarih)} itibarıyla · ` : ""}${satirlar.length} ürün · Stok değeri ${para(deger)} TL`,
    columns: [
      { header: "Kod", key: "kod" }, { header: "Ürün Adı", key: "ad" }, { header: "Grup", key: "grupAdi" }, { header: "Birim", key: "birim" },
      { header: "Giriş", render: (s: StokDurumSatiri) => miktarYaz(s.giris) }, { header: "Çıkış", render: (s: StokDurumSatiri) => miktarYaz(s.cikis) },
      { header: "Kalan", render: (s: StokDurumSatiri) => miktarYaz(s.bakiye) }, { header: "En Az", render: (s: StokDurumSatiri) => miktarYaz(s.enAzStok) },
      { header: "Son Alış", render: (s: StokDurumSatiri) => para(s.maliyet) }, { header: "Değer", render: (s: StokDurumSatiri) => para(s.deger) },
    ] as any,
    data: satirlar,
  });

  return (
    <div className="container-fluid p-2">
      <ERPToolbar pageTitle="H- Stok Durum Listesi" pageIcon={<IconListNumbers size={20} />} onRefresh={yukle} onPrint={yazdir} hideSave hideDelete hideNew />
      <Card className="border shadow-xs mb-2">
        <Card.Body className="p-2">
          <Row className="g-2 align-items-end">
            <Col md={2}><Form.Label className="small text-muted mb-1 fw-bold">Tarih itibarıyla</Form.Label><Form.Control size="sm" type="date" value={tarih} onChange={(e) => setTarih(e.target.value)} title="Boşsa bugün" /></Col>
            <Col md={2}>
              <Form.Label className="small text-muted mb-1 fw-bold">Grup</Form.Label>
              <Form.Select size="sm" value={grupId} onChange={(e) => setGrupId(e.target.value)}>
                <option value="">Tüm gruplar</option>{gruplar.map((g) => <option key={g.stokGrupId} value={g.stokGrupId}>{g.ad}</option>)}
              </Form.Select>
            </Col>
            <Col md={4}>
              <Form.Label className="small text-muted mb-1 fw-bold">Ara</Form.Label>
              <InputGroup size="sm">
                <InputGroup.Text className="bg-light"><IconSearch size={15} /></InputGroup.Text>
                <Form.Control value={arama} placeholder="Kod, ürün adı ya da barkod..." onChange={(e) => setArama(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void yukle(); }} />
                <Button variant="outline-primary" onClick={yukle}>Listele</Button>
              </InputGroup>
            </Col>
            <Col md={4} className="d-flex flex-wrap gap-3 small">
              <Form.Check type="switch" id="eksik" label="Yalnız eksik / eksi stok" checked={yalnizEksik} onChange={(e) => setYalnizEksik(e.target.checked)} />
              <Form.Check type="switch" id="pasif" label="Pasif kartlar" checked={pasifler} onChange={(e) => setPasifler(e.target.checked)} />
              <Form.Check type="switch" id="sifir" label="Hareketsizler" checked={sifirlar} onChange={(e) => setSifirlar(e.target.checked)} />
            </Col>
          </Row>
        </Card.Body>
      </Card>
      {veri?.kesildi && (
        <Alert variant="warning" className="py-2 small mb-2">
          Süzgece uyan {veri.toplam.kart.toLocaleString("tr-TR")} üründen ilk {(veri.sinir || satirlar.length).toLocaleString("tr-TR")} satır gösteriliyor; toplamlar bütün ürünler üzerinden hesaplandı. Grup ya da arama ile daraltın.
        </Alert>
      )}
      <Row className="g-2 mb-2 small">
        <Col xs={6} md={3}><Card className="border-0 bg-primary bg-opacity-10"><Card.Body className="p-2"><div className="text-muted">Ürün</div><div className="fs-5 fw-bold text-primary">{veri?.kesildi ? veri.toplam.kart : satirlar.length}</div></Card.Body></Card></Col>
        <Col xs={6} md={3}><Card className="border-0 bg-dark bg-opacity-10"><Card.Body className="p-2"><div className="text-muted">Stok değeri (son alış)</div><div className="fs-5 fw-bold">{para(veri?.kesildi ? veri.toplam.deger : deger)} TL</div></Card.Body></Card></Col>
        <Col xs={6} md={3}><Card className="border-0 bg-warning bg-opacity-10"><Card.Body className="p-2"><div className="text-muted">En az stoğun altında</div><div className="fs-5 fw-bold text-warning">{veri?.toplam.eksik ?? 0}</div></Card.Body></Card></Col>
        <Col xs={6} md={3}><Card className="border-0 bg-danger bg-opacity-10"><Card.Body className="p-2"><div className="text-muted">Eksi stok</div><div className="fs-5 fw-bold text-danger">{veri?.toplam.eksiBakiye ?? 0}</div></Card.Body></Card></Col>
      </Row>
      <Card className="border shadow-xs">
        <div className="table-responsive" style={{ maxHeight: "calc(100vh - 380px)", minHeight: 300 }}>
          <Table hover striped bordered size="sm" className="align-middle mb-0 text-nowrap">
            <thead className="table-light sticky-top">
              <tr className="small text-secondary">
                <th style={{ width: 40 }} className="text-center">#</th><th>Kod</th><th>Ürün Adı</th><th>Grup</th><th>Birim</th>
                <th className="text-end">Giriş</th><th className="text-end">Çıkış</th><th className="text-end">Kalan</th><th className="text-end">En Az</th>
                <th className="text-end">Son Alış</th><th className="text-end">Değer</th><th>Son Hareket</th><th className="text-center">Durum</th>
              </tr>
            </thead>
            <tbody>
              {yukleniyor ? <tr><td colSpan={13} className="text-center py-5"><Spinner size="sm" className="me-2" />Yükleniyor...</td></tr>
                : satirlar.length === 0 ? <tr><td colSpan={13} className="text-center py-5 text-muted">Kayıt yok.</td></tr>
                : satirlar.map((s, i) => (
                  <tr key={s.stokKartId} onDoubleClick={() => navigate(`/ticari/urun-hareket-listesi?kart=${s.stokKartId}`)} style={{ cursor: "pointer" }} title="Çift tıklayınca ürünün hareketleri açılır">
                    <td className="text-center text-muted small">{i + 1}</td>
                    <td className="font-monospace fw-bold text-primary">{s.kod}</td>
                    <td className="fw-semibold">{s.ad}</td>
                    <td className="small">{s.grupAdi}</td>
                    <td className="small">{s.birim}</td>
                    <td className="text-end">{miktarYaz(s.giris)}</td>
                    <td className="text-end">{miktarYaz(s.cikis)}</td>
                    <td className={`text-end fw-bold ${s.bakiye < 0 ? "text-danger" : s.eksik ? "text-warning" : ""}`}>{miktarYaz(s.bakiye)}</td>
                    <td className="text-end text-muted">{miktarYaz(s.enAzStok)}</td>
                    <td className="text-end small">{para(s.maliyet)}</td>
                    <td className="text-end">{para(s.deger)}</td>
                    <td className="small text-muted">{tarihYaz(s.sonHareket)}</td>
                    <td className="text-center">{s.bakiye < 0 ? <Badge bg="danger">Eksi</Badge> : s.eksik ? <Badge bg="warning" text="dark">Az</Badge> : !s.aktif ? <Badge bg="secondary">Pasif</Badge> : null}</td>
                  </tr>
                ))}
            </tbody>
            {satirlar.length > 0 && <tfoot className="table-light fw-bold small"><tr><td colSpan={10} className="text-end">Toplam stok değeri</td><td className="text-end">{para(deger)}</td><td colSpan={2}></td></tr></tfoot>}
          </Table>
        </div>
      </Card>
    </div>
  );
};

export default StokDurumListesiPage;
