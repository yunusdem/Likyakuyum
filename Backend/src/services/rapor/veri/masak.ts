import sql from "mssql";
import { ApiError } from "../../../utils/ApiError.js";
import type { RaporSonucVeri, RaporTanim } from "../raporTanim.js";
import { type RaporParametreler, adetOzeti, aralikOzeti, filtreler, idFiltre, ozetEk, sinirla } from "../raporOrtak.js";

/**
 * MASAK raporları (docs/raporlar-faz2.md, Faz R2-M) — yalnızca SELECT, fiş bazında (TODVZ_FIS; iptal fişler hariç).
 * Meslek ve doğum tarihi fişten; sektör fişte tutulmadığı için cari kartından (carisiz fişler "Sektör yok").
 * MASAK modülünün (liste güncelleme / sorgu) dosyalarına dokunulmaz; yalnızca fişteki işaretler okunur.
 */

type Sorgu = (pool: sql.ConnectionPool, p: RaporParametreler, t: RaporTanim) => Promise<RaporSonucVeri>;

export interface MasakFisi {
  fisId: number; zaman: any; gun: string; belgeNo: string; unvan: string; kimlikNo: string; tip: string; tutar: number; usdKarsiligi: number;
  meslekId: number; meslek: string; sektor: string; dogumTarihi: any; masakListesinde: boolean; supheliYetkili: string; kaydeden: string; vezneKod: string; paralar: string;
}

const YAS_ARALIKLARI: [number, number, string][] = [[0, 17, "0 – 17"], [18, 25, "18 – 25"], [26, 35, "26 – 35"], [36, 50, "36 – 50"], [51, 65, "51 – 65"], [66, 200, "66 ve üzeri"]];
/** İşlem tarihindeki yaş (doğum günü henüz gelmediyse bir eksik) ve yaş aralığı. Saf fonksiyon. */
export function yasAraligi(dogum: any, islem: any): { yas: number | null; aralik: string; sira: number } {
  const d = dogum ? new Date(dogum) : null, i = new Date(islem);
  if (!d || Number.isNaN(d.getTime()) || Number.isNaN(i.getTime()) || d > i) return { yas: null, aralik: "Doğum tarihi yok", sira: 99 };
  let yas = i.getFullYear() - d.getFullYear();
  if (i.getMonth() < d.getMonth() || (i.getMonth() === d.getMonth() && i.getDate() < d.getDate())) yas--;
  const k = YAS_ARALIKLARI.findIndex(([a, b]) => yas >= a && yas <= b);
  return { yas, aralik: k >= 0 ? YAS_ARALIKLARI[k][2] : "Doğum tarihi yok", sira: k >= 0 ? k : 99 };
}

/**
 * Fiş kontrolü — şüpheli işlem bildirimi öncesi gözden geçirilecek fişler ve nedenleri. Saf fonksiyon.
 *  1) fiş MASAK listesinde eşleşme işaretli; 2) tutar ≥ eşik ama kimlik no / doğum tarihi / meslek eksik;
 *  3) aynı kimlikle aynı gün en az `n` fiş, her biri eşiğin altında ama toplamı eşiği aşıyor (parçalı işlem).
 */
