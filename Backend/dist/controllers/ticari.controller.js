import { DonemKilidi, govdedekiKartlar } from "../services/ticari/donemKilidi.js";
import { STOK_BELGE } from "../models/ticariStokSql.repository.js";
import { ApiError } from "../utils/ApiError.js";
import { TicariStokSqlRepository } from "../models/ticariStokSql.repository.js";
import { TicariFiyatSqlRepository } from "../models/ticariFiyatSql.repository.js";
import { TicariFiyatIslemiSqlRepository } from "../models/ticariFiyatIslemiSql.repository.js";
import { TicariKampanyaSqlRepository } from "../models/ticariKampanyaSql.repository.js";
import { TicariGirisSqlRepository } from "../models/ticariGirisSql.repository.js";
import { TicariSatisSqlRepository } from "../models/ticariSatisSql.repository.js";
import { TicariIadeSqlRepository } from "../models/ticariIadeSql.repository.js";
import { TicariVardiyaSqlRepository } from "../models/ticariVardiyaSql.repository.js";
import { TicariGunSonuSqlRepository } from "../models/ticariGunSonuSql.repository.js";
import { TicariKarSqlRepository } from "../models/ticariKarSql.repository.js";
import { TicariSktSqlRepository } from "../models/ticariSktSql.repository.js";
import { TicariParcalamaSqlRepository } from "../models/ticariParcalamaSql.repository.js";
import { TicariFireSqlRepository, TicariSayimSqlRepository } from "../models/ticariSayimFireSql.repository.js";
import { TicariTedarikciIadeSqlRepository } from "../models/ticariTedarikciIadeSql.repository.js";
import { TicariEfaturaGirisSqlRepository } from "../models/ticariEfaturaGirisSql.repository.js";
import { bugunTr } from "../utils/zaman.utils.js";
import { excelOnizle, excelYukle, ornekExcel } from "../services/ticari/ticariExcel.js";
import { fisVeznesi, kullaniciKartVeznesi } from "../services/yetki/fisVeznesi.js";
import { fisKayitYetkisi, gunSiniri, kayitErisimi, kendiKayitSuzgeci, sonrakiGun } from "../services/yetki/fisYetkileri.js";
import { bankaHesabiDenetle, ticariFiyatDenetle } from "../services/yetki/fisIcerikYetkisi.js";
import { kullaniciYetkisi } from "../services/yetki/kullaniciYetkisi.js";
import { fisDurbunFiltresiOku } from "../utils/fisDurbunFiltre.js";
/** Ticari İşlemler uçları (docs/TICARI_ISLEMLER_YOL_HARITASI.md). Yönetim uçları: sistem yöneticisi ya da yetkili kullanıcı (T21). */
const baglam = (req) => ({ dbServer: req.user?.dbServer, dbName: req.user?.dbName });
const kullanici = (req) => {
    const u = req.user;
    const id = Number(u?.userId ?? u?.id);
    return Number.isFinite(id) && id > 0 ? id : undefined;
};
/**
 * Sistem yöneticisi: jetondaki rolden değil kullanıcı kartından (services/yetki/kullaniciYetkisi.ts, istek başına bir okuma).
 * Yöneticiliği kaldırılan kullanıcı jetonu geçerli kaldıkça stok ayarlarını ve yönetim ekranlarını kullanabiliyordu.
 */
