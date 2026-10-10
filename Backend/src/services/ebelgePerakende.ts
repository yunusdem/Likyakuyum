import { ApiError } from "../utils/ApiError.js";
import { GiderPusulasiGirdi } from "./ice/ubl/giderPusulasiBuilder.js";
import { FaturaTipi, UblFaturaGirdi, UblFaturaSatiri, hesapla } from "./ice/ubl/invoiceBuilder.js";

/**
 * Perakende fişi (TODVZ_FATURA) → e-Belge girdisi — docs/PERAKENDE_EBELGE_YOL_HARITASI.md (P1, P2, P9, P10, P12).
 * Saf dönüşüm: veritabanına ve ICE'ye dokunmaz; saf mantık testiyle sınanır.
 *
 * Satış fişi → e-Arşiv / e-Fatura (UblFaturaGirdi). Alış fişi → e-Gider pusulası (GiderPusulasiGirdi).
 * KDV / istisna mantığı Sarraf fişindeki gibidir (P2): %0 satır firma tanımındaki KDV muafiyet koduyla, KDV'si
 * tam matrahtan küçük hesaplanmış satır özel matrah 805 ile gider.
 */

export const PERAKENDE_EVRAK_TURU = 98;
export const NIHAI_TUKETICI = "11111111111";
/** Kuyumcuda altın bedeli hariç işçilik üzerinden KDV: GİB özel matrah kodu 805 */
export const OZEL_MATRAH_ALTIN = { kod: "805", gerekce: "Altından mamul veya altın içeren ziynet eşyaları ile sikke altınların teslimi" };

export interface PerakendeBaslik {
  FATURA_ID: number;
  FATURA_NO: string;
  ETTN?: string | null;
  TARIH: Date | string;
  /** 0 alış · 1 satış · 2 iade */
  FATURA_TIPI: number;
  SENARYO?: string | null;
  ALICI_VKN_TCKN?: string | null;
  ALICI_UNVAN?: string | null;
  ADRES?: string | null;
  ILCE?: string | null;
  IL?: string | null;
  VERGI_DAIRESI?: string | null;
  EPOSTA?: string | null;
  TELEFON?: string | null;
  PARA_KODU?: string | null;
  ARA_TOPLAM?: number | null;
  TOPLAM_KDV?: number | null;
  ISKONTO_TUTARI?: number | null;
  GENEL_TOPLAM?: number | null;
  /** Firma e-Belge tanımı (VODVZ_E_BELGE_TANIMI): %0 satırların istisna kodu */
  E_FATURA_KDV_MUAFIYET_KODU?: string | null;
  E_FATURA_KDV_MUAFIYET_ADI?: string | null;
}

export interface PerakendeSatir {
  SATIR_NO: number;
  URUN_ADI?: string | null;
  AYAR?: string | null;
  BARKOD?: string | null;
  MIKTAR?: number | null;
  BIRIM?: string | null;
  GRAM?: number | null;
  HAS_GRAM?: number | null;
  BIRIM_FIYAT?: number | null;
  TUTAR?: number | null;
  KDV_ORANI?: number | null;
  KDV_TUTARI?: number | null;
}

const temiz = (v: unknown): string => String(v ?? "").trim();
const yuvarla = (n: number): number => Math.round(n * 100) / 100;
const sayi = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export const BELGE_NO_BICIMI = /^[A-Z0-9]{3}\d{13}$/;

/** UN/ECE birim kodu (P12) */
export const birimKodu = (birim: unknown): string => {
  const b = temiz(birim).toLocaleUpperCase("tr-TR");
  // Zaten UN/ECE kodu gelmişse (Sarraf satır görünümü GRM / NIU verir) olduğu gibi kalır
  if (/^(GRM|KGM|C62|NIU)$/.test(b)) return b;
  if (/^(GR|GRAM|G)$/.test(b)) return "GRM";
  if (/^(KG|KILOGRAM)$/.test(b)) return "KGM";
  return "C62";
};

