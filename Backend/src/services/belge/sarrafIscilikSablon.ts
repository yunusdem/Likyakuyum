import type { BelgeOge, BelgeSablon, TabloSatiri } from "./sablonCekirdek.js";

/**
 * Sarraf fişi çıktısında işçilik satırları her şablonda (docs/YETKI_DASHBOARD_ISCILIK_YOL_HARITASI.md Y1, Y2).
 * Firmanın Fiş Tasarımı'nda kaydettiği şablon varsayılanın yerine geçer; işçilik satırları sonradan eklendiği için eski
 * kayıtlarda yoktur. Yazdırma anında eksikse eklenir, firmanın düzeni (yer, boyut, yazı) değişmez; kayıtlı dosyaya yazılmaz.
 */

const ISCILIK_SATIRI = { etiket: "İşçilik (KDV dahil):", deger: "{{toplam.iscilik|sayi}} TL", kosul: "{{toplam.iscilikGoster}}" };
const ISCILIK_KDV_SATIRI = { etiket: "{{toplam.iscilikKdvEtiket}}", deger: "{{toplam.iscilikKdv|sayi}} TL", kosul: "{{toplam.iscilikVar}}" };

const satirDegeri = (s: TabloSatiri): string => (Array.isArray(s) ? String(s[1] ?? "") : String(s?.deger ?? ""));

/** Toplam tablosuna işçilik satırlarını ekler (GENEL TOPLAM satırından önce); varsa İşçilik satırının koşulunu günceller. */
function tabloyaEkle(satirlar: TabloSatiri[]): TabloSatiri[] {
  const iscilikVar = satirlar.some((s) => /toplam\.iscilik(\||\}|\s)/.test(satirDegeri(s)));
  const kdvVar = satirlar.some((s) => satirDegeri(s).includes("toplam.iscilikKdv"));
  // M15 dönemi kopyası: İşçilik satırı yalnız KDV varken çıkıyordu → işçilik varken (Y2)
  const yeni = satirlar.map((s) =>
    !Array.isArray(s) && /toplam\.iscilik(\||\}|\s)/.test(s.deger) && s.kosul === "{{toplam.iscilikVar}}" ? { ...s, kosul: ISCILIK_SATIRI.kosul } : s);
  const eklenecek: TabloSatiri[] = [...(iscilikVar ? [] : [ISCILIK_SATIRI]), ...(kdvVar ? [] : [ISCILIK_KDV_SATIRI])];
  if (!eklenecek.length) return yeni;
  const genel = yeni.findIndex((s) => /toplam\.tutar(\||\})/.test(satirDegeri(s)));
  const yer = genel >= 0 ? genel : yeni.length;
  return [...yeni.slice(0, yer), ...eklenecek, ...yeni.slice(yer)];
}

/** Toplamları `toplam.*` alanlarıyla yazan tablo / etiketli liste öğesi mi */
const toplamTablosuMu = (o: BelgeOge): o is Extract<BelgeOge, { tip: "tablo" }> =>
  (o.tip === "tablo" || o.tip === "liste") && Array.isArray((o as any).satirlar)
  && ((o as any).satirlar as TabloSatiri[]).some((s) => /toplam\.tutar(\||\})/.test(satirDegeri(s)));

export interface SarrafIscilikSonucu { sablon: BelgeSablon; veri: Record<string, any> }

/** Öğeyi dikeyde kaydırır (çizgide iki uç) */
const asagiKaydir = (o: BelgeOge, dy: number): BelgeOge => {
  if (!dy || o.tip === "filigran") return o;
  return (o.tip === "cizgi" ? { ...o, y1: o.y1 + dy, y2: o.y2 + dy } : { ...o, y: (o as any).y + dy }) as BelgeOge;
};
const ustKenar = (o: BelgeOge): number => (o.tip === "cizgi" ? Math.min(o.y1, o.y2) : o.tip === "filigran" ? -1 : Number((o as any).y) || 0);

export function sarrafSablonunaIscilikEkle(sablon: BelgeSablon, veri: Record<string, any>): SarrafIscilikSonucu {
  // Tabloya satır eklenince şablondaki (tam içerikli) yüksekliği büyür; altındaki öğeler eski yerinde kalırsa çizimde
  // yukarı çekilip tablonun üstüne biner. Eklenen satır kadar aşağı alınırlar (varsayılan şablondaki yerleşimle aynı sonuç).
  const kaymalar: { alt: number; dy: number }[] = [];
  const eklenmis = sablon.ogeler.map((o) => {
    if (!toplamTablosuMu(o)) return o;
    const yeni = tabloyaEkle(o.satirlar);
    const fark = yeni.length - o.satirlar.length;
    const satirH = o.satirH ?? 15;
    if (fark > 0) kaymalar.push({ alt: o.y + o.satirlar.length * satirH, dy: fark * satirH });
    return { ...o, satirlar: yeni } as BelgeOge;
  });
  const ogeler = eklenmis.map((o) => asagiKaydir(o, kaymalar.reduce((t, k) => (ustKenar(o) >= k.alt - 0.5 ? t + k.dy : t), 0)));
  let yeniVeri = veri;
  // Toplamları veriden (toplamSatirlari) yazan şablon: satışta işçilik fatura satırındadır (faturaSatirlari). Ürün listesi
  // fatura satırlarından gelmiyorsa (eski düzen) işçilik hiçbir yerde görünmez → toplamların başına eklenir.
  const toplamVeridenMi = ogeler.some((o) => o.tip === "liste" && o.kaynak === "toplamSatirlari");
  const faturaSatirli = ogeler.some((o) => o.tip === "liste" && o.kaynak === "faturaSatirlari");
  const t = veri?.toplam || {};
  if (toplamVeridenMi && !faturaSatirli && veri?.satim && t.iscilikGoster) {
    yeniVeri = { ...veri, toplamSatirlari: [...(veri.iscilikToplamSatirlari || []), ...(veri.toplamSatirlari || [])] };
  }
  return { sablon: { ...sablon, ogeler }, veri: yeniVeri };
}
