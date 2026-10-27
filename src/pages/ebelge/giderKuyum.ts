/**
 * Kuyum e-Gider Pusulası — ekran hesapları (docs/E_GIDER_YOL_HARITASI.md K5–K12, K18). React'tan bağımsız: test edilir.
 *
 * Kuyumcu vatandaştan altın / gümüş alır: satır ürün + ayar + gram (ya da adet, ziynet için) + tutar. Belgede satır adı
 * "BİLEZİK 22 AYAR (Milyem 916, Has 11,450 gr)" olur (GİB şablonu yalnız adı basar). Vergi:
 *  - Alış (SATIS): 0003 GV stopajı, varsayılan %0 (vatandaşın kendi eşyası); %2 / %5 / %10 ya da elle oran; ödenecekten düşülür.
 *  - İade (IADE): 0015 KDV, iade edilen malın oranı; eklenir.
 */

export type KuyumBirim = "GRM" | "C62";

export interface KuyumAyar {
  kod: string;
  ad: string;
  /** Has oranı (binde); bilinmiyorsa null */
  milyem: number | null;
}

export const KUYUM_AYARLARI: KuyumAyar[] = [
  { kod: "24", ad: "24 Ayar", milyem: 995 },
  { kod: "22", ad: "22 Ayar", milyem: 916 },
  { kod: "21", ad: "21 Ayar", milyem: 875 },
  { kod: "18", ad: "18 Ayar", milyem: 750 },
  { kod: "14", ad: "14 Ayar", milyem: 585 },
  { kod: "8", ad: "8 Ayar", milyem: 333 },
  { kod: "GUMUS", ad: "Gümüş", milyem: 925 },
  { kod: "DIGER", ad: "Diğer", milyem: null },
];

export const KUYUM_URUN_ONERILERI = [
  "Bilezik", "Kolye", "Yüzük", "Küpe", "Zincir", "Künye", "Set", "Hurda Altın", "Gram Altın",
  "Çeyrek Altın", "Yarım Altın", "Tam Altın", "Cumhuriyet Altını", "Ata Lira", "Reşat Altın", "Gümüş Takı",
];

export const KUYUM_BIRIMLERI: { kod: KuyumBirim; ad: string }[] = [
  { kod: "GRM", ad: "Gram" },
  { kod: "C62", ad: "Adet" },
];

/** Alış stopaj seçenekleri (GVK 94/13, 2009/14592 BKK); "OZEL" seçilince oran elle yazılır */
export const STOPAJ_SECENEKLERI: { kod: string; oran: number | null; ad: string }[] = [
  { kod: "0", oran: 0, ad: "Stopaj yok — vatandaşın kendi eşyası" },
  { kod: "2", oran: 2, ad: "%2 — hurda (esnaf muaflığındaki satıcı)" },
  { kod: "5", oran: 5, ad: "%5 — diğer mal (esnaf muaflığındaki satıcı)" },
  { kod: "10", oran: 10, ad: "%10 — hizmet (esnaf muaflığındaki satıcı)" },
  { kod: "OZEL", oran: null, ad: "Diğer oran (elle yazın)" },
];

export const IADE_KDV_ORANLARI = [0, 1, 10, 20];

export const STOPAJ_KODU = "0003";
export const KDV_KODU = "0015";

export interface KuyumSatir {
  urun: string;
  ayar: string;
  birim: KuyumBirim;
  miktar: number;
  /** Gram ya da adet fiyatı (tutar ÷ miktar; elle de yazılır) */
  birimFiyat: number;
  /** Satır tutarı — belgenin esası */
  tutar: number;
  /** Ürün listesinden seçildiyse ürünün kimliği (fiyatı ondan gelir) */
  paraId?: number;
  /** Ürünün alış milyemi (binde); ayarın milyemi yerine kullanılır, ayar elle değişince silinir */
  milyem?: number;
  /** Birim fiyat ya da tutar elle yazıldı: otomatik fiyat üzerine yazmaz (↻ ile yeniden alınır) */
  fiyatElle?: boolean;
}

export interface KuyumSatici {
  vknTckn: string;
  ad: string;
  soyad: string;
  unvan: string;
  il: string;
  ilce: string;
  adres: string;
}

