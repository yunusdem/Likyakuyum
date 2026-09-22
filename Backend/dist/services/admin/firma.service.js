import { FirmaSqlRepository } from "../../models/admin/firmaSql.repository.js";
import { LisansSqlRepository } from "../../models/admin/lisansSql.repository.js";
import { AdminLogSqlRepository } from "../../models/admin/adminLogSql.repository.js";
import { benzersizIhlalMi } from "../../models/admin/adminSql.repository.js";
import { LISANS_UYARI_GUN, } from "../../types/admin.types.js";
import { ApiError } from "../../utils/ApiError.js";
import { sifrele } from "../../utils/kripto.utils.js";
import { firmaDbAnahtari } from "./firmaBaglanti.service.js";
import { IzlemeSqlRepository } from "../../models/admin/izlemeSql.repository.js";
import { OturumService } from "../oturum.service.js";
const bosIseNull = (v) => {
    const t = (v ?? "").trim();
    return t === "" ? null : t;
};
const yazimHazirla = (g) => {
    const dbName = g.dbName.trim();
    const { port, anahtar } = firmaDbAnahtari(g.dbServer, dbName);
    return {
        firmaKodu: g.firmaKodu.trim().toUpperCase(),
        musteriNo: g.musteriNo.trim().toUpperCase(),
        prgTur: g.prgTur ?? 0,
        unvan: g.unvan.trim(),
        vknTckn: bosIseNull(g.vknTckn),
        vergiDairesi: bosIseNull(g.vergiDairesi),
        yetkiliKisi: bosIseNull(g.yetkiliKisi),
        telefon: bosIseNull(g.telefon),
        eposta: bosIseNull(g.eposta),
        adres: bosIseNull(g.adres),
        baglantiModu: g.baglantiModu,
        dbServer: g.dbServer.trim(),
        dbPort: port,
        dbName,
        dbAnahtar: anahtar,
        dbUser: bosIseNull(g.dbUser),
    };
};
const cakismaHatasi = (err) => {
    const msg = String(err?.message || "");
    if (msg.includes("UX_ADM_FIRMA_MUSTERI_NO"))
        return ApiError.conflict("Bu müşteri no başka bir firmada kullanılıyor.");
    if (msg.includes("UQ_ADM_FIRMA_KODU"))
        return ApiError.conflict("Bu firma kodu başka bir firmada kullanılıyor.");
    if (msg.includes("UQ_ADM_FIRMA_DB_ANAHTAR")) {
        return ApiError.conflict("Bu sunucu ve veritabanı başka bir firmaya tanımlı. Bir veritabanı yalnızca bir firmaya bağlanabilir.");
    }
    return ApiError.conflict("Kayıt çakışması: firma kodu, müşteri no veya veritabanı başka bir firmada kullanılıyor.");
};
/** Denetim izine yazılacak alanlar (şifre ASLA dahil edilmez). */
const logAlanlari = (f) => ({
    firmaKodu: f.firmaKodu,
    musteriNo: f.musteriNo,
    prgTur: f.prgTur,
    unvan: f.unvan,
    vknTckn: f.vknTckn,
    vergiDairesi: f.vergiDairesi,
    yetkiliKisi: f.yetkiliKisi,
    telefon: f.telefon,
    eposta: f.eposta,
    adres: f.adres,
    baglantiModu: f.baglantiModu,
    dbServer: f.dbServer,
    dbPort: f.dbPort,
    dbName: f.dbName,
    dbUser: f.dbUser,
});
export class FirmaService {
    static listele() {
        return FirmaSqlRepository.listele();
    }
    static async getir(firmaId) {
        const firma = await FirmaSqlRepository.idIleBul(firmaId);
        if (!firma)
            throw ApiError.notFound("Firma bulunamadı.");
        return firma;
    }
    static async ekle(yapan, girdi) {
        const yazim = yazimHazirla(girdi);
        const dbSifreEnc = girdi.dbSifre ? sifrele(girdi.dbSifre) : null;
        let firmaId;
        try {
            firmaId = await FirmaSqlRepository.ekle(yazim, dbSifreEnc);
        }
        catch (err) {
            if (benzersizIhlalMi(err))
                throw cakismaHatasi(err);
            throw err;
        }
        await AdminLogSqlRepository.islemLogu({
            adminId: yapan.adminId,
            islem: "FIRMA_EKLENDI",
            hedefTur: "FIRMA",
            hedefId: firmaId,
            yeni: { ...logAlanlari(yazim), dbSifreTanimli: !!dbSifreEnc },
        });
        return this.getir(firmaId);
    }
    static async guncelle(yapan, firmaId, girdi) {
        const eski = await this.getir(firmaId);
        const yazim = yazimHazirla(girdi);
        // undefined: dokunma · "": sil · dolu: değiştir
        const dbSifreEnc = girdi.dbSifre === undefined ? undefined : girdi.dbSifre === "" ? null : sifrele(girdi.dbSifre);
        try {
            await FirmaSqlRepository.guncelle(firmaId, yazim, dbSifreEnc);
        }
        catch (err) {
            if (benzersizIhlalMi(err))
                throw cakismaHatasi(err);
            throw err;
        }
        const eskiAlanlar = logAlanlari(eski);
        const yeniAlanlar = logAlanlari(yazim);
        if (JSON.stringify(eskiAlanlar) !== JSON.stringify(yeniAlanlar)) {
            await AdminLogSqlRepository.islemLogu({
                adminId: yapan.adminId,
                islem: "FIRMA_GUNCELLENDI",
                hedefTur: "FIRMA",
                hedefId: firmaId,
                eski: eskiAlanlar,
                yeni: yeniAlanlar,
            });
        }
        if (dbSifreEnc !== undefined) {
            await AdminLogSqlRepository.islemLogu({
                adminId: yapan.adminId,
                islem: "FIRMA_DB_SIFRE_DEGISTI",
                hedefTur: "FIRMA",
                hedefId: firmaId,
                yeni: { dbSifreTanimli: dbSifreEnc !== null },
            });
        }
        return this.getir(firmaId);
    }
    /** Aktif / Dondurulmuş / Pasif. Aktif dışına alınan firmanın açık oturumları anında düşürülür. */
    static async durumDegistir(yapan, firmaId, girdi) {
        const eski = await this.getir(firmaId);
        const not = bosIseNull(girdi.not);
        if (eski.durum === girdi.durum && eski.durumNotu === not)
            return eski;
        await FirmaSqlRepository.durumDegistir(firmaId, girdi.durum, not);
        const kapananOturum = girdi.durum === "AKTIF" ? 0 : await IzlemeSqlRepository.oturumlariIptalEt({ firmaId }, yapan.adminId);
        OturumService.onbellegiTemizle();
        await AdminLogSqlRepository.islemLogu({
            adminId: yapan.adminId,
            islem: "FIRMA_DURUM",
            hedefTur: "FIRMA",
            hedefId: firmaId,
            eski: { durum: eski.durum, not: eski.durumNotu },
            yeni: { durum: girdi.durum, not, kapananOturum },
        });
        return this.getir(firmaId);
    }
    static async dogrulama(yapan, firmaId, girdi) {
        const eski = await this.getir(firmaId);
        const not = bosIseNull(girdi.not);
        await FirmaSqlRepository.dogrulamaYaz(firmaId, girdi.dogrulandi, yapan.adminId, not);
        await AdminLogSqlRepository.islemLogu({
            adminId: yapan.adminId,
            islem: "FIRMA_DOGRULAMA",
            hedefTur: "FIRMA",
            hedefId: firmaId,
            eski: { dogrulandi: eski.dogrulandi, not: eski.dogrulamaNotu },
            yeni: { dogrulandi: girdi.dogrulandi, not },
        });
        return this.getir(firmaId);
    }
    static async lisanslar(firmaId) {
        await this.getir(firmaId);
        return LisansSqlRepository.firmaLisanslari(firmaId);
    }
    static async lisansEkle(yapan, firmaId, girdi) {
        const firma = await this.getir(firmaId);
        if (girdi.bitis < girdi.baslangic)
            throw ApiError.badRequest("Bitiş tarihi başlangıçtan önce olamaz.");
        if (girdi.kullaniciLimiti < firma.kullaniciSayisi) {
            throw ApiError.badRequest(`Firmanın ${firma.kullaniciSayisi} aktif kullanıcısı var; kullanıcı limiti bundan küçük olamaz.`);
        }
        const veri = {
            firmaId,
            lisansAnahtari: bosIseNull(girdi.lisansAnahtari),
            baslangic: girdi.baslangic,
            bitis: girdi.bitis,
            kullaniciLimiti: girdi.kullaniciLimiti,
            paketAdi: bosIseNull(girdi.paketAdi),
            notlar: bosIseNull(girdi.notlar),
            adminId: yapan.adminId,
        };
        const lisansId = await LisansSqlRepository.ekle(veri);
        OturumService.onbellegiTemizle(); // lisansı bitmiş firmanın engeli hemen kalksın
        const { adminId: _adminId, ...logVerisi } = veri;
        await AdminLogSqlRepository.islemLogu({
            adminId: yapan.adminId,
            islem: "LISANS_EKLENDI",
            hedefTur: "LISANS",
            hedefId: lisansId,
            eski: firma.aktifLisans ?? undefined,
            yeni: logVerisi,
        });
        return { firma: await this.getir(firmaId), lisanslar: await LisansSqlRepository.firmaLisanslari(firmaId) };
    }
    static async ozet() {
        const [sayilar, lisanslar, lisanssiz] = await Promise.all([
            FirmaSqlRepository.ozet(),
            LisansSqlRepository.bitenVeYaklasanlar(LISANS_UYARI_GUN),
            LisansSqlRepository.lisanssizFirmaSayisi(),
        ]);
        return {
            ...sayilar,
            lisanssizFirma: lisanssiz,
            lisansUyariGun: LISANS_UYARI_GUN,
            suresiBitenLisanslar: lisanslar.filter((l) => l.kalanGun < 0),
            yaklasanLisanslar: lisanslar.filter((l) => l.kalanGun >= 0),
        };
    }
}
