import { apiClient } from "./apiClient";

export interface MenuItem {
  menuId: number;
  menuKodu?: string | null;
  menuAdi: string;
  aciklama?: string | null;
  siraNo: number;
  aktif: boolean;
  eklemeZamani?: string;
  guncellemeZamani?: string | null;
  urunSayisi?: number;
}

export interface SaveMenuPayload {
  menuId?: number | null;
  menuKodu?: string | null;
  menuAdi: string;
  aciklama?: string | null;
  siraNo?: number;
  aktif?: boolean;
}

export interface KatalogUrun {
  urunTipi: "altin" | "ozel";
  urunId: number;
  barkod: string | null;
  grupKodu: string;
  urunNo: number;
  ayar: string | null;
  model: string | null;
  ureticiFirma: string | null;
  miktar: number;
  miktarBirimi: string;
  satisFiyati: number;
  satisParaKodu: string;
  hasKuru1?: number | null;
  hasKuru2?: number | null;
  usdKuru1?: number | null;
  usdKuru2?: number | null;
  altinKuru?: number | null;
  menuId: number | null;
  menuAdi: string | null;
  katalog: boolean;
  konsinye: boolean;
  satildi: boolean;
  eklemeZamani: string;
  resimler: Array<{
    resimId: number;
    dosyaYolu: string;
    dosyaAdi: string;
    resimData?: string | null;
  }>;
}

export const notifyConsinyeUpdate = () => {
  try {
    const bc = new BroadcastChannel("likya_consinye_channel");
    bc.postMessage({ type: "CONSINYE_UPDATED", timestamp: Date.now() });
    setTimeout(() => {
      try {
        bc.close();
      } catch {}
    }, 1000);
  } catch {}
  try {
    localStorage.setItem("likya_consinye_update", String(Date.now()));
  } catch {}
  try {
    window.dispatchEvent(new CustomEvent("likya_consinye_update"));
  } catch {}
};

export const notifyKatalogUpdate = () => {
  try {
    const bc = new BroadcastChannel("likya_katalog_tv");
    bc.postMessage({ type: "PRODUCT_SAVED", timestamp: Date.now() });
    setTimeout(() => {
      try {
        bc.close();
      } catch {}
    }, 1000);
  } catch {}
  try {
    localStorage.setItem("likya_katalog_tv_update", String(Date.now()));
  } catch {}
  try {
    window.dispatchEvent(new CustomEvent("likya_katalog_tv_update"));
  } catch {}
  notifyConsinyeUpdate();
};

export const MenuService = {
  async getMenus(aktif?: boolean): Promise<MenuItem[]> {
    const res = await apiClient.get<MenuItem[]>("/menu", aktif !== undefined ? { params: { aktif } } : undefined);
    const data = (res.data as any)?.data ?? res.data;
    return Array.isArray(data) ? data : [];
  },

  async saveMenu(payload: SaveMenuPayload): Promise<MenuItem> {
    const res = await apiClient.post<MenuItem>("/menu", payload);
    notifyKatalogUpdate();
    return (res.data as any)?.data ?? res.data;
  },

  async deleteMenu(menuId: number): Promise<void> {
    await apiClient.delete(`/menu/${menuId}`);
    notifyKatalogUpdate();
  },

  async getKatalogUrunleri(menuId?: number | null): Promise<KatalogUrun[]> {
    const res = await apiClient.get<KatalogUrun[]>("/menu/katalog-urunler", menuId ? { params: { menuId } } : undefined);
    const data = (res.data as any)?.data ?? res.data;
    return Array.isArray(data) ? data : [];
  },
};
