import { TabanKaynak, SocketIoBaglanti, getir, sayi, ondalikSay, haricMi } from "../yardimci.js";
import { gruplariKur, type GrupTanimi } from "./ortak.js";
import type { FiyatGrubu, FiyatSatiri } from "../tipler.js";

/**
 * Harem Altın — canlipiyasalar.haremaltin.com
 * Canlı fiyat: socket.io (hrmsocketonly.haremaltin.com) "price_changed" olayı; her mesaj yalnız değişen sembolleri taşır.
 * İşçilik: tmp/iscilik.json (has bloğu), seyrek değişir → dakikada bir.
 */
interface HaremHam {
  alis: string | number;
  satis: string | number;
  tarih?: string;
  kapanis?: number | string | null;
}

const TANIMLAR: GrupTanimi[] = [
  {
    kod: "altin",
    baslik: "Altın",
    satirlar: [
      ["ALTIN", "Has Altın", "HAS"],
      ["KULCEALTIN", "Gram Altın", "GRAM"],
      ["ONS", "Ons", "ONS"],
      ["USDKG", "USD/KG", "USDKG"],
      ["EURKG", "EUR/KG", "EURKG"],
      ["AYAR22", "22 Ayar", "AYAR22"],
      ["AYAR14", "14 Ayar", "AYAR14"],
      ["XAUXAG", "Altın/Gümüş", "XAUXAG"],
    ],
  },
  {
    kod: "sarrafiye",
    baslik: "Sarrafiye",
    satirlar: [
      ["CEYREK_YENI", "Yeni Çeyrek", "CEYREK_YENI"],
      ["CEYREK_ESKI", "Eski Çeyrek", "CEYREK_ESKI"],
      ["YARIM_YENI", "Yeni Yarım", "YARIM_YENI"],
      ["YARIM_ESKI", "Eski Yarım", "YARIM_ESKI"],
      ["TEK_YENI", "Yeni Tam", "TAM_YENI"],
      ["TEK_ESKI", "Eski Tam", "TAM_ESKI"],
      ["ATA_YENI", "Yeni Ata", "ATA_YENI"],
      ["ATA_ESKI", "Eski Ata", "ATA_ESKI"],
      ["ATA5_YENI", "Yeni Ata5", "ATA5_YENI"],
      ["ATA5_ESKI", "Eski Ata5", "ATA5_ESKI"],
      ["GREMESE_YENI", "Yeni Gremse", "GREMSE_YENI"],
      ["GREMESE_ESKI", "Eski Gremse", "GREMSE_ESKI"],
    ],
  },
  {
    kod: "gumus",
    baslik: "Gümüş",
    satirlar: [
      ["GUMUSTRY", "Gümüş TL", "GUMUS_TL"],
      ["XAGUSD", "Gümüş Ons", "GUMUS_ONS"],
      ["GUMUSUSD", "Gümüş USD", "GUMUS_USD"],
    ],
  },
  {
    kod: "doviz",
    baslik: "Döviz",
    satirlar: [
      ["USDTRY", "USD/TRY", "USDTRY", "Amerikan Doları"],
      ["EURTRY", "EUR/TRY", "EURTRY", "Euro"],
      ["GBPTRY", "GBP/TRY", "GBPTRY", "İngiliz Sterlini"],
      ["CHFTRY", "CHF/TRY", "CHFTRY", "İsviçre Frangı"],
      ["AUDTRY", "AUD/TRY", "AUDTRY", "Avustralya Doları"],
      ["CADTRY", "CAD/TRY", "CADTRY", "Kanada Doları"],
      ["SARTRY", "SAR/TRY", "SARTRY", "Suudi Riyali"],
      ["JPYTRY", "JPY/TRY", "JPYTRY", "Japon Yeni"],
      ["KWDTRY", "KWD/TRY", "KWDTRY", "Kuveyt Dinarı"],
      ["JODTRY", "JOD/TRY", "JODTRY", "Ürdün Dinarı"],
      ["OMRTRY", "OMR/TRY", "OMRTRY", "Umman Riyali"],
      ["ILSTRY", "ILS/TRY", "ILSTRY", "İsrail Şekeli"],
      ["MADTRY", "MAD/TRY", "MADTRY", "Fas Dirhemi"],
    ],
  },
  {
    kod: "parite",
    baslik: "Pariteler",
    satirlar: [
      ["EURUSD", "EUR/USD", "EURUSD"],
      ["GBPUSD", "GBP/USD", "GBPUSD"],
      ["USDCHF", "USD/CHF", "USDCHF"],
      ["USDJPY", "USD/JPY", "USDJPY"],
      ["USDCAD", "USD/CAD", "USDCAD"],
      ["AUDUSD", "AUD/USD", "AUDUSD"],
      ["USDSAR", "USD/SAR", "USDSAR"],
      ["USDQAR", "USD/QAR", "USDQAR"],
      ["KWDUSD", "KWD/USD", "KWDUSD"],
      ["JODUSD", "JOD/USD", "JODUSD"],
    ],
  },
];

