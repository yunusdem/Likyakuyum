import { HttpStatus } from "../../constants/httpStatusCodes.js";
import { BankaSqlRepository } from "../../models/bankaSql.repository.js";
import { MobilEmirSqlRepository, MobilEmir } from "../../models/mobilEmirSql.repository.js";
import { MobilFirmaSqlRepository } from "../../models/mobilFirmaSql.repository.js";
import { MobilOnaySqlRepository } from "../../models/mobilOnaySql.repository.js";
import { SarrafFisSqlRepository } from "../../models/sarrafFisSql.repository.js";
import { ApiError } from "../../utils/ApiError.js";
import { logger } from "../../utils/logger.js";
import { trZaman } from "../../utils/zaman.utils.js";
import { DovizFisService } from "../dovizFis.service.js";
import { MobilBildirimService } from "./mobilBildirim.service.js";
import { mobilFirmaDurumu } from "./mobilFirma.js";
import { MobilFiyatService } from "./mobilFiyat.service.js";
import { TicariSatisSqlRepository } from "../../models/ticariSatisSql.repository.js";
import { FisOdemesi, ODEME_SEKLI_ADLARI, OdemeSekli, TicariAlici, TicariKart, dovizFisYuku, fisTuruBul, sarrafFisYuku, ticariFisYuku } from "./mobilFisYuku.js";
import { MobilKatalogService } from "./mobilKatalog.service.js";
import { EMIR_DURUM_ADLARI, TERCIH_ADLARI, OdemeTercihi } from "./mobilKural.js";
import type { MobilBaglam as YonetimBaglam } from "./mobilYonetim.service.js";

/**
 * Mobil Emirler — personel tarafı (docs/MOBIL_CARI_YOL_HARITASI.md K17, K19, K31, V7): onay bekleyen emirler (güncel fiyatla
 * fark), onay penceresi (fiş özeti + ödeme şekli) ve onay → fiş (mobil vezne + mobil kullanıcı adına), ret.
 */

const iki = (x: number) => String(x).padStart(2, "0");
/** Fiş ekranları gibi Türkiye saati (sunucunun saat dilimi farklı olabilir: canlı UTC-7) */
const simdi = (d = new Date()) => {
  const z = trZaman(d);
  return { tarih: z.gun, saat: `${iki(z.saat)}:${iki(z.dakika)}` };
};

const kisaAd = async (firmaId: number) => (await mobilFirmaDurumu(firmaId))?.kisaAd || "Likya";

const disa = (e: MobilEmir) => ({
  ...e,
  durumAdi: EMIR_DURUM_ADLARI[e.durum] || (e.durum === ("ISLENIYOR" as any) ? "İşleniyor" : e.durum),
  tercihAdi: e.tercih ? TERCIH_ADLARI[e.tercih as OdemeTercihi] || e.tercih : null,
});

export class MobilOnayService {
  /** Liste: önce süresi dolanlar işaretlenir; bekleyenlerde satır başına güncel fiyat ve fark */
  public static async liste(b: YonetimBaglam, durum?: string | null) {
    await MobilBildirimService.sureleriIsle(b.ctx, await kisaAd(b.firma.firmaId));
    const gecerli = ["BEKLIYOR", "ONAYLANDI", "REDDEDILDI", "SURESI_DOLDU", "IPTAL"];
    const l = await MobilEmirSqlRepository.liste(b.ctx, { durum: durum && gecerli.includes(durum) ? (durum as any) : null, gun: 7, adet: 200 });
    const sonuc = [];
    for (const e of l) {
      const satirlar = [];
      // Ticari: carinin bugünkü katalog fiyatı (KDV dahil)
      const katalog =
        e.durum === "BEKLIYOR" && e.tur === "STOK"
          ? new Map((await MobilKatalogService.kartlar(b.ctx, e.cariKartId, e.satirlar.map((s) => s.urunId)).catch(() => [])).map((k) => [k.stokKartId, k.fiyat]))
          : null;
      for (const s of e.satirlar) {
        let guncel: number | null = null;
        if (katalog) guncel = katalog.get(s.urunId) ?? null;
        else if (e.durum === "BEKLIYOR") {
          const f = await MobilFiyatService.urunFiyati(b.ctx, e.cariKartId, s.urunId).catch(() => null);
          guncel = f ? (e.yon === "AL" ? f.satir.satis : f.satir.alis) : null;
        }
        satirlar.push({ ...s, guncelBirimFiyat: guncel, fark: guncel === null ? null : Math.round((guncel - s.birimFiyat) * 1e6) / 1e6 });
      }
      sonuc.push({ ...disa(e), satirlar });
    }
    return sonuc;
  }

