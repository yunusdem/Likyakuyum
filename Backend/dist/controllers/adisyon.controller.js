import { adisyonHatasi } from "../services/adisyon/hataSarmal.js";
import { DonemKilidi } from "../services/ticari/donemKilidi.js";
import { ApiError } from "../utils/ApiError.js";
import { AdisyonTanimSqlRepository } from "../models/adisyonTanimSql.repository.js";
import { AdisyonTanimlarSqlRepository as T } from "../models/adisyonTanimlarSql.repository.js";
import { kullaniciYetkisi } from "../services/yetki/kullaniciYetkisi.js";
import { AdisyonSqlRepository as A } from "../models/adisyonSql.repository.js";
import { olaylaraAbone } from "../services/adisyon/adisyonOlay.service.js";
import { AdisyonMutfakSqlRepository as MF } from "../models/adisyonMutfakSql.repository.js";
import { FirmaSqlRepository } from "../models/admin/firmaSql.repository.js";
import { KurulumLisansService } from "../services/kurulum/kurulumLisans.service.js";
import { env } from "../config/env.config.js";
import { AdisyonIslemSqlRepository as IS } from "../models/adisyonIslemSql.repository.js";
import { AdisyonHesapSqlRepository as HS } from "../models/adisyonHesapSql.repository.js";
import { AdisyonPaketSqlRepository as PS } from "../models/adisyonPaketSql.repository.js";
import { AdisyonRaporSqlRepository as RP } from "../models/adisyonRaporSql.repository.js";
import { SEVIYE, YETKILER, yetkiKumesi } from "../services/adisyon/adisyonHesap.js";
import { kullaniciKartVeznesi } from "../services/yetki/fisVeznesi.js";
import { bankaHesabiDenetle } from "../services/yetki/fisIcerikYetkisi.js";
import { MisafirService } from "../services/adisyon/misafir.service.js";
/** Adisyon uçları (docs/TICARI_ADISYON_YOL_HARITASI.md, D1–D10) */
export const baglam = (req) => ({ dbServer: req.user?.dbServer, dbName: req.user?.dbName });
export const kullanici = (req) => {
    const u = req.user;
    const id = Number(u?.userId ?? u?.id);
    return Number.isFinite(id) && id > 0 ? id : undefined;
};
export const yoneticiMi = async (req) => (await kullaniciYetkisi(req)).yonetici;
export const kimlik = (req, alan = "id") => {
    const id = Number(req.params[alan]);
    if (!Number.isInteger(id) || id <= 0)
        throw ApiError.badRequest("Geçersiz kayıt numarası.");
    return id;
};
/** PC kullanıcısının adisyon kimliği (garson kimliği D4'te ayrı jetonla) */
export const pcKimlik = (req) => ({ kullaniciId: kullanici(req) ?? null, garsonId: null, ad: String(req.user?.username || "Kasa").slice(0, 60) });
/**
 * PC kullanıcısının adisyon yetkileri (TA25, U36): sistem yöneticisi bütün yetkiler (ikram, iptal, indirim, düzeltme dahil);
 * öbür kullanıcılar Kasiyer seviyesi (masa açma, sipariş, hesap, tahsilat, bölme, taşıma, birleştirme).
 */
export const pcYetkileri = async (req) => ((await yoneticiMi(req)) ? [...YETKILER] : [...yetkiKumesi(SEVIYE.KASIYER, null)]);
export const pcKimlikTam = async (req) => ({ ...pcKimlik(req), yetkiler: await pcYetkileri(req) });
/**
 * PC tahsilat girdisi (D7, U37): vezne kullanıcının kart veznesi (istekteki yok sayılır; yoksa Adisyon ayarı / ana vezne);
 * banka hesabı ödemesi "Fiş banka hesabı seçme" yetkisi ister (Ticari ile aynı); POS işlem bağı istekten alınmaz
 * (kart, fiş yazıldıktan sonra cihazdan çekilir ve ekran fişe bağlar).
 */
