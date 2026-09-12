import React, { useState, useEffect } from "react";
import {
  Modal,
  Button,
  Row,
  Col,
  Badge,
  Card,
  Tab,
  Nav,
  Form,
  Alert,
} from "react-bootstrap";
import {
  IconPalette,
  IconSparkles,
  IconCheck,
  IconAdjustments,
  IconDeviceDesktop,
} from "@tabler/icons-react";
import { useAuth } from "../../context/AuthContext";
import {
  THEME_PRESETS,
  ThemePreset,
  getActivePresetId,
  applyThemePreset,
  applyCustomAppearance,
} from "../../services/themePresetService";
import { FontSelectDropdown } from "../../pages/settings/UserDefinitionsPage";

interface ThemeSettingsModalProps {
  show: boolean;
  onHide: () => void;
}

export const ThemeSettingsModal: React.FC<ThemeSettingsModalProps> = ({
  show,
  onHide,
}) => {
  const { user, refreshUser } = useAuth();
  const [activeTab, setActiveTab] = useState<string>("presets");
  const [activePresetId, setActivePresetId] = useState<string>(() =>
    getActivePresetId(user?.appearance)
  );
  const [feedback, setFeedback] = useState<{ type: string; msg: string } | null>(null);

  // Full appearance state containing all fields from UserDefinitionsPage
  const [appearance, setAppearance] = useState<{
    enableProgramTheme: boolean;
    programBgColor: string;
    programTextColor: string;
    programFont: string;
    gridHeaderBgColor: string;
    gridBgColor: string;
    gridFont: string;
    windowBgColor: string;
    windowTextColor: string;
    windowFocusColor: string;

    enableMenuTheme: boolean;
    menuBgColor: string;
    menuSelectedBgColor: string;
    menuFont: string;
    menuHeaderBgColor: string;
    menuHeaderFont: string;
    menuBackdropColor: string;

    enableBuyHeaderTheme: boolean;
    buyHeaderBgColor: string;
    buyHeaderTextColor: string;

    enableSellHeaderTheme: boolean;
    sellHeaderBgColor: string;
    sellHeaderTextColor: string;
  }>({
    enableProgramTheme: true,
    programBgColor: "#f8fafc",
    programTextColor: "#0f172a",
    programFont: "Segoe UI, sans-serif",
    gridHeaderBgColor: "#cbe5ff",
    gridBgColor: "#ffffff",
    gridFont: "Segoe UI, sans-serif",
    windowBgColor: "#ffffff",
    windowTextColor: "#000000",
    windowFocusColor: "#e2e8f0",

    enableMenuTheme: true,
    menuBgColor: "#bfe0ff",
    menuSelectedBgColor: "#ff80ff",
    menuFont: "Segoe UI, sans-serif",
    menuHeaderBgColor: "#000080",
    menuHeaderFont: "Segoe UI, sans-serif",
    menuBackdropColor: "#ff8080",

    enableBuyHeaderTheme: false,
    buyHeaderBgColor: "#e2e8f0",
    buyHeaderTextColor: "#000000",

    enableSellHeaderTheme: false,
    sellHeaderBgColor: "#e2e8f0",
    sellHeaderTextColor: "#000000",
  });

  useEffect(() => {
    if (show) {
      setActivePresetId(getActivePresetId(user?.appearance));
      if (user?.appearance) {
        setAppearance((prev) => ({
          ...prev,
          ...user.appearance,
        }));
      }
    }
  }, [show, user?.appearance]);

  const updateAppearanceField = (field: string, value: any) => {
    setAppearance((prev) => ({ ...prev, [field]: value }));
  };

  const handleSelectPreset = async (preset: ThemePreset) => {
    setActivePresetId(preset.id);
    if (preset.appearance) {
      setAppearance((prev) => ({
        ...prev,
        ...preset.appearance,
      }));
    }
    await applyThemePreset(preset, user?.appearance, refreshUser);

    setFeedback({
      type: "success",
      msg: `"${preset.name}" teması anında uygulandı ve kaydedildi.`,
    });
    setTimeout(() => setFeedback(null), 3000);
  };

  const handleSaveAllAppearance = async () => {
    await applyCustomAppearance(appearance, refreshUser);
    setFeedback({
      type: "success",
      msg: "Tüm görünüm, renk ve font ayarları anında uygulandı ve kaydedildi.",
    });
    setTimeout(() => setFeedback(null), 3000);
  };

  const handleSyncWithPano = () => {
    try {
      localStorage.setItem("pano_active_theme_bg", appearance.programBgColor);
      setFeedback({
        type: "info",
        msg: `Pano zemin rengi "${appearance.programBgColor}" olarak güncellendi.`,
      });
      setTimeout(() => setFeedback(null), 3500);
    } catch {}
  };

  return (
    <Modal
      show={show}
      onHide={onHide}
      size="xl"
      centered
      backdrop="static"
      className="theme-settings-modal"
    >
      <Modal.Header closeButton className="border-bottom py-2.5 px-3 bg-light">
        <Modal.Title className="d-flex align-items-center gap-2 fs-6 fw-bold text-dark">
          <div
            className="rounded-circle d-flex align-items-center justify-content-center bg-primary text-white"
            style={{ width: "28px", height: "28px" }}
          >
            <IconPalette size={16} />
          </div>
          <span>Görünüm & Tema Ayarları</span>
        </Modal.Title>
      </Modal.Header>

      <Modal.Body className="p-3">
        {feedback && (
          <Alert
            variant={feedback.type}
            dismissible
            onClose={() => setFeedback(null)}
            className="py-1.5 px-3 small mb-3 shadow-xs"
          >
            {feedback.msg}
          </Alert>
        )}

        <Tab.Container activeKey={activeTab} onSelect={(k) => setActiveTab(k || "presets")}>
          <Nav variant="pills" className="nav-fill mb-3 bg-light p-1 rounded-2 border">
            <Nav.Item>
              <Nav.Link
                eventKey="presets"
                className="py-1.5 px-3 d-flex align-items-center justify-content-center gap-1.5 fw-semibold small"
              >
                <IconSparkles size={16} /> Hazır Tema Paketleri (Tek Tıkla Seç)
              </Nav.Link>
            </Nav.Item>
            <Nav.Item>
              <Nav.Link
                eventKey="custom"
                className="py-1.5 px-3 d-flex align-items-center justify-content-center gap-1.5 fw-semibold small"
              >
                <IconAdjustments size={16} /> Tüm Görünüm Ayarları (Yazı, Renk, Font, Menü, Grid)
              </Nav.Link>
            </Nav.Item>
          </Nav>

          <Tab.Content>
            {/* TAB 1: PRESET TEMALAR */}
            <Tab.Pane eventKey="presets">
              <div
                className="overflow-y-auto pe-1"
                style={{ maxHeight: "500px" }}
              >
                <Row className="g-2.5">
                  {THEME_PRESETS.map((preset) => {
                    const isActive = activePresetId === preset.id;
                    return (
                      <Col xs={12} sm={6} lg={4} key={preset.id}>
                        <div
                          className={`p-2.5 rounded-3 border h-100 d-flex flex-column justify-content-between transition-all ${
                            isActive
                              ? "border-primary bg-primary bg-opacity-10 shadow-sm"
                              : "bg-white hover-shadow border-light-subtle"
                          }`}
                          style={{
                            borderWidth: isActive ? "2px" : "1px",
                            cursor: "pointer",
                          }}
                          onClick={() => handleSelectPreset(preset)}
                        >
                          <div>
                            <div className="d-flex align-items-center justify-content-between mb-1.5">
                              <Badge
                                bg={preset.badgeColor as any}
                                className="font-monospace px-1.5 py-0.5"
                                style={{ fontSize: "10.5px" }}
                              >
                                {preset.badge}
                              </Badge>
                              {isActive && (
                                <span className="badge bg-success d-flex align-items-center gap-1 py-1 px-1.5">
                                  <IconCheck size={12} strokeWidth={3} /> Aktif
                                </span>
                              )}
                            </div>

                            <h6 className="fw-bold text-dark mb-1 fs-6">
                              {preset.name}
                            </h6>
                            <p
                              className="text-secondary small mb-2"
                              style={{ fontSize: "11.5px", minHeight: "30px" }}
                            >
                              {preset.description}
                            </p>

                            {/* Mini Palet Önizleme */}
                            <div
                              className="d-flex align-items-center gap-1.5 p-1.5 rounded border mb-2"
                              style={{ backgroundColor: preset.previewBg }}
                            >
                              <div
                                className="rounded-circle border"
                                style={{
                                  width: "14px",
                                  height: "14px",
                                  backgroundColor: preset.previewAccent,
                                }}
                                title="Vurgu Rengi"
                              />
                              <div
                                className="rounded-circle border"
                                style={{
                                  width: "14px",
                                  height: "14px",
                                  backgroundColor: preset.previewText,
                                }}
                                title="Metin Rengi"
                              />
                              <div
                                className="rounded-circle border"
                                style={{
                                  width: "14px",
                                  height: "14px",
                                  backgroundColor: preset.previewBg,
                                }}
                                title="Zemin Rengi"
                              />
                              <span
                                className="ms-auto fw-bold"
                                style={{
                                  color: preset.previewText,
                                  fontFamily: preset.previewFont,
                                  fontSize: "11px",
                                }}
                              >
                                Likya Kuyum ₺
                              </span>
                            </div>
                          </div>

                          <Button
                            variant={isActive ? "primary" : "outline-primary"}
                            size="sm"
                            className="w-100 py-1 fw-semibold d-flex align-items-center justify-content-center gap-1 text-nowrap"
                            style={{ fontSize: "12px" }}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectPreset(preset);
                            }}
                          >
                            {isActive ? (
                              <>
                                <IconCheck size={14} /> Seçili
                              </>
                            ) : (
                              <>
                                <IconSparkles size={14} /> Bu Temayı Uygula
                              </>
                            )}
                          </Button>
                        </div>
                      </Col>
                    );
                  })}
                </Row>
              </div>
            </Tab.Pane>

            {/* TAB 2: TÜM GÖRÜNÜM AYARLARI (KULLANICI TANIMLARI İLE BİREBİR AYNI) */}
            <Tab.Pane eventKey="custom">
              <div
                className="overflow-y-auto pe-1"
                style={{ maxHeight: "500px" }}
              >
                <Row className="g-3">
                  {/* SOL SÜTUN: PROGRAM VE GRİD AYARLARI */}
                  <Col xs={12} lg={6}>
                    <div className="p-3 rounded-3 border bg-light h-100">
                      <div className="d-flex align-items-center justify-content-between pb-2 border-bottom mb-3">
                        <Form.Check
                          type="checkbox"
                          id="modal_enableProgramTheme"
                          label={<span className="fw-bold text-dark">Program Görünümü</span>}
                          checked={appearance.enableProgramTheme}
                          onChange={(e) =>
                            updateAppearanceField("enableProgramTheme", e.target.checked)
                          }
                        />
                      </div>

                      <div className="d-flex flex-column gap-2">
                        {/* Zemin Rengi */}
                        <div className="d-flex align-items-center justify-content-between p-2 bg-white rounded border">
                          <span className="small fw-semibold text-secondary">Zemin rengi</span>
                          <div className="d-flex align-items-center gap-2">
                            <input
                              type="color"
                              value={appearance.programBgColor}
                              onChange={(e) => updateAppearanceField("programBgColor", e.target.value)}
                              className="form-control form-control-color p-0 border-0"
                              style={{ width: "36px", height: "30px", cursor: "pointer" }}
                            />
                            <Form.Control
                              type="text"
                              size="sm"
                              value={appearance.programBgColor}
                              onChange={(e) => updateAppearanceField("programBgColor", e.target.value)}
                              className="font-monospace text-uppercase"
                              style={{ width: "85px" }}
                            />
                          </div>
                        </div>

                        {/* Yazı Rengi */}
                        <div className="d-flex align-items-center justify-content-between p-2 bg-white rounded border">
                          <span className="small fw-semibold text-secondary">Yazı rengi</span>
                          <div className="d-flex align-items-center gap-2">
                            <input
                              type="color"
                              value={appearance.programTextColor}
                              onChange={(e) => updateAppearanceField("programTextColor", e.target.value)}
                              className="form-control form-control-color p-0 border-0"
                              style={{ width: "36px", height: "30px", cursor: "pointer" }}
                            />
                            <Form.Control
                              type="text"
                              size="sm"
                              value={appearance.programTextColor}
                              onChange={(e) => updateAppearanceField("programTextColor", e.target.value)}
                              className="font-monospace text-uppercase"
                              style={{ width: "85px" }}
                            />
                          </div>
                        </div>

                        {/* Program Fontu */}
                        <div className="d-flex align-items-center justify-content-between p-2 bg-white rounded border">
                          <span className="small fw-semibold text-secondary">Program fontu</span>
                          <FontSelectDropdown
                            value={appearance.programFont}
                            onChange={(val) => updateAppearanceField("programFont", val)}
                          />
                        </div>

                        {/* Grid Başlık Rengi */}
                        <div className="d-flex align-items-center justify-content-between p-2 bg-white rounded border">
                          <span className="small fw-semibold text-secondary">Grid başlık rengi</span>
                          <div className="d-flex align-items-center gap-2">
                            <input
                              type="color"
                              value={appearance.gridHeaderBgColor}
                              onChange={(e) => updateAppearanceField("gridHeaderBgColor", e.target.value)}
                              className="form-control form-control-color p-0 border-0"
                              style={{ width: "36px", height: "30px", cursor: "pointer" }}
                            />
                            <Form.Control
                              type="text"
                              size="sm"
                              value={appearance.gridHeaderBgColor}
                              onChange={(e) => updateAppearanceField("gridHeaderBgColor", e.target.value)}
                              className="font-monospace text-uppercase"
                              style={{ width: "85px" }}
                            />
                          </div>
                        </div>

                        {/* Grid Zemin Rengi */}
                        <div className="d-flex align-items-center justify-content-between p-2 bg-white rounded border">
                          <span className="small fw-semibold text-secondary">Grid zemin rengi</span>
                          <div className="d-flex align-items-center gap-2">
                            <input
                              type="color"
                              value={appearance.gridBgColor}
                              onChange={(e) => updateAppearanceField("gridBgColor", e.target.value)}
                              className="form-control form-control-color p-0 border-0"
                              style={{ width: "36px", height: "30px", cursor: "pointer" }}
                            />
                            <Form.Control
                              type="text"
                              size="sm"
                              value={appearance.gridBgColor}
                              onChange={(e) => updateAppearanceField("gridBgColor", e.target.value)}
                              className="font-monospace text-uppercase"
                              style={{ width: "85px" }}
                            />
                          </div>
                        </div>

                        {/* Grid Fontu */}
                        <div className="d-flex align-items-center justify-content-between p-2 bg-white rounded border">
                          <span className="small fw-semibold text-secondary">Grid fontu</span>
                          <FontSelectDropdown
                            value={appearance.gridFont}
                            onChange={(val) => updateAppearanceField("gridFont", val)}
                          />
                        </div>

                        {/* Pencere Zemin Rengi */}
                        <div className="d-flex align-items-center justify-content-between p-2 bg-white rounded border">
                          <span className="small fw-semibold text-secondary">Pencere zemin rengi</span>
                          <div className="d-flex align-items-center gap-2">
                            <input
                              type="color"
                              value={appearance.windowBgColor}
                              onChange={(e) => updateAppearanceField("windowBgColor", e.target.value)}
                              className="form-control form-control-color p-0 border-0"
                              style={{ width: "36px", height: "30px", cursor: "pointer" }}
                            />
                            <Form.Control
                              type="text"
                              size="sm"
                              value={appearance.windowBgColor}
                              onChange={(e) => updateAppearanceField("windowBgColor", e.target.value)}
                              className="font-monospace text-uppercase"
                              style={{ width: "85px" }}
                            />
                          </div>
                        </div>

                        {/* Pencere Yazı Rengi */}
                        <div className="d-flex align-items-center justify-content-between p-2 bg-white rounded border">
                          <span className="small fw-semibold text-secondary">Pencere yazı rengi</span>
                          <div className="d-flex align-items-center gap-2">
                            <input
                              type="color"
                              value={appearance.windowTextColor}
                              onChange={(e) => updateAppearanceField("windowTextColor", e.target.value)}
                              className="form-control form-control-color p-0 border-0"
                              style={{ width: "36px", height: "30px", cursor: "pointer" }}
                            />
                            <Form.Control
                              type="text"
                              size="sm"
                              value={appearance.windowTextColor}
                              onChange={(e) => updateAppearanceField("windowTextColor", e.target.value)}
                              className="font-monospace text-uppercase"
                              style={{ width: "85px" }}
                            />
                          </div>
                        </div>

                        {/* Pencere Fokus Rengi */}
                        <div className="d-flex align-items-center justify-content-between p-2 bg-white rounded border">
                          <span className="small fw-semibold text-secondary">Pencere fokus rengi</span>
                          <div className="d-flex align-items-center gap-2">
                            <input
                              type="color"
                              value={appearance.windowFocusColor}
                              onChange={(e) => updateAppearanceField("windowFocusColor", e.target.value)}
                              className="form-control form-control-color p-0 border-0"
                              style={{ width: "36px", height: "30px", cursor: "pointer" }}
                            />
                            <Form.Control
                              type="text"
                              size="sm"
                              value={appearance.windowFocusColor}
                              onChange={(e) => updateAppearanceField("windowFocusColor", e.target.value)}
                              className="font-monospace text-uppercase"
                              style={{ width: "85px" }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </Col>

                  {/* SAĞ SÜTUN: MENÜ, ALIŞ VE SATIŞ BAŞLIĞI */}
                  <Col xs={12} lg={6}>
                    <div className="d-flex flex-column gap-3 h-100">
                      {/* Menü Görünümü */}
                      <div className="p-3 rounded-3 border bg-light">
                        <div className="d-flex align-items-center justify-content-between pb-2 border-bottom mb-2">
                          <Form.Check
                            type="checkbox"
                            id="modal_enableMenuTheme"
                            label={<span className="fw-bold text-dark">Menü & Sidebar</span>}
                            checked={appearance.enableMenuTheme}
                            onChange={(e) =>
                              updateAppearanceField("enableMenuTheme", e.target.checked)
                            }
                          />
                        </div>

                        <div className="d-flex flex-column gap-2">
                          <div className="d-flex align-items-center justify-content-between p-2 bg-white rounded border">
                            <span className="small fw-semibold text-secondary">Menü zemin rengi</span>
                            <div className="d-flex align-items-center gap-2">
                              <input
                                type="color"
                                value={appearance.menuBgColor}
                                onChange={(e) => updateAppearanceField("menuBgColor", e.target.value)}
                                className="form-control form-control-color p-0 border-0"
                                style={{ width: "36px", height: "30px", cursor: "pointer" }}
                              />
                              <Form.Control
                                type="text"
                                size="sm"
                                value={appearance.menuBgColor}
                                onChange={(e) => updateAppearanceField("menuBgColor", e.target.value)}
                                className="font-monospace text-uppercase"
                                style={{ width: "85px" }}
                              />
                            </div>
                          </div>

                          <div className="d-flex align-items-center justify-content-between p-2 bg-white rounded border">
                            <span className="small fw-semibold text-secondary">Seçilen zemin rengi</span>
                            <div className="d-flex align-items-center gap-2">
                              <input
                                type="color"
                                value={appearance.menuSelectedBgColor}
                                onChange={(e) => updateAppearanceField("menuSelectedBgColor", e.target.value)}
                                className="form-control form-control-color p-0 border-0"
                                style={{ width: "36px", height: "30px", cursor: "pointer" }}
                              />
                              <Form.Control
                                type="text"
                                size="sm"
                                value={appearance.menuSelectedBgColor}
                                onChange={(e) => updateAppearanceField("menuSelectedBgColor", e.target.value)}
                                className="font-monospace text-uppercase"
                                style={{ width: "85px" }}
                              />
                            </div>
                          </div>

                          {/* Menü Fontu */}
                          <div className="d-flex align-items-center justify-content-between p-2 bg-white rounded border">
                            <span className="small fw-semibold text-secondary">Menü fontu</span>
                            <FontSelectDropdown
                              value={appearance.menuFont}
                              onChange={(val) => updateAppearanceField("menuFont", val)}
                            />
                          </div>

                          {/* Menü Başlık Fontu */}
                          <div className="d-flex align-items-center justify-content-between p-2 bg-white rounded border">
                            <span className="small fw-semibold text-secondary">Menü başlık fontu</span>
                            <FontSelectDropdown
                              value={appearance.menuHeaderFont}
                              onChange={(val) => updateAppearanceField("menuHeaderFont", val)}
                            />
                          </div>

                          <div className="d-flex align-items-center justify-content-between p-2 bg-white rounded border">
                            <span className="small fw-semibold text-secondary">Başlık zemin rengi</span>
                            <div className="d-flex align-items-center gap-2">
                              <input
                                type="color"
                                value={appearance.menuHeaderBgColor}
                                onChange={(e) => updateAppearanceField("menuHeaderBgColor", e.target.value)}
                                className="form-control form-control-color p-0 border-0"
                                style={{ width: "36px", height: "30px", cursor: "pointer" }}
                              />
                              <Form.Control
                                type="text"
                                size="sm"
                                value={appearance.menuHeaderBgColor}
                                onChange={(e) => updateAppearanceField("menuHeaderBgColor", e.target.value)}
                                className="font-monospace text-uppercase"
                                style={{ width: "85px" }}
                              />
                            </div>
                          </div>

                          <div className="d-flex align-items-center justify-content-between p-2 bg-white rounded border">
                            <span className="small fw-semibold text-secondary">Arka plan rengi</span>
                            <div className="d-flex align-items-center gap-2">
                              <input
                                type="color"
                                value={appearance.menuBackdropColor}
                                onChange={(e) => updateAppearanceField("menuBackdropColor", e.target.value)}
                                className="form-control form-control-color p-0 border-0"
                                style={{ width: "36px", height: "30px", cursor: "pointer" }}
                              />
                              <Form.Control
                                type="text"
                                size="sm"
                                value={appearance.menuBackdropColor}
                                onChange={(e) => updateAppearanceField("menuBackdropColor", e.target.value)}
                                className="font-monospace text-uppercase"
                                style={{ width: "85px" }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Alış Başlığı */}
                      <div className="p-3 rounded-3 border bg-light">
                        <div className="d-flex align-items-center justify-content-between pb-2 border-bottom mb-2">
                          <Form.Check
                            type="checkbox"
                            id="modal_enableBuyHeaderTheme"
                            label={<span className="fw-bold text-dark">Alış Başlığı</span>}
                            checked={appearance.enableBuyHeaderTheme}
                            onChange={(e) =>
                              updateAppearanceField("enableBuyHeaderTheme", e.target.checked)
                            }
                          />
                        </div>
                        <Row className="g-2">
                          <Col xs={6}>
                            <div className="p-2 bg-white rounded border d-flex align-items-center justify-content-between">
                              <span className="small text-secondary">Zemin</span>
                              <input
                                type="color"
                                value={appearance.buyHeaderBgColor}
                                onChange={(e) =>
                                  updateAppearanceField("buyHeaderBgColor", e.target.value)
                                }
                                className="form-control form-control-color p-0 border-0"
                                style={{ width: "30px", height: "26px" }}
                              />
                            </div>
                          </Col>
                          <Col xs={6}>
                            <div className="p-2 bg-white rounded border d-flex align-items-center justify-content-between">
                              <span className="small text-secondary">Yazı</span>
                              <input
                                type="color"
                                value={appearance.buyHeaderTextColor}
                                onChange={(e) =>
                                  updateAppearanceField("buyHeaderTextColor", e.target.value)
                                }
                                className="form-control form-control-color p-0 border-0"
                                style={{ width: "30px", height: "26px" }}
                              />
                            </div>
                          </Col>
                        </Row>
                      </div>

                      {/* Satış Başlığı */}
                      <div className="p-3 rounded-3 border bg-light">
                        <div className="d-flex align-items-center justify-content-between pb-2 border-bottom mb-2">
                          <Form.Check
                            type="checkbox"
                            id="modal_enableSellHeaderTheme"
                            label={<span className="fw-bold text-dark">Satış Başlığı</span>}
                            checked={appearance.enableSellHeaderTheme}
                            onChange={(e) =>
                              updateAppearanceField("enableSellHeaderTheme", e.target.checked)
                            }
                          />
                        </div>
                        <Row className="g-2">
                          <Col xs={6}>
                            <div className="p-2 bg-white rounded border d-flex align-items-center justify-content-between">
                              <span className="small text-secondary">Zemin</span>
                              <input
                                type="color"
                                value={appearance.sellHeaderBgColor}
                                onChange={(e) =>
                                  updateAppearanceField("sellHeaderBgColor", e.target.value)
                                }
                                className="form-control form-control-color p-0 border-0"
                                style={{ width: "30px", height: "26px" }}
                              />
                            </div>
                          </Col>
                          <Col xs={6}>
                            <div className="p-2 bg-white rounded border d-flex align-items-center justify-content-between">
                              <span className="small text-secondary">Yazı</span>
                              <input
                                type="color"
                                value={appearance.sellHeaderTextColor}
                                onChange={(e) =>
                                  updateAppearanceField("sellHeaderTextColor", e.target.value)
                                }
                                className="form-control form-control-color p-0 border-0"
                                style={{ width: "30px", height: "26px" }}
                              />
                            </div>
                          </Col>
                        </Row>
                      </div>
                    </div>
                  </Col>
                </Row>
              </div>
            </Tab.Pane>
          </Tab.Content>
        </Tab.Container>
      </Modal.Body>

      <Modal.Footer className="py-2 px-3 border-top bg-light d-flex align-items-center justify-content-between">
        <Button
          variant="outline-secondary"
          size="sm"
          onClick={handleSyncWithPano}
          className="d-flex align-items-center gap-1.5"
          title="Program zemin rengini vitrin TV fiyat panosuna aktarır"
        >
          <IconDeviceDesktop size={15} /> Pano Zemin Rengiyle Eşitle
        </Button>

        <div className="d-flex align-items-center gap-2">
          {activeTab === "custom" && (
            <Button
              variant="primary"
              size="sm"
              onClick={handleSaveAllAppearance}
              className="fw-semibold px-3"
            >
              Tüm Değişiklikleri Kaydet & Uygula
            </Button>
          )}
          <Button variant="secondary" size="sm" onClick={onHide}>
            Kapat
          </Button>
        </div>
      </Modal.Footer>
    </Modal>
  );
};

export default ThemeSettingsModal;
