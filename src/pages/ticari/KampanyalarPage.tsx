import React, { useEffect, useState } from "react";
import { Alert, Badge, Button, Card, Col, Form, Modal, Row, Spinner, Table } from "react-bootstrap";
import { IconDiscount2, IconEdit, IconPlus, IconTrash, IconX } from "@tabler/icons-react";
import ERPToolbar from "../../components/common/ERPToolbar";
import { useToast } from "../../context/ToastContext";
import { Kampanya, KampanyaGirdi, StokGrup, StokKart, TicariService, para } from "../../services/ticariService";
import { StokKartSecici } from "./StokKartSecici";
import { YETKI_YOK_MESAJI, useTicariYetki } from "./useTicariYetki";

/**
 * P- Kampanyalar (docs/TICARI_GERI_BILDIRIM_YOL_HARITASI.md İş 11, G12): tarihli yüzde / tutar indirimi, hedef gruplar / kartlar / tümü.
 * Kayıt kesin onayla. Satışta satır iskontosu olarak kendiliğinden uygulanır; süresi geçince uygulanmaz.
 */
const yerel = (iso: string) => { const d = new Date(iso); const p = (n: number) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };
const bugun = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return yerel(d.toISOString()); };
const gunSonu = (gun = 7) => { const d = new Date(); d.setDate(d.getDate() + gun); d.setHours(23, 59, 0, 0); return yerel(d.toISOString()); };

type Form_ = { kampanyaId: number | null; ad: string; baslangic: string; bitis: string; tur: 1 | 2; deger: string; hedefTuru: 1 | 2 | 3; grupIdler: number[]; kartlar: { stokKartId: number; kod: string; ad: string }[]; aktif: boolean; aciklama: string };
const bosForm = (): Form_ => ({ kampanyaId: null, ad: "", baslangic: bugun(), bitis: gunSonu(), tur: 1, deger: "10", hedefTuru: 1, grupIdler: [], kartlar: [], aktif: true, aciklama: "" });

