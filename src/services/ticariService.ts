import { apiClient } from "./apiClient";
import { dosyaGetir } from "./raporService";

/** Ticari İşlemler istemcisi (docs/TICARI_ISLEMLER_YOL_HARITASI.md): stok kartı, grup, giriş, satış fişi, raporlar */

export interface StokGrup {
  stokGrupId: number;
  ad: string;
  aktif: boolean;
  kartSayisi: number;
}

export interface StokKart {
  stokKartId: number;
  kod: string;
  ad: string;
  stokGrupId: number | null;
  grupAdi: string | null;
  birim: string;
  kdvOrani: number;
  satisFiyati: number | null;
  fiyatKdvDahil: boolean;
  paraId: number | null;
  paraKodu: string | null;
  alisFiyati: number | null;
  sonAlisFiyati: number | null;
  sonAlisTarihi: string | null;
  enAzStok: number | null;
  aktif: boolean;
  aciklama: string | null;
  barkodlar: string[];
  bakiye: number;
  resimVar: boolean;
  resim?: string | null;
  /** Karta özel eksi stok davranışı; null = Stok Ayarları'ndaki genel davranış (İş 9, G22) */
  stokKontrol: "UYAR" | "ENGELLE" | "SESSIZ" | null;
  /** Tedarikçi cari (İş 11, G10) */
  tedarikciCariId: number | null;
  tedarikciAd: string | null;
  /** İstekte liste verildiyse o listedeki fiyat; null → ana fiyat (satisFiyati) geçerli */
  listeFiyati?: number | null;
  /** Kart ayrıntısında tanımlı listelerdeki fiyatlar */
  listeFiyatlari?: { fiyatListesiId: number; ad: string; fiyat: number | null }[];
  /** Terazi PLU kodu (docs/TICARI_ADISYON_YOL_HARITASI.md, TA3); null = teraziye bağlı değil */
  teraziKodu?: number | null;
  /** SKT takibi (TA16): stok giriş fişinde son kullanma tarihi zorunlu */
  sktTakibi?: boolean;
  /** Reçeteli ürün (TA18): stok tutmaz, satılınca reçetedeki malzemeler düşer */
  receteli?: boolean;
  recete?: { malzemeKartId: number; kod: string; ad: string; birim: string; miktar: number }[];
  /** Adisyon (masa) KDV oranı (TA32); null = Adisyon ayarı */
  adisyonKdvOrani?: number | null;
  /** kartBul terazi etiketli barkodla bulduysa barkoddaki ağırlık (kg) ya da tutar (TL) */
  terazi?: { barkod: string; plu: number; agirlikKg: number | null; fiyat: number | null };
  /** Kart ayrıntısında ek birimler (Koli = 12 Adet; TA5) */
  birimler?: EkBirim[];
  /** kartBul ek birim (koli) barkoduyla bulduysa o birim */
  okunanBirim?: EkBirim;
}

export interface FiyatIslemiGirdi {
  hedef: { tur: "grup" | "tedarikci" | "secili" | "tumu"; grupId?: number | null; cariId?: number | null; kartIdler?: number[] | null };
  fiyatListesiId?: number | null;
  alan: "satis" | "alis";
  islem: { tur: "yuzde" | "tutar" | "alisKar"; deger: number };
  yuvarlama: "kurus" | "tl" | "99";
  paraId?: number | null;
  pasifler?: boolean;
  aciklama?: string | null;
}
export interface FiyatIslemiSatiri { stokKartId: number; kod: string; ad: string; paraKodu: string; eski: number | null; yeni: number | null; atlandi: "para" | "alisYok" | "fiyatYok" | null }
export interface FiyatIslemiOnizleme { satirlar: FiyatIslemiSatiri[]; toplam: number; degisecek: number; atlanan: number; kesildi: boolean }
export interface FiyatIslemiGecmisKaydi { islemNo: number; tarih: string | null; alan: string; fiyatListesiId: number | null; listeAdi: string | null; aciklama: string; kart: number; kullaniciAdi: string | null; geriAlindi: boolean }

export interface Kampanya {
  kampanyaId: number; ad: string; baslangic: string; bitis: string; tur: 1 | 2; deger: number; hedefTuru: 1 | 2 | 3; aktif: boolean; aciklama: string | null;
  gruplar: { stokGrupId: number; ad: string }[]; kartlar: { stokKartId: number; kod: string; ad: string }[]; yururlukte: boolean;
}
export interface KampanyaGirdi {
  kampanyaId?: number | null; ad: string; baslangic: string; bitis: string; tur: 1 | 2; deger: number | string; hedefTuru: 1 | 2 | 3;
  grupIdler?: number[]; kartIdler?: number[]; aktif?: boolean; aciklama?: string | null;
}
import type { AktifKampanya, EkBirim, TeraziDuzeni } from "../../Backend/src/services/ticari/ticariHesap";
export type { AktifKampanya, EkBirim, TeraziDuzeni };

export interface FiyatListesi {
  fiyatListesiId: number;
  ad: string;
  aktif: boolean;
  sira: number;
  kartSayisi: number;
  cariSayisi: number;
}

/** Kartın geçerli KDV dahil fiyatı için liste fiyatı varsa o, yoksa ana fiyat */
export const kartSatisFiyati = (k: Pick<StokKart, "satisFiyati" | "listeFiyati">): number | null => (k.listeFiyati !== null && k.listeFiyati !== undefined ? k.listeFiyati : k.satisFiyati);

export const STOK_KONTROL_SECENEKLERI: { kod: string; ad: string }[] = [
  { kod: "", ad: "Ayarı kullan (Stok Ayarları)" }, { kod: "UYAR", ad: "Uyar ama sat" }, { kod: "ENGELLE", ad: "Engelle (eksiye düşemez)" }, { kod: "SESSIZ", ad: "Sessizce sat" },
];

export interface StokKartGirdi {
  stokKartId?: number | null;
  kod?: string;
  ad: string;
  stokGrupId?: number | null;
  birim?: string;
  kdvOrani?: number | string | null;
  satisFiyati?: number | string | null;
  fiyatKdvDahil?: boolean;
  paraId?: number | null;
  alisFiyati?: number | string | null;
  enAzStok?: number | string | null;
  aktif?: boolean;
  aciklama?: string | null;
  barkodlar?: string[];
  resim?: string | null;
  stokKontrol?: string | null;
  tedarikciCariId?: number | null;
  listeFiyatlari?: { fiyatListesiId: number; fiyat: number | string | null }[];
  /** Terazi PLU kodu (TA3); null / "": kaldır */
  teraziKodu?: number | string | null;
  /** SKT takibi (TA16) */
  sktTakibi?: boolean;
  /** Reçeteli ürün + reçete (TA18); verilmezse dokunulmaz */
  receteli?: boolean;
  /** Adisyon KDV oranı (TA32); "" = varsayılan */
  adisyonKdvOrani?: number | string | null;
  recete?: { malzemeKartId: number; miktar: number | string }[];
  /** Ek birimler (TA5); verilirse hepsi yeniden yazılır */
  birimler?: { birim: string; carpan: number | string; satisFiyati?: number | string | null; barkodlar?: string[] }[];
}

