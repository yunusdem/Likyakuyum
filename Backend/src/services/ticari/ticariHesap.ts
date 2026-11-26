/**
 * Ticari İşlemler saf hesapları (docs/TICARI_ISLEMLER_YOL_HARITASI.md, T5, T12). Veritabanına dokunmaz;
 * sunucu kaydı ve ön yüz aynı fonksiyonu kullanır, saf mantık testiyle sınanır.
 *
 * Satış fişinde fiyat KDV dahil girilir. e-Belge satırı ise KDV hariç birim fiyat (2 hane), tutar = miktar × birim fiyat
 * ve iskonto ister; KDV, iskontodan sonraki matrahtan hesaplanır. Bu yüzden satır şöyle çözülür:
 *   brüt (dahil) = miktar × fiyat · satır iskontosu (% ya da tutar, dahil) · başlık iskontosu satırlara dağıtılır
 *   matrah = net dahil ÷ (1 + oran) · birim fiyat = fiyat ÷ (1 + oran) (2 hane)
 *   tutar = miktar × birim fiyat; matrahtan küçük kalırsa birim fiyat kuruş yukarı alınır (iskonto eksiye düşmesin)
 *   iskonto (hariç) = tutar − matrah · KDV = matrah × oran · toplam = matrah + KDV
 */

