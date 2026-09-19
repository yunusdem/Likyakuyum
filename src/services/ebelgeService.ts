import { apiClient, getEffectiveApiUrl } from "./apiClient";

/**
 * e-Belge (ICE Teknoloji entegratör) servisleri
 * Backend: /api/v1/e-belge
 *
 * ICE ile SOAP konuşması YALNIZCA backend'de yapılır; entegratör kullanıcı adı/şifresi
 * hiçbir zaman tarayıcıya inmez (bkz. docs/ice-baglanti.md §4).
 */

export type EbelgeOrtam = "CANLI" | "TEST";

export interface EbelgeAyar {
  id: number;
  ortam: EbelgeOrtam;
  servisUrl: string;
  kullaniciAdi: string;
  /** Şifre asla dönmez — yalnızca tanımlı olup olmadığı bilinir */
  sifreTanimli: boolean;
  uygulamaAdi: string;
  uygulamaSurum: string;
  firmaVkn: string;
  firmaAlias: string;
  firmaIl: string;
  firmaIlce: string;
  aktif: boolean;
  guncelleyen: string | null;
  guncellemeTarihi: string | null;
  /** Sunucuda EBELGE_ENC_KEY tanımlı mı — değilse şifre kaydedilemez */
  sifrelemeHazir: boolean;
}

export interface EbelgeAyarKaydet {
  ortam: EbelgeOrtam;
  servisUrl: string;
  kullaniciAdi: string;
  /** Boş bırakılırsa mevcut şifre korunur */
  sifre?: string;
  uygulamaAdi: string;
  uygulamaSurum: string;
  firmaVkn: string;
  firmaAlias: string;
  firmaIl: string;
  firmaIlce: string;
  aktif: boolean;
}

export interface EbelgeKontorSatiri {
  [alan: string]: string | number | null;
}

export interface EbelgeBaglantiTestSonucu {
  servisAyakta: boolean;
  healthCevabi: string | null;
  girisBasarili: boolean;
  hataMesaji: string | null;
  hataliDenemeSayisi: number | null;
  kontor: EbelgeKontorSatiri[] | null;
  sureMs: number;
}

export interface EbelgeLogKaydi {
  id: number;
  tarih: string;
  metod: string;
  yon: string;
  basarili: boolean;
  faultKodu: string | null;
  hataMesaji: string | null;
  sureMs: number | null;
  kullanici: string | null;
  ilgiliUuid: string | null;
}

/* ==========================================================================
   Gelen kutusu (Faz 3)
   ========================================================================== */

export interface EbelgeGelenSatiri {
  uuid: string;
  belgeNo: string | null;
  belgeTuru: string;
  profil: string | null;
  sender: string | null;
  receiver: string | null;
  supplier: string | null;
  customer: string | null;
  duzenlemeTarihi: string | null;
  tutar: number | null;
  paraBirimi: string | null;
  faturaTipi: string | null;
  gibStatuKodu: number | null;
  gibStatuAciklama: string | null;
  statu: string | null;
  statuAciklama: string | null;
  okunduMu: boolean;
  islendiMi: boolean;
  redKabul: string | null;
  redKabulAciklama: string | null;
  redKabulTarihi: string | null;
  redKabulKullanici: string | null;
  zarfId: string | null;
  hash: string | null;
  cekilmeTarihi: string;
}

export interface EbelgeGelenListe {
  kayitlar: EbelgeGelenSatiri[];
  toplam: number;
}

export interface EbelgeGelenListeFiltre {
  sayfa?: number;
  boyut?: number;
  baslangicTarihi?: string;
  bitisTarihi?: string;
  arama?: string;
  redKabul?: "BEKLEYEN" | "Kabul" | "Red" | "TUMU";
}

/** ICE'nin kabul ettiği okuma/işlenme statüleri */
export type EbelgeStatu = "Okunmadı" | "Okundu" | "Islendi" | "Islenmedi";

export interface EbelgeSenkronizasyonSonucu {
  toplamIce: number;
  cekilen: number;
  yazilan: number;
  sureMs: number;
}

/* ==========================================================================
   Giden belge doğrulama (Faz 5)
   ========================================================================== */

export type EbelgeSenaryo =
  | "TEMELFATURA" | "TICARIFATURA" | "EARSIVFATURA"
  | "YATIRIMTESVIK" | "KAMU";
export type EbelgeFaturaTipi =
  | "SATIS"
  | "IADE"
  | "TEVKIFAT"
  | "ISTISNA"
  | "OZELMATRAH"
  | "IHRACKAYITLI"
  | "TEKNOLOJIDESTEK"
  | "TEVKIFATIADE";

/** Form modu: alıcı e-Fatura mükellefiyse EFATURA, değilse EARSIV. Senaryo listesi moda göre değişir. */
export type EbelgeFormModu = "EFATURA" | "EARSIV";
export const ebelgeFormModu = (s: EbelgeSenaryo): EbelgeFormModu => (s === "EARSIVFATURA" ? "EARSIV" : "EFATURA");

/** ICE portalindeki sıra ve adlarla. Yalnızca üretecin desteklediği senaryolar listelenir (docs/ebelge-revizyon.md K1). */
export const EBELGE_SENARYOLAR: Record<EbelgeFormModu, { kod: EbelgeSenaryo; ad: string }[]> = {
  EFATURA: [
    { kod: "TEMELFATURA", ad: "Temel Fatura" },
    { kod: "TICARIFATURA", ad: "Ticari Fatura" },
    { kod: "KAMU", ad: "Kamu Fatura" },
    { kod: "YATIRIMTESVIK", ad: "Yatırım Teşvik" },
  ],
  EARSIV: [{ kod: "EARSIVFATURA", ad: "E-Arşiv" }],
};

