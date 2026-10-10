import React, { useCallback, useEffect, useState } from "react";
import { Alert, Badge, Button, Card, Col, Form, Row, Spinner, Table } from "react-bootstrap";
import { apiClient } from "../../services/apiClient";
import { SistemService } from "../../services/sistemService";
import { useAuth } from "../../context/AuthContext";
import { URUN_ADLARI, PaketKodu } from "../../config/urunPaketleri";

interface GuncellemeDurumu {
  surum: string;
  bekleyen: { surum: string; zaman: string } | null;
  sonSonuc: { surum: string; basarili: boolean; mesaj: string; zaman: string } | null;
  bildirim: { sonBasari: string | null; sonHata: string | null; merkez: string };
  lisans: {
    durum: string;
    neden: string | null;
    mesaj: string | null;
    makineKimligi: string;
    firmaUnvan: string | null;
    bitis: string | null;
    kalanGun: number | null;
    kullaniciLimiti: number | null;
    /** Lisanstaki ürün paketleri (docs/LISANS_URUN_PAKETLERI.md); eski kodlarda yok */
    urunler?: string[] | null;
    iletisim: { telefon: string; eposta: string; metin: string };
  };
}

const tarih = (v: string | null | undefined) => (v ? new Date(v).toLocaleString("tr-TR") : "-");

