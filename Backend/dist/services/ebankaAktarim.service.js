import { EBankaAktarimSqlRepository } from "../models/ebankaAktarimSql.repository.js";
import { EBankaMutabakatSqlRepository } from "../models/ebankaMutabakatSql.repository.js";
import { EBankaSqlRepository } from "../models/ebankaSql.repository.js";
import { ApiError } from "../utils/ApiError.js";
import { BankaService } from "./banka.service.js";
import { aciklamaNumaralari, isimAnahtari, isimKelimeleri, isimTutar } from "./ebankaCariEslesme.js";
// F- e-Banka Faz 2 — Vomsis hareketinin banka fişine aktarımı (docs/EBANKA_VOMSIS_YOL_HARITASI.md, E5–E8, E13–E17, E19, E23, E26–E30)
//  - alacaklı hareket → "0- Havale Alma", borçlu hareket → "1- Havale/EFT Gönderme"
//  - kendi hesaplarımız arası virman: her bacak kendi hesabına carisiz fiş olur (mevcut "4- Virman" fişi bakiyelere yansımadığı için)
//  - Test (örnek veri) modunda hiçbir zaman fiş kesilmez; yalnızca ne yapılacağı gösterilir
const HAVALE_ALMA = 0;
const HAVALE_GONDERME = 1;
/** IBAN karşılaştırması boşluk ve harf büyüklüğünden bağımsız */
export const ibanSade = (i) => (i || "").replace(/\s/g, "").toUpperCase();
const benzersiz = (liste) => [...new Set(liste.filter((x) => x !== null && x !== undefined && x !== ""))];
/**
 * Bir hareketin otomatik aktarımda ne olacağına karar verir. Veritabanına dokunmaz (kur hariç her şey sözlüklerden gelir).
 * Sıra önemlidir: önce "aktarma" kuralı, sonra aktarımı engelleyen eksikler, en son cari eşleşmesi.
 */
