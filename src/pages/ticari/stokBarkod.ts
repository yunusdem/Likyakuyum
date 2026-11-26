import { StokKart, TicariService, miktarYaz } from "../../services/ticariService";
import { teraziMiktari } from "../../../Backend/src/services/ticari/ticariHesap";

/**
 * Stok fişlerinde (sayım, fire, tedarikçiye iade, parçalama) okutulan değeri karta ve ana birim miktarına çevirir:
 *   "3*barkod" → 3; terazi etiketi (ağırlık gömülü) → etiketteki ağırlık; koli / ek birim barkodu → adet × çarpan; değilse 1.
 * Kart bulunamazsa null; okunamayan etikette { hata }.
 */
export type BarkodSonucu = { kart: StokKart; miktar: number; bilgi: string | null } | { hata: string } | null;

const sayi = (s: string) => Number(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s);

export async function stokBarkodCoz(metin: string): Promise<BarkodSonucu> {
  const d = metin.trim();
  if (!d) return null;
  const m = d.match(/^(\d+(?:[.,]\d+)?)\s*\*\s*(.+)$/);
  const adet = m ? sayi(m[1]) : 1;
  const deger = m ? m[2].trim() : d;
  if (!(adet > 0)) return { hata: "Çarpan sıfırdan büyük olmalı." };
  let k: StokKart | null;
  try {
    k = await TicariService.kartBul(deger);
  } catch (e: any) {
    return { hata: e?.message || "Ürün aranamadı." };
  }
  if (!k) return null;
  if (k.terazi && k.terazi.agirlikKg !== null && !m) {
    const tm = teraziMiktari(k.terazi, k.birim, 0);
    if (typeof tm === "string") return { hata: `"${k.ad}": ${tm}` };
    return { kart: k, miktar: tm, bilgi: `Terazi etiketi: ${miktarYaz(tm)} ${k.birim}` };
  }
  // Tutar gömülü terazi etiketi (ağırlık yok): miktar kartın satış fiyatından hesaplanır; fiyat yoksa elle yazdırılır.
  // (Eskiden sessizce 1 sayılıyordu: sayımda her paket 1 kg olarak giriyordu — 26.11.2026 denetimi)
  if (k.terazi && k.terazi.agirlikKg === null && !m) {
    const kart: any = k;
    const taban = Number(kart.satisFiyati) || 0;
    const fiyat = taban > 0 ? (kart.fiyatKdvDahil === false ? taban * (1 + (Number(kart.kdvOrani) || 0) / 100) : taban) : 0;
    const tm = fiyat > 0 ? teraziMiktari(k.terazi, k.birim, fiyat) : "etikette tutar yazılı ama kartın satış fiyatı yok";
    if (typeof tm === "string") return { hata: `"${k.ad}": ${tm}; miktarı elle yazın (ör. 0,750*${deger}).` };
    return { kart: k, miktar: tm, bilgi: `Tutar etiketi: kart fiyatından ${miktarYaz(tm)} ${k.birim} hesaplandı (terazideki fiyat farklıysa miktarı düzeltin)` };
  }
  if (k.okunanBirim) {
    const mk = Math.round(adet * k.okunanBirim.carpan * 10000) / 10000;
    return { kart: k, miktar: mk, bilgi: `${adet} ${k.okunanBirim.birim} = ${miktarYaz(mk)} ${k.birim}` };
  }
  return { kart: k, miktar: adet, bilgi: null };
}
