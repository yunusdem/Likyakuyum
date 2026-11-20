import crypto from "crypto";
import fs from "fs";
import sql from "mssql";
import { AktarimAdimi, AktarimSonucu, aktar } from "./aktarimMotoru.js";
import { DogrulamaRaporu, dogrula, veritabanlariniDogrula } from "./aktarimDogrulama.js";
import { Engel, IncelemeOzeti, geciciAc, geciciSil, incele, setSec, sunucuAnaSurumu, yedekBasligi, yedekEngelleri } from "./aktarimInceleme.js";
import { AktarimPlani } from "./aktarimPlani.js";
import { CiftRolu, CiftSecenekleri, ciftAdimlari, ciftKontrolleri, digerVeritabaniKurali, eDovizIsaretle } from "./aktarimCift.js";
import { sonKontrol } from "./aktarimSonKontrol.js";

/**
 * Veri aktarımı — komut satırı çekirdeği (docs/VERITABANI_TASIMA_YOL_HARITASI.md, K10).
 * scripts/veri-aktar.ts ve scripts/aktarim-dogrula.ts bunu çağırır; exe kurulumunda ve sunucuda elle aktarım/doğrulama için.
 * Bağlantı: RESTORE yetkisi olan ve hedef firma veritabanının sahibi (db_owner) olan SQL hesabı (sunucuda likya_klon).
 */

export interface CliBaglanti {
  server: string;
  port?: number;
  user: string;
  password: string;
}

/** Tek bağlantılı, zaman aşımsız havuz (aktarım tek işlemde ve uzun sürebilir). */
export const cliHavuzu = async (b: CliBaglanti): Promise<sql.ConnectionPool> => {
  const pool = new sql.ConnectionPool({
    server: b.server,
    port: b.port || 1433,
    database: "master",
    user: b.user,
    password: b.password,
    options: { encrypt: false, trustServerCertificate: true, enableArithAbort: true },
    pool: { max: 1, min: 0, idleTimeoutMillis: 5000 },
    connectionTimeout: 15000,
    requestTimeout: 0,
  });
  // Bağlantı koparsa sürücünün havuzda yaydığı 'error' dinleyicisiz kalıp betiği yığın dökümüyle düşürmesin; çalışan komut kendi hatasını alır
  pool.on("error", () => undefined);
  return pool.connect();
};

export class IncelemeEngeli extends Error {
  constructor(public readonly engeller: Engel[]) {
    super(`Yedek aktarılamaz: ${engeller.filter((e) => e.seviye === "ENGEL").map((e) => e.mesaj).join(" | ")}`);
  }
}

/** Yedeği geçici adla açar, inceler; iş bitince (hata olsa da) geçici veritabanını siler. */
export const yedekleCalis = async <T>(
  pool: sql.ConnectionPool,
  yedekYolu: string,
  is: (geciciDb: string, ozet: IncelemeOzeti) => Promise<T>,
  geciciAd = `LKY_AKTARIM_CLI_${crypto.randomBytes(6).toString("hex")}`
): Promise<T> => {
  const setler = await yedekBasligi(pool, yedekYolu);
  const engeller = yedekEngelleri(setler, await sunucuAnaSurumu(pool));
  if (engeller.some((e) => e.seviye === "ENGEL")) throw new IncelemeEngeli(engeller);
  const set = setSec(setler)!;
  await geciciAc(pool, yedekYolu, geciciAd, set.position);
  try {
    const ozet = await incele(pool, geciciAd, set);
    ozet.engeller.unshift(...engeller);
    if (ozet.engeller.some((e) => e.seviye === "ENGEL")) throw new IncelemeEngeli(ozet.engeller);
    return await is(geciciAd, ozet);
  } finally {
    await geciciSil(pool, geciciAd).catch(() => undefined);
  }
};

export interface CiftGirdisi {
  /** Eşin firma veritabanı (yeni ad) */
  esHedefDb: string;
  /** Eşin eski programdaki adı; verilmezse incelemedeki tek bağlı veritabanı */
  esEskiAdi?: string | null;
  /** Verilmezse: eski programın e-Döviz günlüğü dolu olan taraf RESMI, diğeri CALISMA */
  rol?: CiftRolu | null;
  hedefGirisi?: string | null;
  esGirisi?: string | null;
}

export interface VeriAktarGirdisi {
  yedek: string;
  hedefDb: string;
  onYedek?: string | null;
  rapor?: string | null;
  ilerleme?: (a: AktarimAdimi) => void;
  /** R/A çifti (K2) */
  cift?: CiftGirdisi | null;
  /** Taslak kurallara (sarraf fişi, K8) yönetici onayı */
  taslakOnay?: boolean;
  /** Ek adımlar (test / özel durum); çift ve e-Döviz işaretlemesinden sonra çalışır */
  ekAdimlar?: (tx: sql.Transaction, plan: AktarimPlani, ozet: IncelemeOzeti) => Promise<string[]>;
}

export interface VeriAktarSonucu {
  inceleme: IncelemeOzeti;
  aktarim: AktarimSonucu;
  dogrulama: DogrulamaRaporu;
  cift: CiftSecenekleri | null;
  /** COMMIT'ten sonra, işlem dışında: yedekle yeniden karşılaştırma + doğru yer (firma kimliği, veritabanı durumu) */
  sonKontrol: DogrulamaRaporu | null;
}

