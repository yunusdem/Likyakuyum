import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Alert, Button, Card, Col, Form, Row, Spinner, Table } from "react-bootstrap";
import {
  IconFileCheck,
  IconPlus,
  IconTrash,
  IconShieldCheck,
  IconAlertTriangle,
  IconSend,
  IconFolder,
  IconDeviceFloppy,
} from "@tabler/icons-react";

import ERPToolbar from "../../components/common/ERPToolbar";
import EBelgeCariDurbun from "./EBelgeCariDurbun";
import EBelgeKodDurbun from "./EBelgeKodDurbun";
import { KnskFormUyarisi } from "./EBelgeKnsk";
import { CariService } from "../../services/cariService";
import { gibAliasToEposta, gibTitleToAdSoyad } from "../../utils/gibKullanici";
import {
  EBELGE_BIRIMLER,
  EBELGE_FATURA_TIPLERI,
  EBELGE_SENARYOLAR,
  EbelgeAliciAdres,
  EbelgeDogrulamaSonucu,
  EbelgeFaturaTipi,
  EbelgeFormModu,
  ebelgeFormModu,
  EbelgeSatir,
  EbelgeSenaryo,
  ebelgeService,
  ebelgeTutar,
} from "../../services/ebelgeService";

/**
 * E-Belge — Belge Doğrulama (Faz 5)
 *
 * Girilen bilgilerden UBL-TR faturayı üretir. Gönder / Taslaklara Kaydet düğmeleri belgeyi önce
 * ICE'nin `invoice_check_validate` ucunda doğrular (şema + schematron), geçtiyse ARA ONAY OLMADAN
 * işlemi yapar; gerçek gönderimden sonra giden kutusuna geçilir (yönetici isteği 18.09.2026).
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
  const [senaryo, setSenaryoHam] = useState<EbelgeSenaryo>("TICARIFATURA");
  const [faturaTipi, setFaturaTipi] = useState<EbelgeFaturaTipi>("SATIS");
  /** Fatura tipleri senaryoya bağlıdır: senaryo değişince listede olmayan tip ilk seçeneğe döner. */
  const senaryoRef = useRef<EbelgeSenaryo>("TICARIFATURA");
  const setSenaryo = (yeni: EbelgeSenaryo) => {
    senaryoRef.current = yeni;
    setSenaryoHam(yeni);
    setFaturaTipi((t) => (EBELGE_FATURA_TIPLERI[yeni].some((x) => x.kod === t) ? t : EBELGE_FATURA_TIPLERI[yeni][0].kod));
  };
  const [paraBirimi, setParaBirimi] = useState<string>("TRY");
  const [not, setNot] = useState<string>("");

  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  // VKN pop-up'ı sorgu sonucunu (ya da sorgu yapılamadıysa kullanıcının seçtiği formu) ?senaryo= ile taşır.
  useEffect(() => {
    if ((searchParams.get("senaryo") || "").toUpperCase() === "EARSIVFATURA") setSenaryo("EARSIVFATURA");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Ana sayfadaki VKN pop-up'ından gelen numara (yönetici isteği 14.09.2026): numara dolu gelir, otomatik sorgu türü seçer
  const [aliciVkn, setAliciVkn] = useState<string>(() => (searchParams.get("vkn") || "").replace(/\D/g, "").slice(0, 11));
  const [aliciUnvan, setAliciUnvan] = useState<string>("");
  const [aliciAd, setAliciAd] = useState<string>("");
  const [aliciSoyad, setAliciSoyad] = useState<string>("");
  const [aliciVd, setAliciVd] = useState<string>("");
  const [aliciIl, setAliciIl] = useState<string>("");
  const [aliciIlce, setAliciIlce] = useState<string>("");
  const [aliciAdres, setAliciAdres] = useState<string>("");
  /** Alıcının ICE portalında kayıtlı adresleri; birden çoksa kullanıcı seçer */
  const [iceAdresler, setIceAdresler] = useState<EbelgeAliciAdres[]>([]);
  const [aliciEposta, setAliciEposta] = useState<string>("");
  /** Sorgu sonucu alıcı bilgileri dolduysa cari seçimi gizlenir; kullanıcı isterse yeniden açar (yönetici isteği 16.09.2026). */
  const [cariSecimAcik, setCariSecimAcik] = useState<boolean>(false);

  const [satirlar, setSatirlar] = useState<EbelgeSatir[]>([{ ...BOS_SATIR }]);

  // Mali alanlar
  const [iadeFaturalar, setIadeFaturalar] = useState<{ belgeNo: string; tarih: string }[]>([]);
  const [dovizKuru, setDovizKuru] = useState<string>("");
  const [dogrulaniyor, setDogrulaniyor] = useState<boolean>(false);
  const [alertInfo, setAlertInfo] = useState<AlertInfo>(null);
  const [mukellefSorgulaniyor, setMukellefSorgulaniyor] = useState(false);
  /** Sonucu ekranda duran numara. Numara değişince tür seçimi geçersizleşir. */
  const [sorgulananVkn, setSorgulananVkn] = useState("");
  /** Otomatik sorgunun aynı numara için tekrar tekrar denenmesini engeller. */
  const otomatikDenenen = useRef("");
  /** Geç dönen eski sorgunun yeni sonucu ezmesini engeller. */
  const sorguSirasi = useRef(0);

  /**
   * GİB mükellef listesinden gelen unvan / posta kutusunu boş alıcı alanlarına yazar.
   * Kullanıcının elle girdiği değer ezilmez. Doldurulan alan adlarını döndürür.
   */
  const aliciBilgileriniDoldur = (vkn: string, kullanicilar: { Alias?: string; Identifier?: string; Title?: string }[]): string[] => {
    const ilk = kullanicilar[0];
    if (!ilk) return [];
    const doldurulan: string[] = [];
    const unvan = (ilk.Title || "").trim();
    const eposta = gibAliasToEposta(ilk.Alias || ilk.Identifier);
    if (unvan) {
      if (vkn.length === 11) {
        const { ad, soyad } = gibTitleToAdSoyad(unvan);
        if (!aliciAd.trim() && !aliciSoyad.trim()) { setAliciAd(ad); setAliciSoyad(soyad); doldurulan.push("ad soyad"); }
      } else if (!aliciUnvan.trim()) { setAliciUnvan(unvan); doldurulan.push("unvan"); }
    }
    if (eposta && !aliciEposta.trim()) { setAliciEposta(eposta); doldurulan.push("e-posta"); }
    else if (!eposta) doldurulan.push("e-posta yok");
    return doldurulan;
  };

  /**
   * Aynı VKN/TCKN ile kayıtlı yerel cari varsa ad soyad, e-posta, vergi dairesi ve il/ilçeyi
   * boş alanlara yazar (cari modülü yalnızca okunur, dokunulmaz).
   */
  const yerelCaridenDoldur = async (vkn: string, sira: number) => {
    try {
      const [cariler, sozluk] = await Promise.all([CariService.getCariKartlar(), CariService.getLookups()]);
      if (sira !== sorguSirasi.current) return;
      const cari = cariler.find((c) => (c.vergiKimlikNo || "").replace(/\D/g, "") === vkn);
      if (!cari) return;
      const doldurulan: string[] = [];
      const ad = (cari.ad || "").trim();
      if (ad) {
        if (vkn.length === 11) {
          const { ad: a, soyad } = gibTitleToAdSoyad(ad);
          setAliciAd((o) => { if (o.trim()) return o; doldurulan.push("ad soyad"); return a; });
          setAliciSoyad((o) => (o.trim() ? o : soyad));
        } else {
          setAliciUnvan((o) => { if (o.trim()) return o; doldurulan.push("unvan"); return ad; });
        }
      }
      const eposta = (cari.eposta || "").trim();
      if (eposta) setAliciEposta((o) => { if (o.trim()) return o; doldurulan.push("e-posta"); return eposta; });
      const vd = sozluk.vergiDairesiList.find((x) => x.id === cari.vergiDairesiId)?.ad || "";
      const il = sozluk.ilList.find((x) => x.id === cari.ilId)?.ad || "";
      const ilce = sozluk.ilceList.find((x) => x.id === cari.ilceId)?.ad || "";
      if (vd) setAliciVd((o) => { if (o.trim()) return o; doldurulan.push("vergi dairesi"); return vd; });
      const adres = (cari.adres || "").trim();
      if (adres) setAliciAdres((o) => { if (o.trim()) return o; doldurulan.push("adres"); return adres; });
      if (il) setAliciIl((o) => { if (o.trim()) return o; doldurulan.push("il"); return il; });
      if (ilce) setAliciIlce((o) => { if (o.trim()) return o; doldurulan.push("ilçe"); return ilce; });
      // State güncellemeleri toplu işlendiği için bilgi mesajı bir sonraki döngüde verilir.
      setTimeout(() => {
        if (sira !== sorguSirasi.current || !doldurulan.length) return;
        setAlertInfo((o) => ({ type: o?.type === "danger" ? "danger" : "success",
          message: `${o?.message || ""} Cari kartından dolduruldu (${cari.kod}): ${doldurulan.join(", ")}.`.trim() }));
      }, 0);
    } catch {
      /* Yerel cari bulunamaması hata değildir; sessiz geç. */
    }
  };

  /**
   * ICE adresini alıcı alanlarına yazar. `uzerineYaz` yalnızca kullanıcı listeden
   * kendisi seçtiğinde true olur; kendiliğinden doldurmada dolu alanlara dokunulmaz
   * (yerel cari kartı önceliklidir).
   */
  const iceAdresiUygula = (a: EbelgeAliciAdres, uzerineYaz: boolean): string[] => {
    const doldurulan: string[] = [];
    const yaz = (deger: string, etiket: string, set: React.Dispatch<React.SetStateAction<string>>) => {
      if (!deger) return;
      set((o) => { if (!uzerineYaz && o.trim()) return o; doldurulan.push(etiket); return deger; });
    };
    yaz(a.adres, "adres", setAliciAdres);
    yaz(a.il, "il", setAliciIl);
    yaz(a.ilce, "ilçe", setAliciIlce);
    if (a.eposta) setAliciEposta((o) => { if (o.trim()) return o; doldurulan.push("e-posta"); return a.eposta; });
    return doldurulan;
  };

  /** Alıcı ICE'de kayıtlıysa adreslerini getirir: tek adres boş alanlara yazılır, birden çoğu seçtirilir. */
  const iceAdresleriGetir = async (vkn: string, sira: number) => {
    const ekMesaj = (metin: string) => setAlertInfo((o) => ({ type: o?.type === "danger" ? "danger" : "success",
      message: `${o?.message || ""} ${metin}`.trim() }));
    try {
      const adresler = await ebelgeService.aliciAdresleri(vkn);
      if (sira !== sorguSirasi.current) return;
      setIceAdresler(adresler);
      if (!adresler.length) return;
      if (adresler.length > 1) {
        ekMesaj(`ICE'de ${adresler.length} kayıtlı adres var; Kayıtlı Adres listesinden seçin.`);
        return;
      }
      const doldurulan = iceAdresiUygula(adresler[0], false);
      setTimeout(() => {
        if (sira !== sorguSirasi.current || !doldurulan.length) return;
        setAlertInfo((o) => ({ type: o?.type === "danger" ? "danger" : "success",
          message: `${o?.message || ""} ICE'den dolduruldu (${adresler[0].adresAdi || "kayıtlı cari"}): ${doldurulan.join(", ")}.`.trim() }));
      }, 0);
    } catch {
      /* Adres bulunamaması belge kesmeye engel değildir; neden e-belge loguna (AliciAdresSorgu) yazılır, ekran sessiz kalır. */
    }
  };

  const mukellefSorgula = async (vknParam?: string, otomatik = false) => {
    const vkn = (vknParam ?? aliciVkn).trim();
    if (!/^\d{10,11}$/.test(vkn)) {
      if (!otomatik) setAlertInfo({ type: "danger", message: "VKN 10, TCKN 11 haneli olmalıdır." });
      return;
    }
    const sira = ++sorguSirasi.current;
    setMukellefSorgulaniyor(true);
    setIceAdresler([]);
    try {
      const cevap = await ebelgeService.mukellefSorgula(vkn);
      if (sira !== sorguSirasi.current) return;
      setSorgulananVkn(vkn);
      // Güncel senaryo ref'ten okunur: otomatik sorgu eski render'ın kapanışıyla çalışabilir.
      if (!cevap.mukellefMi) setSenaryo("EARSIVFATURA");
      else if (senaryoRef.current === "EARSIVFATURA") setSenaryo("TICARIFATURA");
      const doldurulan = aliciBilgileriniDoldur(vkn, cevap.kullanicilar || []);
      setAlertInfo({ type: "success", message: (cevap.mukellefMi
        ? "Alıcı e-Fatura mükellefi. e-Fatura seçildi; belgeyi doğrulayarak devam edin."
        : "Alıcı e-Fatura mükellefi değil. e-Arşiv seçildi; belgeyi doğrulayarak devam edin.")
        + (doldurulan.length ? ` GİB: ${doldurulan.join(", ")}.` : "") });
      // Yerel cari önceliklidir: ICE adresi ondan SONRA, yalnızca boş kalan alanlara yazılır.
      void yerelCaridenDoldur(vkn, sira).then(() => iceAdresleriGetir(vkn, sira));
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

  /** Yürüyen işlem (düğmedeki dönen simge için) */
  const [islem, setIslem] = useState<"taslak" | "gonder" | "earsiv">("taslak");
  const [taslakGonderiliyor, setTaslakGonderiliyor] = useState<boolean>(false);
  /** Çift tıkla çift fatura kesilmesini önler; state güncellemesini beklemeden kilitler. */
  const islemde = useRef(false);

  const tcknMi = aliciVkn.trim().length === 11;
  const iadeMi = faturaTipi === "IADE" || faturaTipi === "TEVKIFATIADE";
  const tevkifatliMi = faturaTipi === "TEVKIFAT" || faturaTipi === "TEVKIFATIADE";
  const ozelMatrahMi = faturaTipi === "OZELMATRAH";
  const dovizliMi = paraBirimi !== "TRY";

  /** Özel matrahlı satırda KDV, satır tutarı yerine girilen özel matrah üzerinden hesaplanır. */
  const kdvMatrahi = (s: EbelgeSatir, satirMatrahi: number) =>
    ozelMatrahMi && s.ozelMatrahKodu?.trim() ? Math.round((s.ozelMatrahTutari || 0) * 100) / 100 : satirMatrahi;

  /**
   * Gönderilecek satırlar: seçili fatura tipine ait olmayan alanlar (tip değiştirilince satırda kalmış tevkifat /
   * özel matrah bilgisi) ayıklanır; yoksa üreteç "tip uyuşmuyor" diye reddeder.
   */
  const gonderilecekSatirlar = (): EbelgeSatir[] => satirlar.map((s) => ({
    ...s,
    tevkifatKodu: tevkifatliMi ? s.tevkifatKodu : undefined,
    tevkifatOrani: tevkifatliMi ? s.tevkifatOrani : undefined,
    ozelMatrahKodu: ozelMatrahMi ? s.ozelMatrahKodu?.trim() || undefined : undefined,
    ozelMatrahGerekcesi: ozelMatrahMi && s.ozelMatrahKodu?.trim() ? s.ozelMatrahGerekcesi : undefined,
    ozelMatrahTutari: ozelMatrahMi && s.ozelMatrahKodu?.trim() ? s.ozelMatrahTutari ?? 0 : undefined,
  }));

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
      kdv = yuvarla(kdv + (kdvMatrahi(s, m) * (s.kdvOrani || 0)) / 100);
    }
    let tevkifat = 0;
    for (const s of satirlar) {
      if (!s.tevkifatOrani) continue;
      const brut = yuvarla((s.miktar || 0) * (s.birimFiyat || 0));
      const m = yuvarla(brut - (brut * (s.iskontoOrani || 0)) / 100);
      const satirKdv = yuvarla((kdvMatrahi(s, m) * (s.kdvOrani || 0)) / 100);
      tevkifat = yuvarla(tevkifat + (satirKdv * s.tevkifatOrani) / 100);
    }
    return { matrah, kdv, iskonto, tevkifat, toplam: yuvarla(matrah + kdv - tevkifat) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [satirlar, faturaTipi]);

  const satirDegistir = <K extends keyof EbelgeSatir>(i: number, alan: K, deger: EbelgeSatir[K]) => {
    setSatirlar((onceki) => onceki.map((s, idx) => (idx === i ? { ...s, [alan]: deger } : s)));
  };

  /** Belgeyi ICE'de doğrular; şema + schematron geçtiyse doğrulama cevabını, geçmediyse null döner. */
  const dogrula = async (): Promise<EbelgeDogrulamaSonucu | null> => {
    setAlertInfo(null);

    if (!belgeNo.trim()) {
      setAlertInfo({ type: "danger", message: "Fatura numarası zorunludur." });
      return null;
    }
    if (!aliciVkn.trim()) {
      setAlertInfo({ type: "danger", message: "Alıcı VKN/TCKN zorunludur." });
      return null;
    }
    if (!aliciUnvan.trim() && !(aliciAd.trim() && aliciSoyad.trim())) {
      setAlertInfo({ type: "danger", message: "Alıcı için unvan ya da ad+soyad giriniz." });
      return null;
    }
    if (satirlar.some((s) => !s.ad.trim())) {
      setAlertInfo({ type: "danger", message: "Her satırda mal/hizmet adı bulunmalıdır." });
      return null;
    }
    if (satirlar.some((s) => s.kdvOrani === 0 && !s.istisnaKodu?.trim())) {
      setAlertInfo({
        type: "danger",
        message: "KDV oranı 0 olan satırlarda GİB istisna kodu zorunludur.",
      });
      return null;
    }
    if (satirlar.some((s) => s.istisnaKodu?.trim() && s.istisnaKodu.trim() !== "555" && s.kdvOrani !== 0)) {
      setAlertInfo({ type: "danger", message: "İstisna kodu girilen satırda KDV oranı 0 olmalıdır. Kodu silin ya da KDV oranını 0 yapın." });
      return null;
    }
    if (satirlar.some((s) => s.istisnaKodu?.trim() === "555" && s.kdvOrani === 0)) {
      setAlertInfo({ type: "danger", message: "555 vergi muafiyet kodu KDV 0 ile kullanılamaz." });
      return null;
    }
    if (satirlar.some((s) => s.istisnaKodu?.trim() === "555") && ["YATIRIMTESVIK", "KAMU"].includes(senaryo)) {
      setAlertInfo({ type: "danger", message: "555 vergi muafiyet kodu özel senaryolu faturada kullanılamaz." });
      return null;
    }
    if (satirlar.some((s) => ["308", "339"].includes(s.istisnaKodu?.trim() || "")) && senaryo !== "YATIRIMTESVIK") {
      setAlertInfo({ type: "danger", message: "308 ve 339 kodları yalnızca Yatırım Teşvik profilinde kullanılabilir." });
      return null;
    }
    if (iadeMi && !["TEMELFATURA", "EARSIVFATURA", "YATIRIMTESVIK", "KAMU"].includes(senaryo)) {
      setAlertInfo({ type: "danger", message: `İade faturası ${senaryo} profilinde kullanılamaz.` });
      return null;
    }
    if (faturaTipi === "TEKNOLOJIDESTEK" && senaryo !== "EARSIVFATURA") {
      setAlertInfo({ type: "danger", message: "Teknoloji Destek faturası yalnızca e-Arşiv Fatura profilinde kullanılabilir." });
      return null;
    }
    if (tevkifatliMi && !satirlar.some((s) => s.tevkifatKodu?.trim())) {
      setAlertInfo({
        type: "danger",
        message: "Tevkifatlı faturada en az bir satırda tevkifat kodu ve oranı olmalıdır.",
      });
      return null;
    }
    if (ozelMatrahMi && !satirlar.some((s) => s.ozelMatrahKodu?.trim())) {
      setAlertInfo({ type: "danger", message: "Özel matrahlı faturada en az bir satırda özel matrah kodu ve tutarı olmalıdır." });
      return null;
    }
    if (iadeMi && (!iadeFaturalar.length || iadeFaturalar.some((r) => !r.belgeNo.trim() || !r.tarih))) {
      setAlertInfo({
        type: "danger",
        message: "İade faturasında iade edilen fatura numarası ve tarihi zorunludur.",
      });
      return null;
    }
    if (dovizliMi && !(Number(dovizKuru) > 0)) {
      setAlertInfo({
        type: "danger",
        message: `${paraBirimi} cinsinden belgede TL karşılığı kur zorunludur.`,
      });
      return null;
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
          adres: aliciAdres.trim() || undefined,
          il: aliciIl.trim() || undefined,
          ilce: aliciIlce.trim() || undefined,
          eposta: aliciEposta.trim() || undefined,
        },
        satirlar: gonderilecekSatirlar(),
        iadeFaturalar: iadeMi ? iadeFaturalar : undefined,
        dovizKuru: dovizliMi && dovizKuru ? { kur: Number(dovizKuru), tarih } : undefined,
        onizleme: false,
      });

      if (cevap.semaGecerli && cevap.schematronGecerli) return cevap;
      setAlertInfo({ type: "danger", message: `Belge gönderilmedi: ${cevap.mesaj || "ICE doğrulamasından geçemedi."}` });
      return null;
    } catch (err: any) {
      setAlertInfo({ type: "danger", message: err?.message || "Doğrulama yapılamadı." });
      return null;
    } finally {
      setDogrulaniyor(false);
    }
  };

  const earsivMi = senaryo === "EARSIVFATURA";
  const formModu = ebelgeFormModu(senaryo);

  /** Açık yerel taslak (e-Arşiv). Kaydet aynı taslağı günceller; belge gönderilince taslak silinir. */
  const [yerelTaslakId, setYerelTaslakId] = useState<number | null>(null);
  useEffect(() => {
    const id = Number(searchParams.get("taslak"));
    if (!Number.isInteger(id) || id <= 0) return;
    ebelgeService.yerelTaslakGetir<any>(id).then(({ icerik: t }) => {
      setYerelTaslakId(id);
      setSenaryo("EARSIVFATURA");
      setBelgeNo(t.belgeNo || ""); setTarih(t.tarih || bugunISO()); setParaBirimi(t.paraBirimi || "TRY"); setNot(t.not || "");
      if (EBELGE_FATURA_TIPLERI.EARSIVFATURA.some((x) => x.kod === t.faturaTipi)) setFaturaTipi(t.faturaTipi);
      setAliciVkn(t.aliciVkn || ""); setAliciUnvan(t.aliciUnvan || ""); setAliciAd(t.aliciAd || ""); setAliciSoyad(t.aliciSoyad || "");
      setAliciVd(t.aliciVd || ""); setAliciIl(t.aliciIl || ""); setAliciIlce(t.aliciIlce || ""); setAliciAdres(t.aliciAdres || "");
      setAliciEposta(t.aliciEposta || "");
      if (Array.isArray(t.satirlar) && t.satirlar.length) setSatirlar(t.satirlar);
      setIadeFaturalar(Array.isArray(t.iadeFaturalar) ? t.iadeFaturalar : []); setDovizKuru(t.dovizKuru || "");
      setAlertInfo({ type: "info", message: `Yerel taslak #${id} açıldı. Bu taslak GİB'e gönderilmedi; düzenleyip Gönder ile kesebilirsiniz.` });
    }).catch((e: any) => setAlertInfo({ type: "danger", message: e?.message || "Taslak açılamadı." }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** e-Arşiv'de ICE taslak metodu yoktur: form olduğu gibi yerelde saklanır, doğrulama gönderimde yapılır. */
  const yerelTaslakKaydet = async () => {
    if (islemde.current) return;
    islemde.current = true; setIslem("taslak"); setTaslakGonderiliyor(true); setAlertInfo(null);
    try {
      const { id } = await ebelgeService.yerelTaslakKaydet({
        id: yerelTaslakId ?? undefined, belgeTuru: "EArsiv", belgeNo: belgeNo.trim() || null, aliciVkn: aliciVkn.trim() || null,
        aliciUnvan: aliciUnvan.trim() || `${aliciAd} ${aliciSoyad}`.trim() || null, tutar: yerelToplam.toplam, paraBirimi,
        icerik: { belgeNo, tarih, faturaTipi, paraBirimi, not, aliciVkn, aliciUnvan, aliciAd, aliciSoyad, aliciVd, aliciIl, aliciIlce,
          aliciAdres, aliciEposta, satirlar, iadeFaturalar, dovizKuru },
      });
      setYerelTaslakId(id);
      setAlertInfo({ type: "success", message: `Taslaklara kaydedildi (yerel taslak #${id}). Belge GİB'e gönderilmedi ve numara kullanılmadı; "Taslaklara Git" ile yeniden açabilirsiniz.` });
    } catch (err: any) {
      setAlertInfo({ type: "danger", message: err?.message || "Taslak kaydedilemedi." });
    } finally { islemde.current = false; setTaslakGonderiliyor(false); }
  };

  /**
   * Tek adımlı akış (yönetici isteği 18.09.2026): düğme belgeyi ICE'de doğrular ve geçtiyse
   * ARA ONAY OLMADAN işlemi yapar. Doğrulama paneli, önizleme ve "Evet, gönder" adımı kaldırıldı.
   * Doğrulamada üretilen UUID ve saat gönderime taşınır ki doğrulanan ile gönderilen belge aynı olsun.
   */
  const islemYap = async (tur: "taslak" | "gonder" | "earsiv") => {
    if (islemde.current) return;
    if (turBelirsiz || mukellefSorgulaniyor) {
      setAlertInfo({ type: "warning", message: "Mükellef sorgusu tamamlanmadan işlem yapılamaz." });
      return;
    }
    islemde.current = true;
    setIslem(tur);
    try {
      const dogrulama = await dogrula();
      if (!dogrulama) return;

      setTaslakGonderiliyor(true);
      const govde = {
        uuid: dogrulama.uuid,
        saat:
          new DOMParser()
            .parseFromString(dogrulama.xml, "application/xml")
            .getElementsByTagName("cbc:IssueTime")[0]?.textContent || undefined,
        belgeNo: belgeNo.trim().toUpperCase(),
        tarih,
        senaryo: tur === "earsiv" ? ("EARSIVFATURA" as EbelgeSenaryo) : senaryo,
        faturaTipi,
        paraBirimi,
        notlar: not.trim() ? [not.trim()] : undefined,
        alici: {
          vknTckn: aliciVkn.trim(),
          unvan: aliciUnvan.trim() || undefined,
          ad: aliciAd.trim() || undefined,
          soyad: aliciSoyad.trim() || undefined,
          vergiDairesi: aliciVd.trim() || undefined,
          adres: aliciAdres.trim() || undefined,
          il: aliciIl.trim() || undefined,
          ilce: aliciIlce.trim() || undefined,
          eposta: aliciEposta.trim() || undefined,
        },
        satirlar: gonderilecekSatirlar(),
        iadeFaturalar: iadeMi ? iadeFaturalar : undefined,
        dovizKuru: dovizliMi && dovizKuru ? { kur: Number(dovizKuru), tarih } : undefined,
      };

      if (tur === "taslak") {
        const cevap = await ebelgeService.taslakGonder(govde);
        // Numara kullanıldı; aynı belgenin ikinci kez kaydedilmemesi için alan boşaltılır.
        setBelgeNo("");
        setAlertInfo({
          type: "success",
          message: `Taslaklara kaydedildi (${cevap.belgeNo}). Belge GİB'e gönderilmedi; "Taslaklara Git" ile gönderebilir veya iptal edebilirsiniz.`,
        });
        return;
      }

      if (tur === "earsiv") {
        await ebelgeService.earsivGonder(govde);
        // Fatura kesildi; kaynağı olan yerel taslak artık gereksiz. Silinemezse gönderim sonucu etkilenmez.
        if (yerelTaslakId) await ebelgeService.yerelTaslakSil(yerelTaslakId).catch(() => undefined);
      } else await ebelgeService.faturaGonder(govde);
      // Kesilen fatura giden kutusunda en üstte görünür.
      navigate("/e-belge/giden");
    } catch (err: any) {
      setAlertInfo({ type: "danger", message: err?.message || "Belge gönderilemedi." });
    } finally {
      islemde.current = false;
      setTaslakGonderiliyor(false);
    }
  };

  return (
    <div className="ebelge-dogrula-container w-100 pb-3" style={{ overflowX: "hidden" }}>
      <ERPToolbar
        pageTitle="E- Belge Doğrulama"
        pageIcon={<IconFileCheck size={22} className="text-primary" />}
        onSave={() => void (earsivMi ? yerelTaslakKaydet() : islemYap("taslak"))}
        onNew={() => {
          setBelgeNo("");
          setSatirlar([{ ...BOS_SATIR }]);
          setAlertInfo(null);
        }}
        onRefresh={() => {
          if (aliciVkn.trim().length >= 10) {
            void mukellefSorgula(aliciVkn, true);
          } else {
            setBelgeNo("");
            setSatirlar([{ ...BOS_SATIR }]);
            setAlertInfo(null);
          }
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
        <strong>Gönder</strong> düğmesi ara onay sormadan <strong>gerçek faturayı keser</strong>; fatura geri alınamaz.
        Taslaklara Kaydet GİB'e göndermez. e-Arşiv gönderimi şu anda TRY cinsinden, pozitif KDV oranlı
        SATIS belgeleriyle sınırlıdır.
      </Alert>

      <KnskFormUyarisi vknTckn={aliciVkn.trim()} />

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
              <Form.Label className="small mb-1">Belge Türü</Form.Label>
              {/* Mükellef sorgusu sonuçlandıysa tür GİB kaydına göre kilitlenir; kullanıcı değiştiremez. */}
              <Form.Select
                size="sm"
                value={formModu}
                disabled={!!sorgulananVkn}
                title={sorgulananVkn ? "Tür, mükellef sorgusunun sonucuna göre belirlendi." : undefined}
                onChange={(e) => setSenaryo(EBELGE_SENARYOLAR[e.target.value as EbelgeFormModu][e.target.value === "EFATURA" ? 1 : 0].kod)}
              >
                <option value="EFATURA">e-Fatura</option>
                <option value="EARSIV">e-Arşiv</option>
              </Form.Select>
            </Col>
            <Col xs={6} md={3} lg={2}>
              <Form.Label className="small mb-1">Senaryo</Form.Label>
              <Form.Select size="sm" value={senaryo} onChange={(e) => setSenaryo(e.target.value as EbelgeSenaryo)}>
                {EBELGE_SENARYOLAR[formModu].map((x) => (
                  <option key={x.kod} value={x.kod}>{x.ad}</option>
                ))}
              </Form.Select>
            </Col>
            <Col xs={6} md={3} lg={2}>
              <Form.Label className="small mb-1">Fatura Tipi</Form.Label>
              <Form.Select
                size="sm"
                value={faturaTipi}
                onChange={(e) => setFaturaTipi(e.target.value as EbelgeFaturaTipi)}
              >
                {EBELGE_FATURA_TIPLERI[senaryo].map((x) => (
                  <option key={x.kod} value={x.kod}>{x.ad}</option>
                ))}
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
          {(() => {
            const aliciDolu = aliciVkn.trim() === sorgulananVkn && sorgulananVkn !== "" && Boolean(aliciUnvan.trim() || (aliciAd.trim() && aliciSoyad.trim()));
            return aliciDolu && !cariSecimAcik ? (
              <div className="small text-muted mb-2">
                Alıcı bilgileri sorgudan doldu.{" "}
                <Button size="sm" variant="link" className="p-0 align-baseline" onClick={() => setCariSecimAcik(true)}>Başka cari seç</Button>
              </div>
            ) : (
          <EBelgeCariDurbun onSelect={(cari, lookups) => {
            setCariSecimAcik(false);
            setAliciVkn(cari.vergiKimlikNo?.trim() || "");
            setAliciUnvan(cari.ad);
            const adlar = cari.ad.trim().split(/\s+/);
            setAliciSoyad(adlar.length > 1 ? adlar.pop()! : "");
            setAliciAd(adlar.join(" "));
            setAliciIl(lookups.ilList.find(x => x.id === cari.ilId)?.ad || "");
            setAliciIlce(lookups.ilceList.find(x => x.id === cari.ilceId)?.ad || "");
            setAliciVd(lookups.vergiDairesiList.find(x => x.id === cari.vergiDairesiId)?.ad || "");
            setAliciEposta((cari.eposta || "").trim());
            setAliciAdres((cari.adres || "").trim());
            setIceAdresler([]);
            setAlertInfo({ type: "info", message: "Cari seçildi. Ad soyad ve adresi kontrol edip Mükellef Sorgula ile belge türünü belirleyin." });
          }} />
            );
          })()}
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
            <Col xs={12} md={6} lg={4}>
              <Form.Label className="small mb-1">Adresin devamı (mahalle, cadde, no)</Form.Label>
              <Form.Control size="sm" value={aliciAdres} maxLength={300} onChange={(e) => setAliciAdres(e.target.value)} />
            </Col>
            {iceAdresler.length > 1 && (
              <Col xs={12} md={6} lg={4}>
                <Form.Label className="small mb-1">Kayıtlı Adres (ICE)</Form.Label>
                <Form.Select size="sm" value="" onChange={(e) => {
                  const secilen = iceAdresler[Number(e.target.value)];
                  if (secilen) iceAdresiUygula(secilen, true);
                }}>
                  <option value="">Adres seçin…</option>
                  {iceAdresler.map((a, i) => (
                    <option key={i} value={i}>
                      {[a.adresAdi, a.adres, [a.ilce, a.il].filter(Boolean).join(" / ")].filter(Boolean).join(" — ")}
                    </option>
                  ))}
                </Form.Select>
              </Col>
            )}
            <Col xs={12} md={6} lg={4}>
              <Form.Label className="small mb-1">E-posta</Form.Label>
              <Form.Control size="sm" type="email" value={aliciEposta} onChange={(e) => setAliciEposta(e.target.value)}
                placeholder="GİB / cari kartından bulunursa kendiliğinden dolar" />
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
                  <th style={{ width: "170px" }}>İstisna Kodu</th>
                  {tevkifatliMi && <th style={{ width: "190px" }}>Tevkifat</th>}
                  {ozelMatrahMi && <th style={{ width: "250px" }}>Özel Matrah (kod / KDV matrahı)</th>}
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
                        <EBelgeKodDurbun
                          tur="ISTISNA"
                          placeholder={satir.kdvOrani === 0 ? "zorunlu" : "-"}
                          value={satir.istisnaKodu || ""}
                          disabled={ozelMatrahMi && !!satir.ozelMatrahKodu?.trim()}
                          isInvalid={satir.kdvOrani === 0 && !satir.istisnaKodu?.trim()}
                          onChange={(kod) => satirDegistir(i, "istisnaKodu", kod)}
                          onSelect={(k) => {
                            satirDegistir(i, "istisnaGerekcesi", k.ad);
                            if (k.kod !== "555") satirDegistir(i, "kdvOrani", 0);
                          }}
                        />
                      </td>
                      {tevkifatliMi && (
                        <td>
                          <div className="d-flex gap-1">
                            <div style={{ width: "130px" }}>
                              <EBelgeKodDurbun
                                tur="TEVKIFAT"
                                placeholder="kod"
                                value={satir.tevkifatKodu || ""}
                                onChange={(kod) => satirDegistir(i, "tevkifatKodu", kod)}
                                onSelect={(k) => { if (k.oran != null) satirDegistir(i, "tevkifatOrani", k.oran); }}
                              />
                            </div>
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
                      {ozelMatrahMi && (
                        <td>
                          <div className="d-flex gap-1">
                            <div style={{ width: "130px" }}>
                              <EBelgeKodDurbun
                                tur="OZELMATRAH"
                                placeholder="kod"
                                value={satir.ozelMatrahKodu || ""}
                                onChange={(kod) => satirDegistir(i, "ozelMatrahKodu", kod)}
                                onSelect={(k) => satirDegistir(i, "ozelMatrahGerekcesi", k.ad)}
                              />
                            </div>
                            <Form.Control
                              size="sm"
                              type="number"
                              min={0}
                              step="any"
                              className="text-end font-monospace"
                              placeholder="KDV matrahı"
                              title="KDV'nin hesaplanacağı tutar (kuyumcuda: altın bedeli hariç işçilik)"
                              disabled={!satir.ozelMatrahKodu?.trim()}
                              value={satir.ozelMatrahTutari ?? ""}
                              onChange={(e) => satirDegistir(i, "ozelMatrahTutari", e.target.value === "" ? undefined : Number(e.target.value))}
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

          {/* Doğrula düğmesi kaldırıldı (yönetici isteği 16.09.2026): kaydet/gönder doğrulamayı içeride yapar */}
          <div className="d-flex align-items-center flex-wrap gap-2 mt-3">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => void (earsivMi ? yerelTaslakKaydet() : islemYap("taslak"))}
              disabled={dogrulaniyor || taslakGonderiliyor}
              className="d-flex align-items-center gap-1"
              title={earsivMi
                ? "Formu yerel taslak olarak saklar (ICE'ye ve GİB'e gitmez, numara kullanılmaz)"
                : "Belgeyi doğrular ve entegratörde taslak olarak kaydeder (GİB'e gitmez)"}
            >
              {(dogrulaniyor || taslakGonderiliyor) && islem === "taslak" ? <Spinner animation="border" size="sm" /> : <IconDeviceFloppy size={16} />}
              Taslaklara Kaydet
            </Button>
            <Button
              size="sm"
              variant="success"
              onClick={() => void islemYap(earsivMi ? "earsiv" : "gonder")}
              disabled={dogrulaniyor || taslakGonderiliyor}
              className="d-flex align-items-center gap-1"
              title={earsivMi ? "Belgeyi doğrular ve e-Arşiv faturası olarak gönderir" : "Belgeyi doğrular ve GİB'e gönderir"}
            >
              {(dogrulaniyor || taslakGonderiliyor) && islem !== "taslak" ? <Spinner animation="border" size="sm" /> : <IconSend size={16} />}
              {earsivMi ? "e-Arşiv Gönder" : "Gönder"}
            </Button>
            <Button
              size="sm"
              variant="outline-secondary"
              onClick={() => navigate("/e-belge/giden?durum=TASLAK")}
              className="d-flex align-items-center gap-1 ms-auto"
              title="Kaydedilen taslaklar: giden kutusunda Taslak süzgeciyle listelenir, oradan gönderilir veya iptal edilir"
            >
              <IconFolder size={16} />
              Taslaklara Git
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
    </div>
  );
};

export default EBelgeDogrulaPage;
