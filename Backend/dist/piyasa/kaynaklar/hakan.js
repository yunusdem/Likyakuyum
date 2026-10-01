import { TabanKaynak, HamWsBaglanti, getir, sayi, haricMi } from "../yardimci.js";
/** Kategori → grup. 9 numaralı kategori 1'in kopyası (farklı kaynak id'leri), alınmaz. */
const KATEGORI = {
    1: { kod: "doviz", baslik: "Döviz" },
    2: { kod: "altin", baslik: "Altın" },
    6: { kod: "sarrafiye", baslik: "Ziynet & Sarrafiye" },
    5: { kod: "parite", baslik: "Pariteler" },
};
const ORTAK = {
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
const ortakKod = (ad, ilkOns) => {
    if (ORTAK[ad])
        return ORTAK[ad];
    if (ad === "XAU/USD")
        return ilkOns ? "ONS" : undefined;
    return /^[A-Z]{3}\/[A-Z]{3}$/.test(ad) && !ad.startsWith("ALT") ? ad.replace("/", "") : undefined;
};
export class HakanKaynak extends TabanKaynak {
    kod = "hakan";
    ad = "Hakan Döviz";
    site = "hakandoviz.com";
    semboller = [];
    fiyatlar = new Map();
    ws = null;
    listeZamanlayici = null;
    baslat() {
        if (this.calisiyor)
            return;
        this.calisiyor = true;
        void this.listeCek();
        this.listeZamanlayici = setInterval(() => void this.listeCek(), 30 * 60_000);
        this.ws = new HamWsBaglanti("wss://socket.hakandoviz.com/", { Origin: "https://www.hakandoviz.com" }, {
            acildi: (gonder) => setTimeout(() => gonder("GetAll"), 300),
            mesaj: (m) => this.mesaj(m),
            hata: (m) => this.hataOldu(m),
        });
        this.ws.baslat();
    }
    durdur() {
        this.calisiyor = false;
        this.ws?.durdur();
        this.ws = null;
        if (this.listeZamanlayici)
            clearInterval(this.listeZamanlayici);
        this.listeZamanlayici = null;
    }
    async listeCek() {
        try {
            const j = (await (await getir("https://cmsapi.hakandoviz.com/api/Category/GetListCategoryWithSymbolBySite", {
                method: "POST",
                body: "{}",
                headers: { "Content-Type": "application/json", Origin: "https://www.hakandoviz.com", Referer: "https://www.hakandoviz.com/" },
            })).json());
            const gorulen = new Set();
            let onsVar = false;
            const liste = [];
            // Grupların sırası KATEGORI'deki sıra
            for (const [id, grup] of Object.entries(KATEGORI)) {
                const kat = j.result?.find((k) => k.categoryId === Number(id));
                for (const s of kat?.symbols ?? []) {
                    const ad = s.name.trim();
                    if (gorulen.has(s.sourceId) || haricMi(ad))
                        continue;
                    gorulen.add(s.sourceId);
                    const ok = ortakKod(ad, !onsVar);
                    if (ok === "ONS")
                        onsVar = true;
                    liste.push({ grup, sembol: { ...s, name: ad }, ...(ok ? { ortakKod: ok } : {}) });
                }
            }
            if (liste.length)
                this.semboller = liste;
            this.yenidenKur();
        }
        catch (e) {
            this.hataOldu(`Sembol listesi alınamadı: ${e?.message ?? e}`);
        }
    }
    mesaj(m) {
        let dizi;
        try {
            dizi = JSON.parse(m);
        }
        catch {
            return;
        }
        if (!Array.isArray(dizi))
            return;
        for (const x of dizi)
            this.fiyatlar.set(Number(x.i), { b: sayi(x.b), a: sayi(x.a) });
        this.yenidenKur();
    }
    yenidenKur() {
        if (!this.semboller.length || !this.fiyatlar.size)
            return;
        const gruplar = new Map();
        for (const { grup, sembol, ortakKod: ok } of this.semboller) {
            const f = this.fiyatlar.get(sembol.sourceId);
            if (!f)
                continue;
            const g = gruplar.get(grup.kod) ?? { kod: grup.kod, baslik: grup.baslik, tur: "alis-satis", satirlar: [] };
            const ondalik = sembol.pricePrecision ?? 4;
            const yuvarla = (n) => (n === null ? null : Number(n.toFixed(ondalik)));
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
