import { apiClient, getEffectiveApiUrl } from "./apiClient";
import type { SecimSatiri } from "../../Backend/src/services/adisyon/adisyonHesap";

/** Adisyon istemcisi (docs/TICARI_ADISYON_YOL_HARITASI.md): masa / garson / mutfak */
export interface AdisyonAyarlari {
  kdvVarsayilan: number | null;
  servisAcik: boolean;
  servisOrani: number;
  stokTakibi: boolean;
  birimKodu: string;
  /** Tahsilat veznesi (D7); boşsa ana vezne */
  vezneId: number | null;
  /** Varsayılan POS hesabı: POS seçilmeden alınan kart ödemesi (garson telefonu, ara ödeme) bu hesaba yazılır */
  posCihaziId?: number | null;
  /** Masadan misafir siparişi (QR / masa PIN, §11 M5); varsayılan kapalı */
  misafirSiparis?: boolean;
}
/** Masa QR kodları (§11 M4) */
export interface MasaQrListesi { musteriNo: string | null; acik: boolean; masalar: { masaId: number; ad: string; bolgeId: number; bolge: string; aktif: boolean; anahtar: string }[] }

export interface MasaTanim { masaId: number; bolgeId: number; ad: string; sira: number; kisi: number | null; aktif: boolean }
export interface BolgeTanim { bolgeId: number; ad: string; sira: number; fiyatListesiId: number | null; fiyatListesiAd: string | null; aktif: boolean; masalar: MasaTanim[] }
export interface HazirlikYeri { yerId: number; ad: string; yazici: string | null; ekran: boolean; aktif: boolean; grupSayisi: number }
export interface GrupYer { stokGrupId: number; ad: string; yerId: number | null }
export interface Secenek { secenekId: number; ad: string; ekFiyat: number; sira: number; aktif: boolean }
export interface SecenekGrubu { sgId: number; ad: string; zorunlu: boolean; coklu: boolean; aktif: boolean; kartSayisi: number; secenekler: Secenek[] }
export interface Porsiyon { porsiyonId?: number; ad: string; carpan: number; fiyat: number | null; sira?: number }
export interface KartAyrintisi { stokKartId: number; secenekGrupIdler: number[]; porsiyonlar: Porsiyon[] }
export interface Garson { garsonId: number; ad: string; seviye: number; ekYetki: string[]; yetkiler: string[]; aktif: boolean; sonGiris: string | null; kilitli: boolean; kullaniciId: number | null; kullaniciAdi: string | null }
/** Garson kartında seçilecek kullanıcı (Kullanıcı Tanımları); başka garsona bağlıysa garsonId dolu */
export interface GarsonKullanicisi { kullaniciId: number; ad: string; garsonId: number | null; garsonAd: string | null }
export interface GarsonListesi { garsonlar: Garson[]; limit: number | null; aktifSayi: number }
type Silme = { silindi: boolean };

