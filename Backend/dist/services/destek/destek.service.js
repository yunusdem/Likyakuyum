import { DestekSqlRepository } from "../../models/admin/destekSql.repository.js";
import { AdminLogSqlRepository } from "../../models/admin/adminLogSql.repository.js";
import { adminYapilandirildiMi } from "../../config/adminDb.config.js";
import { HttpStatus } from "../../constants/httpStatusCodes.js";
import { ApiError } from "../../utils/ApiError.js";
import { logger } from "../../utils/logger.js";
import { DestekEkService } from "./destekEk.js";
import { DestekPersonelSqlRepository } from "../../models/admin/destekPersonelSql.repository.js";
/** Admin paneli admininin destek panelindeki personel satırı (göç 002 yoksa null). Yoksa bir kez eşitleyip açar. */
export const adminPersonelId = async (adminId) => {
    try {
        if (!(await DestekPersonelSqlRepository.kuruluMu()))
            return null;
        let p = await DestekPersonelSqlRepository.adminIdIleBul(adminId);
        if (!p) {
            await DestekPersonelSqlRepository.adminleriEsitle();
            p = await DestekPersonelSqlRepository.adminIdIleBul(adminId);
        }
        return p?.personelId ?? null;
    }
    catch (err) {
        logger.warn(`[DESTEK] Admin ${adminId} için personel satırı bulunamadı: ${err?.message}`);
        return null;
    }
};
const adminYazan = async (admin) => ({ adminId: admin.adminId, personelId: await adminPersonelId(admin.adminId), adSoyad: admin.adSoyad });
/**
 * Destek / bildirim iş kuralları (docs/DESTEK_VE_BILDIRIM_YOL_HARITASI.md).
 * Kullanıcı tarafı DestekKimlik ile, admin tarafı AdminBaglam ile çalışır; exe (kurulum) köprüsü de kullanıcı yöntemlerini kullanır.
 */
