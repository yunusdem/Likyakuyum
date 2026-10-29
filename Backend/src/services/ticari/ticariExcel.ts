import ExcelJS from "exceljs";
import sql from "mssql";
import { ApiError } from "../../utils/ApiError.js";
import { DbBaglam, StokKartGirdi, TicariStokSqlRepository, kartGirdisiDenetle } from "../../models/ticariStokSql.repository.js";
import { TicariGirisSqlRepository } from "../../models/ticariGirisSql.repository.js";
import { TicariFiyatSqlRepository } from "../../models/ticariFiyatSql.repository.js";

/**
 * Stok kartlarını Excel'den yükleme (docs/TICARI_ISLEMLER_YOL_HARITASI.md, T20). Örnek dosya + sütun açıklamaları;
 * yüklenen dosya önce önizlenir: eksik / tanınmayan sütun en üstte, hatalı hücre satır ve sütun adıyla. Hata varken
 * yükleme yapılmaz. Kod ya da barkod mevcut kartla eşleşirse kart güncellenir; açılış miktarı doluysa tek bir
 * "Excel açılış" stok giriş fişi yazılır. Hepsi tek işlemde.
 */

export interface ExcelSutun {
  anahtar: keyof ExcelSatir;
  baslik: string;
  zorunlu: boolean;
  ornek: string;
  aciklama: string;
}

export interface ExcelSatir {
  kod: string;
  ad: string;
  barkod: string;
  grup: string;
  birim: string;
  kdvOrani: string;
  satisFiyati: string;
  fiyatKdvDahil: string;
  paraBirimi: string;
  alisFiyati: string;
  enAzStok: string;
  acilisMiktari: string;
  aktif: string;
  stokKontrol: string;
  tedarikci: string;
  aciklama: string;
  /** "Fiyat: <liste adı>" sütunları: liste adı → hücre (İş 11, G8) */
  listeFiyatlari?: Record<string, string>;
}

export const EXCEL_SUTUNLARI: ExcelSutun[] = [
  { anahtar: "kod", baslik: "Kod", zorunlu: false, ornek: "KLM001", aciklama: "Boşsa otomatik verilir (STK00001). Kod ya da barkod mevcut bir kartla eşleşirse o kart güncellenir; boş bıraktığınız hücreler kartta değişmez." },
  { anahtar: "ad", baslik: "Ürün Adı", zorunlu: true, ornek: "Tükenmez Kalem Mavi", aciklama: "Zorunlu, en çok 200 karakter." },
  { anahtar: "barkod", baslik: "Barkod", zorunlu: false, ornek: "8690000000011;8690000000028", aciklama: "Birden fazlaysa ; ile ayırın. Başka kartta olmamalı. Güncellenen karta eklenir (eski barkodlar silinmez)." },
  { anahtar: "grup", baslik: "Grup", zorunlu: false, ornek: "Kırtasiye", aciklama: "Yoksa yeni grup açılır." },
  { anahtar: "birim", baslik: "Birim", zorunlu: false, ornek: "Adet", aciklama: "Adet, Kg, Gr, Lt, Metre, Paket, Kutu. Boşsa Adet." },
  { anahtar: "kdvOrani", baslik: "KDV %", zorunlu: false, ornek: "20", aciklama: "0, 1, 8, 10, 18 ya da 20. Boşsa 20." },
  { anahtar: "satisFiyati", baslik: "Satış Fiyatı", zorunlu: false, ornek: "25,50", aciklama: "Sayı. Ondalık için virgül ya da nokta." },
  { anahtar: "fiyatKdvDahil", baslik: "Fiyat KDV Dahil", zorunlu: false, ornek: "E", aciklama: "E ya da H. Boşsa E (dahil)." },
  { anahtar: "paraBirimi", baslik: "Para Birimi", zorunlu: false, ornek: "TL", aciklama: "Ürün Tanımları'ndaki kod (TL, USD, EUR…). Boşsa TL." },
  { anahtar: "alisFiyati", baslik: "Alış Fiyatı", zorunlu: false, ornek: "15", aciklama: "KDV hariç alış fiyatı (sayı)." },
  { anahtar: "enAzStok", baslik: "En Az Stok", zorunlu: false, ornek: "10", aciklama: "Altına düşünce Stok Durum Listesi uyarır." },
  { anahtar: "acilisMiktari", baslik: "Açılış Miktarı", zorunlu: false, ornek: "100", aciklama: "Doluysa \"Excel açılış\" stok giriş fişiyle stoğa eklenir." },
  { anahtar: "aktif", baslik: "Aktif", zorunlu: false, ornek: "E", aciklama: "E ya da H. Boşsa E." },
  { anahtar: "stokKontrol", baslik: "Stok Kontrol", zorunlu: false, ornek: "Ayar", aciklama: "Ayar (Stok Ayarları'ndaki genel davranış), Uyar, Engelle ya da Sessiz. Boşsa Ayar." },
  { anahtar: "tedarikci", baslik: "Tedarikçi", zorunlu: false, ornek: "", aciklama: "Tedarikçi carinin kodu (Cari Kart Listesi). Boşsa dokunulmaz." },
  { anahtar: "aciklama", baslik: "Açıklama", zorunlu: false, ornek: "", aciklama: "En çok 500 karakter." },
];

