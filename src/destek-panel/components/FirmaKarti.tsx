import React from "react";
import { Badge } from "react-bootstrap";
import { IconChevronDown, IconChevronUp } from "@tabler/icons-react";
import { FirmaKarti } from "../services/panelApi";

const iki = (n: number) => String(n).padStart(2, "0");
export const tarihYaz = (z: string | null | undefined): string => {
  if (!z) return "-";
  const d = new Date(z);
  if (isNaN(d.getTime())) return String(z);
  return `${iki(d.getDate())}.${iki(d.getMonth() + 1)}.${d.getFullYear()}`;
};

const MOD_ADI: Record<string, string> = { cloud: "Bulut", local: "Yerel köprü", setup: "Kurulum (exe)" };
const DURUM_RENK: Record<string, string> = { AKTIF: "success", DONDURULMUS: "warning", PASIF: "secondary" };

/** Lisans bitişine kalan gün (negatif: geçmiş) */
const kalanGun = (z: string | null): number | null => {
  if (!z) return null;
  const d = new Date(z);
  if (isNaN(d.getTime())) return null;
  const bugun = new Date();
  bugun.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - bugun.getTime()) / 86_400_000);
};

/** Salt okunur firma kartı (D12). */
const FirmaKartiGoster: React.FC<{ firma: FirmaKarti; acik?: boolean; onDegis?: () => void; katlanmaz?: boolean }> = ({ firma, acik = true, onDegis, katlanmaz }) => {
  const kalan = kalanGun(firma.lisansBitis);
  return (
    <div className="dsp-firma-karti">
      {!katlanmaz && (
        <button type="button" className="dsp-firma-karti-ac" onClick={onDegis}>
          Firma bilgisi {acik ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
        </button>
      )}
      {(acik || katlanmaz) && (
        <div className="dsp-firma-karti-govde">
          <div>
            <span>Firma</span>
            <strong>{firma.unvan}</strong>
          </div>
          <div>
            <span>Müşteri no</span>
            {firma.musteriNo || "-"} <small className="text-muted">({firma.firmaKodu})</small>
          </div>
          <div>
            <span>Telefon</span>
            {firma.telefon ? <a href={`tel:${firma.telefon}`}>{firma.telefon}</a> : "-"}
          </div>
          <div>
            <span>Yetkili</span>
            {firma.yetkili || "-"}
          </div>
          <div>
            <span>Paket</span>
            {firma.paket || "-"}
          </div>
          <div>
            <span>Lisans bitişi</span>
            {tarihYaz(firma.lisansBitis)}{" "}
            {kalan !== null && (
              <Badge bg={kalan < 0 ? "danger" : kalan <= 30 ? "warning" : "light"} text={kalan >= 0 && kalan > 30 ? "dark" : undefined} className="fw-normal">
                {kalan < 0 ? "bitti" : `${kalan} gün`}
              </Badge>
            )}
          </div>
          <div>
            <span>Çalışma</span>
            {MOD_ADI[firma.baglantiModu] || firma.baglantiModu}
            {firma.surum ? <small className="text-muted"> · {firma.surum}</small> : null}
          </div>
          <div>
            <span>Durum</span>
            <Badge bg={DURUM_RENK[firma.durum] || "secondary"} className="fw-normal">
              {firma.durum}
            </Badge>
            <small className="text-muted ms-1">
              {firma.kullaniciSayisi} kullanıcı · {firma.acikTalep} açık talep
            </small>
          </div>
        </div>
      )}
    </div>
  );
};

export default FirmaKartiGoster;