const TIP_ADLARI: Record<EbelgeFaturaTipi, string> = {
  SATIS: "Satış", IADE: "İade", TEVKIFAT: "Tevkifat", ISTISNA: "İstisna",
  OZELMATRAH: "Özel Matrah", IHRACKAYITLI: "İhraç Kayıtlı", TEKNOLOJIDESTEK: "Teknoloji Destek",
  TEVKIFATIADE: "Tevkifat İade",
};
const tipler = (...k: EbelgeFaturaTipi[]) => k.map((kod) => ({ kod, ad: TIP_ADLARI[kod] }));
/**
 * Senaryoya göre seçilebilir fatura tipleri (docs/ebelge-revizyon.md K2).
 * İade ve tevkifat iade TICARIFATURA profilinde kullanılamaz. İhraç kayıtlı, doğrulanmış örnek UBL gelene kadar listede yoktur.
 */
export const EBELGE_FATURA_TIPLERI: Record<EbelgeSenaryo, { kod: EbelgeFaturaTipi; ad: string }[]> = {
  TEMELFATURA: tipler("SATIS", "IADE", "TEVKIFAT", "ISTISNA", "OZELMATRAH", "TEVKIFATIADE"),
  TICARIFATURA: tipler("SATIS", "TEVKIFAT", "ISTISNA", "OZELMATRAH"),
  KAMU: tipler("SATIS", "IADE", "TEVKIFAT", "ISTISNA", "OZELMATRAH", "TEVKIFATIADE"),
  YATIRIMTESVIK: tipler("SATIS", "IADE", "ISTISNA"),
  EARSIVFATURA: tipler("SATIS", "IADE", "TEVKIFAT", "ISTISNA", "OZELMATRAH"),
};

/** KNSK (kamu nüfuzuna sahip kişi) — docs/ebelge-revizyon.md K9. Onay 1 yıl geçerlidir. */
export interface EbelgeKnskKaydi {
  vknTckn: string; ad: string | null; aciklama: string | null; kayitTarihi: string; sonOnayTarihi: string;
  bitisTarihi: string; /** Bitişe kalan gün; süresi dolmuşsa negatif */ kalanGun: number; onaylayan: string | null;
}

/** GİB kod listeleri — docs/ebelge-revizyon.md K8 */
export type EbelgeKodTuru = "ISTISNA" | "TEVKIFAT" | "OZELMATRAH" | "IHRACKAYITLI";
export interface EbelgeKod { tur: EbelgeKodTuru; kod: string; ad: string; oran: number | null; sistem: boolean }

/** Yerel taslak (ICE'de taslak metodu olmayan belge türleri) — docs/ebelge-revizyon.md K3 */
export type EbelgeYerelTaslakTuru = "EArsiv" | "EIrsaliye" | "EGiderPusulasi" | "EMustahsil";
export interface EbelgeYerelTaslak {
  id: number; belgeTuru: EbelgeYerelTaslakTuru; belgeNo: string | null; aliciVkn: string | null; aliciUnvan: string | null;
  tutar: number | null; paraBirimi: string | null; olusturan: string | null; olusturmaTarihi: string; guncellemeTarihi: string;
}
/** Yerel taslağın açılacağı form */
export const EBELGE_YEREL_TASLAK_FORMU: Record<EbelgeYerelTaslakTuru, { ad: string; yol: string }> = {
  EArsiv: { ad: "e-Arşiv", yol: "/e-belge/dogrula" },
  EIrsaliye: { ad: "e-İrsaliye", yol: "/e-belge/irsaliye" },
  EGiderPusulasi: { ad: "e-Gider", yol: "/e-belge/gider" },
  EMustahsil: { ad: "e-Müstahsil", yol: "/e-belge/mustahsil" },
};

export interface EbelgeTaraf {
  vknTckn: string;
  unvan?: string;
  ad?: string;
  soyad?: string;
  vergiDairesi?: string;
  adres?: string;
  ilce?: string;
  il?: string;
  telefon?: string;
  eposta?: string;
}

export interface EbelgeSatir {
  ad: string;
  aciklama?: string;
  miktar: number;
  birimKodu?: string;
  birimFiyat: number;
  iskontoOrani?: number;
  kdvOrani: number;
  /** KDV istisnası — kdvOrani 0 iken zorunlu (GİB istisna kodu) */
  istisnaKodu?: string;
  istisnaGerekcesi?: string;
  /** KDV tevkifatı — oran KDV tutarı üzerinden uygulanır */
  tevkifatKodu?: string;
  tevkifatOrani?: number;
  /** Özel matrah — yalnızca OZELMATRAH tipinde; KDV satır tutarı yerine bu tutar üzerinden hesaplanır */
  ozelMatrahKodu?: string;
  ozelMatrahGerekcesi?: string;
  ozelMatrahTutari?: number;
}

export interface EbelgeDogrulaIstegi {
  uuid?: string;
  saat?: string;
  belgeNo: string;
  tarih?: string;
  senaryo: EbelgeSenaryo;
  faturaTipi: EbelgeFaturaTipi;
  paraBirimi?: string;
  notlar?: string[];
  alici: EbelgeTaraf;
  satirlar: EbelgeSatir[];
  /** IADE tipinde zorunlu: iade edilen asıl faturalar */
  iadeFaturalar?: { belgeNo: string; tarih: string }[];
  /** TRY dışı belgelerde TL karşılığı kur */
  dovizKuru?: { kur: number; tarih?: string };
  onizleme?: boolean;
}

export interface EbelgeHesapOzeti {
  malHizmetToplam: number;
  iskontoToplam: number;
  kdvToplam: number;
  vergiHaricToplam: number;
  odenecekTutar: number;
  /** Toplam tevkifat — ödenecek tutardan düşülür */
  tevkifatToplam?: number;
  kdvGruplari: {
    oran: number;
    matrah: number;
    vergi: number;
    istisnaKodu?: string;
    istisnaGerekcesi?: string;
  }[];
  tevkifatGruplari?: { kod: string; oran: number; matrah: number; vergi: number }[];
}

