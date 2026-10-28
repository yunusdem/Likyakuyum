import { Request, Response, NextFunction } from "express";
import { ApiError } from "../../utils/ApiError.js";
import { kullaniciYetkisi } from "./kullaniciYetkisi.js";
import { KullaniciYetkisi, RAPOR_YETKI_KUTULARI, YETKI_KUTUSU_ADI, menuMaddesiAcik } from "./kullaniciYetkiKural.js";

/**
 * Sunucuda menü yetkisi (docs/YETKI_VE_VEZNE_YOL_HARITASI.md §4.1). Sunucu ön yüzün menü tanımını (DashboardRoute)
 * okuyamadığı için maddeler burada [ana menü, özgün harf] olarak yazılıdır; harf null = yalnız ana menü harfi.
 * DashboardRoute'ta madde eklenip harfler kayarsa burası da güncellenmeli — tmp/yetki-test/menu_katalog_test.mts denetler.
 */
export type Madde = [anaKey: string, harf: string | null];

/** Rapor kodu → raporun menüdeki maddeleri (menüde olmayan kod kısıtlanmaz) */
export const RAPOR_MADDELERI: Record<string, Madde[]> = {
  VEZHAR1: [["vezne", "I"]],
  VEZHAS1: [["vezne", "J"]],
  VEZALT1: [["vezne", "K"]],
  VEZANL1: [["vezne", "M"]],
  VEZBAK1: [["vezne", "N"]],
  KURKON2: [["vezne", "Q"]],
  KURKON1: [["vezne", "R"]],
  KASDEF1: [["kasa", "E"]],
  KASHAR1: [["kasa", "F"]],
  HESEKS1: [["kasa", "G"]],
  HESBAK1: [["kasa", "H"]],
  CAREKS1: [["cari", "J"]],
  CARBAK1: [["cari", "K"]],
  POSEKS1: [["cari", "L"]],
  VADISL1: [["cari", "N"]],
  CARHAR1: [["cari", "G"]],
  CARKRT1: [["cari", "H"]],
  FIRSON1: [["yonetici", "J"]],
  FIRVAR1: [["yonetici", "K"]],
  KARZAR1: [["yonetici", "L"]],
  LONSHO1: [["yonetici", "M"]],
  ALTISC1: [["raporlar", "A"]],
  FISLIS1: [["raporlar", "B"]],
  GUNFIS1: [["raporlar", "C"]],
  ISTKMV1: [["raporlar", "D"]],
  ISTRAP1: [["raporlar", "E"]],
  KARLIL1: [["raporlar", "F"]],
  PERDEG1: [["raporlar", "G"]],
  VERNUM1: [["raporlar", "H"]],
  VERKOM1: [["raporlar", "I"]],
  KNSKLOG1: [["raporlar", "J"]],
  MSKMES1: [["raporlar", "J"]],
  MSKSEK1: [["raporlar", "J"]],
  MSKSUP1: [["raporlar", "J"]],
  MSKKON1: [["raporlar", "J"]],
  MSKYAS1: [["raporlar", "J"]],
  MSKYUK1: [["raporlar", "J"]],
  BALURE1: [["etiket", null]],
  BALSAT1: [["etiket", null]],
  BALSTK1: [["etiket", null]],
};

