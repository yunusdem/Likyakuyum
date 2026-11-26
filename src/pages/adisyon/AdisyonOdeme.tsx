import { paraOku } from "../../utils/sayiGirisi";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Button, Form, Modal, Spinner } from "react-bootstrap";
import { IconCash, IconCreditCard, IconBuildingBank, IconUser, IconMinus, IconPlus, IconTrash, IconX } from "@tabler/icons-react";
import { AdisyonAyrinti, AdisyonKalemi, HesapDurumu, KalemSecimi, MusteriGirdi, OdemeGirdi, TahsilatSonucu } from "../../services/adisyonService";
import { para } from "../../services/ticariService";
import { esitBol } from "../../../Backend/src/services/adisyon/adisyonHesap";
import { tartiBirimi, ticariFisHesapla } from "../../../Backend/src/services/ticari/ticariHesap";
import { kesinRetMi, yeniIstekId } from "./adisyonBekleyen";
import type { KasaSatiri, MusteriEkraniDurumu } from "../../services/musteriEkrani";
import { adisyonMusteriDurumu } from "./adisyonMusteriEkrani";

/**
 * Hesap / tahsilat penceresi (docs/TICARI_ADISYON_YOL_HARITASI.md, TA35–TA37, D7): Tamamı (tek fiş, çoklu ödeme), Eşit böl (kişi
 * kişi ara ödeme; son payla fiş), Tutar (serbest ara ödeme), Ürün seç (seçilen kalemler ayrı fiş; fatura isteyen müşteri).
 * Ödenecek tutar satış fişinin tutarıdır (sunucuyla aynı hesap: KDV dahil fiyattan e-Belge yuvarlaması). Ara ödemede kart
 * cihazdan ayrıca çekilir (kayıt); fiş yazan tahsilatta (Tamamı / Ürün seç) kart, fiş yazıldıktan sonra POS cihazına sorulur.
 */
export interface OdemeApi {
  hesap: (adisyonId: number) => Promise<HesapDurumu>;
  odemeEkle: (adisyonId: number, g: OdemeGirdi & { istekId: string; musteri?: MusteriGirdi | null }) => Promise<TahsilatSonucu>;
  odemeSil: (odemeId: number) => Promise<TahsilatSonucu>;
  kapat: (adisyonId: number, g: { istekId: string; odemeler: OdemeGirdi[]; musteri?: MusteriGirdi | null }) => Promise<TahsilatSonucu>;
  urunleOde: (adisyonId: number, g: { istekId: string; kalemler: KalemSecimi[]; odemeler: OdemeGirdi[]; musteri?: MusteriGirdi | null }) => Promise<TahsilatSonucu>;
}
export interface OdemeSecenekleri {
  /** Muhasebe POS kartları (PC); boşsa kart satırında seçim sorulmaz */
  pos: { id: number; ad: string }[];
  /** Banka hesapları (havale / EFT; PC) */
  banka: { id: number; ad: string }[];
  /** Cari (veresiye) seçici (PC) */
  cariSec?: () => Promise<{ id: number; ad: string } | null>;
}
export type TahsilatTuru = "kapat" | "urun" | "ara";

const ARACLAR = [
  { arac: 0, ad: "Nakit", ikon: IconCash, renk: "#15803d" },
  { arac: 2, ad: "Kart", ikon: IconCreditCard, renk: "#1d4ed8" },
  { arac: 3, ad: "Havale", ikon: IconBuildingBank, renk: "#7c3aed" },
  { arac: 1, ad: "Cari", ikon: IconUser, renk: "#b45309" },
] as const;
const ARAC_ADI: Record<number, string> = { 0: "Nakit", 1: "Cari", 2: "Kart", 3: "Havale / EFT" };
const y2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const sayi = (s: string) => paraOku(s); // "1.250" = 1250 (binlik), "1.250,50" = 1250,5
const yaz = (n: number) => n.toFixed(2).replace(".", ",");

interface Satir { anahtar: string; arac: number; tutar: string; posCihaziId: number | null; cariKartId: number | null; ad: string | null }
let sayac = 0;
const anahtar = () => `o${Date.now()}-${++sayac}`;

/** Seçilen kalemlerin satış fişi tutarı (sunucudaki fisToplami ile aynı: ikram %100 iskonto, servis ayrı satır) */
export function secimTutari(kalemler: { miktar: number; birimFiyat: number; kdvOrani: number; ikram: boolean }[], servisOrani: number | null, servisKdv: number,
  /** Adisyon indirimi (K1): tür 1 yüzde, 2 tutar (deger = kalan indirim); tumBrut = bütün ödenmemiş hesabın indirimsiz tutarı; sonFis = ödenmemişlerin hepsi seçili */
  indirim?: { turu: number; deger: number; tumBrut: number; sonFis: boolean } | null,
  /** Ödenmemişlerin hepsi seçiliyse sunucunun kalan servisi (P5: önceki fişlerin kuruş farkı son fişte kapanır) */
  sonFisServisi?: number | null) {
  const ara = y2(kalemler.filter((k) => !k.ikram).reduce((t, k) => t + y2(k.miktar * k.birimFiyat), 0));
  const servis = sonFisServisi !== null && sonFisServisi !== undefined ? y2(sonFisServisi) : servisOrani && servisOrani > 0 ? y2((ara * servisOrani) / 100) : 0;
  if (!kalemler.length && !(servis > 0)) return { ara, servis, toplam: 0, indirim: 0 };
  const satirlar = kalemler.map((k) => ({ miktar: k.miktar, kdvDahilFiyat: k.birimFiyat, kdvOrani: k.kdvOrani, iskontoTuru: (k.ikram ? 1 : 0) as any, iskontoDegeri: k.ikram ? 100 : 0 }));
  if (servis > 0) satirlar.push({ miktar: 1, kdvDahilFiyat: servis, kdvOrani: servisKdv, iskontoTuru: 0 as any, iskontoDegeri: 0 });
  const brut = ticariFisHesapla(satirlar).genelToplam;
  // Sunucudaki indirimBasligi ile aynı: yüzde aynen; tutar brüt payı oranında, son fişte kalanın tamamı
  let baslik: { turu: 1 | 2; deger: number } | null = null;
  if (indirim && indirim.turu && indirim.deger > 0 && brut > 0) {
    if (indirim.turu === 1) baslik = { turu: 1, deger: Math.min(100, indirim.deger) };
    else baslik = { turu: 2, deger: Math.min(brut, y2(indirim.sonFis ? indirim.deger : (indirim.deger * brut) / (indirim.tumBrut > 0 ? indirim.tumBrut : brut))) };
  }
  const toplam = baslik ? ticariFisHesapla(satirlar, baslik).genelToplam : brut;
  return { ara, servis, toplam, indirim: y2(brut - toplam) };
}

