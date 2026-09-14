import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Button, Card, Col, Form, Modal, Row, Spinner, Table } from "react-bootstrap";
import { useParams } from "react-router-dom";
import { IconAdjustments, IconChevronUp, IconDownload, IconFileSpreadsheet, IconFileTypePdf, IconHistory, IconPrinter, IconReportAnalytics, IconRefresh, IconSearch, IconTrash, IconX } from "@tabler/icons-react";
import { CashDeskService, type VezneItem } from "../../services/cashDeskService";
import { ProductDefinitionService, type ProductItem } from "../../services/productDefinitionService";
import { CariService, type CariKartItem } from "../../services/cariService";
import {
  RAPOR_MENU, RaporService, raporBicimle, raporSayisalMi,
  type RaporArama, type RaporParametre, type RaporParametreDegerleri, type RaporTanim, type RaporVeri,
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
const HAREKET_TIPLERI: { kod: string; ad: string }[] = [
  { kod: "0", ad: "Nakit" }, { kod: "1", ad: "Banka / Havale" }, { kod: "2", ad: "POS / Kredi Kartı" }, { kod: "3", ad: "Dekont" }, { kod: "4", ad: "Virman" }, { kod: "5", ad: "Devir" },
];

/** Tanımdaki parametrelerden başlangıç değerleri (tarihAralik → baslangic+bitis, saatAralik → baslangicSaat+bitisSaat, kurSecimi → kurTuru+kurTarihi+kurAlani) */
function baslangicDegerleri(parametreler: RaporParametre[]): RaporParametreDegerleri {
  const d: RaporParametreDegerleri = {};
  for (const p of parametreler) {
    switch (p.tip) {
      case "tarihAralik": d.baslangic = varsayilanDeger(p.varsayilan ?? "bugun"); d.bitis = gun(0); break;
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
  const [listeYukleniyor, setListeYukleniyor] = useState(false);
  const [aramalar, setAramalar] = useState<RaporArama[]>([]);
  /** Uygula'dan sonra parametre alanı arkada (kapalı) kalır, rapor tam genişlikte gelir (yönetici isteği 14.09.2026) */
  const [parametreAcik, setParametreAcik] = useState(true);
  const istekNo = useRef(0);

  useEffect(() => () => { if (pdfUrl) URL.revokeObjectURL(pdfUrl); }, [pdfUrl]);

  // Tanım + dürbün listeleri + kayıtlı aramalar
  useEffect(() => {
    if (!kod) return;
    setTanim(null); setVeri(null); setPdfUrl(null); setHata(null); setAramalar([]);
    RaporService.tanim(kod).then(t => {
      setTanim(t); setDegerler(baslangicDegerleri(t.parametreler));
      const tipler = new Set(t.parametreler.map(p => p.tip));
      setListeYukleniyor(true);
      const isler: Promise<unknown>[] = [];
      if (tipler.has("vezne") || tipler.has("vezneAralik") || tipler.has("vezneCoklu")) isler.push(CashDeskService.getVezneler().then(v => setVezneler([...v].sort((a, b) => a.kod.localeCompare(b.kod)))).catch(() => setVezneler([])));
      if (tipler.has("para") || tipler.has("paraCoklu")) isler.push(ProductDefinitionService.getProducts().then(p => setParalar([...p].sort((a, b) => (a.siraNo ?? 99) - (b.siraNo ?? 99) || a.kod.localeCompare(b.kod)))).catch(() => setParalar([])));
      if (tipler.has("cari") || tipler.has("cariAralik") || tipler.has("cariCoklu")) isler.push(CariService.getCariKartlar().then(c => setCariler([...c].sort((a, b) => a.kod.localeCompare(b.kod)))).catch(() => setCariler([])));
      Promise.all(isler).finally(() => setListeYukleniyor(false));
    }).catch(e => setHata(e?.message || "Rapor tanımı alınamadı."));
    RaporService.aramalar(kod).then(setAramalar).catch(() => setAramalar([]));
  }, [kod]);

  const zorunluEksik = useMemo(() => {
    if (!tanim) return null;
    for (const p of tanim.parametreler) {
      if (!p.zorunlu) continue;
      if (p.tip === "tarihAralik" && (!degerler.baslangic || !degerler.bitis)) return "Tarih aralığı zorunludur.";
      if (p.tip === "cariAralik" && !degerler.cariBaslangic && !degerler.cariBitis) return "Cari aralığı için başlangıç veya bitiş cari seçin.";
      if (p.tip === "vezneAralik" && !degerler.vezneBaslangic && !degerler.vezneBitis) return "Vezne aralığı için başlangıç veya bitiş vezne seçin.";
      if (p.tip === "paraCoklu" && !degerler.paraIdler) return "En az bir para seçin.";
      if (p.tip === "cariCoklu" && !degerler.cariIdler && !degerler.cariSonId) return "En az bir cari seçin.";
      if (p.tip === "vezneCoklu" && !degerler.vezneIdler) return "En az bir vezne seçin.";
      if (!["tarihAralik", "saatAralik", "kurSecimi", "cariAralik", "vezneAralik", "paraCoklu", "cariCoklu", "vezneCoklu"].includes(p.tip) && !degerler[p.ad]) return `${p.etiket} zorunludur.`;
    }
    if (degerler.baslangic && degerler.bitis && String(degerler.baslangic) > String(degerler.bitis)) return "Başlangıç tarihi bitişten sonra olamaz.";
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
      RaporService.aramaKaydet(kod, d, v.filtreOzeti).then(() => RaporService.aramalar(kod).then(setAramalar)).catch(() => undefined);
      setPdfUrl(null);
      if (v.sinirAsildi) { setHata(`Rapor ${v.toplamKayit.toLocaleString("tr-TR")} satır üretiyor; üst sınır ${(v.tanim.ustSinir || 5000).toLocaleString("tr-TR")}. Parametreleri daraltın.`); return; }
      // PDF otomatik açılmaz; kullanıcı "PDF" düğmesiyle pop-up olarak görür (yönetici kararı 14.09.2026)
    } catch (e: any) { if (id === istekNo.current) { setVeri(null); setHata(e?.message || "Rapor oluşturulamadı."); } }
    finally { if (id === istekNo.current) setYukleniyor(false); }
  }, [kod, tanim, degerler, zorunluEksik]);
  /** Kayıtlı aramayı yükler ve hemen uygular. */
  const aramaYukle = (a: RaporArama) => {
    if (!tanim) return;
    const d: RaporParametreDegerleri = { ...baslangicDegerleri(tanim.parametreler) };
    for (const [k, v] of Object.entries(a.parametreler)) d[k] = v === null ? "" : v;
    setDegerler(d); void uygula(d);
  };
  const aramaSil = async (aramaId?: number) => {
    if (!kod) return;
    try { await RaporService.aramaSil(kod, aramaId); setAramalar(o => aramaId ? o.filter(a => a.aramaId !== aramaId) : []); }
    catch (e: any) { setHata(e?.message || "Arama silinemedi."); }
  };
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

  /** Dikey parametre satırı: sol etiket, sağ kontrol (Crystal parametre penceresi düzeni, yönetici isteği 14.09.2026) */
  const satir = (key: string, etiket: React.ReactNode, kontrol: React.ReactNode, not?: React.ReactNode) => (
    <Row key={key} className="g-0 align-items-center border-bottom" style={{ minHeight: 40 }}>
      <Col md={3} className="px-3 py-1 small fw-semibold text-secondary" style={{ background: "#eef4fb" }}>{etiket}</Col>
      <Col md={7} lg={6} className="px-3 py-1">{kontrol}{not && <div className="form-text mt-0">{not}</div>}</Col>
    </Row>
  );
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
      <DurbunAlan<T> value={secili.map(kodu).join(", ")} saltOkunur onChange={() => undefined} placeholder={p.zorunlu ? `Dürbünden ${tur} seçin…` : `Tüm ${tur}ler (dürbünden seçin)`} title={`${tur[0].toLocaleUpperCase("tr-TR") + tur.slice(1)} seçimi — birden fazla seçilebilir`} items={items} yukleniyor={listeYukleniyor}
        kolonlar={kolonlar} aramaAlanlari={arama} anahtar={v => String(v.id)} aramaYerTutucu={yerTutucu} disabled={meslek} coklu secili={secili} onSelect={() => undefined}
        onCokluSec={sec => set(ad, sec.map(x => String(x.id)).join(","))} />,
      secili.length ? <>{secili.length} {tur} seçili (yalnızca bunlar) · <Button variant="link" size="sm" className="p-0 small align-baseline" onClick={() => set(ad, "")}>Tümü</Button></>
        : p.zorunlu ? `En az bir ${tur} seçin` : `Hiçbiri seçilmezse tüm ${tur}ler`);
  };
  /** Cari: İlk kod (çoklu) + Son kod (tek). Son boşsa yalnızca seçilenler; son seçiliyse ilk seçimin en küçük kodundan son koda aralık; yalnız son seçiliyse baştan son koda kadar */
  const ilkSon = <T extends { id: number; kod: string }>(p: RaporParametre, tur: string, ilkAd: string, sonAd: string, items: T[], kolonlar: SecimKolon<T>[], arama: (x: T) => (string | number | null | undefined)[], yerTutucu: string) => {
    const secili = secimler(ilkAd);
    const kodu = (id: string | number | undefined) => items.find(v => String(v.id) === String(id ?? ""))?.kod || (id ? String(id) : "");
    const son = degerler[sonAd];
    const ilkKod = secili.map(kodu).filter(Boolean).sort()[0] || "";
    const aciklama = son
      ? `${ilkKod || "(baştan)"} → ${kodu(son)} aralığındaki ${tur}ler`
      : secili.length ? `${secili.length} ${tur} seçili (yalnızca bunlar)` : p.zorunlu ? `En az bir ${tur} seçin` : `Hiçbiri seçilmezse tüm ${tur}ler`;
    return [
      satir(ilkAd, <>İlk {tur} kodu{zorunluIsareti(p)}</>,
        <DurbunAlan<T> value={secili.map(kodu).join(", ")} saltOkunur onChange={() => undefined} placeholder={p.zorunlu ? `Dürbünden ${tur} seçin…` : `Tüm ${tur}ler (dürbünden seçin)`} title={`İlk ${tur} kodu — birden fazla seçilebilir`} items={items} yukleniyor={listeYukleniyor}
          kolonlar={kolonlar} aramaAlanlari={arama} anahtar={v => String(v.id)} aramaYerTutucu={yerTutucu} disabled={meslek} coklu secili={secili} onSelect={() => undefined}
          onCokluSec={sec => set(ilkAd, sec.map(x => String(x.id)).join(","))} />,
        <>{aciklama}{(secili.length || son) ? <> · <Button variant="link" size="sm" className="p-0 small align-baseline" onClick={() => { set(ilkAd, ""); set(sonAd, ""); }}>Temizle</Button></> : null}</>),
      satir(sonAd, <>Son {tur} kodu</>,
        <DurbunAlan<T> value={kodu(son)} saltOkunur onChange={() => undefined} placeholder="Boş bırakılırsa yalnızca ilk kodda seçilenler" title={`Son ${tur} kodu`} items={items} yukleniyor={listeYukleniyor}
          kolonlar={kolonlar} aramaAlanlari={arama} anahtar={v => String(v.id)} aramaYerTutucu={yerTutucu} disabled={meslek} onSelect={v => set(sonAd, v.id)} />,
        son ? <Button variant="link" size="sm" className="p-0 small align-baseline" onClick={() => set(sonAd, "")}>Son kodu kaldır</Button> : "Seçilirse ilk koddan bu koda kadar aralık gelir"),
    ];
  };

  const alan = (p: RaporParametre): React.ReactNode => {
    const etiket = <>{p.etiket}{zorunluIsareti(p)}</>;
    switch (p.tip) {
      case "tarih": return satir(p.ad, etiket, tarihKutu(p.ad));
      case "tarihAralik": return [satir("baslangic", <>İlk tarih{zorunluIsareti(p)}</>, tarihKutu("baslangic")), satir("bitis", "Son tarih", tarihKutu("bitis"))];
      case "saatAralik": return [satir("baslangicSaat", "İlk saat", saatKutu("baslangicSaat", "00:00")), satir("bitisSaat", "Son saat", saatKutu("bitisSaat", "23:59"))];
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
        <option value="">Tümü</option><option value="0">Alış</option><option value="1">Satış</option></Form.Select>);
      case "hareketTipi": {
        const secili = secimler(p.ad);
        const degistir = (k: string, ac: boolean) => set(p.ad, (ac ? [...secili, k] : secili.filter(x => x !== k)).join(","));
        return satir(p.ad, etiket, <div className="d-flex flex-wrap gap-3 pt-1">
          {HAREKET_TIPLERI.map(h => <Form.Check key={h.kod} inline type="checkbox" id={`${p.ad}-${h.kod}`} className="small me-0" label={h.ad} checked={secili.includes(h.kod)} onChange={e => degistir(h.kod, e.target.checked)} />)}
        </div>, secili.length ? <>{secili.length} tip seçili · <Button variant="link" size="sm" className="p-0 small align-baseline" onClick={() => set(p.ad, "")}>Tümü</Button></> : "Hiçbiri seçilmezse tüm hareket tipleri");
      }
      case "kurSecimi": return [
        satir("kurTuru", etiket, <Form.Select size="sm" value={String(degerler.kurTuru ?? 0)} onChange={e => set("kurTuru", Number(e.target.value))}>
          <option value={0}>Anlık gişe kuru</option><option value={2}>Saklanan kur (tarihli)</option></Form.Select>),
        ...(Number(degerler.kurTuru) === 2 ? [satir("kurTarihi", "Kur tarihi", tarihKutu("kurTarihi"))] : []),
        satir("kurAlani", "Kur alanı", <Form.Select size="sm" value={String(degerler.kurAlani ?? "alis")} onChange={e => set("kurAlani", e.target.value)}>
          <option value="alis">Alış</option><option value="satis">Satış</option><option value="ikisi">Alış + Satış (iki kurla TL)</option></Form.Select>),
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
        <option value="">Kur + Miktar + TL</option><option value="K">Kur</option><option value="M">Miktar</option><option value="T">TL</option></Form.Select>);
      default: return satir(p.ad, etiket, <Form.Control size="sm" value={String(degerler[p.ad] ?? "")} onChange={e => set(p.ad, e.target.value)} />);
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
    if (toplamli && veri.satirlar.length) cikti.push({ tur: "toplam", satir: toplam(veri.satirlar), etiket: `GENEL TOPLAM (${veri.satirlar.length})` });
    return cikti;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [veri, tanim, kolonlar]);

  useEffect(() => {
    if (hata) {
      const timer = setTimeout(() => setHata(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [hata]);

  if (!menu) return <div className="container-fluid py-3"><Alert variant="warning">Rapor bulunamadı: {yol}</Alert></div>;

  return (
    <div className="container-fluid py-2 px-3">
      {hata && (
        <div className="erp-toast-container">
          <Alert variant={veri?.sinirAsildi ? "warning" : "danger"} dismissible onClose={() => setHata(null)} className="erp-toast-item py-2 px-3 mb-0 shadow border-0">
            {hata}
          </Alert>
        </div>
      )}

      <Card className="shadow-sm border-0 my-2">
        <Card.Header className="d-flex align-items-center gap-2 py-2 bg-white">
          <IconReportAnalytics size={18} className="text-primary" /><strong>{menu.ad}</strong>
          {veri && !parametreAcik && <span className="text-muted small text-truncate" style={{ maxWidth: "50%" }} title={veri.filtreOzeti}>· {veri.filtreOzeti}</span>}
          <span className="text-muted small ms-auto">{tanim ? `${tanim.kagit === "A4-yatay" ? "A4 yatay" : "A4 dikey"}${veri ? ` · ${veri.toplamKayit.toLocaleString("tr-TR")} kayıt` : ""}` : "Tanım yükleniyor…"}</span>
          <Button size="sm" variant={parametreAcik ? "light" : "outline-primary"} onClick={() => setParametreAcik(o => !o)} disabled={!tanim} title={parametreAcik ? "Parametreleri gizle" : "Parametreleri göster"}>
            {parametreAcik ? <IconChevronUp size={15} /> : <><IconAdjustments size={15} /> Parametreler</>}</Button>
          <Button size="sm" variant="light" onClick={temizle} disabled={meslek || !tanim} title="Parametreleri sıfırla"><IconRefresh size={15} /></Button>
        </Card.Header>
        <Card.Body className={parametreAcik ? "p-3" : "p-2"}>
          {!tanim ? <Spinner size="sm" animation="border" /> : (
            <Form onSubmit={e => { e.preventDefault(); void uygula(); }}>
              <fieldset disabled={meslek}>
                {/* Dikey parametre listesi (etiket | değer); Uygula'dan sonra kapanır, rapor tam gelir (yönetici isteği 14.09.2026) */}
                {parametreAcik && <div className="border rounded overflow-hidden" style={{ maxWidth: 900 }}>{tanim.parametreler.map(alan)}</div>}
                <div className={`d-flex flex-wrap gap-2 ${parametreAcik ? "mt-3 pt-2 border-top" : ""}`}>
                  <Button type="submit" size="sm" variant="primary" title="Seçilen parametrelerle raporu oluştur"><IconSearch size={15} /> Uygula</Button>
                  <Button size="sm" variant="outline-danger" onClick={pdfOnizle} disabled={!veri || veri.sinirAsildi} title="A4 PDF önizlemesini pencerede aç"><IconFileTypePdf size={15} /> PDF</Button>
                  <Button size="sm" variant="outline-primary" onClick={pdfIndir} disabled={!veri || veri.sinirAsildi} title="PDF indir"><IconDownload size={15} /> İndir</Button>
                  <Button size="sm" variant="outline-success" onClick={excelIndir} disabled={!veri || veri.sinirAsildi} title="Excel indir"><IconFileSpreadsheet size={15} /> Excel</Button>
                  <Button size="sm" variant="outline-secondary" onClick={yazdir} disabled={!veri || veri.sinirAsildi} title="Yazdır"><IconPrinter size={15} /> Yazdır</Button>
                </div>
              </fieldset>
            </Form>
          )}
          {/* Kayıtlı aramalar: her Uygula sunucuda saklanır (kullanıcı × rapor, son 10); tıkla → yükle ve uygula; × → sil */}
          {tanim && aramalar.length > 0 && (
            <div className="d-flex flex-wrap align-items-center gap-1 mt-2 pt-2 border-top">
              <span className="small text-muted me-1 d-inline-flex align-items-center gap-1"><IconHistory size={14} /> Önceki aramalar:</span>
              {aramalar.map(a => (
                <span key={a.aramaId} className="d-inline-flex align-items-center border rounded-pill bg-light" style={{ fontSize: "0.76rem" }}>
                  <button type="button" className="btn btn-link btn-sm py-0 ps-2 pe-1 text-decoration-none text-body" disabled={meslek} onClick={() => aramaYukle(a)}
                    title={`${new Date(a.zaman).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul", hour12: false })} · tıklayınca yüklenir ve uygulanır`}>
                    {a.ozet || Object.entries(a.parametreler).map(([k, v]) => `${k}=${v}`).join(" · ") || "(parametresiz)"}
                  </button>
                  <button type="button" className="btn btn-link btn-sm py-0 px-1 text-danger" disabled={meslek} onClick={() => aramaSil(a.aramaId)} title="Bu aramayı sil"><IconX size={12} /></button>
                </span>
              ))}
              <Button variant="link" size="sm" className="py-0 px-1 text-danger text-decoration-none" style={{ fontSize: "0.76rem" }} disabled={meslek} onClick={() => aramaSil()} title="Bu rapordaki tüm kayıtlı aramalarını sil"><IconTrash size={13} /> Tümünü sil</Button>
            </div>
          )}
        </Card.Body>
      </Card>

      <Row className="g-3">
        <Col xs={12}>
          <Card className="shadow-sm border-0">
            <Card.Body className="p-0">
              {veri?.filtreOzeti && <div className="px-3 py-2 small text-muted border-bottom">{veri.filtreOzeti}</div>}
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
