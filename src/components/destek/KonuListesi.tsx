import React from "react";
import { Badge } from "react-bootstrap";
import { IconAlertTriangle, IconBell, IconCloudOff, IconMessage2, IconServerBolt, IconSpeakerphone } from "@tabler/icons-react";
import { DURUM_ADI, DURUM_RENGI, KonuOzet, konuEtiketi, zamanOnce } from "../../services/destekService";

/** Zil paneli ve Destek sayfasının ortak konu listesi (yeniden eskiye, okunmamışlar kalın). */
export const KonuIkonu: React.FC<{ konu: KonuOzet }> = ({ konu }) => {
  if (konu.tur === "TALEP") return <IconMessage2 size={18} />;
  if (konu.tur === "SISTEM") return <IconServerBolt size={18} />;
  if (konu.onemli) return <IconAlertTriangle size={18} className="text-danger" />;
  if (konu.bildirimTuru === "DUYURU") return <IconSpeakerphone size={18} />;
  return <IconBell size={18} />;
};

interface Props {
  konular: KonuOzet[];
  seciliId?: number | null;
  onSec: (konu: KonuOzet) => void;
  bosMetin?: string;
}

const KonuListesi: React.FC<Props> = ({ konular, seciliId, onSec, bosMetin = "Kayıt yok." }) => {
  if (konular.length === 0) return <div className="text-center text-secondary small py-5">{bosMetin}</div>;
  return (
    <div className="destek-liste">
      {konular.map((k) => (
        <div
          key={k.konuId}
          role="button"
          tabIndex={0}
          className={`destek-satir${k.okunmamis ? " okunmamis" : ""}${seciliId === k.konuId ? " secili" : ""}`}
          onClick={() => onSec(k)}
          onKeyDown={(e) => e.key === "Enter" && onSec(k)}
        >
          <div className="destek-ikon">
            <KonuIkonu konu={k} />
          </div>
          <div className="destek-govde">
            <div className="destek-baslik" title={k.baslik}>
              {k.baslik}
            </div>
            {k.sonMesaj && (
              <div className="destek-ozet">
                {k.sonMesajTaraf === "KULLANICI" ? "Siz: " : ""}
                {k.sonMesaj}
              </div>
            )}
            <div className="destek-alt">
              <span>{konuEtiketi(k)}</span>
              {k.tur === "TALEP" && (
                <Badge bg={DURUM_RENGI[k.durum]} className="fw-normal">
                  {DURUM_ADI[k.durum]}
                </Badge>
              )}
              {k.oncelik === "ACIL" && k.tur === "TALEP" && (
                <Badge bg="danger" className="fw-normal">
                  Acil
                </Badge>
              )}
              {k.bekliyor && (
                <span className="text-warning d-inline-flex align-items-center gap-1" title="İnternet bağlanınca gönderilecek">
                  <IconCloudOff size={12} /> bekliyor
                </span>
              )}
              <span className="ms-auto">{zamanOnce(k.sonMesajTarihi)}</span>
            </div>
          </div>
          {k.okunmamis && <div className="destek-nokta" />}
        </div>
      ))}
    </div>
  );
};

export default KonuListesi;
