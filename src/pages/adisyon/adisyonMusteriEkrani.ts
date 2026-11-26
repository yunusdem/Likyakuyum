import { KasaSatiri, MusteriEkraniDurumu, musteriEkraniDurumu } from "../../services/musteriEkrani";
import { ticariFisHesapla } from "../../../Backend/src/services/ticari/ticariHesap";

/**
 * Adisyon tahsilatında müşteri ekranı (TA9, D7) — saf model: ödenmemiş kalemler (ikram "İkram" notuyla 0 TL), servis satırı,
 * ödenecek tutar (fiş tutarı), alınmış ara ödemeler + pencerede girilen kart / havale / cari ve alınan nakit; para üstü.
 * Pencerede varsayılan nakit satırı (henüz alınmamış) ödenen sayılmaz: müşteri "Kalan"ı görür, nakit verince para üstünü.
 */
export interface AdisyonEkranKalemi { kalemId: number; ad: string; porsiyonAd: string | null; miktar: number; birim: string; birimFiyat: number; kdvOrani: number; ikram: boolean; iptal: boolean; faturaId: number | null }
export interface AdisyonEkranHesabi { ara: number; servis: number; servisKdv: number; toplam: number; odenen: number; /** Adisyon indirimi (K1), nominal */ indirim?: number }

const y2 = (n: number) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

export function adisyonMusteriDurumu(g: {
  kalemler: AdisyonEkranKalemi[];
  servisOrani: number | null;
  hesap: AdisyonEkranHesabi | null;
  /** Pencerede girilen ödeme satırları ve alınan nakit (para üstü için) */
  pencere?: { satirlar: { arac: number; tutar: number }[]; alinanNakit: number | null } | null;
  /** Adisyon kapandı: teşekkür ekranı */
  sonFis?: { toplam: number; paraUstu: number } | null;
  oncekiSepet?: KasaSatiri[] | null;
  zaman?: number;
  /**
   * "Ürün seç" kipi (P15, 26.11.2026 denetimi): müşteri yalnız seçilen kalemleri öder — ekranda seçilenler (seçilen miktarla), onların
   * servisi ve fiş tutarı görünür; adisyonun bekleyen ara ödemeleri bu fişe sayılmaz. Boşsa bütün hesap.
   */
  secim?: { kalemler: { kalemId: number; miktar: number }[]; servis: number; toplam: number; indirim?: number } | null;
}): MusteriEkraniDurumu {
  const secimVar = !!g.secim && g.secim.kalemler.length > 0;
  const tumOdenmemis = g.kalemler.filter((k) => !k.iptal && !k.faturaId);
  const odenmemis = secimVar
    ? tumOdenmemis.filter((k) => g.secim!.kalemler.some((x) => x.kalemId === k.kalemId)).map((k) => ({ ...k, miktar: g.secim!.kalemler.find((x) => x.kalemId === k.kalemId)!.miktar }))
    : tumOdenmemis;
  if (g.sonFis || !g.hesap) {
    return musteriEkraniDurumu({ sepet: [], satirTutarlari: [], toplam: { araToplam: 0, indirim: 0, kdv: 0, genelToplam: 0 }, odeme: { odenen: 0, kalan: 0, paraUstu: 0 }, sonFis: g.sonFis ?? null, zaman: g.zaman });
  }
  const h = secimVar ? { ...g.hesap, servis: g.secim!.servis, toplam: g.secim!.toplam, odenen: 0, indirim: g.secim!.indirim || 0 } : g.hesap;
  const sepet: KasaSatiri[] = odenmemis.map((k) => ({ anahtar: String(k.kalemId), ad: `${k.ad}${k.porsiyonAd ? ` (${k.porsiyonAd})` : ""}`, miktar: k.miktar, birim: k.birim || "Adet", birimFiyat: k.birimFiyat }));
  const tutarlar = odenmemis.map((k) => (k.ikram ? 0 : y2(k.miktar * k.birimFiyat)));
  if (h.servis > 0) {
    sepet.push({ anahtar: "servis", ad: `Servis ücreti (%${String(g.servisOrani ?? "").replace(".", ",")})`, miktar: 1, birim: "Adet", birimFiyat: h.servis });
    tutarlar.push(h.servis);
  }
  const brut = y2(odenmemis.reduce((t, k) => t + y2(k.miktar * k.birimFiyat), 0) + h.servis);
  const ikram = y2(odenmemis.filter((k) => k.ikram).reduce((t, k) => t + y2(k.miktar * k.birimFiyat), 0));
  const fis = sepet.length
    ? ticariFisHesapla([
      ...odenmemis.map((k) => ({ miktar: k.miktar, kdvDahilFiyat: k.birimFiyat, kdvOrani: k.kdvOrani, iskontoTuru: (k.ikram ? 1 : 0) as any, iskontoDegeri: k.ikram ? 100 : 0 })),
      ...(h.servis > 0 ? [{ miktar: 1, kdvDahilFiyat: h.servis, kdvOrani: h.servisKdv, iskontoTuru: 0 as any, iskontoDegeri: 0 }] : []),
    ])
    : null;
  // Ödenen: alınmış ara ödemeler + pencerede girilen nakit dışı ödemeler + elden alınan nakit (varsayılan nakit satırı sayılmaz)
  const satirlar = g.pencere?.satirlar ?? [];
  const nakitDisi = y2(satirlar.filter((s) => s.arac !== 0).reduce((t, s) => t + (Number(s.tutar) || 0), 0));
  const nakitSatir = y2(satirlar.filter((s) => s.arac === 0).reduce((t, s) => t + (Number(s.tutar) || 0), 0));
  const alinan = Number(g.pencere?.alinanNakit) > 0 ? y2(Number(g.pencere!.alinanNakit)) : 0;
  const odenen = y2(h.odenen + nakitDisi + alinan);
  const paraUstu = alinan > 0 ? Math.max(0, y2(alinan - nakitSatir)) : 0;
  const d = musteriEkraniDurumu({
    sepet, satirTutarlari: tutarlar,
    // P15: indirim satırı ikram + adisyon indirimi (eskiden yalnız ikram: indirimli adisyonda ara toplam − indirim, toplamdan indirim
    // kadar büyüktü). e-Belge KDV yuvarlaması (1-2 kuruş) toplamda kalır.
    toplam: { araToplam: brut, indirim: y2(ikram + (Number(h.indirim) || 0)), kdv: fis ? fis.toplamKdv : 0, genelToplam: h.toplam },
    odeme: { odenen, kalan: Math.max(0, y2(h.toplam - odenen)), paraUstu },
    oncekiSepet: g.oncekiSepet ?? null, zaman: g.zaman,
  });
  // İkram satırı: kampanya notu yerine "İkram"
  odenmemis.forEach((k, i) => { if (k.ikram && d.satirlar[i]) d.satirlar[i].not = "İkram"; });
  return d;
}
