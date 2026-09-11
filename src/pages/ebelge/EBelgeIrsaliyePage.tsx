import React, { useEffect, useState } from "react";
import { Alert, Badge, Button, Card, Col, Form, Row, Spinner, Table } from "react-bootstrap";
import {
  IconTruckDelivery,
  IconPlus,
  IconTrash,
  IconFileCheck,
  IconSend,
  IconCircleCheck,
  IconCircleX,
  IconAlertTriangle,
  IconShieldCheck,
  IconFileTypePdf,
  IconExternalLink,
} from "@tabler/icons-react";

import ERPToolbar from "../../components/common/ERPToolbar";
import {
  EBELGE_BIRIMLER,
  EbelgeIrsaliyeDogrulama,
  EbelgeIrsaliyeSatiri,
  EbelgeIrsaliyeTipi,
  EbelgePlakaTuru,
  ebelgeService,
} from "../../services/ebelgeService";

/**
 * E-İrsaliye (Faz 9)
 *
 * İrsaliyede **tutar yoktur** — yalnızca sevk edilen miktar, mal bilgisi ve
 * taşıma bilgileri taşınır. Bu yüzden ekranda fiyat/KDV alanı bulunmaz.
 *
 * Akış e-Fatura ile aynı: önce **doğrula** (belge gönderilmez), sonra istenirse gönder.
 *
 * Arayüz kuralları: docs/ice-baglanti.md §15
 */

type AlertInfo = { type: "success" | "danger" | "warning" | "info"; message: string } | null;

const bugunISO = () => new Date().toISOString().slice(0, 10);

const BOS_SATIR: EbelgeIrsaliyeSatiri = { ad: "", miktar: 1, birimKodu: "C62" };