export const yuvarla2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;
const yukari2 = (n: number): number => Math.ceil(yuvarla(n * 100, 6)) / 100;
const yuvarla = (n: number, hane: number): number => {
  const k = 10 ** hane;
  return Math.round((n + Number.EPSILON) * k) / k;
};
const sayi = (v: unknown): number => {
  // "1.234,5" Türkçe biçim; virgülsüz metin olduğu gibi okunur ("12.5" = 12,5)
  const n = typeof v === "string" ? Number(v.includes(",") ? v.replace(/\./g, "").replace(",", ".") : v) : Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** 1 yüzde · 2 tutar (KDV dahil) */
export type IskontoTuru = 0 | 1 | 2;

export interface TicariSatirGirdi {
  miktar: number;
  /** KDV dahil birim fiyat */
  kdvDahilFiyat: number;
  kdvOrani: number;
  iskontoTuru?: IskontoTuru | null;
  iskontoDegeri?: number | null;
}

export interface TicariSatirSonuc {
  miktar: number;
  kdvDahilFiyat: number;
  kdvOrani: number;
  iskontoTuru: IskontoTuru;
  iskontoDegeri: number;
  /** Miktar × KDV dahil fiyat */
  brutDahil: number;
  /** Satırın kendi iskontosu (KDV dahil) */
  satirIskontoDahil: number;
  /** Başlık iskontosundan satıra düşen pay (KDV dahil) */
  baslikPayiDahil: number;
  /** Tüm iskontolardan sonra (KDV dahil) */
  netDahil: number;
  /** KDV hariç birim fiyat (2 hane) — e-Belge birim fiyatı */
  birimFiyat: number;
  /** Miktar × birim fiyat */
  tutar: number;
  /** e-Belge satır iskontosu (KDV hariç) = tutar − matrah */
  iskontoTutari: number;
  matrah: number;
  kdvTutari: number;
  toplamTutar: number;
}

export interface TicariFisSonuc {
  satirlar: TicariSatirSonuc[];
  /** Başlık iskontosu (KDV dahil) */
  baslikIskontoDahil: number;
  brutDahil: number;
  /** Satır + başlık iskontosu (KDV dahil) */
  toplamIskontoDahil: number;
  /** Σ tutar (iskontosuz KDV hariç) */
  araToplam: number;
  /** Σ iskonto (KDV hariç) */
  toplamIskonto: number;
  matrah: number;
  toplamKdv: number;
  genelToplam: number;
}

/** İskonto tutarını tutar oranında dağıtır; kuruş artığı son satıra yazılır. */
export const oranlaDagit = (tutarlar: number[], toplam: number): number[] => {
  const t = yuvarla2(Math.max(0, toplam));
  const genel = tutarlar.reduce((a, x) => a + x, 0);
  if (!t || genel <= 0) return tutarlar.map(() => 0);
  const paylar = tutarlar.map((x) => yuvarla2((t * x) / genel));
  const fark = yuvarla2(t - paylar.reduce((a, x) => a + x, 0));
  if (fark) {
    // Artığı en büyük satıra yaz (eksiye düşmesin)
    let i = 0;
    tutarlar.forEach((x, j) => { if (x > tutarlar[i]) i = j; });
    paylar[i] = yuvarla2(paylar[i] + fark);
  }
  return paylar;
};

const satirIskontosu = (brut: number, tur: IskontoTuru, deger: number): number => {
  if (tur === 1) return yuvarla2((brut * Math.min(Math.max(deger, 0), 100)) / 100);
  if (tur === 2) return yuvarla2(Math.min(Math.max(deger, 0), brut));
  return 0;
};

/** Net dahil tutardan e-Belge satırını çözer. */
export const satirCoz = (miktar: number, kdvDahilFiyat: number, kdvOrani: number, netDahil: number) => {
  const bolen = 1 + kdvOrani / 100;
  const matrah = yuvarla2(netDahil / bolen);
  let birimFiyat = yuvarla2(kdvDahilFiyat / bolen);
  let tutar = yuvarla2(miktar * birimFiyat);
  if (tutar + 0.0001 < matrah) {
    birimFiyat = yukari2(matrah / miktar);
    tutar = yuvarla2(miktar * birimFiyat);
  }
  const iskontoTutari = yuvarla2(Math.max(0, tutar - matrah));
  const kdvTutari = yuvarla2((matrah * kdvOrani) / 100);
  return { birimFiyat, tutar, iskontoTutari, matrah, kdvTutari, toplamTutar: yuvarla2(matrah + kdvTutari) };
};

export const GECERLI_KDV_ORANLARI = [0, 1, 8, 10, 18, 20];

/**
 * Fiş hesabı. Başlık iskontosu: tür 1 yüzde, 2 tutar (KDV dahil); satır iskontolarından sonra kalan tutar üzerinden.
 * Hata durumunda (miktar ≤ 0, fiyat < 0, oran geçersiz) Error fırlatır; mesaj kullanıcıya gösterilir.
 */
export function ticariFisHesapla(girdiler: TicariSatirGirdi[], baslik?: { turu?: IskontoTuru | null; deger?: number | null } | null): TicariFisSonuc {
  const ara = girdiler.map((g, i) => {
    const miktar = yuvarla(sayi(g.miktar), 4);
    // 6 hane: koli fiyatı ana birime bölününce (1.000 TL / 144) satır tutarı koli fiyatıyla aynı çıksın (TA5); elle girilen fiyatlar en çok 4 hanelidir, değişmez
    const kdvDahilFiyat = yuvarla(sayi(g.kdvDahilFiyat), 6);
    const kdvOrani = sayi(g.kdvOrani);
    const iskontoTuru = (Number(g.iskontoTuru) === 1 || Number(g.iskontoTuru) === 2 ? Number(g.iskontoTuru) : 0) as IskontoTuru;
    const iskontoDegeri = iskontoTuru ? sayi(g.iskontoDegeri) : 0;
    if (!(miktar > 0)) throw new Error(`${i + 1}. satırda miktar sıfırdan büyük olmalı.`);
    if (kdvDahilFiyat < 0) throw new Error(`${i + 1}. satırda fiyat eksi olamaz.`);
    if (kdvOrani < 0 || kdvOrani > 100) throw new Error(`${i + 1}. satırda KDV oranı geçersiz.`);
    if (iskontoTuru === 1 && (iskontoDegeri < 0 || iskontoDegeri > 100)) throw new Error(`${i + 1}. satırda iskonto yüzdesi 0 ile 100 arasında olmalı.`);
    if (iskontoTuru === 2 && iskontoDegeri < 0) throw new Error(`${i + 1}. satırda iskonto tutarı eksi olamaz.`);
    const brutDahil = yuvarla2(miktar * kdvDahilFiyat);
    const satirIskontoDahil = satirIskontosu(brutDahil, iskontoTuru, iskontoDegeri);
    return { miktar, kdvDahilFiyat, kdvOrani, iskontoTuru, iskontoDegeri, brutDahil, satirIskontoDahil, net1: yuvarla2(brutDahil - satirIskontoDahil) };
  });

  const net1Toplam = yuvarla2(ara.reduce((a, s) => a + s.net1, 0));
  const bTur = (Number(baslik?.turu) === 1 || Number(baslik?.turu) === 2 ? Number(baslik?.turu) : 0) as IskontoTuru;
  const bDeger = sayi(baslik?.deger);
  if (bTur === 1 && (bDeger < 0 || bDeger > 100)) throw new Error("Fiş iskontosu yüzdesi 0 ile 100 arasında olmalı.");
  if (bTur === 2 && bDeger < 0) throw new Error("Fiş iskontosu eksi olamaz.");
  const baslikIskontoDahil = satirIskontosu(net1Toplam, bTur, bDeger);
  const paylar = oranlaDagit(ara.map((s) => s.net1), baslikIskontoDahil);

  const satirlar: TicariSatirSonuc[] = ara.map((s, i) => {
    const netDahil = yuvarla2(s.net1 - paylar[i]);
    const c = satirCoz(s.miktar, s.kdvDahilFiyat, s.kdvOrani, netDahil);
    return {
      miktar: s.miktar,
      kdvDahilFiyat: s.kdvDahilFiyat,
      kdvOrani: s.kdvOrani,
      iskontoTuru: s.iskontoTuru,
      iskontoDegeri: s.iskontoDegeri,
      brutDahil: s.brutDahil,
      satirIskontoDahil: s.satirIskontoDahil,
      baslikPayiDahil: paylar[i],
      netDahil,
      ...c,
    };
  });

  const topla = (f: (s: TicariSatirSonuc) => number) => yuvarla2(satirlar.reduce((a, s) => a + f(s), 0));
  return {
    satirlar,
    baslikIskontoDahil,
    brutDahil: topla((s) => s.brutDahil),
    toplamIskontoDahil: topla((s) => s.satirIskontoDahil + s.baslikPayiDahil),
    araToplam: topla((s) => s.tutar),
    toplamIskonto: topla((s) => s.iskontoTutari),
    matrah: topla((s) => s.matrah),
    toplamKdv: topla((s) => s.kdvTutari),
    genelToplam: topla((s) => s.toplamTutar),
  };
}

/** Kart fiyatı → KDV dahil satış fiyatı (kart KDV hariçse oran eklenir) */
// ── Kampanya (İş 11, G12): saf seçim ──
export interface AktifKampanya {
  kampanyaId: number;
  ad: string;
  /** 1 yüzde, 2 tutar (birim fiyattan, KDV dahil) */
  tur: 1 | 2;
  deger: number;
  /** 1 gruplar, 2 kartlar, 3 tümü */
  hedefTuru: 1 | 2 | 3;
  grupIdler: number[];
  kartIdler: number[];
}
/** Kartı kapsayan kampanyalar arasından (birim fiyata göre) en yüksek indirimi vereni seçer; yoksa null */
export function kampanyaSec(kampanyalar: AktifKampanya[], kart: { stokKartId: number; stokGrupId?: number | null }, birimFiyat: number): { kampanya: AktifKampanya; indirim: number } | null {
  let enIyi: { kampanya: AktifKampanya; indirim: number } | null = null;
  for (const k of kampanyalar) {
    const kapsar = k.hedefTuru === 3 || (k.hedefTuru === 1 && !!kart.stokGrupId && k.grupIdler.includes(kart.stokGrupId)) || (k.hedefTuru === 2 && k.kartIdler.includes(kart.stokKartId));
    if (!kapsar) continue;
    const indirim = yuvarla2(Math.min(birimFiyat, k.tur === 1 ? (birimFiyat * k.deger) / 100 : k.deger));
    if (indirim <= 0) continue;
    if (!enIyi || indirim > enIyi.indirim) enIyi = { kampanya: k, indirim };
  }
  return enIyi;
}

// ── Toplu fiyat işlemi (İş 11, G11, G14): saf hesap ──
export type FiyatIslemi = { tur: "yuzde" | "tutar" | "alisKar"; deger: number };
/** kurus: 2 hane · tl: tam sayı · 99: en yakın tam sayının 0,01 altı (12,3 → 11,99; 12,6 → 12,99; en az 0,99) */
export type Yuvarlama = "kurus" | "tl" | "99";
export const fiyatYuvarla = (x: number, y: Yuvarlama): number => {
  if (!Number.isFinite(x)) return 0;
  if (y === "tl") return Math.max(0, Math.round(x));
  if (y === "99") { const r = Math.round(x); return r <= 1 ? 0.99 : yuvarla2(r - 0.01); }
  return Math.max(0, yuvarla2(x));
};
/** Yeni fiyat; alisKar'da alış yoksa null. Sonuç eksiye düşerse 0. */
export function yeniFiyatHesapla(eski: number | null, alis: number | null, islem: FiyatIslemi, yuvarlama: Yuvarlama): number | null {
  const d = Number(islem.deger) || 0;
  let x: number;
  if (islem.tur === "alisKar") { if (alis === null || alis === undefined) return null; x = alis * (1 + d / 100); }
  else { if (eski === null || eski === undefined) return null; x = islem.tur === "yuzde" ? eski * (1 + d / 100) : eski + d; }
  if (x < 0) x = 0;
  return fiyatYuvarla(x, yuvarlama);
}

export const kartDahilFiyat = (satisFiyati: number | null | undefined, kdvOrani: number, fiyatKdvDahil: boolean): number => {
  const f = sayi(satisFiyati);
  return fiyatKdvDahil ? f : yuvarla(f * (1 + sayi(kdvOrani) / 100), 4);
};

/** Stok giriş satırı: KDV hariç alış fiyatı */
export const girisSatirHesapla = (miktar: number, birimFiyat: number, kdvOrani: number) => {
  const tutar = yuvarla2(sayi(miktar) * sayi(birimFiyat));
  const kdvTutari = yuvarla2((tutar * sayi(kdvOrani)) / 100);
  return { tutar, kdvTutari, toplamTutar: yuvarla2(tutar + kdvTutari) };
};

/** Birim adı → e-Belge (UN/ECE) kodu */
export const BIRIMLER: { ad: string; kod: string }[] = [
  { ad: "Adet", kod: "C62" },
  { ad: "Kg", kod: "KGM" },
  { ad: "Gr", kod: "GRM" },
  { ad: "Lt", kod: "LTR" },
  { ad: "Metre", kod: "MTR" },
  { ad: "Paket", kod: "PA" },
  { ad: "Kutu", kod: "BX" },
];

export const birimAdiDuzelt = (v: unknown): string | null => {
  const t = String(v ?? "").trim().toLocaleLowerCase("tr-TR");
  if (!t) return null;
  const esler: Record<string, string> = {
    adet: "Adet", ad: "Adet", adt: "Adet", c62: "Adet",
    kg: "Kg", kilo: "Kg", kilogram: "Kg", kgm: "Kg",
    gr: "Gr", g: "Gr", gram: "Gr", grm: "Gr",
    lt: "Lt", l: "Lt", litre: "Lt", ltr: "Lt",
    metre: "Metre", m: "Metre", mt: "Metre", mtr: "Metre",
    paket: "Paket", pk: "Paket", pa: "Paket",
    kutu: "Kutu", kt: "Kutu", bx: "Kutu",
  };
  return esler[t] ?? null;
};

export const birimKoduTicari = (birim: unknown): string => {
  const ad = birimAdiDuzelt(birim);
  return BIRIMLER.find((b) => b.ad === ad)?.kod ?? "C62";
};

/* ───── Tartılı ürün (docs/TICARI_ADISYON_YOL_HARITASI.md, TA2) ───── */

export type TartiBirimi = "Kg" | "Gr";
export type TartiYazimi = "gram" | "kilo";

/** Kartın birimi tartılı mı (Kg / Gr); değilse null */
export const tartiBirimi = (birim: unknown): TartiBirimi | null => {
  const ad = birimAdiDuzelt(birim);
  return ad === "Kg" || ad === "Gr" ? ad : null;
};

/** Tartı penceresinde yazılan değer (gram ya da kilo) → kartın biriminde miktar (4 hane: 0,1 gr çözünürlüğü) */
export const tartiMiktari = (deger: number, yazim: TartiYazimi, kartBirimi: TartiBirimi): number => {
  const d = sayi(deger);
  if (!(d > 0)) return 0;
  const gram = yazim === "gram" ? d : d * 1000;
  return kartBirimi === "Kg" ? yuvarla(gram / 1000, 4) : yuvarla(gram, 4);
};

/** Kart birimindeki miktar → yazım biriminde değer (pencereyi var olan miktarla açmak için) */
export const tartiDegeri = (miktar: number, yazim: TartiYazimi, kartBirimi: TartiBirimi): number => {
  const gram = kartBirimi === "Kg" ? sayi(miktar) * 1000 : sayi(miktar);
  return yazim === "gram" ? yuvarla(gram, 1) : yuvarla(gram / 1000, 4);
};

/**
 * "100 TL'lik" → kartın biriminde miktar; terazi gibi gram çözünürlüğüne yuvarlanır (Kg: 3 hane, Gr: tam gram).
 * Fiyat KDV dahil birim (kg ya da gr) fiyatıdır. Sonuç tutarı kuruş farkı verebilir; ekran önce gösterir.
 */
export const tutardanTartiMiktari = (tutar: number, birimFiyat: number, kartBirimi: TartiBirimi): number => {
  const t = sayi(tutar), f = sayi(birimFiyat);
  if (!(t > 0) || !(f > 0)) return 0;
  const m = t / f;
  return kartBirimi === "Kg" ? yuvarla(m, 3) : Math.round(m);
};

/** Tuş takımından gelen metin pencerede hangi yazımla açılır: virgüllü → kilo, virgülsüz → gram (TA2: varsayılan gram) */
export const tartiYazimiTahmin = (metin: string): TartiYazimi => (/[.,]/.test(String(metin ?? "")) ? "kilo" : "gram");

/**
 * Fiş hücresine yazılan tartı metni: "347gr", "347 g", "1,25kg", "1.25 kilo" → kartın biriminde miktar.
 * Soneksiz sayı kartın biriminde kabul edilir (Kg kartında "0,5" = 0,5 kg). Geçersiz / sıfır → null.
 */
export const tartiMetniCoz = (metin: string, kartBirimi: TartiBirimi): number | null => {
  const m = /^\s*(\d+(?:[.,]\d+)?)\s*(kg|kilo|kilogram|gr|g|gram)?\s*$/i.exec(String(metin ?? "").toLocaleLowerCase("tr-TR"));
  if (!m) return null;
  const d = Number(m[1].replace(",", "."));
  if (!(d > 0)) return null;
  const sonek = m[2];
  const yazim: TartiYazimi | null = !sonek ? null : /^(kg|kilo|kilogram)$/.test(sonek) ? "kilo" : "gram";
  if (!yazim) return yuvarla(d, 4);
  return tartiMiktari(d, yazim, kartBirimi);
};

/** "0,347 kg" / "347 gr" — ekranda tartı miktarı */
export const tartiYaz = (miktar: number, kartBirimi: TartiBirimi): string => {
  const gram = kartBirimi === "Kg" ? sayi(miktar) * 1000 : sayi(miktar);
  const kg = (gram / 1000).toLocaleString("tr-TR", { minimumFractionDigits: 3, maximumFractionDigits: 4 });
  return `${kg} kg (${gram.toLocaleString("tr-TR", { maximumFractionDigits: 1 })} gr)`;
};

/* ───── Terazi etiketli barkod (docs/TICARI_ADISYON_YOL_HARITASI.md, TA3) ───── */

/** EAN-13 terazi barkodu düzeni: önek + ürün kodu (kodHane) + değer (kalan haneler) + kontrol hanesi */
export interface TeraziDuzeni {
  teraziBarkodId?: number;
  /** "27", "28", "29" (1–2 rakam) */
  onek: string;
  /** Ürün kodu (PLU) hane sayısı */
  kodHane: number;
  /** A: ağırlık (kg), F: fiyat (TL) */
  degerTuru: "A" | "F";
  /** Değerin ondalığı: ağırlıkta 3 = gram, fiyatta 2 = kuruş */
  ondalik: number;
  aktif: boolean;
  aciklama?: string | null;
}

export interface TeraziCozumu {
  duzen: TeraziDuzeni;
  /** Barkoddaki ürün kodu (stok kartının TERAZI_KODU) */
  plu: number;
  /** Ağırlık gömülüyse kg; değilse null */
  agirlikKg: number | null;
  /** Fiyat gömülüyse TL; değilse null */
  fiyat: number | null;
}

/** EAN-13'ün ilk 12 hanesinden kontrol hanesi */
export const ean13KontrolHanesi = (ilk12: string): number => {
  let t = 0;
  for (let i = 0; i < 12; i++) t += Number(ilk12[i]) * (i % 2 === 0 ? 1 : 3);
  return (10 - (t % 10)) % 10;
};

/** Değer hanesi sayısı: 12 veri hanesi − önek − kod */
export const teraziDegerHanesi = (d: Pick<TeraziDuzeni, "onek" | "kodHane">): number => 12 - String(d.onek).length - Number(d.kodHane);

/** Düzen denetimi; hata yoksa null */
export const teraziDuzeniDenetle = (d: Partial<TeraziDuzeni>): string | null => {
  const onek = String(d.onek ?? "").trim();
  if (!/^\d{1,2}$/.test(onek)) return "Önek 1 ya da 2 rakam olmalı (ör. 27).";
  if (!/^2/.test(onek)) return "Terazi barkodu öneki 2 ile başlamalı (20–29 mağaza içi barkodlar).";
  const kod = Number(d.kodHane);
  if (!Number.isInteger(kod) || kod < 3 || kod > 6) return "Ürün kodu hanesi 3 ile 6 arasında olmalı.";
  const deger = teraziDegerHanesi({ onek, kodHane: kod });
  if (deger < 4) return "Değer için en az 4 hane kalmalı; ürün kodu hanesini azaltın.";
  if (d.degerTuru !== "A" && d.degerTuru !== "F") return "Değer türü Ağırlık ya da Fiyat olmalı.";
  const o = Number(d.ondalik);
  if (!Number.isInteger(o) || o < 0 || o > 3 || o >= deger) return "Ondalık 0 ile 3 arasında olmalı (ağırlıkta 3 = gram, fiyatta 2 = kuruş).";
  return null;
};

/**
 * Terazi barkodunu çözer: 13 rakam, kontrol hanesi doğru, etkin bir düzenin önekiyle başlar (uzun önek önce). Eşleşmezse null.
 * Normal ürün barkodu önce kart barkodlarında aranır; bu yalnız orada bulunamayan barkod için kullanılır.
 */
export function teraziBarkodCoz(barkod: string, duzenler: TeraziDuzeni[]): TeraziCozumu | null {
  const b = String(barkod ?? "").trim();
  if (!/^\d{13}$/.test(b)) return null;
  if (ean13KontrolHanesi(b) !== Number(b[12])) return null;
  const adaylar = duzenler.filter((d) => d.aktif && !teraziDuzeniDenetle(d) && b.startsWith(String(d.onek))).sort((x, y) => String(y.onek).length - String(x.onek).length);
  const d = adaylar[0];
  if (!d) return null;
  const ol = String(d.onek).length;
  const plu = Number(b.slice(ol, ol + d.kodHane));
  const ham = Number(b.slice(ol + d.kodHane, 12));
  if (!(plu > 0)) return null;
  const deger = yuvarla(ham / 10 ** d.ondalik, 4);
  return { duzen: d, plu, agirlikKg: d.degerTuru === "A" ? deger : null, fiyat: d.degerTuru === "F" ? deger : null };
}

/**
 * Terazi barkodundan kartın biriminde miktar. Ağırlık: Kg kartında kg, Gr kartında gram. Fiyat: etiketteki tutar ÷ KDV dahil
 * birim fiyat, gram çözünürlüğüne yuvarlanmış (Kg: 3 hane, Gr: tam gram). Tartılı olmayan karta bağlıysa ya da değer sıfırsa açıklama metni döner.
 */
export const teraziMiktari = (c: Pick<TeraziCozumu, "agirlikKg" | "fiyat">, kartBirimi: unknown, birimFiyat: number): number | string => {
  const b = tartiBirimi(kartBirimi);
  if (!b) return "Terazi barkodu tartılı (Kg / Gr) olmayan bir karta bağlı; kartın birimini ya da terazi kodunu düzeltin.";
  if (c.agirlikKg !== null) {
    if (!(c.agirlikKg > 0)) return "Terazi barkodundaki ağırlık sıfır.";
    return b === "Kg" ? yuvarla(c.agirlikKg, 4) : yuvarla(c.agirlikKg * 1000, 4);
  }
  if (!(Number(c.fiyat) > 0)) return "Terazi barkodundaki tutar sıfır.";
  if (!(birimFiyat > 0)) return "Kartın fiyatı yok; terazi etiketindeki tutardan miktar hesaplanamadı.";
  // Terazi tutarı gram × kg fiyatından hesaplar: miktar gram çözünürlüğüne yuvarlanınca satır tutarı etiketle aynı çıkar
  return tutardanTartiMiktari(Number(c.fiyat), birimFiyat, b);
};

/** Ayar ekranı için örnek barkod: verilen düzen, PLU ve değerle kontrol haneli EAN-13 */
export const teraziOrnekBarkod = (d: Pick<TeraziDuzeni, "onek" | "kodHane" | "ondalik">, plu: number, deger: number): string => {
  const dh = teraziDegerHanesi(d);
  const ilk12 = `${d.onek}${String(Math.trunc(plu)).padStart(d.kodHane, "0").slice(-d.kodHane)}${String(Math.round(deger * 10 ** d.ondalik)).padStart(dh, "0").slice(-dh)}`;
  return ilk12 + ean13KontrolHanesi(ilk12);
};

/* ───── Koli / çoklu birim (docs/TICARI_ADISYON_YOL_HARITASI.md, TA5) ───── */

/** Kartın ek birimi: kaç ana birim (çarpan) ve isteğe bağlı kendi satış fiyatı (kartın KDV dahil işareti / para birimiyle) */
export interface EkBirim {
  stokBirimId?: number;
  birim: string;
  carpan: number;
  satisFiyati: number | null;
  barkodlar?: string[];
}

/**
 * Ek birim satırının ana birim başına KDV dahil fiyatı: birimin kendi fiyatı (KDV dahil TL'ye çevrilmiş) ÷ çarpan; yoksa ana fiyat.
 * 6 hane tutulur (satır tutarı = miktar × fiyat yuvarlanınca koli fiyatı çıkar).
 */
export const ekBirimSatirFiyati = (anaDahilFiyat: number, carpan: number, birimDahilFiyat: number | null): number => {
  const c = sayi(carpan);
  if (!(c > 0)) return sayi(anaDahilFiyat);
  if (birimDahilFiyat === null || birimDahilFiyat === undefined || !(sayi(birimDahilFiyat) > 0)) return sayi(anaDahilFiyat);
  return yuvarla(sayi(birimDahilFiyat) / c, 6);
};

/** "1 Koli (12 Adet)" — ana birimdeki miktar çarpanın katıysa; değilse yalnız ana birim ("13 Adet") */
export const ekBirimYaz = (anaMiktar: number, anaBirim: string, b: Pick<EkBirim, "birim" | "carpan"> | null | undefined): string => {
  const m = yuvarla(sayi(anaMiktar), 4);
  const yaz = (n: number) => n.toLocaleString("tr-TR", { maximumFractionDigits: 4 });
  if (!b || !(b.carpan > 0)) return `${yaz(m)} ${anaBirim}`;
  const adet = m / b.carpan;
  if (Math.abs(adet - Math.round(adet)) > 1e-9 || Math.round(adet) <= 0) return `${yaz(m)} ${anaBirim}`;
  return `${yaz(Math.round(adet))} ${b.birim} (${yaz(m)} ${anaBirim})`;
};

/** Ek birim listesi denetimi: hata metinleri (boşsa geçerli) */
export const ekBirimleriDenetle = (anaBirim: string, birimler: Partial<EkBirim>[]): string[] => {
  const hatalar: string[] = [];
  const adlar = new Set<string>();
  const ana = String(anaBirim ?? "").trim().toLocaleLowerCase("tr-TR");
  birimler.forEach((b, i) => {
    const ad = String(b.birim ?? "").trim();
    const k = `${i + 1}. birim`;
    if (!ad) hatalar.push(`${k}: birim adı boş.`);
    else if (ad.length > 20) hatalar.push(`${k}: birim adı 20 karakterden uzun.`);
    else if (ad.toLocaleLowerCase("tr-TR") === ana) hatalar.push(`${k}: "${ad}" kartın ana birimiyle aynı.`);
    else if (adlar.has(ad.toLocaleLowerCase("tr-TR"))) hatalar.push(`${k}: "${ad}" iki kez yazılmış.`);
    adlar.add(ad.toLocaleLowerCase("tr-TR"));
    const c = sayi(b.carpan);
    if (!(c > 0)) hatalar.push(`${k}: çarpan sıfırdan büyük olmalı.`);
    else if (c === 1) hatalar.push(`${k}: çarpan 1 olamaz (ana birimle aynı olur).`);
    else if (c > 100000) hatalar.push(`${k}: çarpan çok büyük.`);
    if (b.satisFiyati !== null && b.satisFiyati !== undefined && String(b.satisFiyati).trim() !== "" && !(sayi(b.satisFiyati) >= 0)) hatalar.push(`${k}: fiyat geçersiz.`);
  });
  return hatalar;
};

/* ───── Satış iadesi tutarı (docs/TICARI_ADISYON_YOL_HARITASI.md, TA6) ───── */

export interface IadeAsilSatir {
  /** Asıl satırın miktarı, matrahı (tutar − satır iskontosu, KDV hariç), KDV'si, KDV hariç birim fiyatı, KDV oranı */
  miktar: number;
  matrah: number;
  kdv: number;
  birimFiyat: number;
  kdvOrani: number;
}

/**
 * Bir asıl satırdan q miktar iadenin tutarı: matrah ve KDV asıl satırın saklı tutarlarından miktarla orantılı paylaştırılır;
 * satırın SON iadesi (kalanın tamamı) kalan matrah / KDV'yi alır. Böylece bir satırın bütün iadelerinin toplamı müşterinin o
 * satıra ödediğine kuruşu kuruşuna eşittir (her iadeyi ayrı KDV yuvarlamasıyla hesaplamak 1 kuruş fazla iade ettiriyordu).
 * e-Belge satırı kuralı satış satırıyla aynı: tutar = miktar × birim fiyat; matrahtan küçükse birim fiyat kuruş yukarı, fark iskonto.
 */
export function iadeSatirTutari(asil: IadeAsilSatir, onceki: { miktar: number; matrah: number; kdv: number }, q: number) {
  const Q = sayi(asil.miktar);
  const miktar = yuvarla(sayi(q), 4);
  const kalan = yuvarla(Q - sayi(onceki.miktar), 4);
  if (!(miktar > 0)) throw new Error("İade miktarı sıfırdan büyük olmalı.");
  if (miktar - kalan > 0.00001) throw new Error(`İade miktarı (${miktar}) kalan miktardan (${kalan}) fazla.`);
  const son = Math.abs(miktar - kalan) <= 0.00001;
  const matrah = son ? yuvarla2(sayi(asil.matrah) - sayi(onceki.matrah)) : yuvarla2((sayi(asil.matrah) * miktar) / Q);
  const kdvTutari = son ? yuvarla2(sayi(asil.kdv) - sayi(onceki.kdv)) : yuvarla2((sayi(asil.kdv) * miktar) / Q);
  let birimFiyat = yuvarla2(sayi(asil.birimFiyat));
  let tutar = yuvarla2(miktar * birimFiyat);
  if (tutar + 0.0001 < matrah) {
    birimFiyat = yukari2(matrah / miktar);
    tutar = yuvarla2(miktar * birimFiyat);
  }
  const iskontoTutari = yuvarla2(Math.max(0, tutar - matrah));
  const toplamTutar = yuvarla2(matrah + kdvTutari);
  return { miktar, birimFiyat, tutar, iskontoTutari, matrah, kdvTutari, toplamTutar, kdvOrani: sayi(asil.kdvOrani), kdvDahilFiyat: yuvarla(toplamTutar / miktar, 6), son };
}

// ── Kasiyer vardiyası: kasa açılış / kapanış (docs/TICARI_ADISYON_YOL_HARITASI.md, TA8) ──

/** Vardiyadaki TL nakit hareketinin sınıfı: Ticari satış fişinin nakit ödemesi, Ticari iade fişinin nakit iadesi, veznenin öteki hareketleri */
export type VardiyaHareketTuru = "SATIS" | "IADE" | "DIGER";

export interface VardiyaNakdi {
  devir: number;
  nakitSatis: number;
  nakitIade: number;
  digerGiris: number;
  digerCikis: number;
  /** devir + nakit satış − nakit iade + diğer giriş − diğer çıkış */
  beklenen: number;
}

/** Beklenen kasa nakdi: devir ile vardiya aralığındaki TL nakit hareketlerinden. Saf fonksiyon. */
export function vardiyaNakdi(devir: number, hareketler: { tur: VardiyaHareketTuru; giris: number; cikis: number }[]): VardiyaNakdi {
  let nakitSatis = 0, nakitIade = 0, digerGiris = 0, digerCikis = 0;
  for (const h of hareketler) {
    const g = sayi(h.giris), c = sayi(h.cikis);
    if (h.tur === "SATIS") nakitSatis += g - c;
    else if (h.tur === "IADE") nakitIade += c - g;
    else { digerGiris += g; digerCikis += c; }
  }
  const d = yuvarla2(sayi(devir));
  const r = { devir: d, nakitSatis: yuvarla2(nakitSatis), nakitIade: yuvarla2(nakitIade), digerGiris: yuvarla2(digerGiris), digerCikis: yuvarla2(digerCikis) };
  return { ...r, beklenen: yuvarla2(r.devir + r.nakitSatis - r.nakitIade + r.digerGiris - r.digerCikis) };
}

/** Sayılan − beklenen; yarım kuruştan küçük fark TAMAM sayılır. Saf fonksiyon. */
export function vardiyaFarki(beklenen: number, sayilan: number): { fark: number; durum: "TAMAM" | "FAZLA" | "EKSIK" } {
  const fark = yuvarla2(sayi(sayilan) - sayi(beklenen));
  return { fark: Math.abs(fark) < 0.005 ? 0 : fark, durum: Math.abs(fark) < 0.005 ? "TAMAM" : fark > 0 ? "FAZLA" : "EKSIK" };
}

/** TL banknot ve madenî paralar (kuruş için 0,50 … 0,01) — kapanış sayımında küpür dökümü */
export const TL_KUPURLERI = [200, 100, 50, 20, 10, 5, 1, 0.5, 0.25, 0.1, 0.05, 0.01] as const;

/** Küpür dökümünü denetler: anahtar tanımlı küpür, adet 0 ya da pozitif tam sayı. Hata metni ya da null. Saf fonksiyon. */
export function kupurDenetle(kupur: Record<string, unknown>): string | null {
  for (const [k, v] of Object.entries(kupur || {})) {
    if (!TL_KUPURLERI.some((x) => String(x) === String(Number(k)))) return `${k} TL tanımlı bir küpür değil.`;
    const n = Number(v);
    if (!Number.isInteger(n) || n < 0 || n > 1_000_000) return `${k} TL için adet 0 ya da pozitif tam sayı olmalı.`;
  }
  return null;
}

/** Küpür dökümünün toplamı (TL, 2 hane). Saf fonksiyon. */
export function kupurToplami(kupur: Record<string, unknown>): number {
  let kurus = 0;
  for (const [k, v] of Object.entries(kupur || {})) kurus += Math.round(Number(k) * 100) * (Number(v) || 0);
  return kurus / 100;
}

/** Ticari ödeme aracı türünün adı: 0 nakit (vezne), 1 cari (veresiye), 2 POS / kart, 3 banka */
export const odemeAraciAdi = (tur: number): string => (["Nakit", "Cari (veresiye)", "POS / Kart", "Banka"][Number(tur)] ?? "Diğer");

// ── Sayım + fire fişi (docs/TICARI_ADISYON_YOL_HARITASI.md, TA11 / TA12) ──

/** Sayım farkı: sayılan − sistem (4 hane); fazla GİRİŞ, eksik ÇIKIŞ olur. Saf fonksiyon. */
export function sayimFarki(sayilan: number, sistem: number): { fark: number; giris: number; cikis: number } {
  const f = yuvarla(sayi(sayilan) - sayi(sistem), 4);
  const fark = Math.abs(f) < 0.00005 ? 0 : f;
  return { fark, giris: fark > 0 ? fark : 0, cikis: fark < 0 ? -fark : 0 };
}

export const FIRE_NEDENLERI = ["Bozulma", "Kesim firesi", "Son kullanma tarihi", "Kırık / hasarlı", "Kayıp / çalıntı", "Numune / ikram", "Diğer"] as const;

/** Miktar: sıfırdan büyük (sayımda sıfır da olur), en çok 4 ondalık, makul üst sınır. Hata metni ya da null. Saf fonksiyon. */
export function stokMiktariDenetle(miktar: unknown, sifirOlur = false): string | null {
  const n = typeof miktar === "string" ? Number(miktar.includes(",") ? miktar.replace(/\./g, "").replace(",", ".") : miktar) : Number(miktar);
  if (miktar === null || miktar === undefined || miktar === "" || !Number.isFinite(n)) return "Miktar yazılmalı.";
  if (sifirOlur ? n < 0 : n <= 0) return sifirOlur ? "Miktar eksi olamaz." : "Miktar sıfırdan büyük olmalı.";
  if (n > 99_999_999) return "Miktar çok büyük.";
  if (Math.abs(n * 10000 - Math.round(n * 10000)) > 1e-6) return "Miktar en çok 4 ondalık hane olabilir.";
  return null;
}

// ── Son kullanma tarihi (docs/TICARI_ADISYON_YOL_HARITASI.md, TA16) ──
/** SKT uyarı eşiği varsayılanı (gün) */
export const SKT_UYARI_GUN_VARSAYILAN = 30;

const gunBicimi = /^(\d{4})-(\d{2})-(\d{2})$/;
/** YYYY-AA-GG gerçek bir gün mü (31 Şubat değil) */
export function gecerliGun(s: unknown): boolean {
  const m = gunBicimi.exec(String(s ?? "").trim());
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}
/** İki gün arasındaki fark (b − a, gün) */
export const gunFarki = (a: string, b: string): number => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);

