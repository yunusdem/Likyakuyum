import React, { useEffect, useMemo, useState } from "react";
import { Alert, Badge, Button, Card, Col, Form, InputGroup, Row, Spinner, Table } from "react-bootstrap";
import { IconEdit, IconFileSpreadsheet, IconPackages, IconPhoto, IconPlus, IconSearch, IconTrash } from "@tabler/icons-react";
import ERPToolbar from "../../components/common/ERPToolbar";
import { useToast } from "../../context/ToastContext";
import { printReportTable } from "../../utils/printReport";
import { StokGrup, StokKart, TicariService, miktarYaz, para } from "../../services/ticariService";
import { StokKartModal } from "./StokKartModal";
import { ExcelYukleModal } from "./ExcelYukleModal";
import { YETKI_YOK_MESAJI, useTicariYetki } from "./useTicariYetki";

/** F- Stok Kartları (docs/TICARI_ISLEMLER_YOL_HARITASI.md, T5, T20) */
export const StokKartlariPage: React.FC = () => {
  const { showSuccess, showError } = useToast();
  const yetki = useTicariYetki();
  const [kartlar, setKartlar] = useState<StokKart[]>([]);
  const [gruplar, setGruplar] = useState<StokGrup[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [arama, setArama] = useState("");
  const [grupId, setGrupId] = useState<string>("");
  const [durum, setDurum] = useState<"hepsi" | "aktif" | "pasif">("aktif");
  const [secili, setSecili] = useState<number | null>(null);
  const [modal, setModal] = useState<{ acik: boolean; id: number | null }>({ acik: false, id: null });
  const [excel, setExcel] = useState(false);

  const yukle = async () => {
    setYukleniyor(true);
    try {
      const [k, g] = await Promise.all([TicariService.kartlar(), TicariService.gruplar()]);
      setKartlar(k);
      setGruplar(g);
    } catch (e: any) {
      showError(e?.message || "Stok kartları alınamadı.");
    } finally {
      setYukleniyor(false);
    }
  };
  useEffect(() => { void yukle(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const gorunen = useMemo(() => {
    const t = arama.trim().toLocaleLowerCase("tr-TR");
    return kartlar.filter((k) =>
      (durum === "hepsi" || (durum === "aktif" ? k.aktif : !k.aktif)) &&
      (!grupId || String(k.stokGrupId) === grupId) &&
      (!t || k.kod.toLocaleLowerCase("tr-TR").includes(t) || k.ad.toLocaleLowerCase("tr-TR").includes(t) || k.barkodlar.some((b) => b.includes(t))));
  }, [kartlar, arama, grupId, durum]);

  const yonetebilir = yetki.yonetebilir;
  const yeni = () => { if (yonetebilir) setModal({ acik: true, id: null }); };
  const duzelt = (k: StokKart) => { setSecili(k.stokKartId); if (yonetebilir) setModal({ acik: true, id: k.stokKartId }); };
  const sil = async (k?: StokKart) => {
    const hedef = k || kartlar.find((x) => x.stokKartId === secili);
    if (!hedef || !yonetebilir) return;
    if (!window.confirm(`${hedef.kod} ${hedef.ad} kartı silinsin mi?`)) return;
    try {
      await TicariService.kartSil(hedef.stokKartId);
      showSuccess("Kart silindi.");
      await yukle();
    } catch (e: any) {
      showError(e?.message || "Kart silinemedi.");
    }
  };

  const yazdir = () => printReportTable({
    title: "Stok Kartları",
    subtitle: `${gorunen.length} kart`,
    columns: [
      { header: "Kod", key: "kod" }, { header: "Ürün Adı", key: "ad" }, { header: "Barkod", render: (k: StokKart) => k.barkodlar.join(", ") },
      { header: "Grup", render: (k: StokKart) => k.grupAdi || "" }, { header: "Birim", key: "birim" }, { header: "KDV %", render: (k: StokKart) => String(k.kdvOrani) },
      { header: "Satış Fiyatı", render: (k: StokKart) => `${para(k.satisFiyati)} ${k.paraKodu || "TL"} ${k.fiyatKdvDahil ? "(dahil)" : "(hariç)"}` },
      { header: "Stok", render: (k: StokKart) => `${miktarYaz(k.bakiye)} ${k.birim}` },
    ] as any,
    data: gorunen,
  });

  return (
    <div className="container-fluid p-2">
      <ERPToolbar pageTitle="F- Stok Kartları" pageIcon={<IconPackages size={20} />} onNew={yonetebilir ? yeni : undefined} hideNew={!yonetebilir}
        onDelete={yonetebilir && secili ? () => sil() : undefined} hideDelete={!yonetebilir || !secili} hideSave onRefresh={yukle} onPrint={yazdir}
        rightContent={yonetebilir ? (
          <Button size="sm" variant="outline-success" onClick={() => setExcel(true)}><IconFileSpreadsheet size={16} className="me-1" />Excel'den Yükle</Button>
        ) : undefined} />
      {!yetki.yukleniyor && !yonetebilir && <Alert variant="warning" className="py-2">{YETKI_YOK_MESAJI} Kartları yalnız görüntüleyebilirsiniz.</Alert>}

      <Card className="border shadow-xs mb-2">
        <Card.Body className="p-2">
          <Row className="g-2 align-items-end">
            <Col md={5}>
              <Form.Label className="small text-muted mb-1 fw-bold">Ara</Form.Label>
              <InputGroup size="sm">
                <InputGroup.Text className="bg-light"><IconSearch size={15} /></InputGroup.Text>
                <Form.Control value={arama} placeholder="Kod, ürün adı ya da barkod ara..." onChange={(e) => setArama(e.target.value)} />
              </InputGroup>
            </Col>
            <Col md={3}>
              <Form.Label className="small text-muted mb-1 fw-bold">Grup</Form.Label>
              <Form.Select size="sm" value={grupId} onChange={(e) => setGrupId(e.target.value)}>
                <option value="">Tüm gruplar</option>
                {gruplar.map((g) => <option key={g.stokGrupId} value={g.stokGrupId}>{g.ad}</option>)}
              </Form.Select>
            </Col>
            <Col md={2}>
              <Form.Label className="small text-muted mb-1 fw-bold">Durum</Form.Label>
              <Form.Select size="sm" value={durum} onChange={(e) => setDurum(e.target.value as any)}>
                <option value="aktif">Aktif</option><option value="pasif">Pasif</option><option value="hepsi">Hepsi</option>
              </Form.Select>
            </Col>
            <Col md={2} className="text-end">
              {yonetebilir && <Button size="sm" variant="primary" onClick={yeni}><IconPlus size={15} className="me-1" />Yeni Kart</Button>}
            </Col>
          </Row>
        </Card.Body>
      </Card>

      <Card className="border shadow-xs">
        <div className="table-responsive" style={{ maxHeight: "calc(100vh - 300px)", minHeight: 300 }}>
          <Table hover striped bordered size="sm" className="align-middle mb-0 text-nowrap">
            <thead className="table-light sticky-top">
              <tr className="small text-secondary">
                <th style={{ width: 40 }} className="text-center">#</th>
                <th>Kod</th><th>Ürün Adı</th><th>Barkod</th><th>Grup</th><th>Birim</th>
                <th className="text-center">KDV</th><th className="text-end">Satış Fiyatı</th><th className="text-end">Son Alış</th>
                <th className="text-end">Stok</th><th className="text-center">Durum</th><th style={{ width: 90 }} className="text-center">İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {yukleniyor ? (
                <tr><td colSpan={12} className="text-center py-5"><Spinner size="sm" className="me-2" />Yükleniyor...</td></tr>
              ) : gorunen.length === 0 ? (
                <tr><td colSpan={12} className="text-center py-5 text-muted">Kart bulunamadı.{yonetebilir && " Yeni Kart ya da Excel'den Yükle ile ekleyebilirsiniz."}</td></tr>
              ) : gorunen.map((k, i) => (
                <tr key={k.stokKartId} onClick={() => setSecili(k.stokKartId)} onDoubleClick={() => duzelt(k)}
                  style={{ cursor: "pointer", ...(secili === k.stokKartId ? ({ "--bs-table-bg": "#dbeafe", "--bs-table-accent-bg": "#dbeafe", "--bs-table-striped-bg": "#dbeafe", "--bs-table-hover-bg": "#cfe2ff" } as any) : {}) }}>
                  <td className="text-center text-muted small">{i + 1}</td>
                  <td className="fw-bold font-monospace text-primary">{k.kod}</td>
                  <td className="fw-semibold">{k.ad} {k.resimVar && <IconPhoto size={13} className="text-muted ms-1" />}</td>
                  <td className="font-monospace small">{k.barkodlar[0] || ""}{k.barkodlar.length > 1 && <Badge bg="light" text="dark" className="border ms-1">+{k.barkodlar.length - 1}</Badge>}</td>
                  <td className="small">{k.grupAdi || ""}</td>
                  <td className="small">{k.birim}</td>
                  <td className="text-center small">%{k.kdvOrani}</td>
                  <td className="text-end">{k.satisFiyati !== null ? <>{para(k.satisFiyati)} <span className="text-muted small">{k.paraKodu || "TL"} {k.fiyatKdvDahil ? "dahil" : "hariç"}</span></> : ""}</td>
                  <td className="text-end small">{para(k.sonAlisFiyati)}</td>
                  <td className={`text-end fw-bold ${k.bakiye < 0 ? "text-danger" : k.enAzStok !== null && k.bakiye < k.enAzStok ? "text-warning" : ""}`}>{miktarYaz(k.bakiye)}</td>
                  <td className="text-center">{k.aktif ? <Badge bg="success">Aktif</Badge> : <Badge bg="secondary">Pasif</Badge>}</td>
                  <td className="text-center">
                    <div className="btn-group btn-group-sm">
                      <Button size="sm" variant="outline-secondary" className="py-0 px-2" disabled={!yonetebilir} title="Düzelt" onClick={(e) => { e.stopPropagation(); duzelt(k); }}><IconEdit size={14} /></Button>
                      <Button size="sm" variant="outline-danger" className="py-0 px-2" disabled={!yonetebilir} title="Sil" onClick={(e) => { e.stopPropagation(); void sil(k); }}><IconTrash size={14} /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
        <Card.Footer className="bg-light py-1 px-3 small text-muted d-flex justify-content-between">
          <span>{gorunen.length} kart</span><span>Çift tıklayarak düzeltin · Hareket görmüş kart silinemez, pasif yapılır</span>
        </Card.Footer>
      </Card>

      <StokKartModal show={modal.acik} stokKartId={modal.id} onHide={() => setModal({ acik: false, id: null })}
        onSaved={(k) => { setModal({ acik: false, id: null }); setSecili(k.stokKartId); void yukle(); }} />
      <ExcelYukleModal show={excel} onHide={() => setExcel(false)} onYuklendi={yukle} />
    </div>
  );
};

export default StokKartlariPage;
