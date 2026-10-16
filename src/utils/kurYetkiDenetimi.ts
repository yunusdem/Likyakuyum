import { GiseKuru, KullaniciYetkisi, kurDenetle } from "../../Backend/src/services/yetki/kullaniciYetkiKural";

/**
 * Fiş kaydından önce satır kurlarının kullanıcının kur yetkisine göre denetimi (docs/YETKI_VE_VEZNE_YOL_HARITASI.md §4.2):
 * yetki dışı kur kaydı durdurur (hata), gişe kurundan sapma uyarı/onay ister ("Sapma uyarısı verilmesin" işaretli
 * kullanıcıda uyarı yok). Sunucu da aynı kuralı denetler.
 */
export interface KurSatirDenetimi {
  etiket: string;
  gise: GiseKuru | null | undefined;
  kur: number;
}

export const kurlariDenetle = (y: KullaniciYetkisi, satirlar: KurSatirDenetimi[]): { hata: string | null; uyarilar: string[] } => {
  const uyarilar: string[] = [];
  for (const s of satirlar) {
    const d = kurDenetle(y, s.gise, s.kur, s.etiket);
    if (d.hata) return { hata: d.hata, uyarilar: [] };
    if (d.uyari) uyarilar.push(d.uyari);
  }
  return { hata: null, uyarilar };
};

/** Denetim + onay: kayıt sürebilirse true. Hata, verilen bildirim işleviyle gösterilir. */
export const kurOnayi = (y: KullaniciYetkisi, satirlar: KurSatirDenetimi[], hataGoster: (m: string) => void): boolean => {
  const { hata, uyarilar } = kurlariDenetle(y, satirlar);
  if (hata) {
    hataGoster(hata);
    return false;
  }
  if (!uyarilar.length) return true;
  return window.confirm(`${uyarilar.join("\n")}\n\nYine de kaydedilsin mi?`);
};