/**
 * Giriş satırı SKT denetimi. skt boşsa: takipli kartta hata, değilse null. Giriş gününden önce olamaz (süresi geçmiş mal stoğa alınmaz;
 * gerekiyorsa fire fişiyle düşülür), girişten 30 yıldan uzak olamaz (yazım hatası). Dönen: hata metni ya da null.
 */
export function sktDenetle(skt: unknown, girisGunu: string, takipli: boolean): string | null {
  const t = String(skt ?? "").trim();
  if (!t) return takipli ? "SKT takibi yapılan üründe son kullanma tarihi yazılmalı." : null;
  if (!gecerliGun(t)) return "Son kullanma tarihi YYYY-AA-GG biçiminde gerçek bir gün olmalı.";
  if (gecerliGun(girisGunu) && t < girisGunu) return "Son kullanma tarihi giriş gününden önce olamaz.";
  if (gecerliGun(girisGunu) && gunFarki(girisGunu, t) > 366 * 30) return "Son kullanma tarihi giriş gününden 30 yıldan uzak olamaz.";
  return null;
}

export interface SktParti {
  /** Sıralama anahtarı: giriş zamanı (ms) ve satır kimliği */
  zaman: number;
  sira: number;
  /** Partinin girişteki miktarı (tedarikçiye iade edileni düşülmüş) */
  miktar: number;
  skt: string | null;
}
/**
 * Eldeki stoğu partilere dağıtır (satışta parti takibi yok → ilk giren ilk çıkar varsayımı): bakiye en yeni girişten geriye doğru
 * doldurulur; SKT'siz girişler de pay alır (stoğun parçasıdır). Dönen dizi girdiyle aynı sırada, her partinin kalan tahmini.
 */