const tahsilatGirdisi = async (req, araPos = false) => {
    const b = req.body || {};
    const tek = b.arac !== undefined ? [{ odemeAraciTuru: b.arac }] : [];
    bankaHesabiDenetle(await kullaniciYetkisi(req), [...tek, ...(Array.isArray(b.odemeler) ? b.odemeler : []).map((o) => ({ odemeAraciTuru: o?.arac }))]);
    // TA37: yalnız ara ödemede, kartla, cihazdan çekilmiş POS işlemi bağlanabilir (sunucu işlemi doğrular: onaylı, aynı tutar, boşta)
    return { ...b, vezneId: await kullaniciKartVeznesi(kullanici(req), baglam(req)), posIslemId: araPos && Number(b.arac) === 2 ? Number(b.posIslemId) || null : null,
        ...(Array.isArray(b.odemeler) && { odemeler: b.odemeler.map((o) => ({ ...o, posIslemId: null })) }) };
};
export const sar = (f) => (req, res, next) => {
    f(req, res).then((v) => { if (!res.headersSent)
        res.json({ success: true, data: v }); }).catch((e) => adisyonHatasi(e, next, `${req.method} ${req.originalUrl.split("?")[0]}`));
};
/** Adisyon tanımları ve ayarları yalnız sistem yöneticisinde */
export const adisyonYonetici = (req, _res, next) => {
    yoneticiMi(req).then((ok) => next(ok ? undefined : ApiError.forbidden("Bu Adisyon tanımı yalnız sistem yöneticisine açık."))).catch(next);
};
export const AdisyonController = {
    ayarlar: sar(async (req) => AdisyonTanimSqlRepository.ayarlar(baglam(req))),
    ayarKaydet: sar(async (req) => AdisyonTanimSqlRepository.ayarKaydet(req.body || {}, baglam(req))),
    // ── Tanımlar (D2) ──
    bolgeler: sar(async (req) => T.bolgeler(baglam(req), req.query.aktif === "1")),
    bolgeKaydet: sar(async (req) => ({ bolgeId: await T.bolgeKaydet({ ...(req.body || {}), bolgeId: req.params.id ? kimlik(req) : null }, baglam(req)) })),
    bolgeSil: sar(async (req) => T.bolgeSil(kimlik(req), baglam(req))),
    masaKaydet: sar(async (req) => ({ masaId: await T.masaKaydet({ ...(req.body || {}), masaId: req.params.id ? kimlik(req) : null }, baglam(req)) })),
    masaTopluEkle: sar(async (req) => T.masaTopluEkle(req.body || {}, baglam(req))),
    masaSil: sar(async (req) => T.masaSil(kimlik(req), baglam(req))),
    yerler: sar(async (req) => T.yerler(baglam(req))),
    yerKaydet: sar(async (req) => ({ yerId: await T.yerKaydet({ ...(req.body || {}), yerId: req.params.id ? kimlik(req) : null }, baglam(req)) })),
    yerSil: sar(async (req) => T.yerSil(kimlik(req), baglam(req))),
    grupYerleri: sar(async (req) => T.grupYerleri(baglam(req))),
    grupYerKaydet: sar(async (req) => T.grupYerKaydet(req.body?.liste, baglam(req))),
    secenekler: sar(async (req) => T.secenekGruplari(baglam(req))),
    secenekKaydet: sar(async (req) => ({ sgId: await T.secenekGrupKaydet({ ...(req.body || {}), sgId: req.params.id ? kimlik(req) : null }, baglam(req)) })),
    secenekSil: sar(async (req) => T.secenekGrupSil(kimlik(req), baglam(req))),
    kartAyrintisi: sar(async (req) => T.kartAyrintisi(kimlik(req), baglam(req))),
    kartAyrintisiKaydet: sar(async (req) => T.kartAyrintisiKaydet(kimlik(req), req.body || {}, baglam(req))),
    garsonlar: sar(async (req) => T.garsonlar(baglam(req))),
    garsonKullanicilari: sar(async (req) => T.garsonKullanicilari(baglam(req))),
    masaQr: sar(async (req) => MisafirService.qrListesi(baglam(req))),
    masaQrYenile: sar(async (req) => MisafirService.qrListesi(baglam(req), kimlik(req))),
    misafirPin: sar(async (req) => {
        if (!(await pcYetkileri(req)).includes("siparis"))
            throw ApiError.forbidden("Sipariş yetkiniz yok.");
        return MisafirService.pin(baglam(req), kimlik(req), !!req.body?.yenile);
    }),
    garsonKaydet: sar(async (req) => ({ garsonId: await T.garsonKaydet({ ...(req.body || {}), garsonId: req.params.id ? kimlik(req) : null }, baglam(req)) })),
    garsonSil: sar(async (req) => T.garsonSil(kimlik(req), baglam(req))),
    // ── Masa / sipariş (D3) ──
    masalar: sar(async (req) => A.masalar(baglam(req))),
    menu: sar(async (req) => A.menu(baglam(req), req.query.bolgeId ? Number(req.query.bolgeId) || null : null)),
    getir: sar(async (req) => A.getir(baglam(req), kimlik(req))),
    siparis: sar(async (req) => A.siparis(baglam(req), req.body || {}, await pcKimlikTam(req))),
    // ── Masa işlemleri (D6) ──
    yetkilerim: sar(async (req) => ({ yetkiler: await pcYetkileri(req) })),
    ikram: sar(async (req) => IS.ikram(baglam(req), kimlik(req), req.body?.kalemler, req.body || {}, await pcKimlikTam(req))),
    iptal: sar(async (req) => IS.iptal(baglam(req), kimlik(req), req.body?.kalemler, req.body || {}, await pcKimlikTam(req))),
    adisyonIptal: sar(async (req) => IS.adisyonIptal(baglam(req), kimlik(req), req.body || {}, await pcKimlikTam(req))),
    masaTasi: sar(async (req) => IS.masaTasi(baglam(req), kimlik(req), Number(req.body?.masaId), await pcKimlikTam(req))),
    birlestir: sar(async (req) => IS.birlestir(baglam(req), kimlik(req), Number(req.body?.hedefAdisyonId), await pcKimlikTam(req))),
    // ── Raporlar / gün sonu (D10) ──
    rapor: sar(async (req) => RP.rapor(baglam(req), { baslangic: req.query.baslangic, bitis: req.query.bitis })),
    acikOzet: sar(async (req) => RP.acikOzet(baglam(req))),
    // ── Paket servis / gel-al (D8) ──
    paketler: sar(async (req) => PS.liste(baglam(req))),
    paketDurum: sar(async (req) => PS.durum(baglam(req), kimlik(req), req.body?.durum, await pcKimlikTam(req))),
    paketGuncelle: sar(async (req) => PS.musteriGuncelle(baglam(req), kimlik(req), req.body || {}, await pcKimlikTam(req))),
    paketMusteri: sar(async (req) => PS.musteriBul(baglam(req), req.body?.tel)),
    // ── Hesap / tahsilat (D7) ──
    hesap: sar(async (req) => HS.hesap(baglam(req), kimlik(req))),
    // İndirim / kalem fiyatı / yeniden açma (K1, TA25) — yetkiler: indirim, fiyat, duzelt (PC'de yönetici)
    indirim: sar(async (req) => HS.indirim(baglam(req), kimlik(req), req.body || {}, await pcKimlikTam(req))),
    fiyatDegistir: sar(async (req) => IS.fiyatDegistir(baglam(req), kimlik(req), req.body || {}, await pcKimlikTam(req))),
    yenidenAc: sar(async (req) => {
        // Kapanmış vardiyada yazılmış fiş geri alınıyorsa nakit farkı veznenin açık vardiyasına düzeltme olarak işlenir (karar K7)
        const fisler = (await HS.hesap(baglam(req), kimlik(req))).fisler;
        const onceki = await Promise.all(fisler.map((f) => DonemKilidi.fisVardiyasi(baglam(req), f.faturaId)));
        const sonuc = await HS.yenidenAc(baglam(req), kimlik(req), req.body || {}, await pcKimlikTam(req));
        for (const v of onceki.filter((x) => x.kapali))
            await DonemKilidi.vardiyaDuzeltmesiYaz(baglam(req), { vezneId: v.vezneId, eskiNakit: v.nakit, yeniNakit: 0, aciklama: `Adisyon yeniden açıldı (${v.no})`, kullaniciId: kullanici(req) });
        return sonuc;
    }),
    secimTutari: sar(async (req) => HS.secimTutari(baglam(req), kimlik(req), req.body?.kalemler)),
    kapananlar: sar(async (req) => RP.kapananlar(baglam(req), req.query.gun)),
    hesapIste: sar(async (req) => HS.hesapIste(baglam(req), kimlik(req), await pcKimlikTam(req))),
    odemeEkle: sar(async (req) => HS.odemeEkle(baglam(req), kimlik(req), await tahsilatGirdisi(req, true), await pcKimlikTam(req))),
    odemeSil: sar(async (req) => HS.odemeSil(baglam(req), kimlik(req), await pcKimlikTam(req))),
    kapat: sar(async (req) => HS.kapat(baglam(req), kimlik(req), await tahsilatGirdisi(req), await pcKimlikTam(req))),
    urunleOde: sar(async (req) => HS.urunleOde(baglam(req), kimlik(req), await tahsilatGirdisi(req), await pcKimlikTam(req))),
    urunTasi: sar(async (req) => IS.urunTasi(baglam(req), kimlik(req), req.body?.kalemler, { masaId: req.body?.masaId ?? null, adisyonId: req.body?.adisyonId ?? null, istekId: req.body?.istekId }, await pcKimlikTam(req))),
    kisi: sar(async (req) => A.kisiGuncelle(baglam(req), kimlik(req), req.body?.kisi)),
    // ── Mutfak (D5) ──
    mutfakFisleriAl: sar(async (req) => MF.fisleriAl(baglam(req), Number(req.query.adet) || 1)),
    mutfakFisSonucu: sar(async (req) => MF.fisSonucu(baglam(req), kimlik(req), req.body?.basarili === true, req.body?.hata, { deneme: Number(req.body?.deneme) || null, ajanYok: req.body?.ajanYok === true })),
    mutfakBekleyen: sar(async (req) => MF.bekleyenFisler(baglam(req))),
    mutfakFisYeniden: sar(async (req) => MF.fisYeniden(baglam(req), kimlik(req), req.body?.basildiSay === true)),
    mutfakSiparisler: sar(async (req) => MF.siparisler(baglam(req), req.query.yerId ? Number(req.query.yerId) || null : null)),
    mutfakHazir: sar(async (req) => MF.hazir(baglam(req), req.body?.kalemIdler, req.body?.hazir !== false)),
    kalemServis: sar(async (req) => MF.servis(baglam(req), req.body?.kalemIdler)),
    ekranAnahtari: sar(async (req) => {
        const r = await MF.ekranAnahtari(baglam(req), kimlik(req));
        // Bağlantının müşteri nosu: bulutta oturumun firmasından, kurulumda lisanstan (bilinmiyorsa ekran sorar)
        let musteriNo = null;
        try {
            if (env.KURULUM_MODU)
                musteriNo = (await KurulumLisansService.durum()).musteriNo ?? null;
            else if (req.user?.firmaId)
                musteriNo = (await FirmaSqlRepository.idIleBul(Number(req.user.firmaId)))?.musteriNo ?? null;
        }
        catch { /* yönetim veritabanı yok */ }
        return { ...r, musteriNo };
    }),
    ekranAnahtariSil: sar(async (req) => MF.ekranAnahtariSil(baglam(req), kimlik(req))),
    /**
     * Canlı olay akışı (SSE, TA22). Jeton Authorization başlığında (adres satırında değil); ekran fetch akışıyla okur.
     * İlk mesaj "hazir": aracı sunucu akışı tamponluyorsa gelmez, ekran yoklamaya geçer.
     */
    olaylar: async (req, res) => {
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache, no-transform");
        res.setHeader("Connection", "keep-alive");
        res.setHeader("X-Accel-Buffering", "no");
        if (typeof res.flushHeaders === "function")
            res.flushHeaders();
        let kapali = false;
        const yaz = (s) => { if (!kapali) {
            try {
                res.write(s);
            }
            catch { /* bağlantı kapandı */ }
        } };
        let birak = null;
        const ping = setInterval(() => yaz(": ping\n\n"), 15000);
        req.on("close", () => { kapali = true; clearInterval(ping); birak?.(); });
        try {
            const a = await olaylaraAbone(baglam(req), (olaylar) => yaz(`data: ${JSON.stringify(olaylar)}\n\n`));
            if (kapali) {
                a.birak();
                return;
            }
            birak = a.birak;
            yaz(`event: hazir\ndata: ${JSON.stringify({ sonId: a.sonId })}\n\n`);
        }
        catch (e) {
            yaz(`event: hata\ndata: ${JSON.stringify({ mesaj: String(e?.message || e).slice(0, 200) })}\n\n`);
            clearInterval(ping);
            res.end();
        }
    },
};
