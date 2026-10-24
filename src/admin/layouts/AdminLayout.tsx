import React, { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { Badge, Button } from "react-bootstrap";
import {
  IconLayoutDashboard,
  IconBuildingStore,
  IconUsers,
  IconWifi,
  IconLogin2,
  IconListDetails,
  IconCreditCard,
  IconShieldLock,
  IconKey,
  IconLogout,
  IconSettings,
  IconPackage,
  IconMessage2,
  IconSpeakerphone,
  IconPackages,
  IconRocket,
} from "@tabler/icons-react";
import { useAdminAuth } from "../context/AdminAuthContext";
import { adminApi, DagitimOzet, DestekOzet } from "../services/adminApi";
import LogoutConfirmModal from "../../components/common/LogoutConfirmModal";

const MENU = [
  { yol: "/", baslik: "Pano", ikon: <IconLayoutDashboard size={18} />, tam: true },
  { yol: "/firmalar", baslik: "Firmalar", ikon: <IconBuildingStore size={18} />, tam: false },
  { yol: "/paketler", baslik: "Paket Tanımları", ikon: <IconPackages size={18} />, tam: false },
  { yol: "/kullanicilar", baslik: "Kullanıcılar", ikon: <IconUsers size={18} />, tam: false },
  { yol: "/cevrimici", baslik: "Çevrimiçi", ikon: <IconWifi size={18} />, tam: false },
  { yol: "/giris-gecmisi", baslik: "Giriş Geçmişi", ikon: <IconLogin2 size={18} />, tam: false },
  { yol: "/islem-kaydi", baslik: "İşlem Kaydı", ikon: <IconListDetails size={18} />, tam: false },
  { yol: "/destek", baslik: "Destek", ikon: <IconMessage2 size={18} />, tam: false },
  { yol: "/bildirimler", baslik: "Bildirimler", ikon: <IconSpeakerphone size={18} />, tam: false },
  { yol: "/pos", baslik: "POS Entegrasyonu", ikon: <IconCreditCard size={18} />, tam: false },
  { yol: "/adminler", baslik: "Adminler", ikon: <IconShieldLock size={18} />, tam: false },
  { yol: "/surumler", baslik: "Sürümler", ikon: <IconPackage size={18} />, tam: false },
  { yol: "/dagitim", baslik: "Dağıtım", ikon: <IconRocket size={18} />, tam: false },
  { yol: "/ayarlar", baslik: "Ayarlar", ikon: <IconSettings size={18} />, tam: false },
  { yol: "/sifre-degistir", baslik: "Şifre Değiştir", ikon: <IconKey size={18} />, tam: false },
];

const AdminLayout: React.FC = () => {
  const { admin, cikis } = useAdminAuth();
  const navigate = useNavigate();
  const kilitli = !!admin?.sifreDegismeli;
  const [destek, setDestek] = useState<DestekOzet | null>(null);
  const [dagitim, setDagitim] = useState<DagitimOzet | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Destek sayacı: okunmamış talep/sistem kaydı + taslak bildirim (30 sn'de bir; K13)
  useEffect(() => {
    if (kilitli) return;
    let aktif = true;
    const yukle = () => {
      adminApi.destekOzet().then((o) => aktif && setDestek(o)).catch(() => undefined);
      // Dağıtım: çalışan iş ya da görülmemiş hata (docs/CANLI_TEST_AYRIMI_YOL_HARITASI.md)
      adminApi.dagitimOzet().then((o) => aktif && setDagitim(o)).catch(() => undefined);
    };
    yukle();
    const z = setInterval(() => document.visibilityState === "visible" && yukle(), 30_000);
    const dinle = () => yukle();
    window.addEventListener("likya-admin-destek-degisti", dinle);
    window.addEventListener("likya-admin-dagitim-degisti", dinle);
    return () => {
      aktif = false;
      clearInterval(z);
      window.removeEventListener("likya-admin-destek-degisti", dinle);
      window.removeEventListener("likya-admin-dagitim-degisti", dinle);
    };
  }, [kilitli]);

  const cikisYap = () => {
    setShowConfirm(true);
  };

  const handleConfirmCikis = async () => {
    try {
      setIsLoggingOut(true);
      await cikis();
      setShowConfirm(false);
      navigate("/giris", { replace: true });
    } catch {
      setIsLoggingOut(false);
    }
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
              {m.yol === "/destek" && !!destek?.okunmamis && (
                <Badge bg="danger" pill className="ms-auto">
                  {destek.okunmamis}
                </Badge>
              )}
              {m.yol === "/dagitim" && !!dagitim?.gorulmemisHata && (
                <Badge bg="danger" pill className="ms-auto" title="Hatalı dağıtım">
                  {dagitim.gorulmemisHata}
                </Badge>
              )}
              {m.yol === "/dagitim" && !dagitim?.gorulmemisHata && !!dagitim?.calisan && (
                <Badge bg="warning" text="dark" pill className="ms-auto" title="Dağıtım çalışıyor">
                  …
                </Badge>
              )}
              {m.yol === "/bildirimler" && !!destek?.taslakBildirim && (
                <Badge bg="warning" text="dark" pill className="ms-auto" title="Taslak bildirim">
                  {destek.taslakBildirim}
                </Badge>
              )}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="adm-govde">
        <header className="adm-ust">
          <div className="d-flex align-items-center gap-3">
            <div>
              <strong>{admin?.adSoyad}</strong>
              <span className="text-muted ms-2">@{admin?.kullaniciAdi}</span>
            </div>
            {!!destek?.okunmamis && (
              <NavLink to="/destek" className="text-decoration-none small">
                <IconMessage2 size={16} className="me-1" />
                {destek.okunmamis} yeni talep / kayıt
              </NavLink>
            )}
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

      <LogoutConfirmModal
        show={showConfirm}
        onHide={() => !isLoggingOut && setShowConfirm(false)}
        onConfirm={handleConfirmCikis}
        isLoading={isLoggingOut}
      />
    </div>
  );
};

export default AdminLayout;
