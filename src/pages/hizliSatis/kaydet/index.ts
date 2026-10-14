import type { HizliSatisModul } from "../../../../Backend/src/services/hizliSatis/hizliSatisKural";
import type { KaydetBaglami, KaydetSonucu } from "./tipler";
import { perakendeKaydet } from "./perakende";
import { ticariKaydet } from "./ticari";
import { sarrafKaydet } from "./sarraf";
import { dovizKaydet } from "./doviz";

/** Her modül kendi mevcut kayıt ucuyla kaydeder (docs/HIZLI_SATIS_YOL_HARITASI.md, U3) */
type Kaydedici = (b: KaydetBaglami) => Promise<KaydetSonucu>;

export const KAYDEDICILER: Record<HizliSatisModul, Kaydedici> = {
  perakende: perakendeKaydet,
  ticari: ticariKaydet,
  sarraf: sarrafKaydet,
  doviz: dovizKaydet,
};
