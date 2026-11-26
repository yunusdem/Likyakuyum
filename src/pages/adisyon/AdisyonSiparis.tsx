import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Badge, Button, Card, Dropdown, Form, InputGroup, Spinner } from "react-bootstrap";
import { IconArrowLeft, IconBellRinging, IconCash, IconChefHat, IconCloudUpload, IconMinus, IconPlus, IconPrinter, IconScale, IconSearch, IconTrash, IconUsers, IconX } from "@tabler/icons-react";
import { useToast } from "../../context/ToastContext";
import { AdisyonAyrinti, AdisyonKalemi, AdisyonMenu, AdisyonService, HesapDurumu, KalemSecimi, MasaDurumu, MasaOzeti, MenuUrunu, MusteriGirdi, OdemeGirdi, PaketBilgisi, SiparisGirdi, TahsilatSonucu, UrunTasimaSonucu } from "../../services/adisyonService";
import { PaketMusteriModal } from "./AdisyonPaket";
import { OdemeModal, TahsilatTuru } from "./AdisyonOdeme";
import type { AdisyonKasa } from "./adisyonKasa";
import { FiyatModal, HedefMasaModal, IndirimModal, KalemIslemModal, KalemIslemi, NedenModal } from "./AdisyonIslemleri";
import { para } from "../../services/ticariService";
import { KALEM_DURUM, PAKET_DURUM, PAKET_DURUM_ADI, kalemBirimFiyati, sureYaz, telefonYaz } from "../../../Backend/src/services/adisyon/adisyonHesap";
import { tartiBirimi } from "../../../Backend/src/services/ticari/ticariHesap";
import { TartiModal, TartiSorusu } from "../hizliSatis/TartiModal";
import { UrunSecimModal } from "./UrunSecimModal";
import { MisafirPinBilgisi, MisafirPinModal } from "./MisafirPinModal";
import { BekleyenKalem, BekleyenSepet, bekleyenOku, bekleyenYaz, bekleyeneEkle, belirsizBeklemesi, belirsizOtomatikMi, kesinRetMi, yeniIstekId } from "./adisyonBekleyen";

/** Sipariş ekranının sunucu uçları: PC'de oturum jetonu (AdisyonService), garson adresinde garson jetonu (D4) */
export interface SiparisApi {
  menu: (bolgeId: number | null) => Promise<AdisyonMenu>;
  getir: (adisyonId: number) => Promise<AdisyonAyrinti>;
  siparis: (g: SiparisGirdi) => Promise<AdisyonAyrinti & { tekrar: boolean }>;
  kisi: (adisyonId: number, kisi: number) => Promise<AdisyonAyrinti>;
  /** Hazır kalemi servis edildi say (D5) */
  servis?: (kalemIdler: number[]) => Promise<unknown>;
  /** Masa işlemleri (D6) */
  yetkiler?: () => Promise<string[]>;
  masalar?: () => Promise<MasaDurumu>;
  ikram?: (adisyonId: number, kalemler: KalemSecimi[], g: { ikram?: boolean; neden?: string; aciklama?: string; istekId?: string }) => Promise<AdisyonAyrinti>;
  iptal?: (adisyonId: number, kalemler: KalemSecimi[], g: { neden: string; aciklama?: string; istekId?: string }) => Promise<AdisyonAyrinti>;
  adisyonIptal?: (adisyonId: number, g: { neden: string; aciklama?: string }) => Promise<AdisyonAyrinti>;
  masaTasi?: (adisyonId: number, masaId: number) => Promise<AdisyonAyrinti>;
  birlestir?: (adisyonId: number, hedefAdisyonId: number) => Promise<AdisyonAyrinti>;
  urunTasi?: (adisyonId: number, kalemler: KalemSecimi[], hedef: { masaId?: number; adisyonId?: number; istekId?: string }) => Promise<UrunTasimaSonucu>;
  /** Hesap / tahsilat (D7) */
  hesap?: (adisyonId: number) => Promise<HesapDurumu>;
  hesapIste?: (adisyonId: number) => Promise<TahsilatSonucu>;
  odemeEkle?: (adisyonId: number, g: OdemeGirdi & { istekId: string; musteri?: MusteriGirdi | null }) => Promise<TahsilatSonucu>;
  odemeSil?: (odemeId: number) => Promise<TahsilatSonucu>;
  kapat?: (adisyonId: number, g: { istekId: string; odemeler: OdemeGirdi[]; musteri?: MusteriGirdi | null }) => Promise<TahsilatSonucu>;
  urunleOde?: (adisyonId: number, g: { istekId: string; kalemler: KalemSecimi[]; odemeler: OdemeGirdi[]; musteri?: MusteriGirdi | null }) => Promise<TahsilatSonucu>;
  /** İndirim / kalem fiyatı (K1, TA25) */
  indirim?: (adisyonId: number, g: { tur: number; deger?: number; neden?: string }) => Promise<TahsilatSonucu>;
  fiyatDegistir?: (adisyonId: number, g: { kalemId: number; fiyat: number; neden: string }) => Promise<AdisyonAyrinti>;
  /** Masadaki misafirin PIN'i (§11 M2–M3) */
  misafirPin?: (adisyonId: number, yenile: boolean) => Promise<MisafirPinBilgisi>;
  /** Paket / gel-al (D8) */
  paketDurum?: (adisyonId: number, durum: number) => Promise<AdisyonAyrinti>;
  paketGuncelle?: (adisyonId: number, g: PaketBilgisi) => Promise<AdisyonAyrinti>;
  paketMusteri?: (tel: string) => Promise<{ ad: string | null; adres: string | null; siparisSayisi: number } | null>;
}
const PC_API: SiparisApi = {
  menu: AdisyonService.menu, getir: AdisyonService.getir, siparis: AdisyonService.siparis, kisi: AdisyonService.kisi, servis: AdisyonService.servis,
  yetkiler: AdisyonService.yetkilerim, masalar: AdisyonService.masalar, ikram: AdisyonService.ikram, iptal: AdisyonService.iptal, adisyonIptal: AdisyonService.adisyonIptal,
  masaTasi: AdisyonService.masaTasi, birlestir: AdisyonService.birlestir, urunTasi: AdisyonService.urunTasi,
  hesap: AdisyonService.hesap, hesapIste: AdisyonService.hesapIste, odemeEkle: AdisyonService.odemeEkle, odemeSil: AdisyonService.odemeSil, kapat: AdisyonService.kapat, urunleOde: AdisyonService.urunleOde,
  paketDurum: AdisyonService.paketDurum, paketGuncelle: (id, g) => AdisyonService.paketGuncelle(id, g), paketMusteri: AdisyonService.paketMusteri,
  indirim: AdisyonService.indirim, fiyatDegistir: AdisyonService.fiyatDegistir, misafirPin: AdisyonService.misafirPin,
};

const DURUM_ROZET: Record<number, { ad: string; renk: string }> = {
  [KALEM_DURUM.GONDERILMEDI]: { ad: "Bekliyor", renk: "#64748b" },
  [KALEM_DURUM.HAZIRLANIYOR]: { ad: "Hazırlanıyor", renk: "#d97706" },
  [KALEM_DURUM.HAZIR]: { ad: "Hazır", renk: "#16a34a" },
  [KALEM_DURUM.SERVIS]: { ad: "Serviste", renk: "#0284c7" },
};
const miktarYazi = (m: number, birim: string, tartili: boolean) => (tartili ? `${String(m).replace(".", ",")} ${birim}` : `${m} ×`);

