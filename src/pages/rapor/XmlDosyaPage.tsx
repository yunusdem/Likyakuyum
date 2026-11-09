import React, { useState, useEffect, useMemo } from "react";
import {
  IconFileCode,
  IconCheck,
  IconAlertTriangle,
  IconBuilding,
  IconCoins,
  IconReceipt,
  IconListDetails,
  IconFolder,
  IconDownload,
  IconCopy,
  IconArrowsJoin,
  IconPrinter,
  IconSearch,
  IconX,
  IconZoomIn,
  IconZoomOut,
  IconMinus,
  IconPlus,
  IconChevronUp,
  IconAdjustments,
  IconRefresh,
  IconReportAnalytics,
} from "@tabler/icons-react";
import { Button, Card, Col, Form, Row, Spinner, Table, Badge } from "react-bootstrap";
import {
  XmlDosyaService,
  MerkezKurKontrolItem,
  FirmaKontrolResult,
  FisKontrolItem,
  FisSatirKontrolItem,
  XmlOlusturResult,
  XmlBirlestirResult,
} from "../../services/xmlDosyaService";
import { CompanyService } from "../../services/companyService";
import { trTarihBicimi, trSayiBicimi } from "../../utils/intlOnbellek";
import { useToast } from "../../context/ToastContext";

type IslemModu = "kontrol" | "olusturma" | "birlestirme";
type KontrolTuru = "merkezKur" | "firma" | "fis" | "fisSatiri";