const ana = (s: string) =>
  s.toLocaleLowerCase("tr-TR").replace(/ı/g, "i").replace(/ş/g, "s").replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ö/g, "o").replace(/ç/g, "c")
    .replace(/[^a-z0-9%]/g, "");

/** Başlık eşleri (eski / kısa yazımlar) */
const BASLIK_ESLERI: Record<string, keyof ExcelSatir> = {
  ...Object.fromEntries(EXCEL_SUTUNLARI.map((s) => [ana(s.baslik), s.anahtar])),
  urunkodu: "kod", stokkodu: "kod", urun: "ad", urunadi: "ad", ad: "ad", stokadi: "ad", barkodlar: "barkod", urungrubu: "grup",
  kdv: "kdvOrani", kdvorani: "kdvOrani", satisfiyat: "satisFiyati", kdvdahil: "fiyatKdvDahil", para: "paraBirimi", doviz: "paraBirimi",
  alisfiyat: "alisFiyati", minimumstok: "enAzStok", enazstok: "enAzStok", acilis: "acilisMiktari", acilisstok: "acilisMiktari", miktar: "acilisMiktari",
};

export async function ornekExcel(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Ürünler");
  ws.columns = EXCEL_SUTUNLARI.map((s) => ({ header: s.baslik, key: s.anahtar, width: Math.max(14, s.baslik.length + 4, Math.min(30, s.ornek.length + 2)) }));
  ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E79" } };
  ws.addRow(Object.fromEntries(EXCEL_SUTUNLARI.map((s) => [s.anahtar, s.ornek])));
  ws.addRow({ kod: "", ad: "Defter A4 Kareli", barkod: "8690000000035", grup: "Kırtasiye", birim: "Adet", kdvOrani: "20", satisFiyati: "45", fiyatKdvDahil: "E", paraBirimi: "TL", alisFiyati: "30", enAzStok: "5", acilisMiktari: "40", aktif: "E", aciklama: "" });
  // Barkod ve kodun bilimsel gösterime dönmemesi için metin biçimi
  ["A", "C"].forEach((c) => (ws.getColumn(c).numFmt = "@"));
  const ac = wb.addWorksheet("Açıklama");
  ac.columns = [{ header: "Sütun", key: "s", width: 18 }, { header: "Zorunlu", key: "z", width: 10 }, { header: "Açıklama", key: "a", width: 90 }];
  ac.getRow(1).font = { bold: true };
  EXCEL_SUTUNLARI.forEach((s) => ac.addRow({ s: s.baslik, z: s.zorunlu ? "Evet" : "", a: s.aciklama }));
  ac.addRow({ s: "Fiyat: <liste adı>", z: "", a: "Tanımlı bir fiyat listesindeki kart fiyatı (ör. \"Fiyat: Toptan\"). Listeyi önce Ticari › Fiyat Listeleri'nde açın; boş hücre dokunmaz, boş bırakılan kartta ana fiyat geçerlidir." });
  ac.addRow({});
  ac.addRow({ s: "Not", a: "Başlık satırını değiştirmeyin. Veriler 'Ürünler' sayfasında, ilk satırdaki başlıkların altında olmalı. Örnek satırları silip kendi ürünlerinizi yazın." });
  return Buffer.from(await wb.xlsx.writeBuffer());
}

