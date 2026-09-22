import { apiClient, getEffectiveApiUrl } from "./apiClient";

// F- e-Banka (Vomsis) — docs/EBANKA_VOMSIS_YOL_HARITASI.md

export type EBankaMod = "sahte" | "canli";

/** API şifresi sunucudan hiçbir zaman geri dönmez; yalnızca tanımlı olup olmadığı bilinir. */
export interface EBankaAyar {
  mod: EBankaMod;
  appKey: string;
  appSecretTanimli: boolean;
  vposAppKey: string;
  vposAppSecretTanimli: boolean;
  aktarimBaslangic: string | null;
  vposBankaId: number | null;
  sonEsitleme: string | null;
  guncellemeZamani: string | null;
}

export interface EBankaAyarKaydet {
  mod: EBankaMod;
  appKey: string;
  /** Boş → kayıtlı şifre korunur */
  appSecret?: string;
  vposAppKey: string;
  vposAppSecret?: string;
  aktarimBaslangic: string | null;
  vposBankaId: number | null;
}

export interface EBankaLog {
  logId: number;
  zaman: string;
  islem: string;
  mod: EBankaMod;
  basarili: boolean;
  adet: number | null;
  mesaj: string | null;
  kullaniciId: number | null;
}

// ─── Tahsilat / ödeme mutabakatı ─────────────────────────────────────────────
export type MutabakatFisTuru = "doviz" | "sarraf" | "perakende";
export type MutabakatDurumu = "faturalandi" | "faturasiz" | "fissiz" | "oneri" | "gerekmez" | "virman";

export interface MutabakatFisi {
  fisTuru: MutabakatFisTuru;
  fisId: number;
  fisNo: string | null;
  tarih: string | null;
  cariKartId: number | null;
  cariAdi: string | null;
  yon: "gelen" | "giden";
  tutar: number;
  fisToplami: number;
  faturali: boolean;
  faturaBilgisi: string | null;
  otomatik?: boolean;
  fark?: number;
  baskaHarekette?: boolean;
}

export interface MutabakatSatiri {
  vomsisId: number;
  tarih: string | null;
  bankaAdi: string;
  hesapNo: string | null;
  doviz: string | null;
  yon: "gelen" | "giden";
  tutar: number;
  tipAdi: string | null;
  karsiTaraf: string | null;
  aciklama: string | null;
  cari: { cariKartId: number; ad: string } | null;
  cariNedeni: string | null;
  durum: MutabakatDurumu;
  fark: number | null;
  faturaGerekmez: boolean;
  not: string | null;
  fisler: MutabakatFisi[];
  adaylar: MutabakatFisi[];
}

export interface MutabakatListesi {
  satirlar: MutabakatSatiri[];
  ozet: { toplam: number; faturalandi: number; faturasiz: number; fissiz: number; oneri: number; gerekmez: number; virman: number; farkli: number };
}

export interface EBankaDenetimSonucu {
  grup: string;
  ad: string;
  durum: "tamam" | "uyari" | "hata" | "bilgi";
  ayrinti: string;
}

export interface EBankaHesap {
  vomsisHesapId: number;
  bankaAdi: string;
  bankaKodu: string;
  subeAdi: string | null;
  subeKodu: string | null;
  doviz: string;
  hesapNo: string | null;
  iban: string | null;
  bakiye: number;
  blokeBakiye: number | null;
  kullanilabilirBakiye: number | null;
  bakiyeyeDahil: boolean;
  aktif: boolean;
  urunKodu: string | null;
  bankaId: number | null;
  bankaHesapNo: string | null;
  bankaHesapAdi: string | null;
  eslemeElle: boolean;
  guncellemeZamani: string | null;
}

export interface EBankaOzet {
  mod: EBankaMod;
  sonEsitleme: string | null;
  toplamlar: { doviz: string; bakiye: number; hesapAdedi: number }[];
  hesaplar: EBankaHesap[];
  eslesmeyenHesapAdedi: number;
  hareketAdedi: number;
  bekleyen: number;
  ilkHareket: string | null;
  sonHareket: string | null;
}

