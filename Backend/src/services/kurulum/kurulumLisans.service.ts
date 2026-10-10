import crypto from "crypto";
import fs from "fs";
import sql from "mssql";
import { ApiError } from "../../utils/ApiError.js";
import { HttpStatus } from "../../constants/httpStatusCodes.js";
import { logger } from "../../utils/logger.js";
import { bugunTr, gunFarki } from "../../utils/zaman.utils.js";
import { LisansIletisim, LisansKoduGecersiz, LisansVerisi, lisansKoduCoz } from "../lisans/lisansKodu.js";
import { makineKimligi } from "../lisans/makineKimligi.js";
import { kurulumFirmasi, firmaDosyasiHatasi, veriYolu } from "./firmaDosyasi.js";
import { kurulumHavuzu } from "./kurulumDb.js";
import { butunlukHatasi } from "./butunluk.js";

/**
 * Kurulum (exe) modunda çevrimdışı lisans denetimi (docs/BULUT_VE_EXE_LISANS_YOL_HARITASI.md, 6.5 · K8, K15).
 *
 * Lisans kodu ve durum (son görülen zaman, kilit) iki yerde tutulur: veri klasöründeki dosyalar ve firma
 * veritabanındaki LKY_DURUM tablosu. Durum, makine kimliğinden türetilen anahtarla AES-256-GCM şifrelidir; elle
 * değiştirilirse çözülemez ve program kilitlenir. Saat geri alınırsa (son görülen zamandan ya da veritabanındaki en
 * son kayıttan geriye) program kilitlenir; bu kilidi yalnız merkezden alınacak YENİ bir lisans kodu açar.
 */

export type KilitNedeni =
  | "LISANS_YOK"
  | "LISANS_GECERSIZ"
  | "FIRMA_UYUSMUYOR"
  | "MAKINE_UYUSMUYOR"
  | "SAAT_GERI_ALINDI"
  | "LISANS_DOLDU"
  | "DURUM_BOZUK"
  | "FIRMA_DOSYASI_YOK"
  | "BUTUNLUK_BOZUK";

export interface KurulumLisansDurumu {
  durum: "GECERLI" | "UYARI" | "KILITLI";
  neden: KilitNedeni | null;
  mesaj: string | null;
  makineKimligi: string;
  firmaKodu: string | null;
  firmaUnvan: string | null;
  musteriNo: string | null;
  bitis: string | null;
  kalanGun: number | null;
  kullaniciLimiti: number | null;
  moduller: string[] | null;
  /** Lisanstaki ürün paketleri (docs/LISANS_URUN_PAKETLERI.md) */
  urunler: string[] | null;
  seri: number | null;
  iletisim: LisansIletisim;
}

export const KILIT_MESAJI: Record<KilitNedeni, string> = {
  LISANS_YOK: "Bu kurulum için lisans yüklenmemiş.",
  LISANS_GECERSIZ: "Yüklü lisans doğrulanamadı.",
  FIRMA_UYUSMUYOR: "Yüklü lisans bu firmaya ait değil.",
  MAKINE_UYUSMUYOR: "Lisans başka bir bilgisayara verilmiş. Bilgisayar değiştiyse yeni lisans almanız gerekir.",
  SAAT_GERI_ALINDI: "Bilgisayarın tarihi/saati geri alındığı için program kilitlendi.",
  LISANS_DOLDU: "Lisans süreniz doldu.",
  DURUM_BOZUK: "Lisans kayıtları değiştirilmiş veya silinmiş olduğu için program kilitlendi.",
  FIRMA_DOSYASI_YOK: "Kurulumun firma dosyası (firma.lky) bulunamadı veya bozuk. Programı yeniden kurun.",
  BUTUNLUK_BOZUK: "Program dosyaları değiştirilmiş veya bozulmuş. Programı yeniden kurun ya da bizimle iletişime geçin.",
};

export const UYARI_GUN = 30;
const SAAT_TOLERANS_MS = 5 * 60 * 1000;
const KAYIT_TOLERANS_MS = 24 * 60 * 60 * 1000;
const MERKEZ_SAAT_TOLERANS_MS = 2 * 24 * 60 * 60 * 1000;
const ONBELLEK_MS = 60 * 1000;
const KAYIT_ONBELLEK_MS = 10 * 60 * 1000;

