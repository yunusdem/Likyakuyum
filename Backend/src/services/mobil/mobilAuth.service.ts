import crypto from "crypto";
import jwt, { SignOptions } from "jsonwebtoken";
import { env } from "../../config/env.config.js";
import { HttpStatus, HttpStatusCode } from "../../constants/httpStatusCodes.js";
import { AdminLogSqlRepository } from "../../models/admin/adminLogSql.repository.js";
import { FirmaSqlRepository } from "../../models/admin/firmaSql.repository.js";
import { MobilSqlRepository } from "../../models/admin/mobilSql.repository.js";
import { MobilErisimSatiri, MobilKullaniciKaydi, MobilKullaniciSqlRepository } from "../../models/admin/mobilKullaniciSql.repository.js";
import { MobilBaglam, MobilJwtPayload, MobilVeritabaniSecenegi } from "../../types/mobil.types.js";
import { ApiError } from "../../utils/ApiError.js";
import { sahteSifreDogrula, sifreDogrula, sifreHashle, sifreKuralHatasi } from "../../utils/sifre.utils.js";
import { musteriNoTemizle } from "../merkezGiris.service.js";
import { mobilFirmaBaglami, mobilFirmaDurumu } from "./mobilFirma.js";
import { kullaniciAdiTemizle } from "./mobilKural.js";

/**
 * Mobil cari girişi (docs/MOBIL_CARI_YOL_HARITASI.md K3, K9, K23, V3): müşteri no + mobil kullanıcı adı + şifre.
 * 5 hatalı denemede 15 dk kilit; ilk girişte (ya da sıfırlamadan sonra) şifre değiştirilmeden başka işlem yapılamaz.
 * Kullanıcının birden çok veritabanına erişimi varsa üstten geçiş yapar (K25); token seçili veritabanını taşır.
 */

export const MOBIL_HATALI_ESIK = 5;
export const MOBIL_KILIT_DAKIKA = 15;
const GIRIS_HATASI = "Müşteri no, kullanıcı adı veya şifre hatalı.";

/** Ayrı giz verilmediyse admin gizinden türetilir: başka panellerin token'ı mobile, mobil token'ı onlara geçmez */
const gizi = (): string => env.MOBIL_JWT_SECRET || crypto.createHmac("sha256", env.ADMIN_JWT_SECRET).update("likya-mobil-cari").digest("hex");

export const mobilTokenUret = (p: Omit<MobilJwtPayload, "iat" | "exp" | "tur">): string =>
  jwt.sign({ tur: "MOBIL", ...p }, gizi(), { expiresIn: env.MOBIL_JWT_EXPIRES_IN as SignOptions["expiresIn"] });

export const mobilTokenDogrula = (token: string): MobilJwtPayload => {
  const p = jwt.verify(token, gizi()) as MobilJwtPayload;
  if (p?.tur !== "MOBIL" || !p.sid || !Number.isInteger(p.mk)) throw ApiError.unauthorized("Geçersiz oturum.");
  return p;
};

export interface MobilGirisYaniti {
  token: string;
  kullanici: { kullaniciAdi: string; adSoyad: string | null; musteriNo: string; sifreDegismeli: boolean };
  veritabanlari: MobilVeritabaniSecenegi[];
  seciliFirmaId: number | null;
}

type Istemci = { ip: string; tarayici: string };

export class MobilAuthService {
  /** Giriş ekranı: müşteri no geçerli mi; geçerliyse soldaki kısa ad (marka). Veritabanı listesi girişten önce verilmez. */
  public static async girisBilgisi(musteriNo: string): Promise<{ musteriNo: string; kisaAd: string }> {
    await MobilSqlRepository.semaGerekli();
    const no = musteriNoTemizle(musteriNo);
    // Aynı müşteri noda birden çok veritabanı olabilir: giriş ekranının markası ilk kaydedilen (en küçük kimlikli)
    // kullanılabilir firmanın kısa adıdır (sıra ünvana göre değişmesin). Girişten sonra seçili veritabanınınki görünür.
    const liste = (no ? await FirmaSqlRepository.musteriNoIleListele(no) : []).sort((a, b) => a.firmaId - b.firmaId);
    for (const f of liste) {
      const d = await mobilFirmaDurumu(f.firmaId);
      if (d?.kullanilabilir) return { musteriNo: no, kisaAd: d.kisaAd };
    }
    throw ApiError.notFound("Müşteri no bulunamadı ya da mobil erişime açık değil.");
  }

