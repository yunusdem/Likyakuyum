import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Alert, Badge, Button, Card, Col, Form, InputGroup, Row, Spinner, Table } from "react-bootstrap";
import { IconBinoculars, IconClock, IconPlus, IconShoppingBag, IconTrash, IconWallet } from "@tabler/icons-react";
import ERPToolbar from "../../components/common/ERPToolbar";
import { LookupModal } from "../../components/common/LookupModal";
import { usePosTahsilat, PosKarti } from "../../components/pos/PosTahsilat";
import { useToast } from "../../context/ToastContext";
import { useAuth } from "../../context/AuthContext";
import { CariKartItem, CariService } from "../../services/cariService";
import { CashDeskService, VezneItem } from "../../services/cashDeskService";
import { kullaniciVeznesi } from "../../utils/kullaniciVeznesi";
import { useKullaniciYetkisi } from "../../hooks/useKullaniciYetkisi";
import { PosCihaziItem, PosCihaziService } from "../../services/posCihaziService";
import { BankaHesapItem, BankaService } from "../../services/bankaService";
import { IskontoItem, IskontoService } from "../../services/iskontoService";
import { KurService } from "../../services/kurService";
import { ProductDefinitionService, ProductItem } from "../../services/productDefinitionService";
import { ebelgeService } from "../../services/ebelgeService";
import { PrinterService, YaziciItem } from "../../services/printerService";
import { resolveEffectivePrinter } from "../../utils/printerResolver";
import { triggerSilentPrint } from "../../services/silentPrintService";
import { ticariFisHtml } from "../../utils/belgeSablon/fisCikti";
import { StokKart, TicariOdeme, TicariSatisFisi, TicariSatisListeSatiri, TicariService, eksiStokUyarisiMi, miktarYaz, para } from "../../services/ticariService";
import { ticariFisHesapla, kartDahilFiyat, yuvarla2 } from "../../../Backend/src/services/ticari/ticariHesap";
import { MusteriSecimModal, SelectedCustomerResult, CustomerSearchField } from "../vezne/MusteriSecimModal";
import { DEFAULT_CUSTOMER_NAME, detectScenario, isAnonymousCustomerName } from "../vezne/PerakendeFisiPage";
import { StokKartSecici } from "./StokKartSecici";
import { StokKartModal } from "./StokKartModal";
import { TicariFisPrintModal } from "./TicariFisPrintModal";
import { useTicariYetki } from "./useTicariYetki";

/**
 * Ticari Satış Fişi (docs/TICARI_ISLEMLER_YOL_HARITASI.md, T12–T18): Perakende fişinin düzeninde, yalnız stok kartı ürünleri.
 * Fiyat KDV dahil (karttan gelir, değiştirilebilir), satır iskontosu (% / tutar) ve fiş iskontosu; ödeme Perakende'deki gibi
 * (vezne nakit / döviz, cari, POS, banka hesabı). Altın satışı Perakende'de kalır; alış ve iade yoktur.
 */

interface Satir {
  anahtar: string;
  stokKartId: number | null;
  kod: string;
  barkod: string;
  ad: string;
  birim: string;
  kdvOrani: number;
  miktar: string;
  fiyat: string;
  iskTur: 0 | 1 | 2;
  iskDeger: string;
  stok: number | null;
  /** Hızlı Satış'tan gelen serbest ürün satırı: stok kartı yok, stoktan düşmez (docs/HIZLI_SATIS_YOL_HARITASI.md, H9) */
  serbest?: boolean;
}

interface Odeme {
  anahtar: string;
  tur: 0 | 1 | 2 | 3;
  paraId: number | null;
  paraKodu: string;
  kur: string;
  miktar: string;
  tutar: string;
  cariKartId: number | null;
  cariKod: string;
  cariUnvan: string;
  posCihaziId: number | null;
  bankaId: number | null;
}

const sayi = (v: string | number | null | undefined): number => {
  const t = String(v ?? "").trim();
  if (!t) return 0;
  const n = Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t);
  return Number.isFinite(n) ? n : 0;
};
const metin = (n: number | null | undefined, hane = 2) => (n === null || n === undefined || Number.isNaN(n) ? "" : String(Math.round(n * 10 ** hane) / 10 ** hane).replace(".", ","));
const sadeceSayi = (v: string) => v.replace(/[^0-9.,]/g, "");
const iki = (n: number) => String(n).padStart(2, "0");
const yerelTarih = (d = new Date()) => `${d.getFullYear()}-${iki(d.getMonth() + 1)}-${iki(d.getDate())}`;
const yerelSaat = (d = new Date()) => `${iki(d.getHours())}:${iki(d.getMinutes())}`;
let sayac = 0;
const anahtar = () => `t${Date.now()}-${++sayac}`;
const bosSatir = (): Satir => ({ anahtar: anahtar(), stokKartId: null, kod: "", barkod: "", ad: "", birim: "", kdvOrani: 0, miktar: "", fiyat: "", iskTur: 0, iskDeger: "", stok: null });
/** Dolu satır: stok kartlı ya da serbest ürün */
const doluMu = (s: Satir) => !!s.stokKartId || !!s.serbest;
const bosOdeme = (): Odeme => ({ anahtar: anahtar(), tur: 0, paraId: null, paraKodu: "TL", kur: "1", miktar: "", tutar: "", cariKartId: null, cariKod: "", cariUnvan: "", posCihaziId: null, bankaId: null });
const TL = (k: string) => ["TL", "TRY", "TRL"].includes(String(k || "").trim().toUpperCase());
const ODEME_TURLERI: Record<number, string> = { 0: "Vezne", 1: "Cari", 2: "POS", 3: "Hesap" };

export interface TicariSatisFisiPageProps {
  isDuzeltme?: boolean;
}

