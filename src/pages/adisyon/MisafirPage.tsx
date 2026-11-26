import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Badge, Button, Form, Spinner } from "react-bootstrap";
import { IconBellRinging, IconMinus, IconPlus, IconReceipt, IconShoppingCart, IconToolsKitchen2, IconTrash } from "@tabler/icons-react";
import { AdisyonMenu, MenuUrunu } from "../../services/adisyonService";
import { MISAFIR_OTURUM_DUSTU, MisafirOzeti, MisafirService, misafirJeton } from "../../services/misafirService";
import { para } from "../../services/ticariService";
import { KALEM_DURUM } from "../../../Backend/src/services/adisyon/adisyonHesap";
import { UrunSecimModal } from "./UrunSecimModal";
import { BekleyenKalem, bekleyeneEkle, yeniIstekId } from "./adisyonBekleyen";

/** Misafir siparişinin sınırları (sunucuyla aynı: misafir.service.ts) */
const EN_COK_SATIR = 20, EN_COK_ADET = 20;
const DURUM_ADI: Record<number, string> = { [KALEM_DURUM.GONDERILMEDI]: "Alındı", [KALEM_DURUM.HAZIRLANIYOR]: "Hazırlanıyor", [KALEM_DURUM.HAZIR]: "Hazır", [KALEM_DURUM.SERVIS]: "Servis edildi" };
type Ekran = "yukleniyor" | "giris" | "masa";

/**
 * Masadaki misafir (docs/TICARI_ADISYON_YOL_HARITASI.md §11, M1–M8): /misafir?m=<müşteri no>&q=<masa kodu>. QR'ı okutan misafir masa adını
 * görür, garsonun verdiği 6 haneli PIN'le girer; menüden sipariş verir, adisyonunu ve toplamı görür, hesap ister, garson çağırır.
 * Ödeme / iptal yok. Personel girişine ve normal giriş ekranına dokunmaz.
 */
