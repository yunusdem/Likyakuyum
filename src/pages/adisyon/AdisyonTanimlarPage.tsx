import { paraOku, miktarOku } from "../../utils/sayiGirisi";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Badge, Button, Card, Col, Form, InputGroup, Modal, Nav, Row, Tab, Table } from "react-bootstrap";
import { IconChefHat, IconDeviceFloppy, IconLayoutGrid, IconListDetails, IconPlus, IconToolsKitchen2, IconTrash, IconUserCircle, IconX } from "@tabler/icons-react";
import ERPToolbar from "../../components/common/ERPToolbar";
import { useToast } from "../../context/ToastContext";
import { MasaQrModal } from "./MasaQrModal";
import { AdisyonService, BolgeTanim, Garson, GarsonKullanicisi, GarsonListesi, GrupYer, HazirlikYeri, MasaTanim, SecenekGrubu } from "../../services/adisyonService";
import { FiyatListesi, StokKart, TicariService, para } from "../../services/ticariService";
import { SEVIYE_ADI, YETKILER, YETKI_ADI, Yetki, porsiyonFiyati, yetkiKumesi } from "../../../Backend/src/services/adisyon/adisyonHesap";
import { StokKartSecici } from "../ticari/StokKartSecici";

/**
 * Adisyon › Tanımlar (docs/TICARI_ADISYON_YOL_HARITASI.md, D2): bölge / masa (toplu ekleme, bölge fiyat listesi), hazırlık yerleri
 * (yazıcı / mutfak ekranı, ürün grubu → yer), seçenek grupları, ürün porsiyon + seçenek bağı, garsonlar (bağlı kullanıcı, seviye, ek yetki, lisans sınırı).
 */
const sayiMetni = (v: string) => v.replace(/[^0-9.,]/g, "");
const sayiyaCevir = (v: string) => Number(String(v).replace(",", "."));
const hataMetni = (e: any, varsayilan: string) => e?.message || varsayilan;

