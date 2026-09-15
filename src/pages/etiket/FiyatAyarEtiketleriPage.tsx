import React, { useState, useEffect, useCallback, useRef } from "react";
import { Container, Row, Col, Card, Form, Button, Alert, Modal, InputGroup, Badge } from "react-bootstrap";
import {
  IconDiamond,
  IconCheck,
  IconBinoculars,
  IconAlertTriangle,
  IconTrash,
  IconInfoCircle,
} from "@tabler/icons-react";
import ERPToolbar from "../../components/common/ERPToolbar";
import LookupModal, { LookupColumn } from "../../components/common/LookupModal";
import EtiketYazdirModal, { EtiketYazdirItem } from "./EtiketYazdirModal";
import { EtiketService, OzelUrunItem, EtiketSablonItem } from "../../services/etiketService";
import { CariService, CariKartItem } from "../../services/cariService";
import { PrinterService, YaziciItem } from "../../services/printerService";
import { KurService } from "../../services/kurService";

const TAS_CINSLERI = ["Diamond (Pırlanta)", "Safir", "Yakut", "Zümrüt", "Akik", "Diğer"];
const RENK_SECENEKLERI = ["D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N-Z"];
const BERRAKLIK_SECENEKLERI = ["FL", "IF", "VVS1", "VVS2", "VS1", "VS2", "SI1", "SI2", "I1", "I2", "I3"];

