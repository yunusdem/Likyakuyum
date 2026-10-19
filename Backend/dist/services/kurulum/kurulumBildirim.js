import crypto from "crypto";
import { env } from "../../config/env.config.js";
import { imzaliMetinCoz } from "../lisans/lisansKodu.js";
import { logger } from "../../utils/logger.js";
import { calisanSurum } from "../../utils/surum.js";
import { semaSurumu } from "../semaGoc.service.js";
import { kurulumFirmasi } from "./firmaDosyasi.js";
import { kurulumHavuzu } from "./kurulumDb.js";
import { KurulumLisansService } from "./kurulumLisans.service.js";
import { ApiError } from "../../utils/ApiError.js";
import { vtBoyutuMb, yedekDurumu } from "./kurulumYedek.js";
const ILK_GECIKME_MS = 30_000;
const BILDIRIM_ARALIGI_MS = 6 * 60 * 60 * 1000;
const KILITLI_BILDIRIM_ARALIGI_MS = 5 * 60 * 1000;
const SAAT_ILERLETME_MS = 10 * 60 * 1000;
let guncellemeDinleyici = null;
let sonBasari = null;
let sonHata = null;
let sonYazilanHata = null;
let sonHataGunlugu = 0;
const HATA_GUNLUK_ARALIGI_MS = 60 * 60 * 1000;
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
        const sonuc = { basarili: true, guncelleme: d.guncelleme ?? null };
        if (d.sunucuZamani)
            await KurulumLisansService.merkezSaatiniDenetle(Date.parse(d.sunucuZamani)).catch(() => undefined);
        // Saat kilidi (SAAT_GERI_ALINDI): merkezin imzalı saati bilgisayar saatini doğruluyorsa kalkar (docs 15.2, E28)
        if (d.saatOnayi) {
            try {
                const o = imzaliMetinCoz("LKS1", d.saatOnayi);
                if (o.firmaKodu === firma.firmaKodu && o.soru === saatSorusu && (await KurulumLisansService.saatKilidiniMerkezleAc(Date.parse(o.zaman)))) {
                    sonuc.lisansYuklendi = true;
                }
            }
            catch (err) {
                logger.warn(`[KURULUM] Merkezin saat onayı doğrulanamadı: ${err?.message}`);
            }
        }
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
    /**
     * Aktivasyon anahtarıyla etkinleştirme (docs/BULUT_VE_EXE_LISANS_YOL_HARITASI.md 16, A3): anahtar + kurulum anahtarı +
     * makine kimliği merkeze gider, dönen imzalı kod yüklenir. Merkezin hata mesajı (geçersiz / başka bilgisayarda) aynen döner.
     */
    static async aktiflestir(anahtar, fetchFn = fetch) {
        const firma = kurulumFirmasi();
        if (!firma)
            throw ApiError.badRequest("firma.lky bulunamadı; kurulum dosyasını yeniden yükleyin.");
        const makineKimligi = (await KurulumLisansService.durum(true)).makineKimligi;
        if (!makineKimligi)
            throw ApiError.badRequest("Bu bilgisayarın kimliği okunamadı; birkaç dakika sonra tekrar deneyin.");
        let r;
        let json;
        try {
            const ctrl = new AbortController();
            const zaman = setTimeout(() => ctrl.abort(), 20_000);
            r = await fetchFn(`${merkezAdresi()}/api/v1/merkez/aktivasyon`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ firmaKodu: firma.firmaKodu, kurulumAnahtari: firma.kurulumAnahtari, makineKimligi, anahtar }),
                signal: ctrl.signal,
            }).finally(() => clearTimeout(zaman));
            json = await r.json().catch(() => null);
        }
        catch (err) {
            const kod = err?.cause?.code || err?.code || "";
            logger.warn(`[KURULUM] Aktivasyon için merkeze ulaşılamadı (${merkezAdresi()}): ${err?.message}${kod ? ` (${kod})` : ""}`);
            throw ApiError.badRequest("Merkeze ulaşılamadı. Aktivasyon için internet gerekir; bağlantıyı kontrol edip tekrar deneyin ya da size gönderilen lisans kodunu yapıştırın.");
        }
        if (!r.ok || !json?.data?.lisansKodu)
            throw ApiError.badRequest(json?.message || `Aktivasyon yapılamadı (HTTP ${r.status}).`);
        const durum = await KurulumLisansService.yukle(json.data.lisansKodu);
        logger.info("[KURULUM] Aktivasyon anahtarıyla lisans yüklendi.");
        return durum;
    }
    static baslat() {
        if (!env.KURULUM_MODU)
            return;
        setTimeout(() => void this.gonder(), ILK_GECIKME_MS).unref();
        setInterval(() => void this.gonder(), BILDIRIM_ARALIGI_MS).unref();
        // Program kilitliyken (lisans yok / doldu / makine değişti) 5 dakikada bir: panelde üretilen kod 6 saat beklemeden insin
        setInterval(() => void KurulumLisansService.durum()
            .then((d) => (d.durum === "KILITLI" ? this.gonder() : undefined))
            .catch(() => undefined), KILITLI_BILDIRIM_ARALIGI_MS).unref();
        // Program boşta dursa da saat ilerlemesi kaydedilsin (saat geri alma denetimi)
        setInterval(() => void KurulumLisansService.durum(true).catch(() => undefined), SAAT_ILERLETME_MS).unref();
    }
}
