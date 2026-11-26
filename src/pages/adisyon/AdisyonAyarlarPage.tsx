import { PosCihaziService } from "../../services/posCihaziService";
import React, { useEffect, useState } from "react";
import { Alert, Button, Card, Col, Form, InputGroup, Row, Spinner } from "react-bootstrap";
import { IconDeviceFloppy, IconSettings } from "@tabler/icons-react";
import ERPToolbar from "../../components/common/ERPToolbar";
import { useToast } from "../../context/ToastContext";
import { AdisyonAyarlari, AdisyonService } from "../../services/adisyonService";
import { adisyonNo } from "../../../Backend/src/services/adisyon/adisyonHesap";
import { MutfakIstasyonKarti } from "./MutfakIstasyonKarti";
import { CashDeskService, VezneItem } from "../../services/cashDeskService";

/**
 * Adisyon › Ayarlar (docs/TICARI_ADISYON_YOL_HARITASI.md, TA29 / TA32 / TA38 / TA20): masada KDV varsayılanı, servis ücreti
 * (yalnız İş Kanunu 51; varsayılan kapalı, kuver / masa ücreti yok), stok takibi, adisyon numarası ön eki, tahsilat veznesi (D7).
 */
export const AdisyonAyarlarPage: React.FC = () => {
  const { showSuccess, showError } = useToast();
  const [a, setA] = useState<AdisyonAyarlari | null>(null);
  const [kdv, setKdv] = useState("10");
  const [servisAcik, setServisAcik] = useState(false);
  const [servisOrani, setServisOrani] = useState("10");
  const [stokTakibi, setStokTakibi] = useState(true);
  const [misafirSiparis, setMisafirSiparis] = useState(false);
  const [birimKodu, setBirimKodu] = useState("AD");
  const [vezneId, setVezneId] = useState("");
  const [vezneler, setVezneler] = useState<VezneItem[]>([]);
  const [posId, setPosId] = useState("");
  const [poslar, setPoslar] = useState<{ id: number; ad: string }[]>([]);
  const [kaydediliyor, setKaydediliyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);

  const doldur = (x: AdisyonAyarlari) => {
    setA(x); setKdv(x.kdvVarsayilan === null ? "" : String(x.kdvVarsayilan)); setServisAcik(x.servisAcik);
    setServisOrani(String(x.servisOrani).replace(".", ",")); setStokTakibi(x.stokTakibi); setMisafirSiparis(!!x.misafirSiparis); setBirimKodu(x.birimKodu); setVezneId(x.vezneId ? String(x.vezneId) : ""); setPosId(x.posCihaziId ? String(x.posCihaziId) : "");
  };
  useEffect(() => {
    AdisyonService.ayarlar().then(doldur).catch((e) => setHata(e?.message || "Ayarlar alınamadı."));
    CashDeskService.getVezneler().then((l) => setVezneler(l || [])).catch(() => setVezneler([]));
    PosCihaziService.getPosCihazlari().then((l: any[]) => setPoslar((l || []).map((x: any) => ({ id: Number(x.posCihaziId ?? x.id), ad: [x.kod, x.ad].filter(Boolean).join(" · ") })).filter((x) => x.id > 0))).catch(() => setPoslar([]));
  }, []);

  const kaydet = async () => {
    setKaydediliyor(true);
    try {
      doldur(await AdisyonService.ayarKaydet({ kdvVarsayilan: kdv === "" ? null : Number(kdv), servisAcik, servisOrani: Number(servisOrani.replace(",", ".")), stokTakibi, misafirSiparis, birimKodu, vezneId: vezneId ? Number(vezneId) : null, posCihaziId: posId ? Number(posId) : null }));
      showSuccess("Adisyon ayarları kaydedildi.");
    } catch (e: any) {
      showError(e?.message || "Ayarlar kaydedilemedi.");
    } finally {
      setKaydediliyor(false);
    }
  };

  return (
    <div className="container-fluid py-3">
      <ERPToolbar pageTitle="Adisyon Ayarları" pageIcon={<IconSettings size={20} />} hideNew hideDelete hideSearch hideNavigation hidePrint onSave={() => void kaydet()} disabled={kaydediliyor} />
      {hata && <Alert variant="danger" className="py-2">{hata}</Alert>}
      {!a && !hata && <Spinner size="sm" />}
      {a && (
        <Row className="g-3">
          <Col lg={6}>
            <Card className="border shadow-xs h-100">
              <Card.Header className="bg-light py-2 fw-bold small">Fiyat ve KDV</Card.Header>
              <Card.Body>
                <Form.Group className="mb-3">
                  <Form.Label className="small fw-bold mb-1">Masada KDV varsayılanı</Form.Label>
                  <Form.Select size="sm" aria-label="Masada KDV varsayılanı" value={kdv} onChange={(e) => setKdv(e.target.value)} style={{ maxWidth: 240 }}>
                    <option value="">Kartın KDV'si</option>
                    {[0, 1, 10, 20].map((k) => <option key={k} value={k}>%{k}</option>)}
                  </Form.Select>
                  <Form.Text>Stok kartında "Adisyon KDV oranı" yazılıysa o geçer; değilse bu, bu da boşsa kartın KDV'si.</Form.Text>
                </Form.Group>
                <Form.Check type="switch" id="adisyon-servis" className="mb-2" checked={servisAcik} onChange={(e) => setServisAcik(e.target.checked)}
                  label={<span className="fw-semibold">Servis ücreti (İş Kanunu 51)</span>} />
                <InputGroup size="sm" style={{ maxWidth: 200 }}>
                  <InputGroup.Text>%</InputGroup.Text>
                  <Form.Control aria-label="Servis ücreti oranı" inputMode="decimal" disabled={!servisAcik} value={servisOrani} onChange={(e) => setServisOrani(e.target.value.replace(/[^0-9.,]/g, ""))} />
                </InputGroup>
                <Form.Text>Ayrı kalem olarak hesaba eklenir. Kuver ve masa ücreti alınmaz.</Form.Text>
              </Card.Body>
            </Card>
          </Col>
          <Col lg={6}>
            <Card className="border shadow-xs h-100">
              <Card.Header className="bg-light py-2 fw-bold small">Kayıt</Card.Header>
              <Card.Body>
                <Form.Check type="switch" id="adisyon-stok" className="mb-3" checked={stokTakibi} onChange={(e) => setStokTakibi(e.target.checked)}
                  label={<div><div className="fw-semibold">Stok takibi</div><div className="small text-muted">Kapalıysa satılan ürünler stoktan düşmez (yalnız Adisyon kullanan kafe).</div></div>} />
                <Form.Check type="switch" id="adisyon-misafir" className="mb-3" checked={misafirSiparis} onChange={(e) => setMisafirSiparis(e.target.checked)}
                  label={<div><div className="fw-semibold">Masadan misafir siparişi (QR / masa PIN'i)</div><div className="small text-muted">Misafir masadaki QR kodu okutup garsonun verdiği PIN'le menüyü görür, sipariş verir, hesap ister. QR kodları: Tanımlar › Bölge / Masa.</div></div>} />
                <Form.Group>
                  <Form.Label className="small fw-bold mb-1">Adisyon numarası ön eki</Form.Label>
                  <Form.Control size="sm" aria-label="Adisyon numarası ön eki" maxLength={3} style={{ maxWidth: 120 }} value={birimKodu} onChange={(e) => setBirimKodu(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))} />
                  <Form.Text>Örnek: {adisyonNo(birimKodu, new Date().getFullYear(), 1)}</Form.Text>
                </Form.Group>
                <Form.Group className="mt-3">
                  <Form.Label className="small fw-bold mb-1">Tahsilat veznesi</Form.Label>
                  <Form.Select size="sm" aria-label="Tahsilat veznesi" value={vezneId} onChange={(e) => setVezneId(e.target.value)} style={{ maxWidth: 280 }}>
                    <option value="">Ana vezne</option>
                    {vezneler.map((v) => <option key={v.id} value={v.id}>{[v.kod, v.ad].filter(Boolean).join(" · ")}</option>)}
                  </Form.Select>
                  <Form.Text>Garson telefonundan alınan ödemelerin satış fişi bu vezneye yazılır. Kasada ödeme alan kullanıcının kendi veznesi geçer. Nakit ara ödeme, alındığı kasanın veznesine işlenir.</Form.Text>
                </Form.Group>
                <Form.Group className="mt-3">
                  <Form.Label className="small fw-bold mb-1">Varsayılan POS hesabı</Form.Label>
                  <Form.Select size="sm" aria-label="Varsayılan POS hesabı" value={posId} onChange={(e) => setPosId(e.target.value)} style={{ maxWidth: 280 }}>
                    <option value="">{poslar.length === 1 ? `${poslar[0].ad} (tek POS hesabı)` : "Seçilmedi"}</option>
                    {poslar.map((x) => <option key={x.id} value={x.id}>{x.ad}</option>)}
                  </Form.Select>
                  <Form.Text>Garson telefonundan ya da POS hesabı seçilmeden alınan kart ödemesi bu hesaba yazılır. Birden çok POS hesabınız varsa seçin; seçilmezse hesapsız kart ödemesi alınamaz.</Form.Text>
                </Form.Group>
              </Card.Body>
            </Card>
          </Col>
          <Col xs={12}>
            <MutfakIstasyonKarti />
          </Col>
          <Col xs={12} className="d-flex justify-content-end">
            <Button variant="success" disabled={kaydediliyor} onClick={() => void kaydet()}><IconDeviceFloppy size={16} className="me-1" />Kaydet</Button>
          </Col>
        </Row>
      )}
    </div>
  );
};

export default AdisyonAyarlarPage;
