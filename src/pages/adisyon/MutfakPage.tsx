import React, { useCallback, useEffect, useState } from "react";
import { Spinner } from "react-bootstrap";
import { adisyonOlaylarinaBaglan } from "../../services/adisyonService";
import { MutfakService, mutfakJeton } from "../../services/mutfakService";
import { MutfakEkrani } from "./MutfakEkrani";

/**
 * Mutfak ekranı bağlantısı (docs/TICARI_ADISYON_YOL_HARITASI.md, TA30, D5): /mutfak?m=<müşteri no>#k=<anahtar>. Mutfak tabletinde
 * açılır; personel girişi istemez. Anahtar girişten sonra adres satırından silinir, jeton bu tarayıcıda kalır.
 */
export const MutfakPage: React.FC = () => {
  const [durum, setDurum] = useState<"giris" | "hazir" | "hata">("giris");
  const [hata, setHata] = useState<string | null>(null);
  const [yer, setYer] = useState<{ yer: string; kisaAd: string } | null>(null);

  useEffect(() => {
    document.title = "Likya Mutfak";
    const m = new URLSearchParams(window.location.search).get("m") || "";
    const k = new URLSearchParams(window.location.hash.replace(/^#/, "")).get("k") || "";
    const ac = async () => {
      try {
        if (m && k) {
          const r = await MutfakService.giris(m, k);
          mutfakJeton.yaz(r.token);
          window.history.replaceState(null, "", "/mutfak");
          setYer({ yer: r.yer, kisaAd: r.kisaAd });
        } else if (mutfakJeton.oku()) {
          setYer(await MutfakService.ben());
        } else throw new Error("Bu adres yöneticinin Adisyon › Tanımlar › Hazırlık yerleri'nden verdiği mutfak ekranı bağlantısıyla açılır.");
        setDurum("hazir");
      } catch (e: any) { setHata(e?.message || "Bağlantı açılamadı."); setDurum("hata"); }
    };
    void ac();
  }, []);

  const yukle = useCallback(() => MutfakService.siparisler(), []);
  const hazir = useCallback((ids: number[], h: boolean) => MutfakService.hazir(ids, h), []);
  const olayBaglan = useCallback((cb: any) => adisyonOlaylarinaBaglan(cb, "/mutfak/olaylar", () => ({ Accept: "text/event-stream", Authorization: `Bearer ${mutfakJeton.oku() || ""}` })), []);

  if (durum === "giris") return <div style={{ minHeight: "100dvh", background: "#0f172a", display: "flex", alignItems: "center", justifyContent: "center" }}><Spinner variant="light" /></div>;
  if (durum === "hata") return <div style={{ minHeight: "100dvh", background: "#0f172a", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, textAlign: "center", fontSize: 18 }}>{hata}</div>;
  return <MutfakEkrani baslik={`${yer?.yer} · ${yer?.kisaAd}`} yukle={yukle} hazir={hazir} olayBaglan={olayBaglan} tamEkran />;
};

export default MutfakPage;
