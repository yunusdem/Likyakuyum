import { PosAdminSqlRepository } from "../../models/admin/posAdminSql.repository.js";
import { PosEntegrasyonSqlRepository as Repo } from "../../models/posEntegrasyonSql.repository.js";
import { ApiError } from "../../utils/ApiError.js";
import { logger } from "../../utils/logger.js";
import { InposSurucu, inposCsn, inposSiparisIslendi } from "./inpos.surucu.js";
import { ENTEGRASYONLAR, MODELLER, ZAMAN_ASIMI_SN, } from "./pos.types.js";
import { PosMerkezService } from "./posMerkez.service.js";
import { SahteSurucu } from "./sahte.surucu.js";
import { TokenSurucu } from "./token.surucu.js";
const AZAMI_TUTAR = 100_000_000;
const KIMLIK = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BELGE_TURLERI = ["perakende", "sarraf", "deneme"];
const temiz = (v, azami) => {
    const s = typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "";
    return s ? s.slice(0, azami) : null;
};
const tamSayi = (v) => (Number.isInteger(Number(v)) && Number(v) > 0 ? Number(v) : null);
const gunMu = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
const ayniTutar = (a, b) => Math.abs(a - b) < 0.005;
/** Alıcı VKN (10) / TCKN (11); nihai tüketicinin 11111111111'i bilgi fişine basılmaz, cihaz kendi kuralını uygular */
const vknCoz = (v) => {
    const s = typeof v === "string" ? v.replace(/\D/g, "") : "";
    return (s.length === 10 || s.length === 11) && s !== "11111111111" ? s : null;
};
const PESIN_TURLERI = ["nakit", "havale", "cari"];
/** Fiş başına tek siparişte en çok bu kadar POS satırı gider */
const AZAMI_GRUP_SATIRI = 10;
/** Test modunda her cihaz sahte sürücüyle çalışır; hiçbir yere istek gitmez. */
const surucuSec = (mod, entegrasyon) => (mod === "test" ? SahteSurucu : entegrasyon === "inpos" ? InposSurucu : TokenSurucu);
const girdiyiCoz = (g) => {
    if (!g.istekKimlik || !KIMLIK.test(g.istekKimlik))
        throw ApiError.badRequest("İstek kimliği geçersiz.");
    const tutar = Math.round(Number(g.tutar) * 100) / 100;
    if (!Number.isFinite(tutar) || tutar <= 0)
        throw ApiError.badRequest("Tutar sıfırdan büyük olmalıdır.");
    if (tutar > AZAMI_TUTAR)
        throw ApiError.badRequest("Tutar çok büyük.");
    if (!BELGE_TURLERI.includes(g.belgeTuru))
        throw ApiError.badRequest("Belge türü geçersiz.");
    return {
        istekKimlik: g.istekKimlik.toLowerCase(),
        tutar,
        belgeTuru: g.belgeTuru,
        belgeId: tamSayi(g.belgeId),
        belgeNo: temiz(g.belgeNo, 50),
        belgeTipi: g.belgeTipi === "efatura" ? "efatura" : "earsiv",
        posCihaziId: tamSayi(g.posCihaziId),
        vezneId: tamSayi(g.vezneId),
        aliciAd: temiz(g.aliciAd, 100),
        aliciVkn: vknCoz(g.aliciVkn),
    };
};
/**
 * Fiş başına tek siparişte cihazdan dönen kart ödemelerini POS satırlarına dağıtır (K7'nin bulut hali).
 * Önce tutarı birebir tutan satırlar eşlenir; kalan satırların toplamı kalan ödemelerin toplamına eşitse hepsi onaylanır
 * (kasiyer cihazda farklı böldü), değilse kalan satırlar ret olur. Sonuç satır sırasıyla döner.
 */
