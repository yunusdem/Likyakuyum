import React, { useEffect, useMemo, useState } from "react";
import { Alert, Button, Card, Col, Form, InputGroup, Modal, Row, Spinner, Table } from "react-bootstrap";
import { IconEdit, IconEye, IconListDetails, IconSearch, IconTrash } from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";
import ERPToolbar from "../../components/common/ERPToolbar";
import { useToast } from "../../context/ToastContext";
import { printReportTable } from "../../utils/printReport";
import { StokGiris, TicariService, eksiStokUyarisiMi, miktarYaz, para, saatYaz, tarihYaz } from "../../services/ticariService";
import { YETKI_YOK_MESAJI, useTicariYetki } from "./useTicariYetki";

const ayBasi = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`; };
const bugun = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

/** E- Stok Giriş Listesi (T19): hangi tarihte, hangi tedarikçiden, ne kadar ürün girildi; açıp düzeltme / silme */
export const StokGirisListesiPage: React.FC = () => {
  const { showSuccess, showError } = useToast();
  const yetki = useTicariYetki();
  const navigate = useNavigate();
  const [liste, setListe] = useState<StokGiris[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [bas, setBas] = useState(ayBasi());
  const [bit, setBit] = useState(bugun());
  const [arama, setArama] = useState("");
  const [detay, setDetay] = useState<StokGiris | null>(null);

  const istek = React.useRef(0);
  const yukle = async () => {
    const no = ++istek.current;
    setYukleniyor(true);
    try { const v = await TicariService.girisListe({ baslangic: bas, bitis: bit, arama: arama.trim() || undefined }); if (no === istek.current) setListe(v); }
    catch (e: any) { if (no === istek.current) showError(e?.message || "Liste alınamadı."); }
    finally { if (no === istek.current) setYukleniyor(false); }
  };
  useEffect(() => { if (yetki.yonetebilir) void yukle(); else if (!yetki.yukleniyor) setYukleniyor(false); }, [bas, bit, yetki.yonetebilir, yetki.yukleniyor]); // eslint-disable-line react-hooks/exhaustive-deps

  const toplam = useMemo(() => ({ fis: liste.length, genel: liste.reduce((a, f) => a + f.genelToplam, 0), miktar: liste.reduce((a, f) => a + (f.toplamMiktar || 0), 0) }), [liste]);

  const sil = async (f: StokGiris, onay = false) => {
    if (!onay && !window.confirm(`${f.fisNo} numaralı fiş silinsin mi? Stok ve tedarikçi alacağı geri alınır.`)) return;
    try {
      await TicariService.girisSil(f.stokGirisId, onay);
      showSuccess("Fiş silindi.");
      await yukle();
    } catch (e: any) {
      if (eksiStokUyarisiMi(e) && window.confirm(e.message)) return sil(f, true);
      showError(e?.message || "Fiş silinemedi.");
    }
  };

  const ac = async (f: StokGiris) => {
    try { setDetay(await TicariService.giris(f.stokGirisId)); } catch (e: any) { showError(e?.message || "Fiş okunamadı."); }
  };

  const yazdir = () => printReportTable({
    title: "Stok Giriş Listesi",
    subtitle: `${tarihYaz(bas)} – ${tarihYaz(bit)} · ${liste.length} fiş · ${para(toplam.genel)} TL`,
    columns: [
      { header: "Fiş No", key: "fisNo" }, { header: "Tarih", render: (f: StokGiris) => `${tarihYaz(f.tarih)} ${saatYaz(f.tarih)}` },
      { header: "Tedarikçi", render: (f: StokGiris) => f.cariAd || "" }, { header: "Belge No", render: (f: StokGiris) => f.belgeNo || "" },
      { header: "Açıklama", render: (f: StokGiris) => f.aciklama || "" }, { header: "Kalem", render: (f: StokGiris) => String(f.satirSayisi || 0) },
      { header: "Miktar", render: (f: StokGiris) => miktarYaz(f.toplamMiktar) }, { header: "Ara Toplam", render: (f: StokGiris) => para(f.araToplam) },
      { header: "KDV", render: (f: StokGiris) => para(f.toplamKdv) }, { header: "Genel Toplam", render: (f: StokGiris) => para(f.genelToplam) },
    ] as any,
    data: liste,
  });

  if (!yetki.yukleniyor && !yetki.yonetebilir) return <div className="container-fluid p-2"><Alert variant="warning">{YETKI_YOK_MESAJI}</Alert></div>;

  return (
    <div className="container-fluid p-2">
      <ERPToolbar pageTitle="E- Stok Giriş Listesi" pageIcon={<IconListDetails size={20} />} onNew={() => navigate("/ticari/stok-giris-fisi")} onRefresh={yukle} onPrint={yazdir} hideSave hideDelete />
      <Card className="border shadow-xs mb-2">
        <Card.Body className="p-2">
          <Row className="g-2 align-items-end">
            <Col md={2}><Form.Label className="small text-muted mb-1 fw-bold">Başlangıç</Form.Label><Form.Control size="sm" type="date" value={bas} onChange={(e) => setBas(e.target.value)} /></Col>
            <Col md={2}><Form.Label className="small text-muted mb-1 fw-bold">Bitiş</Form.Label><Form.Control size="sm" type="date" value={bit} onChange={(e) => setBit(e.target.value)} /></Col>
            <Col md={5}>
              <Form.Label className="small text-muted mb-1 fw-bold">Ara</Form.Label>
              <InputGroup size="sm">
                <InputGroup.Text className="bg-light"><IconSearch size={15} /></InputGroup.Text>
                <Form.Control value={arama} placeholder="Fiş no, tedarikçi, belge no ya da ürün..." onChange={(e) => setArama(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void yukle(); }} />
                <Button variant="outline-primary" onClick={yukle}>Listele</Button>
              </InputGroup>
            </Col>
            <Col md={3} className="text-end small">
              <div><b>{toplam.fis}</b> fiş · <b>{miktarYaz(toplam.miktar)}</b> birim</div>
              <div className="fs-6 fw-bold text-primary">{para(toplam.genel)} TL</div>
            </Col>
          </Row>
        </Card.Body>
      </Card>
      <Card className="border shadow-xs">
        <div className="table-responsive" style={{ maxHeight: "calc(100vh - 300px)", minHeight: 300 }}>
          <Table hover striped bordered size="sm" className="align-middle mb-0 text-nowrap">
            <thead className="table-light sticky-top">
              <tr className="small text-secondary">
                <th style={{ width: 40 }} className="text-center">#</th><th>Fiş No</th><th>Tarih</th><th>Tedarikçi</th><th>Belge No</th><th>Açıklama</th>
                <th className="text-center">Kalem</th><th className="text-end">Miktar</th><th className="text-end">Ara Toplam</th><th className="text-end">KDV</th><th className="text-end">Genel Toplam</th>
                <th style={{ width: 110 }} className="text-center">İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {yukleniyor ? <tr><td colSpan={12} className="text-center py-5"><Spinner size="sm" className="me-2" />Yükleniyor...</td></tr>
                : liste.length === 0 ? <tr><td colSpan={12} className="text-center py-5 text-muted">Bu aralıkta stok giriş fişi yok.</td></tr>
                : liste.map((f, i) => (
                  <tr key={f.stokGirisId} onDoubleClick={() => navigate(`/ticari/stok-giris-fisi?id=${f.stokGirisId}`)} style={{ cursor: "pointer" }}>
                    <td className="text-center text-muted small">{i + 1}</td>
                    <td className="fw-bold font-monospace text-primary">{f.fisNo}</td>
                    <td className="small">{tarihYaz(f.tarih)} <span className="text-muted">{saatYaz(f.tarih)}</span></td>
                    <td className="fw-semibold">{f.cariAd || <span className="text-muted fw-normal">—</span>}</td>
                    <td className="small">{f.belgeNo || ""}</td>
                    <td className="small text-truncate" style={{ maxWidth: 220 }}>{f.aciklama || ""}</td>
                    <td className="text-center">{f.satirSayisi}</td>
                    <td className="text-end">{miktarYaz(f.toplamMiktar)}</td>
                    <td className="text-end small">{para(f.araToplam)}</td>
                    <td className="text-end small text-muted">{para(f.toplamKdv)}</td>
                    <td className="text-end fw-bold">{para(f.genelToplam)}</td>
                    <td className="text-center">
                      <div className="btn-group btn-group-sm">
                        <Button size="sm" variant="outline-primary" className="py-0 px-1" title="Detay" onClick={() => ac(f)}><IconEye size={14} /></Button>
                        <Button size="sm" variant="outline-secondary" className="py-0 px-1" title="Düzelt" onClick={() => navigate(`/ticari/stok-giris-fisi?id=${f.stokGirisId}`)}><IconEdit size={14} /></Button>
                        <Button size="sm" variant="outline-danger" className="py-0 px-1" title="Sil" onClick={() => sil(f)}><IconTrash size={14} /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </Table>
        </div>
      </Card>

      <Modal show={!!detay} onHide={() => setDetay(null)} size="lg" centered>
        <Modal.Header closeButton className="bg-light py-2"><Modal.Title className="fs-6 fw-bold">Stok Giriş Fişi {detay?.fisNo}</Modal.Title></Modal.Header>
        {detay && (
          <Modal.Body className="p-3">
            <Row className="g-2 mb-2 small">
              <Col md={4}><span className="text-muted">Tarih: </span><b>{tarihYaz(detay.tarih)} {saatYaz(detay.tarih)}</b></Col>
              <Col md={5}><span className="text-muted">Tedarikçi: </span><b>{detay.cariAd || "—"}</b></Col>
              <Col md={3}><span className="text-muted">Belge No: </span><b>{detay.belgeNo || "—"}</b></Col>
              {detay.aciklama && <Col md={12}><span className="text-muted">Açıklama: </span>{detay.aciklama}</Col>}
            </Row>
            <Table size="sm" bordered className="mb-2 small align-middle">
              <thead className="table-light"><tr><th>#</th><th>Kod</th><th>Ürün</th><th className="text-end">Miktar</th><th className="text-end">Fiyat</th><th className="text-center">KDV</th><th className="text-end">Toplam</th></tr></thead>
              <tbody>
                {(detay.satirlar || []).map((s) => (
                  <tr key={s.satirNo}><td>{s.satirNo}</td><td className="font-monospace">{s.kod}</td><td>{s.ad}</td><td className="text-end">{miktarYaz(s.miktar)} {s.birim}</td>
                    <td className="text-end">{para(s.birimFiyat)}</td><td className="text-center">%{s.kdvOrani}</td><td className="text-end fw-bold">{para(s.toplamTutar)}</td></tr>
                ))}
              </tbody>
            </Table>
            <div className="text-end small">Ara Toplam <b>{para(detay.araToplam)}</b> · KDV <b>{para(detay.toplamKdv)}</b> · <span className="fs-6">Genel Toplam <b className="text-primary">{para(detay.genelToplam)} TL</b></span></div>
          </Modal.Body>
        )}
        <Modal.Footer className="bg-light py-2">
          <Button size="sm" variant="outline-secondary" onClick={() => setDetay(null)}>Kapat</Button>
          {detay && <Button size="sm" variant="primary" onClick={() => navigate(`/ticari/stok-giris-fisi?id=${detay.stokGirisId}`)}><IconEdit size={14} className="me-1" />Düzelt</Button>}
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default StokGirisListesiPage;
