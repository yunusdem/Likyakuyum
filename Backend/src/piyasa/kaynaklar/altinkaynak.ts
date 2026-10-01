import { CekmeliKaynak, getir, sayiTR, ondalikSay, haricMi } from "../yardimci.js";
import type { FiyatGrubu, FiyatSatiri, GrupKodu } from "../tipler.js";

/**
 * Altınkaynak — altinkaynak.com/canli-kurlar/altin
 * static.altinkaynak.com/Gold ve /Currency: [{Kod, Alis "6.570,51", Satis, MobilAciklama, Aciklama, DataGroup, Change, GuncellenmeZamani}]
 * Sayılar Türkçe biçimde. DataGroup sitedeki tabloları belirler; fiyatı 0 olan grup (işçilik, 5) atılır.
 */
interface AkKalem {
  Kod: string;
  Alis: string;
  Satis: string;
  Aciklama?: string;
  MobilAciklama?: string;
  DataGroup: number;
  Change?: number;
  GuncellenmeZamani?: string;
}

/** [kaynak, DataGroup] → grup. Sıra sitedeki sırayla aynı. */
const GRUPLAR: { kaynak: "Gold" | "Currency"; dataGroup: number; kod: GrupKodu; baslik: string }[] = [
  { kaynak: "Currency", dataGroup: 1, kod: "doviz", baslik: "Döviz" },
  { kaynak: "Gold", dataGroup: 2, kod: "altin", baslik: "Altın" },
  { kaynak: "Gold", dataGroup: 8, kod: "sarrafiye", baslik: "Yeni Sarrafiye" },
  { kaynak: "Gold", dataGroup: 9, kod: "sarrafiye", baslik: "Eski Sarrafiye" },
  { kaynak: "Gold", dataGroup: 10, kod: "kulce", baslik: "Gram Altın (24 Ayar)" },
  { kaynak: "Currency", dataGroup: 3, kod: "kulce", baslik: "KG" },
  { kaynak: "Gold", dataGroup: 7, kod: "gumus", baslik: "Gümüş" },
  { kaynak: "Gold", dataGroup: 6, kod: "iscilik", baslik: "Külçe Milyem (995)" },
  { kaynak: "Currency", dataGroup: 4, kod: "parite", baslik: "Pariteler" },
];

const ORTAK: Record<string, string> = {
  HH: "HAS",
  GA: "GRAM",
  B: "AYAR22",
  "18": "AYAR18",
  "14": "AYAR14",
  "8": "AYAR8",
  XAUUSD: "ONS",
  C: "CEYREK_YENI",
  Y: "YARIM_YENI",
  T: "TAM_YENI",
  G: "GREMSE_YENI",
  A_T: "ATA_YENI",
  A5: "ATA5_YENI",
  EC: "CEYREK_ESKI",
  EY: "YARIM_ESKI",
  ET: "TAM_ESKI",
  EG: "GREMSE_ESKI",
  EA: "ATA_ESKI",
  EA5: "ATA5_ESKI",
  AG: "GUMUS_TL",
  XAGUSD: "GUMUS_ONS",
  USDKG: "USDKG",
  EURKG: "EURKG",
};

const satiraCevir = (k: AkKalem): FiyatSatiri => {
  const ad = (k.MobilAciklama || k.Aciklama || k.Kod).trim();
  const ortak = ORTAK[k.Kod] ?? (/^[A-Z]{3}$/.test(k.Kod) ? `${k.Kod}TRY` : /^[A-Z]{6}$/.test(k.Kod) ? k.Kod : undefined);
  return {
    kod: k.Kod,
    ad: k.Kod === "XAUUSD" ? "Ons" : k.Kod === "XAGUSD" ? "Gümüş Ons" : ad,
    ...(k.DataGroup === 1 ? { altAd: k.Kod } : {}),
    ...(ortak ? { ortakKod: ortak } : {}),
    alis: sayiTR(k.Alis),
    satis: sayiTR(k.Satis),
    degisim: typeof k.Change === "number" ? k.Change : null,
    ondalik: Math.max(ondalikSay(k.Alis, true), ondalikSay(k.Satis, true)),
    zaman: k.GuncellenmeZamani?.split(" ")[1]?.slice(0, 5) ?? null,
  };
};

export class AltinkaynakKaynak extends CekmeliKaynak {
  readonly kod = "altinkaynak";
  readonly ad = "Altınkaynak";
  readonly site = "altinkaynak.com";
  protected aralikMs = 2500;

  protected async cek(): Promise<FiyatGrubu[]> {
    const basliklar = { Origin: "https://www.altinkaynak.com", Referer: "https://www.altinkaynak.com/", Accept: "application/json" };
    const [altin, doviz] = await Promise.all(
      (["Gold", "Currency"] as const).map(async (u) => (await (await getir(`https://static.altinkaynak.com/${u}`, { headers: basliklar })).json()) as AkKalem[]),
    );
    const kaynak = { Gold: altin, Currency: doviz };

    const gruplar: FiyatGrubu[] = GRUPLAR.map((g) => ({
      kod: g.kod,
      baslik: g.baslik,
      tur: "alis-satis" as const,
      satirlar: kaynak[g.kaynak].filter((k) => k.DataGroup === g.dataGroup && !haricMi(k.Kod, k.MobilAciklama)).map(satiraCevir),
    }));

    // Ons ve gümüş ons döviz akışında (DataGroup 10) geliyor; sitedeki gibi Altın ve Gümüş tablolarının başına konur
    const ons = doviz.filter((k) => k.DataGroup === 10).map(satiraCevir);
    const altinGrubu = gruplar.find((g) => g.kod === "altin");
    const gumusGrubu = gruplar.find((g) => g.kod === "gumus");
    altinGrubu?.satirlar.unshift(...ons.filter((s) => s.kod === "XAUUSD"));
    gumusGrubu?.satirlar.unshift(...ons.filter((s) => s.kod === "XAGUSD"));
    return gruplar;
  }
}
