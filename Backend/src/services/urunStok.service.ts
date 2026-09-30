import { UrunStokSqlRepository, type UrunStokFiltre, type UrunStokSatirHam, type UrunStokTipi } from "../models/urunStokSql.repository.js";
import { EbelgeSqlRepository } from "../models/ebelgeSql.repository.js";
import { kurCoz, kurTarihte } from "./rapor/raporOrtak.js";
import { raporPdf } from "./rapor/raporMotor.js";
import { raporExcel } from "./rapor/raporExcel.js";
import type { RaporKolon, RaporTanim, RaporFirma } from "./rapor/raporTanim.js";

/**
 * Altın Ürün Stoğu / Özel Ürün Stoğu: stok + alış (maliyet) + satış + kâr/zarar.
 * Kâr hem ürünün kendi biriminde (altın: HAS, özel: USD) hem TL'de.
 * TL kuru: satılanlarda fatura tarihindeki kur, stoktakilerde güncel gişe kuru (efektif alış, yoksa döviz alış).
 */

type DbContext = { dbServer?: string; dbName?: string };

export interface UrunStokSatir {
  urunId: number;
  tarih: string | null;
  grupKodu: string;
  urunNo: number | null;
  grupUrun: string;
  barkod: string;
  urunAdi: string;
  ayar: string;
  ureticiFirma: string;
  orjinalKod: string;
  banko: string;
  miktar: number;
  miktarBirimi: string;
  hasGram: number | null;
  birim: string;            // maliyet/satış/kâr birimi (HAS, USD, ...)
  maliyet: number;
  maliyetTl: number;
  satis: number;            // satıldıysa gerçekleşen (birime çevrilmiş), stoktaysa etiket satış fiyatı
  satisTl: number;
  kar: number;
  karTl: number;
  karYuzde: number | null;
  satildi: boolean;
  durum: "Stokta" | "Satıldı";
  satisTarihi: string | null;
  faturaNo: string;
  musteri: string;
  cariKartId: number | null;
  kur: number;              // kullanılan birim→TL kuru
}

export interface UrunStokOzetSatiri {
  durum: string; adet: number; miktar: number; hasGram: number;
  birim: string; maliyet: number; maliyetTl: number; satis: number; satisTl: number; kar: number; karTl: number; karYuzde: number | null;
}

export interface UrunStokSonuc {
  satirlar: UrunStokSatir[];
  ozet: UrunStokOzetSatiri[];   // Stokta / Satıldı / Toplam
  kurAciklama: string;
  filtreOzeti: string;
  toplamKayit: number;
}