export function sktPartiDagit<T extends SktParti>(partiler: T[], bakiye: number): (T & { kalan: number })[] {
  let kalanBakiye = Math.max(0, Number(bakiye) || 0);
  const sirali = partiler.map((p, i) => ({ p, i })).sort((a, b) => b.p.zaman - a.p.zaman || b.p.sira - a.p.sira);
  const kalanlar = new Array<number>(partiler.length).fill(0);
  for (const { p, i } of sirali) {
    const m = Math.max(0, Number(p.miktar) || 0);
    const al = Math.min(m, kalanBakiye);
    kalanlar[i] = Math.round(al * 10000) / 10000;
    kalanBakiye = Math.round((kalanBakiye - al) * 10000) / 10000;
    if (kalanBakiye <= 0) kalanBakiye = 0;
  }
  return partiler.map((p, i) => ({ ...p, kalan: kalanlar[i] }));
}

/** SKT durumu: geçti (bugünden önce), bugün, yaklaşıyor (eşik içinde), uzak */
export function sktDurumu(skt: string, bugun: string, esikGun: number): { kalanGun: number; durum: "gecti" | "bugun" | "yaklasiyor" | "uzak" } {
  const kalanGun = gunFarki(bugun, skt);
  return { kalanGun, durum: kalanGun < 0 ? "gecti" : kalanGun === 0 ? "bugun" : kalanGun <= esikGun ? "yaklasiyor" : "uzak" };
}