export const AdisyonService = {
  async ayarlar(): Promise<AdisyonAyarlari> {
    return (await apiClient.get("/adisyon/ayarlar")).data;
  },
  async ayarKaydet(g: Partial<AdisyonAyarlari>): Promise<AdisyonAyarlari> {
    return (await apiClient.put("/adisyon/ayarlar", g)).data;
  },
  // ── Tanımlar (D2) ──
  async bolgeler(yalnizAktif = false): Promise<BolgeTanim[]> {
    return (await apiClient.get("/adisyon/tanim/bolgeler", yalnizAktif ? { aktif: 1 } : undefined)).data;
  },
  async bolgeKaydet(g: { bolgeId?: number | null; ad: string; sira?: number | null; fiyatListesiId?: number | null; aktif?: boolean }): Promise<{ bolgeId: number }> {
    return (g.bolgeId ? await apiClient.put(`/adisyon/tanim/bolge/${g.bolgeId}`, g) : await apiClient.post("/adisyon/tanim/bolge", g)).data;
  },
  async bolgeSil(id: number): Promise<Silme> {
    return (await apiClient.delete(`/adisyon/tanim/bolge/${id}`)).data;
  },
  async masaKaydet(g: { masaId?: number | null; bolgeId: number; ad: string; sira?: number | null; kisi?: number | null; aktif?: boolean }): Promise<{ masaId: number }> {
    return (g.masaId ? await apiClient.put(`/adisyon/tanim/masa/${g.masaId}`, g) : await apiClient.post("/adisyon/tanim/masa", g)).data;
  },
  async masaTopluEkle(g: { bolgeId: number; baslangic: number; bitis: number; onEk?: string | null; kisi?: number | null }): Promise<{ eklenen: number; atlanan: number }> {
    return (await apiClient.post("/adisyon/tanim/masa/toplu", g)).data;
  },
  async masaSil(id: number): Promise<Silme> {
    return (await apiClient.delete(`/adisyon/tanim/masa/${id}`)).data;
  },
  async yerler(): Promise<HazirlikYeri[]> {
    return (await apiClient.get("/adisyon/tanim/yerler")).data;
  },
  async yerKaydet(g: { yerId?: number | null; ad: string; yazici?: string | null; ekran?: boolean; aktif?: boolean }): Promise<{ yerId: number }> {
    return (g.yerId ? await apiClient.put(`/adisyon/tanim/yer/${g.yerId}`, g) : await apiClient.post("/adisyon/tanim/yer", g)).data;
  },
  async yerSil(id: number): Promise<Silme> {
    return (await apiClient.delete(`/adisyon/tanim/yer/${id}`)).data;
  },
  async grupYerleri(): Promise<GrupYer[]> {
    return (await apiClient.get("/adisyon/tanim/grup-yer")).data;
  },
  async grupYerKaydet(liste: { stokGrupId: number; yerId: number | null }[]): Promise<GrupYer[]> {
    return (await apiClient.put("/adisyon/tanim/grup-yer", { liste })).data;
  },
  async secenekGruplari(): Promise<SecenekGrubu[]> {
    return (await apiClient.get("/adisyon/tanim/secenekler")).data;
  },
  async secenekGrupKaydet(g: { sgId?: number | null; ad: string; zorunlu?: boolean; coklu?: boolean; aktif?: boolean; secenekler: { secenekId?: number | null; ad: string; ekFiyat?: number | string | null; aktif?: boolean }[] }): Promise<{ sgId: number }> {
    return (g.sgId ? await apiClient.put(`/adisyon/tanim/secenek/${g.sgId}`, g) : await apiClient.post("/adisyon/tanim/secenek", g)).data;
  },
  async secenekGrupSil(id: number): Promise<void> {
    await apiClient.delete(`/adisyon/tanim/secenek/${id}`);
  },
  async kartAyrintisi(stokKartId: number): Promise<KartAyrintisi> {
    return (await apiClient.get(`/adisyon/tanim/kart/${stokKartId}`)).data;
  },
  async kartAyrintisiKaydet(stokKartId: number, g: { secenekGrupIdler?: number[]; porsiyonlar?: { ad: string; carpan: number | string; fiyat?: number | string | null }[] }): Promise<KartAyrintisi> {
    return (await apiClient.put(`/adisyon/tanim/kart/${stokKartId}`, g)).data;
  },
  async garsonlar(): Promise<GarsonListesi> {
    return (await apiClient.get("/adisyon/tanim/garsonlar")).data;
  },
  async garsonKullanicilari(): Promise<GarsonKullanicisi[]> {
    return (await apiClient.get("/adisyon/tanim/garson-kullanicilari")).data;
  },
  async garsonKaydet(g: { garsonId?: number | null; ad: string; kullaniciId: number | null; seviye?: number; ekYetki?: string[]; aktif?: boolean }): Promise<{ garsonId: number }> {
    return (g.garsonId ? await apiClient.put(`/adisyon/tanim/garson/${g.garsonId}`, g) : await apiClient.post("/adisyon/tanim/garson", g)).data;
  },
  async garsonSil(id: number): Promise<Silme> {
    return (await apiClient.delete(`/adisyon/tanim/garson/${id}`)).data;
  },
  // ── Masa / sipariş (D3) ──
  async masalar(): Promise<MasaDurumu> {
    return (await apiClient.get("/adisyon/masalar")).data;
  },
  async menu(bolgeId: number | null): Promise<AdisyonMenu> {
    return (await apiClient.get("/adisyon/menu", bolgeId ? { bolgeId } : undefined)).data;
  },
  async getir(adisyonId: number): Promise<AdisyonAyrinti> {
    return (await apiClient.get(`/adisyon/kayit/${adisyonId}`)).data;
  },
  async siparis(g: SiparisGirdi): Promise<AdisyonAyrinti & { tekrar: boolean }> {
    return (await apiClient.post("/adisyon/siparis", g)).data;
  },
  async kisi(adisyonId: number, kisi: number): Promise<AdisyonAyrinti> {
    return (await apiClient.put(`/adisyon/kayit/${adisyonId}/kisi`, { kisi })).data;
  },
  async servis(kalemIdler: number[]): Promise<{ degisen: number }> {
    return (await apiClient.post("/adisyon/kalem/servis", { kalemIdler })).data;
  },
  // ── Masa işlemleri (D6) ──
  async yetkilerim(): Promise<string[]> {
    return (await apiClient.get("/adisyon/yetkilerim")).data.yetkiler;
  },
  async ikram(adisyonId: number, kalemler: KalemSecimi[], g: { ikram?: boolean; neden?: string; aciklama?: string; istekId?: string }): Promise<AdisyonAyrinti> {
    return (await apiClient.post(`/adisyon/kayit/${adisyonId}/ikram`, { kalemler, ...g })).data;
  },
  async iptal(adisyonId: number, kalemler: KalemSecimi[], g: { neden: string; aciklama?: string; istekId?: string }): Promise<AdisyonAyrinti> {
    return (await apiClient.post(`/adisyon/kayit/${adisyonId}/iptal`, { kalemler, ...g })).data;
  },
  async adisyonIptal(adisyonId: number, g: { neden: string; aciklama?: string; istekId?: string }): Promise<AdisyonAyrinti> {
    return (await apiClient.post(`/adisyon/kayit/${adisyonId}/adisyon-iptal`, g)).data;
  },
  async masaTasi(adisyonId: number, masaId: number): Promise<AdisyonAyrinti> {
    return (await apiClient.post(`/adisyon/kayit/${adisyonId}/masa-tasi`, { masaId })).data;
  },
  async birlestir(adisyonId: number, hedefAdisyonId: number): Promise<AdisyonAyrinti> {
    return (await apiClient.post(`/adisyon/kayit/${adisyonId}/birlestir`, { hedefAdisyonId })).data;
  },
  async urunTasi(adisyonId: number, kalemler: KalemSecimi[], hedef: { masaId?: number; adisyonId?: number; istekId?: string }): Promise<UrunTasimaSonucu> {
    return (await apiClient.post(`/adisyon/kayit/${adisyonId}/urun-tasi`, { kalemler, ...hedef })).data;
  },
  // ── Raporlar / gün sonu (D10) ──
  async rapor(baslangic: string, bitis: string): Promise<AdisyonRaporu> {
    return (await apiClient.get("/adisyon/rapor", { baslangic, bitis })).data;
  },
  async acikOzet(): Promise<{ sayi: number; tutar: number }> {
    return (await apiClient.get("/adisyon/acik-ozet")).data;
  },
  // ── Paket servis / gel-al (D8) ──
  async paketler(): Promise<PaketListesi> {
    return (await apiClient.get("/adisyon/paketler")).data;
  },
  async paketDurum(adisyonId: number, durum: number): Promise<AdisyonAyrinti> {
    return (await apiClient.post(`/adisyon/kayit/${adisyonId}/paket-durum`, { durum })).data;
  },
  async paketGuncelle(adisyonId: number, g: { ad: string; tel: string | null; adres: string | null; not: string | null }): Promise<AdisyonAyrinti> {
    return (await apiClient.put(`/adisyon/kayit/${adisyonId}/paket`, g)).data;
  },
  async paketMusteri(tel: string): Promise<{ tel: string; ad: string | null; adres: string | null; siparisSayisi: number } | null> {
    return (await apiClient.post("/adisyon/paket-musteri", { tel })).data;
  },
  // ── Hesap / tahsilat (D7) ──
  async hesap(adisyonId: number): Promise<HesapDurumu> {
    return (await apiClient.get(`/adisyon/kayit/${adisyonId}/hesap`)).data;
  },
  async hesapIste(adisyonId: number): Promise<TahsilatSonucu> {
    return (await apiClient.post(`/adisyon/kayit/${adisyonId}/hesap-iste`, {})).data;
  },
  /** Misafir PIN'i (§11 M2–M3): yoksa üretilir; yenile = yeni PIN */
  async misafirPin(adisyonId: number, yenile = false): Promise<{ pin: string; masa: string; musteriNo: string | null }> {
    return (await apiClient.post(`/adisyon/kayit/${adisyonId}/misafir-pin`, { yenile })).data;
  },
  async masaQr(): Promise<MasaQrListesi> {
    return (await apiClient.get("/adisyon/tanim/masa-qr")).data;
  },
  async masaQrYenile(masaId: number): Promise<MasaQrListesi> {
    return (await apiClient.post(`/adisyon/tanim/masa/${masaId}/qr`, {})).data;
  },
  async odemeEkle(adisyonId: number, g: OdemeGirdi & { istekId: string; musteri?: MusteriGirdi | null }): Promise<TahsilatSonucu> {
    return (await apiClient.post(`/adisyon/kayit/${adisyonId}/odeme`, g)).data;
  },
  async odemeSil(odemeId: number): Promise<TahsilatSonucu> {
    return (await apiClient.delete(`/adisyon/odeme/${odemeId}`)).data;
  },
  async kapat(adisyonId: number, g: { istekId: string; odemeler: OdemeGirdi[]; musteri?: MusteriGirdi | null }): Promise<TahsilatSonucu> {
    return (await apiClient.post(`/adisyon/kayit/${adisyonId}/kapat`, g)).data;
  },
  async urunleOde(adisyonId: number, g: { istekId: string; kalemler: KalemSecimi[]; odemeler: OdemeGirdi[]; musteri?: MusteriGirdi | null }): Promise<TahsilatSonucu> {
    return (await apiClient.post(`/adisyon/kayit/${adisyonId}/urun-ode`, g)).data;
  },
  // ── İndirim / kalem fiyatı / yeniden açma (K1, TA25) ──
  async indirim(adisyonId: number, g: { tur: number; deger?: number; neden?: string }): Promise<TahsilatSonucu> {
    return (await apiClient.post(`/adisyon/kayit/${adisyonId}/indirim`, g)).data;
  },
  async fiyatDegistir(adisyonId: number, g: { kalemId: number; fiyat: number; neden: string }): Promise<AdisyonAyrinti> {
    return (await apiClient.post(`/adisyon/kayit/${adisyonId}/fiyat`, g)).data;
  },
  async yenidenAc(adisyonId: number, neden: string): Promise<TahsilatSonucu> {
    return (await apiClient.post(`/adisyon/kayit/${adisyonId}/yeniden-ac`, { neden })).data;
  },
  async kapananlar(gun?: string): Promise<{ gun: string; adisyonlar: KapananAdisyon[] }> {
    return (await apiClient.get("/adisyon/kapananlar", gun ? { gun } : undefined)).data;
  },
  // ── Mutfak (D5) ──
  async mutfakFisleriAl(adet = 1): Promise<{ fisId: number; tur: number; deneme: number; icerik: any }[]> {
    return (await apiClient.post(`/adisyon/mutfak/fisler/al?adet=${adet}`, {})).data;
  },
  async mutfakFisSonucu(fisId: number, basarili: boolean, hata?: string, ek?: { deneme?: number; ajanYok?: boolean }): Promise<{ guncellendi: boolean }> {
    return (await apiClient.post(`/adisyon/mutfak/fis/${fisId}/sonuc`, { basarili, hata, deneme: ek?.deneme, ajanYok: ek?.ajanYok === true })).data;
  },
  async mutfakBekleyen(): Promise<MutfakBekleyenFis[]> {
    return (await apiClient.get("/adisyon/mutfak/fisler")).data;
  },
  async mutfakFisYeniden(fisId: number, basildiSay = false): Promise<void> {
    await apiClient.post(`/adisyon/mutfak/fis/${fisId}/yeniden`, { basildiSay });
  },
  async mutfakSiparisler(yerId: number | null): Promise<MutfakSiparisleri> {
    return (await apiClient.get("/adisyon/mutfak/siparisler", yerId ? { yerId } : undefined)).data;
  },
  async mutfakHazir(kalemIdler: number[], hazir: boolean): Promise<{ degisen: number }> {
    return (await apiClient.post("/adisyon/mutfak/hazir", { kalemIdler, hazir })).data;
  },
  async ekranAnahtari(yerId: number): Promise<{ yerId: number; yer: string; anahtar: string; musteriNo: string | null }> {
    return (await apiClient.post(`/adisyon/tanim/yer/${yerId}/ekran-anahtari`, {})).data;
  },
  async ekranAnahtariSil(yerId: number): Promise<void> {
    await apiClient.delete(`/adisyon/tanim/yer/${yerId}/ekran-anahtari`);
  },
};

