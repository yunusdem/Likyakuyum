import { ApiError } from "../utils/ApiError.js";
import { TicariStokSqlRepository } from "../models/ticariStokSql.repository.js";
import { TicariGirisSqlRepository } from "../models/ticariGirisSql.repository.js";
import { TicariSatisSqlRepository } from "../models/ticariSatisSql.repository.js";
import { excelOnizle, excelYukle, ornekExcel } from "../services/ticari/ticariExcel.js";
import { fisVeznesi } from "../services/yetki/fisVeznesi.js";
import { fisKayitYetkisi, gunSiniri, kayitErisimi, sonrakiGun } from "../services/yetki/fisYetkileri.js";
import { bankaHesabiDenetle, ticariFiyatDenetle } from "../services/yetki/fisIcerikYetkisi.js";
import { kullaniciYetkisi } from "../services/yetki/kullaniciYetkisi.js";
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
    gruplar: sar(async (req) => TicariStokSqlRepository.gruplar(baglam(req))),
    grupKaydet: sar(async (req) => TicariStokSqlRepository.grupKaydet({ ...(req.body || {}), stokGrupId: req.params.id ? kimlik(req) : null }, kullanici(req), baglam(req))),
    grupSil: sar(async (req) => TicariStokSqlRepository.grupSil(kimlik(req), baglam(req))),
    kartlar: sar(async (req) => TicariStokSqlRepository.kartlar({
        arama: metin(req.query.arama) ?? undefined,
        grupId: sayiVeyaNull(req.query.grupId),
        aktif: req.query.aktif === "1" ? true : req.query.aktif === "0" ? false : null,
        limit: sayiVeyaNull(req.query.limit) ?? undefined,
    }, baglam(req))),
    kart: sar(async (req) => {
        const k = await TicariStokSqlRepository.kart(kimlik(req), baglam(req), true);
        if (!k)
            throw ApiError.notFound("Stok kartı bulunamadı.");
        return k;
    }),
    kartBul: sar(async (req) => {
        const k = await TicariStokSqlRepository.kartBul(String(req.params.deger || ""), baglam(req));
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
        return TicariGirisSqlRepository.kaydet({ ...(req.body || {}), stokGirisId, vezneId }, kullanici(req), baglam(req));
    }),
    girisSil: sar(async (req) => {
        await kayitErisimi(req, "stokGiris", kimlik(req));
        return TicariGirisSqlRepository.sil(kimlik(req), req.query.onay === "1", baglam(req));
    }),
    satisSiraNo: sar(async (req) => ({ faturaNo: await TicariSatisSqlRepository.siradakiNo(metin(req.query.senaryo), baglam(req)) })),
    satisListe: sar(async (req) => TicariSatisSqlRepository.liste({
        baslangic: sonrakiGun(metin(req.query.baslangic), await gunSiniri(req)), bitis: metin(req.query.bitis), arama: metin(req.query.arama),
        eBelgeDurumu: sayiVeyaNull(req.query.eBelgeDurumu), stokKartId: sayiVeyaNull(req.query.stokKartId),
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
        // Gün sınırı, tarih ve fatura numarası yetkisi: numara yetkisi yoksa yenide numaratör, düzeltmede kaydın numarası
        const { nolar, yetki } = await fisKayitYetkisi(req, "fatura", faturaId, req.body?.tarih);
        // Banka hesabı ödemesi ve kart fiyatından farklı fiyat (docs/YETKI_VE_VEZNE_YOL_HARITASI.md §4.2)
        bankaHesabiDenetle(yetki, req.body?.odemeler);
        await ticariFiyatDenetle(req, yetki, req.body?.satirlar);
        return TicariSatisSqlRepository.kaydet({ ...(req.body || {}), faturaId, vezneId, ...(nolar && { faturaNo: nolar.FATURA_NO ?? null }) }, kullanici(req), baglam(req));
    }),
    satisSil: sar(async (req) => {
        await kayitErisimi(req, "fatura", kimlik(req));
        return TicariSatisSqlRepository.sil(kimlik(req), baglam(req));
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