const VARSAYILAN_ILETISIM: LisansIletisim = {
  telefon: "",
  eposta: "",
  metin: "Programı kullanmaya devam etmek için lütfen bizimle iletişime geçin.",
};

interface Durum {
  /** En son görülen gerçek zaman (ms) */
  sonGorulen: number;
  /** Yüklü lisansın serisi */
  seri: number;
  kilit: { neden: KilitNedeni; zaman: number; seri: number } | null;
}

// ------------------------------------------------------------------ test kancaları ---
let saat: () => number = () => Date.now();
let makine: () => string = makineKimligi;
/** Yalnız testler: saat ve makine kimliği kaynağını değiştirir. */
export const kurulumTestKancalari = (k: { saat?: () => number; makine?: () => string }) => {
  if (k.saat) saat = k.saat;
  if (k.makine) makine = k.makine;
  onbellek = null;
  kayitOnbellek = null;
};

// ------------------------------------------------------------------ şifreleme ---
const durumAnahtari = (): Buffer => crypto.createHash("sha256").update(`likya-durum|${makine()}`).digest();

export const durumSifrele = (d: Durum): string => {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", durumAnahtari(), iv);
  const govde = Buffer.concat([c.update(JSON.stringify(d), "utf8"), c.final()]);
  return `LKD1.${iv.toString("base64url")}.${govde.toString("base64url")}.${c.getAuthTag().toString("base64url")}`;
};

/** Çözülemezse null (değiştirilmiş ya da başka makinenin dosyası). */
export const durumCoz = (metin: string): Durum | null => {
  try {
    const [onek, iv, govde, etiket] = metin.trim().split(".");
    if (onek !== "LKD1") return null;
    const d = crypto.createDecipheriv("aes-256-gcm", durumAnahtari(), Buffer.from(iv, "base64url"));
    d.setAuthTag(Buffer.from(etiket, "base64url"));
    const acik = Buffer.concat([d.update(Buffer.from(govde, "base64url")), d.final()]).toString("utf8");
    const v = JSON.parse(acik);
    if (typeof v.sonGorulen !== "number" || typeof v.seri !== "number") return null;
    return v as Durum;
  } catch {
    return null;
  }
};

// ------------------------------------------------------------------ depolama ---
const dosyaOku = (ad: string): string | null => {
  try {
    return fs.readFileSync(veriYolu(ad), "utf8");
  } catch {
    return null;
  }
};
const dosyaYaz = (ad: string, icerik: string): void => {
  fs.mkdirSync(veriYolu(""), { recursive: true });
  const gecici = veriYolu(`${ad}.yeni`);
  fs.writeFileSync(gecici, icerik, "utf8");
  fs.renameSync(gecici, veriYolu(ad));
};

const tabloHazirla = async (pool: sql.ConnectionPool) => {
  await pool.request().batch(`
    IF OBJECT_ID('dbo.LKY_DURUM') IS NULL
      CREATE TABLE dbo.LKY_DURUM (ANAHTAR varchar(50) NOT NULL PRIMARY KEY, DEGER nvarchar(max) NULL, TARIH datetime NOT NULL DEFAULT GETDATE());`);
};

const dbOku = async (): Promise<{ lisans: string | null; durum: string | null }> => {
  const pool = await kurulumHavuzu();
  await tabloHazirla(pool);
  const res = await pool.request().query(`SELECT ANAHTAR, DEGER FROM dbo.LKY_DURUM WHERE ANAHTAR IN ('LISANS', 'DURUM')`);
  const m = new Map<string, string>((res.recordset as any[]).map((r) => [r.ANAHTAR, r.DEGER]));
  return { lisans: m.get("LISANS") ?? null, durum: m.get("DURUM") ?? null };
};

const dbYaz = async (anahtar: "LISANS" | "DURUM", deger: string): Promise<void> => {
  const pool = await kurulumHavuzu();
  await tabloHazirla(pool);
  await pool
    .request()
    .input("a", sql.VarChar(50), anahtar)
    .input("d", sql.NVarChar(sql.MAX), deger)
    .query(`
      MERGE dbo.LKY_DURUM WITH (HOLDLOCK) AS h USING (SELECT @a AS ANAHTAR) AS k ON h.ANAHTAR = k.ANAHTAR
      WHEN MATCHED THEN UPDATE SET DEGER = @d, TARIH = GETDATE()
      WHEN NOT MATCHED THEN INSERT (ANAHTAR, DEGER) VALUES (@a, @d);`);
};

