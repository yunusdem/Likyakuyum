import { miktarOku } from "../../utils/sayiGirisi";
import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Alert, Badge, Button, Card, Col, Form, InputGroup, Row, Spinner, Table } from "react-bootstrap";
import { IconArrowBackUp, IconBinoculars, IconFileInvoice, IconTrash } from "@tabler/icons-react";
import ERPToolbar from "../../components/common/ERPToolbar";
import { LookupModal } from "../../components/common/LookupModal";
import { useToast } from "../../context/ToastContext";
import { CariKartItem, CariService } from "../../services/cariService";
import { PosCihaziItem, PosCihaziService } from "../../services/posCihaziService";
import { BankaHesapItem, BankaService } from "../../services/bankaService";
import { TicariIadeKaynagi, TicariOdeme, TicariSatisListeSatiri, TicariService, miktarYaz, para } from "../../services/ticariService";
import { iadeSatirTutari } from "../../../Backend/src/services/ticari/ticariHesap";

/**
 * Ticari › Satış İadesi (docs/TICARI_ADISYON_YOL_HARITASI.md, TA6). Asıl satış fişi seçilir, satır başına iade miktarı
 * (kalan kadar) girilir; tutar asıl satırdan orantılı (son iade kalanı alır, sunucuyla aynı fonksiyon). Para iadesi nakit /
 * cari / banka / POS (kayıt). Kayıttan sonra asıl fiş e-Arşiv gittiyse e-Gider Pusulası (iade) taslağı açılır.
 * Adres: ?fis=<asıl fiş> önceden seçer, ?iade=<iade fişi> kayıtlı iadeyi gösterir (silme).
 */
type OdemeTuru = 0 | 1 | 2 | 3;
const NEDENLER = ["Müşteri vazgeçti", "Ayıplı / bozuk ürün", "Yanlış ürün verildi", "Son kullanma tarihi geçmiş", "Diğer"];
const sayi = (v: string): number => { const n = miktarOku(v); return Number.isFinite(n) ? n : 0; }; // miktar: "1.5" = "1,5" = 1,5 (öbür fişlerle aynı)
const metin = (n: number) => String(Math.round(n * 10000) / 10000).replace(".", ",");
const tarihYaz = (t: string) => new Date(t).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" });

