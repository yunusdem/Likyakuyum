import React, { useCallback, useEffect, useState } from "react";
import { Alert, Button, Form, Modal, Spinner } from "react-bootstrap";
import { IconDownload, IconPlus } from "@tabler/icons-react";
import { adminApi, FirmaDto, KullaniciDto } from "../services/adminApi";
import KullaniciTablosu, { GeciciSifreModal } from "./KullaniciTablosu";

interface Props {
  firma: FirmaDto;
  /** Kullanıcı sayısı değişince üstteki firma özetini tazelemek için */
  firmaYenile: () => Promise<void>;
}

/** Firma Detay > Kullanıcılar sekmesi: liste, yeni kullanıcı ve firma veritabanından içe aktarma. */
const FirmaKullanicilari: React.FC<Props> = ({ firma, firmaYenile }) => {
  const [kullanicilar, setKullanicilar] = useState<KullaniciDto[] | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [bilgi, setBilgi] = useState<string | null>(null);
  const [aktariliyor, setAktariliyor] = useState(false);

  const [ekleAcik, setEkleAcik] = useState(false);
  const [kullaniciAdi, setKullaniciAdi] = useState("");
  const [adSoyad, setAdSoyad] = useState("");
  const [yonetici, setYonetici] = useState(false);
  const [ekleHata, setEkleHata] = useState<string | null>(null);
  const [ekleniyor, setEkleniyor] = useState(false);
  const [geciciSifre, setGeciciSifre] = useState<{ kullaniciAdi: string; sifre: string } | null>(null);

  const yukle = useCallback(async () => {
    try {
      setKullanicilar(await adminApi.firmaKullanicilari(firma.firmaId));
      setHata(null);
    } catch (err: any) {
      setHata(err?.message || "Kullanıcılar getirilemedi.");
    }
  }, [firma.firmaId]);

  useEffect(() => {
    yukle();
  }, [yukle]);

  const yenile = async () => {
    await Promise.all([yukle(), firmaYenile()]);
  };

  const iceAktar = async () => {
    setAktariliyor(true);
    setHata(null);
    setBilgi(null);
    try {
      const s = await adminApi.kullanicilariIceAktar(firma.firmaId);
      setBilgi(
        `${s.eklenen.length} kullanıcı içe aktarıldı` +
          (s.eklenen.length ? ` (${s.eklenen.join(", ")})` : "") +
          `; ${s.zatenVar} zaten kayıtlıydı` +
          (s.atlanan ? `; ${s.atlanan} adsız kayıt atlandı` : "") +
          "."
      );
      await yenile();
    } catch (err: any) {
      setHata(err?.message || "İçe aktarılamadı.");
    } finally {
      setAktariliyor(false);
    }
  };

  const ekle = async (e: React.FormEvent) => {
    e.preventDefault();
    setEkleHata(null);
    setEkleniyor(true);
    try {
      const sonuc = await adminApi.kullaniciEkle(firma.firmaId, { kullaniciAdi: kullaniciAdi.trim(), adSoyad: adSoyad.trim(), firmaYoneticisi: yonetici });
      setEkleAcik(false);
      setKullaniciAdi("");
      setAdSoyad("");
      setYonetici(false);
      setGeciciSifre({ kullaniciAdi: sonuc.kullanici.kullaniciAdi, sifre: sonuc.geciciSifre });
      await yenile();
    } catch (err: any) {
      setEkleHata(err?.message || "Kullanıcı oluşturulamadı.");
    } finally {
      setEkleniyor(false);
    }
  };

  const limit = firma.aktifLisans?.kullaniciLimiti;
  const limitDolu = limit !== undefined && firma.kullaniciSayisi >= limit;

  return (
    <>
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <div className="text-muted small">
          Aktif kullanıcı: {firma.kullaniciSayisi}
          {limit !== undefined ? ` / ${limit}` : " (lisans tanımlı değil, limit uygulanmıyor)"}
        </div>
        <div className="d-flex gap-2">
          <Button
            size="sm"
            variant="outline-secondary"
            disabled={aktariliyor}
            onClick={iceAktar}
            title="Firma veritabanındaki mevcut kullanıcıları merkeze alır. Şifreler okunmaz; kullanıcı ilk girişinde mevcut şifresiyle doğrulanır."
          >
            {aktariliyor ? <Spinner animation="border" size="sm" /> : <IconDownload size={16} className="me-1" />}
            Veritabanından İçe Aktar
          </Button>
          <Button
            size="sm"
            className="btn-adm"
            disabled={limitDolu}
            title={limitDolu ? "Lisanstaki kullanıcı limiti dolu" : undefined}
            onClick={() => {
              setEkleHata(null);
              setEkleAcik(true);
            }}
          >
            <IconPlus size={16} className="me-1" />
            Yeni Kullanıcı
          </Button>
        </div>
      </div>

      {hata && <Alert variant="danger">{hata}</Alert>}
      {bilgi && (
        <Alert variant="success" dismissible onClose={() => setBilgi(null)}>
          {bilgi}
        </Alert>
      )}

      {kullanicilar === null ? (
        !hata && (
          <div className="text-center py-4">
            <Spinner animation="border" />
          </div>
        )
      ) : (
        <KullaniciTablosu kullanicilar={kullanicilar} yenile={yenile} />
      )}

      <Modal show={ekleAcik} onHide={() => !ekleniyor && setEkleAcik(false)} centered>
        <Form onSubmit={ekle} autoComplete="off">
          <Modal.Header closeButton>
            <Modal.Title as="h5">Yeni Kullanıcı · {firma.firmaKodu}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {ekleHata && <Alert variant="danger">{ekleHata}</Alert>}
            <Form.Group className="mb-3" controlId="kulAd">
              <Form.Label>Kullanıcı adı</Form.Label>
              <Form.Control value={kullaniciAdi} onChange={(e) => setKullaniciAdi(e.target.value)} required minLength={2} maxLength={50} autoFocus />
            </Form.Group>
            <Form.Group className="mb-3" controlId="kulAdSoyad">
              <Form.Label>Ad Soyad</Form.Label>
              <Form.Control value={adSoyad} onChange={(e) => setAdSoyad(e.target.value)} maxLength={100} />
            </Form.Group>
            <Form.Check
              type="switch"
              id="kulYonetici"
              label="Firma yöneticisi (kendi firmasında kullanıcı açabilir ve şifre sıfırlayabilir)"
              checked={yonetici}
              onChange={(e) => setYonetici(e.target.checked)}
            />
            <Form.Text muted className="d-block mt-3">
              Kullanıcı firma veritabanında varsayılan yetkilerle açılır; vezne, yazıcı ve diğer ayarlar firmanın Kullanıcı
              Tanımları ekranından yapılır. Geçici şifre bir sonraki pencerede bir kez gösterilir.
            </Form.Text>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="outline-secondary" onClick={() => setEkleAcik(false)} disabled={ekleniyor}>
              Vazgeç
            </Button>
            <Button type="submit" className="btn-adm" disabled={ekleniyor}>
              {ekleniyor ? <Spinner animation="border" size="sm" /> : "Oluştur"}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      <GeciciSifreModal bilgi={geciciSifre} kapat={() => setGeciciSifre(null)} />
    </>
  );
};

export default FirmaKullanicilari;
