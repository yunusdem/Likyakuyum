import React, { useCallback, useEffect, useState } from "react";
import { Row, Col, Card, Form, Button, Badge, Alert, Table, Spinner } from "react-bootstrap";
import { IconAlertTriangle, IconCheck, IconPlugConnected } from "@tabler/icons-react";
import ERPToolbar from "../../components/common/ERPToolbar";
import { BankaService, BankaHesapItem } from "../../services/bankaService";
import { EBankaService, EBankaAyar, EBankaLog, EBankaMod } from "../../services/ebankaService";
import EBankaSistemDenetimi from "./EBankaSistemDenetimi";
import EBankaTipKurallari from "./EBankaTipKurallari";

// F- e-Banka > Ayarlar (docs/EBANKA_VOMSIS_YOL_HARITASI.md, Faz 0)

const ETIKET_STILI: React.CSSProperties = { width: "190px", flex: "0 0 190px", maxWidth: "190px" };
const ETIKET_SINIFI = "small fw-bold text-secondary text-start";

const ISLEM_ADLARI: Record<string, string> = {
  "baglanti-testi": "Bağlantı testi",
  "baglanti-testi-vpos": "Bağlantı testi (Sanal POS)",
  esitleme: "Vomsis'ten güncelleme",
  aktarim: "Banka fişine aktarım",
  "pos-esitleme": "POS güncelleme",
  "pos-fis": "POS'tan banka fişi",
  "vpos-link": "Ödeme linki oluşturma",
  "vpos-link-guncelle": "Ödeme linki durumları",
  "vpos-link-sil": "Ödeme linki silme",
  "vpos-islem-guncelle": "Sanal POS işlemleri",
  "vpos-cancel": "Sanal POS iptal",
  "vpos-refund": "Sanal POS iade",
  "vpos-odeme": "Sanal POS kartla ödeme",
  "denetim-deneme-fisi": "Sistem denetimi: deneme fişi",
};

// Sunucu saati yerel duvar saati olarak gelir; saat dilimi çevirisi yapılmaz
const zamanYaz = (z: string | null): string => (z ? z.slice(0, 19).replace("T", " ") : "-");

