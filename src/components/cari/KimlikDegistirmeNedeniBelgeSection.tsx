import React, { useRef, useState } from "react";
import { Form, Button, Modal, Row, Col } from "react-bootstrap";
import {
  IconFileText,
  IconUpload,
  IconTrash,
  IconEye,
  IconPhoto,
} from "@tabler/icons-react";

export interface KimlikDegistirmeNedeniBelgeProps {
  neden: string;
  onNedenChange: (neden: string) => void;
  belgeData?: string | null;
  belgeMime?: string | null;
  belgeDosyaAdi?: string | null;
  onBelgeChange: (payload: {
    belgeData: string | null;
    belgeMime: string | null;
    belgeDosyaAdi: string | null;
  }) => void;
  disabled?: boolean;
  layout?: "horizontal" | "vertical";
  labelWidth?: number | string;
}

export const KIMLIK_DEGISTIRME_NEDENLERI = [
  { value: "", label: "Seçiniz" },
  { value: "Mavi Kart", label: "Mavi Kart" },
  { value: "İkamet İzin Belgesi", label: "İkamet İzin Belgesi" },
  { value: "Evlilik / Boşanma", label: "Evlilik / Boşanma" },
  { value: "Yıpranma / Yenileme", label: "Yıpranma / Yenileme" },
  { value: "Kayıp / Çalıntı", label: "Kayıp / Çalıntı" },
  { value: "Diğer", label: "Diğer" },
];

