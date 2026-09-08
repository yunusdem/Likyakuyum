import React, { useState } from "react";
import { Container, Row, Col, Card, Button, Badge, Form, InputGroup } from "react-bootstrap";
import {
  IconShieldCheck,
  IconDownload,
  IconExternalLink,
  IconFileSpreadsheet,
  IconSearch,
  IconScale,
  IconAlertTriangle,
  IconCheck,
  IconBuildingBank,
  IconFileText,
} from "@tabler/icons-react";
import ERPToolbar from "components/common/ERPToolbar";
import { MASAK_LISTS } from "data/masakData";

export const MasakListsPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const filteredLists = MASAK_LISTS.filter((item) => {
    if (!searchTerm) return true;
    const s = searchTerm.toLowerCase();
    return (
      item.title.toLowerCase().includes(s) ||
      item.description.toLowerCase().includes(s) ||
      item.code.toLowerCase().includes(s) ||
      item.lawReference.toLowerCase().includes(s)
    );
  });

  const handleCopyLink = (key: string, url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  return (
    <Container fluid className="py-3 px-3 px-lg-4">
      {/* 1. ERP Toolbar */}
      <ERPToolbar
        pageTitle="MASAK Malvarlıkları Dondurulanlar"
        onRefresh={() => window.location.reload()}
        onPrint={() => window.print()}
      />

      {/* 2. Top Info & Stats Banner */}
      <div
        className="rounded-4 p-3 p-md-4 mb-4 text-white position-relative overflow-hidden shadow-sm"
        style={{
          background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
        }}
      >
        <Row className="align-items-center g-3">
          <Col lg={8}>
            <div className="d-flex align-items-center gap-2 mb-2">
              <span
                className="badge bg-danger text-uppercase px-2 py-1"
                style={{ fontSize: "11px", letterSpacing: "0.5px" }}
              >
                MASAK & HMB Resmi Listeleri
              </span>
              <span className="badge bg-secondary text-white" style={{ fontSize: "11px" }}>
                6415 & 7262 Sayılı Kanunlar
              </span>
            </div>
            <h4 className="fw-bold mb-2 text-white">
              Terörizmin ve Kitle İmha Silahlarının Finansmanının Önlenmesi Listeleri
            </h4>
            <p className="mb-0 text-slate-300" style={{ color: "#cbd5e1", fontSize: "13.5px", lineHeight: 1.5 }}>
              Kuyumculuk ve kıymetli maden ticareti yapan işletmelerin, T.C. Hazine ve Maliye Bakanlığı ile MASAK
              mevzuatı uyarınca cari ve vezne işlemlerinde kontrol etmekle yükümlü olduğu güncel resmi Excel listeleridir.
            </p>
          </Col>
          <Col lg={4} className="text-lg-end">
            <div className="d-inline-flex flex-column gap-2 text-start bg-dark bg-opacity-50 p-3 rounded-3 border border-secondary border-opacity-25 w-100 w-lg-auto">
              <div className="d-flex align-items-center justify-content-between gap-3">
                <span className="text-light small">Toplam Liste:</span>
                <span className="badge bg-danger fs-6 px-2 py-0.5">4 Resmi Tablo</span>
              </div>
              <div className="d-flex align-items-center justify-content-between gap-3">
                <span className="text-light small">Yükümlülük Durumu:</span>
                <span className="text-success fw-bold small d-flex align-items-center gap-1">
                  <IconCheck size={14} /> Zorunlu Kontrol
                </span>
              </div>
              <div className="d-flex align-items-center justify-content-between gap-3">
                <span className="text-light small">Resmi Kaynak:</span>
                <span className="text-info small fw-medium">ms.hmb.gov.tr</span>
              </div>
            </div>
          </Col>
        </Row>
      </div>

      {/* 3. Search & Filter Bar */}
      <Card className="border-0 shadow-xs mb-4">
        <Card.Body className="p-3">
          <Row className="g-2 align-items-center">
            <Col md={6} lg={4}>
              <InputGroup size="sm">
                <InputGroup.Text className="bg-light border-end-0">
                  <IconSearch size={16} className="text-muted" />
                </InputGroup.Text>
                <Form.Control
                  type="text"
                  placeholder="Liste adı, kanun maddesi veya anahtar kelime ara..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="border-start-0"
                />
              </InputGroup>
            </Col>
            <Col md={6} lg={8} className="text-md-end text-muted small">
              Gösterilen: <strong>{filteredLists.length}</strong> / {MASAK_LISTS.length} Liste
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* 4. The 4 Official Lists Cards */}
      <Row className="g-3 mb-4">
        {filteredLists.map((item) => (
          <Col xs={12} key={item.key}>
            <Card className="border shadow-xs rounded-3 overflow-hidden h-100">
              <div style={{ height: "4px", backgroundColor: item.accentColor }} />
              <Card.Body className="p-3 p-md-4">
                <div className="d-flex flex-column flex-lg-row align-items-start align-items-lg-center justify-content-between gap-3">
                  <div className="d-flex align-items-start gap-3 flex-grow-1">
                    <div
                      className="d-flex align-items-center justify-content-center rounded-3 fw-bold flex-shrink-0"
                      style={{
                        width: "52px",
                        height: "52px",
                        backgroundColor: item.badgeBg,
                        color: item.badgeText,
                        fontSize: "15px",
                        boxShadow: `0 2px 8px ${item.badgeBg}`,
                      }}
                    >
                      {item.code}
                    </div>

                    <div>
                      <div className="d-flex flex-wrap align-items-center gap-2 mb-1">
                        <h5 className="fw-bold text-dark mb-0" style={{ fontSize: "15.5px" }}>
                          {item.title}
                        </h5>
                        <Badge
                          style={{
                            backgroundColor: item.badgeBg,
                            color: item.badgeText,
                            fontSize: "11px",
                            fontWeight: 600,
                          }}
                        >
                          {item.tag}
                        </Badge>
                      </div>

                      <p className="text-muted mb-2" style={{ fontSize: "13px" }}>
                        {item.description}
                      </p>

                      <div className="d-flex flex-wrap align-items-center gap-2 text-muted small">
                        <span className="badge bg-light text-dark border px-2 py-1">
                          <IconScale size={13} className="me-1 text-secondary" />
                          {item.lawReference}
                        </span>
                        <span className="badge bg-light text-secondary border px-2 py-1">
                          <IconFileSpreadsheet size={13} className="me-1 text-success" />
                          Format: Microsoft Excel (.xlsx)
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="d-flex flex-wrap align-items-center gap-2 flex-shrink-0 w-100 w-lg-auto justify-content-start justify-content-lg-end pt-2 pt-lg-0 border-top border-lg-0">
                    <Button
                      variant="outline-secondary"
                      size="sm"
                      onClick={() => handleCopyLink(item.key, item.url)}
                      className="d-flex align-items-center gap-1"
                      title="İndirme bağlantısını kopyala"
                    >
                      {copiedKey === item.key ? (
                        <>
                          <IconCheck size={15} className="text-success" />
                          <span className="text-success">Kopyalandı</span>
                        </>
                      ) : (
                        <>
                          <IconFileText size={15} />
                          <span>Linki Kopyala</span>
                        </>
                      )}
                    </Button>

                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-sm btn-outline-primary d-flex align-items-center gap-1"
                      title="Yeni sekmede aç"
                    >
                      <IconExternalLink size={15} />
                      <span>Bağlantıyı Aç</span>
                    </a>

                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      download={item.filename}
                      className="btn btn-sm text-white fw-semibold d-flex align-items-center gap-1.5 px-3 py-1.5 shadow-xs"
                      style={{ backgroundColor: item.accentColor, borderColor: item.accentColor }}
                      title="Resmi Excel Dosyasını Doğrudan İndir"
                    >
                      <IconDownload size={16} strokeWidth={2} />
                      <span>Excel Tablosunu İndir (.xlsx)</span>
                    </a>
                  </div>
                </div>
              </Card.Body>
            </Card>
          </Col>
        ))}
      </Row>

      {/* 5. Legal Advisory Guide Card */}
      <Card className="border-0 shadow-xs rounded-3 bg-light">
        <Card.Body className="p-3 p-md-4">
          <div className="d-flex align-items-center gap-2 mb-3">
            <IconAlertTriangle size={20} className="text-danger" />
            <h6 className="fw-bold mb-0 text-dark">
              Kuyumculuk Sektöründe MASAK Mevzuatı ve Yükümlülük Hatırlatması
            </h6>
          </div>

          <Row className="g-3" style={{ fontSize: "12.5px", color: "#475569", lineHeight: 1.55 }}>
            <Col md={6}>
              <div className="p-3 bg-white rounded-3 border h-100">
                <div className="fw-bold text-dark mb-1.5 d-flex align-items-center gap-1.5">
                  <IconBuildingBank size={16} className="text-primary" />
                  Kimlik Tespiti ve Müşterinin Tanınması (KYC)
                </div>
                <div>
                  Kıymetli maden, taş veya kuyum alım-satım işlemlerinde belirlenen parasal sınırları aşan işlemlerde
                  veya şüphe duyulan hallerde tutara bakılmaksızın kimlik tespiti yapılması yasal zorunluluktur.
                </div>
              </div>
            </Col>

            <Col md={6}>
              <div className="p-3 bg-white rounded-3 border h-100">
                <div className="fw-bold text-dark mb-1.5 d-flex align-items-center gap-1.5">
                  <IconShieldCheck size={16} className="text-danger" />
                  Malvarlığı Dondurma ve Şüpheli İşlem Bildirimi (ŞİB)
                </div>
                <div>
                  Yukarıdaki 4 resmi listede yer alan kişi veya kuruluşlarla işlem yapılması derhal durdurulmalı ve
                  en geç 30 gün (gecikmeksizin) içerisinde MASAK Başkanlığına bildirimde bulunulmalıdır.
                </div>
              </div>
            </Col>
          </Row>
        </Card.Body>
      </Card>
    </Container>
  );
};

export default MasakListsPage;
