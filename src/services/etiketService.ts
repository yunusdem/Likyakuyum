import { apiClient } from "./apiClient";

// ─── Altın Ürün (TODVZ_ALTIN_URUN) ───────────────────────────────────────────
export interface AltinUrunItem {
  altinUrunId: number;
  tarih: string;
  grupKodu: string;
  urunNo: number;
  barkod?: string | null;
  ayar?: string | null;
  ureticiFirma?: string | null;
  orjinalKod?: string | null;
  model?: string | null;
  banko?: string | null;
  miktar: number;
  hasGram: number;
  maliyetIscilik: number;
  maliyetIscilikParaKodu: string;
  maliyetIscilikBirim: string;
  maliyetIscilikTutari: number;
  satisIscilik: number;
  satisIscilikTutari: number;
  iscilikKari: number;
  maliyet: number;
  maliyetParaKodu: string;
  satisFiyati: number;
  satisParaKodu: string;
  satisKariYuzde: number;
  hasKuru1?: number | null;
  hasKuru2?: number | null;
  altinKuru?: number | null;
  usdKuru1?: number | null;
  usdKuru2?: number | null;
  resim?: string | null;
  resimler?: string[];
  vezneId?: number | null;
  vezneKod?: string | null;
  vezneAd?: string | null;
  rfidEpc?: string | null;
  satildi: boolean;
  yazdirildi: boolean;
  yazdirildiZamani?: string | null;
  eklemeZamani?: string | null;
  guncellemeZamani?: string | null;
}

export interface SaveAltinUrunPayload {
  altinUrunId?: number | null;
  tarih?: string | null;
  grupKodu: string;
  urunNo: number;
  barkod?: string | null;
  rfidEpc?: string | null;
  ayar?: string | null;
  ureticiFirma?: string | null;
  orjinalKod?: string | null;
  model?: string | null;
  banko?: string | null;
  miktar?: number;
  hasGram?: number;
  maliyetIscilik?: number;
  maliyetIscilikParaKodu?: string;
  maliyetIscilikBirim?: string;
  maliyetIscilikTutari?: number;
  satisIscilik?: number;
  satisIscilikTutari?: number;
  iscilikKari?: number;
  maliyet?: number;
  maliyetParaKodu?: string;
  satisFiyati?: number;
  satisParaKodu?: string;
  satisKariYuzde?: number;
  hasKuru1?: number | null;
  hasKuru2?: number | null;
  altinKuru?: number | null;
  usdKuru1?: number | null;
  usdKuru2?: number | null;
  resim?: string | null;
  resimler?: string[];
  vezneId?: number | null;
  satildi?: boolean;
}

// ─── Özel Ürün (TODVZ_OZEL_URUN) ─────────────────────────────────────────────
export interface OzelUrunItem {
  ozelUrunId: number;
  tarih: string;
  grupKodu: string;
  urunNo: number;
  barkod?: string | null;
  rfidEpc?: string | null;
  mamulTipi?: string | null;
  ureticiFirma?: string | null;
  miktar: number;
  miktarBirimi: string;
  orjinalKod?: string | null;
  ayar?: string | null;
  modelOzellik1?: string | null;
  modelOzellik2?: string | null;
  banko?: string | null;
  maliyet: number;
  maliyetParaKodu: string;
  karYuzdesi: number;
  sabitle: boolean;
  satisFiyati: number;
  satisParaKodu: string;
  hizliGiris: boolean;
  tasCinsi?: string | null;
  tasMiktar?: number | null;
  tasBirim: string;
  tasRenk?: string | null;
  tasSaflik?: string | null;
  tasAdet?: number | null;
  tasTutar?: number | null;
  tasTutarBirimi: string;
  resim?: string | null;
  resimler?: string[];
  vezneId?: number | null;
  vezneKod?: string | null;
  vezneAd?: string | null;
  satildi: boolean;
  yazdirildi: boolean;
  yazdirildiZamani?: string | null;
  eklemeZamani?: string | null;
  guncellemeZamani?: string | null;
}

