# GİB 14.09.2026 Schematron uyum yol haritası

Kaynak: EDM'nin 11.09.2026 tarihli iş ortağı duyurusu. Bu belge uygulamadaki mevcut akışlarla duyuruyu karşılaştırır.

## Uygulanan

- e-İrsaliye `LicensePlateID`, GİB'in istediği `Shipment/ShipmentStage/TransportMeans/RoadTransport` yolundadır.
- Plaka/dorse bilgisi API, servis ve arayüzde zorunludur; boş, 50 karakterden uzun veya geçersiz karakterli değer reddedilir.
- Yerli/yabancı araç ve dorse için `PLAKA`, `DORSE`, `DORSEPLAKA`, `YABANCIPLAKA`, `YABANCIDORSE`, `YABANCIDORSEPLAKA` seçilebilir ve XML `schemeID` alanına aynen yazılır.
- Varsayılan değer geriye uyumluluk için `PLAKA`dır.

## Uygulanan fatura kuralları

- 233 ve 555 kodları kabul edilir; 555 kodu KDV 0 ile veya KAMU/YATIRIMTESVIK gibi özel senaryolu faturada kullanılırsa yerelde reddedilir.
- 308 ve 339 yalnızca `YATIRIMTESVIK` profilinde kabul edilir.
- IADE için `KAMU` profili desteklenir; duyurudaki izinli profil kısıtı uygulanır.
- `TEKNOLOJIDESTEK` yalnızca `EARSIVFATURA` profiliyle kabul edilir.

## Gider Pusulası operasyon kontrolü

- Depodaki 09.09.2026 tarihli EDM WSDL'sinde `send_egider_pusulasi` yalnızca `send_earsiv_request` alır; `erreceipt`, `AuthorizedWorkScope` ve `UserOptionCode` alanları bu gönderim sözleşmesinde yoktur.
- Bu nedenle belge XML'ine veya SOAP zarfına tanımsız alan eklenmedi. EDM hesabında `erreceipt` alias kullanılacaksa `AuthorizedWorkScope` tanımlanmamalı ve `UserOptionCode` 171-174 olmalıdır. Bu, EDM portalı/yetkilendirme ayarı olarak canlı geçiş kontrol listesine alınmıştır.

## Şu an kapsam dışı

- `SARJ`/`SARJANLIK` enerji faturaları mevcut fatura tipi ve ekranlarında yoktur. Kullanılacaksa InvoicePeriod, ESURaporID, alıcı PLAKA ve satır SerialID alanlarıyla yeni bir uçtan uca akış gerekir.
- IDIS profili/sevkiyat numarası mevcut uygulamada yoktur. IDIS kullanılacaksa `SE-0000000` ve `ES-0000000` kabul eden doğrulama eklenmelidir.

## Canlıya geçiş sırası

1. e-İrsaliye için altı plaka/dorse türünü EDM test ortamında ayrı ayrı doğrulayın.
2. İşletmenin enerji faturası, IDIS, yatırım teşvik veya `erreceipt` kullanıp kullanmadığını kesinleştirin.
3. Kullanılan akışlar için EDM'nin güncel WSDL/örnek XML ve test hesaplarıyla entegrasyon testi yapın.
4. Test ortamı Schematron sonucu başarılı olmadan canlı belge göndermeyin.