// ── Parçalama (docs/TICARI_ADISYON_YOL_HARITASI.md, TA17) ──
/** Ağırlık birimlerinin gram karşılığı: girdi / çıktı / fire karşılaştırması yalnız ağırlık birimleri arasında yapılır */
const AGIRLIK_GRAM: Record<string, number> = { kg: 1000, kilo: 1000, kilogram: 1000, gr: 1, g: 1, gram: 1 };
export const agirlikCarpani = (birim: string): number | null => AGIRLIK_GRAM[String(birim || "").trim().toLocaleLowerCase("tr-TR")] ?? null;

export interface ParcalamaCikti { miktar: number; birim: string; birimMaliyet: number }
/**
 * Parçalama özeti: girdi maliyeti (miktar × o anki ortalama), çıktı maliyeti toplamı, fark ve fire önerisi (girdi ve bütün
 * çıktılar ağırlık birimindeyse girdi − çıktı, girdinin biriminde). Uyarılar: çıktı ağırlığı girdiyi aşıyor; maliyet farkı
 * girdi maliyetinin %0,5'inden ve 1 TL'den büyük.
 */
export function parcalamaOzeti(girdi: { miktar: number; birim: string; birimMaliyet: number }, ciktilar: ParcalamaCikti[]) {
  const girdiMaliyet = yuvarla2(girdi.miktar * girdi.birimMaliyet);
  const ciktiMaliyet = yuvarla2(ciktilar.reduce((t, c) => t + c.miktar * c.birimMaliyet, 0));
  const fark = yuvarla2(ciktiMaliyet - girdiMaliyet);
  const gc = agirlikCarpani(girdi.birim);
  const hepsiAgirlik = gc !== null && ciktilar.length > 0 && ciktilar.every((c) => agirlikCarpani(c.birim) !== null);
  const ciktiGram = hepsiAgirlik ? ciktilar.reduce((t, c) => t + c.miktar * (agirlikCarpani(c.birim) as number), 0) : 0;
  const fireOnerisi = hepsiAgirlik && gc ? Math.round(((girdi.miktar * gc - ciktiGram) / gc) * 10000) / 10000 : null;
  const uyarilar: string[] = [];
  if (fireOnerisi !== null && fireOnerisi < -0.00005) uyarilar.push("Çıktıların ağırlığı girdiden fazla.");
  if (Math.abs(fark) > Math.max(1, girdiMaliyet * 0.005)) {
    uyarilar.push(`Çıktı maliyeti girdi maliyetinden ${fark > 0 ? "fazla" : "az"} (fark ${Math.abs(fark).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL).`);
  }
  const verimYuzde = fireOnerisi !== null && girdi.miktar > 0 ? Math.round(((girdi.miktar - fireOnerisi) / girdi.miktar) * 10000) / 100 : null;
  return { girdiMaliyet, ciktiMaliyet, fark, fireOnerisi, verimYuzde, uyarilar };
}

