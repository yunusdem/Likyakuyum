import React, { useEffect, useRef, useState } from "react";
import { MusteriEkraniDurumu, MusteriEkraniKimligi, musteriDinleyicisi } from "../../services/musteriEkrani";

/**
 * Müşteri ekranı (docs/TICARI_ADISYON_YOL_HARITASI.md, TA9): ikinci monitörde tam ekran. Yalnız aynı tarayıcıdaki kasa sayfasının
 * yayınını gösterir; sunucuya istek atmaz. Boşta firma logosu + karşılama; satışta sepet (son eklenen vurgulu) ve büyük toplam;
 * ödeme girildikçe ödenen / kalan / para üstü; satış bitince teşekkür + para üstü, 12 saniye sonra boş ekrana döner.
 */
const tl = (n: number) => Number(n || 0).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const TAMAM_SURESI = 12_000;

export const MusteriEkraniPage: React.FC = () => {
  const [durum, setDurum] = useState<MusteriEkraniDurumu | null>(null);
  const [kimlik, setKimlik] = useState<MusteriEkraniKimligi>({ firmaAdi: "", logo: null, karsilama: "Hoş geldiniz" });
  const [tamamBitti, setTamamBitti] = useState(false);
  const [tamEkran, setTamEkran] = useState(false);
  const vurguRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    document.title = "Müşteri ekranı";
    return musteriDinleyicisi((d) => { setDurum(d); setTamamBitti(false); }, setKimlik);
  }, []);
  // "Tamam" ekranı bir süre sonra boşa döner (kasa yeni satışa başlamasa da)
  useEffect(() => {
    if (durum?.tur !== "tamam") return;
    const t = setTimeout(() => setTamamBitti(true), TAMAM_SURESI);
    return () => clearTimeout(t);
  }, [durum]);
  useEffect(() => { vurguRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }); }, [durum]);
  useEffect(() => {
    const f = () => setTamEkran(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", f);
    return () => document.removeEventListener("fullscreenchange", f);
  }, []);

  const bos = !durum || durum.tur === "bos" || (durum.tur === "tamam" && tamamBitti);
  const kok: React.CSSProperties = { position: "fixed", inset: 0, background: "#0f172a", color: "#f8fafc", fontFamily: "Segoe UI, Arial, sans-serif", display: "flex", flexDirection: "column", userSelect: "none" };
  const tamEkranDugmesi = !tamEkran && (
    <button type="button" onClick={() => document.documentElement.requestFullscreen?.().catch(() => undefined)}
      style={{ position: "absolute", bottom: 12, left: 12, background: "transparent", color: "#94a3b8", border: "1px solid #334155", borderRadius: 8, padding: "6px 12px", fontSize: 14, cursor: "pointer" }}>
      Tam ekran
    </button>
  );

  if (bos) {
    return (
      <div style={{ ...kok, alignItems: "center", justifyContent: "center", gap: 24 }} data-test="musteri-bos">
        {tamEkranDugmesi}
        {kimlik.logo ? <img src={kimlik.logo} alt="" style={{ maxWidth: "40vw", maxHeight: "40vh", objectFit: "contain", background: "#fff", borderRadius: 16, padding: 16 }} /> : null}
        {kimlik.firmaAdi && <div style={{ fontSize: "4vh", fontWeight: 700, textAlign: "center", padding: "0 5vw" }}>{kimlik.firmaAdi}</div>}
        <div style={{ fontSize: "6vh", color: "#38bdf8", fontWeight: 300 }}>{kimlik.karsilama || "Hoş geldiniz"}</div>
      </div>
    );
  }

  if (durum!.tur === "tamam") {
    return (
      <div style={{ ...kok, alignItems: "center", justifyContent: "center", gap: 20 }} data-test="musteri-tamam">
        {tamEkranDugmesi}
        <div style={{ fontSize: "7vh", fontWeight: 700, color: "#4ade80" }}>Teşekkür ederiz</div>
        <div style={{ fontSize: "4vh" }}>Toplam: <b>{tl(durum!.toplam)} TL</b></div>
        {durum!.paraUstu > 0 && <div style={{ fontSize: "8vh", fontWeight: 800, color: "#facc15" }} data-test="para-ustu">Para üstü: {tl(durum!.paraUstu)} TL</div>}
        {kimlik.firmaAdi && <div style={{ fontSize: "2.5vh", color: "#94a3b8", marginTop: 24 }}>{kimlik.firmaAdi}</div>}
      </div>
    );
  }

  const d = durum!;
  return (
    <div style={kok} data-test="musteri-sepet">
      {tamEkranDugmesi}
      <div style={{ padding: "2vh 3vw", display: "flex", alignItems: "center", gap: 16, borderBottom: "1px solid #1e293b" }}>
        {kimlik.logo && <img src={kimlik.logo} alt="" style={{ height: "6vh", background: "#fff", borderRadius: 8, padding: 4 }} />}
        <div style={{ fontSize: "3vh", fontWeight: 600 }}>{kimlik.firmaAdi}</div>
        <div style={{ marginLeft: "auto", fontSize: "2.4vh", color: "#94a3b8" }}>{d.kalemSayisi} kalem</div>
      </div>
      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        <div style={{ flex: 3, overflowY: "auto", padding: "1vh 2vw" }}>
          {/* Tablo değil ızgara: uygulamanın genel tablo teması satırları boyamasın */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto auto", columnGap: 0, fontSize: "2.8vh" }}>
            {["Ürün", "Miktar", "Birim fiyat", "Tutar"].map((b, i) => (
              <div key={b} style={{ color: "#94a3b8", fontSize: "2vh", padding: "1vh 1vw", textAlign: i ? "right" : "left", borderBottom: "1px solid #1e293b" }}>{b}</div>
            ))}
            {d.satirlar.map((s, i) => {
              const arka = i === d.vurgu ? "#1d4ed8" : i % 2 ? "#111c33" : "transparent";
              const hucre: React.CSSProperties = { background: arka, padding: "1.2vh 1vw", transition: "background .4s", whiteSpace: "nowrap", textAlign: "right" };
              return (
                <React.Fragment key={i}>
                  <div ref={i === d.vurgu ? vurguRef : undefined} data-vurgu={i === d.vurgu ? "1" : undefined} style={{ ...hucre, textAlign: "left", whiteSpace: "normal" }}>
                    {s.ad}{s.not && <div style={{ fontSize: "1.8vh", color: "#fca5a5" }}>{s.not}</div>}
                  </div>
                  <div style={hucre}>{s.miktar}</div>
                  <div style={{ ...hucre, color: "#cbd5e1" }}>{tl(s.birimFiyat)}</div>
                  <div style={{ ...hucre, fontWeight: 700 }}>{tl(s.tutar)}</div>
                </React.Fragment>
              );
            })}
          </div>
        </div>
        <div style={{ flex: 2, background: "#020617", padding: "3vh 2.5vw", display: "flex", flexDirection: "column", gap: "1.5vh", justifyContent: "flex-end" }}>
          {d.indirim > 0 && <div style={{ display: "flex", justifyContent: "space-between", fontSize: "3vh", color: "#fca5a5" }}><span>İndirim</span><span>−{tl(d.indirim)}</span></div>}
          {d.kdv > 0 && <div style={{ display: "flex", justifyContent: "space-between", fontSize: "2.4vh", color: "#94a3b8" }}><span>KDV dahil</span><span>{tl(d.kdv)}</span></div>}
          <div style={{ fontSize: "3vh", color: "#94a3b8" }}>{d.alis ? "Size ödenecek" : "Toplam"}</div>
          <div style={{ fontSize: "10vh", fontWeight: 800, lineHeight: 1, textAlign: "right" }} data-test="toplam">{tl(d.toplam)} <span style={{ fontSize: "4vh" }}>TL</span></div>
          {d.odenen > 0 && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "3.4vh", marginTop: "2vh" }}><span>Ödenen</span><span>{tl(d.odenen)}</span></div>
              {d.paraUstu > 0
                ? <div style={{ display: "flex", justifyContent: "space-between", fontSize: "5vh", fontWeight: 800, color: "#facc15" }} data-test="para-ustu"><span>Para üstü</span><span>{tl(d.paraUstu)}</span></div>
                : <div style={{ display: "flex", justifyContent: "space-between", fontSize: "4vh", fontWeight: 700, color: "#38bdf8" }}><span>Kalan</span><span>{tl(d.kalan)}</span></div>}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default MusteriEkraniPage;
