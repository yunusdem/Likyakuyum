/**
 * Ticari hareketli ağırlıklı ortalama maliyet (docs/TICARI_ADISYON_YOL_HARITASI.md, TA15) — saf fonksiyon, ön yüz de kullanabilir.
 * Hareketler kart başına tarih + hareket sırasıyla işlenir:
 *   - Maliyetli giriş (stok giriş fişi, parçalama çıktısı): eldeki miktar > 0 ise ortalama = (miktar × ort + giriş × fiyat) ÷ (miktar + giriş);
 *     eldeki miktar ≤ 0 ise (eksi stok) ortalama giriş fiyatına sıfırlanır.
 *   - Tedarikçiye iade (maliyetli çıkış, karar T5 26.11.2026): iade fiyatıyla çıkar, kalan malın ortalaması yeniden hesaplanır (alışın tersi):
 *     ortalama = (miktar × ort − iade × fiyat) ÷ (miktar − iade); eldeki mal iadeyle biterse / eksiye düşerse ortalama değişmez; eksi çıkmaz.
 *   - Öteki girişler (satış iadesi, sayım fazlası) ve öteki çıkışlar (satış, fire, sayım eksiği, parçalama girdisi) o anki
 *     ortalamayla işlenir; ortalama değişmez.
 *   - Hiç maliyetli giriş yokken başlangıç ortalaması kartın alış fiyatıdır (yoksa 0: "maliyeti bilinmiyor").
 *   - Maliyeti bilinmezken eldeki miktar (açılış / sayım fazlası, alış fiyatı da yok) ilk maliyetli girişin fiyatını alır; sıfır maliyetle
 *     ortalamaya katılıp onu sulandırmaz (T4, 26.11.2026 denetimi: 100 adet maliyetsiz + 10 adet 50 TL → eskiden 4,55, şimdi 50).
 *     Bedelsiz (0 TL) giriş "bilinen" sıfırdır ve ortalamaya katılır.
 * Raporlar maliyeti her seferinde bu geçmişten hesaplar: geriye tarihli bir düzeltmede satış anındaki maliyet kendiliğinden doğru kalır.
 */
export interface MaliyetHareketi {
  id: number;
  /** Sıralama için (ISO ya da ms) */
  tarih: string | number;
  giris: number;
  cikis: number;
  /** Maliyetli girişse birim maliyet (KDV hariç); değilse null */
  maliyetliFiyat: number | null;
  /** Maliyetli çıkışsa (tedarikçiye iade) birim fiyat (KDV hariç); değilse null / yok */
  cikisFiyati?: number | null;
}

export interface MaliyetSonucu {
  id: number;
  /** Bu hareketin birim maliyeti (giriş fiyatı ya da o anki ortalama) */
  birimMaliyet: number;
  /** Hareket sonrası ortalama ve miktar */
  ortSonra: number;
  miktarSonra: number;
  /** Ortalama henüz bilinmiyordu (0) */
  bilinmiyor: boolean;
}

const y6 = (n: number) => Math.round(n * 1_000_000) / 1_000_000;
const y4 = (n: number) => Math.round(n * 10000) / 10000;

export function ortalamaMaliyet(hareketler: MaliyetHareketi[], baslangicOrtalama = 0): MaliyetSonucu[] {
  const sirali = [...hareketler].sort((a, b) => {
    const ta = typeof a.tarih === "number" ? a.tarih : Date.parse(a.tarih), tb = typeof b.tarih === "number" ? b.tarih : Date.parse(b.tarih);
    return ta - tb || a.id - b.id;
  });
  let ort = Math.max(0, Number(baslangicOrtalama) || 0), miktar = 0;
  let bilinen = ort > 0;
  return sirali.map((h) => {
    const g = Number(h.giris) || 0, c = Number(h.cikis) || 0;
    let birim: number;
    if (g > 0 && h.maliyetliFiyat !== null && h.maliyetliFiyat !== undefined && Number.isFinite(Number(h.maliyetliFiyat))) {
      const f = Math.max(0, Number(h.maliyetliFiyat));
      ort = miktar > 0 && bilinen ? y6((miktar * ort + g * f) / (miktar + g)) : y6(f);
      bilinen = true;
      birim = f;
    } else if (c > 0 && h.cikisFiyati !== null && h.cikisFiyati !== undefined && Number.isFinite(Number(h.cikisFiyati))) {
      const f = Math.max(0, Number(h.cikisFiyati));
      const kalan = miktar - c;
      if (miktar > 0 && kalan > 0.00005 && bilinen) ort = y6(Math.max(0, (miktar * ort - c * f) / kalan));
      birim = f;
    } else birim = ort;
    miktar = y4(miktar + g - c);
    return { id: h.id, birimMaliyet: y6(birim), ortSonra: ort, miktarSonra: miktar, bilinmiyor: !(birim > 0) && !(g > 0 && h.maliyetliFiyat !== null) };
  });
}

/** Son ortalama (hareket yoksa başlangıç) */
export const sonOrtalama = (sonuclar: MaliyetSonucu[], baslangicOrtalama = 0): number => (sonuclar.length ? sonuclar[sonuclar.length - 1].ortSonra : Math.max(0, Number(baslangicOrtalama) || 0));
