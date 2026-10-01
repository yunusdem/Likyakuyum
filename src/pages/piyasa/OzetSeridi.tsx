import React from "react";
import type { PiyasaKaynak } from "../../services/piyasaService";
import Deger from "./Deger";
import { ORTAK_KALEMLER, SERIT_KALEMLERI, sayiYaz, type EnIyi, type OrtakDizin } from "./piyasaBicim";

interface Props {
  referans: PiyasaKaynak | undefined;
  dizin: OrtakDizin;
  enIyiler: Map<string, EnIyi>;
  parlat: boolean;
}

/**
 * Üst panodaki büyük rakamlar: seçili referans kaynağın satış fiyatı, altında alış,
 * en altta tüm görünen kaynakların satış aralığı ve referansın bu aralıktaki yeri.
 */
const OzetSeridi: React.FC<Props> = ({ referans, dizin, enIyiler, parlat }) => (
  <div className="pz-serit">
    {SERIT_KALEMLERI.map((kod) => {
      const kalem = ORTAK_KALEMLER.find((k) => k.kod === kod)!;
      const s = referans ? dizin.get(referans.kod)?.get(kod) : undefined;
      const e = enIyiler.get(kod);
      const aralik = e && e.minSatis !== null && e.maxSatis !== null && e.sayi >= 2 ? e.maxSatis - e.minSatis : 0;
      const konum = aralik > 0 && s?.satis != null && e?.minSatis != null ? ((s.satis - e.minSatis) / aralik) * 100 : 50;
      const ondalik = s?.ondalik ?? kalem.ondalik;
      return (
        <div key={kod} className={`pz-serit-oge ${s?.yon ? `pz-serit-${s.yon}` : ""}`}>
          <div className="pz-serit-ad">
            {kalem.ad}
            {s?.yon && <span className={`pz-serit-ok pz-${s.yon}`}>{s.yon === "yukari" ? "▲" : "▼"}</span>}
          </div>
          <Deger deger={s?.satis ?? null} ondalik={ondalik} yon={s?.yon} parlat={parlat} className="pz-serit-deger" />
          <div className="pz-serit-alt">
            <span>Alış</span>
            <Deger deger={s?.alis ?? null} ondalik={ondalik} parlat={false} />
          </div>
          {e && e.sayi >= 2 && (
            <div
              className="pz-serit-aralik"
              title={`${e.sayi} kaynakta satış: ${sayiYaz(e.minSatis, ondalik)} – ${sayiYaz(e.maxSatis, ondalik)}`}
            >
              <div className="pz-serit-cubuk">
                <span style={{ left: `${Math.min(100, Math.max(0, konum))}%` }} />
              </div>
              <div className="pz-serit-uclar">
                <span>{sayiYaz(e.minSatis, ondalik)}</span>
                <span>{sayiYaz(e.maxSatis, ondalik)}</span>
              </div>
            </div>
          )}
        </div>
      );
    })}
  </div>
);

export default OzetSeridi;
