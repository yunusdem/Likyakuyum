import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Badge, Button, Card, Col, Form, InputGroup, Row, Spinner, Table } from "react-bootstrap";
import { IconBarcode, IconBinoculars, IconPackageImport, IconTrash, IconUser, IconX } from "@tabler/icons-react";
import { useLocation, useNavigate } from "react-router-dom";
import ERPToolbar from "../../components/common/ERPToolbar";
import { LookupModal } from "../../components/common/LookupModal";
import { useToast } from "../../context/ToastContext";
import { useAuth } from "../../context/AuthContext";
import { useKullaniciYetkisi } from "../../hooks/useKullaniciYetkisi";
import { CariKartItem, CariService } from "../../services/cariService";
import { KDV_SECENEKLERI, StokKart, TicariService, eksiStokUyarisiMi, miktarYaz, para } from "../../services/ticariService";
import { girisSatirHesapla, yuvarla2 } from "../../../Backend/src/services/ticari/ticariHesap";
import { StokKartSecici } from "./StokKartSecici";
import { StokKartModal } from "./StokKartModal";
import { YETKI_YOK_MESAJI, useTicariYetki } from "./useTicariYetki";

interface Satir {
  anahtar: string;
  stokKartId: number;
  kod: string;
  ad: string;
  birim: string;
  miktar: string;
  birimFiyat: string;
  kdvOrani: number;
}

const sayi = (v: string | number | null | undefined): number => {
  const t = String(v ?? "").trim();
  if (!t) return 0;
  const n = Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t);
  return Number.isFinite(n) ? n : 0;
};
const metin = (n: number | null | undefined) => (n === null || n === undefined ? "" : String(n).replace(".", ","));
const yerelTarih = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const yerelSaat = (d = new Date()) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
let sayac = 0;
const yeniAnahtar = () => `s${Date.now()}-${++sayac}`;