export function masakKontrol(fisler: Pick<MasakFisi, "fisId" | "gun" | "kimlikNo" | "tutar" | "meslekId" | "dogumTarihi" | "masakListesinde">[], esik: number, n: number): Map<number, string[]> {
  const neden = new Map<number, string[]>();
  const ekle = (id: number, m: string) => { if (!neden.has(id)) neden.set(id, []); neden.get(id)!.push(m); };
  const gunluk = new Map<string, typeof fisler>();
  for (const f of fisler) {
    if (f.masakListesinde) ekle(f.fisId, "MASAK listesinde eşleşme");
    if (esik > 0 && f.tutar >= esik) {
      const eksik = [!f.kimlikNo ? "kimlik no" : "", !f.dogumTarihi ? "doğum tarihi" : "", !f.meslekId ? "meslek" : ""].filter(Boolean);
      if (eksik.length) ekle(f.fisId, `Eşik üstü, eksik bilgi: ${eksik.join(", ")}`);
    }
    if (f.kimlikNo) { const k = `${f.kimlikNo}|${f.gun}`; if (!gunluk.has(k)) gunluk.set(k, []); gunluk.get(k)!.push(f); }
  }
  if (esik > 0) for (const grup of gunluk.values()) {
    const alti = grup.filter(f => f.tutar < esik), toplam = alti.reduce((a, f) => a + f.tutar, 0);
    if (alti.length >= n && toplam >= esik) for (const f of alti) ekle(f.fisId, `Parçalı işlem: aynı gün ${alti.length} fiş, toplam ${toplam.toLocaleString("tr-TR", { maximumFractionDigits: 0 })} TL`);
  }
  return neden;
}

/** Grup özeti (alt rapor karşılığı): grup, fiş adedi, tutar, pay %. Saf fonksiyon. */
export function grupOzeti(satirlar: { grupBaslik: string; tutar: number; usdKarsiligi: number }[]) {
  const m = new Map<string, { grup: string; adet: number; tutar: number; usdKarsiligi: number }>();
  for (const s of satirlar) { if (!m.has(s.grupBaslik)) m.set(s.grupBaslik, { grup: s.grupBaslik, adet: 0, tutar: 0, usdKarsiligi: 0 });
    const o = m.get(s.grupBaslik)!; o.adet++; o.tutar += s.tutar; o.usdKarsiligi += s.usdKarsiligi; }
  const genel = [...m.values()].reduce((a, o) => a + o.tutar, 0);
  return [...m.values()].map(o => ({ ...o, pay: genel ? (o.tutar / genel) * 100 : 0 }));
}

