import sql from "mssql";
import { getDbPool } from "../config/mssql.config.js";
import { ApiError } from "../utils/ApiError.js";
import { HttpStatus } from "../constants/httpStatusCodes.js";
import { ticariSemaHazirla } from "../services/ticari/ticariSema.js";
import { GECERLI_KDV_ORANLARI, SKT_UYARI_GUN_VARSAYILAN, receteDenetle, birimAdiDuzelt, ekBirimleriDenetle, tartiBirimi, teraziBarkodCoz, teraziDuzeniDenetle, type EkBirim, type TeraziDuzeni } from "../services/ticari/ticariHesap.js";
import { UrunResimSqlRepository } from "./urunResimSql.repository.js";
import { TicariFiyatSqlRepository } from "./ticariFiyatSql.repository.js";

/**
 * Ticari İşlemler: stok kartı, ürün grubu, stok ayarları, yetki ve stok raporları
 * (docs/TICARI_ISLEMLER_YOL_HARITASI.md, T5–T8, T19, T21). Bakiye her zaman hareket defterinden (TODVZ_STOK_HAREKET).
 */

export type DbBaglam = { dbServer?: string; dbName?: string };

/** Stok hareketi belge türleri */
/** TODVZ_STOK_HAREKET.BELGE_TURU: 1 giriş, 2 satış / satış iadesi (fatura), 3 sayım (TA11), 4 fire (TA12), 5 tedarikçiye iade (TA13) */
export const STOK_BELGE = { GIRIS: 1, SATIS: 2, SAYIM: 3, FIRE: 4, TEDARIKCI_IADE: 5, PARCALAMA: 6, RECETE: 7 } as const;
export const STOK_BELGE_ADI: Record<number, string> = { 1: "Stok Giriş Fişi", 2: "Satış Fişi", 3: "Sayım Fişi", 4: "Fire Fişi", 5: "Tedarikçiye İade", 6: "Parçalama Fişi", 7: "Reçete Tüketimi" };

/** Reçeteli ürün (TA18) stok tutmaz: giriş / sayım / fire / tedarikçiye iade / parçalamada reddedilir */
export async function receteliReddet(tx: sql.Transaction | sql.ConnectionPool, kartIdler: number[], islem: string): Promise<void> {
  const ids = [...new Set(kartIdler.map(Number).filter((x) => x > 0))];
  if (!ids.length) return;
  const r = await new sql.Request(tx as any).query(`SELECT TOP 1 RTRIM(KOD) AS KOD, AD FROM dbo.TODVZ_STOK_KART WHERE STOK_KART_ID IN (${ids.join(",")}) AND ISNULL(RECETELI, 0) = 1`);
  if (r.recordset.length) throw ApiError.badRequest(`${String(r.recordset[0].AD ?? "").trim()} reçeteli üründür (stok tutmaz, satılınca malzemeleri düşer); ${islem} yapılamaz.`);
}

/**
 * Ticari stok / vezne yazan işlemlerin firma veritabanındaki ortak kilidi (docs/TICARI_ADISYON_YOL_HARITASI.md U25).
 * Satış, iade, giriş, fire, sayım onayı, tedarikçiye iade aynı anda koşunca birbirinin henüz kaydedilmemiş hareket / ödeme satırını
 * tarayıp kilitlenmeye (deadlock) giriyordu; eksi stok denetimi de öteki işlemin yazdığını göremiyordu. İşlem başında alınır,
 * işlem bitince (commit / rollback) kendiliğinden bırakılır; aynı işlem içinde ikinci kez çağrılması zararsızdır.
 */
export async function stokIslemKilidi(tx: sql.Transaction, beklemeMs = 20000): Promise<void> {
  // Çağıranların çoğu bu kilidi try bloğundan ÖNCE alır: kilit alınamazsa işlem burada geri alınır, yoksa açık işlem ve
  // havuz bağlantısı sızar (kilit 20 sn'de alınamayan her istek bir bağlantı götürür, havuz tükenir).
  let sonuc = -999;
  try {
    const r = await new sql.Request(tx).input("BEK", sql.Int, beklemeMs).query(`DECLARE @R INT;
      EXEC @R = sp_getapplock @Resource = 'LIKYA_TICARI_STOK', @LockMode = 'Exclusive', @LockOwner = 'Transaction', @LockTimeout = @BEK;
      SELECT @R AS R;`);
    sonuc = Number(r.recordset[0]?.R);
  } catch (e) {
    await tx.rollback().catch(() => undefined);
    throw e;
  }
  if (!(sonuc >= 0)) {
    await tx.rollback().catch(() => undefined);
    throw ApiError.conflict("Başka bir stok işlemi sürüyor; birkaç saniye sonra yeniden deneyin.");
  }
}

/** Ürün resmi (TODVZ_URUN_RESIM.TIP): 0 altın, 1 özel ürün, 2 stok kartı */
export const STOK_RESIM_TIPI = 2;

export type EksiStokDavranisi = "UYAR" | "ENGELLE" | "SESSIZ";
export const EKSI_STOK_DAVRANISLARI: EksiStokDavranisi[] = ["UYAR", "ENGELLE", "SESSIZ"];
/** Karta özel stok kontrol (İş 9, G22): null = Stok Ayarları'ndaki genel davranış */
export type StokKontrol = EksiStokDavranisi | null;
export const stokKontrolOku = (v: unknown): StokKontrol | "hata" => {
  const t = String(v ?? "").trim().toLocaleUpperCase("tr-TR").replace("İ", "I");
  if (!t || t === "AYAR" || t === "AYARI KULLAN" || t === "GENEL") return null;
  if (t === "UYAR" || t === "ENGELLE" || t === "SESSIZ") return t;
  return "hata";
};

/** Ticari etiket düzeni (İş 2, G5): basit etiket; alanlar kart alanlarından seçilir */
export const ETIKET_ALANLARI = ["ad", "kod", "grup", "fiyat", "birim"] as const;
export type EtiketAlani = (typeof ETIKET_ALANLARI)[number];
export interface EtiketDuzeni {
  genislikMm: number;
  yukseklikMm: number;
  barkodTipi: "CODE128" | "QR";
  alanlar: EtiketAlani[];
}
export const VARSAYILAN_ETIKET_DUZENI: EtiketDuzeni = { genislikMm: 50, yukseklikMm: 30, barkodTipi: "CODE128", alanlar: ["ad", "kod", "fiyat"] };

/** Düzeni denetler; sikiysa hatalı değerde hata verir, değilse varsayılana çeker (saf; test eder) */
export function etiketDuzeniDenetle(g: Partial<EtiketDuzeni> | null | undefined, siki = false): EtiketDuzeni {
  const sayi = (v: unknown, varsayilan: number, enAz: number, enCok: number, ad: string): number => {
    if (v === undefined || v === null || v === "") return varsayilan;
    const n = Number(typeof v === "string" ? v.replace(",", ".") : v);
    if (!Number.isFinite(n) || n < enAz || n > enCok) {
      if (siki) throw ApiError.badRequest(`${ad} ${enAz}–${enCok} mm arasında olmalı.`);
      return varsayilan;
    }
    return Math.round(n * 10) / 10;
  };
  const tip = String(g?.barkodTipi || "").toUpperCase();
  if (siki && tip && tip !== "CODE128" && tip !== "QR") throw ApiError.badRequest("Barkod tipi CODE128 ya da QR olmalı.");
  const alanlar = Array.isArray(g?.alanlar) ? (g!.alanlar as unknown[]).map(String).filter((a): a is EtiketAlani => (ETIKET_ALANLARI as readonly string[]).includes(a)) : null;
  if (siki && Array.isArray(g?.alanlar) && alanlar!.length !== g!.alanlar!.length) throw ApiError.badRequest("Etiket alanı tanınmadı.");
  return {
    genislikMm: sayi(g?.genislikMm, VARSAYILAN_ETIKET_DUZENI.genislikMm, 20, 150, "Genişlik"),
    yukseklikMm: sayi(g?.yukseklikMm, VARSAYILAN_ETIKET_DUZENI.yukseklikMm, 10, 100, "Yükseklik"),
    barkodTipi: tip === "QR" ? "QR" : "CODE128",
    alanlar: alanlar && alanlar.length ? [...new Set(alanlar)] : [...VARSAYILAN_ETIKET_DUZENI.alanlar],
  };
}

/** Raporlarda bir seferde dönen en çok satır (G2); toplamlar bütün küme üzerinden hesaplanır, aşınca kesildi = true */
export const RAPOR_SATIR_SINIRI = 5000;

export interface StokGrup {
  stokGrupId: number;
  ad: string;
  aktif: boolean;
  kartSayisi: number;
}

export interface StokKart {
  stokKartId: number;
  kod: string;
  ad: string;
  stokGrupId: number | null;
  grupAdi: string | null;
  birim: string;
  kdvOrani: number;
  satisFiyati: number | null;
  fiyatKdvDahil: boolean;
  paraId: number | null;
  paraKodu: string | null;
  alisFiyati: number | null;
  sonAlisFiyati: number | null;
  sonAlisTarihi: string | null;
  enAzStok: number | null;
  aktif: boolean;
  aciklama: string | null;
  barkodlar: string[];
  bakiye: number;
  resimVar: boolean;
  resim?: string | null;
  /** Karta özel eksi stok davranışı; null = genel ayar (İş 9) */
  stokKontrol: StokKontrol;
  /** Tedarikçi cari (İş 11, G10): son giriş fişindeki cari ya da kartta elle */
  tedarikciCariId: number | null;
  tedarikciAd: string | null;
  /** İstekte fiyat listesi verildiyse o listedeki fiyat (yoksa null → ana fiyat geçerli) */
  listeFiyati?: number | null;
  /** Kart ayrıntısında (kart(id, …, true)) tanımlı listelerdeki fiyatlar */
  listeFiyatlari?: { fiyatListesiId: number; ad: string; fiyat: number | null }[];
  /** Terazi PLU kodu (TA3); null = teraziye bağlı değil */
  teraziKodu: number | null;
  /** SKT takibi (TA16): stok giriş fişinde son kullanma tarihi zorunlu */
  sktTakibi: boolean;
  /** Reçeteli ürün (TA18): stok tutmaz, satılınca reçetedeki malzemeler düşer */
  receteli: boolean;
  /** Adisyon (masa) KDV oranı (TA32); null = Adisyon ayarındaki varsayılan */
  adisyonKdvOrani: number | null;
  /** Kart ayrıntısında reçete (1 birim için malzeme miktarı, malzemenin biriminde) */
  recete?: { malzemeKartId: number; kod: string; ad: string; birim: string; miktar: number }[];
  /** kartBul terazi etiketli barkodla bulduysa: barkoddaki ağırlık (kg) ya da tutar (TL) */
  terazi?: { barkod: string; plu: number; agirlikKg: number | null; fiyat: number | null };
  /** Kart ayrıntısında: ek birimler (Koli = 12 Adet) ve barkodları (TA5) */
  birimler?: EkBirim[];
  /** kartBul bir ek birimin barkoduyla bulduysa o birim (koli okutuldu) */
  okunanBirim?: EkBirim;
}

export interface StokKartGirdi {
  stokKartId?: number | null;
  kod?: string | null;
  ad?: string | null;
  stokGrupId?: number | null;
  birim?: string | null;
  kdvOrani?: number | string | null;
  satisFiyati?: number | string | null;
  fiyatKdvDahil?: boolean | null;
  paraId?: number | null;
  alisFiyati?: number | string | null;
  enAzStok?: number | string | null;
  aktif?: boolean | null;
  aciklama?: string | null;
  barkodlar?: string[] | null;
  /** undefined: resme dokunma · null / "": resmi kaldır · data URL: yeni resim */
  resim?: string | null;
  /** "UYAR" | "ENGELLE" | "SESSIZ" | null / "" (genel ayar); Excel'de "Ayar" da genel ayardır */
  stokKontrol?: string | null;
  /** Tedarikçi cari; undefined: dokunma (Excel'de boş hücre), null / 0: kaldır */
  tedarikciCariId?: number | null;
  /** Liste fiyatları; verilen listeler yazılır, boş fiyat o listeden siler (undefined: dokunma) */
  listeFiyatlari?: { fiyatListesiId: number; fiyat: number | string | null }[];
  /** Terazi PLU kodu (TA3); undefined: dokunma, null / "": kaldır */
  teraziKodu?: number | string | null;
  /** SKT takibi (TA16); undefined: dokunma (Excel) */
  sktTakibi?: boolean | null;
  /** Reçeteli ürün + reçete (TA18); undefined: dokunma */
  receteli?: boolean | null;
  /** Adisyon KDV oranı (TA32); undefined: dokunma, null / "": varsayılan */
  adisyonKdvOrani?: number | string | null;
  recete?: { malzemeKartId: number; miktar: number | string }[] | null;
  /** Ek birimler (TA5); undefined: dokunma (Excel), [] : hepsini kaldır */
  birimler?: Partial<EkBirim>[];
}

const temiz = (v: unknown): string => String(v ?? "").trim();
const sayiVeyaNull = (v: unknown): number | null => {
  if (v === null || v === undefined || temiz(v) === "") return null;
  const s = typeof v === "string" ? (v.includes(",") ? v.replace(/\./g, "").replace(",", ".") : v) : v;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
};

/** Kart girdisini denetler ve kayda hazır hâle getirir (saf; Excel yüklemesi de kullanır). Hata listesi döner. */
export interface KartDegeri {
  kod: string;
  ad: string;
  stokGrupId: number | null;
  birim: string;
  kdvOrani: number;
  satisFiyati: number | null;
  fiyatKdvDahil: boolean;
  paraId: number | null;
  alisFiyati: number | null;
  enAzStok: number | null;
  aktif: boolean;
  aciklama: string | null;
  barkodlar: string[];
  stokKontrol: StokKontrol;
}

export type KartAlani = "kod" | "ad" | "birim" | "kdvOrani" | "satisFiyati" | "alisFiyati" | "enAzStok" | "barkodlar" | "stokKontrol";