const EBelgeIrsaliyePage: React.FC = () => {
  const [belgeNo, setBelgeNo] = useState<string>("");
  const [tarih, setTarih] = useState<string>(bugunISO());
  const [irsaliyeTipi, setIrsaliyeTipi] = useState<EbelgeIrsaliyeTipi>("SEVK");
  const [not, setNot] = useState<string>("");

  const [aliciVkn, setAliciVkn] = useState<string>("");
  const [aliciUnvan, setAliciUnvan] = useState<string>("");
  const [aliciAd, setAliciAd] = useState<string>("");
  const [aliciSoyad, setAliciSoyad] = useState<string>("");
  const [aliciIl, setAliciIl] = useState<string>("");
  const [aliciIlce, setAliciIlce] = useState<string>("");
  const [teslimatPostaKodu, setTeslimatPostaKodu] = useState<string>("");

  const [sevkTarihi, setSevkTarihi] = useState<string>(bugunISO());
  const [sevkSaati, setSevkSaati] = useState<string>("");
  const [plaka, setPlaka] = useState<string>("");
  const [plakaTuru, setPlakaTuru] = useState<EbelgePlakaTuru>("PLAKA");
  const [soforAd, setSoforAd] = useState<string>("");
  const [soforSoyad, setSoforSoyad] = useState<string>("");
  const [soforTckn, setSoforTckn] = useState<string>("");
  const [tasiyiciVkn, setTasiyiciVkn] = useState<string>("");
  const [tasiyiciUnvan, setTasiyiciUnvan] = useState<string>("");

  const [satirlar, setSatirlar] = useState<EbelgeIrsaliyeSatiri[]>([{ ...BOS_SATIR }]);

  const [dogrulaniyor, setDogrulaniyor] = useState<boolean>(false);
  const [gonderiliyor, setGonderiliyor] = useState<boolean>(false);
  const [onayAcik, setOnayAcik] = useState<boolean>(false);
  const [sonuc, setSonuc] = useState<EbelgeIrsaliyeDogrulama | null>(null);
  const [gonderildi, setGonderildi] = useState<{ belgeNo: string; uuid: string } | null>(null);
  const [alertInfo, setAlertInfo] = useState<AlertInfo>(null);
  const [mukellefDurum, setMukellefDurum] = useState<string | null>(null);
  const [pdfYukleniyor, setPdfYukleniyor] = useState<boolean>(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  // Blob adresini sayfa kapanınca bırak
  useEffect(
    () => () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    },
    [pdfUrl]
  );

  const kilitli = dogrulaniyor || gonderiliyor || Boolean(gonderildi);

  const satirDegistir = <K extends keyof EbelgeIrsaliyeSatiri>(
    i: number,
    alan: K,
    deger: EbelgeIrsaliyeSatiri[K]
  ) => {
    setSatirlar((o) => o.map((s, idx) => (idx === i ? { ...s, [alan]: deger } : s)));
    // Form değişince eski doğrulama geçersizdir
    setSonuc(null);
    setOnayAcik(false);
  };

  /** Form değiştiğinde doğrulamayı geçersiz kıl */
  const degisti = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v);
    setSonuc(null);
    setOnayAcik(false);
  };

  const istekGovdesi = () => ({
    belgeNo: belgeNo.trim().toUpperCase(),
    tarih,
    irsaliyeTipi,
    notlar: not.trim() ? [not.trim()] : undefined,
    alici: {
      vknTckn: aliciVkn.trim(),
      unvan: aliciUnvan.trim() || undefined,
      ad: aliciAd.trim() || undefined,
      soyad: aliciSoyad.trim() || undefined,
      il: aliciIl.trim() || undefined,
      ilce: aliciIlce.trim() || undefined,
    },
    satirlar,
    sevkiyat: {
      sevkTarihi,
      sevkSaati,
      teslimatAdresi: { postaKodu: teslimatPostaKodu.trim() },
      plaka: plaka.trim(),
      plakaTuru,
      soforler:
        soforAd.trim() && soforSoyad.trim()
          ? [{ ad: soforAd.trim(), soyad: soforSoyad.trim(), tckn: soforTckn.trim() || undefined }]
          : undefined,
      tasiyici:
        tasiyiciVkn.trim() && tasiyiciUnvan.trim()
          ? { vknTckn: tasiyiciVkn.trim(), unvan: tasiyiciUnvan.trim() }
          : undefined,
    },
  });

  const onKontrol = (): string | null => {
    if (!belgeNo.trim()) return "İrsaliye numarası zorunludur.";
    if (!aliciVkn.trim()) return "Alıcı VKN/TCKN zorunludur.";
    if (!/^\d{10,11}$/.test(aliciVkn.trim())) return "Alıcı VKN 10, TCKN 11 haneli olmalıdır.";
    if (aliciVkn.trim().length === 11 && (!aliciAd.trim() || !aliciSoyad.trim()))
      return "Alıcı TCKN ile tanımlandığında Alıcı Ad ve Alıcı Soyad alanları zorunludur. Şoför bilgileri ayrı tutulur.";
    if (!aliciUnvan.trim() && !(aliciAd.trim() && aliciSoyad.trim()))
      return "Alıcı için unvan ya da ad ve soyad giriniz.";
    if (satirlar.some((s) => !s.ad.trim())) return "Her satırda mal adı bulunmalıdır.";
    if (satirlar.some((s) => !(s.miktar > 0))) return "Her satırda sevk miktarı sıfırdan büyük olmalıdır.";
    if (!sevkTarihi) return "Fiili sevk tarihi zorunludur.";
    if (!/^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/.test(sevkSaati))
      return "Geçerli fiili sevk saati giriniz.";
    if (!/^\d{5}$/.test(teslimatPostaKodu.trim()))
      return "Teslimat posta kodu 5 haneli olmalıdır.";
    if (sevkTarihi < tarih) return "Fiili sevk tarihi, düzenleme tarihinden önce olamaz.";
    if (!plaka.trim()) return "Plaka/dorse bilgisi zorunludur.";
    if (plaka.trim().length > 50 || !/^[A-Z0-9 -]+$/i.test(plaka.trim()))
      return "Plaka/dorse en fazla 50 karakter olmalı; yalnızca harf, rakam, boşluk ve tire içermelidir.";
    return null;
  };

  const dogrula = async () => {
    const hata = onKontrol();
    if (hata) return setAlertInfo({ type: "danger", message: hata });

    setAlertInfo(null);
    setSonuc(null);
    setDogrulaniyor(true);
    try {
      const cevap = await ebelgeService.irsaliyeDogrula({ ...istekGovdesi(), onizleme: true });
      setSonuc(cevap);
      setAlertInfo(
        cevap.semaGecerli && cevap.schematronGecerli
          ? { type: "success", message: "İrsaliye doğrulamadan geçti. Hiçbir belge gönderilmedi." }
          : { type: "warning", message: cevap.mesaj || "İrsaliye doğrulamadan geçemedi." }
      );
    } catch (err: any) {
      setAlertInfo({ type: "danger", message: err?.message || "Doğrulama yapılamadı." });
    } finally {
      setDogrulaniyor(false);
    }
  };

  const gonder = async () => {
    setAlertInfo(null);
    setGonderiliyor(true);
    try {
      const cevap = await ebelgeService.irsaliyeGonder(istekGovdesi());
      setGonderildi({ belgeNo: cevap.belgeNo, uuid: cevap.uuid });
      setOnayAcik(false);
      setAlertInfo({
        type: "success",
        message:
          `e-İrsaliye GİB'e gönderildi (${cevap.belgeNo}).` +
          (cevap.kontorUyari ? ` ${cevap.kontorUyari}` : ""),
      });
    } catch (err: any) {
      setAlertInfo({ type: "danger", message: err?.message || "İrsaliye gönderilemedi." });
    } finally {
      setGonderiliyor(false);
    }
  };

  /** Gönderilmiş irsaliyenin PDF'ini yeni sekmede açar */
  const pdfAc = async () => {
    if (!gonderildi) return;
    setPdfYukleniyor(true);
    setAlertInfo(null);
    try {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
      const url = await ebelgeService.getIrsaliyePdfBlobUrl(gonderildi.uuid);
      setPdfUrl(url);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err: any) {
      setAlertInfo({ type: "danger", message: err?.message || "PDF açılamadı." });
    } finally {
      setPdfYukleniyor(false);
    }
  };

  const mukellefSorgula = async () => {
    if (!aliciVkn.trim()) return;
    setMukellefDurum(null);
    try {
      const cevap = await ebelgeService.irsaliyeMukellef(aliciVkn.trim());
      setMukellefDurum(
        cevap.mukellefMi
          ? `e-İrsaliye mükellefi (${cevap.kullanicilar.length} etiket)`
          : "e-İrsaliye mükellefi değil — kâğıt irsaliye düzenlenmeli"
      );
    } catch (err: any) {
      setMukellefDurum(err?.message || "Sorgulanamadı");
    }
  };

  const gonderilebilir = Boolean(sonuc?.semaGecerli && sonuc?.schematronGecerli && !gonderildi);

  return (
    <div className="ebelge-irsaliye-container container-fluid px-2 py-2">
      <ERPToolbar
        pageTitle="E- İrsaliye"
        pageIcon={<IconTruckDelivery size={22} className="text-primary" />}
        onSave={dogrula}
        onNew={() => {
          setBelgeNo("");
          setSatirlar([{ ...BOS_SATIR }]);
          setSonuc(null);
          setGonderildi(null);
          setOnayAcik(false);
          setAlertInfo(null);
        }}
        onPrint={() => window.print()}
        disabled={kilitli}
      />

      <Alert variant="info" className="py-2 px-3 mb-3 border rounded shadow-2xs small">
        <IconShieldCheck size={15} className="me-1" />
        <strong>İrsaliyede tutar yoktur</strong> — yalnızca sevk edilen miktar ve taşıma bilgisi
        bildirilir. Önce <strong>doğrulama</strong> yapılır (belge gönderilmez), sonra istenirse
        GİB'e gönderilir.
      </Alert>

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

      <Card className="shadow-sm border border-secondary-subtle rounded-3 overflow-hidden mb-3">
        <Card.Body className="p-3 bg-body">
          <div className="fw-semibold mb-2" style={{ fontSize: "13px" }}>
            Belge Bilgileri
          </div>
          <Row className="g-2">
            <Col xs={12} md={4} lg={3}>
              <Form.Label className="small mb-1">İrsaliye No</Form.Label>
              <Form.Control
                size="sm"
                className="font-monospace"
                placeholder="ABC2026000000001"
                maxLength={16}
                value={belgeNo}
                disabled={kilitli}
                onChange={(e) => degisti(setBelgeNo)(e.target.value.toUpperCase())}
              />
              <div className="text-secondary" style={{ fontSize: "11.5px" }}>
                3 harf seri + 13 hane
              </div>
            </Col>
            <Col xs={6} md={3} lg={2}>
              <Form.Label className="small mb-1">Düzenleme Tarihi</Form.Label>
              <Form.Control
                size="sm"
                type="date"
                className="custom-date-input"
                value={tarih}
                disabled={kilitli}
                onChange={(e) => degisti(setTarih)(e.target.value)}
              />
            </Col>
            <Col xs={6} md={3} lg={2}>
              <Form.Label className="small mb-1">İrsaliye Tipi</Form.Label>
              <Form.Select
                size="sm"
                value={irsaliyeTipi}
                disabled={kilitli}
                onChange={(e) => degisti(setIrsaliyeTipi)(e.target.value as EbelgeIrsaliyeTipi)}
              >
                <option value="SEVK">Sevk</option>
                <option value="MATBUDAN">Matbudan Elektronik Ortama</option>
              </Form.Select>
            </Col>
            <Col xs={12} lg={5}>
              <Form.Label className="small mb-1">Not</Form.Label>
              <Form.Control
                size="sm"
                maxLength={200}
                value={not}
                disabled={kilitli}
                onChange={(e) => degisti(setNot)(e.target.value)}
              />
            </Col>
          </Row>

          <div className="fw-semibold mt-3 mb-2" style={{ fontSize: "13px" }}>
            Alıcı
          </div>
          <Row className="g-2">
            <Col xs={6} md={3} lg={2}>
              <Form.Label className="small mb-1">VKN / TCKN</Form.Label>
              <div className="d-flex gap-1">
                <Form.Control
                  size="sm"
                  className="font-monospace"
                  maxLength={11}
                  value={aliciVkn}
                  disabled={kilitli}
                  onChange={(e) => degisti(setAliciVkn)(e.target.value.replace(/\D/g, ""))}
                />
                <Button
                  size="sm"
                  variant="outline-secondary"
                  onClick={mukellefSorgula}
                  disabled={kilitli || !aliciVkn.trim()}
                  title="e-İrsaliye mükellefi mi?"
                >
                  ?
                </Button>
              </div>
              {mukellefDurum && (
                <div className="text-secondary" style={{ fontSize: "11.5px" }}>
                  {mukellefDurum}
                </div>
              )}
            </Col>
            <Col xs={12} md={5} lg={4}>
              <Form.Label className="small mb-1">Unvan (TCKN için isteğe bağlı)</Form.Label>
              <Form.Control
                size="sm"
                value={aliciUnvan}
                disabled={kilitli}
                onChange={(e) => degisti(setAliciUnvan)(e.target.value)}
              />
            </Col>
            <Col xs={6} md={3}>
              <Form.Group controlId="irsaliye-alici-ad">
                <Form.Label className="small mb-1">Alıcı Ad{aliciVkn.trim().length === 11 ? " *" : ""}</Form.Label>
                <Form.Control
                  size="sm"
                  value={aliciAd}
                  disabled={kilitli}
                  required={aliciVkn.trim().length === 11}
                  onChange={(e) => degisti(setAliciAd)(e.target.value)}
                />
              </Form.Group>
            </Col>
            <Col xs={6} md={3}>
              <Form.Group controlId="irsaliye-alici-soyad">
                <Form.Label className="small mb-1">Alıcı Soyad{aliciVkn.trim().length === 11 ? " *" : ""}</Form.Label>
                <Form.Control
                  size="sm"
                  value={aliciSoyad}
                  disabled={kilitli}
                  required={aliciVkn.trim().length === 11}
                  onChange={(e) => degisti(setAliciSoyad)(e.target.value)}
                />
              </Form.Group>
            </Col>
            <Col xs={6} md={2}>
              <Form.Label className="small mb-1">İl</Form.Label>
              <Form.Control
                size="sm"
                value={aliciIl}
                disabled={kilitli}
                onChange={(e) => degisti(setAliciIl)(e.target.value)}
              />
            </Col>
            <Col xs={6} md={2}>
              <Form.Label className="small mb-1">İlçe</Form.Label>
              <Form.Control
                size="sm"
                value={aliciIlce}
                disabled={kilitli}
                onChange={(e) => degisti(setAliciIlce)(e.target.value)}
              />
            </Col>
            <Col xs={6} md={3}>
              <Form.Group controlId="irsaliye-teslimat-posta-kodu">
                <Form.Label className="small mb-1">Teslimat Posta Kodu *</Form.Label>
                <Form.Control
                  size="sm"
                  inputMode="numeric"
                  maxLength={5}
                  value={teslimatPostaKodu}
                  disabled={kilitli}
                  required
                  onChange={(e) => degisti(setTeslimatPostaKodu)(e.target.value.replace(/\D/g, ""))}
                />
                <Form.Text>Teslimat için alıcının il ve ilçesi kullanılır.</Form.Text>
              </Form.Group>
            </Col>
          </Row>

          <div className="fw-semibold mt-3 mb-2" style={{ fontSize: "13px" }}>
            Sevkiyat
          </div>
          <Row className="g-2">
            <Col xs={6} md={3} lg={2}>
              <Form.Label className="small mb-1">
                Fiili Sevk Tarihi <span style={{ color: "#dc2626" }}>*</span>
              </Form.Label>
              <Form.Control
                size="sm"
                type="date"
                className="custom-date-input"
                value={sevkTarihi}
                disabled={kilitli}
                onChange={(e) => degisti(setSevkTarihi)(e.target.value)}
              />
            </Col>
            <Col xs={6} md={2} lg={2}>
              <Form.Label className="small mb-1">Sevk Saati *</Form.Label>
              <Form.Control
                size="sm"
                type="time"
                step={1}
                value={sevkSaati}
                disabled={kilitli}
                onChange={(e) =>
                  degisti(setSevkSaati)(e.target.value.length === 5 ? `${e.target.value}:00` : e.target.value)
                }
              />
            </Col>
            <Col xs={6} md={3} lg={2}>
              <Form.Label className="small mb-1">Plaka / Dorse Türü *</Form.Label>
              <Form.Select
                size="sm"
                value={plakaTuru}
                disabled={kilitli}
                onChange={(e) => degisti(setPlakaTuru)(e.target.value as EbelgePlakaTuru)}
              >
                <option value="PLAKA">Yerli araç plakası</option>
                <option value="DORSE">Yerli dorse</option>
                <option value="DORSEPLAKA">Yerli araç + dorse</option>
                <option value="YABANCIPLAKA">Yabancı araç plakası</option>
                <option value="YABANCIDORSE">Yabancı dorse</option>
                <option value="YABANCIDORSEPLAKA">Yabancı araç + dorse</option>
              </Form.Select>
            </Col>
            <Col xs={6} md={3} lg={2}>
              <Form.Label className="small mb-1">Plaka / Dorse *</Form.Label>
              <Form.Control
                size="sm"
                className="font-monospace"
                placeholder="07 ABC 123"
                value={plaka}
                maxLength={50}
                required
                disabled={kilitli}
                onChange={(e) => degisti(setPlaka)(e.target.value.toUpperCase())}
              />
            </Col>
            <Col xs={6} md={4} lg={3}>
              <Form.Label className="small mb-1">Şoför (Ad / Soyad / TCKN)</Form.Label>
              <div className="d-flex gap-1">
                <Form.Control
                  size="sm"
                  placeholder="Ad"
                  value={soforAd}
                  disabled={kilitli}
                  onChange={(e) => degisti(setSoforAd)(e.target.value)}
                />
                <Form.Control
                  size="sm"
                  placeholder="Soyad"
                  value={soforSoyad}
                  disabled={kilitli}
                  onChange={(e) => degisti(setSoforSoyad)(e.target.value)}
                />
                <Form.Control
                  size="sm"
                  className="font-monospace"
                  placeholder="TCKN"
                  maxLength={11}
                  value={soforTckn}
                  disabled={kilitli}
                  onChange={(e) => degisti(setSoforTckn)(e.target.value.replace(/\D/g, ""))}
                />
              </div>
            </Col>
            <Col xs={12} md={5} lg={3}>
              <Form.Label className="small mb-1">Taşıyıcı Firma (VKN / Unvan)</Form.Label>
              <div className="d-flex gap-1">
                <Form.Control
                  size="sm"
                  className="font-monospace"
                  placeholder="VKN"
                  maxLength={11}
                  value={tasiyiciVkn}
                  disabled={kilitli}
                  onChange={(e) => degisti(setTasiyiciVkn)(e.target.value.replace(/\D/g, ""))}
                />
                <Form.Control
                  size="sm"
                  placeholder="Unvan"
                  value={tasiyiciUnvan}
                  disabled={kilitli}
                  onChange={(e) => degisti(setTasiyiciUnvan)(e.target.value)}
                />
              </div>
              <div className="text-secondary" style={{ fontSize: "11.5px" }}>
                Plaka/dorse zorunludur; türü GİB schemeID alanına aktarılır
              </div>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      <Card className="shadow-sm border border-secondary-subtle rounded-3 overflow-hidden mb-3">
        <Card.Body className="p-3 bg-body">
          <div className="d-flex align-items-center justify-content-between mb-2">
            <span className="fw-semibold" style={{ fontSize: "13px" }}>
              Sevk Edilen Mallar
            </span>
            <Button
              size="sm"
              variant="outline-secondary"
              disabled={kilitli}
              onClick={() => setSatirlar((o) => [...o, { ...BOS_SATIR }])}
              className="d-flex align-items-center gap-1"
            >
              <IconPlus size={15} />
              Satır Ekle
            </Button>
          </div>

          <div className="table-responsive">
            <Table className="table table-sm custom-document-table mb-0">
              <thead>
                <tr>
                  <th style={{ width: "40px" }}>#</th>
                  <th>Mal Adı</th>
                  <th style={{ width: "120px" }}>Stok Kodu</th>
                  <th style={{ width: "120px" }}>Marka</th>
                  <th style={{ width: "110px" }}>Miktar</th>
                  <th style={{ width: "120px" }}>Birim</th>
                  <th style={{ width: "50px" }} />
                </tr>
              </thead>
              <tbody>
                {satirlar.map((satir, i) => (
                  <tr key={i}>
                    <td className="text-secondary">{i + 1}</td>
                    <td>
                      <Form.Control
                        size="sm"
                        placeholder="Örn: 22 Ayar Bilezik"
                        value={satir.ad}
                        disabled={kilitli}
                        onChange={(e) => satirDegistir(i, "ad", e.target.value)}
                      />
                    </td>
                    <td>
                      <Form.Control
                        size="sm"
                        className="font-monospace"
                        value={satir.stokKodu || ""}
                        disabled={kilitli}
                        onChange={(e) => satirDegistir(i, "stokKodu", e.target.value)}
                      />
                    </td>
                    <td>
                      <Form.Control
                        size="sm"
                        value={satir.marka || ""}
                        disabled={kilitli}
                        onChange={(e) => satirDegistir(i, "marka", e.target.value)}
                      />
                    </td>
                    <td>
                      <Form.Control
                        size="sm"
                        type="number"
                        min={0}
                        step="0.001"
                        className="text-end font-monospace"
                        value={satir.miktar}
                        disabled={kilitli}
                        onChange={(e) => satirDegistir(i, "miktar", Number(e.target.value))}
                      />
                    </td>
                    <td>
                      <Form.Select
                        size="sm"
                        value={satir.birimKodu}
                        disabled={kilitli}
                        onChange={(e) => satirDegistir(i, "birimKodu", e.target.value)}
                      >
                        {EBELGE_BIRIMLER.map((b) => (
                          <option key={b.kod} value={b.kod}>
                            {b.ad}
                          </option>
                        ))}
                      </Form.Select>
                    </td>
                    <td className="text-center">
                      <Button
                        size="sm"
                        variant="link"
                        className="p-0"
                        style={{ color: "#dc2626" }}
                        disabled={kilitli || satirlar.length <= 1}
                        onClick={() => setSatirlar((o) => o.filter((_, idx) => idx !== i))}
                        title="Satırı sil"
                      >
                        <IconTrash size={16} />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>

          <div className="d-flex align-items-center gap-2 mt-3">
            <Button
              size="sm"
              variant="primary"
              onClick={dogrula}
              disabled={kilitli}
              className="d-flex align-items-center gap-1"
            >
              {dogrulaniyor ? <Spinner animation="border" size="sm" /> : <IconFileCheck size={16} />}
              Doğrula (gönderme yok)
            </Button>
          </div>
        </Card.Body>
      </Card>

      {sonuc && (
        <Card className="shadow-sm border border-secondary-subtle rounded-3 overflow-hidden">
          <Card.Body className="p-3 bg-body">
            <div className="fw-semibold mb-2" style={{ fontSize: "13px" }}>
              Doğrulama Sonucu
            </div>

            <div className="d-flex flex-wrap align-items-center gap-3 mb-3">
              <span className="d-flex align-items-center gap-1 small">
                {sonuc.semaGecerli ? (
                  <IconCircleCheck size={17} style={{ color: "#22c55e" }} />
                ) : (
                  <IconCircleX size={17} style={{ color: "#dc2626" }} />
                )}
                Şema (XSD)
              </span>
              <span className="d-flex align-items-center gap-1 small">
                {sonuc.schematronGecerli ? (
                  <IconCircleCheck size={17} style={{ color: "#22c55e" }} />
                ) : (
                  <IconCircleX size={17} style={{ color: "#dc2626" }} />
                )}
                Schematron (GİB kuralları)
              </span>
              <Badge bg="secondary-subtle" text="secondary" className="font-monospace">
                ETTN: {sonuc.uuid.slice(0, 8)}…
              </Badge>
              <span className="ms-auto small text-secondary">{sonuc.satirSayisi} satır</span>
            </div>

            {sonuc.mesaj && (
              <Alert
                variant={sonuc.semaGecerli && sonuc.schematronGecerli ? "info" : "danger"}
                className="py-2 px-3 mb-3 border rounded shadow-2xs small"
              >
                {sonuc.mesaj}
              </Alert>
            )}

            {gonderildi ? (
              <Alert variant="success" className="py-2 px-3 mb-3 border rounded shadow-2xs small">
                <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
                  <span>
                    e-İrsaliye gönderildi — <strong>{gonderildi.belgeNo}</strong> · ETTN:{" "}
                    <span className="font-monospace">{gonderildi.uuid}</span>
                  </span>
                  <Button
                    size="sm"
                    variant="outline-secondary"
                    onClick={pdfAc}
                    disabled={pdfYukleniyor}
                    className="d-flex align-items-center gap-1"
                  >
                    {pdfYukleniyor ? (
                      <Spinner animation="border" size="sm" />
                    ) : (
                      <IconFileTypePdf size={15} />
                    )}
                    PDF Aç
                    <IconExternalLink size={13} />
                  </Button>
                </div>
              </Alert>
            ) : (
              gonderilebilir && (
                <div className="border rounded-2 p-3 mb-3 shadow-2xs">
                  {!onayAcik ? (
                    <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
                      <span className="small text-secondary">
                        İrsaliye doğrulamadan geçti. GİB'e gönderebilirsiniz.
                      </span>
                      <Button
                        size="sm"
                        variant="outline-danger"
                        onClick={() => setOnayAcik(true)}
                        className="d-flex align-items-center gap-1"
                      >
                        <IconSend size={15} />
                        GİB'e Gönder
                      </Button>
                    </div>
                  ) : (
                    <div>
                      <Alert variant="danger" className="py-2 px-3 mb-2 border rounded shadow-2xs small">
                        <IconAlertTriangle size={15} className="me-1" />
                        <strong>İrsaliye GİB'e gönderilecek</strong> ve bu işlem{" "}
                        <strong>geri alınamaz</strong>. Belge numarası ({belgeNo.toUpperCase()})
                        kullanılmış sayılır.
                        <br />
                        Alıcı: <strong>{aliciVkn.trim().length === 11 ? `${aliciAd.trim()} ${aliciSoyad.trim()}` : aliciUnvan.trim() || `${aliciAd.trim()} ${aliciSoyad.trim()}`}</strong> ({aliciVkn}) · Sevk: {sevkTarihi}
                        {plaka ? ` · Plaka: ${plaka}` : ""}
                      </Alert>
                      <div className="d-flex gap-2">
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={gonder}
                          disabled={gonderiliyor}
                          className="d-flex align-items-center gap-1"
                        >
                          {gonderiliyor ? <Spinner animation="border" size="sm" /> : null}
                          Evet, irsaliyeyi GİB'e gönder
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setOnayAcik(false)}
                          disabled={gonderiliyor}
                        >
                          Vazgeç
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )
            )}

            {sonuc.html && (
              <>
                <div className="fw-semibold mb-2" style={{ fontSize: "13px" }}>
                  Önizleme
                </div>
                <div className="border rounded-2 overflow-hidden" style={{ height: "55vh" }}>
                  {/* Üçüncü tarafın ürettiği HTML — sandbox boş (§11.1 S5) */}
                  <iframe
                    title="İrsaliye önizleme"
                    srcDoc={sonuc.html}
                    sandbox=""
                    referrerPolicy="no-referrer"
                    style={{ width: "100%", height: "100%", border: "none" }}
                  />
                </div>
              </>
            )}
          </Card.Body>
        </Card>
      )}
    </div>
  );
};

export default EBelgeIrsaliyePage;
