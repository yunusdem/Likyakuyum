import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Button, Card, Col, Form, Modal, Row, Spinner, Table } from "react-bootstrap";
import { useParams } from "react-router-dom";
import { IconAdjustments, IconChevronUp, IconDownload, IconFileSpreadsheet, IconFileTypePdf, IconPrinter, IconReportAnalytics, IconRefresh, IconSearch, IconX } from "@tabler/icons-react";
import { CashDeskService, type VezneItem } from "../../services/cashDeskService";
import { ProductDefinitionService, type ProductItem } from "../../services/productDefinitionService";
import { CariService, type CariKartItem } from "../../services/cariService";
import {
  RAPOR_MENU, RaporService, raporBicimle, raporSayisalMi,
  type RaporParametre, type RaporParametreDegerleri, type RaporSecimKaydi, type RaporSecimKaynagi, type RaporTanim, type RaporVeri,
} from "../../services/raporService";
import { DurbunAlan, type SecimKolon } from "./RaporSecim";

/**
 * Tek rapor sayfası (G- Raporlar altındaki 9 rapor): /raporlar/:yol
 * Akış (yönetici kararı 12.09.2026): sayfa açılınca yalnızca PARAMETRE ekranı gelir; kullanıcı seçer, "Uygula" der;
 * sonra grid ve A4 PDF önizleme birlikte gelir. Otomatik listeleme yok.
 * 14.09.2026: cari / vezne / para seçimleri dürbünle (RaporSecim.tsx); her Uygula sunucuda "kayıtlı arama" olarak saklanır
 * (kullanıcı × rapor, son 10), şeritten tıklanarak yüklenir ve silinebilir. Tarih varsayılanı bugün → bugün.
 * Bkz. docs/raporlar.md ve docs/belge-rapor-revizyon.md.
 */

