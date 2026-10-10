import type { Icon } from "@tabler/icons-react";
import {
  IconArrowsExchange,
  IconBarcode,
  IconBox,
  IconBuildingBank,
  IconBuildingFactory2,
  IconBuildingSkyscraper,
  IconBuildingStore,
  IconChartBar,
  IconCloudComputing,
  IconCoins,
  IconCpu,
  IconCreditCard,
  IconCurrencyDollar,
  IconDatabase,
  IconDeviceTv,
  IconDiamond,
  IconFileInvoice,
  IconHierarchy2,
  IconId,
  IconLock,
  IconPackage,
  IconPlugConnected,
  IconReceipt,
  IconRefresh,
  IconScale,
  IconShieldCheck,
  IconTags,
  IconUsers,
} from "@tabler/icons-react";

/**
 * likyaerp.com ürün ailesi — tüm ürün içeriği tek dosyada (docs/LIKYAERP_TANITIM_SITESI.md K1–K3, K7).
 * Metinler mevcut modüllerden türetildi; düzeltme yalnız burada yapılır, sayfalar bu veriden çizilir.
 * Ekran verileri temsilidir (gerçek müşteri verisi değildir).
 */

export type UrunKodu = "erp" | "kuyum" | "gumus" | "doviz" | "ticari" | "connector";

export interface Ozellik {
  ikon: Icon;
  baslik: string;
  metin: string;
}

export interface TemsiliEkranVerisi {
  baslik: string;
  menu: string[];
  kpi: { etiket: string; deger: string; not?: string }[];
  tabloBaslik: string[];
  satirlar: string[][];
}

export interface Urun {
  kod: UrunKodu;
  ad: string;
  slug: string;
  ikon: Icon;
  /** Vurgu rengi ve açık zemin tonu */
  renk: string;
  renkAcik: string;
  /** Kartlarda tek cümle */
  kisa: string;
  /** Kartlarda üst etiket */
  etiket: string;
  baslik: string;
  aciklama: string;
  kimIcin: string[];
  oneCikanlar: Ozellik[];
  moduller: { baslik: string; maddeler: string[] }[];
  entegrasyonlar: string[];
  rakamlar: { deger: string; etiket: string }[];
  sss: { soru: string; cevap: string }[];
  ekran: TemsiliEkranVerisi;
}