export const EBankaAyarlarPage: React.FC = () => {
  const [ayar, setAyar] = useState<EBankaAyar | null>(null);
  const [mod, setMod] = useState<EBankaMod>("sahte");
  const [appKey, setAppKey] = useState("");
  const [appSecret, setAppSecret] = useState("");
  const [vposAppKey, setVposAppKey] = useState("");
  const [vposAppSecret, setVposAppSecret] = useState("");
  const [aktarimBaslangic, setAktarimBaslangic] = useState("");
  const [vposBankaId, setVposBankaId] = useState<number | null>(null);

  const [bankalar, setBankalar] = useState<BankaHesapItem[]>([]);
  const [loglar, setLoglar] = useState<EBankaLog[]>([]);
  const [mesgul, setMesgul] = useState<"" | "yukle" | "kaydet" | "banka" | "vpos">("yukle");
  const [notification, setNotification] = useState<{ type: "success" | "danger" | "warning"; message: string } | null>(null);

  const showNotif = (type: "success" | "danger" | "warning", message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 6000);
  };

  const formuDoldur = (a: EBankaAyar) => {
    setAyar(a);
    setMod(a.mod);
    setAppKey(a.appKey);
    setAppSecret("");
    setVposAppKey(a.vposAppKey);
    setVposAppSecret("");
    setAktarimBaslangic(a.aktarimBaslangic || "");
    setVposBankaId(a.vposBankaId);
  };

  const logYukle = useCallback(async () => {
    try {
      setLoglar(await EBankaService.getLog(30));
    } catch {
      /* günlük okunamazsa ekran çalışmaya devam eder */
    }
  }, []);

  const yukle = useCallback(async () => {
    setMesgul("yukle");
    try {
      formuDoldur(await EBankaService.getAyar());
      await logYukle();
      // Banka modülü firmaya kapalıysa hesap listesi gelmez; ayar ekranı yine de açılır
      BankaService.getBankalar({ aktif: true }).then(setBankalar).catch(() => setBankalar([]));
    } catch (err: any) {
      showNotif("danger", err?.message || "Ayarlar okunamadı.");
    } finally {
      setMesgul("");
    }
  }, [logYukle]);

  useEffect(() => {
    yukle();
  }, [yukle]);

  const handleSave = async () => {
    if (mesgul) return;
    setMesgul("kaydet");
    try {
      formuDoldur(
        await EBankaService.saveAyar({
          mod,
          appKey: appKey.trim(),
          appSecret: appSecret.trim() || undefined,
          vposAppKey: vposAppKey.trim(),
          vposAppSecret: vposAppSecret.trim() || undefined,
          aktarimBaslangic: aktarimBaslangic || null,
          vposBankaId,
        })
      );
      showNotif("success", "e-Banka ayarları kaydedildi.");
    } catch (err: any) {
      showNotif("danger", err?.message || "Ayarlar kaydedilemedi.");
    } finally {
      setMesgul("");
    }
  };

  const handleTest = async (servis: "banka" | "vpos") => {
    if (mesgul) return;
    setMesgul(servis);
    try {
      const sonuc = await EBankaService.baglantiTesti(servis);
      showNotif("success", sonuc.ayrinti);
    } catch (err: any) {
      showNotif("danger", err?.message || "Bağlantı kurulamadı.");
    } finally {
      setMesgul("");
      logYukle();
    }
  };

  // Test yalnızca KAYITLI ayarla çalışır; formda kaydedilmemiş değişiklik varsa kullanıcı yanılmasın
  const degisti =
    !!ayar &&
    (mod !== ayar.mod ||
      appKey.trim() !== ayar.appKey ||
      vposAppKey.trim() !== ayar.vposAppKey ||
      !!appSecret ||
      !!vposAppSecret ||
      (aktarimBaslangic || null) !== ayar.aktarimBaslangic ||
      vposBankaId !== ayar.vposBankaId);

  const gizliYerTutucu = (tanimli: boolean) => (tanimli ? "Kayıtlı — değiştirmek için yeni şifreyi yazın" : "");

  return (
    <div className="ebanka-ayarlar-page w-100 pb-3" style={{ overflowX: "hidden" }}>
      <ERPToolbar
        pageTitle="I- e-Banka Ayarları"
        onSave={handleSave}
        onRefresh={yukle}
        hideNew
        hideSearch
        hideDelete
        hideNavigation
        hidePrint
        disabled={!!mesgul}
        modeText="Vomsis Açık Bankacılık"
        rightContent={
          ayar && (
            <Badge bg={ayar.mod === "canli" ? "success" : "warning"} text={ayar.mod === "canli" ? undefined : "dark"} className="px-2 py-1 fs-7">
              {ayar.mod === "canli" ? "Canlı" : "Test (örnek veri)"}
            </Badge>
          )
        }
      />

      {notification && (
        <div className="erp-toast-container">
          <Alert
            variant={notification.type}
            dismissible
            onClose={() => setNotification(null)}
            className="erp-toast-item d-flex align-items-center mb-0 shadow py-2 px-3 border-0"
          >
            {notification.type === "success" ? (
              <IconCheck size={18} className="me-2 text-success flex-shrink-0" />
            ) : (
              <IconAlertTriangle size={18} className="me-2 text-danger flex-shrink-0" />
            )}
            <span style={{ fontSize: "13px" }}>{notification.message}</span>
          </Alert>
        </div>
      )}

      <Card className="border shadow-sm mb-3 w-100 bg-white">
        <Card.Body className="p-3">
          <Row className="g-3">
            <Col lg={6} md={12}>
              <Form.Group as={Row} className="mb-2 align-items-center g-2">
                <Form.Label column style={ETIKET_STILI} className={ETIKET_SINIFI}>
                  Çalışma Modu :
                </Form.Label>
                <Col>
                  <Form.Check
                    inline
                    type="radio"
                    id="ebanka-mod-sahte"
                    name="ebanka-mod"
                    label="Test (örnek veri)"
                    checked={mod === "sahte"}
                    onChange={() => setMod("sahte")}
                    className="small"
                  />
                  <Form.Check
                    inline
                    type="radio"
                    id="ebanka-mod-canli"
                    name="ebanka-mod"
                    label="Canlı"
                    checked={mod === "canli"}
                    onChange={() => setMod("canli")}
                    className="small"
                  />
                </Col>
              </Form.Group>

              <Form.Group as={Row} className="mb-2 align-items-center g-2">
                <Form.Label column style={ETIKET_STILI} className={ETIKET_SINIFI}>
                  API Anahtarı (app_key) :
                </Form.Label>
                <Col>
                  <Form.Control type="text" size="sm" value={appKey} onChange={(e) => setAppKey(e.target.value)} className="font-monospace" autoComplete="off" />
                </Col>
              </Form.Group>

              <Form.Group as={Row} className="mb-2 align-items-center g-2">
                <Form.Label column style={ETIKET_STILI} className={ETIKET_SINIFI}>
                  API Şifresi (app_secret) :
                </Form.Label>
                <Col>
                  <Form.Control
                    type="password"
                    size="sm"
                    value={appSecret}
                    onChange={(e) => setAppSecret(e.target.value)}
                    placeholder={gizliYerTutucu(!!ayar?.appSecretTanimli)}
                    className="font-monospace"
                    autoComplete="new-password"
                  />
                </Col>
              </Form.Group>

              <Form.Group as={Row} className="mb-2 align-items-center g-2">
                <Form.Label column style={ETIKET_STILI} className={ETIKET_SINIFI}>
                  Aktarım Başlangıç Tarihi :
                </Form.Label>
                <Col>
                  <div style={{ maxWidth: "170px" }}>
                    <Form.Control type="date" size="sm" value={aktarimBaslangic} onChange={(e) => setAktarimBaslangic(e.target.value)} />
                  </div>
                  <Form.Text className="text-muted" style={{ fontSize: "11px" }}>
                    Bu tarihten önceki banka hareketleri yalnızca izlenir, fişe aktarılmaz. Boşsa hiçbir hareket aktarılmaz.
                  </Form.Text>
                </Col>
              </Form.Group>
            </Col>

            <Col lg={6} md={12}>
              <Form.Group as={Row} className="mb-2 align-items-center g-2">
                <Form.Label column style={ETIKET_STILI} className={ETIKET_SINIFI}>
                  Sanal POS Anahtarı :
                </Form.Label>
                <Col>
                  <Form.Control
                    type="text"
                    size="sm"
                    value={vposAppKey}
                    onChange={(e) => setVposAppKey(e.target.value)}
                    placeholder="Boşsa yukarıdaki anahtar kullanılır"
                    className="font-monospace"
                    autoComplete="off"
                  />
                </Col>
              </Form.Group>

              <Form.Group as={Row} className="mb-2 align-items-center g-2">
                <Form.Label column style={ETIKET_STILI} className={ETIKET_SINIFI}>
                  Sanal POS Şifresi :
                </Form.Label>
                <Col>
                  <Form.Control
                    type="password"
                    size="sm"
                    value={vposAppSecret}
                    onChange={(e) => setVposAppSecret(e.target.value)}
                    placeholder={gizliYerTutucu(!!ayar?.vposAppSecretTanimli)}
                    disabled={!vposAppKey.trim()}
                    className="font-monospace"
                    autoComplete="new-password"
                  />
                </Col>
              </Form.Group>

              <Form.Group as={Row} className="mb-2 align-items-center g-2">
                <Form.Label column style={ETIKET_STILI} className={ETIKET_SINIFI}>
                  Sanal POS Banka Hesabı :
                </Form.Label>
                <Col>
                  <Form.Select size="sm" value={vposBankaId ?? ""} onChange={(e) => setVposBankaId(e.target.value ? Number(e.target.value) : null)}>
                    <option value="">Seçiniz</option>
                    {bankalar.map((b) => (
                      <option key={b.bankaId} value={b.bankaId}>
                        {b.hesapNo} - {b.hesapAdi}
                      </option>
                    ))}
                  </Form.Select>
                  <Form.Text className="text-muted" style={{ fontSize: "11px" }}>
                    Sanal POS tahsilatları bu hesaba "Havale Alma" fişi olarak işlenir.
                  </Form.Text>
                </Col>
              </Form.Group>
            </Col>
          </Row>

          <hr className="my-3" />

          <div className="d-flex flex-wrap align-items-center gap-2">
            <Button size="sm" variant="outline-primary" disabled={!!mesgul || degisti} onClick={() => handleTest("banka")}>
              {mesgul === "banka" ? <Spinner size="sm" className="me-1" /> : <IconPlugConnected size={16} className="me-1" />}
              Bağlantıyı Sına
            </Button>
            <Button size="sm" variant="outline-primary" disabled={!!mesgul || degisti} onClick={() => handleTest("vpos")}>
              {mesgul === "vpos" ? <Spinner size="sm" className="me-1" /> : <IconPlugConnected size={16} className="me-1" />}
              Sanal POS Bağlantısını Sına
            </Button>
            {degisti && <span className="small text-muted">Bağlantı kayıtlı ayarla sınanır; önce kaydedin.</span>}
          </div>

          <Alert variant="light" className="border small mt-3 mb-0 py-2">
            Vomsis yalnızca kendi panelinde <b>Ayarlar &gt; API Ayarları</b> altında tanımlı IP adreslerinden gelen istekleri kabul eder. Canlı moda
            geçmeden önce bu programın çalıştığı sunucunun sabit IP adresini Vomsis'teki API uygulamanıza ekleyin.
          </Alert>
        </Card.Body>
      </Card>

      <EBankaSistemDenetimi bankalar={bankalar} bildir={showNotif} onGunlukDegisti={logYukle} />

      <EBankaTipKurallari bildir={showNotif} />

      <Card className="border shadow-sm w-100 bg-white">
        <Card.Header className="bg-white py-2 small fw-bold text-secondary">İşlem Günlüğü</Card.Header>
        <Card.Body className="p-0">
          <Table size="sm" hover responsive className="mb-0 small align-middle">
            <thead className="table-light">
              <tr>
                <th style={{ width: "160px" }}>Zaman</th>
                <th style={{ width: "210px" }}>İşlem</th>
                <th style={{ width: "90px" }}>Mod</th>
                <th style={{ width: "90px" }}>Sonuç</th>
                <th>Açıklama</th>
              </tr>
            </thead>
            <tbody>
              {loglar.map((l) => (
                <tr key={l.logId}>
                  <td className="font-monospace">{zamanYaz(l.zaman)}</td>
                  <td>{ISLEM_ADLARI[l.islem] || l.islem}</td>
                  <td>{l.mod === "canli" ? "Canlı" : "Test"}</td>
                  <td>
                    <Badge bg={l.basarili ? "success" : "danger"}>{l.basarili ? "Başarılı" : "Hata"}</Badge>
                  </td>
                  <td>{l.mesaj || ""}</td>
                </tr>
              ))}
              {loglar.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center text-muted py-3">
                    Kayıt yok.
                  </td>
                </tr>
              )}
            </tbody>
          </Table>
        </Card.Body>
      </Card>
    </div>
  );
};

export default EBankaAyarlarPage;
