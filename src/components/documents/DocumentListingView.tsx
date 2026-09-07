import React, { useState } from "react";
import {
  Card,
  Form,
  Button,
  Table,
  Badge,
  Modal,
  Alert,
  Row,
  Col,
} from "react-bootstrap";
import {
  IconRotate,
  IconSend,
  IconMail,
  IconArrowsSort,
  IconCheck,
  IconSearch,
} from "@tabler/icons-react";

interface DocumentItem {
  id: string;
  docNo: string;
  date: string;
  title: string;
  amount: number;
  docType: string;
  errorDesc: string;
  isSent: boolean;
}

const initialDocuments: DocumentItem[] = [
  {
    id: "1",
    docNo: "EMA2026000000005",
    date: "16.07.2026",
    title: "İBRAHİM KARAGÜL",
    amount: 5500.0,
    docType: "e-Arşiv",
    errorDesc: "",
    isSent: false,
  },
  {
    id: "2",
    docNo: "EMA2026000000006",
    date: "15.07.2026",
    title: "AHMET YILMAZ KUYUMCULUK",
    amount: 12850.0,
    docType: "e-Fatura",
    errorDesc: "",
    isSent: false,
  },
  {
    id: "3",
    docNo: "EMA2026000000007",
    date: "14.07.2026",
    title: "MEHMET DEMİR MÜCEVHERAT",
    amount: 3200.0,
    docType: "e-Arşiv",
    errorDesc: "",
    isSent: false,
  },
  {
    id: "4",
    docNo: "EMA2026000000008",
    date: "12.07.2026",
    title: "GÜNEŞ ALTIN TİCARET",
    amount: 45750.0,
    docType: "e-Fatura",
    errorDesc: "",
    isSent: true,
  },
  {
    id: "5",
    docNo: "EMA2026000000009",
    date: "10.07.2026",
    title: "SARRAF ALİ VE ORTAKLARI",
    amount: 8900.0,
    docType: "e-Arşiv",
    errorDesc: "",
    isSent: false,
  },
];

interface DocumentListingViewProps {
  pageTitle?: string;
}