export interface KuyumForm {
  giderTuru: "kuyum";
  seri: string;
  belgeNo: string;
  tarih: string;
  belgeTipi: "SATIS" | "IADE";
  alici: KuyumSatici;
  stopaj: string;
  ozelOran: number;
  iadeKdv: number;
  satirlar: KuyumSatir[];
  iadeDayanak?: { belgeTipi: "EARSIV_FATURA" | "BELGESIZ" | "SATIS_FISI"; belgeNo?: string; belgeTarihi: string };
  not: string;
}

const yuvarla = (n: number, basamak = 2) => {
  const k = 10 ** basamak;
  return Math.round((Number(n) || 0) * k) / k;
};
const trBuyuk = (s: string) => String(s || "").toLocaleUpperCase("tr-TR").replace(/\s+/g, " ").trim();
const sayiYaz = (n: number, basamak: number) =>
  n.toLocaleString("tr-TR", { minimumFractionDigits: basamak, maximumFractionDigits: basamak });

export const bosKuyumSatir = (): KuyumSatir => ({ urun: "", ayar: "22", birim: "GRM", miktar: 0, birimFiyat: 0, tutar: 0 });

export const ayarBul = (kod: string): KuyumAyar | undefined => KUYUM_AYARLARI.find((a) => a.kod === kod);

/** Satırın milyemi (binde): üründen gelen alış milyemi, yoksa ayarınki */
export const satirMilyemi = (s: Pick<KuyumSatir, "ayar" | "milyem">): number | null =>
  s.milyem && s.milyem > 0 ? s.milyem : ayarBul(s.ayar)?.milyem ?? null;

/** Has gram: yalnız gramla girilen ve milyemi bilinen satırda */
export const hasGram = (s: KuyumSatir): number | null => {
  const m = satirMilyemi(s);
  if (!m || s.birim !== "GRM" || !(s.miktar > 0)) return null;
  return yuvarla((s.miktar * m) / 1000, 3);
};

/** Belgede görünen satır adı: "BİLEZİK 22 AYAR (Milyem 916, Has 11,450 gr)"; ürün adında ayar geçiyorsa tekrar yazılmaz */
export const kuyumSatirAdi = (s: KuyumSatir): string => {
  const a = ayarBul(s.ayar);
  const urun = trBuyuk(s.urun);
  const ayarAdi = a && a.kod !== "DIGER" ? trBuyuk(a.ad) : "";
  const ek: string[] = [];
  const m = satirMilyemi(s);
  if (m) ek.push(`Milyem ${m}`);
  const has = hasGram(s);
  if (has !== null) ek.push(`Has ${sayiYaz(has, 3)} gr`);
  const ayarYaz = ayarAdi && !urun.includes(ayarAdi) ? ayarAdi : "";
  return [urun, ayarYaz].filter(Boolean).join(" ") + (ek.length ? ` (${ek.join(", ")})` : "");
};

/* ==========================================================================
   Ürün ve fiyat (Sarraf fişindeki kuralın aynısı): ürün listesi (/para) + fiyat tablosu (anlık, yoksa günlük)
   - Ziynet / para (adetle): ürünün kendi alış fiyatı (efektif alış, yoksa döviz alış)
   - Altın (gramla): has altın alış kuru × alış milyemi;  Gümüş: has gümüş alış kuru × milyem
   ========================================================================== */

export interface KuyumUrun {
  paraId: number;
  kod: string;
  ad: string;
  /** 0 para, 1 altın, 2 gümüş, 3 ziynet */
  urunTipi?: number;
  /** 1 gram */
  birim?: number;
  gramaj?: number;
  /** Alış milyemi / has katsayısı (kesir ya da binde) */
  alisMilyem?: number;
}

export interface KuyumKur {
  paraId?: number | null;
  kod?: string | null;
  ad?: string | null;
  efektifAlis?: number | null;
  dovizAlis?: number | null;
}

export interface KuyumFiyatKaynagi {
  urunler: KuyumUrun[];
  kurlar: KuyumKur[];
}

const esitTr = (a?: string | null, b?: string | null) => !!a && !!b && trBuyuk(a) === trBuyuk(b);
const pozitif = (v: unknown) => (Number(v) > 0 ? Number(v) : 0);
const alisKuru = (k?: KuyumKur) => (k ? pozitif(k.efektifAlis) || pozitif(k.dovizAlis) : 0);

