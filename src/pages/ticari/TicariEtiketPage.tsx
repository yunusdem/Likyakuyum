import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { Alert, Button, Card, Col, Form, InputGroup, Row, Table } from "react-bootstrap";
import { IconBarcode, IconDeviceFloppy, IconPrinter, IconSearch, IconTags, IconTrash } from "@tabler/icons-react";
import ERPToolbar from "../../components/common/ERPToolbar";
import { useToast } from "../../context/ToastContext";
import { KurService } from "../../services/kurService";
import { EtiketSablonItem } from "../../services/etiketService";
import { ETIKET_ALANLARI, EtiketAlani, EtiketDuzeni, StokKart, TicariService, para } from "../../services/ticariService";
import { kartDahilFiyat } from "../../../Backend/src/services/ticari/ticariHesap";
import EtiketYazdirModal, { EtiketYazdirItem } from "../etiket/EtiketYazdirModal";
import { StokKartSecici } from "./StokKartSecici";
import { useTicariYetki } from "./useTicariYetki";

/**
 * M- Etiket (docs/TICARI_GERI_BILDIRIM_YOL_HARITASI.md İş 2, G5): stok kartları için basit barkodlu fiyat etiketi.
 * Düzen (ölçü, barkod tipi, alanlar) firma bazında TODVZ_STOK_AYAR'da; yazdırma Etiket modülünün yazıcı penceresiyle.
 */
interface Satir { kart: StokKart; adet: number }

const TL = (kod?: string | null) => ["TL", "TRY", ""].includes(String(kod || "").trim().toUpperCase());

