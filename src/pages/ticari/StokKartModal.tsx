import React, { useEffect, useRef, useState } from "react";
import { Alert, Badge, Button, Col, Form, InputGroup, Modal, Row, Spinner } from "react-bootstrap";
import { IconBarcode, IconDeviceFloppy, IconPhoto, IconPlus, IconTrash, IconX } from "@tabler/icons-react";
import { useToast } from "../../context/ToastContext";
import { ProductDefinitionService, ProductItem } from "../../services/productDefinitionService";
import { BIRIM_SECENEKLERI, KDV_SECENEKLERI, StokGrup, StokKart, StokKartGirdi, TicariService, dosyaOku, miktarYaz } from "../../services/ticariService";

interface Props {
  show: boolean;
  /** Düzeltilecek kartın kimliği; yoksa yeni kart */
  stokKartId?: number | null;
  /** Yeni kartta önceden doldurulacak barkod / ad (satış fişinde bulunamayan barkod) */
  onBarkod?: string;
  onAd?: string;
  onHide: () => void;
  onSaved: (kart: StokKart) => void;
}

const bos: StokKartGirdi = { ad: "", kod: "", birim: "Adet", kdvOrani: 20, satisFiyati: "", fiyatKdvDahil: true, paraId: null, alisFiyati: "", enAzStok: "", aktif: true, aciklama: "", barkodlar: [], stokGrupId: null };

const metin = (v: number | null | undefined) => (v === null || v === undefined ? "" : String(v).replace(".", ","));