const durumuKaydet = async (d: Durum): Promise<void> => {
  const metin = durumSifrele(d);
  dosyaYaz("durum.lky", metin);
  await dbYaz("DURUM", metin);
};

/** Veritabanındaki en son kaydın zamanı (saat geri alma denetimi için). */
let kayitOnbellek: { zaman: number; deger: number | null } | null = null;
const enSonKayitZamani = async (): Promise<number | null> => {
  if (kayitOnbellek && saat() - kayitOnbellek.zaman < KAYIT_ONBELLEK_MS && saat() >= kayitOnbellek.zaman) return kayitOnbellek.deger;
  let deger: number | null = null;
  try {
    const pool = await kurulumHavuzu();
    const parcalar = ["TODVZ_FIS", "TODVZ_SARRAF_FISI", "TODVZ_CARI_HAREKET", "TODVZ_HESAP_HAREKETI"]
      .map((t) => `SELECT MAX(EKLEME_ZAMANI) AS Z FROM dbo.${t} WHERE COL_LENGTH('dbo.${t}', 'EKLEME_ZAMANI') IS NOT NULL`)
      .join(" UNION ALL ");
    const res = await pool.request().query(`SELECT MAX(Z) AS Z FROM (${parcalar}) x`);
    const z = res.recordset[0]?.Z;
    deger = z ? new Date(z).getTime() : null;
  } catch (err: any) {
    logger.warn(`[LISANS] Son kayıt zamanı okunamadı: ${err?.message}`);
  }
  kayitOnbellek = { zaman: saat(), deger };
  return deger;
};

// ------------------------------------------------------------------ servis ---
let onbellek: { zaman: number; deger: KurulumLisansDurumu } | null = null;

const kalanGunHesapla = (bitis: string): number => gunFarki(bugunTr(new Date(saat())), bitis);

export class KurulumLisansService {
  public static onbellegiTemizle(): void {
    onbellek = null;
  }

  /** Geçerli lisans durumu (60 sn önbellekli). Her çağrıda saat ilerlemesini kaydeder, geri alınmışsa kilitler. */
  public static async durum(zorla = false): Promise<KurulumLisansDurumu> {
    const simdi = saat();
    if (!zorla && onbellek && simdi - onbellek.zaman < ONBELLEK_MS && simdi >= onbellek.zaman) return onbellek.deger;
    const deger = await this.hesapla(simdi);
    onbellek = { zaman: simdi, deger };
    return deger;
  }