  /** Personel bildirimi: bekleyen emir sayısı ve en son emir */
  public static async ozet(b: YonetimBaglam) {
    return MobilEmirSqlRepository.bekleyenSayisi(b.ctx);
  }

  private static async hazirla(b: YonetimBaglam, emirId: number) {
    const e = await MobilEmirSqlRepository.getir(b.ctx, emirId);
    if (!e) throw ApiError.notFound("Emir bulunamadı.");
    const ayar = await MobilFirmaSqlRepository.ayar(b.ctx);
    if (!ayar.vezneId || !ayar.kullaniciId) throw ApiError.badRequest("Mobil Ayarları'nda mobil vezne ve mobil kullanıcı seçilmemiş.");
    // Ticari sipariş (Faz 8): stok kartları → Ticari Satış Fişi
    let kartlar: TicariKart[] = [];
    let alici: TicariAlici | null = null;
    if (e.tur === "STOK") {
      [kartlar, alici] = await Promise.all([MobilOnaySqlRepository.ticariKartlar(b.ctx, e.satirlar.map((s) => s.urunId)), MobilOnaySqlRepository.ticariAlici(b.ctx, e.cariKartId)]);
      if (!alici) throw ApiError.notFound("Cari kart bulunamadı.");
    }
    const urunler = e.tur === "STOK" ? [] : await MobilOnaySqlRepository.fisUrunleri(b.ctx, e.satirlar.map((s) => s.urunId));
    const fisTuru: "SARRAF" | "DOVIZ" | "TICARI" | "KARISIK" = e.tur === "STOK" ? "TICARI" : fisTuruBul(urunler);
    if (fisTuru === "KARISIK") throw ApiError.badRequest("Emirde döviz ve altın birlikte; ayrı fiş gerekir.");
    const cari = await MobilOnaySqlRepository.fisCarisi(b.ctx, e.cariKartId);
    if (!cari) throw ApiError.notFound("Cari kart bulunamadı.");
    const tip: 0 | 1 = e.yon === "AL" ? 1 : 0;
    const ortam = await MobilOnaySqlRepository.ortam(b.ctx, tip, ayar.vezneId, ayar.kullaniciId);
    const t = simdi();
    const fisOrtami = { vezneId: ayar.vezneId, kullaniciId: ayar.kullaniciId, tarih: t.tarih, saat: t.saat, tl: ortam.tl, has: ortam.has, hasKuru: ortam.hasKuru, istatistik: ortam.istatistik, kmvSekli: ortam.kmvSekli };
    return { e, urunler, fisTuru, cari, tip, ortam, fisOrtami, kartlar, alici: alici as TicariAlici };
  }

  private static yukKur(h: Awaited<ReturnType<typeof MobilOnayService.hazirla>>, odeme: FisOdemesi): any {
    if (h.fisTuru === "TICARI") return ticariFisYuku(h.e, h.kartlar, h.alici, h.fisOrtami, odeme);
    if (h.fisTuru === "DOVIZ") return dovizFisYuku(h.e, h.urunler, h.cari, h.fisOrtami, odeme);
    return sarrafFisYuku(h.e, h.urunler, h.cari, h.fisOrtami, odeme);
  }

