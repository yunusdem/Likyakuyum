import { ApiError } from "../../utils/ApiError.js";
/**
 * Garson / mutfak ekranı giriş uçlarının hız sınırı (26.11.2026 denetimi). Bu uçlar internete açık ve oturumsuzdur; PIN 4–8 hanedir
 * ve her deneme sunucuda pahalı bir özet (scrypt) çalıştırır. Garson başına kilit (5 hata → 15 dk) PIN'i korur ama kimliksiz istek
 * selini ve farklı adlarla taramayı durdurmaz. Sınır yalnız bu uçlara uygulanır (genel sınırlayıcı bilinçli olarak kapalı).
 *
 * Bellek içi, süreç başına: IP + müşteri no başına 5 dakikada 30 istek, IP başına 5 dakikada 120 istek. Bir restoranın bütün
 * telefonları aynı IP'den (iş yeri Wi-Fi) çıkabilir; sınırlar buna göre geniş tutuldu.
 */
const PENCERE_MS = 5 * 60 * 1000;
const SINIR_ANAHTAR = 30;
const SINIR_IP = 120;
const EN_COK_KAYIT = 20000;
const sayaclar = new Map();
function say(anahtar, sinir, simdi) {
    const liste = (sayaclar.get(anahtar) || []).filter((t) => simdi - t < PENCERE_MS);
    if (liste.length >= sinir) {
        sayaclar.set(anahtar, liste);
        return false;
    }
    liste.push(simdi);
    sayaclar.set(anahtar, liste);
    return true;
}
function temizle(simdi) {
    for (const [k, v] of sayaclar)
        if (!v.length || simdi - v[v.length - 1] >= PENCERE_MS)
            sayaclar.delete(k);
    // Hâlâ çok büyükse (saldırı): en eski kayıtlar atılır, bellek sınırsız büyümez
    if (sayaclar.size > EN_COK_KAYIT) {
        let fazla = sayaclar.size - EN_COK_KAYIT;
        for (const k of sayaclar.keys()) {
            if (fazla-- <= 0)
                break;
            sayaclar.delete(k);
        }
    }
}
let sonTemizlik = 0;
/** Saf denetim (test edilebilir): izin varsa true */
export function girisIzni(ip, musteriNo, simdi = Date.now()) {
    if (simdi - sonTemizlik > 60000 || sayaclar.size > EN_COK_KAYIT) {
        sonTemizlik = simdi;
        temizle(simdi);
    }
    const ipOk = say(`ip:${ip}`, SINIR_IP, simdi);
    const anahtarOk = say(`a:${ip}|${musteriNo}`, SINIR_ANAHTAR, simdi);
    return ipOk && anahtarOk;
}
export function girisSiniriSifirla() { sayaclar.clear(); }
export const adisyonGirisSiniri = (req, _res, next) => {
    const ip = String(req.ip || req.socket?.remoteAddress || "?").slice(0, 64);
    const no = String((req.body && (req.body.musteriNo ?? req.body.anahtar)) ?? req.query?.musteriNo ?? "").replace(/\s+/g, "").slice(0, 64).toLowerCase();
    if (girisIzni(ip, no))
        return next();
    next(new ApiError(429, "Çok fazla giriş denemesi. Birkaç dakika sonra tekrar deneyin."));
};
/**
 * Hatalı PIN kilidi cihaz (IP) bazında (Y5, 26.11.2026 denetimi): garson hesabı 5 hatada kilitleniyordu — müşteri no + garson adını
 * bilen biri başka bir yerden 5 yanlış PIN girip garsonu 15 dakika dışarıda bırakabiliyordu; kilit iletisi (423) de adın var olduğunu
 * ele veriyordu. Şimdi: aynı IP'den aynı garsona (ya da var olmayan ada) 5 hata → o IP 15 dk kilit; hesabın tamamı ancak çok sayıda
 * hatada (GARSON_HESAP_ESIK, farklı IP'lerden dağıtık deneme) kilitlenir. Anahtar PIN parmak izini içerir: yönetici PIN'i değiştirince
 * kilit kendiliğinden kalkar. Bellek içi, süreç başına.
 */
export const PIN_IP_ESIK = 5;
export const PIN_IP_KILIT_MS = 15 * 60 * 1000;
const pinHatalari = new Map();
const pinTemizle = (simdi) => {
    if (pinHatalari.size < 5000)
        return;
    for (const [k, v] of pinHatalari)
        if (v.kilitBitis < simdi && simdi - v.ilk > PIN_IP_KILIT_MS)
            pinHatalari.delete(k);
    if (pinHatalari.size > EN_COK_KAYIT) {
        let fazla = pinHatalari.size - EN_COK_KAYIT;
        for (const k of pinHatalari.keys()) {
            if (fazla-- <= 0)
                break;
            pinHatalari.delete(k);
        }
    }
};
export const pinKilidi = {
    kilitliMi(anahtar, simdi = Date.now()) {
        const v = pinHatalari.get(anahtar);
        return !!v && v.kilitBitis > simdi;
    },
    /** Hatalı deneme yazar; bu denemeyle kilitlendiyse true */
    hata(anahtar, simdi = Date.now()) {
        pinTemizle(simdi);
        let v = pinHatalari.get(anahtar);
        if (!v || (v.kilitBitis && v.kilitBitis <= simdi) || simdi - v.ilk > PIN_IP_KILIT_MS)
            v = { sayi: 0, ilk: simdi, kilitBitis: 0 };
        v.sayi++;
        if (v.sayi >= PIN_IP_ESIK) {
            v.kilitBitis = simdi + PIN_IP_KILIT_MS;
            v.sayi = 0;
        }
        pinHatalari.set(anahtar, v);
        return v.kilitBitis > simdi;
    },
    temizle(anahtar) { pinHatalari.delete(anahtar); },
    sifirla() { pinHatalari.clear(); },
};
