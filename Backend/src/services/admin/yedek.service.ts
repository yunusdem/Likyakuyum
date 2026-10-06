import crypto from "crypto";
import fs from "fs";
import path from "path";
import sql from "mssql";
import { Response } from "express";
import { AyarSqlRepository } from "../../models/admin/ayarSql.repository.js";
import { BulutSqlRepository } from "../../models/admin/bulutSql.repository.js";
import { AdminLogSqlRepository } from "../../models/admin/adminLogSql.repository.js";
import { AdminBaglam, FirmaDto } from "../../types/admin.types.js";
import { ApiError } from "../../utils/ApiError.js";
import { logger } from "../../utils/logger.js";
import { FirmaService } from "./firma.service.js";
import { kd, klonIle, klonYapilandirildiMi } from "./klon.service.js";

/**
 * Bulut firma yedekleri (docs/BULUT_VE_EXE_LISANS_YOL_HARITASI.md, K6 ve 6.3).
 * Firma başına TEK dosya: <YEDEK_KLASORU>\Firmalar\<FIRMA_KODU>.bak; yeni yedek öncekinin üstüne yazar (INIT).
 * COPY_ONLY: firmanın varsa kendi yedek zincirini bozmaz. Yedek, SQL Server tarafından yazılır (likya_klon hesabıyla).
 */

export const YEDEK_INDIRME_DAKIKA = 15;
const suruyor = new Set<number>();

export const tokenOzeti = (token: string): string => crypto.createHash("sha256").update(token).digest("hex");

export const yedekKlasorleri = async (): Promise<{ firmalar: string; silinen: string }> => {
  const kok = await AyarSqlRepository.oku("YEDEK_KLASORU");
  return { firmalar: path.win32.join(kok, "Firmalar"), silinen: path.win32.join(kok, "Silinen") };
};

const dosyaBoyutu = (dosya: string): number | null => {
  try {
    return fs.statSync(dosya).size;
  } catch {
    return null; // dosyayı SQL Server yazdı; bu işlemin okuma izni yoksa boyut bilinmez
  }
};

/** Veritabanını verilen dosyaya yedekler ve doğrular. Dosyanın boyutunu (okunabiliyorsa) döndürür. */
export const veritabaniniYedekle = async (dbName: string, dosya: string): Promise<number | null> => {
  await klonIle("master", async (pool) => {
    await pool
      .request()
      .input("yol", sql.NVarChar(400), dosya)
      .query(`BACKUP DATABASE ${kd(dbName)} TO DISK = @yol WITH COPY_ONLY, INIT, FORMAT, CHECKSUM`);
    await pool.request().input("yol", sql.NVarChar(400), dosya).query(`RESTORE VERIFYONLY FROM DISK = @yol WITH CHECKSUM`);
  });
  return dosyaBoyutu(dosya);
};

const yedekHataMetni = (err: any): string => {
  const no = Number(err?.number ?? err?.originalError?.info?.number);
  const msg = String(err?.message || err || "Bilinmeyen hata");
  if (no === 3201 || no === 3013) return `Yedek dosyası yazılamadı. Yedek klasörünün SQL Server tarafından yazılabildiğini kontrol edin. (${msg.slice(0, 200)})`;
  if (no === 262 || no === 3110 || no === 916) {
    return "Klonlama hesabının (likya_klon) bu veritabanını yedekleme yetkisi yok. docs/sql/KLON_HESABI.sql içindeki firma listesine ekleyin.";
  }
  return msg.slice(0, 300);
};