export function kartGirdisiDenetle(g: StokKartGirdi): { hatalar: string[]; alanHatalari: { alan: KartAlani; mesaj: string }[]; deger: KartDegeri } {
  const alanHatalari: { alan: KartAlani; mesaj: string }[] = [];
  const hatalar = { push: (alan: KartAlani, mesaj: string) => alanHatalari.push({ alan, mesaj }) };
  const ad = temiz(g.ad);
  if (!ad) hatalar.push("ad", "Ürün adı zorunlu.");
  if (ad.length > 200) hatalar.push("ad", "Ürün adı en çok 200 karakter olabilir.");
  const kod = temiz(g.kod).toLocaleUpperCase("tr-TR");
  if (kod.length > 30) hatalar.push("kod", "Kod en çok 30 karakter olabilir.");
  if (kod && !/^[0-9A-ZÇĞİÖŞÜ._\-/]+$/.test(kod)) hatalar.push("kod", "Kodda yalnız harf, rakam ve . _ - / kullanılabilir.");

  let birim = "Adet";
  if (temiz(g.birim)) {
    const b = birimAdiDuzelt(g.birim);
    if (!b) hatalar.push("birim", `Birim "${temiz(g.birim)}" tanınmadı; Adet, Kg, Gr, Lt, Metre, Paket ya da Kutu olmalı.`);
    else birim = b;
  }

  let kdvOrani = 20;
  const kdv = sayiVeyaNull(g.kdvOrani);
  if (kdv !== null) {
    if (Number.isNaN(kdv) || !GECERLI_KDV_ORANLARI.includes(kdv)) hatalar.push("kdvOrani", `KDV oranı ${temiz(g.kdvOrani)} olamaz; ${GECERLI_KDV_ORANLARI.join(", ")} olmalı.`);
    else kdvOrani = kdv;
  }

  const fiyat = (k: KartAlani, alan: string, v: unknown): number | null => {
    const n = sayiVeyaNull(v);
    if (n === null) return null;
    if (Number.isNaN(n)) { hatalar.push(k, `${alan} sayı olmalı ("${temiz(v)}").`); return null; }
    if (n < 0) { hatalar.push(k, `${alan} eksi olamaz.`); return null; }
    return n;
  };
  const satisFiyati = fiyat("satisFiyati", "Satış fiyatı", g.satisFiyati);
  const alisFiyati = fiyat("alisFiyati", "Alış fiyatı", g.alisFiyati);
  const enAzStok = fiyat("enAzStok", "En az stok", g.enAzStok);

  const stokKontrol = stokKontrolOku(g.stokKontrol);
  if (stokKontrol === "hata") hatalar.push("stokKontrol", `Stok kontrol "${temiz(g.stokKontrol)}" olamaz; Ayar, Uyar, Engelle ya da Sessiz olmalı.`);

  const barkodlar: string[] = [];
  for (const b of g.barkodlar || []) {
    const t = temiz(b);
    if (!t) continue;
    if (t.length > 50) hatalar.push("barkodlar", `Barkod "${t}" 50 karakterden uzun.`);
    else if (/\s/.test(t)) hatalar.push("barkodlar", `Barkod "${t}" boşluk içeremez.`);
    else if (!barkodlar.includes(t)) barkodlar.push(t);
  }

  return {
    hatalar: alanHatalari.map((h) => h.mesaj),
    alanHatalari,
    deger: {
      kod,
      ad,
      stokGrupId: g.stokGrupId ? Number(g.stokGrupId) : null,
      birim,
      kdvOrani,
      satisFiyati,
      fiyatKdvDahil: g.fiyatKdvDahil === undefined || g.fiyatKdvDahil === null ? true : !!g.fiyatKdvDahil,
      paraId: g.paraId ? Number(g.paraId) : null,
      alisFiyati,
      enAzStok,
      aktif: g.aktif === undefined || g.aktif === null ? true : !!g.aktif,
      aciklama: temiz(g.aciklama).slice(0, 500) || null,
      barkodlar,
      stokKontrol: stokKontrol === "hata" ? null : stokKontrol,
    },
  };
}

/** Kart kolonları: barkodlar tek alanda, bakiye hareket defterinden (yalnız seçilen satırlar için hesaplanır) */
const KART_KOLONLARI = `K.STOK_KART_ID, K.KOD, K.AD, K.STOK_GRUP_ID, G.AD AS GRUP_ADI, K.BIRIM, K.KDV_ORANI, K.SATIS_FIYATI, K.FIYAT_KDV_DAHIL,
    K.PARA_ID, RTRIM(P.KOD) AS PARA_KODU, K.ALIS_FIYATI, K.SON_ALIS_FIYATI, K.SON_ALIS_TARIHI, K.EN_AZ_STOK, K.AKTIF, K.ACIKLAMA, K.STOK_KONTROL, K.TERAZI_KODU, ISNULL(K.SKT_TAKIBI, 0) AS SKT_TAKIBI, ISNULL(K.RECETELI, 0) AS RECETELI, K.ADISYON_KDV_ORANI,
    K.TEDARIKCI_CARI_ID, RTRIM(TC.AD) AS TEDARIKCI_AD, LF.FIYAT AS LISTE_FIYATI,
    CASE WHEN K.RESIM IS NULL THEN 0 ELSE 1 END AS RESIM_VAR,
    ISNULL(H.BAKIYE, 0) AS BAKIYE,
    STUFF((SELECT '|' + B.BARKOD FROM dbo.TODVZ_STOK_BARKOD B WHERE B.STOK_KART_ID = K.STOK_KART_ID AND B.STOK_BIRIM_ID IS NULL ORDER BY B.STOK_BARKOD_ID FOR XML PATH(''), TYPE).value('.', 'varchar(max)'), 1, 1, '') AS BARKODLAR`;
/** @LISTE parametresi (int, null olabilir): verilen fiyat listesindeki fiyat LISTE_FIYATI olarak gelir */
const KART_BIRLESIM = `
  LEFT JOIN dbo.TODVZ_STOK_GRUP G ON G.STOK_GRUP_ID = K.STOK_GRUP_ID
  LEFT JOIN dbo.TODVZ_PARA P ON P.PARA_ID = K.PARA_ID
  LEFT JOIN dbo.TODVZ_CARI_KART TC ON TC.CARI_KART_ID = K.TEDARIKCI_CARI_ID
  LEFT JOIN dbo.TODVZ_STOK_KART_FIYAT LF ON LF.STOK_KART_ID = K.STOK_KART_ID AND LF.FIYAT_LISTESI_ID = @LISTE
  OUTER APPLY (SELECT SUM(X.GIRIS - X.CIKIS) AS BAKIYE FROM dbo.TODVZ_STOK_HAREKET X WHERE X.STOK_KART_ID = K.STOK_KART_ID) H`;
const KART_SECIMI = `
  SELECT ${KART_KOLONLARI}
  FROM dbo.TODVZ_STOK_KART K${KART_BIRLESIM}`;
/** Her kart sorgusu @LISTE ister (yoksa null) */
const listeGirdisi = (req: sql.Request, fiyatListesiId?: number | null) => req.input("LISTE", sql.Int, Number(fiyatListesiId) || null);

/** Liste süzgeci (kartlar / kartlarSayfali): arama kod, ad ya da barkodda geçer */
function kartKosulu(req: sql.Request, f: { arama?: string | null; grupId?: number | null; aktif?: boolean | null; idler?: number[] | null }): string[] {
  const kosul: string[] = [];
  if (f.arama && temiz(f.arama)) {
    const t = temiz(f.arama);
    req.input("ARA", sql.NVarChar(210), `%${t}%`);
    // Kod/ad ve barkod eşleşmeleri UNION ile birleştirilir (OR + alt sorgu 200k kartta 2,4 sn, UNION 0,7 sn).
    // Yalnız rakamlardan oluşan arama (barkod / kod okutma): baştan eşleşme → tekil indeksler kullanılır.
    const onek = /^\d{3,}$/.test(t);
    if (onek) req.input("ARAON", sql.VarChar(60), `${t}%`);
    kosul.push(`K.STOK_KART_ID IN (SELECT K2.STOK_KART_ID FROM dbo.TODVZ_STOK_KART K2 WHERE K2.KOD LIKE ${onek ? "@ARAON" : "@ARA"} OR K2.AD LIKE @ARA
      UNION SELECT B.STOK_KART_ID FROM dbo.TODVZ_STOK_BARKOD B WHERE B.BARKOD LIKE ${onek ? "@ARAON" : "@ARA"})`);
  }
  if (f.grupId) { req.input("GRUP", sql.Int, f.grupId); kosul.push("K.STOK_GRUP_ID = @GRUP"); }
  if (f.aktif === true || f.aktif === false) { req.input("AKTIF", sql.Bit, f.aktif ? 1 : 0); kosul.push("K.AKTIF = @AKTIF"); }
  if (f.idler) {
    const idler = [...new Set(f.idler.map(Number).filter((x) => Number.isInteger(x) && x > 0))].slice(0, 2000);
    kosul.push(idler.length ? `K.STOK_KART_ID IN (${idler.join(",")})` : "1 = 0");
  }
  return kosul;
}

const kartModeli = (r: any): StokKart => ({
  stokKartId: r.STOK_KART_ID,
  kod: temiz(r.KOD),
  ad: temiz(r.AD),
  stokGrupId: r.STOK_GRUP_ID ?? null,
  grupAdi: r.GRUP_ADI ? temiz(r.GRUP_ADI) : null,
  birim: temiz(r.BIRIM) || "Adet",
  kdvOrani: Number(r.KDV_ORANI) || 0,
  satisFiyati: r.SATIS_FIYATI === null || r.SATIS_FIYATI === undefined ? null : Number(r.SATIS_FIYATI),
  fiyatKdvDahil: r.FIYAT_KDV_DAHIL === true || r.FIYAT_KDV_DAHIL === 1,
  paraId: r.PARA_ID ?? null,
  paraKodu: r.PARA_KODU ? temiz(r.PARA_KODU) : null,
  alisFiyati: r.ALIS_FIYATI === null || r.ALIS_FIYATI === undefined ? null : Number(r.ALIS_FIYATI),
  sonAlisFiyati: r.SON_ALIS_FIYATI === null || r.SON_ALIS_FIYATI === undefined ? null : Number(r.SON_ALIS_FIYATI),
  sonAlisTarihi: r.SON_ALIS_TARIHI ? new Date(r.SON_ALIS_TARIHI).toISOString() : null,
  enAzStok: r.EN_AZ_STOK === null || r.EN_AZ_STOK === undefined ? null : Number(r.EN_AZ_STOK),
  aktif: r.AKTIF === true || r.AKTIF === 1,
  aciklama: r.ACIKLAMA ? temiz(r.ACIKLAMA) : null,
  barkodlar: r.BARKODLAR ? String(r.BARKODLAR).split("|").filter(Boolean) : [],
  bakiye: Math.round((Number(r.BAKIYE) || 0) * 10000) / 10000,
  resimVar: Number(r.RESIM_VAR) === 1,
  stokKontrol: (() => { const k = stokKontrolOku(r.STOK_KONTROL); return k === "hata" ? null : k; })(),
  tedarikciCariId: r.TEDARIKCI_CARI_ID ?? null,
  tedarikciAd: r.TEDARIKCI_AD ? temiz(r.TEDARIKCI_AD) : null,
  listeFiyati: r.LISTE_FIYATI === null || r.LISTE_FIYATI === undefined ? null : Number(r.LISTE_FIYATI),
  teraziKodu: r.TERAZI_KODU === null || r.TERAZI_KODU === undefined ? null : Number(r.TERAZI_KODU),
  sktTakibi: !!r.SKT_TAKIBI,
  receteli: !!r.RECETELI,
  adisyonKdvOrani: r.ADISYON_KDV_ORANI === null || r.ADISYON_KDV_ORANI === undefined ? null : Number(r.ADISYON_KDV_ORANI),
});

/** Terazi PLU kodu girdisi: boş → null, 1–999999 tam sayı, değilse "hata" */
const teraziKoduOku = (v: unknown): number | null | "hata" => {
  const t = temiz(v as any);
  if (!t) return null;
  const n = Number(t);
  return Number.isInteger(n) && n >= 1 && n <= 999999 ? n : "hata";
};

const teraziDuzeniModeli = (r: any): TeraziDuzeni => ({
  teraziBarkodId: r.TERAZI_BARKOD_ID,
  onek: temiz(r.ONEK),
  kodHane: Number(r.KOD_HANE),
  degerTuru: temiz(r.DEGER_TURU) === "F" ? "F" : "A",
  ondalik: Number(r.ONDALIK),
  aktif: r.AKTIF === true || r.AKTIF === 1,
  aciklama: r.ACIKLAMA ? temiz(r.ACIKLAMA) : null,
});

export class TicariStokSqlRepository {
  static async havuz(ctx?: DbBaglam): Promise<sql.ConnectionPool> {
    const pool = await getDbPool(ctx?.dbServer, ctx?.dbName);
    await ticariSemaHazirla(pool);
    return pool;
  }

  // ───────────── Yetki ve ayarlar ─────────────

  /** Stok kartı / grup / giriş / Excel / ayar ekranları: sistem yöneticisi ya da yetki verilen kullanıcı (T21) */
  static async yonetebilirMi(kullaniciId: number | undefined, yonetici: boolean, ctx?: DbBaglam): Promise<boolean> {
    if (yonetici) return true;
    if (!kullaniciId) return false;
    const pool = await this.havuz(ctx);
    const r = await pool.request().input("ID", sql.Int, kullaniciId).query(`SELECT 1 AS V FROM dbo.TODVZ_STOK_YETKI WHERE KULLANICI_ID = @ID`);
    return r.recordset.length > 0;
  }

  static async eksiStokDavranisi(ctx?: DbBaglam, pool?: sql.ConnectionPool | sql.Transaction): Promise<EksiStokDavranisi> {
    const p = pool || (await this.havuz(ctx));
    const r = await new sql.Request(p as any).query(`SELECT DEGER FROM dbo.TODVZ_STOK_AYAR WHERE ANAHTAR = 'EKSI_STOK'`);
    const d = temiz(r.recordset[0]?.DEGER).toUpperCase();
    return d === "ENGELLE" || d === "SESSIZ" ? d : "UYAR";
  }

  static async ayarlar(ctx?: DbBaglam) {
    const pool = await this.havuz(ctx);
    const kullanicilar = await pool.request().query(`
      SELECT U.KULLANICI_ID, RTRIM(U.AD) AS AD, CAST(ISNULL(U.SISTEM_YONETICISI, 0) AS INT) AS YONETICI,
        CASE WHEN Y.KULLANICI_ID IS NULL THEN 0 ELSE 1 END AS YETKILI
      FROM dbo.TODVZ_KULLANICI U LEFT JOIN dbo.TODVZ_STOK_YETKI Y ON Y.KULLANICI_ID = U.KULLANICI_ID
      ORDER BY U.AD`);
    return {
      eksiStok: await this.eksiStokDavranisi(ctx, pool),
      teraziDuzenleri: await this.teraziDuzenleri(pool),
      // Kasiyer vardiyası (TA8): satış / iade için veznede açık vardiya şartı
      vardiyaZorunlu: String((await pool.request().query(`SELECT TOP 1 DEGER FROM dbo.TODVZ_STOK_AYAR WHERE ANAHTAR = 'VARDIYA_ZORUNLU'`)).recordset[0]?.DEGER ?? "").trim().toUpperCase() === "EVET",
      // SKT yaklaşanlar uyarı eşiği (TA16)
      sktUyariGun: await this.sktUyariGun(pool),
      kullanicilar: kullanicilar.recordset.map((r: any) => ({
        kullaniciId: r.KULLANICI_ID,
        ad: temiz(r.AD),
        yonetici: Number(r.YONETICI) === 1,
        yetkili: Number(r.YETKILI) === 1,
      })),
    };
  }

