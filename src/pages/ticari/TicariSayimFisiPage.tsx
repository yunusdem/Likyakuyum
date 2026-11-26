import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Alert, Badge, Button, Card, Col, Form, InputGroup, Row, Spinner, Table } from "react-bootstrap";
import { IconBarcode, IconClipboardCheck, IconListSearch, IconRotate } from "@tabler/icons-react";
import ERPToolbar from "../../components/common/ERPToolbar";
import { LookupModal } from "../../components/common/LookupModal";
import { useToast } from "../../context/ToastContext";
import { SayimFisi, SayimKarti, SayimListeSatiri, StokGrup, TicariService, eksiStokUyarisiMi, miktarYaz } from "../../services/ticariService";
import { StokKartSecici } from "./StokKartSecici";
import { stokBarkodCoz } from "./stokBarkod";
import { YETKI_YOK_MESAJI, useTicariYetki } from "./useTicariYetki";

/**
 * Ticari › Sayım Fişi (docs/TICARI_ADISYON_YOL_HARITASI.md, TA11). Sayım anı + isteğe bağlı grup; liste o andaki sistem miktarıyla
 * gelir; barkod / kod okutuldukça sayılan artar ("3*barkod", terazi etiketi, koli barkodu). Taslak kaydedilir (stok değişmez);
 * onayda fark (sayılan − sistem) stok hareketi olur. "Sayılmayanlar sıfır" seçilirse süzgeçte sayılmayanlar 0 sayılır.
 */
type Satir = SayimKarti & { sayilan: string; sonFark?: number | null };
const sayi = (v: string): number | null => {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const n = Number(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s);
  return Number.isFinite(n) ? n : null;
};
const metin = (n: number) => String(Math.round(n * 10000) / 10000).replace(".", ",");
/**
 * F10 (26.11.2026 denetimi): kaydedilmemiş okutmalar korunur — sayılanlar tarayıcıda taslak olarak saklanır (firma + sayım başına),
 * sayfa yeniden açılınca geri yüklemesi sorulur; kaydedilmemiş değişiklikle sayfadan çıkarken / "Yeni" / grup değişiminde uyarılır.
 */
const TASLAK_ONEK = "likya_sayim_taslak_";
const taslakAnahtari = (sayimId: number | null) => `${TASLAK_ONEK}${localStorage.getItem("kuyumcu_erp_last_db") || localStorage.getItem("kuyumcu_erp_active_db") || ""}_${sayimId ?? "yeni"}`;
type SayimTaslagi = { zaman: number; grupId: number | null; aciklama: string; sayilan: { stokKartId: number; sayilan: number; kod: string; ad: string; birim: string }[] };
const taslakOku = (sayimId: number | null): SayimTaslagi | null => {
  try {
    const t = JSON.parse(localStorage.getItem(taslakAnahtari(sayimId)) || "null");
    return t && Array.isArray(t.sayilan) && t.sayilan.length && Date.now() - Number(t.zaman) < 3 * 86400000 ? t : null;
  } catch { return null; }
};
const taslakSil = (sayimId: number | null) => { try { localStorage.removeItem(taslakAnahtari(sayimId)); } catch { /* yok */ } };
const yerelZaman = (d = new Date()) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

