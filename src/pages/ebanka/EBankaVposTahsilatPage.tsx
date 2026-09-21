import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Alert, Badge, Button, Card, Col, Form, Row, Spinner } from "react-bootstrap";
import { IconArrowsExchange, IconCreditCard, IconLock } from "@tabler/icons-react";
import ERPToolbar from "../../components/common/ERPToolbar";
import { EBankaBinSonucu, EBankaCari, EBankaMod, EBankaOdemeSonucu, EBankaOdemeYonlendirme, EBankaService } from "../../services/ebankaService";
import { CariSecModal, ModRozeti, paraYaz, useBildirim } from "./ebankaOrtak";

// F- e-Banka > F- Sanal POS Tahsilat: kartla ödeme, 3D Secure (docs/EBANKA_VOMSIS_YOL_HARITASI.md, Faz 5)
// Kart bilgisi yalnızca ödeme isteğinde sunucuya gider, orada saklanmaz; istek gönderilir gönderilmez ekrandan da silinir.

const SORGU_ARALIGI_MS = 4000;
const EN_UZUN_BEKLEME_MS = 10 * 60 * 1000;
const BOS_KART = { adSoyad: "", no: "", ay: "", yil: "", cvc: "" };

const rakam = (s: string) => s.replace(/\D/g, "");
const kartNoBicimle = (s: string) => rakam(s).slice(0, 19).replace(/(.{4})/g, "$1 ").trim();
const sayiOku = (s: string) => Math.round(Number(s.replace(/\./g, "").replace(",", ".")) * 100) / 100;

/** Bankanın 3D ekranını önceden açılmış pencerede gösterir. Alanlar DOM ile kurulur (metin birleştirerek HTML üretilmez). */
const ucDGoster = (pencere: Window, y: EBankaOdemeYonlendirme) => {
  if (y.htmlContent) {
    pencere.document.open();
    pencere.document.write(y.htmlContent);
    pencere.document.close();
    return;
  }
  const d = pencere.document;
  const form = d.createElement("form");
  form.method = "POST";
  form.action = y.gateway as string;
  for (const a of y.alanlar) {
    const girdi = d.createElement("input");
    girdi.type = "hidden";
    girdi.name = a.ad;
    girdi.value = a.deger;
    form.appendChild(girdi);
  }
  d.body.appendChild(form);
  form.submit();
};

