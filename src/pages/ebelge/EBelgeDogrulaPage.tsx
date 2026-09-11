import React, { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Badge, Button, Card, Col, Form, Row, Spinner, Table } from "react-bootstrap";
import {
  IconFileCheck,
  IconPlus,
  IconTrash,
  IconCircleCheck,
  IconCircleX,
  IconShieldCheck,
  IconFileDots,
  IconAlertTriangle,
  IconSend,
} from "@tabler/icons-react";

import ERPToolbar from "../../components/common/ERPToolbar";
import EBelgeCariSec from "./EBelgeCariSec";
import {
  EBELGE_BIRIMLER,
  EbelgeDogrulamaSonucu,
  EbelgeFaturaTipi,
  EbelgeSatir,
  EbelgeSenaryo,
  EbelgeTaslakSonucu,
  ebelgeService,
  ebelgeTutar,
} from "../../services/ebelgeService";

/**
 * E-Belge — Belge Doğrulama (Faz 5)
 *
 * Bu ekran **belge göndermez**. Girilen bilgilerden UBL-TR faturayı üretir ve
 * ICE'nin `invoice_check_validate` ucuna doğrulatır: şema + schematron sonucu ve
 * HTML önizleme döner. Canlı hesapla mali sonuç doğurmadan test etmenin yolu budur.
 *
 * Arayüz kuralları: docs/ice-baglanti.md §15
 */

type AlertInfo = { type: "success" | "danger" | "warning" | "info"; message: string } | null;

const bugunISO = () => new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" });

const BOS_SATIR: EbelgeSatir = {
  ad: "",
  miktar: 1,
  birimKodu: "C62",
  birimFiyat: 0,
  iskontoOrani: 0,
  kdvOrani: 20,
};