// ───────────── Bölge / masa ─────────────
const BolgeMasa: React.FC = () => {
  const [qrAcik, setQrAcik] = useState(false);
  const { showSuccess, showError } = useToast();
  const [bolgeler, setBolgeler] = useState<BolgeTanim[]>([]);
  const [listeler, setListeler] = useState<FiyatListesi[]>([]);
  const [b, setB] = useState({ bolgeId: null as number | null, ad: "", sira: "", fiyatListesiId: "", aktif: true });
  const [toplu, setToplu] = useState({ bolgeId: "", baslangic: "1", bitis: "10", onEk: "", kisi: "4" });
  const [m, setM] = useState<{ masaId: number | null; bolgeId: string; ad: string; kisi: string; aktif: boolean } | null>(null);
  const yukle = useCallback(async () => {
    try { setBolgeler(await AdisyonService.bolgeler()); } catch (e) { showError(hataMetni(e, "Bölgeler alınamadı.")); }
  }, [showError]);
  useEffect(() => { void yukle(); TicariService.fiyatListeleri(true).then(setListeler).catch(() => setListeler([])); }, [yukle]);
  useEffect(() => { if (!toplu.bolgeId && bolgeler.length) setToplu((t) => ({ ...t, bolgeId: String(bolgeler.find((x) => x.aktif)?.bolgeId ?? "") })); }, [bolgeler, toplu.bolgeId]);

  const bolgeKaydet = async () => {
    try {
      await AdisyonService.bolgeKaydet({ bolgeId: b.bolgeId, ad: b.ad, sira: b.sira ? Number(b.sira) : null, fiyatListesiId: b.fiyatListesiId ? Number(b.fiyatListesiId) : null, aktif: b.aktif });
      showSuccess(`"${b.ad.trim()}" bölgesi kaydedildi.`);
      setB({ bolgeId: null, ad: "", sira: "", fiyatListesiId: "", aktif: true });
      await yukle();
    } catch (e) { showError(hataMetni(e, "Bölge kaydedilemedi.")); }
  };
  const bolgeSil = async (x: BolgeTanim) => {
    if (!window.confirm(`"${x.ad}" bölgesi silinsin mi? Masalarında adisyon geçmişi varsa bölge ve masaları pasif yapılır.`)) return;
    try {
      const r = await AdisyonService.bolgeSil(x.bolgeId);
      showSuccess(r.silindi ? `"${x.ad}" silindi.` : `"${x.ad}" geçmişi olduğu için pasif yapıldı.`);
      if (b.bolgeId === x.bolgeId) setB({ bolgeId: null, ad: "", sira: "", fiyatListesiId: "", aktif: true });
      await yukle();
    } catch (e) { showError(hataMetni(e, "Bölge silinemedi.")); }
  };
  const topluEkle = async () => {
    try {
      const r = await AdisyonService.masaTopluEkle({ bolgeId: Number(toplu.bolgeId), baslangic: Number(toplu.baslangic), bitis: Number(toplu.bitis), onEk: toplu.onEk.trim() || null, kisi: toplu.kisi ? Number(toplu.kisi) : null });
      showSuccess(`${r.eklenen} masa eklendi${r.atlanan ? `, ${r.atlanan} masa zaten vardı` : ""}.`);
      await yukle();
    } catch (e) { showError(hataMetni(e, "Masalar eklenemedi.")); }
  };
  const masaKaydet = async () => {
    if (!m) return;
    try {
      await AdisyonService.masaKaydet({ masaId: m.masaId, bolgeId: Number(m.bolgeId), ad: m.ad, kisi: m.kisi ? Number(m.kisi) : null, aktif: m.aktif });
      showSuccess(`"${m.ad.trim()}" masası kaydedildi.`);
      setM(null);
      await yukle();
    } catch (e) { showError(hataMetni(e, "Masa kaydedilemedi.")); }
  };
  const masaSil = async () => {
    if (!m?.masaId || !window.confirm(`"${m.ad}" masası silinsin mi? Adisyon geçmişi varsa pasif yapılır.`)) return;
    try {
      const r = await AdisyonService.masaSil(m.masaId);
      showSuccess(r.silindi ? "Masa silindi." : "Masanın geçmişi olduğu için pasif yapıldı.");
      setM(null);
      await yukle();
    } catch (e) { showError(hataMetni(e, "Masa silinemedi.")); }
  };
  const masaAc = (x: MasaTanim) => setM({ masaId: x.masaId, bolgeId: String(x.bolgeId), ad: x.ad, kisi: x.kisi === null ? "" : String(x.kisi), aktif: x.aktif });
  const masaSayisi = bolgeler.reduce((t, x) => t + x.masalar.filter((y) => y.aktif).length, 0);

  return (
    <Row className="g-3">
      <Col xl={8}>
        <Card className="border shadow-xs">
          <Card.Header className="bg-light py-2 small d-flex justify-content-between align-items-center"><span className="fw-bold">Bölgeler ve masalar</span><span className="text-muted ms-auto me-2">{bolgeler.filter((x) => x.aktif).length} bölge · {masaSayisi} etkin masa</span><Button size="sm" variant="outline-primary" className="py-0" onClick={() => setQrAcik(true)}>Masa QR kodları</Button></Card.Header>
          <MasaQrModal show={qrAcik} kapat={() => setQrAcik(false)} />
          <Card.Body className="d-flex flex-column gap-3">
            {!bolgeler.length && <div className="text-muted small">Henüz bölge yok. Sağdan "Salon", "Bahçe" gibi bir bölge ekleyin, sonra masaları toplu ekleyin.</div>}
            {bolgeler.map((x) => (
              <div key={x.bolgeId} className="border rounded p-2" style={{ opacity: x.aktif ? 1 : 0.55 }}>
                <div className="d-flex align-items-center gap-2 mb-2">
                  <span className="fw-bold">{x.ad}</span>
                  {x.fiyatListesiAd && <Badge bg="info">Fiyat: {x.fiyatListesiAd}</Badge>}
                  {!x.aktif && <Badge bg="secondary">Pasif</Badge>}
                  <span className="small text-muted">{x.masalar.length} masa</span>
                  <div className="ms-auto d-flex gap-1">
                    <Button size="sm" variant="outline-primary" onClick={() => setB({ bolgeId: x.bolgeId, ad: x.ad, sira: String(x.sira), fiyatListesiId: x.fiyatListesiId ? String(x.fiyatListesiId) : "", aktif: x.aktif })}>Düzenle</Button>
                    <Button size="sm" variant="outline-success" onClick={() => setM({ masaId: null, bolgeId: String(x.bolgeId), ad: "", kisi: "4", aktif: true })}><IconPlus size={14} /> Masa</Button>
                    <Button size="sm" variant="outline-danger" aria-label={`${x.ad} bölgesini sil`} onClick={() => void bolgeSil(x)}><IconTrash size={14} /></Button>
                  </div>
                </div>
                <div className="d-flex flex-wrap gap-2">
                  {x.masalar.map((y) => (
                    <button key={y.masaId} type="button" onClick={() => masaAc(y)} title={`${y.ad}${y.kisi ? ` · ${y.kisi} kişilik` : ""}`}
                      style={{ width: 64, height: 52, borderRadius: 8, border: `2px solid ${m?.masaId === y.masaId ? "#0d6efd" : "#cfd8e3"}`, background: y.aktif ? "#f4f8ff" : "#eceff3", color: y.aktif ? "#1f2d3d" : "#8a94a3" }}>
                      <div className="fw-bold" style={{ fontSize: 15, lineHeight: 1.1 }}>{y.ad}</div>
                      <div style={{ fontSize: 11 }}>{y.aktif ? (y.kisi ? `${y.kisi} kişi` : "") : "pasif"}</div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </Card.Body>
        </Card>
      </Col>
      <Col xl={4} className="d-flex flex-column gap-3">
        <Card className="border shadow-xs">
          <Card.Header className="bg-light py-2 fw-bold small">{b.bolgeId ? "Bölgeyi düzenle" : "Yeni bölge"}</Card.Header>
          <Card.Body>
            <Form.Group className="mb-2"><Form.Label className="small fw-bold mb-1">Bölge adı</Form.Label><Form.Control size="sm" aria-label="Bölge adı" maxLength={50} value={b.ad} onChange={(e) => setB({ ...b, ad: e.target.value })} placeholder="Salon, Bahçe, Teras…" /></Form.Group>
            <Form.Group className="mb-2"><Form.Label className="small fw-bold mb-1">Sıra</Form.Label><Form.Control size="sm" aria-label="Bölge sırası" inputMode="numeric" style={{ maxWidth: 100 }} value={b.sira} onChange={(e) => setB({ ...b, sira: e.target.value.replace(/\D/g, "") })} /></Form.Group>
            <Form.Group className="mb-2">
              <Form.Label className="small fw-bold mb-1">Fiyat listesi</Form.Label>
              <Form.Select size="sm" aria-label="Bölge fiyat listesi" value={b.fiyatListesiId} onChange={(e) => setB({ ...b, fiyatListesiId: e.target.value })}>
                <option value="">Kartın satış fiyatı</option>
                {listeler.map((l) => <option key={l.fiyatListesiId} value={l.fiyatListesiId}>{l.ad}</option>)}
              </Form.Select>
              <Form.Text>Örn. bahçede farklı fiyat: listede fiyatı olmayan ürün kartın fiyatıyla satılır.</Form.Text>
            </Form.Group>
            <Form.Check type="switch" id="bolge-aktif" className="mb-2" label="Etkin" checked={b.aktif} onChange={(e) => setB({ ...b, aktif: e.target.checked })} />
            <div className="d-flex gap-2">
              <Button size="sm" variant="success" disabled={!b.ad.trim()} onClick={() => void bolgeKaydet()}><IconDeviceFloppy size={14} className="me-1" />Kaydet</Button>
              {b.bolgeId && <Button size="sm" variant="outline-secondary" onClick={() => setB({ bolgeId: null, ad: "", sira: "", fiyatListesiId: "", aktif: true })}>Vazgeç</Button>}
            </div>
          </Card.Body>
        </Card>
        <Card className="border shadow-xs">
          <Card.Header className="bg-light py-2 fw-bold small">Toplu masa ekle</Card.Header>
          <Card.Body>
            <Form.Select size="sm" className="mb-2" aria-label="Toplu masa bölgesi" value={toplu.bolgeId} onChange={(e) => setToplu({ ...toplu, bolgeId: e.target.value })}>
              <option value="">Bölge seçin</option>
              {bolgeler.filter((x) => x.aktif).map((x) => <option key={x.bolgeId} value={x.bolgeId}>{x.ad}</option>)}
            </Form.Select>
            <Row className="g-2 mb-2">
              <Col xs={4}><Form.Label className="small mb-0">Ön ek</Form.Label><Form.Control size="sm" aria-label="Masa ön eki" maxLength={10} value={toplu.onEk} onChange={(e) => setToplu({ ...toplu, onEk: e.target.value })} placeholder="B" /></Col>
              <Col xs={4}><Form.Label className="small mb-0">Başlangıç</Form.Label><Form.Control size="sm" aria-label="İlk masa no" inputMode="numeric" value={toplu.baslangic} onChange={(e) => setToplu({ ...toplu, baslangic: e.target.value.replace(/\D/g, "") })} /></Col>
              <Col xs={4}><Form.Label className="small mb-0">Bitiş</Form.Label><Form.Control size="sm" aria-label="Son masa no" inputMode="numeric" value={toplu.bitis} onChange={(e) => setToplu({ ...toplu, bitis: e.target.value.replace(/\D/g, "") })} /></Col>
              <Col xs={4}><Form.Label className="small mb-0">Kişi</Form.Label><Form.Control size="sm" aria-label="Kişi sayısı" inputMode="numeric" value={toplu.kisi} onChange={(e) => setToplu({ ...toplu, kisi: e.target.value.replace(/\D/g, "") })} /></Col>
            </Row>
            <div className="small text-muted mb-2">{toplu.baslangic && toplu.bitis && Number(toplu.bitis) >= Number(toplu.baslangic) ? `${Number(toplu.bitis) - Number(toplu.baslangic) + 1} masa: ${toplu.onEk.trim() ? `${toplu.onEk.trim()} ` : ""}${toplu.baslangic} … ${toplu.onEk.trim() ? `${toplu.onEk.trim()} ` : ""}${toplu.bitis} (var olanlar atlanır)` : "Başlangıç ve bitiş yazın."}</div>
            <Button size="sm" variant="primary" disabled={!toplu.bolgeId} onClick={() => void topluEkle()}><IconPlus size={14} className="me-1" />Masaları ekle</Button>
          </Card.Body>
        </Card>
        {m && (
          <Card className="border border-primary shadow-xs">
            <Card.Header className="bg-light py-2 fw-bold small d-flex justify-content-between">{m.masaId ? `Masa: ${m.ad}` : "Yeni masa"}<IconX size={16} role="button" aria-label="Kapat" onClick={() => setM(null)} /></Card.Header>
            <Card.Body>
              <Form.Select size="sm" className="mb-2" aria-label="Masa bölgesi" value={m.bolgeId} onChange={(e) => setM({ ...m, bolgeId: e.target.value })}>
                {bolgeler.map((x) => <option key={x.bolgeId} value={x.bolgeId}>{x.ad}</option>)}
              </Form.Select>
              <Row className="g-2 mb-2">
                <Col xs={7}><Form.Label className="small mb-0">Masa adı</Form.Label><Form.Control size="sm" aria-label="Masa adı" maxLength={30} value={m.ad} onChange={(e) => setM({ ...m, ad: e.target.value })} /></Col>
                <Col xs={5}><Form.Label className="small mb-0">Kişi</Form.Label><Form.Control size="sm" aria-label="Masa kişi sayısı" inputMode="numeric" value={m.kisi} onChange={(e) => setM({ ...m, kisi: e.target.value.replace(/\D/g, "") })} /></Col>
              </Row>
              <Form.Check type="switch" id="masa-aktif" className="mb-2" label="Etkin" checked={m.aktif} onChange={(e) => setM({ ...m, aktif: e.target.checked })} />
              <div className="d-flex gap-2">
                <Button size="sm" variant="success" disabled={!m.ad.trim()} onClick={() => void masaKaydet()}><IconDeviceFloppy size={14} className="me-1" />Kaydet</Button>
                {m.masaId && <Button size="sm" variant="outline-danger" onClick={() => void masaSil()}><IconTrash size={14} className="me-1" />Sil</Button>}
              </div>
            </Card.Body>
          </Card>
        )}
      </Col>
    </Row>
  );
};

// ───────────── Hazırlık yerleri ─────────────
const Hazirlik: React.FC = () => {
  const { showSuccess, showError } = useToast();
  const [yerler, setYerler] = useState<HazirlikYeri[]>([]);
  const [gruplar, setGruplar] = useState<GrupYer[]>([]);
  const [degisen, setDegisen] = useState(false);
  const [y, setY] = useState({ yerId: null as number | null, ad: "", yazici: "", ekran: true, aktif: true });
  const yukle = useCallback(async () => {
    try { const [a, b] = await Promise.all([AdisyonService.yerler(), AdisyonService.grupYerleri()]); setYerler(a); setGruplar(b); setDegisen(false); } catch (e) { showError(hataMetni(e, "Hazırlık yerleri alınamadı.")); }
  }, [showError]);
  useEffect(() => { void yukle(); }, [yukle]);
  const bos = { yerId: null, ad: "", yazici: "", ekran: true, aktif: true };
  const yerKaydet = async () => {
    try { await AdisyonService.yerKaydet({ ...y, yazici: y.yazici.trim() || null }); showSuccess(`"${y.ad.trim()}" kaydedildi.`); setY(bos); await yukle(); } catch (e) { showError(hataMetni(e, "Hazırlık yeri kaydedilemedi.")); }
  };
  const yerSil = async (x: HazirlikYeri) => {
    if (!window.confirm(`"${x.ad}" silinsin mi? Bağlı ürün grupları boşa çıkar; sipariş geçmişi varsa pasif yapılır.`)) return;
    try { const r = await AdisyonService.yerSil(x.yerId); showSuccess(r.silindi ? "Silindi." : "Geçmişi olduğu için pasif yapıldı."); await yukle(); } catch (e) { showError(hataMetni(e, "Silinemedi.")); }
  };
  // Mutfak ekranı (KDS) bağlantısı (D5): yeni anahtar eskisini geçersiz kılar; bağlantı yalnız şimdi gösterilir
  const [baglanti, setBaglanti] = useState<{ yer: string; anahtar: string; musteriNo: string } | null>(null);
  const ekranBaglantisi = async (x: HazirlikYeri) => {
    if (!window.confirm(`"${x.ad}" için yeni mutfak ekranı bağlantısı üretilsin mi? Önceki bağlantı (varsa) çalışmaz olur.`)) return;
    try { const a = await AdisyonService.ekranAnahtari(x.yerId); setBaglanti({ yer: a.yer, anahtar: a.anahtar, musteriNo: a.musteriNo || "" }); await yukle(); }
    catch (e) { showError(hataMetni(e, "Bağlantı üretilemedi.")); }
  };
  const baglantiAdresi = baglanti ? `${window.location.origin}/mutfak?m=${encodeURIComponent(baglanti.musteriNo.trim())}#k=${baglanti.anahtar}` : "";
  const grupKaydet = async () => {
    try { setGruplar(await AdisyonService.grupYerKaydet(gruplar.map((g) => ({ stokGrupId: g.stokGrupId, yerId: g.yerId })))); setDegisen(false); showSuccess("Ürün grubu → hazırlık yeri eşleşmesi kaydedildi."); await yukle(); } catch (e) { showError(hataMetni(e, "Kaydedilemedi.")); }
  };
  return (
    <Row className="g-3">
      <Col lg={7}>
        <Card className="border shadow-xs mb-3">
          <Card.Header className="bg-light py-2 fw-bold small">Hazırlık yerleri (mutfak, bar, ızgara…)</Card.Header>
          <Table size="sm" hover className="mb-0 align-middle">
            <thead><tr><th>Ad</th><th>Yazıcı</th><th className="text-center">Mutfak ekranı</th><th className="text-end">Grup</th><th /></tr></thead>
            <tbody>
              {!yerler.length && <tr><td colSpan={5} className="text-muted small">Henüz hazırlık yeri yok.</td></tr>}
              {yerler.map((x) => (
                <tr key={x.yerId} style={{ opacity: x.aktif ? 1 : 0.55 }}>
                  <td className="fw-semibold">{x.ad} {!x.aktif && <Badge bg="secondary">Pasif</Badge>}</td>
                  <td className="small">{x.yazici || <span className="text-muted">—</span>}</td>
                  <td className="text-center">{x.ekran ? <Badge bg="success">Var</Badge> : <span className="text-muted small">Yok</span>}</td>
                  <td className="text-end">{x.grupSayisi}</td>
                  <td className="text-end text-nowrap">
                    {x.ekran && x.aktif && <Button size="sm" variant="link" className="py-0" onClick={() => void ekranBaglantisi(x)}>Ekran bağlantısı</Button>}
                    <Button size="sm" variant="link" className="py-0" onClick={() => setY({ yerId: x.yerId, ad: x.ad, yazici: x.yazici || "", ekran: x.ekran, aktif: x.aktif })}>Düzenle</Button>
                    <Button size="sm" variant="link" className="py-0 text-danger" aria-label={`${x.ad} sil`} onClick={() => void yerSil(x)}><IconTrash size={14} /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
        <Card className="border shadow-xs">
          <Card.Header className="bg-light py-2 small d-flex justify-content-between align-items-center">
            <span className="fw-bold">Ürün grubu → hazırlık yeri</span>
            <Button size="sm" variant={degisen ? "success" : "outline-success"} disabled={!degisen} onClick={() => void grupKaydet()}><IconDeviceFloppy size={14} className="me-1" />Eşleşmeyi kaydet</Button>
          </Card.Header>
          <Table size="sm" className="mb-0 align-middle">
            <thead><tr><th>Ürün grubu</th><th style={{ width: 260 }}>Sipariş nereye gider?</th></tr></thead>
            <tbody>
              {!gruplar.length && <tr><td colSpan={2} className="text-muted small">Ticari › Ürün Grupları'nda grup yok.</td></tr>}
              {gruplar.map((g) => (
                <tr key={g.stokGrupId}>
                  <td>{g.ad}</td>
                  <td>
                    <Form.Select size="sm" aria-label={`${g.ad} hazırlık yeri`} value={g.yerId ?? ""} onChange={(e) => { setGruplar(gruplar.map((x) => (x.stokGrupId === g.stokGrupId ? { ...x, yerId: e.target.value ? Number(e.target.value) : null } : x))); setDegisen(true); }}>
                      <option value="">Hazırlığa gitmez (yalnız adisyonda)</option>
                      {yerler.filter((x) => x.aktif || x.yerId === g.yerId).map((x) => <option key={x.yerId} value={x.yerId}>{x.ad}</option>)}
                    </Form.Select>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      </Col>
      <Col lg={5}>
        <Card className="border shadow-xs">
          <Card.Header className="bg-light py-2 fw-bold small">{y.yerId ? "Hazırlık yerini düzenle" : "Yeni hazırlık yeri"}</Card.Header>
          <Card.Body>
            <Form.Group className="mb-2"><Form.Label className="small fw-bold mb-1">Ad</Form.Label><Form.Control size="sm" aria-label="Hazırlık yeri adı" maxLength={50} value={y.ad} onChange={(e) => setY({ ...y, ad: e.target.value })} placeholder="Mutfak, Bar, Izgara…" /></Form.Group>
            <Form.Group className="mb-2">
              <Form.Label className="small fw-bold mb-1">Yazıcı adı (kasa bilgisayarında)</Form.Label>
              <Form.Control size="sm" aria-label="Yazıcı adı" maxLength={200} value={y.yazici} onChange={(e) => setY({ ...y, yazici: e.target.value })} placeholder="Windows'taki yazıcı adı" />
              <Form.Text>Sipariş fişi kasa bilgisayarındaki yazıcı aracı üzerinden bu yazıcıya basılır. Boşsa yalnız mutfak ekranına düşer.</Form.Text>
            </Form.Group>
            <Form.Check type="switch" id="yer-ekran" className="mb-2" label="Mutfak ekranında (KDS) göster" checked={y.ekran} onChange={(e) => setY({ ...y, ekran: e.target.checked })} />
            <Form.Check type="switch" id="yer-aktif" className="mb-2" label="Etkin" checked={y.aktif} onChange={(e) => setY({ ...y, aktif: e.target.checked })} />
            {!y.yazici.trim() && !y.ekran && <Alert variant="warning" className="py-1 small">Yazıcı ya da mutfak ekranından en az biri olmalı.</Alert>}
            <div className="d-flex gap-2">
              <Button size="sm" variant="success" disabled={!y.ad.trim() || (!y.yazici.trim() && !y.ekran)} onClick={() => void yerKaydet()}><IconDeviceFloppy size={14} className="me-1" />Kaydet</Button>
              {y.yerId && <Button size="sm" variant="outline-secondary" onClick={() => setY(bos)}>Vazgeç</Button>}
            </div>
          </Card.Body>
        </Card>
      </Col>
      <Modal show={!!baglanti} onHide={() => setBaglanti(null)} centered>
        <Modal.Header closeButton className="py-2"><Modal.Title className="h6 mb-0">Mutfak ekranı bağlantısı — {baglanti?.yer}</Modal.Title></Modal.Header>
        <Modal.Body>
          <div className="small mb-2">Bu adresi mutfaktaki tablette açın (yer imlerine ekleyin). Personel girişi gerekmez; yalnız bu hazırlık yerinin siparişleri görünür.</div>
          {!baglanti?.musteriNo && (
            <Form.Group className="mb-2">
              <Form.Label className="small fw-bold mb-1">Müşteri no</Form.Label>
              <Form.Control size="sm" aria-label="Bağlantı müşteri no" value={baglanti?.musteriNo || ""} onChange={(e) => baglanti && setBaglanti({ ...baglanti, musteriNo: e.target.value })} placeholder="Firmanın müşteri numarası" />
            </Form.Group>
          )}
          <InputGroup size="sm">
            <Form.Control readOnly aria-label="Mutfak ekranı adresi" value={baglantiAdresi} onFocus={(e) => e.target.select()} />
            <Button variant="outline-primary" disabled={!baglanti?.musteriNo.trim()} onClick={() => { void navigator.clipboard?.writeText(baglantiAdresi); showSuccess("Adres kopyalandı."); }}>Kopyala</Button>
          </InputGroup>
          <Alert variant="warning" className="py-1 small mt-2 mb-0">Adres yalnız şimdi gösterilir; kaybolursa yeni bağlantı üretin (eskisi çalışmaz olur).</Alert>
        </Modal.Body>
      </Modal>
    </Row>
  );
};

// ───────────── Seçenek grupları ─────────────
type SecenekSatiri = { secenekId: number | null; ad: string; ekFiyat: string; aktif: boolean };
const Secenekler: React.FC = () => {
  const { showSuccess, showError } = useToast();
  const [gruplar, setGruplar] = useState<SecenekGrubu[]>([]);
  const bos = () => ({ sgId: null as number | null, ad: "", zorunlu: false, coklu: false, aktif: true, secenekler: [{ secenekId: null, ad: "", ekFiyat: "", aktif: true }] as SecenekSatiri[] });
  const [f, setF] = useState(bos());
  const yukle = useCallback(async () => { try { setGruplar(await AdisyonService.secenekGruplari()); } catch (e) { showError(hataMetni(e, "Seçenek grupları alınamadı.")); } }, [showError]);
  useEffect(() => { void yukle(); }, [yukle]);
  const satir = (i: number, d: Partial<SecenekSatiri>) => setF({ ...f, secenekler: f.secenekler.map((s, j) => (j === i ? { ...s, ...d } : s)) });
  const kaydet = async () => {
    try {
      const secenekler = f.secenekler.filter((s) => s.ad.trim() || s.secenekId).map((s) => ({ secenekId: s.secenekId, ad: s.ad, ekFiyat: s.ekFiyat ? paraOku(s.ekFiyat) : 0, aktif: s.aktif }));
      await AdisyonService.secenekGrupKaydet({ sgId: f.sgId, ad: f.ad, zorunlu: f.zorunlu, coklu: f.coklu, aktif: f.aktif, secenekler });
      showSuccess(`"${f.ad.trim()}" kaydedildi.`); setF(bos()); await yukle();
    } catch (e) { showError(hataMetni(e, "Seçenek grubu kaydedilemedi.")); }
  };
  const sil = async (g: SecenekGrubu) => {
    if (!window.confirm(`"${g.ad}" seçenek grubu silinsin mi?`)) return;
    try { await AdisyonService.secenekGrupSil(g.sgId); showSuccess("Silindi."); if (f.sgId === g.sgId) setF(bos()); await yukle(); } catch (e) { showError(hataMetni(e, "Silinemedi.")); }
  };
  return (
    <Row className="g-3">
      <Col lg={6}>
        <Card className="border shadow-xs">
          <Card.Header className="bg-light py-2 fw-bold small">Seçenek grupları (pişme derecesi, ekstralar, sos…)</Card.Header>
          <Table size="sm" hover className="mb-0 align-middle">
            <thead><tr><th>Grup</th><th>Seçenekler</th><th className="text-end">Ürün</th><th /></tr></thead>
            <tbody>
              {!gruplar.length && <tr><td colSpan={4} className="text-muted small">Henüz seçenek grubu yok.</td></tr>}
              {gruplar.map((g) => (
                <tr key={g.sgId} style={{ opacity: g.aktif ? 1 : 0.55 }}>
                  <td className="fw-semibold">{g.ad}<div className="d-flex gap-1 mt-1">{g.zorunlu && <Badge bg="warning" text="dark">Zorunlu</Badge>}<Badge bg="light" text="dark" className="border">{g.coklu ? "Çoklu seçim" : "Tek seçim"}</Badge>{!g.aktif && <Badge bg="secondary">Pasif</Badge>}</div></td>
                  <td className="small">{g.secenekler.map((s) => `${s.ad}${s.ekFiyat ? ` (+${para(s.ekFiyat)})` : ""}`).join(", ")}</td>
                  <td className="text-end">{g.kartSayisi}</td>
                  <td className="text-end text-nowrap">
                    <Button size="sm" variant="link" className="py-0" onClick={() => setF({ sgId: g.sgId, ad: g.ad, zorunlu: g.zorunlu, coklu: g.coklu, aktif: g.aktif, secenekler: g.secenekler.map((s) => ({ secenekId: s.secenekId, ad: s.ad, ekFiyat: s.ekFiyat ? String(s.ekFiyat).replace(".", ",") : "", aktif: s.aktif })) })}>Düzenle</Button>
                    <Button size="sm" variant="link" className="py-0 text-danger" aria-label={`${g.ad} sil`} onClick={() => void sil(g)}><IconTrash size={14} /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      </Col>
      <Col lg={6}>
        <Card className="border shadow-xs">
          <Card.Header className="bg-light py-2 fw-bold small">{f.sgId ? "Seçenek grubunu düzenle" : "Yeni seçenek grubu"}</Card.Header>
          <Card.Body>
            <Form.Group className="mb-2"><Form.Label className="small fw-bold mb-1">Grup adı</Form.Label><Form.Control size="sm" aria-label="Seçenek grubu adı" maxLength={60} value={f.ad} onChange={(e) => setF({ ...f, ad: e.target.value })} placeholder="Pişme derecesi" /></Form.Group>
            <div className="d-flex gap-3 mb-2">
              <Form.Check type="switch" id="sg-zorunlu" label="Zorunlu (sipariş seçmeden girilmez)" checked={f.zorunlu} onChange={(e) => setF({ ...f, zorunlu: e.target.checked })} />
              <Form.Check type="switch" id="sg-coklu" label="Çoklu seçim" checked={f.coklu} onChange={(e) => setF({ ...f, coklu: e.target.checked })} />
              <Form.Check type="switch" id="sg-aktif" label="Etkin" checked={f.aktif} onChange={(e) => setF({ ...f, aktif: e.target.checked })} />
            </div>
            <Table size="sm" className="mb-2 align-middle">
              <thead><tr><th>Seçenek</th><th style={{ width: 130 }}>Ek fiyat (TL)</th><th style={{ width: 60 }} className="text-center">Etkin</th><th style={{ width: 36 }} /></tr></thead>
              <tbody>
                {f.secenekler.map((s, i) => (
                  <tr key={i}>
                    <td><Form.Control size="sm" aria-label={`${i + 1}. seçenek adı`} maxLength={60} value={s.ad} onChange={(e) => satir(i, { ad: e.target.value })} /></td>
                    <td><Form.Control size="sm" aria-label={`${i + 1}. seçenek ek fiyatı`} inputMode="decimal" className="text-end" value={s.ekFiyat} placeholder="0" onChange={(e) => satir(i, { ekFiyat: sayiMetni(e.target.value) })} /></td>
                    <td className="text-center"><Form.Check aria-label={`${i + 1}. seçenek etkin`} checked={s.aktif} onChange={(e) => satir(i, { aktif: e.target.checked })} /></td>
                    <td><Button size="sm" variant="link" className="p-0 text-danger" aria-label={`${i + 1}. seçeneği kaldır`} onClick={() => setF({ ...f, secenekler: f.secenekler.filter((_, j) => j !== i) })}><IconX size={14} /></Button></td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <div className="d-flex gap-2">
              <Button size="sm" variant="outline-primary" onClick={() => setF({ ...f, secenekler: [...f.secenekler, { secenekId: null, ad: "", ekFiyat: "", aktif: true }] })}><IconPlus size={14} className="me-1" />Seçenek</Button>
              <Button size="sm" variant="success" disabled={!f.ad.trim()} onClick={() => void kaydet()}><IconDeviceFloppy size={14} className="me-1" />Kaydet</Button>
              {f.sgId && <Button size="sm" variant="outline-secondary" onClick={() => setF(bos())}>Vazgeç</Button>}
            </div>
          </Card.Body>
        </Card>
      </Col>
    </Row>
  );
};

// ───────────── Ürün porsiyon + seçenek bağı ─────────────
type PorsiyonSatiri = { ad: string; carpan: string; fiyat: string };
const UrunAyrinti: React.FC = () => {
  const { showSuccess, showError } = useToast();
  const [secici, setSecici] = useState(false);
  const [kart, setKart] = useState<StokKart | null>(null);
  const [gruplar, setGruplar] = useState<SecenekGrubu[]>([]);
  const [sec, setSec] = useState<number[]>([]);
  const [pors, setPors] = useState<PorsiyonSatiri[]>([]);
  useEffect(() => { AdisyonService.secenekGruplari().then(setGruplar).catch(() => setGruplar([])); }, []);
  const ac = async (k: StokKart) => {
    setSecici(false); setKart(k);
    try {
      const a = await AdisyonService.kartAyrintisi(k.stokKartId);
      setSec(a.secenekGrupIdler);
      setPors(a.porsiyonlar.map((p) => ({ ad: p.ad, carpan: String(p.carpan).replace(".", ","), fiyat: p.fiyat === null ? "" : String(p.fiyat).replace(".", ",") })));
    } catch (e) { showError(hataMetni(e, "Ürün ayrıntısı alınamadı.")); }
  };
  const kaydet = async () => {
    if (!kart) return;
    try {
      const a = await AdisyonService.kartAyrintisiKaydet(kart.stokKartId, { secenekGrupIdler: sec, porsiyonlar: pors.filter((p) => p.ad.trim()).map((p) => ({ ad: p.ad, carpan: p.carpan, fiyat: p.fiyat || null })) });
      setSec(a.secenekGrupIdler);
      showSuccess(`"${kart.ad}" için porsiyon ve seçenekler kaydedildi.`);
    } catch (e) { showError(hataMetni(e, "Kaydedilemedi.")); }
  };
  const satir = (i: number, d: Partial<PorsiyonSatiri>) => setPors(pors.map((p, j) => (j === i ? { ...p, ...d } : p)));
  const fiyat = kart?.satisFiyati ?? 0;
  return (
    <>
      <Card className="border shadow-xs mb-3">
        <Card.Body className="d-flex align-items-center gap-3 py-2">
          <Button size="sm" variant="primary" onClick={() => setSecici(true)}><IconListDetails size={14} className="me-1" />Ürün seç</Button>
          {kart ? <div><span className="font-monospace fw-bold me-2">{kart.kod}</span><span className="fw-semibold">{kart.ad}</span><span className="text-muted ms-2">Kart fiyatı {para(fiyat)} TL{kart.grupAdi ? ` · ${kart.grupAdi}` : ""}</span></div> : <span className="text-muted small">Porsiyon ve seçenek bağlamak için ürün seçin.</span>}
          {kart && <Button size="sm" variant="success" className="ms-auto" onClick={() => void kaydet()}><IconDeviceFloppy size={14} className="me-1" />Kaydet</Button>}
        </Card.Body>
      </Card>
      {kart && (
        <Row className="g-3">
          <Col lg={6}>
            <Card className="border shadow-xs h-100">
              <Card.Header className="bg-light py-2 fw-bold small">Porsiyonlar</Card.Header>
              <Card.Body>
                <Table size="sm" className="mb-2 align-middle">
                  <thead><tr><th>Ad</th><th style={{ width: 90 }}>Çarpan</th><th style={{ width: 120 }}>Sabit fiyat</th><th className="text-end" style={{ width: 110 }}>Satış</th><th style={{ width: 30 }} /></tr></thead>
                  <tbody>
                    {!pors.length && <tr><td colSpan={5} className="text-muted small">Porsiyon yok: ürün tek fiyatla satılır.</td></tr>}
                    {pors.map((p, i) => {
                      const c = miktarOku(p.carpan), f = p.fiyat ? paraOku(p.fiyat) : null;
                      return (
                        <tr key={i}>
                          <td><Form.Control size="sm" aria-label={`${i + 1}. porsiyon adı`} maxLength={30} value={p.ad} onChange={(e) => satir(i, { ad: e.target.value })} /></td>
                          <td><Form.Control size="sm" aria-label={`${i + 1}. porsiyon çarpanı`} inputMode="decimal" className="text-end" value={p.carpan} onChange={(e) => satir(i, { carpan: sayiMetni(e.target.value) })} /></td>
                          <td><Form.Control size="sm" aria-label={`${i + 1}. porsiyon sabit fiyatı`} inputMode="decimal" className="text-end" placeholder="çarpanla" value={p.fiyat} onChange={(e) => satir(i, { fiyat: sayiMetni(e.target.value) })} /></td>
                          <td className="text-end fw-semibold">{Number.isFinite(c) && c > 0 ? `${para(porsiyonFiyati(fiyat, c, f))} TL` : "—"}</td>
                          <td><Button size="sm" variant="link" className="p-0 text-danger" aria-label={`${i + 1}. porsiyonu kaldır`} onClick={() => setPors(pors.filter((_, j) => j !== i))}><IconX size={14} /></Button></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
                <Button size="sm" variant="outline-primary" onClick={() => setPors([...pors, { ad: pors.length ? "" : "Tam", carpan: "1", fiyat: "" }])}><IconPlus size={14} className="me-1" />Porsiyon</Button>
                <div className="small text-muted mt-2">Çarpan stoktan (reçeteden) düşülecek miktarı da belirler: yarım porsiyon 0,5, 1,5 porsiyon 1,5. Sabit fiyat yazılırsa satış o fiyattandır.</div>
              </Card.Body>
            </Card>
          </Col>
          <Col lg={6}>
            <Card className="border shadow-xs h-100">
              <Card.Header className="bg-light py-2 fw-bold small">Seçenek grupları (sipariş girerken sorulur)</Card.Header>
              <Card.Body>
                {!gruplar.length && <div className="text-muted small">Önce "Seçenek grupları" sekmesinde grup tanımlayın.</div>}
                {gruplar.filter((g) => g.aktif || sec.includes(g.sgId)).map((g) => (
                  <Form.Check key={g.sgId} id={`ks-${g.sgId}`} className="mb-1" checked={sec.includes(g.sgId)}
                    onChange={(e) => setSec(e.target.checked ? [...sec, g.sgId] : sec.filter((x) => x !== g.sgId))}
                    label={<span>{sec.includes(g.sgId) && <Badge bg="primary" className="me-1">{sec.indexOf(g.sgId) + 1}</Badge>}<span className="fw-semibold">{g.ad}</span> <span className="small text-muted">{g.zorunlu ? "zorunlu · " : ""}{g.secenekler.map((s) => s.ad).join(", ")}</span></span>} />
                ))}
                <div className="small text-muted mt-2">Numara, siparişte soruluş sırasıdır (işaretleme sırası).</div>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      )}
      <StokKartSecici show={secici} yalnizAktif onHide={() => setSecici(false)} onSelect={(k) => void ac(k)} />
    </>
  );
};

// ───────────── Garsonlar ─────────────
const Garsonlar: React.FC = () => {
  const { showSuccess, showError } = useToast();
  const [l, setL] = useState<GarsonListesi | null>(null);
  // 26.11.2026 G1–G4: garson Kullanıcı Tanımları'ndaki bir kullanıcıya bağlanır, o kullanıcının adı + şifresiyle girer (PIN yok)
  const bos = () => ({ garsonId: null as number | null, ad: "", kullaniciId: null as number | null, seviye: 1, ekYetki: [] as string[], aktif: true });
  const [f, setF] = useState(bos());
  const [kullanicilar, setKullanicilar] = useState<GarsonKullanicisi[] | null>(null);
  const yukle = useCallback(async () => {
    try { const [g, k] = await Promise.all([AdisyonService.garsonlar(), AdisyonService.garsonKullanicilari()]); setL(g); setKullanicilar(k); }
    catch (e) { showError(hataMetni(e, "Garsonlar alınamadı.")); }
  }, [showError]);
  useEffect(() => { void yukle(); }, [yukle]);
  const seviyeYetki = useMemo(() => yetkiKumesi(f.seviye, []), [f.seviye]);
  const eskiKullanici = f.garsonId ? l?.garsonlar.find((x) => x.garsonId === f.garsonId)?.kullaniciId ?? null : null;
  const secilen = kullanicilar?.find((k) => k.kullaniciId === f.kullaniciId) || null;
  const kaydet = async () => {
    try {
      await AdisyonService.garsonKaydet({ garsonId: f.garsonId, ad: f.ad, kullaniciId: f.kullaniciId, seviye: f.seviye, ekYetki: f.ekYetki.filter((x) => !seviyeYetki.has(x as Yetki)), aktif: f.aktif });
      showSuccess(`"${(f.ad.trim() || secilen?.ad || "").trim()}" kaydedildi${f.garsonId && eskiKullanici !== null && eskiKullanici !== f.kullaniciId ? "; kullanıcı değişti, açık garson oturumları kapandı" : ""}.`);
      setF(bos()); await yukle();
    } catch (e) { showError(hataMetni(e, "Garson kaydedilemedi.")); }
  };
  const sil = async (g: Garson) => {
    if (!window.confirm(`"${g.ad}" silinsin mi? Adisyon geçmişi varsa pasif yapılır.`)) return;
    try { const r = await AdisyonService.garsonSil(g.garsonId); showSuccess(r.silindi ? "Silindi." : "Geçmişi olduğu için pasif yapıldı."); if (f.garsonId === g.garsonId) setF(bos()); await yukle(); } catch (e) { showError(hataMetni(e, "Silinemedi.")); }
  };
  const sinirDolu = !!l && l.limit !== null && l.aktifSayi >= l.limit;
  const yeniEngelli = sinirDolu && f.aktif && (!f.garsonId || !l?.garsonlar.find((x) => x.garsonId === f.garsonId)?.aktif);
  return (
    <Row className="g-3">
      <Col lg={7}>
        <Card className="border shadow-xs">
          <Card.Header className="bg-light py-2 small d-flex justify-content-between">
            <span className="fw-bold">Garsonlar</span>
            {l && <span className={sinirDolu ? "text-danger fw-bold" : "text-muted"}>Etkin garson: {l.aktifSayi}{l.limit !== null ? ` / ${l.limit} (lisans)` : ""}</span>}
          </Card.Header>
          <Table size="sm" hover className="mb-0 align-middle">
            <thead><tr><th>Ad</th><th>Kullanıcı</th><th>Seviye</th><th>Ek yetki</th><th>Son giriş</th><th /></tr></thead>
            <tbody>
              {l && !l.garsonlar.length && <tr><td colSpan={6} className="text-muted small">Henüz garson yok.</td></tr>}
              {l?.garsonlar.map((g) => (
                <tr key={g.garsonId} style={{ opacity: g.aktif ? 1 : 0.55 }}>
                  <td className="fw-semibold">{g.ad} {!g.aktif && <Badge bg="secondary">Pasif</Badge>} {g.kilitli && <Badge bg="danger">Kilitli</Badge>}</td>
                  <td className="small">{g.kullaniciAdi || <Badge bg="warning" text="dark" title="Garson giriş yapamaz: Düzenle'den kullanıcı seçin">Kullanıcı yok</Badge>}</td>
                  <td>{SEVIYE_ADI[g.seviye] || g.seviye}</td>
                  <td className="small">{g.ekYetki.map((x) => YETKI_ADI[x as Yetki] || x).join(", ") || <span className="text-muted">—</span>}</td>
                  <td className="small">{g.sonGiris ? new Date(g.sonGiris).toLocaleString("tr-TR") : <span className="text-muted">—</span>}</td>
                  <td className="text-end text-nowrap">
                    <Button size="sm" variant="link" className="py-0" onClick={() => setF({ garsonId: g.garsonId, ad: g.ad, kullaniciId: g.kullaniciId, seviye: g.seviye, ekYetki: g.ekYetki, aktif: g.aktif })}>Düzenle</Button>
                    <Button size="sm" variant="link" className="py-0 text-danger" aria-label={`${g.ad} sil`} onClick={() => void sil(g)}><IconTrash size={14} /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      </Col>
      <Col lg={5}>
        <Card className="border shadow-xs">
          <Card.Header className="bg-light py-2 fw-bold small">{f.garsonId ? "Garsonu düzenle" : "Yeni garson"}</Card.Header>
          <Card.Body>
            <Form.Group className="mb-2">
              <Form.Label className="small fw-bold mb-1">Kullanıcı (giriş adı + şifresi)</Form.Label>
              <Form.Select size="sm" aria-label="Garson kullanıcısı" value={f.kullaniciId ?? ""} onChange={(e) => setF({ ...f, kullaniciId: e.target.value ? Number(e.target.value) : null })}>
                <option value="">— Kullanıcı seçin —</option>
                {(kullanicilar || []).map((k) => {
                  const baskasinda = k.garsonId !== null && k.garsonId !== f.garsonId;
                  return <option key={k.kullaniciId} value={k.kullaniciId} disabled={baskasinda}>{k.ad}{baskasinda ? ` (${k.garsonAd} garsonuna bağlı)` : ""}</option>;
                })}
              </Form.Select>
              {kullanicilar && !kullanicilar.length && <div className="small text-danger mt-1">Kullanıcı yok. Önce Ayarlar › Kullanıcı Tanımları'ndan garson için kullanıcı açın.</div>}
            </Form.Group>
            <Form.Group className="mb-2">
              <Form.Label className="small fw-bold mb-1">Görünen ad <span className="fw-normal text-muted">(boş: kullanıcı adı)</span></Form.Label>
              <Form.Control size="sm" aria-label="Garson adı" maxLength={60} value={f.ad} placeholder={secilen?.ad || ""} onChange={(e) => setF({ ...f, ad: e.target.value })} />
            </Form.Group>
            <Form.Group className="mb-2">
              <Form.Label className="small fw-bold mb-1">Yetki seviyesi</Form.Label>
              <Form.Select size="sm" aria-label="Yetki seviyesi" value={f.seviye} onChange={(e) => setF({ ...f, seviye: Number(e.target.value) })}>
                {[1, 2, 3].map((s) => <option key={s} value={s}>{SEVIYE_ADI[s]}</option>)}
              </Form.Select>
            </Form.Group>
            <div className="small fw-bold mb-1">Yetkiler</div>
            <div className="d-flex flex-wrap gap-1 mb-2">
              {YETKILER.map((y) => {
                const seviyeden = seviyeYetki.has(y);
                const ek = f.ekYetki.includes(y);
                return (
                  <Button key={y} size="sm" variant={seviyeden ? "secondary" : ek ? "primary" : "outline-secondary"} disabled={seviyeden} title={seviyeden ? "Seviyeyle gelir" : "Ek yetki"}
                    onClick={() => setF((o) => ({ ...o, ekYetki: o.ekYetki.includes(y) ? o.ekYetki.filter((x) => x !== y) : [...o.ekYetki, y] }))} style={{ fontSize: 12 }}>
                    {YETKI_ADI[y]}
                  </Button>
                );
              })}
            </div>
            <div className="small text-muted mb-2">Gri: seviyeyle gelir. Mavi: bu garsona ayrıca verilen yetki.</div>
            <Form.Check type="switch" id="garson-aktif" className="mb-2" label="Etkin" checked={f.aktif} onChange={(e) => setF({ ...f, aktif: e.target.checked })} />
            {yeniEngelli && <Alert variant="warning" className="py-1 small">Lisanstaki garson sınırı ({l?.limit}) dolu. Yeni etkin garson için önce bir garsonu pasif yapın.</Alert>}
            <div className="d-flex gap-2">
              <Button size="sm" variant="success" disabled={!f.kullaniciId || yeniEngelli} onClick={() => void kaydet()}><IconDeviceFloppy size={14} className="me-1" />Kaydet</Button>
              {f.garsonId && <Button size="sm" variant="outline-secondary" onClick={() => setF(bos())}>Vazgeç</Button>}
            </div>
            <div className="small text-muted mt-2">Garson telefondan (/garson) müşteri no + seçilen kullanıcının adı ve şifresiyle girer; şifre normal girişle aynıdır. Yetkiler bu karttan gelir. Kullanıcı lisanstaki kullanıcı sayısından sayılır.</div>
          </Card.Body>
        </Card>
      </Col>
    </Row>
  );
};

export const AdisyonTanimlarPage: React.FC = () => {
  const [sekme, setSekme] = useState("masa");
  return (
    <div className="container-fluid py-3">
      <ERPToolbar pageTitle="Adisyon Tanımları" pageIcon={<IconLayoutGrid size={20} />} hideNew hideDelete hideSearch hideNavigation hidePrint hideSave />
      <Tab.Container activeKey={sekme} onSelect={(k) => setSekme(k || "masa")}>
        <Nav variant="pills" className="mb-3 gap-1">
          <Nav.Item><Nav.Link eventKey="masa"><IconLayoutGrid size={15} className="me-1" />Bölge / Masa</Nav.Link></Nav.Item>
          <Nav.Item><Nav.Link eventKey="hazirlik"><IconChefHat size={15} className="me-1" />Hazırlık yerleri</Nav.Link></Nav.Item>
          <Nav.Item><Nav.Link eventKey="secenek"><IconListDetails size={15} className="me-1" />Seçenek grupları</Nav.Link></Nav.Item>
          <Nav.Item><Nav.Link eventKey="urun"><IconToolsKitchen2 size={15} className="me-1" />Ürün porsiyon / seçenek</Nav.Link></Nav.Item>
          <Nav.Item><Nav.Link eventKey="garson"><IconUserCircle size={15} className="me-1" />Garsonlar</Nav.Link></Nav.Item>
        </Nav>
        <Tab.Content>
          <Tab.Pane eventKey="masa" mountOnEnter unmountOnExit><BolgeMasa /></Tab.Pane>
          <Tab.Pane eventKey="hazirlik" mountOnEnter unmountOnExit><Hazirlik /></Tab.Pane>
          <Tab.Pane eventKey="secenek" mountOnEnter unmountOnExit><Secenekler /></Tab.Pane>
          <Tab.Pane eventKey="urun" mountOnEnter unmountOnExit><UrunAyrinti /></Tab.Pane>
          <Tab.Pane eventKey="garson" mountOnEnter unmountOnExit><Garsonlar /></Tab.Pane>
        </Tab.Content>
      </Tab.Container>
    </div>
  );
};

export default AdisyonTanimlarPage;
