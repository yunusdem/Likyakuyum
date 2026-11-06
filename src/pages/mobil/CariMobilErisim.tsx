import React, { useCallback, useEffect, useState } from "react";
import { Alert, Badge, Button, Card, Col, Form, Row, Spinner } from "react-bootstrap";
import { IconDeviceMobile, IconKey, IconUserPlus } from "@tabler/icons-react";
import { MobilAyar, MobilCariAyar, MobilCariBilgisi, MobilYetkiler, MobilYonetimService, tarihSaat } from "../../services/mobilYonetimService";
import { DurumRozeti, ErisimEkleFormu, ErisimTablosu, KopyalaDugmesi, SifreModal, YetkiKutulari, enterEngelle } from "./mobilOrtak";
import CariMakasTablosu from "./CariMakasTablosu";

/**
 * Cari kartı › Mobil Erişim sekmesi (docs/MOBIL_CARI_YOL_HARITASI.md K3, K6–K10, K20, K25). Yalnız yöneticiye ve Mobil
 * modülü açık firmada görünür. Cari kartının formu içinde durduğu için düğmeler type="button", Enter cari kaydetmez.
 */

const sayiYaz = (v: number | null | undefined) => (v === null || v === undefined ? "" : String(v));
const tlYaz = (v: number | null | undefined) => (v === null || v === undefined ? "sınır yok" : `${v.toLocaleString("tr-TR")} TL`);