/** Kurulum (exe) sürümü: lisans, makine kimliği, sürüm ve güncelleme (docs/BULUT_VE_EXE_LISANS_YOL_HARITASI.md, 9). */
const LisansSurumPage: React.FC = () => {
  const { user } = useAuth();
  const [kurulum, setKurulum] = useState<boolean | null>(null);
  const [d, setD] = useState<GuncellemeDurumu | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [bilgi, setBilgi] = useState<string | null>(null);
  const [mesgul, setMesgul] = useState<string | null>(null);
  const [kod, setKod] = useState("");

  const yukle = useCallback(async () => {
    try {
      setD((await apiClient.get<GuncellemeDurumu>("/sistem/guncelleme")).data);
    } catch (e: any) {
      setHata(e?.message || "Durum getirilemedi.");
    }
  }, []);

  useEffect(() => {
    SistemService.bilgi().then((b) => {
      setKurulum(b.kurulum);
      if (b.kurulum) yukle();
    });
  }, [yukle]);

  const calistir = async (ad: string, is: () => Promise<string | void>) => {
    setMesgul(ad);
    setHata(null);
    setBilgi(null);
    try {
      const m = await is();
      if (m) setBilgi(m);
      await yukle();
    } catch (e: any) {
      setHata(e?.message || "İşlem yapılamadı.");
    } finally {
      setMesgul(null);
    }
  };

  if (kurulum === null) return <Spinner animation="border" />;
  if (!kurulum) {
    return (
      <Alert variant="info" className="mt-3">
        Bu sayfa yalnız kendi bilgisayarınıza kurulan (exe) sürümde kullanılır. Lisans bilginiz giriş ekranında ve üstteki uyarı
        bandında gösterilir.
      </Alert>
    );
  }
  if (!d) return hata ? <Alert variant="danger">{hata}</Alert> : <Spinner animation="border" />;

  const l = d.lisans;
  const yonetici = !!user?.isSysAdmin;

  return (
    <Card className="shadow-sm mt-2">
      <Card.Body className="p-4">
        <h5 className="mb-3">Lisans ve Sürüm</h5>
        {hata && <Alert variant="danger">{hata}</Alert>}
        {bilgi && (
          <Alert variant="success" dismissible onClose={() => setBilgi(null)}>
            {bilgi}
          </Alert>
        )}
        <Row className="g-4">
          <Col lg={6}>
            <h6 className="text-muted">Lisans</h6>
            <Table size="sm">
              <tbody>
                <tr>
                  <th className="fw-normal text-muted w-50">Durum</th>
                  <td>
                    <Badge bg={l.durum === "GECERLI" ? "success" : l.durum === "UYARI" ? "warning" : "danger"} text={l.durum === "UYARI" ? "dark" : undefined}>
                      {l.durum === "GECERLI" ? "Geçerli" : l.durum === "UYARI" ? "Bitmek üzere" : "Kilitli"}
                    </Badge>
                    {l.mesaj && <div className="small text-danger mt-1">{l.mesaj}</div>}
                  </td>
                </tr>
                <tr>
                  <th className="fw-normal text-muted">Firma</th>
                  <td>{l.firmaUnvan || "-"}</td>
                </tr>
                {!!l.urunler?.length && (
                  <tr>
                    <th className="fw-normal text-muted">Ürünler</th>
                    <td>{l.urunler.map((u) => URUN_ADLARI[u as PaketKodu] || u).join(" + ")}</td>
                  </tr>
                )}
                <tr>
                  <th className="fw-normal text-muted">Bitiş</th>
                  <td>
                    {l.bitis || "-"} {l.kalanGun !== null && l.kalanGun >= 0 && <span className="text-muted">({l.kalanGun} gün)</span>}
                  </td>
                </tr>
                <tr>
                  <th className="fw-normal text-muted">Kullanıcı limiti</th>
                  <td>{l.kullaniciLimiti ?? "-"}</td>
                </tr>
                <tr>
                  <th className="fw-normal text-muted">Bu bilgisayarın kimliği</th>
                  <td>
                    <code>{l.makineKimligi}</code>
                  </td>
                </tr>
              </tbody>
            </Table>
            {(l.iletisim?.telefon || l.iletisim?.eposta) && (
              <div className="small text-muted mb-3">
                Destek: {[l.iletisim.telefon, l.iletisim.eposta].filter(Boolean).join(" · ")}
              </div>
            )}
            <Form.Group controlId="lsKod">
              <Form.Label>Lisans Yükle</Form.Label>
              <Form.Control as="textarea" rows={3} value={kod} onChange={(e) => setKod(e.target.value)} placeholder="LKY1. ile başlayan kodu yapıştırın" spellCheck={false} />
            </Form.Group>
            <Button
              size="sm"
              className="mt-2"
              disabled={!!mesgul || kod.trim().length < 20}
              onClick={() =>
                calistir("lisans", async () => {
                  await SistemService.lisansYukle(kod.trim());
                  setKod("");
                  return "Lisans yüklendi.";
                })
              }
            >
              Lisansı Yükle
            </Button>
          </Col>
          <Col lg={6}>
            <h6 className="text-muted">Sürüm</h6>
            <Table size="sm">
              <tbody>
                <tr>
                  <th className="fw-normal text-muted w-50">Çalışan sürüm</th>
                  <td>{d.surum}</td>
                </tr>
                <tr>
                  <th className="fw-normal text-muted">Bekleyen güncelleme</th>
                  <td>{d.bekleyen ? <Badge bg="info">{d.bekleyen.surum}</Badge> : "Yok"}</td>
                </tr>
                <tr>
                  <th className="fw-normal text-muted">Son güncelleme</th>
                  <td>
                    {d.sonSonuc ? (
                      <>
                        {d.sonSonuc.surum} {d.sonSonuc.basarili ? <Badge bg="success">Başarılı</Badge> : <Badge bg="danger">Başarısız</Badge>}
                        <div className="small text-muted">
                          {tarih(d.sonSonuc.zaman)} · {d.sonSonuc.mesaj}
                        </div>
                      </>
                    ) : (
                      "-"
                    )}
                  </td>
                </tr>
                <tr>
                  <th className="fw-normal text-muted">Merkezle son eşitleme</th>
                  <td>
                    {tarih(d.bildirim.sonBasari)}
                    {d.bildirim.sonHata && <div className="small text-danger">{d.bildirim.sonHata}</div>}
                  </td>
                </tr>
              </tbody>
            </Table>
            <p className="small text-muted">
              İnternet varken yeni sürüm kendiliğinden iner ve gece 03:00'te uygulanır. Program güncelleme sırasında birkaç saniye
              kapanır; yeni sürüm açılmazsa eski sürüme kendiliğinden döner.
            </p>
            <div className="d-flex flex-wrap gap-2">
              <Button size="sm" variant="outline-secondary" disabled={!!mesgul} onClick={() => calistir("kontrol", async () => {
                await apiClient.post("/sistem/guncelleme/kontrol", {});
                return "Merkezle eşitlendi.";
              })}>
                {mesgul === "kontrol" ? <Spinner animation="border" size="sm" /> : "Merkezle Eşitle"}
              </Button>
              {yonetici && d.bekleyen && (
                <Button size="sm" variant="primary" disabled={!!mesgul} onClick={() => calistir("simdi", async () => {
                  await apiClient.post("/sistem/guncelleme/simdi", {});
                  return "Güncelleme başlatıldı; program kısa süre içinde yeniden açılacak. Sayfayı bir dakika sonra yenileyin.";
                })}>
                  Güncellemeyi Şimdi Uygula
                </Button>
              )}
            </div>
          </Col>
        </Row>
      </Card.Body>
    </Card>
  );
};

export default LisansSurumPage;
