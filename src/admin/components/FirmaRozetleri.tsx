import React from "react";
import { Badge } from "react-bootstrap";
import { FirmaDto, FirmaDurum, gunYaz } from "../services/adminApi";

export const DURUM_ETIKETI: Record<FirmaDurum, string> = {
  AKTIF: "Aktif",
  DONDURULMUS: "Dondurulmuş",
  PASIF: "Pasif",
};

const DURUM_RENGI: Record<FirmaDurum, string> = { AKTIF: "success", DONDURULMUS: "warning", PASIF: "secondary" };

export const DurumRozeti: React.FC<{ durum: FirmaDurum }> = ({ durum }) => (
  <Badge bg={DURUM_RENGI[durum]} text={durum === "DONDURULMUS" ? "dark" : undefined}>
    {DURUM_ETIKETI[durum]}
  </Badge>
);

export const LisansRozeti: React.FC<{ firma: Pick<FirmaDto, "lisansDurumu" | "lisansKalanGun" | "aktifLisans"> }> = ({
  firma,
}) => {
  const bitis = gunYaz(firma.aktifLisans?.bitis);
  switch (firma.lisansDurumu) {
    case "YOK":
      return <Badge bg="secondary">Lisans yok</Badge>;
    case "BITMIS":
      return <Badge bg="danger">Bitti: {bitis}</Badge>;
    case "YAKINDA":
      return (
        <Badge bg="warning" text="dark">
          {bitis} ({firma.lisansKalanGun} gün)
        </Badge>
      );
    default:
      return <Badge bg="success">{bitis}</Badge>;
  }
};

export const DogrulamaRozeti: React.FC<{ dogrulandi: boolean }> = ({ dogrulandi }) =>
  dogrulandi ? <Badge bg="success">Doğrulandı</Badge> : <Badge bg="secondary">Doğrulanmadı</Badge>;
