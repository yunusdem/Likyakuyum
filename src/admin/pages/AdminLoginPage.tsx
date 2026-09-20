import React, { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Alert, Button, Card, Form, Spinner } from "react-bootstrap";
import { useAdminAuth } from "../context/AdminAuthContext";

const AdminLoginPage: React.FC = () => {
  const { admin, giris } = useAdminAuth();
  const navigate = useNavigate();
  const [kullaniciAdi, setKullaniciAdi] = useState("");
  const [sifre, setSifre] = useState("");
  const [hata, setHata] = useState<string | null>(null);
  const [bekliyor, setBekliyor] = useState(false);

  if (admin) return <Navigate to="/" replace />;

  const gonder = async (e: React.FormEvent) => {
    e.preventDefault();
    setHata(null);
    setBekliyor(true);
    try {
      await giris(kullaniciAdi.trim(), sifre);
      navigate("/", { replace: true });
    } catch (err: any) {
      setHata(err?.message || "Giriş yapılamadı.");
      setSifre("");
    } finally {
      setBekliyor(false);
    }
  };

  return (
    <div className="adm-giris">
      <Card className="shadow-sm">
        <Card.Body className="p-4">
          <h4 className="mb-1">Likya Kuyum</h4>
          <div className="text-muted mb-4">Yönetim Paneli</div>

          {hata && <Alert variant="danger">{hata}</Alert>}

          <Form onSubmit={gonder} autoComplete="off">
            <Form.Group className="mb-3" controlId="admKullaniciAdi">
              <Form.Label>Kullanıcı adı</Form.Label>
              <Form.Control
                value={kullaniciAdi}
                onChange={(e) => setKullaniciAdi(e.target.value)}
                autoFocus
                required
                maxLength={50}
                autoComplete="username"
              />
            </Form.Group>
            <Form.Group className="mb-4" controlId="admSifre">
              <Form.Label>Şifre</Form.Label>
              <Form.Control
                type="password"
                value={sifre}
                onChange={(e) => setSifre(e.target.value)}
                required
                maxLength={200}
                autoComplete="current-password"
              />
            </Form.Group>
            <Button type="submit" className="btn-adm w-100" disabled={bekliyor}>
              {bekliyor ? <Spinner animation="border" size="sm" /> : "Giriş Yap"}
            </Button>
          </Form>
        </Card.Body>
      </Card>
    </div>
  );
};

export default AdminLoginPage;
