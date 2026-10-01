import { CekmeliKaynak, getir, sayi, ondalikSay, haricMi } from "../yardimci.js";
import { gruplariKur, DOVIZ_ADLARI, type GrupTanimi } from "./ortak.js";
import type { FiyatGrubu } from "../tipler.js";

/**
 * Ahlatcı Döviz — ahlatcidoviz.com.tr
 * Ana sayfadaki kur tablosu kr.aspx'ten gelir (ASP.NET UpdatePanel); sayfa HTML'inde düz tablo:
 *   <th scope ="row"> USD</th><td> 48.9750</td><td> 49.0350</td>
 * static/currencies.json eski tarihli sabit dosya — kullanılmaz. XPT/XPD (platin/paladyum) atılır.
 */
const DOVIZLER = ["USD", "EUR", "GBP", "CHF", "AUD", "CAD", "SAR", "JPY", "AED", "DKK", "SEK", "NOK", "RUB", "SEPET"];

const TANIMLAR: GrupTanimi[] = [
  {
    kod: "doviz",
    baslik: "Döviz",
    satirlar: DOVIZLER.map((k) => [k, k, k === "SEPET" ? undefined : `${k}TRY`, DOVIZ_ADLARI[k]]),
  },
  { kod: "parite", baslik: "Parite", satirlar: [["EURUSD", "EURUSD", "EURUSD", "Euro / Dolar"]] },
  {
    kod: "altin",
    baslik: "Altın",
    satirlar: [
      ["XAU", "XAU", "HAS", "Has Altın (TL/gr)"],
      ["XAUUSD", "XAUUSD", "ONS", "Ons Altın ($)"],
    ],
  },
  { kod: "gumus", baslik: "Gümüş", satirlar: [["XAG", "XAG", "GUMUS_TL", "Gümüş (TL/gr)"]] },
];

const SATIR = /<th[^>]*scope\s*=\s*"row"[^>]*>\s*([A-Z]+)\s*<\/th>\s*<td>\s*([\d.,]+)\s*<\/td>\s*<td>\s*([\d.,]+)\s*<\/td>/g;

export class AhlatciKaynak extends CekmeliKaynak {
  readonly kod = "ahlatci";
  readonly ad = "Ahlatcı Döviz";
  readonly site = "ahlatcidoviz.com.tr";
  protected aralikMs = 2500;

  protected async cek(): Promise<FiyatGrubu[]> {
    const html = await (
      await getir("https://www.ahlatcidoviz.com.tr/kr.aspx", { headers: { Referer: "https://www.ahlatcidoviz.com.tr/" } })
    ).text();

    const ham = new Map<string, [string, string]>();
    for (const m of html.matchAll(SATIR)) if (!haricMi(m[1])) ham.set(m[1], [m[2], m[3]]);
    if (!ham.size) throw new Error("Kur tablosu bulunamadı (sayfa yapısı değişmiş olabilir)");

    const zaman = html.match(/Son Güncelleme Zamanı\s*:\s*[\d.]+\s+(\d{2}:\d{2})/)?.[1] ?? null;
    return gruplariKur(TANIMLAR, (kod) => {
      const h = ham.get(kod);
      if (!h) return null;
      // Site altın/gümüşü de 4 hane yazıyor; gram fiyatında 2 hane yeterli
      const ondalik = kod.startsWith("XA") ? 2 : Math.max(ondalikSay(h[0]), ondalikSay(h[1]));
      return { alis: sayi(h[0]), satis: sayi(h[1]), ondalik, zaman };
    });
  }
}