/**
 * Masanın sipariş ekranı (TA22, TA26, TA28): solda adisyon + gönderilmemiş sipariş, sağda ürün seçimi (grup, arama / barkod,
 * porsiyon / seçenek / not penceresi, tartılı üründe tartı penceresi). "Gönder" tek istek kimliğiyle; cevap gelmezse liste kilitlenir
 * ve aynı kimlikle yeniden gönderilir (TA39).
 */
export const AdisyonSiparis: React.FC<{
  masa: { masaId: number; ad: string; bolgeId: number; bolgeAd: string };
  adisyonId: number | null;
  /** Bu masayla ilgili olay geldiğinde artar: ekran adisyonu yeniden okur */
  yenile: number;
  onGeri: () => void;
  onDegisti?: () => void;
  api?: SiparisApi;
  yerlesim?: "pc" | "telefon";
  /** localStorage anahtarı öneki (PC / garson ayrı) */
  saklamaOnEki?: string;
  /** Ekran yüksekliği (garson adresinde üst çubuk payı) */
  yukseklik?: string;
  /** Masa taşıma / birleştirme / ayırmadan sonra ekranın geçeceği masa (D6) */
  onMasaGit?: (masaId: number) => void;
  /** Kasa PC tahsilat yardımcıları (POS, baskı, banka / cari); garson telefonunda yok (yalnız nakit / kart) */
  kasa?: AdisyonKasa;
  /** Yeni paket / gel-al (D8): ilk gönderimde bu müşteriyle adisyon açılır (masa yok) */
  paket?: PaketBilgisi | null;
  /** Yeni paket ilk gönderimde açılınca (ekran adisyon kimliğine geçer) */
  onAdisyonAcildi?: (adisyonId: number) => void;
}> = ({ masa, adisyonId, yenile, onGeri, onDegisti, api = PC_API, yerlesim = "pc", saklamaOnEki = "pc", yukseklik, onMasaGit, kasa, paket, onAdisyonAcildi }) => {
  const { showError, showSuccess, showWarning } = useToast();
  const [menu, setMenu] = useState<AdisyonMenu | null>(null);
  const [adisyon, setAdisyon] = useState<AdisyonAyrinti | null>(null);
  const [sepet, setSepetIc] = useState<BekleyenSepet>(() => bekleyenOku(masa.masaId, saklamaOnEki));
  const [grup, setGrup] = useState<number | null | "tumu">("tumu");
  const [arama, setArama] = useState("");
  const [secim, setSecim] = useState<{ urun: MenuUrunu; miktar: number | null } | null>(null);
  const [tarti, setTarti] = useState<TartiSorusu | null>(null);
  const [gonderiliyor, setGonderiliyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [kisi, setKisi] = useState<number | null>(null);
  const [sekme, setSekme] = useState<"urun" | "adisyon">("urun");
  const aktifAdisyonId = useRef<number | null>(adisyonId);
  const telefon = yerlesim === "telefon";
  // Masa işlemleri (D6)
  const [yetkiler, setYetkiler] = useState<string[]>([]);
  const [islemKalem, setIslemKalem] = useState<AdisyonKalemi | null>(null);
  // istekId: işlem penceresi açılırken üretilir; cevap kaybolup yeniden denenirse aynı kimlik gider, sunucu kısmi işlemi ikinci kez uygulamaz
  const [nedenIs, setNedenIs] = useState<{ tur: "ikram" | "iptal" | "adisyon-iptal"; kalem?: AdisyonKalemi; miktar?: number; istekId?: string } | null>(null);
  const [hedefIs, setHedefIs] = useState<{ tur: "masa-tasi" | "birlestir" | "urun-tasi"; kalem?: AdisyonKalemi; miktar?: number; istekId?: string } | null>(null);
  const [masaDurumu, setMasaDurumu] = useState<MasaDurumu | null>(null);
  // İndirim / kalem fiyatı (K1)
  const [fiyatKalem, setFiyatKalem] = useState<AdisyonKalemi | null>(null);
  const [indirimAcik, setIndirimAcik] = useState(false);
  const [misafirPinAdisyon, setMisafirPinAdisyon] = useState<number | null>(null);
  // Hesap / tahsilat (D7)
  const [odemeAcik, setOdemeAcik] = useState(false);
  const [hesapMesgul, setHesapMesgul] = useState(false);
  // Paket / gel-al (D8)
  const [musteriDuzenle, setMusteriDuzenle] = useState(false);
  useEffect(() => { api.yetkiler?.().then(setYetkiler).catch(() => setYetkiler([])); }, [api]);

  const setSepet = useCallback((s: BekleyenSepet) => { setSepetIc(s); bekleyenYaz(masa.masaId, s, saklamaOnEki); }, [masa.masaId, saklamaOnEki]);
  useEffect(() => { api.menu(masa.bolgeId).then(setMenu).catch((e) => setHata(e?.message || "Menü alınamadı.")); }, [api, masa.bolgeId]);
  const adisyonOku = useCallback(async () => {
    const id = aktifAdisyonId.current;
    if (!id) { setAdisyon(null); return; }
    try { const a = await api.getir(id); setAdisyon(a); setKisi(a.kisiSayisi); } catch (e: any) { if (e?.status === 404) setAdisyon(null); }
  }, [api]);
  useEffect(() => { aktifAdisyonId.current = adisyonId ?? aktifAdisyonId.current; void adisyonOku(); }, [adisyonId, yenile, adisyonOku]);

  const urunler = useMemo(() => {
    if (!menu) return [];
    const t = arama.trim().toLocaleLowerCase("tr-TR");
    return menu.urunler.filter((u) => (grup === "tumu" || u.stokGrupId === grup) && (!t || u.ad.toLocaleLowerCase("tr-TR").includes(t) || u.kod.toLocaleLowerCase("tr-TR").includes(t) || u.barkodlar.some((b) => b === t)));
  }, [menu, grup, arama]);

  const sepeteEkle = (k: Omit<BekleyenKalem, "anahtar">) => {
    if (sepet.belirsiz) { showWarning?.("Önceki gönderim sonuçlanmadı; önce onu tamamlayın."); return; }
    setSepet({ ...sepet, istekId: null, kalemler: bekleyeneEkle(sepet.kalemler, k) });
    setSecim(null);
  };
  const urunSec = (u: MenuUrunu, tartiMiktari?: number) => {
    if (u.fiyat === null) { showWarning?.(`${u.ad}: satış fiyatı yok.`); return; }
    const tb = tartiBirimi(u.birim);
    if (u.tartili && tb && tartiMiktari === undefined) {
      setTarti({ ad: u.ad, kartBirimi: tb, birimFiyat: u.fiyat, onay: (m) => { setTarti(null); urunSec(u, m); } });
      return;
    }
    if (u.porsiyonlar.length || u.secenekGrupIdler.length) { setSecim({ urun: u, miktar: tartiMiktari ?? null }); return; }
    sepeteEkle({ stokKartId: u.stokKartId, ad: u.ad, miktar: tartiMiktari ?? 1, birim: u.birim, tartili: u.tartili, porsiyonId: null, porsiyonAd: null, secenekIdler: [], secimMetni: "", notu: "", birimFiyat: kalemBirimFiyati(u.fiyat, 1, null, 0) });
  };
  const aramaEnter = () => {
    const t = arama.trim();
    if (!t || !menu) return;
    const b = menu.urunler.find((u) => u.barkodlar.includes(t) || u.kod.toLocaleLowerCase("tr-TR") === t.toLocaleLowerCase("tr-TR"));
    const hedef = b ?? (urunler.length === 1 ? urunler[0] : null);
    if (hedef) { urunSec(hedef); setArama(""); }
  };
  const miktarDegistir = (anahtar: string, fark: number) => {
    if (sepet.belirsiz) return;
    setSepet({ ...sepet, istekId: null, kalemler: sepet.kalemler.map((k) => (k.anahtar === anahtar && !k.tartili ? { ...k, miktar: Math.min(999, Math.max(1, k.miktar + fark)) } : k)) });
  };
  const sil = (anahtar: string) => { if (!sepet.belirsiz) setSepet({ ...sepet, istekId: null, kalemler: sepet.kalemler.filter((k) => k.anahtar !== anahtar) }); };

  const gonder = useCallback(async (s: BekleyenSepet) => {
    if (!s.kalemler.length || gonderiliyor) return;
    const istekId = s.istekId || yeniIstekId();
    // İstek atılmadan ÖNCE sepet "belirsiz" (kilitli, kimlikli) olarak saklanır: gönderim sürerken sayfa yenilenir / masadan çıkılıp
    // geri girilirse sepet kilitsiz geri gelip yeni kimlikle ikinci kez gönderilemesin (26.11.2026 denetimi)
    // O12: yeni paketin müşterisi ilk denemede sepete yazılır; yeniden gönderimde o müşteri kullanılır
    const paketBilgisi = !aktifAdisyonId.current ? (s.paket ?? paket ?? null) : null;
    const kayitli: BekleyenSepet = { ...s, istekId, belirsiz: true, zaman: s.zaman || Date.now(), adisyonId: s.zaman ? s.adisyonId ?? null : aktifAdisyonId.current, paket: paketBilgisi };
    setSepet(kayitli);
    setGonderiliyor(true);
    setHata(null);
    try {
      const yeniPaket = paketBilgisi;
      const r = await api.siparis({ istekId, masaId: yeniPaket || paket || (adisyon && adisyon.tur !== 1) ? null : masa.masaId, adisyonId: aktifAdisyonId.current, kisi: aktifAdisyonId.current || paket ? null : kisi, paket: yeniPaket,
        kalemler: s.kalemler.map((k) => ({ stokKartId: k.stokKartId, miktar: k.miktar, porsiyonId: k.porsiyonId, secenekIdler: k.secenekIdler, notu: k.notu || null })) });
      const ilkAcilis = !aktifAdisyonId.current;
      aktifAdisyonId.current = r.adisyonId;
      setAdisyon(r);
      setKisi(r.kisiSayisi);
      setSepet({ istekId: null, belirsiz: false, kalemler: [] });
      denemeRef.current = 0;
      showSuccess?.(r.tekrar ? "Sipariş daha önce ulaşmış; tekrar yazılmadı." : `${s.kalemler.length} kalem gönderildi.`);
      if (telefon) setSekme("adisyon");
      onDegisti?.();
      if (ilkAcilis && yeniPaket) onAdisyonAcildi?.(r.adisyonId);
    } catch (e: any) {
      if (kesinRetMi(e)) {
        setSepet({ ...kayitli, istekId: null, belirsiz: false, zaman: null, adisyonId: null, paket: null });
        denemeRef.current = 0;
        setHata(e?.message || "Sipariş gönderilemedi.");
        // Ürün pasif / fiyatsız / porsiyon değişmiş olabilir: menü yeniden okunur
        api.menu(masa.bolgeId).then(setMenu).catch(() => undefined);
        if (e?.status === 409) { void adisyonOku(); onDegisti?.(); }
      } else {
        denemeRef.current++;
        setSepet({ ...kayitli, belirsiz: true });
        setHata("Bağlantı sorunu: sipariş ulaştı mı bilinmiyor. Liste korunuyor; bağlantı gelince aynı kimlikle yeniden gönderilir (çift kayıt olmaz).");
      }
    } finally {
      setGonderiliyor(false);
    }
  }, [api, masa.masaId, kisi, gonderiliyor, setSepet, showSuccess, adisyonOku, onDegisti, telefon, paket, adisyon, onAdisyonAcildi]);
  // Sonucu belirsiz gönderim: 5 sn'de bir aynı kimlikle yeniden dene; bu masaya olay gelirse (sunucu yaşıyor, belki sipariş
  // ulaştı) beklemeden dene — adisyon ile bekleyen listede aynı kalemin birlikte göründüğü ara durum kısa sürsün
  const sepetRef = useRef(sepet);
  sepetRef.current = sepet;
  const denemeRef = useRef(0);
  // Kendiliğinden yeniden gönderim yalnız TAZE (3 dk) ve aynı adisyona ait belirsiz sepette; bekleme her denemede uzar (5 sn → 60 sn).
  // Eskimiş belirsiz sepet (ör. dünden kalan) sorulmadan gönderilmez: kullanıcı "Yeniden gönder" ya da "Vazgeç" der.
  const otomatik = belirsizOtomatikMi(sepet, Date.now(), aktifAdisyonId.current);
  useEffect(() => {
    if (!sepet.belirsiz || gonderiliyor || !belirsizOtomatikMi(sepet, Date.now(), aktifAdisyonId.current)) return;
    const t = setTimeout(() => void gonder(sepet), belirsizBeklemesi(denemeRef.current));
    return () => clearTimeout(t);
  }, [sepet, gonderiliyor, gonder]);
  const ilkYenile = useRef(yenile);
  useEffect(() => {
    if (yenile === ilkYenile.current) return;
    if (sepetRef.current.belirsiz && !gonderiliyor && belirsizOtomatikMi(sepetRef.current, Date.now(), aktifAdisyonId.current)) void gonder(sepetRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yenile]);

  const kisiKaydet = async (k: number) => {
    setKisi(k);
    if (!aktifAdisyonId.current) return;
    try { setAdisyon(await api.kisi(aktifAdisyonId.current, k)); onDegisti?.(); } catch (e: any) { showError?.(e?.message || "Kişi sayısı kaydedilemedi."); }
  };

  const servisEt = async (ids: number[]) => {
    if (!api.servis || !ids.length) return;
    try { await api.servis(ids); await adisyonOku(); onDegisti?.(); } catch (e: any) { showError?.(e?.message || "Kaydedilemedi."); }
  };
  const hazirKalemler = (adisyon?.kalemler || []).filter((k) => k.durum === KALEM_DURUM.HAZIR && !k.iptal);
  // ── Masa işlemleri (D6)
  const secimi = (k: AdisyonKalemi, miktar?: number): KalemSecimi[] => [{ kalemId: k.kalemId, ...(miktar !== undefined && miktar !== k.miktar ? { miktar } : {}) }];
  const yenidenOku = async (a?: AdisyonAyrinti) => { if (a) { setAdisyon(a); setKisi(a.kisiSayisi); } else await adisyonOku(); onDegisti?.(); };
  const kalemIslemi = async (islem: KalemIslemi, miktar: number) => {
    const k = islemKalem;
    setIslemKalem(null);
    if (!k || !aktifAdisyonId.current) return;
    if (islem === "servis") return void servisEt([k.kalemId]);
    if (islem === "ikram" || islem === "iptal") return setNedenIs({ tur: islem, kalem: k, miktar, istekId: yeniIstekId() });
    if (islem === "fiyat") return setFiyatKalem(k);
    if (islem === "tasi") { setHedefIs({ tur: "urun-tasi", kalem: k, miktar, istekId: yeniIstekId() }); api.masalar?.().then(setMasaDurumu).catch(() => undefined); return; }
    if (islem === "ikram-geri" && api.ikram) {
      try { await yenidenOku(await api.ikram(aktifAdisyonId.current, secimi(k), { ikram: false })); showSuccess?.("İkram geri alındı."); } catch (e: any) { showError?.(e?.message || "Yapılamadı."); }
    }
  };
  const nedenOnay = async (neden: string, aciklama: string) => {
    const n = nedenIs, id = aktifAdisyonId.current;
    if (!n || !id) return;
    if (n.tur === "ikram" && n.kalem && api.ikram) { await yenidenOku(await api.ikram(id, secimi(n.kalem, n.miktar), { neden, aciklama, istekId: n.istekId })); showSuccess?.("İkram edildi."); }
    else if (n.tur === "iptal" && n.kalem && api.iptal) { await yenidenOku(await api.iptal(id, secimi(n.kalem, n.miktar), { neden, aciklama, istekId: n.istekId })); showSuccess?.("İptal edildi."); }
    else if (n.tur === "adisyon-iptal" && api.adisyonIptal) { await api.adisyonIptal(id, { neden, aciklama }); showSuccess?.("Adisyon iptal edildi; masa boşaldı."); onDegisti?.(); setNedenIs(null); onGeri(); return; }
    setNedenIs(null);
  };
  const hedefAc = (tur: "masa-tasi" | "birlestir") => { setHedefIs({ tur }); setMasaDurumu(null); api.masalar?.().then(setMasaDurumu).catch(() => undefined); };
  const hedefSec = async (m: MasaOzeti) => {
    const h = hedefIs, id = aktifAdisyonId.current;
    if (!h || !id) return;
    if (h.tur === "masa-tasi" && api.masaTasi) { await api.masaTasi(id, m.masaId); showSuccess?.(`Masa ${m.ad}'e taşındı.`); setHedefIs(null); onDegisti?.(); onMasaGit?.(m.masaId); return; }
    if (h.tur === "birlestir" && api.birlestir && m.adisyon) { await api.birlestir(id, m.adisyon.adisyonId); showSuccess?.(`Masa ${m.ad} ile birleştirildi.`); setHedefIs(null); onDegisti?.(); onMasaGit?.(m.masaId); return; }
    if (h.tur === "urun-tasi" && api.urunTasi && h.kalem) {
      const r = await api.urunTasi(id, secimi(h.kalem, h.miktar), { masaId: m.masaId, istekId: h.istekId });
      showSuccess?.(`${h.kalem.ad} Masa ${m.ad}'e taşındı.`);
      setHedefIs(null);
      if (r.kaynakKapandi) { onDegisti?.(); onMasaGit?.(m.masaId); } else await yenidenOku(r.kaynak);
    }
  };
  // ── Hesap / tahsilat (D7)
  // Art arda dokunuş koruması (yavaş ağda her dokunuş ayrı istek / kasada ayrı bildirim olmasın)
  const islemde = useRef<Set<string>>(new Set());
  const hesapIste = async (sessiz = false) => {
    const id = aktifAdisyonId.current;
    if (!id || !api.hesapIste || islemde.current.has("hesap")) return;
    islemde.current.add("hesap");
    setTimeout(() => islemde.current.delete("hesap"), 3000);
    try { const r = await api.hesapIste(id); setAdisyon(r); onDegisti?.(); if (!sessiz) showSuccess?.("Hesap istendi; kasaya bildirildi."); } catch (e: any) { showError?.(e?.message || "Hesap istenemedi."); }
  };
  const hesapFisi = async () => {
    const id = aktifAdisyonId.current;
    if (!id || !api.hesap || !kasa || !adisyon) return;
    setHesapMesgul(true);
    try {
      const h = await api.hesap(id);
      const u = await kasa.hesapFisiBas(adisyon, h, masa.ad);
      if (u) showWarning?.(u); else showSuccess?.("Hesap fişi yazdırıldı.");
      // Hesap fişi verilen masa "hesap istendi" görünür (pakette fiş kurye fişidir; durum değişmez)
      if (adisyon.durum === 0 && adisyon.tur === 1 && yetkiler.includes("hesap-iste")) await hesapIste(true);
    } catch (e: any) { showError?.(e?.message || "Hesap fişi hazırlanamadı."); } finally { setHesapMesgul(false); }
  };
  const tahsilatSonrasi = async (r: TahsilatSonucu, yeni: OdemeGirdi[], tur: TahsilatTuru, yeniFisler: { faturaId: number; faturaNo: string }[]) => {
    setAdisyon(r);
    setKisi(r.kisiSayisi);
    if (kasa && yeniFisler.length) for (const u of await kasa.tahsilatSonrasi(r, yeni, tur, yeniFisler)) showWarning?.(u, 8000);
    const fisYazi = yeniFisler.length ? ` Fiş: ${yeniFisler.map((f) => f.faturaNo).join(", ")}` : "";
    if (r.kapandi) { showSuccess?.(`Masa ${masa.ad} kapandı.${fisYazi}`); setOdemeAcik(false); onDegisti?.(); onGeri(); return; }
    if (yeniFisler.length) showSuccess?.(`Ödendi.${fisYazi}`);
    else if (tur === "ara" && yeni.length) showSuccess?.(`${para(yeni[0].tutar)} TL alındı; kalan ${para(r.hesap.kalan)} TL.`);
    onDegisti?.();
  };
  const odemeApi = api.hesap && api.odemeEkle && api.odemeSil && api.kapat && api.urunleOde
    ? { hesap: api.hesap, odemeEkle: api.odemeEkle, odemeSil: api.odemeSil, kapat: api.kapat, urunleOde: api.urunleOde } : null;
  const odenmisTutar = Math.round((adisyon?.kalemler || []).filter((k) => k.faturaId).reduce((t, k) => t + k.tutar, 0) * 100) / 100;
  const acikAdisyon = !!adisyon && (adisyon.durum === 0 || adisyon.durum === 1);
  // Paket / gel-al (D8): masa işlemleri yok; müşteri ve durum akışı başlıkta
  const paketTuru = paket?.tur ?? (adisyon && adisyon.tur !== 1 ? adisyon.tur : null);
  const paketMi = !!paketTuru;
  const paketMusteri = paket ? { ad: paket.ad, tel: paket.tel, adres: paket.adres, not: paket.not } : adisyon ? { ad: adisyon.musteriAd || "", tel: adisyon.musteriTel ?? null, adres: adisyon.musteriAdres ?? null, not: adisyon.aciklama } : null;
  const paketDurumu = adisyon?.paketDurum ?? PAKET_DURUM.HAZIRLANIYOR;
  const paketDurumDegis = async (d: number) => {
    const id = aktifAdisyonId.current;
    // Çift dokunuş: "Yola çıktı"nın yerine gelen "Geri al"a ikinci dokunuş düşmesin
    if (!id || !api.paketDurum || islemde.current.has("paket")) return;
    islemde.current.add("paket");
    setTimeout(() => islemde.current.delete("paket"), 800);
    try { const a = await api.paketDurum(id, d); setAdisyon(a); onDegisti?.(); showSuccess?.(`Durum: ${PAKET_DURUM_ADI[d]}.`); } catch (e: any) { showError?.(e?.message || "Durum değiştirilemedi."); }
  };
  const islemYetkileri = paketMi ? yetkiler.filter((y) => y !== "masa-tasi" && y !== "birlestir") : yetkiler;
  const islemVar = (k: AdisyonKalemi) => !k.iptal && !k.faturaId && (k.durum === KALEM_DURUM.HAZIR || ["ikram", "iptal", "masa-tasi", "fiyat"].some((y) => islemYetkileri.includes(y)));
  const bekleyenToplam = Math.round(sepet.kalemler.reduce((t, k) => t + Math.round(k.miktar * k.birimFiyat * 100) / 100, 0) * 100) / 100;
  const kapali = adisyon && adisyon.durum !== 0 && adisyon.durum !== 1;
  const boyut = telefon ? { min: 52, yazi: 16 } : { min: 40, yazi: 14 };

  // ── Adisyon (gönderilmiş) + bekleyen liste
  const adisyonKarti = (
    <Card className="border shadow-xs h-100 d-flex flex-column" style={{ minHeight: 0 }}>
      <Card.Header className="bg-light py-2 small d-flex align-items-center gap-2 flex-wrap">
        <span className="fw-bold">{adisyon ? adisyon.adisyonNo : "Yeni adisyon"}</span>
        {adisyon && <span className="text-muted">{sureYaz(adisyon.acikDakika)}</span>}
        {adisyon?.garson && <Badge bg="light" text="dark" className="border">{adisyon.garson}</Badge>}
        {adisyon?.durum === 1 && <Badge bg="warning" text="dark">Hesap istendi</Badge>}
        {acikAdisyon && !paketMi && adisyon?.tur === 1 && api.misafirPin && yetkiler.includes("siparis") && (
          <Button size="sm" variant="outline-primary" className="py-0" onClick={() => setMisafirPinAdisyon(adisyon.adisyonId)}>Misafir PIN</Button>
        )}
        {acikAdisyon && (islemYetkileri.includes("masa-tasi") || islemYetkileri.includes("birlestir") || islemYetkileri.includes("iptal") || (yetkiler.includes("indirim") && !!api.indirim)) && (
          <Dropdown>
            <Dropdown.Toggle size="sm" variant="outline-secondary" className="py-0" aria-label="Adisyon işlemleri">İşlemler</Dropdown.Toggle>
            <Dropdown.Menu>
              {islemYetkileri.includes("masa-tasi") && api.masaTasi && <Dropdown.Item onClick={() => hedefAc("masa-tasi")}>Masa taşı</Dropdown.Item>}
              {islemYetkileri.includes("birlestir") && api.birlestir && <Dropdown.Item onClick={() => hedefAc("birlestir")}>Başka masayla birleştir</Dropdown.Item>}
              {yetkiler.includes("indirim") && api.indirim && <Dropdown.Item onClick={() => setIndirimAcik(true)}>{adisyon?.indirimTuru ? "İndirimi değiştir / kaldır" : "İndirim yap"}</Dropdown.Item>}
              {yetkiler.includes("iptal") && api.adisyonIptal && <><Dropdown.Divider /><Dropdown.Item className="text-danger" onClick={() => setNedenIs({ tur: "adisyon-iptal" })}>Adisyonu iptal et</Dropdown.Item></>}
            </Dropdown.Menu>
          </Dropdown>
        )}
        {!paketMi && <span className="ms-auto d-flex align-items-center gap-1">
          <IconUsers size={15} />
          <Button size="sm" variant="outline-secondary" className="py-0 px-2" aria-label="Kişi azalt" onClick={() => void kisiKaydet(Math.max(1, (kisi || 1) - 1))}><IconMinus size={12} /></Button>
          <span className="fw-bold" style={{ minWidth: 18, textAlign: "center" }}>{kisi ?? "–"}</span>
          <Button size="sm" variant="outline-secondary" className="py-0 px-2" aria-label="Kişi artır" onClick={() => void kisiKaydet(Math.min(99, (kisi || 0) + 1))}><IconPlus size={12} /></Button>
        </span>}
      </Card.Header>
      {paketMi && paketMusteri && (
        <div className="px-2 py-1 small border-bottom" style={{ background: "#f0fdfa" }}>
          <div className="d-flex align-items-center gap-2 flex-wrap">
            <span className="badge" style={{ background: paketTuru === 3 ? "#7c3aed" : "#0f766e" }}>{paketTuru === 3 ? "Gel-al" : "Paket servis"}</span>
            <span className="fw-bold">{paketMusteri.ad}</span>
            {paketMusteri.tel && <span>{telefonYaz(paketMusteri.tel)}</span>}
            {adisyon && <span className="badge" style={{ background: paketDurumu === PAKET_DURUM.TESLIM ? "#16a34a" : paketDurumu === PAKET_DURUM.YOLDA ? "#2563eb" : "#d97706" }}>{PAKET_DURUM_ADI[paketDurumu]}</span>}
            {adisyon && acikAdisyon && api.paketGuncelle && <Button size="sm" variant="link" className="p-0 small" onClick={() => setMusteriDuzenle(true)}>Düzelt</Button>}
          </div>
          {paketMusteri.adres && <div className="text-muted">{paketMusteri.adres}</div>}
          {paketMusteri.not && <div className="fst-italic" style={{ color: "#b45309" }}>{paketMusteri.not}</div>}
          {adisyon && adisyon.durum !== 9 && api.paketDurum && paketDurumu !== PAKET_DURUM.TESLIM && (
            <div className="d-flex gap-2 mt-1">
              {paketTuru === 2 && paketDurumu === PAKET_DURUM.HAZIRLANIYOR && <Button size="sm" variant="primary" onClick={() => void paketDurumDegis(PAKET_DURUM.YOLDA)}>Yola çıktı</Button>}
              {paketTuru === 2 && paketDurumu === PAKET_DURUM.YOLDA && <Button size="sm" variant="outline-secondary" onClick={() => void paketDurumDegis(PAKET_DURUM.HAZIRLANIYOR)}>Geri al</Button>}
              {((paketTuru === 2 && paketDurumu === PAKET_DURUM.YOLDA) || (paketTuru === 3 && paketDurumu === PAKET_DURUM.HAZIRLANIYOR)) && <Button size="sm" variant="success" onClick={() => void paketDurumDegis(PAKET_DURUM.TESLIM)}>Teslim edildi</Button>}
            </div>
          )}
        </div>
      )}
      {hazirKalemler.length > 0 && api.servis && (
        <div className="d-flex align-items-center gap-2 px-2 py-1" style={{ background: "#dcfce7", color: "#14532d" }}>
          <span className="fw-bold small">{hazirKalemler.length} ürün hazır</span>
          <button type="button" className="ms-auto" onClick={() => void servisEt(hazirKalemler.map((k) => k.kalemId))} style={{ fontSize: 12, border: "1px solid #16a34a", background: "#16a34a", color: "#fff", borderRadius: 6, padding: telefon ? "6px 10px" : "2px 8px" }}>Hepsi servis edildi</button>
        </div>
      )}
      <div className="flex-grow-1 overflow-auto" style={{ minHeight: 0 }}>
        {!adisyon?.kalemler.length && !sepet.kalemler.length && <div className="text-muted small p-3">{paketMi ? "Sipariş boş" : "Masa boş"}. Sağdan ürün seçin, sonra "Gönder".</div>}
        {adisyon?.kalemler.map((k) => (
          <div key={k.kalemId} className="px-2 py-1 border-bottom" role={islemVar(k) ? "button" : undefined} tabIndex={islemVar(k) ? 0 : undefined}
            onClick={() => { if (islemVar(k) && acikAdisyon) setIslemKalem(k); }} onKeyDown={(e) => { if (e.key === "Enter" && islemVar(k) && acikAdisyon) setIslemKalem(k); }}
            title={islemVar(k) ? "İkram / iptal / taşıma için dokunun" : undefined}
            style={{ opacity: k.iptal ? 0.55 : k.faturaId ? 0.7 : 1, cursor: islemVar(k) && acikAdisyon ? "pointer" : undefined, background: k.faturaId ? "#f0fdf4" : k.ikram ? "#ecfeff" : undefined }}>
            <div className="d-flex align-items-start gap-2">
              <span className="fw-semibold text-nowrap">{miktarYazi(k.miktar, k.birim, !!tartiBirimi(k.birim))}</span>
              <span className="flex-grow-1">{k.ad}{k.porsiyonAd ? ` (${k.porsiyonAd})` : ""}
                {k.secimMetni && <div className="small text-muted">{k.secimMetni}</div>}
                {k.notu && <div className="small fst-italic" style={{ color: "#b45309" }}>Not: {k.notu}</div>}
                {k.iptal && <div className="small fw-semibold" style={{ color: "#b91c1c", textDecoration: "none" }}>İptal: {k.neden}{k.islemYapan ? ` — ${k.islemYapan}` : ""}</div>}
                {k.ikram && !k.iptal && <div className="small fw-semibold" style={{ color: "#0e7490" }}>İkram: {k.neden}{k.islemYapan ? ` — ${k.islemYapan}` : ""}</div>}
                {k.ilkFiyat !== null && k.ilkFiyat !== undefined && !k.iptal && <div className="small fw-semibold" style={{ color: "#7c2d12" }}>Fiyat değişti: {para(k.ilkFiyat)} → {para(k.birimFiyat)}{k.fiyatNeden ? ` · ${k.fiyatNeden}` : ""}{k.fiyatDegistiren ? ` — ${k.fiyatDegistiren}` : ""}</div>}
              </span>
              <span className="text-end text-nowrap">
                <div className="fw-semibold" style={{ textDecoration: k.iptal ? "line-through" : undefined }}>{k.ikram ? <Badge bg="info">İkram</Badge> : `${para(k.tutar)}`}</div>
                {k.faturaId ? <span className="badge" style={{ background: "#15803d", fontSize: 10 }}>Ödendi</span> : <span className="badge" style={{ background: DURUM_ROZET[k.durum]?.renk || "#64748b", fontSize: 10 }}>{DURUM_ROZET[k.durum]?.ad}</span>}
                {k.durum === KALEM_DURUM.HAZIR && api.servis && (
                  <div><button type="button" onClick={() => void servisEt([k.kalemId])} style={{ marginTop: 2, fontSize: 11, border: "1px solid #16a34a", color: "#15803d", background: "#fff", borderRadius: 6, padding: telefon ? "4px 8px" : "0 6px" }}>Servis edildi</button></div>
                )}
              </span>
            </div>
          </div>
        ))}
        {sepet.kalemler.length > 0 && (
          <div style={{ background: "#fffbeb" }} className="border-top border-warning">
            <div className="px-2 pt-2 small fw-bold" style={{ color: "#92400e" }}>Gönderilmemiş sipariş {sepet.belirsiz && "(gönderim bekliyor)"}</div>
            {sepet.belirsiz && sepet.paket && (!paket || paket.ad !== sepet.paket.ad || (paket.tel || "") !== (sepet.paket.tel || "")) && (
              <div className="px-2 small" style={{ color: "#b91c1c" }} aria-label="Belirsiz paket müşterisi">Bu sipariş {sepet.paket.ad}{sepet.paket.tel ? ` (${sepet.paket.tel})` : ""} adına; yeniden gönderilirse o müşteriye açılır.</div>
            )}
            {sepet.kalemler.map((k) => (
              <div key={k.anahtar} className="px-2 py-1 d-flex align-items-center gap-2">
                {k.tartili ? <span className="fw-semibold text-nowrap"><IconScale size={14} /> {miktarYazi(k.miktar, k.birim, true)}</span> : (
                  <span className="d-flex align-items-center gap-1">
                    <Button size="sm" variant="outline-secondary" className="py-0 px-1" disabled={sepet.belirsiz} aria-label={`${k.ad} azalt`} style={{ minHeight: telefon ? 36 : undefined }} onClick={() => miktarDegistir(k.anahtar, -1)}><IconMinus size={12} /></Button>
                    <span className="fw-bold" style={{ minWidth: 20, textAlign: "center" }}>{k.miktar}</span>
                    <Button size="sm" variant="outline-secondary" className="py-0 px-1" disabled={sepet.belirsiz} aria-label={`${k.ad} artır`} style={{ minHeight: telefon ? 36 : undefined }} onClick={() => miktarDegistir(k.anahtar, 1)}><IconPlus size={12} /></Button>
                  </span>
                )}
                <span className="flex-grow-1">{k.ad}{k.porsiyonAd ? ` (${k.porsiyonAd})` : ""}
                  {k.secimMetni && <div className="small text-muted">{k.secimMetni}</div>}
                  {k.notu && <div className="small fst-italic" style={{ color: "#b45309" }}>Not: {k.notu}</div>}
                </span>
                <span className="text-nowrap">{para(Math.round(k.miktar * k.birimFiyat * 100) / 100)}</span>
                <Button size="sm" variant="link" className="p-0 text-danger" disabled={sepet.belirsiz} aria-label={`${k.ad} sil`} onClick={() => sil(k.anahtar)}><IconX size={16} /></Button>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="border-top p-2">
        {adisyon && (
          <div className="small d-flex flex-column">
            {adisyon.toplam.servis > 0 && <div className="d-flex justify-content-between"><span>Ara toplam</span><span>{para(adisyon.toplam.ara)}</span></div>}
            {adisyon.toplam.servis > 0 && <div className="d-flex justify-content-between"><span>Servis ücreti (%{String(adisyon.servisOrani).replace(".", ",")})</span><span>{para(adisyon.toplam.servis)}</span></div>}
            <div className="d-flex justify-content-between fw-bold fs-6"><span>Adisyon toplamı</span><span>{para(adisyon.toplam.toplam)} TL</span></div>
            {!!adisyon.indirimTuru && <div className="d-flex justify-content-between fw-semibold" style={{ color: "#7c2d12" }} aria-label="Adisyon indirimi"><span>İndirim{adisyon.indirimNeden ? ` · ${adisyon.indirimNeden}` : ""}{adisyon.indirimYapan ? ` — ${adisyon.indirimYapan}` : ""}</span><span>{adisyon.indirimTuru === 1 ? `%${String(adisyon.indirimDegeri).replace(".", ",")}` : `−${para(adisyon.indirimDegeri || 0)} TL`}</span></div>}
            {odenmisTutar > 0 && <div className="d-flex justify-content-between" style={{ color: "#15803d" }}><span>Ödenmiş ürünler</span><span>{para(odenmisTutar)} TL</span></div>}
          </div>
        )}
        {sepet.kalemler.length > 0 && <div className="d-flex justify-content-between small" style={{ color: "#92400e" }}><span>Gönderilmemiş</span><span>+{para(bekleyenToplam)} TL</span></div>}
        {sepet.belirsiz && !otomatik && !gonderiliyor && (
          <Alert variant="warning" className="py-1 px-2 small mb-0 mt-1" role="alert" aria-label="Eski gönderim uyarısı">
            Bu sipariş {sepet.zaman ? `${Math.max(1, Math.round((Date.now() - sepet.zaman) / 60000))} dk önce` : "daha önce"} gönderilmeye çalışıldı; ulaşıp ulaşmadığı bilinmiyor. Adisyonu kontrol edin: eksikse "Yeniden gönder", ulaşmışsa "Vazgeç".
          </Alert>
        )}
        <div className="d-flex gap-2 mt-2">
          <Button variant="success" className="flex-grow-1 fw-bold" style={{ minHeight: boyut.min + 6, fontSize: boyut.yazi + 1 }} disabled={!sepet.kalemler.length || gonderiliyor || !!kapali} onClick={() => void gonder(sepet)}>
            {gonderiliyor ? <Spinner size="sm" /> : <IconCloudUpload size={18} className="me-1" />}{sepet.belirsiz ? "Yeniden gönder" : `Gönder${sepet.kalemler.length ? ` (${sepet.kalemler.length})` : ""}`}
          </Button>
          {sepet.kalemler.length > 0 && !sepet.belirsiz && <Button variant="outline-danger" style={{ minHeight: boyut.min + 6 }} aria-label="Gönderilmemişleri temizle" onClick={() => setSepet({ istekId: null, belirsiz: false, kalemler: [] })}><IconTrash size={18} /></Button>}
          {sepet.kalemler.length > 0 && sepet.belirsiz && !gonderiliyor && (
            <Button variant="outline-danger" style={{ minHeight: boyut.min + 6 }} aria-label="Gönderimi belirsiz siparişten vazgeç"
              onClick={() => { if (window.confirm("Bu siparişin sunucuya ulaşıp ulaşmadığı bilinmiyor. Ulaştıysa adisyonda görünür; önce adisyonu kontrol edin.\n\nGönderilmemiş liste silinsin mi?")) { denemeRef.current = 0; setSepet({ istekId: null, belirsiz: false, kalemler: [] }); setHata(null); void adisyonOku(); } }}>Vazgeç</Button>
          )}
        </div>
        {acikAdisyon && (
          <div className="d-flex gap-2 mt-2">
            {api.hesapIste && yetkiler.includes("hesap-iste") && adisyon?.durum === 0 && !paketMi && (
              <Button variant="outline-warning" className="fw-semibold" style={{ minHeight: boyut.min, flex: 1, color: "#92400e", borderColor: "#d97706" }} onClick={() => void hesapIste()}><IconBellRinging size={17} className="me-1" />Hesap iste</Button>
            )}
            {kasa && api.hesap && <Button variant="outline-secondary" style={{ minHeight: boyut.min, flex: 1 }} disabled={hesapMesgul} onClick={() => void hesapFisi()}>{hesapMesgul ? <Spinner size="sm" /> : <IconPrinter size={17} className="me-1" />}Hesap fişi</Button>}
            {odemeApi && yetkiler.includes("tahsilat") && (
              <Button variant="primary" className="fw-bold" style={{ minHeight: boyut.min, flex: 1.4 }} disabled={sepet.kalemler.length > 0} title={sepet.kalemler.length ? "Önce gönderilmemiş siparişi gönderin ya da temizleyin" : undefined} onClick={() => setOdemeAcik(true)}>
                <IconCash size={18} className="me-1" />Öde
              </Button>
            )}
          </div>
        )}
        {kasa && acikAdisyon && odemeApi && yetkiler.includes("tahsilat") && (
          <Form.Check className="small mt-1" id={`fis-yazdir-${masa.masaId}`} label="Ödemede satış fişini yazdır" checked={kasa.fisYazdir} onChange={(e) => kasa.setFisYazdir(e.target.checked)} />
        )}
      </div>
    </Card>
  );

  // ── Ürün seçimi
  const urunKarti = (
    <Card className="border shadow-xs h-100 d-flex flex-column" style={{ minHeight: 0 }}>
      <Card.Header className="bg-light py-2">
        <InputGroup size={telefon ? undefined : "sm"}>
          <InputGroup.Text><IconSearch size={15} /></InputGroup.Text>
          <Form.Control aria-label="Ürün ara ya da barkod okut" placeholder="Ürün ara / barkod okut (Enter)" value={arama} onChange={(e) => setArama(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") aramaEnter(); }} />
          {arama && <Button variant="outline-secondary" aria-label="Aramayı temizle" onClick={() => setArama("")}><IconX size={14} /></Button>}
        </InputGroup>
        <div className="d-flex gap-1 mt-2 overflow-auto pb-1" style={{ whiteSpace: "nowrap" }}>
          {/* Grup düğmeleri sabit renkli: dokunmatik ekranda üzerinde durma (hover) rengi takılı kalıp seçili gibi görünmesin */}
          {[{ id: "tumu" as const, ad: "Tümü" }, ...(menu?.gruplar || []).map((g) => ({ id: g.stokGrupId, ad: g.ad }))].map((g) => {
            const s = grup === g.id;
            return (
              <button key={String(g.id)} type="button" aria-pressed={s} onClick={() => setGrup(g.id)}
                style={{ minHeight: telefon ? 40 : 30, padding: "2px 12px", borderRadius: 8, fontSize: 13, fontWeight: 600, border: `1px solid ${s ? "#0f172a" : "#94a3b8"}`, background: s ? "#0f172a" : "#ffffff", color: s ? "#ffffff" : "#0f172a" }}>{g.ad}</button>
            );
          })}
        </div>
      </Card.Header>
      <div className="flex-grow-1 overflow-auto p-2" style={{ minHeight: 0 }}>
        {!menu && !hata && <Spinner size="sm" />}
        {menu && !urunler.length && <div className="text-muted small">Ürün yok.</div>}
        <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fill, minmax(${telefon ? 140 : 130}px, 1fr))`, gap: 8 }}>
          {urunler.map((u) => (
            <button key={u.stokKartId} type="button" disabled={u.fiyat === null || !!kapali} onClick={() => urunSec(u)} title={u.fiyat === null ? "Satış fiyatı yok" : u.ad}
              style={{ minHeight: telefon ? 76 : 68, borderRadius: 10, border: "1px solid #cbd5e1", background: u.fiyat === null ? "#f1f5f9" : "#ffffff", color: "#0f172a", textAlign: "left", padding: "6px 8px", boxShadow: "0 1px 2px rgba(0,0,0,.05)" }}>
              <div className="fw-semibold" style={{ fontSize: boyut.yazi - 1, lineHeight: 1.15 }}>{u.ad}</div>
              <div className="d-flex align-items-center gap-1 mt-1" style={{ fontSize: 12 }}>
                <span className="fw-bold" style={{ color: u.fiyat === null ? "#94a3b8" : "#15803d" }}>{u.fiyat === null ? "fiyat yok" : `${para(u.fiyat)}${u.tartili ? `/${u.birim}` : ""}`}</span>
                {u.tartili && <IconScale size={13} color="#64748b" />}
                {(u.porsiyonlar.length > 0 || u.secenekGrupIdler.length > 0) && <IconChefHat size={13} color="#64748b" />}
              </div>
            </button>
          ))}
        </div>
      </div>
    </Card>
  );

  return (
    <div className="d-flex flex-column" style={{ height: yukseklik || (telefon ? "calc(100dvh - 8px)" : "calc(100vh - 170px)"), minHeight: 420 }}>
      <div className="d-flex align-items-center gap-2 mb-2 flex-wrap">
        <Button variant="outline-secondary" style={{ minHeight: boyut.min }} onClick={onGeri}><IconArrowLeft size={16} className="me-1" />{paketMi ? "Paketler" : "Masalar"}</Button>
        {paketMi ? <span className="fw-bold fs-5">{paketTuru === 3 ? "Gel-al" : "Paket"} · {paketMusteri?.ad}</span> : <>
          <span className="fw-bold fs-5">Masa {masa.ad}</span>
          <span className="text-muted">{masa.bolgeAd}</span></>}
        {telefon && (
          // Sabit renkli sekmeler: temanın etkin düğme / üzerinde durma rengi seçili olmayanı seçili gibi göstermesin
          <div className="ms-auto d-flex" role="tablist" aria-label="Sipariş ekranı">
            {([["urun", "Ürünler"], ["adisyon", `Adisyon${sepet.kalemler.length ? ` (${sepet.kalemler.length})` : ""}`]] as const).map(([k, ad], i) => {
              const secili = sekme === k;
              return (
                <button key={k} type="button" role="tab" aria-selected={secili} onClick={() => setSekme(k)}
                  style={{ minHeight: boyut.min, padding: "4px 14px", fontWeight: 700, border: "2px solid #0f766e", background: secili ? "#0f766e" : "#ffffff", color: secili ? "#ffffff" : "#0f766e",
                    borderRadius: i === 0 ? "10px 0 0 10px" : "0 10px 10px 0", marginLeft: i ? -2 : 0 }}>{ad}</button>
              );
            })}
          </div>
        )}
      </div>
      {hata && <Alert variant={sepet.belirsiz ? "warning" : "danger"} className="py-2 small mb-2" onClose={() => setHata(null)} dismissible>{hata}</Alert>}
      {kapali && <Alert variant="secondary" className="py-2 small mb-2">Bu adisyon kapanmış.</Alert>}
      {telefon ? (
        <div className="flex-grow-1" style={{ minHeight: 0 }}>{sekme === "urun" ? urunKarti : adisyonKarti}</div>
      ) : (
        <div className="flex-grow-1 d-flex gap-3" style={{ minHeight: 0 }}>
          <div style={{ width: "40%", minWidth: 340 }}>{adisyonKarti}</div>
          <div className="flex-grow-1">{urunKarti}</div>
        </div>
      )}
      {api.misafirPin && <MisafirPinModal adisyonId={misafirPinAdisyon} getir={api.misafirPin} kapat={() => setMisafirPinAdisyon(null)} />}
      {secim && menu && <UrunSecimModal urun={secim.urun} gruplar={menu.secenekGruplari} sabitMiktar={secim.miktar} onEkle={sepeteEkle} kapat={() => setSecim(null)} buyuk={telefon} />}
      <TartiModal soru={tarti} kapat={() => setTarti(null)} />
      <KalemIslemModal kalem={islemKalem} yetkiler={[...islemYetkileri, ...(yetkiler.includes("fiyat") && api.fiyatDegistir ? ["fiyat"] : [])]} buyuk={telefon} onSec={(i, m) => void kalemIslemi(i, m)} kapat={() => setIslemKalem(null)} />
      <FiyatModal kalem={fiyatKalem} buyuk={telefon} kapat={() => setFiyatKalem(null)}
        onOnay={async (fiyat, neden) => { const id = aktifAdisyonId.current; if (!id || !fiyatKalem || !api.fiyatDegistir) return; await yenidenOku(await api.fiyatDegistir(id, { kalemId: fiyatKalem.kalemId, fiyat, neden })); setFiyatKalem(null); showSuccess?.("Fiyat değiştirildi."); }} />
      <IndirimModal acik={indirimAcik} buyuk={telefon} kapat={() => setIndirimAcik(false)}
        mevcut={adisyon?.indirimTuru ? { tur: adisyon.indirimTuru, deger: adisyon.indirimDegeri || 0, neden: adisyon.indirimNeden ?? null } : null}
        onOnay={async (g) => { const id = aktifAdisyonId.current; if (!id || !api.indirim) return; await yenidenOku(await api.indirim(id, g)); setIndirimAcik(false); showSuccess?.(g.tur ? "İndirim uygulandı." : "İndirim kaldırıldı."); }} />
      <NedenModal tur={nedenIs?.tur ?? null} buyuk={telefon} onOnay={nedenOnay} kapat={() => setNedenIs(null)}
        baslik={nedenIs?.tur === "ikram" ? `İkram: ${nedenIs.kalem?.ad}${nedenIs.miktar && nedenIs.kalem && nedenIs.miktar !== nedenIs.kalem.miktar ? ` (${nedenIs.miktar})` : ""}` : nedenIs?.tur === "iptal" ? `İptal: ${nedenIs.kalem?.ad}${nedenIs.miktar && nedenIs.kalem && nedenIs.miktar !== nedenIs.kalem.miktar ? ` (${nedenIs.miktar})` : ""}` : `Adisyonu iptal et — Masa ${masa.ad}`} />
      {odemeApi && (
        <OdemeModal acik={odemeAcik} adisyon={adisyon} masaAd={masa.ad} baslik={paketMi ? `${paketTuru === 3 ? "Gel-al" : "Paket"} · ${paketMusteri?.ad || ""}` : undefined} api={odemeApi} yetkiler={yetkiler} buyuk={telefon} garson={!kasa}
          secenekler={kasa?.secenekler ?? { pos: [], banka: [] }} onTahsilat={tahsilatSonrasi} kapat={() => { setOdemeAcik(false); void adisyonOku(); }}
          onMusteriEkrani={kasa?.musteriEkrani} onMusteriEkraniAc={kasa?.musteriEkraniniAc} araKartCek={kasa?.araKartCek} />
      )}
      {paketMi && adisyon && api.paketGuncelle && (
        <PaketMusteriModal acik={musteriDuzenle} tur={(paketTuru as 2 | 3) || 2} baslik="Müşteri bilgisini düzelt" ilk={paketMusteri} musteriBul={api.paketMusteri}
          onOnay={async (b) => { const a = await api.paketGuncelle!(adisyon.adisyonId, b); setAdisyon(a); setMusteriDuzenle(false); onDegisti?.(); showSuccess?.("Müşteri bilgisi düzeltildi."); }} kapat={() => setMusteriDuzenle(false)} />
      )}
      <HedefMasaModal acik={!!hedefIs} durum={masaDurumu} haric={masa.masaId} buyuk={telefon} onSec={hedefSec} kapat={() => setHedefIs(null)}
        tur={hedefIs?.tur === "masa-tasi" ? "bos" : hedefIs?.tur === "birlestir" ? "dolu" : "hepsi"}
        baslik={hedefIs?.tur === "masa-tasi" ? `Masa ${masa.ad} — hangi boş masaya taşınsın?` : hedefIs?.tur === "birlestir" ? `Masa ${masa.ad} — hangi masayla birleştirilsin? (bu masanın ürünleri oraya geçer)` : `${hedefIs?.kalem?.ad ?? ""} — hangi masaya taşınsın?`} />
    </div>
  );
};

export default AdisyonSiparis;