export const EBankaVposTahsilatPage: React.FC = () => {
  const [mod, setMod] = useState<EBankaMod | undefined>();
  const [vposBankaTanimli, setVposBankaTanimli] = useState(true);
  const [cari, setCari] = useState<EBankaCari | null>(null);
  const [cariSecAcik, setCariSecAcik] = useState(false);
  const [tutar, setTutar] = useState("");
  const [paraBirimi, setParaBirimi] = useState("TRY");
  const [aciklama, setAciklama] = useState("");
  const [kart, setKart] = useState(BOS_KART);
  const [bin, setBin] = useState<EBankaBinSonucu | null>(null);
  const [taksit, setTaksit] = useState(1);

  const [gonderiliyor, setGonderiliyor] = useState(false);
  const [referansNo, setReferansNo] = useState<string | null>(null);
  const [sonuc, setSonuc] = useState<EBankaOdemeSonucu | null>(null);
  const [sorgulaniyor, setSorgulaniyor] = useState(false);
  const baslangicRef = useRef(0);
  const { bildir, bildirimKutusu } = useBildirim();

  useEffect(() => {
    EBankaService.getVposLinkler()
      .then((v) => {
        setMod(v.mod);
        setVposBankaTanimli(v.vposBankaTanimli);
      })
      .catch(() => undefined);
  }, []);

  // Kart numarasının ilk 6 hanesi değişince kart bilgisi ve o karta özel taksitler sorulur
  const binNo = rakam(kart.no).slice(0, 6);
  useEffect(() => {
    setBin(null);
    setTaksit(1);
    if (binNo.length < 6) return;
    let iptal = false;
    const t = setTimeout(() => {
      EBankaService.vposBinSorgula(binNo)
        .then((b) => !iptal && setBin(b))
        .catch(() => !iptal && setBin(null));
    }, 400);
    return () => {
      iptal = true;
      clearTimeout(t);
    };
  }, [binNo]);

  const sonucuSorgula = useCallback(
    async (ref: string, sessiz: boolean) => {
      if (!sessiz) setSorgulaniyor(true);
      try {
        const s = await EBankaService.vposOdemeSonucu(ref);
        setSonuc(s);
        return s.durum;
      } catch (err: any) {
        if (!sessiz) bildir("danger", err?.message || "Sonuç sorgulanamadı.");
        return "bekliyor" as const;
      } finally {
        if (!sessiz) setSorgulaniyor(false);
      }
    },
    [bildir]
  );

  // Müşteri 3D ekranını tamamlayana kadar sonuç aralıklarla sorulur; sonuç netleşince ya da süre dolunca durur
  useEffect(() => {
    if (!referansNo || (sonuc && sonuc.durum !== "bekliyor")) return;
    const t = setInterval(async () => {
      if (Date.now() - baslangicRef.current > EN_UZUN_BEKLEME_MS) return clearInterval(t);
      const durum = await sonucuSorgula(referansNo, true);
      if (durum !== "bekliyor") clearInterval(t);
    }, SORGU_ARALIGI_MS);
    return () => clearInterval(t);
  }, [referansNo, sonuc, sonucuSorgula]);

  const secenekler = bin?.taksitler.length ? bin.taksitler : [{ installment: 1, title: "Tek Çekim", ratio: 0 }];
  const secilenOran = Number(secenekler.find((s) => s.installment === taksit)?.ratio) || 0;
  const tutarSayi = sayiOku(tutar);
  const cekilecek = tutarSayi > 0 ? Math.round(tutarSayi * (1 + secilenOran / 100) * 100) / 100 : 0;

  const formHazir =
    !!cari && tutarSayi > 0 && kart.adSoyad.trim().length > 2 && rakam(kart.no).length >= 13 && /^(0?[1-9]|1[0-2])$/.test(kart.ay) && /^(\d{2}|\d{4})$/.test(kart.yil) && /^\d{3,4}$/.test(kart.cvc);

  const odemeyiBaslat = async () => {
    if (!cari || !formHazir) return;
    // Pencere tıklama anında açılmalı; yanıt geldikten sonra açılırsa tarayıcı açılır pencereyi engeller
    const pencere = window.open("", "_blank", "width=520,height=720");
    if (!pencere) {
      bildir("warning", "3D Secure ekranı için açılır pencereye izin verin ve yeniden deneyin.");
      return;
    }
    pencere.document.write("<p style='font-family:sans-serif;text-align:center;margin-top:80px'>Banka ekranı açılıyor…</p>");

    setGonderiliyor(true);
    setSonuc(null);
    setReferansNo(null);
    try {
      const y = await EBankaService.vposOdemeBaslat({ cariKartId: cari.cariKartId, tutar: String(tutarSayi), paraBirimi, taksit, taksitOrani: secilenOran, aciklama: aciklama.trim(), kart: { ...kart, no: rakam(kart.no) } });
      // Kart bilgisi artık gerekmiyor: ekrandan silinir
      setKart(BOS_KART);
      ucDGoster(pencere, y);
      baslangicRef.current = Date.now();
      setSonuc({ durum: "bekliyor", mesaj: "Müşteri bankanın 3D Secure ekranında doğrulama yapıyor.", islem: null });
      setReferansNo(y.referansNo);
    } catch (err: any) {
      pencere.close();
      bildir("danger", err?.message || "Ödeme başlatılamadı.");
    } finally {
      setGonderiliyor(false);
    }
  };

  const yeniTahsilat = () => {
    setReferansNo(null);
    setSonuc(null);
    setKart(BOS_KART);
    setTutar("");
    setAciklama("");
    setCari(null);
  };

  const bekliyor = !!referansNo && sonuc?.durum === "bekliyor";

  return (
    <div className="ebanka-vpos-tahsilat-page w-100 pb-3" style={{ overflowX: "hidden" }}>
      <ERPToolbar
        pageTitle="F- e-Banka Sanal POS Tahsilat"
        onNew={yeniTahsilat}
        hideSave
        hideSearch
        hideDelete
        hideNavigation
        hidePrint
        disabled={gonderiliyor}
        modeText="Kartla ödeme — 3D Secure"
        rightContent={<ModRozeti mod={mod} />}
      />
      {bildirimKutusu}

      {mod === "canli" && !vposBankaTanimli && (
        <Alert variant="warning" className="small py-2">
          Sanal POS banka hesabı seçilmemiş; başarılı ödemeler için tahsilat fişi kesilemez. <Link to="/ebanka/ayarlar">Ayarlar ekranından seçin.</Link>
        </Alert>
      )}
      {mod === "sahte" && (
        <Alert variant="light" className="border small py-2">
          Test (örnek veri) modu: gerçek banka yok, <b>karttan para çekilmez ve fiş kesilmez</b>. Uydurma bir kart numarasıyla akışı deneyebilirsiniz.
        </Alert>
      )}

      <Row className="g-3">
        <Col lg={7}>
          <Card className="border shadow-sm bg-white">
            <Card.Body className="p-3 small">
              <Form.Label className="fw-bold text-secondary mb-1">
                Cari <span className="text-danger">*</span>
              </Form.Label>
              <div className="d-flex align-items-center gap-2 mb-3">
                <div className="flex-grow-1 border rounded px-2 py-1 bg-light">{cari ? `${cari.kod} - ${cari.ad}` : "Seçilmedi"}</div>
                <Button size="sm" variant="outline-primary" disabled={gonderiliyor || bekliyor} onClick={() => setCariSecAcik(true)}>
                  <IconArrowsExchange size={16} className="me-1" />
                  Seç
                </Button>
              </div>

              <Row className="g-2 mb-3">
                <Col md={5}>
                  <Form.Label className="fw-bold text-secondary mb-1">
                    Tutar <span className="text-danger">*</span>
                  </Form.Label>
                  <Form.Control type="text" size="sm" inputMode="decimal" className="font-monospace fw-bold" value={tutar} disabled={bekliyor} onChange={(e) => setTutar(e.target.value)} />
                </Col>
                <Col md={3}>
                  <Form.Label className="fw-bold text-secondary mb-1">Para Birimi</Form.Label>
                  <Form.Select size="sm" value={paraBirimi} disabled={bekliyor} onChange={(e) => setParaBirimi(e.target.value)}>
                    <option value="TRY">TRY</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                  </Form.Select>
                </Col>
                <Col md={12}>
                  <Form.Label className="fw-bold text-secondary mb-1">Açıklama</Form.Label>
                  <Form.Control type="text" size="sm" maxLength={250} value={aciklama} disabled={bekliyor} onChange={(e) => setAciklama(e.target.value)} />
                </Col>
              </Row>

              <div className="d-flex align-items-center fw-bold text-secondary mb-2">
                <IconCreditCard size={16} className="me-1" /> Kart Bilgileri
                <span className="ms-auto fw-normal text-muted d-flex align-items-center">
                  <IconLock size={14} className="me-1" /> Kart bilgisi saklanmaz
                </span>
              </div>
              <Row className="g-2">
                <Col md={12}>
                  <Form.Label className="fw-bold text-secondary mb-1">Kart Üzerindeki Ad Soyad</Form.Label>
                  <Form.Control type="text" size="sm" autoComplete="off" value={kart.adSoyad} disabled={bekliyor} onChange={(e) => setKart({ ...kart, adSoyad: e.target.value.toLocaleUpperCase("tr") })} />
                </Col>
                <Col md={12}>
                  <Form.Label className="fw-bold text-secondary mb-1">Kart Numarası</Form.Label>
                  <Form.Control type="text" size="sm" inputMode="numeric" autoComplete="off" className="font-monospace" value={kartNoBicimle(kart.no)} disabled={bekliyor} onChange={(e) => setKart({ ...kart, no: rakam(e.target.value).slice(0, 19) })} />
                  {bin?.kart && (
                    <Form.Text className="text-muted" style={{ fontSize: "11px" }}>
                      {[bin.kart.bank_name, bin.kart.card_family_name, bin.kart.card_association, bin.kart.card_type].filter(Boolean).join(" · ")}
                    </Form.Text>
                  )}
                </Col>
                <Col xs={4}>
                  <Form.Label className="fw-bold text-secondary mb-1">Ay</Form.Label>
                  <Form.Control type="text" size="sm" inputMode="numeric" autoComplete="off" placeholder="AA" className="font-monospace" value={kart.ay} disabled={bekliyor} onChange={(e) => setKart({ ...kart, ay: rakam(e.target.value).slice(0, 2) })} />
                </Col>
                <Col xs={4}>
                  <Form.Label className="fw-bold text-secondary mb-1">Yıl</Form.Label>
                  <Form.Control type="text" size="sm" inputMode="numeric" autoComplete="off" placeholder="YYYY" className="font-monospace" value={kart.yil} disabled={bekliyor} onChange={(e) => setKart({ ...kart, yil: rakam(e.target.value).slice(0, 4) })} />
                </Col>
                <Col xs={4}>
                  <Form.Label className="fw-bold text-secondary mb-1">CVC</Form.Label>
                  <Form.Control type="password" size="sm" inputMode="numeric" autoComplete="off" className="font-monospace" value={kart.cvc} disabled={bekliyor} onChange={(e) => setKart({ ...kart, cvc: rakam(e.target.value).slice(0, 4) })} />
                </Col>
                <Col md={12}>
                  <Form.Label className="fw-bold text-secondary mb-1">Taksit</Form.Label>
                  <Form.Select size="sm" value={taksit} disabled={bekliyor} onChange={(e) => setTaksit(Number(e.target.value))}>
                    {secenekler.map((s) => (
                      <option key={s.installment} value={s.installment}>
                        {s.installment === 1 ? "Tek Çekim" : `${s.installment} Taksit`}
                        {Number(s.ratio) > 0 ? ` — vade farkı %${paraYaz(Number(s.ratio))}` : ""}
                      </option>
                    ))}
                  </Form.Select>
                  {!bin && <Form.Text className="text-muted" style={{ fontSize: "11px" }}>Taksit seçenekleri kart numarasının ilk 6 hanesi girilince gelir.</Form.Text>}
                </Col>
              </Row>
            </Card.Body>
          </Card>
        </Col>

        <Col lg={5}>
          <Card className="border shadow-sm bg-white mb-3">
            <Card.Body className="p-3 small">
              <div className="d-flex justify-content-between mb-1">
                <span className="text-secondary fw-bold">Cariye işlenecek tutar</span>
                <span className="font-monospace fw-bold">
                  {paraYaz(tutarSayi || 0)} {paraBirimi}
                </span>
              </div>
              <div className="d-flex justify-content-between mb-1">
                <span className="text-secondary fw-bold">Vade farkı</span>
                <span className="font-monospace">%{paraYaz(secilenOran)}</span>
              </div>
              <div className="d-flex justify-content-between border-top pt-2 mb-3">
                <span className="text-secondary fw-bold">Karttan çekilecek</span>
                <span className="font-monospace fw-bold fs-5 text-primary">
                  {paraYaz(cekilecek)} {paraBirimi}
                </span>
              </div>
              <Button variant="primary" className="w-100" disabled={!formHazir || gonderiliyor || bekliyor} onClick={odemeyiBaslat}>
                {gonderiliyor ? <Spinner size="sm" className="me-1" /> : <IconLock size={16} className="me-1" />}
                3D Secure ile Ödemeyi Başlat
              </Button>
              <div className="text-muted mt-2" style={{ fontSize: "11px" }}>
                Banka ekranı ayrı bir pencerede açılır; müşteri telefonuna gelen kodu o pencerede girer.
              </div>
            </Card.Body>
          </Card>

          {sonuc && (
            <Card className="border shadow-sm bg-white">
              <Card.Body className="p-3 small">
                <div className="d-flex align-items-center mb-2">
                  <span className="fw-bold text-secondary me-2">Ödeme Sonucu</span>
                  <Badge bg={sonuc.durum === "basarili" ? "success" : sonuc.durum === "basarisiz" ? "danger" : "warning"} text={sonuc.durum === "bekliyor" ? "dark" : undefined}>
                    {sonuc.durum === "basarili" ? "Başarılı" : sonuc.durum === "basarisiz" ? "Başarısız" : "Bekliyor"}
                  </Badge>
                  {bekliyor && <Spinner size="sm" className="ms-2" />}
                </div>
                {referansNo && <div className="font-monospace text-muted mb-1">{referansNo}</div>}
                <div>{sonuc.mesaj}</div>
                <div className="d-flex gap-2 mt-3">
                  {bekliyor && (
                    <Button size="sm" variant="outline-primary" disabled={sorgulaniyor} onClick={() => referansNo && sonucuSorgula(referansNo, false)}>
                      {sorgulaniyor && <Spinner size="sm" className="me-1" />}
                      Sonucu Şimdi Sorgula
                    </Button>
                  )}
                  <Button size="sm" variant="light" className="border" onClick={yeniTahsilat}>
                    Yeni Tahsilat
                  </Button>
                </div>
                {bekliyor && (
                  <div className="text-muted mt-2" style={{ fontSize: "11px" }}>
                    Pencere kapatıldıysa ya da sonuç gelmediyse işlem daha sonra H- Sanal POS İşlemleri ekranından da izlenebilir.
                  </div>
                )}
              </Card.Body>
            </Card>
          )}
        </Col>
      </Row>

      <CariSecModal
        show={cariSecAcik}
        onHide={() => setCariSecAcik(false)}
        onSec={(c) => {
          setCari(c);
          setCariSecAcik(false);
        }}
      />
    </div>
  );
};

export default EBankaVposTahsilatPage;