export interface EbelgeKaynakKimlik { evrakTuru: number; belgeId: number; belgeTuru: number; belgeNo?: string }
/** Kaynak listesi iki görünümden gelir: fatura (evrakTuru 0) ve e-Döviz fişi (evrakTuru 99). */
export const EBELGE_DOVIZ_EVRAK_TURU = 99;
export interface EbelgeKaynakSatiri extends EbelgeKaynakKimlik {
  kaynak: "FATURA" | "DOVIZ";
  belgeNo: string; tarih: string; unvan: string; tutar: number; paraBirimi: string; durum: string; hata: string | null;
  eskiEttn: string | null; eskiDurum: number; uuid: string | null; secilebilir: boolean; engel: string | null;
}
export interface EbelgeKaynakDetay {
  belgeNo: string; tarih: string; unvan: string; tur: string; paraBirimi: string; tutar: number;
  ettn: string; durum: number; satirlar: { ad: string; miktar: number; kur?: number; tutar: number; kdv?: number }[];
}
export interface EbelgeKaynakHazir extends EbelgeKaynakKimlik {
  belgeNo: string; unvan: string; tutar: number; belgeTuruAdi: string; parmakizi: string; senaryo: string; durum: string; paraBirimi?: string;
}
export interface EbelgeMustahsilIstegi {
  belgeNo:string; tarih:string; saat?:string; paraBirimi:"TRY"; smsKodu:string; smsSaglayiciAdi:string; smsSaglayiciVkn:string;
  uretici:EbelgeTaraf; gonderici?:Partial<EbelgeTaraf>;
  satirlar:{ad:string;aciklama?:string;miktar:number;birimKodu?:string;birimFiyat:number;stopajOrani:number;stopajKodu:string;stopajAdi?:string}[];
}
export interface EbelgeGiderIstegi {
  belgeNo: string; tarih: string; belgeTipi: "SATIS" | "IADE"; paraBirimi: "TRY";
  alici: EbelgeTaraf;
  vergiTuruKodu: string;
  satirlar: { ad: string; miktar: number; birimKodu: string; birimFiyat: number; vergiOrani: number }[];
  iadeDayanak?: { belgeTipi: "EARSIV_FATURA" | "BELGESIZ" | "SATIS_FISI"; belgeNo?: string; belgeTarihi: string };
}

export interface EbelgeMukellefSonucu {
  mukellefMi: boolean;
  kullanicilar: { Identifier?: string; Alias?: string; Title?: string; Type?: string }[];
  mesaj: string;
}

/** Alıcının ICE portalında kayıtlı adresi */
export interface EbelgeAliciAdres {
  adresAdi: string;
  adres: string;
  il: string;
  ilce: string;
  ulke: string;
  postaKodu: string;
  eposta: string;
  telefon: string;
}

export interface EbelgeTaslakSonucu {
  uuid: string;
  belgeNo: string;
  ettn: string | null;
  durum: string;
  semaGecerli: boolean;
  schematronGecerli: boolean;
  mesaj: string;
  tutar: number;
}

export interface EbelgeGidenSatiri {
  uuid: string;
  belgeNo: string;
  belgeTuru: string;
  profil: string | null;
  faturaTipi: string | null;
  taslakMi: boolean;
  aliciVkn: string | null;
  aliciAlias: string | null;
  aliciUnvan: string | null;
  duzenlemeTarihi: string | null;
  tutar: number | null;
  paraBirimi: string | null;
  gonderimDurumu: string;
  semaGecerli: boolean | null;
  schematronGecerli: boolean | null;
  iceResponseMesaj: string | null;
  gibStatuKodu: number | null;
  gibStatuAciklama: string | null;
  olusturan: string | null;
  olusturmaTarihi: string;
  gonderen: string | null;
  gonderimTarihi: string | null;
  iptalTarihi: string | null;
  iptalEden: string | null;
}

export interface EbelgeDogrulamaSonucu {
  uuid: string;
  xml: string;
  ozet: EbelgeHesapOzeti;
  semaGecerli: boolean;
  schematronGecerli: boolean;
  mesaj: string;
  html: string | null;
}

export interface EbelgeArsivSatiri {
  uuid: string; belgeNo: string; aliciVkn: string | null; aliciUnvan: string | null;
  gondericiVkn: string | null; gondericiUnvan: string | null; tarih: string;
  tutar: number | null; paraBirimi: string | null; iceStatuKodu: string | null;
  iceStatuAciklama: string | null; isaret: string | null; cekilmeTarihi: string;
}

/** UN/ECE birim kodları — kuyumcu/döviz işinde sık kullanılanlar */
export const EBELGE_BIRIMLER: { kod: string; ad: string }[] = [
  { kod: "C62", ad: "Adet" },
  { kod: "GRM", ad: "Gram" },
  { kod: "KGM", ad: "Kilogram" },
  { kod: "MTR", ad: "Metre" },
  { kod: "SET", ad: "Set" },
  { kod: "PA", ad: "Paket" },
];

/* ==========================================================================
   e-İrsaliye (Faz 9)
   ========================================================================== */

export type EbelgeIrsaliyeTipi = "SEVK" | "MATBUDAN";
export type EbelgePlakaTuru =
  | "PLAKA" | "DORSE" | "DORSEPLAKA"
  | "YABANCIPLAKA" | "YABANCIDORSE" | "YABANCIDORSEPLAKA";

export interface EbelgeIrsaliyeSatiri {
  ad: string;
  aciklama?: string;
  miktar: number;
  birimKodu?: string;
  stokKodu?: string;
  marka?: string;
  not?: string;
}