  /** Onay penceresi: fişin özeti (tutar, BSMV/KMV), vezne / kullanıcı, ödeme seçenekleri (carinin tercihi önce) */
  public static async onizleme(b: YonetimBaglam, emirId: number) {
    const h = await this.hazirla(b, emirId);
    const secenekler: { kod: OdemeSekli; ad: string; liste?: { id: number; ad: string }[] }[] = [
      { kod: "NAKIT", ad: ODEME_SEKLI_ADLARI.NAKIT },
      { kod: "CARI", ad: ODEME_SEKLI_ADLARI.CARI },
    ];
    const bankalar =
      h.fisTuru === "DOVIZ" || h.fisTuru === "TICARI"
        ? await MobilOnaySqlRepository.dovizBankalari(b.ctx)
        : (await BankaSqlRepository.listBankalar({ aktif: true }, b.ctx).catch(() => [])).map((x) => ({ id: x.bankaId, ad: `${x.hesapAdi}${x.hesapNo ? ` · ${x.hesapNo}` : ""}` }));
    if (bankalar.length) secenekler.push({ kod: "HAVALE", ad: ODEME_SEKLI_ADLARI.HAVALE, liste: bankalar });
    if ((h.fisTuru === "SARRAF" || h.fisTuru === "TICARI") && h.tip === 1) {
      const pos = await MobilOnaySqlRepository.posCihazlari(b.ctx);
      if (pos.length) secenekler.push({ kod: "POS", ad: ODEME_SEKLI_ADLARI.POS, liste: pos });
    }
    // Özet: nakitle kurulmuş yük (BSMV/KMV ve has dahil); seçilen ödeme yalnız ödeme satırını değiştirir
    let ozet: { toplam: number; odenecek: number; masraf: number; hasToplam: number; kdv?: number } | null = null;
    let uyari: string | null = null;
    let stokUyari: string | null = null;
    try {
      const yuk: any = this.yukKur(h, { sekil: "NAKIT" });
      ozet = yuk._ozet;
      const eksik: { kod: string; ad: string; birim: string; bakiye: number; miktar: number }[] = yuk._stokEksigi || [];
      if (eksik.length) stokUyari = `Stok yetersiz: ${eksik.map((k) => `${k.ad} (stok ${k.bakiye.toLocaleString("tr-TR")}, sipariş ${k.miktar.toLocaleString("tr-TR")} ${k.birim})`).join(", ")}. Onaylarsanız stok eksiye düşer.`;
    } catch (err: any) {
      uyari = err?.message || "Fiş hazırlanamadı.";
    }
    const tercihKodu = h.e.tercih === "BAKIYE" ? "CARI" : h.e.tercih === "TESLIM" ? "NAKIT" : h.e.tercih === "HAVALE" ? "HAVALE" : h.e.tercih === "POS" ? "POS" : null;
    return {
      emir: disa(h.e),
      fisTuru: h.fisTuru,
      fisAdi: h.fisTuru === "TICARI" ? "Ticari satış fişi" : `${h.fisTuru === "DOVIZ" ? "Döviz" : "Sarraf"} ${h.tip === 1 ? "satış" : "alış"} fişi`,
      vezne: h.ortam.vezne,
      kullanici: h.ortam.kullanici,
      cari: { kod: h.cari.kod, ad: h.cari.ad },
      ozet,
      uyari,
      stokUyari,
      secenekler,
      onerilenOdeme: secenekler.some((x) => x.kod === tercihKodu) ? tercihKodu : "NAKIT",
    };
  }

