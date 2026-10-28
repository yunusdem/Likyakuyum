import React, { useState } from "react";
import { Button, Spinner } from "react-bootstrap";
import { IconBuildingBank } from "@tabler/icons-react";
import { GibDegerleri, GibDoldurmaSonucu, gibSorgulaVeDoldur } from "../../utils/gibSorgu";
import { gibService, VknSorguSonucu } from "../../services/gibService";

/** Kullanıcı uygulamasının GİB sorgusu: sorgular, boşları doldurur, farkı sorar */
export const gibSorgula = (p: Omit<Parameters<typeof gibSorgulaVeDoldur>[0], "sorgu">) =>
  gibSorgulaVeDoldur({ ...p, sorgu: gibService.vknSorgu });

interface Props {
  no: string;
  mevcut: GibDegerleri;
  uygula: (degerler: GibDegerleri, sonuc: VknSorguSonucu) => string | void;
  onMesaj: (m: GibDoldurmaSonucu) => void;
  tekAdAlani?: boolean;
  size?: "sm" | "lg";
  disabled?: boolean;
}

/**
 * VKN/TCKN yanındaki "GİB'den Sorgula" düğmesi: unvan / ad-soyad / vergi dairesi / il / ilçeyi GİB'den getirir.
 * Sorgu yalnız düğmeye basınca yapılır (docs/GIB_BUTON_IL_ILCE_YOL_HARITASI.md K3).
 */
const GibSorguButonu: React.FC<Props> = ({ no, mevcut, uygula, onMesaj, tekAdAlani, size, disabled }) => {
  const [bekliyor, setBekliyor] = useState(false);
  const hane = no.replace(/\D/g, "").length;

  const sorgula = async () => {
    setBekliyor(true);
    try {
      onMesaj(await gibSorgula({ no, mevcut, uygula, tekAdAlani }));
    } finally {
      setBekliyor(false);
    }
  };

  return (
    <Button
      variant="outline-primary"
      size={size}
      onClick={() => void sorgula()}
      disabled={disabled || bekliyor || (hane !== 10 && hane !== 11)}
      title="Unvan / ad-soyad, vergi dairesi ve il / ilçeyi GİB'den getir"
      className="text-nowrap"
    >
      {bekliyor ? <Spinner size="sm" animation="border" /> : <IconBuildingBank size={16} />}
      <span className="ms-1">GİB</span>
    </Button>
  );
};

/**
 * Satış fişlerinde (Perakende / Sarraf / Döviz) TC kutusunda MASAK düğmesinin yanındaki küçük GİB düğmesi.
 * Sorguyu ekran kendisi yapar (yerel cari → e-Fatura listesi → GİB); bu düğme yalnız görünüm.
 */
export const GibFisDugmesi: React.FC<{ onClick: () => void; bekliyor: boolean; no: string; disabled?: boolean }> = ({
  onClick,
  bekliyor,
  no,
  disabled,
}) => {
  const hane = no.replace(/\D/g, "").length;
  return (
    <Button
      variant="outline-primary"
      size="sm"
      className="px-1.5 py-0 d-flex align-items-center justify-content-center border border-primary text-primary bg-white"
      onClick={onClick}
      disabled={disabled || bekliyor || (hane !== 10 && hane !== 11)}
      title="TC / VKN ile sorgula: kayıtlı cari, e-Fatura listesi ve GİB (ad, vergi dairesi, il / ilçe)"
      style={{ height: "26px", minWidth: "28px", fontSize: "10.5px", fontWeight: 700 }}
    >
      {bekliyor ? <Spinner size="sm" animation="border" style={{ width: 12, height: 12 }} /> : "GİB"}
    </Button>
  );
};

export default GibSorguButonu;