export const FiyatAyarEtiketleriPage: React.FC = () => {
  const [ozelUrunId, setOzelUrunId] = useState<number | null>(null);
  const [grupKodu, setGrupKodu] = useState("PIR");
  const [urunNo, setUrunNo] = useState<number | string>("");
  const [barkod, setBarkod] = useState("");
  const [mamulTipi, setMamulTipi] = useState("Yüzük");
  const [ureticiFirma, setUreticiFirma] = useState("");
  const [ayar, setAyar] = useState("750"); // Montür ayarı
  const [tasCinsi, setTasCinsi] = useState(TAS_CINSLERI[0]);
  const [tasMiktar, setTasMiktar] = useState<number | string>(""); // Karat (Ct)
  const [tasRenk, setTasRenk] = useState("G");
  const [tasSaflik, setTasSaflik] = useState("VS1");
  const [tasAdet, setTasAdet] = useState<number | string>(1);

  const [sabitle, setSabitle] = useState(true);
  const [satisFiyati, setSatisFiyati] = useState<number | string>(""); // Sabitse USD/EUR sabit fiyat
  const [satisParaKodu, setSatisParaKodu] = useState("USD");
  const [hasKuruCarpani, setHasKuruCarpani] = useState<number | string>(1); // Sabit değilse: anlık HAS kuru × çarpan
  const [anlikHasKuru, setAnlikHasKuru] = useState<number | null>(null);
  const [hesaplananTlFiyat, setHesaplananTlFiyat] = useState<number>(0);

  const [urunList, setUrunList] = useState<OzelUrunItem[]>([]);
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
  const mamulTipiRef = useRef<HTMLInputElement | null>(null);
  const ayarRef = useRef<HTMLSelectElement | null>(null);
  const ureticiFirmaRef = useRef<HTMLInputElement | null>(null);
  const tasCinsiRef = useRef<HTMLSelectElement | null>(null);
  const tasMiktarRef = useRef<HTMLInputElement | null>(null);
  const tasAdetRef = useRef<HTMLInputElement | null>(null);
  const tasRenkRef = useRef<HTMLSelectElement | null>(null);
  const tasSaflikRef = useRef<HTMLSelectElement | null>(null);
  const sabitleRef = useRef<HTMLInputElement | null>(null);
  const satisFiyatiRef = useRef<HTMLInputElement | null>(null);
  const satisParaKoduRef = useRef<HTMLSelectElement | null>(null);
  const hasKuruCarpaniRef = useRef<HTMLInputElement | null>(null);

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
      const [urunler, sabl, yzc, kurTablosu, cariler] = await Promise.all([
        EtiketService.getOzelUrunler({ limit: 500 }),
        EtiketService.getSablonlar(3), // ETIKET_TIPI = 3 (Fiyat-Ayar)
        PrinterService.getYazicilar().catch(() => []),
        KurService.getKurTablosu({ tur: 0 }).catch(() => null),
        CariService.getCariKartlar().catch(() => []),
      ]);
      setUrunList(urunler);
      setSablonlar(sabl);
      setYazicilar(yzc);
      setCariList(cariler);
      const hasRow = kurTablosu?.satirlar?.find((s) => (s.kod || "").toUpperCase() === "HAS");
      if (hasRow?.dovizSatis) setAnlikHasKuru(Number(hasRow.dovizSatis));
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

  // Sabitlenmemiş fiyat: anlık has kuru × çarpan → TL etiket fiyatı önizlemesi
  useEffect(() => {
    if (!sabitle && anlikHasKuru) {
      setHesaplananTlFiyat(parseFloat((anlikHasKuru * (Number(hasKuruCarpani) || 0)).toFixed(2)));
    }
  }, [sabitle, anlikHasKuru, hasKuruCarpani]);

  const handleNew = useCallback(() => {
    setOzelUrunId(null);
    setGrupKodu("PIR");
    setUrunNo("");
    setBarkod("");
    setMamulTipi("Yüzük");
    setUreticiFirma("");
    setAyar("750");
    setTasCinsi(TAS_CINSLERI[0]);
    setTasMiktar("");
    setTasRenk("G");
    setTasSaflik("VS1");
    setTasAdet(1);
    setSabitle(true);
    setSatisFiyati("");
    setSatisParaKodu("USD");
    setHasKuruCarpani(1);
    grupKoduRef.current?.focus();
  }, []);

  const handleSelect = useCallback((it: OzelUrunItem) => {
    setOzelUrunId(it.ozelUrunId);
    setGrupKodu(it.grupKodu);
    setUrunNo(it.urunNo);
    setBarkod(it.barkod || "");
    setMamulTipi(it.mamulTipi || "Yüzük");
    setUreticiFirma(it.ureticiFirma || "");
    setAyar(it.ayar || "750");
    setTasCinsi(it.tasCinsi || TAS_CINSLERI[0]);
    setTasMiktar(it.tasMiktar ?? "");
    setTasRenk(it.tasRenk || "G");
    setTasSaflik(it.tasSaflik || "VS1");
    setTasAdet(it.tasAdet ?? 1);
    setSabitle(Boolean(it.sabitle));
    setSatisFiyati(it.satisFiyati);
    setSatisParaKodu(it.satisParaKodu || "USD");
    showNotif("success", `Ürün yüklendi: ${it.grupKodu}-${it.urunNo}`);
  }, []);

  const handleUretNo = useCallback(async () => {
    if (!grupKodu.trim() || grupKodu.trim().length !== 3) {
      showNotif("warning", "Lütfen 3 harfli bir grup kodu giriniz (Örn: PIR, KOL).");
      grupKoduRef.current?.focus();
      return;
    }
    try {
      const result = await EtiketService.getNextOzelUrunNo(grupKodu.trim());
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
    setIsSaving(true);
    try {
      const finalSatisFiyati = sabitle ? Number(satisFiyati) || 0 : hesaplananTlFiyat;
      const finalSatisParaKodu = sabitle ? satisParaKodu : "TL";
      const saved = await EtiketService.saveOzelUrun({
        ozelUrunId,
        grupKodu: grupKodu.trim().toUpperCase(),
        urunNo: Number(urunNo),
        barkod: barkod.trim() || undefined,
        mamulTipi,
        ureticiFirma: ureticiFirma.trim() || undefined,
        ayar,
        sabitle,
        satisFiyati: finalSatisFiyati,
        satisParaKodu: finalSatisParaKodu,
        tasCinsi,
        tasMiktar: Number(tasMiktar) || null,
        tasBirim: "Ct",
        tasRenk,
        tasSaflik,
        tasAdet: Number(tasAdet) || 1,
      });
      showNotif("success", `Fiyat & Ayar etiketi ${ozelUrunId ? "güncellendi" : "kaydedildi"}: ${saved.grupKodu}-${saved.urunNo}`);
      setOzelUrunId(saved.ozelUrunId);
      setBarkod(saved.barkod || "");
      const updated = await EtiketService.getOzelUrunler({ limit: 500 });
      setUrunList(updated);
    } catch (err: any) {
      showNotif("danger", err?.message || "Kayıt sırasında hata oluştu.");
    } finally {
      setIsSaving(false);
    }
  }, [
    ozelUrunId, grupKodu, urunNo, barkod, mamulTipi, ureticiFirma, ayar, sabitle, satisFiyati,
    satisParaKodu, hesaplananTlFiyat, tasCinsi, tasMiktar, tasRenk, tasSaflik, tasAdet,
  ]);

  const handleDelete = useCallback(async () => {
    if (!ozelUrunId) return;
    try {
      await EtiketService.deleteOzelUrun(ozelUrunId);
      showNotif("success", "Kayıt silindi.");
      setShowDeleteConfirm(false);
      handleNew();
      const updated = await EtiketService.getOzelUrunler({ limit: 500 });
      setUrunList(updated);
    } catch (err: any) {
      showNotif("danger", err?.message || "Kayıt silinemedi.");
      setShowDeleteConfirm(false);
    }
  }, [ozelUrunId, handleNew]);

  const varsayilanSablon = sablonlar.find((s) => s.varsayilan) || sablonlar[0] || null;

  const printItem: EtiketYazdirItem[] = ozelUrunId
    ? [
        {
          id: ozelUrunId,
          barkod: barkod || `${grupKodu}${urunNo}`,
          fields: {
            grupUrunNo: `${grupKodu}-${urunNo}`,
            montur: ayar,
            tasCinsi,
            karat: tasMiktar ? `${tasMiktar} Ct` : "-",
            renk: tasRenk,
            berraklik: tasSaflik,
            fiyat: sabitle ? `${satisFiyati} ${satisParaKodu}` : `${hesaplananTlFiyat} TL`,
          },
        },
      ]
    : [];

  const currentIndex = urunList.findIndex((u) => u.ozelUrunId === ozelUrunId);
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

  const lookupColumns: LookupColumn<OzelUrunItem>[] = [
    { header: "Barkod", width: "120px", render: (it) => <span className="font-monospace fw-bold text-primary">{it.barkod || "-"}</span> },
    { header: "Grup-No", width: "100px", render: (it) => `${it.grupKodu}-${it.urunNo}` },
    { header: "Mamul Tipi", render: (it) => it.mamulTipi || "-" },
    { header: "Taş Cinsi", render: (it) => it.tasCinsi || "-" },
    { header: "Karat", width: "80px", align: "right", render: (it) => (it.tasMiktar ? `${it.tasMiktar} Ct` : "-") },
    {
      header: "Fiyat",
      width: "110px",
      align: "right",
      render: (it) => (
        <span className="fw-semibold">
          {Number(it.satisFiyati || 0).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} {it.satisParaKodu}
        </span>
      ),
    },
  ];

  return (
    <Container fluid className="py-3 px-3 px-lg-4">
      <ERPToolbar
        pageTitle="E- Fiyat & Ayar Etiketleri"
        pageIcon={<IconDiamond size={20} />}
        disabled={isSaving}
        onSave={handleSave}
        onDelete={() => {
          if (ozelUrunId) setShowDeleteConfirm(true);
          else showNotif("warning", "Silinecek bir kayıt seçiniz.");
        }}
        onNew={handleNew}
        onRefresh={loadAll}
        onSearch={() => setShowLookup(true)}
        onPrint={() => (ozelUrunId ? setShowPrintModal(true) : showNotif("warning", "Önce bir kayıt seçin veya kaydedin."))}
        onFirst={handleFirst}
        onPrev={handlePrev}
        onNext={handleNext}
        onLast={handleLast}
        modeText={ozelUrunId ? `Düzenleme: #${ozelUrunId} ${grupKodu}-${urunNo}` : "Yeni Kayıt Modu"}
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
                    onKeyDown={(e) => handleFieldKeyDown(e, mamulTipiRef, urunNoRef)}
                    className="font-monospace"
                  />
                </Col>
              </Form.Group>

              <Form.Group as={Row} className="mb-2 align-items-center">
                <Form.Label column sm={4} className="small fw-bold text-secondary text-sm-end text-start">
                  Mamul Tipi :
                </Form.Label>
                <Col sm={8}>
                  <Form.Control
                    ref={mamulTipiRef}
                    type="text"
                    size="sm"
                    value={mamulTipi}
                    onChange={(e) => setMamulTipi(e.target.value)}
                    onKeyDown={(e) => handleFieldKeyDown(e, ayarRef, barkodRef)}
                  />
                </Col>
              </Form.Group>

              <Form.Group as={Row} className="mb-2 align-items-center">
                <Form.Label column sm={4} className="small fw-bold text-secondary text-sm-end text-start">
                  Montür Ayarı :
                </Form.Label>
                <Col sm={8}>
                  <Form.Select
                    ref={ayarRef}
                    size="sm"
                    value={ayar}
                    onChange={(e) => setAyar(e.target.value)}
                    onKeyDown={(e) => handleFieldKeyDown(e, ureticiFirmaRef, mamulTipiRef)}
                  >
                    <option value="750">750 (18K)</option>
                    <option value="585">585 (14K)</option>
                    <option value="925">925 (Gümüş)</option>
                  </Form.Select>
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
                      onKeyDown={(e) => handleFieldKeyDown(e, tasCinsiRef, ayarRef)}
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
            </Col>

            <Col lg={6} md={12}>
              <div className="bg-light p-2 rounded border mb-2">
                <div className="fw-bold small text-secondary mb-2">Taş Detayları</div>
                <Form.Group as={Row} className="mb-2 align-items-center">
                  <Form.Label column sm={4} className="small fw-bold text-secondary text-sm-end text-start">
                    Taş Cinsi :
                  </Form.Label>
                  <Col sm={8}>
                    <Form.Select
                      ref={tasCinsiRef}
                      size="sm"
                      value={tasCinsi}
                      onChange={(e) => setTasCinsi(e.target.value)}
                      onKeyDown={(e) => handleFieldKeyDown(e, tasMiktarRef, ureticiFirmaRef)}
                    >
                      {TAS_CINSLERI.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </Form.Select>
                  </Col>
                </Form.Group>

                <Form.Group as={Row} className="mb-2 align-items-center">
                  <Form.Label column sm={4} className="small fw-bold text-secondary text-sm-end text-start">
                    Karat (Ct) :
                  </Form.Label>
                  <Col sm={8}>
                    <Form.Control
                      ref={tasMiktarRef}
                      type="number"
                      step="0.01"
                      size="sm"
                      value={tasMiktar}
                      onChange={(e) => setTasMiktar(e.target.value)}
                      onKeyDown={(e) => handleFieldKeyDown(e, tasAdetRef, tasCinsiRef)}
                      className="font-monospace"
                    />
                  </Col>
                </Form.Group>

                <Form.Group as={Row} className="mb-2 align-items-center">
                  <Form.Label column sm={4} className="small fw-bold text-secondary text-sm-end text-start">
                    Adet :
                  </Form.Label>
                  <Col sm={8}>
                    <Form.Control
                      ref={tasAdetRef}
                      type="number"
                      size="sm"
                      value={tasAdet}
                      onChange={(e) => setTasAdet(e.target.value)}
                      onKeyDown={(e) => handleFieldKeyDown(e, tasRenkRef, tasMiktarRef)}
                      className="font-monospace"
                    />
                  </Col>
                </Form.Group>

                <Row className="g-2">
                  <Col sm={6}>
                    <Form.Group as={Row} className="mb-2 align-items-center">
                      <Form.Label column sm={4} className="small fw-bold text-secondary text-sm-end text-start">
                        Renk :
                      </Form.Label>
                      <Col sm={8}>
                        <Form.Select
                          ref={tasRenkRef}
                          size="sm"
                          value={tasRenk}
                          onChange={(e) => setTasRenk(e.target.value)}
                          onKeyDown={(e) => handleFieldKeyDown(e, tasSaflikRef, tasAdetRef)}
                        >
                          {RENK_SECENEKLERI.map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </Form.Select>
                      </Col>
                    </Form.Group>
                  </Col>
                  <Col sm={6}>
                    <Form.Group as={Row} className="mb-2 align-items-center">
                      <Form.Label column sm={5} className="small fw-bold text-secondary text-sm-end text-start">
                        Berraklık :
                      </Form.Label>
                      <Col sm={7}>
                        <Form.Select
                          ref={tasSaflikRef}
                          size="sm"
                          value={tasSaflik}
                          onChange={(e) => setTasSaflik(e.target.value)}
                          onKeyDown={(e) => handleFieldKeyDown(e, sabitleRef, tasRenkRef)}
                        >
                          {BERRAKLIK_SECENEKLERI.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </Form.Select>
                      </Col>
                    </Form.Group>
                  </Col>
                </Row>
              </div>

              <div className="bg-light p-2 rounded border">
                <div className="fw-bold small text-secondary mb-2">Fiyatlandırma Modeli</div>
                <Form.Group className="mb-2">
                  <Form.Check
                    ref={sabitleRef}
                    type="checkbox"
                    id="sabitleCheck"
                    label="Fiyatı Sabitle (USD / EUR bazında sabit etiket fiyatı)"
                    checked={sabitle}
                    onChange={(e) => setSabitle(e.target.checked)}
                    className="small fw-semibold"
                  />
                </Form.Group>

                {sabitle ? (
                  <Form.Group as={Row} className="mb-2 align-items-center">
                    <Form.Label column sm={4} className="small fw-bold text-secondary text-sm-end text-start">
                      Sabit Fiyat :
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
                          onKeyDown={(e) => handleFieldKeyDown(e, satisParaKoduRef, sabitleRef)}
                          className="font-monospace fw-bold"
                        />
                        <Form.Select
                          ref={satisParaKoduRef}
                          value={satisParaKodu}
                          onChange={(e) => setSatisParaKodu(e.target.value)}
                          onKeyDown={(e) => handleFieldKeyDown(e, undefined, satisFiyatiRef)}
                          style={{ maxWidth: "100px" }}
                        >
                          <option value="USD">USD</option>
                          <option value="EUR">EUR</option>
                          <option value="TL">TL</option>
                        </Form.Select>
                      </InputGroup>
                    </Col>
                  </Form.Group>
                ) : (
                  <div>
                    <Form.Group as={Row} className="mb-2 align-items-center">
                      <Form.Label column sm={4} className="small fw-bold text-secondary text-sm-end text-start">
                        HAS Çarpanı :
                      </Form.Label>
                      <Col sm={8}>
                        <Form.Control
                          ref={hasKuruCarpaniRef}
                          type="number"
                          step="0.01"
                          size="sm"
                          value={hasKuruCarpani}
                          onChange={(e) => setHasKuruCarpani(e.target.value)}
                          onKeyDown={(e) => handleFieldKeyDown(e, undefined, sabitleRef)}
                          className="font-monospace"
                        />
                      </Col>
                    </Form.Group>
                    <div className="small text-muted p-2 rounded bg-white border">
                      <div>
                        Anlık HAS Kuru: <strong>{anlikHasKuru ? `${anlikHasKuru} TL` : "Yüklenemedi"}</strong>
                      </div>
                      <div className="fw-bold text-primary mt-1">
                        Hesaplanan TL Fiyat: {hesaplananTlFiyat.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} TL
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      <LookupModal<OzelUrunItem>
        show={showLookup}
        title="Fiyat & Ayar Etiketi Seçiniz (F3)"
        columns={lookupColumns}
        items={urunList}
        filterFn={(it, term) => {
          const t = term.toLowerCase();
          return (
            (it.barkod ? it.barkod.toLowerCase().includes(t) : false) ||
            (it.mamulTipi ? it.mamulTipi.toLowerCase().includes(t) : false) ||
            (it.tasCinsi ? it.tasCinsi.toLowerCase().includes(t) : false) ||
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
          setShowFirmaLookup(false);
        }}
        onHide={() => setShowFirmaLookup(false)}
      />

      <EtiketYazdirModal
        show={showPrintModal}
        onHide={() => setShowPrintModal(false)}
        title="Fiyat & Ayar Etiketi Yazdır"
        sablon={varsayilanSablon}
        items={printItem}
        yazicilar={yazicilar}
        onAfterPrint={async () => {
          if (ozelUrunId) {
            await EtiketService.markOzelUrunYazdirildi([ozelUrunId], true);
            const updated = await EtiketService.getOzelUrunler({ limit: 500 });
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

export default FiyatAyarEtiketleriPage;
