import type { SepetSatiri } from "../../../Backend/src/services/hizliSatis/hizliSatisHesap";

/**
 * Tezgah → masa (docs/TICARI_ADISYON_YOL_HARITASI.md, TA33, D9): Hızlı Satış (Ticari) sepeti masaya sipariş olur. Saf: test edilir.
 * Yalnız stok kartlı satırlar gider (serbest ürünün kartı yok); miktar ana birimde (koli → adet, tartılı → kg) aynen gider.
 * Masada fiyatı ve KDV'yi adisyon belirler (bölge fiyat listesi, Adisyon KDV oranı — TA31 / TA32): elle fiyat, kampanya ve indirim
 * masaya taşınmaz; kullanıcı uyarılır. Ödeme girilmiş sepet gönderilmez (tahsilat masada).
 */
export interface MasaKalemi { stokKartId: number; miktar: number; notu: string | null }

export function masayaGonderilecekler(sepet: SepetSatiri[], g: { odemeVar?: boolean; indirimVar?: boolean } = {}): { kalemler: MasaKalemi[]; uyari: string | null } | { hata: string } {
  if (!sepet.length) return { hata: "Sepet boş." };
  if (g.odemeVar) return { hata: "Ödeme girilmiş sepet masaya gönderilmez; önce ödemeleri kaldırın (tahsilat masada yapılır)." };
  const kartsiz = sepet.filter((s) => s.tur !== "stok" || !(Number(s.urunId) > 0));
  if (kartsiz.length) return { hata: `Yalnız stok kartlı ürünler masaya gönderilir: ${kartsiz.map((s) => s.ad).join(", ")}.` };
  const sifir = sepet.find((s) => !(Number(s.miktar) > 0));
  if (sifir) return { hata: `${sifir.ad}: miktar sıfır.` };
  if (sepet.length > 100) return { hata: "Bir seferde en çok 100 kalem masaya gönderilir." };
  const farkli = sepet.filter((s) => s.fiyatElle || s.ek?.kampanya).map((s) => s.ad);
  const uyarilar: string[] = [];
  if (farkli.length) uyarilar.push(`Masada masa fiyatı geçer; elle fiyat / kampanya uygulanmaz: ${farkli.join(", ")}.`);
  if (g.indirimVar) uyarilar.push("Sepet indirimi masaya taşınmaz.");
  return {
    kalemler: sepet.map((s) => ({ stokKartId: Number(s.urunId), miktar: Math.round(Number(s.miktar) * 10000) / 10000, notu: null })),
    uyari: uyarilar.length ? uyarilar.join(" ") : null,
  };
}
