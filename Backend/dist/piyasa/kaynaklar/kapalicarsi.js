import { TabanKaynak, SocketIoBaglanti, sayi, ondalikSay, haricMi } from "../yardimci.js";
import { gruplariKur } from "./ortak.js";
const TANIMLAR = [
    {
        kod: "altin",
        baslik: "Altın",
        satirlar: [
            ["GRAM", "Gram Altın", "GRAM"],
            ["HAS", "Has Altın", "HAS"],
            ["AYAR22", "22 Ayar Altın", "AYAR22"],
            ["AYAR14", "14 Ayar Altın", "AYAR14"],
            ["ONS", "Altın Ons $", "ONS"],
            ["USDKG", "USD/KG", "USDKG"],
            ["EURKG", "EUR/KG", "EURKG"],
            ["XAUXAG", "Altın/Gümüş", "XAUXAG"],
        ],
    },
    {
        kod: "sarrafiye",
        baslik: "Sarrafiye",
        satirlar: [
            ["CEYREK", "Çeyrek Altın", "CEYREK_YENI"],
            ["CEYREK_ESKI", "Çeyrek Eski", "CEYREK_ESKI"],
            ["YARIM", "Yarım Altın", "YARIM_YENI"],
            ["YARIM_ESKI", "Yarım Eski", "YARIM_ESKI"],
            ["TEK", "Tam Altın", "TAM_YENI"],
            ["TEK_ESKI", "Tam Eski", "TAM_ESKI"],
            ["ATA", "Ata Altın", "ATA_YENI"],
            ["ATA_ESKI", "Ata Eski", "ATA_ESKI"],
            ["ATA5", "Ata 5'li", "ATA5_YENI"],
            ["ATA5_ESKI", "Ata 5'li Eski", "ATA5_ESKI"],
            ["GREMSE", "Gremse (2.5)", "GREMSE_YENI"],
            ["GREMSE_ESKI", "Gremse Eski", "GREMSE_ESKI"],
        ],
    },
    {
        kod: "gumus",
        baslik: "Gümüş",
        satirlar: [
            ["GUMUSTRY", "Gümüş Gram", "GUMUS_TL"],
            ["XAGUSD", "Gümüş Ons", "GUMUS_ONS"],
            ["GUMUSUSD", "Gümüş USD", "GUMUS_USD"],
        ],
    },
    {
        kod: "doviz",
        baslik: "Döviz",
        satirlar: [
            ["USDTRY", "Dolar", "USDTRY", "USD/TRY"],
            ["EURTRY", "Euro", "EURTRY", "EUR/TRY"],
            ["GBPTRY", "Sterlin", "GBPTRY", "GBP/TRY"],
            ["CHFTRY", "İsviçre Frangı", "CHFTRY", "CHF/TRY"],
            ["AUDTRY", "Avustralya Doları", "AUDTRY", "AUD/TRY"],
            ["CADTRY", "Kanada Doları", "CADTRY", "CAD/TRY"],
            ["SARTRY", "Suudi Riyali", "SARTRY", "SAR/TRY"],
            ["JPYTRY", "Japon Yeni", "JPYTRY", "JPY/TRY"],
            ["KWDTRY", "Kuveyt Dinarı", "KWDTRY", "KWD/TRY"],
            ["JODTRY", "Ürdün Dinarı", "JODTRY", "JOD/TRY"],
            ["SEKTRY", "İsveç Kronu", "SEKTRY", "SEK/TRY"],
            ["NOKTRY", "Norveç Kronu", "NOKTRY", "NOK/TRY"],
        ],
    },
    {
        kod: "parite",
        baslik: "Pariteler",
        satirlar: [
            ["P_EURUSD", "EUR/USD", "EURUSD"],
            ["P_GBPUSD", "GBP/USD", "GBPUSD"],
            ["P_USDCHF", "USD/CHF", "USDCHF"],
            ["P_USDJPY", "USD/JPY", "USDJPY"],
            ["P_USDSEK", "USD/SEK", "USDSEK"],
            ["P_USDRUB", "USD/RUB", "USDRUB"],
            ["P_USDSGD", "USD/SGD", "USDSGD"],
            ["P_DXYUSD", "Dolar Endeksi", "DXY"],
        ],
    },
];
/** "12-08-2026 00:58:16" gibi tarihli zaman, sembolün günlerdir güncellenmediğini gösterir → gösterilmez. */
const bayatMi = (zaman) => {
    const m = zaman?.match(/^(\d{2})-(\d{2})-(\d{4})/);
    if (!m)
        return false;
    const tarih = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
    return Date.now() - tarih.getTime() > 2 * 86_400_000;
};
export class KapalicarsiKaynak extends TabanKaynak {
    kod = "kapalicarsi";
    ad = "Kapalıçarşı";
    site = "anlikaltinfiyatlari.com";
    ham = new Map();
    pariteler = new Map();
    socket = null;
    baslat() {
        if (this.calisiyor)
            return;
        this.calisiyor = true;
        this.socket = new SocketIoBaglanti("wss://socket.anlikaltinfiyatlari.com/sio/p7013/socket.io/", { Origin: "https://anlikaltinfiyatlari.com" }, { hata: (m) => this.hataOldu(m) })
            .on("kapalicarsi", (metin) => {
            const veri = (typeof metin === "string" ? JSON.parse(metin) : metin);
            for (const [k, v] of Object.entries(veri)) {
                if (!v || typeof v !== "object" || haricMi(k))
                    continue;
                if (bayatMi(v.zaman))
                    this.ham.delete(k);
                else
                    this.ham.set(k, v);
            }
            this.yenidenKur();
        })
            .on("update", (metin) => {
            const veri = (typeof metin === "string" ? JSON.parse(metin) : metin);
            for (const [k, v] of Object.entries(veri)) {
                const n = sayi(v);
                if (n !== null && /^[A-Z]{6}$/.test(k))
                    this.pariteler.set(k, n);
            }
            if (this.ham.size)
                this.yenidenKur();
        });
        this.socket.baslat();
    }
    durdur() {
        this.calisiyor = false;
        this.socket?.durdur();
        this.socket = null;
    }
    yenidenKur() {
        this.veriGeldi(gruplariKur(TANIMLAR, (kod) => {
            if (kod.startsWith("P_")) {
                const n = this.pariteler.get(kod.slice(2));
                return n === undefined ? null : { alis: null, satis: n, ondalik: n >= 100 ? 2 : 4 };
            }
            const h = this.ham.get(kod);
            if (!h)
                return null;
            return {
                alis: sayi(h.alis),
                satis: sayi(h.satis),
                ondalik: Math.max(ondalikSay(h.alis), ondalikSay(h.satis), 2),
                zaman: h.zaman && /^\d{2}:\d{2}/.test(h.zaman) ? h.zaman.slice(0, 5) : null,
            };
        }));
    }
}
