import { MobilFirmaSqlRepository } from "../../models/mobilFirmaSql.repository.js";
import { TicariFiyatSqlRepository } from "../../models/ticariFiyatSql.repository.js";
import { TicariStokSqlRepository } from "../../models/ticariStokSql.repository.js";
import { ApiError } from "../../utils/ApiError.js";
import { stokFiyati } from "./mobilKural.js";
const kartaCevir = (k) => {
    const fiyat = stokFiyati(k);
    if (!k.aktif || fiyat === null)
        return null;
    return { stokKartId: k.stokKartId, kod: k.kod, ad: k.ad, grup: k.grupAdi, birim: k.birim || "Adet", fiyat, kdvOrani: Number(k.kdvOrani) || 0, stokta: Number(k.bakiye) > 0, bakiye: Number(k.bakiye) || 0 };
};
export class MobilKatalogService {
    /** Carinin fiyat listesi (Ticari › fiyat listeleri; atanmamışsa null → kart fiyatı) */
    static async cariListesi(ctx, cariKartId) {
        return (await TicariFiyatSqlRepository.cariListesi(cariKartId, ctx).catch(() => null))?.fiyatListesiId ?? null;
    }
    /** Seçili kartlar, carinin fiyatıyla, seçim sırasıyla; pasif / fiyatsız kart çıkar */
    static async kartlar(ctx, cariKartId, idler) {
        const secim = await MobilFirmaSqlRepository.stokSecimi(ctx);
        const istenen = idler ? secim.filter((id) => idler.includes(id)) : secim;
        if (!istenen.length)
            return [];
        const fiyatListesiId = cariKartId ? await this.cariListesi(ctx, cariKartId) : null;
        const kartlar = await TicariStokSqlRepository.kartlar({ idler: istenen, fiyatListesiId }, ctx);
        const harita = new Map(kartlar.map((k) => [k.stokKartId, k]));
        return istenen.map((id) => harita.get(id)).map((k) => (k ? kartaCevir(k) : null)).filter((x) => !!x);
    }
    /** Mobil katalog: stok miktarı dışarı verilmez */
    static async katalog(ctx, cariKartId) {
        const l = await this.kartlar(ctx, cariKartId);
        return { urunler: l.map(({ bakiye: _b, ...u }) => u) };
    }
    // ------------------------------------------------------------------ Firma tarafı ---
    /** Mobil Ayarları: katalogdaki kartlar (firma kendi stok bakiyesini görür) */
    static async secili(ctx) {
        const secim = await MobilFirmaSqlRepository.stokSecimi(ctx);
        if (!secim.length)
            return [];
        const kartlar = await TicariStokSqlRepository.kartlar({ idler: secim }, ctx);
        const harita = new Map(kartlar.map((k) => [k.stokKartId, k]));
        return secim
            .map((id) => harita.get(id))
            .filter((k) => !!k)
            .map((k) => ({ stokKartId: k.stokKartId, kod: k.kod, ad: k.ad, grup: k.grupAdi, birim: k.birim, fiyat: stokFiyati(k), bakiye: Number(k.bakiye) || 0, aktif: k.aktif }));
    }
    /** Mobil Ayarları: kart arama (eklemek için) */
    static async ara(ctx, arama) {
        const q = String(arama || "").trim();
        if (q.length < 2)
            return [];
        const l = await TicariStokSqlRepository.kartlar({ arama: q, aktif: true, limit: 30 }, ctx);
        return l.map((k) => ({ stokKartId: k.stokKartId, kod: k.kod, ad: k.ad, grup: k.grupAdi, birim: k.birim, fiyat: stokFiyati(k), bakiye: Number(k.bakiye) || 0 }));
    }
    static async secimYaz(ctx, g) {
        const ids = Array.isArray(g?.stokKartIdleri) ? g.stokKartIdleri.map((x) => Number(x)) : [];
        if (ids.some((x) => !Number.isInteger(x) || x <= 0))
            throw ApiError.badRequest("Ürün listesi geçersiz.");
        if (new Set(ids).size !== ids.length)
            throw ApiError.badRequest("Aynı ürün iki kez seçilmiş.");
        if (ids.length > 2000)
            throw ApiError.badRequest("Katalogda en çok 2.000 ürün olabilir.");
        if (ids.length) {
            const var_ = new Set((await TicariStokSqlRepository.kartlar({ idler: ids }, ctx)).map((k) => k.stokKartId));
            const yok = ids.find((x) => !var_.has(x));
            if (yok)
                throw ApiError.badRequest(`Stok kartı bulunamadı: ${yok}`);
        }
        await MobilFirmaSqlRepository.urunSecimiYaz(ctx, "STOK", ids);
        return this.secili(ctx);
    }
}
