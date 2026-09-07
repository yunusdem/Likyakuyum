import React, { useEffect, useState, useMemo } from "react";
import {
  Card,
  Table,
  Button,
  Form,
  Badge,
  Spinner,
  Alert,
  Row,
  Col,
  Modal,
  Collapse,
} from "react-bootstrap";
import {
  IconSearch,
  IconEdit,
  IconTrash,
  IconPrinter,
  IconCash,
  IconArrowsSort,
  IconRefresh,
  IconCoins,
  IconChevronDown,
  IconChevronUp,
  IconFileText,
  IconReceipt2,
} from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";
import ERPToolbar from "../../components/common/ERPToolbar";
import { CariHareketService, CariHareketItem } from "../../services/cariHareketService";
import { CariService, CariKartItem } from "../../services/cariService";
import { apiClient } from "../../services/apiClient";
import { printReportTable } from "../../utils/printReport";

export const CariHareketListPage: React.FC = () => {
  const navigate = useNavigate();

  const [hareketList, setHareketList] = useState<CariHareketItem[]>([]);
  const [cariList, setCariList] = useState<CariKartItem[]>([]);
  const [vezneList, setVezneList] = useState<any[]>([]);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const today = new Date().toISOString().split("T")[0];
  const [startDate, setStartDate] = useState<string>(() => new Date().toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState<string>(() => new Date().toISOString().split("T")[0]);
  const [selectedCariId, setSelectedCariId] = useState<string>("all");
  const [selectedVezneId, setSelectedVezneId] = useState<string>("all");
  const [selectedTip, setSelectedTip] = useState<string>("all"); // all, 0: Borç, 1: Alacak
  const [selectedHareketTipi, setSelectedHareketTipi] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState<string>("");

  // Expandable row IDs
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  // Delete modal state
  const [itemToDelete, setItemToDelete] = useState<CariHareketItem | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  const loadData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const [items, cariler, vezneler] = await Promise.all([
        CariHareketService.list({
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          cariKartId: selectedCariId !== "all" ? Number(selectedCariId) : undefined,
          vezneId: selectedVezneId !== "all" ? Number(selectedVezneId) : undefined,
          tip: selectedTip !== "all" ? Number(selectedTip) : undefined,
          hareketTipi: selectedHareketTipi !== "all" ? Number(selectedHareketTipi) : undefined,
          search: searchTerm || undefined,
        }),
        CariService.getCariKartlar().catch(() => []),
        apiClient.get<any[]>("/vezne").catch(() => ({ data: [] })),
      ]);

      setHareketList(items || []);
      setCariList(cariler || []);
      setVezneList(vezneler.data || []);
    } catch (err: any) {
      setError(err.message || "Cari hareketler yüklenirken bir hata oluştu.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleApplyFilter = () => {
    loadData();
  };

  const handleResetFilter = () => {
    const curToday = new Date().toISOString().split("T")[0];
    setStartDate(curToday);
    setEndDate(curToday);
    setSelectedCariId("all");
    setSelectedVezneId("all");
    setSelectedTip("all");
    setSelectedHareketTipi("all");
    setSearchTerm("");
    // Re-fetch with today filters
    CariHareketService.list({ startDate: curToday, endDate: curToday }).then((items) => setHareketList(items || []));
  };

  const toggleRowExpand = (id: number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleDeleteClick = (item: CariHareketItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setItemToDelete(item);
  };

  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;
    try {
      setIsDeleting(true);
      await CariHareketService.delete(itemToDelete.id);
      setHareketList((prev) => prev.filter((h) => h.id !== itemToDelete.id));
      setItemToDelete(null);
    } catch (err: any) {
      setError(err.message || "Kayıt silinirken hata oluştu.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleEditClick = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/cari/hareket-duzeltme?id=${id}`);
  };

  const handlePrintItem = (item: CariHareketItem, e: React.MouseEvent) => {
    e.stopPropagation();
    printReportTable({
      title: "Cari Hareket Makbuzu",
      subtitle: `${item.cariKod} - ${item.cariAd} | Fiş No: #${item.id} | Tarih: ${
        item.tarih ? new Date(item.tarih).toLocaleDateString("tr-TR") : "-"
      } | ${item.tip === 0 ? "BORÇ" : "ALACAK"}`,
      data: item.satirlar.map((l, i) => ({
        satir: i + 1,
        paraKodu: l.paraKodu,
        meblag: new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2 }).format(l.meblag),
        islemTipi: item.tipLabel,
        aciklama: item.aciklama || "-",
      })),
      columns: [
        { header: "#", key: "satir", width: "10%" },
        { header: "Para / SMB", key: "paraKodu", width: "25%" },
        { header: "Miktar / Meblağ", key: "meblag", width: "30%" },
        { header: "İşlem", key: "islemTipi", width: "15%" },
        { header: "Açıklama", key: "aciklama", width: "20%" },
      ],
    });
  };

  const handlePrintList = () => {
    printReportTable({
      title: "Cari Hareket Listesi",
      subtitle: `Toplam ${hareketList.length} adet işlem listelenmektedir.`,
      data: hareketList.map((h, i) => ({
        sira: i + 1,
        fisNo: `#${h.id}`,
        tarih: h.tarih ? new Date(h.tarih).toLocaleDateString("tr-TR") : "-",
        cari: `${h.cariKod} - ${h.cariAd}`,
        vezne: h.vezneKod || "-",
        tip: h.tipLabel,
        hareketTipi: h.hareketTipiLabel,
        satirlar: h.satirlarOzet || "-",
      })),
      columns: [
        { header: "#", key: "sira", width: "5%" },
        { header: "Fiş No", key: "fisNo", width: "10%" },
        { header: "Tarih", key: "tarih", width: "12%" },
        { header: "Cari", key: "cari", width: "25%" },
        { header: "Vezne", key: "vezne", width: "8%" },
        { header: "İşlem", key: "tip", width: "10%" },
        { header: "Hareket Tipi", key: "hareketTipi", width: "12%" },
        { header: "Satırlar Özeti", key: "satirlar", width: "18%" },
      ],
    });
  };

  // KPIs
  const kpis = useMemo(() => {
    let borcCount = 0;
    let alacakCount = 0;
    for (const h of hareketList) {
      if (h.tip === 0) borcCount++;
      else if (h.tip === 1) alacakCount++;
    }
    return {
      total: hareketList.length,
      borcCount,
      alacakCount,
    };
  }, [hareketList]);

  return (
    <div className="cari-hareket-list-container pb-5">
      {/* ERP Toolbar */}
      <ERPToolbar
        pageTitle="E- Cari Hareket Listesi"
        onNew={() => navigate("/cari/hareket-kayit")}
        onPrint={handlePrintList}
        onRefresh={loadData}
      />

      {/* KPI Cards */}
      <Row className="g-3 mb-3">
        <Col xs={12} sm={4} md={4}>
          <Card className="border shadow-2xs bg-white">
            <Card.Body className="p-3 d-flex align-items-center justify-content-between">
              <div>
                <div className="small text-muted fw-semibold">Toplam İşlem</div>
                <h4 className="mb-0 fw-bold font-monospace text-dark mt-1">{kpis.total}</h4>
              </div>
              <div className="p-2.5 bg-light rounded-circle text-primary">
                <IconReceipt2 size={24} />
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col xs={12} sm={4} md={4}>
          <Card className="border shadow-2xs bg-white">
            <Card.Body className="p-3 d-flex align-items-center justify-content-between">
              <div>
                <div className="small text-muted fw-semibold">Borç İşlemleri</div>
                <h4 className="mb-0 fw-bold font-monospace text-danger mt-1">{kpis.borcCount}</h4>
              </div>
              <div className="p-2.5 bg-danger-subtle rounded-circle text-danger">
                <IconCash size={24} />
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col xs={12} sm={4} md={4}>
          <Card className="border shadow-2xs bg-white">
            <Card.Body className="p-3 d-flex align-items-center justify-content-between">
              <div>
                <div className="small text-muted fw-semibold">Alacak İşlemleri</div>
                <h4 className="mb-0 fw-bold font-monospace text-success mt-1">{kpis.alacakCount}</h4>
              </div>
              <div className="p-2.5 bg-success-subtle rounded-circle text-success">
                <IconCoins size={24} />
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Filter Card */}
      <Card className="border shadow-sm mb-3 bg-white">
        <Card.Body className="p-3">
          <Row className="g-2.5 align-items-end">
            <Col xs={12} sm={6} md={2}>
              <Form.Label className="small fw-semibold text-secondary mb-1">Başlangıç Tarihi</Form.Label>
              <Form.Control
                type="date"
                size="sm"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </Col>

            <Col xs={12} sm={6} md={2}>
              <Form.Label className="small fw-semibold text-secondary mb-1">Bitiş Tarihi</Form.Label>
              <Form.Control
                type="date"
                size="sm"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </Col>

            <Col xs={12} sm={6} md={2}>
              <Form.Label className="small fw-semibold text-secondary mb-1">Cari Kart</Form.Label>
              <Form.Select
                size="sm"
                value={selectedCariId}
                onChange={(e) => setSelectedCariId(e.target.value)}
              >
                <option value="all">Tüm Cariler</option>
                {cariList.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.kod} - {c.ad}
                  </option>
                ))}
              </Form.Select>
            </Col>

            <Col xs={12} sm={6} md={2}>
              <Form.Label className="small fw-semibold text-secondary mb-1">İşlem Tipi</Form.Label>
              <Form.Select
                size="sm"
                value={selectedTip}
                onChange={(e) => setSelectedTip(e.target.value)}
              >
                <option value="all">Tümü (Borç / Alacak)</option>
                <option value="0">Borç</option>
                <option value="1">Alacak</option>
              </Form.Select>
            </Col>

            <Col xs={12} sm={6} md={2}>
              <Form.Label className="small fw-semibold text-secondary mb-1">Hareket Tipi</Form.Label>
              <Form.Select
                size="sm"
                value={selectedHareketTipi}
                onChange={(e) => setSelectedHareketTipi(e.target.value)}
              >
                <option value="all">Tüm Tipler</option>
                <option value="0">Nakit</option>
                <option value="1">Banka / Havale</option>
                <option value="2">POS</option>
                <option value="3">Dekont</option>
                <option value="4">Virman</option>
                <option value="5">Devir</option>
              </Form.Select>
            </Col>

            <Col xs={12} sm={6} md={2} className="d-flex gap-2">
              <Button
                variant="primary"
                size="sm"
                className="w-100 py-1.5 fw-semibold d-flex align-items-center justify-content-center gap-1"
                onClick={handleApplyFilter}
              >
                <IconArrowsSort size={15} />
                Sırala
              </Button>
              <Button
                variant="outline-secondary"
                size="sm"
                className="py-1.5"
                onClick={handleResetFilter}
                title="Filtreleri Temizle"
              >
                <IconRefresh size={15} />
              </Button>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* Error Alert */}
      {error && (
        <Alert variant="danger" dismissible onClose={() => setError(null)} className="py-2 px-3 mb-3">
          {error}
        </Alert>
      )}

      {/* Main Table Card */}
      <Card className="border shadow-sm bg-white">
        <Card.Header className="bg-light py-2.5 px-3 border-bottom d-flex align-items-center justify-content-between">
          <span className="fw-bold text-dark fs-6 d-flex align-items-center gap-2">
            <IconCash size={18} className="text-primary" />
            Cari Hareket Kayıtları ({hareketList.length})
          </span>
          <Button
            size="sm"
            variant="outline-secondary"
            className="py-1 px-2.5 fs-7 d-flex align-items-center gap-1"
            onClick={handlePrintList}
          >
            <IconPrinter size={15} />
            Yazdır
          </Button>
        </Card.Header>

        <Card.Body className="p-0">
          {isLoading ? (
            <div className="p-5 text-center text-muted">
              <Spinner animation="border" size="sm" className="me-2 text-primary" />
              Hareketler yükleniyor...
            </div>
          ) : hareketList.length === 0 ? (
            <div className="p-5 text-center text-muted">
              <IconCoins size={36} className="text-secondary opacity-40 mb-2" />
              <p className="fw-semibold text-dark mb-1">Kayıt Bulunamadı</p>
              <p className="small text-muted mb-0">Belirtilen kriterlere uygun cari hareket kaydı bulunamadı.</p>
            </div>
          ) : (
            <div className="table-responsive">
              <Table hover size="sm" className="mb-0 align-middle">
                <thead className="table-light">
                  <tr>
                    <th style={{ width: "35px" }} className="text-center py-2"></th>
                    <th style={{ width: "80px" }} className="py-2">Fiş No</th>
                    <th style={{ width: "100px" }} className="py-2">Tarih</th>
                    <th className="py-2">Cari Kart</th>
                    <th style={{ width: "80px" }} className="py-2">Vezne</th>
                    <th style={{ width: "100px" }} className="py-2">Hareket Tipi</th>
                    <th style={{ width: "90px" }} className="text-center py-2">İşlem</th>
                    <th className="py-2">Açıklama</th>
                    <th className="py-2">Satırlar Özeti</th>
                    <th style={{ width: "120px" }} className="text-center py-2">İşlemler</th>
                  </tr>
                </thead>
                <tbody>
                  {hareketList.map((item) => {
                    const isExpanded = expandedRows.has(item.id);
                    return (
                      <React.Fragment key={item.id}>
                        <tr
                          onClick={() => toggleRowExpand(item.id)}
                          style={{ cursor: "pointer" }}
                          className={isExpanded ? "table-active" : ""}
                        >
                          <td className="text-center text-muted py-2">
                            {isExpanded ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
                          </td>
                          <td className="py-2 font-monospace fw-bold text-dark">
                            #{item.id}
                          </td>
                          <td className="py-2 small">
                            {item.tarih ? new Date(item.tarih).toLocaleDateString("tr-TR") : "-"}
                          </td>
                          <td className="py-2">
                            <div className="fw-semibold text-dark">{item.cariAd}</div>
                            <div className="small text-muted font-monospace">{item.cariKod}</div>
                          </td>
                          <td className="py-2 font-monospace small">
                            {item.vezneKod || "-"}
                          </td>
                          <td className="py-2 small">
                            <Badge bg="light" text="dark" className="border">
                              {item.hareketTipiLabel}
                            </Badge>
                          </td>
                          <td className="text-center py-2">
                            <Badge bg={item.tip === 0 ? "danger" : "success"} className="px-2.5 py-1">
                              {item.tipLabel}
                            </Badge>
                          </td>
                          <td className="py-2 small text-truncate" style={{ maxWidth: "160px" }}>
                            {item.aciklama || "-"}
                          </td>
                          <td className="py-2 font-monospace small">
                            {item.satirlarOzet || "-"}
                          </td>
                          <td className="text-center py-2">
                            <div className="d-flex align-items-center justify-content-center gap-1">
                              <Button
                                size="sm"
                                variant="outline-primary"
                                className="py-0.5 px-1.5"
                                onClick={(e) => handleEditClick(item.id, e)}
                                title="Düzelt / Görüntüle"
                              >
                                <IconEdit size={14} />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline-secondary"
                                className="py-0.5 px-1.5"
                                onClick={(e) => handlePrintItem(item, e)}
                                title="Makbuz Yazdır"
                              >
                                <IconPrinter size={14} />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline-danger"
                                className="py-0.5 px-1.5"
                                onClick={(e) => handleDeleteClick(item, e)}
                                title="Sil"
                              >
                                <IconTrash size={14} />
                              </Button>
                            </div>
                          </td>
                        </tr>

                        {/* Collapsible Row Detail */}
                        {isExpanded && (
                          <tr>
                            <td colSpan={10} className="p-3 bg-light border-bottom">
                              <div className="border rounded bg-white p-3 shadow-2xs">
                                <div className="d-flex align-items-center justify-content-between mb-2">
                                  <span className="fw-bold small text-dark d-flex align-items-center gap-1.5">
                                    <IconCoins size={16} className="text-primary" />
                                    Fiş Satır Detayları (#{item.id})
                                  </span>
                                  <span className="small text-muted">
                                    Ekleyen: Kullanıcı #{item.ekleyenId} | Tarih:{" "}
                                    {item.eklemeZamani ? new Date(item.eklemeZamani).toLocaleString("tr-TR") : "-"}
                                  </span>
                                </div>

                                <Table size="sm" bordered hover className="mb-0 align-middle">
                                  <thead style={{ backgroundColor: "#f1f5f9" }}>
                                    <tr>
                                      <th style={{ width: "40px" }} className="text-center small py-1">#</th>
                                      <th className="small py-1">Para Birimi / SMB</th>
                                      <th className="small py-1">Açıklama</th>
                                      <th className="small py-1 text-end">Meblağ / Miktar</th>
                                      <th className="small py-1 text-center">İşlem Tipi</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {item.satirlar.map((s, sIdx) => (
                                      <tr key={sIdx}>
                                        <td className="text-center small py-1">{s.satirNo}</td>
                                        <td className="font-monospace fw-bold small py-1">{s.paraKodu}</td>
                                        <td className="small py-1 text-muted">{s.paraAdi || "-"}</td>
                                        <td className="font-monospace fw-bold text-end small py-1">
                                          {new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2 }).format(
                                            s.meblag
                                          )}
                                        </td>
                                        <td className="text-center small py-1">
                                          <Badge bg={item.tip === 0 ? "danger" : "success"}>
                                            {item.tipLabel}
                                          </Badge>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </Table>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </Table>
            </div>
          )}
        </Card.Body>

        <Card.Footer className="bg-light py-2 px-3 d-flex align-items-center justify-content-between small text-muted">
          <span>Toplam {hareketList.length} kayıt listelendi</span>
          <span>Likya Kuyumculuk ERP</span>
        </Card.Footer>
      </Card>

      {/* Delete Confirm Modal */}
      <Modal show={!!itemToDelete} onHide={() => setItemToDelete(null)} centered size="sm">
        <Modal.Header closeButton className="py-2.5 bg-light">
          <Modal.Title className="fs-6 fw-bold text-danger d-flex align-items-center gap-2">
            <IconTrash size={18} />
            Hareketi Sil
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="py-3 text-center">
          <p className="mb-1">
            <strong>#{itemToDelete?.id}</strong> numaralı cari hareket kaydını silmek istediğinize emin misiniz?
          </p>
          <small className="text-muted">Bu işlem cari bakiyesini doğrudan güncelleyecektir.</small>
        </Modal.Body>
        <Modal.Footer className="py-2 bg-light d-flex justify-content-between">
          <Button variant="secondary" size="sm" onClick={() => setItemToDelete(null)}>
            İptal
          </Button>
          <Button variant="danger" size="sm" onClick={handleConfirmDelete} disabled={isDeleting}>
            {isDeleting ? "Siliniyor..." : "Evet, Sil"}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default CariHareketListPage;