const hucreMetni = (v: ExcelJS.CellValue): string => {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") {
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    const o = v as any;
    if (o.richText) return o.richText.map((r: any) => r.text).join("").trim();
    if (o.text !== undefined) return String(o.text).trim();
    if (o.result !== undefined) return String(o.result).trim();
    return "";
  }
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : String(v);
  return String(v).trim();
};

export interface OnizlemeSatiri {
  satir: number;
  deger: ExcelSatir;
  durum: "YENI" | "GUNCELLE";
  eslesenKod: string | null;
  hatalar: { sutun: string; mesaj: string }[];
}

export interface Onizleme {
  sutunHatalari: string[];
  bilgiler: string[];
  satirlar: OnizlemeSatiri[];
  hataliSatir: number;
  yeni: number;
  guncellenecek: number;
  acilisKalemi: number;
  yuklenebilir: boolean;
}

/** Dosyayı okur: başlık eşlemesi + veri satırları. */
export async function excelOku(dosya: Buffer): Promise<{ sutunHatalari: string[]; satirlar: { satir: number; deger: ExcelSatir }[]; listeAdlari: string[]; eksikSutunlar: string[] }> {
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(dosya as any);
  } catch {
    throw ApiError.badRequest("Dosya okunamadı. Örnek dosyadaki gibi .xlsx biçiminde kaydedin (Excel › Farklı Kaydet › Excel Çalışma Kitabı).");
  }
  const ws = wb.worksheets.find((w) => ana(w.name) === "urunler") || wb.worksheets[0];
  if (!ws) throw ApiError.badRequest("Dosyada sayfa yok.");
  const sutunHatalari: string[] = [];
  const baslik = ws.getRow(1);
  const eslem = new Map<number, keyof ExcelSatir>();
  const gorulen = new Set<keyof ExcelSatir>();
  const listeSutunlari = new Map<number, string>();
  baslik.eachCell({ includeEmpty: false }, (c, no) => {
    const metin = hucreMetni(c.value);
    if (!metin) return;
    // "Fiyat: <liste adı>" → tanımlı fiyat listesi sütunu (İş 11, G8)
    const lm = /^fiyat\s*:\s*(.+)$/i.exec(metin);
    if (lm) {
      const ad = lm[1].trim();
      if ([...listeSutunlari.values()].some((x) => ana(x) === ana(ad))) sutunHatalari.push(`"${metin}" sütunu iki kez var (${c.address}). Birini silin.`);
      else listeSutunlari.set(no, ad);
      return;
    }
    const a = BASLIK_ESLERI[ana(metin)];
    if (!a) { sutunHatalari.push(`"${metin}" sütunu tanınmadı (${c.address}). Başlığı örnek dosyadaki gibi yazın ya da sütunu silin.`); return; }
    if (gorulen.has(a)) { sutunHatalari.push(`"${metin}" sütunu iki kez var (${c.address}). Birini silin.`); return; }
    gorulen.add(a);
    eslem.set(no, a);
  });
  // Zorunlu sütun eksikse hata; isteğe bağlı sütun eksikse yalnız bilgi (eski örnek dosyayla hazırlanan dosyalar yüklenebilsin)
  const eksikSutunlar: string[] = [];
  for (const s of EXCEL_SUTUNLARI) {
    if (gorulen.has(s.anahtar)) continue;
    if (s.zorunlu) sutunHatalari.push(`"${s.baslik}" sütunu eksik (zorunlu). Örnek dosyadaki başlık satırını kullanın.`);
    else eksikSutunlar.push(s.baslik);
  }
  const satirlar: { satir: number; deger: ExcelSatir }[] = [];
  const bos = Object.fromEntries(EXCEL_SUTUNLARI.map((s) => [s.anahtar, ""])) as unknown as ExcelSatir;
  ws.eachRow({ includeEmpty: false }, (row, no) => {
    if (no === 1) return;
    const deger: ExcelSatir = { ...bos };
    let dolu = false;
    eslem.forEach((a, sutunNo) => {
      const m = hucreMetni(row.getCell(sutunNo).value);
      if (m) dolu = true;
      (deger as any)[a] = m;
    });
    if (listeSutunlari.size) {
      deger.listeFiyatlari = {};
      listeSutunlari.forEach((ad, sutunNo) => {
        const m = hucreMetni(row.getCell(sutunNo).value);
        if (m) dolu = true;
        deger.listeFiyatlari![ad] = m;
      });
    }
    if (dolu) satirlar.push({ satir: no, deger });
  });
  if (satirlar.length > 5000) throw ApiError.badRequest("Bir seferde en çok 5.000 ürün yüklenebilir; dosyayı bölün.");
  return { sutunHatalari, satirlar, listeAdlari: [...listeSutunlari.values()], eksikSutunlar };
}

