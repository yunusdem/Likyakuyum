import { BelgeSqlRepository, type DbContext } from "../../models/belgeSql.repository.js";
import { belgeKlasoruGorseli } from "./belgeMotor.js";
import { etkinSablon } from "./sablonDeposu.js";
import { BelgeGorselService } from "./belgeGorsel.service.js";
import type { BelgeSablon } from "./sablonCekirdek.js";
import { turBul, type FisBicimi, type FisTuru } from "./belgeTurleri.js";
import {
  dovizFisVerisi, firmaKimlikOku, perakendeFisVerisi, sarrafFisVerisi,
  type DovizFisGirdisi, type PerakendeFisGirdisi, type SarrafFisGirdisi,
} from "./fisCiktiVeri.js";

/** Tarayıcının fişi çizmesi için gereken her şey: şablon, veri ve şablondaki görseller (data URL). */
export interface FisCiktisi {
  tur: FisTuru;
  sablon: BelgeSablon;
  veri: Record<string, any>;
  gorseller: Record<string, string>;
}

const MIME: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg" };

/** Şablondaki resim öğelerinin dosyalarını data URL olarak toplar (yazıcı HTML'i tek parça gider). */
export function sablonGorselleri(sablon: BelgeSablon): Record<string, string> {
  const sonuc: Record<string, string> = {};
  for (const o of sablon.ogeler) {
    if (o.tip !== "resim" || sonuc[o.dosya]) continue;
    const bayt = belgeKlasoruGorseli(o.dosya);
    const uzanti = String(o.dosya).split(".").pop()?.toLowerCase() || "";
    if (bayt && MIME[uzanti]) sonuc[o.dosya] = `data:${MIME[uzanti]};base64,${bayt.toString("base64")}`;
  }
  return sonuc;
}

export class FisCiktiService {
  /** Belge türünün etkin şablonu: firmanın kendi şablonu (geçerliyse), yoksa varsayılan. */
  static async sablon(tur: FisTuru, ctx?: DbContext): Promise<BelgeSablon> {
    return (await etkinSablon(tur, ctx)).sablon;
  }

  private static async paketle(tur: FisTuru, veri: Record<string, any>, ctx?: DbContext): Promise<FisCiktisi> {
    const sablon = await this.sablon(tur, ctx);
    return { tur, sablon, veri, gorseller: { ...sablonGorselleri(sablon), ...(await BelgeGorselService.harita(sablon, ctx)) } };
  }

  /** Döviz fişi: ekran görüntüsü + firma kimliği + (kayıtlıysa) belge no / ETTN. */
  static async doviz(girdi: DovizFisGirdisi, ctx?: DbContext): Promise<FisCiktisi> {
    const [firmaSatiri, kayit] = await Promise.all([
      BelgeSqlRepository.firmaKimlikSatiri(ctx),
      girdi.fisId ? BelgeSqlRepository.dovizFisKimligi(Number(girdi.fisId), ctx) : Promise.resolve(null),
    ]);
    return this.paketle("DOVIZ_FIS", dovizFisVerisi(girdi, firmaKimlikOku(firmaSatiri), kayit || {}), ctx);
  }

  /** Sarraf fişi: ekran görüntüsü + firma kimliği; kâğıt 80 mm veya A4. */
  static async sarraf(girdi: SarrafFisGirdisi, bicim: FisBicimi, ctx?: DbContext): Promise<FisCiktisi> {
    const firma = firmaKimlikOku(await BelgeSqlRepository.firmaKimlikSatiri(ctx));
    return this.paketle(turBul("SARRAF", bicim), sarrafFisVerisi(girdi, firma), ctx);
  }

  /** Perakende fişi / fatura: kayıtlı fatura veya kayıt yükü + firma kimliği; kâğıt 80 mm veya A4. */
  static async perakende(girdi: PerakendeFisGirdisi, bicim: FisBicimi, ctx?: DbContext): Promise<FisCiktisi> {
    const firma = firmaKimlikOku(await BelgeSqlRepository.firmaKimlikSatiri(ctx));
    return this.paketle(turBul("PERAKENDE", bicim), perakendeFisVerisi(girdi, firma), ctx);
  }
}