  /** SKT yaklaşanlar uyarı eşiği (gün, TA16): TODVZ_STOK_AYAR 'SKT_UYARI_GUN', yoksa 30 */
  static async sktUyariGun(pool: sql.ConnectionPool): Promise<number> {
    const ham = String((await pool.request().query(`SELECT TOP 1 DEGER FROM dbo.TODVZ_STOK_AYAR WHERE ANAHTAR = 'SKT_UYARI_GUN'`)).recordset[0]?.DEGER ?? "").trim();
    const v = ham === "" ? NaN : Number(ham);
    return Number.isInteger(v) && v >= 0 && v <= 3650 ? v : SKT_UYARI_GUN_VARSAYILAN;
  }

  static async ayarKaydet(girdi: { eksiStok?: string; yetkiliKullanicilar?: number[]; teraziDuzenleri?: Partial<TeraziDuzeni>[]; vardiyaZorunlu?: boolean; sktUyariGun?: number | string | null }, kullaniciId: number | undefined, ctx?: DbBaglam) {
    const pool = await this.havuz(ctx);
    let sktGun: number | null = null;
    if (girdi.sktUyariGun !== undefined && girdi.sktUyariGun !== null && String(girdi.sktUyariGun).trim() !== "") {
      sktGun = Number(String(girdi.sktUyariGun).trim());
      if (!Number.isInteger(sktGun) || sktGun < 0 || sktGun > 3650) throw ApiError.badRequest("SKT uyarı eşiği 0 ile 3650 gün arasında tam sayı olmalı.");
    }
    // Terazi düzenleri (TA3): liste verilirse tamamı yerine yazılır; önek tekil
    let duzenler: TeraziDuzeni[] | null = null;
    if (Array.isArray(girdi.teraziDuzenleri)) {
      duzenler = girdi.teraziDuzenleri.map((d, i) => {
        const yeni: TeraziDuzeni = { onek: temiz(d.onek as any), kodHane: Number(d.kodHane), degerTuru: d.degerTuru === "F" ? "F" : "A", ondalik: Number(d.ondalik), aktif: d.aktif === undefined ? true : !!d.aktif, aciklama: temiz(d.aciklama as any).slice(0, 100) || null };
        const h = teraziDuzeniDenetle({ ...yeni, degerTuru: d.degerTuru as any });
        if (h) throw ApiError.badRequest(`Terazi düzeni ${i + 1} (${yeni.onek || "önek yok"}): ${h}`);
        return yeni;
      });
      const onekler = duzenler.map((d) => d.onek);
      const tekrar = onekler.find((o, i) => onekler.indexOf(o) !== i);
      if (tekrar) throw ApiError.badRequest(`Terazi düzeninde "${tekrar}" öneki iki kez yazılmış.`);
    }
    const tx = new sql.Transaction(pool);
    await tx.begin();
    try {
      if (girdi.eksiStok !== undefined) {
        const d = temiz(girdi.eksiStok).toUpperCase();
        if (!["UYAR", "ENGELLE", "SESSIZ"].includes(d)) throw ApiError.badRequest("Eksi stok davranışı UYAR, ENGELLE ya da SESSIZ olmalı.");
        await new sql.Request(tx).input("D", sql.NVarChar(200), d).query(`
          IF EXISTS (SELECT 1 FROM dbo.TODVZ_STOK_AYAR WHERE ANAHTAR = 'EKSI_STOK') UPDATE dbo.TODVZ_STOK_AYAR SET DEGER = @D WHERE ANAHTAR = 'EKSI_STOK'
          ELSE INSERT INTO dbo.TODVZ_STOK_AYAR (ANAHTAR, DEGER) VALUES ('EKSI_STOK', @D);`);
      }
      if (sktGun !== null) {
        await new sql.Request(tx).input("D", sql.NVarChar(200), String(sktGun)).query(`
          IF EXISTS (SELECT 1 FROM dbo.TODVZ_STOK_AYAR WHERE ANAHTAR = 'SKT_UYARI_GUN') UPDATE dbo.TODVZ_STOK_AYAR SET DEGER = @D WHERE ANAHTAR = 'SKT_UYARI_GUN'
          ELSE INSERT INTO dbo.TODVZ_STOK_AYAR (ANAHTAR, DEGER) VALUES ('SKT_UYARI_GUN', @D);`);
      }
      if (girdi.vardiyaZorunlu !== undefined) {
        await new sql.Request(tx).input("D", sql.NVarChar(200), girdi.vardiyaZorunlu ? "EVET" : "HAYIR").query(`
          IF EXISTS (SELECT 1 FROM dbo.TODVZ_STOK_AYAR WHERE ANAHTAR = 'VARDIYA_ZORUNLU') UPDATE dbo.TODVZ_STOK_AYAR SET DEGER = @D WHERE ANAHTAR = 'VARDIYA_ZORUNLU'
          ELSE INSERT INTO dbo.TODVZ_STOK_AYAR (ANAHTAR, DEGER) VALUES ('VARDIYA_ZORUNLU', @D);`);
      }
      if (duzenler) {
        await new sql.Request(tx).query(`DELETE FROM dbo.TODVZ_TERAZI_BARKOD`);
        for (const d of duzenler) {
          await new sql.Request(tx).input("O", sql.VarChar(2), d.onek).input("K", sql.TinyInt, d.kodHane).input("T", sql.Char(1), d.degerTuru)
            .input("N", sql.TinyInt, d.ondalik).input("A", sql.Bit, d.aktif ? 1 : 0).input("C", sql.NVarChar(100), d.aciklama)
            .query(`INSERT INTO dbo.TODVZ_TERAZI_BARKOD (ONEK, KOD_HANE, DEGER_TURU, ONDALIK, AKTIF, ACIKLAMA) VALUES (@O, @K, @T, @N, @A, @C)`);
        }
      }
      if (Array.isArray(girdi.yetkiliKullanicilar)) {
        await new sql.Request(tx).query(`DELETE FROM dbo.TODVZ_STOK_YETKI`);
        for (const id of [...new Set(girdi.yetkiliKullanicilar.map(Number).filter((x) => x > 0))]) {
          await new sql.Request(tx).input("ID", sql.Int, id).input("E", sql.Int, kullaniciId || null)
            .query(`IF EXISTS (SELECT 1 FROM dbo.TODVZ_KULLANICI WHERE KULLANICI_ID = @ID) INSERT INTO dbo.TODVZ_STOK_YETKI (KULLANICI_ID, EKLEYEN_ID) VALUES (@ID, @E)`);
        }
      }
      await tx.commit();
    } catch (e) {
      await tx.rollback().catch(() => undefined);
      throw e;
    }
    return this.ayarlar(ctx);
  }

  // ───────────── Ticari etiket düzeni (docs/TICARI_GERI_BILDIRIM_YOL_HARITASI.md İş 2, G5) ─────────────

  /** TODVZ_STOK_AYAR 'ETIKET_DUZENI' (kısa JSON: g genişlik, y yükseklik, b barkod tipi, a alanlar) */
  static async etiketDuzeni(ctx?: DbBaglam): Promise<EtiketDuzeni> {
    const pool = await this.havuz(ctx);
    const r = await pool.request().query(`SELECT DEGER FROM dbo.TODVZ_STOK_AYAR WHERE ANAHTAR = 'ETIKET_DUZENI'`);
    try {
      const j = r.recordset[0]?.DEGER ? JSON.parse(String(r.recordset[0].DEGER)) : null;
      return etiketDuzeniDenetle(j ? { genislikMm: j.g, yukseklikMm: j.y, barkodTipi: j.b, alanlar: j.a } : {});
    } catch {
      return etiketDuzeniDenetle({});
    }
  }

  static async etiketDuzeniKaydet(g: Partial<EtiketDuzeni>, ctx?: DbBaglam): Promise<EtiketDuzeni> {
    const d = etiketDuzeniDenetle(g, true);
    const pool = await this.havuz(ctx);
    const deger = JSON.stringify({ g: d.genislikMm, y: d.yukseklikMm, b: d.barkodTipi, a: d.alanlar });
    await pool.request().input("D", sql.NVarChar(200), deger).query(`
      IF EXISTS (SELECT 1 FROM dbo.TODVZ_STOK_AYAR WHERE ANAHTAR = 'ETIKET_DUZENI') UPDATE dbo.TODVZ_STOK_AYAR SET DEGER = @D WHERE ANAHTAR = 'ETIKET_DUZENI'
      ELSE INSERT INTO dbo.TODVZ_STOK_AYAR (ANAHTAR, DEGER) VALUES ('ETIKET_DUZENI', @D);`);
    return d;
  }

  // ───────────── Ürün grupları ─────────────

  static async gruplar(ctx?: DbBaglam): Promise<StokGrup[]> {
    const pool = await this.havuz(ctx);
    const r = await pool.request().query(`
      SELECT G.STOK_GRUP_ID, G.AD, G.AKTIF, (SELECT COUNT(*) FROM dbo.TODVZ_STOK_KART K WHERE K.STOK_GRUP_ID = G.STOK_GRUP_ID) AS KART_SAYISI
      FROM dbo.TODVZ_STOK_GRUP G ORDER BY G.AD`);
    return r.recordset.map((x: any) => ({ stokGrupId: x.STOK_GRUP_ID, ad: temiz(x.AD), aktif: x.AKTIF === true || x.AKTIF === 1, kartSayisi: Number(x.KART_SAYISI) || 0 }));
  }

  static async grupKaydet(g: { stokGrupId?: number | null; ad?: string; aktif?: boolean }, kullaniciId: number | undefined, ctx?: DbBaglam): Promise<StokGrup> {
    const ad = temiz(g.ad);
    if (!ad) throw ApiError.badRequest("Grup adı zorunlu.");
    if (ad.length > 100) throw ApiError.badRequest("Grup adı en çok 100 karakter olabilir.");
    const pool = await this.havuz(ctx);
    const ayni = await pool.request().input("AD", sql.NVarChar(100), ad).input("ID", sql.Int, g.stokGrupId || 0)
      .query(`SELECT 1 AS V FROM dbo.TODVZ_STOK_GRUP WHERE AD = @AD AND STOK_GRUP_ID <> @ID`);
    if (ayni.recordset.length) throw ApiError.badRequest(`"${ad}" adlı grup zaten var.`);
    let id = Number(g.stokGrupId) || 0;
    if (id) {
      const r = await pool.request().input("ID", sql.Int, id).input("AD", sql.NVarChar(100), ad).input("AKTIF", sql.Bit, g.aktif === false ? 0 : 1)
        .query(`UPDATE dbo.TODVZ_STOK_GRUP SET AD = @AD, AKTIF = @AKTIF WHERE STOK_GRUP_ID = @ID; SELECT @@ROWCOUNT AS N`);
      if (!Number(r.recordset[0]?.N)) throw ApiError.notFound("Grup bulunamadı.");
    } else {
      const r = await pool.request().input("AD", sql.NVarChar(100), ad).input("AKTIF", sql.Bit, g.aktif === false ? 0 : 1).input("E", sql.Int, kullaniciId || null)
        .query(`INSERT INTO dbo.TODVZ_STOK_GRUP (AD, AKTIF, EKLEYEN_ID) OUTPUT INSERTED.STOK_GRUP_ID VALUES (@AD, @AKTIF, @E)`);
      id = r.recordset[0].STOK_GRUP_ID;
    }
    return (await this.gruplar(ctx)).find((x) => x.stokGrupId === id)!;
  }

  static async grupSil(id: number, ctx?: DbBaglam): Promise<void> {
    const pool = await this.havuz(ctx);
    const n = Number((await pool.request().input("ID", sql.Int, id).query(`SELECT COUNT(*) AS N FROM dbo.TODVZ_STOK_KART WHERE STOK_GRUP_ID = @ID`)).recordset[0]?.N);
    if (n > 0) throw ApiError.badRequest(`Bu gruba bağlı ${n} stok kartı var; önce kartların grubunu değiştirin ya da grubu pasif yapın.`);
    const r = await pool.request().input("ID", sql.Int, id).query(`DELETE FROM dbo.TODVZ_STOK_GRUP WHERE STOK_GRUP_ID = @ID; SELECT @@ROWCOUNT AS N`);
    if (!Number(r.recordset[0]?.N)) throw ApiError.notFound("Grup bulunamadı.");
  }

  /**
   * Gruba kart ekleme / gruptan çıkarma (docs/TICARI_GERI_BILDIRIM_YOL_HARITASI.md İş 10, G15). Kart tek grupta: eklenen kart
   * başka gruptaysa o gruptan taşınır (ekran onay sorar). Döner: etkilenen kart sayıları.
   */
  static async grupKartlari(grupId: number, g: { ekle?: number[]; cikar?: number[] }, kullaniciId: number | undefined, ctx?: DbBaglam): Promise<{ eklenen: number; cikarilan: number; tasinan: number }> {
    const pool = await this.havuz(ctx);
    const id = Number(grupId) || 0;
    const grup = await pool.request().input("G", sql.Int, id).query(`SELECT AD FROM dbo.TODVZ_STOK_GRUP WHERE STOK_GRUP_ID = @G`);
    if (!grup.recordset.length) throw ApiError.notFound("Grup bulunamadı.");
    const temizle = (l?: number[]) => [...new Set((l || []).map(Number).filter((x) => Number.isInteger(x) && x > 0))].slice(0, 2000);
    const ekle = temizle(g.ekle);
    const cikar = temizle(g.cikar).filter((x) => !ekle.includes(x));
    let eklenen = 0, cikarilan = 0, tasinan = 0;
    const tx = new sql.Transaction(pool);
    await tx.begin();
    try {
      for (let i = 0; i < ekle.length; i += 1000) {
        const liste = ekle.slice(i, i + 1000).join(",");
        const r = await new sql.Request(tx).input("G", sql.Int, id).input("KUL", sql.Int, kullaniciId || null).query(`
          SELECT COUNT(*) AS TASINAN FROM dbo.TODVZ_STOK_KART WHERE STOK_KART_ID IN (${liste}) AND STOK_GRUP_ID IS NOT NULL AND STOK_GRUP_ID <> @G;
          UPDATE dbo.TODVZ_STOK_KART SET STOK_GRUP_ID = @G, GUNCELLEYEN_ID = @KUL, GUNCELLEME_ZAMANI = GETDATE()
          WHERE STOK_KART_ID IN (${liste}) AND (STOK_GRUP_ID IS NULL OR STOK_GRUP_ID <> @G);
          SELECT @@ROWCOUNT AS N;`);
        const sets = (r.recordsets as any[]) || [];
        tasinan += Number(sets[0]?.[0]?.TASINAN) || 0;
        eklenen += Number(sets[1]?.[0]?.N) || 0;
      }
      for (let i = 0; i < cikar.length; i += 1000) {
        const r = await new sql.Request(tx).input("G", sql.Int, id).input("KUL", sql.Int, kullaniciId || null).query(`
          UPDATE dbo.TODVZ_STOK_KART SET STOK_GRUP_ID = NULL, GUNCELLEYEN_ID = @KUL, GUNCELLEME_ZAMANI = GETDATE()
          WHERE STOK_KART_ID IN (${cikar.slice(i, i + 1000).join(",")}) AND STOK_GRUP_ID = @G;
          SELECT @@ROWCOUNT AS N;`);
        cikarilan += Number(r.recordset[0]?.N) || 0;
      }
      await tx.commit();
    } catch (e) {
      await tx.rollback().catch(() => undefined);
      throw e;
    }
    return { eklenen, cikarilan, tasinan };
  }

