import { TabanKaynak, HamWsBaglanti, getir, sayi, haricMi } from "../yardimci.js";
import type { FiyatGrubu, GrupKodu } from "../tipler.js";

/**
 * Hakan Döviz — hakandoviz.com
 * Sembol/kategori listesi: POST cmsapi.hakandoviz.com/api/Category/GetListCategoryWithSymbolBySite
 *   → result[{categoryId, name, symbols[{sourceId, name, description, pricePrecision}]}]
 * Canlı fiyat: düz WebSocket wss://socket.hakandoviz.com, açılınca "GetAll" gönderilir;
 *   gelen mesaj [{i: sourceId, s: ad, b: alış, a: satış}] dizisi.
 * Merkez Bankası kurları (History/GetTcmbCurrenciesByDate) 01.10.2026'da sitenin kendi sunucusunda hata veriyordu — alınmadı.
 */
interface HakanSembol {
  sourceId: number;
  name: string;
  description?: string;
  pricePrecision?: number;
}

/** Kategori → grup. 9 numaralı kategori 1'in kopyası (farklı kaynak id'leri), alınmaz. */
const KATEGORI: Record<number, { kod: GrupKodu; baslik: string }> = {
  1: { kod: "doviz", baslik: "Döviz" },
  2: { kod: "altin", baslik: "Altın" },
  6: { kod: "sarrafiye", baslik: "Ziynet & Sarrafiye" },
  5: { kod: "parite", baslik: "Pariteler" },
};

const ORTAK: Record<string, string> = {
  "HAS/TRY": "HAS",
  ÇEYREK: "CEYREK_ESKI",
  "Y.ÇEYREK": "CEYREK_YENI",
  YARIM: "YARIM_ESKI",
  "Y.YARIM": "YARIM_YENI",
  TAM: "TAM_ESKI",
  "Y.TAM": "TAM_YENI",
  GREMSE: "GREMSE_ESKI",
  "Y.GREMSE": "GREMSE_YENI",
  ATA: "ATA_ESKI",
  "Y.ATA": "ATA_YENI",
  "ATA 5'Lİ": "ATA5_ESKI",
  "Y.ATA 5'Lİ": "ATA5_YENI",
};

const ortakKod = (ad: string, ilkOns: boolean): string | undefined => {
  if (ORTAK[ad]) return ORTAK[ad];
  if (ad === "XAU/USD") return ilkOns ? "ONS" : undefined;
  return /^[A-Z]{3}\/[A-Z]{3}$/.test(ad) && !ad.startsWith("ALT") ? ad.replace("/", "") : undefined;
};

export class HakanKaynak extends TabanKaynak {
  readonly kod = "hakan";
  readonly ad = "Hakan Döviz";
  readonly site = "hakandoviz.com";

  private semboller: { grup: { kod: GrupKodu; baslik: string }; sembol: HakanSembol; ortakKod?: string }[] = [];
  private fiyatlar = new Map<number, { b: number | null; a: number | null }>();
  private ws: HamWsBaglanti | null = null;
  private listeZamanlayici: NodeJS.Timeout | null = null;

  baslat(): void {
    if (this.calisiyor) return;
    this.calisiyor = true;
    void this.listeCek();
    this.listeZamanlayici = setInterval(() => void this.listeCek(), 30 * 60_000);
    this.ws = new HamWsBaglanti(
      "wss://socket.hakandoviz.com/",
      { Origin: "https://www.hakandoviz.com" },
      {
        acildi: (gonder) => setTimeout(() => gonder("GetAll"), 300),
        mesaj: (m) => this.mesaj(m),
        hata: (m) => this.hataOldu(m),
      },
    );
    this.ws.baslat();
  }

  durdur(): void {
    this.calisiyor = false;
    this.ws?.durdur();
    this.ws = null;
    if (this.listeZamanlayici) clearInterval(this.listeZamanlayici);
    this.listeZamanlayici = null;
  }

  private async listeCek(): Promise<void> {
    try {
      const j = (await (
        await getir("https://cmsapi.hakandoviz.com/api/Category/GetListCategoryWithSymbolBySite", {
          method: "POST",
          body: "{}",
          headers: { "Content-Type": "application/json", Origin: "https://www.hakandoviz.com", Referer: "https://www.hakandoviz.com/" },
        })
      ).json()) as { result?: { categoryId: number; symbols: HakanSembol[] }[] };

      const gorulen = new Set<number>();
      let onsVar = false;
      const liste: typeof this.semboller = [];
      // Grupların sırası KATEGORI'deki sıra
      for (const [id, grup] of Object.entries(KATEGORI)) {
        const kat = j.result?.find((k) => k.categoryId === Number(id));
        for (const s of kat?.symbols ?? []) {
          const ad = s.name.trim();
          if (gorulen.has(s.sourceId) || haricMi(ad)) continue;
          gorulen.add(s.sourceId);
          const ok = ortakKod(ad, !onsVar);
          if (ok === "ONS") onsVar = true;
          liste.push({ grup, sembol: { ...s, name: ad }, ...(ok ? { ortakKod: ok } : {}) });
        }
      }
      if (liste.length) this.semboller = liste;
      this.yenidenKur();
    } catch (e: any) {
      this.hataOldu(`Sembol listesi alınamadı: ${e?.message ?? e}`);
    }
  }

  private mesaj(m: string): void {
    let dizi: { i: number; b: unknown; a: unknown }[];
    try {
      dizi = JSON.parse(m);
    } catch {
      return;
    }
    if (!Array.isArray(dizi)) return;
    for (const x of dizi) this.fiyatlar.set(Number(x.i), { b: sayi(x.b), a: sayi(x.a) });
    this.yenidenKur();
  }

  private yenidenKur(): void {
    if (!this.semboller.length || !this.fiyatlar.size) return;
    const gruplar = new Map<string, FiyatGrubu>();
    for (const { grup, sembol, ortakKod: ok } of this.semboller) {
      const f = this.fiyatlar.get(sembol.sourceId);
      if (!f) continue;
      const g = gruplar.get(grup.kod) ?? { kod: grup.kod, baslik: grup.baslik, tur: "alis-satis" as const, satirlar: [] };
      const ondalik = sembol.pricePrecision ?? 4;
      const yuvarla = (n: number | null) => (n === null ? null : Number(n.toFixed(ondalik)));
      g.satirlar.push({
        kod: String(sembol.sourceId),
        ad: sembol.name,
        ...(sembol.description && sembol.description !== sembol.name ? { altAd: sembol.description } : {}),
        ...(ok ? { ortakKod: ok } : {}),
        alis: yuvarla(f.b),
        satis: yuvarla(f.a),
        ondalik,
      });
      gruplar.set(grup.kod, g);
    }
    this.veriGeldi([...gruplar.values()]);
  }
}
