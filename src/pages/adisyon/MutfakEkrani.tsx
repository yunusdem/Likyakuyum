import React, { useCallback, useEffect, useRef, useState } from "react";
import { IconArrowBackUp, IconCheck, IconChefHat, IconVolume, IconVolumeOff, IconWifi, IconWifiOff } from "@tabler/icons-react";
import { AdisyonOlayi, MutfakGrubu, MutfakSiparisleri, OlayBaglantisi } from "../../services/adisyonService";
import { miktarMetni } from "./mutfakFis";

/** Geçen süre rengi: 0–9 dk yeşil, 10–19 sarı, 20+ kırmızı */
export const sureRengi = (dk: number) => (dk >= 20 ? "#dc2626" : dk >= 10 ? "#d97706" : "#16a34a");

/**
 * Kısa bip (yeni sipariş); tarayıcı ses iznini ilk dokunuşta verir. O15 (26.11.2026 denetimi): tek ses bağlamı paylaşılır — her bipte
 * yeni bağlam açılınca tarayıcı birkaç taneden sonra yenisini reddediyor, gün içinde ses kesiliyordu (bağlamlar kapanmadan birikiyordu).
 */
let sesBaglami: any = null;
const bip = () => {
  try {
    const C = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!C) return;
    if (!sesBaglami || sesBaglami.state === "closed") sesBaglami = new C();
    const a = sesBaglami;
    if (a.state === "suspended") void a.resume().catch(() => undefined);
    const o = a.createOscillator(), g = a.createGain();
    o.frequency.value = 880; o.connect(g); g.connect(a.destination); g.gain.setValueAtTime(0.25, a.currentTime);
    o.start(); g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + 0.5); o.stop(a.currentTime + 0.5);
  } catch { /* ses yok */ }
};

/**
 * Mutfak ekranı panosu (docs/TICARI_ADISYON_YOL_HARITASI.md, TA30, D5). Sunucu uçları dışarıdan (KDS bağlantısı ya da PC oturumu).
 * Siparişler gönderim sırasıyla (en eski önde); kaleme dokunmak hazır yapar, "Tümü hazır" grubu kapatır; hazırlar son 30 dk görünür
 * ve geri alınabilir. Olay akışıyla anında yenilenir, akış yoksa 5 sn'de bir yoklar.
 */