  /** Grup adına göre bulur, yoksa açar (Excel yüklemesi) */
  static async grupBulVeyaAc(tx: sql.Transaction, ad: string, kullaniciId?: number): Promise<number> {
    const r = await new sql.Request(tx).input("AD", sql.NVarChar(100), ad.slice(0, 100)).input("E", sql.Int, kullaniciId || null).query(`
      DECLARE @ID INT = (SELECT TOP 1 STOK_GRUP_ID FROM dbo.TODVZ_STOK_GRUP WHERE AD = @AD);
      IF @ID IS NULL BEGIN INSERT INTO dbo.TODVZ_STOK_GRUP (AD, EKLEYEN_ID) VALUES (@AD, @E); SET @ID = SCOPE_IDENTITY(); END;
      SELECT @ID AS ID;`);
    return Number(r.recordset[0].ID);
  }

  // ───────────── Stok kartları ─────────────

  /**
   * Kart listesi (sınırlı). Varsayılan 500, en çok 2.000 satır: ekranlar tam listeyi çekmez, sayfalı uç ya da kimlik listesi
   * (idler: hızlı satış butonları, açık fişin satırları) kullanır (docs/TICARI_GERI_BILDIRIM_YOL_HARITASI.md G2).
   */
  static async kartlar(f: { arama?: string; grupId?: number | null; aktif?: boolean | null; idler?: number[] | null; limit?: number; fiyatListesiId?: number | null } = {}, ctx?: DbBaglam): Promise<StokKart[]> {
    const pool = await this.havuz(ctx);
    const req = listeGirdisi(pool.request(), f.fiyatListesiId);
    const kosul = kartKosulu(req, f);
    const limit = Math.min(Math.max(Number(f.limit) || 500, 1), 2000);
    // Kimlik listesi: doğrudan anahtar araması (TOP / sıralı alt sorgu gereksiz)
    if (f.idler) {
      const r = await req.query(`${KART_SECIMI} WHERE ${kosul.join(" AND ")} ORDER BY K.AD, K.KOD`);
      return r.recordset.map(kartModeli);
    }
    // Önce yalnız kimlikler seçilir (ad sırası, TOP); barkod ve bakiye yalnız seçilen satırlar için hesaplanır
    const r = await req.query(`
      WITH S AS (SELECT TOP ${limit} K.STOK_KART_ID FROM dbo.TODVZ_STOK_KART K ${kosul.length ? "WHERE " + kosul.join(" AND ") : ""} ORDER BY K.AD, K.KOD)
      SELECT ${KART_KOLONLARI} FROM S JOIN dbo.TODVZ_STOK_KART K ON K.STOK_KART_ID = S.STOK_KART_ID${KART_BIRLESIM}
      ORDER BY K.AD, K.KOD`);
    return r.recordset.map(kartModeli);
  }

  /**
   * Sayfalı liste: önce yalnız kimlikler sayfalanır (ad, kod sırası), barkod ve bakiye sayfadaki satırlar için hesaplanır;
   * toplam ayrı sayılır. sayfa 1'den başlar, adet en çok 500.
   */
  static async kartlarSayfali(f: { arama?: string | null; grupId?: number | null; aktif?: boolean | null; sayfa?: number | null; adet?: number | null; fiyatListesiId?: number | null } = {}, ctx?: DbBaglam): Promise<{ kartlar: StokKart[]; toplam: number; sayfa: number; adet: number }> {
    const pool = await this.havuz(ctx);
    const adet = Math.min(Math.max(Number(f.adet) || 200, 1), 500);
    const sayfa = Math.max(Number(f.sayfa) || 1, 1);
    const req = listeGirdisi(pool.request().input("ATLA", sql.Int, (sayfa - 1) * adet).input("ADET", sql.Int, adet), f.fiyatListesiId);
    const kosul = kartKosulu(req, f);
    const nerede = kosul.length ? "WHERE " + kosul.join(" AND ") : "";
    // Süzgeç varsa eşleşen kimlikler bir kez geçici tabloya alınır: sayım ve sayfa aynı taramayı iki kez yapmaz
    const r = await req.query(kosul.length ? `
      SELECT K.STOK_KART_ID, K.AD, K.KOD INTO #E FROM dbo.TODVZ_STOK_KART K ${nerede};
      SELECT COUNT(*) AS TOPLAM FROM #E;
      WITH S AS (SELECT E.STOK_KART_ID FROM #E E ORDER BY E.AD, E.KOD OFFSET @ATLA ROWS FETCH NEXT @ADET ROWS ONLY)
      SELECT ${KART_KOLONLARI} FROM S JOIN dbo.TODVZ_STOK_KART K ON K.STOK_KART_ID = S.STOK_KART_ID${KART_BIRLESIM}
      ORDER BY K.AD, K.KOD;
      DROP TABLE #E;` : `
      SELECT COUNT(*) AS TOPLAM FROM dbo.TODVZ_STOK_KART K;
      WITH S AS (SELECT K.STOK_KART_ID FROM dbo.TODVZ_STOK_KART K ORDER BY K.AD, K.KOD OFFSET @ATLA ROWS FETCH NEXT @ADET ROWS ONLY)
      SELECT ${KART_KOLONLARI} FROM S JOIN dbo.TODVZ_STOK_KART K ON K.STOK_KART_ID = S.STOK_KART_ID${KART_BIRLESIM}
      ORDER BY K.AD, K.KOD;`);
    const sets = (r.recordsets as any[]) || [];
    return { kartlar: (sets[1] || []).map(kartModeli), toplam: Number(sets[0]?.[0]?.TOPLAM) || 0, sayfa, adet };
  }

  /** resimle: ayrıntı (resim + tanımlı listelerdeki fiyatlar). fiyatListesiId: o listedeki fiyat listeFiyati olarak */
  static async kart(id: number, ctx?: DbBaglam, resimle = false, fiyatListesiId?: number | null): Promise<StokKart | null> {
    const pool = await this.havuz(ctx);
    const r = await listeGirdisi(pool.request().input("ID", sql.Int, id), fiyatListesiId).query(`${KART_SECIMI} WHERE K.STOK_KART_ID = @ID`);
    if (!r.recordset.length) return null;
    const k = kartModeli(r.recordset[0]);
    if (resimle) {
      if (k.resimVar) k.resim = (await UrunResimSqlRepository.getResimlerByIslemId(STOK_RESIM_TIPI, id, ctx))[0] || null;
      k.listeFiyatlari = await TicariFiyatSqlRepository.kartListeFiyatlari(id, ctx);
      k.birimler = await this.kartBirimleri(pool, id);
      if (k.receteli) k.recete = await this.recete(pool, id);
    }
    return k;
  }

  /** Reçete satırları (TA18) */
  static async recete(pool: sql.ConnectionPool | sql.Transaction, stokKartId: number) {
    const r = await new sql.Request(pool as any).input("ID", sql.Int, stokKartId).query(`SELECT R.MALZEME_KART_ID, RTRIM(K.KOD) AS KOD, K.AD, RTRIM(ISNULL(K.BIRIM, 'Adet')) AS BIRIM, R.MIKTAR
      FROM dbo.TODVZ_STOK_RECETE R JOIN dbo.TODVZ_STOK_KART K ON K.STOK_KART_ID = R.MALZEME_KART_ID WHERE R.STOK_KART_ID = @ID ORDER BY R.SATIR_NO`);
    return r.recordset.map((x: any) => ({ malzemeKartId: Number(x.MALZEME_KART_ID), kod: temiz(x.KOD), ad: temiz(x.AD), birim: temiz(x.BIRIM), miktar: Number(x.MIKTAR) }));
  }

  /** Reçeteli işaret + reçete yazımı (kartYaz içinden; girdi verilmediyse dokunulmaz) */
  private static async receteYaz(tx: sql.Transaction, id: number, g: StokKartGirdi): Promise<void> {
    if ((g.receteli === undefined || g.receteli === null) && (g.recete === undefined || g.recete === null)) return;
    const mevcut = (await new sql.Request(tx).input("ID", sql.Int, id).query(`SELECT ISNULL(RECETELI, 0) AS R FROM dbo.TODVZ_STOK_KART WHERE STOK_KART_ID = @ID`)).recordset[0];
    const receteli = g.receteli === undefined || g.receteli === null ? !!mevcut?.R : !!g.receteli;
    if (!receteli) {
      await new sql.Request(tx).input("ID", sql.Int, id).query(`UPDATE dbo.TODVZ_STOK_KART SET RECETELI = 0 WHERE STOK_KART_ID = @ID; DELETE FROM dbo.TODVZ_STOK_RECETE WHERE STOK_KART_ID = @ID;`);
      return;
    }
    const d = (await new sql.Request(tx).input("ID", sql.Int, id).query(`SELECT
      (SELECT COUNT(*) FROM dbo.TODVZ_STOK_HAREKET WHERE STOK_KART_ID = @ID) AS HAREKET,
      (SELECT TOP 1 RTRIM(U.AD) FROM dbo.TODVZ_STOK_RECETE R JOIN dbo.TODVZ_STOK_KART U ON U.STOK_KART_ID = R.STOK_KART_ID WHERE R.MALZEME_KART_ID = @ID) AS MALZEMESI_OLDUGU`)).recordset[0];
    if (Number(d.HAREKET) > 0) throw ApiError.badRequest("Stok hareketi olan kart reçeteli yapılamaz (reçeteli ürün stok tutmaz); menü ürünü için yeni kart açın.");
    if (d.MALZEMESI_OLDUGU) throw ApiError.badRequest(`Bu kart "${temiz(d.MALZEMESI_OLDUGU)}" reçetesinde malzeme; reçeteli yapılamaz (iç içe reçete yok).`);
    const satirlar = Array.isArray(g.recete)
      ? g.recete.map((x) => ({ malzemeKartId: Number(x.malzemeKartId) || 0, miktar: x.miktar }))
      : (await this.recete(tx, id)).map((x) => ({ malzemeKartId: x.malzemeKartId, miktar: x.miktar as number | string }));
    const h = receteDenetle(id, satirlar);
    if (h) throw ApiError.badRequest(h);
    const ids = satirlar.map((x) => x.malzemeKartId);
    const m = await new sql.Request(tx).query(`SELECT STOK_KART_ID, AD, ISNULL(RECETELI, 0) AS R FROM dbo.TODVZ_STOK_KART WHERE STOK_KART_ID IN (${ids.join(",")})`);
    const bulunan = new Map<number, any>(m.recordset.map((x: any) => [Number(x.STOK_KART_ID), x]));
    const yok = ids.find((x) => !bulunan.has(x));
    if (yok) throw ApiError.badRequest(`Reçetedeki malzeme kartı bulunamadı (#${yok}).`);
    const ic = ids.map((x) => bulunan.get(x)).find((x) => Number(x.R) === 1);
    if (ic) throw ApiError.badRequest(`"${temiz(ic.AD)}" reçeteli bir ürün; malzeme olamaz (iç içe reçete yok).`);
    const req = new sql.Request(tx).input("ID", sql.Int, id);
    const v = satirlar.map((x, j) => {
      const mk = typeof x.miktar === "string" ? Number(x.miktar.includes(",") ? x.miktar.replace(/\./g, "").replace(",", ".") : x.miktar) : Number(x.miktar);
      req.input(`K${j}`, sql.Int, x.malzemeKartId).input(`M${j}`, sql.Decimal(18, 4), Math.round(mk * 10000) / 10000);
      return `(@ID, ${j + 1}, @K${j}, @M${j})`;
    });
    await req.query(`UPDATE dbo.TODVZ_STOK_KART SET RECETELI = 1 WHERE STOK_KART_ID = @ID; DELETE FROM dbo.TODVZ_STOK_RECETE WHERE STOK_KART_ID = @ID;
      INSERT INTO dbo.TODVZ_STOK_RECETE (STOK_KART_ID, SATIR_NO, MALZEME_KART_ID, MIKTAR) VALUES ${v.join(",")};`);
  }

  /** Kartın ek birimleri ve barkodları (TA5) */
  static async kartBirimleri(pool: sql.ConnectionPool | sql.Transaction, stokKartId: number, stokBirimId?: number | null): Promise<EkBirim[]> {
    const r = await new sql.Request(pool as any).input("ID", sql.Int, stokKartId).input("BID", sql.Int, stokBirimId ?? null).query(`
      SELECT U.STOK_BIRIM_ID, RTRIM(U.BIRIM) AS BIRIM, U.CARPAN, U.SATIS_FIYATI,
        STUFF((SELECT '|' + B.BARKOD FROM dbo.TODVZ_STOK_BARKOD B WHERE B.STOK_BIRIM_ID = U.STOK_BIRIM_ID ORDER BY B.STOK_BARKOD_ID FOR XML PATH(''), TYPE).value('.', 'varchar(max)'), 1, 1, '') AS BARKODLAR
      FROM dbo.TODVZ_STOK_BIRIM U WHERE U.STOK_KART_ID = @ID AND (@BID IS NULL OR U.STOK_BIRIM_ID = @BID) ORDER BY U.SIRA, U.STOK_BIRIM_ID`);
    return r.recordset.map((x: any) => ({
      stokBirimId: x.STOK_BIRIM_ID,
      birim: temiz(x.BIRIM),
      carpan: Number(x.CARPAN),
      satisFiyati: x.SATIS_FIYATI === null || x.SATIS_FIYATI === undefined ? null : Number(x.SATIS_FIYATI),
      barkodlar: x.BARKODLAR ? String(x.BARKODLAR).split("|").filter(Boolean) : [],
    }));
  }