  /** Onay → fiş (K31): emir üstlenilir, fiş mobil vezne + mobil kullanıcı adına kaydedilir, emir onaylanır, cariye posta */
  public static async onayla(b: YonetimBaglam, emirId: number, g: any, personel: { id: number; ad: string }) {
    const sekil = String(g?.odemeSekli || "").toUpperCase() as OdemeSekli;
    if (!(sekil in ODEME_SEKLI_ADLARI)) throw ApiError.badRequest("Ödeme şekli seçilmedi.");
    const h = await this.hazirla(b, emirId);
    if (h.e.durum !== "BEKLIYOR") throw ApiError.badRequest(`Emir ${EMIR_DURUM_ADLARI[h.e.durum]?.toLocaleLowerCase("tr-TR") || "işlenmiş"}; onaylanamaz.`);
    const odeme: FisOdemesi = { sekil, bankaId: g?.bankaId ? Number(g.bankaId) : null, bankaAdi: g?.bankaAdi ?? null, posCihaziId: g?.posCihaziId ? Number(g.posCihaziId) : null, posAdi: g?.posAdi ?? null };
    let yuk: any;
    try {
      yuk = this.yukKur(h, odeme);
    } catch (err: any) {
      throw ApiError.badRequest(err?.message || "Fiş hazırlanamadı.");
    }
    const { _ozet, _stokEksigi: _se, ...kayit } = yuk;
    if (!(await MobilOnaySqlRepository.ustlen(b.ctx, emirId, personel.id, personel.ad)))
      throw new ApiError(HttpStatus.CONFLICT, "Emir artık onaylanamaz (süresi doldu, iptal edildi ya da başka biri işledi).", { kod: "EMIR_ISLENEMEZ" });
    const ayni = { emirId, cariKartId: h.cari.cariKartId, tip: h.tip };
    // Ticari fiş kaydı tek işlem (transaction): yarım kalmaz
    const yarim = () => (h.fisTuru === "TICARI" ? Promise.resolve(null) : MobilOnaySqlRepository.yarimKalanFis(b.ctx, h.fisTuru as "SARRAF" | "DOVIZ", ayni).catch(() => null));
    // Önceki denemeden kalmış fiş varsa yenisi kesilmez, emir o fişe bağlanır
    let fis = await yarim();
    if (fis) logger.warn(`[MOBIL] Emir #${emirId}: önceki denemenin fişi (${fis.fisId}) bulundu, yeni fiş kesilmedi.`);
    if (!fis) {
      try {
        if (h.fisTuru === "TICARI") {
          const r: any = await TicariSatisSqlRepository.kaydet(kayit, h.fisOrtami.kullaniciId, b.ctx);
          fis = { fisId: Number(r?.fis?.faturaId) || 0, fisNo: String(r?.fis?.faturaNo || "").trim() || null };
          if (r?.uyari) logger.warn(`[MOBIL] Emir #${emirId}: ${r.uyari}`);
        } else if (h.fisTuru === "DOVIZ") {
          const r: any = await DovizFisService.saveFis(kayit, b.ctx);
          fis = { fisId: Number(r?.fisId) || 0, fisNo: String(r?.belgeNo || r?.seriNo || "").trim() || null };
        } else {
          await MobilOnaySqlRepository.sarrafOnHazirlik(b.ctx);
          const r = await SarrafFisSqlRepository.saveFis(kayit, b.ctx);
          fis = { fisId: Number(r?.sarrafFisiId) || 0, fisNo: String(r?.fisNo || "").trim() || null };
        }
        if (!fis.fisId) throw new Error("Fiş kaydedildi ancak numarası alınamadı.");
      } catch (err: any) {
        // Yordam fişi yazıp sonraki adımda düştüyse fiş vardır: emir ona bağlanır (ikinci denemede çift fiş olmasın)
        fis = await yarim();
        if (fis) logger.warn(`[MOBIL] Emir #${emirId}: kayıt hata verdi (${err?.message}) ama fiş ${fis.fisId} yazılmış; emir bu fişle onaylandı.`);
        else {
          await MobilOnaySqlRepository.birak(b.ctx, emirId).catch(() => undefined);
          logger.error(`[MOBIL] Emir #${emirId} fişe çevrilemedi: ${err?.message}`);
          throw err instanceof ApiError ? err : ApiError.badRequest(`Fiş kaydedilemedi: ${err?.message || err}`);
        }
      }
    }
    const fisId = fis.fisId;
    const fisNo = fis.fisNo;
    await MobilOnaySqlRepository.tamamla(b.ctx, emirId, { odemeSekli: sekil, fisTuru: h.fisTuru, fisId, fisNo });
    const son = (await MobilEmirSqlRepository.getir(b.ctx, emirId))!;
    const postaGitti = await MobilBildirimService.cariyeSonuc(son, await kisaAd(b.firma.firmaId));
    return { emir: disa(son), fis: { tur: h.fisTuru, id: fisId, no: fisNo, ozet: _ozet }, postaGitti };
  }

  public static async reddet(b: YonetimBaglam, emirId: number, g: any, personel: { id: number; ad: string }) {
    const neden = String(g?.neden ?? "").trim().slice(0, 300) || null;
    if (!(await MobilOnaySqlRepository.reddet(b.ctx, emirId, personel.id, personel.ad, neden)))
      throw new ApiError(HttpStatus.CONFLICT, "Emir artık reddedilemez (işlenmiş ya da süresi dolmuş).", { kod: "EMIR_ISLENEMEZ" });
    const e = (await MobilEmirSqlRepository.getir(b.ctx, emirId))!;
    const postaGitti = await MobilBildirimService.cariyeSonuc(e, await kisaAd(b.firma.firmaId));
    return { emir: disa(e), postaGitti };
  }
}
