import React, { useState } from "react";
import { Button } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import { IconLogout } from "@tabler/icons-react";
import { useAuth } from "../../context/AuthContext";
import LogoutConfirmModal from "../../components/common/LogoutConfirmModal";

const UserMenu: React.FC = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleConfirmLogout = async () => {
    try {
      setIsLoggingOut(true);
      await logout();
      setShowConfirm(false);
      navigate("/login", { replace: true });
    } catch {
      setIsLoggingOut(false);
    }
  };

  return (
    <>
      <Button
        variant="outline-danger"
        size="sm"
        onClick={() => setShowConfirm(true)}
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

      <LogoutConfirmModal
        show={showConfirm}
        onHide={() => !isLoggingOut && setShowConfirm(false)}
        onConfirm={handleConfirmLogout}
        isLoading={isLoggingOut}
      />
    </>
  );
};

export default UserMenu;
