import { apiClient } from "./apiClient";

export interface SarrafFisSatiriItem {
  satirId?: number | null;
  satirNo: number;
  urunId: number;
  urunKodu: string;
  urunAdi: string;
  miktar: number | string;
  milyem: number | string;
  hasGram: number | string;
  adet: number | string;
  iscilikiMiktari: number | string;
  iscilikHasGram: number | string;
  aciklama?: string;
  iscilikHesaplamaSekli?: number | null;
  kur: number | string;
  tutar: number | string;
  urunTipi: number;
  karat?: number | null;
}

export interface OdemeSatiriItem {
  satirNo: number;
  islemeYeri: number;
  odemeAraciTuru: number;
  paraId?: number | null;
  paraKodu?: string;
  miktar: number | string;
  milyem: number | string;
  hasGram: number | string;
  kur: number | string;
  tutar: number | string;
  degistirildi?: boolean;
}

export interface SarrafFisListItem {
  sarrafFisiId: number;
  fisNo: string;
  tarih: string;
  tip: number;
  tipLabel: string;
  unvan: string;
  altinHasKuru: number;
  vezneId: number;
  vezneKod?: string;
  eklemeZamani?: string;
}

export interface SarrafFisModel {
  sarrafFisiId: number;
  fisNo?: string;
  tarih: string;
  saat?: string;
  tip: number;
  altinHasKuru: number;
  alisKuru: number;
  satisKuru: number;
  gumusHasKuru: number;
  kdvOrani?: number;
  kdv?: number;
  unvan?: string;
  cariKartId?: number | null;
  vezneId?: number;
  belgeTuru: number;
  kisilikTipi?: number | null;
  uyrukId?: number | null;
  ulkeId?: number | null;
  pasaportNo?: string | null;
  hukukiYapiId?: number | null;
  vergiDairesiId?: number | null;
  vergiKimlikNo?: string | null;
  babaAdi?: string | null;
  adres?: string | null;
  ilceId?: number | null;
  postaKoduId?: number | null;
  ilId?: number | null;
  vekilTuru?: number | null;
  vekilKisilikTipi?: number | null;
  vekilAdi?: string | null;
  vekilKimlikNo?: string | null;
  eposta?: string | null;
  telefonNo?: string | null;
  meslekId?: number | null;
  dogumTarihi?: string | null;
  dogumYeri?: string | null;
  kimlikSeriNo?: string | null;
  anneAdi?: string | null;
  sirketTuru?: number | null;
  kimlikBelgeTuru?: number | null;
  dernekAmaci?: string | null;
  yetkiliKisiId?: number | null;
  kimlikGecerlilikTarihi?: string | null;
  masakListesindeVar?: boolean;
  satirlar: SarrafFisSatiriItem[];
  odemeSatirlari: OdemeSatiriItem[];
}

export interface SaveSarrafFisPayload {
  sarrafFisiId?: number | null;
  vezneId: number;
  cariKartId?: number | null;
  tarih: string;
  saat?: string | null;
  fisNo?: string | null;
  tip: number;
  altinHasKuru: number;
  kdvOrani?: number | null;
  kdv?: number | null;
  kisilikTipi?: number | null;
  uyrukId?: number | null;
  ulkeId?: number | null;
  pasaportNo?: string | null;
  hukukiYapiId?: number | null;
  vergiDairesiId?: number | null;
  vergiKimlikNo?: string | null;
  babaAdi?: string | null;
  adres?: string | null;
  ilceId?: number | null;
  postaKoduId?: number | null;
  ilId?: number | null;
  vekilTuru?: number | null;
  vekilKisilikTipi?: number | null;
  vekilAdi?: string | null;
  vekilKimlikNo?: string | null;
  eposta?: string | null;
  telefonNo?: string | null;
  meslekId?: number | null;
  dogumTarihi?: string | null;
  dogumYeri?: string | null;
  kimlikSeriNo?: string | null;
  anneAdi?: string | null;
  masakListesindeVar?: boolean;
  yetkiliKisiId?: number | null;
  sirketTuru?: number | null;
  kimlikGecerlilikTarihi?: string | null;
  kimlikBelgeTuru?: number | null;
  dernekAmaci?: string | null;
  yetkiliKisi?: string | null;
  belgeTuru?: number;
  unvan?: string | null;
  favoriParaId?: number | null;
  alisKuru?: number;
  satisKuru?: number;
  gumusHasKuru?: number;
  kullaniciId?: number;
  yazdirilanBelgeTipi?: number | null;
  satirlar: {
    satirId?: number | null;
    satirNo: number;
    urunId: number;
    miktar: number | string;
    milyem: number | string;
    hasGram: number | string;
    adet: number | string;
    iscilikiMiktari: number | string;
    iscilikHasGram: number | string;
    aciklama?: string | null;
    iscilikHesaplamaSekli?: number | null;
    kur: number | string;
    tutar: number | string;
    urunTipi: number;
    karat?: number | null;
  }[];
  odemeSatirlari: {
    satirNo: number;
    islemeYeri: number;
    odemeAraciTuru: number;
    paraId?: number | null;
    miktar: number | string;
    milyem: number | string;
    hasGram: number | string;
    kur: number | string;
    tutar: number | string;
    degistirildi?: boolean;
  }[];
}

