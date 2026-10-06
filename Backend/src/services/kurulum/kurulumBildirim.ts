import { env } from "../../config/env.config.js";
import { logger } from "../../utils/logger.js";
import { calisanSurum } from "../../utils/surum.js";
import { semaSurumu } from "../semaGoc.service.js";
import { kurulumFirmasi } from "./firmaDosyasi.js";
import { kurulumHavuzu } from "./kurulumDb.js";
import { KurulumLisansService } from "./kurulumLisans.service.js";

/**
 * Kurulumun merkeze bildirimi (heartbeat, K12): internet varken açılışta ve 6 saatte bir sürüm, makine kimliği,
 * lisans durumu, kullanıcı sayısı gönderilir. Dönüşte varsa yeni lisans kodu yüklenir, merkez saati denetlenir,
 * güncelleme bilgisi güncelleyiciye verilir. İnternet yoksa sessizce sonraki denemeye kalır.
 */

export interface GuncellemeBilgisi {
  surum: string;
  yol: string;
  sha256: string;
  imza: string;
  boyut: number;
}

export interface BildirimSonucu {
  basarili: boolean;
  hata?: string;
  lisansYuklendi?: boolean;
  guncelleme?: GuncellemeBilgisi | null;
}

const ILK_GECIKME_MS = 30_000;
const BILDIRIM_ARALIGI_MS = 6 * 60 * 60 * 1000;
const SAAT_ILERLETME_MS = 10 * 60 * 1000;

let guncellemeDinleyici: ((g: GuncellemeBilgisi, merkez: string) => void) | null = null;
let sonBasari: Date | null = null;
let sonHata: string | null = null;

export const merkezAdresi = (): string => (kurulumFirmasi()?.merkez || env.MERKEZ_ADRESI).replace(/\/+$/, "");

export class KurulumBildirim {
  /** Güncelleyici (Faz 6) yeni sürüm bilgisini buradan alır. */
  public static guncellemeDinle(fn: (g: GuncellemeBilgisi, merkez: string) => void): void {
    guncellemeDinleyici = fn;
  }

  public static durum() {
    return { sonBasari, sonHata, merkez: merkezAdresi() };
  }

  public static async gonder(fetchFn: typeof fetch = fetch): Promise<BildirimSonucu> {
    const firma = kurulumFirmasi();
    if (!firma) return { basarili: false, hata: "firma.lky yok" };
    const lisans = await KurulumLisansService.durum(true);
    let kullaniciSayisi: number | null = null;
    let sema: number | null = null;
    try {
      const pool = await kurulumHavuzu();
      kullaniciSayisi = (await pool.request().query(`SELECT COUNT(*) AS N FROM dbo.TODVZ_KULLANICI`)).recordset[0].N;
      sema = await semaSurumu(pool);
    } catch {
      /* veritabanına ulaşılamıyorsa yine bildirilir */
    }

    const govde = {
      firmaKodu: firma.firmaKodu,
      kurulumAnahtari: firma.kurulumAnahtari,
      makineKimligi: lisans.makineKimligi || null,
      surum: calisanSurum(),
      lisans: { durum: lisans.durum, neden: lisans.neden, seri: lisans.seri },
      kullaniciSayisi,
      semaSurumu: sema,
    };

    let json: any;
    try {
      const ctrl = new AbortController();
      const zaman = setTimeout(() => ctrl.abort(), 20_000);
      const r = await fetchFn(`${merkezAdresi()}/api/v1/merkez/heartbeat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(govde),
        signal: ctrl.signal,
      }).finally(() => clearTimeout(zaman));
      json = await r.json().catch(() => null);
      if (!r.ok) throw new Error(json?.message || `HTTP ${r.status}`);
    } catch (err: any) {
      sonHata = String(err?.message || err);
      return { basarili: false, hata: sonHata };
    }

    const d = json?.data || {};
    const sonuc: BildirimSonucu = { basarili: true, guncelleme: d.guncelleme ?? null };
    if (d.sunucuZamani) await KurulumLisansService.merkezSaatiniDenetle(Date.parse(d.sunucuZamani)).catch(() => undefined);
    if (d.lisansKodu) {
      try {
        await KurulumLisansService.yukle(d.lisansKodu);
        sonuc.lisansYuklendi = true;
        logger.info("[KURULUM] Merkezden yeni lisans kodu yüklendi.");
      } catch (err: any) {
        logger.warn(`[KURULUM] Merkezden gelen lisans kodu yüklenemedi: ${err?.message}`);
      }
    }
    if (d.guncelleme && guncellemeDinleyici) guncellemeDinleyici(d.guncelleme, merkezAdresi());
    sonBasari = new Date();
    sonHata = null;
    return sonuc;
  }

  public static baslat(): void {
    if (!env.KURULUM_MODU) return;
    setTimeout(() => void this.gonder(), ILK_GECIKME_MS).unref();
    setInterval(() => void this.gonder(), BILDIRIM_ARALIGI_MS).unref();
    // Program boşta dursa da saat ilerlemesi kaydedilsin (saat geri alma denetimi)
    setInterval(() => void KurulumLisansService.durum(true).catch(() => undefined), SAAT_ILERLETME_MS).unref();
  }
}