/** 0 bekliyor · 1 aktarıldı · 2 aktarılmayacak */
export type AktarimDurumu = 0 | 1 | 2;

export interface EBankaHareket {
  vomsisId: number;
  vomsisHesapId: number;
  bankaAdi: string;
  hesapNo: string | null;
  hesapIban: string | null;
  tipKodu: string | null;
  tipAdi: string | null;
  bankaTipi: string | null;
  mt940Tipi: string | null;
  sistemTarihi: string | null;
  muhasebeTarihi: string | null;
  gonderenTckn: string | null;
  gonderenAd: string | null;
  gonderenSube: string | null;
  gonderenUnvan: string | null;
  gonderenIban: string | null;
  gonderenVkn: string | null;
  aliciIban: string | null;
  karsiUnvan: string | null;
  karsiIban: string | null;
  karsiVkn: string | null;
  fisNo: string | null;
  odeyenVkn: string | null;
  aciklama: string | null;
  doviz: string | null;
  tutar: number;
  bakiye: number | null;
  evrakNo: string | null;
  tur: string | null;
  notu: string | null;
  etiketler: string | null;
  aktarimDurumu: AktarimDurumu;
  bankaHareketId: number | null;
  cariKartId: number | null;
}

export interface EBankaHareketFiltre {
  baslangic?: string;
  bitis?: string;
  vomsisHesapId?: number;
  tipKodu?: string;
  tur?: string;
  aktarimDurumu?: number;
  arama?: string;
  sayfa?: number;
  sayfaBoyutu?: number;
}

export interface EBankaHareketListesi {
  satirlar: EBankaHareket[];
  toplam: number;
  toplamlar: { doviz: string; giris: number; cikis: number; adet: number }[];
}

export interface EBankaEsitlemeSonucu {
  mod: EBankaMod;
  baslangic: string;
  bitis: string;
  bankaAdedi: number;
  hesapAdedi: number;
  yeniEslesenHesap: number;
  yeniHareket: number;
  guncellenenHareket: number;
  /** Otomatik aktarım çalışmadıysa (test modu / başlangıç tarihi yok) null */
  aktarim: EBankaAktarimSonucu | null;
}

export interface EBankaAktarimSonucu {
  aktarilan: number;
  aktarilmayacak: number;
  bekleyen: number;
  hatali: number;
}

export interface EBankaCari {
  cariKartId: number;
  kod: string;
  ad: string;
  vergiNo?: string | null;
}

/** 0 otomatik aktar · 1 Bekleyenler'de kalsın (elle) · 2 aktarma */
export type EBankaTipKurali = 0 | 1 | 2;

export interface EBankaTipKuraliSatiri {
  tipKodu: string;
  tipAdi: string;
  kural: EBankaTipKurali;
  cariKartId: number | null;
  cariKod: string | null;
  cariAdi: string | null;
}

export interface EBankaBekleyen {
  vomsisId: number;
  bankaId: number | null;
  bankaAdi: string;
  hesapNo: string | null;
  tipKodu: string | null;
  tipAdi: string | null;
  sistemTarihi: string | null;
  doviz: string | null;
  tutar: number;
  aciklama: string | null;
  karsiUnvan: string | null;
  karsiIban: string | null;
  karsiVkn: string | null;
  gonderenAd: string | null;
  gonderenUnvan: string | null;
  gonderenTckn: string | null;
  gonderenVkn: string | null;
  /** Otomatik aktarımda bu harekete ne olacağı */
  plan: {
    karar: "aktar" | "bekle" | "aktarma";
    neden: string;
    /** 0 Havale Alma · 1 Havale/EFT Gönderme */
    islemTipi: 0 | 1;
    virman: boolean;
    tlMi: boolean;
    cari: EBankaCari | null;
  };
}

export interface EBankaBekleyenler {
  mod: EBankaMod;
  aktarimBaslangic: string | null;
  satirlar: EBankaBekleyen[];
}

// ─── Fiziksel POS ────────────────────────────────────────────────────────────
export interface EBankaPosTerminal {
  vomsisTerminalId: number;
  bankaAdi: string;
  isyeriNo: string | null;
  terminalNo: string | null;
  isyeriAdi: string | null;
  ozelAd: string | null;
  doviz: string | null;
  komisyonOrani: number | null;
  aktif: boolean;
  guncellemeZamani: string | null;
}