export interface SaveOzelUrunPayload {
  ozelUrunId?: number | null;
  tarih?: string | null;
  grupKodu: string;
  urunNo: number;
  barkod?: string | null;
  rfidEpc?: string | null;
  mamulTipi?: string | null;
  ureticiFirma?: string | null;
  miktar?: number;
  miktarBirimi?: string;
  orjinalKod?: string | null;
  ayar?: string | null;
  modelOzellik1?: string | null;
  modelOzellik2?: string | null;
  banko?: string | null;
  maliyet?: number;
  maliyetParaKodu?: string;
  karYuzdesi?: number;
  sabitle?: boolean;
  satisFiyati?: number;
  satisParaKodu?: string;
  hizliGiris?: boolean;
  tasCinsi?: string | null;
  tasMiktar?: number | null;
  tasBirim?: string;
  tasRenk?: string | null;
  tasSaflik?: string | null;
  tasAdet?: number | null;
  tasTutar?: number | null;
  tasTutarBirimi?: string;
  resim?: string | null;
  resimler?: string[];
  vezneId?: number | null;
  satildi?: boolean;
}

// ─── RFID Veri Yapıları ──────────────────────────────────────────────────────
export interface RfidTagItem {
  sira: number;
  epc: string;
  tid?: string;
  stokKodu: string;
  urunAdi: string;
  ayar: string;
  milyem: number;
  brutGram: number;
  hasGram: number;
  iscilikGram?: number;
  iscilikTutari?: number;
  satisFiyati?: number;
  satisParaKodu?: string;
  banko?: string;
  durum: "KAYITLI" | "BILINMEYEN" | "EKSIK" | "ETIKETSIZ";
  okunmaZamani: string;
  hitCount: number;
  rssi?: number;
  rawItem?: any;
}

export interface RfidScanItem {
  id: string;
  epc: string;
  tid?: string;
  barkod?: string;
  urunId?: number;
  urunTipi?: "altin" | "ozel";
  urunAdi: string;
  ayar?: string;
  miktar: number;
  birim: string;
  banko?: string;
  satisFiyati?: number;
  satisParaKodu?: string;
  durum: "eslesti" | "eksik" | "fazla_tanimsiz";
  okunmaSayisi: number;
  rssi: number;
  sonOkunmaZamani: string;
  antenNo?: number;
  resim?: string | null;
}

export interface RfidAyarConfig {
  cihazTipi: "simulator" | "webserial" | "webbluetooth" | "keyboard_wedge";
  baudRate: number;
  frekansBolgesi: "ETSI_TR" | "FCC_US" | "CHINA";
  okumaGucuDbm: number;
  antennas: number[];
  qFactor: "dynamic" | "fixed_4" | "fixed_5" | "fixed_6";
  session: "S0" | "S1" | "S2" | "S3";
  sesliUyari: boolean;
  bipSesTipi: "classic" | "subtle" | "chime";
}

// ─── Etiket Şablonları ────────────────────────────────────────────────────────
export type EtiketElementType = "field" | "barcode" | "qrcode" | "rfid" | "logo" | "text" | "icon" | "line" | "rect" | "ellipse" | "image" | "qr";
export type EtiketSekli = "kelebek" | "dambil" | "kuyruklu" | "bogumlukuyruk" | "bogumlukuyrukkeskin" | "rfid" | "dikdortgen";
export type EtiketArkaPlan = "beyaz" | "altin" | "siyah" | "gumus" | string;

