import React from "react";
import { Link } from "react-router-dom";
import { IconCheck, IconCircleDashed, IconMinus } from "@tabler/icons-react";
import { KARSILASTIRMA, URUNLER, type Kapsam } from "../veri/urunler";
import { useSayfa } from "../yardimci/sayfa";
import { urunStili } from "../bilesenler/UrunStil";
import { CagriBolumu } from "../bilesenler/Ortak";

const KAPSAM_ADI: Record<Kapsam, string> = { var: "Var", ops: "İsteğe bağlı", yok: "Yok" };

const KapsamIsareti: React.FC<{ k: Kapsam }> = ({ k }) => (
  <span className={`kapsam kapsam-${k}`} title={KAPSAM_ADI[k]}>
    {k === "var" ? <IconCheck size={16} aria-hidden="true" /> : k === "ops" ? <IconCircleDashed size={16} aria-hidden="true" /> : <IconMinus size={16} aria-hidden="true" />}
    <span className="gizli">{KAPSAM_ADI[k]}</span>
  </span>
);

export const Karsilastir: React.FC = () => {
  useSayfa(
    "Ürün Karşılaştırma",
    "Likya.ERP, Likya.Kuyum, Likya.Gümüş, Likya.Döviz, Likya.Ticari ve Likya.Connector özelliklerini yan yana karşılaştırın.",
    "/karsilastir"
  );
  return (
    <>
      <section className="sayfa-bas">
        <div className="k">
          <span className="ust-baslik">Karşılaştır</span>
          <h1>Hangi Likya ürünü neyi kapsıyor?</h1>
          <p>
            Ürünler tek başına çalışır; Likya.ERP hepsini tek merkezde birleştirir. Likya.Connector ise tüm ürünlerin dış
            sistemlerle bağlantısını sağlar.
          </p>
        </div>
      </section>
      <section className="bolum" style={{ paddingTop: 56 }}>
        <div className="k">
          <div className="tablo-kap" tabIndex={0} aria-label="Ürün karşılaştırma tablosu, yatay kaydırılabilir">
            <table className="karsilastir">
              <caption className="gizli">Likya ürünlerinin özellik karşılaştırması</caption>
              <thead>
                <tr>
                  <th scope="col">Özellik</th>
                  {URUNLER.map((u) => {
                    const Ikon = u.ikon;
                    return (
                      <th key={u.kod} scope="col" style={urunStili(u)}>
                        <Link to={`/urunler/${u.slug}`}>
                          <span className="ikon-kutu">
                            <Ikon size={20} aria-hidden="true" />
                          </span>
                          {u.ad}
                        </Link>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {KARSILASTIRMA.map((s) => (
                  <tr key={s.ozellik}>
                    <th scope="row">{s.ozellik}</th>
                    {URUNLER.map((u) => (
                      <td key={u.kod}>
                        <KapsamIsareti k={s.deger[u.kod]} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="lejant">
            <span>
              <KapsamIsareti k="var" /> Ürünle gelir
            </span>
            <span>
              <KapsamIsareti k="ops" /> İsteğe bağlı / Likya.ERP ile
            </span>
            <span>
              <KapsamIsareti k="yok" /> Bu ürünün kapsamında değil
            </span>
          </div>
        </div>
      </section>
      <CagriBolumu baslik="Karar veremediniz mi?" aciklama="İşletmenizi anlatın, size en uygun ürün ve modül bileşimini birlikte belirleyelim." />
    </>
  );
};

export default Karsilastir;
