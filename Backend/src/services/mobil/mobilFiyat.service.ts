import { DbBaglam, MobilFirmaSqlRepository } from "../../models/mobilFirmaSql.repository.js";
import { ApiError } from "../../utils/ApiError.js";
import { BOS_MAKAS, FiyatGrubu, Makas, birimAdi, fiyatGrubu, makasBosMu, makasDuzenle, makasUygula } from "./mobilKural.js";

/**
 * Mobil fiyat (docs/MOBIL_CARI_YOL_HARITASI.md K12–K14, K27, K29). Fiyat, Anlık Fiyat Listesi'nin son kaydıdır
 * (komisyonlu efektif; altınlar listede F12 ile hesaplanmış). Cari yalnız son fiyatı görür: ham kur, komisyon ve
 * makas ayrı ayrı dışarı verilmez. Cariye özel makas lehte ya da aleyhte uygulanır.
 */

export interface MobilFiyatSatiri {
  urunId: number;
  kod: string;
  ad: string;
  birim: string;
  /** Fiyat ekranındaki grup sekmesi */
  grup: FiyatGrubu;
  alis: number | null;
  satis: number | null;
}

export interface MobilFiyatListesi {
  zaman: Date | null;
  urunler: MobilFiyatSatiri[];
}

export interface MakasSatiri {
  urunId: number;
  kod: string;
  ad: string;
  birim: string;
  liste: { alis: number | null; satis: number | null };
  makas: Makas;
  sonuc: { alis: number | null; satis: number | null };
}

export class MobilFiyatService {
  /** Carinin gördüğü liste: firmanın seçtiği ürünler, son fiyat ± cariye özel makas */
  public static async liste(ctx: DbBaglam, cariKartId: number): Promise<MobilFiyatListesi> {
    const [urunler, son, makaslar, ondalik] = await Promise.all([
      MobilFirmaSqlRepository.paraUrunleri(ctx),
      MobilFirmaSqlRepository.sonFiyatlar(ctx),
      MobilFirmaSqlRepository.cariMakaslari(ctx, cariKartId),
      MobilFirmaSqlRepository.kurOndalik(ctx),
    ]);
    const satirlar: MobilFiyatSatiri[] = [];
    for (const u of urunler.filter((x) => x.secili)) {
      const f = son.fiyatlar.get(u.urunId);
      if (!f) continue;
      const s = makasUygula(f, makaslar.get(u.urunId), ondalik);
      if (s.alis === null && s.satis === null) continue;
      satirlar.push({
        urunId: u.urunId,
        kod: u.kod,
        ad: u.ad,
        birim: birimAdi(u.urunTipi, u.birim, u.kod),
        grup: fiyatGrubu(u.urunTipi, u.kod, u.ad),
        alis: s.alis,
        satis: s.satis,
      });
    }
    return { zaman: son.zaman, urunler: satirlar };
  }

  /** Tek ürünün o anki fiyatı (emir için) */
  public static async urunFiyati(ctx: DbBaglam, cariKartId: number, urunId: number): Promise<{ satir: MobilFiyatSatiri; zaman: Date | null } | null> {
    const l = await this.liste(ctx, cariKartId);
    const satir = l.urunler.find((u) => u.urunId === urunId);
    return satir ? { satir, zaman: l.zaman } : null;
  }

  // ------------------------------------------------------------------ Firma tarafı ---

  public static urunler(ctx: DbBaglam) {
    return MobilFirmaSqlRepository.paraUrunleri(ctx);
  }

  public static async urunSecimiYaz(ctx: DbBaglam, g: any) {
    const ids: number[] = Array.isArray(g?.urunIdleri) ? g.urunIdleri.map((x: unknown) => Number(x)) : [];
    if (ids.some((x) => !Number.isInteger(x) || x <= 0)) throw ApiError.badRequest("Ürün listesi geçersiz.");
    if (new Set(ids).size !== ids.length) throw ApiError.badRequest("Aynı ürün iki kez seçilmiş.");
    const gecerli = new Set((await MobilFirmaSqlRepository.paraUrunleri(ctx)).map((u) => u.urunId));
    const yok = ids.find((x) => !gecerli.has(x));
    if (yok) throw ApiError.badRequest(`Ürün bulunamadı: ${yok}`);
    await MobilFirmaSqlRepository.urunSecimiYaz(ctx, "PARA", ids);
    return MobilFirmaSqlRepository.paraUrunleri(ctx);
  }

  /** Cari kartı › makas tablosu: mobilde görünen ürünler, liste fiyatı, makas ve carinin göreceği sonuç (K29) */
  public static async cariMakas(ctx: DbBaglam, cariKartId: number): Promise<{ zaman: Date | null; ondalik: number; satirlar: MakasSatiri[] }> {
    const [urunler, son, makaslar, ondalik] = await Promise.all([
      MobilFirmaSqlRepository.paraUrunleri(ctx),
      MobilFirmaSqlRepository.sonFiyatlar(ctx),
      MobilFirmaSqlRepository.cariMakaslari(ctx, cariKartId),
      MobilFirmaSqlRepository.kurOndalik(ctx),
    ]);
    const satirlar = urunler
      .filter((u) => u.secili || makaslar.has(u.urunId))
      .map((u) => {
        const liste = son.fiyatlar.get(u.urunId) || { alis: null, satis: null };
        const makas = makaslar.get(u.urunId) || { ...BOS_MAKAS };
        return { urunId: u.urunId, kod: u.kod, ad: u.ad, birim: birimAdi(u.urunTipi, u.birim, u.kod), liste, makas, sonuc: makasUygula(liste, makas, ondalik) };
      });
    return { zaman: son.zaman, ondalik, satirlar };
  }

  public static async cariMakasYaz(ctx: DbBaglam, cariKartId: number, g: any, kim: string) {
    if (!(await MobilFirmaSqlRepository.cari(ctx, cariKartId))) throw ApiError.notFound("Cari kart bulunamadı.");
    const ham: any[] = Array.isArray(g?.satirlar) ? g.satirlar : [];
    const gecerli = new Set((await MobilFirmaSqlRepository.paraUrunleri(ctx)).map((u) => u.urunId));
    const satirlar: { urunId: number; makas: Makas }[] = [];
    for (const s of ham) {
      const urunId = Number(s?.urunId);
      if (!gecerli.has(urunId)) throw ApiError.badRequest(`Ürün bulunamadı: ${s?.urunId}`);
      const { makas, hata } = makasDuzenle(s);
      if (hata) throw ApiError.badRequest(hata);
      if (!makasBosMu(makas)) satirlar.push({ urunId, makas });
    }
    if (new Set(satirlar.map((s) => s.urunId)).size !== satirlar.length) throw ApiError.badRequest("Aynı ürün iki kez yazılmış.");
    void kim;
    await MobilFirmaSqlRepository.cariMakasYaz(ctx, cariKartId, "PARA", satirlar);
    return this.cariMakas(ctx, cariKartId);
  }
}
