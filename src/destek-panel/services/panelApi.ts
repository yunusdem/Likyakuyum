// Destek paneli (destek.likyakuyum.com) API istemcisi — docs/DESTEK_PANELI_YOL_HARITASI.md.
// Admin paneli istemcisi gibi: token yalnız sessionStorage'da, yalnız Authorization başlığıyla gider; adres göreli (aynı köken).

import type { BildirimGirdi, DestekHedefSecenekleri, DestekKonuDetay } from "../../admin/services/adminApi";
import type { EkGirdi, KonuOzet, MesajDto, Oncelik, TalepTuru } from "../../components/destek/destekOrtak";

const API_KOK = "/api/v1/destek-panel";
const TOKEN_ANAHTARI = "likya_destek_token";

export const OTURUM_BITTI_OLAYI = "likya-destek-oturum-bitti";
export const DESTEK_DEGISTI_OLAYI = "likya-admin-destek-degisti";
export const destekDegisti = () => window.dispatchEvent(new Event(DESTEK_DEGISTI_OLAYI));

export type PersonelRol = "ADMIN" | "PERSONEL";
export type PersonelGorme = "TUMU" | "ATANAN";
export type PanelSekme = "havuz" | "benim" | "tumu" | "sistem";

export interface PersonelDto {
  personelId: number;
  kullaniciAdi: string;
  adSoyad: string;
  sifreDegismeli: boolean;
  rol: PersonelRol;
  gorme: PersonelGorme;
  durum: "AKTIF" | "PASIF";
  adminId: number | null;
  sonGiris: string | null;
  olusturmaTarihi: string;
  kilitli: boolean;
  cevrimici?: boolean;
}

export interface EkipUyesi {
  personelId: number;
  adSoyad: string;
  rol: PersonelRol;
  cevrimici: boolean;
}

export interface PanelOzet {
  havuz: number;
  benim: number;
  okunmamis: number;
  sistemOkunmamis: number;
  taslakBildirim: number;
  sonTalepId: number;
}

export interface FirmaKarti {
  firmaId: number;
  firmaKodu: string;
  musteriNo: string | null;
  unvan: string;
  yetkili: string | null;
  telefon: string | null;
  eposta: string | null;
  durum: string;
  baglantiModu: string;
  paket: string | null;
  lisansBitis: string | null;
  kullaniciSayisi: number;
  acikTalep: number;
  sonTalep: string | null;
  adres?: string | null;
  durumNotu?: string | null;
  kullaniciLimiti?: number | null;
  surum?: string | null;
  sonGorulme?: string | null;
}

export interface MusteriKullanici {
  kullaniciId: number;
  kullaniciAdi: string;
  adSoyad: string | null;
  durum: string;
  yonetici: boolean;
  sonGiris: string | null;
}

export type PanelKonu = KonuOzet;
export type PanelMesaj = MesajDto;

export interface PanelKonuDetay {
  konu: PanelKonu;
  mesajlar: PanelMesaj[];
  firma: FirmaKarti | null;
  hedefler?: DestekKonuDetay["hedefler"];
  yanitSayisi?: number;
}

export interface HizliCevap {
  cevapId: number;
  baslik: string;
  metin: string;
  sira: number;
  aktif: boolean;
}

export interface RaporSatiri {
  personelId: number;
  adSoyad: string;
  rol: PersonelRol;
  durum: string;
  acik: number;
  kapanan: number;
  ilkCevap: number;
  ortIlkCevapDk: number | null;
  mesaj: number;
}

export interface PanelKonuFiltresi {
  sekme: PanelSekme;
  durum?: string;
  firmaId?: number;
  personelId?: number;
  kaynakKonuId?: number;
  arama?: string;
  sayfa?: number;
  sayfaBoyu?: number;
}

export class PanelApiHatasi extends Error {
  constructor(public durum: number, mesaj: string) {
    super(mesaj);
  }
}

