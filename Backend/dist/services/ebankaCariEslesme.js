// F- e-Banka — banka hareketinin carisini bulmada kullanılan saf yardımcılar (docs/TAHSILAT_MUTABAKATI_YOL_HARITASI.md, M10–M13).
// Veritabanına dokunmaz; planla() ve testler kullanır.
/** Şirket ekleri ve bağlaçlar: isim karşılaştırmasında sayılmaz */
const EKLER = new Set([
    "SAN", "SANAYI", "SANAYII", "TIC", "TICARET", "LTD", "LIMITED", "STI", "SIRKETI", "SIRKET", "AS", "ANONIM",
    "VE", "KOLL", "KOLLEKTIF", "KOM", "KOMANDIT", "ITH", "IHR", "ITHALAT", "IHRACAT", "DIS",
]);
const HARF = { Ç: "C", Ğ: "G", İ: "I", I: "I", Ö: "O", Ş: "S", Ü: "U", Â: "A", Î: "I", Û: "U" };
/** Adı karşılaştırılabilir kelimelere çevirir: büyük harf, Türkçe harfler sade, noktalama ve şirket ekleri atılmış, ilk 3 kelime. */
export const isimKelimeleri = (ad) => (ad || "")
    .toLocaleUpperCase("tr-TR")
    .replace(/[ÇĞİIÖŞÜÂÎÛ]/g, (h) => HARF[h] || h)
    .replace(/[^A-Z0-9]+/g, " ")
    .split(" ")
    .filter((k) => k.length > 1 && !EKLER.has(k))
    .slice(0, 3);
/** Kısa olan adın kelimeleri (en az 2) uzun olanın ilk kelimeleriyle aynıysa tutar. Tek kelimelik ad eşleşme sayılmaz. */
export const isimTutar = (a, b) => {
    const n = Math.min(a.length, b.length);
    if (n < 2)
        return false;
    for (let i = 0; i < n; i++)
        if (a[i] !== b[i])
            return false;
    return true;
};
/** İsim sözlüğünün anahtarı: ilk iki kelime (isimTutar en az iki kelime ister) */
export const isimAnahtari = (k) => (k.length >= 2 ? `${k[0]} ${k[1]}` : null);
export const vknGecerli = (v) => {
    if (!/^\d{10}$/.test(v))
        return false;
    let toplam = 0;
    for (let i = 0; i < 9; i++) {
        const t = (Number(v[i]) + 9 - i) % 10;
        if (t === 0)
            continue;
        const d = (t * 2 ** (9 - i)) % 9;
        toplam += d === 0 ? 9 : d;
    }
    return (10 - (toplam % 10)) % 10 === Number(v[9]);
};
export const tcknGecerli = (v) => {
    if (!/^[1-9]\d{10}$/.test(v))
        return false;
    const d = v.split("").map(Number);
    const tek = d[0] + d[2] + d[4] + d[6] + d[8];
    const cift = d[1] + d[3] + d[5] + d[7];
    if ((((tek * 7 - cift) % 10) + 10) % 10 !== d[9])
        return false;
    return d.slice(0, 10).reduce((t, x) => t + x, 0) % 10 === d[10];
};
/** Açıklamaya yazılmış 10 haneli VKN / 11 haneli TC kimlik numaraları (sağlama hanesi tutanlar). */
export const aciklamaNumaralari = (aciklama) => {
    const bulunan = new Set();
    for (const m of (aciklama || "").matchAll(/(?<!\d)(\d{10,11})(?!\d)/g)) {
        const n = m[1];
        if (n.length === 10 ? vknGecerli(n) : tcknGecerli(n))
            bulunan.add(n);
    }
    return [...bulunan];
};