const CariMobilErisim: React.FC<{ cariKartId: number }> = ({ cariKartId }) => {
  const [bilgi, setBilgi] = useState<MobilCariBilgisi | null>(null);
  const [firmaAyar, setFirmaAyar] = useState<MobilAyar | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [mesaj, setMesaj] = useState<string | null>(null);
  const [mesgul, setMesgul] = useState(false);
  const [sifre, setSifre] = useState<{ kullaniciAdi: string; geciciSifre: string; paylasim: string; girisAdresi: string } | null>(null);
  // Yeni kullanıcı formu
  const [yeniAd, setYeniAd] = useState("");
  const [yeniAdSoyad, setYeniAdSoyad] = useState("");
  const [yeniEposta, setYeniEposta] = useState("");
  const [yeniYetki, setYeniYetki] = useState<MobilYetkiler>({ fiyat: true, bakiye: true, dokum: true, alis: false, satis: false });
  const [yeniAcik, setYeniAcik] = useState(false);
  // Cari sınırları
  const [ayar, setAyar] = useState<MobilCariAyar | null>(null);

  const yukle = useCallback(async () => {
    setHata(null);
    try {
      const [b, a] = await Promise.all([MobilYonetimService.cari(cariKartId), MobilYonetimService.ayar().catch(() => null)]);
      setBilgi(b);
      setFirmaAyar(a);
      setAyar(b.ayar);
      setYeniAd(b.onerilenKullaniciAdi);
      setYeniAdSoyad(b.cari.ad);
      setYeniEposta(b.cari.eposta || "");
      setYeniAcik(b.kullanicilar.length === 0);
    } catch (e: any) {
      setHata(e?.message || "Mobil erişim bilgisi alınamadı.");
    }
  }, [cariKartId]);

  useEffect(() => {
    void yukle();
  }, [yukle]);

  const islem = async (is: () => Promise<unknown>, tamam: string) => {
    setMesgul(true);
    setHata(null);
    setMesaj(null);
    try {
      await is();
      setMesaj(tamam);
      await yukle();
    } catch (e: any) {
      setHata(e?.message || "İşlem yapılamadı.");
    } finally {
      setMesgul(false);
    }
  };

  const kullaniciEkle = async () => {
    setMesgul(true);
    setHata(null);
    setMesaj(null);
    try {
      const s = await MobilYonetimService.kullaniciEkle({ cariKartId, kullaniciAdi: yeniAd, adSoyad: yeniAdSoyad, eposta: yeniEposta, yetkiler: yeniYetki });
      setSifre(s);
      await yukle();
    } catch (e: any) {
      setHata(e?.message || "Kullanıcı eklenemedi.");
    } finally {
      setMesgul(false);
    }
  };

  const sifreSifirla = async (id: number, kullaniciAdi: string) => {
    if (!window.confirm(`${kullaniciAdi} için yeni geçici şifre üretilecek; açık oturumları kapanır. Devam?`)) return;
    setMesgul(true);
    setHata(null);
    try {
      const s = await MobilYonetimService.sifreSifirla(id);
      setSifre({ ...s, kullaniciAdi });
      await yukle();
    } catch (e: any) {
      setHata(e?.message || "Şifre sıfırlanamadı.");
    } finally {
      setMesgul(false);
    }
  };

  if (!bilgi) {
    return hata ? (
      <Alert variant="warning" className="small">
        {hata}
      </Alert>
    ) : (
      <div className="text-center py-4">
        <Spinner animation="border" size="sm" />
      </div>
    );
  }

  const d = bilgi.durum;
  const sinirDolu = d.kullanilan >= d.kullaniciLimiti;
  const alan = (k: keyof MobilCariAyar) => (v: string) => setAyar((a) => (a ? { ...a, [k]: v === "" ? null : v } : a));
  const ucDurum = (k: "emirAcik" | "bakiyeSiniriUygula", firma: boolean | undefined) => (
    <Form.Select
      size="sm"
      value={ayar?.[k] === null || ayar?.[k] === undefined ? "" : ayar[k] ? "1" : "0"}
      onChange={(e) => setAyar((a) => (a ? { ...a, [k]: e.target.value === "" ? null : e.target.value === "1" } : a))}
    >
      <option value="">Firma ayarı ({firma ? "evet" : "hayır"})</option>
      <option value="1">Evet</option>
      <option value="0">Hayır</option>
    </Form.Select>
  );

  return (
    <div style={{ maxWidth: 980 }} onKeyDown={enterEngelle}>
      <div className="d-flex flex-wrap align-items-center gap-3 mb-3 small">
        <span className="d-flex align-items-center gap-1 fw-semibold">
          <IconDeviceMobile size={18} /> Mobil erişim
        </span>
        <span>
          Müşteri no: <strong>{d.musteriNo}</strong>
        </span>
        <span>
          Kullanım: <strong>{d.kullanilan}</strong> / {d.kullaniciLimiti}
        </span>
        <span className="text-muted text-break">{d.girisAdresi}</span>
        <KopyalaDugmesi metin={d.girisAdresi} etiket="Giriş adresi" />
      </div>
      {hata && (
        <Alert variant="danger" className="py-2 small" dismissible onClose={() => setHata(null)}>
          {hata}
        </Alert>
      )}
      {mesaj && (
        <Alert variant="success" className="py-2 small" dismissible onClose={() => setMesaj(null)}>
          {mesaj}
        </Alert>
      )}

      {bilgi.kullanicilar.map((k) => (
        <Card key={k.mobilKullaniciId} className="mb-3">
          <Card.Header className="d-flex flex-wrap align-items-center gap-2 py-2 small">
            <strong className="font-monospace">{k.kullaniciAdi}</strong>
            <span>{k.adSoyad}</span>
            <DurumRozeti durum={k.durum} />
            {k.sifreDegismeli && <Badge bg="warning" text="dark">İlk şifre değişmedi</Badge>}
            {k.kilitli && <Badge bg="danger">Kilitli</Badge>}
            <span className="text-muted">Son giriş: {tarihSaat(k.sonGiris)}</span>
            <span className="ms-auto d-flex gap-1">
              <KopyalaDugmesi metin={k.girisAdresi} etiket="Bağlantı" />
              <Button type="button" size="sm" variant="outline-primary" disabled={mesgul} onClick={() => void sifreSifirla(k.mobilKullaniciId, k.kullaniciAdi)}>
                <IconKey size={14} /> Şifre sıfırla
              </Button>
              <Button
                type="button"
                size="sm"
                variant={k.durum === "AKTIF" ? "outline-secondary" : "outline-success"}
                disabled={mesgul}
                onClick={() =>
                  void islem(
                    () => MobilYonetimService.kullaniciGuncelle(k.mobilKullaniciId, { durum: k.durum === "AKTIF" ? "PASIF" : "AKTIF" }),
                    k.durum === "AKTIF" ? "Kullanıcı pasife alındı." : "Kullanıcı aktif edildi."
                  )
                }
              >
                {k.durum === "AKTIF" ? "Pasife al" : "Aktif et"}
              </Button>
            </span>
          </Card.Header>
          <Card.Body className="py-2">
            <ErisimTablosu erisimler={k.erisimler} mesgul={mesgul} onIslem={(is, m) => void islem(is, m)} />
            <ErisimEkleFormu
              mobilKullaniciId={k.mobilKullaniciId}
              veritabanlari={bilgi.veritabanlari}
              mevcutFirmalar={k.erisimler.map((e) => e.firmaId)}
              mesgul={mesgul}
              onIslem={(is, m) => void islem(is, m)}
            />
          </Card.Body>
        </Card>
      ))}

      {!yeniAcik ? (
        <Button type="button" size="sm" variant="outline-primary" className="mb-3" onClick={() => setYeniAcik(true)} disabled={sinirDolu}>
          <IconUserPlus size={15} /> Bu cariye yeni mobil kullanıcı
        </Button>
      ) : (
        <Card className="mb-3">
          <Card.Header className="py-2 small fw-semibold">Yeni mobil kullanıcı</Card.Header>
          <Card.Body className="py-2">
            {sinirDolu && (
              <Alert variant="warning" className="py-2 small">
                Mobil kullanıcı sınırı dolu ({d.kullanilan} / {d.kullaniciLimiti}). Ek kullanıcı için hizmet sağlayıcınıza başvurun.
              </Alert>
            )}
            <Row className="g-2">
              <Col md={4}>
                <Form.Label className="small mb-0">Kullanıcı adı</Form.Label>
                <Form.Control size="sm" value={yeniAd} onChange={(e) => setYeniAd(e.target.value)} />
              </Col>
              <Col md={4}>
                <Form.Label className="small mb-0">Ad soyad</Form.Label>
                <Form.Control size="sm" value={yeniAdSoyad} maxLength={100} onChange={(e) => setYeniAdSoyad(e.target.value)} />
              </Col>
              <Col md={4}>
                <Form.Label className="small mb-0">E-posta (onay / ret bildirimi)</Form.Label>
                <Form.Control size="sm" type="email" value={yeniEposta} onChange={(e) => setYeniEposta(e.target.value)} />
              </Col>
            </Row>
            <div className="mt-2 d-flex flex-wrap align-items-center gap-2">
              <YetkiKutulari idOn="yeni" deger={yeniYetki} onChange={setYeniYetki} />
              <Button type="button" size="sm" className="ms-auto" disabled={mesgul || sinirDolu} onClick={() => void kullaniciEkle()}>
                Kullanıcıyı oluştur
              </Button>
            </div>
            <div className="small text-muted mt-1">İlk şifreyi sistem üretir; yalnız bir kez gösterilir.</div>
          </Card.Body>
        </Card>
      )}

      {ayar && (
        <Card className="mb-2">
          <Card.Header className="py-2 small fw-semibold">Bu carinin mobil sınırları (boş = firma ayarı)</Card.Header>
          <Card.Body className="py-2">
            <Row className="g-2 small">
              <Col md={3}>
                <Form.Label className="mb-0">Emir verebilir</Form.Label>
                {ucDurum("emirAcik", firmaAyar?.emirAcik)}
              </Col>
              <Col md={3}>
                <Form.Label className="mb-0">İşlem başına en az (TL)</Form.Label>
                <Form.Control size="sm" type="number" min={0} value={sayiYaz(ayar.islemEnAzTl)} placeholder={tlYaz(firmaAyar?.islemEnAzTl)} onChange={(e) => alan("islemEnAzTl")(e.target.value)} />
              </Col>
              <Col md={3}>
                <Form.Label className="mb-0">İşlem başına en çok (TL)</Form.Label>
                <Form.Control size="sm" type="number" min={0} value={sayiYaz(ayar.islemEnCokTl)} placeholder={tlYaz(firmaAyar?.islemEnCokTl)} onChange={(e) => alan("islemEnCokTl")(e.target.value)} />
              </Col>
              <Col md={3}>
                <Form.Label className="mb-0">Günlük limit (TL)</Form.Label>
                <Form.Control size="sm" type="number" min={0} value={sayiYaz(ayar.gunlukLimitTl)} placeholder={tlYaz(firmaAyar?.gunlukLimitTl)} onChange={(e) => alan("gunlukLimitTl")(e.target.value)} />
              </Col>
              <Col md={3}>
                <Form.Label className="mb-0">Cari bakiye sınırı uygulansın</Form.Label>
                {ucDurum("bakiyeSiniriUygula", firmaAyar?.bakiyeSiniriUygula)}
                <div className="text-muted" style={{ fontSize: 11 }}>
                  Kartın Bakiye Sınırı: {tlYaz(bilgi.cari.bakiyeSiniri)}
                </div>
              </Col>
              <Col md={3}>
                <Form.Label className="mb-0">Çalışma başlangıcı</Form.Label>
                <Form.Control size="sm" type="time" value={ayar.calismaBaslangic || ""} onChange={(e) => alan("calismaBaslangic")(e.target.value)} />
              </Col>
              <Col md={3}>
                <Form.Label className="mb-0">Çalışma bitişi</Form.Label>
                <Form.Control size="sm" type="time" value={ayar.calismaBitis || ""} onChange={(e) => alan("calismaBitis")(e.target.value)} />
                <div className="text-muted" style={{ fontSize: 11 }}>
                  Firma: {firmaAyar?.calismaBaslangic ? `${firmaAyar.calismaBaslangic}–${firmaAyar.calismaBitis}` : "saat sınırı yok"}
                </div>
              </Col>
              <Col md={3}>
                <Form.Label className="mb-0">Fiyat geçerlilik süresi (sn)</Form.Label>
                <Form.Control
                  size="sm"
                  type="number"
                  min={30}
                  max={3600}
                  value={sayiYaz(ayar.fiyatGecerlilikSn)}
                  placeholder={`firma: ${firmaAyar?.fiyatGecerlilikSn ?? 300}`}
                  onChange={(e) => alan("fiyatGecerlilikSn")(e.target.value)}
                />
              </Col>
            </Row>
            <div className="text-end mt-2">
              <Button type="button" size="sm" disabled={mesgul} onClick={() => void islem(() => MobilYonetimService.cariAyarYaz(cariKartId, ayar), "Cari mobil sınırları kaydedildi.")}>
                Sınırları kaydet
              </Button>
            </div>
          </Card.Body>
        </Card>
      )}

      <CariMakasTablosu cariKartId={cariKartId} />

      <SifreModal bilgi={sifre} onKapat={() => setSifre(null)} />
    </div>
  );
};

export default CariMobilErisim;
