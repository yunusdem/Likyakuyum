const y6 = (n) => Math.round(n * 1_000_000) / 1_000_000;
const y4 = (n) => Math.round(n * 10000) / 10000;
export function ortalamaMaliyet(hareketler, baslangicOrtalama = 0) {
    const sirali = [...hareketler].sort((a, b) => {
        const ta = typeof a.tarih === "number" ? a.tarih : Date.parse(a.tarih), tb = typeof b.tarih === "number" ? b.tarih : Date.parse(b.tarih);
        return ta - tb || a.id - b.id;
    });
    let ort = Math.max(0, Number(baslangicOrtalama) || 0), miktar = 0;
    let bilinen = ort > 0;
    return sirali.map((h) => {
        const g = Number(h.giris) || 0, c = Number(h.cikis) || 0;
        let birim;
        if (g > 0 && h.maliyetliFiyat !== null && h.maliyetliFiyat !== undefined && Number.isFinite(Number(h.maliyetliFiyat))) {
            const f = Math.max(0, Number(h.maliyetliFiyat));
            ort = miktar > 0 && bilinen ? y6((miktar * ort + g * f) / (miktar + g)) : y6(f);
            bilinen = true;
            birim = f;
        }
        else if (c > 0 && h.cikisFiyati !== null && h.cikisFiyati !== undefined && Number.isFinite(Number(h.cikisFiyati))) {
            const f = Math.max(0, Number(h.cikisFiyati));
            const kalan = miktar - c;
            if (miktar > 0 && kalan > 0.00005 && bilinen)
                ort = y6(Math.max(0, (miktar * ort - c * f) / kalan));
            birim = f;
        }
        else
            birim = ort;
        miktar = y4(miktar + g - c);
        return { id: h.id, birimMaliyet: y6(birim), ortSonra: ort, miktarSonra: miktar, bilinmiyor: !(birim > 0) && !(g > 0 && h.maliyetliFiyat !== null) };
    });
}
/** Son ortalama (hareket yoksa başlangıç) */
export const sonOrtalama = (sonuclar, baslangicOrtalama = 0) => (sonuclar.length ? sonuclar[sonuclar.length - 1].ortSonra : Math.max(0, Number(baslangicOrtalama) || 0));