export const URUNLER: Urun[] = [
  {
    kod: "erp",
    ad: "Likya.ERP",
    slug: "likya-erp",
    ikon: IconBuildingSkyscraper,
    renk: "#4f46e5",
    renkAcik: "#eef2ff",
    etiket: "Çatı Çözüm",
    kisa: "Kuyum, Gümüş, Döviz ve Ticari modüllerini tek merkezde birleştiren çok şubeli işletme çözümü.",
    baslik: "Tüm işletmeniz tek merkezde, ister birlikte ister ayrı",
    aciklama:
      "Likya.ERP, ürün ailesinin tamamını tek veritabanında buluşturur. Kuyum mağazanızı, döviz büronuzu ve toptan satışınızı aynı ekrandan yönetin; ihtiyacınız olmayan ürünü açmayın, büyüdükçe ekleyin.",
    kimIcin: [
      "Çok şubeli kuyum ve sarrafiye grupları",
      "Kuyum mağazası ile döviz bürosunu birlikte işletenler",
      "Toptan ve perakende satışı aynı çatıda yapanlar",
      "Grup şirketleri ve franchise yapıları",
    ],
    oneCikanlar: [
      { ikon: IconHierarchy2, baslik: "Tek merkez, çok şube", metin: "Şubeler arası virman ve transfer, merkezden anlık stok, kasa ve ciro izleme." },
      { ikon: IconBox, baslik: "Modüler lisans", metin: "Likya.Kuyum, Gümüş, Döviz ve Ticari'yi birlikte ya da ayrı ayrı açın; veriler hep aynı yerde." },
      { ikon: IconChartBar, baslik: "Konsolide raporlama", metin: "Has, döviz ve TL bazında tüm şubelerin kâr/zarar, stok ve pozisyon raporları tek tabloda." },
      { ikon: IconLock, baslik: "Rol bazlı yetki", metin: "Şube, kasa ve kullanıcı bazında menü, iskonto tavanı ve maliyet görme kısıtları." },
      { ikon: IconCloudComputing, baslik: "Hibrit çalışma", metin: "Bulut ve yerel SQL birlikte çalışır; internet kesilse de satış sürer, bağlantı gelince eşitlenir." },
      { ikon: IconFileInvoice, baslik: "Merkezi e-Belge", metin: "Tüm şubelerin e-Fatura, e-Arşiv ve e-Döviz belgeleri tek gönderim kuyruğundan GİB'e gider." },
    ],
    moduller: [
      { baslik: "Şube & Organizasyon", maddeler: ["Sınırsız şube ve kasa", "Şubeler arası stok ve para transferi", "Merkez onaylı fiyat listeleri", "Kullanıcı ve rol yönetimi"] },
      { baslik: "Finans", maddeler: ["Kasa, banka ve e-Banka", "Sanal POS ve ÖKC tahsilatı", "Kupür bazlı kasa sayımı", "Gider ve masraf kartları"] },
      { baslik: "Satış & Stok", maddeler: ["Vezne ve perakende satış", "Toptan satış ve sipariş", "Barkod, etiket ve sayım", "Üretim ve fason takibi"] },
      { baslik: "Yönetim & Rapor", maddeler: ["Konsolide kâr/zarar", "Şube ve personel performansı", "Has / döviz pozisyon raporu", "Excel, PDF ve e-posta ihracı"] },
    ],
    entegrasyonlar: ["GİB e-Fatura / e-Arşiv", "e-Döviz", "e-Banka", "Sanal POS", "ÖKC / POS cihazları", "Terazi", "Etiket yazıcı", "TV panosu"],
    rakamlar: [
      { deger: "6", etiket: "Ürün tek altyapıda" },
      { deger: "Sınırsız", etiket: "Şube ve kasa" },
      { deger: "Anlık", etiket: "Merkezden izleme" },
      { deger: "Hibrit", etiket: "Bulut + yerel SQL" },
    ],
    sss: [
      { soru: "Likya.ERP'yi almak için tüm ürünleri kullanmam gerekir mi?", cevap: "Hayır. Likya.ERP çatıdır; içindeki ürünleri ihtiyacınıza göre açarsınız. Yalnız Kuyum ve Döviz ile başlayıp ileride Ticari'yi ekleyebilirsiniz." },
      { soru: "Şu an tek ürün kullanıyorum, Likya.ERP'ye geçerken veri kaybı olur mu?", cevap: "Olmaz. Tüm Likya ürünleri aynı veritabanı yapısını kullanır; geçişte yalnız yeni modüller açılır, mevcut kayıtlar yerinde kalır." },
      { soru: "Şubelerden biri internetsiz kalırsa ne olur?", cevap: "Şube yerel SQL ile satışa devam eder. Bağlantı geldiğinde kayıtlar merkeze eşitlenir, bekleyen e-Belgeler gönderilir." },
    ],
    ekran: {
      baslik: "Konsolide Gösterge",
      menu: ["Gösterge", "Şubeler", "Kasa & Banka", "Stok", "e-Belge", "Raporlar"],
      kpi: [
        { etiket: "Bugünkü ciro", deger: "₺ 1.284.650", not: "+12%" },
        { etiket: "Has stok", deger: "12,48 kg" },
        { etiket: "Döviz pozisyonu", deger: "$ 84.200" },
        { etiket: "Bekleyen e-Belge", deger: "3" },
      ],
      tabloBaslik: ["Şube", "Ciro", "Has (gr)", "Durum"],
      satirlar: [
        ["Kapalıçarşı", "₺ 482.300", "2.140,52", "Açık"],
        ["Kuyumcukent", "₺ 396.150", "1.865,10", "Açık"],
        ["İzmir Kemeraltı", "₺ 241.900", "980,44", "Açık"],
        ["Döviz Bürosu", "₺ 164.300", "—", "Gün sonu"],
      ],
    },
  },
  {
    kod: "kuyum",
    ad: "Likya.Kuyum",
    slug: "likya-kuyum",
    ikon: IconDiamond,
    renk: "#b7791f",
    renkAcik: "#fdf6e7",
    etiket: "Kuyumcu & Sarraf",
    kisa: "Kuyumcu, sarraf ve atölyeler için vezne, has/milyem, etiket, canlı pano ve 3065 KDV uyumlu e-Belge.",
    baslik: "Modern kuyumculuk ve sarrafiye yönetimi",
    aciklama:
      "Gram, milyem, has altın ve döviz dengesini tek ekranda yönetin. Hassas teraziden anında tartım, tek fişte karma ödeme, kuyruk etiketi, 4K canlı fiyat panosu ve 3065 sayılı özel matrahlı e-Fatura.",
    kimIcin: ["Kuyum mağazaları", "Sarrafiye ve toptancılar", "Kuyum atölyeleri", "Kapalıçarşı ve Kuyumcukent esnafı"],
    oneCikanlar: [
      { ikon: IconScale, baslik: "Hassas milyem ve gramaj", metin: "24/22/18/14 ayar milyemleri, 0.0001 gr hassasiyet, RS232/USB terazi senkronizasyonu ve hurdada has karşılığı." },
      { ikon: IconCoins, baslik: "Karma ödeme ve takas", metin: "Tek fişte TL, döviz, hurda takası, kredi kartı ve veresiye. Kalan tutar F7 ile cariye." },
      { ikon: IconTags, baslik: "Barkod ve kuyruk etiketi", metin: "Zebra, Argox, TSC ve Godex yazıcılarla F10 sessiz baskı, toplu döküm ve el terminaliyle vitrin sayımı." },
      { ikon: IconDeviceTv, baslik: "4K canlı TV panosu", metin: "Mağaza televizyonunda canlı kurlar, kayan duyuru bandı ve logonuz; ek donanım gerekmez." },
      { ikon: IconShieldCheck, baslik: "3065 KDV ve MASAK", metin: "Has bedeli muaf, KDV yalnız işçilik üzerinden. 185.000 TL üzeri işlemde kimlik zorunluluğu." },
      { ikon: IconCreditCard, baslik: "e-Banka ve WhatsApp tahsilat", metin: "Banka hareketleri tek ekranda, 3D Secure ödeme linki WhatsApp ve SMS ile müşteriye." },
    ],
    moduller: [
      { baslik: "Vezne & Perakende", maddeler: ["Altın, ziynet, gümüş ve döviz satış/iade fişi", "F1–F12 kısayollar", "Kasa bazlı gün başı ve gün sonu", "Terazi senkronizasyonu"] },
      { baslik: "Barkod & Etiket", maddeler: ["Yüzük, bilezik, kolye ve set etiketi", "İşçilik, kâr ve milyem bazlı fiyat", "Sürükle-bırak etiket tasarımı", "Barkodlu vitrin sayım fişi"] },
      { baslik: "Canlı Kur & Pano", maddeler: ["Kapalıçarşı ve serbest piyasa kurları", "Kâr marjı ve makas ayarı", "Altın, gümüş, ziynet ve 30+ döviz", "Full HD / 4K tam ekran"] },
      { baslik: "Cari & Emanet", maddeler: ["TL, döviz ve has bakiyesi", "Emanet dekontu ve teslim fişi", "Ekstre ve mutabakat mektubu", "Risk limiti ve iskonto grubu"] },
      { baslik: "e-Belge", maddeler: ["e-Fatura ve e-Arşiv", "Has / işçilik KDV ayrımı", "XML / PDF ve e-posta gönderimi", "Gönderim kuyruğu ve durum takibi"] },
      { baslik: "Kasa & Rapor", maddeler: ["Kupür bazlı banknot sayımı", "Şube ve vezne virmanı", "Has, işçilik ve döviz kâr/zarar", "Stok devir hızı ve kritik stok"] },
    ],
    entegrasyonlar: ["Dikomsan / Desis / Radwag terazi", "Zebra / Argox / TSC / Godex", "GİB e-Fatura / e-Arşiv", "e-Banka", "Sanal POS", "ÖKC / POS cihazları", "Smart TV"],
    rakamlar: [
      { deger: "15+ Yıl", etiket: "Sektörel tecrübe" },
      { deger: "%99,9", etiket: "Hizmet sürekliliği" },
      { deger: "0.0001 gr", etiket: "Tartım hassasiyeti" },
      { deger: "F1–F12", etiket: "Klavye ile hızlı satış" },
    ],
    sss: [
      { soru: "Terazi ve barkod yazıcı nasıl bağlanıyor?", cevap: "Teraziler RS232 ya da USB ile, etiket yazıcılar (Zebra, Argox, TSC, Godex) doğrudan bağlanır. Tartım değeri satış fişine kendiliğinden gelir." },
      { soru: "TV panosu için ek donanım gerekir mi?", cevap: "Hayır. Smart TV'nin tarayıcısı ya da HDMI ile bağlı küçük bir cihaz yeterlidir; pano tam ekran açılır ve fiyatlar anında güncellenir." },
      { soru: "Has ve işçilik KDV'si ayrı mı hesaplanıyor?", cevap: "Evet. 3065 sayılı Kanun'a göre has bedeli istisna tutulur, KDV yalnız işçilik ve kâr üzerinden hesaplanır; e-Fatura XML'ine özel matrah kodları yazılır." },
      { soru: "İnternet kesilirse satış durur mu?", cevap: "Durmaz. Yerel SQL ile satış sürer; e-Belgeler internet geldiğinde gönderim kuyruğundan otomatik gider." },
    ],
    ekran: {
      baslik: "Vezne — Satış Fişi",
      menu: ["Vezne", "Etiket", "Cari", "Kasa", "Canlı Kur", "e-Belge"],
      kpi: [
        { etiket: "Has altın / gr", deger: "₺ 4.218,40" },
        { etiket: "22 ayar / gr", deger: "₺ 3.890,15" },
        { etiket: "Çeyrek", deger: "₺ 6.950" },
        { etiket: "Fiş toplamı", deger: "₺ 62.346" },
      ],
      tabloBaslik: ["Ürün", "Ayar", "Gram / Adet", "Tutar"],
      satirlar: [
        ["22 Ayar Bilezik", "916", "18,42 gr", "₺ 71.656"],
        ["Çeyrek Altın", "—", "2 ad", "₺ 13.900"],
        ["14 Ayar Kolye", "585", "6,15 gr", "₺ 14.910"],
        ["Hurda takas", "916", "−9,80 gr", "−₺ 38.120"],
      ],
    },
  },
  {
    kod: "gumus",
    ad: "Likya.Gümüş",
    slug: "likya-gumus",
    ikon: IconPackage,
    renk: "#4a6a8a",
    renkAcik: "#eef3f8",
    etiket: "Gümüş Toptan & Atölye",
    kisa: "Gümüş toptancısı, atölye ve mağazalar için milyem, gram + işçilik fiyatlama, model ve fason takibi.",
    baslik: "Gümüşte gram, işçilik ve model takibi tek yerde",
    aciklama:
      "925'ten 999'a milyem hesabı, has gümüş kuruna bağlı otomatik fiyat, model ve varyant kartları, atölye ve fason gram takibi. Toptan cari bakiyeleri gram ve TL olarak birlikte izleyin.",
    kimIcin: ["Gümüş toptancıları", "Gümüş atölyeleri ve üreticiler", "Gümüş ve takı mağazaları", "Online satış yapan gümüş firmaları"],
    oneCikanlar: [
      { ikon: IconScale, baslik: "Milyem ve gram motoru", metin: "925, 950 ve 999 milyem; has gümüş karşılığı ve fire oranı her satırda otomatik hesaplanır." },
      { ikon: IconCoins, baslik: "Gram + işçilik fiyatlama", metin: "Model bazında gram ya da adet işçiliği; has gümüş kuru değişince satış fiyatı kendiliğinden güncellenir." },
      { ikon: IconTags, baslik: "Model ve varyant kartları", metin: "Fotoğraf, taş, kaplama (rodyum, altın) ve ölçü varyantları; küçük takı etiketi ve toplu barkod." },
      { ikon: IconBuildingFactory2, baslik: "Atölye ve fason takibi", metin: "Fasona verilen ve gelen gram, işçilik borcu ve fire oranı; üretim emrinden stoğa kadar." },
      { ikon: IconUsers, baslik: "Toptan cari ve has bakiye", metin: "Müşteri bazında gram, has gümüş ve TL bakiyesi; emanet ve mal karşılığı tahsilat." },
      { ikon: IconBarcode, baslik: "Hızlı sayım", metin: "El terminaliyle raf ve vitrin sayımı, kritik stok ve en çok satan model raporları." },
    ],
    moduller: [
      { baslik: "Satış", maddeler: ["Toptan ve perakende satış fişi", "Gram / adet bazlı fiyat", "Karma ödeme ve takas", "Sipariş ve sevkiyat"] },
      { baslik: "Stok & Model", maddeler: ["Model ve varyant kartı", "Kaplama ve taş bilgisi", "Barkod ve etiket", "Depo ve vitrin sayımı"] },
      { baslik: "Üretim & Fason", maddeler: ["Üretim emri", "Fasona çıkış / giriş", "Fire ve işçilik hesabı", "Atölye bazlı raporlar"] },
      { baslik: "Cari & Finans", maddeler: ["Gram, has ve TL bakiyesi", "Ekstre ve mutabakat", "Kasa ve banka", "e-Fatura / e-Arşiv"] },
    ],
    entegrasyonlar: ["Hassas terazi", "Etiket yazıcı", "El terminali", "GİB e-Fatura / e-Arşiv", "e-Banka", "Sanal POS"],
    rakamlar: [
      { deger: "925–999", etiket: "Milyem desteği" },
      { deger: "0.01 gr", etiket: "Tartım hassasiyeti" },
      { deger: "Gram + işçilik", etiket: "Otomatik fiyat" },
      { deger: "Toptan + perakende", etiket: "Tek programda" },
    ],
    sss: [
      { soru: "Has gümüş kuru değişince fiyatlarımı tek tek mi güncellemeliyim?", cevap: "Hayır. Model kartındaki gram ve işçilik bilgisinden satış fiyatı kura bağlı hesaplanır; kur değiştiğinde fiyatlar kendiliğinden güncellenir." },
      { soru: "Fasona verdiğim malı nasıl takip ederim?", cevap: "Fasona çıkış fişiyle gram ve milyem kaydedilir; mal döndüğünde giriş fişi kesilir, fire ve işçilik borcu otomatik hesaplanır." },
      { soru: "Gümüşün yanında altın da satıyorum, ayrı program gerekir mi?", cevap: "Gerekmez. Likya.Gümüş ile Likya.Kuyum aynı altyapıdadır; Likya.ERP ile ikisi tek ekranda birlikte çalışır." },
    ],
    ekran: {
      baslik: "Toptan Satış",
      menu: ["Satış", "Modeller", "Fason", "Cari", "Kasa", "Raporlar"],
      kpi: [
        { etiket: "Has gümüş / gr", deger: "₺ 52,80" },
        { etiket: "Bugünkü satış", deger: "14,6 kg" },
        { etiket: "Fasonda", deger: "3,2 kg" },
        { etiket: "Açık sipariş", deger: "18" },
      ],
      tabloBaslik: ["Model", "Milyem", "Gram", "İşçilik"],
      satirlar: [
        ["Kararmaz Zincir 50 cm", "925", "8,40", "₺ 6 / gr"],
        ["Taşlı Yüzük R-114", "925", "3,85", "₺ 45 / ad"],
        ["Halat Bileklik", "925", "12,10", "₺ 5 / gr"],
        ["Külçe 100 gr", "999", "100,00", "—"],
      ],
    },
  },
  {
    kod: "doviz",
    ad: "Likya.Döviz",
    slug: "likya-doviz",
    ikon: IconCurrencyDollar,
    renk: "#047857",
    renkAcik: "#e8f6f0",
    etiket: "Döviz Bürosu",
    kisa: "Döviz büroları için hızlı alım-satım, kur ve marj yönetimi, MASAK kimlik denetimi ve e-Döviz belgesi.",
    baslik: "Döviz bürosunda hız, kur kontrolü ve mevzuat uyumu",
    aciklama:
      "Saniyeler içinde alım-satım fişi, piyasaya bağlı otomatik kur ve marj, limit üzeri işlemde zorunlu kimlik, e-Döviz belgesi ve kupür bazlı kasa. Gün sonunda döviz pozisyonunuz hazır.",
    kimIcin: ["Döviz büroları", "Kuyumcu bünyesindeki döviz masaları", "Yetkili müesseseler", "Çok şubeli döviz grupları"],
    oneCikanlar: [
      { ikon: IconArrowsExchange, baslik: "Hızlı alım-satım", metin: "Klavyeden saniyeler içinde fiş; 30+ döviz cinsi, çapraz kur ve tek fişte birden fazla döviz." },
      { ikon: IconRefresh, baslik: "Kur ve marj yönetimi", metin: "Piyasaya bağlı otomatik alış/satış kuru, döviz bazında marj ve makas; vitrin için canlı kur panosu." },
      { ikon: IconId, baslik: "MASAK ve kimlik denetimi", metin: "Limit üzeri işlemde kimlik zorunlu; gün içi kümülatif kontrol, yabancı uyruklu müşteri için pasaport." },
      { ikon: IconFileInvoice, baslik: "e-Döviz belgesi", metin: "Alım-satım belgesi elektronik ortamda düzenlenir ve gönderim kuyruğundan GİB'e iletilir." },
      { ikon: IconBuildingBank, baslik: "Kasa ve pozisyon", metin: "Döviz cinsinden kasa, kupür bazlı sayım, gün sonu pozisyon ve kâr raporu." },
      { ikon: IconChartBar, baslik: "Rapor ve ekstre", metin: "İşlem dökümü, müşteri ekstresi ve döviz bazlı kâr; Excel ve PDF olarak alınır." },
    ],
    moduller: [
      { baslik: "Alım-Satım", maddeler: ["Alış ve satış fişi", "Çapraz kur işlemi", "Tek fişte çoklu döviz", "Fiş yazdırma ve iptal yetkisi"] },
      { baslik: "Kur & Pano", maddeler: ["Canlı piyasa kuru", "Döviz bazında marj", "Manuel kur kilidi", "TV kur panosu"] },
      { baslik: "Müşteri & MASAK", maddeler: ["Kimlik / pasaport kaydı", "Gün içi kümülatif limit", "Riskli müşteri uyarısı", "İşlem geçmişi"] },
      { baslik: "Kasa & Belge", maddeler: ["Kupür bazlı sayım", "Gün sonu pozisyon", "e-Döviz belgesi", "Excel / PDF raporlar"] },
    ],
    entegrasyonlar: ["e-Döviz", "GİB mükellef sorgusu", "Canlı kur akışı", "TV panosu", "e-Banka", "Banknot sayma makinesi"],
    rakamlar: [
      { deger: "30+", etiket: "Döviz cinsi" },
      { deger: "< 5 sn", etiket: "Fiş süresi" },
      { deger: "Canlı", etiket: "Piyasa kuru" },
      { deger: "Kupür", etiket: "Bazlı kasa sayımı" },
    ],
    sss: [
      { soru: "Kurlar nereden geliyor, kendim değiştirebilir miyim?", cevap: "Kurlar canlı piyasa akışından gelir. Döviz bazında marj tanımlayabilir ya da kuru elle kilitleyebilirsiniz; değişiklik panoya anında yansır." },
      { soru: "Limit üzeri işlemde ne oluyor?", cevap: "Gün içi kümülatif tutar sınırı aştığında kimlik bilgisi girilmeden fiş kaydedilmez. Yabancı uyruklu müşteriler için pasaport bilgisi alınır." },
      { soru: "Kuyum mağazamda da döviz alıp satıyorum, ikisi birlikte kullanılabilir mi?", cevap: "Evet. Likya.Döviz, Likya.Kuyum ile aynı altyapıda çalışır; Likya.ERP ile tek kasa ve tek raporda birleşir." },
    ],
    ekran: {
      baslik: "Döviz Alım-Satım",
      menu: ["Alım-Satım", "Kurlar", "Müşteriler", "Kasa", "e-Döviz", "Raporlar"],
      kpi: [
        { etiket: "USD alış / satış", deger: "41,85 / 41,98" },
        { etiket: "EUR alış / satış", deger: "48,70 / 48,86" },
        { etiket: "GBP alış / satış", deger: "55,95 / 56,18" },
        { etiket: "Bugünkü işlem", deger: "214" },
      ],
      tabloBaslik: ["Saat", "İşlem", "Tutar", "Kur"],
      satirlar: [
        ["14:32", "Alış", "$ 2.500", "41,85"],
        ["14:28", "Satış", "€ 1.000", "48,86"],
        ["14:15", "Alış", "£ 600", "55,95"],
        ["14:02", "Satış · kimlikli", "$ 7.500", "41,98"],
      ],
    },
  },
  {
    kod: "ticari",
    ad: "Likya.Ticari",
    slug: "likya-ticari",
    ikon: IconBuildingStore,
    renk: "#c2410c",
    renkAcik: "#fdf0e8",
    etiket: "Ticari İşletme",
    kisa: "Ticari işletmeler için cari, stok, fatura, kasa-banka, e-Fatura/e-Arşiv ve tahsilat yönetimi.",
    baslik: "Ticari işletmeniz için sade ve eksiksiz ön muhasebe",
    aciklama:
      "Cari hesaplar, çoklu depo stok, satış ve alış faturası, kasa-banka ve e-Banka, sanal POS ile tahsilat. e-Fatura ve e-Arşiv programın içinde; ek entegratör ekranı yok.",
    kimIcin: ["Toptancı ve distribütörler", "Perakende mağazalar", "Hizmet işletmeleri", "KOBİ'ler ve üreticiler"],
    oneCikanlar: [
      { ikon: IconUsers, baslik: "Cari hesap yönetimi", metin: "Ekstre, yaşlandırma, risk limiti ve mutabakat; ekstreyi PDF ya da WhatsApp ile gönderin." },
      { ikon: IconBox, baslik: "Stok ve depo", metin: "Çoklu depo, barkod, seri ve sayım; kritik stok uyarısı ve depolar arası transfer." },
      { ikon: IconReceipt, baslik: "Fatura ve e-Belge", metin: "Satış ve alış faturası; iskonto, KDV ve tevkifat. e-Fatura ve e-Arşiv tek tıkla gider." },
      { ikon: IconBuildingBank, baslik: "Kasa, banka ve e-Banka", metin: "Banka hareketleri otomatik gelir ve cariyle eşleşir; POS komisyon ve vade takibi." },
      { ikon: IconCreditCard, baslik: "Tahsilat", metin: "Sanal POS ile tek çekim ve taksit; WhatsApp ve SMS ile 3D Secure ödeme linki." },
      { ikon: IconChartBar, baslik: "Raporlama", metin: "Kâr/zarar, en çok satanlar, tahsilat ve borç raporları; Excel, PDF ve e-posta." },
    ],
    moduller: [
      { baslik: "Cari", maddeler: ["Müşteri ve tedarikçi kartı", "Ekstre ve yaşlandırma", "Risk limiti", "Mutabakat mektubu"] },
      { baslik: "Stok & Depo", maddeler: ["Çoklu depo", "Barkod ve seri", "Sayım fişi", "Kritik stok uyarısı"] },
      { baslik: "Fatura & e-Belge", maddeler: ["Satış / alış faturası", "İade ve irsaliye", "e-Fatura ve e-Arşiv", "Gönderim kuyruğu"] },
      { baslik: "Finans", maddeler: ["Kasa ve banka", "e-Banka hareketleri", "Sanal POS tahsilatı", "Gider ve masraf"] },
    ],
    entegrasyonlar: ["GİB e-Fatura / e-Arşiv", "GİB mükellef sorgusu", "e-Banka", "Sanal POS", "ÖKC / POS cihazları", "Barkod okuyucu", "Excel / CSV aktarım"],
    rakamlar: [
      { deger: "Dahili", etiket: "e-Fatura / e-Arşiv" },
      { deger: "Çoklu", etiket: "Depo ve kasa" },
      { deger: "Otomatik", etiket: "Banka eşleştirme" },
      { deger: "Excel / PDF", etiket: "Tüm raporlar" },
    ],
    sss: [
      { soru: "e-Fatura için ayrıca entegratör ekranı kullanmam gerekir mi?", cevap: "Hayır. Faturayı kestiğiniz ekrandan e-Fatura ya da e-Arşiv olarak gönderirsiniz; durum takibi programın içindedir." },
      { soru: "Eski programımdaki carileri ve stokları aktarabilir miyim?", cevap: "Evet. Excel, CSV ya da SQL üzerinden cari, stok ve açılış bakiyeleri aktarılır; kurulumda ekibimiz yardımcı olur." },
      { soru: "VKN girince firma bilgileri gelir mi?", cevap: "Evet. Vergi numarasıyla unvan ve vergi dairesi bilgisi sorgulanıp cari karta yazılır." },
    ],
    ekran: {
      baslik: "Satış Faturaları",
      menu: ["Fatura", "Cari", "Stok", "Kasa & Banka", "e-Belge", "Raporlar"],
      kpi: [
        { etiket: "Aylık ciro", deger: "₺ 2,48 M", not: "+8%" },
        { etiket: "Tahsil edilecek", deger: "₺ 386.400" },
        { etiket: "Kritik stok", deger: "12 kalem" },
        { etiket: "Bu ay e-Fatura", deger: "148" },
      ],
      tabloBaslik: ["Fatura No", "Cari", "Tutar", "Durum"],
      satirlar: [
        ["LKY2026000148", "Ege Gıda Ltd.", "₺ 24.680", "e-Fatura ✓"],
        ["LKY2026000147", "Kaya Yapı", "₺ 8.120", "e-Arşiv ✓"],
        ["LKY2026000146", "Demir Tekstil", "₺ 56.300", "Kuyrukta"],
        ["LKY2026000145", "Öz Market", "₺ 3.940", "e-Arşiv ✓"],
      ],
    },
  },
  {
    kod: "connector",
    ad: "Likya.Connector",
    slug: "likya-connector",
    ikon: IconPlugConnected,
    renk: "#0e7490",
    renkAcik: "#e6f5f8",
    etiket: "Entegrasyon Katmanı",
    kisa: "Likya ürünlerini GİB, bankalar, POS cihazları, teraziler ve etiket yazıcılarla konuşturan entegrasyon katmanı.",
    baslik: "Tüm bağlantılarınız tek katmanda, kesintisiz",
    aciklama:
      "Likya.Connector; GİB e-Belge, banka hareketleri, sanal POS ve ÖKC cihazları, teraziler, etiket yazıcılar ve canlı kur akışını Likya ürünlerine bağlar. Gönderim kuyruğu, otomatik yeniden deneme ve durum izleme dahil.",
    kimIcin: ["Likya ürünlerini kullanan tüm işletmeler", "Çok sayıda cihaz ve şubesi olan işletmeler", "Banka ve POS mutabakatını otomatikleştirmek isteyenler", "Kendi yazılımını Likya altyapısına bağlamak isteyen firmalar"],
    oneCikanlar: [
      { ikon: IconFileInvoice, baslik: "GİB e-Belge köprüsü", metin: "e-Fatura, e-Arşiv ve e-Döviz gönderimi; kuyruk, otomatik yeniden deneme ve belge durum takibi." },
      { ikon: IconBuildingBank, baslik: "Banka entegrasyonu", metin: "Hesap hareketleri otomatik çekilir, cari ve tahsilatla eşleştirilir; günlük mutabakat hazır." },
      { ikon: IconCreditCard, baslik: "POS ve ÖKC cihazları", metin: "Tahsilat tutarı cihaza gider, sonuç fişe geri döner; sanal POS ve 3D Secure ödeme linki." },
      { ikon: IconCpu, baslik: "Terazi ve çevre birimleri", metin: "RS232/USB terazi, barkod okuyucu, etiket yazıcı ve banknot sayma makinesi yerel ajan üzerinden bağlanır." },
      { ikon: IconDatabase, baslik: "Kur ve piyasa verisi", metin: "Canlı fiyat akışı satış ekranlarına ve TV panolarına aynı anda dağıtılır." },
      { ikon: IconShieldCheck, baslik: "İzleme ve güvenlik", metin: "Her bağlantının son işlem zamanı ve durumu tek ekranda; hata olduğunda bildirim." },
    ],
    moduller: [
      { baslik: "e-Belge", maddeler: ["e-Fatura / e-Arşiv", "e-Döviz", "GİB mükellef (VKN) sorgusu", "Gönderim kuyruğu"] },
      { baslik: "Banka & Ödeme", maddeler: ["e-Banka hareketleri", "Sanal POS", "ÖKC / POS cihazları", "WhatsApp / SMS ödeme linki"] },
      { baslik: "Donanım", maddeler: ["Terazi", "Etiket yazıcı", "Barkod okuyucu / el terminali", "TV panosu"] },
      { baslik: "İzleme", maddeler: ["Bağlantı durum ekranı", "Otomatik yeniden deneme", "İşlem kayıtları", "Hata bildirimi"] },
    ],
    entegrasyonlar: ["GİB e-Fatura / e-Arşiv / e-Döviz", "Tüm Türk bankaları", "Inpos / Beko ÖKC", "Sanal POS (3D Secure)", "Terazi", "Etiket yazıcı", "Canlı kur akışı"],
    rakamlar: [
      { deger: "3", etiket: "e-Belge türü" },
      { deger: "Otomatik", etiket: "Yeniden deneme" },
      { deger: "RS232 / USB", etiket: "Cihaz bağlantısı" },
      { deger: "Tek ekran", etiket: "Durum izleme" },
    ],
    sss: [
      { soru: "Likya.Connector ayrı mı satılıyor?", cevap: "Likya ürünleriyle birlikte gelir; hangi bağlantıları kullanacağınız ihtiyacınıza göre açılır. Kendi yazılımınızı bağlamak için ayrıca görüşebiliriz." },
      { soru: "Bağlantılardan biri koparsa ne olur?", cevap: "İşlem kuyruğa alınır ve bağlantı geldiğinde otomatik yeniden denenir. Durum ekranında hangi bağlantının beklediği görünür." },
      { soru: "Mağazadaki terazi ve yazıcılar buluttaki programla nasıl konuşuyor?", cevap: "Bilgisayara kurulan küçük bir yerel ajan cihazlarla konuşur ve sonucu programa iletir; ek ayar gerekmez." },
    ],
    ekran: {
      baslik: "Bağlantı Durumu",
      menu: ["Durum", "e-Belge", "Banka", "POS", "Cihazlar", "Kayıtlar"],
      kpi: [
        { etiket: "e-Belge kuyruğu", deger: "0 bekleyen" },
        { etiket: "Banka", deger: "6 / 6 bağlı" },
        { etiket: "POS cihazı", deger: "2 çevrim içi" },
        { etiket: "Terazi", deger: "Bağlı" },
      ],
      tabloBaslik: ["Bağlantı", "Tür", "Son işlem", "Durum"],
      satirlar: [
        ["GİB e-Fatura", "e-Belge", "14:31", "Çalışıyor"],
        ["Banka hareketleri", "e-Banka", "14:30", "Çalışıyor"],
        ["Vezne POS-1", "ÖKC", "14:22", "Çalışıyor"],
        ["Zebra ZD220", "Etiket", "13:58", "Beklemede"],
      ],
    },
  },
];

