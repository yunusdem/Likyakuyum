import React, { useEffect, useState } from "react";
import { Alert, Badge, Button, Card, Col, Form, Row, Spinner } from "react-bootstrap";
import { adminApi, AyarAnahtari, AyarlarDto } from "../services/adminApi";

/** Genel ayarlar: lisans kilit ekranındaki iletişim bilgisi (K17) ve sunucu klasörleri. */
const AyarlarPage: React.FC = () => {
  const [veri, setVeri] = useState<AyarlarDto | null>(null);
  const [form, setForm] = useState<Partial<Record<AyarAnahtari, string>>>({});
  const [hata, setHata] = useState<string | null>(null);
  const [bilgi, setBilgi] = useState<string | null>(null);
  const [bekliyor, setBekliyor] = useState(false);

  useEffect(() => {
    adminApi
      .ayarlar()
      .then((d) => {
        setVeri(d);
        setForm(d.ayarlar);
      })
      .catch((e) => setHata(e?.message || "Ayarlar getirilemedi."));
  }, []);

  const alan = (k: AyarAnahtari) => ({
    value: form[k] ?? "",
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value })),
  });

  const kaydet = async (e: React.FormEvent) => {
    e.preventDefault();
    setBekliyor(true);
    setHata(null);
    setBilgi(null);
    try {
      const d = await adminApi.ayarKaydet(form);
      setVeri(d);
      setForm(d.ayarlar);
      setBilgi("Ayarlar kaydedildi.");
    } catch (err: any) {
      setHata(err?.message || "Kaydedilemedi.");
    } finally {
      setBekliyor(false);
    }
  };

  if (!veri) {
    return hata ? <Alert variant="danger">{hata}</Alert> : <Spinner animation="border" />;
  }

  return (
    <Card className="shadow-sm">
      <Card.Body className="p-4">
        <h5 className="mb-3">Ayarlar</h5>
        <div className="d-flex gap-2 mb-4 small">
          <Badge bg={veri.durum.lisansImzaAcik ? "success" : "secondary"}>
            Lisans imza anahtarı: {veri.durum.lisansImzaAcik ? "tanımlı" : "yok"}
          </Badge>
          <Badge bg={veri.durum.klonAcik ? "success" : "secondary"}>
            Klonlama hesabı: {veri.durum.klonAcik ? "tanımlı" : "yok"}
          </Badge>
        </div>
        {hata && <Alert variant="danger">{hata}</Alert>}
        {bilgi && (
          <Alert variant="success" dismissible onClose={() => setBilgi(null)}>
            {bilgi}
          </Alert>
        )}
        <Form onSubmit={kaydet}>
          <h6 className="text-muted mb-3">Lisans kilit ekranındaki iletişim bilgisi</h6>
          <Row className="g-3 mb-4">
            <Col md={4}>
              <Form.Group controlId="ayTel">
                <Form.Label>Telefon</Form.Label>
                <Form.Control {...alan("LISANS_ILETISIM_TELEFON")} maxLength={100} />
              </Form.Group>
            </Col>
            <Col md={8}>
              <Form.Group controlId="ayEposta">
                <Form.Label>E-posta</Form.Label>
                <Form.Control type="email" {...alan("LISANS_ILETISIM_EPOSTA")} maxLength={150} />
              </Form.Group>
            </Col>
            <Col md={12}>
              <Form.Group controlId="ayMetin">
                <Form.Label>Açıklama</Form.Label>
                <Form.Control as="textarea" rows={2} {...alan("LISANS_ILETISIM_METIN")} maxLength={2000} />
                <Form.Text muted>
                  Bulut firmalarda hemen geçerli olur. Kurulum (exe) firmalarında lisans koduna gömülür: bir sonraki kodda ya da
                  internet bağlantısında programa yansır.
                </Form.Text>
              </Form.Group>
            </Col>
          </Row>
          <h6 className="text-muted mb-3">Sunucu klasörleri</h6>
          <Row className="g-3 mb-4">
            <Col md={6}>
              <Form.Group controlId="ayYedek">
                <Form.Label>Yedek klasörü</Form.Label>
                <Form.Control {...alan("YEDEK_KLASORU")} maxLength={400} />
                <Form.Text muted>Altında Firmalar ve Silinen klasörleri kullanılır.</Form.Text>
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group controlId="aySurum">
                <Form.Label>Sürüm paketleri klasörü</Form.Label>
                <Form.Control {...alan("SURUM_KLASORU")} maxLength={400} />
              </Form.Group>
            </Col>
            <Col md={12}>
              <Form.Group controlId="aySablon">
                <Form.Label>Şablon yedek dosyası</Form.Label>
                <Form.Control {...alan("SABLON_YEDEK_DOSYASI")} maxLength={400} />
              </Form.Group>
            </Col>
          </Row>
          <Button type="submit" className="btn-adm" disabled={bekliyor}>
            {bekliyor ? <Spinner animation="border" size="sm" /> : "Kaydet"}
          </Button>
        </Form>
      </Card.Body>
    </Card>
  );
};

export default AyarlarPage;
