import crypto from "crypto";
import fs from "fs";
import sql from "mssql";
import { Response } from "express";
import { env } from "../../config/env.config.js";
import { getAdminPool } from "../../config/adminDb.config.js";
import { KurulumSqlRepository } from "../../models/admin/kurulumSql.repository.js";
import { LisansSqlRepository } from "../../models/admin/lisansSql.repository.js";
import { AdminLogSqlRepository } from "../../models/admin/adminLogSql.repository.js";
import { ApiError } from "../../utils/ApiError.js";
import { HttpStatus } from "../../constants/httpStatusCodes.js";
import { logger } from "../../utils/logger.js";
import { firmaDosyasiUret } from "../kurulum/firmaDosyasi.js";
import { iletisimOku, lisansImzaAcikMi, lisansKoduHazirla } from "./lisansKod.service.js";
import { FirmaService } from "./firma.service.js";
import path from "path";
import { AyarSqlRepository } from "../../models/admin/ayarSql.repository.js";
import { BulutSqlRepository } from "../../models/admin/bulutSql.repository.js";
import { AdminBaglam } from "../../types/admin.types.js";
import { ZipYazici } from "../../utils/zip.js";
import { tokenOzeti } from "./yedek.service.js";
import { DestekOlay } from "../destek/destekOlay.js";

export const KURULUM_BAGLANTI_GUN = 7;
export const kurulumExeYolu = async (): Promise<string> =>
  path.join(await AyarSqlRepository.oku("SURUM_KLASORU"), "kurulum", "LikyaKuyumKurulum.exe");

const BENIOKU = (unvan: string, firmaKodu: string) =>
  [
    "LIKYA KUYUM - KURULUM",
    "",
    `Firma: ${unvan} (${firmaKodu})`,
    "",
    "1) Bu ZIP'in içindeki dosyaları bir klasöre çıkarın (LikyaKuyumKurulum.exe ve firma.lky aynı klasörde olmalı).",
    "2) LikyaKuyumKurulum.exe'yi sağ tıklayıp 'Yönetici olarak çalıştır' ile açın ve adımları izleyin.",
    "3) Kurulum bitince masaüstündeki 'Likya Kuyum' kısayolu programı açar.",
    "4) İlk açılışta ekranda bu bilgisayarın kimliği görünür. Lisans kodunuzu 'Lisans Yükle' alanına yapıştırın;",
    "   bilgisayar internete bağlıysa kodunuz verildiğinde kendiliğinden de yüklenir.",
    "5) Dükkândaki diğer bilgisayarlardan tarayıcıda http://<bu-bilgisayarın-adı>:5000 adresiyle girebilirsiniz.",
    "",
    "firma.lky dosyası firmanıza özeldir; başkasıyla paylaşmayın.",
  ].join("\r\n");

/**
 * Merkez sunucunun kurulum (exe) firmalarıyla konuştuğu taraf (docs/BULUT_VE_EXE_LISANS_YOL_HARITASI.md, K12, K14, K10):
 * - firma.lky üretimi (imzalı firma kimliği + kurulum anahtarı),
 * - bildirim (heartbeat): sürüm, makine, lisans durumu; dönüşte yeni lisans kodu ve hedef sürüm,
 * - sürüm paketinin indirilmesi.
 * Kurulum anahtarı saklanmaz: özel anahtardan HMAC ile türetilir, her bildirimde yeniden hesaplanıp karşılaştırılır.
 */

export interface HeartbeatGirdi {
  firmaKodu: string;
  kurulumAnahtari: string;
  makineKimligi?: string | null;
  surum?: string | null;
  lisans?: { durum?: string | null; neden?: string | null; seri?: number | null } | null;
  kullaniciSayisi?: number | null;
  semaSurumu?: number | null;
}

export interface GuncellemeBilgisi {
  surum: string;
  yol: string;
  sha256: string;
  imza: string;
  boyut: number;
}