const yoneticiMi = async (req) => (await kullaniciYetkisi(req)).yonetici;
const sayiVeyaNull = (v) => (v === undefined || v === null || v === "" ? null : Number.isFinite(Number(v)) ? Number(v) : null);
const metin = (v) => (v === undefined || v === null || String(v).trim() === "" ? null : String(v));
const kimlik = (req) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0)
        throw ApiError.badRequest("Geçersiz kayıt numarası.");
    return id;
};
/** Kullanıcının kart veznesi; tanımsızsa fişlerdeki mesajla durur */
const kendiVeznem = async (req) => {
    const v = await kullaniciKartVeznesi(kullanici(req), baglam(req));
    if (!v)
        throw ApiError.badRequest("Kullanıcı kartınızda vezne tanımlı değil. Kullanıcı Tanımları'ndan veznenizi seçtirin.");
    return v;
};
/** Vardiya işleminin veznesi: yönetici başka vezne seçebilir, öteki kullanıcı yalnız kendi veznesi */
const vardiyaVeznesi = async (req, istenen) => {
    const n = Number(istenen);
    if (Number.isInteger(n) && n > 0 && (await yoneticiMi(req)))
        return n;
    return kendiVeznem(req);
};
const efUuid = (req) => {
    const u = String(req.params.uuid || "").trim();
    if (!/^[0-9a-fA-F-]{32,40}$/.test(u))
        throw ApiError.badRequest("Belge UUID bilgisi geçersiz.");
    return u;
};
const efXml = (req) => {
    const x = String(req.body?.xml || "");
    if (!x.trim())
        throw ApiError.badRequest("UBL XML içeriği boş.");
    if (x.length > 15_000_000)
        throw ApiError.badRequest("XML çok büyük (en çok 15 MB).");
    return x;
};
const sar = (f) => (req, res, next) => {
    f(req, res).then((v) => { if (!res.headersSent)
        res.json({ success: true, data: v }); }).catch(next);
};
/** Yönetim ekranları için yetki kapısı */
export const ticariYonetim = (req, _res, next) => {
    yoneticiMi(req)
        .then((yonetici) => TicariStokSqlRepository.yonetebilirMi(kullanici(req), yonetici, baglam(req)))
        .then((ok) => (ok ? next() : next(ApiError.forbidden("Bu işlem için stok yönetim yetkiniz yok. Sistem yöneticisi Ticari İşlemler › Stok Ayarları'ndan yetki verebilir."))))
        .catch(next);
};
/** Ayar ve yetki listesi yalnız sistem yöneticisinde */
export const ticariSistemYoneticisi = (req, _res, next) => {
    yoneticiMi(req)
        .then((ok) => next(ok ? undefined : ApiError.forbidden("Stok ayarlarını yalnız sistem yöneticisi değiştirebilir.")))
        .catch(next);
};
/**
 * Dönem kilidi (karar K7): onaylı sayımdan önceki tarihli stok belgesi yalnız yöneticiye açık. Yeni / düzeltilen belgenin
 * tarihi ve kartları gövdeden, var olan belgenin (düzeltme / silme) kartları ve tarihi stok hareketlerinden okunur.
 */