export const grupOdemeleriniDagit = (satirlar, odemeler) => {
    const kalanOdemeler = [...odemeler];
    const sonuclar = new Map();
    const eslesmeyenler = [];
    for (const s of satirlar) {
        const i = kalanOdemeler.findIndex((o) => ayniTutar(o.tutar, s.tutar));
        if (i < 0) {
            eslesmeyenler.push(s);
            continue;
        }
        const [o] = kalanOdemeler.splice(i, 1);
        sonuclar.set(s.posIslemId, { durum: "ONAY", bankaKodu: o.bankaKodu, bankaAdi: o.bankaAdi });
    }
    const kalanTutar = kalanOdemeler.reduce((t, o) => t + o.tutar, 0);
    const eslesmeyenTutar = eslesmeyenler.reduce((t, s) => t + s.tutar, 0);
    const ortakBanka = kalanOdemeler.slice().sort((a, b) => b.tutar - a.tutar)[0];
    for (const s of eslesmeyenler) {
        if (eslesmeyenler.length && ayniTutar(kalanTutar, eslesmeyenTutar)) {
            sonuclar.set(s.posIslemId, { durum: "ONAY", bankaKodu: ortakBanka?.bankaKodu ?? null, bankaAdi: ortakBanka?.bankaAdi ?? null });
        }
        else {
            const alinan = odemeler.map((o) => o.tutar.toFixed(2)).join(" + ") || "yok";
            sonuclar.set(s.posIslemId, { durum: "RET", hata: `Cihazda bu satır için ${s.tutar.toFixed(2)} TL kart ödemesi görünmüyor (cihazda alınan: ${alinan}).` });
        }
    }
    return satirlar.map((s) => ({ posIslemId: s.posIslemId, sonuc: sonuclar.get(s.posIslemId) }));
};
/**
 * Bankanın sonradan bildirdiği POS hareketlerini bizim tahsilatlarımızla eşler: aynı gün + aynı tutar; birden çok aday
 * varsa onay kodu (provizyon) tutan öne alınır. Her hareket en çok bir tahsilatla eşlenir. Eşleşme kaydedilmez, her
 * listelemede yeniden hesaplanır.
 */
