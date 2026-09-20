import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Alert, Button, Card, Form, Spinner } from "react-bootstrap";
import { useAdminAuth } from "../context/AdminAuthContext";
import { adminApi } from "../services/adminApi";

// Sunucudaki kuralla aynı (Backend/src/utils/sifre.utils.ts): en az 8 karakter, harf + rakam
const kuralHatasi = (sifre: string): string | null => {
  if (sifre.length < 8) return "Şifre en az 8 karakter olmalıdır.";
  if (!/\p{L}/u.test(sifre)) return "Şifre en az bir harf içermelidir.";
  if (!/\d/.test(sifre)) return "Şifre en az bir rakam içermelidir.";
  return null;
};

const SifreDegistirPage: React.FC = () => {
  const { admin, yenile } = useAdminAuth();
  const navigate = useNavigate();
  const zorunlu = !!admin?.sifreDegismeli;

  const [mevcut, setMevcut] = useState("");
  const [yeni, setYeni] = useState("");
  const [tekrar, setTekrar] = useState("");
  const [hata, setHata] = useState<string | null>(null);
  const [tamam, setTamam] = useState(false);
  const [bekliyor, setBekliyor] = useState(false);

  const gonder = async (e: React.FormEvent) => {
    e.preventDefault();
    setHata(null);
    setTamam(false);

    const kural = kuralHatasi(yeni);
    if (kural) return setHata(kural);
    if (yeni !== tekrar) return setHata("Yeni şifre ile tekrarı aynı değil.");

    setBekliyor(true);
    try {
      await adminApi.sifreDegistir(mevcut, yeni);
      await yenile();
      setMevcut("");
      setYeni("");
      setTekrar("");
      if (zorunlu) navigate("/", { replace: true });
      else setTamam(true);
    } catch (err: any) {
      setHata(err?.message || "Şifre değiştirilemedi.");
    } finally {
      setBekliyor(false);
    }
  };

  return (
    <Card className="shadow-sm" style={{ maxWidth: 460 }}>
      <Card.Body className="p-4">
        <h5 className="mb-3">{zorunlu ? "Şifrenizi Belirleyin" : "Şifre Değiştir"}</h5>

        {zorunlu && (
          <Alert variant="warning">
            Geçici şifreyle giriş yaptınız. Devam etmek için kendi şifrenizi belirlemelisiniz.
          </Alert>
        )}
        {hata && <Alert variant="danger">{hata}</Alert>}
        {tamam && <Alert variant="success">Şifreniz değiştirildi.</Alert>}

        <Form onSubmit={gonder} autoComplete="off">
          <Form.Group className="mb-3" controlId="admMevcutSifre">
            <Form.Label>{zorunlu ? "Geçici şifre" : "Mevcut şifre"}</Form.Label>
            <Form.Control
              type="password"
              value={mevcut}
              onChange={(e) => setMevcut(e.target.value)}
              required
              autoComplete="current-password"
            />
          </Form.Group>
          <Form.Group className="mb-3" controlId="admYeniSifre">
            <Form.Label>Yeni şifre</Form.Label>
            <Form.Control
              type="password"
              value={yeni}
              onChange={(e) => setYeni(e.target.value)}
              required
              maxLength={72}
              autoComplete="new-password"
            />
            <Form.Text muted>En az 8 karakter; en az bir harf ve bir rakam.</Form.Text>
          </Form.Group>
          <Form.Group className="mb-4" controlId="admYeniSifreTekrar">
            <Form.Label>Yeni şifre (tekrar)</Form.Label>
            <Form.Control
              type="password"
              value={tekrar}
              onChange={(e) => setTekrar(e.target.value)}
              required
              maxLength={72}
              autoComplete="new-password"
            />
          </Form.Group>
          <Button type="submit" className="btn-adm" disabled={bekliyor}>
            {bekliyor ? <Spinner animation="border" size="sm" /> : "Kaydet"}
          </Button>
        </Form>
      </Card.Body>
    </Card>
  );
};

export default SifreDegistirPage;
