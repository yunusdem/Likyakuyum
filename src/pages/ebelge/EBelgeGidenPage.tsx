import React, { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Alert, Badge, Button, Card, Col, Form, Modal, Row, Spinner, Table } from "react-bootstrap";
import { IconSend, IconAlertTriangle, IconMail, IconPrinter } from "@tabler/icons-react";

import ERPToolbar from "../../components/common/ERPToolbar";
import EBelgeArsivPanel from "./EBelgeArsivPanel";
import EBelgeYerelTaslaklar from "./EBelgeYerelTaslaklar";
import {
  EbelgeGidenSatiri,
  ebelgeGidenDurumRozet,
  ebelgeService,
  ebelgeTarihSaat,
  ebelgeTutar,
} from "../../services/ebelgeService";

/**
 * E-Belge Giden Kutusu (Faz 6)
 *
 * Bu ekranda **GİB'e gönderim yoktur**. Belgeler entegratörde taslak olarak durur;
 * buradan yalnızca görüntülenir ve iptal edilir. Taslağı GİB'e gönderen `DraftApproval`
 * çağrısı bilerek açılmamıştır (docs/ice-baglanti.md §16.6).
 *
 * Arayüz kuralları: docs/ice-baglanti.md §15
 */

type AlertInfo = { type: "success" | "danger" | "warning" | "info"; message: string } | null;

const SAYFA_BOYUTU = 50;

