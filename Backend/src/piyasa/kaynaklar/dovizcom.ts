import { CekmeliKaynak, getir, sayiTR, haricMi } from "../yardimci.js";
import { gruplariKur, type GrupTanimi } from "./ortak.js";
import type { FiyatGrubu } from "../tipler.js";

/**
 * doviz.com — altin.doviz.com (Serbest Piyasa)
 * Sitenin API'si (api.doviz.com) sayfada şifreli üretilen bir anahtar istiyor; bunun yerine sunucunun ürettiği
 * HTML okunur. Her fiyat hücresi şu biçimde: data-socket-key="ceyrek-altin" data-socket-attr="bid|ask|c|ts|s">10.524,73<
 * Sarrafiye satırları sitenin kendisinde de birkaç dakikada bir güncelleniyor.
 */
const TANIMLAR: GrupTanimi[] = [
  {
    kod: "altin",
    baslik: "Altın",
    satirlar: [
      ["ons", "Ons Altın", "ONS"],
      ["gram-altin", "Gram Altın", "GRAM"],
      ["gram-has-altin", "Gram Has Altın", "HAS"],
      ["22-ayar-bilezik", "22 Ayar Bilezik", "AYAR22"],
      ["18-ayar-altin", "18 Ayar Bilezik", "AYAR18"],
      ["14-ayar-altin", "14 Ayar Bilezik", "AYAR14"],
    ],
  },
  {
    kod: "sarrafiye",
    baslik: "Sarrafiye",
    satirlar: [
      ["ceyrek-altin", "Çeyrek Altın", "CEYREK_YENI"],
      ["yarim-altin", "Yarım Altın", "YARIM_YENI"],
      ["tam-altin", "Tam Altın", "TAM_YENI"],
      ["cumhuriyet-altini", "Cumhuriyet Altını"],
      ["ata-altin", "Ata Altın", "ATA_YENI"],
      ["ikibucuk-altin", "İkibuçuk Altın"],
      ["besli-altin", "Beşli Altın"],
      ["gremse-altin", "Gremse Altın", "GREMSE_YENI"],
      ["resat-altin", "Reşat Altın"],
      ["hamit-altin", "Hamit Altın"],
    ],
  },
  { kod: "gumus", baslik: "Gümüş", satirlar: [["gumus", "Gram Gümüş", "GUMUS_TL"]] },
  {
    kod: "doviz",
    baslik: "Döviz",
    satirlar: [
      ["USD", "Dolar", "USDTRY", "USD/TRY"],
      ["EUR", "Euro", "EURTRY", "EUR/TRY"],
      ["GBP", "Sterlin", "GBPTRY", "GBP/TRY"],
    ],
  },
];

const HUCRE = /data-socket-key="([^"]+)"[^>]*?data-socket-attr="([^"]+)"[^>]*>([^<]*)</g;

export class DovizcomKaynak extends CekmeliKaynak {
  readonly kod = "dovizcom";
  readonly ad = "doviz.com";
  readonly site = "altin.doviz.com";
  /** Sayfa ~380 KB; daha sık çekmek siteye yük olur, veri de daha sık değişmiyor */
  protected aralikMs = 5000;

  protected async cek(): Promise<FiyatGrubu[]> {
    const html = await (await getir("https://altin.doviz.com/", { zamanAsimiMs: 10000 })).text();
    const ham = new Map<string, Record<string, string>>();
    for (const [, anahtar, alan, deger] of html.matchAll(HUCRE)) {
      if (haricMi(anahtar)) continue;
      const kayit = ham.get(anahtar) ?? {};
      // Aynı anahtar üst şeritte ("s") ve tabloda ("bid/ask") geçebilir; ilk değer korunur
      if (!(alan in kayit)) kayit[alan] = deger.trim();
      ham.set(anahtar, kayit);
    }
    if (!ham.size) throw new Error("Fiyat hücreleri bulunamadı (sayfa yapısı değişmiş olabilir)");

    return gruplariKur(TANIMLAR, (kod) => {
      const h = ham.get(kod);
      if (!h) return null;
      const alis = sayiTR(h.bid);
      const satis = sayiTR(h.ask ?? h.s);
      if (alis === null && satis === null) return null;
      const ornek = h.ask ?? h.s ?? "";
      const virgul = ornek.lastIndexOf(",");
      return {
        alis,
        satis,
        degisim: sayiTR(h.c),
        ondalik: virgul < 0 ? 0 : ornek.length - virgul - 1,
        zaman: h.ts ?? null,
      };
    });
  }
}
