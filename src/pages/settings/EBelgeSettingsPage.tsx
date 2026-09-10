import React, { useCallback, useEffect, useState } from "react";
import { Alert, Badge, Button, Card, Col, Form, Row, Spinner, Table } from "react-bootstrap";
import {
  IconFileCertificate,
  IconPlugConnected,
  IconAlertTriangle,
  IconCircleCheck,
  IconCircleX,
  IconLock,
} from "@tabler/icons-react";

import ERPToolbar from "../../components/common/ERPToolbar";
import {
  EbelgeAyar,
  EbelgeAyarKaydet,
  EbelgeBaglantiTestSonucu,
  EbelgeLogKaydi,
  ebelgeAdresGecerliMi,
  ebelgeKontorOzet,
  ebelgeService,
  ebelgeTarihSaat,
  ICE_CANLI_URL,
  ICE_TEST_URL,
} from "../../services/ebelgeService";

/**
 * e-Belge (ICE Teknoloji) Bağlantı Ayarları
 *
 * Arayüz kuralları: docs/ice-baglanti.md §15
 *  - font-family / background-color yazılmaz (kullanıcı teması ezilmesin)
 *  - renkler §15.2 sabit ERP paletinden
 *  - sayfa iskeleti §15.4
 */

type AlertInfo = { type: "success" | "danger" | "warning" | "info"; message: string } | null;

const BOS_AYAR: EbelgeAyarKaydet = {
  ortam: "CANLI",
  servisUrl: ICE_CANLI_URL,
  kullaniciAdi: "",
  sifre: "",
  uygulamaAdi: "LikyaKuyumERP",
  uygulamaSurum: "1.0",
  firmaVkn: "",
  firmaAlias: "",
  firmaIl: "",
  firmaIlce: "",
  aktif: false,
};