  /** Barkod ya da kod ile tam eşleşen kart (satış / giriş fişi okutması) */
  static async kartBul(deger: string, ctx?: DbBaglam, fiyatListesiId?: number | null): Promise<StokKart | null> {
    const t = temiz(deger);
    if (!t) return null;
    const pool = await this.havuz(ctx);
    // Kimlik önce bulunur (barkod / kod tekil indeksleri), kart sonra okunur: süzgeç içindeki alt sorgu bütün tabloyu taratıyordu
    // Ek birim barkodu (koli) okunduysa birim de döner (TA5)
    const r = await listeGirdisi(pool.request().input("D", sql.VarChar(50), t.slice(0, 50)), fiyatListesiId).query(`
      DECLARE @ID INT, @BID INT;
      SELECT TOP 1 @ID = B.STOK_KART_ID, @BID = B.STOK_BIRIM_ID FROM dbo.TODVZ_STOK_BARKOD B WHERE B.BARKOD = @D;
      IF @ID IS NULL SELECT TOP 1 @ID = K2.STOK_KART_ID FROM dbo.TODVZ_STOK_KART K2 WHERE K2.KOD = @D;
      SELECT ${KART_KOLONLARI}, @BID AS OKUNAN_BIRIM_ID FROM dbo.TODVZ_STOK_KART K${KART_BIRLESIM} WHERE K.STOK_KART_ID = @ID`);
    if (r.recordset.length) {
      const k = kartModeli(r.recordset[0]);
      const bid = r.recordset[0].OKUNAN_BIRIM_ID;
      if (bid) k.okunanBirim = (await this.kartBirimleri(pool, k.stokKartId, Number(bid)))[0];
      return k;
    }
    // Terazi etiketli barkod (TA3): kart barkodlarında yoksa etkin düzenlerden biriyle çözülür, kart TERAZI_KODU ile bulunur
    if (!/^\d{13}$/.test(t)) return null;
    const c = teraziBarkodCoz(t, await this.teraziDuzenleri(pool));
    if (!c) return null;
    const rt = await listeGirdisi(pool.request().input("PLU", sql.Int, c.plu), fiyatListesiId).query(`
      DECLARE @ID INT = (SELECT TOP 1 K2.STOK_KART_ID FROM dbo.TODVZ_STOK_KART K2 WHERE K2.TERAZI_KODU = @PLU);
      ${KART_SECIMI} WHERE K.STOK_KART_ID = @ID`);
    // Etiket çözüldü ama kod hiçbir karta bağlı değil: "yeni kart aç" akışına düşmesin (etiket her tartımda değişir)
    if (!rt.recordset.length) {
      throw new ApiError(HttpStatus.NOT_FOUND, `Terazi etiketi okundu ama ${c.plu} terazi kodlu stok kartı yok. Stok Kartları'nda ürünün "Terazi kodu" alanına ${c.plu} yazın.`, { kod: "TERAZI_KARTSIZ", plu: c.plu });
    }
    return { ...kartModeli(rt.recordset[0]), terazi: { barkod: t, plu: c.plu, agirlikKg: c.agirlikKg, fiyat: c.fiyat } };
  }

  /** Terazi barkodu düzenleri (TA3) */
  static async teraziDuzenleri(pool: sql.ConnectionPool | sql.Transaction): Promise<TeraziDuzeni[]> {
    const r = await new sql.Request(pool as any).query(`SELECT TERAZI_BARKOD_ID, ONEK, KOD_HANE, DEGER_TURU, ONDALIK, AKTIF, ACIKLAMA FROM dbo.TODVZ_TERAZI_BARKOD ORDER BY ONEK`);
    return r.recordset.map(teraziDuzeniModeli);
  }

  /** Bir sonraki otomatik kod: STK00001 */
  static async yeniKod(pool: sql.ConnectionPool | sql.Transaction): Promise<string> {
    const r = await new sql.Request(pool as any).query(`
      SELECT ISNULL(MAX(TRY_CAST(SUBSTRING(KOD, 4, 27) AS INT)), 0) + 1 AS N FROM dbo.TODVZ_STOK_KART WITH (UPDLOCK, HOLDLOCK)
      WHERE KOD LIKE 'STK%' AND TRY_CAST(SUBSTRING(KOD, 4, 27) AS INT) IS NOT NULL`);
    return `STK${String(Number(r.recordset[0].N) || 1).padStart(5, "0")}`;
  }

  /**
   * Kartı kaydeder (yeni ya da düzeltme). Açık işlem verilirse onun içinde çalışır (Excel yüklemesi), yoksa kendi işlemini açar.
   * Döner: kart kimliği.
   */
  static async kartYaz(tx: sql.Transaction, g: StokKartGirdi, kullaniciId?: number): Promise<number> {
    const { hatalar, deger: d } = kartGirdisiDenetle(g);
    if (hatalar.length) throw ApiError.badRequest(hatalar.join(" "));
    const id = Number(g.stokKartId) || 0;
    const kod = d.kod || (await this.yeniKod(tx));

    const ayniKod = await new sql.Request(tx).input("KOD", sql.VarChar(30), kod).input("ID", sql.Int, id)
      .query(`SELECT TOP 1 AD FROM dbo.TODVZ_STOK_KART WHERE KOD = @KOD AND STOK_KART_ID <> @ID`);
    if (ayniKod.recordset.length) throw ApiError.badRequest(`"${kod}" kodu "${temiz(ayniKod.recordset[0].AD)}" kartında kullanılıyor.`);
    // Ek birimler (TA5): verildiyse hepsi yeniden yazılır; verilmediyse (Excel) mevcut birim barkodları korunur
    const birimVar = Array.isArray(g.birimler);
    const birimler = birimVar ? (g.birimler as Partial<EkBirim>[]) : [];
    if (birimVar) {
      const bh = ekBirimleriDenetle(d.birim, birimler);
      if (bh.length) throw ApiError.badRequest(bh.join(" "));
    }
    const birimBarkodlari = birimler.flatMap((b) => (b.barkodlar || []).map((x) => temiz(x)).filter(Boolean));
    const tumBarkodlar = [...d.barkodlar, ...birimBarkodlari];
    const tekrarBarkod = tumBarkodlar.find((b, i) => tumBarkodlar.indexOf(b) !== i);
    if (tekrarBarkod) throw ApiError.badRequest(`"${tekrarBarkod}" barkodu kartta iki kez yazılmış (kart / ek birim).`);
    for (const b of tumBarkodlar) {
      if (b.length > 50 || /\s/.test(b)) throw ApiError.badRequest(`Barkod "${b}" geçersiz (en çok 50 karakter, boşluksuz).`);
      // Aynı kartın ek birim barkodu: birimler yeniden yazılıyorsa serbest, yazılmıyorsa (birim barkodu korunacak) çakışır
      const r = await new sql.Request(tx).input("B", sql.VarChar(50), b).input("ID", sql.Int, id).input("BV", sql.Bit, birimVar ? 1 : 0).query(`
        SELECT TOP 1 RTRIM(K.KOD) + ' ' + K.AD AS KART, CASE WHEN B.STOK_KART_ID = @ID THEN 1 ELSE 0 END AS AYNI FROM dbo.TODVZ_STOK_BARKOD B JOIN dbo.TODVZ_STOK_KART K ON K.STOK_KART_ID = B.STOK_KART_ID
        WHERE B.BARKOD = @B AND (B.STOK_KART_ID <> @ID OR (B.STOK_BIRIM_ID IS NOT NULL AND @BV = 0))`);
      if (r.recordset.length) throw ApiError.badRequest(Number(r.recordset[0].AYNI) ? `"${b}" barkodu bu kartın bir ek biriminde kullanılıyor.` : `"${b}" barkodu "${temiz(r.recordset[0].KART)}" kartında kullanılıyor.`);
    }
    if (d.stokGrupId) {
      const r = await new sql.Request(tx).input("G", sql.Int, d.stokGrupId).query(`SELECT 1 AS V FROM dbo.TODVZ_STOK_GRUP WHERE STOK_GRUP_ID = @G`);
      if (!r.recordset.length) throw ApiError.badRequest("Seçilen ürün grubu bulunamadı.");
    }
    if (d.paraId) {
      const r = await new sql.Request(tx).input("P", sql.Int, d.paraId).query(`SELECT 1 AS V FROM dbo.TODVZ_PARA WHERE PARA_ID = @P`);
      if (!r.recordset.length) throw ApiError.badRequest("Seçilen para birimi bulunamadı.");
    }
    // Adisyon KDV oranı (TA32): undefined dokunulmaz; boş = Adisyon ayarındaki varsayılan
    const adisyonKdv = g.adisyonKdvOrani === undefined ? undefined : g.adisyonKdvOrani === null || String(g.adisyonKdvOrani).trim() === "" ? null : Number(String(g.adisyonKdvOrani).replace(",", "."));
    if (adisyonKdv !== undefined && adisyonKdv !== null && !GECERLI_KDV_ORANLARI.includes(adisyonKdv)) throw ApiError.badRequest(`Adisyon KDV oranı ${adisyonKdv} olamaz.`);
    // Terazi PLU kodu (TA3): undefined dokunulmaz; dolu ise tekil ve yalnız tartılı (Kg / Gr) kartta
    const terazi = g.teraziKodu === undefined ? undefined : teraziKoduOku(g.teraziKodu);
    if (terazi === "hata") throw ApiError.badRequest("Terazi kodu 1 ile 999999 arasında tam sayı olmalı.");
    if (terazi) {
      if (!tartiBirimi(d.birim)) throw ApiError.badRequest("Terazi kodu yalnız Kg ya da Gr birimli karta verilir.");
      const r = await new sql.Request(tx).input("T", sql.Int, terazi).input("ID", sql.Int, id)
        .query(`SELECT TOP 1 RTRIM(KOD) + ' ' + AD AS KART FROM dbo.TODVZ_STOK_KART WHERE TERAZI_KODU = @T AND STOK_KART_ID <> @ID`);
      if (r.recordset.length) throw ApiError.badRequest(`Terazi kodu ${terazi} "${temiz(r.recordset[0].KART)}" kartında kullanılıyor.`);
    }

    const req = new sql.Request(tx)
      .input("ID", sql.Int, id)
      .input("KOD", sql.VarChar(30), kod)
      .input("AD", sql.NVarChar(200), d.ad)
      .input("GRUP", sql.Int, d.stokGrupId)
      .input("BIRIM", sql.VarChar(20), d.birim)
      .input("KDV", sql.Float, d.kdvOrani)
      .input("SATIS", sql.Float, d.satisFiyati)
      .input("DAHIL", sql.Bit, d.fiyatKdvDahil ? 1 : 0)
      .input("PARA", sql.Int, d.paraId)
      .input("ALIS", sql.Float, d.alisFiyati)
      .input("ENAZ", sql.Float, d.enAzStok)
      .input("AKTIF", sql.Bit, d.aktif ? 1 : 0)
      .input("ACIKLAMA", sql.NVarChar(500), d.aciklama)
      .input("KONTROL", sql.VarChar(10), d.stokKontrol)
      .input("TED", sql.Int, g.tedarikciCariId === undefined ? null : Number(g.tedarikciCariId) || null)
      .input("TEDVAR", sql.Bit, g.tedarikciCariId === undefined ? 0 : 1)
      .input("TRZ", sql.Int, terazi === undefined ? null : terazi)
      .input("TRZVAR", sql.Bit, terazi === undefined ? 0 : 1)
      .input("AKDV", sql.Decimal(5, 2), adisyonKdv === undefined ? null : adisyonKdv)
      .input("AKDVVAR", sql.Bit, adisyonKdv === undefined ? 0 : 1)
      .input("SKTT", sql.Bit, g.sktTakibi ? 1 : 0)
      .input("SKTVAR", sql.Bit, g.sktTakibi === undefined || g.sktTakibi === null ? 0 : 1)
      .input("KUL", sql.Int, kullaniciId || null);
    if (g.tedarikciCariId) {
      const c = await new sql.Request(tx).input("C", sql.Int, Number(g.tedarikciCariId)).query(`SELECT 1 AS V FROM dbo.TODVZ_CARI_KART WHERE CARI_KART_ID = @C`);
      if (!c.recordset.length) throw ApiError.badRequest("Seçilen tedarikçi cari bulunamadı.");
    }
    let yeniId = id;
    if (id) {
      // Reçetede malzeme olan kartın birimi değişmez (reçete miktarı o birimde)
      const bm = await new sql.Request(tx).input("ID", sql.Int, id).input("BIRIM", sql.VarChar(20), d.birim).query(`SELECT TOP 1 RTRIM(U.AD) AS URUN FROM dbo.TODVZ_STOK_RECETE R
        JOIN dbo.TODVZ_STOK_KART U ON U.STOK_KART_ID = R.STOK_KART_ID JOIN dbo.TODVZ_STOK_KART M ON M.STOK_KART_ID = R.MALZEME_KART_ID WHERE R.MALZEME_KART_ID = @ID AND RTRIM(ISNULL(M.BIRIM, '')) <> @BIRIM`);
      if (bm.recordset.length) throw ApiError.badRequest(`Bu kart "${temiz(bm.recordset[0].URUN)}" reçetesinde malzeme; birimi değiştirilemez.`);
      const r = await req.query(`
        UPDATE dbo.TODVZ_STOK_KART SET KOD = @KOD, AD = @AD, STOK_GRUP_ID = @GRUP, BIRIM = @BIRIM, KDV_ORANI = @KDV, SATIS_FIYATI = @SATIS,
          FIYAT_KDV_DAHIL = @DAHIL, PARA_ID = @PARA, ALIS_FIYATI = @ALIS, EN_AZ_STOK = @ENAZ, AKTIF = @AKTIF, ACIKLAMA = @ACIKLAMA,
          STOK_KONTROL = @KONTROL, TEDARIKCI_CARI_ID = CASE WHEN @TEDVAR = 1 THEN @TED ELSE TEDARIKCI_CARI_ID END,
          TERAZI_KODU = CASE WHEN @TRZVAR = 1 THEN @TRZ ELSE TERAZI_KODU END, SKT_TAKIBI = CASE WHEN @SKTVAR = 1 THEN @SKTT ELSE SKT_TAKIBI END,
          ADISYON_KDV_ORANI = CASE WHEN @AKDVVAR = 1 THEN @AKDV ELSE ADISYON_KDV_ORANI END,
          GUNCELLEYEN_ID = @KUL, GUNCELLEME_ZAMANI = GETDATE()
        WHERE STOK_KART_ID = @ID;
        SELECT @@ROWCOUNT AS N;`);
      if (!Number(r.recordset[0]?.N)) throw ApiError.notFound("Stok kartı bulunamadı.");
      // Hareket görmüş kartın birimi değişmez: eski miktarlar başka birimde kalır
      const birimDegisti = await new sql.Request(tx).input("ID", sql.Int, id).input("BIRIM", sql.VarChar(20), d.birim).query(`
        SELECT TOP 1 1 AS V FROM dbo.TODVZ_STOK_HAREKET H JOIN dbo.TODVZ_STOK_GIRIS_SATIRI S ON H.BELGE_TURU = 1 AND S.STOK_GIRIS_ID = H.BELGE_ID AND S.SATIR_NO = H.SATIR_NO
        WHERE H.STOK_KART_ID = @ID AND S.BIRIM <> @BIRIM
        UNION ALL
        SELECT TOP 1 1 FROM dbo.TODVZ_STOK_HAREKET H JOIN dbo.TODVZ_FATURA_SATIRI S ON H.BELGE_TURU = 2 AND S.FATURA_ID = H.BELGE_ID AND S.SATIR_NO = H.SATIR_NO
        WHERE H.STOK_KART_ID = @ID AND S.BIRIM <> @BIRIM
        UNION ALL
        SELECT TOP 1 1 FROM dbo.TODVZ_STOK_SAYIM_SATIR S WHERE S.STOK_KART_ID = @ID AND S.BIRIM <> @BIRIM
        UNION ALL
        SELECT TOP 1 1 FROM dbo.TODVZ_STOK_FIRE_SATIR S WHERE S.STOK_KART_ID = @ID AND S.BIRIM <> @BIRIM
        UNION ALL
        SELECT TOP 1 1 FROM dbo.TODVZ_STOK_TEDARIKCI_IADE_SATIR S WHERE S.STOK_KART_ID = @ID AND S.BIRIM <> @BIRIM
        UNION ALL
        SELECT TOP 1 1 FROM dbo.TODVZ_STOK_PARCALAMA_SATIR S WHERE S.STOK_KART_ID = @ID AND S.BIRIM <> @BIRIM
        UNION ALL
        SELECT TOP 1 1 FROM dbo.TODVZ_STOK_PARCALAMA P WHERE P.GIRDI_KART_ID = @ID AND P.GIRDI_BIRIM <> @BIRIM`);
      if (birimDegisti.recordset.length) throw ApiError.badRequest("Hareket görmüş kartın birimi değiştirilemez; yeni birim için yeni kart açın.");
    } else {
      const r = await req.query(`
        INSERT INTO dbo.TODVZ_STOK_KART (KOD, AD, STOK_GRUP_ID, BIRIM, KDV_ORANI, SATIS_FIYATI, FIYAT_KDV_DAHIL, PARA_ID, ALIS_FIYATI, EN_AZ_STOK, AKTIF, ACIKLAMA, STOK_KONTROL, TEDARIKCI_CARI_ID, TERAZI_KODU, SKT_TAKIBI, ADISYON_KDV_ORANI, EKLEYEN_ID)
        OUTPUT INSERTED.STOK_KART_ID
        VALUES (@KOD, @AD, @GRUP, @BIRIM, @KDV, @SATIS, @DAHIL, @PARA, @ALIS, @ENAZ, @AKTIF, @ACIKLAMA, @KONTROL, @TED, @TRZ, @SKTT, @AKDV, @KUL);`);
      yeniId = r.recordset[0].STOK_KART_ID;
    }
    // Kartın kendi barkodları; ek birimler verildiyse birimler ve barkodları da baştan
    await new sql.Request(tx).input("ID", sql.Int, yeniId).input("BV", sql.Bit, birimVar ? 1 : 0)
      .query(`DELETE FROM dbo.TODVZ_STOK_BARKOD WHERE STOK_KART_ID = @ID AND (@BV = 1 OR STOK_BIRIM_ID IS NULL)`);
    for (const b of d.barkodlar) {
      await new sql.Request(tx).input("ID", sql.Int, yeniId).input("B", sql.VarChar(50), b)
        .query(`INSERT INTO dbo.TODVZ_STOK_BARKOD (STOK_KART_ID, BARKOD) VALUES (@ID, @B)`);
    }
    if (birimVar) {
      await new sql.Request(tx).input("ID", sql.Int, yeniId).query(`DELETE FROM dbo.TODVZ_STOK_BIRIM WHERE STOK_KART_ID = @ID`);
      for (const [i, b] of birimler.entries()) {
        const fiyat = b.satisFiyati === null || b.satisFiyati === undefined || String(b.satisFiyati).trim() === "" ? null : Number(String(b.satisFiyati).replace(",", "."));
        const u = await new sql.Request(tx).input("ID", sql.Int, yeniId).input("BR", sql.VarChar(20), temiz(b.birim as any)).input("C", sql.Float, Number(String(b.carpan).replace(",", ".")))
          .input("F", sql.Float, fiyat).input("S", sql.Int, i)
          .query(`INSERT INTO dbo.TODVZ_STOK_BIRIM (STOK_KART_ID, BIRIM, CARPAN, SATIS_FIYATI, SIRA) OUTPUT INSERTED.STOK_BIRIM_ID VALUES (@ID, @BR, @C, @F, @S)`);
        const bid = u.recordset[0].STOK_BIRIM_ID;
        for (const x of (b.barkodlar || []).map((y) => temiz(y)).filter(Boolean)) {
          await new sql.Request(tx).input("ID", sql.Int, yeniId).input("BID", sql.Int, bid).input("B", sql.VarChar(50), x)
            .query(`INSERT INTO dbo.TODVZ_STOK_BARKOD (STOK_KART_ID, BARKOD, STOK_BIRIM_ID) VALUES (@ID, @B, @BID)`);
        }
      }
    }
    if (Array.isArray(g.listeFiyatlari)) await TicariFiyatSqlRepository.kartListeFiyatlariniYaz(tx, yeniId, g.listeFiyatlari, kullaniciId);
    await this.receteYaz(tx, yeniId, g);
    return yeniId;
  }

