export const RAPOR_MENU = [
    { kod: "CARBAK1", yol: "cari-bakiye", ad: "Cari Bakiye Raporu", grup: "cari" },
    { kod: "CAREKS1", yol: "cari-ekstre", ad: "Cari Ekstre", grup: "cari" },
    { kod: "CARHAR1", yol: "cari-hareket-listesi", ad: "Cari Hareket Listesi", grup: "gizli" },
    { kod: "CARKRT1", yol: "cari-kart-listesi", ad: "Cari Kart Listesi", grup: "gizli" },
    { kod: "VEZBAK1", yol: "vezne-bakiye", ad: "Vezne Bakiye Raporu (Tarih Bazlı)", grup: "vezne" },
    { kod: "VEZHAR1", yol: "vezne-hareket-listesi", ad: "Vezne Hareket Listesi", grup: "vezne" },
    { kod: "VERKOM1", yol: "vergiler-komisyon", ad: "Vergiler ve Komisyon", grup: "raporlar" },
    { kod: "KARZAR1", yol: "kar-zarar", ad: "Kâr / Zarar Faaliyet Analizi", grup: "yonetici" },
    { kod: "FIRVAR1", yol: "firma-varliklari", ad: "Firma Varlıkları Raporu", grup: "yonetici" },
    { kod: "KASDEF1", yol: "kasa-defteri", ad: "Kasa Defteri", grup: "kasa" },
    { kod: "KASHAR1", yol: "kasa-hareket-listesi", ad: "Kasa Hareket Listesi", grup: "kasa" },
    { kod: "HESEKS1", yol: "hesap-ekstresi", ad: "Hesap Ekstresi", grup: "kasa" },
    { kod: "HESBAK1", yol: "hesap-bakiye", ad: "Hesap Bakiye Raporu", grup: "kasa" },
    { kod: "VEZANL1", yol: "vezne-bakiye-anlik", ad: "Vezne Bakiye Raporu (Anlık)", grup: "vezne" },
    { kod: "KURKON1", yol: "kur-sapma", ad: "Kur Sapma Raporu", grup: "vezne" },
    { kod: "POSEKS1", yol: "pos-ekstre", ad: "POS Ekstre", grup: "gizli" },
    { kod: "VADISL1", yol: "vadeli-islem-listesi", ad: "Vadeli İşlem Listesi", grup: "cari" },
    { kod: "FISLIS1", yol: "fis-listeleme", ad: "Fiş Listeleme", grup: "raporlar" },
    { kod: "GUNFIS1", yol: "gunluk-fis-detay", ad: "Günlük Fiş Detay Raporu", grup: "raporlar" },
    { kod: "ISTRAP1", yol: "istatistik-raporu", ad: "İstatistik Raporu", grup: "raporlar" },
    { kod: "ISTKMV1", yol: "istatistik-kmv", ad: "İstatistik Bazında KMV Raporu", grup: "raporlar" },
    { kod: "VERNUM1", yol: "vergi-numarasi-raporu", ad: "Vergi Numarası Raporu", grup: "raporlar" },
    { kod: "KARLIL1", yol: "karlilik", ad: "Kârlılık Raporu", grup: "raporlar" },
    { kod: "ALTISC1", yol: "altin-iscilik", ad: "Altın İşçilik Raporu", grup: "raporlar" },
    { kod: "PERDEG1", yol: "personel-degerlendirme", ad: "Personel Değerlendirme Raporu", grup: "raporlar" },
    { kod: "MSKMES1", yol: "masak-meslek", ad: "Meslek Bazında İşlem Listesi", grup: "masak" },
    { kod: "MSKSEK1", yol: "masak-sektor", ad: "Sektör Bazında İşlem Listesi", grup: "masak" },
    { kod: "MSKYAS1", yol: "masak-yas", ad: "Yaş Bazında İşlem Listesi", grup: "masak" },
    { kod: "MSKYUK1", yol: "masak-yuksek-tutar", ad: "Yüksek Tutarda İşlem Listesi", grup: "masak" },
    { kod: "MSKSUP1", yol: "masak-supheli", ad: "Şüpheli İşlem Listesi", grup: "masak" },
    { kod: "MSKKON1", yol: "masak-fis-kontrol", ad: "Şüpheli İşlemler Fiş Kontrol Listesi", grup: "masak" },
    { kod: "FIRSON1", yol: "firma-son-durum", ad: "Firma Son Durum Raporu", grup: "yonetici" },
    { kod: "LONSHO1", yol: "long-short-denge", ad: "Long / Short Denge Analizi", grup: "yonetici" },
    { kod: "KNSKLOG1", yol: "knsk-sorgulama-listesi", ad: "KNSK Sorgulama Log Listesi", grup: "masak" },
    { kod: "KURKON2", yol: "kur-kontrolu", ad: "Kur Kontrolü", grup: "vezne" },
    { kod: "BALURE1", yol: "barkodlu-altin-uretim", ad: "Barkodlu Altın Üretim Raporu", grup: "etiket" },
    { kod: "BALSAT1", yol: "barkodlu-altin-satis", ad: "Barkodlu Altın Satış Raporu", grup: "etiket" },
    { kod: "BALSTK1", yol: "barkodlu-altin-stok", ad: "Barkodlu Altın Stok Raporu", grup: "etiket" },
];
/** Rapor grubunun durduğu ana menü (DashboardRoute key); MASAK grubu G- Raporlar altındadır */
const GRUP_ANA_MENU = {
    cari: "cari",
    kasa: "kasa",
    vezne: "vezne",
    yonetici: "yonetici",
    raporlar: "raporlar",
    masak: "raporlar",
    etiket: "etiket",
};
/**
 * Raporun lisans (modül kataloğu) kodları: menüdeki maddesinin kodu "<ana menü>:raporlar/<yol>"
 * (src/config/modulKatalogu.ts menuOgesiKodu). Menüde olmayan (gizli) ya da bilinmeyen rapor için null: lisansla kısıtlanmaz.
 */
export const raporModulKodlari = (kod) => {
    const r = RAPOR_MENU.find((m) => m.kod === String(kod || "").toUpperCase());
    if (!r || r.grup === "gizli")
        return null;
    return [`${GRUP_ANA_MENU[r.grup]}:raporlar/${r.yol}`];
};