const EBelgeDogrulaPage: React.FC = () => {
  const [belgeNo, setBelgeNo] = useState<string>("");
  const [tarih, setTarih] = useState<string>(bugunISO());
  const [senaryo, setSenaryo] = useState<EbelgeSenaryo>("TICARIFATURA");
  const [faturaTipi, setFaturaTipi] = useState<EbelgeFaturaTipi>("SATIS");
  const [paraBirimi, setParaBirimi] = useState<string>("TRY");
  const [not, setNot] = useState<string>("");

  const [aliciVkn, setAliciVkn] = useState<string>("");
  const [aliciUnvan, setAliciUnvan] = useState<string>("");
  const [aliciAd, setAliciAd] = useState<string>("");
  const [aliciSoyad, setAliciSoyad] = useState<string>("");
  const [aliciVd, setAliciVd] = useState<string>("");
  const [aliciIl, setAliciIl] = useState<string>("");
  const [aliciIlce, setAliciIlce] = useState<string>("");

  const [satirlar, setSatirlar] = useState<EbelgeSatir[]>([{ ...BOS_SATIR }]);

  // Mali alanlar
  const [iadeFaturalar, setIadeFaturalar] = useState<{ belgeNo: string; tarih: string }[]>([]);
  const [dovizKuru, setDovizKuru] = useState<string>("");
  const [dogrulaniyor, setDogrulaniyor] = useState<boolean>(false);
  const [sonuc, setSonuc] = useState<EbelgeDogrulamaSonucu | null>(null);
  const [alertInfo, setAlertInfo] = useState<AlertInfo>(null);
  const [mukellefSorgulaniyor, setMukellefSorgulaniyor] = useState(false);
  /** Sonucu ekranda duran numara. Numara değişince tür seçimi geçersizleşir. */
  const [sorgulananVkn, setSorgulananVkn] = useState("");
  /** Otomatik sorgunun aynı numara için tekrar tekrar denenmesini engeller. */
  const otomatikDenenen = useRef("");
  /** Geç dönen eski sorgunun yeni sonucu ezmesini engeller. */
  const sorguSirasi = useRef(0);

  const mukellefSorgula = async (vknParam?: string, otomatik = false) => {
    const vkn = (vknParam ?? aliciVkn).trim();
    if (!/^\d{10,11}$/.test(vkn)) {
      if (!otomatik) setAlertInfo({ type: "danger", message: "VKN 10, TCKN 11 haneli olmalıdır." });
      return;
    }
    const sira = ++sorguSirasi.current;
    setMukellefSorgulaniyor(true);
    setSonuc(null);
    setTaslakOnayAcik(false);
    setDogrulananGirdi("");
    try {
      const cevap = await ebelgeService.mukellefSorgula(vkn);
      if (sira !== sorguSirasi.current) return;
      setSorgulananVkn(vkn);
      setSenaryo(cevap.mukellefMi ? "TICARIFATURA" : "EARSIVFATURA");
      setAlertInfo({ type: "success", message: cevap.mukellefMi
        ? "Alıcı e-Fatura mükellefi. e-Fatura seçildi; belgeyi doğrulayarak devam edin."
        : "Alıcı e-Fatura mükellefi değil. e-Arşiv seçildi; belgeyi doğrulayarak devam edin." });
    } catch (err: any) {
      if (sira !== sorguSirasi.current) return;
      // Sorgu hatası "mükellef değil" demek değildir; tür seçimi belirsiz bırakılır.
      setSorgulananVkn("");
      setAlertInfo({ type: "danger", message: (err?.message || "Mükellef sorgulanamadı") +
        " — belge türü belirlenemedi. Numarayı kontrol edip Mükellef Sorgula ile tekrar deneyin." });
    } finally {
      if (sira === sorguSirasi.current) setMukellefSorgulaniyor(false);
    }
  };

  // TCKN/VKN tamamlanınca tür sorgusu kendiliğinden çalışır; sonuç e-Fatura/e-Arşiv'i seçer.
  useEffect(() => {
    const vkn = aliciVkn.trim();
    if (!/^\d{10,11}$/.test(vkn)) {
      otomatikDenenen.current = "";
      if (sorgulananVkn) setSorgulananVkn("");
      return;
    }
    if (vkn === sorgulananVkn || vkn === otomatikDenenen.current) return;
    const zaman = setTimeout(() => {
      otomatikDenenen.current = vkn;
      void mukellefSorgula(vkn, true);
    }, 600);
    return () => clearTimeout(zaman);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aliciVkn, sorgulananVkn]);

  /** Numara değişti ve sorgu sonucu yok → tür seçimi güvenilmez. */
  const turBelirsiz = /^\d{10,11}$/.test(aliciVkn.trim()) && aliciVkn.trim() !== sorgulananVkn;

  // Taslak — iki adımlı onay
  const [taslakOnayAcik, setTaslakOnayAcik] = useState<boolean>(false);
  /** Onay panelinde hangi işlem onaylanıyor */
  const [islem, setIslem] = useState<"taslak" | "gonder" | "earsiv">("taslak");
  const [taslakGonderiliyor, setTaslakGonderiliyor] = useState<boolean>(false);
  const [taslakSonuc, setTaslakSonuc] = useState<EbelgeTaslakSonucu | null>(null);
  const [dogrulananGirdi, setDogrulananGirdi] = useState("");
  const girdiAnahtari = JSON.stringify([belgeNo, tarih, senaryo, faturaTipi, paraBirimi, not,
    aliciVkn, aliciUnvan, aliciAd, aliciSoyad, aliciVd, aliciIl, aliciIlce, satirlar]);
  const dogrulamaGuncel = dogrulananGirdi === girdiAnahtari;

  const tcknMi = aliciVkn.trim().length === 11;
  const iadeMi = faturaTipi === "IADE";
  const tevkifatliMi = faturaTipi === "TEVKIFAT";
  const dovizliMi = paraBirimi !== "TRY";

  /** Ekranda anlık toplam — backend tutarları yeniden hesaplar, bu yalnızca önizleme */
  const yerelToplam = useMemo(() => {
    const yuvarla = (n: number) => Math.round(n * 100) / 100;
    let matrah = 0;
    let kdv = 0;
    let iskonto = 0;
    for (const s of satirlar) {
      const brut = yuvarla((s.miktar || 0) * (s.birimFiyat || 0));
      const ind = yuvarla((brut * (s.iskontoOrani || 0)) / 100);
      const m = yuvarla(brut - ind);
      iskonto = yuvarla(iskonto + ind);
      matrah = yuvarla(matrah + m);
      kdv = yuvarla(kdv + (m * (s.kdvOrani || 0)) / 100);
    }
    let tevkifat = 0;
    for (const s of satirlar) {
      if (!s.tevkifatOrani) continue;
      const brut = yuvarla((s.miktar || 0) * (s.birimFiyat || 0));
      const m = yuvarla(brut - (brut * (s.iskontoOrani || 0)) / 100);
      const satirKdv = yuvarla((m * (s.kdvOrani || 0)) / 100);
      tevkifat = yuvarla(tevkifat + (satirKdv * s.tevkifatOrani) / 100);
    }
    return { matrah, kdv, iskonto, tevkifat, toplam: yuvarla(matrah + kdv - tevkifat) };
  }, [satirlar]);

  const satirDegistir = <K extends keyof EbelgeSatir>(i: number, alan: K, deger: EbelgeSatir[K]) => {
    setSatirlar((onceki) => onceki.map((s, idx) => (idx === i ? { ...s, [alan]: deger } : s)));
  };

  const dogrula = async () => {
    if (dogrulaniyor || taslakGonderiliyor) return;
    setAlertInfo(null);
    setSonuc(null);

    if (!belgeNo.trim()) {
      setAlertInfo({ type: "danger", message: "Fatura numarası zorunludur." });
      return;
    }
    if (!aliciVkn.trim()) {
      setAlertInfo({ type: "danger", message: "Alıcı VKN/TCKN zorunludur." });
      return;
    }
    if (!aliciUnvan.trim() && !(aliciAd.trim() && aliciSoyad.trim())) {
      setAlertInfo({ type: "danger", message: "Alıcı için unvan ya da ad+soyad giriniz." });
      return;
    }
    if (satirlar.some((s) => !s.ad.trim())) {
      setAlertInfo({ type: "danger", message: "Her satırda mal/hizmet adı bulunmalıdır." });
      return;
    }
    if (satirlar.some((s) => s.kdvOrani === 0 && !s.istisnaKodu?.trim())) {
      setAlertInfo({
        type: "danger",
        message: "KDV oranı 0 olan satırlarda GİB istisna kodu zorunludur.",
      });
      return;
    }
    if (satirlar.some((s) => s.istisnaKodu?.trim() === "555" && s.kdvOrani === 0)) {
      setAlertInfo({ type: "danger", message: "555 vergi muafiyet kodu KDV 0 ile kullanılamaz." });
      return;
    }
    if (satirlar.some((s) => s.istisnaKodu?.trim() === "555") && ["YATIRIMTESVIK", "KAMU"].includes(senaryo)) {
      setAlertInfo({ type: "danger", message: "555 vergi muafiyet kodu özel senaryolu faturada kullanılamaz." });
      return;
    }
    if (satirlar.some((s) => ["308", "339"].includes(s.istisnaKodu?.trim() || "")) && senaryo !== "YATIRIMTESVIK") {
      setAlertInfo({ type: "danger", message: "308 ve 339 kodları yalnızca Yatırım Teşvik profilinde kullanılabilir." });
      return;
    }
    if (iadeMi && !["TEMELFATURA", "EARSIVFATURA", "YATIRIMTESVIK", "KAMU"].includes(senaryo)) {
      setAlertInfo({ type: "danger", message: `İade faturası ${senaryo} profilinde kullanılamaz.` });
      return;
    }
    if (faturaTipi === "TEKNOLOJIDESTEK" && senaryo !== "EARSIVFATURA") {
      setAlertInfo({ type: "danger", message: "Teknoloji Destek faturası yalnızca e-Arşiv Fatura profilinde kullanılabilir." });
      return;
    }
    if (tevkifatliMi && !satirlar.some((s) => s.tevkifatKodu?.trim())) {
      setAlertInfo({
        type: "danger",
        message: "Tevkifatlı faturada en az bir satırda tevkifat kodu ve oranı olmalıdır.",
      });
      return;
    }
    if (iadeMi && (!iadeFaturalar.length || iadeFaturalar.some((r) => !r.belgeNo.trim() || !r.tarih))) {
      setAlertInfo({
        type: "danger",
        message: "İade faturasında iade edilen fatura numarası ve tarihi zorunludur.",
      });
      return;
    }
    if (dovizliMi && !(Number(dovizKuru) > 0)) {
      setAlertInfo({
        type: "danger",
        message: `${paraBirimi} cinsinden belgede TL karşılığı kur zorunludur.`,
      });
      return;
    }

    setDogrulaniyor(true);
    try {
      const cevap = await ebelgeService.dogrulaGidenBelge({
        belgeNo: belgeNo.trim().toUpperCase(),
        tarih,
        senaryo,
        faturaTipi,
        paraBirimi,
        notlar: not.trim() ? [not.trim()] : undefined,
        alici: {
          vknTckn: aliciVkn.trim(),
          unvan: aliciUnvan.trim() || undefined,
          ad: aliciAd.trim() || undefined,
          soyad: aliciSoyad.trim() || undefined,
          vergiDairesi: aliciVd.trim() || undefined,
          il: aliciIl.trim() || undefined,
          ilce: aliciIlce.trim() || undefined,
        },
        satirlar,
        iadeFaturalar: iadeMi ? iadeFaturalar : undefined,
        dovizKuru: dovizliMi && dovizKuru ? { kur: Number(dovizKuru), tarih } : undefined,
        onizleme: true,
      });

      setSonuc(cevap);
      setDogrulananGirdi(girdiAnahtari);
      setTaslakSonuc(null);
      setTaslakOnayAcik(false);
      setAlertInfo(
        cevap.semaGecerli && cevap.schematronGecerli
          ? { type: "success", message: "Belge şema ve schematron doğrulamasından geçti. Hiçbir belge gönderilmedi." }
          : { type: "warning", message: cevap.mesaj || "Belge doğrulamadan geçemedi." }
      );
    } catch (err: any) {
      setAlertInfo({ type: "danger", message: err?.message || "Doğrulama yapılamadı." });
    } finally {
      setDogrulaniyor(false);
    }
  };

  /**
   * Gönderim isteklerinin ortak gövdesi.
   * Önizlemede üretilen UUID ve saat gönderime taşınır ki doğrulanan belge ile
   * gönderilen belge birebir aynı olsun.
   */
  const istekGovdesi = () => ({
    uuid: sonuc!.uuid,
    saat:
      new DOMParser()
        .parseFromString(sonuc!.xml, "application/xml")
        .getElementsByTagName("cbc:IssueTime")[0]?.textContent || undefined,
    belgeNo: belgeNo.trim().toUpperCase(),
    tarih,
    senaryo,
    faturaTipi,
    paraBirimi,
    notlar: not.trim() ? [not.trim()] : undefined,
    alici: {
      vknTckn: aliciVkn.trim(),
      unvan: aliciUnvan.trim() || undefined,
      ad: aliciAd.trim() || undefined,
      soyad: aliciSoyad.trim() || undefined,
      vergiDairesi: aliciVd.trim() || undefined,
      il: aliciIl.trim() || undefined,
      ilce: aliciIlce.trim() || undefined,
    },
    satirlar,
    iadeFaturalar: iadeMi ? iadeFaturalar : undefined,
    dovizKuru: dovizliMi && dovizKuru ? { kur: Number(dovizKuru), tarih } : undefined,
  });

  const taslakOlustur = async () => {
    if (!taslakVerilebilir || taslakGonderiliyor) return;
    setAlertInfo(null);
    setTaslakGonderiliyor(true);
    try {
      const cevap = await ebelgeService.taslakGonder({
        uuid: sonuc!.uuid,
        saat: new DOMParser().parseFromString(sonuc!.xml, "application/xml").getElementsByTagName("cbc:IssueTime")[0]?.textContent || undefined,
        belgeNo: belgeNo.trim().toUpperCase(),
        tarih,
        senaryo,
        faturaTipi,
        paraBirimi,
        notlar: not.trim() ? [not.trim()] : undefined,
        alici: {
          vknTckn: aliciVkn.trim(),
          unvan: aliciUnvan.trim() || undefined,
          ad: aliciAd.trim() || undefined,
          soyad: aliciSoyad.trim() || undefined,
          vergiDairesi: aliciVd.trim() || undefined,
          il: aliciIl.trim() || undefined,
          ilce: aliciIlce.trim() || undefined,
        },
        satirlar,
        iadeFaturalar: iadeMi ? iadeFaturalar : undefined,
        dovizKuru: dovizliMi && dovizKuru ? { kur: Number(dovizKuru), tarih } : undefined,
      });

      setTaslakSonuc(cevap);
      setTaslakOnayAcik(false);
      setAlertInfo({
        type: "success",
        message: `Taslak oluşturuldu (${cevap.belgeNo}). Belge GİB'e gönderilmedi; giden kutusundan iptal edebilirsiniz.`,
      });
    } catch (err: any) {
      setAlertInfo({ type: "danger", message: err?.message || "Taslak oluşturulamadı." });
    } finally {
      setTaslakGonderiliyor(false);
    }
  };

  const earsivMi = senaryo === "EARSIVFATURA";

  /** Faturayı doğrudan GİB'e gönderir — GERİ ALINAMAZ */
  const faturaGonder = async () => {
    setAlertInfo(null);
    setTaslakGonderiliyor(true);
    try {
      const cevap = await ebelgeService.faturaGonder(istekGovdesi());
      setTaslakSonuc(cevap as any);
      setTaslakOnayAcik(false);
      setAlertInfo({
        type: "success",
        message:
          `e-Fatura GİB'e gönderildi (${cevap.belgeNo}).` +
          (cevap.kontorUyari ? ` ${cevap.kontorUyari}` : ""),
      });
    } catch (err: any) {
      setAlertInfo({ type: "danger", message: err?.message || "Fatura gönderilemedi." });
    } finally {
      setTaslakGonderiliyor(false);
    }
  };

  const earsivGonder = async () => {
    if (!taslakVerilebilir || taslakGonderiliyor) return;
    setAlertInfo(null);
    setTaslakGonderiliyor(true);
    try {
      const cevap = await ebelgeService.earsivGonder({
        uuid: sonuc!.uuid,
        saat: new DOMParser().parseFromString(sonuc!.xml, "application/xml").getElementsByTagName("cbc:IssueTime")[0]?.textContent || undefined,
        belgeNo: belgeNo.trim().toUpperCase(),
        tarih,
        senaryo: "EARSIVFATURA",
        faturaTipi,
        paraBirimi,
        notlar: not.trim() ? [not.trim()] : undefined,
        alici: {
          vknTckn: aliciVkn.trim(),
          unvan: aliciUnvan.trim() || undefined,
          ad: aliciAd.trim() || undefined,
          soyad: aliciSoyad.trim() || undefined,
          vergiDairesi: aliciVd.trim() || undefined,
          il: aliciIl.trim() || undefined,
          ilce: aliciIlce.trim() || undefined,
        },
        satirlar,
        iadeFaturalar: iadeMi ? iadeFaturalar : undefined,
        dovizKuru: dovizliMi && dovizKuru ? { kur: Number(dovizKuru), tarih } : undefined,
      });

      setTaslakSonuc(cevap);
      setTaslakOnayAcik(false);
      setAlertInfo({
        type: "success",
        message: `e-Arsiv faturasi gonderildi (${cevap.belgeNo}). Giden kutusundan durumunu izleyebilirsiniz.`,
      });
    } catch (err: any) {
      setAlertInfo({ type: "danger", message: err?.message || "e-Arsiv gonderilemedi." });
    } finally {
      setTaslakGonderiliyor(false);
    }
  };

  const taslakVerilebilir = Boolean(
    sonuc && dogrulamaGuncel && sonuc.semaGecerli && sonuc.schematronGecerli && !taslakSonuc && !dogrulaniyor
      && !turBelirsiz && !mukellefSorgulaniyor
  );

  return (
    <div className="ebelge-dogrula-container container-fluid px-2 py-2">
      <ERPToolbar
        pageTitle="E- Belge Doğrulama"
        pageIcon={<IconFileCheck size={22} className="text-primary" />}
        onSave={dogrula}
        onNew={() => {
          setBelgeNo("");
          setSatirlar([{ ...BOS_SATIR }]);
          setSonuc(null);
          setAlertInfo(null);
        }}
        onPrint={() => window.print()}
        disabled={dogrulaniyor || taslakGonderiliyor || mukellefSorgulaniyor}
      />

      {satirlar.some((s) => s.kdvOrani === 0) && (
        <Alert variant="warning" className="py-2 px-3 mb-3 border rounded shadow-2xs small">
          <IconAlertTriangle size={15} className="me-1" />
          KDV oranı <strong>0</strong> olan satır var. GİB istisna kodu zorunludur; doğru kodu
          <strong> mali müşavirinizden</strong> teyit ediniz — uygulama kod önermez.
        </Alert>
      )}

      <Alert variant="info" className="py-2 px-3 mb-3 border rounded shadow-2xs small">
        <IconShieldCheck size={15} className="me-1" />
        <strong>Doğrula</strong> işlemi belge göndermez. Sonraki onay adımında e-Fatura taslağı
        oluşturulabilir veya <strong>gerçek e-Arşiv faturası gönderilebilir</strong>.
        e-Arşiv gönderimi şu anda TRY cinsinden, pozitif KDV oranlı SATIS belgeleriyle sınırlıdır.
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

      <fieldset disabled={dogrulaniyor || taslakGonderiliyor || mukellefSorgulaniyor}>
      <Card className="shadow-sm border border-secondary-subtle rounded-3 overflow-hidden mb-3">
        <Card.Body className="p-3 bg-body">
          <div className="fw-semibold mb-2" style={{ fontSize: "13px" }}>
            Belge Bilgileri
          </div>
          <Row className="g-2">
            <Col xs={12} md={4} lg={3}>
              <Form.Label className="small mb-1">Fatura No</Form.Label>
              <Form.Control
                size="sm"
                value={belgeNo}
                onChange={(e) => setBelgeNo(e.target.value.toUpperCase())}
                placeholder="ABC2026000000001"
                className="font-monospace"
                maxLength={16}
              />
              <div className="text-secondary" style={{ fontSize: "11.5px" }}>
                3 harf seri + 13 hane
              </div>
            </Col>
            <Col xs={6} md={3} lg={2}>
              <Form.Label className="small mb-1">Tarih</Form.Label>
              <Form.Control
                size="sm"
                type="date"
                className="custom-date-input"
                value={tarih}
                onChange={(e) => setTarih(e.target.value)}
              />
            </Col>
            <Col xs={6} md={3} lg={2}>
              <Form.Label className="small mb-1">Senaryo</Form.Label>
              <Form.Select size="sm" value={senaryo} onChange={(e) => setSenaryo(e.target.value as EbelgeSenaryo)}>
                <option value="TICARIFATURA">Ticari Fatura</option>
                <option value="TEMELFATURA">Temel Fatura</option>
                <option value="EARSIVFATURA">e-Arşiv Fatura</option>
                <option value="YATIRIMTESVIK">Yatırım Teşvik</option>
                <option value="KAMU">Kamu</option>
              </Form.Select>
            </Col>
            <Col xs={6} md={3} lg={2}>
              <Form.Label className="small mb-1">Fatura Tipi</Form.Label>
              <Form.Select
                size="sm"
                value={faturaTipi}
                onChange={(e) => setFaturaTipi(e.target.value as EbelgeFaturaTipi)}
              >
                <option value="SATIS">Satış</option>
                <option value="IADE">İade</option>
                <option value="TEVKIFAT">Tevkifat</option>
                <option value="ISTISNA">İstisna</option>
                <option value="OZELMATRAH">Özel Matrah</option>
                <option value="IHRACKAYITLI">İhraç Kayıtlı</option>
                <option value="TEKNOLOJIDESTEK">Teknoloji Destek</option>
              </Form.Select>
            </Col>
            <Col xs={6} md={3} lg={1}>
              <Form.Label className="small mb-1">Döviz</Form.Label>
              <Form.Select size="sm" value={paraBirimi} onChange={(e) => setParaBirimi(e.target.value)}>
                <option value="TRY">TRY</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </Form.Select>
            </Col>
            <Col xs={12} lg={2}>
              <Form.Label className="small mb-1">Not</Form.Label>
              <Form.Control size="sm" value={not} onChange={(e) => setNot(e.target.value)} maxLength={200} />
            </Col>
          </Row>

          {(dovizliMi || iadeMi) && (
            <>
              <div className="fw-semibold mt-3 mb-2" style={{ fontSize: "13px" }}>
                Mali Bilgiler
              </div>
              <Row className="g-2">
                {dovizliMi && (
                  <Col xs={6} md={3} lg={2}>
                    <Form.Label className="small mb-1">
                      TL Karşılığı Kur <span style={{ color: "#dc2626" }}>*</span>
                    </Form.Label>
                    <Form.Control
                      size="sm"
                      type="number"
                      step="0.0001"
                      min={0}
                      className="text-end font-monospace"
                      value={dovizKuru}
                      onChange={(e) => setDovizKuru(e.target.value)}
                      placeholder="42,1500"
                    />
                    <div className="text-secondary" style={{ fontSize: "11.5px" }}>
                      1 {paraBirimi} kaç TL
                    </div>
                  </Col>
                )}

                {iadeMi && (
                  <Col xs={12}>
                    <div className="d-flex align-items-center justify-content-between mb-1">
                      <Form.Label className="small mb-0">
                        İade Edilen Fatura(lar) <span style={{ color: "#dc2626" }}>*</span>
                      </Form.Label>
                      <Button
                        size="sm"
                        variant="outline-secondary"
                        onClick={() =>
                          setIadeFaturalar((o) => [...o, { belgeNo: "", tarih: bugunISO() }])
                        }
                        className="d-flex align-items-center gap-1"
                      >
                        <IconPlus size={14} />
                        Referans Ekle
                      </Button>
                    </div>
                    {iadeFaturalar.length === 0 ? (
                      <div className="text-secondary small">
                        İade faturasında, iade edilen asıl fatura bilgisi zorunludur.
                      </div>
                    ) : (
                      iadeFaturalar.map((ref, i) => (
                        <Row className="g-2 mb-1" key={i}>
                          <Col xs={6} md={4} lg={3}>
                            <Form.Control
                              size="sm"
                              className="font-monospace"
                              placeholder="ABC2025000000001"
                              value={ref.belgeNo}
                              onChange={(e) =>
                                setIadeFaturalar((o) =>
                                  o.map((r, idx) =>
                                    idx === i ? { ...r, belgeNo: e.target.value.toUpperCase() } : r
                                  )
                                )
                              }
                            />
                          </Col>
                          <Col xs={5} md={3} lg={2}>
                            <Form.Control
                              size="sm"
                              type="date"
                              className="custom-date-input"
                              value={ref.tarih}
                              onChange={(e) =>
                                setIadeFaturalar((o) =>
                                  o.map((r, idx) => (idx === i ? { ...r, tarih: e.target.value } : r))
                                )
                              }
                            />
                          </Col>
                          <Col xs={1}>
                            <Button
                              size="sm"
                              variant="link"
                              className="p-0"
                              style={{ color: "#dc2626" }}
                              onClick={() => setIadeFaturalar((o) => o.filter((_, idx) => idx !== i))}
                              title="Referansı sil"
                            >
                              <IconTrash size={16} />
                            </Button>
                          </Col>
                        </Row>
                      ))
                    )}
                  </Col>
                )}
              </Row>
            </>
          )}

          <div className="fw-semibold mt-3 mb-2" style={{ fontSize: "13px" }}>
            Alıcı
          </div>
          <EBelgeCariSec onSelect={(cari, lookups) => {
            setAliciVkn(cari.vergiKimlikNo?.trim() || "");
            setAliciUnvan(cari.ad);
            const adlar = cari.ad.trim().split(/\s+/);
            setAliciSoyad(adlar.length > 1 ? adlar.pop()! : "");
            setAliciAd(adlar.join(" "));
            setAliciIl(lookups.ilList.find(x => x.id === cari.ilId)?.ad || "");
            setAliciIlce(lookups.ilceList.find(x => x.id === cari.ilceId)?.ad || "");
            setAliciVd(lookups.vergiDairesiList.find(x => x.id === cari.vergiDairesiId)?.ad || "");
            setSonuc(null); setDogrulananGirdi(""); setTaslakOnayAcik(false);
            setAlertInfo({ type: "info", message: "Cari seçildi. Ad soyad ve adresi kontrol edip Mükellef Sorgula ile belge türünü belirleyin." });
          }} />
          <Row className="g-2">
            <Col xs={6} md={3} lg={2}>
              <Form.Label className="small mb-1">VKN / TCKN</Form.Label>
              <Button size="sm" variant="outline-primary" className="mb-1" disabled={mukellefSorgulaniyor}
                onClick={() => { otomatikDenenen.current = ""; void mukellefSorgula(); }}>
                {mukellefSorgulaniyor ? "Sorgulanıyor…" : "Mükellef Sorgula"}
              </Button>
              <Form.Control
                size="sm"
                value={aliciVkn}
                onChange={(e) => setAliciVkn(e.target.value.replace(/\D/g, ""))}
                maxLength={11}
                className="font-monospace"
              />
            </Col>
            {tcknMi ? (
              <>
                <Col xs={6} md={3} lg={2}>
                  <Form.Label className="small mb-1">Ad</Form.Label>
                  <Form.Control size="sm" value={aliciAd} onChange={(e) => setAliciAd(e.target.value)} />
                </Col>
                <Col xs={6} md={3} lg={2}>
                  <Form.Label className="small mb-1">Soyad</Form.Label>
                  <Form.Control size="sm" value={aliciSoyad} onChange={(e) => setAliciSoyad(e.target.value)} />
                </Col>
              </>
            ) : (
              <Col xs={12} md={6} lg={4}>
                <Form.Label className="small mb-1">Unvan</Form.Label>
                <Form.Control size="sm" value={aliciUnvan} onChange={(e) => setAliciUnvan(e.target.value)} />
              </Col>
            )}
            <Col xs={6} md={3} lg={2}>
              <Form.Label className="small mb-1">Vergi Dairesi</Form.Label>
              <Form.Control size="sm" value={aliciVd} onChange={(e) => setAliciVd(e.target.value)} />
            </Col>
            <Col xs={6} md={3} lg={2}>
              <Form.Label className="small mb-1">İl <span className="text-danger">*</span></Form.Label>
              <Form.Control size="sm" value={aliciIl} onChange={(e) => setAliciIl(e.target.value)} />
            </Col>
            <Col xs={6} md={3} lg={2}>
              <Form.Label className="small mb-1">İlçe <span className="text-danger">*</span></Form.Label>
              <Form.Control size="sm" value={aliciIlce} onChange={(e) => setAliciIlce(e.target.value)} />
            </Col>
          </Row>
        </Card.Body>
      </Card>

      <Card className="shadow-sm border border-secondary-subtle rounded-3 overflow-hidden mb-3">
        <Card.Body className="p-3 bg-body">
          <div className="d-flex align-items-center justify-content-between mb-2">
            <span className="fw-semibold" style={{ fontSize: "13px" }}>
              Mal / Hizmet Satırları
            </span>
            <Button
              size="sm"
              variant="outline-secondary"
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
                  <th>Mal / Hizmet</th>
                  <th style={{ width: "100px" }}>Miktar</th>
                  <th style={{ width: "110px" }}>Birim</th>
                  <th style={{ width: "130px" }}>Birim Fiyat</th>
                  <th style={{ width: "100px" }}>İsk. %</th>
                  <th style={{ width: "100px" }}>KDV %</th>
                  <th style={{ width: "120px" }}>İstisna Kodu</th>
                  {tevkifatliMi && <th style={{ width: "150px" }}>Tevkifat</th>}
                  <th style={{ width: "130px" }} className="text-end">
                    Tutar
                  </th>
                  <th style={{ width: "50px" }} />
                </tr>
              </thead>
              <tbody>
                {satirlar.map((satir, i) => {
                  const brut = (satir.miktar || 0) * (satir.birimFiyat || 0);
                  const matrah = brut - (brut * (satir.iskontoOrani || 0)) / 100;
                  return (
                    <tr key={i}>
                      <td className="text-secondary">{i + 1}</td>
                      <td>
                        <Form.Control
                          size="sm"
                          value={satir.ad}
                          onChange={(e) => satirDegistir(i, "ad", e.target.value)}
                          placeholder="Örn: 22 Ayar Bilezik"
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
                          onChange={(e) => satirDegistir(i, "miktar", Number(e.target.value))}
                        />
                      </td>
                      <td>
                        <Form.Select
                          size="sm"
                          value={satir.birimKodu}
                          onChange={(e) => satirDegistir(i, "birimKodu", e.target.value)}
                        >
                          {EBELGE_BIRIMLER.map((b) => (
                            <option key={b.kod} value={b.kod}>
                              {b.ad}
                            </option>
                          ))}
                        </Form.Select>
                      </td>
                      <td>
                        <Form.Control
                          size="sm"
                          type="number"
                          min={0}
                          step="0.01"
                          className="text-end font-monospace"
                          value={satir.birimFiyat}
                          onChange={(e) => satirDegistir(i, "birimFiyat", Number(e.target.value))}
                        />
                      </td>
                      <td>
                        <Form.Control
                          size="sm"
                          type="number"
                          min={0}
                          max={99}
                          className="text-end font-monospace"
                          value={satir.iskontoOrani}
                          onChange={(e) => satirDegistir(i, "iskontoOrani", Number(e.target.value))}
                        />
                      </td>
                      <td>
                        <Form.Control
                          size="sm"
                          type="number"
                          min={0}
                          max={100}
                          className="text-end font-monospace"
                          value={satir.kdvOrani}
                          onChange={(e) => satirDegistir(i, "kdvOrani", Number(e.target.value))}
                        />
                      </td>
                      <td>
                        <Form.Control
                          size="sm"
                          className="font-monospace"
                          placeholder={satir.kdvOrani === 0 ? "zorunlu" : "-"}
                          value={satir.istisnaKodu || ""}
                          disabled={satir.kdvOrani !== 0}
                          isInvalid={satir.kdvOrani === 0 && !satir.istisnaKodu?.trim()}
                          onChange={(e) => satirDegistir(i, "istisnaKodu", e.target.value.trim())}
                          title="GİB KDV istisna kodu (mali müşavirinizden alınır)"
                        />
                      </td>
                      {tevkifatliMi && (
                        <td>
                          <div className="d-flex gap-1">
                            <Form.Control
                              size="sm"
                              className="font-monospace"
                              placeholder="kod"
                              style={{ width: "60px" }}
                              value={satir.tevkifatKodu || ""}
                              onChange={(e) => satirDegistir(i, "tevkifatKodu", e.target.value.trim())}
                            />
                            <Form.Control
                              size="sm"
                              type="number"
                              min={0}
                              max={100}
                              className="text-end font-monospace"
                              placeholder="%"
                              value={satir.tevkifatOrani ?? ""}
                              onChange={(e) =>
                                satirDegistir(
                                  i,
                                  "tevkifatOrani",
                                  e.target.value === "" ? undefined : Number(e.target.value)
                                )
                              }
                            />
                          </div>
                        </td>
                      )}
                      <td className="text-end font-monospace">{ebelgeTutar(matrah, paraBirimi)}</td>
                      <td className="text-center">
                        <Button
                          size="sm"
                          variant="link"
                          className="p-0"
                          style={{ color: "#dc2626" }}
                          disabled={satirlar.length <= 1}
                          onClick={() => setSatirlar((o) => o.filter((_, idx) => idx !== i))}
                          title="Satırı sil"
                        >
                          <IconTrash size={16} />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </div>

          <div className="d-flex flex-wrap justify-content-end gap-4 mt-3 pt-2 border-top" style={{ fontSize: "13px" }}>
            <span className="text-secondary">
              İskonto: <span className="font-monospace">{ebelgeTutar(yerelToplam.iskonto, paraBirimi)}</span>
            </span>
            <span className="text-secondary">
              Matrah: <span className="font-monospace">{ebelgeTutar(yerelToplam.matrah, paraBirimi)}</span>
            </span>
            <span className="text-secondary">
              KDV: <span className="font-monospace">{ebelgeTutar(yerelToplam.kdv, paraBirimi)}</span>
            </span>
            {yerelToplam.tevkifat > 0 && (
              <span className="text-secondary">
                Tevkifat:{" "}
                <span className="font-monospace">-{ebelgeTutar(yerelToplam.tevkifat, paraBirimi)}</span>
              </span>
            )}
            <span className="fw-semibold">
              Ödenecek: <span className="font-monospace">{ebelgeTutar(yerelToplam.toplam, paraBirimi)}</span>
            </span>
          </div>

          <div className="d-flex align-items-center gap-2 mt-3">
            <Button
              size="sm"
              variant="primary"
              onClick={dogrula}
              disabled={dogrulaniyor}
              className="d-flex align-items-center gap-1"
            >
              {dogrulaniyor ? <Spinner animation="border" size="sm" /> : <IconFileCheck size={16} />}
              Doğrula (gönderme yok)
            </Button>
          </div>
        </Card.Body>
      </Card>

      </fieldset>
      {mukellefSorgulaniyor && (
        <Alert variant="info" className="py-2 px-3 mb-3 border rounded shadow-2xs small">
          Alıcının e-Fatura mükellefiyeti sorgulanıyor; belge türü sonuca göre seçilecek…
        </Alert>
      )}
      {turBelirsiz && !mukellefSorgulaniyor && (
        <Alert variant="warning" className="py-2 px-3 mb-3 border rounded shadow-2xs small">
          <IconAlertTriangle size={15} className="me-1" />
          Bu numara için mükellef sorgusu sonuçlanmadı; <strong>e-Fatura mı e-Arşiv mi olduğu belirlenmedi</strong>.
          Sorgu tamamlanmadan gönderim yapılamaz — <strong>Mükellef Sorgula</strong> ile tekrar deneyin.
        </Alert>
      )}
      {sonuc && !dogrulamaGuncel && <Alert variant="warning">Belge bilgileri değişti. Göndermeden önce yeniden doğrulayınız.</Alert>}
      {sonuc && dogrulamaGuncel && (
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
              <span className="ms-auto fw-semibold small">
                Ödenecek: {ebelgeTutar(sonuc.ozet.odenecekTutar, paraBirimi)}
              </span>
            </div>

            {sonuc.mesaj && (
              <Alert
                variant={sonuc.semaGecerli && sonuc.schematronGecerli ? "info" : "danger"}
                className="py-2 px-3 mb-3 border rounded shadow-2xs small"
              >
                {sonuc.mesaj}
              </Alert>
            )}

            {taslakVerilebilir && (
              <div className="border rounded-2 p-3 mb-3 shadow-2xs">
                {!taslakOnayAcik ? (
                  <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
                    <span className="small text-secondary">
                      {earsivMi
                        ? "Belge doğrulamadan geçti. e-Arşiv faturası olarak gönderebilirsiniz."
                        : "Belge doğrulamadan geçti. Taslak oluşturabilir (GİB'e gitmez, iptal edilebilir) ya da doğrudan GİB'e gönderebilirsiniz."}
                    </span>
                    <div className="d-flex gap-2">
                      {earsivMi ? (
                        <Button
                          size="sm"
                          variant="outline-danger"
                          onClick={() => {
                            setIslem("earsiv");
                            setTaslakOnayAcik(true);
                          }}
                          className="d-flex align-items-center gap-1"
                        >
                          <IconFileDots size={15} />
                          e-Arşiv Gönder
                        </Button>
                      ) : (
                        <>
                          <Button
                            size="sm"
                            variant="outline-primary"
                            onClick={() => {
                              setIslem("taslak");
                              setTaslakOnayAcik(true);
                            }}
                            className="d-flex align-items-center gap-1"
                          >
                            <IconFileDots size={15} />
                            Taslak Oluştur
                          </Button>
                          <Button
                            size="sm"
                            variant="outline-danger"
                            onClick={() => {
                              setIslem("gonder");
                              setTaslakOnayAcik(true);
                            }}
                            className="d-flex align-items-center gap-1"
                          >
                            <IconSend size={15} />
                            GİB'e Gönder
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ) : (
                  <div>
                    <Alert
                      variant={islem === "taslak" ? "warning" : "danger"}
                      className="py-2 px-3 mb-2 border rounded shadow-2xs small"
                    >
                      <IconAlertTriangle size={15} className="me-1" />
                      {islem === "taslak" ? (
                        <>
                          Belge entegratörde <strong>taslak</strong> olarak oluşturulacak.
                          <strong> GİB'e gönderilmeyecek.</strong> Bu adımda fatura numarası (
                          {belgeNo.toUpperCase()}) kullanılmış sayılır ve aynı numara ikinci kez
                          kullanılamaz.
                        </>
                      ) : (
                        <>
                          <strong>
                            {islem === "earsiv" ? "e-Arşiv faturası kesilecek." : "Fatura GİB'e gönderilecek."}
                          </strong>{" "}
                          Bu gerçek bir faturadır ve <strong>geri alınamaz</strong>
                          {islem === "earsiv"
                            ? " — yalnızca iptal bildirimi gönderilebilir."
                            : " — düzeltme için alıcının red cevabı ya da iade faturası gerekir."}
                          <br />
                          Alıcı: <strong>{aliciUnvan || `${aliciAd} ${aliciSoyad}`.trim()}</strong> (
                          {aliciVkn}) · Belge No: <strong>{belgeNo.toUpperCase()}</strong> · Tutar:{" "}
                          <strong>{ebelgeTutar(sonuc.ozet.odenecekTutar, paraBirimi)}</strong>
                        </>
                      )}
                    </Alert>
                    <div className="d-flex gap-2">
                      <Button
                        size="sm"
                        variant={islem === "taslak" ? "primary" : "danger"}
                        onClick={
                          islem === "earsiv"
                            ? earsivGonder
                            : islem === "gonder"
                              ? faturaGonder
                              : taslakOlustur
                        }
                        disabled={taslakGonderiliyor}
                        className="d-flex align-items-center gap-1"
                      >
                        {taslakGonderiliyor ? <Spinner animation="border" size="sm" /> : null}
                        {islem === "earsiv"
                          ? "Evet, e-Arşiv faturasını gönder"
                          : islem === "gonder"
                            ? "Evet, faturayı GİB'e gönder"
                            : "Evet, taslak oluştur"}
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setTaslakOnayAcik(false)}
                        disabled={taslakGonderiliyor}
                      >
                        Vazgeç
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {taslakSonuc && (
              <Alert variant="success" className="py-2 px-3 mb-3 border rounded shadow-2xs small">
                {earsivMi ? "e-Arşiv faturası gönderildi" : "Taslak oluşturuldu"} —{" "}
                <strong>{taslakSonuc.belgeNo}</strong>
                {taslakSonuc.ettn ? ` · ETTN: ${taslakSonuc.ettn}` : ""}.
                {earsivMi
                  ? " Giden kutusundan raporlanma durumunu izleyebilirsiniz."
                  : " Belge GİB'e gönderilmedi; giden kutusundan iptal edebilirsiniz."}
              </Alert>
            )}

            {sonuc.html && (
              <>
                <div className="fw-semibold mb-2" style={{ fontSize: "13px" }}>
                  Önizleme
                </div>
                <div className="border rounded-2 overflow-hidden" style={{ height: "55vh" }}>
                  {/* Üçüncü tarafın ürettiği HTML — sandbox boş, allow-same-origin yok (§11.1 S5) */}
                  <iframe
                    title="Belge önizleme"
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

export default EBelgeDogrulaPage;
