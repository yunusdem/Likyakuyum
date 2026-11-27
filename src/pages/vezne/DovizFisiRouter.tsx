import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "react-bootstrap";
import { IconEdit, IconFilePlus, IconLogout } from "@tabler/icons-react";
import { useAuth } from "../../context/AuthContext";
import { AuthService } from "../../services/authService";
import DovizFisiPage from "./DovizFisiPage";
import DovizFisiSatirGridPage from "./DovizFisiSatirGridPage";

export const DovizFisiRouter: React.FC = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const satirModu = Boolean(
    user?.dovizFisiSatirModu ?? AuthService.getUser()?.dovizFisiSatirModu
  );
  const sadeceDoviz = Boolean(
    user?.sadeceDovizFisiGorebilir ?? AuthService.getUser()?.sadeceDovizFisiGorebilir
  );
  const isDuzeltme = location.pathname.includes("duzeltme");

  const page = satirModu ? <DovizFisiSatirGridPage /> : <DovizFisiPage />;

  if (!sadeceDoviz) {
    return page;
  }

  return (
    <div className="w-100">
      <div className="d-flex align-items-center justify-content-between gap-2 mb-1 px-1">
        <div className="d-flex align-items-center gap-2">
          {isDuzeltme ? (
            <Button
              variant="primary"
              size="sm"
              className="d-inline-flex align-items-center gap-1 py-1 px-2.5 fw-semibold"
              style={{ fontSize: "12px" }}
              onClick={() => navigate("/vezne/doviz-fisi-kayit")}
            >
              <IconFilePlus size={15} /> Kayıt Sayfası
            </Button>
          ) : (
            <Button
              variant="outline-primary"
              size="sm"
              className="d-inline-flex align-items-center gap-1 py-1 px-2.5 fw-semibold bg-white"
              style={{ fontSize: "12px" }}
              onClick={() => navigate("/vezne/doviz-fisi-duzeltme")}
            >
              <IconEdit size={15} /> Düzeltme Sayfası
            </Button>
          )}
        </div>
        <Button
          variant="outline-danger"
          size="sm"
          className="d-inline-flex align-items-center gap-1 py-1 px-2 bg-white"
          style={{ fontSize: "12px" }}
          onClick={() => void logout()}
          title="Oturumu Kapat"
        >
          <IconLogout size={14} /> Çıkış
        </Button>
      </div>
      {page}
    </div>
  );
};

export default DovizFisiRouter;
