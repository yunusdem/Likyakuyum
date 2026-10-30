import { TabanKaynak, SocketIoBaglanti, getir, sayi, haricMi } from "../yardimci.js";
import { gruplariKur } from "./ortak.js";
const GRAM_URUN_ADRESI = "https://backend.ozbag.com/api/prices/new-products";
const GRAM_URUN_ARALIK_MS = 30 * 60_000;
/** Katsayı listesi alınamazsa bu kadar sonra yeniden denenir */
const GRAM_URUN_YENIDEN_MS = 60_000;
const TANIMLAR = [
    {
        kod: "altin",
        baslik: "Altın",
        satirlar: [
            ["HAS", "Has Altın", "HAS"],
            ["XAUUSD", "Altın / Ons", "ONS"],
            ["USDKG", "USD/KG", "USDKG"],
            ["EURKG", "EUR/KG", "EURKG"],
        ],
    },
    {
        kod: "sarrafiye",
        baslik: "Sarrafiye",
        satirlar: [
            ["YENİ ÇEYR", "Yeni Çeyrek", "CEYREK_YENI"],
            ["ESKİ ÇEYREK", "Eski Çeyrek", "CEYREK_ESKI"],
            ["YENİ YARIM", "Yeni Yarım", "YARIM_YENI"],
            ["ESKİ YARIM", "Eski Yarım", "YARIM_ESKI"],
            ["YENİ TAM", "Yeni Tam", "TAM_YENI"],
            ["ESKİ TAM", "Eski Tam", "TAM_ESKI"],
            ["YENİ GRAMSE", "Yeni Gremse", "GREMSE_YENI"],
            ["ESKİ GRAMSE", "Eski Gremse", "GREMSE_ESKI"],
            ["YENİ ATA", "Yeni Ata", "ATA_YENI"],
            ["ESKİ ATA", "Eski Ata", "ATA_ESKI"],
            ["YENİ ATA 5Lİ", "Yeni Ata Beşli", "ATA5_YENI"],
            ["ESKİ ATA 5Lİ", "Eski Ata Beşli", "ATA5_ESKI"],
        ],
    },
    { kod: "gumus", baslik: "Gümüş", satirlar: [["XAGUSD", "Gümüş (TL/gr)", "GUMUS_TL"]] },
    {
        kod: "doviz",
        baslik: "Döviz",
        satirlar: [
            ["USDTRY", "USD/TRY", "USDTRY", "Amerikan Doları"],
            ["EURTRY", "EUR/TRY", "EURTRY", "Euro"],
            ["GBPTRY", "GBP/TRY", "GBPTRY", "İngiliz Sterlini"],
            ["CHF", "CHF/TRY", "CHFTRY", "İsviçre Frangı"],
            ["CAD", "CAD/TRY", "CADTRY", "Kanada Doları"],
            ["AUD", "AUD/TRY", "AUDTRY", "Avustralya Doları"],
            ["SAR", "SAR/TRY", "SARTRY", "Suudi Riyali"],
            ["DKK", "DKK/TRY", "DKKTRY", "Danimarka Kronu"],
            ["SEK", "SEK/TRY", "SEKTRY", "İsveç Kronu"],
            ["NOK", "NOK/TRY", "NOKTRY", "Norveç Kronu"],
        ],
    },
    { kod: "parite", baslik: "Pariteler", satirlar: [["EURUSD", "EUR/USD", "EURUSD"]] },
];
/** Sitedeki gösterim: has/ons/gümüş 2 hane, sarrafiye tam sayı, döviz 3, parite 4 */
const ONDALIK = { HAS: 2, XAUUSD: 2, XAGUSD: 2, USDKG: 0, EURKG: 0, EURUSD: 4 };
/** KG fiyatları "128.644" biçiminde (bin $/kg) gelir; diğer kaynaklarla aynı birim için 1000 ile çarpılır */
const CARPAN = { USDKG: 1000, EURKG: 1000 };
const SARRAFIYE = new Set(TANIMLAR.find((t) => t.kod === "sarrafiye").satirlar.map(([kod]) => kod));
export class OzbagKaynak extends TabanKaynak {
    kod = "ozbag";
    ad = "Özbağ Kuyumculuk";
    site = "ozbag.com";
    ham = new Map();
    socket = null;
    gramUrunler = [];
    gramZamanlayici = null;
    baslat() {
        if (this.calisiyor)
            return;
        this.calisiyor = true;
        void this.gramUrunCek();
        this.socket = new SocketIoBaglanti("wss://veri.ozbag.com/socket.io/?status=false", { Origin: "https://ozbag.com" }, { hata: (m) => this.hataOldu(m) }).on("prices", (liste) => {
            if (!Array.isArray(liste) || !liste.length)
                return;
            for (const h of liste) {
                const kod = h?.Code?.trim();
                if (!kod || haricMi(kod, h.Symbol))
                    continue;
                this.ham.set(kod, h);
            }
            this.yenidenKur();
        });
        this.socket.baslat();
    }
    durdur() {
        this.calisiyor = false;
        this.socket?.durdur();
        this.socket = null;
        if (this.gramZamanlayici)
            clearTimeout(this.gramZamanlayici);
        this.gramZamanlayici = null;
    }
    async gramUrunCek() {
        let bekle = GRAM_URUN_ARALIK_MS;
        try {
            const liste = (await (await getir(GRAM_URUN_ADRESI, { headers: { Origin: "https://ozbag.com", Referer: "https://ozbag.com/" } })).json());
            const temiz = (Array.isArray(liste) ? liste : []).filter((u) => u && typeof u.code === "string" && Number(u.gram) > 0 && Number(u.baseBid) > 0 && Number(u.baseAsk) > 0);
            if (!temiz.length)
                throw new Error("Liste boş");
            this.gramUrunler = temiz;
            if (this.ham.size)
                this.yenidenKur();
        }
        catch (e) {
            bekle = GRAM_URUN_YENIDEN_MS;
            this.hataOldu(`Gram altın katsayıları alınamadı: ${e?.message ?? e}`);
        }
        if (!this.calisiyor)
            return;
        this.gramZamanlayici = setTimeout(() => void this.gramUrunCek(), bekle);
    }
    /** Sayfadaki "Gram Altın" tablosu: HAS × gram × katsayı (1 Gr 995 ortak kod GRAM — diğer kaynakların gram külçesiyle aynı kalem) */
    gramGrubu() {
        const has = this.ham.get("HAS");
        const hasAlis = sayi(has?.Bid);
        const hasSatis = sayi(has?.Ask);
        if (!this.gramUrunler.length || hasAlis === null || hasSatis === null)
            return null;
        const zaman = has?.Time && !has.Time.startsWith("0001") ? has.Time.slice(11, 16) : null;
        const satirlar = this.gramUrunler.map((u) => ({
            kod: u.code,
            ad: u.description || `${u.gram} Gr`,
            alis: Math.round(hasAlis * u.gram * u.baseBid * 100) / 100,
            satis: Math.round(hasSatis * u.gram * u.baseAsk * 100) / 100,
            ondalik: 2,
            degisim: null,
            zaman,
            ...(u.gram === 1 ? { ortakKod: "GRAM" } : {}),
        }));
        return { kod: "kulce", baslik: "Gram Altın", tur: "alis-satis", satirlar };
    }
    yenidenKur() {
        const gruplar = gruplariKur(TANIMLAR, (kod) => {
            const h = this.ham.get(kod);
            if (!h)
                return null;
            const c = CARPAN[kod] ?? 1;
            let alis = sayi(h.Bid);
            let satis = sayi(h.Ask);
            if (alis !== null)
                alis *= c;
            if (satis !== null)
                satis *= c;
            // Sarrafiye sitede tam sayı; KG ×1000 sonrası kayan nokta kırıntısı kalmasın
            if (SARRAFIYE.has(kod) || c !== 1) {
                if (alis !== null)
                    alis = Math.round(alis);
                if (satis !== null)
                    satis = Math.round(satis);
            }
            if (alis === null && satis === null)
                return null;
            // Time: "2026-10-29T12:42:42.1386845+03:00" (İstanbul saati gömülü) → "12:42"
            const zaman = h.Time && !h.Time.startsWith("0001") ? h.Time.slice(11, 16) : null;
            return {
                alis,
                satis,
                ondalik: ONDALIK[kod] ?? (SARRAFIYE.has(kod) ? 0 : 3),
                degisim: null,
                zaman,
            };
        });
        const gram = this.gramGrubu();
        // Sitedeki sıra: Has/Ons … Sarrafiye, Gram Altın; sonra gümüş, döviz
        if (gram)
            gruplar.splice(2, 0, gram);
        this.veriGeldi(gruplar);
    }
}
