import sql from "mssql";
import { DbBaglam } from "../../models/ticariStokSql.repository.js";
import { AdisyonTanimSqlRepository } from "../../models/adisyonTanimSql.repository.js";
import { logger } from "../../utils/logger.js";

/**
 * Adisyon canlı eşitleme (docs/TICARI_ADISYON_YOL_HARITASI.md, TA22, D3). Kaynak veritabanındaki olay tablosudur
 * (TODVZ_ADISYON_OLAY): her yazan işlem kendi işleminde bir olay satırı ekler. Firma veritabanı başına tek okuyucu, abonesi
 * varken yeni olayları okur ve bütün bağlı ekranlara (PC, garson telefonu, mutfak ekranı) dağıtır.
 *
 * Sunucu yükü (26.11.2026 denetimi): aynı süreçteki yazma `olayTetikle` ile beklemeden okutulur; zamanlı yoklama yalnız başka
 * süreçten / sunucudan yazılan olaylar içindir. Bu yüzden son olaydan sonraki 20 sn saniyede bir, sonra 3 sn'de bir yoklanır
 * (gece açık kalan tek ekran veritabanını saniyede bir sorgulamaz); okuma hatasında aralık 30 sn'ye kadar uzar.
 *
 * Kaçan olay olmasın: okuma kilitli (henüz onaylanmamış) satırları atlar (READPAST) — uzun bir tahsilat işlemi bütün ekranların
 * akışını durdurmaz. Atlanan ya da sıra numarası küçük olup geç onaylanan olay, sonraki okumada geri bakış penceresiyle
 * (son GERI_BAKIS kimlik) yakalanır; aynı olay iki kez dağıtılmasın diye dağıtılan kimlikler tutulur.
 */
export interface AdisyonOlayi { olayId: number; tur: string; adisyonId: number | null; masaId: number | null; yerId: number | null; veri: unknown }
type Abone = (olaylar: AdisyonOlayi[]) => void;

interface Okuyucu { ctx: DbBaglam; sonId: number | null; aboneler: Set<Abone>; zamanlayici: NodeJS.Timeout | null; okuyor: boolean; tekrar: boolean; sonTemizlik: number;
  sonOlay: number; hata: number; dagitilan: Set<number> }
const okuyucular = new Map<string, Okuyucu>();
export const OLAY_ARALIK = { canliMs: 1000, bostaMs: 3000, canliSureMs: 20000, hataEnCokMs: 30000 };
const GERI_BAKIS = 300;
const anahtar = (ctx: DbBaglam) => `${String(ctx.dbServer || "").toLowerCase()}|${String(ctx.dbName || "").toLowerCase()}`;

/** Sonraki yoklamaya kadar bekleme (saf; test edilir) */
export function olayAraligi(simdi: number, sonOlay: number, hata: number): number {
  if (hata > 0) return Math.min(OLAY_ARALIK.hataEnCokMs, OLAY_ARALIK.bostaMs * 2 ** Math.min(hata, 5));
  return simdi - sonOlay < OLAY_ARALIK.canliSureMs ? OLAY_ARALIK.canliMs : OLAY_ARALIK.bostaMs;
}

const veriOku = (v: unknown) => { if (v === null || v === undefined) return null; try { return JSON.parse(String(v)); } catch { return String(v); } };

/**
 * Olay tablosundan okuma (abonelikten bağımsız: test ve yoklama yedeği de kullanır); kilitli satırlar atlanır. READPAST'i kabul
 * etmeyen veritabanı ayarında (ör. anlık görüntü yalıtımı) ipucu bırakılır: orada okuma zaten kilit beklemez.
 */
