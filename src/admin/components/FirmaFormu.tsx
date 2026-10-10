import React, { useEffect, useState } from "react";
import { Alert, Button, Col, Form, Row, Spinner } from "react-bootstrap";
import { BulutDurum, BulutFirmaGirdi, FirmaDto, FirmaGirdi, PaketListesi } from "../services/adminApi";
import UrunSecici from "./UrunSecici";
import { paketleriHazirla, secilebilirUrunler } from "./paketOrtak";

interface Props {
  /** Verilirse düzenleme, verilmezse yeni kayıt */
  firma?: FirmaDto;
  kaydet: (veri: FirmaGirdi) => Promise<void>;
  vazgec?: () => void;
  /** Yalnız yeni kayıtta: verilirse "sunucumuzda boş veritabanı oluştur" seçeneği gösterilir */
  bulut?: BulutDurum | null;
  bulutKaydet?: (veri: BulutFirmaGirdi) => Promise<void>;
}

const SQL_ADI = "[A-Za-z][A-Za-z0-9_]{2,63}";

const birYilSonra = (): string => {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const baslangic = (f?: FirmaDto): FirmaGirdi => ({
  firmaKodu: f?.firmaKodu ?? "",
  musteriNo: f?.musteriNo ?? "",
  prgTur: f?.prgTur ?? 0,
  unvan: f?.unvan ?? "",
  vknTckn: f?.vknTckn ?? "",
  vergiDairesi: f?.vergiDairesi ?? "",
  yetkiliKisi: f?.yetkiliKisi ?? "",
  telefon: f?.telefon ?? "",
  eposta: f?.eposta ?? "",
  adres: f?.adres ?? "",
  baglantiModu: f?.baglantiModu ?? "cloud",
  dbServer: f?.dbServer ?? "",
  dbName: f?.dbName ?? "",
  dbUser: f?.dbUser ?? "",
});

const TR_ASCII: Record<string, string> = { ç: "C", ğ: "G", ı: "I", i: "I", ö: "O", ş: "S", ü: "U", Ç: "C", Ğ: "G", İ: "I", Ö: "O", Ş: "S", Ü: "U" };

/**
 * Firma kodu yalnızca A-Z, 0-9, tire ve alt çizgiden oluşur. Yazılan değer gerçekten dönüştürülür: yalnızca CSS ile
 * büyük gösterilirse Türkçe klavyeden gelen "ı" / "İ" görünmeden değerde kalır ve kod reddedilir.
 */
export const firmaKodunaCevir = (deger: string): string =>
  deger
    .replace(/[çğıiöşüÇĞİÖŞÜ]/g, (h) => TR_ASCII[h])
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, "");

/** Müşteri no: yalnızca A-Z ve 0-9 (ör. D20AC0001); tire/alt çizgi yoktur. */
export const musteriNoyaCevir = (deger: string): string => firmaKodunaCevir(deger).replace(/[^A-Z0-9]/g, "");

