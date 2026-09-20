import React, { useState } from "react";
import { Alert, Button, Col, Form, Row, Spinner } from "react-bootstrap";
import { FirmaDto, FirmaGirdi } from "../services/adminApi";

interface Props {
  /** Verilirse düzenleme, verilmezse yeni kayıt */
  firma?: FirmaDto;
  kaydet: (veri: FirmaGirdi) => Promise<void>;
  vazgec?: () => void;
}

const baslangic = (f?: FirmaDto): FirmaGirdi => ({
  firmaKodu: f?.firmaKodu ?? "",
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

const FirmaFormu: React.FC<Props> = ({ firma, kaydet, vazgec }) => {
  const [veri, setVeri] = useState<FirmaGirdi>(() => baslangic(firma));
  // Kayıtlı şifre hiçbir zaman sunucudan gelmez; alan boş bırakılırsa mevcut şifreye dokunulmaz.
  const [dbSifre, setDbSifre] = useState("");
  const [hata, setHata] = useState<string | null>(null);
  const [bekliyor, setBekliyor] = useState(false);

  const alan = <K extends keyof FirmaGirdi>(ad: K) => ({
    value: veri[ad] as string,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setVeri((v) => ({ ...v, [ad]: e.target.value })),
  });

  const gonder = async (e: React.FormEvent) => {
    e.preventDefault();
    setHata(null);
    setBekliyor(true);
    try {
      await kaydet({ ...veri, ...(dbSifre !== "" ? { dbSifre } : {}) });
      setDbSifre("");
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
        <Col md={9}>
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
              <option value="local">Yerel (firmanın kendi sunucusu)</option>
            </Form.Select>
          </Form.Group>
        </Col>
        <Col md={5}>
          <Form.Group controlId="frmSunucu">
            <Form.Label>Sunucu</Form.Label>
            <Form.Control {...alan("dbServer")} required maxLength={200} placeholder="örn. 127.0.0.1 veya 88.245.x.x,1433" />
          </Form.Group>
        </Col>
        <Col md={4}>
          <Form.Group controlId="frmDb">
            <Form.Label>Veritabanı adı</Form.Label>
            <Form.Control {...alan("dbName")} required maxLength={128} placeholder="örn. R2016_dvz" />
          </Form.Group>
        </Col>
        <Col md={6}>
          <Form.Group controlId="frmDbUser">
            <Form.Label>Veritabanı kullanıcısı</Form.Label>
            <Form.Control {...alan("dbUser")} maxLength={128} autoComplete="off" />
          </Form.Group>
        </Col>
        <Col md={6}>
          <Form.Group controlId="frmDbSifre">
            <Form.Label>Veritabanı şifresi</Form.Label>
            <Form.Control
              type="password"
              value={dbSifre}
              onChange={(e) => setDbSifre(e.target.value)}
              maxLength={128}
              autoComplete="new-password"
              placeholder={firma?.dbSifreTanimli ? "Kayıtlı — değiştirmek için yazın" : "Tanımlı değil"}
            />
          </Form.Group>
        </Col>
        <Col md={12}>
          <Form.Text muted>
            Kullanıcı giriş yaparken yazdığı sunucu ve veritabanı adı buradakiyle eşleşen firmaya bağlanır; bir veritabanı
            yalnızca bir firmaya tanımlanabilir. Şifre şifrelenerek saklanır ve bir daha görüntülenemez.
          </Form.Text>
        </Col>
      </Row>

      <div className="d-flex gap-2">
        <Button type="submit" className="btn-adm" disabled={bekliyor}>
          {bekliyor ? <Spinner animation="border" size="sm" /> : firma ? "Kaydet" : "Firmayı Oluştur"}
        </Button>
        {vazgec && (
          <Button variant="outline-secondary" onClick={vazgec} disabled={bekliyor}>
            Vazgeç
          </Button>
        )}
      </div>
    </Form>
  );
};

export default FirmaFormu;