  /**
   * Çok sayıda kartı tek işlemde yazar (Excel yüklemesi; G2). Denetim kartYaz ile aynı (kod/barkod çakışması, grup, para
   * birimi, hareketli kartın birimi); kod boş olanlara STK numarası tek seferde verilir. Satırlar geçici tabloya 140'lık
   * paketlerle yüklenir, karşılaştırma ve yazma küme bazlı yapılır. Döner: girdi sırasıyla kart kimlikleri.
   */
  static async kartlariTopluYaz(tx: sql.Transaction, girdiler: StokKartGirdi[], kullaniciId?: number): Promise<number[]> {
    if (!girdiler.length) return [];
    const satirlar = girdiler.map((g, i) => {
      const { hatalar, deger } = kartGirdisiDenetle(g);
      if (hatalar.length) throw ApiError.badRequest(`${i + 1}. kayıt: ${hatalar.join(" ")}`);
      return { sira: i + 1, id: Number(g.stokKartId) || 0, deger };
    });
    // Dosya içi tekrarlar
    const kodlar = new Map<string, number>();
    const barkodlar = new Map<string, number>();
    for (const s of satirlar) {
      if (s.deger.kod) {
        if (kodlar.has(s.deger.kod)) throw ApiError.badRequest(`"${s.deger.kod}" kodu ${kodlar.get(s.deger.kod)}. ve ${s.sira}. kayıtta tekrar ediyor.`);
        kodlar.set(s.deger.kod, s.sira);
      }
      for (const b of s.deger.barkodlar) {
        if (barkodlar.has(b)) throw ApiError.badRequest(`"${b}" barkodu ${barkodlar.get(b)}. ve ${s.sira}. kayıtta tekrar ediyor.`);
        barkodlar.set(b, s.sira);
      }
    }
    // Mevcut kartta kod boş bırakıldıysa kartın kodu korunur (yeni kod üretilmez)
    const kodsuzMevcut = satirlar.filter((s) => !s.deger.kod && s.id);
    if (kodsuzMevcut.length) {
      const r = await new sql.Request(tx).query(`SELECT STOK_KART_ID, RTRIM(KOD) AS KOD FROM dbo.TODVZ_STOK_KART WHERE STOK_KART_ID IN (${[...new Set(kodsuzMevcut.map((s) => s.id))].join(",")})`);
      const m = new Map<number, string>(r.recordset.map((x: any) => [Number(x.STOK_KART_ID), String(x.KOD)]));
      for (const s of kodsuzMevcut) {
        const kod = m.get(s.id);
        if (!kod) throw ApiError.badRequest(`${s.sira}. kayıt: Stok kartı bulunamadı.`);
        if (kodlar.has(kod) && kodlar.get(kod) !== s.sira) throw ApiError.badRequest(`"${kod}" kodu ${kodlar.get(kod)}. ve ${s.sira}. kayıtta tekrar ediyor.`);
        s.deger.kod = kod;
        kodlar.set(kod, s.sira);
      }
    }
    // Otomatik kodlar: bir sonraki STK numarasından başlayarak, dosyadaki ve veritabanındaki kodlar atlanarak
    const kodsuz = satirlar.filter((s) => !s.deger.kod);
    if (kodsuz.length) {
      const ilk = Number((await this.yeniKod(tx)).slice(3)) || 1;
      const son = ilk + kodsuz.length + 1000;
      const dolu = new Set<string>((await new sql.Request(tx).input("A", sql.Int, ilk).input("B", sql.Int, son).query(`
        SELECT RTRIM(KOD) AS KOD FROM dbo.TODVZ_STOK_KART WHERE KOD LIKE 'STK%' AND TRY_CAST(SUBSTRING(KOD, 4, 27) AS INT) BETWEEN @A AND @B`)).recordset.map((x: any) => String(x.KOD)));
      let n = ilk;
      for (const s of kodsuz) {
        let kod = `STK${String(n).padStart(5, "0")}`;
        while (dolu.has(kod) || kodlar.has(kod)) { n++; kod = `STK${String(n).padStart(5, "0")}`; }
        s.deger.kod = kod;
        kodlar.set(kod, s.sira);
        n++;
      }
    }

    await new sql.Request(tx).batch(`
      IF OBJECT_ID('tempdb..#KART') IS NOT NULL DROP TABLE #KART;
      IF OBJECT_ID('tempdb..#BARKOD') IS NOT NULL DROP TABLE #BARKOD;
      -- Geçici tablolar tempdb'nin harmanlamasını alır (sunucu Turkish_CI_AS, firma veritabanı SQL_Latin1 olabilir): metin kolonları
      -- veritabanının harmanlamasıyla açılır, yoksa KOD / BARKOD karşılaştırmaları "collation conflict" verir (27.11.2026 canlı hatası)
      CREATE TABLE #KART (SIRA INT NOT NULL PRIMARY KEY, ID INT NULL, KOD VARCHAR(30) COLLATE DATABASE_DEFAULT NOT NULL, AD NVARCHAR(200) COLLATE DATABASE_DEFAULT NOT NULL, GRUP INT NULL,
        BIRIM VARCHAR(20) COLLATE DATABASE_DEFAULT NOT NULL, KDV FLOAT NOT NULL, SATIS FLOAT NULL, DAHIL BIT NOT NULL, PARA INT NULL, ALIS FLOAT NULL, ENAZ FLOAT NULL, AKTIF BIT NOT NULL,
        ACIKLAMA NVARCHAR(500) COLLATE DATABASE_DEFAULT NULL, KONTROL VARCHAR(10) COLLATE DATABASE_DEFAULT NULL, TED INT NULL, TEDVAR BIT NOT NULL);
      CREATE TABLE #BARKOD (SIRA INT NOT NULL, BARKOD VARCHAR(50) COLLATE DATABASE_DEFAULT NOT NULL);`);
    // 17 parametre / satır → 120 satır / paket (SQL Server sınırı 2.100 parametre)
    for (let i = 0; i < satirlar.length; i += 120) {
      const paket = satirlar.slice(i, i + 120);
      const req = new sql.Request(tx);
      const degerler = paket.map((s, j) => {
        const d = s.deger;
        req.input(`S${j}`, sql.Int, s.sira).input(`I${j}`, sql.Int, s.id || null).input(`K${j}`, sql.VarChar(30), d.kod).input(`A${j}`, sql.NVarChar(200), d.ad)
          .input(`G${j}`, sql.Int, d.stokGrupId).input(`B${j}`, sql.VarChar(20), d.birim).input(`V${j}`, sql.Float, d.kdvOrani).input(`F${j}`, sql.Float, d.satisFiyati)
          .input(`D${j}`, sql.Bit, d.fiyatKdvDahil ? 1 : 0).input(`P${j}`, sql.Int, d.paraId).input(`L${j}`, sql.Float, d.alisFiyati).input(`E${j}`, sql.Float, d.enAzStok)
          .input(`T${j}`, sql.Bit, d.aktif ? 1 : 0).input(`C${j}`, sql.NVarChar(500), d.aciklama).input(`N${j}`, sql.VarChar(10), d.stokKontrol)
          .input(`R${j}`, sql.Int, girdiler[s.sira - 1].tedarikciCariId === undefined ? null : Number(girdiler[s.sira - 1].tedarikciCariId) || null)
          .input(`W${j}`, sql.Bit, girdiler[s.sira - 1].tedarikciCariId === undefined ? 0 : 1);
        return `(@S${j}, @I${j}, @K${j}, @A${j}, @G${j}, @B${j}, @V${j}, @F${j}, @D${j}, @P${j}, @L${j}, @E${j}, @T${j}, @C${j}, @N${j}, @R${j}, @W${j})`;
      });
      await req.query(`INSERT INTO #KART (SIRA, ID, KOD, AD, GRUP, BIRIM, KDV, SATIS, DAHIL, PARA, ALIS, ENAZ, AKTIF, ACIKLAMA, KONTROL, TED, TEDVAR) VALUES ${degerler.join(",")}`);
    }
    const barkodSatirlari = satirlar.flatMap((s) => s.deger.barkodlar.map((b) => ({ sira: s.sira, b })));
    for (let i = 0; i < barkodSatirlari.length; i += 1000) {
      const paket = barkodSatirlari.slice(i, i + 1000);
      const req = new sql.Request(tx);
      const degerler = paket.map((x, j) => { req.input(`S${j}`, sql.Int, x.sira).input(`B${j}`, sql.VarChar(50), x.b); return `(@S${j}, @B${j})`; });
      await req.query(`INSERT INTO #BARKOD (SIRA, BARKOD) VALUES ${degerler.join(",")}`);
    }

    // Denetimler (ilk hata döner)
    const d = (await new sql.Request(tx).query(`
      SELECT TOP 1 'ID' AS TUR, T.SIRA, NULL AS BILGI FROM #KART T WHERE T.ID IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.TODVZ_STOK_KART K WHERE K.STOK_KART_ID = T.ID)
      UNION ALL SELECT TOP 1 'KOD', T.SIRA, RTRIM(T.KOD) COLLATE DATABASE_DEFAULT + '|' + K.AD FROM #KART T JOIN dbo.TODVZ_STOK_KART K ON K.KOD = T.KOD COLLATE DATABASE_DEFAULT WHERE K.STOK_KART_ID <> ISNULL(T.ID, 0)
      UNION ALL SELECT TOP 1 'BARKOD', X.SIRA, X.BARKOD COLLATE DATABASE_DEFAULT + '|' + RTRIM(K.KOD) + ' ' + K.AD FROM #BARKOD X JOIN #KART T ON T.SIRA = X.SIRA
        JOIN dbo.TODVZ_STOK_BARKOD B ON B.BARKOD = X.BARKOD COLLATE DATABASE_DEFAULT JOIN dbo.TODVZ_STOK_KART K ON K.STOK_KART_ID = B.STOK_KART_ID WHERE B.STOK_KART_ID <> ISNULL(T.ID, 0) OR B.STOK_BIRIM_ID IS NOT NULL
      UNION ALL SELECT TOP 1 'GRUP', T.SIRA, NULL FROM #KART T WHERE T.GRUP IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.TODVZ_STOK_GRUP G WHERE G.STOK_GRUP_ID = T.GRUP)
      UNION ALL SELECT TOP 1 'PARA', T.SIRA, NULL FROM #KART T WHERE T.PARA IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.TODVZ_PARA P WHERE P.PARA_ID = T.PARA)
      UNION ALL SELECT TOP 1 'TED', T.SIRA, NULL FROM #KART T WHERE T.TED IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.TODVZ_CARI_KART C WHERE C.CARI_KART_ID = T.TED)
      UNION ALL SELECT TOP 1 'BIRIM', T.SIRA, NULL FROM #KART T JOIN dbo.TODVZ_STOK_HAREKET H ON H.STOK_KART_ID = T.ID
        JOIN dbo.TODVZ_STOK_GIRIS_SATIRI S ON H.BELGE_TURU = 1 AND S.STOK_GIRIS_ID = H.BELGE_ID AND S.SATIR_NO = H.SATIR_NO WHERE S.BIRIM <> T.BIRIM COLLATE DATABASE_DEFAULT
      UNION ALL SELECT TOP 1 'BIRIM', T.SIRA, NULL FROM #KART T JOIN dbo.TODVZ_STOK_HAREKET H ON H.STOK_KART_ID = T.ID
        JOIN dbo.TODVZ_FATURA_SATIRI S ON H.BELGE_TURU = 2 AND S.FATURA_ID = H.BELGE_ID AND S.SATIR_NO = H.SATIR_NO WHERE S.BIRIM <> T.BIRIM COLLATE DATABASE_DEFAULT
      UNION ALL SELECT TOP 1 'BIRIM', T.SIRA, NULL FROM #KART T JOIN dbo.TODVZ_STOK_SAYIM_SATIR S ON S.STOK_KART_ID = T.ID WHERE S.BIRIM <> T.BIRIM COLLATE DATABASE_DEFAULT
      UNION ALL SELECT TOP 1 'BIRIM', T.SIRA, NULL FROM #KART T JOIN dbo.TODVZ_STOK_FIRE_SATIR S ON S.STOK_KART_ID = T.ID WHERE S.BIRIM <> T.BIRIM COLLATE DATABASE_DEFAULT
      UNION ALL SELECT TOP 1 'BIRIM', T.SIRA, NULL FROM #KART T JOIN dbo.TODVZ_STOK_TEDARIKCI_IADE_SATIR S ON S.STOK_KART_ID = T.ID WHERE S.BIRIM <> T.BIRIM COLLATE DATABASE_DEFAULT
      UNION ALL SELECT TOP 1 'BIRIM', T.SIRA, NULL FROM #KART T JOIN dbo.TODVZ_STOK_PARCALAMA_SATIR S ON S.STOK_KART_ID = T.ID WHERE S.BIRIM <> T.BIRIM COLLATE DATABASE_DEFAULT
      UNION ALL SELECT TOP 1 'BIRIM', T.SIRA, NULL FROM #KART T JOIN dbo.TODVZ_STOK_PARCALAMA P ON P.GIRDI_KART_ID = T.ID WHERE P.GIRDI_BIRIM <> T.BIRIM COLLATE DATABASE_DEFAULT`)).recordset[0];
    if (d) {
      const [a, b] = String(d.BILGI || "").split("|");
      const mesaj = d.TUR === "ID" ? "Stok kartı bulunamadı."
        : d.TUR === "KOD" ? `"${a}" kodu "${temiz(b)}" kartında kullanılıyor.`
        : d.TUR === "BARKOD" ? `"${a}" barkodu "${temiz(b)}" kartında kullanılıyor.`
        : d.TUR === "GRUP" ? "Seçilen ürün grubu bulunamadı."
        : d.TUR === "PARA" ? "Seçilen para birimi bulunamadı."
        : d.TUR === "TED" ? "Seçilen tedarikçi cari bulunamadı."
        : "Hareket görmüş kartın birimi değiştirilemez; yeni birim için yeni kart açın.";
      throw ApiError.badRequest(`${d.SIRA}. kayıt: ${mesaj}`);
    }

    const r = await new sql.Request(tx).input("KUL", sql.Int, kullaniciId || null).query(`
      UPDATE K SET KOD = T.KOD, AD = T.AD, STOK_GRUP_ID = T.GRUP, BIRIM = T.BIRIM, KDV_ORANI = T.KDV, SATIS_FIYATI = T.SATIS, FIYAT_KDV_DAHIL = T.DAHIL,
        PARA_ID = T.PARA, ALIS_FIYATI = T.ALIS, EN_AZ_STOK = T.ENAZ, AKTIF = T.AKTIF, ACIKLAMA = T.ACIKLAMA, STOK_KONTROL = T.KONTROL,
        TEDARIKCI_CARI_ID = CASE WHEN T.TEDVAR = 1 THEN T.TED ELSE K.TEDARIKCI_CARI_ID END, GUNCELLEYEN_ID = @KUL, GUNCELLEME_ZAMANI = GETDATE()
      FROM dbo.TODVZ_STOK_KART K JOIN #KART T ON T.ID = K.STOK_KART_ID;
      INSERT INTO dbo.TODVZ_STOK_KART (KOD, AD, STOK_GRUP_ID, BIRIM, KDV_ORANI, SATIS_FIYATI, FIYAT_KDV_DAHIL, PARA_ID, ALIS_FIYATI, EN_AZ_STOK, AKTIF, ACIKLAMA, STOK_KONTROL, TEDARIKCI_CARI_ID, EKLEYEN_ID)
      SELECT T.KOD, T.AD, T.GRUP, T.BIRIM, T.KDV, T.SATIS, T.DAHIL, T.PARA, T.ALIS, T.ENAZ, T.AKTIF, T.ACIKLAMA, T.KONTROL, T.TED, @KUL FROM #KART T WHERE T.ID IS NULL ORDER BY T.SIRA;
      UPDATE T SET ID = K.STOK_KART_ID FROM #KART T JOIN dbo.TODVZ_STOK_KART K ON K.KOD = T.KOD COLLATE DATABASE_DEFAULT WHERE T.ID IS NULL;
      DELETE B FROM dbo.TODVZ_STOK_BARKOD B JOIN #KART T ON T.ID = B.STOK_KART_ID WHERE B.STOK_BIRIM_ID IS NULL;
      INSERT INTO dbo.TODVZ_STOK_BARKOD (STOK_KART_ID, BARKOD) SELECT T.ID, X.BARKOD FROM #BARKOD X JOIN #KART T ON T.SIRA = X.SIRA ORDER BY X.SIRA;
      SELECT SIRA, ID FROM #KART ORDER BY SIRA;
      DROP TABLE #BARKOD; DROP TABLE #KART;`);
    const sets = (r.recordsets as any[]) || [];
    const son = sets.length ? sets[sets.length - 1] : r.recordset;
    const idler = new Map<number, number>((son || []).map((x: any) => [Number(x.SIRA), Number(x.ID)]));
    const sonuc = satirlar.map((s) => idler.get(s.sira) || 0);
    // Liste fiyatları (Excel "Fiyat: <liste>" sütunları)
    for (let i = 0; i < girdiler.length; i++) {
      const lf = girdiler[i].listeFiyatlari;
      if (Array.isArray(lf) && lf.length && sonuc[i]) await TicariFiyatSqlRepository.kartListeFiyatlariniYaz(tx, sonuc[i], lf, kullaniciId);
    }
    return sonuc;
  }