export const kurulumAnahtariTuret = (firmaId: number, firmaKodu: string): string =>
  crypto.createHmac("sha256", env.LISANS_OZEL_ANAHTAR).update(`kurulum|${firmaId}|${firmaKodu}`).digest("base64url");

const anahtarDogru = (firmaId: number, firmaKodu: string, verilen: string): boolean => {
  const beklenen = Buffer.from(kurulumAnahtariTuret(firmaId, firmaKodu));
  const gelen = Buffer.from(String(verilen || ""));
  return beklenen.length === gelen.length && crypto.timingSafeEqual(beklenen, gelen);
};

/** Kurulum isteğini doğrular; firmayı döndürür. Yanlış anahtar / kurulum olmayan firma için aynı 401. */
export const kurulumuDogrula = async (firmaKodu: string, kurulumAnahtari: string) => {
  if (!lisansImzaAcikMi()) throw new ApiError(HttpStatus.SERVICE_UNAVAILABLE, "Merkez lisans anahtarı tanımlı değil.");
  const firma = await KurulumSqlRepository.firmaKoduIleBul(String(firmaKodu || "").toUpperCase());
  if (!firma || firma.baglantiModu !== "setup" || !anahtarDogru(firma.firmaId, firma.firmaKodu, kurulumAnahtari)) {
    throw ApiError.unauthorized("Kurulum tanınmadı.");
  }
  if (firma.durum === "SILINDI") throw ApiError.forbidden("Firma kaydı silinmiş.");
  return firma;
};

/** Hedef sürüm: firmaya sabitlenmiş sürüm, yoksa yayındaki en son sürüm. */
export const hedefSurum = async (sabit: string | null): Promise<GuncellemeBilgisi | null> => {
  const pool = await getAdminPool();
  const res = await pool
    .request()
    .input("surum", sql.VarChar(30), sabit)
    .query(`
      IF OBJECT_ID('dbo.ADM_SURUM') IS NULL SELECT TOP 0 1 AS YOK
      ELSE IF @surum IS NOT NULL SELECT SURUM, SHA256, IMZA, BOYUT FROM dbo.ADM_SURUM WHERE SURUM = @surum
      ELSE SELECT TOP 1 SURUM, SHA256, IMZA, BOYUT FROM dbo.ADM_SURUM WHERE AKTIF = 1 ORDER BY YAYIN_TARIHI DESC, SURUM DESC`);
  const r = res.recordset?.[0];
  if (!r || !r.SURUM) return null;
  return { surum: r.SURUM, yol: `/merkez/surum/${encodeURIComponent(r.SURUM)}`, sha256: r.SHA256, imza: r.IMZA, boyut: Number(r.BOYUT) };
};

export class MerkezKurulumService {
  /** Panel: kurulum paketine konacak firma.lky içeriği. */
  public static async firmaDosyasi(firmaId: number): Promise<{ dosyaAdi: string; icerik: string }> {
    if (!lisansImzaAcikMi()) {
      throw ApiError.badRequest("Bu sunucuda lisans imza anahtarı tanımlı değil (Backend klasöründe: npm run lisans-anahtar).");
    }
    const firma = await FirmaService.getir(firmaId);
    if (firma.baglantiModu !== "setup") throw ApiError.badRequest("Kurulum dosyası yalnız kurulum (exe) firmalarına verilir.");
    const icerik = firmaDosyasiUret(
      {
        v: 1,
        firmaId,
        firmaKodu: firma.firmaKodu,
        musteriNo: firma.musteriNo || "",
        unvan: firma.unvan,
        merkez: env.MERKEZ_ADRESI,
        kurulumAnahtari: kurulumAnahtariTuret(firmaId, firma.firmaKodu),
        verilme: new Date().toISOString(),
      },
      env.LISANS_OZEL_ANAHTAR
    );
    return { dosyaAdi: "firma.lky", icerik };
  }

