import sql from "mssql";
import { adminYapilandirildiMi, getAdminPool } from "../../config/adminDb.config.js";
import { FirmaSqlRepository } from "../../models/admin/firmaSql.repository.js";
import { FirmaDurum } from "../../types/admin.types.js";
import { logger } from "../../utils/logger.js";
import { bugunTr } from "../../utils/zaman.utils.js";
import { firmaDbAnahtari } from "../admin/firmaBaglanti.service.js";
import { DestekService } from "./destek.service.js";

/**
 * Sistem olayı kancaları (K14, yol haritası §5). Hiçbiri çağıran işlemi bozmaz: hata yalnız loglanır.
 * Kurulum (exe) modunda merkez veritabanı olmadığından sessizce atlanır.
 */

const gunYaz = (d: Date | string | null | undefined): string => {
  if (!d) return "-";
  const t = typeof d === "string" ? new Date(d) : d;
  return `${String(t.getUTCDate()).padStart(2, "0")}.${String(t.getUTCMonth() + 1).padStart(2, "0")}.${t.getUTCFullYear()}`;
};

const DURUM_METNI: Record<FirmaDurum, { baslik: string; metin: string }> = {
  AKTIF: { baslik: "Hesabınız yeniden açıldı", metin: "Hesabınız yeniden aktif edildi. Kullanıcılarınız giriş yapabilir." },
  DONDURULMUS: { baslik: "Hesabınız donduruldu", metin: "Hesabınız donduruldu; açık oturumlar kapatıldı. Lütfen hizmet sağlayıcınızla iletişime geçiniz." },
  PASIF: { baslik: "Hesabınız kapatıldı", metin: "Hesabınız pasife alındı. Lütfen hizmet sağlayıcınızla iletişime geçiniz." },
  SILINECEK: { baslik: "Hesabınız silinmek üzere", metin: "Hesabınız silinmek üzere bekliyor. Bu bir hata ise hemen hizmet sağlayıcınızla iletişime geçiniz." },
  SILINDI: { baslik: "Hesabınız silindi", metin: "Hesabınız silindi." },
};

export class DestekOlay {
  /** FirmaService.durumDegistir: dondurma / pasif / yeniden açma (her değişimde yeni kayıt). */
  public static firmaDurumu(firmaId: number, yeni: FirmaDurum, not: string | null, kapananOturum: number): void {
    const m = DURUM_METNI[yeni];
    if (!m) return;
    const ek = [not ? `Not: ${not}` : null, kapananOturum ? `Kapatılan oturum: ${kapananOturum}` : null].filter(Boolean).join("\n");
    void DestekService.sistemOlayi({
      firmaId,
      olay: "FIRMA_DURUM",
      baslik: m.baslik,
      metin: ek ? `${m.metin}\n${ek}` : m.metin,
      onemli: yeni !== "AKTIF",
    });
  }

  /** IzlemeService.oturumuKapat: tek oturum (sid → firma ve kullanıcı merkezden bulunur). */
  public static oturumKapatildi(sid: string, adminAd: string): void {
    if (!adminYapilandirildiMi()) return;
    void (async () => {
      try {
        const pool = await getAdminPool();
        const r = await pool.request().input("sid", sql.UniqueIdentifier, sid).query(`
          SELECT o.FIRMA_ID, k.KULLANICI_ADI, k.AD_SOYAD FROM dbo.ADM_OTURUM o
          LEFT JOIN dbo.ADM_KULLANICI k ON k.KULLANICI_ID = o.KULLANICI_ID
          WHERE o.OTURUM_ID = @sid AND o.TUR = 'KULLANICI'`);
        const x = r.recordset[0];
        if (!x?.FIRMA_ID) return;
        const kim = x.AD_SOYAD || x.KULLANICI_ADI || "bir kullanıcı";
        await DestekService.sistemOlayi({
          firmaId: x.FIRMA_ID,
          olay: "OTURUM_KAPATILDI",
          baslik: "Oturum kapatıldı",
          metin: `${kim} adlı kullanıcının oturumu yönetim panelinden (${adminAd}) kapatıldı. Tekrar giriş yapması gerekir.`,
        });
      } catch (err: any) {
        logger.warn(`[DESTEK] Oturum kapatma olayı yazılamadı: ${err?.message}`);
      }
    })();
  }