export interface KalemSecimi { kalemId: number; miktar?: number }
/** Paket / gel-al (D8) */
export interface PaketBilgisi { tur: 2 | 3; ad: string; tel: string | null; adres: string | null; not: string | null }
export interface PaketOzeti {
  adisyonId: number; adisyonNo: string; tur: number; durum: number; paketDurum: number; paketDurumAdi: string; musteriAd: string | null; musteriTel: string | null; musteriAdres: string | null;
  not: string | null; toplam: number; kalemSayisi: number; hazirSayisi: number; hazirlananSayisi: number; dakika: number; odendi: boolean; garson: string | null;
}
export interface PaketListesi { aktif: PaketOzeti[]; biten: PaketOzeti[] }
/** Adisyon raporu / gün sonu (D10) */
export interface AdisyonRaporu {
  donem: { baslangic: string; bitis: string };
  ozet: { adisyon: number; fis: number; iptalAdisyon: number; ciro: number; urunSatis: number; servis: number; yuvarlama: number; iade?: number; iadeSayi?: number; netCiro?: number; ortalama: number; kisi: number; kisiBasi: number; ortalamaSure: number | null; ikramDegeri: number; iptalDegeri: number };
  turler: { tur: number; ad: string; adisyon: number; ciro: number }[];
  odemeler: { arac: number; ad: string; tutar: number }[];
  urunler: { stokKartId: number | null; ad: string; birim: string; miktar: number; tutar: number; ikramMiktar: number; ikramDeger: number }[];
  garsonlar: { garsonId: number | null; ad: string; adisyon: number; ciro: number; servis: number; ikram: number; iptal: number }[];
  ikramIptal: { satirlar: { tur: "ikram" | "iptal"; ad: string; miktar: number; birim: string; deger: number; neden: string; yapan: string | null; ekleyen: string | null; adisyonNo: string; yer: string; zaman: string }[];
    nedenler: { tur: "ikram" | "iptal"; neden: string; adet: number; deger: number }[] };
  servisDagitimi: { toplam: number; etkinGarson: number; toplayan: { ad: string; toplanan: number }[] };
  acik: { sayi: number; tutar: number; liste: { adisyonId: number; adisyonNo: string; tur: number; yer: string; garson: string | null; hesapIstendi: boolean; dakika: number; tutar: number; kalem: number }[] };
}
/** Ödeme türü: 0 nakit, 1 cari (veresiye), 2 kart, 3 havale / EFT (banka hesabı) */
export interface OdemeGirdi { tutar: number; arac: number; posCihaziId?: number | null; cariKartId?: number | null; aciklama?: string | null; /** Ara ödemede cihazdan çekilen kartın POS işlemi (TA37) */ posIslemId?: number | null }
export interface MusteriGirdi { cariKartId?: number | null; vknTckn?: string | null; unvan?: string | null; adres?: string | null; il?: string | null; ilce?: string | null; vergiDairesi?: string | null; eposta?: string | null; telefon?: string | null; mukellef?: boolean | null }
export interface BekleyenOdeme { odemeId: number; tutar: number; arac: number; posCihaziId: number | null; cariKartId: number | null; posIslemId: number | null; aciklama: string | null; ekleyen: string | null }
/** Hesap: fişlenmemiş ara toplam + servis (+ e-Belge yuvarlaması) = ödenecek; bekleyen ara ödemeler; kalan; yazılmış fişler */
export interface HesapDurumu {
  ara: number; servis: number; servisKdv: number; toplam: number; yuvarlama: number; odemeler: BekleyenOdeme[]; odenen: number; kalan: number; kalemSayisi: number;
  /** İndirim (K1): brüt = indirimsiz fiş tutarı; indirimTuru 1 yüzde, 2 tutar; indirimDegeri yüzde ya da kalan indirim tutarı */
  brut?: number; indirim?: number; indirimTuru?: number; indirimDegeri?: number; indirimNeden?: string | null; indirimYapan?: string | null;
  fisler: { faturaId: number; faturaNo: string; ettn: string; toplam: number }[];
  /** Silinen ara ödemeler (iz, Y8) */
  silinenOdemeler?: { tutar: number; arac: number; ekleyen: string | null; silen: string | null; zaman: string }[];
}
export type TahsilatSonucu = AdisyonAyrinti & { hesap: HesapDurumu; kapandi?: boolean; faturaId?: number | null; faturaNo?: string | null };
export interface UrunTasimaSonucu { kaynak: AdisyonAyrinti; hedef: AdisyonAyrinti; kaynakKapandi: boolean }
export interface MutfakBekleyenFis { fisId: number; tur: number; deneme: number; hata: string | null; durdu: boolean; eskidi?: boolean; yer: string | null; masa: string | null; adisyonNo: string; kalem: number }
export interface MutfakKalemi { kalemId: number; ad: string; miktar: number; birim: string; porsiyon: string | null; secim: string; notu: string | null; durum: number; hazirDakika: number | null }
export interface MutfakGrubu { anahtar: string; adisyonId: number; adisyonNo: string; masa: string | null; bolge: string | null; musteri: string | null; adisyonTuru?: number; garson: string | null; yerId: number; yer: string; dakika: number; kalemler: MutfakKalemi[] }
export interface MutfakSiparisleri { bekleyen: MutfakGrubu[]; hazir: MutfakGrubu[] }

