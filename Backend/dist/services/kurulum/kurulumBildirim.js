import { env } from "../../config/env.config.js";
import { logger } from "../../utils/logger.js";
import { calisanSurum } from "../../utils/surum.js";
import { semaSurumu } from "../semaGoc.service.js";
import { kurulumFirmasi } from "./firmaDosyasi.js";
import { kurulumHavuzu } from "./kurulumDb.js";
import { KurulumLisansService } from "./kurulumLisans.service.js";
const ILK_GECIKME_MS = 30_000;
const BILDIRIM_ARALIGI_MS = 6 * 60 * 60 * 1000;
const SAAT_ILERLETME_MS = 10 * 60 * 1000;
let guncellemeDinleyici = null;
let sonBasari = null;
let sonHata = null;
export const merkezAdresi = () => (kurulumFirmasi()?.merkez || env.MERKEZ_ADRESI).replace(/\/+$/, "");
export class KurulumBildirim {
    /** Güncelleyici (Faz 6) yeni sürüm bilgisini buradan alır. */
    static guncellemeDinle(fn) {
        guncellemeDinleyici = fn;
    }
    static durum() {
        return { sonBasari, sonHata, merkez: merkezAdresi() };
    }
    static async gonder(fetchFn = fetch) {
        const firma = kurulumFirmasi();
        if (!firma)
            return { basarili: false, hata: "firma.lky yok" };
        const lisans = await KurulumLisansService.durum(true);
        let kullaniciSayisi = null;
        let sema = null;
        try {
            const pool = await kurulumHavuzu();
            kullaniciSayisi = (await pool.request().query(`SELECT COUNT(*) AS N FROM dbo.TODVZ_KULLANICI`)).recordset[0].N;
            sema = await semaSurumu(pool);
        }
        catch {
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
        let json;
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
            if (!r.ok)
                throw new Error(json?.message || `HTTP ${r.status}`);
        }
        catch (err) {
            sonHata = String(err?.message || err);
            return { basarili: false, hata: sonHata };
        }
        const d = json?.data || {};
        const sonuc = { basarili: true, guncelleme: d.guncelleme ?? null };
        if (d.sunucuZamani)
            await KurulumLisansService.merkezSaatiniDenetle(Date.parse(d.sunucuZamani)).catch(() => undefined);
        if (d.lisansKodu) {
            try {
                await KurulumLisansService.yukle(d.lisansKodu);
                sonuc.lisansYuklendi = true;
                logger.info("[KURULUM] Merkezden yeni lisans kodu yüklendi.");
            }
            catch (err) {
                logger.warn(`[KURULUM] Merkezden gelen lisans kodu yüklenemedi: ${err?.message}`);
            }
        }
        if (d.guncelleme && guncellemeDinleyici)
            guncellemeDinleyici(d.guncelleme, merkezAdresi());
        sonBasari = new Date();
        sonHata = null;
        return sonuc;
    }
    static baslat() {
        if (!env.KURULUM_MODU)
            return;
        setTimeout(() => void this.gonder(), ILK_GECIKME_MS).unref();
        setInterval(() => void this.gonder(), BILDIRIM_ARALIGI_MS).unref();
        // Program boşta dursa da saat ilerlemesi kaydedilsin (saat geri alma denetimi)
        setInterval(() => void KurulumLisansService.durum(true).catch(() => undefined), SAAT_ILERLETME_MS).unref();
    }
}