/** Binde milyem: 0,916 → 916; 91,6 (yüzde) → 916; 916 → 916 */
export const milyemBin = (v: unknown): number | null => {
  const n = Number(v);
  if (!(n > 0)) return null;
  return Math.round(n <= 1 ? n * 1000 : n <= 100 ? n * 10 : n);
};

/** Milyeme en yakın ayar (±15 binde); bulunamazsa "DIGER" */
export const ayarMilyemden = (milyem: number | null, gumus = false): string => {
  if (gumus) return "GUMUS";
  if (!milyem) return "DIGER";
  let en: KuyumAyar | null = null;
  for (const a of KUYUM_AYARLARI) {
    if (!a.milyem || a.kod === "GUMUS") continue;
    if (!en || Math.abs(a.milyem - milyem) < Math.abs((en.milyem || 0) - milyem)) en = a;
  }
  return en && Math.abs((en.milyem || 0) - milyem) <= 15 ? en.kod : "DIGER";
};

const ZIYNET_ONEKLERI = ["ÇEYREK", "CEYREK", "YARIM", "TAM ALTIN", "ATA", "CUMHURİYET", "CUMHURIYET", "REŞAT", "RESAT", "GREMSE", "ZİYNET", "ZIYNET", "BEŞLİ", "BESLI"];
/** Ürün tanımındaki tip esastır (3 ziynet); tip yoksa addan (Sarraf fişindeki isZiynetProduct ile aynı) */
export const ziynetMi = (u: Pick<KuyumUrun, "urunTipi" | "ad" | "kod">): boolean => {
  if (u.urunTipi !== undefined && u.urunTipi !== null && Number.isFinite(Number(u.urunTipi))) return Number(u.urunTipi) === 3;
  const ad = trBuyuk(u.ad);
  return ZIYNET_ONEKLERI.some((o) => ad.startsWith(o));
};

/** Kuyum gider formunda seçilebilecek ürünler: para (döviz / TL) hariç */
export const kuyumUrunleri = (urunler: KuyumUrun[]): KuyumUrun[] =>
  urunler.filter((u) => Number(u.urunTipi) !== 0 && !["TL", "TRY", "TRL"].includes(trBuyuk(u.kod)) && trBuyuk(u.ad));

export const urunBul = (yazi: string, kaynak: KuyumFiyatKaynagi): KuyumUrun | undefined =>
  yazi.trim() ? kuyumUrunleri(kaynak.urunler).find((u) => esitTr(u.ad, yazi) || esitTr(u.kod, yazi)) : undefined;

const kurBul = (kurlar: KuyumKur[], u: { paraId?: number; kod?: string; ad?: string }) =>
  kurlar.find((k) => (u.paraId && k.paraId === u.paraId) || esitTr(k.kod, u.kod) || esitTr(k.ad, u.ad));

export const hasAltinAlisKuru = (kurlar: KuyumKur[]): number =>
  alisKuru(kurlar.find((k) => ["HAS", "ALTIN", "HAS ALTIN", "HASALTIN"].includes(trBuyuk(k.kod)) || ["HAS ALTIN", "HAS"].includes(trBuyuk(k.ad))));

export const hasGumusAlisKuru = (kurlar: KuyumKur[]): number =>
  alisKuru(kurlar.find((k) => ["GUMUS", "GÜMÜŞ", "HAS GÜMÜŞ", "HAS GUMUS"].includes(trBuyuk(k.kod)) || ["HAS GÜMÜŞ", "GÜMÜŞ", "GUMUS"].includes(trBuyuk(k.ad))));

/** Satırın otomatik birim fiyatı; hesaplanamazsa null (fiyat elle girilir) */
export const otomatikBirimFiyat = (s: KuyumSatir, kaynak: KuyumFiyatKaynagi): number | null => {
  const urun = s.paraId ? kaynak.urunler.find((u) => u.paraId === s.paraId) : urunBul(s.urun, kaynak);
  // Ziynet / adetli ürün: ürünün kendi alış fiyatı
  if (urun && (ziynetMi(urun) || s.birim === "C62")) {
    const f = alisKuru(kurBul(kaynak.kurlar, urun));
    if (f > 0) return yuvarla(f, 4);
    if (ziynetMi(urun)) return null;
  }
  if (s.birim !== "GRM") return null;
  const m = satirMilyemi(s);
  if (!m) return null;
  const has = s.ayar === "GUMUS" || Number(urun?.urunTipi) === 2 ? hasGumusAlisKuru(kaynak.kurlar) : hasAltinAlisKuru(kaynak.kurlar);
  return has > 0 ? yuvarla((has * m) / 1000, 4) : null;
};

