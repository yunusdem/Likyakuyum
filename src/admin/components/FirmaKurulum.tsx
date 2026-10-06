import React, { useCallback, useEffect, useState } from "react";
import { Alert, Badge, Button, Col, Form, Row, Spinner, Table } from "react-bootstrap";
import { adminApi, FirmaDto, HeartbeatDto, SurumDto, tarihYaz } from "../services/adminApi";

interface Props {
  firma: FirmaDto;
  degisti: (firma: FirmaDto) => void;
}

const KILIT_ETIKETI: Record<string, string> = {
  LISANS_YOK: "Lisans yok",
  LISANS_DOLDU: "Süre doldu",
  SAAT_GERI_ALINDI: "Saat geri alındı",
  DURUM_BOZUK: "Lisans kayıtları bozuk",
  MAKINE_UYUSMUYOR: "Başka bilgisayar",
  BUTUNLUK_BOZUK: "Program dosyaları bozuk",
  LISANS_GECERSIZ: "Geçersiz lisans",
};

/** Kurulum (exe) firması: kurulum paketi bağlantısı, firma.lky, makine, sürüm, hedef sürüm ve bildirim geçmişi. */
const FirmaKurulum: React.FC<Props> = ({ firma, degisti }) => {
  const [gecmis, setGecmis] = useState<HeartbeatDto[]>([]);
  const [sonMakine, setSonMakine] = useState<string | null>(null);
  const [surumler, setSurumler] = useState<SurumDto[]>([]);
  const [baglanti, setBaglanti] = useState<{ adres: string; sonGecerlilik: string } | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [mesgul, setMesgul] = useState<string | null>(null);
  const [kopyalandi, setKopyalandi] = useState(false);

  const yukle = useCallback(async () => {
    try {
      const [d, s] = await Promise.all([adminApi.kurulumDurumu(firma.firmaId), adminApi.surumler()]);
      setGecmis(d.gecmis);
      setSonMakine(d.sonBildirilenMakine);
      setSurumler(s);
    } catch (e: any) {
      setHata(e?.message || "Kurulum bilgisi getirilemedi.");
    }
  }, [firma.firmaId]);

  useEffect(() => {
    yukle();
  }, [yukle]);

  const calistir = async (ad: string, is: () => Promise<void>) => {
    setMesgul(ad);
    setHata(null);
    try {
      await is();
    } catch (e: any) {
      setHata(e?.message || "İşlem yapılamadı.");
    } finally {
      setMesgul(null);
    }
  };

  const enSon = surumler.find((s) => s.aktif)?.surum;
  const guncel = firma.surum && (firma.hedefSurum ? firma.surum === firma.hedefSurum : firma.surum === enSon);

  return (
    <>
      {hata && <Alert variant="danger">{hata}</Alert>}
      <Row className="g-4 mb-4">
        <Col lg={6}>
          <h6 className="text-muted mb-3">Durum</h6>
          <Table size="sm" className="mb-0">
            <tbody>
              <tr>
                <th className="fw-normal text-muted w-50">Son görülme</th>
                <td>{firma.sonGorulme ? tarihYaz(firma.sonGorulme) : <span className="text-muted">Henüz bildirim yok</span>}</td>
              </tr>
              <tr>
                <th className="fw-normal text-muted">Çalışan sürüm</th>
                <td>
                  {firma.surum || "-"}{" "}
                  {firma.surum && (guncel ? <Badge bg="success">Güncel</Badge> : <Badge bg="warning" text="dark">Güncelleme bekliyor</Badge>)}
                </td>
              </tr>
              <tr>
                <th className="fw-normal text-muted">Lisans (programın bildirdiği)</th>
                <td>
                  {firma.bildirilenLisansDurumu || "-"}{" "}
                  {firma.bildirilenKilitNedeni && <Badge bg="danger">{KILIT_ETIKETI[firma.bildirilenKilitNedeni] || firma.bildirilenKilitNedeni}</Badge>}
                </td>
              </tr>
              <tr>
                <th className="fw-normal text-muted">Lisanslı makine</th>
                <td>
                  <code>{firma.makineKimligi || "-"}</code>
                </td>
              </tr>
              <tr>
                <th className="fw-normal text-muted">Son bildiren makine</th>
                <td>
                  <code>{sonMakine || "-"}</code>{" "}
                  {sonMakine && firma.makineKimligi && sonMakine !== firma.makineKimligi && <Badge bg="warning" text="dark">Farklı bilgisayar</Badge>}
                </td>
              </tr>
              <tr>
                <th className="fw-normal text-muted">Kullanıcı</th>
                <td>{firma.bildirilenKullaniciSayisi ?? "-"}</td>
              </tr>
            </tbody>
          </Table>
          <div className="small text-muted mt-2">
            Lisans kodu Lisans sekmesinden üretilir; son bildiren makine kimliği orada önerilir.
          </div>
        </Col>
        <Col lg={6}>
          <h6 className="text-muted mb-3">Kurulum paketi</h6>
          <p className="small text-muted">
            Bağlantı 7 gün geçerlidir; kurulum dosyası ve firmaya özel firma.lky'yi tek ZIP olarak verir. Müşteriye iletin.
          </p>
          <div className="d-flex flex-wrap gap-2 mb-2">
            <Button
              size="sm"
              className="btn-adm"
              disabled={!!mesgul}
              onClick={() =>
                calistir("baglanti", async () => {
                  setKopyalandi(false);
                  setBaglanti(await adminApi.kurulumBaglantisi(firma.firmaId));
                })
              }
            >
              {mesgul === "baglanti" ? <Spinner animation="border" size="sm" /> : "İndirme Bağlantısı Oluştur"}
            </Button>
            <Button size="sm" variant="outline-secondary" disabled={!!mesgul} onClick={() => calistir("lky", () => adminApi.firmaDosyasiIndir(firma.firmaId))}>
              Yalnız firma.lky İndir
            </Button>
          </div>
          {baglanti && (
            <Form.Group className="mb-3">
              <Form.Control readOnly value={baglanti.adres} onFocus={(e) => e.currentTarget.select()} style={{ fontSize: 12 }} />
              <div className="d-flex justify-content-between align-items-center mt-1">
                <span className="small text-muted">Son geçerlilik: {tarihYaz(baglanti.sonGecerlilik)}</span>
                <Button
                  size="sm"
                  variant="link"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(baglanti.adres);
                      setKopyalandi(true);
                    } catch {
                      setKopyalandi(false);
                    }
                  }}
                >
                  {kopyalandi ? "Kopyalandı" : "Kopyala"}
                </Button>
              </div>
            </Form.Group>
          )}

          <h6 className="text-muted mb-2 mt-4">Hedef sürüm</h6>
          <Form.Select
            size="sm"
            value={firma.hedefSurum || ""}
            disabled={!!mesgul}
            onChange={(e) =>
              calistir("hedef", async () => {
                degisti(await adminApi.hedefSurum(firma.firmaId, e.target.value || null));
              })
            }
          >
            <option value="">En son sürüm ({enSon || "yayında sürüm yok"})</option>
            {surumler.map((s) => (
              <option key={s.surum} value={s.surum}>
                {s.surum}
                {s.aktif ? "" : " (pasif)"}
              </option>
            ))}
          </Form.Select>
          <div className="small text-muted mt-1">
            Belirli bir sürüm seçilirse program o sürüme geçer (geri alma dahil). Güncelleme internet bağlantısında iner, gece 03:00'te uygulanır.
          </div>
        </Col>
      </Row>

      <h6 className="text-muted mb-2">Bildirim geçmişi (son 30)</h6>
      {gecmis.length === 0 ? (
        <div className="text-muted small">Program henüz merkeze bildirim göndermedi.</div>
      ) : (
        <Table size="sm" responsive className="mb-0 small">
          <thead>
            <tr>
              <th>Tarih</th>
              <th>Sürüm</th>
              <th>Makine</th>
              <th>Lisans</th>
              <th>Kullanıcı</th>
              <th>Şema</th>
              <th>IP</th>
            </tr>
          </thead>
          <tbody>
            {gecmis.map((h, i) => (
              <tr key={i}>
                <td>{tarihYaz(h.tarih)}</td>
                <td>{h.surum || "-"}</td>
                <td>
                  <code>{h.makineKimligi || "-"}</code>
                </td>
                <td>
                  {h.lisansDurumu || "-"} {h.kilitNedeni && <Badge bg="danger">{KILIT_ETIKETI[h.kilitNedeni] || h.kilitNedeni}</Badge>}
                </td>
                <td>{h.kullaniciSayisi ?? "-"}</td>
                <td>{h.semaSurumu ?? "-"}</td>
                <td>{h.ip || "-"}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
};

export default FirmaKurulum;
