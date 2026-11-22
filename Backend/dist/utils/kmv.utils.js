/**
 * KMV uygulama şekli — fişe yazılan değer.
 *
 * Firma tanımındaki (TODVZ_TANIM.KMV_UYGULAMA_SEKLI) ve ekranlardaki anlam: 1 uygulanmasın, 2 kura dahil, 3 kurdan hariç.
 *
 * Fişteki (TODVZ_FIS.KMV_UYGULAMA_SEKLI) değeri ise sağlayıcının e-Döviz belge görünümleri (VODVZ_E_DOVIZ_BELGESI,
 * VODVZ_E_DOVIZ_BELGESI_XSLT, VODVZ_E_DOVIZ_BELGESI_NOTE) eski sürümün KMV_KURA_DAHIL biti gibi okur: yalnız 1 iken "K.M.V. Kura
 * dahildir" der ve ödenecek tutara KMV eklemez; 0 / 2 / 3 / boş iken KMV'yi ödenecek tutara ekler (19.11.2026'da aynı fişe sırayla
 * bu değerler yazılıp görünüm okunarak doğrulandı). e-Döviz gönderimi (ebelgeKaynak.service dovizGirdisi) ve belge çıktısı (belgeVeri)
 * tutarı bu görünümden alır.
 *
 * Bu yüzden "kura dahil" kaydedilen fişe 1 yazılır: 2 yazıldığında belgedeki ödenecek tutar, fişin ödeme tutarından KMV kadar fazla
 * çıkıyordu. "Uygulanmasın" (KMV tutarı 0) ve "kurdan hariç" değerleri olduğu gibi kalır.
 */
export const fisKmvKodu = (ekranSekli) => {
    const s = Number(ekranSekli);
    if (s === 2)
        return 1;
    return s === 1 || s === 3 ? s : 0;
};
