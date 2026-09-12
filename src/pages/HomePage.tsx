import React, { useState } from "react";
import { Card, Row, Col, Form, Button, Badge, InputGroup } from "react-bootstrap";
import {
  IconPalette,
  IconSparkles,
  IconCheck,
} from "@tabler/icons-react";
import { useAuth } from "../context/AuthContext";
import {
  THEME_PRESETS,
  getActivePresetId,
  applyThemePreset,
} from "../services/themePresetService";
import ThemeSettingsModal from "../components/theme/ThemeSettingsModal";

const HomePage: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const [showThemeModal, setShowThemeModal] = useState<boolean>(false);
  const [justSaved, setJustSaved] = useState<boolean>(false);

  const activePresetId = getActivePresetId(user?.appearance);
  const activePreset =
    THEME_PRESETS.find((p) => p.id === activePresetId) || THEME_PRESETS[0];

  const handlePresetChange = async (presetId: string) => {
    const selected = THEME_PRESETS.find((p) => p.id === presetId);
    if (selected) {
      await applyThemePreset(selected, user?.appearance, refreshUser);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2500);
    }
  };

  return (
    <div className="py-2">
      {/* Görünüm & Tema Düzenleme */}
      <Card className="border-0 shadow-sm rounded-3 bg-white overflow-hidden">
        <div
          style={{
            height: "4px",
            background: `linear-gradient(90deg, ${activePreset.previewAccent}, ${activePreset.previewBg})`,
          }}
        />
        <Card.Body className="p-3">
          <Row className="g-3 align-items-center">
            {/* Sol: Başlık & Aktif Rozet */}
            <Col xs={12} md={4}>
              <div className="d-flex align-items-center gap-2.5">
                <div
                  className="rounded-circle d-flex align-items-center justify-content-center text-white flex-shrink-0"
                  style={{
                    width: "36px",
                    height: "36px",
                    backgroundColor: activePreset.previewAccent || "#2563eb",
                  }}
                >
                  <IconPalette size={20} />
                </div>
                <div>
                  <div className="d-flex align-items-center gap-2">
                    <span className="fw-bold text-dark fs-6">Görünüm & Tema</span>
                    <Badge bg={activePreset.badgeColor as any} className="font-monospace px-1.5 py-0.5">
                      {activePreset.badge}
                    </Badge>
                    {justSaved && (
                      <span className="badge bg-success d-flex align-items-center gap-1 py-0.5 px-1.5 small">
                        <IconCheck size={12} /> Kaydedildi
                      </span>
                    )}
                  </div>
                  <span className="text-secondary small d-block" style={{ fontSize: "12px" }}>
                    Kullanıcı tanımlarına girmeden tema seçin
                  </span>
                </div>
              </div>
            </Col>

            {/* Orta: Tema Seçim Combobox'ı */}
            <Col xs={12} sm={7} md={5}>
              <div className="d-flex align-items-center gap-2">
                <span className="text-muted small fw-semibold text-nowrap">
                  Tema:
                </span>
                <InputGroup size="sm">
                  <InputGroup.Text className="bg-light px-2">
                    <div
                      className="rounded-circle border"
                      style={{
                        width: "12px",
                        height: "12px",
                        backgroundColor: activePreset.previewAccent,
                      }}
                    />
                  </InputGroup.Text>
                  <Form.Select
                    value={activePresetId}
                    onChange={(e) => handlePresetChange(e.target.value)}
                    className="fw-semibold bg-white"
                    style={{ fontSize: "13px" }}
                    aria-label="Tema Seçimi"
                  >
                    {THEME_PRESETS.map((preset) => (
                      <option key={preset.id} value={preset.id}>
                        {preset.name}
                      </option>
                    ))}
                  </Form.Select>
                </InputGroup>
              </div>
            </Col>

            {/* Sağ: Tüm Görünüm Ayarları Modal Butonu */}
            <Col xs={12} sm={5} md={3}>
              <div className="d-flex align-items-center justify-content-sm-end">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setShowThemeModal(true)}
                  className="d-flex align-items-center gap-1.5 fw-semibold py-1.5 px-3 text-nowrap"
                  style={{ fontSize: "12.5px" }}
                  title="Tüm görünüm, renk ve font ayarlarını aç"
                >
                  <IconSparkles size={15} /> Görünüm Ayarları...
                </Button>
              </div>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* Tema Ayarları Modal'ı */}
      <ThemeSettingsModal
        show={showThemeModal}
        onHide={() => setShowThemeModal(false)}
      />
    </div>
  );
};

export default HomePage;