/** Alıcı adı → ad / soyad (gerçek kişi); tüzel kişide boş */
const adSoyad = (unvan: string, vkn: string): { ad: string; soyad: string } => {
  if (vkn.length === 10) return { ad: "", soyad: "" };
  const parcalar = unvan.split(/\s+/).filter(Boolean);
  const soyad = parcalar.length > 1 ? parcalar.pop()! : "";
  return { ad: parcalar.join(" "), soyad };
};

const aliciTarafi = (b: PerakendeBaslik) => {
  const vkn = temiz(b.ALICI_VKN_TCKN).replace(/\D/g, "") || NIHAI_TUKETICI;
  if (vkn.length !== 10 && vkn.length !== 11) throw ApiError.badRequest("Alıcı VKN / TCKN 10 ya da 11 hane olmalıdır; fişi düzeltin.");
  const unvan = temiz(b.ALICI_UNVAN) || "NİHAİ TÜKETİCİ";
  const { ad, soyad } = adSoyad(unvan, vkn);
  return {
    vknTckn: vkn,
    unvan,
    ad,
    soyad,
    vergiDairesi: temiz(b.VERGI_DAIRESI) || undefined,
    adres: temiz(b.ADRES) || undefined,
    ilce: temiz(b.ILCE) || undefined,
    il: temiz(b.IL) || undefined,
    telefon: temiz(b.TELEFON) || undefined,
    eposta: temiz(b.EPOSTA) || undefined,
  };
};

/** Ortak ön kontroller (satış ve alış) */
const onKontrol = (b: PerakendeBaslik, satirlar: PerakendeSatir[]): string => {
  const belgeNo = temiz(b.FATURA_NO).toUpperCase();
  if (!BELGE_NO_BICIMI.test(belgeNo)) {
    throw ApiError.badRequest(`Fiş numarası GİB biçiminde değil (${belgeNo || "boş"}); 3 karakter seri + yıl + 9 hane olmalı. Fiş yeni numaratörle yeniden kesilmelidir.`);
  }
  const para = temiz(b.PARA_KODU) || "TL";
  if (!["TL", "TRY"].includes(para)) throw ApiError.badRequest("Dövizli Perakende fişi için kur eşlemesi doğrulanmadan gönderim yapılamaz.");
  if (!satirlar.length) throw ApiError.badRequest("Fişin ürün satırı bulunamadı.");
  return belgeNo;
};

const tarihYaz = (t: Date | string): string => {
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) throw ApiError.badRequest("Fiş tarihi okunamadı.");
  return d.toISOString().slice(0, 10);
};

/**
 * Toplam iskontoyu satırlara tutar oranında dağıtır (P10); kuruş artığı son satıra yazılır.
 * Döner: satır başına iskonto tutarı.
 */
export const iskontoDagit = (tutarlar: number[], toplamIskonto: number): number[] => {
  const iskonto = yuvarla(Math.max(0, toplamIskonto));
  const toplam = tutarlar.reduce((t, x) => t + x, 0);
  if (!iskonto || toplam <= 0) return tutarlar.map(() => 0);
  const paylar = tutarlar.map((t) => yuvarla((iskonto * t) / toplam));
  const dagilan = paylar.reduce((t, x) => t + x, 0);
  paylar[paylar.length - 1] = yuvarla(paylar[paylar.length - 1] + (iskonto - dagilan));
  return paylar;
};

/**
 * Satış fişi → e-Fatura / e-Arşiv girdisi. Senaryo burada belirlenmez (mükellefiyet sorgusu çağıranda);
 * nihai tüketicide EARSIVFATURA sabittir (P9).
 */
