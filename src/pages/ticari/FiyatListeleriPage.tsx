import React, { useEffect, useState } from "react";
import { Alert, Badge, Button, Card, Col, Form, InputGroup, Row, Spinner, Table } from "react-bootstrap";
import { IconCheck, IconEdit, IconListNumbers, IconPlus, IconSearch, IconTrash, IconUserPlus, IconX } from "@tabler/icons-react";
import ERPToolbar from "../../components/common/ERPToolbar";
import { LookupModal } from "../../components/common/LookupModal";
import { useToast } from "../../context/ToastContext";
import { CariKartItem, CariService } from "../../services/cariService";
import { FiyatListesi, TicariService } from "../../services/ticariService";
import { YETKI_YOK_MESAJI, useTicariYetki } from "./useTicariYetki";

/**
 * N- Fiyat Listeleri (docs/TICARI_GERI_BILDIRIM_YOL_HARITASI.md İş 11, G6–G7): liste tanımları ve cari → varsayılan liste
 * atamaları. Ana liste kartın satış fiyatıdır; tanımlı listede kart başına fiyat Stok Kartı penceresinde / Excel'de girilir.
 */
export const FiyatListeleriPage: React.FC = () => {
  const { showSuccess, showError } = useToast();
  const yetki = useTicariYetki();
  const [listeler, setListeler] = useState<FiyatListesi[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [yeniAd, setYeniAd] = useState("");
  const [duzenlenen, setDuzenlenen] = useState<{ id: number; ad: string; aktif: boolean; sira: number } | null>(null);
  const [mesgul, setMesgul] = useState(false);
  const [secili, setSecili] = useState<number | null>(null);
  const [cariler, setCariler] = useState<{ cariKartId: number; kod: string; unvan: string }[]>([]);
  const [cariYukleniyor, setCariYukleniyor] = useState(false);
  const [tumCariler, setTumCariler] = useState<CariKartItem[] | null>(null);
  const [cariSecici, setCariSecici] = useState(false);

  const yukle = async () => {
    setYukleniyor(true);
    try { setListeler(await TicariService.fiyatListeleri()); }
    catch (e: any) { showError(e?.message || "Fiyat listeleri alınamadı."); }
    finally { setYukleniyor(false); }
  };
  useEffect(() => { void yukle(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const carileriYukle = async (id: number) => {
    setCariYukleniyor(true);
    try { setCariler(await TicariService.fiyatListesiCarileri(id)); }
    catch (e: any) { showError(e?.message || "Cariler alınamadı."); }
    finally { setCariYukleniyor(false); }
  };
  useEffect(() => { if (secili !== null) void carileriYukle(secili); else setCariler([]); }, [secili]); // eslint-disable-line react-hooks/exhaustive-deps

  const ekle = async () => {
    if (!yeniAd.trim()) return;
    setMesgul(true);
    try { await TicariService.fiyatListesiKaydet({ ad: yeniAd.trim(), sira: listeler.length + 1 }); showSuccess(`"${yeniAd.trim()}" listesi eklendi.`); setYeniAd(""); await yukle(); }
    catch (e: any) { showError(e?.message || "Liste eklenemedi."); }
    finally { setMesgul(false); }
  };
  const kaydet = async () => {
    if (!duzenlenen) return;
    setMesgul(true);
    try { await TicariService.fiyatListesiKaydet({ fiyatListesiId: duzenlenen.id, ad: duzenlenen.ad, aktif: duzenlenen.aktif, sira: duzenlenen.sira }); showSuccess("Liste güncellendi."); setDuzenlenen(null); await yukle(); }
    catch (e: any) { showError(e?.message || "Liste kaydedilemedi."); }
    finally { setMesgul(false); }
  };
  const sil = async (l: FiyatListesi) => {
    if (!window.confirm(`"${l.ad}" listesi silinsin mi? Bu listedeki ${l.kartSayisi} kart fiyatı ve ${l.cariSayisi} cari ataması da silinir.`)) return;
    try { await TicariService.fiyatListesiSil(l.fiyatListesiId); showSuccess("Liste silindi."); if (secili === l.fiyatListesiId) setSecili(null); await yukle(); }
    catch (e: any) { showError(e?.message || "Liste silinemedi."); }
  };

  const cariSeciciAc = async () => {
    if (!tumCariler) { try { setTumCariler(await CariService.getCariKartlar()); } catch { setTumCariler([]); } }
    setCariSecici(true);
  };
  const cariAta = async (c: CariKartItem) => {
    if (secili === null) return;
    setCariSecici(false);
    try {
      await TicariService.cariFiyatListesiKaydet(c.id, secili);
      showSuccess(`"${c.ad}" bu listeye atandı.`);
      await carileriYukle(secili);
      setListeler((p) => p.map((l) => ({ ...l, cariSayisi: l.fiyatListesiId === secili ? l.cariSayisi + (cariler.some((x) => x.cariKartId === c.id) ? 0 : 1) : l.cariSayisi })));
      void yukle();
    } catch (e: any) { showError(e?.message || "Cari atanamadı."); }
  };
  const cariKaldir = async (c: { cariKartId: number; unvan: string }) => {
    if (secili === null || !window.confirm(`"${c.unvan}" için liste ataması kaldırılsın mı? (Ana liste kullanılır)`)) return;
    try { await TicariService.cariFiyatListesiKaydet(c.cariKartId, null); showSuccess("Atama kaldırıldı."); await carileriYukle(secili); void yukle(); }
    catch (e: any) { showError(e?.message || "Atama kaldırılamadı."); }
  };

  const yonetebilir = yetki.yonetebilir;
  const seciliListe = listeler.find((l) => l.fiyatListesiId === secili) || null;

  return (
    <div className="container-fluid p-2">
      <ERPToolbar pageTitle="N- Fiyat Listeleri" pageIcon={<IconListNumbers size={20} />} onRefresh={yukle} hideSave hideDelete hideNew hidePrint />
      {!yetki.yukleniyor && !yonetebilir && <Alert variant="warning" className="py-2">{YETKI_YOK_MESAJI} Listeleri yalnız görüntüleyebilirsiniz.</Alert>}
      <Alert variant="light" className="py-2 small border">
        <b>Ana liste</b> kartın satış fiyatıdır. Burada tanımlanan listelerde kart başına ayrı fiyat Stok Kartı penceresinde ya da Excel'de ("Fiyat: liste adı" sütunu) girilir;
        girilmeyen kartta ana fiyat geçerlidir. Satış Fişi ve Hızlı Satış'ta cari seçilince carinin varsayılan listesi kullanılır, fişte elle değiştirilebilir.
      </Alert>
      <Row className="g-2">
        <Col lg={6}>
          <Card className="border shadow-xs mb-2">
            <Card.Body className="p-2">
              <Form.Label className="small text-muted mb-1 fw-bold">Yeni liste adı</Form.Label>
              <InputGroup size="sm">
                <Form.Control value={yeniAd} disabled={!yonetebilir || mesgul} maxLength={100} placeholder="Ör. Toptan, Bayi, İnternet"
                  onChange={(e) => setYeniAd(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void ekle(); } }} />
                <Button variant="primary" disabled={!yonetebilir || mesgul || !yeniAd.trim()} onClick={ekle}><IconPlus size={15} className="me-1" />Ekle</Button>
              </InputGroup>
            </Card.Body>
          </Card>
          <Card className="border shadow-xs">
            <Table hover striped bordered size="sm" className="align-middle mb-0">
              <thead className="table-light"><tr className="small text-secondary"><th style={{ width: 50 }} className="text-center">Sıra</th><th>Liste Adı</th><th style={{ width: 100 }} className="text-center">Fiyatlı Kart</th><th style={{ width: 80 }} className="text-center">Cari</th><th style={{ width: 80 }} className="text-center">Durum</th><th style={{ width: 100 }} className="text-center">İşlemler</th></tr></thead>
              <tbody>
                <tr className="table-light"><td className="text-center text-muted">—</td><td className="fw-semibold">Ana liste <span className="text-muted small">(kartın satış fiyatı)</span></td><td className="text-center text-muted small">hepsi</td><td className="text-center text-muted small">atanmamış cariler</td><td className="text-center"><Badge bg="success">Aktif</Badge></td><td></td></tr>
                {yukleniyor ? <tr><td colSpan={6} className="text-center py-4"><Spinner size="sm" className="me-2" />Yükleniyor...</td></tr>
                  : listeler.map((l) => (
                    <tr key={l.fiyatListesiId} onClick={() => setSecili(l.fiyatListesiId)} className={secili === l.fiyatListesiId ? "table-primary" : ""} style={{ cursor: "pointer" }} title="Cari atamalarını göster">
                      <td className="text-center small">{duzenlenen?.id === l.fiyatListesiId ? <Form.Control size="sm" type="number" value={duzenlenen.sira} onClick={(e) => e.stopPropagation()} onChange={(e) => setDuzenlenen({ ...duzenlenen, sira: Number(e.target.value) || 0 })} /> : l.sira}</td>
                      <td>
                        {duzenlenen?.id === l.fiyatListesiId ? (
                          <div className="d-flex gap-2 align-items-center" onClick={(e) => e.stopPropagation()}>
                            <Form.Control size="sm" autoFocus value={duzenlenen.ad} maxLength={100} onChange={(e) => setDuzenlenen({ ...duzenlenen, ad: e.target.value })}
                              onKeyDown={(e) => { if (e.key === "Enter") void kaydet(); if (e.key === "Escape") setDuzenlenen(null); }} />
                            <Form.Check type="switch" label="Aktif" checked={duzenlenen.aktif} onChange={(e) => setDuzenlenen({ ...duzenlenen, aktif: e.target.checked })} />
                          </div>
                        ) : <span className="fw-semibold">{l.ad}</span>}
                      </td>
                      <td className="text-center">{l.kartSayisi}</td>
                      <td className="text-center">{l.cariSayisi}</td>
                      <td className="text-center">{l.aktif ? <Badge bg="success">Aktif</Badge> : <Badge bg="secondary">Pasif</Badge>}</td>
                      <td className="text-center" onClick={(e) => e.stopPropagation()}>
                        {duzenlenen?.id === l.fiyatListesiId ? (
                          <div className="btn-group btn-group-sm"><Button size="sm" variant="success" className="py-0 px-2" disabled={mesgul} onClick={kaydet} title="Kaydet"><IconCheck size={14} /></Button><Button size="sm" variant="outline-secondary" className="py-0 px-2" onClick={() => setDuzenlenen(null)} title="Vazgeç"><IconX size={14} /></Button></div>
                        ) : (
                          <div className="btn-group btn-group-sm"><Button size="sm" variant="outline-secondary" className="py-0 px-2" disabled={!yonetebilir} title="Düzelt" onClick={() => setDuzenlenen({ id: l.fiyatListesiId, ad: l.ad, aktif: l.aktif, sira: l.sira })}><IconEdit size={14} /></Button><Button size="sm" variant="outline-danger" className="py-0 px-2" disabled={!yonetebilir} title="Sil" onClick={() => sil(l)}><IconTrash size={14} /></Button></div>
                        )}
                      </td>
                    </tr>
                  ))}
                {!yukleniyor && !listeler.length && <tr><td colSpan={6} className="text-center py-3 text-muted">Tanımlı liste yok; yalnız ana liste kullanılıyor.</td></tr>}
              </tbody>
            </Table>
          </Card>
        </Col>
        <Col lg={6}>
          <Card className="border shadow-xs">
            <Card.Header className="bg-light py-2 d-flex align-items-center gap-2">
              <span className="fw-bold">{seciliListe ? `"${seciliListe.ad}" listesine atanmış cariler` : "Liste seçin"}</span>
              <Button size="sm" variant="primary" className="ms-auto" disabled={!seciliListe || !yonetebilir} onClick={() => void cariSeciciAc()}><IconUserPlus size={15} className="me-1" />Cari ata</Button>
            </Card.Header>
            <div className="table-responsive" style={{ maxHeight: "calc(100vh - 330px)", minHeight: 240 }}>
              <Table hover bordered size="sm" className="align-middle mb-0">
                <thead className="table-light sticky-top"><tr className="small text-secondary"><th style={{ width: 110 }}>Kod</th><th>Ünvan</th><th style={{ width: 60 }}></th></tr></thead>
                <tbody>
                  {!seciliListe ? <tr><td colSpan={3} className="text-center py-5 text-muted">Soldan bir liste seçin; bu listeyi varsayılan kullanacak carileri atayın.</td></tr>
                    : cariYukleniyor ? <tr><td colSpan={3} className="text-center py-4"><Spinner size="sm" className="me-2" />Yükleniyor...</td></tr>
                    : cariler.length === 0 ? <tr><td colSpan={3} className="text-center py-5 text-muted">Atanmış cari yok. "Cari ata" ile seçin.</td></tr>
                    : cariler.map((c) => (
                      <tr key={c.cariKartId}><td className="font-monospace">{c.kod}</td><td>{c.unvan}</td><td className="text-center"><Button size="sm" variant="outline-danger" className="py-0 px-2" disabled={!yonetebilir} title="Atamayı kaldır" onClick={() => void cariKaldir(c)}><IconX size={14} /></Button></td></tr>
                    ))}
                </tbody>
              </Table>
            </div>
          </Card>
        </Col>
      </Row>
      <LookupModal<CariKartItem>
        show={cariSecici} onHide={() => setCariSecici(false)} title={`Cari seç — ${seciliListe?.ad || ""}`} items={tumCariler || []} isLoading={!tumCariler}
        searchPlaceholder="Kod, ünvan ya da vergi no..."
        columns={[
          { header: "Kod", width: "110px", render: (c) => <span className="font-monospace">{c.kod}</span>, highlight: true },
          { header: "Ünvan", render: (c) => c.ad, highlight: true },
          { header: "Vergi / TC No", width: "130px", render: (c) => c.vergiKimlikNo || "" },
        ]}
        filterFn={(c, t) => { const a = t.toLocaleLowerCase("tr-TR"); return String(c.kod || "").toLocaleLowerCase("tr-TR").includes(a) || String(c.ad || "").toLocaleLowerCase("tr-TR").includes(a) || String(c.vergiKimlikNo || "").includes(t); }}
        onSelect={(c) => void cariAta(c)} selectOnDoubleClick />
      <span className="d-none"><IconSearch size={1} /></span>
    </div>
  );
};

export default FiyatListeleriPage;
