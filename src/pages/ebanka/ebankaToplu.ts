/**
 * e-Banka Muhasebeleştirme — toplu işlem kuralları ve fişin e-Belge kaynak satırını bulma
 * (docs/EBANKA_MUHASEBELESTIRME_YOL_HARITASI.md M7–M9). Saf: React / API içe aktarmaz, tsx ile sınanır.
 */

/** Toplu işlemlerin baktığı hareket alanları (MutabakatSatiri'nin alt kümesi) */
export interface TopluFis {
  fisTuru: "doviz" | "sarraf" | "perakende";
  fisId: number;
  fisNo: string | null;
  tarih: string | null;
  faturali: boolean;
  uyum?: "tam" | "yakin" | "uzak";
  baskaHarekette?: boolean;
}

export interface TopluSatir<F extends TopluFis = TopluFis> {
  vomsisId: number;
  durum: string;
  cari: { cariKartId: number; ad: string } | null;
  oneriCari: { cariKartId: number; ad: string } | null;
  faturaGerekmez: boolean;
  fisler: F[];
  adaylar: F[];
  belgeler?: unknown[];
}

export type TopluIslem = "esle" | "fisKes" | "faturalandir" | "cari" | "gerekmez";

/** Satıra uygulanacak iş ya da neden uygulanmadığı */
export type TopluKarar<T> = { tamam: true; deger: T } | { tamam: false; neden: string };

const red = (neden: string) => ({ tamam: false as const, neden });

/** Uygulanmama nedeni (strictNullChecks kapalıyken false dalı daralmadığı için yardımcı) */
export const nedenAl = (k: TopluKarar<unknown>): string => ("neden" in k ? k.neden : "");

const fisiVar = (s: TopluSatir<TopluFis>) => s.fisler.length > 0 || (s.belgeler?.length ?? 0) > 0;

/** Eşle: fişi / belgesi olmayan harekette tutarı kuruşu kuruşuna tutan, başka harekete eşli olmayan TEK aday varsa o. */
export function eslenecekAday<F extends TopluFis>(s: TopluSatir<F>): TopluKarar<F> {
  if (s.durum === "virman") return red("Hesaplar arası virman");
  if (fisiVar(s)) return red("Zaten eşli");
  if (s.faturaGerekmez) return red("Fatura gerektirmez işaretli");
  const tam = s.adaylar.filter((a) => a.uyum === "tam" && !a.baskaHarekette);
  if (tam.length === 1) return { tamam: true, deger: tam[0] };
  if (tam.length > 1) return red(`Tutarı tutan ${tam.length} aday var; pencereden seçin`);
  return red(s.adaylar.length ? "Tutarı tam tutan aday yok; pencereden elle eşleyin" : "Aday fiş yok");
}

/** Faturası kesilebilecek eşli fişler (perakende faturası kendi ekranında kesilir, M7). */
export function faturalanacakFisler<F extends TopluFis>(s: TopluSatir<F>): TopluKarar<F[]> {
  if (!s.fisler.length) return red((s.belgeler?.length ?? 0) > 0 ? "Belgesi kesilmiş" : "Eşli fiş yok");
  const faturasiz = s.fisler.filter((f) => !f.faturali);
  if (!faturasiz.length) return red("Faturası kesilmiş");
  const kesilecek = faturasiz.filter((f) => f.fisTuru !== "perakende");
  if (!kesilecek.length) return red("Perakende faturası kendi ekranından kesilir");
  return { tamam: true, deger: kesilecek };
}

/** Cari onayla: carisi bulunamamış, önerilen carisi olan hareket. */
export function onaylanacakCari(s: TopluSatir): TopluKarar<number> {
  if (s.durum === "virman") return red("Hesaplar arası virman");
  if (s.cari) return red("Carisi belli");
  if (!s.oneriCari) return red("Önerilen cari yok");
  return { tamam: true, deger: s.oneriCari.cariKartId };
}

/** Toplu fiş kes (T1): fişi / belgesi olmayan, virman ve "fatura gerektirmez" olmayan hareket. Hesap / kur / MASAK pencerede denetlenir. */
export function fisKesilebilir(s: TopluSatir): TopluKarar<true> {
  if (s.durum === "virman") return red("Hesaplar arası virman");
  if (fisiVar(s)) return red("Fişi / belgesi var");
  if (s.faturaGerekmez) return red("Fatura gerektirmez işaretli");
  return { tamam: true, deger: true };
}