export const TicariSayimFisiPage: React.FC = () => {
  const { showSuccess, showError, showWarning } = useToast();
  const yetki = useTicariYetki();
  const location = useLocation();
  const navigate = useNavigate();
  const [fis, setFis] = useState<SayimFisi | null>(null);
  const [tarih, setTarih] = useState(yerelZaman());
  const [grupId, setGrupId] = useState<number | null>(null);
  const [aciklama, setAciklama] = useState("");
  const [gruplar, setGruplar] = useState<StokGrup[]>([]);
  const [satirlar, setSatirlar] = useState<Satir[]>([]);
  const [okut, setOkut] = useState("");
  const [vurgu, setVurgu] = useState<number | null>(null);
  const [suzgec, setSuzgec] = useState<"hepsi" | "sayilan" | "sayilmayan" | "fark">("hepsi");
  const [arama, setArama] = useState("");
  const [sifir, setSifir] = useState(false);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [isleniyor, setIsleniyor] = useState(false);
  const [secici, setSecici] = useState<{ acik: boolean; arama: string }>({ acik: false, arama: "" });
  const [liste, setListe] = useState<SayimListeSatiri[] | null>(null);
  const okutRef = useRef<HTMLInputElement>(null);
  const onayli = fis?.durum === 1;
  // F10: son kaydedilen / açılan sayılanların imzası; farklıysa kaydedilmemiş değişiklik var
  const kayitliImza = useRef("[]");
  const sayilanImzasi = (l: Satir[]) => JSON.stringify(l.filter((x) => sayi(x.sayilan) !== null).map((x) => [x.stokKartId, sayi(x.sayilan)]).sort((a, b) => Number(a[0]) - Number(b[0])));
  const kirli = !onayli && !yukleniyor && sayilanImzasi(satirlar) !== kayitliImza.current;
  const geriYuklendi = useRef<string | null>(null);

  useEffect(() => { TicariService.gruplar().then(setGruplar).catch(() => setGruplar([])); }, []);

  const listeGetir = useCallback(async (g: number | null, t: string, mevcut: { stokKartId: number; sayilan: number }[] = [], sayimId?: number | null, imzala = true) => {
    setYukleniyor(true);
    try {
      const k = await TicariService.sayimKartlari({ grupId: g, tarih: new Date(t).toISOString(), sayimId: sayimId ?? null });
      const sayilan = new Map(mevcut.map((x) => [x.stokKartId, x.sayilan]));
      // Süzgeç dışında kalan sayılmış kartlar da listede kalır
      const ekler = mevcut.filter((x) => !k.some((y) => y.stokKartId === x.stokKartId));
      const ekKartlar = ekler.length ? await TicariService.kartlar({ idler: ekler.map((x) => x.stokKartId) }) : [];
      const yeniListe: Satir[] = [
        ...k.map((x) => ({ ...x, sayilan: sayilan.has(x.stokKartId) ? metin(sayilan.get(x.stokKartId)!) : "" })),
        ...ekKartlar.map((x) => ({ stokKartId: x.stokKartId, kod: x.kod, ad: x.ad, birim: x.birim, grup: x.grupAdi || "", sistem: x.bakiye ?? 0, sayilan: metin(sayilan.get(x.stokKartId) || 0) })),
      ];
      if (imzala) kayitliImza.current = sayilanImzasi(yeniListe); // "Listeyi getir": ekrandaki kaydedilmemiş sayılanlar kirli kalır
      // F10: bu sayım için tarayıcıda kaydedilmemiş taslak varsa geri yüklemesi sorulur (bir kez)
      const tsl = taslakOku(sayimId ?? null);
      const tAnahtar = `${sayimId ?? "yeni"}`;
      if (tsl && geriYuklendi.current !== tAnahtar) {
        geriYuklendi.current = tAnahtar;
        const fark = tsl.sayilan.filter((x) => sayilan.get(x.stokKartId) !== x.sayilan);
        if (fark.length && window.confirm(`Bu sayımda kaydedilmemiş ${fark.length} kalem var (${new Date(tsl.zaman).toLocaleString("tr-TR")}). Geri yüklensin mi?\n\n"İptal": taslak silinir.`)) {
          for (const x of tsl.sayilan) {
            const i = yeniListe.findIndex((y) => y.stokKartId === x.stokKartId);
            if (i >= 0) yeniListe[i] = { ...yeniListe[i], sayilan: metin(x.sayilan) };
            else yeniListe.push({ stokKartId: x.stokKartId, kod: x.kod, ad: x.ad, birim: x.birim, grup: "", sistem: 0, sayilan: metin(x.sayilan) });
          }
        } else if (fark.length) taslakSil(sayimId ?? null);
      }
      setSatirlar(yeniListe);
    } catch (e: any) {
      showError(e?.message || "Sayım listesi alınamadı.");
    } finally {
      setYukleniyor(false);
    }
  }, [showError]);

  const ac = useCallback(async (id: number) => {
    setYukleniyor(true);
    try {
      const f = await TicariService.sayim(id);
      setFis(f);
      setTarih(yerelZaman(new Date(f.tarih)));
      setGrupId(f.stokGrupId);
      setAciklama(f.aciklama || "");
      if (f.durum === 1) {
        setSatirlar(f.satirlar.map((x) => ({ stokKartId: x.stokKartId, kod: x.kod, ad: x.ad, birim: x.birim, grup: x.grup, sistem: x.sistem ?? 0, sayilan: metin(x.sayilan), sonFark: x.fark })));
        setYukleniyor(false);
      } else await listeGetir(f.stokGrupId, yerelZaman(new Date(f.tarih)), f.satirlar, f.sayimId);
    } catch (e: any) {
      showError(e?.message || "Sayım açılamadı.");
      setYukleniyor(false);
    }
  }, [listeGetir, showError]);

  useEffect(() => {
    const id = Number(new URLSearchParams(location.search).get("id"));
    if (id > 0) void ac(id);
    else void listeGetir(null, yerelZaman());
  }, [location.search]); // eslint-disable-line react-hooks/exhaustive-deps

  // F10: kaydedilmemiş sayılanlar tarayıcıda taslak; sayfadan çıkarken tarayıcı uyarır
  useEffect(() => {
    if (onayli || yukleniyor) return;
    const sayilanlar = satirlar.filter((x) => sayi(x.sayilan) !== null);
    if (!kirli) return;
    try {
      localStorage.setItem(taslakAnahtari(fis?.sayimId ?? null), JSON.stringify({ zaman: Date.now(), grupId, aciklama,
        sayilan: sayilanlar.map((x) => ({ stokKartId: x.stokKartId, sayilan: sayi(x.sayilan)!, kod: x.kod, ad: x.ad, birim: x.birim })) } as SayimTaslagi));
    } catch { /* depolama dolu: uyarı yine çalışır */ }
  }, [satirlar, kirli]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!kirli) return;
    const uyar = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", uyar);
    return () => window.removeEventListener("beforeunload", uyar);
  }, [kirli]);
  const vazgecilsinMi = () => !kirli || window.confirm("Kaydedilmemiş sayım var. Yine de devam edilsin mi? (Sayılanlar tarayıcıda taslak olarak kalır.)");

  const yeni = () => {
    if (!vazgecilsinMi()) return;
    geriYuklendi.current = "yeni"; // bilerek yeni sayıma geçildi: aynı oturumda taslak yeniden sorulmaz
    setFis(null); setAciklama(""); setGrupId(null); setSifir(false); setOkut("");
    const t = yerelZaman(); setTarih(t);
    navigate("/ticari/sayim-fisi", { replace: true });
    void listeGetir(null, t);
  };

  const ekle = (stokKartId: number, miktar: number, kart?: { kod: string; ad: string; birim: string; grup?: string; sistem?: number }) => {
    setSatirlar((p) => {
      const i = p.findIndex((x) => x.stokKartId === stokKartId);
      if (i >= 0) {
        const yeniDeger = Math.round(((sayi(p[i].sayilan) ?? 0) + miktar) * 10000) / 10000;
        setVurgu(stokKartId);
        return p.map((x, j) => (j === i ? { ...x, sayilan: metin(yeniDeger) } : x));
      }
      setVurgu(stokKartId);
      return [...p, { stokKartId, kod: kart?.kod || "", ad: kart?.ad || "", birim: kart?.birim || "Adet", grup: kart?.grup || "", sistem: kart?.sistem ?? 0, sayilan: metin(miktar) }];
    });
  };

  const okutuldu = async () => {
    if (onayli) return;
    const d = okut.trim();
    if (!d) { setSecici({ acik: true, arama: "" }); return; }
    setOkut(""); // önce temizle: yanıt gelmeden yapılan ikinci okutma ilkinin sonuna eklenmesin
    const r = await stokBarkodCoz(d);
    if (!r) { setSecici({ acik: true, arama: d }); return; }
    if ("hata" in r) { showError(r.hata); return; }
    ekle(r.kart.stokKartId, r.miktar, { kod: r.kart.kod, ad: r.kart.ad, birim: r.kart.birim, grup: r.kart.grupAdi || "", sistem: r.kart.bakiye ?? 0 });
    if (r.bilgi) showWarning(`${r.kart.ad}: ${r.bilgi}`, 2500);
    setOkut("");
  };

  const girdi = () => satirlar.filter((x) => sayi(x.sayilan) !== null).map((x) => ({ stokKartId: x.stokKartId, sayilan: sayi(x.sayilan)! }));

  const kaydet = async (): Promise<SayimFisi | null> => {
    if (!yetki.yonetebilir) { showError(YETKI_YOK_MESAJI); return null; }
    const bozuk = satirlar.find((x) => x.sayilan.trim() && (sayi(x.sayilan) === null || sayi(x.sayilan)! < 0));
    if (bozuk) { showWarning(`${bozuk.ad}: sayılan miktar okunamadı.`); return null; }
    setIsleniyor(true);
    try {
      const f = await TicariService.sayimKaydet({ sayimId: fis?.sayimId ?? null, tarih: new Date(tarih).toISOString(), stokGrupId: grupId, aciklama: aciklama || null, satirlar: girdi() });
      setFis(f);
      kayitliImza.current = sayilanImzasi(satirlar);
      taslakSil(fis?.sayimId ?? null); taslakSil(f.sayimId);
      if (!fis) { geriYuklendi.current = String(f.sayimId); navigate(`/ticari/sayim-fisi?id=${f.sayimId}`, { replace: true }); }
      showSuccess(`${f.sayimNo} taslak kaydedildi (${f.satirlar.length} kalem sayıldı; stok değişmedi).`);
      return f;
    } catch (e: any) {
      showError(e?.message || "Sayım kaydedilemedi.");
      return null;
    } finally {
      setIsleniyor(false);
    }
  };

  const onayla = async () => {
    const f = await kaydet();
    if (!f) return;
    const sayilmayan = satirlar.filter((x) => sayi(x.sayilan) === null).length;
    if (!window.confirm(`${f.sayimNo} onaylansın mı? Farklar stoğa işlenir.${sifir && sayilmayan ? `\n${sayilmayan} sayılmayan kalem 0 sayılacak.` : ""}`)) return;
    setIsleniyor(true);
    try {
      const o = await TicariService.sayimOnayla(f.sayimId, sifir);
      showSuccess(`${o.sayimNo} onaylandı: ${o.ozet.fazlaKalem} kalem fazla, ${o.ozet.eksikKalem} kalem eksik.`);
      await ac(o.sayimId);
    } catch (e: any) {
      showError(e?.message || "Sayım onaylanamadı.");
    } finally {
      setIsleniyor(false);
    }
  };

  const geriAl = async (onay = false) => {
    if (!fis) return;
    if (!onay && !window.confirm(`${fis.sayimNo} onayı geri alınsın mı? Fark hareketleri silinir, fiş taslağa döner.`)) return;
    let tekrar = false;
    try {
      await TicariService.sayimGeriAl(fis.sayimId, onay);
      showSuccess("Onay geri alındı.");
      await ac(fis.sayimId);
    } catch (e: any) {
      if (eksiStokUyarisiMi(e)) tekrar = window.confirm(e.message);
      else showError(e?.message || "Onay geri alınamadı.");
    }
    if (tekrar) await geriAl(true);
  };

  const sil = async () => {
    if (!fis) return;
    if (!window.confirm(`${fis.sayimNo} taslağı silinsin mi?`)) return;
    try {
      await TicariService.sayimSil(fis.sayimId);
      showSuccess("Taslak silindi.");
      yeni();
    } catch (e: any) {
      showError(e?.message || "Silinemedi.");
    }
  };

  const fark = (x: Satir) => (onayli ? x.sonFark ?? 0 : sayi(x.sayilan) === null ? null : Math.round((sayi(x.sayilan)! - x.sistem) * 10000) / 10000);
  const gorunen = useMemo(() => {
    const a = arama.trim().toLocaleLowerCase("tr-TR");
    return satirlar.filter((x) => {
      if (a && !`${x.kod} ${x.ad}`.toLocaleLowerCase("tr-TR").includes(a)) return false;
      const f = fark(x);
      if (suzgec === "sayilan") return sayi(x.sayilan) !== null;
      if (suzgec === "sayilmayan") return sayi(x.sayilan) === null;
      if (suzgec === "fark") return !!f;
      return true;
    });
  }, [satirlar, arama, suzgec, onayli]); // eslint-disable-line react-hooks/exhaustive-deps
  const ozet = useMemo(() => {
    const sayilan = satirlar.filter((x) => sayi(x.sayilan) !== null);
    const f = satirlar.map(fark).filter((x): x is number => x !== null);
    return { sayilan: sayilan.length, toplam: satirlar.length, fazla: f.filter((x) => x > 0).length, eksik: f.filter((x) => x < 0).length };
  }, [satirlar, onayli]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (vurgu) document.getElementById(`sayim-${vurgu}`)?.scrollIntoView({ block: "nearest" }); }, [vurgu, satirlar]);

  const listeAc = async () => {
    try { setListe(await TicariService.sayimListe({})); } catch (e: any) { showError(e?.message || "Liste alınamadı."); }
  };

  return (
    <div className="container-fluid py-3">
      <ERPToolbar pageTitle="T- Sayım Fişi" pageIcon={<IconClipboardCheck size={20} />} onNew={yeni} onSave={!onayli ? () => void kaydet() : undefined}
        hideSave={onayli} onDelete={fis && !onayli ? sil : undefined} hideDelete={!fis || onayli} hidePrint hideSearch hideNavigation disabled={isleniyor} />
      {!yetki.yukleniyor && !yetki.yonetebilir && <Alert variant="warning" className="py-2">{YETKI_YOK_MESAJI}</Alert>}
      <Card className="border shadow-xs mb-3">
        <Card.Body className="py-2">
          <Row className="g-2 align-items-end">
            <Col xs={6} md={2}><Form.Label className="small mb-1">Sayım no</Form.Label><Form.Control size="sm" readOnly value={fis?.sayimNo || "(yeni)"} /></Col>
            <Col xs={6} md={2}><Form.Label className="small mb-1">Sayım anı</Form.Label>
              <Form.Control size="sm" type="datetime-local" aria-label="Sayım anı" value={tarih} disabled={onayli} onChange={(e) => setTarih(e.target.value)} /></Col>
            <Col xs={6} md={2}><Form.Label className="small mb-1">Grup</Form.Label>
              <Form.Select size="sm" aria-label="Grup" value={grupId ?? ""} disabled={onayli} onChange={(e) => setGrupId(e.target.value ? Number(e.target.value) : null)}>
                <option value="">Tüm gruplar</option>{gruplar.map((g) => <option key={g.stokGrupId} value={g.stokGrupId}>{g.ad}</option>)}
              </Form.Select></Col>
            <Col xs={6} md={3}><Form.Label className="small mb-1">Açıklama</Form.Label><Form.Control size="sm" aria-label="Açıklama" value={aciklama} disabled={onayli} onChange={(e) => setAciklama(e.target.value)} /></Col>
            <Col xs={12} md={3} className="d-flex gap-2 justify-content-md-end">
              <Button size="sm" variant="outline-secondary" disabled={onayli || yukleniyor} onClick={() => listeGetir(grupId, tarih, girdi(), fis?.sayimId, false)}>Listeyi getir</Button>
              <Button size="sm" variant="outline-secondary" onClick={listeAc}><IconListSearch size={15} className="me-1" />Sayımlar</Button>
            </Col>
          </Row>
          <div className="d-flex flex-wrap align-items-center gap-3 mt-2">
            {fis ? (onayli ? <Badge bg="success">Onaylandı · {fis.onaylayan}</Badge> : <Badge bg="warning" text="dark">Taslak (stok değişmedi)</Badge>) : <Badge bg="secondary">Yeni</Badge>}
            <span className="small text-muted">{ozet.sayilan} / {ozet.toplam} kalem sayıldı · <span className="text-success">{ozet.fazla} fazla</span> · <span className="text-danger">{ozet.eksik} eksik</span></span>
            {!onayli && <Form.Check type="checkbox" id="sifir" className="small ms-auto" label="Sayılmayanlar sıfır sayılsın" checked={sifir} onChange={(e) => setSifir(e.target.checked)} />}
            {!onayli && <Button size="sm" variant="success" disabled={isleniyor || !yetki.yonetebilir} onClick={onayla}><IconClipboardCheck size={15} className="me-1" />Onayla</Button>}
            {onayli && <Button size="sm" variant="outline-danger" className="ms-auto" disabled={isleniyor || !yetki.yonetebilir} onClick={() => geriAl()}><IconRotate size={15} className="me-1" />Onayı geri al</Button>}
          </div>
        </Card.Body>
      </Card>
      <Card className="border shadow-xs">
        <Card.Header className="py-2 d-flex flex-wrap gap-2 align-items-center">
          <InputGroup size="sm" style={{ maxWidth: 360 }}>
            <InputGroup.Text><IconBarcode size={16} /></InputGroup.Text>
            <Form.Control ref={okutRef} aria-label="Barkod okut" placeholder="Barkod / kod okutun (3*barkod)" value={okut} disabled={onayli}
              onChange={(e) => setOkut(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void okutuldu(); } }} autoFocus />
          </InputGroup>
          <Form.Control size="sm" style={{ maxWidth: 220 }} aria-label="Listede ara" placeholder="Listede ara" value={arama} onChange={(e) => setArama(e.target.value)} />
          <Form.Select size="sm" style={{ maxWidth: 200 }} aria-label="Süzgeç" value={suzgec} onChange={(e) => setSuzgec(e.target.value as any)}>
            <option value="hepsi">Hepsi</option><option value="sayilan">Sayılanlar</option><option value="sayilmayan">Sayılmayanlar</option><option value="fark">Farkı olanlar</option>
          </Form.Select>
          {yukleniyor && <Spinner size="sm" />}
        </Card.Header>
        <Table size="sm" hover responsive className="mb-0 small align-middle">
          <thead><tr><th>Kod</th><th>Ürün</th><th>Grup</th><th>Birim</th><th className="text-end">Sistem</th><th style={{ width: 140 }} className="text-end">Sayılan</th><th className="text-end">Fark</th></tr></thead>
          <tbody>
            {gorunen.map((x) => {
              const f = fark(x);
              return (
                <tr key={x.stokKartId} id={`sayim-${x.stokKartId}`} className={vurgu === x.stokKartId ? "table-info" : ""}>
                  <td className="text-muted">{x.kod}</td><td>{x.ad}</td><td className="text-muted">{x.grup}</td><td>{x.birim}</td>
                  <td className="text-end">{miktarYaz(x.sistem)}</td>
                  <td className="text-end">
                    <Form.Control size="sm" className="text-end" aria-label={`${x.ad} sayılan`} value={x.sayilan} disabled={onayli} inputMode="decimal"
                      onChange={(e) => { const v = e.target.value; setSatirlar((p) => p.map((y) => (y.stokKartId === x.stokKartId ? { ...y, sayilan: v } : y))); }} />
                  </td>
                  <td className={`text-end fw-semibold ${f && f > 0 ? "text-success" : f && f < 0 ? "text-danger" : "text-muted"}`}>{f === null ? "" : f > 0 ? `+${miktarYaz(f)}` : miktarYaz(f)}</td>
                </tr>
              );
            })}
            {!gorunen.length && <tr><td colSpan={7} className="text-center text-muted py-3">Gösterilecek kalem yok.</td></tr>}
          </tbody>
        </Table>
      </Card>
      <StokKartSecici show={secici.acik} aramaMetni={secici.arama} onHide={() => setSecici({ acik: false, arama: "" })}
        onSelect={(k) => { ekle(k.stokKartId, 1, { kod: k.kod, ad: k.ad, birim: k.birim, grup: k.grupAdi || "", sistem: k.bakiye ?? 0 }); setSecici({ acik: false, arama: "" }); setOkut(""); setTimeout(() => okutRef.current?.focus(), 50); }} />
      <LookupModal<SayimListeSatiri> show={!!liste} onHide={() => setListe(null)} title="Kayıtlı sayımlar" items={liste || []}
        columns={[
          { header: "No", render: (x) => x.sayimNo },
          { header: "Tarih", render: (x) => new Date(x.tarih).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" }) },
          { header: "Grup", render: (x) => x.grup || "Tümü" },
          { header: "Kalem", align: "right", render: (x) => `${x.kalem}${x.durum === 1 ? ` (${x.farkliKalem} farklı)` : ""}` },
          { header: "Durum", render: (x) => (x.durum === 1 ? <Badge bg="success">Onaylı</Badge> : <Badge bg="warning" text="dark">Taslak</Badge>) },
        ]}
        filterFn={(x, t) => `${x.sayimNo} ${x.aciklama || ""} ${x.grup}`.toLocaleLowerCase("tr-TR").includes(t.toLocaleLowerCase("tr-TR"))}
        onSelect={(x) => { setListe(null); if (vazgecilsinMi()) navigate(`/ticari/sayim-fisi?id=${x.sayimId}`); }} />
    </div>
  );
};

export default TicariSayimFisiPage;
