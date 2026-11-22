/**
 * Alan kodu: eski programın alanı adlandırdığı biçim, veritabanı adının sonundaki "_dvz" atılmış hali
 * (R2026_dvz → R2026, A2026_dvz → A2026). Eşin adı da TODVZ_TANIM.DIGER_VERITABANI_ADI'nda böyle tutulur.
 * Arayüz (sekme başlığı, sağ üst rozet, Alan Değiştir) ve sunucu aynı kuralı kullanır.
 */
export const alanKodu = (dbName) => String(dbName || "").trim().replace(/_dvz$/i, "");
