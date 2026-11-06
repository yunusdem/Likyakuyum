import { MobilKullaniciSqlRepository } from "../../models/admin/mobilKullaniciSql.repository.js";
import type { DbBaglam } from "../../models/mobilFirmaSql.repository.js";
import { MobilEmir, MobilEmirSqlRepository } from "../../models/mobilEmirSql.repository.js";
import { logger } from "../../utils/logger.js";
import { mailGonder, mailYapilandirildiMi } from "../mail.service.js";
import { EMIR_DURUM_ADLARI, OdemeTercihi, TERCIH_ADLARI } from "./mobilKural.js";

/**
 * Mobil emir bildirimleri (docs/MOBIL_CARI_YOL_HARITASI.md K12, K33): yeni emirde firmanın bildirim adreslerine, onay / ret /
 * süre dolumunda carinin e-postasına. Posta gönderilemezse emir akışı durmaz (günlüğe yazılır). Süresi dolan emirler bekleyen
 * emri olan firmalarda 30 sn'de bir işaretlenir (liste açılınca da).
 */

export interface Posta {
  kime: string;
  konu: string;
  html: string;
  metin: string;
}

const kac = (v: unknown) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const tl = (n: number) => Number(n || 0).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const sayi = (n: number) => Number(n || 0).toLocaleString("tr-TR", { maximumFractionDigits: 6 });
/** Veritabanı DATETIME'ı sürücüde UTC sayılır (duvar saati) */
const saatYaz = (d: Date | null | undefined) => (d ? new Date(d).toLocaleString("tr-TR", { timeZone: "UTC", dateStyle: "short", timeStyle: "short" }) : "-");

const yonAdi = (yon: string) => (yon === "AL" ? "ALIŞ (cari alıyor, firma satıyor)" : "SATIŞ (cari satıyor, firma alıyor)");

/** Emrin satırları + özet (posta gövdesi) */
const emirOzeti = (e: MobilEmir) => {
  const satirlar = e.satirlar.map((s) => `${sayi(s.miktar)} ${s.birim || ""} ${s.urunAd || s.urunKod || ""} × ${sayi(s.birimFiyat)} = ${tl(s.tutar)} TL`);
  const tercih = e.tercih ? TERCIH_ADLARI[e.tercih as OdemeTercihi] || e.tercih : "-";
  return { satirlar, tercih };
};

export const yeniEmirPostasi = (e: MobilEmir, firmaAdi: string): Omit<Posta, "kime"> => {
  const { satirlar, tercih } = emirOzeti(e);
  const konu = `Mobil emir #${e.emirId}: ${e.cariAd || e.cariKod || "cari"} — ${e.yon === "AL" ? "Alış" : "Satış"} ${tl(e.toplamTl)} TL`;
  const alanlar: [string, string][] = [
    ["Firma", firmaAdi],
    ["Cari", `${e.cariKod || ""} ${e.cariAd || ""}`.trim()],
    ["Mobil kullanıcı", e.mobilKullaniciAdi || "-"],
    ["İşlem", yonAdi(e.yon)],
    ["Ürün", satirlar.join("; ")],
    ["Toplam", `${tl(e.toplamTl)} TL`],
    ["Ödeme / teslim tercihi", tercih],
    ["Not", e.notu || "-"],
    ["Fiyat geçerliliği", `${saatYaz(e.gecerlilikBitis)} saatine kadar`],
  ];
  const metin = [`Yeni mobil emir (#${e.emirId}) onayınızı bekliyor.`, ...alanlar.map(([a, d]) => `${a}: ${d}`), "", "Onay / ret: Likya ERP › Mobil › Mobil Emirler"].join("\n");
  const html = `<p>Yeni mobil emir <b>#${e.emirId}</b> onayınızı bekliyor.</p><table cellpadding="4" style="border-collapse:collapse">${alanlar
    .map(([a, d]) => `<tr><td style="color:#555">${kac(a)}</td><td><b>${kac(d)}</b></td></tr>`)
    .join("")}</table><p>Onay / ret: Likya ERP › Mobil › Mobil Emirler</p>`;
  return { konu, html, metin };
};

