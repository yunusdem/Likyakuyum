import React, { useCallback, useEffect, useState } from "react";
import { Alert, Badge, Button, Card, Col, Form, Row, Spinner, Table } from "react-bootstrap";
import { IconSend, IconTrash, IconAlertTriangle, IconMail } from "@tabler/icons-react";

import ERPToolbar from "../../components/common/ERPToolbar";
import EBelgeArsivPanel from "./EBelgeArsivPanel";
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
  const [durum, setDurum] = useState<string>("TUMU");
  const [belgeTuru, setBelgeTuru] = useState("");
  const [baslangicTarihi, setBaslangicTarihi] = useState("");
  const [bitisTarihi, setBitisTarihi] = useState("");
  const [secimler, setSecimler] = useState<string[]>([]);
  const [topluBusy, setTopluBusy] = useState(false);
  const [topluOnay, setTopluOnay] = useState(false);
  const [islemSonuclari, setIslemSonuclari] = useState<Record<string, string>>({});
  const seciliTaslaklar = kayitlar.filter(s => secimler.includes(s.uuid) && s.belgeTuru === "EFatura" && s.gonderimDurumu === "TASLAK");
  const topluGonder = async () => {
    setTopluBusy(true); setTopluOnay(false);
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

  // İptal — iki adımlı onay
  const [iptalEdilecek, setIptalEdilecek] = useState<EbelgeGidenSatiri | null>(null);
  const [iptalEdiliyor, setIptalEdiliyor] = useState<boolean>(false);

  // Taslak onayı (GİB'e gönderim) — iki adımlı onay
  const [onaylanacak, setOnaylanacak] = useState<EbelgeGidenSatiri | null>(null);
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

  const taslagiOnayla = async () => {
    if (!onaylanacak) return;
    setOnaylaniyor(true);
    setAlertInfo(null);
    try {
      const sonuc = await ebelgeService.taslakOnayla(onaylanacak.uuid);
      setAlertInfo({
        type: "success",
        message: `${sonuc.belgeNo} onaylandı ve GİB'e gönderildi. ${sonuc.mesaj}`.trim(),
      });
      setOnaylanacak(null);
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
  useEffect(() => () => { if (pdfUrl) URL.revokeObjectURL(pdfUrl); }, [pdfUrl]);

  const earsivGoruntule = async (satir: EbelgeGidenSatiri, pdf: boolean) => {
    setDetayYukleniyor(true);
    setDetay(null);
    setPdfUrl(null);
    try {
      if (pdf) setPdfUrl(await ebelgeService.getEarsivPdfBlobUrl(satir.uuid));
      else setDetay({ belgeNo: satir.belgeNo, ...await ebelgeService.earsivDurum([satir.uuid]) });
    } catch (err: any) {
      setAlertInfo({ type: "danger", message: err?.message || "Belge bilgisi alınamadı." });
    } finally { setDetayYukleniyor(false); }
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
        setSecimler([]); setTopluOnay(false);
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

  const iptalEt = async () => {
    if (!iptalEdilecek) return;
    setIptalEdiliyor(true);
    setAlertInfo(null);
    try {
      if (iptalEdilecek.belgeTuru === "EArsiv") {
        // e-Arşiv: belge silinmez, GİB'e iptal BİLDİRİMİ gider
        await ebelgeService.earsivIptal(iptalEdilecek.uuid);
        setAlertInfo({
          type: "success",
          message: `${iptalEdilecek.belgeNo} için e-Arşiv iptal bildirimi gönderildi.`,
        });
      } else {
        await ebelgeService.taslakIptal(iptalEdilecek.uuid);
        setAlertInfo({
          type: "success",
          message: `${iptalEdilecek.belgeNo} numaralı taslak iptal edildi.`,
        });
      }
      setIptalEdilecek(null);
      await listeYukle(sayfa);
    } catch (err: any) {
      setAlertInfo({ type: "danger", message: err?.message || "Taslak iptal edilemedi." });
    } finally {
      setIptalEdiliyor(false);
    }
  };

  const sonSayfa = Math.max(Math.ceil(toplam / SAYFA_BOYUTU), 1);

  return (
    <div className="ebelge-giden-container container-fluid px-2 py-2">
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

      {onaylanacak && (
        <Card className="shadow-sm border rounded-3 overflow-hidden mb-3" style={{ borderColor: "#dc2626" }}>
          <Card.Body className="p-3 bg-body">
            <Alert variant="danger" className="py-2 px-3 mb-2 border rounded shadow-2xs small">
              <IconAlertTriangle size={15} className="me-1" />
              <strong>{onaylanacak.belgeNo}</strong> numaralı taslak onaylanıp{" "}
              <strong>GİB'e gönderilecek</strong>. Bu işlem <strong>geri alınamaz</strong>; belge
              artık iptal edilemez, düzeltme için alıcının red cevabı ya da iade faturası gerekir.
              <br />
              Alıcı: <strong>{onaylanacak.aliciUnvan || onaylanacak.aliciVkn}</strong> · Tutar:{" "}
              <strong>{ebelgeTutar(onaylanacak.tutar, onaylanacak.paraBirimi)}</strong>
            </Alert>
            <div className="d-flex gap-2">
              <Button size="sm" variant="danger" onClick={taslagiOnayla} disabled={onaylaniyor}>
                {onaylaniyor ? <Spinner animation="border" size="sm" className="me-1" /> : null}
                Evet, onayla ve GİB'e gönder
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setOnaylanacak(null)}
                disabled={onaylaniyor}
              >
                Vazgeç
              </Button>
            </div>
          </Card.Body>
        </Card>
      )}

      {iptalEdilecek && (
        <Card className="shadow-sm border rounded-3 overflow-hidden mb-3" style={{ borderColor: "#dc2626" }}>
          <Card.Body className="p-3 bg-body">
            <Alert
              variant={iptalEdilecek.belgeTuru === "EArsiv" ? "danger" : "warning"}
              className="py-2 px-3 mb-2 border rounded shadow-2xs small"
            >
              <IconAlertTriangle size={15} className="me-1" />
              {iptalEdilecek.belgeTuru === "EArsiv" ? (
                <>
                  <strong>{iptalEdilecek.belgeNo}</strong> için GİB'e{" "}
                  <strong>iptal bildirimi</strong> gönderilecek. Belge silinmez, iptal edildiği
                  raporlanır ve bu işlem <strong>geri alınamaz</strong>. Devam edilsin mi?
                </>
              ) : (
                <>
                  <strong>{iptalEdilecek.belgeNo}</strong> numaralı taslak entegratörden silinecek.
                  Fatura numarası tekrar kullanılamaz. Devam edilsin mi?
                </>
              )}
            </Alert>
            <div className="d-flex gap-2">
              <Button size="sm" variant="danger" onClick={iptalEt} disabled={iptalEdiliyor}>
                {iptalEdiliyor ? <Spinner animation="border" size="sm" className="me-1" /> : null}
                {iptalEdilecek.belgeTuru === "EArsiv"
                  ? "Evet, iptal bildirimi gönder"
                  : "Evet, taslağı iptal et"}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setIptalEdilecek(null)}
                disabled={iptalEdiliyor}
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
      {pdfUrl && <Card className="mb-3"><Card.Body>
        <Button size="sm" variant="secondary" className="mb-2" onClick={() => setPdfUrl(null)}>PDF'i kapat</Button>
        <iframe title="e-Arşiv PDF" src={pdfUrl} style={{ width: "100%", height: "65vh", border: 0 }} />
      </Card.Body></Card>}

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
                <option value="GONDERILIYOR">Gönderim sürüyor / kontrol gerekli</option>
                <option value="BELIRSIZ">Gönderim sonucu belirsiz</option>
                <option value="IPTAL_EDILIYOR">İptal sürüyor / kontrol gerekli</option>
                <option value="IPTAL_BELIRSIZ">İptal sonucu belirsiz</option>
              </Form.Select>
            </Col>
            <Col xs={6} md={3} lg={2}>
              <Form.Label className="small mb-1">Belge türü</Form.Label>
              <Form.Select size="sm" value={belgeTuru} onChange={e => setBelgeTuru(e.target.value)} disabled={topluBusy}>
                <option value="">Tümü</option><option value="EFatura">e-Fatura</option><option value="EArsiv">e-Arşiv</option>
                <option value="EGiderPusulasi">e-Gider</option><option value="EIrsaliye">e-İrsaliye</option>
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
            <Button size="sm" disabled={topluBusy || !seciliTaslaklar.length} onClick={() => setTopluOnay(true)}>Seçili taslakları gönder</Button>
          </div>
          {topluOnay && <Alert variant="warning">
            {seciliTaslaklar.map(s => s.belgeNo).join(", ")} belgeleri GİB'e gönderilecek.
            <Button className="ms-2" size="sm" onClick={topluGonder}>Gönderimi onayla</Button>
            <Button className="ms-2" size="sm" variant="secondary" onClick={() => setTopluOnay(false)}>Vazgeç</Button>
          </Alert>}
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
                        <td className="font-monospace">{satir.belgeNo}<small className="d-block text-secondary" style={{ overflowWrap: "anywhere" }}>{satir.uuid}</small></td>
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
                            {{ EFatura: "e-Fatura", EArsiv: "e-Arşiv", EGiderPusulasi: "e-Gider", EIrsaliye: "e-İrsaliye" }[satir.belgeTuru] || satir.belgeTuru}
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
                          {/* E-posta ile gönder — yalnızca gönderimi kesinleşmiş belgelerde */}
                          {satir.gonderimDurumu === "GONDERILDI" && (
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
                              onClick={(e) => {
                                e.stopPropagation();
                                setOnaylanacak(satir);
                              }}
                            >
                              <IconSend size={16} />
                            </Button>
                          )}
                          {(satir.gonderimDurumu === "TASLAK" ||
                            (satir.belgeTuru === "EArsiv" &&
                              satir.gonderimDurumu === "GONDERILDI")) && (
                            <Button
                              size="sm"
                              variant="link"
                              className="p-0"
                              style={{ color: "#dc2626" }}
                              title={
                                satir.belgeTuru === "EArsiv"
                                  ? "İptal bildirimi gönder"
                                  : "Taslağı iptal et"
                              }
                              onClick={(e) => {
                                e.stopPropagation();
                                setIptalEdilecek(satir);
                              }}
                            >
                              <IconTrash size={16} />
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