export const KampanyalarPage: React.FC = () => {
  const { showSuccess, showError } = useToast();
  const yetki = useTicariYetki();
  const [liste, setListe] = useState<Kampanya[]>([]);
  const [gruplar, setGruplar] = useState<StokGrup[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [form, setForm] = useState<Form_ | null>(null);
  const [kaydediliyor, setKaydediliyor] = useState(false);
  const [kartSecici, setKartSecici] = useState(false);

  const yukle = async () => {
    setYukleniyor(true);
    try { setListe(await TicariService.kampanyalar()); }
    catch (e: any) { showError(e?.message || "Kampanyalar alınamadı."); }
    finally { setYukleniyor(false); }
  };
  useEffect(() => { void yukle(); TicariService.gruplar().then(setGruplar).catch(() => setGruplar([])); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const duzelt = (k: Kampanya) => setForm({ kampanyaId: k.kampanyaId, ad: k.ad, baslangic: yerel(k.baslangic), bitis: yerel(k.bitis), tur: k.tur, deger: String(k.deger).replace(".", ","), hedefTuru: k.hedefTuru, grupIdler: k.gruplar.map((g) => g.stokGrupId), kartlar: k.kartlar, aktif: k.aktif, aciklama: k.aciklama || "" });

  const kaydet = async () => {
    if (!form) return;
    const deger = Number(form.deger.replace(",", "."));
    if (!form.ad.trim()) return showError("Kampanya adı zorunlu.");
    if (!(deger > 0)) return showError("İndirim değeri sıfırdan büyük olmalı.");
    const hedef = form.hedefTuru === 3 ? "bütün ürünlere" : form.hedefTuru === 1 ? `${form.grupIdler.length} gruba` : `${form.kartlar.length} karta`;
    const ozet = `"${form.ad.trim()}": ${form.tur === 1 ? `%${deger}` : `${para(deger)} TL`} indirim ${hedef}, ${new Date(form.baslangic).toLocaleString("tr-TR")} – ${new Date(form.bitis).toLocaleString("tr-TR")}.`;
    if (!window.confirm(`${ozet}\n\nKampanya ${form.aktif ? "aktif olarak " : ""}kaydedilsin mi? Yürürlükteyken satışlarda satır iskontosu olarak kendiliğinden uygulanır.`)) return;
    setKaydediliyor(true);
    try {
      const g: KampanyaGirdi = { kampanyaId: form.kampanyaId, ad: form.ad.trim(), baslangic: new Date(form.baslangic).toISOString(), bitis: new Date(form.bitis).toISOString(), tur: form.tur, deger, hedefTuru: form.hedefTuru, grupIdler: form.grupIdler, kartIdler: form.kartlar.map((k) => k.stokKartId), aktif: form.aktif, aciklama: form.aciklama.trim() || null };
      await TicariService.kampanyaKaydet(g);
      showSuccess("Kampanya kaydedildi.");
      setForm(null);
      await yukle();
    } catch (e: any) { showError(e?.message || "Kampanya kaydedilemedi."); }
    finally { setKaydediliyor(false); }
  };
  const sil = async (k: Kampanya) => {
    if (!window.confirm(`"${k.ad}" kampanyası silinsin mi? (Fişte kullanılmışsa silinemez, pasif yapın.)`)) return;
    try { await TicariService.kampanyaSil(k.kampanyaId); showSuccess("Kampanya silindi."); await yukle(); }
    catch (e: any) { showError(e?.message || "Kampanya silinemedi."); }
  };

  const yonetebilir = yetki.yonetebilir;
  const hedefYazi = (k: Kampanya) => (k.hedefTuru === 3 ? "Tüm ürünler" : k.hedefTuru === 1 ? `Gruplar: ${k.gruplar.map((g) => g.ad).join(", ")}` : `${k.kartlar.length} kart`);

  return (
    <div className="container-fluid p-2">
      <ERPToolbar pageTitle="P- Kampanyalar" pageIcon={<IconDiscount2 size={20} />} onRefresh={yukle} onNew={yonetebilir ? () => setForm(bosForm()) : undefined} hideNew={!yonetebilir} hideSave hideDelete hidePrint />
      {!yetki.yukleniyor && !yonetebilir && <Alert variant="warning" className="py-2">{YETKI_YOK_MESAJI} Kampanyaları yalnız görüntüleyebilirsiniz.</Alert>}
      <Alert variant="light" className="py-2 small border">Yürürlükteki kampanya, Satış Fişi ve Hızlı Satış'ta kapsadığı ürünün satırına kendiliğinden <b>satır iskontosu</b> olarak uygulanır (e-Belge'ye satır iskontosu gider); süresi bitince uygulanmaz. Ürün birden çok kampanyaya uyuyorsa en yüksek indirim geçerlidir. Fiyat Gör'de kampanyalı fiyat görünür.</Alert>
      <Card className="border shadow-xs">
        <Card.Header className="bg-light py-2 d-flex align-items-center"><span className="fw-bold small">Kampanyalar</span>{yonetebilir && <Button size="sm" variant="primary" className="ms-auto" onClick={() => setForm(bosForm())}><IconPlus size={15} className="me-1" />Yeni kampanya</Button>}</Card.Header>
        <Table hover bordered size="sm" className="align-middle mb-0">
          <thead className="table-light"><tr className="small text-secondary"><th>Ad</th><th>Başlangıç</th><th>Bitiş</th><th>İndirim</th><th>Hedef</th><th className="text-center">Durum</th><th style={{ width: 100 }}></th></tr></thead>
          <tbody>
            {yukleniyor ? <tr><td colSpan={7} className="text-center py-4"><Spinner size="sm" className="me-2" />Yükleniyor...</td></tr>
              : liste.length === 0 ? <tr><td colSpan={7} className="text-center py-4 text-muted">Kampanya yok.</td></tr>
              : liste.map((k) => (
                <tr key={k.kampanyaId} className={k.yururlukte ? "" : "text-muted"}>
                  <td className="fw-semibold">{k.ad}{k.aciklama && <div className="small text-muted fw-normal">{k.aciklama}</div>}</td>
                  <td>{new Date(k.baslangic).toLocaleString("tr-TR")}</td><td>{new Date(k.bitis).toLocaleString("tr-TR")}</td>
                  <td>{k.tur === 1 ? `%${k.deger}` : `${para(k.deger)} TL`}</td><td className="small">{hedefYazi(k)}</td>
                  <td className="text-center">{k.yururlukte ? <Badge bg="success">Yürürlükte</Badge> : !k.aktif ? <Badge bg="secondary">Pasif</Badge> : new Date(k.bitis).getTime() < Date.now() ? <Badge bg="dark">Bitti</Badge> : <Badge bg="info">Başlamadı</Badge>}</td>
                  <td className="text-center"><div className="btn-group btn-group-sm"><Button size="sm" variant="outline-secondary" className="py-0 px-2" disabled={!yonetebilir} onClick={() => duzelt(k)} title="Düzelt"><IconEdit size={14} /></Button><Button size="sm" variant="outline-danger" className="py-0 px-2" disabled={!yonetebilir} onClick={() => void sil(k)} title="Sil"><IconTrash size={14} /></Button></div></td>
                </tr>
              ))}
          </tbody>
        </Table>
      </Card>

      <Modal show={!!form} onHide={() => setForm(null)} size="lg" centered backdrop="static">
        <Modal.Header closeButton className="bg-light py-2"><Modal.Title className="fs-6 fw-bold">{form?.kampanyaId ? "Kampanya Düzelt" : "Yeni Kampanya"}</Modal.Title></Modal.Header>
        {form && (
          <Modal.Body className="p-3">
            <Row className="g-2">
              <Col md={8}><Form.Label className="small fw-bold mb-1">Kampanya adı <span className="text-danger">*</span></Form.Label><Form.Control size="sm" autoFocus maxLength={100} value={form.ad} onChange={(e) => setForm({ ...form, ad: e.target.value })} /></Col>
              <Col md={4} className="d-flex align-items-end"><Form.Check type="switch" id="kmp-aktif" label="Aktif" checked={form.aktif} onChange={(e) => setForm({ ...form, aktif: e.target.checked })} /></Col>
              <Col md={6}><Form.Label className="small fw-bold mb-1">Başlangıç</Form.Label><Form.Control size="sm" type="datetime-local" value={form.baslangic} onChange={(e) => setForm({ ...form, baslangic: e.target.value })} /></Col>
              <Col md={6}><Form.Label className="small fw-bold mb-1">Bitiş</Form.Label><Form.Control size="sm" type="datetime-local" value={form.bitis} onChange={(e) => setForm({ ...form, bitis: e.target.value })} /></Col>
              <Col md={4}><Form.Label className="small fw-bold mb-1">İndirim türü</Form.Label><Form.Select size="sm" value={form.tur} onChange={(e) => setForm({ ...form, tur: Number(e.target.value) as 1 | 2 })}><option value={1}>Yüzde (%)</option><option value={2}>Tutar (TL, birim fiyattan)</option></Form.Select></Col>
              <Col md={4}><Form.Label className="small fw-bold mb-1">{form.tur === 1 ? "Yüzde" : "Tutar (KDV dahil)"}</Form.Label><Form.Control size="sm" className="text-end" inputMode="decimal" value={form.deger} onChange={(e) => setForm({ ...form, deger: e.target.value.replace(/[^0-9.,]/g, "") })} /></Col>
              <Col md={4}><Form.Label className="small fw-bold mb-1">Hedef</Form.Label><Form.Select size="sm" value={form.hedefTuru} onChange={(e) => setForm({ ...form, hedefTuru: Number(e.target.value) as 1 | 2 | 3 })}><option value={1}>Ürün grupları</option><option value={2}>Seçili kartlar</option><option value={3}>Tüm ürünler</option></Form.Select></Col>
              {form.hedefTuru === 1 && (
                <Col md={12}><Form.Label className="small fw-bold mb-1">Gruplar</Form.Label>
                  <div className="d-flex flex-wrap gap-2 border rounded p-2" style={{ maxHeight: 160, overflowY: "auto" }}>
                    {gruplar.map((g) => <Form.Check key={g.stokGrupId} type="checkbox" id={`kg-${g.stokGrupId}`} label={`${g.ad} (${g.kartSayisi})`} checked={form.grupIdler.includes(g.stokGrupId)}
                      onChange={(e) => setForm({ ...form, grupIdler: e.target.checked ? [...form.grupIdler, g.stokGrupId] : form.grupIdler.filter((x) => x !== g.stokGrupId) })} />)}
                    {!gruplar.length && <span className="text-muted small">Tanımlı grup yok.</span>}
                  </div>
                </Col>
              )}
              {form.hedefTuru === 2 && (
                <Col md={12}><Form.Label className="small fw-bold mb-1">Kartlar</Form.Label>
                  <div><Button size="sm" variant="outline-primary" onClick={() => setKartSecici(true)}><IconPlus size={14} className="me-1" />Kart ekle</Button></div>
                  <div className="mt-1 d-flex flex-wrap gap-1">{form.kartlar.map((k) => <Badge key={k.stokKartId} bg="light" text="dark" className="border d-flex align-items-center gap-1">{k.kod} {k.ad}<IconX size={12} role="button" onClick={() => setForm({ ...form, kartlar: form.kartlar.filter((x) => x.stokKartId !== k.stokKartId) })} /></Badge>)}</div>
                </Col>
              )}
              <Col md={12}><Form.Label className="small fw-bold mb-1">Açıklama</Form.Label><Form.Control size="sm" maxLength={300} value={form.aciklama} onChange={(e) => setForm({ ...form, aciklama: e.target.value })} /></Col>
            </Row>
          </Modal.Body>
        )}
        <Modal.Footer className="bg-light py-2">
          <Button variant="outline-secondary" size="sm" onClick={() => setForm(null)}>Vazgeç</Button>
          <Button variant="primary" size="sm" disabled={kaydediliyor} onClick={() => void kaydet()}>{kaydediliyor && <Spinner size="sm" className="me-1" />}Kaydet (onay sorar)</Button>
        </Modal.Footer>
      </Modal>
      <StokKartSecici show={kartSecici} onHide={() => setKartSecici(false)} onSelect={(k: StokKart) => { setForm((f) => (f && !f.kartlar.some((x) => x.stokKartId === k.stokKartId) ? { ...f, kartlar: [...f.kartlar, { stokKartId: k.stokKartId, kod: k.kod, ad: k.ad }] } : f)); setKartSecici(false); }} />
    </div>
  );
};

export default KampanyalarPage;