const ipucusuz = new Set<string>();
async function ipucuyla<T>(ctx: DbBaglam, f: (ipucu: string) => Promise<T>): Promise<T> {
  const k = anahtar(ctx);
  if (ipucusuz.has(k)) return f("");
  try { return await f("WITH (READPAST)"); } catch (e) {
    if (!/READPAST/i.test(String((e as Error)?.message || ""))) throw e;
    ipucusuz.add(k);
    return f("");
  }
}
export async function olaylariOku(ctx: DbBaglam, sonId: number, adet = 500): Promise<AdisyonOlayi[]> {
  const pool = await AdisyonTanimSqlRepository.havuz(ctx);
  const r = await ipucuyla(ctx, (ipucu) => pool.request().input("S", sql.BigInt, sonId).query(`SELECT TOP ${Math.min(Math.max(adet, 1), 2000)} OLAY_ID, TUR, ADISYON_ID, MASA_ID, YER_ID, VERI
    FROM dbo.TODVZ_ADISYON_OLAY ${ipucu} WHERE OLAY_ID > @S ORDER BY OLAY_ID`));
  return r.recordset.map((x: any) => ({ olayId: Number(x.OLAY_ID), tur: String(x.TUR).trim(), adisyonId: x.ADISYON_ID ?? null, masaId: x.MASA_ID ?? null, yerId: x.YER_ID ?? null, veri: veriOku(x.VERI) }));
}

export async function sonOlayId(ctx: DbBaglam): Promise<number> {
  const pool = await AdisyonTanimSqlRepository.havuz(ctx);
  const r = await ipucuyla(ctx, (ipucu) => pool.request().query(`SELECT ISNULL(MAX(OLAY_ID), 0) AS S FROM dbo.TODVZ_ADISYON_OLAY ${ipucu}`));
  return Number(r.recordset[0].S) || 0;
}

/** Eski kayıt temizliği (30 dk'da bir, küçük parçalarla): olaylar 2 gün, istek kimlikleri 7 gün, basılmış mutfak fişleri 30 gün */
async function temizlik(ctx: DbBaglam) {
  const pool = await AdisyonTanimSqlRepository.havuz(ctx);
  await pool.request().query(`DELETE TOP (5000) FROM dbo.TODVZ_ADISYON_OLAY WITH (READPAST) WHERE ZAMAN < DATEADD(day, -2, GETDATE());
    DELETE TOP (5000) FROM dbo.TODVZ_ADISYON_ISTEK WITH (READPAST) WHERE ZAMAN < DATEADD(day, -7, GETDATE());
    DELETE TOP (2000) FROM dbo.TODVZ_ADISYON_MUTFAK_FIS WITH (READPAST) WHERE YAZDIRILDI = 1 AND ZAMAN < DATEADD(day, -30, GETDATE());`);
}

async function oku(o: Okuyucu) {
  if (o.okuyor) { o.tekrar = true; return; }
  o.okuyor = true;
  try {
    do {
      o.tekrar = false;
      if (o.sonId === null) o.sonId = await sonOlayId(o.ctx);
      // Geri bakış: sıra numarası küçük olup geç onaylanan / kilitliyken atlanan olaylar da gelir; dağıtılmış olanlar ayıklanır
      const gelen = await olaylariOku(o.ctx, Math.max(0, o.sonId - GERI_BAKIS), 500 + GERI_BAKIS);
      const yeni = gelen.filter((x) => !o.dagitilan.has(x.olayId));
      if (yeni.length) {
        for (const x of yeni) o.dagitilan.add(x.olayId);
        o.sonId = Math.max(o.sonId, gelen[gelen.length - 1].olayId);
        // Dağıtılan kimlikler yalnız geri bakış penceresi kadar tutulur
        if (o.dagitilan.size > GERI_BAKIS * 4) { const esik = o.sonId - GERI_BAKIS * 2; for (const id of o.dagitilan) if (id < esik) o.dagitilan.delete(id); }
        o.sonOlay = Date.now();
        for (const a of [...o.aboneler]) { try { a(yeni); } catch (e) { logger.warn(`[Adisyon] Olay abonesi hata verdi: ${(e as Error).message}`); } }
        if (gelen.length >= 500) o.tekrar = true;
      }
      if (Date.now() - o.sonTemizlik > 30 * 60_000) {
        o.sonTemizlik = Date.now();
        await temizlik(o.ctx).catch((e) => logger.warn(`[Adisyon] Eski kayıt temizliği başarısız: ${(e as Error).message}`));
      }
      o.hata = 0;
    } while (o.tekrar && o.aboneler.size);
  } catch (e) {
    o.hata++;
    if (o.hata === 1 || o.hata % 20 === 0) logger.warn(`[Adisyon] Olay okuması başarısız (${o.hata}. kez): ${(e as Error).message}`);
  } finally {
    o.okuyor = false;
  }
}