  static async kartKaydet(g: StokKartGirdi, kullaniciId: number | undefined, ctx?: DbBaglam): Promise<StokKart> {
    const pool = await this.havuz(ctx);
    const tx = new sql.Transaction(pool);
    await tx.begin();
    let id = 0;
    try {
      id = await this.kartYaz(tx, g, kullaniciId);
      await tx.commit();
    } catch (e) {
      await tx.rollback().catch(() => undefined);
      throw e;
    }
    if (g.resim !== undefined) await this.resimYaz(id, g.resim, ctx);
    return (await this.kart(id, ctx, true))!;
  }

  static async resimYaz(id: number, resim: string | null, ctx?: DbBaglam): Promise<void> {
    const pool = await this.havuz(ctx);
    const liste = resim ? [resim] : [];
    const yollar = await UrunResimSqlRepository.syncResimlerForIslem(STOK_RESIM_TIPI, id, liste, ctx);
    await pool.request().input("ID", sql.Int, id).input("R", sql.NVarChar(260), liste.length && yollar.length ? "1" : null)
      .query(`UPDATE dbo.TODVZ_STOK_KART SET RESIM = @R WHERE STOK_KART_ID = @ID`);
  }

  static async kartSil(id: number, ctx?: DbBaglam): Promise<void> {
    const pool = await this.havuz(ctx);
    const r = await pool.request().input("ID", sql.Int, id).query(`
      SELECT (SELECT COUNT(*) FROM dbo.TODVZ_STOK_HAREKET WHERE STOK_KART_ID = @ID)
           + (SELECT COUNT(*) FROM dbo.TODVZ_STOK_GIRIS_SATIRI WHERE STOK_KART_ID = @ID)
           + (SELECT COUNT(*) FROM dbo.TODVZ_FATURA_SATIRI WHERE STOK_KART_ID = @ID)
           + (SELECT COUNT(*) FROM dbo.TODVZ_STOK_SAYIM_SATIR WHERE STOK_KART_ID = @ID)
           + (SELECT COUNT(*) FROM dbo.TODVZ_STOK_FIRE_SATIR WHERE STOK_KART_ID = @ID)
           + (SELECT COUNT(*) FROM dbo.TODVZ_STOK_TEDARIKCI_IADE_SATIR WHERE STOK_KART_ID = @ID)
           + (SELECT COUNT(*) FROM dbo.TODVZ_STOK_PARCALAMA_SATIR WHERE STOK_KART_ID = @ID)
           + (SELECT COUNT(*) FROM dbo.TODVZ_STOK_PARCALAMA WHERE GIRDI_KART_ID = @ID)
           + (SELECT COUNT(*) FROM dbo.TODVZ_STOK_PARCALAMA_SABLON WHERE GIRDI_KART_ID = @ID)
           + (SELECT COUNT(*) FROM dbo.TODVZ_STOK_PARCALAMA_SABLON_SATIR WHERE STOK_KART_ID = @ID)
           + (SELECT COUNT(*) FROM dbo.TODVZ_STOK_RECETE WHERE MALZEME_KART_ID = @ID) AS N`);
    if (Number(r.recordset[0]?.N) > 0) throw ApiError.badRequest("Hareket görmüş stok kartı (sayım / fire taslağı, parçalama şablonu, reçete malzemesi dahil) silinemez; kartı pasif yapın.");
    // T13 / M12 (26.11.2026 denetimi): açık adisyonda kalemi olan kart silinmez (kasada fiş yazılamazdı)
    const ad = await pool.request().input("ID", sql.Int, id).query(`IF OBJECT_ID('dbo.TODVZ_ADISYON_KALEM', 'U') IS NULL SELECT 0 AS N
      ELSE SELECT COUNT(*) AS N FROM dbo.TODVZ_ADISYON_KALEM K JOIN dbo.TODVZ_ADISYON A ON A.ADISYON_ID = K.ADISYON_ID
        WHERE K.STOK_KART_ID = @ID AND K.IPTAL = 0 AND K.FATURA_ID IS NULL AND A.DURUM IN (0, 1)`);
    if (Number(ad.recordset[0]?.N) > 0) throw ApiError.badRequest("Bu ürün açık bir adisyonda var; adisyon kapanmadan kart silinemez (kartı pasif yapabilirsiniz).");
    const tx = new sql.Transaction(pool);
    await tx.begin();
    try {
      await new sql.Request(tx).input("ID", sql.Int, id).query(`DELETE FROM dbo.TODVZ_STOK_BARKOD WHERE STOK_KART_ID = @ID; DELETE FROM dbo.TODVZ_STOK_BIRIM WHERE STOK_KART_ID = @ID`);
      // T13: karta bağlı tanım satırları da silinir (eskiden yabancı anahtar hatası 500 veriyordu): kendi reçetesi, e-Fatura eşleşmeleri,
      // Adisyon porsiyon / seçenek bağları. Hareket tabloları yukarıda denetlendi (kart hareketsiz).
      await new sql.Request(tx).input("ID", sql.Int, id).query(`
        IF OBJECT_ID('dbo.TODVZ_STOK_RECETE', 'U') IS NOT NULL DELETE FROM dbo.TODVZ_STOK_RECETE WHERE STOK_KART_ID = @ID;
        IF OBJECT_ID('dbo.TODVZ_STOK_EFATURA_ESLESME', 'U') IS NOT NULL DELETE FROM dbo.TODVZ_STOK_EFATURA_ESLESME WHERE STOK_KART_ID = @ID;
        IF OBJECT_ID('dbo.TODVZ_ADISYON_KART_SECENEK', 'U') IS NOT NULL DELETE FROM dbo.TODVZ_ADISYON_KART_SECENEK WHERE STOK_KART_ID = @ID;
        IF OBJECT_ID('dbo.TODVZ_ADISYON_PORSIYON', 'U') IS NOT NULL DELETE FROM dbo.TODVZ_ADISYON_PORSIYON WHERE STOK_KART_ID = @ID;`);
      const s = await new sql.Request(tx).input("ID", sql.Int, id).query(`DELETE FROM dbo.TODVZ_STOK_KART WHERE STOK_KART_ID = @ID; SELECT @@ROWCOUNT AS N`);
      if (!Number(s.recordset[0]?.N)) throw ApiError.notFound("Stok kartı bulunamadı.");
      await tx.commit();
    } catch (e) {
      await tx.rollback().catch(() => undefined);
      throw e;
    }
    await UrunResimSqlRepository.syncResimlerForIslem(STOK_RESIM_TIPI, id, [], ctx).catch(() => undefined);
  }

  // ───────────── Raporlar ─────────────