export const TicariSatisFisiPage: React.FC<TicariSatisFisiPageProps> = ({ isDuzeltme = false }) => {
  const { user } = useAuth();
  const { showSuccess, showError, showWarning } = useToast();
  const yetki = useTicariYetki();
  // Kullanıcı kartı yetkileri: tarih, fatura no, fiyat, banka hesabı (docs/YETKI_VE_VEZNE_YOL_HARITASI.md §4.2; sunucu da denetler)
  const kYetki = useKullaniciYetkisi();
  const location = useLocation();
  const navigate = useNavigate();
  const pos = usePosTahsilat();

  // Başlık
  const [faturaId, setFaturaId] = useState<number | null>(null);
  const [faturaNo, setFaturaNo] = useState("");
  const [eBelgeDurumu, setEBelgeDurumu] = useState(0);
  const [tarih, setTarih] = useState(yerelTarih());
  const [saat, setSaat] = useState(yerelSaat());
  const [senaryo, setSenaryo] = useState("EARSIVFATURA");
  const [vezneler, setVezneler] = useState<VezneItem[]>([]);
  const [vezne, setVezne] = useState<VezneItem | null>(null);

  // Müşteri
  const [vkn, setVkn] = useState("");
  const [cariKod, setCariKod] = useState("");
  const [unvan, setUnvan] = useState(DEFAULT_CUSTOMER_NAME);
  const [cariKartId, setCariKartId] = useState<number | null>(null);
  const [vergiDairesi, setVergiDairesi] = useState("");
  const [il, setIl] = useState("");
  const [ilce, setIlce] = useState("");
  const [telefon, setTelefon] = useState("");
  const [eposta, setEposta] = useState("");
  const [adres, setAdres] = useState("");

  // Satırlar / iskonto / ödemeler
  const [satirlar, setSatirlar] = useState<Satir[]>([bosSatir()]);
  const [fisIskTur, setFisIskTur] = useState<0 | 1 | 2>(0);
  const [fisIskDeger, setFisIskDeger] = useState("");
  const [iskontoId, setIskontoId] = useState<number | null>(null);
  const [odemeler, setOdemeler] = useState<Odeme[]>([bosOdeme()]);

  // Tanımlar
  const [kartlar, setKartlar] = useState<StokKart[]>([]);
  const [cariler, setCariler] = useState<CariKartItem[]>([]);
  const [posCihazlari, setPosCihazlari] = useState<PosCihaziItem[]>([]);
  const [bankaHesaplari, setBankaHesaplari] = useState<BankaHesapItem[]>([]);
  const [iskontolar, setIskontolar] = useState<IskontoItem[]>([]);
  const [paralar, setParalar] = useState<ProductItem[]>([]);
  const [kurlar, setKurlar] = useState<Map<number, { alis: number; satis: number }>>(new Map());
  const [yazicilar, setYazicilar] = useState<YaziciItem[]>([]);

  // Pencereler
  const [secici, setSecici] = useState<{ acik: boolean; satir: string | null; arama: string }>({ acik: false, satir: null, arama: "" });
  const [yeniKart, setYeniKart] = useState<{ acik: boolean; barkod?: string; ad?: string; satir: string | null }>({ acik: false, satir: null });
  const [musteri, setMusteri] = useState<{ acik: boolean; arama: string; alan: CustomerSearchField; odemeSatiri: string | null }>({ acik: false, arama: "", alan: "all", odemeSatiri: null });
  const [onizleme, setOnizleme] = useState<any | null>(null);
  const [gecmis, setGecmis] = useState<{ acik: boolean; liste: TicariSatisListeSatiri[]; yukleniyor: boolean }>({ acik: false, liste: [], yukleniyor: false });
  const [kimlikler, setKimlikler] = useState<number[]>([]);
  const [kaydediliyor, setKaydediliyor] = useState(false);
  const kayitKilidi = useRef(false);
  const hucre = useRef<Record<string, HTMLInputElement | HTMLSelectElement | null>>({});
  const odak = (k: string, sec = true) => setTimeout(() => { const el = hucre.current[k] as HTMLInputElement | null; el?.focus(); if (sec) try { el?.select(); } catch { /* */ } }, 30);

  const kilitli = eBelgeDurumu === 1 || eBelgeDurumu === 2;

  // ── Tanımları yükle ──
  const kartlariYukle = useCallback(() => TicariService.kartlar({ aktif: null }).then(setKartlar).catch(() => setKartlar([])), []);
  useEffect(() => {
    void kartlariYukle();
    CariService.getCariKartlar().then(setCariler).catch(() => setCariler([]));
    PosCihaziService.getPosCihazlari().then(setPosCihazlari).catch(() => setPosCihazlari([]));
    BankaService.getBankalar().then(setBankaHesaplari).catch(() => setBankaHesaplari([]));
    IskontoService.getIskontolar({ aktif: true }, true).then((l) => setIskontolar((l || []).filter((i) => i.iskontoTipi === 1 || i.iskontoTipi === 2))).catch(() => setIskontolar([]));
    ProductDefinitionService.getProducts().then((l) => setParalar((l || []).filter((p) => Number(p.urunTipi) === 0 && !TL(p.kod)))).catch(() => setParalar([]));
    PrinterService.getYazicilar().then(setYazicilar).catch(() => setYazicilar([]));
    KurService.getKurTablosu({ tur: 0 }).then((t) => {
      const m = new Map<number, { alis: number; satis: number }>();
      for (const k of t?.satirlar || []) m.set(k.paraId, { alis: Number(k.efektifAlis ?? k.dovizAlis ?? 0) || 0, satis: Number(k.efektifSatis ?? k.dovizSatis ?? 0) || 0 });
      setKurlar(m);
    }).catch(() => setKurlar(new Map()));
    CashDeskService.getVezneler().then((list) => {
      setVezneler(list || []);
      // Vezne kullanıcının kasası (değiştirilemez); açık bir fiş varsa onun veznesi korunur
      setVezne((v) => v ?? kullaniciVeznesi(list, user as any));
    }).catch(() => setVezneler([]));
  }, [kartlariYukle]); // eslint-disable-line react-hooks/exhaustive-deps

  // Açılan fişin satırlarında stok sütunu kart listesinden dolar
  useEffect(() => {
    if (!kartlar.length) return;
    setSatirlar((p) => {
      let degisti = false;
      const y = p.map((s) => {
        if (!s.stokKartId || s.stok !== null) return s;
        const k = kartlar.find((x) => x.stokKartId === s.stokKartId);
        if (!k) return s;
        degisti = true;
        return { ...s, stok: k.bakiye };
      });
      return degisti ? y : p;
    });
  }, [kartlar, satirlar]);

  // Kayıt modunda saat canlı
  useEffect(() => {
    if (isDuzeltme) return;
    const t = setInterval(() => { setTarih(yerelTarih()); setSaat(yerelSaat()); }, 10000);
    return () => clearInterval(t);
  }, [isDuzeltme]);

  const siradakiNo = useCallback(async (s: string) => {
    try { setFaturaNo(await TicariService.satisSiraNo(s)); } catch { setFaturaNo(""); }
  }, []);

  // ── Hesap ──
  const dolu = useMemo(() => satirlar.filter(doluMu), [satirlar]);
  const hesap = useMemo(() => {
    try {
      return { sonuc: ticariFisHesapla(dolu.map((s) => ({ miktar: sayi(s.miktar) || 0, kdvDahilFiyat: sayi(s.fiyat), kdvOrani: s.kdvOrani, iskontoTuru: s.iskTur, iskontoDegeri: sayi(s.iskDeger) })).map((g) => ({ ...g, miktar: g.miktar > 0 ? g.miktar : 0.0000001 })),
        { turu: fisIskTur, deger: sayi(fisIskDeger) }), hata: null as string | null };
    } catch (e: any) {
      return { sonuc: null, hata: e?.message || "Hesap yapılamadı." };
    }
  }, [dolu, fisIskTur, fisIskDeger]);
  const genelToplam = hesap.sonuc?.genelToplam ?? 0;
  const odenen = useMemo(() => yuvarla2(odemeler.reduce((a, o) => a + sayi(o.tutar), 0)), [odemeler]);
  const kalan = yuvarla2(genelToplam - odenen);

  // ── Temizle / yükle ──
  const temizle = useCallback(async (s = "EARSIVFATURA") => {
    setFaturaId(null); setEBelgeDurumu(0);
    setVkn(""); setCariKod(""); setUnvan(DEFAULT_CUSTOMER_NAME); setCariKartId(null);
    setVergiDairesi(""); setIl(""); setIlce(""); setTelefon(""); setEposta(""); setAdres("");
    const ilk = bosSatir();
    setSatirlar([ilk]); setFisIskTur(0); setFisIskDeger(""); setIskontoId(null); setOdemeler([bosOdeme()]);
    setSenaryo(s); setTarih(yerelTarih()); setSaat(yerelSaat());
    setVezne(kullaniciVeznesi(vezneler, user as any));
    odak(`${ilk.anahtar}_barkod`);
    if (!isDuzeltme) await siradakiNo(s);
    else setFaturaNo("");
  }, [isDuzeltme, siradakiNo, vezneler, user]);

  const fisiAc = useCallback(async (id: number) => {
    try {
      const f = await TicariService.satis(id);
      const d = new Date(f.tarih);
      setFaturaId(f.faturaId); setFaturaNo(f.faturaNo); setEBelgeDurumu(f.eBelgeDurumu || 0); setTarih(yerelTarih(d)); setSaat(yerelSaat(d)); setSenaryo(f.senaryo || "EARSIVFATURA");
      // Düzeltmede fişin kendi veznesi (sunucu da kaydın veznesini korur)
      setVezne(f.vezneId ? ({ id: f.vezneId, kod: f.vezneKod || String(f.vezneId), ad: f.vezneAd || "" } as VezneItem) : null);
      setVkn(f.aliciVknTckn || ""); setCariKod(f.cariKod || ""); setUnvan(f.aliciUnvan || DEFAULT_CUSTOMER_NAME); setCariKartId(f.cariKartId ?? null);
      setVergiDairesi(f.vergiDairesi || ""); setIl(f.il || ""); setIlce(f.ilce || ""); setTelefon(f.telefon || ""); setEposta(f.eposta || ""); setAdres(f.adres || "");
      setSatirlar([...f.satirlar.map((s) => ({
        anahtar: anahtar(), stokKartId: s.stokKartId, serbest: !s.stokKartId, kod: s.kod, barkod: s.barkod, ad: s.urunAdi, birim: s.birim, kdvOrani: s.kdvOrani,
        miktar: metin(s.miktar, 4), fiyat: metin(s.kdvDahilFiyat, 4), iskTur: (s.iskontoTuru || 0) as 0 | 1 | 2, iskDeger: s.iskontoTuru ? metin(s.iskontoDegeri, 2) : "", stok: null,
      })), bosSatir()]);
      setFisIskTur((f.iskontoTuru || 0) as 0 | 1 | 2); setFisIskDeger(f.iskontoTuru ? metin(f.iskontoDegeri) : ""); setIskontoId(f.iskontoId ?? null);
      setOdemeler(f.odemeler.length ? f.odemeler.map((o) => ({
        anahtar: anahtar(), tur: (o.odemeAraciTuru || 0) as 0 | 1 | 2 | 3, paraId: o.paraId ?? null, paraKodu: o.paraKodu || "TL", kur: metin(o.kur ?? 1, 4),
        miktar: metin(o.miktar ?? o.tutar), tutar: metin(o.tutar), cariKartId: o.cariKartId ?? null, cariKod: o.cariKod || "", cariUnvan: o.cariUnvan || "",
        posCihaziId: o.odemeAraciTuru === 2 ? o.posCihaziId ?? null : null, bankaId: o.odemeAraciTuru === 3 ? o.cariKartId ?? null : null,
      })) : [bosOdeme()]);
    } catch (e: any) {
      showError(e?.message || "Fiş açılamadı.");
    }
  }, [showError]);

  const kimlikleriYukle = useCallback(async () => {
    const l = await TicariService.satisKimlikler().catch(() => []);
    setKimlikler(l.map((x) => x.faturaId));
    return l.map((x) => x.faturaId);
  }, []);

  useEffect(() => {
    if (!isDuzeltme) { void temizle(); return; }
    void kimlikleriYukle();
    const id = Number(new URLSearchParams(location.search).get("id"));
    if (id) void fisiAc(id);
    else void temizle();
  }, [isDuzeltme, location.search]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Ürün satırları ──
  const dovizKuru = (paraId: number | null) => (paraId ? kurlar.get(paraId)?.satis || 0 : 1);
  const kartFiyati = (k: StokKart) => {
    const dahil = kartDahilFiyat(k.satisFiyati, k.kdvOrani, k.fiyatKdvDahil);
    if (!k.paraId || TL(k.paraKodu || "")) return dahil;
    const kur = dovizKuru(k.paraId);
    if (!kur) { showWarning(`${k.paraKodu} kuru bulunamadı; "${k.ad}" fiyatını elle girin.`); return 0; }
    return Math.round(dahil * kur * 100) / 100;
  };

  const kartiSatiraKoy = (k: StokKart, satirAnahtari: string | null, adet = 1) => {
    if (!k.aktif) { showError(`"${k.ad}" kartı pasif; satılamaz.`); return; }
    setSatirlar((p) => {
      // Aynı ürün tekrar okutulursa miktarı artar
      const var_ = p.find((s) => s.stokKartId === k.stokKartId && s.anahtar !== satirAnahtari);
      let yeni: Satir[];
      if (var_ && (!satirAnahtari || !((x?: Satir) => !!x && doluMu(x))(p.find((s) => s.anahtar === satirAnahtari)))) {
        yeni = p.map((s) => (s === var_ ? { ...s, miktar: metin(sayi(s.miktar) + adet, 4) } : s.anahtar === satirAnahtari ? { ...s, barkod: "", ad: "" } : s));
      } else {
        const dolum: Partial<Satir> = { stokKartId: k.stokKartId, kod: k.kod, barkod: k.barkodlar[0] || "", ad: k.ad, birim: k.birim, kdvOrani: k.kdvOrani, miktar: metin(adet, 4), fiyat: metin(kartFiyati(k), 4), iskTur: 0, iskDeger: "", stok: k.bakiye };
        const hedef = satirAnahtari ? p.find((s) => s.anahtar === satirAnahtari) : p.find((s) => !doluMu(s));
        yeni = hedef ? p.map((s) => (s === hedef ? { ...s, ...dolum } : s)) : [...p, { ...bosSatir(), ...dolum }];
      }
      if (!yeni.some((s) => !doluMu(s))) yeni = [...yeni, bosSatir()];
      const sonBos = yeni.filter((s) => !doluMu(s)).pop();
      if (sonBos) odak(`${sonBos.anahtar}_barkod`);
      return yeni;
    });
    if (k.bakiye <= 0) showWarning(`"${k.ad}" stokta yok (${miktarYaz(k.bakiye)} ${k.birim}).`);
  };

  const barkodOkut = async (s: Satir, deger: string) => {
    const d = deger.trim();
    if (!d) { setSecici({ acik: true, satir: s.anahtar, arama: "" }); return; }
    const m = d.match(/^(\d+(?:[.,]\d+)?)\s*\*\s*(.+)$/);
    const adet = m ? sayi(m[1]) || 1 : 1;
    const aranan = m ? m[2].trim() : d;
    const k = kartlar.find((x) => x.barkodlar.includes(aranan) || x.kod === aranan.toLocaleUpperCase("tr-TR")) || (await TicariService.kartBul(aranan).catch(() => null));
    if (k) { kartiSatiraKoy(k, s.anahtar, adet); return; }
    if (yetki.yonetebilir && window.confirm(`"${aranan}" barkodlu ya da kodlu ürün bulunamadı. Yeni stok kartı açılsın mı?`)) {
      setYeniKart({ acik: true, barkod: /^\S+$/.test(aranan) ? aranan : undefined, ad: /\s/.test(aranan) ? aranan : undefined, satir: s.anahtar });
    } else setSecici({ acik: true, satir: s.anahtar, arama: aranan });
  };

  const satirDegis = (a: string, alan: keyof Satir, v: any) => setSatirlar((p) => p.map((s) => (s.anahtar === a ? { ...s, [alan]: v } : s)));
  const satirSil = (a: string) => setSatirlar((p) => { const y = p.filter((s) => s.anahtar !== a); return y.some((s) => !doluMu(s)) ? y : [...y, bosSatir()]; });

  // ── Ödemeler ──
  const odemeDegis = (a: string, d: Partial<Odeme>) => setOdemeler((p) => p.map((o) => {
    if (o.anahtar !== a) return o;
    const y = { ...o, ...d };
    // Döviz: tutar = miktar × kur; TL: miktar = tutar
    if ("miktar" in d || "kur" in d || "paraId" in d) {
      if (y.tur === 0 && !TL(y.paraKodu)) y.tutar = metin(sayi(y.miktar) * sayi(y.kur));
      else if ("miktar" in d) y.tutar = y.miktar;
    }
    if ("tutar" in d && (y.tur !== 0 || TL(y.paraKodu))) y.miktar = y.tutar;
    return y;
  }));
  const odemeTuruDegis = (o: Odeme, tur: 0 | 1 | 2 | 3) => odemeDegis(o.anahtar, {
    tur, paraId: null, paraKodu: "TL", kur: "1",
    cariKartId: tur === 1 ? cariKartId : null, cariKod: tur === 1 && cariKartId ? cariKod : "", cariUnvan: tur === 1 && cariKartId ? unvan : "",
    posCihaziId: tur === 2 ? posCihazlari[0]?.posCihaziId ?? null : null, bankaId: tur === 3 ? bankaHesaplari[0]?.bankaId ?? null : null,
  });
  const kalaniYaz = (o: Odeme) => {
    const digerleri = yuvarla2(odemeler.filter((x) => x.anahtar !== o.anahtar).reduce((a, x) => a + sayi(x.tutar), 0));
    const k = Math.max(0, yuvarla2(genelToplam - digerleri));
    if (o.tur === 0 && !TL(o.paraKodu) && sayi(o.kur) > 0) odemeDegis(o.anahtar, { miktar: metin(k / sayi(o.kur)) });
    else odemeDegis(o.anahtar, { tutar: metin(k) });
  };
  const paraSec = (o: Odeme, paraId: number | null) => {
    const p = paralar.find((x) => x.id === paraId);
    const kur = p ? kurlar.get(p.id)?.alis || 0 : 1;
    odemeDegis(o.anahtar, { paraId: p ? p.id : null, paraKodu: p ? String(p.kod).trim() : "TL", kur: metin(kur || 1, 4), miktar: "", tutar: "" });
  };

  // ── Müşteri ──
  const musteriSecildi = async (r: SelectedCustomerResult) => {
    const satir = musteri.odemeSatiri;
    setMusteri({ acik: false, arama: "", alan: "all", odemeSatiri: null });
    const kod = r.kod || (r.raw as any)?.kod || "";
    if (satir) {
      if (r.type !== "registered" || !r.id) { showWarning("Cari ödemesi için kayıtlı bir cari seçin."); return; }
      odemeDegis(satir, { cariKartId: r.id, cariKod: kod, cariUnvan: r.unvan });
      return;
    }
    const kimlik = r.vergiKimlikNo || (r.raw as any)?.pasaportNo || "";
    setUnvan(r.unvan); setVkn(kimlik); setCariKod(kod); setCariKartId(r.type === "registered" ? r.id : null);
    setAdres(r.adres || ""); setTelefon(r.telefon || ""); if (r.eposta) setEposta(r.eposta);
    if (r.vergiDairesi) setVergiDairesi(r.vergiDairesi); if (r.il) setIl(r.il); if (r.ilce) setIlce(r.ilce);
    const s = r.isMukellef || r.eFaturaPostaKutusu ? "TICARIFATURA" : detectScenario(kimlik, r.raw, r.unvan);
    senaryoDegis(s);
    if (kimlik && kimlik !== "11111111111") {
      ebelgeService.mukellefSorgula(kimlik).then((m) => { if (m?.mukellefMi) { senaryoDegis("TICARIFATURA"); const a = m.kullanicilar?.[0]?.Alias; if (a) setEposta((e) => e || a); } }).catch(() => undefined);
    }
    // Ödemedeki cari satırları yeni cariye
    if (r.type === "registered" && r.id) setOdemeler((p) => p.map((o) => (o.tur === 1 && !o.cariKartId ? { ...o, cariKartId: r.id, cariKod: kod, cariUnvan: r.unvan } : o)));
  };
  const senaryoDegis = (s: string) => {
    setSenaryo(s);
    if (!isDuzeltme) void siradakiNo(s);
  };
  const nihai = () => {
    setVkn(""); setCariKod(""); setUnvan(DEFAULT_CUSTOMER_NAME); setCariKartId(null); setAdres(""); setVergiDairesi(""); setIl(""); setIlce(""); setTelefon(""); setEposta("");
    senaryoDegis("EARSIVFATURA");
  };

  // ── Kaydet ──
  const girdi = (onay: boolean, kartlarPos: Record<string, PosKarti> = {}) => {
    const temizVkn = vkn.replace(/\D/g, "") || "11111111111";
    let odemeYuku: TicariOdeme[] = odemeler
      .filter((o) => sayi(o.tutar) > 0)
      .map((o, i) => ({
        satirNo: i + 1, odemeAraciTuru: o.tur,
        cariKartId: o.tur === 1 ? o.cariKartId : o.tur === 3 ? o.bankaId : null,
        posCihaziId: o.tur === 2 ? kartlarPos[o.anahtar]?.posCihaziId ?? o.posCihaziId : null,
        cariKod: o.tur === 1 ? o.cariKod : o.tur === 2 ? kartlarPos[o.anahtar]?.kod ?? posCihazlari.find((p) => p.posCihaziId === o.posCihaziId)?.kod ?? null : o.tur === 3 ? bankaHesaplari.find((b) => b.bankaId === o.bankaId)?.hesapNo ?? null : null,
        cariUnvan: o.tur === 1 ? o.cariUnvan : null,
        paraId: o.tur === 0 ? o.paraId : null, paraKodu: o.tur === 0 ? o.paraKodu : "TL",
        paraAdi: o.tur === 2 ? "KREDİ KARTI / POS" : o.tur === 3 ? "BANKA HAVALE / EFT" : o.tur === 1 ? "VERESİYE" : TL(o.paraKodu) ? "TÜRK LİRASI" : o.paraKodu,
        miktar: o.tur === 0 && !TL(o.paraKodu) ? sayi(o.miktar) : sayi(o.tutar), kur: o.tur === 0 && !TL(o.paraKodu) ? sayi(o.kur) : 1, tutar: sayi(o.tutar),
      }));
    if (!odemeYuku.length && genelToplam > 0) odemeYuku = [{ satirNo: 1, odemeAraciTuru: 0, paraKodu: "TL", paraAdi: "TÜRK LİRASI", miktar: genelToplam, kur: 1, tutar: genelToplam }];
    return {
      // Tarih değiştirme yetkisi yoksa yeni fiş şimdiki zamanla (kilitli kutu gece yarısını geçen ekranda dünü tutuyordu)
      faturaId, vezneId: vezne?.id ?? null, faturaNo, tarih: !kYetki.tarihDegistirme && !faturaId ? new Date().toISOString() : new Date(`${tarih}T${saat || "00:00"}:00`).toISOString(), senaryo,
      cariKartId, aliciVknTckn: temizVkn, aliciUnvan: isAnonymousCustomerName(unvan) ? "NİHAİ TÜKETİCİ" : unvan.trim(),
      adres, ilce, il, vergiDairesi, eposta, telefon,
      iskontoId, iskontoKodu: iskontolar.find((i) => i.iskontoId === iskontoId)?.kod || null, iskontoTuru: fisIskTur, iskontoDegeri: sayi(fisIskDeger),
      satirlar: dolu.map((s) => ({ stokKartId: s.stokKartId, ...(s.serbest ? { urunAdi: s.ad, birim: s.birim, kdvOrani: s.kdvOrani } : {}), miktar: sayi(s.miktar), kdvDahilFiyat: sayi(s.fiyat), iskontoTuru: s.iskTur, iskontoDegeri: s.iskTur ? sayi(s.iskDeger) : null })),
      odemeler: odemeYuku, eksiStokOnay: onay,
    };
  };

  const kaydet = async (yazdir = false, onay = false) => {
    if (kayitKilidi.current) return;
    if (kilitli) { showError("Bu fiş e-Belge olarak iletildi; düzeltilemez."); return; }
    if (!dolu.length) { showWarning("Fişe en az bir ürün ekleyin."); odak(`${satirlar[0]?.anahtar}_barkod`); return; }
    const bozuk = dolu.find((s) => !(sayi(s.miktar) > 0));
    if (bozuk) { showWarning(`${bozuk.ad}: miktar sıfırdan büyük olmalı.`); return; }
    if (hesap.hata) { showError(hesap.hata); return; }
    const t = vkn.replace(/\D/g, "");
    if (t && t.length !== 10 && t.length !== 11) { showError("TCKN 11, VKN 10 hane olmalı."); return; }
    if (kalan < -0.05) { showError(`Ödeme toplamı (${para(odenen)} TL) fiş toplamından (${para(genelToplam)} TL) fazla. Fazlayı düzeltin.`); return; }
    const cariEksik = odemeler.find((o) => o.tur === 1 && sayi(o.tutar) > 0 && !o.cariKartId);
    if (cariEksik) { showWarning("Cari ödeme satırında cari seçin."); setMusteri({ acik: true, arama: "", alan: "kod", odemeSatiri: cariEksik.anahtar }); return; }

    kayitKilidi.current = true;
    setKaydediliyor(true);
    let tekrar = false;
    try {
      const yuk = girdi(onay);
      const r = await TicariService.satisKaydet(yuk);
      const f = r.fis;
      if (r.uyari) showWarning(r.uyari);
      // POS: fiş kaydedildikten sonra kart çekilir (Perakende'deki sıra, docs/POS_ENTEGRASYON_YOL_HARITASI.md K28)
      const posSatirlari = odemeler.filter((o) => o.tur === 2 && sayi(o.tutar) > 0);
      if (posSatirlari.length) {
        const sonuc = await pos.tahsilEt({
          belgeTuru: "perakende", belgeNo: f.faturaNo, belgeTipi: senaryo === "EARSIVFATURA" ? "earsiv" : "efatura", belgeId: f.faturaId, kayitSonrasi: !faturaId,
          vezneId: vezne?.id ?? null, aliciAd: f.aliciUnvan, aliciVkn: f.aliciVknTckn || null,
          pesinOdemeler: odemeler.filter((o) => o.tur !== 2 && sayi(o.tutar) > 0).map((o) => ({ tur: o.tur === 1 ? ("cari" as const) : o.tur === 3 ? ("havale" as const) : ("nakit" as const), tutar: sayi(o.tutar) })),
          satirlar: posSatirlari.map((o) => ({ kimlik: o.anahtar, tutar: sayi(o.tutar), posCihaziId: o.posCihaziId })),
          kalemler: f.satirlar.map((s) => ({ ad: s.urunAdi, miktar: s.miktar, tutar: s.toplamTutar, kdvOrani: s.kdvOrani })),
        });
        if (Object.keys(sonuc.kartlar).length) await TicariService.satisKaydet({ ...girdi(true, sonuc.kartlar), faturaId: f.faturaId, faturaNo: f.faturaNo });
        await pos.kaydedildi("perakende", f.faturaId, f.faturaNo);
        if (!sonuc.tamam) {
          showWarning(`Fiş ${f.faturaNo} kaydedildi ancak POS tahsilatı alınmadı. Ödeme satırını düzeltip yeniden kaydedin.`);
          navigate(`/ticari/satis-fisi-duzeltme?id=${f.faturaId}`);
          return;
        }
      }
      if (yazdir) await yazdirFis(f);
      showSuccess(`${f.faturaNo} numaralı satış fişi kaydedildi.`);
      void kartlariYukle();
      if (isDuzeltme) { await kimlikleriYukle(); await fisiAc(f.faturaId); }
      else await temizle(senaryo === "TICARIFATURA" ? "EARSIVFATURA" : senaryo);
    } catch (e: any) {
      if (eksiStokUyarisiMi(e)) tekrar = window.confirm(e.message);
      else showError(e?.message || "Fiş kaydedilemedi.");
    } finally {
      kayitKilidi.current = false;
      setKaydediliyor(false);
    }
    if (tekrar) await kaydet(yazdir, true);
  };

  const yazdirFis = async (f: TicariSatisFisi) => {
    const r = resolveEffectivePrinter({ pageType: "perakende", tip: 1, vezne, user, printers: yazicilar });
    const pos80 = r.recommendedPrintType === "POS";
    try {
      const c = await ticariFisHtml({ ...f, vezneKod: vezne?.kod }, pos80 ? "80" : "A4");
      const s = await triggerSilentPrint({ html: c.html, printerName: r.printer?.cihazAdi || r.printer?.ad || null, copies: r.kopyaSayisi || 1, isPos: pos80, title: `Satis_Fisi_${f.faturaNo}` });
      if (!s.success) showWarning(`Fiş kaydedildi ancak yazdırılamadı: ${s.message}`);
    } catch (e: any) {
      showWarning(`Fiş kaydedildi ancak yazdırılamadı: ${e?.message || "bilinmeyen hata"}`);
    }
  };

  const onizle = () => {
    if (!dolu.length) { showWarning("Önizleme için ürün ekleyin."); return; }
    const g = girdi(false);
    setOnizleme({
      ...g, faturaNo: faturaNo || "(kayıtta verilecek)", vezneKod: vezne?.kod,
      satirlar: dolu.map((s, i) => ({ satirNo: i + 1, kod: s.kod, barkod: s.barkod, urunAdi: s.ad, birim: s.birim, miktar: sayi(s.miktar), kdvDahilFiyat: sayi(s.fiyat), kdvOrani: s.kdvOrani, iskontoTuru: s.iskTur, iskontoDegeri: sayi(s.iskDeger) })),
      odemeler: g.odemeler,
    });
  };

  const sil = async () => {
    if (!faturaId) return;
    if (kilitli) { showError("Bu fiş e-Belge olarak iletildi; silinemez."); return; }
    if (!window.confirm(`${faturaNo} numaralı satış fişi silinsin mi? Stok ve tahsilat geri alınır.`)) return;
    try {
      await TicariService.satisSil(faturaId);
      showSuccess("Fiş silindi.");
      const l = await kimlikleriYukle();
      const sonraki = l.filter((x) => x < faturaId).pop() ?? l[0];
      if (sonraki) navigate(`/ticari/satis-fisi-duzeltme?id=${sonraki}`, { replace: true }); else { navigate("/ticari/satis-fisi-duzeltme", { replace: true }); void temizle(); }
    } catch (e: any) {
      showError(e?.message || "Fiş silinemedi.");
    }
  };

  const git = (yon: "ilk" | "onceki" | "sonraki" | "son") => {
    if (!kimlikler.length) return;
    const i = faturaId ? kimlikler.indexOf(faturaId) : -1;
    const hedef = yon === "ilk" ? kimlikler[0] : yon === "son" ? kimlikler[kimlikler.length - 1]
      : yon === "onceki" ? kimlikler[Math.max(0, (i < 0 ? kimlikler.length : i) - 1)] : kimlikler[Math.min(kimlikler.length - 1, i + 1)];
    if (hedef) navigate(`/ticari/satis-fisi-duzeltme?id=${hedef}`);
  };

  const gecmisAc = async () => {
    setGecmis({ acik: true, liste: [], yukleniyor: true });
    const liste = await TicariService.satisListe({}).catch(() => []);
    setGecmis({ acik: true, liste, yukleniyor: false });
  };

  // Kısayollar: F1 kaydet, F10 kaydet + yazdır, F9 önizleme, F2 sil (düzeltme)
  const kisayol = useRef<(e: KeyboardEvent) => void>(() => undefined);
  kisayol.current = (e: KeyboardEvent) => {
    if (secici.acik || musteri.acik || yeniKart.acik || onizleme || gecmis.acik) return;
    if (e.key === "F1") { e.preventDefault(); void kaydet(false); }
    else if (e.key === "F10") { e.preventDefault(); void kaydet(true); }
    else if (e.key === "F9") { e.preventDefault(); onizle(); }
    else if (e.key === "F2" && isDuzeltme && faturaId) { e.preventDefault(); void sil(); }
  };
  useEffect(() => {
    const f = (e: KeyboardEvent) => kisayol.current(e);
    window.addEventListener("keydown", f);
    return () => window.removeEventListener("keydown", f);
  }, []);

  const etiket = { width: 75, minWidth: 75, fontSize: "12px", fontWeight: 600 } as const;
  const satirIsk = (i: number) => hesap.sonuc?.satirlar[i];
  const doluIndeks = (s: Satir) => dolu.findIndex((x) => x.anahtar === s.anahtar);

  return (
    <div className="perakende-fisi-page w-100 pb-3" style={{ fontFamily: "'Segoe UI', sans-serif", fontSize: "12.5px", minHeight: "100vh" }}>
      {pos.pencere}
      <ERPToolbar
        disableShortcuts
        pageTitle={isDuzeltme ? "B- Satış Fişi Düzeltme" : "A- Satış Fişi"}
        pageIcon={<IconShoppingBag size={20} />}
        onNew={() => (isDuzeltme ? navigate("/ticari/satis-fisi") : void temizle())}
        onSave={() => void kaydet(false)}
        onPrint={onizle}
        onSaveAndPrint={() => void kaydet(true)}
        onSearch={isDuzeltme ? gecmisAc : undefined}
        onDelete={isDuzeltme && faturaId ? () => void sil() : undefined}
        hideSearch={!isDuzeltme}
        hideDelete={!isDuzeltme || !faturaId}
        hideNavigation={!isDuzeltme}
        onFirst={isDuzeltme ? () => git("ilk") : undefined}
        onPrev={isDuzeltme ? () => git("onceki") : undefined}
        onNext={isDuzeltme ? () => git("sonraki") : undefined}
        onLast={isDuzeltme ? () => git("son") : undefined}
        disabled={kaydediliyor}
        modeText={isDuzeltme ? "Düzeltme Modu" : "Yeni Kayıt Modu"}
        centerContent={
          <div className="d-flex align-items-center gap-2">
            <div style={{ border: "2px solid #c2410c", color: "#c2410c", fontWeight: 800, fontSize: "13.5px", letterSpacing: "3px", minWidth: 200, padding: "4px 24px", borderRadius: 6, height: 30, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "#fff7ed" }}>
              SATIŞ
            </div>
            <Badge bg="primary" className="px-2 py-1" style={{ fontSize: 11 }}>{senaryo === "EARSIVFATURA" ? "e-Arşiv" : senaryo === "TEMELFATURA" ? "Temel Fatura" : "e-Fatura"}</Badge>
          </div>
        }
        rightContent={
          isDuzeltme ? (
            <div className="d-flex align-items-center gap-1 bg-white px-2 border rounded font-monospace" style={{ height: 28 }}>
              <span className="text-secondary fw-bold" style={{ fontSize: 11 }}>TARİH</span>
              <input type="date" className="form-control form-control-sm border-0 p-0 text-center fw-semibold bg-transparent" style={{ width: 110, fontSize: 11.5, height: 22 }} value={tarih} onChange={(e) => setTarih(e.target.value)}
                disabled={!kYetki.tarihDegistirme} title={kYetki.tarihDegistirme ? undefined : "Tarih değiştirme yetkiniz yok"} />
              <input type="time" className="form-control form-control-sm border-0 p-0 text-center bg-transparent" style={{ width: 55, fontSize: 11, height: 22 }} value={saat} onChange={(e) => setSaat(e.target.value)}
                disabled={!kYetki.tarihDegistirme} />
            </div>
          ) : (
            <div className="d-flex align-items-center gap-1 px-2 rounded border bg-white font-monospace" style={{ height: 28, fontSize: 11 }} title="Fiş tarihi ve saati (otomatik)">
              <IconClock size={13} /><span className="fw-semibold">{tarih.split("-").reverse().join(".")}</span><strong>{saat}</strong>
            </div>
          )
        }
      />

      {kilitli && <Alert variant="warning" className="py-2 my-2">Bu fiş e-Belge olarak iletildi; düzeltilemez ve silinemez.</Alert>}

      {/* Vezne / fatura no / senaryo */}
      <div className="d-flex align-items-center flex-wrap gap-3 mb-2 p-1 border rounded bg-light" style={{ fontSize: 12 }}>
        <div className="d-flex align-items-center gap-1">
          <span className="fw-bold text-primary">VEZNE</span>
          {/* Vezne giriş yapan kullanıcının kasasıdır, değiştirilemez (düzeltmede fişin veznesi) */}
          <Form.Control size="sm" readOnly disabled value={vezne ? `${vezne.kod} ${vezne.ad}`.trim() : "Tanımsız"} className="fw-bold bg-light"
            style={{ width: 150, fontSize: 12, cursor: "not-allowed" }} title="Vezne giriş yapan kullanıcıya aittir ve değiştirilemez" />
        </div>
        <div className="d-flex align-items-center gap-1">
          <span className="fw-bold text-secondary">FATURA NO</span>
          <Form.Control size="sm" className="font-monospace fw-bold text-primary" value={faturaNo} readOnly={isDuzeltme || !kYetki.fisNoDegistirme} title={!kYetki.fisNoDegistirme ? "Fiş numarası değiştirme yetkiniz yok" : undefined} onChange={(e) => setFaturaNo(e.target.value.toUpperCase())} placeholder="Otomatik" style={{ width: 170, fontSize: 11.5 }} />
        </div>
        <div className="d-flex align-items-center gap-1">
          <span className="fw-bold text-secondary">SENARYO</span>
          <Form.Select size="sm" value={senaryo} onChange={(e) => senaryoDegis(e.target.value)} style={{ width: 140, fontSize: 12, fontWeight: 600 }}>
            <option value="EARSIVFATURA">e-Arşiv</option><option value="TICARIFATURA">e-Fatura</option><option value="TEMELFATURA">Temel Fatura</option>
          </Form.Select>
        </div>
      </div>

      {/* Müşteri */}
      <Card className="shadow-sm mb-2 border">
        <Card.Body className="p-2">
          <div className="d-flex align-items-center gap-2 mb-2 flex-wrap">
            <div className="d-flex align-items-center gap-1">
              <label style={etiket} className="mb-0 text-secondary">TCKN / VKN</label>
              <InputGroup size="sm" style={{ width: 170 }}>
                <Form.Control value={vkn} placeholder="TCKN / VKN" style={{ fontFamily: "monospace", fontWeight: 600, fontSize: 12 }}
                  onChange={(e) => setVkn(e.target.value.replace(/\D/g, "").slice(0, 11))}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === "F4") { e.preventDefault(); const c = cariler.find((x) => (x.vergiKimlikNo || "").trim() === vkn); if (c) void musteriSecildi({ type: "registered", id: c.id, kod: c.kod, unvan: c.ad, vergiKimlikNo: c.vergiKimlikNo || "", adres: c.adres || "", telefon: c.telefon || "", raw: c }); else setMusteri({ acik: true, arama: vkn, alan: "vkn", odemeSatiri: null }); } }} />
                <Button variant="outline-secondary" className="px-1 py-0" title="Müşteri seç" onClick={() => setMusteri({ acik: true, arama: vkn, alan: "vkn", odemeSatiri: null })}><IconBinoculars size={13} /></Button>
              </InputGroup>
            </div>
            <div className="d-flex align-items-center gap-1">
              <label style={{ ...etiket, width: 65, minWidth: 65 }} className="mb-0 text-secondary">Cari Kodu</label>
              <InputGroup size="sm" style={{ width: 130 }}>
                <Form.Control value={cariKod} placeholder="Cari kodu" style={{ fontFamily: "monospace", fontWeight: 600, fontSize: 12 }}
                  onChange={(e) => setCariKod(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === "F4") { e.preventDefault(); const c = cariler.find((x) => (x.kod || "").trim().toLowerCase() === cariKod.trim().toLowerCase()); if (c) void musteriSecildi({ type: "registered", id: c.id, kod: c.kod, unvan: c.ad, vergiKimlikNo: c.vergiKimlikNo || "", adres: c.adres || "", telefon: c.telefon || "", raw: c }); else setMusteri({ acik: true, arama: cariKod, alan: "kod", odemeSatiri: null }); } }} />
                <Button variant="outline-secondary" className="px-1 py-0" title="Cari seç" onClick={() => setMusteri({ acik: true, arama: cariKod, alan: "kod", odemeSatiri: null })}><IconBinoculars size={13} /></Button>
              </InputGroup>
            </div>
            <div className="d-flex align-items-center gap-1" style={{ flex: "1 1 260px" }}>
              <label style={etiket} className="mb-0 text-secondary">Müşteri Adı</label>
              <InputGroup size="sm" style={{ flex: 1 }}>
                <Form.Control value={unvan} onFocus={(e) => e.target.select()} onChange={(e) => { setUnvan(e.target.value); if (cariKartId) setCariKartId(null); }}
                  onBlur={() => { if (!unvan.trim() || isAnonymousCustomerName(unvan)) { setUnvan(DEFAULT_CUSTOMER_NAME); setCariKartId(null); setCariKod(""); } }}
                  onKeyDown={(e) => { if (e.key === "F4" || (e.key === "Enter" && unvan.trim() && !isAnonymousCustomerName(unvan) && !cariKartId)) { e.preventDefault(); setMusteri({ acik: true, arama: isAnonymousCustomerName(unvan) ? "" : unvan, alan: "unvan", odemeSatiri: null }); } }} />
                <Button variant="outline-secondary" className="px-1 py-0" title="Müşteri seç (F4)" onClick={() => setMusteri({ acik: true, arama: isAnonymousCustomerName(unvan) ? "" : unvan, alan: "unvan", odemeSatiri: null })}><IconBinoculars size={13} /></Button>
              </InputGroup>
              <Button variant="outline-primary" size="sm" className="px-1 py-0" style={{ fontSize: 11 }} onClick={nihai} title="Nihai tüketici">Nihai</Button>
            </div>
          </div>
          <div className="d-flex align-items-center gap-2 flex-wrap">
            <div className="d-flex align-items-center gap-1" style={{ flex: 1, minWidth: 170 }}><label style={etiket} className="mb-0 text-secondary">Vergi Dairesi</label><Form.Control size="sm" value={vergiDairesi} onChange={(e) => setVergiDairesi(e.target.value)} /></div>
            <div className="d-flex align-items-center gap-1" style={{ flex: 1.2, minWidth: 200 }}><label style={{ ...etiket, width: 55, minWidth: 55 }} className="mb-0 text-secondary">İl / İlçe</label><Form.Control size="sm" placeholder="İl" value={il} onChange={(e) => setIl(e.target.value)} /><Form.Control size="sm" placeholder="İlçe" value={ilce} onChange={(e) => setIlce(e.target.value)} /></div>
            <div className="d-flex align-items-center gap-1" style={{ flex: 1, minWidth: 150 }}><label style={{ ...etiket, width: 50, minWidth: 50 }} className="mb-0 text-secondary">Telefon</label><Form.Control size="sm" value={telefon} onChange={(e) => setTelefon(e.target.value)} /></div>
            <div className="d-flex align-items-center gap-1" style={{ flex: 1, minWidth: 160 }}><label style={{ ...etiket, width: 50, minWidth: 50 }} className="mb-0 text-secondary">E-Posta</label><Form.Control size="sm" type="email" value={eposta} onChange={(e) => setEposta(e.target.value)} /></div>
            <div className="d-flex align-items-center gap-1" style={{ flex: 1.5, minWidth: 200 }}><label style={{ ...etiket, width: 45, minWidth: 45 }} className="mb-0 text-secondary">Adres</label><Form.Control size="sm" value={adres} onChange={(e) => setAdres(e.target.value)} /></div>
          </div>
        </Card.Body>
      </Card>

      {/* Ürünler */}
      <Card className="shadow-sm mb-2 border">
        <Card.Body className="p-2">
          <div className="table-responsive" style={{ minHeight: 160 }}>
            <Table bordered size="sm" hover className="mb-0 align-middle text-nowrap" style={{ fontSize: 11.5, minWidth: 980 }}>
              <thead style={{ background: "#d9e8fb" }}>
                <tr className="text-center">
                  <th style={{ width: 28 }}>#</th><th style={{ width: 150 }}>Barkod / Kod</th><th>Ürün Adı</th><th style={{ width: 70 }}>Stok</th>
                  <th style={{ width: 85 }}>Miktar</th><th style={{ width: 55 }}>Birim</th><th style={{ width: 100 }}>Fiyat (KDV dahil)</th>
                  <th style={{ width: 140 }}>İskonto</th><th style={{ width: 55 }}>KDV %</th><th style={{ width: 85 }}>KDV (₺)</th><th style={{ width: 105 }}>Tutar</th><th style={{ width: 30 }}></th>
                </tr>
              </thead>
              <tbody>
                {satirlar.map((s, i) => {
                  const h = doluMu(s) ? satirIsk(doluIndeks(s)) : undefined;
                  return (
                    <tr key={s.anahtar}>
                      <td className="text-center text-muted fw-bold">{i + 1}</td>
                      <td style={{ padding: "2px 4px" }}>
                        {doluMu(s) ? <span className="font-monospace fw-semibold">{s.serbest ? "Serbest" : s.barkod || s.kod}</span> : (
                          <InputGroup size="sm">
                            <Form.Control ref={(el) => { hucre.current[`${s.anahtar}_barkod`] = el; }} value={s.barkod} placeholder="Barkod okutun" disabled={kilitli}
                              style={{ fontSize: 11.5, fontFamily: "monospace" }}
                              onChange={(e) => satirDegis(s.anahtar, "barkod", e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") { e.preventDefault(); void barkodOkut(s, s.barkod); }
                                else if (e.key === "F4") { e.preventDefault(); setSecici({ acik: true, satir: s.anahtar, arama: s.barkod }); }
                                else if (e.key === "ArrowDown" || (e.key === "Tab" && !e.shiftKey && !s.barkod)) { const o = odemeler[0]; if (o && e.key === "ArrowDown") { e.preventDefault(); odak(`${o.anahtar}_tutar`); } }
                              }} />
                            <Button variant="outline-secondary" className="px-1 py-0" tabIndex={-1} disabled={kilitli} title="Listeden seç (F4)" onClick={() => setSecici({ acik: true, satir: s.anahtar, arama: s.barkod })}><IconBinoculars size={12} /></Button>
                          </InputGroup>
                        )}
                      </td>
                      <td style={{ padding: "2px 4px" }}>
                        {doluMu(s) ? <span className="fw-semibold">{s.ad} <span className="text-muted small font-monospace">{s.kod}</span></span> : (
                          <Form.Control size="sm" value={s.ad} placeholder="Ürün adı yazıp Enter" disabled={kilitli} style={{ fontSize: 11.5 }}
                            onChange={(e) => satirDegis(s.anahtar, "ad", e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter" || e.key === "F4") { e.preventDefault(); setSecici({ acik: true, satir: s.anahtar, arama: s.ad }); } }} />
                        )}
                      </td>
                      <td className={`text-end ${s.stok !== null && s.stok - sayi(s.miktar) < 0 ? "text-danger fw-bold" : "text-muted"}`}>{s.stokKartId && s.stok !== null ? miktarYaz(s.stok) : ""}</td>
                      <td style={{ padding: "2px 4px" }}>
                        {doluMu(s) && <Form.Control size="sm" className="text-end fw-semibold" inputMode="decimal" value={s.miktar} disabled={kilitli} ref={(el) => { hucre.current[`${s.anahtar}_miktar`] = el; }}
                          style={{ fontSize: 11.5, background: !(sayi(s.miktar) > 0) ? "#fee2e2" : undefined }} onChange={(e) => satirDegis(s.anahtar, "miktar", sadeceSayi(e.target.value))}
                          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); const b = satirlar.find((x) => !doluMu(x)); if (b) odak(`${b.anahtar}_barkod`); } }} />}
                      </td>
                      <td className="text-center small">{s.birim}</td>
                      <td style={{ padding: "2px 4px" }}>
                        {doluMu(s) && <Form.Control size="sm" className="text-end" inputMode="decimal" value={s.fiyat} disabled={kilitli || (!s.serbest && !kYetki.tutarDegistirme)} style={{ fontSize: 11.5 }} onChange={(e) => satirDegis(s.anahtar, "fiyat", sadeceSayi(e.target.value))}
                          title={!s.serbest && !kYetki.tutarDegistirme ? "Fişte tutar değiştirme yetkiniz yok; fiyat stok kartından gelir" : undefined} />}
                      </td>
                      <td style={{ padding: "2px 4px" }}>
                        {doluMu(s) && (
                          <InputGroup size="sm">
                            <Form.Select value={s.iskTur} disabled={kilitli} style={{ fontSize: 11, maxWidth: 62, minWidth: 62, padding: "1px 18px 1px 4px" }} onChange={(e) => satirDegis(s.anahtar, "iskTur", Number(e.target.value))}>
                              <option value={0}>—</option><option value={1}>%</option><option value={2}>TL</option>
                            </Form.Select>
                            <Form.Control className="text-end" inputMode="decimal" value={s.iskDeger} disabled={kilitli || !s.iskTur} style={{ fontSize: 11.5 }} onChange={(e) => satirDegis(s.anahtar, "iskDeger", sadeceSayi(e.target.value))} />
                          </InputGroup>
                        )}
                      </td>
                      <td className="text-center">{doluMu(s) ? `%${s.kdvOrani}` : ""}</td>
                      <td className="text-end text-muted">{h ? para(h.kdvTutari) : ""}</td>
                      <td className="text-end fw-bold">{h ? para(h.toplamTutar) : ""}</td>
                      <td className="text-center">{doluMu(s) && !kilitli && <Button variant="link" size="sm" className="p-0 text-danger" title="Satırı sil" onClick={() => satirSil(s.anahtar)}><IconTrash size={13} /></Button>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </div>
          {hesap.hata && <div className="text-danger small mt-1">{hesap.hata}</div>}
        </Card.Body>
      </Card>

      {/* Ödeme + toplamlar */}
      <Card className="shadow-sm mb-2 border">
        <Card.Body className="p-2">
          <Row className="g-2">
            <Col lg={8} md={7}>
              <div className="border rounded bg-white overflow-hidden">
                <div className="bg-light px-2 py-1 border-bottom d-flex justify-content-between align-items-center">
                  <span className="fw-bold text-secondary" style={{ fontSize: 12 }}>ÖDEME / TAHSİLAT</span>
                  {!kilitli && <Button size="sm" variant="outline-primary" className="py-0" onClick={() => setOdemeler((p) => [...p, bosOdeme()])}><IconPlus size={13} className="me-1" />Satır</Button>}
                </div>
                <div style={{ overflowX: "auto" }}>
                  <Table bordered size="sm" className="mb-0 align-middle text-nowrap" style={{ fontSize: 11.5, minWidth: 680 }}>
                    <thead style={{ background: "#d9e8fb" }}>
                      <tr className="text-center"><th style={{ width: 28 }}>#</th><th style={{ width: 85 }}>Tür</th><th>Kod / Açıklama</th><th style={{ width: 95 }}>Para</th><th style={{ width: 95 }}>Miktar</th><th style={{ width: 85 }}>Kur</th><th style={{ width: 120 }}>Tutar (TL)</th></tr>
                    </thead>
                    <tbody>
                      {odemeler.map((o, i) => (
                        <tr key={o.anahtar} style={o.tur === 1 ? { background: "#fee2e2" } : undefined}>
                          <td className="text-center text-muted">
                            <div className="d-flex align-items-center justify-content-center gap-1">{i + 1}
                              {!kilitli && <Button variant="link" size="sm" className="p-0 text-danger" title="Sil" onClick={() => setOdemeler((p) => (p.length > 1 ? p.filter((x) => x.anahtar !== o.anahtar) : [bosOdeme()]))}><IconTrash size={12} /></Button>}
                            </div>
                          </td>
                          <td style={{ padding: "2px 4px" }}>
                            <Form.Select size="sm" value={o.tur} disabled={kilitli} style={{ fontSize: 11, fontWeight: 600 }} onChange={(e) => odemeTuruDegis(o, Number(e.target.value) as 0 | 1 | 2 | 3)}>
                              {[0, 1, 2, 3].filter((t) => t !== 3 || kYetki.bankaHesabiSecme || o.tur === 3).map((t) => <option key={t} value={t} disabled={t === 3 && !kYetki.bankaHesabiSecme}>{ODEME_TURLERI[t]}</option>)}
                            </Form.Select>
                          </td>
                          <td style={{ padding: "2px 4px" }}>
                            {o.tur === 0 && <span className="text-muted small">Vezne {vezne?.kod || ""}</span>}
                            {o.tur === 1 && (
                              <InputGroup size="sm">
                                <Form.Control readOnly value={o.cariKartId ? `${o.cariKod} ${o.cariUnvan}` : ""} placeholder="Cari seçin (F4)" style={{ fontSize: 11 }}
                                  onClick={() => !kilitli && setMusteri({ acik: true, arama: "", alan: "kod", odemeSatiri: o.anahtar })}
                                  onKeyDown={(e) => { if (e.key === "F4" || e.key === "Enter") { e.preventDefault(); setMusteri({ acik: true, arama: "", alan: "kod", odemeSatiri: o.anahtar }); } }} />
                                <Button variant="outline-danger" className="px-1 py-0" disabled={kilitli} onClick={() => setMusteri({ acik: true, arama: "", alan: "kod", odemeSatiri: o.anahtar })}><IconBinoculars size={12} /></Button>
                              </InputGroup>
                            )}
                            {o.tur === 2 && (
                              <Form.Select size="sm" value={o.posCihaziId ?? ""} disabled={kilitli} style={{ fontSize: 11 }} onChange={(e) => odemeDegis(o.anahtar, { posCihaziId: e.target.value ? Number(e.target.value) : null })}>
                                <option value="">POS seçin</option>
                                {posCihazlari.map((p) => <option key={p.posCihaziId} value={p.posCihaziId}>{p.kod} {p.ad}</option>)}
                              </Form.Select>
                            )}
                            {o.tur === 3 && (
                              <Form.Select size="sm" value={o.bankaId ?? ""} disabled={kilitli} style={{ fontSize: 11 }} onChange={(e) => odemeDegis(o.anahtar, { bankaId: e.target.value ? Number(e.target.value) : null })}>
                                <option value="">Banka hesabı seçin</option>
                                {bankaHesaplari.map((b) => <option key={b.bankaId} value={b.bankaId}>{b.hesapNo} {b.hesapAdi}</option>)}
                              </Form.Select>
                            )}
                          </td>
                          <td style={{ padding: "2px 4px" }}>
                            {o.tur === 0 ? (
                              <Form.Select size="sm" value={o.paraId ?? ""} disabled={kilitli} style={{ fontSize: 11 }} onChange={(e) => paraSec(o, e.target.value ? Number(e.target.value) : null)}>
                                <option value="">TL</option>
                                {paralar.map((p) => <option key={p.id} value={p.id}>{String(p.kod).trim()}</option>)}
                              </Form.Select>
                            ) : <span className="text-muted small">TL</span>}
                          </td>
                          <td style={{ padding: "2px 4px" }}>
                            {o.tur === 0 && !TL(o.paraKodu) && <Form.Control size="sm" className="text-end" inputMode="decimal" value={o.miktar} disabled={kilitli} style={{ fontSize: 11.5 }} onChange={(e) => odemeDegis(o.anahtar, { miktar: sadeceSayi(e.target.value) })} />}
                          </td>
                          <td style={{ padding: "2px 4px" }}>
                            {o.tur === 0 && !TL(o.paraKodu) && <Form.Control size="sm" className="text-end" inputMode="decimal" value={o.kur} disabled={kilitli} style={{ fontSize: 11.5 }} onChange={(e) => odemeDegis(o.anahtar, { kur: sadeceSayi(e.target.value) })} />}
                          </td>
                          <td style={{ padding: "2px 4px" }}>
                            <InputGroup size="sm">
                              <Form.Control className="text-end fw-bold" inputMode="decimal" value={o.tutar} disabled={kilitli || (o.tur === 0 && !TL(o.paraKodu))} ref={(el) => { hucre.current[`${o.anahtar}_tutar`] = el; }}
                                style={{ fontSize: 11.5 }} onChange={(e) => odemeDegis(o.anahtar, { tutar: sadeceSayi(e.target.value) })}
                                onKeyDown={(e) => { if (e.key === "Enter" && !o.tutar) { e.preventDefault(); kalaniYaz(o); } }} />
                              {!kilitli && <Button variant="outline-success" className="px-1 py-0" title="Kalanı yaz (boşken Enter)" onClick={() => kalaniYaz(o)}><IconWallet size={12} /></Button>}
                            </InputGroup>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              </div>
              <div className="small text-muted mt-1">Ödeme girilmezse tutarın tamamı veznede nakit TL sayılır. Tutar kutusu boşken Enter kalanı yazar. Kısayollar: F1 Kaydet · F10 Kaydet ve Yazdır · F9 Önizleme</div>
            </Col>
            <Col lg={4} md={5}>
              <div className="border rounded bg-white p-2" style={{ fontSize: 12.5 }}>
                <div className="d-flex align-items-center gap-1 mb-2">
                  <span className="fw-bold text-secondary" style={{ minWidth: 80 }}>Fiş iskontosu</span>
                  <Form.Select size="sm" value={iskontoId ?? ""} disabled={kilitli} style={{ maxWidth: 130, fontSize: 11 }}
                    onChange={(e) => {
                      const d = iskontolar.find((x) => x.iskontoId === Number(e.target.value));
                      setIskontoId(d ? d.iskontoId : null);
                      if (d) { setFisIskTur(d.iskontoTipi === 1 ? 1 : 2); setFisIskDeger(metin(d.iskontoTipi === 1 ? d.oran : d.tutar)); }
                    }}>
                    <option value="">Elle</option>
                    {iskontolar.map((d) => <option key={d.iskontoId} value={d.iskontoId}>{d.kod || d.tanim}</option>)}
                  </Form.Select>
                  <Form.Select size="sm" value={fisIskTur} disabled={kilitli} style={{ maxWidth: 66, minWidth: 66, fontSize: 11 }} onChange={(e) => { setFisIskTur(Number(e.target.value) as 0 | 1 | 2); setIskontoId(null); }}>
                    <option value={0}>—</option><option value={1}>%</option><option value={2}>TL</option>
                  </Form.Select>
                  <Form.Control size="sm" className="text-end" inputMode="decimal" value={fisIskDeger} disabled={kilitli || !fisIskTur} onChange={(e) => { setFisIskDeger(sadeceSayi(e.target.value)); setIskontoId(null); }} />
                </div>
                <div className="d-flex justify-content-between"><span>Brüt toplam</span><b>{para(hesap.sonuc?.brutDahil ?? 0)}</b></div>
                <div className="d-flex justify-content-between text-success"><span>İskonto</span><b>-{para(hesap.sonuc?.toplamIskontoDahil ?? 0)}</b></div>
                <div className="d-flex justify-content-between text-muted"><span>KDV hariç</span><span>{para(hesap.sonuc?.matrah ?? 0)}</span></div>
                <div className="d-flex justify-content-between text-muted"><span>KDV</span><span>{para(hesap.sonuc?.toplamKdv ?? 0)}</span></div>
                <div className="d-flex justify-content-between border-top mt-1 pt-1 fs-5"><span className="fw-bold">GENEL TOPLAM</span><b className="text-primary">{para(genelToplam)} TL</b></div>
                <div className="d-flex justify-content-between"><span>Ödenen</span><b>{para(odenen)}</b></div>
                <div className={`d-flex justify-content-between fw-bold ${kalan < -0.05 ? "text-danger" : kalan > 0.004 ? "text-warning" : "text-success"}`}>
                  <span>{kalan < -0.004 ? "Fazla ödeme" : "Kalan"}</span><span>{para(Math.abs(kalan))}</span>
                </div>
                <div className="small text-muted">{dolu.length} kalem · {miktarYaz(dolu.reduce((a, s) => a + sayi(s.miktar), 0))} birim</div>
                <div className="d-grid gap-1 mt-2">
                  <Button variant="primary" disabled={kaydediliyor || kilitli} onClick={() => void kaydet(false)}>{kaydediliyor ? <Spinner size="sm" className="me-1" /> : null}Kaydet (F1)</Button>
                  <Button variant="outline-primary" size="sm" disabled={kaydediliyor || kilitli} onClick={() => void kaydet(true)}>Kaydet ve Yazdır (F10)</Button>
                </div>
              </div>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* Pencereler */}
      <StokKartSecici show={secici.acik} kartlar={kartlar} aramaMetni={secici.arama} pasifSecilemez
        onHide={() => setSecici({ acik: false, satir: null, arama: "" })}
        onSelect={(k) => { const a = secici.satir; setSecici({ acik: false, satir: null, arama: "" }); kartiSatiraKoy(k, a, 1); }}
        onYeni={yetki.yonetebilir ? () => { const a = secici.satir; const t = secici.arama.trim(); setSecici({ acik: false, satir: null, arama: "" }); setYeniKart({ acik: true, barkod: /^\d{6,}$/.test(t) ? t : undefined, ad: /^\d{6,}$/.test(t) ? undefined : t || undefined, satir: a }); } : undefined} />
      <StokKartModal show={yeniKart.acik} onBarkod={yeniKart.barkod} onAd={yeniKart.ad} onHide={() => setYeniKart({ acik: false, satir: null })}
        onSaved={(k) => { const a = yeniKart.satir; setYeniKart({ acik: false, satir: null }); void kartlariYukle(); kartiSatiraKoy(k, a, 1); }} />
      {musteri.acik && (
        <MusteriSecimModal show={musteri.acik} cariler={cariler} kayitsizMusteriler={[]} initialSearchTerm={musteri.arama} initialSearchField={musteri.alan}
          onClose={() => setMusteri({ acik: false, arama: "", alan: "all", odemeSatiri: null })} onSelectCustomer={(r) => void musteriSecildi(r)} />
      )}
      <TicariFisPrintModal show={!!onizleme} onHide={() => setOnizleme(null)} fatura={onizleme} vezne={vezne} />
      <LookupModal<TicariSatisListeSatiri>
        show={gecmis.acik} onHide={() => setGecmis({ acik: false, liste: [], yukleniyor: false })} title="Satış Fişi Ara" items={gecmis.liste} isLoading={gecmis.yukleniyor}
        searchPlaceholder="Fatura no, müşteri ya da VKN..."
        columns={[
          { header: "Fatura No", width: "150px", render: (f) => <span className="font-monospace fw-bold">{f.faturaNo}</span>, highlight: true },
          { header: "Tarih", width: "130px", render: (f) => new Date(f.tarih).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" }) },
          { header: "Müşteri", render: (f) => f.aliciUnvan, highlight: true },
          { header: "Toplam", width: "110px", align: "right", render: (f) => `${para(f.genelToplam)} TL` },
          { header: "e-Belge", width: "80px", align: "center", render: (f) => (f.eBelgeDurumu ? <Badge bg="success">İletildi</Badge> : null) },
        ]}
        filterFn={(f, t) => { const a = t.toLocaleLowerCase("tr-TR"); return f.faturaNo.toLocaleLowerCase("tr-TR").includes(a) || f.aliciUnvan.toLocaleLowerCase("tr-TR").includes(a) || f.aliciVknTckn.includes(t); }}
        onSelect={(f) => { setGecmis({ acik: false, liste: [], yukleniyor: false }); navigate(`/ticari/satis-fisi-duzeltme?id=${f.faturaId}`); }}
        selectOnDoubleClick
      />
    </div>
  );
};

export default TicariSatisFisiPage;
