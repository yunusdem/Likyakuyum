import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Badge, Button, ButtonGroup, Card, Col, Dropdown, ListGroup, Modal, Row, Spinner } from "react-bootstrap";
import {
  IconArrowBackUp, IconDownload, IconEdit, IconFileText, IconHelp, IconHistory, IconLayout, IconPhoto, IconRefresh, IconTemplate, IconUpload,
} from "@tabler/icons-react";

import ERPToolbar from "../../components/common/ERPToolbar";
import { useAuth } from "../../context/AuthContext";
import {
  BelgeService, type EtkinSablon, type OrnekSablonBilgisi, type SablonDenetimHatasi, type SablonGovdesi, type SablonTuru,
} from "../../services/belgeService";
import { sablonHtml } from "../../utils/belgeSablon/htmlCiz";
import { BelgeGorselleriModal } from "../../components/belge/BelgeGorselleriModal";
import { SablonEditoru } from "../../components/belge/SablonEditoru";
import { NasilYapilirModal } from "../../components/belge/NasilYapilirModal";

type Uyari = { type: "success" | "danger" | "warning" | "info"; message: string } | null;
const tarihYaz = (d: string | null | undefined) => (d ? new Date(d).toLocaleString("tr-TR") : "-");
/** "DOVIZ_FIS_20261012_235300.json" → "12.10.2026 23:53:00" */
const surumEtiketi = (ad: string) => {
  const m = /_(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})(?:_(\d+))?\.json$/.exec(ad);
  return m ? `${m[3]}.${m[2]}.${m[1]} ${m[4]}:${m[5]}:${m[6]}${m[7] ? ` (${m[7]})` : ""}` : ad;
};
const satimSecenekli = (tur: string) => tur.startsWith("DOVIZ") || tur.startsWith("SARRAF");

/**
 * Belge Tasarımı (docs/FIS_TASARIM_YOL_HARITASI.md): firmanın fiş / belge düzenleri.
 * Şablonu indirip düzenleyerek geri yükleme, varsayılana ve önceki sürüme dönme. Yalnızca sistem yöneticisi.
 */