  /**
   * Stok Durum Listesi: tarih itibarıyla giriş / çıkış / kalan, son alış fiyatıyla değer, en az stok uyarısı.
   * Satırlar en çok RAPOR_SATIR_SINIRI (toplamlar bütün süzgeç kümesi üzerinden SQL'de); aşarsa kesildi = true.
   */
  static async stokDurum(f: { tarih?: string | null; grupId?: number | null; arama?: string | null; yalnizEksik?: boolean; pasifler?: boolean } = {}, ctx?: DbBaglam) {
    const pool = await this.havuz(ctx);
    const req = pool.request();
    const kosul: string[] = kartKosulu(req, { arama: f.arama, grupId: f.grupId, aktif: f.pasifler ? null : true });
    req.input("TARIH", sql.VarChar(10), f.tarih ? temiz(f.tarih).slice(0, 10) : null).input("SINIR", sql.Int, RAPOR_SATIR_SINIRI);
    const r = await req.query(`
      SELECT K.STOK_KART_ID, K.KOD, K.AD, G.AD AS GRUP_ADI, K.BIRIM, K.EN_AZ_STOK, K.AKTIF,
        ISNULL(H.GIRIS, 0) AS GIRIS, ISNULL(H.CIKIS, 0) AS CIKIS, ISNULL(H.GIRIS, 0) - ISNULL(H.CIKIS, 0) AS BAKIYE,
        COALESCE(K.SON_ALIS_FIYATI, K.ALIS_FIYATI) AS MALIYET, K.SATIS_FIYATI, K.FIYAT_KDV_DAHIL, K.KDV_ORANI, H.SON_HAREKET
      INTO #R
      FROM dbo.TODVZ_STOK_KART K
      LEFT JOIN dbo.TODVZ_STOK_GRUP G ON G.STOK_GRUP_ID = K.STOK_GRUP_ID
      LEFT JOIN (SELECT X.STOK_KART_ID, SUM(X.GIRIS) AS GIRIS, SUM(X.CIKIS) AS CIKIS, MAX(X.TARIH) AS SON_HAREKET FROM dbo.TODVZ_STOK_HAREKET X
                 WHERE (@TARIH IS NULL OR CAST(DATEADD(hour, 3, X.TARIH) AS date) <= CAST(@TARIH AS date)) GROUP BY X.STOK_KART_ID) H ON H.STOK_KART_ID = K.STOK_KART_ID
      ${kosul.length ? "WHERE " + kosul.join(" AND ") : ""};
      ${f.yalnizEksik ? "DELETE FROM #R WHERE NOT ((EN_AZ_STOK IS NOT NULL AND BAKIYE < EN_AZ_STOK) OR BAKIYE < 0);" : ""}
      SELECT COUNT(*) AS KART, ISNULL(SUM(CASE WHEN MALIYET IS NULL THEN 0 ELSE ROUND(BAKIYE * MALIYET, 2) END), 0) AS DEGER,
        SUM(CASE WHEN EN_AZ_STOK IS NOT NULL AND BAKIYE < EN_AZ_STOK THEN 1 ELSE 0 END) AS EKSIK, SUM(CASE WHEN BAKIYE < 0 THEN 1 ELSE 0 END) AS EKSI FROM #R;
      SELECT TOP (@SINIR) * FROM #R ORDER BY GRUP_ADI, AD;
      DROP TABLE #R;`);
    const sets = (r.recordsets as any[]) || [];
    const ozet = sets[0]?.[0] || {};
    const y4 = (n: unknown) => Math.round((Number(n) || 0) * 10000) / 10000;
    const satirlar = (sets[1] || [])
      .map((x: any) => {
        const bakiye = y4(x.BAKIYE);
        const maliyet = x.MALIYET === null || x.MALIYET === undefined ? null : Number(x.MALIYET);
        const enAz = x.EN_AZ_STOK === null || x.EN_AZ_STOK === undefined ? null : Number(x.EN_AZ_STOK);
        return {
          stokKartId: x.STOK_KART_ID,
          kod: temiz(x.KOD),
          ad: temiz(x.AD),
          grupAdi: x.GRUP_ADI ? temiz(x.GRUP_ADI) : "",
          birim: temiz(x.BIRIM),
          giris: y4(x.GIRIS),
          cikis: y4(x.CIKIS),
          bakiye,
          enAzStok: enAz,
          eksik: enAz !== null && bakiye < enAz,
          maliyet,
          deger: maliyet === null ? null : Math.round(bakiye * maliyet * 100) / 100,
          sonHareket: x.SON_HAREKET ? new Date(x.SON_HAREKET).toISOString() : null,
          aktif: x.AKTIF === true || x.AKTIF === 1,
        };
      });
    const kart = Number(ozet.KART) || 0;
    return {
      satirlar,
      toplam: {
        kart,
        deger: Math.round((Number(ozet.DEGER) || 0) * 100) / 100,
        eksik: Number(ozet.EKSIK) || 0,
        eksiBakiye: Number(ozet.EKSI) || 0,
      },
      kesildi: kart > satirlar.length,
      sinir: RAPOR_SATIR_SINIRI,
    };
  }

  /** Ürün Hareket Listesi: kartın (ya da tüm kartların) tarih aralığındaki giriş / çıkışları, devir ve yürüyen bakiye */
  static async hareketler(f: { stokKartId?: number | null; baslangic?: string | null; bitis?: string | null; belgeTuru?: number | null; grupId?: number | null } = {}, ctx?: DbBaglam) {
    const pool = await this.havuz(ctx);
    const req = pool.request();
    const bas = f.baslangic ? temiz(f.baslangic).slice(0, 10) : null;
    const bit = f.bitis ? temiz(f.bitis).slice(0, 10) : null;
    req.input("BAS", sql.VarChar(10), bas).input("BIT", sql.VarChar(10), bit);
    const kosul: string[] = [];
    if (f.stokKartId) { req.input("KART", sql.Int, f.stokKartId); kosul.push("H.STOK_KART_ID = @KART"); }
    if (f.grupId) { req.input("GRUP", sql.Int, f.grupId); kosul.push("K.STOK_GRUP_ID = @GRUP"); }
    const turKosulu = f.belgeTuru ? (req.input("TUR", sql.TinyInt, f.belgeTuru), " AND H.BELGE_TURU = @TUR") : "";
    const gun = "CAST(DATEADD(hour, 3, H.TARIH) AS date)";
    req.input("SINIR", sql.Int, RAPOR_SATIR_SINIRI + 1);
    const r = await req.query(`
      SELECT COUNT(*) AS N, ISNULL(SUM(H.GIRIS), 0) AS GIRIS, ISNULL(SUM(H.CIKIS), 0) AS CIKIS
      FROM dbo.TODVZ_STOK_HAREKET H JOIN dbo.TODVZ_STOK_KART K ON K.STOK_KART_ID = H.STOK_KART_ID
      WHERE (@BAS IS NULL OR ${gun} >= CAST(@BAS AS date)) AND (@BIT IS NULL OR ${gun} <= CAST(@BIT AS date))${turKosulu}
        ${kosul.length ? "AND " + kosul.join(" AND ") : ""};
      WITH D AS (
        SELECT H.STOK_KART_ID, SUM(H.GIRIS - H.CIKIS) AS DEVIR FROM dbo.TODVZ_STOK_HAREKET H JOIN dbo.TODVZ_STOK_KART K ON K.STOK_KART_ID = H.STOK_KART_ID
        WHERE @BAS IS NOT NULL AND ${gun} < CAST(@BAS AS date) ${kosul.length ? "AND " + kosul.join(" AND ") : ""}
        GROUP BY H.STOK_KART_ID
      )
      SELECT TOP (@SINIR) H.STOK_HAREKET_ID, H.STOK_KART_ID, RTRIM(K.KOD) AS KOD, K.AD, K.BIRIM, H.TARIH, H.BELGE_TURU, H.BELGE_ID, H.SATIR_NO,
        H.GIRIS, H.CIKIS, H.BIRIM_FIYAT, ISNULL(D.DEVIR, 0) AS DEVIR,
        CASE H.BELGE_TURU WHEN 1 THEN SG.FIS_NO WHEN 3 THEN SY.SAYIM_NO WHEN 4 THEN FR.FIRE_NO WHEN 5 THEN TI.IADE_NO WHEN 6 THEN PR.PARCALAMA_NO WHEN 7 THEN F7.FATURA_NO ELSE F.FATURA_NO END AS BELGE_NO,
        CASE H.BELGE_TURU WHEN 1 THEN COALESCE(C.AD, SG.ACIKLAMA) WHEN 3 THEN CASE WHEN H.GIRIS > 0 THEN N'Sayım fazlası' ELSE N'Sayım eksiği' END
          WHEN 4 THEN FS.NEDEN WHEN 5 THEN TC.AD WHEN 6 THEN CASE WHEN H.CIKIS > 0 THEN N'Parçalanan' ELSE N'Parça: ' + RTRIM(PK.AD) END WHEN 7 THEN N'Reçete: ' + RTRIM(S7.URUN_ADI) ELSE F.ALICI_UNVAN END AS KARSI_TARAF, ISNULL(F.FATURA_TIPI, 1) AS FATURA_TIPI
      FROM dbo.TODVZ_STOK_HAREKET H
      JOIN dbo.TODVZ_STOK_KART K ON K.STOK_KART_ID = H.STOK_KART_ID
      LEFT JOIN D ON D.STOK_KART_ID = H.STOK_KART_ID
      LEFT JOIN dbo.TODVZ_STOK_GIRIS SG ON H.BELGE_TURU = 1 AND SG.STOK_GIRIS_ID = H.BELGE_ID
      LEFT JOIN dbo.TODVZ_CARI_KART C ON C.CARI_KART_ID = SG.CARI_KART_ID
      LEFT JOIN dbo.TODVZ_FATURA F ON H.BELGE_TURU = 2 AND F.FATURA_ID = H.BELGE_ID
      LEFT JOIN dbo.TODVZ_STOK_SAYIM SY ON H.BELGE_TURU = 3 AND SY.SAYIM_ID = H.BELGE_ID
      LEFT JOIN dbo.TODVZ_STOK_FIRE FR ON H.BELGE_TURU = 4 AND FR.FIRE_ID = H.BELGE_ID
      LEFT JOIN dbo.TODVZ_STOK_FIRE_SATIR FS ON H.BELGE_TURU = 4 AND FS.FIRE_ID = H.BELGE_ID AND FS.SATIR_NO = H.SATIR_NO
      LEFT JOIN dbo.TODVZ_STOK_TEDARIKCI_IADE TI ON H.BELGE_TURU = 5 AND TI.IADE_ID = H.BELGE_ID
      LEFT JOIN dbo.TODVZ_CARI_KART TC ON TC.CARI_KART_ID = TI.CARI_KART_ID
      LEFT JOIN dbo.TODVZ_STOK_PARCALAMA PR ON H.BELGE_TURU = 6 AND PR.PARCALAMA_ID = H.BELGE_ID
      LEFT JOIN dbo.TODVZ_STOK_KART PK ON PK.STOK_KART_ID = PR.GIRDI_KART_ID
      LEFT JOIN dbo.TODVZ_FATURA F7 ON H.BELGE_TURU = 7 AND F7.FATURA_ID = H.BELGE_ID
      LEFT JOIN dbo.TODVZ_FATURA_SATIRI S7 ON H.BELGE_TURU = 7 AND S7.FATURA_ID = H.BELGE_ID AND S7.SATIR_NO = H.SATIR_NO
      WHERE (@BAS IS NULL OR ${gun} >= CAST(@BAS AS date)) AND (@BIT IS NULL OR ${gun} <= CAST(@BIT AS date))${turKosulu}
        ${kosul.length ? "AND " + kosul.join(" AND ") : ""}
      ORDER BY K.AD, K.STOK_KART_ID, H.TARIH, H.STOK_HAREKET_ID`);
    const y4 = (n: unknown) => Math.round((Number(n) || 0) * 10000) / 10000;
    const hsets = (r.recordsets as any[]) || [];
    const hozet = hsets[0]?.[0] || {};
    const kesildi = (hsets[1] || []).length > RAPOR_SATIR_SINIRI;
    const bakiyeler = new Map<number, number>();
    const satirlar = (hsets[1] || []).slice(0, RAPOR_SATIR_SINIRI).map((x: any) => {
      // Belge türü süzgecinde yürüyen bakiye anlamsızdır; yalnız süzgeçsizken hesaplanır
      const onceki = bakiyeler.has(x.STOK_KART_ID) ? bakiyeler.get(x.STOK_KART_ID)! : y4(x.DEVIR);
      const bakiye = y4(onceki + Number(x.GIRIS) - Number(x.CIKIS));
      bakiyeler.set(x.STOK_KART_ID, bakiye);
      return {
        stokHareketId: x.STOK_HAREKET_ID,
        stokKartId: x.STOK_KART_ID,
        kod: temiz(x.KOD),
        ad: temiz(x.AD),
        birim: temiz(x.BIRIM),
        tarih: new Date(x.TARIH).toISOString(),
        belgeTuru: Number(x.BELGE_TURU),
        // Satış iadesi (TA6): fatura belgesi, FATURA_TIPI 2
        belgeTuruAdi: Number(x.BELGE_TURU) === STOK_BELGE.SATIS && Number(x.FATURA_TIPI) === 2 ? "Satış İadesi" : STOK_BELGE_ADI[Number(x.BELGE_TURU)] || "",
        /** Satış iadesi (fatura belgesi, FATURA_TIPI 2): ekran rozeti ve belge açma için */
        iade: Number(x.BELGE_TURU) === STOK_BELGE.SATIS && Number(x.FATURA_TIPI) === 2,
        belgeId: x.BELGE_ID,
        belgeNo: temiz(x.BELGE_NO),
        karsiTaraf: temiz(x.KARSI_TARAF),
        giris: y4(x.GIRIS),
        cikis: y4(x.CIKIS),
        birimFiyat: x.BIRIM_FIYAT === null || x.BIRIM_FIYAT === undefined ? null : Number(x.BIRIM_FIYAT),
        bakiye: f.belgeTuru ? null : bakiye,
      };
    });
    // Devirler yalnız listedeki kartlar (ve seçili kart) için: bütün kartların deviri 200.000 kartlı firmada 20 MB'lık liste oluyordu (G2)
    const devirKartlari = [...new Set([...satirlar.map((x: any) => Number(x.stokKartId)), ...(f.stokKartId ? [Number(f.stokKartId)] : [])])].filter((x) => x > 0);
    const devirler = f.belgeTuru || !bas || !devirKartlari.length ? [] : (await (async () => {
      const sonuc: any[] = [];
      for (let i = 0; i < devirKartlari.length; i += 1000) {
        const q = pool.request().input("BAS", sql.VarChar(10), bas);
        const d = await q.query(`SELECT H.STOK_KART_ID, RTRIM(K.KOD) AS KOD, K.AD, K.BIRIM, SUM(H.GIRIS - H.CIKIS) AS DEVIR
          FROM dbo.TODVZ_STOK_HAREKET H JOIN dbo.TODVZ_STOK_KART K ON K.STOK_KART_ID = H.STOK_KART_ID
          WHERE ${gun} < CAST(@BAS AS date) AND H.STOK_KART_ID IN (${devirKartlari.slice(i, i + 1000).join(",")}) GROUP BY H.STOK_KART_ID, K.KOD, K.AD, K.BIRIM`);
        sonuc.push(...d.recordset);
      }
      return sonuc.map((x: any) => ({ stokKartId: x.STOK_KART_ID, kod: temiz(x.KOD), ad: temiz(x.AD), birim: temiz(x.BIRIM), devir: y4(x.DEVIR) }));
    })());
    return {
      satirlar,
      devirler,
      toplam: { giris: y4(hozet.GIRIS), cikis: y4(hozet.CIKIS) },
      toplamSatir: Number(hozet.N) || 0,
      kesildi,
      sinir: RAPOR_SATIR_SINIRI,
    };
  }
}
