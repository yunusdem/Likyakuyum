import type { PiyasaKaynagi } from "../tipler.js";
import { HaremKaynak } from "./harem.js";
import { KapalicarsiKaynak } from "./kapalicarsi.js";
import { ZileKaynak } from "./zile.js";
import { AhlatciKaynak } from "./ahlatci.js";
import { AltinkaynakKaynak } from "./altinkaynak.js";
import { DovizcomKaynak } from "./dovizcom.js";
import { HakanKaynak } from "./hakan.js";

/** Panodaki sıra. Yeni site: bağdaştırıcı dosyası + buraya bir satır. */
export const KAYNAKLAR: PiyasaKaynagi[] = [
  new HaremKaynak(),
  new KapalicarsiKaynak(),
  new ZileKaynak(),
  new AhlatciKaynak(),
  new AltinkaynakKaynak(),
  new DovizcomKaynak(),
  new HakanKaynak(),
];
