import React, { useState, useEffect, useCallback, useRef } from "react";
import { Container, Row, Col, Card, Form, Button, Alert, Modal, InputGroup, Badge } from "react-bootstrap";
import {
  IconRings,
  IconCheck,
  IconBinoculars,
  IconAlertTriangle,
  IconTrash,
  IconInfoCircle,
} from "@tabler/icons-react";
import ERPToolbar from "../../components/common/ERPToolbar";
import LookupModal, { LookupColumn } from "../../components/common/LookupModal";
import EtiketYazdirModal, { EtiketYazdirItem } from "./EtiketYazdirModal";
import { EtiketService, AltinUrunItem, EtiketSablonItem } from "../../services/etiketService";
import { CariService, CariKartItem } from "../../services/cariService";
import { PrinterService, YaziciItem } from "../../services/printerService";

const AYAR_SECENEKLERI = [
  { kod: "995", ad: "995 (24K Has)" },
  { kod: "916", ad: "916 (22K)" },
  { kod: "750", ad: "750 (18K)" },
  { kod: "585", ad: "585 (14K)" },
  { kod: "375", ad: "375 (9K)" },
];

const BILEZIK_FORMATLARI = ["Kelebek (Kuyruklu)", "Boğumlu", "Standart Yüzük"];

export const YuzukBilezikEtiketiPage: React.FC = () => {
  const [altinUrunId, setAltinUrunId] = useState<number | null>(null);
  const [grupKodu, setGrupKodu] = useState("YZK");
  const [urunNo, setUrunNo] = useState<number | string>("");
  const [barkod, setBarkod] = useState("");
  const [ayar, setAyar] = useState("916");
  const [miktar, setMiktar] = useState<number | string>(""); // Gram
  const [hasGram, setHasGram] = useState<number | string>(""); // Has Karşılığı
  const [ureticiKodu, setUreticiKodu] = useState(""); // ORJINAL_KOD
  const [ureticiFirma, setUreticiFirma] = useState("");
  const [bilezikFormati, setBilezikFormati] = useState(BILEZIK_FORMATLARI[0]);
  const [model, setModel] = useState("");
  const [satisFiyati, setSatisFiyati] = useState<number | string>("");
  const [satisParaKodu, setSatisParaKodu] = useState("HAS");

  const [urunList, setUrunList] = useState<AltinUrunItem[]>([]);
  const [cariList, setCariList] = useState<CariKartItem[]>([]);
  const [sablonlar, setSablonlar] = useState<EtiketSablonItem[]>([]);
  const [yazicilar, setYazicilar] = useState<YaziciItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [notification, setNotification] = useState<{ type: "success" | "danger" | "warning" | "info"; message: string } | null>(null);

  const [showLookup, setShowLookup] = useState(false);
  const [showFirmaLookup, setShowFirmaLookup] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);

  const grupKoduRef = useRef<HTMLInputElement | null>(null);
  const urunNoRef = useRef<HTMLInputElement | null>(null);
  const barkodRef = useRef<HTMLInputElement | null>(null);
  const bilezikFormatiRef = useRef<HTMLSelectElement | null>(null);
  const modelRef = useRef<HTMLInputElement | null>(null);
  const ayarRef = useRef<HTMLSelectElement | null>(null);
  const miktarRef = useRef<HTMLInputElement | null>(null);
  const hasGramRef = useRef<HTMLInputElement | null>(null);
  const ureticiKoduRef = useRef<HTMLInputElement | null>(null);
  const ureticiFirmaRef = useRef<HTMLInputElement | null>(null);
  const satisFiyatiRef = useRef<HTMLInputElement | null>(null);
  const satisParaKoduRef = useRef<HTMLSelectElement | null>(null);

  const showNotif = (type: "success" | "danger" | "warning" | "info", msg: string) => {
    setNotification({ type, message: msg });
    setTimeout(() => setNotification(null), 4500);
  };

  // Ok tuşları (Aşağı/Yukarı) ve Enter ile bir sonraki/önceki alana geçiş
  const handleFieldKeyDown = (
    e: React.KeyboardEvent<any>,
    nextRef?: React.RefObject<any>,
    prevRef?: React.RefObject<any>
  ) => {
    if (e.key === "Enter" || e.key === "ArrowDown") {
      e.preventDefault();
      if (nextRef?.current) nextRef.current.focus();
      else handleSave();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      prevRef?.current?.focus();
    }
  };

  const loadAll = useCallback(async () => {
    try {
      const [urunler, sabl, yzc, cariler] = await Promise.all([
        EtiketService.getAltinUrunler({ limit: 500 }),
        EtiketService.getSablonlar(2), // ETIKET_TIPI = 2 (Yüzük-Bilezik)
        PrinterService.getYazicilar().catch(() => []),
        CariService.getCariKartlar().catch(() => []),
      ]);
      setUrunList(urunler);
      setSablonlar(sabl);
      setYazicilar(yzc);
      setCariList(cariler);
    } catch (err: any) {
      showNotif("danger", err?.message || "Veriler yüklenemedi.");
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const firmaLookupColumns: LookupColumn<CariKartItem>[] = [
    { header: "Firma Kodu", width: "110px", render: (it) => <Badge bg="secondary">{it.kod}</Badge> },
    { header: "Firma / Cari Adı", width: "240px", render: (it) => <span className="fw-bold">{it.ad}</span> },
    { header: "Yetkili", width: "150px", render: (it) => it.yetkiliKisi || "-" },
    { header: "Telefon", width: "130px", render: (it) => it.telefon || "-" },
  ];

  // Has karşılığını Ayar seçimine göre otomatik hesapla (Gram × Milyem/1000)
  useEffect(() => {
    const gram = Number(miktar);
    const ayarNum = Number(ayar);
    if (gram > 0 && ayarNum > 0) {
      setHasGram(parseFloat(((gram * ayarNum) / 1000).toFixed(3)));
    }
  }, [miktar, ayar]);

  const handleNew = useCallback(() => {
    setAltinUrunId(null);
    setGrupKodu("YZK");
    setUrunNo("");
    setBarkod("");
    setAyar("916");
    setMiktar("");
    setHasGram("");
    setUreticiKodu("");
    setUreticiFirma("");
    setBilezikFormati(BILEZIK_FORMATLARI[0]);
    setModel("");
    setSatisFiyati("");
    setSatisParaKodu("HAS");
    grupKoduRef.current?.focus();
  }, []);

  const handleSelect = useCallback((it: AltinUrunItem) => {
    setAltinUrunId(it.altinUrunId);
    setGrupKodu(it.grupKodu);
    setUrunNo(it.urunNo);
    setBarkod(it.barkod || "");
    setAyar(it.ayar || "916");
    setMiktar(it.miktar);
    setHasGram(it.hasGram);
    setUreticiKodu(it.orjinalKod || "");
    setUreticiFirma(it.ureticiFirma || "");
    const [fmt, ...rest] = (it.model || "").split(" - ");
    setBilezikFormati(BILEZIK_FORMATLARI.includes(fmt) ? fmt : BILEZIK_FORMATLARI[0]);
    setModel(rest.join(" - ") || it.model || "");
    setSatisFiyati(it.satisFiyati);
    setSatisParaKodu(it.satisParaKodu || "HAS");
    showNotif("success", `Ürün yüklendi: ${it.grupKodu}-${it.urunNo}`);
  }, []);

  const handleUretNo = useCallback(async () => {
    if (!grupKodu.trim() || grupKodu.trim().length !== 3) {
      showNotif("warning", "Lütfen 3 harfli bir grup kodu giriniz (Örn: YZK, BLZ).");
      grupKoduRef.current?.focus();
      return;
    }
    try {
      const result = await EtiketService.getNextAltinUrunNo(grupKodu.trim());
      setUrunNo(result.sonNo);
      setBarkod(result.barkod);
      if (result.yeniGrup) {
        showNotif("info", `"${result.grupKodu}" grubu için numaratör tanımlı değildi, 1'den başlatılarak otomatik oluşturuldu.`);
      } else {
        showNotif("success", `Sıradaki numara üretildi: ${result.barkod}`);
      }
    } catch (err: any) {
      showNotif("danger", err?.message || "Sıradaki numara üretilemedi.");
    }
  }, [grupKodu]);

  const handleSave = useCallback(async () => {
    if (!grupKodu.trim() || grupKodu.trim().length !== 3) {
      showNotif("warning", "Grup kodu 3 harfli olmalıdır.");
      grupKoduRef.current?.focus();
      return;
    }
    if (!urunNo || Number(urunNo) <= 0) {
      showNotif("warning", "Lütfen ürün numarasını üretin veya giriniz.");
      return;
    }
    if (!miktar || Number(miktar) <= 0) {
      showNotif("warning", "Lütfen gram bilgisini giriniz.");
      miktarRef.current?.focus();
      return;
    }
    setIsSaving(true);
    try {
      const modelValue = model ? `${bilezikFormati} - ${model}` : bilezikFormati;
      const saved = await EtiketService.saveAltinUrun({
        altinUrunId,
        grupKodu: grupKodu.trim().toUpperCase(),
        urunNo: Number(urunNo),
        barkod: barkod.trim() || undefined,
        ayar,
        ureticiFirma: ureticiFirma.trim() || undefined,
        orjinalKod: ureticiKodu.trim() || undefined,
        model: modelValue,
        miktar: Number(miktar),
        hasGram: Number(hasGram) || 0,
        satisFiyati: Number(satisFiyati) || 0,
        satisParaKodu,
      });
      showNotif("success", `Etiket kaydı ${altinUrunId ? "güncellendi" : "kaydedildi"}: ${saved.grupKodu}-${saved.urunNo}`);
      setAltinUrunId(saved.altinUrunId);
      setBarkod(saved.barkod || "");
      const updated = await EtiketService.getAltinUrunler({ limit: 500 });
      setUrunList(updated);
    } catch (err: any) {
      showNotif("danger", err?.message || "Kayıt sırasında hata oluştu.");
    } finally {
      setIsSaving(false);
    }
  }, [altinUrunId, grupKodu, urunNo, barkod, ayar, ureticiFirma, ureticiKodu, bilezikFormati, model, miktar, hasGram, satisFiyati, satisParaKodu]);

  const handleDelete = useCallback(async () => {
    if (!altinUrunId) return;
    try {
      await EtiketService.deleteAltinUrun(altinUrunId);
      showNotif("success", "Etiket kaydı silindi.");
      setShowDeleteConfirm(false);
      handleNew();
      const updated = await EtiketService.getAltinUrunler({ limit: 500 });
      setUrunList(updated);
    } catch (err: any) {
      showNotif("danger", err?.message || "Kayıt silinemedi.");
      setShowDeleteConfirm(false);
    }
  }, [altinUrunId, handleNew]);

  const varsayilanSablon = sablonlar.find((s) => s.varsayilan) || sablonlar[0] || null;

  const printItem: EtiketYazdirItem[] = altinUrunId
    ? [
        {
          id: altinUrunId,
          barkod: barkod || `${grupKodu}${urunNo}`,
          fields: {
            grupUrunNo: `${grupKodu}-${urunNo}`,
            ayar: ayar,
            has: String(hasGram || 0),
            gram: String(miktar || 0),
            ureticiKodu: ureticiKodu || "-",
            fiyat: satisFiyati ? `${satisFiyati} ${satisParaKodu}` : "-",
          },
        },
      ]
    : [];

  const currentIndex = urunList.findIndex((u) => u.altinUrunId === altinUrunId);
  const handleFirst = () => { if (urunList.length) handleSelect(urunList[0]); };
  const handlePrev = () => {
    if (currentIndex > 0) handleSelect(urunList[currentIndex - 1]);
    else if (urunList.length) handleSelect(urunList[0]);
  };
  const handleNext = () => {
    if (currentIndex >= 0 && currentIndex < urunList.length - 1) handleSelect(urunList[currentIndex + 1]);
    else if (urunList.length) handleSelect(urunList[urunList.length - 1]);
  };
  const handleLast = () => { if (urunList.length) handleSelect(urunList[urunList.length - 1]); };

  const lookupColumns: LookupColumn<AltinUrunItem>[] = [
    { header: "Barkod", width: "120px", render: (it) => <span className="font-monospace fw-bold text-primary">{it.barkod || "-"}</span> },
    { header: "Grup-No", width: "100px", render: (it) => `${it.grupKodu}-${it.urunNo}` },
    { header: "Model", render: (it) => it.model || "-" },
    { header: "Ayar", width: "80px", align: "center", render: (it) => it.ayar || "-" },
    { header: "Gram", width: "90px", align: "right", render: (it) => Number(it.miktar).toLocaleString("tr-TR", { minimumFractionDigits: 2 }) },
    {
      header: "Yazdırıldı",
      width: "90px",
      align: "center",
      render: (it) => <Badge bg={it.yazdirildi ? "success" : "secondary"}>{it.yazdirildi ? "Evet" : "Hayır"}</Badge>,
    },
  ];

  return (
    <Container fluid className="py-3 px-3 px-lg-4">
      <ERPToolbar
        pageTitle="D- Kuyumcu Yüzük / Bilezik Etiketi"
        pageIcon={<IconRings size={20} />}
        disabled={isSaving}
        onSave={handleSave}
        onDelete={() => {
          if (altinUrunId) setShowDeleteConfirm(true);
          else showNotif("warning", "Silinecek bir kayıt seçiniz.");
        }}
        onNew={handleNew}
        onRefresh={loadAll}
        onSearch={() => setShowLookup(true)}
        onPrint={() => (altinUrunId ? setShowPrintModal(true) : showNotif("warning", "Önce bir kayıt seçin veya kaydedin."))}
        onFirst={handleFirst}
        onPrev={handlePrev}
        onNext={handleNext}
        onLast={handleLast}
        modeText={altinUrunId ? `Düzenleme: #${altinUrunId} ${grupKodu}-${urunNo}` : "Yeni Kayıt Modu"}
      />

      {notification && (
        <div className="erp-toast-container">
          <Alert
            variant={notification.type === "info" ? "info" : notification.type}
            dismissible
            onClose={() => setNotification(null)}
            className="erp-toast-item d-flex align-items-center mb-0 shadow py-2 px-3 border-0"
          >
            {notification.type === "success" ? (
              <IconCheck size={18} className="me-2 text-success flex-shrink-0" />
            ) : notification.type === "info" ? (
              <IconInfoCircle size={18} className="me-2 text-info flex-shrink-0" />
            ) : (
              <IconAlertTriangle size={18} className="me-2 text-danger flex-shrink-0" />
            )}
            <span style={{ fontSize: "13px" }}>{notification.message}</span>
          </Alert>
        </div>
      )}

      <Card className="shadow-sm border-0 mb-3">
        <Card.Body className="p-3">
          <Row className="gx-4 gy-2">
            <Col lg={6} md={12}>
              <Form.Group as={Row} className="mb-2 align-items-center">
                <Form.Label column sm={4} className="small fw-bold text-secondary text-sm-end text-start">
                  Grup Kodu <span className="text-danger">*</span> :
                </Form.Label>
                <Col sm={8}>
                  <InputGroup size="sm">
                    <Form.Control
                      ref={grupKoduRef}
                      type="text"
                      size="sm"
                      value={grupKodu}
                      maxLength={3}
                      onChange={(e) => setGrupKodu(e.target.value.toUpperCase())}
                      onKeyDown={(e) => handleFieldKeyDown(e, urunNoRef)}
                      className="fw-bold text-primary font-monospace"
                    />
                    <Button variant="outline-primary" onClick={handleUretNo} title="Sıradaki Ürün No / Barkodu Üret">
                      Sıradaki No
                    </Button>
                  </InputGroup>
                </Col>
              </Form.Group>

              <Form.Group as={Row} className="mb-2 align-items-center">
                <Form.Label column sm={4} className="small fw-bold text-secondary text-sm-end text-start">
                  Ürün No :
                </Form.Label>
                <Col sm={8}>
                  <Form.Control
                    ref={urunNoRef}
                    type="number"
                    size="sm"
                    value={urunNo}
                    onChange={(e) => setUrunNo(e.target.value)}
                    onKeyDown={(e) => handleFieldKeyDown(e, barkodRef, grupKoduRef)}
                    className="font-monospace"
                  />
                </Col>
              </Form.Group>

              <Form.Group as={Row} className="mb-2 align-items-center">
                <Form.Label column sm={4} className="small fw-bold text-secondary text-sm-end text-start">
                  Barkod :
                </Form.Label>
                <Col sm={8}>
                  <Form.Control
                    ref={barkodRef}
                    type="text"
                    size="sm"
                    value={barkod}
                    onChange={(e) => setBarkod(e.target.value)}
                    onKeyDown={(e) => handleFieldKeyDown(e, bilezikFormatiRef, urunNoRef)}
                    className="font-monospace"
                  />
                </Col>
              </Form.Group>

              <Form.Group as={Row} className="mb-2 align-items-center">
                <Form.Label column sm={4} className="small fw-bold text-secondary text-sm-end text-start">
                  Etiket Formatı :
                </Form.Label>
                <Col sm={8}>
                  <Form.Select
                    ref={bilezikFormatiRef}
                    size="sm"
                    value={bilezikFormati}
                    onChange={(e) => setBilezikFormati(e.target.value)}
                    onKeyDown={(e) => handleFieldKeyDown(e, modelRef, barkodRef)}
                  >
                    {BILEZIK_FORMATLARI.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </Form.Select>
                </Col>
              </Form.Group>

              <Form.Group as={Row} className="mb-2 align-items-center">
                <Form.Label column sm={4} className="small fw-bold text-secondary text-sm-end text-start">
                  Model :
                </Form.Label>
                <Col sm={8}>
                  <Form.Control
                    ref={modelRef}
                    type="text"
                    size="sm"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    onKeyDown={(e) => handleFieldKeyDown(e, ayarRef, bilezikFormatiRef)}
                  />
                </Col>
              </Form.Group>
            </Col>

            <Col lg={6} md={12}>
              <Form.Group as={Row} className="mb-2 align-items-center">
                <Form.Label column sm={4} className="small fw-bold text-secondary text-sm-end text-start">
                  Milyem / Ayar <span className="text-danger">*</span> :
                </Form.Label>
                <Col sm={8}>
                  <Form.Select
                    ref={ayarRef}
                    size="sm"
                    value={ayar}
                    onChange={(e) => setAyar(e.target.value)}
                    onKeyDown={(e) => handleFieldKeyDown(e, miktarRef, modelRef)}
                  >
                    {AYAR_SECENEKLERI.map((a) => (
                      <option key={a.kod} value={a.kod}>
                        {a.ad}
                      </option>
                    ))}
                  </Form.Select>
                </Col>
              </Form.Group>

              <Form.Group as={Row} className="mb-2 align-items-center">
                <Form.Label column sm={4} className="small fw-bold text-secondary text-sm-end text-start">
                  Gram <span className="text-danger">*</span> :
                </Form.Label>
                <Col sm={8}>
                  <Form.Control
                    ref={miktarRef}
                    type="number"
                    step="0.001"
                    size="sm"
                    value={miktar}
                    onChange={(e) => setMiktar(e.target.value)}
                    onKeyDown={(e) => handleFieldKeyDown(e, hasGramRef, ayarRef)}
                    className="fw-bold font-monospace"
                  />
                </Col>
              </Form.Group>

              <Form.Group as={Row} className="mb-2 align-items-center">
                <Form.Label column sm={4} className="small fw-bold text-secondary text-sm-end text-start">
                  Has Karşılığı :
                </Form.Label>
                <Col sm={8}>
                  <Form.Control
                    ref={hasGramRef}
                    type="number"
                    step="0.001"
                    size="sm"
                    value={hasGram}
                    onChange={(e) => setHasGram(e.target.value)}
                    onKeyDown={(e) => handleFieldKeyDown(e, ureticiKoduRef, miktarRef)}
                    className="font-monospace"
                  />
                  <Form.Text className="text-muted">Otomatik: Gram × Milyem / 1000 (dilerseniz düzeltebilirsiniz)</Form.Text>
                </Col>
              </Form.Group>

              <Form.Group as={Row} className="mb-2 align-items-center">
                <Form.Label column sm={4} className="small fw-bold text-secondary text-sm-end text-start">
                  Üretici Kodu :
                </Form.Label>
                <Col sm={8}>
                  <InputGroup size="sm">
                    <Form.Control
                      ref={ureticiKoduRef}
                      type="text"
                      size="sm"
                      value={ureticiKodu}
                      onChange={(e) => setUreticiKodu(e.target.value)}
                      onKeyDown={(e) => handleFieldKeyDown(e, ureticiFirmaRef, hasGramRef)}
                      className="font-monospace"
                    />
                    <Button
                      variant="outline-secondary"
                      onClick={() => setShowFirmaLookup(true)}
                      title="Firma / Üretici Seç (Dürbün)"
                    >
                      <IconBinoculars size={14} />
                    </Button>
                  </InputGroup>
                </Col>
              </Form.Group>

              <Form.Group as={Row} className="mb-2 align-items-center">
                <Form.Label column sm={4} className="small fw-bold text-secondary text-sm-end text-start">
                  Üretici Firma :
                </Form.Label>
                <Col sm={8}>
                  <InputGroup size="sm">
                    <Form.Control
                      ref={ureticiFirmaRef}
                      type="text"
                      size="sm"
                      value={ureticiFirma}
                      onChange={(e) => setUreticiFirma(e.target.value)}
                      onKeyDown={(e) => handleFieldKeyDown(e, satisFiyatiRef, ureticiKoduRef)}
                    />
                    <Button
                      variant="outline-secondary"
                      onClick={() => setShowFirmaLookup(true)}
                      title="Firma / Üretici Seç (Dürbün)"
                    >
                      <IconBinoculars size={14} />
                    </Button>
                  </InputGroup>
                </Col>
              </Form.Group>

              <Form.Group as={Row} className="mb-2 align-items-center">
                <Form.Label column sm={4} className="small fw-bold text-secondary text-sm-end text-start">
                  Satış Fiyatı :
                </Form.Label>
                <Col sm={8}>
                  <InputGroup size="sm">
                    <Form.Control
                      ref={satisFiyatiRef}
                      type="number"
                      step="0.01"
                      size="sm"
                      value={satisFiyati}
                      onChange={(e) => setSatisFiyati(e.target.value)}
                      onKeyDown={(e) => handleFieldKeyDown(e, satisParaKoduRef, ureticiFirmaRef)}
                      className="font-monospace"
                    />
                    <Form.Select
                      ref={satisParaKoduRef}
                      value={satisParaKodu}
                      onChange={(e) => setSatisParaKodu(e.target.value)}
                      onKeyDown={(e) => handleFieldKeyDown(e, undefined, satisFiyatiRef)}
                      style={{ maxWidth: "100px" }}
                    >
                      <option value="HAS">HAS</option>
                      <option value="TL">TL</option>
                      <option value="USD">USD</option>
                    </Form.Select>
                  </InputGroup>
                </Col>
              </Form.Group>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      <LookupModal<AltinUrunItem>
        show={showLookup}
        title="Yüzük / Bilezik Etiketi Seçiniz (F3)"
        columns={lookupColumns}
        items={urunList}
        filterFn={(it, term) => {
          const t = term.toLowerCase();
          return (
            (it.barkod ? it.barkod.toLowerCase().includes(t) : false) ||
            (it.model ? it.model.toLowerCase().includes(t) : false) ||
            it.grupKodu.toLowerCase().includes(t) ||
            String(it.urunNo).includes(t)
          );
        }}
        onSelect={(selected) => {
          handleSelect(selected);
          setShowLookup(false);
        }}
        onHide={() => setShowLookup(false)}
      />

      <LookupModal<CariKartItem>
        show={showFirmaLookup}
        title="Üretici Firma / Cari Seçiniz"
        columns={firmaLookupColumns}
        items={cariList}
        filterFn={(it, term) => {
          const t = term.toLowerCase();
          return (
            (it.kod ? it.kod.toLowerCase().includes(t) : false) ||
            (it.ad ? it.ad.toLowerCase().includes(t) : false) ||
            (it.yetkiliKisi ? it.yetkiliKisi.toLowerCase().includes(t) : false)
          );
        }}
        onSelect={(selected) => {
          setUreticiFirma(selected.ad || selected.kod || "");
          if (!ureticiKodu) {
            setUreticiKodu(selected.kod || "");
          }
          setShowFirmaLookup(false);
        }}
        onHide={() => setShowFirmaLookup(false)}
      />

      <EtiketYazdirModal
        show={showPrintModal}
        onHide={() => setShowPrintModal(false)}
        title="Yüzük / Bilezik Etiketi Yazdır"
        sablon={varsayilanSablon}
        items={printItem}
        yazicilar={yazicilar}
        onAfterPrint={async () => {
          if (altinUrunId) {
            await EtiketService.markAltinUrunYazdirildi([altinUrunId], true);
            const updated = await EtiketService.getAltinUrunler({ limit: 500 });
            setUrunList(updated);
          }
        }}
      />

      <Modal show={showDeleteConfirm} onHide={() => setShowDeleteConfirm(false)} centered size="sm">
        <Modal.Header closeButton>
          <Modal.Title className="fs-6 fw-bold text-danger d-flex align-items-center gap-2">
            <IconAlertTriangle size={18} /> Etiket Kaydını Sil
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="py-3">
          <p className="mb-0 small">
            <strong>{grupKodu}-{urunNo}</strong> kaydı silinecektir. Devam etmek istiyor musunuz?
          </p>
        </Modal.Body>
        <Modal.Footer className="py-2">
          <Button variant="secondary" size="sm" onClick={() => setShowDeleteConfirm(false)}>
            Vazgeç
          </Button>
          <Button variant="danger" size="sm" onClick={handleDelete}>
            Evet, Sil
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default YuzukBilezikEtiketiPage;
