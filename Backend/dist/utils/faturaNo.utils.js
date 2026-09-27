/**
 * GİB fatura numarası: 3 karakter seri + 4 hane yıl + 9 hane sıra (toplam 16), ör. ABC2026000000012.
 */
export const FATURA_NO_BICIMI = /^[A-Z0-9]{3}\d{13}$/;
export const faturaNoUret = (seri, yil, sira) => {
    if (!/^[A-Z0-9]{3}$/.test(seri))
        throw new Error(`Geçersiz seri: ${seri}`);
    if (!Number.isInteger(sira) || sira < 1 || sira > 999_999_999)
        throw new Error(`Geçersiz sıra: ${sira}`);
    return `${seri}${yil}${String(sira).padStart(9, "0")}`;
};
