import React from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { Button } from "react-bootstrap";
import {
  IconLayoutDashboard,
  IconBuildingStore,
  IconUsers,
  IconWifi,
  IconLogin2,
  IconListDetails,
  IconShieldLock,
  IconKey,
  IconLogout,
} from "@tabler/icons-react";
import { useAdminAuth } from "../context/AdminAuthContext";

const MENU = [
  { yol: "/", baslik: "Pano", ikon: <IconLayoutDashboard size={18} />, tam: true },
  { yol: "/firmalar", baslik: "Firmalar", ikon: <IconBuildingStore size={18} />, tam: false },
  { yol: "/kullanicilar", baslik: "Kullanıcılar", ikon: <IconUsers size={18} />, tam: false },
  { yol: "/cevrimici", baslik: "Çevrimiçi", ikon: <IconWifi size={18} />, tam: false },
  { yol: "/giris-gecmisi", baslik: "Giriş Geçmişi", ikon: <IconLogin2 size={18} />, tam: false },
  { yol: "/islem-kaydi", baslik: "İşlem Kaydı", ikon: <IconListDetails size={18} />, tam: false },
  { yol: "/adminler", baslik: "Adminler", ikon: <IconShieldLock size={18} />, tam: false },
  { yol: "/sifre-degistir", baslik: "Şifre Değiştir", ikon: <IconKey size={18} />, tam: false },
];

const AdminLayout: React.FC = () => {
  const { admin, cikis } = useAdminAuth();
  const navigate = useNavigate();
  const kilitli = !!admin?.sifreDegismeli;

  const cikisYap = async () => {
    await cikis();
    navigate("/giris", { replace: true });
  };

  return (
    <div className="adm-kabuk">
      <aside className="adm-yan">
        <div className="adm-marka">
          Likya Kuyum
          <small>Yönetim Paneli</small>
        </div>
        <nav className="adm-menu">
          {MENU.filter((m) => !kilitli || m.yol === "/sifre-degistir").map((m) => (
            <NavLink key={m.yol} to={m.yol} end={m.tam} className={({ isActive }) => (isActive ? "aktif" : "")}>
              {m.ikon}
              <span>{m.baslik}</span>
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="adm-govde">
        <header className="adm-ust">
          <div>
            <strong>{admin?.adSoyad}</strong>
            <span className="text-muted ms-2">@{admin?.kullaniciAdi}</span>
          </div>
          <Button variant="outline-secondary" size="sm" onClick={cikisYap}>
            <IconLogout size={16} className="me-1" />
            Çıkış
          </Button>
        </header>
        <main className="adm-icerik">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
