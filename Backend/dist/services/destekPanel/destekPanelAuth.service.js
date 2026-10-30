import crypto from "crypto";
import jwt from "jsonwebtoken";
import { env } from "../../config/env.config.js";
import { adminYapilandirildiMi, adminYapilandirmaHatasi } from "../../config/adminDb.config.js";
import { HttpStatus } from "../../constants/httpStatusCodes.js";
import { AdminSqlRepository } from "../../models/admin/adminSql.repository.js";
import { AdminLogSqlRepository } from "../../models/admin/adminLogSql.repository.js";
import { DestekPersonelSqlRepository } from "../../models/admin/destekPersonelSql.repository.js";
import { DestekSqlRepository } from "../../models/admin/destekSql.repository.js";
import { KILIT_DAKIKA } from "../../types/destekPanel.types.js";
import { ApiError } from "../../utils/ApiError.js";
import { sahteSifreDogrula, sifreDogrula, sifreHashle, sifreKuralHatasi } from "../../utils/sifre.utils.js";
/**
 * Destek paneli girişi (docs/DESTEK_PANELI_YOL_HARITASI.md D4, D19).
 * Personel kendi şifresiyle; admin paneli adminleri admin şifreleriyle girer ve destek admini sayılır.
 */
const GIRIS_HATASI = "Kullanıcı adı veya şifre hatalı.";
const KURULU_DEGIL = "Destek paneli henüz kurulmamış (yönetim veritabanı göçü 002). Lütfen sistem yöneticisine bildiriniz.";
/** Ayrı giz verilmediyse admin gizinden türetilir: admin token'ı destek paneline, destek token'ı admin paneline geçmez. */
const gizi = () => env.DESTEK_JWT_SECRET || crypto.createHmac("sha256", env.ADMIN_JWT_SECRET).update("likya-destek-paneli").digest("hex");
export const panelKuruluOlmali = async () => {
    if (!adminYapilandirildiMi())
        throw adminYapilandirmaHatasi();
    if (!(await DestekSqlRepository.kuruluMu()) || !(await DestekPersonelSqlRepository.kuruluMu())) {
        throw new ApiError(HttpStatus.SERVICE_UNAVAILABLE, KURULU_DEGIL);
    }
};
export const personelDto = (p) => {
    const { sifreHash: _h, hataliDeneme: _d, kilitBitis, ...dto } = p;
    return { ...dto, gorme: p.rol === "ADMIN" ? "TUMU" : p.gorme, kilitli: !!kilitBitis && new Date(kilitBitis).getTime() > Date.now() };
};
export const personelTokenUret = (payload) => {
    const options = { expiresIn: env.DESTEK_JWT_EXPIRES_IN };
    return jwt.sign(payload, gizi(), options);
};
export const personelTokenDogrula = (token) => {
    if (!adminYapilandirildiMi())
        throw adminYapilandirmaHatasi();
    const payload = jwt.verify(token, gizi());
    if (payload?.tur !== "DESTEK" || !payload.sid || !payload.personelId)
        throw ApiError.unauthorized("Geçersiz oturum.");
    return payload;
};
export class DestekPanelAuthService {
    static async giris(girdi, istemci) {
        await panelKuruluOlmali();
        const kullaniciAdi = girdi.kullaniciAdi.trim().toLowerCase();
        const reddet = async (neden, mesaj = GIRIS_HATASI) => {
            await AdminLogSqlRepository.girisLogu({ tur: "DESTEK", kullaniciAdi, basarili: false, redNedeni: neden, ...istemci });
            throw ApiError.unauthorized(mesaj);
        };
        let personel = await DestekPersonelSqlRepository.kullaniciAdiIleBul(kullaniciAdi);
        // Admin paneli admini ilk kez giriyorsa (ya da göçten sonra eklendiyse) bağlı personel satırı açılır
        if (!personel) {
            const admin = await AdminSqlRepository.kullaniciAdiIleBul(kullaniciAdi);
            if (admin) {
                await DestekPersonelSqlRepository.adminleriEsitle();
                personel = await DestekPersonelSqlRepository.adminIdIleBul(admin.adminId);
            }
        }
        if (!personel) {
            await sahteSifreDogrula(girdi.sifre);
            return reddet("Personel bulunamadı");
        }
        if (personel.kilitBitis && new Date(personel.kilitBitis).getTime() > Date.now()) {
            await sahteSifreDogrula(girdi.sifre);
            return reddet("Hesap kilitli", `Çok fazla hatalı deneme. Hesabınız ${KILIT_DAKIKA} dakika kilitlendi.`);
        }
        let hash = personel.sifreHash;
        if (personel.adminId)
            hash = (await AdminSqlRepository.idIleBul(personel.adminId))?.sifreHash ?? null;
        if (!hash || !(await sifreDogrula(girdi.sifre, hash))) {
            await DestekPersonelSqlRepository.hataliDenemeYaz(personel.personelId);
            return reddet("Şifre hatalı");
        }
        if (personel.durum !== "AKTIF")
            return reddet("Personel pasif");
        const sid = await DestekPersonelSqlRepository.oturumAc(personel.personelId, istemci.ip, istemci.tarayici);
        await DestekPersonelSqlRepository.basariliGirisYaz(personel.personelId);
        await AdminLogSqlRepository.girisLogu({ tur: "DESTEK", kullaniciAdi, basarili: true, ...istemci });
        const token = personelTokenUret({ tur: "DESTEK", personelId: personel.personelId, sid });
        return { token, personel: personelDto((await DestekPersonelSqlRepository.idIleBul(personel.personelId)) ?? personel) };
    }
    static async cikis(sid) {
        await DestekPersonelSqlRepository.oturumKapat(sid);
    }
    static async profil(p) {
        const kayit = await DestekPersonelSqlRepository.idIleBul(p.personelId);
        if (!kayit)
            throw ApiError.unauthorized("Hesap bulunamadı.");
        return personelDto(kayit);
    }
    /** Kendi şifresini değiştirme (ilk girişteki zorunlu belirleme dahil). Admin paneli hesabında admin şifresi değişir. */
    static async sifreDegistir(p, girdi) {
        const kayit = await DestekPersonelSqlRepository.idIleBul(p.personelId);
        if (!kayit)
            throw ApiError.unauthorized("Hesap bulunamadı.");
        const admin = kayit.adminId ? await AdminSqlRepository.idIleBul(kayit.adminId) : null;
        const hash = admin ? admin.sifreHash : kayit.sifreHash;
        if (!hash || !(await sifreDogrula(girdi.mevcutSifre, hash)))
            throw ApiError.badRequest("Mevcut şifre hatalı.");
        const kural = sifreKuralHatasi(girdi.yeniSifre);
        if (kural)
            throw ApiError.badRequest(kural);
        if (girdi.yeniSifre === girdi.mevcutSifre)
            throw ApiError.badRequest("Yeni şifre mevcut şifreyle aynı olamaz.");
        const yeni = await sifreHashle(girdi.yeniSifre);
        if (admin) {
            await AdminSqlRepository.sifreGuncelle(admin.adminId, yeni, false);
            await AdminLogSqlRepository.islemLogu({ adminId: admin.adminId, islem: "ADMIN_SIFRE_DEGISTI", hedefTur: "ADMIN", hedefId: admin.adminId, yeni: { kaynak: "destek paneli" } });
        }
        else {
            await DestekPersonelSqlRepository.sifreYaz(kayit.personelId, yeni, false);
            await AdminLogSqlRepository.islemLogu({ adminId: null, islem: "DESTEK_PERSONEL_SIFRE", hedefTur: "PERSONEL", hedefId: kayit.personelId, yeni: { kendisi: kayit.adSoyad } });
        }
        await DestekPersonelSqlRepository.oturumlariIptalEt(kayit.personelId, p.sid);
    }
}
