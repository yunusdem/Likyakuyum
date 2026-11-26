import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Alert, Button, Spinner } from "react-bootstrap";
import { IconLayoutGrid, IconRefresh, IconShoppingCart, IconWifi, IconWifiOff } from "@tabler/icons-react";
import { Link } from "react-router-dom";
import { useSayfaErisimi } from "../../hooks/useSayfaErisimi";
import { useToast } from "../../context/ToastContext";
import { AdisyonOlayi, AdisyonService, MasaDurumu, MasaOzeti, OlayBaglantisi, PaketBilgisi, PaketListesi, PaketOzeti, adisyonOlaylarinaBaglan, mutfakFisUyarisi } from "../../services/adisyonService";
import { mutfakIstasyonunuUyandir } from "../../components/adisyon/MutfakYaziciIstasyonu";
import { PaketMusteriModal, PaketPaneli } from "./AdisyonPaket";
import { bekleyenYaz } from "./adisyonBekleyen";
import { AdisyonSiparis } from "./AdisyonSiparis";
import { useAdisyonKasa } from "./adisyonKasa";

export { MASA_RENK, MasaIzgarasi } from "./MasaIzgarasi";
import { MASA_RENK, MasaIzgarasi } from "./MasaIzgarasi";

const BAGLANTI: Record<OlayBaglantisi, { ad: string; renk: string }> = {
  baglaniyor: { ad: "Bağlanıyor…", renk: "#64748b" },
  canli: { ad: "Canlı", renk: "#16a34a" },
  yoklama: { ad: "Yoklama (5 sn)", renk: "#d97706" },
  kopuk: { ad: "Bağlantı yok", renk: "#dc2626" },
};

/**
 * Adisyon › Masalar (docs/TICARI_ADISYON_YOL_HARITASI.md, D3, TA22 / TA26): bölge sekmeleri + masa ızgarası; masaya tıklanınca
 * sipariş ekranı. Bütün cihazlar olay akışıyla anında eşitlenir; akış yoksa 5 sn'de bir yoklanır.
 */
