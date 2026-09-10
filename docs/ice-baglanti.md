# ICE Teknoloji Entegratör Bağlantısı — Yol Haritası

## 10.09.2026 — Hızlı e-Belge revizyonu: güncel çalışma kaydı

Bu bölüm yeni kullanıcı isteğini ve bu çalışmada doğrulanan sonucu kaydeder. Aşağıdaki eski faz notları geçmiş kayıttır; tek başına tamamlanma kanıtı değildir.

**Kapsam:** Yalnız e-Belge ekranları, servisi, ICE adaptörleri ve e-Belge SQL katmanı. Diğer çalışanların modüllerine müdahale edilmez. Bağlantı ayarı test çalışmaları için şimdilik korunur. TEST etiketi tek başına ICE hesabının mali sonuç doğurmayan bir ortam olduğunu kanıtlamaz; bu çalışmada dışarı belge gönderilmedi.

### Yapılacaklar

1. [x] Mevcut kesilmiş faturaların SQL başlık/satır tablolarını, belge türlerini, cari ilişkisini ve benzersiz kaynak kimliğini salt okunur incelemeyle doğrula. Kaynak tablolara yazmadan e-Belge gönderim kaydıyla eşle.
2. [x] TC/VKN mükellef sorgusunu oluşturma ekranına ekle; başarılı olumsuz sorguda e-Arşiv, olumlu sorguda e-Fatura seç. Sorgu hatasını olumsuz mükellefiyet sayma.
3. [x] Ünvanla cari seçimi üzerinden TC/VKN çözümle; aynı ünvandaki carilerde kullanıcıya seçim sun.
4. [x] Kaynak belgeleri tarih, numara, tür ve gönderim durumuna göre listele; seçili belgelerde sonuç ve hata açıklamasını ayrı göster. Gönderilmedi durumu, e-Belge kaydı bulunmayan kaynak belgeyi de kapsıyor.
5. [x] Gelen/giden kutularında desteklenen belge türlerini ayrıştır; mevcut olmayan servis desteğini varmış gibi gösterme.
6. [x] e-Gider oluşturma ekranını mevcut gider pusulası servisine bağla; e-İrsaliye akışını koru.
7. [x] Toplu gönderimde kaynak belge için yinelenen gönderimi önle. GONDERILIYOR/BELIRSIZ durumlarında otomatik yeniden gönderme; önce ICE sonucunu sorgula. Kesin hata, gönderildi ve henüz gönderilmedi ayrımını koru.
8. [x] SQL test kopyası ve taklit ICE yanıtlarıyla kaynak eşleme, kısmi hata, mükellef sorgu hatası ve tekrar gönderim senaryolarını doğrula.

### Bu çalışmada yapılanlar

**Oluşturma ve mükellef sorgusu**

- `EBelgeHomePage.tsx` (`/e-belge` ekranı): kartlar kullanıcının belirttiği sıraya alındı —
  Gelen Kutusu, Giden Kutusu, e-Fatura / e-Arşiv Oluştur, e-İrsaliye Oluştur, e-Gider Oluştur,
  Kesilmiş Belgeleri Gönder, Bağlantı Ayarları. Üst şeritteki tek "E- Belge" bağlantısı korundu;
  `Header.tsx` e-Belge kapsamı dışıdır, değiştirilmedi.
- `EBelgeDogrulaPage.tsx`: TC/VKN mükellef sorgusu eklendi. Sorgu sırasında form kilitlenir; önceki doğrulama ve açık gönderim onayı temizlenir. Başarılı sorgu uygun senaryoyu seçer; yeniden belge doğrulaması gerekir.
- `EBelgeDogrulaPage.tsx`: mükellef sorgusu **otomatikleştirildi**. TCKN/VKN 10-11 haneye ulaşınca
  sorgu kendiliğinden çalışır (600 ms gecikmeli), sonuç e-Fatura/e-Arşiv senaryosunu seçer.
  Numara değişip sorgu sonuçlanmadıysa tür **belirsiz** sayılır: ekranda uyarı çıkar ve
  taslak/gönderim düğmeleri kapanır. Geç dönen eski sorgu yeni sonucu ezmez (sıra numarası),
  aynı numara için otomatik sorgu tekrarlanmaz. Elle **Mükellef Sorgula** düğmesi yeniden deneme
  için duruyor. Sorgu hatası hâlâ "mükellef değil" sayılmaz.
- `ebelge.service.ts`: `mukellefSorgula` ICE başarısız yanıtını hata olarak döndürür; boş kullanıcı listesi üzerinden yanlış e-Arşiv yönlendirmesi yapılmaz.
- `EBelgeCariSec.tsx`: **ad soyad** ile cari arama (TC/VKN ile de aranabilir). Aynı ad soyada sahip
  birden fazla cari otomatik seçilmez, kullanıcıya listelenir; seçilen carinin TC/VKN, adres,
  il/ilçe ve vergi dairesi forma aktarılır.
  **Sınır:** ICE'nin mükellef sorgusu (`getUserList_EFatura`) yalnız `search_Identifier` alanını,
  yani TC/VKN'yi kabul eder. Ad soyadla doğrudan GİB sorgusu yapılamaz. Bu yüzden akış
  ad soyad → yerel cari kartı → TC/VKN → ICE mükellef sorgusu şeklindedir. Cari kartı olmayan
  müşteride TC/VKN elle girilmelidir.

**Kesilmiş faturaların kaynak akışı**

- Kaynak: `VODVZ_GONDERIME_HAZIR_E_BELGE` görünümü (başlık), `VODVZ_E_FATURA_SATIRI` (satır), `VODVZ_SARRAF_FISI` (cari/adres), `VODVZ_E_BELGE_TANIMI` (KDV istisna kodu). Kaynak tablolara **yazılmaz**.
- Benzersiz kaynak kimliği: `EVRAK_TURU:BELGE_ID:BELGE_TURU`. Bu anahtar yeni `TODVZ_EBELGE_KAYNAK` tablosunda tutulur; e-Belge tarafına aittir, ERP tablolarına dokunmaz.
- `ebelgeKaynak.repository.ts`: listeleme (arama, tür, tarih, durum, sayfalama) ve detay; `reserve` tek işlemde `GONDERILIYOR` yer tutar. Yalnız `HATA` durumundaki kayıt yeniden alınabilir; eşzamanlı ikinci gönderim çakışma hatası alır.
- `ebelgeKaynak.service.ts`: kaynak → UBL girdisi eşlemesi, `hazirla` (mükellef sorgusu + ICE doğrulaması) ve `gonder`.
- Gönderim öncesi durduran kontroller: fatura dışı belge türü, eski sistemde ETTN/işlem/hata kaydı, belge no biçimi (3 harf + 13 rakam), TL dışı para kodu, satır yokluğu, birim kodu, satır tutar/KDV yeniden hesaplaması, başlık toplamı ile satır toplamı farkı, giden kutusunda aynı belge no.
- Hazırlama ile gönderim arasında kaynak değişirse (`sha256` parmak izi) veya alıcının mükellefiyeti değişirse gönderim durur.
- Gönderim hatasında: giden kaydı oluşmuşsa `KONTROL_GEREKLI`, oluşmamışsa `HATA`. `KONTROL_GEREKLI` otomatik yeniden gönderilmez.
- `EBelgeKaynakPage.tsx`: kaynak belgeleri listeler, hazırlananlar ile hatalı olanları ayrı gösterir, toplu gönderimde her belgenin sonucunu satır bazında yazar.

**Kutular ve diğer ekranlar**

- `EBelgeGidenPage.tsx`: belge türü ve tarih filtreleri; seçili e-Fatura taslaklarını satır bazında sonuç göstererek gönderme.
- `EBelgeGelenPage.tsx`: kapsam notu eklendi — gelen kutusu yalnız gelen e-Fatura'yı kapsar; gelen e-İrsaliye ayrı ekranda, e-Arşiv ve e-Gider yalnız giden türlerdir.
- `EBelgeGiderPage.tsx`: e-Gider oluşturma mevcut gider pusulası servisine bağlandı; gönderim öncesi yerel kontrol ve sunucunun hesapladığı toplam gösterilir, ardından açık onay istenir. e-İrsaliye akışı değiştirilmedi.

### Doğrulama

- `Backend/scripts/ebelge-kaynak-test.ts` (yeni, 10 test): kaynak eşleme, tutar/KDV/belge no/döviz/birim reddi, KDV istisna kodu, mükellefe göre e-Fatura/e-Arşiv seçimi, mükellef sorgu hatası, kaynak veya mükellefiyet değişikliği, tekrar gönderim engeli, `KONTROL_GEREKLI`/`HATA` ayrımı, parmak izi. Gerçek SQL ve gerçek `fetch` test içinde bilerek yasaklandı.
- Mevcut çevrimdışı takımlar (`ebelge-faz8`, `ebelge-irsaliye`, `ebelge-giderpusulasi`, `ebelge-ubl-mali`): 79 test geçti.
- Frontend ve backend `tsc --noEmit` temiz.
- SQL şeması, yedekten açılan ayrı bir inceleme veritabanında salt okunur incelendi. Canlı SQL'e ve canlı ICE'ye belge gönderilmedi.

### Açık noktalar

- Yedekteki fiş tabloları boş olduğu için kaynak eşlemesi gerçek veriyle değil, şema ve kontrollü örneklerle doğrulandı. Canlı veriyle ilk kullanımda **önce tek belge** gönderilmeli.
- e-Döviz kapsam dışı (kullanıcı onayı). Görseller yalnız listeleme/seçim örneği olarak alındı.
- Bağlantı ayarı ekranı test çalışmaları için korunuyor; canlıya geçişte kaldırılacak.
- Tarayıcı üzerinden uçtan uca ekran testi yapılmadı; §17 kontrol listesi hâlâ geçerli.


---

> **Durum:** Uygulama sürüyor; Faz 8 yeniden incelendi, tamamlanmış sayılmıyor · **Tarih:** 09.09.2026
> **Son çalışma:** Faz 8a gönderim/iptal güvenliği ve ekran eksikleri düzeltildi. 19 çevrimdışı test geçti.
> **Kapsam:** Yalnızca e-Belge (ICE). Kullanıcı uygulamayı ve Faz 8 incelemesini onayladı. Uygulama aşamasında
> yalnızca §14'teki "Dokunulacak Dosyalar" listesine müdahale edilir. Diğer ekip arkadaşlarının
> üzerinde çalıştığı modüllere (vezne, kasa, kur, cari, pano, MASAK, banknot, auth) **dokunulmaz**.

---

## 1. Amaç

Ana menüdeki **E-Belge** bölümünü, entegratör olarak **ICE Teknoloji**'ye bağlamak:

1. **Gelen belgeler** — GİB üzerinden firmamıza gelen e-Faturaları listelemek, görüntülemek
   (HTML/PDF), **kabul/red cevabı** vermek, okundu/işlendi statüsü işlemek.
2. **Giden belgeler** — kendi UBL-TR XML'imizi üretip ICE üzerinden e-Fatura göndermek,
   statüsünü takip etmek, çıktısını almak.
3. Sıra: **e-Fatura → e-Belge (e-Arşiv / e-SMM / e-Müstahsil) → e-İrsaliye**.

**Karar (09.09.2026, kullanıcı):**
- UBL-TR XML'i **kendimiz üreteceğiz** (`send_invoice`). `Send_Easy_Document` kullanılmayacak.
- Gelen kutusu ve giden fatura **paralel** ilerleyecek.
- **Canlı hesap var, test ortamı yok** → tüm doğrulama, mali sonuç doğurmayan uçlarla
  (`invoice_check_validate`, `send_invoice_taslak` + `DraftCancel`) yapılacak. Bkz. §10.

---

## 2. Kapsam Sınırları