const sayimDonemi = async (req, tur, id, gov = true) => DonemKilidi.sayimDenetle(baglam(req), { kartIdler: gov ? govdedekiKartlar(req.body) : [], tarih: gov ? req.body?.tarih : null, belge: id ? { tur, id } : null }, await yoneticiMi(req));
export const TicariController = {
    yetki: sar(async (req) => {
        const yonetici = await yoneticiMi(req);
        return {
            yonetebilir: await TicariStokSqlRepository.yonetebilirMi(kullanici(req), yonetici, baglam(req)),
            sistemYoneticisi: yonetici,
        };
    }),
    ayarlar: sar(async (req) => TicariStokSqlRepository.ayarlar(baglam(req))),
    ayarKaydet: sar(async (req) => TicariStokSqlRepository.ayarKaydet(req.body || {}, kullanici(req), baglam(req))),
    // Ticari etiket düzeni (İş 2, G5): okuma herkese, kaydetme stok yönetim yetkisine
    etiketDuzeni: sar(async (req) => TicariStokSqlRepository.etiketDuzeni(baglam(req))),
    etiketDuzeniKaydet: sar(async (req) => TicariStokSqlRepository.etiketDuzeniKaydet(req.body || {}, baglam(req))),
    // Fiyat listeleri (İş 11, G6–G9)
    fiyatListeleri: sar(async (req) => TicariFiyatSqlRepository.listeler(baglam(req), req.query.aktif === "1")),
    fiyatListesiKaydet: sar(async (req) => TicariFiyatSqlRepository.listeKaydet({ ...(req.body || {}), fiyatListesiId: req.params.id ? kimlik(req) : null }, kullanici(req), baglam(req))),
    fiyatListesiSil: sar(async (req) => TicariFiyatSqlRepository.listeSil(kimlik(req), baglam(req))),
    fiyatListesiCarileri: sar(async (req) => TicariFiyatSqlRepository.listeCarileri(kimlik(req), baglam(req))),
    cariFiyatListesi: sar(async (req) => TicariFiyatSqlRepository.cariListesi(kimlik(req), baglam(req))),
    cariFiyatListesiKaydet: sar(async (req) => { await TicariFiyatSqlRepository.cariListesiKaydet(kimlik(req), sayiVeyaNull(req.body?.fiyatListesiId), kullanici(req), baglam(req)); return TicariFiyatSqlRepository.cariListesi(kimlik(req), baglam(req)); }),
    // Toplu fiyat işlemleri (İş 11, G11, G13, G14)
    fiyatIslemiOnizle: sar(async (req) => TicariFiyatIslemiSqlRepository.onizle(req.body || {}, baglam(req))),
    fiyatIslemiUygula: sar(async (req) => TicariFiyatIslemiSqlRepository.uygula(req.body || {}, kullanici(req), baglam(req))),
    fiyatIslemiGeriAl: sar(async (req) => TicariFiyatIslemiSqlRepository.geriAl(Number(req.body?.islemNo) || 0, kullanici(req), baglam(req))),
    fiyatIslemiGecmis: sar(async (req) => TicariFiyatIslemiSqlRepository.gecmis(baglam(req), sayiVeyaNull(req.query.limit) ?? 100)),
    // Kampanyalar (İş 11, G12)
    kampanyalar: sar(async (req) => TicariKampanyaSqlRepository.liste(baglam(req))),
    aktifKampanyalar: sar(async (req) => TicariKampanyaSqlRepository.aktifler(baglam(req))),
    kampanyaKaydet: sar(async (req) => TicariKampanyaSqlRepository.kaydet({ ...(req.body || {}), kampanyaId: req.params.id ? kimlik(req) : null }, kullanici(req), baglam(req))),
    kampanyaSil: sar(async (req) => TicariKampanyaSqlRepository.sil(kimlik(req), baglam(req))),
    gruplar: sar(async (req) => TicariStokSqlRepository.gruplar(baglam(req))),
    grupKaydet: sar(async (req) => TicariStokSqlRepository.grupKaydet({ ...(req.body || {}), stokGrupId: req.params.id ? kimlik(req) : null }, kullanici(req), baglam(req))),
    grupSil: sar(async (req) => TicariStokSqlRepository.grupSil(kimlik(req), baglam(req))),
    /** Gruba kart ekleme / çıkarma (İş 10, G15): { ekle: [id], cikar: [id] } */
    grupKartlari: sar(async (req) => TicariStokSqlRepository.grupKartlari(kimlik(req), req.body || {}, kullanici(req), baglam(req))),
    kartlar: sar(async (req) => TicariStokSqlRepository.kartlar({
        arama: metin(req.query.arama) ?? undefined,
        grupId: sayiVeyaNull(req.query.grupId),
        aktif: req.query.aktif === "1" ? true : req.query.aktif === "0" ? false : null,
        idler: metin(req.query.idler) ? String(req.query.idler).split(",").map(Number) : null,
        limit: sayiVeyaNull(req.query.limit) ?? undefined,
        fiyatListesiId: sayiVeyaNull(req.query.liste),
    }, baglam(req))),
    /** Sayfalı liste (G2): { kartlar, toplam, sayfa, adet } */
    kartlarSayfali: sar(async (req) => TicariStokSqlRepository.kartlarSayfali({
        arama: metin(req.query.arama),
        grupId: sayiVeyaNull(req.query.grupId),
        aktif: req.query.aktif === "1" ? true : req.query.aktif === "0" ? false : null,
        sayfa: sayiVeyaNull(req.query.sayfa),
        adet: sayiVeyaNull(req.query.adet),
        fiyatListesiId: sayiVeyaNull(req.query.liste),
    }, baglam(req))),
    kart: sar(async (req) => {
        const k = await TicariStokSqlRepository.kart(kimlik(req), baglam(req), true, sayiVeyaNull(req.query.liste));
        if (!k)
            throw ApiError.notFound("Stok kartı bulunamadı.");
        return k;
    }),
    kartBul: sar(async (req) => {
        const k = await TicariStokSqlRepository.kartBul(String(req.params.deger || ""), baglam(req), sayiVeyaNull(req.query.liste));
        if (!k)
            throw ApiError.notFound(`"${req.params.deger}" barkodlu ya da kodlu stok kartı bulunamadı.`);
        return k;
    }),
    kartKaydet: sar(async (req) => TicariStokSqlRepository.kartKaydet({ ...(req.body || {}), stokKartId: req.params.id ? kimlik(req) : null }, kullanici(req), baglam(req))),
    kartSil: sar(async (req) => TicariStokSqlRepository.kartSil(kimlik(req), baglam(req))),
    excelOrnek: async (_req, res, next) => {
        try {
            const b = await ornekExcel();
            res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
            res.setHeader("Content-Disposition", `attachment; filename="stok_kartlari_ornek.xlsx"`);
            res.send(b);
        }
        catch (e) {
            next(e);
        }
    },
    excelOnizle: sar(async (req) => excelOnizle(dosyaOku(req), baglam(req))),
    excelYukle: sar(async (req) => excelYukle(dosyaOku(req), kullanici(req), baglam(req))),
    girisSiraNo: sar(async (req) => ({ fisNo: await TicariGirisSqlRepository.siradakiNo(baglam(req)) })),
    girisListe: sar(async (req) => TicariGirisSqlRepository.liste({
        baslangic: sonrakiGun(metin(req.query.baslangic), await gunSiniri(req)), bitis: metin(req.query.bitis), cariKartId: sayiVeyaNull(req.query.cariKartId), arama: metin(req.query.arama),
        // Dürbün gelişmiş filtresi (docs/FIS_TARIH_VE_DURBUN_YOL_HARITASI.md D1–D4)
        durbun: fisDurbunFiltresiOku(req.query), limit: sayiVeyaNull(req.query.limit),
        kendi: await kendiKayitSuzgeci(req), // kendi kayıtları yetkisi (ortak alan denetimi 19.11.2026)
    }, baglam(req))),
    girisGetir: sar(async (req) => {
        await kayitErisimi(req, "stokGiris", kimlik(req));
        const f = await TicariGirisSqlRepository.getir(kimlik(req), baglam(req));
        if (!f)
            throw ApiError.notFound("Stok giriş fişi bulunamadı.");
        return f;
    }),
    girisKaydet: sar(async (req) => {
        const stokGirisId = req.params.id ? kimlik(req) : null;
        // Vezne kullanıcının kasası: yenide kart veznesi, düzeltmede kaydın veznesi (istekteki yok sayılır)
        const vezneId = await fisVeznesi(kullanici(req), baglam(req), { tur: "stokGiris", id: stokGirisId });
        // Gün sınırı ve tarih yetkisi (fiş numarasını sunucu zaten kendi verir)
        await fisKayitYetkisi(req, "stokGiris", stokGirisId, req.body?.tarih);
        await sayimDonemi(req, STOK_BELGE.GIRIS, stokGirisId);
        return TicariGirisSqlRepository.kaydet({ ...(req.body || {}), stokGirisId, vezneId }, kullanici(req), baglam(req));
    }),
    girisSil: sar(async (req) => {
        // "Kendi kayıtları" kullanıcısı mevcut kaydı silemez (ortak alan denetimi 19.11.2026, #24)
        await kayitErisimi(req, "stokGiris", kimlik(req), { isDelete: true });
        await sayimDonemi(req, STOK_BELGE.GIRIS, kimlik(req), false);
        return TicariGirisSqlRepository.sil(kimlik(req), req.query.onay === "1", baglam(req));
    }),
    satisSiraNo: sar(async (req) => ({ faturaNo: await TicariSatisSqlRepository.siradakiNo(metin(req.query.senaryo), baglam(req)) })),
    satisListe: sar(async (req) => TicariSatisSqlRepository.liste({
        baslangic: sonrakiGun(metin(req.query.baslangic), await gunSiniri(req)), bitis: metin(req.query.bitis), arama: metin(req.query.arama),
        eBelgeDurumu: sayiVeyaNull(req.query.eBelgeDurumu), stokKartId: sayiVeyaNull(req.query.stokKartId),
        // Dürbün gelişmiş filtresi (docs/FIS_TARIH_VE_DURBUN_YOL_HARITASI.md D1–D4)
        durbun: fisDurbunFiltresiOku(req.query), limit: sayiVeyaNull(req.query.limit),
        kendi: await kendiKayitSuzgeci(req), // kendi kayıtları yetkisi (ortak alan denetimi 19.11.2026)
        tip: sayiVeyaNull(req.query.tip), // TA6: 1 satış (varsayılan), 2 iade, 0 hepsi
    }, baglam(req))),
    satisKimlikler: sar(async (req) => TicariSatisSqlRepository.kimlikler(baglam(req), await gunSiniri(req))),
    satisGetir: sar(async (req) => {
        await kayitErisimi(req, "fatura", kimlik(req));
        const f = await TicariSatisSqlRepository.getir(kimlik(req), baglam(req));
        if (!f)
            throw ApiError.notFound("Satış fişi bulunamadı.");
        return f;
    }),
    satisKaydet: sar(async (req) => {
        const faturaId = req.params.id ? kimlik(req) : null;
        const vezneId = await fisVeznesi(kullanici(req), baglam(req), { tur: "fatura", id: faturaId });
        // Kasiyer vardiyası (TA8): ayar açıksa yeni satış için veznede açık vardiya şart (düzeltme serbest)
        if (!faturaId)
            await TicariVardiyaSqlRepository.satisIcinDenetle(vezneId, baglam(req));
        // Gün sınırı, tarih ve fatura numarası yetkisi: numara yetkisi yoksa yenide numaratör, düzeltmede kaydın numarası
        const { nolar, yetki } = await fisKayitYetkisi(req, "fatura", faturaId, req.body?.tarih);
        // Banka hesabı ödemesi ve kart fiyatından farklı fiyat (docs/YETKI_VE_VEZNE_YOL_HARITASI.md §4.2)
        bankaHesabiDenetle(yetki, req.body?.odemeler);
        await ticariFiyatDenetle(req, yetki, req.body?.satirlar);
        // Dönem kilidi (K7): onaylı sayım öncesi tarih; kapanmış vardiyada yazılmış fişin düzeltmesi yalnız yönetici
        const yonetici = await yoneticiMi(req);
        await sayimDonemi(req, STOK_BELGE.SATIS, faturaId);
        const vd = faturaId ? await DonemKilidi.fisVardiyasi(baglam(req), faturaId) : null;
        if (vd)
            DonemKilidi.vardiyaDenetle(vd, yonetici, "düzeltme");
        const sonuc = await TicariSatisSqlRepository.kaydet({ ...(req.body || {}), faturaId, vezneId, ...(nolar && { faturaNo: nolar.FATURA_NO ?? null }) }, kullanici(req), baglam(req), { yonetici });
        if (vd?.kapali && faturaId) {
            const yeni = await DonemKilidi.fisVardiyasi(baglam(req), faturaId);
            await DonemKilidi.vardiyaDuzeltmesiYaz(baglam(req), { vezneId: vd.vezneId, eskiNakit: vd.nakit, yeniNakit: yeni.nakit, aciklama: `${vd.no} düzeltildi`, kullaniciId: kullanici(req) });
        }
        return sonuc;
    }),
    satisSil: sar(async (req) => {
        // "Kendi kayıtları" kullanıcısı mevcut kaydı silemez (ortak alan denetimi 19.11.2026, #24)
        await kayitErisimi(req, "fatura", kimlik(req), { isDelete: true });
        const yonetici = await yoneticiMi(req);
        await sayimDonemi(req, STOK_BELGE.SATIS, kimlik(req), false);
        const vd = await DonemKilidi.fisVardiyasi(baglam(req), kimlik(req));
        DonemKilidi.vardiyaDenetle(vd, yonetici, "silme");
        const sonuc = await TicariSatisSqlRepository.sil(kimlik(req), baglam(req));
        if (vd.kapali)
            await DonemKilidi.vardiyaDuzeltmesiYaz(baglam(req), { vezneId: vd.vezneId, eskiNakit: vd.nakit, yeniNakit: 0, aciklama: `${vd.no} silindi`, kullaniciId: kullanici(req) });
        return sonuc;
    }),
    // ── Satış iadesi (docs/TICARI_ADISYON_YOL_HARITASI.md, TA6) ──
    // Kayıt erişimi (26.11.2026 denetimi): "kendi kayıtları" / gün sınırı olan kullanıcı, kimlik deneyerek başkasının fişini (müşteri
    // kimliği, adres, satırlar) okuyamaz ve başkasının fişini iade edemez — satış fişindeki denetimin aynısı
    iadeKaynak: sar(async (req) => { await kayitErisimi(req, "fatura", kimlik(req)); return TicariIadeSqlRepository.kaynak(kimlik(req), baglam(req)); }),
    iadeKaydet: sar(async (req) => {
        // Vezne kullanıcı kartından (fişlerle aynı); tarih / gün sınırı yetkisi; banka hesabıyla iade yetkisi
        const vezneId = await fisVeznesi(kullanici(req), baglam(req), { tur: "fatura", id: null });
        await TicariVardiyaSqlRepository.satisIcinDenetle(vezneId, baglam(req));
        const { yetki } = await fisKayitYetkisi(req, "fatura", null, req.body?.tarih);
        bankaHesabiDenetle(yetki, req.body?.odemeler);
        if (Number(req.body?.asilFaturaId) > 0)
            await kayitErisimi(req, "fatura", Number(req.body.asilFaturaId));
        await sayimDonemi(req, STOK_BELGE.SATIS, null);
        return TicariIadeSqlRepository.kaydet({ ...(req.body || {}), vezneId }, kullanici(req), baglam(req));
    }),
    iadeGetir: sar(async (req) => { await kayitErisimi(req, "fatura", kimlik(req)); return TicariIadeSqlRepository.getir(kimlik(req), baglam(req)); }),
    iadeSil: sar(async (req) => {
        await kayitErisimi(req, "fatura", kimlik(req), { isDelete: true });
        const yonetici = await yoneticiMi(req);
        await sayimDonemi(req, STOK_BELGE.SATIS, kimlik(req), false);
        const vd = await DonemKilidi.fisVardiyasi(baglam(req), kimlik(req));
        DonemKilidi.vardiyaDenetle(vd, yonetici, "silme");
        const sonuc = await TicariIadeSqlRepository.sil(kimlik(req), baglam(req));
        if (vd.kapali)
            await DonemKilidi.vardiyaDuzeltmesiYaz(baglam(req), { vezneId: vd.vezneId, eskiNakit: vd.nakit, yeniNakit: 0, aciklama: `İade ${vd.no} silindi`, kullaniciId: kullanici(req) });
        return sonuc;
    }),
    iadeGiderTaslagi: sar(async (req) => { await kayitErisimi(req, "fatura", kimlik(req)); return TicariIadeSqlRepository.giderTaslagi(kimlik(req), baglam(req)); }),
    // ── Kasiyer vardiyası: kasa açılış / kapanış (docs/TICARI_ADISYON_YOL_HARITASI.md, TA8) ──
    // Vezne kullanıcının kart veznesi; sistem yöneticisi ?vezneId= / gövdede vezneId ile başka veznenin vardiyasını görür ve kapatır.
    vardiyaDurum: sar(async (req) => TicariVardiyaSqlRepository.durum(await vardiyaVeznesi(req, req.query.vezneId), baglam(req))),
    vardiyaAc: sar(async (req) => TicariVardiyaSqlRepository.ac({ ...(req.body || {}), vezneId: await vardiyaVeznesi(req, req.body?.vezneId) }, kullanici(req), baglam(req))),
    vardiyaKapat: sar(async (req) => TicariVardiyaSqlRepository.kapat({ ...(req.body || {}), vezneId: await vardiyaVeznesi(req, req.body?.vezneId) }, kullanici(req), baglam(req))),
    vardiyaListe: sar(async (req) => {
        const yonetici = await yoneticiMi(req);
        const istenen = sayiVeyaNull(req.query.vezneId);
        return TicariVardiyaSqlRepository.liste({
            vezneId: yonetici ? (istenen && istenen > 0 ? istenen : null) : await kendiVeznem(req),
            baslangic: metin(req.query.baslangic), bitis: metin(req.query.bitis), limit: sayiVeyaNull(req.query.limit),
        }, baglam(req));
    }),
    // ── Gün sonu satış raporu (docs/TICARI_ADISYON_YOL_HARITASI.md, TA7); "kendi kayıtları" yetkisi Satış Listesi'ndeki gibi ──
    gunSonu: sar(async (req) => {
        const bugun = bugunTr();
        const kas = sayiVeyaNull(req.query.kasiyerId), vez = sayiVeyaNull(req.query.vezneId);
        return TicariGunSonuSqlRepository.rapor({
            baslangic: metin(req.query.baslangic) || bugun, bitis: metin(req.query.bitis) || metin(req.query.baslangic) || bugun,
            kasiyerId: kas && kas > 0 ? kas : null, vezneId: vez && vez > 0 ? vez : null, kendi: await kendiKayitSuzgeci(req),
        }, baglam(req));
    }),
    // ── Ortalama maliyet + kâr raporu (TA15): maliyet bilgisi stok yönetim yetkisine (ticariYonetim) ──
    karRaporu: sar(async (req) => {
        const bugun = bugunTr();
        const grup = sayiVeyaNull(req.query.grupId), kart = sayiVeyaNull(req.query.stokKartId);
        return TicariKarSqlRepository.rapor({ baslangic: metin(req.query.baslangic) || bugun, bitis: metin(req.query.bitis) || metin(req.query.baslangic) || bugun,
            grupId: grup && grup > 0 ? grup : null, stokKartId: kart && kart > 0 ? kart : null }, baglam(req));
    }),
    // ── SKT yaklaşanlar (TA16): Stok Durum Listesi gibi bütün Ticari kullanıcılarına açık (raftan kaldırma) ──
    sktYaklasan: sar(async (req) => {
        const gun = metin(req.query.gun), grup = sayiVeyaNull(req.query.grupId);
        const r = await TicariSktSqlRepository.yaklasanlar({ gun: gun === "" || gun === null ? null : Number(gun), grupId: grup && grup > 0 ? grup : null, arama: metin(req.query.arama), tumu: req.query.tumu === "1" }, baglam(req));
        // Alış fiyatı / stok değeri yalnız stok yönetimi yetkisi olanlara (kâr raporu gibi); öbür kullanıcı SKT'yi görür, maliyeti görmez
        if (await TicariStokSqlRepository.yonetebilirMi(kullanici(req), await yoneticiMi(req), baglam(req)))
            return r;
        const gizle = (v) => Array.isArray(v) ? v.map(gizle) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, k === "birimFiyat" || k === "deger" ? null : gizle(x)])) : v;
        return gizle(r);
    }),
    // ── Parçalama fişi + şablon (TA17): stok yönetimi ──
    parcalamaListe: sar(async (req) => TicariParcalamaSqlRepository.liste({ baslangic: metin(req.query.baslangic), bitis: metin(req.query.bitis), stokKartId: sayiVeyaNull(req.query.stokKartId) }, baglam(req))),
    parcalamaGetir: sar(async (req) => TicariParcalamaSqlRepository.getir(kimlik(req), baglam(req))),
    parcalamaKaydet: sar(async (req) => (await sayimDonemi(req, STOK_BELGE.PARCALAMA, req.params.id ? kimlik(req) : null), TicariParcalamaSqlRepository.kaydet({ ...(req.body || {}), parcalamaId: req.params.id ? kimlik(req) : null }, kullanici(req), baglam(req)))),
    parcalamaSil: sar(async (req) => { await sayimDonemi(req, STOK_BELGE.PARCALAMA, kimlik(req), false); return TicariParcalamaSqlRepository.sil(kimlik(req), req.query.onay === "1", baglam(req)); }),
    parcalamaGirdiMaliyeti: sar(async (req) => TicariParcalamaSqlRepository.girdiMaliyeti(Number(req.query.stokKartId) || 0, metin(req.query.tarih) || null, baglam(req))),
    parcalamaSablonlar: sar(async (req) => TicariParcalamaSqlRepository.sablonlar(baglam(req))),
    parcalamaSablonKaydet: sar(async (req) => TicariParcalamaSqlRepository.sablonKaydet({ ...(req.body || {}), sablonId: req.params.id ? kimlik(req) : null }, kullanici(req), baglam(req))),
    parcalamaSablonSil: sar(async (req) => TicariParcalamaSqlRepository.sablonSil(kimlik(req), baglam(req))),
    // ── Sayım fişi (TA11) ve fire fişi (TA12): stok yönetimi ekranları (ticariYonetim) ──
    sayimKartlari: sar(async (req) => TicariSayimSqlRepository.kartlar({ stokGrupId: sayiVeyaNull(req.query.grupId), tarih: metin(req.query.tarih), sayimId: sayiVeyaNull(req.query.sayimId) }, baglam(req))),
    sayimListe: sar(async (req) => TicariSayimSqlRepository.liste({ baslangic: metin(req.query.baslangic), bitis: metin(req.query.bitis), durum: sayiVeyaNull(req.query.durum) }, baglam(req))),
    sayimGetir: sar(async (req) => TicariSayimSqlRepository.getir(kimlik(req), baglam(req))),
    sayimKaydet: sar(async (req) => TicariSayimSqlRepository.kaydet({ ...(req.body || {}), sayimId: req.params.id ? kimlik(req) : null }, kullanici(req), baglam(req))),
    sayimOnayla: sar(async (req) => TicariSayimSqlRepository.onayla(kimlik(req), { sayilmayanSifir: !!req.body?.sayilmayanSifir }, kullanici(req), baglam(req))),
    sayimGeriAl: sar(async (req) => TicariSayimSqlRepository.geriAl(kimlik(req), req.query.onay === "1" || !!req.body?.eksiStokOnay, baglam(req))),
    sayimSil: sar(async (req) => TicariSayimSqlRepository.sil(kimlik(req), baglam(req))),
    fireNedenleri: sar(async () => TicariFireSqlRepository.nedenler()),
    fireListe: sar(async (req) => TicariFireSqlRepository.liste({ baslangic: metin(req.query.baslangic), bitis: metin(req.query.bitis), neden: metin(req.query.neden), stokKartId: sayiVeyaNull(req.query.stokKartId) }, baglam(req))),
    fireGetir: sar(async (req) => TicariFireSqlRepository.getir(kimlik(req), baglam(req))),
    fireKaydet: sar(async (req) => (await sayimDonemi(req, STOK_BELGE.FIRE, req.params.id ? kimlik(req) : null), TicariFireSqlRepository.kaydet({ ...(req.body || {}), fireId: req.params.id ? kimlik(req) : null }, kullanici(req), baglam(req)))),
    fireSil: sar(async (req) => { await sayimDonemi(req, STOK_BELGE.FIRE, kimlik(req), false); return TicariFireSqlRepository.sil(kimlik(req), baglam(req)); }),
    // Tedarikçiye iade (TA13): vezne kullanıcının kart veznesi (cari hareketin veznesi)
    tedIadeKaynak: sar(async (req) => TicariTedarikciIadeSqlRepository.kaynak(kimlik(req), baglam(req))),
    tedIadeListe: sar(async (req) => TicariTedarikciIadeSqlRepository.liste({ baslangic: metin(req.query.baslangic), bitis: metin(req.query.bitis), cariKartId: sayiVeyaNull(req.query.cariKartId) }, baglam(req))),
    tedIadeGetir: sar(async (req) => TicariTedarikciIadeSqlRepository.getir(kimlik(req), baglam(req))),
    tedIadeKaydet: sar(async (req) => {
        const vezneId = await fisVeznesi(kullanici(req), baglam(req));
        await sayimDonemi(req, STOK_BELGE.TEDARIKCI_IADE, req.params.id ? kimlik(req) : null);
        return TicariTedarikciIadeSqlRepository.kaydet({ ...(req.body || {}), vezneId }, kullanici(req), baglam(req));
    }),
    tedIadeSil: sar(async (req) => { await sayimDonemi(req, STOK_BELGE.TEDARIKCI_IADE, kimlik(req), false); return TicariTedarikciIadeSqlRepository.sil(kimlik(req), baglam(req)); }),
    tedIadeTaslak: sar(async (req) => TicariTedarikciIadeSqlRepository.ebelgeTaslagi(kimlik(req), baglam(req))),
    // Gelen e-Faturadan stok girişi (TA14): ICE gelen kutusundan (yalnız okuma) ya da yüklenen UBL XML'inden
    efGelenListe: sar(async (req) => TicariEfaturaGirisSqlRepository.gelenListe({ baslangic: metin(req.query.baslangic), bitis: metin(req.query.bitis), arama: metin(req.query.arama) }, baglam(req))),
    efGelenOnizle: sar(async (req) => TicariEfaturaGirisSqlRepository.onizle(await TicariEfaturaGirisSqlRepository.iceUbl(efUuid(req), baglam(req)), baglam(req))),
    efGelenAl: sar(async (req) => {
        const uuid = efUuid(req);
        const xml = await TicariEfaturaGirisSqlRepository.iceUbl(uuid, baglam(req));
        return TicariEfaturaGirisSqlRepository.al(xml, { ...(req.body || {}), gelenUuid: uuid }, kullanici(req), await fisVeznesi(kullanici(req), baglam(req)), baglam(req));
    }),
    efXmlOnizle: sar(async (req) => TicariEfaturaGirisSqlRepository.onizle(efXml(req), baglam(req))),
    efXmlAl: sar(async (req) => TicariEfaturaGirisSqlRepository.al(efXml(req), { ...(req.body || {}), gelenUuid: null }, kullanici(req), await fisVeznesi(kullanici(req), baglam(req)), baglam(req))),
    tedIadeTaslakBagla: sar(async (req) => {
        const t = Number(req.body?.taslakId);
        if (!Number.isInteger(t) || t <= 0)
            throw ApiError.badRequest("Taslak numarası geçersiz.");
        return TicariTedarikciIadeSqlRepository.taslakBagla(kimlik(req), t, baglam(req));
    }),
    vardiyaRapor: sar(async (req) => {
        const id = kimlik(req);
        const vezne = await TicariVardiyaSqlRepository.vardiyaVeznesi(id, baglam(req));
        if (!vezne)
            throw ApiError.notFound("Vardiya bulunamadı.");
        if (!(await yoneticiMi(req)) && vezne !== (await kendiVeznem(req)))
            throw ApiError.forbidden("Bu vardiya sizin veznenize ait değil.");
        return TicariVardiyaSqlRepository.rapor(id, baglam(req));
    }),
    stokDurum: sar(async (req) => TicariStokSqlRepository.stokDurum({
        tarih: metin(req.query.tarih), grupId: sayiVeyaNull(req.query.grupId), arama: metin(req.query.arama),
        yalnizEksik: req.query.yalnizEksik === "1", pasifler: req.query.pasifler === "1",
    }, baglam(req))),
    hareketler: sar(async (req) => TicariStokSqlRepository.hareketler({
        stokKartId: sayiVeyaNull(req.query.stokKartId), baslangic: metin(req.query.baslangic), bitis: metin(req.query.bitis),
        belgeTuru: sayiVeyaNull(req.query.belgeTuru), grupId: sayiVeyaNull(req.query.grupId),
    }, baglam(req))),
};
function dosyaOku(req) {
    const ham = String(req.body?.dosya || "");
    const b64 = ham.includes(",") ? ham.slice(ham.indexOf(",") + 1) : ham;
    if (!b64)
        throw ApiError.badRequest("Dosya seçilmedi.");
    const b = Buffer.from(b64, "base64");
    if (!b.length)
        throw ApiError.badRequest("Dosya boş.");
    if (b.length > 15 * 1024 * 1024)
        throw ApiError.badRequest("Dosya 15 MB'tan büyük olamaz.");
    return b;
}
