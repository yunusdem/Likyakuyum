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
  IconPencil,
  IconSearch,
  IconCoins,
  IconClockPause,
  IconClockPlay,
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
import { useSayfaErisimi } from "../../hooks/useSayfaErisimi";
import { useKullaniciYetkisi } from "../../hooks/useKullaniciYetkisi";
import { kurDegistirilebilir, kurDenetle } from "../../../Backend/src/services/yetki/kullaniciYetkiKural";
import { HizliSatisService, HizliSatisSekme, HizliSatisYetki } from "../../services/hizliSatisService";
import { StokKart, TicariService } from "../../services/ticariService";
import { PosCihaziItem, PosCihaziService } from "../../services/posCihaziService";
import { BankaHesapItem, BankaService } from "../../services/bankaService";
import { CariService } from "../../services/cariService";
import { ALIS_SATIS_MODULLERI, HizliSatisModul, ISKONTO_MODULLERI, MODUL_ADI, MODUL_URUN_TURLERI, URUN_TURU, aliciEksikleri, faturaSiniriAsildiMi, modulGecerliMi } from "../../../Backend/src/services/hizliSatis/hizliSatisKural";
import { IskontoModal } from "./IskontoModal";
import { MasakService } from "../../services/masakService";
import { AliciModal, AliciZorunlulugu } from "./AliciModal";
import { SonFislerModal } from "./SonFislerModal";
import { BekletModal, BekleyenlerModal } from "./BekleyenModallari";
import { geriCagir, icerikHazirla } from "./bekleyenSepet";
import { CikisUyarisiModal, useCikisUyarisi } from "./cikisUyarisi";
import { BekleyenSepet } from "../../services/hizliSatisService";
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
import { SatirDuzenleModal, SayiSorModal, SayiSorusu, SecimModal, SecimSorusu, SerbestUrunModal } from "./HizliSatisModallari";
import { UrunAramaModal } from "./UrunAramaModal";
import { OdemeSecenegi, ParcaliTahsilatModal } from "./ParcaliTahsilatModal";
import { StokKartModal } from "../ticari/StokKartModal";
import { TicariService as TicariYetkiService } from "../../services/ticariService";
import { ModulVerisi, SatirTaslagi, barkodCoz, barkoddanSatir, butondanSatir, gayriResmiMi, kampanyaIsle, karttanSatir, kurlariGetir, modulVerisiYukle, satirAnahtari, satiriYenidenFiyatla, varsayilanIstatistik } from "./modulVerisi";
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
  const kullaniciYetkisi = useKullaniciYetkisi();
  const acikModuller = useMemo(() => acikHizliSatisModulleri(user?.merkez?.moduller, kullaniciYetkisi), [user?.merkez?.moduller, kullaniciYetkisi]);
  // Düzen kısayolu yalnız düzen sayfası açıksa (kapalı sayfaya götürmesin)
  const duzenAcik = useSayfaErisimi()("/ayarlar/hizli-satis-duzeni");
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
  /** Barkod kutusuna odak (G21): açılışta, fiş kesilince, pencereler kapanınca, butona basınca — okuyucu hep hazır */
  const odakla = useCallback(() => {
    setTimeout(() => {
      if (document.querySelector(".modal")) return; // açık pencere (fiyat / gram sorusu, kart, seçim) odağı korur
      barkodRef.current?.focus();
    }, 80);
  }, []);
  const [sonFislerAcik, setSonFislerAcik] = useState(false);
  // Bekleyen sepetler (H25–H28)
  const [bekletAcik, setBekletAcik] = useState(false);
  const [bekleyenlerAcik, setBekleyenlerAcik] = useState(false);
  const [bekleyenSayisi, setBekleyenSayisi] = useState(0);
  const [bekletiliyor, setBekletiliyor] = useState(false);
  const [iskontoAcik, setIskontoAcik] = useState(false);
  /** Çift tık / kalem ikonuyla düzenlenen satır (İş 5, G19) */
  const [duzenlenen, setDuzenlenen] = useState<string | null>(null);
  /** "Ara" penceresi (İş 6, G18) */
  const [arama, setArama] = useState<{ acik: boolean; metin: string }>({ acik: false, metin: "" });
  /** Parçalı tahsilat penceresi (İş 8, G16) */
  const [parcaliAcik, setParcaliAcik] = useState(false);
  const [parcaliSecenekler, setParcaliSecenekler] = useState<{ pos: OdemeSecenegi[]; banka: OdemeSecenegi[] } | null>(null);
  /** Olmayan barkod → stok kartı penceresi (İş 7, G17; yalnız Ticari, stok yönetim yetkisiyle) */
  const [yeniKart, setYeniKart] = useState<{ acik: boolean; barkod?: string; ad?: string }>({ acik: false });
  const [stokYonetimi, setStokYonetimi] = useState(false);
  useEffect(() => {
    if (modul !== "ticari") { setStokYonetimi(false); return; }
    let iptal = false;
    TicariYetkiService.yetki().then((y) => !iptal && setStokYonetimi(!!y.yonetebilir)).catch(() => !iptal && setStokYonetimi(false));
    return () => { iptal = true; };
  }, [modul]);
  /** Alıcı penceresi: zorunlu ise (fatura sınırı / MASAK) onaydan sonra satış kaldığı yerden sürer */
  const [aliciSorusu, setAliciSorusu] = useState<{ zorunlu: AliciZorunlulugu | null; kayitliGerekli?: boolean; sonra?: (m: HizliMusteri) => void } | null>(null);

  const istatistik = useMemo(() => {
    const s = veri ? varsayilanIstatistik(veri.istatistikler, veri.tanim, tip, tip === 1 ? (user as any)?.sellStatCode : (user as any)?.buyStatCode) : null;
    if (!s) return s;
    // Döviz komisyonu: "Komisyon alma yetkisi" yoksa alınmaz; varsa kullanıcı kartındaki oran (> 0) istatistik oranının yerine
    if (!kullaniciYetkisi.komisyonAlma) return { ...s, komisyonOrani: 0 };
    return kullaniciYetkisi.komisyonOrani > 0 ? { ...s, komisyonOrani: kullaniciYetkisi.komisyonOrani } : s;
  }, [veri, tip, user, kullaniciYetkisi]);
  // Fiyat Değiştir / elle indirim: Hızlı Satış'ın kendi Fiyat/İndirim yetkisi ya da kullanıcı kartındaki "Fişte tutar değiştirme"
  // yetkisi; Sarraf/Döviz'de fiyat kurdur, kur yetkisi "Yok" ise değiştirilemez (docs/YETKI_VE_VEZNE_YOL_HARITASI.md §4.2)
  const fiyatYetkisi = yetki.fiyatYetkisi || kullaniciYetkisi.tutarDegistirme;
  const fiyatDegistirilebilir = fiyatYetkisi && (!(modul === "sarraf" || modul === "doviz") || kurDegistirilebilir(kullaniciYetkisi));

  // ───── Açılış ─────
  useEffect(() => {
    if (modul && acikModuller.includes(modul)) sonModulYaz(modul);
  }, [modul, acikModuller]);

  const yukle = useCallback(async () => {
    if (!modul) return;
    setYukleniyor(true);
    setHata(null);
    try {
      const [y, d] = await Promise.all([HizliSatisService.yetki(), HizliSatisService.duzen(modul)]);
      // Ticari: yalnız butonlardaki kartlar (G2)
      const kartIdler = modul === "ticari" ? d.flatMap((s) => s.butonlar.filter((b) => b.urunTuru === URUN_TURU.STOK && b.urunId).map((b) => Number(b.urunId))) : [];
      const v = await modulVerisiYukle(modul, { id: Number(user?.id) || undefined, cashierCode: (user as any)?.cashierCode }, kartIdler);
      setYetki(y);
      setDuzen(d);
      setAktifSekme(d[0]?.sekmeId ?? null);
      setVeri(v);
      HizliSatisService.bekleyenler(modul, v.vezne?.id ?? null).then((l) => setBekleyenSayisi(l.length)).catch(() => setBekleyenSayisi(0));
    } catch (e: any) {
      setHata(e?.message || "Hızlı satış verileri alınamadı.");
    } finally {
      setYukleniyor(false);
      odakla();
    }
  }, [modul, user, odakla]);

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
    odakla();
  };

  /**
   * Ticari fiyat listesi (İş 11, G7): kayıtlı müşterinin varsayılan listesi; müşteri değişince stok kartı satırları
   * (elle fiyat verilmemişse) yeni listeden yeniden fiyatlanır.
   */
  const fiyatListesiUygula = async (m: HizliMusteri) => {
    if (modul !== "ticari" || !veri) return;
    const liste = m.tur === "kayitli" && m.cariKartId ? await TicariService.cariFiyatListesi(m.cariKartId).catch(() => null) : null;
    const id = liste?.fiyatListesiId ?? null;
    if ((veri.fiyatListesiId ?? null) === id) return;
    const guncel = { ...veri, fiyatListesiId: id };
    const idler = [...new Set(sepet.filter((s) => s.tur === "stok" && s.urunId && !s.fiyatElle).map((s) => Number(s.urunId)))];
    if (idler.length) {
      const kartlar = await TicariService.kartlar({ idler, aktif: null, liste: id }).catch(() => [] as StokKart[]);
      for (const k of kartlar) guncel.kartlar.set(k.stokKartId, k);
      setSepet((p) => p.map((s) => {
        if (s.tur !== "stok" || s.fiyatElle) return s;
        const k = kartlar.find((x) => x.stokKartId === Number(s.urunId));
        if (!k) return s;
        const t = karttanSatir(k, guncel, tip, istatistik);
        return typeof t === "string" ? s : { ...s, birimFiyat: t.satir.birimFiyat, fiyatDegisti: t.satir.birimFiyat !== s.birimFiyat };
      }));
      setOdemeler([]);
    }
    setVeri(guncel);
    if (liste) showWarning(`Fiyat listesi: ${liste.ad}`, 4000);
  };

  const barkodOkut = async () => {
    if (!veri || !barkod.trim()) return;
    const g = barkod;
    setBarkod("");
    const t = await barkoddanSatir(g, veri, tip, istatistik);
    // Ticari'de bulunamayan barkod: yetkili kullanıcıda stok kartı penceresi açılır, kaydedince sepete girer (İş 7, G17)
    if (typeof t === "string" && modul === "ticari" && /bulunamadı/.test(t)) {
      const { kod } = barkodCoz(g);
      if (stokYonetimi) {
        showWarning(`"${kod}" barkodlu ya da kodlu ürün yok; yeni stok kartı açılıyor.`, 4000);
        setYeniKart({ acik: true, barkod: /^\S+$/.test(kod) ? kod : undefined, ad: /\s/.test(kod) ? kod : undefined });
        return;
      }
      showError(`${t} Stok kartını stok yönetim yetkisi olan kullanıcı açabilir.`);
      odakla();
      return;
    }
    taslakIsle(t, null);
    barkodRef.current?.focus();
  };

  // ───── Tuş takımı komutları ─────
  const seciliSatir = sepet.find((s) => s.anahtar === secili) || null;
  const satirGuncelle = (anahtar: string, alan: Partial<SepetSatiri>) => {
    // Fiyat değişince kampanya tutarı yeni fiyata göre yeniden seçilir (İş 11, G12)
    setSepet((s) => s.map((x) => (x.anahtar === anahtar ? (veri ? kampanyaIsle({ ...x, ...alan, ...("birimFiyat" in alan ? { fiyatDegisti: false } : {}) }, veri) : { ...x, ...alan }) : x)));
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
      if (!fiyatDegistirilebilir) return showError(fiyatYetkisi ? "Kur değiştirme yetkiniz yok." : "Hızlı Satış – Fiyat/İndirim yetkiniz yok.");
      const uygula = (d: number) => { fiyatUygula(seciliSatir, d); };
      if (n !== null && n > 0) {
        uygula(n);
        setGiris("");
      } else setSayiSorusu({ baslik: `${seciliSatir.ad} — ${modul === "sarraf" || modul === "doviz" ? "kur" : "birim fiyat"}`, birim: "TL", ilk: seciliSatir.birimFiyat, onay: uygula });
    }
  };

  /** Satıra elle fiyat / kur (Fiyat Değiştir tuşu ve satır düzenleme penceresi). Sarraf/Döviz'de kur yetkisi, gişe aralığı ve sapma uyarısı. */
  const fiyatUygula = (satir: SepetSatiri, d: number): boolean => {
    if (veri && (modul === "sarraf" || modul === "doviz")) {
      const u = { paraId: satir.urunId, urunTipi: satir.urunTipi };
      const kur = urunKuru(veri.kurlar, u, tip);
      const den = kurDenetle(kullaniciYetkisi, kur > 0 ? { kur, alis: urunKuru(veri.kurlar, u, 0) || null, satis: urunKuru(veri.kurlar, u, 1) || null } : null, d);
      if (den.hata) { showError(den.hata); return false; }
      if (den.uyari && !window.confirm(`${den.uyari}\n\nYine de uygulansın mı?`)) return false;
    }
    satirGuncelle(satir.anahtar, { birimFiyat: d, fiyatElle: true });
    return true;
  };

  /** Satır düzenleme penceresinden (İş 5): miktar ve isteğe bağlı fiyat */
  const duzenlenenSatir = sepet.find((s) => s.anahtar === duzenlenen) || null;
  const satirDuzenleOnay = (miktar: number, fiyat: number | null) => {
    if (!duzenlenenSatir) return;
    if (fiyat !== null && !fiyatUygula(duzenlenenSatir, fiyat)) return;
    if (duzenlenenSatir.tur !== "barkod" && miktar > 0) satirGuncelle(duzenlenenSatir.anahtar, { miktar: Math.round(miktar * 10000) / 10000 });
    setDuzenlenen(null);
    odakla();
  };
  const satirDuzenleSil = () => {
    if (!duzenlenenSatir) return;
    setSepet((s) => s.filter((x) => x.anahtar !== duzenlenenSatir.anahtar));
    setSecili((x) => (x === duzenlenenSatir.anahtar ? null : x));
    setOdemeler([]);
    setDuzenlenen(null);
    odakla();
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
        setAliciSorusu({ zorunlu: null, kayitliGerekli: true, sonra: (m) => { setMusteri(m); void fiyatListesiUygula(m); if (m.tur === "kayitli" && m.cariKartId) ekle({}, m); } });
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

  /** Parçalı tahsilat penceresini açar: POS cihazları ve banka hesapları (modüle göre) tek seferde yüklenir */
  const parcaliAc = async () => {
    if (!sepet.length) return showError("Sepet boş.");
    if (toplam.genelToplam <= 0) return showError("Fiş toplamı sıfır.");
    const posListe = odemeTurleri.includes(2) ? (posCihazlari ?? (await PosCihaziService.getPosCihazlari().catch(() => [] as PosCihaziItem[])).filter((p) => p.aktif !== false)) : [];
    if (odemeTurleri.includes(2)) setPosCihazlari(posListe);
    let bankaListe: OdemeSecenegi[] = [];
    if (odemeTurleri.includes(3)) {
      if (modul === "doviz") {
        const lk: any = await CariService.getLookups().catch(() => null);
        bankaListe = ((lk?.bankaList || []) as any[]).map((b) => ({ anahtar: String(b.id), ad: b.ad || b.unvan, alt: [b.bankaAdi, b.iban || b.hesapNo].filter(Boolean).join(" · "), alanlar: { bankaId: Number(b.id), bankaHesapNo: b.iban || b.hesapNo || b.kod || null, bankaAdi: b.ad || b.unvan || null } }));
      } else {
        const liste = bankalar ?? (await BankaService.getBankalar({ aktif: true }).catch(() => [] as BankaHesapItem[]));
        setBankalar(liste);
        bankaListe = liste.map((b) => ({ anahtar: String(b.bankaId), ad: b.hesapAdi, alt: [b.bankaAdi, b.hesapNo].filter(Boolean).join(" · "), alanlar: { bankaId: b.bankaId, bankaHesapNo: b.hesapNo, bankaAdi: b.hesapAdi } }));
      }
    }
    setParcaliSecenekler({
      pos: posListe.map((p) => ({ anahtar: String(p.posCihaziId), ad: p.ad, alt: p.kod, alanlar: { posCihaziId: p.posCihaziId, posAdi: p.ad, posKod: p.kod } })),
      banka: bankaListe,
    });
    setParcaliAcik(true);
  };

  // ───── Kaydet ─────
  // ───── Bekleyen sepet ─────
  const sayaciTazele = () => {
    if (modul) HizliSatisService.bekleyenler(modul, veri?.vezne?.id ?? null).then((l) => setBekleyenSayisi(l.length)).catch(() => undefined);
  };

  /** Mevcut sepeti beklemeye alır; başarılıysa sepeti boşaltır */
  const sepetiBeklet = async (not: string): Promise<boolean> => {
    if (!modul || !sepet.length) return false;
    setBekletiliyor(true);
    try {
      await HizliSatisService.bekleyenKaydet({
        modul,
        vezneId: veri?.vezne?.id ?? null,
        tip,
        musteri: musteri.tur === "anonim" ? null : musteri.unvan || null,
        aciklama: not.trim() || null,
        kalem: sepet.length,
        toplam: toplam.genelToplam,
        icerik: icerikHazirla(tip, sepet, odemeler, musteri, indirim),
      });
      temizle();
      setSonFis(null);
      sayaciTazele();
      showSuccess("Sepet beklemeye alındı.");
      return true;
    } catch (e: any) {
      showError(e?.message || "Sepet beklemeye alınamadı.");
      return false;
    } finally {
      setBekletiliyor(false);
    }
  };

  const bekleyeniAc = async (b: BekleyenSepet) => {
    if (!modul || !veri) return;
    if (sepet.length) {
      if (!window.confirm("Ekranda dolu bir sepet var. Önce beklemeye alınsın mı? (Hayır derseniz açma iptal edilir.)")) return;
      if (!(await sepetiBeklet(""))) return;
    }
    try {
      const k = await HizliSatisService.bekleyenGetir(b.bekleyenId, veri.vezne?.id ?? null);
      if (k.modul !== modul) return showError("Bu sepet başka bir modüle ait.");
      const { PerakendeService } = await import("../../services/perakendeService");
      // Kurlar beklerken değişmiş olabilir: sunucudan tazelenir (H26)
      const guncel = { ...veri, kurlar: modul === "ticari" ? veri.kurlar : await kurlariGetir(true).catch(() => veri.kurlar) };
      // Ticari: sepetteki stok kartları yerelde yoksa kimlikle çekilir (G2)
      if (modul === "ticari") {
        const eksik = [...new Set((k.icerik?.sepet || []).filter((s: any) => s.tur === "stok" && s.urunId && !guncel.kartlar.has(Number(s.urunId))).map((s: any) => Number(s.urunId)))] as number[];
        if (eksik.length) for (const kart of await TicariService.kartlar({ idler: eksik, aktif: null }).catch(() => [] as StokKart[])) guncel.kartlar.set(kart.stokKartId, kart);
      }
      setVeri(guncel);
      const r = await geriCagir(
        k.icerik,
        guncel,
        (t) => varsayilanIstatistik(veri.istatistikler, veri.tanim, t, t === 1 ? (user as any)?.sellStatCode : (user as any)?.buyStatCode),
        async (barkod) => {
          if (modul !== "perakende") return false;
          try { const u = await PerakendeService.getProductByBarcode(barkod); return !!u?.satildi; } catch { return true; }
        }
      );
      setTip(alisSatis ? r.tip : 1);
      setSepet(r.sepet);
      setOdemeler(r.odemeler);
      setMusteri(r.musteri || ANONIM_MUSTERI);
      setIndirim(r.indirim);
      setSecili(null);
      setSonFis(null);
      setBekleyenlerAcik(false);
      await HizliSatisService.bekleyenSil(b.bekleyenId, veri.vezne?.id ?? null).catch(() => undefined);
      sayaciTazele();
      for (const u of r.uyarilar) showWarning(u, 8000);
      if (r.degisen) showWarning(`${r.degisen} satırın fiyatı güncel kurdan yenilendi (işaretli).`, 6000);
      else showSuccess("Bekleyen sepet açıldı.");
    } catch (e: any) {
      showError(e?.message || "Bekleyen sepet açılamadı.");
      sayaciTazele();
    }
  };

  // Fiş kesilmeden çıkış / yenileme uyarısı
  const cikis = useCikisUyarisi(sepet.length > 0);

  // Sağ tık menüsü (ERPContextMenu) › Satırı Sil
  useEffect(() => {
    const sil = (e: Event) => {
      const d = (e as CustomEvent<{ rowId?: string; tableType?: string }>).detail;
      if (d?.tableType !== "hizli-sepet" || !d.rowId) return;
      setSepet((s) => s.filter((x) => x.anahtar !== d.rowId));
      setSecili((x) => (x === d.rowId ? null : x));
      setOdemeler([]);
    };
    window.addEventListener("erp-grid-row-delete", sil);
    return () => window.removeEventListener("erp-grid-row-delete", sil);
  }, []);

  const temizle = () => {
    setSepet([]);
    setOdemeler([]);
    setIndirim(null);
    setMusteri(ANONIM_MUSTERI);
    setSecili(null);
    setGiris("");
    if (veri?.fiyatListesiId) setVeri({ ...veri, fiyatListesiId: null });
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
      odakla();
    }
  };

  // ── İş 4 (G20): Satıştan Vazgeç — sepet, ödemeler, müşteri, iskonto ve tuş girişi temizlenir ──
  const vazgecilebilir = sepet.length > 0 || odemeler.length > 0 || !!giris || !!indirim || musteri.tur !== "anonim";
  const vazgec = () => {
    if (kaydediliyor) return;
    if ((sepet.length || odemeler.length) && !window.confirm("Satıştan vazgeçilsin mi? Sepet, ödemeler, müşteri ve iskonto silinir.")) return;
    temizle();
    setSonFis(null);
    odakla();
  };

  // ───── Çizim ─────
  if (!modul) return <Alert variant="warning" className="m-3">Geçersiz hızlı satış modülü.</Alert>;
  const sekme = duzen.find((s) => s.sekmeId === aktifSekme) || null;
  // Alışta (Sarraf/Döviz) müşteriye ödeme yapılır: POS yok
  // Banka ödemesi yalnız "Fiş banka hesabı seçme" yetkisinde
  const odemeTurleri = MODUL_ODEMELERI[modul].filter((t) => !(tip === 0 && t === 2) && (t !== 3 || kullaniciYetkisi.bankaHesabiSecme));
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
        <Nav variant="pills" className="p-1 bg-light rounded-3 gap-1" activeKey={modul} onSelect={(k) => k && k !== modul && navigate(hizliSatisYolu(k as HizliSatisModul))}>
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
          onClick={() => setAliciSorusu({ zorunlu: null, sonra: (m) => { setMusteri(m); if (m.tur !== "kayitli") setOdemeler((o) => o.filter((x) => x.tur !== 1)); void fiyatListesiUygula(m); } })}>
          <IconUser size={16} />{musteri.tur === "anonim" ? "Müşteri: Nihai tüketici" : musteri.unvan}
        </Button>
        {veri?.vezne && <Badge bg="light" text="dark" className="border">Vezne: {veri.vezne.ad}</Badge>}
        <div className="ms-auto d-flex gap-1">
          <Button variant="outline-warning" size="sm" title="Sepeti beklemeye al" disabled={!sepet.length || kaydediliyor} onClick={() => setBekletAcik(true)}><IconClockPause size={16} className="me-1" />Beklet</Button>
          <Button variant={bekleyenSayisi ? "warning" : "outline-secondary"} size="sm" title="Bekleyen sepetler" disabled={kaydediliyor} onClick={() => setBekleyenlerAcik(true)}>
            <IconClockPlay size={16} className="me-1" />Bekleyenler{bekleyenSayisi ? <Badge bg="dark" className="ms-1">{bekleyenSayisi}</Badge> : null}
          </Button>
          <Button variant="outline-secondary" size="sm" title="Hızlı satış fişleri (düzeltme / iade için)" onClick={() => setSonFislerAcik(true)}><IconListDetails size={16} className="me-1" />Fişler</Button>
          <Button variant="outline-secondary" size="sm" title="Kurları ve düzeni yenile" onClick={() => void yukle()}><IconRefresh size={16} /></Button>
          {yetki.sistemYoneticisi && duzenAcik && <Link to="/ayarlar/hizli-satis-duzeni" className="btn btn-sm btn-outline-secondary" title="Hızlı Satış Düzeni"><IconLayoutGrid size={16} /></Link>}
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
                value={barkod} onChange={(e) => setBarkod(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void barkodOkut(); } else if (e.key === "F4") { e.preventDefault(); setArama({ acik: true, metin: barkod.trim() }); } }} />
              <Button variant="outline-secondary" title="Ürün ara (F4)" disabled={kaydediliyor || !veri} onClick={() => setArama({ acik: true, metin: barkod.trim() })}><IconSearch size={16} className="me-1" />Ara</Button>
            </InputGroup>
            <div className="flex-grow-1 overflow-auto px-2" style={{ minHeight: 0 }}>
              <table className="table table-sm table-hover align-middle mb-0" style={{ fontSize: 14 }}>
                <thead className="table-light sticky-top">
                  <tr className="small text-secondary"><th>Ürün</th><th className="text-end">Miktar</th><th className="text-end">{kurlu ? "Kur" : "Fiyat"}</th><th className="text-end">Tutar</th><th style={{ width: 36 }}></th></tr>
                </thead>
                <tbody>
                  {sepet.map((s, i) => (
                    <tr key={s.anahtar} data-row-id={s.anahtar} data-table-type="hizli-sepet" onClick={() => setSecili(s.anahtar)}
                      onDoubleClick={() => { if (!kaydediliyor) { setSecili(s.anahtar); setDuzenlenen(s.anahtar); } }} title="Çift tık: miktar / fiyat düzenle"
                      className={s.anahtar === secili ? "table-primary" : ""} style={{ cursor: "pointer", height: 40 }}>
                      <td className="fw-semibold">
                        {s.ad}
                        {s.fiyatElle && <Badge bg="warning" text="dark" className="ms-1" title="Fiyat elle değiştirildi">E</Badge>}
                        {s.fiyatDegisti && <Badge bg="info" className="ms-1" title="Bekleyen sepetten açılınca güncel kurdan yenilendi">Kur</Badge>}
                        {s.ek?.kampanya && <Badge bg="danger" className="ms-1" title={`Kampanya: ${s.ek.kampanya.ad} (${s.ek.kampanya.turu === 1 ? `%${s.ek.kampanya.deger}` : `${para(s.ek.kampanya.deger)} TL`} satır iskontosu)`}>Kampanya</Badge>}
                        {s.kdvOrani > 0 && !kurlu && <span className="text-muted small ms-1">%{s.kdvOrani}</span>}
                      </td>
                      <td className="text-end text-nowrap">{miktarYaz(s.miktar)} <span className="text-muted small">{s.birim}</span></td>
                      <td className="text-end text-nowrap">{para(s.birimFiyat)}</td>
                      <td className="text-end text-nowrap fw-semibold">{para(toplam.satirTutarlari[i] ?? 0)}</td>
                      <td className="text-center p-0">
                        <button type="button" className="btn btn-link btn-sm p-1 text-secondary" title="Miktar / fiyat düzenle" disabled={kaydediliyor} aria-label={`${s.ad} satırını düzenle`}
                          onClick={(e) => { e.stopPropagation(); setSecili(s.anahtar); setDuzenlenen(s.anahtar); }}><IconPencil size={16} /></button>
                      </td>
                    </tr>
                  ))}
                  {!sepet.length && (
                    <tr><td colSpan={5} className="text-center text-muted py-4">
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
            <Button variant="outline-dark" className="fw-bold d-flex align-items-center justify-content-center" style={{ height: 44, touchAction: "manipulation" }}
              disabled={kaydediliyor || !sepet.length} title="Nakit / POS / Cari / Banka tutarlarını tek pencerede girin" onClick={() => void parcaliAc()}>
              <IconCoins size={20} className="me-1" />Parçalı Tahsilat
            </Button>
            <div className="d-grid gap-1" style={{ gridTemplateColumns: "repeat(2, 1fr)" }}>
              {(odemeTurleri as OdemeTuru[]).map((t) => (
                <Button key={t} variant={ODEME_RENK[t]} className="d-flex flex-column align-items-center justify-content-center fw-bold" style={{ height: 64, touchAction: "manipulation" }}
                  disabled={kaydediliyor || !sepet.length} onClick={() => void odemeEkle(t)}>
                  {ODEME_IKON[t]}<span style={{ fontSize: 14 }}>{ODEME_ADI[t]}</span>
                </Button>
              ))}
            </div>
            <TusTakimi giris={giris} setGiris={setGiris} onKomut={komut} fiyatYetkisi={fiyatDegistirilebilir} indirimVar={indirimVar} serbestVar={serbestVar} disabled={kaydediliyor} />
            <div className="d-flex gap-1 mt-auto">
              <Button variant="danger" className="flex-grow-0 fw-bold d-flex align-items-center" style={{ height: 52, fontSize: 13, lineHeight: 1.1 }} disabled={kaydediliyor || !vazgecilebilir}
                title="Satıştan vazgeç: sepet, ödemeler, müşteri ve iskonto silinir" onClick={vazgec}><IconTrash size={18} className="me-1" />Satıştan<br />Vazgeç</Button>
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
                  {yetki.sistemYoneticisi && duzenAcik ? <div><Link to="/ayarlar/hizli-satis-duzeni">Hızlı Satış Düzeni</Link>'nden ekleyin.</div> : <div>Sistem yöneticisi Hızlı Satış Düzeni'nden ekleyebilir.</div>}
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

      <SayiSorModal soru={sayiSorusu} kapat={() => { setSayiSorusu(null); odakla(); }} />
      <ParcaliTahsilatModal acik={parcaliAcik} genelToplam={toplam.genelToplam} odemeTurleri={odemeTurleri as OdemeTuru[]} mevcut={odemeler} musteri={musteri}
        posSecenekleri={parcaliSecenekler?.pos || []} bankaSecenekleri={parcaliSecenekler?.banka || []} bankaTamami={modul === "doviz"}
        kapat={() => { setParcaliAcik(false); odakla(); }}
        musteriSec={() => setAliciSorusu({ zorunlu: null, kayitliGerekli: true, sonra: (m) => { setMusteri(m); void fiyatListesiUygula(m); } })}
        onay={(liste) => { setParcaliAcik(false); setOdemeler(liste); setGiris(""); void tamamla(liste, musteri); }} />
      <UrunAramaModal acik={arama.acik} modul={modul} veri={veri} tip={tip} istatistik={istatistik} aramaMetni={arama.metin}
        kapat={() => { setArama({ acik: false, metin: "" }); odakla(); }}
        sec={(t) => { const n = girisSayi(giris); setGiris(""); setBarkod(""); taslakIsle(t, n); }} />
      <StokKartModal show={yeniKart.acik} onBarkod={yeniKart.barkod} onAd={yeniKart.ad} onHide={() => { setYeniKart({ acik: false }); odakla(); }}
        onSaved={(k) => { setYeniKart({ acik: false }); if (veri) taslakIsle(karttanSatir(k, veri, tip, istatistik), null); odakla(); }} />
      <SatirDuzenleModal satir={duzenlenenSatir} kurlu={kurlu} fiyatDegistirilebilir={fiyatDegistirilebilir}
        fiyatKapaliNedeni={fiyatYetkisi ? "Kur değiştirme yetkiniz yok." : "Hızlı Satış – Fiyat/İndirim yetkiniz yok."}
        kapat={() => { setDuzenlenen(null); odakla(); }} onay={satirDuzenleOnay} sil={satirDuzenleSil} />
      <SerbestUrunModal acik={serbestAcik} kapat={() => { setSerbestAcik(false); odakla(); }}
        onay={(ad, fiyat, kdv) => sepeteEkle({ anahtar: satirAnahtari(), ad, tur: "serbest", miktar: girisSayi(giris) || 1, birim: "Adet", birimFiyat: fiyat, kdvOrani: kdv })} />
      <SecimModal soru={secimSorusu} kapat={() => { setSecimSorusu(null); odakla(); }} />
      <CikisUyarisiModal acik={!!cikis.bekleyenGecis} bekletiliyor={bekletiliyor}
        ozet={`${sepet.length} kalem · ${para(toplam.genelToplam)} TL${odemeler.length ? ` · ${odemeler.length} ödeme satırı` : ""}`}
        kal={cikis.vazgec} cik={cikis.devam} beklet={() => { void sepetiBeklet("").then((ok) => (ok ? cikis.devam() : cikis.vazgec())); }} />
      <SonFislerModal modul={modul} acik={sonFislerAcik} kapat={() => { setSonFislerAcik(false); odakla(); }} />
      <BekletModal acik={bekletAcik} bekliyor={bekletiliyor} ozet={`${sepet.length} kalem · ${para(toplam.genelToplam)} TL${musteri.tur !== "anonim" && musteri.unvan ? ` · ${musteri.unvan}` : ""}${odemeler.length ? ` · ${odemeler.length} ödeme satırı da saklanır` : ""}`}
        kapat={() => { setBekletAcik(false); odakla(); }} onay={(n) => { void sepetiBeklet(n).then((ok) => { if (ok) setBekletAcik(false); odakla(); }); }} />
      <BekleyenlerModal acik={bekleyenlerAcik} modul={modul} vezneId={veri?.vezne?.id ?? null} yonetici={yetki.sistemYoneticisi}
        kapat={() => { setBekleyenlerAcik(false); odakla(); }} ac={(b) => void bekleyeniAc(b).then(odakla)} degisti={sayaciTazele} />
      <IskontoModal acik={iskontoAcik} brut={yuvarla2(toplam.genelToplam + toplam.indirim)} hasKuru={veri ? urunKuru(veri.kurlar, { kod: "HAS", urunTipi: 1 }, 1) : 0}
        fiyatYetkisi={fiyatYetkisi} elleVar mevcut={indirim} kapat={() => { setIskontoAcik(false); odakla(); }}
        onay={(i) => { setIndirim(i); setOdemeler([]); setIskontoAcik(false); odakla(); }} />
      <AliciModal acik={!!aliciSorusu} musteri={musteri} zorunlu={aliciSorusu?.zorunlu ?? null} kayitliGerekli={aliciSorusu?.kayitliGerekli}
        kapat={() => { setAliciSorusu(null); odakla(); }} onay={(m) => { const f = aliciSorusu?.sonra; setAliciSorusu(null); if (f) f(m); else setMusteri(m); odakla(); }} />
    </div>
  );
};

export default HizliSatisPage;
