import React from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { IconLock } from "@tabler/icons-react";
import { useAuth } from "../../context/AuthContext";
import { UrunOzellikleri, sayfaErisimi, sayfaKapaliMi } from "../../config/modulKatalogu";
import { useUrunOzellikleri } from "../../hooks/useUrunOzellikleri";
import { useKullaniciYetkisi } from "../../hooks/useKullaniciYetkisi";
import { anaMenuAcik } from "../../../Backend/src/services/yetki/kullaniciYetkiKural";

/** lisans: firmaya kapalı sayfa; yetki: kullanıcının menü yetkisinde olmayan sayfa */
const KapaliUyarisi: React.FC<{ neden?: "lisans" | "yetki" }> = ({ neden = "lisans" }) => (
  <div className="d-flex flex-column align-items-center justify-content-center text-center py-5">
    <IconLock size={44} className="text-muted mb-3" />
    <h5 className="mb-2">{neden === "yetki" ? "Bu sayfaya yetkiniz yok" : "Bu sayfa hesabınıza açık değil"}</h5>
    <p className="text-muted mb-3">
      {neden === "yetki" ? "Menü yetkiniz için sistem yöneticinize başvurunuz." : "Kullanmak için hizmet sağlayıcınızla iletişime geçiniz."}
    </p>
    <Link to="/dashboard" className="btn btn-outline-secondary btn-sm">
      Ana sayfaya dön
    </Link>
  </div>
);

/**
 * Yönetim panelinden firmaya kapatılmış ya da kullanıcının menü yetkisinde olmayan bir sayfaya adres çubuğundan gidilirse
 * sayfa yerine bu uyarı gösterilir. Menü ve üst çubuk kapalı öğeleri zaten çizmez; bu, adresi elle yazan kullanıcı içindir.
 */
const ModulKorumasi: React.FC = () => {
  const { user } = useAuth();
  const yetki = useKullaniciYetkisi();
  const { pathname } = useLocation();

  if (sayfaKapaliMi(user?.merkez?.moduller, pathname)) return <KapaliUyarisi />;
  if (!sayfaErisimi(user?.merkez?.moduller, yetki, pathname)) return <KapaliUyarisi neden="yetki" />;
  return <Outlet />;
};

/**
 * Menüde maddesi olmayan sayfalar (TV katalog gibi) için: ilgili ürün özelliği lisansta yoksa aynı uyarı; anaMenu verilirse
 * kullanıcının o ana menü yetkisi de aranır.
 */
export const OzellikKorumasi: React.FC<{ ozellik: keyof UrunOzellikleri; anaMenu?: string }> = ({ ozellik, anaMenu }) => {
  const acik = useUrunOzellikleri()[ozellik];
  const yetki = useKullaniciYetkisi();
  if (!acik) return <KapaliUyarisi />;
  if (anaMenu && !anaMenuAcik(yetki, anaMenu)) return <KapaliUyarisi neden="yetki" />;
  return <Outlet />;
};

export default ModulKorumasi;