export interface UrunItem {
  id: number;
  paraId: number;
  kod: string;
  ad: string;
  gramaj?: number;
  hasOrani?: number;
  iscilik?: number;
  birim?: number;
  urunTipi?: number;
}

export interface VezneBakiyeItem {
  paraId: number;
  paraKodu: string;
  miktar: number;
}

export class SarrafFisService {
  static async getUrunler(): Promise<UrunItem[]> {
    try {
      const res = await apiClient.get<any[]>("/sarraf-fis/urunler");
      if (res.data && res.data.length > 0) {
        return res.data.map((r: any) => ({
          id: Number(r.id || r.paraId),
          paraId: Number(r.paraId || r.id),
          kod: (r.kod || "").trim(),
          ad: (r.ad || "").trim(),
          gramaj: Number(r.gramaj) || 0,
          hasOrani: Number(r.hasOrani) || 0,
          iscilik: Number(r.iscilik) || 0,
          birim: Number(r.birim) || 0,
          urunTipi: Number(r.urunTipi) || 0,
        }));
      }
    } catch (err) {
      console.warn("getUrunler from /sarraf-fis/urunler failed, trying /para fallback:", err);
    }
    try {
      const res2 = await apiClient.get<any[]>("/para");
      return (res2.data || []).map((r: any) => ({
        id: Number(r.id || r.paraId),
        paraId: Number(r.id || r.paraId),
        kod: (r.kod || "").trim(),
        ad: (r.ad || "").trim(),
        gramaj: Number(r.gramaj) || 0,
        hasOrani: Number(r.hasOrani) || 0,
        iscilik: Number(r.iscilik) || 0,
        birim: Number(r.birim) || 0,
        urunTipi: Number(r.urunTipi) || 0,
      }));
    } catch (err2) {
      console.error("getUrunler failed on both endpoints:", err2);
      return [];
    }
  }

  static async getVezneBakiye(vezneId: number): Promise<VezneBakiyeItem[]> {
    const res = await apiClient.get<VezneBakiyeItem[]>("/sarraf-fis/vezne-bakiye", { vezneId });
    return res.data || [];
  }

  static async getFisList(params?: { search?: string; tip?: number; vezneId?: number; limit?: number }): Promise<SarrafFisListItem[]> {
    const res = await apiClient.get<SarrafFisListItem[]>("/sarraf-fis", params);
    return res.data || [];
  }

  static async getFisById(id: number): Promise<SarrafFisModel | null> {
    const res = await apiClient.get<SarrafFisModel>(`/sarraf-fis/${id}`);
    return res.data || null;
  }

  static async saveFis(payload: SaveSarrafFisPayload): Promise<{ sarrafFisiId: number; fisNo: string; yeniKayit: boolean }> {
    const res = await apiClient.post<{ sarrafFisiId: number; fisNo: string; yeniKayit: boolean }>("/sarraf-fis", payload);
    return res.data!;
  }

  static async deleteFis(id: number, kullaniciId: number): Promise<void> {
    await apiClient.delete(`/sarraf-fis/${id}?kullaniciId=${kullaniciId}`);
  }

  static async saveDetay(id: number, payload: Partial<SaveSarrafFisPayload>): Promise<void> {
    await apiClient.put(`/sarraf-fis/${id}/detay`, payload);
  }

  static async getUserVezneId(kullaniciId: number): Promise<number | null> {
    const res = await apiClient.get<{ vezneId: number | null }>("/sarraf-fis/user-vezne", { kullaniciId });
    return res.data?.vezneId ?? null;
  }
}