/** Ortak fiş sorgusu: tarih aralığı + fiş tipi + vezne (+ ek koşul). Tutar = fişin TL toplamı; USD karşılığı kayıt anındaki gişe USD kuruyla. */
async function masakFisleri(pool: sql.ConnectionPool, p: RaporParametreler, ek: (req: sql.Request) => string = () => ""): Promise<MasakFisi[]> {
  if (!p.baslangic || !p.bitis) throw ApiError.badRequest("Tarih aralığı zorunludur.");
  const req = pool.request().input("bas", sql.Date, p.baslangic).input("bit", sql.Date, p.bitis).input("tip", sql.Int, p.fisTipi === 0 || p.fisTipi === 1 ? p.fisTipi : null);
  const f = filtreler(req, p, { vezne: "V" }) + ek(req);
  // Şüpheli işlem bildirim formu (eski VODVZR_FIS_MASAK_SUPELI_ISLEMLER.BILDIRIM_FORMU_VAR); tablo bu veritabanında yoksa 0
  const bildirimVar = !!(await pool.request().query(`SELECT CASE WHEN OBJECT_ID('dbo.TODVZ_MASAK_ISLEM_BILDIRIMI','U') IS NULL THEN 0 ELSE 1 END v`)).recordset[0]?.v;
  const bildirimSql = bildirimVar ? "CASE WHEN EXISTS (SELECT 1 FROM dbo.TODVZ_MASAK_ISLEM_BILDIRIMI B WHERE B.FIS_ID=F.FIS_ID) THEN 1 ELSE 0 END" : "0";
  const res = await req.query(`
    SELECT F.FIS_ID fisId, ISNULL(F.ZAMAN,F.TARIH) zaman, CONVERT(varchar(10), F.TARIH, 120) gun, RTRIM(ISNULL(F.SERI_NO,''))+RTRIM(ISNULL(F.BELGE_NO,'')) belgeNo,
      RTRIM(ISNULL(F.UNVAN,'')) unvan, COALESCE(NULLIF(RTRIM(F.VERGI_KIMLIK_NO),''), NULLIF(RTRIM(F.PASAPORT_NO),''), '') kimlikNo, F.TIP tipKod,
      ISNULL(F.TOPLAM_TUTAR,0) tutar, CASE WHEN ISNULL(F.GISE_USD_KURU,0)>0 THEN ISNULL(F.TOPLAM_TUTAR,0)/F.GISE_USD_KURU ELSE 0 END usdKarsiligi,
      RTRIM(ISNULL(F.PASAPORT_NO,'')) pasaportNo, RTRIM(ISNULL(F.BABA_ADI,'')) babaAdi, RTRIM(ISNULL(F.ANNE_ADI,'')) anneAdi, RTRIM(ISNULL(F.KIMLIK_SERI_NO,'')) kimlikSeriNo,
      RTRIM(ISNULL(F.ADRES,'')) adres, ${bildirimSql} bildirimFormu,
      ISNULL(F.MESLEK_ID,0) meslekId, RTRIM(ISNULL(M.AD,'')) meslek, RTRIM(ISNULL(SK.AD,'')) sektor, F.DOGUM_TARIHI dogumTarihi,
      ISNULL(F.MASAK_LISTESINDE_VAR,0) masakListesinde, RTRIM(ISNULL(SY.AD,'')) supheliYetkili, RTRIM(ISNULL(U.AD,'')) kaydeden, RTRIM(ISNULL(V.KOD,'')) vezneKod,
      ISNULL(STUFF((SELECT DISTINCT ', '+RTRIM(P2.KOD) FROM dbo.TODVZ_FIS_SATIRI S2 JOIN dbo.TODVZ_PARA P2 ON P2.PARA_ID=S2.PARA_ID WHERE S2.FIS_ID=F.FIS_ID FOR XML PATH('')),1,2,''),'') paralar
    FROM dbo.TODVZ_FIS F LEFT JOIN dbo.TODVZ_VEZNE V ON V.VEZNE_ID=F.VEZNE_ID LEFT JOIN dbo.TODVZ_CARI_KART C ON C.CARI_KART_ID=F.CARI_KART_ID
      LEFT JOIN dbo.TODVZ_TABLO_MADDESI M ON M.TABLO_MADDESI_ID=F.MESLEK_ID LEFT JOIN dbo.TODVZ_TABLO_MADDESI SK ON SK.TABLO_MADDESI_ID=C.SEKTOR_ID
      LEFT JOIN dbo.TODVZ_KULLANICI U ON U.KULLANICI_ID=F.EKLEYEN_ID LEFT JOIN dbo.TODVZ_KULLANICI SY ON SY.KULLANICI_ID=F.SUPHELI_ISLEMLER_YETKILI_ID
    WHERE ISNULL(F.IPTAL,0)=0 AND CAST(F.TARIH AS date) BETWEEN @bas AND @bit AND (@tip IS NULL OR F.TIP=@tip) ${f}
    ORDER BY ISNULL(F.ZAMAN,F.TARIH), F.FIS_ID;`);
  return res.recordset.map((r: any) => ({ ...r, tip: Number(r.tipKod) === 1 ? "Satış" : "Alış", tutar: Number(r.tutar) || 0, usdKarsiligi: Number(r.usdKarsiligi) || 0,
    meslekId: Number(r.meslekId) || 0, masakListesinde: !!r.masakListesinde, masakListesindeMetin: r.masakListesinde ? "EVET" : "", bildirimFormuMetin: r.bildirimFormu ? "VAR" : "" }));
}

