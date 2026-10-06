import React, { useEffect, useState } from "react";
import { Alert, Button, Col, Form, Modal, Row, Spinner, Table } from "react-bootstrap";
import { adminApi, FirmaDto, tarihYaz } from "../services/adminApi";

interface Props {
  firma: FirmaDto;
  degisti: (firma: FirmaDto) => void;
}

const boyutYaz = (b: number | null): string => {
  if (b === null || b <= 0) return "—";
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  if (b < 1024 * 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} MB`;
  return `${(b / 1024 / 1024 / 1024).toFixed(2)} GB`;
};

const kalanGun = (tarih: string | null): number | null =>
  tarih ? Math.max(0, Math.round((new Date(tarih).getTime() - Date.now()) / 86_400_000)) : null; // SQL tarihleri saat dilimsiz gelir; birkaç saatlik fark gün sayısını şaşırtmasın

/** Bulut firma: haftalık yedek (tek dosya), şimdi yedekle, indir; 30 gün geri alınabilir silme. */
const FirmaYedekSilme: React.FC<Props> = ({ firma, degisti }) => {
  const [mesgul, setMesgul] = useState<string | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [bilgi, setBilgi] = useState<string | null>(null);
  const [silinemezNedeni, setSilinemezNedeni] = useState<string | null | undefined>(undefined);
  const [silAcik, setSilAcik] = useState(false);
  const [onay, setOnay] = useState("");

  useEffect(() => {
    let iptal = false;
    if (firma.durum === "SILINECEK" || firma.durum === "SILINDI") {
      setSilinemezNedeni(null);
      return;
    }
    adminApi
      .firmaSilmeDurumu(firma.firmaId)
      .then((r) => !iptal && setSilinemezNedeni(r.silinemezNedeni))
      .catch((e) => !iptal && setSilinemezNedeni(e?.message || "Silme durumu getirilemedi."));
    return () => {
      iptal = true;
    };
  }, [firma.firmaId, firma.durum]);

  const calistir = async (ad: string, is: () => Promise<string | void>) => {
    setMesgul(ad);
    setHata(null);
    setBilgi(null);
    try {
      const m = await is();
      if (m) setBilgi(m);
    } catch (e: any) {
      setHata(e?.message || "İşlem yapılamadı.");
    } finally {
      setMesgul(null);
    }
  };

  const silinecek = firma.durum === "SILINECEK";
  const silindi = firma.durum === "SILINDI";

  return (
    <>
      {hata && <Alert variant="danger">{hata}</Alert>}
      {bilgi && (
        <Alert variant="success" dismissible onClose={() => setBilgi(null)}>
          {bilgi}
        </Alert>
      )}

      <Row className="g-4">
        <Col lg={6}>
          <h6 className="text-muted mb-3">Yedek</h6>
          <Table size="sm" className="mb-3">
            <tbody>
              <tr>
                <th className="fw-normal text-muted w-50">Son yedek</th>
                <td>{firma.yedekTarihi ? tarihYaz(firma.yedekTarihi) : "Henüz alınmadı"}</td>
              </tr>
              <tr>
                <th className="fw-normal text-muted">Boyut</th>
                <td>{boyutYaz(firma.yedekBoyut)}</td>
              </tr>
              {silindi && firma.yedekSilinmePlani && (
                <tr>
                  <th className="fw-normal text-muted">Son yedek saklanır</th>
                  <td>
                    {tarihYaz(firma.yedekSilinmePlani)} tarihine kadar ({kalanGun(firma.yedekSilinmePlani)} gün)
                  </td>
                </tr>
              )}
            </tbody>
          </Table>
          <p className="text-muted small">
            Her hafta gece (Türkiye saatiyle 02:00-05:00) otomatik yedeklenir. Firma başına tek dosya tutulur; yeni yedek
            öncekinin yerine geçer.
          </p>
          <div className="d-flex gap-2">
            {!silindi && (
              <Button
                size="sm"
                className="btn-adm"
                disabled={!!mesgul}
                onClick={() =>
                  calistir("yedekle", async () => {
                    degisti(await adminApi.firmaYedekle(firma.firmaId));
                    return "Yedek alındı.";
                  })
                }
              >
                {mesgul === "yedekle" ? <Spinner animation="border" size="sm" /> : "Şimdi Yedekle"}
              </Button>
            )}
            <Button
              size="sm"
              variant="outline-secondary"
              disabled={!!mesgul || !firma.yedekVar}
              onClick={() =>
                calistir("indir", async () => {
                  window.location.href = await adminApi.firmaYedekIndirmeAdresi(firma.firmaId);
                  return "İndirme başladı.";
                })
              }
            >
              {mesgul === "indir" ? <Spinner animation="border" size="sm" /> : "Yedeği İndir"}
            </Button>
          </div>
        </Col>

        <Col lg={6}>
          <h6 className="text-muted mb-3">Silme</h6>
          {silindi ? (
            <Alert variant="dark" className="mb-0">
              Veritabanı {firma.silindiTarihi ? tarihYaz(firma.silindiTarihi) : ""} tarihinde kalıcı olarak silindi.
            </Alert>
          ) : silinecek ? (
            <>
              <Alert variant="danger">
                Firma {firma.silinmePlani ? tarihYaz(firma.silinmePlani) : ""} tarihinde kalıcı olarak silinecek (
                {kalanGun(firma.silinmePlani)} gün kaldı). Bu süre içinde girişler kapalıdır; geri alınca firma aynen döner.
              </Alert>
              <Button
                size="sm"
                variant="outline-success"
                disabled={!!mesgul}
                onClick={() =>
                  calistir("geriAl", async () => {
                    degisti(await adminApi.firmaSilmeyiGeriAl(firma.firmaId));
                    return "Silme geri alındı; firma aktif.";
                  })
                }
              >
                Silmeyi Geri Al
              </Button>
            </>
          ) : (
            <>
              <p className="text-muted small">
                Silinen firmanın girişleri hemen kapanır. 30 gün içinde geri alınabilir; süre dolunca son yedek alınır,
                veritabanı ve SQL kullanıcısı silinir. Son yedek 90 gün daha saklanır.
              </p>
              {silinemezNedeni === undefined ? (
                <Spinner animation="border" size="sm" />
              ) : silinemezNedeni ? (
                <div className="text-muted small">{silinemezNedeni}</div>
              ) : (
                <Button size="sm" variant="outline-danger" disabled={!!mesgul} onClick={() => setSilAcik(true)}>
                  Firmayı Sil
                </Button>
              )}
            </>
          )}
        </Col>
      </Row>

      <Modal show={silAcik} onHide={() => setSilAcik(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title as="h5">Firmayı sil</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>
            <strong>{firma.unvan}</strong> silinmek üzere işaretlenecek ve girişleri hemen kapanacak. 30 gün sonra veritabanı
            kalıcı olarak silinir.
          </p>
          <Form.Group controlId="silOnay">
            <Form.Label>
              Onaylamak için firma kodunu yazın: <code>{firma.firmaKodu}</code>
            </Form.Label>
            <Form.Control value={onay} onChange={(e) => setOnay(e.target.value)} autoComplete="off" />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setSilAcik(false)}>
            Vazgeç
          </Button>
          <Button
            variant="danger"
            disabled={onay.trim().toUpperCase() !== firma.firmaKodu.toUpperCase() || !!mesgul}
            onClick={() => {
              setSilAcik(false);
              calistir("sil", async () => {
                degisti(await adminApi.firmaSil(firma.firmaId, onay.trim()));
                setOnay("");
                return "Firma silinmek üzere işaretlendi.";
              });
            }}
          >
            Sil
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default FirmaYedekSilme;
