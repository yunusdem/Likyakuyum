import React, { useState, useEffect, useMemo } from "react";
import {
  Modal,
  Row,
  Col,
  Form,
  Button,
  Table,
  Badge,
  Alert,
  Spinner,
  InputGroup,
  Card,
} from "react-bootstrap";
import {
  IconArrowsExchange,
  IconRefresh,
  IconCheck,
  IconAlertCircle,
  IconBinoculars,
  IconCalendar,
  IconListCheck,
  IconUserCheck,
  IconX,
} from "@tabler/icons-react";
import {
  DovizFisService,
  DovizFisAktarmaItem,
  DovizFisAktarmaOnizlemeResult,
  DovizFisAktarmaCalistirResult,
} from "../../services/dovizFisService";
import { CompanyService } from "../../services/companyService";
import { StatisticService, StatisticItem } from "../../services/statisticService";
import { CariService } from "../../services/cariService";
import { KasaService } from "../../services/kasaService";
import LookupModal from "../../components/common/LookupModal";
import { useToast } from "../../context/ToastContext";

interface FisAktarmaModalProps {
  show: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const FisAktarmaModal: React.FC<FisAktarmaModalProps> = ({
  show,
  onClose,
  onSuccess,
}) => {
  const { showSuccess, showError } = useToast();
  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);

  const [ilkTarih, setIlkTarih] = useState<string>(todayStr);
  const [sonTarih, setSonTarih] = useState<string>(todayStr);
  const [dizaynKodu, setDizaynKodu] = useState<string>("");

  // Kaynak Hesap (Hangi hesaptan aktarılacak - ERP'de resmi/gayriresmi hesap seçimi)
  const [kaynakHesapId, setKaynakHesapId] = useState<number | null>(null);
  const [kaynakHesapUnvan, setKaynakHesapUnvan] = useState<string>("");

  // Hedef Hesap & Veritabanı (Arka planda firma tanımlarından gelir, UI'da sadece Hedef Hesap görünür)
  const [hedefVeritabani, setHedefVeritabani] = useState<string>("");
  const [hedefHesapId, setHedefHesapId] = useState<number | null>(null);
  const [hedefHesapUnvan, setHedefHesapUnvan] = useState<string>("");

