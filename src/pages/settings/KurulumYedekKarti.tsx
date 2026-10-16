import React, { useCallback, useEffect, useState } from "react";
import { Alert, Badge, Button, Col, ProgressBar, Row, Spinner, Table } from "react-bootstrap";
import { apiClient } from "../../services/apiClient";

/** Kurulum (exe) yedeği (docs/BULUT_VE_EXE_LISANS_YOL_HARITASI.md 15.1, Y4) */
interface YedekBilgisi {
  sonYedek: string | null;
  dosya: string | null;
  boyut: number | null;
  belgeler: { dosya: string | null; boyut: number | null; hata: string | null } | null;
  hedefler: { klasor: string; basarili: boolean; mesaj: string | null }[];
  hata: string | null;
  hataZamani: string | null;
  vtBoyutMb: number | null;
  suruyor: boolean;
  klasor: string;
  dosyalar: { ad: string; boyut: number; zaman: string }[];
  sinirMb: number;
  uyariMb: number;
  saklananGun: number;
}

const tarih = (v: string | null | undefined) => (v ? new Date(v).toLocaleString("tr-TR") : "-");
const boyutYaz = (b: number | null | undefined) => {
  if (b === null || b === undefined) return "-";
  if (b >= 1024 * 1024 * 1024) return `${(b / 1024 / 1024 / 1024).toFixed(2)} GB`;
  if (b >= 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(b / 1024))} KB`;
};
const IKI_GUN_MS = 2 * 24 * 60 * 60 * 1000;

const KurulumYedekKarti: React.FC<{ yonetici: boolean }> = ({ yonetici }) => {
  const [y, setY] = useState<YedekBilgisi | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [bilgi, setBilgi] = useState<string | null>(null);

  const yukle = useCallback(async () => {
    try {
      setY((await apiClient.get<YedekBilgisi>("/sistem/yedek")).data as YedekBilgisi);
    } catch (e: any) {
      setHata(e?.message || "Yedek durumu getirilemedi.");
    }
  }, []);

  useEffect(() => {
    yukle();
  }, [yukle]);

  // "Şimdi Yedekle" sonrası: yedek bitince sonucu bildir. Bitiş, basmadan önceki son yedek / hata zamanının değişmesinden
  // anlaşılır (ağdaki bilgisayarın saati sunucudan farklı olabilir)
  const [izlenen, setIzlenen] = useState<{ son: string | null; hata: string | null } | null>(null);
  useEffect(() => {
    if (!izlenen || !y || y.suruyor) return;
    if (y.sonYedek !== izlenen.son) {
      setBilgi("Yedek alındı.");
      setIzlenen(null);
    } else if (y.hataZamani !== izlenen.hata) {
      setHata(`Yedek alınamadı: ${y.hata}`);
      setIzlenen(null);
    }
  }, [y, izlenen]);

  // Yedek alınırken (ya da sonucu beklenirken) durum birkaç saniyede bir sorulur
  const izle = !!y?.suruyor || izlenen !== null;
  useEffect(() => {
    if (!izle) return;
    const z = window.setInterval(yukle, 3000);
    return () => window.clearInterval(z);
  }, [izle, yukle]);

  const simdiYedekle = async () => {
    if (!y) return;
    setHata(null);
    setBilgi(null);
    const onceki = { son: y.sonYedek, hata: y.hataZamani };
    try {
      await apiClient.post("/sistem/yedek", {});
      setIzlenen(onceki);
      await yukle();
    } catch (e: any) {
      setHata(e?.message || "Yedek başlatılamadı.");
    }
  };

  if (!y) return hata ? <Alert variant="danger" className="mt-4">{hata}</Alert> : null;

  const eski = !y.sonYedek || Date.now() - new Date(y.sonYedek).getTime() > IKI_GUN_MS;
  const oran = y.vtBoyutMb !== null ? Math.min(100, Math.round((y.vtBoyutMb / y.sinirMb) * 100)) : null;
  const sinirYakin = y.vtBoyutMb !== null && y.vtBoyutMb >= y.uyariMb;

  return (
    <div className="mt-4 pt-3 border-top">
      <h6 className="text-muted">Yedek</h6>
      {hata && <Alert variant="danger">{hata}</Alert>}
      {bilgi && (
        <Alert variant="success" dismissible onClose={() => setBilgi(null)}>
          {bilgi}
        </Alert>
      )}
      <Row className="g-4">
        <Col lg={6}>
          <Table size="sm">
            <tbody>
              <tr>
                <th className="fw-normal text-muted w-50">Son yedek</th>
                <td>
                  {tarih(y.sonYedek)} {y.sonYedek && <span className="text-muted">({boyutYaz(y.boyut)})</span>}{" "}
                  {y.suruyor ? <Badge bg="info">Alınıyor</Badge> : eski && <Badge bg="danger">{y.sonYedek ? "Eski" : "Yok"}</Badge>}
                  {y.hata && (
                    <div className="small text-danger">
                      Son deneme ({tarih(y.hataZamani)}): {y.hata}
                    </div>
                  )}
                </td>
              </tr>
              <tr>
                <th className="fw-normal text-muted">Belgeler klasörü</th>
                <td>
                  {y.belgeler?.dosya ? `${y.belgeler.dosya} (${boyutYaz(y.belgeler.boyut)})` : "-"}
                  {y.belgeler?.hata && <div className="small text-danger">{y.belgeler.hata}</div>}
                </td>
              </tr>
              {y.hedefler.map((h) => (
                <tr key={h.klasor}>
                  <th className="fw-normal text-muted">Ek yedek klasörü</th>
                  <td>
                    <code>{h.klasor}</code> {h.basarili ? <Badge bg="success">Yazıldı</Badge> : <Badge bg="danger">Yazılamadı</Badge>}
                    {h.mesaj && <div className="small text-danger">{h.mesaj}</div>}
                  </td>
                </tr>
              ))}
              <tr>
                <th className="fw-normal text-muted">Yedek klasörü</th>
                <td>
                  <code>{y.klasor}</code>
                </td>
              </tr>
              <tr>
                <th className="fw-normal text-muted">Veritabanı boyutu</th>
                <td>
                  {y.vtBoyutMb !== null ? `${(y.vtBoyutMb / 1024).toFixed(2)} GB / ${(y.sinirMb / 1024).toFixed(0)} GB` : "-"}
                  {oran !== null && <ProgressBar now={oran} variant={sinirYakin ? "danger" : "success"} style={{ height: 6 }} className="mt-1" />}
                  {sinirYakin && (
                    <div className="small text-danger mt-1">Veritabanı SQL Server Express'in 10 GB sınırına yaklaşıyor; lütfen bizimle iletişime geçin.</div>
                  )}
                </td>
              </tr>
            </tbody>
          </Table>
          <p className="small text-muted">
            Her gün 02:00'den sonra (bilgisayar kapalıysa açıldıktan birkaç dakika sonra) veritabanının ve Belgeler klasörünün tam
            yedeği alınır, son {y.saklananGun} gün saklanır; güncellemeden önce de ayrıca yedek alınır. Firma Tanımları'ndaki Yedek
            Klasörü / İkinci Yedek Klasörü doluysa (USB bellek ya da ağ klasörü) yedek oraya da kopyalanır.
          </p>
          {yonetici && (
            <Button size="sm" variant="outline-primary" disabled={y.suruyor || izlenen !== null} onClick={simdiYedekle}>
              {y.suruyor || izlenen !== null ? <Spinner animation="border" size="sm" /> : "Şimdi Yedekle"}
            </Button>
          )}
        </Col>
        <Col lg={6}>
          <Table size="sm" className="small">
            <thead>
              <tr>
                <th className="fw-normal text-muted">Dosya</th>
                <th className="fw-normal text-muted text-end">Boyut</th>
                <th className="fw-normal text-muted">Tarih</th>
              </tr>
            </thead>
            <tbody>
              {y.dosyalar.length === 0 && (
                <tr>
                  <td colSpan={3} className="text-muted">
                    Henüz yedek yok.
                  </td>
                </tr>
              )}
              {y.dosyalar.slice(0, 20).map((f) => (
                <tr key={f.ad}>
                  <td>{f.ad}</td>
                  <td className="text-end">{boyutYaz(f.boyut)}</td>
                  <td>{tarih(f.zaman)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Col>
      </Row>
    </div>
  );
};

export default KurulumYedekKarti;
