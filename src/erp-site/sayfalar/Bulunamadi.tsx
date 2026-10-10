import React from "react";
import { Link } from "react-router-dom";
import { URUNLER } from "../veri/urunler";
import { useSayfa } from "../yardimci/sayfa";

export const Bulunamadi: React.FC = () => {
  useSayfa("Sayfa bulunamadı", "Aradığınız sayfa bulunamadı.", "/404");
  return (
    <section className="sayfa-bas" style={{ minHeight: "60vh" }}>
      <div className="k">
        <span className="ust-baslik">404</span>
        <h1>Aradığınız sayfa bulunamadı</h1>
        <p>Adres değişmiş ya da yanlış yazılmış olabilir. Ürünlerimizden birine göz atın:</p>
        <div className="cipler" style={{ marginTop: 24 }}>
          {URUNLER.map((u) => (
            <Link key={u.kod} to={`/urunler/${u.slug}`} className="cip">
              {u.ad}
            </Link>
          ))}
        </div>
        <p style={{ marginTop: 28 }}>
          <Link to="/" className="dugme dugme-ana">
            Ana sayfaya dön
          </Link>
        </p>
      </div>
    </section>
  );
};

export default Bulunamadi;
