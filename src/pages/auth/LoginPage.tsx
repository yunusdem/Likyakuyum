import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Form, Button, Alert, Spinner, Row, Col, InputGroup } from "react-bootstrap";
import {
  IconUser,
  IconLock,
  IconEye,
  IconEyeOff,
  IconAlertCircle,
  IconArrowRight,
  IconDatabase,
  IconServer,
  IconBuildingStore,
  IconChartBar,
  IconReceipt2,
  IconCheck,
  IconCloud,
} from "@tabler/icons-react";
import { ComboboxInput } from "../../components/common/ComboboxInput";
import { useAuth } from "../../context/AuthContext";
import {
  getConnectionMode,
  setConnectionMode,
  ConnectionMode,
} from "../../services/apiClient";

const PREDEFINED_SERVERS = ["localhost", "127.0.0.1"];
const PREDEFINED_DBS = ["R2016_dvz"];

export const LoginPage: React.FC = () => {
  const [rememberMe, setRememberMe] = useState<boolean>(() => {
    const saved = localStorage.getItem("kuyumcu_erp_remember_me");
    return saved === "true";
  });

  const [username, setUsername] = useState<string>(() => {
    const savedRemember = localStorage.getItem("kuyumcu_erp_remember_me");
    if (savedRemember === "true") {
      return localStorage.getItem("kuyumcu_erp_remember_user") || "";
    }
    return "";
  });

  // Şifre alanı her zaman kesinlikle boş olmalı
  const [password, setPassword] = useState<string>("");

  // Çalışma Modu (Bulut Veritabanı [Varsayılan] veya Yerel Veritabanı)
  const [connectionMode, setConnectionModeState] = useState<ConnectionMode>(() => {
    const saved = localStorage.getItem("kuyumcu_erp_connection_mode");
    if (saved === "cloud" || saved === "local") return saved;
    return "cloud";
  });

  // Bulut SQL Server adresi
  const [cloudServer, setCloudServer] = useState<string>(() => {
    const saved = localStorage.getItem("kuyumcu_erp_cloud_server") || localStorage.getItem("kuyumcu_erp_last_server");
    if (saved && saved !== "test" && saved.trim()) return saved.trim();
    return "localhost";
  });

  // Yerel SQL Server bağlantı bilgileri (Müşterinin Dükkan IP'si)
  const [localServer, setLocalServer] = useState<string>(() => {
    const saved = localStorage.getItem("kuyumcu_erp_local_server");
    if (saved && saved !== "test" && saved.trim()) return saved.trim();
    return "";
  });

  const [dbName, setDbName] = useState<string>(() => {
    const saved = localStorage.getItem("kuyumcu_erp_local_db") || localStorage.getItem("kuyumcu_erp_last_db");
    if (saved && saved !== "test" && saved.trim()) return saved.trim();
    return "R2016_dvz";
  });

  // MSSQL Veritabanı Kullanıcı Adı ve Şifresi (DB_USER, DB_PASSWORD)
  const [dbUser, setDbUser] = useState<string>(() => {
    return localStorage.getItem("kuyumcu_erp_db_user") || "sa";
  });
  const [dbPassword, setDbPassword] = useState<string>(() => {
    return localStorage.getItem("kuyumcu_erp_db_password") || "";
  });
  const [showDbPassword, setShowDbPassword] = useState<boolean>(false);
  const [showOtherFields, setShowOtherFields] = useState<boolean>(false);

  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleConnectionModeChange = (mode: ConnectionMode) => {
    setConnectionModeState(mode);
    setConnectionMode(mode);
    setErrorMsg(null);
  };

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const stateFrom = (location.state as any)?.from?.pathname;
  const from = stateFrom && stateFrom !== "/" && stateFrom !== "/login" ? stateFrom : "/dashboard";

  // Tarayıcıların ve Google'ın şifreyi otomatik doldurmasını engellemek için açılışta sıfırla
  useEffect(() => {
    setPassword("");
    const timer = setTimeout(() => {
      setPassword("");
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const handleCloudServerChange = (val: string) => {
    setCloudServer(val);
    localStorage.setItem("kuyumcu_erp_cloud_server", val);
    localStorage.setItem("kuyumcu_erp_last_server", val);
  };

  const handleLocalServerChange = (val: string) => {
    setLocalServer(val);
    localStorage.setItem("kuyumcu_erp_local_server", val);
  };

  const handleDbChange = (val: string) => {
    setDbName(val);
    localStorage.setItem("kuyumcu_erp_local_db", val);
    localStorage.setItem("kuyumcu_erp_last_db", val);
  };

  const handleDbUserChange = (val: string) => {
    setDbUser(val);
    localStorage.setItem("kuyumcu_erp_db_user", val);
  };

  const handleDbPasswordChange = (val: string) => {
    setDbPassword(val);
    localStorage.setItem("kuyumcu_erp_db_password", val);
  };

  const handleUsernameChange = (val: string) => {
    const clean = val.replace(/\s+/g, "");
    setUsername(clean);
    if (rememberMe) {
      localStorage.setItem("kuyumcu_erp_remember_user", clean);
    }
  };

  const handleRememberMeChange = (checked: boolean) => {
    setRememberMe(checked);
    localStorage.setItem("kuyumcu_erp_remember_me", checked ? "true" : "false");
    if (!checked) {
      localStorage.removeItem("kuyumcu_erp_remember_user");
    } else if (username.trim()) {
      localStorage.setItem("kuyumcu_erp_remember_user", username.trim());
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanUsername = username.trim().replace(/\s+/g, "");
    if (!cleanUsername) {
      setErrorMsg("Lütfen kullanıcı adınızı giriniz.");
      return;
    }

    if (!password) {
      setErrorMsg("Lütfen şifrenizi giriniz.");
      return;
    }

    if (connectionMode === "local") {
      const cleanServer = localServer.trim();
      if (!cleanServer) {
        setErrorMsg("Yerel veritabanı modu için lütfen sunucu IP adresini (örn: 88.245.x.x,1433) giriniz.");
        return;
      }
      const cleanDb = dbName.trim() || "R2016_dvz";
      const cleanDbUser = dbUser.trim() || "sa";

      try {
        setIsLoading(true);

        localStorage.setItem("kuyumcu_erp_local_server", cleanServer);
        localStorage.setItem("kuyumcu_erp_local_db", cleanDb);
        localStorage.setItem("kuyumcu_erp_db_user", cleanDbUser);
        localStorage.setItem("kuyumcu_erp_db_password", dbPassword);
        localStorage.setItem("kuyumcu_erp_connection_mode", "local");

        if (rememberMe) {
          localStorage.setItem("kuyumcu_erp_remember_me", "true");
          localStorage.setItem("kuyumcu_erp_remember_user", cleanUsername);
        } else {
          localStorage.setItem("kuyumcu_erp_remember_me", "false");
          localStorage.removeItem("kuyumcu_erp_remember_user");
        }

        await login({
          username: cleanUsername,
          password,
          mode: "local",
          dbServer: cleanServer,
          dbName: cleanDb,
          dbUser: cleanDbUser,
          dbPassword,
        });

        navigate("/dashboard", { replace: true });
      } catch (err: any) {
        const msg = err.message || "Giriş başarısız. Lütfen yerel SQL Server bağlantı bilgilerinizi kontrol ediniz.";
        setErrorMsg(msg);
        if (msg.toLowerCase().includes("sql") || msg.toLowerCase().includes("login failed") || msg.toLowerCase().includes("veritabanı")) {
          setShowOtherFields(true);
        }
      } finally {
        setIsLoading(false);
      }
    } else {
      // Bulut Modu (Varsayılan)
      const cleanServer = cloudServer.trim() || "localhost";
      const cleanDb = dbName.trim() || "R2016_dvz";
      const cleanDbUser = dbUser.trim() || "sa";

      try {
        setIsLoading(true);
        localStorage.setItem("kuyumcu_erp_cloud_server", cleanServer);
        localStorage.setItem("kuyumcu_erp_last_server", cleanServer);
        localStorage.setItem("kuyumcu_erp_last_db", cleanDb);
        localStorage.setItem("kuyumcu_erp_db_user", cleanDbUser);
        localStorage.setItem("kuyumcu_erp_db_password", dbPassword);
        localStorage.setItem("kuyumcu_erp_connection_mode", "cloud");

        if (rememberMe) {
          localStorage.setItem("kuyumcu_erp_remember_me", "true");
          localStorage.setItem("kuyumcu_erp_remember_user", cleanUsername);
        } else {
          localStorage.setItem("kuyumcu_erp_remember_me", "false");
          localStorage.removeItem("kuyumcu_erp_remember_user");
        }

        await login({
          username: cleanUsername,
          password,
          mode: "cloud",
          dbServer: cleanServer,
          dbName: cleanDb,
          dbUser: cleanDbUser,
          dbPassword,
        });

        navigate("/dashboard", { replace: true });
      } catch (err: any) {
        const msg = err.message || "Giriş başarısız. Lütfen kullanıcı adı ve şifrenizi kontrol ediniz.";
        setErrorMsg(msg);
        if (msg.toLowerCase().includes("sql") || msg.toLowerCase().includes("login failed") || msg.toLowerCase().includes("veritabanı")) {
          setShowOtherFields(true);
        }
      } finally {
        setIsLoading(false);
      }
    }
  };


  return (
    <div
      className="min-vh-100 w-100 d-flex align-items-center justify-content-center p-3 p-md-4 login-page-wrapper"
      style={{
        background: "linear-gradient(135deg, #faf7f2 0%, #f3ede2 50%, #f7f3ea 100%)",
        fontFamily: "'Segoe UI', 'Inter', -apple-system, sans-serif",
      }}
    >
      <style>{`
        .custom-login-dropdown .dropdown-item:hover {
          background-color: #f7f3ea !important;
          color: #1c1917 !important;
        }
        .custom-login-dropdown .dropdown-item:active {
          background-color: #ede4d3 !important;
        }
        .login-form-panel .form-control:focus {
          border-color: #c88f18 !important;
          box-shadow: 0 0 0 0.2rem rgba(200, 143, 24, 0.18) !important;
        }
        .login-form-panel .form-check-input:checked {
          background-color: #c88f18 !important;
          border-color: #c88f18 !important;
        }
        .login-submit-btn {
          background: linear-gradient(135deg, #c88f18 0%, #9e640b 100%) !important;
          color: #ffffff !important;
          box-shadow: 0 4px 12px rgba(184, 123, 25, 0.28) !important;
          border: none !important;
          transition: all 0.2s ease !important;
        }
        .login-submit-btn:hover {
          background: linear-gradient(135deg, #d89e24 0%, #ad6f0e 100%) !important;
          box-shadow: 0 6px 16px rgba(184, 123, 25, 0.38) !important;
          transform: translateY(-1px) !important;
        }
        @media (max-width: 991.98px) {
          .login-page-wrapper {
            padding-top: max(7.5rem, 15vh) !important;
            padding-bottom: 5rem !important;
            align-items: flex-start !important;
          }
          .login-card-container {
            background: transparent !important;
            box-shadow: none !important;
            border: none !important;
          }
          .login-form-panel {
            border-radius: 1rem !important;
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.04) !important;
            border: 1px solid #e2e8f0 !important;
            margin-left: auto !important;
            margin-right: auto !important;
          }
          .login-brand-panel {
            border-radius: 1rem !important;
            box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.15), 0 8px 10px -6px rgba(15, 23, 42, 0.08) !important;
            border: 1px solid rgba(255, 255, 255, 0.1) !important;
            margin-top: 2rem !important;
            margin-left: auto !important;
            margin-right: auto !important;
          }
        }
      `}</style>
      {/* Background Decorative Circles */}
      <div
        className="position-absolute rounded-circle"
        style={{
          width: "450px",
          height: "450px",
          background: "radial-gradient(circle, rgba(200, 143, 24, 0.1) 0%, rgba(200, 143, 24, 0) 70%)",
          top: "5%",
          right: "5%",
          filter: "blur(40px)",
          pointerEvents: "none",
        }}
      />
      <div
        className="position-absolute rounded-circle"
        style={{
          width: "400px",
          height: "400px",
          background: "radial-gradient(circle, rgba(168, 101, 10, 0.08) 0%, rgba(168, 101, 10, 0) 70%)",
          bottom: "5%",
          left: "5%",
          filter: "blur(40px)",
          pointerEvents: "none",
        }}
      />

      {/* Main Login Card */}
      <div className="container position-relative z-1" style={{ maxWidth: "1120px" }}>
        <div
          className="row g-0 justify-content-center login-card-container rounded-4 overflow-hidden bg-white shadow-lg border"
          style={{ borderColor: "#ede4d3", boxShadow: "0 20px 40px -15px rgba(90, 50, 10, 0.1)" }}
        >
          {/* Left / Mobile Bottom Panel: Dashboard Matching Dark Slate Brand Area */}
          <div
            className="col-12 col-md-10 col-lg-5 order-2 order-lg-1 d-flex flex-column justify-content-between p-4 p-lg-5 text-white position-relative login-brand-panel"
            style={{
              background: "linear-gradient(160deg, #14120e 0%, #1f1a14 60%, #2b2218 100%)",
            }}
          >
            <div>
              {/* Brand Logo & Name */}
              <div className="mb-4">
                {/* Logo and Likya Kuyum side by side */}
                <div className="d-flex align-items-center mb-2">
                  <img
                    src="/images/logo/logo.svg"
                    alt="Likya Kuyum Logo"
                    className="flex-shrink-0 me-3"
                    style={{ width: "64px", height: "64px", objectFit: "contain" }}
                  />
                  <h3 className="fw-bold mb-0 letter-spacing-1" style={{ fontSize: "2rem", lineHeight: "1.15" }}>
                    <span className="brand-text-likya">Likya</span>{" "}
                    <span className="brand-text-kuyum">Kuyum</span>
                  </h3>
                </div>

                {/* Subtitle below */}
                <span className="small text-uppercase fw-semibold d-inline-block ps-1" style={{ color: "#e5b54f", fontSize: "0.78rem", letterSpacing: "1.2px" }}>
                  Döviz & Altın Yönetim Platformu
                </span>
              </div>

              {/* Tagline & Feature Highlights */}
              <div className="my-4 pt-2">
                <h4 className="fw-bold text-white mb-3" style={{ lineHeight: "1.3" }}>
                  Kurumsal Kuyumculuk ve Sarrafiye <br />
                  <span style={{ color: "#f5c344" }}>Entegrasyon Sistemi</span>
                </h4>
                <p className="small mb-4" style={{ color: "#d6cfc4", lineHeight: "1.6" }}>
                  Kasa, vezne, döviz kurları, cari hesaplar ve e-belge süreçlerinizi SQL veritabanı ile güvenle yönetin.
                </p>

                <div className="d-flex flex-column gap-3">
                  <div className="d-flex align-items-center gap-3 small">
                    <span
                      className="p-2 rounded-2 d-flex align-items-center justify-content-center flex-shrink-0"
                      style={{
                        backgroundColor: "rgba(229, 181, 79, 0.15)",
                        color: "#f5c344",
                        border: "1px solid rgba(229, 181, 79, 0.3)",
                      }}
                    >
                      <IconBuildingStore size={18} />
                    </span>
                    <span className="fw-medium text-white" style={{ fontSize: "0.875rem" }}>
                      Çoklu Veritabanı ve Sunucu Seçimi
                    </span>
                  </div>
                  <div className="d-flex align-items-center gap-3 small">
                    <span
                      className="p-2 rounded-2 d-flex align-items-center justify-content-center flex-shrink-0"
                      style={{
                        backgroundColor: "rgba(229, 181, 79, 0.15)",
                        color: "#f5c344",
                        border: "1px solid rgba(229, 181, 79, 0.3)",
                      }}
                    >
                      <IconChartBar size={18} />
                    </span>
                    <span className="fw-medium text-white" style={{ fontSize: "0.875rem" }}>
                      Canlı Kur ve Arbitraj Yönetimi
                    </span>
                  </div>
                  <div className="d-flex align-items-center gap-3 small">
                    <span
                      className="p-2 rounded-2 d-flex align-items-center justify-content-center flex-shrink-0"
                      style={{
                        backgroundColor: "rgba(229, 181, 79, 0.15)",
                        color: "#f5c344",
                        border: "1px solid rgba(229, 181, 79, 0.3)",
                      }}
                    >
                      <IconReceipt2 size={18} />
                    </span>
                    <span className="fw-medium text-white" style={{ fontSize: "0.875rem" }}>
                      E-Fatura, E-Arşiv & Masak Bildirimi
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Left Bottom Footer */}
            <div className="pt-3 border-top border-secondary border-opacity-25 d-flex align-items-center justify-content-end text-muted small" style={{ fontSize: "0.78rem" }}>
              <span style={{ color: "#94a3b8" }}>v2026 Enterprise</span>
            </div>
          </div>

          {/* Right / Mobile Top Panel: Clean Dashboard-Styled Form Area */}
          <div className="col-12 col-md-10 col-lg-7 order-1 order-lg-2 p-4 p-sm-5 d-flex flex-column justify-content-center bg-white login-form-panel">
            <div className="w-100" style={{ maxWidth: "520px", margin: "0 auto" }}>


              {/* Form Title */}
              <div className="text-center mb-3">
                <h3 className="fw-bold mb-1" style={{ color: "#784405" }}>Giriş Yap</h3>
              </div>

              {/* İki Seçenekli Çalışma Modu (Bulut Veritabanı ve Yerel Veritabanı) */}
              <div
                className="p-1 mb-4 rounded-3 d-flex align-items-center"
                style={{ backgroundColor: "#f3ede2", border: "1px solid #e7dcce" }}
              >
                <button
                  type="button"
                  className="btn btn-sm flex-fill py-2 px-3 border-0 rounded-2 fw-semibold d-flex align-items-center justify-content-center gap-2"
                  style={{
                    backgroundColor: connectionMode === "cloud" ? "#ffffff" : "transparent",
                    color: connectionMode === "cloud" ? "#9e640b" : "#78716c",
                    boxShadow: connectionMode === "cloud" ? "0 2px 5px rgba(0,0,0,0.08)" : "none",
                    fontSize: "0.85rem",
                    transition: "all 0.2s ease",
                  }}
                  onClick={() => handleConnectionModeChange("cloud")}
                >
                  <IconCloud size={18} className={connectionMode === "cloud" ? "text-warning" : ""} />
                  <span>Bulut Veritabanı</span>
                  {connectionMode === "cloud" && (
                    <span
                      className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 px-1.5 py-0.5 rounded"
                      style={{ fontSize: "10px" }}
                    >
                      Varsayılan
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  className="btn btn-sm flex-fill py-2 px-3 border-0 rounded-2 fw-semibold d-flex align-items-center justify-content-center gap-2"
                  style={{
                    backgroundColor: connectionMode === "local" ? "#ffffff" : "transparent",
                    color: connectionMode === "local" ? "#9e640b" : "#78716c",
                    boxShadow: connectionMode === "local" ? "0 2px 5px rgba(0,0,0,0.08)" : "none",
                    fontSize: "0.85rem",
                    transition: "all 0.2s ease",
                  }}
                  onClick={() => handleConnectionModeChange("local")}
                >
                  <IconServer size={18} className={connectionMode === "local" ? "text-warning" : ""} />
                  <span>Yerel Veritabanı</span>
                </button>
              </div>

              {/* Error Alert */}
              {errorMsg && (
                <Alert
                  variant="danger"
                  className="d-flex align-items-center gap-2 py-2 px-3 mb-3 rounded-3 border small"
                >
                  <IconAlertCircle size={18} className="flex-shrink-0 text-danger" />
                  <span>{errorMsg}</span>
                </Alert>
              )}

              {/* Login Form */}
              <Form onSubmit={handleSubmit} autoComplete="off">
                {/* Mod Bilgilendirme Rozeti */}
                {connectionMode === "cloud" ? (
                  <div
                    className="p-2.5 px-3 mb-3 rounded-3 d-flex align-items-center justify-content-between border"
                    style={{ backgroundColor: "#fcfaf7", borderColor: "#ede4d3" }}
                  >
                    <div className="d-flex align-items-center gap-2">
                      <div
                        className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
                        style={{
                          width: "30px",
                          height: "30px",
                          backgroundColor: "rgba(200, 143, 24, 0.12)",
                          color: "#9e640b",
                        }}
                      >
                        <IconCloud size={17} />
                      </div>
                      <div>
                        <div className="fw-semibold text-dark small" style={{ fontSize: "0.82rem" }}>
                          Merkezi Bulut Veritabanı Bağlantısı
                        </div>
                        <div className="text-muted" style={{ fontSize: "0.7rem" }}>
                          Sunucu SQL Server havuzu ve veritabanı ayarları aktiftir.
                        </div>
                      </div>
                    </div>
                    <span
                      className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 px-2 py-0.5 rounded d-flex align-items-center gap-1"
                      style={{ fontSize: "10.5px" }}
                    >
                      <IconCheck size={12} />
                      Aktif
                    </span>
                  </div>
                ) : (
                  <div
                    className="p-2.5 px-3 mb-3 rounded-3 d-flex align-items-center justify-content-between border"
                    style={{ backgroundColor: "#fdfbf7", borderColor: "#ede4d3" }}
                  >
                    <div className="d-flex align-items-center gap-2">
                      <div
                        className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
                        style={{
                          width: "30px",
                          height: "30px",
                          backgroundColor: "rgba(200, 143, 24, 0.15)",
                          color: "#854e0a",
                        }}
                      >
                        <IconServer size={17} />
                      </div>
                      <div>
                        <div className="fw-semibold text-dark small" style={{ fontSize: "0.82rem" }}>
                          Dükkan Yerel SQL Server Bağlantısı
                        </div>
                        <div className="text-muted" style={{ fontSize: "0.7rem" }}>
                          Dükkanınızın dış statik IP adresini (örn: 88.245.x.x,1433) yazınız.
                        </div>
                      </div>
                    </div>
                    <span
                      className="badge px-2 py-0.5 rounded"
                      style={{
                        backgroundColor: "rgba(200, 143, 24, 0.15)",
                        color: "#854e0a",
                        fontSize: "10.5px",
                      }}
                    >
                      Yerel Bağlantı
                    </span>
                  </div>
                )}

                {/* Sunucu Adı / IP */}
                <Form.Group as={Row} className="align-items-center mb-3">
                  <Col xs={12} sm={4} className="mb-1 mb-sm-0">
                    <Form.Label className="d-flex flex-column mb-0">
                      <span className="small fw-semibold text-secondary">
                        Sunucu Adı <span className="text-danger">*</span>
                      </span>
                      <span className="text-muted" style={{ fontSize: "0.7rem" }}>
                        {connectionMode === "cloud" ? "Seçin / Yazın" : "Statik IP / Host"}
                      </span>
                    </Form.Label>
                  </Col>
                  <Col xs={12} sm={8}>
                    {connectionMode === "cloud" ? (
                      <ComboboxInput
                        id="cloudServer"
                        value={cloudServer}
                        onChange={handleCloudServerChange}
                        options={PREDEFINED_SERVERS}
                        placeholder="localhost"
                        disabled={isLoading}
                        icon={<IconServer size={17} />}
                        headerTitle="Kayıtlı Sunucular"
                      />
                    ) : (
                      <InputGroup>
                        <InputGroup.Text className="bg-white border-end-0 text-muted px-2.5">
                          <IconServer size={17} />
                        </InputGroup.Text>
                        <Form.Control
                          type="text"
                          value={localServer}
                          disabled={isLoading}
                          onChange={(e) => handleLocalServerChange(e.target.value)}
                          placeholder="örn: 88.245.10.20,1433"
                          className="border-start-0 bg-white"
                          style={{ height: "40px", fontSize: "0.85rem" }}
                          autoComplete="off"
                        />
                      </InputGroup>
                    )}
                  </Col>
                </Form.Group>

                {/* Veritabanı */}
                <Form.Group as={Row} className="align-items-center mb-3">
                  <Col xs={12} sm={4} className="mb-1 mb-sm-0">
                    <Form.Label className="d-flex flex-column mb-0">
                      <span className="small fw-semibold text-secondary">
                        Veritabanı <span className="text-danger">*</span>
                      </span>
                      <span className="text-muted" style={{ fontSize: "0.7rem" }}>
                        Seçin / Yazın
                      </span>
                    </Form.Label>
                  </Col>
                  <Col xs={12} sm={8}>
                    <ComboboxInput
                      id="dbName"
                      value={dbName}
                      onChange={handleDbChange}
                      options={PREDEFINED_DBS}
                      placeholder="R2016_dvz"
                      disabled={isLoading}
                      icon={<IconDatabase size={17} />}
                      headerTitle="Kayıtlı Veritabanları"
                    />
                  </Col>
                </Form.Group>

                {/* Diğer İşlemler Butonu */}
                <Row className="mb-3">
                  <Col xs={12} sm={{ span: 8, offset: 4 }}>
                    <button
                      type="button"
                      onClick={() => setShowOtherFields(!showOtherFields)}
                      className="btn btn-link p-0 text-decoration-underline small fw-bold d-inline-flex align-items-center gap-1"
                      style={{
                        color: "#2563eb",
                        fontSize: "0.84rem",
                        textUnderlineOffset: "3px",
                        cursor: "pointer",
                      }}
                    >
                      <span>{showOtherFields ? "Diğer İşlemleri Gizle ←" : "Diğer İşlemler →"}</span>
                    </button>
                  </Col>
                </Row>

                {/* Veritabanı Kullanıcı Adı ve Şifre Alanları */}
                {showOtherFields && (
                  <div
                    className="p-3 p-sm-4 my-3 rounded-3 border"
                    style={{
                      backgroundColor: "#fdfbf7",
                      borderColor: "#ede4d3",
                      boxShadow: "inset 0 1px 3px rgba(0,0,0,0.02)",
                    }}
                  >
                    <div className="d-flex align-items-center gap-2 mb-3 pb-2 border-bottom border-secondary border-opacity-10">
                      <span
                        className="badge fw-semibold px-2 py-1"
                        style={{
                          backgroundColor: "rgba(200, 143, 24, 0.15)",
                          color: "#854e0a",
                          fontSize: "0.72rem",
                        }}
                      >
                        MSSQL Yetkilendirme
                      </span>
                      <span className="text-muted small" style={{ fontSize: "0.74rem" }}>
                        {connectionMode === "cloud"
                          ? "Bulut SQL Server Erişim Bilgileri"
                          : "Dükkan SQL Server Erişim Bilgileri"}
                      </span>
                    </div>

                    {/* SQL Kullanıcısı */}
                    <Form.Group as={Row} className="align-items-center mb-3">
                      <Col xs={12} sm={4} className="mb-1 mb-sm-0">
                        <Form.Label className="d-flex flex-column mb-0">
                          <span className="small fw-semibold text-secondary">
                            SQL Kullanıcısı <span className="text-danger">*</span>
                          </span>
                        </Form.Label>
                      </Col>
                      <Col xs={12} sm={8}>
                        <InputGroup>
                          <InputGroup.Text className="bg-white border-end-0 text-muted px-2.5">
                            <IconUser size={17} />
                          </InputGroup.Text>
                          <Form.Control
                            type="text"
                            value={dbUser}
                            disabled={isLoading}
                            onChange={(e) => handleDbUserChange(e.target.value)}
                            placeholder="sa"
                            className="border-start-0 bg-white"
                            style={{ height: "40px", fontSize: "0.85rem" }}
                            autoComplete="off"
                          />
                        </InputGroup>
                      </Col>
                    </Form.Group>

                    {/* SQL Şifresi */}
                    <Form.Group as={Row} className="align-items-center">
                      <Col xs={12} sm={4} className="mb-1 mb-sm-0">
                        <Form.Label className="d-flex flex-column mb-0">
                          <span className="small fw-semibold text-secondary">
                            SQL Şifresi
                          </span>
                        </Form.Label>
                      </Col>
                      <Col xs={12} sm={8}>
                        <InputGroup>
                          <InputGroup.Text className="bg-white border-end-0 text-muted px-2.5">
                            <IconLock size={17} />
                          </InputGroup.Text>
                          <Form.Control
                            type={showDbPassword ? "text" : "password"}
                            value={dbPassword}
                            disabled={isLoading}
                            onChange={(e) => handleDbPasswordChange(e.target.value)}
                            placeholder="SQL Şifresi"
                            className="border-start-0 border-end-0 bg-white"
                            style={{ height: "40px", fontSize: "0.85rem" }}
                            autoComplete="new-password"
                            name="no_autofill_db_pwd"
                          />
                          <Button
                            variant="outline-secondary"
                            tabIndex={-1}
                            onClick={() => setShowDbPassword(!showDbPassword)}
                            className="border-start-0 bg-white text-muted px-2.5"
                            style={{ borderColor: "#dee2e6" }}
                          >
                            {showDbPassword ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                          </Button>
                        </InputGroup>
                      </Col>
                    </Form.Group>
                  </div>
                )}

                {/* Kullanıcı Adı */}
                <Form.Group as={Row} className="align-items-center mb-3">
                  <Col xs={12} sm={4} className="mb-1 mb-sm-0">
                    <Form.Label className="d-flex flex-column mb-0">
                      <span className="small fw-semibold text-secondary">
                        Kullanıcı Adı <span className="text-danger">*</span>
                      </span>
                    </Form.Label>
                  </Col>
                  <Col xs={12} sm={8}>
                    <InputGroup>
                      <InputGroup.Text className="bg-light border-end-0 text-muted px-2.5">
                        <IconUser size={18} />
                      </InputGroup.Text>
                      <Form.Control
                        type="text"
                        autoFocus
                        value={username}
                        disabled={isLoading}
                        onChange={(e) => handleUsernameChange(e.target.value)}
                        placeholder=""
                        className="border-start-0 bg-white"
                        style={{ height: "42px" }}
                        autoComplete="username"
                      />
                    </InputGroup>
                  </Col>
                </Form.Group>

                {/* Şifre */}
                <Form.Group as={Row} className="align-items-center mb-3">
                  <Col xs={12} sm={4} className="mb-1 mb-sm-0">
                    <Form.Label className="d-flex flex-column mb-0">
                      <span className="small fw-semibold text-secondary">
                        Şifre <span className="text-danger">*</span>
                      </span>
                    </Form.Label>
                  </Col>
                  <Col xs={12} sm={8}>
                    <InputGroup>
                      <InputGroup.Text className="bg-light border-end-0 text-muted px-2.5">
                        <IconLock size={18} />
                      </InputGroup.Text>
                      <Form.Control
                        type={showPassword ? "text" : "password"}
                        name="no_autofill_pwd"
                        id="passwordInput"
                        autoComplete="new-password"
                        value={password}
                        disabled={isLoading}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder=""
                        className="border-start-0 border-end-0 bg-white"
                        style={{ height: "42px" }}
                        data-lpignore="true"
                        data-1p-ignore="true"
                      />
                      <Button
                        variant="outline-secondary"
                        tabIndex={-1}
                        onClick={() => setShowPassword(!showPassword)}
                        className="border-start-0 bg-light text-muted"
                        title={showPassword ? "Şifreyi Gizle" : "Şifreyi Göster"}
                      >
                        {showPassword ? <IconEyeOff size={18} /> : <IconEye size={18} />}
                      </Button>
                    </InputGroup>
                  </Col>
                </Form.Group>

                {/* Remember Me */}
                <Row className="mb-4">
                  <Col xs={12} sm={{ span: 8, offset: 4 }}>
                    <Form.Check
                      type="checkbox"
                      id="rememberMeCheck"
                      checked={rememberMe}
                      onChange={(e) => handleRememberMeChange(e.target.checked)}
                      label={<span className="small text-secondary">Beni hatırla</span>}
                    />
                  </Col>
                </Row>

                {/* Submit Button */}
                <Row className="mb-2">
                  <Col xs={12} sm={{ span: 8, offset: 4 }}>
                    <Button
                      type="submit"
                      disabled={isLoading}
                      className="w-100 py-2 fw-semibold d-flex align-items-center justify-content-center gap-2 rounded-3 login-submit-btn"
                      style={{ height: "44px" }}
                    >
                      {isLoading ? (
                        <>
                          <Spinner animation="border" size="sm" />
                          <span>Giriş Yapılıyor...</span>
                        </>
                      ) : (
                        <>
                          <span>Sisteme Giriş Yap</span>
                          <IconArrowRight size={18} />
                        </>
                      )}
                    </Button>
                  </Col>
                </Row>
              </Form>

              {/* Security Footer Note */}
              <div className="mt-4 pt-3 border-top text-center">
                <div className="d-inline-flex align-items-center gap-2 text-muted small" style={{ fontSize: "0.78rem" }}>
                  <img
                    src="/images/logo/logo.svg"
                    alt="Likya.Kuyum Logo"
                    className="flex-shrink-0"
                    style={{ width: "15px", height: "15px", objectFit: "contain" }}
                  />
                  <span><strong className="brand-text-likya">Likya</strong> <strong className="brand-text-kuyum">Kuyum</strong> Çoklu Veritabanı ve Oturum Yönetimi</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;

