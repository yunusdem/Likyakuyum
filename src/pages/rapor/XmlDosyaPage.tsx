import React, { useState, useEffect } from "react";
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
} from "@tabler/icons-react";
import {
  XmlDosyaService,
  MerkezKurKontrolItem,
  FirmaKontrolResult,
  FisKontrolItem,
  FisSatirKontrolItem,
  XmlOlusturResult,
  XmlBirlestirResult,
} from "../../services/xmlDosyaService";
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

  // Sayfa ilk açıldığında Merkez Bankası Kur Kontrol Tablosunu ve Firma Bilgilerini otomatik yükle
  useEffect(() => {
    let aktif = true;
    const ilkYukleme = async () => {
      setYukleniyor(true);
      try {
        const [kurData, firmaData] = await Promise.all([
          XmlDosyaService.kontrolMerkezKur({
            ilkTarih,
            sonTarih,
            belgeIslemNo: belgeIslemNo || undefined,
            belgeIslemNoTuru,
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
  const handleMerkezKurKontrol = async () => {
    setKontrolTuru("merkezKur");
    setDurumHataFiltresi("hatali");
    setYukleniyor(true);
    try {
      const data = await XmlDosyaService.kontrolMerkezKur({
        ilkTarih,
        sonTarih,
        belgeIslemNo: belgeIslemNo || undefined,
        belgeIslemNoTuru,
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
  const handleFisKontrol = async () => {
    setKontrolTuru("fis");
    setDurumHataFiltresi("hatali");
    setYukleniyor(true);
    try {
      const data = await XmlDosyaService.kontrolFis({
        ilkTarih,
        sonTarih,
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
  const handleFisSatiriKontrol = async () => {
    setKontrolTuru("fisSatiri");
    setDurumHataFiltresi("hatali");
    setYukleniyor(true);
    try {
      const data = await XmlDosyaService.kontrolFisSatiri({
        ilkTarih,
        sonTarih,
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

      {/* 1. ÜST PANEL: Kompakt Başlık, Modlar ve Seçimler */}
      <div className="card shadow-2xs border bg-white p-2">
        {/* Satır 1: Başlık & Mod Seçimi */}
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 border-bottom pb-2 mb-2">
          <div className="d-flex align-items-center gap-2">
            <span className="p-1.5 bg-primary bg-opacity-10 text-primary rounded d-inline-flex">
              <IconFileCode size={20} />
            </span>
            <span className="fw-bold text-dark fs-6">J- XML Dosya İşlemleri</span>
            <span className="badge bg-light text-secondary border small">VİM Döviz Transferi</span>
          </div>

          <div className="d-flex align-items-center gap-1">
            <div className="btn-group btn-group-sm" role="group">
              <button
                type="button"
                className={`btn fw-semibold px-3 ${islemModu === "kontrol" ? "btn-primary" : "btn-outline-secondary"}`}
                onClick={() => setIslemModu("kontrol")}
              >
                <IconCheck size={15} className="me-1" /> Dosya Kontrolü
              </button>
              <button
                type="button"
                className={`btn fw-semibold px-3 ${islemModu === "olusturma" ? "btn-primary" : "btn-outline-secondary"}`}
                onClick={() => setIslemModu("olusturma")}
              >
                <IconDownload size={15} className="me-1" /> Dosya Oluşturma
              </button>
              <button
                type="button"
                className={`btn fw-semibold px-3 ${islemModu === "birlestirme" ? "btn-primary" : "btn-outline-secondary"}`}
                onClick={() => setIslemModu("birlestirme")}
              >
                <IconArrowsJoin size={15} className="me-1" /> Dosya Birleştirme
              </button>
            </div>

            <button
              type="button"
              className="btn btn-sm btn-outline-secondary px-2 ms-2"
              onClick={() => window.print()}
              title="Yazdır"
            >
              <IconPrinter size={15} />
            </button>
          </div>
        </div>

        {/* Satır 2: Ekonomik Yatay Seçimler ve Filtreler */}
        {islemModu === "kontrol" && (
          <div className="d-flex flex-wrap align-items-center justify-content-between gap-2">
            {/* Sol: Tarih ve No Filtreleri */}
            <div className="d-flex flex-wrap align-items-center gap-2">
              <div className="d-flex align-items-center gap-1">
                <span className="small text-secondary fw-semibold">Tarih:</span>
                <input
                  type="date"
                  className="form-control form-control-sm px-1.5"
                  style={{ width: "130px" }}
                  value={ilkTarih}
                  onChange={(e) => setIlkTarih(e.target.value)}
                />
                <span className="small text-muted">-</span>
                <input
                  type="date"
                  className="form-control form-control-sm px-1.5"
                  style={{ width: "130px" }}
                  value={sonTarih}
                  onChange={(e) => setSonTarih(e.target.value)}
                />
              </div>

              <div className="d-flex align-items-center gap-1">
                <select
                  className="form-select form-select-sm"
                  style={{ width: "95px" }}
                  value={belgeIslemNoTuru}
                  onChange={(e) => setBelgeIslemNoTuru(e.target.value as any)}
                >
                  <option value="seri">Seri No</option>
                  <option value="belge">Belge No</option>
                </select>
                <input
                  type="text"
                  className="form-control form-control-sm"
                  style={{ width: "120px" }}
                  placeholder="No Filtre..."
                  value={belgeIslemNo}
                  onChange={(e) => setBelgeIslemNo(e.target.value)}
                />
              </div>

              {/* Dikey ayraç */}
              <div className="vr d-none d-md-block" style={{ height: "24px" }} />

              {/* 4 Kontrol Eylem Butonları */}
              <div className="btn-group btn-group-sm" role="group">
                <button
                  type="button"
                  className={`btn px-2.5 d-inline-flex align-items-center gap-1 fw-semibold ${
                    kontrolTuru === "merkezKur" ? "btn-primary" : "btn-outline-dark"
                  }`}
                  onClick={handleMerkezKurKontrol}
                  disabled={yukleniyor}
                  title="Merkez Bankası kurlarını kontrol eder"
                >
                  <IconCoins size={15} />
                  <span>Merkez Kur</span>
                  {merkezKurSonuclari.length > 0 && (
                    <span className={`badge ms-1 ${kurHataliSayisi > 0 ? "bg-danger" : "bg-success"}`}>
                      {kurHataliSayisi > 0 ? `! ${kurHataliSayisi}` : merkezKurSonuclari.length}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  className={`btn px-2.5 d-inline-flex align-items-center gap-1 fw-semibold ${
                    kontrolTuru === "firma" ? "btn-primary" : "btn-outline-dark"
                  }`}
                  onClick={handleFirmaKontrol}
                  disabled={yukleniyor}
                  title="Firma vergi, adres ve şube bilgilerini kontrol eder"
                >
                  <IconBuilding size={15} />
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
                    kontrolTuru === "fis" ? "btn-primary" : "btn-outline-dark"
                  }`}
                  onClick={handleFisKontrol}
                  disabled={yukleniyor}
                  title="Döviz fişlerinin kimlik, vergi ve adres bilgilerini kontrol eder"
                >
                  <IconReceipt size={15} />
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
                    kontrolTuru === "fisSatiri" ? "btn-primary" : "btn-outline-dark"
                  }`}
                  onClick={handleFisSatiriKontrol}
                  disabled={yukleniyor}
                  title="Döviz fişlerinin satır, tutar ve para kodlarını kontrol eder"
                >
                  <IconListDetails size={15} />
                  <span>Fiş Satırı</span>
                  {fisSatirSonuclari.length > 0 && (
                    <span className={`badge ms-1 ${satirHataliSayisi > 0 ? "bg-danger" : "bg-success"}`}>
                      {satirHataliSayisi > 0 ? `! ${satirHataliSayisi}` : fisSatirSonuclari.length}
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* Sağ: Tablo İçi Hızlı Arama & Tablo Boyutlandırma (En Üstte) */}
            <div className="d-flex align-items-center gap-2">
              {kontrolTuru === "fis" && (
                <div className="d-flex align-items-center gap-1 bg-light border rounded px-1.5 py-0.5 shadow-2xs">
                  <span className="small text-secondary fw-bold" style={{ fontSize: "11px" }}>Boyut:</span>
                  <div className="btn-group btn-group-sm" role="group">
                    <button
                      type="button"
                      className="btn btn-outline-secondary btn-xs px-2 fw-bold d-inline-flex align-items-center justify-content-center"
                      onClick={handleTabloKucult}
                      title="Küçült (-)"
                      style={{ height: "24px", minWidth: "28px" }}
                    >
                      <IconMinus size={14} stroke={2.5} />
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline-secondary btn-xs px-2 font-monospace fw-semibold"
                      onClick={handleTabloBoyutSifirla}
                      title="Varsayılan Boyuta Sıfırla (%100)"
                      style={{ fontSize: "11px", height: "24px" }}
                    >
                      %{Math.round((tabloYaziBoyutu / 11) * 100)}
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline-secondary btn-xs px-2 fw-bold d-inline-flex align-items-center justify-content-center"
                      onClick={handleTabloBuyut}
                      title="Büyüt (+)"
                      style={{ height: "24px", minWidth: "28px" }}
                    >
                      <IconPlus size={14} stroke={2.5} />
                    </button>
                  </div>
                </div>
              )}

              <div className="input-group input-group-sm" style={{ width: "170px" }}>
                <span className="input-group-text bg-white px-2">
                  <IconSearch size={14} className="text-secondary" />
                </span>
                <input
                  type="text"
                  className="form-control px-1.5"
                  placeholder="Tabloda ara..."
                  value={aramaMetni}
                  onChange={(e) => setAramaMetni(e.target.value)}
                />
              </div>
            </div>
          </div>
        )}

        {/* Dosya Oluşturma Yatay Kontrolleri */}
        {islemModu === "olusturma" && (
          <div className="d-flex flex-wrap align-items-center justify-content-between gap-2">
            <div className="d-flex flex-wrap align-items-center gap-2">
              <div className="d-flex align-items-center gap-1">
                <span className="small text-secondary fw-semibold">Hazırlama:</span>
                <input
                  type="date"
                  className="form-control form-control-sm px-1.5"
                  style={{ width: "130px" }}
                  value={hazirlamaTarihi}
                  onChange={(e) => setHazirlamaTarihi(e.target.value)}
                />
              </div>

              <div className="d-flex align-items-center gap-1">
                <span className="small text-secondary fw-semibold">Dönem:</span>
                <input
                  type="date"
                  className="form-control form-control-sm px-1.5"
                  style={{ width: "130px" }}
                  value={ilkTarih}
                  onChange={(e) => setIlkTarih(e.target.value)}
                />
                <span className="small text-muted">-</span>
                <input
                  type="date"
                  className="form-control form-control-sm px-1.5"
                  style={{ width: "130px" }}
                  value={sonTarih}
                  onChange={(e) => setSonTarih(e.target.value)}
                />
              </div>

              <div className="d-flex align-items-center gap-1">
                <span className="small text-secondary fw-semibold">Dosya No:</span>
                <input
                  type="text"
                  className="form-control form-control-sm text-center"
                  style={{ width: "55px" }}
                  value={dosyaNo}
                  onChange={(e) => setDosyaNo(e.target.value)}
                />
              </div>

              <div className="form-check mb-0 ms-1">
                <input
                  className="form-check-input"
                  type="checkbox"
                  id="islemYokTopCheck"
                  checked={islemYok}
                  onChange={(e) => setIslemYok(e.target.checked)}
                />
                <label className="form-check-label small fw-semibold text-secondary" htmlFor="islemYokTopCheck">
                  İşlem Yok
                </label>
              </div>

              <div className="d-flex align-items-center gap-1">
                <span className="small text-secondary fw-semibold">Dosya Adı:</span>
                <input
                  type="text"
                  className="form-control form-control-sm font-monospace"
                  style={{ width: "140px" }}
                  value={dosyaAdi}
                  onChange={(e) => setDosyaAdi(e.target.value)}
                />
              </div>

              <div className="d-flex align-items-center gap-1">
                <input
                  type="text"
                  className="form-control form-control-sm"
                  style={{ width: "160px" }}
                  placeholder="Dönem Açıklaması..."
                  value={aciklama}
                  onChange={(e) => setAciklama(e.target.value)}
                />
              </div>
            </div>

            <div className="d-flex align-items-center gap-2">
              <button
                type="button"
                className="btn btn-outline-primary btn-sm px-3 fw-semibold d-inline-flex align-items-center gap-1 shadow-xs"
                onClick={() => handleXmlOlustur(false)}
                disabled={yukleniyor}
                title="XML dosyasını yeniden derler ve aşağıdaki önizlemeyi yeniler"
              >
                <IconSearch size={15} />
                <span>Önizlemeyi Yenile</span>
              </button>
              <button
                type="button"
                className="btn btn-success btn-sm px-3 fw-bold d-inline-flex align-items-center gap-1 shadow-xs"
                onClick={() => handleXmlOlustur(true)}
                disabled={yukleniyor}
              >
                <IconDownload size={16} />
                <span>XML Oluştur ve Kaydet</span>
              </button>
            </div>
          </div>
        )}

        {/* Dosya Birleştirme Yatay Kontrolleri (Canlıya Uygun Doğrudan Dosya Seçimi) */}
        {islemModu === "birlestirme" && (
          <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 p-1 bg-light rounded border">
            <div className="d-flex flex-wrap align-items-center gap-2">
              {/* 1. Kaynak XML (Ana Merkez) Doğrudan Dosya Seçimi */}
              <div className="d-flex align-items-center gap-1.5">
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
                  <IconFolder size={15} />
                  <span>1. Kaynak XML (Ana Merkez) Seç</span>
                </label>
                {kaynakDosyaAdi ? (
                  <span className="badge bg-success-subtle text-success border border-success small" title={kaynakDosyaAdi}>
                    {kaynakDosyaAdi}
                  </span>
                ) : (
                  <span className="text-muted small">Seçilmedi</span>
                )}
              </div>

              <div className="border-start ps-2 d-flex align-items-center gap-1.5">
                {/* 2. Hedef XML (Şube Dosyası) Doğrudan Dosya Seçimi */}
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
                  <IconFolder size={15} />
                  <span>2. Hedef XML (Şube Dosyası) Seç</span>
                </label>
                {hedefDosyaAdi ? (
                  <span className="badge bg-success-subtle text-success border border-success small" title={hedefDosyaAdi}>
                    {hedefDosyaAdi}
                  </span>
                ) : (
                  <span className="text-muted small">Seçilmedi</span>
                )}
              </div>

              <div className="border-start ps-2 d-flex align-items-center gap-1">
                <span className="small text-secondary fw-semibold">Dosya No:</span>
                <input
                  type="text"
                  className="form-control form-control-sm text-center"
                  style={{ width: "55px" }}
                  value={dosyaNo}
                  onChange={(e) => setDosyaNo(e.target.value)}
                />
              </div>
            </div>

            <div className="d-flex align-items-center gap-2">
              <button
                type="button"
                className="btn btn-primary btn-sm px-3 fw-bold d-inline-flex align-items-center gap-1.5 shadow-xs"
                onClick={() => handleXmlBirlestir(false)}
                disabled={yukleniyor || !kaynakXmlText || !hedefXmlText}
              >
                <IconArrowsJoin size={16} />
                <span>Birleştir ve Önizle</span>
              </button>
              <button
                type="button"
                className="btn btn-success btn-sm px-3 fw-bold d-inline-flex align-items-center gap-1.5 shadow-xs"
                onClick={() => handleXmlBirlestir(true)}
                disabled={yukleniyor || !kaynakXmlText || !hedefXmlText}
              >
                <IconDownload size={16} />
                <span>Birleştir ve Kaydet</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 2. ALT PANEL: Geniş Tam Ekran Tablolar & Sonuçlar */}
      <div className="card shadow-2xs border bg-white flex-grow-1 d-flex flex-column" style={{ minHeight: "520px" }}>
        {/* Tablo Üst Başlık Çubuğu */}
        <div className="px-3 py-1.5 border-bottom bg-light d-flex flex-wrap align-items-center justify-content-between gap-2">
          <div className="d-flex align-items-center gap-2">
            <span className="fw-bold small text-dark text-uppercase">
              {islemModu === "kontrol" && kontrolTuru === "merkezKur" && "Merkez Bankası Kur Kontrol Tablosu"}
              {islemModu === "kontrol" && kontrolTuru === "firma" && "Firma VİM Bilgileri Kontrol Tablosu"}
              {islemModu === "kontrol" && kontrolTuru === "fis" && "Döviz Fişleri Kontrol Tablosu"}
              {islemModu === "kontrol" && kontrolTuru === "fisSatiri" && "Döviz Fiş Satırları Kontrol Tablosu"}
              {islemModu === "olusturma" && "Oluşturulan XML Dosyası ve Önizleme"}
              {islemModu === "birlestirme" && "Birleştirilmiş XML Çıktısı"}
            </span>

            {islemModu === "kontrol" && (
              <span className="badge bg-secondary-subtle text-secondary border small">
                {kontrolTuru === "merkezKur" && `${merkezKurSonuclari.length} gün (${kurHataliSayisi} eksik)`}
                {kontrolTuru === "firma" && (firmaSonucu ? (firmaSonucu.gecerli ? "Eksiksiz" : `${firmaSonucu.eksikler.length} eksik`) : "Bekleniyor")}
                {kontrolTuru === "fis" && `${fisSonuclari.length} fiş (${fisHataliSayisi} hatalı)`}
                {kontrolTuru === "fisSatiri" && `${fisSatirSonuclari.length} satır (${satirHataliSayisi} hatalı)`}
              </span>
            )}

            {/* Merkez Kur Kontrolünde Filtre Butonları */}
            {islemModu === "kontrol" && kontrolTuru === "merkezKur" && (
              <div className="d-flex align-items-center gap-1 ms-2">
                <button
                  type="button"
                  className={`btn btn-xs ${durumHataFiltresi === "hatali" ? "btn-danger text-white" : "btn-outline-danger"}`}
                  style={{ fontSize: "11px", padding: "1px 6px" }}
                  onClick={() => setDurumHataFiltresi("hatali")}
                >
                  Hatalılar / Eksikler ({kurHataliSayisi})
                </button>
                <button
                  type="button"
                  className={`btn btn-xs ${durumHataFiltresi === "hepsi" ? "btn-dark text-white" : "btn-outline-secondary"}`}
                  style={{ fontSize: "11px", padding: "1px 6px" }}
                  onClick={() => setDurumHataFiltresi("hepsi")}
                >
                  Tümü ({merkezKurSonuclari.length})
                </button>
                <button
                  type="button"
                  className={`btn btn-xs ${durumHataFiltresi === "gecerli" ? "btn-success text-white" : "btn-outline-success"}`}
                  style={{ fontSize: "11px", padding: "1px 6px" }}
                  onClick={() => setDurumHataFiltresi("gecerli")}
                >
                  Mevcut ({merkezKurSonuclari.length - kurHataliSayisi})
                </button>
              </div>
            )}

            {/* Firma Kontrolünde Filtre Butonları */}
            {islemModu === "kontrol" && kontrolTuru === "firma" && firmaSonucu && (
              <div className="d-flex align-items-center gap-1 ms-2">
                <button
                  type="button"
                  className={`btn btn-xs ${durumHataFiltresi === "hatali" ? "btn-danger text-white" : "btn-outline-danger"}`}
                  style={{ fontSize: "11px", padding: "1px 6px" }}
                  onClick={() => setDurumHataFiltresi("hatali")}
                >
                  Sadece Hatalar / Eksikler ({firmaSonucu.eksikler.length})
                </button>
                <button
                  type="button"
                  className={`btn btn-xs ${durumHataFiltresi === "hepsi" ? "btn-dark text-white" : "btn-outline-secondary"}`}
                  style={{ fontSize: "11px", padding: "1px 6px" }}
                  onClick={() => setDurumHataFiltresi("hepsi")}
                >
                  Tüm Firma Bilgileri
                </button>
              </div>
            )}

            {/* Fiş Satırı Kontrolünde Filtre Butonları */}
            {islemModu === "kontrol" && kontrolTuru === "fisSatiri" && (
              <div className="d-flex align-items-center gap-1 ms-2">
                <button
                  type="button"
                  className={`btn btn-xs ${durumHataFiltresi === "hatali" ? "btn-danger text-white" : "btn-outline-danger"}`}
                  style={{ fontSize: "11px", padding: "1px 6px" }}
                  onClick={() => setDurumHataFiltresi("hatali")}
                >
                  Hatalı Satırlar ({satirHataliSayisi})
                </button>
                <button
                  type="button"
                  className={`btn btn-xs ${durumHataFiltresi === "hepsi" ? "btn-dark text-white" : "btn-outline-secondary"}`}
                  style={{ fontSize: "11px", padding: "1px 6px" }}
                  onClick={() => setDurumHataFiltresi("hepsi")}
                >
                  Tümü ({fisSatirSonuclari.length})
                </button>
                <button
                  type="button"
                  className={`btn btn-xs ${durumHataFiltresi === "gecerli" ? "btn-success text-white" : "btn-outline-success"}`}
                  style={{ fontSize: "11px", padding: "1px 6px" }}
                  onClick={() => setDurumHataFiltresi("gecerli")}
                >
                  Geçerli Satırlar ({fisSatirSonuclari.length - satirHataliSayisi})
                </button>
              </div>
            )}

            {/* Fiş Kontrolünde Durum/Hata Hızlı Filtre Butonları */}
            {islemModu === "kontrol" && kontrolTuru === "fis" && (
              <div className="d-flex align-items-center gap-1 ms-2">
                <button
                  type="button"
                  className={`btn btn-xs ${durumHataFiltresi === "hatali" ? "btn-danger text-white" : "btn-outline-danger"}`}
                  style={{ fontSize: "11px", padding: "1px 6px" }}
                  onClick={() => setDurumHataFiltresi("hatali")}
                >
                  Hatalılar ({fisHataliSayisi})
                </button>
                <button
                  type="button"
                  className={`btn btn-xs ${durumHataFiltresi === "hepsi" ? "btn-dark text-white" : "btn-outline-secondary"}`}
                  style={{ fontSize: "11px", padding: "1px 6px" }}
                  onClick={() => setDurumHataFiltresi("hepsi")}
                >
                  Tümü ({fisSonuclari.length})
                </button>
                <button
                  type="button"
                  className={`btn btn-xs ${durumHataFiltresi === "gecerli" ? "btn-success text-white" : "btn-outline-success"}`}
                  style={{ fontSize: "11px", padding: "1px 6px" }}
                  onClick={() => setDurumHataFiltresi("gecerli")}
                >
                  Geçerliler ({fisSonuclari.length - fisHataliSayisi})
                </button>
                <select
                  className="form-select form-select-sm py-0 px-1.5 fw-semibold"
                  style={{ fontSize: "11px", height: "24px", width: "145px" }}
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

                {/* En Üstte Büyüt / Küçült Tablo Boyutlandırma Kontrolleri */}
                <div className="d-flex align-items-center gap-1 border-start ps-2 ms-1">
                  <span className="small text-secondary fw-semibold" style={{ fontSize: "11px" }}>Boyut:</span>
                  <div className="btn-group btn-group-sm" role="group">
                    <button
                      type="button"
                      className="btn btn-outline-secondary btn-xs px-2 fw-bold d-inline-flex align-items-center justify-content-center"
                      onClick={handleTabloKucult}
                      title="Küçült (-)"
                      style={{ height: "24px", minWidth: "28px" }}
                    >
                      <IconMinus size={14} stroke={2.5} />
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline-secondary btn-xs px-2 font-monospace fw-semibold"
                      onClick={handleTabloBoyutSifirla}
                      title="Sıfırla (%100)"
                      style={{ fontSize: "11px", height: "24px" }}
                    >
                      %{Math.round((tabloYaziBoyutu / 11) * 100)}
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline-secondary btn-xs px-2 fw-bold d-inline-flex align-items-center justify-content-center"
                      onClick={handleTabloBuyut}
                      title="Büyüt (+)"
                      style={{ height: "24px", minWidth: "28px" }}
                    >
                      <IconPlus size={14} stroke={2.5} />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {yukleniyor && (
              <span className="badge bg-primary-subtle text-primary border small d-inline-flex align-items-center gap-1">
                <span className="spinner-border spinner-border-sm" style={{ width: "10px", height: "10px" }}></span>
                İşlem yürütülüyor...
              </span>
            )}
          </div>

          <span className="text-muted font-monospace" style={{ fontSize: "11px" }}>
            {trTarihBicimi().format(new Date())} {new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>

        {/* Tablo Gövdesi */}
        <div className="flex-grow-1 overflow-auto p-0" style={{ maxHeight: "calc(100vh - 240px)", width: "100%", overflowX: "auto" }}>
          {/* TABLO 1: MERKEZ KUR */}
          {islemModu === "kontrol" && kontrolTuru === "merkezKur" && (
            <table className="xml-dosya-table">
              <thead>
                <tr>
                  <th style={{ width: "120px" }} className="text-center">Tarih</th>
                  <th style={{ width: "130px" }} className="text-center">Seri / Belge No</th>
                  <th>Açıklama</th>
                  <th style={{ width: "100px" }} className="text-center">Durum</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const filtered = merkezKurSonuclari.filter((item) => {
                    if (durumHataFiltresi === "hatali" && item.durum !== "hata") return false;
                    if (durumHataFiltresi === "gecerli" && item.durum === "hata") return false;
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
                        <td colSpan={4} className="text-center py-4 text-muted">
                          Henüz kontrol yapılmadı veya bu tarih aralığında fiş bulunamadı.
                        </td>
                      </tr>
                    );
                  }

                  if (filtered.length === 0) {
                    return (
                      <tr>
                        <td colSpan={4} className="text-center py-4">
                          {kurHataliSayisi === 0 ? (
                            <div className="text-success d-flex align-items-center justify-content-center gap-2">
                              <IconCheck size={20} />
                              <span className="fw-semibold">Tüm Merkez Bankası kurları tanımlıdır, eksik veya hatalı kur kaydı bulunamadı.</span>
                            </div>
                          ) : (
                            <span className="text-muted">Bu filtre kriterine uygun kayıt bulunamadı.</span>
                          )}
                        </td>
                      </tr>
                    );
                  }

                  return filtered.map((row, idx) => (
                    <tr key={idx} className={row.durum === "hata" ? "row-error" : ""}>
                      <td className="text-center fw-semibold">{row.tarih}</td>
                      <td className="text-center font-monospace">{row.seriNo}</td>
                      <td>{row.aciklama}</td>
                      <td className="text-center">
                        {row.durum === "tamam" ? (
                          <span className="badge bg-success-subtle text-success border border-success">Mevcut</span>
                        ) : (
                          <span className="badge bg-danger text-white">Eksik</span>
                        )}
                      </td>
                    </tr>
                  ));
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
      </div>
    </div>
  );
}
