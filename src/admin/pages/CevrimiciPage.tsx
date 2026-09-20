import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Alert, Badge, Button, Card, Modal, Spinner, Table } from "react-bootstrap";
import { IconRefresh } from "@tabler/icons-react";
import { useAdminAuth } from "../context/AdminAuthContext";
import { adminApi, CevrimiciOturum, tarihYaz } from "../services/adminApi";

const YENILEME_MS = 30_000;

/** Son birkaç dakikada işlem yapmış açık oturumlar. Oturum kapatılınca kullanıcı bir sonraki isteğinde girişe düşer. */
const CevrimiciPage: React.FC = () => {
  const { admin } = useAdminAuth();
  const [oturumlar, setOturumlar] = useState<CevrimiciOturum[] | null>(null);
  const [dakika, setDakika] = useState(5);
  const [hata, setHata] = useState<string | null>(null);
  const [kapatilacak, setKapatilacak] = useState<CevrimiciOturum | null>(null);

  const yukle = useCallback(async () => {
    try {
      const sonuc = await adminApi.cevrimici();
      setOturumlar(sonuc.oturumlar);
      setDakika(sonuc.dakika);
      setHata(null);
    } catch (err: any) {
      setHata(err?.message || "Oturumlar getirilemedi.");
    }
  }, []);

  useEffect(() => {
    yukle();
    const zamanlayici = window.setInterval(yukle, YENILEME_MS);
    return () => window.clearInterval(zamanlayici);
  }, [yukle]);

  const kapat = async () => {
    const hedef = kapatilacak;
    setKapatilacak(null);
    if (!hedef) return;
    try {
      await adminApi.oturumuKapat(hedef.sid);
      await yukle();
    } catch (err: any) {
      setHata(err?.message || "Oturum kapatılamadı.");
    }
  };

  return (
    <>
      <Card className="shadow-sm">
        <Card.Body className="p-4">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <div>
              <h5 className="mb-0">Çevrimiçi</h5>
              <small className="text-muted">
                Son {dakika} dakikada işlem yapanlar{oturumlar ? ` · ${oturumlar.length} oturum` : ""} · 30 sn'de bir yenilenir
              </small>
            </div>
            <Button size="sm" variant="outline-secondary" onClick={yukle}>
              <IconRefresh size={16} className="me-1" />
              Yenile
            </Button>
          </div>

          {hata && <Alert variant="danger">{hata}</Alert>}

          {oturumlar === null ? (
            !hata && (
              <div className="text-center py-4">
                <Spinner animation="border" />
              </div>
            )
          ) : oturumlar.length === 0 ? (
            <div className="text-muted py-3">Şu an çevrimiçi kimse yok.</div>
          ) : (
            <Table hover responsive className="align-middle mb-0">
              <thead>
                <tr>
                  <th>Kullanıcı</th>
                  <th>Firma</th>
                  <th>IP</th>
                  <th>Giriş</th>
                  <th>Son işlem</th>
                  <th>Tarayıcı</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {oturumlar.map((o) => {
                  const benim = o.tur === "ADMIN" && o.kullaniciAdi === admin?.kullaniciAdi;
                  return (
                    <tr key={o.sid}>
                      <td>
                        <span className="fw-semibold">{o.kullaniciAdi || "-"}</span>
                        {o.tur === "ADMIN" && (
                          <Badge bg="dark" className="ms-2">
                            Admin
                          </Badge>
                        )}
                        {benim && <span className="text-muted ms-1">(siz)</span>}
                      </td>
                      <td>
                        {o.firmaId ? (
                          <Link to={`/firmalar/${o.firmaId}`} className="text-decoration-none">
                            {o.firmaUnvan}
                          </Link>
                        ) : (
                          <span className="text-muted">Yönetim paneli</span>
                        )}
                      </td>
                      <td>{o.ip || "-"}</td>
                      <td>{tarihYaz(o.baslangic)}</td>
                      <td>{tarihYaz(o.sonIslem)}</td>
                      <td className="text-muted small" style={{ maxWidth: 260 }} title={o.tarayici || undefined}>
                        <div className="text-truncate">{o.tarayici || "-"}</div>
                      </td>
                      <td className="text-end">
                        {!benim && (
                          <Button size="sm" variant="outline-danger" onClick={() => setKapatilacak(o)}>
                            Oturumu Kapat
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </Card.Body>
      </Card>

      <Modal show={!!kapatilacak} onHide={() => setKapatilacak(null)} centered>
        <Modal.Body className="p-4">
          <strong>{kapatilacak?.kullaniciAdi}</strong>
          {kapatilacak?.firmaUnvan ? ` (${kapatilacak.firmaUnvan})` : ""} oturumu kapatılsın mı? Kullanıcı bir sonraki işleminde giriş
          ekranına döner; hesabı açık kaldığı için yeniden giriş yapabilir.
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setKapatilacak(null)}>
            Vazgeç
          </Button>
          <Button className="btn-adm" onClick={kapat}>
            Kapat
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default CevrimiciPage;