const EBelgeSettingsPage: React.FC = () => {
  const [form, setForm] = useState<EbelgeAyarKaydet>(BOS_AYAR);
  const [mevcut, setMevcut] = useState<EbelgeAyar | null>(null);
  const [yukleniyor, setYukleniyor] = useState<boolean>(true);
  const [kaydediliyor, setKaydediliyor] = useState<boolean>(false);
  const [testEdiliyor, setTestEdiliyor] = useState<boolean>(false);
  const [testSonucu, setTestSonucu] = useState<EbelgeBaglantiTestSonucu | null>(null);
  const [loglar, setLoglar] = useState<EbelgeLogKaydi[]>([]);
  const [alertInfo, setAlertInfo] = useState<AlertInfo>(null);

  const ayarlariYukle = useCallback(async () => {
    setYukleniyor(true);
    try {
      const ayar = await ebelgeService.getAyar();
      setMevcut(ayar);
      setForm({
        ortam: ayar.ortam,
        servisUrl: ayar.servisUrl,
        kullaniciAdi: ayar.kullaniciAdi,
        sifre: "",
        uygulamaAdi: ayar.uygulamaAdi,
        uygulamaSurum: ayar.uygulamaSurum,
        firmaVkn: ayar.firmaVkn,
        firmaAlias: ayar.firmaAlias,
        firmaIl: ayar.firmaIl ?? "",
        firmaIlce: ayar.firmaIlce ?? "",
        aktif: ayar.aktif,
      });
    } catch (err: any) {
      setAlertInfo({ type: "danger", message: err?.message || "Ayarlar okunamadı." });
    } finally {
      setYukleniyor(false);
    }
  }, []);

  const loglariYukle = useCallback(async () => {
    try {
      setLoglar(await ebelgeService.getLogs(15));
    } catch {
      // Log listesi ikincil bilgi; hata ekranı bozmaz
    }
  }, []);

  useEffect(() => {
    ayarlariYukle();
    loglariYukle();
  }, [ayarlariYukle, loglariYukle]);

  const alanDegistir = <K extends keyof EbelgeAyarKaydet>(alan: K, deger: EbelgeAyarKaydet[K]) => {
    setForm((onceki) => ({ ...onceki, [alan]: deger }));
  };

  const ortamDegistir = (ortam: "CANLI" | "TEST") => {
    setForm((onceki) => ({
      ...onceki,
      ortam,
      servisUrl: ortam === "CANLI" ? ICE_CANLI_URL : ICE_TEST_URL,
    }));
  };

  const adresGecerli = ebelgeAdresGecerliMi(form.servisUrl);
  const sifreVar = Boolean(mevcut?.sifreTanimli) || Boolean(form.sifre && form.sifre.trim());
  const sifrelemeHazir = mevcut?.sifrelemeHazir !== false;

  const handleSave = async () => {
    if (!adresGecerli) {
      setAlertInfo({
        type: "danger",
        message: "Servis adresi https:// ile başlamalı ve *.iceteknoloji.com.tr alan adında olmalıdır.",
      });
      return;
    }
    if (!form.kullaniciAdi.trim()) {
      setAlertInfo({ type: "danger", message: "Entegratör kullanıcı adı zorunludur." });
      return;
    }
    if (form.aktif && !sifreVar) {
      setAlertInfo({ type: "danger", message: "Bağlantıyı etkinleştirmeden önce şifre girilmelidir." });
      return;
    }

    setKaydediliyor(true);
    setAlertInfo(null);
    try {
      const sonuc = await ebelgeService.saveAyar(form);
      setMevcut({ ...sonuc, sifrelemeHazir: mevcut?.sifrelemeHazir ?? true });
      setForm((onceki) => ({ ...onceki, sifre: "" }));
      setTestSonucu(null);
      setAlertInfo({ type: "success", message: "e-Belge bağlantı ayarları kaydedildi." });
      loglariYukle();
    } catch (err: any) {
      setAlertInfo({ type: "danger", message: err?.message || "Ayarlar kaydedilemedi." });
    } finally {
      setKaydediliyor(false);
    }
  };

  const handleTest = async () => {
    setTestEdiliyor(true);
    setTestSonucu(null);
    setAlertInfo(null);
    try {
      const sonuc = await ebelgeService.testBaglanti();
      setTestSonucu(sonuc);
      if (sonuc.girisBasarili) {
        setAlertInfo({ type: "success", message: "Entegratör bağlantısı başarılı." });
      } else if (sonuc.servisAyakta) {
        setAlertInfo({ type: "warning", message: sonuc.hataMesaji || "Servise ulaşıldı, giriş yapılamadı." });
      } else {
        setAlertInfo({ type: "danger", message: sonuc.hataMesaji || "Servise ulaşılamadı." });
      }
      loglariYukle();
    } catch (err: any) {
      setAlertInfo({ type: "danger", message: err?.message || "Bağlantı testi yapılamadı." });
    } finally {
      setTestEdiliyor(false);
    }
  };

  return (
    <div className="ebelge-ayarlari-container container-fluid px-2 py-2">
      <ERPToolbar
        pageTitle="E- Belge Bağlantı Ayarları"
        pageIcon={<IconFileCertificate size={22} className="text-primary" />}
        onSave={handleSave}
        onRefresh={() => {
          ayarlariYukle();
          loglariYukle();
        }}
        onPrint={() => window.print()}
        disabled={yukleniyor || kaydediliyor || testEdiliyor}
      />

      {alertInfo && (
        <Alert
          variant={alertInfo.type}
          dismissible
          onClose={() => setAlertInfo(null)}
          className="py-2 px-3 mb-3 border rounded shadow-2xs small fw-medium"
        >
          {alertInfo.message}
        </Alert>
      )}

      {!sifrelemeHazir && (
        <Alert variant="warning" className="py-2 px-3 mb-3 border rounded shadow-2xs small">
          <IconAlertTriangle size={16} className="me-1" />
          Sunucuda <code>EBELGE_ENC_KEY</code> tanımlı değil. Şifre düz metin saklanmayacağı için
          kaydedilemez. Sunucudaki <code>.env</code> dosyasına 32 baytlık bir anahtar ekleyiniz.
        </Alert>
      )}

      <Card className="shadow-sm border border-secondary-subtle rounded-3 overflow-hidden mb-3">
        <Card.Body className="p-3 bg-body">
          {yukleniyor ? (
            <div className="d-flex align-items-center gap-2 py-4 justify-content-center">
              <Spinner animation="border" size="sm" />
              <span className="small text-secondary">Ayarlar yükleniyor…</span>
            </div>
          ) : (
            <Row className="g-3">
              <Col xs={12} lg={7}>
                <div className="border rounded-2 p-3 h-100 shadow-2xs">
                  <div className="d-flex align-items-center justify-content-between mb-3">
                    <span className="fw-semibold" style={{ fontSize: "13px" }}>
                      Entegratör Bağlantısı (ICE Teknoloji)
                    </span>
                    <Badge bg={form.aktif ? "success-subtle" : "secondary-subtle"} text={form.aktif ? "success" : "secondary"}>
                      {form.aktif ? "Aktif" : "Pasif"}
                    </Badge>
                  </div>

                  <Row className="g-2">
                    <Col xs={12} md={4}>
                      <Form.Label className="small mb-1">Ortam</Form.Label>
                      <Form.Select
                        size="sm"
                        value={form.ortam}
                        onChange={(e) => ortamDegistir(e.target.value as "CANLI" | "TEST")}
                      >
                        <option value="CANLI">Canlı</option>
                        <option value="TEST">Test</option>
                      </Form.Select>
                    </Col>

                    <Col xs={12} md={8}>
                      <Form.Label className="small mb-1">Servis Adresi</Form.Label>
                      <Form.Control
                        size="sm"
                        value={form.servisUrl}
                        onChange={(e) => alanDegistir("servisUrl", e.target.value)}
                        isInvalid={Boolean(form.servisUrl) && !adresGecerli}
                        placeholder={ICE_CANLI_URL}
                      />
                      <Form.Control.Feedback type="invalid" className="small">
                        Adres https:// ile başlamalı ve *.iceteknoloji.com.tr alan adında olmalıdır.
                      </Form.Control.Feedback>
                    </Col>

                    <Col xs={12} md={6}>
                      <Form.Label className="small mb-1">Kullanıcı Adı</Form.Label>
                      <Form.Control
                        size="sm"
                        value={form.kullaniciAdi}
                        onChange={(e) => alanDegistir("kullaniciAdi", e.target.value)}
                        autoComplete="off"
                      />
                    </Col>

                    <Col xs={12} md={6}>
                      <Form.Label className="small mb-1">
                        Şifre
                        {mevcut?.sifreTanimli && (
                          <span className="ms-1 text-secondary" style={{ fontSize: "11.5px" }}>
                            (kayıtlı — değiştirmek için yazın)
                          </span>
                        )}
                      </Form.Label>
                      <Form.Control
                        size="sm"
                        type="password"
                        value={form.sifre || ""}
                        onChange={(e) => alanDegistir("sifre", e.target.value)}
                        placeholder={mevcut?.sifreTanimli ? "••••••••" : "Entegratör şifresi"}
                        autoComplete="new-password"
                        disabled={!sifrelemeHazir}
                      />
                      <div className="d-flex align-items-center gap-1 mt-1 text-secondary" style={{ fontSize: "11.5px" }}>
                        <IconLock size={12} />
                        Şifre sunucuda AES-256-GCM ile şifreli saklanır, ekrana geri gönderilmez.
                      </div>
                    </Col>

                    <Col xs={12} md={6}>
                      <Form.Label className="small mb-1">Firma VKN / TCKN</Form.Label>
                      <Form.Control
                        size="sm"
                        value={form.firmaVkn}
                        maxLength={11}
                        onChange={(e) => alanDegistir("firmaVkn", e.target.value.replace(/\D/g, ""))}
                        className="font-monospace"
                      />
                    </Col>

                    <Col xs={12} md={6}>
                      <Form.Label className="small mb-1">Gönderici Etiketi (Alias)</Form.Label>
                      <Form.Control
                        size="sm"
                        value={form.firmaAlias}
                        onChange={(e) => alanDegistir("firmaAlias", e.target.value)}
                        placeholder="urn:mail:defaultgb@..."
                      />
                    </Col>

                    <Col xs={12} md={6}>
                      <Form.Label className="small mb-1">Firma İl</Form.Label>
                      <Form.Control
                        size="sm"
                        value={form.firmaIl}
                        maxLength={50}
                        onChange={(e) => alanDegistir("firmaIl", e.target.value)}
                        placeholder="Denizli"
                      />
                    </Col>

                    <Col xs={12} md={6}>
                      <Form.Label className="small mb-1">Firma İlçe</Form.Label>
                      <Form.Control
                        size="sm"
                        value={form.firmaIlce}
                        maxLength={50}
                        onChange={(e) => alanDegistir("firmaIlce", e.target.value)}
                        placeholder="Pamukkale"
                      />
                      <div className="text-muted mt-1" style={{ fontSize: "0.72rem" }}>
                        UBL-TR adres kuralı gereği il ve ilçe zorunludur; boş bırakılırsa belge
                        şema doğrulamasından geçmez.
                      </div>
                    </Col>

                    <Col xs={12} md={6}>
                      <Form.Label className="small mb-1">Uygulama Adı</Form.Label>
                      <Form.Control
                        size="sm"
                        value={form.uygulamaAdi}
                        onChange={(e) => alanDegistir("uygulamaAdi", e.target.value)}
                      />
                    </Col>

                    <Col xs={12} md={6}>
                      <Form.Label className="small mb-1">Uygulama Sürümü</Form.Label>
                      <Form.Control
                        size="sm"
                        value={form.uygulamaSurum}
                        onChange={(e) => alanDegistir("uygulamaSurum", e.target.value)}
                      />
                    </Col>

                    <Col xs={12}>
                      <Form.Check
                        type="switch"
                        id="ebelge-aktif"
                        className="mt-1"
                        label="Bağlantı aktif (e-Belge işlemleri bu ayarlarla yapılsın)"
                        checked={form.aktif}
                        onChange={(e) => alanDegistir("aktif", e.currentTarget.checked)}
                      />
                    </Col>
                  </Row>

                  <div className="d-flex flex-wrap align-items-center gap-2 mt-3">
                    <Button size="sm" variant="primary" onClick={handleSave} disabled={kaydediliyor}>
                      {kaydediliyor ? <Spinner animation="border" size="sm" className="me-1" /> : null}
                      Kaydet (F1)
                    </Button>
                    <Button
                      size="sm"
                      variant="outline-secondary"
                      onClick={handleTest}
                      disabled={testEdiliyor || !form.servisUrl}
                      className="d-flex align-items-center gap-1"
                    >
                      {testEdiliyor ? (
                        <Spinner animation="border" size="sm" />
                      ) : (
                        <IconPlugConnected size={16} />
                      )}
                      Bağlantıyı Test Et
                    </Button>
                    {mevcut?.guncellemeTarihi && (
                      <span className="text-secondary small ms-auto">
                        Son güncelleme: {ebelgeTarihSaat(mevcut.guncellemeTarihi)}
                        {mevcut.guncelleyen ? ` · ${mevcut.guncelleyen}` : ""}
                      </span>
                    )}
                  </div>
                </div>
              </Col>

              <Col xs={12} lg={5}>
                <div className="border rounded-2 p-3 h-100 shadow-2xs">
                  <div className="fw-semibold mb-3" style={{ fontSize: "13px" }}>
                    Bağlantı Durumu
                  </div>

                  {!testSonucu ? (
                    <div className="text-secondary small">
                      Henüz test yapılmadı. <strong>Bağlantıyı Test Et</strong> düğmesi önce servisin
                      ayakta olup olmadığını sorar (giriş denemeden), sonra giriş yapıp kalan kontörü okur.
                    </div>
                  ) : (
                    <div className="d-flex flex-column gap-2">
                      <div className="d-flex align-items-center gap-2">
                        {testSonucu.servisAyakta ? (
                          <IconCircleCheck size={18} style={{ color: "#22c55e" }} />
                        ) : (
                          <IconCircleX size={18} style={{ color: "#dc2626" }} />
                        )}
                        <span className="small">
                          Servis: {testSonucu.servisAyakta ? `ayakta (${testSonucu.healthCevabi})` : "ulaşılamadı"}
                        </span>
                      </div>

                      <div className="d-flex align-items-center gap-2">
                        {testSonucu.girisBasarili ? (
                          <IconCircleCheck size={18} style={{ color: "#22c55e" }} />
                        ) : (
                          <IconCircleX size={18} style={{ color: "#dc2626" }} />
                        )}
                        <span className="small">
                          Giriş: {testSonucu.girisBasarili ? "başarılı" : "yapılamadı"}
                        </span>
                      </div>

                      {testSonucu.hataliDenemeSayisi !== null && testSonucu.hataliDenemeSayisi > 0 && (
                        <Alert variant="danger" className="py-2 px-2 mb-0 small">
                          <IconAlertTriangle size={14} className="me-1" />
                          Hatalı deneme sayısı: {testSonucu.hataliDenemeSayisi}. Hesabın kilitlenmemesi
                          için otomatik denemeler durduruldu; şifreyi güncelleyip yeniden kaydedin.
                        </Alert>
                      )}

                      {testSonucu.girisBasarili && (
                        <div className="border-top pt-2">
                          <div className="text-secondary" style={{ fontSize: "11.5px" }}>
                            Kalan kontör
                          </div>
                          <div className="small">{ebelgeKontorOzet(testSonucu.kontor)}</div>
                        </div>
                      )}

                      {testSonucu.hataMesaji && !testSonucu.girisBasarili && (
                        <div className="small" style={{ color: "#dc2626" }}>
                          {testSonucu.hataMesaji}
                        </div>
                      )}

                      <div className="text-secondary" style={{ fontSize: "11.5px" }}>
                        Süre: {testSonucu.sureMs} ms
                      </div>
                    </div>
                  )}
                </div>
              </Col>
            </Row>
          )}
        </Card.Body>
      </Card>

      <Card className="shadow-sm border border-secondary-subtle rounded-3 overflow-hidden">
        <Card.Body className="p-3 bg-body">
          <div className="fw-semibold mb-2" style={{ fontSize: "13px" }}>
            Son Entegratör İşlemleri
          </div>
          <div className="table-responsive">
            <Table className="table table-sm custom-document-table mb-0" hover>
              <thead>
                <tr>
                  <th style={{ width: "150px" }}>Tarih</th>
                  <th style={{ width: "160px" }}>İşlem</th>
                  <th style={{ width: "90px" }}>Sonuç</th>
                  <th style={{ width: "90px" }}>Süre</th>
                  <th>Açıklama</th>
                  <th style={{ width: "120px" }}>Kullanıcı</th>
                </tr>
              </thead>
              <tbody>
                {loglar.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center text-secondary py-3 small">
                      Kayıt yok.
                    </td>
                  </tr>
                ) : (
                  loglar.map((log) => (
                    <tr key={log.id}>
                      <td className="font-monospace">{ebelgeTarihSaat(log.tarih)}</td>
                      <td>{log.metod}</td>
                      <td>
                        <Badge
                          bg={log.basarili ? "success-subtle" : "danger-subtle"}
                          text={log.basarili ? "success" : "danger"}
                        >
                          {log.basarili ? "Başarılı" : "Hata"}
                        </Badge>
                      </td>
                      <td className="font-monospace">{log.sureMs != null ? `${log.sureMs} ms` : "-"}</td>
                      <td className="text-truncate" style={{ maxWidth: "320px" }} title={log.hataMesaji || ""}>
                        {log.hataMesaji || "-"}
                      </td>
                      <td>{log.kullanici || "-"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </Table>
          </div>
        </Card.Body>
      </Card>
    </div>
  );
};

export default EBelgeSettingsPage;
