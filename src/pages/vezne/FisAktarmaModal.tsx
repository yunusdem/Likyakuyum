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
  IconDatabase,
} from "@tabler/icons-react";
import {
  DovizFisService,
  DovizFisAktarmaItem,
  DovizFisAktarmaOnizlemeResult,
  DovizFisAktarmaCalistirResult,
} from "../../services/dovizFisService";
import { CompanyService } from "../../services/companyService";
import { StatisticService, StatisticItem } from "../../services/statisticService";
import { useToast } from "../../context/ToastContext";

export interface FisAktarmaModalProps {
  show: boolean;
  onClose: () => void;
  onSuccess?: (result?: DovizFisAktarmaCalistirResult) => void;
  initialIlkTarih?: string;
  initialSonTarih?: string;
  initialDizaynKodu?: string;
  initialHedefVeritabani?: string;
  autoFetch?: boolean;
}

export const FisAktarmaModal: React.FC<FisAktarmaModalProps> = ({
  show,
  onClose,
  onSuccess,
  initialIlkTarih,
  initialSonTarih,
  initialDizaynKodu,
  initialHedefVeritabani,
  autoFetch = false,
}) => {
  const { showSuccess, showError } = useToast();
  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);

  const [ilkTarih, setIlkTarih] = useState<string>(todayStr);
  const [sonTarih, setSonTarih] = useState<string>(todayStr);
  const [dizaynKodu, setDizaynKodu] = useState<string>("");

  // Aktarılan DB (Firma tanımlarından gelir)
  const [hedefVeritabani, setHedefVeritabani] = useState<string>("");

  const [previewResult, setPreviewResult] = useState<DovizFisAktarmaOnizlemeResult | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const [loadingPreview, setLoadingPreview] = useState<boolean>(false);
  const [loadingAktar, setLoadingAktar] = useState<boolean>(false);
  const [aktarResult, setAktarResult] = useState<DovizFisAktarmaCalistirResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statsList, setStatsList] = useState<StatisticItem[]>([]);

  // Fiş listesi helper
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

  // Parametreli fiş önizleme getirme fonksiyonu
  const fetchPreviewWithParams = async (params: {
    startD: string;
    endD: string;
    dKodu?: string;
    hedefDb?: string;
  }) => {
    const { startD, endD, dKodu, hedefDb } = params;
    if (!startD || !endD) {
      setErrorMsg("Lütfen ilk tarih ve son tarihi seçiniz.");
      return;
    }
    setErrorMsg(null);
    setAktarResult(null);
    setLoadingPreview(true);
    try {
      const apiDizaynKodu = dKodu === "all" || dKodu === "" ? undefined : dKodu;
      const res = await DovizFisService.getAktarmaOnizleme({
        ilkTarih: startD,
        sonTarih: endD,
        dizaynKodu: apiDizaynKodu,
        hedefVeritabani: (hedefDb || "").trim() || undefined,
      });

      setPreviewResult(res);

      // Kullanıcı talebi: Tümü seçili gelecek varsayılan olarak; kullanıcı istediklerinin tikini kaldırabilecek.
      const allSlips = res.fisler || (res as any).kaynakFisler || [];
      setSelectedIds(new Set(allSlips.map((f: any) => f.fisId)));

      if (res?.hedefVeritabani && !hedefVeritabani) {
        setHedefVeritabani(res.hedefVeritabani);
      }
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || err.message || "Fişler listelenirken hata oluştu.");
    } finally {
      setLoadingPreview(false);
    }
  };

  // Load defaults when modal opens
  useEffect(() => {
    if (show) {
      setErrorMsg(null);
      setAktarResult(null);
      const startD = initialIlkTarih || todayStr;
      const endD = initialSonTarih || todayStr;
      const dKodu = initialDizaynKodu !== undefined ? initialDizaynKodu : "";

      setIlkTarih(startD);
      setSonTarih(endD);
      setDizaynKodu(dKodu);

      if (initialHedefVeritabani !== undefined) {
        setHedefVeritabani(initialHedefVeritabani);
      }

      loadCompanyDefaults();
      StatisticService.getStatistics()
        .then((res) => setStatsList(res || []))
        .catch(() => {});

      if (autoFetch) {
        fetchPreviewWithParams({
          startD,
          endD,
          dKodu,
          hedefDb: initialHedefVeritabani,
        });
      }
    }
  }, [show]);

  const loadCompanyDefaults = async () => {
    try {
      const def = await CompanyService.getDefinitions();
      if (def?.DIGER_VERITABANI_ADI) {
        setHedefVeritabani(def.DIGER_VERITABANI_ADI);
      }
    } catch (err) {
      console.error("Firma tanımları okunamadı:", err);
    }
  };

  const handleFetchPreview = async () => {
    await fetchPreviewWithParams({
      startD: ilkTarih,
      endD: sonTarih,
      dKodu: dizaynKodu,
      hedefDb: hedefVeritabani,
    });
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(fislerList.map((f) => f.fisId)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleToggleSelect = (fisId: number) => {
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

  const handleCalistirAktarma = async () => {
    if (selectedIds.size === 0) {
      setErrorMsg("Lütfen aktarılacak en az bir fiş seçiniz.");
      return;
    }

    if (
      !window.confirm(
        `${selectedIds.size} adet fiş hedef veritabanına (${hedefVeritabani || previewResult?.hedefVeritabani || "Kayıtlı DB"}) kopyalanacak/aktarılacaktır. Devam etmek istiyor musunuz?`
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
      });

      if (res.hatalar && res.hatalar.length > 0) {
        const detay = res.hatalar.map((h) => `Fiş #${h.fisId}: ${h.hata}`).join("\n");
        const errMsg = `${res.hatalar.length} adet fiş aktarılamadı:\n${detay}`;
        setErrorMsg(errMsg);
        showError(errMsg, 6000);
        setAktarResult(res);
        if (onSuccess) {
          onSuccess(res);
        }
        await handleFetchPreview();
      } else {
        const basariMesaji =
          res.message ||
          `✅ ${res.aktarilanSayisi || selectedIds.size} adet döviz fişi başarıyla diğer veritabanına aktarıldı.`;
        showSuccess(basariMesaji, 3500);
        if (onSuccess) {
          onSuccess(res);
        }
        onClose();
      }
    } catch (err: any) {
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
    fislerList.length > 0 && selectedIds.size === fislerList.length;

  return (
    <Modal
      show={show}
      onHide={onClose}
      size="xl"
      centered
      backdrop="static"
      keyboard={!loadingAktar}
      dialogClassName="fis-aktarma-modal"
    >
      <Modal.Header closeButton={!loadingAktar} className="bg-light py-2 px-3 border-bottom d-flex align-items-center justify-content-between">
        <Modal.Title className="fs-6 fw-bold d-flex align-items-center gap-2 text-primary">
          <IconArrowsExchange size={20} />
          <span>Fiş Aktarma Listesi (Veritabanına Kopyalama / Aktarma)</span>
        </Modal.Title>
        <div className="d-flex align-items-center gap-2 me-4">
          <span className="small text-secondary fw-bold">Aktarılan DB:</span>
          <Badge bg="primary" className="px-3 py-1.5 font-monospace fs-7 shadow-xs d-flex align-items-center gap-1.5">
            <IconDatabase size={15} />
            <span>{hedefVeritabani || previewResult?.hedefVeritabani || "Firma Tanımlarındaki Kayıtlı DB"}</span>
          </Badge>
        </div>
      </Modal.Header>

      <Modal.Body className="p-3 bg-light-subtle">
        {/* Aktarılan Veritabanı Bilgilendirme Bandı (Üstte) */}
        <div className="d-flex flex-wrap align-items-center justify-content-between p-2 mb-2.5 bg-primary bg-opacity-10 border border-primary border-opacity-25 rounded-2">
          <div className="d-flex align-items-center gap-2 small">
            <IconDatabase size={17} className="text-primary flex-shrink-0" />
            <span className="text-secondary fw-bold">Fiş Aktarma Alanı (Aktarılan DB):</span>
            <Badge bg="primary" className="font-monospace px-3 py-1 fs-7">
              {hedefVeritabani || previewResult?.hedefVeritabani || "Firma Tanımlarındaki Kayıtlı DB"}
            </Badge>
          </div>
          <span className="text-muted small" style={{ fontSize: "12px" }}>
            * Fişler seçilen kriterlere göre doğrudan hedef veritabanına kopyalanır / aktarılır.
          </span>
        </div>

        {/* 1. Filtre Kartı (Yalnızca Tarihler ve Fiş Dizayn Tipi) */}
        <Card className="border shadow-none mb-3">
          <Card.Body className="p-3">
            <Row className="g-2 align-items-end">
              <Col xs={12} sm={6} md={3}>
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

              <Col xs={12} sm={6} md={3}>
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

              <Col xs={12} sm={6} md={3}>
                <Form.Group>
                  <Form.Label className="small fw-semibold text-secondary mb-1">
                    Fiş Dizayn Tipi
                  </Form.Label>
                  <Form.Select
                    size="sm"
                    value={dizaynKodu}
                    onChange={(e) => setDizaynKodu(e.target.value)}
                    className="bg-white border"
                  >
                    <option value="">#Tümü (Tüm Dizaynlar)</option>
                    <option value="0">#0 (Standart)</option>
                    <option value="1">#1</option>
                    <option value="2">#2</option>
                    <option value="3">#3</option>
                    <option value="4">#4</option>
                    <option value="5">#5</option>
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

              <Col xs={12} sm={6} md={3}>
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
                {aktarResult.hatalar && aktarResult.hatalar.length > 0 && (
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
              <Badge bg="primary" className="px-2.5 py-1.5 fw-semibold font-monospace d-flex align-items-center gap-1 shadow-xs">
                <IconDatabase size={14} />
                <span>Aktarılan DB: <strong>{hedefVeritabani || previewResult?.hedefVeritabani || "Mevcut DB"}</strong></span>
              </Badge>
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
              Seçili: <strong>{selectedIds.size}</strong> / {fislerList.length} fiş
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
                    title={fislerList.length === 0 ? "Fiş bulunmuyor" : "Tüm Fişleri Seç / Kaldır"}
                    disabled={fislerList.length === 0}
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
                      : "Seçilen tarih aralığında ve kriterlerde fiş bulunamadı. Lütfen 'Fişleri Listele' butonuna basınız."}
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
                      className={isSelected ? "table-active" : ""}
                      style={{
                        backgroundColor: isSelected ? "#e0f2fe" : "transparent",
                        cursor: "pointer",
                        userSelect: "none",
                      }}
                      onClick={() => handleToggleSelect(fis.fisId)}
                    >
                      <td className="text-center" onClick={(e) => e.stopPropagation()}>
                        <Form.Check
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(fis.fisId)}
                        />
                      </td>
                      <td className="font-monospace text-secondary">{fis.fisId}</td>
                      <td className="font-monospace fw-semibold">
                        {[fis.seriNo, fis.belgeNo].filter(Boolean).join("-") || `ID:#${fis.fisId}`}
                      </td>
                      <td className="font-monospace">{fis.tarih}</td>
                      <td>
                        <Badge bg={fis.tip === 1 ? "danger" : "success"} className="fw-normal">
                          {fis.tip === 1 ? "Satış" : "Alış"}
                        </Badge>
                      </td>
                      <td className="font-monospace text-secondary">
                        {fis.dizaynKodu !== undefined ? `#${fis.dizaynKodu}` : "-"}
                      </td>
                      <td className="text-truncate" style={{ maxWidth: "250px" }} title={fis.unvan}>
                        {fis.unvan || <span className="text-muted fst-italic">İsim Beyan Edilmemiş</span>}
                      </td>
                      <td className="text-end font-monospace fw-semibold">
                        {tutarVal.toLocaleString("tr-TR", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td className="text-center">
                        {isAktarilmis ? (
                          <Badge bg="secondary" className="px-2 py-1 fw-semibold d-inline-flex align-items-center gap-1 shadow-xs">
                            <IconCheck size={13} />
                            Zaten Aktarılmış (Güncellenir)
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

      <Modal.Footer className="bg-light py-2 px-3 border-top d-flex justify-content-between align-items-center">
        <div className="small text-secondary d-flex flex-wrap align-items-center gap-3">
          {selectedIds.size > 0 && (
            <span>
              <strong>{selectedIds.size}</strong> adet fiş seçildi.
            </span>
          )}
          <span className="d-inline-flex align-items-center gap-1 font-monospace text-primary fw-bold">
            <IconDatabase size={15} />
            Aktarılan DB: <strong>{hedefVeritabani || previewResult?.hedefVeritabani || "Firma Tanımlarındaki DB"}</strong>
          </span>
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
  );
};

export default FisAktarmaModal;
