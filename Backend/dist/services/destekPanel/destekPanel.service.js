import crypto from "crypto";
import { AdminSqlRepository } from "../../models/admin/adminSql.repository.js";
import { AdminLogSqlRepository } from "../../models/admin/adminLogSql.repository.js";
import { DestekPersonelSqlRepository } from "../../models/admin/destekPersonelSql.repository.js";
import { DestekSqlRepository } from "../../models/admin/destekSql.repository.js";
import { ApiError } from "../../utils/ApiError.js";
import { sifreHashle } from "../../utils/sifre.utils.js";
import { DestekEkService } from "../destek/destekEk.js";
import { DestekService } from "../destek/destek.service.js";
import { panelKuruluOlmali, personelDto } from "./destekPanelAuth.service.js";
/**
 * Destek paneli iş kuralları (docs/DESTEK_PANELI_YOL_HARITASI.md). Veri admin paneliyle ortaktır (D2);
 * kapatma / atama / bildirim kuralları DestekService'teki ortak yöntemlerden geçer.
 */
const yazan = (p) => ({ adminId: p.adminId, personelId: p.personelId, adSoyad: p.adSoyad });
const yalnizAdmin = (p) => {
    if (p.rol !== "ADMIN")
        throw ApiError.forbidden("Bu işlem yalnız destek adminine açıktır.");
};
/** Okunması kolay geçici şifre: 10 karakter, harf + rakam (karışan 0/O, 1/l yok). */
const geciciSifre = () => {
    const harf = "abcdefghjkmnpqrstuvwxyz";
    const rakam = "23456789";
    const hepsi = harf + harf.toUpperCase() + rakam;
    const sec = (k) => k[crypto.randomInt(k.length)];
    const dizi = [sec(harf), sec(rakam), ...Array.from({ length: 8 }, () => sec(hepsi))];
    for (let i = dizi.length - 1; i > 0; i--) {
        const j = crypto.randomInt(i + 1);
        [dizi[i], dizi[j]] = [dizi[j], dizi[i]];
    }
    return dizi.join("");
};
export class DestekPanelService {
    // ------------------------------------------------------------------ Talepler ---
    static async ozet(p) {
        await panelKuruluOlmali();
        return DestekSqlRepository.panelOzet(p);
    }
    static async konular(p, f) {
        await panelKuruluOlmali();
        return DestekSqlRepository.panelKonulari(p, f);
    }
    static async gorulebilirKonu(p, konuId) {
        if (!(await DestekSqlRepository.personelGorebilirMi(konuId, p)))
            throw ApiError.notFound("Kayıt bulunamadı ya da size atanmamış.");
        const konu = await DestekSqlRepository.konuGetir(konuId, "PERSONEL", p.personelId);
        if (!konu)
            throw ApiError.notFound("Kayıt bulunamadı.");
        return konu;
    }
    /** Konu + mesajlar (iç notlar dahil) + firma kartı (D12); okundu işaretlenir. */
    static async konu(p, konuId, okunduYaz = true) {
        await panelKuruluOlmali();
        const konu = await this.gorulebilirKonu(p, konuId);
        const mesajlar = await DestekSqlRepository.mesajlar(konuId, true);
        if (okunduYaz && konu.okunmamis) {
            await DestekSqlRepository.okunduYaz(konuId, "PERSONEL", p.personelId, konu.karsiSonMesajId);
            konu.okunmamis = false;
        }
        const firma = konu.firmaId ? ((await DestekPersonelSqlRepository.musteri(konu.firmaId))?.firma ?? null) : null;
        const sonuc = { konu, mesajlar, firma };
        if (konu.tur === "BILDIRIM") {
            sonuc.hedefler = konu.hedef === "TUMU" ? [] : await DestekSqlRepository.hedefler(konuId);
            sonuc.yanitSayisi = await DestekSqlRepository.bildirimYanitlari(konuId);
        }
        return sonuc;
    }
    /**
     * Personel mesajı. Cevap (iç not değil) talebi CEVAPLANDI yapar; havuzdaki talebe ilk cevabı yazan talebi üstlenmiş olur.
     * Kapalı talebe yazılan cevap talebi açmaz (admin panelindeki kural).
     */
    static async mesaj(p, konuId, g) {
        await panelKuruluOlmali();
        const metin = g.metin.trim();
        if (!metin)
            throw ApiError.badRequest("Mesaj boş olamaz.");
        const ekler = DestekEkService.dogrula(g.ekler);
        const konu = await this.gorulebilirKonu(p, konuId);
        if (konu.tur === "BILDIRIM")
            throw ApiError.badRequest("Bildirime mesaj yazılmaz; gelen yanıtlar ayrı talep olarak listelenir.");
        const mesajId = await DestekSqlRepository.mesajEkle({
            konuId,
            gonderenTur: "ADMIN",
            adminId: p.adminId,
            personelId: p.personelId,
            gonderenAd: p.adSoyad,
            metin,
            icNot: !!g.icNot,
        });
        await DestekEkService.kaydet(konuId, mesajId, ekler);
        if (!g.icNot) {
            if (konu.tur === "TALEP" && konu.durum !== "KAPALI")
                await DestekSqlRepository.durumYaz(konuId, "CEVAPLANDI");
            if (!konu.atananPersonelId)
                await DestekSqlRepository.ustlen(konuId, p.personelId);
        }
        return this.konu(p, konuId, true);
    }
    /** Havuzdan üstlenme (D7). Başkası az önce aldıysa hata döner. */
    static async ustlen(p, konuId) {
        await panelKuruluOlmali();
        const konu = await this.gorulebilirKonu(p, konuId);
        if (konu.tur === "BILDIRIM")
            throw ApiError.badRequest("Bildirim üstlenilmez.");
        if (konu.atananPersonelId === p.personelId)
            return this.konu(p, konuId, false);
        if (konu.atananPersonelId)
            throw ApiError.conflict(`Bu kayıt ${konu.atananAdmin ?? "başka birine"} atanmış.`);
        if (!(await DestekSqlRepository.ustlen(konuId, p.personelId)))
            throw ApiError.conflict("Bu kaydı az önce başka biri üstlendi.");
        await DestekSqlRepository.mesajEkle({ konuId, gonderenTur: "ADMIN", adminId: p.adminId, personelId: p.personelId, gonderenAd: p.adSoyad, metin: `${p.adSoyad} kaydı üstlendi.`, icNot: true });
        return this.konu(p, konuId, false);
    }
    /** Aktarma / havuza bırakma (D9). "Yalnız atanan" yetkili personel yalnız kendi ya da havuzdaki talebi aktarabilir (görünürlük denetimi). */
    static async aktar(p, konuId, personelId) {
        await panelKuruluOlmali();
        const konu = await this.gorulebilirKonu(p, konuId);
        if (konu.tur === "BILDIRIM")
            throw ApiError.badRequest("Bildirim aktarılmaz.");
        await DestekService.atamaDegistir(yazan(p), konu, personelId);
        // Aktaran artık göremeyebilir (ATANAN yetkisi): bu durumda yalnız özet döner
        if (!(await DestekSqlRepository.personelGorebilirMi(konuId, p)))
            return { aktarildi: true, gorunmuyor: true };
        return this.konu(p, konuId, false);
    }
    /** Kapat / yeniden aç (D8). */
    static async durum(p, konuId, durum) {
        await panelKuruluOlmali();
        const konu = await this.gorulebilirKonu(p, konuId);
        if (konu.tur === "BILDIRIM")
            throw ApiError.badRequest("Bildirim için gönder / geri çek kullanılır.");
        await DestekService.durumDegistir(yazan(p), konu, durum);
        return this.konu(p, konuId, false);
    }
    /** Telefonla arayan müşteri için firma adına talep (D15). Talep açanın üzerine atanır. */
    static async telefonTalebi(p, g) {
        await panelKuruluOlmali();
        const baslik = g.baslik.trim();
        const metin = g.metin.trim();
        if (!baslik)
            throw ApiError.badRequest("Başlık girilmelidir.");
        if (!metin)
            throw ApiError.badRequest("Açıklama girilmelidir.");
        const musteri = await DestekPersonelSqlRepository.musteri(g.firmaId);
        if (!musteri)
            throw ApiError.badRequest("Firma bulunamadı.");
        let kullaniciAdi = musteri.firma.yetkili || musteri.firma.unvan;
        if (g.kullaniciId) {
            const k = musteri.kullanicilar.find((x) => x.kullaniciId === g.kullaniciId);
            if (!k)
                throw ApiError.badRequest("Kullanıcı bu firmaya ait değil.");
            kullaniciAdi = k.adSoyad || k.kullaniciAdi;
        }
        const konuId = await DestekSqlRepository.konuEkle({
            tur: "TALEP",
            firmaId: g.firmaId,
            kullaniciId: g.kullaniciId ?? null,
            kullaniciAdi,
            baslik,
            talepTuru: g.talepTuru ?? "SORU",
            oncelik: g.oncelik ?? "NORMAL",
            ekran: "Telefon",
            durum: "ACIK",
            sonMesajTaraf: "ADMIN",
            kaynak: "TELEFON",
            olusturanPersonelId: p.personelId,
            atananPersonelId: p.personelId,
        });
        await DestekSqlRepository.mesajEkle({
            konuId,
            gonderenTur: "ADMIN",
            adminId: p.adminId,
            personelId: p.personelId,
            gonderenAd: p.adSoyad,
            metin,
            ilkCevapSayilir: false,
        });
        await AdminLogSqlRepository.islemLogu({
            adminId: p.adminId,
            islem: "DESTEK_TELEFON_TALEBI",
            hedefTur: "KONU",
            hedefId: konuId,
            yeni: { firmaId: g.firmaId, baslik, yapan: p.adSoyad },
        });
        return this.konu(p, konuId, false);
    }
    static async ek(p, ekId) {
        await panelKuruluOlmali();
        const d = await DestekEkService.dosya(ekId);
        if (!(await DestekSqlRepository.personelGorebilirMi(d.konuId, p)))
            throw ApiError.notFound("Görsel bulunamadı.");
        return d;
    }
    // --------------------------------------------------------------- Bildirimler ---
    static async bildirimler(p) {
        await panelKuruluOlmali();
        return DestekSqlRepository.panelBildirimleri(p);
    }
    static async bildirimOlustur(p, g) {
        await panelKuruluOlmali();
        const konuId = await DestekService.bildirimYaz(yazan(p), g);
        return this.konu(p, konuId, false);
    }
    static async bildirimGuncelle(p, konuId, g) {
        await panelKuruluOlmali();
        await DestekService.bildirimDuzenle(yazan(p), konuId, g);
        return this.konu(p, konuId, false);
    }
    static async bildirimGeriCek(p, konuId) {
        await panelKuruluOlmali();
        await DestekService.bildirimCek(yazan(p), konuId);
        return this.konu(p, konuId, false);
    }
    static hedefSecenekleri() {
        return DestekSqlRepository.hedefSecenekleri();
    }
    // ---------------------------------------------------------------- Müşteriler ---
    static async musteriler(arama) {
        await panelKuruluOlmali();
        return DestekPersonelSqlRepository.musteriler(arama);
    }
    static async musteri(p, firmaId) {
        await panelKuruluOlmali();
        const m = await DestekPersonelSqlRepository.musteri(firmaId);
        if (!m)
            throw ApiError.notFound("Firma bulunamadı.");
        return { ...m, talepler: await DestekSqlRepository.firmaTalepleri(p, firmaId) };
    }
    // -------------------------------------------------------------- Hızlı cevap ---
    static async hizliCevaplar(p, hepsi) {
        await panelKuruluOlmali();
        return DestekPersonelSqlRepository.hizliCevaplar(!(hepsi && p.rol === "ADMIN"));
    }
    static async hizliCevapYaz(p, c) {
        await panelKuruluOlmali();
        yalnizAdmin(p);
        const baslik = c.baslik.trim();
        const metin = c.metin.trim();
        if (!baslik || !metin)
            throw ApiError.badRequest("Başlık ve metin girilmelidir.");
        const id = await DestekPersonelSqlRepository.hizliCevapYaz({ cevapId: c.cevapId ?? null, baslik, metin, sira: c.sira ?? 0, aktif: c.aktif ?? true });
        if (!id)
            throw ApiError.notFound("Hızlı cevap bulunamadı.");
        await AdminLogSqlRepository.islemLogu({ adminId: p.adminId, islem: "DESTEK_HIZLI_CEVAP", hedefTur: "HIZLI_CEVAP", hedefId: id, yeni: { baslik, aktif: c.aktif ?? true, yapan: p.adSoyad } });
        return DestekPersonelSqlRepository.hizliCevaplar(false);
    }
    // ------------------------------------------------------------------ Personel ---
    /** Aktarma listesi: aktif ekip (herkes görür). */
    static async ekip() {
        await panelKuruluOlmali();
        await DestekPersonelSqlRepository.adminleriEsitle();
        const [liste, cevrimici] = await Promise.all([DestekPersonelSqlRepository.liste(), DestekPersonelSqlRepository.cevrimiciler()]);
        return liste
            .filter((x) => x.durum === "AKTIF")
            .map((x) => ({ personelId: x.personelId, adSoyad: x.adSoyad, rol: x.rol, cevrimici: cevrimici.includes(x.personelId) }));
    }
    static async personelListe(p) {
        await panelKuruluOlmali();
        yalnizAdmin(p);
        await DestekPersonelSqlRepository.adminleriEsitle();
        const [liste, cevrimici] = await Promise.all([DestekPersonelSqlRepository.liste(), DestekPersonelSqlRepository.cevrimiciler()]);
        return liste.map((x) => ({ ...personelDto(x), cevrimici: cevrimici.includes(x.personelId) }));
    }
    /** Yeni personel: geçici şifre bir kez döner, ilk girişte değiştirilir. */
    static async personelEkle(p, g) {
        await panelKuruluOlmali();
        yalnizAdmin(p);
        const kullaniciAdi = g.kullaniciAdi.trim().toLowerCase();
        const adSoyad = g.adSoyad.trim();
        if (!/^[a-z0-9._-]{3,50}$/.test(kullaniciAdi))
            throw ApiError.badRequest("Kullanıcı adı 3-50 karakter; harf, rakam, nokta, tire ya da alt çizgi olmalıdır.");
        if (!adSoyad)
            throw ApiError.badRequest("Ad soyad girilmelidir.");
        if (await DestekPersonelSqlRepository.kullaniciAdiIleBul(kullaniciAdi))
            throw ApiError.conflict("Bu kullanıcı adı kullanılıyor.");
        if (await AdminSqlRepository.kullaniciAdiIleBul(kullaniciAdi))
            throw ApiError.conflict("Bu kullanıcı adı yönetim panelinde bir adminin; başka bir ad seçiniz.");
        const sifre = geciciSifre();
        const personelId = await DestekPersonelSqlRepository.ekle({
            kullaniciAdi,
            adSoyad,
            sifreHash: await sifreHashle(sifre),
            rol: g.rol,
            gorme: g.gorme,
            olusturanPersonelId: p.personelId,
        });
        await AdminLogSqlRepository.islemLogu({ adminId: p.adminId, islem: "DESTEK_PERSONEL_EKLENDI", hedefTur: "PERSONEL", hedefId: personelId, yeni: { kullaniciAdi, adSoyad, rol: g.rol, gorme: g.gorme, yapan: p.adSoyad } });
        return { personelId, geciciSifre: sifre };
    }
    /**
     * Rol / görme yetkisi / ad / durum. Admin paneli hesaplarına (her zaman destek admini) dokunulmaz;
     * kişi kendi rolünü düşüremez, kendini pasife alamaz.
     */
    static async personelGuncelle(p, personelId, g) {
        await panelKuruluOlmali();
        yalnizAdmin(p);
        const kayit = await DestekPersonelSqlRepository.idIleBul(personelId);
        if (!kayit)
            throw ApiError.notFound("Personel bulunamadı.");
        if (kayit.adminId)
            throw ApiError.badRequest("Yönetim paneli hesapları buradan değiştirilmez; bu hesaplar her zaman destek adminidir.");
        if (personelId === p.personelId && ((g.rol && g.rol !== "ADMIN") || g.durum === "PASIF")) {
            throw ApiError.badRequest("Kendi yetkinizi düşüremez, kendinizi pasife alamazsınız.");
        }
        const adSoyad = g.adSoyad?.trim();
        if (g.adSoyad !== undefined && !adSoyad)
            throw ApiError.badRequest("Ad soyad boş olamaz.");
        await DestekPersonelSqlRepository.guncelle(personelId, { adSoyad, rol: g.rol, gorme: g.gorme, durum: g.durum });
        if (g.durum === "PASIF") {
            await DestekPersonelSqlRepository.oturumlariIptalEt(personelId);
            // Pasif kişinin açık talepleri havuza döner; kimse göremeyen talep kalmasın
            const { satirlar } = await DestekSqlRepository.panelKonulari({ ...p, gorme: "TUMU" }, { sekme: "tumu", personelId, durum: "ACIK_HEPSI", sayfaBoyu: 200 });
            for (const k of satirlar)
                await DestekService.atamaDegistir(yazan(p), k, null);
        }
        await AdminLogSqlRepository.islemLogu({
            adminId: p.adminId,
            islem: "DESTEK_PERSONEL_GUNCELLENDI",
            hedefTur: "PERSONEL",
            hedefId: personelId,
            eski: { adSoyad: kayit.adSoyad, rol: kayit.rol, gorme: kayit.gorme, durum: kayit.durum },
            yeni: { ...g, yapan: p.adSoyad },
        });
        return this.personelListe(p);
    }
    static async personelSifreSifirla(p, personelId) {
        await panelKuruluOlmali();
        yalnizAdmin(p);
        const kayit = await DestekPersonelSqlRepository.idIleBul(personelId);
        if (!kayit)
            throw ApiError.notFound("Personel bulunamadı.");
        if (kayit.adminId)
            throw ApiError.badRequest("Yönetim paneli hesabının şifresi yönetim panelinden sıfırlanır.");
        const sifre = geciciSifre();
        await DestekPersonelSqlRepository.sifreYaz(personelId, await sifreHashle(sifre), true);
        await DestekPersonelSqlRepository.oturumlariIptalEt(personelId);
        await AdminLogSqlRepository.islemLogu({ adminId: p.adminId, islem: "DESTEK_PERSONEL_SIFRE", hedefTur: "PERSONEL", hedefId: personelId, yeni: { sifirlayan: p.adSoyad } });
        return { geciciSifre: sifre };
    }
    static async personelKilitAc(p, personelId) {
        await panelKuruluOlmali();
        yalnizAdmin(p);
        await DestekPersonelSqlRepository.kilitAc(personelId);
        return this.personelListe(p);
    }
    // -------------------------------------------------------------------- Rapor ---
    /** Tarih aralığı (gün olarak, bit dahil) — D17. */
    static async rapor(p, basStr, bitStr) {
        await panelKuruluOlmali();
        yalnizAdmin(p);
        const bas = new Date(`${basStr}T00:00:00`);
        const bit = new Date(`${bitStr}T00:00:00`);
        if (isNaN(bas.getTime()) || isNaN(bit.getTime()) || bit < bas)
            throw ApiError.badRequest("Tarih aralığı hatalı.");
        bit.setDate(bit.getDate() + 1);
        const [satirlar, genel] = await Promise.all([DestekPersonelSqlRepository.rapor(bas, bit), DestekPersonelSqlRepository.genelSayilar(bas, bit)]);
        return { satirlar, genel };
    }
}