/** D- Stok Giriş Fişi (docs/TICARI_ISLEMLER_YOL_HARITASI.md, T9): ?id= ile açılırsa düzeltme */
export const StokGirisFisiPage: React.FC = () => {
  const { showSuccess, showError, showWarning } = useToast();
  const { user } = useAuth();
  const yetki = useTicariYetki();
  // Tarih değiştirme yetkisi yoksa yeni fiş bugünün tarihiyle, düzeltmede fişin tarihiyle kalır (docs/YETKI_VE_VEZNE_YOL_HARITASI.md)
  const tarihYetkisi = useKullaniciYetkisi().tarihDegistirme;
  const location = useLocation();
  const navigate = useNavigate();
  const id = Number(new URLSearchParams(location.search).get("id")) || null;

  const [fisNo, setFisNo] = useState("");
  const [tarih, setTarih] = useState(yerelTarih());
  const [saat, setSaat] = useState(yerelSaat());
  const [cari, setCari] = useState<{ id: number; kod: string; ad: string } | null>(null);
  const [belgeNo, setBelgeNo] = useState("");
  const [aciklama, setAciklama] = useState("");
  const [satirlar, setSatirlar] = useState<Satir[]>([]);
  const [okut, setOkut] = useState("");
  const [kartlar, setKartlar] = useState<StokKart[]>([]);
  const [cariler, setCariler] = useState<CariKartItem[]>([]);
  const [secici, setSecici] = useState<{ acik: boolean; arama: string }>({ acik: false, arama: "" });
  const [cariSecici, setCariSecici] = useState(false);
  const [yeniKart, setYeniKart] = useState<{ acik: boolean; barkod?: string }>({ acik: false });
  const [yukleniyor, setYukleniyor] = useState(false);
  const [kaydediliyor, setKaydediliyor] = useState(false);
  const okutRef = useRef<HTMLInputElement | null>(null);

  const kartlariYukle = useCallback(() => TicariService.kartlar().then(setKartlar).catch(() => setKartlar([])), []);

  const temizle = useCallback(async () => {
    setCari(null); setBelgeNo(""); setAciklama(""); setSatirlar([]); setOkut("");
    setTarih(yerelTarih()); setSaat(yerelSaat());
    setFisNo(await TicariService.girisSiraNo().catch(() => ""));
    setTimeout(() => okutRef.current?.focus(), 100);
  }, []);

  useEffect(() => {
    void kartlariYukle();
    CariService.getCariKartlar().then(setCariler).catch(() => setCariler([]));
  }, [kartlariYukle]);

  useEffect(() => {
    if (!id) { void temizle(); return; }
    setYukleniyor(true);
    TicariService.giris(id)
      .then((f) => {
        const d = new Date(f.tarih);
        setFisNo(f.fisNo); setTarih(yerelTarih(d)); setSaat(yerelSaat(d));
        setCari(f.cariKartId ? { id: f.cariKartId, kod: f.cariKod || "", ad: f.cariAd || "" } : null);
        setBelgeNo(f.belgeNo || ""); setAciklama(f.aciklama || "");
        setSatirlar((f.satirlar || []).map((s) => ({ anahtar: yeniAnahtar(), stokKartId: s.stokKartId, kod: s.kod || "", ad: s.ad || "", birim: s.birim || "",
          miktar: metin(s.miktar), birimFiyat: metin(s.birimFiyat), kdvOrani: s.kdvOrani })));
      })
      .catch((e) => showError(e?.message || "Fiş okunamadı."))
      .finally(() => setYukleniyor(false));
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const kartEkle = (k: StokKart, miktar = 1) => {
    setSatirlar((p) => {
      const var_ = p.find((s) => s.stokKartId === k.stokKartId);
      if (var_) return p.map((s) => (s === var_ ? { ...s, miktar: metin(yuvarla2(sayi(s.miktar) + miktar)) } : s));
      const fiyat = k.sonAlisFiyati ?? k.alisFiyati;
      return [...p, { anahtar: yeniAnahtar(), stokKartId: k.stokKartId, kod: k.kod, ad: k.ad, birim: k.birim, miktar: metin(miktar), birimFiyat: metin(fiyat), kdvOrani: k.kdvOrani }];
    });
  };

  const okutuldu = async () => {
    const d = okut.trim();
    if (!d) { setSecici({ acik: true, arama: "" }); return; }
    // "3*barkod" → 3 adet
    const m = d.match(/^(\d+(?:[.,]\d+)?)\s*\*\s*(.+)$/);
    const adet = m ? sayi(m[1]) : 1;
    const deger = m ? m[2].trim() : d;
    const k = kartlar.find((x) => x.kod === deger.toLocaleUpperCase("tr-TR") || x.barkodlar.includes(deger)) || (await TicariService.kartBul(deger));
    if (k) { kartEkle(k, adet); setOkut(""); return; }
    if (yetki.yonetebilir && window.confirm(`"${deger}" barkodlu ya da kodlu ürün yok. Yeni stok kartı açılsın mı?`)) setYeniKart({ acik: true, barkod: deger });
    else setSecici({ acik: true, arama: deger });
  };

  const hesap = useMemo(() => {
    const s = satirlar.map((x) => girisSatirHesapla(sayi(x.miktar), sayi(x.birimFiyat), x.kdvOrani));
    return { satirlar: s, ara: yuvarla2(s.reduce((a, x) => a + x.tutar, 0)), kdv: yuvarla2(s.reduce((a, x) => a + x.kdvTutari, 0)), genel: yuvarla2(s.reduce((a, x) => a + x.toplamTutar, 0)) };
  }, [satirlar]);

  const kaydet = async (onay = false) => {
    if (!yetki.yonetebilir) { showError(YETKI_YOK_MESAJI); return; }
    if (!satirlar.length) { showWarning("Fişe en az bir ürün ekleyin."); return; }
    const bozuk = satirlar.find((s) => !(sayi(s.miktar) > 0));
    if (bozuk) { showWarning(`${bozuk.ad}: miktar sıfırdan büyük olmalı.`); return; }
    setKaydediliyor(true);
    let tekrar = false;
    try {
      const r = await TicariService.girisKaydet({
        stokGirisId: id, tarih: !tarihYetkisi && !id ? new Date().toISOString() : new Date(`${tarih}T${saat || "00:00"}:00`).toISOString(), cariKartId: cari?.id ?? null, belgeNo, aciklama,
        vezneId: (user as any)?.vezneId ?? null,
        satirlar: satirlar.map((s) => ({ stokKartId: s.stokKartId, miktar: sayi(s.miktar), birimFiyat: sayi(s.birimFiyat), kdvOrani: s.kdvOrani })),
        eksiStokOnay: onay,
      });
      if (r.uyari) showWarning(r.uyari);
      showSuccess(`${r.fis.fisNo} numaralı stok giriş fişi kaydedildi.${r.fis.cariHareketId ? " Tedarikçiye alacak yazıldı." : ""}`);
      void kartlariYukle();
      if (id) navigate(`/ticari/stok-giris-fisi?id=${r.fis.stokGirisId}`, { replace: true });
      else await temizle();
    } catch (e: any) {
      if (eksiStokUyarisiMi(e)) tekrar = window.confirm(e.message);
      else showError(e?.message || "Fiş kaydedilemedi.");
    } finally {
      setKaydediliyor(false);
    }
    if (tekrar) await kaydet(true);
  };

  const sil = async (onay = false) => {
    if (!id) return;
    if (!onay && !window.confirm(`${fisNo} numaralı fiş silinsin mi? Stok ve tedarikçi alacağı geri alınır.`)) return;
    try {
      await TicariService.girisSil(id, onay);
      showSuccess("Fiş silindi.");
      navigate("/ticari/stok-giris-listesi");
    } catch (e: any) {
      if (eksiStokUyarisiMi(e) && window.confirm(e.message)) return sil(true);
      showError(e?.message || "Fiş silinemedi.");
    }
  };

  const satirDegis = (anahtar: string, alan: keyof Satir, v: any) => setSatirlar((p) => p.map((s) => (s.anahtar === anahtar ? { ...s, [alan]: v } : s)));

  if (!yetki.yukleniyor && !yetki.yonetebilir) {
    return <div className="container-fluid p-2"><Alert variant="warning">{YETKI_YOK_MESAJI}</Alert></div>;
  }

  return (
    <div className="container-fluid p-2">
      <ERPToolbar pageTitle={id ? `D- Stok Giriş Fişi — Düzeltme (${fisNo})` : "D- Stok Giriş Fişi"} pageIcon={<IconPackageImport size={20} />}
        onNew={() => (id ? navigate("/ticari/stok-giris-fisi") : void temizle())} onSave={() => void kaydet()} onDelete={id ? () => void sil() : undefined}
        hideDelete={!id} hidePrint hideSearch disabled={kaydediliyor} modeText={id ? "Düzeltme Modu" : "Yeni Kayıt Modu"} />
      {yukleniyor ? <div className="text-center py-5"><Spinner size="sm" className="me-2" />Yükleniyor...</div> : (
        <>
          <Card className="border shadow-xs mb-2">
            <Card.Body className="p-2">
              <Row className="g-2">
                <Col md={2}>
                  <Form.Label className="small text-muted mb-1 fw-bold">Fiş No</Form.Label>
                  <Form.Control size="sm" value={fisNo} readOnly className="font-monospace bg-light" />
                </Col>
                <Col md={2}>
                  <Form.Label className="small text-muted mb-1 fw-bold">Tarih</Form.Label>
                  <Form.Control size="sm" type="date" value={tarih} onChange={(e) => setTarih(e.target.value)} disabled={!tarihYetkisi} title={tarihYetkisi ? undefined : "Tarih değiştirme yetkiniz yok"} />
                </Col>
                <Col md={1}>
                  <Form.Label className="small text-muted mb-1 fw-bold">Saat</Form.Label>
                  <Form.Control size="sm" type="time" value={saat} onChange={(e) => setSaat(e.target.value)} disabled={!tarihYetkisi} />
                </Col>
                <Col md={3}>
                  <Form.Label className="small text-muted mb-1 fw-bold">Tedarikçi (cari)</Form.Label>
                  <InputGroup size="sm">
                    <InputGroup.Text className="bg-light"><IconUser size={14} /></InputGroup.Text>
                    <Form.Control readOnly value={cari ? `${cari.kod} ${cari.ad}` : ""} placeholder="Seçilmezse yalnız stok girilir" onClick={() => setCariSecici(true)} style={{ cursor: "pointer" }} />
                    {cari && <Button variant="outline-secondary" onClick={() => setCari(null)} title="Cariyi kaldır"><IconX size={14} /></Button>}
                    <Button variant="outline-primary" onClick={() => setCariSecici(true)} title="Cari seç"><IconBinoculars size={14} /></Button>
                  </InputGroup>
                </Col>
                <Col md={2}>
                  <Form.Label className="small text-muted mb-1 fw-bold">Tedarikçi Belge No</Form.Label>
                  <Form.Control size="sm" value={belgeNo} maxLength={50} onChange={(e) => setBelgeNo(e.target.value)} placeholder="Fatura / irsaliye no" />
                </Col>
                <Col md={2}>
                  <Form.Label className="small text-muted mb-1 fw-bold">Açıklama</Form.Label>
                  <Form.Control size="sm" value={aciklama} maxLength={250} onChange={(e) => setAciklama(e.target.value)} />
                </Col>
              </Row>
            </Card.Body>
          </Card>

          <Card className="border shadow-xs mb-2">
            <Card.Body className="p-2">
              <InputGroup size="sm" style={{ maxWidth: 560 }}>
                <InputGroup.Text className="bg-light"><IconBarcode size={15} /></InputGroup.Text>
                <Form.Control ref={okutRef} value={okut} placeholder="Barkod ya da kod okutun (3*barkod = 3 adet) · boşken Enter / F4 listeyi açar"
                  onChange={(e) => setOkut(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void okutuldu(); } if (e.key === "F4") { e.preventDefault(); setSecici({ acik: true, arama: okut }); } }} />
                <Button variant="outline-primary" onClick={() => setSecici({ acik: true, arama: okut })} title="Listeden seç (F4)"><IconBinoculars size={15} /></Button>
              </InputGroup>
            </Card.Body>
            <div className="table-responsive" style={{ maxHeight: "calc(100vh - 420px)", minHeight: 220 }}>
              <Table bordered size="sm" className="align-middle mb-0 text-nowrap">
                <thead className="table-light sticky-top">
                  <tr className="small text-secondary">
                    <th style={{ width: 40 }} className="text-center">#</th><th>Kod</th><th>Ürün Adı</th><th>Birim</th>
                    <th style={{ width: 110 }} className="text-end">Miktar</th><th style={{ width: 130 }} className="text-end">Alış Fiyatı (KDV hariç)</th>
                    <th style={{ width: 90 }} className="text-center">KDV %</th><th className="text-end">Tutar</th><th className="text-end">KDV</th><th className="text-end">Toplam</th><th style={{ width: 44 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {satirlar.length === 0 ? (
                    <tr><td colSpan={11} className="text-center py-4 text-muted">Ürün okutun ya da F4 ile listeden seçin.</td></tr>
                  ) : satirlar.map((s, i) => (
                    <tr key={s.anahtar}>
                      <td className="text-center text-muted small">{i + 1}</td>
                      <td className="font-monospace fw-bold small">{s.kod}</td>
                      <td className="fw-semibold">{s.ad}</td>
                      <td className="small">{s.birim}</td>
                      <td><Form.Control size="sm" className="text-end" inputMode="decimal" value={s.miktar} onChange={(e) => satirDegis(s.anahtar, "miktar", e.target.value.replace(/[^0-9.,]/g, ""))} /></td>
                      <td><Form.Control size="sm" className="text-end" inputMode="decimal" value={s.birimFiyat} onChange={(e) => satirDegis(s.anahtar, "birimFiyat", e.target.value.replace(/[^0-9.,]/g, ""))} /></td>
                      <td>
                        <Form.Select size="sm" value={s.kdvOrani} onChange={(e) => satirDegis(s.anahtar, "kdvOrani", Number(e.target.value))}>
                          {[...new Set([...KDV_SECENEKLERI, s.kdvOrani])].sort((a, b) => a - b).map((k) => <option key={k} value={k}>%{k}</option>)}
                        </Form.Select>
                      </td>
                      <td className="text-end">{para(hesap.satirlar[i].tutar)}</td>
                      <td className="text-end text-muted">{para(hesap.satirlar[i].kdvTutari)}</td>
                      <td className="text-end fw-bold">{para(hesap.satirlar[i].toplamTutar)}</td>
                      <td className="text-center"><Button size="sm" variant="outline-danger" className="py-0 px-1" onClick={() => setSatirlar((p) => p.filter((x) => x.anahtar !== s.anahtar))}><IconTrash size={14} /></Button></td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          </Card>

          <Row className="g-2">
            <Col md={7} className="small text-muted">
              <div>Toplam miktar: <b>{miktarYaz(satirlar.reduce((a, s) => a + sayi(s.miktar), 0))}</b> · {satirlar.length} kalem</div>
              <div>Kaydedince ürünler stoğa girer ve kartların son alış fiyatı güncellenir.{cari ? " Genel toplam tedarikçinin carisine alacak yazılır; ödemeyi kasa / banka ekranlarından yapın." : ""}</div>
            </Col>
            <Col md={5}>
              <Card className="border shadow-xs">
                <Card.Body className="p-2 small">
                  <div className="d-flex justify-content-between"><span>Ara Toplam</span><b>{para(hesap.ara)} TL</b></div>
                  <div className="d-flex justify-content-between"><span>KDV</span><b>{para(hesap.kdv)} TL</b></div>
                  <div className="d-flex justify-content-between fs-5 border-top mt-1 pt-1"><span>Genel Toplam</span><b className="text-primary">{para(hesap.genel)} TL</b></div>
                  {cari && <Badge bg="warning" text="dark" className="mt-1">Cariye alacak: {para(hesap.genel)} TL</Badge>}
                </Card.Body>
              </Card>
              <div className="text-end mt-2">
                <Button variant="primary" disabled={kaydediliyor} onClick={() => void kaydet()}>{kaydediliyor && <Spinner size="sm" className="me-1" />}Kaydet (F1)</Button>
              </div>
            </Col>
          </Row>
        </>
      )}

      <StokKartSecici show={secici.acik} kartlar={kartlar} aramaMetni={secici.arama} onHide={() => setSecici({ acik: false, arama: "" })}
        onSelect={(k) => { kartEkle(k); setSecici({ acik: false, arama: "" }); setOkut(""); setTimeout(() => okutRef.current?.focus(), 50); }}
        onYeni={() => { setSecici({ acik: false, arama: "" }); setYeniKart({ acik: true, barkod: /^\d{6,}$/.test(okut.trim()) ? okut.trim() : undefined }); }} />
      <StokKartModal show={yeniKart.acik} onBarkod={yeniKart.barkod} onHide={() => setYeniKart({ acik: false })}
        onSaved={(k) => { setYeniKart({ acik: false }); setOkut(""); void kartlariYukle(); kartEkle(k); }} />
      <LookupModal<CariKartItem>
        show={cariSecici} onHide={() => setCariSecici(false)} title="Tedarikçi Cari Seç" items={cariler}
        searchPlaceholder="Kod, ünvan ya da vergi no..."
        columns={[
          { header: "Kod", width: "110px", render: (c) => <span className="font-monospace">{c.kod}</span>, highlight: true },
          { header: "Ünvan", render: (c) => c.ad, highlight: true },
          { header: "Vergi / TC No", width: "130px", render: (c) => c.vergiKimlikNo || "" },
        ]}
        filterFn={(c, t) => { const a = t.toLocaleLowerCase("tr-TR"); return String(c.kod || "").toLocaleLowerCase("tr-TR").includes(a) || String(c.ad || "").toLocaleLowerCase("tr-TR").includes(a) || String(c.vergiKimlikNo || "").includes(t); }}
        onSelect={(c) => { setCari({ id: c.id, kod: c.kod, ad: c.ad }); setCariSecici(false); }}
        selectOnDoubleClick
      />
    </div>
  );
};

export default StokGirisFisiPage;