export interface EtiketSablonAlan {
  id?: string;
  alan: string;  // field key or element type
  key?: string;
  ad?: string;
  aktif?: boolean;
  sira?: number;
  etiketElementTipi?: EtiketElementType;
  type?: EtiketElementType;
  x?: number; // mm
  y?: number; // mm
  genislik?: number; // mm (width)
  yukseklik?: number; // mm (height)
  width?: number; // mm
  height?: number; // mm
  fontSize?: number; // pt
  fontWeight?: "normal" | "bold" | "600" | "800";
  fontFamily?: string;
  fontStyle?: "normal" | "italic";
  textDecoration?: "none" | "underline" | "line-through";
  textTransform?: "none" | "uppercase" | "lowercase";
  color?: string;
  backgroundColor?: string;
  textAlign?: "left" | "center" | "right";
  rotation?: number;
  prefix?: string;
  suffix?: string;
  customText?: string;
  text?: string;
  iconName?: string;
  iconEmoji?: string;
  barkodFormat?: "CODE128" | "EAN13" | "CODE39" | "QR" | "RFID";
  barcodeFormat?: "CODE128" | "EAN13" | "CODE39" | "QR" | "RFID";
  barcodeValue?: string;
  barcodeText?: string;
  showBarcodeText?: boolean;
  fieldKey?: string;
  showText?: boolean;
  borderWidth?: number;
  borderColor?: string;
  borderRadius?: number;
  opacity?: number;
  visible?: boolean;
  locked?: boolean;
  zIndex?: number;
  imageData?: string;
}

export interface EtiketSablonItem {
  etiketSablonId: number;
  ad: string;
  etiketTipi: number; // 0: Altın/Sarrafiye, 1: Özel/Pırlanta, 2: Yüzük-Bilezik, 3: Fiyat-Ayar, 4: Kablosuz RFID
  genislikMm: number;
  yukseklikMm: number;
  kuyrukPayiMm: number;
  logoKonumu: string;
  barkodTipi: string; // CODE128 | QR
  alanlar: EtiketSablonAlan[];
  varsayilan: boolean;
  etiketSekli?: EtiketSekli;
  solKanatGenislikMm?: number;
  sagKanatGenislikMm?: number;
  kuyrukGenislikMm?: number;
  arkaPlanRengi?: EtiketArkaPlan;
  rfidDahili?: boolean;
  yaziciUstKaydirmaMm?: number;
  yaziciSolKaydirmaMm?: number;
}

export interface SaveEtiketSablonPayload {
  etiketSablonId?: number | null;
  ad: string;
  etiketTipi: number;
  genislikMm?: number;
  yukseklikMm?: number;
  kuyrukPayiMm?: number;
  logoKonumu?: string;
  barkodTipi?: string;
  alanlar?: EtiketSablonAlan[];
  varsayilan?: boolean;
  etiketSekli?: EtiketSekli;
  solKanatGenislikMm?: number;
  sagKanatGenislikMm?: number;
  kuyrukGenislikMm?: number;
  arkaPlanRengi?: EtiketArkaPlan;
  rfidDahili?: boolean;
  yaziciUstKaydirmaMm?: number;
  yaziciSolKaydirmaMm?: number;
}

export interface EtiketGrupNoResult {
  grupKodu: string;
  sonNo: number;
  barkod: string;
  yeniGrup: boolean;
}

// ─── Banko Tanımları (TODVZ_BANKO) ──────────────────────────────────────────
export interface BankoItem {
  bankoId: number;
  bankoKodu: string;
  bankoAdi: string;
  vezneId?: number | null;
  aciklama?: string | null;
  aktif: boolean;
  eklemeZamani?: string | null;
}

export interface SaveBankoPayload {
  bankoId?: number | null;
  bankoKodu?: string | null;
  bankoAdi: string;
  vezneId?: number | null;
  aciklama?: string | null;
  aktif?: boolean;
}

export interface EtiketGrupItem {
  tip: number;
  grupKodu: string;
  sonNo: number;
  aciklama?: string | null;
  guncellemeZamani?: string;
}

