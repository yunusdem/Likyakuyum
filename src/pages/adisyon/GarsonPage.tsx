import React, { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Button, Dropdown, Form, Spinner } from "react-bootstrap";
import { IconLock, IconLogout, IconToolsKitchen2, IconWifi, IconWifiOff } from "@tabler/icons-react";
import { AdisyonOlayi, MasaDurumu, MasaOzeti, OlayBaglantisi, adisyonOlaylarinaBaglan, mutfakFisUyarisi } from "../../services/adisyonService";
import { GARSON_OTURUM_DUSTU, GarsonBilgisi, GarsonGirisYaniti, GarsonService, eskiCihazKaydiniSil, garsonJeton } from "../../services/garsonService";
import { MasaIzgarasi } from "./AdisyonMasalarPage";
import { AdisyonSiparis, SiparisApi } from "./AdisyonSiparis";

/** Hareketsiz kalınca oturum kapanır (paylaşılan tablet): yeniden kullanıcı adı + şifre */
const KILIT_DAKIKA = 10;
const SON_KULLANICI = "likya_garson_kullanici";
const GARSON_API: SiparisApi = {
  menu: GarsonService.menu, getir: GarsonService.getir, siparis: GarsonService.siparis, kisi: GarsonService.kisi, servis: GarsonService.servis,
  yetkiler: async () => (await GarsonService.ben()).garson.yetkiler, masalar: GarsonService.masalar, ikram: GarsonService.ikram, iptal: GarsonService.iptal,
  adisyonIptal: GarsonService.adisyonIptal, masaTasi: GarsonService.masaTasi, birlestir: GarsonService.birlestir, urunTasi: GarsonService.urunTasi,
  hesap: GarsonService.hesap, hesapIste: GarsonService.hesapIste, odemeEkle: GarsonService.odemeEkle, odemeSil: GarsonService.odemeSil, kapat: GarsonService.kapat, urunleOde: GarsonService.urunleOde,
  indirim: GarsonService.indirim, fiyatDegistir: GarsonService.fiyatDegistir, misafirPin: GarsonService.misafirPin,
};
type Ekran = "yukleniyor" | "musteri" | "giris" | "masalar";

/**
 * Garson adresi (docs/TICARI_ADISYON_YOL_HARITASI.md, TA23, D4; §11 G1–G4): /garson. Müşteri no + kullanıcı adı + şifre (garson kartına
 * bağlı Kullanıcı Tanımları kullanıcısı; şifre normal girişle aynı). PIN ve "bu cihazı hatırla" kalktı. Garson yalnız masaları ve sipariş
 * ekranını görür; normal giriş ekranına dokunulmaz.
 */