/** Fatura gerektirmez: fişi / belgesi olmayan, henüz işaretlenmemiş hareket. */
export function gerekmezIsaretlenebilir(s: TopluSatir): TopluKarar<true> {
  if (s.durum === "virman") return red("Hesaplar arası virman");
  if (fisiVar(s)) return red("Fişi / belgesi var");
  if (s.faturaGerekmez) return red("Zaten işaretli");
  return { tamam: true, deger: true };
}

export function topluKarar(islem: TopluIslem, s: TopluSatir): TopluKarar<unknown> {
  switch (islem) {
    case "esle": return eslenecekAday(s);
    case "fisKes": return fisKesilebilir(s);
    case "faturalandir": return faturalanacakFisler(s);
    case "cari": return onaylanacakCari(s);
    case "gerekmez": return gerekmezIsaretlenebilir(s);
  }
}

/** Seçili satırlardan işe uygun olanların sayısı (düğmedeki sayaç) */
export const uygunSayisi = (islem: TopluIslem, satirlar: TopluSatir[]): number => satirlar.filter((s) => topluKarar(islem, s).tamam).length;

// ─── Hesap satırının açıklaması ──────────────────────────────────────────────

/** e-Banka hareketinin hesabı, hareket penceresindeki gibi: "Garanti BBVA TL - 6866578" */
export const ebankaHareketHesabi = (s: { bankaAdi?: string | null; doviz?: string | null; hesapNo?: string | null }): string =>
  [[s.bankaAdi, s.doviz].filter(Boolean).join(" "), s.hesapNo].filter(Boolean).join(" - ");

/**
 * Fişin Hesap satırının açıklaması (docs/EBANKA_MUHASEBELESTIRME_YOL_HARITASI.md M20): e-Banka hesabının bankası ve numarası, yanında
 * Banka Hesap Kartı'nın adı ("Garanti BBVA TL - 6866578 · den"). Kart adı zaten içindeyse tekrar yazılmaz.
 */
export const ebankaHesapAciklamasi = (ebanka: string, kartHesapAdi?: string | null): string => {
  const kart = (kartHesapAdi || "").trim();
  const e = (ebanka || "").trim();
  if (!e) return kart;
  return kart && !e.toLocaleUpperCase("tr-TR").includes(kart.toLocaleUpperCase("tr-TR")) ? `${e} · ${kart}` : e;
};

// ─── e-Belge kaynak satırı ───────────────────────────────────────────────────

/** Fişin e-Belge kaynak listesindeki evrak türü: döviz 99, sarraf / perakende 0 (mutabakat M17 ile aynı) */
export const fisEvrakTuru = (fisTuru: TopluFis["fisTuru"]): number => (fisTuru === "doviz" ? 99 : 0);

export interface KaynakAday { evrakTuru: number; belgeId: number; belgeTuru: number; belgeNo: string; secilebilir: boolean }

/**
 * Kaynak listesinde fişin satırı. Sarraf satışı e-İrsaliye seçiliyse iki satır gelebilir (belgeTuru 1 fatura, 2 irsaliye):
 * önce gönderilebilir olan, sonra irsaliye olmayan seçilir.
 */
export function kaynakSatiriSec<T extends KaynakAday>(kayitlar: T[], fis: Pick<TopluFis, "fisTuru" | "fisId">): T | null {
  const evrak = fisEvrakTuru(fis.fisTuru);
  const eslesen = kayitlar.filter((k) => k.evrakTuru === evrak && k.belgeId === fis.fisId);
  if (!eslesen.length) return null;
  const puan = (k: T) => (k.secilebilir ? 2 : 0) + (k.belgeTuru !== 2 ? 1 : 0);
  return [...eslesen].sort((a, b) => puan(b) - puan(a))[0];
}

/** ICE bir seride numarayı sırayla kabul eder: gönderim küçük belge numarasından büyüğe (e-Belge Kaynak ile aynı) */
export const gonderimSirasi = <T extends { belgeNo: string }>(liste: T[]): T[] => [...liste].sort((a, b) => a.belgeNo.localeCompare(b.belgeNo));