export const urunBul = (slug?: string) => URUNLER.find((u) => u.slug === slug);
export const urunKoduyla = (kod: UrunKodu) => URUNLER.find((u) => u.kod === kod)!;

/** Karşılaştırma tablosu: ✓ var, ○ opsiyonel / kısmen, – yok */
export type Kapsam = "var" | "ops" | "yok";
export const KARSILASTIRMA: { ozellik: string; deger: Record<UrunKodu, Kapsam> }[] = [
  { ozellik: "Vezne / perakende satış", deger: { erp: "var", kuyum: "var", gumus: "var", doviz: "var", ticari: "var", connector: "yok" } },
  { ozellik: "Has / milyem hesabı", deger: { erp: "var", kuyum: "var", gumus: "var", doviz: "yok", ticari: "yok", connector: "yok" } },
  { ozellik: "Döviz alım-satım", deger: { erp: "var", kuyum: "var", gumus: "ops", doviz: "var", ticari: "yok", connector: "yok" } },
  { ozellik: "Cari hesap ve ekstre", deger: { erp: "var", kuyum: "var", gumus: "var", doviz: "var", ticari: "var", connector: "yok" } },
  { ozellik: "Stok, barkod ve etiket", deger: { erp: "var", kuyum: "var", gumus: "var", doviz: "yok", ticari: "var", connector: "yok" } },
  { ozellik: "Üretim / fason takibi", deger: { erp: "var", kuyum: "ops", gumus: "var", doviz: "yok", ticari: "yok", connector: "yok" } },
  { ozellik: "Canlı kur ve TV panosu", deger: { erp: "var", kuyum: "var", gumus: "var", doviz: "var", ticari: "yok", connector: "ops" } },
  { ozellik: "e-Fatura / e-Arşiv", deger: { erp: "var", kuyum: "var", gumus: "var", doviz: "var", ticari: "var", connector: "var" } },
  { ozellik: "e-Döviz belgesi", deger: { erp: "var", kuyum: "ops", gumus: "yok", doviz: "var", ticari: "yok", connector: "var" } },
  { ozellik: "e-Banka ve sanal POS", deger: { erp: "var", kuyum: "var", gumus: "var", doviz: "var", ticari: "var", connector: "var" } },
  { ozellik: "MASAK kimlik denetimi", deger: { erp: "var", kuyum: "var", gumus: "ops", doviz: "var", ticari: "yok", connector: "yok" } },
  { ozellik: "Terazi entegrasyonu", deger: { erp: "var", kuyum: "var", gumus: "var", doviz: "yok", ticari: "ops", connector: "var" } },
  { ozellik: "Çok şube ve konsolide rapor", deger: { erp: "var", kuyum: "ops", gumus: "ops", doviz: "ops", ticari: "ops", connector: "yok" } },
  { ozellik: "Hibrit çalışma (bulut + yerel)", deger: { erp: "var", kuyum: "var", gumus: "var", doviz: "var", ticari: "var", connector: "var" } },
];