/** Fiyatı (elle yazılmadıysa) otomatik olandan doldurur, tutarı yeniden hesaplar */
export const fiyatYenile = (s: KuyumSatir, kaynak: KuyumFiyatKaynagi | null, zorla = false): KuyumSatir => {
  if (!kaynak || (s.fiyatElle && !zorla)) return s;
  const f = otomatikBirimFiyat(s, kaynak);
  if (f === null) return zorla ? { ...s, fiyatElle: false } : s;
  return { ...s, birimFiyat: f, tutar: yuvarla(s.miktar * f), fiyatElle: false };
};

/** Ürün listesinden seçilince: ad, birim, ayar, alış milyemi, (gramajlı üründe) miktar ve fiyat */
export const urunUygula = (s: KuyumSatir, urun: KuyumUrun, kaynak: KuyumFiyatKaynagi): KuyumSatir => {
  const ziynet = ziynetMi(urun);
  const gumus = Number(urun.urunTipi) === 2;
  const milyem = ziynet ? null : milyemBin(urun.alisMilyem);
  const birim: KuyumBirim = ziynet ? "C62" : "GRM";
  const miktar = s.miktar > 0 ? s.miktar : birim === "C62" ? 1 : pozitif(urun.gramaj);
  const yeni: KuyumSatir = {
    ...s,
    urun: urun.ad,
    paraId: urun.paraId,
    birim,
    ayar: ziynet ? (s.ayar || "22") : ayarMilyemden(milyem, gumus),
    milyem: milyem ?? undefined,
    miktar,
    fiyatElle: false,
  };
  return fiyatYenile(yeni, kaynak, true);
};

/** Miktar ya da birim fiyat değişince tutar; tutar değişince birim fiyat (tutar esastır) */
export const tutarHesapla = (s: KuyumSatir): KuyumSatir => ({ ...s, tutar: yuvarla(s.miktar * s.birimFiyat) });
export const birimFiyatHesapla = (s: KuyumSatir): KuyumSatir => ({
  ...s,
  birimFiyat: s.miktar > 0 ? yuvarla(s.tutar / s.miktar, 6) : 0,
});

export const vergiKodu = (f: Pick<KuyumForm, "belgeTipi">): string => (f.belgeTipi === "IADE" ? KDV_KODU : STOPAJ_KODU);

export const vergiOrani = (f: Pick<KuyumForm, "belgeTipi" | "stopaj" | "ozelOran" | "iadeKdv">): number => {
  if (f.belgeTipi === "IADE") return Number(f.iadeKdv) || 0;
  const secenek = STOPAJ_SECENEKLERI.find((s) => s.kod === f.stopaj);
  return secenek?.oran ?? (Number(f.ozelOran) || 0);
};

/** Ekranda gösterilen toplamlar — sunucu hesabıyla aynı (satır başına yuvarlama) */
export const kuyumToplam = (f: Pick<KuyumForm, "belgeTipi" | "stopaj" | "ozelOran" | "iadeKdv" | "satirlar">) => {
  const oran = vergiOrani(f);
  const kesinti = f.belgeTipi !== "IADE";
  const mal = yuvarla(f.satirlar.reduce((t, s) => t + yuvarla(s.tutar), 0));
  const vergi = yuvarla(f.satirlar.reduce((t, s) => t + yuvarla((yuvarla(s.tutar) * oran) / 100), 0));
  return { oran, kesinti, mal, vergi, odenecek: yuvarla(kesinti ? mal - vergi : mal + vergi) };
};

