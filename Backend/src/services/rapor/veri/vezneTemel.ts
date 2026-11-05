import sql from "mssql";
import { ApiError } from "../../../utils/ApiError.js";
import type { RaporGrup, RaporSonucVeri, RaporTanim } from "../raporTanim.js";
import {
  type RaporParametreler, tarihTr, kurCoz, hedefPara, sinirla, TL_PARA_SQL, aralikOzeti, filtreler, paraKumesi, ozetEk, ek,
  vezneBakiyeleri, VEZNE_BAKIYE_DIPNOT,
} from "../raporOrtak.js";
import { FIS_BELGELERI, VEZNE_BELGE, VEZNE_HAREKET_KOLONLARI, belgeTablolari, saatTr, vezneHareketleriSql } from "../kaynak.js";
import { type ParaGrubu, paraBasliklariEkle, paraGrubunaGoreSirala, paraGrupBilgisi } from "../paraGrup.js";

type Sorgu = (pool: sql.ConnectionPool, p: RaporParametreler, t: RaporTanim) => Promise<RaporSonucVeri>;
type Satir = Record<string, any>;

/**
 * Vezne raporları: VEZBAK1, VEZHAR1, VEZHAS1, VEZALT1 — raporVeri.ts'den taşındı (05.11.2026). Yalnızca SELECT.
 * Eski raporlarla eşitleme (docs/RAPOR_ESITLEME_UYGULAMA.md, docs/rapor-rpt-fark-2026-11.md "VEZNE"): listeleme şekli, belge / işlem tipi,
 * saat gözükmesin, sıralama, para ayrımı (Döviz / Kuyum başlıkları). Saf mantık aşağıdaki dışa açık fonksiyonlardadır (scripts/rapor-test-vezne.ts).
 */

/** Seçim değeri: ek parametre (`p.ek`); yoksa parametre nesnesindeki aynı adlı alan (yerel deneme düzenekleri seçimi doğrudan verir) */
export const secimDegeri = (p: RaporParametreler, ad: string): string => ek(p, ad) || String((p as any)[ad] ?? "").trim();

// ── Vezne hareket listesi: belge tipi, işlem tipi, sıralama ──────────────────────────────────────────────────────────

/** Belge tipi seçimi → vezne belge kodları (kaynak.ts VEZNE_BELGE). Ticari fiş ayrı tiptir (9). "hepsi" → süzme yok */
export const VEZNE_BELGE_SECIMI: Record<string, number[]> = { fis: [0], transfer: [1], cari: [2], hesap: [3], dekont: [4], sarraf: [5], perakende: [6], urun: [7], ticari: [9] };
/** Seçilen belge tipinin kodları; "hepsi" / boş / bilinmeyen değerde null (tüm belgeler) */
export const belgeKodlari = (secim: string): number[] | null => VEZNE_BELGE_SECIMI[String(secim || "").trim()] ?? null;

/** Belge tipi ve işlem tipi (giris / cikis) süzgeci — eski @CB_BelgeTipi / @CB_GirisCikis. `belgeTipi` satırda sayısal koddur. Saf fonksiyon. */
export function hareketSuz<T extends Satir>(satirlar: T[], o: { belgeTipi?: string; islemTipi?: string }): T[] {
  const kodlar = belgeKodlari(o.belgeTipi || ""), yon = o.islemTipi === "giris" || o.islemTipi === "cikis" ? o.islemTipi : "";
  if (!kodlar && !yon) return satirlar;
  const dolu = (v: any) => Math.abs(Number(v) || 0) > 0.0000001;
  return satirlar.filter(r => (!kodlar || kodlar.includes(Number(r.belgeTipi))) && (!yon || dolu(yon === "giris" ? r.giris : r.cikis)));
}

/**
 * Vezne hareketlerinin sırası — eski rapordaki gibi: vezne, gün, saat, belge tipi, (belge), para sırası. "son" (Sondan başa) seçilince yalnız gün ve saat
 * tersine döner (eski @SiralamaTarih / @SiralamaZaman); vezne, belge tipi ve para sırası aynı kalır. Saf fonksiyon; girdi dizisini değiştirmez.
 */
export function hareketSirala<T extends Satir>(satirlar: T[], siralama?: string): T[] {
  const yon = siralama === "son" ? -1 : 1;
  return [...satirlar].sort((a: any, b: any) => String(a.vezneKod).localeCompare(String(b.vezneKod))
    || yon * (new Date(a.tarih).getTime() - new Date(b.tarih).getTime()) || yon * String(a.saat || "").localeCompare(String(b.saat || ""))
    || a.belgeTipi - b.belgeTipi || a.belgeId - b.belgeId || a.paraSira - b.paraSira);
}

/** Özet tablosu (vezne × para) satırlarına vezne içinde Döviz / Kuyum başlıkları (K11): yalnız başlık, rakam değişmez. `vezne` alanı aynı olan satırlar ardışıktır. */
export const vezneOzetiBaslikla = (ozet: Satir[], grupla: (s: Satir) => ParaGrubu, alan = "paraKod") => paraBasliklariEkle(ozet, { grupla, alan, bolumle: ["vezne"] });

// ── Vezne bakiye raporları: listeleme şekli ───────────────────────────────────────────────────────────────────────────