  private static async hesapla(simdi: number): Promise<KurulumLisansDurumu> {
    const firma = kurulumFirmasi();
    let mk = "";
    try {
      mk = makine();
    } catch {
      mk = "";
    }
    const taban = (v: Partial<KurulumLisansDurumu> = {}): KurulumLisansDurumu => ({
      durum: "KILITLI",
      neden: null,
      mesaj: null,
      makineKimligi: mk,
      firmaKodu: firma?.firmaKodu ?? null,
      firmaUnvan: firma?.unvan ?? null,
      musteriNo: firma?.musteriNo ?? null,
      bitis: null,
      kalanGun: null,
      kullaniciLimiti: null,
      moduller: null,
      urunler: null,
      seri: null,
      iletisim: VARSAYILAN_ILETISIM,
      ...v,
    });
    const kilit = (neden: KilitNedeni, v: Partial<KurulumLisansDurumu> = {}) =>
      taban({ ...v, durum: "KILITLI", neden, mesaj: KILIT_MESAJI[neden] });

    if (!firma) return kilit("FIRMA_DOSYASI_YOK", { mesaj: `${KILIT_MESAJI.FIRMA_DOSYASI_YOK} (${firmaDosyasiHatasi()})` });
    const bozukluk = await butunlukHatasi();
    if (bozukluk) return kilit("BUTUNLUK_BOZUK");

    // Lisans kodu: dosya ve veritabanı; serisi büyük olan geçerlidir
    const db = await dbOku();
    const adaylar = [dosyaOku("lisans.lky"), db.lisans].filter((x): x is string => !!x && !!x.trim());
    if (adaylar.length === 0) return kilit("LISANS_YOK");
    let lisans: LisansVerisi | null = null;
    for (const a of adaylar) {
      try {
        const v = lisansKoduCoz(a);
        if (!lisans || v.seri > lisans.seri) lisans = v;
      } catch {
        // geçersiz aday atlanır
      }
    }
    if (!lisans) return kilit("LISANS_GECERSIZ");
    const bilgi: Partial<KurulumLisansDurumu> = {
      bitis: lisans.bitis,
      kalanGun: kalanGunHesapla(lisans.bitis),
      kullaniciLimiti: lisans.kullaniciLimiti,
      moduller: lisans.moduller,
      urunler: lisans.urunler ?? null,
      seri: lisans.seri,
      iletisim: lisans.iletisim || VARSAYILAN_ILETISIM,
    };
    if (lisans.firmaKodu !== firma.firmaKodu) return kilit("FIRMA_UYUSMUYOR", bilgi);
    if (!mk || lisans.makine !== mk) return kilit("MAKINE_UYUSMUYOR", bilgi);

    // Durum: iki kopya birleştirilir; biri bile değiştirilmişse kilit
    const kopyalar = [dosyaOku("durum.lky"), db.durum].filter((x): x is string => !!x && !!x.trim());
    const cozulen = kopyalar.map(durumCoz);
    if (kopyalar.length === 0 || cozulen.some((d) => d === null)) {
      const d: Durum = { sonGorulen: simdi, seri: lisans.seri, kilit: { neden: "DURUM_BOZUK", zaman: simdi, seri: lisans.seri } };
      await durumuKaydet(d).catch(() => undefined);
      return kilit("DURUM_BOZUK", bilgi);
    }
    const d: Durum = {
      sonGorulen: Math.max(...cozulen.map((x) => x!.sonGorulen)),
      seri: Math.max(...cozulen.map((x) => x!.seri)),
      kilit: cozulen.map((x) => x!.kilit).find((k) => !!k) ?? null,
    };
    if (d.kilit) return kilit(d.kilit.neden, bilgi);

    // Saat denetimi
    const sonKayit = await enSonKayitZamani();
    if (simdi < d.sonGorulen - SAAT_TOLERANS_MS || (sonKayit !== null && simdi < sonKayit - KAYIT_TOLERANS_MS)) {
      d.kilit = { neden: "SAAT_GERI_ALINDI", zaman: simdi, seri: lisans.seri };
      await durumuKaydet(d);
      logger.warn("[LISANS] Saat geri alınmış; program kilitlendi.");
      return kilit("SAAT_GERI_ALINDI", bilgi);
    }
    if (simdi - d.sonGorulen > 60_000 || kopyalar.length < 2) {
      d.sonGorulen = Math.max(d.sonGorulen, simdi);
      await durumuKaydet(d);
    }

    const kalan = bilgi.kalanGun!;
    if (kalan < 0) return kilit("LISANS_DOLDU", bilgi);
    return taban({ ...bilgi, durum: kalan <= UYARI_GUN ? "UYARI" : "GECERLI" });
  }