  /** Kullanıcının girebileceği veritabanları: aktif erişim + kullanılabilir firma */
  public static async veritabanlari(mobilKullaniciId: number): Promise<{ secenek: MobilVeritabaniSecenegi; erisim: MobilErisimSatiri }[]> {
    const erisimler = (await MobilKullaniciSqlRepository.kullaniciErisimleri(mobilKullaniciId)).filter((e) => e.durum === "AKTIF");
    const sonuc: { secenek: MobilVeritabaniSecenegi; erisim: MobilErisimSatiri }[] = [];
    for (const e of erisimler) {
      const d = await mobilFirmaDurumu(e.firmaId);
      if (d?.kullanilabilir) sonuc.push({ secenek: { firmaId: e.firmaId, kisaAd: d.kisaAd, unvan: d.firma.unvan, cariAd: e.cariAd }, erisim: e });
    }
    return sonuc;
  }

  private static async yanit(k: MobilKullaniciKaydi, sid: string, istenenFirmaId: number | null): Promise<MobilGirisYaniti> {
    const vt = await this.veritabanlari(k.mobilKullaniciId);
    // Şifre değişmeden veritabanı seçilmez; tek veritabanı varsa kendiliğinden seçilir, istenen geçerliyse o
    const secili = k.sifreDegismeli ? null : vt.find((v) => v.secenek.firmaId === istenenFirmaId)?.secenek.firmaId ?? (vt.length === 1 ? vt[0].secenek.firmaId : vt[0]?.secenek.firmaId ?? null);
    return {
      token: mobilTokenUret({ mk: k.mobilKullaniciId, sid, fid: secili }),
      kullanici: { kullaniciAdi: k.kullaniciAdi, adSoyad: k.adSoyad, musteriNo: k.musteriNo, sifreDegismeli: k.sifreDegismeli },
      veritabanlari: vt.map((v) => v.secenek),
      seciliFirmaId: secili,
    };
  }

  public static async giris(g: { musteriNo: string; kullaniciAdi: string; sifre: string }, istemci: Istemci): Promise<MobilGirisYaniti> {
    await MobilSqlRepository.semaGerekli();
    const no = musteriNoTemizle(g.musteriNo);
    const ad = kullaniciAdiTemizle(g.kullaniciAdi);
    const sifre = String(g.sifre ?? "");
    const kayitAdi = `${no}/${ad}`.slice(0, 100);

    const reddet = async (neden: string, mesaj = GIRIS_HATASI, durum: number = HttpStatus.UNAUTHORIZED, kod?: string): Promise<never> => {
      const d = durum as HttpStatusCode;
      await AdminLogSqlRepository.girisLogu({ tur: "MOBIL", kullaniciAdi: kayitAdi, basarili: false, redNedeni: neden, ...istemci });
      throw new ApiError(d, mesaj, kod ? { kod } : undefined);
    };

    const k = no && ad ? await MobilKullaniciSqlRepository.kullaniciAdiIleBul(no, ad) : null;
    if (!k) {
      await sahteSifreDogrula(sifre);
      return reddet("Kullanıcı bulunamadı");
    }
    if (k.kilitli) {
      await sahteSifreDogrula(sifre);
      return reddet("Hesap kilitli", `Çok fazla hatalı deneme. Hesabınız ${MOBIL_KILIT_DAKIKA} dakika kilitlendi; firmanız şifrenizi sıfırlayarak açabilir.`, 423, "KILITLI");
    }
    if (!(await sifreDogrula(sifre, k.sifreOzet))) {
      const kilitlendi = await MobilKullaniciSqlRepository.hataliGiris(k.mobilKullaniciId, MOBIL_HATALI_ESIK, MOBIL_KILIT_DAKIKA);
      return kilitlendi
        ? reddet("Hatalı şifre, kilitlendi", `Çok fazla hatalı deneme. Hesabınız ${MOBIL_KILIT_DAKIKA} dakika kilitlendi; firmanız şifrenizi sıfırlayarak açabilir.`, 423, "KILITLI")
        : reddet("Hatalı şifre");
    }
    if (k.durum !== "AKTIF") return reddet("Kullanıcı pasif", "Mobil hesabınız kapatılmış. Firmanızla görüşün.", HttpStatus.FORBIDDEN, "PASIF");
    const vt = await this.veritabanlari(k.mobilKullaniciId);
    if (vt.length === 0) return reddet("Erişim yok", "Mobil erişiminiz şu an açık değil. Firmanızla görüşün.", HttpStatus.FORBIDDEN, "ERISIM_YOK");

    await MobilKullaniciSqlRepository.basariliGiris(k.mobilKullaniciId);
    const sid = await MobilKullaniciSqlRepository.oturumAc(k.mobilKullaniciId, istemci.ip, istemci.tarayici);
    await AdminLogSqlRepository.girisLogu({ tur: "MOBIL", firmaId: vt[0].secenek.firmaId, kullaniciAdi: kayitAdi, basarili: true, ...istemci });
    return this.yanit(k, sid, null);
  }