const BelgeTasarimiPage: React.FC = () => {
  const { user } = useAuth();
  const yetkili = user?.role === "admin" || !!user?.isSysAdmin;
  const [turler, setTurler] = useState<SablonTuru[]>([]);
  const [secili, setSecili] = useState<string>("");
  const [etkin, setEtkin] = useState<EtkinSablon | null>(null);
  const [satim, setSatim] = useState(true);
  const [onizlemeHtml, setOnizlemeHtml] = useState<string>("");
  const [yukleniyor, setYukleniyor] = useState(true);
  const [islem, setIslem] = useState<string | null>(null);
  const [uyari, setUyari] = useState<Uyari>(null);
  // Yüklenen dosya: denetim sonucu ve önizlemesi; "Kaydet" ile etkinleşir
  const [yuklenen, setYuklenen] = useState<{ ad: string; icerik: string; hatalar: SablonDenetimHatasi[]; html: string } | null>(null);
  const [onay, setOnay] = useState<{ baslik: string; metin: string; calistir: () => Promise<void> } | null>(null);
  const [gorselPenceresi, setGorselPenceresi] = useState(false);
  const [duzenleniyor, setDuzenleniyor] = useState(false);
  // Editörün başlangıcı: etkin şablon ya da (örnek / yüklenen dosyadan) kaydedilmemiş bir şablon
  const [editorBaslangici, setEditorBaslangici] = useState<{ sablon: any; kayitsiz: boolean } | null>(null);
  const [ornekListesi, setOrnekListesi] = useState<OrnekSablonBilgisi[]>([]);
  const [kilavuz, setKilavuz] = useState(false);
  const dosyaGirdisi = useRef<HTMLInputElement>(null);
  const onizlemeNo = useRef(0);

  const turYukle = useCallback(async () => {
    const liste = await BelgeService.sablonTurleri();
    setTurler(liste);
    setSecili((s) => s || liste[0]?.tur || "");
  }, []);

  const seciliYukle = useCallback(async (tur: string) => {
    if (!tur) return;
    const no = ++onizlemeNo.current;
    const e = await BelgeService.sablonGetir(tur);
    if (no !== onizlemeNo.current) return;
    setEtkin(e);
    const o = await BelgeService.sablonOnizle(tur, { satim });
    if (no !== onizlemeNo.current || !o.gecerli || !o.sablon) return;
    setOnizlemeHtml((await sablonHtml(o.sablon, o.veri || {}, o.gorseller || {})).html);
  }, [satim]);

  const hepsiniYukle = useCallback(async () => {
    if (!yetkili) { setYukleniyor(false); return; }
    setYukleniyor(true);
    try {
      await turYukle();
    } catch (e: any) {
      setUyari({ type: "danger", message: e?.message || "Belge türleri okunamadı." });
    } finally { setYukleniyor(false); }
  }, [yetkili, turYukle]);

  useEffect(() => { void hepsiniYukle(); }, [hepsiniYukle]);
  useEffect(() => {
    if (!secili) return;
    BelgeService.ornekler(secili).then(setOrnekListesi).catch(() => setOrnekListesi([]));
  }, [secili]);
  useEffect(() => {
    if (!secili) return;
    setOnizlemeHtml(""); setYuklenen(null);
    seciliYukle(secili).catch((e: any) => setUyari({ type: "danger", message: e?.message || "Şablon okunamadı." }));
  }, [secili, seciliYukle]);

  const seciliTur = useMemo(() => turler.find((t) => t.tur === secili) || null, [turler, secili]);

  const isle = async (ad: string, f: () => Promise<string | void>) => {
    setIslem(ad); setUyari(null);
    try {
      const mesaj = await f();
      if (mesaj) setUyari({ type: "success", message: mesaj });
      await turYukle();
      await seciliYukle(secili);
    } catch (e: any) {
      setUyari({ type: "danger", message: e?.message || "İşlem yapılamadı." });
    } finally { setIslem(null); }
  };

  // ── Dosya yükleme: oku → denetle → önizle; kaydetme ayrı onayla
  const dosyaSecildi = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const dosya = e.target.files?.[0];
    e.target.value = "";
    if (!dosya || !secili) return;
    setUyari(null);
    if (dosya.size > 300 * 1024) { setUyari({ type: "danger", message: "Dosya çok büyük (en çok 300 KB)." }); return; }
    setIslem("denetle");
    try {
      const icerik = await dosya.text();
      const o = await BelgeService.sablonOnizle(secili, { icerik, satim });
      const html = o.gecerli && o.sablon ? (await sablonHtml(o.sablon, o.veri || {}, o.gorseller || {})).html : "";
      setYuklenen({ ad: dosya.name, icerik, hatalar: o.hatalar || [], html });
    } catch (err: any) {
      setUyari({ type: "danger", message: err?.message || "Dosya denetlenemedi." });
    } finally { setIslem(null); }
  };

  // Örnek: firmanın görselleriyle doldurulur, yüklenen dosya gibi önizlenir; "Kaydet ve Kullan" ya da "Düzenleyerek başla"
  const ornekSec = async (o: OrnekSablonBilgisi) => {
    setUyari(null); setIslem("denetle");
    try {
      const sablon = await BelgeService.ornekGetir(secili, o.kod);
      const on = await BelgeService.sablonOnizle(secili, { sablon, satim });
      const html = on.gecerli && on.sablon ? (await sablonHtml(on.sablon, on.veri || {}, on.gorseller || {})).html : "";
      setYuklenen({ ad: `Örnek: ${o.ad}`, icerik: JSON.stringify(sablon), hatalar: on.hatalar || [], html });
    } catch (e: any) { setUyari({ type: "danger", message: e?.message || "Örnek açılamadı." }); }
    finally { setIslem(null); }
  };

  const yukleneniKaydet = () => yuklenen && isle("kaydet", async () => {
    const govde: SablonGovdesi = { icerik: yuklenen.icerik };
    try {
      await BelgeService.sablonKaydet(secili, govde);
    } catch (e: any) {
      const hatalar: SablonDenetimHatasi[] = e?.ayrinti?.hatalar || [];
      if (hatalar.length) { setYuklenen({ ...yuklenen, hatalar, html: "" }); throw new Error("Şablon kaydedilmedi; hataları düzeltip yeniden yükleyin."); }
      throw e;
    }
    setYuklenen(null);
    return `"${yuklenen.ad}" kaydedildi; ${seciliTur?.ad || "belge"} artık bu düzenle basılacak. Önceki düzen "Önceki Sürüm" listesinde.`;
  });

  if (!yetkili) {
    return (
      <div className="w-100 pb-3">
        <ERPToolbar pageTitle="Belge Tasarımı" pageIcon={<IconLayout size={22} className="text-primary" />} />
        <Alert variant="warning" className="m-3">Belge Tasarımı yalnızca sistem yöneticisine açıktır.</Alert>
      </div>
    );
  }

  return (
    <div className="w-100 pb-3" style={{ overflowX: "hidden" }}>
      <ERPToolbar
        pageTitle="Belge Tasarımı"
        pageIcon={<IconLayout size={22} className="text-primary" />}
        onRefresh={() => void hepsiniYukle().then(() => seciliYukle(secili))}
        disabled={yukleniyor || !!islem}
      />

      {uyari && (
        <Alert variant={uyari.type} dismissible onClose={() => setUyari(null)} className="py-2 px-3 mb-3 small fw-medium">
          {uyari.message}
        </Alert>
      )}

      {duzenleniyor && etkin ? (
        <div className="card shadow-sm overflow-hidden">
          <SablonEditoru
            key={`${secili}-${satim}`}
            tur={secili}
            turAdi={seciliTur?.ad || secili}
            baslangic={editorBaslangici?.sablon || etkin.sablon}
            kayitsizBaslangic={!!editorBaslangici?.kayitsiz}
            satim={satim}
            onKapat={() => setDuzenleniyor(false)}
            onKaydedildi={(mesaj) => { setDuzenleniyor(false); void isle("editor", async () => mesaj); }}
          />
        </div>
      ) : (
      <Row className="g-3">
        <Col lg={3}>
          <Card className="shadow-sm">
            <Card.Header className="py-2 fw-bold small">Belgeler</Card.Header>
            {yukleniyor ? (
              <div className="p-3 text-muted small d-flex align-items-center gap-2"><Spinner size="sm" /> Yükleniyor…</div>
            ) : (
              <ListGroup variant="flush">
                {turler.map((t) => (
                  <ListGroup.Item key={t.tur} action active={t.tur === secili} onClick={() => setSecili(t.tur)} className="py-2">
                    <div className="fw-semibold small">{t.ad}</div>
                    <div className="d-flex align-items-center gap-1 mt-1" style={{ fontSize: 11 }}>
                      {t.firmaSablonu ? <Badge bg="success">Firma düzeni</Badge> : <Badge bg="secondary">Varsayılan</Badge>}
                      {t.surumSayisi > 0 && <span className="opacity-75">{t.surumSayisi} eski sürüm</span>}
                    </div>
                  </ListGroup.Item>
                ))}
              </ListGroup>
            )}
          </Card>
        </Col>

        <Col lg={9}>
          <Card className="shadow-sm">
            <Card.Header className="py-2 d-flex flex-wrap align-items-center gap-2">
              <div className="fw-bold small me-auto">
                {seciliTur?.ad || "-"}
                {etkin && (
                  <span className="ms-2 fw-normal text-muted">
                    {etkin.kaynak === "FIRMA" ? `Firma düzeni · ${tarihYaz(seciliTur?.guncelleme)}` : "Varsayılan düzen"}
                  </span>
                )}
              </div>
              {satimSecenekli(secili) && (
                <ButtonGroup size="sm">
                  <Button variant={satim ? "primary" : "outline-secondary"} onClick={() => setSatim(true)}>Satış</Button>
                  <Button variant={!satim ? "primary" : "outline-secondary"} onClick={() => setSatim(false)}>Alış</Button>
                </ButtonGroup>
              )}
              <Button size="sm" variant="outline-primary" disabled={!!islem || !secili} onClick={() => isle("indir", () => BelgeService.sablonIndir(secili))}>
                <IconDownload size={15} className="me-1" />Şablonu İndir
              </Button>
              <Button size="sm" variant="outline-primary" disabled={!!islem || !secili} onClick={() => dosyaGirdisi.current?.click()}>
                {islem === "denetle" ? <Spinner size="sm" className="me-1" /> : <IconUpload size={15} className="me-1" />}Şablonu Yükle
              </Button>
              <input ref={dosyaGirdisi} type="file" accept=".json,application/json" hidden onChange={dosyaSecildi} />
              <Dropdown>
                <Dropdown.Toggle size="sm" variant="outline-secondary" disabled={!!islem || !etkin?.surumler?.length}>
                  <IconHistory size={15} className="me-1" />Önceki Sürüm
                </Dropdown.Toggle>
                <Dropdown.Menu style={{ maxHeight: 320, overflowY: "auto" }}>
                  {(etkin?.surumler || []).map((s) => (
                    <Dropdown.Item key={s.ad} onClick={() => setOnay({
                      baslik: "Önceki sürüme dön",
                      metin: `${surumEtiketi(s.ad)} tarihli düzen etkin olacak. Şu anki düzen de sürümlere eklenir.`,
                      calistir: () => isle("geri", async () => { await BelgeService.surumeDon(secili, s.ad); return "Önceki sürüme dönüldü."; }),
                    })}>
                      {surumEtiketi(s.ad)}
                    </Dropdown.Item>
                  ))}
                </Dropdown.Menu>
              </Dropdown>
              <Button size="sm" variant="outline-danger" disabled={!!islem || etkin?.kaynak !== "FIRMA"} onClick={() => setOnay({
                baslik: "Varsayılana dön",
                metin: "Firmanın düzeni kaldırılıp varsayılan düzen kullanılacak. Firma düzeni silinmez, \"Önceki Sürüm\" listesinden geri alınabilir.",
                calistir: () => isle("varsayilan", async () => { await BelgeService.varsayilanaDon(secili); return "Varsayılan düzene dönüldü."; }),
              })}>
                <IconArrowBackUp size={15} className="me-1" />Varsayılana Dön
              </Button>
              <Dropdown>
                <Dropdown.Toggle size="sm" variant="outline-secondary" disabled={!!islem || !ornekListesi.length}>
                  <IconTemplate size={15} className="me-1" />Örnekler
                </Dropdown.Toggle>
                <Dropdown.Menu>
                  {ornekListesi.map((o) => (
                    <Dropdown.Item key={o.kod} onClick={() => void ornekSec(o)}>
                      <div className="small fw-semibold">{o.ad}</div>
                      <div className="text-muted" style={{ fontSize: 11, whiteSpace: "normal", maxWidth: 320 }}>{o.aciklama}</div>
                    </Dropdown.Item>
                  ))}
                </Dropdown.Menu>
              </Dropdown>
              <Button size="sm" variant="primary" disabled={!!islem || !etkin} onClick={() => { setEditorBaslangici(null); setDuzenleniyor(true); }}>
                <IconEdit size={15} className="me-1" />Düzenle
              </Button>
              <Button size="sm" variant="outline-secondary" disabled={!!islem} onClick={() => setGorselPenceresi(true)}>
                <IconPhoto size={15} className="me-1" />Logolar ve İmzalar
              </Button>
              <Button size="sm" variant="outline-info" onClick={() => setKilavuz(true)}>
                <IconHelp size={15} className="me-1" />Nasıl yapılır?
              </Button>
              <Button size="sm" variant="light" title="Yenile" disabled={!!islem} onClick={() => isle("yenile", async () => undefined)}>
                <IconRefresh size={15} />
              </Button>
            </Card.Header>

            {etkin?.uyari && <Alert variant="warning" className="m-2 mb-0 py-2 small">{etkin.uyari}</Alert>}

            {yuklenen && (
              <div className="border-bottom p-3" style={{ background: "#fffbea" }}>
                <div className="d-flex align-items-center gap-2 mb-2">
                  <IconFileText size={18} />
                  <div className="fw-bold small me-auto">Yüklenen dosya: {yuklenen.ad}</div>
                  <Button size="sm" variant="success" disabled={!!islem || yuklenen.hatalar.length > 0} onClick={() => void yukleneniKaydet()}>
                    {islem === "kaydet" && <Spinner size="sm" className="me-1" />}Kaydet ve Kullan
                  </Button>
                  <Button size="sm" variant="outline-primary" disabled={!!islem || yuklenen.hatalar.length > 0} onClick={() => {
                    setEditorBaslangici({ sablon: JSON.parse(yuklenen.icerik), kayitsiz: true }); setYuklenen(null); setDuzenleniyor(true);
                  }}><IconEdit size={14} className="me-1" />Düzenleyerek başla</Button>
                  <Button size="sm" variant="outline-secondary" disabled={!!islem} onClick={() => setYuklenen(null)}>Vazgeç</Button>
                </div>
                {yuklenen.hatalar.length > 0 ? (
                  <Alert variant="danger" className="mb-0 py-2 small">
                    <div className="fw-bold mb-1">Dosya kaydedilmedi — {yuklenen.hatalar.length} hata:</div>
                    <ul className="mb-0 ps-3" style={{ maxHeight: 220, overflowY: "auto" }}>
                      {yuklenen.hatalar.map((h, i) => (
                        <li key={i}>{h.oge ? <b>{h.oge}{h.alan ? ` › ${h.alan}` : ""}: </b> : null}{h.mesaj}</li>
                      ))}
                    </ul>
                  </Alert>
                ) : (
                  <div className="small text-success">Dosya denetimden geçti. Aşağıda yeni düzenin önizlemesi var; "Kaydet ve Kullan" ile etkinleşir.</div>
                )}
              </div>
            )}

            <Card.Body className="p-3" style={{ background: "#525659", overflow: "auto", maxHeight: "78vh" }}>
              {(yuklenen?.html || onizlemeHtml) ? (
                <div style={{ width: "fit-content", margin: "0 auto", boxShadow: "0 4px 15px rgba(0,0,0,.35)", background: "#fff" }}
                  dangerouslySetInnerHTML={{ __html: yuklenen?.html || onizlemeHtml }} />
              ) : (
                <div className="text-white-50 small d-flex align-items-center gap-2 py-5 justify-content-center"><Spinner size="sm" /> Önizleme hazırlanıyor…</div>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      )}

      <NasilYapilirModal show={kilavuz} onHide={() => setKilavuz(false)} tur={secili} turAdi={seciliTur?.ad || ""} />

      <BelgeGorselleriModal show={gorselPenceresi} onHide={() => setGorselPenceresi(false)} onDegisti={() => void seciliYukle(secili)} />

      <Modal show={!!onay} onHide={() => setOnay(null)} centered size="sm">
        <Modal.Header closeButton className="py-2"><Modal.Title className="fs-6 fw-bold">{onay?.baslik}</Modal.Title></Modal.Header>
        <Modal.Body className="small">{onay?.metin}</Modal.Body>
        <Modal.Footer className="py-2">
          <Button size="sm" variant="outline-secondary" onClick={() => setOnay(null)}>Vazgeç</Button>
          <Button size="sm" variant="primary" onClick={() => { const o = onay; setOnay(null); void o?.calistir(); }}>Onayla</Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default BelgeTasarimiPage;
