import crypto from "crypto";
import { env } from "../../config/env.config.js";
import { imzaliMetinCoz } from "../lisans/lisansKodu.js";
import { logger } from "../../utils/logger.js";
import { calisanSurum } from "../../utils/surum.js";
import { semaSurumu } from "../semaGoc.service.js";
import { kurulumFirmasi } from "./firmaDosyasi.js";
import { kurulumHavuzu } from "./kurulumDb.js";
import { KurulumLisansService } from "./kurulumLisans.service.js";
import { vtBoyutuMb, yedekDurumu } from "./kurulumYedek.js";

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
const KILITLI_BILDIRIM_ARALIGI_MS = 5 * 60 * 1000;
const SAAT_ILERLETME_MS = 10 * 60 * 1000;

let guncellemeDinleyici: ((g: GuncellemeBilgisi, merkez: string) => void) | null = null;
let sonBasari: Date | null = null;
let sonHata: string | null = null;
let sonYazilanHata: string | null = null;
let sonHataGunlugu = 0;
const HATA_GUNLUK_ARALIGI_MS = 60 * 60 * 1000;

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

    const yedek = yedekDurumu();
    const saatSorusu = crypto.randomBytes(16).toString("hex");
    const govde = {
      saatSorusu,
      firmaKodu: firma.firmaKodu,
      kurulumAnahtari: firma.kurulumAnahtari,
      makineKimligi: lisans.makineKimligi || null,
      surum: calisanSurum(),
      lisans: { durum: lisans.durum, neden: lisans.neden, seri: lisans.seri },
      kullaniciSayisi,
      semaSurumu: sema,
      // Son yedek ve veritabanı boyutu panelde görünür (docs 15.1, Y5; Express sınırı 10 GB)
      yedek: { son: yedek.sonYedek, hata: yedek.hata, vtBoyutMb: (await vtBoyutuMb()) ?? yedek.vtBoyutMb },
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
      // Ayrıntı (TLS / vekil sunucu / DNS kodu) günlüğe yazılır; aynı hata saatte en çok bir kez (E26)
      const kod = err?.cause?.code || err?.code || "";
      sonHata = String(err?.message || err) + (kod && !String(err?.message || "").includes(kod) ? ` (${kod})` : "");
      if (sonHata !== sonYazilanHata || Date.now() - sonHataGunlugu > HATA_GUNLUK_ARALIGI_MS) {
        logger.warn(`[KURULUM] Merkeze bildirim gönderilemedi (${merkezAdresi()}): ${sonHata}`);
        sonYazilanHata = sonHata;
        sonHataGunlugu = Date.now();
      }
      return { basarili: false, hata: sonHata };
    }

    const d = json?.data || {};
    const sonuc: BildirimSonucu = { basarili: true, guncelleme: d.guncelleme ?? null };
    if (d.sunucuZamani) await KurulumLisansService.merkezSaatiniDenetle(Date.parse(d.sunucuZamani)).catch(() => undefined);
    // Saat kilidi (SAAT_GERI_ALINDI): merkezin imzalı saati bilgisayar saatini doğruluyorsa kalkar (docs 15.2, E28)
    if (d.saatOnayi) {
      try {
        const o = imzaliMetinCoz<{ firmaKodu: string; soru: string; zaman: string }>("LKS1", d.saatOnayi);
        if (o.firmaKodu === firma.firmaKodu && o.soru === saatSorusu && (await KurulumLisansService.saatKilidiniMerkezleAc(Date.parse(o.zaman)))) {
          sonuc.lisansYuklendi = true;
        }
      } catch (err: any) {
        logger.warn(`[KURULUM] Merkezin saat onayı doğrulanamadı: ${err?.message}`);
      }
    }
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
    // Program kilitliyken (lisans yok / doldu / makine değişti) 5 dakikada bir: panelde üretilen kod 6 saat beklemeden insin
    setInterval(
      () =>
        void KurulumLisansService.durum()
          .then((d) => (d.durum === "KILITLI" ? this.gonder() : undefined))
          .catch(() => undefined),
      KILITLI_BILDIRIM_ARALIGI_MS
    ).unref();
    // Program boşta dursa da saat ilerlemesi kaydedilsin (saat geri alma denetimi)
    setInterval(() => void KurulumLisansService.durum(true).catch(() => undefined), SAAT_ILERLETME_MS).unref();
  }
}