export const planla = (h, s) => {
    const islemTipi = h.tutar >= 0 ? HAVALE_ALMA : HAVALE_GONDERME;
    const paraId = s.paraKodlari.get((h.doviz || "TL").toUpperCase()) ?? null;
    // Karşı taraf bizim başka bir hesabımızsa virmandır. Aktarımı engelleyen eksikler (kartla eşlenmemiş hesap gibi) olsa da
    // virman olduğu bilinsin: mutabakat bu hareket için fiş / fatura aramaz.
    const karsiIbanlar = benzersiz([h.karsiIban, islemTipi === HAVALE_ALMA ? h.gonderenIban : h.aliciIban]);
    const bizimHesap = karsiIbanlar.map((i) => s.bizimIbanlar.get(ibanSade(i))).find(Boolean);
    const taban = { islemTipi, cari: null, virman: Boolean(bizimHesap), paraId, tlMi: paraId !== null && paraId === s.tlId };
    if (h.tipKurali === 2)
        return { ...taban, karar: "aktarma", neden: "Bu hareket tipi aktarılmıyor" };
    if (!h.bankaId)
        return { ...taban, karar: "bekle", neden: "Hesap bir Banka Hesap Kartı ile eşleşmedi" };
    if (paraId === null)
        return { ...taban, karar: "bekle", neden: `"${h.doviz}" döviz cinsi para tanımlarında yok` };
    if (!h.tutar)
        return { ...taban, karar: "bekle", neden: "Tutar sıfır" };
    if (h.tipKurali === 1)
        return { ...taban, karar: "bekle", neden: "Bu hareket tipi elle aktarılır" };
    if (bizimHesap)
        return { ...taban, karar: "aktar", neden: `Hesaplar arası virman (${bizimHesap})` };
    // Tipin varsayılan carisi (masraf, faiz, vergi…)
    if (h.tipCariId) {
        const cari = s.tipCarileri.get(h.tipCariId);
        if (cari)
            return { ...taban, karar: "aktar", neden: "Hareket tipinin varsayılan carisi", cari };
    }
    // Cari 3 kriterle bulunur, en az 2'si aynı cariyi göstermeli (M10–M13):
    //  (1) VKN/TC — bankanın alanları + açıklamaya yazılan numara, (2) gönderen / karşı taraf adı ↔ cari adı, (3) öğrenilmiş karşı IBAN
    const numaralar = benzersiz([h.karsiVkn, h.gonderenVkn, h.gonderenTckn, h.odeyenVkn].map((n) => (n || "").trim()).concat(aciklamaNumaralari(h.aciklama)));
    const adlar = benzersiz(islemTipi === HAVALE_ALMA ? [h.karsiUnvan, h.gonderenUnvan, h.gonderenAd] : [h.karsiUnvan]);
    const puanlar = new Map();
    const isaretle = (c, k) => {
        const p = puanlar.get(c.cariKartId) || { cari: c, vkn: false, isim: false, iban: false };
        p[k] = true;
        puanlar.set(c.cariKartId, p);
    };
    for (const n of numaralar)
        for (const c of s.vknSozlugu.get(n) || [])
            isaretle(c, "vkn");
    for (const ad of adlar) {
        const k = isimKelimeleri(ad);
        const anahtar = isimAnahtari(k);
        for (const c of (anahtar && s.isimSozlugu.get(anahtar)) || [])
            if (isimTutar(k, c.kelimeler))
                isaretle(c.cari, "isim");
    }
    for (const i of karsiIbanlar) {
        const c = s.ibanSozlugu.get(i);
        if (c)
            isaretle(c, "iban");
    }
    const tutanlar = (p) => [p.vkn && "VKN/TC", p.isim && "isim", p.iban && "IBAN"].filter(Boolean).join(" + ");
    const hepsi = [...puanlar.values()];
    const ikili = hepsi.filter((p) => Number(p.vkn) + Number(p.isim) + Number(p.iban) >= 2);
    if (ikili.length === 1)
        return { ...taban, karar: "aktar", neden: `${tutanlar(ikili[0])} tuttu`, cari: ikili[0].cari };
    if (ikili.length > 1)
        return { ...taban, karar: "bekle", neden: `${ikili.length} cari iki kritere uyuyor; cariyi seçin` };
    // Tek kriter: cari atanmaz, öneri olarak gösterilir (M11). Öncelik VKN/TC → IBAN → isim, o kriterde tek cari olmalı.
    const tek = (k) => {
        const l = hepsi.filter((p) => p[k]);
        return l.length === 1 ? l[0] : null;
    };
    const o = tek("vkn") || tek("iban") || tek("isim");
    if (o)
        return { ...taban, karar: "bekle", neden: `Önerilen cari: ${o.cari.ad} (yalnız ${tutanlar(o)} tuttu)`, oneri: o.cari };
    if (hepsi.length)
        return { ...taban, karar: "bekle", neden: `Tek kritere uyan ${hepsi.length} cari var; cariyi seçin` };
    return { ...taban, karar: "bekle", neden: numaralar.length || karsiIbanlar.length || adlar.length ? "Cari bulunamadı" : "Karşı taraf bilgisi yok" };
};
const gun = (h) => (h.sistemTarihi || "").slice(0, 10);
export class EBankaAktarimService {
    static async sozlukler(dbContext) {
        const [bizimIbanlar, vknSozlugu, ibanSozlugu, cariler, para, kurallar] = await Promise.all([
            EBankaAktarimSqlRepository.bizimIbanlar(dbContext),
            EBankaAktarimSqlRepository.vknSozlugu(dbContext),
            EBankaAktarimSqlRepository.ibanSozlugu(dbContext),
            EBankaAktarimSqlRepository.cariAdlari(dbContext),
            EBankaAktarimSqlRepository.paraSozlugu(dbContext),
            EBankaAktarimSqlRepository.tipKurallari(dbContext),
        ]);
        const tipCarileri = new Map();
        for (const k of kurallar)
            if (k.cariKartId && k.cariAdi !== null)
                tipCarileri.set(k.cariKartId, { cariKartId: k.cariKartId, kod: k.cariKod || "", ad: k.cariAdi });
        const isimSozlugu = new Map();
        for (const c of cariler) {
            const kelimeler = isimKelimeleri(c.ad);
            const a = isimAnahtari(kelimeler);
            if (a)
                isimSozlugu.set(a, [...(isimSozlugu.get(a) || []), { cari: c, kelimeler }]);
        }
        return { bizimIbanlar, vknSozlugu, ibanSozlugu, isimSozlugu, tipCarileri, paraKodlari: para.kodlar, tlId: para.tlId };
    }
    /** Bekleyenler ekranı: karara bağlanmamış hareketler + otomatik aktarımda her birine ne olacağı. */
    static async bekleyenler(dbContext) {
        const ayar = await EBankaSqlRepository.ayarGetir(dbContext);
        const mod = ayar?.mod ?? "sahte";
        const baslangic = ayar?.aktarimBaslangic ?? null;
        if (!baslangic)
            return { mod, aktarimBaslangic: null, satirlar: [] };
        const [adaylar, s] = await Promise.all([EBankaAktarimSqlRepository.bekleyenler(baslangic, dbContext), this.sozlukler(dbContext)]);
        return {
            mod,
            aktarimBaslangic: baslangic,
            satirlar: adaylar.map((h) => {
                const p = planla(h, s);
                return { ...h, plan: { karar: p.karar, neden: p.neden, islemTipi: p.islemTipi, virman: p.virman, tlMi: p.tlMi, cari: p.cari, oneri: p.oneri ?? null } };
            }),
        };
    }
    static async canliMi(dbContext) {
        const ayar = await EBankaSqlRepository.ayarGetir(dbContext);
        if ((ayar?.mod ?? "sahte") !== "canli")
            throw ApiError.badRequest("Test (örnek veri) modunda fiş kesilmez. Aktarım yalnızca Canlı modda çalışır.");
        if (!ayar?.aktarimBaslangic)
            throw ApiError.badRequest("Aktarım başlangıç tarihi girilmemiş (F- e-Banka > Ayarlar).");
        return { baslangic: ayar.aktarimBaslangic };
    }
    /** Fişi keser ve hareketi işaretler. Hareket önce kilitlenir; fiş kesilemezse kilit bırakılır. */
    static async fisKes(h, p, kullaniciId, dbContext) {
        if (!(await EBankaAktarimSqlRepository.talepEt(h.vomsisId, dbContext)))
            throw ApiError.conflict("Bu hareket zaten aktarılmış ya da aktarılmayacak olarak işaretli.");
        try {
            const meblag = Math.abs(h.tutar);
            const aciklama = `${p.aciklamaOneki || ""}${h.aciklama || h.tipAdi || ""}`.trim().slice(0, 250) || null;
            const fis = await BankaService.saveHareket({
                islemTipi: p.islemTipi,
                bankaId: h.bankaId,
                cariKartId: p.cariKartId,
                // Yalnızca gün yazılır (saat 00:00), elle girilen banka fişleri gibi. Saat de yazılsaydı mevcut banka ekranı listede tarihi
                // tarayıcı saat dilimine çevirdiği için 21:00 sonrası hareketler ertesi güne kaymış görünürdü. Saat e-Banka kaydında durur.
                tarih: `${gun(h)}T00:00:00Z`,
                belgeNo: (h.fisNo || h.evrakNo || "").slice(0, 50) || null,
                aciklama,
                satirlar: [{ satirNo: 1, paraId: p.paraId, meblag, kur: p.kur, giseKuru: p.kur, tutarTl: Math.round(meblag * p.kur * 100) / 100, aciklama }],
            }, kullaniciId, dbContext);
            await EBankaAktarimSqlRepository.aktarildiYaz(h.vomsisId, fis.bankaHareketId, p.cariKartId, dbContext);
            return fis.bankaHareketId;
        }
        catch (err) {
            await EBankaAktarimSqlRepository.talebiBirak(h.vomsisId, dbContext).catch(() => undefined);
            throw err;
        }
    }
    /**
     * Çift sayım önlemi (docs/TAHSILAT_MUTABAKATI_YOL_HARITASI.md, M18): hareket, aynı Banka Hesap Kartına Hesap satırı olan bir sarraf /
     * perakende fişiyle eşlenmişse banka girişini o fiş taşır. Böyle hareketin banka fişi kesilmez (aktarım durumu 3), kesilmişse iptal edilir.
     * Eşleşme kalkar ya da fişten Hesap satırı çıkarsa geri alınır: iptal kaldırılır, fişi olmayan hareket Bekleyenler'e döner.
     * vomsisIdler null: tüm hareketler.
     */
    static async kapsamiUygula(vomsisIdler, kullaniciId, dbContext) {
        const farklar = await EBankaMutabakatSqlRepository.kapsamFarklari(vomsisIdler, dbContext);
        let karsilanan = 0;
        let geriAlinan = 0;
        let iptalEdilen = 0;
        for (const f of farklar) {
            if (f.karsilaniyor) {
                // Fiş iptal edilince banka tarafındaki kanca durumu 2 yapar; buradan 3'e çekilir ki geri alınabileceği bilinsin
                if (f.bankaHareketId)
                    await BankaService.toggleIptalHareket(f.bankaHareketId, true, kullaniciId, dbContext);
                if (await EBankaMutabakatSqlRepository.kapsamDurumuYaz(f.vomsisId, f.bankaHareketId ? 2 : 0, 3, dbContext)) {
                    karsilanan++;
                    if (f.bankaHareketId)
                        iptalEdilen++;
                }
            }
            else if (f.bankaHareketId) {
                // İptal geri alınınca kanca durumu yeniden 1 (aktarıldı) yapar
                await BankaService.toggleIptalHareket(f.bankaHareketId, false, kullaniciId, dbContext);
                geriAlinan++;
            }
            else if (await EBankaMutabakatSqlRepository.kapsamDurumuYaz(f.vomsisId, 3, 0, dbContext)) {
                geriAlinan++;
            }
        }
        if (karsilanan || geriAlinan) {
            const ayar = await EBankaSqlRepository.ayarGetir(dbContext);
            await EBankaSqlRepository.logYaz({
                islem: "fisle-karsilama",
                mod: ayar?.mod ?? "sahte",
                basarili: true,
                adet: karsilanan + geriAlinan,
                mesaj: `${karsilanan} hareketin banka girişi fişin Hesap satırında (${iptalEdilen} banka fişi iptal edildi), ${geriAlinan} hareket geri alındı`,
                kullaniciId,
            }, dbContext);
        }
        return { karsilanan, geriAlinan };
    }
    /** kapsamiUygula'nın asıl işi (eşleme, listeleme, aktarım) durdurmayan hali: hata günlüğe yazılır, bir sonraki çağrıda yeniden denenir. */
    static async kapsamiDene(vomsisIdler, kullaniciId, dbContext) {
        try {
            await this.kapsamiUygula(vomsisIdler, kullaniciId, dbContext);
        }
        catch (err) {
            const ayar = await EBankaSqlRepository.ayarGetir(dbContext).catch(() => null);
            await EBankaSqlRepository.logYaz({ islem: "fisle-karsilama", mod: ayar?.mod ?? "sahte", basarili: false, mesaj: err?.message || String(err), kullaniciId }, dbContext);
        }
    }
    /** Otomatik aktarım: eşitlemeden sonra ve Bekleyenler ekranındaki butonla çalışır. */
    static async calistir(kullaniciId, dbContext) {
        const { baslangic } = await this.canliMi(dbContext);
        // Fişin Hesap satırıyla karşılanan hareket bekleyenlerden çıksın, banka fişi kesilmesin
        await this.kapsamiDene(null, kullaniciId, dbContext);
        const aktarilmayacak = await EBankaAktarimSqlRepository.aktarilmayacaklariKapat(baslangic, dbContext);
        const [adaylar, s] = await Promise.all([EBankaAktarimSqlRepository.bekleyenler(baslangic, dbContext), this.sozlukler(dbContext)]);
        let aktarilan = 0;
        let hatali = 0;
        let bekleyen = 0;
        const kurlar = new Map();
        for (const h of adaylar) {
            const p = planla(h, s);
            if (p.karar !== "aktar" || p.paraId === null) {
                bekleyen++;
                continue;
            }
            let kur = 1;
            if (!p.tlMi) {
                const anahtar = `${p.paraId}|${gun(h)}|${p.islemTipi}`;
                if (!kurlar.has(anahtar))
                    kurlar.set(anahtar, await EBankaAktarimSqlRepository.kurGetir(p.paraId, gun(h), p.islemTipi === HAVALE_ALMA, dbContext));
                kur = kurlar.get(anahtar) || 0;
                // Kur tablosunda karşılığı yoksa TL tutar yanlış olur; kullanıcı kuru elle girsin
                if (kur <= 0) {
                    bekleyen++;
                    continue;
                }
            }
            try {
                await this.fisKes(h, { islemTipi: p.islemTipi, cariKartId: p.cari?.cariKartId ?? null, paraId: p.paraId, kur, aciklamaOneki: p.virman ? "Virman: " : "" }, kullaniciId, dbContext);
                aktarilan++;
            }
            catch {
                hatali++;
            }
        }
        const sonuc = { aktarilan, aktarilmayacak, bekleyen, hatali };
        await EBankaSqlRepository.logYaz({
            islem: "aktarim",
            mod: "canli",
            basarili: hatali === 0,
            adet: aktarilan,
            mesaj: `${aktarilan} fiş kesildi, ${aktarilmayacak} hareket aktarılmayacak olarak kapatıldı, ${bekleyen} bekliyor${hatali ? `, ${hatali} hata` : ""}`,
            kullaniciId,
        }, dbContext);
        return sonuc;
    }
    /** Bekleyenler'den elle aktarım: cariyi (isteğe bağlı) ve döviz hesabında kuru kullanıcı verir. */
    static async elleAktar(vomsisId, girdi, kullaniciId, dbContext) {
        await this.canliMi(dbContext);
        await this.kapsamiDene([vomsisId], kullaniciId, dbContext);
        const h = await EBankaAktarimSqlRepository.adayGetir(vomsisId, dbContext);
        if (!h)
            throw ApiError.notFound("Hareket bulunamadı.");
        if (h.aktarimDurumu === 3)
            throw ApiError.conflict("Bu hareketin banka girişi, eşlendiği fişin Hesap satırında; ayrıca banka fişi kesilmez.");
        if (h.aktarimDurumu !== 0)
            throw ApiError.conflict("Bu hareket bekleyenlerde değil.");
        if (!h.bankaId)
            throw ApiError.badRequest("Hesap bir Banka Hesap Kartı ile eşleşmedi. Önce F- e-Banka > Hesaplar ekranından eşleyin.");
        if (!h.tutar)
            throw ApiError.badRequest("Tutarı sıfır olan hareket aktarılamaz.");
        const para = await EBankaAktarimSqlRepository.paraSozlugu(dbContext);
        const paraId = para.kodlar.get((h.doviz || "TL").toUpperCase());
        if (!paraId)
            throw ApiError.badRequest(`"${h.doviz}" döviz cinsi para tanımlarında yok.`);
        const cariKartId = girdi.cariKartId ? Number(girdi.cariKartId) : null;
        if (cariKartId && !(await EBankaAktarimSqlRepository.cariGetir(cariKartId, dbContext)))
            throw ApiError.badRequest("Seçilen cari bulunamadı.");
        const islemTipi = h.tutar >= 0 ? HAVALE_ALMA : HAVALE_GONDERME;
        let kur = 1;
        if (paraId !== para.tlId) {
            kur = Number(girdi.kur) > 0 ? Number(girdi.kur) : await EBankaAktarimSqlRepository.kurGetir(paraId, gun(h), islemTipi === HAVALE_ALMA, dbContext);
            if (!(kur > 0))
                throw ApiError.badRequest("Bu tarih için kur bulunamadı; kuru elle girin.");
        }
        const bankaHareketId = await this.fisKes(h, { islemTipi, cariKartId, paraId, kur }, kullaniciId, dbContext);
        // Sonraki hareket kendiliğinden eşleşsin (E17). Kendi hesabımızın IBAN'ı cariye bağlanmaz.
        const karsiIban = h.karsiIban || (islemTipi === HAVALE_ALMA ? h.gonderenIban : h.aliciIban);
        if (cariKartId && karsiIban && !(await EBankaAktarimSqlRepository.bizimIbanlar(dbContext)).has(ibanSade(karsiIban))) {
            await EBankaAktarimSqlRepository.ibanOgren(karsiIban, cariKartId, dbContext).catch(() => undefined);
        }
        return { bankaHareketId };
    }
    /** Bekliyor ↔ aktarılmayacak. */
    static async durumDegistir(vomsisIdler, aktarilmayacak, dbContext) {
        const idler = Array.isArray(vomsisIdler) ? vomsisIdler.map(Number) : [];
        if (!idler.length)
            throw ApiError.badRequest("Hareket seçilmedi.");
        return { degisen: await EBankaAktarimSqlRepository.durumYaz(idler, aktarilmayacak ? 2 : 0, dbContext) };
    }
    static async tipKurallari(dbContext) {
        return EBankaAktarimSqlRepository.tipKurallari(dbContext);
    }
    static async tipKuraliKaydet(tipKodu, girdi, dbContext) {
        const kural = Number(girdi.kural);
        if (![0, 1, 2].includes(kural))
            throw ApiError.badRequest("Geçersiz kural.");
        const cariKartId = girdi.cariKartId ? Number(girdi.cariKartId) : null;
        if (cariKartId && !(await EBankaAktarimSqlRepository.cariGetir(cariKartId, dbContext)))
            throw ApiError.badRequest("Seçilen cari bulunamadı.");
        if (!(await EBankaAktarimSqlRepository.tipKuraliYaz(tipKodu, kural, cariKartId, dbContext)))
            throw ApiError.notFound("Hareket tipi bulunamadı.");
        return EBankaAktarimSqlRepository.tipKurallari(dbContext);
    }
    static async cariAra(arama, dbContext) {
        if (!arama || arama.trim().length < 2)
            return [];
        return EBankaAktarimSqlRepository.cariAra(arama, dbContext);
    }
}