export const sonucPostasi = (e: MobilEmir, kisaAd: string): Omit<Posta, "kime"> => {
  const { satirlar } = emirOzeti(e);
  const durum = EMIR_DURUM_ADLARI[e.durum] || e.durum;
  const konu = `${kisaAd}: emriniz ${durum.toLocaleLowerCase("tr-TR")} (#${e.emirId})`;
  const ek =
    e.durum === "ONAYLANDI"
      ? `İşleminiz kesinleşti${e.fisNo ? `; fiş no ${e.fisNo}` : ""}. Fişinizi mobil uygulamada Hesabım › Fişlerim'den görebilirsiniz.`
      : e.durum === "REDDEDILDI"
        ? `Firma emrinizi kabul etmedi${e.redNedeni ? `: ${e.redNedeni}` : "."}`
        : e.durum === "SURESI_DOLDU"
          ? "Fiyat geçerlilik süresi içinde onaylanmadığı için emriniz düştü. Güncel fiyatla yeniden emir verebilirsiniz."
          : "";
  const metin = [`Emir #${e.emirId} — ${durum}`, `${e.yon === "AL" ? "Alış" : "Satış"}: ${satirlar.join("; ")}`, `Toplam: ${tl(e.toplamTl)} TL`, ek].join("\n");
  const html = `<p>Emir <b>#${e.emirId}</b> — <b>${kac(durum)}</b></p><p>${kac(e.yon === "AL" ? "Alış" : "Satış")}: ${kac(satirlar.join("; "))}<br>Toplam: <b>${kac(tl(e.toplamTl))} TL</b></p><p>${kac(ek)}</p>`;
  return { konu, html, metin };
};

const izlenenler = new Map<number, { ctx: DbBaglam; kisaAd: () => Promise<string> }>();
let zamanlayici: NodeJS.Timeout | null = null;

export class MobilBildirimService {
  /** Posta gönderici (testlerde değiştirilir) */
  public static gonderici: (p: Posta) => Promise<void> = mailGonder;
  /** Posta açık mı (testlerde değiştirilir) */
  public static postaAcik: () => boolean = mailYapilandirildiMi;

  private static async gonder(p: Posta): Promise<boolean> {
    if (!p.kime) return false;
    if (!this.postaAcik()) {
      logger.warn(`[MOBIL] Posta ayarı yok; gönderilmedi: ${p.konu}`);
      return false;
    }
    try {
      await this.gonderici(p);
      return true;
    } catch (err: any) {
      logger.error(`[MOBIL] Posta gönderilemedi (${p.kime}): ${err?.message}`);
      return false;
    }
  }

  /** Yeni emir: firmanın bildirim adreslerine (K12, K33) */
  public static async yeniEmir(e: MobilEmir, firmaAdi: string, adresler: string[]): Promise<boolean> {
    if (adresler.length === 0) return false;
    return this.gonder({ kime: adresler.join(","), ...yeniEmirPostasi(e, firmaAdi) });
  }

  /** Onay / ret / süre dolumu: carinin (mobil kullanıcının) e-postasına */
  public static async cariyeSonuc(e: MobilEmir, kisaAd: string): Promise<boolean> {
    const k = await MobilKullaniciSqlRepository.kullanici(e.mobilKullaniciId).catch(() => null);
    if (!k?.eposta) return false;
    return this.gonder({ kime: k.eposta, ...sonucPostasi(e, kisaAd) });
  }

  /** Süresi dolanları işaretler ve carilere bildirir */
  public static async sureleriIsle(ctx: DbBaglam, kisaAd: string): Promise<number> {
    const dolanlar = await MobilEmirSqlRepository.suresiDolanlariIsle(ctx);
    for (const d of dolanlar) {
      const e = await MobilEmirSqlRepository.getir(ctx, d.emirId);
      if (e) await this.cariyeSonuc(e, kisaAd);
    }
    return dolanlar.length;
  }

  /** Bekleyen emri olan firma 30 sn'de bir denetlenir; bekleyen kalmayınca izlemeden çıkar */
  public static izle(firmaId: number, ctx: DbBaglam, kisaAdGetir: () => Promise<string>): void {
    izlenenler.set(firmaId, { ctx, kisaAd: kisaAdGetir });
    if (zamanlayici) return;
    zamanlayici = setInterval(async () => {
      for (const [id, f] of [...izlenenler]) {
        try {
          await this.sureleriIsle(f.ctx, await f.kisaAd().catch(() => "Likya"));
          if (!(await MobilEmirSqlRepository.bekleyenVarMi(f.ctx))) izlenenler.delete(id);
        } catch (err: any) {
          logger.warn(`[MOBIL] Süre denetimi (firma ${id}): ${err?.message}`);
        }
      }
      if (izlenenler.size === 0 && zamanlayici) {
        clearInterval(zamanlayici);
        zamanlayici = null;
      }
    }, 30_000);
    zamanlayici.unref?.();
  }
}