const gun = (kaydir = 0) => { const d = new Date(); d.setDate(d.getDate() + kaydir);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit" }).format(d); };
const varsayilanDeger = (v?: string | number | null): string => {
  if (v === "bugun") return gun(0);
  if (typeof v === "string" && /^-\d+g$/.test(v)) return gun(-Number(v.slice(1, -1)));
  return v === null || v === undefined ? "" : String(v);
};
/** Parametre kontrollerinin genişliği (px) — kompakt düzen */
const GENISLIK = { tarih: 135, saat: 95, durbun: 220, metin: 190, sayi: 110, fisTipi: 110, kmt: 160 };
/** Alt alta parametre satırlarında etiket sütunu (kutular aynı hizadan başlar) */
const ETIKET_GENISLIGI = 95;
const HAREKET_TIPLERI: { kod: string; ad: string }[] = [
  { kod: "0", ad: "Nakit" }, { kod: "1", ad: "Banka / Havale" }, { kod: "2", ad: "POS / Kredi Kartı" }, { kod: "3", ad: "Dekont" }, { kod: "4", ad: "Virman" }, { kod: "5", ad: "Devir" },
];

/** Tarih aralığı anahtarları: ad "baslangic" → baslangic/bitis (ana aralık); başka ad (ör. "vade") → vadeBaslangic/vadeBitis (ikinci aralık) */
const aralikAnahtarlari = (p: RaporParametre): [string, string] => p.ad === "baslangic" ? ["baslangic", "bitis"] : [`${p.ad}Baslangic`, `${p.ad}Bitis`];
const KAYNAK_ADI: Record<RaporSecimKaynagi, string> = { hesap: "hesap", istatistik: "istatistik", meslek: "meslek", sektor: "sektör", kullanici: "personel", banka: "banka hesabı" };
const secimKolonlar: SecimKolon<RaporSecimKaydi>[] = [
  { baslik: "Kod", genislik: "140px", deger: k => <span className="font-monospace fw-bold">{k.kod}</span> },
  { baslik: "Ad / açıklama", deger: k => k.ad },
];
const secimArama = (k: RaporSecimKaydi) => [k.kod, k.ad];

/** Tanımdaki parametrelerden başlangıç değerleri (tarihAralik → baslangic+bitis, saatAralik → baslangicSaat+bitisSaat, kurSecimi → kurTuru+kurTarihi+kurAlani) */
function baslangicDegerleri(parametreler: RaporParametre[]): RaporParametreDegerleri {
  const d: RaporParametreDegerleri = {};
  for (const p of parametreler) {
    switch (p.tip) {
      case "tarihAralik": { const [b, s] = aralikAnahtarlari(p);
        // varsayilan "" → aralık boş başlar (isteğe bağlı ikinci aralık: vade)
        d[b] = p.varsayilan === "" ? "" : varsayilanDeger(p.varsayilan ?? "bugun"); d[s] = p.varsayilan === "" ? "" : gun(0); break; }
      case "listeCoklu": d[p.ad] = ""; break;
      case "secim": d[p.ad] = varsayilanDeger(p.varsayilan ?? p.secenekler?.[0]?.deger ?? ""); break;
      case "saatAralik": d.baslangicSaat = "00:00"; d.bitisSaat = "23:59"; break;
      case "kurSecimi": d.kurTuru = 0; d.kurTarihi = gun(0); d.kurAlani = "alis"; break;
      case "cariAralik": d.cariBaslangic = ""; d.cariBitis = ""; break;
      case "vezneAralik": d.vezneBaslangic = ""; d.vezneBitis = ""; break;
      case "paraCoklu": d.paraIdler = ""; break;
      case "cariCoklu": d.cariIdler = ""; d.cariSonId = ""; break;
      case "vezneCoklu": d.vezneIdler = ""; break;
      case "tarih": d[p.ad] = varsayilanDeger(p.varsayilan ?? "bugun"); break;
      default: d[p.ad] = varsayilanDeger(p.varsayilan);
    }
  }
  return d;
}

const cariKolonlar: SecimKolon<CariKartItem>[] = [
  { baslik: "Kod", genislik: "120px", deger: c => <span className="font-monospace fw-bold">{c.kod}</span> },
  { baslik: "Ünvan / Ad", deger: c => c.ad },
  { baslik: "Telefon", genislik: "130px", deger: c => c.telefon || "-" },
  { baslik: "VKN / TCKN", genislik: "120px", deger: c => c.vergiKimlikNo || "-" },
];
const cariArama = (c: CariKartItem) => [c.kod, c.ad, c.telefon, c.vergiKimlikNo, c.yetkiliKisi];
const vezneKolonlar: SecimKolon<VezneItem>[] = [
  { baslik: "Kod", genislik: "120px", deger: v => <span className="font-monospace fw-bold">{v.kod}</span> },
  { baslik: "Vezne adı", deger: v => v.ad },
];
const vezneArama = (v: VezneItem) => [v.kod, v.ad];
const paraKolonlar: SecimKolon<ProductItem>[] = [
  { baslik: "Kod", genislik: "120px", deger: p => <span className="font-monospace fw-bold">{p.kod}</span> },
  { baslik: "Para / kıymet adı", deger: p => p.ad },
  { baslik: "Has oranı", genislik: "100px", hiza: "right", deger: p => p.hasOrani ? String(p.hasOrani) : "-" },
];
const paraArama = (p: ProductItem) => [p.kod, p.ad, p.bagliParaKodu];

export const RaporPage: React.FC = () => {
  const { yol } = useParams<{ yol: string }>();
  const menu = useMemo(() => RAPOR_MENU.find(m => m.yol === yol), [yol]);
  const kod = menu?.kod;

  const [tanim, setTanim] = useState<RaporTanim | null>(null);
  const [degerler, setDegerler] = useState<RaporParametreDegerleri>({});
  const [veri, setVeri] = useState<RaporVeri | null>(null);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [dosyaIsi, setDosyaIsi] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [vezneler, setVezneler] = useState<VezneItem[]>([]);
  const [paralar, setParalar] = useState<ProductItem[]>([]);
  const [cariler, setCariler] = useState<CariKartItem[]>([]);
  /** listeCoklu parametrelerinin dürbün listeleri (kaynak → kayıtlar); rapor API'sinden gelir */
  const [listeler, setListeler] = useState<Partial<Record<RaporSecimKaynagi, RaporSecimKaydi[]>>>({});
  const [listeYukleniyor, setListeYukleniyor] = useState(false);
  /** Uygula'dan sonra parametre alanı arkada (kapalı) kalır, rapor tam genişlikte gelir (yönetici isteği 14.09.2026) */
  const [parametreAcik, setParametreAcik] = useState(true);
  const istekNo = useRef(0);

  useEffect(() => () => { if (pdfUrl) URL.revokeObjectURL(pdfUrl); }, [pdfUrl]);

  // Tanım + dürbün listeleri
  useEffect(() => {
    if (!kod) return;
    setTanim(null); setVeri(null); setPdfUrl(null); setHata(null);
    RaporService.tanim(kod).then(t => {
      setTanim(t); setDegerler(baslangicDegerleri(t.parametreler));
      const tipler = new Set(t.parametreler.map(p => p.tip));
      setListeYukleniyor(true);
      const isler: Promise<unknown>[] = [];
      if (tipler.has("vezne") || tipler.has("vezneAralik") || tipler.has("vezneCoklu")) isler.push(CashDeskService.getVezneler().then(v => setVezneler([...v].sort((a, b) => a.kod.localeCompare(b.kod)))).catch(() => setVezneler([])));
      if (tipler.has("para") || tipler.has("paraCoklu")) isler.push(ProductDefinitionService.getProducts().then(p => setParalar([...p].sort((a, b) => (a.siraNo ?? 99) - (b.siraNo ?? 99) || a.kod.localeCompare(b.kod)))).catch(() => setParalar([])));
      if (tipler.has("cari") || tipler.has("cariAralik") || tipler.has("cariCoklu")) isler.push(CariService.getCariKartlar().then(c => setCariler([...c].sort((a, b) => a.kod.localeCompare(b.kod)))).catch(() => setCariler([])));
      for (const kaynak of new Set(t.parametreler.filter(p => p.tip === "listeCoklu" && p.kaynak).map(p => p.kaynak!)))
        isler.push(RaporService.secimListesi(kaynak).then(l => setListeler(o => ({ ...o, [kaynak]: l }))).catch(() => setListeler(o => ({ ...o, [kaynak]: [] }))));
      Promise.all(isler).finally(() => setListeYukleniyor(false));
    }).catch(e => setHata(e?.message || "Rapor tanımı alınamadı."));
  }, [kod]);

  const zorunluEksik = useMemo(() => {
    if (!tanim) return null;
    for (const p of tanim.parametreler) {
      if (!p.zorunlu) continue;
      if (p.tip === "tarihAralik") { const [b, s] = aralikAnahtarlari(p); if (!degerler[b] || !degerler[s]) return `${p.ad === "baslangic" ? "Tarih aralığı" : p.etiket} zorunludur.`; continue; }
      if (p.tip === "cariAralik" && !degerler.cariBaslangic && !degerler.cariBitis) return "Cari aralığı için başlangıç veya bitiş cari seçin.";
      if (p.tip === "vezneAralik" && !degerler.vezneBaslangic && !degerler.vezneBitis) return "Vezne aralığı için başlangıç veya bitiş vezne seçin.";
      if (p.tip === "paraCoklu" && !degerler.paraIdler) return "En az bir para seçin.";
      if (p.tip === "cariCoklu" && !degerler.cariIdler && !degerler.cariSonId) return "En az bir cari seçin.";
      if (p.tip === "vezneCoklu" && !degerler.vezneIdler) return "En az bir vezne seçin.";
      if (!["saatAralik", "kurSecimi", "cariAralik", "vezneAralik", "paraCoklu", "cariCoklu", "vezneCoklu"].includes(p.tip) && !degerler[p.ad]) return `${p.etiket} zorunludur.`;
    }
    for (const p of tanim.parametreler) if (p.tip === "tarihAralik") { const [b, s] = aralikAnahtarlari(p);
      if (degerler[b] && degerler[s] && String(degerler[b]) > String(degerler[s])) return "Başlangıç tarihi bitişten sonra olamaz.";
      if (!p.zorunlu && (!!degerler[b]) !== (!!degerler[s])) return `${p.etiket}: ilk ve son tarih birlikte girilmelidir.`; }
    if (degerler.cariBaslangic && degerler.cariBitis && String(degerler.cariBaslangic) > String(degerler.cariBitis)) return "Başlangıç cari kodu bitişten büyük olamaz.";
    if (degerler.vezneBaslangic && degerler.vezneBitis && String(degerler.vezneBaslangic) > String(degerler.vezneBitis)) return "Başlangıç vezne kodu bitişten büyük olamaz.";
    return null;
  }, [tanim, degerler]);

  // Otomatik listeleme YOK: önce parametre ekranı, kullanıcı "Uygula" der (yönetici kararı).
  const pdfOnizle = async () => {
    if (!kod) return; if (zorunluEksik) { setHata(zorunluEksik); return; }
    setDosyaIsi(true); setHata(null);
    try { const url = await RaporService.pdfBlobUrl(kod, degerler); setPdfUrl(o => { if (o) URL.revokeObjectURL(o); return url; }); }
    catch (e: any) { setHata(e?.message || "PDF üretilemedi."); }
    finally { setDosyaIsi(false); }
  };
  /** Uygula: parametrelerle veriyi çeker, aramayı sunucuya kaydeder ve (sınır aşılmadıysa) PDF önizlemeyi birlikte açar. */
  const uygula = useCallback(async (secilen?: RaporParametreDegerleri) => {
    if (!kod || !tanim) return;
    const d = secilen || degerler;
    if (!secilen && zorunluEksik) { setHata(zorunluEksik); return; }
    const id = ++istekNo.current;
    setYukleniyor(true); setHata(null);
    try {
      const v = await RaporService.veri(kod, d);
      if (id !== istekNo.current) return;
      setVeri(v); setParametreAcik(false);
      setPdfUrl(null);
      if (v.sinirAsildi) { setHata(`Rapor ${v.toplamKayit.toLocaleString("tr-TR")} satır üretiyor; üst sınır ${(v.tanim.ustSinir || 5000).toLocaleString("tr-TR")}. Parametreleri daraltın.`); return; }
      // PDF otomatik açılmaz; kullanıcı "PDF" düğmesiyle pop-up olarak görür (yönetici kararı 14.09.2026)
    } catch (e: any) { if (id === istekNo.current) { setVeri(null); setHata(e?.message || "Rapor oluşturulamadı."); } }
    finally { if (id === istekNo.current) setYukleniyor(false); }
  }, [kod, tanim, degerler, zorunluEksik]);
  const pdfIndir = async () => { if (!kod) return; setDosyaIsi(true); setHata(null);
    try { await RaporService.pdfIndir(kod, degerler, kod); } catch (e: any) { setHata(e?.message || "PDF indirilemedi."); } finally { setDosyaIsi(false); } };
  const excelIndir = async () => { if (!kod) return; setDosyaIsi(true); setHata(null);
    try { await RaporService.excelIndir(kod, degerler, kod); } catch (e: any) { setHata(e?.message || "Excel indirilemedi."); } finally { setDosyaIsi(false); } };
  const yazdir = async () => {
    if (!kod) return; setDosyaIsi(true); setHata(null);
    try {
      const url = await RaporService.pdfBlobUrl(kod, degerler);
      const f = document.createElement("iframe");
      f.style.position = "fixed"; f.style.right = "0"; f.style.bottom = "0"; f.style.width = "0"; f.style.height = "0"; f.style.border = "0";
      f.src = url;
      f.onload = () => { try { f.contentWindow?.focus(); f.contentWindow?.print(); } catch { window.open(url, "_blank", "noopener"); } setTimeout(() => { URL.revokeObjectURL(url); f.remove(); }, 60000); };
      document.body.appendChild(f);
    } catch (e: any) { setHata(e?.message || "Yazdırma çıktısı alınamadı."); }
    finally { setDosyaIsi(false); }
  };
  const temizle = () => { if (tanim) { setDegerler(baslangicDegerleri(tanim.parametreler)); setVeri(null); setPdfUrl(null); setHata(null); setParametreAcik(true); } };
  const set = (ad: string, v: string | number) => setDegerler(o => ({ ...o, [ad]: v }));

  const etiketOlustur = (p: RaporParametre) => <Form.Label className="small fw-semibold text-secondary mb-1">{p.etiket}{p.zorunlu && <span className="text-danger"> *</span>}</Form.Label>;
  const altEtiket = (m: string) => <Form.Label className="small fw-semibold text-secondary mb-1">{m}</Form.Label>;
  const paraAd = (id: string | number | undefined) => { const x = paralar.find(v => String(v.id) === String(id ?? "")); return x ? `${x.kod} — ${x.ad}` : id ? String(id) : ""; };
  const vezneAd = (id: string | number | undefined) => { const x = vezneler.find(v => String(v.id) === String(id ?? "")); return x ? `${x.kod} — ${x.ad}` : id ? String(id) : ""; };
  const cariAd = (id: string | number | undefined) => { const x = cariler.find(v => String(v.id) === String(id ?? "")); return x ? `${x.kod} — ${x.ad}` : id ? String(id) : ""; };
  const meslek = yukleniyor || dosyaIsi;

  /**
   * Kompakt parametre listesi (kullanıcı isteği 01.10.2026): her parametre bir satır, alt alta; yalnızca başı / sonu olanlar (ilk–son tarih, saat, cari)
   * aynı satırda yan yana. Etiketler aynı genişlikte (kutular hizalı), kutular türüne göre kısa. Metin notlar ipucunda (title);
   * işlem içeren not (Tümü / Temizle) kutunun yanında.
   */
  const ipucu = (not?: React.ReactNode) => (typeof not === "string" ? not : undefined);
  const ekNot = (not?: React.ReactNode) => (not && typeof not !== "string" ? <span className="small text-muted text-nowrap">{not}</span> : null);
  // Etiket uzunsa (ör. "Hareket tipi (seçilmezse tümü)") iki satıra kırılır; kutu dar ekranda küçülür (taşma olmaz)
  const etiketYazi = (e: React.ReactNode, hizali = true) => <span className="small fw-semibold text-secondary" style={{ minWidth: hizali ? ETIKET_GENISLIGI : undefined, maxWidth: 170, flexShrink: 0 }}>{e}</span>;
  const kutu = (w: number | "auto", icerik: React.ReactNode, title?: string) => <div style={{ width: w, minWidth: 0, flexShrink: 1 }} title={title}>{icerik}</div>;
  const satir = (key: string, etiket: React.ReactNode, kontrol: React.ReactNode, not?: React.ReactNode, w: number | "auto" = GENISLIK.durbun) => (
    <div key={key} className="d-flex align-items-center gap-2" style={{ maxWidth: "100%" }} title={ipucu(not)}>
      {etiketYazi(etiket)}{kutu(w, kontrol)}{ekNot(not)}
    </div>
  );
  /** Başı / sonu olan çift (ilk / son tarih, saat, cari): aynı satırda yan yana; ikinci etiket hizalanmaz, ilk kutunun hemen ardından gelir */
  const ciftSatir = (key: string, sol: [React.ReactNode, React.ReactNode, React.ReactNode?], sag: [React.ReactNode, React.ReactNode, React.ReactNode?], w: number = GENISLIK.durbun) => (
    <div key={key} className="d-flex align-items-center flex-wrap" style={{ gap: "6px 14px", maxWidth: "100%" }}>
      <div className="d-flex align-items-center gap-2" style={{ maxWidth: "100%" }}>{etiketYazi(sol[0])}{kutu(w, sol[1], ipucu(sol[2]))}{ekNot(sol[2])}</div>
      <div className="d-flex align-items-center gap-2" style={{ maxWidth: "100%" }}>{etiketYazi(sag[0], false)}{kutu(w, sag[1], ipucu(sag[2]))}{ekNot(sag[2])}</div>
    </div>
  );
  /** Seçim kutusu genişliği: en uzun seçeneğe göre (120–260 px) */
  const secimGenisligi = (secenekler?: { ad: string }[]) => Math.min(260, Math.max(120, Math.max(0, ...(secenekler || []).map(o => o.ad.length)) * 7.5 + 40));
  const zorunluIsareti = (p: RaporParametre) => p.zorunlu ? <span className="text-danger"> *</span> : null;
  const tarihKutu = (ad: string) => <Form.Control size="sm" type="date" value={String(degerler[ad] ?? "")} onChange={e => set(ad, e.target.value)} />;
  const saatKutu = (ad: string, vars: string) => <Form.Control size="sm" type="time" value={String(degerler[ad] ?? vars)} onChange={e => set(ad, e.target.value)} />;
  const secimler = (ad: string) => String(degerler[ad] ?? "").split(",").filter(Boolean);

  /** İlk kod (çoklu dürbün) + Son kod (tek dürbün): yalnızca ilk seçiliyse seçilenler; son da seçiliyse ilk→son kod aralığı */
  /** Çoklu seçim satırı (vezne, para): dürbünden istenen kayıtlar işaretlenir; boş = tümü */
  const coklu = <T extends { id: number; kod: string }>(p: RaporParametre, tur: string, ad: string, items: T[], kolonlar: SecimKolon<T>[], arama: (x: T) => (string | number | null | undefined)[], yerTutucu: string) => {
    const secili = secimler(ad);
    const kodu = (id: string | number | undefined) => items.find(v => String(v.id) === String(id ?? ""))?.kod || (id ? String(id) : "");
    return satir(ad, <>{tur[0].toLocaleUpperCase("tr-TR") + tur.slice(1)}{zorunluIsareti(p)}</>,
      <DurbunAlan<T> value={secili.map(kodu).join(", ")} saltOkunur onChange={() => undefined} placeholder={p.zorunlu ? `${tur[0].toLocaleUpperCase("tr-TR") + tur.slice(1)} seçin…` : `Tüm ${tur}ler`} title={`${tur[0].toLocaleUpperCase("tr-TR") + tur.slice(1)} seçimi — birden fazla seçilebilir`} items={items} yukleniyor={listeYukleniyor}
        kolonlar={kolonlar} aramaAlanlari={arama} anahtar={v => String(v.id)} aramaYerTutucu={yerTutucu} disabled={meslek} coklu secili={secili} onSelect={() => undefined}
        onCokluSec={sec => set(ad, sec.map(x => String(x.id)).join(","))} />,
      secili.length ? <>{secili.length} seçili · <Button variant="link" size="sm" className="p-0 small align-baseline" onClick={() => set(ad, "")}>Tümü</Button></>
        : p.zorunlu ? `En az bir ${tur} seçin` : `Hiçbiri seçilmezse tüm ${tur}ler`);
  };
  /** Cari: İlk kod (çoklu) + Son kod (tek). Son boşsa yalnızca seçilenler; son seçiliyse ilk seçimin en küçük kodundan son koda aralık; yalnız son seçiliyse baştan son koda kadar */
  const ilkSon = <T extends { id: number; kod: string }>(p: RaporParametre, tur: string, ilkAd: string, sonAd: string, items: T[], kolonlar: SecimKolon<T>[], arama: (x: T) => (string | number | null | undefined)[], yerTutucu: string) => {
    const secili = secimler(ilkAd);
    const kodu = (id: string | number | undefined) => items.find(v => String(v.id) === String(id ?? ""))?.kod || (id ? String(id) : "");
    const son = degerler[sonAd];
    const ilkKod = secili.map(kodu).filter(Boolean).sort()[0] || "";
    const aciklama = son
      ? `${ilkKod || "(baştan)"} → ${kodu(son)} aralığı`
      : secili.length ? `${secili.length} seçili` : p.zorunlu ? `En az bir ${tur} seçin` : `Hiçbiri seçilmezse tüm ${tur}ler`;
    return ciftSatir(`${ilkAd}-${sonAd}`,
      [<>İlk {tur}{zorunluIsareti(p)}</>,
        <DurbunAlan<T> value={secili.map(kodu).join(", ")} saltOkunur onChange={() => undefined} placeholder={p.zorunlu ? `${tur[0].toLocaleUpperCase("tr-TR") + tur.slice(1)} seçin…` : `Tüm ${tur}ler`} title={`İlk ${tur} kodu — birden fazla seçilebilir`} items={items} yukleniyor={listeYukleniyor}
          kolonlar={kolonlar} aramaAlanlari={arama} anahtar={v => String(v.id)} aramaYerTutucu={yerTutucu} disabled={meslek} coklu secili={secili} onSelect={() => undefined}
          onCokluSec={sec => set(ilkAd, sec.map(x => String(x.id)).join(","))} />,
        (secili.length || son) ? <>{aciklama} · <Button variant="link" size="sm" className="p-0 small align-baseline" onClick={() => { set(ilkAd, ""); set(sonAd, ""); }}>Temizle</Button></> : aciklama],
      [<>Son {tur}</>,
        <DurbunAlan<T> value={kodu(son)} saltOkunur onChange={() => undefined} placeholder="İsteğe bağlı" title={`Son ${tur} kodu`} items={items} yukleniyor={listeYukleniyor}
          kolonlar={kolonlar} aramaAlanlari={arama} anahtar={v => String(v.id)} aramaYerTutucu={yerTutucu} disabled={meslek} onSelect={v => set(sonAd, v.id)} />,
        son ? <Button variant="link" size="sm" className="p-0 small align-baseline" onClick={() => set(sonAd, "")}>Kaldır</Button> : "Seçilirse ilk koddan bu koda kadar aralık gelir"]);
  };

  const alan = (p: RaporParametre): React.ReactNode => {
    const etiket = <>{p.etiket}{zorunluIsareti(p)}</>;
    switch (p.tip) {
      case "tarih": return satir(p.ad, etiket, tarihKutu(p.ad), p.not, GENISLIK.tarih);
      case "tarihAralik": { const [b, s] = aralikAnahtarlari(p); const ana = p.ad === "baslangic" && p.etiket === "Tarih aralığı";
        return ciftSatir(`tarihAralik-${p.ad}`, [<>{ana ? "İlk tarih" : `${p.etiket} — ilk`}{zorunluIsareti(p)}</>, tarihKutu(b), p.not], [ana ? "Son tarih" : `${p.etiket} — son`, tarihKutu(s)], GENISLIK.tarih); }
      case "secim": return satir(p.ad, etiket, <Form.Select size="sm" value={String(degerler[p.ad] ?? "")} onChange={e => set(p.ad, e.target.value)}>
        {(p.secenekler || []).map(o => <option key={o.deger} value={o.deger}>{o.ad}</option>)}</Form.Select>, p.not, secimGenisligi(p.secenekler));
      case "sayi": return satir(p.ad, etiket, <Form.Control size="sm" type="number" min={0} step="any" inputMode="decimal" value={String(degerler[p.ad] ?? "")} onChange={e => set(p.ad, e.target.value)} />, p.not, GENISLIK.sayi);
      case "listeCoklu": return p.kaynak
        ? coklu<RaporSecimKaydi>(p, KAYNAK_ADI[p.kaynak], p.ad, listeler[p.kaynak] || [], secimKolonlar, secimArama, "Kod veya adla arayın…")
        : null;
      case "saatAralik": return ciftSatir("saatAralik", ["İlk saat", saatKutu("baslangicSaat", "00:00")], ["Son saat", saatKutu("bitisSaat", "23:59")], GENISLIK.saat);
      case "vezne": return satir(p.ad, etiket, <DurbunAlan<VezneItem> value={vezneAd(degerler[p.ad]) || ""} saltOkunur onChange={() => undefined} placeholder="Tüm vezneler" title="Vezne seçimi" items={vezneler} yukleniyor={listeYukleniyor}
          kolonlar={vezneKolonlar} aramaAlanlari={vezneArama} anahtar={v => String(v.id)} aramaYerTutucu="Vezne kodu veya adıyla arayın…" disabled={meslek} onSelect={v => set(p.ad, v.id)} />,
        degerler[p.ad] ? <Button variant="link" size="sm" className="p-0 small" onClick={() => set(p.ad, "")}>Tümü</Button> : null);
      case "para": return satir(p.ad, etiket, <DurbunAlan<ProductItem> value={paraAd(degerler[p.ad]) || ""} saltOkunur onChange={() => undefined} placeholder="Tüm paralar" title="Para birimi / kıymet seçimi" items={paralar} yukleniyor={listeYukleniyor}
          kolonlar={paraKolonlar} aramaAlanlari={paraArama} anahtar={v => String(v.id)} aramaYerTutucu="Para kodu veya adıyla arayın…" disabled={meslek} onSelect={v => set(p.ad, v.id)} />,
        degerler[p.ad] ? <Button variant="link" size="sm" className="p-0 small" onClick={() => set(p.ad, "")}>Tümü</Button> : null);
      case "cari": return satir(p.ad, etiket, <DurbunAlan<CariKartItem> value={cariAd(degerler[p.ad]) || ""} saltOkunur onChange={() => undefined} placeholder={p.zorunlu ? "Cari seçin…" : "Tüm cariler"} title="Cari kart seçimi" items={cariler} yukleniyor={listeYukleniyor}
          kolonlar={cariKolonlar} aramaAlanlari={cariArama} anahtar={v => String(v.id)} aramaYerTutucu="Cari kodu, ünvan, telefon veya vergi no ile arayın…" disabled={meslek} onSelect={v => set(p.ad, v.id)} />,
        degerler[p.ad] ? <Button variant="link" size="sm" className="p-0 small" onClick={() => set(p.ad, "")}>Temizle</Button> : null);
      case "fisTipi": return satir(p.ad, etiket, <Form.Select size="sm" value={String(degerler[p.ad] ?? "")} onChange={e => set(p.ad, e.target.value)}>
        <option value="">Tümü</option><option value="0">Alış</option><option value="1">Satış</option></Form.Select>, undefined, GENISLIK.fisTipi);
      case "hareketTipi": {
        const secili = secimler(p.ad);
        const degistir = (k: string, ac: boolean) => set(p.ad, (ac ? [...secili, k] : secili.filter(x => x !== k)).join(","));
        return satir(p.ad, etiket, <div className="d-flex flex-wrap gap-3">
          {HAREKET_TIPLERI.map(h => <Form.Check key={h.kod} inline type="checkbox" id={`${p.ad}-${h.kod}`} className="small me-0" label={h.ad} checked={secili.includes(h.kod)} onChange={e => degistir(h.kod, e.target.checked)} />)}
        </div>, secili.length ? <>{secili.length} seçili · <Button variant="link" size="sm" className="p-0 small align-baseline" onClick={() => set(p.ad, "")}>Tümü</Button></> : "Hiçbiri seçilmezse tüm hareket tipleri", "auto");
      }
      case "kurSecimi": return [
        satir("kurTuru", etiket, <Form.Select size="sm" value={String(degerler.kurTuru ?? 0)} onChange={e => set("kurTuru", Number(e.target.value))}>
          <option value={0}>Anlık gişe kuru</option><option value={2}>Saklanan kur (tarihli)</option></Form.Select>, undefined, 175),
        ...(Number(degerler.kurTuru) === 2 ? [satir("kurTarihi", "Kur tarihi", tarihKutu("kurTarihi"), undefined, GENISLIK.tarih)] : []),
        satir("kurAlani", "Kur alanı", <Form.Select size="sm" value={String(degerler.kurAlani ?? "alis")} onChange={e => set("kurAlani", e.target.value)}>
          <option value="alis">Alış</option><option value="satis">Satış</option><option value="ikisi">Alış + Satış (iki kurla TL)</option></Form.Select>, undefined, 200),
      ];
      // Eski aralık tipleri (tanımlarda artık yok; geriye uyumluluk)
      case "cariAralik": return [
        satir("cariBaslangic", etiket, <DurbunAlan<CariKartItem> value={String(degerler.cariBaslangic ?? "")} onChange={v => set("cariBaslangic", v.toUpperCase())} placeholder="Başlangıç cari" title="Başlangıç cari" items={cariler} yukleniyor={listeYukleniyor}
          kolonlar={cariKolonlar} aramaAlanlari={cariArama} anahtar={v => String(v.id)} disabled={meslek} onSelect={v => set("cariBaslangic", v.kod)} />),
        satir("cariBitis", "Bitiş cari", <DurbunAlan<CariKartItem> value={String(degerler.cariBitis ?? "")} onChange={v => set("cariBitis", v.toUpperCase())} placeholder="Bitiş cari" title="Bitiş cari" items={cariler} yukleniyor={listeYukleniyor}
          kolonlar={cariKolonlar} aramaAlanlari={cariArama} anahtar={v => String(v.id)} disabled={meslek} onSelect={v => set("cariBitis", v.kod)} />)];
      case "vezneAralik": return [
        satir("vezneBaslangic", etiket, <DurbunAlan<VezneItem> value={String(degerler.vezneBaslangic ?? "")} onChange={v => set("vezneBaslangic", v.toUpperCase())} placeholder="Başlangıç vezne" title="Başlangıç vezne" items={vezneler} yukleniyor={listeYukleniyor}
          kolonlar={vezneKolonlar} aramaAlanlari={vezneArama} anahtar={v => String(v.id)} disabled={meslek} onSelect={v => set("vezneBaslangic", v.kod)} />),
        satir("vezneBitis", "Bitiş vezne", <DurbunAlan<VezneItem> value={String(degerler.vezneBitis ?? "")} onChange={v => set("vezneBitis", v.toUpperCase())} placeholder="Bitiş vezne" title="Bitiş vezne" items={vezneler} yukleniyor={listeYukleniyor}
          kolonlar={vezneKolonlar} aramaAlanlari={vezneArama} anahtar={v => String(v.id)} disabled={meslek} onSelect={v => set("vezneBitis", v.kod)} />)];
      case "cariCoklu": return ilkSon<CariKartItem>(p, "cari", "cariIdler", "cariSonId", cariler, cariKolonlar, cariArama, "Cari kodu, ünvan, telefon veya vergi no ile arayın…");
      case "vezneCoklu": return coklu<VezneItem>(p, "vezne", "vezneIdler", vezneler, vezneKolonlar, vezneArama, "Vezne kodu veya adıyla arayın…");
      case "paraCoklu": return coklu<ProductItem>(p, "para", "paraIdler", paralar, paraKolonlar, paraArama, "Para kodu veya adıyla arayın…");
      case "kmt": return satir(p.ad, etiket, <Form.Select size="sm" value={String(degerler[p.ad] ?? "")} onChange={e => set(p.ad, e.target.value)} title="Kur / Miktar / TL gösterimi: yalnızca seçilen gruptaki kolonlar listelenir">
        <option value="">Kur + Miktar + TL</option><option value="K">Kur</option><option value="M">Miktar</option><option value="T">TL</option></Form.Select>, undefined, GENISLIK.kmt);
      default: return satir(p.ad, etiket, <Form.Control size="sm" value={String(degerler[p.ad] ?? "")} onChange={e => set(p.ad, e.target.value)} />, p.not, GENISLIK.metin);
    }
  };

  // Grid: grup başlıkları (+ alt başlık) + ara toplam + genel toplam (PDF ile aynı mantık). Kolonlar veriyle gelen tanımdan (KMT süzülmüş) okunur.
  const kolonlar = veri?.tanim.kolonlar || tanim?.kolonlar || [];
  const doldur = (sablon: string, satir: Record<string, any>) => sablon.replace(/\{\{\s*([\w.]+)\s*(?:\|\w+)?\s*\}\}/g, (_m, yol) => String(satir[yol] ?? ""));
  const gridSatirlari = useMemo(() => {
    type G = { tur: "grup" | "satir" | "araToplam" | "toplam"; satir: Record<string, any>; etiket?: string; altEtiket?: string };
    if (!veri || !tanim) return [] as G[];
    const toplamli = kolonlar.some(k => k.toplam);
    const toplam = (s: Record<string, any>[]) => { const t: Record<string, any> = {}; for (const k of kolonlar) if (k.toplam) t[k.anahtar] = s.reduce((a, r) => a + (Number(r[k.anahtar]) || 0), 0); return t; };
    const cikti: G[] = [];
    if (tanim.grup) {
      let i = 0; const g = tanim.grup;
      while (i < veri.satirlar.length) {
        const a = veri.satirlar[i][g.anahtar]; const uyeler: Record<string, any>[] = [];
        while (i < veri.satirlar.length && veri.satirlar[i][g.anahtar] === a) uyeler.push(veri.satirlar[i++]);
        cikti.push({ tur: "grup", satir: uyeler[0], etiket: doldur(g.baslik, uyeler[0]), altEtiket: g.altBaslik ? doldur(g.altBaslik, uyeler[0]).trim() : "" });
        for (const s of uyeler) cikti.push({ tur: "satir", satir: s });
        if (g.altToplam !== false && toplamli) cikti.push({ tur: "araToplam", satir: toplam(uyeler), etiket: `Ara toplam (${uyeler.length})` });
      }
    } else for (const s of veri.satirlar) cikti.push({ tur: "satir", satir: s });
    if (toplamli && veri.satirlar.length && tanim.grup?.genelToplam !== false) cikti.push({ tur: "toplam", satir: toplam(veri.satirlar), etiket: `GENEL TOPLAM (${veri.satirlar.length})` });
    return cikti;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [veri, tanim, kolonlar]);

  useEffect(() => {
    if (hata) {
      const timer = setTimeout(() => setHata(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [hata]);

  if (!menu) return <div className="w-100 pb-3"><Alert variant="warning">Rapor bulunamadı: {yol}</Alert></div>;

  return (
    <div className="w-100 pb-3">
      {hata && (
        <div className="erp-toast-container">
          <Alert variant={veri?.sinirAsildi ? "warning" : "danger"} dismissible onClose={() => setHata(null)} className="erp-toast-item py-2 px-3 mb-0 shadow border-0">
            {hata}
          </Alert>
        </div>
      )}

      <Card className="border shadow-sm my-2 w-100 bg-white">
        {/* Tek başlık satırı: rapor adı + (kapalıyken) filtre özeti + işlem düğmeleri; parametreler açıkken altında kompakt alan kutusu.
            Kullanıcı isteği 01.10.2026: kısa olsun, ekranın küçük bölümünü kaplasın. Uygula'dan sonra kutu kapanır (yönetici isteği 14.09.2026). */}
        <Card.Body className="p-2">
          {!tanim ? <Spinner size="sm" animation="border" /> : (
            <Form onSubmit={e => { e.preventDefault(); void uygula(); }}>
              <fieldset disabled={meslek}>
                <div className="d-flex flex-wrap align-items-center gap-2 px-1">
                  <IconReportAnalytics size={18} className="text-primary" /><strong className="text-nowrap">{menu.ad}</strong>
                  <span className="text-muted small text-nowrap">{`· ${tanim.kagit === "A4-yatay" ? "A4 yatay" : "A4 dikey"}${veri ? ` · ${veri.toplamKayit.toLocaleString("tr-TR")} kayıt` : ""}`}</span>
                  {!parametreAcik && veri && <span className="text-muted small text-truncate" style={{ maxWidth: "40%" }} title={veri.filtreOzeti}>· {veri.filtreOzeti}</span>}
                  <div className="d-flex flex-wrap gap-2 ms-auto">
                    <Button type="submit" size="sm" variant="primary" title="Seçilen parametrelerle raporu oluştur"><IconSearch size={15} /> Uygula</Button>
                    <Button size="sm" variant="outline-danger" onClick={pdfOnizle} disabled={!veri || veri.sinirAsildi} title="A4 PDF önizlemesini pencerede aç"><IconFileTypePdf size={15} /> PDF</Button>
                    <Button size="sm" variant="outline-primary" onClick={pdfIndir} disabled={!veri || veri.sinirAsildi} title="PDF indir"><IconDownload size={15} /> İndir</Button>
                    <Button size="sm" variant="outline-success" onClick={excelIndir} disabled={!veri || veri.sinirAsildi} title="Excel indir"><IconFileSpreadsheet size={15} /> Excel</Button>
                    <Button size="sm" variant="outline-secondary" onClick={yazdir} disabled={!veri || veri.sinirAsildi} title="Yazdır"><IconPrinter size={15} /> Yazdır</Button>
                    {parametreAcik
                      ? <Button size="sm" variant="light" onClick={() => setParametreAcik(false)} title="Parametreleri gizle"><IconChevronUp size={15} /></Button>
                      : <Button size="sm" variant="outline-primary" onClick={() => setParametreAcik(true)} title="Parametreleri göster"><IconAdjustments size={15} /> Parametreler</Button>}
                    <Button size="sm" variant="light" onClick={temizle} title="Parametreleri sıfırla"><IconRefresh size={15} /></Button>
                  </div>
                </div>
                {parametreAcik && (
                  <div className="mt-2"><div className="d-inline-flex flex-column align-items-start border rounded px-3 py-2" style={{ gap: 6, background: "#f8fafc", maxWidth: "100%" }}>
                    {tanim.parametreler.map(alan)}
                  </div></div>
                )}
              </fieldset>
            </Form>
          )}
        </Card.Body>
      </Card>

      <Row className="g-3">
        <Col xs={12}>
          <Card className="border shadow-sm w-100 bg-white">
            <Card.Body className="p-0">
              {veri?.filtreOzeti && <div className="px-3 py-2 small text-muted border-bottom text-center">{veri.filtreOzeti}</div>}
              <div className="table-responsive" style={{ maxHeight: "68vh" }}>
                <Table hover size="sm" className="mb-0 align-middle" style={{ fontSize: "0.82rem" }}>
                  <thead className="table-light sticky-top"><tr>
                    {kolonlar.map(k => <th key={k.anahtar} className={k.hiza === "center" ? "text-center" : raporSayisalMi(k.bicim) || k.hiza === "right" ? "text-end" : ""}>{k.baslik}</th>)}
                  </tr></thead>
                  <tbody>
                    {gridSatirlari.map((g, i) => {
                      if (g.tur === "grup") return <tr key={i} className="table-secondary"><td colSpan={kolonlar.length}>
                        <span className="fw-bold">{g.etiket}</span>{g.altEtiket && <small className="d-block text-muted fst-italic">{g.altEtiket}</small>}</td></tr>;
                      const kalin = g.tur !== "satir";
                      return <tr key={i} className={g.tur === "toplam" ? "table-primary fw-bold" : g.tur === "araToplam" ? "table-light fw-semibold" : undefined}>
                        {kolonlar.map((k, ki) => {
                          const v = g.satir[k.anahtar];
                          const metin = kalin && !k.toplam ? (ki === 0 || (!raporSayisalMi(k.bicim) && !kolonlar.slice(0, ki).some(x => !raporSayisalMi(x.bicim))) ? g.etiket : "") : raporBicimle(v, k.bicim);
                          return <td key={k.anahtar} className={`${k.hiza === "center" ? "text-center" : raporSayisalMi(k.bicim) || k.hiza === "right" ? "text-end text-nowrap" : ""}`}>{metin}</td>;
                        })}
                      </tr>;
                    })}
                    {!gridSatirlari.length && <tr><td colSpan={kolonlar.length || 1} className="text-center text-muted py-4">
                      {yukleniyor ? <><Spinner size="sm" animation="border" /> Rapor oluşturuluyor…</> : veri ? "Seçilen ölçütlerde kayıt bulunamadı." : "Parametreleri seçip Uygula'ya basın; rapor ekranda ve PDF olarak gelir."}
                    </td></tr>}
                  </tbody>
                </Table>
              </div>
              {/* Özet bölümü: alt rapor karşılığı ikinci tablo (PDF ve Excel'de de basılır) */}
              {veri?.tanim.ozet && !!veri.ozetSatirlar?.length && (() => { const oz = veri.tanim.ozet!; const ozS = veri.ozetSatirlar!;
                const hizala = (k: typeof oz.kolonlar[number]) => k.hiza === "center" ? "text-center" : raporSayisalMi(k.bicim) || k.hiza === "right" ? "text-end text-nowrap" : "";
                return <div className="border-top">
                  <div className="px-3 py-2 fw-bold small bg-light">{oz.baslik}</div>
                  <div className="table-responsive"><Table size="sm" className="mb-0 align-middle" style={{ fontSize: "0.82rem" }}>
                    <thead className="table-light"><tr>{oz.kolonlar.map(k => <th key={k.anahtar} className={hizala(k)}>{k.baslik}</th>)}</tr></thead>
                    <tbody>
                      {ozS.map((s, i) => <tr key={i}>{oz.kolonlar.map(k => <td key={k.anahtar} className={hizala(k)}>{raporBicimle(s[k.anahtar], k.bicim)}</td>)}</tr>)}
                      {oz.kolonlar.some(k => k.toplam) && <tr className="table-primary fw-bold">{oz.kolonlar.map((k, ki) => <td key={k.anahtar} className={hizala(k)}>
                        {k.toplam ? raporBicimle(ozS.reduce((a, r) => a + (Number(r[k.anahtar]) || 0), 0), k.bicim) : ki === 0 ? "TOPLAM" : ""}</td>)}</tr>}
                    </tbody>
                  </Table></div>
                </div>; })()}
              {(tanim?.dipnot || veri?.ekDipnot) && <div className="px-3 py-2 small text-muted border-top" style={{ whiteSpace: "pre-wrap" }}>{[tanim?.dipnot, veri?.ekDipnot].filter(Boolean).join("\n")}</div>}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* PDF önizleme pop-up (yönetici kararı 14.09.2026: Uygula'da otomatik açılmaz) */}
      <Modal show={!!pdfUrl} onHide={() => setPdfUrl(null)} size="xl" centered>
        <Modal.Header closeButton className="py-2">
          <Modal.Title className="fs-6 d-flex align-items-center gap-2"><IconFileTypePdf size={18} className="text-danger" />{menu.ad} — A4 önizleme</Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-0">{pdfUrl && <iframe title="Rapor PDF" src={pdfUrl} style={{ width: "100%", height: "80vh", border: 0 }} />}</Modal.Body>
        <Modal.Footer className="py-2">
          <Button size="sm" variant="outline-primary" onClick={pdfIndir} disabled={dosyaIsi}><IconDownload size={15} /> İndir</Button>
          <Button size="sm" variant="outline-secondary" onClick={yazdir} disabled={dosyaIsi}><IconPrinter size={15} /> Yazdır</Button>
          <Button size="sm" variant="secondary" onClick={() => setPdfUrl(null)}><IconX size={15} /> Kapat</Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default RaporPage;