// ───────────── Masa / sipariş tipleri (D3) ─────────────
export interface MasaOzeti {
  masaId: number; bolgeId: number; ad: string; kisi: number | null;
  adisyon: { adisyonId: number; adisyonNo: string; durum: number; kisiSayisi: number | null; surum: number; toplam: number; kalemSayisi: number; hazirSayisi?: number; acikDakika: number; garson: string | null } | null;
}
/** Mutfak fişi kuyruğu özeti: durdu (10 denemede basılamadı), eskidi (30 dk'yı geçti, kendiliğinden basılmaz), sırada, fiş basan bilgisayar yok */
export interface MutfakFisDurumu { durdu: number; eskidi: number; sirada: number; istasyonYok: boolean }
export interface MasaDurumu { bolgeler: { bolgeId: number; ad: string; fiyatListesiId: number | null; masalar: MasaOzeti[] }[]; mutfakFis?: MutfakFisDurumu }
/** Uyarı metni (saf; kasa ve garson ekranı aynı metni gösterir); sorun yoksa null */
export function mutfakFisUyarisi(d: MutfakFisDurumu | undefined | null): string | null {
  if (!d) return null;
  const p: string[] = [];
  if (d.durdu > 0) p.push(`${d.durdu} mutfak fişi basılamadı`);
  if (d.eskidi > 0) p.push(`${d.eskidi} fiş 30 dakikayı geçtiği için basılmadı`);
  if (d.istasyonYok) p.push(`${d.sirada} fiş basılmayı bekliyor: fiş basan bilgisayar açık değil ya da yazdırma ajanı çalışmıyor`);
  return p.length ? `${p.join("; ")}. Mutfağa sözlü haber verin.` : null;
}
export interface MenuUrunu {
  stokKartId: number; kod: string; ad: string; stokGrupId: number | null; birim: string; tartili: boolean; fiyat: number | null; kdvOrani: number;
  barkodlar: string[]; receteli: boolean; porsiyonlar: { porsiyonId: number; ad: string; carpan: number; fiyat: number | null }[]; secenekGrupIdler: number[];
}
export interface AdisyonMenu { bolgeId: number | null; fiyatListesiId: number | null; gruplar: { stokGrupId: number | null; ad: string }[]; urunler: MenuUrunu[]; secenekGruplari: SecenekGrubu[] }
export interface AdisyonKalemi {
  kalemId: number; stokKartId: number | null; ad: string; miktar: number; birim: string; porsiyonAd: string | null; porsiyonCarpan: number; birimFiyat: number; kdvOrani: number;
  secimler: SecimSatiri[]; secimMetni: string; notu: string | null; yerId: number | null; yerAd: string | null; durum: number; ikram: boolean; iptal: boolean; neden: string | null;
  islemYapan: string | null; ekleyen: string | null; ekleyenGarsonId: number | null; dakika: number; tutar: number;
  /** Ödendiyse (satış fişine yazıldıysa) fiş kimliği (D7) */
  faturaId: number | null;
  /** Fiyatı değiştirildiyse ilk fiyat, neden, değiştiren (K1) */
  ilkFiyat?: number | null; fiyatNeden?: string | null; fiyatDegistiren?: string | null;
}
export interface AdisyonAyrinti {
  adisyonId: number; adisyonNo: string; ettn: string; tur: number; masaId: number | null; masaAd: string | null; bolgeId: number | null; bolgeAd: string | null; durum: number;
  kisiSayisi: number | null; acikDakika: number; garsonId: number | null; garson: string | null; aciklama: string | null; servisOrani: number | null; surum: number;
  kalemler: AdisyonKalemi[]; toplam: { ara: number; servis: number; toplam: number; ikram: number };
  /** Paket / gel-al (D8) */
  musteriAd?: string | null; musteriTel?: string | null; musteriAdres?: string | null; paketDurum?: number | null;
  /** İndirim / yeniden açma (K1) */
  indirimTuru?: number; indirimDegeri?: number; indirimNeden?: string | null; indirimYapan?: string | null;
  yenidenAcildi?: number; yenidenAcan?: string | null; yenidenNeden?: string | null;
}
export interface KapananAdisyon { adisyonId: number; adisyonNo: string; tur: number; masa: string | null; musteri: string | null; kapanis: string; garson: string | null; toplam: number; yenidenAcildi: number; acilabilir: boolean }
export interface SiparisKalemi { stokKartId: number; miktar: number; porsiyonId?: number | null; secenekIdler?: number[]; notu?: string | null }
export interface SiparisGirdi { istekId: string; masaId?: number | null; adisyonId?: number | null; kisi?: number | null; kalemler: SiparisKalemi[]; paket?: PaketBilgisi | null }
export interface AdisyonOlayi { olayId: number; tur: string; adisyonId: number | null; masaId: number | null; yerId: number | null; veri: unknown }
export type OlayBaglantisi = "baglaniyor" | "canli" | "yoklama" | "kopuk";

