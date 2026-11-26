import React from "react";
import { IconBell, IconUsers } from "@tabler/icons-react";
import { MasaDurumu, MasaOzeti } from "../../services/adisyonService";
import { para } from "../../services/ticariService";
import { masaGorunumu, sureYaz } from "../../../Backend/src/services/adisyon/adisyonHesap";

/** Masa kutusu renkleri (TA26): boş / dolu / hesap istendi — temanın ezmemesi için sabit renk */
export const MASA_RENK = {
  bos: { zemin: "#ffffff", kenar: "#cbd5e1", yazi: "#334155", ad: "Boş" },
  dolu: { zemin: "#e0f2fe", kenar: "#0284c7", yazi: "#0c4a6e", ad: "Dolu" },
  hesap: { zemin: "#fef3c7", kenar: "#d97706", yazi: "#78350f", ad: "Hesap istendi" },
} as const;


/** Masa ızgarası (PC ve garson ekranı ortak) */
export const MasaIzgarasi: React.FC<{ durum: MasaDurumu; bolge: number | "tumu"; onSec: (m: MasaOzeti) => void; buyuk?: boolean }> = ({ durum, bolge, onSec, buyuk }) => {
  const masalar = durum.bolgeler.filter((b) => bolge === "tumu" || b.bolgeId === bolge);
  return (
    <div className="d-flex flex-column gap-3">
      {masalar.map((b) => (
        <div key={b.bolgeId}>
          {bolge === "tumu" && <div className="fw-bold small text-muted mb-1">{b.ad}</div>}
          {!b.masalar.length && <div className="small text-muted fst-italic">Bu bölgede masa yok (Adisyon › Tanımlar'dan eklenir).</div>}
          <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fill, minmax(${buyuk ? 104 : 128}px, 1fr))`, gap: 10 }}>
            {b.masalar.map((m) => {
              const g = masaGorunumu(m.adisyon?.durum ?? null);
              const r = MASA_RENK[g];
              return (
                <button key={m.masaId} type="button" onClick={() => onSec(m)} aria-label={`Masa ${m.ad} ${r.ad}${m.adisyon ? ` ${para(m.adisyon.toplam)} TL` : ""}`}
                  style={{ minHeight: buyuk ? 96 : 104, borderRadius: 12, border: `2px solid ${r.kenar}`, background: r.zemin, color: r.yazi, padding: "6px 8px", textAlign: "left", boxShadow: "0 1px 3px rgba(0,0,0,.06)" }}>
                  <div className="d-flex align-items-start">
                    <span className="fw-bold" style={{ fontSize: buyuk ? 20 : 22, lineHeight: 1 }}>{m.ad}</span>
                    {m.adisyon?.kisiSayisi ? <span className="ms-auto small d-flex align-items-center gap-1"><IconUsers size={12} />{m.adisyon.kisiSayisi}</span> : m.kisi ? <span className="ms-auto small" style={{ opacity: 0.6 }}>{m.kisi} kişilik</span> : null}
                  </div>
                  {m.adisyon ? (
                    <>
                      {!!m.adisyon.hazirSayisi && <div className="d-flex align-items-center gap-1 mt-1" style={{ background: "#16a34a", color: "#fff", borderRadius: 6, padding: "0 6px", fontSize: 12, fontWeight: 700, width: "fit-content" }}><IconBell size={12} />{m.adisyon.hazirSayisi} hazır</div>}
                      <div className="fw-bold mt-1" style={{ fontSize: buyuk ? 15 : 16 }}>{para(m.adisyon.toplam)} TL</div>
                      <div className="small d-flex justify-content-between" style={{ opacity: 0.85 }}><span>{sureYaz(m.adisyon.acikDakika)}</span>{m.adisyon.garson && <span className="text-truncate ms-1">{m.adisyon.garson}</span>}</div>
                    </>
                  ) : (
                    <div className="small mt-3" style={{ opacity: 0.55 }}>Boş</div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};