function planla(o: Okuyucu) {
  if (o.zamanlayici) clearTimeout(o.zamanlayici);
  o.zamanlayici = null;
  if (!o.aboneler.size || okuyucular.get(anahtar(o.ctx)) !== o) return;
  o.zamanlayici = setTimeout(() => { void oku(o).finally(() => planla(o)); }, olayAraligi(Date.now(), o.sonOlay, o.hata));
  if (typeof o.zamanlayici.unref === "function") o.zamanlayici.unref();
}

/** Firma veritabanının olaylarına abone olur; dönen işlev aboneliği bırakır (son abone gidince okuyucu durur) */
export async function olaylaraAbone(ctx: DbBaglam, f: Abone): Promise<{ sonId: number; birak: () => void }> {
  const k = anahtar(ctx);
  const ilk = okuyucular.get(k);
  const sonId = ilk?.sonId ?? (await sonOlayId(ctx));
  // Beklerken okuyucu durmuş / değişmiş olabilir: kayıt her zaman haritadaki güncel okuyucuya yapılır
  let o = okuyucular.get(k);
  if (!o) {
    // Geri bakış penceresindeki mevcut (abonelikten önceki) olaylar "dağıtılmış" sayılır: yeni abone eski olayları almaz;
    // yalnız o sırada henüz onaylanmamış olup sonradan görünen olay iletilir
    const eski = sonId > 0 ? await olaylariOku(ctx, Math.max(0, sonId - GERI_BAKIS), 500 + GERI_BAKIS).catch(() => [] as AdisyonOlayi[]) : [];
    o = okuyucular.get(k);
    if (!o) {
      o = { ctx, sonId: Math.max(sonId, eski.length ? eski[eski.length - 1].olayId : 0), aboneler: new Set(), zamanlayici: null, okuyor: false, tekrar: false, sonTemizlik: 0, sonOlay: Date.now(), hata: 0,
        dagitilan: new Set(eski.map((x) => x.olayId)) };
      okuyucular.set(k, o);
    }
  }
  if (o.sonId === null) o.sonId = sonId;
  o.aboneler.add(f);
  const okuyucu = o;
  if (!okuyucu.zamanlayici) planla(okuyucu);
  return {
    sonId: okuyucu.sonId ?? 0,
    birak: () => {
      okuyucu.aboneler.delete(f);
      if (!okuyucu.aboneler.size) {
        if (okuyucu.zamanlayici) clearTimeout(okuyucu.zamanlayici);
        okuyucu.zamanlayici = null;
        if (okuyucular.get(k) === okuyucu) okuyucular.delete(k);
      }
    },
  };
}

/** Bu işlemde olay yazıldı: abone varsa beklemeden oku (ve yoklamayı yeniden "canlı" aralığa al) */
export function olayTetikle(ctx: DbBaglam): void {
  const o = okuyucular.get(anahtar(ctx));
  if (o && o.aboneler.size) { o.sonOlay = Date.now(); setImmediate(() => { void oku(o).finally(() => planla(o)); }); }
}

/** Test / izleme: etkin okuyucu ve abone sayısı */
export const olayDurumu = () => [...okuyucular.values()].map((o) => ({ db: anahtar(o.ctx), abone: o.aboneler.size, sonId: o.sonId }));

/** İşlem içinde olay satırı (yazan her işlem kendi işleminde ekler; işlem geri alınırsa olay da gider) */
export async function olayYaz(tx: sql.Transaction, tur: string, a: { adisyonId?: number | null; masaId?: number | null; yerId?: number | null; veri?: unknown }) {
  await new sql.Request(tx).input("T", sql.VarChar(30), tur.slice(0, 30)).input("A", sql.Int, a.adisyonId ?? null).input("M", sql.Int, a.masaId ?? null).input("Y", sql.Int, a.yerId ?? null)
    .input("V", sql.NVarChar(1000), a.veri === undefined ? null : JSON.stringify(a.veri).slice(0, 1000))
    .query(`INSERT INTO dbo.TODVZ_ADISYON_OLAY (TUR, ADISYON_ID, MASA_ID, YER_ID, VERI) VALUES (@T, @A, @M, @Y, @V)`);
}