/**
 * Girdi maliyetini çıktılara dağıtır: pay verilmişse paya (maliyet payı), verilmemişse miktara göre (o zaman bütün parçaların birim
 * maliyeti aynıdır). Birim maliyet 6 hane; satır tutarları (miktar × birim, kuruş) toplamı girdi maliyetine eşit olsun diye kuruş
 * artığı yalnız en büyük paylı satırın birim maliyetine yansıtılır.
 */
export function maliyetDagit(girdiMaliyet: number, ciktilar: { miktar: number; pay?: number | null }[]): number[] {
  if (!ciktilar.length) return [];
  const y6 = (x: number) => Math.round(x * 1_000_000) / 1_000_000;
  const payVar = ciktilar.some((c) => c.pay !== null && c.pay !== undefined && Number(c.pay) > 0);
  const agirlik = ciktilar.map((c) => (Number(c.miktar) > 0 ? (payVar ? Math.max(0, Number(c.pay) || 0) : Number(c.miktar)) : 0));
  const toplam = agirlik.reduce((t, x) => t + x, 0);
  if (!(toplam > 0)) return ciktilar.map(() => 0);
  const birim = ciktilar.map((c, i) => (Number(c.miktar) > 0 ? y6((girdiMaliyet * agirlik[i]) / toplam / Number(c.miktar)) : 0));
  const tutar = (i: number) => yuvarla2(Number(ciktilar[i].miktar) * birim[i]);
  const enBuyuk = agirlik.indexOf(Math.max(...agirlik));
  const digerleri = ciktilar.reduce((t, _c, i) => (i === enBuyuk ? t : t + tutar(i)), 0);
  const hedef = yuvarla2(girdiMaliyet - digerleri);
  if (Math.abs(hedef - tutar(enBuyuk)) >= 0.005) birim[enBuyuk] = y6(hedef / Number(ciktilar[enBuyuk].miktar));
  return birim;
}

