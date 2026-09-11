import { MasakSqlRepository, MASAK_LISTE_KODLARI, } from "../models/masakSql.repository.js";
import { MASAK_KAYNAKLAR, adresGecerliMi, indirDosya, normalizeMetin, parseMasakExcel, tarihAyikla, } from "../utils/masakExcel.util.js";
import { ApiError } from "../utils/ApiError.js";
import { logger } from "../utils/logger.js";
export class MasakService {
    /**
     * Aynı anda ikinci bir güncellemeyi engelleyen kilit (sunucu/agent süreci başına).
     * Anahtar: sunucu + veritabanı — farklı işletmeler birbirini bloklamaz.
     */
    static calisanGuncellemeler = new Set();
    static kilitAnahtari(dbContext) {
        return `${(dbContext?.dbServer || "").toLowerCase()}:${(dbContext?.dbName || "").toLowerCase()}`;
    }
    static listeKodGecerliMi(kod) {
        return typeof kod === "string" && MASAK_LISTE_KODLARI.includes(kod);
    }
    /**
     * Liste bazında kayıt sayısı, son güncelleme ve son kullanılan adres.
     * Adres yoksa varsayılan adres döndürülür — adres giriş ekranı her zaman dolu açılır.
     */
    static async getDurum(dbContext) {
        const durum = await MasakSqlRepository.getDurum(dbContext);
        return durum.map((d) => ({
            ...d,
            listeAdi: d.listeAdi || MASAK_KAYNAKLAR[d.listeKod]?.listeAdi || null,
            kaynakUrl: d.kaynakUrl || MASAK_KAYNAKLAR[d.listeKod]?.varsayilanUrl || null,
        }));
    }
    /**
     * Sayfalı listeleme (MASAK grid ekranı). Arama metni yazılırken kullanılan
     * normalizasyonun aynısından geçirilir — "abdullah aymaz" da "ABDULLAH AYMAZ" da bulur.
     */
    static async listele(params, dbContext) {
        if (params.listeKod && !MasakService.listeKodGecerliMi(params.listeKod)) {
            throw ApiError.badRequest("Geçersiz liste kodu. Geçerli değerler: A, B, C, 3AB");
        }
        return MasakSqlRepository.listele({
            listeKod: params.listeKod,
            qNorm: params.q ? normalizeMetin(params.q) : undefined,
            kimlikNo: params.kimlikNo,
            page: params.page,
            pageSize: params.pageSize,
        }, dbContext);
    }
    /** Tek kaydın tüm alanları (Detay) */
    static async getKayit(id, dbContext) {
        if (!id || isNaN(id)) {
            throw ApiError.badRequest("Geçerli bir kayıt numarası belirtilmelidir.");
        }
        const kayit = await MasakSqlRepository.findById(id, dbContext);
        if (!kayit) {
            throw ApiError.notFound("MASAK kaydı bulunamadı.");
        }
        return kayit;
    }
    /**
     * Eşleşme sorgusu — fiş / fatura / cari ekranlarının kullanacağı uç.
     * Otomatik blok uygulamaz; eşleşmeyi ve skorunu döner, kararı çağıran taraf verir.
     */
    static async sorgula(params, dbContext) {
        const ad = (params.ad || "").trim();
        const kimlikNo = (params.kimlikNo || "").replace(/\s/g, "").trim();
        if (!ad && !kimlikNo) {
            throw ApiError.badRequest("Sorgu için en az bir ad veya kimlik numarası gereklidir.");
        }
        const adNorm = ad ? normalizeMetin(ad) : null;
        const kelimeler = adNorm ? adNorm.split(" ").filter((k) => k.length >= 2) : [];
        const kayitlar = await MasakSqlRepository.sorgula({
            kimlikNo: kimlikNo || null,
            adNorm,
            kelimeler,
            dogumTarihiDt: params.dogumTarihi ? tarihAyikla(params.dogumTarihi) : null,
            limit: params.limit,
        }, dbContext);
        return {
            eslesmeVar: kayitlar.length > 0,
            enYuksekSkor: kayitlar.length ? Math.max(...kayitlar.map((k) => k.skor)) : 0,
            kayitlar,
        };
    }
    static async getGecmis(params, dbContext) {
        if (params.listeKod && !MasakService.listeKodGecerliMi(params.listeKod)) {
            throw ApiError.badRequest("Geçersiz liste kodu. Geçerli değerler: A, B, C, 3AB");
        }
        return MasakSqlRepository.getGecmis(params, dbContext);
    }
    /**
     * Seçilen listeleri indirir, ayrıştırır ve tabloya yazar.
     *
     * - Her liste bağımsızdır: biri hata alsa diğerleri güncellenmeye devam eder.
     * - Bir listenin verisi ancak indirme + ayrıştırma başarılı olduktan sonra,
     *   transaction içinde değiştirilir. Başarısız güncelleme eldeki veriyi bozmaz.
     * - Her deneme (başarılı/başarısız) TODVZ_MASAK_GUNCELLEME'ye yazılır.
     */
    static async guncelle(kaynaklar, kullanici, dbContext) {
        const kilit = MasakService.kilitAnahtari(dbContext);
        if (MasakService.calisanGuncellemeler.has(kilit)) {
            throw ApiError.badRequest("Şu anda başka bir MASAK güncellemesi sürüyor. Lütfen tamamlanmasını bekleyiniz.");
        }
        // Girdi yoksa dört listenin tamamı güncellenir
        const istenen = Array.isArray(kaynaklar) && kaynaklar.length > 0
            ? kaynaklar
            : MASAK_LISTE_KODLARI.map((listeKod) => ({ listeKod }));
        for (const k of istenen) {
            if (!MasakService.listeKodGecerliMi(k?.listeKod)) {
                throw ApiError.badRequest(`Geçersiz liste kodu: ${String(k?.listeKod)}. Geçerli değerler: A, B, C, 3AB`);
            }
            if (k.url && !adresGecerliMi(k.url)) {
                throw ApiError.badRequest(`${k.listeKod} listesi için geçersiz adres. Yalnızca https://ms.hmb.gov.tr/ ile başlayan .xlsx adresleri kabul edilir.`);
            }
        }
        MasakService.calisanGuncellemeler.add(kilit);
        try {
            // Adres girilmemişse: son başarılı adres → yoksa varsayılan adres
            const mevcutDurum = await MasakService.getDurum(dbContext);
            const sonAdresler = new Map();
            mevcutDurum.forEach((d) => sonAdresler.set(d.listeKod, d.kaynakUrl));
            const sonuclar = [];
            for (const girdi of istenen) {
                const listeKod = girdi.listeKod;
                const tanim = MASAK_KAYNAKLAR[listeKod];
                const url = (girdi.url && girdi.url.trim()) ||
                    sonAdresler.get(listeKod) ||
                    tanim.varsayilanUrl;
                const baslama = new Date();
                const t0 = Date.now();
                let oncekiSayi = 0;
                try {
                    oncekiSayi = await MasakSqlRepository.getKayitSayisi(listeKod, dbContext);
                    const dosya = await indirDosya(url);
                    const ayristirma = await parseMasakExcel(dosya.buffer, listeKod, tanim.listeAdi);
                    const yazilan = await MasakSqlRepository.replaceListe(listeKod, ayristirma.kayitlar, { listeAdi: tanim.listeAdi, kaynakUrl: url, kaynakHash: dosya.hash }, dbContext);
                    const sureMs = Date.now() - t0;
                    if (ayristirma.eslesmeyenBasliklar.length > 0) {
                        logger.warn(`MASAK ${listeKod}: eşlenemeyen kolon başlıkları → ${ayristirma.eslesmeyenBasliklar.join(" | ")}`);
                    }
                    await MasakSqlRepository.logGuncelleme({
                        listeKod,
                        baslamaZamani: baslama,
                        bitisZamani: new Date(),
                        sureMs,
                        durum: "BASARILI",
                        kayitSayisi: yazilan,
                        oncekiKayitSayisi: oncekiSayi,
                        kaynakUrl: url,
                        kaynakHash: dosya.hash,
                        dosyaBoyutu: dosya.boyut,
                        kullaniciAdi: kullanici?.kullaniciAdi ?? null,
                        kullaniciId: kullanici?.kullaniciId ?? null,
                    }, dbContext);
                    sonuclar.push({
                        listeKod,
                        listeAdi: tanim.listeAdi,
                        durum: "basarili",
                        kayitSayisi: yazilan,
                        oncekiKayitSayisi: oncekiSayi,
                        sureMs,
                        kaynakUrl: url,
                    });
                }
                catch (error) {
                    const sureMs = Date.now() - t0;
                    const mesaj = error?.message || "Bilinmeyen hata";
                    logger.error(`MASAK ${listeKod} güncellenemedi: ${mesaj}`);
                    await MasakSqlRepository.logGuncelleme({
                        listeKod,
                        baslamaZamani: baslama,
                        bitisZamani: new Date(),
                        sureMs,
                        durum: "HATA",
                        kayitSayisi: 0,
                        oncekiKayitSayisi: oncekiSayi,
                        kaynakUrl: url,
                        kullaniciAdi: kullanici?.kullaniciAdi ?? null,
                        kullaniciId: kullanici?.kullaniciId ?? null,
                        hataMesaji: mesaj,
                    }, dbContext);
                    sonuclar.push({
                        listeKod,
                        listeAdi: tanim.listeAdi,
                        durum: "hata",
                        kayitSayisi: 0,
                        oncekiKayitSayisi: oncekiSayi,
                        sureMs,
                        kaynakUrl: url,
                        hata: mesaj,
                    });
                }
            }
            const durum = await MasakService.getDurum(dbContext);
            const toplamKayit = durum.reduce((t, d) => t + d.kayitSayisi, 0);
            const sonGuncelleme = durum
                .map((d) => d.sonGuncelleme)
                .filter((z) => !!z)
                .sort()
                .pop() || new Date().toISOString();
            return {
                guncellemeZamani: sonGuncelleme,
                toplamKayit,
                sonuclar,
                durum,
            };
        }
        finally {
            MasakService.calisanGuncellemeler.delete(kilit);
        }
    }
}
