import { HttpStatus } from "../../constants/httpStatusCodes.js";
import { MobilEmirSqlRepository } from "../../models/mobilEmirSql.repository.js";
import { MobilFirmaSqlRepository } from "../../models/mobilFirmaSql.repository.js";
import { MobilHesapSqlRepository } from "../../models/mobilHesapSql.repository.js";
import { ApiError } from "../../utils/ApiError.js";
import { MobilBildirimService } from "./mobilBildirim.service.js";
import { mobilFirmaDurumu } from "./mobilFirma.js";
import { MobilFiyatService } from "./mobilFiyat.service.js";
import { MobilKatalogService } from "./mobilKatalog.service.js";
import { EMIR_DURUM_ADLARI, calismaDisi, emirHatasi, etkinKurallar, miktarHatasi, siparisSatirlari, tercihSecenekleri, tutarHesapla } from "./mobilKural.js";
/**
 * Carinin emri (docs/MOBIL_CARI_YOL_HARITASI.md K17, K20, K30, K32, K33): sade alışveriş ekranından alış / satış emri.
 * Fiyat emir anındaki son fiyattır (makas dahil) ve firmanın belirlediği süre boyunca sabittir; süre dolunca emir düşer.
 * Emir personel onayına düşer; firmaya e-posta gider.
 */