### Kapsam içi
- Yeni backend modülü: `ebelge` (routes / controller / service / repository / ICE SOAP istemcisi / UBL üreteci)
- Yeni SQL tabloları: `TODVZ_EBELGE_*` (bkz. §6)
- Yeni frontend sayfaları: `/e-belge` altı (gelen kutusu, giden kutusu, ayarlar)
- Yeni frontend servisi: `src/services/ebelgeService.ts`
- `Backend/src/routes/index.ts` içine **tek satır** router kaydı
- `src/App.tsx` (veya ilgili route dosyası) içine **route kayıtları**
- `Backend/package.json` içine **tek bağımlılık**: `fast-xml-parser` (karar #6)

### Kapsam dışı (dokunulmayacak)
- Vezne, kasa, kur, pano, cari, para, banknot, MASAK, numaratör, istatistik, yazıcı modülleri
- `auth.middleware.ts`, `mssql.config.ts`, `env.config.ts`, `apiClient.ts`, `app.ts`
  → §11.2'de bu dosyalarda **tespit edilen güvenlik bulguları raporlanır, düzeltme yapılmaz**;
  düzeltme kararı ilgili dosyanın sahibine bırakılır.
- Mevcut fiş / dekont ekranlarının kendisi. Bizim çıktımız net bir sözleşme (endpoint + tablo);
  fiş ekranlarından "faturalaştır" bağlantısını başka arkadaş kuracak.

---

## 3. Kaynaklar ve Sahada Doğrulanan Bulgular

Yol haritası yazılmadan önce elimizdeki iki paket ve WSDL gerçekten açılıp incelendi.

| Kaynak | Ne çıktı |
|---|---|
| `ICE_INTAGRATION_v1.0.3` | Tam WinForms örnek istemci. **`Connected Services/ICESVC/integration.wsdl` (116 KB)** → sözleşmenin kendisi. `UBL/CREATE_INVOICE.cs`, `UBL/UBLTR-Invoice-2_1.cs`, `UBL/UBLTR-Delivery-2_1.cs`, `UBL/CreditNote.cs` → **UBL üreteci referansımız**. `Models/Login.cs` + `Models/Global_Varible.cs` → oturum deseni. |
| `ICEIntegrationClient_v1.0.0` | **e-Defter** yükleme istemcisi (REST + parçalı upload, RestSharp). **Kapsam dışı (karar #12)** — bu projede kullanılmayacak. |
| **Canlı WSDL** *(09.09.2026 çekildi)* | `docs/ice/integration-2026-09-09.wsdl` — **100 operasyon**. Tek bağlayıcı sözleşme budur. |

### Kritik teknik bulgular

1. **✅ Canlı WSDL çekildi (09.09.2026) — elimizdeki paket çok eskiymiş.**
   `https://integration.iceteknoloji.com.tr/integration.asmx?wsdl` → HTTP 200, **339 KB**,
   `docs/ice/integration-2026-09-09.wsdl` olarak kaydedildi.

   | | Operasyon sayısı |
   |---|---|
   | Paketteki WSDL (v1.0.3, 2020) | **35** |
   | Canlı WSDL (09.09.2026) | **100** |
   | Eskide olup canlıda kaldırılan | **0** — geriye dönük uyumlu |

   **65 yeni operasyon** var. Bunların bir kısmı sizin verdiğiniz dokümantasyon sayfalarında da
   yoktu; yani **tek doğru kaynak bu WSDL**. Öne çıkanlar §3.1'de.

   > **Not:** WSDL içindeki `soap:address` hâlâ `http://` yazıyor, ama servis `https://` üzerinden
   > sorunsuz cevap verdi. Biz `https` kullanacağız (§11.1 S11).

2. **Oturum modeli:** `Login(UserName, Password, Application_Name, Application_Version)` →
   dönen `Login_Request_Header { Session_ID, IP_Number, Security_Key }` **her çağrıda** gövdeye
   konuyor. Yani bearer token değil, **gövde içi oturum**. `Logout` ile kapatılıyor.
   Örnek istemci bunu statik global'de tutuyor (`Models/Global_Varible.cs`).
   → Bizde **süreç-içi tekil oturum yöneticisi** + otomatik yeniden giriş gerekecek (§5.2).

3. **`IP_Number` sunucudan geliyor**, biz üretmiyoruz. Ama ICE tarafında oturum IP'ye bağlanıyor.
   → Bulut backend ile yerel agent (`local-agent/server.js`, port 25050) **farklı IP'den** çıkar.
   Bu, IP kısıtı varsa iki modun ayrı davranmasına yol açar. Faz 0'da ICE'ye sorulacak (Açık Karar #2).

4. **Zaman aşımı örnekte 15 saniye** (`app.config`: `sendTimeout="15" receiveTimeout="15"`),
   mesaj boyutu **100 MB**. Bizim Express `json` limitimiz **10 MB** (`Backend/src/app.ts:21`).
   → PDF/liste çağrılarında çakışma riski; bkz. §11.1 S10.

5. **`GetInvoice` (gelen kutusu) arama anahtarı** WSDL'den birebir:
   `LIMIT / ID / UUID / FROM / TO / START_DATE / END_DATE / READ_INCLUDED / DIRECTION / SENDER / RECEIVER`
   \+ `HEADER_ONLY`. Her opsiyonel alanın yanında **`...Specified` boolean'ı** var (.NET üreteci alışkanlığı).
   → Ham SOAP yazarken `LIMITSpecified`, `START_DATESpecified`, `END_DATESpecified`,
   `READ_INCLUDEDSpecified` alanları **doğru set edilmezse filtre sessizce yok sayılır.** Kritik tuzak.

6. **`HEADER_ONLY`** `string` tipinde (boolean değil) → `"true"` / `"false"` metni gönderilecek.
   `HEADER_ONLY=true` ile liste çekmek, `CONTENT` (base64 UBL) olmadan **çok daha hafif**.
   Liste ekranı bunu kullanacak; detay açılınca tek belge tam çekilecek.

7. **`INVOICEHEADER`** hazır alanlar veriyor: `SENDER, RECEIVER, SUPPLIER, CUSTOMER, ISSUE_DATE,
   PAYABLE_AMOUNT, PROFILEID, INVOICE_TYPE_CODE, STATUS, STATUS_DESCRIPTION, GIB_STATUS_CODE,
   GIB_STATUS_DESCRIPTION, RESPONSE_CODE, RESPONSE_DESCRIPTION, FILENAME, HASH, CDATE, ENVELOPE_IDENTIFIER`.
   → **Liste ekranı için UBL parse etmeye gerek yok.** UBL'i sadece detay/arşiv için açacağız.

8. **`invoice_check_validate`** belgeyi **göndermeden** şema + schematron doğruluyor ve
   HTML/PDF önizleme döndürüyor. → Canlı hesapla güvenli test yolumuz bu (§10.3).

9. **`send_invoice_taslak` + `send_draft_document_approval(DraftCancel)`** ikilisi, canlıda
   mali sonuç doğurmadan uçtan uca hat testi imkânı veriyor. `documentType` enum'u
   dokümantasyonda **`EDoviz_Satim` / `EDoviz_Alim` / `EAdisyon`** da içeriyor.

10. **e-Döviz fırsatı:** Bu ERP bir **döviz/kuyumcu** sistemi (`TODVZ_*` tabloları, vezne, kur, para).
    ICE'de `send_edoviz` / `send_edoviz_basic` (Yetkili Müessese Döviz Alım/Satım Belgesi) var ve
    alan seti bizim veri modelimize **birebir oturuyor**: `Doviz_Kodu, TL_Karsilik_Kuru, Doviz_Miktar,
    Komisyon_*, Vezne, Kiymetli_Maden_Bilgileri (Kiymetli_Maden_Adi, Adet)`.
    → **Bu, projenin asıl e-belge ihtiyacı olabilir.** §9 Faz 10 olarak eklendi, karar kullanıcının.

11. **Fault modeli** metin tabanlı: `TIMEOUT / ERROR / FORMAT / NOTFOUND / EXISTS / AUTHORIZATION`.
    SOAP Fault olarak dönüyor; ayrıca HTTP 200 + `success=false` de mümkün.
    → **İki katmanlı hata çözümü** gerekli (§5.4).

12. **Örnek istemcide `http://`** kullanılıyor (`app.config`). Kimlik bilgileri düz HTTP'de gider.
    → Bizde **https zorunlu** (§11.1 S11).

### 3.1 Canlı WSDL'de bulunan, planı değiştiren operasyonlar

| Operasyon | Ne işe yarıyor | Plana etkisi |
|---|---|---|
| **`Health`** | Parametresiz, **oturum gerektirmiyor**, `string` döner | "Bağlantı test" ucu artık `Login` denemeden servisin ayakta olup olmadığını görebilir → boşuna `Login` deneyip **hatalı deneme sayacını** şişirmeyiz (§11.1 S12) |
| **`Get_Credit`** | Sadece `Login_Request_Header` alıyor, kontör/kota tablosu döner | **Kontör bitince fatura gitmez.** Ayar ekranında kalan kontör gösterilecek, kritik seviyede uyarı verilecek. Bunu bilmeden canlıya çıkmak riskliydi |
| **`GetInvoice_Count`, `Get_EDocument_Count`, `GetDespatchAdvice_Count`** | Aynı arama anahtarıyla **sadece adet** döner (`int`) | Gelen kutusu sayfalaması artık doğru kurulabilir: önce sayı, sonra sayfa sayfa çekim. Eskiden hepsini çekip saymak gerekiyordu |
| **`Get_Son_Belge_ID`** (`Seri`, `Belge_Turu`, `Yil`) · **`Get_EDocument_OtoSeri`** · **`EDocument_OtoSeri_Tanimla`** | Belge seri/sıra numarasını **ICE tarafında** yönetiyor | **Numaratör çakışması riskini kökten çözebilir** (§12'deki "aynı fatura no iki kez" riski). Kendi numaratörümüzle ICE'nin son numarasını karşılaştırma adımı Faz 5'e eklendi |
| **`Get_Document_List`, `Get_EDocument_Detail_List`, `GetInvoice_List_Detail`, `Get_EDocument_Archive`** | Belge listeleme/arşivin yeni ve daha zengin sürümleri | Faz 3'te eski `GetInvoice` yerine bunlar değerlendirilecek |
| **`Get_EDocument_Envelope`, `Set_EDocument_Envelope_Status`** | GİB zarf takibi | Gönderim sonrası "zarf nerede takıldı" sorusunun cevabı |
| **`Send_Document_Email`** | Belgeyi alıcıya mail atma | e-Arşiv fazında (8a) müşteriye mail gönderimi |
| **`send_eDekont`, `send_eDekont_iptal`, `Get_eDekont_HTML_PDF`** | **e-Dekont** | Projede zaten `CariEmanetDekontPage.tsx` var → **doğrudan ilgili olabilir**, Faz 9 sonrası e-Döviz ile birlikte sorulacak |
| **`send_eAdisyon`, `send_ekomisyon_gider_belgesi`** | e-Adisyon, e-Komisyon Gider Belgesi | Şimdilik kapsam dışı |
| **`Set_Musteri_Cari`, `Get_Musteri_Cari_List`, `Set_Musteri_Stok`, `Get_Musteri_Stok_List`, `GetKullaniciMusterileri`** | ICE tarafında cari ve stok senkronizasyonu | **Kapsam dışı** — bizim carimiz kendi SQL'imizde. Ama ICE portalıyla eşleşme istenirse buradan yapılır, not olarak duruyor |
| **`getUserList_EFatura`** (+`_Detail`) | Eski `getUserList_EFatrura` (yazım hatalı) hâlâ duruyor, **doğru yazımlısı da eklenmiş** | Yeni yazımı kullanacağız; ikisi de canlıda mevcut |
| **`GetProducerReceipt`, `GetSelfEmployedReceipt`, `Set_ProducerReceipt_Status`, `Set_SelfEmployedReceipt_Status`** | **Gelen** e-Müstahsil / e-SMM | Faz 8b ve 8c artık sadece gönderim değil, gelen taraf da yapılabilir |
| e-Döviz tam seti: `send_edoviz`, `send_edoviz_basic`, `send_edoviz_iptal`, `preview_edoviz_basic`, `Get_EDoviz_Status`, `GetEDoviz`, `GetEDoviz_XML_PDF`, `Get_Incoming_EDoviz` | Yetkili Müessese döviz belgesi — **8 operasyonluk tam set** | Faz 10 (ertelendi, karar #8). Gördüğümüz kadarıyla ICE bu tarafı olgun desteklemiş |

**`Belge_Turu` enum'u (canlı WSDL'den birebir):**
`EFatura` · `EArsiv` · `EMustahsil` · `ESMM` · `EDoviz` · `EAdisyon` · `EGiderPusulasi` ·
`EIrsaliye` · `EIrsaliyeYanit`

> **Sonuç:** Faz 0'ın en riskli maddesi kapandı. Kod **bu WSDL'e** göre yazılacak, paketteki
> 2020 sürümüne göre değil.

---

## 4. Mimari Karar ve Hedef Akış

**Karar: SOAP çağrıları yalnızca backend'den yapılır.** Frontend ICE'yi hiç görmez, ICE kimlik
bilgileri tarayıcıya hiç inmez. Frontend sadece kendi REST API'mizle konuşur.

**Karar #10: Yalnızca bulut sunucu ICE'ye bağlanır.** Yerel agent (`local-agent`, port 25050)
ICE'ye hiç çıkmaz — tek çıkış IP'si olur, IP kısıtı sorunu doğmaz. Yerel modda e-Belge ekranları
"bu işlem yalnızca çevrimiçi modda kullanılabilir" uyarısı verir.

```
┌─────────────────────────────────────────────────────────────────────────┐
│ FRONTEND   /e-belge/gelen · /e-belge/giden · /e-belge/ayarlar           │
│   ebelgeService.ts  →  apiClient (mevcut, dokunulmaz)                   │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │  REST  /api/v1/e-belge/*
┌──────────────────────────────▼──────────────────────────────────────────┐
│ BACKEND  (bulut API veya yerel agent — aynı Backend/dist/app.js)        │
│  ebelge.routes → ebelge.controller → ebelge.service                     │
│      ├─ ice.client.ts       SOAP zarf kur / gönder / fault çöz          │
│      ├─ ice.session.ts      Login-Logout, oturum önbelleği, yeniden giriş│
│      ├─ ubl/invoiceBuilder  UBL-TR 1.2 Invoice XML üretimi              │
│      └─ ubl/invoiceParser   gelen CONTENT (base64 UBL) → özet alanlar   │
└───────────┬──────────────────────────────────────┬──────────────────────┘
            │ HTTPS SOAP 1.1                       │ mssql (getDbPool)
┌───────────▼────────────────────┐   ┌─────────────▼──────────────────────┐
│ ICE  integration.asmx          │   │ MSSQL  TODVZ_EBELGE_AYAR           │
│  Login / GetInvoice /          │   │        TODVZ_EBELGE_GELEN          │
│  invoice_Red_Kabul /           │   │        TODVZ_EBELGE_GIDEN          │
│  send_invoice / ...            │   │        TODVZ_EBELGE_LOG            │
└────────────────────────────────┘   │        TODVZ_EBELGE_MUKELLEF       │
                                     └────────────────────────────────────┘
```

**Neden yerel ayna tablo (`TODVZ_EBELGE_GELEN/GIDEN`) tutuyoruz?**
- ICE'ye her ekran açılışında sorgu atmamak (oturum ve kota tüketimi),
- İnternet yokken son durumu görebilmek,
- Kim ne zaman kabul/red etti — **denetim izi** (mali sorumluluk doğuran işlem),
- Fiş/cari ekranlarının başka bir arkadaş tarafından bağlanabileceği sabit bir tablo.

---

## 5. ICE Protokol Özeti (uygulama notları)

### 5.1 Uç noktalar
| Ortam | Adres |
|---|---|
| Canlı | `https://integration.iceteknoloji.com.tr/integration.asmx` |
| Test | `https://integrationtest.iceteknoloji.com.tr/integration.asmx` *(hesap var — 10.09.2026 tarihinde bağlantı testi ve Get_Credit başarılı)* |
| PDF dönüştürücü | `https://pdf.iceteknoloji.com.tr/converter.asmx` *(kapsam dışı, gerekirse)* |
| Easy | `.../easy_integration.asmx` *(kullanılmayacak — karar #1)* |

SOAP 1.1, `Content-Type: text/xml; charset=utf-8`, **`SOAPAction: "http://tempuri.org/<Metod>"`**
başlığı **zorunlu** (yoksa sunucu metodu çözemez).

### 5.2 Oturum yönetimi (`ice.session.ts`)
- `Login` → `{Session_ID, IP_Number, Security_Key}` bellekte tutulur (**DB'ye yazılmaz**).
- Her çağrıya `Login_Request_Header` olarak enjekte edilir.
- `AUTHORIZATION` faultu veya `isSuccecss=false` → **bir kez** otomatik yeniden `Login`, sonra çağrı tekrarı.
  **Yeniden deneme yalnızca okuma (idempotent) çağrılarında.** `send_invoice`, `invoice_Red_Kabul`,
  `send_earsiv` gibi yazma çağrıları **asla otomatik tekrarlanmaz** (§11.1 S8).
- Aynı anda birden çok istek gelirse tek `Login` yapılsın diye **in-flight promise kilidi**.
- Süreç kapanışında `Logout` — kendi `process.once("SIGTERM"/"SIGINT")` dinleyicimizle;
  `server.ts` dosyasına **dokunulmaz**.
- `Login_Response.Exception_Type.Number_Of_Incorrect` → **hatalı deneme sayacı**; ICE hesabı
  kilitlenebilir. Bu sayı 0'dan büyükse **otomatik yeniden denemeyi durdur** ve ekrana taşı.

### 5.3 Çok kiracılılık
Her firma kendi ICE kullanıcı adı/şifresi ile çalışır. Oturum önbelleği anahtarı:
`${dbServer}:${dbName}:${iceUserName}`. Mevcut `getDbPool(dbServer, dbName)` deseni birebir izlenir
(`Backend/src/models/banknotSql.repository.ts` referans).

### 5.4 Hata çözümü (iki katman)
| Katman | Nasıl gelir | Nasıl karşılanır |
|---|---|---|
| SOAP Fault | `<soap:Fault>` + faultcode `TIMEOUT/ERROR/FORMAT/NOTFOUND/EXISTS/AUTHORIZATION` | `ApiError` eşlemesi: AUTHORIZATION→401, NOTFOUND→404, EXISTS→409, FORMAT→422, TIMEOUT→504, ERROR→502 |
| İş kuralı | HTTP 200 + `success=false` / `response_code` / `response_message` | `ApiError.badRequest(response_message)`; `shema_is_validate` / `schematron_is_validate` ayrıca kullanıcıya gösterilir |

### 5.5 Kullanılacak operasyonlar (faz bazında)
| Faz | Operasyonlar |
|---|---|
| Altyapı | `Health` *(oturumsuz)*, `Login`, `Logout`, `Get_Credit` *(kontör)* |
| Gelen | `GetInvoice_Count`, `GetInvoice`, `Get_Invoice_Status`, `Get_Invoice_Status_Detail`, `GetInvoice_HTML`, `GetInvoice_PDF`, `invoice_Red_Kabul`, `Set_Invoice_Status`, `GetDocumentDetails` |
| Giden | `Get_Son_Belge_ID` *(numara kontrolü)*, `invoice_check_validate`, `send_invoice_taslak`, `send_draft_document_approval`, `send_invoice`, `Get_Invoice_Status_Detail_List`, `GetInvoice_XML_List`, `GetInvoice_PDF_List`, `Get_EDocument_Envelope` |
| Mükellef | `getUserList_EFatura`, `getUserList_EFatura_Detail`, `getUserList_ZipFile` |
| e-Arşiv | `send_earsiv`, `send_earsiv_iptal`, `send_aktarilan_earsiv_iptal`, `preview_invoice`, `Send_Document_Email`, `GetInvoice_EMail_Statu`, `GetInvoice_Rapor_Statu`, `GetEArchive`, `Set_EArchive_Status` |
| e-SMM | `send_esmm`, `send_esmm_iptal`, `GetESMM_XML_PDF`, `GetESMM_XML_PDF_List`, `GetSelfEmployedReceipt`, `Set_SelfEmployedReceipt_Status` |
| e-Müstahsil | `send_emustahsil`, `send_emustahsil_iptal`, `producerreceipt_check_validate`, `GetProducerReceipt`, `Set_ProducerReceipt_Status` |
| e-Gider Pusulası | `send_egider_pusulasi`, `Get_EGiderPusulasi_HTML_PDF` |
| e-İrsaliye | `send_DespatchAdvice`, `GetDespatchadvice`, `Get_DespatchAdvice_Status`, `Set_DespatchAdvice_Status`, `send_ReceiptAdvice`, `GetReceiptAdvice`, `despatchadvice_check_validate` |
| e-Döviz *(ertelendi — karar #8)* | `send_edoviz_basic`, `send_edoviz` |

---

## 6. Veri Modeli

Tüm tablolar, ev standardı gereği repository içindeki `ensureTablesExist()` ile **yoksa otomatik
oluşturulur** (`banknotSql.repository.ts` deseni). Metin alanları `NVARCHAR` (unvanlarda
Türkçe/yabancı karakter var).

### 6.1 `dbo.TODVZ_EBELGE_AYAR` — bağlantı ayarları
| Kolon | Tip | Açıklama |
|---|---|---|
| `ID` | INT IDENTITY PK | |
| `ORTAM` | VARCHAR(10) | `CANLI` / `TEST` |
| `SERVIS_URL` | VARCHAR(300) | allowlist ile doğrulanır (§11.1 S6) |
| `KULLANICI_ADI` | NVARCHAR(100) | |
| `SIFRE_SIFRELI` | VARBINARY(MAX) | **AES-256-GCM**, anahtar `EBELGE_ENC_KEY` env'den |
| `SIFRE_IV` / `SIFRE_TAG` | VARBINARY(16) | |
| `UYGULAMA_ADI` / `UYGULAMA_SURUM` | VARCHAR(50) | `Login` parametreleri |
| `FIRMA_VKN` | VARCHAR(11) | `from_vkn_tckn` — varsayılan `TODVZ_TANIM.VERGI_KIMLIK_NO` |
| `FIRMA_ALIAS` | NVARCHAR(150) | `from_alias` (GİB posta kutusu etiketi) |
| `AKTIF` | BIT | |
| `GUNCELLEYEN` / `GUNCELLEME_TARIHI` | NVARCHAR(50) / DATETIME | denetim |

> Şifre **hiçbir durumda** API cevabında dönmez; `sifreTanimli: true/false` olarak maskelenir.

### 6.2 `dbo.TODVZ_EBELGE_GELEN`
`UUID` (PK, ETTN), `BELGE_NO`, `YON` (`GELEN`), `BELGE_TURU` (`EFATURA/EIRSALIYE/...`),
`PROFIL` (`TEMELFATURA/TICARIFATURA/...`), `SENDER`, `RECEIVER`, `SUPPLIER`, `CUSTOMER`,
`DUZENLEME_TARIHI`, `TUTAR`, `PARA_BIRIMI`, `GIB_STATU_KODU`, `GIB_STATU_ACIKLAMA`,
`STATU`, `STATU_ACIKLAMA`, `OKUNDU_MU`, `ISLENDI_MI`, `RED_KABUL` (`NULL/Kabul/Red`),
`RED_KABUL_ACIKLAMA`, `RED_KABUL_TARIHI`, `RED_KABUL_KULLANICI`, `ZARF_ID`, `HASH`,
`XML_ICERIK` (NVARCHAR(MAX), opsiyonel arşiv), `CEKILME_TARIHI`.

**Benzersiz indeks:** `UUID`. **İndeks:** `(DUZENLEME_TARIHI DESC)`, `(RED_KABUL)`, `(SENDER)`.

### 6.3 `dbo.TODVZ_EBELGE_GIDEN` — **uygulanan hâli**

`UUID` (PK — e-Arşivde gönderim öncesi üretilen ETTN; ICE yanıtıyla eşleşmesi aranır;
taslakta eski davranış korunur), `BELGE_NO`,
`BELGE_TURU` (`EFatura` / `EArsiv`), `PROFIL`, `FATURA_TIPI`, `TASLAK_MI` (BIT),
`ALICI_VKN`, `ALICI_ALIAS`, `ALICI_UNVAN`, `DUZENLEME_TARIHI`, `TUTAR`, `PARA_BIRIMI`,
`GONDERIM_DURUMU` (`HAZIRLANDI` / `DOGRULANDI` / `TASLAK` / `GONDERILIYOR` / `GONDERILDI` /
`BELIRSIZ` / `IPTAL_EDILIYOR` / `IPTAL_BELIRSIZ` / `IPTAL` / `HATA`),
`SEMA_GECERLI`, `SCHEMATRON_GECERLI`, `ICE_RESPONSE_CODE`, `ICE_RESPONSE_MESAJ`,
`GIB_STATU_KODU`, `GIB_STATU_ACIKLAMA`, `KAYNAK_FIS_ID` (fiş/dekont bağlantısı —
diğer geliştirici için ayrılmış, henüz kullanılmıyor), `XML_ICERIK`,
`OLUSTURAN`, `OLUSTURMA_TARIHI`, `GONDEREN`, `GONDERIM_TARIHI`,
**`IPTAL_TARIHI`**, **`IPTAL_EDEN`** *(plan aşamasında yoktu, Faz 6'da eklendi)*.

**Benzersiz indeks:** `UX_TODVZ_EBELGE_GIDEN_NUMARA (BELGE_NO)` — tarih değiştirilerek numara tekrar kullanılamaz.
Eski `(BELGE_NO, DUZENLEME_TARIHI)` indeksi korunur fakat tek başına yeterli değildir.
Yeni indeks mevcut veritabanına `ensureTablesExist` ile eklenir. Tekrarlı numara varsa veri silinmez;
kurulum hata verir, gönderim durur ve ICE kayıtlarıyla mutabakat gerekir. Kurulum hataları artık yutulmaz.
e-Arşiv kaydı ICE yazma çağrısından **önce** eklenir. Durumlar: `GONDERILIYOR`, `GONDERILDI`,
`HATA`, `BELIRSIZ`, `IPTAL_EDILIYOR`, `IPTAL_BELIRSIZ`, `IPTAL`.
SQL'in 2601/2627 hatası servis katmanında **409**'a çevrilir.
**İndeks:** `(OLUSTURMA_TARIHI DESC)`.

### 6.4 `dbo.TODVZ_EBELGE_LOG` — SOAP denetim kaydı
`ID`, `TARIH`, `METOD`, `YON`, `ISTEK_OZET` (**maskeli**), `CEVAP_OZET` (**maskeli**),
`BASARILI` (BIT), `FAULT_KODU`, `HATA_MESAJI`, `SURE_MS`, `KULLANICI`, `ILGILI_UUID`.

> `Session_ID`, `Security_Key`, `Password` ve base64 belge gövdeleri **loglanmaz** (§11.1 S2).

### 6.5 `dbo.TODVZ_EBELGE_MUKELLEF` — planlandı, oluşturulmadı
Mükellef sorgusu doğrudan ICE'ye gider; aşağıdaki yapı yalnızca olası gelecek tasarımıdır.
`VKN_TCKN`, `ALIAS`, `UNVAN`, `TIP`, `HESAP_TIPI`, `OLUSTURMA_ZAMANI`, `CEKILME_TARIHI`.
**PK:** `(VKN_TCKN, ALIAS)`. Amaç: "bu müşteriye e-Fatura mı e-Arşiv mi keseceğim" sorusunu
her seferinde ICE'ye sormadan cevaplamak.

---

## 7. Backend Tasarımı

### 7.1 Yeni dosyalar (hepsi yeni — mevcut dosya değiştirilmez)
```
Backend/src/routes/ebelge.routes.ts
Backend/src/controllers/ebelge.controller.ts
Backend/src/services/ebelge.service.ts
Backend/src/services/ice/ice.client.ts           SOAP zarf + HTTP + fault çözümü
Backend/src/services/ice/ice.session.ts          Login/Logout, önbellek, yeniden giriş
Backend/src/services/ice/ice.types.ts            WSDL'den türetilen tipler
Backend/src/services/ice/ubl/invoiceBuilder.ts   UBL-TR 1.2 Invoice üretimi
Backend/src/services/ice/ubl/invoiceParser.ts    gelen UBL → özet alanlar
Backend/src/models/ebelgeSql.repository.ts
Backend/src/schemas/ebelge.schema.ts             zod doğrulama
Backend/src/utils/crypto.utils.ts                AES-256-GCM şifre saklama
```
**Tek değişiklik:** `Backend/src/routes/index.ts` → import + `apiRouter.use("/e-belge", ebelgeRoutes);`

### 7.2 Endpoint sözleşmesi (`/api/v1/e-belge`) — **uygulanan hâli**

> Bu tablo 09.09.2026 itibarıyla **kodda gerçekten var olan** uçları gösterir.
> Plan aşamasındaki taslak tabloyla farkları vardır (yeni uçlar eklendi, adlar netleşti).

| Metod | Yol | Açıklama | Yetki | Faz |
|---|---|---|---|---|
| GET | `/ayar` | Ayarlar (şifre maskeli, `sifrelemeHazir` bayrağı ile) | admin/manager | 2 |
| PUT | `/ayar` | Ayarları kaydeder | admin/manager | 2 |
| POST | `/ayar/test` | `Health` → `Login` → `Get_Credit` → `Logout` | admin/manager | 1-2 |
| GET | `/kontor` | `Get_Credit` — kalan kontör | admin/manager | 1 |
| GET | `/log` | Entegratör işlem kayıtları (maskeli) | admin/manager | 1 |
| POST | `/gelen/senkronize` | `GetInvoice_Count` + `GetInvoice(HEADER_ONLY)` → yerel ayna | kullanıcı | 3 |
| GET | `/gelen` | Yerel aynadan sayfalı liste | kullanıcı | 3 |
| GET | `/gelen/:uuid` | Detay (`?statuYenile=true` ile GİB statüsü tazelenir) | kullanıcı | 3 |
| GET | `/gelen/:uuid/goruntu` | `?format=html` (metin) veya `?format=pdf` (ikili akış) | kullanıcı | 3 |
| POST | `/gelen/:uuid/cevap` | `invoice_Red_Kabul` — **geri alınamaz** | **admin/manager** | 4 |
| POST | `/gelen/:uuid/statu` | `Set_Invoice_Status` (Okundu/İşlendi) | kullanıcı | 4 |
| POST | `/giden/dogrula` | `invoice_check_validate` — **gönderim yok** | kullanıcı | 5 |
| GET | `/giden/son-belge-no` | `Get_Son_Belge_ID` — numaratör çakışma kontrolü | kullanıcı | 5 |
| GET | `/mukellef` | `getUserList_EFatura` — alıcı mükellef mi? | kullanıcı | 6 |
| GET | `/giden` | Giden belge listesi (yerel) | kullanıcı | 6 |
| POST | `/giden/taslak` | `send_invoice_taslak` — **GİB'e gitmez** | **admin/manager** | 6 |
| POST | `/giden/:uuid/iptal` | `send_draft_document_approval` + `DraftCancel` | **admin/manager** | 6 |
| POST | `/earsiv/gonder` | `send_earsiv` — **mali sonuç doğurur** | **admin/manager** | 8a |
| POST | `/earsiv/:uuid/iptal` | `send_earsiv_iptal` — GİB'e iptal bildirimi | **admin/manager** | 8a |
| GET | `/earsiv/durum` | `GetInvoice_Rapor_Statu` + `GetInvoice_EMail_Statu` | kullanıcı | 8a |
| GET | `/earsiv/:uuid/pdf` | `preview_invoice` — PDF ikili akış | kullanıcı | 8a |

**Henüz açılmayan uçlar (bilinçli):** `send_invoice` (doğrudan GİB gönderimi) ve
`send_draft_document_approval` + **`DraftApproval`** (taslağı GİB'e iletme). İkisi de
Faz 7 kapsamındadır ve kullanıcının açık onayı olmadan yazılmayacaktır.

Cevap zarfı mevcut `ApiResponse` / `ApiError` sınıfları ile (ev standardı).
Tüm uçlar `authenticate` arkasında; mali sonuç doğuranlar ayrıca `authorizeRoles` ile.

### 7.3 SOAP istemcisi (`ice.client.ts`) — tasarım notları
- Node 18+ yerleşik `fetch` kullanılır; **yeni HTTP bağımlılığı yok**.
- İstek XML'i **elle şablonla** kurulur; her değer `escapeXml()` ile kaçışlanır (enjeksiyon koruması).
- Cevap ayrıştırma: **`fast-xml-parser`** (karar #6 — `Backend/package.json`'a eklenecek tek paket).
  `processEntities:false`, DTD desteği kapalı → **XXE koruması** (§11.1 S4).
- `AbortController` ile zaman aşımı: okuma 30 sn, gönderim 120 sn (örnekteki 15 sn çok dar).
- Her çağrı `TODVZ_EBELGE_LOG`'a maskeli yazılır.

### 7.4 UBL üreteci (`ubl/invoiceBuilder.ts`)
Referans: `ICE_INTAGRATION/UBL/CREATE_INVOICE.cs` + `UBLTR-Invoice-2_1.cs`.
Üretilecek asgari yapı: `UBLVersionID 2.1`, `CustomizationID TR1.2`, `ProfileID`
(`TEMELFATURA` / `TICARIFATURA` / `EARSIVFATURA`), `ID` (numaratörden — mevcut `numerator`
modülünden **okunur, değiştirilmez**), `UUID` (v4), `IssueDate/IssueTime`,
`InvoiceTypeCode` (`SATIS`/`IADE`/`TEVKIFAT`), `DocumentCurrencyCode`,
`AccountingSupplierParty` (`TODVZ_TANIM`'dan), `AccountingCustomerParty` (cari kaydından),
`TaxTotal` (KDV), `LegalMonetaryTotal`, `InvoiceLine[]`.

> **İmzalama bizde değil (karar #11).** Mali mührü ICE kendi tarafında atıyor; biz **imzasız UBL**
> göndeririz. Sunucumuzda mali mühür sertifikası (USB token / HSM) **bulunmayacak** —
> saklama ve koruma sorumluluğu bize geçmiyor. UBL üreteci `<cac:Signature>` bölümü üretmez.

---

## 8. Frontend Tasarımı

| Dosya | Durum | İçerik |
|---|---|---|
| `src/pages/ebelge/EBelgeHomePage.tsx` | yeni | `/e-belge` hub sayfası — Gelen / Giden / Ayarlar kartları (karar #16) |
| `src/services/ebelgeService.ts` | yeni | Tüm uçların tipli sarmalayıcısı (`masakService.ts` deseni) |
| `src/pages/ebelge/EBelgeGelenPage.tsx` | yeni | Gelen kutusu grid'i, filtre, "Senkronize et", satır → detay |
| `src/pages/ebelge/EBelgeGidenPage.tsx` | yeni | Giden kutusu grid'i, statü yenileme, çıktı al |
| `src/pages/ebelge/EBelgeDetayModal.tsx` | yeni | HTML önizleme (**sandbox'lı iframe**, §11.1 S5) + Kabul/Red |
| `src/pages/settings/EBelgeSettingsPage.tsx` | yeni | ICE bağlantı ayarları + "Bağlantıyı test et" |
| `src/App.tsx` | **yalnızca satır ekleme** | `/e-belge/*` route kayıtları — mevcut satırlar değişmez |
| `src/layouts/header/Header.tsx` | **dokunulmaz** | `E- Belge → /e-belge` linki zaten var (satır 67-70) |
| `src/routes/DashboardRoute.tsx` | **dokunulmaz** | Sol menüye dal eklenmiyor (karar #16) |
| `src/components/common/ERPToolbar.tsx` | **dokunulmaz** | Başlık `pageTitle` prop'u ile veriliyor |

Arayüz kuralları **§15 Arayüz Uyum Kılavuzu**'nda ölçülerek yazıldı: kullanıcı teması değişkenleri,
sabit ERP paleti, `ERPToolbar` düzeni, yeniden kullanılacak bileşenler ve yasaklar.
Her frontend fazının kabul kriterine **§15.8 uyum ölçütü** dahildir.

**Kabul/Red ekranı kuralı:** Geri alınamaz işlem. İki adımlı onay + Red seçilirse açıklama zorunlu
+ işlemi yapan kullanıcı ve saat ekranda görünür.

---

## 9. Fazlar ve Kabul Kriterleri

| Faz | İş | Kabul kriteri |
|---|---|---|
| **0. Hazırlık** *(kod yok)* — **✅ büyük kısmı bitti** | ~~Canlı WSDL çekimi~~ ✅ · ~~IP kısıtı kararı~~ ✅ · ~~imzalama kararı~~ ✅ · ~~e-Defter kapsamı~~ ✅ · geriye: `EBELGE_ENC_KEY` üretimi ve ICE hesap bilgisinin güvenli teslimi | WSDL `docs/ice/integration-2026-09-09.wsdl` kayıtlı; kararlar #9-#12 verildi |
| **1. SOAP altyapısı** | `ice.client.ts`, `ice.session.ts`, `ice.types.ts`, fault eşlemesi, log tablosu, `Health` + `Get_Credit` | `POST /e-belge/ayar/test` → `Health` cevap veriyor, `Login` başarılı, **kalan kontör görülüyor**, `Logout` temiz; log tablosunda maskeli kayıt; yanlış şifreyle `AUTHORIZATION` → 401 |
| **2. Ayarlar** | `TODVZ_EBELGE_AYAR`, şifreleme, ayar ekranı | Şifre DB'de düz metin **değil**; API cevabında şifre yok; ayar kaydedip test geçiyor |
| **3. Gelen kutusu — okuma** *(paralel)* | `GetInvoice(HEADER_ONLY=true)` → senkronizasyon, liste ekranı, detay, HTML/PDF | Son 30 günün gelen faturaları listeleniyor; `...Specified` bayrakları doğru → tarih filtresi gerçekten çalışıyor; PDF açılıyor |
| **4. Gelen kutusu — aksiyon** | `invoice_Red_Kabul`, `Set_Invoice_Status` | Ticari faturaya kabul/red gidiyor; `Get_Invoice_Status` ile doğrulanıyor; denetim kaydı yazılıyor; çift tıklama ikinci istek üretmiyor |
| **5. UBL üreteci + doğrulama** *(paralel)* | `invoiceBuilder.ts` + `POST /giden/dogrula` | `invoice_check_validate` → `shema_validate=true` **ve** `schematron_validate=true`; dönen HTML önizleme ekranda doğru görünüyor. **Hiçbir belge gönderilmedi.** |
| **6. Taslak hattı** | `send_invoice_taslak` + `DraftCancel` | Canlıda taslak oluşuyor, ETTN dönüyor, `DraftCancel` ile iptal ediliyor; mali sonuç doğmadı |
| **7. Canlı gönderim** | `send_invoice`, statü takibi, çıktı | Gerçek fatura gidiyor; `Get_Invoice_Status_Detail` ile GİB statüsü izleniyor; idempotency koruması çalışıyor |
| **8a. e-Arşiv** | `send_earsiv`, `send_earsiv_iptal`, `preview_invoice`, `GetInvoice_EMail_Statu`, `GetInvoice_Rapor_Statu`, `GetEArchive` | Mükellef olmayan alıcıya e-Arşiv kesiliyor; iptal bildirimi gidiyor; mail ve rapor statüsü izleniyor |
| **8b. e-SMM** | `send_esmm`, `send_esmm_iptal`, `GetESMM_XML_PDF` | Serbest meslek makbuzu gönderiliyor, iptal ediliyor, çıktısı alınıyor |
| **8c. e-Müstahsil** | `send_emustahsil`, `send_emustahsil_iptal` | Müstahsil makbuzu gönderiliyor ve iptal ediliyor |
| **8d. e-Gider Pusulası** | `send_egider_pusulasi` | Vergi mükellefi olmayan kişiden alımda gider pusulası gönderiliyor |
| **9. e-İrsaliye** | `send_DespatchAdvice`, `GetDespatchadvice`, yanıt ve statüler | İrsaliye gönderiliyor, gelen irsaliyeye yanıt üretiliyor |
| **10. e-Döviz** *(ertelendi)* | `send_edoviz_basic` | **Faz 9 bittiğinde kullanıcıya sorulacak** (karar #8). O zamana kadar plana dahil değil |

Fazlar 3-4 ile 5-6-7 **paralel** yürür (kullanıcı kararı); ikisi de Faz 1-2'ye bağlıdır.

---

## 10. Test Senaryoları

Canlı hesap var, test ortamı yok → **test stratejisi mali sonuç doğurmama üzerine kurulu.**

### 10.1 Birim testleri (ağ yok)
| # | Test | Beklenen |
|---|---|---|
| B1 | `escapeXml` — unvanda `&`, `<`, `"`, Türkçe karakter | Zarf geçerli XML, veri bozulmuyor |
| B2 | Fault eşlemesi — 6 fault kodu | Doğru HTTP kodu + Türkçe mesaj |
| B3 | Log maskeleme — `Session_ID`, `Security_Key`, `Password`, base64 gövde | Hiçbiri log çıktısında yok |
| B4 | `...Specified` bayrakları — sadece `START_DATE` verildiğinde | `START_DATESpecified=true`, diğerleri `false` |
| B5 | UBL üreteci — bilinen bir örnek girdi | Referans XML ile alan alan eşleşiyor |
| B6 | Şifreleme — AES-256-GCM tur testi | Şifrele/çöz aynı değeri veriyor; bozuk tag → hata |
| B7 | Idempotency anahtarı — aynı `(BELGE_NO, TARIH)` iki kez | İkincisi 409 |

### 10.2 Entegrasyon testleri (sahte SOAP sunucusu)
| # | Test | Beklenen |
|---|---|---|
| E1 | `AUTHORIZATION` faultu sonrası tek yeniden giriş | 2 `Login`, 2 iş çağrısı; sonsuz döngü yok |
| E2 | `send_invoice` sırasında `AUTHORIZATION` | **Yeniden denenmez**, hata yukarı taşınır |
| E3 | `TIMEOUT` | 504, log'da `SURE_MS` dolu |
| E4 | 60 MB PDF cevabı | Bellek taşmıyor / anlamlı hata |
| E5 | Eşzamanlı 10 istek, oturum yokken | Tek `Login` (kilit çalışıyor) |
| E6 | `Number_Of_Incorrect > 0` | Otomatik yeniden deneme durur, ekrana taşınır |

### 10.3 Canlı — güvenli sıra (mali sonuç yok)
| # | Adım | Beklenen |
|---|---|---|
| C1 | `Login` / `Logout` | Başarılı |
| C2 | `getUserList_EFatrura` bilinen bir VKN ile | Alias listesi geliyor |
| C3 | `GetInvoice` `HEADER_ONLY=true`, `LIMIT=5` | Başlıklar geliyor, `CONTENT` boş |
| C4 | `invoice_check_validate` (üretilen UBL) | `shema_validate` + `schematron_validate` true |
| C5 | `send_invoice_taslak` | ETTN dönüyor |
| C6 | `send_draft_document_approval` = `DraftCancel` | Taslak iptal, **GİB'e gitmedi** |
| C7 | *(onay sonrası)* tek gerçek fatura | Statü izleniyor |

> **C4-C6 arası her adım kullanıcı onayıyla, tek tek, kayıt tutularak koşulur.**
> Toplu/otomatik gönderim testi **yapılmaz**.

### 10.4 Güvenlik testleri
| # | Test | Beklenen |
|---|---|---|
| G1 | Gelen UBL içinde XXE payload (`<!ENTITY SYSTEM "file:///...">`) | Entity çözülmüyor, dosya okunmuyor |
| G2 | `GetInvoice_HTML` içinde `<script>` | Çalışmıyor (sandbox iframe) |
| G3 | Token'sız `POST /gelen/:uuid/cevap` | 401 — **`NODE_ENV` boşken de** (bkz. §11.2 M1) |
| G4 | Yetkisiz rol ile gönderim | 403 |
| G5 | `SERVIS_URL` = `http://saldirgan.example` | Allowlist reddediyor |
| G6 | Log dosyasında şifre/oturum araması | Sonuç yok |

---

## 11. Güvenlik Analizi

### 11.1 Bu modülde alınacak önlemler

| # | Risk | Önlem |
|---|---|---|
| **S1** | ICE şifresi DB'de düz metin | AES-256-GCM, anahtar `EBELGE_ENC_KEY` env'de; DB yedeği çalınsa bile şifre açılmaz. API cevabında asla dönmez |
| **S2** | `Session_ID` / `Security_Key` sızması → başkası bizim adımıza fatura keser | Bellekte tutulur, DB'ye ve log'a yazılmaz, frontend'e gönderilmez; log maskeleme zorunlu |
| **S3** | Oturumun IP'ye bağlı olması | **Çözüldü (karar #10):** yalnızca bulut sunucudan bağlanılacak, tek çıkış IP'si. Yerel agent ICE'ye hiç çıkmaz |
| **S4** | **XXE / XML bombası** — gelen `CONTENT` bize dışarıdan geliyor | DTD ve entity çözümü kapalı parser; belge boyutu üst sınırı; derinlik sınırı |
| **S5** | **XSS** — `GetInvoice_HTML` çıktısı üçüncü tarafın ürettiği HTML | `dangerouslySetInnerHTML` **yasak**. `<iframe srcdoc sandbox="allow-popups">` — `allow-same-origin` **verilmez**; ayrıca CSP |
| **S6** | **SSRF** — `SERVIS_URL` ayardan geliyor | Allowlist: yalnızca `*.iceteknoloji.com.tr` + `https` şeması |
| **S7** | Mali sonuç doğuran uçların herkese açık olması | `authorizeRoles` ile ayrı yetki; kabul/red ve gönderim ayrı yetkiler |
| **S8** | **Çift gönderim / çift fatura** | `(BELGE_NO)` benzersiz indeks; e-Arşivde gönderim öncesi kalıcı rezervasyon ve iptal öncesi atomik durum geçişi; yazmalarda otomatik retry yok. Taslak hattında rezervasyon sırası hâlâ ayrı takip işidir. |
| **S9** | Red/Kabul geri alınamaz | İki adımlı onay, Red'de açıklama zorunlu, `TODVZ_EBELGE_GELEN` + `_LOG`'a kullanıcı/saat |
| **S10** | Boyut çakışması: ICE 100 MB, Express `json` 10 MB (`Backend/src/app.ts:21`) | PDF/XML uçları base64'ü gövdede taşımaz; `Content-Type: application/pdf` ile **stream** edilir. `app.ts` değiştirilmez |
| **S11** | Örnek istemci `http://` kullanıyor | Yalnızca `https://`; `http` şeması ayar doğrulamasında reddedilir |
| **S12** | Şifre denemesi ile ICE hesabının kilitlenmesi | `Number_Of_Incorrect > 0` görülür görülmez otomatik denemeler durur |

### 11.2 Mevcut kodda tespit edilen bulgular — **rapor, düzeltme yok**

> Bu dosyalar başka ekip arkadaşlarının sorumluluğunda; talimat gereği **dokunulmadı**.
> Ancak e-Belge modülü mali sonuç doğurduğu için bu bulguları bilerek ilerlemek gerekiyor.

| # | Bulgu | Kanıt | e-Belge açısından etkisi |
|---|---|---|---|
| **M1** | `NODE_ENV` tanımsız veya `development` ise, **token olmadan gelen istek otomatik `admin` sayılıyor** | `Backend/src/middlewares/auth.middleware.ts:23-35` | Bu haliyle e-Belge uçları kimlik doğrulamasız fatura gönderebilir. **En kritik bulgu.** Yerel agent `NODE_ENV=production` set ediyor (`local-agent/server.js:20`), ama bulut tarafında ortam değişkeni kaybolursa açık kalır |
| **M2** | **Veritabanı şifresi JWT içinde taşınıyor** | `Backend/src/services/auth.service.ts:65-66, 102-103`; `Backend/src/types/auth.types.ts:11-12` | JWT imzalıdır ama **şifreli değildir** — base64 çözülünce SQL şifresi okunur. ICE şifresini **aynı yolla taşımayacağız** (S1) |
| **M3** | JWT gizli anahtarlarının kaynak kodda varsayılanı var | `Backend/src/config/env.config.ts` (`JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` `.default(...)`) | `.env` yoksa herkes geçerli token üretebilir → M1 ile birleşince yetkilendirme tamamen devre dışı kalır |
| **M4** | CORS varsayılanında `*` mevcut | `Backend/src/config/env.config.ts` (`CORS_ORIGIN` default) | Tarayıcıdan çapraz origin istek; kimlik doğrulama zayıfsa etki büyür |
| **M5** | Hız sınırlayıcılar **tamamen pasif** | `Backend/src/middlewares/rateLimiter.middleware.ts:9-16` | Login deneme sınırı yok; ICE oturumu ve kotası tüketilebilir (S12 ile ilişkili) |
| **M6** | `masak.routes.ts` router'a kaydedilmemiş | `Backend/src/routes/index.ts` içinde `masakRoutes` yok | Bu modülle ilgisiz, önceki analizde bulundu — bilgi amaçlı |

**Öneri:** Faz 1'e başlamadan önce M1 ve M3, ilgili dosyanın sahibiyle konuşulup kapatılmalı.
Kapatılmazsa e-Belge uçları, kendi `authorizeRoles` kontrolümüze rağmen `req.user` sahte
`admin` ile geldiği için korumasız kalır.

---

## 12. Riskler

| Risk | Olasılık | Etki | Önlem |
|---|---|---|---|
| ~~Elimizdeki WSDL eski, canlı sözleşme farklı~~ | — | — | **✅ Kapandı** — canlı WSDL çekildi ve sabitlendi (§3 bulgu 1) |
| **ICE kontörünün bitmesi** | Orta | **Yüksek** | `Get_Credit` ile Faz 1'den itibaren izleme + ayar ekranında uyarı |
| Test ortamı yok → canlıda hatalı belge | Orta | **Yüksek** | `invoice_check_validate` + taslak/`DraftCancel` zinciri (§10.3) |
| Schematron kuralları kuyumcu senaryolarında takılır | **Yüksek** | Orta | Faz 5 tamamen doğrulamaya ayrıldı; gönderim yok |
| ~~IP kısıtı yüzünden yerel agent bağlanamaz~~ | — | — | **✅ Kapandı** — karar #10: yalnızca bulut |
| Numaratör çakışması (aynı fatura no iki kez) | Düşük | **Yüksek** | Benzersiz indeks + `EXISTS` faultu + **`Get_Son_Belge_ID` ile ICE'deki son numaranın kontrolü** |
| ICE 15 sn zaman aşımı beklentisi, büyük listelerde yetmez | Orta | Düşük | Sayfalama + `HEADER_ONLY` + bizde 30/120 sn |
| e-Döviz / e-Dekont'un asıl ihtiyaç olması, e-Fatura'nın ikincil kalması | Orta | Orta | Faz 9 bitiminde kullanıcıya sorulacak (Açık Karar #1, #2) |

---

## 13. Kararlar

### Verilen kararlar (09.09.2026)
1. **UBL'i kendimiz üretiyoruz** (`send_invoice`); `Send_Easy_Document` kullanılmayacak.
2. **Gelen kutusu ve giden fatura paralel** ilerleyecek.
3. **Canlı hesap var, test ortamı yok** → §10.3'teki güvenli sıra uygulanacak.
4. SOAP çağrıları **yalnızca backend**'den yapılacak; ICE kimlik bilgileri tarayıcıya inmeyecek.
5. Bu belge onaylanmadan **kod yazılmayacak**.
6. **XML ayrıştırma: `fast-xml-parser`** eklenecek (`Backend/package.json`). Elle ayrıştırma
   yapılmayacak. Parser `processEntities:false` + DTD kapalı kurulacak (§11.1 S4).
7. **Faz 8 kapsamı dört belge türünü de içerir:** e-Arşiv, e-SMM, e-Müstahsil, e-Gider Pusulası.
   Faz 8a → 8b → 8c → 8d sırasıyla ilerlenir.
8. **e-Döviz ertelendi.** Faz 9 (e-İrsaliye) tamamlandığında kullanıcıya tekrar sorulacak;
   o ana kadar plana dahil değil, kod yazılmayacak.
9. **✅ Canlı WSDL sabitlendi** — `docs/ice/integration-2026-09-09.wsdl` (100 operasyon).
   Kod bu dosyaya göre yazılacak; paketteki 2020 sürümü yalnızca UBL üreteci için referans.
10. **Yalnızca bulut sunucudan bağlanılacak.** Yerel agent (`local-agent`, port 25050) ICE'ye
    **hiç çıkmayacak**. Tek çıkış IP'si olur; IP kısıtı sorusu bu kararla kapandı.
    → Yerel modda e-Belge ekranları "bu işlem yalnızca çevrimiçi modda kullanılabilir" der.
11. **Mali mührü ICE atıyor; biz imzasız UBL göndereceğiz.** Sunucumuzda mali mühür sertifikası
    (USB token / HSM) **bulunmayacak** — güvenlik yükü ve saklama sorumluluğu bize geçmiyor.
12. **Canlı testler en sona bırakıldı (09.09.2026).** ICE kimlik bilgisi gerektiren hiçbir çağrı
    faz faz denenmeyecek; kodlama bittiğinde **tek oturumda** §17'deki kontrol listesi koşulacak.
    Her faz kendi "canlıda doğrulanacak" maddelerini §17'ye ekler.
13. **Faz 7 (canlı gönderim) sıradan çıkarıldı (09.09.2026).** Kullanıcı kararı: canlıda
    test edilecek. `send_invoice` ve `send_draft_document_approval` + `DraftApproval`
    **hâlâ yazılmamıştır**; yazıldığında ayrıca bildirilecektir.
14. **e-Defter kapsam dışı.** `ICEIntegrationClient_v1.0.0` paketi bu projede kullanılmayacak.
15. **Mevcut ekranlara dokunulmayacak.** §16.2'deki arayüz sapmaları (MASAK'ta `ERPToolbar`
    kullanılmaması, sayfa kabı ölçü farkı, tekrarlanan `#bae6fd`, `$primary` çelişkisi)
    **rapor olarak kalır**, düzeltme dosya sahiplerine bırakılır. Biz yalnızca kendi
    dosyalarımızı yazarız.
16. **Sol menüye dal eklenmeyecek.** `src/routes/DashboardRoute.tsx` ve
    `src/components/common/ERPToolbar.tsx` **dokunulmaz**. Bunun yerine:
    - `/e-belge` adresine **kendi hub sayfamız** (`EBelgeHomePage.tsx`) konur; üst şeritteki
      mevcut "E- Belge" bağlantısı (`Header.tsx:67-70`) zaten buraya gidiyor — **şu an bu adres
      boş, yani bağlantı ölü**; hub sayfası onu da çalışır hale getirir.
    - Gelen / Giden / Ayarlar sayfalarına geçiş bu hub sayfasındaki kartlardan yapılır.
    - Toolbar başlığı `ROUTE_PAGE_MAP`'e satır eklemek yerine **`pageTitle` prop'u** ile verilir
      (§15.9). Böylece `ERPToolbar.tsx` hiç değişmez.

17. **Kapsam daraltıldı (10.09.2026, kullanıcı).** Şimdilik yalnızca **e-Fatura**,
    **e-Belge (e-Arşiv)** ve **e-İrsaliye** yapılacak. **e-SMM (8b)**, **e-Müstahsil (8c)**
    ve **e-Gider Pusulası (8d)** yönetici cevabı gelene kadar beklemede.
    Gider pusulası kodu §16.8'de yazıldı ve test edildi; **devrede değil**, karar gelince açılır.

### Açık kararlar (cevap bekliyor)
| # | Soru | Kime | Ne zaman |
|---|---|---|---|
| **1** | **e-Döviz** kapsama alınsın mı? (canlı WSDL'de 8 operasyonluk tam set var) | Kullanıcı | Faz 9 bitiminde |
| **2** | **e-Dekont** kapsama alınsın mı? Projede `CariEmanetDekontPage` zaten var, ICE'de `send_eDekont` mevcut | Kullanıcı | Faz 9 bitiminde |
| **3** | ICE **kontör/kota** durumu ne? (`Get_Credit` ile Faz 1'de kendimiz de görebiliriz) | Faz 1'de ölçülecek | Faz 1 |

---

## 14. Dokunulacak / Dokunulmayacak Dosyalar

> **Bu bölüm 09.09.2026 itibarıyla gerçekleşen durumu gösterir** (plan listesiyle farkları var).

### Oluşturulan uygulama dosyaları (12 backend + 7 frontend = 19)

**Backend**
```
src/utils/crypto.utils.ts                     AES-256-GCM şifre saklama
src/services/ice/ice.client.ts                SOAP zarfı, fault çözümü, maskeleme, allowlist
src/services/ice/ice.session.ts               Login/Logout, oturum önbelleği, kilit
src/services/ice/ice.types.ts                 WSDL'den türetilen tipler
src/services/ice/ice.efatura.ts               e-Fatura okuma/yazma + taslak + doğrulama
src/services/ice/ice.earsiv.ts                e-Arşiv gönderim/iptal/durum        (Faz 8a)
src/services/ice/ubl/invoiceBuilder.ts        UBL-TR 1.2 üreteci + tutar hesabı
src/models/ebelgeSql.repository.ts            4 tablo + erişim katmanı
src/schemas/ebelge.schema.ts                  zod doğrulama (ayar / doğrula / taslak)
src/services/ebelge.service.ts                iş kuralları
src/controllers/ebelge.controller.ts          denetleyici
src/routes/ebelge.routes.ts                   rotalar + yetki
```
> Plana göre farklar: `ice.efatura.ts` ve `ice.earsiv.ts` **eklendi** (planda yoktu);
> `ubl/invoiceParser.ts` **yazılmadı** — `INVOICEHEADER` zaten gerekli alanları verdiği için
> gelen UBL'i ayrıştırmaya gerek kalmadı (§16.3).

**Frontend**
```
src/services/ebelgeService.ts                 tipli API sarmalayıcısı
src/pages/ebelge/EBelgeHomePage.tsx           /e-belge hub sayfası
src/pages/ebelge/EBelgeGelenPage.tsx          gelen kutusu
src/pages/ebelge/EBelgeDetayModal.tsx         detay + kabul/red (sandbox iframe)
src/pages/ebelge/EBelgeDogrulaPage.tsx        doğrulama + taslak + e-Arşiv gönderimi
src/pages/ebelge/EBelgeGidenPage.tsx          giden kutusu + iptal
src/pages/settings/EBelgeSettingsPage.tsx     bağlantı ayarları + test + kontör
```

**Faz 8 denetiminde eklenen doğrulama dosyası:** `Backend/scripts/ebelge-faz8-test.ts`.
Bu dosya yukarıdaki 19 uygulama dosyasına dahil değildir. SQL ve ICE taklit edilerek çalışır.

### Değiştirilen (yalnızca satır ekleme, 3 dosya)
| Dosya | Değişiklik |
|---|---|
| `Backend/src/routes/index.ts` | import + `apiRouter.use("/e-belge", ebelgeRoutes);` — 2 satır |
| `Backend/package.json` | `dependencies` → `fast-xml-parser` ^5.11.1 — 1 satır |
| `src/App.tsx` | 3 import + 5 route satırı (`e-belge`, `e-belge/gelen`, `e-belge/dogrula`, `e-belge/giden`, `ayarlar/e-belge`, `tanimlar/e-belge`) |

### Oluşturulan SQL tabloları (uygulama ilk çalıştığında kendiliğinden)
`TODVZ_EBELGE_AYAR` · `TODVZ_EBELGE_GELEN` · `TODVZ_EBELGE_GIDEN` · `TODVZ_EBELGE_LOG`

> `TODVZ_EBELGE_MUKELLEF` (§6.5) **oluşturulmadı** — mükellef sorgusu doğrudan ICE'ye
> gidiyor ve şimdilik önbelleğe gerek görülmedi. Sorgu sayısı artarsa eklenecek.

### Hiç dokunulmayan dosyalar (doğrulandı)
`Backend/src/app.ts` · `server.ts` · `config/*` · `middlewares/*` · `services/auth.service.ts` ·
diğer tüm controller/service/repository dosyaları · `src/services/apiClient.ts` ·
`src/context/AuthContext.tsx` · `src/layouts/header/Header.tsx` · `src/routes/DashboardRoute.tsx` ·
`src/components/common/ERPToolbar.tsx` · `src/styles/*` ·
vezne / kasa / kur / cari / pano / MASAK / banknot ekranları

## 15. Arayüz Uyum Kılavuzu — "e-Belge sonradan eklenmiş gibi durmayacak"

Bu bölüm, mevcut ekranların kodundan **ölçülerek** çıkarıldı. Amaç: yeni e-Belge ekranları,
arkadaşların yazdığı vezne / cari / kur / banknot ekranlarının yanında **aynı programın parçası**
gibi görünsün. Yeni ekranlarda aşağıdakilerin dışına çıkılmayacak.

### 15.1 En kritik kural: kullanıcı teması

Projede **kullanıcı bazlı görünüm ayarı** var: `src/components/theme/UserThemeApplier.tsx`,
`TODVZ_KULLANICI` tablosundaki tercihleri okuyup `document.documentElement`'e CSS değişkeni yazıyor.
Kullanıcı `/ayarlar/kullanici-tanimlari` ekranından **kendi yazı tipini ve renklerini** seçebiliyor.

| Değişken | Ne renklendiriyor | Varsayılan |
|---|---|---|
| `--user-program-font` | Tüm uygulamanın yazı tipi | `Segoe UI, Inter, system` |
| `--user-program-bg` / `--user-program-text` | Sayfa zemini / metin | `#f8fafc` / `#0f172a` |
| `--user-window-bg` / `--user-window-text` | Kart, modal, form zemini / metni | `#ffffff` / `#0f172a` |
| `--user-window-focus` | Input odak rengi | `#3b82f6` |
| `--user-grid-bg` / `--user-grid-text` | Tablo gövdesi | `#ffffff` / `#0f172a` |
| `--user-grid-header-bg` / `--user-grid-header-text` | Tablo başlığı | `#cbe5ff` / `#0f172a` |
| `--user-grid-font` | Tablo yazı tipi | program fontunu miras alır |
| `--user-menu-selected-bg` | Menü seçili öğe + `--bs-primary` | `#0284c7` |

> **Kural:** Yeni ekranlarda **`font-family` hiç yazılmayacak.** `UserThemeApplier` zaten
> `html, body, #content, .card, .form-control, table` için font tanımlıyor; kendi fontumuzu
> yazarsak kullanıcının seçtiği yazı tipi bizim ekranda çalışmaz ve **tam olarak sırıtan yer orası olur**.
>
> Aynı şekilde `.card`, `.form-control`, `table` üzerine **`background-color` yazılmayacak** —
> global kural bunları kullanıcı rengine bağlıyor. `bg-white` sınıfı kullanmak **güvenli**,
> çünkü global CSS onu `var(--user-window-bg)` ile eziyor.

### 15.2 Sabit ERP paleti (tema dışı, her kullanıcıda aynı)

Bunlar `src/styles/_user.scss` ve mevcut sayfalardan **birebir** alındı. Yeni ekranlarda
bu değerlerin dışında renk kullanılmayacak.

| Rol | Renk | Nerede kullanılıyor |
|---|---|---|
| Vurgu / birincil | `#0284c7` | Odak kenarlığı, seçili metin, aktif ikon |
| Seçili satır zemini | `#bae6fd` · metin `#0369a1` | `table-active`, `lookup-selected-row` |
| Seçili satır + imleç | `#7dd3fc` | Aynı satır hover |
| Satır hover (seçili değil) | `#f8fafc` | Tablo gövdesi |
| Panel / şerit zemini | `#f8fafc` · kenar `#e2e8f0` | `.erp-action-toolbar-wrapper` |
| Buton (normal) | zemin `#ffffff` · kenar `#cbd5e1` · metin `#334155` | `.erp-tb-btn` |
| Buton (hover) | zemin `#f1f5f9` · kenar `#94a3b8` · metin `#0f172a` | `.erp-tb-btn:hover` |
| Buton (basılı) | `#e2e8f0` | `.erp-tb-btn:active` |
| Metin — koyu | `#0f172a` · orta `#334155` · soluk `#475569` / `#64748b` | Genel |
| Ayraç / çizgi | `#cbd5e1` · ince `#f1f5f9` | `.erp-tb-divider`, satır alt çizgisi |
| Olumlu | `#22c55e` · Olumsuz `#dc2626` | Toolbar ikonları, durum rozetleri |

**e-Belge'ye özel durum renkleri** (bu paletten türetildi, yeni renk icat edilmedi):

| Durum | Rozet |
|---|---|
| Beklemede / Okunmadı | `bg-secondary-subtle text-secondary` |
| Kabul edildi / Başarılı | `#22c55e` → `bg-success-subtle text-success` |
| Reddedildi / Hata | `#dc2626` → `bg-danger-subtle text-danger` |
| Taslak | `bg-warning-subtle text-warning` |
| Gönderildi / GİB'de | `#0284c7` → `bg-info-subtle text-info` |

### 15.3 Tipografi ve ölçüler (mevcut koddan)

| Öğe | Değer | Kaynak |
|---|---|---|
| Gövde yazı boyutu | `0.875rem` (14 px) | `_variables.scss:516` |
| Tablo başlık / hücre | `13 px`, başlık `font-weight:600` | `_user.scss` `.custom-document-table` |
| Küçük etiket / rozet | `12 – 12.5 px` | Banknot, MASAK sayfaları |
| Toolbar butonu | `32 × 30 px`, `border-radius: 4px` | `.erp-tb-btn` |
| Kart köşesi | `6 px` (`rounded-3` veya `style={{borderRadius:"6px"}}`) | Banknot, MASAK |
| Grid içi input köşesi | `2 px` | Banknot sayfası |
| İkon boyutu | menü `18` · toolbar `20` · sayfa başlığı `22` | ERPToolbar, DashboardRoute |

### 15.4 Sayfa iskeleti (birebir kopyalanacak)

```tsx
<div className="ebelge-gelen-container container-fluid px-2 py-2">
  <ERPToolbar
    pageTitle="A- E-Belge Gelen Kutusu"
    pageIcon={<IconFileCertificate size={22} className="text-primary" />}
    onRefresh={...} onSearch={...} onPrint={() => window.print()}
    disabled={loading}
  />

  {alertInfo && (
    <Alert variant={alertInfo.type} dismissible onClose={() => setAlertInfo(null)}
           className="py-2 px-3 mb-3 border rounded shadow-2xs small fw-medium">
      {alertInfo.message}
    </Alert>
  )}

  <Card className="shadow-sm border border-secondary-subtle rounded-3 overflow-hidden">
    <Card.Body className="p-3 bg-body">
      ...
    </Card.Body>
  </Card>
</div>
```

Sayfaya özel CSS gerekiyorsa, ev alışkanlığı gereği **sayfanın içine gömülü `<style>` bloğu**
olarak yazılır (Banknot sayfasındaki gibi). `src/styles/_user.scss` **paylaşılan dosyadır,
dokunulmayacak.**

### 15.5 ERPToolbar ve klavye kısayolları

Toolbar zaten global `F` tuşlarını dinliyor. e-Belge ekranlarında **aynı anlamlar** korunacak:

| Tuş | Anlam | e-Belge karşılığı |
|---|---|---|
| `F1` | Kaydet | Giden belge taslağını kaydet |
| `F2` | Sil | *(kullanılmaz — belge silinmez, iptal edilir)* |
| `F3` | Ara / Bul | Liste arama kutusuna odaklan |
| `F4` | Yeni | Yeni giden belge |
| `F5` | Yenile | ICE'den senkronize et |
| `F10` | Yazdır | Belgenin PDF/HTML çıktısı |

> **Kabul/Red `F` tuşuna bağlanmayacak.** Geri alınamaz işlem; yalnızca fare ile ve iki adımlı
> onayla yapılır (§8).

### 15.6 Yeniden kullanılacak hazır bileşenler — yenisi yazılmayacak

| İhtiyaç | Kullanılacak |
|---|---|
| Kayıt arama penceresi | `src/components/common/LookupModal.tsx` |
| Kod + ad seçim kutusu | `CodeLookupInput.tsx` / `ComboboxInput.tsx` |
| Veri tablosu + sayfalama | `components/table/TanstackTable.tsx`, `TablePagination.tsx`, `GlobalFilter.tsx` |
| Satır aksiyon menüsü | `common/ActionMenu.tsx` |
| İpucu balonu | `common/DasherTippy.tsx` |
| Enter ile sonraki alana geçiş | `hooks/useEnterNavigation.ts` |
| İkonlar | `@tabler/icons-react` *(başka ikon seti eklenmeyecek)* |

### 15.7 Yasaklar

1. Yeni **font ailesi / Google Fonts** eklenmeyecek.
2. Yeni **CSS framework / UI kütüphanesi** eklenmeyecek — Bootstrap 5 + react-bootstrap var.
3. `src/styles/_user.scss`, `theme/*` **düzenlenmeyecek** (paylaşılan dosyalar).
4. §15.2 dışında **hex renk yazılmayacak**.
5. `.card` / `table` / `.form-control` üzerine `font-family` veya `background-color` yazılmayacak.
6. `dangerouslySetInnerHTML` **kullanılmayacak** — ICE'den gelen HTML sandbox'lı `iframe`'e (§11.1 S5).

### 15.8 Kabul ölçütü

> e-Belge ekranının ekran görüntüsü, Cari Hareket veya Banknot Tanımları ekranının yanına
> konduğunda **hangisinin sonradan yazıldığı anlaşılmamalı.** Ayrıca kullanıcı
> `/ayarlar/kullanici-tanimlari`'ndan yazı tipini ve grid rengini değiştirdiğinde,
> e-Belge ekranları **diğer ekranlarla birlikte** değişmeli.

### 15.9 Menü kaydı — karar gerekiyor

`E- Belge` bağlantısı üst şeritte zaten var (`src/layouts/header/Header.tsx:67-70`, `/e-belge`).
Ama **alt sayfalar** (Gelen Kutusu / Giden Kutusu / Ayarlar) sol menüde görünsün isteniyorsa
`src/routes/DashboardRoute.tsx`'e menü dalı eklenmesi gerekir — bu dosya §14'te
**"dokunulmayacak"** listesinde. Ayrıca `ERPToolbar.tsx` içindeki `ROUTE_PAGE_MAP`'e
`/e-belge/*` satırları eklenmezse toolbar'da **sayfa başlığı boş görünür**
(bunu `pageTitle` prop'u ile de geçebiliriz, dosyaya dokunmadan).

→ **Karar #16 (09.09.2026):** Sol menüye dal eklenmeyecek, `ROUTE_PAGE_MAP`'e satır eklenmeyecek.
`/e-belge` adresine kendi **hub sayfamız** konur (üst şeritteki mevcut bağlantı zaten oraya gidiyor
ama adres şu an boş), alt sayfalara geçiş hub'daki kartlardan yapılır, toolbar başlığı `pageTitle`
prop'u ile verilir. Böylece `DashboardRoute.tsx` ve `ERPToolbar.tsx` hiç değişmez.

---

## 16. İlerleme Kaydı

*(Fazlar tamamlandıkça buraya işlenecek — MASAK yol haritasındaki §16 deseni.)*

| Faz | Durum | Tarih | Not |
|---|---|---|---|
| 0. Hazırlık | ✅ Bitti | 09.09.2026 | Canlı WSDL çekildi (100 operasyon); kararlar #6-#14 verildi |
| 1. SOAP altyapısı | ✅ Bitti | 09.09.2026 | Canlı `Health` çağrısı `"OK"` döndü (200 ms). Bkz. §16.3 |
| 2. Ayarlar | ✅ Bitti | 09.09.2026 | Şifreli ayar tablosu + ayar ekranı + bağlantı testi. Kalan: `EBELGE_ENC_KEY` sunucuya tanımlanacak |
| 3. Gelen kutusu — okuma | ✅ Kod bitti, canlı doğrulama bekliyor | 09.09.2026 | Senkronizasyon, liste, detay, HTML/PDF görüntü. Bkz. §16.3 |
| 4. Gelen kutusu — aksiyon | ✅ Kod bitti, canlı doğrulama bekliyor | 09.09.2026 | Kabul/red + okundu/işlendi. Bkz. §16.4 |
| 5. UBL üreteci + doğrulama | ✅ Kod bitti, canlı doğrulama bekliyor | 09.09.2026 | UBL-TR üreteci, `invoice_check_validate`, doğrulama ekranı. Bkz. §16.5 |
| 6. Taslak hattı | ✅ Kod bitti, canlı doğrulama bekliyor | 09.09.2026 | Taslak oluşturma + iptal + giden kutusu. **GİB'e gönderim yok.** Bkz. §16.6 |
| 7. e-Fatura gönderimi | ✅ Kod bitti, canlı doğrulama bekliyor | 10.09.2026 | `send_invoice` + `DraftApproval` + statü. Bkz. §16.12 |
| 8a. e-Arşiv | 🛠️ Temel akış düzeltildi; kapsam ve canlı doğrulama eksikleri var | 09.09.2026 | Güvenli gönderim/iptal, rapor/mail ekranı, PDF; açık işler §16.7 |
| 8b-8d | ⏳ Uygulanmadı; içerik sözleşmesi ve üretim akışı eksik | 09.09.2026 | Dört türün kapsam onayı zaten var. PDF kütüphanesi kararı tek başına engel değil; §16.7 |
| 9. e-İrsaliye | ✅ Kod bitti, canlı doğrulama bekliyor | 10.09.2026 | Üreteç, doğrulama, gönderim, liste, statü, PDF, ekran. Bkz. §16.13 |
| 10. e-Döviz | ⏸️ Kapsam dışı | — | Karar #17 — yönetici cevabı bekleniyor |

### 16.1 Faz 0 çalışma notu (09.09.2026)
- `curl` ile `https://integration.iceteknoloji.com.tr/integration.asmx?wsdl` → HTTP 200, 339.443 bayt.
- Paketteki 2020 WSDL'i ile karşılaştırıldı: **35 → 100 operasyon**, kaldırılan yok, **65 yeni**.
- Planı değiştiren operasyonlar §3.1'e işlendi; `Belge_Turu` enum'u kayda geçti.
- Kod yazılmadı, mevcut hiçbir dosyaya dokunulmadı.

### 16.2 Faz 1 & 2 çalışma notu (09.09.2026)

**Yazılan dosyalar** (hepsi yeni):

| Katman | Dosya |
|---|---|
| Şifreleme | `Backend/src/utils/crypto.utils.ts` — AES-256-GCM, anahtar `EBELGE_ENC_KEY` |
| SOAP istemcisi | `Backend/src/services/ice/ice.client.ts` |
| Oturum | `Backend/src/services/ice/ice.session.ts` |
| Tipler | `Backend/src/services/ice/ice.types.ts` |
| Veri erişimi | `Backend/src/models/ebelgeSql.repository.ts` |
| Doğrulama | `Backend/src/schemas/ebelge.schema.ts` |
| Servis | `Backend/src/services/ebelge.service.ts` |
| Denetleyici / rota | `Backend/src/controllers/ebelge.controller.ts`, `Backend/src/routes/ebelge.routes.ts` |
| Frontend | `src/services/ebelgeService.ts`, `src/pages/ebelge/EBelgeHomePage.tsx`, `src/pages/settings/EBelgeSettingsPage.tsx` |

**Değiştirilen (yalnızca satır ekleme):** `Backend/src/routes/index.ts` (+2), `Backend/package.json`
(`fast-xml-parser` 5.11.1), `src/App.tsx` (+5 route satırı).

**Koşulan testler:**

| # | Test | Sonuç |
|---|---|---|
| B1 | `escapeXml` — `&`, `<`, `"` ve Türkçe karakter | ✅ `Likya &amp; Kuyum &quot;A&quot; &lt;test&gt;` |
| B2 | Fault eşlemesi — `AUTHORIZATION` | ✅ HTTP 401 |
| B4 | `...Specified` bayrağı — boş / dolu | ✅ `<LIMITSpecified>false</…>` / `<LIMIT>5</LIMIT><LIMITSpecified>true</…>` |
| G1 | **XXE** — `<!ENTITY xxe SYSTEM "file:///C:/Windows/win.ini">` | ✅ Parser reddetti: *"External entities are not supported"* — hata yutulmuyor, `callSoap` 502 döndürüyor (fail-closed) |
| G5 | Allowlist — `http://…iceteknoloji…` ve `https://saldirgan.example` | ✅ İkisi de reddedildi |
| G6 | Log maskeleme | ✅ `Session_ID`, `Security_Key`, `Password` → `***`; `invoice` → `[belge]` |
| C1 | **Canlı `Health` çağrısı** | ✅ `"OK"`, 200 ms — SOAP zarfı, `SOAPAction` başlığı ve ayrıştırıcı uçtan uca doğrulandı |

**Henüz koşulmayanlar:** `Login`, `Get_Credit` — ICE kullanıcı adı/şifresi ayar ekranından
girilene kadar denenemez. Kimlik bilgileri koda veya sohbete yazılmayacak; yalnızca ayar
ekranından girilip AES ile saklanacak.

**Sunucuda yapılacak tek işlem:** `Backend/.env` dosyasına 32 baytlık şifreleme anahtarı eklenmeli:

```
EBELGE_ENC_KEY=<64 karakterlik hex>
```

Anahtar şu komutla üretilir (çıktı hiçbir yere kopyalanmadan doğrudan .env'e yazılmalı):

```
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

> Anahtar tanımlı değilken ekran şifre alanını kilitler ve uyarı gösterir — düz metin
> saklamaya asla düşülmez (§11.1 S1).

### 16.3 Faz 3 çalışma notu — Gelen kutusu (09.09.2026)

**Yazılan dosyalar:** `Backend/src/services/ice/ice.efatura.ts` (yeni),
`src/pages/ebelge/EBelgeGelenPage.tsx` (yeni), `src/pages/ebelge/EBelgeDetayModal.tsx` (yeni).
**Genişletilen:** `ebelgeSql.repository.ts` (+`TODVZ_EBELGE_GELEN` tablosu ve 4 metot),
`ebelge.service.ts`, `ebelge.controller.ts`, `ebelge.routes.ts`, `ebelgeService.ts`.
**Değiştirilen (satır ekleme):** `src/App.tsx` (+1 route).

**Eklenen uçlar:** `POST /gelen/senkronize` · `GET /gelen` · `GET /gelen/:uuid` ·
`GET /gelen/:uuid/goruntu?format=html|pdf`

**Tasarım kararları:**

1. **Liste yerel aynadan okunur.** Ekran her açılışta ICE'ye çıkmaz; yalnızca
   "Senkronize Et" entegratöre gider. İnternet yokken de son çekilen liste görünür.
2. **`HEADER_ONLY=true`** ile senkronize edilir — base64 UBL indirilmez. `INVOICEHEADER`
   zaten unvan, tarih, tutar ve GİB statüsünü verdiği için liste için UBL ayrıştırmaya gerek yok.
3. **`GetInvoice_Count` önce çağrılır**, entegratördeki toplam adet kullanıcıya bildirilir.
4. **MERGE ile upsert:** yeniden senkronize edildiğinde kullanıcının verdiği red/kabul cevabı
   ve açıklaması **korunur**, yalnızca ICE'den gelen alanlar güncellenir.
5. **PDF ikili akıtılır** (`application/pdf`), base64 JSON gövdesinde taşınmaz (§11.1 S10).
   Frontend'de düz bağlantı işe yaramaz (API Bearer token istiyor), bu yüzden PDF kimlik
   başlıklarıyla `fetch` edilip blob adresine çevriliyor ve kullanıldıktan sonra bırakılıyor.

**Koşulan testler:**

| # | Test | Sonuç |
|---|---|---|
| B4a | `INVOICE_SEARCH_KEY` alan **sırası** şema sequence'ı ile aynı mı | ✅ `LIMIT → START_DATE → END_DATE → READ_INCLUDED → PROCESSED_INCLUDED → DIRECTION` |
| B4b | Dolu filtrede `...Specified` bayrakları | ✅ Hepsi `true`, değerlerle birlikte |
| B4c | Boş filtrede | ✅ Yalnızca `Specified=false` gidiyor; boş `<LIMIT>` / `<START_DATE>` etiketi **sızmıyor** |
| — | Backend + frontend derleme | ✅ `tsc --noEmit` temiz, `vite build` başarılı |

> **Canlı doğrulama bekliyor:** `GetInvoice`, `GetInvoice_Count`, `GetInvoice_HTML`,
> `GetInvoice_PDF` çağrıları ICE kullanıcı adı/şifresi girilene kadar gerçek veriyle denenemedi.
> Ayar ekranından bilgiler girildiğinde §10.3 C3 adımı koşulacak.

**Güvenlik notu (S5 uygulandı):** ICE'den gelen HTML `dangerouslySetInnerHTML` ile basılmıyor;
`<iframe srcDoc sandbox="" referrerPolicy="no-referrer">` içine konuyor. `sandbox` özniteliği
**boş** — yani `allow-same-origin` dahil hiçbir izin verilmiyor, belge kendi origin'imize,
çerezlerimize ve `localStorage`'a erişemiyor.

### 16.4 Faz 4 çalışma notu — Kabul / Red (09.09.2026)

**Eklenen uçlar:** `POST /gelen/:uuid/cevap` · `POST /gelen/:uuid/statu`

**Yetki:** Kabul/red **yalnızca `admin` ve `manager`** rollerine açık (mali sonuç doğurur).
Okundu/işlendi işaretleme mali sonuç doğurmadığı için giriş yapmış her kullanıcıya açık.

**Çift gönderim koruması — üç katman (§11.1 S8):**

1. **Süreç içi kilit** — aynı belgeye eşzamanlı ikinci istek beklemeden 409 alır.
2. **Veritabanı yer tutma** — `UPDATE … WHERE UUID=@uuid AND RED_KABUL IS NULL`.
   Etkilenen satır 0 ise ya belge yok ya da başka kullanıcı bu sırada cevap vermiştir → 409.
3. **ICE çağrısında otomatik yeniden deneme kapalı** (`authHatasindaTekrarla: false`).
   Oturum düşse bile çağrı tekrarlanmaz.

**Sıralama kararı:** Önce yerelde yer tutuluyor, sonra ICE'ye gidiliyor. ICE çağrısı başarısız
olursa yer tutma **geri alınıyor** (`clearGelenRedKabul`) ki kullanıcı tekrar deneyebilsin.
Ters sıra (önce ICE) seçilseydi, iki kullanıcı aynı anda cevap gönderebilirdi.

**İş kuralları:**
- **Temel senaryo faturasına cevap verilemez** — yalnızca ticari faturaya. Backend `TEMEL`
  içeren profili reddediyor, ekran düğmeleri zaten göstermiyor.
- **Red cevabında açıklama zorunlu** — hem ekranda hem backend'de.
- Cevaplanmış belgeye ikinci cevap 409 ile reddediliyor; mesajda ilk cevabı veren kullanıcı yazıyor.

**Arayüz (§8 kuralı uygulandı):** Kabul/red **tek tıkla gönderilmiyor.** İlk tıklama onay
panelini açıyor; panelde işlemin **geri alınamaz** olduğu yazıyor, açıklama alanı ve
"Evet, … ve gönder" düğmesi var. Red seçiliyken açıklama boşsa düğme pasif.
Kabul/red **hiçbir F tuşuna bağlanmadı**.

**Derleme:** backend `tsc` temiz, frontend `vite build` başarılı.

### 16.5 Faz 5 çalışma notu — UBL üreteci ve doğrulama (09.09.2026)

**Yazılan:** `Backend/src/services/ice/ubl/invoiceBuilder.ts` (yeni),
`src/pages/ebelge/EBelgeDogrulaPage.tsx` (yeni).
**Genişletilen:** `ice.efatura.ts` (+`invoice_check_validate`, `Get_Son_Belge_ID`),
`ebelge.service.ts`, `ebelge.controller.ts`, `ebelge.schema.ts`, `ebelge.routes.ts`, `ebelgeService.ts`.
**Eklenen uçlar:** `POST /giden/dogrula` · `GET /giden/son-belge-no`

**Bu faz hiçbir belge göndermez.** Ekranın en üstünde de bu yazıyor.

**Üreteç kararları:**

1. **Tutarlar backend'de yeniden hesaplanır.** İstemciden gelen toplamlara güvenilmiyor;
   satırlardan matrah, iskonto, KDV ve ödenecek tutar yeniden üretiliyor. Aksi halde ekranda
   100 TL görünen fatura GİB'e farklı tutarla gidebilirdi. Ekrandaki toplam yalnızca önizleme.
2. **KDV oranı bazında gruplama.** Farklı oranlı satırlar ayrı `TaxSubtotal` olarak yazılıyor.
3. **VKN/TCKN ayrımı otomatik:** 11 hane → `schemeID="TCKN"` + `cac:Person` (ad/soyad),
   10 hane → `schemeID="VKN"`.
4. **İmza bloğu üretilmiyor** (karar #11) — mali mührü ICE atıyor.
5. **XSLT gömülmüyor.** Örnek istemci `general.xslt` dosyasını belgeye gömüyor; bizde o dosya yok
   ve ICE kendi görüntüsünü üretiyor. Schematron takılırsa bu madde yeniden değerlendirilecek.
6. **Fatura no biçimi doğrulanıyor:** 3 karakter seri + 13 hane (`ABC2026000000001`).
7. `Get_Son_Belge_ID` ucu eklendi — kendi numaratörümüzle ICE'deki son numarayı karşılaştırıp
   çakışmayı gönderimden önce yakalamak için (§12 risk maddesi).

**Koşulan testler (çevrimdışı, gerçek servise çıkmadan):**

| # | Test | Sonuç |
|---|---|---|
| B5a | 3 satırlı fatura, 2 farklı KDV oranı, bir satırda %10 iskonto | ✅ Matrah 4.220 · iskonto 80 · KDV 794 · ödenecek 5.014 — elle hesapla birebir |
| B5b | KDV grupları | ✅ `%10 → matrah 500 / vergi 50`, `%20 → matrah 3.720 / vergi 744` |
| B5c | Üretilen XML ayrıştırılabiliyor mu | ✅ Geçerli XML; `CustomizationID=TR1.2`, `LineCountNumeric=3` |
| B5d | Taraf kimlik şemaları | ✅ Gönderici `VKN`, alıcı `TCKN` + `cac:Person` (Ad/Soyad) |
| B5e | İskontolu satırda `AllowanceCharge` bloğu | ✅ Var, `BaseAmount` = iskonto öncesi tutar |
| B5f | Birim kodu (gram) | ✅ `unitCode="GRM"` |
| B5g | İmza bloğu | ✅ Üretilmiyor |
| B5h | XML kaçışlama — unvanda `&` | ✅ `Likya Kuyum A.Ş. &amp; Ortakları` |
| B5i | Hatalı girdiler: boş satır, negatif miktar, geçersiz VKN, geçersiz fatura no | ✅ Dördü de anlamlı Türkçe hata ile reddedildi |

> **Canlı doğrulama bekliyor:** `invoice_check_validate` çağrısı — §17'ye eklendi.

### 16.6 Faz 6 çalışma notu — Taslak hattı (09.09.2026)

> **Kullanıcı talimatı: "GİB'e gitmesin."** Bu faz ICE'de kayıt oluşturur ama
> **GİB'e hiçbir şey göndermez.** Taslağı GİB'e ileten `DraftApproval` çağrısı
> servis, denetleyici ve rota katmanlarının **hiçbirinde kullanılmamıştır** —
> yalnızca `DraftCancel` çağrılıyor. Kodda arama yapılarak doğrulandı.

**Yazılan:** `src/pages/ebelge/EBelgeGidenPage.tsx` (yeni).
**Genişletilen:** `ice.efatura.ts` (+`getUserList_EFatura`, `send_invoice_taslak`,
`send_draft_document_approval`), `ebelgeSql.repository.ts` (+`TODVZ_EBELGE_GIDEN`),
`ebelge.service.ts`, `ebelge.controller.ts`, `ebelge.schema.ts`, `ebelge.routes.ts`,
`ebelgeService.ts`, `EBelgeDogrulaPage.tsx` (taslak adımı), `EBelgeHomePage.tsx`.
**Değiştirilen (satır ekleme):** `src/App.tsx` (+1 route).

**Eklenen uçlar:** `GET /mukellef` · `POST /giden/taslak` · `POST /giden/:uuid/iptal` · `GET /giden`

**Akış kararları:**

1. **Taslaktan önce zorunlu doğrulama.** `taslakGonder` önce `invoice_check_validate`
   çağırıyor; şema veya schematron geçmezse ICE'ye taslak **hiç gönderilmiyor**.
   Böylece entegratörde bozuk taslak birikmiyor.
2. **Alıcı etiketi (alias) otomatik bulunuyor.** Verilmemişse `getUserList_EFatura` ile
   sorgulanıyor. Alıcı mükellef değilse taslak oluşturulmuyor ve
   *"bu alıcıya e-Arşiv kesilmelidir"* deniyor.
3. **Fatura numarası tekilliği iki katmanlı:** gönderim öncesi ön kontrol +
   İlk sürümde `(BELGE_NO, DUZENLEME_TARIHI)` kullanılmıştı; Faz 8 denetiminde
   `(BELGE_NO)` tekilliği eklendi. Taslak kaydı hâlâ ICE çağrısından sonra ekleniyor;
   bu hattın rezervasyon sırası ayrıca düzeltilmeli. SQL 2601/2627 hatası
   409'a çevriliyor.
4. **Başarısız deneme de kaydediliyor** (`GONDERIM_DURUMU='HATA'`) — izi kaybolmasın.
5. **İki adımlı onay** hem taslak oluştururken hem iptal ederken. Taslak onayında
   fatura numarasının kullanılmış sayılacağı açıkça yazıyor.

**Koşulan testler (çevrimdışı):**

| # | Test | Sonuç |
|---|---|---|
| B6a | `send_invoice_taslak` alan sırası | ✅ `Login_Request_Header → from_vkn_tckn → from_alias → to_vkn_tckn → to_alias → invoices` — şema sequence'ı ile birebir |
| B6b | Çoklu belge gönderimi | ✅ İki belge iki ayrı `invoiceType` olarak çoklandı |
| B6c | Oturum başlığı gövdede mi | ✅ |
| B6d | **Kodda `DraftApproval` kullanımı** | ✅ Servis/denetleyici/rota katmanlarında **yok** — yalnızca açıklama satırlarında geçiyor |
| — | Backend + frontend derleme | ✅ |

> **Canlı doğrulama bekliyor** — §17'ye eklendi.
>
> **Faz 7 (canlı gönderim) beklemeye alındı.** `send_invoice` ve `DraftApproval`,
> kullanıcının açık onayı olmadan yazılmayacak; ikisi de belgeyi GİB'e iletir ve geri alınamaz.

### 16.7 Faz 8 incelemesi ve güncel durum (09.09.2026)

> ⚠️ **Bu faz mali sonuç doğurur.** e-Arşiv, e-Fatura mükellefi olmayan alıcıya kesilen
> **gerçek faturadır**; GİB'e rapor olarak bildirilir. Silinemez, yalnızca **iptal bildirimi**
> gönderilebilir. Bu uygulamanın e-Arşiv akışında taslak desteği yoktur.
> **Faz 8 bütünü tamamlanmadı.** Aşağıdaki liste ilk uygulamanın eksiklerini ve bu incelemede yapılan düzeltmeleri ayırır.

**Yazılan:** `Backend/src/services/ice/ice.earsiv.ts` (yeni).
**Genişletilen:** `ebelge.service.ts`, `ebelge.controller.ts`, `ebelge.routes.ts`,
`ebelgeSql.repository.ts` (+`earsivDurumGecir`, numara indeksi), `ebelgeService.ts`,
`ebelge.schema.ts`, `ubl/invoiceBuilder.ts`, `EBelgeDogrulaPage.tsx`, `EBelgeGidenPage.tsx`, `EBelgeHomePage.tsx`.
Eklenen test: `Backend/scripts/ebelge-faz8-test.ts`.

**Eklenen uçlar:** `POST /earsiv/gonder` · `POST /earsiv/:uuid/iptal` ·
`GET /earsiv/durum` · `GET /earsiv/:uuid/pdf`

**Kararlar:**

1. **Gönderim sırası düzeltildi:** yerel numara ön kontrolü → UBL üret →
   `invoice_check_validate` → mükellef sorgusu → ICE son sıra kontrolü → **SQL rezervasyonu** → gönderim → sonucu güncelle.
   İlk sürümde SQL kaydı gönderimden sonra açılıyordu; aynı anda iki istek ICE'ye ulaşabiliyordu.
   Artık tek kolonlu UNIQUE indeks sayesinde e-Arşiv gönderiminden önce yalnızca bir istek yer tutar.
2. **Senaryo zorlanıyor:** `senaryo` ne gelirse gelsin backend `EARSIVFATURA` olarak
   üretir — yanlış profille e-Arşiv gönderilmesi mümkün değil.
3. **Alias yok, mükellef kontrolü var:** `send_earsiv` yalnızca belgeleri alır.
   Öncesinde mükellef sorgulanır. Başarısız sorgu “mükellef değil” sayılmaz; gönderim durur.
   Mükellef kayıtlıysa mevcut e-Arşiv akışı gönderimi reddeder. Olası özel kullanım senaryoları ayrıca modellenmelidir.
4. **İptal ayrı bir kavram:** `send_earsiv_iptal` belgeyi silmez, GİB'e iptal edildiğini
   raporlar. `GONDERILDI → IPTAL_EDILIYOR` atomik geçişi **ICE çağrısından önce** yapılır.
   İstek tarihi saklanır; önceki sürüm istenen tarih yerine `GETDATE()` yazıyordu.
   Bağlantı koparsa `IPTAL_BELIRSIZ` olur; tekrar iptal engellenir. Kesin ret varsa `GONDERILDI` durumuna dönülür.
5. **Raporlanma takibi:** e-Arşiv'de belgenin GİB'e ulaşması **rapora** bağlı olduğu için
   `GetInvoice_Rapor_Statu` + `GetInvoice_EMail_Statu` birlikte sorgulanıyor; biri hata
   verse diğeri yine döner; hata artık `hatalar` alanında ve ekranda görünür. İkisi de başarısızsa uç hata döner.
   İlk sürüm hataları boş diziye dönüştürüp işlemi başarılı logluyordu.
6. **Arayüzde ayrı dil:** Doğrulama ekranında senaryo `EARSIVFATURA` seçilince düğme
   "Taslak Oluştur" yerine **"e-Arşiv Gönder"** oluyor, onay paneli kırmızıya dönüyor ve
   **alıcı adı + tutar tekrar gösteriliyor**. Giden kutusunda belge türü rozeti eklendi;
   e-Arşiv satırında iptal düğmesi "iptal bildirimi gönder" anlamına gelir.
   “Bu ekran belge göndermez” şeklindeki yanlış üst uyarı düzeltildi. Form değişince eski doğrulama
   geçersizleşir; işlem sırasında alanlar kilitlenir. Onayda backend'in hesapladığı tutar gösterilir.
   Önizlemede üretilen UUID/saat gönderime taşınır. Giden kutusuna **Durum** ve **PDF** düğmeleri eklendi.

7. **Belirsiz sonuç korunur:** timeout/bozuk yanıt sonrası kayıt silinmez ve numara serbest bırakılmaz.
   `GONDERILIYOR` veya `BELIRSIZ` görünür; ICE portalinde ETTN ile mutabakat yapılmalıdır.
   Sunucu işlem ortasında kapanırsa `GONDERILIYOR` kaydı kalır. Otomatik toparlama/gönderim yoktur.
   Farklı numara/UUID ile aynı ticari işlemi yeniden gönderme, kaynak fiş bağı kurulmadığından otomatik tespit edilemez.
8. **Başarı belge bazında kontrol edilir:** üst `success` yanında satır `success`, iki doğrulama bayrağı,
   ETTN ve belge no eşleşmesi aranır. Eksik/uyuşmayan yanıt “gönderildi” sayılmaz.
9. **PDF doğrulaması:** ICE `success` değeri, base64 ve `%PDF-` başlığı kontrol edilir;
   başka belge türü ve kesinleşmemiş gönderim PDF ucunda reddedilir. Tarayıcı PDF'i kimlik başlıklarıyla alır.
10. **UBL ve girdi düzeltmeleri:** `Item/Description`, `Item/Name` öncesine taşındı
    ([OASIS UBL 2.1 XSD](https://docs.oasis-open.org/ubl/os-UBL-2.1/xsd/common/UBL-CommonAggregateComponents-2.1.xsd)).
    Geçersiz takvim tarihi, yıl uyuşmazlığı, bozuk UUID/saat/para birimi ve sonlu olmayan sayılar reddedilir.
    TCKN tarafında ad/soyad aranır. Varsayılan tarih/saat Türkiye saatine göre üretilir.
11. **Desteklenmeyen mali hesaplar gönderime kapatıldı:** mevcut üreteçte iade referansı, özel matrah,
    istisna gerekçesi, tevkifat ve döviz kuru alanları yok. `send_earsiv` akışı şu anda yalnızca
    **TRY / SATIS / pozitif KDV oranları** için açık. Bu bir mevzuat hükmü değil, uygulamanın mevcut sınırıdır.
    Kuyumcuya özgü belge ihtiyacı tamamlanmış sayılmaz.

**Doğrulama:** backend ve frontend `tsc --noEmit`; 19 çevrimdışı regresyon testi.
Frontend `vite build` başarılı (37,20 saniye); çıktı geçici klasöre alındı, mevcut `dist` değiştirilmedi.
Test komutu: `cd Backend` ardından `node --import tsx --test scripts/ebelge-faz8-test.ts`.
ICE çağrıları `fetch` taklidiyle, SQL işlemleri bellek içi repository ile sınandı. Gerçek SOAP/SQL testi değildir.
Gerçek ICE hesabıyla giriş, fatura gönderme, iptal veya e-posta gönderme yapılmadı.
Gerçek SQL'e bağlanılmadı; indeks geçişi canlıda henüz denenmedi.

#### 8a için hâlâ eksik olan işler

- `GetEArchive` senkronizasyonu, `Set_EArchive_Status`, dışarıdan aktarılan belgenin iptali ve
  `Send_Document_Email` uygulamada yok. Mail **durumu okumak**, mail göndermek değildir.
- Kontör ekranı var ama **gönderim öncesi kontör engeli yok**. `Get_Credit` WSDL'de dinamik DataSet döndürür;
  gerçek yanıtın ürün/kalan kontör sütunları örnek veriyle eşleştirilmeden rastgele kolon adına güvenilmedi.
- Belirsiz işlemi ICE ile eşleştirip yerel kaydı onaracak mutabakat ekranı yok; şimdilik portalden inceleme gerekir.
- Özel matrah/istisna/tevkifat/iade/döviz ve internet satışı/teslim şekli alanları, XSLT ihtiyacı,
  satır iskonto toplamlarının UBL-TR kurallarıyla uyumu gerçek örneklerle ayrıca tamamlanmalıdır.
- `preview_invoice` için hangi tarafın VKN'sinin beklendiği WSDL adından kesinleşmiyor;
  mevcut alıcı VKN kullanımı canlı örnekle doğrulanmalı.
- Faz 6 taslak akışında da eski “ICE çağrısından sonra insert” sırası var. Yeni UNIQUE indeks yerel
  mükerrer kaydı önler fakat bu hattın dış çağrı yarışını tek başına çözmez. Ayrı takip bulgusudur.
- Faz 7'nin `send_invoice` / `DraftApproval` özellikleri eklenmedi. Faz 9'a geçilmedi.

#### Faz 8b / 8c / 8d — gerçek eksikler ve önceki notların düzeltilmesi

| Faz | Engel | Gereken karar |
|---|---|---|
| **8b e-SMM** | Üreteç, ekran ve operasyonlar yazılmadı. `esmm_document` içindeki `esmm_pdf` **ve** `esmm_xml`, saklanan WSDL'de `minOccurs="0"`. Bu, iş kuralında da opsiyonel olduklarını kanıtlamaz; fakat “WSDL PDF üretimini zorunlu tutuyor” iddiası yanlıştır. | ICE örnek isteği + belge içerik şeması + PDF'in iş kuralındaki gerekliliği doğrulanmalı. Kütüphane seçimi teknik uygulama kararıdır. |
| **8c e-Müstahsil** | Gönderim XML'i WSDL'de base64 taşınıyor; servis adı içerideki XML sözleşmesini tek başına açıklamaz. Üreteç/ekran/gönderim/iptal yazılmadı. | Güncel resmi şema ve ICE'nin kabul ettiği örnek XML ile vergi/stopaj alanları belirlenmeli. Kapsam onayı zaten §13 karar #7'de var. |
| **8d e-Gider Pusulası** | `send_egider_pusulasi`, `send_earsiv_request` zarfını kullanıyor; bu, iç belgenin fatura ile aynı olduğunu kanıtlamaz. Üreteç/ekran/gönderim yazılmadı. | Belge şeması ve gerçek iş alanları doğrulanmalı. Kapsama alınıp alınmayacağı yeniden sorulması gereken bir karar değil. |

> WSDL, SOAP zarfını ve parametre tiplerini doğrular; base64 içindeki belgenin tüm içerik kurallarını vermez.
> Dolayısıyla yalnız WSDL'den e-İrsaliye veya diğer türlerin tam üretecini çıkarabileceğimiz yönündeki
> önceki ifade de fazla kesindir. Sıradaki iş, bu içerik sözleşmelerini ve doğrulanmış örnekleri edinmektir.

### 16.8 Faz 8d çalışma notu — e-Gider Pusulası (10.09.2026)

> **Bu faz tahmine dayanmıyor.** Önceki notlarda "belge şeması doğrulanmalı" diye
> bırakılan boşluk, GİB'in resmî paketiyle kapatıldı.

#### Kullanılan doğrulanmış kaynaklar

`docs/ice/gib-faz8/gider-paketi/e-Gider Pusulası Paketi/` içinden:

| Dosya | Neyi doğruladı |
|---|---|
| `eArsiv.xsd` | `iadeDetayEnum` = `EARSIV_FATURA` · `BELGESIZ` · `SATIS_FISI`; `ContactTypeEnum` = `IADEKODU` · `SMS` |
| `GiderPusulasıSATIS.xml` | Satış belgesinin tam yapısı |
| `GiderPusulasıIADE_Belgesiz.xml` | Belgesiz iade + kargo (`cac:Delivery`) bloğu |
| `GiderPusulasıIADE_IADE_KoduYazılması.xml` | e-Arşiv faturaya dayalı iade |
| `GiderPusulasıIADE_SMS_KoduYazılması.xml` | Satış fişine dayalı iade + SMS kanalı |

#### Faturadan yapısal farkları (örneklerden birebir çıkarıldı)

| Fatura (`Invoice`) | Gider pusulası (`CreditNote`) |
|---|---|
| kök `Invoice`, `…Invoice-2` ad alanı | kök `CreditNote`, `…CreditNote-2` |
| `cbc:InvoiceTypeCode` | `cbc:CreditNoteTypeCode` |
| `cac:InvoiceLine` | `cac:CreditNoteLine` |
| `cbc:InvoicedQuantity` | `cbc:CreditedQuantity` |
| `ProfileID` senaryoya göre | `ProfileID` daima `GIDERPUSULASI` |
| `CustomizationID` `TR1.2` | `CustomizationID` `TR1.2.1` |

> Önceki notta "`send_egider_pusulasi`, `send_earsiv_request` zarfını kullanıyor; bu iç belgenin
> fatura ile aynı olduğunu kanıtlamaz" denmişti. **Doğruymuş** — zarf aynı, belge farklı.

#### ⚠️ Bu belge türünde ön doğrulama YOK

Canlı WSDL'de yalnızca `invoice_check_validate`, `despatchadvice_check_validate` ve
`producerreceipt_check_validate` var. **Gider pusulası için karşılığı yok.**
Yani e-Arşiv akışındaki "önce ICE'ye doğrulat, geçerse gönder" güvencesi bu türde
**uygulanamıyor**; yerel UBL doğrulaması tek savunma hattı.

Bunun kayıttaki sonucu: `SEMA_GECERLI` / `SCHEMATRON_GECERLI` kolonları `false` değil
**`NULL`** yazılıyor — "başarısız" ile "bilinmiyor" karıştırılmasın diye.
API cevabında da `onDogrulamaYapildi: false` alanı dönüyor.

#### Yazılanlar

```
src/services/ice/ubl/giderPusulasiBuilder.ts   CreditNote üreteci + hesap + doğrulama
src/services/ice/ice.giderpusulasi.ts          send_egider_pusulasi, Get_EGiderPusulasi_HTML_PDF
scripts/ebelge-giderpusulasi-test.ts           17 çevrimdışı test
```
Genişletilen: `ebelge.service.ts`, `ebelge.controller.ts`, `ebelge.routes.ts`, `ebelge.schema.ts`.

**Eklenen uçlar:** `POST /gider-pusulasi/gonder` · `GET /gider-pusulasi/:uuid/pdf`

#### Akış — e-Arşiv disiplini korundu

yerel numara ön kontrolü → UBL üret (**yerel** doğrulama) → karşı taraf mükellef mi →
ICE son sıra kontrolü → **kontör kontrolü** → **SQL rezervasyonu** → gönderim →
sonucu belge bazında doğrula (`success` + `ettn` + `ID` eşleşmesi) → durum geçişi.

Bağlantı koparsa `BELIRSIZ` kalır, numara serbest bırakılmaz, yeniden gönderim engellenir.

**Mükellef kontrolü ters yönde:** karşı taraf e-Fatura mükellefiyse gider pusulası
düzenlenmemeli; akış durup *"mükelleften alımda fatura düzenlenmelidir"* diyor.

#### Kuyumcudaki karşılığı

Vergi mükellefi olmayan kişiden (vatandaştan) **hurda altın / ikinci el ürün alımı**
gider pusulası ile belgelenir. Belgeyi biz düzenleriz; "alıcı" alanı malı satan vatandaştır.

**Bilinçli sınır:** `TaxTypeCode` varsayılanı GİB örneğindeki gibi `0015`, ama dışarıdan
verilebiliyor. Gider pusulasında uygulanacak **stopaj (GVK 94) oranı ve kodu** işletmeye ve
mal cinsine göre değişir; üreteç varsayım yapmıyor. **Hurda altın alımındaki doğru stopaj
kodu canlı örnekle teyit edilmeli.**

#### Gönderim öncesi kontör kontrolü (§16.7'deki eksik kapatıldı)

`Get_Credit` dinamik DataSet döndürdüğü için kolon adı sabit değil. Uydurma yapmadan:

- Kolon adı `kalan` / `kontor` / `bakiye` / `adet` / `miktar` / `credit` / `remain`
  kalıbına uyan **ve sayısal olan** alanlar aday sayılır.
- Birden çok aday varsa **en kısıtlayıcı (en küçük)** değer esas alınır.
- Aday yoksa `okunabildi: false` döner — tahmin edilmez.

**Neden engellemiyor:** kontör gerçekten bittiyse ICE zaten reddeder; asıl risk kolon adını
yanlış okuyup **geçerli bir gönderimi boş yere durdurmak**. Bu yüzden yalnızca kontör
*güvenle* okunup sıfır/negatif çıkarsa durduruluyor; okunamazsa gönderim sürüyor ve
cevapta `kontorUyari` alanıyla bildiriliyor. e-Arşiv ve gider pusulası akışlarının ikisinde de aktif.

#### Doğrulama

| | Sonuç |
|---|---|
| `ebelge-giderpusulasi-test.ts` | **17/17 geçti** |
| `ebelge-faz8-test.ts` (mevcut) | **25/25 geçti** — regresyon yok |
| Backend `tsc --noEmit` + `npm run build` | temiz |

Testler arasında **GİB'in kendi örnek belgesiyle karşılaştırma** var: örnekteki üst düzey
öğelerden üretmediklerimiz (`Signature`, `AdditionalDocumentReference` — mühür ICE'de,
XSLT eki ayrı konu) dışında **eksik öğe kalmadığı** doğrulanıyor. İade örneklerindeki
`schemeID` değerlerinin enum'la örtüştüğü de dosyalardan okunarak sınanıyor.

Gerçek ICE çağrısı yapılmadı; hiçbir belge gönderilmedi.

#### 8d için kalan iş

- **Arayüz yok.** Uçlar hazır ama gider pusulası ekranı yazılmadı; şu an yalnızca API'den
  kullanılabilir. Sıradaki iş bu.
- `Get_EGiderPusulasi_HTML_PDF` yalnızca PDF için bağlandı; HTML/XML seçenekleri kullanılmıyor.
- İptal: `eArsiv.xsd` içinde `eGiderPusulasiIptal` tipi var ama WSDL'de gider pusulasına
  özel bir iptal ucu görünmüyor. Hangi ucun kullanılacağı ICE'ye sorulmalı.
- Stopaj kodu/oranı teyidi (yukarıda).

#### 8b / 8c — durum değişmedi

`producerreceipt_check_validate` ucunun varlığı, e-Müstahsil için **ön doğrulama
yapılabileceğini** gösteriyor (gider pusulasının aksine). Ancak belge içerik şeması hâlâ
elde değil; `e-Mustahsil_Makbuzu_Teknik_Kilavuzu_V1.1` indirildi ama örnek XML içermiyor.
e-SMM için de ICE'nin kabul ettiği örnek istek gerekiyor. İkisi de **şema doğrulanmadan
yazılmayacak** — gider pusulasında izlenen yol budur ve işe yaradı.

### 16.10 UBL mali alanları — istisna · tevkifat · iade · döviz (10.09.2026)

> §16.7 madde 11'de "üreteçte yok" denilen alanların dördü kapatıldı.
> **Özel matrah hâlâ kapalı** — gerekçesi aşağıda.

#### Yapılar nereden doğrulandı

Tahmin edilmedi. ICE paketindeki **UBL-TR şema sınıflarından** okundu:
`ICE_INTAGRATION_v1.0.3/.../UBL/UBLTR-Invoice-2_1.cs`

| Ne | Şemadan okunan |
|---|---|
| `InvoiceType` sequence | … `LineCountNumeric` → `InvoicePeriod` → `OrderReference` → **`BillingReference`** → … `AllowanceCharge` → `TaxExchangeRate` → **`PricingExchangeRate`** → `TaxTotal` → **`WithholdingTaxTotal`** → `LegalMonetaryTotal` → `InvoiceLine` |
| `TaxCategoryType` sequence | `Name` → **`TaxExemptionReasonCode`** → **`TaxExemptionReason`** → `TaxScheme` |
| `ExchangeRateType` | `SourceCurrencyCode` · `TargetCurrencyCode` · `CalculationRate` · `Date` |

**Öğe sırası bu fazın en kritik noktasıydı.** UBL şemaları `sequence` tabanlıdır; doğru
öğeyi yanlış yere koymak şema hatası verir. Sıra testlerle sabitlendi.

#### Eklenenler

**1. KDV istisnası** — `kdvOrani: 0` olan satırda `istisnaKodu` + `istisnaGerekcesi`.
`cac:TaxCategory` içine `TaxExemptionReasonCode` / `TaxExemptionReason` yazılır.

> **Kod önerilmiyor.** GİB istisna kod listesi uygulamada sabitlenmedi; hangi kodun
> yazılacağı mali müşavirin kararıdır. Ekranda da bu yazıyor.

İki yönlü tutarlılık kuralı: istisna kodu varken KDV oranı 0 olmalı; KDV oranı 0 iken
istisna kodu **zorunlu**. Böylece "sıfır KDV'li ama gerekçesiz" belge üretilemiyor.

**2. KDV tevkifatı** — satırda `tevkifatKodu` + `tevkifatOrani`.
Oran **KDV tutarı üzerinden** uygulanır (matrah üzerinden değil):

```
tevkifat = kdvTutarı × tevkifatOranı / 100
ödenecek = matrah + kdv − tevkifat
```

`cac:WithholdingTaxTotal` bloğu hem satırda hem belge başında üretilir; tevkifatın
matrahı KDV tutarıdır. **`TaxInclusiveAmount` tevkifattan etkilenmez** — tevkifat yalnızca
`PayableAmount`'ı düşürür. Bu ayrım testle sabitlendi.

Kural: tevkifatlı satır varsa fatura tipi `TEVKIFAT` olmalı; KDV'siz satıra tevkifat uygulanamaz.

**3. İade referansı** — `iadeFaturalar[]` → her biri için `cac:BillingReference`.
`IADE` tipinde en az bir dayanak zorunlu; başka tipte kullanılırsa reddediliyor.

**4. Döviz kuru** — TRY dışı belgede `dovizKuru` zorunlu → `cac:PricingExchangeRate`
(`SourceCurrencyCode` = belge para birimi, `TargetCurrencyCode` = TRY).
Kur verilmeden yabancı para belgesi üretilemiyor.

#### Özel matrah neden hâlâ kapalı

`OZELMATRAH` tipi hem üreteçte hem e-Arşiv akışında **açıkça reddediliyor**.
Diğer dördünün yapısını `UBLTR-Invoice-2_1.cs`'den doğrulayabildim; özel matrahın UBL-TR'de
nasıl ifade edildiğini **doğrulanmış bir örnekle görmeden yazmayacağım**. Kuyumcuda altın
satışında özel matrah yaygın olduğu için bu, kapatılması gereken bir eksik olarak duruyor.

> Gereken: özel matrahlı, GİB'den geçmiş bir örnek UBL (ICE'den veya mali müşavirden).

`IHRACKAYITLI` de aynı gerekçeyle e-Arşiv akışında kapalı.

#### e-Arşiv kısıtı gevşetildi

Önceki hâli: yalnızca **TRY / SATIS / pozitif KDV**.
Yeni hâli: `SATIS`, `IADE`, `TEVKIFAT`, `ISTISNA` + dövizli belgeler açık;
yalnızca `OZELMATRAH` ve `IHRACKAYITLI` kapalı.

#### Arayüz

`EBelgeDogrulaPage` ekranında:
- Fatura tipi `IADE` seçilince **iade referansı** satırları (ekle/sil) çıkıyor
- Para birimi TRY dışına çıkınca **TL karşılığı kur** alanı zorunlu oluyor
- Satır tablosuna **İstisna Kodu** sütunu eklendi; KDV 0 değilse pasif, 0 ise kırmızı zorunlu
- Fatura tipi `TEVKIFAT` iken **Tevkifat (kod + %)** sütunu açılıyor
- Toplam şeridinde tevkifat ayrı satır olarak eksi değerle görünüyor
- KDV 0 olan satır varsa üstte "istisna kodunu mali müşavirinize teyit ettirin" uyarısı

#### Doğrulama

| | Sonuç |
|---|---|
| `ebelge-ubl-mali-test.ts` (yeni) | **18/18 geçti** |
| `ebelge-faz8-test.ts` | **25/25 geçti** — regresyon yok |
| `ebelge-giderpusulasi-test.ts` | **17/17 geçti** |
| **Toplam çevrimdışı test** | **60** |
| `tsc --noEmit` (backend + frontend) · `npm run build` | temiz |

Testlerin içinde **öğe sırası** doğrulamaları var: `BillingReference`'ın
`LineCountNumeric` ile `AccountingSupplierParty` arasında, `PricingExchangeRate`'in
`TaxTotal`'dan önce, `WithholdingTaxTotal`'ın `TaxTotal` ile `LegalMonetaryTotal`
arasında olduğu ayrı ayrı sınanıyor. Ayrıca **geriye dönük uyum** testi: sade bir SATIS
faturasında yeni blokların hiçbirinin sızmadığı doğrulanıyor.

Gerçek ICE çağrısı yapılmadı; hiçbir belge gönderilmedi.

### 16.12 Faz 7 çalışma notu — e-Fatura gönderimi (10.09.2026)

> ⚠️⚠️ **Bu faz belgeyi GİB'e iletir ve GERİ ALINAMAZ.** Fatura numarası ve kontör kalıcı
> olarak yanar. Düzeltmenin tek yolu alıcının red cevabı (ticari fatura, 8 gün) ya da
> iade faturasıdır.

Önceki durumda `send_invoice` ve `DraftApproval` **hiçbir yerde yazılı değildi** —
sistem taslak oluşturup iptal edebiliyor, fatura kesemiyordu. Bu faz o boşluğu kapattı.

**Yazılan / genişletilen:** `ice.efatura.ts` (+`sendInvoice`), `ebelge.service.ts`
(+`faturaGonder`, `taslakOnayla`, `gidenStatuYenile`, `aliciAliasCoz`),
`ebelge.controller.ts`, `ebelge.routes.ts`, `ebelgeService.ts`,
`EBelgeDogrulaPage.tsx`, `EBelgeGidenPage.tsx`.

**Eklenen uçlar:** `POST /giden/gonder` · `POST /giden/:uuid/onayla` · `GET /giden/:uuid/statu`

#### İki gönderim yolu

| Yol | Uç | Ne yapar |
|---|---|---|
| **Doğrudan** | `POST /giden/gonder` | UBL üretir, doğrular, GİB'e gönderir |
| **Taslak → onay** | `POST /giden/taslak` → `POST /giden/:uuid/onayla` | Belge önce görünür halde bekler, sonra onayla GİB'e gider |

İkinci yol daha güvenli: belge gönderilmeden önce giden kutusunda görülüp kontrol edilebilir.

#### e-Arşiv disiplini birebir uygulandı

numara ön kontrolü → UBL üret → `invoice_check_validate` → **alıcı alias çözümü** →
ICE son sıra kontrolü (`Get_Son_Belge_ID`, `EFatura`) → kontör → **SQL rezervasyonu** →
`send_invoice` → belge bazında sonuç doğrulama → durum geçişi.

- **Rezervasyon ICE çağrısından önce.** UNIQUE indeks yarışan ikinci isteği durdurur.
- **Bağlantı koparsa `BELIRSIZ`** — kayıt silinmez, numara serbest bırakılmaz, tekrar gönderim engellenir.
- **Başarı belge bazında doğrulanır:** üst `success` + satır `success` + iki doğrulama bayrağı +
  `ettn` ve `ID` eşleşmesi. Eksik/uyuşmayan yanıt "gönderildi" sayılmaz.

#### Taslak onayı (`DraftApproval`)

`TASLAK → ONAYLANIYOR` geçişi **ICE çağrısından önce** ve atomik yapılır; ikinci onay isteği
buradan geçemez. Bağlantı koparsa `BELIRSIZ` kalır — belge GİB'e gitmiş olabileceği için
otomatik geri alma **yapılmaz**, portal kontrolü istenir. ICE açıkça reddederse belge `TASLAK`
durumuna döner ve tekrar denenebilir.

#### Alıcı alias çözümü

`getUserList_EFatura` ile alınır. **Başarısız sorgu "mükellef değil" sayılmaz** — gönderim durur.
Alıcı mükellef değilse *"e-Arşiv fatura kesilmelidir"* denir ve gönderim yapılmaz.

#### Arayüz

Doğrulama ekranında, belge doğrulamadan geçtikten sonra iki düğme çıkar:
**Taslak Oluştur** (mavi) ve **GİB'e Gönder** (kırmızı). Onay panelinde alıcı, belge no ve
**backend'in hesapladığı tutar** tekrar gösterilir; geri alınamazlık açıkça yazar.

Giden kutusunda e-Fatura taslaklarının satırında **gönder simgesi** belirir; tıklanınca aynı
disiplinde ikinci bir onay paneli açılır.

---

### 16.13 Faz 9 çalışma notu — e-İrsaliye (10.09.2026)

#### Yapı nereden doğrulandı

Tahmin edilmedi. ICE paketindeki UBL-TR şema sınıfından okundu:
`ICE_INTAGRATION_v1.0.3/.../UBL/UBLTR-Delivery-2_1.cs`

| Tip | Şemadan okunan sequence |
|---|---|
| `DespatchAdviceType` | `… IssueTime → DespatchAdviceTypeCode → Note[] → LineCountNumeric → OrderReference[] → … → DespatchSupplierParty → DeliveryCustomerParty → … → Shipment → DespatchLine[]` |
| `DespatchLineType` | `ID → Note[] → DeliveredQuantity → … → Item → Shipment[]` |
| `ShipmentStageType` | `… → TransportMeans → DriverPerson[]` |
| `RoadTransportType` | `LicensePlateID` |

#### Faturadan en önemli farkı: **tutar yok**

`DespatchLine` içinde `Price`, `LineExtensionAmount` veya `TaxTotal` **bulunmaz**.
İrsaliye yalnızca sevk edilen miktarı ve mal bilgisini taşır. Üreteçte hiçbir parasal hesap
yapılmıyor; testlerden biri faturaya özgü altı parasal öğenin hiçbirinin sızmadığını doğruluyor.

Taraf öğeleri de farklı: `DespatchSupplierParty` / `DeliveryCustomerParty`
(faturadaki `AccountingSupplierParty` / `AccountingCustomerParty` değil).

#### Mükellefiyet ayrı sorgulanır

**e-Fatura mükellefiyeti ile e-İrsaliye mükellefiyeti aynı şey değildir.** Bu yüzden
`getUserList_EFatura` yerine **`getUserList_DespatchAdvice`** kullanılıyor. Alıcı e-İrsaliye
mükellefi değilse *"kâğıt irsaliye düzenlenmelidir"* denip gönderim durduruluyor.

#### Ön doğrulama VAR

Gider pusulasının aksine e-İrsaliyede `despatchadvice_check_validate` ucu bulunuyor.
Bu sayede "önce doğrulat, geçerse gönder" güvencesi burada da uygulanıyor.

#### Yazılanlar

```
src/services/ice/ubl/despatchAdviceBuilder.ts   DespatchAdvice üreteci + doğrulama
src/services/ice/ice.irsaliye.ts                8 ICE operasyonu
src/pages/ebelge/EBelgeIrsaliyePage.tsx         ekran
scripts/ebelge-irsaliye-test.ts                 14 çevrimdışı test
```
Genişletilen: `ebelge.service.ts`, `ebelge.controller.ts`, `ebelge.routes.ts`,
`ebelge.schema.ts`, `ebelgeService.ts`, `EBelgeHomePage.tsx`, `src/App.tsx` (+1 route).

**Eklenen uçlar:** `POST /irsaliye/dogrula` · `POST /irsaliye/gonder` ·
`GET /irsaliye/mukellef` · `GET /irsaliye` · `GET /irsaliye/statu` · `GET /irsaliye/:ettn/pdf`

#### İş kuralları

- **Fiili sevk tarihi zorunlu** ve düzenleme tarihinden önce olamaz.
- **Plaka veya taşıyıcı firmadan en az biri zorunlu** — taşıma bilgisi olmadan irsaliye olmaz.
- Şoför bildirilirse ad+soyad zorunlu; TCKN verilirse 11 hane.
- Teslimat adresi verilmezse alıcının adresi kullanılır.

#### Ekran

`/e-belge/irsaliye` — belge bilgileri, alıcı (yanında mükellefiyet sorgulama düğmesi),
sevkiyat (tarih/saat/plaka/şoför/taşıyıcı) ve **fiyatsız** mal satırları.
Önce **Doğrula**, geçerse **GİB'e Gönder** düğmesi çıkar; gönderim iki adımlı onayla yapılır.
Form değişince eski doğrulama geçersiz olur, işlem sırasında alanlar kilitlenir.

#### Doğrulama

| | Sonuç |
|---|---|
| `ebelge-irsaliye-test.ts` (yeni) | **14/14 geçti** |
| `ebelge-ubl-mali-test.ts` | 18/18 |
| `ebelge-giderpusulasi-test.ts` | 17/17 |
| `ebelge-faz8-test.ts` | 25/25 — regresyon yok |
| **Toplam çevrimdışı test** | **74** |
| backend + frontend `tsc --noEmit` · `npm run build` | temiz |

Testler arasında **şema sırası** doğrulamaları var (`ShipmentStage` → `Delivery`,
`OrderReference`ın `LineCountNumeric` ile `DespatchSupplierParty` arasında olması) ve
**tutar sızmadığı** kontrolü bulunuyor.

Gerçek ICE çağrısı yapılmadı; hiçbir belge gönderilmedi.

> **Not:** `Backend/scripts/masak-parse-test.ts` bu paketin parçası değildir — klasör argümanı
> bekleyen bir MASAK yardımcı aracıdır, test değildir; dokunulmadı.

#### e-İrsaliye için kalan iş

- Gelen irsaliyeye **yanıt** verme (`send_ReceiptAdvice`) yazılmadı. Gelen irsaliye listesi
  okunabiliyor ama kabul/red yanıtı gönderilemiyor. e-Faturadaki `invoice_Red_Kabul`ün
  karşılığı ayrı bir belgedir; ayrı üreteç gerekir.
- Gelen irsaliyeler yerel tabloya aynalanmıyor; liste doğrudan ICE'den okunuyor.

---

### 16.14 Özel matrah — neden hâlâ kapalı (10.09.2026)

Kullanıcı ICE portalinde kontrol etti: **fatura oluşturma formunda `ÖZELMATRAH` seçeneği var,
ancak firmada bugüne kadar hiç fatura kesilmemiş** — dolayısıyla arşivden indirilebilecek
örnek bir özel matrah UBL'i yok.

Elimizdeki `UBLTR-Invoice-2_1.cs` şema sınıfı özel matrahın hangi öğeyle ifade edildiğini
göstermiyor; `TaxCategory` içindeki istisna alanları ile mi, ayrı bir yapıyla mı taşındığı
belirsiz. **Doğrulanmış örnek görmeden yazılmayacak** — bu turda işe yarayan disiplin budur.

`OZELMATRAH` ve `IHRACKAYITLI` tipleri hem üreteçte hem gönderim akışlarında açıkça
reddediliyor; kullanıcı anlaşılır bir hata mesajı alıyor.

**Kapatmak için gereken:** özel matrahlı, GİB'den geçmiş bir örnek UBL. Kaynak olabilecek yerler:
ICE destek ekibi, mali müşavir, ya da portalde özel matrahlı bir belge **taslak** olarak
oluşturulup XML'inin indirilmesi.

### 16.15 Son kontrol ve kapatılan eksikler (10.09.2026)

#### Kod denetimi — hafızadan değil, koddan doğrulandı

| Kontrol | Sonuç |
|---|---|
| Router bağlı mı | ✅ `apiRouter.use("/e-belge", ebelgeRoutes)` |
| Uç sayısı | **35** |
| Rotada kullanılan denetleyici metodu / tanımlı metot | **36 / 36** — eksik yok |
| Frontend sayfa / route | **7 sayfa · 7 route**, hub'daki 5 kart aktif |
| Backend `tsc --noEmit` · `npm run build` | temiz, `dist` çıktıları yerinde |
| Frontend `tsc --noEmit` · `vite build` | temiz |
| Çevrimdışı test | **74/74 geçiyor** |
| Rota gölgelenmesi | Yok — literal ve `:param` yolları segment sayısına göre ayrışıyor |

#### Bu turda kapatılan iki eksik

**1. e-Arşiv e-posta gönderimi (`Send_Document_Email`)**

Önceden yalnızca mail **durumu okunuyordu** (`GetInvoice_EMail_Statu`); mail **gönderimi yoktu**.
Şema canlı WSDL'den doğrulandı:

```
SendDocumentEmailRequest → DocumentEmailRequestList → DocumentEmailRequest[]
  ID · UUID · DocumentType · EmailRecipientList → EmailRecipient[] (Title · Email)
```

`EmailDocumentType` enum'u da WSDL'den alındı (18 değer). Belge türü otomatik eşleniyor:
`EArsiv → EArsiv`, `EFatura → EFatura_Giden`, `EIrsaliye → EIrsaliye_Giden`,
`EGiderPusulasi → EGiderPusulasi`.

**Uç:** `POST /giden/:uuid/mail` — gövde `{ alicilar: [{ eposta, unvan? }] }`

Kurallar:
- Yalnızca `GONDERILDI` durumundaki belgeler için açık
- E-posta biçimi doğrulanıyor, en fazla 20 alıcı
- **Otomatik yeniden deneme KAPALI** — aksi halde alıcıya iki kez mail gider
- ICE hiç sonuç döndürmezse "gönderildi" sayılmıyor; kısmi başarıda kaç alıcıya
  gittiği ve kaçında hata olduğu ayrı ayrı bildiriliyor

Arayüz: giden kutusunda gönderilmiş belgelerin satırında **zarf simgesi**. Tıklanınca
adres girme paneli açılıyor; panelde *"her basışta yeniden mail gider"* uyarısı var.

**2. e-İrsaliye PDF düğmesi**

`GET /irsaliye/:ettn/pdf` ucu vardı ama ekranda düğmesi yoktu. İrsaliye gönderildikten
sonra başarı kutusunun içinde **PDF Aç** düğmesi çıkıyor.

Bu sırada PDF indirme mantığındaki tekrar da temizlendi: gelen fatura, e-Arşiv ve irsaliye
PDF'leri artık tek bir `ebelgePdfBlobUrl(yol)` yardımcısını kullanıyor (kimlik başlıklarıyla
`fetch` → blob; düz bağlantı 401 alır).

#### Bilerek yapılmayan

**Gelen irsaliyeye yanıt** (`send_ReceiptAdvice`, `GetReceiptAdvice`,
`Set_ReceiptAdvice_Status`) — kullanıcı kararıyla kapsam dışı bırakıldı (10.09.2026).
Gelen irsaliyeler listelenebiliyor ama kabul/red yanıtı gönderilemiyor.
e-Faturadaki `invoice_Red_Kabul`ün karşılığı burada **ayrı bir belgedir**; ayrı üreteç gerekir.

#### Sunucuda denemeden önce üç şart

1. **`EBELGE_ENC_KEY`** — kontrol edildi, `Backend/.env` içinde **yok**.
   `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` çıktısı
   sunucudaki `.env`'e eklenmeli. Anahtar yokken şifre kaydedilmiyor (bilerek).
2. **ICE kullanıcı adı/şifresi** — ayar ekranından girilmeli.
3. **`NODE_ENV=production`** — doğrulanmalı. Değilse `auth.middleware.ts` token'sız isteği
   `admin` sayıyor (§11.2 M1); mali uçları bu doğrulanmadan açmak riskli.

**Önerilen deneme sırası:** bağlantı testi → gelen kutusu senkronizasyonu (salt okuma) →
doğrulama ekranı (belge göndermez) → taslak → gerçek gönderim.

### 16.17 Canlı test ortamında bulunan iki UBL hatası (10.09.2026)

ICE test ortamında (`integrationtest.iceteknoloji.com.tr`) ilk gerçek
`invoice_check_validate` çağrısı iki hata ortaya çıkardı. İkisi de çevrimdışı
testlerle yakalanamazdı, çünkü ICE'in kendi serileştiricisinden kaynaklanıyorlar.

**1. `ext` öneki bildirilmemiş**

> The prefix "ext" for element "ext:UBLExtensions" is not bound.

ICE, belgeye imza koymak için kök elemanın başına `<ext:UBLExtensions>` enjekte
ediyor. Kökte `xmlns:ext` bildirimi olmadığı için XML parse edilemiyordu.
GİB'in kendi örnek XML'lerinde bu blok bulunmuyor — bu yüzden gözden kaçmıştı.

Çözüm: üç üretece de (`Invoice`, `CreditNote`, `DespatchAdvice`) hem
`xmlns:ext` bildirimi hem UBL-TR'nin istediği boş iskelet ilk çocuk eleman
olarak eklendi.

**2. Adreste il/ilçe zorunlu**

> 'PostalAddress' öğesi geçersiz 'Country' alt öğesine sahip.
> Beklenen: ... CitySubdivisionName

UBL-TR `AddressType`'ta `CitySubdivisionName` (ilçe) ve `CityName` (il)
zorunludur; bizde ikisi de opsiyoneldi.

Gönderici tarafında sorun daha derindi: firma bilgisi `TODVZ_TANIM`'dan
okunuyor ve o tabloda il/ilçe kolonu **yok**. Başka ekibin tablosuna kolon
eklemek kapsam dışı olduğu için alanlar kendi ayar tablomuza taşındı:

| Kolon | Tablo |
|---|---|
| `FIRMA_IL` | `TODVZ_EBELGE_AYAR` |
| `FIRMA_ILCE` | `TODVZ_EBELGE_AYAR` |

Mevcut kurulumlarda `COL_LENGTH` kontrollü `ALTER TABLE` ile otomatik ekleniyor;
elle müdahale gerekmiyor. Ayar ekranına iki alan, doğrulama ekranındaki il/ilçe
alanlarına zorunluluk işareti eklendi.

**Not:** İlk `check_validate` çağrısında Schematron (GİB iş kuralları) **geçti**;
takılan yalnızca XSD'ydi. Yani mali mantık doğru kurulmuş, sorun biçimseldi.

### 16.16 Mevcut ekranlarda görülen arayüz tutarsızlıkları — **rapor, düzeltme yapılmadı**

Arayüz standardını çıkarırken, mevcut ekranlar arasında da küçük sapmalar göründü.
Bunlar **başka arkadaşların dosyaları**; talimat gereği dokunulmadı. e-Belge ekranları
hangisini örnek alacağını bilsin diye kaydedildi (karar #15).

| # | Sapma | Nerede | Etkisi |
|---|---|---|---|
| **A1** | Sayfa kabı iki farklı ölçüde: `container-fluid px-2 py-2` ve `container-fluid py-2 px-3` | Banknot vs MASAK sayfaları | Sayfalar arası geçişte içerik **1 px kayıyor** |
| **A2** | MASAK sayfası `ERPToolbar` kullanmıyor, kendi başlık şeridini kuruyor | `MasakListsPage.tsx:119-166` | O ekranda `F1-F10` kısayolları çalışmıyor, başlık şeridi diğerlerinden farklı görünüyor |
| **A3** | `ROUTE_PAGE_MAP`'te MASAK yolları yok | `ERPToolbar.tsx:44-76` | Toolbar kullanılsa bile başlık boş kalırdı |
| **A4** | Seçili satır rengi `#bae6fd` **beş ayrı dosyada** elle tekrarlanmış | `_user.scss` + Banknot + diğer sayfalar | Renk değişecek olsa beş yerde aranması gerekir; bir CSS değişkeni (`--erp-row-selected`) daha sağlıklı olurdu |
| **A5** | SCSS'te `$primary: #00a76f` (yeşil) ama ekranlarda fiilen `#0284c7` (mavi) kullanılıyor; `--bs-primary` çalışma anında kullanıcı menü rengiyle eziliyor | `theme/_variables.scss:41,55` vs `UserThemeApplier.tsx` | `text-primary` sınıfının rengi ekrandan ekrana **öngörülemez**. **e-Belge'de `text-primary` yerine açık renk yazılacak** |

> **Not:** e-Belge ekranları **A1 için Banknot ölçüsünü** (`px-2 py-2`), **A2 için `ERPToolbar`'ı**
> örnek alacak — yani çoğunluğun ve en yeni yazılan ekranların düzeni esas kabul edildi.
>
> **Karar #15 (09.09.2026):** Bu sapmalar **düzeltilmeyecek**, dosya sahiplerine bırakıldı.
> Tablo yalnızca bilgi amaçlıdır.

---

### 16.18 e-İrsaliye alıcı ad/soyad alanları (10.09.2026)

Canlı ekranda 11 haneli alıcı TCKN'si için backend ad/soyad isterken formda yalnızca
unvan alanı bulunuyordu. Şoförün ad/soyadı ayrı sevkiyat alanları olduğu için bu
gereksinimi karşılamıyordu. Alıcı Ad / Alıcı Soyad alanları eklendi; doğrulama ve
gönderimin ortak istek gövdesine bağlandı. TCKN için ad/soyad ön kontrolü eklendi,
unvan zorunluluğu kaldırıldı. Yeni alanların değişmesi eski doğrulamayı ve gönderim
onayını geçersiz kılar; onay paneli TCKN'li alıcının ad/soyadını gösterir.
Bu düzeltmede gerçek belge gönderilmedi. Kullanıcı isteğiyle Markdown dosyaları
commit/push kapsamı dışındadır.

### 16.19 e-İrsaliye canlı XSD/Schematron hataları (10.09.2026)

- DespatchLine içinde Item öncesinde zorunlu OrderLineReference/LineID eklendi.
  ICE örneğindeki gibi LineID satır sırasını kullanır; sipariş numarası uydurulmaz.
- Fiili sevk bilgisi ActualDeliveryDate/Time yerine
  Shipment/Delivery/Despatch/ActualDespatchDate ve ActualDespatchTime altında yazılır.
  Sevk saati zorunlu ve saat/dakika/saniye aralığı doğrulanır.
- Teslimat Posta Kodu alanı forma, API şemasına ve XML DeliveryAddress/PostalZone
  alanına bağlandı. Beş hane zorunludur; il/ilçe alıcıdan devralınır.
- LicensePlateID için schemeID=PLAKA, şoför NationalityID için schemeID=TCKN
  eklendi. Plaka boşlukları temizlenir ve büyük harfle yazılır.
- Kaynak: ICE_INTAGRATION_v1.0.3 içindeki Models/EIrsaliye/Irsaliye.cs ve
  UBL/UBLTR-Delivery-2_1.cs. Sevk XML yolu ve plaka schemeID zorunluluğu ayrıca
  [GİB Karekod Standardı](https://ebelge.gib.gov.tr/dosyalar/kilavuzlar/Karekod_veya_Barkod_Standardi_Kilavuzu_V.1.0.pdf)
  ile karşılaştırıldı.
- 79 çevrimdışı test ve iki TypeScript kontrolü geçti. Bu testler tam GİB XSD ve
  Schematron motorunun yerine geçmez; canlı Doğrula adımı tekrar denenmelidir.
  Gerçek belge gönderilmedi. Markdown kullanıcı isteğiyle push kapsamı dışındadır.

## 17. Canlı Doğrulama Kontrol Listesi

> **Karar #12:** Canlı testler faz faz değil, kodlama bittiğinde **tek oturumda** koşulacak.
> Her faz kendi maddelerini buraya ekler. Sıra yukarıdan aşağıya, **tek tek ve onaylı**.

### Ön koşullar
- [ ] Sunucudaki `Backend/.env` içine `EBELGE_ENC_KEY` (64 karakter hex) eklendi
- [ ] Uygulama yeniden başlatıldı
- [ ] **E-Belge → Bağlantı Ayarları**'ndan ICE kullanıcı adı/şifresi girildi ve kaydedildi
- [ ] "Bağlantı aktif" anahtarı açıldı

### Faz 1-2 — Altyapı ve ayarlar
| # | Adım | Beklenen | Durum |
|---|---|---|---|
| 1 | Bağlantıyı Test Et | `Health = OK` · giriş başarılı · kalan kontör görünüyor | ⬜ |
| 2 | Şifreyi bilerek yanlış girip test et | 401, hatalı deneme sayısı ekranda; **art arda denenmiyor** | ⬜ |
| 3 | Doğru şifreyi tekrar kaydet | Uyarı kalkıyor, test yeniden geçiyor | ⬜ |
| 4 | Ayar ekranı "Son İşlemler" | Kayıtlar görünüyor, **hiçbirinde şifre/oturum bilgisi yok** | ⬜ |
| 5 | Veritabanında `TODVZ_EBELGE_AYAR` | `SIFRE_SIFRELI` binary; düz metin şifre **yok** | ⬜ |

### Faz 3 — Gelen kutusu (okuma)
| # | Adım | Beklenen | Durum |
|---|---|---|---|
| 6 | Senkronize Et (son 30 gün) | Belgeler geliyor; mesajda ICE toplam / çekilen / yazılan sayıları | ⬜ |
| 7 | Tarih aralığını daralt, tekrar senkronize | **Daha az kayıt** geliyor → `START_DATESpecified` gerçekten çalışıyor | ⬜ |
| 8 | Listede tutar / unvan / GİB statüsü | Dolu ve doğru görünüyor (UBL ayrıştırmadan) | ⬜ |
| 9 | Bir belgeye çift tıkla | Detay açılıyor, HTML görüntü iframe'de geliyor | ⬜ |
| 10 | "PDF Aç" | PDF yeni sekmede açılıyor (401 almıyor) | ⬜ |
| 11 | "Statüyü Yenile" | GİB statüsü güncelleniyor | ⬜ |
| 12 | Tekrar senkronize et | Mevcut kayıtlar **çoğalmıyor**, güncelleniyor (MERGE) | ⬜ |

### Faz 4 — Kabul / Red
> Bu bölüm **gerçek bir ticari faturaya** cevap gönderir ve **geri alınamaz**.
> Kullanıcı onayı alınmadan koşulmaz; tercihen düşük tutarlı / test amaçlı bir belgeyle.

| # | Adım | Beklenen | Durum |
|---|---|---|---|
| 13 | Temel senaryo faturasını aç | Kabul/Red düğmeleri **görünmüyor** | ⬜ |
| 14 | Ticari faturada "Reddet" → açıklama boş | Gönder düğmesi **pasif** | ⬜ |
| 15 | Açıklama yazıp gönder | Cevap gidiyor, rozet "Red" oluyor, kullanıcı+saat yazıyor | ⬜ |
| 16 | Aynı belgeye tekrar cevap dene | **409** — "zaten cevap verilmiş" | ⬜ |
| 17 | `user` rolüyle cevap dene | **403** | ⬜ |
| 18 | Okundu/İşlendi işaretle | ICE kabul ediyor, yerel bayrak güncelleniyor | ⬜ |

### Faz 5 — UBL üretimi ve doğrulama (belge GÖNDERİLMEZ)
| # | Adım | Beklenen | Durum |
|---|---|---|---|
| 19 | Doğrulama ekranında örnek fatura gir → **Doğrula** | `shema_validate` **ve** `shematron_validate` = true | ⬜ |
| 20 | Dönen HTML önizleme | Belge doğru görünüyor; tutarlar ekrandaki ile aynı | ⬜ |
| 21 | Schematron hatası veren bir girdi dene (ör. eksik vergi dairesi) | Hata mesajı okunabilir şekilde ekrana geliyor | ⬜ |
| 22 | `GET /giden/son-belge-no?seri=ABC` | ICE'deki son numara dönüyor | ⬜ |
| 23 | Doğrulamadan sonra gelen kutusunu senkronize et | **Yeni belge oluşmamış** — doğrulama gerçekten göndermiyor | ⬜ |

### Faz 6 — Taslak hattı (ICE'de kayıt oluşur, GİB'e GİTMEZ)
| # | Adım | Beklenen | Durum |
|---|---|---|---|
| 24 | `GET /mukellef?vkn=…` bilinen bir mükellef VKN'si ile | Alias listesi geliyor | ⬜ |
| 25 | Mükellef olmayan bir VKN ile taslak dene | "e-Arşiv kesilmelidir" uyarısı, taslak oluşmuyor | ⬜ |
| 26 | Doğrulamadan geçen belge → **Taslak Oluştur** | Taslak oluşuyor, ETTN dönüyor | ⬜ |
| 27 | ICE portalinde belgeyi kontrol et | Belge **taslak** durumunda, GİB'e gitmemiş | ⬜ |
| 28 | Aynı fatura numarasıyla ikinci taslak dene | **409** — numara zaten kullanılmış | ⬜ |
| 29 | Giden kutusundan taslağı **iptal et** | Durum "İptal" oluyor, ICE'de taslak siliniyor | ⬜ |
| 30 | Doğrulamadan geçmeyen belgeyle taslak dene | Taslak oluşmuyor, hata mesajı geliyor | ⬜ |

### Faz 8a — e-Arşiv (MALİ SONUÇ DOĞURUR)
> Bu bölüm **gerçek fatura keser**. Kullanıcı onayı olmadan koşulmaz; düşük tutarlı,
> gerçekten kesilmesi gereken bir belge ile yapılmalıdır.

| # | Adım | Beklenen | Durum |
|---|---|---|---|
| 31 | Senaryo `EARSIVFATURA` seç → doğrula | Şema + schematron geçiyor | ⬜ |
| 32 | Onay panelinde alıcı ve tutar kontrolü | Ekranda doğru görünüyor, düğme kırmızı | ⬜ |
| 33 | **e-Arşiv Gönder** | ETTN dönüyor, giden kutusunda "Gönderildi" | ⬜ |
| 34 | `GET /earsiv/durum` | Raporlanma ve e-posta durumu geliyor | ⬜ |
| 35 | `GET /earsiv/:uuid/pdf` | PDF açılıyor | ⬜ |
| 36 | Aynı numarayla ikinci e-Arşiv dene | **409** | ⬜ |
| 37 | *(gerekiyorsa)* iptal bildirimi gönder | Durum "İptal", ICE kabul ediyor | ⬜ |

### Faz 8d — e-Gider Pusulası (MALİ SONUÇ DOĞURUR, ÖN DOĞRULAMA YOK)
> ICE'de bu belge türü için `check_validate` ucu bulunmuyor; hatalı belge ancak
> gönderimden sonra anlaşılır. Düşük tutarlı gerçek bir alımla denenmelidir.

| # | Adım | Beklenen | Durum |
|---|---|---|---|
| 38 | `GET /mukellef` ile karşı tarafın mükellef olmadığı teyit | Boş liste dönüyor | ⬜ |
| 39 | `POST /gider-pusulasi/gonder` (SATIS, hurda altın) | Kabul ediliyor, durum `GONDERILDI` | ⬜ |
| 40 | ICE portalinde belge görünümü | `CreditNote` / `GIDERPUSULASI` olarak görünüyor | ⬜ |
| 41 | **Stopaj kodu ve oranı** portaldeki görüntüde doğru mu | Mali müşavir onayı | ⬜ |
| 42 | `GET /gider-pusulasi/:uuid/pdf` | PDF açılıyor | ⬜ |
| 43 | Aynı numarayla ikinci gönderim | **409** | ⬜ |
| 44 | Mükellef bir VKN ile gönderim dene | Reddediliyor ("fatura düzenlenmelidir") | ⬜ |
| 45 | Kontör bilgisi cevapta | `kontorKalan` dolu ya da `kontorUyari` açıklayıcı | ⬜ |

### UBL mali alanları — canlı doğrulama (belge GÖNDERİLMEZ, yalnızca `invoice_check_validate`)
> Bu bölüm doğrulama ucunu kullanır; hiçbir belge gönderilmez. Önce bunlar geçmeden
> mali alanlı gerçek belge gönderilmemelidir.

| # | Adım | Beklenen | Durum |
|---|---|---|---|
| 49 | İstisnalı satır (KDV 0 + kod) ile doğrula | Şema + schematron geçiyor | ⬜ |
| 50 | **İstisna kodunun doğruluğu** — mali müşavir teyidi | Kod külçe altın teslimine uygun | ⬜ |
| 51 | Tevkifatlı fatura doğrula | `WithholdingTaxTotal` kabul ediliyor, ödenecek tutar doğru | ⬜ |
| 52 | İade faturası doğrula (dayanak fatura no ile) | `BillingReference` kabul ediliyor | ⬜ |
| 53 | USD fatura + kur ile doğrula | `PricingExchangeRate` kabul ediliyor | ⬜ |
| 54 | Karma: istisnalı + KDV'li satır aynı belgede | İki ayrı `TaxSubtotal` kabul ediliyor | ⬜ |
| 55 | Özel matrah dene | Uygulama **reddediyor** (henüz desteklenmiyor mesajı) | ⬜ |

### Faz 7 — e-Fatura gönderimi (GİB'E GİDER, GERİ ALINAMAZ)
> Bu bölüm **gerçek fatura keser**. Önce §17'deki doğrulama maddeleri geçmeli.
> Tercihen düşük tutarlı, gerçekten kesilmesi gereken bir belgeyle.

| # | Adım | Beklenen | Durum |
|---|---|---|---|
| 56 | Mükellef bir alıcı için doğrula → **Taslak Oluştur** | Taslak oluşuyor | ⬜ |
| 57 | Giden kutusundan taslağı **onayla** | Durum `GONDERILDI`, ICE portalinde belge GİB'e gitmiş | ⬜ |
| 58 | Onaylanmış belgeyi tekrar onaylamayı dene | Reddediliyor (durum TASLAK değil) | ⬜ |
| 59 | `GET /giden/:uuid/statu` | GİB statüsü geliyor | ⬜ |
| 60 | Doğrudan **GİB'e Gönder** ile ikinci fatura | Gönderiliyor, ETTN dönüyor | ⬜ |
| 61 | Aynı numarayla tekrar gönderim | **409** | ⬜ |
| 62 | Mükellef olmayan VKN ile gönderim dene | "e-Arşiv kesilmelidir" uyarısı | ⬜ |

### Faz 9 — e-İrsaliye
| # | Adım | Beklenen | Durum |
|---|---|---|---|
| 63 | `GET /irsaliye/mukellef?vkn=` | e-İrsaliye etiketi geliyor (e-Faturadan ayrı) | ⬜ |
| 64 | İrsaliye **doğrula** | Şema + schematron geçiyor, önizleme geliyor | ⬜ |
| 65 | Plaka/taşıyıcı boş bırakıp doğrula | Reddediliyor | ⬜ |
| 66 | Sevk tarihi düzenleme tarihinden önce | Reddediliyor | ⬜ |
| 67 | **GİB'e Gönder** | Gönderiliyor, ETTN dönüyor | ⬜ |
| 68 | `GET /irsaliye?yon=IN` | Gelen irsaliyeler listeleniyor | ⬜ |
| 69 | `GET /irsaliye/:ettn/pdf` | PDF açılıyor | ⬜ |
| 70 | ICE portalinde irsaliye görünümü | Tutar alanı **yok**, sevk bilgileri doğru | ⬜ |

### e-posta gönderimi
| # | Adım | Beklenen | Durum |
|---|---|---|---|
| 71 | Gönderilmiş bir belgede **zarf simgesi** → kendi adresine gönder | Mail geliyor, ek doğru belge | ⬜ |
| 72 | Birden çok adres (virgüllü) | Hepsine gidiyor, sayı doğru raporlanıyor | ⬜ |
| 73 | Geçersiz adres | Reddediliyor | ⬜ |
| 74 | Taslak durumundaki belgede mail dene | Reddediliyor (yalnızca GONDERILDI) | ⬜ |
| 75 | İrsaliye gönderimi sonrası **PDF Aç** | PDF açılıyor | ⬜ |

### Genel güvenlik
| # | Adım | Beklenen | Durum |
|---|---|---|---|
| 76 | Token'sız `POST /gelen/:uuid/cevap` | **401** — sunucuda `NODE_ENV=production` olduğu teyit edilerek | ⬜ |
| 77 | Sunucu log dosyalarında şifre/oturum araması | Sonuç yok | ⬜ |
| 78 | Ayarlarda `http://…` adres kaydetmeyi dene | Reddediliyor | ⬜ |

> **Not (§11.2 M1):** 76. madde, sunucuda `NODE_ENV` değişkeninin gerçekten `production`
> olmasına bağlı. Değilse `auth.middleware.ts` token'sız isteği `admin` sayar ve test yanıltıcı geçer.
> Bu dosya bize ait değil; testten önce ortam değişkeni **mutlaka doğrulanmalı**.

### Faz 8 denetiminden eklenen canlı/dağıtım kontrolleri — henüz çalıştırılmadı

| # | Adım | Beklenen | Durum |
|---|---|---|---|
| 41 | SQL yedeği/test kopyasında eski kurulumdan yeni indekse geçiş | `UX_TODVZ_EBELGE_GIDEN_NUMARA`, yalnız BELGE_NO üzerinde; yinelenen kayıtta veri silmeden hata | ⬜ |
| 42 | Doğrulamadan sonra alıcı/tutar/tür değiştir | Gönderim onayı kaybolur, yeniden doğrulama gerekir | ⬜ |
| 43 | Onay panelinin tutarını backend önizleme sonucu ile karşılaştır | `ozet.odenecekTutar` kullanılır | ⬜ |
| 44 | Mükellef ve ICE son sıra sorgularının gerçek yanıtlarını kontrol et | Mükellef sorgu başarısızlığı/numara çakışması gönderimi durdurur; yeni serinin yanıtı ayrıca doğrulanır | ⬜ |
| 45 | İzinli gerçek gönderimin ICE yanıtı | Tek satır başarı, doğrulama bayrakları, ETTN ve ID üretilen belgeyle eşleşir | ⬜ |
| 46 | Giden kutusunda Durum/PDF | Rapor ve mail sonuçları görünür, PDF kimlik başlıklarıyla açılır | ⬜ |
| 47 | Bir durum servisi erişilemez olduğunda | Kısmi hata görünür; iki hata boş başarılı sonuç sayılmaz | ⬜ |
| 48 | İzinli iptalin gönderilen tarihi ile SQL kaydını karşılaştır | İstenen iptal tarihi ve kullanıcı doğru saklanır | ⬜ |
| 49 | İşlem sırasında uygulama kapanması senaryosunu taklit servisle dene | Rezervasyon kalır; tekrar gönderim/iptal yapılmaz; portal mutabakatı gerekir | ⬜ |
| 50 | Özel matrah/istisna/tevkifat/iade/döviz/sıfır KDV denemesi | Henüz desteklenmediği açıkça belirtilir ve gerçek e-Arşiv gönderimi durur | ⬜ |

**19 çevrimdışı testin geçmesi bu canlı maddeleri tamamlamaz.** Gerçek belgelerde eşzamanlı gönderim
veya bağlantı kesme testi yapılmamalı; bunlar taklit servis ve SQL test kopyasıyla doğrulanmalıdır.