const EBelgeGidenPage: React.FC = () => {
  const [kayitlar, setKayitlar] = useState<EbelgeGidenSatiri[]>([]);
  const [toplam, setToplam] = useState<number>(0);
  const [sayfa, setSayfa] = useState<number>(1);
  const [yukleniyor, setYukleniyor] = useState<boolean>(true);
  const [alertInfo, setAlertInfo] = useState<AlertInfo>(null);
  const [arama, setArama] = useState<string>("");
  // Belge sayfasındaki "Taslaklara Git" ?durum=TASLAK ile gelir (yönetici isteği 16.09.2026)
  const [searchParams] = useSearchParams();
  const [durum, setDurum] = useState<string>(() => {
    const d = (searchParams.get("durum") || "").toUpperCase();
    return ["TASLAK", "GONDERILDI", "IPTAL", "HATALI"].includes(d) ? d : "TUMU";
  });
  const [belgeTuru, setBelgeTuru] = useState("");
  const [baslangicTarihi, setBaslangicTarihi] = useState("");
  const [bitisTarihi, setBitisTarihi] = useState("");
  const [secimler, setSecimler] = useState<string[]>([]);
  const [topluBusy, setTopluBusy] = useState(false);
  const [islemSonuclari, setIslemSonuclari] = useState<Record<string, string>>({});
  const seciliTaslaklar = kayitlar.filter(s => secimler.includes(s.uuid) && s.belgeTuru === "EFatura" && s.gonderimDurumu === "TASLAK");
  const topluGonder = async () => {
    setTopluBusy(true);
    for (const satir of seciliTaslaklar) {
      setIslemSonuclari(o => ({ ...o, [satir.uuid]: "Gönderiliyor…" }));
      try {
        const sonuc = await ebelgeService.taslakOnayla(satir.uuid);
        setIslemSonuclari(o => ({ ...o, [satir.uuid]: `${sonuc.durum}: ${sonuc.mesaj || ""}` }));
      } catch (e: any) {
        setIslemSonuclari(o => ({ ...o, [satir.uuid]: e.message || "İşlem tamamlanamadı; durumu kontrol edin." }));
      }
    }
    setSecimler([]); setTopluBusy(false); await listeYukle(sayfa);
  };
  const [seciliUuid, setSeciliUuid] = useState<string | null>(null);
  const [arsivAcik, setArsivAcik] = useState(false);

  // İptal (çöp kovası) butonu yönetici isteğiyle kaldırıldı (14.09.2026); iptal bildirimi bu ekrandan yapılmaz.

  // Taslak onayı (GİB'e gönderim) — ara onay kartı kaldırıldı, düğme doğrudan gönderir (docs/ebelge-revizyon.md K5)
  const [onaylaniyor, setOnaylaniyor] = useState<boolean>(false);

  // E-posta gönderimi — iki adımlı onay
  const [mailBelgesi, setMailBelgesi] = useState<EbelgeGidenSatiri | null>(null);
  const [mailAdresleri, setMailAdresleri] = useState<string>("");
  const [mailGonderiliyor, setMailGonderiliyor] = useState<boolean>(false);

  const mailGonder = async () => {
    if (!mailBelgesi) return;
    const alicilar = mailAdresleri
      .split(/[,;\s]+/)
      .map((e) => e.trim())
      .filter(Boolean)
      .map((eposta) => ({ eposta }));

    if (!alicilar.length) {
      setAlertInfo({ type: "danger", message: "En az bir e-posta adresi giriniz." });
      return;
    }

    setMailGonderiliyor(true);
    setAlertInfo(null);
    try {
      const sonuc = await ebelgeService.belgeMailGonder(mailBelgesi.uuid, alicilar);
      setAlertInfo({
        type: sonuc.basarisiz > 0 ? "warning" : "success",
        message:
          `${mailBelgesi.belgeNo}: ${sonuc.gonderilen} alıcıya gönderildi` +
          (sonuc.basarisiz > 0 ? `, ${sonuc.basarisiz} alıcıda hata oluştu.` : "."),
      });
      setMailBelgesi(null);
      setMailAdresleri("");
    } catch (err: any) {
      setAlertInfo({ type: "danger", message: err?.message || "E-posta gönderilemedi." });
    } finally {
      setMailGonderiliyor(false);
    }
  };

  const taslagiOnayla = async (onaylanacak: EbelgeGidenSatiri) => {
    if (onaylaniyor) return;
    setOnaylaniyor(true);
    setAlertInfo(null);
    try {
      const sonuc = await ebelgeService.taslakOnayla(onaylanacak.uuid);
      setAlertInfo({
        type: "success",
        message: `${sonuc.belgeNo} onaylandı ve GİB'e gönderildi. ${sonuc.mesaj}`.trim(),
      });
      await listeYukle(sayfa);
    } catch (err: any) {
      setAlertInfo({ type: "danger", message: err?.message || "Taslak onaylanamadı." });
    } finally {
      setOnaylaniyor(false);
    }
  };
  const [detayYukleniyor, setDetayYukleniyor] = useState(false);
  const [detay, setDetay] = useState<{ belgeNo: string; rapor: any[]; mail: any[]; hatalar: string[] } | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  /** ICE görüntüyü HTML döndürdüyse çerçeve sandbox'lı kurulur (PDF sandbox'ta açılmaz) */
  const [goruntuHtml, setGoruntuHtml] = useState<string | null>(null);
  const [goruntuBaslik, setGoruntuBaslik] = useState("");
  const goruntuCerceve = useRef<HTMLIFrameElement>(null);

  const goruntuKapat = () => { setPdfUrl(null); setGoruntuHtml(null); };

  /**
   * PDF aynı kökenli blob olduğu için çerçeve doğrudan yazdırılır. HTML çerçevesi sandbox'lıdır
   * (allow-same-origin yok), dışarıdan print() çağrılamaz; içine eklenen dinleyiciye mesaj atılır.
   */
  const goruntuYazdir = () => {
    const pencere = goruntuCerceve.current?.contentWindow;
    if (!pencere) return;
    if (goruntuHtml) pencere.postMessage("yazdir", "*");
    else { pencere.focus(); pencere.print(); }
  };
  useEffect(() => () => { if (pdfUrl) URL.revokeObjectURL(pdfUrl); }, [pdfUrl]);

  /** Fatura numarasına tıklanınca belge görüntüsünü açar */
  const goruntulenebilir = (satir: EbelgeGidenSatiri) =>
    (satir.belgeTuru === "EArsiv" && ["GONDERILDI", "IPTAL"].includes(satir.gonderimDurumu)) ||
    (satir.belgeTuru === "EDoviz" && ["GONDERILDI", "IPTAL"].includes(satir.gonderimDurumu)) ||
    (satir.belgeTuru === "EFatura" && ["TASLAK", "GONDERILDI", "IPTAL"].includes(satir.gonderimDurumu));

  const belgeGoruntule = async (satir: EbelgeGidenSatiri) => {
    if (satir.belgeTuru === "EDoviz") return dovizGoruntule(satir, true);
    setDetayYukleniyor(true);
    setDetay(null);
    setPdfUrl(null);
    setGoruntuHtml(null);
    try {
      const g = satir.belgeTuru === "EArsiv"
        ? await ebelgeService.getEarsivGoruntu(satir.uuid)
        : await ebelgeService.getEfaturaGoruntu(satir.uuid);
      setGoruntuBaslik(satir.belgeNo);
      // Yazdır düğmesi için: sandbox içindeki belge "yazdir" mesajında kendi print()'ini çağırır.
      setGoruntuHtml(g.html === null ? null
        : `${g.html}<script>addEventListener("message",function(e){if(e.data==="yazdir")print()})</script>`);
      setPdfUrl(g.html ? null : g.url);
    } catch (err: any) {
      setAlertInfo({ type: "danger", message: err?.message || "Belge görüntüsü alınamadı." });
    } finally { setDetayYukleniyor(false); }
  };

  const earsivGoruntule = async (satir: EbelgeGidenSatiri, pdf: boolean) => {
    setDetayYukleniyor(true);
    setDetay(null);
    setPdfUrl(null);
    try {
      if (pdf) return void (await belgeGoruntule(satir));
      else setDetay({ belgeNo: satir.belgeNo, ...await ebelgeService.earsivDurum([satir.uuid]) });
    } catch (err: any) {
      setAlertInfo({ type: "danger", message: err?.message || "Belge bilgisi alınamadı." });
    } finally { setDetayYukleniyor(false); }
  };
  const dovizGoruntule = async (satir: EbelgeGidenSatiri, pdf: boolean) => {
    setDetayYukleniyor(true); setPdfUrl(null);
    try {
      if (pdf) { setGoruntuHtml(null); setGoruntuBaslik(satir.belgeNo); setPdfUrl(await ebelgeService.getDovizPdfBlobUrl(satir.uuid)); }
      else {
        const d = await ebelgeService.dovizDurum(satir.uuid);
        setAlertInfo({ type: "success", message: `${satir.belgeNo}: ${d?.STATUS_DESCRIPTION || d?.STATUS || "ICE durum kaydı alındı."}` });
      }
    } catch (err: any) { setAlertInfo({ type: "danger", message: err?.message || "e-Döviz bilgisi alınamadı." }); }
    finally { setDetayYukleniyor(false); }
  };

  const listeYukle = useCallback(
    async (hedefSayfa = 1) => {
      setYukleniyor(true);
      try {
        const sonuc = await ebelgeService.listGiden({
          sayfa: hedefSayfa,
          boyut: SAYFA_BOYUTU,
          arama: arama.trim() || undefined,
          durum: durum === "TUMU" ? undefined : durum,
          belgeTuru: belgeTuru || undefined,
          baslangicTarihi: baslangicTarihi || undefined,
          bitisTarihi: bitisTarihi || undefined,
        });
        setKayitlar(sonuc.kayitlar);
        setToplam(sonuc.toplam);
        setSayfa(hedefSayfa);
        setSecimler([]);
      } catch (err: any) {
        setAlertInfo({ type: "danger", message: err?.message || "Liste alınamadı." });
      } finally {
        setYukleniyor(false);
      }
    },
    [arama, durum, belgeTuru, baslangicTarihi, bitisTarihi]
  );

  useEffect(() => {
    listeYukle(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sonSayfa = Math.max(Math.ceil(toplam / SAYFA_BOYUTU), 1);

  return (
    <div className="ebelge-giden-container w-100 pb-3" style={{ overflowX: "hidden" }}>
      <ERPToolbar
        pageTitle="E- Belge Giden Kutusu"
        pageIcon={<IconSend size={22} className="text-primary" />}
        onRefresh={() => listeYukle(sayfa)}
        onPrint={() => window.print()}
        disabled={yukleniyor}
      />

      <Alert variant="info" className="py-2 px-3 mb-3 border rounded shadow-2xs small">
        <strong>e-Fatura</strong> belgeleri entegratörde <strong>taslak</strong> olarak duruyor —
        GİB'e gönderilmedi, iptal edilebilir. <strong>e-Arşiv</strong> için satırdaki gönderim
        durumunu ve rapor sonucunu kontrol ediniz. Sonucu belirsiz veya işlem sürüyor görünen
        belgeleri ICE portalinde ETTN ile kontrol etmeden yeniden göndermeyiniz.
      </Alert>

      {alertInfo && (
        <Alert
          variant={alertInfo.type}
          dismissible
          onClose={() => setAlertInfo(null)}
          className="py-2 px-3 mb-3 border rounded shadow-2xs small fw-medium"
        >
          {alertInfo.message}
        </Alert>
      )}

      {mailBelgesi && (
        <Card className="shadow-sm border border-secondary-subtle rounded-3 overflow-hidden mb-3">
          <Card.Body className="p-3 bg-body">
            <div className="fw-semibold mb-2" style={{ fontSize: "13px" }}>
              E-posta Gönder — {mailBelgesi.belgeNo}
            </div>
            <Alert variant="warning" className="py-2 px-3 mb-2 border rounded shadow-2xs small">
              <IconAlertTriangle size={15} className="me-1" />
              Belge alıcıya <strong>e-posta ile gönderilecek</strong>. Bu düğmeye her basışta
              alıcıya <strong>yeniden mail gider</strong>.
            </Alert>
            <Form.Label className="small mb-1">
              E-posta adresi <span className="text-secondary">(virgülle birden çok yazabilirsiniz)</span>
            </Form.Label>
            <Form.Control
              size="sm"
              type="text"
              className="mb-2"
              placeholder="musteri@ornek.com, muhasebe@ornek.com"
              value={mailAdresleri}
              disabled={mailGonderiliyor}
              onChange={(e) => setMailAdresleri(e.target.value)}
            />
            <div className="d-flex gap-2">
              <Button
                size="sm"
                variant="primary"
                onClick={mailGonder}
                disabled={mailGonderiliyor || !mailAdresleri.trim()}
                className="d-flex align-items-center gap-1"
              >
                {mailGonderiliyor ? <Spinner animation="border" size="sm" /> : <IconMail size={15} />}
                Evet, e-postayı gönder
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setMailBelgesi(null);
                  setMailAdresleri("");
                }}
                disabled={mailGonderiliyor}
              >
                Vazgeç
              </Button>
            </div>
          </Card.Body>
        </Card>
      )}

      <Button size="sm" variant="outline-secondary" className="mb-3" onClick={() => setArsivAcik(!arsivAcik)}>
        {arsivAcik ? "ICE arşivini gizle" : "ICE arşivini aç"}
      </Button>
      {arsivAcik && <EBelgeArsivPanel />}
      {(durum === "TASLAK" || durum === "TUMU") && <EBelgeYerelTaslaklar />}

      {detay && <Card className="mb-3"><Card.Body>
        <div className="d-flex justify-content-between"><strong>{detay.belgeNo} — Rapor ve e-posta durumu</strong>
          <Button size="sm" variant="secondary" onClick={() => setDetay(null)}>Kapat</Button></div>
        {detay.hatalar.map((h) => <Alert key={h} variant="warning" className="mt-2">{h}</Alert>)}
        {detay.rapor.length === 0 && <p className="mt-2">Rapor kaydı dönmedi; raporlandı olarak kabul edilmez.</p>}
        {detay.rapor.map((r, i) => <p key={i} className="mt-2">
          Raporlandı: <strong>{String(r.Raporlandi).toLowerCase() === "true" ? "Evet" : "Hayır"}</strong>
          {" · "}{r.Rapor_Durum_Kodu || "-"}{" · "}{r.Rapor_Durum_Aciklama || "-"}
          {" · "}ETTN: {r.ETTN || "-"}
        </p>)}
        {detay.mail.length === 0 && <p>E-posta durum kaydı dönmedi.</p>}
        {detay.mail.map((m, i) => <p key={i}>{m.email || "-"}{" · "}{m.statu || "-"}{" · "}{m.message || ""}</p>)}
      </Card.Body></Card>}
      <Modal show={Boolean(pdfUrl || goruntuHtml)} onHide={goruntuKapat} size="xl" centered scrollable={false}>
        <Modal.Header closeButton className="py-2">
          <Modal.Title className="fs-6 fw-semibold font-monospace">{goruntuBaslik}</Modal.Title>
          <Button size="sm" variant="primary" className="ms-auto me-2 d-flex align-items-center gap-1" onClick={goruntuYazdir}>
            <IconPrinter size={16} /> Yazdır
          </Button>
        </Modal.Header>
        <Modal.Body className="p-0">
          {/* ICE'nin ürettiği HTML: allow-same-origin YOK; karekod için betik, yazdırma için modal izni verilir */}
          {goruntuHtml
            ? <iframe ref={goruntuCerceve} title="Belge görüntüsü" srcDoc={goruntuHtml} sandbox="allow-scripts allow-modals" referrerPolicy="no-referrer" style={{ width: "100%", height: "78vh", border: 0, background: "#fff", display: "block" }} />
            : <iframe ref={goruntuCerceve} title="Belge görüntüsü" src={pdfUrl || undefined} style={{ width: "100%", height: "78vh", border: 0, display: "block" }} />}
        </Modal.Body>
      </Modal>

      <Card className="shadow-sm border border-secondary-subtle rounded-3 overflow-hidden mb-3">
        <Card.Body className="p-3 bg-body">
          <Row className="g-2 align-items-end">
            <Col xs={12} md={6} lg={4}>
              <Form.Label className="small mb-1">Ara</Form.Label>
              <Form.Control
                size="sm"
                type="search"
                placeholder="Belge no, unvan veya ETTN ile Ara…"
                value={arama}
                onChange={(e) => setArama(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    listeYukle(1);
                  }
                }}
              />
            </Col>
            <Col xs={6} md={4} lg={2}>
              <Form.Label className="small mb-1">Durum</Form.Label>
              <Form.Select size="sm" value={durum} onChange={(e) => setDurum(e.target.value)}>
                <option value="TUMU">Tümü</option>
                <option value="TASLAK">Taslak</option>
                <option value="GONDERILDI">Gönderildi</option>
                <option value="IPTAL">İptal</option>
                <option value="HATA">Hatalı</option>
              </Form.Select>
            </Col>
            <Col xs={6} md={3} lg={2}>
              <Form.Label className="small mb-1">Belge türü</Form.Label>
              <Form.Select size="sm" value={belgeTuru} onChange={e => setBelgeTuru(e.target.value)} disabled={topluBusy}>
                <option value="">Tümü</option><option value="EFatura">e-Fatura</option><option value="EArsiv">e-Arşiv</option>
                <option value="EGiderPusulasi">e-Gider</option><option value="EIrsaliye">e-İrsaliye</option><option value="EDoviz">e-Döviz</option><option value="EMustahsil">e-Müstahsil</option>
              </Form.Select>
            </Col>
            <Col xs={6} md={3} lg={2}><Form.Label className="small mb-1">İlk tarih</Form.Label>
              <Form.Control size="sm" type="date" value={baslangicTarihi} onChange={e => setBaslangicTarihi(e.target.value)} disabled={topluBusy} /></Col>
            <Col xs={6} md={3} lg={2}><Form.Label className="small mb-1">Son tarih</Form.Label>
              <Form.Control size="sm" type="date" value={bitisTarihi} onChange={e => setBitisTarihi(e.target.value)} disabled={topluBusy} /></Col>
            <Col xs={6} md={2} lg={2}>
              <Button size="sm" variant="primary" onClick={() => listeYukle(1)} disabled={yukleniyor}>
                Filtrele
              </Button>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      <Card className="shadow-sm border border-secondary-subtle rounded-3 overflow-hidden">
        <Card.Body className="p-3 bg-body">
          <div className="d-flex gap-2 align-items-center mb-2">
            <Button size="sm" disabled={topluBusy || yukleniyor || !kayitlar.length} onClick={() => setSecimler(secimler.length === kayitlar.length ? [] : kayitlar.map(s => s.uuid))}>Sayfadakileri seç / kaldır</Button>
            <span className="small">{secimler.length} seçili · {seciliTaslaklar.length} gönderilebilir taslak</span>
            <Button size="sm" disabled={topluBusy || !seciliTaslaklar.length} onClick={topluGonder}>Seçili taslakları gönder</Button>
          </div>
          <div className="d-flex align-items-center justify-content-between mb-2">
            <span className="fw-semibold" style={{ fontSize: "13px" }}>
              Giden Belgeler
            </span>
            <span className="text-secondary small">
              {toplam.toLocaleString("tr-TR")} kayıt · sayfa {sayfa}/{sonSayfa}
            </span>
          </div>

          <div className="table-responsive">
            <Table className="table table-sm custom-document-table mb-0" hover>
              <thead>
                <tr>
                  <th>Seç</th>
                  <th style={{ width: "110px" }}>Tarih</th>
                  <th style={{ width: "160px" }}>Belge No</th>
                  <th>Alıcı</th>
                  <th style={{ width: "130px" }} className="text-end">
                    Tutar
                  </th>
                  <th style={{ width: "100px" }}>Tür</th>
                  <th style={{ width: "120px" }}>Senaryo</th>
                  <th style={{ width: "110px" }}>Durum</th>
                  <th style={{ width: "80px" }} />
                </tr>
              </thead>
              <tbody>
                {yukleniyor ? (
                  <tr>
                    <td colSpan={9} className="text-center py-4">
                      <Spinner animation="border" size="sm" className="me-2" />
                      <span className="small text-secondary">Yükleniyor…</span>
                    </td>
                  </tr>
                ) : kayitlar.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center text-secondary py-4 small">
                      Kayıt yok. Belge Doğrulama ekranından taslak oluşturabilirsiniz.
                    </td>
                  </tr>
                ) : (
                  kayitlar.map((satir) => {
                    const rozet = ebelgeGidenDurumRozet(satir.gonderimDurumu);
                    return (
                      <tr
                        key={satir.uuid}
                        className={seciliUuid === satir.uuid ? "table-active" : undefined}
                        onClick={() => setSeciliUuid(satir.uuid)}
                        style={{ cursor: "pointer" }}
                      >
                        <td><Form.Check aria-label={`${satir.belgeNo} seç`} checked={secimler.includes(satir.uuid)} disabled={topluBusy}
                          onChange={e => setSecimler(o => e.target.checked ? [...o, satir.uuid] : o.filter(id => id !== satir.uuid))} /></td>
                        <td>{ebelgeTarihSaat(satir.duzenlemeTarihi || satir.olusturmaTarihi).slice(0, 10)}</td>
                        <td className="font-monospace">
                          {goruntulenebilir(satir)
                            ? <Button variant="link" size="sm" className="p-0 font-monospace align-baseline" disabled={detayYukleniyor}
                                title="Belge görüntüsünü aç" onClick={() => void belgeGoruntule(satir)}>{satir.belgeNo}</Button>
                            : satir.belgeNo}<small className="d-block text-secondary" style={{ overflowWrap: "anywhere" }}>{satir.uuid}</small></td>
                        <td className="text-truncate" style={{ maxWidth: "300px" }} title={satir.aliciUnvan || ""}>
                          {satir.aliciUnvan || satir.aliciVkn || "-"}
                        </td>
                        <td className="text-end font-monospace">
                          {ebelgeTutar(satir.tutar, satir.paraBirimi)}
                        </td>
                        <td>
                          <Badge
                            bg={satir.belgeTuru === "EArsiv" ? "info-subtle" : "secondary-subtle"}
                            text={satir.belgeTuru === "EArsiv" ? "info" : "secondary"}
                          >
                            {{ EFatura: "e-Fatura", EArsiv: "e-Arşiv", EGiderPusulasi: "e-Gider", EIrsaliye: "e-İrsaliye", EDoviz: "e-Döviz", EMustahsil: "e-Müstahsil" }[satir.belgeTuru] || satir.belgeTuru}
                          </Badge>
                        </td>
                        <td>{satir.profil || "-"}</td>
                        <td>
                          <Badge bg={rozet.bg} text={rozet.text}>
                            {rozet.etiket}
                          </Badge>
                          {satir.iceResponseMesaj && <small className="d-block">{satir.iceResponseMesaj}</small>}
                          {islemSonuclari[satir.uuid] && <small className="d-block fw-semibold">{islemSonuclari[satir.uuid]}</small>}
                        </td>
                        <td className="text-center">
                          {satir.belgeTuru === "EArsiv" && <>
                            <Button size="sm" variant="link" disabled={detayYukleniyor} onClick={() => earsivGoruntule(satir, false)}>Durum</Button>
                            {["GONDERILDI", "IPTAL"].includes(satir.gonderimDurumu) &&
                              <Button size="sm" variant="link" disabled={detayYukleniyor} onClick={() => earsivGoruntule(satir, true)}>PDF</Button>}
                          </>}
                          {satir.belgeTuru === "EDoviz" && <>
                            <Button size="sm" variant="link" disabled={detayYukleniyor} onClick={() => dovizGoruntule(satir, false)}>Durum</Button>
                            {["GONDERILDI", "IPTAL"].includes(satir.gonderimDurumu) &&
                              <Button size="sm" variant="link" disabled={detayYukleniyor} onClick={() => dovizGoruntule(satir, true)}>PDF</Button>}
                          </>}
                          {/* E-posta ile gönder — yalnızca gönderimi kesinleşmiş belgelerde */}
                          {satir.gonderimDurumu === "GONDERILDI" && !["EDoviz", "EMustahsil"].includes(satir.belgeTuru) && (
                            <Button
                              size="sm"
                              variant="link"
                              className="p-0 me-2"
                              style={{ color: "#475569" }}
                              title="Belgeyi e-posta ile gönder"
                              onClick={(e) => {
                                e.stopPropagation();
                                setMailBelgesi(satir);
                                setMailAdresleri("");
                              }}
                            >
                              <IconMail size={16} />
                            </Button>
                          )}
                          {/* Taslağı GİB'e gönder — yalnızca e-Fatura taslaklarında */}
                          {satir.gonderimDurumu === "TASLAK" && satir.belgeTuru === "EFatura" && (
                            <Button
                              size="sm"
                              variant="link"
                              className="p-0 me-2"
                              style={{ color: "#0284c7" }}
                              title="Taslağı onayla ve GİB'e gönder"
                              disabled={onaylaniyor || topluBusy}
                              onClick={(e) => {
                                e.stopPropagation();
                                void taslagiOnayla(satir);
                              }}
                            >
                              <IconSend size={16} />
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </Table>
          </div>

          {toplam > SAYFA_BOYUTU && (
            <div className="d-flex align-items-center justify-content-end gap-2 mt-2">
              <Button
                size="sm"
                variant="outline-secondary"
                disabled={sayfa <= 1 || yukleniyor}
                onClick={() => listeYukle(sayfa - 1)}
              >
                Önceki
              </Button>
              <Button
                size="sm"
                variant="outline-secondary"
                disabled={sayfa >= sonSayfa || yukleniyor}
                onClick={() => listeYukle(sayfa + 1)}
              >
                Sonraki
              </Button>
            </div>
          )}
        </Card.Body>
      </Card>
    </div>
  );
};

export default EBelgeGidenPage;
