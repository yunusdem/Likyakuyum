import type { EbelgeSatir } from "../../services/ebelgeService";

/**
 * Fatura formundaki tutar önizlemesi. Backend'deki `hesapla` (Backend/src/services/ice/ubl/invoiceBuilder.ts) ile
 * birebir aynı kuralları uygular; ekranda görülen tutar kesilen faturadaki tutardır:
 *  - elle girilen iskonto tutarı orandan önce gelir,
 *  - özel matrahlı satırda KDV, girilen özel matrah üzerinden hesaplanır,
 *  - tevkifat KDV tutarı üzerinden hesaplanır ve ödenecek tutardan düşülür.
 * Seçili fatura tipine ait olmayan alanlar (tip değişince satırda kalan tevkifat / özel matrah) hesaba katılmaz,
 * gönderimde de ayıklandıkları için.
 */

export interface FaturaHesapSecenek {
  tevkifatli: boolean;
  ozelMatrahli: boolean;
}

export interface SatirTutari {
  brut: number;
  iskonto: number;
  matrah: number;
  kdvMatrahi: number;
  kdvOrani: number;
  kdv: number;
  tevkifat: number;
  /** matrah + KDV */
  vergilerDahil: number;
}

export interface FaturaTutari {
  satirlar: SatirTutari[];
  brut: number;
  iskonto: number;
  matrah: number;
  kdv: number;
  kdvKirilim: { oran: number; matrah: number; vergi: number }[];
  tevkifat: number;
  vergilerDahil: number;
  odenecek: number;
}

const yuvarla = (n: number) => Math.round(n * 100) / 100;

/**
 * 555 "KDV Oran Kontrolüne Tabi Olmayan Satışlar" hangi faturada kullanılabilir — GİB schematron'u ile birebir
 * (backend: invoiceBuilder.kod555Kullanilabilir). Yalnız Temel / Ticari / e-Arşiv; İstisna, İhraç Kayıtlı ve
 * e-Arşiv YTB tiplerinde kullanılamaz.
 */
export const kod555Kullanilabilir = (senaryo: string, faturaTipi: string): boolean =>
  ["TEMELFATURA", "TICARIFATURA", "EARSIVFATURA"].includes(senaryo) &&
  faturaTipi !== "ISTISNA" &&
  faturaTipi !== "IHRACKAYITLI" &&
  !(senaryo === "EARSIVFATURA" && faturaTipi.startsWith("YTB"));

export const satirTutari = (s: EbelgeSatir, sec: FaturaHesapSecenek): SatirTutari => {
  const brut = yuvarla((s.miktar || 0) * (s.birimFiyat || 0));
  const iskonto = s.iskontoTutari != null ? yuvarla(s.iskontoTutari) : yuvarla((brut * (s.iskontoOrani || 0)) / 100);
  const matrah = yuvarla(brut - iskonto);
  const kdvMatrahi = sec.ozelMatrahli && s.ozelMatrahKodu?.trim() ? yuvarla(s.ozelMatrahTutari || 0) : matrah;
  const kdvOrani = s.kdvOrani || 0;
  const kdv = yuvarla((kdvMatrahi * kdvOrani) / 100);
  const tevkifat = sec.tevkifatli ? yuvarla((kdv * (s.tevkifatOrani || 0)) / 100) : 0;
  return { brut, iskonto, matrah, kdvMatrahi, kdvOrani, kdv, tevkifat, vergilerDahil: yuvarla(matrah + kdv) };
};

export const faturaTutari = (satirlar: EbelgeSatir[], sec: FaturaHesapSecenek): FaturaTutari => {
  const hesap = satirlar.map((s) => satirTutari(s, sec));
  const topla = (f: (h: SatirTutari) => number) => yuvarla(hesap.reduce((t, h) => t + f(h), 0));

  const kirilim = new Map<number, { oran: number; matrah: number; vergi: number }>();
  for (const h of hesap) {
    const m = kirilim.get(h.kdvOrani) || { oran: h.kdvOrani, matrah: 0, vergi: 0 };
    kirilim.set(h.kdvOrani, { oran: h.kdvOrani, matrah: yuvarla(m.matrah + h.kdvMatrahi), vergi: yuvarla(m.vergi + h.kdv) });
  }

  const matrah = topla((h) => h.matrah);
  const kdv = topla((h) => h.kdv);
  const tevkifat = topla((h) => h.tevkifat);
  const vergilerDahil = yuvarla(matrah + kdv);
  return {
    satirlar: hesap,
    brut: topla((h) => h.brut),
    iskonto: topla((h) => h.iskonto),
    matrah,
    kdv,
    kdvKirilim: [...kirilim.values()].sort((a, b) => a.oran - b.oran),
    tevkifat,
    vergilerDahil,
    odenecek: yuvarla(vergilerDahil - tevkifat),
  };
};