/** Yeniden bağlanma beklemesi (ms): 3 sn'den başlayıp ikiye katlanır, en çok 60 sn; ±%20 rastgele pay (saf; test edilir) */
export function olayBeklemesi(hataSayisi: number, yetkisiz = false, rastgele: () => number = Math.random): number {
  const taban = yetkisiz ? 60_000 : Math.min(60_000, 3000 * 2 ** Math.max(0, Math.min(hataSayisi, 6) - 1));
  return Math.round(taban * (0.8 + rastgele() * 0.4));
}

/**
 * Canlı olay akışı (TA22). EventSource başlık gönderemediği için fetch akışıyla okunur (jeton Authorization başlığında, adres
 * satırında değil). "hazir" 5 sn içinde gelmezse (aracı sunucu tamponluyor) durum "yoklama" olur: ekran kendisi yoklar.
 * Kopunca 3 sn sonra yeniden bağlanır; her bağlanışta `olay([])` çağrılır (ekran kaçırdıklarını tam yenilemeyle alır).
 */
export function adisyonOlaylarinaBaglan(cb: { olay: (l: AdisyonOlayi[]) => void; durum: (d: OlayBaglantisi) => void }, yol = "/adisyon/olaylar", basliklar?: () => Record<string, string>): () => void {
  let dur = false;
  let ctrl: AbortController | null = null;
  const varsayilanBasliklar = (): Record<string, string> => {
    const h: Record<string, string> = { Accept: "text/event-stream" };
    const token = localStorage.getItem("kuyumcu_erp_access_token");
    const dbServer = localStorage.getItem("kuyumcu_erp_last_server") || localStorage.getItem("kuyumcu_erp_active_server");
    const dbName = localStorage.getItem("kuyumcu_erp_last_db") || localStorage.getItem("kuyumcu_erp_active_db");
    if (token) h.Authorization = `Bearer ${token}`;
    if (dbServer) h["x-db-server"] = dbServer;
    if (dbName) h["x-db-name"] = dbName;
    return h;
  };
  // Durum yalnız değişince bildirilir: art arda başarısız denemelerde "bağlanıyor ↔ kopuk" gidip gelmez (ekranların yoklama
  // zamanlayıcısı duruma bağlıdır; her değişimde sıfırlanırsa yedek yoklama hiç çalışmaz — 26.11.2026 denetimi)
  let sonDurum: OlayBaglantisi | null = null;
  const durum = (d: OlayBaglantisi) => { if (d !== sonDurum) { sonDurum = d; cb.durum(d); } };
  let hataSayisi = 0;
  const dongu = async () => {
    while (!dur) {
      if (sonDurum !== "kopuk" && sonDurum !== "yoklama") durum("baglaniyor");
      ctrl = new AbortController();
      const buCtrl = ctrl;
      let hazir = false;
      let yetkisiz = false;
      const bekleme = setTimeout(() => { if (!hazir && !dur) durum("yoklama"); }, 5000);
      // Canlılık: sunucu 15 sn'de bir ping yollar. 40 sn hiç veri gelmezse bağlantı sessizce ölmüştür (Wi-Fi koptu, aracı sunucu
      // yarı açık bıraktı): kesilir ve yeniden bağlanılır — ekran "Canlı" yazarken donmaz.
      let sonVeri = Date.now();
      const nabiz = setInterval(() => { if (Date.now() - sonVeri > 40_000) buCtrl.abort(); }, 5000);
      try {
        const r = await fetch(`${getEffectiveApiUrl()}${yol}`, { headers: (basliklar || varsayilanBasliklar)(), signal: buCtrl.signal, cache: "no-store" });
        if (r.status === 401 || r.status === 403) yetkisiz = true;
        if (!r.ok || !r.body) throw new Error(`HTTP ${r.status}`);
        const okuyucu = r.body.getReader();
        const coz = new TextDecoder();
        let tampon = "";
        while (!dur) {
          const { value, done } = await okuyucu.read();
          if (done) break;
          sonVeri = Date.now();
          tampon += coz.decode(value, { stream: true }).replace(/\r\n/g, "\n");
          let i: number;
          while ((i = tampon.indexOf("\n\n")) >= 0) {
            const parca = tampon.slice(0, i);
            tampon = tampon.slice(i + 2);
            let olay = "message";
            const veri: string[] = [];
            for (const satir of parca.split("\n")) {
              if (satir.startsWith("event:")) olay = satir.slice(6).trim();
              else if (satir.startsWith("data:")) veri.push(satir.slice(5).trimStart());
            }
            if (olay === "hazir") { hazir = true; hataSayisi = 0; clearTimeout(bekleme); durum("canli"); cb.olay([]); }
            // Y10: sunucu oturumu kapattı (çıkış / PIN değişti): yeniden bağlanmada uzun bekleme; ekranın kendi isteği 401 alıp girişe döner
            else if (olay === "oturum") yetkisiz = true;
            else if (olay === "message" && veri.length) { try { const l = JSON.parse(veri.join("\n")); if (Array.isArray(l)) cb.olay(l); } catch { /* bozuk parça */ } }
          }
        }
      } catch {
        /* kopma: aşağıda yeniden bağlanılır */
      }
      clearTimeout(bekleme);
      clearInterval(nabiz);
      if (dur) return;
      durum("kopuk");
      // Artan bekleme + rastgele pay: sunucu / akış ucu hata verirken her ekran 3 sn'de bir yüklenmez (3 → 6 → 12 … en çok 60 sn;
      // oturum düşmüşse doğrudan 60 sn: ekranın kendi yoklaması girişe yönlendirir)
      hataSayisi++;
      await new Promise((r) => setTimeout(r, olayBeklemesi(hataSayisi, yetkisiz)));
    }
  };
  void dongu();
  return () => { dur = true; ctrl?.abort(); };
}