  /** Panel: müşteriye gönderilecek, süreli (7 gün) kurulum indirme bağlantısı. */
  public static async kurulumBaglantisi(yapan: AdminBaglam, firmaId: number): Promise<{ adres: string; sonGecerlilik: Date }> {
    const firma = await FirmaService.getir(firmaId);
    if (firma.baglantiModu !== "setup") throw ApiError.badRequest("Kurulum bağlantısı yalnız kurulum (exe) firmalarına verilir.");
    if (!lisansImzaAcikMi()) throw ApiError.badRequest("Bu sunucuda lisans imza anahtarı tanımlı değil (npm run lisans-anahtar).");
    if (!fs.existsSync(await kurulumExeYolu())) throw ApiError.badRequest("Kurulum exe'si henüz üretilmemiş (Backend klasöründe: npm run kurulum:paketi).");
    const token = crypto.randomBytes(32).toString("base64url");
    const sonGecerlilik = await BulutSqlRepository.baglantiEkle({
      tokenHash: tokenOzeti(token),
      firmaId,
      tur: "KURULUM",
      dakika: KURULUM_BAGLANTI_GUN * 24 * 60,
      adminId: yapan.adminId,
    });
    await AdminLogSqlRepository.islemLogu({ adminId: yapan.adminId, islem: "KURULUM_BAGLANTISI", hedefTur: "FIRMA", hedefId: firmaId, yeni: { gun: KURULUM_BAGLANTI_GUN } });
    return { adres: `${env.MERKEZ_ADRESI.replace(/\/+$/, "")}/api/v1/merkez/kurulum/${token}`, sonGecerlilik };
  }

