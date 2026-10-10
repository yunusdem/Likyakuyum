import React from "react";
import type { Urun } from "../veri/urunler";
import { urunStili } from "./UrunStil";

/** Ürünün temsili program ekranı (K7): HTML ile çizilir, veriler örnektir. */
export const TemsiliEkran: React.FC<{ urun: Urun }> = ({ urun }) => {
  const e = urun.ekran;
  return (
    <figure className="ekran" style={urunStili(urun)} aria-label={`${urun.ad} temsili ekran: ${e.baslik}`}>
      <div className="ekran-ust" aria-hidden="true">
        <i />
        <i />
        <i />
        <span>{urun.ad} · {e.baslik}</span>
      </div>
      <div className="ekran-govde">
        <div className="ekran-yan" aria-hidden="true">
          <b>{urun.ad}</b>
          {e.menu.map((m, i) => (
            <span key={m} className={i === 0 ? "aktif" : undefined}>
              {m}
            </span>
          ))}
        </div>
        <div className="ekran-icerik">
          <h5>{e.baslik}</h5>
          <div className="ekran-kpi">
            {e.kpi.map((k) => (
              <div key={k.etiket}>
                <small>{k.etiket}</small>
                <strong>
                  {k.deger}
                  {k.not && <em>{k.not}</em>}
                </strong>
              </div>
            ))}
          </div>
          <table className="ekran-tablo">
            <thead>
              <tr>
                {e.tabloBaslik.map((b) => (
                  <th key={b} scope="col">
                    {b}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {e.satirlar.map((s) => (
                <tr key={s.join("|")}>
                  {s.map((h, i) => (
                    <td key={i}>{h}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <figcaption className="ekran-not">Temsili ekran</figcaption>
    </figure>
  );
};

export default TemsiliEkran;