export const GarsonPage: React.FC = () => {
  const [ekran, setEkran] = useState<Ekran>("yukleniyor");
  const [musteriNo, setMusteriNo] = useState(() => localStorage.getItem("likya_garson_musteri_no") || "");
  const [kisaAd, setKisaAd] = useState("");
  const [kullaniciAdi, setKullaniciAdi] = useState(() => localStorage.getItem(SON_KULLANICI) || "");
  const [sifre, setSifre] = useState("");
  const [mesgul, setMesgul] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [garson, setGarson] = useState<GarsonBilgisi | null>(null);
  const [durum, setDurum] = useState<MasaDurumu | null>(null);
  const [bolge, setBolge] = useState<number | "tumu">("tumu");
  const [acik, setAcik] = useState<MasaOzeti | null>(null);
  const [baglanti, setBaglanti] = useState<OlayBaglantisi>("baglaniyor");
  const okuZaman = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [yenile, setYenile] = useState(0);
  const [bildirim, setBildirim] = useState<{ metin: string; benim: boolean; cagri?: boolean } | null>(null);
  const garsonRef = useRef<GarsonBilgisi | null>(null);
  garsonRef.current = garson;
  const acikRef = useRef<MasaOzeti | null>(null);
  acikRef.current = acik;

  const girisEkrani = useCallback((mesaj?: string) => {
    garsonJeton.sil(); setGarson(null); setSifre(""); setAcik(null);
    setEkran(musteriNo ? "giris" : "musteri");
    if (mesaj) setHata(mesaj);
  }, [musteriNo]);

  // Telefona "ana ekrana ekle": garson uygulaması /garson ile açılsın (ana manifest /login açar)
  useEffect(() => {
    const l = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    if (!l) return;
    const eski = l.getAttribute("href");
    l.setAttribute("href", "/manifest-garson.json");
    const baslik = document.title;
    document.title = "Likya Garson";
    return () => { if (eski) l.setAttribute("href", eski); document.title = baslik; };
  }, []);
  // Açılış: geçerli jeton varsa masalar, yoksa giriş (müşteri no biliniyorsa doğrudan kullanıcı adı + şifre)
  useEffect(() => {
    eskiCihazKaydiniSil();
    if (!garsonJeton.oku()) { setEkran(musteriNo ? "giris" : "musteri"); return; }
    GarsonService.ben().then((b) => { setGarson(b.garson); setEkran("masalar"); }).catch(() => setEkran(musteriNo ? "giris" : "musteri"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (ekran === "giris" && musteriNo && !kisaAd) GarsonService.bilgi(musteriNo).then((b) => setKisaAd(b.kisaAd)).catch(() => undefined);
  }, [ekran, musteriNo, kisaAd]);
  useEffect(() => {
    const f = (e: Event) => girisEkrani((e as CustomEvent).detail?.mesaj || "Oturum kapandı.");
    window.addEventListener(GARSON_OTURUM_DUSTU, f);
    return () => window.removeEventListener(GARSON_OTURUM_DUSTU, f);
  }, [girisEkrani]);

  const girdi = (r: GarsonGirisYaniti) => {
    garsonJeton.yaz(r.token);
    setGarson(r.garson); setKisaAd(r.kisaAd); setSifre(""); setHata(null);
    localStorage.setItem(SON_KULLANICI, kullaniciAdi.trim());
    setEkran("masalar");
  };
  const musteriDevam = async () => {
    setMesgul(true); setHata(null);
    try { const b = await GarsonService.bilgi(musteriNo.trim()); setKisaAd(b.kisaAd); setMusteriNo(b.musteriNo); localStorage.setItem("likya_garson_musteri_no", b.musteriNo); setEkran("giris"); }
    catch (e: any) { setHata(e?.message || "Müşteri no bulunamadı."); }
    finally { setMesgul(false); }
  };
  const giris = async () => {
    setMesgul(true); setHata(null);
    try { girdi(await GarsonService.giris({ musteriNo, kullaniciAdi: kullaniciAdi.trim(), sifre })); }
    catch (e: any) { setSifre(""); setHata(e?.message || "Giriş yapılamadı."); }
    finally { setMesgul(false); }
  };
  /** Çıkış / kilit: jeton sunucuda da geçersiz yazılır (Y10) */
  const cikis = useCallback(async (mesaj?: string) => {
    try { await GarsonService.cikis(); } catch { /* jeton zaten düşmüş olabilir */ }
    girisEkrani(mesaj);
  }, [girisEkrani]);

  // Masalar + canlı olaylar (yalnız oturum açıkken)
  const oku = useCallback(async () => { try { setDurum(await GarsonService.masalar()); } catch { /* 401 olayı ekranı değiştirir */ } }, []);
  useEffect(() => {
    if (ekran !== "masalar") return;
    void oku();
    const birak = adisyonOlaylarinaBaglan({
      olay: (l: AdisyonOlayi[]) => {
        // Her olayda bütün telefonlar aynı anda masaları çekmesin: kısa, rastgele gecikmeyle ve art arda olaylar tek okumada
        if (okuZaman.current) clearTimeout(okuZaman.current);
        okuZaman.current = setTimeout(() => void oku(), 150 + Math.random() * 450);
        // Mutfaktan "hazır" (D5): kendi masasıysa titreşim + vurgulu bildirim
        for (const o of l) if (o.tur === "cagri") {
          // Masadaki misafir garson çağırdı (§11 M7): herkese görünür, titreşim
          setBildirim({ metin: `🙋 ${(o.veri as any)?.masa || "Bir masa"} garson çağırıyor`, benim: false, cagri: true });
          try { navigator.vibrate?.([300, 100, 300]); } catch { /* titreşim yok */ }
        }
        for (const o of l) if (o.tur === "hazir") {
          const v: any = o.veri || {};
          const benim = !!garsonRef.current && v.garsonId === garsonRef.current.garsonId;
          setBildirim({ metin: `${v.masa ? `Masa ${v.masa}` : "Paket"}: ${(v.urunler || []).join(", ")} hazır`, benim });
          if (benim) { try { navigator.vibrate?.([200, 100, 200]); } catch { /* titreşim yok */ } }
        }
        const a = acikRef.current;
        if (!l.length || (a && l.some((o) => o.masaId === a.masaId || (a.adisyon && o.adisyonId === a.adisyon.adisyonId)))) setYenile((x) => x + 1);
      },
      durum: setBaglanti,
    }, "/garson/olaylar", () => ({ Accept: "text/event-stream", Authorization: `Bearer ${garsonJeton.oku() || ""}` }));
    return birak;
  }, [ekran, oku]);
  useEffect(() => {
    if (ekran !== "masalar") return;
    const t = setInterval(() => { void oku(); if (baglanti !== "canli") setYenile((x) => x + 1); }, baglanti === "canli" ? 60_000 : 5_000);
    return () => clearInterval(t);
  }, [ekran, baglanti, oku]);
  // Açık masa, masa listesi yenilenince güncellenir (adisyon açıldı / kapandı)
  useEffect(() => {
    if (!acik || !durum) return;
    for (const b of durum.bolgeler) { const m = b.masalar.find((x) => x.masaId === acik.masaId); if (m && m.adisyon?.adisyonId !== acik.adisyon?.adisyonId) setAcik(m); }
  }, [durum, acik]);
  useEffect(() => { if (!bildirim) return; const t = setTimeout(() => setBildirim(null), 8000); return () => clearTimeout(t); }, [bildirim]);
  // Hareketsizlik kilidi
  useEffect(() => {
    if (ekran !== "masalar") return;
    const kilit = () => void cikis(`${KILIT_DAKIKA} dakika işlem yapılmadı; oturum kapandı.`);
    let t = setTimeout(kilit, KILIT_DAKIKA * 60_000);
    const hareket = () => { clearTimeout(t); t = setTimeout(kilit, KILIT_DAKIKA * 60_000); };
    const olaylar = ["pointerdown", "keydown", "touchstart"];
    olaylar.forEach((o) => window.addEventListener(o, hareket));
    return () => { clearTimeout(t); olaylar.forEach((o) => window.removeEventListener(o, hareket)); };
  }, [ekran, cikis]);

  const kart = (icerik: React.ReactNode) => (
    <div style={{ minHeight: "100dvh", background: "linear-gradient(160deg,#0f172a,#1e3a8a)", display: "flex", alignItems: "center", justifyContent: "center", padding: 12 }}>
      <div style={{ width: "100%", maxWidth: 420, background: "#ffffff", borderRadius: 18, padding: 20, boxShadow: "0 10px 30px rgba(0,0,0,.25)" }}>
        <div className="d-flex align-items-center gap-2 mb-2"><IconToolsKitchen2 size={26} color="#be123c" /><span className="fw-bold fs-5">{kisaAd || "Likya Restorant"}</span><span className="ms-auto small text-muted">Garson</span></div>
        {hata && <Alert variant="danger" className="py-2 small" onClose={() => setHata(null)} dismissible>{hata}</Alert>}
        {icerik}
      </div>
    </div>
  );

  if (ekran === "yukleniyor") return kart(<div className="text-center py-4"><Spinner /></div>);
  if (ekran === "musteri") return kart(
    <Form onSubmit={(e) => { e.preventDefault(); void musteriDevam(); }}>
      <Form.Label className="fw-bold">Müşteri no</Form.Label>
      <Form.Control size="lg" aria-label="Müşteri no" autoFocus autoCapitalize="characters" value={musteriNo} onChange={(e) => setMusteriNo(e.target.value)} placeholder="Firmanızın müşteri numarası" />
      <Button type="submit" size="lg" className="w-100 mt-3" disabled={!musteriNo.trim() || mesgul}>{mesgul ? <Spinner size="sm" /> : "Devam"}</Button>
    </Form>
  );
  if (ekran === "giris") return kart(
    <Form onSubmit={(e) => { e.preventDefault(); void giris(); }}>
      <div className="small text-muted mb-2">Müşteri no: <b>{musteriNo}</b> <Button variant="link" size="sm" className="p-0 ms-1" onClick={() => { setKisaAd(""); setEkran("musteri"); }}>değiştir</Button></div>
      <Form.Label className="fw-bold">Kullanıcı adı</Form.Label>
      <Form.Control size="lg" aria-label="Kullanıcı adı" value={kullaniciAdi} autoFocus={!kullaniciAdi} autoCapitalize="none" autoCorrect="off" onChange={(e) => setKullaniciAdi(e.target.value)} autoComplete="username" />
      <Form.Label className="fw-bold mt-3">Şifre</Form.Label>
      <Form.Control size="lg" aria-label="Şifre" type="password" value={sifre} autoFocus={!!kullaniciAdi} onChange={(e) => setSifre(e.target.value)} autoComplete="current-password" />
      <Button type="submit" size="lg" variant="success" className="w-100 mt-3" disabled={!kullaniciAdi.trim() || !sifre || mesgul}>{mesgul ? <Spinner size="sm" /> : "Giriş"}</Button>
      <div className="small text-muted mt-3">Programdaki kullanıcı adınız ve şifrenizle girin. Garson kartınız yoksa yöneticiniz Restorant › Tanımlar › Garsonlar'dan açar.</div>
    </Form>
  );

  // ── Masalar / sipariş
  const ust = (
    <div className="d-flex align-items-center gap-2 px-2" style={{ height: 48, background: "#0f172a", color: "#fff" }}>
      <IconToolsKitchen2 size={20} color="#fda4af" />
      <span className="fw-bold text-truncate">{kisaAd}</span>
      <span title={baglanti} style={{ color: baglanti === "canli" ? "#4ade80" : baglanti === "kopuk" ? "#f87171" : "#fbbf24" }}>{baglanti === "kopuk" ? <IconWifiOff size={18} /> : <IconWifi size={18} />}</span>
      <Dropdown align="end" className="ms-auto">
        <Dropdown.Toggle variant="outline-light" size="sm">{garson?.ad}</Dropdown.Toggle>
        <Dropdown.Menu>
          <Dropdown.Item onClick={() => void cikis("Ekran kilitlendi.")}><IconLock size={15} className="me-1" />Kilitle</Dropdown.Item>
          <Dropdown.Item onClick={() => void cikis()}><IconLogout size={15} className="me-1" />Çıkış</Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown>
    </div>
  );
  // Hazır bildirimi 8 sn görünür
  const bildirimKutusu = bildirim && (
    <div role="status" onClick={() => setBildirim(null)} style={{ position: "fixed", left: 8, right: 8, bottom: 12, zIndex: 2000, background: bildirim.cagri ? "#ea580c" : bildirim.benim ? "#16a34a" : "#1e293b", color: "#fff", borderRadius: 12, padding: "12px 14px", fontWeight: 700, boxShadow: "0 6px 20px rgba(0,0,0,.3)" }}>
      {bildirim.benim ? "🔔 Sizin masanız — " : ""}{bildirim.metin}
    </div>
  );
  if (acik && durum) {
    const b = durum.bolgeler.find((x) => x.bolgeId === acik.bolgeId);
    return (
      <div style={{ minHeight: "100dvh", background: "#f8fafc" }}>
        {ust}
        <div className="p-2">
          <AdisyonSiparis key={acik.masaId} masa={{ masaId: acik.masaId, ad: acik.ad, bolgeId: acik.bolgeId, bolgeAd: b?.ad || "" }} adisyonId={acik.adisyon?.adisyonId ?? null} yenile={yenile}
            onMasaGit={async (id) => { const d = await GarsonService.masalar().catch(() => null); if (!d) return; setDurum(d); for (const x of d.bolgeler) { const m = x.masalar.find((y) => y.masaId === id); if (m) setAcik(m); } }}
            onGeri={() => { setAcik(null); void oku(); }} onDegisti={() => void oku()} api={GARSON_API} yerlesim="telefon" saklamaOnEki={`garson_${String(musteriNo || "").replace(/[^A-Za-z0-9]/g, "")}_${garson?.garsonId ?? 0}`} yukseklik="calc(100dvh - 64px)" />
        </div>
        {bildirimKutusu}
      </div>
    );
  }
  return (
    <div style={{ minHeight: "100dvh", background: "#f8fafc" }}>
      {ust}
      {baglanti === "kopuk" && <Alert variant="danger" className="py-1 px-2 small m-2">Sunucuyla bağlantı yok.</Alert>}
      {mutfakFisUyarisi(durum?.mutfakFis) && <Alert variant="warning" className="py-1 px-2 small m-2" role="alert" aria-label="Mutfak fişi uyarısı">{mutfakFisUyarisi(durum?.mutfakFis)}</Alert>}
      <div className="p-2">
        <div className="d-flex gap-2 overflow-auto pb-2" role="tablist" aria-label="Bölgeler">
          {[{ id: "tumu" as const, ad: "Tümü" }, ...(durum?.bolgeler || []).map((x) => ({ id: x.bolgeId, ad: x.ad }))].map((x) => {
            const s = bolge === x.id;
            return <button key={String(x.id)} type="button" role="tab" aria-selected={s} onClick={() => setBolge(x.id)} style={{ whiteSpace: "nowrap", borderRadius: 20, padding: "8px 16px", border: `1px solid ${s ? "#1e293b" : "#cbd5e1"}`, background: s ? "#1e293b" : "#fff", color: s ? "#fff" : "#1e293b", fontWeight: 600 }}>{x.ad}</button>;
          })}
        </div>
        {!durum ? <Spinner size="sm" /> : <MasaIzgarasi durum={durum} bolge={bolge} onSec={setAcik} buyuk />}
      </div>
      {bildirimKutusu}
    </div>
  );
};

export default GarsonPage;
