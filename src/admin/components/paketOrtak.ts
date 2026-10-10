import { adminApi, PaketListesi } from "../services/adminApi";
import { modulKatalogu } from "../../config/modulKatalogu";
import { ilkPaketIcerigi } from "../../config/urunPaketleri";

/**
 * Paket listesini getirir. Paketler merkezde henüz hiç doldurulmamışsa (betik yeni çalıştırıldı) önce katalog eşitlenir,
 * sonra menüden üretilen ilk içerik bir kez gönderilir (docs/LISANS_URUN_PAKETLERI.md §3.1). Sonraki çağrılarda yalnız okur.
 */
export const paketleriHazirla = async (): Promise<PaketListesi> => {
  const liste = await adminApi.paketler();
  if (!liste.kurulu || liste.paketler.every((p) => p.hepsi || p.ilkIcerik)) return liste;
  const katalog = await adminApi.modulKatalogEsitle(modulKatalogu());
  return adminApi.paketIlkIcerik(ilkPaketIcerigi(katalog));
};

/** Lisans penceresinde seçilebilen ürünler (çekirdek hariç), paket sırasıyla */
export const secilebilirUrunler = (liste: PaketListesi | null) => (liste?.kurulu ? liste.paketler.filter((p) => !p.cekirdek) : []);

export const URUN_ROZET_RENGI: Record<string, string> = {
  kuyum: "#b7791f",
  doviz: "#047857",
  gumus: "#4a6a8a",
  ticari: "#c2410c",
  connector: "#0e7490",
  erp: "#4f46e5",
};
