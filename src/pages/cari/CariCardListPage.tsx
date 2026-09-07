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
} from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";
import ERPToolbar from "../../components/common/ERPToolbar";
import { CariService, CariKartItem } from "../../services/cariService";
import { printReportTable } from "../../utils/printReport";

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

  const [cariList, setCariList] = useState<CariKartItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedType, setSelectedType] = useState<string>("all");
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
  }, [cariList, searchTerm, selectedType]);

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
      title: "Cari Kart Listesi",
      subtitle: `Toplam ${filteredCariler.length} kayıt listelendi`,
      data: filteredCariler.map((c) => ({
        kod: c.kod,
        ad: c.ad,
        tip: KISILIK_TIPI_LABELS[c.kisilikTipi] || "Diğer",
        vkn: c.vergiKimlikNo || "-",
        telefon: c.telefon || "-",
        yetkili: c.yetkiliKisi || "-",
      })),
      columns: [
        { header: "Cari Kodu", key: "kod", width: "15%" },
        { header: "Cari Ünvan / Adı", key: "ad", width: "30%" },
        { header: "Kişilik Tipi", key: "tip", width: "15%" },
        { header: "VKN / TCKN", key: "vkn", width: "15%" },
        { header: "Telefon", key: "telefon", width: "12%" },
        { header: "Yetkili Kişi", key: "yetkili", width: "13%" },
      ],
      summaryInfo: `Rapor Tarihi: ${new Date().toLocaleDateString("tr-TR")}`,
    });
  };

  return (
    <div className="cari-card-list-page pb-5">
      {/* 1. ERP Aksiyon Toolbar */}
      <ERPToolbar
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

      {/* 2. Alert Messages */}
      {error && (
        <Alert
          variant="danger"
          dismissible
          onClose={() => setError(null)}
          className="d-flex align-items-center gap-2 py-2 mb-3 shadow-xs"
        >
          <IconAlertCircle size={18} className="text-danger flex-shrink-0" />
          <span className="small fw-medium">{error}</span>
        </Alert>
      )}

      {/* 3. Ana Liste Kartı */}
      <Card className="border shadow-xs rounded-3 bg-white">
        <Card.Header className="bg-white border-bottom p-3">
          <Row className="g-2 align-items-center justify-content-between">
            <Col xs={12} md={4}>
              <div className="d-flex align-items-center gap-2">
                <span className="badge bg-light text-secondary border fw-medium px-2.5 py-1.5 small">
                  Toplam {filteredCariler.length} / {cariList.length} kayıt
                </span>
              </div>
            </Col>

            <Col xs={12} md={8}>
              <div className="d-flex align-items-center justify-content-md-end gap-2 flex-wrap">
                {/* Arama Inputu */}
                <InputGroup size="sm" style={{ maxWidth: "260px" }}>
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
                  style={{ width: "160px" }}
                  className="bg-light border"
                >
                  <option value="all">Tüm Kişilik Tipleri</option>
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
                  <IconPlus size={15} /> Yeni Kart Ekle
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
              <Table hover className="align-middle mb-0 text-nowrap" style={{ fontSize: "0.85rem" }}>
                <thead className="table-light text-secondary border-bottom">
                  <tr>
                    <th style={{ width: "50px" }} className="text-center">#</th>
                    <th style={{ width: "130px" }}>Cari Kodu</th>
                    <th>Cari Ünvanı / Adı</th>
                    <th style={{ width: "140px" }}>Kişilik Tipi</th>
                    <th style={{ width: "130px" }}>VKN / TCKN</th>
                    <th style={{ width: "130px" }}>Telefon</th>
                    <th style={{ width: "140px" }}>Yetkili Kişi</th>
                    <th style={{ width: "90px" }} className="text-center">Durum</th>
                    <th style={{ width: "90px" }} className="text-center">İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCariler.map((item, idx) => {
                    const isSelected = idx === selectedIndex;
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
                            {item.kod}
                          </span>
                        </td>
                        <td>
                          <div className="fw-semibold text-dark d-flex align-items-center gap-1.5">
                            {item.kisilikTipi === 2 ? (
                              <IconBuilding size={15} className="text-secondary flex-shrink-0" />
                            ) : (
                              <IconUser size={15} className="text-secondary flex-shrink-0" />
                            )}
                            <span>{item.ad}</span>
                          </div>
                          {item.adres && (
                            <div className="text-muted small text-truncate" style={{ maxWidth: "320px", fontSize: "0.75rem" }}>
                              {item.adres}
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
                        <td>
                          {item.vergiKimlikNo ? (
                            <span className="font-monospace small d-flex align-items-center gap-1 text-secondary">
                              <IconId size={14} /> {item.vergiKimlikNo}
                            </span>
                          ) : (
                            <span className="text-muted small">-</span>
                          )}
                        </td>
                        <td>
                          {item.telefon ? (
                            <span className="small d-flex align-items-center gap-1 text-secondary">
                              <IconPhone size={13} /> {item.telefon}
                            </span>
                          ) : (
                            <span className="text-muted small">-</span>
                          )}
                        </td>
                        <td>
                          <span className="small text-secondary">{item.yetkiliKisi || "-"}</span>
                        </td>
                        <td className="text-center">
                          {item.karaListede ? (
                            <Badge bg="danger" className="px-2 py-1 small">
                              ⚠️ Kara Liste
                            </Badge>
                          ) : (
                            <Badge bg="success-subtle" className="text-success-emphasis border border-success-subtle px-2 py-1 small">
                              Aktif
                            </Badge>
                          )}
                        </td>
                        <td className="text-center">
                          <Button
                            variant="outline-primary"
                            size="sm"
                            className="py-0.5 px-2 small d-inline-flex align-items-center gap-1"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEdit(item);
                            }}
                            title="Cari Kartı Düzenle"
                          >
                            <IconEdit size={13} /> Düzenle
                          </Button>
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
