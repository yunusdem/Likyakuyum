import { env } from "../../config/env.config.js";
import { HttpStatus } from "../../constants/httpStatusCodes.js";
import { FirmaSqlRepository } from "../../models/admin/firmaSql.repository.js";
import { ModulSqlRepository } from "../../models/admin/modulSql.repository.js";
import { MobilSqlRepository } from "../../models/admin/mobilSql.repository.js";
import { MobilKullaniciSqlRepository } from "../../models/admin/mobilKullaniciSql.repository.js";
import { MobilFirmaSqlRepository } from "../../models/mobilFirmaSql.repository.js";
import { ApiError } from "../../utils/ApiError.js";
import { geciciSifreUret, sifreHashle } from "../../utils/sifre.utils.js";
import { firmaDbAnahtari, firmaDbContextHazirla } from "../admin/firmaBaglanti.service.js";
import { acikcaAcikMi } from "../admin/modulAgaci.js";
import { gorunumYoneticisiMi } from "../gorunum/kullaniciGorunum.service.js";
import { firmaEngeli } from "../merkezGiris.service.js";
import { MOBIL_MODUL, ayarDuzenle, cariAyarDuzenle, epostaGecerliMi, girisBaglantisi, kisaAdUret, kullaniciAdiHatasi, kullaniciAdiOner, kullaniciAdiTemizle, limitHatasi, paylasimMetni, } from "./mobilKural.js";
const VARSAYILAN_YETKI = { fiyat: true, bakiye: true, dokum: true, alis: false, satis: false };
const yetkiOku = (g, taban = VARSAYILAN_YETKI) => ({
    fiyat: g?.fiyat === undefined ? taban.fiyat : !!g.fiyat,
    bakiye: g?.bakiye === undefined ? taban.bakiye : !!g.bakiye,
    dokum: g?.dokum === undefined ? taban.dokum : !!g.dokum,
    alis: g?.alis === undefined ? taban.alis : !!g.alis,
    satis: g?.satis === undefined ? taban.satis : !!g.satis,
});
const limitApiHatasi = (limit, kullanilan) => ApiError.badRequest(limitHatasi(limit, kullanilan) || "Mobil kullanıcı sınırı dolu.");
/** Firma başka veritabanında mobil için kullanılabilir mi (aynı müşteri, çalışır durumda, modül açık, bulut) */
const firmaKullanilabilirMi = async (f) => !firmaEngeli(f) && f.baglantiModu !== "setup" && acikcaAcikMi(await ModulSqlRepository.firmaAcikModulleri(f.firmaId), MOBIL_MODUL);
export class MobilYonetimService {
    /** Oturumun firması (merkezde DB anahtarıyla) + müşteri no; yönetici şartı istenirse denetlenir */
    static async baglam(req, yoneticiGerekli = true) {
        const dbServer = req.user?.dbServer;
        const dbName = req.user?.dbName;
        if (!dbServer || !dbName)
            throw ApiError.unauthorized("Oturum bilgisi eksik.");
        await MobilSqlRepository.semaGerekli();
        const firma = await FirmaSqlRepository.anahtarIleBul(firmaDbAnahtari(dbServer, dbName).anahtar);
        if (!firma)
            throw new ApiError(HttpStatus.SERVICE_UNAVAILABLE, "Mobil erişim yalnız merkeze kayıtlı (bulut) firmalarda çalışır.");
        if (!firma.musteriNo)
            throw ApiError.badRequest("Firmanın müşteri nosu tanımlı değil; mobil giriş için hizmet sağlayıcınıza başvurun.");
        const yonetici = await gorunumYoneticisiMi(req);
        if (yoneticiGerekli && !yonetici)
            throw ApiError.forbidden("Mobil tanımlarını yalnız yönetici yapabilir.");
        return {
            firma,
            musteriNo: firma.musteriNo.toUpperCase(),
            ctx: { dbServer, dbName },
            kim: `firma:${req.user?.username || ""}`.slice(0, 100),
            yonetici,
        };
    }
    static async durum(b) {
        const a = await MobilSqlRepository.firmaAyari(b.firma.firmaId);
        return {
            firmaId: b.firma.firmaId,
            unvan: b.firma.unvan,
            musteriNo: b.musteriNo,
            kisaAd: kisaAdUret(b.firma.unvan, a.kisaAd),
            kullaniciLimiti: a.kullaniciLimiti,
            kullanilan: await MobilSqlRepository.firmaErisimSayisi(b.firma.firmaId),
            girisAdresi: girisBaglantisi(env.MOBIL_ADRES, b.musteriNo),
            yonetici: b.yonetici,
        };
    }
    /** Aynı müşteri nonun veritabanları (K25 karşı veritabanı seçimi) */
    static async veritabanlari(b) {
        const liste = await FirmaSqlRepository.musteriNoIleListele(b.musteriNo);
        const sonuc = [];
        for (const x of liste) {
            const f = await FirmaSqlRepository.idIleBul(x.firmaId);
            if (!f)
                continue;
            const modulAcik = acikcaAcikMi(await ModulSqlRepository.firmaAcikModulleri(f.firmaId), MOBIL_MODUL);
            sonuc.push({
                firmaId: f.firmaId,
                unvan: f.unvan,
                dbName: f.dbName,
                buFirma: f.firmaId === b.firma.firmaId,
                modulAcik,
                kullanilabilir: modulAcik && !firmaEngeli(f) && f.baglantiModu !== "setup",
            });
        }
        return sonuc;
    }
    /** Mobil Kullanıcılar (K5): müşteri nonun bütün erişimleri, hangi cari hangi veritabanında */
    static async kullanicilar(b) {
        const erisimler = await MobilKullaniciSqlRepository.musteriErisimleri(b.musteriNo);
        return {
            durum: await this.durum(b),
            erisimler: erisimler.map((e) => ({ ...e, buFirma: e.firmaId === b.firma.firmaId })),
            veritabanlari: await this.veritabanlari(b),
        };
    }
    /** Cari kartındaki sekme: bu caride erişimi olan kullanıcılar + bütün erişimleri + cari ayarı */
    static async cari(b, cariKartId) {
        const cari = await MobilFirmaSqlRepository.cari(b.ctx, cariKartId);
        if (!cari)
            throw ApiError.notFound("Cari kart bulunamadı.");
        await MobilKullaniciSqlRepository.cariBilgisiYenile(b.firma.firmaId, cariKartId, cari.kod, cari.ad).catch(() => undefined);
        const hepsi = await MobilKullaniciSqlRepository.musteriErisimleri(b.musteriNo);
        const kullaniciIdleri = new Set(hepsi.filter((e) => e.firmaId === b.firma.firmaId && e.cariKartId === cariKartId).map((e) => e.mobilKullaniciId));
        const kullanicilar = [...kullaniciIdleri].map((id) => {
            const satirlar = hepsi.filter((e) => e.mobilKullaniciId === id);
            const s = satirlar[0];
            return {
                mobilKullaniciId: id,
                kullaniciAdi: s.kullaniciAdi,
                adSoyad: s.adSoyad,
                eposta: s.eposta,
                durum: s.kullaniciDurum,
                sifreDegismeli: s.sifreDegismeli,
                kilitli: s.kilitli,
                sonGiris: s.sonGiris,
                girisAdresi: girisBaglantisi(env.MOBIL_ADRES, b.musteriNo, s.kullaniciAdi),
                erisimler: satirlar.map((e) => ({ ...e, buFirma: e.firmaId === b.firma.firmaId })),
            };
        });
        return {
            cari,
            durum: await this.durum(b),
            kullanicilar,
            onerilenKullaniciAdi: kullaniciAdiOner(cari.kod, cari.ad),
            ayar: await MobilFirmaSqlRepository.cariAyar(b.ctx, cariKartId),
            veritabanlari: await this.veritabanlari(b),
        };
    }
    /** Yeni mobil kullanıcı (K3, K7, K9): sistem ilk şifreyi üretir, bir kez gösterilir */
    static async kullaniciEkle(b, g) {
        const cariKartId = Number(g?.cariKartId);
        if (!Number.isInteger(cariKartId) || cariKartId <= 0)
            throw ApiError.badRequest("Cari kart seçilmedi.");
        const cari = await MobilFirmaSqlRepository.cari(b.ctx, cariKartId);
        if (!cari)
            throw ApiError.notFound("Cari kart bulunamadı.");
        const kullaniciAdi = kullaniciAdiTemizle(g?.kullaniciAdi || kullaniciAdiOner(cari.kod, cari.ad));
        const adHata = kullaniciAdiHatasi(kullaniciAdi);
        if (adHata)
            throw ApiError.badRequest(adHata);
        const eposta = String(g?.eposta ?? cari.eposta ?? "").trim().toLowerCase() || null;
        if (eposta && !epostaGecerliMi(eposta))
            throw ApiError.badRequest("E-posta adresi geçersiz.");
        const adSoyad = String(g?.adSoyad ?? "").trim().slice(0, 100) || cari.ad.slice(0, 100) || null;
        const geciciSifre = geciciSifreUret(10);
        const sonuc = await MobilKullaniciSqlRepository.kullaniciEkle({
            musteriNo: b.musteriNo,
            kullaniciAdi,
            adSoyad,
            eposta,
            sifreOzet: await sifreHashle(geciciSifre),
            firmaId: b.firma.firmaId,
            cariKartId,
            cariKod: cari.kod,
            cariAd: cari.ad,
            yetkiler: yetkiOku(g?.yetkiler),
            olusturan: b.kim,
        });
        if (sonuc.sonuc === "AD_VAR")
            throw ApiError.conflict(`"${kullaniciAdi}" kullanıcı adı kullanılıyor; başka bir ad yazın.`);
        if (sonuc.sonuc === "LIMIT")
            throw limitApiHatasi(sonuc.limit, sonuc.kullanilan);
        if (sonuc.sonuc !== "TAMAM")
            throw ApiError.badRequest("Kullanıcı eklenemedi.");
        const a = await MobilSqlRepository.firmaAyari(b.firma.firmaId);
        const baglanti = girisBaglantisi(env.MOBIL_ADRES, b.musteriNo, kullaniciAdi);
        return {
            mobilKullaniciId: sonuc.id,
            erisimId: sonuc.erisimId,
            kullaniciAdi,
            geciciSifre,
            girisAdresi: baglanti,
            paylasim: paylasimMetni({ kisaAd: kisaAdUret(b.firma.unvan, a.kisaAd), baglanti, kullaniciAdi, geciciSifre }),
        };
    }
    /** Mobil kullanıcı bu müşteriye mi ait (başka müşterinin kaydına dokunulamaz) */
    static async kullaniciDenetle(b, mobilKullaniciId) {
        const k = Number.isInteger(mobilKullaniciId) ? await MobilKullaniciSqlRepository.kullanici(mobilKullaniciId) : null;
        if (!k || k.musteriNo.toUpperCase() !== b.musteriNo)
            throw ApiError.notFound("Mobil kullanıcı bulunamadı.");
        return k;
    }
    static async erisimDenetle(b, erisimId) {
        const e = Number.isInteger(erisimId) ? await MobilKullaniciSqlRepository.erisim(erisimId) : null;
        if (!e || e.musteriNo.toUpperCase() !== b.musteriNo)
            throw ApiError.notFound("Erişim bulunamadı.");
        return e;
    }
    /** Aynı müşteri nonun başka (ya da bu) veritabanı: kullanılabilir olmalı; bağlantı bağlamını döner */
    static async hedefFirma(b, firmaId) {
        const f = Number.isInteger(firmaId) ? await FirmaSqlRepository.idIleBul(firmaId) : null;
        if (!f || (f.musteriNo || "").toUpperCase() !== b.musteriNo)
            throw ApiError.notFound("Veritabanı bulunamadı.");
        if (f.firmaId === b.firma.firmaId)
            return { firma: f, ctx: b.ctx };
        if (!(await firmaKullanilabilirMi(f)))
            throw ApiError.badRequest(`${f.unvan} veritabanında Mobil modülü açık değil ya da firma kullanımda değil.`);
        return { firma: f, ctx: await firmaDbContextHazirla(f.firmaId) };
    }
    /** Karşı veritabanında cari arama (K25) */
    static async veritabaniCariAra(b, firmaId, aranan) {
        const { ctx } = await this.hedefFirma(b, firmaId);
        return MobilFirmaSqlRepository.cariAra(ctx, String(aranan || "").slice(0, 100));
    }
    /** Var olan kullanıcıya başka veritabanında erişim (K6, K25) */
    static async erisimEkle(b, mobilKullaniciId, g) {
        await this.kullaniciDenetle(b, mobilKullaniciId);
        const { firma, ctx } = await this.hedefFirma(b, Number(g?.firmaId));
        const cariKartId = Number(g?.cariKartId);
        const cari = Number.isInteger(cariKartId) && cariKartId > 0 ? await MobilFirmaSqlRepository.cari(ctx, cariKartId) : null;
        if (!cari)
            throw ApiError.notFound("Seçilen veritabanında cari kart bulunamadı.");
        const sonuc = await MobilKullaniciSqlRepository.erisimEkle({
            mobilKullaniciId,
            firmaId: firma.firmaId,
            cariKartId,
            cariKod: cari.kod,
            cariAd: cari.ad,
            yetkiler: yetkiOku(g?.yetkiler),
            olusturan: b.kim,
        });
        if (sonuc.sonuc === "ERISIM_VAR")
            throw ApiError.conflict("Bu kullanıcının o veritabanında zaten erişimi var.");
        if (sonuc.sonuc === "LIMIT")
            throw ApiError.badRequest(`${firma.unvan}: ${limitHatasi(sonuc.limit, sonuc.kullanilan)}`);
        if (sonuc.sonuc !== "TAMAM")
            throw ApiError.badRequest("Erişim eklenemedi.");
        return MobilKullaniciSqlRepository.erisim(sonuc.erisimId);
    }
    static async erisimGuncelle(b, erisimId, g) {
        const e = await this.erisimDenetle(b, erisimId);
        const durum = g?.durum === undefined ? e.durum : g.durum === "PASIF" ? "PASIF" : g.durum === "AKTIF" ? "AKTIF" : null;
        if (!durum)
            throw ApiError.badRequest("Durum AKTIF ya da PASIF olmalıdır.");
        const sonuc = await MobilKullaniciSqlRepository.erisimGuncelle(erisimId, { yetkiler: yetkiOku(g?.yetkiler, e.yetkiler), durum, guncelleyen: b.kim });
        if (sonuc.sonuc === "LIMIT")
            throw ApiError.badRequest(`${e.firmaUnvan}: ${limitHatasi(sonuc.limit, sonuc.kullanilan)}`);
        return MobilKullaniciSqlRepository.erisim(erisimId);
    }
    static async erisimSil(b, erisimId) {
        await this.erisimDenetle(b, erisimId);
        await MobilKullaniciSqlRepository.erisimSil(erisimId);
    }
    static async kullaniciGuncelle(b, mobilKullaniciId, g) {
        const k = await this.kullaniciDenetle(b, mobilKullaniciId);
        const eposta = g?.eposta === undefined ? k.eposta : String(g.eposta ?? "").trim().toLowerCase() || null;
        if (eposta && !epostaGecerliMi(eposta))
            throw ApiError.badRequest("E-posta adresi geçersiz.");
        const adSoyad = g?.adSoyad === undefined ? k.adSoyad : String(g.adSoyad ?? "").trim().slice(0, 100) || null;
        const durum = g?.durum === undefined ? k.durum : g.durum === "PASIF" ? "PASIF" : g.durum === "AKTIF" ? "AKTIF" : null;
        if (!durum)
            throw ApiError.badRequest("Durum AKTIF ya da PASIF olmalıdır.");
        const sonuc = await MobilKullaniciSqlRepository.kullaniciGuncelle(mobilKullaniciId, { adSoyad, eposta, durum });
        if (sonuc.sonuc === "LIMIT")
            throw limitApiHatasi(sonuc.limit, sonuc.kullanilan);
        return MobilKullaniciSqlRepository.kullanici(mobilKullaniciId).then((x) => x && { ...x, sifreOzet: undefined });
    }
    /** Unutulan şifre (K9): firma yeni geçici şifre verir */
    static async sifreSifirla(b, mobilKullaniciId) {
        const k = await this.kullaniciDenetle(b, mobilKullaniciId);
        const geciciSifre = geciciSifreUret(10);
        await MobilKullaniciSqlRepository.sifreSifirla(mobilKullaniciId, await sifreHashle(geciciSifre));
        const a = await MobilSqlRepository.firmaAyari(b.firma.firmaId);
        const baglanti = girisBaglantisi(env.MOBIL_ADRES, b.musteriNo, k.kullaniciAdi);
        return { geciciSifre, girisAdresi: baglanti, paylasim: paylasimMetni({ kisaAd: kisaAdUret(b.firma.unvan, a.kisaAd), baglanti, kullaniciAdi: k.kullaniciAdi, geciciSifre }) };
    }
    // ------------------------------------------------------------------ Ayarlar ---
    static ayar(b) {
        return MobilFirmaSqlRepository.ayar(b.ctx);
    }
    static async ayarYaz(b, g) {
        const { ayar, hatalar } = ayarDuzenle(g);
        if (hatalar.length)
            throw ApiError.badRequest(hatalar[0], { hatalar });
        if (ayar.vezneId !== null && !(await MobilFirmaSqlRepository.vezneVarMi(b.ctx, ayar.vezneId)))
            throw ApiError.badRequest("Seçilen vezne bulunamadı.");
        if (ayar.kullaniciId !== null && !(await MobilFirmaSqlRepository.kullaniciVarMi(b.ctx, ayar.kullaniciId)))
            throw ApiError.badRequest("Seçilen kullanıcı bulunamadı.");
        await MobilFirmaSqlRepository.ayarYaz(b.ctx, ayar, b.kim);
        return MobilFirmaSqlRepository.ayar(b.ctx);
    }
    static async cariAyarYaz(b, cariKartId, g) {
        if (!(await MobilFirmaSqlRepository.cari(b.ctx, cariKartId)))
            throw ApiError.notFound("Cari kart bulunamadı.");
        const { ayar, hatalar } = cariAyarDuzenle(g);
        if (hatalar.length)
            throw ApiError.badRequest(hatalar[0], { hatalar });
        await MobilFirmaSqlRepository.cariAyarYaz(b.ctx, cariKartId, ayar, b.kim);
        return MobilFirmaSqlRepository.cariAyar(b.ctx, cariKartId);
    }
}