/** Fiş türü → yeni kaydı açan maddeler ve düzeltme/silme maddeleri */
export const KAYIT_MADDELERI: Record<string, { kayit: Madde[]; duzeltme: Madde[] }> = {
  sarraf: { kayit: [["vezne", "A"], ["yonetici", "D"]], duzeltme: [["vezne", "B"]] },
  doviz: { kayit: [["vezne", "E"], ["yonetici", "E"]], duzeltme: [["vezne", "F"]] },
  perakende: { kayit: [["vezne", "C"], ["perakende", null], ["yonetici", "F"]], duzeltme: [["vezne", "D"], ["perakende", null]] },
  ticari: { kayit: [["ticari", null]], duzeltme: [["ticari", null]] },
  vezneTransferi: { kayit: [["vezne", "G"]], duzeltme: [["vezne", "H"]] },
  kasaHareket: { kayit: [["kasa", "C"]], duzeltme: [["kasa", "D"]] },
  kasaHesap: { kayit: [["kasa", "A"]], duzeltme: [["kasa", "B"]] },
  cariHareket: { kayit: [["cari", "C"], ["yonetici", "H"]], duzeltme: [["cari", "D"]] },
  cariDekont: { kayit: [["cari", "E"]], duzeltme: [["cari", "F"]] },
  cariKart: { kayit: [["cari", "A"]], duzeltme: [["cari", "B"]] },
  bankaHareket: { kayit: [["banka", null], ["yonetici", "G"]], duzeltme: [["banka", null], ["yonetici", "G"]] },
};

const birAcik = (y: KullaniciYetkisi, maddeler: Madde[]) => maddeler.some(([a, h]) => menuMaddesiAcik(y, a, h));

/** Rapor kodu kullanıcıya açık mı (menü harfi + yetki kutusu) */
export const raporAcik = (y: KullaniciYetkisi, kod: string): { acik: boolean; mesaj?: string } => {
  if (y.yonetici) return { acik: true };
  const k = String(kod || "").toUpperCase();
  const maddeler = RAPOR_MADDELERI[k];
  if (maddeler && !birAcik(y, maddeler)) return { acik: false, mesaj: "Bu rapora menü yetkiniz yok." };
  const kutu = RAPOR_YETKI_KUTULARI[k];
  if (kutu && !y[kutu]) return { acik: false, mesaj: `Bu rapor için "${YETKI_KUTUSU_ADI[kutu]}" yetkisi gerekir.` };
  return { acik: true };
};

/** /rapor/:kod uçları için kapı */
export const raporYetkisi = (req: Request, _res: Response, next: NextFunction) => {
  kullaniciYetkisi(req)
    .then((y) => {
      const s = raporAcik(y, String(req.params.kod || ""));
      next(s.acik ? undefined : ApiError.forbidden(s.mesaj || "Bu rapora yetkiniz yok."));
    })
    .catch(next);
};

/**
 * Fiş kayıt / silme kapısı: yeni kayıtta kayıt maddelerinden, düzeltme ve silmede düzeltme maddelerinden biri
 * kullanıcının menü yetkisinde açık olmalı. duzeltmeMi: isteğin mevcut kaydı değiştirdiğini söyler.
 */
export const kayitYetkisi = (tur: keyof typeof KAYIT_MADDELERI, duzeltmeMi: (req: Request) => boolean) =>
  (req: Request, _res: Response, next: NextFunction) => {
    kullaniciYetkisi(req)
      .then((y) => {
        const m = KAYIT_MADDELERI[tur];
        const duzeltme = req.method === "DELETE" || duzeltmeMi(req);
        const ok = y.yonetici || birAcik(y, duzeltme ? m.duzeltme : m.kayit);
        next(ok ? undefined : ApiError.forbidden(duzeltme ? "Bu fişi düzeltme / silme yetkiniz yok." : "Bu fişi kaydetme yetkiniz yok."));
      })
      .catch(next);
  };

/** `kayitYetkisi` ara katmanının işlev hâli: fiş türü istek işlenirken belli olan uç noktalar için (e-Belge › Kaynak'tan silme) */
export async function kayitDuzeltmeYetkisi(req: Request, tur: keyof typeof KAYIT_MADDELERI): Promise<void> {
  const y = await kullaniciYetkisi(req);
  if (!(y.yonetici || birAcik(y, KAYIT_MADDELERI[tur].duzeltme))) throw ApiError.forbidden("Bu fişi düzeltme / silme yetkiniz yok.");
}

/** İstekte pozitif bir kimlik var mı (gövde alanı ya da :id) */
export const kimlikVar = (...alanlar: string[]) => (req: Request): boolean =>
  Number(req.params?.id) > 0 || alanlar.some((a) => Number((req.body || {})[a]) > 0);