/** Soket bazı altın fiyatlarını 3 hane gönderiyor ("6576.820"); sitedeki tablolarla aynı hane sayısı */
const ONDALIK: Record<string, number> = {
  ALTIN: 2,
  KULCEALTIN: 2,
  ONS: 2,
  USDKG: 0,
  EURKG: 0,
  AYAR22: 2,
  AYAR14: 2,
  XAUXAG: 2,
  GUMUSTRY: 3,
  XAGUSD: 2,
  GUMUSUSD: 2,
};

const ISCILIK: [string, string][] = [
  ["CEYREK", "Çeyrek"],
  ["YARIM", "Yarım"],
  ["TEK", "Tek"],
  ["ATA", "Ata"],
  ["GREMESE", "Gremse"],
  ["ATA5", "Ata 5'li"],
];

export class HaremKaynak extends TabanKaynak {
  readonly kod = "harem";
  readonly ad = "Harem Altın";
  readonly site = "canlipiyasalar.haremaltin.com";

  private ham = new Map<string, HaremHam>();
  private iscilik: FiyatGrubu | null = null;
  private socket: SocketIoBaglanti | null = null;
  private iscilikZamanlayici: NodeJS.Timeout | null = null;

  baslat(): void {
    if (this.calisiyor) return;
    this.calisiyor = true;
    this.socket = new SocketIoBaglanti(
      "wss://hrmsocketonly.haremaltin.com/socket.io/",
      { Origin: "https://canlipiyasalar.haremaltin.com" },
      { hata: (m) => this.hataOldu(m) },
    ).on("price_changed", (p: { data?: Record<string, HaremHam> }) => {
      for (const [k, v] of Object.entries(p?.data ?? {})) if (!haricMi(k)) this.ham.set(k, v);
      this.yenidenKur();
    });
    this.socket.baslat();
    void this.iscilikCek();
    this.iscilikZamanlayici = setInterval(() => void this.iscilikCek(), 60_000);
  }

  durdur(): void {
    this.calisiyor = false;
    this.socket?.durdur();
    this.socket = null;
    if (this.iscilikZamanlayici) clearInterval(this.iscilikZamanlayici);
    this.iscilikZamanlayici = null;
  }

  private yenidenKur(): void {
    const gruplar = gruplariKur(TANIMLAR, (kod) => {
      const h = this.ham.get(kod);
      if (!h) return null;
      const satis = sayi(h.satis);
      const kapanis = sayi(h.kapanis);
      return {
        alis: sayi(h.alis),
        satis,
        ondalik: ONDALIK[kod] ?? Math.max(ondalikSay(h.satis), ondalikSay(h.alis)),
        degisim: satis !== null && kapanis ? ((satis - kapanis) / kapanis) * 100 : null,
        zaman: h.tarih?.split(" ")[1]?.slice(0, 5) ?? null,
      };
    });
    if (this.iscilik) gruplar.push(this.iscilik);
    this.veriGeldi(gruplar);
  }

  private async iscilikCek(): Promise<void> {
    try {
      const j = (await (
        await getir("https://canlipiyasalar.haremaltin.com/tmp/iscilik.json?dil_kodu=tr", {
          headers: { Referer: "https://canlipiyasalar.haremaltin.com/" },
        })
      ).json()) as { has?: Record<string, string> };
      const has = j.has ?? {};
      const satirlar: FiyatSatiri[] = ISCILIK.map(([k, ad]) => ({
        kod: `ISC_${k}`,
        ad,
        alis: sayi(has[`${k}_YENI_alis`]),
        satis: sayi(has[`${k}_YENI_satis`]),
        eskiAlis: sayi(has[`${k}_ESKI_alis`]),
        eskiSatis: sayi(has[`${k}_ESKI_satis`]),
        ondalik: 4,
      }));
      this.iscilik = { kod: "iscilik", baslik: "Darphane İşçilik (Has)", tur: "yeni-eski", satirlar };
      if (this.ham.size) this.yenidenKur();
    } catch (e: any) {
      this.hataOldu(`İşçilik alınamadı: ${e?.message ?? e}`);
    }
  }
}
