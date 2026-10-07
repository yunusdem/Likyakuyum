import { PosEntegrasyonSqlRepository as Repo } from "../../models/posEntegrasyonSql.repository.js";
import { ApiError } from "../../utils/ApiError.js";
import { InposSurucu } from "./inpos.surucu.js";
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
    };
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
            const { ref } = await surucuSec(mod, terminal.entegrasyon).gonder({ islem, terminal, aliciAd: g.aliciAd, donusAdresi });
            await Repo.refYaz(islem.posIslemId, ref, dbContext);
        }
        catch (err) {
            await Repo.bekleyeniKapat(islem.posIslemId, "RET", err?.message || "Cihaza gönderilemedi.", dbContext);
        }
        return (await Repo.islemGetir(islem.posIslemId, dbContext));
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
        if (sonuc) {
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