/** Ana sayfadaki "hangi ürün size uygun" seçici */
export const ISLETME_TURLERI: { ad: string; ikon: Icon; oneri: UrunKodu[]; neden: string }[] = [
  { ad: "Kuyum mağazası / sarraf", ikon: IconDiamond, oneri: ["kuyum", "connector"], neden: "Vezne, has/milyem, etiket, TV panosu ve 3065 KDV'li e-Fatura için Likya.Kuyum; terazi, POS ve banka bağlantıları için Likya.Connector." },
  { ad: "Gümüş toptan / atölye", ikon: IconPackage, oneri: ["gumus", "connector"], neden: "Gram + işçilik fiyatlama, model ve fason takibi için Likya.Gümüş; terazi ve etiket yazıcı için Likya.Connector." },
  { ad: "Döviz bürosu", ikon: IconCurrencyDollar, oneri: ["doviz", "connector"], neden: "Hızlı alım-satım, kur/marj, MASAK ve e-Döviz için Likya.Döviz; canlı kur ve e-Belge köprüsü için Likya.Connector." },
  { ad: "Ticari işletme", ikon: IconBuildingStore, oneri: ["ticari", "connector"], neden: "Cari, stok, fatura ve kasa-banka için Likya.Ticari; e-Fatura, banka ve POS bağlantıları için Likya.Connector." },
  { ad: "Çok şubeli / karma işletme", ikon: IconBuildingSkyscraper, oneri: ["erp"], neden: "Birden fazla iş kolunu ve şubeyi tek merkezde yönetmek için Likya.ERP; içindeki ürünleri ihtiyacınıza göre açarsınız." },
];

/** Tüm ürünlerin ortak altyapısı */
export const ORTAK_ALTYAPI: Ozellik[] = [
  { ikon: IconCloudComputing, baslik: "Bulut + yerel SQL", metin: "Hibrit çalışma: internet kesilse de satış sürer, bağlantı gelince veriler eşitlenir." },
  { ikon: IconFileInvoice, baslik: "GİB e-Belge dahili", metin: "e-Fatura, e-Arşiv ve e-Döviz programın içinde; gönderim kuyruğu ve durum takibi." },
  { ikon: IconBuildingBank, baslik: "e-Banka ve tahsilat", metin: "Banka hareketleri otomatik, sanal POS ve WhatsApp ödeme linki." },
  { ikon: IconShieldCheck, baslik: "Mevzuat uyumu", metin: "MASAK kimlik denetimi, 3065 KDV özel matrah ve KVKK uyumlu yetkilendirme." },
  { ikon: IconLock, baslik: "Güvenli veri", metin: "ACID işlem güvencesi, şifreli yedek ve kullanıcı bazlı işlem kayıtları." },
  { ikon: IconChartBar, baslik: "Anlık raporlama", metin: "Kâr/zarar, stok ve kasa raporları; Excel, PDF ve e-posta ile paylaşım." },
];
