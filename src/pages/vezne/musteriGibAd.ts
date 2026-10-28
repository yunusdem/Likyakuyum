import { noTuru } from "../../../Backend/src/utils/vknKontrol";
import type { VknSorguSonucu } from "../../services/gibService";

/**
 * Sarraf, Perakende ve Döviz fişinde TC / VKN'den müşteri adı: e-Belge'deki GİB sorgusunun aynısı (docs/GIB_VKN_SORGU_YOL_HARITASI.md).
 * Sorgu yalnız GİB düğmesiyle yapılır (docs/GIB_BUTON_IL_ILCE_YOL_HARITASI.md).
 * Sıra: yerel cari → kayıtsız müşteri → e-Fatura listesi (ICE) → GİB.
 * Ad yalnız boşken ("İsim beyan edilmemiştir") ya da önceki seçimden / sorgudan kalmışken yazılır;
 * kasiyerin elle yazdığı ada dokunulmaz.
 */

/**
 * Uzak sorguya (ICE / GİB) gidilir mi: kontrol hanesi tutmayan numara gönderilmez.
 * 10 hanede tutmuyorsa çoğunlukla TCKN yazılıyordur; 11111111111 gibi uydurma numaralar da sessizce atlanır.
 */
export const uzakSorguYapilir = (no: string): boolean => noTuru(String(no ?? "").replace(/\D/g, "")) !== null;

/** Ekrandaki ad GİB'den gelenle sormadan değiştirilebilir mi. */
export const adYazilabilir = (ekrandaki: string, sonOtomatikAd: string, anonimMi: (s: string) => boolean): boolean => {
  const ad = String(ekrandaki ?? "").trim();
  const oto = String(sonOtomatikAd ?? "").trim();
  return anonimMi(ad) || (oto !== "" && ad === oto);
};

/** GİB yanıtından tek "Adı" alanına yazılacak metin: şirkette unvan, şahısta ad + soyad. */
export const gibAdi = (s: Pick<VknSorguSonucu, "unvan" | "ad" | "soyad">): string =>
  String(s.unvan || [s.ad, s.soyad].filter(Boolean).join(" ")).replace(/\s+/g, " ").trim();