export const ETIKET_ALANLARI: { kod: EtiketAlani; ad: string }[] = [
  { kod: "ad", ad: "Ürün adı" }, { kod: "kod", ad: "Kod" }, { kod: "grup", ad: "Grup" }, { kod: "fiyat", ad: "Fiyat" }, { kod: "birim", ad: "Birim" },
];
export type EtiketAlani = "ad" | "kod" | "grup" | "fiyat" | "birim";
export interface EtiketDuzeni {
  genislikMm: number;
  yukseklikMm: number;
  barkodTipi: "CODE128" | "QR";
  alanlar: EtiketAlani[];
}

export interface StokAyarlari {
  eksiStok: "UYAR" | "ENGELLE" | "SESSIZ";
  /** Terazi etiketli barkod düzenleri (TA3) */
  teraziDuzenleri: TeraziDuzeni[];
  /** Kasiyer vardiyası (TA8): satış / iade için veznede açık vardiya şartı */
  vardiyaZorunlu: boolean;
  /** SKT yaklaşanlar uyarı eşiği (gün, TA16) */
  sktUyariGun: number;
  kullanicilar: { kullaniciId: number; ad: string; yonetici: boolean; yetkili: boolean }[];
}

/** Kasiyer vardiyası raporu (docs/TICARI_ADISYON_YOL_HARITASI.md, TA8); zamanlar Türkiye saati "YYYY-AA-GG SS:DD" */
export interface VardiyaOzeti {
  vardiyaId: number | null;
  vezne: { vezneId: number; kod: string; ad: string };
  acilis: { zaman: string; kullanici: string; not: string | null };
  kapanis: { zaman: string; kullanici: string; not: string | null } | null;
  nakit: {
    devir: number; nakitSatis: number; nakitIade: number; digerGiris: number; digerCikis: number; beklenen: number;
    sayilan: number | null; fark: number | null; durum: "TAMAM" | "FAZLA" | "EKSIK" | null;
  };
  kupur: Record<string, number> | null;
  fisler: { satisAdet: number; satisToplam: number; iadeAdet: number; iadeToplam: number };
  odemeler: { tur: string; paraKodu: string; satis: number; iade: number; net: number }[];
  digerHareketler: { zaman: string; tur: string; belgeNo: string; aciklama: string; giris: number; cikis: number }[];
  digerParalar: { paraKodu: string; giris: number; cikis: number }[];
}

/** Gün sonu satış raporu (TA7); tutarlar KDV dahil */
/** Ortalama maliyet + kâr raporu (docs/TICARI_ADISYON_YOL_HARITASI.md, TA15) */
export interface KarRaporuUrun {
  stokKartId: number; kod: string; ad: string; birim: string; grup: string;
  satisMiktar: number; iadeMiktar: number; netMiktar: number; gelir: number; maliyet: number; kar: number; karYuzde: number | null;
  fireMiktar: number; fireMaliyet: number; sayimFarkMaliyet: number; ortMaliyet: number; sonAlis: number | null; maliyetsizMiktar: number; donemSonuMiktar: number;
}
export interface KarRaporu {
  suzgec: { baslangic: string; bitis: string };
  toplam: { gelir: number; maliyet: number; brutKar: number; fireMaliyet: number; sayimFarkMaliyet: number; parcalamaFarki?: number; netKar: number; karYuzde: number | null; maliyetsizKalem: number };
  urunler: KarRaporuUrun[];
  gruplar: { grup: string; gelir: number; maliyet: number; kar: number; fireMaliyet: number }[];
  gunler: { gun: string; gelir: number; maliyet: number; kar: number }[];
}
export interface GunSonuTutar { adet: number; brut: number; iskonto: number; fisIskontosu: number; net: number; matrah: number; kdv: number }
export interface GunSonuRaporu {
  suzgec: { baslangic: string; bitis: string; kasiyer: string | null; vezne: string | null };
  satis: GunSonuTutar;
  iade: GunSonuTutar;
  net: { net: number; matrah: number; kdv: number };
  odemeler: { tur: string; paraKodu: string; satis: number; iade: number; net: number; dovizMiktar: number | null }[];
  odemesiz: number;
  kdvOranlari: { oran: number; matrah: number; kdv: number; toplam: number }[];
  urunler: { stokKartId: number | null; kod: string; ad: string; birim: string; grup: string; satisMiktar: number; iadeMiktar: number; netMiktar: number; satis: number; iade: number; net: number }[];
  gruplar: { grup: string; kalem: number; satis: number; iade: number; net: number }[];
  kasiyerler: { kullaniciId: number | null; ad: string; satisAdet: number; iadeAdet: number; net: number }[];
  saatler: { saat: number; adet: number; net: number }[];
  kasiyerSecenekleri: { kullaniciId: number; ad: string }[];
}

/** Sayım fişi (TA11) */
export interface SayimKarti { stokKartId: number; kod: string; ad: string; birim: string; grup: string; sistem: number }
export interface SayimSatiri { stokKartId: number; satirNo: number; kod: string; ad: string; grup: string; birim: string; sayilan: number; sistem: number | null; fark: number | null }
export interface SayimFisi {
  sayimId: number; sayimNo: string; tarih: string; stokGrupId: number | null; grup: string; aciklama: string | null; durum: 0 | 1;
  ekleyen: string; onaylayan: string; onayZamani: string | null; satirlar: SayimSatiri[]; ozet: { kalem: number; fazlaKalem: number; eksikKalem: number };
}
export interface SayimListeSatiri { sayimId: number; sayimNo: string; tarih: string; durum: number; aciklama: string | null; grup: string; kalem: number; farkliKalem: number }
/** Fire / zayi fişi (TA12) */
export interface FireSatiri { satirNo: number; stokKartId: number; kod: string; ad: string; birim: string; miktar: number; neden: string; birimMaliyet: number; maliyet: number }
export interface FireFisi { fireId: number; fireNo: string; tarih: string; aciklama: string | null; ekleyen: string; satirlar: FireSatiri[]; toplamMaliyet: number }
export interface FireListesi {
  satirlar: { fireId: number; fireNo: string; tarih: string; satirNo: number; stokKartId: number; kod: string; ad: string; birim: string; miktar: number; neden: string; maliyet: number }[];
  toplamMaliyet: number; nedenler: { neden: string; maliyet: number }[];
}

