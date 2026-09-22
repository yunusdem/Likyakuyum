import { UserSqlRepository } from "../models/userSql.repository.js";
import { KullaniciSqlRepository } from "../models/admin/kullaniciSql.repository.js";
import { benzersizIhlalMi } from "../models/admin/adminSql.repository.js";
import { ApiError } from "../utils/ApiError.js";
import { geciciSifreUret, sifreHashle } from "../utils/sifre.utils.js";
import { logger } from "../utils/logger.js";
import { MerkezGirisService } from "./merkezGiris.service.js";
import { IzlemeSqlRepository } from "../models/admin/izlemeSql.repository.js";
import { OturumService } from "./oturum.service.js";
/**
 * Firma içindeki Kullanıcı Tanımları ekranının (K- Ayarlar) merkezle eşitlenmesi. Karar K5: firma yöneticisi
 * lisans limiti içinde kullanıcı açabilir ve kendi kullanıcılarının şifresini sıfırlayabilir; silme / pasife alma
 * ve modül ayarı yalnızca yönetim panelindedir. MERKEZ_GIRIS kapalıyken hiçbir yöntem devreye girmez (baglam = null).
 */
export class FirmaKullaniciMerkezService {
    static baglam(oturum) {
        if (!oturum)
            return Promise.resolve(null);
        return MerkezGirisService.baglam({ dbServer: oturum.dbServer, dbName: oturum.dbName, username: oturum.username });
    }
    static limitMesaji(b) {
        const limit = b.firma.aktifLisans?.kullaniciLimiti;
        return limit === undefined
            ? "Firmanıza tanımlı bir lisans yok; yeni kullanıcı açılamaz. Lütfen hizmet sağlayıcınızla iletişime geçiniz."
            : `Kullanıcı limitiniz doldu (${b.firma.kullaniciSayisi} / ${limit}). Yeni kullanıcı için hizmet sağlayıcınızla iletişime geçiniz.`;
    }
    /** Firma veritabanına yazmadan önce: yetki, şifre kuralı ve limitin ön denetimi. */
    static olusturmaOnDenetimi(b, girdi) {
        MerkezGirisService.yoneticiOlmali(b);
        if (!girdi.password)
            throw ApiError.badRequest("Yeni kullanıcı için bir başlangıç şifresi girilmelidir.");
        MerkezGirisService.sifreKuraliniDenetle(girdi.password);
        const limit = b.firma.aktifLisans?.kullaniciLimiti;
        if (limit === undefined || b.firma.kullaniciSayisi >= limit)
            throw ApiError.forbidden(this.limitMesaji(b));
    }
    /**
     * Firma veritabanında kullanıcı oluştuktan sonra merkezdeki hesabı açar. Limit burada kilit altında kesin olarak
     * denetlenir; merkez kaydı açılamazsa firma veritabanındaki satır geri alınır (yarım kullanıcı kalmaz).
     */
    static async olusturmaSonrasi(b, yeni, sifre, dbContext) {
        const geriAl = async () => {
            try {
                await UserSqlRepository.delete(yeni.id, dbContext);
            }
            catch (err) {
                logger.error(`[MERKEZ] Yarım kalan kullanıcı geri alınamadı (${yeni.username}): ${err?.message}`);
            }
        };
        try {
            const sonuc = await KullaniciSqlRepository.ekle({
                firmaId: b.firma.firmaId,
                kullaniciAdi: yeni.username,
                adSoyad: yeni.fullName || null,
                sifreHash: await sifreHashle(sifre),
                sifreDegismeli: true,
                firmaYoneticisi: !!yeni.isSysAdmin,
                firmaDbKullaniciId: Number(yeni.id) || null,
                olusturan: `FIRMA:${b.kullanici.kullaniciAdi}`,
            }, true);
            if ("hata" in sonuc) {
                await geriAl();
                throw ApiError.forbidden(this.limitMesaji(b));
            }
        }
        catch (err) {
            if (err instanceof ApiError)
                throw err;
            await geriAl();
            if (benzersizIhlalMi(err))
                throw ApiError.conflict(`"${yeni.username}" kullanıcı adı merkezde zaten kayıtlı.`);
            throw err;
        }
    }
    /**
     * Güncellemeden önce: formdan şifre geldiyse bu bir sıfırlamadır (yönetici ister, kurala uymalı).
     * Başkasının kaydını değiştirmek de yönetici ister.
     */
    static guncellemeOnDenetimi(b, mevcutKullaniciAdi, girdi) {
        const kendisi = mevcutKullaniciAdi === b.kullanici.kullaniciAdi;
        if (!kendisi)
            MerkezGirisService.yoneticiOlmali(b);
        if (girdi.password) {
            if (kendisi)
                throw ApiError.badRequest("Kendi şifrenizi 'Şifre Değiştir' ekranından değiştirin.");
            MerkezGirisService.sifreKuraliniDenetle(girdi.password);
        }
    }
    /** Güncellemeden sonra: kullanıcı adı / ad / yönetici bilgisi ve (verildiyse) şifre merkeze işlenir. */
    static async guncellemeSonrasi(b, eskiKullaniciAdi, guncel, yeniSifre) {
        const hedef = await KullaniciSqlRepository.adIleBul(b.firma.firmaId, eskiKullaniciAdi);
        if (!hedef)
            return; // henüz içe aktarılmamış kullanıcı: merkezde karşılığı yok
        if (guncel.username && guncel.username !== hedef.kullaniciAdi) {
            try {
                await KullaniciSqlRepository.kullaniciAdiGuncelle(hedef.kullaniciId, guncel.username);
            }
            catch (err) {
                if (benzersizIhlalMi(err))
                    throw ApiError.conflict(`"${guncel.username}" kullanıcı adı merkezde zaten kayıtlı.`);
                throw err;
            }
        }
        // Son yönetici kendi yöneticiliğini kaldırıp firmayı yöneticisiz bırakmasın: kendi kaydında bu alan değişmez
        const kendisi = hedef.kullaniciId === b.kullanici.kullaniciId;
        await KullaniciSqlRepository.bilgiGuncelle(hedef.kullaniciId, {
            adSoyad: guncel.fullName || hedef.adSoyad,
            firmaYoneticisi: kendisi ? hedef.firmaYoneticisi : !!guncel.isSysAdmin,
        });
        if (yeniSifre) {
            await KullaniciSqlRepository.sifreGuncelle(hedef.kullaniciId, await sifreHashle(yeniSifre), true);
        }
    }
    static silmeEngeli() {
        throw ApiError.forbidden("Kullanıcı silme ve kapatma işlemleri hizmet sağlayıcınız tarafından yapılır.");
    }
    /** Firma yöneticisinin kendi kullanıcısına geçici şifre vermesi; şifre yalnızca bu yanıtta, bir kez döner. */
    static async sifreSifirla(oturum, hedefDbKullaniciId, dbContext) {
        const b = await this.baglam(oturum);
        if (!b)
            throw ApiError.badRequest("Şifre sıfırlama bu kurulumda etkin değil.");
        MerkezGirisService.yoneticiOlmali(b);
        const hedefDb = await UserSqlRepository.findById(hedefDbKullaniciId, dbContext);
        if (!hedefDb)
            throw ApiError.notFound("Kullanıcı bulunamadı.");
        const hedef = await KullaniciSqlRepository.adIleBul(b.firma.firmaId, hedefDb.username);
        if (!hedef)
            throw ApiError.notFound("Kullanıcı merkezde tanımlı değil. Lütfen hizmet sağlayıcınızla iletişime geçiniz.");
        if (hedef.kullaniciId === b.kullanici.kullaniciId) {
            throw ApiError.badRequest("Kendi şifrenizi 'Şifre Değiştir' ekranından değiştirin.");
        }
        const geciciSifre = geciciSifreUret();
        const ozet = await MerkezGirisService.sifreYaz(hedef.kullaniciId, geciciSifre, true);
        await UserSqlRepository.updatePassword(hedefDb.id, ozet, dbContext);
        await IzlemeSqlRepository.oturumlariIptalEt({ kullaniciId: hedef.kullaniciId }, null);
        OturumService.onbellegiTemizle();
        return { geciciSifre };
    }
}