export const TicariIadeFisiPage: React.FC = () => {
  const { showSuccess, showError, showWarning } = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const [kaynak, setKaynak] = useState<TicariIadeKaynagi | null>(null);
  const [miktarlar, setMiktarlar] = useState<Record<number, string>>({});
  const [neden, setNeden] = useState(NEDENLER[0]);
  const [nedenAciklama, setNedenAciklama] = useState("");
  const [odemeTuru, setOdemeTuru] = useState<OdemeTuru>(0);
  const [cari, setCari] = useState<{ id: number; kod: string; ad: string } | null>(null);
  const [bankaId, setBankaId] = useState<number | null>(null);
  const [posId, setPosId] = useState<number | null>(null);
  const [fisNo, setFisNo] = useState("");
  const [secici, setSecici] = useState(false);
  const [fisler, setFisler] = useState<TicariSatisListeSatiri[]>([]);
  const [cariSecici, setCariSecici] = useState(false);
  const [cariler, setCariler] = useState<CariKartItem[] | null>(null);
  const [bankalar, setBankalar] = useState<BankaHesapItem[]>([]);
  const [poslar, setPoslar] = useState<PosCihaziItem[]>([]);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [kaydediliyor, setKaydediliyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [sonuc, setSonuc] = useState<Awaited<ReturnType<typeof TicariService.iadeGetir>> | null>(null);

  useEffect(() => {
    BankaService.getBankalar().then(setBankalar).catch(() => setBankalar([]));
    PosCihaziService.getPosCihazlari().then(setPoslar).catch(() => setPoslar([]));
  }, []);

  const fisAc = async (asilId: number) => {
    setYukleniyor(true);
    setHata(null);
    setSonuc(null);
    try {
      const k = await TicariService.iadeKaynak(asilId);
      setKaynak(k);
      setMiktarlar({});
      setCari(k.fis.cariKartId ? { id: k.fis.cariKartId, kod: k.fis.cariKod || "", ad: k.fis.cariAd || k.fis.aliciUnvan } : null);
      setFisNo(k.fis.faturaNo);
      // F11: para iadesi varsayılan olarak asıl fişte en çok ödenen türle (kartla ödendiyse POS, o POS kartı seçili)
      const baskin = [...(k.asilOdemeler || [])].sort((a, b) => b.tutar - a.tutar)[0];
      const tur = baskin && [0, 1, 2, 3].includes(baskin.odemeAraciTuru) ? (baskin.odemeAraciTuru as OdemeTuru) : 0;
      setOdemeTuru(tur);
      if (tur === 2 && baskin?.posCihaziId) setPosId(baskin.posCihaziId);
      if (k.satirlar.every((s) => s.kalan <= 0)) showWarning(`${k.fis.faturaNo} numaralı fişin bütün satırları iade edilmiş.`, 5000);
    } catch (e: any) {
      setKaynak(null);
      setHata(e?.message || "Satış fişi okunamadı.");
    } finally {
      setYukleniyor(false);
    }
  };

  // Adres: ?fis= (asıl fiş) ya da ?iade= (kayıtlı iade)
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    const fis = Number(q.get("fis"));
    const iade = Number(q.get("iade"));
    if (iade > 0) {
      TicariService.iadeGetir(iade).then((x) => { setSonuc(x); setKaynak(null); }).catch((e) => setHata(e?.message || "İade fişi okunamadı."));
    } else if (fis > 0) void fisAc(fis);
  }, [location.search]); // eslint-disable-line react-hooks/exhaustive-deps

  const fisBul = async () => {
    const no = fisNo.trim();
    if (!no) { void seciciAc(); return; }
    const l = await TicariService.satisListe({ arama: no, tip: 1, limit: 20 }).catch(() => [] as TicariSatisListeSatiri[]);
    const tam = l.find((x) => x.faturaNo.toLocaleUpperCase("tr-TR") === no.toLocaleUpperCase("tr-TR")) || (l.length === 1 ? l[0] : undefined);
    if (tam) void fisAc(tam.faturaId);
    else { setFisler(l); setSecici(true); }
  };
  const seciciAc = async () => {
    setFisler(await TicariService.satisListe({ tip: 1, limit: 200 }).catch(() => [] as TicariSatisListeSatiri[]));
    setSecici(true);
  };

  // Satır tutarları sunucuyla aynı fonksiyondan (son iade kalanı alır)
  const hesap = useMemo(() => {
    if (!kaynak) return { satirlar: [] as { satirNo: number; miktar: number; toplam: number; hata: string | null }[], toplam: 0 };
    const satirlar = kaynak.satirlar.map((s) => {
      const m = sayi(miktarlar[s.satirNo] || "");
      if (!(m > 0)) return { satirNo: s.satirNo, miktar: 0, toplam: 0, hata: null };
      try {
        const r = iadeSatirTutari(s.asil, s.onceki, m);
        return { satirNo: s.satirNo, miktar: m, toplam: r.toplamTutar, hata: null };
      } catch (e: any) {
        return { satirNo: s.satirNo, miktar: m, toplam: 0, hata: e?.message || "Geçersiz miktar." };
      }
    });
    return { satirlar, toplam: Math.round(satirlar.reduce((t, x) => t + x.toplam, 0) * 100) / 100 };
  }, [kaynak, miktarlar]);
  const gecerli = hesap.toplam > 0 && hesap.satirlar.every((x) => !x.hata);

  const tumunuIade = () => kaynak && setMiktarlar(Object.fromEntries(kaynak.satirlar.filter((s) => s.kalan > 0).map((s) => [s.satirNo, metin(s.kalan)])));

  const kaydet = async () => {
    if (!kaynak || !gecerli || kaydediliyor) return;
    if (odemeTuru === 1 && !cari) return showError("Cariye iade için cari seçin.");
    if (odemeTuru === 3 && !bankaId) return showError("Banka hesabı seçin.");
    if (odemeTuru === 2 && !posId) return showError("POS cihazı seçin.");
    // T9: karta iade, asıl fişte kartla ödenenden fazla olamaz (sunucu da reddeder)
    if (odemeTuru === 2 && kaynak.kartaIadeSiniri !== undefined && hesap.toplam - kaynak.kartaIadeSiniri > 0.005)
      return showError(`Karta en çok ${para(kaynak.kartaIadeSiniri)} TL iade edilebilir (asıl fişte kartla ödenen). Nakit iade seçin.`);
    if (!window.confirm(`${para(hesap.toplam)} TL iade edilecek. Onaylıyor musunuz?`)) return;
    const banka = bankalar.find((b) => b.bankaId === bankaId);
    const pos = poslar.find((p) => p.posCihaziId === posId);
    const odeme: TicariOdeme = {
      satirNo: 1, odemeAraciTuru: odemeTuru, tutar: hesap.toplam, kur: 1, miktar: hesap.toplam, paraKodu: "TL",
      paraAdi: odemeTuru === 2 ? "KREDİ KARTI / POS" : odemeTuru === 3 ? "BANKA HAVALE / EFT" : odemeTuru === 1 ? "VERESİYE" : "TÜRK LİRASI",
      cariKartId: odemeTuru === 1 ? cari?.id ?? null : odemeTuru === 3 ? bankaId : null,
      cariKod: odemeTuru === 1 ? cari?.kod ?? null : odemeTuru === 3 ? banka?.hesapNo ?? null : odemeTuru === 2 ? pos?.kod ?? null : null,
      cariUnvan: odemeTuru === 1 ? cari?.ad ?? null : null,
      posCihaziId: odemeTuru === 2 ? posId : null,
    } as TicariOdeme;
    setKaydediliyor(true);
    try {
      const r = await TicariService.iadeKaydet({
        asilFaturaId: kaynak.fis.faturaId,
        neden: neden === "Diğer" ? nedenAciklama.trim() || "Diğer" : nedenAciklama.trim() ? `${neden} — ${nedenAciklama.trim()}` : neden,
        satirlar: hesap.satirlar.filter((x) => x.miktar > 0).map((x) => ({ asilSatirNo: x.satirNo, miktar: x.miktar })),
        odemeler: [odeme],
      });
      showSuccess(`İade fişi ${r.faturaNo} kaydedildi.`);
      setSonuc(r);
      setKaynak(null);
      navigate(`/ticari/iade-fisi?iade=${r.faturaId}`, { replace: true });
    } catch (e: any) {
      showError(e?.message || "İade kaydedilemedi.");
    } finally {
      setKaydediliyor(false);
    }
  };

  const iadeSil = async () => {
    if (!sonuc || !window.confirm(`${sonuc.faturaNo} iade fişi silinecek; stok ve para iadesi geri alınır. Emin misiniz?`)) return;
    try {
      await TicariService.iadeSil(sonuc.faturaId);
      showSuccess(`${sonuc.faturaNo} silindi.`);
      const asil = sonuc.asil?.faturaId;
      setSonuc(null);
      navigate(asil ? `/ticari/iade-fisi?fis=${asil}` : "/ticari/iade-fisi", { replace: true });
    } catch (e: any) {
      showError(e?.message || "İade fişi silinemedi.");
    }
  };

  const yeni = () => { setKaynak(null); setSonuc(null); setFisNo(""); setMiktarlar({}); setHata(null); navigate("/ticari/iade-fisi", { replace: true }); };

  return (
    <div className="container-fluid p-2">
      <ERPToolbar pageTitle="Q- Satış İadesi" pageIcon={<IconArrowBackUp size={20} />} onNew={yeni} onSave={kaynak ? kaydet : undefined}
        hideDelete hidePrint hideSave={!kaynak} disabled={kaydediliyor} />
      {hata && <Alert variant="danger" className="py-2">{hata}</Alert>}

      {sonuc ? (
        <Card className="border shadow-xs">
          <Card.Body>
            <div className="d-flex flex-wrap justify-content-between align-items-start gap-2">
              <div>
                <div className="fs-5 fw-bold"><Badge bg="danger" className="me-2">İADE</Badge>{sonuc.faturaNo}</div>
                <div className="text-muted small">{tarihYaz(sonuc.tarih)} · Asıl fiş {sonuc.asil?.faturaNo} ({sonuc.asil ? tarihYaz(sonuc.asil.tarih) : ""}) · {sonuc.aliciUnvan}</div>
                {sonuc.neden && <div className="small mt-1">Neden: {sonuc.neden}</div>}
              </div>
              <div className="text-end">
                <div className="small text-muted">İade tutarı</div>
                <div className="fw-bold text-danger" style={{ fontSize: 30 }}>{para(sonuc.genelToplam)} TL</div>
              </div>
            </div>
            <Table size="sm" bordered className="mt-2 mb-2">
              <thead className="table-light"><tr className="small"><th>Ürün</th><th className="text-end">Miktar</th><th className="text-end">Tutar</th></tr></thead>
              <tbody>{sonuc.satirlar.map((s: any) => <tr key={s.satirNo}><td>{s.urunAdi}</td><td className="text-end">{miktarYaz(s.miktar)} {s.birim}</td><td className="text-end">{para(s.toplamTutar)}</td></tr>)}</tbody>
            </Table>
            <div className="small text-muted mb-2">Para iadesi: {sonuc.odemeler.map((o: any) => `${o.paraAdi || o.paraKodu} ${para(o.tutar)}`).join(", ")}</div>
            <div className="d-flex flex-wrap gap-2">
              <Button variant="primary" onClick={() => navigate(`/e-belge/gider?tur=genel&ticariIade=${sonuc.faturaId}`)}>
                <IconFileInvoice size={16} className="me-1" />e-Gider Pusulası (iade) hazırla
              </Button>
              <Button variant="outline-secondary" onClick={yeni}>Yeni iade</Button>
              <Button variant="outline-danger" className="ms-auto" onClick={() => void iadeSil()}><IconTrash size={16} className="me-1" />İade fişini sil</Button>
            </div>
            {sonuc.asil && (sonuc.asil.eBelgeDurumu === 1 || sonuc.asil.eBelgeDurumu === 2)
              ? <Alert variant="info" className="py-2 mt-2 mb-0 small">Asıl fiş e-Arşiv olarak gönderilmiş. İade için e-Gider Pusulası (iade) düzenleyin; taslak bu iadeyle dolu açılır, gönderim elle.</Alert>
              : <div className="small text-muted mt-2">Asıl fiş e-Belge olarak gönderilmemiş; e-Gider Pusulası isteğe bağlıdır.</div>}
          </Card.Body>
        </Card>
      ) : (
        <>
          <Card className="border shadow-xs mb-2">
            <Card.Body className="p-2">
              <Row className="g-2 align-items-end">
                <Col md={5}>
                  <Form.Label className="small fw-bold mb-1">İadesi alınacak satış fişi</Form.Label>
                  <InputGroup size="sm">
                    <Form.Control value={fisNo} placeholder="Fiş numarası (ör. EAR2026000000012) ya da boş bırakıp ara" onChange={(e) => setFisNo(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void fisBul(); } }} aria-label="Satış fişi numarası" />
                    <Button variant="primary" disabled={yukleniyor} onClick={() => void fisBul()}>{yukleniyor ? <Spinner size="sm" /> : "Getir"}</Button>
                    <Button variant="outline-secondary" title="Son satış fişleri" onClick={() => void seciciAc()}><IconBinoculars size={16} /></Button>
                  </InputGroup>
                </Col>
                {kaynak && (
                  <Col md={7} className="small">
                    <div><b>{kaynak.fis.faturaNo}</b> · {tarihYaz(kaynak.fis.tarih)} · {kaynak.fis.aliciUnvan} · Toplam <b>{para(kaynak.fis.genelToplam)} TL</b>
                      {kaynak.fis.eBelgeDurumu === 1 || kaynak.fis.eBelgeDurumu === 2 ? <Badge bg="success" className="ms-1">e-Arşiv gönderildi</Badge> : <Badge bg="secondary" className="ms-1">e-Belge yok</Badge>}</div>
                    {kaynak.oncekiIadeler.length > 0 && <div className="text-danger">Önceki iadeler: {kaynak.oncekiIadeler.map((x) => `${x.faturaNo} (${para(x.tutar)})`).join(", ")}</div>}
                  </Col>
                )}
              </Row>
            </Card.Body>
          </Card>

          {kaynak && (
            <Row className="g-2">
              <Col lg={8}>
                <Card className="border shadow-xs h-100">
                  <Card.Header className="bg-light py-2 d-flex justify-content-between align-items-center">
                    <span className="fw-bold small">Satırlar</span>
                    <Button size="sm" variant="outline-danger" onClick={tumunuIade} disabled={kaynak.satirlar.every((s) => s.kalan <= 0)}>Tümünü iade</Button>
                  </Card.Header>
                  <Card.Body className="p-0">
                    <Table size="sm" hover className="align-middle mb-0" style={{ fontSize: 13 }}>
                      <thead className="table-light"><tr className="small text-secondary"><th>Ürün</th><th className="text-end">Satılan</th><th className="text-end">İade edilen</th><th className="text-end">Kalan</th><th className="text-end">Net fiyat</th><th style={{ width: 120 }} className="text-end">İade miktarı</th><th className="text-end">İade tutarı</th></tr></thead>
                      <tbody>
                        {kaynak.satirlar.map((s) => {
                          const h = hesap.satirlar.find((x) => x.satirNo === s.satirNo);
                          return (
                            <tr key={s.satirNo} className={s.kalan <= 0 ? "text-muted" : undefined}>
                              <td className="fw-semibold">{s.ad} {s.kod && <span className="text-muted small font-monospace">{s.kod}</span>}</td>
                              <td className="text-end">{miktarYaz(s.satilan)} {s.birim}</td>
                              <td className="text-end">{s.iadeEdilen > 0 ? miktarYaz(s.iadeEdilen) : "—"}</td>
                              <td className="text-end fw-semibold">{miktarYaz(s.kalan)}</td>
                              <td className="text-end">{para(s.netBirimFiyat)}</td>
                              <td>
                                <Form.Control size="sm" className={`text-end ${h?.hata ? "is-invalid" : ""}`} inputMode="decimal" disabled={s.kalan <= 0} value={miktarlar[s.satirNo] || ""}
                                  placeholder="0" title={h?.hata || undefined} aria-label={`${s.ad} iade miktarı`}
                                  onChange={(e) => setMiktarlar((p) => ({ ...p, [s.satirNo]: e.target.value.replace(/[^0-9.,]/g, "") }))} />
                              </td>
                              <td className="text-end fw-semibold">{h && h.toplam > 0 ? para(h.toplam) : ""}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </Table>
                    {hesap.satirlar.some((x) => x.hata) && <div className="small text-danger p-2">{hesap.satirlar.find((x) => x.hata)?.hata}</div>}
                  </Card.Body>
                </Card>
              </Col>
              <Col lg={4}>
                <Card className="border shadow-xs h-100">
                  <Card.Body className="p-3 d-flex flex-column gap-2">
                    <div>
                      <Form.Label className="small fw-bold mb-1">İade nedeni</Form.Label>
                      <Form.Select size="sm" value={neden} onChange={(e) => setNeden(e.target.value)}>{NEDENLER.map((n) => <option key={n}>{n}</option>)}</Form.Select>
                      <Form.Control size="sm" className="mt-1" maxLength={150} value={nedenAciklama} placeholder="Açıklama (isteğe bağlı)" onChange={(e) => setNedenAciklama(e.target.value)} />
                    </div>
                    <div>
                      <Form.Label className="small fw-bold mb-1">Para iadesi</Form.Label>
                      {(kaynak.asilOdemeler?.length || 0) > 0 && (
                        <div className="small text-muted mb-1" aria-label="Asıl fişin ödemesi">
                          Asıl ödeme: {kaynak.asilOdemeler!.map((o) => `${({ 0: "Nakit", 1: "Cari", 2: "POS", 3: "Banka" } as Record<number, string>)[o.odemeAraciTuru] || "Diğer"} ${para(o.tutar)}`).join(" · ")}
                          {(kaynak.kartaIadeSiniri ?? 0) > 0 || kaynak.asilOdemeler!.some((o) => o.odemeAraciTuru === 2) ? ` (karta en çok ${para(kaynak.kartaIadeSiniri ?? 0)} TL iade edilir)` : ""}
                        </div>
                      )}
                      <div className="d-flex flex-wrap gap-3 small">
                        {([[0, "Nakit (vezne)"], [1, "Cariye"], [3, "Banka"], [2, "POS"]] as [OdemeTuru, string][]).map(([t, ad]) => (
                          <Form.Check key={t} type="radio" id={`iade-odeme-${t}`} name="iade-odeme" label={ad} checked={odemeTuru === t} onChange={() => setOdemeTuru(t)} />
                        ))}
                      </div>
                      {odemeTuru === 1 && (
                        <InputGroup size="sm" className="mt-1">
                          <Form.Control readOnly value={cari ? `${cari.kod} ${cari.ad}` : ""} placeholder="Cari seçin" style={{ cursor: "pointer" }}
                            onClick={() => { setCariSecici(true); if (!cariler) CariService.getCariKartlar().then(setCariler).catch(() => setCariler([])); }} />
                          <Button variant="outline-secondary" onClick={() => { setCariSecici(true); if (!cariler) CariService.getCariKartlar().then(setCariler).catch(() => setCariler([])); }}>Seç</Button>
                        </InputGroup>
                      )}
                      {odemeTuru === 3 && (
                        <Form.Select size="sm" className="mt-1" value={bankaId ?? ""} onChange={(e) => setBankaId(e.target.value ? Number(e.target.value) : null)}>
                          <option value="">Banka hesabı seçin</option>
                          {bankalar.map((b) => <option key={b.bankaId} value={b.bankaId}>{b.hesapAdi} — {b.hesapNo}</option>)}
                        </Form.Select>
                      )}
                      {odemeTuru === 2 && (
                        <>
                          <Form.Select size="sm" className="mt-1" value={posId ?? ""} onChange={(e) => setPosId(e.target.value ? Number(e.target.value) : null)}>
                            <option value="">POS cihazı seçin</option>
                            {poslar.map((p) => <option key={p.posCihaziId} value={p.posCihaziId}>{p.kod} {p.ad}</option>)}
                          </Form.Select>
                          <div className="small text-muted mt-1">Kayıt amaçlıdır; karta iadeyi POS cihazından ya da Banka › POS İşlemleri'nden yapın.</div>
                        </>
                      )}
                    </div>
                    <div className="mt-auto border-top pt-2 d-flex justify-content-between align-items-end">
                      <span className="text-muted small">İade tutarı</span>
                      <span className="fw-bold text-danger" style={{ fontSize: 28 }}>{para(hesap.toplam)} TL</span>
                    </div>
                    <Button variant="danger" disabled={!gecerli || kaydediliyor} onClick={() => void kaydet()}>
                      {kaydediliyor ? <Spinner size="sm" className="me-1" /> : <IconArrowBackUp size={16} className="me-1" />}İadeyi kaydet (F1)
                    </Button>
                  </Card.Body>
                </Card>
              </Col>
            </Row>
          )}
          {!kaynak && !yukleniyor && <div className="text-muted small p-3">Satış fişi numarasını yazıp Getir'e basın ya da dürbünden seçin. Satış Listesi'nden ve Hızlı Satış › Fişler'den de "İade al" ile gelinir.</div>}
        </>
      )}

      <LookupModal<TicariSatisListeSatiri> show={secici} onHide={() => setSecici(false)} title="Satış fişi seç" items={fisler}
        columns={[
          { header: "Fiş No", width: "170px", render: (x) => <span className="font-monospace">{x.faturaNo}</span>, highlight: true },
          { header: "Tarih", width: "130px", render: (x) => tarihYaz(x.tarih) },
          { header: "Alıcı", render: (x) => x.aliciUnvan },
          { header: "Tutar", width: "100px", align: "right", render: (x) => para(x.genelToplam) },
        ]}
        filterFn={(x, t) => `${x.faturaNo} ${x.aliciUnvan}`.toLocaleLowerCase("tr-TR").includes(t.toLocaleLowerCase("tr-TR"))}
        onSelect={(x) => { setSecici(false); void fisAc(x.faturaId); }} />
      <LookupModal<CariKartItem> show={cariSecici} onHide={() => setCariSecici(false)} title="Cari seç" items={cariler || []} isLoading={!cariler}
        columns={[{ header: "Kod", width: "120px", render: (x) => x.kod, highlight: true }, { header: "Ad", render: (x) => x.ad }]}
        filterFn={(x, t) => `${x.kod} ${x.ad}`.toLocaleLowerCase("tr-TR").includes(t.toLocaleLowerCase("tr-TR"))}
        onSelect={(x) => { setCariSecici(false); setCari({ id: x.id, kod: x.kod, ad: x.ad }); }} />
    </div>
  );
};

export default TicariIadeFisiPage;