/** Çift seçeneklerini incelemeden tamamlar (eşin eski adı, rol). */
export const ciftSecenekleri = (ozet: IncelemeOzeti, kaynakDb: string, hedefDb: string, c: CiftGirdisi): CiftSecenekleri => {
  const esEskiAdi = c.esEskiAdi || (ozet.bagliVeritabanlari.length === 1 ? ozet.bagliVeritabanlari[0].db : null);
  if (!esEskiAdi) {
    throw new Error(
      ozet.bagliVeritabanlari.length
        ? `Yedek birden çok veritabanına bağlı (${ozet.bagliVeritabanlari.map((b) => b.db).join(", ")}); eşin eski adı seçilmeli.`
        : "Yedek başka bir veritabanına bağlı değil; çift olarak aktarılamaz."
    );
  }
  // Rol: eski programın "fişleri aktarılacak alan" işareti (1 = çalışma), yoksa e-Döviz günlüğü dolu taraf resmî
  const rol: CiftRolu =
    c.rol || (ozet.alan.fisleriAktarilacak === true ? "CALISMA" : ozet.alan.fisleriAktarilacak === false ? "RESMI" : ozet.eDoviz.logVar ? "RESMI" : "CALISMA");
  return { kaynakDb, hedefDb, esHedefDb: c.esHedefDb, esEskiAdi, rol, hedefGirisi: c.hedefGirisi ?? null, esGirisi: c.esGirisi ?? null };
};

/** Aktarımın ek adımları: e-Döviz işaretleme (her zaman) + çift (verildiyse). Aynı işlemde, kopyadan sonra. */
export const standartEkAdimlar = async (tx: sql.Transaction, kaynakDb: string, hedefDb: string, cift: CiftSecenekleri | null): Promise<string[]> => {
  const notlar: string[] = [];
  const e = await eDovizIsaretle(tx, kaynakDb, hedefDb);
  if (e.beklenen > 0) {
    if (e.isaretlenen !== e.beklenen) throw new Error(`e-Döviz işaretleme eksik: ${e.beklenen} belgeden ${e.isaretlenen} işaretlendi.`);
    notlar.push(`Eski programla gönderilmiş ${e.isaretlenen} e-Döviz belgesi "Gönderildi" işaretlendi (yeniden gönderilmez).`);
  }
  if (cift) notlar.push(...(await ciftAdimlari(tx, cift)));
  return notlar;
};

export const veriAktarKomutu = async (pool: sql.ConnectionPool, g: VeriAktarGirdisi): Promise<VeriAktarSonucu> => {
  if (!fs.existsSync(g.yedek)) throw new Error(`Yedek dosyası yok: ${g.yedek}`);
  const sonuc = await yedekleCalis(pool, g.yedek, async (geciciDb, ozet) => {
    let rapor: DogrulamaRaporu | null = null;
    const cift = g.cift ? ciftSecenekleri(ozet, geciciDb, g.hedefDb, g.cift) : null;
    const aktarim = await aktar({
      pool,
      kaynakDb: geciciDb,
      hedefDb: g.hedefDb,
      onYedekYolu: g.onYedek ?? null,
      ilerleme: g.ilerleme,
      planSecenekleri: { degerKurallari: [digerVeritabaniKurali(cift)], taslakOnay: !!g.taslakOnay },
      ekAdimlar: async (tx, plan) => [
        ...(await standartEkAdimlar(tx, geciciDb, g.hedefDb, cift)),
        ...(g.ekAdimlar ? await g.ekAdimlar(tx, plan, ozet) : []),
      ],
      dogrula: async (tx, plan) => {
        rapor = await dogrula(tx, plan, { ekKontroller: (b) => ciftKontrolleri(b, { kaynakDb: geciciDb, hedefDb: g.hedefDb, cift }) });
        return rapor as unknown as { basarili: boolean };
      },
    });
    // Aktarım sonrası kontrol: geçici kaynak silinmeden, COMMIT'ten sonra
    const son = await sonKontrol(pool, { kaynakDb: geciciDb, hedefDb: g.hedefDb, cift }).catch(() => null);
    return { inceleme: ozet, aktarim, dogrulama: rapor!, cift, sonKontrol: son };
  });
  if (g.rapor) fs.writeFileSync(g.rapor, JSON.stringify(sonuc, null, 2), "utf8");
  return sonuc;
};

export interface DogrulaGirdisi {
  kaynakYedek?: string | null;
  kaynakDb?: string | null;
  hedefDb: string;
  rapor?: string | null;
}

export const dogrulaKomutu = async (pool: sql.ConnectionPool, g: DogrulaGirdisi): Promise<DogrulamaRaporu> => {
  if (!g.kaynakYedek && !g.kaynakDb) throw new Error("Kaynak gerekli: --kaynak-yedek <dosya.bak> ya da --kaynak-db <ad>.");
  // Aktarım sonrası kontrolle aynı: tam karşılaştırma + doğru yer (firma kimliği, veritabanı durumu)
  const calis = (kaynakDb: string) => sonKontrol(pool, { kaynakDb, hedefDb: g.hedefDb, cift: null });
  const rapor = g.kaynakYedek ? await yedekleCalis(pool, g.kaynakYedek, (geciciDb) => calis(geciciDb)) : await calis(g.kaynakDb!);
  if (g.rapor) fs.writeFileSync(g.rapor, JSON.stringify(rapor, null, 2), "utf8");
  return rapor;
};

/** --ad deger biçimindeki argümanlar */
export const argumanlar = (argv: string[]): Record<string, string> => {
  const a: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith("--")) continue;
    const ad = argv[i].slice(2);
    const sonraki = argv[i + 1];
    if (sonraki === undefined || sonraki.startsWith("--")) a[ad] = "1";
    else {
      a[ad] = sonraki;
      i++;
    }
  }
  return a;
};
