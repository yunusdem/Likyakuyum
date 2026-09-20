import React from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { IconLock } from "@tabler/icons-react";
import { useAuth } from "../../context/AuthContext";
import { sayfaKapaliMi } from "../../config/modulKatalogu";

/**
 * Yönetim panelinden firmaya kapatılmış bir sayfaya adres çubuğundan gidilirse sayfa yerine bu uyarı gösterilir.
 * Menü ve üst çubuk kapalı öğeleri zaten çizmez; bu, adresi elle yazan kullanıcı içindir.
 */
const ModulKorumasi: React.FC = () => {
  const { user } = useAuth();
  const { pathname } = useLocation();

  if (!sayfaKapaliMi(user?.merkez?.moduller, pathname)) return <Outlet />;

  return (
    <div className="d-flex flex-column align-items-center justify-content-center text-center py-5">
      <IconLock size={44} className="text-muted mb-3" />
      <h5 className="mb-2">Bu sayfa hesabınıza açık değil</h5>
      <p className="text-muted mb-3">Kullanmak için hizmet sağlayıcınızla iletişime geçiniz.</p>
      <Link to="/dashboard" className="btn btn-outline-secondary btn-sm">
        Ana sayfaya dön
      </Link>
    </div>
  );
};

export default ModulKorumasi;
