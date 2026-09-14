import { RaporSqlRepository } from "../../models/raporSql.repository.js";
import { EbelgeSqlRepository } from "../../models/ebelgeSql.repository.js";
import type { DbContext } from "../../models/belgeSql.repository.js";
import { ApiError } from "../../utils/ApiError.js";
import { raporTanimOku, raporPdf } from "./raporMotor.js";
import { raporExcel } from "./raporExcel.js";
import { RAPOR_SORGULARI, type RaporParametreler } from "./raporVeri.js";
import type { RaporTanim, RaporSonucVeri, RaporFirma } from "./raporTanim.js";

export class RaporService {
  static async sablonlar(ctx?: DbContext) {
    const kayitlar = await RaporSqlRepository.sablonlar(ctx);
    return kayitlar.map(k => { const t = guvenliTanim(k.kod); return { ...k, aciklama: t?.aciklama || "", parametreler: t?.parametreler || [] }; });
  }

  static tanim(kod: string): RaporTanim {
    const t = raporTanimOku(kod.toUpperCase());
    if (!RAPOR_SORGULARI[t.kod]) throw ApiError.notFound(`Rapor sorgusu tanımlı değil: ${t.kod}`);
    return t;
  }

  static async veri(kod: string, p: RaporParametreler, ctx?: DbContext): Promise<RaporSonucVeri & { tanim: RaporTanim }> {
    const tanim = this.tanim(kod);
    const pool = await RaporSqlRepository.pool(ctx);
    const sonuc = await RAPOR_SORGULARI[tanim.kod](pool, p, tanim);
    return { ...sonuc, tanim: kosulUygula(kmtUygula(tanim, p.kmt), p) };
  }

  /** Kayıtlı aramalar (kullanıcı × rapor) */
  static aramalar(kullanici: string, kod: string, ctx?: DbContext) { return RaporSqlRepository.aramalar(kullanici, this.tanim(kod).kod, ctx); }
  static aramaKaydet(kullanici: string, kod: string, parametreler: Record<string, any>, ozet: string, ctx?: DbContext) {
    return RaporSqlRepository.aramaKaydet(kullanici, this.tanim(kod).kod, parametreler, ozet, ctx);
  }
  static aramaSil(kullanici: string, kod: string, aramaId: number | undefined, ctx?: DbContext) { return RaporSqlRepository.aramaSil(kullanici, this.tanim(kod).kod, aramaId, ctx); }

  private static async firma(ctx?: DbContext): Promise<RaporFirma> {
    const f = await EbelgeSqlRepository.getFirmaBilgisi(ctx).catch(() => ({ vkn: "", unvan: "" } as any));
    return { ad: f?.unvan || "", vkn: f?.vkn || "" };
  }

  static async pdf(kod: string, p: RaporParametreler, kullanici: string, ctx?: DbContext) {
    const v = await this.veri(kod, p, ctx);
    if (v.sinirAsildi) throw ApiError.badRequest(`Rapor ${v.toplamKayit} satır üretiyor; üst sınır ${v.tanim.ustSinir || 5000}. Tarih aralığını daraltın.`);
    const firma = await this.firma(ctx);
    return { pdf: await raporPdf({ tanim: v.tanim, satirlar: v.satirlar, filtreOzeti: v.filtreOzeti, firma, kullanici, ekDipnot: v.ekDipnot }), tanim: v.tanim };
  }

  static async excel(kod: string, p: RaporParametreler, kullanici: string, ctx?: DbContext) {
    const v = await this.veri(kod, p, ctx);
    if (v.sinirAsildi) throw ApiError.badRequest(`Rapor ${v.toplamKayit} satır üretiyor; üst sınır ${v.tanim.ustSinir || 5000}. Tarih aralığını daraltın.`);
    const firma = await this.firma(ctx);
    return { xlsx: await raporExcel({ tanim: v.tanim, satirlar: v.satirlar, filtreOzeti: v.filtreOzeti, firma, kullanici, ekDipnot: v.ekDipnot }), tanim: v.tanim };
  }
}

function guvenliTanim(kod: string): RaporTanim | null { try { return raporTanimOku(kod); } catch { return null; } }

/** Koşullu kolonlar: kurIkisi → yalnızca Kur alanı "Alış + Satış" iken */
function kosulUygula(tanim: RaporTanim, p: RaporParametreler): RaporTanim {
  if (!tanim.kolonlar.some(k => k.kosul)) return tanim;
  return { ...tanim, kolonlar: tanim.kolonlar.filter(k => !k.kosul || (k.kosul === "kurIkisi" && p.kurAlani === "ikisi")) };
}

/** KMT (Kur / Miktar / TL) gösterimi: seçilince yalnızca o gruba ait ve etiketsiz kolonlar kalır (kâr-zarar, .rpt parametresi). */
function kmtUygula(tanim: RaporTanim, kmt?: string): RaporTanim {
  const secim = (kmt || "").toUpperCase();
  if (!["K", "M", "T"].includes(secim) || !tanim.kolonlar.some(k => k.kmt)) return tanim;
  return { ...tanim, kolonlar: tanim.kolonlar.filter(k => !k.kmt || k.kmt === secim) };
}
