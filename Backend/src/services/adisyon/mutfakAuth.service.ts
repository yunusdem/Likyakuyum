import crypto from "node:crypto";
import jwt, { SignOptions } from "jsonwebtoken";
import { env } from "../../config/env.config.js";
import { HttpStatus } from "../../constants/httpStatusCodes.js";
import { ApiError } from "../../utils/ApiError.js";
import { DbBaglam } from "../../models/ticariStokSql.repository.js";
import { AdisyonMutfakSqlRepository } from "../../models/adisyonMutfakSql.repository.js";
import { GarsonAuthService } from "./garsonAuth.service.js";
import { cihazOzeti } from "./adisyonPin.js";

/**
 * Mutfak ekranı (KDS) girişi (docs/TICARI_ADISYON_YOL_HARITASI.md, TA30, D5): yöneticinin hazırlık yeri için ürettiği bağlantı
 * (müşteri no + anahtar). Lisans kullanıcısı ve garson hakkı harcamaz. Jeton yalnız o yerin kalemlerini görür / değiştirir;
 * anahtar yeniden üretilince ya da silinince eski jeton düşer (anahtar özetinin parmak izi). Firma çözümü garson girişiyle ortak.
 */
const gizi = (): string => crypto.createHmac("sha256", env.ADMIN_JWT_SECRET || env.JWT_ACCESS_SECRET).update("likya-adisyon-mutfak").digest("hex");
const parmak = (ozet: string) => crypto.createHash("sha256").update(ozet).digest("hex").slice(0, 16);
interface MutfakJwt { tur: "MUTFAK"; fid: number; yer: number; kv: string }
export interface MutfakBaglam { firmaId: number; ctx: DbBaglam; yerId: number; yer: string; kisaAd: string }

export const MutfakAuthService = {
  async giris(g: { musteriNo: string; anahtar: string }) {
    const ozet = cihazOzeti(String(g.anahtar || "").trim());
    for (const f of await GarsonAuthService.firmalar(g.musteriNo)) {
      const yer = await AdisyonMutfakSqlRepository.anahtarYeri(f.ctx, ozet);
      if (!yer) continue;
      const token = jwt.sign({ tur: "MUTFAK", fid: f.firmaId, yer: yer.yerId, kv: parmak(ozet) }, gizi(), { expiresIn: "30d" as SignOptions["expiresIn"] });
      return { token, yer: yer.ad, yerId: yer.yerId, kisaAd: f.kisaAd };
    }
    throw new ApiError(HttpStatus.UNAUTHORIZED, "Mutfak ekranı bağlantısı geçersiz (yenilenmiş ya da silinmiş olabilir). Yöneticiden yeni bağlantı isteyin.", { kod: "BAGLANTI_GECERSIZ" });
  },

  async baglam(token: string): Promise<MutfakBaglam> {
    let p: MutfakJwt;
    try { p = jwt.verify(token, gizi()) as MutfakJwt; } catch { throw ApiError.unauthorized("Mutfak ekranı oturumu geçersiz. Bağlantıyı yeniden açın."); }
    if (p?.tur !== "MUTFAK" || !Number.isInteger(p.yer)) throw ApiError.unauthorized("Geçersiz oturum.");
    const f = await GarsonAuthService.firma(Number(p.fid));
    if (!f) throw new ApiError(HttpStatus.FORBIDDEN, "Firma Adisyon'a açık değil.", { kod: "MODUL_KAPALI" });
    const pool = await (await import("../../models/adisyonTanimSql.repository.js")).AdisyonTanimSqlRepository.havuz(f.ctx);
    const r = await pool.request().input("Y", p.yer).query(`SELECT RTRIM(AD) AS AD, EKRAN_ANAHTAR_OZET, AKTIF, EKRAN FROM dbo.TODVZ_ADISYON_HAZIRLIK WHERE YER_ID = @Y`);
    const y = r.recordset[0];
    if (!y || !y.AKTIF || !y.EKRAN || !y.EKRAN_ANAHTAR_OZET || parmak(String(y.EKRAN_ANAHTAR_OZET)) !== p.kv) throw ApiError.unauthorized("Bu mutfak ekranı bağlantısı yenilenmiş ya da kapatılmış.");
    return { firmaId: f.firmaId, ctx: f.ctx, yerId: p.yer, yer: String(y.AD), kisaAd: f.kisaAd };
  },
};