export type ListelemeSekli = "vezne" | "para" | "genel";
export const LISTELEME_ADI: Record<ListelemeSekli, string> = { vezne: "Vezne bazında", para: "Para bazında", genel: "Genel" };
/** Listeleme şekli (eski pCB_ListelemeSekli): geçersiz / boş değer "vezne" */
export const listelemeSekli = (v: string): ListelemeSekli => (v === "para" || v === "genel" ? v : "vezne");

/** Para sırası: para kartındaki sıra no, sonra kod (bakiye sorgularının sırası) */
export const paraSirasi = (a: Satir, b: Satir) => (Number(a.siraNo ?? 99) - Number(b.siraNo ?? 99)) || String(a.paraKod || "").localeCompare(String(b.paraKod || "")) || (Number(a.paraId) || 0) - (Number(b.paraId) || 0);

/**
 * Vezne × para bakiye satırlarını listeleme şekline göre düzenler (VEZBAK1, VEZANL1 — eski raporların "Listeleme şekli"):
 *  - vezne: satırlar olduğu gibi (vezne grubu tanımdan); her veznenin içinde Döviz / Kuyum başlık satırları.
 *  - para:  grup = para (başlık "kod — ad"), satırlar vezneler; paralar Döviz → Kuyum sırasında, `paraGrupAd` bölüm anahtarıdır.
 *  - genel: her para tek satır (vezneler toplanır: `toplanan` alanları), grupsuz; Döviz / Kuyum başlık satırları.
 * Yalnız düzen değişir; bakiye ve karşılık rakamları aynıdır. `vezneAnahtar` tanımdaki vezne grubunun anahtarıdır. Saf fonksiyon.
 */
export function bakiyeListele(satirlar: Satir[], sekil: ListelemeSekli, o: {
  grupla: (s: Satir) => ParaGrubu; vezneAnahtar: string; paraSirala?: (a: Satir, b: Satir) => number; toplanan?: string[]; sifirAt?: boolean;
}): { satirlar: Satir[]; gruplar?: RaporGrup[] } {
  if (sekil === "vezne") return { satirlar: paraBasliklariEkle(satirlar, { grupla: o.grupla, alan: "paraKod", bolumle: [o.vezneAnahtar] }) };
  const sirala = o.paraSirala || paraSirasi;
  const sirali = satirlar.map((s, n) => ({ s, n })).sort((x, y) => sirala(x.s, y.s) || (Number(x.s.paraId) || 0) - (Number(y.s.paraId) || 0)
    || String(x.s.vezneKod || "").localeCompare(String(y.s.vezneKod || "")) || x.n - y.n).map(x => x.s);
  if (sekil === "para") {
    const baslikli = sirali.map(s => ({ ...s, paraBaslik: [s.paraKod, s.paraAd].filter(Boolean).join(" — ") }));
    return { satirlar: paraGrubunaGoreSirala(baslikli, o.grupla), gruplar: [{ anahtar: "paraId", baslik: "{{paraBaslik}}", altToplam: true }] };
  }
  const toplanan = o.toplanan || ["miktar", "tlKarsiligi", "hedefKarsiligi", "tlSatis"];
  const paralar = new Map<number, Satir>();
  for (const s of sirali) {
    const id = Number(s.paraId), onceki = paralar.get(id);
    if (!onceki) { paralar.set(id, { ...s, vezneId: null, vezneKod: "", vezneAd: "", vezneBaslik: "", [o.vezneAnahtar]: "" }); continue; }
    for (const a of toplanan) onceki[a] = (Number(onceki[a]) || 0) + (Number(s[a]) || 0);
  }
  const toplam = [...paralar.values()].filter(s => !o.sifirAt || Math.abs(Number(s.miktar) || 0) > 0.000001);
  return { satirlar: paraBasliklariEkle(toplam, { grupla: o.grupla, alan: "paraKod" }), gruplar: [] };
}

/**
 * Başlık satırlı sonuç: üst sınır ve kayıt sayısı veri satırlarına göre hesaplanır (başlık satırları sayılmaz); sorgunun seçtiği gruplar ve
 * kolon başlıkları sonuca eklenir.
 */
export function baslikliSonuc(duzen: { satirlar: Satir[]; gruplar?: RaporGrup[] }, t: RaporTanim, filtreOzeti: string, ekDipnot?: string,
  ekler: { ozetSatirlar?: Satir[]; kolonBasliklari?: Record<string, string> } = {}): RaporSonucVeri {
  const sonuc = sinirla(duzen.satirlar.filter(s => s._stil !== "baslik"), t, filtreOzeti, ekDipnot, ekler.ozetSatirlar);
  if (sonuc.sinirAsildi) return sonuc;
  return { ...sonuc, satirlar: duzen.satirlar, ...(duzen.gruplar ? { gruplar: duzen.gruplar } : {}), ...(ekler.kolonBasliklari ? { kolonBasliklari: ekler.kolonBasliklari } : {}) };
}

