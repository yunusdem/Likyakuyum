import React, { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Badge, Button, Col, Form, Modal, Row, Spinner, Table } from "react-bootstrap";
import { IconPlayerPlay, IconReceipt } from "@tabler/icons-react";
import { useAuth } from "../../context/AuthContext";
import { AuthService } from "../../services/authService";
import { SarrafFisService, UrunItem } from "../../services/sarrafFisService";
import { KurService } from "../../services/kurService";
import { StatisticService } from "../../services/statisticService";
import { CompanyService } from "../../services/companyService";
import { BankaService, BankaHesapItem } from "../../services/bankaService";
import { CashDeskService } from "../../services/cashDeskService";
import { CariService } from "../../services/cariService";
import { MasakService } from "../../services/masakService";
import { ebelgeService } from "../../services/ebelgeService";
import { EBankaService, MutabakatSatiri } from "../../services/ebankaService";
import { recomputeRow, resolveEffectiveUrunTipi, isZiynetProduct } from "../vezne/SarrafFisiPage";
import { ALTIN_KODU } from "../../../Backend/src/services/kuyumKodlari";
import { EB_VARSAYILAN_KDV } from "./ebankaIscilik";
import { ebankaHareketHesabi, ebankaHesapAciklamasi } from "./useEBankaFisKesimi";
import {
  TfIstatistik, TfKur, TfMusteri, TfOdeme, fisIstatistigi, gumusKuru, hasKuru, kayitVerisi, kurlariBirlestir, masakEksikleri,
  masakSiniriAsildi, satirHasKuru, topluSatir, urunKuru, varsayilanIstatistik, varsayilanVezne,
} from "./ebankaTopluFis";
import { paraYaz, zamanYaz } from "./ebankaOrtak";

/**
 * e-Banka Muhasebeleştirme — toplu Sarraf fişi (docs/EBANKA_MUHASEBELESTIRME_YOL_HARITASI.md T1–T9). Arka planda, başlamadan önizlemeli:
 * her hareket kesilecek / atlanacak + nedeniyle görünür; Başlat ile sırayla kaydedilip hareketle eşlenir. Satır hesabı Sarraf fişi ekranının
 * kendi recomputeRow'uyla (e-Banka işçilik dengesi dahil), kurallar ebankaTopluFis.ts'te.
 */

const ISIMSIZ = "İsim beyan edilmemiştir";
const rakam = (v: unknown) => String(v ?? "").replace(/\D/g, "");
/** Satır değerleri sayı ya da "0.146" gibi metin; Türkçe yazımda ("1.250,75") virgül ondalıktır */
const sayiOku = (v: unknown) => {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const t = String(v ?? "").trim();
  if (!t) return 0;
  const n = t.includes(",") ? Number(t.replace(/\./g, "").replace(",", ".")) : Number(t);
  return Number.isFinite(n) ? n : 0;
};
/** İşçilik / KDV kutusu: "100", "100,50", "1.250,75", "1.250" (binlik), "100.5" */
const tutarOku = (v: string) => {
  const t = (v || "").trim();
  if (!t) return 0;
  if (!t.includes(",") && /^\d{1,3}(\.\d{3})+$/.test(t)) return Number(t.replace(/\./g, ""));
  return sayiOku(t);
};

interface OnKontrol {
  hazir: boolean;
  musteri?: TfMusteri;
  cari?: any;
  masakEslesme?: number;
  belgeTuru?: number;
  hata?: string;
}

interface Veri {
  urunler: UrunItem[];
  tumUrunler: UrunItem[];
  kurlar: TfKur[];
  istatistikler: TfIstatistik[];
  tanim: Record<string, any> | null;
  bankalar: BankaHesapItem[];
  vezne: { id: number; kod: string; ad: string } | null;
}

type Sonuc = { durum: "kesiliyor" | "kesildi" | "eslenemedi" | "hata"; mesaj: string };