/** Varsayılan yüksek tutar eşiği: firma tanımındaki TL vergi sınırı (yoksa 0 → kullanıcı girmeli) */
async function varsayilanEsik(pool: sql.ConnectionPool): Promise<number> {
  try { return Number((await pool.request().query(`SELECT TOP 1 ISNULL(TL_VERGI_SINIRI,0) e FROM dbo.TODVZ_TANIM`)).recordset[0]?.e) || 0; } catch { return 0; }
}
const tipOzeti = (p: RaporParametreler) => (p.fisTipi === 0 ? " · Alış" : p.fisTipi === 1 ? " · Satış" : "");
const tl = (n: number) => n.toLocaleString("tr-TR", { maximumFractionDigits: 0 });
/** Gruplu rapor: gruba göre (sıra, ad) dizer, grup içinde zaman sırası korunur */
const grupla = <T extends MasakFisi>(fisler: T[], grupAdi: (f: T) => string, grupSirasi: (f: T) => number | string = grupAdi) =>
  fisler.map(f => ({ ...f, grupBaslik: grupAdi(f), _s: grupSirasi(f) })).sort((a, b) => (typeof a._s === "number" && typeof b._s === "number" ? a._s - b._s : String(a._s).localeCompare(String(b._s), "tr")));

/** KNSK özeti: toplam / başarılı / başarısız / kara listede çıkan sorgu sayıları (eski rapordaki alt kutuların karşılığı). Saf fonksiyon. */
export function knskOzeti(satirlar: { basarili: boolean; karaListede: boolean }[]) {
  const say = (f: (s: { basarili: boolean; karaListede: boolean }) => boolean) => satirlar.filter(f).length;
  return [{ olcu: "Toplam sorgu", adet: satirlar.length }, { olcu: "Başarılı sorgu", adet: say(s => s.basarili) },
    { olcu: "Başarısız sorgu", adet: say(s => !s.basarili) }, { olcu: "Kara listede çıkan", adet: say(s => s.karaListede) }];
}

