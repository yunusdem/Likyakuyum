import { CekmeliKaynak, getir, sayi, haricMi } from "../yardimci.js";
import type { FiyatGrubu, GrupKodu } from "../tipler.js";

/**
 * Zile Döviz & Altın — ziledoviz.com.tr (Konya). Fiyatlar piyasaekran.com.tr altyapısından gelir:
 * GET api.piyasaekran.com.tr/api/prices/dealer/5 → {groups:[{name, order, items:[{code, name, bid, ask, decimalPlaces, updatedAt}]}]}
 * "Ana Ekran" grubu diğer grupların özeti olduğu için alınmaz.
 */
interface ZileKalem {
  code: string;
  name: string;
  bid: number;
  ask: number;
  decimalPlaces?: number;
  updatedAt?: number;
}

const GRUP: Record<string, GrupKodu> = { Altın: "altin", Sarrafiye: "sarrafiye", Döviz: "doviz", Gümüş: "gumus" };

const ORTAK: Record<string, string> = {
  HAS_ALTIN: "HAS",
  GRAM_ALTIN: "GRAM",
  "22_AYAR": "AYAR22",
  "18_AYAR": "AYAR18",
  "14_AYAR": "AYAR14",
  "8_AYAR": "AYAR8",
  ONS_USD: "ONS",
  GUMUS_TL: "GUMUS_TL",
};

const ortakKod = (kod: string): string | undefined =>
  ORTAK[kod] ?? (/^(CEYREK|YARIM|TAM|ATA|GREMSE)_(YENI|ESKI)$/.test(kod) ? kod : /^[A-Z]{3}_[A-Z]{3}$/.test(kod) ? kod.replace("_", "") : undefined);

const saat = (ms?: number): string | null =>
  ms ? new Date(ms).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Istanbul" }) : null;

export class ZileKaynak extends CekmeliKaynak {
  readonly kod = "zile";
  readonly ad = "Zile Döviz";
  readonly site = "ziledoviz.com.tr";
  protected aralikMs = 2000;

  protected async cek(): Promise<FiyatGrubu[]> {
    const j = (await (
      await getir("https://api.piyasaekran.com.tr/api/prices/dealer/5", {
        headers: { Origin: "https://ziledoviz.com.tr", Referer: "https://ziledoviz.com.tr/", Accept: "application/json" },
      })
    ).json()) as { groups?: { name: string; order: number; items: ZileKalem[] }[] };

    return (j.groups ?? [])
      .filter((g) => g.name !== "Ana Ekran")
      .sort((a, b) => a.order - b.order)
      .map((g) => ({
        kod: GRUP[g.name] ?? "altin",
        baslik: g.name,
        tur: "alis-satis" as const,
        satirlar: g.items
          .filter((i) => !haricMi(i.code, i.name))
          .map((i) => {
            const ondalik = i.decimalPlaces ?? 2;
            const yuvarla = (n: number | null) => (n === null ? null : Number(n.toFixed(ondalik)));
            const ok = ortakKod(i.code);
            return {
              kod: i.code,
              ad: i.name,
              ...(ok ? { ortakKod: ok } : {}),
              alis: yuvarla(sayi(i.bid)),
              satis: yuvarla(sayi(i.ask)),
              ondalik,
              zaman: saat(i.updatedAt),
            };
          }),
      }));
  }
}