export const MisafirPage: React.FC = () => {
  const arama = useMemo(() => new URLSearchParams(window.location.search), []);
  const qr = arama.get("q");
  const [musteriNo, setMusteriNo] = useState(arama.get("m") || "");
  const [ekran, setEkran] = useState<Ekran>("yukleniyor");
  const [masaBilgi, setMasaBilgi] = useState<{ kisaAd: string; masa: string; masaAcik: boolean } | null>(null);
  const [pin, setPin] = useState("");
  const [hata, setHata] = useState<string | null>(null);
  const [bilgi, setBilgi] = useState<string | null>(null);
  const [mesgul, setMesgul] = useState(false);
  const [ozet, setOzet] = useState<MisafirOzeti | null>(null);
  const [menu, setMenu] = useState<AdisyonMenu | null>(null);
  const [grup, setGrup] = useState<number | null | "tumu">("tumu");
  const [sepet, setSepet] = useState<BekleyenKalem[]>([]);
  const [istekId, setIstekId] = useState<string | null>(null);
  const [secim, setSecim] = useState<MenuUrunu | null>(null);
  const [sekme, setSekme] = useState<"menu" | "hesap">("menu");

  const girisEkrani = useCallback((mesaj?: string) => { misafirJeton.sil(); setOzet(null); setPin(""); setEkran("giris"); if (mesaj) setHata(mesaj); }, []);
  useEffect(() => {
    const f = (e: Event) => girisEkrani((e as CustomEvent).detail?.mesaj || "Oturum kapandı.");
    window.addEventListener(MISAFIR_OTURUM_DUSTU, f);
    return () => window.removeEventListener(MISAFIR_OTURUM_DUSTU, f);
  }, [girisEkrani]);
  useEffect(() => {
    const baslik = document.title; document.title = "Masadan sipariş";
    return () => { document.title = baslik; };
  }, []);
  // Açılış: geçerli oturum varsa masa; QR varsa masa adı (PIN sorulmadan önce)
  useEffect(() => {
    (async () => {
      if (misafirJeton.oku()) { try { setOzet(await MisafirService.ben()); setEkran("masa"); return; } catch { /* oturum düştü */ } }
      if (qr && musteriNo) { try { setMasaBilgi(await MisafirService.qr(musteriNo, qr)); } catch (e: any) { setHata(e?.message || "Masa kodu okunamadı."); } }
      setEkran("giris");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (ekran !== "masa" || menu) return;
    MisafirService.menu().then(setMenu).catch((e: any) => setHata(e?.message || "Menü alınamadı."));
  }, [ekran, menu]);
  // Adisyon (mutfak durumu) yarım dakikada bir yenilenir
  useEffect(() => {
    if (ekran !== "masa") return;
    const t = setInterval(() => { MisafirService.ben().then(setOzet).catch(() => undefined); }, 30_000);
    return () => clearInterval(t);
  }, [ekran]);
  useEffect(() => { if (!bilgi) return; const t = setTimeout(() => setBilgi(null), 5000); return () => clearTimeout(t); }, [bilgi]);

  const gir = async () => {
    setMesgul(true); setHata(null);
    try { const r = await MisafirService.giris({ musteriNo: musteriNo.trim(), pin, qr }); misafirJeton.yaz(r.token); setOzet(r); setEkran("masa"); setPin(""); }
    catch (e: any) { setPin(""); setHata(e?.message || "Giriş yapılamadı."); }
    finally { setMesgul(false); }
  };
  const ekle = (u: MenuUrunu) => {
    if (u.porsiyonlar.length > 1 || u.secenekGrupIdler.length) { setSecim(u); return; }
    sepeteKoy({ stokKartId: u.stokKartId, ad: u.ad, miktar: 1, birim: u.birim, tartili: false, porsiyonId: u.porsiyonlar[0]?.porsiyonId ?? null, porsiyonAd: u.porsiyonlar[0]?.ad ?? null, secenekIdler: [], secimMetni: "", notu: "", birimFiyat: Number(u.fiyat) || 0 });
  };
  const sepeteKoy = (k: Omit<BekleyenKalem, "anahtar">) => {
    const yeni = bekleyeneEkle(sepet, { ...k, miktar: Math.min(EN_COK_ADET, k.miktar) }).map((x) => ({ ...x, miktar: Math.min(EN_COK_ADET, x.miktar) }));
    if (yeni.length > EN_COK_SATIR) { setHata(`Bir siparişte en çok ${EN_COK_SATIR} çeşit gönderilebilir; önce sepeti gönderin.`); return; }
    setSepet(yeni); setIstekId(null); setSecim(null); setBilgi(`${k.ad} sepete eklendi.`);
  };
  const adet = (anahtar: string, d: number) => { setSepet((s) => s.map((x) => (x.anahtar === anahtar ? { ...x, miktar: Math.max(1, Math.min(EN_COK_ADET, x.miktar + d)) } : x))); setIstekId(null); };
  const gonder = async () => {
    if (!sepet.length) return;
    // Aynı sepet yeniden gönderilirse aynı istek kimliği: bağlantı koptuysa sipariş iki kez yazılmaz
    const id = istekId || yeniIstekId();
    setIstekId(id); setMesgul(true); setHata(null);
    try {
      setOzet(await MisafirService.siparis({ istekId: id, kalemler: sepet.map((k) => ({ stokKartId: k.stokKartId, miktar: k.miktar, porsiyonId: k.porsiyonId, secenekIdler: k.secenekIdler, notu: k.notu || null })) }));
      setSepet([]); setIstekId(null); setSekme("hesap"); setBilgi("Siparişiniz mutfağa iletildi. Afiyet olsun!");
    } catch (e: any) { setHata(e?.message || "Sipariş gönderilemedi; yeniden deneyin."); }
    finally { setMesgul(false); }
  };
  const hesapIste = async () => {
    if (!window.confirm("Hesap istensin mi? Garsonunuz hesabı getirecek.")) return;
    try { setOzet(await MisafirService.hesapIste()); setBilgi("Hesap istendi; garsonunuz geliyor."); } catch (e: any) { setHata(e?.message || "Hesap istenemedi."); }
  };
  const cagir = async () => { try { await MisafirService.garsonCagir(); setBilgi("Garsonunuz çağrıldı."); } catch (e: any) { setBilgi(e?.message || "Garson çağrılamadı."); } };

  const kart = (icerik: React.ReactNode) => (
    <div style={{ minHeight: "100dvh", background: "linear-gradient(160deg,#7c2d12,#be123c)", display: "flex", alignItems: "center", justifyContent: "center", padding: 12 }}>
      <div style={{ width: "100%", maxWidth: 420, background: "#fff", borderRadius: 18, padding: 20, boxShadow: "0 10px 30px rgba(0,0,0,.25)" }}>
        <div className="d-flex align-items-center gap-2 mb-2"><IconToolsKitchen2 size={26} color="#be123c" /><span className="fw-bold fs-5">{masaBilgi?.kisaAd || "Masadan sipariş"}</span></div>
        {hata && <Alert variant="danger" className="py-2 small" onClose={() => setHata(null)} dismissible>{hata}</Alert>}
        {icerik}
      </div>
    </div>
  );
  if (ekran === "yukleniyor") return kart(<div className="text-center py-4"><Spinner /></div>);
  if (ekran === "giris") return kart(
    <Form onSubmit={(e) => { e.preventDefault(); void gir(); }}>
      {masaBilgi && <div className="text-center mb-3"><div className="small text-muted">Masanız</div><div className="fw-bold fs-4">{masaBilgi.masa}</div>
        {!masaBilgi.masaAcik && <Alert variant="warning" className="py-2 small mt-2 mb-0">Masa henüz açılmadı. Garsonunuz masayı açıp size PIN verecek.</Alert>}</div>}
      {!qr && <>
        <Form.Label className="fw-bold">Restoran müşteri no</Form.Label>
        <Form.Control size="lg" aria-label="Müşteri no" value={musteriNo} autoCapitalize="characters" onChange={(e) => setMusteriNo(e.target.value)} />
      </>}
      <Form.Label className="fw-bold mt-2">Masa PIN'i</Form.Label>
      <Form.Control size="lg" aria-label="Masa PIN" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={pin} autoFocus
        style={{ fontSize: 30, letterSpacing: 10, textAlign: "center", fontWeight: 700 }} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))} />
      <Button type="submit" size="lg" variant="danger" className="w-100 mt-3" disabled={pin.length !== 6 || !musteriNo.trim() || mesgul}>{mesgul ? <Spinner size="sm" /> : "Masaya gir"}</Button>
      <div className="small text-muted mt-3">PIN'i garsonunuz verir; yalnız bu masanın açık hesabında geçerlidir.</div>
    </Form>
  );

  // ── Masa: menü + sepet + hesabım
  const urunler = (menu?.urunler || []).filter((u) => !u.tartili && u.fiyat !== null && (grup === "tumu" || u.stokGrupId === grup));
  const sepetToplam = sepet.reduce((t, k) => t + k.miktar * k.birimFiyat, 0);
  return (
    <div style={{ minHeight: "100dvh", background: "#fff7ed", paddingBottom: sepet.length ? 96 : 16 }}>
      <div className="d-flex align-items-center gap-2 px-3" style={{ height: 52, background: "#7c2d12", color: "#fff", position: "sticky", top: 0, zIndex: 5 }}>
        <IconToolsKitchen2 size={20} color="#fdba74" />
        <span className="fw-bold text-truncate">{ozet?.kisaAd}</span>
        <Badge bg="light" text="dark" className="ms-auto">{ozet?.masa}</Badge>
      </div>
      {/* Bildirim üst katmanda: içeriği aşağı itmesin (art arda dokunuş yanlış ürüne gitmesin) */}
      {bilgi && <Alert variant="success" className="py-2 small mb-0 shadow" role="status" style={{ position: "fixed", top: 56, left: 8, right: 8, zIndex: 20, pointerEvents: "none" }}>{bilgi}</Alert>}
      {hata && <Alert variant="danger" className="py-2 small m-2" onClose={() => setHata(null)} dismissible>{hata}</Alert>}
      <div className="d-flex gap-2 p-2">
        <Button variant={sekme === "menu" ? "dark" : "outline-dark"} className="flex-fill" onClick={() => setSekme("menu")}>Menü</Button>
        <Button variant={sekme === "hesap" ? "dark" : "outline-dark"} className="flex-fill" onClick={() => setSekme("hesap")}><IconReceipt size={16} className="me-1" />Hesabım {ozet ? para(ozet.toplam) : ""}</Button>
      </div>
      {sekme === "menu" ? (
        <div className="px-2">
          {!menu ? <Spinner size="sm" /> : <>
            <div className="d-flex gap-2 overflow-auto pb-2" role="tablist" aria-label="Ürün grupları">
              {[{ id: "tumu" as const, ad: "Tümü" }, ...menu.gruplar.map((g) => ({ id: g.stokGrupId, ad: g.ad }))].map((g) => (
                <button key={String(g.id)} type="button" role="tab" aria-selected={grup === g.id} onClick={() => setGrup(g.id)}
                  style={{ whiteSpace: "nowrap", borderRadius: 20, padding: "6px 14px", border: "1px solid #9a3412", background: grup === g.id ? "#9a3412" : "#fff", color: grup === g.id ? "#fff" : "#9a3412", fontWeight: 600 }}>{g.ad}</button>
              ))}
            </div>
            {!urunler.length && <div className="text-muted small p-2">Bu grupta ürün yok.</div>}
            {urunler.map((u) => (
              <div key={u.stokKartId} className="d-flex align-items-center bg-white border rounded-3 p-2 mb-2">
                <div className="flex-grow-1"><div className="fw-semibold">{u.ad}</div><div className="small text-muted">{para(Number(u.fiyat))}{u.porsiyonlar.length > 1 ? " · porsiyon seçilir" : ""}</div></div>
                <Button variant="danger" aria-label={`${u.ad} ekle`} onClick={() => ekle(u)}><IconPlus size={18} /></Button>
              </div>
            ))}
          </>}
        </div>
      ) : (
        <div className="px-2">
          {ozet?.hesapIstendi && <Alert variant="warning" className="py-2 small">Hesap istendi; garsonunuz geliyor.</Alert>}
          <div className="bg-white border rounded-3">
            {!ozet?.kalemler.length && <div className="text-muted small p-3">Henüz sipariş yok.</div>}
            {ozet?.kalemler.map((k, i) => (
              <div key={i} className="d-flex align-items-start p-2 border-bottom small">
                <div className="flex-grow-1"><div className="fw-semibold">{k.miktar} × {k.ad}{k.porsiyon ? ` (${k.porsiyon})` : ""}</div>{k.secim && <div className="text-muted">{k.secim}</div>}<div className="text-muted">{DURUM_ADI[k.durum] || ""}</div></div>
                <div className="fw-bold text-nowrap">{k.ikram ? "İkram" : para(k.tutar)}</div>
              </div>
            ))}
            {!!ozet?.servis && <div className="d-flex p-2 small"><span>Servis</span><span className="ms-auto">{para(ozet.servis)}</span></div>}
            <div className="d-flex p-2 fw-bold"><span>Toplam</span><span className="ms-auto">{para(ozet?.toplam || 0)}</span></div>
          </div>
          <div className="d-flex gap-2 mt-3">
            <Button variant="outline-dark" className="flex-fill" onClick={() => void cagir()}><IconBellRinging size={16} className="me-1" />Garson çağır</Button>
            <Button variant="warning" className="flex-fill" disabled={!ozet?.kalemler.length || ozet?.hesapIstendi} onClick={() => void hesapIste()}><IconReceipt size={16} className="me-1" />Hesap iste</Button>
          </div>
          <div className="small text-muted mt-2">Ödemeyi garsonunuza ya da kasaya yaparsınız.</div>
        </div>
      )}
      {sepet.length > 0 && (
        <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, background: "#fff", borderTop: "1px solid #fed7aa", padding: 10, zIndex: 10, maxHeight: "60dvh", overflow: "auto" }} aria-label="Sepet">
          {sepet.map((k) => (
            <div key={k.anahtar} className="d-flex align-items-center gap-2 small mb-1">
              <span className="flex-grow-1 text-truncate">{k.ad}{k.porsiyonAd ? ` (${k.porsiyonAd})` : ""}{k.secimMetni ? ` · ${k.secimMetni}` : ""}</span>
              <Button size="sm" variant="outline-secondary" className="py-0 px-1" aria-label="Azalt" onClick={() => (k.miktar > 1 ? adet(k.anahtar, -1) : setSepet((s) => s.filter((x) => x.anahtar !== k.anahtar)))}>{k.miktar > 1 ? <IconMinus size={12} /> : <IconTrash size={12} />}</Button>
              <b>{k.miktar}</b>
              <Button size="sm" variant="outline-secondary" className="py-0 px-1" aria-label="Artır" onClick={() => adet(k.anahtar, 1)}><IconPlus size={12} /></Button>
            </div>
          ))}
          <Button variant="success" size="lg" className="w-100 mt-1" disabled={mesgul} onClick={() => void gonder()}>
            {mesgul ? <Spinner size="sm" /> : <><IconShoppingCart size={18} className="me-1" />Siparişi gönder · {para(sepetToplam)}</>}
          </Button>
        </div>
      )}
      {secim && menu && <UrunSecimModal urun={secim} gruplar={menu.secenekGruplari} onEkle={sepeteKoy} kapat={() => setSecim(null)} buyuk />}
    </div>
  );
};

export default MisafirPage;