/** Stok kartı ekleme / düzeltme penceresi (T5). Yalnız ürün adı zorunlu; kod boşsa otomatik verilir. */
export const StokKartModal: React.FC<Props> = ({ show, stokKartId, onBarkod, onAd, onHide, onSaved }) => {
  const { showSuccess, showError } = useToast();
  const [g, setG] = useState<StokKartGirdi>(bos);
  const [kart, setKart] = useState<StokKart | null>(null);
  const [gruplar, setGruplar] = useState<StokGrup[]>([]);
  const [paralar, setParalar] = useState<ProductItem[]>([]);
  const [barkod, setBarkod] = useState("");
  const [yeniGrup, setYeniGrup] = useState<string | null>(null);
  const [resim, setResim] = useState<string | null | undefined>(undefined);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [kaydediliyor, setKaydediliyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const adRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!show) return;
    setHata(null); setBarkod(""); setYeniGrup(null); setResim(undefined);
    TicariService.gruplar().then(setGruplar).catch(() => setGruplar([]));
    ProductDefinitionService.getProducts().then((l) => setParalar((l || []).filter((p) => Number(p.urunTipi) === 0))).catch(() => setParalar([]));
    if (stokKartId) {
      setYukleniyor(true);
      TicariService.kart(stokKartId)
        .then((k) => {
          setKart(k);
          setG({
            stokKartId: k.stokKartId, kod: k.kod, ad: k.ad, stokGrupId: k.stokGrupId, birim: k.birim, kdvOrani: k.kdvOrani,
            satisFiyati: metin(k.satisFiyati), fiyatKdvDahil: k.fiyatKdvDahil, paraId: k.paraId, alisFiyati: metin(k.alisFiyati),
            enAzStok: metin(k.enAzStok), aktif: k.aktif, aciklama: k.aciklama || "", barkodlar: k.barkodlar,
          });
          setResim(k.resim ?? null);
        })
        .catch((e) => setHata(e?.message || "Kart okunamadı."))
        .finally(() => setYukleniyor(false));
    } else {
      setKart(null);
      setG({ ...bos, ad: onAd || "", barkodlar: onBarkod ? [onBarkod.trim()] : [] });
      setResim(null);
    }
    setTimeout(() => adRef.current?.focus(), 150);
  }, [show, stokKartId, onBarkod, onAd]);

  const alan = <K extends keyof StokKartGirdi>(k: K, v: StokKartGirdi[K]) => setG((p) => ({ ...p, [k]: v }));

  const barkodEkle = () => {
    const b = barkod.trim();
    if (!b) return;
    if (/\s/.test(b)) { setHata("Barkod boşluk içeremez."); return; }
    if ((g.barkodlar || []).includes(b)) { setBarkod(""); return; }
    alan("barkodlar", [...(g.barkodlar || []), b]);
    setBarkod("");
  };

  const grupEkle = async () => {
    const ad = (yeniGrup || "").trim();
    if (!ad) return;
    try {
      const yeni = await TicariService.grupKaydet({ ad });
      setGruplar(await TicariService.gruplar());
      alan("stokGrupId", yeni.stokGrupId);
      setYeniGrup(null);
    } catch (e: any) {
      setHata(e?.message || "Grup eklenemedi.");
    }
  };

  const resimSec = async (f?: File | null) => {
    if (!f) return;
    if (!f.type.startsWith("image/")) { setHata("Yalnız resim dosyası seçilebilir."); return; }
    if (f.size > 3 * 1024 * 1024) { setHata("Resim 3 MB'tan büyük olamaz."); return; }
    setResim(await dosyaOku(f));
  };

  const kaydet = async () => {
    if (!String(g.ad || "").trim()) { setHata("Ürün adı zorunlu."); adRef.current?.focus(); return; }
    setKaydediliyor(true);
    setHata(null);
    try {
      const girdi: StokKartGirdi = { ...g, barkodlar: [...(g.barkodlar || []), ...(barkod.trim() ? [barkod.trim()] : [])] };
      // Resim değişmediyse gönderilmez (sunucu dokunmaz)
      if (resim !== undefined && resim !== (kart?.resim ?? null)) girdi.resim = resim;
      const k = await TicariService.kartKaydet(girdi);
      showSuccess(`${k.kod} ${k.ad} kaydedildi.`);
      onSaved(k);
    } catch (e: any) {
      setHata(e?.message || "Kart kaydedilemedi.");
      showError(e?.message || "Kart kaydedilemedi.");
    } finally {
      setKaydediliyor(false);
    }
  };

  return (
    <Modal show={show} onHide={onHide} size="lg" centered backdrop="static"
      onKeyDown={(e: React.KeyboardEvent) => { if (e.key === "F1") { e.preventDefault(); void kaydet(); } }}>
      <Modal.Header closeButton className="bg-light py-2">
        <Modal.Title className="fs-6 fw-bold">{stokKartId ? `Stok Kartı Düzeltme — ${kart?.kod || ""}` : "Yeni Stok Kartı"}</Modal.Title>
      </Modal.Header>
      <Modal.Body className="p-3">
        {hata && <Alert variant="danger" className="py-2" onClose={() => setHata(null)} dismissible>{hata}</Alert>}
        {yukleniyor ? <div className="text-center py-4"><Spinner size="sm" className="me-2" />Yükleniyor...</div> : (
          <Row className="g-2">
            <Col md={8}>
              <Row className="g-2">
                <Col md={4}>
                  <Form.Label className="small fw-bold mb-1">Kod</Form.Label>
                  <Form.Control size="sm" value={g.kod || ""} maxLength={30} placeholder="Boşsa otomatik" onChange={(e) => alan("kod", e.target.value.toLocaleUpperCase("tr-TR"))} />
                </Col>
                <Col md={8}>
                  <Form.Label className="small fw-bold mb-1">Ürün Adı <span className="text-danger">*</span></Form.Label>
                  <Form.Control size="sm" ref={adRef} value={g.ad} maxLength={200} onChange={(e) => alan("ad", e.target.value)} />
                </Col>
                <Col md={6}>
                  <Form.Label className="small fw-bold mb-1">Ürün Grubu</Form.Label>
                  {yeniGrup === null ? (
                    <InputGroup size="sm">
                      <Form.Select value={g.stokGrupId ?? ""} onChange={(e) => alan("stokGrupId", e.target.value ? Number(e.target.value) : null)}>
                        <option value="">(Grup yok)</option>
                        {gruplar.filter((x) => x.aktif || x.stokGrupId === g.stokGrupId).map((x) => <option key={x.stokGrupId} value={x.stokGrupId}>{x.ad}</option>)}
                      </Form.Select>
                      <Button variant="outline-primary" title="Yeni grup" onClick={() => setYeniGrup("")}><IconPlus size={14} /></Button>
                    </InputGroup>
                  ) : (
                    <InputGroup size="sm">
                      <Form.Control autoFocus value={yeniGrup} placeholder="Yeni grup adı" maxLength={100} onChange={(e) => setYeniGrup(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void grupEkle(); } if (e.key === "Escape") setYeniGrup(null); }} />
                      <Button variant="primary" onClick={grupEkle}>Ekle</Button>
                      <Button variant="outline-secondary" onClick={() => setYeniGrup(null)}><IconX size={14} /></Button>
                    </InputGroup>
                  )}
                </Col>
                <Col md={3}>
                  <Form.Label className="small fw-bold mb-1">Birim</Form.Label>
                  <Form.Select size="sm" value={g.birim || "Adet"} onChange={(e) => alan("birim", e.target.value)}>
                    {BIRIM_SECENEKLERI.map((b) => <option key={b}>{b}</option>)}
                  </Form.Select>
                </Col>
                <Col md={3}>
                  <Form.Label className="small fw-bold mb-1">KDV %</Form.Label>
                  <Form.Select size="sm" value={String(g.kdvOrani ?? 20)} onChange={(e) => alan("kdvOrani", Number(e.target.value))}>
                    {[...new Set([...KDV_SECENEKLERI, Number(g.kdvOrani ?? 20)])].sort((a, b) => a - b).map((k) => <option key={k} value={k}>%{k}</option>)}
                  </Form.Select>
                </Col>
                <Col md={4}>
                  <Form.Label className="small fw-bold mb-1">Satış Fiyatı</Form.Label>
                  <Form.Control size="sm" className="text-end" inputMode="decimal" value={String(g.satisFiyati ?? "")} placeholder="0,00"
                    onChange={(e) => alan("satisFiyati", e.target.value.replace(/[^0-9.,]/g, ""))} />
                </Col>
                <Col md={4} className="d-flex align-items-end">
                  <Form.Check type="switch" id="kdvDahil" className="mb-1" label="Fiyat KDV dahil" checked={!!g.fiyatKdvDahil} onChange={(e) => alan("fiyatKdvDahil", e.target.checked)} />
                </Col>
                <Col md={4}>
                  <Form.Label className="small fw-bold mb-1">Para Birimi</Form.Label>
                  <Form.Select size="sm" value={g.paraId ?? ""} onChange={(e) => alan("paraId", e.target.value ? Number(e.target.value) : null)}>
                    <option value="">TL</option>
                    {paralar.filter((p) => !["TL", "TRY"].includes(String(p.kod).trim().toUpperCase())).map((p) => <option key={p.id} value={p.id}>{String(p.kod).trim()}</option>)}
                  </Form.Select>
                </Col>
                <Col md={4}>
                  <Form.Label className="small fw-bold mb-1">Alış Fiyatı (KDV hariç)</Form.Label>
                  <Form.Control size="sm" className="text-end" inputMode="decimal" value={String(g.alisFiyati ?? "")} placeholder="0,00"
                    onChange={(e) => alan("alisFiyati", e.target.value.replace(/[^0-9.,]/g, ""))} />
                </Col>
                <Col md={4}>
                  <Form.Label className="small fw-bold mb-1">En Az Stok</Form.Label>
                  <Form.Control size="sm" className="text-end" inputMode="decimal" value={String(g.enAzStok ?? "")}
                    onChange={(e) => alan("enAzStok", e.target.value.replace(/[^0-9.,]/g, ""))} />
                </Col>
                <Col md={4} className="d-flex align-items-end">
                  <Form.Check type="switch" id="aktif" className="mb-1" label="Aktif (satışta seçilebilir)" checked={!!g.aktif} onChange={(e) => alan("aktif", e.target.checked)} />
                </Col>
                <Col md={12}>
                  <Form.Label className="small fw-bold mb-1">Barkodlar</Form.Label>
                  <InputGroup size="sm">
                    <InputGroup.Text className="bg-light"><IconBarcode size={15} /></InputGroup.Text>
                    <Form.Control value={barkod} maxLength={50} placeholder="Barkodu okutun ya da yazın, Enter ile ekleyin"
                      onChange={(e) => setBarkod(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); barkodEkle(); } }} />
                    <Button variant="outline-primary" onClick={barkodEkle}><IconPlus size={14} /></Button>
                  </InputGroup>
                  <div className="d-flex flex-wrap gap-1 mt-1">
                    {(g.barkodlar || []).map((b) => (
                      <Badge key={b} bg="light" text="dark" className="border font-monospace d-flex align-items-center gap-1">
                        {b}
                        <IconX size={12} role="button" onClick={() => alan("barkodlar", (g.barkodlar || []).filter((x) => x !== b))} />
                      </Badge>
                    ))}
                  </div>
                </Col>
                <Col md={12}>
                  <Form.Label className="small fw-bold mb-1">Açıklama</Form.Label>
                  <Form.Control size="sm" as="textarea" rows={2} maxLength={500} value={g.aciklama || ""} onChange={(e) => alan("aciklama", e.target.value)} />
                </Col>
              </Row>
            </Col>
            <Col md={4}>
              <Form.Label className="small fw-bold mb-1">Resim</Form.Label>
              <div className="border rounded d-flex align-items-center justify-content-center bg-light" style={{ height: 180 }}>
                {resim ? <img src={resim} alt="" style={{ maxWidth: "100%", maxHeight: 176, objectFit: "contain" }} /> : <IconPhoto size={48} className="text-muted" />}
              </div>
              <div className="d-flex gap-1 mt-1">
                <Form.Label className="btn btn-sm btn-outline-primary mb-0 flex-grow-1">
                  Resim seç
                  <Form.Control type="file" accept="image/*" hidden onChange={(e) => resimSec((e.target as HTMLInputElement).files?.[0])} />
                </Form.Label>
                {resim && <Button size="sm" variant="outline-danger" title="Resmi kaldır" onClick={() => setResim(null)}><IconTrash size={14} /></Button>}
              </div>
              {kart && (
                <div className="mt-3 small border rounded p-2 bg-light">
                  <div className="d-flex justify-content-between"><span className="text-muted">Stok</span><b>{miktarYaz(kart.bakiye)} {kart.birim}</b></div>
                  <div className="d-flex justify-content-between"><span className="text-muted">Son alış</span><b>{kart.sonAlisFiyati !== null ? metin(kart.sonAlisFiyati) : "—"}</b></div>
                </div>
              )}
            </Col>
          </Row>
        )}
      </Modal.Body>
      <Modal.Footer className="bg-light py-2">
        <span className="me-auto small text-muted">F1: Kaydet · Yalnız ürün adı zorunlu</span>
        <Button variant="outline-secondary" size="sm" onClick={onHide}>Vazgeç</Button>
        <Button variant="primary" size="sm" disabled={kaydediliyor || yukleniyor} onClick={kaydet}>
          {kaydediliyor ? <Spinner size="sm" className="me-1" /> : <IconDeviceFloppy size={15} className="me-1" />}Kaydet
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default StokKartModal;
