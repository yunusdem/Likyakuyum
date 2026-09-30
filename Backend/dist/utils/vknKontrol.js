/**
 * VKN (10 hane) ve TCKN (11 hane) kontrol hanesi doğrulaması. İnternet gerektirmez;
 * yanlış yazılmış numara GİB'e hiç gönderilmez (docs/GIB_VKN_SORGU_YOL_HARITASI.md).
 */
/** Boşluk, nokta, tire vb. atılır; yalnız rakamlar kalır. */
export const noTemizle = (girdi) => String(girdi ?? "").replace(/\D/g, "");
/**
 * 99 ile başlayan 10 haneli numaralar yabancılara verilen potansiyel vergi numarasıdır; bu algoritmaya
 * uymazlar (örnek veride 13'ü de uymuyor), bu yüzden kontrol hanesine bakılmadan kabul edilir.
 */
export const vknGecerliMi = (vkn) => {
    if (!/^\d{10}$/.test(vkn))
        return false;
    if (vkn.startsWith("99"))
        return true;
    const d = vkn.split("").map(Number);
    let toplam = 0;
    for (let i = 0; i < 9; i++) {
        const tmp = (d[i] + 9 - i) % 10;
        let t = (tmp * 2 ** (9 - i)) % 9;
        if (tmp !== 0 && t === 0)
            t = 9;
        toplam += t;
    }
    return (10 - (toplam % 10)) % 10 === d[9];
};
export const tcknGecerliMi = (tckn) => {
    if (!/^[1-9]\d{10}$/.test(tckn))
        return false;
    const d = tckn.split("").map(Number);
    const tek = d[0] + d[2] + d[4] + d[6] + d[8];
    const cift = d[1] + d[3] + d[5] + d[7];
    const onuncu = (((tek * 7 - cift) % 10) + 10) % 10;
    if (onuncu !== d[9])
        return false;
    const ilkOnToplam = d.slice(0, 10).reduce((a, b) => a + b, 0);
    return ilkOnToplam % 10 === d[10];
};
/** Geçerliyse türü, değilse null döner. */
export const noTuru = (no) => {
    if (no.length === 10)
        return vknGecerliMi(no) ? "VKN" : null;
    if (no.length === 11)
        return tcknGecerliMi(no) ? "TCKN" : null;
    return null;
};