export const EtiketService = {
  // ─── Altın Ürün ────────────────────────────────────────────────────────────
  async getAltinUrunler(filter?: Record<string, any>): Promise<AltinUrunItem[]> {
    const res = await apiClient.get<AltinUrunItem[]>("/etiket/altin-urun", filter);
    const data = (res.data as any)?.data ?? res.data;
    return Array.isArray(data) ? data : [];
  },
  async getAltinUrunById(id: number): Promise<AltinUrunItem> {
    const res = await apiClient.get<AltinUrunItem>(`/etiket/altin-urun/${id}`);
    return (res.data as any)?.data ?? res.data;
  },
  async getAltinUrunByBarkod(barkod: string): Promise<AltinUrunItem> {
    const res = await apiClient.get<AltinUrunItem>(`/etiket/altin-urun/barkod/${encodeURIComponent(barkod)}`);
    return (res.data as any)?.data ?? res.data;
  },
  async getAltinUrunStok(vezneId: number, ayar: string): Promise<{ 
    paraId: number | null; 
    paraKodu: string | null; 
    paraAdi: string | null; 
    bakiye: number;
    tumBakiyeler?: Record<string, number>;
  }> {
    const res = await apiClient.get<{ 
      paraId: number | null; 
      paraKodu: string | null; 
      paraAdi: string | null; 
      bakiye: number;
      tumBakiyeler?: Record<string, number>;
    }>("/etiket/altin-urun/stok", {
      vezneId,
      ayar,
    });
    return (res.data as any)?.data ?? res.data;
  },
  async saveAltinUrun(payload: SaveAltinUrunPayload): Promise<AltinUrunItem> {
    const res = await apiClient.post<AltinUrunItem>("/etiket/altin-urun", payload);
    return (res.data as any)?.data ?? res.data;
  },
  async deleteAltinUrun(id: number): Promise<void> {
    await apiClient.delete(`/etiket/altin-urun/${id}`);
  },
  async markAltinUrunYazdirildi(ids: number[], yazdirildi: boolean): Promise<void> {
    await apiClient.post("/etiket/altin-urun/yazdirildi-isaretle", { ids, yazdirildi });
  },
  async getNextAltinUrunNo(grupKodu: string, uzunluk = 5): Promise<EtiketGrupNoResult> {
    const res = await apiClient.get<EtiketGrupNoResult>("/etiket/altin-urun/next-no", { grupKodu, uzunluk });
    return (res.data as any)?.data ?? res.data;
  },

  // ─── Özel Ürün ─────────────────────────────────────────────────────────────
  async getOzelUrunler(filter?: Record<string, any>): Promise<OzelUrunItem[]> {
    const res = await apiClient.get<OzelUrunItem[]>("/etiket/ozel-urun", filter);
    const data = (res.data as any)?.data ?? res.data;
    return Array.isArray(data) ? data : [];
  },
  async getOzelUrunById(id: number): Promise<OzelUrunItem> {
    const res = await apiClient.get<OzelUrunItem>(`/etiket/ozel-urun/${id}`);
    return (res.data as any)?.data ?? res.data;
  },
  async getOzelUrunByBarkod(barkod: string): Promise<OzelUrunItem> {
    const res = await apiClient.get<OzelUrunItem>(`/etiket/ozel-urun/barkod/${encodeURIComponent(barkod)}`);
    return (res.data as any)?.data ?? res.data;
  },
  async saveOzelUrun(payload: SaveOzelUrunPayload): Promise<OzelUrunItem> {
    const res = await apiClient.post<OzelUrunItem>("/etiket/ozel-urun", payload);
    return (res.data as any)?.data ?? res.data;
  },
  async deleteOzelUrun(id: number): Promise<void> {
    await apiClient.delete(`/etiket/ozel-urun/${id}`);
  },
  async markOzelUrunYazdirildi(ids: number[], yazdirildi: boolean): Promise<void> {
    await apiClient.post("/etiket/ozel-urun/yazdirildi-isaretle", { ids, yazdirildi });
  },
  async getNextOzelUrunNo(grupKodu: string, uzunluk = 5): Promise<EtiketGrupNoResult> {
    const res = await apiClient.get<EtiketGrupNoResult>("/etiket/ozel-urun/next-no", { grupKodu, uzunluk });
    return (res.data as any)?.data ?? res.data;
  },

  // ─── RFID API Uç Noktaları ────────────────────────────────────────────────
  async generateRfidEpc(payload: { id?: number; tip?: string; ayar?: string; grupKodu?: string }): Promise<{ epc: string }> {
    const res = await apiClient.post<{ epc: string }>("/etiket/rfid/generate-epc", payload);
    return (res.data as any)?.data ?? res.data;
  },

  async encodeAndPrintRfid(payload: { id: number; tip: "altin" | "ozel"; epc?: string; designType?: string }): Promise<{
    success: boolean;
    id: number;
    tip: string;
    epc: string;
    zpl: string;
    message: string;
  }> {
    const res = await apiClient.post<any>("/etiket/rfid/encode-and-print", payload);
    return (res.data as any)?.data ?? res.data;
  },

  async bulkEncodeRfid(payload: { items: Array<{ id: number; tip: "altin" | "ozel"; epc?: string; designType?: string }> }): Promise<{
    success: boolean;
    totalCount: number;
    successCount: number;
    results: any[];
    combinedZpl: string;
  }> {
    const res = await apiClient.post<any>("/etiket/rfid/bulk-encode", payload);
    return (res.data as any)?.data ?? res.data;
  },

  async getRfidProductDetail(epc: string): Promise<any> {
    const res = await apiClient.get<any>(`/etiket/rfid/urun-detay/${encodeURIComponent(epc)}`);
    return (res.data as any)?.data ?? res.data;
  },

  // ─── Grup Yönetimi & Lookup'lar ──────────────────────────────────────────
  async getGruplar(tip?: number): Promise<EtiketGrupItem[]> {
    const res = await apiClient.get<EtiketGrupItem[]>("/etiket/gruplar", tip !== undefined ? { tip } : undefined);
    const data = (res.data as any)?.data ?? res.data;
    return Array.isArray(data) ? data : [];
  },
  async saveGrup(payload: { tip: number; grupKodu: string; aciklama?: string | null; baslangicNo?: number }): Promise<EtiketGrupItem> {
    const res = await apiClient.post<EtiketGrupItem>("/etiket/gruplar", payload);
    return (res.data as any)?.data ?? res.data;
  },
  async deleteGrup(tip: number, grupKodu: string): Promise<void> {
    await apiClient.delete("/etiket/gruplar", { params: { tip, grupKodu } });
  },
  async uploadFoto(payload: { base64: string; dosyaAdi?: string; tip?: number; islemId?: number }): Promise<{ resimId: number; url: string; dosyaYolu: string }> {
    const res = await apiClient.post<{ resimId: number; url: string; dosyaYolu: string }>("/etiket/foto-yukle", payload);
    return (res.data as any)?.data ?? res.data;
  },
  async getGrupKodlari(): Promise<string[]> {
    const res = await apiClient.get<string[]>("/etiket/grup-kodlari");
    const data = (res.data as any)?.data ?? res.data;
    return Array.isArray(data) ? data : [];
  },
  async getUreticiFirmalar(): Promise<string[]> {
    const res = await apiClient.get<string[]>("/etiket/uretici-firmalar");
    const data = (res.data as any)?.data ?? res.data;
    return Array.isArray(data) ? data : [];
  },

  // ─── Banko Yönetimi (TODVZ_BANKO) ──────────────────────────────────────────
  async getBankolar(filter?: { search?: string; aktif?: boolean }): Promise<BankoItem[]> {
    const res = await apiClient.get<BankoItem[]>("/etiket/bankolar", filter);
    const data = (res.data as any)?.data ?? res.data;
    return Array.isArray(data) ? data : [];
  },
  async saveBanko(payload: SaveBankoPayload): Promise<BankoItem> {
    const res = await apiClient.post<BankoItem>("/etiket/bankolar", payload);
    return (res.data as any)?.data ?? res.data;
  },
  async deleteBanko(id: number): Promise<void> {
    await apiClient.delete(`/etiket/bankolar/${id}`);
  },

  // ─── Etiket Şablonları ─────────────────────────────────────────────────────
  async getSablonlar(etiketTipi?: number): Promise<EtiketSablonItem[]> {
    const res = await apiClient.get<EtiketSablonItem[]>("/etiket/sablon", etiketTipi !== undefined ? { etiketTipi } : undefined);
    const data = (res.data as any)?.data ?? res.data;
    return Array.isArray(data) ? data : [];
  },
  async getSablonById(id: number): Promise<EtiketSablonItem> {
    const res = await apiClient.get<EtiketSablonItem>(`/etiket/sablon/${id}`);
    return (res.data as any)?.data ?? res.data;
  },
  async saveSablon(payload: SaveEtiketSablonPayload): Promise<EtiketSablonItem> {
    const res = await apiClient.post<EtiketSablonItem>("/etiket/sablon", payload);
    return (res.data as any)?.data ?? res.data;
  },
  async deleteSablon(id: number): Promise<void> {
    await apiClient.delete(`/etiket/sablon/${id}`);
  },
  // ─── Sektörel Logo & Damga Yönetimi (TODVZ_FOTOGRAF URUN_TIPI = 9) ─────────

  async getLogolar(tip = 9): Promise<EtiketLogoItem[]> {
    const res = await apiClient.get<EtiketLogoItem[]>("/etiket/logolar", { tip });
    const data = (res.data as any)?.data ?? res.data;
    return Array.isArray(data) ? data : [];
  },
  async saveLogo(payload: { base64: string; dosyaAdi?: string; mimeTipi?: string; tip?: number }): Promise<EtiketLogoItem> {
    const res = await apiClient.post<EtiketLogoItem>("/etiket/logolar", payload);
    return (res.data as any)?.data ?? res.data;
  },
  async deleteLogo(id: number): Promise<void> {
    await apiClient.delete(`/etiket/logolar/${id}`);
  },

  // ─── Barkodlu Sayım Fişi Yönetimi (SODVZ_SAYIM_FISI_KAYDET & SODVZ_SAYIM_SATIR_EKLE) ───
  async getNextSayimFisNo(): Promise<string> {
    const res = await apiClient.get<{ fisNo: string }>("/sayim/next-no");
    const data = (res.data as any)?.data ?? res.data;
    return data?.fisNo || "";
  },

  async getSayimFisleri(limit = 100): Promise<any[]> {
    const res = await apiClient.get<any[]>("/sayim", { limit });
    const data = (res.data as any)?.data ?? res.data;
    return Array.isArray(data) ? data : [];
  },

  async getSayimFisiById(id: number): Promise<any> {
    const res = await apiClient.get<any>(`/sayim/${id}`);
    return (res.data as any)?.data ?? res.data;
  },

  async saveSayimFisi(payload: any): Promise<any> {
    const res = await apiClient.post<any>("/sayim", payload);
    return (res.data as any)?.data ?? res.data;
  },

  async deleteSayimFisi(id: number): Promise<void> {
    await apiClient.delete(`/sayim/${id}`);
  },

  // ─── Tablo Maddesi (TODVZ_TABLO_MADDESI & SODVZ_TABLO_MADDESI_KAYDET) ───
  async getTabloMaddeleri(tur: number, search?: string): Promise<TabloMaddesiItem[]> {
    const params: any = { tur };
    if (search) params.q = search;
    const res = await apiClient.get<TabloMaddesiItem[]>("/tanimlar/tablo-maddesi", params);
    const data = (res.data as any)?.data ?? res.data;
    return Array.isArray(data) ? data : [];
  },

  async saveTabloMaddesi(payload: { id?: number | null; tur: number; ad: string; kod?: string | null }): Promise<TabloMaddesiItem> {
    const res = await apiClient.post<TabloMaddesiItem>("/tanimlar/tablo-maddesi", payload);
    return (res.data as any)?.data ?? res.data;
  },

  async deleteTabloMaddesi(id: number): Promise<void> {
    await apiClient.delete(`/tanimlar/tablo-maddesi/${id}`);
  },
};

export interface TabloMaddesiItem {
  id: number;
  tur: number;
  ad: string;
  kod?: string | null;
}

export interface EtiketLogoItem {
  fotografId: number;
  urunTipi: number;
  urunId: number;
  dosyaAdi: string;
  mimeTipi: string;
  dataUrl: string;
  eklemeZamani?: string | null;
}

export default EtiketService;