/** Parçalama fişi + şablon (TA17) */
export interface ParcalamaOzeti { girdiMaliyet: number; ciktiMaliyet: number; fark: number; fireOnerisi: number | null; verimYuzde: number | null; uyarilar: string[] }
export interface ParcalamaFisi {
  parcalamaId: number; parcalamaNo: string; tarih: string; aciklama: string | null; ekleyen: string; sablonId: number | null; sablonAd: string | null; fireMiktar: number | null;
  girdi: { stokKartId: number; kod: string; ad: string; birim: string; miktar: number; birimMaliyet: number };
  satirlar: { satirNo: number; stokKartId: number; kod: string; ad: string; birim: string; miktar: number; birimMaliyet: number; maliyet: number }[];
  ozet: ParcalamaOzeti;
}
export interface ParcalamaListeSatiri { parcalamaId: number; parcalamaNo: string; tarih: string; girdiAd: string; girdiBirim: string; girdiMiktar: number; girdiMaliyet: number; ciktiMaliyet: number; fireMiktar: number | null; parcaSayisi: number }
export interface ParcalamaSablonu {
  sablonId: number; ad: string; girdiKartId: number; girdiKod: string; girdiAd: string; girdiBirim: string; aciklama: string | null;
  satirlar: { stokKartId: number; kod: string; ad: string; birim: string; verimYuzde: number | null; maliyetPayi: number | null }[];
}

/** Tedarikçiye iade (TA13) */
export interface TedarikciIadeKaynagi {
  fis: { stokGirisId: number; fisNo: string; tarih: string; belgeNo: string | null; cariKartId: number | null; cariKod: string; cariAd: string };
  satirlar: { satirNo: number; stokKartId: number; kod: string; ad: string; birim: string; alinan: number; iadeEdilen: number; kalan: number; birimFiyat: number; kdvOrani: number }[];
}
export interface TedarikciIadesi {
  iadeId: number; iadeNo: string; tarih: string; cariKartId: number; cariKod: string; cariAd: string; stokGirisId: number | null; girisNo: string | null;
  girisBelgeNo: string | null; girisTarihi: string | null; belgeNo: string | null; aciklama: string | null; araToplam: number; toplamKdv: number; genelToplam: number;
  cariHareketId: number | null; ebelgeTaslakId: number | null;
  satirlar: { satirNo: number; stokKartId: number; kod: string; ad: string; girisSatirNo: number | null; birim: string; miktar: number; birimFiyat: number; kdvOrani: number; tutar: number; kdvTutari: number; toplamTutar: number }[];
}
export interface TedarikciIadeListeSatiri { iadeId: number; iadeNo: string; tarih: string; genelToplam: number; belgeNo: string | null; cariAd: string; girisNo: string | null }

/** Gelen e-Faturadan stok girişi (TA14) */
export interface EfaturaOnizleme {
  fatura: { ettn: string; faturaNo: string; tarih: string; faturaTipi: string; paraBirimi: string; saticiVkn: string; saticiUnvan: string; matrah: number; odenecek: number };
  cari: { cariKartId: number; kod: string; ad: string } | null;
  cariBirdenFazla: boolean;
  alindi: { stokGirisId: number; fisNo: string } | null;
  engel: string | null;
  satirlar: {
    sira: number; ad: string; saticiKodu: string | null; aliciKodu: string | null; barkod: string | null; miktar: number; birimKodu: string; birimFiyat: number; iskonto: number;
    netTutar: number; kdvOrani: number; kdvTutari: number; yeniKartBirimi: string;
    /** Faturadaki son kullanma tarihi / parti (TA16) */
    skt: string | null; partiNo: string | null;
    oneri: { stokKartId: number | null; kaynak: "hatirlanan" | "barkod" | "kod" | "ad" | null; carpan: number | null; kart: { kod: string; ad: string; birim: string; sktTakibi?: boolean } | null };
  }[];
}
export interface EfaturaGelenSatiri { uuid: string; belgeNo: string; saticiVkn: string; saticiUnvan: string; tarih: string | null; tutar: number | null; paraBirimi: string; faturaTipi: string; alindi: { stokGirisId: number; fisNo: string } | null }
export type EfaturaAlimSecimi = { sira: number; atla?: boolean; stokKartId?: number | null; yeniKart?: { ad?: string; birim?: string; kdvOrani?: number } | null; carpan?: number | null; hatirla?: boolean; skt?: string | null; partiNo?: string | null };

export interface VardiyaDurumu {
  vezne: { vezneId: number; kod: string; ad: string };
  zorunlu: boolean;
  acik: VardiyaOzeti | null;
  oneriDevir: number;
}

export interface VardiyaListeSatiri {
  vardiyaId: number;
  vezneId: number;
  vezne: string;
  acan: string;
  acilis: string;
  kapatan: string;
  kapanis: string | null;
  devir: number;
  beklenen: number | null;
  sayilan: number | null;
  fark: number | null;
}

export interface StokGirisSatiri {
  satirNo?: number;
  stokKartId: number;
  kod?: string;
  ad?: string;
  birim?: string;
  miktar: number;
  birimFiyat: number;
  kdvOrani: number;
  tutar?: number;
  kdvTutari?: number;
  toplamTutar?: number;
  /** Son kullanma tarihi YYYY-AA-GG ve parti no (TA16) */
  skt?: string | null;
  partiNo?: string | null;
  sktTakibi?: boolean;
}

/** SKT yaklaşanlar (TA16): eldeki stok en yeni girişlere dağıtılarak partilerde kalan tahmini */
export interface SktSatiri {
  stokKartId: number; kod: string; ad: string; birim: string; grup: string;
  stokGirisId: number; fisNo: string; girisGunu: string; partiNo: string | null; skt: string; kalanGun: number; durum: "gecti" | "bugun" | "yaklasiyor" | "uzak";
  partiMiktar: number; kalan: number; birimFiyat: number; deger: number; kartBakiye: number;
}
export interface SktRaporu {
  esikGun: number; bugun: string; satirlar: SktSatiri[];
  ozet: Record<"gecti" | "bugun" | "yaklasiyor" | "uzak", { parti: number; kart: number; deger: number }>;
}

export interface StokGiris {
  stokGirisId: number;
  fisNo: string;
  tarih: string;
  cariKartId: number | null;
  cariKod: string | null;
  cariAd: string | null;
  belgeNo: string | null;
  aciklama: string | null;
  araToplam: number;
  toplamKdv: number;
  genelToplam: number;
  cariHareketId?: number | null;
  vezneId?: number | null;
  satirlar?: StokGirisSatiri[];
  satirSayisi?: number;
  toplamMiktar?: number;
}

