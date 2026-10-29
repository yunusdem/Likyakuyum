import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Badge, Button, Card, Col, Form, InputGroup, Nav, Row, Spinner, Table } from "react-bootstrap";
import {
  IconArrowDown,
  IconArrowLeft,
  IconArrowRight,
  IconArrowUp,
  IconDeviceFloppy,
  IconLayoutGrid,
  IconPhoto,
  IconPhotoOff,
  IconPlus,
  IconSearch,
  IconTrash,
} from "@tabler/icons-react";
import ERPToolbar from "../../components/common/ERPToolbar";
import { useToast } from "../../context/ToastContext";
import { useAuth } from "../../context/AuthContext";
import { acikHizliSatisModulleri } from "../../config/hizliSatis";
import { DuzenSekmeGirdisi, HizliSatisAyarlari, HizliSatisService, HizliSatisSekme } from "../../services/hizliSatisService";
import { SarrafFisService } from "../../services/sarrafFisService";
import { StokKart, TicariService } from "../../services/ticariService";
import { resimKucult } from "../../utils/resimKucult";
import {
  HizliSatisModul,
  MODUL_ADI,
  MODUL_URUN_TURLERI,
  SERBEST_KDV_ORANLARI,
  URUN_TURU,
  paraUygunMu,
} from "../../../Backend/src/services/hizliSatis/hizliSatisKural";
import { HizliSatisKutusu } from "./HizliSatisKutusu";

/**
 * O- Hızlı Satış Düzeni (docs/HIZLI_SATIS_YOL_HARITASI.md, H6, H7, H17, H21): her modülün sekme ve butonları firma
 * bazında; yalnız sistem yöneticisi değiştirir. "Yetkiler" sekmesinde Fiyat Değiştir / İndirim yetkisi verilir.
 */

let sayac = 0;
const yeniAnahtar = () => `y${++sayac}`;

interface DButon {
  anahtar: string;
  butonId?: number;
  urunTuru: number;
  urunId: number | null;
  ozelAd: string;
  urunAdi: string;
  urunKodu: string;
  renk: string | null;
  fiyat: string;
  kdvOrani: number | null;
  resim: string | null;
  /** undefined: değişmedi, null: silindi, data URL: yeni */
  yeniResim?: string | null;
  gecersiz: boolean;
}

interface DSekme {
  anahtar: string;
  sekmeId?: number;
  ad: string;
  butonlar: DButon[];
}

interface UrunSecenegi {
  urunTuru: number;
  urunId: number;
  kod: string;
  ad: string;
  fiyat?: number | null;
  kdvOrani?: number | null;
  resimVar?: boolean;
}

const kartSecenegi = (x: StokKart): UrunSecenegi => ({ urunTuru: URUN_TURU.STOK, urunId: x.stokKartId, kod: x.kod, ad: x.ad, fiyat: x.satisFiyati, kdvOrani: x.kdvOrani, resimVar: x.resimVar });

const sayiYaz = (n: number | null | undefined) => (n === null || n === undefined ? "" : String(n).replace(".", ","));
const sayiOku = (s: string): number | null => {
  const t = s.trim();
  if (!t) return null;
  const n = Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t);
  return Number.isFinite(n) ? n : null;
};

const sunucudan = (s: HizliSatisSekme[]): DSekme[] =>
  s.map((x) => ({
    anahtar: yeniAnahtar(),
    sekmeId: x.sekmeId,
    ad: x.ad,
    butonlar: x.butonlar.map((b) => ({
      anahtar: yeniAnahtar(),
      butonId: b.butonId,
      urunTuru: b.urunTuru,
      urunId: b.urunId,
      ozelAd: b.ozelAd || "",
      urunAdi: b.urunAdi || "",
      urunKodu: b.urunKodu || "",
      renk: b.renk,
      fiyat: b.urunTuru === URUN_TURU.PARA ? "" : sayiYaz(b.ozelFiyat),
      kdvOrani: b.kdvOrani,
      resim: b.resim ?? null,
      gecersiz: b.gecersiz,
    })),
  }));