export const EBankaTopluFisKes: React.FC<{
  satirlar: MutabakatSatiri[] | null;
  /** Seçilip uygun olmadığı için listeye alınmayanlar (fişi var, virman …) */
  atlananlar?: { ad: string; neden: string }[];
  onKapat: (degisti: boolean) => void;
  onTekliKes: (s: MutabakatSatiri) => void;
}> = ({ satirlar, atlananlar = [], onKapat, onTekliKes }) => {
  const { user } = useAuth();
  const iscilikGirisSekli = Number(user?.iscilikGirisSekli ?? AuthService.getUser()?.iscilikGirisSekli ?? 0);
  const [veri, setVeri] = useState<Veri | null>(null);
  const [hata, setHata] = useState("");
  const [onKontrol, setOnKontrol] = useState<Record<number, OnKontrol>>({});
  const [urunId, setUrunId] = useState<number | null>(null);
  const [kdvYazi, setKdvYazi] = useState(String(EB_VARSAYILAN_KDV));
  const [hepsine, setHepsine] = useState("");
  const [iscilik, setIscilik] = useState<Record<number, string>>({});
  const [sonuc, setSonuc] = useState<Record<number, Sonuc>>({});
  const [calisiyor, setCalisiyor] = useState(false);
  const [degisti, setDegisti] = useState(false);
  const tur = useRef(0);

  // Açılış: tanımlar + her hareketin ön kontrolü (cari, e-Fatura mükellefi, adres, MASAK sorgusu)
  useEffect(() => {
    if (!satirlar) return;
    const benim = ++tur.current;
    setVeri(null);
    setHata("");
    setOnKontrol({});
    setIscilik({});
    setSonuc({});
    setHepsine("");
    setKdvYazi(String(EB_VARSAYILAN_KDV));
    setDegisti(false);
    (async () => {
      try {
        const [urunler, anlik, gunluk, istatistikler, tanim, bankalar, vezneler, kullaniciVezneId] = await Promise.all([
          SarrafFisService.getUrunler(),
          KurService.getKurTablosu({ tur: 0 }).catch(() => null),
          KurService.getKurTablosu({ tur: 1 }).catch(() => null),
          StatisticService.getStatistics().catch(() => []),
          CompanyService.getDefinitions(true).catch(() => null),
          BankaService.getBankalar({ aktif: true }).catch(() => [] as BankaHesapItem[]),
          CashDeskService.getVezneler().catch(() => []),
          user?.id ? SarrafFisService.getUserVezneId(Number(user.id)).catch(() => null) : Promise.resolve(null),
        ]);
        if (benim !== tur.current) return;
        const altinGumus = urunler.filter((u) => [1, 2].includes(resolveEffectiveUrunTipi(u)) && !isZiynetProduct(u));
        const vezne = varsayilanVezne(vezneler as { id: number; kod: string; ad: string }[], kullaniciVezneId, user?.cashierCode);
        setVeri({
          urunler: altinGumus,
          tumUrunler: urunler,
          kurlar: kurlariBirlestir((gunluk?.satirlar || []) as TfKur[], (anlik?.satirlar || []) as TfKur[]),
          istatistikler: istatistikler as TfIstatistik[],
          tanim: (tanim as any) || null,
          bankalar,
          vezne: vezne ? { id: vezne.id, kod: vezne.kod, ad: vezne.ad } : null,
        });
        const v22 = altinGumus.find((u) => (u.kod || "").trim() === "22");
        setUrunId((v22 || altinGumus[0])?.paraId ?? null);
      } catch (err: any) {
        if (benim === tur.current) setHata(err?.message || "Tanımlar okunamadı.");
        return;
      }
      // Ön kontrol: aynı anda 4 hareket
      const kuyruk = [...satirlar];
      const isle = async () => {
        for (let s = kuyruk.shift(); s; s = kuyruk.shift()) {
          const sonucu = await onKontrolYap(s);
          if (benim !== tur.current) return;
          setOnKontrol((o) => ({ ...o, [s!.vomsisId]: sonucu }));
        }
      };
      await Promise.all(Array.from({ length: Math.min(4, kuyruk.length) }, isle));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [satirlar]);

  /** Müşteri: cari varsa kartından, yoksa bankanın verdiği ad ve VKN / TC ile kayıtsız (T3); e-Fatura mükellefi ve MASAK sorgusu */
  const onKontrolYap = async (s: MutabakatSatiri): Promise<OnKontrol> => {
    try {
      let cari: any = null;
      let m: TfMusteri;
      if (s.cari) {
        cari = await CariService.getCariKartById(s.cari.cariKartId);
        m = {
          cariKartId: s.cari.cariKartId, unvan: (cari?.ad || cari?.unvan || s.cari.ad || "").trim() || ISIMSIZ, vkn: rakam(cari?.vergiKimlikNo).slice(0, 11),
          adres: cari?.adres || "", telefon: cari?.telefon || "", eposta: cari?.eFaturaPostaKutusu || cari?.eFaturaPosta || cari?.eposta || "",
          kisilikTipi: cari?.kisilikTipi !== undefined && cari?.kisilikTipi !== null ? Number(cari.kisilikTipi) : null,
          babaAdi: cari?.babaAdi, anneAdi: cari?.anneAdi, dogumTarihi: cari?.dogumTarihi ? String(cari.dogumTarihi).split("T")[0] : null,
          dogumYeri: cari?.dogumYeri, kimlikSeriNo: cari?.kimlikSeriNo, pasaportNo: cari?.pasaportNo,
          kimlikBelgeTuru: cari?.kimlikBelgeTuru !== undefined && cari?.kimlikBelgeTuru !== null ? Number(cari.kimlikBelgeTuru) : null,
          kimlikGecerlilikTarihi: cari?.kimlikGecerlilikTarihi ? String(cari.kimlikGecerlilikTarihi).split("T")[0] : null,
          vekilAdi: cari?.vekilAdi, vekilKimlikNo: cari?.vekilKimlikNo,
        };
      } else {
        m = {
          cariKartId: null, unvan: (s.karsiTaraf || "").toLocaleUpperCase("tr-TR").slice(0, 120).trim() || ISIMSIZ,
          vkn: rakam(s.karsiNo).slice(0, 11), adres: "", telefon: "", eposta: "", kisilikTipi: null,
        };
      }
      let belgeTuru = cari && (cari.eFaturaPostaKutusu || cari.eFaturaPosta || cari.eFatura || cari.isMukellef) ? 1 : 0;
      if (m.vkn.length === 10 || m.vkn.length === 11) {
        const [mukellef, adresler] = await Promise.all([
          belgeTuru ? Promise.resolve(null) : ebelgeService.mukellefSorgula(m.vkn).catch(() => null),
          m.adres ? Promise.resolve([]) : ebelgeService.aliciAdresleri(m.vkn).catch(() => []),
        ]);
        if (mukellef?.mukellefMi) {
          belgeTuru = 1;
          if (!m.eposta && mukellef.kullanicilar?.[0]?.Alias) m.eposta = mukellef.kullanicilar[0].Alias;
        }
        const a: any = (adresler || [])[0];
        if (a) {
          m.adres = m.adres || [a.adres, a.ilce, a.il].filter(Boolean).join(" ");
          m.telefon = m.telefon || a.telefon || "";
        }
      }
      // MASAK: adı (beyan değilse) ya da numarası olan her müşteri sorgulanır
      const ad = m.unvan.toLocaleUpperCase("tr-TR").includes("BEYAN") ? "" : m.unvan;
      let masakEslesme = 0;
      if (ad || m.vkn) {
        const r = await MasakService.sorgula({ ad: ad || undefined, kimlikNo: m.vkn || undefined, limit: 15 });
        masakEslesme = r?.kayitlar?.length || 0;
      }
      return { hazir: true, musteri: m, cari, masakEslesme, belgeTuru };
    } catch (err: any) {
      return { hazir: true, hata: err?.message || "Müşteri bilgisi alınamadı." };
    }
  };

  const urun = veri?.urunler.find((u) => u.paraId === urunId) || null;
  const kdvOrani = Math.max(0, tutarOku(kdvYazi));
  const masakKontroluVar = (() => {
    const v = veri?.tanim?.FIS_MASAK_KONTROLU_VAR;
    return !(v === false || v === 0 || v === "0" || v === "false");
  })();

  /** Hareketin fişi: kesilebilir mi, neden atlanır; kesilecekse ekranın hesabıyla satır ve kayıt girdileri */
  const degerlendir = (s: MutabakatSatiri) => {
    const k = onKontrol[s.vomsisId];
    if (!veri) return { tamam: false as const, neden: "Tanımlar yükleniyor" };
    if (!veri.vezne) return { tamam: false as const, neden: "Kullanıcının veznesi tanımlı değil" };
    if (!urun) return { tamam: false as const, neden: "Ürün seçin" };
    if (!k?.hazir) return { tamam: false as const, neden: "Kontrol ediliyor…", bekliyor: true };
    if (k.hata || !k.musteri) return { tamam: false as const, neden: k.hata || "Müşteri bilgisi alınamadı" };
    const hesap = veri.bankalar.find((b) => b.bankaId === s.bankaId);
    if (!hesap) return { tamam: false as const, neden: "e-Banka hesabı bir Banka Hesap Kartı ile eşlenmemiş (e-Banka › Hesaplar)" };
    const tlHesap = ["TL", "TRY", ""].includes((s.doviz || "TL").toUpperCase());
    const hedef = tlHesap ? s.tutar : s.tlKarsilik ?? 0;
    if (!(hedef > 0)) return { tamam: false as const, neden: "Döviz hesabın TL karşılığı (kur) yok" };
    const tip: 0 | 1 = s.yon === "gelen" ? 1 : 0;
    const istatistik = fisIstatistigi(tip, k.cari, veri.istatistikler, varsayilanIstatistik(tip, veri.istatistikler, veri.tanim, user as any));
    // e-Banka fişinde işçilik KDV'si istatistikten bağımsız (M19); KDV'siz (gayri resmi) istatistik yalnız MASAK sorgu kuralında
    const gayriResmi = Number(istatistik?.fisDizaynTipi) === 1;
    const kdvKapali = false;
    const urunTipi = resolveEffectiveUrunTipi(urun);
    const otoKur = urunKuru(urun, veri.kurlar, tip);
    const kur = otoKur > 0 ? otoKur : satirHasKuru(urun, urunTipi, veri.kurlar, tip);
    if (!(kur > 0)) return { tamam: false as const, neden: `${urun.ad} için kur yok (Anlık Fiyat Listesi)` };
    const altinHasKuru = hasKuru(veri.kurlar, tip);
    const x = tutarOku(iscilik[s.vomsisId] || "");
    if (x > 0 && x >= hedef) return { tamam: false as const, neden: "İşçilik hareket tutarından büyük ya da eşit" };
    // Satır: ürün seçimindeki e-Banka dalı gibi, sonra İşçilik Toplam yazılmış gibi (ebankaTopluFis.ts topluSatir, ekranın recomputeRow'uyla)
    const satir: any = topluSatir(recomputeRow, {
      urun: urun as any, urunTipi, tip, kur, altinHasKuru, hedef, kdvOrani, kdvKapali, iscilikToplam: x, iscilikGirisSekli,
    });
    if (!(sayiOku(satir.miktar) > 0) || Math.abs(sayiOku(satir.tutar) - hedef) > 0.005) return { tamam: false as const, neden: "Satır hesaplanamadı (kur / milyem kontrol edin)" };
    // Ödeme: banka hesabı + tutar; döviz hesapta döviz miktarı × kur (e-Banka ön doldurmasıyla aynı)
    const dovizKodu = (s.doviz || "").trim().toUpperCase();
    const dovizPara = tlHesap ? undefined
      : veri.tumUrunler.find((u) => (u.urunTipi ?? 0) === 0 && (u.kod || "").trim().toUpperCase() === dovizKodu)
        || veri.kurlar.find((u) => (u.kod || "").trim().toUpperCase() === dovizKodu);
    const hesapAdi = ebankaHesapAciklamasi(ebankaHareketHesabi(s), hesap.hesapAdi)
      || (hesap.hesapAdi ? `${hesap.bankaAdi ? hesap.bankaAdi + " - " : ""}${hesap.hesapAdi}` : hesap.bankaAdi || "BANKA HAVALE / EFT");
    const odeme: TfOdeme = dovizPara
      ? { bankaId: hesap.bankaId, hesapNo: hesap.hesapNo || "", hesapAdi, paraId: dovizPara.paraId ?? null, paraKodu: dovizPara.kod || dovizKodu, paraAdi: dovizPara.ad || dovizKodu, miktar: s.tutar, kur: parseFloat((hedef / s.tutar).toFixed(4)), tutar: hedef }
      : { bankaId: hesap.bankaId, hesapNo: hesap.hesapNo || "", hesapAdi, paraId: null, paraKodu: "TL", paraAdi: "TÜRK LİRASI", miktar: hedef, kur: 1, tutar: hedef };
    // MASAK sınırı: aşılınca isim, TC / VKN, adres, kişilik tipi zorunlu; listede çıkan müşteri kesilmez
    const m = k.musteri;
    const asildi = masakSiniriAsildi({
      tanim: veri.tanim, paralar: veri.tumUrunler, kurlar: veri.kurlar, urunler: veri.tumUrunler, tip, hasKuruYedek: altinHasKuru, toplamTutar: hedef,
      kalemler: [{ paraId: urun.paraId, kod: (urun.kod || "").toUpperCase().trim(), ad: urun.ad || "", urunTipi, miktar: sayiOku(satir.miktar), kur: sayiOku(satir.kur), tutar: sayiOku(satir.tutar), hasGram: sayiOku(satir.hasGram) }],
      odemeler: [{ paraId: odeme.paraId, kod: odeme.paraKodu.toUpperCase(), ad: odeme.paraAdi, miktar: odeme.miktar, kur: odeme.kur, tutar: odeme.tutar, hasGram: 0 }],
    });
    if (asildi) {
      const eksik = masakEksikleri({ unvan: m.unvan, vkn: m.vkn, adres: m.adres, kisilikTipi: m.kisilikTipi });
      if (eksik.length) return { tamam: false as const, neden: `MASAK bildirim sınırı aşılıyor; eksik: ${eksik.join(", ")} (tekli kesip Müşteri Tanı Formu'nu doldurun)` };
    }
    if ((k.masakEslesme || 0) > 0 && ((masakKontroluVar && !gayriResmi) || asildi)) return { tamam: false as const, neden: "Müşteri MASAK listesinde bulundu; fiş kesilemez" };
    return {
      tamam: true as const, tip, hedef, satir, odeme, istatistik, kdvKapali, altinHasKuru, musteri: m, belgeTuru: k.belgeTuru || 0,
      gumusHasKuru: gumusKuru(veri.kurlar, tip),
    };
  };

  const degerler = useMemo(
    () => new Map((satirlar || []).map((s) => [s.vomsisId, degerlendir(s)])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [satirlar, veri, onKontrol, urunId, kdvYazi, iscilik]
  );
  const kesilecekler = (satirlar || []).filter((s) => degerler.get(s.vomsisId)?.tamam && !sonuc[s.vomsisId]);
  const bekleyen = (satirlar || []).filter((s) => (degerler.get(s.vomsisId) as any)?.bekliyor).length;

  const baslat = async () => {
    if (!veri?.vezne || !kesilecekler.length) return;
    if (!window.confirm(`${kesilecekler.length} Sarraf fişi kesilip banka hareketleriyle eşlenecek (${urun?.ad}, İşçilik KDV %${kdvOrani}). Devam edilsin mi?`)) return;
    setCalisiyor(true);
    for (const s of kesilecekler) {
      const d = degerler.get(s.vomsisId);
      if (!d || !d.tamam) continue;
      setSonuc((o) => ({ ...o, [s.vomsisId]: { durum: "kesiliyor", mesaj: "" } }));
      try {
        const kdvDegeri = d.kdvKapali ? null : sayiOku(d.satir.iscilikKdvOrani) || null;
        const payload = kayitVerisi({
          vezneId: veri.vezne.id, tip: d.tip, satir: d.satir, musteri: d.musteri, istatistik: d.istatistik, altinHasKuru: d.altinHasKuru,
          gumusHasKuru: d.gumusHasKuru, kdvOrani: kdvDegeri,
          // Satışta KDV kodu 805 (gümüş satırı faturada 808'e döner), alışta yazılmaz (ekrandaki gibi)
          istisnaKodu: d.tip === 1 ? ALTIN_KODU : null,
          belgeTuru: d.belgeTuru, kullaniciId: Number(user?.id) || 1, odeme: d.odeme, simdi: new Date(),
        });
        const kayit = await SarrafFisService.saveFis(payload as any);
        setDegisti(true);
        try {
          await EBankaService.mutabakatEsle(s.vomsisId, "sarraf", Number(kayit.sarrafFisiId));
          setSonuc((o) => ({ ...o, [s.vomsisId]: { durum: "kesildi", mesaj: kayit.fisNo || `#${kayit.sarrafFisiId}` } }));
        } catch (e: any) {
          setSonuc((o) => ({ ...o, [s.vomsisId]: { durum: "eslenemedi", mesaj: `${kayit.fisNo || `#${kayit.sarrafFisiId}`} kesildi ama eşlenemedi: ${e?.message || ""}` } }));
        }
      } catch (e: any) {
        setSonuc((o) => ({ ...o, [s.vomsisId]: { durum: "hata", mesaj: e?.message || "Fiş kaydedilemedi." } }));
      }
    }
    setCalisiyor(false);
  };

  const kapat = () => {
    if (calisiyor) return;
    tur.current++;
    onKapat(degisti);
  };

  const hepsineYaz = () => setIscilik(Object.fromEntries((satirlar || []).map((s) => [s.vomsisId, hepsine])));

  const rozet = (s: MutabakatSatiri) => {
    const r = sonuc[s.vomsisId];
    if (r) {
      const g = { kesiliyor: ["primary", "Kesiliyor"], kesildi: ["success", "Kesildi"], eslenemedi: ["warning", "Eşlenemedi"], hata: ["danger", "Hata"] }[r.durum];
      return (
        <>
          <Badge bg={g[0]} text={r.durum === "eslenemedi" ? "dark" : undefined}>{r.durum === "kesiliyor" && <Spinner size="sm" className="me-1" style={{ width: 10, height: 10 }} />}{g[1]}</Badge>
          {r.mesaj && <div className="mt-1">{r.mesaj}</div>}
        </>
      );
    }
    const d = degerler.get(s.vomsisId);
    if (!d) return null;
    if (d.tamam) {
      return (
        <>
          <Badge bg="info" text="dark">Kesilecek</Badge>
          <div className="text-muted mt-1">
            {sayiOku(d.satir.miktar).toLocaleString("tr-TR", { maximumFractionDigits: 3 })} gr
            {sayiOku(d.satir.iscilikToplam) > 0 && <> · işçilik {paraYaz(sayiOku(d.satir.iscilikToplam))} (KDV {paraYaz(sayiOku(d.satir.iscilikKdvTutari))})</>}
            {d.belgeTuru === 1 && <> · e-Fatura</>}
          </div>
        </>
      );
    }
    return (
      <>
        <Badge bg={(d as any).bekliyor ? "light" : "secondary"} text={(d as any).bekliyor ? "dark" : undefined}>{(d as any).bekliyor ? "Kontrol" : "Atlanacak"}</Badge>
        <div className="mt-1">{d.neden}</div>
      </>
    );
  };

  return (
    <Modal show={!!satirlar} onHide={kapat} size="xl" centered backdrop={calisiyor ? "static" : true}>
      <Modal.Header closeButton={!calisiyor} className="py-2">
        <Modal.Title className="fs-6 fw-bold">Toplu fiş kesme — {satirlar?.length ?? 0} hareket</Modal.Title>
      </Modal.Header>
      <Modal.Body className="small">
        {hata && <Alert variant="danger" className="py-2">{hata}</Alert>}
        {!veri && !hata && <div className="text-muted py-3"><Spinner size="sm" className="me-2" />Tanımlar yükleniyor…</div>}
        {veri && (
          <>
            <Row className="g-2 align-items-end mb-2">
              <Col md={4}>
                <Form.Label className="fw-bold text-secondary mb-1">Ürün</Form.Label>
                <Form.Select size="sm" value={urunId ?? ""} disabled={calisiyor} onChange={(e) => setUrunId(e.target.value ? Number(e.target.value) : null)}>
                  {veri.urunler.map((u) => <option key={u.paraId} value={u.paraId}>{u.kod} — {u.ad}</option>)}
                </Form.Select>
              </Col>
              <Col md={2}>
                <Form.Label className="fw-bold text-secondary mb-1">İşçilik KDV %</Form.Label>
                <Form.Control size="sm" className="text-end" value={kdvYazi} disabled={calisiyor} onChange={(e) => setKdvYazi(e.target.value.replace(/[^\d.,]/g, ""))} />
              </Col>
              <Col md={4}>
                <Form.Label className="fw-bold text-secondary mb-1">Hepsine aynı işçilik (TL, KDV dahil)</Form.Label>
                <div className="d-flex gap-2">
                  <Form.Control size="sm" className="text-end" placeholder="boş = işçiliksiz" value={hepsine} disabled={calisiyor} onChange={(e) => setHepsine(e.target.value.replace(/[^\d.,]/g, ""))} />
                  <Button size="sm" variant="outline-primary" className="text-nowrap" disabled={calisiyor} onClick={hepsineYaz}>Hepsine yaz</Button>
                </div>
              </Col>
              <Col md={2} className="text-muted">
                Vezne: {veri.vezne ? `${veri.vezne.kod} ${veri.vezne.ad}` : "yok"}
              </Col>
            </Row>
            <div className="text-muted mb-2">
              Fiş tarihi bugün; kur Anlık Fiyat Listesi'nden; toplam banka tutarına sabit, işçilik (KDV dahil) altından düşülür. Cari yoksa bankanın verdiği ad ve VKN ile.
              İstatistik ekrandaki varsayılan (cari kartında tanımlıysa o).
            </div>
            <Table size="sm" className="align-middle mb-2">
              <thead className="table-light">
                <tr>
                  <th>Tarih</th>
                  <th>Karşı taraf / Cari</th>
                  <th>İşlem</th>
                  <th className="text-end">Tutar (TL)</th>
                  <th style={{ width: 120 }}>İşçilik</th>
                  <th>Durum</th>
                </tr>
              </thead>
              <tbody>
                {(satirlar || []).map((s) => {
                  const d = degerler.get(s.vomsisId);
                  const m = onKontrol[s.vomsisId]?.musteri;
                  const tlHesap = ["TL", "TRY", ""].includes((s.doviz || "TL").toUpperCase());
                  return (
                    <tr key={s.vomsisId}>
                      <td className="font-monospace text-nowrap">{zamanYaz(s.tarih)}</td>
                      <td>
                        {s.cari?.ad || m?.unvan || s.karsiTaraf || "-"}
                        {!s.cari && <div className="text-muted">bankanın adıyla{m?.vkn ? ` · ${m.vkn}` : ""}</div>}
                      </td>
                      <td>{s.yon === "gelen" ? "Satış" : "Alış"}</td>
                      <td className={`text-end font-monospace fw-bold ${s.yon === "giden" ? "text-danger" : "text-success"}`}>
                        {paraYaz(tlHesap ? s.tutar : s.tlKarsilik)}
                        {!tlHesap && <div className="text-muted fw-normal">{paraYaz(s.tutar)} {s.doviz}</div>}
                      </td>
                      <td>
                        <Form.Control size="sm" className="text-end py-0" placeholder="—" value={iscilik[s.vomsisId] || ""} disabled={calisiyor || !!sonuc[s.vomsisId]}
                          onChange={(e) => setIscilik((o) => ({ ...o, [s.vomsisId]: e.target.value.replace(/[^\d.,]/g, "") }))} />
                      </td>
                      <td>
                        {rozet(s)}
                        {d && !d.tamam && !(d as any).bekliyor && !sonuc[s.vomsisId] && (
                          <Button size="sm" variant="link" className="p-0 mt-1" disabled={calisiyor} onClick={() => { kapat(); onTekliKes(s); }}>
                            <IconReceipt size={13} className="me-1" />Tekli kes
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
            {atlananlar.length > 0 && (
              <Alert variant="light" className="border py-2 mb-0">
                <div className="fw-bold mb-1">Listeye alınmayan {atlananlar.length} hareket</div>
                {atlananlar.slice(0, 20).map((a, i) => <div key={i}>{a.ad}: <span className="text-muted">{a.neden}</span></div>)}
                {atlananlar.length > 20 && <div className="text-muted">… ve {atlananlar.length - 20} hareket daha</div>}
              </Alert>
            )}
          </>
        )}
      </Modal.Body>
      <Modal.Footer className="py-2">
        <span className="small text-muted me-auto">
          {bekleyen ? `${bekleyen} hareket kontrol ediliyor… · ` : ""}
          {kesilecekler.length} kesilecek · {Object.values(sonuc).filter((r) => r.durum === "kesildi").length} kesildi
        </span>
        <Button size="sm" variant="outline-secondary" disabled={calisiyor} onClick={kapat}>Kapat</Button>
        <Button size="sm" variant="primary" disabled={calisiyor || !kesilecekler.length || bekleyen > 0} onClick={baslat}>
          {calisiyor ? <Spinner size="sm" className="me-1" /> : <IconPlayerPlay size={14} className="me-1" />}
          Başlat{kesilecekler.length ? ` (${kesilecekler.length})` : ""}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default EBankaTopluFisKes;