/** Gönderimden önce zorunlu alanlar (VUK 234: satıcının adı soyadı, TCKN, adresi; malın cinsi, miktarı, bedeli) */
export const kuyumFormHatalari = (f: KuyumForm): string[] => {
  const h: string[] = [];
  const no = f.belgeNo.trim().toUpperCase();
  if (!no) h.push("Belge no girilmeli.");
  else if (!/^[A-Z0-9]{3}\d{13}$/.test(no)) h.push("Belge no 3 karakter seri + 13 rakam olmalı (ör. GDR2026000000001).");
  else if (f.tarih && no.slice(3, 7) !== f.tarih.slice(0, 4)) h.push("Belge numarasındaki yıl tarihle aynı olmalı.");
  const kimlik = f.alici.vknTckn.replace(/\D/g, "");
  if (!/^\d{10}$|^\d{11}$/.test(kimlik)) h.push("Satıcının TC kimlik no (11 hane) ya da VKN'si (10 hane) girilmeli.");
  if (kimlik.length === 11 && !(f.alici.ad.trim() && f.alici.soyad.trim())) h.push("Satıcının adı ve soyadı girilmeli.");
  if (kimlik.length === 10 && !f.alici.unvan.trim()) h.push("Satıcının ünvanı girilmeli.");
  if (!f.alici.il.trim() || !f.alici.ilce.trim()) h.push("Satıcının il ve ilçesi girilmeli.");
  if (!f.alici.adres.trim()) h.push("Satıcının adresi girilmeli.");
  if (!f.satirlar.length) h.push("En az bir satır girilmeli.");
  f.satirlar.forEach((s, i) => {
    const n = `${i + 1}. satır`;
    if (!s.urun.trim()) h.push(`${n}: ürün girilmeli.`);
    if (!(s.miktar > 0)) h.push(`${n}: ${s.birim === "GRM" ? "gram" : "adet"} sıfırdan büyük olmalı.`);
    if (!(s.tutar > 0)) h.push(`${n}: tutar sıfırdan büyük olmalı.`);
  });
  const oran = vergiOrani(f);
  if (!(oran >= 0 && oran <= 100)) h.push("Vergi oranı 0 ile 100 arasında olmalı.");
  if (f.belgeTipi === "IADE") {
    if (!f.iadeDayanak?.belgeTarihi) h.push("İade dayanağının tarihi girilmeli.");
    if (f.iadeDayanak && f.iadeDayanak.belgeTipi !== "BELGESIZ" && !f.iadeDayanak.belgeNo?.trim()) h.push("İade dayanağının belge numarası girilmeli.");
    if (f.iadeDayanak?.belgeTipi === "BELGESIZ" && kimlik.length !== 11) h.push("Belgesiz iadede satıcının gerçek TC kimlik numarası girilmeli.");
  }
  return h;
};

/** Sunucuya giden gider pusulası isteği */
export const kuyumGiderIstegi = (f: KuyumForm) => {
  const oran = vergiOrani(f);
  const kimlik = f.alici.vknTckn.replace(/\D/g, "");
  return {
    belgeNo: f.belgeNo.trim().toUpperCase(),
    tarih: f.tarih,
    belgeTipi: f.belgeTipi,
    paraBirimi: "TRY" as const,
    vergiTuruKodu: vergiKodu(f),
    alici: {
      vknTckn: kimlik,
      ad: f.alici.ad.trim(),
      soyad: f.alici.soyad.trim(),
      // TCKN'li satıcıda ad yalnız Person'da (GİB örneği); ünvan yalnız VKN'de
      unvan: kimlik.length === 10 ? f.alici.unvan.trim() : "",
      il: f.alici.il.trim(),
      ilce: f.alici.ilce.trim(),
      adres: f.alici.adres.trim(),
    },
    satirlar: f.satirlar.map((s) => ({
      ad: kuyumSatirAdi(s),
      miktar: s.miktar,
      birimKodu: s.birim,
      // Tutar esastır: birim fiyat tutardan (sunucu satır matrahını miktar × birim fiyattan, kuruşa yuvarlayarak bulur)
      birimFiyat: s.miktar > 0 ? yuvarla(s.tutar / s.miktar, 6) : 0,
      vergiOrani: oran,
    })),
    iadeDayanak: f.belgeTipi === "IADE" ? f.iadeDayanak : undefined,
    notlar: f.not.trim() ? [f.not.trim()] : undefined,
  };
};