export function perakendeFaturaGirdisi(kaynak: { baslik: PerakendeBaslik; satirlar: PerakendeSatir[] }): Omit<UblFaturaGirdi, "gonderici"> {
  const b = kaynak.baslik;
  if (Number(b.FATURA_TIPI) !== 1) throw ApiError.badRequest("Bu fiş satış fişi değil.");
  const belgeNo = onKontrol(b, kaynak.satirlar);
  const istisnaKodu = temiz(b.E_FATURA_KDV_MUAFIYET_KODU);
  const istisnaGerekcesi = temiz(b.E_FATURA_KDV_MUAFIYET_ADI);

  const tutarlar = kaynak.satirlar.map((s) => yuvarla(sayi(s.TUTAR)));
  const iskontolar = iskontoDagit(tutarlar, sayi(b.ISKONTO_TUTARI));
  let ozelMatrahVar = false;
  let istisnaVar = false;

  const satirlar: UblFaturaSatiri[] = kaynak.satirlar.map((s, i) => {
    const miktar = sayi(s.MIKTAR) || 1;
    const tutar = tutarlar[i];
    const kdvOrani = sayi(s.KDV_ORANI);
    const kdvTutari = yuvarla(sayi(s.KDV_TUTARI));
    if (miktar <= 0 || tutar < 0) throw ApiError.badRequest(`${i + 1}. satırda miktar / tutar geçersiz.`);
    const birimFiyat = yuvarla(tutar / miktar);
    if (Math.abs(yuvarla(miktar * birimFiyat) - tutar) > 0.011) {
      throw ApiError.badRequest(`${i + 1}. satırın tutarı miktar × birim fiyat ile uyuşmuyor (${tutar} ≠ ${miktar} × ${birimFiyat}); gönderim durduruldu.`);
    }
    const ad = [temiz(s.URUN_ADI) || "Ürün", temiz(s.AYAR) ? `${temiz(s.AYAR)} ayar` : ""].filter(Boolean).join(" ");
    const satir: UblFaturaSatiri = { ad, miktar, birimKodu: birimKodu(s.BIRIM), birimFiyat, kdvOrani, ...(iskontolar[i] > 0 ? { iskontoTutari: iskontolar[i] } : {}) };

    if (kdvOrani === 0) {
      // Sarraf'taki kural: %0 satır firma tanımındaki muafiyet koduyla gider (P2)
      if (!istisnaKodu) throw ApiError.badRequest(`${i + 1}. satır KDV'siz ama firma e-Belge tanımında KDV muafiyet kodu yok. Ayarlar › Firma Tanımı'nda istisna kodunu girin.`);
      istisnaVar = true;
      return { ...satir, istisnaKodu, istisnaGerekcesi };
    }
    // KDV tam matrahtan hesaplanmışsa normal satır; daha küçük matrahtan hesaplanmışsa özel matrah 805 (altın bedeli hariç)
    const matrah = yuvarla(tutar - iskontolar[i]);
    const tamKdv = yuvarla((matrah * kdvOrani) / 100);
    if (Math.abs(tamKdv - kdvTutari) <= 0.011) return satir;
    if (kdvTutari > tamKdv + 0.011) throw ApiError.badRequest(`${i + 1}. satırın KDV tutarı (${kdvTutari}) oranla (${kdvOrani}%) hesaplanandan büyük; fişi düzeltin.`);
    ozelMatrahVar = true;
    const ozelMatrahTutari = yuvarla((kdvTutari * 100) / kdvOrani);
    return { ...satir, ozelMatrahKodu: OZEL_MATRAH_ALTIN.kod, ozelMatrahGerekcesi: OZEL_MATRAH_ALTIN.gerekce, ozelMatrahTutari };
  });

  if (ozelMatrahVar && istisnaVar) {
    throw ApiError.badRequest("Fişte hem KDV'siz (istisnalı) hem özel matrahlı satır var; GİB bunları aynı faturada kabul etmez. Fişi ikiye ayırın.");
  }
  const faturaTipi: FaturaTipi = ozelMatrahVar ? "OZELMATRAH" : istisnaVar ? "ISTISNA" : "SATIS";
  const alici = aliciTarafi(b);
  const girdi: Omit<UblFaturaGirdi, "gonderici"> = {
    belgeNo,
    uuid: temiz(b.ETTN) || undefined,
    tarih: tarihYaz(b.TARIH),
    paraBirimi: "TRY",
    senaryo: alici.vknTckn === NIHAI_TUKETICI ? "EARSIVFATURA" : "TICARIFATURA",
    faturaTipi,
    alici,
    satirlar,
  };
  // Fişin genel toplamıyla uyuşmalı (P10)
  const ozet = hesapla(satirlar);
  const genelToplam = yuvarla(sayi(b.GENEL_TOPLAM));
  if (Math.abs(ozet.odenecekTutar - genelToplam) > 0.011) {
    throw ApiError.badRequest(`Fişin genel toplamı (${genelToplam.toFixed(2)}) ile e-belge toplamı (${ozet.odenecekTutar.toFixed(2)}) uyuşmuyor; gönderim durduruldu.`);
  }
  return girdi;
}