/** Sabit renkli seçim düğmesi (dokunmatikte hover rengi takılı kalmasın) */
const Secim: React.FC<{ secili: boolean; onClick: () => void; children: React.ReactNode; buyuk?: boolean; renk?: string; disabled?: boolean; etiket?: string }> = ({ secili, onClick, children, buyuk, renk = "#0f172a", disabled, etiket }) => (
  <button type="button" aria-pressed={secili} aria-label={etiket} disabled={disabled} onClick={onClick}
    style={{ minHeight: buyuk ? 48 : 38, padding: "4px 12px", borderRadius: 8, fontWeight: 600, fontSize: buyuk ? 15 : 14, border: `2px solid ${secili ? renk : "#cbd5e1"}`, background: secili ? renk : "#fff", color: secili ? "#fff" : "#0f172a", opacity: disabled ? 0.45 : 1, display: "inline-flex", alignItems: "center", gap: 6, justifyContent: "center" }}>{children}</button>
);

export const OdemeModal: React.FC<{
  acik: boolean; adisyon: AdisyonAyrinti | null; masaAd: string; api: OdemeApi; yetkiler: string[]; secenekler: OdemeSecenekleri;
  /** Telefon (garson): büyük düğmeler; yalnız nakit / kart, müşteri faturası yok */
  buyuk?: boolean; garson?: boolean;
  /** Tahsilattan sonra (fiş yazıldıysa POS sorusu + baskı ekranda); kapandıysa pencere kapanır */
  onTahsilat: (r: TahsilatSonucu, yeniOdemeler: OdemeGirdi[], tur: TahsilatTuru, yeniFisler: { faturaId: number; faturaNo: string }[]) => Promise<void>;
  kapat: () => void;
  /** Müşteri ekranı (TA9, kasa PC): durum yayını ve pencereyi açma */
  onMusteriEkrani?: (d: MusteriEkraniDurumu) => void;
  onMusteriEkraniAc?: () => string | null;
  /** Ara ödemede kart (TA37, kasa PC): POS sorusu + cihazdan çekim; verilmezse (garson) kart yalnız kaydedilir */
  araKartCek?: (tutar: number, posCihaziId: number | null) => Promise<{ tamam: boolean; posIslemId: number | null; posCihaziId: number | null }>;
  /** Başlık (paket / gel-al: "Paket · Ayşe"); verilmezse "Masa X" */
  baslik?: string;
}> = ({ acik, adisyon, masaAd, api, yetkiler, secenekler, buyuk, garson, onTahsilat, kapat, onMusteriEkrani, onMusteriEkraniAc, araKartCek, baslik }) => {
  const [hesap, setHesap] = useState<HesapDurumu | null>(null);
  const [mod, setMod] = useState<"tamami" | "esit" | "tutar" | "urun">("tamami");
  const [satirlar, setSatirlar] = useState<Satir[]>([]);
  const [kisi, setKisi] = useState(2);
  const [tutar, setTutar] = useState("");
  const [secim, setSecim] = useState<Record<number, number>>({});
  const [musteriAcik, setMusteriAcik] = useState(false);
  const [musteri, setMusteri] = useState<MusteriGirdi>({});
  const [alinan, setAlinan] = useState("");
  const [mesgul, setMesgul] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const istekRef = useRef<{ anahtar: string; istekId: string } | null>(null);
  const adisyonId = adisyon?.adisyonId ?? null;
  const tahsilat = yetkiler.includes("tahsilat");
  const bolme = yetkiler.includes("bolme");
  const araclar = ARACLAR.filter((a) => (garson ? a.arac === 0 || a.arac === 2 : a.arac !== 1 || !!secenekler.cariSec));

  const kisiAyarlandi = useRef(false);
  const oku = useCallback(async () => {
    if (!adisyonId) return;
    try {
      const h = await api.hesap(adisyonId);
      setHesap(h);
      // Eşit böl: kalan kişi = kişi sayısı − alınmış ara ödeme (ilk açılışta; sonra kullanıcı değiştirir)
      if (!kisiAyarlandi.current) { kisiAyarlandi.current = true; setKisi(Math.max(1, Math.max(2, adisyon?.kisiSayisi || 2) - h.odemeler.length)); }
    } catch (e: any) { setHata(e?.message || "Hesap alınamadı."); }
  }, [api, adisyonId, adisyon?.kisiSayisi]);
  useEffect(() => {
    if (!acik) return;
    setHesap(null); setMod("tamami"); setSatirlar([]); setTutar(""); setSecim({}); setMusteriAcik(false); setMusteri({}); setAlinan(""); setHata(null); istekRef.current = null;
    setKisi(Math.max(2, adisyon?.kisiSayisi || 2));
    kisiAyarlandi.current = false;
    void oku();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [acik, adisyonId]);

  // Pencere açıkken adisyon değişirse (başka cihaz ürün ekledi, iptal / ikram / indirim yapıldı) hesap yeniden okunur: "Kalan",
  // eşit / tutar payları ve müşteri ekranı eski tutarla kalmasın (26.11.2026 denetimi)
  const sonSurum = useRef<number | null>(null);
  useEffect(() => {
    if (!acik || !adisyon) { sonSurum.current = null; return; }
    if (sonSurum.current !== null && sonSurum.current !== adisyon.surum && !mesgul) void oku();
    sonSurum.current = adisyon.surum;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [acik, adisyon?.surum]);

  // Ödenmemiş kalemler (ürün seç)
  const odenmemis = useMemo(() => (adisyon?.kalemler || []).filter((k) => !k.iptal && !k.faturaId), [adisyon]);
  const secilen = useMemo(() => odenmemis.filter((k) => secim[k.kalemId] > 0).map((k) => ({ ...k, miktar: secim[k.kalemId] })), [odenmemis, secim]);
  const secimHesabi = useMemo(() => {
    const hepsi = secilen.length > 0 && secilen.length === odenmemis.length && secilen.every((k) => { const o = odenmemis.find((x) => x.kalemId === k.kalemId); return !!o && Math.abs(o.miktar - k.miktar) < 0.00005; });
    return secimTutari(secilen, adisyon?.servisOrani ?? null, hesap?.servisKdv ?? 10,
      hesap?.indirimTuru ? { turu: hesap.indirimTuru, deger: hesap.indirimDegeri || 0, tumBrut: hesap.brut || 0, sonFis: hepsi } : null,
      hepsi && hesap ? hesap.servis : null);
  }, [secilen, odenmemis, adisyon, hesap]);

  const hedef = mod === "urun" ? secimHesabi.toplam : hesap?.kalan ?? 0;
  const satirToplami = y2(satirlar.reduce((t, s) => t + (sayi(s.tutar) || 0), 0));
  const kalanSatir = y2(hedef - satirToplami);
  // Tamamı / ürün seç: hedef değişince tek satır varsa tutarı izlesin
  useEffect(() => {
    if (mod !== "tamami" && mod !== "urun") return;
    setSatirlar((l) => (l.length === 0 && hedef > 0 ? [{ anahtar: anahtar(), arac: 0, tutar: yaz(hedef), posCihaziId: null, cariKartId: null, ad: null }] : l.length === 1 ? [{ ...l[0], tutar: yaz(hedef) }] : l));
  }, [hedef, mod]);

  const satirEkle = async (arac: number) => {
    const bos = kalanSatir > 0.004 ? kalanSatir : 0;
    let ek: Partial<Satir> = {};
    if (arac === 1) {
      const c = await secenekler.cariSec?.();
      if (!c) return;
      ek = { cariKartId: c.id, ad: c.ad };
    }
    if (arac === 2 && secenekler.pos.length) ek = { posCihaziId: secenekler.pos[0].id, ad: secenekler.pos[0].ad };
    if (arac === 3) {
      if (!secenekler.banka.length) { setHata("Tanımlı banka hesabı yok."); return; }
      ek = { cariKartId: secenekler.banka[0].id, ad: secenekler.banka[0].ad };
    }
    setHata(null);
    // Tek satır tutarın tamamını tutuyorsa yeni tür o satırın yerine geçer (ör. "Tamamı kart")
    if (!bos && satirlar.length === 1) { setSatirlar([{ ...satirlar[0], arac, posCihaziId: null, cariKartId: null, ad: null, ...ek }]); return; }
    setSatirlar([...satirlar, { anahtar: anahtar(), arac, tutar: bos ? yaz(bos) : "", posCihaziId: null, cariKartId: null, ad: null, ...ek }]);
  };
  const satirDegis = (a: string, d: Partial<Satir>) => setSatirlar((l) => l.map((s) => (s.anahtar === a ? { ...s, ...d } : s)));
  const satirSil = (a: string) => setSatirlar((l) => l.filter((s) => s.anahtar !== a));
  const odemeGirdileri = (): OdemeGirdi[] => satirlar.map((s) => ({ tutar: y2(sayi(s.tutar)), arac: s.arac, posCihaziId: s.arac === 2 ? s.posCihaziId : null, cariKartId: s.arac === 1 || s.arac === 3 ? s.cariKartId : null }));
  const satirHatasi = (): string | null => {
    if (!satirlar.length) return hedef > 0 ? "Ödeme ekleyin." : null;
    for (const s of satirlar) {
      const t = sayi(s.tutar);
      if (!(t > 0)) return "Ödeme tutarı 0'dan büyük olmalı.";
      if ((s.arac === 1 || s.arac === 3) && !s.cariKartId) return s.arac === 1 ? "Cari seçilmeli." : "Banka hesabı seçilmeli.";
    }
    if (Math.abs(kalanSatir) > 0.004) return kalanSatir > 0 ? `${yaz(kalanSatir)} TL eksik.` : `${yaz(-kalanSatir)} TL fazla.`;
    return null;
  };
  const nakitToplami = y2(satirlar.filter((s) => s.arac === 0).reduce((t, s) => t + (sayi(s.tutar) || 0), 0));
  // Müşteri ekranı: pencere açıkken her değişiklikte; kapanınca boş ekran (adisyon kapandıysa teşekkür ekranı kendisi boşa döner)
  const oncekiSepet = useRef<KasaSatiri[] | null>(null);
  // Kapanışta teşekkür ekranı yollandıysa pencere yeniden açılana kadar başka durum yayınlanmaz (kapanış sonrası boş hesap onu ezmesin)
  const tesekkur = useRef(false);
  useEffect(() => { if (acik) tesekkur.current = false; }, [acik]);
  // O11 (26.11.2026 denetimi): "boş" yalnız pencere kapanırken bir kez yayınlanır. Eskiden pencere kapalıyken her canlı güncellemede
  // (başka masanın siparişi) boş ekran yeniden yayınlanıyor, aynı bilgisayarda Hızlı Satış'ın / öteki kasanın dolu sepetini eziyordu.
  const yayinda = useRef(false);
  useEffect(() => {
    if (!onMusteriEkrani || tesekkur.current) return;
    if (!acik || !adisyon || !hesap) {
      if (!acik && yayinda.current) onMusteriEkrani(adisyonMusteriDurumu({ kalemler: [], servisOrani: null, hesap: null }));
      yayinda.current = false;
      oncekiSepet.current = null;
      return;
    }
    yayinda.current = true;
    const d = adisyonMusteriDurumu({ kalemler: adisyon.kalemler, servisOrani: adisyon.servisOrani, hesap, oncekiSepet: oncekiSepet.current,
      secim: mod === "urun" && secilen.length ? { kalemler: secilen.map((k) => ({ kalemId: k.kalemId, miktar: k.miktar })), servis: secimHesabi.servis, toplam: secimHesabi.toplam, indirim: secimHesabi.indirim } : null,
      pencere: { satirlar: (mod === "tamami" || mod === "urun" ? satirlar : []).map((s) => ({ arac: s.arac, tutar: sayi(s.tutar) || 0 })), alinanNakit: sayi(alinan) || null } });
    oncekiSepet.current = adisyon.kalemler.filter((k) => !k.iptal && !k.faturaId).map((k) => ({ anahtar: String(k.kalemId), ad: k.ad, miktar: k.miktar, birim: k.birim, birimFiyat: k.birimFiyat }));
    onMusteriEkrani(d);
  }, [acik, adisyon, hesap, satirlar, alinan, mod, onMusteriEkrani, secilen, secimHesabi]);
  const paraUstu = sayi(alinan) > 0 ? y2(sayi(alinan) - nakitToplami) : null;
  const musteriGirdisi = (): MusteriGirdi | null => {
    if (garson || !musteriAcik) return null;
    const v = String(musteri.vknTckn || "").trim();
    if (!v) return null;
    return { ...musteri, vknTckn: v, unvan: String(musteri.unvan || "").trim() || null };
  };
  const musteriHatasi = (): string | null => {
    const m = musteriGirdisi();
    if (!m) return null;
    if (!/^\d{10,11}$/.test(String(m.vknTckn))) return "VKN 10, TCKN 11 haneli olmalı.";
    if (!m.unvan) return "Unvan / ad soyad girilmeli.";
    return null;
  };

  /** Aynı tahsilat yeniden denenirken aynı istek kimliği (bağlantı koptuysa çift ödeme olmaz) */
  // O9 (26.11.2026 denetimi): imza fatura isteyen müşteriyi de içerir — müşteri bilgisi değişince yeni istek kimliği alınır (aynı kimlikle
  // yeniden gönderimde sunucu ilk sonucu, yani müşterisiz fişi döndürürdü; ilk istek ulaştıysa adisyon kapalıdır, ikinci fiş yazılmaz)
  const istekKimligi = (imza: string) => {
    if (istekRef.current?.anahtar !== imza) istekRef.current = { anahtar: imza, istekId: yeniIstekId() };
    return istekRef.current.istekId;
  };
  const calistir = async (imza: string, f: (istekId: string) => Promise<{ r: TahsilatSonucu; yeni: OdemeGirdi[]; tur: TahsilatTuru }>) => {
    if (!adisyonId || mesgul) return;
    setMesgul(true); setHata(null);
    try {
      const onceki = new Set((hesap?.fisler || []).map((x) => x.faturaId));
      const oncekiToplam = hesap?.toplam ?? 0;
      const { r, yeni, tur } = await f(istekKimligi(imza));
      if (r.kapandi && onMusteriEkrani) {
        // Teşekkür ekranı: ödenen tutar ve (elden nakitte) para üstü
        const pu = sayi(alinan) > 0 ? Math.max(0, y2(sayi(alinan) - y2(yeni.filter((o) => o.arac === 0).reduce((t, o) => t + o.tutar, 0)))) : 0;
        tesekkur.current = true;
        onMusteriEkrani(adisyonMusteriDurumu({ kalemler: [], servisOrani: null, hesap: null, sonFis: { toplam: oncekiToplam, paraUstu: pu } }));
      }
      istekRef.current = null;
      setHesap(r.hesap);
      // Fiş yazan tahsilatta kart varsa POS sorusu / cihaz penceresi çıkar: ödeme penceresi o sırada gizlenir (üst üste binmesin)
      const kartVar = tur !== "ara" && yeni.some((o) => o.arac === 2);
      if (kartVar) setKartSorusu(true);
      try { await onTahsilat(r, yeni, tur, r.hesap.fisler.filter((x) => !onceki.has(x.faturaId)).map((x) => ({ faturaId: x.faturaId, faturaNo: x.faturaNo }))); }
      finally { if (kartVar) setKartSorusu(false); }
      // Yazılan fiş o müşterinindi: sonraki ödemeye fatura bilgisi taşınmaz
      if (!r.kapandi) { setSatirlar([]); setTutar(""); setSecim({}); setAlinan(""); if (tur !== "ara") { setMusteriAcik(false); setMusteri({}); } }
    } catch (e: any) {
      if (kesinRetMi(e)) { istekRef.current = null; void oku(); }
      setHata(kesinRetMi(e) ? e?.message || "Tahsilat yapılamadı." : "Bağlantı sorunu: tahsilat sonucu bilinmiyor. Aynı düğmeye yeniden basın (çift ödeme olmaz).");
    } finally {
      setMesgul(false);
    }
  };

  const tamamla = () => {
    const yeni = odemeGirdileri();
    const m = musteriGirdisi();
    if (mod === "urun") {
      const kalemler: KalemSecimi[] = secilen.map((k) => { const asil = odenmemis.find((x) => x.kalemId === k.kalemId)!; return { kalemId: k.kalemId, ...(k.miktar !== asil.miktar ? { miktar: k.miktar } : {}) }; });
      return calistir(`urun:${JSON.stringify(kalemler)}:${JSON.stringify(yeni)}:${JSON.stringify(m ?? null)}`, async (istekId) => ({ r: await api.urunleOde(adisyonId!, { istekId, kalemler, odemeler: yeni, musteri: m }), yeni, tur: "urun" }));
    }
    return calistir(`kapat:${JSON.stringify(yeni)}:${JSON.stringify(m ?? null)}`, async (istekId) => ({ r: await api.kapat(adisyonId!, { istekId, odemeler: yeni, musteri: m }), yeni, tur: "kapat" }));
  };
  // TA37: cihazdan çekilip henüz ara ödeme olarak kaydedilemeyen kart (bağlantı koptu): aynı tutarla yeniden denenince kart ikinci kez
  // çekilmez, bu işlem kullanılır
  const bekleyenKart = useRef<{ tutar: number; posIslemId: number; posCihaziId: number | null } | null>(null);
  const kartCekiliyor = useRef(false);
  // Kart sorusu / cihaz penceresi açıkken ödeme penceresi geçici gizlenir (iki pencere üst üste binince soru arkada kalıyordu); durum korunur
  const [kartSorusu, setKartSorusu] = useState(false);
  const araOdeme = async (t: number, arac: number) => {
    if (!(t > 0)) { setHata("Tutar girilmeli."); return; }
    if (mesgul || kartCekiliyor.current) return;
    let o: OdemeGirdi = { tutar: y2(t), arac, posCihaziId: arac === 2 ? secenekler.pos[0]?.id ?? null : null, aciklama: mod === "esit" ? `${kisi} kişiden 1 pay` : null };
    if (arac === 2 && araKartCek) {
      const b = bekleyenKart.current;
      if (b && Math.abs(b.tutar - o.tutar) < 0.005) o = { ...o, posIslemId: b.posIslemId, posCihaziId: b.posCihaziId ?? o.posCihaziId };
      else {
        if (b) setHata(`Daha önce cihazdan çekilen ${para(b.tutar)} TL ara ödemeye kaydedilemedi; Banka › POS İşlemleri'nden iade edin.`);
        bekleyenKart.current = null;
        kartCekiliyor.current = true;
        setKartSorusu(true);
        try {
          const c = await araKartCek(o.tutar, o.posCihaziId ?? null);
          if (!c.tamam) { setHata("Kart cihazdan çekilmedi; ara ödeme alınmadı."); return; }
          if (c.posIslemId) { bekleyenKart.current = { tutar: o.tutar, posIslemId: c.posIslemId, posCihaziId: c.posCihaziId }; o = { ...o, posIslemId: c.posIslemId, posCihaziId: c.posCihaziId ?? o.posCihaziId }; }
        } finally { kartCekiliyor.current = false; setKartSorusu(false); }
      }
    }
    void calistir(`ara:${mod}:${o.tutar}:${arac}:${hesap?.odemeler.length ?? 0}:${o.posIslemId ?? ""}`, async (istekId) => {
      const r = await api.odemeEkle(adisyonId!, { ...o, istekId });
      if (o.posIslemId) bekleyenKart.current = null;
      if (mod === "esit" && !r.kapandi) setKisi((k) => Math.max(1, k - 1));
      return { r, yeni: [o], tur: "ara" };
    });
  };
  const odemeSil = async (odemeId: number) => {
    if (mesgul) return;
    // Tek dokunuşla silinmesin: alınmış para kaydı (para müşteriye geri verildiyse silinir)
    const o = hesap?.odemeler.find((x) => x.odemeId === odemeId);
    if (!window.confirm(`${o ? `${para(o.tutar)} TL ${ARAC_ADI[o.arac] || ""} ara ödemesi` : "Ara ödeme"} silinsin mi?\n\nPara müşteriye geri verildiyse silin; yanlışlıkla sildiyseniz yeniden girin.`)) return;
    setMesgul(true); setHata(null);
    try { const r = await api.odemeSil(odemeId); setHesap(r.hesap); await onTahsilat(r, [], "ara", []); } catch (e: any) { setHata(e?.message || "Silinemedi."); } finally { setMesgul(false); }
  };

  if (!acik || !adisyon) return null;
  const paylar = hesap && hesap.kalan > 0 ? esitBol(hesap.kalan, Math.max(1, kisi)) : [];
  const bekleyen = hesap?.odemeler || [];
  const satirHata = satirHatasi() || musteriHatasi();
  const dugmeY = buyuk ? 52 : 42;

  // ── Ödeme satırları (Tamamı / Ürün seç)
  const satirEditoru = (
    <div>
      <div className="d-flex flex-wrap gap-2 mb-2">
        {araclar.map((a) => (
          <Secim key={a.arac} secili={false} buyuk={buyuk} onClick={() => void satirEkle(a.arac)} etiket={`${a.ad} ödemesi ekle`}><a.ikon size={18} color={a.renk} />{a.ad}</Secim>
        ))}
      </div>
      {satirlar.map((s) => (
        <div key={s.anahtar} className="d-flex align-items-center gap-2 mb-2 flex-wrap">
          <span className="fw-semibold" style={{ minWidth: 70 }}>{ARAC_ADI[s.arac]}</span>
          <Form.Control aria-label={`${ARAC_ADI[s.arac]} tutarı`} inputMode="decimal" value={s.tutar} onChange={(e) => satirDegis(s.anahtar, { tutar: e.target.value })} style={{ maxWidth: 130, fontWeight: 700, minHeight: buyuk ? 46 : undefined }} />
          {s.arac === 2 && secenekler.pos.length > 1 && (
            <Form.Select aria-label="POS cihazı" size="sm" style={{ maxWidth: 200 }} value={s.posCihaziId ?? ""} onChange={(e) => satirDegis(s.anahtar, { posCihaziId: Number(e.target.value) || null })}>
              {secenekler.pos.map((p) => <option key={p.id} value={p.id}>{p.ad}</option>)}
            </Form.Select>
          )}
          {s.arac === 2 && secenekler.pos.length === 1 && <span className="small text-muted">{secenekler.pos[0].ad}</span>}
          {s.arac === 3 && (
            <Form.Select aria-label="Banka hesabı" size="sm" style={{ maxWidth: 220 }} value={s.cariKartId ?? ""} onChange={(e) => satirDegis(s.anahtar, { cariKartId: Number(e.target.value) || null })}>
              {secenekler.banka.map((b) => <option key={b.id} value={b.id}>{b.ad}</option>)}
            </Form.Select>
          )}
          {s.arac === 1 && <span className="small">{s.ad}</span>}
          {satirlar.length > 1 && <Button variant="link" className="p-0 text-danger" aria-label={`${ARAC_ADI[s.arac]} ödemesini sil`} onClick={() => satirSil(s.anahtar)}><IconX size={18} /></Button>}
        </div>
      ))}
      {satirlar.length > 0 && Math.abs(kalanSatir) > 0.004 && <div className="small fw-bold" style={{ color: "#b91c1c" }}>{kalanSatir > 0 ? `Eksik: ${yaz(kalanSatir)} TL` : `Fazla: ${yaz(-kalanSatir)} TL`}</div>}
      {nakitToplami > 0 && (
        <div className="d-flex align-items-center gap-2 mt-1">
          <span className="small">Alınan nakit</span>
          <Form.Control aria-label="Alınan nakit" inputMode="decimal" size="sm" value={alinan} onChange={(e) => setAlinan(e.target.value)} style={{ maxWidth: 120 }} />
          {paraUstu !== null && <span className="fw-bold" style={{ color: paraUstu < 0 ? "#b91c1c" : "#15803d" }}>{paraUstu < 0 ? `Eksik ${yaz(-paraUstu)}` : `Para üstü ${yaz(paraUstu)}`} TL</span>}
        </div>
      )}
      {!garson && (
        <div className="mt-2">
          <Form.Check type="switch" id="adisyon-musteri" label="Fatura isteyen müşteri" checked={musteriAcik} onChange={(e) => setMusteriAcik(e.target.checked)} />
          {musteriAcik && (
            <div className="row g-2 mt-1">
              <div className="col-6"><Form.Control size="sm" aria-label="VKN / TCKN" placeholder="VKN / TCKN" inputMode="numeric" maxLength={11} value={musteri.vknTckn || ""} onChange={(e) => setMusteri({ ...musteri, vknTckn: e.target.value.replace(/\D/g, "") })} /></div>
              <div className="col-6"><Form.Control size="sm" aria-label="Vergi dairesi" placeholder="Vergi dairesi" value={musteri.vergiDairesi || ""} onChange={(e) => setMusteri({ ...musteri, vergiDairesi: e.target.value })} /></div>
              <div className="col-12"><Form.Control size="sm" aria-label="Unvan / ad soyad" placeholder="Unvan / ad soyad" value={musteri.unvan || ""} onChange={(e) => setMusteri({ ...musteri, unvan: e.target.value })} /></div>
              <div className="col-12"><Form.Control size="sm" aria-label="Adres" placeholder="Adres" value={musteri.adres || ""} onChange={(e) => setMusteri({ ...musteri, adres: e.target.value })} /></div>
              <div className="col-4"><Form.Control size="sm" aria-label="İl" placeholder="İl" value={musteri.il || ""} onChange={(e) => setMusteri({ ...musteri, il: e.target.value })} /></div>
              <div className="col-4"><Form.Control size="sm" aria-label="İlçe" placeholder="İlçe" value={musteri.ilce || ""} onChange={(e) => setMusteri({ ...musteri, ilce: e.target.value })} /></div>
              <div className="col-4"><Form.Control size="sm" aria-label="E-posta" placeholder="E-posta" value={musteri.eposta || ""} onChange={(e) => setMusteri({ ...musteri, eposta: e.target.value })} /></div>
              {String(musteri.vknTckn || "").length === 10 && <div className="col-12"><Form.Check id="adisyon-mukellef" label="e-Fatura mükellefi (Ticari fatura)" checked={!!musteri.mukellef} onChange={(e) => setMusteri({ ...musteri, mukellef: e.target.checked })} /></div>}
            </div>
          )}
        </div>
      )}
    </div>
  );

  const kalemSatiri = (k: AdisyonKalemi) => {
    const m = secim[k.kalemId] || 0;
    const tartili = !!tartiBirimi(k.birim);
    const tamSec = () => setSecim({ ...secim, [k.kalemId]: m ? 0 : k.miktar });
    return (
      <div key={k.kalemId} className="d-flex align-items-center gap-2 py-1 border-bottom" style={{ background: m ? "#eff6ff" : undefined }}>
        <Form.Check aria-label={`${k.ad} seç`} checked={m > 0} onChange={tamSec} />
        <span className="flex-grow-1" role="button" onClick={tamSec}>{k.ad}{k.porsiyonAd ? ` (${k.porsiyonAd})` : ""}{k.ikram && <span className="small" style={{ color: "#0e7490" }}> · İkram</span>}
          <div className="small text-muted">{tartili ? `${String(k.miktar).replace(".", ",")} ${k.birim}` : `${k.miktar} × ${para(k.birimFiyat)}`}</div></span>
        {!tartili && k.miktar > 1 && m > 0 && (
          <span className="d-flex align-items-center gap-1">
            <Button size="sm" variant="outline-secondary" className="py-0 px-1" aria-label={`${k.ad} azalt`} onClick={() => setSecim({ ...secim, [k.kalemId]: Math.max(1, m - 1) })}><IconMinus size={12} /></Button>
            <span className="fw-bold" style={{ minWidth: 22, textAlign: "center" }}>{m}</span>
            <Button size="sm" variant="outline-secondary" className="py-0 px-1" aria-label={`${k.ad} artır`} onClick={() => setSecim({ ...secim, [k.kalemId]: Math.min(k.miktar, m + 1) })}><IconPlus size={12} /></Button>
          </span>
        )}
        <span className="text-nowrap fw-semibold" style={{ minWidth: 70, textAlign: "right" }}>{k.ikram ? "0,00" : para(y2((m || k.miktar) * k.birimFiyat))}</span>
      </div>
    );
  };

  return (
    <Modal show={!kartSorusu} onHide={() => { if (!mesgul) kapat(); }} centered size="lg" fullscreen={buyuk ? "sm-down" : undefined} backdrop="static">
      <Modal.Header closeButton={!mesgul} className="py-2">
        <Modal.Title className="h6 mb-0">{baslik ?? `Masa ${masaAd}`} — Hesap ({adisyon.adisyonNo})</Modal.Title>
        {onMusteriEkraniAc && <Button size="sm" variant="outline-secondary" className="ms-auto me-2 py-0" onClick={() => { const h = onMusteriEkraniAc(); if (h) setHata(h); }}>Müşteri ekranı</Button>}
      </Modal.Header>
      <Modal.Body style={{ opacity: mesgul ? 0.6 : 1, pointerEvents: mesgul ? "none" : undefined }}>
        {!hesap ? <Spinner size="sm" /> : (
          <>
            <div className="border rounded p-2 mb-3 small" style={{ background: "#f8fafc" }}>
              <div className="d-flex justify-content-between"><span>Ödenmemiş ürünler</span><span>{para(hesap.ara)}</span></div>
              {hesap.servis > 0 && <div className="d-flex justify-content-between"><span>Servis ücreti (%{String(adisyon.servisOrani).replace(".", ",")})</span><span>{para(hesap.servis)}</span></div>}
              {(hesap.indirim || 0) > 0 && <div className="d-flex justify-content-between fw-semibold" style={{ color: "#7c2d12" }} aria-label="İndirim"><span>İndirim{hesap.indirimTuru === 1 ? ` (%${String(hesap.indirimDegeri).replace(".", ",")})` : ""}{hesap.indirimNeden ? ` · ${hesap.indirimNeden}` : ""}</span><span>−{para(hesap.indirim || 0)}</span></div>}
              {Math.abs(hesap.yuvarlama) > 0.004 && <div className="d-flex justify-content-between text-muted"><span>KDV yuvarlaması</span><span>{para(hesap.yuvarlama)}</span></div>}
              <div className="d-flex justify-content-between fw-bold"><span>Ödenecek</span><span>{para(hesap.toplam)} TL</span></div>
              {bekleyen.length > 0 && (
                <div className="mt-1 pt-1 border-top">
                  {bekleyen.map((o) => (
                    <div key={o.odemeId} className="d-flex align-items-center justify-content-between">
                      <span>Alındı: {ARAC_ADI[o.arac]}{o.aciklama ? ` · ${o.aciklama}` : ""}{o.ekleyen ? ` · ${o.ekleyen}` : ""}</span>
                      <span className="d-flex align-items-center gap-2"><span>−{para(o.tutar)}</span>
                        {tahsilat && !o.posIslemId && <Button variant="link" className="p-0 text-danger" aria-label={`${para(o.tutar)} TL ara ödemeyi sil`} onClick={() => void odemeSil(o.odemeId)}><IconTrash size={15} /></Button>}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="d-flex justify-content-between fw-bold fs-5 mt-1" style={{ color: "#0f172a" }}><span>Kalan</span><span>{para(hesap.kalan)} TL</span></div>
              {hesap.fisler.length > 0 && <div className="text-muted mt-1">Yazılan fişler: {hesap.fisler.map((f) => `${f.faturaNo} (${para(f.toplam)})`).join(", ")}</div>}
              {(hesap.silinenOdemeler?.length || 0) > 0 && <div className="text-muted mt-1" aria-label="Silinen ara ödemeler">Silinen ara ödeme: {hesap.silinenOdemeler!.map((o) => `${para(o.tutar)} ${ARAC_ADI[o.arac] || ""}${o.silen ? ` (${o.silen})` : ""}`).join(", ")}</div>}
            </div>

            {!tahsilat ? <Alert variant="secondary" className="py-2 small mb-0">Tahsilat yetkiniz yok; "Hesap iste" ile kasaya bildirin.</Alert> : (
              <>
                <div className="d-flex flex-wrap gap-2 mb-3">
                  <Secim secili={mod === "tamami"} buyuk={buyuk} onClick={() => { setMod("tamami"); setSatirlar([]); }}>Tamamı</Secim>
                  <Secim secili={mod === "esit"} buyuk={buyuk} onClick={() => setMod("esit")}>Eşit böl</Secim>
                  <Secim secili={mod === "tutar"} buyuk={buyuk} onClick={() => setMod("tutar")}>Tutar</Secim>
                  {bolme && <Secim secili={mod === "urun"} buyuk={buyuk} onClick={() => { setMod("urun"); setSatirlar([]); }}>Ürün seç</Secim>}
                </div>

                {mod === "tamami" && (hesap.kalan > 0 || hesap.kalemSayisi > 0 ? satirEditoru : null)}
                {mod === "tamami" && hesap.kalan <= 0 && <div className="small text-muted mb-2">{hesap.kalemSayisi ? "Ödenecek tutar yok (ikram / ara ödemelerle kapandı); Kapat ile fiş yazılır." : "Ödenmemiş ürün yok; Kapat ile masa boşalır."}</div>}

                {mod === "esit" && (
                  <div>
                    <div className="d-flex align-items-center gap-2 mb-2">
                      <span className="fw-bold">Kalan kişi</span>
                      <Button variant="outline-secondary" aria-label="Kişi azalt" onClick={() => setKisi((k) => Math.max(1, k - 1))}><IconMinus size={14} /></Button>
                      <span className="fw-bold fs-5" style={{ minWidth: 30, textAlign: "center" }}>{kisi}</span>
                      <Button variant="outline-secondary" aria-label="Kişi artır" onClick={() => setKisi((k) => Math.min(50, k + 1))}><IconPlus size={14} /></Button>
                    </div>
                    {paylar.length > 0 && <div className="small text-muted mb-2">Paylar: {paylar.map((p) => para(p)).join(" + ")}</div>}
                    {paylar.length > 0 && (
                      <div className="d-flex flex-wrap gap-2">
                        {araclar.filter((a) => a.arac === 0 || a.arac === 2).map((a) => (
                          <Button key={a.arac} variant={a.arac === 0 ? "success" : "primary"} style={{ minHeight: dugmeY, fontWeight: 700 }} onClick={() => araOdeme(paylar[0], a.arac)}>
                            <a.ikon size={18} className="me-1" />1 pay {a.ad.toLocaleLowerCase("tr-TR")}: {para(paylar[0])} TL
                          </Button>
                        ))}
                      </div>
                    )}
                    <div className="small text-muted mt-2">Son pay alınınca tek satış fişi yazılır ve masa kapanır.{araKartCek ? " Kartla alınan payda POS cihazına gönderilsin mi sorulur." : " Ara ödemede kart cihazdan ayrıca çekilir."}</div>
                  </div>
                )}

                {mod === "tutar" && (
                  <div>
                    <div className="d-flex align-items-center gap-2 mb-2 flex-wrap">
                      <Form.Control aria-label="Ödeme tutarı" inputMode="decimal" placeholder="Tutar" value={tutar} onChange={(e) => setTutar(e.target.value)} style={{ maxWidth: 160, fontWeight: 700, minHeight: dugmeY }} />
                      {araclar.filter((a) => a.arac === 0 || a.arac === 2).map((a) => (
                        <Button key={a.arac} variant={a.arac === 0 ? "success" : "primary"} style={{ minHeight: dugmeY, fontWeight: 700 }} disabled={!(sayi(tutar) > 0)} onClick={() => araOdeme(sayi(tutar), a.arac)}><a.ikon size={18} className="me-1" />{a.ad}</Button>
                      ))}
                    </div>
                    <div className="small text-muted">Tutar kalanı ({para(hesap.kalan)}) aşamaz; kalan sıfırlanınca fiş yazılır ve masa kapanır.</div>
                  </div>
                )}

                {mod === "urun" && (
                  <div>
                    <div className="border rounded mb-2" style={{ maxHeight: buyuk ? "34vh" : 260, overflow: "auto" }}>
                      {odenmemis.length ? odenmemis.map(kalemSatiri) : <div className="small text-muted p-2">Ödenmemiş ürün yok.</div>}
                    </div>
                    <div className="small mb-2 d-flex gap-3 flex-wrap">
                      <span>Seçilen: <b>{para(secimHesabi.ara)}</b></span>
                      {secimHesabi.servis > 0 && <span>Servis: <b>{para(secimHesabi.servis)}</b></span>}
                      <span>Fiş tutarı: <b>{para(secimHesabi.toplam)} TL</b></span>
                    </div>
                    {secilen.length > 0 && satirEditoru}
                  </div>
                )}
              </>
            )}
            {hata && <Alert variant="danger" className="py-2 small mt-3 mb-0">{hata}</Alert>}
          </>
        )}
      </Modal.Body>
      <Modal.Footer className="py-2">
        <Button variant="outline-secondary" disabled={mesgul} onClick={kapat}>Kapat</Button>
        {tahsilat && hesap && (mod === "tamami" || (mod === "urun" && secilen.length > 0)) && (
          <Button variant="success" className="fw-bold" style={{ minHeight: dugmeY, minWidth: 180 }} disabled={mesgul || !!satirHata} title={satirHata || undefined} onClick={() => void tamamla()}>
            {mesgul ? <Spinner size="sm" /> : mod === "urun" ? `Seçilenleri öde (${para(secimHesabi.toplam)})` : hesap.kalan > 0 ? `Tahsil et ve kapat (${para(hesap.kalan)})` : "Kapat"}
          </Button>
        )}
      </Modal.Footer>
    </Modal>
  );
};

export default OdemeModal;