export interface EbelgeSevkiyat {
  /** Fiili sevk tarihi — zorunlu */
  sevkTarihi: string;
  sevkSaati: string;
    plaka: string;
    plakaTuru: EbelgePlakaTuru;
  soforler?: { ad: string; soyad: string; tckn?: string }[];
  tasiyici?: { vknTckn: string; unvan: string };
  teslimatAdresi: { adres?: string; ilce?: string; il?: string; ulke?: string; postaKodu: string };
}

export interface EbelgeIrsaliyeIstegi {
  belgeNo: string;
  tarih?: string;
  irsaliyeTipi: EbelgeIrsaliyeTipi;
  notlar?: string[];
  alici: EbelgeTaraf;
  satirlar: EbelgeIrsaliyeSatiri[];
  sevkiyat: EbelgeSevkiyat;
  siparisNo?: string;
  siparisTarihi?: string;
  aliciAlias?: string;
  onizleme?: boolean;
}

export interface EbelgeIrsaliyeDogrulama {
  uuid: string;
  xml: string;
  satirSayisi: number;
  semaGecerli: boolean;
  schematronGecerli: boolean;
  mesaj: string;
  html: string | null;
}

export const ICE_CANLI_URL = "https://integration.iceteknoloji.com.tr/integration.asmx";
export const ICE_TEST_URL = "https://integrationtest.iceteknoloji.com.tr/integration.asmx";

/**
 * Korumalı bir PDF ucundan belgeyi indirip tarayıcı içi blob adresi üretir.
 *
 * Düz `window.open` işe yaramaz: API Bearer token istiyor, bağlantıda kimlik başlığı
 * gitmediği için 401 alınır. Bu yüzden PDF kimlik başlıklarıyla `fetch` edilir.
 * Dönen adres kullanıldıktan sonra `URL.revokeObjectURL` ile bırakılmalıdır.
 */
/** Belge görüntüsü: ICE bazı uçlarda PDF yerine HTML döndürür; çerçeve türe göre kurulur. */
export interface EbelgeGoruntu {
  /** PDF için blob adresi; HTML'de boş */
  url: string;
  /** HTML geldiyse metni — sandbox'lı iframe'e srcDoc olarak verilir */
  html: string | null;
}

const ebelgePdfBlobUrl = async (yol: string): Promise<string> => (await ebelgeGoruntuBlob(yol)).url;

const ebelgeGoruntuBlob = async (yol: string): Promise<EbelgeGoruntu> => {
  const token = localStorage.getItem("kuyumcu_erp_access_token");
  const dbServer =
    localStorage.getItem("kuyumcu_erp_last_server") || localStorage.getItem("kuyumcu_erp_active_server");
  const dbName =
    localStorage.getItem("kuyumcu_erp_last_db") || localStorage.getItem("kuyumcu_erp_active_db");
  const dbUser = localStorage.getItem("kuyumcu_erp_db_user");
  const dbPassword = localStorage.getItem("kuyumcu_erp_db_password");

  const res = await fetch(`${getEffectiveApiUrl()}${yol}`, {
    method: "GET",
    headers: {
      Accept: "application/pdf, text/html",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(dbServer ? { "x-db-server": dbServer } : {}),
      ...(dbName ? { "x-db-name": dbName } : {}),
      ...(dbUser ? { "x-db-user": dbUser } : {}),
      ...(dbPassword !== null && dbPassword !== undefined ? { "x-db-password": dbPassword } : {}),
    },
  });

  if (!res.ok) {
    let mesaj = `PDF alınamadı (HTTP ${res.status}).`;
    try {
      const govde = await res.json();
      if (govde?.message) mesaj = govde.message;
    } catch {
      // gövde JSON değilse varsayılan mesaj kalır
    }
    throw new Error(mesaj);
  }

  const blob = await res.blob();
  if (blob.type.includes("html")) return { url: "", html: await blob.text() };
  return { url: URL.createObjectURL(blob), html: null };
};

