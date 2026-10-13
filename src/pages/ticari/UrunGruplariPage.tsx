import React, { useEffect, useMemo, useState } from "react";
import { Alert, Badge, Button, Card, Form, InputGroup, Spinner, Table } from "react-bootstrap";
import { IconCategory, IconCheck, IconEdit, IconPlus, IconSearch, IconTrash, IconX } from "@tabler/icons-react";
import ERPToolbar from "../../components/common/ERPToolbar";
import { useToast } from "../../context/ToastContext";
import { StokGrup, TicariService } from "../../services/ticariService";
import { YETKI_YOK_MESAJI, useTicariYetki } from "./useTicariYetki";

/** G- Ürün Grupları (docs/TICARI_ISLEMLER_YOL_HARITASI.md, T6) */
export const UrunGruplariPage: React.FC = () => {
  const { showSuccess, showError } = useToast();
  const yetki = useTicariYetki();
  const [gruplar, setGruplar] = useState<StokGrup[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [arama, setArama] = useState("");
  const [yeniAd, setYeniAd] = useState("");
  const [duzenlenen, setDuzenlenen] = useState<{ id: number; ad: string; aktif: boolean } | null>(null);
  const [mesgul, setMesgul] = useState(false);

  const yukle = async () => {
    setYukleniyor(true);
    try {
      setGruplar(await TicariService.gruplar());
    } catch (e: any) {
      showError(e?.message || "Gruplar alınamadı.");
    } finally {
      setYukleniyor(false);
    }
  };
  useEffect(() => { void yukle(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const gorunen = useMemo(() => {
    const t = arama.trim().toLocaleLowerCase("tr-TR");
    return t ? gruplar.filter((g) => g.ad.toLocaleLowerCase("tr-TR").includes(t)) : gruplar;
  }, [gruplar, arama]);

  const ekle = async () => {
    if (!yeniAd.trim()) return;
    setMesgul(true);
    try {
      await TicariService.grupKaydet({ ad: yeniAd.trim() });
      showSuccess(`"${yeniAd.trim()}" grubu eklendi.`);
      setYeniAd("");
      await yukle();
    } catch (e: any) {
      showError(e?.message || "Grup eklenemedi.");
    } finally {
      setMesgul(false);
    }
  };

  const kaydet = async () => {
    if (!duzenlenen) return;
    setMesgul(true);
    try {
      await TicariService.grupKaydet({ stokGrupId: duzenlenen.id, ad: duzenlenen.ad, aktif: duzenlenen.aktif });
      showSuccess("Grup güncellendi.");
      setDuzenlenen(null);
      await yukle();
    } catch (e: any) {
      showError(e?.message || "Grup kaydedilemedi.");
    } finally {
      setMesgul(false);
    }
  };

  const sil = async (g: StokGrup) => {
    if (!window.confirm(`"${g.ad}" grubu silinsin mi?`)) return;
    try {
      await TicariService.grupSil(g.stokGrupId);
      showSuccess("Grup silindi.");
      await yukle();
    } catch (e: any) {
      showError(e?.message || "Grup silinemedi.");
    }
  };

  const yonetebilir = yetki.yonetebilir;

  return (
    <div className="container-fluid p-2">
      <ERPToolbar pageTitle="G- Ürün Grupları" pageIcon={<IconCategory size={20} />} onRefresh={yukle} hideSave hideDelete hideNew hidePrint />
      {!yetki.yukleniyor && !yonetebilir && <Alert variant="warning" className="py-2">{YETKI_YOK_MESAJI} Grupları yalnız görüntüleyebilirsiniz.</Alert>}

      <Card className="border shadow-xs mb-2">
        <Card.Body className="p-2 d-flex flex-wrap gap-2 align-items-end">
          <Form.Group style={{ minWidth: 260 }}>
            <Form.Label className="small text-muted mb-1 fw-bold">Yeni grup adı</Form.Label>
            <InputGroup size="sm">
              <Form.Control value={yeniAd} disabled={!yonetebilir || mesgul} maxLength={100} placeholder="Ör. Kırtasiye"
                onChange={(e) => setYeniAd(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void ekle(); } }} />
              <Button variant="primary" disabled={!yonetebilir || mesgul || !yeniAd.trim()} onClick={ekle}>
                <IconPlus size={15} className="me-1" />Ekle
              </Button>
            </InputGroup>
          </Form.Group>
          <Form.Group className="ms-auto" style={{ minWidth: 240 }}>
            <Form.Label className="small text-muted mb-1 fw-bold">Ara</Form.Label>
            <InputGroup size="sm">
              <InputGroup.Text className="bg-light"><IconSearch size={15} /></InputGroup.Text>
              <Form.Control value={arama} placeholder="Grup adı ara..." onChange={(e) => setArama(e.target.value)} />
            </InputGroup>
          </Form.Group>
        </Card.Body>
      </Card>

      <Card className="border shadow-xs">
        <div className="table-responsive" style={{ maxHeight: "calc(100vh - 290px)", minHeight: 240 }}>
          <Table hover striped bordered size="sm" className="align-middle mb-0">
            <thead className="table-light sticky-top">
              <tr className="small text-secondary">
                <th style={{ width: 50 }} className="text-center">#</th>
                <th>Grup Adı</th>
                <th style={{ width: 120 }} className="text-center">Kart Sayısı</th>
                <th style={{ width: 100 }} className="text-center">Durum</th>
                <th style={{ width: 120 }} className="text-center">İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {yukleniyor ? (
                <tr><td colSpan={5} className="text-center py-4"><Spinner size="sm" className="me-2" />Yükleniyor...</td></tr>
              ) : gorunen.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-4 text-muted">Grup yok. Yukarıdan ekleyebilirsiniz.</td></tr>
              ) : gorunen.map((g, i) => (
                <tr key={g.stokGrupId}>
                  <td className="text-center text-muted small">{i + 1}</td>
                  <td>
                    {duzenlenen?.id === g.stokGrupId ? (
                      <div className="d-flex gap-2 align-items-center">
                        <Form.Control size="sm" autoFocus value={duzenlenen.ad} maxLength={100}
                          onChange={(e) => setDuzenlenen({ ...duzenlenen, ad: e.target.value })}
                          onKeyDown={(e) => { if (e.key === "Enter") void kaydet(); if (e.key === "Escape") setDuzenlenen(null); }} />
                        <Form.Check type="switch" label="Aktif" checked={duzenlenen.aktif} onChange={(e) => setDuzenlenen({ ...duzenlenen, aktif: e.target.checked })} />
                      </div>
                    ) : <span className="fw-semibold">{g.ad}</span>}
                  </td>
                  <td className="text-center">{g.kartSayisi}</td>
                  <td className="text-center">{g.aktif ? <Badge bg="success">Aktif</Badge> : <Badge bg="secondary">Pasif</Badge>}</td>
                  <td className="text-center">
                    {duzenlenen?.id === g.stokGrupId ? (
                      <div className="btn-group btn-group-sm">
                        <Button size="sm" variant="success" className="py-0 px-2" disabled={mesgul} onClick={kaydet} title="Kaydet"><IconCheck size={14} /></Button>
                        <Button size="sm" variant="outline-secondary" className="py-0 px-2" onClick={() => setDuzenlenen(null)} title="Vazgeç"><IconX size={14} /></Button>
                      </div>
                    ) : (
                      <div className="btn-group btn-group-sm">
                        <Button size="sm" variant="outline-secondary" className="py-0 px-2" disabled={!yonetebilir} title="Düzelt"
                          onClick={() => setDuzenlenen({ id: g.stokGrupId, ad: g.ad, aktif: g.aktif })}><IconEdit size={14} /></Button>
                        <Button size="sm" variant="outline-danger" className="py-0 px-2" disabled={!yonetebilir} title="Sil" onClick={() => sil(g)}><IconTrash size={14} /></Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
        <Card.Footer className="bg-light py-1 px-3 small text-muted">Toplam {gorunen.length} grup. Kartı olan grup silinemez; pasif yapılabilir.</Card.Footer>
      </Card>
    </div>
  );
};

export default UrunGruplariPage;
