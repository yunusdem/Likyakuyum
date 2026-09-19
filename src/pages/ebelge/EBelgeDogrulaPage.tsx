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
import EBelgeCariDurbun, { CariUnvanDurbun } from "./EBelgeCariDurbun";
import EBelgeKodDurbun from "./EBelgeKodDurbun";
import { KnskFormUyarisi } from "./EBelgeKnsk";
import { CariService } from "../../services/cariService";
import { gibAliasToEposta, gibTitleToAdSoyad } from "../../utils/gibKullanici";
import {
  EBELGE_BIRIMLER,
  EBELGE_FATURA_TIPLERI,
  EBELGE_SENARYOLAR,
  ebelgeHalMi,
  ebelgeIdisMi,
  ebelgeIhracatMi,
  ebelgeIlacMi,
  ebelgeTuristMi,
  ebelgeYtbMi,
  EbelgeAliciAdres,
  EbelgeBelgeRef,
  EbelgeOkc,
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
  // ICE formundaki alıcı alanlarının tamamı (docs/ebelge-revizyon.md 2. tur, Faz 7)
  const [aliciPk, setAliciPk] = useState<string>("");
  const [aliciTel, setAliciTel] = useState<string>("");
  const [aliciFaks, setAliciFaks] = useState<string>("");
  const [aliciUlke, setAliciUlke] = useState<string>("Türkiye");
  const [aliciBinaAdi, setAliciBinaAdi] = useState<string>("");
  const [aliciBinaNo, setAliciBinaNo] = useState<string>("");
  const [aliciKapiNo, setAliciKapiNo] = useState<string>("");
  const [aliciPostaKodu, setAliciPostaKodu] = useState<string>("");
  const [aliciWeb, setAliciWeb] = useState<string>("");

  // Belge üstü ek bloklar — ICE formundaki karşılıkları (docs/ebelge-revizyon.md 2. tur Faz 8)
  const [siparisNo, setSiparisNo] = useState<string>("");
  const [siparisTarihi, setSiparisTarihi] = useState<string>("");
  const [irsaliyeler, setIrsaliyeler] = useState<EbelgeBelgeRef[]>([]);
  const [ekBelgeler, setEkBelgeler] = useState<EbelgeBelgeRef[]>([]);
  const [okc, setOkc] = useState<EbelgeOkc>({});
  const [ibanNo, setIbanNo] = useState<string>("");
  const [ekBilgiAcik, setEkBilgiAcik] = useState<boolean>(true);

  // Senaryoya özel bloklar (docs/ebelge-revizyon.md 2. tur Faz 10-12)
  const [ihracat, setIhracat] = useState<Record<string, string>>({});
  const [turist, setTurist] = useState<Record<string, string>>({});
  const [araciKurum, setAraciKurum] = useState<Record<string, string>>({});
  const [idisSevkiyatNo, setIdisSevkiyatNo] = useState<string>("");
  const [ytbNo, setYtbNo] = useState<string>("");
  const [ytbTarihi, setYtbTarihi] = useState<string>("");
  const [muafiyetSebebi, setMuafiyetSebebi] = useState<string>("");
  const [halMasraflari, setHalMasraflari] = useState<{ ad: string; tutar: number; kdvOrani?: number }[]>([]);
  const [earsivTipi, setEarsivTipi] = useState<"NORMAL" | "INTERNET">("NORMAL");
  const [earsivGonderimSekli, setEarsivGonderimSekli] = useState<"KAGIT" | "ELEKTRONIK">("ELEKTRONIK");
  /** ICE formundaki "E-arşiv faturası e-posta olarak iletilsin" onayı. */
  const [earsivMailGonder, setEarsivMailGonder] = useState<boolean>(true);
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
  /** Son mükellef sorgusunun sonucu (null = sorgulanmadı); kullanıcı türü elle değiştirirse uyarı için */
  const [gibMukellefMi, setGibMukellefMi] = useState<boolean | null>(null);
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
    yaz(a.vergiDairesi || "", "vergi dairesi", setAliciVd);
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
      setGibMukellefMi(!!cevap.mukellefMi);
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
    // Tevkifatlı satırda istisna kodu taşınmaz; KDV'si 0 olan satırda kod zorunlu olduğu için korunur.
    istisnaKodu: istisnaTipiMi || (s.kdvOrani || 0) === 0 ? s.istisnaKodu : undefined,
    istisnaGerekcesi: istisnaTipiMi || (s.kdvOrani || 0) === 0 ? s.istisnaGerekcesi : undefined,
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
    // KDV oranı kırılımı (ICE'deki Toplamlar bloğu): oran bazında matrah ve vergi
    const kirilim = new Map<number, { oran: number; matrah: number; vergi: number }>();
    for (const s of satirlar) {
      const oran = s.kdvOrani || 0;
      const brut = yuvarla((s.miktar || 0) * (s.birimFiyat || 0));
      const m = yuvarla(brut - (brut * (s.iskontoOrani || 0)) / 100);
      const vergiMatrahi = kdvMatrahi(s, m);
      const mevcut = kirilim.get(oran) || { oran, matrah: 0, vergi: 0 };
      kirilim.set(oran, {
        oran,
        matrah: yuvarla(mevcut.matrah + vergiMatrahi),
        vergi: yuvarla(mevcut.vergi + (vergiMatrahi * oran) / 100),
      });
    }
    const kdvKirilim = [...kirilim.values()].sort((a, b) => a.oran - b.oran);
    return { matrah, kdv, iskonto, tevkifat, kdvKirilim, toplam: yuvarla(matrah + kdv - tevkifat) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [satirlar, faturaTipi]);

  const satirDegistir = <K extends keyof EbelgeSatir>(i: number, alan: K, deger: EbelgeSatir[K]) => {
    setSatirlar((onceki) => onceki.map((s, idx) => (idx === i ? { ...s, [alan]: deger } : s)));
  };

  /** Alıcı bloğu — doğrulama ve gönderim aynı gövdeyi kullanır. */
  const aliciGovdesi = () => ({
    vknTckn: aliciVkn.trim(),
    unvan: aliciUnvan.trim() || undefined,
    ad: aliciAd.trim() || undefined,
    soyad: aliciSoyad.trim() || undefined,
    vergiDairesi: aliciVd.trim() || undefined,
    adres: aliciAdres.trim() || undefined,
    binaAdi: aliciBinaAdi.trim() || undefined,
    binaNo: aliciBinaNo.trim() || undefined,
    kapiNo: aliciKapiNo.trim() || undefined,
    postaKodu: aliciPostaKodu.trim() || undefined,
    il: aliciIl.trim() || undefined,
    ilce: aliciIlce.trim() || undefined,
    ulke: aliciUlke.trim() || undefined,
    telefon: aliciTel.trim() || undefined,
    faks: aliciFaks.trim() || undefined,
    eposta: aliciEposta.trim() || undefined,
    webAdresi: aliciWeb.trim() || undefined,
  });

  /** Senaryoya göre satır tablosuna eklenen kolonlar (ICE formundaki ek kolonların karşılığı). */
  const satirEkKolonlari: { alan: string; baslik: string; sayi?: boolean }[] = [];

  /**
   * İstisna ile tevkifat aynı ızgarada bulunmaz: tevkifatlı faturada istisna kodu kolonu kapanır,
   * diğer tiplerde tevkifat kolonu zaten açılmaz. Tek istisna: tevkifatlı faturada KDV'si 0 olan satır
   * kalmışsa GİB kod ister, o yüzden kolon geri gelir ve kullanıcı satırı düzeltebilir.
   */
  const sifirKdvliSatirVar = satirlar.some((s) => (s.kdvOrani || 0) === 0);
  /**
   * İstisna kodu kolonu yalnızca istisna nitelikli fatura tiplerinde açılır (yönetici isteği 20.09.2026).
   * Tek kural dışı: KDV'si 0 olan satır varsa GİB kod istediği için kolon geri gelir, yoksa kullanıcı
   * "istisna kodu zorunludur" hatasını düzeltebileceği alanı bulamaz.
   */
  const istisnaTipiMi = faturaTipi === "ISTISNA" || faturaTipi === "YTBISTISNA" || faturaTipi === "IHRACKAYITLI";
  const istisnaKolonuGorunur = istisnaTipiMi || sifirKdvliSatirVar;

  const ihracatMi = ebelgeIhracatMi(senaryo);
  const turistMi = ebelgeTuristMi(senaryo);
  const idisMi = ebelgeIdisMi(senaryo);
  const halMi = ebelgeHalMi(senaryo, faturaTipi);
  const ytbMi = ebelgeYtbMi(senaryo, faturaTipi);
  const ilacMi = ebelgeIlacMi(senaryo);
  const istisnaSebebiMi = faturaTipi === "ISTISNA" || faturaTipi === "IHRACKAYITLI" || faturaTipi === "YTBISTISNA";

  if (ihracatMi) {
    satirEkKolonlari.push(
      { alan: "gtip", baslik: "GTİP" },
      { alan: "teslimSarti", baslik: "Teslim Şartı" },
      { alan: "kapCinsi", baslik: "Eşya Kap Cinsi" },
      { alan: "kapNo", baslik: "Kap No" },
      { alan: "kapAdet", baslik: "Kap Adet", sayi: true },
    );
  }
  if (halMi) {
    satirEkKolonlari.push(
      { alan: "kunyeNo", baslik: "Künye No" },
      { alan: "malSahibi", baslik: "Mal Sahibi" },
      { alan: "malSahibiVkn", baslik: "Mal Sahibi VKN" },
    );
  }
  if (ilacMi) satirEkKolonlari.push({ alan: "ilacTibbiCihaz", baslik: "İlaç & Tıbbi Cihaz" });
  if (idisMi) satirEkKolonlari.push({ alan: "etiketNo", baslik: "Etiket No" });
  if (ytbMi) {
    satirEkKolonlari.push(
      { alan: "harcamaTipi", baslik: "Harcama Tipi" },
      { alan: "makinaAdi", baslik: "Makina Adı" },
      { alan: "makinaId", baslik: "Makina ID" },
      { alan: "makineTesvikSiraNo", baslik: "Makine Teşvik Sıra No" },
    );
  }

  /** Senaryoya özel bloklar — yalnızca ilgili senaryodayken gönderilir. */
  const senaryoGovdesi = () => {
    const dolu = (o: Record<string, string>) => {
      const temiz = Object.fromEntries(Object.entries(o).map(([k, v]) => [k, (v || "").trim()]).filter(([, v]) => v));
      return Object.keys(temiz).length ? temiz : undefined;
    };
    return {
      ihracat: ihracatMi ? dolu(ihracat) : undefined,
      turist: turistMi ? dolu(turist) : undefined,
      araciKurum: turistMi ? dolu(araciKurum) : undefined,
      idisSevkiyatNo: idisMi ? idisSevkiyatNo.trim() || undefined : undefined,
      ytb: ytbMi && (ytbNo.trim() || ytbTarihi) ? { no: ytbNo.trim() || undefined, tarih: ytbTarihi || undefined } : undefined,
      muafiyetSebebi: istisnaSebebiMi ? muafiyetSebebi.trim() || undefined : undefined,
      halMasraflari: halMi && halMasraflari.filter((m) => m.ad.trim()).length ? halMasraflari.filter((m) => m.ad.trim()) : undefined,
      earsiv: earsivMi ? { tip: earsivTipi, gonderimSekli: earsivGonderimSekli } : undefined,
    };
  };

  /** Kapalı paneldeki dolu blokların kısa özeti. */
  const ekBilgiOzeti = [
    siparisNo.trim() && "sipariş",
    irsaliyeler.some((r) => r.no?.trim()) && `${irsaliyeler.filter((r) => r.no?.trim()).length} irsaliye`,
    Object.values(okc).some((v) => (v || "").trim()) && "ÖKC",
    ekBelgeler.some((r) => r.no?.trim()) && `${ekBelgeler.filter((r) => r.no?.trim()).length} ek belge`,
    ibanNo.trim() && "IBAN",
  ].filter(Boolean).join(" · ");

  /** Sipariş / irsaliye / ÖKC / ek belge / IBAN — boş alanlar gövdeye hiç konmaz. */
  const ekBilgiGovdesi = () => {
    const dolu = (r: EbelgeBelgeRef) => r.no?.trim();
    const okcDolu = Object.values(okc).some((v) => (v || "").trim());
    return {
      siparis: siparisNo.trim() ? { no: siparisNo.trim(), tarih: siparisTarihi || undefined } : undefined,
      irsaliyeler: irsaliyeler.filter(dolu).length ? irsaliyeler.filter(dolu) : undefined,
      ekBelgeler: ekBelgeler.filter(dolu).length ? ekBelgeler.filter(dolu) : undefined,
      okc: okcDolu ? okc : undefined,
      iban: ibanNo.trim() ? { iban: ibanNo.trim(), paraBirimi: paraBirimi } : undefined,
    };
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
    if (iadeMi && !["TEMELFATURA", "TICARIFATURA", "EARSIVFATURA", "YATIRIMTESVIK", "KAMU"].includes(senaryo)) {
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
        alici: aliciGovdesi(),
        satirlar: gonderilecekSatirlar(),
        iadeFaturalar: iadeMi ? iadeFaturalar : undefined,
        dovizKuru: dovizliMi && dovizKuru ? { kur: Number(dovizKuru), tarih } : undefined,
        ...ekBilgiGovdesi(),
        ...senaryoGovdesi(),
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
      setAliciPk(t.aliciPk || ""); setAliciTel(t.aliciTel || ""); setAliciFaks(t.aliciFaks || "");
      setAliciUlke(t.aliciUlke || "Türkiye"); setAliciBinaAdi(t.aliciBinaAdi || ""); setAliciBinaNo(t.aliciBinaNo || "");
      setAliciKapiNo(t.aliciKapiNo || ""); setAliciPostaKodu(t.aliciPostaKodu || ""); setAliciWeb(t.aliciWeb || "");
      setSiparisNo(t.siparisNo || ""); setSiparisTarihi(t.siparisTarihi || "");
      setIrsaliyeler(Array.isArray(t.irsaliyeler) ? t.irsaliyeler : []);
      setEkBelgeler(Array.isArray(t.ekBelgeler) ? t.ekBelgeler : []);
      setOkc(t.okc && typeof t.okc === "object" ? t.okc : {}); setIbanNo(t.ibanNo || "");
      setIhracat(t.ihracat || {}); setTurist(t.turist || {}); setAraciKurum(t.araciKurum || {});
      setIdisSevkiyatNo(t.idisSevkiyatNo || ""); setYtbNo(t.ytbNo || ""); setYtbTarihi(t.ytbTarihi || "");
      setMuafiyetSebebi(t.muafiyetSebebi || "");
      setHalMasraflari(Array.isArray(t.halMasraflari) ? t.halMasraflari : []);
      if (t.earsivTipi) setEarsivTipi(t.earsivTipi);
      if (t.earsivGonderimSekli) setEarsivGonderimSekli(t.earsivGonderimSekli);
      if (typeof t.earsivMailGonder === "boolean") setEarsivMailGonder(t.earsivMailGonder);
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
          aliciAdres, aliciEposta, aliciPk, aliciTel, aliciFaks, aliciUlke, aliciBinaAdi, aliciBinaNo, aliciKapiNo,
          aliciPostaKodu, aliciWeb, siparisNo, siparisTarihi, irsaliyeler, ekBelgeler, okc, ibanNo,
          ihracat, turist, araciKurum, idisSevkiyatNo, ytbNo, ytbTarihi, muafiyetSebebi, halMasraflari,
          earsivTipi, earsivGonderimSekli, earsivMailGonder,
          satirlar, iadeFaturalar, dovizKuru },
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
        // PK doluysa alias olarak kullanılır; boşsa sunucu mükellef sorgusundan bulur.
        aliciAlias: aliciPk.trim() || undefined,
        senaryo: tur === "earsiv" ? ("EARSIVFATURA" as EbelgeSenaryo) : senaryo,
        faturaTipi,
        paraBirimi,
        notlar: not.trim() ? [not.trim()] : undefined,
        alici: aliciGovdesi(),
        satirlar: gonderilecekSatirlar(),
        iadeFaturalar: iadeMi ? iadeFaturalar : undefined,
        dovizKuru: dovizliMi && dovizKuru ? { kur: Number(dovizKuru), tarih } : undefined,
        ...ekBilgiGovdesi(),
        ...senaryoGovdesi(),
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
        const cevap = await ebelgeService.earsivGonder(govde);
        // Kullanıcı onayladıysa ve e-posta girilmişse belge alıcıya iletilir; hata gönderimi etkilemez.
        if (earsivMailGonder && aliciEposta.trim() && cevap.uuid) {
          await ebelgeService
            .belgeMailGonder(cevap.uuid, [{ eposta: aliciEposta.trim(), unvan: aliciUnvan.trim() || undefined }])
            .catch((e: any) =>
              setAlertInfo({ type: "warning", message: `Fatura kesildi ancak e-posta gönderilemedi: ${e?.message || ""}` })
            );
        }
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
        pageTitle="e-Belge Doğrulama"
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
              {/* Tür mükellef sorgusuna göre kendiliğinden seçilir; kullanıcı yine de değiştirebilir, GİB sonucundan farklıysa uyarılır. */}
              <Form.Select
                size="sm"
                value={formModu}
                title={sorgulananVkn ? "Tür, mükellef sorgusunun sonucuna göre seçildi; gerekirse değiştirebilirsiniz." : undefined}
                onChange={(e) => setSenaryo(EBELGE_SENARYOLAR[e.target.value as EbelgeFormModu][e.target.value === "EFATURA" ? 1 : 0].kod)}
              >
                <option value="EFATURA">e-Fatura</option>
                <option value="EARSIV">e-Arşiv</option>
              </Form.Select>
              {sorgulananVkn && aliciVkn.trim() === sorgulananVkn && gibMukellefMi !== null && (formModu === "EFATURA") !== gibMukellefMi && (
                <div className="small text-danger mt-1">
                  {gibMukellefMi ? "GİB: alıcı e-Fatura mükellefi; e-Arşiv düzenlenemez." : "GİB: alıcı e-Fatura mükellefi değil; e-Fatura reddedilebilir."}
                </div>
              )}
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

          {/* ICE formundaki Sipariş / İrsaliye / ÖKC / EK Belge / IBAN blokları — hepsi isteğe bağlı,
              boş bırakılırsa belgeye hiç yazılmaz (docs/ebelge-revizyon.md 2. tur Faz 8). */}

          {/* Senaryoya / fatura tipine göre açılan bloklar — ICE formundaki karşılıklarıyla
              (docs/ebelge-revizyon.md 2. tur Faz 10-12). */}
          {earsivMi && (
            <Row className="g-2 mt-1">
              <Col xs={6} md={3} lg={2}>
                <Form.Label className="small mb-1">E-arşiv Tipi</Form.Label>
                <Form.Select size="sm" value={earsivTipi} onChange={(e) => setEarsivTipi(e.target.value as "NORMAL" | "INTERNET")}>
                  <option value="NORMAL">Normal</option>
                  <option value="INTERNET">İnternet</option>
                </Form.Select>
              </Col>
              <Col xs={6} md={3} lg={2}>
                <Form.Label className="small mb-1">Gönderim Şekli</Form.Label>
                <Form.Select size="sm" value={earsivGonderimSekli}
                  onChange={(e) => setEarsivGonderimSekli(e.target.value as "KAGIT" | "ELEKTRONIK")}>
                  <option value="ELEKTRONIK">Elektronik</option>
                  <option value="KAGIT">Kağıt</option>
                </Form.Select>
              </Col>
              <Col xs={12} md={6} lg={4} className="d-flex align-items-end">
                <Form.Check
                  type="checkbox"
                  id="earsiv-mail-gonder"
                  className="small mb-1"
                  checked={earsivMailGonder}
                  onChange={(e) => setEarsivMailGonder(e.target.checked)}
                  label={aliciEposta.trim()
                    ? "E-arşiv faturası e-posta olarak iletilsin"
                    : "E-arşiv faturası e-posta olarak iletilsin (alıcı e-postası boş)"}
                />
              </Col>
            </Row>
          )}

          {ihracatMi && (
            <>
              <div className="fw-semibold mt-3 mb-1" style={{ fontSize: "12.5px" }}>İhracat Yapılacak Firma Bilgileri</div>
              <Row className="g-2">
                {([["firmaUnvani", "Firma Unvanı"], ["vkn", "VKN"], ["ulke", "Ülke"], ["sehir", "Şehir"],
                   ["ilce", "İlçe"], ["teslimSarti", "Teslim Şartı"], ["gonderimSekli", "Gönderim Şekli"]] as const).map(([alan, etiket]) => (
                  <Col xs={6} md={3} lg={2} key={alan}>
                    <Form.Label className="small mb-1">
                      {etiket} {alan === "firmaUnvani" && <span className="text-danger">*</span>}
                    </Form.Label>
                    <Form.Control size="sm" maxLength={300} value={ihracat[alan] || ""}
                      onChange={(e) => setIhracat((o) => ({ ...o, [alan]: e.target.value }))} />
                  </Col>
                ))}
              </Row>
            </>
          )}

          {turistMi && (
            <>
              <div className="fw-semibold mt-3 mb-1" style={{ fontSize: "12.5px" }}>Turist Bilgileri</div>
              <Row className="g-2">
                {([["ad", "Adı"], ["soyad", "Soyadı"], ["ulke", "Ülke"], ["uyruk", "Uyruk"], ["sehir", "Şehir"],
                   ["ilce", "İlçe"], ["pasaportNo", "Pasaport No"]] as const).map(([alan, etiket]) => (
                  <Col xs={6} md={3} lg={2} key={alan}>
                    <Form.Label className="small mb-1">
                      {etiket} {["ad", "soyad", "pasaportNo"].includes(alan) && <span className="text-danger">*</span>}
                    </Form.Label>
                    <Form.Control size="sm" maxLength={100} value={turist[alan] || ""}
                      onChange={(e) => setTurist((o) => ({ ...o, [alan]: e.target.value }))} />
                  </Col>
                ))}
                <Col xs={6} md={3} lg={2}>
                  <Form.Label className="small mb-1">Pasaport Tarihi</Form.Label>
                  <Form.Control size="sm" type="date" className="custom-date-input" value={turist.pasaportTarihi || ""}
                    onChange={(e) => setTurist((o) => ({ ...o, pasaportTarihi: e.target.value }))} />
                </Col>
              </Row>

              <div className="fw-semibold mt-3 mb-1" style={{ fontSize: "12.5px" }}>Turist Hesap Bilgileri</div>
              <Row className="g-2">
                {([["bankaAdi", "Banka Adı"], ["subeAdi", "Şube Adı"], ["hesapNo", "Hesap No / IBAN"],
                   ["hesapParaBirimi", "Para Birimi"], ["odemeNotu", "Ödeme Notu"]] as const).map(([alan, etiket]) => (
                  <Col xs={6} md={3} lg={2} key={alan}>
                    <Form.Label className="small mb-1">{etiket}</Form.Label>
                    <Form.Control size="sm" maxLength={300} value={turist[alan] || ""}
                      onChange={(e) => setTurist((o) => ({ ...o, [alan]: e.target.value }))} />
                  </Col>
                ))}
              </Row>

              <div className="fw-semibold mt-3 mb-1" style={{ fontSize: "12.5px" }}>Aracı Kurum Bilgileri</div>
              <Row className="g-2">
                {([["vknTckn", "Vergi D. / VKN-TCKN"], ["pk", "PK"], ["unvan", "Unvan"],
                   ["ulke", "Ülke"], ["sehir", "Şehir"], ["ilce", "İlçe"]] as const).map(([alan, etiket]) => (
                  <Col xs={6} md={3} lg={2} key={alan}>
                    <Form.Label className="small mb-1">{etiket}</Form.Label>
                    <Form.Control size="sm" maxLength={300} value={araciKurum[alan] || ""}
                      onChange={(e) => setAraciKurum((o) => ({ ...o, [alan]: e.target.value }))} />
                  </Col>
                ))}
              </Row>
            </>
          )}

          {(idisMi || ytbMi || istisnaSebebiMi) && (
            <Row className="g-2 mt-1">
              {idisMi && (
                <Col xs={12} md={4} lg={3}>
                  <Form.Label className="small mb-1">Sevkiyat Numarası <span className="text-danger">*</span></Form.Label>
                  <Form.Control size="sm" maxLength={50} value={idisSevkiyatNo} onChange={(e) => setIdisSevkiyatNo(e.target.value)} />
                </Col>
              )}
              {ytbMi && (
                <>
                  <Col xs={6} md={3} lg={2}>
                    <Form.Label className="small mb-1">YTB No</Form.Label>
                    <Form.Control size="sm" maxLength={50} value={ytbNo} onChange={(e) => setYtbNo(e.target.value)} />
                  </Col>
                  <Col xs={6} md={3} lg={2}>
                    <Form.Label className="small mb-1">YTB Tarihi</Form.Label>
                    <Form.Control size="sm" type="date" className="custom-date-input" value={ytbTarihi}
                      onChange={(e) => setYtbTarihi(e.target.value)} />
                  </Col>
                </>
              )}
              {istisnaSebebiMi && (
                <Col xs={12} md={6} lg={4}>
                  <Form.Label className="small mb-1">
                    {faturaTipi === "IHRACKAYITLI" ? "İhraç Kayıtlı Fatura Sebebi" : "KDV İstisna Muafiyet Sebebi"}
                  </Form.Label>
                  <Form.Control size="sm" maxLength={300} value={muafiyetSebebi}
                    onChange={(e) => setMuafiyetSebebi(e.target.value)}
                    placeholder="Satırda gerekçe yoksa bu açıklama kullanılır" />
                </Col>
              )}
            </Row>
          )}

          {halMi && (
            <>
              <div className="d-flex align-items-center gap-2 mt-3 mb-1">
                <span className="fw-semibold" style={{ fontSize: "12.5px" }}>Masraflar</span>
                <Button size="sm" variant="outline-secondary" className="py-0"
                  onClick={() => setHalMasraflari((o) => [...o, { ad: "", tutar: 0 }])}>
                  <IconPlus size={13} /> Masraf Ekle
                </Button>
              </div>
              {!halMasraflari.length && <div className="small text-secondary">Komisyon, navlun, hammaliye gibi masrafları buradan ekleyin.</div>}
              {halMasraflari.map((m, i) => (
                <Row className="g-2 mb-1 align-items-end" key={`masraf-${i}`}>
                  <Col xs={6} md={4} lg={3}>
                    <Form.Label className="small mb-1">Masraf</Form.Label>
                    <Form.Control size="sm" maxLength={100} value={m.ad} placeholder="Komisyon / Navlun / Hammaliye"
                      onChange={(e) => setHalMasraflari((o) => o.map((r, j) => (j === i ? { ...r, ad: e.target.value } : r)))} />
                  </Col>
                  <Col xs={6} md={3} lg={2}>
                    <Form.Label className="small mb-1">Tutar</Form.Label>
                    <Form.Control size="sm" type="number" min={0} step="any" className="text-end font-monospace" value={m.tutar}
                      onChange={(e) => setHalMasraflari((o) => o.map((r, j) => (j === i ? { ...r, tutar: Number(e.target.value) } : r)))} />
                  </Col>
                  <Col xs={6} md={3} lg={2}>
                    <Form.Label className="small mb-1">KDV %</Form.Label>
                    <Form.Control size="sm" type="number" min={0} max={100} className="text-end font-monospace" value={m.kdvOrani ?? ""}
                      onChange={(e) => setHalMasraflari((o) => o.map((r, j) => (j === i ? { ...r, kdvOrani: e.target.value === "" ? undefined : Number(e.target.value) } : r)))} />
                  </Col>
                  <Col xs="auto">
                    <Button size="sm" variant="link" className="p-0" style={{ color: "#dc2626" }} title="Masrafı sil"
                      onClick={() => setHalMasraflari((o) => o.filter((_, j) => j !== i))}>
                      <IconTrash size={16} />
                    </Button>
                  </Col>
                </Row>
              ))}
            </>
          )}

          {/* ICE'de bu bloklar her belgede açık durur; biz de açık gösteriyoruz (yönetici isteği 20.09.2026). */}
          <div className="d-flex align-items-center gap-2 mt-3 mb-2">
            <span className="fw-semibold" style={{ fontSize: "13px" }}>
              Sipariş · İrsaliye · ÖKC · EK Belge · IBAN
            </span>
            <Button size="sm" variant="link" className="p-0" onClick={() => setEkBilgiAcik((a) => !a)}>
              {ekBilgiAcik ? "gizle" : "göster"}
            </Button>
            {!ekBilgiAcik && ekBilgiOzeti && <span className="small text-secondary">({ekBilgiOzeti})</span>}
          </div>

          {ekBilgiAcik && (
            <div className="border rounded-2 p-2 mb-2">
              <Row className="g-2">
                <Col xs={6} md={3} lg={2}>
                  <Form.Label className="small mb-1">Sipariş No</Form.Label>
                  <Form.Control size="sm" value={siparisNo} maxLength={50} onChange={(e) => setSiparisNo(e.target.value)} />
                </Col>
                <Col xs={6} md={3} lg={2}>
                  <Form.Label className="small mb-1">Sipariş Tarihi</Form.Label>
                  <Form.Control size="sm" type="date" className="custom-date-input" value={siparisTarihi}
                    onChange={(e) => setSiparisTarihi(e.target.value)} />
                </Col>
                <Col xs={12} md={6} lg={3}>
                  <Form.Label className="small mb-1">IBAN</Form.Label>
                  <Form.Control size="sm" className="font-monospace" value={ibanNo} maxLength={34}
                    placeholder="TR.." onChange={(e) => setIbanNo(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))} />
                </Col>
                <Col xs={6} md={3} lg={2}>
                  <Form.Label className="small mb-1">IBAN Para Birimi</Form.Label>
                  <Form.Control size="sm" value={paraBirimi} disabled title="Belgenin para birimiyle aynıdır." />
                </Col>
              </Row>

              <div className="fw-semibold mt-3 mb-1" style={{ fontSize: "12.5px" }}>ÖKC Bilgisi</div>
              <Row className="g-2">
                {([
                  ["fisNo", "Fiş No", "text"], ["fisTipi", "Fiş Tipi", "text"], ["fisTarihi", "Fiş Tarihi", "date"],
                  ["fisSaati", "Fiş Saati", "time"], ["okcNo", "ÖKC No", "text"], ["zNo", "Z No", "text"],
                ] as const).map(([alan, etiket, tip]) => (
                  <Col xs={6} md={3} lg={2} key={alan}>
                    <Form.Label className="small mb-1">{etiket}</Form.Label>
                    <Form.Control size="sm" type={tip} className={tip === "date" ? "custom-date-input" : undefined}
                      maxLength={50} value={(okc as any)[alan] || ""}
                      onChange={(e) => setOkc((o) => ({ ...o, [alan]: e.target.value }))} />
                  </Col>
                ))}
              </Row>

              {([
                ["irsaliye", "İrsaliye Bilgileri", irsaliyeler, setIrsaliyeler, false],
                ["ek", "EK Belge", ekBelgeler, setEkBelgeler, true],
              ] as const).map(([anahtar, baslik, liste, setListe, detayli]) => (
                <div key={anahtar}>
                  <div className="d-flex align-items-center gap-2 mt-3 mb-1">
                    <span className="fw-semibold" style={{ fontSize: "12.5px" }}>{baslik}</span>
                    <Button size="sm" variant="outline-secondary" className="py-0"
                      onClick={() => (setListe as (f: (o: EbelgeBelgeRef[]) => EbelgeBelgeRef[]) => void)((o) => [...o, { no: "", tarih: "" }])}>
                      <IconPlus size={13} /> Ekle
                    </Button>
                  </div>
                  {!liste.length && <div className="small text-secondary">Kayıt yok.</div>}
                  {liste.map((satir, i) => (
                    <Row className="g-2 mb-1 align-items-end" key={`${anahtar}-${i}`}>
                      <Col xs={6} md={3} lg={2}>
                        <Form.Label className="small mb-1">{detayli ? "Belge No" : "İrsaliye No"}</Form.Label>
                        <Form.Control size="sm" value={satir.no} maxLength={50}
                          onChange={(e) => (setListe as any)((o: EbelgeBelgeRef[]) => o.map((r, j) => (j === i ? { ...r, no: e.target.value } : r)))} />
                      </Col>
                      <Col xs={6} md={3} lg={2}>
                        <Form.Label className="small mb-1">Tarih</Form.Label>
                        <Form.Control size="sm" type="date" className="custom-date-input" value={satir.tarih || ""}
                          onChange={(e) => (setListe as any)((o: EbelgeBelgeRef[]) => o.map((r, j) => (j === i ? { ...r, tarih: e.target.value } : r)))} />
                      </Col>
                      {detayli && ([["ad", "Belge Adı"], ["tur", "Belge Türü"], ["turKodu", "Belge Tür Kodu"]] as const).map(([alan, etiket]) => (
                        <Col xs={6} md={3} lg={2} key={alan}>
                          <Form.Label className="small mb-1">{etiket}</Form.Label>
                          <Form.Control size="sm" maxLength={200} value={(satir as any)[alan] || ""}
                            onChange={(e) => (setListe as any)((o: EbelgeBelgeRef[]) => o.map((r, j) => (j === i ? { ...r, [alan]: e.target.value } : r)))} />
                        </Col>
                      ))}
                      <Col xs="auto">
                        <Button size="sm" variant="link" className="p-0" style={{ color: "#dc2626" }} title="Satırı sil"
                          onClick={() => (setListe as any)((o: EbelgeBelgeRef[]) => o.filter((_, j) => j !== i))}>
                          <IconTrash size={16} />
                        </Button>
                      </Col>
                    </Row>
                  ))}
                </div>
              ))}
            </div>
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
            setAliciTel((cari.telefon || "").trim());
            setAliciPk((cari.eFaturaPostaKutusu || "").trim());
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
            <Col xs={12} md={6} lg={4}>
              <Form.Label className="small mb-1">
                Unvan {!tcknMi && <span className="text-danger">*</span>}
              </Form.Label>
              <CariUnvanDurbun value={aliciUnvan} onChange={setAliciUnvan} onSelect={(cari, lookups) => {
                setCariSecimAcik(false);
                setAliciVkn(cari.vergiKimlikNo?.trim() || "");
                setAliciUnvan(cari.ad);
                const parcalar = cari.ad.trim().split(/\s+/);
                setAliciSoyad(parcalar.length > 1 ? parcalar.pop()! : "");
                setAliciAd(parcalar.join(" "));
                setAliciIl(lookups.ilList.find((x) => x.id === cari.ilId)?.ad || "");
                setAliciIlce(lookups.ilceList.find((x) => x.id === cari.ilceId)?.ad || "");
                setAliciVd(lookups.vergiDairesiList.find((x) => x.id === cari.vergiDairesiId)?.ad || "");
                setAliciEposta((cari.eposta || "").trim());
                setAliciAdres((cari.adres || "").trim());
                setAliciTel((cari.telefon || "").trim());
                setAliciPk((cari.eFaturaPostaKutusu || "").trim());
                setIceAdresler([]);
                setAlertInfo({ type: "info", message: "Cari seçildi. Ad soyad ve adresi kontrol edip Mükellef Sorgula ile belge türünü belirleyin." });
              }} />
            </Col>
            <Col xs={6} md={3} lg={2}>
              <Form.Label className="small mb-1">Ad {tcknMi && <span className="text-danger">*</span>}</Form.Label>
              <Form.Control size="sm" value={aliciAd} onChange={(e) => setAliciAd(e.target.value)} />
            </Col>
            <Col xs={6} md={3} lg={2}>
              <Form.Label className="small mb-1">Soyad {tcknMi && <span className="text-danger">*</span>}</Form.Label>
              <Form.Control size="sm" value={aliciSoyad} onChange={(e) => setAliciSoyad(e.target.value)} />
            </Col>
            <Col xs={6} md={3} lg={2}>
              <Form.Label className="small mb-1">PK (posta kutusu)</Form.Label>
              <Form.Control size="sm" className="font-monospace" value={aliciPk} maxLength={150}
                onChange={(e) => setAliciPk(e.target.value.trim())}
                placeholder="boşsa GİB'den bulunur"
                title="Alıcının GİB posta kutusu etiketi. Boş bırakılırsa mükellef sorgusundan bulunur." />
            </Col>
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
            <Col xs={6} md={3} lg={2}>
              <Form.Label className="small mb-1">Ülke</Form.Label>
              <Form.Control size="sm" value={aliciUlke} maxLength={100} onChange={(e) => setAliciUlke(e.target.value)} />
            </Col>
            <Col xs={12} md={6} lg={4}>
              <Form.Label className="small mb-1">Mahalle / Cadde / Sokak</Form.Label>
              <Form.Control size="sm" value={aliciAdres} maxLength={300} onChange={(e) => setAliciAdres(e.target.value)} />
            </Col>
            <Col xs={6} md={3} lg={2}>
              <Form.Label className="small mb-1">Bina Adı</Form.Label>
              <Form.Control size="sm" value={aliciBinaAdi} maxLength={150} onChange={(e) => setAliciBinaAdi(e.target.value)} />
            </Col>
            <Col xs={6} md={3} lg={1}>
              <Form.Label className="small mb-1">Bina No</Form.Label>
              <Form.Control size="sm" value={aliciBinaNo} maxLength={50} onChange={(e) => setAliciBinaNo(e.target.value)} />
            </Col>
            <Col xs={6} md={3} lg={1}>
              <Form.Label className="small mb-1">Kapı No</Form.Label>
              <Form.Control size="sm" value={aliciKapiNo} maxLength={50} onChange={(e) => setAliciKapiNo(e.target.value)} />
            </Col>
            <Col xs={6} md={3} lg={2}>
              <Form.Label className="small mb-1">Posta Kodu</Form.Label>
              <Form.Control size="sm" className="font-monospace" value={aliciPostaKodu} maxLength={10}
                onChange={(e) => setAliciPostaKodu(e.target.value.replace(/\D/g, ""))} />
            </Col>
            <Col xs={6} md={3} lg={2}>
              <Form.Label className="small mb-1">Telefon</Form.Label>
              <Form.Control size="sm" value={aliciTel} maxLength={50} onChange={(e) => setAliciTel(e.target.value)} />
            </Col>
            <Col xs={6} md={3} lg={2}>
              <Form.Label className="small mb-1">Faks</Form.Label>
              <Form.Control size="sm" value={aliciFaks} maxLength={50} onChange={(e) => setAliciFaks(e.target.value)} />
            </Col>
            <Col xs={12} md={6} lg={3}>
              <Form.Label className="small mb-1">Web Sitesi</Form.Label>
              <Form.Control size="sm" value={aliciWeb} maxLength={200} onChange={(e) => setAliciWeb(e.target.value)} />
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
                  <th style={{ width: "110px" }}>Hizmet Kodu</th>
                  <th>Mal / Hizmet</th>
                  <th style={{ width: "150px" }}>Satır Not</th>
                  <th style={{ width: "100px" }}>Miktar</th>
                  <th style={{ width: "110px" }}>Birim</th>
                  <th style={{ width: "130px" }}>Birim Fiyat</th>
                  <th style={{ width: "100px" }}>İsk. %</th>
                  <th style={{ width: "120px" }}>İskonto Tutarı</th>
                  <th style={{ width: "100px" }}>KDV %</th>
                  {istisnaKolonuGorunur && <th style={{ width: "170px" }}>İstisna Kodu</th>}
                  {tevkifatliMi && <th style={{ width: "190px" }}>Tevkifat</th>}
                  {ozelMatrahMi && <th style={{ width: "250px" }}>Özel Matrah (kod / KDV matrahı)</th>}
                  {satirEkKolonlari.map((k) => (
                    <th key={k.alan} style={{ width: "130px" }}>{k.baslik}</th>
                  ))}
                  <th style={{ width: "120px" }} className="text-end">KDV Tutarı</th>
                  <th style={{ width: "130px" }} className="text-end">Tutar</th>
                  <th style={{ width: "50px" }} />
                </tr>
              </thead>
              <tbody>
                {satirlar.map((satir, i) => {
                  const brut = (satir.miktar || 0) * (satir.birimFiyat || 0);
                  const satirIskonto = satir.iskontoTutari != null ? satir.iskontoTutari : (brut * (satir.iskontoOrani || 0)) / 100;
                  const matrah = brut - satirIskonto;
                  const satirKdv = (kdvMatrahi(satir, matrah) * (satir.kdvOrani || 0)) / 100;
                  return (
                    <tr key={i}>
                      <td className="text-secondary">{i + 1}</td>
                      <td>
                        <Form.Control
                          size="sm"
                          className="font-monospace"
                          maxLength={50}
                          value={satir.hizmetKodu || ""}
                          onChange={(e) => satirDegistir(i, "hizmetKodu", e.target.value)}
                          title="Satıcının kendi mal/hizmet kodu (isteğe bağlı)"
                        />
                      </td>
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
                          maxLength={500}
                          value={satir.not || ""}
                          onChange={(e) => satirDegistir(i, "not", e.target.value)}
                          title="Bu satıra özel not (isteğe bağlı)"
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
                          disabled={satir.iskontoTutari != null}
                          onChange={(e) => satirDegistir(i, "iskontoOrani", Number(e.target.value))}
                        />
                      </td>
                      <td>
                        {/* Tutar girilirse oran yerine bu kullanılır; boşaltılınca orana geri dönülür. */}
                        <Form.Control
                          size="sm"
                          type="number"
                          min={0}
                          step="any"
                          className="text-end font-monospace"
                          value={satir.iskontoTutari ?? ""}
                          placeholder={(Math.round(((brut * (satir.iskontoOrani || 0)) / 100) * 100) / 100).toString()}
                          onChange={(e) => satirDegistir(i, "iskontoTutari", e.target.value === "" ? undefined : Number(e.target.value))}
                          title="Elle iskonto tutarı. Doluyken İsk.% kapanır."
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
                      {istisnaKolonuGorunur && (
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
                      )}
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
                      {satirEkKolonlari.map((k) => (
                        <td key={k.alan}>
                          <Form.Control
                            size="sm"
                            type={k.sayi ? "number" : "text"}
                            min={k.sayi ? 0 : undefined}
                            className={k.sayi ? "text-end font-monospace" : undefined}
                            maxLength={k.sayi ? undefined : 150}
                            value={(satir as any)[k.alan] ?? ""}
                            onChange={(e) =>
                              satirDegistir(i, k.alan as keyof EbelgeSatir,
                                (k.sayi ? (e.target.value === "" ? undefined : Number(e.target.value)) : e.target.value) as any)
                            }
                          />
                        </td>
                      ))}
                      <td className="text-end font-monospace text-secondary">{ebelgeTutar(satirKdv, paraBirimi)}</td>
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

          {/* KDV oranı kırılımı — ICE'deki "Toplamlar" bloğunun KDV(%1)…KDV(%20) satırlarının karşılığı */}
          {yerelToplam.kdvKirilim.length > 1 && (
            <div className="d-flex flex-wrap justify-content-end gap-3 mt-2 small text-secondary">
              {yerelToplam.kdvKirilim.map((g) => (
                <span key={g.oran}>
                  KDV(%{g.oran}): <span className="font-monospace">{ebelgeTutar(g.vergi, paraBirimi)}</span>
                  <span className="ms-1">(matrah {ebelgeTutar(g.matrah, paraBirimi)})</span>
                </span>
              ))}
            </div>
          )}

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