export interface TicariSatisSatiri {
  satirNo: number;
  /** Serbest ürün satırında (Hızlı Satış) boş */
  stokKartId: number | null;
  kod: string;
  barkod: string;
  urunAdi: string;
  miktar: number;
  birim: string;
  kdvDahilFiyat: number;
  kdvOrani: number;
  iskontoTuru: number;
  iskontoDegeri: number | null;
  birimFiyat: number;
  tutar: number;
  iskontoTutari: number;
  matrah: number;
  kdvTutari: number;
  toplamTutar: number;
  brutDahil: number;
  /** Satıra uygulanan kampanya (İş 11) */
  kampanyaId?: number | null;
}

export interface TicariOdeme {
  faturaOdemeId?: number;
  satirNo?: number;
  odemeAraciTuru: number;
  cariKartId?: number | null;
  posCihaziId?: number | null;
  cariKod?: string | null;
  cariUnvan?: string | null;
  paraId?: number | null;
  paraKodu?: string | null;
  paraAdi?: string | null;
  miktar?: number | null;
  kur?: number | null;
  tutar: number;
}

export interface TicariSatisFisi {
  faturaId: number;
  /** Kullanılan fiyat listesi (İş 11); null = ana liste */
  fiyatListesiId?: number | null;
  vezneId: number;
  vezneKod: string | null;
  vezneAd: string | null;
  faturaNo: string;
  ettn: string;
  tarih: string;
  senaryo: string;
  cariKartId: number | null;
  cariKod: string | null;
  cariUnvan: string | null;
  aliciVknTckn: string;
  aliciUnvan: string;
  adres: string | null;
  ilce: string | null;
  il: string | null;
  vergiDairesi: string | null;
  eposta: string | null;
  telefon: string | null;
  araToplam: number;
  toplamKdv: number;
  iskontoId: number | null;
  iskontoKodu: string | null;
  iskontoOrani: number;
  iskontoTutari: number;
  iskontoTuru: number;
  iskontoDegeri: number;
  genelToplam: number;
  brutDahil: number;
  toplamIskontoDahil: number;
  eBelgeDurumu: number;
  satirlar: TicariSatisSatiri[];
  odemeler: TicariOdeme[];
}

export interface TicariSatisGirdi {
  faturaId?: number | null;
  vezneId?: number | null;
  faturaNo?: string | null;
  tarih?: string | null;
  senaryo?: string | null;
  cariKartId?: number | null;
  aliciVknTckn?: string | null;
  aliciUnvan?: string | null;
  adres?: string | null;
  ilce?: string | null;
  il?: string | null;
  vergiDairesi?: string | null;
  eposta?: string | null;
  telefon?: string | null;
  iskontoId?: number | null;
  iskontoKodu?: string | null;
  iskontoTuru?: number | null;
  iskontoDegeri?: number | null;
  /** stokKartId boş + urunAdi/kdvOrani dolu: serbest ürün (Hızlı Satış, stoktan düşmez) */
  satirlar: { stokKartId: number | null; urunAdi?: string; birim?: string; kdvOrani?: number; miktar: number; kdvDahilFiyat?: number | null; iskontoTuru?: number | null; iskontoDegeri?: number | null; kampanyaId?: number | null }[];
  odemeler?: TicariOdeme[];
  eksiStokOnay?: boolean;
  /** Kullanılan fiyat listesi (İş 11, G7); yoksa ana liste */
  fiyatListesiId?: number | null;
}

/** Satış iadesi (docs/TICARI_ADISYON_YOL_HARITASI.md, TA6): iade penceresi kaynağı */
export interface TicariIadeKaynakSatiri {
  satirNo: number; stokKartId: number | null; kod: string | null; ad: string; birim: string; kdvOrani: number;
  satilan: number; iadeEdilen: number; kalan: number; netBirimFiyat: number;
  asil: { miktar: number; matrah: number; kdv: number; birimFiyat: number; kdvOrani: number };
  onceki: { miktar: number; matrah: number; kdv: number };
}
export interface TicariIadeKaynagi {
  fis: { faturaId: number; faturaNo: string; tarih: string; aliciVknTckn: string; aliciUnvan: string; cariKartId: number | null; cariKod: string | null; cariAd: string | null; genelToplam: number; eBelgeDurumu: number; ettn: string };
  satirlar: TicariIadeKaynakSatiri[];
  oncekiIadeler: { faturaId: number; faturaNo: string; tarih: string; tutar: number }[];
  /** Asıl fişin ödemeleri (F11) ve karta en çok iade edilebilecek tutar (T9) */
  asilOdemeler?: { odemeAraciTuru: number; posCihaziId: number | null; tutar: number }[];
  kartaIadeSiniri?: number;
}

export interface TicariSatisListeSatiri {
  faturaId: number;
  faturaNo: string;
  tarih: string;
  /** 1 satış, 2 iade (TA6) */
  faturaTipi?: number;
  senaryo: string;
  aliciVknTckn: string;
  aliciUnvan: string;
  cariKartId: number | null;
  cariKod: string | null;
  vezneId: number | null;
  vezneKod: string | null;
  satirSayisi: number;
  brutDahil: number;
  iskonto: number;
  matrah: number;
  toplamKdv: number;
  genelToplam: number;
  nakit: number;
  kart: number;
  cari: number;
  havale: number;
  eBelgeDurumu: number;
}

export interface StokDurumSatiri {
  stokKartId: number;
  kod: string;
  ad: string;
  grupAdi: string;
  birim: string;
  giris: number;
  cikis: number;
  bakiye: number;
  enAzStok: number | null;
  eksik: boolean;
  maliyet: number | null;
  deger: number | null;
  sonHareket: string | null;
  aktif: boolean;
}

export interface StokHareketSatiri {
  stokHareketId: number;
  stokKartId: number;
  kod: string;
  ad: string;
  birim: string;
  tarih: string;
  /** 1 giriş, 2 satış / satış iadesi, 3 sayım, 4 fire, 5 tedarikçiye iade */
  belgeTuru: number;
  belgeTuruAdi: string;
  /** Satış iadesi fişi (belgeTuru 2) */
  iade?: boolean;
  belgeId: number;
  belgeNo: string;
  karsiTaraf: string;
  giris: number;
  cikis: number;
  birimFiyat: number | null;
  bakiye: number | null;
}

export interface ExcelOnizleme {
  sutunHatalari: string[];
  bilgiler: string[];
  satirlar: { satir: number; deger: Record<string, string>; durum: "YENI" | "GUNCELLE"; eslesenKod: string | null; hatalar: { sutun: string; mesaj: string }[] }[];
  hataliSatir: number;
  yeni: number;
  guncellenecek: number;
  acilisKalemi: number;
  yuklenebilir: boolean;
}

