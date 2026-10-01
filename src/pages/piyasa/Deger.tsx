import React from "react";
import type { PiyasaYon } from "../../services/piyasaService";
import { sayiYaz } from "./piyasaBicim";

interface Props {
  deger: number | null | undefined;
  ondalik: number;
  yon?: PiyasaYon;
  /** İlk yüklemede parlama olmasın */
  parlat: boolean;
  className?: string;
  title?: string;
}

/**
 * Fiyat hücresi. Değer değişince span yeniden oluşur (key = değer) ve CSS animasyonu
 * yön rengiyle bir kez parlar; değer aynı kaldıkça hiçbir şey olmaz.
 */
const Deger: React.FC<Props> = ({ deger, ondalik, yon, parlat, className = "", title }) => (
  <span
    key={deger ?? "bos"}
    className={`pz-deger ${parlat && yon ? `pz-parla-${yon}` : ""} ${className}`}
    title={title}
  >
    {sayiYaz(deger, ondalik)}
  </span>
);

export default Deger;