export const ebelgeService = {
  async kaynakListe(filtre: { arama?: string; durum?: string; belgeTuru?: number; kaynak?: "FATURA" | "IRSALIYE" | "GIDER" | "DOVIZ"; baslangicTarihi?: string; bitisTarihi?: string; sayfa: number }) {
    return (await apiClient.get<{ toplam: number; kayitlar: EbelgeKaynakSatiri[] }>("/e-belge/kaynak",filtre)).data;
  },
  async kaynakDetay(k: EbelgeKaynakKimlik) { return (await apiClient.post<EbelgeKaynakDetay>("/e-belge/kaynak/detay",k)).data; },
  async kaynakPdf(k: EbelgeKaynakKimlik) {
    return ebelgePdfBlobUrl(`/e-belge/kaynak/${k.evrakTuru}/${k.belgeId}/${k.belgeTuru}/pdf${k.belgeNo ? '?belgeNo=' + encodeURIComponent(k.belgeNo) : ''}`);
  },
  async kaynakHazirla(k: EbelgeKaynakKimlik) { return (await apiClient.post<EbelgeKaynakHazir>("/e-belge/kaynak/hazirla",k,{ timeoutMs: 180_000 })).data; },
  async kaynakGonder(k: EbelgeKaynakHazir) { return (await apiClient.post<{ durum: string; mesaj: string }>("/e-belge/kaynak/gonder",k,{ timeoutMs: 300_000 })).data; },
  async dovizDurum(uuid: string) { return (await apiClient.get<any>(`/e-belge/doviz/${encodeURIComponent(uuid)}/durum`)).data; },
  async getDovizPdfBlobUrl(uuid: string) { return ebelgePdfBlobUrl(`/e-belge/doviz/${encodeURIComponent(uuid)}/pdf`); },
  async dovizIptal(uuid: string, iptalTarihi?: string) { return (await apiClient.post<{ durum: string; mesaj: string }>(`/e-belge/doviz/${encodeURIComponent(uuid)}/iptal`,{ iptalTarihi })).data; },
  async mustahsilDogrula(g:EbelgeMustahsilIstegi){return (await apiClient.post<any>("/e-belge/mustahsil/dogrula",g,{timeoutMs:120_000})).data;},
  async mustahsilGonder(g:EbelgeMustahsilIstegi){return (await apiClient.post<any>("/e-belge/mustahsil/gonder",g,{timeoutMs:300_000})).data;},
  async mustahsilIptal(uuid:string,iptalTarihi?:string){return (await apiClient.post<any>(`/e-belge/mustahsil/${encodeURIComponent(uuid)}/iptal`,{iptalTarihi})).data;},
  async mustahsilGelen(params?:any){return (await apiClient.get<any[]>("/e-belge/mustahsil/gelen",{params})).data;},
  async mustahsilGelenStatu(uuid:string,statu:"Okunmadı"|"Okundu"|"Islendi"|"Islenmedi"){return (await apiClient.post<any>(`/e-belge/mustahsil/gelen/${encodeURIComponent(uuid)}/statu`,{statu})).data;},
  async giderOnizle(girdi: EbelgeGiderIstegi) {
    return (await apiClient.post<{ ozet: { malHizmetToplam: number; vergiToplam: number; odenecekTutar: number }; iceDogrulamasiYapildi: false }>("/e-belge/gider-pusulasi/onizle", girdi)).data;
  },
  async giderGonder(girdi: EbelgeGiderIstegi) {
    return (await apiClient.post<{ uuid: string; belgeNo: string; durum: string; mesaj: string }>("/e-belge/gider-pusulasi/gonder", girdi)).data;
  },
  async giderPdf(uuid: string) { return ebelgePdfBlobUrl(`/e-belge/gider-pusulasi/${encodeURIComponent(uuid)}/pdf`); },
  async listEarsivArsiv(sayfa = 1, arama = "") {
    const res = await apiClient.get<{ toplam: number; kayitlar: EbelgeArsivSatiri[] }>("/e-belge/earsiv/arsiv", { sayfa, arama });
    return res.data;
  },
  async senkronizeEarsivArsiv(baslangic: string, bitis: string) {
    const res = await apiClient.post<{ cekilen: number; yazilan: number; atlanan: number; siniraUlasildi: boolean; uyari: string | null }>(
      "/e-belge/earsiv/arsiv/senkronize", { baslangic, bitis, limit: 250 }, { timeoutMs: 180_000 });
    return res.data;
  },
  async earsivArsivIsaretle(uuid: string, statu: EbelgeStatu) {
    const res = await apiClient.post(`/e-belge/earsiv/arsiv/${encodeURIComponent(uuid)}/statu`, { statu });
    return res.data;
  },
  /** Bağlantı ayarlarını getirir (şifre maskeli) */
  async getAyar(): Promise<EbelgeAyar> {
    const res = await apiClient.get<EbelgeAyar>("/e-belge/ayar");
    return res.data;
  },

  /** Bağlantı ayarlarını kaydeder */
  async saveAyar(dto: EbelgeAyarKaydet): Promise<EbelgeAyar> {
    const res = await apiClient.put<EbelgeAyar>("/e-belge/ayar", dto);
    return res.data;
  },

  /** Health → Login → Get_Credit → Logout sırasıyla bağlantıyı sınar */
  async testBaglanti(): Promise<EbelgeBaglantiTestSonucu> {
    const res = await apiClient.post<EbelgeBaglantiTestSonucu>("/e-belge/ayar/test");
    return res.data;
  },

  /** Kalan kontör bilgisi */
  async getKontor(): Promise<EbelgeKontorSatiri[]> {
    const res = await apiClient.get<EbelgeKontorSatiri[]>("/e-belge/kontor");
    return res.data;
  },

  /** Son entegratör işlem kayıtları */
  async getLogs(limit = 50): Promise<EbelgeLogKaydi[]> {
    const res = await apiClient.get<EbelgeLogKaydi[]>("/e-belge/log", { limit });
    return res.data;
  },

  /* ---------- Gelen kutusu ---------- */

  /** ICE'den gelen belgeleri çekip yerel aynayı günceller */
  async senkronizeGelen(gunSayisi = 30, limit = 200): Promise<EbelgeSenkronizasyonSonucu> {
    const res = await apiClient.post<EbelgeSenkronizasyonSonucu>("/e-belge/gelen/senkronize", {
      gunSayisi,
      limit,
    });
    return res.data;
  },

  /** Yerel aynadan sayfalı gelen belge listesi */
  async listGelen(filtre: EbelgeGelenListeFiltre = {}): Promise<EbelgeGelenListe> {
    const res = await apiClient.get<EbelgeGelenListe>("/e-belge/gelen", filtre);
    return res.data;
  },

  /** Tek belge detayı; statuYenile ile ICE'den güncel GİB statüsü çekilir */
  async getGelenDetay(uuid: string, statuYenile = false): Promise<EbelgeGelenSatiri> {
    const res = await apiClient.get<EbelgeGelenSatiri>(`/e-belge/gelen/${encodeURIComponent(uuid)}`, {
      statuYenile: statuYenile ? "true" : undefined,
    });
    return res.data;
  },

  /**
   * Belgenin HTML çıktısı.
   * Dönen HTML'i ICE üretiyor — ASLA dangerouslySetInnerHTML ile basma,
   * sandbox'lı iframe'e srcdoc olarak ver (docs/ice-baglanti.md §11.1 S5).
   */
  async getGelenHtml(uuid: string): Promise<string> {
    const res = await apiClient.get<{ format: string; html: string }>(
      `/e-belge/gelen/${encodeURIComponent(uuid)}/goruntu`,
      { format: "html" }
    );
    return res.data.html;
  },

  /**
   * UBL-TR faturayı üretip ICE'ye **göndermeden** doğrulatır.
   * Belge oluşturmaz, mali sonuç doğurmaz.
   */
  async dogrulaGidenBelge(istek: EbelgeDogrulaIstegi): Promise<EbelgeDogrulamaSonucu> {
    const res = await apiClient.post<EbelgeDogrulamaSonucu>("/e-belge/giden/dogrula", istek);
    return res.data;
  },

  /** Alıcı e-Fatura mükellefi mi? Değilse e-Arşiv kesilmeli. */
  async mukellefSorgula(vkn: string): Promise<EbelgeMukellefSonucu> {
    const res = await apiClient.get<EbelgeMukellefSonucu>("/e-belge/mukellef", { vkn });
    return res.data;
  },

  async yerelTaslakListe(belgeTuru?: EbelgeYerelTaslakTuru): Promise<EbelgeYerelTaslak[]> {
    return (await apiClient.get<EbelgeYerelTaslak[]>("/e-belge/yerel-taslak", belgeTuru ? { belgeTuru } : undefined)).data;
  },
  async yerelTaslakGetir<T = Record<string, unknown>>(id: number): Promise<EbelgeYerelTaslak & { icerik: T }> {
    return (await apiClient.get<EbelgeYerelTaslak & { icerik: T }>(`/e-belge/yerel-taslak/${id}`)).data;
  },
  async yerelTaslakKaydet(t: { id?: number; belgeTuru: EbelgeYerelTaslakTuru; belgeNo?: string | null; aliciVkn?: string | null;
    aliciUnvan?: string | null; tutar?: number | null; paraBirimi?: string | null; icerik: Record<string, unknown> }): Promise<{ id: number }> {
    return (await apiClient.post<{ id: number }>("/e-belge/yerel-taslak", t)).data;
  },
  async yerelTaslakSil(id: number): Promise<void> { await apiClient.delete(`/e-belge/yerel-taslak/${id}`); },

  async knskListe(yalnizYaklasan = false): Promise<{ uyariGun: number; kayitlar: EbelgeKnskKaydi[] }> {
    return (await apiClient.get<{ uyariGun: number; kayitlar: EbelgeKnskKaydi[] }>("/e-belge/knsk", yalnizYaklasan ? { yaklasan: "1" } : undefined)).data;
  },
  async knskGetir(vkn: string): Promise<{ uyariGun: number; kayit: EbelgeKnskKaydi | null }> {
    return (await apiClient.post<{ uyariGun: number; kayit: EbelgeKnskKaydi | null }>("/e-belge/knsk/sorgula", { vkn })).data;
  },
  async knskOnayla(k: { vknTckn: string; ad?: string | null; aciklama?: string | null }): Promise<{ uyariGun: number; kayit: EbelgeKnskKaydi }> {
    return (await apiClient.post<{ uyariGun: number; kayit: EbelgeKnskKaydi }>("/e-belge/knsk", k)).data;
  },
  async knskKaldir(vkn: string): Promise<void> { await apiClient.post("/e-belge/knsk/kaldir", { vkn }); },

  async kodListe(tur?: EbelgeKodTuru): Promise<EbelgeKod[]> {
    return (await apiClient.get<EbelgeKod[]>("/e-belge/kodlar", tur ? { tur } : undefined)).data;
  },
  async kodEkle(k: { tur: EbelgeKodTuru; kod: string; ad: string; oran?: number | null }): Promise<EbelgeKod> {
    return (await apiClient.post<EbelgeKod>("/e-belge/kodlar", k)).data;
  },

  /** Alıcının ICE'de kayıtlı adresleri; kayıt yoksa boş liste döner. */
  async aliciAdresleri(vkn: string): Promise<EbelgeAliciAdres[]> {
    const res = await apiClient.get<{ adresler: EbelgeAliciAdres[] }>("/e-belge/alici-adres", { vkn });
    return res.data?.adresler || [];
  },

  /**
   * Belgeyi ICE'de TASLAK olarak oluşturur.
   * GİB'e GÖNDERMEZ — taslak iptal edilebilir.
   */
  async taslakGonder(
    istek: EbelgeDogrulaIstegi & { aliciAlias?: string }
  ): Promise<EbelgeTaslakSonucu> {
    const { onizleme, ...govde } = istek;
    const res = await apiClient.post<EbelgeTaslakSonucu>("/e-belge/giden/taslak", govde, { timeoutMs: 300_000 });
    return res.data;
  },

  /**
   * e-Arşiv faturası gönderir.
   * MALİ SONUÇ DOĞURUR — mükellef olmayan alıcıya kesilen gerçek faturadır.
   */
  async earsivGonder(istek: EbelgeDogrulaIstegi): Promise<EbelgeTaslakSonucu> {
    const { onizleme, ...govde } = istek;
    const res = await apiClient.post<EbelgeTaslakSonucu>("/e-belge/earsiv/gonder", {
      ...govde,
      senaryo: "EARSIVFATURA",
    }, { timeoutMs: 300_000 });
    return res.data;
  },

  /** e-Arsiv iptal bildirimi (belgeyi silmez, iptal edildigini raporlar) */
  async earsivIptal(uuid: string, iptalTarihi?: string) {
    const res = await apiClient.post<{ uuid: string; durum: string; mesaj: string }>(
      `/e-belge/earsiv/${encodeURIComponent(uuid)}/iptal`,
      { iptalTarihi }, { timeoutMs: 120_000 }
    );
    return res.data;
  },

  /** e-Arsiv raporlanma ve e-posta durumu */
  async earsivDurum(ettnler: string[]): Promise<{ rapor: any[]; mail: any[]; hatalar: string[] }> {
    const res = await apiClient.get<{ rapor: any[]; mail: any[]; hatalar: string[] }>("/e-belge/earsiv/durum", {
      ettn: ettnler.join(","),
    });
    return res.data;
  },

  /**
   * e-Faturayı **doğrudan GİB'e** gönderir.
   * ⚠️ GERİ ALINAMAZ — fatura numarası ve kontör kalıcı olarak yanar.
   */
  async faturaGonder(
    istek: EbelgeDogrulaIstegi & { aliciAlias?: string }
  ): Promise<EbelgeTaslakSonucu & { kontorKalan?: number | null; kontorUyari?: string | null }> {
    const { onizleme, ...govde } = istek;
    const res = await apiClient.post<any>("/e-belge/giden/gonder", govde);
    return res.data;
  },

  /**
   * Taslağı onaylayıp GİB'e gönderir (DraftApproval).
   * ⚠️ GERİ ALINAMAZ — taslak artık iptal edilemez.
   */
  async taslakOnayla(uuid: string) {
    const res = await apiClient.post<{ uuid: string; belgeNo: string; durum: string; mesaj: string }>(
      `/e-belge/giden/${encodeURIComponent(uuid)}/onayla`
    );
    return res.data;
  },

  /**
   * Belgeyi alıcıya e-posta ile gönderir.
   * ⚠️ Tekrar çağrılırsa alıcıya **yeniden mail gider** — ekran iki adımlı onay ister.
   */
  async belgeMailGonder(uuid: string, alicilar: { eposta: string; unvan?: string }[]) {
    const res = await apiClient.post<{
      uuid: string;
      gonderilen: number;
      basarisiz: number;
      sonuclar: { Title?: string; Email?: string; Result?: boolean | string; ResultMessage?: string }[];
    }>(`/e-belge/giden/${encodeURIComponent(uuid)}/mail`, { alicilar });
    return res.data;
  },

  /**
   * İrsaliyenin PDF'ini indirir ve tarayıcı içi blob adresi üretir.
   * Doğrudan bağlantı işe yaramaz — API Bearer token istiyor (bkz. getGelenPdfBlobUrl).
   */
  async getIrsaliyePdfBlobUrl(ettn: string): Promise<string> {
    return ebelgePdfBlobUrl(`/e-belge/irsaliye/${encodeURIComponent(ettn)}/pdf`);
  },

  /** Giden belgenin güncel GİB statüsü */
  async gidenStatu(uuid: string) {
    const res = await apiClient.get<{
      uuid: string;
      statu: string | null;
      aciklama: string | null;
      portalStatu: string | null;
    }>(`/e-belge/giden/${encodeURIComponent(uuid)}/statu`);
    return res.data;
  },

  /* ---------- e-İrsaliye ---------- */

  /** İrsaliyeyi göndermeden doğrular */
  async irsaliyeDogrula(istek: EbelgeIrsaliyeIstegi): Promise<EbelgeIrsaliyeDogrulama> {
    const res = await apiClient.post<EbelgeIrsaliyeDogrulama>("/e-belge/irsaliye/dogrula", istek);
    return res.data;
  },

  /** İrsaliyeyi GİB'e gönderir — GERİ ALINAMAZ */
  async irsaliyeGonder(istek: EbelgeIrsaliyeIstegi) {
    const { onizleme, ...govde } = istek;
    const res = await apiClient.post<{
      uuid: string;
      belgeNo: string;
      durum: string;
      mesaj: string;
      satirSayisi: number;
      kontorKalan: number | null;
      kontorUyari: string | null;
    }>("/e-belge/irsaliye/gonder", govde);
    return res.data;
  },

  /** Alıcının e-İrsaliye mükellefiyeti (e-Faturadan ayrıdır) */
  async irsaliyeMukellef(vkn: string): Promise<EbelgeMukellefSonucu> {
    const res = await apiClient.get<EbelgeMukellefSonucu>("/e-belge/irsaliye/mukellef", { vkn });
    return res.data;
  },

  /** Gelen/giden irsaliye listesi (doğrudan ICE'den) */
  async irsaliyeListe(yon: "IN" | "OUT" = "IN", gunSayisi = 30, limit = 100) {
    const res = await apiClient.get<{ kayitlar: any[]; limitDoldu: boolean }>("/e-belge/irsaliye", {
      yon,
      gunSayisi,
      limit,
    });
    return res.data;
  },

  /** İrsaliye GİB statüsü */
  async irsaliyeStatu(uuidler: string[], yon: "IN" | "OUT" = "OUT") {
    const res = await apiClient.get<any[]>("/e-belge/irsaliye/statu", {
      uuid: uuidler.join(","),
      yon,
    });
    return res.data;
  },

  /** Taslağı iptal eder (DraftCancel) */
  async taslakIptal(uuid: string): Promise<{ uuid: string; durum: string; mesaj: string }> {
    const res = await apiClient.post<{ uuid: string; durum: string; mesaj: string }>(
      `/e-belge/giden/${encodeURIComponent(uuid)}/iptal`
    );
    return res.data;
  },

  /** Giden belge listesi */
  async listGiden(filtre: { sayfa?: number; boyut?: number; arama?: string; durum?: string; belgeTuru?: string; baslangicTarihi?: string; bitisTarihi?: string } = {}) {
    const res = await apiClient.get<{ kayitlar: EbelgeGidenSatiri[]; toplam: number }>(
      "/e-belge/giden",
      filtre
    );
    return res.data;
  },

  /** ICE tarafındaki son belge numarası (numaratör çakışması kontrolü) */
  async getSonBelgeNo(seri: string, belgeTuru = "EFatura", yil?: number): Promise<any> {
    const res = await apiClient.get<any>("/e-belge/giden/son-belge-no", {
      seri,
      belgeTuru,
      yil: yil ?? new Date().getFullYear(),
    });
    return res.data;
  },

  /**
   * Gelen ticari faturaya kabul/red cevabı gönderir.
   * **GERİ ALINAMAZ** — ekran iki adımlı onay ister.
   */
  async cevapVer(
    uuid: string,
    redKabul: "Kabul" | "Red",
    aciklama: string
  ): Promise<EbelgeGelenSatiri> {
    const res = await apiClient.post<EbelgeGelenSatiri>(
      `/e-belge/gelen/${encodeURIComponent(uuid)}/cevap`,
      { redKabul, aciklama }
    );
    return res.data;
  },

  /** Belgenin okundu / işlendi statüsünü ICE tarafında işaretler */
  async statuIsle(uuid: string, statu: EbelgeStatu): Promise<EbelgeGelenSatiri> {
    const res = await apiClient.post<EbelgeGelenSatiri>(
      `/e-belge/gelen/${encodeURIComponent(uuid)}/statu`,
      { statu }
    );
    return res.data;
  },

  /**
   * Belgenin PDF'ini indirir ve tarayıcı içi blob adresi üretir.
   *
   * Doğrudan window.open ile açılamaz: API Bearer token ile korunuyor,
   * düz bağlantıda kimlik başlığı gitmez ve 401 alınır. Bu yüzden PDF
   * kimlik başlıklarıyla fetch edilip blob'a çevriliyor.
   * Dönen adres kullanıldıktan sonra URL.revokeObjectURL ile bırakılmalıdır.
   */
  async getEarsivPdfBlobUrl(uuid: string): Promise<string> {
    return this.getGelenPdfBlobUrl(uuid, true);
  },

  /** Kesilmiş e-Arşiv faturasının görüntüsü (PDF ya da HTML) */
  async getEarsivGoruntu(uuid: string): Promise<EbelgeGoruntu> {
    return ebelgeGoruntuBlob(`/e-belge/earsiv/${encodeURIComponent(uuid)}/pdf`);
  },

  /** e-Fatura (taslak dahil) görüntüsü — ICE'deki belgenin PDF'i */
  async getEfaturaGoruntu(uuid: string): Promise<EbelgeGoruntu> {
    return ebelgeGoruntuBlob(`/e-belge/gelen/${encodeURIComponent(uuid)}/goruntu?format=pdf`);
  },

  async getGelenPdfBlobUrl(uuid: string, earsiv = false): Promise<string> {
    return ebelgePdfBlobUrl(
      earsiv
        ? `/e-belge/earsiv/${encodeURIComponent(uuid)}/pdf`
        : `/e-belge/gelen/${encodeURIComponent(uuid)}/goruntu?format=pdf`
    );
  },
};