const FirmaFormu: React.FC<Props> = ({ firma, kaydet, vazgec, bulut, bulutKaydet }) => {
  const [veri, setVeri] = useState<FirmaGirdi>(() => baslangic(firma));
  // Kayıtlı şifre hiçbir zaman sunucudan gelmez; alan boş bırakılırsa mevcut şifreye dokunulmaz.
  const [dbSifre, setDbSifre] = useState("");
  const [hata, setHata] = useState<string | null>(null);
  const [bekliyor, setBekliyor] = useState(false);

  // Bulut: sunucumuzda şablondan yeni veritabanı
  const [yeniDb, setYeniDb] = useState(true);
  const [dbSifreTekrar, setDbSifreTekrar] = useState("");
  const [ilkKullaniciAdi, setIlkKullaniciAdi] = useState("");
  const [ilkKullaniciAdSoyad, setIlkKullaniciAdSoyad] = useState("");
  const [lisansBitis, setLisansBitis] = useState(birYilSonra);
  const [kullaniciLimiti, setKullaniciLimiti] = useState(1);
  // İlk lisansın ürünleri (docs/LISANS_URUN_PAKETLERI.md); paket tabloları kurulu değilse seçim görünmez
  const [urunler, setUrunler] = useState<string[]>([]);
  const [paketListe, setPaketListe] = useState<PaketListesi | null>(null);

  const bulutSecenegi = !firma && !!bulut && !!bulutKaydet && veri.baglantiModu === "cloud";
  const yeniDbAktif = bulutSecenegi && !!bulut?.klonAcik && yeniDb;

  useEffect(() => {
    if (!yeniDbAktif || paketListe) return;
    paketleriHazirla()
      .then(setPaketListe)
      .catch(() => setPaketListe({ kurulu: false, paketler: [] }));
  }, [yeniDbAktif, paketListe]);

  const alan = <K extends keyof FirmaGirdi>(ad: K) => ({
    value: (veri[ad] ?? "") as string,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setVeri((v) => ({ ...v, [ad]: e.target.value })),
  });

  const gonder = async (e: React.FormEvent) => {
    e.preventDefault();
    setHata(null);
    if (yeniDbAktif && dbSifre !== dbSifreTekrar) {
      setHata("Veritabanı şifresi ile tekrarı aynı değil.");
      return;
    }
    setBekliyor(true);
    try {
      if (yeniDbAktif) {
        const { baglantiModu: _m, dbServer: _s, dbSifre: _p, ...firmaAlanlari } = veri;
        await bulutKaydet!({
          ...firmaAlanlari,
          dbSifre,
          ilkKullaniciAdi: ilkKullaniciAdi.trim(),
          ilkKullaniciAdSoyad: ilkKullaniciAdSoyad.trim(),
          lisansBitis,
          kullaniciLimiti,
          ...(paketListe?.kurulu && urunler.length ? { urunler } : {}),
        });
      } else if (veri.baglantiModu === "setup") {
        // Veritabanı müşteride: sunucu tarafı benzersiz bir yer tutucu yazar
        await kaydet({ ...veri, dbServer: "kurulum", dbName: veri.firmaKodu || "kurulum", dbUser: "" });
      } else {
        await kaydet({ ...veri, ...(dbSifre !== "" ? { dbSifre } : {}) });
      }
      setDbSifre("");
      setDbSifreTekrar("");
    } catch (err: any) {
      setHata(err?.message || "Kaydedilemedi.");
    } finally {
      setBekliyor(false);
    }
  };

  return (
    <Form onSubmit={gonder} autoComplete="off">
      {hata && <Alert variant="danger">{hata}</Alert>}

      <h6 className="text-muted mb-3">Firma Bilgileri</h6>
      <Row className="g-3 mb-4">
        <Col md={3}>
          <Form.Group controlId="frmKod">
            <Form.Label>Firma kodu</Form.Label>
            <Form.Control
              value={veri.firmaKodu}
              onChange={(e) => setVeri((v) => ({ ...v, firmaKodu: firmaKodunaCevir(e.target.value) }))}
              required
              minLength={2}
              maxLength={20}
              placeholder="ör. LIKYA01"
            />
            <Form.Text muted>Büyük harf, rakam, tire ve alt çizgi.</Form.Text>
          </Form.Group>
        </Col>
        <Col md={3}>
          <Form.Group controlId="frmMusteriNo">
            <Form.Label>Müşteri No</Form.Label>
            <Form.Control
              value={veri.musteriNo}
              onChange={(e) => setVeri((v) => ({ ...v, musteriNo: musteriNoyaCevir(e.target.value) }))}
              required
              minLength={3}
              maxLength={20}
              placeholder="ör. D20AC0001"
            />
            <Form.Text muted>Harf ve rakam. Aynı müşterinin her veritabanında aynı no yazılır.</Form.Text>
          </Form.Group>
        </Col>
        <Col md={2}>
          <Form.Group controlId="frmPrgTur">
            <Form.Label>Program türü</Form.Label>
            <Form.Control
              type="number"
              min={0}
              max={999}
              value={veri.prgTur}
              onChange={(e) => setVeri((v) => ({ ...v, prgTur: Math.max(0, Number(e.target.value) || 0) }))}
            />
          </Form.Group>
        </Col>
        <Col md={12}>
          <Form.Group controlId="frmUnvan">
            <Form.Label>Unvan</Form.Label>
            <Form.Control {...alan("unvan")} required minLength={2} maxLength={200} />
          </Form.Group>
        </Col>
        <Col md={3}>
          <Form.Group controlId="frmVkn">
            <Form.Label>VKN / TCKN</Form.Label>
            <Form.Control {...alan("vknTckn")} inputMode="numeric" pattern="(\d{10}|\d{11})?" maxLength={11} />
          </Form.Group>
        </Col>
        <Col md={4}>
          <Form.Group controlId="frmVd">
            <Form.Label>Vergi dairesi</Form.Label>
            <Form.Control {...alan("vergiDairesi")} maxLength={100} />
          </Form.Group>
        </Col>
        <Col md={5}>
          <Form.Group controlId="frmYetkili">
            <Form.Label>Yetkili kişi</Form.Label>
            <Form.Control {...alan("yetkiliKisi")} maxLength={100} />
          </Form.Group>
        </Col>
        <Col md={4}>
          <Form.Group controlId="frmTel">
            <Form.Label>Telefon</Form.Label>
            <Form.Control {...alan("telefon")} maxLength={30} />
          </Form.Group>
        </Col>
        <Col md={8}>
          <Form.Group controlId="frmEposta">
            <Form.Label>E-posta</Form.Label>
            <Form.Control type="email" {...alan("eposta")} maxLength={150} />
          </Form.Group>
        </Col>
        <Col md={12}>
          <Form.Group controlId="frmAdres">
            <Form.Label>Adres</Form.Label>
            <Form.Control as="textarea" rows={2} {...alan("adres")} maxLength={500} />
          </Form.Group>
        </Col>
      </Row>

      <h6 className="text-muted mb-3">Veritabanı Bağlantısı</h6>
      <Row className="g-3 mb-4">
        <Col md={3}>
          <Form.Group controlId="frmMod">
            <Form.Label>Bağlantı modu</Form.Label>
            <Form.Select {...alan("baglantiModu")}>
              <option value="cloud">Bulut (sunucumuzda)</option>
              <option value="local">Web köprü (müşterinin SQL'ine site bağlanır)</option>
              <option value="setup">Kurulum (lisanslı exe)</option>
            </Form.Select>
          </Form.Group>
        </Col>
        {veri.baglantiModu === "setup" && (
          <Col md={9} className="d-flex align-items-end">
            <Form.Text muted>
              Program müşterinin kendi bilgisayarında / sunucusunda çalışır; veritabanı oradadır. Kurulum paketi ve lisans kodu
              firma kaydedildikten sonra firma sayfasından verilir.
            </Form.Text>
          </Col>
        )}
        {bulutSecenegi && (
          <Col md={9} className="d-flex align-items-end">
            <Form.Group controlId="frmYeniDb">
              <Form.Check
                type="switch"
                label="Sunucumuzda boş veritabanı oluştur (şablondan)"
                checked={yeniDbAktif}
                disabled={!bulut?.klonAcik}
                onChange={(e) => setYeniDb(e.target.checked)}
              />
              {!bulut?.klonAcik && (
                <Form.Text muted>Bu sunucuda veritabanı oluşturma kapalı (klonlama hesabı tanımlı değil).</Form.Text>
              )}
            </Form.Group>
          </Col>
        )}
        {veri.baglantiModu !== "setup" && (<>
        <Col md={5}>
          <Form.Group controlId="frmSunucu">
            <Form.Label>Sunucu</Form.Label>
            {yeniDbAktif ? (
              <Form.Control value={`${bulut!.sunucu} (sunucumuz)`} readOnly disabled />
            ) : (
              <Form.Control {...alan("dbServer")} required maxLength={200} placeholder="örn. 127.0.0.1 veya 88.245.x.x,1433" />
            )}
          </Form.Group>
        </Col>
        <Col md={4}>
          <Form.Group controlId="frmDb">
            <Form.Label>Veritabanı adı</Form.Label>
            <Form.Control
              {...alan("dbName")}
              required
              maxLength={yeniDbAktif ? 64 : 128}
              pattern={yeniDbAktif ? SQL_ADI : undefined}
              placeholder={yeniDbAktif ? "örn. FIRMA01_dvz" : "örn. R2016_dvz"}
            />
            {yeniDbAktif && <Form.Text muted>Harfle başlar; harf, rakam ve alt çizgi.</Form.Text>}
          </Form.Group>
        </Col>
        <Col md={yeniDbAktif ? 4 : 6}>
          <Form.Group controlId="frmDbUser">
            <Form.Label>Veritabanı kullanıcısı</Form.Label>
            <Form.Control
              {...alan("dbUser")}
              required={yeniDbAktif}
              maxLength={yeniDbAktif ? 64 : 128}
              pattern={yeniDbAktif ? SQL_ADI : undefined}
              autoComplete="off"
            />
          </Form.Group>
        </Col>
        <Col md={yeniDbAktif ? 4 : 6}>
          <Form.Group controlId="frmDbSifre">
            <Form.Label>Veritabanı şifresi</Form.Label>
            <Form.Control
              type="password"
              value={dbSifre}
              onChange={(e) => setDbSifre(e.target.value)}
              required={yeniDbAktif}
              minLength={yeniDbAktif ? 8 : undefined}
              maxLength={128}
              autoComplete="new-password"
              placeholder={
                yeniDbAktif ? "En az 8 karakter" : firma?.dbSifreTanimli ? "Kayıtlı — değiştirmek için yazın" : "Tanımlı değil"
              }
            />
          </Form.Group>
        </Col>
        {yeniDbAktif && (
          <Col md={4}>
            <Form.Group controlId="frmDbSifreTekrar">
              <Form.Label>Şifre tekrar</Form.Label>
              <Form.Control
                type="password"
                value={dbSifreTekrar}
                onChange={(e) => setDbSifreTekrar(e.target.value)}
                required
                maxLength={128}
                autoComplete="new-password"
              />
            </Form.Group>
          </Col>
        )}
        <Col md={12}>
          <Form.Text muted>
            {yeniDbAktif
              ? "Veritabanı boş şablondan açılır; SQL kullanıcısı yalnız bu veritabanına erişir. Şifre büyük harf, küçük harf, rakam ve işaretten en az üçünü içermeli. Şifre şifrelenerek saklanır ve bir daha görüntülenemez."
              : "Kullanıcı giriş yaparken yazdığı sunucu ve veritabanı adı buradakiyle eşleşen firmaya bağlanır; bir veritabanı yalnızca bir firmaya tanımlanabilir. Şifre şifrelenerek saklanır ve bir daha görüntülenemez."}
          </Form.Text>
        </Col>
        </>)}
      </Row>

      {yeniDbAktif && (
        <>
          <h6 className="text-muted mb-3">İlk Kullanıcı ve Lisans</h6>
          <Row className="g-3 mb-4">
            <Col md={4}>
              <Form.Group controlId="frmIlkKullanici">
                <Form.Label>Kullanıcı adı</Form.Label>
                <Form.Control
                  value={ilkKullaniciAdi}
                  onChange={(e) => setIlkKullaniciAdi(e.target.value)}
                  required
                  minLength={2}
                  maxLength={50}
                  autoComplete="off"
                />
                <Form.Text muted>Firma yöneticisi olur; diğer kullanıcıları kendisi açar.</Form.Text>
              </Form.Group>
            </Col>
            <Col md={8}>
              <Form.Group controlId="frmIlkAdSoyad">
                <Form.Label>Ad soyad</Form.Label>
                <Form.Control value={ilkKullaniciAdSoyad} onChange={(e) => setIlkKullaniciAdSoyad(e.target.value)} maxLength={100} />
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group controlId="frmLisansBitis">
                <Form.Label>Lisans bitiş</Form.Label>
                <Form.Control type="date" value={lisansBitis} onChange={(e) => setLisansBitis(e.target.value)} required />
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group controlId="frmKullaniciLimiti">
                <Form.Label>Kullanıcı limiti</Form.Label>
                <Form.Control
                  type="number"
                  min={1}
                  max={10000}
                  value={kullaniciLimiti}
                  onChange={(e) => setKullaniciLimiti(Math.max(1, Number(e.target.value) || 1))}
                  required
                />
                <Form.Text muted>İlk kullanıcı dahil, tanımlanabilecek kullanıcı sayısı.</Form.Text>
              </Form.Group>
            </Col>
            {paketListe?.kurulu && (
              <Col xs={12}>
                <Form.Label className="mb-1">Ürünler</Form.Label>
                <UrunSecici kimlik="frmUrun" urunler={secilebilirUrunler(paketListe)} secili={urunler} onDegistir={setUrunler} />
                <Form.Text muted className="d-block">
                  Seçilen ürünlerin sayfaları firmaya açık gelir; sonradan Modüller sekmesinden elle değiştirilebilir. Seçilmezse tüm menü açık başlar.
                </Form.Text>
              </Col>
            )}
          </Row>
        </>
      )}

      <div className="d-flex gap-2 align-items-center">
        <Button type="submit" className="btn-adm" disabled={bekliyor}>
          {bekliyor ? (
            <Spinner animation="border" size="sm" />
          ) : firma ? (
            "Kaydet"
          ) : yeniDbAktif ? (
            "Veritabanını ve Firmayı Oluştur"
          ) : (
            "Firmayı Oluştur"
          )}
        </Button>
        {vazgec && (
          <Button variant="outline-secondary" onClick={vazgec} disabled={bekliyor}>
            Vazgeç
          </Button>
        )}
        {bekliyor && yeniDbAktif && <span className="text-muted small">Veritabanı oluşturuluyor, bir iki dakika sürebilir…</span>}
      </div>
    </Form>
  );
};

export default FirmaFormu;