export const vomsisEsle = (tahsilatlar, hareketler) => {
    const eslesme = new Map();
    const kullanilan = new Set();
    for (const t of tahsilatlar) {
        const adaylar = hareketler.filter((h) => !kullanilan.has(h.vomsisId) && h.islemTarihi === t.gun && Math.abs(h.brut - t.tutar) < 0.005);
        const secilen = (t.onayKodu && adaylar.find((h) => h.provizyonNo && h.provizyonNo === t.onayKodu)) || adaylar[0];
        if (secilen) {
            kullanilan.add(secilen.vomsisId);
            eslesme.set(secilen.vomsisId, t.posIslemId);
        }
    }
    return eslesme;
};
export class PosService {
    static async acikMod(oturum, zorla) {
        if (zorla)
            return zorla;
        const { mod, firmaId } = await PosMerkezService.firma(oturum);
        if (mod === "kapali")
            throw ApiError.conflict("POS cihazı entegrasyonu bu firmada kapalı.");
        return { mod, firmaId };
    }
    /** Fiş ekranları bununla karar verir: mod kapalıysa ya da veznenin cihazı yoksa POS satırı bugünkü gibi elle çalışır. */
    static async durum(oturum, vezneId, dbContext) {
        const { mod } = await PosMerkezService.firma(oturum);
        if (mod === "kapali")
            return { mod, terminaller: [] };
        return { mod, terminaller: await Repo.vezneTerminalleri(vezneId, dbContext) };
    }
    // ─── Cihaz tanımları ───────────────────────────────────────────────────────
    static async tanimlar(oturum, dbContext) {
        const [{ mod }, terminaller, bankaEslemeleri] = await Promise.all([PosMerkezService.firma(oturum), Repo.terminalleriListele(dbContext), Repo.bankaEslemeleri(dbContext)]);
        return { mod, terminaller, bankaEslemeleri, modeller: MODELLER };
    }
    static async terminalKaydet(g, dbContext) {
        const ad = temiz(g.ad, 100);
        if (!ad)
            throw ApiError.badRequest("Cihaz adı zorunludur.");
        const entegrasyon = ENTEGRASYONLAR.includes(g.entegrasyon) ? g.entegrasyon : "yok";
        const model = temiz(g.model, 30);
        if (model && !MODELLER[entegrasyon].includes(model))
            throw ApiError.badRequest("Seçilen model bu entegrasyona ait değil.");
        if (entegrasyon !== "yok" && !model)
            throw ApiError.badRequest("Entegrasyonlu cihazda model seçilmelidir.");
        const dto = {
            posTerminalId: tamSayi(g.posTerminalId),
            ad,
            entegrasyon,
            model,
            sicilNo: temiz(g.sicilNo, 50),
            terminalKimlik: temiz(g.terminalKimlik, 100),
            posCihaziId: tamSayi(g.posCihaziId),
            aktif: g.aktif !== false,
            vezneIdler: (Array.isArray(g.vezneIdler) ? g.vezneIdler : []).map(tamSayi).filter((v) => v !== null),
        };
        let id;
        try {
            id = await Repo.terminalKaydet(dto, dbContext);
        }
        catch (err) {
            throw ApiError.badRequest(err?.message || "Cihaz kaydedilemedi.");
        }
        return (await Repo.terminalGetir(id, dbContext));
    }
    static async terminalSil(posTerminalId, dbContext) {
        if (!(await Repo.terminalSil(posTerminalId, dbContext))) {
            throw ApiError.conflict("Bu cihazla yapılmış POS işlemleri var; silinemez. Kullanılmayacaksa pasife alın.");
        }
    }
    static async bankaEslemeleriniYaz(liste, dbContext) {
        const gorulen = new Set();
        const temizListe = [];
        for (const e of Array.isArray(liste) ? liste : []) {
            const bankaKodu = temiz(e?.bankaKodu, 100);
            const posCihaziId = tamSayi(e?.posCihaziId);
            if (!bankaKodu || !posCihaziId)
                throw ApiError.badRequest("Her satırda banka ve POS kartı seçilmelidir.");
            if (gorulen.has(bankaKodu.toUpperCase()))
                throw ApiError.badRequest(`"${bankaKodu}" iki kez yazılmış.`);
            gorulen.add(bankaKodu.toUpperCase());
            temizListe.push({ bankaKodu, posCihaziId });
        }
        await Repo.bankaEslemeleriniYaz(temizListe, dbContext);
        return Repo.bankaEslemeleri(dbContext);
    }
    static async terminalBul(posTerminalId, dbContext) {
        const id = tamSayi(posTerminalId);
        const terminal = id ? await Repo.terminalGetir(id, dbContext) : null;
        if (!terminal)
            throw ApiError.notFound("POS cihazı bulunamadı.");
        return terminal;
    }
    /** Para çekmeden cihaza ulaşılıyor mu (firma tarafındaki "Bağlantıyı dene"). */
    static async baglantiTesti(posTerminalId, oturum, dbContext, zorla) {
        const { mod } = await this.acikMod(oturum, zorla);
        const terminal = await this.terminalBul(posTerminalId, dbContext);
        if (terminal.entegrasyon === "yok")
            return { mod, ayrinti: "Bu cihaz entegrasyonsuz tanımlı; program cihaza bağlanmaz, tutar cihaza elle girilir." };
        return { mod, ayrinti: await surucuSec(mod, terminal.entegrasyon).baglantiTesti(terminal) };
    }
    static async gunSonu(posTerminalId, oturum, dbContext) {
        const { mod } = await this.acikMod(oturum);
        const terminal = await this.terminalBul(posTerminalId, dbContext);
        if (terminal.entegrasyon === "yok")
            throw ApiError.badRequest("Bu cihaz entegrasyonsuz tanımlı; gün sonunu cihazdan alın.");
        return { mod, ayrinti: await surucuSec(mod, terminal.entegrasyon).gunSonu(terminal) };
    }
    // ─── Tahsilat ──────────────────────────────────────────────────────────────
    /**
     * Tutarı cihaza gönderir ve işlemi döner. Sonuç sonradan gelir: ekran işlemi getir() ile yoklar.
     * Cihaza gönderilemezse hata fırlatmaz; işlem Ret olarak döner (nedeni işlemdedir).
     */
    static async baslat(girdi, oturum, kullaniciId, dbContext, zorla) {
        const { mod, firmaId } = await this.acikMod(oturum, zorla);
        const g = girdiyiCoz(girdi);
        const terminal = await this.terminalBul(girdi.posTerminalId, dbContext);
        if (!terminal.aktif)
            throw ApiError.badRequest(`"${terminal.ad}" pasif; tahsilat gönderilemez.`);
        if (g.belgeTuru !== "deneme" && terminal.vezneIdler.length > 0 && (!g.vezneId || !terminal.vezneIdler.includes(g.vezneId))) {
            throw ApiError.forbidden(`"${terminal.ad}" bu vezneye tanımlı değil.`);
        }
        const ortak = {
            istekKimlik: g.istekKimlik,
            posTerminalId: terminal.posTerminalId,
            entegrasyon: terminal.entegrasyon,
            mod,
            belgeTuru: g.belgeTuru,
            belgeId: g.belgeId,
            belgeNo: g.belgeNo,
            belgeTipi: g.belgeTipi,
            tutar: g.tutar,
            posCihaziId: g.posCihaziId ?? terminal.posCihaziId,
            vezneId: g.vezneId,
            kullaniciId,
        };
        // Entegrasyonsuz cihaz: tutar cihaza elle girilir, program yalnızca kaydını tutar (K23)
        if (terminal.entegrasyon === "yok") {
            const acilan = await Repo.islemOlustur({ ...ortak, durum: "ONAY", elle: false }, ZAMAN_ASIMI_SN[mod], dbContext);
            return (await Repo.islemGetir(acilan.posIslemId, dbContext));
        }
        const acilan = await Repo.islemOlustur({ ...ortak, durum: "BEKLIYOR", elle: false }, ZAMAN_ASIMI_SN[mod], dbContext);
        if (acilan === "mesgul")
            throw ApiError.conflict(`"${terminal.ad}" şu anda başka bir işlemde. İşlem bitince yeniden deneyin ya da başka cihaz seçin.`);
        // Aynı istek ikinci kez geldi: cihaza yeniden gönderilmez
        if (!acilan.yeni)
            return this.getir(acilan.posIslemId, dbContext);
        const islem = (await Repo.islemGetir(acilan.posIslemId, dbContext));
        try {
            const ayar = mod === "canli" && terminal.entegrasyon === "beko" ? await PosMerkezService.ayar() : null;
            const donusAdresi = PosMerkezService.donusAdresi(ayar?.donusKok, "token", firmaId, islem.posIslemId);
            const { ref } = await surucuSec(mod, terminal.entegrasyon).gonder({ islem, terminal, aliciAd: g.aliciAd, aliciVkn: g.aliciVkn, donusAdresi });
            await Repo.refYaz(islem.posIslemId, ref, dbContext);
            await this.sepetKaydet(mod, terminal.entegrasyon, ref, firmaId);
        }
        catch (err) {
            await Repo.bekleyeniKapat(islem.posIslemId, "RET", err?.message || "Cihaza gönderilemedi.", dbContext);
        }
        return (await Repo.islemGetir(islem.posIslemId, dbContext));
    }
    /** Bulut sağlayıcının sonuç bildirimi tek adrese gelir; sipariş kimliğinin firması merkezde tutulur. */
    static async sepetKaydet(mod, entegrasyon, ref, firmaId) {
        if (mod !== "canli" || entegrasyon !== "inpos" || !ref || !firmaId)
            return;
        try {
            await PosAdminSqlRepository.sepetYaz({ saglayici: "inpos", sepetKimlik: ref, firmaId });
        }
        catch (err) {
            // Kayıt yazılamazsa sonuç bildirimle işlenemez; sorgulayarak yine öğrenilir
            logger.warn(`[POS] Sipariş-firma kaydı yazılamadı (${ref}): ${err?.message}`);
        }
    }
    /**
     * Fiş başına tek sipariş (Inpos bulut, K34): aynı fişin bütün POS satırları birlikte açılır ve cihaza tek sipariş gider.
     * Test modunda her satır örnek cihaza ayrı gider (sahte sürücü satır başına çalışır). Aynı grup kimliği ikinci kez
     * gelirse açık satırlar döner, cihaza yeniden gönderilmez.
     */
    static async baslatToplu(girdi, oturum, kullaniciId, dbContext) {
        const { mod, firmaId } = await this.acikMod(oturum);
        const grupKimlik = girdi.grupKimlik && KIMLIK.test(girdi.grupKimlik) ? girdi.grupKimlik.toLowerCase() : null;
        if (!grupKimlik)
            throw ApiError.badRequest("Grup kimliği geçersiz.");
        const satirlar = Array.isArray(girdi.satirlar) ? girdi.satirlar : [];
        if (!satirlar.length)
            throw ApiError.badRequest("Gönderilecek POS satırı yok.");
        if (satirlar.length > AZAMI_GRUP_SATIRI)
            throw ApiError.badRequest(`Bir fişte en çok ${AZAMI_GRUP_SATIRI} POS satırı cihaza gönderilebilir.`);
        const terminal = await this.terminalBul(girdi.posTerminalId, dbContext);
        if (!terminal.aktif)
            throw ApiError.badRequest(`"${terminal.ad}" pasif; tahsilat gönderilemez.`);
        if (terminal.entegrasyon !== "inpos")
            throw ApiError.badRequest("Toplu gönderim yalnız Inpos cihazlarında kullanılır.");
        const cozulenler = satirlar.map((s) => girdiyiCoz({
            istekKimlik: s.istekKimlik,
            posTerminalId: terminal.posTerminalId,
            tutar: s.tutar,
            belgeTuru: girdi.belgeTuru,
            belgeId: girdi.belgeId,
            belgeNo: girdi.belgeNo,
            belgeTipi: girdi.belgeTipi,
            posCihaziId: s.posCihaziId,
            vezneId: girdi.vezneId,
            aliciAd: girdi.aliciAd,
            aliciVkn: girdi.aliciVkn,
        }));
        const ilk = cozulenler[0];
        if (ilk.belgeTuru !== "deneme" && terminal.vezneIdler.length > 0 && (!ilk.vezneId || !terminal.vezneIdler.includes(ilk.vezneId))) {
            throw ApiError.forbidden(`"${terminal.ad}" bu vezneye tanımlı değil.`);
        }
        const pesinOdemeler = (Array.isArray(girdi.pesinOdemeler) ? girdi.pesinOdemeler : [])
            .map((p) => ({ tur: p?.tur, tutar: Math.round(Number(p?.tutar) * 100) / 100 }))
            .filter((p) => PESIN_TURLERI.includes(p.tur) && Number.isFinite(p.tutar) && p.tutar > 0 && p.tutar <= AZAMI_TUTAR);
        const kalemler = (Array.isArray(girdi.kalemler) ? girdi.kalemler : [])
            .slice(0, 50)
            .map((k) => ({ ad: temiz(k?.ad, 100) || "Ürün", miktar: Number(k?.miktar) || 1, tutar: Math.round(Number(k?.tutar) * 100) / 100, kdvOrani: Number(k?.kdvOrani) || 0 }))
            .filter((k) => Number.isFinite(k.tutar) && k.tutar > 0 && k.miktar > 0 && k.kdvOrani >= 0 && k.kdvOrani <= 100);
        // Satırlar sırayla açılır; ilk satır cihazın meşgul olup olmadığını sınar, aynı gruptakiler birbirini meşgul saymaz
        let yeniAcildi = false;
        for (const g of cozulenler) {
            const acilan = await Repo.islemOlustur({
                istekKimlik: g.istekKimlik,
                grupKimlik,
                posTerminalId: terminal.posTerminalId,
                entegrasyon: terminal.entegrasyon,
                mod,
                belgeTuru: g.belgeTuru,
                belgeId: g.belgeId,
                belgeNo: g.belgeNo,
                belgeTipi: g.belgeTipi,
                tutar: g.tutar,
                durum: "BEKLIYOR",
                elle: false,
                posCihaziId: g.posCihaziId ?? terminal.posCihaziId,
                vezneId: g.vezneId,
                kullaniciId,
            }, ZAMAN_ASIMI_SN[mod], dbContext);
            if (acilan === "mesgul") {
                // Önce açılan satırlar cihaza gitmeden kapatılır
                for (const acik of await Repo.grupIslemleri(grupKimlik, dbContext))
                    await Repo.bekleyeniKapat(acik.posIslemId, "IPTAL", "Cihaz başka bir işlemdeydi.", dbContext);
                throw ApiError.conflict(`"${terminal.ad}" şu anda başka bir işlemde. İşlem bitince yeniden deneyin ya da başka cihaz seçin.`);
            }
            if (acilan.yeni)
                yeniAcildi = true;
        }
        const islemler = await Repo.grupIslemleri(grupKimlik, dbContext);
        // Aynı istek ikinci kez geldi: cihaza yeniden gönderilmez
        if (!yeniAcildi)
            return Promise.all(islemler.map((i) => this.ilerlet(i, dbContext)));
        const surucu = surucuSec(mod, terminal.entegrasyon);
        if (mod === "test") {
            for (const islem of islemler) {
                try {
                    const { ref } = await surucu.gonder({ islem, terminal, aliciAd: ilk.aliciAd, aliciVkn: ilk.aliciVkn, donusAdresi: null });
                    await Repo.refYaz(islem.posIslemId, ref, dbContext);
                }
                catch (err) {
                    await Repo.bekleyeniKapat(islem.posIslemId, "RET", err?.message || "Cihaza gönderilemedi.", dbContext);
                }
            }
            return Repo.grupIslemleri(grupKimlik, dbContext);
        }
        try {
            const { ref } = await surucu.gonder({ islem: islemler[0], terminal, aliciAd: ilk.aliciAd, aliciVkn: ilk.aliciVkn, donusAdresi: null, grup: { islemler, pesinOdemeler, kalemler } });
            await Repo.grubaRefYaz(grupKimlik, ref, dbContext);
            await this.sepetKaydet(mod, terminal.entegrasyon, ref, firmaId);
        }
        catch (err) {
            for (const islem of islemler)
                await Repo.bekleyeniKapat(islem.posIslemId, "RET", err?.message || "Cihaza gönderilemedi.", dbContext);
        }
        return Repo.grupIslemleri(grupKimlik, dbContext);
    }
    /**
     * Fiş başına tek siparişin sonucu: aynı sipariş referansına bağlı bütün satırlara yazılır. Onayda cihazda alınan kart
     * ödemeleri satırlara tutara göre dağıtılır; ret / iptalde hepsi aynı sonucu alır. Yalnız bekleyen ya da Belirsiz satırlar değişir.
     */
    static async grupSonucunuIsle(islemler, terminal, sonuc, dbContext) {
        const acikOlanlar = islemler.filter((i) => (i.durum === "BEKLIYOR" || i.durum === "BELIRSIZ") && !i.elle);
        if (!acikOlanlar.length)
            return;
        const dagitim = sonuc.durum === "ONAY" ? grupOdemeleriniDagit(acikOlanlar, sonuc.grupOdemeleri || []) : acikOlanlar.map((i) => ({ posIslemId: i.posIslemId, sonuc }));
        for (const d of dagitim) {
            const islem = acikOlanlar.find((i) => i.posIslemId === d.posIslemId);
            await this.sonucuIsle(islem, terminal, { ...sonuc, ...d.sonuc, bankaKodu: d.sonuc.bankaKodu ?? null, bankaAdi: d.sonuc.bankaAdi ?? null, hata: d.sonuc.hata ?? sonuc.hata ?? null }, dbContext);
        }
        const ref = islemler[0]?.surucuRef;
        if (sonuc.durum === "ONAY" && ref && terminal && islemler[0].entegrasyon === "inpos" && islemler[0].mod === "canli") {
            let csn = null;
            try {
                csn = inposCsn(terminal);
            }
            catch {
                csn = null;
            }
            void inposSiparisIslendi(ref, csn);
        }
    }
    /** Bulut sağlayıcının bildirdiği sipariş sonucu (Inpos webhook). Sipariş bilinmiyorsa hiçbir kayda dokunulmaz. */
    static async disaridanGrupSonuc(ref, sonuc, dbContext) {
        const islemler = await Repo.refIslemleri(ref, dbContext);
        if (!islemler.length)
            return 0;
        const terminal = islemler[0].posTerminalId ? await Repo.terminalGetir(islemler[0].posTerminalId, dbContext) : null;
        await this.grupSonucunuIsle(islemler, terminal, sonuc, dbContext);
        return islemler.length;
    }
    static async sonucuIsle(islem, terminal, sonuc, dbContext) {
        // Muhasebe POS kartı: dönen bankanın eşlemesi → cihazın varsayılan kartı → fiş satırında seçili kart (K15)
        let posCihaziId = null;
        if (sonuc.durum === "ONAY") {
            posCihaziId = (sonuc.bankaKodu ? await Repo.bankaninPosCihazi(sonuc.bankaKodu, dbContext) : null) ?? terminal?.posCihaziId ?? null;
        }
        await Repo.sonucYaz(islem.posIslemId, sonuc, posCihaziId, dbContext);
    }
    /** Bekleyen işlemi bir adım ilerletir: sürücüden sonuç gelmişse yazar, süre dolmuşsa Belirsiz'e çeker. */
    static async ilerlet(islem, dbContext) {
        if (islem.durum !== "BEKLIYOR")
            return islem;
        const terminal = islem.posTerminalId ? await Repo.terminalGetir(islem.posTerminalId, dbContext) : null;
        const sonuc = terminal ? await surucuSec(islem.mod, islem.entegrasyon).sorgula(islem, terminal).catch(() => null) : null;
        if (sonuc && sonuc.grupOdemeleri !== undefined && islem.surucuRef) {
            await this.grupSonucunuIsle(await Repo.refIslemleri(islem.surucuRef, dbContext), terminal, sonuc, dbContext);
        }
        else if (sonuc) {
            await this.sonucuIsle(islem, terminal, sonuc, dbContext);
        }
        else if ((islem.gecenSaniye ?? 0) >= ZAMAN_ASIMI_SN[islem.mod]) {
            await Repo.bekleyeniKapat(islem.posIslemId, "BELIRSIZ", "Cihazdan cevap gelmedi.", dbContext);
        }
        else {
            return islem;
        }
        return (await Repo.islemGetir(islem.posIslemId, dbContext));
    }
    static async getir(posIslemId, dbContext) {
        const islem = tamSayi(posIslemId) ? await Repo.islemGetir(posIslemId, dbContext) : null;
        if (!islem)
            throw ApiError.notFound("POS işlemi bulunamadı.");
        return this.ilerlet(islem, dbContext);
    }
    /**
     * Sürücünün kendiliğinden bildirdiği sonuç (Token bildirimi). İşlem tahsil edildikten sonra fiş cihazdan iptal
     * edilmişse işlem "iade edildi" olarak işaretlenir (K22: iptal cihazdan yapılır, program yalnızca işaretler).
     */
    static async disaridanSonuc(posIslemId, sonuc, dbContext) {
        const islem = await Repo.islemGetir(posIslemId, dbContext);
        if (!islem)
            return;
        if (sonuc.fisIptali && islem.durum === "ONAY") {
            await Repo.iadeIsaretle(posIslemId, 2, null, dbContext);
            return;
        }
        const terminal = islem.posTerminalId ? await Repo.terminalGetir(islem.posTerminalId, dbContext) : null;
        await this.sonucuIsle(islem, terminal, sonuc, dbContext);
    }
    /** Bekleyen işlemden vazgeçer. Cihazdaki işlem geri alınamazsa hata verir ve işlem beklemede kalır. */
    static async iptal(posIslemId, dbContext) {
        const islem = await this.getir(posIslemId, dbContext);
        if (islem.durum !== "BEKLIYOR")
            return islem;
        const terminal = islem.posTerminalId ? await Repo.terminalGetir(islem.posTerminalId, dbContext) : null;
        if (terminal) {
            try {
                await surucuSec(islem.mod, islem.entegrasyon).iptal(islem, terminal);
            }
            catch (err) {
                throw ApiError.conflict(`Cihazdaki işlem iptal edilemedi: ${err?.message || err}. İşlemi cihazdan iptal edin ya da sonucu bekleyin.`);
            }
        }
        await Repo.bekleyeniKapat(posIslemId, "IPTAL", "Kullanıcı vazgeçti.", dbContext);
        // Fiş başına tek siparişte sipariş silinince aynı siparişin öbür satırları da cihazda kalmaz
        if (islem.surucuRef && islem.grupKimlik) {
            for (const es of await Repo.refIslemleri(islem.surucuRef, dbContext)) {
                if (es.posIslemId !== posIslemId && es.durum === "BEKLIYOR")
                    await Repo.bekleyeniKapat(es.posIslemId, "IPTAL", "Aynı fişin siparişi iptal edildi.", dbContext);
            }
        }
        return (await Repo.islemGetir(posIslemId, dbContext));
    }
    /** Cevap gelmeyen işlemi kullanıcı işaretler: Alındı / Alınmadı (K10, K17). */
    static async elleIsaretle(posIslemId, alindi, kullaniciId, dbContext) {
        const islem = await Repo.islemGetir(posIslemId, dbContext);
        if (!islem)
            throw ApiError.notFound("POS işlemi bulunamadı.");
        if (!(await Repo.elleIsaretle(posIslemId, alindi, kullaniciId, dbContext))) {
            throw ApiError.conflict("Bu işlemin sonucu cihazdan gelmiş; elle değiştirilemez.");
        }
        // Cihaz hâlâ kart bekliyorsa bekleyen işlem geri çekilir ki işaretten sonra ayrıca çekim yapılmasın.
        // Geri çekilemezse işaret yine de geçerlidir; cihazdan gelecek geç sonuç elle işareti ezmez.
        if (islem.durum === "BEKLIYOR" && islem.posTerminalId) {
            const terminal = await Repo.terminalGetir(islem.posTerminalId, dbContext);
            if (terminal)
                await surucuSec(islem.mod, islem.entegrasyon).iptal(islem, terminal).catch(() => undefined);
        }
        return (await Repo.islemGetir(posIslemId, dbContext));
    }
    /** Cihaza hiç göndermeden "alındı" kaydı (cihaz bozuk, entegrasyonsuz başka cihazdan çekildi vb. — K26). */
    static async elleAlindi(girdi, oturum, kullaniciId, dbContext) {
        const { mod } = await this.acikMod(oturum);
        const g = girdiyiCoz(girdi);
        const terminal = tamSayi(girdi.posTerminalId) ? await Repo.terminalGetir(Number(girdi.posTerminalId), dbContext) : null;
        const acilan = await Repo.islemOlustur({
            istekKimlik: g.istekKimlik,
            posTerminalId: terminal?.posTerminalId ?? null,
            entegrasyon: terminal?.entegrasyon ?? "yok",
            mod,
            belgeTuru: g.belgeTuru,
            belgeId: g.belgeId,
            belgeNo: g.belgeNo,
            belgeTipi: g.belgeTipi,
            tutar: g.tutar,
            durum: "ONAY",
            elle: true,
            posCihaziId: g.posCihaziId ?? terminal?.posCihaziId ?? null,
            vezneId: g.vezneId,
            kullaniciId,
        }, ZAMAN_ASIMI_SN[mod], dbContext);
        return (await Repo.islemGetir(acilan.posIslemId, dbContext));
    }
    /** İade cihazdan elle yapılır; program yalnızca işaretler (K9). 1: iade bekliyor · 2: iade edildi · 0: işareti kaldır */
    static async iadeIsaretle(posIslemId, iadeDurumu, kullaniciId, dbContext) {
        const d = Number(iadeDurumu);
        if (![0, 1, 2].includes(d))
            throw ApiError.badRequest("İade durumu geçersiz.");
        if (!(await Repo.islemGetir(posIslemId, dbContext)))
            throw ApiError.notFound("POS işlemi bulunamadı.");
        if (!(await Repo.iadeIsaretle(posIslemId, d, kullaniciId, dbContext))) {
            throw ApiError.conflict("İade işareti yalnızca tahsil edilmiş işleme konabilir.");
        }
        return (await Repo.islemGetir(posIslemId, dbContext));
    }
    static async belgeyeBagla(g, dbContext) {
        const idler = (Array.isArray(g.posIslemIdler) ? g.posIslemIdler : []).map(tamSayi).filter((v) => v !== null);
        const belgeId = tamSayi(g.belgeId);
        if (!belgeId || !BELGE_TURLERI.includes(g.belgeTuru))
            throw ApiError.badRequest("Belge bilgisi geçersiz.");
        return { baglanan: await Repo.belgeyeBagla(idler.slice(0, 50), g.belgeTuru, belgeId, temiz(g.belgeNo, 50), dbContext) };
    }
    static async belgeIslemleri(belgeTuru, belgeId, dbContext) {
        if (!tamSayi(belgeId) || !BELGE_TURLERI.includes(belgeTuru))
            throw ApiError.badRequest("Belge bilgisi geçersiz.");
        return Repo.belgeIslemleri(belgeTuru, belgeId, dbContext);
    }
    /** POS İşlemleri ekranı: bizim tahsilatlarımız + bankanın bildirdiği POS hareketleri, eşleşenler işaretli (K18). */
    static async liste(f, oturum, dbContext) {
        if (!gunMu(f.baslangic) || !gunMu(f.bitis))
            throw ApiError.badRequest("Başlangıç ve bitiş tarihi zorunludur.");
        if (f.baslangic > f.bitis)
            throw ApiError.badRequest("Başlangıç tarihi bitiş tarihinden sonra olamaz.");
        const [{ mod }, sayfa, tumOnaylar, hareketler, terminaller] = await Promise.all([
            PosMerkezService.firma(oturum),
            Repo.islemleriListele(f, dbContext),
            Repo.islemleriListele({ baslangic: f.baslangic, bitis: f.bitis, sayfaBoyutu: 500 }, dbContext),
            Repo.vomsisPosHareketleri(f.baslangic, f.bitis, dbContext),
            Repo.terminalleriListele(dbContext),
        ]);
        const eslesme = vomsisEsle(tumOnaylar.satirlar
            .filter((i) => i.durum === "ONAY" && i.iadeDurumu !== 2)
            .map((i) => ({ posIslemId: i.posIslemId, gun: i.olusturma.slice(0, 10), tutar: i.tutar, onayKodu: i.onayKodu })), hareketler);
        const islemdenVomsise = new Map([...eslesme].map(([vomsisId, posIslemId]) => [posIslemId, vomsisId]));
        return {
            mod,
            satirlar: sayfa.satirlar.map((i) => ({ ...i, vomsisId: islemdenVomsise.get(i.posIslemId) ?? null })),
            toplam: sayfa.toplam,
            bankaHareketleri: hareketler.map((h) => ({ ...h, posIslemId: eslesme.get(h.vomsisId) ?? null })),
            terminaller: terminaller.map((t) => ({ posTerminalId: t.posTerminalId, ad: t.ad })),
        };
    }
}