export const MutfakEkrani: React.FC<{
  baslik: string;
  yukle: () => Promise<MutfakSiparisleri>;
  hazir: (kalemIdler: number[], hazir: boolean) => Promise<unknown>;
  olayBaglan: (cb: { olay: (l: AdisyonOlayi[]) => void; durum: (d: OlayBaglantisi) => void }) => () => void;
  ust?: React.ReactNode;
  tamEkran?: boolean;
}> = ({ baslik, yukle, hazir, olayBaglan, ust, tamEkran }) => {
  const [veri, setVeri] = useState<MutfakSiparisleri | null>(null);
  const [okunma, setOkunma] = useState(Date.now());
  const [simdi, setSimdi] = useState(Date.now());
  const [baglanti, setBaglanti] = useState<OlayBaglantisi>("baglaniyor");
  const [ses, setSes] = useState(() => localStorage.getItem("likya_kds_ses") !== "0");
  const [hata, setHata] = useState<string | null>(null);
  const [mesgul, setMesgul] = useState<Set<number>>(new Set());
  const bilinen = useRef<Set<string> | null>(null);
  // O15: ses tercihi ref ile okunur — ses düğmesi okuma işlevini (ve ona bağlı canlı akışı) yeniden kurdurup bağlantıyı koparmasın
  const sesRef = useRef(ses);
  sesRef.current = ses;

  const oku = useCallback(async () => {
    try {
      const v = await yukle();
      const yeni = v.bekleyen.filter((g) => bilinen.current && !bilinen.current.has(g.anahtar));
      if (yeni.length && sesRef.current) bip();
      bilinen.current = new Set([...v.bekleyen, ...v.hazir].map((g) => g.anahtar));
      setVeri(v); setOkunma(Date.now()); setHata(null);
    } catch (e: any) { setHata(e?.message || "Siparişler alınamadı."); }
  }, [yukle]);
  useEffect(() => { void oku(); }, [oku]);
  useEffect(() => olayBaglan({ olay: () => void oku(), durum: setBaglanti }), [olayBaglan, oku]);
  // Canlıyken de dakikada bir güvenlik yenilemesi: akış bir olayı kaçırsa ya da "hazır" kartlarının 30 dk'sı dolsa ekran bayat kalmaz
  useEffect(() => { let n = 0; const t = setInterval(() => { setSimdi(Date.now()); n++; if (baglanti !== "canli" || n % 2 === 0) void oku(); }, baglanti === "canli" ? 30_000 : 5_000); return () => clearInterval(t); }, [baglanti, oku]);

  const dk = (g: MutfakGrubu) => g.dakika + Math.floor((simdi - okunma) / 60000);
  // Dokunuş kilidi: kart kaybolunca ızgara kayar; aynı yere gelen ikinci dokunuş başka masanın kalemini hazır yapmasın
  const sonDokunus = useRef(0);
  const degistir = async (ids: number[], h: boolean) => {
    if (Date.now() - sonDokunus.current < 450) return;
    sonDokunus.current = Date.now();
    setMesgul((s) => new Set([...s, ...ids]));
    try { await hazir(ids, h); await oku(); } catch (e: any) { setHata(e?.message || "Kaydedilemedi."); }
    finally { setMesgul((s) => { const n = new Set(s); ids.forEach((i) => n.delete(i)); return n; }); }
  };

  const kart = (g: MutfakGrubu, hazirBolumu: boolean) => {
    const sure = dk(g);
    const renk = hazirBolumu ? "#64748b" : sureRengi(sure);
    const bekleyenler = g.kalemler.filter((k) => k.durum === 1);
    return (
      <div key={g.anahtar} style={{ background: "#ffffff", borderRadius: 12, overflow: "hidden", border: `3px solid ${renk}`, display: "flex", flexDirection: "column", opacity: hazirBolumu ? 0.85 : 1 }}>
        <div style={{ background: renk, color: "#fff", padding: "6px 10px", display: "flex", alignItems: "baseline", gap: 8 }}>
          <span style={{ fontSize: hazirBolumu ? 18 : 24, fontWeight: 800 }}>{g.masa ? `Masa ${g.masa}` : `${g.adisyonTuru === 3 ? "Gel-al" : "Paket"}${g.musteri ? ` · ${g.musteri}` : ""}`}</span>
          <span style={{ fontSize: 12, opacity: 0.9 }}>{g.bolge}</span>
          <span style={{ marginLeft: "auto", fontSize: hazirBolumu ? 14 : 20, fontWeight: 800 }}>{hazirBolumu ? "Hazır" : `${sure} dk`}</span>
        </div>
        <div style={{ fontSize: 11, color: "#475569", padding: "2px 10px", display: "flex", justifyContent: "space-between" }}><span>{g.adisyonNo}</span><span>{g.garson}</span>{!tamEkran && <span>{g.yer}</span>}</div>
        <div style={{ flex: 1 }}>
          {g.kalemler.map((k) => {
            const h = k.durum === 2;
            return (
              <button key={k.kalemId} type="button" disabled={mesgul.has(k.kalemId)} onClick={() => void degistir([k.kalemId], !h)} aria-label={`${k.ad} ${h ? "hazır, geri al" : "hazır yap"}`}
                style={{ display: "flex", width: "100%", textAlign: "left", gap: 8, alignItems: "flex-start", padding: "8px 10px", border: 0, borderTop: "1px solid #e2e8f0", background: h ? "#f0fdf4" : "#ffffff", color: "#0f172a" }}>
                <span style={{ fontSize: 20, fontWeight: 800, minWidth: 54, textDecoration: h ? "line-through" : undefined }}>{miktarMetni(k.miktar, k.birim)}</span>
                <span style={{ flex: 1 }}>
                  <span style={{ fontSize: 18, fontWeight: 700, textDecoration: h ? "line-through" : undefined }}>{k.ad}{k.porsiyon ? ` (${k.porsiyon})` : ""}</span>
                  {k.secim && <div style={{ fontSize: 14, color: "#334155" }}>{k.secim}</div>}
                  {k.notu && <div style={{ fontSize: 15, fontWeight: 800, color: "#b91c1c" }}>NOT: {k.notu}</div>}
                </span>
                {h ? <IconArrowBackUp size={22} color="#64748b" /> : <IconCheck size={22} color="#16a34a" />}
              </button>
            );
          })}
        </div>
        {!hazirBolumu && bekleyenler.length > 1 && (
          <button type="button" onClick={() => void degistir(bekleyenler.map((k) => k.kalemId), true)} style={{ border: 0, background: "#16a34a", color: "#fff", fontSize: 18, fontWeight: 800, padding: 10 }}>
            Tümü hazır ({bekleyenler.length})
          </button>
        )}
      </div>
    );
  };

  return (
    <div style={{ background: "#0f172a", minHeight: tamEkran ? "100dvh" : "calc(100vh - 140px)", padding: 10, borderRadius: tamEkran ? 0 : 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#fff", marginBottom: 10, flexWrap: "wrap" }}>
        <IconChefHat size={26} color="#fda4af" />
        <span style={{ fontSize: 22, fontWeight: 800 }}>{baslik}</span>
        <span style={{ color: baglanti === "canli" ? "#4ade80" : baglanti === "kopuk" ? "#f87171" : "#fbbf24", display: "flex", alignItems: "center", gap: 4, fontSize: 13 }}>
          {baglanti === "kopuk" ? <IconWifiOff size={16} /> : <IconWifi size={16} />}{baglanti === "canli" ? "Canlı" : baglanti === "kopuk" ? "Bağlantı yok" : "Yoklama"}
        </span>
        <span style={{ fontSize: 14, opacity: 0.85 }}>{veri ? `${veri.bekleyen.length} sipariş bekliyor` : ""}</span>
        <span style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          {ust}
          <button type="button" aria-label={ses ? "Sesi kapat" : "Sesi aç"} onClick={() => { const y = !ses; setSes(y); localStorage.setItem("likya_kds_ses", y ? "1" : "0"); if (y) bip(); }}
            style={{ background: "transparent", border: "1px solid #475569", color: "#fff", borderRadius: 8, padding: "4px 8px" }}>{ses ? <IconVolume size={18} /> : <IconVolumeOff size={18} />}</button>
        </span>
      </div>
      {hata && <div style={{ background: "#7f1d1d", color: "#fff", padding: "6px 10px", borderRadius: 8, marginBottom: 8 }}>{hata}</div>}
      {veri && !veri.bekleyen.length && <div style={{ color: "#94a3b8", fontSize: 20, textAlign: "center", padding: 40 }}>Bekleyen sipariş yok.</div>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 10, alignItems: "start" }}>
        {veri?.bekleyen.map((g) => kart(g, false))}
      </div>
      {!!veri?.hazir.length && (
        <>
          <div style={{ color: "#94a3b8", fontWeight: 700, margin: "16px 0 8px" }}>Hazır (son 30 dk) — yanlışlıkla işaretlediyseniz kaleme dokunup geri alın</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 8, alignItems: "start" }}>{veri.hazir.map((g) => kart(g, true))}</div>
        </>
      )}
    </div>
  );
};

export default MutfakEkrani;
