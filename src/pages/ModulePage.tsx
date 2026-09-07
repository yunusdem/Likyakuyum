import React from "react";
import { useLocation, Link } from "react-router-dom";
import { Container } from "react-bootstrap";
import { IconHome } from "@tabler/icons-react";
import DocumentListingView from "components/documents/DocumentListingView";
import ERPToolbar from "components/common/ERPToolbar";

const ModulePage: React.FC = () => {
  const location = useLocation();
  const segments = location.pathname.split("/").filter(Boolean);
  const rawTitle = segments.length > 0 ? segments[segments.length - 1] : "Modül";
  const pageTitle = rawTitle
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <Container fluid className="py-3 px-3 px-lg-4">
      {/* 1. Üst ERP Aksiyon Şeridi (Ribbon Toolbar) */}
      <ERPToolbar
        pageTitle={pageTitle}
        onSave={() => alert(`"${pageTitle}" için kayıt işlemi yapıldı.`)}
        onRefresh={() => alert(`"${pageTitle}" verileri yenilendi.`)}
        onNew={() => alert(`"${pageTitle}" için yeni kayıt ekranı açıldı.`)}
        onPrint={() => window.print()}
        onSearch={() => alert("Kayıt arama filtresi açıldı.")}
      />

      {/* Breadcrumb Header */}
      <div className="d-flex align-items-center justify-content-between mb-3">
        <div>
          <nav aria-label="breadcrumb">
            <ol className="breadcrumb mb-0 small">
              <li className="breadcrumb-item">
                <Link to="/" className="d-flex align-items-center text-muted text-decoration-none">
                  <IconHome size={14} className="me-1" /> Ana Sayfa
                </Link>
              </li>
              {segments.map((seg, idx) => (
                <li
                  key={idx}
                  className={`breadcrumb-item ${idx === segments.length - 1 ? "active text-primary fw-semibold" : ""}`}
                >
                  {seg.replace(/-/g, " ").toUpperCase()}
                </li>
              ))}
            </ol>
          </nav>
        </div>
      </div>

      {/* Document Listing & Filtering View */}
      <DocumentListingView pageTitle={pageTitle} />
    </Container>
  );
};

export default ModulePage;