  /** IzlemeService.firmaOturumlariniKapat: firmanın tüm oturumları. */
  public static firmaOturumlariKapatildi(firmaId: number, kapanan: number, adminAd: string): void {
    if (kapanan <= 0) return;
    void DestekService.sistemOlayi({
      firmaId,
      olay: "OTURUM_KAPATILDI",
      baslik: "Oturumlar kapatıldı",
      metin: `Firmanızın ${kapanan} açık oturumu yönetim panelinden (${adminAd}) kapatıldı. Kullanıcıların tekrar giriş yapması gerekir.`,
    });
  }

  /** MerkezKurulumService.heartbeat: kurulumun bildirdiği sürüm değişti. */
  public static guncellemeKuruldu(firmaId: number, eski: string | null, yeni: string): void {
    void DestekService.sistemOlayi({
      firmaId,
      olay: "GUNCELLEME_KURULDU",
      baslik: `Güncelleme kuruldu: ${yeni}`,
      metin: eski ? `Program ${eski} sürümünden ${yeni} sürümüne güncellendi.` : `Program ${yeni} sürümüyle çalışıyor.`,
      anahtar: `GUNC:${firmaId}:${yeni}`.slice(0, 100),
    });
  }

  /** EbelgeKuyrukService: kesin gönderim hatası. Aynı gün aynı firmanın hataları tek konuda toplanır. */
  public static ebelgeHatasi(ctx: { dbServer?: string; dbName?: string } | undefined, belge: { belgeTuru?: string; belgeNo?: string | null; uuid?: string }, mesaj: string): void {
    if (!adminYapilandirildiMi() || !ctx?.dbServer || !ctx?.dbName) return;
    void (async () => {
      try {
        const firma = await FirmaSqlRepository.anahtarIleBul(firmaDbAnahtari(ctx.dbServer!, ctx.dbName!).anahtar);
        if (!firma) return;
        const gun = bugunTr();
        await DestekService.sistemOlayi({
          firmaId: firma.firmaId,
          olay: "EBELGE_HATA",
          baslik: `e-Belge gönderim hatası (${gun.split("-").reverse().join(".")})`,
          metin: `${belge.belgeTuru || "Belge"} ${belge.belgeNo || belge.uuid || ""}: ${mesaj}`.trim(),
          anahtar: `EBELGE:${firma.firmaId}:${gun}`,
        });
      } catch (err: any) {
        logger.warn(`[DESTEK] e-Belge hata olayı yazılamadı: ${err?.message}`);
      }
    })();
  }

  /** DestekZamanlayici: lisans bitimine 30 / 7 gün kala ve bittiğinde (lisans başına bir kez). */
  public static async lisansTaramasi(): Promise<number> {
    const { DestekSqlRepository } = await import("../../models/admin/destekSql.repository.js");
    if (!(await DestekSqlRepository.kuruluMu())) return 0;
    let yazilan = 0;
    for (const l of await DestekSqlRepository.lisansKalanGunler()) {
      let olay: "LISANS_30" | "LISANS_7" | "LISANS_BITTI" | null = null;
      if (l.kalanGun < 0) olay = "LISANS_BITTI";
      else if (l.kalanGun <= 7) olay = "LISANS_7";
      else if (l.kalanGun <= 30) olay = "LISANS_30";
      if (!olay) continue;
      const anahtar = `${olay}:${l.firmaId}:${l.lisansId}`;
      if (await DestekSqlRepository.olayAnahtariIleBul(anahtar)) continue;
      const bitis = gunYaz(l.bitis);
      const metin =
        olay === "LISANS_BITTI"
          ? `Lisans süreniz ${bitis} tarihinde doldu. Yenileme için lütfen hizmet sağlayıcınızla iletişime geçiniz.`
          : `Lisans süreniz ${bitis} tarihinde doluyor (${l.kalanGun} gün kaldı). Kesinti yaşamamak için lütfen hizmet sağlayıcınızla iletişime geçiniz.`;
      const id = await DestekService.sistemOlayi({
        firmaId: l.firmaId,
        olay,
        baslik: olay === "LISANS_BITTI" ? "Lisans süreniz doldu" : `Lisans süreniz ${l.kalanGun} gün içinde doluyor`,
        metin,
        anahtar,
        onemli: olay !== "LISANS_30",
      });
      if (id) yazilan++;
    }
    return yazilan;
  }
}
