import { useEffect, useState } from "react";
import { HizliSatisService } from "../../services/hizliSatisService";
import type { HizliSatisModul } from "../../../Backend/src/services/hizliSatis/hizliSatisKural";

/** Fiş listelerinde "Hızlı Satış" süzgeci (docs/HIZLI_SATIS_YOL_HARITASI.md, H20): verilen fişlerden hızlı satıştan gelenler */
export function useHizliSatisIsaretleri(modul: HizliSatisModul, fisIdler: number[]): Set<number> {
  const [kume, setKume] = useState<Set<number>>(new Set());
  const anahtar = fisIdler.join(",");
  useEffect(() => {
    let iptal = false;
    const idler = anahtar ? anahtar.split(",").map(Number).filter((x) => x > 0) : [];
    if (!idler.length) { setKume(new Set()); return; }
    HizliSatisService.isaretliler(modul, idler)
      .then((l) => { if (!iptal) setKume(new Set(l)); })
      .catch(() => { if (!iptal) setKume(new Set()); });
    return () => { iptal = true; };
  }, [modul, anahtar]);
  return kume;
}

export type KaynakSuzgeci = "all" | "hizli" | "diger";
export const kaynakUyar = (s: KaynakSuzgeci, hizli: boolean) => s === "all" || (s === "hizli") === hizli;
