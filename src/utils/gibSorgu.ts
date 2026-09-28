// Yalnız tip: admin paneli de bu kuralları kullanır, kullanıcı uygulamasının API katmanı pakete girmez
import type { VknSorguSonucu } from "../services/gibService";

/**
 * GİB'den gelen unvan / ad / soyad / vergi dairesini forma işleme kuralı (docs/GIB_VKN_SORGU_YOL_HARITASI.md):
 * boş alanlar direkt dolar; dolu ve farklı alan varsa "GİB'deki: X — değiştirilsin mi?" diye sorulur.
 */

export type GibAlan = "unvan" | "ad" | "soyad" | "vergiDairesi";
export type GibDegerleri = Partial<Record<GibAlan, string>>;

const ETIKET: Record<GibAlan, string> = { unvan: "Unvan", ad: "Ad", soyad: "Soyad", vergiDairesi: "Vergi dairesi" };

export const trBuyuk = (s: string | null | undefined): string =>
  String(s ?? "").toLocaleUpperCase("tr-TR").replace(/\s+/g, " ").trim();

/** "KADIKÖY VERGİ DAİRESİ MÜD.", "Kadıköy V.D." ve "KADIKÖY" aynı sayılır. */
export const vdNormalize = (s: string | null | undefined): string =>
  trBuyuk(s)
    .replace(/[.,/()-]/g, " ")
    // \b Türkçe harfte çalışmaz (İ "kelime" karakteri sayılmaz); sınır boşlukla aranır
    .replace(/(^|\s)VERG[İI] DA[İI]RES[İI](?=\s|$)/g, " ")
    .replace(/(^|\s)(V\s?D|MAL MÜDÜRLÜĞÜ|MAL MD|MÜDÜRLÜĞÜ|MÜD|MD)(?=\s|$)/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const ayniMi = (alan: GibAlan, a: string, b: string) =>
  alan === "vergiDairesi" ? vdNormalize(a) === vdNormalize(b) : trBuyuk(a) === trBuyuk(b);

export interface GibPlani {
  doldur: GibDegerleri;
  farklar: { alan: GibAlan; mevcut: string; gelen: string }[];
}

/** Yalnız formda bulunan alanlar (mevcut'ta anahtarı olanlar) değerlendirilir. */
export const gibPlani = (mevcut: GibDegerleri, gelen: Partial<Record<GibAlan, string | null>>): GibPlani => {
  const plan: GibPlani = { doldur: {}, farklar: [] };
  for (const alan of Object.keys(mevcut) as GibAlan[]) {
    const g = (gelen[alan] ?? "").trim();
    if (!g) continue;
    const m = (mevcut[alan] ?? "").trim();
    if (!m) plan.doldur[alan] = g;
    else if (!ayniMi(alan, m, g)) plan.farklar.push({ alan, mevcut: m, gelen: g });
  }
  return plan;
};

/** Listeden vergi dairesini adıyla bulur: önce birebir, sonra tek aday varsa içerme. Bulamazsa null. */
export const vergiDairesiBul = <T extends { ad: string }>(ad: string, liste: T[]): T | null => {
  const n = vdNormalize(ad);
  if (!n) return null;
  const birebir = liste.find((x) => vdNormalize(x.ad) === n);
  if (birebir) return birebir;
  const adaylar = liste.filter((x) => {
    const xn = vdNormalize(x.ad);
    return xn.length >= 3 && (xn.includes(n) || n.includes(xn));
  });
  return adaylar.length === 1 ? adaylar[0] : null;
};

export interface GibDoldurmaSonucu {
  tur: "success" | "warning" | "danger";
  mesaj: string;
  sonuc?: VknSorguSonucu;
}

/**
 * Sorgular, planı uygular. `uygula` yalnız değişecek alanlarla çağrılır; ek uyarı döndürebilir
 * (ör. vergi dairesi listede yok). Hata fırlatmaz, sonucu mesaj olarak döner.
 */
export const gibSorgulaVeDoldur = async (p: {
  no: string;
  /** Sorguyu yapan API çağrısı (kullanıcı uygulaması: gibService.vknSorgu, admin: adminApi.vknSorgu) */
  sorgu: (no: string) => Promise<VknSorguSonucu>;
  mevcut: GibDegerleri;
  uygula: (degerler: GibDegerleri, sonuc: VknSorguSonucu) => string | void;
  /** TCKN'de şahıs, VKN'de şirket: formun tek "ad" alanı varsa unvan yoksa ad + soyad buraya birleşir */
  tekAdAlani?: boolean;
}): Promise<GibDoldurmaSonucu> => {
  const no = p.no.replace(/\D/g, "");
  if (no.length !== 10 && no.length !== 11) return { tur: "danger", mesaj: "VKN 10, TCKN 11 haneli olmalıdır." };

  let sonuc: VknSorguSonucu;
  try {
    sonuc = await p.sorgu(no);
  } catch (err: any) {
    return { tur: "danger", mesaj: err?.message || "GİB sorgusu yapılamadı." };
  }
  if (sonuc.sonuc === "KAYIT_YOK") {
    return { tur: "danger", mesaj: `${no} numarası GİB'de kayıtlı değil. Numarayı kontrol edin.`, sonuc };
  }

  const tamAd = [sonuc.ad, sonuc.soyad].filter(Boolean).join(" ");
  const gelen: Partial<Record<GibAlan, string | null>> = p.tekAdAlani
    ? { unvan: sonuc.unvan || tamAd, vergiDairesi: sonuc.vergiDairesi }
    : { unvan: sonuc.unvan, ad: sonuc.ad, soyad: sonuc.soyad, vergiDairesi: sonuc.vergiDairesi };

  const plan = gibPlani(p.mevcut, gelen);
  const degisecek: GibDegerleri = { ...plan.doldur };
  if (plan.farklar.length) {
    const metin = plan.farklar.map((f) => `${ETIKET[f.alan]}:\n  Ekrandaki: ${f.mevcut}\n  GİB'deki:  ${f.gelen}`).join("\n\n");
    if (window.confirm(`GİB'deki bilgiler ekrandakinden farklı.\n\n${metin}\n\nGİB'deki bilgiler yazılsın mı?`)) {
      for (const f of plan.farklar) degisecek[f.alan] = f.gelen;
    }
  }

  const ek = Object.keys(degisecek).length ? p.uygula(degisecek, sonuc) : undefined;
  const ad = sonuc.unvan || tamAd;
  const parcalar = [`GİB kaydı bulundu: ${ad}`];
  if (sonuc.vergiDairesi) parcalar.push(`vergi dairesi: ${sonuc.vergiDairesi}`);
  if (sonuc.uyari) parcalar.push(sonuc.uyari);
  if (ek) parcalar.push(ek);
  return { tur: sonuc.uyari || ek ? "warning" : "success", mesaj: parcalar.join(" · "), sonuc };
};