export const MASAK_SORGULARI: Record<string, Sorgu> = {

  /**
   * KNSK sorgulama log listesi — müşterinin ad + doğum tarihi + kişilik türüyle yapılan kara liste sorgularının logu.
   * Kaynak: TODVZ_LOG_KNSK_SORGULAMA (canlıda doğrulandı 17.09.2026; kolonlar: ZAMAN, KULLANICI_ID, SORGULANAN_ADI, SORGULANAN_DOGUM_TARIHI,
   * SORGULANAN_KISILIK_TURU, SORGULAMA_BASARILI, KARA_LISTEDE, KARA_LISTE_ADI, ACIKLAMA). Eski rapor görünümü VODVZR_KNSK_SORGULAMA_LOG_LISTESI
   * aynı tabloya kullanıcı adı ve kullanıcının veznesini ekler; burada da öyle. Tablo yoksa boş rapor döner.
   */
  async KNSKLOG1(pool, p, t) {
    if (!p.baslangic || !p.bitis) throw ApiError.badRequest("Tarih aralığı zorunludur.");
    const durumAd: Record<string, string> = { basarili: "Başarılı sorgular", basarisiz: "Başarısız sorgular", karaliste: "Kara listede çıkanlar" };
    const ozet = `${aralikOzeti(p)}${ozetEk(p)}${adetOzeti(p.kullaniciIdler, "personel")}${durumAd[p.durum || ""] ? ` · ${durumAd[p.durum!]}` : ""}${p.arama?.trim() ? ` · Arama: "${p.arama.trim()}"` : ""}`;
    const var_ = (await pool.request().query(`SELECT CASE WHEN OBJECT_ID('dbo.TODVZ_LOG_KNSK_SORGULAMA','U') IS NULL THEN 0 ELSE 1 END v`)).recordset[0]?.v;
    if (!var_) return sinirla([], t, ozet, "Bu veritabanında KNSK sorgulama log tablosu (TODVZ_LOG_KNSK_SORGULAMA) bulunmuyor.");
    const req = pool.request().input("bas", sql.Date, p.baslangic).input("bit", sql.Date, p.bitis).input("arama", sql.NVarChar(100), p.arama?.trim() ? `%${p.arama.trim()}%` : null);
    const f = filtreler(req, p, { vezne: "V" }) + idFiltre(req, p.kullaniciIdler, "L.KULLANICI_ID", "ku")
      + (p.durum === "basarili" ? " AND ISNULL(L.SORGULAMA_BASARILI,0)=1" : p.durum === "basarisiz" ? " AND ISNULL(L.SORGULAMA_BASARILI,0)=0" : p.durum === "karaliste" ? " AND ISNULL(L.KARA_LISTEDE,0)=1" : "");
    const res = await req.query(`
      SELECT L.ZAMAN zaman, RTRIM(ISNULL(U.AD,'')) kullanici, RTRIM(ISNULL(V.KOD,'')) vezneKod, RTRIM(ISNULL(L.SORGULANAN_ADI,'')) sorgulananAd, L.SORGULANAN_DOGUM_TARIHI dogumTarihi,
        L.SORGULANAN_KISILIK_TURU kisilikKod, ISNULL(L.SORGULAMA_BASARILI,0) basarili, ISNULL(L.KARA_LISTEDE,0) karaListede, RTRIM(ISNULL(L.KARA_LISTE_ADI,'')) karaListeAdi, RTRIM(ISNULL(L.ACIKLAMA,'')) aciklama
      FROM dbo.TODVZ_LOG_KNSK_SORGULAMA L LEFT JOIN dbo.TODVZ_KULLANICI U ON U.KULLANICI_ID=L.KULLANICI_ID LEFT JOIN dbo.TODVZ_VEZNE V ON V.VEZNE_ID=U.VEZNE_ID
      WHERE CAST(L.ZAMAN AS date) BETWEEN @bas AND @bit AND (@arama IS NULL OR L.SORGULANAN_ADI LIKE @arama OR L.KARA_LISTE_ADI LIKE @arama) ${f}
      ORDER BY L.ZAMAN;`);
    const satirlar = res.recordset.map((r: any) => ({ ...r, basarili: !!r.basarili, karaListede: !!r.karaListede, kisilik: Number(r.kisilikKod) === 1 ? "Tüzel" : "Gerçek",
      sonuc: r.basarili ? "Başarılı" : "BAŞARISIZ", karaListe: r.karaListede ? "EVET" : "" }));
    return sinirla(satirlar, t, ozet, undefined, knskOzeti(satirlar));
  },

  /** Meslek bazında işlem listesi */
  async MSKMES1(pool, p, t) {
    const fisler = await masakFisleri(pool, p, req => idFiltre(req, p.meslekIdler, "F.MESLEK_ID", "ms"));
    const satirlar = grupla(fisler, f => f.meslek || "Meslek belirtilmemiş", f => (f.meslek ? `0${f.meslek}` : "1"));
    return sinirla(satirlar, t, `${aralikOzeti(p)}${tipOzeti(p)}${ozetEk(p)}${adetOzeti(p.meslekIdler, "meslek")}`, undefined, grupOzeti(satirlar));
  },

  /** Sektör bazında işlem listesi — sektör cari kartından */
  async MSKSEK1(pool, p, t) {
    const fisler = await masakFisleri(pool, p, req => idFiltre(req, p.sektorIdler, "C.SEKTOR_ID", "sk"));
    const satirlar = grupla(fisler, f => f.sektor || "Sektör yok (carisiz fiş veya sektörü girilmemiş cari)", f => (f.sektor ? `0${f.sektor}` : "1"));
    return sinirla(satirlar, t, `${aralikOzeti(p)}${tipOzeti(p)}${ozetEk(p)}${adetOzeti(p.sektorIdler, "sektör")}`, undefined, grupOzeti(satirlar));
  },

  /** Yaş bazında işlem listesi — yaş işlem tarihine göre */
  async MSKYAS1(pool, p, t) {
    const fisler = (await masakFisleri(pool, p)).map(f => { const y = yasAraligi(f.dogumTarihi, f.zaman); return { ...f, yas: y.yas, yasAraligi: y.aralik, yasSira: y.sira }; });
    const satirlar = grupla(fisler, f => (f.yasSira === 99 ? f.yasAraligi : `${f.yasAraligi} yaş`), f => f.yasSira);
    return sinirla(satirlar, t, `${aralikOzeti(p)}${tipOzeti(p)}${ozetEk(p)}`, undefined, grupOzeti(satirlar));
  },

  /** Yüksek tutarda işlem listesi — fiş bazında veya aynı kimliğin günlük toplamı eşik üstü */
  async MSKYUK1(pool, p, t) {
    const esik = p.esik ?? await varsayilanEsik(pool);
    if (!(esik > 0)) throw ApiError.badRequest("Eşik tutarı girilmelidir (firma tanımında TL vergi sınırı tanımlı değil).");
    const fisler = await masakFisleri(pool, p);
    const gunluk = p.birlestir === "gunluk";
    let satirlar: any[];
    if (gunluk) {
      const m = new Map<string, any>();
      for (const f of fisler) { const k = f.kimlikNo ? `${f.kimlikNo}|${f.gun}` : `#${f.fisId}`;
        if (!m.has(k)) m.set(k, { ...f, fisAdedi: 0, tutar: 0, usdKarsiligi: 0, belgeler: [] as string[] });
        const o = m.get(k); o.fisAdedi++; o.tutar += f.tutar; o.usdKarsiligi += f.usdKarsiligi; o.belgeler.push(f.belgeNo); }
      satirlar = [...m.values()].filter(o => o.tutar >= esik).map(o => ({ ...o, belgeNo: o.belgeler.length > 1 ? `${o.belgeler[0]} +${o.belgeler.length - 1}` : o.belgeler[0] }));
    } else satirlar = fisler.filter(f => f.tutar >= esik).map(f => ({ ...f, fisAdedi: 1 }));
    return sinirla(satirlar, t, `${aralikOzeti(p)}${tipOzeti(p)}${ozetEk(p)} · Eşik ${tl(esik)} TL · ${gunluk ? "aynı kimliğin günlük toplamı" : "fiş bazında"}`,
      gunluk ? "Aynı kimlik numarasıyla aynı gün yapılan fişler toplanır; toplamı eşiği aşanlar listelenir (kimlik numarası olmayan fişler tek başına değerlendirilir). \"Belge no\" ilk fişi ve ek fiş sayısını gösterir." : undefined);
  },

  /** Şüpheli işlem listesi — şüpheli işlemler yetkilisince işaretlenmiş fişler */
  async MSKSUP1(pool, p, t) {
    const fisler = await masakFisleri(pool, p, () => " AND F.SUPHELI_ISLEMLER_YETKILI_ID IS NOT NULL");
    return sinirla(fisler, t, `${aralikOzeti(p)}${tipOzeti(p)}${ozetEk(p)}`);
  },

  /** Şüpheli işlemler fiş kontrol listesi — otomatik kontrol kurallarına takılan fişler ve nedenleri */
  async MSKKON1(pool, p, t) {
    const esik = p.esik ?? await varsayilanEsik(pool), n = Math.max(2, Math.round(p.adet ?? 2));
    const fisler = await masakFisleri(pool, p);
    const neden = masakKontrol(fisler, esik, n);
    const satirlar = fisler.filter(f => neden.has(f.fisId)).map(f => ({ ...f, neden: neden.get(f.fisId)!.join("; "), isaretli: f.supheliYetkili ? "EVET" : "" }));
    return sinirla(satirlar, t, `${aralikOzeti(p)}${tipOzeti(p)}${ozetEk(p)} · Eşik ${esik > 0 ? tl(esik) + " TL" : "yok"} · Parça sayısı ≥ ${n}`,
      esik > 0 ? undefined : "Eşik tutarı girilmediği ve firma tanımında TL vergi sınırı olmadığı için yalnızca MASAK listesi eşleşmeleri kontrol edildi.");
  },
};