const sunucuya = (s: DSekme[]): DuzenSekmeGirdisi[] =>
  s.map((x) => ({
    sekmeId: x.sekmeId ?? null,
    ad: x.ad,
    butonlar: x.butonlar.map((b) => ({
      butonId: b.butonId ?? null,
      urunTuru: b.urunTuru,
      urunId: b.urunId,
      ad: b.ozelAd.trim() || null,
      renk: b.renk,
      fiyat: b.urunTuru === URUN_TURU.PARA ? null : sayiOku(b.fiyat),
      kdvOrani: b.urunTuru === URUN_TURU.SERBEST ? b.kdvOrani : null,
      ...(b.yeniResim !== undefined ? { resim: b.yeniResim } : {}),
    })),
  }));

const tasi = <T,>(dizi: T[], i: number, j: number): T[] => {
  if (j < 0 || j >= dizi.length || i === j) return dizi;
  const d = [...dizi];
  const [x] = d.splice(i, 1);
  d.splice(j, 0, x);
  return d;
};

export const HizliSatisDuzeniPage: React.FC = () => {
  const { showSuccess, showError } = useToast();
  const { user } = useAuth();
  const moduller = useMemo(() => acikHizliSatisModulleri(user?.merkez?.moduller), [user?.merkez?.moduller]);
  const [sekme, setSekme] = useState<HizliSatisModul | "yetki">(moduller[0] ?? "yetki");
  const [yonetici, setYonetici] = useState<boolean | null>(null);
  const [duzen, setDuzen] = useState<DSekme[]>([]);
  const [secSekme, setSecSekme] = useState<string | null>(null);
  const [secButon, setSecButon] = useState<string | null>(null);
  const [degisti, setDegisti] = useState(false);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [kaydediliyor, setKaydediliyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [urunler, setUrunler] = useState<UrunSecenegi[]>([]);
  const [arama, setArama] = useState("");
  const [ayar, setAyar] = useState<HizliSatisAyarlari | null>(null);
  const [yetkililer, setYetkililer] = useState<number[]>([]);
  const surukle = useRef<string | null>(null);
  const dosyaGirdisi = useRef<HTMLInputElement>(null);

  useEffect(() => {
    HizliSatisService.yetki().then((y) => setYonetici(y.sistemYoneticisi)).catch(() => setYonetici(false));
  }, []);

  const modulYukle = useCallback(async (m: HizliSatisModul) => {
    setYukleniyor(true);
    setHata(null);
    try {
      const [d, u] = await Promise.all([
        HizliSatisService.duzen(m),
        m === "ticari"
          ? Promise.resolve([] as UrunSecenegi[]) // Ticari listesi arama etkisiyle (sunucu araması) gelir
          : SarrafFisService.getUrunler().then((p) =>
              p.filter((x) => paraUygunMu(m, x)).map((x) => ({ urunTuru: URUN_TURU.PARA, urunId: x.paraId, kod: x.kod, ad: x.ad }))),
      ]);
      const ds = sunucudan(d);
      setDuzen(ds);
      setSecSekme(ds[0]?.anahtar ?? null);
      setSecButon(null);
      setUrunler(u);
      setDegisti(false);
    } catch (e: any) {
      setHata(e?.message || "Düzen alınamadı.");
    } finally {
      setYukleniyor(false);
    }
  }, []);

  const ayarYukle = useCallback(async () => {
    setYukleniyor(true);
    setHata(null);
    try {
      const a = await HizliSatisService.ayarlar();
      setAyar(a);
      setYetkililer(a.kullanicilar.filter((k) => k.yetkili).map((k) => k.kullaniciId));
      setDegisti(false);
    } catch (e: any) {
      setHata(e?.message || "Yetkiler alınamadı.");
    } finally {
      setYukleniyor(false);
    }
  }, []);

  useEffect(() => {
    if (yonetici === null) return;
    if (sekme === "yetki") {
      if (yonetici) void ayarYukle();
    } else void modulYukle(sekme);
  }, [sekme, yonetici, modulYukle, ayarYukle]);

  const sekmeDegistir = (s: HizliSatisModul | "yetki") => {
    if (s === sekme) return;
    if (degisti && !window.confirm("Kaydedilmemiş değişiklikler var. Kaydetmeden geçilsin mi?")) return;
    setSekme(s);
  };

  const guncelle = (f: (d: DSekme[]) => DSekme[]) => {
    setDuzen((d) => f(d));
    setDegisti(true);
  };
  const aktifSekme = duzen.find((s) => s.anahtar === secSekme) || null;
  const aktifButon = aktifSekme?.butonlar.find((b) => b.anahtar === secButon) || null;
  const butonGuncelle = (alan: Partial<DButon>) =>
    guncelle((d) => d.map((s) => (s.anahtar !== secSekme ? s : { ...s, butonlar: s.butonlar.map((b) => (b.anahtar === secButon ? { ...b, ...alan } : b)) })));

  const sekmeEkle = () => {
    const a = yeniAnahtar();
    guncelle((d) => [...d, { anahtar: a, ad: d.length ? `Sekme ${d.length + 1}` : "Sık Satılanlar", butonlar: [] }]);
    setSecSekme(a);
    setSecButon(null);
  };
  const sekmeSil = (a: string) => {
    const s = duzen.find((x) => x.anahtar === a);
    if (s?.butonlar.length && !window.confirm(`"${s.ad}" sekmesi ve içindeki ${s.butonlar.length} buton silinsin mi?`)) return;
    guncelle((d) => d.filter((x) => x.anahtar !== a));
    if (secSekme === a) {
      setSecSekme(duzen.find((x) => x.anahtar !== a)?.anahtar ?? null);
      setSecButon(null);
    }
  };

  const butonEkle = (u: UrunSecenegi | null) => {
    if (!aktifSekme) return;
    const a = yeniAnahtar();
    const b: DButon = u
      ? { anahtar: a, urunTuru: u.urunTuru, urunId: u.urunId, ozelAd: "", urunAdi: u.ad, urunKodu: u.kod, renk: null, fiyat: "", kdvOrani: null, resim: null, gecersiz: false }
      : { anahtar: a, urunTuru: URUN_TURU.SERBEST, urunId: null, ozelAd: "Serbest Ürün", urunAdi: "", urunKodu: "", renk: null, fiyat: "", kdvOrani: 20, resim: null, gecersiz: false };
    guncelle((d) => d.map((s) => (s.anahtar === secSekme ? { ...s, butonlar: [...s.butonlar, b] } : s)));
    setSecButon(a);
  };

  const butonSil = () => {
    guncelle((d) => d.map((s) => (s.anahtar === secSekme ? { ...s, butonlar: s.butonlar.filter((b) => b.anahtar !== secButon) } : s)));
    setSecButon(null);
  };

  const butonTasi = (yon: -1 | 1) => {
    if (!aktifSekme || !aktifButon) return;
    const i = aktifSekme.butonlar.findIndex((b) => b.anahtar === secButon);
    guncelle((d) => d.map((s) => (s.anahtar === secSekme ? { ...s, butonlar: tasi(s.butonlar, i, i + yon) } : s)));
  };

  const baskaSekmeye = (hedef: string) => {
    if (!aktifButon || hedef === secSekme) return;
    const b = aktifButon;
    guncelle((d) => d.map((s) => (s.anahtar === secSekme ? { ...s, butonlar: s.butonlar.filter((x) => x.anahtar !== b.anahtar) } : s.anahtar === hedef ? { ...s, butonlar: [...s.butonlar, b] } : s)));
    setSecSekme(hedef);
  };

  const birak = (hedefAnahtar: string) => {
    const kaynak = surukle.current;
    surukle.current = null;
    if (!kaynak || !aktifSekme || kaynak === hedefAnahtar) return;
    const i = aktifSekme.butonlar.findIndex((b) => b.anahtar === kaynak);
    const j = aktifSekme.butonlar.findIndex((b) => b.anahtar === hedefAnahtar);
    if (i < 0 || j < 0) return;
    guncelle((d) => d.map((s) => (s.anahtar === secSekme ? { ...s, butonlar: tasi(s.butonlar, i, j) } : s)));
  };

  const resimSec = async (dosya: File | undefined) => {
    if (!dosya) return;
    try {
      const r = await resimKucult(dosya);
      butonGuncelle({ resim: r, yeniResim: r });
    } catch (e: any) {
      showError(e?.message || "Resim yüklenemedi.");
    }
  };

  const urunResminiKullan = async () => {
    if (!aktifButon?.urunId) return;
    try {
      const k = await TicariService.kart(aktifButon.urunId);
      if (!k?.resim) {
        showError("Bu stok kartının resmi yok.");
        return;
      }
      const r = await resimKucult(k.resim);
      butonGuncelle({ resim: r, yeniResim: r });
    } catch (e: any) {
      showError(e?.message || "Stok kartı resmi alınamadı.");
    }
  };

  const kaydet = async () => {
    if (sekme === "yetki") {
      setKaydediliyor(true);
      try {
        const a = await HizliSatisService.ayarKaydet({ yetkiliKullanicilar: yetkililer });
        setAyar(a);
        setDegisti(false);
        showSuccess("Hızlı satış yetkileri kaydedildi.");
      } catch (e: any) {
        showError(e?.message || "Yetkiler kaydedilemedi.");
      } finally {
        setKaydediliyor(false);
      }
      return;
    }
    const bosSekme = duzen.find((s) => !s.ad.trim());
    if (bosSekme) {
      showError("Sekme adı boş olamaz.");
      return;
    }
    setKaydediliyor(true);
    try {
      const d = await HizliSatisService.duzenKaydet(sekme, sunucuya(duzen));
      const secAd = aktifSekme?.ad;
      const ds = sunucudan(d);
      setDuzen(ds);
      setSecSekme(ds.find((s) => s.ad === secAd)?.anahtar ?? ds[0]?.anahtar ?? null);
      setSecButon(null);
      setDegisti(false);
      showSuccess(`${MODUL_ADI[sekme]} hızlı satış düzeni kaydedildi.`);
    } catch (e: any) {
      showError(e?.message || "Düzen kaydedilemedi.");
    } finally {
      setKaydediliyor(false);
    }
  };

  const kullanilan = useMemo(() => new Set(aktifSekme?.butonlar.filter((b) => b.urunId).map((b) => `${b.urunTuru}:${b.urunId}`) || []), [aktifSekme]);
  // Ticari'de arama sunucuda (G2): 300 ms bekleyip kod / ad / barkodla en çok 200 kart; diğer modüllerde yerel süzme
  const aramaIstegi = useRef(0);
  useEffect(() => {
    if (sekme !== "ticari") return;
    const no = ++aramaIstegi.current;
    const t = setTimeout(() => {
      TicariService.kartlar({ aktif: true, arama: arama.trim() || undefined, limit: 200 })
        .then((k: StokKart[]) => { if (no === aramaIstegi.current) setUrunler(k.map(kartSecenegi)); })
        .catch(() => undefined);
    }, arama.trim() ? 300 : 0);
    return () => clearTimeout(t);
  }, [arama, sekme]);
  const aranan = useMemo(() => {
    if (sekme === "ticari") return urunler;
    const q = arama.trim().toLocaleLowerCase("tr-TR");
    return urunler.filter((u) => !q || u.ad.toLocaleLowerCase("tr-TR").includes(q) || u.kod.toLocaleLowerCase("tr-TR").includes(q)).slice(0, 200);
  }, [urunler, arama, sekme]);

  const modulSekmesi = sekme !== "yetki" ? sekme : null;
  const serbestVar = modulSekmesi ? MODUL_URUN_TURLERI[modulSekmesi].includes(URUN_TURU.SERBEST) : false;

  return (
    <div className="container-fluid p-2">
      <ERPToolbar pageTitle="Hızlı Satış Düzeni" pageIcon={<IconLayoutGrid size={20} />} onSave={yonetici ? kaydet : undefined}
        onRefresh={() => (sekme === "yetki" ? ayarYukle() : modulYukle(sekme))} hideNew hideDelete hidePrint hideSave={!yonetici} disabled={kaydediliyor}
        modeText={degisti ? <Badge bg="warning" text="dark">Kaydedilmedi</Badge> : undefined} />
      {yonetici === false && <Alert variant="warning" className="py-2">Hızlı satış düzenini yalnız sistem yöneticisi değiştirebilir. Aşağıda yalnız görüntüleniyor.</Alert>}
      {!moduller.length && <Alert variant="info" className="py-2">Hesabınızda hızlı satışı açık modül yok.</Alert>}

      <Nav variant="pills" className="mb-2 p-1 bg-light rounded-3 gap-1" activeKey={sekme} onSelect={(k) => k && sekmeDegistir(k as HizliSatisModul | "yetki")}>
        {moduller.map((m) => (
          <Nav.Item key={m}><Nav.Link eventKey={m}>{MODUL_ADI[m]}</Nav.Link></Nav.Item>
        ))}
        {yonetici && <Nav.Item><Nav.Link eventKey="yetki">Fiyat / İndirim Yetkisi</Nav.Link></Nav.Item>}
      </Nav>

      {hata && <Alert variant="danger" className="py-2">{hata}</Alert>}
      {yukleniyor ? (
        <div className="text-center py-5"><Spinner size="sm" className="me-2" />Yükleniyor...</div>
      ) : sekme === "yetki" ? (
        ayar && (
          <Card className="border shadow-xs">
            <Card.Header className="bg-light py-2 fw-bold small">Hızlı Satış – Fiyat Değiştir / İndirim yetkisi</Card.Header>
            <Card.Body className="p-2">
              <div className="small text-muted mb-2 px-1">
                Hızlı satış ekranında Fiyat Değiştir ve İndirim düğmeleri yalnız bu kullanıcılarda açılır. Sistem yöneticileri her zaman yetkilidir.
                12.000 TL fatura sınırı Ayarlar › Firma Tanımları'ndadır.
              </div>
              <div className="table-responsive" style={{ maxHeight: 460 }}>
                <Table size="sm" hover bordered className="align-middle mb-0">
                  <thead className="table-light sticky-top">
                    <tr className="small text-secondary"><th style={{ width: 60 }} className="text-center">Yetki</th><th>Kullanıcı</th><th style={{ width: 150 }}></th></tr>
                  </thead>
                  <tbody>
                    {ayar.kullanicilar.map((k) => (
                      <tr key={k.kullaniciId}>
                        <td className="text-center">
                          <Form.Check aria-label={k.ad} disabled={k.yonetici} checked={k.yonetici || yetkililer.includes(k.kullaniciId)}
                            onChange={(e) => { setYetkililer((p) => (e.target.checked ? [...p, k.kullaniciId] : p.filter((x) => x !== k.kullaniciId))); setDegisti(true); }} />
                        </td>
                        <td className="fw-semibold">{k.ad}</td>
                        <td className="text-center">{k.yonetici ? <Badge bg="primary">Sistem yöneticisi</Badge> : null}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            </Card.Body>
          </Card>
        )
      ) : (
        <Row className="g-2">
          <Col lg={3}>
            <Card className="border shadow-xs mb-2">
              <Card.Header className="bg-light py-2 fw-bold small d-flex justify-content-between align-items-center">
                <span>Sekmeler</span>
                {yonetici && <Button size="sm" variant="outline-primary" className="py-0" onClick={sekmeEkle}><IconPlus size={14} /> Sekme</Button>}
              </Card.Header>
              <Card.Body className="p-1">
                {!duzen.length && <div className="small text-muted p-2">Henüz sekme yok. "Sekme" ile ekleyin (ör. Hazır Ürünler, Sık Satılanlar).</div>}
                {duzen.map((s, i) => (
                  <div key={s.anahtar} className={`d-flex align-items-center gap-1 p-1 rounded ${s.anahtar === secSekme ? "bg-primary-subtle" : ""}`}
                    onClick={() => { setSecSekme(s.anahtar); setSecButon(null); }} role="button">
                    <Form.Control size="sm" value={s.ad} maxLength={60} disabled={!yonetici}
                      onChange={(e) => guncelle((d) => d.map((x) => (x.anahtar === s.anahtar ? { ...x, ad: e.target.value } : x)))} />
                    <Badge bg="secondary" pill>{s.butonlar.length}</Badge>
                    {yonetici && (
                      <>
                        <Button size="sm" variant="link" className="p-0" title="Yukarı" disabled={i === 0} onClick={(e) => { e.stopPropagation(); guncelle((d) => tasi(d, i, i - 1)); }}><IconArrowUp size={15} /></Button>
                        <Button size="sm" variant="link" className="p-0" title="Aşağı" disabled={i === duzen.length - 1} onClick={(e) => { e.stopPropagation(); guncelle((d) => tasi(d, i, i + 1)); }}><IconArrowDown size={15} /></Button>
                        <Button size="sm" variant="link" className="p-0 text-danger" title="Sekmeyi sil" onClick={(e) => { e.stopPropagation(); sekmeSil(s.anahtar); }}><IconTrash size={15} /></Button>
                      </>
                    )}
                  </div>
                ))}
              </Card.Body>
            </Card>

            {yonetici && aktifSekme && (
              <Card className="border shadow-xs">
                <Card.Header className="bg-light py-2 fw-bold small">"{aktifSekme.ad}" sekmesine ürün ekle</Card.Header>
                <Card.Body className="p-2">
                  {serbestVar && (
                    <Button size="sm" variant="outline-success" className="w-100 mb-2" onClick={() => butonEkle(null)}>
                      <IconPlus size={14} className="me-1" />Serbest ürün butonu (ad + fiyat + KDV)
                    </Button>
                  )}
                  <InputGroup size="sm" className="mb-2">
                    <InputGroup.Text><IconSearch size={14} /></InputGroup.Text>
                    <Form.Control placeholder="Kod ya da ad ara" value={arama} onChange={(e) => setArama(e.target.value)} />
                  </InputGroup>
                  <div style={{ maxHeight: 380, overflowY: "auto" }}>
                    {!aranan.length && <div className="small text-muted p-1">{modulSekmesi === "ticari" ? "Aktif stok kartı bulunamadı." : "Uygun ürün tanımı bulunamadı."}</div>}
                    {aranan.map((u) => {
                      const var_ = kullanilan.has(`${u.urunTuru}:${u.urunId}`);
                      return (
                        <div key={`${u.urunTuru}:${u.urunId}`} className="d-flex align-items-center justify-content-between border-bottom py-1 small">
                          <span><span className="text-muted me-1">{u.kod}</span>{u.ad}</span>
                          <Button size="sm" variant={var_ ? "outline-secondary" : "outline-primary"} className="py-0 px-1" onClick={() => butonEkle(u)} title={var_ ? "Bu sekmede zaten var; yine de eklenir" : "Ekle"}>
                            <IconPlus size={13} />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </Card.Body>
              </Card>
            )}
          </Col>

          <Col lg={6}>
            <Card className="border shadow-xs h-100">
              <Card.Header className="bg-light py-2 fw-bold small">
                {aktifSekme ? `${aktifSekme.ad} — butonlar (sürükleyip sıralayın)` : "Sekme seçin"}
              </Card.Header>
              <Card.Body className="p-2">
                {aktifSekme && !aktifSekme.butonlar.length && <div className="small text-muted">Bu sekmede buton yok. Soldan ürün ekleyin.</div>}
                <div className="d-grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(118px, 1fr))" }}>
                  {aktifSekme?.butonlar.map((b) => (
                    <div key={b.anahtar} draggable={!!yonetici}
                      onDragStart={() => { surukle.current = b.anahtar; }}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => { e.preventDefault(); birak(b.anahtar); }}
                      style={{ outline: b.anahtar === secButon ? "3px solid var(--bs-primary)" : undefined, borderRadius: 10 }}>
                      <HizliSatisKutusu ad={b.ozelAd.trim() || b.urunAdi || b.urunKodu} kod={b.urunKodu} renk={b.renk} resim={b.resim}
                        uyari={b.gecersiz ? "Ürün bulunamadı / pasif" : undefined} onClick={() => setSecButon(b.anahtar)} />
                    </div>
                  ))}
                </div>
              </Card.Body>
            </Card>
          </Col>

          <Col lg={3}>
            <Card className="border shadow-xs h-100">
              <Card.Header className="bg-light py-2 fw-bold small">Buton</Card.Header>
              <Card.Body className="p-2 small">
                {!aktifButon ? (
                  <div className="text-muted">Düzenlemek için bir buton seçin.</div>
                ) : (
                  <fieldset disabled={!yonetici}>
                    {/* Önizleme: satış ekranındaki kutunun birebir görünümü (resim sığdırılmış, zemin rengi, ad, fiyat) */}
                    <div className="mb-2">
                      <div className="text-muted mb-1">Önizleme (satış ekranındaki görünüm)</div>
                      <div style={{ width: 140 }}>
                        <HizliSatisKutusu ad={aktifButon.ozelAd.trim() || aktifButon.urunAdi || aktifButon.urunKodu} kod={aktifButon.urunKodu} renk={aktifButon.renk} resim={aktifButon.resim}
                          altYazi={aktifButon.fiyat.trim() ? `${aktifButon.fiyat.trim()} TL` : null} uyari={aktifButon.gecersiz ? "Ürün bulunamadı / pasif" : undefined} />
                      </div>
                    </div>
                    <div className="mb-2">
                      <div className="text-muted">{aktifButon.urunTuru === URUN_TURU.SERBEST ? "Serbest ürün" : aktifButon.urunTuru === URUN_TURU.STOK ? "Stok kartı" : "Ürün tanımı"}</div>
                      {aktifButon.urunTuru !== URUN_TURU.SERBEST && <div className="fw-semibold">{aktifButon.urunKodu} — {aktifButon.urunAdi || "(bulunamadı)"}</div>}
                    </div>
                    <Form.Group className="mb-2">
                      <Form.Label className="mb-0">{aktifButon.urunTuru === URUN_TURU.SERBEST ? "Ürün adı" : "Butonda görünen ad (boşsa ürün adı)"}</Form.Label>
                      <Form.Control size="sm" maxLength={60} value={aktifButon.ozelAd} onChange={(e) => butonGuncelle({ ozelAd: e.target.value })} />
                    </Form.Group>
                    {aktifButon.urunTuru !== URUN_TURU.PARA && (
                      <Row className="g-1 mb-2">
                        <Col xs={7}>
                          <Form.Label className="mb-0">Fiyat (KDV dahil)</Form.Label>
                          <Form.Control size="sm" inputMode="decimal" value={aktifButon.fiyat} onChange={(e) => butonGuncelle({ fiyat: e.target.value })} />
                          <div className="text-muted" style={{ fontSize: 11 }}>{aktifButon.urunTuru === URUN_TURU.STOK ? "Boşsa karttaki fiyat" : "Boşsa satışta sorulur"}</div>
                        </Col>
                        {aktifButon.urunTuru === URUN_TURU.SERBEST && (
                          <Col xs={5}>
                            <Form.Label className="mb-0">KDV %</Form.Label>
                            <Form.Select size="sm" value={aktifButon.kdvOrani ?? 20} onChange={(e) => butonGuncelle({ kdvOrani: Number(e.target.value) })}>
                              {SERBEST_KDV_ORANLARI.map((k) => <option key={k} value={k}>{k}</option>)}
                            </Form.Select>
                          </Col>
                        )}
                      </Row>
                    )}
                    <Form.Group className="mb-2">
                      <Form.Label className="mb-0">Zemin rengi (resimli butonda resmin arkası)</Form.Label>
                      <div className="d-flex align-items-center gap-2">
                        <Form.Control type="color" size="sm" style={{ width: 48 }} value={aktifButon.renk || "#e9ecef"} onChange={(e) => butonGuncelle({ renk: e.target.value })} />
                        <Button size="sm" variant="link" className="p-0" onClick={() => butonGuncelle({ renk: null })}>Renksiz</Button>
                      </div>
                    </Form.Group>
                    <Form.Group className="mb-2">
                      <Form.Label className="mb-0">Resim</Form.Label>
                      <div className="d-flex flex-wrap gap-1">
                        <input ref={dosyaGirdisi} type="file" accept="image/*" hidden onChange={(e) => { void resimSec(e.target.files?.[0]); e.target.value = ""; }} />
                        <Button size="sm" variant="outline-secondary" onClick={() => dosyaGirdisi.current?.click()}><IconPhoto size={14} className="me-1" />Seç</Button>
                        {aktifButon.urunTuru === URUN_TURU.STOK && (
                          <Button size="sm" variant="outline-secondary" onClick={urunResminiKullan}>Kart resmini kullan</Button>
                        )}
                        {aktifButon.resim && (
                          <Button size="sm" variant="outline-danger" onClick={() => butonGuncelle({ resim: null, yeniResim: null })}><IconPhotoOff size={14} className="me-1" />Kaldır</Button>
                        )}
                      </div>
                      <div className="text-muted mt-1">Resim kırpılmadan sığdırılır, kaydederken ~300 piksele küçültülür; saydam PNG'de arkada zemin rengi görünür.</div>
                    </Form.Group>
                    {duzen.length > 1 && (
                      <Form.Group className="mb-2">
                        <Form.Label className="mb-0">Başka sekmeye taşı</Form.Label>
                        <Form.Select size="sm" value={secSekme ?? ""} onChange={(e) => baskaSekmeye(e.target.value)}>
                          {duzen.map((s) => <option key={s.anahtar} value={s.anahtar}>{s.ad}</option>)}
                        </Form.Select>
                      </Form.Group>
                    )}
                    <div className="d-flex gap-1 mt-3">
                      <Button size="sm" variant="outline-secondary" title="Sola" onClick={() => butonTasi(-1)}><IconArrowLeft size={14} /></Button>
                      <Button size="sm" variant="outline-secondary" title="Sağa" onClick={() => butonTasi(1)}><IconArrowRight size={14} /></Button>
                      <Button size="sm" variant="outline-danger" className="ms-auto" onClick={butonSil}><IconTrash size={14} className="me-1" />Butonu sil</Button>
                    </div>
                  </fieldset>
                )}
              </Card.Body>
            </Card>
          </Col>
          {yonetici && (
            <Col xs={12} className="text-end">
              <Button variant="primary" disabled={kaydediliyor || !degisti} onClick={kaydet}>
                {kaydediliyor ? <Spinner size="sm" className="me-1" /> : <IconDeviceFloppy size={16} className="me-1" />}Kaydet
              </Button>
            </Col>
          )}
        </Row>
      )}
    </div>
  );
};

export default HizliSatisDuzeniPage;
