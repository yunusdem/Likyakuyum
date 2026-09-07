import React from "react";
import { Button } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import { IconLogout } from "@tabler/icons-react";
import { useAuth } from "../../context/AuthContext";

const UserMenu: React.FC = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <Button
      variant="outline-danger"
      size="sm"
      onClick={handleLogout}
      className="d-flex align-items-center gap-1.5 px-3 py-1.5 rounded-3 fw-medium"
      style={{
        fontSize: "0.85rem",
        transition: "all 0.15s ease",
      }}
      title="Sistemden Çıkış Yap"
    >
      <IconLogout size={17} strokeWidth={1.8} />
      <span>Çıkış yap</span>
    </Button>
  );
};

export default UserMenu;
