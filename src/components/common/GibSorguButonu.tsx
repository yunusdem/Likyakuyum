import React, { useEffect, useRef, useState } from "react";
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

/** VKN/TCKN yanındaki "GİB'den Sorgula" düğmesi: unvan / ad-soyad / vergi dairesini GİB'den getirir. */
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
      title="Unvan / ad-soyad ve vergi dairesini GİB'den getir"
      className="text-nowrap"
    >
      {bekliyor ? <Spinner size="sm" animation="border" /> : <IconBuildingBank size={16} />}
      <span className="ms-1">GİB'den Sorgula</span>
    </Button>
  );
};

/**
 * Numara 10/11 haneye tamamlanınca (yazma durunca) GİB sorgusunu kendiliğinden bir kez çalıştırır.
 * Aynı numara tekrar sorulmaz; numara silinip yeniden yazılırsa sorulur.
 */
export const useGibOtomatikSorgu = (no: string, calistir: (no: string) => void, kapali = false) => {
  const son = useRef("");
  useEffect(() => {
    const n = no.replace(/\D/g, "");
    if (n.length < 10) son.current = "";
    if (kapali || (n.length !== 10 && n.length !== 11) || n === son.current) return;
    const t = setTimeout(() => {
      son.current = n;
      calistir(n);
    }, 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [no, kapali]);
};

export default GibSorguButonu;