  const [previewResult, setPreviewResult] = useState<DovizFisAktarmaOnizlemeResult | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const [loadingPreview, setLoadingPreview] = useState<boolean>(false);
  const [loadingAktar, setLoadingAktar] = useState<boolean>(false);
  const [aktarResult, setAktarResult] = useState<DovizFisAktarmaCalistirResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statsList, setStatsList] = useState<StatisticItem[]>([]);

  // Lookup modal for selecting counterparty / account
  const [lookupConfig, setLookupConfig] = useState<{
    show: boolean;
    title: string;
    items: any[];
    selectedId?: any;
    columns: any[];
    filterFn: (it: any, term: string) => boolean;
    onSelect: (it: any) => void;
  }>({
    show: false,
    title: "",
    items: [],
    columns: [],
    filterFn: () => true,
    onSelect: () => {},
  });

  // Güvenli fiş listesi helper
  const fislerList: DovizFisAktarmaItem[] = useMemo(() => {
    if (!previewResult) return [];
    if (Array.isArray(previewResult.fisler)) return previewResult.fisler;
    if (Array.isArray((previewResult as any).kaynakFisler)) return (previewResult as any).kaynakFisler;
    return [];
  }, [previewResult]);

  // Güvenli özet bilgisi
  const ozetInfo = useMemo(() => {
    if (previewResult?.ozet) return previewResult.ozet;
    const toplamFisSayisi = fislerList.length;
    const yeniEklenecekSayisi = fislerList.filter((f) => f.hedefDurumu === "YENI").length;
    const guncellenecekSayisi = fislerList.filter((f) => f.hedefDurumu === "GUNCELLEME").length;
    const zatenAktarilmisSayisi = fislerList.filter((f) => f.dahaOnceAktarildi).length;
    const toplamTutarTl = fislerList.reduce(
      (acc, f) => acc + (Number(f.tutar) || Number((f as any).toplamTutar) || 0),
      0
    );
    return {
      toplamFisSayisi,
      yeniEklenecekSayisi,
      guncellenecekSayisi,
      zatenAktarilmisSayisi,
      toplamTutarTl,
    };
  }, [previewResult, fislerList]);

  // Load defaults when modal opens
  useEffect(() => {
    if (show) {
      setErrorMsg(null);
      setAktarResult(null);
      setSelectedIds(new Set());
      loadCompanyDefaults();
      StatisticService.getStatistics()
        .then((res) => setStatsList(res || []))
        .catch(() => {});
    }
  }, [show]);

  const loadCompanyDefaults = async () => {
    try {
      const def = await CompanyService.getDefinitions();
      if (def) {
        if (def.DIGER_VERITABANI_ADI) {
          setHedefVeritabani(def.DIGER_VERITABANI_ADI);
        }
        if (def.FIS_AKTARILACAK_HESAP_ID) {
          setHedefHesapId(def.FIS_AKTARILACAK_HESAP_ID);
        }
        if (def.FIS_AKTARMA_HESABI) {
          setHedefHesapUnvan(def.FIS_AKTARMA_HESABI);
        }
      }
    } catch (err) {
      console.error("Firma tanımları okunamadı:", err);
    }
  };

  const handleFetchPreview = async () => {
    if (!ilkTarih || !sonTarih) {
      setErrorMsg("Lütfen ilk tarih ve işlem tarihini seçiniz.");
      return;
    }
    setErrorMsg(null);
    setAktarResult(null);
    setLoadingPreview(true);
    try {
      const res = await DovizFisService.getAktarmaOnizleme({
        ilkTarih,
        sonTarih,
        dizaynKodu: dizaynKodu || undefined,
        hedefVeritabani: hedefVeritabani.trim() || undefined,
        kaynakHesapId: kaynakHesapId ?? undefined,
        kaynakHesapUnvan: kaynakHesapUnvan.trim() || undefined,
      });

      setPreviewResult(res);
      // Kullanıcı talebi: İlk filtrelendiğinde/açıldığında tümü seçili gelmeyecek, tümü seçili olmadan gelecek
      setSelectedIds(new Set());

      // Hedef hesap tanımı henüz yoksa arka plandan gelenle güncelle
      if (res?.hedefHesap && (!hedefHesapId || !hedefHesapUnvan)) {
        setHedefHesapId(res.hedefHesap.id);
        setHedefHesapUnvan(res.hedefHesap.unvan);
      }
      if (res?.hedefVeritabani && !hedefVeritabani) {
        setHedefVeritabani(res.hedefVeritabani);
      }
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || err.message || "Fişler listelenirken hata oluştu.");
    } finally {
      setLoadingPreview(false);
    }
  };

  // Aktarılabilir fişler: Zaten aktarılmış olanlar hariç
  const aktarilabilirFisler = useMemo(
    () => fislerList.filter((f) => !f.dahaOnceAktarildi),
    [fislerList]
  );

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      // Yalnızca henüz aktarılmamış fişleri seç
      setSelectedIds(new Set(aktarilabilirFisler.map((f) => f.fisId)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleToggleSelect = (fisId: number) => {
    const targetFis = fislerList.find((f) => f.fisId === fisId);
    if (targetFis?.dahaOnceAktarildi) {
      return; // Zaten aktarılmış fiş seçilemez
    }
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(fisId)) {
        next.delete(fisId);
      } else {
        next.add(fisId);
      }
      return next;
    });
  };

  // Hesap / Cari Seçimi (Kaynak veya Hedef için)
  const handleOpenAccountLookup = async (targetType: "kaynak" | "hedef") => {
    try {
      const [hesaplar, cariler] = await Promise.all([
        KasaService.getHesaplar().catch(() => []),
        CariService.getCariKartlar().catch(() => []),
      ]);

      const items = [
        ...hesaplar.map((h) => ({
          id: h.hesapId,
          kod: h.kod,
          unvan: h.ad,
          tur: "Hesap Kartı",
        })),
        ...cariler.map((c) => ({
          id: c.id,
          kod: c.kod,
          unvan: c.ad,
          tur: "Cari Kart",
        })),
      ];

      setLookupConfig({
        show: true,
        title:
          targetType === "kaynak"
            ? "Aktarılacak Kaynak Hesap / Cari Seçimi"
            : "Fiş Aktarılacak Hedef Hesap / Cari Seçimi",
        items,
        selectedId: targetType === "kaynak" ? kaynakHesapId : hedefHesapId,
        columns: [
          {
            header: "Tür",
            render: (it: any) => (
              <Badge bg={it.tur === "Cari Kart" ? "info" : "primary"}>
                {it.tur}
              </Badge>
            ),
            width: "110px",
          },
          {
            header: "Kod",
            render: (it: any) => <span className="font-monospace fw-bold">{it.kod}</span>,
            width: "120px",
          },
          {
            header: "Hesap / Ünvan",
            render: (it: any) => <span className="fw-medium">{it.unvan}</span>,
          },
        ],
        filterFn: (it: any, term: string) => {
          const t = term.toLowerCase();
          return (
            (it.kod && it.kod.toLowerCase().includes(t)) ||
            (it.unvan && it.unvan.toLowerCase().includes(t)) ||
            (it.tur && it.tur.toLowerCase().includes(t))
          );
        },
        onSelect: (it: any) => {
          if (targetType === "kaynak") {
            setKaynakHesapId(it.id);
            setKaynakHesapUnvan(it.unvan || it.kod);
          } else {
            setHedefHesapId(it.id);
            setHedefHesapUnvan(it.unvan || it.kod);
          }
          setLookupConfig((prev) => ({ ...prev, show: false }));
        },
      });
    } catch (err) {
      console.error("Hesap lookup açılamadı:", err);
    }
  };

  const handleCalistirAktarma = async () => {
    if (selectedIds.size === 0) {
      setErrorMsg("Lütfen aktarılacak en az bir fiş seçiniz.");
      return;
    }

    if (
      !window.confirm(
        `${selectedIds.size} adet fiş seçilen hedef hesaba aktarılacaktır. Devam etmek istiyor musunuz?`
      )
    ) {
      return;
    }

    setErrorMsg(null);
    setAktarResult(null);
    setLoadingAktar(true);

    try {
      const res = await DovizFisService.calistirAktarma({
        fisIdler: Array.from(selectedIds),
        ilkTarih,
        sonTarih,
        dizaynKodu: dizaynKodu || undefined,
        hedefVeritabani: hedefVeritabani.trim() || undefined,
        hedefHesapId: hedefHesapId ?? undefined,
        hedefHesapUnvan: hedefHesapUnvan.trim() || undefined,
        kaynakHesapId: kaynakHesapId ?? undefined,
        kaynakHesapUnvan: kaynakHesapUnvan.trim() || undefined,
      });

      if (res.hatalar && res.hatalar.length > 0) {
        // Hata var: Modal kapanmaz, hatanın ne olduğu ekranda ve modalda yazar
        const detay = res.hatalar.map((h) => `Fiş #${h.fisId}: ${h.hata}`).join("\n");
        const errMsg = `${res.hatalar.length} adet fiş aktarılamadı:\n${detay}`;
        setErrorMsg(errMsg);
        showError(errMsg, 6000);
        setAktarResult(res);
        await handleFetchPreview();
      } else {
        // Başarılı: Sayfa ortasında aktarıldı bildirimi gelsin ve modal kapansın!
        const basariMesaji =
          res.message ||
          `✅ ${res.aktarilanSayisi || selectedIds.size} adet döviz fişi başarıyla diğer alana aktarıldı.`;
        showSuccess(basariMesaji, 3500);
        if (onSuccess) {
          onSuccess();
        }
        onClose();
      }
    } catch (err: any) {
      // Hata çıkarsa: Modal kapanmaz, hatanın ne olduğu açıkça yazar
      const errMsg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        "Aktarım işlemi sırasında bir hata oluştu.";
      setErrorMsg(errMsg);
      showError(`⚠️ Aktarım Hatası: ${errMsg}`, 6000);
    } finally {
      setLoadingAktar(false);
    }
  };

  const allSelected =
    aktarilabilirFisler.length > 0 &&
    aktarilabilirFisler.every((f) => selectedIds.has(f.fisId));

  return (
    <>
      <Modal
        show={show}
        onHide={onClose}
        size="xl"
        centered
        backdrop="static"
        keyboard={!loadingAktar}
        dialogClassName="fis-aktarma-modal"
      >
        <Modal.Header closeButton={!loadingAktar} className="bg-light py-2 px-3 border-bottom">
          <Modal.Title className="fs-6 fw-bold d-flex align-items-center gap-2 text-primary">
            <IconArrowsExchange size={20} />
            Döviz Fişi Aktarma (Resmi / Gayriresmi Alanlar Arası Transfer)
          </Modal.Title>
        </Modal.Header>

        <Modal.Body className="p-3 bg-light-subtle">
          {/* 1. Filtre & Hesap Ayarları Kartı */}
          <Card className="border shadow-none mb-3">
            <Card.Body className="p-3">
              <Row className="g-2 align-items-end">
                <Col xs={12} sm={6} md={2}>
                  <Form.Group>
                    <Form.Label className="small fw-semibold text-secondary mb-1">
                      İlk Tarih
                    </Form.Label>
                    <InputGroup size="sm">
                      <Form.Control
                        type="date"
                        value={ilkTarih}
                        onChange={(e) => setIlkTarih(e.target.value)}
                        className="bg-white border font-monospace"
                      />
                    </InputGroup>
                  </Form.Group>
                </Col>

                <Col xs={12} sm={6} md={2}>
                  <Form.Group>
                    <Form.Label className="small fw-semibold text-secondary mb-1">
                      İşlem Tarihi (Son)
                    </Form.Label>
                    <InputGroup size="sm">
                      <Form.Control
                        type="date"
                        value={sonTarih}
                        onChange={(e) => setSonTarih(e.target.value)}
                        className="bg-white border font-monospace"
                      />
                    </InputGroup>
                  </Form.Group>
                </Col>

                <Col xs={12} sm={6} md={2}>
                  <Form.Group>
                    <Form.Label className="small fw-semibold text-secondary mb-1">
                      Dizayn Kodu
                    </Form.Label>
                    <Form.Select
                      size="sm"
                      value={dizaynKodu}
                      onChange={(e) => setDizaynKodu(e.target.value)}
                      className="bg-white border"
                    >
                      <option value="">Tümü (Tüm Dizaynlar)</option>
                      <option value="0">Dizayn 0 (Standart)</option>
                      <option value="1">Dizayn 1</option>
                      <option value="2">Dizayn 2</option>
                      <option value="3">Dizayn 3</option>
                      <option value="4">Dizayn 4</option>
                      <option value="5">Dizayn 5</option>
                      {statsList
                        .filter((s) => s.fisDizaynTipi !== undefined && s.fisDizaynTipi !== null)
                        .map((s) => (
                          <option key={`stat-${s.id}`} value={String(s.fisDizaynTipi)}>
                            {`Dizayn ${s.fisDizaynTipi} (${s.kod}${s.aciklama ? ` - ${s.aciklama}` : ""})`}
                          </option>
                        ))}
                    </Form.Select>
                  </Form.Group>
                </Col>

                {/* Kaynak Hesap (Hangi hesaptan aktarılacak) */}
                <Col xs={12} sm={6} md={2}>
                  <Form.Group>
                    <Form.Label className="small fw-semibold text-secondary mb-1 d-flex justify-content-between">
                      <span>Kaynak Hesap</span>
                      {kaynakHesapId && (
                        <span
                          className="text-danger fw-normal"
                          style={{ cursor: "pointer", fontSize: "11px" }}
                          onClick={() => {
                            setKaynakHesapId(null);
                            setKaynakHesapUnvan("");
                          }}
                        >
                          Temizle
                        </span>
                      )}
                    </Form.Label>
                    <InputGroup size="sm">
                      <Form.Control
                        type="text"
                        readOnly
                        placeholder="Tümü (Tüm Hesaplar)"
                        value={kaynakHesapUnvan || "Tümü (Tüm Hesaplar)"}
                        className={`bg-white border text-truncate ${kaynakHesapId ? "text-primary fw-medium" : "text-muted"}`}
                        title={kaynakHesapUnvan || "Tüm hesaplar aktarılır"}
                      />
                      {kaynakHesapId && (
                        <Button
                          variant="outline-secondary"
                          onClick={() => {
                            setKaynakHesapId(null);
                            setKaynakHesapUnvan("");
                          }}
                          title="Filtreyi Temizle"
                        >
                          <IconX size={14} />
                        </Button>
                      )}
                      <Button
                        variant="outline-secondary"
                        onClick={() => handleOpenAccountLookup("kaynak")}
                        title="Kaynak Hesap Seç (Resmi / Gayriresmi)"
                      >
                        <IconBinoculars size={15} />
                      </Button>
                    </InputGroup>
                  </Form.Group>
                </Col>

                {/* Hedef Hesap (Fiş Aktarma Hesabı) */}
                <Col xs={12} sm={6} md={2}>
                  <Form.Group>
                    <Form.Label className="small fw-semibold text-secondary mb-1">
                      Hedef Hesap
                    </Form.Label>
                    <InputGroup size="sm">
                      <Form.Control
                        type="text"
                        readOnly
                        placeholder="Hedef Hesap Seçiniz"
                        value={hedefHesapUnvan || (hedefHesapId ? `ID: ${hedefHesapId}` : "")}
                        className="bg-white border text-truncate text-success fw-medium"
                        title={hedefHesapUnvan || "Firma tanımlarından gelen fiş aktarma hesabı"}
                      />
                      <Button
                        variant="outline-secondary"
                        onClick={() => handleOpenAccountLookup("hedef")}
                        title="Hedef Fiş Aktarma Hesabı Seç"
                      >
                        <IconBinoculars size={15} />
                      </Button>
                    </InputGroup>
                  </Form.Group>
                </Col>

                {/* Fişleri Listele Butonu */}
                <Col xs={12} sm={6} md={2}>
                  <Button
                    variant="primary"
                    size="sm"
                    className="w-100 d-flex align-items-center justify-content-center gap-1.5 fw-semibold"
                    onClick={handleFetchPreview}
                    disabled={loadingPreview || loadingAktar}
                  >
                    {loadingPreview ? (
                      <>
                        <Spinner animation="border" size="sm" />
                        <span>Yükleniyor...</span>
                      </>
                    ) : (
                      <>
                        <IconRefresh size={16} />
                        <span>Fişleri Listele</span>
                      </>
                    )}
                  </Button>
                </Col>
              </Row>
            </Card.Body>
          </Card>

          {/* Hata Bildirimi */}
          {errorMsg && (
            <Alert variant="danger" dismissible onClose={() => setErrorMsg(null)} className="py-2 px-3 small">
              <div className="d-flex align-items-center gap-2">
                <IconAlertCircle size={20} className="flex-shrink-0 text-danger" />
                <div style={{ whiteSpace: "pre-line" }}>
                  <strong>Hata:</strong> {errorMsg}
                </div>
              </div>
            </Alert>
          )}

          {/* Aktarım Sonuç Bildirimi */}
          {aktarResult && (
            <Alert
              variant={aktarResult.hatalar?.length ? "warning" : "success"}
              dismissible
              onClose={() => setAktarResult(null)}
              className="py-2 px-3 mb-3 small"
            >
              <div className="d-flex align-items-center gap-2">
                <IconCheck size={18} className="text-success flex-shrink-0" />
                <div>
                  <strong>Aktarım Tamamlandı:</strong> {aktarResult.aktarilanSayisi} fiş başarıyla aktarıldı. (
                  {aktarResult.yeniEklenenSayisi} Yeni Kayıt, {aktarResult.guncellenenSayisi} Güncellenen).
                  {aktarResult.hatalar?.length > 0 && (
                    <div className="mt-1 text-danger">
                      {aktarResult.hatalar.length} adet fiş aktarılırken hata oluştu:
                      <ul className="mb-0 ps-3">
                        {aktarResult.hatalar.map((h, i) => (
                          <li key={i}>
                            Fiş #{h.fisId}: {h.hata}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </Alert>
          )}

          {/* 2. Özet Bilgi Çipleri */}
          {previewResult && (
            <div className="d-flex flex-wrap gap-2 mb-2 p-2 bg-white rounded border align-items-center justify-content-between">
              <div className="d-flex flex-wrap gap-2 align-items-center">
                <Badge bg="secondary" className="px-2 py-1.5 fw-normal">
                  Toplam Fiş: <strong>{ozetInfo.toplamFisSayisi ?? 0}</strong>
                </Badge>
                <Badge bg="success" className="px-2 py-1.5 fw-normal">
                  Yeni Eklenecek: <strong>{ozetInfo.yeniEklenecekSayisi ?? 0}</strong>
                </Badge>
                <Badge bg="warning" text="dark" className="px-2 py-1.5 fw-normal">
                  Güncellenecek: <strong>{ozetInfo.guncellenecekSayisi ?? 0}</strong>
                </Badge>
                <Badge bg="info" className="px-2 py-1.5 fw-normal">
                  Zaten Aktarılmış: <strong>{ozetInfo.zatenAktarilmisSayisi ?? 0}</strong>
                </Badge>
                <Badge bg="light" text="dark" className="px-2 py-1.5 border font-monospace">
                  Toplam Tutar:{" "}
                  <strong>
                    {(ozetInfo.toplamTutarTl ?? 0).toLocaleString("tr-TR", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}{" "}
                    TL
                  </strong>
                </Badge>
              </div>

              <div className="small text-secondary font-monospace">
                Seçili: <strong>{selectedIds.size}</strong> / {aktarilabilirFisler.length} aktarılabilir
                {ozetInfo.zatenAktarilmisSayisi > 0 && (
                  <span className="ms-2 text-muted fw-semibold">
                    ({ozetInfo.zatenAktarilmisSayisi} zaten aktarılmış)
                  </span>
                )}
              </div>
            </div>
          )}

          {/* 3. Fiş Listesi Tablosu */}
          <div
            className="table-responsive bg-white rounded border"
            style={{ maxHeight: "420px", overflowY: "auto" }}
          >
            <Table hover size="sm" className="mb-0 align-middle text-nowrap" style={{ fontSize: "12.5px" }}>
              <thead className="table-light sticky-top" style={{ zIndex: 1 }}>
                <tr>
                  <th style={{ width: "36px" }} className="text-center">
                    <Form.Check
                      type="checkbox"
                      checked={allSelected}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      title={aktarilabilirFisler.length === 0 ? "Aktarılabilir fiş bulunmuyor" : "Aktarılabilir Fişlerin Tümünü Seç / Kaldır"}
                      disabled={aktarilabilirFisler.length === 0}
                    />
                  </th>
                  <th style={{ width: "65px" }}>Fiş ID</th>
                  <th style={{ width: "120px" }}>Seri / Belge</th>
                  <th style={{ width: "95px" }}>Tarih</th>
                  <th style={{ width: "70px" }}>Tip</th>
                  <th style={{ width: "80px" }}>Dizayn</th>
                  <th>Cari / Müşteri Ünvanı</th>
                  <th style={{ width: "110px" }} className="text-end">
                    Tutar (TL)
                  </th>
                  <th style={{ width: "170px" }} className="text-center">
                    Hedef Durumu
                  </th>
                </tr>
              </thead>
              <tbody>
                {fislerList.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-4 text-muted">
                      {loadingPreview
                        ? "Fişler listeleniyor..."
                        : "Kriterlere uygun fiş bulunamadı. Lütfen tarih ve hesap filtresini seçip 'Fişleri Listele' butonuna basınız."}
                    </td>
                  </tr>
                ) : (
                  fislerList.map((fis) => {
                    const isSelected = selectedIds.has(fis.fisId);
                    const isAktarilmis = Boolean(fis.dahaOnceAktarildi);
                    const tutarVal = Number(fis.tutar) || Number((fis as any).toplamTutar) || 0;
                    return (
                      <tr
                        key={fis.fisId}
                        className={isAktarilmis ? "text-muted" : isSelected ? "table-active" : ""}
                        style={{
                          backgroundColor: isAktarilmis ? "#f1f5f9" : isSelected ? "#e0f2fe" : "transparent",
                          color: isAktarilmis ? "#64748b" : "inherit",
                          cursor: isAktarilmis ? "not-allowed" : "pointer",
                          userSelect: "none",
                        }}
                        onClick={() => {
                          if (!isAktarilmis) handleToggleSelect(fis.fisId);
                        }}
                        title={isAktarilmis ? "Bu fiş daha önce aktarılmıştır, tekrar seçilemez." : undefined}
                      >
                        <td className="text-center" onClick={(e) => e.stopPropagation()}>
                          <Form.Check
                            type="checkbox"
                            checked={isSelected}
                            disabled={isAktarilmis}
                            onChange={() => {
                              if (!isAktarilmis) handleToggleSelect(fis.fisId);
                            }}
                          />
                        </td>
                        <td className="font-monospace text-secondary">{fis.fisId}</td>
                        <td className={`font-monospace ${isAktarilmis ? "text-muted" : "fw-semibold"}`}>
                          {fis.seriNo} - {fis.belgeNo}
                        </td>
                        <td className="font-monospace text-secondary">
                          {fis.tarih ? String(fis.tarih).slice(0, 10) : "—"}
                        </td>
                        <td>
                          <Badge bg={isAktarilmis ? "secondary" : fis.tip === 1 ? "primary" : "success"} className="fw-normal">
                            {fis.tipLabel || (fis.tip === 1 ? "Satış" : "Alış")}
                          </Badge>
                        </td>
                        <td className="font-monospace">
                          {fis.dizaynKodu !== undefined && fis.dizaynKodu !== null ? (
                            <Badge bg="light" text="dark" className="border">
                              Dizayn {fis.dizaynKodu}
                            </Badge>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="text-truncate" style={{ maxWidth: "220px" }} title={fis.unvan}>
                          {fis.unvan || "—"}
                        </td>
                        <td className="font-monospace text-end fw-semibold">
                          {tutarVal.toLocaleString("tr-TR", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                        <td className="text-center">
                          {isAktarilmis ? (
                            <Badge bg="secondary" className="px-2 py-1 fw-semibold d-inline-flex align-items-center gap-1 shadow-xs">
                              <IconCheck size={13} />
                              Zaten Aktarılmış
                            </Badge>
                          ) : fis.hedefDurumu === "GUNCELLEME" ? (
                            <Badge bg="warning" text="dark" className="fw-normal">
                              Mevcut Kayıt Güncellenecek
                            </Badge>
                          ) : (
                            <Badge bg="success" className="fw-normal">
                              Yeni Kayıt Eklenecek
                            </Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </Table>
          </div>
        </Modal.Body>

        <Modal.Footer className="bg-light py-2 px-3 border-top d-flex justify-content-between">
          <div className="small text-secondary">
            {selectedIds.size > 0 && (
              <span>
                <strong>{selectedIds.size}</strong> adet fiş aktarılmak üzere seçildi.
              </span>
            )}
          </div>
          <div className="d-flex align-items-center gap-2">
            <Button variant="secondary" size="sm" onClick={onClose} disabled={loadingAktar}>
              Kapat
            </Button>
            <Button
              variant="success"
              size="sm"
              className="d-flex align-items-center gap-1.5 fw-semibold shadow-sm px-3"
              onClick={handleCalistirAktarma}
              disabled={loadingAktar || selectedIds.size === 0}
            >
              {loadingAktar ? (
                <>
                  <Spinner animation="border" size="sm" />
                  <span>Aktarılıyor...</span>
                </>
              ) : (
                <>
                  <IconArrowsExchange size={17} />
                  <span>Seçili Fişleri Aktar ({selectedIds.size})</span>
                </>
              )}
            </Button>
          </div>
        </Modal.Footer>
      </Modal>

      {/* Dürbün Hesap / Cari Seçim Modalı */}
      <LookupModal
        show={lookupConfig.show}
        onHide={() => setLookupConfig((prev) => ({ ...prev, show: false }))}
        title={lookupConfig.title}
        items={lookupConfig.items}
        selectedId={lookupConfig.selectedId}
        columns={lookupConfig.columns}
        filterFn={lookupConfig.filterFn}
        onSelect={lookupConfig.onSelect}
      />
    </>
  );
};

export default FisAktarmaModal;