const kurallar = async (m) => {
    const ctx = m.ctx;
    const cariKartId = m.erisim.cariKartId;
    const [ayar, cariAyar] = await Promise.all([MobilFirmaSqlRepository.ayar(ctx), MobilFirmaSqlRepository.cariAyar(ctx, cariKartId)]);
    return { ayar, k: etkinKurallar(ayar, cariAyar) };
};
const kisaAd = async (firmaId) => (await mobilFirmaDurumu(firmaId))?.kisaAd || "Likya";
const emirDisa = (e) => e && {
    emirId: e.emirId,
    tur: e.tur,
    yon: e.yon,
    durum: e.durum,
    durumAdi: EMIR_DURUM_ADLARI[e.durum] || e.durum,
    toplamTl: e.toplamTl,
    tercih: e.tercih,
    notu: e.notu,
    olusturmaTarihi: e.olusturmaTarihi,
    kalanSn: e.kalanSn,
    redNedeni: e.redNedeni,
    fisNo: e.fisNo,
    satirlar: e.satirlar.map((s) => ({ urunAd: s.urunAd, urunKod: s.urunKod, miktar: s.miktar, birim: s.birim, birimFiyat: s.birimFiyat, tutar: s.tutar })),
};
export class MobilEmirService {
    /** İşlem ekranı: emir açık mı, neden kapalı, tercihler, geçerlilik süresi, sınırlar (yalnız bu carinin) */
    static async bilgi(m) {
        const { k } = await kurallar(m);
        const ctx = m.ctx;
        const t = await MobilEmirSqlRepository.cariToplamlari(ctx, m.erisim.cariKartId);
        const kapali = !k.emirAcik ? "Mobil emir şu an kapalı. Firmanızla görüşün." : !k.firmaHazir ? "Firma mobil emir ayarlarını henüz tamamlamamış." : calismaDisi(k, new Date());
        return {
            acik: !kapali,
            kapaliNedeni: kapali,
            alis: !!m.erisim.yetkiler.alis,
            satis: !!m.erisim.yetkiler.satis,
            tercihler: tercihSecenekleri(k),
            gecerlilikSn: k.fiyatGecerlilikSn,
            sinirlar: {
                islemEnAzTl: k.islemEnAzTl,
                islemEnCokTl: k.islemEnCokTl,
                gunlukLimitTl: k.gunlukLimitTl,
                gunlukKalanTl: k.gunlukLimitTl === null ? null : Math.max(0, k.gunlukLimitTl - t.bugun),
                calisma: k.calismaBaslangic && k.calismaBitis ? `${k.calismaBaslangic}–${k.calismaBitis}` : null,
            },
        };
    }
    static async emirVer(m, g) {
        const ctx = m.ctx;
        const cariKartId = m.erisim.cariKartId;
        const yon = g?.yon === "AL" ? "AL" : g?.yon === "SAT" ? "SAT" : null;
        if (!yon)
            throw ApiError.badRequest("İşlem yönü (alış / satış) seçilmedi.");
        if (yon === "AL" && !m.erisim.yetkiler.alis)
            throw new ApiError(HttpStatus.FORBIDDEN, "Alış emri yetkiniz yok.", { kod: "YETKI_YOK" });
        if (yon === "SAT" && !m.erisim.yetkiler.satis)
            throw new ApiError(HttpStatus.FORBIDDEN, "Satış emri yetkiniz yok.", { kod: "YETKI_YOK" });
        const urunId = Number(g?.urunId);
        const fiyat = Number.isInteger(urunId) ? await MobilFiyatService.urunFiyati(ctx, cariKartId, urunId) : null;
        if (!fiyat)
            throw ApiError.badRequest("Bu ürün şu an işleme açık değil.");
        // Cari alıyorsa firma satar: satış fiyatı; cari satıyorsa firma alır: alış fiyatı
        const birimFiyat = yon === "AL" ? fiyat.satir.satis : fiyat.satir.alis;
        if (!birimFiyat)
            throw ApiError.badRequest(`Bu ürünün ${yon === "AL" ? "satış" : "alış"} fiyatı şu an yok.`);
        // İstemci gördüğü fiyatı gönderir; arada fiyat değiştiyse emir verilmez, yeni fiyat gösterilir (cari bilmeden başka fiyata bağlanmasın)
        if (g?.gorulenFiyat !== undefined && Number(g.gorulenFiyat) !== birimFiyat)
            throw new ApiError(HttpStatus.CONFLICT, "Fiyat değişti. Güncel fiyatı kontrol edip yeniden onaylayın.", { kod: "FIYAT_DEGISTI", birimFiyat });
        const miktar = Number(String(g?.miktar ?? "").replace(",", "."));
        const mh = miktarHatasi(miktar, fiyat.satir.birim);
        if (mh)
            throw ApiError.badRequest(mh);
        const tutar = tutarHesapla(miktar, birimFiyat);
        return this.kaydet(m, "PARA", yon, [{ urunId, urunKod: fiyat.satir.kod, urunAd: fiyat.satir.ad, miktar, birim: fiyat.satir.birim, birimFiyat, tutar }], g);
    }
    /**
     * Ticari sipariş (Faz 8): sepetteki stok kartları, carinin o anki KDV dahil fiyatıyla; cari yalnız alır (AL). Fiyat
     * süre boyunca sabit; sınırlar / çalışma saati / bakiye sınırı emirle aynı.
     */
    static async siparisVer(m, g) {
        if (!m.erisim.yetkiler.alis)
            throw new ApiError(HttpStatus.FORBIDDEN, "Sipariş (alış) yetkiniz yok.", { kod: "YETKI_YOK" });
        const { satirlar: girdi, hata } = siparisSatirlari(g?.satirlar);
        if (hata)
            throw ApiError.badRequest(hata);
        const kartlar = new Map((await MobilKatalogService.kartlar(m.ctx, m.erisim.cariKartId, girdi.map((s) => s.stokKartId))).map((k) => [k.stokKartId, k]));
        const degisen = [];
        const satirlar = [];
        for (const s of girdi) {
            const k = kartlar.get(s.stokKartId);
            if (!k)
                throw ApiError.badRequest("Sepetteki bir ürün artık katalogda yok. Sepeti yenileyin.");
            if (s.gorulenFiyat !== undefined && s.gorulenFiyat !== k.fiyat)
                degisen.push({ stokKartId: k.stokKartId, fiyat: k.fiyat });
            const mh = miktarHatasi(s.miktar, k.birim);
            if (mh)
                throw ApiError.badRequest(`${k.ad}: ${mh}`);
            satirlar.push({ urunId: k.stokKartId, urunKod: k.kod, urunAd: k.ad, miktar: s.miktar, birim: k.birim, birimFiyat: k.fiyat, tutar: tutarHesapla(s.miktar, k.fiyat) });
        }
        if (degisen.length)
            throw new ApiError(HttpStatus.CONFLICT, "Bazı fiyatlar değişti. Sepeti kontrol edip yeniden onaylayın.", { kod: "FIYAT_DEGISTI", fiyatlar: degisen });
        return this.kaydet(m, "STOK", "AL", satirlar, g);
    }
    /** Ortak: tercih + not, sınır denetimi, kayıt, firmaya posta */
    static async kaydet(m, tur, yon, satirlar, g) {
        const ctx = m.ctx;
        const cariKartId = m.erisim.cariKartId;
        const tutar = Math.round(satirlar.reduce((a, s) => a + s.tutar, 0) * 100) / 100;
        const tercih = g?.tercih ? String(g.tercih).toUpperCase() : null;
        const notu = String(g?.not ?? "").trim().slice(0, 500) || null;
        const { ayar, k } = await kurallar(m);
        const [t, cari, bakiye] = await Promise.all([
            MobilEmirSqlRepository.cariToplamlari(ctx, cariKartId),
            MobilFirmaSqlRepository.cari(ctx, cariKartId),
            k.bakiyeSiniriUygula && yon === "AL" ? MobilHesapSqlRepository.bakiye(ctx, cariKartId) : Promise.resolve([]),
        ]);
        const tlNet = bakiye.find((b) => ["TL", "TRY", "TRL"].includes(b.paraKod.toUpperCase()))?.net ?? 0;
        const hata = emirHatasi(k, { yon, tutar, tercih }, { simdi: new Date(), bugunToplam: t.bugun, bakiyeBorcTl: tlNet < 0 ? -tlNet : 0, bekleyenAlisTl: t.bekleyenAlis, bakiyeSiniri: cari?.bakiyeSiniri ?? null });
        if (hata)
            throw ApiError.badRequest(hata);
        const id = await MobilEmirSqlRepository.ekle(ctx, {
            cariKartId,
            mobilKullaniciId: m.kullanici.mobilKullaniciId,
            mobilKullaniciAdi: m.kullanici.adSoyad || m.kullanici.kullaniciAdi,
            tur,
            yon,
            toplamTl: tutar,
            tercih: tercih || null,
            notu,
            gecerlilikSn: k.fiyatGecerlilikSn,
            satirlar,
        });
        const e = (await MobilEmirSqlRepository.getir(ctx, id));
        const firmaId = m.firma.firmaId;
        MobilBildirimService.izle(firmaId, ctx, () => kisaAd(firmaId));
        const postaGitti = await MobilBildirimService.yeniEmir(e, m.firma.unvan, ayar.bildirimEposta);
        return { emir: emirDisa(e), postaGitti };
    }
    /** Mobil katalog (fiyat yetkisi) */
    static katalog(m) {
        return MobilKatalogService.katalog(m.ctx, m.erisim.cariKartId);
    }
    static async emirlerim(m) {
        await MobilBildirimService.sureleriIsle(m.ctx, await kisaAd(m.firma.firmaId));
        const l = await MobilEmirSqlRepository.liste(m.ctx, { cariKartId: m.erisim.cariKartId, gun: 30, adet: 50 });
        return l.map(emirDisa);
    }
    static async iptal(m, emirId) {
        if (!Number.isInteger(emirId) || !(await MobilEmirSqlRepository.cariIptal(m.ctx, emirId, m.erisim.cariKartId)))
            throw ApiError.badRequest("Emir iptal edilemedi (onaylanmış, süresi dolmuş ya da size ait değil).");
        return emirDisa(await MobilEmirSqlRepository.getir(m.ctx, emirId));
    }
}
