import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Alert, Button, Card, Form, Spinner } from "react-bootstrap";
import { useAuth } from "../../context/AuthContext";
import { AuthService } from "../../services/authService";

// Sunucudaki kuralla aynı (Backend/src/utils/sifre.utils.ts): en az 8 karakter, harf + rakam
const kuralHatasi = (sifre: string): string | null => {
  if (sifre.length < 8) return "Şifre en az 8 karakter olmalıdır.";
  if (!/\p{L}/u.test(sifre)) return "Şifre en az bir harf içermelidir.";
  if (!/\d/.test(sifre)) return "Şifre en az bir rakam içermelidir.";
  return null;
};

/**
 * Kullanıcının kendi şifresini değiştirmesi. Yönetici geçici şifre verdiyse (user.merkez.sifreDegismeli)
 * kullanıcı buraya kilitlenir ve yeni şifresini belirlemeden başka sayfaya geçemez (bkz. ProtectedRoute).
 */
const ChangePasswordPage: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const zorunlu = !!user?.merkez?.sifreDegismeli;

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
      await AuthService.changePassword(mevcut, yeni);
      await refreshUser();
      setMevcut("");
      setYeni("");
      setTekrar("");
      if (zorunlu) navigate("/dashboard", { replace: true });
      else setTamam(true);
    } catch (err: any) {
      setHata(err?.message || "Şifre değiştirilemedi.");
    } finally {
      setBekliyor(false);
    }
  };

  return (
    <div className="p-3 p-md-4">
      <Card className="shadow-sm" style={{ maxWidth: 460 }}>
        <Card.Body className="p-4">
          <h5 className="mb-3">{zorunlu ? "Şifrenizi Belirleyin" : "Şifre Değiştir"}</h5>

          {zorunlu && (
            <Alert variant="warning">
              Size verilen geçici şifreyle giriş yaptınız. Devam etmek için kendi şifrenizi belirlemelisiniz.
            </Alert>
          )}
          {hata && <Alert variant="danger">{hata}</Alert>}
          {tamam && <Alert variant="success">Şifreniz değiştirildi.</Alert>}

          <Form onSubmit={gonder} autoComplete="off">
            <Form.Group className="mb-3" controlId="sdMevcut">
              <Form.Label>{zorunlu ? "Geçici şifre" : "Mevcut şifre"}</Form.Label>
              <Form.Control
                type="password"
                value={mevcut}
                onChange={(e) => setMevcut(e.target.value)}
                required
                autoFocus
                autoComplete="current-password"
              />
            </Form.Group>
            <Form.Group className="mb-3" controlId="sdYeni">
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
            <Form.Group className="mb-4" controlId="sdTekrar">
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
            <Button type="submit" variant="primary" disabled={bekliyor}>
              {bekliyor ? <Spinner animation="border" size="sm" /> : "Kaydet"}
            </Button>
          </Form>
        </Card.Body>
      </Card>
    </div>
  );
};

export default ChangePasswordPage;