const gun = (d: Date | string | null | undefined) => {
  if (!d) return null;
  const t = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(t.getTime())) return null;
  // SQL DATETIME UTC olarak gelir; takvim gününü koru
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}-${String(t.getUTCDate()).padStart(2, "0")}`;
};
const trTarih = (g: string | null) => (g ? g.split("-").reverse().join(".") : "");
const y2 = (n: number) => Math.round(n * 100) / 100;
const y4 = (n: number) => Math.round(n * 10000) / 10000;

export class UrunStokService {
  static varsayilanBirim(tip: UrunStokTipi) { return tip === "altin" ? "HAS" : "USD"; }
  static baslik(tip: UrunStokTipi) { return tip === "altin" ? "Altın Ürün Stoğu" : "Özel Ürün Stoğu"; }

  static async veri(tip: UrunStokTipi, f: UrunStokFiltre, ctx?: DbContext): Promise<UrunStokSonuc> {
    const pool = await UrunStokSqlRepository.pool(ctx);
    const [ham, paraIdler, guncel] = await Promise.all([
      UrunStokSqlRepository.listele(tip, f, ctx),
      UrunStokSqlRepository.paraKodlari(pool),
      kurCoz(pool, { kurTuru: 0 }),
    ]);
    const varsayilan = this.varsayilanBirim(tip);
    const tlId = guncel.tlId;
    const kurOf = (m: Map<number, number>, kod: string) => {
      const k = kod.trim().toUpperCase();
      if (k === "TL" || k === "TRY") return 1;
      const id = paraIdler.get(k);
      if (id === undefined) return 0;
      if (id === tlId) return 1;
      return m.get(id) || 0;
    };

    // Satış günlerinin kurları (gün başına tek sorgu)
    const gunKurlari = new Map<string, Map<number, number>>();
    for (const r of ham) {
      const g = gun(r.SATIS_TARIHI);
      if (g && !gunKurlari.has(g)) gunKurlari.set(g, await kurTarihte(pool, g));
    }

    const satirlar = ham.map((r) => this.satirYap(r, varsayilan, guncel.kurlar, gunKurlari, kurOf, tlId));
    const ozet = this.ozetYap(satirlar, varsayilan);
    return { satirlar, ozet, kurAciklama: guncel.aciklama, filtreOzeti: this.filtreOzeti(f), toplamKayit: satirlar.length };
  }

  private static satirYap(
    r: UrunStokSatirHam, varsayilan: string, guncel: Map<number, number>, gunKurlari: Map<string, Map<number, number>>,
    kurOf: (m: Map<number, number>, kod: string) => number, tlId: number,
  ): UrunStokSatir {
    const birim = (r.MALIYET_PARA_KODU || varsayilan).trim().toUpperCase();
    const satisParaKodu = (r.SATIS_PARA_KODU || birim).trim().toUpperCase();
    const satisGunu = gun(r.SATIS_TARIHI);
    const satildi = !!r.SATILDI || r.FATURA_ID != null;
    const kurTablosu = satisGunu ? gunKurlari.get(satisGunu) || guncel : guncel;
    const kur = kurOf(kurTablosu, birim);

    const maliyet = Number(r.MALIYET || 0);
    const maliyetTl = maliyet * kur;

    let satis = 0, satisTl = 0;
    if (r.FATURA_ID != null) {
      // Gerçekleşen satış: fatura satırı tutarı (KDV hariç) → TL → ürün birimi
      const faturaParaTl = r.FATURA_PARA_ID == null || r.FATURA_PARA_ID === tlId || !r.FATURA_KUR ? 1 : Number(r.FATURA_KUR);
      satisTl = Number(r.SATIS_TUTAR || 0) * faturaParaTl;
      satis = kur > 0 ? satisTl / kur : 0;
    } else {
      // Stokta: etiket satış fiyatı
      const fiyat = Number(r.SATIS_FIYATI || 0);
      const satisKur = kurOf(kurTablosu, satisParaKodu);
      satisTl = fiyat * satisKur;
      satis = satisParaKodu === birim ? fiyat : kur > 0 ? satisTl / kur : 0;
    }

    const kar = satis - maliyet;
    const karTl = satisTl - maliyetTl;
    const karYuzde = maliyet > 0 ? y2((kar / maliyet) * 100) : null;
    const grupKodu = (r.GRUP_KODU || "").trim();

    return {
      urunId: Number(r.URUN_ID),
      tarih: gun(r.TARIH),
      grupKodu,
      urunNo: r.URUN_NO == null ? null : Number(r.URUN_NO),
      grupUrun: r.URUN_NO == null ? grupKodu : `${grupKodu}-${r.URUN_NO}`,
      barkod: (r.BARKOD || "").trim(),
      urunAdi: (r.URUN_ADI || "").trim(),
      ayar: (r.AYAR || "").trim(),
      ureticiFirma: (r.URETICI_FIRMA || "").trim(),
      orjinalKod: (r.ORJINAL_KOD || "").trim(),
      banko: (r.BANKO || "").trim(),
      miktar: Number(r.MIKTAR || 0),
      miktarBirimi: (r.MIKTAR_BIRIMI || "").trim(),
      hasGram: r.HAS_GRAM == null ? null : Number(r.HAS_GRAM),
      birim,
      maliyet: y4(maliyet),
      maliyetTl: y2(maliyetTl),
      satis: y4(satis),
      satisTl: y2(satisTl),
      kar: y4(kar),
      karTl: y2(karTl),
      karYuzde,
      satildi,
      durum: satildi ? "Satıldı" : "Stokta",
      satisTarihi: satisGunu,
      faturaNo: (r.FATURA_NO || "").trim(),
      musteri: (r.MUSTERI || "").trim(),
      cariKartId: r.CARI_KART_ID == null ? null : Number(r.CARI_KART_ID),
      kur: y4(kur),
    };
  }

  /** Stokta / Satıldı / Toplam. Birim toplamları yalnızca varsayılan birimdeki satırları kapsar; TL toplamları tümünü. */
  private static ozetYap(satirlar: UrunStokSatir[], birim: string): UrunStokOzetSatiri[] {
    const bos = (durum: string): UrunStokOzetSatiri => ({ durum, adet: 0, miktar: 0, hasGram: 0, birim, maliyet: 0, maliyetTl: 0, satis: 0, satisTl: 0, kar: 0, karTl: 0, karYuzde: null });
    const stokta = bos("Stokta"), satildi = bos("Satıldı"), toplam = bos("Toplam");
    for (const s of satirlar) {
      for (const o of [s.satildi ? satildi : stokta, toplam]) {
        o.adet += 1; o.miktar += s.miktar; o.hasGram += s.hasGram || 0;
        o.maliyetTl += s.maliyetTl; o.satisTl += s.satisTl; o.karTl += s.karTl;
        if (s.birim === birim) { o.maliyet += s.maliyet; o.satis += s.satis; o.kar += s.kar; }
      }
    }
    for (const o of [stokta, satildi, toplam]) {
      o.miktar = y4(o.miktar); o.hasGram = y4(o.hasGram);
      o.maliyet = y4(o.maliyet); o.satis = y4(o.satis); o.kar = y4(o.kar);
      o.maliyetTl = y2(o.maliyetTl); o.satisTl = y2(o.satisTl); o.karTl = y2(o.karTl);
      o.karYuzde = o.maliyetTl > 0 ? y2((o.karTl / o.maliyetTl) * 100) : null;
    }
    return [stokta, satildi, toplam];
  }

  private static filtreOzeti(f: UrunStokFiltre) {
    const p: string[] = [];
    if (f.baslangic || f.bitis) p.push(`${trTarih(f.baslangic || null)} – ${trTarih(f.bitis || null)} (${f.tarihTuru === "kayit" ? "kayıt tarihi" : "satış tarihi"})`);
    p.push(`Durum: ${f.durum === "stokta" ? "Stokta" : f.durum === "satildi" ? "Satıldı" : "Tümü"}`);
    if (f.ayar) p.push(`Ayar: ${f.ayar}`);
    if (f.grupKodu) p.push(`Grup: ${f.grupKodu}`);
    if (f.ureticiFirma) p.push(`Üretici: ${f.ureticiFirma}`);
    if (f.banko) p.push(`Banko: ${f.banko}`);
    if (f.cariKartId) p.push(`Cari: ${f.cariKartId}`);
    if (f.search) p.push(`Arama: ${f.search}`);
    return p.join(" · ");
  }

  static secenekler(tip: UrunStokTipi, ctx?: DbContext) { return UrunStokSqlRepository.secenekler(tip, ctx); }

  // ─── PDF / Excel ────────────────────────────────────────────────────────────
  private static tanim(tip: UrunStokTipi): RaporTanim {
    const birim = this.varsayilanBirim(tip);
    const altin = tip === "altin";
    const kolonlar: RaporKolon[] = [
      { anahtar: "tarih", baslik: "Kayıt", g: 1.2, bicim: "tarih" },
      { anahtar: "grupUrun", baslik: "Grup-No", g: 1.2 },
      { anahtar: "barkod", baslik: "Barkod", g: 1.5 },
      { anahtar: "urunAdi", baslik: altin ? "Model" : "Mamul", g: 2 },
      { anahtar: "ayar", baslik: "Ayar", g: 0.7, hiza: "center" },
      { anahtar: "miktar", baslik: altin ? "Gram" : "Miktar", g: 1, bicim: "sayi", toplam: true },
      ...(altin ? [{ anahtar: "hasGram", baslik: "Has gr", g: 1, bicim: "sayi4" as const, toplam: true }] : []),
      { anahtar: "maliyet", baslik: `Maliyet ${birim}`, g: 1.2, bicim: "sayi4", toplam: true },
      { anahtar: "maliyetTl", baslik: "Maliyet TL", g: 1.3, bicim: "sayi", toplam: true },
      { anahtar: "satis", baslik: `Satış ${birim}`, g: 1.2, bicim: "sayi4", toplam: true },
      { anahtar: "satisTl", baslik: "Satış TL", g: 1.3, bicim: "sayi", toplam: true },
      { anahtar: "kar", baslik: `Kâr ${birim}`, g: 1.2, bicim: "sayi4", toplam: true },
      { anahtar: "karTl", baslik: "Kâr TL", g: 1.3, bicim: "sayi", toplam: true },
      { anahtar: "karYuzde", baslik: "Kâr %", g: 0.8, bicim: "sayi" },
      { anahtar: "durum", baslik: "Durum", g: 0.9, hiza: "center" },
      { anahtar: "satisTarihi", baslik: "Satış T.", g: 1.2, bicim: "tarih" },
      { anahtar: "faturaNo", baslik: "Fatura", g: 1.2, pdf: false },
      { anahtar: "musteri", baslik: "Müşteri", g: 1.8 },
      { anahtar: "ureticiFirma", baslik: "Üretici", g: 1.4, pdf: false },
      { anahtar: "banko", baslik: "Banko", g: 0.9, pdf: false },
      { anahtar: "kur", baslik: `${birim} kuru`, g: 1, bicim: "kur", pdf: false },
    ];
    return {
      kod: altin ? "ALTSTK1" : "OZLSTK1",
      ad: this.baslik(tip),
      kagit: "A4-yatay",
      parametreler: [],
      kolonlar,
      ozet: {
        baslik: "Özet",
        kolonlar: [
          { anahtar: "durum", baslik: "Durum", g: 1.2 },
          { anahtar: "adet", baslik: "Adet", g: 0.8, bicim: "tam" },
          { anahtar: "miktar", baslik: altin ? "Gram" : "Miktar", g: 1, bicim: "sayi" },
          ...(altin ? [{ anahtar: "hasGram", baslik: "Has gr", g: 1, bicim: "sayi4" as const }] : []),
          { anahtar: "maliyet", baslik: `Maliyet ${birim}`, g: 1.2, bicim: "sayi4" },
          { anahtar: "maliyetTl", baslik: "Maliyet TL", g: 1.3, bicim: "sayi" },
          { anahtar: "satis", baslik: `Satış ${birim}`, g: 1.2, bicim: "sayi4" },
          { anahtar: "satisTl", baslik: "Satış TL", g: 1.3, bicim: "sayi" },
          { anahtar: "kar", baslik: `Kâr ${birim}`, g: 1.2, bicim: "sayi4" },
          { anahtar: "karTl", baslik: "Kâr TL", g: 1.3, bicim: "sayi" },
          { anahtar: "karYuzde", baslik: "Kâr %", g: 0.8, bicim: "sayi" },
        ],
      },
    };
  }

  private static async firma(ctx?: DbContext): Promise<RaporFirma> {
    const f = await EbelgeSqlRepository.getFirmaBilgisi(ctx as any).catch(() => ({ vkn: "", unvan: "" } as any));
    return { ad: f?.unvan || "", vkn: f?.vkn || "" };
  }

  private static async girdi(tip: UrunStokTipi, f: UrunStokFiltre, kullanici: string, ctx?: DbContext) {
    const v = await this.veri(tip, f, ctx);
    const tanim = this.tanim(tip);
    // PDF/Excel'de satılmayanların "satış" kolonu etiket fiyatıdır; özet bunu ayırır
    return { tanim, satirlar: v.satirlar, filtreOzeti: v.filtreOzeti, firma: await this.firma(ctx), kullanici, ekDipnot: v.kurAciklama, ozetSatirlar: v.ozet };
  }

  static async pdf(tip: UrunStokTipi, f: UrunStokFiltre, kullanici: string, ctx?: DbContext) {
    const g = await this.girdi(tip, f, kullanici, ctx);
    return { pdf: await raporPdf(g), kod: g.tanim.kod };
  }

  static async excel(tip: UrunStokTipi, f: UrunStokFiltre, kullanici: string, ctx?: DbContext) {
    const g = await this.girdi(tip, f, kullanici, ctx);
    return { xlsx: await raporExcel(g), kod: g.tanim.kod };
  }
}
