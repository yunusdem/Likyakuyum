import { env } from "../config/env.config.js";
import { getDbPool } from "../config/mssql.config.js";
import { FirmaSqlRepository } from "../models/admin/firmaSql.repository.js";
import { KullaniciSqlRepository } from "../models/admin/kullaniciSql.repository.js";
import { AdminLogSqlRepository } from "../models/admin/adminLogSql.repository.js";
import { ESKI_SIFRE_ISARETI, } from "../types/admin.types.js";
import { ApiError } from "../utils/ApiError.js";
import { HttpStatus } from "../constants/httpStatusCodes.js";
import { ResponseMessages } from "../constants/responseMessages.js";
import { sahteSifreDogrula, sifreDogrula, sifreHashle, sifreKuralHatasi } from "../utils/sifre.utils.js";
import { comparePassword, hashPassword } from "../utils/password.utils.js";
import { baglantiSina, firmaDbAnahtari } from "./admin/firmaBaglanti.service.js";
import { ModulSqlRepository } from "../models/admin/modulSql.repository.js";
const RED_MESAJI = {
    FIRMA_KAYITSIZ: "Bu veritabanı sistemde kayıtlı bir firmaya ait değil. Lütfen hizmet sağlayıcınızla iletişime geçiniz.",
    FIRMA_DONDURULDU: "Hesabınız donduruldu. Lütfen hizmet sağlayıcınızla iletişime geçiniz.",
    FIRMA_PASIF: "Bu hesap kullanımda değil. Lütfen hizmet sağlayıcınızla iletişime geçiniz.",
    LISANS_BITTI: "Hesabınız donduruldu: lisans süreniz doldu. Lütfen hizmet sağlayıcınızla iletişime geçiniz.",
    KULLANICI_PASIF: "Kullanıcı hesabınız kapatılmış. Lütfen hizmet sağlayıcınızla iletişime geçiniz.",
};
/** Giriş ekranı pencereyi yanıttaki errors.kod'a göre açar. */
const redHatasi = (kod) => new ApiError(HttpStatus.FORBIDDEN, RED_MESAJI[kod], { kod });
/** Firmanın şu an çalışmasına engel olan durum; yoksa null. Lisansı hiç tanımlanmamış firma engellenmez. */
export const firmaEngeli = (firma) => {
    if (firma.durum === "PASIF")
        return "FIRMA_PASIF";
    if (firma.durum === "DONDURULMUS")
        return "FIRMA_DONDURULDU";
    if (firma.lisansDurumu === "BITMIS")
        return "LISANS_BITTI";
    return null;
};
export class MerkezGirisService {
    static aktifMi() {
        return env.MERKEZ_GIRIS === "zorunlu";
    }
    /** Girişin 1. adımı: bağlanılan sunucu+veritabanından firmayı bul, durumunu ve lisansını denetle. */
    static async firmaKontrol(dbServer, dbName, kullaniciAdi, istemci) {
        const { anahtar } = firmaDbAnahtari(dbServer, dbName);
        const firma = await FirmaSqlRepository.anahtarIleBul(anahtar);
        const engel = firma ? firmaEngeli(firma) : "FIRMA_KAYITSIZ";
        if (engel) {
            await AdminLogSqlRepository.girisLogu({
                tur: "KULLANICI",
                firmaId: firma?.firmaId ?? null,
                kullaniciAdi,
                basarili: false,
                redNedeni: firma ? engel : `${engel}: ${anahtar}`,
                ...istemci,
            });
            throw redHatasi(engel);
        }
        return firma;
    }
    /**
     * Kullanıcı tarafının paylaşılan bağlantı havuzu, hedefe bağlanamayınca başka bir firmanın açık bağlantısına
     * düşebiliyor. Merkez girişinde bu kabul edilemez: bağlanılan veritabanı gerçekten istenen veritabanı olmalı.
     */
    static async havuzDogrula(dbServer, dbName, dbUser, dbSifre) {
        await baglantiSina(dbServer, dbName, dbUser, dbSifre);
        const pool = await getDbPool(dbServer, dbName, dbUser, dbSifre);
        const res = await pool.request().query(`SELECT DB_NAME() AS D`);
        const bagli = String(res.recordset[0]?.D || "");
        if (bagli.toLowerCase() !== dbName.trim().toLowerCase()) {
            throw ApiError.badRequest(`Firma veritabanına (${dbName}) bağlanılamadı. Lütfen bağlantı bilgilerini kontrol ediniz.`);
        }
    }
    /**
     * Girişin 2. adımı: kullanıcı merkezde tanımlı ve aktif mi, şifresi doğru mu.
     * İçe aktarılmış ve şifresi henüz taşınmamış kullanıcı, firma veritabanındaki eski şifresiyle (eskiSifre)
     * doğrulanır; başarılı olursa şifre bcrypt ile merkeze yazılır ve bir daha eski şifreye bakılmaz.
     */
    static async kullaniciDogrula(firma, kullaniciAdi, sifre, eskiSifre, istemci) {
        const kullanici = await KullaniciSqlRepository.adIleBul(firma.firmaId, kullaniciAdi);
        const reddet = async (neden, hata) => {
            if (kullanici)
                await KullaniciSqlRepository.girisSonucuYaz(kullanici.kullaniciId, false);
            await AdminLogSqlRepository.girisLogu({
                tur: "KULLANICI",
                firmaId: firma.firmaId,
                kullaniciAdi,
                basarili: false,
                redNedeni: neden,
                ...istemci,
            });
            throw hata;
        };
        const gecersiz = () => ApiError.unauthorized(ResponseMessages.INVALID_CREDENTIALS);
        if (!kullanici) {
            await sahteSifreDogrula(sifre);
            return reddet("Kullanıcı merkezde tanımlı değil", gecersiz());
        }
        let sifreDogru;
        const tasinacak = kullanici.sifreHash === ESKI_SIFRE_ISARETI;
        if (tasinacak) {
            sifreDogru = !!eskiSifre && (await comparePassword(sifre, eskiSifre));
        }
        else {
            sifreDogru = await sifreDogrula(sifre, kullanici.sifreHash);
        }
        if (!sifreDogru)
            return reddet("Şifre hatalı", gecersiz());
        if (kullanici.durum !== "AKTIF")
            return reddet("Kullanıcı pasif", redHatasi("KULLANICI_PASIF"));
        if (tasinacak) {
            await KullaniciSqlRepository.sifreGuncelle(kullanici.kullaniciId, await sifreHashle(sifre), false);
        }
        await KullaniciSqlRepository.girisSonucuYaz(kullanici.kullaniciId, true);
        await AdminLogSqlRepository.girisLogu({
            tur: "KULLANICI",
            firmaId: firma.firmaId,
            kullaniciAdi,
            basarili: true,
            ...istemci,
        });
        return kullanici;
    }
    /** Giriş ve /auth/me yanıtındaki user.merkez. Modül listesi önbellekten değil, her seferinde güncel okunur. */
    static async oturumBilgisi(b) {
        return {
            firmaKodu: b.firma.firmaKodu,
            firmaUnvan: b.firma.unvan,
            firmaYoneticisi: b.kullanici.firmaYoneticisi,
            sifreDegismeli: b.kullanici.sifreDegismeli,
            lisansBitis: b.firma.aktifLisans?.bitis ?? null,
            lisansKalanGun: b.firma.lisansKalanGun,
            kullaniciLimiti: b.firma.aktifLisans?.kullaniciLimiti ?? null,
            kullaniciSayisi: b.firma.kullaniciSayisi,
            moduller: await ModulSqlRepository.firmaAcikModulleri(b.firma.firmaId),
        };
    }
    /**
     * Oturumu açık bir isteğin merkezdeki karşılığı (token'daki sunucu+veritabanı+kullanıcı adı).
     * Merkez kapalıysa null. Firma artık çalışamıyorsa veya kullanıcı kapatıldıysa 401 verir; istemci
     * bunu "oturum bitti" olarak ele alıp giriş ekranına döner.
     */
    static async baglam(oturum) {
        if (!this.aktifMi())
            return null;
        const { anahtar } = firmaDbAnahtari(oturum.dbServer || "", oturum.dbName || "");
        const firma = await FirmaSqlRepository.anahtarIleBul(anahtar);
        if (!firma || firmaEngeli(firma)) {
            throw ApiError.unauthorized(firma ? RED_MESAJI[firmaEngeli(firma)] : RED_MESAJI.FIRMA_KAYITSIZ);
        }
        const kullanici = await KullaniciSqlRepository.adIleBul(firma.firmaId, oturum.username);
        if (!kullanici || kullanici.durum !== "AKTIF")
            throw ApiError.unauthorized(RED_MESAJI.KULLANICI_PASIF);
        return { firma, kullanici };
    }
    static yoneticiOlmali(b) {
        if (!b.kullanici.firmaYoneticisi) {
            throw ApiError.forbidden("Bu işlem için firma yöneticisi olmalısınız.");
        }
    }
    /** Şifre kuralına uymuyorsa 400. */
    static sifreKuraliniDenetle(sifre) {
        const hata = sifreKuralHatasi(sifre);
        if (hata)
            throw ApiError.badRequest(hata);
    }
    /**
     * Merkezdeki şifreyi yazar. Firma veritabanındaki TODVZ_KULLANICI.SIFRE alanı da (uygulamanın mevcut
     * HMAC biçimiyle) eşit tutulur: MERKEZ_GIRIS kapatılırsa kullanıcı aynı şifreyle girebilsin diye.
     * Döndürdüğü değer o alana yazılacak özettir.
     */
    static async sifreYaz(kullaniciId, yeniSifre, sifreDegismeli) {
        await KullaniciSqlRepository.sifreGuncelle(kullaniciId, await sifreHashle(yeniSifre), sifreDegismeli);
        return hashPassword(yeniSifre);
    }
}