export interface EBankaPosOzet {
  mod: EBankaMod;
  sonEsitleme: string | null;
  terminaller: EBankaPosTerminal[];
}

export interface EBankaPosHareket {
  vomsisId: number;
  vomsisTerminalId: number;
  terminalAdi: string;
  bankaAdi: string;
  islemTarihi: string | null;
  saat: string | null;
  valor: string | null;
  gunSonu: string | null;
  kartNo: string | null;
  kartTipi: string | null;
  islemTipi: string | null;
  aciklama: string | null;
  doviz: string | null;
  brut: number;
  komisyon: number;
  komisyonOrani: number | null;
  net: number;
  taksitSayisi: number | null;
  provizyonNo: string | null;
  batch: string | null;
  /** null fiş yok · -1 fiş kesiliyor · >0 banka fişi no */
  bankaHareketId: number | null;
}

export interface EBankaPosFiltre {
  baslangic?: string;
  bitis?: string;
  vomsisTerminalId?: number;
  fisDurumu?: string;
  arama?: string;
  sayfa?: number;
  sayfaBoyutu?: number;
}

export interface EBankaPosListesi {
  satirlar: EBankaPosHareket[];
  toplam: number;
  toplamlar: { doviz: string; adet: number; brut: number; komisyon: number; net: number }[];
  gunluk: { islemTarihi: string | null; vomsisTerminalId: number; terminalAdi: string; bankaAdi: string; doviz: string; adet: number; brut: number; komisyon: number; net: number; valor: string | null }[];
}

export interface EBankaPosEsitlemeSonucu {
  mod: EBankaMod;
  terminalAdedi: number;
  yeniHareket: number;
  guncellenenHareket: number;
}

// ─── Sanal POS ───────────────────────────────────────────────────────────────
export interface EBankaVposLink {
  uid: string;
  cariKartId: number | null;
  cariKod: string | null;
  cariAdi: string | null;
  baslik: string | null;
  tutar: number;
  paraBirimi: string;
  sonGecerlilik: string | null;
  eposta: string | null;
  telefon: string | null;
  sms: boolean;
  mail: boolean;
  maxTaksit: number;
  aciklama: string | null;
  link: string | null;
  durum: string | null;
  odendi: boolean;
  silindi: boolean;
  /** null fiş yok · -1 kesiliyor · >0 tahsilat fişi no */
  bankaHareketId: number | null;
  olusturmaZamani: string | null;
  guncellemeZamani: string | null;
}

export interface EBankaVposLinkler {
  mod: EBankaMod;
  vposBankaTanimli: boolean;
  linkler: EBankaVposLink[];
}

export interface EBankaVposLinkOlustur {
  cariKartId: number;
  baslik: string;
  tutar: string;
  paraBirimi: string;
  sonGecerlilik: string;
  eposta: string;
  telefon: string;
  sms: boolean;
  mail: boolean;
  maxTaksit: number;
  aciklama: string;
}

export interface EBankaVposLinkGuncelleme extends Omit<EBankaVposLinkler, "vposBankaTanimli"> {
  sorulan: number;
  yeniOdenen: number;
  kesilenFis: number;
  uyarilar: string[];
}

export interface EBankaCariIletisim extends EBankaCari {
  telefon: string | null;
  eposta: string | null;
  adres: string | null;
}

export interface EBankaVposIslem {
  referansNo: string;
  linkUid: string | null;
  cariKartId: number | null;
  cariKod: string | null;
  cariAdi: string | null;
  aciklama: string | null;
  islemTarihi: string | null;
  tutar: number;
  paraBirimi: string | null;
  taksit: number | null;
  kartNo: string | null;
  kartBanka: string | null;
  kartAilesi: string | null;
  posAdi: string | null;
  durumKodu: number | null;
  /** islem / iade / iptal */
  tur: string | null;
  hataKodu: string | null;
  hataMesaji: string | null;
  iadeTutar: number | null;
  musteri: string | null;
  bankaHareketId: number | null;
  iadeBankaHareketId: number | null;
}