export const tokenOku = (): string | null => {
  try {
    return sessionStorage.getItem(TOKEN_ANAHTARI);
  } catch {
    return null;
  }
};
export const tokenYaz = (token: string | null) => {
  try {
    if (token) sessionStorage.setItem(TOKEN_ANAHTARI, token);
    else sessionStorage.removeItem(TOKEN_ANAHTARI);
  } catch {
    // depolama kapalı: oturum yalnız bellekte sürmez, yeniden giriş istenir
  }
};

const sorgu = (o: Record<string, unknown>) => {
  const p = new URLSearchParams();
  Object.entries(o).forEach(([k, v]) => v !== undefined && v !== null && v !== "" && p.set(k, String(v)));
  const s = p.toString();
  return s ? `?${s}` : "";
};

async function istek<T>(yontem: string, yol: string, govde?: unknown): Promise<T> {
  const token = tokenOku();
  let yanit: Response;
  try {
    yanit = await fetch(`${API_KOK}${yol}`, {
      method: yontem,
      headers: {
        ...(govde !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: govde !== undefined ? JSON.stringify(govde) : undefined,
      credentials: "omit",
      cache: "no-store",
    });
  } catch {
    throw new PanelApiHatasi(0, "Sunucuya ulaşılamadı.");
  }
  const json = await yanit.json().catch(() => null);
  if (!yanit.ok) {
    if (yanit.status === 401 && yol !== "/auth/login") {
      tokenYaz(null);
      window.dispatchEvent(new Event(OTURUM_BITTI_OLAYI));
    }
    throw new PanelApiHatasi(yanit.status, json?.message || `İstek başarısız (${yanit.status}).`);
  }
  return json?.data as T;
}

export const panelApi = {
  giris: (kullaniciAdi: string, sifre: string) => istek<{ token: string; personel: PersonelDto }>("POST", "/auth/login", { kullaniciAdi, sifre }),
  cikis: () => istek<void>("POST", "/auth/cikis", {}),
  ben: () => istek<PersonelDto>("GET", "/auth/ben"),
  sifreDegistir: (mevcutSifre: string, yeniSifre: string) => istek<void>("POST", "/auth/sifre", { mevcutSifre, yeniSifre }),

  ozet: () => istek<PanelOzet>("GET", "/ozet"),
  konular: (f: PanelKonuFiltresi) => istek<{ satirlar: PanelKonu[]; toplam: number }>("GET", `/konular${sorgu({ ...f })}`),
  konu: (konuId: number) => istek<PanelKonuDetay>("GET", `/konular/${konuId}`),
  mesajYaz: (konuId: number, metin: string, icNot: boolean, ekler?: EkGirdi[]) =>
    istek<PanelKonuDetay>("POST", `/konular/${konuId}/mesajlar`, { metin, icNot, ekler: ekler && ekler.length ? ekler : undefined }),
  ustlen: (konuId: number) => istek<PanelKonuDetay>("POST", `/konular/${konuId}/ustlen`, {}),
  aktar: (konuId: number, personelId: number | null) => istek<PanelKonuDetay | { aktarildi: true; gorunmuyor: true }>("POST", `/konular/${konuId}/aktar`, { personelId }),
  durum: (konuId: number, durum: "KAPALI" | "ACIK") => istek<PanelKonuDetay>("POST", `/konular/${konuId}/durum`, { durum }),
  telefonTalebi: (veri: { firmaId: number; kullaniciId?: number | null; baslik: string; metin: string; talepTuru?: TalepTuru; oncelik?: Oncelik }) =>
    istek<PanelKonuDetay>("POST", "/talepler", veri),

  bildirimler: async () => ({ satirlar: await istek<KonuOzet[]>("GET", "/bildirimler"), kurulu: true }),
  bildirimHedefleri: () => istek<DestekHedefSecenekleri>("GET", "/hedefler"),
  bildirimDetay: (konuId: number) => istek<PanelKonuDetay>("GET", `/konular/${konuId}`) as unknown as Promise<DestekKonuDetay>,
  bildirimOlustur: (veri: BildirimGirdi) => istek<PanelKonuDetay>("POST", "/bildirimler", veri),
  bildirimGuncelle: (konuId: number, veri: BildirimGirdi) => istek<PanelKonuDetay>("PUT", `/bildirimler/${konuId}`, veri),
  bildirimGeriCek: (konuId: number) => istek<PanelKonuDetay>("POST", `/bildirimler/${konuId}/geri-cek`, {}),

  musteriler: (arama?: string) => istek<FirmaKarti[]>("GET", `/musteriler${sorgu({ arama })}`),
  musteri: (firmaId: number) => istek<{ firma: FirmaKarti; kullanicilar: MusteriKullanici[]; talepler: PanelKonu[] }>("GET", `/musteriler/${firmaId}`),

  hizliCevaplar: (hepsi = false) => istek<HizliCevap[]>("GET", `/hizli-cevaplar${hepsi ? "?hepsi=1" : ""}`),
  hizliCevapYaz: (c: { cevapId?: number | null; baslik: string; metin: string; sira?: number; aktif?: boolean }) => istek<HizliCevap[]>("POST", "/hizli-cevaplar", c),

  ekip: () => istek<EkipUyesi[]>("GET", "/ekip"),
  personel: () => istek<PersonelDto[]>("GET", "/personel"),
  personelEkle: (veri: { kullaniciAdi: string; adSoyad: string; rol: PersonelRol; gorme: PersonelGorme }) =>
    istek<{ personelId: number; geciciSifre: string }>("POST", "/personel", veri),
  personelGuncelle: (personelId: number, veri: { adSoyad?: string; rol?: PersonelRol; gorme?: PersonelGorme; durum?: "AKTIF" | "PASIF" }) =>
    istek<PersonelDto[]>("PUT", `/personel/${personelId}`, veri),
  personelSifreSifirla: (personelId: number) => istek<{ geciciSifre: string }>("POST", `/personel/${personelId}/sifre-sifirla`, {}),
  personelKilitAc: (personelId: number) => istek<PersonelDto[]>("POST", `/personel/${personelId}/kilit-ac`, {}),

  rapor: (bas: string, bit: string) =>
    istek<{ satirlar: RaporSatiri[]; genel: { havuz: number; acik: number; yeni: number; kapanan: number; ortIlkCevapDk: number | null } }>("GET", `/rapor${sorgu({ bas, bit })}`),

  /** Ek görsel (Authorization ile); nesne adresi döner */
  ekAdresi: async (ekId: number) => {
    const token = tokenOku();
    const r = await fetch(`${API_KOK}/ek/${ekId}`, { headers: token ? { Authorization: `Bearer ${token}` } : {}, cache: "no-store" });
    if (!r.ok) throw new PanelApiHatasi(r.status, "Görsel alınamadı.");
    return URL.createObjectURL(await r.blob());
  },
};

/** Bildirimler ekranı (admin panelinden ortak sayfa) için uç takımı */
export const panelBildirimApi = {
  bildirimler: panelApi.bildirimler,
  bildirimHedefleri: panelApi.bildirimHedefleri,
  destekKonu: panelApi.bildirimDetay,
  bildirimOlustur: panelApi.bildirimOlustur,
  bildirimGuncelle: panelApi.bildirimGuncelle,
  bildirimGeriCek: panelApi.bildirimGeriCek,
};

/** Dosyayı base64'e çevirir (data: öneki olmadan). */
export const dosyaBase64 = (dosya: File): Promise<string> =>
  new Promise((coz, red) => {
    const o = new FileReader();
    o.onload = () => coz(String(o.result).split(",")[1] || "");
    o.onerror = () => red(new Error("Dosya okunamadı."));
    o.readAsDataURL(dosya);
  });
