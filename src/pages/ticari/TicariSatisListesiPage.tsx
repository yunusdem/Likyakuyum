import React, { useEffect, useMemo, useState } from "react";
import { Badge, Button, Card, Col, Form, InputGroup, Row, Spinner, Table } from "react-bootstrap";
import { IconEdit, IconEye, IconPrinter, IconReceipt, IconSearch } from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";
import ERPToolbar from "../../components/common/ERPToolbar";
import { useToast } from "../../context/ToastContext";
import { printReportTable } from "../../utils/printReport";
import { TicariSatisFisi, TicariSatisListeSatiri, TicariService, para, saatYaz, tarihYaz } from "../../services/ticariService";
import { TicariFisPrintModal } from "./TicariFisPrintModal";

const ayBasi = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`; };
const bugun = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

/** C- Satış Listesi (docs/TICARI_ISLEMLER_YOL_HARITASI.md, T16): yalnız Ticari satış fişleri */
export const TicariSatisListesiPage: React.FC = () => {
  const { showError } = useToast();
  const navigate = useNavigate();
  const [liste, setListe] = useState<TicariSatisListeSatiri[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [bas, setBas] = useState(ayBasi());
  const [bit, setBit] = useState(bugun());
  const [arama, setArama] = useState("");
  const [eBelge, setEBelge] = useState<string>("");
  const [yazdirilacak, setYazdirilacak] = useState<TicariSatisFisi | null>(null);

  const istek = React.useRef(0);
  const yukle = async () => {
    const no = ++istek.current;
    setYukleniyor(true);
    try { const v = await TicariService.satisListe({ baslangic: bas, bitis: bit, arama: arama.trim() || undefined, eBelgeDurumu: eBelge === "" ? null : Number(eBelge) }); if (no === istek.current) setListe(v); }
    catch (e: any) { if (no === istek.current) showError(e?.message || "Satış listesi alınamadı."); }
    finally { if (no === istek.current) setYukleniyor(false); }
  };
  useEffect(() => { void yukle(); }, [bas, bit, eBelge]); // eslint-disable-line react-hooks/exhaustive-deps

  const t = useMemo(() => {
    const top = (f: (x: TicariSatisListeSatiri) => number) => liste.reduce((a, x) => a + f(x), 0);
    return { adet: liste.length, brut: top((x) => x.brutDahil), iskonto: top((x) => x.iskonto), kdv: top((x) => x.toplamKdv), genel: top((x) => x.genelToplam),
      nakit: top((x) => x.nakit), kart: top((x) => x.kart), cari: top((x) => x.cari), havale: top((x) => x.havale) };
  }, [liste]);

  const yazdir = async (f: TicariSatisListeSatiri) => {
    try { setYazdirilacak(await TicariService.satis(f.faturaId)); } catch (e: any) { showError(e?.message || "Fiş okunamadı."); }
  };

  const listeYazdir = () => printReportTable({
    title: "Ticari Satış Listesi",
    subtitle: `${tarihYaz(bas)} – ${tarihYaz(bit)} · ${t.adet} fiş · ${para(t.genel)} TL`,
    columns: [
      { header: "Fatura No", key: "faturaNo" }, { header: "Tarih", render: (x: TicariSatisListeSatiri) => `${tarihYaz(x.tarih)} ${saatYaz(x.tarih)}` },
      { header: "Müşteri", key: "aliciUnvan" }, { header: "Kalem", render: (x: TicariSatisListeSatiri) => String(x.satirSayisi) },
      { header: "Brüt", render: (x: TicariSatisListeSatiri) => para(x.brutDahil) }, { header: "İskonto", render: (x: TicariSatisListeSatiri) => para(x.iskonto) },
      { header: "KDV", render: (x: TicariSatisListeSatiri) => para(x.toplamKdv) }, { header: "Genel Toplam", render: (x: TicariSatisListeSatiri) => para(x.genelToplam) },
      { header: "Nakit", render: (x: TicariSatisListeSatiri) => para(x.nakit) }, { header: "Kart", render: (x: TicariSatisListeSatiri) => para(x.kart) },
      { header: "Cari", render: (x: TicariSatisListeSatiri) => para(x.cari) }, { header: "Havale", render: (x: TicariSatisListeSatiri) => para(x.havale) },
    ] as any,
    data: liste,
  });

  const kartlar: [string, number, string][] = [["Fiş", t.adet, "primary"], ["Brüt", t.brut, "secondary"], ["İskonto", t.iskonto, "success"], ["Genel Toplam", t.genel, "dark"]];

  return (
    <div className="container-fluid p-2">
      <ERPToolbar pageTitle="C- Satış Listesi" pageIcon={<IconReceipt size={20} />} onNew={() => navigate("/ticari/satis-fisi")} onRefresh={yukle} onPrint={listeYazdir} hideSave hideDelete />
      <Row className="g-2 mb-2">
        {kartlar.map(([ad, deger, renk]) => (
          <Col key={ad} xs={6} md={3}>
            <Card className={`border-0 shadow-xs bg-${renk} bg-opacity-10 h-100`}>
              <Card.Body className="p-2">
                <div className="text-muted small fw-semibold">{ad}</div>
                <div className={`fs-5 fw-bold text-${renk}`}>{ad === "Fiş" ? `${deger} adet` : `${para(deger)} TL`}</div>
              </Card.Body>
            </Card>
          </Col>
        ))}
      </Row>
      <Card className="border shadow-xs mb-2">
        <Card.Body className="p-2">
          <Row className="g-2 align-items-end">
            <Col md={2}><Form.Label className="small text-muted mb-1 fw-bold">Başlangıç</Form.Label><Form.Control size="sm" type="date" value={bas} onChange={(e) => setBas(e.target.value)} /></Col>
            <Col md={2}><Form.Label className="small text-muted mb-1 fw-bold">Bitiş</Form.Label><Form.Control size="sm" type="date" value={bit} onChange={(e) => setBit(e.target.value)} /></Col>
            <Col md={2}>
              <Form.Label className="small text-muted mb-1 fw-bold">e-Belge</Form.Label>
              <Form.Select size="sm" value={eBelge} onChange={(e) => setEBelge(e.target.value)}>
                <option value="">Hepsi</option><option value="0">Gönderilmedi</option><option value="1">Gönderildi</option>
              </Form.Select>
            </Col>
            <Col md={6}>
              <Form.Label className="small text-muted mb-1 fw-bold">Ara</Form.Label>
              <InputGroup size="sm">
                <InputGroup.Text className="bg-light"><IconSearch size={15} /></InputGroup.Text>
                <Form.Control value={arama} placeholder="Fatura no, müşteri, VKN ya da ürün adı..." onChange={(e) => setArama(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void yukle(); }} />
                <Button variant="outline-primary" onClick={yukle}>Listele</Button>
              </InputGroup>
            </Col>
          </Row>
        </Card.Body>
      </Card>
      <Card className="border shadow-xs">
        <div className="table-responsive" style={{ maxHeight: "calc(100vh - 360px)", minHeight: 300 }}>
          <Table hover striped bordered size="sm" className="align-middle mb-0 text-nowrap">
            <thead className="table-light sticky-top">
              <tr className="small text-secondary">
                <th style={{ width: 40 }} className="text-center">#</th><th>Fatura No</th><th>Tarih</th><th>Müşteri</th><th>TCKN / VKN</th><th className="text-center">Kalem</th>
                <th className="text-end">Brüt</th><th className="text-end">İskonto</th><th className="text-end">KDV</th><th className="text-end">Genel Toplam</th>
                <th className="text-end">Nakit</th><th className="text-end">Kart</th><th className="text-end">Cari</th><th className="text-end">Havale</th><th className="text-center">e-Belge</th><th style={{ width: 100 }} className="text-center">İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {yukleniyor ? <tr><td colSpan={16} className="text-center py-5"><Spinner size="sm" className="me-2" />Yükleniyor...</td></tr>
                : liste.length === 0 ? <tr><td colSpan={16} className="text-center py-5 text-muted">Bu aralıkta satış fişi yok.</td></tr>
                : liste.map((f, i) => (
                  <tr key={f.faturaId} onDoubleClick={() => navigate(`/ticari/satis-fisi-duzeltme?id=${f.faturaId}`)} style={{ cursor: "pointer" }}>
                    <td className="text-center text-muted small">{i + 1}</td>
                    <td className="fw-bold font-monospace text-primary">{f.faturaNo}</td>
                    <td className="small">{tarihYaz(f.tarih)} <span className="text-muted">{saatYaz(f.tarih)}</span></td>
                    <td className="fw-semibold text-truncate" style={{ maxWidth: 220 }} title={f.aliciUnvan}>{f.aliciUnvan}</td>
                    <td className="font-monospace small">{f.aliciVknTckn}</td>
                    <td className="text-center">{f.satirSayisi}</td>
                    <td className="text-end small">{para(f.brutDahil)}</td>
                    <td className="text-end small text-success">{f.iskonto ? para(f.iskonto) : ""}</td>
                    <td className="text-end small text-muted">{para(f.toplamKdv)}</td>
                    <td className="text-end fw-bold">{para(f.genelToplam)}</td>
                    <td className="text-end small">{f.nakit ? para(f.nakit) : ""}</td>
                    <td className="text-end small">{f.kart ? para(f.kart) : ""}</td>
                    <td className="text-end small text-danger">{f.cari ? para(f.cari) : ""}</td>
                    <td className="text-end small">{f.havale ? para(f.havale) : ""}</td>
                    <td className="text-center">{f.eBelgeDurumu ? <Badge bg="success">Gönderildi</Badge> : <Badge bg="light" text="dark" className="border">Gönderilmedi</Badge>}</td>
                    <td className="text-center">
                      <div className="btn-group btn-group-sm">
                        <Button size="sm" variant="outline-primary" className="py-0 px-1" title="Aç" onClick={() => navigate(`/ticari/satis-fisi-duzeltme?id=${f.faturaId}`)}><IconEye size={14} /></Button>
                        <Button size="sm" variant="outline-secondary" className="py-0 px-1" title="Düzelt" disabled={!!f.eBelgeDurumu} onClick={() => navigate(`/ticari/satis-fisi-duzeltme?id=${f.faturaId}`)}><IconEdit size={14} /></Button>
                        <Button size="sm" variant="outline-success" className="py-0 px-1" title="Yazdır" onClick={() => yazdir(f)}><IconPrinter size={14} /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
            {liste.length > 0 && (
              <tfoot className="table-light fw-bold small">
                <tr>
                  <td colSpan={6} className="text-end">Toplam</td>
                  <td className="text-end">{para(t.brut)}</td><td className="text-end">{para(t.iskonto)}</td><td className="text-end">{para(t.kdv)}</td><td className="text-end">{para(t.genel)}</td>
                  <td className="text-end">{para(t.nakit)}</td><td className="text-end">{para(t.kart)}</td><td className="text-end">{para(t.cari)}</td><td className="text-end">{para(t.havale)}</td><td colSpan={2}></td>
                </tr>
              </tfoot>
            )}
          </Table>
        </div>
      </Card>
      <TicariFisPrintModal show={!!yazdirilacak} onHide={() => setYazdirilacak(null)} fatura={yazdirilacak} />
    </div>
  );
};

export default TicariSatisListesiPage;
