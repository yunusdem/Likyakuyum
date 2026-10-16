import { useEffect, useState } from "react";
import { HizliSatisService } from "../../services/hizliSatisService";
import type { HizliSatisModul } from "../../../Backend/src/services/hizliSatis/hizliSatisKural";
import { useAuth } from "../../context/AuthContext";
import { acikHizliSatisModulleri } from "../../config/hizliSatis";

/** Modülün hızlı satışı firmanın lisansında açık mı (kapalıysa listelerde süzgeç ve "Hızlı" rozeti çizilmez) */
export function useHizliSatisAcik(modul: HizliSatisModul): boolean {
  const { user } = useAuth();
  return acikHizliSatisModulleri(user?.merkez?.moduller).includes(modul);
}

/**
 * Fiş listelerinde "Hızlı Satış" süzgeci (docs/HIZLI_SATIS_YOL_HARITASI.md, H20): verilen fişlerden hızlı satıştan gelenler.
 * Modülün hızlı satışı lisansta kapalıysa sunucuya sorulmaz, boş döner.
 */
export function useHizliSatisIsaretleri(modul: HizliSatisModul, fisIdler: number[]): Set<number> {
  const acik = useHizliSatisAcik(modul);
  const [kume, setKume] = useState<Set<number>>(new Set());
  const anahtar = fisIdler.join(",");
  useEffect(() => {
    let iptal = false;
    const idler = acik && anahtar ? anahtar.split(",").map(Number).filter((x) => x > 0) : [];
    if (!idler.length) { setKume(new Set()); return; }
    HizliSatisService.isaretliler(modul, idler)
      .then((l) => { if (!iptal) setKume(new Set(l)); })
      .catch(() => { if (!iptal) setKume(new Set()); });
    return () => { iptal = true; };
  }, [modul, anahtar, acik]);
  return kume;
}

export type KaynakSuzgeci = "all" | "hizli" | "diger";
export const kaynakUyar = (s: KaynakSuzgeci, hizli: boolean) => s === "all" || (s === "hizli") === hizli;