export interface EBankaBinSonucu {
  kart: { bank_name?: string; card_type?: string; card_association?: string; card_family_name?: string } | null;
  taksitler: { installment: number; title?: string; ratio?: string | number; currency?: string }[];
}

export interface EBankaOdemeBaslat {
  cariKartId: number;
  tutar: string;
  paraBirimi: string;
  taksit: number;
  taksitOrani: number;
  aciklama: string;
  kart: { adSoyad: string; no: string; ay: string; yil: string; cvc: string };
}

/** Bankanın 3D ekranı: hazır HTML ya da gateway adresine POST edilecek alanlar */
export interface EBankaOdemeYonlendirme {
  referansNo: string;
  htmlContent: string | null;
  gateway: string | null;
  alanlar: { ad: string; deger: string }[];
}

export interface EBankaOdemeSonucu {
  durum: "bekliyor" | "basarili" | "basarisiz";
  mesaj: string;
  islem: EBankaVposIslem | null;
}

export interface EBankaVposIslemDetayi {
  yerel: EBankaVposIslem | null;
  vomsis: Record<string, any> | null;
  vomsisHatasi: string | null;
}

const veri = <T>(res: any): T => (res.data as any)?.data ?? res.data;

/** Dosya yanıtı (xlsx) için apiClient kullanılamaz (JSON bekler); oturum başlıkları raporService.dosyaGetir ile aynıdır. */
async function dosyaIndir(yol: string, dosyaAdi: string): Promise<void> {
  const ls = (k: string) => localStorage.getItem(k);
  const basliklar: Record<string, string> = {};
  const ekle = (ad: string, deger: string | null) => {
    if (deger !== null && deger !== undefined && (deger !== "" || ad === "x-db-password")) basliklar[ad] = deger;
  };
  const token = ls("kuyumcu_erp_access_token");
  if (token) basliklar.Authorization = `Bearer ${token}`;
  ekle("x-db-server", ls("kuyumcu_erp_last_server") || ls("kuyumcu_erp_active_server"));
  ekle("x-db-name", ls("kuyumcu_erp_last_db") || ls("kuyumcu_erp_active_db"));
  ekle("x-db-user", ls("kuyumcu_erp_db_user"));
  ekle("x-db-password", ls("kuyumcu_erp_db_password"));

  const res = await fetch(`${getEffectiveApiUrl()}${yol}`, { headers: basliklar });
  if (!res.ok) {
    let mesaj = `Dosya alınamadı (HTTP ${res.status}).`;
    try {
      const g = await res.json();
      if (g?.message) mesaj = g.message;
    } catch {
      /* JSON değil */
    }
    throw new Error(mesaj);
  }
  const url = URL.createObjectURL(await res.blob());
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = dosyaAdi;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }
}

const bosOlmayanlar = (o: Record<string, any>): Record<string, any> =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== ""));

