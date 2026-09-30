import { adminYapilandirildiMi } from "../../config/adminDb.config.js";
import { HttpStatus } from "../../constants/httpStatusCodes.js";
import { GibSqlRepository } from "../../models/admin/gibSql.repository.js";
import { ApiError } from "../../utils/ApiError.js";
import { logger } from "../../utils/logger.js";
import { noTemizle, noTuru } from "../../utils/vknKontrol.js";
import { EbelgeService } from "../ebelge.service.js";
import { EarsivPortalClient, GibPortalHatasi } from "./earsivPortal.client.js";
/**
 * VKN/TCKN → unvan / ad / soyad / vergi dairesi (docs/GIB_VKN_SORGU_YOL_HARITASI.md).
 * Sıra: kontrol hanesi → ortak önbellek → GİB e-Arşiv Portalı (merkezi hesap) → ICE (yalnız e-Fatura mükellefi unvanı).
 */
const BULUNDU_OMRU_GUN = 30;
// Kaydı yeni açılan mükellef bir gün sonra tekrar sorulabilsin
const KAYIT_YOK_OMRU_GUN = 1;
const gunOnce = (gun) => Date.now() - gun * 86_400_000;
/** Veritabanındaki DATETIME'lar (GETDATE, yerel saat) mssql'den UTC gibi okunur; yeni sorgunun zamanı da aynı biçimde verilir. */
const simdiDbBicimi = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString();
export const onbellekTazeMi = (k) => new Date(k.sorguTarihi).getTime() >= gunOnce(k.sonuc === "BULUNDU" ? BULUNDU_OMRU_GUN : KAYIT_YOK_OMRU_GUN);
export class VknSorguService {
    static async sorgula(girdi, baglam) {
        const no = noTemizle(girdi);
        const tur = noTuru(no);
        if (!tur) {
            throw ApiError.badRequest(no.length === 10 || no.length === 11
                ? "Geçersiz numara: kontrol hanesi tutmuyor, numarayı kontrol edin."
                : "Geçersiz numara: VKN 10, TCKN 11 haneli olmalıdır.");
        }
        const log = (sonuc, kaynak) => adminYapilandirildiMi()
            ? GibSqlRepository.sorguLogu({ firmaId: baglam.firmaId, dbAdi: baglam.dbAdi, kullanici: baglam.kullanici, no, sonuc, kaynak })
            : Promise.resolve();
        let gibHatasi = null;
        let hesapVar = false;
        if (adminYapilandirildiMi()) {
            try {
                const onbellek = await GibSqlRepository.onbellekOku(no);
                if (onbellek && onbellekTazeMi(onbellek)) {
                    await log(onbellek.sonuc, "ONBELLEK");
                    return { ...onbellek, tur, kaynak: "ONBELLEK", sorguTarihi: new Date(onbellek.sorguTarihi).toISOString(), uyari: null };
                }
                const hesap = await GibSqlRepository.hesap();
                hesapVar = !!hesap;
                if (hesap) {
                    const bilgi = await EarsivPortalClient.kisiGetir(hesap, no);
                    await GibSqlRepository.girisSonucu(true);
                    const sonuc = bilgi.unvan || bilgi.ad || bilgi.soyad ? "BULUNDU" : "KAYIT_YOK";
                    const kayit = { no, tur, sonuc, ...bilgi };
                    await GibSqlRepository.onbellekYaz(kayit);
                    await log(sonuc, "GIB");
                    return { ...kayit, kaynak: "GIB", sorguTarihi: simdiDbBicimi(), uyari: null };
                }
            }
            catch (err) {
                if (err instanceof GibPortalHatasi) {
                    gibHatasi = err.message;
                    await GibSqlRepository.girisSonucu(false, err.message);
                }
                else {
                    gibHatasi = "Sorgu yapılamadı.";
                    logger.error(`[GIB] VKN sorgusu hatası: ${err?.message}`);
                }
            }
        }
        // Yedek: ICE'deki GİB e-Fatura kayıtlı kullanıcı listesi (yalnız unvan)
        if (baglam.dbContext) {
            try {
                const m = await EbelgeService.mukellefSorgula(no, baglam.kullanici, baglam.dbContext);
                const unvan = m.kullanicilar.map((k) => String(k?.Title ?? "").trim()).find(Boolean);
                if (m.mukellefMi && unvan) {
                    await log("BULUNDU", "ICE");
                    return {
                        no, tur, sonuc: "BULUNDU", unvan, ad: null, soyad: null, vergiDairesi: null, kaynak: "ICE",
                        sorguTarihi: simdiDbBicimi(),
                        uyari: "GİB'e ulaşılamadı; unvan e-Fatura listesinden alındı, vergi dairesini elle girin.",
                    };
                }
            }
            catch (err) {
                logger.warn(`[GIB] ICE yedeği çalışmadı: ${err?.message}`);
            }
        }
        await log("HATA", null);
        const neden = gibHatasi
            ? `GİB'e şu an ulaşılamıyor: ${gibHatasi}`
            : !hesapVar
                ? "Merkezi GİB hesabı tanımlı değil (admin paneli → GİB Hesabı)."
                : "Sorgu yapılamadı.";
        throw new ApiError(HttpStatus.SERVICE_UNAVAILABLE, `${neden} Bilgileri elle girin.`);
    }
}