/** Eksi stok uyarısı (409, errors.kod = EKSI_STOK): ekran onay sorup eksiStokOnay ile yeniden gönderir */
export const eksiStokUyarisiMi = (e: any): boolean => e?.status === 409 && e?.kod === "EKSI_STOK";

const temizle = (p: Record<string, any>) => Object.fromEntries(Object.entries(p).filter(([, v]) => v !== undefined && v !== null && v !== ""));

export const TicariService = {
  async yetki(): Promise<{ yonetebilir: boolean; sistemYoneticisi: boolean }> {
    return (await apiClient.get("/ticari/yetki")).data;
  },
  async ayarlar(): Promise<StokAyarlari> {
    return (await apiClient.get("/ticari/ayarlar")).data;
  },
  async ayarKaydet(g: { eksiStok?: string; yetkiliKullanicilar?: number[]; teraziDuzenleri?: TeraziDuzeni[]; vardiyaZorunlu?: boolean; sktUyariGun?: number | string | null }): Promise<StokAyarlari> {
    return (await apiClient.put("/ticari/ayarlar", g)).data;
  },

  // Fiyat listeleri (İş 11, G6–G9)
  async fiyatListeleri(yalnizAktif = false): Promise<FiyatListesi[]> {
    return (await apiClient.get("/ticari/fiyat-listeleri", temizle({ aktif: yalnizAktif ? "1" : undefined }))).data || [];
  },
  async fiyatListesiKaydet(g: { fiyatListesiId?: number | null; ad: string; aktif?: boolean; sira?: number | null }): Promise<FiyatListesi> {
    return (g.fiyatListesiId ? await apiClient.put(`/ticari/fiyat-listeleri/${g.fiyatListesiId}`, g) : await apiClient.post("/ticari/fiyat-listeleri", g)).data;
  },
  async fiyatListesiSil(id: number): Promise<void> {
    await apiClient.delete(`/ticari/fiyat-listeleri/${id}`);
  },
  async fiyatListesiCarileri(id: number): Promise<{ cariKartId: number; kod: string; unvan: string }[]> {
    return (await apiClient.get(`/ticari/fiyat-listeleri/${id}/cariler`)).data || [];
  },
  /** Carinin varsayılan fiyat listesi; yoksa null (ana liste) */
  async cariFiyatListesi(cariKartId: number): Promise<{ fiyatListesiId: number; ad: string } | null> {
    return (await apiClient.get(`/ticari/cari-fiyat-listesi/${cariKartId}`, undefined, { silent: true } as any)).data ?? null;
  },
  async cariFiyatListesiKaydet(cariKartId: number, fiyatListesiId: number | null): Promise<{ fiyatListesiId: number; ad: string } | null> {
    return (await apiClient.put(`/ticari/cari-fiyat-listesi/${cariKartId}`, { fiyatListesiId })).data ?? null;
  },

  // Kampanyalar (İş 11, G12)
  async kampanyalar(): Promise<Kampanya[]> {
    return (await apiClient.get("/ticari/kampanyalar")).data || [];
  },
  async aktifKampanyalar(): Promise<AktifKampanya[]> {
    return (await apiClient.get("/ticari/kampanyalar/aktif", undefined, { silent: true } as any)).data || [];
  },
  async kampanyaKaydet(g: KampanyaGirdi): Promise<Kampanya> {
    return (g.kampanyaId ? await apiClient.put(`/ticari/kampanyalar/${g.kampanyaId}`, g) : await apiClient.post("/ticari/kampanyalar", g)).data;
  },
  async kampanyaSil(id: number): Promise<void> {
    await apiClient.delete(`/ticari/kampanyalar/${id}`);
  },

  // Toplu fiyat işlemleri (İş 11, G11, G13, G14)
  async fiyatIslemiOnizle(g: FiyatIslemiGirdi): Promise<FiyatIslemiOnizleme> {
    return (await apiClient.post("/ticari/fiyat-islemi/onizle", g, { timeoutMs: 90000 } as any)).data;
  },
  async fiyatIslemiUygula(g: FiyatIslemiGirdi): Promise<{ islemNo: number; degisen: number; atlanan: number }> {
    return (await apiClient.post("/ticari/fiyat-islemi/uygula", g, { timeoutMs: 180000 } as any)).data;
  },
  async fiyatIslemiGeriAl(islemNo: number): Promise<{ islemNo: number; degisen: number }> {
    return (await apiClient.post("/ticari/fiyat-islemi/geri-al", { islemNo }, { timeoutMs: 180000 } as any)).data;
  },
  async fiyatIslemiGecmis(): Promise<FiyatIslemiGecmisKaydi[]> {
    return (await apiClient.get("/ticari/fiyat-islemi/gecmis")).data || [];
  },

  // Ticari etiket düzeni (İş 2, G5)
  async etiketDuzeni(): Promise<EtiketDuzeni> {
    return (await apiClient.get("/ticari/etiket-duzeni")).data;
  },
  async etiketDuzeniKaydet(d: EtiketDuzeni): Promise<EtiketDuzeni> {
    return (await apiClient.put("/ticari/etiket-duzeni", d)).data;
  },

  async gruplar(): Promise<StokGrup[]> {
    return (await apiClient.get("/ticari/gruplar")).data || [];
  },
  async grupKaydet(g: { stokGrupId?: number | null; ad: string; aktif?: boolean }): Promise<StokGrup> {
    return (g.stokGrupId ? await apiClient.put(`/ticari/gruplar/${g.stokGrupId}`, g) : await apiClient.post("/ticari/gruplar", g)).data;
  },
  async grupSil(id: number): Promise<void> {
    await apiClient.delete(`/ticari/gruplar/${id}`);
  },
  /** Gruba kart ekleme / çıkarma (İş 10, G15) */
  async grupKartlari(id: number, g: { ekle?: number[]; cikar?: number[] }): Promise<{ eklenen: number; cikarilan: number; tasinan: number }> {
    return (await apiClient.put(`/ticari/gruplar/${id}/kartlar`, g)).data;
  },

  /** Sınırlı liste (varsayılan 500, en çok 2.000). idler: yalnız verilen kartlar (hızlı satış butonları, açık fişin satırları). liste: fiyat listesi → listeFiyati */
  async kartlar(f: { arama?: string; grupId?: number | null; aktif?: boolean | null; idler?: number[]; limit?: number; liste?: number | null } = {}): Promise<StokKart[]> {
    if (f.idler && !f.idler.length) return [];
    return (await apiClient.get("/ticari/kartlar", temizle({
      arama: f.arama, grupId: f.grupId, aktif: f.aktif === true ? "1" : f.aktif === false ? "0" : undefined,
      idler: f.idler ? [...new Set(f.idler.map(Number).filter((x) => x > 0))].join(",") : undefined, limit: f.limit, liste: f.liste || undefined,
    }))).data || [];
  },
  /** Sayfalı liste (G2): sayfa 1'den başlar, adet en çok 500 */
  async kartlarSayfali(f: { arama?: string; grupId?: number | null; aktif?: boolean | null; sayfa?: number; adet?: number; liste?: number | null } = {}): Promise<{ kartlar: StokKart[]; toplam: number; sayfa: number; adet: number }> {
    const r = (await apiClient.get("/ticari/kartlar/sayfali", temizle({
      arama: f.arama, grupId: f.grupId, aktif: f.aktif === true ? "1" : f.aktif === false ? "0" : undefined, sayfa: f.sayfa, adet: f.adet, liste: f.liste || undefined,
    }))).data;
    return { kartlar: r?.kartlar || [], toplam: Number(r?.toplam) || 0, sayfa: Number(r?.sayfa) || 1, adet: Number(r?.adet) || 200 };
  },
  async kart(id: number, liste?: number | null): Promise<StokKart> {
    return (await apiClient.get(`/ticari/kartlar/${id}`, temizle({ liste: liste || undefined }))).data;
  },
  /** Barkod ya da kodla tam eşleşen kart; yoksa null. liste: fiyat listesi → listeFiyati */
  async kartBul(deger: string, liste?: number | null): Promise<StokKart | null> {
    try {
      return (await apiClient.get(`/ticari/kart-bul/${encodeURIComponent(deger.trim())}`, temizle({ liste: liste || undefined }), { silent: true } as any)).data;
    } catch (e: any) {
      // Terazi etiketi okundu ama koda bağlı kart yok (TA3): çağıran mesajı gösterir, "yeni kart aç" akışına düşmez
      if (e?.status === 404 && e?.kod === "TERAZI_KARTSIZ") throw e;
      if (e?.status === 404) return null;
      throw e;
    }
  },
  async kartKaydet(g: StokKartGirdi): Promise<StokKart> {
    return (g.stokKartId ? await apiClient.put(`/ticari/kartlar/${g.stokKartId}`, g) : await apiClient.post("/ticari/kartlar", g)).data;
  },
  async kartSil(id: number): Promise<void> {
    await apiClient.delete(`/ticari/kartlar/${id}`);
  },

  async excelOrnek(): Promise<Blob> {
    return dosyaGetir("/ticari/excel/ornek", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  },
  async excelOnizle(dosya: string): Promise<ExcelOnizleme> {
    return (await apiClient.post("/ticari/excel/onizle", { dosya }, { timeoutMs: 120000 } as any)).data;
  },
  async excelYukle(dosya: string): Promise<{ yeni: number; guncellenen: number; acilisFisNo: string | null }> {
    return (await apiClient.post("/ticari/excel/yukle", { dosya }, { timeoutMs: 300000 } as any)).data;
  },

  async girisSiraNo(): Promise<string> {
    return (await apiClient.get("/ticari/giris/sira-no")).data?.fisNo || "";
  },
  /** Dürbün gelişmiş filtresi drb önekli alanlarla gider (utils/fisDurbunFiltre.ts) */
  async girisListe(f: { baslangic?: string; bitis?: string; cariKartId?: number | null; arama?: string; limit?: number; [durbun: string]: string | number | null | undefined } = {}): Promise<StokGiris[]> {
    return (await apiClient.get("/ticari/giris", temizle(f as any))).data || [];
  },
  async giris(id: number): Promise<StokGiris> {
    return (await apiClient.get(`/ticari/giris/${id}`)).data;
  },
  async girisKaydet(g: { stokGirisId?: number | null; tarih?: string; cariKartId?: number | null; belgeNo?: string; aciklama?: string; vezneId?: number | null;
    satirlar: { stokKartId: number; miktar: number; birimFiyat?: number | null; kdvOrani?: number | null }[]; eksiStokOnay?: boolean }): Promise<{ fis: StokGiris; uyari: string | null }> {
    return (g.stokGirisId ? await apiClient.put(`/ticari/giris/${g.stokGirisId}`, g) : await apiClient.post("/ticari/giris", g)).data;
  },
  async girisSil(id: number, onay = false): Promise<void> {
    await apiClient.delete(`/ticari/giris/${id}${onay ? "?onay=1" : ""}`);
  },

  async satisSiraNo(senaryo: string): Promise<string> {
    return (await apiClient.get("/ticari/satis/sira-no", { senaryo })).data?.faturaNo || "";
  },
  /** Dürbün gelişmiş filtresi drb önekli alanlarla gider (utils/fisDurbunFiltre.ts) */
  async satisListe(f: { baslangic?: string; bitis?: string; arama?: string; eBelgeDurumu?: number | null; stokKartId?: number | null; limit?: number; tip?: number | null; [durbun: string]: string | number | null | undefined } = {}): Promise<TicariSatisListeSatiri[]> {
    return (await apiClient.get("/ticari/satis", temizle(f as any))).data || [];
  },
  async satisKimlikler(): Promise<{ faturaId: number; faturaNo: string }[]> {
    return (await apiClient.get("/ticari/satis/kimlikler")).data || [];
  },
  async satis(id: number): Promise<TicariSatisFisi> {
    return (await apiClient.get(`/ticari/satis/${id}`)).data;
  },
  async satisKaydet(g: TicariSatisGirdi): Promise<{ fis: TicariSatisFisi; uyari: string | null }> {
    return (g.faturaId ? await apiClient.put(`/ticari/satis/${g.faturaId}`, g) : await apiClient.post("/ticari/satis", g)).data;
  },
  async satisSil(id: number): Promise<void> {
    await apiClient.delete(`/ticari/satis/${id}`);
  },
  // ── Satış iadesi (TA6) ──
  async iadeKaynak(asilFaturaId: number): Promise<TicariIadeKaynagi> {
    return (await apiClient.get(`/ticari/iade/kaynak/${asilFaturaId}`)).data;
  },
  async iadeKaydet(g: { asilFaturaId: number; tarih?: string | null; neden?: string | null; satirlar: { asilSatirNo: number; miktar: number }[]; odemeler?: TicariOdeme[] }): Promise<TicariSatisFisi & { asil: { faturaId: number; faturaNo: string; tarih: string; eBelgeDurumu: number; ettn: string } | null; neden: string | null }> {
    return (await apiClient.post("/ticari/iade", g)).data;
  },
  async iadeGetir(id: number): Promise<TicariSatisFisi & { asil: { faturaId: number; faturaNo: string; tarih: string; eBelgeDurumu: number; ettn: string } | null; neden: string | null }> {
    return (await apiClient.get(`/ticari/iade/${id}`)).data;
  },
  async iadeSil(id: number): Promise<void> {
    await apiClient.delete(`/ticari/iade/${id}`);
  },
  async iadeGiderTaslagi(id: number): Promise<any> {
    return (await apiClient.get(`/ticari/iade/${id}/gider-taslagi`)).data;
  },

  // Kasiyer vardiyası (TA8). vezneId yalnız sistem yöneticisi için dikkate alınır; öteki kullanıcıda kendi veznesi
  async vardiyaDurum(vezneId?: number | null): Promise<VardiyaDurumu> {
    return (await apiClient.get("/ticari/vardiya/durum", vezneId ? { vezneId } : {})).data;
  },
  async vardiyaAc(g: { devir: number | string; not?: string | null; vezneId?: number | null }): Promise<VardiyaDurumu & { vardiyaId: number }> {
    return (await apiClient.post("/ticari/vardiya/ac", g)).data;
  },
  async vardiyaKapat(g: { sayilan?: number | string | null; kupur?: Record<string, number> | null; not?: string | null; vezneId?: number | null }): Promise<VardiyaOzeti> {
    return (await apiClient.post("/ticari/vardiya/kapat", g)).data;
  },
  async vardiyaListe(f: { vezneId?: number | null; baslangic?: string; bitis?: string; limit?: number } = {}): Promise<VardiyaListeSatiri[]> {
    return (await apiClient.get("/ticari/vardiya", temizle(f as any))).data || [];
  },
  async vardiyaRapor(id: number): Promise<VardiyaOzeti> {
    return (await apiClient.get(`/ticari/vardiya/${id}`)).data;
  },
  // Sayım fişi (TA11)
  async sayimKartlari(f: { grupId?: number | null; tarih?: string | null; sayimId?: number | null }): Promise<SayimKarti[]> {
    return (await apiClient.get("/ticari/sayim/kartlar", temizle(f as any))).data || [];
  },
  async sayimListe(f: { baslangic?: string; bitis?: string; durum?: number | null } = {}): Promise<SayimListeSatiri[]> {
    return (await apiClient.get("/ticari/sayim", temizle(f as any))).data || [];
  },
  async sayim(id: number): Promise<SayimFisi> {
    return (await apiClient.get(`/ticari/sayim/${id}`)).data;
  },
  async sayimKaydet(g: { sayimId?: number | null; tarih: string; stokGrupId?: number | null; aciklama?: string | null; satirlar: { stokKartId: number; sayilan: number }[] }): Promise<SayimFisi> {
    return g.sayimId ? (await apiClient.put(`/ticari/sayim/${g.sayimId}`, g)).data : (await apiClient.post("/ticari/sayim", g)).data;
  },
  async sayimOnayla(id: number, sayilmayanSifir: boolean): Promise<SayimFisi> {
    return (await apiClient.post(`/ticari/sayim/${id}/onay`, { sayilmayanSifir })).data;
  },
  async sayimGeriAl(id: number, onay = false): Promise<SayimFisi> {
    return (await apiClient.post(`/ticari/sayim/${id}/geri-al${onay ? "?onay=1" : ""}`, {})).data;
  },
  async sayimSil(id: number): Promise<void> {
    await apiClient.delete(`/ticari/sayim/${id}`);
  },
  // Gelen e-Faturadan stok girişi (TA14)
  async efGelenListe(f: { baslangic?: string; bitis?: string; arama?: string } = {}): Promise<EfaturaGelenSatiri[]> {
    return (await apiClient.get("/ticari/efatura-giris/gelen", temizle(f as any))).data || [];
  },
  async efGelenOnizle(uuid: string): Promise<EfaturaOnizleme> {
    return (await apiClient.get(`/ticari/efatura-giris/gelen/${encodeURIComponent(uuid)}/onizle`)).data;
  },
  async efXmlOnizle(xml: string): Promise<EfaturaOnizleme> {
    return (await apiClient.post("/ticari/efatura-giris/xml/onizle", { xml })).data;
  },
  async efAl(kaynak: { uuid?: string; xml?: string }, g: { cariKartId?: number | null; tarih?: string | null; satirlar: EfaturaAlimSecimi[] }): Promise<{ fis: StokGiris; uyari: string | null; girisToplam: number; fark: number; yeniKartSayisi: number }> {
    return kaynak.uuid ? (await apiClient.post(`/ticari/efatura-giris/gelen/${encodeURIComponent(kaynak.uuid)}`, g)).data : (await apiClient.post("/ticari/efatura-giris/xml", { ...g, xml: kaynak.xml })).data;
  },
  // Tedarikçiye iade (TA13)
  async tedIadeKaynak(girisId: number): Promise<TedarikciIadeKaynagi> {
    return (await apiClient.get(`/ticari/tedarikci-iade/kaynak/${girisId}`)).data;
  },
  async tedIadeListe(f: { baslangic?: string; bitis?: string; cariKartId?: number | null } = {}): Promise<TedarikciIadeListeSatiri[]> {
    return (await apiClient.get("/ticari/tedarikci-iade", temizle(f as any))).data || [];
  },
  async tedIade(id: number): Promise<TedarikciIadesi> {
    return (await apiClient.get(`/ticari/tedarikci-iade/${id}`)).data;
  },
  async tedIadeKaydet(g: { stokGirisId?: number | null; cariKartId?: number | null; tarih: string; belgeNo?: string | null; aciklama?: string | null;
    satirlar: { girisSatirNo?: number | null; stokKartId?: number | null; miktar: number; birimFiyat?: number | null; kdvOrani?: number | null }[]; eksiStokOnay?: boolean }): Promise<{ fis: TedarikciIadesi; uyari: string | null }> {
    return (await apiClient.post("/ticari/tedarikci-iade", g)).data;
  },
  async tedIadeSil(id: number): Promise<void> {
    await apiClient.delete(`/ticari/tedarikci-iade/${id}`);
  },
  async tedIadeEbelgeTaslagi(id: number): Promise<{ iadeNo: string; genelToplam: number; icerik: Record<string, any>; eksik: string[] }> {
    return (await apiClient.get(`/ticari/tedarikci-iade/${id}/ebelge-taslagi`)).data;
  },
  async tedIadeTaslakBagla(id: number, taslakId: number): Promise<void> {
    await apiClient.post(`/ticari/tedarikci-iade/${id}/ebelge-taslagi`, { taslakId });
  },
  // Fire / zayi fişi (TA12)
  async fireNedenleri(): Promise<string[]> {
    return (await apiClient.get("/ticari/fire/nedenler")).data || [];
  },
  async fireListe(f: { baslangic?: string; bitis?: string; neden?: string; stokKartId?: number | null } = {}): Promise<FireListesi> {
    return (await apiClient.get("/ticari/fire", temizle(f as any))).data;
  },
  async fire(id: number): Promise<FireFisi> {
    return (await apiClient.get(`/ticari/fire/${id}`)).data;
  },
  // Parçalama (TA17)
  async parcalamaListe(f: { baslangic?: string; bitis?: string; stokKartId?: number | null } = {}): Promise<ParcalamaListeSatiri[]> {
    return (await apiClient.get("/ticari/parcalama", temizle(f as any))).data || [];
  },
  async parcalama(id: number): Promise<ParcalamaFisi> {
    return (await apiClient.get(`/ticari/parcalama/${id}`)).data;
  },
  async parcalamaKaydet(g: { parcalamaId?: number | null; tarih: string; girdiKartId: number; girdiMiktar: number; fireMiktar?: number | null; sablonId?: number | null; aciklama?: string | null;
    satirlar: { stokKartId: number; miktar: number; birimMaliyet: number }[]; eksiStokOnay?: boolean }): Promise<{ fis: ParcalamaFisi; uyari: string | null }> {
    return g.parcalamaId ? (await apiClient.put(`/ticari/parcalama/${g.parcalamaId}`, g)).data : (await apiClient.post("/ticari/parcalama", g)).data;
  },
  async parcalamaSil(id: number, onay = false): Promise<void> {
    await apiClient.delete(`/ticari/parcalama/${id}${onay ? "?onay=1" : ""}`);
  },
  async parcalamaGirdiMaliyeti(stokKartId: number, tarih: string): Promise<{ stokKartId: number; birim: string; birimMaliyet: number; bakiye: number }> {
    return (await apiClient.get("/ticari/parcalama/girdi-maliyeti", { stokKartId, tarih } as any)).data;
  },
  async parcalamaSablonlar(): Promise<ParcalamaSablonu[]> {
    return (await apiClient.get("/ticari/parcalama/sablon")).data || [];
  },
  async parcalamaSablonKaydet(g: { sablonId?: number | null; ad: string; girdiKartId: number; aciklama?: string | null; satirlar: { stokKartId: number; verimYuzde?: number | null; maliyetPayi?: number | null }[] }): Promise<ParcalamaSablonu> {
    return g.sablonId ? (await apiClient.put(`/ticari/parcalama/sablon/${g.sablonId}`, g)).data : (await apiClient.post("/ticari/parcalama/sablon", g)).data;
  },
  async parcalamaSablonSil(id: number): Promise<void> {
    await apiClient.delete(`/ticari/parcalama/sablon/${id}`);
  },
  async fireKaydet(g: { fireId?: number | null; tarih: string; aciklama?: string | null; satirlar: { stokKartId: number; miktar: number; neden: string }[]; eksiStokOnay?: boolean }): Promise<{ fis: FireFisi; uyari: string | null }> {
    return g.fireId ? (await apiClient.put(`/ticari/fire/${g.fireId}`, g)).data : (await apiClient.post("/ticari/fire", g)).data;
  },
  async fireSil(id: number): Promise<void> {
    await apiClient.delete(`/ticari/fire/${id}`);
  },
  async gunSonu(f: { baslangic: string; bitis: string; kasiyerId?: number | null; vezneId?: number | null }): Promise<GunSonuRaporu> {
    return (await apiClient.get("/ticari/gun-sonu", temizle(f as any))).data;
  },
  async sktYaklasan(f: { gun?: number | null; grupId?: number | null; arama?: string; tumu?: boolean } = {}): Promise<SktRaporu> {
    return (await apiClient.get("/ticari/skt-yaklasan", temizle({ ...f, tumu: f.tumu ? "1" : undefined } as any), { timeoutMs: 90000 } as any)).data;
  },
  async karRaporu(f: { baslangic: string; bitis: string; grupId?: number | null; stokKartId?: number | null }): Promise<KarRaporu> {
    return (await apiClient.get("/ticari/kar-raporu", temizle(f as any), { timeoutMs: 90000 } as any)).data;
  },

  async stokDurum(f: { tarih?: string; grupId?: number | null; arama?: string; yalnizEksik?: boolean; pasifler?: boolean } = {}) {
    // Büyük firmada (200.000 kart) rapor birkaç saniye sürer; genel 15 sn zaman aşımı yerine 90 sn
    return (await apiClient.get("/ticari/rapor/stok-durum", temizle({ ...f, yalnizEksik: f.yalnizEksik ? "1" : undefined, pasifler: f.pasifler ? "1" : undefined }), { timeoutMs: 90000 } as any)).data as {
      satirlar: StokDurumSatiri[]; toplam: { kart: number; deger: number; eksik: number; eksiBakiye: number }; kesildi?: boolean; sinir?: number;
    };
  },
  async hareketler(f: { stokKartId?: number | null; baslangic?: string; bitis?: string; belgeTuru?: number | null; grupId?: number | null } = {}) {
    return (await apiClient.get("/ticari/rapor/hareketler", temizle(f as any), { timeoutMs: 90000 } as any)).data as {
      satirlar: StokHareketSatiri[]; devirler: { stokKartId: number; kod: string; ad: string; birim: string; devir: number }[]; toplam: { giris: number; cikis: number };
      toplamSatir?: number; kesildi?: boolean; sinir?: number;
    };
  },
};

export const BIRIM_SECENEKLERI = ["Adet", "Kg", "Gr", "Lt", "Metre", "Paket", "Kutu"];
export const KDV_SECENEKLERI = [0, 1, 10, 20];

export const para = (n: number | null | undefined, hane = 2) =>
  n === null || n === undefined || Number.isNaN(Number(n)) ? "" : Number(n).toLocaleString("tr-TR", { minimumFractionDigits: hane, maximumFractionDigits: hane });
export const miktarYaz = (n: number | null | undefined) =>
  n === null || n === undefined ? "" : Number(n).toLocaleString("tr-TR", { maximumFractionDigits: 4 });
export const tarihYaz = (t: string | null | undefined) => (t ? new Date(t).toLocaleDateString("tr-TR") : "");
export const saatYaz = (t: string | null | undefined) => (t ? new Date(t).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }) : "");

/** Dosyayı base64 veri adresine çevirir (Excel yükleme, resim) */
export const dosyaOku = (f: File): Promise<string> =>
  new Promise((tamam, hata) => {
    const r = new FileReader();
    r.onload = () => tamam(String(r.result || ""));
    r.onerror = () => hata(new Error("Dosya okunamadı."));
    r.readAsDataURL(f);
  });