export const DocumentListingView: React.FC<DocumentListingViewProps> = ({
  pageTitle = "Belge Listesi",
}) => {
  const [documents, setDocuments] = useState<DocumentItem[]>(initialDocuments);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [pageSize, setPageSize] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Filters State
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [startNo, setStartNo] = useState("");
  const [endNo, setEndNo] = useState("");
  const [statusFilter, setStatusFilter] = useState("Hazır");
  const [docTypeFilter, setDocTypeFilter] = useState("E-Arşiv Faturası");

  // Notification / Feedback State
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const [showMailModal, setShowMailModal] = useState(false);
  const [mailRecipient, setMailRecipient] = useState("");

  // Toggle Single Selection
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Toggle Select All
  const toggleSelectAll = () => {
    if (selectedIds.length === documents.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(documents.map((d) => d.id));
    }
  };

  // Mark as Sent Action
  const handleMarkAsSent = (id: string) => {
    setDocuments((prev) =>
      prev.map((doc) => (doc.id === id ? { ...doc, isSent: true } : doc))
    );
    setAlertMessage("Belge başarıyla 'Gönderildi' olarak işaretlendi.");
    setTimeout(() => setAlertMessage(null), 3000);
  };

  // Batch Send Selected
  const handleSendSelected = () => {
    if (selectedIds.length === 0) {
      alert("Lütfen gönderilecek en az bir belge seçiniz.");
      return;
    }
    setDocuments((prev) =>
      prev.map((doc) =>
        selectedIds.includes(doc.id) ? { ...doc, isSent: true } : doc
      )
    );
    setAlertMessage(`${selectedIds.length} adet belge başarıyla gönderildi.`);
    setSelectedIds([]);
    setTimeout(() => setAlertMessage(null), 3500);
  };

  // Send All
  const handleSendAll = () => {
    setDocuments((prev) => prev.map((doc) => ({ ...doc, isSent: true })));
    setAlertMessage("Listedeki tüm belgeler başarıyla gönderildi.");
    setSelectedIds([]);
    setTimeout(() => setAlertMessage(null), 3500);
  };

  // Refresh
  const handleRefresh = () => {
    setDocuments(initialDocuments);
    setSelectedIds([]);
    setAlertMessage("Belge listesi güncellendi.");
    setTimeout(() => setAlertMessage(null), 2500);
  };

  // Send as Mail
  const handleSendMail = () => {
    if (selectedIds.length === 0) {
      alert("Lütfen e-posta ile gönderilecek belgeleri seçiniz.");
      return;
    }
    setShowMailModal(true);
  };

  const submitMail = (e: React.FormEvent) => {
    e.preventDefault();
    setShowMailModal(false);
    setAlertMessage(
      `Seçilen ${selectedIds.length} adet belge ${mailRecipient} adresine başarıyla iletildi.`
    );
    setMailRecipient("");
    setTimeout(() => setAlertMessage(null), 4000);
  };

  return (
    <div className="document-listing-view pb-4">
      {/* Alert feedback */}
      {alertMessage && (
        <Alert
          variant="success"
          dismissible
          onClose={() => setAlertMessage(null)}
          className="d-flex align-items-center gap-2 py-2 mb-3"
        >
          <IconCheck size={20} />
          <span>{alertMessage}</span>
        </Alert>
      )}

      {/* 1. Filter Panel (Fully Responsive & Clean) */}
      <Card className="border-0 shadow-sm rounded-3 mb-3 bg-white">
        <Card.Body className="p-3 p-md-4">
          <Row className="g-3">
            {/* İlk Tarih */}
            <Col xs={12} sm={6} md={4} lg={2}>
              <Form.Group>
                <Form.Label className="text-secondary small fw-medium mb-1">
                  İlk Tarih
                </Form.Label>
                <Form.Control
                  type="date"
                  size="sm"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-light border custom-date-input"
                  style={{ cursor: "pointer", minHeight: "36px" }}
                />
              </Form.Group>
            </Col>

            {/* Son Tarih */}
            <Col xs={12} sm={6} md={4} lg={2}>
              <Form.Group>
                <Form.Label className="text-secondary small fw-medium mb-1">
                  Son Tarih
                </Form.Label>
                <Form.Control
                  type="date"
                  size="sm"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-light border custom-date-input"
                  style={{ cursor: "pointer", minHeight: "36px" }}
                />
              </Form.Group>
            </Col>

            {/* İlk No */}
            <Col xs={12} sm={6} md={4} lg={2}>
              <Form.Group>
                <Form.Label className="text-secondary small fw-medium mb-1">
                  İlk No
                </Form.Label>
                <Form.Control
                  type="text"
                  size="sm"
                  placeholder="Başlangıç No"
                  value={startNo}
                  onChange={(e) => setStartNo(e.target.value)}
                  className="bg-light border"
                  style={{ minHeight: "36px" }}
                />
              </Form.Group>
            </Col>

            {/* Son No */}
            <Col xs={12} sm={6} md={4} lg={2}>
              <Form.Group>
                <Form.Label className="text-secondary small fw-medium mb-1">
                  Son No
                </Form.Label>
                <Form.Control
                  type="text"
                  size="sm"
                  placeholder="Bitiş No"
                  value={endNo}
                  onChange={(e) => setEndNo(e.target.value)}
                  className="bg-light border"
                  style={{ minHeight: "36px" }}
                />
              </Form.Group>
            </Col>

            {/* Durum Select */}
            <Col xs={12} sm={6} md={4} lg={1}>
              <Form.Group>
                <Form.Label className="text-secondary small fw-medium mb-1">
                  Durum
                </Form.Label>
                <Form.Select
                  size="sm"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-light border"
                  style={{ minHeight: "36px" }}
                >
                  <option value="Hazır">Hazır</option>
                  <option value="Gönderildi">Gönderildi</option>
                  <option value="Hatalı">Hatalı</option>
                  <option value="Tümü">Tümü</option>
                </Form.Select>
              </Form.Group>
            </Col>

            {/* Belge Türü Select */}
            <Col xs={12} sm={6} md={4} lg={2}>
              <Form.Group>
                <Form.Label className="text-secondary small fw-medium mb-1">
                  Belge Türü
                </Form.Label>
                <Form.Select
                  size="sm"
                  value={docTypeFilter}
                  onChange={(e) => setDocTypeFilter(e.target.value)}
                  className="bg-light border"
                  style={{ minHeight: "36px" }}
                >
                  <option value="E-Arşiv Faturası">E-Arşiv Faturası</option>
                  <option value="E-Fatura">E-Fatura</option>
                  <option value="Müstahsil Makbuzu">Müstahsil Makbuzu</option>
                  <option value="Gider Pusulası">Gider Pusulası</option>
                  <option value="Toptan Satış Faturası">Toptan Satış Faturası</option>
                </Form.Select>
              </Form.Group>
            </Col>

            {/* Listele Butonu */}
            <Col xs={12} sm={12} md={4} lg={1} className="d-flex align-items-end">
              <Button
                variant="primary"
                size="sm"
                className="w-100 fw-semibold text-white shadow-sm d-flex align-items-center justify-content-center gap-1"
                style={{ backgroundColor: "#0ea5e9", borderColor: "#0ea5e9", minHeight: "36px" }}
                onClick={handleRefresh}
              >
                <IconSearch size={16} /> Listele
              </Button>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* 2. Table Section */}
      <Card className="border-0 shadow-sm rounded-3 bg-white">
        <Card.Body className="p-3 p-md-4">
          {/* Sayfada Göster Kontrolü */}
          <div className="d-flex align-items-center gap-2 mb-3">
            <span className="text-secondary small">Sayfada</span>
            <Form.Select
              size="sm"
              style={{ width: "75px", minHeight: "32px" }}
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="bg-light border text-center"
            >
              <option value="10">10</option>
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </Form.Select>
            <span className="text-secondary small">kayıt göster</span>
          </div>

          {/* Table Element with responsive scroll */}
          <div className="table-responsive" style={{ minHeight: "220px" }}>
            <Table hover className="align-middle mb-0 custom-document-table">
              <thead className="bg-light">
                <tr>
                  <th style={{ width: "110px" }} className="text-center">
                    <Button
                      variant="info"
                      size="sm"
                      onClick={toggleSelectAll}
                      className="text-white text-nowrap py-1 px-2 fw-semibold"
                      style={{ backgroundColor: "#0ea5e9", borderColor: "#0ea5e9", fontSize: "11px" }}
                    >
                      {selectedIds.length === documents.length ? "Kaldır" : "Tümünü Seç"}
                    </Button>
                  </th>
                  <th>
                    <div className="d-flex align-items-center gap-1 text-nowrap">
                      <span>E-Belge No</span>
                      <IconArrowsSort size={14} className="text-muted" />
                    </div>
                  </th>
                  <th>
                    <div className="d-flex align-items-center gap-1 text-nowrap">
                      <span>Tarih</span>
                      <IconArrowsSort size={14} className="text-muted" />
                    </div>
                  </th>
                  <th>
                    <div className="d-flex align-items-center gap-1 text-nowrap">
                      <span>Ünvan</span>
                      <IconArrowsSort size={14} className="text-muted" />
                    </div>
                  </th>
                  <th>
                    <div className="d-flex align-items-center gap-1 text-nowrap">
                      <span>Tutar</span>
                      <IconArrowsSort size={14} className="text-muted" />
                    </div>
                  </th>
                  <th>
                    <div className="d-flex align-items-center gap-1 text-nowrap">
                      <span>E-Belge</span>
                      <IconArrowsSort size={14} className="text-muted" />
                    </div>
                  </th>
                  <th>
                    <div className="d-flex align-items-center gap-1 text-nowrap">
                      <span>Hata Açıklaması</span>
                      <IconArrowsSort size={14} className="text-muted" />
                    </div>
                  </th>
                  <th className="text-center">
                    <div className="d-flex align-items-center justify-content-center gap-1 text-nowrap">
                      <span>Gönderildi Olarak İşaretle</span>
                      <IconArrowsSort size={14} className="text-muted" />
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {documents.map((doc) => {
                  const isChecked = selectedIds.includes(doc.id);
                  return (
                    <tr key={doc.id} className={isChecked ? "table-active" : ""}>
                      <td className="text-center">
                        <Form.Check
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleSelect(doc.id)}
                          className="cursor-pointer d-inline-block"
                        />
                      </td>
                      <td>
                        <a
                          href="#view"
                          onClick={(e) => {
                            e.preventDefault();
                            alert(`Belge detayı: ${doc.docNo}`);
                          }}
                          className="fw-semibold text-decoration-none text-nowrap"
                          style={{ color: "#0284c7" }}
                        >
                          {doc.docNo}
                        </a>
                      </td>
                      <td className="text-secondary text-nowrap">{doc.date}</td>
                      <td>
                        <span className="fw-medium text-dark">{doc.title}</span>
                      </td>
                      <td className="fw-semibold text-nowrap">
                        {doc.amount.toLocaleString("tr-TR", {
                          minimumFractionDigits: 2,
                        })}{" "}
                        ₺
                      </td>
                      <td>
                        <Badge bg="light" className="text-dark border px-2 py-1">
                          {doc.docType}
                        </Badge>
                      </td>
                      <td className="text-muted small">
                        {doc.errorDesc || "—"}
                      </td>
                      <td className="text-center text-nowrap">
                        {doc.isSent ? (
                          <Badge bg="success-subtle" className="text-success border border-success px-2 py-1">
                            <IconCheck size={14} className="me-1" /> Gönderildi
                          </Badge>
                        ) : (
                          <Button
                            size="sm"
                            className="px-3 py-1 fw-semibold text-white shadow-sm"
                            style={{ backgroundColor: "#0d9488", borderColor: "#0d9488", fontSize: "12px" }}
                            onClick={() => handleMarkAsSent(doc.id)}
                          >
                            İşaretle
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </div>

          {/* 3. Table Footer: Entries info & Pagination */}
          <div className="d-flex flex-column flex-sm-row justify-content-between align-items-center gap-3 pt-3 border-top mt-2">
            <div className="text-secondary small text-center text-sm-start">
              {documents.length} kayıttan 1 - {documents.length} arasındaki kayıtlar gösteriliyor
            </div>
            <div className="d-flex align-items-center gap-1">
              <Button variant="outline-secondary" size="sm" disabled className="px-2 py-1 text-muted">
                Önceki
              </Button>
              <Button
                variant="primary"
                size="sm"
                className="px-3 py-1 fw-bold text-white"
                style={{ backgroundColor: "#0ea5e9", borderColor: "#0ea5e9" }}
              >
                1
              </Button>
              <Button variant="outline-secondary" size="sm" disabled className="px-2 py-1 text-muted">
                Sonraki
              </Button>
            </div>
          </div>

          {/* 4. Bottom Action Buttons (Responsive Wrapping) */}
          <div className="d-flex flex-wrap align-items-center gap-2 pt-3 mt-3 border-top">
            {/* Gönder */}
            <Button
              size="sm"
              className="px-3 py-2 fw-semibold text-white d-flex align-items-center gap-1 shadow-sm"
              style={{ backgroundColor: "#0d9488", borderColor: "#0d9488" }}
              onClick={handleSendSelected}
            >
              <IconSend size={16} /> Gönder
            </Button>

            {/* Tümünü Gönder */}
            <Button
              size="sm"
              className="px-3 py-2 fw-semibold text-white d-flex align-items-center gap-1 shadow-sm"
              style={{ backgroundColor: "#0ea5e9", borderColor: "#0ea5e9" }}
              onClick={handleSendAll}
            >
              <IconSend size={16} /> Tümünü Gönder
            </Button>

            {/* Yenile */}
            <Button
              size="sm"
              className="px-3 py-2 fw-semibold text-white d-flex align-items-center gap-1 shadow-sm"
              style={{ backgroundColor: "#06b6d4", borderColor: "#06b6d4" }}
              onClick={handleRefresh}
            >
              <IconRotate size={16} /> Yenile
            </Button>

            {/* Mail Olarak Gönder */}
            <Button
              variant="outline-secondary"
              size="sm"
              className="px-3 py-2 fw-medium bg-white d-flex align-items-center gap-1 text-dark"
              onClick={handleSendMail}
            >
              <IconMail size={16} /> Mail Olarak Gönder
            </Button>
          </div>
        </Card.Body>
      </Card>

      {/* Modal for Mail Sending */}
      <Modal show={showMailModal} onHide={() => setShowMailModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title className="fs-6 fw-bold">Belgeleri E-Posta İle Gönder</Modal.Title>
        </Modal.Header>
        <Form onSubmit={submitMail}>
          <Modal.Body>
            <p className="text-secondary small mb-3">
              Seçili olan <strong>{selectedIds.length}</strong> adet belge PDF olarak aşağıdaki adrese gönderilecektir.
            </p>
            <Form.Group className="mb-3">
              <Form.Label className="small fw-semibold">Alıcı E-Posta Adresi</Form.Label>
              <Form.Control
                type="email"
                required
                placeholder="ornek@musteri.com"
                value={mailRecipient}
                onChange={(e) => setMailRecipient(e.target.value)}
              />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" size="sm" onClick={() => setShowMailModal(false)}>
              İptal
            </Button>
            <Button
              variant="primary"
              size="sm"
              type="submit"
              className="text-white"
              style={{ backgroundColor: "#0ea5e9", borderColor: "#0ea5e9" }}
            >
              Gönder
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </div>
  );
};

export default DocumentListingView;