export const KimlikDegistirmeNedeniBelgeSection: React.FC<KimlikDegistirmeNedeniBelgeProps> = ({
  neden,
  onNedenChange,
  belgeData,
  belgeMime,
  belgeDosyaAdi,
  onBelgeChange,
  disabled = false,
  layout = "vertical",
  labelWidth = 135,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  // Mavi Kart veya İkamet İzin Belgesi seçili mi?
  const isBelgeGerekli =
    neden === "Mavi Kart" || neden === "İkamet İzin Belgesi";

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Dosya boyutu sınırı (10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert("Dosya boyutu 10MB'tan küçük olmalıdır.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      onBelgeChange({
        belgeData: result,
        belgeMime: file.type || "application/octet-stream",
        belgeDosyaAdi: file.name,
      });
      if (fileInputRef.current) fileInputRef.current.value = "";
    };
    reader.readAsDataURL(file);
  };

  const handleBelgeSil = () => {
    onBelgeChange({
      belgeData: null,
      belgeMime: null,
      belgeDosyaAdi: null,
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const isImage =
    belgeMime?.startsWith("image/") ||
    belgeData?.startsWith("data:image/") ||
    /\.(jpg|jpeg|png|webp|gif|bmp)$/i.test(belgeDosyaAdi || "");

  const isPdf =
    belgeMime === "application/pdf" ||
    belgeData?.startsWith("data:application/pdf") ||
    /\.pdf$/i.test(belgeDosyaAdi || "");

  const renderDropdown = () => (
    <Form.Select
      size="sm"
      value={neden || ""}
      onChange={(e) => onNedenChange(e.target.value)}
      disabled={disabled}
      style={{ fontSize: "12px", minWidth: 0 }}
    >
      {KIMLIK_DEGISTIRME_NEDENLERI.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </Form.Select>
  );

  const renderUploadBox = () => {
    if (!isBelgeGerekli) return null;

    return (
      <div
        className="mt-2 p-2 border rounded-2 bg-light w-100 position-relative clearfix"
        style={{ fontSize: "11px", clear: "both" }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.pdf,application/pdf"
          style={{ display: "none" }}
          onChange={handleFileChange}
          disabled={disabled}
        />

        <div className="d-flex align-items-center justify-content-between mb-1">
          <span className="fw-semibold text-secondary d-flex align-items-center gap-1">
            <IconFileText size={14} className="text-primary" />
            {neden} Belgesi / Fotoğrafı (SQL)
          </span>
          {belgeData && (
            <Button
              variant="outline-danger"
              size="sm"
              className="py-0 px-1.5 border-0 text-danger"
              style={{ fontSize: "11px" }}
              onClick={handleBelgeSil}
              disabled={disabled}
              title="Belgeyi Kaldır"
            >
              <IconTrash size={13} className="me-0.5" />
              Kaldır
            </Button>
          )}
        </div>

        {belgeData ? (
          <div className="d-flex align-items-center gap-2 p-1.5 bg-white border rounded">
            {isImage ? (
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 4,
                  overflow: "hidden",
                  cursor: "pointer",
                  backgroundColor: "#f0f0f0",
                }}
                className="d-flex align-items-center justify-content-center flex-shrink-0 border"
                onClick={() => setShowPreviewModal(true)}
                title="Büyütmek için tıklayınız"
              >
                <img
                  src={belgeData}
                  alt={belgeDosyaAdi || "Belge"}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              </div>
            ) : isPdf ? (
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 4,
                  backgroundColor: "#fde8e8",
                  color: "#d92550",
                  cursor: "pointer",
                }}
                className="d-flex flex-column align-items-center justify-content-center flex-shrink-0 border border-danger-subtle"
                onClick={() => setShowPreviewModal(true)}
                title="Görüntülemek için tıklayınız"
              >
                <IconFileText size={24} />
                <span style={{ fontSize: "9px", fontWeight: "bold" }}>PDF</span>
              </div>
            ) : (
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 4,
                  backgroundColor: "#e8f0fe",
                  color: "#1a73e8",
                }}
                className="d-flex flex-column align-items-center justify-content-center flex-shrink-0 border border-primary-subtle"
              >
                <IconFileText size={24} />
                <span style={{ fontSize: "9px" }}>DOSYA</span>
              </div>
            )}

            <div className="flex-grow-1 overflow-hidden" style={{ minWidth: 0 }}>
              <div
                className="text-truncate fw-semibold text-dark"
                title={belgeDosyaAdi || "Yüklenen Belge"}
                style={{ fontSize: "11px" }}
              >
                {belgeDosyaAdi || `${neden} Belgesi`}
              </div>
              <div className="text-muted" style={{ fontSize: "10px" }}>
                Veritabanında kayıtlı
              </div>
              <div className="d-flex align-items-center gap-1 mt-1">
                <Button
                  variant="outline-primary"
                  size="sm"
                  className="py-0 px-1 text-nowrap"
                  style={{ fontSize: "10px" }}
                  onClick={() => setShowPreviewModal(true)}
                >
                  <IconEye size={12} className="me-0.5" />
                  Görüntüle
                </Button>
                <Button
                  variant="outline-secondary"
                  size="sm"
                  className="py-0 px-1 text-nowrap"
                  style={{ fontSize: "10px" }}
                  onClick={() => fileInputRef.current?.click()}
                  disabled={disabled}
                >
                  Değiştir
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div
            onClick={() => !disabled && fileInputRef.current?.click()}
            style={{
              cursor: disabled ? "not-allowed" : "pointer",
              border: "1.5px dashed #b0bec5",
              borderRadius: "6px",
              padding: "8px 10px",
              backgroundColor: "#ffffff",
              transition: "all 0.15s ease-in-out",
            }}
            className="d-flex align-items-center justify-content-center gap-2 text-center text-muted"
          >
            <IconUpload size={18} className="text-primary flex-shrink-0" />
            <div className="text-start" style={{ lineHeight: "1.2" }}>
              <span className="d-block fw-semibold text-primary" style={{ fontSize: "11px" }}>
                Belge / Fotoğraf Seç (1 adet)
              </span>
              <span className="text-muted" style={{ fontSize: "9.5px" }}>
                JPG, PNG veya PDF (Doğrudan SQL'e kaydedilir)
              </span>
            </div>
          </div>
        )}

        {/* Belge Önizleme Modalı */}
        <Modal
          show={showPreviewModal}
          onHide={() => setShowPreviewModal(false)}
          size="lg"
          centered
        >
          <Modal.Header closeButton className="py-2">
            <Modal.Title className="h6 mb-0 d-flex align-items-center gap-2">
              {isImage ? <IconPhoto size={16} /> : <IconFileText size={16} />}
              {belgeDosyaAdi || `${neden} Belgesi`}
            </Modal.Title>
          </Modal.Header>
          <Modal.Body className="p-2 text-center bg-dark-subtle">
            {isImage && belgeData ? (
              <img
                src={belgeData}
                alt="Belge Önizleme"
                style={{
                  maxWidth: "100%",
                  maxHeight: "75vh",
                  objectFit: "contain",
                  borderRadius: 4,
                }}
              />
            ) : isPdf && belgeData ? (
              <iframe
                src={belgeData}
                title="PDF Önizleme"
                style={{ width: "100%", height: "75vh", border: "none" }}
              />
            ) : (
              <div className="p-4 text-muted">Önizleme görüntülenemiyor.</div>
            )}
          </Modal.Body>
          <Modal.Footer className="py-1">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowPreviewModal(false)}
            >
              Kapat
            </Button>
          </Modal.Footer>
        </Modal>
      </div>
    );
  };

  if (layout === "horizontal") {
    return (
      <div className="w-100">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.pdf,application/pdf"
          style={{ display: "none" }}
          onChange={handleFileChange}
          disabled={disabled}
        />

        <Row className="g-2 align-items-center">
          {/* Sol Kolon: Üstteki alanlarla birebir aynı genişlikte ve hizada */}
          <Col xs={12} md={6}>
            <div className="d-flex align-items-center">
              <label
                style={{
                  width: labelWidth,
                  minWidth: labelWidth,
                  fontSize: "12px",
                  fontWeight: 600,
                }}
                className="text-secondary text-nowrap mb-0 me-2"
              >
                Kimlik Değiştirme Nedeni
              </label>
              <div style={{ flex: 1, minWidth: 0 }}>{renderDropdown()}</div>
            </div>
          </Col>

          {/* Sağ Kolon: Yalnızca Mavi Kart veya İkamet seçilince sağda küçük bir şekilde açılır */}
          <Col xs={12} md={6}>
            {isBelgeGerekli && (
              <div className="d-flex align-items-center">
                {belgeData ? (
                  <div
                    style={{
                      border: "1px solid #cbd5e1",
                      borderRadius: "4px",
                      padding: "2px 8px",
                      backgroundColor: "#ffffff",
                      height: "31px",
                      width: "100%",
                    }}
                    className="d-flex align-items-center justify-content-between gap-2 shadow-2xs"
                  >
                    <div
                      className="d-flex align-items-center gap-1.5 overflow-hidden"
                      style={{ minWidth: 0, cursor: "pointer" }}
                      onClick={() => setShowPreviewModal(true)}
                      title="Görüntülemek için tıklayınız"
                    >
                      {isImage ? (
                        <div
                          style={{
                            width: 22,
                            height: 22,
                            borderRadius: 3,
                            overflow: "hidden",
                            backgroundColor: "#f1f5f9",
                          }}
                          className="flex-shrink-0 border d-flex align-items-center justify-content-center"
                        >
                          <img
                            src={belgeData}
                            alt="Belge"
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          />
                        </div>
                      ) : (
                        <div
                          style={{
                            width: 22,
                            height: 22,
                            borderRadius: 3,
                            backgroundColor: "#fee2e2",
                            color: "#dc2626",
                          }}
                          className="flex-shrink-0 border border-danger-subtle d-flex align-items-center justify-content-center"
                        >
                          <IconFileText size={13} />
                        </div>
                      )}
                      <span
                        className="text-truncate small fw-semibold text-dark"
                        style={{ fontSize: "11px", maxWidth: "160px" }}
                        title={belgeDosyaAdi || `${neden} Belgesi`}
                      >
                        {belgeDosyaAdi || `${neden} Belgesi`}
                      </span>
                    </div>

                    <div className="d-flex align-items-center gap-1 flex-shrink-0">
                      <Button
                        variant="light"
                        size="sm"
                        className="p-0 text-secondary d-flex align-items-center justify-content-center border-0"
                        style={{ width: 22, height: 22 }}
                        onClick={() => setShowPreviewModal(true)}
                        title="Büyüt / İncele"
                      >
                        <IconEye size={13} />
                      </Button>
                      <Button
                        variant="light"
                        size="sm"
                        className="p-0 text-danger d-flex align-items-center justify-content-center border-0"
                        style={{ width: 22, height: 22 }}
                        onClick={handleBelgeSil}
                        disabled={disabled}
                        title="Belgeyi Kaldır"
                      >
                        <IconTrash size={13} />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => !disabled && fileInputRef.current?.click()}
                    style={{
                      cursor: disabled ? "not-allowed" : "pointer",
                      border: "1px dashed #0284c7",
                      borderRadius: "4px",
                      padding: "2px 10px",
                      backgroundColor: "#f0f9ff",
                      height: "31px",
                      width: "100%",
                      transition: "all 0.15s ease-in-out",
                    }}
                    className="d-flex align-items-center justify-content-center gap-1.5 text-primary text-truncate shadow-2xs hover-bg-primary-subtle"
                    title={`${neden} Belgesi / Fotoğrafı Yükle`}
                  >
                    <IconUpload size={14} className="flex-shrink-0" />
                    <span className="fw-semibold text-truncate" style={{ fontSize: "11px" }}>
                      {neden} Belgesi / Fotoğrafı Yükle (SQL)
                    </span>
                  </div>
                )}
              </div>
            )}
          </Col>
        </Row>

        {/* Belge Önizleme Modalı */}
        <Modal
          show={showPreviewModal}
          onHide={() => setShowPreviewModal(false)}
          size="lg"
          centered
        >
          <Modal.Header closeButton className="py-2">
            <Modal.Title className="h6 mb-0 d-flex align-items-center gap-2">
              {isImage ? <IconPhoto size={16} /> : <IconFileText size={16} />}
              {belgeDosyaAdi || `${neden} Belgesi`}
            </Modal.Title>
          </Modal.Header>
          <Modal.Body className="p-2 text-center bg-dark-subtle">
            {isImage && belgeData ? (
              <img
                src={belgeData}
                alt="Belge Önizleme"
                style={{
                  maxWidth: "100%",
                  maxHeight: "75vh",
                  objectFit: "contain",
                  borderRadius: 4,
                }}
              />
            ) : isPdf && belgeData ? (
              <iframe
                src={belgeData}
                title="PDF Önizleme"
                style={{ width: "100%", height: "75vh", border: "none" }}
              />
            ) : (
              <div className="p-4 text-muted">Önizleme görüntülenemiyor.</div>
            )}
          </Modal.Body>
          <Modal.Footer className="py-1">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowPreviewModal(false)}
            >
              Kapat
            </Button>
          </Modal.Footer>
        </Modal>
      </div>
    );
  }

  return (
    <div className="w-100">
      <div className="mb-1">
        <label
          className="text-secondary small fw-semibold d-block mb-1 text-start"
          style={{ fontSize: "11px" }}
        >
          Kimlik Değiştirme Nedeni
        </label>
        {renderDropdown()}
      </div>
      {renderUploadBox()}
    </div>
  );
};

