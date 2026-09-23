import { EBankaMutabakatSqlRepository } from "../models/ebankaMutabakatSql.repository.js";
import { ApiError } from "../utils/ApiError.js";
import { EBankaAktarimService, planla } from "./ebankaAktarim.service.js";
// F- e-Banka > Tahsilat / Ödeme Mutabakatı (docs/TAHSILAT_MUTABAKATI_YOL_HARITASI.md, M1–M9)
// Bankaya giren / bankadan çıkan her para için: karşılığında fiş var mı, fişin faturası kesilmiş / gelmiş mi.
/** Fiş tarihi, banka hareketinden en çok bu kadar gün önce / sonra olabilir */
const ONCE_GUN = 7;
const SONRA_GUN = 3;
const KURUS = 0.01;
const gunEkle = (gun, n) => new Date(Date.parse(`${gun}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const yuvarla = (n) => Math.round(n * 100) / 100;
const karsiTaraf = (h) => h.karsiUnvan || h.gonderenUnvan || h.gonderenAd || null;
const anahtar = (f) => `${f.fisTuru}:${f.fisId}`;
/**
 * Tek bir hareketin durumu. Saf fonksiyon: veritabanına dokunmaz.
 * Öncelik: virman → "fatura gerektirmez" → eşlenmiş fiş(ler) → aday → fişsiz.
 */
export const durumBelirle = (h, virman, fisler, adaySayisi) => {
    if (virman)
        return { durum: "virman", fark: null };
    if (fisler.length) {
        const fark = yuvarla(Math.abs(h.tutar) - fisler.reduce((t, f) => t + f.tutar, 0));
        return { durum: fisler.every((f) => f.faturali) ? "faturalandi" : "faturasiz", fark: Math.abs(fark) < KURUS ? 0 : fark };
    }
    if (h.faturaGerekmez)
        return { durum: "gerekmez", fark: null };
    return { durum: adaySayisi ? "oneri" : "fissiz", fark: null };
};
export class EBankaMutabakatService {
    /**
     * Listeyi hazırlar ve otomatik eşleştirmeyi yapar (M8): TL hesapta, carisi belli harekete tutarı kuruşu kuruşuna tutan,
     * başka harekete eşlenmemiş TEK fiş varsa kendiliğinden eşlenir. Birden çok aday ya da tutar farkı varsa kullanıcıya bırakılır.
     */
    static async liste(girdi, kullaniciId, dbContext) {
        const gunMu = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
        if (!gunMu(girdi.baslangic) || !gunMu(girdi.bitis))
            throw ApiError.badRequest("Başlangıç ve bitiş tarihi zorunludur.");
        if (girdi.baslangic > girdi.bitis)
            throw ApiError.badRequest("Başlangıç tarihi bitiş tarihinden sonra olamaz.");
        if ((Date.parse(girdi.bitis) - Date.parse(girdi.baslangic)) / 86_400_000 > 366)
            throw ApiError.badRequest("Tek seferde en fazla bir yıllık aralık listelenebilir.");
        const [hepsi, s] = await Promise.all([EBankaMutabakatSqlRepository.hareketler(girdi.baslangic, girdi.bitis, dbContext), EBankaAktarimService.sozlukler(dbContext)]);
        const hareketler = hepsi.filter((h) => !girdi.yon || (girdi.yon === "gelen" ? h.tutar > 0 : h.tutar < 0));
        // Cari: fişe aktarılmışsa aktarılan cari, değilse aktarım planının bulduğu cari (VKN / öğrenilmiş IBAN / tip carisi)
        const planlar = new Map(hareketler.map((h) => [h.vomsisId, planla(h, s)]));
        const cariBul = (h) => {
            const p = planlar.get(h.vomsisId);
            if (h.aktarilanCariId)
                return { cariKartId: h.aktarilanCariId, neden: "Fişe aktarılan cari" };
            if (p.cari)
                return { cariKartId: p.cari.cariKartId, neden: p.neden };
            return null;
        };
        // Eşlenmiş fişler
        let eslesmeler = await EBankaMutabakatSqlRepository.eslesmeler(hareketler.map((h) => h.vomsisId), dbContext);
        // Adaylar: carisi belli, virman değil, fişi olmayan, "fatura gerektirmez" işaretlenmemiş hareketler için
        const eslenenHareketler = new Set(eslesmeler.map((e) => e.vomsisId));
        const aranacak = hareketler.filter((h) => !planlar.get(h.vomsisId).virman && !eslenenHareketler.has(h.vomsisId) && !h.faturaGerekmez && cariBul(h));
        const adaylarByHareket = new Map();
        if (aranacak.length) {
            const gunler = aranacak.map((h) => (h.sistemTarihi || "").slice(0, 10)).sort();
            const havuz = await EBankaMutabakatSqlRepository.fisler({ cariIdler: aranacak.map((h) => cariBul(h).cariKartId), baslangic: gunEkle(gunler[0], -ONCE_GUN), bitis: gunEkle(gunler[gunler.length - 1], SONRA_GUN) }, dbContext);
            const baskaYerde = await EBankaMutabakatSqlRepository.eslenmisFisler(havuz, dbContext);
            const reddedilen = await EBankaMutabakatSqlRepository.reddedilenler(aranacak.map((h) => h.vomsisId), dbContext);
            for (const h of aranacak) {
                const gun = (h.sistemTarihi || "").slice(0, 10);
                const yon = h.tutar > 0 ? "gelen" : "giden";
                const cariId = cariBul(h).cariKartId;
                const adaylar = havuz
                    .filter((f) => f.cariKartId === cariId && f.yon === yon && f.tarih !== null && f.tarih >= gunEkle(gun, -ONCE_GUN) && f.tarih <= gunEkle(gun, SONRA_GUN))
                    .map((f) => ({ ...f, fark: yuvarla(Math.abs(h.tutar) - f.tutar), baskaHarekette: baskaYerde.has(anahtar(f)) }))
                    .sort((a, b) => Number(a.baskaHarekette) - Number(b.baskaHarekette) || Math.abs(a.fark) - Math.abs(b.fark) || String(b.tarih).localeCompare(String(a.tarih)));
                adaylarByHareket.set(h.vomsisId, adaylar);
            }
            // Otomatik eşleştirme iki yönden de tek olmalı: hareketin tam tutan tek fişi var VE o fiş tam tutan tek hareketin adayı.
            // Aynı müşteriden aynı tutar birkaç gün üst üste gelebilir; o durumda hangisinin hangisi olduğunu kullanıcı seçer.
            const tlMi = (h) => ["TL", "TRY", ""].includes((h.doviz || "").toUpperCase());
            const tamlar = new Map();
            const fisinTamHareketleri = new Map();
            for (const h of aranacak) {
                if (!tlMi(h))
                    continue;
                const tam = (adaylarByHareket.get(h.vomsisId) || []).filter((f) => !f.baskaHarekette && Math.abs(f.fark) < KURUS && !reddedilen.has(`${h.vomsisId}|${anahtar(f)}`));
                tamlar.set(h.vomsisId, tam);
                for (const f of tam)
                    fisinTamHareketleri.set(anahtar(f), (fisinTamHareketleri.get(anahtar(f)) || 0) + 1);
            }
            for (const h of aranacak) {
                const tam = tamlar.get(h.vomsisId) || [];
                if (tam.length !== 1 || fisinTamHareketleri.get(anahtar(tam[0])) !== 1)
                    continue;
                await EBankaMutabakatSqlRepository.esle({ vomsisId: h.vomsisId, fisTuru: tam[0].fisTuru, fisId: tam[0].fisId, otomatik: true }, kullaniciId, dbContext);
                eslesmeler.push({ vomsisId: h.vomsisId, fisTuru: tam[0].fisTuru, fisId: tam[0].fisId, otomatik: true });
                adaylarByHareket.delete(h.vomsisId);
            }
        }
        // Eşlenmiş fişlerin güncel bilgisi (faturası sonradan kesilmiş olabilir; fiş silinmişse eşleşme görünmez)
        const eslenenFisler = eslesmeler.length ? await EBankaMutabakatSqlRepository.fisler({ kimlikler: eslesmeler }, dbContext) : [];
        const fisSozlugu = new Map(eslenenFisler.map((f) => [anahtar(f), f]));
        const cariAdlari = new Map([...eslenenFisler, ...[...adaylarByHareket.values()].flat()].filter((f) => f.cariKartId && f.cariAdi).map((f) => [f.cariKartId, f.cariAdi]));
        for (const c of [...s.vknSozlugu.values()].flat())
            cariAdlari.set(c.cariKartId, c.ad);
        for (const c of s.ibanSozlugu.values())
            cariAdlari.set(c.cariKartId, c.ad);
        for (const c of s.tipCarileri.values())
            cariAdlari.set(c.cariKartId, c.ad);
        const satirlar = hareketler.map((h) => {
            const p = planlar.get(h.vomsisId);
            const fisler = eslesmeler
                .filter((e) => e.vomsisId === h.vomsisId)
                .flatMap((e) => {
                const f = fisSozlugu.get(anahtar(e));
                return f ? [{ ...f, otomatik: e.otomatik }] : [];
            });
            const adaylar = fisler.length ? [] : adaylarByHareket.get(h.vomsisId) || [];
            const { durum, fark } = durumBelirle(h, p.virman, fisler, adaylar.length);
            const c = cariBul(h);
            return {
                vomsisId: h.vomsisId,
                tarih: h.sistemTarihi,
                bankaAdi: h.bankaAdi,
                hesapNo: h.hesapNo,
                doviz: h.doviz,
                yon: h.tutar > 0 ? "gelen" : "giden",
                tutar: Math.abs(h.tutar),
                tipAdi: h.tipAdi,
                karsiTaraf: karsiTaraf(h),
                aciklama: h.aciklama,
                cari: c ? { cariKartId: c.cariKartId, ad: cariAdlari.get(c.cariKartId) || `#${c.cariKartId}` } : null,
                cariNedeni: c ? c.neden : p.neden,
                durum,
                fark,
                faturaGerekmez: h.faturaGerekmez,
                not: h.not,
                fisler,
                adaylar,
            };
        });
        const say = (d) => satirlar.filter((x) => x.durum === d).length;
        return {
            satirlar,
            ozet: {
                toplam: satirlar.length,
                faturalandi: say("faturalandi"),
                faturasiz: say("faturasiz"),
                fissiz: say("fissiz"),
                oneri: say("oneri"),
                gerekmez: say("gerekmez"),
                virman: say("virman"),
                farkli: satirlar.filter((x) => x.fark !== null && x.fark !== 0).length,
            },
        };
    }
    /** Elle eşleştirme. Carisi farklı fiş de seçilebilir (kullanıcı bilerek seçer); fişin var olduğu doğrulanır. */
    static async esle(girdi, kullaniciId, dbContext) {
        const { vomsisId, fisTuru, fisId } = this.dogrula(girdi);
        const [fis] = await EBankaMutabakatSqlRepository.fisler({ kimlikler: [{ fisTuru, fisId }] }, dbContext);
        if (!fis)
            throw ApiError.notFound("Fiş bulunamadı (silinmiş ya da iptal edilmiş olabilir).");
        await EBankaMutabakatSqlRepository.esle({ vomsisId, fisTuru, fisId, otomatik: false }, kullaniciId, dbContext);
        return { eslendi: true };
    }
    static async eslemeyiKaldir(girdi, dbContext) {
        const { vomsisId, fisTuru, fisId } = this.dogrula(girdi);
        return { kaldirilan: await EBankaMutabakatSqlRepository.eslemeyiKaldir(vomsisId, fisTuru, fisId, dbContext) };
    }
    static async faturaGerekmez(girdi, kullaniciId, dbContext) {
        const vomsisId = Number(girdi.vomsisId);
        if (!Number.isSafeInteger(vomsisId) || vomsisId <= 0)
            throw ApiError.badRequest("Geçersiz hareket.");
        const not = typeof girdi.not === "string" && girdi.not.trim() ? girdi.not.trim().slice(0, 250) : null;
        if (!(await EBankaMutabakatSqlRepository.isaretle(vomsisId, Boolean(girdi.deger), not, kullaniciId, dbContext)))
            throw ApiError.notFound("Hareket bulunamadı.");
        return { faturaGerekmez: Boolean(girdi.deger) };
    }
    static dogrula(girdi) {
        const vomsisId = Number(girdi.vomsisId);
        const fisId = Number(girdi.fisId);
        const fisTuru = String(girdi.fisTuru);
        if (!Number.isSafeInteger(vomsisId) || vomsisId <= 0 || !Number.isSafeInteger(fisId) || fisId <= 0)
            throw ApiError.badRequest("Geçersiz hareket ya da fiş.");
        if (!["doviz", "sarraf", "perakende"].includes(fisTuru))
            throw ApiError.badRequest("Geçersiz fiş türü.");
        return { vomsisId, fisTuru, fisId };
    }
}