  /** "Lisans Yükle": kod doğrulanır, bu firma ve bu makine için olmalı, eskisinden yeni olmalı. */
  public static async yukle(kod: string): Promise<KurulumLisansDurumu> {
    const firma = kurulumFirmasi();
    if (!firma) throw ApiError.badRequest(KILIT_MESAJI.FIRMA_DOSYASI_YOK);
    let v: LisansVerisi;
    try {
      v = lisansKoduCoz(kod);
    } catch (err) {
      throw ApiError.badRequest(err instanceof LisansKoduGecersiz ? err.message : "Lisans kodu doğrulanamadı.");
    }
    const mk = makine();
    if (v.firmaKodu !== firma.firmaKodu) throw ApiError.badRequest("Bu lisans kodu başka bir firmaya ait.");
    if (v.makine !== mk) {
      throw ApiError.badRequest(`Bu lisans kodu başka bir bilgisayar için üretilmiş. Bu bilgisayarın kimliği: ${mk}`);
    }
    const simdi = saat();
    const verilme = Date.parse(v.verilme);
    if (Number.isFinite(verilme) && verilme > simdi + KAYIT_TOLERANS_MS) {
      throw ApiError.badRequest("Bilgisayarın tarihi/saati yanlış (lisans kodundan daha eski). Saati düzeltip tekrar deneyin.");
    }
    if (gunFarki(bugunTr(new Date(simdi)), v.bitis) < 0) throw ApiError.badRequest("Bu lisans kodunun süresi dolmuş.");

    // Mevcut durum
    const db = await dbOku();
    const eskiKodlar = [dosyaOku("lisans.lky"), db.lisans].filter((x): x is string => !!x);
    let eskiSeri = 0;
    for (const k of eskiKodlar) {
      try {
        const e = lisansKoduCoz(k);
        if (e.firmaKodu === firma.firmaKodu) eskiSeri = Math.max(eskiSeri, e.seri);
      } catch {
        /* yok say */
      }
    }
    if (v.seri < eskiSeri) throw ApiError.badRequest("Bu kod, yüklü lisanstan daha eski. En son verilen kodu yükleyin.");

    const kopyalar = [dosyaOku("durum.lky"), db.durum].filter((x): x is string => !!x && !!x.trim()).map(durumCoz);
    const gecerli = kopyalar.filter((x): x is Durum => !!x);
    const eskiKilit = gecerli.map((x) => x.kilit).find((k) => !!k) ?? (kopyalar.some((x) => x === null) ? { neden: "DURUM_BOZUK" as KilitNedeni, zaman: simdi, seri: eskiSeri } : null);
    // Kilit (saat / bozuk durum) yalnız kilitlendiği andaki seriden YENİ bir kodla açılır; süre dolması yeni bitişle açılır
    if (eskiKilit && eskiKilit.neden !== "LISANS_DOLDU" && v.seri <= eskiKilit.seri) {
      throw ApiError.badRequest("Program kilitli. Kilidi açmak için merkezden YENİ bir lisans kodu almanız gerekir.");
    }

    const sonGorulen = Math.max(simdi, Number.isFinite(verilme) ? verilme : 0, ...gecerli.map((x) => x.sonGorulen));
    const temizKod = kod.replace(/\s+/g, "");
    dosyaYaz("lisans.lky", temizKod);
    await dbYaz("LISANS", temizKod);
    await durumuKaydet({ sonGorulen, seri: v.seri, kilit: null });
    this.onbellegiTemizle();
    kayitOnbellek = null;
    return this.durum(true);
  }

  /**
   * Merkezden alınan saatle karşılaştırma (internet varken): bilgisayarın saati merkezden 2 günden fazla gerideyse
   * program kilitlenir (çevrimdışı denetimden kaçmak için saat geri alınmış olabilir).
   */
  public static async merkezSaatiniDenetle(sunucuMs: number): Promise<boolean> {
    if (!Number.isFinite(sunucuMs)) return false;
    const simdi = saat();
    if (simdi >= sunucuMs - MERKEZ_SAAT_TOLERANS_MS) return false;
    const db = await dbOku();
    let seri = 0;
    for (const k of [dosyaOku("lisans.lky"), db.lisans]) {
      if (!k) continue;
      try {
        seri = Math.max(seri, lisansKoduCoz(k).seri);
      } catch {
        /* yok say */
      }
    }
    const eski = [dosyaOku("durum.lky"), db.durum].filter((x): x is string => !!x).map(durumCoz).filter((x): x is Durum => !!x);
    await durumuKaydet({
      sonGorulen: Math.max(sunucuMs, ...eski.map((x) => x.sonGorulen)),
      seri: Math.max(seri, ...eski.map((x) => x.seri)),
      kilit: { neden: "SAAT_GERI_ALINDI", zaman: simdi, seri },
    });
    this.onbellegiTemizle();
    logger.warn("[LISANS] Bilgisayar saati merkez saatinden geride; program kilitlendi.");
    return true;
  }

  /** Kullanıcı limitine göre yeni kullanıcı açılabilir mi (kurulum modunda Kullanıcı Tanımları). */
  public static async kullaniciAcilabilirMi(): Promise<void> {
    const d = await this.durum();
    if (d.durum === "KILITLI") throw new ApiError(HttpStatus.LOCKED, d.mesaj || "Program kilitli.", { kod: "LISANS_KILIT", neden: d.neden });
    const pool = await kurulumHavuzu();
    const res = await pool.request().query(`SELECT COUNT(*) AS N FROM dbo.TODVZ_KULLANICI`);
    const sayi = res.recordset[0].N as number;
    if (d.kullaniciLimiti !== null && sayi >= d.kullaniciLimiti) {
      throw ApiError.conflict(`Lisansınızdaki kullanıcı limiti (${d.kullaniciLimiti}) dolu. Ek kullanıcı için bizimle iletişime geçin.`);
    }
  }
}
