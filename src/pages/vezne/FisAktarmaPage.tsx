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
import { CompanyService, TodvzTanimDto, CompanyAlanDto } from "../../services/companyService";
import { AuthService } from "../../services/authService";
import { useToast } from "../../context/ToastContext";
import FisAktarmaModal from "./FisAktarmaModal";

export const FisAktarmaPage: React.FC = () => {
  const { showSuccess, showError } = useToast();
  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);

  const activeDb = useMemo(() => {
    return (AuthService.getActiveDb() || localStorage.getItem("kuyumcu_erp_active_db") || "").trim();
  }, []);

  const [ilkTarih, setIlkTarih] = useState<string>(todayStr);
  const [sonTarih, setSonTarih] = useState<string>(todayStr);
  // Fiş Dizayn Tipi: 0, 1, 2, 3 (varsayılan: 0)
  const [dizaynKodu, setDizaynKodu] = useState<string>("0");

  const [companyDefinitions, setCompanyDefinitions] = useState<TodvzTanimDto | null>(null);
  const [isLoadingDefs, setIsLoadingDefs] = useState<boolean>(true);
  const [dbAlanlari, setDbAlanlari] = useState<CompanyAlanDto[]>([]);
  const [hedefVeritabani, setHedefVeritabani] = useState<string>("");

  const [loading, setLoading] = useState<boolean>(false);
  const [showModal, setShowModal] = useState<boolean>(false);
  const [statusText, setStatusText] = useState<string>(
    "Aktarım için tarih aralığı ve fiş dizayn tipini belirleyip 'Aktar' veya 'Fişleri Listele' butonuna basınız. Açılan modalda fişleri inceleyebilir, istemediklerinizi tik işaretini kaldırarak hariç tutabilirsiniz."
  );
  const [statusType, setStatusType] = useState<"info" | "loading" | "success" | "warning" | "error">("info");

  const [aktarilanList, setAktarilanList] = useState<string[]>([]);
  const [hataList, setHataList] = useState<string[]>([]);
  const [sonucOzet, setSonucOzet] = useState<DovizFisAktarmaCalistirResult | null>(null);

  // Firma tanımlarını ve alan listesini yükle (hedef veritabanı ve aktarma bilgileri)
  useEffect(() => {
    setIsLoadingDefs(true);
    Promise.all([CompanyService.getDefinitions(), CompanyService.getAlanlar()])
      .then(([defs, alanlar]) => {
        setCompanyDefinitions(defs);
        setDbAlanlari(alanlar || []);

        const tanimDb = (defs?.DIGER_VERITABANI_ADI || "").trim();
        const validOtherDbs = (alanlar || []).filter(
          (a) => (a.dbName || "").trim().toLowerCase() !== (activeDb || "").toLowerCase()
        );
        // Hedef DB geçerli olması için:
        // 1) Boş olmamalı
        // 2) Kendi aktif DB'si ile aynı olmamalı (kendi alanını seçemez)
        // 3) Firmanın kayıtlı diğer alanları arasında bulunmalı
        const isValid =
          Boolean(tanimDb) &&
          Boolean(activeDb) &&
          tanimDb.toLowerCase() !== activeDb.toLowerCase() &&
          validOtherDbs.some((a) => (a.dbName || "").trim().toLowerCase() === tanimDb.toLowerCase());

        if (isValid) {
          setHedefVeritabani(tanimDb);
        } else {
          // Alan yoksa veya aktif alan seçilmişse boş kalmalıdır; kendi aktif DB'si pasiftir
          setHedefVeritabani("");
        }
      })
      .catch((err) => {
        console.error("Firma tanımları veya alanlar yüklenemedi:", err);
      })
      .finally(() => {
        setIsLoadingDefs(false);
      });
  }, [activeDb]);

  const isSelfTarget = useMemo(() => {
    return (
      Boolean(hedefVeritabani) &&
      Boolean(activeDb) &&
      hedefVeritabani.trim().toLowerCase() === activeDb.toLowerCase()
    );
  }, [hedefVeritabani, activeDb]);

  const hasOtherDb = useMemo(() => {
    return dbAlanlari.some(
      (a) => (a.dbName || "").trim().toLowerCase() !== activeDb.toLowerCase()
    );
  }, [dbAlanlari, activeDb]);

  const alanYok = useMemo(() => {
    if (!hedefVeritabani || isSelfTarget) return true;
    if (dbAlanlari.length === 0) return true;
    const existsInOther = dbAlanlari.some(
      (a) =>
        (a.dbName || "").trim().toLowerCase() === hedefVeritabani.trim().toLowerCase() &&
        (a.dbName || "").trim().toLowerCase() !== activeDb.toLowerCase()
    );
    return !existsInOther;
  }, [hedefVeritabani, isSelfTarget, dbAlanlari, activeDb]);

  // Modal Açılması (Kullanıcı fişleri inceleyip istemediklerinin tikini kaldırabilir)
  const handleOpenModal = () => {
    if (alanYok) {
      showError("Fiş aktarma alanı tanımlı olmadığı veya aktif alan olduğu için veritabanı aktarma çalışmaz.");
      return;
    }

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
            <div className="d-flex flex-wrap align-items-center gap-3">
              <span className="d-flex align-items-center gap-2 fw-bold text-dark fs-7">
                <IconDatabase size={18} className="text-secondary" />
                Aktif Alan (Kaynak):
                <Badge bg="secondary" className="ms-1 px-2.5 py-1 font-monospace fs-7 shadow-xs">
                  {activeDb || "Mevcut DB"}
                </Badge>
              </span>
              <span className="text-muted">➔</span>
              <span className="d-flex align-items-center gap-2 fw-bold text-dark fs-7">
                <IconDatabase size={18} className="text-primary" />
                Aktarılan DB (Hedef):
                <Badge bg={alanYok ? "danger" : "primary"} className="ms-1 px-3 py-1 font-monospace fs-7 shadow-xs">
                  {alanYok ? "Alan Yok (Aktarım Çalışmaz)" : hedefVeritabani}
                </Badge>
              </span>
              <span className="text-muted" style={{ fontSize: "12px" }}>
                (Fişler doğrudan hedef veritabanına kopyalanır / aktarılır)
              </span>
            </div>
            {alanYok && (
              <span className="text-danger fw-bold" style={{ fontSize: "12px" }}>
                ⚠️ Fiş aktarma alanı yok: Veritabanına aktarma işlemi çalışmaz!
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
              {/* Aktarılan DB Seçimi / Bilgisi (Üstte) */}
              <div className="mb-3 p-3 bg-light rounded border">
                <div className="d-flex align-items-center justify-content-between mb-2">
                  <span className="small text-muted d-flex align-items-center gap-1">
                    <IconDatabase size={14} className="text-secondary" />
                    Aktif Alan (Kaynak DB): <strong className="text-dark font-monospace">{activeDb || "Mevcut DB"}</strong>
                  </span>
                  <Badge bg="secondary" className="px-2 py-0.5" style={{ fontSize: "10px" }}>
                    Aktif Alan Pasiftir (Seçilemez)
                  </Badge>
                </div>

                <div className="d-flex align-items-center gap-2">
                  <Form.Label className="mb-0 fw-bold text-dark text-nowrap d-flex align-items-center gap-1.5" style={{ minWidth: "125px" }}>
                    <IconDatabase size={16} className="text-primary" />
                    Aktarılan DB:
                  </Form.Label>
                  <Form.Select
                    size="sm"
                    value={hedefVeritabani}
                    onChange={(e) => setHedefVeritabani(e.target.value)}
                    disabled={loading || dbAlanlari.length === 0}
                    className={`font-monospace fw-bold ${alanYok ? "border-danger text-danger bg-danger bg-opacity-10" : "text-primary"}`}
                  >
                    <option value="">-- Hedef Alan Seçiniz (Tanımlı Alan Yok) --</option>
                    {dbAlanlari.map((a) => {
                      const isOwn =
                        Boolean(a.isCurrentDb) ||
                        (Boolean(activeDb) && (a.dbName || "").trim().toLowerCase() === activeDb.toLowerCase());
                      return (
                        <option
                          key={a.dbName}
                          value={a.dbName}
                          disabled={isOwn}
                          style={isOwn ? { color: "#94a3b8", backgroundColor: "#f1f5f9" } : { fontWeight: "bold" }}
                        >
                          {a.dbName} {a.unvan ? `— ${a.unvan}` : ""} {isOwn ? "(Aktif Çalışılan Alan - Pasif / Seçilemez)" : "(Hedef Alan)"}
                        </option>
                      );
                    })}
                  </Form.Select>
                </div>

                {alanYok && (
                  <Alert variant="danger" className="py-2 px-3 mt-2 mb-0 small text-center fw-bold">
                    ⚠️ Fiş aktarma alanı belirlenmediği için veritabanı aktarma işlemi çalışmaz! Lütfen Firma Tanımlarından veya yukarıdan hedef alan seçiniz.
                  </Alert>
                )}

                {!hasOtherDb && !alanYok && (
                  <Alert variant="warning" className="py-1 px-2.5 mt-2 mb-0 small text-center">
                    ⚠️ Firmanıza ait aktarım yapılabilecek başka bir çalışma alanı bulunmamaktadır. Kendi aktif veritabanınız pasiftir.
                  </Alert>
                )}
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
                  <option value="2">#2</option>
                  <option value="3">#3</option>
                  <option value="all">#Tümü</option>
                </Form.Select>
              </div>

              {/* Durum / İlerleme Çubuğu */}
              <div
                className="rounded-2 p-3 mb-3 d-flex align-items-center justify-content-center text-center shadow-inner"
                style={{
                  minHeight: "72px",
                  backgroundColor:
                    alanYok
                      ? "#fee2e2"
                      : statusType === "error"
                        ? "#fee2e2"
                        : statusType === "success"
                          ? "#dcfce7"
                          : statusType === "warning"
                            ? "#fef3c7"
                            : "#64748b",
                  color:
                    alanYok
                      ? "#991b1b"
                      : statusType === "info" || statusType === "loading"
                        ? "#ffffff"
                        : "#0f172a",
                  transition: "all 0.25s ease",
                  border: alanYok ? "1px solid #ef4444" : "1px solid rgba(0,0,0,0.1)",
                }}
              >
                {alanYok ? (
                  <div className="d-flex align-items-center justify-content-center gap-2 fw-bold text-danger">
                    <IconAlertTriangle size={22} className="flex-shrink-0" />
                    <span>Fiş aktarma alanı yok: Veritabanına aktarma işlemi çalışmaz!</span>
                  </div>
                ) : loading ? (
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
                  variant="outline-secondary"
                  className="d-inline-flex align-items-center justify-content-center gap-2 px-4 py-2 fw-semibold shadow-sm"
                  style={{
                    minWidth: "150px",
                    fontSize: "14px",
                    cursor: alanYok ? "not-allowed" : "pointer",
                    opacity: alanYok ? 0.45 : 1,
                  }}
                  onClick={handleOpenModal}
                  disabled={loading || alanYok}
                  title={alanYok ? "Fiş aktarma alanı yok, çalışmaz" : "Fişleri Listele"}
                >
                  <IconListCheck size={18} />
                  <span>Fişleri Listele</span>
                </Button>

                <Button
                  variant={alanYok ? "secondary" : "success"}
                  className="d-inline-flex align-items-center justify-content-center gap-2 px-5 py-2 fw-bold shadow-sm"
                  style={{
                    minWidth: "160px",
                    fontSize: "14px",
                    background: alanYok ? "#94a3b8" : "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                    border: "none",
                    cursor: alanYok ? "not-allowed" : "pointer",
                    opacity: alanYok ? 0.45 : 1,
                  }}
                  onClick={handleOpenModal}
                  disabled={loading || alanYok}
                  title={alanYok ? "Fiş aktarma alanı yok, çalışmaz" : "Fiş Aktar"}
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
