import React, { useEffect, useState } from "react";
import { EkDto, MesajDto, zamanYaz } from "./destekOrtak";

/** Sohbet balonu ve ek görseli: kullanıcı ve admin tarafında ortak (servis bağımsız; görsel adresi dışarıdan verilir). */

export const EkGorsel: React.FC<{ ek: EkDto; adres: (ekId: number) => Promise<string> }> = ({ ek, adres }) => {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let aktif = true;
    if (!ek.silindi) adres(ek.ekId).then((u) => aktif && setSrc(u)).catch(() => undefined);
    return () => {
      aktif = false;
    };
  }, [ek.ekId, ek.silindi, adres]);
  if (ek.silindi) return <span className="destek-ek-silindi">görsel silindi</span>;
  if (!src) return <span className="destek-ek-silindi">{ek.dosyaAdi}</span>;
  return <img src={src} alt={ek.dosyaAdi} title={ek.dosyaAdi} onClick={() => window.open(src, "_blank")} />;
};

export const MesajBalonu: React.FC<{ m: MesajDto; benimTaraf: "KULLANICI" | "ADMIN"; adres: (ekId: number) => Promise<string> }> = ({ m, benimTaraf, adres }) => {
  const sinif = m.gonderenTur === "SISTEM" ? "sistem" : m.icNot ? "ben ic-not" : m.gonderenTur === benimTaraf ? "ben" : "karsi";
  const kim = m.gonderenTur === "ADMIN" ? m.gonderenAd || "Destek" : m.gonderenAd || "Kullanıcı";
  return (
    <div className={`destek-balon ${sinif}`}>
      {m.gonderenTur !== "SISTEM" && (
        <div className="destek-balon-kim">
          {m.icNot ? "İç not · " : ""}
          {kim}
        </div>
      )}
      <div>{m.metin}</div>
      {m.ekler.length > 0 && (
        <div className="destek-ekler">
          {m.ekler.map((e) => (
            <EkGorsel key={e.ekId} ek={e} adres={adres} />
          ))}
        </div>
      )}
      <div className="destek-balon-zaman">{zamanYaz(m.tarih)}</div>
    </div>
  );
};
