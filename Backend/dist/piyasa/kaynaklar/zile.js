import { CekmeliKaynak, getir, sayi, haricMi } from "../yardimci.js";
const GRUP = { Altın: "altin", Sarrafiye: "sarrafiye", Döviz: "doviz", Gümüş: "gumus" };
const ORTAK = {
    HAS_ALTIN: "HAS",
    GRAM_ALTIN: "GRAM",
    "22_AYAR": "AYAR22",
    "18_AYAR": "AYAR18",
    "14_AYAR": "AYAR14",
    "8_AYAR": "AYAR8",
    ONS_USD: "ONS",
    GUMUS_TL: "GUMUS_TL",
};
const ortakKod = (kod) => ORTAK[kod] ?? (/^(CEYREK|YARIM|TAM|ATA|GREMSE)_(YENI|ESKI)$/.test(kod) ? kod : /^[A-Z]{3}_[A-Z]{3}$/.test(kod) ? kod.replace("_", "") : undefined);
const saat = (ms) => ms ? new Date(ms).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Istanbul" }) : null;
export class ZileKaynak extends CekmeliKaynak {
    kod = "zile";
    ad = "Zile Döviz";
    site = "ziledoviz.com.tr";
    aralikMs = 2000;
    async cek() {
        const j = (await (await getir("https://api.piyasaekran.com.tr/api/prices/dealer/5", {
            headers: { Origin: "https://ziledoviz.com.tr", Referer: "https://ziledoviz.com.tr/", Accept: "application/json" },
        })).json());
        return (j.groups ?? [])
            .filter((g) => g.name !== "Ana Ekran")
            .sort((a, b) => a.order - b.order)
            .map((g) => ({
            kod: GRUP[g.name] ?? "altin",
            baslik: g.name,
            tur: "alis-satis",
            satirlar: g.items
                .filter((i) => !haricMi(i.code, i.name))
                .map((i) => {
                const ondalik = i.decimalPlaces ?? 2;
                const yuvarla = (n) => (n === null ? null : Number(n.toFixed(ondalik)));
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
