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
  Modal,
} from "react-bootstrap";
import {
  IconSearch,
  IconReceipt,
  IconEdit,
  IconPrinter,
  IconEye,
  IconFileText,
  IconCash,
  IconArrowUpRight,
  IconArrowDownLeft,
} from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";
import ERPToolbar from "../../components/common/ERPToolbar";
import { PerakendeService, PerakendeFaturaModel } from "../../services/perakendeService";
import { printReportTable, PrintColumn } from "../../utils/printReport";
import { PerakendeFisiPrintModal } from "../vezne/PerakendeFisiPrintModal";

export const SatisListesiPage: React.FC = () => {
  const navigate = useNavigate();

  const [invoices, setInvoices] = useState<PerakendeFaturaModel[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filtreler
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedType, setSelectedType] = useState<string>("all"); // all, 1 (Satis), 2 (Iade)
  const [selectedVezne, setSelectedVezne] = useState<string>("all");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  // Detay Modal Durumu
  const [selectedInvoice, setSelectedInvoice] = useState<PerakendeFaturaModel | null>(null);
  const [showDetailModal, setShowDetailModal] = useState<boolean>(false);
  const [showPrintModal, setShowPrintModal] = useState<boolean>(false);

  const loadData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const list = await PerakendeService.listInvoices({
        baslangicTarihi: startDate || undefined,
        bitisTarihi: endDate || undefined,
      });
      setInvoices(list || []);
    } catch (err: any) {
      setError(err.message || "Satış listesi alınırken bir hata oluştu.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [startDate, endDate, selectedType]);

  // Vezneler listesi
  const uniqueVezneler = useMemo(() => {
    const set = new Set<string>();
    invoices.forEach((inv) => {
      if (inv.vezneAd || inv.vezneKod) set.add(inv.vezneAd || inv.vezneKod || "");
    });
    return Array.from(set).filter(Boolean).sort();
  }, [invoices]);

  // Filtrelenmiş liste
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      if (selectedVezne !== "all" && (inv.vezneAd !== selectedVezne && inv.vezneKod !== selectedVezne)) {
        return false;
      }
      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase();
      return (
        inv.faturaNo.toLowerCase().includes(term) ||
        (inv.aliciUnvan && inv.aliciUnvan.toLowerCase().includes(term)) ||
        (inv.aliciVknTckn && inv.aliciVknTckn.includes(term)) ||
        (inv.cariUnvan && inv.cariUnvan.toLowerCase().includes(term)) ||
        (inv.cariKod && inv.cariKod.toLowerCase().includes(term))
      );
    });
  }, [invoices, selectedVezne, searchTerm]);

  // Özet Toplamlar
  const summary = useMemo(() => {
    let satisToplam = 0;
    let iadeToplam = 0;
    let satisAdet = 0;
    let iadeAdet = 0;

    filteredInvoices.forEach((inv) => {
      if (inv.faturaTipi === 2) {
        iadeToplam += inv.genelToplam || 0;
        iadeAdet++;
      } else {
        satisToplam += inv.genelToplam || 0;
        satisAdet++;
      }
    });

    return {
      toplamAdet: filteredInvoices.length,
      satisAdet,
      iadeAdet,
      satisToplam,
      iadeToplam,
      netToplam: satisToplam - iadeToplam,
    };
  }, [filteredInvoices]);

  const handlePrint = () => {
    const columns: PrintColumn<PerakendeFaturaModel>[] = [
      { header: "Fatura / Fiş No", key: "faturaNo" },
      { header: "Tarih", render: (item) => (item.tarih ? new Date(item.tarih).toLocaleDateString("tr-TR") : "-") },
      { header: "İşlem Türü", render: (item) => (item.faturaTipi === 2 ? "İade Fişi" : "Satış Fişi") },
      { header: "Müşteri / Cari", key: "aliciUnvan" },
      { header: "TCKN / VKN", key: "aliciVknTckn" },
      { header: "Vezne", key: "vezneAd" },
      { header: "Ara Toplam", render: (item) => Number(item.araToplam || 0).toLocaleString("tr-TR", { minimumFractionDigits: 2 }) },
      { header: "KDV Tutarı", render: (item) => Number(item.toplamKdv || 0).toLocaleString("tr-TR", { minimumFractionDigits: 2 }) },
      { header: "Genel Toplam", render: (item) => `${Number(item.genelToplam || 0).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ${item.paraKodu || "TL"}` },
    ];

    printReportTable({
      title: "Perakende Satış & İade Fişleri Listesi",
      subtitle: `Toplam ${filteredInvoices.length} fatura/fiş listelenmiştir.`,
      columns,
      data: filteredInvoices,
    });
  };

  const handleNew = () => {
    navigate("/vezne/perakende-fisi-kayit");
  };

  const handleEdit = (inv: PerakendeFaturaModel) => {
    navigate(`/vezne/perakende-fisi-duzeltme?no=${encodeURIComponent(inv.faturaNo)}`);
  };

  const handleOpenDetail = (inv: PerakendeFaturaModel) => {
    setSelectedInvoice(inv);
    setShowDetailModal(true);
  };

  const handleDirectPrintInvoice = (inv: PerakendeFaturaModel) => {
    setSelectedInvoice(inv);
    setShowPrintModal(true);
  };

  return (
    <div className="container-fluid p-2">
      <ERPToolbar
        pageTitle="F- Satış Listesi"
        pageIcon={<IconReceipt size={20} />}
        onNew={handleNew}
        onRefresh={loadData}
        onPrint={handlePrint}
        hideSave={true}
        hideDelete={true}
      />

      {error && (
        <Alert variant="danger" dismissible onClose={() => setError(null)} className="py-2 mb-2">
          {error}
        </Alert>
      )}

      {/* İstatistik Kartları */}
      <Row className="g-2 mb-2">
        <Col xs={12} sm={6} md={3}>
          <Card className="border-0 shadow-xs bg-primary bg-opacity-10 h-100">
            <Card.Body className="p-2.5 d-flex align-items-center justify-content-between">
              <div>
                <div className="text-muted small fw-semibold">Toplam Fiş / Fatura</div>
                <div className="fs-5 fw-bold text-primary">{summary.toplamAdet} Adet</div>
              </div>
              <div className="p-2 bg-primary text-white rounded-3">
                <IconFileText size={22} />
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col xs={12} sm={6} md={3}>
          <Card className="border-0 shadow-xs bg-success bg-opacity-10 h-100">
            <Card.Body className="p-2.5 d-flex align-items-center justify-content-between">
              <div>
                <div className="text-muted small fw-semibold">Toplam Satış Tutarı</div>
                <div className="fs-5 fw-bold text-success">
                  {summary.satisToplam.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL
                </div>
              </div>
              <div className="p-2 bg-success text-white rounded-3">
                <IconArrowUpRight size={22} />
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col xs={12} sm={6} md={3}>
          <Card className="border-0 shadow-xs bg-danger bg-opacity-10 h-100">
            <Card.Body className="p-2.5 d-flex align-items-center justify-content-between">
              <div>
                <div className="text-muted small fw-semibold">Toplam İade Tutarı</div>
                <div className="fs-5 fw-bold text-danger">
                  {summary.iadeToplam.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL
                </div>
              </div>
              <div className="p-2 bg-danger text-white rounded-3">
                <IconArrowDownLeft size={22} />
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col xs={12} sm={6} md={3}>
          <Card className="border-0 shadow-xs bg-dark bg-opacity-10 h-100">
            <Card.Body className="p-2.5 d-flex align-items-center justify-content-between">
              <div>
                <div className="text-muted small fw-semibold">Net Perakende Cirosu</div>
                <div className="fs-5 fw-bold text-dark">
                  {summary.netToplam.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL
                </div>
              </div>
              <div className="p-2 bg-dark text-white rounded-3">
                <IconCash size={22} />
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Filtre ve Arama Alanı */}
      <Card className="border shadow-xs mb-2">
        <Card.Body className="p-2">
          <Row className="g-2 align-items-center">
            <Col xs={12} sm={6} md={2}>
              <Form.Group>
                <Form.Label className="small text-muted mb-1 fw-bold">İşlem Türü</Form.Label>
                <Form.Select
                  size="sm"
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                >
                  <option value="all">Tüm İşlemler</option>
                  <option value="1">Satış Fişleri</option>
                  <option value="2">İade Fişleri</option>
                </Form.Select>
              </Form.Group>
            </Col>

            <Col xs={12} sm={6} md={2}>
              <Form.Group>
                <Form.Label className="small text-muted mb-1 fw-bold">Vezne</Form.Label>
                <Form.Select
                  size="sm"
                  value={selectedVezne}
                  onChange={(e) => setSelectedVezne(e.target.value)}
                >
                  <option value="all">Tüm Vezneler</option>
                  {uniqueVezneler.map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>

            <Col xs={6} sm={3} md={2}>
              <Form.Group>
                <Form.Label className="small text-muted mb-1 fw-bold">Başlangıç Tarihi</Form.Label>
                <Form.Control
                  type="date"
                  size="sm"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </Form.Group>
            </Col>

            <Col xs={6} sm={3} md={2}>
              <Form.Group>
                <Form.Label className="small text-muted mb-1 fw-bold">Bitiş Tarihi</Form.Label>
                <Form.Control
                  type="date"
                  size="sm"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </Form.Group>
            </Col>

            <Col xs={12} sm={6} md={4}>
              <Form.Group>
                <Form.Label className="small text-muted mb-1 fw-bold">Hızlı Arama</Form.Label>
                <InputGroup size="sm">
                  <InputGroup.Text className="bg-light">
                    <IconSearch size={16} />
                  </InputGroup.Text>
                  <Form.Control
                    placeholder="Fatura No, Müşteri Adı, TCKN / VKN ara..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  {searchTerm && (
                    <Button variant="outline-secondary" onClick={() => setSearchTerm("")}>
                      Temizle
                    </Button>
                  )}
                </InputGroup>
              </Form.Group>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* Tablo */}
      <Card className="border shadow-xs">
        <div className="table-responsive" style={{ maxHeight: "calc(100vh - 350px)", minHeight: "300px" }}>
          <Table hover striped bordered size="sm" className="align-middle mb-0 text-nowrap">
            <thead className="table-light sticky-top">
              <tr className="small text-secondary">
                <th style={{ width: "40px" }} className="text-center">#</th>
                <th style={{ width: "130px" }}>Fatura / Fiş No</th>
                <th>Tarih</th>
                <th>Tür</th>
                <th>Müşteri / Cari Ünvan</th>
                <th>TCKN / VKN</th>
                <th>Vezne</th>
                <th className="text-center">Kalem</th>
                <th className="text-end">Ara Toplam</th>
                <th className="text-end">KDV Tutarı</th>
                <th className="text-end">Genel Toplam</th>
                <th className="text-center">e-Belge</th>
                <th style={{ width: "110px" }} className="text-center">İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={13} className="text-center py-5">
                    <Spinner animation="border" size="sm" variant="primary" className="me-2" />
                    Satış listesi yükleniyor...
                  </td>
                </tr>
              ) : filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={13} className="text-center py-5 text-muted">
                    Seçilen filtre kriterlerine uygun satış/iade kaydı bulunamadı.
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv, idx) => (
                  <tr
                    key={inv.faturaId || idx}
                    onDoubleClick={() => handleOpenDetail(inv)}
                    style={{ cursor: "pointer" }}
                  >
                    <td className="text-center text-muted small">{idx + 1}</td>
                    <td className="fw-bold font-monospace text-primary">{inv.faturaNo}</td>
                    <td className="small text-muted">
                      {inv.tarih ? new Date(inv.tarih).toLocaleDateString("tr-TR") : "-"}
                    </td>
                    <td>
                      {inv.faturaTipi === 2 ? (
                        <Badge bg="danger" className="fw-semibold">İade</Badge>
                      ) : (
                        <Badge bg="success" className="fw-semibold">Satış</Badge>
                      )}
                    </td>
                    <td className="fw-semibold text-truncate" style={{ maxWidth: "220px" }} title={inv.aliciUnvan || ""}>
                      {inv.aliciUnvan || inv.cariUnvan || "Perakende Müşteri"}
                    </td>
                    <td className="font-monospace small">{inv.aliciVknTckn || "-"}</td>
                    <td>
                      <Badge bg="light" text="dark" className="border">
                        {inv.vezneAd || inv.vezneKod || "Vezne"}
                      </Badge>
                    </td>
                    <td className="text-center fw-bold">{(inv.satirlar || []).length || 1}</td>
                    <td className="text-end small">
                      {Number(inv.araToplam || 0).toLocaleString("tr-TR", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="text-end small text-muted">
                      {Number(inv.toplamKdv || 0).toLocaleString("tr-TR", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="text-end fw-bold text-dark">
                      {Number(inv.genelToplam || 0).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} {inv.paraKodu || "TL"}
                    </td>
                    <td className="text-center">
                      <Badge bg="info" className="fw-normal text-white">e-Arşiv</Badge>
                    </td>
                    <td className="text-center">
                      <div className="btn-group btn-group-sm">
                        <Button
                          size="sm"
                          variant="outline-primary"
                          className="py-0 px-1.5"
                          title="Detay Görüntüle"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenDetail(inv);
                          }}
                        >
                          <IconEye size={14} />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline-secondary"
                          className="py-0 px-1.5"
                          title="Düzelt"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEdit(inv);
                          }}
                        >
                          <IconEdit size={14} />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline-success"
                          className="py-0 px-1.5"
                          title="Fişi Yazdır"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDirectPrintInvoice(inv);
                          }}
                        >
                          <IconPrinter size={14} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
        </div>
        <Card.Footer className="bg-light py-1.5 px-3 d-flex justify-content-between align-items-center small text-muted">
          <span>Toplam <strong>{filteredInvoices.length}</strong> işlem listeleniyor</span>
          <span>Çift tıklayarak detay ve tahsilat kalemlerini inceleyebilirsiniz</span>
        </Card.Footer>
      </Card>

      {/* Fatura Detay Modal */}
      {selectedInvoice && (
        <Modal show={showDetailModal} onHide={() => setShowDetailModal(false)} size="lg" centered>
          <Modal.Header closeButton className="bg-light py-2 px-3">
            <Modal.Title className="fs-6 fw-bold d-flex align-items-center gap-2">
              <IconReceipt size={18} className="text-primary" />
              Fiş / Fatura Detayı ({selectedInvoice.faturaNo})
            </Modal.Title>
          </Modal.Header>
          <Modal.Body className="p-3">
            {/* Üst Bilgiler */}
            <Row className="g-2 mb-3 bg-light p-2 rounded border">
              <Col xs={6} md={3}>
                <div className="small text-muted">Fatura No:</div>
                <div className="fw-bold font-monospace">{selectedInvoice.faturaNo}</div>
              </Col>
              <Col xs={6} md={3}>
                <div className="small text-muted">Tarih:</div>
                <div className="fw-semibold">
                  {selectedInvoice.tarih ? new Date(selectedInvoice.tarih).toLocaleDateString("tr-TR") : "-"}
                </div>
              </Col>
              <Col xs={12} md={6}>
                <div className="small text-muted">Müşteri / Cari Ünvan:</div>
                <div className="fw-bold">{selectedInvoice.aliciUnvan || selectedInvoice.cariUnvan || "Perakende Müşteri"}</div>
              </Col>
            </Row>

            {/* Kalemler Tablosu */}
            <h6 className="fw-bold text-secondary mb-2 small text-uppercase">Satılan Ürünler / Satırlar</h6>
            <div className="table-responsive border rounded mb-3">
              <Table size="sm" className="mb-0 align-middle">
                <thead className="table-light">
                  <tr className="small">
                    <th>#</th>
                    <th>Barkod</th>
                    <th>Ürün Adı</th>
                    <th>Ayar</th>
                    <th className="text-center">Miktar</th>
                    <th className="text-end">Gram</th>
                    <th className="text-end">Birim Fiyat</th>
                    <th className="text-end">Tutar</th>
                  </tr>
                </thead>
                <tbody>
                  {(selectedInvoice.satirlar || []).map((row, rIdx) => (
                    <tr key={rIdx}>
                      <td>{rIdx + 1}</td>
                      <td className="font-monospace text-primary">{row.barkod || "-"}</td>
                      <td className="fw-semibold">{row.urunAdi}</td>
                      <td>{row.ayar || "-"}</td>
                      <td className="text-center">{row.miktar}</td>
                      <td className="text-end">{Number(row.gram || 0).toFixed(2)}</td>
                      <td className="text-end">{Number(row.birimFiyat || 0).toLocaleString("tr-TR", { minimumFractionDigits: 2 })}</td>
                      <td className="text-end fw-bold">{Number(row.toplamTutar || row.tutar || 0).toLocaleString("tr-TR", { minimumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>

            {/* Ödemeler / Tahsilat Tablosu */}
            <h6 className="fw-bold text-secondary mb-2 small text-uppercase">Tahsilat / Ödeme Kalemleri</h6>
            <div className="table-responsive border rounded mb-2">
              <Table size="sm" className="mb-0 align-middle">
                <thead className="table-light">
                  <tr className="small">
                    <th>#</th>
                    <th>Ödeme Tipi</th>
                    <th className="text-center">Miktar / Adet</th>
                    <th className="text-end">Kur</th>
                    <th className="text-end">Tutar</th>
                  </tr>
                </thead>
                <tbody>
                  {(selectedInvoice.odemeler || []).map((pay, pIdx) => (
                    <tr key={pIdx}>
                      <td>{pIdx + 1}</td>
                      <td className="fw-semibold">{pay.paraKodu || pay.paraAdi || "Nakit"}</td>
                      <td className="text-center">{pay.miktar || pay.adet || 1}</td>
                      <td className="text-end">{Number(pay.kur || 1).toFixed(2)}</td>
                      <td className="text-end fw-bold text-success">{Number(pay.tutar || 0).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} TL</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>

            {/* Genel Toplam Kutusu */}
            <div className="d-flex justify-content-end mt-3">
              <div className="bg-light p-2.5 rounded border text-end" style={{ minWidth: "250px" }}>
                <div className="small text-muted">Genel Toplam:</div>
                <div className="fs-5 fw-bold text-primary">
                  {Number(selectedInvoice.genelToplam || 0).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} {selectedInvoice.paraKodu || "TL"}
                </div>
              </div>
            </div>
          </Modal.Body>
          <Modal.Footer className="bg-light py-2 px-3 d-flex justify-content-between">
            <Button variant="outline-secondary" size="sm" onClick={() => setShowDetailModal(false)}>
              Kapat
            </Button>
            <div className="d-flex gap-2">
              <Button
                variant="outline-primary"
                size="sm"
                onClick={() => {
                  setShowDetailModal(false);
                  handleEdit(selectedInvoice);
                }}
              >
                <IconEdit size={14} className="me-1" />
                Fişi Düzelt
              </Button>
              <Button
                variant="success"
                size="sm"
                onClick={() => {
                  setShowDetailModal(false);
                  handleDirectPrintInvoice(selectedInvoice);
                }}
              >
                <IconPrinter size={14} className="me-1" />
                Fişi Yazdır
              </Button>
            </div>
          </Modal.Footer>
        </Modal>
      )}

      {/* Fiş Yazdırma Modalı */}
      {selectedInvoice && (
        <PerakendeFisiPrintModal
          show={showPrintModal}
          onHide={() => setShowPrintModal(false)}
          fatura={selectedInvoice}
        />
      )}
    </div>
  );
};

export default SatisListesiPage;
