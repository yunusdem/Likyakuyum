/**
 * Türkiye saatine göre takvim yardımcıları. Sunucunun saat dilimi farklı olabilir (canlı sunucu UTC-7);
 * lisans günleri, gece yedekleme penceresi gibi kararlar her zaman Türkiye saatiyle verilir.
 */
const BICIM = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "short",
});
const HAFTA = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const trZaman = (an = new Date()) => {
    const p = {};
    for (const x of BICIM.formatToParts(an))
        p[x.type] = x.value;
    return {
        gun: `${p.year}-${p.month}-${p.day}`,
        saat: Number(p.hour) % 24,
        dakika: Number(p.minute),
        haftaGunu: HAFTA.indexOf(p.weekday),
    };
};
/** Türkiye takvimine göre bugün (YYYY-AA-GG). */
export const bugunTr = (an = new Date()) => trZaman(an).gun;
/** İki YYYY-AA-GG arasındaki gün farkı (b - a). */
export const gunFarki = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
export const gunEkle = (gun, adet) => new Date(Date.parse(`${gun}T00:00:00Z`) + adet * 86_400_000).toISOString().slice(0, 10);
