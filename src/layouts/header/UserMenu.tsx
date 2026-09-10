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
      className="d-flex align-items-center justify-content-center rounded-2"
      style={{
        width: "32px",
        height: "32px",
        padding: 0,
        transition: "all 0.15s ease",
      }}
      title="Çıkış Yap"
      aria-label="Çıkış Yap"
    >
      <IconLogout size={17} strokeWidth={1.8} />
    </Button>
  );
};

export default UserMenu;
