import { EBankaSqlRepository } from "../models/ebankaSql.repository.js";
import { EBankaPosSqlRepository } from "../models/ebankaPosSql.repository.js";
import { EBankaVposSqlRepository } from "../models/ebankaVposSql.repository.js";
import { EBankaVeriSqlRepository } from "../models/ebankaVeriSql.repository.js";
import { ApiError } from "../utils/ApiError.js";
import { gizliSifrele, VomsisClient } from "./vomsis/vomsis.client.js";
const temiz = (v) => (typeof v === "string" ? v.trim() : "");
export class EBankaService {
    static async ayarGetir(dbContext) {
        const a = await EBankaSqlRepository.ayarGetir(dbContext);
        return {
            mod: a?.mod ?? "sahte",
            appKey: a?.appKey ?? "",
            appSecretTanimli: Boolean(a?.appSecretSifreli),
            vposAppKey: a?.vposAppKey ?? "",
            vposAppSecretTanimli: Boolean(a?.vposAppSecretSifreli),
            aktarimBaslangic: a?.aktarimBaslangic ?? null,
            vposBankaId: a?.vposBankaId ?? null,
            sonEsitleme: a?.sonEsitleme ?? null,
            guncellemeZamani: a?.guncellemeZamani ?? null,
        };
    }
    static async ayarKaydet(girdi, kullaniciId, dbContext) {
        const mod = girdi.mod === "canli" ? "canli" : "sahte";
        const mevcut = await EBankaSqlRepository.ayarGetir(dbContext);
        const appKey = temiz(girdi.appKey);
        const appSecret = temiz(girdi.appSecret);
        const vposAppKey = temiz(girdi.vposAppKey);
        const vposAppSecret = temiz(girdi.vposAppSecret);
        const tarih = temiz(girdi.aktarimBaslangic);
        if (tarih && !/^\d{4}-\d{2}-\d{2}$/.test(tarih))
            throw ApiError.badRequest("Aktarım başlangıç tarihi geçersiz.");
        if (mod === "canli") {
            if (!appKey)
                throw ApiError.badRequest("Canlı mod için API anahtarı (app_key) zorunludur.");
            if (!appSecret && !mevcut?.appSecretSifreli)
                throw ApiError.badRequest("Canlı mod için API şifresi (app_secret) zorunludur.");
        }
        if (vposAppKey && !vposAppSecret && !mevcut?.vposAppSecretSifreli) {
            throw ApiError.badRequest("Sanal POS için ayrı anahtar girildiyse şifresi de girilmelidir.");
        }
        // Test verisi canlı veriyle karışmasın: mod değişince Vomsis aynası boşaltılır
        if (mevcut && mevcut.mod !== mod) {
            // Önce ikisi de denetlenir ki biri boşaltılıp diğeri reddedilmesin
            const posTemiz = await EBankaPosSqlRepository.fisliSatirYok(dbContext);
            const vposTemiz = await EBankaVposSqlRepository.fisliKayitYok(dbContext);
            if (!posTemiz || !vposTemiz || !(await EBankaVeriSqlRepository.aynayiBosalt(dbContext))) {
                throw ApiError.conflict("Fişe aktarılmış banka hareketleri varken çalışma modu değiştirilemez.");
            }
            await EBankaPosSqlRepository.aynayiBosalt(dbContext);
            await EBankaVposSqlRepository.aynayiBosalt(dbContext);
        }
        await EBankaSqlRepository.ayarKaydet({
            mod,
            appKey: appKey || null,
            // Anahtar silindiyse şifresi de silinir; yeni şifre girilmediyse kayıtlı olan korunur
            appSecretSifreli: !appKey ? null : appSecret ? gizliSifrele(appSecret) : undefined,
            vposAppKey: vposAppKey || null,
            vposAppSecretSifreli: !vposAppKey ? null : vposAppSecret ? gizliSifrele(vposAppSecret) : undefined,
            aktarimBaslangic: tarih || null,
            vposBankaId: girdi.vposBankaId ? Number(girdi.vposBankaId) : null,
        }, kullaniciId, dbContext);
        return this.ayarGetir(dbContext);
    }
    static async baglantiTesti(servis, kullaniciId, dbContext) {
        const mod = (await EBankaSqlRepository.ayarGetir(dbContext))?.mod ?? "sahte";
        const islem = servis === "vpos" ? "baglanti-testi-vpos" : "baglanti-testi";
        try {
            const sonuc = await VomsisClient.baglantiTesti(servis, dbContext);
            await EBankaSqlRepository.logYaz({ islem, mod, basarili: true, mesaj: sonuc.ayrinti, kullaniciId }, dbContext);
            return sonuc;
        }
        catch (err) {
            await EBankaSqlRepository.logYaz({ islem, mod, basarili: false, mesaj: err?.message, kullaniciId }, dbContext);
            throw err;
        }
    }
    static async logListele(limit, dbContext) {
        return EBankaSqlRepository.logListele(limit, dbContext);
    }
    // ─── Faz 1: Özet / Hesaplar / Hareketler ───────────────────────────────────
    static async ozet(dbContext) {
        const [ayar, hesaplar, sayilar] = await Promise.all([
            EBankaSqlRepository.ayarGetir(dbContext),
            EBankaVeriSqlRepository.hesaplariListele(dbContext),
            EBankaVeriSqlRepository.ozetSayilari(dbContext),
        ]);
        // Vomsis'te "toplam bakiyeye dahil" işaretli ve aktif hesaplar, döviz cinsine göre
        const toplamlar = new Map();
        for (const h of hesaplar) {
            if (!h.aktif || !h.bakiyeyeDahil)
                continue;
            const t = toplamlar.get(h.doviz) || { doviz: h.doviz, bakiye: 0, hesapAdedi: 0 };
            t.bakiye = Math.round((t.bakiye + h.bakiye) * 100) / 100;
            t.hesapAdedi++;
            toplamlar.set(h.doviz, t);
        }
        return {
            mod: ayar?.mod ?? "sahte",
            sonEsitleme: ayar?.sonEsitleme ?? null,
            toplamlar: [...toplamlar.values()],
            hesaplar,
            eslesmeyenHesapAdedi: hesaplar.filter((h) => h.aktif && !h.bankaId).length,
            ...sayilar,
        };
    }
    static async hesaplariListele(dbContext) {
        return EBankaVeriSqlRepository.hesaplariListele(dbContext);
    }
    static async hesapEsle(vomsisHesapId, bankaId, dbContext) {
        if (!Number.isInteger(vomsisHesapId) || vomsisHesapId <= 0)
            throw ApiError.badRequest("Geçersiz hesap.");
        const sonuc = await EBankaVeriSqlRepository.hesapEsle(vomsisHesapId, bankaId, dbContext);
        if (sonuc === "hesap-yok")
            throw ApiError.notFound("Banka hesabı bulunamadı.");
        if (sonuc === "kart-yok")
            throw ApiError.badRequest("Seçilen Banka Hesap Kartı bulunamadı.");
        if (sonuc === "kart-dolu")
            throw ApiError.conflict("Bu Banka Hesap Kartı başka bir banka hesabına bağlı.");
        return EBankaVeriSqlRepository.hesaplariListele(dbContext);
    }
    static async hareketleriListele(filtre, dbContext) {
        return EBankaVeriSqlRepository.hareketleriListele(filtre, dbContext);
    }
    static async hareketGetir(vomsisId, dbContext) {
        const h = await EBankaVeriSqlRepository.hareketGetir(vomsisId, dbContext);
        if (!h)
            throw ApiError.notFound("Hareket bulunamadı.");
        return h;
    }
    static async hareketTipleri(dbContext) {
        return EBankaVeriSqlRepository.hareketTipleriniListele(dbContext);
    }
}