export class YedekService {
  /** Firmayı şimdi yedekler (panelden "Şimdi yedekle" veya haftalık zamanlayıcı; zamanlayıcıda yapan null). */
  public static async yedekle(yapan: AdminBaglam | null, firmaId: number): Promise<FirmaDto> {
    if (!klonYapilandirildiMi()) throw ApiError.badRequest("Bu sunucuda yedekleme kapalı (klonlama hesabı tanımlı değil).");
    const firma = await FirmaService.getir(firmaId);
    if (firma.baglantiModu !== "cloud") throw ApiError.badRequest("Yalnız sunucumuzdaki (bulut) firmalar yedeklenir.");
    if (firma.durum === "SILINDI") throw ApiError.badRequest("Firma silinmiş; yedeklenecek veritabanı yok.");
    if (suruyor.has(firmaId)) throw ApiError.conflict("Bu firmanın yedeği şu anda alınıyor.");

    suruyor.add(firmaId);
    const { firmalar } = await yedekKlasorleri();
    const dosya = path.win32.join(firmalar, `${firma.firmaKodu}.bak`);
    try {
      const baslangic = Date.now();
      const boyut = await veritabaniniYedekle(firma.dbName, dosya);
      await BulutSqlRepository.yedekYaz(firmaId, dosya, boyut ?? 0);
      await AdminLogSqlRepository.islemLogu({
        adminId: yapan?.adminId ?? null,
        islem: "YEDEK_ALINDI",
        hedefTur: "FIRMA",
        hedefId: firmaId,
        yeni: { dosya, boyut, sureMs: Date.now() - baslangic, zamanlayici: !yapan },
      });
    } catch (err: any) {
      const metin = yedekHataMetni(err);
      logger.error(`[YEDEK] ${firma.firmaKodu} yedeklenemedi: ${err?.message}`);
      await AdminLogSqlRepository.islemLogu({
        adminId: yapan?.adminId ?? null,
        islem: "YEDEK_ALINAMADI",
        hedefTur: "FIRMA",
        hedefId: firmaId,
        yeni: { dosya, hata: metin, zamanlayici: !yapan },
      });
      throw ApiError.badRequest(`Yedek alınamadı: ${metin}`);
    } finally {
      suruyor.delete(firmaId);
    }
    return FirmaService.getir(firmaId);
  }

  /** Yedeği indirmek için kısa ömürlü bağlantı (tarayıcı dosyayı belleğe almadan doğrudan indirir). */
  public static async indirmeBaglantisi(yapan: AdminBaglam, firmaId: number): Promise<{ yol: string; sonGecerlilik: Date }> {
    const firma = await FirmaService.getir(firmaId);
    const dosya = await BulutSqlRepository.yedekDosyasi(firmaId);
    if (!dosya) throw ApiError.notFound("Bu firmanın alınmış bir yedeği yok.");
    if (dosyaBoyutu(dosya) === null) throw ApiError.notFound("Yedek dosyası sunucuda bulunamadı veya okunamıyor.");

    const token = crypto.randomBytes(32).toString("base64url");
    const sonGecerlilik = await BulutSqlRepository.baglantiEkle({
      tokenHash: tokenOzeti(token),
      firmaId,
      tur: "YEDEK",
      dakika: YEDEK_INDIRME_DAKIKA,
      adminId: yapan.adminId,
    });
    await AdminLogSqlRepository.islemLogu({
      adminId: yapan.adminId,
      islem: "YEDEK_INDIRME_BAGLANTISI",
      hedefTur: "FIRMA",
      hedefId: firmaId,
      yeni: { firmaKodu: firma.firmaKodu, dosya: path.win32.basename(dosya), dakika: YEDEK_INDIRME_DAKIKA },
    });
    return { yol: `/indir/${token}`, sonGecerlilik };
  }

  /** Açık uç: bağlantıdaki anahtar geçerliyse yedek dosyasını akış olarak gönderir. */
  public static async indir(token: string, res: Response): Promise<void> {
    if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) throw ApiError.notFound("Bağlantı geçersiz veya süresi dolmuş.");
    const kayit = await BulutSqlRepository.baglantiKullan(tokenOzeti(token));
    if (!kayit || kayit.tur !== "YEDEK") throw ApiError.notFound("Bağlantı geçersiz veya süresi dolmuş.");
    const dosya = await BulutSqlRepository.yedekDosyasi(kayit.firmaId);
    const boyut = dosya ? dosyaBoyutu(dosya) : null;
    if (!dosya || boyut === null) throw ApiError.notFound("Yedek dosyası bulunamadı.");

    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Content-Length", String(boyut));
    res.setHeader("Content-Disposition", `attachment; filename="${path.win32.basename(dosya)}"`);
    res.setHeader("Cache-Control", "no-store");
    await new Promise<void>((tamam, hata) => {
      const akis = fs.createReadStream(dosya);
      akis.on("error", hata);
      res.on("close", () => {
        akis.destroy();
        tamam();
      });
      akis.pipe(res);
    });
  }
}
