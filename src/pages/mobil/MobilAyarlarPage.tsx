import React, { useCallback, useEffect, useState } from "react";
import { Alert, Button, Card, Col, Form, Row, Spinner } from "react-bootstrap";
import { IconSettings } from "@tabler/icons-react";
import ERPToolbar from "../../components/common/ERPToolbar";
import { CashDeskService } from "../../services/cashDeskService";
import { UserService } from "../../services/userService";
import { MobilAyar, MobilYonetimService, OdemeTercihi, TERCIH_ADLARI } from "../../services/mobilYonetimService";
import { useMobilYetkisi } from "./useMobilYetkisi";
import MobilUrunSecimi from "./MobilUrunSecimi";
import MobilKatalogSecimi from "./MobilKatalogSecimi";

/**
 * Mobil › Mobil Ayarları (docs/MOBIL_CARI_YOL_HARITASI.md K12, K14, K19, K20, K30, K32, K33): emir alma, mobil vezne ve
 * kullanıcı, bildirim adresleri, fiyat geçerlilik süresi, çalışma saatleri, firma geneli sınırlar, ödeme tercihleri ve
 * mobilde görünen ürünler. Cariye özel sınırlar cari kartının Mobil sekmesindedir.
 */

const GUNLER = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];
const sayiYaz = (v: number | null) => (v === null ? "" : String(v));