export const TicariEtiketPage: React.FC = () => {
  const location = useLocation();
  const { showSuccess, showError, showWarning } = useToast();
  const yetki = useTicariYetki();
  const [satirlar, setSatirlar] = useState<Satir[]>([]);
  const [okut, setOkut] = useState("");
  const [secici, setSecici] = useState<{ acik: boolean; arama: string }>({ acik: false, arama: "" });
  const [duzen, setDuzen] = useState<EtiketDuzeni>({ genislikMm: 50, yukseklikMm: 30, barkodTipi: "CODE128", alanlar: ["ad", "kod", "fiyat"] });
  const [duzenKaydediliyor, setDuzenKaydediliyor] = useState(false);
  const [yazdir, setYazdir] = useState(false);
  const [kurlar, setKurlar] = useState<Map<number, number>>(new Map());
  const okutRef = useRef<HTMLInputElement | null>(null);
  const odak = () => setTimeout(() => okutRef.current?.focus(), 50);

  useEffect(() => {
    TicariService.etiketDuzeni().then(setDuzen).catch(() => undefined);
    KurService.getKurTablosu({ tur: 0 }).then((t) => {
      const m = new Map<number, number>();
      for (const k of t?.satirlar || []) m.set(Number(k.paraId), Number(k.efektifSatis ?? k.dovizSatis ?? 0) || 0);
      setKurlar(m);
    }).catch(() => undefined);
    // Fiyat Gör'den "Etikete Bas" ile gelen kart
    const id = Number(new URLSearchParams(location.search).get("kart"));
    if (id) TicariService.kart(id).then((k) => k && ekle(k, 1)).catch(() => undefined);
    odak();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const ekle = (k: StokKart, adet: number) => {
    setSatirlar((p) => {
      const var_ = p.find((s) => s.kart.stokKartId === k.stokKartId);
      if (var_) return p.map((s) => (s === var_ ? { ...s, adet: s.adet + adet } : s));
      return [...p, { kart: k, adet }];
    });
  };

  const okutuldu = async () => {
    const d = okut.trim();
    if (!d) { setSecici({ acik: true, arama: "" }); return; }
    const m = d.match(/^(\d+)\s*\*\s*(.+)$/);
    const adet = m ? Math.max(1, Number(m[1])) : 1;
    const deger = m ? m[2].trim() : d;
    const k = await TicariService.kartBul(deger).catch(() => null);
    if (k) { ekle(k, adet); setOkut(""); odak(); }
    else { showWarning(`"${deger}" barkodlu ya da kodlu ürün bulunamadı.`); setSecici({ acik: true, arama: deger }); }
  };

  const fiyatTL = (k: StokKart): number => {
    const dahil = kartDahilFiyat(k.satisFiyati, k.kdvOrani, k.fiyatKdvDahil);
    if (!k.paraId || TL(k.paraKodu)) return dahil;
    const kur = kurlar.get(k.paraId) || 0;
    return kur > 0 ? Math.round(dahil * kur * 100) / 100 : 0;
  };

  const duzeniKaydet = async () => {
    setDuzenKaydediliyor(true);
    try { setDuzen(await TicariService.etiketDuzeniKaydet(duzen)); showSuccess("Etiket düzeni kaydedildi."); }
    catch (e: any) { showError(e?.message || "Düzen kaydedilemedi."); }
    finally { setDuzenKaydediliyor(false); }
  };

  const alanAc = (a: EtiketAlani, acik: boolean) => setDuzen((d) => ({ ...d, alanlar: acik ? [...new Set([...d.alanlar, a])] : d.alanlar.filter((x) => x !== a) }));

  // Etiket modülünün yazdırma penceresi için sanal şablon + satırlar (adet kadar kopya)
  const sablon = useMemo<EtiketSablonItem>(() => ({
    etiketSablonId: 0, ad: "Ticari ürün etiketi", etiketTipi: 3, genislikMm: duzen.genislikMm, yukseklikMm: duzen.yukseklikMm, kuyrukPayiMm: 0,
    logoKonumu: "yok", barkodTipi: duzen.barkodTipi, varsayilan: false,
    alanlar: ETIKET_ALANLARI.filter((a) => duzen.alanlar.includes(a.kod)).map((a, i) => ({ alan: a.kod, key: a.kod, ad: a.ad, aktif: true, sira: i + 1 })),
  }), [duzen]);
  const yazdirilacak = useMemo<EtiketYazdirItem[]>(() => satirlar.flatMap((s) => Array.from({ length: s.adet }, (_, i) => ({
    id: `${s.kart.stokKartId}-${i}`,
    barkod: s.kart.barkodlar[0] || s.kart.kod,
    fields: { ad: s.kart.ad, kod: s.kart.kod, grup: s.kart.grupAdi || "", fiyat: s.kart.satisFiyati === null ? "" : `${para(fiyatTL(s.kart))} TL`, birim: s.kart.birim },
  }))), [satirlar, kurlar]); // eslint-disable-line react-hooks/exhaustive-deps
  const toplamAdet = satirlar.reduce((a, s) => a + s.adet, 0);

  return (
    <div className="container-fluid p-2">
      <ERPToolbar pageTitle="M- Etiket" pageIcon={<IconTags size={20} />} hideSave hideDelete hideNew onPrint={satirlar.length ? () => setYazdir(true) : undefined}
        onRefresh={() => { setSatirlar([]); setOkut(""); odak(); }} />
      <Row className="g-2">
        <Col lg={8}>
          <Card className="border shadow-xs mb-2">
            <Card.Body className="p-2">
              <InputGroup size="lg">
                <InputGroup.Text className="bg-light"><IconBarcode size={20} /></InputGroup.Text>
                <Form.Control ref={okutRef} autoFocus value={okut} placeholder="Barkod ya da kod okutun (3*barkod = 3 etiket) · boşken Enter listeyi açar"
                  onChange={(e) => setOkut(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void okutuldu(); } if (e.key === "F4") { e.preventDefault(); setSecici({ acik: true, arama: okut.trim() }); } }} />
                <Button variant="outline-secondary" title="Ürün ara (F4)" onClick={() => setSecici({ acik: true, arama: okut.trim() })}><IconSearch size={18} className="me-1" />Ara</Button>
              </InputGroup>
            </Card.Body>
          </Card>
          <Card className="border shadow-xs">
            <div className="table-responsive" style={{ maxHeight: "calc(100vh - 330px)", minHeight: 260 }}>
              <Table hover bordered size="sm" className="align-middle mb-0">
                <thead className="table-light sticky-top"><tr className="small text-secondary"><th style={{ width: 36 }}>#</th><th>Kod</th><th>Ürün Adı</th><th>Barkod</th><th className="text-end">Fiyat (KDV dahil)</th><th style={{ width: 110 }} className="text-center">Adet</th><th style={{ width: 50 }}></th></tr></thead>
                <tbody>
                  {satirlar.length === 0 ? <tr><td colSpan={7} className="text-center text-muted py-5">Etiket basılacak ürünleri okutun ya da "Ara" ile seçin.</td></tr>
                    : satirlar.map((s, i) => (
                      <tr key={s.kart.stokKartId}>
                        <td className="text-muted small">{i + 1}</td>
                        <td className="font-monospace fw-semibold">{s.kart.kod}</td>
                        <td>{s.kart.ad}</td>
                        <td className="font-monospace small">{s.kart.barkodlar[0] || <span className="text-muted">kod basılır</span>}</td>
                        <td className="text-end">{s.kart.satisFiyati === null ? "—" : `${para(fiyatTL(s.kart))} TL`}</td>
                        <td><Form.Control size="sm" type="number" min={1} max={999} className="text-center" value={s.adet}
                          onChange={(e) => { const n = Math.max(1, Math.min(999, Number(e.target.value) || 1)); setSatirlar((p) => p.map((x) => (x === s ? { ...x, adet: n } : x))); }} /></td>
                        <td className="text-center"><Button size="sm" variant="outline-danger" className="py-0 px-1" onClick={() => setSatirlar((p) => p.filter((x) => x !== s))}><IconTrash size={14} /></Button></td>
                      </tr>
                    ))}
                </tbody>
              </Table>
            </div>
            <Card.Footer className="bg-light py-2 px-3 d-flex justify-content-between align-items-center">
              <span className="small text-muted">{satirlar.length} ürün · {toplamAdet} etiket</span>
              <Button variant="success" disabled={!satirlar.length} onClick={() => setYazdir(true)}><IconPrinter size={18} className="me-1" />Yazdır ({toplamAdet})</Button>
            </Card.Footer>
          </Card>
        </Col>
        <Col lg={4}>
          <Card className="border shadow-xs">
            <Card.Header className="bg-light py-2 fw-bold small">Etiket düzeni (firmaya özel)</Card.Header>
            <Card.Body className="p-2">
              <Row className="g-2">
                <Col xs={6}><Form.Label className="small text-muted mb-1">Genişlik (mm)</Form.Label><Form.Control size="sm" type="number" min={20} max={150} value={duzen.genislikMm} onChange={(e) => setDuzen({ ...duzen, genislikMm: Number(e.target.value) })} /></Col>
                <Col xs={6}><Form.Label className="small text-muted mb-1">Yükseklik (mm)</Form.Label><Form.Control size="sm" type="number" min={10} max={100} value={duzen.yukseklikMm} onChange={(e) => setDuzen({ ...duzen, yukseklikMm: Number(e.target.value) })} /></Col>
                <Col xs={12}><Form.Label className="small text-muted mb-1">Barkod tipi</Form.Label>
                  <Form.Select size="sm" value={duzen.barkodTipi} onChange={(e) => setDuzen({ ...duzen, barkodTipi: e.target.value as "CODE128" | "QR" })}><option value="CODE128">Çizgi barkod (CODE128)</option><option value="QR">QR kod</option></Form.Select></Col>
                <Col xs={12}><Form.Label className="small text-muted mb-1">Etikette gösterilecek alanlar</Form.Label>
                  {ETIKET_ALANLARI.map((a) => <Form.Check key={a.kod} type="switch" id={`alan-${a.kod}`} label={a.ad} checked={duzen.alanlar.includes(a.kod)} onChange={(e) => alanAc(a.kod, e.target.checked)} />)}
                </Col>
              </Row>
              {!yetki.yukleniyor && !yetki.yonetebilir && <Alert variant="light" className="py-1 small mt-2 mb-0 border">Düzeni yalnız stok yönetim yetkisi olan kaydeder; bu oturumda değişiklik yalnız yazdırmada kullanılır.</Alert>}
              <div className="d-flex justify-content-end mt-2">
                <Button size="sm" variant="primary" disabled={!yetki.yonetebilir || duzenKaydediliyor} onClick={() => void duzeniKaydet()}><IconDeviceFloppy size={15} className="me-1" />Düzeni kaydet</Button>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <StokKartSecici show={secici.acik} aramaMetni={secici.arama} onHide={() => { setSecici({ acik: false, arama: "" }); odak(); }}
        onSelect={(k) => { ekle(k, 1); setSecici({ acik: false, arama: "" }); setOkut(""); odak(); }} />
      <EtiketYazdirModal show={yazdir} onHide={() => setYazdir(false)} title="Ticari ürün etiketi" sablon={sablon} items={yazdirilacak} onAfterPrint={() => setYazdir(false)} />
    </div>
  );
};

export default TicariEtiketPage;
