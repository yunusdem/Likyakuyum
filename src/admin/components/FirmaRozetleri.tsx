import React from "react";
import { Badge } from "react-bootstrap";
import { FirmaDto, FirmaDurum, gunYaz } from "../services/adminApi";

export const DURUM_ETIKETI: Record<FirmaDurum, string> = {
  AKTIF: "Aktif",
  DONDURULMUS: "Dondurulmuş",
  PASIF: "Pasif",
  SILINECEK: "Silinecek",
  SILINDI: "Silindi",
};

const DURUM_RENGI: Record<FirmaDurum, string> = {
  AKTIF: "success",
  DONDURULMUS: "warning",
  PASIF: "secondary",
  SILINECEK: "danger",
  SILINDI: "dark",
};

/**
 * "Kullanıcı N / L": kurulum (exe) firmasında N programın son bildirdiği sayıdır (merkezde hesabı yoktur). Sayı limiti
 * aşarsa kırmızı uyarı: kurulumda kullanıcılar müşterinin veritabanındadır, limit dışı eklenmiş olabilir.
 */
export const KullaniciSayisi: React.FC<{
  firma: Pick<FirmaDto, "kullaniciSayisi" | "aktifLisans" | "baglantiModu" | "sonGorulme">;
  etiket?: boolean;
}> = ({ firma, etiket }) => {
  const limit = firma.aktifLisans?.kullaniciLimiti ?? null;
  const asim = limit !== null && firma.kullaniciSayisi > limit;
  const kurulum = firma.baglantiModu === "setup";
  return (
    <span
      className={asim ? "small fw-semibold text-danger" : "text-muted small"}
      title={
        kurulum
          ? firma.sonGorulme
            ? "Programın son bildirdiği kullanıcı sayısı"
            : "Program henüz merkeze bildirim göndermedi"
          : undefined
      }
    >
      {etiket && "Kullanıcı: "}
      {kurulum && !firma.sonGorulme ? "-" : firma.kullaniciSayisi}
      {limit !== null ? ` / ${limit}` : ""}
      {asim && <Badge bg="danger" className="ms-1">Limit aşıldı</Badge>}
    </span>
  );
};

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

/** E-posta doğrulaması: doğrulandı / mail gönderildi, bekleniyor / doğrulanmadı */
export const EpostaRozeti: React.FC<{ firma: Pick<FirmaDto, "eposta" | "epostaDogrulandi" | "epostaBaglantiBitis"> }> = ({ firma }) => {
  if (firma.epostaDogrulandi) return <Badge bg="success">E-posta doğrulandı</Badge>;
  if (!firma.eposta) return <Badge bg="light" text="dark">E-posta yok</Badge>;
  if (firma.epostaBaglantiBitis)
    return (
      <Badge bg="warning" text="dark">
        E-posta: yanıt bekleniyor
      </Badge>
    );
  return <Badge bg="secondary">E-posta doğrulanmadı</Badge>;
};

export const DogrulamaRozeti: React.FC<{ dogrulandi: boolean }> = ({ dogrulandi }) =>
  dogrulandi ? <Badge bg="success">Doğrulandı</Badge> : <Badge bg="secondary">Doğrulanmadı</Badge>;