const MobilAyarlarPage: React.FC = () => {
  const { yonetici, ticariAcik } = useMobilYetkisi();
  const [ayar, setAyar] = useState<MobilAyar | null>(null);
  const [epostaMetni, setEpostaMetni] = useState("");
  const [vezneler, setVezneler] = useState<{ id: number; ad: string }[]>([]);
  const [kullanicilar, setKullanicilar] = useState<{ id: number; ad: string }[]>([]);
  const [hata, setHata] = useState<string | null>(null);
  const [mesaj, setMesaj] = useState<string | null>(null);
  const [mesgul, setMesgul] = useState(false);

  const yukle = useCallback(async () => {
    setHata(null);
    try {
      const a = await MobilYonetimService.ayar();
      setAyar(a);
      setEpostaMetni(a.bildirimEposta.join(", "));
    } catch (e: any) {
      setHata(e?.message || "Mobil ayarları alınamadı.");
    }
    CashDeskService.getVezneler()
      .then((v) => setVezneler(v.map((x) => ({ id: Number(x.id), ad: `${String(x.kod || "").trim()} ${x.ad || ""}`.trim() }))))
      .catch(() => undefined);
    UserService.listUsers()
      .then((r: any) => setKullanicilar(((r?.data as any[]) || []).map((u) => ({ id: Number(u.id), ad: u.fullName || u.username }))))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    void yukle();
  }, [yukle]);

  const degis = <K extends keyof MobilAyar>(k: K, v: MobilAyar[K]) => setAyar((a) => (a ? { ...a, [k]: v } : a));
  const tutar = (k: "islemEnAzTl" | "islemEnCokTl" | "gunlukLimitTl") => (v: string) => degis(k, v === "" ? null : (Number(v) as any));

  const kaydet = async () => {
    if (!ayar) return;
    setMesgul(true);
    setHata(null);
    setMesaj(null);
    try {
      const yeni = await MobilYonetimService.ayarYaz({ ...ayar, bildirimEposta: epostaMetni.split(/[,;\s]+/).filter(Boolean) });
      setAyar(yeni);
      setEpostaMetni(yeni.bildirimEposta.join(", "));
      setMesaj("Mobil ayarları kaydedildi.");
    } catch (e: any) {
      setHata(e?.message || "Kaydedilemedi.");
    } finally {
      setMesgul(false);
    }
  };

  return (
    <div className="p-2 p-md-3">
      <ERPToolbar pageTitle="Mobil Ayarları" pageIcon={<IconSettings size={22} className="text-primary" />} onRefresh={() => void yukle()} disabled={mesgul} />
      {!yonetici && <Alert variant="warning" className="mt-3">Mobil ayarlarını yalnız yönetici değiştirebilir.</Alert>}
      {hata && (
        <Alert variant="danger" className="mt-3" dismissible onClose={() => setHata(null)}>
          {hata}
        </Alert>
      )}
      {mesaj && (
        <Alert variant="success" className="mt-3 py-2" dismissible onClose={() => setMesaj(null)}>
          {mesaj}
        </Alert>
      )}
      {!ayar && !hata && (
        <div className="text-center py-5">
          <Spinner animation="border" />
        </div>
      )}
      {ayar && (
        <div style={{ maxWidth: 980 }}>
          <Card className="mt-3 mb-3">
            <Card.Header className="py-2 fw-semibold small">Emirler</Card.Header>
            <Card.Body>
              <Form.Check
                type="switch"
                id="mobilEmirAcik"
                label="Cariler mobilden alış / satış emri verebilsin (personel onayına düşer)"
                checked={ayar.emirAcik}
                onChange={(e) => degis("emirAcik", e.target.checked)}
              />
              <Row className="g-3 mt-1">
                <Col md={4}>
                  <Form.Label className="small mb-0">Mobil vezne</Form.Label>
                  <Form.Select size="sm" value={ayar.vezneId ?? ""} onChange={(e) => degis("vezneId", e.target.value ? Number(e.target.value) : null)}>
                    <option value="">Seçin…</option>
                    {vezneler.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.ad}
                      </option>
                    ))}
                  </Form.Select>
                  <Form.Text>Onaylanan emirlerin fişi bu vezneye kesilir.</Form.Text>
                </Col>
                <Col md={4}>
                  <Form.Label className="small mb-0">Mobil kullanıcı</Form.Label>
                  <Form.Select size="sm" value={ayar.kullaniciId ?? ""} onChange={(e) => degis("kullaniciId", e.target.value ? Number(e.target.value) : null)}>
                    <option value="">Seçin…</option>
                    {kullanicilar.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.ad}
                      </option>
                    ))}
                  </Form.Select>
                  <Form.Text>Fişler bu kullanıcı adına kesilir; onaylayan personel ayrıca kaydedilir.</Form.Text>
                </Col>
                <Col md={4}>
                  <Form.Label className="small mb-0">Fiyat geçerlilik süresi (saniye)</Form.Label>
                  <Form.Control size="sm" type="number" min={30} max={3600} value={ayar.fiyatGecerlilikSn} onChange={(e) => degis("fiyatGecerlilikSn", Number(e.target.value))} />
                  <Form.Text>Bu süre içinde onaylanmayan emir kendiliğinden düşer.</Form.Text>
                </Col>
                <Col md={8}>
                  <Form.Label className="small mb-0">Bildirim e-postaları</Form.Label>
                  <Form.Control size="sm" placeholder="ornek@firma.com, ikinci@firma.com" value={epostaMetni} onChange={(e) => setEpostaMetni(e.target.value)} />
                  <Form.Text>Her yeni emirde bu adreslere yapılan işlem yazılı e-posta gider.</Form.Text>
                </Col>
                <Col md={12}>
                  <Form.Label className="small mb-1 d-block">Carinin seçebileceği ödeme / teslim tercihleri</Form.Label>
                  <div className="d-flex flex-wrap gap-3">
                    {(Object.keys(TERCIH_ADLARI) as OdemeTercihi[]).map((t) => (
                      <Form.Check
                        key={t}
                        id={`tercih-${t}`}
                        type="checkbox"
                        label={TERCIH_ADLARI[t]}
                        checked={ayar.tercihler.includes(t)}
                        onChange={(e) => degis("tercihler", e.target.checked ? [...ayar.tercihler, t] : ayar.tercihler.filter((x) => x !== t))}
                      />
                    ))}
                  </div>
                  <Form.Text>Cari yalnız tercihini yazar; son ödeme şeklini onaylayan personel işaretler.</Form.Text>
                </Col>
              </Row>
            </Card.Body>
          </Card>

          <Card className="mb-3">
            <Card.Header className="py-2 fw-semibold small">Sınırlar (firma geneli; cari kartında cariye özel değer verilebilir)</Card.Header>
            <Card.Body>
              <Row className="g-3">
                <Col md={3}>
                  <Form.Label className="small mb-0">İşlem başına en az (TL)</Form.Label>
                  <Form.Control size="sm" type="number" min={0} placeholder="sınır yok" value={sayiYaz(ayar.islemEnAzTl)} onChange={(e) => tutar("islemEnAzTl")(e.target.value)} />
                </Col>
                <Col md={3}>
                  <Form.Label className="small mb-0">İşlem başına en çok (TL)</Form.Label>
                  <Form.Control size="sm" type="number" min={0} placeholder="sınır yok" value={sayiYaz(ayar.islemEnCokTl)} onChange={(e) => tutar("islemEnCokTl")(e.target.value)} />
                </Col>
                <Col md={3}>
                  <Form.Label className="small mb-0">Günlük limit (TL)</Form.Label>
                  <Form.Control size="sm" type="number" min={0} placeholder="sınır yok" value={sayiYaz(ayar.gunlukLimitTl)} onChange={(e) => tutar("gunlukLimitTl")(e.target.value)} />
                </Col>
                <Col md={3} className="d-flex align-items-end">
                  <Form.Check
                    id="bakiyeSiniri"
                    type="checkbox"
                    label="Cari kartındaki bakiye sınırı uygulansın"
                    checked={ayar.bakiyeSiniriUygula}
                    onChange={(e) => degis("bakiyeSiniriUygula", e.target.checked)}
                  />
                </Col>
                <Col md={3}>
                  <Form.Label className="small mb-0">Çalışma başlangıcı</Form.Label>
                  <Form.Control size="sm" type="time" value={ayar.calismaBaslangic || ""} onChange={(e) => degis("calismaBaslangic", e.target.value || null)} />
                </Col>
                <Col md={3}>
                  <Form.Label className="small mb-0">Çalışma bitişi</Form.Label>
                  <Form.Control size="sm" type="time" value={ayar.calismaBitis || ""} onChange={(e) => degis("calismaBitis", e.target.value || null)} />
                </Col>
                <Col md={6}>
                  <Form.Label className="small mb-1 d-block">Çalışma günleri</Form.Label>
                  <div className="d-flex flex-wrap gap-2">
                    {GUNLER.map((g, i) => (
                      <Form.Check
                        key={g}
                        id={`gun-${i}`}
                        type="checkbox"
                        label={g}
                        checked={ayar.calismaGunleri[i] === "1"}
                        onChange={(e) => {
                          const d = ayar.calismaGunleri.split("");
                          d[i] = e.target.checked ? "1" : "0";
                          degis("calismaGunleri", d.join(""));
                        }}
                      />
                    ))}
                  </div>
                </Col>
              </Row>
            </Card.Body>
          </Card>
          <div className="text-end mb-4">
            <Button onClick={() => void kaydet()} disabled={mesgul || !yonetici}>
              {mesgul ? "Kaydediliyor…" : "Ayarları kaydet"}
            </Button>
          </div>

          <MobilUrunSecimi />
          {ticariAcik && <MobilKatalogSecimi />}
        </div>
      )}
    </div>
  );
};

export default MobilAyarlarPage;