export const AdisyonMasalarPage: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const { showInfo, showWarning } = useToast();
  const kasa = useAdisyonKasa();
  const sayfaAcik = useSayfaErisimi();
  const [durum, setDurum] = useState<MasaDurumu | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [baglanti, setBaglanti] = useState<OlayBaglantisi>("baglaniyor");
  const [bolge, setBolge] = useState<number | "tumu">("tumu");
  const [yenile, setYenile] = useState(0);
  const acikMasaId = Number(params.get("masa")) || null;
  // Paket / gel-al (D8): ?paket=<adisyonId>; yeni paketin müşteri bilgisi adreste değil ekranda tutulur
  const acikPaketId = Number(params.get("paket")) || null;
  const [paketler, setPaketler] = useState<PaketListesi | null>(null);
  const [yeniPaket, setYeniPaket] = useState<PaketBilgisi | null>(null);
  const [paketSorusu, setPaketSorusu] = useState<2 | 3 | null>(null);
  const acikRef = useRef<{ masaId: number | null; adisyonId: number | null }>({ masaId: null, adisyonId: null });
  const zamanlayici = useRef<ReturnType<typeof setTimeout> | null>(null);

  const oku = useCallback(async () => {
    try { setDurum(await AdisyonService.masalar()); setHata(null); } catch (e: any) { setHata(e?.message || "Masalar alınamadı."); }
    AdisyonService.paketler().then(setPaketler).catch(() => undefined);
  }, []);
  const gecikmeliOku = useCallback(() => {
    if (zamanlayici.current) clearTimeout(zamanlayici.current);
    zamanlayici.current = setTimeout(() => void oku(), 200);
  }, [oku]);
  useEffect(() => { void oku(); }, [oku]);
  // Olay akışı: masa durumu yenilenir; açık masayla ilgiliyse sipariş ekranı da
  useEffect(() => adisyonOlaylarinaBaglan({
    olay: (l: AdisyonOlayi[]) => {
      gecikmeliOku();
      // Mutfak fişi yazıldı: bu bilgisayar fiş basıyorsa istasyon beklemeden uyanır (boşta seyrek yoklar)
      if (l.some((o) => o.tur === "mutfak-fis" || o.tur === "siparis" || o.tur === "iptal" || o.tur === "hesap")) mutfakIstasyonunuUyandir();
      // Mutfaktan "hazır" bildirimi (D5)
      for (const o of l) if (o.tur === "hazir") { const v: any = o.veri || {}; showInfo(`${v.masa ? `Masa ${v.masa}` : v.musteri ? `Paket ${v.musteri}` : "Paket"}: ${(v.urunler || []).join(", ")} hazır`, 6000); }
      // Garsondan "hesap istendi" (D7): kasaya bildirim
      // Masadaki misafir garson çağırdı (§11 M7)
      for (const o of l) if (o.tur === "cagri") showWarning(`${(o.veri as any)?.masa || "Bir masa"} garson çağırıyor.`, 8000);
      for (const o of l) if (o.tur === "hesap") { const v: any = o.veri || {}; showWarning(`${v.masa ? `Masa ${v.masa}` : "Adisyon"} hesap istedi${v.isteyen ? ` (${v.isteyen})` : ""}.${v.fisKuyrukta ? " Hesap fişi yazdırılıyor." : ""}`, 8000); }
      const a = acikRef.current;
      if (!l.length || l.some((o) => (a.masaId && o.masaId === a.masaId) || (a.adisyonId && o.adisyonId === a.adisyonId))) setYenile((x) => x + 1);
    },
    durum: setBaglanti,
  }), [gecikmeliOku, showInfo, showWarning]);
  // Akış canlı değilse yoklama; canlıyken de dakikada bir (süreler güncel kalsın)
  useEffect(() => {
    const t = setInterval(() => { void oku(); if (baglanti !== "canli") setYenile((x) => x + 1); }, baglanti === "canli" ? 60_000 : 5_000);
    return () => clearInterval(t);
  }, [baglanti, oku]);

  const acikMasa = useMemo(() => {
    if (!durum || !acikMasaId) return null;
    for (const b of durum.bolgeler) { const m = b.masalar.find((x) => x.masaId === acikMasaId); if (m) return { masa: m, bolgeAd: b.ad }; }
    return null;
  }, [durum, acikMasaId]);
  acikRef.current = { masaId: acikMasaId, adisyonId: acikMasa?.masa.adisyon?.adisyonId ?? acikPaketId ?? null };
  const sec = (m: MasaOzeti) => setParams({ masa: String(m.masaId) });
  const geri = () => { setYeniPaket(null); setParams(paketGorunumu ? { gorunum: "paket" } : {}); void oku(); };
  const paketGorunumu = params.get("gorunum") === "paket" || !!acikPaketId || !!yeniPaket;
  const paketAc = (pk: PaketOzeti) => { setYeniPaket(null); setParams({ paket: String(pk.adisyonId) }); };
  const paketDurum = async (pk: PaketOzeti, d: number) => {
    try { await AdisyonService.paketDurum(pk.adisyonId, d); setPaketler(await AdisyonService.paketler()); } catch (e: any) { showWarning(e?.message || "Durum değiştirilemedi."); }
  };
  const dolu = (bid: number | "tumu") => (durum?.bolgeler || []).filter((b) => bid === "tumu" || b.bolgeId === bid).reduce((t, b) => t + b.masalar.filter((m) => m.adisyon).length, 0);
  const b = BAGLANTI[baglanti];

  return (
    <div className="container-fluid py-3">
      {baglanti === "kopuk" && <Alert variant="danger" className="py-2 small">Sunucuyla bağlantı yok. Girilen sipariş bu bilgisayarda korunur; bağlantı gelince gönderilir.</Alert>}
      {hata && <Alert variant="danger" className="py-2 small">{hata}</Alert>}
      {mutfakFisUyarisi(durum?.mutfakFis) && (
        <Alert variant="warning" className="py-2 small d-flex align-items-center gap-2" role="alert" aria-label="Mutfak fişi uyarısı">
          <span className="flex-grow-1">{mutfakFisUyarisi(durum?.mutfakFis)}</span>
          <Link to="/adisyon/ayarlar" className="fw-semibold text-nowrap">Fiş kuyruğu</Link>
        </Alert>
      )}
      {yeniPaket || acikPaketId ? (
        <AdisyonSiparis key={acikPaketId ? `paket-${acikPaketId}` : "paket-yeni"} masa={{ masaId: acikPaketId ?? 0, ad: "", bolgeId: 0, bolgeAd: "" }} adisyonId={acikPaketId}
          yenile={yenile} onGeri={geri} onDegisti={gecikmeliOku} kasa={kasa} saklamaOnEki="pc-paket" paket={acikPaketId ? null : yeniPaket}
          onAdisyonAcildi={(id) => { setYeniPaket(null); setParams({ paket: String(id) }); void oku(); }} />
      ) : acikMasaId && acikMasa ? (
        <AdisyonSiparis key={acikMasa.masa.masaId} masa={{ masaId: acikMasa.masa.masaId, ad: acikMasa.masa.ad, bolgeId: acikMasa.masa.bolgeId, bolgeAd: acikMasa.bolgeAd }} adisyonId={acikMasa.masa.adisyon?.adisyonId ?? null}
          yenile={yenile} onGeri={geri} onDegisti={gecikmeliOku} onMasaGit={(id) => { void oku(); setParams({ masa: String(id) }); }} kasa={kasa} />
      ) : acikMasaId && durum ? (
        <Alert variant="warning" className="py-2">Masa bulunamadı ya da pasif. <Button size="sm" variant="link" onClick={geri}>Masalara dön</Button></Alert>
      ) : (
        <>
          <div className="d-flex align-items-center gap-2 mb-2 flex-wrap">
            <IconLayoutGrid size={20} />
            <span className="fw-bold fs-5">Masalar</span>
            <span className="d-flex align-items-center gap-1 small ms-2" style={{ color: b.renk }}>{baglanti === "kopuk" ? <IconWifiOff size={15} /> : <IconWifi size={15} />}{b.ad}</span>
            <span className="ms-auto d-flex align-items-center gap-3 small">
              {Object.values(MASA_RENK).map((r) => <span key={r.ad} className="d-flex align-items-center gap-1"><span style={{ width: 14, height: 14, borderRadius: 4, border: `2px solid ${r.kenar}`, background: r.zemin, display: "inline-block" }} />{r.ad}</span>)}
              {/* Tezgah ↔ masa (TA33, D9): tezgah satışı Hızlı Satış (Ticari) ekranında; oradan "Masaya gönder" */}
              {sayfaAcik("/hizli-satis/ticari") && <Link to="/hizli-satis/ticari" className="btn btn-sm btn-outline-primary d-flex align-items-center gap-1"><IconShoppingCart size={15} />Tezgah satışı</Link>}
              <Button size="sm" variant="outline-secondary" aria-label="Yenile" onClick={() => void oku()}><IconRefresh size={15} /></Button>
            </span>
          </div>
          {!durum && !hata && <Spinner size="sm" />}
          {durum && !durum.bolgeler.length && !paketGorunumu && <Alert variant="info" className="py-2">Henüz bölge / masa yok. Adisyon › Tanımlar'dan bölge ve masa ekleyin (yalnız paket / gel-al için sağdaki sekme).</Alert>}
          {durum && (
            <>
              {/* Bölge sekmeleri: temanın etkin sekme rengini ezmemesi için sabit renkli düğmeler */}
              <div className="d-flex flex-wrap gap-2 mb-3" role="tablist" aria-label="Bölgeler">
                {[{ id: "tumu" as const, ad: "Tümü" }, ...durum.bolgeler.map((x) => ({ id: x.bolgeId, ad: x.ad }))].map((x) => {
                  const secili = !paketGorunumu && bolge === x.id;
                  return (
                    <button key={String(x.id)} type="button" role="tab" aria-selected={secili} onClick={() => { setBolge(x.id); if (paketGorunumu) setParams({}); }}
                      style={{ borderRadius: 20, padding: "6px 14px", border: `1px solid ${secili ? "#1e293b" : "#cbd5e1"}`, background: secili ? "#1e293b" : "#ffffff", color: secili ? "#ffffff" : "#1e293b", fontWeight: 600 }}>
                      {x.ad} <span style={{ marginLeft: 4, borderRadius: 10, padding: "0 7px", fontSize: 12, background: secili ? "#ffffff" : "#e2e8f0", color: "#1e293b" }}>{dolu(x.id)}</span>
                    </button>
                  );
                })}
                {/* Paket / gel-al (D8): ayrı sekme, süren sipariş sayısıyla */}
                <button type="button" role="tab" aria-selected={paketGorunumu} onClick={() => setParams({ gorunum: "paket" })}
                  style={{ borderRadius: 20, padding: "6px 14px", border: `1px solid ${paketGorunumu ? "#0f766e" : "#99f6e4"}`, background: paketGorunumu ? "#0f766e" : "#f0fdfa", color: paketGorunumu ? "#ffffff" : "#0f766e", fontWeight: 700 }}>
                  Paket / Gel-al <span style={{ marginLeft: 4, borderRadius: 10, padding: "0 7px", fontSize: 12, background: paketGorunumu ? "#ffffff" : "#ccfbf1", color: "#0f766e" }}>{paketler?.aktif.length ?? 0}</span>
                </button>
              </div>
              {paketGorunumu
                ? <PaketPaneli liste={paketler} onAc={paketAc} onYeni={(t) => setPaketSorusu(t)} onDurum={paketDurum} />
                : <MasaIzgarasi durum={durum} bolge={bolge} onSec={sec} />}
            </>
          )}
        </>
      )}
      {kasa.ogeler}
      <PaketMusteriModal acik={!!paketSorusu} tur={paketSorusu || 2} baslik={paketSorusu === 3 ? "Yeni gel-al siparişi" : "Yeni paket servis"} musteriBul={AdisyonService.paketMusteri}
        onOnay={async (b) => { bekleyenYaz(0, { istekId: null, belirsiz: false, kalemler: [] }, "pc-paket"); setYeniPaket(b); setPaketSorusu(null); setParams({ gorunum: "paket" }); }}
        kapat={() => setPaketSorusu(null)} />
    </div>
  );
};

export default AdisyonMasalarPage;