  /** Her istekte: oturum açık mı, kullanıcı aktif mi, seçili veritabanında erişim sürüyor mu */
  public static async baglam(token: string): Promise<MobilBaglam> {
    await MobilSqlRepository.semaGerekli();
    const p = mobilTokenDogrula(token);
    const k = await MobilKullaniciSqlRepository.gecerliOturum(p.sid, p.mk);
    if (!k) throw ApiError.unauthorized("Oturumunuz sonlandırılmış. Lütfen tekrar giriş yapınız.");
    const bos: MobilBaglam = { sid: p.sid, kullanici: k, erisim: null, firma: null, ctx: null };
    if (k.sifreDegismeli || !p.fid) return bos;
    // Seçili veritabanında erişim kapandıysa oturum sürer ama veritabanı seçilmemiş sayılır: kullanıcı başkasını seçer
    const erisim = (await MobilKullaniciSqlRepository.kullaniciErisimleri(k.mobilKullaniciId)).find((e) => e.firmaId === p.fid && e.durum === "AKTIF");
    if (!erisim) return { ...bos, uyari: "Bu hesaptaki erişiminiz kapatılmış." };
    const d = await mobilFirmaDurumu(p.fid);
    if (!d?.kullanilabilir) return { ...bos, uyari: d?.neden || "Firma bulunamadı." };
    return { ...bos, erisim, firma: d.firma, ctx: await mobilFirmaBaglami(p.fid) };
  }

  public static async ben(b: MobilBaglam) {
    const vt = await this.veritabanlari(b.kullanici.mobilKullaniciId);
    const secili = b.firma ? await mobilFirmaDurumu(b.firma.firmaId) : null;
    return {
      kullanici: { kullaniciAdi: b.kullanici.kullaniciAdi, adSoyad: b.kullanici.adSoyad, musteriNo: b.kullanici.musteriNo, sifreDegismeli: b.kullanici.sifreDegismeli },
      veritabanlari: vt.map((v) => v.secenek),
      seciliFirmaId: b.firma?.firmaId ?? null,
      kisaAd: secili?.kisaAd ?? vt[0]?.secenek.kisaAd ?? "Likya",
      unvan: b.firma?.unvan ?? null,
      cari: b.erisim ? { kod: b.erisim.cariKod, ad: b.erisim.cariAd } : null,
      yetkiler: b.erisim?.yetkiler ?? null,
      uyari: b.uyari ?? null,
    };
  }

  /** Üstten veritabanı geçişi (K25): yeni token */
  public static async veritabaniSec(b: MobilBaglam, firmaId: number): Promise<MobilGirisYaniti> {
    if (b.kullanici.sifreDegismeli) throw new ApiError(HttpStatus.FORBIDDEN, "Önce şifrenizi değiştirin.", { kod: "SIFRE_DEGISMELI" });
    const vt = await this.veritabanlari(b.kullanici.mobilKullaniciId);
    if (!vt.some((v) => v.secenek.firmaId === firmaId)) throw ApiError.forbidden("Bu veritabanına erişiminiz yok.");
    return this.yanit(b.kullanici, b.sid, firmaId);
  }

  /** İlk girişte zorunlu, sonra isteğe bağlı şifre değişimi (K9). Bu oturum dışındakiler kapanır. */
  public static async sifreDegistir(b: MobilBaglam, g: { mevcutSifre: string; yeniSifre: string }): Promise<MobilGirisYaniti> {
    const k = b.kullanici;
    if (!(await sifreDogrula(String(g.mevcutSifre ?? ""), k.sifreOzet))) throw ApiError.badRequest("Mevcut şifre hatalı.");
    const yeni = String(g.yeniSifre ?? "");
    const kural = sifreKuralHatasi(yeni);
    if (kural) throw ApiError.badRequest(kural);
    if (yeni === g.mevcutSifre) throw ApiError.badRequest("Yeni şifre eskisiyle aynı olamaz.");
    if (yeni.toLowerCase().includes(k.kullaniciAdi.toLowerCase())) throw ApiError.badRequest("Şifre kullanıcı adını içeremez.");
    await MobilKullaniciSqlRepository.sifreDegistir(k.mobilKullaniciId, await sifreHashle(yeni), b.sid);
    return this.yanit({ ...k, sifreDegismeli: false }, b.sid, b.firma?.firmaId ?? null);
  }

  public static async cikis(b: MobilBaglam): Promise<void> {
    await MobilKullaniciSqlRepository.oturumKapat(b.sid, "CIKIS");
  }
}