  /** Açık uç: kurulum exe'si + firma.lky + BENIOKU.txt tek ZIP olarak (akışla). */
  public static async kurulumIndir(token: string, res: Response): Promise<void> {
    if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) throw ApiError.notFound("Bağlantı geçersiz veya süresi dolmuş.");
    const kayit = await BulutSqlRepository.baglantiKullan(tokenOzeti(token));
    if (!kayit || kayit.tur !== "KURULUM") throw ApiError.notFound("Bağlantı geçersiz veya süresi dolmuş.");
    const firma = await FirmaService.getir(kayit.firmaId);
    if (firma.baglantiModu !== "setup" || firma.durum === "SILINDI") throw ApiError.notFound("Bağlantı geçersiz veya süresi dolmuş.");
    const exe = await kurulumExeYolu();
    if (!fs.existsSync(exe)) throw ApiError.notFound("Kurulum dosyası sunucuda bulunamadı.");
    const lky = await this.firmaDosyasi(firma.firmaId);

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="LikyaKuyum-${firma.firmaKodu}.zip"`);
    res.setHeader("Cache-Control", "no-store");
    const zip = new ZipYazici(res);
    await zip.veriEkle("BENIOKU.txt", Buffer.from("\ufeff" + BENIOKU(firma.unvan, firma.firmaKodu), "utf8"));
    await zip.veriEkle("firma.lky", Buffer.from(lky.icerik, "utf8"));
    await zip.dosyaEkle("LikyaKuyumKurulum.exe", exe);
    await zip.bitir();
  }

  public static async heartbeat(g: HeartbeatGirdi, ip: string | null) {
    const firma = await kurulumuDogrula(g.firmaKodu, g.kurulumAnahtari);
    const makine = g.makineKimligi && /^[0-9A-F]{4}(-[0-9A-F]{4}){3}$/.test(g.makineKimligi) ? g.makineKimligi : null;
    const oncekiSurum = (await FirmaService.getir(firma.firmaId)).surum;
    await KurulumSqlRepository.heartbeatYaz({
      firmaId: firma.firmaId,
      surum: g.surum ? String(g.surum).slice(0, 30) : null,
      makineKimligi: makine,
      lisansDurumu: g.lisans?.durum ? String(g.lisans.durum).slice(0, 20) : null,
      kilitNedeni: g.lisans?.neden ? String(g.lisans.neden).slice(0, 30) : null,
      kullaniciSayisi: Number.isInteger(g.kullaniciSayisi) ? g.kullaniciSayisi! : null,
      semaSurumu: Number.isInteger(g.semaSurumu) ? g.semaSurumu! : null,
      ip,
    });
    // Kurulum yeni sürümle geldi: firmanın ziline ve admin listesine düşer (K14)
    if (g.surum && oncekiSurum && oncekiSurum !== g.surum) DestekOlay.guncellemeKuruldu(firma.firmaId, oncekiSurum, String(g.surum).slice(0, 30));

    // Lisans: firma aktifse ve bu makine firmanın lisanslı makinesiyse, aktif lisansın kodu yoksa üretilir;
    // kurulumdaki seriden yeni bir kod varsa geri döner (uzatma elle kod girmeden iner)
    let lisansKodu: string | null = null;
    const guncel = await FirmaService.getir(firma.firmaId);
    if (makine && guncel.durum === "AKTIF" && guncel.makineKimligi === makine && guncel.aktifLisans) {
      try {
        const aktif = await LisansSqlRepository.getir(guncel.aktifLisans.lisansId);
        let son = await LisansSqlRepository.makineIcinSonKod(firma.firmaId, makine);
        if (aktif && !aktif.iptal && (!son || son.lisansId !== aktif.lisansId)) {
          const seri = await LisansSqlRepository.sonrakiSeri(firma.firmaId);
          const kod = await lisansKoduHazirla(aktif, guncel.firmaKodu, makine, seri);
          await LisansSqlRepository.kodYaz(aktif.lisansId, kod, makine, seri);
          await AdminLogSqlRepository.islemLogu({
            adminId: null,
            islem: "LISANS_KODU_URETILDI",
            hedefTur: "LISANS",
            hedefId: aktif.lisansId,
            yeni: { firmaId: firma.firmaId, makine, seri, kaynak: "HEARTBEAT" },
          });
          son = { lisansId: aktif.lisansId, kod, seri };
        }
        if (son && son.seri > Number(g.lisans?.seri ?? 0)) {
          lisansKodu = son.kod;
          await LisansSqlRepository.teslimYaz(son.lisansId);
        }
      } catch (err: any) {
        logger.error(`[MERKEZ] ${firma.firmaKodu} lisans kodu hazırlanamadı: ${err?.message}`);
      }
    }

    const hedef = await hedefSurum(firma.hedefSurum);
    return {
      sunucuZamani: new Date().toISOString(),
      iletisim: await iletisimOku(),
      lisansKodu,
      guncelleme: hedef && hedef.surum !== g.surum ? hedef : null,
    };
  }

  /** Kurulumun sürüm paketini indirmesi (kimlik: başlıklardaki firma kodu + kurulum anahtarı). */
  public static async surumIndir(surum: string, firmaKodu: string, kurulumAnahtari: string, res: Response): Promise<void> {
    await kurulumuDogrula(firmaKodu, kurulumAnahtari);
    const pool = await getAdminPool();
    const r = (
      await pool.request().input("s", sql.VarChar(30), surum).query(`SELECT DOSYA_YOLU, BOYUT FROM dbo.ADM_SURUM WHERE SURUM = @s`)
    ).recordset[0];
    if (!r) throw ApiError.notFound("Sürüm bulunamadı.");
    let boyut: number;
    try {
      boyut = fs.statSync(r.DOSYA_YOLU).size;
    } catch {
      throw ApiError.notFound("Sürüm paketi sunucuda bulunamadı.");
    }
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Length", String(boyut));
    res.setHeader("Cache-Control", "no-store");
    await new Promise<void>((tamam, hata) => {
      const akis = fs.createReadStream(r.DOSYA_YOLU);
      akis.on("error", hata);
      res.on("close", () => {
        akis.destroy();
        tamam();
      });
      akis.pipe(res);
    });
  }
}
