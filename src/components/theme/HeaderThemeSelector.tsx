import React, { useState } from "react";
import { Dropdown, Badge } from "react-bootstrap";
import {
  IconPalette,
  IconSparkles,
  IconCheck,
  IconAdjustments,
} from "@tabler/icons-react";
import { useAuth } from "../../context/AuthContext";
import {
  THEME_PRESETS,
  ThemePreset,
  getActivePresetId,
  applyThemePreset,
} from "../../services/themePresetService";
import ThemeSettingsModal from "./ThemeSettingsModal";

export const HeaderThemeSelector: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const [showModal, setShowModal] = useState<boolean>(false);

  const activePresetId = getActivePresetId(user?.appearance);
  const activePreset = THEME_PRESETS.find((p) => p.id === activePresetId) || THEME_PRESETS[0];

  const handleSelect = async (preset: ThemePreset) => {
    await applyThemePreset(preset, user?.appearance, refreshUser);
  };

  return (
    <>
      <Dropdown align="end" className="d-inline-block">
        <Dropdown.Toggle
          variant="light"
          size="sm"
          className="d-flex align-items-center gap-1.5 border rounded-2 px-2 py-1 bg-white shadow-none header-theme-btn"
          id="header-theme-selector-dropdown"
          title="Görünüm ve Tema Değiştir"
          style={{ height: "32px" }}
        >
          <div
            className="rounded-circle border d-flex align-items-center justify-content-center"
            style={{
              width: "16px",
              height: "16px",
              backgroundColor: activePreset.previewAccent || "#6366f1",
            }}
          />
          <IconPalette size={16} className="text-secondary d-none d-sm-inline" />
          <span
            className="fw-semibold text-truncate d-none d-md-inline text-dark"
            style={{ fontSize: "12px", maxWidth: "140px" }}
          >
            {activePreset.name.split(" (")[0]}
          </span>
        </Dropdown.Toggle>

        <Dropdown.Menu
          className="shadow-lg border rounded-3 p-1 dropdown-menu-end"
          style={{ minWidth: "260px", maxHeight: "420px", overflowY: "auto", zIndex: 1060 }}
        >
          <div className="px-2 py-1.5 border-bottom mb-1 d-flex align-items-center justify-content-between">
            <span className="fw-bold small text-dark d-flex align-items-center gap-1">
              <IconSparkles size={15} className="text-warning" /> Hızlı Tema Seçimi
            </span>
            <Badge bg="light" text="dark" className="border">
              {THEME_PRESETS.length} Tema
            </Badge>
          </div>

          <div className="d-flex flex-column gap-0.5">
            {THEME_PRESETS.map((preset) => {
              const isCurrent = activePresetId === preset.id;
              return (
                <Dropdown.Item
                  key={preset.id}
                  onClick={() => handleSelect(preset)}
                  className={`d-flex align-items-center justify-content-between py-1.5 px-2 rounded-2 ${
                    isCurrent ? "bg-primary bg-opacity-10 fw-bold text-primary" : "text-dark"
                  }`}
                  style={{ fontSize: "12.5px" }}
                >
                  <div className="d-flex align-items-center gap-2 overflow-hidden">
                    {/* Color Preview Swatch */}
                    <div
                      className="rounded-circle border flex-shrink-0"
                      style={{
                        width: "14px",
                        height: "14px",
                        backgroundColor: preset.previewAccent,
                        boxShadow: `0 0 0 2px ${preset.previewBg}`,
                      }}
                    />
                    <span className="text-truncate" style={{ maxWidth: "180px" }}>
                      {preset.name}
                    </span>
                  </div>

                  {isCurrent && (
                    <IconCheck size={14} className="text-primary flex-shrink-0 ms-1" strokeWidth={3} />
                  )}
                </Dropdown.Item>
              );
            })}
          </div>

          <Dropdown.Divider className="my-1" />

          <Dropdown.Item
            onClick={() => setShowModal(true)}
            className="d-flex align-items-center gap-2 py-1.5 px-2 text-primary fw-semibold rounded-2"
            style={{ fontSize: "12.5px" }}
          >
            <IconAdjustments size={15} />
            <span>Detaylı Görünüm & Renk Ayarları...</span>
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown>

      {/* Full Modal */}
      <ThemeSettingsModal
        show={showModal}
        onHide={() => setShowModal(false)}
      />
    </>
  );
};

export default HeaderThemeSelector;
