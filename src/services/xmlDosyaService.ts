import { apiClient } from "./apiClient";
import { indirBlob } from "./raporService";

export interface MerkezKurKontrolItem {
  tarih: string;
  seriNo: string;
  aciklama: string;
  durum: "tamam" | "hata";
}

export interface FirmaKontrolResult {
  vergiNo: string;
  unvan: string;
  subeKodu: string;
  subeAdi: string;
  adres: string;
  ilceAdi: string;
  postaKodu: string;
  ilKodu: string;
  ilAdi: string;
  eksikler: string[];
  gecerli: boolean;
}

export interface FisKontrolItem {
  fisId: number;
  tarih: string;
  seriNo: string;
  vrgSoyad: string;
  ad: string;
  babaAdi: string;
  belgeNo: string;
  uyruk: string;
  hukukiYapi: string;
  tckn: string;
  vkn: string;
  adres: string;
  ilce: string;
  postaKodu: string;
  ilKodu: string;
  ilAdi: string;
  ulke: string;
  vergiNo: string;
  vergiDairesi: string;
  hatalar: string[];
  gecerli: boolean;
}

export interface FisSatirKontrolItem {
  fisId: number;
  satirId: number;
  tarih: string;
  seriNo: string;
  satirNo: number;
  xmlParaKodu: string;
  islemTipi: string;
  miktar: number;
  tutarTl: number;
  hatalar: string[];
  gecerli: boolean;
}

export interface XmlOlusturResult {
  xmlContent: string;
  dosyaAdi: string;
  topIslemSayisi: number;
  topTutar: number;
  bilgidonem: string;
}

export interface XmlBirlestirResult {
  xmlContent: string;
  topIslemSayisi: number;
  topTutar: number;
  kaynakIslemSayisi: number;
  hedefIslemSayisi: number;
}

export const XmlDosyaService = {
  async kontrolMerkezKur(params: {
    ilkTarih: string;
    sonTarih: string;
    belgeIslemNo?: string;
    belgeIslemNoTuru?: "seri" | "belge";
  }): Promise<MerkezKurKontrolItem[]> {
    const res = await apiClient.get<MerkezKurKontrolItem[]>("/xml-dosya/kontrol/merkez-kur", params);
    return res.data || [];
  },

  async kontrolFirma(): Promise<FirmaKontrolResult> {
    const res = await apiClient.get<FirmaKontrolResult>("/xml-dosya/kontrol/firma");
    return res.data;
  },

  async kontrolFis(params: {
    ilkTarih: string;
    sonTarih: string;
    belgeIslemNo?: string;
    belgeIslemNoTuru?: "seri" | "belge";
  }): Promise<FisKontrolItem[]> {
    const res = await apiClient.get<FisKontrolItem[]>("/xml-dosya/kontrol/fis", params);
    return res.data || [];
  },

  async kontrolFisSatiri(params: {
    ilkTarih: string;
    sonTarih: string;
    belgeIslemNo?: string;
    belgeIslemNoTuru?: "seri" | "belge";
  }): Promise<FisSatirKontrolItem[]> {
    const res = await apiClient.get<FisSatirKontrolItem[]>("/xml-dosya/kontrol/fis-satiri", params);
    return res.data || [];
  },

  async olustur(params: {
    bildirimTuru?: string;
    hazirlamaTarihi: string;
    dosyaNo: string;
    islemYok: boolean;
    aciklama?: string;
    belgeIslemNoTuru?: "seri" | "belge";
    dosyaAdi?: string;
    ilkTarih: string;
    sonTarih: string;
  }): Promise<XmlOlusturResult> {
    const res = await apiClient.post<XmlOlusturResult>("/xml-dosya/olustur", params);
    return res.data;
  },

  async birlestir(params: {
    kaynakXml: string;
    hedefXml: string;
    dosyaNo?: string;
    hazirlamaTarihi?: string;
  }): Promise<XmlBirlestirResult> {
    const res = await apiClient.post<XmlBirlestirResult>("/xml-dosya/birlestir", params);
    return res.data;
  },

  /**
   * Kullanıcının istediği konumu seçtirerek (File System Access API) dosyayı diske kaydeder.
   * Tarayıcı desteklemiyorsa veya kullanıcı iptal ederse standart indirmeye geçer.
   */
  async diskeKaydet(content: string, varsayilanAd: string): Promise<boolean> {
    const blob = new Blob([content], { type: "application/xml;charset=utf-8" });

    // File System Access API destekleniyorsa konum seçtir
    if ("showSaveFilePicker" in window) {
      try {
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: varsayilanAd.endsWith(".xml") ? varsayilanAd : `${varsayilanAd}.xml`,
          types: [
            {
              description: "XML Dosyası (*.xml)",
              accept: { "application/xml": [".xml"] },
            },
          ],
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        return true;
      } catch (err: any) {
        if (err.name === "AbortError") {
          // Kullanıcı iptal etti
          return false;
        }
        // Destek yoksa ya da izin verilmediyse aşağıya geçip indirBlob kullan
      }
    }

    // Standart indirme yedeği
    indirBlob(blob, varsayilanAd.endsWith(".xml") ? varsayilanAd : `${varsayilanAd}.xml`);
    return true;
  },
};