/* ==========================================================================
   Yardımcılar
   ========================================================================== */

/** "09.09.2026 15:12" biçimi */
export const ebelgeTarihSaat = (iso?: string | null): string => {
  if (!iso) return "-";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "-";
  return d.toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

/** Servis adresi allowlist'e uyuyor mu? (backend de ayrıca doğrular) */
export const ebelgeAdresGecerliMi = (url?: string | null): boolean => {
  if (!url) return false;
  try {
    const u = new URL(url.trim());
    return u.protocol === "https:" && u.hostname.toLowerCase().endsWith(".iceteknoloji.com.tr");
  } catch {
    return false;
  }
};

/** 1234.5 → "1.234,50" */
export const ebelgeTutar = (n?: number | null, paraBirimi?: string | null): string => {
  if (n === null || n === undefined || isNaN(n)) return "-";
  const metin = n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return paraBirimi ? `${metin} ${paraBirimi}` : metin;
};

/** Red/kabul durumuna göre rozet rengi (§15.2 paleti) */
export const ebelgeRedKabulRozet = (
  redKabul?: string | null
): { bg: string; text: string; etiket: string } => {
  if (redKabul === "Kabul") return { bg: "success-subtle", text: "success", etiket: "Kabul" };
  if (redKabul === "Red") return { bg: "danger-subtle", text: "danger", etiket: "Red" };
  return { bg: "secondary-subtle", text: "secondary", etiket: "Cevap bekliyor" };
};

/** Giden belge durumuna göre rozet (§15.2 paleti) */
export const ebelgeGidenDurumRozet = (
  durum?: string | null
): { bg: string; text: string; etiket: string } => {
  switch (durum) {
    case "GONDERILMEDI":
      return { bg: "secondary-subtle", text: "secondary", etiket: "Gönderilmedi" };
    case "KONTROL_GEREKLI":
      return { bg: "warning-subtle", text: "warning", etiket: "Kontrol gerekli" };
    case "ONAYLANIYOR":
    case "GONDERILIYOR":
    case "IPTAL_EDILIYOR":
      return { bg: "warning-subtle", text: "warning", etiket: "İşlem sürüyor / kontrol gerekli" };
    case "BELIRSIZ":
    case "IPTAL_BELIRSIZ":
      return { bg: "danger-subtle", text: "danger", etiket: "Sonuç belirsiz" };
    case "TASLAK":
      return { bg: "warning-subtle", text: "warning", etiket: "Taslak" };
    case "GONDERILDI":
      return { bg: "info-subtle", text: "info", etiket: "Gönderildi" };
    case "IPTAL":
      return { bg: "secondary-subtle", text: "secondary", etiket: "İptal" };
    case "HATA":
      return { bg: "danger-subtle", text: "danger", etiket: "Hata" };
    default:
      return { bg: "secondary-subtle", text: "secondary", etiket: durum || "-" };
  }
};

/** Ticari fatura mı? (yalnızca ticari faturaya kabul/red cevabı verilir) */
export const ebelgeTicariMi = (profil?: string | null): boolean =>
  String(profil || "").toUpperCase().includes("TICARI");

/** Kontör satırlarından okunabilir bir özet üretir (alan adları sürüme göre değişebiliyor) */
export const ebelgeKontorOzet = (satirlar?: EbelgeKontorSatiri[] | null): string => {
  if (!satirlar || satirlar.length === 0) return "-";
  const parcalar: string[] = [];
  for (const satir of satirlar.slice(0, 4)) {
    const alanlar = Object.entries(satir)
      .filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== "")
      .map(([k, v]) => `${k}: ${v}`);
    if (alanlar.length) parcalar.push(alanlar.join(" · "));
  }
  return parcalar.length ? parcalar.join(" | ") : "-";
};
