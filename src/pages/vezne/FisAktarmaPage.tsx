import React, { useState, useEffect, useMemo } from "react";
import {
  Card,
  Row,
  Col,
  Form,
  Button,
  Badge,
  Spinner,
  Alert,
} from "react-bootstrap";
import {
  IconCheck,
  IconArrowsExchange,
  IconDatabase,
  IconCalendar,
  IconFileSpreadsheet,
  IconAlertTriangle,
  IconRefresh,
  IconListCheck,
} from "@tabler/icons-react";
import ERPToolbar from "../../components/common/ERPToolbar";
import {
  DovizFisService,
  DovizFisAktarmaCalistirResult,
  DovizFisAktarmaDetay,
} from "../../services/dovizFisService";
import { CompanyService, TodvzTanimDto } from "../../services/companyService";
import { useToast } from "../../context/ToastContext";
import FisAktarmaModal from "./FisAktarmaModal";

export const FisAktarmaPage: React.FC = () => {
  const { showSuccess, showError } = useToast();
  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);

  const [ilkTarih, setIlkTarih] = useState<string>(todayStr);
  const [sonTarih, setSonTarih] = useState<string>(todayStr);
  // Fiş Dizayn Tipi: 0, 1, 2, 3 (varsayılan: 0)
  const [dizaynKodu, setDizaynKodu] = useState<string>("0");

  const [companyDefinitions, setCompanyDefinitions] = useState<TodvzTanimDto | null>(null);
  const [isLoadingDefs, setIsLoadingDefs] = useState<boolean>(true);

  const [loading, setLoading] = useState<boolean>(false);
  const [showModal, setShowModal] = useState<boolean>(false);
  const [statusText, setStatusText] = useState<string>(
    "Aktarım için tarih aralığı ve fiş dizayn tipini belirleyip 'Aktar' veya 'Fişleri Listele' butonuna basınız. Açılan modalda fişleri inceleyebilir, istemediklerinizi tik işaretini kaldırarak hariç tutabilirsiniz."
  );
  const [statusType, setStatusType] = useState<"info" | "loading" | "success" | "warning" | "error">("info");

  const [aktarilanList, setAktarilanList] = useState<string[]>([]);
  const [hataList, setHataList] = useState<string[]>([]);
  const [sonucOzet, setSonucOzet] = useState<DovizFisAktarmaCalistirResult | null>(null);

  // Firma tanımlarını yükle (hedef veritabanı ve aktarma hesabı bilgileri)
  useEffect(() => {
    setIsLoadingDefs(true);
    CompanyService.getDefinitions()
      .then((defs) => {
        setCompanyDefinitions(defs);
      })
      .catch((err) => {
        console.error("Firma tanımları yüklenemedi:", err);
      })
      .finally(() => {
        setIsLoadingDefs(false);
      });
  }, []);

  const hedefVeritabani = useMemo(() => {
    return (companyDefinitions?.DIGER_VERITABANI_ADI || "").trim();
  }, [companyDefinitions]);

  // Modal Açılması (Kullanıcı fişleri inceleyip istemediklerinin tikini kaldırabilir)
  const handleOpenModal = () => {
    if (!ilkTarih || !sonTarih) {
      showError("Lütfen geçerli bir ilk ve son tarih aralığı seçiniz.");
      return;
    }

    if (ilkTarih > sonTarih) {
      showError("İlk tarih, son tarihten büyük olamaz.");
      return;
    }

    setShowModal(true);
  };

  // Modaldan Aktarma Başarılı Olduğunda Sayfadaki Logları ve Özeti Güncelle
  const handleAktarmaSuccess = (res?: DovizFisAktarmaCalistirResult) => {
    if (!res) return;
    setSonucOzet(res);

    const nowStr = new Date().toLocaleTimeString("tr-TR");
    const yeniEklenen = res.yeniEklenenSayisi ?? res.yeniKayit ?? 0;
    const guncellenen = res.guncellenenSayisi ?? res.guncellenen ?? 0;
    const toplamAktarilan = res.aktarilanSayisi ?? res.aktarilanToplam ?? (yeniEklenen + guncellenen);

    // Aktarılan fişler listesi oluştur
    const yeniAktarilanLoglar: string[] = [];
    if (res.aktarilanDetaylar && res.aktarilanDetaylar.length > 0) {
      res.aktarilanDetaylar.forEach((d: DovizFisAktarmaDetay) => {
        const durumEtiket = d.durum === "guncellendi" ? "[GÜNCELLENDİ]" : "[YENİ EKLENDİ]";
        const tipEtiket = d.tip === 1 ? "Satış" : "Alış";
        const belgeStr = [d.seriNo, d.belgeNo].filter(Boolean).join("-") || `ID:#${d.fisId}`;
        const unvanStr = d.unvan ? ` | Cari: ${d.unvan}` : "";
        yeniAktarilanLoglar.push(
          `[${nowStr}] ${durumEtiket} Fiş: ${belgeStr} (${tipEtiket})${unvanStr} - Tarih: ${d.tarih || ilkTarih}`
        );
      });
    } else if (toplamAktarilan > 0) {
      yeniAktarilanLoglar.push(
        `[${nowStr}] Toplam ${toplamAktarilan} adet fiş başarıyla aktarıldı (${yeniEklenen} yeni eklendi, ${guncellenen} güncellendi).`
      );
    } else {
      yeniAktarilanLoglar.push(
        `[${nowStr}] Belirtilen kriterlerde aktarılacak fiş bulunamadı.`
      );
    }

    setAktarilanList((prev) => [...yeniAktarilanLoglar, ...prev]);

    // Hatalar listesi
    if (res.hatalar && res.hatalar.length > 0) {
      const yeniHataLoglar = res.hatalar.map((h) => `[${nowStr}] Fiş ID #${h.fisId}: ${h.hata}`);
      setHataList((prev) => [...yeniHataLoglar, ...prev]);
    }

    if (toplamAktarilan > 0) {
      setStatusType("success");
      setStatusText(
        `✅ Aktarım başarıyla tamamlandı. Toplam ${toplamAktarilan} fiş işlendi (${yeniEklenen} yeni eklendi, ${guncellenen} güncellendi).`
      );
    } else {
      setStatusType("warning");
      setStatusText("Seçilen tarih ve kriterlere uygun aktarılacak fiş bulunamadı.");
    }
  };

  return (
    <div
      className="fis-aktarma-page w-100 pb-4"
      style={{
        fontFamily: "'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif",
        fontSize: "13px",
      }}
    >
      {/* Üst ERP Araç Çubuğu */}
      <ERPToolbar />

      <div className="container-fluid px-3 pt-2">
        {/* Hedef Veritabanı Bilgi Bandı (Üstte) */}
        {!isLoadingDefs && (
          <div className="d-flex flex-wrap align-items-center justify-content-between p-2.5 mb-3 bg-white border border-primary border-opacity-25 rounded-2 shadow-sm small">
            <div className="d-flex align-items-center gap-3">
              <span className="d-flex align-items-center gap-2 fw-bold text-dark fs-7">
                <IconDatabase size={18} className="text-primary" />
                Aktarılan DB:
                <Badge bg="primary" className="ms-1 px-3 py-1.5 font-monospace fs-7 shadow-xs">
                  {hedefVeritabani || "Firma Tanımlarındaki Kayıtlı DB"}
                </Badge>
              </span>
              <span className="text-muted" style={{ fontSize: "12px" }}>
                (Fiş Aktarma Alanı: Fişler doğrudan hedef veritabanına kopyalanır / aktarılır)
              </span>
            </div>
            {!hedefVeritabani && (
              <span className="text-muted" style={{ fontSize: "11.5px" }}>
                * Farklı bir veritabanına aktarmak için <strong>Firma Tanımları → Sistem → Diğer Veritabanı Adı</strong> alanını doldurabilirsiniz.
              </span>
            )}
          </div>
        )}

        {/* Ana Aktarma Paneli */}
        <Card className="border shadow-sm mb-3">
          <Card.Header className="bg-white border-bottom py-2.5 d-flex align-items-center justify-content-between">
            <div className="d-flex align-items-center gap-2">
              <IconArrowsExchange size={18} className="text-primary" />
              <span className="fw-bold text-dark">Fiş Aktarma Parametreleri</span>
            </div>
            <span className="text-muted small">
              Aynı fiş hedef veritabanında varsa güncellenir, yoksa yeni kayıt olarak eklenir.
            </span>
          </Card.Header>

          <Card.Body className="p-4">
            <div className="mx-auto" style={{ maxWidth: "560px" }}>
              {/* Aktarılan DB Bilgisi (Üstte) */}
              <div className="d-flex align-items-center justify-content-center gap-2 mb-3 p-2 bg-light rounded border">
                <Form.Label className="mb-0 fw-bold text-dark text-nowrap d-flex align-items-center gap-1.5">
                  <IconDatabase size={16} className="text-primary" />
                  Aktarılan DB:
                </Form.Label>
                <Badge bg="primary" className="px-3 py-1.5 font-monospace fs-7 shadow-xs">
                  {hedefVeritabani || "Firma Tanımlarındaki Kayıtlı DB"}
                </Badge>
                <span className="text-muted small ms-1">(Fiş Aktarma Alanı)</span>
              </div>

              {/* Tarih Alanları (İlk tarih & Son tarih) */}
              <Row className="g-3 mb-3 align-items-center justify-content-center">
                <Col xs={12} sm={6}>
                  <div className="d-flex align-items-center justify-content-end gap-2">
                    <Form.Label className="mb-0 fw-semibold text-nowrap text-secondary" style={{ minWidth: "70px" }}>
                      İlk tarih:
                    </Form.Label>
                    <Form.Control
                      type="date"
                      size="sm"
                      value={ilkTarih}
                      onChange={(e) => setIlkTarih(e.target.value)}
                      disabled={loading}
                      style={{ maxWidth: "160px" }}
                    />
                  </div>
                </Col>
                <Col xs={12} sm={6}>
                  <div className="d-flex align-items-center gap-2">
                    <Form.Label className="mb-0 fw-semibold text-nowrap text-secondary" style={{ minWidth: "70px" }}>
                      Son tarih:
                    </Form.Label>
                    <Form.Control
                      type="date"
                      size="sm"
                      value={sonTarih}
                      onChange={(e) => setSonTarih(e.target.value)}
                      disabled={loading}
                      style={{ maxWidth: "160px" }}
                    />
                  </div>
                </Col>
              </Row>

              {/* Fiş Dizayn Tipi (Fis dizayn tipi #0, 1, 2, 3) */}
              <div className="d-flex align-items-center justify-content-center gap-2 mb-3">
                <Form.Label className="mb-0 fw-semibold text-secondary text-nowrap">
                  Fis dizayn tipi:
                </Form.Label>
                <Form.Select
                  size="sm"
                  value={dizaynKodu}
                  onChange={(e) => setDizaynKodu(e.target.value)}
                  disabled={loading}
                  style={{ width: "90px", textAlign: "center", fontWeight: "bold" }}
                >
                  <option value="0">#0</option>
                  <option value="1">#1</option>
                  <option value="2">#2</option>
                  <option value="3">#3</option>
                  <option value="all">#Tümü</option>
                </Form.Select>
              </div>

              {/* Durum / İlerleme Çubuğu (Görseldeki Gri Alan) */}
              <div
                className="rounded-2 p-3 mb-3 d-flex align-items-center justify-content-center text-center shadow-inner"
                style={{
                  minHeight: "72px",
                  backgroundColor:
                    statusType === "error"
                      ? "#fee2e2"
                      : statusType === "success"
                      ? "#dcfce7"
                      : statusType === "warning"
                      ? "#fef3c7"
                      : "#64748b",
                  color: statusType === "info" ? "#ffffff" : statusType === "loading" ? "#ffffff" : "#0f172a",
                  transition: "all 0.25s ease",
                  border: "1px solid rgba(0,0,0,0.1)",
                }}
              >
                {loading ? (
                  <div className="d-flex align-items-center gap-2">
                    <Spinner animation="border" size="sm" variant="light" />
                    <span className="fw-semibold">{statusText}</span>
                  </div>
                ) : (
                  <span className="fw-semibold" style={{ fontSize: "13px" }}>
                    {statusText}
                  </span>
                )}
              </div>

              {/* Butonlar: Fişleri Listele ve Aktar */}
              <div className="d-flex justify-content-center align-items-center gap-3">
                <Button
                  variant="outline-primary"
                  className="d-inline-flex align-items-center justify-content-center gap-2 px-4 py-2 fw-semibold shadow-sm"
                  style={{ minWidth: "150px", fontSize: "14px" }}
                  onClick={handleOpenModal}
                  disabled={loading}
                >
                  <IconListCheck size={18} />
                  <span>Fişleri Listele</span>
                </Button>

                <Button
                  variant="success"
                  className="d-inline-flex align-items-center justify-content-center gap-2 px-5 py-2 fw-bold shadow-sm"
                  style={{
                    minWidth: "160px",
                    fontSize: "14px",
                    background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                    border: "none",
                  }}
                  onClick={handleOpenModal}
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Spinner animation="border" size="sm" />
                      <span>Aktarılıyor...</span>
                    </>
                  ) : (
                    <>
                      <IconCheck size={20} strokeWidth={3} />
                      <span>Aktar</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          </Card.Body>
        </Card>

        {/* Alt Bölüm: Aktarılan fişler ve Hata mesajları (Görseldeki İki Kutu) */}
        <Row className="g-3">
          {/* Sol Kutu: Aktarılan fişler */}
          <Col md={6}>
            <Card className="border shadow-sm h-100">
              <Card.Header className="bg-white border-bottom py-2 d-flex align-items-center justify-content-between">
                <div className="d-flex align-items-center gap-2">
                  <span className="fw-bold text-dark">Aktarılan fişler</span>
                  {aktarilanList.length > 0 && (
                    <Badge bg="success" pill>
                      {aktarilanList.length}
                    </Badge>
                  )}
                </div>
                {aktarilanList.length > 0 && (
                  <Button
                    variant="link"
                    size="sm"
                    className="p-0 text-decoration-none text-muted"
                    onClick={() => setAktarilanList([])}
                  >
                    Temizle
                  </Button>
                )}
              </Card.Header>
              <Card.Body className="p-2">
                <div
                  className="rounded-2 p-2 border font-monospace"
                  style={{
                    backgroundColor: "#f8fafc",
                    height: "320px",
                    overflowY: "auto",
                    fontSize: "12px",
                    lineHeight: "1.5",
                  }}
                >
                  {aktarilanList.length === 0 ? (
                    <div className="h-100 d-flex align-items-center justify-content-center text-muted">
                      <span>Aktarılan fişler burada listelenecektir.</span>
                    </div>
                  ) : (
                    aktarilanList.map((msg, idx) => (
                      <div
                        key={idx}
                        className="py-1 px-1 border-bottom border-light text-break"
                        style={{
                          color: msg.includes("[YENİ EKLENDİ]")
                            ? "#047857"
                            : msg.includes("[GÜNCELLENDİ]")
                            ? "#1d4ed8"
                            : "#334155",
                        }}
                      >
                        {msg}
                      </div>
                    ))
                  )}
                </div>
              </Card.Body>
            </Card>
          </Col>

          {/* Sağ Kutu: Hata mesajları */}
          <Col md={6}>
            <Card className="border shadow-sm h-100">
              <Card.Header className="bg-white border-bottom py-2 d-flex align-items-center justify-content-between">
                <div className="d-flex align-items-center gap-2">
                  <span className="fw-bold text-dark">Hata mesajları</span>
                  {hataList.length > 0 && (
                    <Badge bg="danger" pill>
                      {hataList.length}
                    </Badge>
                  )}
                </div>
                {hataList.length > 0 && (
                  <Button
                    variant="link"
                    size="sm"
                    className="p-0 text-decoration-none text-muted"
                    onClick={() => setHataList([])}
                  >
                    Temizle
                  </Button>
                )}
              </Card.Header>
              <Card.Body className="p-2">
                <div
                  className="rounded-2 p-2 border font-monospace"
                  style={{
                    backgroundColor: "#f8fafc",
                    height: "320px",
                    overflowY: "auto",
                    fontSize: "12px",
                    lineHeight: "1.5",
                  }}
                >
                  {hataList.length === 0 ? (
                    <div className="h-100 d-flex align-items-center justify-content-center text-muted">
                      <span>Hata mesajı bulunmamaktadır.</span>
                    </div>
                  ) : (
                    hataList.map((err, idx) => (
                      <div key={idx} className="py-1 px-1 border-bottom border-light text-danger text-break">
                        {err}
                      </div>
                    ))
                  )}
                </div>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </div>

      {/* Fiş Aktarma ve Önizleme Modalı */}
      <FisAktarmaModal
        show={showModal}
        onClose={() => setShowModal(false)}
        onSuccess={handleAktarmaSuccess}
        initialIlkTarih={ilkTarih}
        initialSonTarih={sonTarih}
        initialDizaynKodu={dizaynKodu}
        initialHedefVeritabani={hedefVeritabani}
        autoFetch={true}
      />
    </div>
  );
};

export default FisAktarmaPage;