const KURULU_DEGIL = "Destek tabloları henüz kurulmamış (LIKYA_ADMIN_DESTEK.sql). Lütfen hizmet sağlayıcınızla iletişime geçiniz.";
const kuruluOlmali = async () => {
    if (!adminYapilandirildiMi() || !(await DestekSqlRepository.kuruluMu()))
        throw new ApiError(HttpStatus.SERVICE_UNAVAILABLE, KURULU_DEGIL);
};
const gorunenAd = (k) => k.adSoyad?.trim() || k.kullaniciAdi;
/** Müşteriye giden kayıtta destek ekibinden kimin ilgilendiği görünmez (D14). */
const musteriIcin = (k) => ({ ...k, atananAdminId: null, atananAdmin: null, atananPersonelId: null });
export class DestekService {
    // =================================================================== Kullanıcı ===
    static async kullaniciOzet(kimlik) {
        if (!adminYapilandirildiMi() || !(await DestekSqlRepository.kuruluMu()))
            return { okunmamis: 0, onemli: [], kurulu: false };
        const o = await DestekSqlRepository.kullaniciOzet(kimlik);
        return { ...o, onemli: o.onemli.map(musteriIcin), kurulu: true };
    }
    static async kullaniciKonulari(kimlik, sekme) {
        if (!adminYapilandirildiMi() || !(await DestekSqlRepository.kuruluMu()))
            return [];
        return (await DestekSqlRepository.kullaniciKonulari(kimlik, sekme)).map(musteriIcin);
    }
    /** Konu + mesajlar; görülebiliyorsa okundu işaretlenir (merkez kullanıcı id'si olanlarda). */
    static async kullaniciKonu(kimlik, konuId, okunduYaz = true) {
        await kuruluOlmali();
        if (!(await DestekSqlRepository.kullaniciGorebilirMi(konuId, kimlik)))
            throw ApiError.notFound("Kayıt bulunamadı.");
        const konu = await DestekSqlRepository.konuGetir(konuId, "KULLANICI", kimlik.kullaniciId);
        if (!konu)
            throw ApiError.notFound("Kayıt bulunamadı.");
        const mesajlar = await DestekSqlRepository.mesajlar(konuId, false);
        if (okunduYaz && kimlik.kullaniciId !== null && konu.okunmamis) {
            await DestekSqlRepository.okunduYaz(konuId, "KULLANICI", kimlik.kullaniciId, konu.karsiSonMesajId);
            konu.okunmamis = false;
        }
        return { konu: musteriIcin(konu), mesajlar };
    }
    static async talepAc(kimlik, g) {
        await kuruluOlmali();
        const baslik = g.baslik.trim();
        const metin = g.metin.trim();
        if (!baslik)
            throw ApiError.badRequest("Başlık girilmelidir.");
        if (!metin)
            throw ApiError.badRequest("Açıklama girilmelidir.");
        const ekler = DestekEkService.dogrula(g.ekler);
        // Çevrimdışı kuyruktan ikinci kez gelen talep yeniden açılmaz
        if (g.yerelAnahtar) {
            const varolan = await DestekSqlRepository.yerelAnahtarIleBul(kimlik.firmaId, g.yerelAnahtar);
            if (varolan)
                return this.kullaniciKonu(kimlik, varolan, false);
        }
        const konuId = await DestekSqlRepository.konuEkle({
            tur: "TALEP",
            firmaId: kimlik.firmaId,
            kullaniciId: kimlik.kullaniciId,
            kullaniciAdi: gorunenAd(kimlik),
            baslik,
            talepTuru: g.talepTuru ?? "SORU",
            oncelik: g.oncelik ?? "NORMAL",
            ekran: g.ekran ?? null,
            durum: "ACIK",
            yerelAnahtar: g.yerelAnahtar ?? null,
            sonMesajTaraf: "KULLANICI",
        });
        const mesajId = await DestekSqlRepository.mesajEkle({
            konuId,
            gonderenTur: "KULLANICI",
            kullaniciId: kimlik.kullaniciId,
            gonderenAd: gorunenAd(kimlik),
            metin,
            yerelAnahtar: g.yerelAnahtar ?? null,
        });
        await DestekEkService.kaydet(konuId, mesajId, ekler);
        return this.kullaniciKonu(kimlik, konuId, false);
    }
    /**
     * Kullanıcı mesajı. Talepte: mesaj eklenir, durum KULLANICI_YANITLADI (kapalıysa yeniden AÇIK — K5).
     * Bildirim / sistem kaydında: o kayda bağlı yanıt talebi açılır ya da varsa sürer (K9); dönen konu o taleptir.
     */
    static async kullaniciMesaj(kimlik, konuId, g) {
        await kuruluOlmali();
        const metin = g.metin.trim();
        if (!metin)
            throw ApiError.badRequest("Mesaj boş olamaz.");
        const ekler = DestekEkService.dogrula(g.ekler);
        if (!(await DestekSqlRepository.kullaniciGorebilirMi(konuId, kimlik)))
            throw ApiError.notFound("Kayıt bulunamadı.");
        const konu = await DestekSqlRepository.konuGetir(konuId, "KULLANICI", kimlik.kullaniciId);
        if (!konu)
            throw ApiError.notFound("Kayıt bulunamadı.");
        let hedefKonuId = konuId;
        if (konu.tur !== "TALEP") {
            if (konu.tur === "BILDIRIM" && !konu.cevapAlir)
                throw ApiError.badRequest("Bu bildirime yanıt verilemez.");
            const varolan = await DestekSqlRepository.yanitTalebiBul(konuId, kimlik);
            if (varolan)
                hedefKonuId = varolan;
            else {
                if (g.yerelAnahtar) {
                    const tekrar = await DestekSqlRepository.yerelAnahtarIleBul(kimlik.firmaId, g.yerelAnahtar);
                    if (tekrar)
                        return this.kullaniciKonu(kimlik, tekrar, false);
                }
                hedefKonuId = await DestekSqlRepository.konuEkle({
                    tur: "TALEP",
                    firmaId: kimlik.firmaId,
                    kullaniciId: kimlik.kullaniciId,
                    kullaniciAdi: gorunenAd(kimlik),
                    baslik: `Yanıt: ${konu.baslik}`.slice(0, 200),
                    talepTuru: "SORU",
                    oncelik: "NORMAL",
                    durum: "ACIK",
                    kaynakKonuId: konuId,
                    yerelAnahtar: g.yerelAnahtar ?? null,
                    sonMesajTaraf: "KULLANICI",
                });
            }
        }
        else if (g.yerelAnahtar && (await DestekSqlRepository.mesajYerelAnahtarVarMi(hedefKonuId, g.yerelAnahtar))) {
            return this.kullaniciKonu(kimlik, hedefKonuId, false);
        }
        const mesajId = await DestekSqlRepository.mesajEkle({
            konuId: hedefKonuId,
            gonderenTur: "KULLANICI",
            kullaniciId: kimlik.kullaniciId,
            gonderenAd: gorunenAd(kimlik),
            metin,
            yerelAnahtar: g.yerelAnahtar ?? null,
        });
        await DestekEkService.kaydet(hedefKonuId, mesajId, ekler);
        // Kapalı talebe yazılınca yeniden açılır (K5); açık talepte "kullanıcı yanıtladı"
        const hedefDurum = hedefKonuId === konuId ? konu.durum : ((await DestekSqlRepository.konuGetir(hedefKonuId, "KULLANICI", kimlik.kullaniciId))?.durum ?? "ACIK");
        await DestekSqlRepository.durumYaz(hedefKonuId, hedefDurum === "KAPALI" ? "ACIK" : "KULLANICI_YANITLADI");
        return this.kullaniciKonu(kimlik, hedefKonuId, false);
    }
    static async okundu(kimlik, konuId) {
        await kuruluOlmali();
        if (kimlik.kullaniciId === null)
            return; // exe: okuma durumu yerelde
        if (!konuId)
            return DestekSqlRepository.tumunuOkunduYaz(kimlik);
        if (!(await DestekSqlRepository.kullaniciGorebilirMi(konuId, kimlik)))
            throw ApiError.notFound("Kayıt bulunamadı.");
        const konu = await DestekSqlRepository.konuGetir(konuId, "KULLANICI", kimlik.kullaniciId);
        await DestekSqlRepository.okunduYaz(konuId, "KULLANICI", kimlik.kullaniciId, konu?.karsiSonMesajId ?? null);
    }
    static async bayrak(kimlik, konuId, alan, deger) {
        await kuruluOlmali();
        if (kimlik.kullaniciId === null)
            return;
        if (!(await DestekSqlRepository.kullaniciGorebilirMi(konuId, kimlik)))
            throw ApiError.notFound("Kayıt bulunamadı.");
        await DestekSqlRepository.bayrakYaz(konuId, "KULLANICI", kimlik.kullaniciId, alan, deger);
    }
    static async kullaniciEk(kimlik, ekId) {
        await kuruluOlmali();
        const d = await DestekEkService.dosya(ekId);
        if (!(await DestekSqlRepository.kullaniciGorebilirMi(d.konuId, kimlik)))
            throw ApiError.notFound("Görsel bulunamadı.");
        return d;
    }
    // ======================================================================= Admin ===
    static async adminOzet(admin) {
        if (!(await DestekSqlRepository.kuruluMu()))
            return { okunmamis: 0, acikTalep: 0, taslakBildirim: 0, kurulu: false };
        return { ...(await DestekSqlRepository.adminOzet(admin.adminId)), kurulu: true };
    }
    static async adminKonular(admin, f) {
        if (!(await DestekSqlRepository.kuruluMu()))
            return { satirlar: [], toplam: 0, kurulu: false };
        return { ...(await DestekSqlRepository.adminKonulari(admin.adminId, f)), kurulu: true };
    }
    static async adminKonu(admin, konuId, okunduYaz = true) {
        await kuruluOlmali();
        const konu = await DestekSqlRepository.konuGetir(konuId, "ADMIN", admin.adminId);
        if (!konu)
            throw ApiError.notFound("Kayıt bulunamadı.");
        const mesajlar = await DestekSqlRepository.mesajlar(konuId, true);
        if (okunduYaz && konu.okunmamis) {
            await DestekSqlRepository.okunduYaz(konuId, "ADMIN", admin.adminId, konu.karsiSonMesajId);
            konu.okunmamis = false;
        }
        const sonuc = { konu, mesajlar };
        if (konu.tur === "BILDIRIM") {
            sonuc.hedefler = konu.hedef === "TUMU" ? [] : await DestekSqlRepository.hedefler(konuId);
            sonuc.yanitSayisi = await DestekSqlRepository.bildirimYanitlari(konuId);
        }
        return sonuc;
    }
    /** Admin mesajı: iç not kullanıcıya görünmez ve durumu değiştirmez; normal cevap durumu CEVAPLANDI yapar (kapalı talep kapalı kalır). */
    static async adminMesaj(admin, konuId, g) {
        await kuruluOlmali();
        const metin = g.metin.trim();
        if (!metin)
            throw ApiError.badRequest("Mesaj boş olamaz.");
        const konu = await DestekSqlRepository.konuGetir(konuId, "ADMIN", admin.adminId);
        if (!konu)
            throw ApiError.notFound("Kayıt bulunamadı.");
        if (konu.tur === "BILDIRIM")
            throw ApiError.badRequest("Bildirime mesaj yazılmaz; gelen yanıtlar ayrı talep olarak listelenir.");
        const yazan = await adminYazan(admin);
        await DestekSqlRepository.mesajEkle({ konuId, gonderenTur: "ADMIN", adminId: admin.adminId, personelId: yazan.personelId, gonderenAd: admin.adSoyad, metin, icNot: !!g.icNot });
        if (!g.icNot && konu.tur === "TALEP" && konu.durum !== "KAPALI")
            await DestekSqlRepository.durumYaz(konuId, "CEVAPLANDI");
        return this.adminKonu(admin, konuId, true);
    }
    static async adminKonuGuncelle(admin, konuId, g) {
        await kuruluOlmali();
        const konu = await DestekSqlRepository.konuGetir(konuId, "ADMIN", admin.adminId);
        if (!konu)
            throw ApiError.notFound("Kayıt bulunamadı.");
        if (konu.tur === "BILDIRIM")
            throw ApiError.badRequest("Bildirim için gönder / geri çek kullanılır.");
        const yazan = await adminYazan(admin);
        const panel = await DestekPersonelSqlRepository.kuruluMu();
        if (g.atananPersonelId !== undefined && panel) {
            await this.atamaDegistir(yazan, konu, g.atananPersonelId);
        }
        else if (g.atananAdminId !== undefined && panel) {
            // Eski ekran admin no gönderir: adminin personel satırına çevrilir
            const hedef = g.atananAdminId === null ? null : await adminPersonelId(g.atananAdminId);
            if (g.atananAdminId !== null && hedef === null)
                throw ApiError.badRequest("Seçilen admin destek ekibinde bulunamadı.");
            await this.atamaDegistir(yazan, konu, hedef);
        }
        else if (g.atananAdminId !== undefined) {
            await DestekSqlRepository.atamaYaz(konuId, g.atananAdminId);
            await AdminLogSqlRepository.islemLogu({ adminId: admin.adminId, islem: "DESTEK_ATAMA", hedefTur: "KONU", hedefId: konuId, yeni: { atananAdminId: g.atananAdminId } });
        }
        if (g.durum && g.durum !== konu.durum)
            await this.durumDegistir(yazan, konu, g.durum);
        return this.adminKonu(admin, konuId, true);
    }
    // ===================================================== Ortak ekip işlemleri ===
    // Admin paneli ve destek paneli (DestekPanelService) aynı kuralları kullanır.
    /**
     * Kapat / yeniden aç. Müşteriye giden sistem mesajında kişi adı yazmaz (D14); kimin yaptığı iç notta ve kayıtta kalır.
     * Kapanınca görseller silinir (K6).
     */
    static async durumDegistir(yazan, konu, durum) {
        if (durum === konu.durum)
            return;
        await DestekSqlRepository.durumYaz(konu.konuId, durum, yazan.adminId, yazan.personelId);
        await DestekSqlRepository.mesajEkle({
            konuId: konu.konuId,
            gonderenTur: "ADMIN",
            adminId: yazan.adminId,
            personelId: yazan.personelId,
            gonderenAd: yazan.adSoyad,
            metin: durum === "KAPALI" ? `${yazan.adSoyad} kaydı kapattı.` : `${yazan.adSoyad} kaydı yeniden açtı.`,
            icNot: true,
        });
        await DestekSqlRepository.mesajEkle({
            konuId: konu.konuId,
            gonderenTur: "SISTEM",
            metin: durum === "KAPALI" ? "Kayıt destek ekibi tarafından kapatıldı." : "Kayıt destek ekibi tarafından yeniden açıldı.",
        });
        if (durum === "KAPALI")
            await DestekEkService.konuEkleriniSil(konu.konuId);
        await AdminLogSqlRepository.islemLogu({
            adminId: yazan.adminId,
            islem: "DESTEK_DURUM",
            hedefTur: "KONU",
            hedefId: konu.konuId,
            eski: { durum: konu.durum },
            yeni: { durum, yapan: yazan.adSoyad },
        });
    }
    /** Atama / aktarma / havuza bırakma (D7, D9). İç notta "kimden kime" kaydı kalır. */
    static async atamaDegistir(yazan, konu, personelId) {
        if ((konu.atananPersonelId ?? null) === personelId)
            return;
        let hedefAd = "havuz";
        if (personelId !== null) {
            const hedef = await DestekPersonelSqlRepository.idIleBul(personelId);
            if (!hedef || hedef.durum !== "AKTIF")
                throw ApiError.badRequest("Seçilen kişi aktif bir destek hesabı değil.");
            hedefAd = hedef.adSoyad;
        }
        await DestekSqlRepository.personelAtamaYaz(konu.konuId, personelId);
        const onceki = konu.atananAdmin || "havuz";
        await DestekSqlRepository.mesajEkle({
            konuId: konu.konuId,
            gonderenTur: "ADMIN",
            adminId: yazan.adminId,
            personelId: yazan.personelId,
            gonderenAd: yazan.adSoyad,
            metin: personelId === null ? `${yazan.adSoyad} kaydı havuza bıraktı (önceki: ${onceki}).` : `${yazan.adSoyad} kaydı aktardı: ${onceki} → ${hedefAd}.`,
            icNot: true,
        });
        await AdminLogSqlRepository.islemLogu({
            adminId: yazan.adminId,
            islem: "DESTEK_ATAMA",
            hedefTur: "KONU",
            hedefId: konu.konuId,
            eski: { atanan: konu.atananPersonelId ?? null },
            yeni: { atanan: personelId, yapan: yazan.adSoyad },
        });
    }
    static async adminEk(ekId) {
        await kuruluOlmali();
        return DestekEkService.dosya(ekId);
    }
    // --------------------------------------------------------------- Bildirimler ---
    static async bildirimler(admin) {
        if (!(await DestekSqlRepository.kuruluMu()))
            return { satirlar: [], toplam: 0, kurulu: false };
        return { ...(await DestekSqlRepository.adminKonulari(admin.adminId, { tur: "BILDIRIM", sayfaBoyu: 200 })), kurulu: true };
    }
    /** Atama seçenekleri: aktif destek ekibi (admin paneli adminleri dahil). Göç 002 yoksa kurulu=false. */
    static async ekip() {
        if (!(await DestekPersonelSqlRepository.kuruluMu()))
            return { kurulu: false, ekip: [] };
        await DestekPersonelSqlRepository.adminleriEsitle();
        const liste = await DestekPersonelSqlRepository.liste();
        return {
            kurulu: true,
            ekip: liste.filter((x) => x.durum === "AKTIF").map((x) => ({ personelId: x.personelId, adSoyad: x.adSoyad, rol: x.rol, adminId: x.adminId })),
        };
    }
    static hedefSecenekleri() {
        return DestekSqlRepository.hedefSecenekleri();
    }
    static hedefleriDenetle(g) {
        if (g.hedef === "TUMU")
            return [];
        if (g.hedef === "FIRMA") {
            const ids = Array.from(new Set((g.firmaIds ?? []).filter((n) => Number.isInteger(n) && n > 0)));
            if (ids.length === 0)
                throw ApiError.badRequest("En az bir firma seçilmelidir.");
            return ids.map((firmaId) => ({ firmaId }));
        }
        const ids = Array.from(new Set((g.kullaniciIds ?? []).filter((n) => Number.isInteger(n) && n > 0)));
        if (ids.length === 0)
            throw ApiError.badRequest("En az bir kullanıcı seçilmelidir.");
        return ids.map((kullaniciId) => ({ firmaId: 0, kullaniciId }));
    }
    /** Kullanıcı hedeflerinde firma, kullanıcının kaydından bulunur. */
    static async hedefleriTamamla(hedefler) {
        if (!hedefler.some((h) => h.kullaniciId))
            return hedefler;
        const { kullanicilar } = await DestekSqlRepository.hedefSecenekleri();
        return hedefler.map((h) => {
            if (!h.kullaniciId)
                return h;
            const k = kullanicilar.find((x) => x.kullaniciId === h.kullaniciId);
            if (!k)
                throw ApiError.badRequest(`Kullanıcı bulunamadı (${h.kullaniciId}).`);
            return { firmaId: k.firmaId, kullaniciId: h.kullaniciId };
        });
    }
    static async bildirimOlustur(admin, g, ek) {
        const konuId = await this.bildirimYaz(await adminYazan(admin), g, ek);
        return this.adminKonu(admin, konuId, false);
    }
    static async bildirimGuncelle(admin, konuId, g) {
        await this.bildirimDuzenle(await adminYazan(admin), konuId, g);
        return this.adminKonu(admin, konuId, false);
    }
    static async bildirimGeriCek(admin, konuId) {
        await this.bildirimCek(await adminYazan(admin), konuId);
        return this.adminKonu(admin, konuId, false);
    }
    /** Yeni bildirim (taslak ya da hemen gönder). Admin paneli ve destek paneli (D11) ortak. */
    static async bildirimYaz(yazan, g, ek) {
        await kuruluOlmali();
        const baslik = g.baslik.trim();
        const metin = g.metin.trim();
        if (!baslik)
            throw ApiError.badRequest("Başlık girilmelidir.");
        if (!metin)
            throw ApiError.badRequest("Metin girilmelidir.");
        const hedefler = await this.hedefleriTamamla(this.hedefleriDenetle(g));
        const konuId = await DestekSqlRepository.konuEkle({
            tur: "BILDIRIM",
            firmaId: null,
            kullaniciId: null,
            kullaniciAdi: null,
            baslik,
            durum: g.gonder ? "GONDERILDI" : "TASLAK",
            bildirimTuru: g.bildirimTuru,
            onemli: g.onemli,
            cevapAlir: g.cevapAlir,
            hedef: g.hedef,
            surum: ek?.surum ?? null,
            olusturanAdminId: yazan.adminId,
            olusturanPersonelId: yazan.personelId,
            sonMesajTaraf: "ADMIN",
            gonderildi: g.gonder,
        });
        await DestekSqlRepository.mesajEkle({ konuId, gonderenTur: "ADMIN", adminId: yazan.adminId, personelId: yazan.personelId, gonderenAd: yazan.adSoyad, metin });
        await DestekSqlRepository.hedefEkle(konuId, hedefler);
        await AdminLogSqlRepository.islemLogu({
            adminId: yazan.adminId,
            islem: (g.gonder ? "BILDIRIM_GONDERILDI" : "BILDIRIM_TASLAK"),
            hedefTur: "KONU",
            hedefId: konuId,
            yeni: { baslik, hedef: g.hedef, hedefSayisi: hedefler.length, onemli: g.onemli, yapan: yazan.adSoyad },
        });
        return konuId;
    }
    /** Taslak düzenleme ve gönderme. Gönderilmiş bildirim düzenlenmez (geri çekilip yenisi yazılır). */
    static async bildirimDuzenle(yazan, konuId, g) {
        await kuruluOlmali();
        const konu = await DestekSqlRepository.konuGetir(konuId, "ADMIN", yazan.adminId);
        if (!konu || konu.tur !== "BILDIRIM")
            throw ApiError.notFound("Bildirim bulunamadı.");
        if (konu.durum !== "TASLAK")
            throw ApiError.badRequest("Yalnız taslak bildirim düzenlenebilir.");
        const baslik = g.baslik.trim();
        const metin = g.metin.trim();
        if (!baslik)
            throw ApiError.badRequest("Başlık girilmelidir.");
        if (!metin)
            throw ApiError.badRequest("Metin girilmelidir.");
        const hedefler = await this.hedefleriTamamla(this.hedefleriDenetle(g));
        await DestekSqlRepository.bildirimGuncelle(konuId, { ...g, baslik, metin });
        await DestekSqlRepository.hedefEkle(konuId, hedefler);
        if (g.gonder) {
            await DestekSqlRepository.durumYaz(konuId, "GONDERILDI");
            await AdminLogSqlRepository.islemLogu({
                adminId: yazan.adminId,
                islem: "BILDIRIM_GONDERILDI",
                hedefTur: "KONU",
                hedefId: konuId,
                yeni: { baslik, hedef: g.hedef, hedefSayisi: hedefler.length, yapan: yazan.adSoyad },
            });
        }
    }
    static async bildirimCek(yazan, konuId) {
        await kuruluOlmali();
        const konu = await DestekSqlRepository.konuGetir(konuId, "ADMIN", yazan.adminId);
        if (!konu || konu.tur !== "BILDIRIM")
            throw ApiError.notFound("Bildirim bulunamadı.");
        if (konu.durum !== "GONDERILDI")
            throw ApiError.badRequest("Yalnız gönderilmiş bildirim geri çekilebilir.");
        await DestekSqlRepository.durumYaz(konuId, "GERI_CEKILDI");
        await AdminLogSqlRepository.islemLogu({ adminId: yazan.adminId, islem: "BILDIRIM_GERI_CEKILDI", hedefTur: "KONU", hedefId: konuId, yeni: { yapan: yazan.adSoyad } });
    }
    // ============================================================= Sistem olayları ===
    /**
     * Sistem olayı (K14): firmanın ziline ve admin listesine düşer. Anahtar verilmişse aynı olay ikinci kez açılmaz,
     * mevcut konuya mesaj eklenir. Hata asıl işlemi bozmaz (çağıranlar try/catch'siz çağırabilir).
     */
    static async sistemOlayi(g) {
        try {
            if (!adminYapilandirildiMi() || !(await DestekSqlRepository.kuruluMu()))
                return null;
            if (g.anahtar) {
                const varolan = await DestekSqlRepository.olayAnahtariIleBul(g.anahtar);
                if (varolan) {
                    await DestekSqlRepository.mesajEkle({ konuId: varolan.konuId, gonderenTur: "SISTEM", metin: g.metin });
                    if (varolan.durum === "KAPALI")
                        await DestekSqlRepository.durumYaz(varolan.konuId, "ACIK");
                    return varolan.konuId;
                }
            }
            let konuId;
            try {
                konuId = await DestekSqlRepository.konuEkle({
                    tur: "SISTEM",
                    firmaId: g.firmaId,
                    kullaniciId: null,
                    kullaniciAdi: null,
                    baslik: g.baslik,
                    durum: "ACIK",
                    onemli: !!g.onemli,
                    cevapAlir: true,
                    sistemOlay: g.olay,
                    olayAnahtari: g.anahtar ?? null,
                    sonMesajTaraf: "SISTEM",
                });
            }
            catch (err) {
                // Aynı anahtarla eş zamanlı ikinci olay: benzersiz indeks korur, mesaj mevcut konuya eklenir
                const varolan = g.anahtar && String(err?.message || "").includes("UQ_ADM_KONU_OLAY") ? await DestekSqlRepository.olayAnahtariIleBul(g.anahtar) : null;
                if (!varolan)
                    throw err;
                await DestekSqlRepository.mesajEkle({ konuId: varolan.konuId, gonderenTur: "SISTEM", metin: g.metin });
                return varolan.konuId;
            }
            await DestekSqlRepository.mesajEkle({ konuId, gonderenTur: "SISTEM", metin: g.metin });
            return konuId;
        }
        catch (err) {
            logger.error(`[DESTEK] Sistem olayı yazılamadı (${g.olay}, firma ${g.firmaId}): ${err?.message}`);
            return null;
        }
    }
    /** Sürüm yayınlanınca admin için taslak bildirim (K10). */
    static async surumTaslagi(surum, notlar) {
        try {
            if (!(await DestekSqlRepository.kuruluMu()))
                return;
            if (await DestekSqlRepository.surumTaslagiVarMi(surum))
                return;
            const konuId = await DestekSqlRepository.konuEkle({
                tur: "BILDIRIM",
                firmaId: null,
                kullaniciId: null,
                kullaniciAdi: null,
                baslik: `Yeni sürüm ${surum}`,
                durum: "TASLAK",
                bildirimTuru: "SURUM",
                onemli: false,
                cevapAlir: true,
                hedef: "TUMU",
                surum,
                sonMesajTaraf: "ADMIN",
            });
            await DestekSqlRepository.mesajEkle({ konuId, gonderenTur: "ADMIN", gonderenAd: "Sistem", metin: (notlar && notlar.trim()) || `${surum} sürümü yayınlandı.` });
        }
        catch (err) {
            logger.error(`[DESTEK] Sürüm taslağı yazılamadı (${surum}): ${err?.message}`);
        }
    }
}
