import { CekmeliKaynak, getir, sayiTR, ondalikSay, haricMi } from "../yardimci.js";
/** [kaynak, DataGroup] → grup. Sıra sitedeki sırayla aynı. */
const GRUPLAR = [
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
const ORTAK = {
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
const satiraCevir = (k) => {
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
    kod = "altinkaynak";
    ad = "Altınkaynak";
    site = "altinkaynak.com";
    aralikMs = 2500;
    async cek() {
        const basliklar = { Origin: "https://www.altinkaynak.com", Referer: "https://www.altinkaynak.com/", Accept: "application/json" };
        const [altin, doviz] = await Promise.all(["Gold", "Currency"].map(async (u) => (await (await getir(`https://static.altinkaynak.com/${u}`, { headers: basliklar })).json())));
        const kaynak = { Gold: altin, Currency: doviz };
        const gruplar = GRUPLAR.map((g) => ({
            kod: g.kod,
            baslik: g.baslik,
            tur: "alis-satis",
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
