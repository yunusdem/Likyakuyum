import { modulleriDuzenle } from "./modulAgaci.js";
/** Açılan kodun tüm üstlerini ekler (ağaç kuralı üstü kapalı olanı kapattığı için). */
export const ustleriyle = (katalog, kodlar) => {
    const ust = new Map(katalog.map((m) => [m.modulKodu, m.ustKodu]));
    const sonuc = new Set();
    for (const k of kodlar) {
        if (!ust.has(k))
            continue;
        for (let u = k; u; u = ust.get(u))
            sonuc.add(u);
    }
    return sonuc;
};
/** Seçili ürünlerin taban listesi (çekirdek dahil, ağaç kuralı uygulanmış). urunler boşsa boş liste. */
export const paketTabani = (katalog, paketler, urunler) => {
    if (urunler.length === 0)
        return [];
    const secili = paketler.filter((p) => p.cekirdek || urunler.includes(p.paketKodu));
    if (secili.some((p) => p.hepsi && urunler.includes(p.paketKodu)))
        return katalog.map((m) => m.modulKodu);
    return modulleriDuzenle(katalog, [...ustleriyle(katalog, secili.flatMap((p) => p.moduller))]);
};
/** Taban + istisnalar → firmanın açık modülleri. */
export const firmaModulleriHesapla = (katalog, taban, istisna) => {
    const kume = new Set(taban);
    istisna.ek.forEach((k) => kume.add(k));
    istisna.cikar.forEach((k) => kume.delete(k));
    return modulleriDuzenle(katalog, [...ustleriyle(katalog, kume)]);
};
/**
 * İstenen son listeyi tabana göre istisnaya çevirir: tabanda olmayan açık → EK, tabanda olup kapalı → CIKAR.
 * firmaModulleriHesapla(katalog, taban, istisnaCikar(katalog, taban, istenen)) === ağaç kuralı(istenen).
 */
export const istisnaCikar = (katalog, taban, istenen) => {
    const t = new Set(modulleriDuzenle(katalog, taban));
    const i = new Set(modulleriDuzenle(katalog, istenen));
    return { ek: [...i].filter((k) => !t.has(k)), cikar: [...t].filter((k) => !i.has(k)) };
};
/** İki liste arasındaki fark (önizleme): yalnız yaprak sayfalar, katalog sırasıyla. */
export const farkHesapla = (katalog, eski, yeni) => {
    const altVar = new Set(katalog.map((m) => m.ustKodu).filter((u) => !!u));
    const yapraklar = katalog.filter((m) => !altVar.has(m.modulKodu));
    const e = new Set(eski ?? katalog.map((m) => m.modulKodu)); // null = kısıtsız, her şey açık
    const y = new Set(yeni);
    return {
        acilacak: yapraklar.filter((m) => y.has(m.modulKodu) && !e.has(m.modulKodu)),
        kapanacak: yapraklar.filter((m) => e.has(m.modulKodu) && !y.has(m.modulKodu)),
    };
};
/** "kuyum,connector" ↔ dizi. Bilinmeyen / yinelenen kod atılır, sıra korunur. */
export const urunleriOku = (metin) => [...new Set((metin || "").split(",").map((s) => s.trim()).filter(Boolean))];
export const urunleriYaz = (urunler) => (urunler.length ? [...new Set(urunler)].join(",") : null);
export const ayniUrunler = (a, b) => {
    const x = new Set(a);
    const y = new Set(b);
    return x.size === y.size && [...x].every((k) => y.has(k));
};
