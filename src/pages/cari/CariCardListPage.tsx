import React, { useEffect, useState, useMemo } from "react";
import {
  Card,
  Table,
  Button,
  Form,
  InputGroup,
  Badge,
  Spinner,
  Alert,
  Row,
  Col,
} from "react-bootstrap";
import {
  IconSearch,
  IconPlus,
  IconEdit,
  IconAlertCircle,
  IconUser,
  IconBuilding,
  IconPhone,
  IconId,
  IconUsers,
  IconCash,
  IconCoins,
} from "@tabler/icons-react";
import { useNavigate, useLocation } from "react-router-dom";
import ERPToolbar from "../../components/common/ERPToolbar";
import { CariService, CariKartItem } from "../../services/cariService";
import { printReportTable } from "../../utils/printReport";
import { highlightText } from "../../components/common/HighlightText";

const KISILIK_TIPI_LABELS: Record<number, string> = {
  0: "Bilinmiyor",
  1: "Gerçek Kişi",
  2: "Tüzel Kişi",
  3: "Yabancı Gerçek Kişi",
  4: "Yabancı Tüzel Kişi",
  5: "Diğer",
};

export const CariCardListPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [cariList, setCariList] = useState<CariKartItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [bakiyeFilter, setBakiyeFilter] = useState<string>("all"); // "all", "hasBakiye", "borclu", "alacakli"
  const [selectedIndex, setSelectedIndex] = useState<number>(0);

  const loadData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const list = await CariService.getCariKartlar();
      setCariList(list || []);
      setSelectedIndex(0);
    } catch (err: any) {
      setError(err.message || "Cari kartlar listelenirken bir hata oluştu.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredCariler = useMemo(() => {
    return cariList.filter((item) => {
      // Type filter
      if (selectedType !== "all" && item.kisilikTipi !== Number(selectedType)) {
        return false;
      }
      // Balance filter
      if (bakiyeFilter === "hasBakiye") {
        if ((item.netBakiye || 0) < 0.01 && (item.hasBakiye || 0) < 0.001) return false;
      } else if (bakiyeFilter === "borclu") {
        if (item.bakiyeYon !== "B" && item.hasYon !== "B") return false;
      } else if (bakiyeFilter === "alacakli") {
        if (item.bakiyeYon !== "A" && item.hasYon !== "A") return false;
      }

      // Search term filter
      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase();
      return (
        item.kod.toLowerCase().includes(term) ||
        item.ad.toLowerCase().includes(term) ||
        (item.vergiKimlikNo && item.vergiKimlikNo.toLowerCase().includes(term)) ||
        (item.telefon && item.telefon.toLowerCase().includes(term)) ||
        (item.yetkiliKisi && item.yetkiliKisi.toLowerCase().includes(term)) ||
        (item.adres && item.adres.toLowerCase().includes(term))
      );
    });
  }, [cariList, searchTerm, selectedType, bakiyeFilter]);

  // KPI calculations
  const kpis = useMemo(() => {
    let totalBorc = 0;
    let totalAlacak = 0;
    let totalNetHas = 0;

    for (const c of cariList) {
      totalBorc += c.borcBakiye || 0;
      totalAlacak += c.alacakBakiye || 0;
      if (c.hasBakiye) {
        totalNetHas += c.hasYon === "B" ? -(c.hasBakiye) : (c.hasBakiye);
      }
    }

    return {
      totalCount: cariList.length,
      totalBorc,
      totalAlacak,
      totalNetHas: Math.abs(totalNetHas),
      hasYon: totalNetHas < -0.001 ? "B" : totalNetHas > 0.001 ? "A" : "-",
    };
  }, [cariList]);

  const handleNavigate = (direction: "first" | "prev" | "next" | "last") => {
    if (filteredCariler.length === 0) return;
    if (direction === "first") setSelectedIndex(0);
    else if (direction === "prev") setSelectedIndex(Math.max(0, selectedIndex - 1));
    else if (direction === "next") setSelectedIndex(Math.min(filteredCariler.length - 1, selectedIndex + 1));
    else if (direction === "last") setSelectedIndex(filteredCariler.length - 1);
  };

  const handleEdit = (item: CariKartItem) => {
    navigate(`/cari/kart-duzeltme?id=${item.id}`, {
      state: { id: item.id, item },
    });
  };

  const handlePrint = () => {
    printReportTable({
      title: "Cari Kart Listesi ve Bakiye Raporu",
      subtitle: `Toplam ${filteredCariler.length} kayıt listelendi`,
      data: filteredCariler.map((c) => ({
        kod: c.kod,
        ad: c.ad,
        tip: KISILIK_TIPI_LABELS[c.kisilikTipi] || "Diğer",
        borc: (c.borcBakiye || 0).toLocaleString("tr-TR", { minimumFractionDigits: 2 }),
        alacak: (c.alacakBakiye || 0).toLocaleString("tr-TR", { minimumFractionDigits: 2 }),
        netBakiye: `${(c.netBakiye || 0).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ${c.bakiyeYon || ""}`,
        hasBakiye: c.hasBakiye ? `${c.hasBakiye.toFixed(2)} HAS ${c.hasYon || ""}` : "-",
        telefon: c.telefon || "-",
      })),
      columns: [
        { header: "Cari Kodu", key: "kod", width: "12%" },
        { header: "Cari Ünvan / Adı", key: "ad", width: "24%" },
        { header: "Kişilik Tipi", key: "tip", width: "10%" },
        { header: "Borç (TL)", key: "borc", width: "12%" },
        { header: "Alacak (TL)", key: "alacak", width: "12%" },
        { header: "Net Bakiye (TL)", key: "netBakiye", width: "12%" },
        { header: "HAS Bakiye", key: "hasBakiye", width: "10%" },
        { header: "Telefon", key: "telefon", width: "8%" },
      ],
      summaryInfo: `Rapor Tarihi: ${new Date().toLocaleDateString("tr-TR")}`,
    });
  };

  return (
    <div className="cari-card-list-page w-100 pb-3" style={{ overflowX: "hidden" }}>
      {/* 1. ERP Aksiyon Toolbar */}
      <ERPToolbar
        pageTitle={location.pathname.includes("detayli") ? "I- Detaylı Cari Kart Listesi" : "C- Cari Kart Listesi"}
        pageIcon={<IconUsers size={20} className="text-primary" />}
        onRefresh={loadData}
        onPrint={handlePrint}
        onFirst={() => handleNavigate("first")}
        onPrev={() => handleNavigate("prev")}
        onNext={() => handleNavigate("next")}
        onLast={() => handleNavigate("last")}
        onNew={() => navigate("/cari/kart-kayit")}
        onEdit={() => {
          if (filteredCariler.length > 0 && filteredCariler[selectedIndex]) {
            handleEdit(filteredCariler[selectedIndex]);
          }
        }}
        disabled={isLoading}
      />

      {/* KPI Cards */}
      <Row className="g-3 mb-3">
        <Col xs={12} sm={6} md={3}>
          <Card className="border shadow-2xs bg-white">
            <Card.Body className="p-3 d-flex align-items-center justify-content-between">
              <div>
                <div className="small text-muted fw-semibold">Toplam Cari Kart</div>
                <h4 className="mb-0 fw-bold font-monospace text-dark mt-1">{kpis.totalCount}</h4>
              </div>
              <div className="p-2.5 bg-primary-subtle rounded-circle text-primary">
                <IconUsers size={22} />
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col xs={12} sm={6} md={3}>
          <Card className="border shadow-2xs bg-white">
            <Card.Body className="p-3 d-flex align-items-center justify-content-between">
              <div>
                <div className="small text-muted fw-semibold">Toplam Borç (TL)</div>
                <h5 className="mb-0 fw-bold font-monospace text-danger mt-1">
                  {kpis.totalBorc.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                </h5>
              </div>
              <div className="p-2.5 bg-danger-subtle rounded-circle text-danger">
                <IconCash size={22} />
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col xs={12} sm={6} md={3}>
          <Card className="border shadow-2xs bg-white">
            <Card.Body className="p-3 d-flex align-items-center justify-content-between">
              <div>
                <div className="small text-muted fw-semibold">Toplam Alacak (TL)</div>
                <h5 className="mb-0 fw-bold font-monospace text-success mt-1">
                  {kpis.totalAlacak.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                </h5>
              </div>
              <div className="p-2.5 bg-success-subtle rounded-circle text-success">
                <IconCash size={22} />
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col xs={12} sm={6} md={3}>
          <Card className="border shadow-2xs bg-white">
            <Card.Body className="p-3 d-flex align-items-center justify-content-between">
              <div>
                <div className="small text-muted fw-semibold">Net HAS Bakiye</div>
                <h5 className="mb-0 fw-bold font-monospace text-warning mt-1">
                  {kpis.totalNetHas.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} gr {kpis.hasYon}
                </h5>
              </div>
              <div className="p-2.5 bg-warning-subtle rounded-circle text-warning">
                <IconCoins size={22} />
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Sayfa Ortası Popup Bildirimler (ERP Toast) */}
      {error && (
        <div className="erp-toast-container">
          <Alert
            variant="danger"
            dismissible
            onClose={() => setError(null)}
            className="erp-toast-item d-flex align-items-center mb-0 shadow py-2 px-3 border-0"
          >
            <IconAlertCircle size={18} className="text-danger flex-shrink-0 me-2" />
            <span style={{ fontSize: "13px" }}>{error}</span>
          </Alert>
        </div>
      )}

      {/* 3. Ana Liste Kartı */}
      <Card className="border shadow-xs rounded-3 bg-white">
        <Card.Header className="bg-white border-bottom p-3">
          <Row className="g-2 align-items-center justify-content-between">
            <Col xs={12} md={5}>
              <div className="d-flex align-items-center gap-2 flex-wrap">
                <span className="badge bg-light text-secondary border fw-medium px-2.5 py-1.5 small">
                  Toplam {filteredCariler.length} / {cariList.length} kayıt
                </span>

                {/* Bakiye filtre butonları */}
                <div className="btn-group btn-group-sm">
                  <Button
                    variant={bakiyeFilter === "all" ? "primary" : "outline-secondary"}
                    size="sm"
                    className="py-1 px-2"
                    onClick={() => setBakiyeFilter("all")}
                  >
                    Tümü
                  </Button>
                  <Button
                    variant={bakiyeFilter === "hasBakiye" ? "primary" : "outline-secondary"}
                    size="sm"
                    className="py-1 px-2"
                    onClick={() => setBakiyeFilter("hasBakiye")}
                  >
                    Bakiyesi Olanlar
                  </Button>
                  <Button
                    variant={bakiyeFilter === "borclu" ? "danger" : "outline-danger"}
                    size="sm"
                    className="py-1 px-2"
                    onClick={() => setBakiyeFilter("borclu")}
                  >
                    Borçlular (B)
                  </Button>
                  <Button
                    variant={bakiyeFilter === "alacakli" ? "success" : "outline-success"}
                    size="sm"
                    className="py-1 px-2"
                    onClick={() => setBakiyeFilter("alacakli")}
                  >
                    Alacaklılar (A)
                  </Button>
                </div>
              </div>
            </Col>

            <Col xs={12} md={7}>
              <div className="d-flex align-items-center justify-content-md-end gap-2 flex-wrap">
                {/* Arama Inputu */}
                <InputGroup size="sm" style={{ maxWidth: "240px" }}>
                  <InputGroup.Text className="bg-light border-end-0 text-muted">
                    <IconSearch size={15} />
                  </InputGroup.Text>
                  <Form.Control
                    type="text"
                    placeholder="Kod, ünvan, vergi no ara..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="border-start-0"
                  />
                  {searchTerm && (
                    <Button
                      variant="outline-secondary"
                      size="sm"
                      onClick={() => setSearchTerm("")}
                      className="border-start-0"
                    >
                      ×
                    </Button>
                  )}
                </InputGroup>

                {/* Kişilik Tipi Filtresi */}
                <Form.Select
                  size="sm"
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  style={{ width: "150px" }}
                  className="bg-light border"
                >
                  <option value="all">Tüm Kişilikler</option>
                  <option value="1">1 - Gerçek Kişi</option>
                  <option value="2">2 - Tüzel Kişi</option>
                  <option value="3">3 - Yabancı Gerçek</option>
                  <option value="4">4 - Yabancı Tüzel</option>
                </Form.Select>

                {/* Yeni Cari Kartı Ekle Butonu */}
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => navigate("/cari/kart-kayit")}
                  className="d-flex align-items-center gap-1 shadow-2xs"
                >
                  <IconPlus size={15} /> Yeni Kart
                </Button>
              </div>
            </Col>
          </Row>
        </Card.Header>

        <Card.Body className="p-0">
          {isLoading ? (
            <div className="text-center py-5">
              <Spinner animation="border" variant="primary" size="sm" />
              <p className="text-muted small mt-2 mb-0">Cari kartlar yükleniyor...</p>
            </div>
          ) : filteredCariler.length === 0 ? (
            <div className="text-center py-5 text-muted">
              <IconUser size={36} className="text-secondary opacity-50 mb-2" />
              <p className="small mb-0">Arama kriterlerine uygun cari kart bulunamadı.</p>
            </div>
          ) : (
            <div className="table-responsive">
              <Table hover className="align-middle mb-0 text-nowrap w-100" style={{ fontSize: "0.83rem", width: "100%" }}>
                <thead className="table-light text-secondary border-bottom">
                  <tr>
                    <th style={{ width: "40px" }} className="text-center">#</th>
                    <th style={{ width: "110px" }}>Cari Kodu</th>
                    <th>Cari Ünvanı / Adı</th>
                    <th style={{ width: "100px" }}>Kişilik Tipi</th>
                    <th style={{ width: "110px" }} className="text-end">Borç (TL)</th>
                    <th style={{ width: "110px" }} className="text-end">Alacak (TL)</th>
                    <th style={{ width: "130px" }} className="text-end">Net Bakiye (TL)</th>
                    <th style={{ width: "120px" }} className="text-center">HAS Bakiye</th>
                    <th style={{ width: "140px" }}>Bakiye Özeti</th>
                    <th style={{ width: "110px" }}>Telefon</th>
                    <th style={{ width: "80px" }} className="text-center">Durum</th>
                    <th style={{ width: "120px" }} className="text-center">İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCariler.map((item, idx) => {
                    const isSelected = idx === selectedIndex;
                    const hasNetBakiye = (item.netBakiye || 0) > 0.001;
                    const hasGold = (item.hasBakiye || 0) > 0.001;

                    return (
                      <tr
                        key={item.id}
                        className={isSelected ? "table-active" : ""}
                        onClick={() => setSelectedIndex(idx)}
                        onDoubleClick={() => handleEdit(item)}
                        style={{ cursor: "pointer" }}
                        title="Kartı düzenlemek için çift tıklayınız"
                      >
                        <td className="text-center text-muted small">{idx + 1}</td>
                        <td>
                          <span className="badge bg-light text-primary border font-monospace fw-bold px-2 py-1">
                            {highlightText(item.kod, searchTerm)}
                          </span>
                        </td>
                        <td>
                          <div className="fw-semibold text-dark d-flex align-items-center gap-1.5">
                            {item.kisilikTipi === 2 ? (
                              <IconBuilding size={15} className="text-secondary flex-shrink-0" />
                            ) : (
                              <IconUser size={15} className="text-secondary flex-shrink-0" />
                            )}
                            <span>{highlightText(item.ad, searchTerm)}</span>
                          </div>
                          {item.adres && (
                            <div className="text-muted small text-truncate" style={{ maxWidth: "260px", fontSize: "0.72rem" }}>
                              {highlightText(item.adres, searchTerm)}
                            </div>
                          )}
                        </td>
                        <td>
                          <Badge
                            bg={item.kisilikTipi === 2 ? "info-subtle" : "primary-subtle"}
                            className={`px-2 py-1 small fw-medium ${
                              item.kisilikTipi === 2 ? "text-info-emphasis border border-info-subtle" : "text-primary-emphasis border border-primary-subtle"
                            }`}
                          >
                            {KISILIK_TIPI_LABELS[item.kisilikTipi] || "Diğer"}
                          </Badge>
                        </td>

                        {/* Borç (TL) */}
                        <td className="text-end font-monospace">
                          {(item.borcBakiye || 0) > 0.001 ? (
                            <span className="text-danger fw-semibold">
                              {(item.borcBakiye || 0).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                            </span>
                          ) : (
                            <span className="text-muted opacity-50">-</span>
                          )}
                        </td>

                        {/* Alacak (TL) */}
                        <td className="text-end font-monospace">
                          {(item.alacakBakiye || 0) > 0.001 ? (
                            <span className="text-success fw-semibold">
                              {(item.alacakBakiye || 0).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                            </span>
                          ) : (
                            <span className="text-muted opacity-50">-</span>
                          )}
                        </td>

                        {/* Net Bakiye (TL) */}
                        <td className="text-end font-monospace">
                          {hasNetBakiye ? (
                            <span className={`badge px-2 py-1 ${item.bakiyeYon === "B" ? "bg-danger-subtle text-danger border border-danger-subtle" : "bg-success-subtle text-success border border-success-subtle"}`}>
                              {(item.netBakiye || 0).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺ ({item.bakiyeYon})
                            </span>
                          ) : (
                            <span className="text-muted small">0.00 ₺</span>
                          )}
                        </td>

                        {/* HAS Bakiye */}
                        <td className="text-center font-monospace">
                          {hasGold ? (
                            <Badge bg="warning-subtle" className="text-warning-emphasis border border-warning-subtle px-2 py-1">
                              {(item.hasBakiye || 0).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} HAS {item.hasYon}
                            </Badge>
                          ) : (
                            <span className="text-muted opacity-50">-</span>
                          )}
                        </td>

                        {/* Bakiye Özeti */}
                        <td>
                          <span className="small text-muted text-truncate d-inline-block" style={{ maxWidth: "150px" }} title={item.bakiyeOzet || "0.00 TL"}>
                            {item.bakiyeOzet || "0.00 TL"}
                          </span>
                        </td>

                        <td>
                          {item.telefon ? (
                            <span className="small d-flex align-items-center gap-1 text-secondary">
                              <IconPhone size={13} /> {highlightText(item.telefon, searchTerm)}
                            </span>
                          ) : (
                            <span className="text-muted small">-</span>
                          )}
                        </td>

                        <td className="text-center">
                          {item.karaListede ? (
                            <Badge bg="danger" className="px-1.5 py-0.5 small">
                              Kara Liste
                            </Badge>
                          ) : (
                            <Badge bg="success-subtle" className="text-success-emphasis border border-success-subtle px-1.5 py-0.5 small">
                              Aktif
                            </Badge>
                          )}
                        </td>

                        <td className="text-center">
                          <div className="d-flex align-items-center justify-content-center gap-1">
                            <Button
                              variant="outline-primary"
                              size="sm"
                              className="py-0.5 px-1.5 small d-inline-flex align-items-center gap-1"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEdit(item);
                              }}
                              title="Cari Kartı Düzenle"
                            >
                              <IconEdit size={13} />
                            </Button>
                            <Button
                              variant="outline-secondary"
                              size="sm"
                              className="py-0.5 px-1.5 small d-inline-flex align-items-center gap-1"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/cari/hareket-listesi`);
                              }}
                              title="Cari Hareketler / Ekstre"
                            >
                              <IconCash size={13} />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </div>
          )}
        </Card.Body>

        <Card.Footer className="bg-light-subtle border-top py-2 px-3">
          <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
            <span className="text-muted small" style={{ fontSize: "0.78rem" }}>
              Kayıt seçmek için satıra tıklayabilir veya klavye / ERP araç çubuğu yönlendirme butonlarını kullanabilirsiniz.
            </span>
            <div className="d-flex align-items-center gap-2">
              <span className="badge bg-secondary-subtle text-secondary small">
                {filteredCariler.length} / {cariList.length} Cari
              </span>
            </div>
          </div>
        </Card.Footer>
      </Card>
    </div>
  );
};

export default CariCardListPage;
