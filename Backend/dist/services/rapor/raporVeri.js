import { KASA_SORGULARI } from "./veri/kasa.js";
import { VEZNE_SORGULARI } from "./veri/vezne.js";
import { CARI2_SORGULARI } from "./veri/cari.js";
import { FIS_SORGULARI } from "./veri/fis.js";
import { ANALIZ_SORGULARI } from "./veri/analiz.js";
import { MASAK_SORGULARI } from "./veri/masak.js";
import { YONETICI_SORGULARI } from "./veri/yonetici.js";
import { ETIKET_SORGULARI } from "./veri/etiket.js";
import { KARZAR_SORGULARI } from "./veri/karZarar.js";
import { CARI_SORGULARI } from "./veri/cariTemel.js";
import { VEZNE_TEMEL_SORGULARI } from "./veri/vezneTemel.js";
import { FIRMA_VARLIK_SORGULARI } from "./veri/firmaVarlik.js";
import { VERGI_KOMISYON_SORGULARI } from "./veri/vergiKomisyon.js";
/**
 * Rapor veri katmanı — yalnızca SELECT. Hiçbir tabloya yazılmaz, SP çağrılmaz.
 * Tablolar: TODVZ_CARI_KART, TODVZ_CARI_HAREKET(+_SATIRI), TODVZ_FIS(+_SATIRI), TODVZ_VEZNE, TODVZ_PARA,
 * TODVZ_KUR_TABLOSU / TODVZ_KUR. Kolon adları mevcut repository'lerden alındı (bkz. docs/raporlar.md Bölüm 2).
 */
export const RAPOR_SORGULARI = {
    // 2. dalga raporları alan dosyalarında (veri/*.ts) — docs/raporlar-faz2.md
    ...KASA_SORGULARI,
    ...VEZNE_SORGULARI,
    ...CARI2_SORGULARI,
    ...FIS_SORGULARI,
    ...ANALIZ_SORGULARI,
    ...MASAK_SORGULARI,
    ...YONETICI_SORGULARI,
    ...ETIKET_SORGULARI,
    ...KARZAR_SORGULARI,
    ...CARI_SORGULARI,
    ...VEZNE_TEMEL_SORGULARI,
    ...FIRMA_VARLIK_SORGULARI,
    ...VERGI_KOMISYON_SORGULARI,
};
