import React from "react";
import type { PiyasaKaynak } from "../../services/piyasaService";
import Deger from "./Deger";
import { ORTAK_KALEMLER, kaynakGorunum, sayiYaz, suzgeceUyar, type EnIyi, type OrtakDizin, type Suzgec } from "./piyasaBicim";

interface Props {
  kaynaklar: PiyasaKaynak[];
  dizin: OrtakDizin;
  enIyiler: Map<string, EnIyi>;
  suzgec: Suzgec;
  arama: string;
  parlat: boolean;
}

/**
 * Aynı kalemin tüm kaynaklardaki fiyatı yan yana. Her hücrede üstte satış, altta alış.
 * En düşük satış yeşil, en yüksek alış altın renkle işaretlenir; son kolon kaynaklar arası satış farkı.
 */
const KarsilastirmaTablosu: React.FC<Props> = ({ kaynaklar, dizin, enIyiler, suzgec, arama, parlat }) => {
  const q = arama.trim().toLocaleLowerCase("tr-TR");
  const kalemler = ORTAK_KALEMLER.filter(
    (k) =>
      suzgeceUyar(k.grup, suzgec) &&
      (!q || k.ad.toLocaleLowerCase("tr-TR").includes(q)) &&
      kaynaklar.some((s) => dizin.get(s.kod)?.has(k.kod)),
  );

  if (!kalemler.length) return <div className="pz-bos pz-bos-genis">Bu süzgeçte karşılaştırılacak kalem yok</div>;

  const kolonlar = `minmax(150px, 1.3fr) repeat(${kaynaklar.length}, minmax(112px, 1fr)) minmax(96px, 0.8fr)`;
  let oncekiGrup = "";

  return (
    <div className="pz-kars-kap">
      <div className="pz-kars" style={{ gridTemplateColumns: kolonlar }} role="table" aria-label="Kaynak karşılaştırması">
        <div className="pz-kars-bas pz-kars-ilk" role="columnheader">
          Kalem
        </div>
        {kaynaklar.map((k) => {
          const gor = kaynakGorunum(k.kod, k.ad);
          return (
            <div key={k.kod} className={`pz-kars-bas pz-durum-${k.durum}`} role="columnheader" style={{ "--pz-kaynak": gor.renk } as React.CSSProperties}>
              <span className="pz-monogram pz-monogram-kucuk">{gor.kisa}</span>
              <span className="pz-kars-kaynak">{k.ad}</span>
              <span className="pz-nokta" />
            </div>
          );
        })}
        <div className="pz-kars-bas pz-kars-fark" role="columnheader" title="En yüksek ve en düşük satış arasındaki fark">
          Fark
        </div>

        {kalemler.map((kalem) => {
          const e = enIyiler.get(kalem.kod);
          const grupDegisti = kalem.grup !== oncekiGrup;
          oncekiGrup = kalem.grup;
          const fark = e && e.maxSatis !== null && e.minSatis !== null && e.sayi >= 2 ? e.maxSatis - e.minSatis : null;
          const farkYuzde = fark !== null && e?.minSatis ? (fark / e.minSatis) * 100 : null;
          return (
            <React.Fragment key={kalem.kod}>
              <div className={`pz-kars-hucre pz-kars-ilk ${grupDegisti ? "pz-kars-ayrac" : ""}`} role="rowheader">
                {kalem.ad}
              </div>
              {kaynaklar.map((k) => {
                const s = dizin.get(k.kod)?.get(kalem.kod);
                const karsilastir = !!e && e.sayi >= 2;
                const iyiSatis = karsilastir && s?.satis !== null && s?.satis === e!.satis;
                const iyiAlis = karsilastir && s?.alis !== null && s?.alis === e!.alis;
                return (
                  <div
                    key={k.kod}
                    className={`pz-kars-hucre ${grupDegisti ? "pz-kars-ayrac" : ""} ${k.durum === "kopuk" ? "pz-soluk" : ""}`}
                    role="cell"
                  >
                    {s ? (
                      <>
                        <Deger
                          deger={s.satis}
                          ondalik={s.ondalik}
                          yon={s.yon}
                          parlat={parlat}
                          className={`pz-kars-satis ${iyiSatis ? "pz-eniyi-satis" : ""}`}
                          title={iyiSatis ? "En düşük satış" : "Satış"}
                        />
                        <Deger
                          deger={s.alis}
                          ondalik={s.ondalik}
                          parlat={false}
                          className={`pz-kars-alis ${iyiAlis ? "pz-eniyi-alis" : ""}`}
                          title={iyiAlis ? "En yüksek alış" : "Alış"}
                        />
                      </>
                    ) : (
                      <span className="pz-kars-yok">—</span>
                    )}
                  </div>
                );
              })}
              <div className={`pz-kars-hucre pz-kars-fark ${grupDegisti ? "pz-kars-ayrac" : ""}`} role="cell">
                {fark !== null ? (
                  <>
                    <span className="pz-kars-satis">{sayiYaz(fark, kalem.ondalik)}</span>
                    <span className="pz-kars-alis">%{sayiYaz(farkYuzde, 2)}</span>
                  </>
                ) : (
                  <span className="pz-kars-yok">—</span>
                )}
              </div>
            </React.Fragment>
          );
        })}
      </div>
      <div className="pz-kars-acik">
        <span>
          <i className="pz-isaret pz-isaret-satis" /> En düşük satış
        </span>
        <span>
          <i className="pz-isaret pz-isaret-alis" /> En yüksek alış
        </span>
        <span>Hücrede üstte satış, altta alış</span>
      </div>
    </div>
  );
};

export default KarsilastirmaTablosu;
