import type { PiyasaKaynagi } from "../tipler.js";
import { HaremKaynak } from "./harem.js";
import { KapalicarsiKaynak } from "./kapalicarsi.js";
import { ZileKaynak } from "./zile.js";
import { AhlatciKaynak } from "./ahlatci.js";
import { AltinkaynakKaynak } from "./altinkaynak.js";
import { DovizcomKaynak } from "./dovizcom.js";
import { HakanKaynak } from "./hakan.js";
import { OzbagKaynak } from "./ozbag.js";

/** Tüm siteler (Kur Kaynağı seçimi bu listeden). Yeni site: bağdaştırıcı dosyası + buraya bir satır. */
export const KAYNAKLAR: PiyasaKaynagi[] = [
  new HaremKaynak(),
  new KapalicarsiKaynak(),
  new ZileKaynak(),
  new AhlatciKaynak(),
  new AltinkaynakKaynak(),
  new DovizcomKaynak(),
  new HakanKaynak(),
  new OzbagKaynak(),
];

/** Piyasa ekranında gösterilmeyen siteler; Kur Kaynağı olarak seçilebilir kalır */
const PANODA_YOK = new Set(["dovizcom"]);

export const panodaMi = (kod: string): boolean => !PANODA_YOK.has(kod);

/** Piyasa ekranındaki siteler, ekrandaki sırayla */
export const PANO_KAYNAKLARI: PiyasaKaynagi[] = KAYNAKLAR.filter((k) => panodaMi(k.kod));