export const EBankaService = {
  async getAyar(): Promise<EBankaAyar> {
    return veri<EBankaAyar>(await apiClient.get("/ebanka/ayar"));
  },

  async saveAyar(payload: EBankaAyarKaydet): Promise<EBankaAyar> {
    return veri<EBankaAyar>(await apiClient.put("/ebanka/ayar", payload));
  },

  async baglantiTesti(servis: "banka" | "vpos"): Promise<{ mod: EBankaMod; ayrinti: string }> {
    return veri(await apiClient.post("/ebanka/baglanti-testi", { servis }));
  },

  async getLog(limit = 50): Promise<EBankaLog[]> {
    const data = veri<EBankaLog[]>(await apiClient.get("/ebanka/log", { limit }));
    return Array.isArray(data) ? data : [];
  },

  // ─── Tahsilat / ödeme mutabakatı ───────────────────────────────────────────
  /** Listeler; tutarı tam tutan tek fiş olan hareketleri sunucu kendiliğinden eşler. */
  async getMutabakat(filtre: { baslangic: string; bitis: string; yon?: string }): Promise<MutabakatListesi> {
    return veri<MutabakatListesi>(await apiClient.get("/ebanka/mutabakat", bosOlmayanlar(filtre), { timeoutMs: 120000 }));
  },

  async mutabakatEsle(vomsisId: number, fisTuru: MutabakatFisTuru, fisId: number): Promise<void> {
    await apiClient.post("/ebanka/mutabakat/esle", { vomsisId, fisTuru, fisId });
  },

  async mutabakatEslemeKaldir(vomsisId: number, fisTuru: MutabakatFisTuru, fisId: number): Promise<void> {
    await apiClient.post("/ebanka/mutabakat/esle-kaldir", { vomsisId, fisTuru, fisId });
  },

  async mutabakatFaturaGerekmez(vomsisId: number, deger: boolean, not?: string): Promise<void> {
    await apiClient.post("/ebanka/mutabakat/fatura-gerekmez", { vomsisId, deger, not });
  },

  // ─── Sistem denetimi ───────────────────────────────────────────────────────
  /** Sunucunun gerçek veritabanında ve ağında salt okunur denetimler. */
  async denetle(): Promise<{ zaman: string; sonuclar: EBankaDenetimSonucu[] }> {
    return veri(await apiClient.get("/ebanka/denetim", undefined, { timeoutMs: 60000 }));
  },

  /**
   * 3D Secure dönüş adresi tarayıcıdan denenir: bankanın müşteriyi yollayacağı yol budur (IIS → backend).
   * Oturum başlığı gönderilmez; uç oturumsuz çalışmalıdır.
   */
  async donusAdresiDenetle(): Promise<EBankaDenetimSonucu> {
    const adres = `${new URL(getEffectiveApiUrl(), window.location.origin).toString().replace(/\/+$/, "")}/ebanka-donus`;
    const taban = { grup: "Ağ", ad: "3D Secure dönüş adresi" };
    try {
      const y = await fetch(adres, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: "denetim=1" });
      const metin = await y.text();
      if (y.ok && metin.includes("Doğrulama tamamlandı")) {
        const https = adres.startsWith("https://");
        return { ...taban, durum: https ? "tamam" : "uyari", ayrinti: `${adres} oturumsuz POST'a yanıt veriyor${https ? "" : " — adres HTTPS değil; Canlı modda kartla ödeme reddedilir"}` };
      }
      return { ...taban, durum: "hata", ayrinti: `${adres} beklenen sayfayı döndürmedi (HTTP ${y.status}) — IIS bu yolu backend'e geçirmiyor olabilir` };
    } catch (err: any) {
      return { ...taban, durum: "hata", ayrinti: `${adres} adresine ulaşılamadı (${err?.message || err})` };
    }
  },

  /** Gerçek veritabanında 0,01 TL'lik bir banka fişi açar ve hemen siler. */
  async denemeFisi(bankaId: number): Promise<{ adimlar: EBankaDenetimSonucu[]; basarili: boolean }> {
    return veri(await apiClient.post("/ebanka/denetim/deneme-fisi", { bankaId }, { timeoutMs: 60000 }));
  },

  /** Vomsis'ten elle eşitleme. Çok hareketli aralıklar uzun sürebildiği için zaman aşımı geniş tutulur. */
  async esitle(baslangic: string, bitis: string): Promise<EBankaEsitlemeSonucu> {
    return veri(await apiClient.post("/ebanka/esitle", { baslangic, bitis }, { timeoutMs: 300000 }));
  },

  async getOzet(): Promise<EBankaOzet> {
    return veri<EBankaOzet>(await apiClient.get("/ebanka/ozet"));
  },

  async getHesaplar(): Promise<EBankaHesap[]> {
    const data = veri<EBankaHesap[]>(await apiClient.get("/ebanka/hesaplar"));
    return Array.isArray(data) ? data : [];
  },

  /** bankaId null → eşleme kaldırılır. Güncel hesap listesini döndürür. */
  async hesapEsle(vomsisHesapId: number, bankaId: number | null): Promise<EBankaHesap[]> {
    return veri<EBankaHesap[]>(await apiClient.put(`/ebanka/hesaplar/${vomsisHesapId}/esle`, { bankaId }));
  },

  async getHareketTipleri(): Promise<{ tipKodu: string; tipAdi: string }[]> {
    const data = veri<{ tipKodu: string; tipAdi: string }[]>(await apiClient.get("/ebanka/hareket-tipleri"));
    return Array.isArray(data) ? data : [];
  },

  async getHareketler(filtre: EBankaHareketFiltre): Promise<EBankaHareketListesi> {
    return veri<EBankaHareketListesi>(await apiClient.get("/ebanka/hareketler", bosOlmayanlar(filtre)));
  },

  // ─── Banka fişine aktarım ──────────────────────────────────────────────────
  async getBekleyenler(): Promise<EBankaBekleyenler> {
    return veri<EBankaBekleyenler>(await apiClient.get("/ebanka/bekleyenler"));
  },

  async aktarimCalistir(): Promise<EBankaAktarimSonucu> {
    return veri(await apiClient.post("/ebanka/aktarim/calistir", {}, { timeoutMs: 300000 }));
  },

  /** cariKartId null → carisiz fiş. kur yalnızca döviz hesaplarında; boşsa hareket günündeki sistem kuru kullanılır. */
  async elleAktar(vomsisId: number, cariKartId: number | null, kur?: number | null): Promise<{ bankaHareketId: number }> {
    return veri(await apiClient.post(`/ebanka/hareketler/${vomsisId}/aktar`, { cariKartId, kur: kur || null }));
  },

  async aktarimDurumu(vomsisIdler: number[], aktarilmayacak: boolean): Promise<{ degisen: number }> {
    return veri(await apiClient.post("/ebanka/aktarim/durum", { vomsisIdler, aktarilmayacak }));
  },

  async getTipKurallari(): Promise<EBankaTipKuraliSatiri[]> {
    const data = veri<EBankaTipKuraliSatiri[]>(await apiClient.get("/ebanka/tip-kurallari"));
    return Array.isArray(data) ? data : [];
  },

  async saveTipKurali(tipKodu: string, kural: EBankaTipKurali, cariKartId: number | null): Promise<EBankaTipKuraliSatiri[]> {
    return veri<EBankaTipKuraliSatiri[]>(await apiClient.put(`/ebanka/tip-kurallari/${encodeURIComponent(tipKodu)}`, { kural, cariKartId }));
  },

  async cariAra(arama: string): Promise<EBankaCari[]> {
    const data = veri<EBankaCari[]>(await apiClient.get("/ebanka/cari-ara", { arama }));
    return Array.isArray(data) ? data : [];
  },

  // ─── Fiziksel POS ──────────────────────────────────────────────────────────
  async getPosOzet(): Promise<EBankaPosOzet> {
    return veri<EBankaPosOzet>(await apiClient.get("/ebanka/pos"));
  },

  /** Vomsis POS sorgusu 14 günlük dilimlerle yapıldığı için uzun aralıklar uzun sürer. */
  async posEsitle(baslangic: string, bitis: string): Promise<EBankaPosEsitlemeSonucu> {
    return veri(await apiClient.post("/ebanka/pos/esitle", { baslangic, bitis }, { timeoutMs: 600000 }));
  },

  async getPosHareketleri(filtre: EBankaPosFiltre): Promise<EBankaPosListesi> {
    return veri<EBankaPosListesi>(await apiClient.get("/ebanka/pos/hareketler", bosOlmayanlar(filtre)));
  },

  /** Muhasebe fişi dökümü + hareket listesi (xlsx). Ekrandaki süzgecin tamamını kapsar, sayfalanmaz. */
  async posExcelIndir(filtre: EBankaPosFiltre): Promise<void> {
    const { sayfa: _s, sayfaBoyutu: _b, ...kalan } = filtre;
    const q = new URLSearchParams(bosOlmayanlar(kalan) as Record<string, string>).toString();
    await dosyaIndir(`/ebanka/pos/excel${q ? `?${q}` : ""}`, `pos-hareketleri-${filtre.baslangic || ""}-${filtre.bitis || ""}.xlsx`);
  },

  // ─── Sanal POS ─────────────────────────────────────────────────────────────
  async getVposLinkler(): Promise<EBankaVposLinkler> {
    return veri<EBankaVposLinkler>(await apiClient.get("/ebanka/vpos/linkler"));
  },

  async vposLinkOlustur(payload: EBankaVposLinkOlustur): Promise<EBankaVposLink> {
    return veri<EBankaVposLink>(await apiClient.post("/ebanka/vpos/linkler", payload));
  },

  /** Açık linklerin durumunu Vomsis'e sorar; yeni ödenenlere tahsilat fişi keser (yalnız Canlı modda). */
  async vposLinkleriGuncelle(): Promise<EBankaVposLinkGuncelleme> {
    return veri<EBankaVposLinkGuncelleme>(await apiClient.post("/ebanka/vpos/linkler/guncelle", {}, { timeoutMs: 300000 }));
  },

  async vposLinkSil(uid: string): Promise<void> {
    await apiClient.delete(`/ebanka/vpos/linkler/${encodeURIComponent(uid)}`);
  },

  async getCariIletisim(cariKartId: number): Promise<EBankaCariIletisim> {
    return veri<EBankaCariIletisim>(await apiClient.get(`/ebanka/vpos/cari/${cariKartId}`));
  },

  async getVposIslemler(filtre: { baslangic?: string; bitis?: string; arama?: string }): Promise<{ mod: EBankaMod; islemler: EBankaVposIslem[] }> {
    return veri(await apiClient.get("/ebanka/vpos/islemler", bosOlmayanlar(filtre)));
  },

  async vposIslemleriGuncelle(): Promise<{ mod: EBankaMod; adet: number }> {
    return veri(await apiClient.post("/ebanka/vpos/islemler/guncelle", {}, { timeoutMs: 300000 }));
  },

  async getVposIslemDetayi(referansNo: string): Promise<EBankaVposIslemDetayi> {
    return veri<EBankaVposIslemDetayi>(await apiClient.get(`/ebanka/vpos/islemler/${encodeURIComponent(referansNo)}`));
  },

  async vposIptalIade(referansNo: string, tur: "cancel" | "refund", tutar?: string): Promise<{ onaylandi: boolean; tutar: number; muhasebe: string; islem: EBankaVposIslem }> {
    return veri(await apiClient.post(`/ebanka/vpos/islemler/${encodeURIComponent(referansNo)}/iptal-iade`, { tur, tutar }));
  },

  async getVomsisMusterileri(): Promise<{ id: number | null; eposta: string | null; unvan: string | null; faturaAdedi: number }[]> {
    const data = veri<any[]>(await apiClient.get("/ebanka/vpos/musteriler"));
    return Array.isArray(data) ? data : [];
  },

  // ─── Sanal POS: kartla ödeme (3D Secure) ───────────────────────────────────
  async vposBinSorgula(bin: string): Promise<EBankaBinSonucu> {
    return veri<EBankaBinSonucu>(await apiClient.post("/ebanka/vpos/bin", { bin }));
  },

  /** Kart verisi yalnızca bu istekte taşınır; sunucu saklamaz. Yanıt, bankanın 3D ekranını açmak için gerekenleri içerir. */
  async vposOdemeBaslat(payload: EBankaOdemeBaslat): Promise<EBankaOdemeYonlendirme> {
    // Banka 3D sonrası müşteriyi API'nin herkese açık adresine yollar; göreli adres tam adrese çevrilir
    const apiAdresi = new URL(getEffectiveApiUrl(), window.location.origin).toString();
    return veri<EBankaOdemeYonlendirme>(await apiClient.post("/ebanka/vpos/odeme", { ...payload, apiAdresi }, { timeoutMs: 90000 }));
  },

  async vposOdemeSonucu(referansNo: string): Promise<EBankaOdemeSonucu> {
    return veri<EBankaOdemeSonucu>(await apiClient.post(`/ebanka/vpos/odeme/${encodeURIComponent(referansNo)}/sonuc`, {}));
  },

  async posFisKes(payload: { vomsisIdler: number[]; bankaId: number; cariKartId: number | null; tarih?: string; kur?: number | null }): Promise<{ bankaHareketId: number; net: number; adet: number }> {
    return veri(await apiClient.post("/ebanka/pos/fis", payload));
  },
};