// ── Reçete (docs/TICARI_ADISYON_YOL_HARITASI.md, TA18) ──
export interface ReceteSatiri { malzemeKartId: number; miktar: number }
/** Reçete denetimi: en az bir malzeme, ürünün kendisi malzeme olamaz, malzeme tekrar edemez, miktar > 0 ve en çok 4 hane */
export function receteDenetle(urunKartId: number, satirlar: { malzemeKartId: number; miktar: unknown }[]): string | null {
  if (!satirlar.length) return "Reçetede en az bir malzeme olmalı.";
  const gorulen = new Set<number>();
  for (const [i, s] of satirlar.entries()) {
    const id = Number(s.malzemeKartId) || 0;
    if (!id) return `${i + 1}. malzeme seçilmeli.`;
    if (urunKartId && id === urunKartId) return `${i + 1}. malzeme: ürünün kendisi kendi reçetesinde olamaz.`;
    if (gorulen.has(id)) return `${i + 1}. malzeme reçetede iki kez yazılmış.`;
    gorulen.add(id);
    const h = stokMiktariDenetle(s.miktar);
    if (h) return `${i + 1}. malzeme: ${h}`;
  }
  return null;
}
/** Satılan miktar × porsiyon çarpanı × reçete miktarı → malzeme başına tüketim (4 hane); iade (eksi miktar) eksi tüketim döner */
export function receteTuketimi(satirMiktar: number, recete: ReceteSatiri[], porsiyon = 1): ReceteSatiri[] {
  const carpan = (Number(satirMiktar) || 0) * (Number(porsiyon) > 0 ? Number(porsiyon) : 1);
  return recete.map((r) => ({ malzemeKartId: r.malzemeKartId, miktar: Math.round(carpan * (Number(r.miktar) || 0) * 10000) / 10000 }));
}