export const VEZNE_TEMEL_SORGULARI: Record<string, Sorgu> = {
  /**
   * R8 Vezne bakiye raporu (tarih bazlı). Listeleme şekli (eski pCB_ListelemeSekli): vezne bazında (varsayılan) / para bazında / genel.
   * Karşılık parası seçilince karşılık kolonunun başlığı o paranın kodudur (eski SECILEN_PARA_KODU).
   */
  async VEZBAK1(pool, p, t) {
    if (!p.tarih) throw ApiError.badRequest("Tarih zorunludur.");
    const kur = await kurCoz(pool, p);
    const rows = await vezneBakiyeleri(pool, p.tarih, p);
    const paraSet = await paraKumesi(pool, p);
    const hedef = await hedefPara(pool, p, kur);
    const satirlar = rows.filter(r => (!p.paraId || r.paraId === p.paraId) && (!paraSet || paraSet.has(Number(r.paraId)))).map(r => ({ ...r, miktar: Number(r.miktar), kur: kur.kurlar.get(r.paraId) ?? 0,
      tlKarsiligi: Number(r.miktar) * (kur.kurlar.get(r.paraId) ?? 0), hedefKarsiligi: hedef.cevir(Number(r.miktar) * (kur.kurlar.get(r.paraId) ?? 0)), hedefParaKod: hedef.kod, kurSatis: kur.satisKurlari.get(r.paraId) ?? 0, tlSatis: Number(r.miktar) * (kur.satisKurlari.get(r.paraId) ?? 0), vezneBaslik: `${r.vezneKod} — ${r.vezneAd}` }));
    const pg = await paraGrupBilgisi(pool), sekil = listelemeSekli(secimDegeri(p, "listeleme"));
    const duzen = bakiyeListele(satirlar, sekil, { grupla: s => pg.grup(s), vezneAnahtar: "vezneKod" });
    return baslikliSonuc(duzen, t, `${tarihTr(p.tarih)} itibarıyla${ozetEk(p) || " · Tüm vezneler"}${sekil === "vezne" ? "" : ` · ${LISTELEME_ADI[sekil]}`} · ${kur.aciklama} · ${hedef.aciklama}`,
      VEZNE_BAKIYE_DIPNOT, { kolonBasliklari: p.hedefParaId ? { hedefKarsiligi: hedef.kod } : undefined });
  },

  /**
   * R9 Vezne hareket listesi — eski "VEZNE HAREKET LİSTESİ" (SODVZCR_VEZNE_HAREKET_LISTESI) gibi tam vezne defteri: döviz fişi (döviz ayağı + TL ödeme ayağı),
   * sarraf fişi (ürün satırları + vezneden ödemeler), vezne transferi, nakit cari hareket, kasa hesap hareketi (KDV TL'ye), emanet dekontu; her satırda Giriş / Çıkış.
   * Kaynak `kaynak.ts` vezneHareketleriSql — `vezneBakiyeleri` ile aynı. Gün belgenin tarihidir (fişin kayıt saati değil). Fiş tipi seçilirse yalnızca o tipteki
   * döviz ve sarraf fişleri listelenir.
   * Eski parametreler: belge tipi (`belgeTipi`: hepsi / fis / transfer / cari / hesap / dekont / sarraf / perakende / ticari / urun), işlem tipi
   * (`islemTipi`: hepsi / giris / cikis), sıralama (`siralama`: bas = baştan sona / son = sondan başa); "Saat gözükmesin" kutusu tanımdaki kolon koşuludur.
   */
  async VEZHAR1(pool, p, t) {
    if (!p.baslangic || !p.bitis) throw ApiError.badRequest("Tarih aralığı zorunludur.");
    const kur = await kurCoz(pool, { ...p, kurTarihi: p.kurTarihi || p.bitis });
    const d = await belgeTablolari(pool);
    const bankaVar = (await pool.request().query(`SELECT CASE WHEN OBJECT_ID('dbo.TODVZ_BANKA','U') IS NULL THEN 0 ELSE 1 END v`)).recordset[0]?.v;
    const yalnizFis = p.fisTipi === 0 || p.fisTipi === 1;
    const belgeSecimi = secimDegeri(p, "belgeTipi"), islemSecimi = secimDegeri(p, "islemTipi"), sondan = (p.siralama || secimDegeri(p, "siralama")) === "son";
    // Belge tipi sorguda da süzülür (sabit kod listesi); aynı kural satırlarda hareketSuz ile yinelenir
    const kodlar = belgeKodlari(belgeSecimi), belgeF = kodlar ? ` AND X.belgeTipi IN (${kodlar.map(Number).join(",")})` : "";
    const req = pool.request().input("bas", sql.Date, p.baslangic).input("bit", sql.Date, p.bitis).input("tip", sql.Int, yalnizFis ? p.fisTipi : null);
    const f = filtreler(req, p, { vezne: "V", para: "X.paraId" });
    // Fişin banka hesabı bir cari karttır (döviz fişi ekranı cari listesinden seçtirir); adı oradan, yoksa banka kartından
    const bankaAd = `RTRIM(COALESCE((SELECT TOP 1 BC.AD FROM dbo.TODVZ_CARI_KART BC WHERE BC.CARI_KART_ID=X.bankaHesabiId)${bankaVar ? ", (SELECT TOP 1 BN.HESAP_ADI FROM dbo.TODVZ_BANKA BN WHERE BN.BANKA_ID=X.bankaHesabiId)" : ""}, ''))`;
    // Gün: belgenin tarihi (fişin TARIH'i; eski rapor gibi). Saat: fiş / sarraf fişinin kayıt saati — süzgeç İstanbul saatiyle JS'de uygulanır
    const res = await req.query(`
      ;WITH X (${VEZNE_HAREKET_KOLONLARI}) AS (
       ${vezneHareketleriSql(d, yalnizFis)}
      )
      SELECT X.*, ${bankaAd} bankaHesabi, RTRIM(ISNULL(V.KOD,'')) vezneKod, RTRIM(ISNULL(V.AD,'')) vezneAd, RTRIM(ISNULL(P.KOD,'')) paraKod,
        CASE WHEN X.paraId=${TL_PARA_SQL} THEN 9999999 ELSE ISNULL(P.SIRA_NO,99) END paraSira
      FROM X LEFT JOIN dbo.TODVZ_VEZNE V ON V.VEZNE_ID=X.vezneId LEFT JOIN dbo.TODVZ_PARA P ON P.PARA_ID=X.paraId
      WHERE CAST(X.tarih AS date) BETWEEN @bas AND @bit AND (ABS(ISNULL(X.giris,0))>0.0000001 OR ABS(ISNULL(X.cikis,0))>0.0000001) ${f}${belgeF}
      ORDER BY V.KOD, CAST(X.tarih AS date), X.belgeTipi, X.belgeId, paraSira, X.aciklama;`);
    // Saat aralığı (eski @İlkSaat / @SonSaat): son saat dakika olarak girildiyse o dakikanın sonuna kadar dahil; saati olmayan belgeler 00:00 sayılır
    const sb = (p.baslangicSaat || "00:00").slice(0, 5), se = (p.bitisSaat || "23:59").slice(0, 5), saatSuz = sb !== "00:00" || se !== "23:59";
    const saatli = res.recordset.map((r: any) => ({ ...r, saat: saatTr(r.zaman) }))
      .filter((r: any) => !saatSuz || ((r.saat || "00:00") >= sb && (r.saat || "00:00") <= se));
    const satirlar = hareketSirala(hareketSuz(saatli, { belgeTipi: belgeSecimi, islemTipi: islemSecimi }), sondan ? "son" : "bas")
      .map((r: any) => { const id = Number(r.paraId), giris = Number(r.giris) || 0, cikis = Number(r.cikis) || 0, miktar = giris || cikis;
        const secilenKur = kur.kurlar.get(id) ?? 0, ks = kur.satisKurlari.get(id) ?? 0, belgeli = FIS_BELGELERI.includes(Number(r.belgeTipi));
        const ortak = { ...r, belgeTipi: VEZNE_BELGE[Number(r.belgeTipi)] || "", yon: giris ? "<<" : ">>", tip: belgeli ? (Number(r.fisTip) === 1 ? "Satış" : "Alış") : "", giris, cikis,
          belgeNo: r.belgeNo || r.aciklama, vezneBaslik: `${r.vezneKod} — ${r.vezneAd}` };
        // Fişin ödeme ayağı (döviz fişinin TL ödemesi, sarraf fişinin vezneden ödemesi): satırların karşılığıdır; miktar ve "seçilen kurla TL" kolonlarına yazılırsa aynı fiş iki kez toplanır
        if (Number(r.ayak) === 1) return { ...ortak, aciklama: `${r.aciklama} — ödeme`, miktar: null, kur: null, tutar: 0, komisyon: 0, bmv: 0, secilenKur: null, secilenTl: 0, kurSatis: null, tlSatis: 0 };
        return { ...ortak, miktar, kur: Number(r.kur) || 0, tutar: Number(r.tutar) || 0, komisyon: Number(r.komisyon) || 0, bmv: Number(r.bmv) || 0,
          secilenKur, secilenTl: miktar * secilenKur, kurSatis: ks, tlSatis: miktar * ks }; });
    // Vezne × para giriş / çıkış toplamı (eski raporda gizli genel toplam; paralar karışmasın diye para başına)
    const oz = new Map<string, any>();
    for (const x of satirlar) { const k = `${x.vezneKod}|${x.paraKod}`; const o = oz.get(k) || { vezne: x.vezneBaslik, paraKod: x.paraKod, paraId: x.paraId, giris: 0, cikis: 0 }; o.giris += x.giris; o.cikis += x.cikis; oz.set(k, o); }
    // Para ayrımı (K11): özet tablosunda her veznenin içinde Döviz / Kuyum başlıkları (yalnız başlık)
    const pg = await paraGrupBilgisi(pool);
    const ozet = vezneOzetiBaslikla([...oz.values()].map(o => ({ ...o, net: o.giris - o.cikis })), o => pg.grup(o));
    const secimOzeti = `${kodlar ? ` · Belge: ${kodlar.map(k => VEZNE_BELGE[k]).join(", ")}` : ""}${islemSecimi === "giris" ? " · Yalnız giriş" : islemSecimi === "cikis" ? " · Yalnız çıkış" : ""}${sondan ? " · Sondan başa" : ""}`;
    return sinirla(satirlar, t, `${aralikOzeti(p)} · ${(p.baslangicSaat || "00:00").slice(0, 5)}–${(p.bitisSaat || "23:59").slice(0, 5)}${ozetEk(p) || " · Tüm vezneler"}${p.fisTipi === 0 ? " · Yalnız alış fişleri" : p.fisTipi === 1 ? " · Yalnız satış fişleri" : ""}${secimOzeti} · ${kur.aciklama}`,
      `Seçilen aralıkta vezne hareketi yok. ${VEZNE_BAKIYE_DIPNOT}`,
      ozet);
  },

  /**
   * Vezne Hareket (Has) — belge ve banka hesabı kolonları olmadan, her satırda milyem ve has karşılığı ile vezne bazında giriş / çıkış miktarları.
   */
  async VEZHAS1(pool, p, t) {
    if (!p.baslangic || !p.bitis) throw ApiError.badRequest("Tarih aralığı zorunludur.");
    const kur = await kurCoz(pool, { ...p, kurTarihi: p.kurTarihi || p.bitis });
    const d = await belgeTablolari(pool);
    const yalnizFis = p.fisTipi === 0 || p.fisTipi === 1;
    const req = pool.request().input("bas", sql.Date, p.baslangic).input("bit", sql.Date, p.bitis).input("tip", sql.Int, yalnizFis ? p.fisTipi : null);
    const f = filtreler(req, p, { vezne: "V", para: "X.paraId" });
    const sarrafSatirJoin = d.sarraf
      ? `LEFT JOIN dbo.TODVZ_SARRAF_FISI_SATIRI SFS ON X.belgeTipi=5 AND X.ayak=0 AND SFS.SARRAF_FISI_ID=X.belgeId AND SFS.SATIR_NO=X.satirNo
         LEFT JOIN dbo.TODVZ_ODEME_SATIRI SOS ON X.belgeTipi=5 AND X.ayak=1 AND SOS.SARRAF_FISI_ID=X.belgeId AND SOS.SATIR_NO=X.satirNo`
      : ``;
    const sarrafAlanlar = d.sarraf
      ? `SFS.MILYEM sarrafMilyem, SFS.HAS_GRAM sarrafHasGram, SOS.MILYEM odemeMilyem, SOS.HAS_GRAM odemeHasGram,`
      : `NULL sarrafMilyem, NULL sarrafHasGram, NULL odemeMilyem, NULL odemeHasGram,`;

    const res = await req.query(`
      ;WITH X (${VEZNE_HAREKET_KOLONLARI}) AS (
       ${vezneHareketleriSql(d, yalnizFis)}
      )
      SELECT X.*, RTRIM(ISNULL(V.KOD,'')) vezneKod, RTRIM(ISNULL(V.AD,'')) vezneAd, RTRIM(ISNULL(P.KOD,'')) paraKod,
        ISNULL(P.HAS_ORANI, 0) paraHasOrani,
        ${sarrafAlanlar}
        CASE WHEN X.paraId=${TL_PARA_SQL} THEN 9999999 ELSE ISNULL(P.SIRA_NO,99) END paraSira
      FROM X LEFT JOIN dbo.TODVZ_VEZNE V ON V.VEZNE_ID=X.vezneId
             LEFT JOIN dbo.TODVZ_PARA P ON P.PARA_ID=X.paraId
             ${sarrafSatirJoin}
      WHERE CAST(X.tarih AS date) BETWEEN @bas AND @bit AND (ABS(ISNULL(X.giris,0))>0.0000001 OR ABS(ISNULL(X.cikis,0))>0.0000001) ${f}
      ORDER BY V.KOD, CAST(X.tarih AS date), X.belgeTipi, X.belgeId, paraSira, X.aciklama;`);

    const sb = (p.baslangicSaat || "00:00").slice(0, 5), se = (p.bitisSaat || "23:59").slice(0, 5), saatSuz = sb !== "00:00" || se !== "23:59";
    const satirlar = res.recordset.map((r: any) => ({ ...r, saat: saatTr(r.zaman) }))
      .filter((r: any) => !saatSuz || ((r.saat || "00:00") >= sb && (r.saat || "00:00") <= se))
      .sort((a: any, b: any) => a.vezneKod.localeCompare(b.vezneKod) || new Date(a.tarih).getTime() - new Date(b.tarih).getTime() || (a.saat || "").localeCompare(b.saat || "")
        || a.belgeTipi - b.belgeTipi || a.belgeId - b.belgeId || a.paraSira - b.paraSira)
      .map((r: any) => {
        const id = Number(r.paraId), giris = Number(r.giris) || 0, cikis = Number(r.cikis) || 0, miktar = giris || cikis;
        const secilenKur = kur.kurlar.get(id) ?? 0, ks = kur.satisKurlari.get(id) ?? 0, belgeli = FIS_BELGELERI.includes(Number(r.belgeTipi));
        const rawMilyem = r.sarrafMilyem ?? r.odemeMilyem;
        const milyem = rawMilyem != null && Number(rawMilyem) > 0
          ? Number(rawMilyem)
          : (Number(r.paraHasOrani) > 0 ? Math.round(Number(r.paraHasOrani) * 1000) : null);
        const rawHas = r.sarrafHasGram ?? r.odemeHasGram;
        const hasKarsiligi = rawHas != null && Number(rawHas) > 0
          ? Number(rawHas)
          : (milyem && miktar ? miktar * (milyem / 1000) : (Number(r.paraHasOrani) > 0 ? miktar * Number(r.paraHasOrani) : null));

        const ortak = {
          ...r,
          yon: giris ? "<<" : ">>",
          tip: belgeli ? (Number(r.fisTip) === 1 ? "Satış" : "Alış") : "",
          giris,
          cikis,
          belgeNo: r.belgeNo || r.aciklama,
          vezneBaslik: `${r.vezneKod} — ${r.vezneAd}`,
          milyem,
          hasKarsiligi,
        };
        if (Number(r.ayak) === 1) return { ...ortak, aciklama: `${r.aciklama} — ödeme`, miktar: null, kur: null, tutar: 0, komisyon: 0, bmv: 0, secilenKur: null, secilenTl: 0, kurSatis: null, tlSatis: 0 };
        return {
          ...ortak,
          miktar,
          kur: Number(r.kur) || 0,
          tutar: Number(r.tutar) || 0,
          komisyon: Number(r.komisyon) || 0,
          bmv: Number(r.bmv) || 0,
          secilenKur,
          secilenTl: miktar * secilenKur,
          kurSatis: ks,
          tlSatis: miktar * ks,
        };
      });

    const oz = new Map<string, any>();
    for (const x of satirlar) {
      const k = `${x.vezneKod}|${x.paraKod}|${x.milyem || 0}`;
      const o = oz.get(k) || {
        vezne: x.vezneBaslik,
        paraKod: x.paraKod,
        paraId: x.paraId,
        milyem: x.milyem,
        giris: 0,
        cikis: 0,
        hasKarsiligi: 0,
      };
      o.giris += x.giris;
      o.cikis += x.cikis;
      if (x.hasKarsiligi) {
        o.hasKarsiligi += (x.giris ? x.hasKarsiligi : -x.hasKarsiligi);
      }
      oz.set(k, o);
    }
    // Para ayrımı (K11): özet tablosunda her veznenin içinde Döviz / Kuyum başlıkları (yalnız başlık)
    const pg = await paraGrupBilgisi(pool);
    const ozet = vezneOzetiBaslikla([...oz.values()].map(o => ({ ...o, net: o.giris - o.cikis })), o => pg.grup(o));
    return sinirla(satirlar, t, `${aralikOzeti(p)} · ${(p.baslangicSaat || "00:00").slice(0, 5)}–${(p.bitisSaat || "23:59").slice(0, 5)}${ozetEk(p) || " · Tüm vezneler"}${p.fisTipi === 0 ? " · Yalnız alış fişleri" : p.fisTipi === 1 ? " · Yalnız satış fişleri" : ""} · ${kur.aciklama}`,
      `Seçilen aralıkta vezne hareketi yok. ${VEZNE_BAKIYE_DIPNOT}`,
      ozet);
  },

  /**
   * Vezne Hareket (Altın) — vezne altın hareketleri: sarraf fişleri ve altın işlemleri, işçilik detayları (hesaplama şekli: adet/gram/toplam, işçilik miktarı, has gram ve TL karşılığı).
   */
  async VEZALT1(pool, p, t) {
    if (!p.baslangic || !p.bitis) throw ApiError.badRequest("Tarih aralığı zorunludur.");
    const d = await belgeTablolari(pool);
    const ISCILIK_SEKLI: Record<number, string> = { 0: "Adet", 1: "Toplam", 2: "Gram" };

    const yeniReq = (paraKolon: string) => {
      const r = pool.request()
        .input("bas", sql.Date, p.baslangic)
        .input("bit", sql.Date, p.bitis)
        .input("tip", sql.Int, p.fisTipi === 0 || p.fisTipi === 1 ? p.fisTipi : null);
      const f = filtreler(r, p, { vezne: "V", para: paraKolon });
      return { req: r, f };
    };

    const satirlarHam: any[] = [];

    if (d.sarraf) {
      // 1. Sarraf Fişi Satırları (ürünler ve işçilik)
      const { req: sReq, f: fSarraf } = yeniReq("S.URUN_ID");
      const sres = await sReq.query(`
        SELECT
          F.SARRAF_FISI_ID fisId, S.SATIR_NO satirNo, F.TARIH tarih, ISNULL(F.SAAT, F.EKLEME_ZAMANI) zaman,
          'Sarraf fişi' belge, RTRIM(ISNULL(F.FIS_NO,'')) belgeNo, RTRIM(ISNULL(F.UNVAN,'')) unvan,
          F.TIP tipKod, RTRIM(ISNULL(V.KOD,'')) vezneKod, RTRIM(ISNULL(V.AD,'')) vezneAd,
          COALESCE(NULLIF(RTRIM(P.AD),''), RTRIM(P.KOD)) cins, RTRIM(P.KOD) paraKod, S.URUN_ID paraId,
          ISNULL(S.ADET,0) adet, ISNULL(S.MIKTAR,0) miktar, ISNULL(S.MILYEM,0) milyem, ISNULL(S.HAS_GRAM,0) hasGram,
          ISNULL(S.ISCILIK_HESAPLAMA_SEKLI,0) sekilKod, ISNULL(S.ISCILIK_MIKTARI,0) iscilikMiktari,
          ISNULL(S.ISCILIK_HAS_GRAM,0) iscilikHasGram, ISNULL(F.ALTIN_HAS_KURU,0) hasKuru,
          ISNULL(S.KUR,0) kur, ISNULL(S.TUTAR,0) tutar, RTRIM(ISNULL(U.AD, '')) kaydeden
        FROM dbo.TODVZ_SARRAF_FISI F
          JOIN dbo.TODVZ_SARRAF_FISI_SATIRI S ON S.SARRAF_FISI_ID=F.SARRAF_FISI_ID
          LEFT JOIN dbo.TODVZ_PARA P ON P.PARA_ID=S.URUN_ID
          LEFT JOIN dbo.TODVZ_VEZNE V ON V.VEZNE_ID=F.VEZNE_ID
          LEFT JOIN dbo.TODVZ_KULLANICI U ON U.KULLANICI_ID=F.EKLEYEN_ID
        WHERE CAST(F.TARIH AS date) BETWEEN @bas AND @bit
          AND (@tip IS NULL OR F.TIP=@tip)
          ${fSarraf}
        ORDER BY F.TARIH, F.SARRAF_FISI_ID, S.SATIR_NO;`);
      satirlarHam.push(...sres.recordset);

      // 2. Sarraf Fişi Altın Ödeme Satırları (hurda / has ile ödeme)
      const { req: oReq, f: fOdeme } = yeniReq("OS.PARA_ID");
      const ores = await oReq.query(`
        SELECT
          F.SARRAF_FISI_ID fisId, OS.SATIR_NO satirNo, F.TARIH tarih, ISNULL(F.SAAT, F.EKLEME_ZAMANI) zaman,
          'Sarraf ödeme' belge, RTRIM(ISNULL(F.FIS_NO,'')) belgeNo, RTRIM(ISNULL(F.UNVAN,'')) unvan,
          CASE WHEN F.TIP=1 THEN 0 ELSE 1 END tipKod, RTRIM(ISNULL(V.KOD,'')) vezneKod, RTRIM(ISNULL(V.AD,'')) vezneAd,
          COALESCE(NULLIF(RTRIM(P.AD),''), RTRIM(P.KOD)) cins, RTRIM(P.KOD) paraKod, OS.PARA_ID paraId,
          0 adet, ISNULL(OS.MIKTAR,0) miktar,
          COALESCE(OS.MILYEM, CAST(ROUND(ISNULL(P.HAS_ORANI,0)*1000, 0) AS int)) milyem,
          COALESCE(OS.HAS_GRAM, ISNULL(OS.MIKTAR,0)*ISNULL(P.HAS_ORANI,0)) hasGram,
          0 sekilKod, 0 iscilikMiktari, 0 iscilikHasGram, ISNULL(F.ALTIN_HAS_KURU,0) hasKuru,
          ISNULL(OS.KUR,0) kur, ISNULL(OS.TUTAR,0) tutar, RTRIM(ISNULL(U.AD, '')) kaydeden
        FROM dbo.TODVZ_SARRAF_FISI F
          JOIN dbo.TODVZ_ODEME_SATIRI OS ON OS.SARRAF_FISI_ID=F.SARRAF_FISI_ID
          JOIN dbo.TODVZ_PARA P ON P.PARA_ID=OS.PARA_ID
          LEFT JOIN dbo.TODVZ_VEZNE V ON V.VEZNE_ID=F.VEZNE_ID
          LEFT JOIN dbo.TODVZ_KULLANICI U ON U.KULLANICI_ID=F.EKLEYEN_ID
        WHERE OS.ISLEME_YERI=0
          AND CAST(F.TARIH AS date) BETWEEN @bas AND @bit
          AND (@tip IS NULL OR F.TIP=@tip)
          AND ISNULL(P.HAS_ORANI,0) > 0
          ${fOdeme}
        ORDER BY F.TARIH, F.SARRAF_FISI_ID, OS.SATIR_NO;`);
      satirlarHam.push(...ores.recordset);
    }

    // 3. Döviz fişlerindeki altın satırları
    const { req: dReq, f: fDoviz } = yeniReq("S.PARA_ID");
    const dres = await dReq.query(`
      SELECT
        F.FIS_ID fisId, S.SATIR_NO satirNo, F.TARIH tarih, ISNULL(F.ZAMAN, F.EKLEME_ZAMANI) zaman,
        'Döviz fişi' belge, COALESCE(NULLIF(RTRIM(F.SERI_NO),''), RTRIM(ISNULL(F.BELGE_NO,''))) belgeNo,
        RTRIM(ISNULL(F.UNVAN,'')) unvan, F.TIP tipKod, RTRIM(ISNULL(V.KOD,'')) vezneKod, RTRIM(ISNULL(V.AD,'')) vezneAd,
        COALESCE(NULLIF(RTRIM(P.AD),''), RTRIM(P.KOD)) cins, RTRIM(P.KOD) paraKod, S.PARA_ID paraId,
        0 adet, ISNULL(S.MIKTAR,0) miktar,
        CAST(ROUND(ISNULL(P.HAS_ORANI,0)*1000, 0) AS int) milyem,
        ISNULL(S.MIKTAR,0) * ISNULL(P.HAS_ORANI,0) hasGram,
        CASE WHEN ISNULL(S.ISCILIK,0)<>0 THEN 2 ELSE 0 END sekilKod,
        ISNULL(S.ISCILIK,0) iscilikMiktari,
        0 iscilikHasGram, 0 hasKuru, ISNULL(S.KUR,0) kur, ISNULL(S.TUTAR,0) tutar,
        RTRIM(ISNULL(U.AD, '')) kaydeden
      FROM dbo.TODVZ_FIS F
        JOIN dbo.TODVZ_FIS_SATIRI S ON S.FIS_ID=F.FIS_ID
        JOIN dbo.TODVZ_PARA P ON P.PARA_ID=S.PARA_ID
        LEFT JOIN dbo.TODVZ_VEZNE V ON V.VEZNE_ID=F.VEZNE_ID
        LEFT JOIN dbo.TODVZ_KULLANICI U ON U.KULLANICI_ID=F.EKLEYEN_ID
      WHERE ISNULL(F.IPTAL,0)=0
        AND CAST(F.TARIH AS date) BETWEEN @bas AND @bit
        AND (@tip IS NULL OR F.TIP=@tip)
        AND ISNULL(P.HAS_ORANI,0) > 0
        ${fDoviz}
      ORDER BY F.TARIH, F.FIS_ID, S.SATIR_NO;`);
    satirlarHam.push(...dres.recordset);

    const sb = (p.baslangicSaat || "00:00").slice(0, 5), se = (p.bitisSaat || "23:59").slice(0, 5), saatSuz = sb !== "00:00" || se !== "23:59";
    const satirlar = satirlarHam.map((r: any) => ({ ...r, saat: saatTr(r.zaman) }))
      .filter((r: any) => !saatSuz || ((r.saat || "00:00") >= sb && (r.saat || "00:00") <= se))
      .sort((a: any, b: any) => a.vezneKod.localeCompare(b.vezneKod) || new Date(a.tarih).getTime() - new Date(b.tarih).getTime() || (a.saat || "").localeCompare(b.saat || ""))
      .map((r: any) => {
        const ihg = Number(r.iscilikHasGram) || 0, hk = Number(r.hasKuru) || 0, im = Number(r.iscilikMiktari) || 0, miktar = Number(r.miktar) || 0;
        const iscilikVar = ihg !== 0 || im !== 0;
        let iscilikTutari = 0;
        if (ihg !== 0 && hk !== 0) {
          iscilikTutari = ihg * hk;
        } else if (r.belge === "Döviz fişi" && im !== 0) {
          iscilikTutari = im * miktar;
        } else if (im !== 0) {
          iscilikTutari = r.sekilKod === 1 ? im : (r.sekilKod === 0 ? im * (Number(r.adet) || 1) : im * miktar);
        }
        return {
          ...r,
          vezneBaslik: `${r.vezneKod} — ${r.vezneAd}`,
          tip: Number(r.tipKod) === 1 ? "Satış" : "Alış",
          adet: Number(r.adet) || 0,
          miktar,
          milyem: Number(r.milyem) || 0,
          hasGram: Number(r.hasGram) || 0,
          sekil: iscilikVar ? (ISCILIK_SEKLI[Number(r.sekilKod)] || "Toplam") : "-",
          iscilikMiktari: iscilikVar ? im : null,
          iscilikHasGram: iscilikVar ? ihg : null,
          hasKuru: hk || null,
          iscilikTutari,
          kur: Number(r.kur) || 0,
          tutar: Number(r.tutar) || 0,
        };
      });

    const oz = new Map<string, any>();
    for (const x of satirlar) {
      const k = `${x.cins}|${x.tip}`;
      const o = oz.get(k) || { cins: x.cins, tip: x.tip, paraKod: x.paraKod, paraId: x.paraId, adet: 0, miktar: 0, hasGram: 0, iscilikTutari: 0, tutar: 0 };
      o.adet += (x.adet || 0);
      o.miktar += (x.miktar || 0);
      o.hasGram += (x.hasGram || 0);
      o.iscilikTutari += (x.iscilikTutari || 0);
      o.tutar += (x.tutar || 0);
      oz.set(k, o);
    }
    // Para ayrımı (K11): özet tablosunda ürünler Döviz / Kuyum başlıkları altında; genel toplam satırı ayrı "Toplam" başlığının altında kalır (yalnız başlık)
    const pg = await paraGrupBilgisi(pool);
    const urunler = [...oz.values()];
    const ozet: Satir[] = paraBasliklariEkle(urunler, { grupla: o => pg.grup(o), alan: "cins" });
    if (urunler.length > 1) {
      ozet.push({ cins: "Toplam", _baslik: "Toplam", _stil: "baslik" }, {
        cins: "GENEL TOPLAM",
        tip: "",
        adet: urunler.reduce((s, o) => s + (o.adet || 0), 0),
        miktar: urunler.reduce((s, o) => s + (o.miktar || 0), 0),
        hasGram: urunler.reduce((s, o) => s + (o.hasGram || 0), 0),
        iscilikTutari: urunler.reduce((s, o) => s + (o.iscilikTutari || 0), 0),
        tutar: urunler.reduce((s, o) => s + (o.tutar || 0), 0),
      });
    }

    return sinirla(satirlar, t, `${aralikOzeti(p)} · ${(p.baslangicSaat || "00:00").slice(0, 5)}–${(p.bitisSaat || "23:59").slice(0, 5)}${ozetEk(p) || " · Tüm vezneler"}${p.fisTipi === 0 ? " · Yalnız alış" : p.fisTipi === 1 ? " · Yalnız satış" : ""}`,
      "Seçilen aralıkta vezne altın hareketi bulunamadı.",
      ozet);
  },
};