const evetHayir = (v: string): boolean | null | "hata" => {
  const t = ana(v);
  if (!t) return null;
  if (["e", "evet", "1", "true", "x", "var"].includes(t)) return true;
  if (["h", "hayir", "0", "false", "yok"].includes(t)) return false;
  return "hata";
};

const sutunAdi = (a: keyof ExcelSatir) => EXCEL_SUTUNLARI.find((s) => s.anahtar === a)!.baslik;

/** Okunan satırları denetler; veritabanıyla karşılaştırır (kod / barkod eşleşmesi, para birimi). */
export async function excelDenetle(okunan: Awaited<ReturnType<typeof excelOku>>, ctx?: DbBaglam): Promise<{ onizleme: Onizleme; girdiler: (StokKartGirdi & { grupAdi: string; acilis: number })[] }> {
  const pool = await TicariStokSqlRepository.havuz(ctx);
  // Bütün kartlar yerine yalnız dosyadaki kod ve barkodlar sorgulanır (G2: 200.000 kartlı firmada tüm liste belleğe alınmasın)
  const dosyaKodListesi = [...new Set(okunan.satirlar.map((x) => x.deger.kod.trim().toLocaleUpperCase("tr-TR")).filter(Boolean))];
  const dosyaBarkodListesi = [...new Set(okunan.satirlar.flatMap((x) => x.deger.barkod.split(/[;,|]/).map((b) => b.trim()).filter(Boolean)))];
  const parcali = async (degerler: string[], tip: sql.ISqlType | (() => sql.ISqlType), sorgu: (liste: string) => string): Promise<any[]> => {
    const sonuc: any[] = [];
    for (let i = 0; i < degerler.length; i += 1000) {
      const req = pool.request();
      const adlar = degerler.slice(i, i + 1000).map((d, j) => { req.input(`P${j}`, tip as any, d); return `@P${j}`; });
      sonuc.push(...(await req.query(sorgu(adlar.join(",")))).recordset);
    }
    return sonuc;
  };
  const kodKayitlari = await parcali(dosyaKodListesi, sql.VarChar(30), (l) => `SELECT STOK_KART_ID, RTRIM(KOD) AS KOD FROM dbo.TODVZ_STOK_KART WHERE KOD IN (${l})`);
  const barkodKayitlari = await parcali(dosyaBarkodListesi, sql.VarChar(50), (l) => `SELECT B.BARKOD, B.STOK_KART_ID, RTRIM(K.KOD) AS KOD FROM dbo.TODVZ_STOK_BARKOD B JOIN dbo.TODVZ_STOK_KART K ON K.STOK_KART_ID = B.STOK_KART_ID WHERE B.BARKOD IN (${l})`);
  const kodaGore = new Map<string, number>(kodKayitlari.map((k) => [String(k.KOD).toLocaleUpperCase("tr-TR"), k.STOK_KART_ID]));
  const kodlar = new Map<number, string>([...kodKayitlari, ...barkodKayitlari].map((k) => [k.STOK_KART_ID, String(k.KOD)]));
  const barkodlar = new Map<string, number>(barkodKayitlari.map((b) => [String(b.BARKOD).trim(), b.STOK_KART_ID]));
  const paralar = new Map<string, number>(((await pool.request().query(`SELECT PARA_ID, RTRIM(UPPER(KOD)) AS KOD FROM dbo.TODVZ_PARA`)).recordset as any[]).map((p) => [String(p.KOD), p.PARA_ID]));
  // Fiyat listesi sütunları (İş 11): liste tanımlı olmalı
  const listeler = await TicariFiyatSqlRepository.listeler(ctx);
  const listeIdleri = new Map<string, number>();
  for (const ad of okunan.listeAdlari || []) {
    const l = listeler.find((x) => ana(x.ad) === ana(ad));
    if (!l) okunan.sutunHatalari.push(`"Fiyat: ${ad}" sütunu için tanımlı fiyat listesi yok. Önce Ticari › Fiyat Listeleri'nde açın ya da sütunu silin.`);
    else listeIdleri.set(ad, l.fiyatListesiId);
  }
  // Tedarikçi kodları (İş 11, G10): yalnız dosyadakiler sorgulanır
  const tedarikciKodlari = [...new Set(okunan.satirlar.map((x) => String(x.deger.tedarikci || "").trim().toLocaleUpperCase("tr-TR")).filter(Boolean))];
  const tedarikciler = new Map<string, number>((await parcali(tedarikciKodlari, sql.VarChar(50), (l) => `SELECT RTRIM(UPPER(KOD)) AS KOD, CARI_KART_ID FROM dbo.TODVZ_CARI_KART WHERE RTRIM(UPPER(KOD)) IN (${l})`)).map((c) => [String(c.KOD), Number(c.CARI_KART_ID)]));
  const gruplar = new Set<string>(((await pool.request().query(`SELECT AD FROM dbo.TODVZ_STOK_GRUP`)).recordset as any[]).map((g) => String(g.AD).trim().toLocaleLowerCase("tr-TR")));

  const dosyaKodlari = new Map<string, number>();
  const dosyaBarkodlari = new Map<string, number>();
  const yeniGruplar = new Set<string>();
  const satirlar: OnizlemeSatiri[] = [];
  const girdiler: (StokKartGirdi & { grupAdi: string; acilis: number })[] = [];

  for (const { satir, deger } of okunan.satirlar) {
    const hatalar: { sutun: string; mesaj: string }[] = [];
    const ekle = (a: keyof ExcelSatir, mesaj: string) => hatalar.push({ sutun: sutunAdi(a), mesaj });

    const kod = deger.kod.trim().toLocaleUpperCase("tr-TR");
    const barkodListesi = deger.barkod.split(/[;,|]/).map((b) => b.trim()).filter(Boolean);
    let eslesen: number | null = kod ? kodaGore.get(kod) ?? null : null;
    // Kod yazılmışsa eşleşme yalnız koddan (yeni kodlu satır başka kartın barkoduyla o kartın kodunu sessizce değiştirmesin);
    // kod boşsa barkoddan
    if (!kod) for (const b of barkodListesi) { if (barkodlar.has(b)) { eslesen = barkodlar.get(b)!; break; } }

    if (kod) {
      if (dosyaKodlari.has(kod)) ekle("kod", `"${kod}" kodu dosyada ${dosyaKodlari.get(kod)}. satırda da var.`);
      else dosyaKodlari.set(kod, satir);
    }
    for (const b of barkodListesi) {
      if (dosyaBarkodlari.has(b)) ekle("barkod", `"${b}" barkodu dosyada ${dosyaBarkodlari.get(b)}. satırda da var.`);
      else dosyaBarkodlari.set(b, satir);
      const sahibi = barkodlar.get(b);
      if (sahibi && sahibi !== eslesen) ekle("barkod", `"${b}" barkodu "${kodlar.get(sahibi)}" kartında kullanılıyor.`);
    }
    if (kod && eslesen && kodaGore.get(kod) && kodaGore.get(kod) !== eslesen) ekle("kod", `Kod "${kod}" ile barkod farklı kartları gösteriyor.`);

    let paraId: number | null = null;
    const pk = deger.paraBirimi.trim().toUpperCase();
    if (pk && !["TL", "TRY"].includes(pk)) {
      paraId = paralar.get(pk) ?? null;
      if (!paraId) ekle("paraBirimi", `"${deger.paraBirimi}" para birimi Ürün Tanımları'nda yok.`);
    } else if (pk) paraId = paralar.get("TL") ?? paralar.get("TRY") ?? null;

    const dahil = evetHayir(deger.fiyatKdvDahil);
    if (dahil === "hata") ekle("fiyatKdvDahil", `"${deger.fiyatKdvDahil}" yerine E ya da H yazın.`);
    const aktif = evetHayir(deger.aktif);
    if (aktif === "hata") ekle("aktif", `"${deger.aktif}" yerine E ya da H yazın.`);

    let acilis = 0;
    if (deger.acilisMiktari.trim()) {
      const t = deger.acilisMiktari.trim();
      const n = Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t);
      if (!Number.isFinite(n)) ekle("acilisMiktari", `"${t}" sayı değil.`);
      else if (n < 0) ekle("acilisMiktari", "Açılış miktarı eksi olamaz.");
      else acilis = n;
    }

    let tedarikciCariId: number | undefined;
    const tk = String(deger.tedarikci || "").trim().toLocaleUpperCase("tr-TR");
    if (tk) {
      const id = tedarikciler.get(tk);
      if (!id) ekle("tedarikci", `"${deger.tedarikci}" kodlu cari kart yok.`);
      else tedarikciCariId = id;
    }
    const listeFiyatlari: { fiyatListesiId: number; fiyat: number }[] = [];
    for (const [ad, hucre] of Object.entries(deger.listeFiyatlari || {})) {
      const id = listeIdleri.get(ad);
      if (!id || !String(hucre).trim()) continue;
      const t = String(hucre).trim();
      const n = Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t);
      if (!Number.isFinite(n) || n < 0) hatalar.push({ sutun: `Fiyat: ${ad}`, mesaj: `"${t}" sayı değil ya da eksi.` });
      else listeFiyatlari.push({ fiyatListesiId: id, fiyat: n });
    }
    const girdi: StokKartGirdi = {
      stokKartId: eslesen,
      kod: kod || (eslesen ? kodlar.get(eslesen) : "") || "",
      ad: deger.ad,
      birim: deger.birim,
      kdvOrani: deger.kdvOrani,
      satisFiyati: deger.satisFiyati,
      fiyatKdvDahil: dahil === "hata" ? null : dahil,
      paraId,
      alisFiyati: deger.alisFiyati,
      enAzStok: deger.enAzStok,
      aktif: aktif === "hata" ? null : aktif,
      aciklama: deger.aciklama,
      barkodlar: barkodListesi,
      stokKontrol: deger.stokKontrol,
      ...(tedarikciCariId !== undefined ? { tedarikciCariId } : {}),
      ...(listeFiyatlari.length ? { listeFiyatlari } : {}),
    };
    const den = kartGirdisiDenetle(girdi);
    for (const h of den.alanHatalari) ekle(h.alan === "barkodlar" ? "barkod" : h.alan, h.mesaj);
    const grupAdi = deger.grup.trim();
    if (grupAdi.length > 100) ekle("grup", "Grup adı en çok 100 karakter olabilir.");
    else if (grupAdi && !gruplar.has(grupAdi.toLocaleLowerCase("tr-TR"))) yeniGruplar.add(grupAdi);

    satirlar.push({ satir, deger, durum: eslesen ? "GUNCELLE" : "YENI", eslesenKod: eslesen ? kodlar.get(eslesen) || null : null, hatalar });
    girdiler.push({ ...girdi, grupAdi, acilis });
  }

  const hataliSatir = satirlar.filter((s) => s.hatalar.length).length;
  const bilgiler: string[] = [];
  if (okunan.eksikSutunlar?.length) bilgiler.push(`Dosyada olmayan sütunlar: ${okunan.eksikSutunlar.join(", ")} (bu alanlara dokunulmaz).`);
  if (yeniGruplar.size) bilgiler.push(`Açılacak yeni grup: ${[...yeniGruplar].join(", ")}`);
  const acilisKalemi = girdiler.filter((g) => g.acilis > 0).length;
  if (acilisKalemi) bilgiler.push(`${acilisKalemi} ürünün açılış miktarı "Excel açılış" stok giriş fişiyle girilecek.`);
  if (!okunan.satirlar.length) okunan.sutunHatalari.push("Dosyada başlık satırının altında ürün yok.");
  return {
    onizleme: {
      sutunHatalari: okunan.sutunHatalari,
      bilgiler,
      satirlar,
      hataliSatir,
      yeni: satirlar.filter((s) => s.durum === "YENI").length,
      guncellenecek: satirlar.filter((s) => s.durum === "GUNCELLE").length,
      acilisKalemi,
      yuklenebilir: !okunan.sutunHatalari.length && !hataliSatir && satirlar.length > 0,
    },
    girdiler,
  };
}

