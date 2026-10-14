import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Alert, Badge, Button, ButtonGroup, Form, InputGroup, Nav, Spinner } from "react-bootstrap";
import {
  IconBarcode,
  IconBuildingBank,
  IconCash,
  IconCheck,
  IconCreditCard,
  IconLayoutGrid,
  IconListDetails,
  IconRefresh,
  IconTrash,
  IconUser,
  IconUserDollar,
  IconX,
} from "@tabler/icons-react";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { usePosTahsilat } from "../../components/pos/PosTahsilat";
import { acikHizliSatisModulleri, hizliSatisYolu, sonModulYaz } from "../../config/hizliSatis";
import { HizliSatisService, HizliSatisSekme, HizliSatisYetki } from "../../services/hizliSatisService";
import { PosCihaziItem, PosCihaziService } from "../../services/posCihaziService";
import { BankaHesapItem, BankaService } from "../../services/bankaService";
import { CariService } from "../../services/cariService";
import { ALIS_SATIS_MODULLERI, HizliSatisModul, ISKONTO_MODULLERI, MODUL_ADI, MODUL_URUN_TURLERI, URUN_TURU, aliciEksikleri, faturaSiniriAsildiMi, modulGecerliMi } from "../../../Backend/src/services/hizliSatis/hizliSatisKural";
import { IskontoModal } from "./IskontoModal";
import { MasakService } from "../../services/masakService";
import { AliciModal, AliciZorunlulugu } from "./AliciModal";
import { SonFislerModal } from "./SonFislerModal";
import {
  IndirimGirdisi,
  MODUL_ODEMELERI,
  ODEME_ADI,
  OdemeTuru,
  SepetOdemesi,
  SepetSatiri,
  adetliMi,
  kayitOdemeleri,
  masakGerekli,
  odemeDurumu,
  urunKuru,
  sepetHesapla,
  yuvarla2,
} from "../../../Backend/src/services/hizliSatis/hizliSatisHesap";
import { HizliSatisKutusu } from "./HizliSatisKutusu";
import { TusKomutu, TusTakimi, girisSayi } from "./TusTakimi";
import { SayiSorModal, SayiSorusu, SecimModal, SecimSorusu, SerbestUrunModal } from "./HizliSatisModallari";
import { ModulVerisi, SatirTaslagi, barkoddanSatir, butondanSatir, gayriResmiMi, modulVerisiYukle, satirAnahtari, satiriYenidenFiyatla, varsayilanIstatistik } from "./modulVerisi";
import { KAYDEDICILER } from "./kaydet";
import { ANONIM_MUSTERI, HizliMusteri } from "./kaydet/tipler";

/**
 * Hızlı Satış ekranı (docs/HIZLI_SATIS_YOL_HARITASI.md, H1–H20). Solda sepet, ortada tuş takımı + ödeme, sağda sekmeli ürün
 * kutuları. Her modül kendi fişini kendi kayıt ucuyla yazar (kaydet/). Üst çubuk ve sol menü yerinde kalır (H4).
 */

const para = (n: number) => n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const miktarYaz = (n: number) => n.toLocaleString("tr-TR", { maximumFractionDigits: 4 });

const ODEME_IKON: Record<OdemeTuru, React.ReactNode> = {
  0: <IconCash size={22} />,
  1: <IconUserDollar size={22} />,
  2: <IconCreditCard size={22} />,
  3: <IconBuildingBank size={22} />,
};
const ODEME_RENK: Record<OdemeTuru, string> = { 0: "success", 1: "warning", 2: "primary", 3: "info" };