export default function XmlDosyaPage() {
  const bugun = new Date();
  const ayinIlkGunu = new Date(bugun.getFullYear(), bugun.getMonth(), 1);

  const formatIsoDate = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const gun = (kaydir = 0) => {
    const d = new Date();
    d.setDate(d.getDate() + kaydir);
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Istanbul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);
  };

  const buAyBasi = () => {
    const d = new Date();
    d.setDate(1);
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Istanbul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);
  };

  // Form State
  const [bildirimTuru] = useState<string>("Döviz");
  const [islemModu, setIslemModu] = useState<IslemModu>("kontrol");
  const [kontrolTuru, setKontrolTuru] = useState<KontrolTuru>("merkezKur");

  // Filtreler
  const [ilkTarih, setIlkTarih] = useState<string>(formatIsoDate(ayinIlkGunu));
  const [sonTarih, setSonTarih] = useState<string>(formatIsoDate(bugun));
  const [hazirlamaTarihi, setHazirlamaTarihi] = useState<string>(formatIsoDate(bugun));
  const [belgeIslemNo, setBelgeIslemNo] = useState<string>("");
  const [belgeIslemNoTuru, setBelgeIslemNoTuru] = useState<"seri" | "belge">("seri");

  // Kullanıcı Talebi: TL ve Dolar vergi sınırını geçenleri getirme
  const [tlVergiSiniri, setTlVergiSiniri] = useState<number>(185000);
  const [dovizVergiSiniri, setDovizVergiSiniri] = useState<number>(5000);

  // [I- Vergiler ve Komisyon] Sayfa Dizaynı: Parametreler paneli aç/kapat & Uygula akışı
  const [parametreAcik, setParametreAcik] = useState<boolean>(true);

  // Dosya Oluşturma parametreleri
  const [dosyaNo, setDosyaNo] = useState<string>("0");
  const [islemYok, setIslemYok] = useState<boolean>(false);
  const [aciklama, setAciklama] = useState<string>("");
  const [dosyaAdi, setDosyaAdi] = useState<string>("dov2601");

  // Toast Bildirimleri (Sayfa Ortası Popup ve Hover Pause Destekli)
  const { showSuccess, showError, showWarning, showInfo } = useToast();

  // Dosya Birleştirme
  const [kaynakXmlText, setKaynakXmlText] = useState<string>("");
  const [kaynakDosyaAdi, setKaynakDosyaAdi] = useState<string>("");
  const [hedefXmlText, setHedefXmlText] = useState<string>("");
  const [hedefDosyaAdi, setHedefDosyaAdi] = useState<string>("");

  // Yükleme & Durum
  const [yukleniyor, setYukleniyor] = useState<boolean>(false);
  const [aramaMetni, setAramaMetni] = useState<string>("");
  const [durumHataFiltresi, setDurumHataFiltresi] = useState<string>("hatali");
  const [tabloYaziBoyutu, setTabloYaziBoyutu] = useState<number>(11);
  const handleTabloBuyut = () => setTabloYaziBoyutu((prev) => Math.min(prev + 1, 20));
  const handleTabloKucult = () => setTabloYaziBoyutu((prev) => Math.max(prev - 1, 8));
  const handleTabloBoyutSifirla = () => setTabloYaziBoyutu(11);
  const tabloGenislikYuzde = Math.max(100, Math.round(((tabloYaziBoyutu - 11) * 18) + 100));

  // Kontrol Sonuçları
  const [merkezKurSonuclari, setMerkezKurSonuclari] = useState<MerkezKurKontrolItem[]>([]);
  const [firmaSonucu, setFirmaSonucu] = useState<FirmaKontrolResult | null>(null);
  const [fisSonuclari, setFisSonuclari] = useState<FisKontrolItem[]>([]);
  const [fisSatirSonuclari, setFisSatirSonuclari] = useState<FisSatirKontrolItem[]>([]);

  // Oluşturma / Birleştirme Çıktıları
  const [olusturulanXml, setOlusturulanXml] = useState<XmlOlusturResult | null>(null);
  const [birlestirilenXml, setBirlestirilenXml] = useState<XmlBirlestirResult | null>(null);
  const [birlestirmeSekmesi, setBirlestirmeSekmesi] = useState<"sonuc" | "kaynak" | "hedef">("sonuc");

  // Dosya adı güncelleme
  useEffect(() => {
    const d = new Date(ilkTarih || new Date());
    const yilKisa = String(d.getFullYear()).slice(2);
    const ayKisa = String(d.getMonth() + 1).padStart(2, "0");
    const dNo = String(parseInt(dosyaNo, 10) || 0).padStart(3, "0");
    setDosyaAdi(`dov${yilKisa}${ayKisa}_${dNo}.xml`);
  }, [ilkTarih, dosyaNo]);

  // Sayfa ilk açıldığında firma vergi sınırlarını ve Merkez Bankası Kur Kontrol Tablosunu yükle
  useEffect(() => {
    let aktif = true;
    const ilkYukleme = async () => {
      setYukleniyor(true);
      try {
        let tlLimit = 185000;
        let dovizLimit = 5000;
        try {
          const def = await CompanyService.getDefinitions();
          if (def?.TL_VERGI_SINIRI !== undefined && def?.TL_VERGI_SINIRI !== null) {
            tlLimit = Number(def.TL_VERGI_SINIRI);
            if (aktif) setTlVergiSiniri(tlLimit);
          }
          if (def?.DOVIZ_VERGI_SINIRI !== undefined && def?.DOVIZ_VERGI_SINIRI !== null) {
            dovizLimit = Number(def.DOVIZ_VERGI_SINIRI);
            if (aktif) setDovizVergiSiniri(dovizLimit);
          }
        } catch {}

        const [kurData, firmaData] = await Promise.all([
          XmlDosyaService.kontrolMerkezKur({
            ilkTarih,
            sonTarih,
            belgeIslemNo: belgeIslemNo || undefined,
            belgeIslemNoTuru,
            tlVergiSiniri: tlLimit,
            dovizVergiSiniri: dovizLimit,
          }),
          XmlDosyaService.kontrolFirma(),
        ]);
        if (!aktif) return;
        setMerkezKurSonuclari(kurData);
        setFirmaSonucu(firmaData);
        const kurHataVar = kurData.some((d) => d.durum === "hata");
        if (kurHataVar) {
          showWarning("Bazı işlem tarihlerinde Merkez Bankası kuru tanımlı değil!");
        }
      } catch (err: any) {
        if (!aktif) return;
        showError(err.message || "Merkez kur verileri yüklenirken hata oluştu.");
      } finally {
        if (aktif) setYukleniyor(false);
      }
    };

    ilkYukleme();

    return () => {
      aktif = false;
    };
  }, []);

  // 1. Merkez Kur Kontrolü
  const handleMerkezKurKontrol = async (overrideIlk?: string, overrideSon?: string) => {
    const ilk = overrideIlk ?? ilkTarih;
    const son = overrideSon ?? sonTarih;
    setKontrolTuru("merkezKur");
    setDurumHataFiltresi("hatali");
    setYukleniyor(true);
    try {
      const data = await XmlDosyaService.kontrolMerkezKur({
        ilkTarih: ilk,
        sonTarih: son,
        belgeIslemNo: belgeIslemNo || undefined,
        belgeIslemNoTuru,
        tlVergiSiniri,
        dovizVergiSiniri,
      });
      setMerkezKurSonuclari(data);
      const hataVar = data.some((d) => d.durum === "hata");
      if (hataVar) {
        showWarning("Bazı işlem tarihlerinde Merkez Bankası kuru tanımlı değil!");
      }
    } catch (err: any) {
      showError(err.message || "Merkez kur kontrolü yapılırken hata oluştu.");
    } finally {
      setYukleniyor(false);
    }
  };

  // 2. Firma Kontrolü
  const handleFirmaKontrol = async () => {
    setKontrolTuru("firma");
    setDurumHataFiltresi("hatali");
    setYukleniyor(true);
    try {
      const data = await XmlDosyaService.kontrolFirma();
      setFirmaSonucu(data);
      if (!data.gecerli) {
        showError(`Firma bilgilerinde eksikler var: ${data.eksikler.join(", ")}`);
      }
    } catch (err: any) {
      showError(err.message || "Firma kontrolü yapılırken hata oluştu.");
    } finally {
      setYukleniyor(false);
    }
  };

  // 3. Fiş Kontrolü
  const handleFisKontrol = async (overrideIlk?: string, overrideSon?: string) => {
    const ilk = overrideIlk ?? ilkTarih;
    const son = overrideSon ?? sonTarih;
    setKontrolTuru("fis");
    setDurumHataFiltresi("hatali");
    setYukleniyor(true);
    try {
      const data = await XmlDosyaService.kontrolFis({
        ilkTarih: ilk,
        sonTarih: son,
        belgeIslemNo: belgeIslemNo || undefined,
        belgeIslemNoTuru,
      });
      setFisSonuclari(data);
      const hataliSayisi = data.filter((d) => !d.gecerli).length;
      if (hataliSayisi > 0) {
        showError(`${hataliSayisi} adet fişte eksik bilgi tespit edildi.`);
      }
    } catch (err: any) {
      showError(err.message || "Fiş kontrolü yapılırken hata oluştu.");
    } finally {
      setYukleniyor(false);
    }
  };

  // 4. Fiş Satırı Kontrolü
  const handleFisSatiriKontrol = async (overrideIlk?: string, overrideSon?: string) => {
    const ilk = overrideIlk ?? ilkTarih;
    const son = overrideSon ?? sonTarih;
    setKontrolTuru("fisSatiri");
    setDurumHataFiltresi("hatali");
    setYukleniyor(true);
    try {
      const data = await XmlDosyaService.kontrolFisSatiri({
        ilkTarih: ilk,
        sonTarih: son,
        belgeIslemNo: belgeIslemNo || undefined,
        belgeIslemNoTuru,
      });
      setFisSatirSonuclari(data);
      const hataliSayisi = data.filter((d) => !d.gecerli).length;
      if (hataliSayisi > 0) {
        showError(`${hataliSayisi} adet fiş satırında tutar veya döviz cinsi eksikliği var.`);
      }
    } catch (err: any) {
      showError(err.message || "Fiş satırı kontrolü yapılırken hata oluştu.");
    } finally {
      setYukleniyor(false);
    }
  };

  // Hızlı Tarih Seçimi (Bugün, Dün, Bu Ay, Son 7 Gün): Tarihleri günceller ve kontrolü doğrudan çalıştırır
  const handleHizliTarih = (ilk: string, son: string) => {
    setIlkTarih(ilk);
    setSonTarih(son);
    if (islemModu === "kontrol") {
      if (kontrolTuru === "merkezKur") {
        void handleMerkezKurKontrol(ilk, son);
      } else if (kontrolTuru === "fis") {
        void handleFisKontrol(ilk, son);
      } else if (kontrolTuru === "fisSatiri") {
        void handleFisSatiriKontrol(ilk, son);
      }
    }
  };

  // 5. XML Dosyası Oluştur / Önizle
  const handleXmlOlustur = async (diskeYaz: boolean = false) => {
    setYukleniyor(true);
    try {
      const res = await XmlDosyaService.olustur({
        bildirimTuru,
        hazirlamaTarihi,
        dosyaNo,
        islemYok,
        aciklama,
        belgeIslemNoTuru,
        dosyaAdi,
        ilkTarih,
        sonTarih,
      });

      setOlusturulanXml(res);
      if (diskeYaz) {
        await XmlDosyaService.diskeKaydet(res.xmlContent, res.dosyaAdi);
      }
    } catch (err: any) {
      showError(err.message || "XML oluşturulurken hata oluştu.");
    } finally {
      setYukleniyor(false);
    }
  };

  // XML Oluşturma moduna geçilince önizleme boşsa otomatik oluştur
  useEffect(() => {
    if (islemModu === "olusturma" && !olusturulanXml) {
      handleXmlOlustur(false);
    }
  }, [islemModu]);

  // 6. Dosya Seçiciler
  const handleKaynakDosyaSec = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setKaynakDosyaAdi(file.name);
      const reader = new FileReader();
      reader.onload = (event) => {
        setKaynakXmlText(String(event.target?.result || ""));
      };
      reader.readAsText(file, "UTF-8");
    }
  };

  const handleHedefDosyaSec = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setHedefDosyaAdi(file.name);
      const reader = new FileReader();
      reader.onload = (event) => {
        setHedefXmlText(String(event.target?.result || ""));
      };
      reader.readAsText(file, "UTF-8");
    }
  };

  // 7. Örnek Şube XML Verisi & Yükleme
  const ORNEK_SUBE_XML = `<?xml version="1.0" encoding="UTF-8" ?>
<vimveritransferi xsi:noNamespaceSchemaLocation="doviz_islemleri.xsd" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
\t<protokol>
\t\t<genel kuruluskodu="12">
\t\t\t<vkn>12239154164</vkn>
\t\t\t<unvan>LİKYA YETKİLİ MÜESSESE A.Ş.</unvan>
\t\t\t<adres>
\t\t\t\t<mahcadkapidaire>ATATÜRK CAD. NO:15</mahcadkapidaire>
\t\t\t\t<ilceadi>PAMUKKALE</ilceadi>
\t\t\t\t<pk>20100</pk>
\t\t\t\t<ilkodu>20</ilkodu>
\t\t\t</adres>
\t\t</genel>
\t\t<sube subekodu="124">
\t\t\t<unvan>LİKYA PAMUKKALE ŞUBESİ</unvan>
\t\t\t<adres>
\t\t\t\t<mahcadkapidaire>ATATÜRK CAD. NO:15</mahcadkapidaire>
\t\t\t\t<ilceadi>PAMUKKALE</ilceadi>
\t\t\t\t<pk>20100</pk>
\t\t\t\t<ilkodu>20</ilkodu>
\t\t\t</adres>
\t\t</sube>
\t\t<dosya hazirlanmatarihi="${hazirlamaTarihi}" dosyano="002" islemyok="H" bildirimturu="Döviz">
\t\t\t<bilgidonemi ilktarih="${ilkTarih}" sontarih="${sonTarih}" />
\t\t\t<aciklama>ŞUBE 1 DÖVİZ İŞLEMLERİ</aciklama>
\t\t</dosya>
\t</protokol>
\t<islemler toplamislemsayisi="2" toplamtutar="45000.00">
\t\t<islem kayitno="1">
\t\t\t<belge islemtarihi="${sonTarih}" belgeno="SUB0000001" kimlikbelgeturu="N">
\t\t\t\t<islemyapan uyruk="TR" kimlikno="22222222222" unvanadsoyad="AHMET YILMAZ" />
\t\t\t</belge>
\t\t\t<satirlar toplamsatirsayisi="1">
\t\t\t\t<satir satirstno="1" hareket="A" tutar="25000.00" dovizkodu="USD" doviztutari="750.00" />
\t\t\t</satirlar>
\t\t</islem>
\t\t<islem kayitno="2">
\t\t\t<belge islemtarihi="${sonTarih}" belgeno="SUB0000002" kimlikbelgeturu="N">
\t\t\t\t<islemyapan uyruk="TR" kimlikno="33333333333" unvanadsoyad="MEHMET DEMİR" />
\t\t\t</belge>
\t\t\t<satirlar toplamsatirsayisi="1">
\t\t\t\t<satir satirstno="1" hareket="S" tutar="20000.00" dovizkodu="EUR" doviztutari="550.00" />
\t\t\t</satirlar>
\t\t</islem>
\t</islemler>
</vimveritransferi>`;

  const handleOrnekSubeYukle = () => {
    setHedefDosyaAdi("ornek_sube_islemleri.xml");
    setHedefXmlText(ORNEK_SUBE_XML);
  };

  // 8. XML Birleştir
  const handleXmlBirlestir = async (diskeYaz: boolean = false) => {
    if (!kaynakXmlText || !hedefXmlText) {
      showError("Lütfen birleştirmek için hem kaynak hem de hedef XML dosyasını seçin.");
      return;
    }

    setYukleniyor(true);
    try {
      const res = await XmlDosyaService.birlestir({
        kaynakXml: kaynakXmlText,
        hedefXml: hedefXmlText,
        dosyaNo,
        hazirlamaTarihi,
      });

      setBirlestirilenXml(res);
      if (diskeYaz) {
        await XmlDosyaService.diskeKaydet(res.xmlContent, "birlestirilmis_doviz_islemleri.xml");
      }
    } catch (err: any) {
      showError(err.message || "Dosyalar birleştirilirken hata oluştu.");
    } finally {
      setYukleniyor(false);
    }
  };

  const handleKopyala = (metin: string) => {
    navigator.clipboard.writeText(metin);
  };

  // Sayı özetleri
  const fisHataliSayisi = fisSonuclari.filter((f) => !f.gecerli).length;
  const satirHataliSayisi = fisSatirSonuclari.filter((s) => !s.gecerli).length;
  const kurHataliSayisi = merkezKurSonuclari.filter((k) => k.durum === "hata").length;
  const detayGirildiSayisi = merkezKurSonuclari.filter((k) => k.detayDurumu === "girildi").length;
  const detayEksikSayisi = merkezKurSonuclari.filter((k) => k.detayDurumu === "eksik").length;
  const merkezKurHataliSayisi = merkezKurSonuclari.filter((k) => k.durum === "hata" || k.detayDurumu === "eksik").length;

  // [I- Vergiler ve Komisyon] Sayfa Dizaynı Uygula Eylemi
  const calistirUygula = async (overrideIlk?: string, overrideSon?: string) => {
    const ilk = overrideIlk ?? ilkTarih;
    const son = overrideSon ?? sonTarih;
    if (islemModu === "kontrol") {
      if (kontrolTuru === "merkezKur") {
        await handleMerkezKurKontrol(ilk, son);
      } else if (kontrolTuru === "firma") {
        await handleFirmaKontrol();
      } else if (kontrolTuru === "fis") {
        await handleFisKontrol(ilk, son);
      } else if (kontrolTuru === "fisSatiri") {
        await handleFisSatiriKontrol(ilk, son);
      }
    } else if (islemModu === "olusturma") {
      await handleXmlOlustur(false);
    } else if (islemModu === "birlestirme") {
      await handleXmlBirlestir(false);
    }
  };

  const handleUygula = () => {
    void calistirUygula();
  };

  const handleSifirla = () => {
    setIlkTarih(formatIsoDate(ayinIlkGunu));
    setSonTarih(formatIsoDate(bugun));
    setHazirlamaTarihi(formatIsoDate(bugun));
    setBelgeIslemNo("");
    setBelgeIslemNoTuru("seri");
    setTlVergiSiniri(185000);
    setDovizVergiSiniri(5000);
    setAramaMetni("");
    setDurumHataFiltresi("hatali");
  };

  const filtreOzeti = useMemo(() => {
    const p: string[] = [];
    p.push(`${ilkTarih} – ${sonTarih}`);
    if (islemModu === "kontrol") {
      if (kontrolTuru === "merkezKur") {
        p.push(`TL Sınırı: ${tlVergiSiniri.toLocaleString("tr-TR")} ₺`);
        p.push(`USD Sınırı: ${dovizVergiSiniri.toLocaleString("tr-TR")} $`);
      }
      if (belgeIslemNo) {
        p.push(`${belgeIslemNoTuru === "seri" ? "Seri" : "Belge"} No: ${belgeIslemNo}`);
      }
    } else if (islemModu === "olusturma") {
      p.push(`Dosya: ${dosyaAdi}`);
      if (dosyaNo) p.push(`No: ${dosyaNo}`);
    } else if (islemModu === "birlestirme") {
      p.push(`Kaynak: ${kaynakDosyaAdi || "Seçilmedi"}`);
      p.push(`Hedef: ${hedefDosyaAdi || "Seçilmedi"}`);
    }
    return p.join(" · ");
  }, [ilkTarih, sonTarih, islemModu, kontrolTuru, tlVergiSiniri, dovizVergiSiniri, belgeIslemNo, belgeIslemNoTuru, dosyaNo, dosyaAdi, kaynakDosyaAdi, hedefDosyaAdi]);

  return (
    <div className="xml-dosya-container p-2 d-flex flex-column gap-2" style={{ minHeight: "calc(100vh - 56px)" }}>
      {/* Özel Tablo Şerit Stilleri (Kullanıcı Talebi: Beyaz / Açık Mavi Şerit) */}
      <style>{`
        .xml-dosya-table {
          width: 100%;
          border-collapse: separate;
          border-spacing: 0;
          font-size: 0.83rem;
          color: #1e293b;
        }
        .xml-dosya-table thead th {
          background-color: #f1f5f9 !important;
          color: #334155 !important;
          font-weight: 700;
          padding: 6px 8px;
          border-bottom: 2px solid #cbd5e1;
          border-right: 1px solid #e2e8f0;
          white-space: nowrap;
        }
        .xml-dosya-table tbody tr:nth-of-type(odd) td {
          background-color: #ffffff !important;
          color: #0f172a !important;
        }
        .xml-dosya-table tbody tr:nth-of-type(even) td {
          background-color: #f0f7ff !important; /* Açık mavi şerit */
          color: #0f172a !important;
        }
        .xml-dosya-table tbody tr:hover td {
          background-color: #e0f2fe !important; /* Hover açık mavi */
        }
        .xml-dosya-table tbody tr.row-error td {
          background-color: #fff1f2 !important; /* Hatalı satır açık kırmızı */
          color: #991b1b !important;
        }
        .xml-dosya-table td {
          padding: 5px 8px;
          border-bottom: 1px solid #e2e8f0;
          border-right: 1px solid #e2e8f0;
        }
        .xml-dosya-table td:first-child, .xml-dosya-table th:first-child {
          border-left: 1px solid #e2e8f0;
        }

        /* Kompakt Fiş Kontrol Tablosu (Büyütüldüğünde sağa-sola kaydırılabilir) */
        .xml-dosya-compact-table {
          table-layout: fixed;
          border-collapse: separate;
          border-spacing: 0;
          font-size: 11px;
          color: #1e293b;
        }
        .xml-dosya-compact-table thead th {
          position: sticky;
          top: 0;
          z-index: 2;
          background-color: #f1f5f9 !important;
          color: #334155 !important;
          font-weight: 700;
          padding: 6px 5px;
          border-bottom: 2px solid #cbd5e1;
          border-right: 1px solid #e2e8f0;
          white-space: nowrap;
          font-size: inherit;
          line-height: 1.2;
        }
        .xml-dosya-compact-table tbody tr:nth-of-type(odd) td {
          background-color: #ffffff !important;
          color: #0f172a !important;
        }
        .xml-dosya-compact-table tbody tr:nth-of-type(even) td {
          background-color: #f0f7ff !important;
          color: #0f172a !important;
        }
        .xml-dosya-compact-table tbody tr:hover td {
          background-color: #e0f2fe !important;
        }
        .xml-dosya-compact-table tbody tr.row-error td {
          background-color: #fff1f2 !important;
          color: #991b1b !important;
        }
        .xml-dosya-compact-table td {
          padding: 3px 4px;
          border-bottom: 1px solid #e2e8f0;
          border-right: 1px solid #e2e8f0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          vertical-align: middle;
          font-size: inherit;
          line-height: 1.25;
        }
        .xml-dosya-compact-table td:first-child, .xml-dosya-compact-table th:first-child {
          border-left: 1px solid #e2e8f0;
        }
      `}</style>

      {/* 1. ÜST PANEL: [I- Vergiler ve Komisyon] Sayfa Dizaynı & Parametre Şeridi */}
      <Card className="border shadow-sm mb-1 bg-white">
        <Card.Body className="p-2">
          <div className="d-flex flex-wrap align-items-center gap-2 px-1">
            <div className="d-flex align-items-center gap-2">
              <IconFileCode size={20} className="text-primary flex-shrink-0" />
              <strong className="text-nowrap" style={{ fontSize: "0.95rem" }}>J- XML Dosya İşlemleri</strong>
              <span className="text-muted small text-nowrap d-none d-xl-inline">
                {islemModu === "kontrol" ? (
                  kontrolTuru === "merkezKur" ? `· ${merkezKurSonuclari.length} fiş` :
                  kontrolTuru === "firma" ? `· ${firmaSonucu?.gecerli ? "Firma Tamam" : "Eksik"}` :
                  kontrolTuru === "fis" ? `· ${fisSonuclari.length} fiş` :
                  `· ${fisSatirSonuclari.length} satır`
                ) : islemModu === "olusturma" ? "· XML Oluşturma" : "· XML Birleştirme"}
              </span>
            </div>

            {/* İşlem Modu: J- XML Dosya İşlemleri sağında ortalı */}
            <div className="d-flex justify-content-center flex-grow-1 mx-2">
              <div className="btn-group btn-group-sm" role="group">
                <button
                  type="button"
                  className={`btn fw-semibold px-2.5 ${islemModu === "kontrol" ? "btn-primary" : "btn-outline-secondary bg-white"}`}
                  onClick={() => setIslemModu("kontrol")}
                >
                  <IconCheck size={14} className="me-1" /> Dosya Kontrolü
                </button>
                <button
                  type="button"
                  className={`btn fw-semibold px-2.5 ${islemModu === "olusturma" ? "btn-primary" : "btn-outline-secondary bg-white"}`}
                  onClick={() => setIslemModu("olusturma")}
                >
                  <IconDownload size={14} className="me-1" /> Dosya Oluşturma
                </button>
                <button
                  type="button"
                  className={`btn fw-semibold px-2.5 ${islemModu === "birlestirme" ? "btn-primary" : "btn-outline-secondary bg-white"}`}
                  onClick={() => setIslemModu("birlestirme")}
                >
                  <IconArrowsJoin size={14} className="me-1" /> Dosya Birleştirme
                </button>
              </div>
            </div>

            <div className="d-flex flex-wrap gap-2 ms-auto align-items-center">
              {!parametreAcik && (
                <Button
                  size="sm"
                  variant="primary"
                  onClick={handleUygula}
                  disabled={yukleniyor}
                  title="Seçilen filtre ve parametrelerle işlemi uygula"
                  className="d-flex align-items-center gap-1"
                >
                  {yukleniyor ? (
                    <Spinner size="sm" animation="border" style={{ width: 14, height: 14 }} />
                  ) : (
                    <IconSearch size={15} />
                  )}
                  <span>Uygula</span>
                </Button>
              )}

              <Button
                size="sm"
                variant="outline-secondary"
                onClick={() => window.print()}
                title="Yazdır"
                className="d-flex align-items-center gap-1"
              >
                <IconPrinter size={15} />
                <span>Yazdır</span>
              </Button>

              {parametreAcik ? (
                <Button
                  size="sm"
                  variant="light"
                  onClick={() => setParametreAcik(false)}
                  title="Parametreleri gizle"
                  className="d-flex align-items-center"
                >
                  <IconChevronUp size={15} />
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline-primary"
                  onClick={() => setParametreAcik(true)}
                  title="Parametreleri göster"
                  className="d-flex align-items-center gap-1"
                >
                  <IconAdjustments size={15} />
                  <span>Parametreler</span>
                </Button>
              )}

              <Button
                size="sm"
                variant="light"
                onClick={handleSifirla}
                title="Parametreleri sıfırla"
                className="d-flex align-items-center"
              >
                <IconRefresh size={15} />
              </Button>
            </div>
          </div>

          {parametreAcik && (
            <div className="mt-2">
              <div
                className="d-flex flex-column align-items-start border rounded px-3 py-2.5 bg-white shadow-2xs w-100"
                style={{ gap: 10, background: "#f8fafc" }}
              >
                {/* 1. KONTROL MODU */}
                {islemModu === "kontrol" && (
                  <>
                    {/* 1. Satır: Kontrol Türü (Solda en üstte) */}
                    <div className="d-flex align-items-center gap-2 flex-wrap w-100">
                      <div style={{ width: 95, minWidth: 95, fontSize: "12px", fontWeight: 600, color: "#475569" }} className="text-nowrap pe-1">
                        Kontrol Türü
                      </div>
                      <div className="btn-group btn-group-sm" role="group">
                        <button
                          type="button"
                          className={`btn px-2.5 d-inline-flex align-items-center gap-1 fw-semibold ${
                            kontrolTuru === "merkezKur" ? "btn-primary" : "btn-outline-secondary bg-white"
                          }`}
                          onClick={() => {
                            setKontrolTuru("merkezKur");
                            if (merkezKurSonuclari.length === 0) handleMerkezKurKontrol();
                          }}
                          title="Merkez Bankası kurlarını kontrol eder"
                        >
                          <IconCoins size={14} />
                          <span>Merkez Kur</span>
                          {merkezKurSonuclari.length > 0 && (
                            <span className={`badge ms-1 ${merkezKurHataliSayisi > 0 ? "bg-danger" : "bg-success"}`}>
                              {merkezKurHataliSayisi > 0 ? `! ${merkezKurHataliSayisi}` : "Tamam"}
                            </span>
                          )}
                        </button>

                        <button
                          type="button"
                          className={`btn px-2.5 d-inline-flex align-items-center gap-1 fw-semibold ${
                            kontrolTuru === "firma" ? "btn-primary" : "btn-outline-secondary bg-white"
                          }`}
                          onClick={() => {
                            setKontrolTuru("firma");
                            if (!firmaSonucu) handleFirmaKontrol();
                          }}
                          title="Firma vergi, adres ve şube bilgilerini kontrol eder"
                        >
                          <IconBuilding size={14} />
                          <span>Firma</span>
                          {firmaSonucu && (
                            <span className={`badge ms-1 ${firmaSonucu.gecerli ? "bg-success" : "bg-danger"}`}>
                              {firmaSonucu.gecerli ? "Tamam" : "Eksik"}
                            </span>
                          )}
                        </button>

                        <button
                          type="button"
                          className={`btn px-2.5 d-inline-flex align-items-center gap-1 fw-semibold ${
                            kontrolTuru === "fis" ? "btn-primary" : "btn-outline-secondary bg-white"
                          }`}
                          onClick={() => {
                            setKontrolTuru("fis");
                            if (fisSonuclari.length === 0) handleFisKontrol();
                          }}
                          title="Döviz fişlerinin kimlik, vergi ve adres bilgilerini kontrol eder"
                        >
                          <IconReceipt size={14} />
                          <span>Fiş</span>
                          {fisSonuclari.length > 0 && (
                            <span className={`badge ms-1 ${fisHataliSayisi > 0 ? "bg-danger" : "bg-success"}`}>
                              {fisHataliSayisi > 0 ? `! ${fisHataliSayisi}` : fisSonuclari.length}
                            </span>
                          )}
                        </button>

                        <button
                          type="button"
                          className={`btn px-2.5 d-inline-flex align-items-center gap-1 fw-semibold ${
                            kontrolTuru === "fisSatiri" ? "btn-primary" : "btn-outline-secondary bg-white"
                          }`}
                          onClick={() => {
                            setKontrolTuru("fisSatiri");
                            if (fisSatirSonuclari.length === 0) handleFisSatiriKontrol();
                          }}
                          title="Döviz fişlerinin satır, tutar ve para kodlarını kontrol eder"
                        >
                          <IconListDetails size={14} />
                          <span>Fiş Satırı</span>
                          {fisSatirSonuclari.length > 0 && (
                            <span className={`badge ms-1 ${satirHataliSayisi > 0 ? "bg-danger" : "bg-success"}`}>
                              {satirHataliSayisi > 0 ? `! ${satirHataliSayisi}` : fisSatirSonuclari.length}
                            </span>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* 2. Satır: Tarih Aralığı (Altında tümü) */}
                    <div className="d-flex align-items-center gap-2 flex-wrap w-100">
                      <div style={{ width: 95, minWidth: 95, fontSize: "12px", fontWeight: 600, color: "#475569" }} className="text-nowrap pe-1">
                        Tarih Aralığı
                      </div>
                      <div className="d-flex align-items-center gap-1">
                        <span className="small text-muted" style={{ fontSize: "11px" }}>İlk:</span>
                        <Form.Control
                          size="sm"
                          type="date"
                          style={{ width: "130px" }}
                          value={ilkTarih}
                          onChange={(e) => setIlkTarih(e.target.value)}
                        />
                      </div>
                      <div className="d-flex align-items-center gap-1">
                        <span className="small text-muted" style={{ fontSize: "11px" }}>Son:</span>
                        <Form.Control
                          size="sm"
                          type="date"
                          style={{ width: "130px" }}
                          value={sonTarih}
                          onChange={(e) => setSonTarih(e.target.value)}
                        />
                      </div>
                      <div className="btn-group btn-group-sm ms-2" role="group">
                        <button
                          type="button"
                          className={`btn py-0 px-2 fw-semibold ${ilkTarih === gun(0) && sonTarih === gun(0) ? "btn-secondary text-white" : "btn-outline-secondary bg-white text-dark"}`}
                          style={{ fontSize: "11px", cursor: "pointer" }}
                          onClick={() => handleHizliTarih(gun(0), gun(0))}
                        >
                          Bugün
                        </button>
                        <button
                          type="button"
                          className={`btn py-0 px-2 fw-semibold ${ilkTarih === gun(-1) && sonTarih === gun(-1) ? "btn-secondary text-white" : "btn-outline-secondary bg-white text-dark"}`}
                          style={{ fontSize: "11px", cursor: "pointer" }}
                          onClick={() => handleHizliTarih(gun(-1), gun(-1))}
                        >
                          Dün
                        </button>
                        <button
                          type="button"
                          className={`btn py-0 px-2 fw-semibold ${ilkTarih === buAyBasi() && sonTarih === gun(0) ? "btn-secondary text-white" : "btn-outline-secondary bg-white text-dark"}`}
                          style={{ fontSize: "11px", cursor: "pointer" }}
                          onClick={() => handleHizliTarih(buAyBasi(), gun(0))}
                        >
                          Bu Ay
                        </button>
                        <button
                          type="button"
                          className={`btn py-0 px-2 fw-semibold ${ilkTarih === gun(-7) && sonTarih === gun(0) ? "btn-secondary text-white" : "btn-outline-secondary bg-white text-dark"}`}
                          style={{ fontSize: "11px", cursor: "pointer" }}
                          onClick={() => handleHizliTarih(gun(-7), gun(0))}
                        >
                          Son 7 Gün
                        </button>
                      </div>
                    </div>

                    {/* 3. Satır: Vergi Sınırı + No Filtresi + Uygula Butonu */}
                    <div className="d-flex align-items-center gap-3 flex-wrap w-100 pt-1 border-top">
                      {/* Vergi Sınırı */}
                      <div className="d-flex align-items-center gap-2">
                        <div style={{ width: 95, minWidth: 95, fontSize: "12px", fontWeight: 600, color: "#475569" }} className="text-nowrap pe-1">
                          Vergi Sınırı
                        </div>
                        <div className="d-flex align-items-center gap-1">
                          <span className="small text-muted" style={{ fontSize: "11.5px" }}>TL Sınırı:</span>
                          <Form.Control
                            size="sm"
                            type="number"
                            min={0}
                            step={5000}
                            style={{ width: "110px" }}
                            value={tlVergiSiniri}
                            onChange={(e) => setTlVergiSiniri(Number(e.target.value) || 0)}
                          />
                          <span className="small text-muted fw-bold">₺</span>
                        </div>
                        <div className="d-flex align-items-center gap-1 ms-1">
                          <span className="small text-muted" style={{ fontSize: "11.5px" }}>Dolar Sınırı:</span>
                          <Form.Control
                            size="sm"
                            type="number"
                            min={0}
                            step={500}
                            style={{ width: "95px" }}
                            value={dovizVergiSiniri}
                            onChange={(e) => setDovizVergiSiniri(Number(e.target.value) || 0)}
                          />
                          <span className="small text-muted fw-bold">$</span>
                        </div>
                      </div>

                      {/* No Filtresi */}
                      <div className="d-flex align-items-center gap-2 ms-lg-2">
                        <div style={{ fontSize: "12px", fontWeight: 600, color: "#475569" }} className="text-nowrap">
                          No Filtresi:
                        </div>
                        <Form.Select
                          size="sm"
                          style={{ width: "100px" }}
                          value={belgeIslemNoTuru}
                          onChange={(e) => setBelgeIslemNoTuru(e.target.value as any)}
                        >
                          <option value="seri">Seri No</option>
                          <option value="belge">Belge No</option>
                        </Form.Select>
                        <Form.Control
                          size="sm"
                          style={{ width: "150px" }}
                          placeholder="Tüm fişler (isteğe bağlı)"
                          value={belgeIslemNo}
                          onChange={(e) => setBelgeIslemNo(e.target.value)}
                        />
                        {belgeIslemNo && (
                          <Button variant="link" size="sm" className="p-0 small" onClick={() => setBelgeIslemNo("")}>
                            Temizle
                          </Button>
                        )}
                      </div>

                      {/* Uygula Butonu */}
                      <div className="ms-auto">
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={handleUygula}
                          disabled={yukleniyor}
                          title="Seçilen filtre ve parametrelerle işlemi uygula"
                          className="d-flex align-items-center gap-1.5 px-3 fw-bold"
                        >
                          {yukleniyor ? (
                            <Spinner size="sm" animation="border" style={{ width: 14, height: 14 }} />
                          ) : (
                            <IconSearch size={16} />
                          )}
                          <span>Uygula</span>
                        </Button>
                      </div>
                    </div>
                  </>
                )}

                {/* 2. OLUŞTURMA MODU */}
                {islemModu === "olusturma" && (
                  <>
                    {/* 1. Satır: Tarih Aralığı */}
                    <div className="d-flex align-items-center gap-2 flex-wrap w-100">
                      <div style={{ width: 95, minWidth: 95, fontSize: "12px", fontWeight: 600, color: "#475569" }} className="text-nowrap pe-1">
                        Tarih Aralığı
                      </div>
                      <div className="d-flex align-items-center gap-1">
                        <span className="small text-muted" style={{ fontSize: "11px" }}>İlk:</span>
                        <Form.Control
                          size="sm"
                          type="date"
                          style={{ width: "130px" }}
                          value={ilkTarih}
                          onChange={(e) => setIlkTarih(e.target.value)}
                        />
                      </div>
                      <div className="d-flex align-items-center gap-1">
                        <span className="small text-muted" style={{ fontSize: "11px" }}>Son:</span>
                        <Form.Control
                          size="sm"
                          type="date"
                          style={{ width: "130px" }}
                          value={sonTarih}
                          onChange={(e) => setSonTarih(e.target.value)}
                        />
                      </div>
                      <div className="btn-group btn-group-sm ms-2" role="group">
                        <button
                          type="button"
                          className={`btn py-0 px-2 fw-semibold ${ilkTarih === gun(0) && sonTarih === gun(0) ? "btn-secondary text-white" : "btn-outline-secondary bg-white text-dark"}`}
                          style={{ fontSize: "11px", cursor: "pointer" }}
                          onClick={() => handleHizliTarih(gun(0), gun(0))}
                        >
                          Bugün
                        </button>
                        <button
                          type="button"
                          className={`btn py-0 px-2 fw-semibold ${ilkTarih === gun(-1) && sonTarih === gun(-1) ? "btn-secondary text-white" : "btn-outline-secondary bg-white text-dark"}`}
                          style={{ fontSize: "11px", cursor: "pointer" }}
                          onClick={() => handleHizliTarih(gun(-1), gun(-1))}
                        >
                          Dün
                        </button>
                        <button
                          type="button"
                          className={`btn py-0 px-2 fw-semibold ${ilkTarih === buAyBasi() && sonTarih === gun(0) ? "btn-secondary text-white" : "btn-outline-secondary bg-white text-dark"}`}
                          style={{ fontSize: "11px", cursor: "pointer" }}
                          onClick={() => handleHizliTarih(buAyBasi(), gun(0))}
                        >
                          Bu Ay
                        </button>
                        <button
                          type="button"
                          className={`btn py-0 px-2 fw-semibold ${ilkTarih === gun(-7) && sonTarih === gun(0) ? "btn-secondary text-white" : "btn-outline-secondary bg-white text-dark"}`}
                          style={{ fontSize: "11px", cursor: "pointer" }}
                          onClick={() => handleHizliTarih(gun(-7), gun(0))}
                        >
                          Son 7 Gün
                        </button>
                      </div>
                    </div>

                    {/* 2. Satır: Dosya Bilgisi */}
                    <div className="d-flex align-items-center gap-2 flex-wrap w-100">
                      <div style={{ width: 95, minWidth: 95, fontSize: "12px", fontWeight: 600, color: "#475569" }} className="text-nowrap pe-1">
                        Dosya Bilgisi
                      </div>
                      <div className="d-flex align-items-center gap-1">
                        <span className="small text-muted" style={{ fontSize: "11px" }}>Hazırlama:</span>
                        <Form.Control
                          size="sm"
                          type="date"
                          style={{ width: "135px" }}
                          value={hazirlamaTarihi}
                          onChange={(e) => setHazirlamaTarihi(e.target.value)}
                        />
                      </div>
                      <div className="d-flex align-items-center gap-1">
                        <span className="small text-muted" style={{ fontSize: "11px" }}>No:</span>
                        <Form.Control
                          size="sm"
                          type="text"
                          style={{ width: "60px" }}
                          className="text-center font-monospace"
                          value={dosyaNo}
                          onChange={(e) => setDosyaNo(e.target.value)}
                        />
                      </div>
                      <div className="d-flex align-items-center gap-1">
                        <span className="small text-muted" style={{ fontSize: "11px" }}>Adı:</span>
                        <Form.Control
                          size="sm"
                          type="text"
                          style={{ width: "160px" }}
                          className="font-monospace"
                          value={dosyaAdi}
                          onChange={(e) => setDosyaAdi(e.target.value)}
                        />
                      </div>
                      <Form.Check
                        type="checkbox"
                        id="chkIslemYok"
                        label="İşlem Yok"
                        className="small ms-2 fw-semibold text-secondary"
                        checked={islemYok}
                        onChange={(e) => setIslemYok(e.target.checked)}
                      />
                    </div>

                    {/* 3. Satır: Açıklama + Eylemler */}
                    <div className="d-flex align-items-center gap-2 flex-wrap w-100 pt-1 border-top">
                      <div style={{ width: 95, minWidth: 95, fontSize: "12px", fontWeight: 600, color: "#475569" }} className="text-nowrap pe-1">
                        Açıklama
                      </div>
                      <Form.Control
                        size="sm"
                        type="text"
                        style={{ maxWidth: "350px" }}
                        className="flex-grow-1"
                        placeholder="Dönem Açıklaması..."
                        value={aciklama}
                        onChange={(e) => setAciklama(e.target.value)}
                      />
                      <div className="ms-auto d-flex align-items-center gap-2">
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={handleUygula}
                          disabled={yukleniyor}
                          title="Seçilen parametrelerle önizlemeyi tazeler"
                          className="d-flex align-items-center gap-1 px-3 fw-bold"
                        >
                          {yukleniyor ? (
                            <Spinner size="sm" animation="border" style={{ width: 14, height: 14 }} />
                          ) : (
                            <IconSearch size={16} />
                          )}
                          <span>Uygula</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline-primary"
                          onClick={() => handleXmlOlustur(false)}
                          disabled={yukleniyor}
                          title="XML önizlemesini tazeler"
                        >
                          Önizleme
                        </Button>
                        <Button
                          size="sm"
                          variant="success"
                          onClick={() => handleXmlOlustur(true)}
                          disabled={yukleniyor}
                          title="XML dosyasını oluştur ve indir"
                          className="d-flex align-items-center gap-1"
                        >
                          <IconDownload size={15} />
                          <span>XML Kaydet</span>
                        </Button>
                      </div>
                    </div>
                  </>
                )}

                {/* 3. BİRLEŞTİRME MODU */}
                {islemModu === "birlestirme" && (
                  <>
                    {/* 1. Satır: Dosya Seçimi */}
                    <div className="d-flex align-items-center gap-2 flex-wrap w-100">
                      <div style={{ width: 95, minWidth: 95, fontSize: "12px", fontWeight: 600, color: "#475569" }} className="text-nowrap pe-1">
                        Dosya Seçimi
                      </div>
                      <input
                        type="file"
                        id="kaynakXmlInputTop"
                        accept=".xml"
                        className="d-none"
                        onChange={handleKaynakDosyaSec}
                      />
                      <label
                        htmlFor="kaynakXmlInputTop"
                        className={`btn btn-sm mb-0 d-inline-flex align-items-center gap-1.5 fw-semibold ${
                          kaynakXmlText ? "btn-outline-success bg-success-subtle text-success" : "btn-outline-primary"
                        }`}
                        style={{ cursor: "pointer" }}
                      >
                        <IconFolder size={14} />
                        <span>1. Kaynak XML (Merkez)</span>
                      </label>
                      {kaynakDosyaAdi && (
                        <span className="badge bg-success-subtle text-success border border-success small" title={kaynakDosyaAdi}>
                          {kaynakDosyaAdi}
                        </span>
                      )}

                      <input
                        type="file"
                        id="hedefXmlInputTop"
                        accept=".xml"
                        className="d-none"
                        onChange={handleHedefDosyaSec}
                      />
                      <label
                        htmlFor="hedefXmlInputTop"
                        className={`btn btn-sm mb-0 d-inline-flex align-items-center gap-1.5 fw-semibold ${
                          hedefXmlText ? "btn-outline-success bg-success-subtle text-success" : "btn-outline-secondary"
                        }`}
                        style={{ cursor: "pointer" }}
                      >
                        <IconFolder size={14} />
                        <span>2. Hedef XML (Şube)</span>
                      </label>
                      {hedefDosyaAdi && (
                        <span className="badge bg-success-subtle text-success border border-success small" title={hedefDosyaAdi}>
                          {hedefDosyaAdi}
                        </span>
                      )}

                      <div className="d-flex align-items-center gap-1 ms-2">
                        <span className="small text-muted" style={{ fontSize: "11px" }}>No:</span>
                        <Form.Control
                          size="sm"
                          type="text"
                          style={{ width: "60px" }}
                          className="text-center font-monospace"
                          value={dosyaNo}
                          onChange={(e) => setDosyaNo(e.target.value)}
                        />
                      </div>
                    </div>

                    {/* 2. Satır: Eylemler */}
                    <div className="d-flex align-items-center gap-2 flex-wrap w-100 pt-1 border-top justify-content-end">
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={handleUygula}
                        disabled={yukleniyor}
                        title="Seçilen parametrelerle önizlemeyi tazeler"
                        className="d-flex align-items-center gap-1 px-3 fw-bold"
                      >
                        {yukleniyor ? (
                          <Spinner size="sm" animation="border" style={{ width: 14, height: 14 }} />
                        ) : (
                          <IconSearch size={16} />
                        )}
                        <span>Uygula</span>
                      </Button>
                      <Button
                        size="sm"
                        variant="outline-primary"
                        onClick={() => handleXmlBirlestir(false)}
                        disabled={yukleniyor || !kaynakXmlText || !hedefXmlText}
                        title="Birleştirilmiş XML önizlemesi"
                      >
                        Önizleme
                      </Button>
                      <Button
                        size="sm"
                        variant="success"
                        onClick={() => handleXmlBirlestir(true)}
                        disabled={yukleniyor || !kaynakXmlText || !hedefXmlText}
                        title="Birleştirilmiş XML dosyasını kaydet"
                        className="d-flex align-items-center gap-1"
                      >
                        <IconDownload size={15} />
                        <span>Birleştir ve Kaydet</span>
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </Card.Body>
      </Card>

      {/* 2. ALT PANEL: Geniş Tam Ekran Tablolar & Sonuçlar */}
      <Row className="g-3 flex-grow-1">
        <Col xs={12} className="d-flex flex-column">
          <Card className="border shadow-sm w-100 bg-white flex-grow-1 d-flex flex-column" id="xml-dosya-tablo-karti">
            {/* Tablo Üst Başlık & Sağ Toolbar Çubuğu */}
            <Card.Header className="bg-light py-2 px-3 d-flex flex-wrap justify-content-between align-items-center border-bottom gap-2">
              {/* SOL KISIM: Başlık, Mod Rozeti, Durum Rozeti */}
              <div className="d-flex align-items-center gap-2 flex-wrap">
                <span className="fw-bold d-flex align-items-center gap-1.5 text-dark" style={{ fontSize: "0.92rem" }}>
                  <IconReportAnalytics size={18} className="text-primary flex-shrink-0" />
                  <span>
                    {islemModu === "kontrol" && kontrolTuru === "merkezKur" && "Merkez Bankası Kur Kontrolü"}
                    {islemModu === "kontrol" && kontrolTuru === "firma" && "Firma VİM Bilgileri Kontrol Tablosu"}
                    {islemModu === "kontrol" && kontrolTuru === "fis" && "Döviz Fişleri Kontrol Tablosu"}
                    {islemModu === "kontrol" && kontrolTuru === "fisSatiri" && "Döviz Fiş Satırları Kontrol Tablosu"}
                    {islemModu === "olusturma" && "Oluşturulan XML Dosyası ve Önizleme"}
                    {islemModu === "birlestirme" && "Birleştirilmiş XML Çıktısı"}
                  </span>
                </span>

                {islemModu === "kontrol" && (
                  <Badge bg="secondary-subtle" className="text-secondary border small">
                    {kontrolTuru === "merkezKur" && `${merkezKurHataliSayisi} hatalı fiş (${kurHataliSayisi} eksik kur, ${detayEksikSayisi} eksik detay)`}
                    {kontrolTuru === "firma" && (firmaSonucu ? (firmaSonucu.gecerli ? "Eksiksiz" : `${firmaSonucu.eksikler.length} eksik`) : "Bekleniyor")}
                    {kontrolTuru === "fis" && `${fisSonuclari.length} fiş (${fisHataliSayisi} hatalı)`}
                    {kontrolTuru === "fisSatiri" && `${fisSatirSonuclari.length} satır (${satirHataliSayisi} hatalı)`}
                  </Badge>
                )}

                {yukleniyor && (
                  <Badge bg="primary-subtle" className="text-primary border small d-inline-flex align-items-center gap-1">
                    <Spinner animation="border" size="sm" style={{ width: "10px", height: "10px" }} />
                    İşlem yürütülüyor...
                  </Badge>
                )}
              </div>

              {/* SAĞ KISIM: Filtre Butonları, Canlı Arama Kutusu, Boyutlandırma ve Zaman Damgası */}
              <div className="d-flex align-items-center gap-2 flex-wrap ms-auto">
                {/* Firma Filtre Butonları */}
                {islemModu === "kontrol" && kontrolTuru === "firma" && firmaSonucu && (
                  <div className="btn-group btn-group-sm" role="group">
                    <button
                      type="button"
                      className={`btn btn-xs fw-semibold ${durumHataFiltresi === "hatali" ? "btn-danger text-white" : "btn-outline-danger"}`}
                      style={{ fontSize: "11px", padding: "2px 8px" }}
                      onClick={() => setDurumHataFiltresi("hatali")}
                    >
                      Sadece Eksikler ({firmaSonucu.eksikler.length})
                    </button>
                    <button
                      type="button"
                      className={`btn btn-xs fw-semibold ${durumHataFiltresi === "hepsi" ? "btn-dark text-white" : "btn-outline-secondary"}`}
                      style={{ fontSize: "11px", padding: "2px 8px" }}
                      onClick={() => setDurumHataFiltresi("hepsi")}
                    >
                      Tüm Firma Bilgileri
                    </button>
                  </div>
                )}

                {/* Fiş Filtre Butonları */}
                {islemModu === "kontrol" && kontrolTuru === "fis" && (
                  <div className="d-flex align-items-center gap-1">
                    <div className="btn-group btn-group-sm" role="group">
                      <button
                        type="button"
                        className={`btn btn-xs fw-semibold ${durumHataFiltresi === "hatali" ? "btn-danger text-white" : "btn-outline-danger"}`}
                        style={{ fontSize: "11px", padding: "2px 8px" }}
                        onClick={() => setDurumHataFiltresi("hatali")}
                      >
                        Hatalılar ({fisHataliSayisi})
                      </button>
                      <button
                        type="button"
                        className={`btn btn-xs fw-semibold ${durumHataFiltresi === "hepsi" ? "btn-dark text-white" : "btn-outline-secondary"}`}
                        style={{ fontSize: "11px", padding: "2px 8px" }}
                        onClick={() => setDurumHataFiltresi("hepsi")}
                      >
                        Tümü ({fisSonuclari.length})
                      </button>
                      <button
                        type="button"
                        className={`btn btn-xs fw-semibold ${durumHataFiltresi === "gecerli" ? "btn-success text-white" : "btn-outline-success"}`}
                        style={{ fontSize: "11px", padding: "2px 8px" }}
                        onClick={() => setDurumHataFiltresi("gecerli")}
                      >
                        Geçerliler ({fisSonuclari.length - fisHataliSayisi})
                      </button>
                    </div>
                    <select
                      className="form-select form-select-sm py-0 px-1.5 fw-semibold"
                      style={{ fontSize: "11px", height: "26px", width: "135px" }}
                      value={durumHataFiltresi}
                      onChange={(e) => setDurumHataFiltresi(e.target.value)}
                    >
                      <option value="hatali">Filtre: Hatalılar</option>
                      <option value="hepsi">Filtre: Tümü</option>
                      <option value="gecerli">Filtre: Geçerliler</option>
                      <option value="adres">Hata: Adres Eksik</option>
                      <option value="tckn">Hata: TCKN / VKN</option>
                      <option value="baba">Hata: Baba Adı</option>
                      <option value="il">Hata: İl / İlçe</option>
                      <option value="seri">Hata: Seri / Belge</option>
                      <option value="unvan">Hata: Müşteri Ünvanı</option>
                    </select>
                  </div>
                )}

                {/* Fiş Satırı Filtre Butonları */}
                {islemModu === "kontrol" && kontrolTuru === "fisSatiri" && (
                  <div className="btn-group btn-group-sm" role="group">
                    <button
                      type="button"
                      className={`btn btn-xs fw-semibold ${durumHataFiltresi === "hatali" ? "btn-danger text-white" : "btn-outline-danger"}`}
                      style={{ fontSize: "11px", padding: "2px 8px" }}
                      onClick={() => setDurumHataFiltresi("hatali")}
                    >
                      Hatalı Satırlar ({satirHataliSayisi})
                    </button>
                    <button
                      type="button"
                      className={`btn btn-xs fw-semibold ${durumHataFiltresi === "hepsi" ? "btn-dark text-white" : "btn-outline-secondary"}`}
                      style={{ fontSize: "11px", padding: "2px 8px" }}
                      onClick={() => setDurumHataFiltresi("hepsi")}
                    >
                      Tümü ({fisSatirSonuclari.length})
                    </button>
                    <button
                      type="button"
                      className={`btn btn-xs fw-semibold ${durumHataFiltresi === "gecerli" ? "btn-success text-white" : "btn-outline-success"}`}
                      style={{ fontSize: "11px", padding: "2px 8px" }}
                      onClick={() => setDurumHataFiltresi("gecerli")}
                    >
                      Geçerli Satırlar ({fisSatirSonuclari.length - satirHataliSayisi})
                    </button>
                  </div>
                )}

                {/* CANLI ARAMA KUTUSU (Tabloda Ara) */}
                {islemModu === "kontrol" && (
                  <div className="d-flex align-items-center position-relative" style={{ width: "190px" }}>
                    <input
                      type="text"
                      className="form-control form-control-sm pe-4 bg-white"
                      style={{ fontSize: "11.5px", height: "26px" }}
                      placeholder="Tabloda ara..."
                      value={aramaMetni}
                      onChange={(e) => setAramaMetni(e.target.value)}
                    />
                    {aramaMetni ? (
                      <button
                        type="button"
                        className="btn btn-link p-0 position-absolute end-0 me-2 text-muted"
                        onClick={() => setAramaMetni("")}
                        style={{ fontSize: "12px", lineHeight: 1 }}
                      >
                        <IconX size={13} />
                      </button>
                    ) : (
                      <IconSearch size={13} className="position-absolute end-0 me-2 text-muted pointer-events-none" />
                    )}
                  </div>
                )}

                {/* Tarih / Saat */}
                <span className="text-muted font-monospace border-start ps-2 d-none d-xl-inline" style={{ fontSize: "11px" }}>
                  {trTarihBicimi().format(new Date())} {new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            </Card.Header>

            <Card.Body className="p-0 d-flex flex-column flex-grow-1">
              {filtreOzeti && (
                <div className="px-3 py-1.5 small text-muted border-bottom text-center bg-light bg-opacity-50 font-monospace">
                  {filtreOzeti}
                </div>
              )}

              {/* Tablo Gövdesi */}
              <div className="flex-grow-1 overflow-auto p-0" style={{ maxHeight: "calc(100vh - 240px)", width: "100%", overflowX: "auto" }}>
                {/* TABLO 1: MERKEZ KUR */}
                {islemModu === "kontrol" && kontrolTuru === "merkezKur" && (
                  <table className="xml-dosya-table">
                    <thead>
                      <tr>
                        <th style={{ width: "110px" }} className="text-center">Tarih</th>
                        <th style={{ width: "130px" }} className="text-center">Seri / Belge No</th>
                        <th style={{ width: "140px" }} className="text-end">Fiş Tutarı (TL)</th>
                        <th style={{ width: "130px" }} className="text-end">USD Karşılığı ($)</th>
                        <th>Açıklama / Vergi Durumu</th>
                        <th style={{ width: "125px" }} className="text-center">Durum</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const filtered = merkezKurSonuclari.filter((item) => {
                          const hataliMi = item.durum === "hata" || item.detayDurumu === "eksik";
                          if (!hataliMi) return false;
                          if (!aramaMetni) return true;
                          return (
                            item.tarih.includes(aramaMetni) ||
                            item.seriNo.toLowerCase().includes(aramaMetni.toLowerCase()) ||
                            item.aciklama.toLowerCase().includes(aramaMetni.toLowerCase())
                          );
                        });

                        if (merkezKurSonuclari.length === 0) {
                          return (
                            <tr>
                              <td colSpan={6} className="text-center py-4 text-muted">
                                Seçilen tarih aralığında vergi sınırını aşan ({tlVergiSiniri.toLocaleString("tr-TR")} ₺ veya {dovizVergiSiniri.toLocaleString("tr-TR")} $) fiş bulunamadı veya henüz kontrol yapılmadı.
                              </td>
                            </tr>
                          );
                        }

                        if (filtered.length === 0) {
                          return (
                            <tr>
                              <td colSpan={6} className="text-center py-4">
                                <div className="text-success d-flex align-items-center justify-content-center gap-2">
                                  <IconCheck size={20} />
                                  <span className="fw-semibold">Vergi sınırını aşan tüm işlemler için Merkez Bankası kurları ve MASAK detayları eksiksizdir, herhangi bir hata veya eksik bulunamadı.</span>
                                </div>
                              </td>
                            </tr>
                          );
                        }

                        return filtered.map((row, idx) => {
                          const tlAsildi = (row.tutarTl ?? 0) >= tlVergiSiniri;
                          const dovizAsildi = (row.usdKarsiligi ?? 0) >= dovizVergiSiniri;
                          return (
                            <tr key={idx} className={row.durum === "hata" ? "row-error" : ""}>
                              <td className="text-center fw-semibold">{row.tarih}</td>
                              <td className="text-center font-monospace">{row.seriNo}</td>
                              <td className="text-end font-monospace fw-semibold">
                                {row.tutarTl != null
                                  ? `${row.tutarTl.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺`
                                  : "-"}
                              </td>
                              <td className="text-end font-monospace fw-semibold">
                                {row.usdKarsiligi != null
                                  ? `${row.usdKarsiligi.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`
                                  : "-"}
                              </td>
                              <td>
                                <div className="d-flex align-items-center gap-1.5 flex-wrap">
                                  {tlAsildi && (
                                    <Badge bg="warning-subtle" className="text-warning-emphasis border border-warning" style={{ fontSize: "10px" }}>
                                      TL Sınır Üstü (≥ {tlVergiSiniri.toLocaleString("tr-TR")} ₺)
                                    </Badge>
                                  )}
                                  {dovizAsildi && (
                                    <Badge bg="info-subtle" className="text-info-emphasis border border-info" style={{ fontSize: "10px" }}>
                                      USD Sınır Üstü (≥ {dovizVergiSiniri.toLocaleString("tr-TR")} $)
                                    </Badge>
                                  )}
                                  {row.detayDurumu === "eksik" && row.detayEksikleri && row.detayEksikleri.length > 0 && (
                                    <Badge
                                      bg="danger-subtle"
                                      className="text-danger border border-danger"
                                      style={{ fontSize: "10px" }}
                                      title={row.detayEksikleri.join(", ")}
                                    >
                                      Eksik Detay: {row.detayEksikleri.slice(0, 2).join(", ")}{row.detayEksikleri.length > 2 ? ` (+${row.detayEksikleri.length - 2})` : ""}
                                    </Badge>
                                  )}
                                  <span className="text-secondary">{row.aciklama}</span>
                                </div>
                              </td>
                              <td className="text-center align-middle">
                                <div className="d-inline-flex flex-column align-items-center gap-1">
                                  {row.durum === "tamam" ? (
                                    <span className="badge bg-success-subtle text-success border border-success" style={{ fontSize: "11px" }}>
                                      Mevcut
                                    </span>
                                  ) : (
                                    <span className="badge bg-danger text-white" style={{ fontSize: "11px" }}>
                                      Eksik Kur
                                    </span>
                                  )}
                                  {row.detayDurumu === "girildi" ? (
                                    <span
                                      className="badge bg-success-subtle text-success border border-success"
                                      style={{ fontSize: "9.5px", fontWeight: 600, padding: "1px 5px", letterSpacing: "-0.2px" }}
                                      title="MASAK ve VİM mevzuatı gereği zorunlu tüm müşteri detayları girilmiştir."
                                    >
                                      detay girildi
                                    </span>
                                  ) : (
                                    <span
                                      className="badge bg-danger-subtle text-danger border border-danger"
                                      style={{
                                        fontSize: "9.5px",
                                        fontWeight: 600,
                                        padding: "1px 5px",
                                        letterSpacing: "-0.2px",
                                        cursor: row.detayEksikleri && row.detayEksikleri.length > 0 ? "help" : "default",
                                      }}
                                      title={
                                        row.detayEksikleri && row.detayEksikleri.length > 0
                                          ? `MASAK Eksik Alanlar: ${row.detayEksikleri.join(", ")}`
                                          : "MASAK detay bilgileri eksiktir"
                                      }
                                    >
                                      detay eksik
                                    </span>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        });
                      })()}
                    </tbody>
                  </table>
                )}

          {/* TABLO 2: FİRMA KONTROLÜ */}
          {islemModu === "kontrol" && kontrolTuru === "firma" && (
            <div className="p-3">
              {!firmaSonucu ? (
                <div className="text-center py-4 text-muted">
                  Yukarıdaki <strong>"Firma"</strong> butonuna basarak firma bilgisi kontrolünü başlatabilirsiniz.
                </div>
              ) : durumHataFiltresi === "hatali" && firmaSonucu.gecerli ? (
                <div className="alert alert-success py-3 px-4 mb-0 d-flex flex-wrap align-items-center justify-content-between gap-3 shadow-xs">
                  <div className="d-flex align-items-center gap-2">
                    <IconCheck size={22} className="text-success flex-shrink-0" />
                    <div>
                      <div className="fw-bold">Firma Tanımları Eksiksiz ve Geçerlidir</div>
                      <div className="small text-muted">
                        VİM döviz transfer standardına uygun tüm zorunlu firma ve şube alanları doludur, herhangi bir eksik veya hata bulunamadı.
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-outline-success btn-sm fw-semibold"
                    onClick={() => setDurumHataFiltresi("hepsi")}
                  >
                    Tüm Firma Bilgilerini Gör
                  </button>
                </div>
              ) : durumHataFiltresi === "hatali" && !firmaSonucu.gecerli ? (
                <div className="d-flex flex-column gap-3">
                  <div className="alert alert-danger py-2 px-3 mb-0 small">
                    <strong>Tespit Edilen Eksik / Hatalı Bilgiler:</strong> {firmaSonucu.eksikler.join(", ")}
                  </div>
                  <table className="xml-dosya-table">
                    <thead>
                      <tr>
                        <th style={{ width: "35%" }}>Eksik / Hatalı Alan</th>
                        <th>Açıklama</th>
                        <th style={{ width: "120px" }} className="text-center">Durum</th>
                      </tr>
                    </thead>
                    <tbody>
                      {firmaSonucu.eksikler.map((eksik, eIdx) => (
                        <tr key={eIdx} className="row-error">
                          <td className="fw-bold text-danger">{eksik}</td>
                          <td>Ayarlar &gt; Firma Tanımları menüsünden bu alanın doldurulması zorunludur.</td>
                          <td className="text-center">
                            <span className="badge bg-danger text-white">Eksik</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="d-flex flex-column gap-3">
                  <table className="xml-dosya-table">
                    <thead>
                      <tr>
                        <th>Vergi No</th>
                        <th>Ünvan</th>
                        <th>Şube Kodu</th>
                        <th>Şube Adı</th>
                        <th>Adres</th>
                        <th>İlçe</th>
                        <th>Posta Kodu</th>
                        <th>İl Kodu</th>
                        <th>İl Adı</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className={`text-center fw-bold ${!firmaSonucu.vergiNo ? "bg-danger text-white" : ""}`}>
                          {firmaSonucu.vergiNo || "EKSİK"}
                        </td>
                        <td className={!firmaSonucu.unvan ? "bg-danger text-white" : ""}>
                          {firmaSonucu.unvan || "EKSİK"}
                        </td>
                        <td className="text-center">{firmaSonucu.subeKodu}</td>
                        <td>{firmaSonucu.subeAdi}</td>
                        <td className={!firmaSonucu.adres ? "bg-danger text-white" : ""}>
                          {firmaSonucu.adres || "EKSİK"}
                        </td>
                        <td className={`text-center ${!firmaSonucu.ilceAdi ? "bg-danger text-white" : ""}`}>
                          {firmaSonucu.ilceAdi || "EKSİK"}
                        </td>
                        <td className="text-center">{firmaSonucu.postaKodu || "-"}</td>
                        <td className={`text-center ${!firmaSonucu.ilKodu ? "bg-danger text-white" : ""}`}>
                          {firmaSonucu.ilKodu || "EKSİK"}
                        </td>
                        <td className={`text-center ${!firmaSonucu.ilAdi ? "bg-danger text-white" : ""}`}>
                          {firmaSonucu.ilAdi || "EKSİK"}
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  {firmaSonucu.eksikler.length > 0 ? (
                    <div className="alert alert-danger py-2 px-3 mb-0 small">
                      <strong>Tespit Edilen Eksikler:</strong> {firmaSonucu.eksikler.join(", ")}
                    </div>
                  ) : (
                    <div className="alert alert-success py-2 px-3 mb-0 small d-flex align-items-center gap-2">
                      <IconCheck size={18} className="text-success" />
                      <span>Firma tanımları VİM döviz transfer standardına tam uygundur.</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TABLO 3: FİŞ KONTROLÜ (Kompakt ve Ekrana Sığan Görünüm) */}
          {islemModu === "kontrol" && kontrolTuru === "fis" && (
            <table
              className="xml-dosya-compact-table"
              style={{
                fontSize: `${tabloYaziBoyutu}px`,
                width: `${tabloGenislikYuzde}%`,
                minWidth: `${tabloGenislikYuzde}%`,
              }}
            >
              <thead>
                <tr>
                  <th className="text-center" style={{ width: "5%" }} title="İşlem Tarihi">Tarih</th>
                  <th className="text-center" style={{ width: "6%" }} title="Seri No">Seri No</th>
                  <th className="text-center" style={{ width: "4%" }} title="Vergi / Şahıs Türü">Tür</th>
                  <th style={{ width: "9%" }} title="Soyad / Firma Ünvanı">Soyadı / Ünvan</th>
                  <th style={{ width: "7.5%" }} title="Müşteri Adı">Adı</th>
                  <th className="text-center" style={{ width: "5.5%" }} title="Baba Adı">Baba</th>
                  <th className="text-center" style={{ width: "8.5%" }} title="Belge No">Belge No</th>
                  <th className="text-center" style={{ width: "3.5%" }} title="Uyruk">Uyruk</th>
                  <th className="text-center" style={{ width: "4%" }} title="Hukuki Yapı">Hukuki Yapı</th>
                  <th className="text-center" style={{ width: "7.5%" }} title="T.C. Kimlik No">T.C. Kimlik No</th>
                  <th style={{ width: "11%" }} title="Adres">Adres</th>
                  <th style={{ width: "5.5%" }} title="İlçe">İlçe</th>
                  <th className="text-center" style={{ width: "4%" }} title="Posta Kodu">Posta Kodu</th>
                  <th className="text-center" style={{ width: "4%" }} title="İl Plaka Kodu">İl Kodu</th>
                  <th style={{ width: "5%" }} title="İl Adı">İl Adı</th>
                  <th className="text-center" style={{ width: "4%" }} title="Ülke">Ülke</th>
                  <th className="text-center" style={{ width: "13%" }} title="Hata ve Durum Bildirimleri">Durum / Hata</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const filtered = fisSonuclari.filter((item) => {
                    if (durumHataFiltresi === "hatali" && item.gecerli) return false;
                    if (durumHataFiltresi === "gecerli" && !item.gecerli) return false;
                    if (durumHataFiltresi === "adres" && !item.hatalar.some(h => h.toLowerCase().includes("adres"))) return false;
                    if (durumHataFiltresi === "tckn" && !item.hatalar.some(h => h.includes("TCKN") || h.includes("VKN"))) return false;
                    if (durumHataFiltresi === "baba" && !item.hatalar.some(h => h.toLowerCase().includes("baba"))) return false;
                    if (durumHataFiltresi === "il" && !item.hatalar.some(h => h.toLowerCase().includes("il") || h.toLowerCase().includes("ilçe"))) return false;
                    if (durumHataFiltresi === "seri" && !item.hatalar.some(h => h.toLowerCase().includes("seri") || h.toLowerCase().includes("belge"))) return false;
                    if (durumHataFiltresi === "unvan" && !item.hatalar.some(h => h.toLowerCase().includes("ünvan") || h.toLowerCase().includes("adı"))) return false;

                    if (!aramaMetni) return true;
                    const q = aramaMetni.toLowerCase();
                    return (
                      item.seriNo.toLowerCase().includes(q) ||
                      item.vrgSoyad.toLowerCase().includes(q) ||
                      item.ad.toLowerCase().includes(q) ||
                      item.tckn.includes(q) ||
                      item.belgeNo.toLowerCase().includes(q) ||
                      item.adres.toLowerCase().includes(q)
                    );
                  });

                  if (fisSonuclari.length === 0) {
                    return (
                      <tr>
                        <td colSpan={17} className="text-center py-4 text-muted">
                          Henüz fiş kontrolü yapılmadı veya bu tarih aralığında fiş bulunamadı.
                        </td>
                      </tr>
                    );
                  }

                  if (filtered.length === 0) {
                    return (
                      <tr>
                        <td colSpan={17} className="text-center py-4">
                          {fisHataliSayisi === 0 ? (
                            <div className="text-success d-flex align-items-center justify-content-center gap-2">
                              <IconCheck size={20} />
                              <span className="fw-semibold">Tüm döviz fişleri geçerlidir, eksik veya hatalı fiş kaydı bulunamadı.</span>
                            </div>
                          ) : (
                            <span className="text-muted">Bu filtre kriterine uygun kayıt bulunamadı.</span>
                          )}
                        </td>
                      </tr>
                    );
                  }

                  return filtered.map((row, idx) => (
                    <tr key={idx} className={!row.gecerli ? "row-error" : ""}>
                      <td className="text-center">{row.tarih || <span className="text-danger fw-bold" style={{ fontSize: "0.85em" }}>EKSİK</span>}</td>
                      <td className="text-center font-monospace">{row.seriNo || <span className="text-danger fw-bold" style={{ fontSize: "0.85em" }}>EKSİK</span>}</td>
                      <td className="text-center font-monospace small">{row.hukukiYapi === "18" ? "Tüzel" : "Gerçek"}</td>
                      <td className="fw-semibold text-truncate" title={row.vrgSoyad}>{row.vrgSoyad || <span className="text-danger fw-bold" style={{ fontSize: "0.85em" }}>EKSİK</span>}</td>
                      <td className="text-truncate" title={row.ad}>{row.ad || <span className="text-danger fw-bold" style={{ fontSize: "0.85em" }}>EKSİK</span>}</td>
                      <td className="text-center text-truncate" title={row.babaAdi}>
                        {row.babaAdi ? row.babaAdi : (row.hukukiYapi !== "18" && row.uyruk === "TR" ? <span className="text-danger fw-bold" style={{ fontSize: "0.85em" }}>EKSİK</span> : "-")}
                      </td>
                      <td className="text-center font-monospace text-truncate" title={row.belgeNo}>{row.belgeNo || <span className="text-danger fw-bold" style={{ fontSize: "0.85em" }}>EKSİK</span>}</td>
                      <td className="text-center">{row.uyruk || "TR"}</td>
                      <td className="text-center">{row.hukukiYapi || "01"}</td>
                      <td className="text-center font-monospace">
                        {row.tckn ? row.tckn : <span className="text-danger fw-bold" style={{ fontSize: "0.85em" }}>EKSİK</span>}
                      </td>
                      <td className="text-truncate" title={row.adres}>
                        {row.adres ? row.adres : <span className="text-danger fw-bold" style={{ fontSize: "0.85em" }}>EKSİK</span>}
                      </td>
                      <td className="text-truncate" title={row.ilce}>{row.ilce || <span className="text-danger fw-bold" style={{ fontSize: "0.85em" }}>EKSİK</span>}</td>
                      <td className="text-center">{row.postaKodu || <span className="text-danger fw-bold" style={{ fontSize: "0.85em" }}>EKSİK</span>}</td>
                      <td className="text-center font-monospace">{row.ilKodu ? row.ilKodu : <span className="text-danger fw-bold" style={{ fontSize: "0.85em" }}>EKSİK</span>}</td>
                      <td className="text-truncate" title={row.ilAdi}>{row.ilAdi || <span className="text-danger fw-bold" style={{ fontSize: "0.85em" }}>EKSİK</span>}</td>
                      <td className="text-center">{row.ulke || "Türkiye"}</td>
                      <td className="text-center p-0.5">
                        {row.gecerli ? (
                          <span className="badge bg-success text-white" style={{ fontSize: "0.85em", padding: "2px 5px" }}>Geçerli</span>
                        ) : (
                          <div className="d-flex flex-wrap gap-0.5 justify-content-center">
                            {row.hatalar.map((h, hIdx) => (
                              <span
                                key={hIdx}
                                className="badge bg-danger text-white fw-normal"
                                style={{ fontSize: "0.82em", padding: "1.5px 3px", lineHeight: "1.1" }}
                              >
                                {h}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  ));
                })()}
              </tbody>
            </table>
          )}

          {/* TABLO 4: FİŞ SATIRI KONTROLÜ (1 Satır Beyaz, 1 Satır Açık Mavi) */}
          {islemModu === "kontrol" && kontrolTuru === "fisSatiri" && (
            <table className="xml-dosya-table">
              <thead>
                <tr>
                  <th className="text-center" style={{ width: "95px" }}>Tarih</th>
                  <th className="text-center" style={{ width: "100px" }}>Seri No</th>
                  <th className="text-center" style={{ width: "70px" }}>Satır No</th>
                  <th className="text-center" style={{ width: "90px" }}>Döviz</th>
                  <th className="text-center" style={{ width: "90px" }}>İşlem Tipi</th>
                  <th className="text-end">Miktar</th>
                  <th className="text-end">Tutar (TL)</th>
                  <th className="text-center" style={{ width: "110px" }}>Durum</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const filtered = fisSatirSonuclari.filter((item) => {
                    if (durumHataFiltresi === "hatali" && item.gecerli) return false;
                    if (durumHataFiltresi === "gecerli" && !item.gecerli) return false;
                    if (!aramaMetni) return true;
                    return (
                      item.seriNo.toLowerCase().includes(aramaMetni.toLowerCase()) ||
                      item.xmlParaKodu.toLowerCase().includes(aramaMetni.toLowerCase())
                    );
                  });

                  if (fisSatirSonuclari.length === 0) {
                    return (
                      <tr>
                        <td colSpan={8} className="text-center py-4 text-muted">
                          Henüz fiş satırı kontrolü yapılmadı veya satır bulunamadı.
                        </td>
                      </tr>
                    );
                  }

                  if (filtered.length === 0) {
                    return (
                      <tr>
                        <td colSpan={8} className="text-center py-4">
                          {satirHataliSayisi === 0 ? (
                            <div className="text-success d-flex align-items-center justify-content-center gap-2">
                              <IconCheck size={20} />
                              <span className="fw-semibold">Tüm fiş satırları geçerlidir, eksik veya hatalı satır bulunamadı.</span>
                            </div>
                          ) : (
                            <span className="text-muted">Bu filtre kriterine uygun satır bulunamadı.</span>
                          )}
                        </td>
                      </tr>
                    );
                  }

                  return filtered.map((row, idx) => (
                    <tr key={idx} className={!row.gecerli ? "row-error" : ""}>
                      <td className="text-center">{row.tarih}</td>
                      <td className="text-center font-monospace">{row.seriNo}</td>
                      <td className="text-center">{row.satirNo}</td>
                      <td className="text-center fw-bold text-primary">{row.xmlParaKodu}</td>
                      <td className="text-center">{row.islemTipi}</td>
                      <td className="text-end font-monospace">{trSayiBicimi(2, 2).format(row.miktar)}</td>
                      <td className="text-end font-monospace fw-semibold">
                        {trSayiBicimi(2, 2).format(row.tutarTl)} ₺
                      </td>
                      <td className="text-center">
                        {row.gecerli ? (
                          <span className="badge bg-success-subtle text-success border border-success">Geçerli</span>
                        ) : (
                          <span className="badge bg-danger text-white" title={row.hatalar.join(", ")}>
                            {row.hatalar[0] || "Hata"}
                          </span>
                        )}
                      </td>
                    </tr>
                  ));
                })()}
              </tbody>
            </table>
          )}

          {/* OLUŞTURULAN XML GÖRÜNÜMÜ */}
          {islemModu === "olusturma" && (
            <div className="p-3 d-flex flex-column h-100">
              {yukleniyor && !olusturulanXml ? (
                <div className="text-center py-5 text-muted my-auto">
                  <div className="spinner-border spinner-border-sm text-primary me-2" role="status"></div>
                  XML dosyası ve önizleme hazırlanıyor, lütfen bekleyiniz...
                </div>
              ) : !olusturulanXml ? (
                <div className="text-center py-5 text-muted my-auto">
                  <p className="mb-2">Henüz XML önizlemesi hazırlanmadı.</p>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm px-3"
                    onClick={() => handleXmlOlustur(false)}
                  >
                    XML Önizlemesini Hazırla
                  </button>
                </div>
              ) : (
                <div className="d-flex flex-column h-100 gap-2">
                  <div className="d-flex flex-wrap align-items-center justify-content-between bg-light border p-2 rounded">
                    <div className="d-flex align-items-center gap-3 small">
                      <span><strong>İşlem Sayısı:</strong> <span className="badge bg-primary ms-1">{olusturulanXml.topIslemSayisi}</span></span>
                      <span><strong>Toplam Tutar:</strong> <span className="badge bg-success ms-1">{trSayiBicimi(2, 2).format(olusturulanXml.topTutar)} TL</span></span>
                      <span><strong>Dönem:</strong> <span className="ms-1">{olusturulanXml.bilgidonem}</span></span>
                      <span><strong>Dosya:</strong> <code className="ms-1">{olusturulanXml.dosyaAdi}</code></span>
                    </div>

                    <div className="d-flex gap-2">
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1"
                        onClick={() => handleKopyala(olusturulanXml.xmlContent)}
                      >
                        <IconCopy size={14} /> Kopyala
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-success d-flex align-items-center gap-1"
                        onClick={() => XmlDosyaService.diskeKaydet(olusturulanXml.xmlContent, olusturulanXml.dosyaAdi)}
                      >
                        <IconDownload size={14} /> Farklı Kaydet
                      </button>
                    </div>
                  </div>

                  <textarea
                    className="form-control font-monospace small flex-grow-1 bg-dark text-light p-2 rounded"
                    rows={18}
                    readOnly
                    value={olusturulanXml.xmlContent}
                    style={{ resize: "vertical", minHeight: "420px" }}
                  />
                </div>
              )}
            </div>
          )}

          {/* BİRLEŞTİRİLEN XML GÖRÜNÜMÜ */}
          {islemModu === "birlestirme" && (
            <div className="p-3 d-flex flex-column h-100">
              {!birlestirilenXml ? (
                <div className="d-flex flex-column gap-3 my-auto py-2">
                  <div className="alert alert-info py-2 px-3 small mb-0 d-flex align-items-center justify-content-between">
                    <span>
                      Birleştirme işlemi için <strong>1. Kaynak XML (Ana Merkez)</strong> ve <strong>2. Hedef XML (Şube Dosyası)</strong> doğrudan seçilmelidir.
                    </span>
                    <span className="badge bg-primary-subtle text-primary border border-primary">Canlı VİM Standartı</span>
                  </div>

                  <div className="row g-3">
                    {/* 1. Kaynak XML Kartı */}
                    <div className="col-md-6">
                      <div className="card h-100 border p-3 bg-white shadow-xs">
                        <div className="d-flex align-items-center justify-content-between mb-2">
                          <h6 className="fw-bold mb-0 text-dark d-flex align-items-center gap-1.5">
                            <span className="badge bg-primary rounded-circle">1</span>
                            <span>Kaynak XML (Ana Merkez)</span>
                          </h6>
                          {kaynakXmlText ? (
                            <span className="badge bg-success text-white">Hazır ({kaynakXmlText.length} karakter)</span>
                          ) : (
                            <span className="badge bg-warning-subtle text-warning border border-warning">Dosya Bekleniyor</span>
                          )}
                        </div>
                        <p className="small text-muted mb-3">
                          Ana şubenin VİM döviz transfer XML dosyasıdır. Doğrudan bilgisayarınızdan seçiniz.
                        </p>

                        <div className="d-flex flex-column gap-2 mt-auto">
                          <input
                            type="file"
                            id="kaynakXmlCardInput"
                            accept=".xml"
                            className="d-none"
                            onChange={handleKaynakDosyaSec}
                          />
                          <label
                            className={`btn btn-md fw-bold d-flex align-items-center justify-content-center gap-2 cursor-pointer ${
                              kaynakXmlText ? "btn-outline-success" : "btn-primary"
                            }`}
                            htmlFor="kaynakXmlCardInput"
                          >
                            <IconFolder size={18} />
                            <span>{kaynakDosyaAdi ? `Dosya: ${kaynakDosyaAdi}` : "1. Kaynak XML Dosyası Seç (.xml)"}</span>
                          </label>

                          <div className="d-flex align-items-center gap-2">
                            {kaynakXmlText && (
                              <button
                                type="button"
                                className="btn btn-outline-danger btn-xs"
                                onClick={() => {
                                  setKaynakXmlText("");
                                  setKaynakDosyaAdi("");
                                }}
                              >
                                Seçimi Temizle
                              </button>
                            )}
                            {olusturulanXml && !kaynakXmlText && (
                              <button
                                type="button"
                                className="btn btn-outline-secondary btn-xs ms-auto"
                                onClick={() => {
                                  setKaynakXmlText(olusturulanXml.xmlContent);
                                  setKaynakDosyaAdi(olusturulanXml.dosyaAdi);
                                }}
                              >
                                Oluşturulan XML'i Aktar ({olusturulanXml.dosyaAdi})
                              </button>
                            )}
                          </div>
                        </div>

                        {kaynakXmlText && (
                          <div className="mt-2 small text-secondary font-monospace bg-light p-2 border rounded" style={{ maxHeight: "65px", overflow: "hidden" }}>
                            {kaynakXmlText.slice(0, 150)}...
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 2. Hedef XML Kartı */}
                    <div className="col-md-6">
                      <div className="card h-100 border p-3 bg-white shadow-xs">
                        <div className="d-flex align-items-center justify-content-between mb-2">
                          <h6 className="fw-bold mb-0 text-dark d-flex align-items-center gap-1.5">
                            <span className="badge bg-secondary rounded-circle">2</span>
                            <span>Hedef XML (Şube Dosyası)</span>
                          </h6>
                          {hedefXmlText ? (
                            <span className="badge bg-success text-white">Hazır ({hedefXmlText.length} karakter)</span>
                          ) : (
                            <span className="badge bg-warning-subtle text-warning border border-warning">Dosya Bekleniyor</span>
                          )}
                        </div>
                        <p className="small text-muted mb-3">
                          Şubeden gelen VİM döviz transfer XML dosyasıdır. Doğrudan bilgisayarınızdan seçiniz.
                        </p>

                        <div className="d-flex flex-column gap-2 mt-auto">
                          <input
                            type="file"
                            id="hedefXmlCardInput"
                            accept=".xml"
                            className="d-none"
                            onChange={handleHedefDosyaSec}
                          />
                          <label
                            className={`btn btn-md fw-bold d-flex align-items-center justify-content-center gap-2 cursor-pointer ${
                              hedefXmlText ? "btn-outline-success" : "btn-secondary"
                            }`}
                            htmlFor="hedefXmlCardInput"
                          >
                            <IconFolder size={18} />
                            <span>{hedefDosyaAdi ? `Dosya: ${hedefDosyaAdi}` : "2. Hedef XML Dosyası Seç (.xml)"}</span>
                          </label>

                          <div className="d-flex align-items-center gap-2">
                            {hedefXmlText && (
                              <button
                                type="button"
                                className="btn btn-outline-danger btn-xs"
                                onClick={() => {
                                  setHedefXmlText("");
                                  setHedefDosyaAdi("");
                                }}
                              >
                                Seçimi Temizle
                              </button>
                            )}
                            <button
                              type="button"
                              className="btn btn-outline-info btn-xs ms-auto"
                              onClick={handleOrnekSubeYukle}
                            >
                              Örnek Şube XML'i Yükle (Test)
                            </button>
                          </div>
                        </div>

                        {hedefXmlText && (
                          <div className="mt-2 small text-secondary font-monospace bg-light p-2 border rounded" style={{ maxHeight: "65px", overflow: "hidden" }}>
                            {hedefXmlText.slice(0, 150)}...
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="text-center pt-2">
                    <button
                      type="button"
                      className="btn btn-primary btn-lg px-5 fw-bold shadow-sm d-inline-flex align-items-center gap-2"
                      onClick={() => handleXmlBirlestir(false)}
                      disabled={!kaynakXmlText || !hedefXmlText || yukleniyor}
                    >
                      <IconArrowsJoin size={20} />
                      <span>İki Dosyayı Birleştir ve Önizle</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="d-flex flex-column h-100 gap-2">
                  <div className="d-flex flex-wrap align-items-center justify-content-between bg-light border p-2 rounded">
                    <div className="d-flex align-items-center gap-3 small">
                      <span><strong>Kaynak:</strong> <span className="badge bg-secondary ms-1">{birlestirilenXml.kaynakIslemSayisi} işlem</span></span>
                      <span><strong>Hedef:</strong> <span className="badge bg-secondary ms-1">{birlestirilenXml.hedefIslemSayisi} işlem</span></span>
                      <span><strong>Birleştirilmiş:</strong> <span className="badge bg-primary ms-1">{birlestirilenXml.topIslemSayisi} işlem</span></span>
                      <span><strong>Toplam Tutar:</strong> <span className="badge bg-success ms-1">{trSayiBicimi(2, 2).format(birlestirilenXml.topTutar)} TL</span></span>
                    </div>

                    <div className="d-flex align-items-center gap-2">
                      <div className="btn-group btn-group-sm" role="group">
                        <button
                          type="button"
                          className={`btn ${birlestirmeSekmesi === "sonuc" ? "btn-primary" : "btn-outline-secondary"}`}
                          onClick={() => setBirlestirmeSekmesi("sonuc")}
                        >
                          Birleştirilmiş XML
                        </button>
                        <button
                          type="button"
                          className={`btn ${birlestirmeSekmesi === "kaynak" ? "btn-primary" : "btn-outline-secondary"}`}
                          onClick={() => setBirlestirmeSekmesi("kaynak")}
                        >
                          1. Kaynak XML
                        </button>
                        <button
                          type="button"
                          className={`btn ${birlestirmeSekmesi === "hedef" ? "btn-primary" : "btn-outline-secondary"}`}
                          onClick={() => setBirlestirmeSekmesi("hedef")}
                        >
                          2. Hedef XML
                        </button>
                      </div>

                      <button
                        type="button"
                        className="btn btn-sm btn-outline-danger d-flex align-items-center gap-1"
                        onClick={() => setBirlestirilenXml(null)}
                        title="Farklı dosyalar seçmek için sıfırla"
                      >
                        Yeni Dosyalar Seç
                      </button>

                      <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1"
                        onClick={() =>
                          handleKopyala(
                            birlestirmeSekmesi === "sonuc"
                              ? birlestirilenXml.xmlContent
                              : birlestirmeSekmesi === "kaynak"
                              ? kaynakXmlText
                              : hedefXmlText
                          )
                        }
                      >
                        <IconCopy size={14} /> Kopyala
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-success d-flex align-items-center gap-1"
                        onClick={() =>
                          XmlDosyaService.diskeKaydet(
                            birlestirilenXml.xmlContent,
                            "birlestirilmis_doviz_islemleri.xml"
                          )
                        }
                      >
                        <IconDownload size={14} /> Farklı Kaydet
                      </button>
                    </div>
                  </div>

                  <textarea
                    className="form-control font-monospace small flex-grow-1 bg-dark text-light p-2 rounded"
                    rows={18}
                    readOnly
                    value={
                      birlestirmeSekmesi === "sonuc"
                        ? birlestirilenXml.xmlContent
                        : birlestirmeSekmesi === "kaynak"
                        ? kaynakXmlText
                        : hedefXmlText
                    }
                    style={{ resize: "vertical", minHeight: "420px" }}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </Card.Body>
    </Card>
  </Col>
</Row>
    </div>
  );
}