export async function excelOnizle(dosya: Buffer, ctx?: DbBaglam): Promise<Onizleme> {
  return (await excelDenetle(await excelOku(dosya), ctx)).onizleme;
}

/**
 * Denetimden geçen dosyayı tek işlemde yükler. Hata varsa hiçbir şey yazılmaz. Küme bazlı (G2): gruplar tek sorguyla
 * açılır, güncellenecek kartların eski değerleri tek sorguyla okunur, kartlar kartlariTopluYaz ile paketler hâlinde yazılır,
 * açılış miktarları tek giriş fişine toplu satır olarak girer.
 */
export async function excelYukle(dosya: Buffer, kullaniciId: number | undefined, ctx?: DbBaglam) {
  const { onizleme, girdiler } = await excelDenetle(await excelOku(dosya), ctx);
  if (!onizleme.yuklenebilir) throw ApiError.badRequest("Dosyada düzeltilmesi gereken hatalar var; önizlemedeki kırmızı hücreleri düzeltip yeniden yükleyin.", { onizleme });
  const pool = await TicariStokSqlRepository.havuz(ctx);
  const tx = new sql.Transaction(pool);
  await tx.begin();
  let girisNo: string | null = null;
  try {
    // Gruplar: eksik olanlar tek seferde açılır
    const grupAdlari = [...new Set(girdiler.map((g) => g.grupAdi.trim()).filter(Boolean))];
    const grupIdleri = new Map<string, number>();
    if (grupAdlari.length) {
      const anahtar = (ad: string) => ad.trim().toLocaleLowerCase("tr-TR");
      const oku = async () => {
        for (const g of (await new sql.Request(tx).query(`SELECT STOK_GRUP_ID, AD FROM dbo.TODVZ_STOK_GRUP`)).recordset as any[]) grupIdleri.set(anahtar(String(g.AD)), Number(g.STOK_GRUP_ID));
      };
      await oku();
      const yeni = grupAdlari.filter((ad) => !grupIdleri.has(anahtar(ad)));
      for (let i = 0; i < yeni.length; i += 500) {
        const paket = yeni.slice(i, i + 500);
        const req = new sql.Request(tx).input("E", sql.Int, kullaniciId || null);
        const degerler = paket.map((ad, j) => { req.input(`A${j}`, sql.NVarChar(100), ad.slice(0, 100)); return `(@A${j}, @E)`; });
        await req.query(`INSERT INTO dbo.TODVZ_STOK_GRUP (AD, EKLEYEN_ID) VALUES ${degerler.join(",")}`);
      }
      if (yeni.length) await oku();
    }
    // Güncellenecek kartların eski değerleri: Excel'de boş bırakılan hücre kartın değerini silmez, barkodlar eskilere eklenir
    const eskiler = new Map<number, any>();
    const guncellenecek = [...new Set(girdiler.map((g) => Number(g.stokKartId) || 0).filter(Boolean))];
    for (let i = 0; i < guncellenecek.length; i += 1000) {
      const r = await new sql.Request(tx).query(`
        SELECT K.*, STUFF((SELECT '|' + B.BARKOD FROM dbo.TODVZ_STOK_BARKOD B WHERE B.STOK_KART_ID = K.STOK_KART_ID ORDER BY B.STOK_BARKOD_ID FOR XML PATH(''), TYPE).value('.', 'varchar(max)'), 1, 1, '') AS BARKODLAR
        FROM dbo.TODVZ_STOK_KART K WHERE K.STOK_KART_ID IN (${guncellenecek.slice(i, i + 1000).join(",")})`);
      for (const e of r.recordset as any[]) eskiler.set(Number(e.STOK_KART_ID), e);
    }
    const bos = (v: unknown) => v === null || v === undefined || String(v).trim() === "";
    const yazilacaklar: StokKartGirdi[] = girdiler.map((g) => {
      const stokGrupId = g.grupAdi.trim() ? grupIdleri.get(g.grupAdi.trim().toLocaleLowerCase("tr-TR")) ?? null : null;
      const e = g.stokKartId ? eskiler.get(Number(g.stokKartId)) : undefined;
      if (!g.stokKartId) return { ...g, stokGrupId };
      const eskiBarkod = e?.BARKODLAR ? String(e.BARKODLAR).split("|").filter(Boolean) : [];
      return {
        ...g,
        stokGrupId: stokGrupId ?? e?.STOK_GRUP_ID ?? null,
        birim: bos(g.birim) ? e?.BIRIM : g.birim,
        kdvOrani: bos(g.kdvOrani) ? e?.KDV_ORANI : g.kdvOrani,
        satisFiyati: bos(g.satisFiyati) ? e?.SATIS_FIYATI : g.satisFiyati,
        fiyatKdvDahil: g.fiyatKdvDahil ?? (e ? e.FIYAT_KDV_DAHIL === true || e.FIYAT_KDV_DAHIL === 1 : true),
        paraId: g.paraId ?? e?.PARA_ID ?? null,
        alisFiyati: bos(g.alisFiyati) ? e?.ALIS_FIYATI : g.alisFiyati,
        enAzStok: bos(g.enAzStok) ? e?.EN_AZ_STOK : g.enAzStok,
        aktif: g.aktif ?? (e ? e.AKTIF === true || e.AKTIF === 1 : true),
        aciklama: bos(g.aciklama) ? e?.ACIKLAMA : g.aciklama,
        stokKontrol: bos(g.stokKontrol) ? e?.STOK_KONTROL ?? null : g.stokKontrol,
        tedarikciCariId: g.tedarikciCariId,
        listeFiyatlari: g.listeFiyatlari,
        barkodlar: [...new Set([...eskiBarkod, ...(g.barkodlar || [])])],
      };
    });
    let idler: number[];
    try {
      idler = await TicariStokSqlRepository.kartlariTopluYaz(tx, yazilacaklar, kullaniciId);
    } catch (e: any) {
      // "N. kayıt: …" → Excel satır numarasıyla
      const m = /^(\d+)\. kayıt: (.*)$/s.exec(String(e?.message || ""));
      if (m && onizleme.satirlar[Number(m[1]) - 1]) throw ApiError.badRequest(`${onizleme.satirlar[Number(m[1]) - 1].satir}. satır: ${m[2]}`);
      throw e;
    }
    const acilis = girdiler.flatMap((g, i) => {
      if (!(g.acilis > 0)) return [];
      const alis = g.alisFiyati === null || g.alisFiyati === undefined || String(g.alisFiyati).trim() === "" ? null : Number(String(g.alisFiyati).replace(",", "."));
      return [{ stokKartId: idler[i], miktar: g.acilis, birimFiyat: alis }];
    });
    if (acilis.length) {
      const r = await TicariGirisSqlRepository.yaz(tx, { aciklama: "Excel açılış", satirlar: acilis, eksiStokOnay: true }, kullaniciId);
      girisNo = (await new sql.Request(tx).input("ID", sql.Int, r.id).query(`SELECT FIS_NO FROM dbo.TODVZ_STOK_GIRIS WHERE STOK_GIRIS_ID = @ID`)).recordset[0]?.FIS_NO ?? null;
    }
    await tx.commit();
  } catch (e) {
    await tx.rollback().catch(() => undefined);
    throw e;
  }
  return { yeni: onizleme.yeni, guncellenen: onizleme.guncellenecek, acilisFisNo: girisNo ? String(girisNo).trim() : null };
}