export const HizliSatisPage: React.FC = () => {
  const { modul: modulParam } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showError: hataGoster, showSuccess, showWarning } = useToast();
  const showError = (m: string) => hataGoster(m, 4000);
  const pos = usePosTahsilat();
  const acikModuller = useMemo(() => acikHizliSatisModulleri(user?.merkez?.moduller), [user?.merkez?.moduller]);
  const modul: HizliSatisModul | null = modulGecerliMi(modulParam) ? modulParam : null;

  const [yetki, setYetki] = useState<HizliSatisYetki>({ fiyatYetkisi: false, sistemYoneticisi: false, faturaSiniri: 12000 });
  const [veri, setVeri] = useState<ModulVerisi | null>(null);
  const [duzen, setDuzen] = useState<HizliSatisSekme[]>([]);
  const [aktifSekme, setAktifSekme] = useState<number | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState<string | null>(null);

  const [tip, setTip] = useState<0 | 1>(1);
  const [sepet, setSepet] = useState<SepetSatiri[]>([]);
  const [secili, setSecili] = useState<string | null>(null);
  const [giris, setGiris] = useState("");
  const [indirim, setIndirim] = useState<IndirimGirdisi | null>(null);
  const [odemeler, setOdemeler] = useState<SepetOdemesi[]>([]);
  const [musteri, setMusteri] = useState<HizliMusteri>(ANONIM_MUSTERI);
  const [barkod, setBarkod] = useState("");
  const [kaydediliyor, setKaydediliyor] = useState(false);
  const [sonFis, setSonFis] = useState<{ no: string; toplam: number; paraUstu: number } | null>(null);

  const [sayiSorusu, setSayiSorusu] = useState<SayiSorusu | null>(null);
  const [serbestAcik, setSerbestAcik] = useState(false);
  const [secimSorusu, setSecimSorusu] = useState<SecimSorusu<any> | null>(null);
  const [posCihazlari, setPosCihazlari] = useState<PosCihaziItem[] | null>(null);
  const [bankalar, setBankalar] = useState<BankaHesapItem[] | null>(null);
  const barkodRef = useRef<HTMLInputElement>(null);
  const [sonFislerAcik, setSonFislerAcik] = useState(false);
  const [iskontoAcik, setIskontoAcik] = useState(false);
  /** Alıcı penceresi: zorunlu ise (fatura sınırı / MASAK) onaydan sonra satış kaldığı yerden sürer */
  const [aliciSorusu, setAliciSorusu] = useState<{ zorunlu: AliciZorunlulugu | null; kayitliGerekli?: boolean; sonra?: (m: HizliMusteri) => void } | null>(null);

  const istatistik = useMemo(
    () => (veri ? varsayilanIstatistik(veri.istatistikler, veri.tanim, tip, tip === 1 ? (user as any)?.sellStatCode : (user as any)?.buyStatCode) : null),
    [veri, tip, user]
  );

  // ───── Açılış ─────
  useEffect(() => {
    if (modul && acikModuller.includes(modul)) sonModulYaz(modul);
  }, [modul, acikModuller]);

  const yukle = useCallback(async () => {
    if (!modul) return;
    setYukleniyor(true);
    setHata(null);
    try {
      const [y, d, v] = await Promise.all([
        HizliSatisService.yetki(),
        HizliSatisService.duzen(modul),
        modulVerisiYukle(modul, { id: Number(user?.id) || undefined, cashierCode: (user as any)?.cashierCode }),
      ]);
      setYetki(y);
      setDuzen(d);
      setAktifSekme(d[0]?.sekmeId ?? null);
      setVeri(v);
    } catch (e: any) {
      setHata(e?.message || "Hızlı satış verileri alınamadı.");
    } finally {
      setYukleniyor(false);
    }
  }, [modul, user]);

  useEffect(() => {
    setSepet([]);
    setOdemeler([]);
    setIndirim(null);
    setMusteri(ANONIM_MUSTERI);
    setTip(1);
    setGiris("");
    setSecili(null);
    setSonFis(null);
    void yukle();
  }, [yukle]);

  const toplam = useMemo(
    () => (modul ? sepetHesapla(modul, sepet, { tip, indirim, kmvSekli: veri?.kmvSekli }) : sepetHesapla("perakende", [])),
    [modul, sepet, tip, indirim, veri?.kmvSekli]
  );
  const durum = useMemo(() => odemeDurumu(toplam.genelToplam, odemeler), [toplam.genelToplam, odemeler]);

  // Alış/Satış değişince fiyatlar yeniden (elle verilen korunur)
  const tipDegistir = (t: 0 | 1) => {
    if (t === tip || !veri) return;
    const ist = varsayilanIstatistik(veri.istatistikler, veri.tanim, t, t === 1 ? (user as any)?.sellStatCode : (user as any)?.buyStatCode);
    if (t === 0 && sepet.some((x) => x.tur === "serbest")) return showError("Sepette serbest ürün var; alışta serbest ürün olmaz. Önce o satırı silin.");
    setTip(t);
    setSepet((s) => s.map((x) => satiriYenidenFiyatla(x, veri, t, ist)));
    setOdemeler([]);
    // İskonto yalnız satışta
    if (t === 0) setIndirim(null);
  };

  // ───── Sepete ekleme ─────
  const sepeteEkle = (s: SepetSatiri) => {
    setSepet((onceki) => {
      // Aynı adetli ürün (fiyatı elle değişmemiş) tekrar gelirse miktar artar
      const ayni = onceki.find((x) => x.tur === s.tur && x.urunId && x.urunId === s.urunId && x.birimFiyat === s.birimFiyat && !x.fiyatElle && s.tur !== "barkod" && (s.tur === "stok" || adetliMi(s.urunTipi)));
      if (ayni) {
        setSecili(ayni.anahtar);
        return onceki.map((x) => (x === ayni ? { ...x, miktar: Math.round((x.miktar + s.miktar) * 10000) / 10000 } : x));
      }
      if (s.tur === "barkod" && onceki.some((x) => x.tur === "barkod" && x.ek?.barkod && x.ek.barkod === s.ek?.barkod)) {
        showError(`"${s.ek?.barkod}" barkodlu ürün sepette zaten var.`);
        return onceki;
      }
      setSecili(s.anahtar);
      return [...onceki, s];
    });
    setOdemeler([]);
    setSonFis(null);
  };

  const taslakIsle = (t: SatirTaslagi | string, girisMiktar: number | null) => {
    if (typeof t === "string") {
      showError(t);
      return;
    }
    const s = { ...t.satir };
    if (girisMiktar && girisMiktar > 0) s.miktar = girisMiktar;
    const fiyatSor = (sonra: (x: SepetSatiri) => void) => {
      if (!t.fiyatGerekli) return sonra(s);
      setSayiSorusu({
        baslik: modul === "sarraf" || modul === "doviz" ? `${s.ad} — kur` : `${s.ad} — fiyat`,
        aciklama: s.tur === "serbest" ? "Serbest ürünün fiyatını yazın (KDV dahil)." : "Bu ürünün güncel kuru/fiyatı bulunamadı. Birim fiyatı yazın.",
        birim: "TL",
        onay: (n) => sonra({ ...s, birimFiyat: n, fiyatElle: s.tur !== "serbest" }),
      });
    };
    if (t.gramGerekli && !(girisMiktar && girisMiktar > 0)) {
      setSayiSorusu({
        baslik: `${s.ad} — gram`,
        aciklama: "Satılacak gramı yazın.",
        birim: "gr",
        onay: (n) => {
          s.miktar = n;
          fiyatSor(sepeteEkle);
        },
      });
      return;
    }
    fiyatSor(sepeteEkle);
  };

  const butonaBas = (b: HizliSatisSekme["butonlar"][number]) => {
    if (!veri || kaydediliyor) return;
    if (tip === 0 && b.urunTuru === URUN_TURU.SERBEST) return showError("Alışta serbest ürün olmaz.");
    const n = girisSayi(giris);
    setGiris("");
    taslakIsle(butondanSatir(b, veri, tip, istatistik), n);
  };

  const barkodOkut = async () => {
    if (!veri || !barkod.trim()) return;
    const g = barkod;
    setBarkod("");
    taslakIsle(await barkoddanSatir(g, veri, tip, istatistik), null);
    barkodRef.current?.focus();
  };

  // ───── Tuş takımı komutları ─────
  const seciliSatir = sepet.find((s) => s.anahtar === secili) || null;
  const satirGuncelle = (anahtar: string, alan: Partial<SepetSatiri>) => {
    setSepet((s) => s.map((x) => (x.anahtar === anahtar ? { ...x, ...alan } : x)));
    setOdemeler([]);
  };

  const komut = (k: TusKomutu) => {
    const n = girisSayi(giris);
    if (k === "serbest") {
      setSerbestAcik(true);
      return;
    }
    if (k === "indirim") {
      // İskonto (14.10.2026): tanımlı iskontolar herkese, elle yüzde / tutar yetkiliye; yalnız satışta
      if (tip === 0) return showError("Alışta iskonto uygulanmaz.");
      if (!sepet.length) return showError("Sepet boş.");
      setIskontoAcik(true);
      return;
    }
    if (!seciliSatir) {
      if (k === "enter" && barkod.trim()) void barkodOkut();
      else if (k !== "enter") showError("Önce sepetten bir satır seçin.");
      return;
    }
    if (k === "satirSil") {
      setSepet((s) => s.filter((x) => x.anahtar !== seciliSatir.anahtar));
      setSecili(null);
      setOdemeler([]);
      return;
    }
    if (k === "miktar" || k === "enter") {
      if (n === null) {
        if (k === "miktar") setSayiSorusu({ baslik: `${seciliSatir.ad} — miktar`, birim: seciliSatir.birim, ilk: seciliSatir.miktar, onay: (d) => satirGuncelle(seciliSatir.anahtar, { miktar: d }) });
        return;
      }
      if (!(n > 0)) return showError("Miktar sıfırdan büyük olmalı.");
      if (seciliSatir.tur === "barkod" && n !== 1) return showError("Barkodlu ürün tek parçadır; miktarı değişmez.");
      satirGuncelle(seciliSatir.anahtar, { miktar: n });
      setGiris("");
      return;
    }
    if (k === "fiyat") {
      if (!yetki.fiyatYetkisi) return showError("Hızlı Satış – Fiyat/İndirim yetkiniz yok.");
      const uygula = (d: number) => satirGuncelle(seciliSatir.anahtar, { birimFiyat: d, fiyatElle: true });
      if (n !== null && n > 0) {
        uygula(n);
        setGiris("");
      } else setSayiSorusu({ baslik: `${seciliSatir.ad} — ${modul === "sarraf" || modul === "doviz" ? "kur" : "birim fiyat"}`, birim: "TL", ilk: seciliSatir.birimFiyat, onay: uygula });
    }
  };

  // ───── Ödeme ─────
  const odemeEkle = async (tur: OdemeTuru) => {
    if (!sepet.length) return showError("Sepet boş.");
    if (toplam.genelToplam <= 0) return showError("Fiş toplamı sıfır.");
    const n = girisSayi(giris);
    const tutar = n !== null && n > 0 ? n : durum.kalan;
    if (!(tutar > 0)) return showError("Ödenecek tutar kalmadı. Satışı tamamlayın.");
    if (tur !== 0 && tutar - durum.kalan > 0.01) return showError("Nakit dışı ödeme kalan tutarı aşamaz; para üstü yalnız nakitten verilir.");
    // m: ödeme sırasında seçilen müşteri (state henüz güncellenmemiş olabilir)
    const ekle = (o: Partial<SepetOdemesi>, m: HizliMusteri = musteri) => {
      const yeni = [...odemeler, { anahtar: satirAnahtari(), tur, tutar: Math.round(tutar * 100) / 100, ...o }];
      setOdemeler(yeni);
      setGiris("");
      if (odemeDurumu(toplam.genelToplam, yeni).kalan <= 0.01) void tamamla(yeni, m);
    };
    if (tur === 1) {
      if (musteri.tur !== "kayitli" || !musteri.cariKartId) {
        setAliciSorusu({ zorunlu: null, kayitliGerekli: true, sonra: (m) => { setMusteri(m); if (m.tur === "kayitli" && m.cariKartId) ekle({}, m); } });
        return;
      }
      return ekle({});
    }
    if (tur === 2) {
      const liste = posCihazlari ?? (await PosCihaziService.getPosCihazlari().catch(() => [] as PosCihaziItem[])).filter((p) => p.aktif !== false);
      setPosCihazlari(liste);
      if (!liste.length) return showError("Tanımlı POS cihazı yok (Banka › POS Cihazları).");
      const sec = (p: PosCihaziItem) => ekle({ posCihaziId: p.posCihaziId, posAdi: p.ad, posKod: p.kod });
      if (liste.length === 1) return sec(liste[0]);
      return setSecimSorusu({ baslik: "POS cihazı seçin", secenekler: liste.map((p) => ({ anahtar: String(p.posCihaziId), ad: p.ad, alt: p.kod, deger: p })), onay: sec });
    }
    if (tur === 3 && modul === "doviz") {
      // Döviz fişinde banka hesabı başlıkta tek alandır (BANKA_HESABI_ID = bankanın cari kartı): tutarın tamamı (U7)
      if (odemeler.length || Math.abs(tutar - toplam.genelToplam) > 0.01) return showError("Döviz fişinde banka hesabı tutarın tamamı için seçilir; önce diğer ödemeleri kaldırın.");
      const lk: any = await CariService.getLookups().catch(() => null);
      const liste: any[] = lk?.bankaList || [];
      if (!liste.length) return showError("Banka hesabı olan cari kart yok.");
      const sec = (b: any) => ekle({ bankaId: Number(b.id), bankaHesapNo: b.iban || b.hesapNo || b.kod || null, bankaAdi: b.ad || b.unvan || null });
      if (liste.length === 1) return sec(liste[0]);
      return setSecimSorusu({ baslik: "Banka hesabı seçin", secenekler: liste.map((b) => ({ anahtar: String(b.id), ad: b.ad || b.unvan, alt: [b.bankaAdi, b.iban || b.hesapNo].filter(Boolean).join(" · "), deger: b })), onay: sec });
    }
    if (tur === 3) {
      const liste = bankalar ?? (await BankaService.getBankalar({ aktif: true }).catch(() => [] as BankaHesapItem[]));
      setBankalar(liste);
      if (!liste.length) return showError("Tanımlı banka hesabı yok.");
      const sec = (b: BankaHesapItem) => ekle({ bankaId: b.bankaId, bankaHesapNo: b.hesapNo, bankaAdi: b.hesapAdi });
      if (liste.length === 1) return sec(liste[0]);
      return setSecimSorusu({ baslik: "Banka hesabı seçin", secenekler: liste.map((b) => ({ anahtar: String(b.bankaId), ad: b.hesapAdi, alt: [b.bankaAdi, b.hesapNo].filter(Boolean).join(" · "), deger: b })), onay: sec });
    }
    ekle({});
  };

  // ───── Kaydet ─────
  const temizle = () => {
    setSepet([]);
    setOdemeler([]);
    setIndirim(null);
    setMusteri(ANONIM_MUSTERI);
    setSecili(null);
    setGiris("");
  };

  const tamamla = async (odemeListesi: SepetOdemesi[] = odemeler, m: HizliMusteri = musteri) => {
    if (!modul || !veri || kaydediliyor) return;
    if (!sepet.length) return showError("Sepet boş.");
    if (sepet.some((s) => !(s.miktar > 0))) return showError("Miktarı sıfır olan satır var.");
    if (sepet.some((s) => !(s.birimFiyat > 0))) return showError("Fiyatı sıfır olan satır var.");
    const d = odemeDurumu(toplam.genelToplam, odemeListesi);
    if (d.fazlaOdeme) return showError("Nakit dışı ödemeler fiş toplamını aşıyor.");
    if (odemeListesi.length && d.kalan > 0.01) return showError(`Kalan ${para(d.kalan)} TL ödenmedi.`);

    // 12.000 TL fatura sınırı (H12) ve MASAK (H14): alıcı bilgisi eksikse pencere açılır, onaydan sonra kaldığı yerden
    const faturaSiniri = faturaSiniriAsildiMi(modul, toplam.genelToplam, yetki.faturaSiniri, tip);
    const masak = masakGerekli(modul, sepet, toplam, {
      hasKuru: urunKuru(veri.kurlar, { kod: "HAS", urunTipi: 1 }, tip),
      usdKuru: urunKuru(veri.kurlar, { kod: "USD", urunTipi: 0 }, tip),
      gayriResmi: gayriResmiMi(istatistik),
    });
    if (faturaSiniri || masak) {
      const eksik = aliciEksikleri(m).filter((e) => faturaSiniri || (e !== "İl" && e !== "İlçe"));
      if (eksik.length) {
        const sinirYazi = para(yetki.faturaSiniri);
        setAliciSorusu({
          zorunlu: {
            baslik: faturaSiniri ? `${sinirYazi} TL ve üzeri satış — fatura için alıcı bilgisi` : "MASAK sınırı aşıldı — müşteri kimlik bilgisi",
            ilIlce: faturaSiniri,
          },
          sonra: (yeni) => { setMusteri(yeni); void tamamla(odemeListesi, yeni); },
        });
        return;
      }
    }
    if (masak) {
      try {
        const r = await MasakService.sorgula({ ad: m.unvan, kimlikNo: m.vknTckn, limit: 15 });
        if (r?.eslesmeVar) return showError(`"${m.unvan}" MASAK malvarlığı dondurulanlar listesiyle eşleşiyor; satış yapılamaz.`);
      } catch {
        /* sorgu yapılamadıysa fiş ekranları gibi devam edilir */
      }
    }
    setKaydediliyor(true);
    try {
      const sonuc = await KAYDEDICILER[modul]({
        modul,
        tip,
        sepet,
        toplam,
        indirim,
        odemeler: kayitOdemeleri(toplam.genelToplam, odemeListesi),
        musteri: m,
        veri,
        istatistik,
        kullanici: { id: Number(user?.id) || 0, ad: (user as any)?.fullName || (user as any)?.username || "", nesne: user },
        pos,
      });
      await HizliSatisService.isaretle(modul, sonuc.fisId).catch(() => undefined);
      setSonFis({ no: sonuc.fisNo, toplam: toplam.genelToplam, paraUstu: d.paraUstu });
      for (const u of sonuc.uyarilar) showWarning(u, 8000);
      showSuccess(`Fiş ${sonuc.fisNo} kaydedildi.`);
      temizle();
    } catch (e: any) {
      showError(e?.message || "Satış kaydedilemedi.");
    } finally {
      setKaydediliyor(false);
    }
  };

  // ───── Çizim ─────
  if (!modul) return <Alert variant="warning" className="m-3">Geçersiz hızlı satış modülü.</Alert>;
  const sekme = duzen.find((s) => s.sekmeId === aktifSekme) || null;
  // Alışta (Sarraf/Döviz) müşteriye ödeme yapılır: POS yok
  const odemeTurleri = MODUL_ODEMELERI[modul].filter((t) => !(tip === 0 && t === 2));
  const alisSatis = ALIS_SATIS_MODULLERI.includes(modul);
  /** Fiyat sütunu kur mu (Sarraf/Döviz) */
  const kurlu = modul === "sarraf" || modul === "doviz";
  const indirimVar = ISKONTO_MODULLERI.includes(modul) && tip === 1;
  const serbestVar = MODUL_URUN_TURLERI[modul].includes(URUN_TURU.SERBEST) && tip === 1;
  const tutarBirimi = "TL";

  return (
    <div className="hizli-satis d-flex flex-column p-2 gap-2" style={{ height: "calc(100vh - 92px)", minHeight: 560 }}>
      {pos.pencere}
      {/* Üst şerit: modül sekmeleri, Alış/Satış, müşteri, düzen */}
      <div className="d-flex align-items-center gap-2 flex-wrap">
        <Nav variant="pills" className="p-1 bg-light rounded-3 gap-1" activeKey={modul} onSelect={(k) => k && k !== modul && (!sepet.length || window.confirm("Sepet boşaltılsın mı?")) && navigate(hizliSatisYolu(k as HizliSatisModul))}>
          {acikModuller.map((m) => (
            <Nav.Item key={m}><Nav.Link eventKey={m} className="py-1 px-3 fw-semibold">{MODUL_ADI[m]}</Nav.Link></Nav.Item>
          ))}
        </Nav>
        {alisSatis && (
          <ButtonGroup>
            <Button variant={tip === 1 ? "danger" : "outline-danger"} className="fw-bold px-3" onClick={() => tipDegistir(1)}>SATIŞ</Button>
            <Button variant={tip === 0 ? "success" : "outline-success"} className="fw-bold px-3" onClick={() => tipDegistir(0)}>ALIŞ</Button>
          </ButtonGroup>
        )}
        <Button variant={musteri.tur === "anonim" ? "outline-secondary" : "outline-primary"} className="d-flex align-items-center gap-1" disabled={kaydediliyor}
          onClick={() => setAliciSorusu({ zorunlu: null, sonra: (m) => { setMusteri(m); if (m.tur !== "kayitli") setOdemeler((o) => o.filter((x) => x.tur !== 1)); } })}>
          <IconUser size={16} />{musteri.tur === "anonim" ? "Müşteri: Nihai tüketici" : musteri.unvan}
        </Button>
        {veri?.vezne && <Badge bg="light" text="dark" className="border">Vezne: {veri.vezne.ad}</Badge>}
        <div className="ms-auto d-flex gap-1">
          <Button variant="outline-secondary" size="sm" title="Hızlı satış fişleri (düzeltme / iade için)" onClick={() => setSonFislerAcik(true)}><IconListDetails size={16} className="me-1" />Fişler</Button>
          <Button variant="outline-secondary" size="sm" title="Kurları ve düzeni yenile" onClick={() => void yukle()}><IconRefresh size={16} /></Button>
          {yetki.sistemYoneticisi && <Link to="/ayarlar/hizli-satis-duzeni" className="btn btn-sm btn-outline-secondary" title="Hızlı Satış Düzeni"><IconLayoutGrid size={16} /></Link>}
        </div>
      </div>

      {hata && <Alert variant="danger" className="py-2 mb-0">{hata}</Alert>}
      {yukleniyor ? (
        <div className="text-center py-5"><Spinner size="sm" className="me-2" />Yükleniyor...</div>
      ) : (
        <div className="d-flex gap-2 flex-grow-1" style={{ minHeight: 0 }}>
          {/* ───── Sepet ───── */}
          <div className="card border shadow-xs d-flex flex-column" style={{ flex: "1 1 36%", minWidth: 300, minHeight: 0 }}>
            <div className="p-2 border-bottom d-flex justify-content-between align-items-end" style={{ background: tip === 0 ? "var(--bs-success-bg-subtle)" : "var(--bs-primary-bg-subtle)" }}>
              <div className="small">
                <div className="fw-semibold">{MODUL_ADI[modul]} {alisSatis ? (tip === 1 ? "Satış" : "Alış") : "Satış"}</div>
                <div className="text-muted">{sepet.length} kalem{toplam.hasToplam > 0 ? ` · ${miktarYaz(toplam.hasToplam)} has gr` : ""}</div>
              </div>
              <div className="text-end fw-bold" style={{ fontSize: 34, lineHeight: 1, fontVariantNumeric: "tabular-nums" }} aria-label="Genel toplam">
                {para(toplam.genelToplam)} <span style={{ fontSize: 18 }}>{tutarBirimi}</span>
              </div>
            </div>
            <InputGroup size="sm" className="p-2 pb-1">
              <InputGroup.Text><IconBarcode size={16} /></InputGroup.Text>
              <Form.Control ref={barkodRef} placeholder={modul === "perakende" ? "Barkod ya da ürün kodu (3*kod)" : modul === "ticari" ? "Barkod ya da stok kodu (3*barkod)" : "Ürün kodu"}
                value={barkod} onChange={(e) => setBarkod(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void barkodOkut(); } }} />
            </InputGroup>
            <div className="flex-grow-1 overflow-auto px-2" style={{ minHeight: 0 }}>
              <table className="table table-sm table-hover align-middle mb-0" style={{ fontSize: 14 }}>
                <thead className="table-light sticky-top">
                  <tr className="small text-secondary"><th>Ürün</th><th className="text-end">Miktar</th><th className="text-end">{kurlu ? "Kur" : "Fiyat"}</th><th className="text-end">Tutar</th></tr>
                </thead>
                <tbody>
                  {sepet.map((s, i) => (
                    <tr key={s.anahtar} onClick={() => setSecili(s.anahtar)} className={s.anahtar === secili ? "table-primary" : ""} style={{ cursor: "pointer", height: 40 }}>
                      <td className="fw-semibold">
                        {s.ad}
                        {s.fiyatElle && <Badge bg="warning" text="dark" className="ms-1" title="Fiyat elle değiştirildi">E</Badge>}
                        {s.kdvOrani > 0 && !kurlu && <span className="text-muted small ms-1">%{s.kdvOrani}</span>}
                      </td>
                      <td className="text-end text-nowrap">{miktarYaz(s.miktar)} <span className="text-muted small">{s.birim}</span></td>
                      <td className="text-end text-nowrap">{para(s.birimFiyat)}</td>
                      <td className="text-end text-nowrap fw-semibold">{para(toplam.satirTutarlari[i] ?? 0)}</td>
                    </tr>
                  ))}
                  {!sepet.length && (
                    <tr><td colSpan={4} className="text-center text-muted py-4">
                      {sonFis ? (
                        <div>
                          <div className="text-success fw-bold mb-1"><IconCheck size={18} /> Fiş {sonFis.no} kaydedildi — {para(sonFis.toplam)} TL</div>
                          {sonFis.paraUstu > 0 && <div className="fs-4 fw-bold text-dark">Para üstü: {para(sonFis.paraUstu)} TL</div>}
                        </div>
                      ) : "Sepet boş. Sağdan ürüne dokunun ya da barkod okutun."}
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="border-top p-2 small">
              {(modul === "perakende" || modul === "ticari") && (toplam.kdv > 0 || toplam.indirim > 0) && (
                <div className="d-flex justify-content-between"><span className="text-muted">Ara toplam / KDV</span><span>{para(toplam.araToplam)} / {para(toplam.kdv)}</span></div>
              )}
              {modul === "sarraf" && toplam.indirim > 0 && (
                <div className="d-flex justify-content-between"><span className="text-muted">Fiş tutarı</span><span>{para(toplam.araToplam)}</span></div>
              )}
              {toplam.indirim > 0 && (
                <div className="d-flex justify-content-between text-danger">
                  <span>İskonto {indirim?.ad ? `(${indirim.ad})` : indirim?.turu === 1 ? `%${indirim.deger}` : ""} <button type="button" className="btn btn-link btn-sm p-0 text-danger" title="İskontoyu kaldır" onClick={() => { setIndirim(null); setOdemeler([]); }}><IconX size={14} /></button></span>
                  <span>-{para(toplam.indirim)}</span>
                </div>
              )}
              {toplam.masraf > 0 && <div className="d-flex justify-content-between"><span className="text-muted">Masraf (BSMV/KMV/komisyon)</span><span>{para(toplam.masraf)}</span></div>}
              {odemeler.map((o) => (
                <div key={o.anahtar} className="d-flex justify-content-between">
                  <span>{ODEME_ADI[o.tur]}{o.posAdi ? ` (${o.posAdi})` : o.bankaAdi ? ` (${o.bankaAdi})` : ""}
                    <button type="button" className="btn btn-link btn-sm p-0 ms-1 text-danger" title="Ödemeyi kaldır" onClick={() => setOdemeler((x) => x.filter((y) => y.anahtar !== o.anahtar))}><IconX size={14} /></button>
                  </span>
                  <span>{para(o.tutar)}</span>
                </div>
              ))}
              {odemeler.length > 0 && (
                <div className="d-flex justify-content-between fw-bold border-top mt-1 pt-1">
                  <span>{durum.paraUstu > 0 ? "Para üstü" : "Kalan"}</span><span>{para(durum.paraUstu > 0 ? durum.paraUstu : durum.kalan)}</span>
                </div>
              )}
            </div>
          </div>

          {/* ───── Tuş takımı + ödeme ───── */}
          <div className="card border shadow-xs p-2 d-flex flex-column gap-2" style={{ flex: "0 0 300px", minHeight: 0, overflowY: "auto" }}>
            <div className="d-grid gap-1" style={{ gridTemplateColumns: "repeat(2, 1fr)" }}>
              {(odemeTurleri as OdemeTuru[]).map((t) => (
                <Button key={t} variant={ODEME_RENK[t]} className="d-flex flex-column align-items-center justify-content-center fw-bold" style={{ height: 64, touchAction: "manipulation" }}
                  disabled={kaydediliyor || !sepet.length} onClick={() => void odemeEkle(t)}>
                  {ODEME_IKON[t]}<span style={{ fontSize: 14 }}>{ODEME_ADI[t]}</span>
                </Button>
              ))}
            </div>
            <TusTakimi giris={giris} setGiris={setGiris} onKomut={komut} fiyatYetkisi={yetki.fiyatYetkisi} indirimVar={indirimVar} serbestVar={serbestVar} disabled={kaydediliyor} />
            <div className="d-flex gap-1 mt-auto">
              <Button variant="outline-danger" className="flex-grow-0" style={{ height: 52 }} disabled={kaydediliyor || (!sepet.length && !odemeler.length)} title="Sepeti boşalt"
                onClick={() => { if (window.confirm("Sepet boşaltılsın mı?")) temizle(); }}><IconTrash size={18} /></Button>
              <Button variant="dark" className="flex-grow-1 fw-bold" style={{ height: 52, fontSize: 17 }} disabled={kaydediliyor || !sepet.length} onClick={() => void tamamla()}>
                {kaydediliyor ? <Spinner size="sm" className="me-2" /> : <IconCheck size={20} className="me-1" />}
                {odemeler.length ? "Satışı Tamamla" : "Nakit Tamamla"}
              </Button>
            </div>
          </div>

          {/* ───── Ürün kutuları ───── */}
          <div className="card border shadow-xs d-flex flex-column" style={{ flex: "1 1 40%", minWidth: 280, minHeight: 0 }}>
            <Nav variant="pills" className="p-1 border-bottom gap-1 flex-nowrap overflow-auto" activeKey={aktifSekme ?? undefined} onSelect={(k) => setAktifSekme(Number(k))}>
              {duzen.map((s) => (
                <Nav.Item key={s.sekmeId}><Nav.Link eventKey={s.sekmeId} className="text-nowrap fw-semibold py-2">{s.ad}</Nav.Link></Nav.Item>
              ))}
            </Nav>
            <div className="flex-grow-1 overflow-auto p-2" style={{ minHeight: 0 }}>
              {!duzen.length && (
                <div className="text-center text-muted py-5">
                  Bu modülde henüz hızlı satış butonu yok.
                  {yetki.sistemYoneticisi ? <div><Link to="/ayarlar/hizli-satis-duzeni">Hızlı Satış Düzeni</Link>'nden ekleyin.</div> : <div>Sistem yöneticisi Hızlı Satış Düzeni'nden ekleyebilir.</div>}
                </div>
              )}
              <div className="d-grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(118px, 1fr))" }}>
                {sekme?.butonlar.filter((b) => !b.gecersiz && !(tip === 0 && b.urunTuru === URUN_TURU.SERBEST)).map((b) => {
                  const t = veri ? butondanSatir(b, veri, tip, istatistik) : null;
                  const fiyatYazi = !t || typeof t === "string" || !(t.satir.birimFiyat > 0) ? null : `${para(t.satir.birimFiyat)}${t.gramGerekli ? "/gr" : ""}`;
                  return <HizliSatisKutusu key={b.butonId} ad={b.ad} kod={b.urunKodu} renk={b.renk} resim={b.resim} altYazi={fiyatYazi} pasif={kaydediliyor} onClick={() => butonaBas(b)} />;
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      <SayiSorModal soru={sayiSorusu} kapat={() => setSayiSorusu(null)} />
      <SerbestUrunModal acik={serbestAcik} kapat={() => setSerbestAcik(false)}
        onay={(ad, fiyat, kdv) => sepeteEkle({ anahtar: satirAnahtari(), ad, tur: "serbest", miktar: girisSayi(giris) || 1, birim: "Adet", birimFiyat: fiyat, kdvOrani: kdv })} />
      <SecimModal soru={secimSorusu} kapat={() => setSecimSorusu(null)} />
      <SonFislerModal modul={modul} acik={sonFislerAcik} kapat={() => setSonFislerAcik(false)} />
      <IskontoModal acik={iskontoAcik} brut={yuvarla2(toplam.genelToplam + toplam.indirim)} hasKuru={veri ? urunKuru(veri.kurlar, { kod: "HAS", urunTipi: 1 }, 1) : 0}
        fiyatYetkisi={yetki.fiyatYetkisi} elleVar mevcut={indirim} kapat={() => setIskontoAcik(false)}
        onay={(i) => { setIndirim(i); setOdemeler([]); setIskontoAcik(false); }} />
      <AliciModal acik={!!aliciSorusu} musteri={musteri} zorunlu={aliciSorusu?.zorunlu ?? null} kayitliGerekli={aliciSorusu?.kayitliGerekli}
        kapat={() => setAliciSorusu(null)} onay={(m) => { const f = aliciSorusu?.sonra; setAliciSorusu(null); if (f) f(m); else setMusteri(m); }} />
    </div>
  );
};

export default HizliSatisPage;
