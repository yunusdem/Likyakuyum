import React, { useEffect, useRef, useState } from "react";
import { Alert, Badge, Button, Col, Form, InputGroup, Modal, Row, Spinner } from "react-bootstrap";
import { IconBarcode, IconDeviceFloppy, IconPhoto, IconPlus, IconTrash, IconX } from "@tabler/icons-react";
import { useToast } from "../../context/ToastContext";
import { ProductDefinitionService, ProductItem } from "../../services/productDefinitionService";
import { BIRIM_SECENEKLERI, KDV_SECENEKLERI, STOK_KONTROL_SECENEKLERI, StokGrup, StokKart, StokKartGirdi, TicariService, dosyaOku, miktarYaz } from "../../services/ticariService";
import { CariKartItem, CariService } from "../../services/cariService";
import { LookupModal } from "../../components/common/LookupModal";
import { tartiBirimi } from "../../../Backend/src/services/ticari/ticariHesap";
import { StokKartSecici } from "./StokKartSecici";

interface Props {
  show: boolean;
  /** Düzeltilecek kartın kimliği; yoksa yeni kart */
  stokKartId?: number | null;
  /** Yeni kartta önceden doldurulacak barkod / ad (satış fişinde bulunamayan barkod) */
  onBarkod?: string;
  onAd?: string;
  onHide: () => void;
  onSaved: (kart: StokKart) => void;
}

const bos: StokKartGirdi = { ad: "", kod: "", birim: "Adet", kdvOrani: 20, satisFiyati: "", fiyatKdvDahil: true, paraId: null, alisFiyati: "", enAzStok: "", aktif: true, aciklama: "", barkodlar: [], stokGrupId: null, stokKontrol: "", teraziKodu: "", sktTakibi: false, receteli: false, adisyonKdvOrani: "" };
/** Reçete satırı (TA18): malzeme + 1 birim ürün için miktar; maliyet tahmini için malzemenin son alışı */
type ReceteSatir = { malzemeKartId: number; kod: string; ad: string; birim: string; miktar: string; alis: number | null };

const metin = (v: number | null | undefined) => (v === null || v === undefined ? "" : String(v).replace(".", ","));