/** Alış fişi → e-Gider pusulası girdisi (P1, P8). Mükellef (VKN'li) cariden alış gönderilmez. */
export function perakendeGiderGirdisi(kaynak: { baslik: PerakendeBaslik; satirlar: PerakendeSatir[] }, stopajOrani = 0): Omit<GiderPusulasiGirdi, "gonderici"> {
  const b = kaynak.baslik;
  if (Number(b.FATURA_TIPI) !== 0) throw ApiError.badRequest("Bu fiş alış fişi değil.");
  const belgeNo = onKontrol(b, kaynak.satirlar);
  const alici = aliciTarafi(b);
  if (alici.vknTckn.length === 10) throw ApiError.badRequest("Mükellef (VKN'li) cariden alışta belgeyi karşı taraf keser; gider pusulası düzenlenmez.");
  if (sayi(b.ISKONTO_TUTARI) > 0) throw ApiError.badRequest("İskontolu alış fişi gider pusulası olarak gönderilemez; iskontoyu satır fiyatına yansıtın.");
  const satirlar = kaynak.satirlar.map((s, i) => {
    const miktar = sayi(s.MIKTAR) || 1;
    const tutar = yuvarla(sayi(s.TUTAR));
    if (miktar <= 0 || tutar <= 0) throw ApiError.badRequest(`${i + 1}. satırda miktar / tutar geçersiz.`);
    const birimFiyat = yuvarla(tutar / miktar);
    if (Math.abs(yuvarla(miktar * birimFiyat) - tutar) > 0.011) throw ApiError.badRequest(`${i + 1}. satırın tutarı miktar × birim fiyat ile uyuşmuyor; gönderim durduruldu.`);
    const ad = [temiz(s.URUN_ADI) || "Ürün", temiz(s.AYAR) ? `${temiz(s.AYAR)} ayar` : ""].filter(Boolean).join(" ");
    return { ad, miktar, birimKodu: birimKodu(s.BIRIM), birimFiyat, vergiOrani: stopajOrani };
  });
  const toplam = yuvarla(satirlar.reduce((t, s) => t + yuvarla(s.miktar * s.birimFiyat), 0));
  const genelToplam = yuvarla(sayi(b.GENEL_TOPLAM));
  if (Math.abs(toplam - genelToplam) > 0.011) {
    throw ApiError.badRequest(`Fişin genel toplamı (${genelToplam.toFixed(2)}) ile satır toplamı (${toplam.toFixed(2)}) uyuşmuyor; gönderim durduruldu.`);
  }
  return { belgeNo, uuid: temiz(b.ETTN) || undefined, tarih: tarihYaz(b.TARIH), belgeTipi: "SATIS", paraBirimi: "TRY", alici, satirlar };
}

/**
 * Perakende numaratörünün ön eki (P3): e-Belge Ayarları'ndaki varsayılan seri; yoksa eski ön ek.
 * faturaTipi 0 → EGider, 1 → senaryoya göre EArsiv / EFatura.
 */
export const perakendeSeriTuru = (faturaTipi: number, senaryo: string | null | undefined): "EGider" | "EArsiv" | "EFatura" =>
  Number(faturaTipi) === 0 ? "EGider" : temiz(senaryo).toUpperCase() === "EARSIVFATURA" ? "EArsiv" : "EFatura";

export const VARSAYILAN_ON_EK: Record<"EGider" | "EArsiv" | "EFatura", string> = { EGider: "GDR", EArsiv: "EAR", EFatura: "GIB" };

export const perakendeOnEki = (faturaTipi: number, senaryo: string | null | undefined, varsayilanSeri: string | null | undefined): string => {
  const tur = perakendeSeriTuru(faturaTipi, senaryo);
  const seri = temiz(varsayilanSeri).toUpperCase();
  return /^[A-Z0-9]{3}$/.test(seri) ? seri : VARSAYILAN_ON_EK[tur];
};
