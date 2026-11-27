import React from "react";
import { useAuth } from "../../context/AuthContext";
import { AuthService } from "../../services/authService";
import DovizFisiPage from "./DovizFisiPage";
import DovizFisiSatirGridPage from "./DovizFisiSatirGridPage";

export const DovizFisiRouter: React.FC = () => {
  const { user } = useAuth();
  const satirModu = Boolean(
    user?.dovizFisiSatirModu ?? AuthService.getUser()?.dovizFisiSatirModu
  );
  return satirModu ? <DovizFisiSatirGridPage /> : <DovizFisiPage />;
};

export default DovizFisiRouter;