/** Stok kartı ekleme / düzeltme penceresi (T5). Yalnız ürün adı zorunlu; kod boşsa otomatik verilir. */
export const StokKartModal: React.FC<Props> = ({ show, stokKartId, onBarkod, onAd, onHide, onSaved }) => {
  const { showSuccess, showError } = useToast();
  const [g, setG] = useState<StokKartGirdi>(bos);
  const [kart, setKart] = useState<StokKart | null>(null);
  const [gruplar, setGruplar] = useState<StokGrup[]>([]);
  const [paralar, setParalar] = useState<ProductItem[]>([]);
  const [barkod, setBarkod] = useState("");
  const [yeniGrup, setYeniGrup] = useState<string | null>(null);
  const [resim, setResim] = useState<string | null | undefined>(undefined);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [kaydediliyor, setKaydediliyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const adRef = useRef<HTMLInputElement | null>(null);
  // İş 11: tanımlı fiyat listelerindeki fiyatlar (metin) ve tedarikçi
  const [listeFiyatlari, setListeFiyatlari] = useState<{ fiyatListesiId: number; ad: string; fiyat: string }[]>([]);
  const [tedarikci, setTedarikci] = useState<{ id: number; ad: string } | null>(null);
  const [cariSecici, setCariSecici] = useState(false);
  const [cariler, setCariler] = useState<CariKartItem[] | null>(null);
  // TA5: ek birimler (Koli = 12 Adet); metin olarak tutulur
  const [birimler, setBirimler] = useState<{ birim: string; carpan: string; satisFiyati: string; barkodlar: string[]; yeniBarkod: string }[]>([]);
  const birimDegis = (i: number, d: Partial<(typeof birimler)[number]>) => setBirimler((p) => p.map((x, j) => (j === i ? { ...x, ...d } : x)));
  const [recete, setRecete] = useState<ReceteSatir[]>([]);
  const [malzemeSecici, setMalzemeSecici] = useState(false);
  const birimBarkodEkle = (i: number) => {
    const b = (birimler[i]?.yeniBarkod || "").trim();
    if (!b) return;
    if (/\s/.test(b)) { setHata("Barkod boşluk içeremez."); return; }
    if (birimler[i].barkodlar.includes(b)) { birimDegis(i, { yeniBarkod: "" }); return; }
    birimDegis(i, { barkodlar: [...birimler[i].barkodlar, b], yeniBarkod: "" });
  };

  useEffect(() => {
    if (!show) return;
    setHata(null); setBarkod(""); setYeniGrup(null); setResim(undefined);
    TicariService.gruplar().then(setGruplar).catch(() => setGruplar([]));
    ProductDefinitionService.getProducts().then((l) => setParalar((l || []).filter((p) => Number(p.urunTipi) === 0))).catch(() => setParalar([]));
    setTedarikci(null);
    setListeFiyatlari([]);
    setBirimler([]);
    setRecete([]);
    if (stokKartId) {
      setYukleniyor(true);
      TicariService.kart(stokKartId)
        .then((k) => {
          setKart(k);
          setTedarikci(k.tedarikciCariId ? { id: k.tedarikciCariId, ad: k.tedarikciAd || String(k.tedarikciCariId) } : null);
          setBirimler((k.birimler || []).map((b) => ({ birim: b.birim, carpan: metin(b.carpan), satisFiyati: metin(b.satisFiyati), barkodlar: b.barkodlar || [], yeniBarkod: "" })));
          setListeFiyatlari((k.listeFiyatlari || []).map((l) => ({ fiyatListesiId: l.fiyatListesiId, ad: l.ad, fiyat: metin(l.fiyat) })));
          setG({
            stokKartId: k.stokKartId, kod: k.kod, ad: k.ad, stokGrupId: k.stokGrupId, birim: k.birim, kdvOrani: k.kdvOrani,
            satisFiyati: metin(k.satisFiyati), fiyatKdvDahil: k.fiyatKdvDahil, paraId: k.paraId, alisFiyati: metin(k.alisFiyati),
            enAzStok: metin(k.enAzStok), aktif: k.aktif, aciklama: k.aciklama || "", barkodlar: k.barkodlar, stokKontrol: k.stokKontrol || "",
            teraziKodu: k.teraziKodu ? String(k.teraziKodu) : "",
            sktTakibi: !!k.sktTakibi,
            receteli: !!k.receteli,
            adisyonKdvOrani: k.adisyonKdvOrani === null || k.adisyonKdvOrani === undefined ? "" : String(k.adisyonKdvOrani),
          });
          setRecete((k.recete || []).map((r) => ({ malzemeKartId: r.malzemeKartId, kod: r.kod, ad: r.ad, birim: r.birim, miktar: metin(r.miktar), alis: null })));
          setResim(k.resim ?? null);
        })
        .catch((e) => setHata(e?.message || "Kart okunamadı."))
        .finally(() => setYukleniyor(false));
    } else {
      setKart(null);
      setG({ ...bos, ad: onAd || "", barkodlar: onBarkod ? [onBarkod.trim()] : [] });
      setResim(null);
      TicariService.fiyatListeleri(true).then((l) => setListeFiyatlari(l.map((x) => ({ fiyatListesiId: x.fiyatListesiId, ad: x.ad, fiyat: "" })))).catch(() => undefined);
    }
    setTimeout(() => adRef.current?.focus(), 150);
  }, [show, stokKartId, onBarkod, onAd]);

  const alan = <K extends keyof StokKartGirdi>(k: K, v: StokKartGirdi[K]) => setG((p) => ({ ...p, [k]: v }));

  const barkodEkle = () => {
    const b = barkod.trim();
    if (!b) return;
    if (/\s/.test(b)) { setHata("Barkod boşluk içeremez."); return; }
    if ((g.barkodlar || []).includes(b)) { setBarkod(""); return; }
    alan("barkodlar", [...(g.barkodlar || []), b]);
    setBarkod("");
  };

  const grupEkle = async () => {
    const ad = (yeniGrup || "").trim();
    if (!ad) return;
    try {
      const yeni = await TicariService.grupKaydet({ ad });
      setGruplar(await TicariService.gruplar());
      alan("stokGrupId", yeni.stokGrupId);
      setYeniGrup(null);
    } catch (e: any) {
      setHata(e?.message || "Grup eklenemedi.");
    }
  };

  const resimSec = async (f?: File | null) => {
    if (!f) return;
    if (!f.type.startsWith("image/")) { setHata("Yalnız resim dosyası seçilebilir."); return; }
    if (f.size > 3 * 1024 * 1024) { setHata("Resim 3 MB'tan büyük olamaz."); return; }
    setResim(await dosyaOku(f));
  };

  const kaydet = async () => {
    if (!String(g.ad || "").trim()) { setHata("Ürün adı zorunlu."); adRef.current?.focus(); return; }
    setKaydediliyor(true);
    setHata(null);
    try {
      const girdi: StokKartGirdi = {
        ...g, barkodlar: [...(g.barkodlar || []), ...(barkod.trim() ? [barkod.trim()] : [])],
        tedarikciCariId: tedarikci?.id ?? null,
        // Ek birimler (TA5): satırdaki yazılmamış barkod da eklenir
        birimler: birimler.map((b) => ({ birim: b.birim.trim(), carpan: b.carpan, satisFiyati: b.satisFiyati.trim() === "" ? null : b.satisFiyati, barkodlar: [...b.barkodlar, ...(b.yeniBarkod.trim() ? [b.yeniBarkod.trim()] : [])] })),
        // Terazi kodu yalnız Kg / Gr birimli kartta (TA3); birim değiştiyse temizlenir
        teraziKodu: tartiBirimi(g.birim) ? String(g.teraziKodu ?? "").trim() || null : null,
        listeFiyatlari: listeFiyatlari.map((l) => ({ fiyatListesiId: l.fiyatListesiId, fiyat: l.fiyat.trim() === "" ? null : l.fiyat })),
        // Reçete (TA18): reçeteli değilse boş liste gider (sunucu reçeteyi siler)
        receteli: !!g.receteli,
        recete: g.receteli ? recete.map((r) => ({ malzemeKartId: r.malzemeKartId, miktar: r.miktar })) : [],
      };
      // Resim değişmediyse gönderilmez (sunucu dokunmaz)
      if (resim !== undefined && resim !== (kart?.resim ?? null)) girdi.resim = resim;
      const k = await TicariService.kartKaydet(girdi);
      showSuccess(`${k.kod} ${k.ad} kaydedildi.`);
      onSaved(k);
    } catch (e: any) {
      setHata(e?.message || "Kart kaydedilemedi.");
      showError(e?.message || "Kart kaydedilemedi.");
    } finally {
      setKaydediliyor(false);
    }
  };

  return (
    <Modal show={show} onHide={onHide} size="lg" centered backdrop="static"
      onKeyDown={(e: React.KeyboardEvent) => { if (e.key === "F1") { e.preventDefault(); void kaydet(); } }}>
      <Modal.Header closeButton className="bg-light py-2">
        <Modal.Title className="fs-6 fw-bold">{stokKartId ? `Stok Kartı Düzeltme — ${kart?.kod || ""}` : "Yeni Stok Kartı"}</Modal.Title>
      </Modal.Header>
      <Modal.Body className="p-3">
        {hata && <Alert variant="danger" className="py-2" onClose={() => setHata(null)} dismissible>{hata}</Alert>}
        {yukleniyor ? <div className="text-center py-4"><Spinner size="sm" className="me-2" />Yükleniyor...</div> : (
          <Row className="g-2">
            <Col md={8}>
              <Row className="g-2">
                <Col md={4}>
                  <Form.Label className="small fw-bold mb-1">Kod</Form.Label>
                  <Form.Control size="sm" value={g.kod || ""} maxLength={30} placeholder="Boşsa otomatik" onChange={(e) => alan("kod", e.target.value.toLocaleUpperCase("tr-TR"))} />
                </Col>
                <Col md={8}>
                  <Form.Label className="small fw-bold mb-1">Ürün Adı <span className="text-danger">*</span></Form.Label>
                  <Form.Control size="sm" ref={adRef} value={g.ad} maxLength={200} onChange={(e) => alan("ad", e.target.value)} />
                </Col>
                <Col md={6}>
                  <Form.Label className="small fw-bold mb-1">Ürün Grubu</Form.Label>
                  {yeniGrup === null ? (
                    <InputGroup size="sm">
                      <Form.Select value={g.stokGrupId ?? ""} onChange={(e) => alan("stokGrupId", e.target.value ? Number(e.target.value) : null)}>
                        <option value="">(Grup yok)</option>
                        {gruplar.filter((x) => x.aktif || x.stokGrupId === g.stokGrupId).map((x) => <option key={x.stokGrupId} value={x.stokGrupId}>{x.ad}</option>)}
                      </Form.Select>
                      <Button variant="outline-primary" title="Yeni grup" onClick={() => setYeniGrup("")}><IconPlus size={14} /></Button>
                    </InputGroup>
                  ) : (
                    <InputGroup size="sm">
                      <Form.Control autoFocus value={yeniGrup} placeholder="Yeni grup adı" maxLength={100} onChange={(e) => setYeniGrup(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void grupEkle(); } if (e.key === "Escape") setYeniGrup(null); }} />
                      <Button variant="primary" onClick={grupEkle}>Ekle</Button>
                      <Button variant="outline-secondary" onClick={() => setYeniGrup(null)}><IconX size={14} /></Button>
                    </InputGroup>
                  )}
                </Col>
                <Col md={3}>
                  <Form.Label className="small fw-bold mb-1">Birim</Form.Label>
                  <Form.Select size="sm" value={g.birim || "Adet"} onChange={(e) => alan("birim", e.target.value)}>
                    {BIRIM_SECENEKLERI.map((b) => <option key={b}>{b}</option>)}
                  </Form.Select>
                </Col>
                <Col md={3}>
                  <Form.Label className="small fw-bold mb-1">KDV %</Form.Label>
                  <Form.Select size="sm" value={String(g.kdvOrani ?? 20)} onChange={(e) => alan("kdvOrani", Number(e.target.value))}>
                    {[...new Set([...KDV_SECENEKLERI, Number(g.kdvOrani ?? 20)])].sort((a, b) => a - b).map((k) => <option key={k} value={k}>%{k}</option>)}
                  </Form.Select>
                </Col>
                <Col md={4}>
                  <Form.Label className="small fw-bold mb-1">Satış Fiyatı</Form.Label>
                  <Form.Control size="sm" className="text-end" inputMode="decimal" value={String(g.satisFiyati ?? "")} placeholder="0,00"
                    onChange={(e) => alan("satisFiyati", e.target.value.replace(/[^0-9.,]/g, ""))} />
                </Col>
                <Col md={4} className="d-flex align-items-end">
                  <Form.Check type="switch" id="kdvDahil" className="mb-1" label="Fiyat KDV dahil" checked={!!g.fiyatKdvDahil} onChange={(e) => alan("fiyatKdvDahil", e.target.checked)} />
                </Col>
                <Col md={4}>
                  <Form.Label className="small fw-bold mb-1">Para Birimi</Form.Label>
                  <Form.Select size="sm" value={g.paraId ?? ""} onChange={(e) => alan("paraId", e.target.value ? Number(e.target.value) : null)}>
                    <option value="">TL</option>
                    {paralar.filter((p) => !["TL", "TRY"].includes(String(p.kod).trim().toUpperCase())).map((p) => <option key={p.id} value={p.id}>{String(p.kod).trim()}</option>)}
                  </Form.Select>
                </Col>
                <Col md={4}>
                  <Form.Label className="small fw-bold mb-1">Alış Fiyatı (KDV hariç)</Form.Label>
                  <Form.Control size="sm" className="text-end" inputMode="decimal" value={String(g.alisFiyati ?? "")} placeholder="0,00"
                    onChange={(e) => alan("alisFiyati", e.target.value.replace(/[^0-9.,]/g, ""))} />
                </Col>
                <Col md={4}>
                  <Form.Label className="small fw-bold mb-1">En Az Stok</Form.Label>
                  <Form.Control size="sm" className="text-end" inputMode="decimal" value={String(g.enAzStok ?? "")}
                    onChange={(e) => alan("enAzStok", e.target.value.replace(/[^0-9.,]/g, ""))} />
                </Col>
                <Col md={4} className="d-flex align-items-end">
                  <Form.Check type="switch" id="aktif" className="mb-1" label="Aktif (satışta seçilebilir)" checked={!!g.aktif} onChange={(e) => alan("aktif", e.target.checked)} />
                </Col>
                <Col md={12}>
                  {/* SKT takibi (docs/TICARI_ADISYON_YOL_HARITASI.md, TA16) */}
                  <Form.Check type="switch" id="sktTakibi" className="mb-1" label="SKT takibi (stok girişinde son kullanma tarihi zorunlu)" checked={!!g.sktTakibi} onChange={(e) => alan("sktTakibi", e.target.checked)} />
                  {/* Reçeteli ürün (TA18) */}
                  <Form.Check type="switch" id="receteli" className="mb-1" label="Reçeteli ürün (menü ürünü: stok tutmaz, satılınca malzemeleri düşer)" checked={!!g.receteli} onChange={(e) => alan("receteli", e.target.checked)} />
                </Col>
                {g.receteli && (
                  <Col md={12}>
                    <div className="border rounded p-2" aria-label="Reçete">
                      <div className="d-flex align-items-center mb-1">
                        <span className="small fw-bold me-auto">Reçete <span className="text-muted fw-normal">(1 {g.birim || "Adet"} için malzeme miktarı, malzemenin biriminde)</span></span>
                        <Button size="sm" variant="outline-primary" onClick={() => setMalzemeSecici(true)}><IconPlus size={13} className="me-1" />Malzeme ekle</Button>
                      </div>
                      {recete.map((r, i) => (
                        <div key={r.malzemeKartId} className="d-flex align-items-center gap-2 py-1 border-top">
                          <span className="small flex-grow-1"><b>{r.ad}</b> <span className="text-muted">{r.kod}</span></span>
                          <InputGroup size="sm" style={{ width: 160 }}>
                            <Form.Control className="text-end" inputMode="decimal" aria-label={`${r.ad} reçete miktarı`} value={r.miktar}
                              onChange={(e) => setRecete((p) => p.map((x, j) => (j === i ? { ...x, miktar: e.target.value.replace(/[^0-9.,]/g, "") } : x)))} />
                            <InputGroup.Text>{r.birim}</InputGroup.Text>
                          </InputGroup>
                          <Button variant="link" size="sm" className="text-danger p-1" aria-label={`${r.ad} reçeteden çıkar`} onClick={() => setRecete((p) => p.filter((_, j) => j !== i))}><IconTrash size={14} /></Button>
                        </div>
                      ))}
                      {!recete.length && <div className="small text-danger border-top pt-1">Reçeteli üründe en az bir malzeme olmalı.</div>}
                      {recete.length > 0 && recete.every((r) => r.alis !== null) && (
                        <div className="small text-muted border-top pt-1 text-end">Tahmini reçete maliyeti (son alış): <b>{metin(Math.round(recete.reduce((t, r) => t + Number(String(r.miktar).replace(",", ".") || 0) * (r.alis || 0), 0) * 100) / 100)} TL</b></div>
                      )}
                    </div>
                  </Col>
                )}
                <Col md={6}>
                  {/* Adisyon (masa) KDV oranı (docs/TICARI_ADISYON_YOL_HARITASI.md, TA32): örn. tezgahta %1 et, masada %10 */}
                  <Form.Label className="small fw-bold mb-1">Adisyon (masa) KDV oranı</Form.Label>
                  <Form.Select size="sm" aria-label="Adisyon KDV oranı" value={String(g.adisyonKdvOrani ?? "")} onChange={(e) => alan("adisyonKdvOrani", e.target.value)}>
                    <option value="">Adisyon ayarındaki varsayılan</option>
                    {KDV_SECENEKLERI.map((k) => <option key={k} value={k}>%{k}</option>)}
                  </Form.Select>
                </Col>
                <Col md={6}>
                  <Form.Label className="small fw-bold mb-1">Stok kontrol (eksiye düşünce)</Form.Label>
                  <Form.Select size="sm" value={g.stokKontrol || ""} onChange={(e) => alan("stokKontrol", e.target.value || "")}>
                    {STOK_KONTROL_SECENEKLERI.map((s) => <option key={s.kod} value={s.kod}>{s.ad}</option>)}
                  </Form.Select>
                </Col>
                {tartiBirimi(g.birim) && (
                  <Col md={6}>
                    <Form.Label className="small fw-bold mb-1">Terazi kodu (PLU)</Form.Label>
                    <Form.Control size="sm" inputMode="numeric" maxLength={6} value={String(g.teraziKodu ?? "")} placeholder="Terazide bu ürünün kodu"
                      title="Terazinin bastığı etiketteki ürün kodu; etiket okutulunca bu kart bulunur, kilo / tutar etiketten gelir"
                      onChange={(e) => alan("teraziKodu", e.target.value.replace(/\D/g, ""))} />
                  </Col>
                )}
                <Col md={12}>
                  <Form.Label className="small fw-bold mb-1">Barkodlar</Form.Label>
                  <InputGroup size="sm">
                    <InputGroup.Text className="bg-light"><IconBarcode size={15} /></InputGroup.Text>
                    <Form.Control value={barkod} maxLength={50} placeholder="Barkodu okutun ya da yazın, Enter ile ekleyin"
                      onChange={(e) => setBarkod(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); barkodEkle(); } }} />
                    <Button variant="outline-primary" onClick={barkodEkle}><IconPlus size={14} /></Button>
                  </InputGroup>
                  <div className="d-flex flex-wrap gap-1 mt-1">
                    {(g.barkodlar || []).map((b) => (
                      <Badge key={b} bg="light" text="dark" className="border font-monospace d-flex align-items-center gap-1">
                        {b}
                        <IconX size={12} role="button" onClick={() => alan("barkodlar", (g.barkodlar || []).filter((x) => x !== b))} />
                      </Badge>
                    ))}
                  </div>
                </Col>
                <Col md={12}>
                  <Form.Label className="small fw-bold mb-1">Ek birimler <span className="text-muted fw-normal">(koli / paket barkodu; stok {g.birim || "Adet"} olarak tutulur)</span></Form.Label>
                  {birimler.map((b, i) => (
                    <div key={i} className="border rounded p-2 mb-1 bg-light">
                      <div className="d-flex flex-wrap align-items-center gap-1 small">
                        <span>1</span>
                        <Form.Control size="sm" style={{ width: 90 }} list="ek-birim-adlari" value={b.birim} maxLength={20} placeholder="Koli" aria-label="Ek birim adı" onChange={(e) => birimDegis(i, { birim: e.target.value })} />
                        <span>=</span>
                        <Form.Control size="sm" style={{ width: 70 }} className="text-end" inputMode="decimal" value={b.carpan} placeholder="12" aria-label="Çarpan" onChange={(e) => birimDegis(i, { carpan: e.target.value.replace(/[^0-9.,]/g, "") })} />
                        <span>{g.birim || "Adet"} · Fiyat</span>
                        <Form.Control size="sm" style={{ width: 95 }} className="text-end" inputMode="decimal" value={b.satisFiyati} aria-label="Ek birim fiyatı"
                          placeholder={(() => { const c = Number(b.carpan.replace(",", ".")); const f = Number(String(g.satisFiyati ?? "").replace(",", ".")); return c > 0 && f > 0 ? (c * f).toLocaleString("tr-TR", { maximumFractionDigits: 2 }) : "boş = çarpan × fiyat"; })()}
                          onChange={(e) => birimDegis(i, { satisFiyati: e.target.value.replace(/[^0-9.,]/g, "") })} />
                        <InputGroup size="sm" style={{ width: 210 }}>
                          <Form.Control value={b.yeniBarkod} maxLength={50} placeholder="Koli barkodu" aria-label="Ek birim barkodu" onChange={(e) => birimDegis(i, { yeniBarkod: e.target.value })}
                            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); birimBarkodEkle(i); } }} />
                          <Button variant="outline-primary" onClick={() => birimBarkodEkle(i)} aria-label="Barkodu ekle"><IconPlus size={12} /></Button>
                        </InputGroup>
                        <Button variant="link" size="sm" className="text-danger p-1 ms-auto" title="Birimi kaldır" aria-label={`${b.birim || "Birim"} kaldır`} onClick={() => setBirimler((p) => p.filter((_, j) => j !== i))}><IconTrash size={14} /></Button>
                      </div>
                      {b.barkodlar.length > 0 && (
                        <div className="d-flex flex-wrap gap-1 mt-1">
                          {b.barkodlar.map((x) => (
                            <Badge key={x} bg="light" text="dark" className="border font-monospace d-flex align-items-center gap-1">{x}<IconX size={12} role="button" onClick={() => birimDegis(i, { barkodlar: b.barkodlar.filter((y) => y !== x) })} /></Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                  <datalist id="ek-birim-adlari"><option value="Koli" /><option value="Paket" /><option value="Kutu" /><option value="Deste" /><option value="Düzine" /><option value="Kasa" /></datalist>
                  <Button variant="outline-secondary" size="sm" disabled={birimler.length >= 5} onClick={() => setBirimler((p) => [...p, { birim: "Koli", carpan: "", satisFiyati: "", barkodlar: [], yeniBarkod: "" }])}>
                    <IconPlus size={12} className="me-1" />Birim ekle
                  </Button>
                </Col>
                <Col md={12}>
                  <Form.Label className="small fw-bold mb-1">Tedarikçi</Form.Label>
                  <InputGroup size="sm">
                    <Form.Control readOnly value={tedarikci ? tedarikci.ad : ""} placeholder="Seçilmedi (son stok girişindeki cari olur)" style={{ cursor: "pointer" }}
                      onClick={async () => { if (!cariler) { try { setCariler(await CariService.getCariKartlar()); } catch { setCariler([]); } } setCariSecici(true); }} />
                    {tedarikci && <Button variant="outline-secondary" title="Kaldır" onClick={() => setTedarikci(null)}><IconX size={14} /></Button>}
                    <Button variant="outline-primary" title="Cari seç" onClick={async () => { if (!cariler) { try { setCariler(await CariService.getCariKartlar()); } catch { setCariler([]); } } setCariSecici(true); }}>Seç</Button>
                  </InputGroup>
                </Col>
                {listeFiyatlari.length > 0 && (
                  <Col md={12}>
                    <Form.Label className="small fw-bold mb-1">Fiyat listeleri <span className="text-muted fw-normal">(boş: ana satış fiyatı geçerli; kartın para birimi ve KDV dahil işaretiyle)</span></Form.Label>
                    <div className="d-flex flex-wrap gap-2">
                      {listeFiyatlari.map((l) => (
                        <InputGroup size="sm" key={l.fiyatListesiId} style={{ width: 200 }}>
                          <InputGroup.Text className="bg-light small">{l.ad}</InputGroup.Text>
                          <Form.Control className="text-end" inputMode="decimal" placeholder="ana fiyat" value={l.fiyat} aria-label={`${l.ad} fiyatı`}
                            onChange={(e) => setListeFiyatlari((p) => p.map((x) => (x.fiyatListesiId === l.fiyatListesiId ? { ...x, fiyat: e.target.value.replace(/[^0-9.,]/g, "") } : x)))} />
                        </InputGroup>
                      ))}
                    </div>
                  </Col>
                )}
                <Col md={12}>
                  <Form.Label className="small fw-bold mb-1">Açıklama</Form.Label>
                  <Form.Control size="sm" as="textarea" rows={2} maxLength={500} value={g.aciklama || ""} onChange={(e) => alan("aciklama", e.target.value)} />
                </Col>
              </Row>
            </Col>
            <Col md={4}>
              <Form.Label className="small fw-bold mb-1">Resim</Form.Label>
              <div className="border rounded d-flex align-items-center justify-content-center bg-light" style={{ height: 180 }}>
                {resim ? <img src={resim} alt="" style={{ maxWidth: "100%", maxHeight: 176, objectFit: "contain" }} /> : <IconPhoto size={48} className="text-muted" />}
              </div>
              <div className="d-flex gap-1 mt-1">
                <Form.Label className="btn btn-sm btn-outline-primary mb-0 flex-grow-1">
                  Resim seç
                  <Form.Control type="file" accept="image/*" hidden onChange={(e) => resimSec((e.target as HTMLInputElement).files?.[0])} />
                </Form.Label>
                {resim && <Button size="sm" variant="outline-danger" title="Resmi kaldır" onClick={() => setResim(null)}><IconTrash size={14} /></Button>}
              </div>
              {kart && (
                <div className="mt-3 small border rounded p-2 bg-light">
                  <div className="d-flex justify-content-between"><span className="text-muted">Stok</span><b>{miktarYaz(kart.bakiye)} {kart.birim}</b></div>
                  <div className="d-flex justify-content-between"><span className="text-muted">Son alış</span><b>{kart.sonAlisFiyati !== null ? metin(kart.sonAlisFiyati) : "—"}</b></div>
                </div>
              )}
            </Col>
          </Row>
        )}
      </Modal.Body>
      <LookupModal<CariKartItem>
        show={cariSecici} onHide={() => setCariSecici(false)} title="Tedarikçi Cari Seç" items={cariler || []} isLoading={!cariler}
        searchPlaceholder="Kod, ünvan ya da vergi no..."
        columns={[
          { header: "Kod", width: "110px", render: (c) => <span className="font-monospace">{c.kod}</span>, highlight: true },
          { header: "Ünvan", render: (c) => c.ad, highlight: true },
          { header: "Vergi / TC No", width: "130px", render: (c) => c.vergiKimlikNo || "" },
        ]}
        filterFn={(c, t) => { const a = t.toLocaleLowerCase("tr-TR"); return String(c.kod || "").toLocaleLowerCase("tr-TR").includes(a) || String(c.ad || "").toLocaleLowerCase("tr-TR").includes(a) || String(c.vergiKimlikNo || "").includes(t); }}
        onSelect={(c) => { setTedarikci({ id: c.id, ad: c.ad }); setCariSecici(false); }} selectOnDoubleClick />
      <StokKartSecici show={malzemeSecici} onHide={() => setMalzemeSecici(false)}
        onSelect={(k: StokKart) => {
          if (k.receteli) showError(`${k.ad} reçeteli bir ürün; malzeme olamaz.`);
          else if (stokKartId && k.stokKartId === stokKartId) showError("Ürünün kendisi kendi reçetesinde olamaz.");
          else if (recete.some((r) => r.malzemeKartId === k.stokKartId)) showError(`${k.ad} reçetede zaten var.`);
          else setRecete((p) => [...p, { malzemeKartId: k.stokKartId, kod: k.kod, ad: k.ad, birim: k.birim, miktar: "", alis: k.sonAlisFiyati ?? k.alisFiyati ?? null }]);
          setMalzemeSecici(false);
        }} />
      <Modal.Footer className="bg-light py-2">
        <span className="me-auto small text-muted">F1: Kaydet · Yalnız ürün adı zorunlu</span>
        <Button variant="outline-secondary" size="sm" onClick={onHide}>Vazgeç</Button>
        <Button variant="primary" size="sm" disabled={kaydediliyor || yukleniyor} onClick={kaydet}>
          {kaydediliyor ? <Spinner size="sm" className="me-1" /> : <IconDeviceFloppy size={15} className="me-1" />}Kaydet
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default StokKartModal;
