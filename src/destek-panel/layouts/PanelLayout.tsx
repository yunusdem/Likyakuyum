import React, { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { Badge, Button } from "react-bootstrap";
import {
  IconMessage2,
  IconBuildingStore,
  IconSpeakerphone,
  IconUsersGroup,
  IconMessageBolt,
  IconChartBar,
  IconKey,
  IconLogout,
  IconVolume,
  IconVolumeOff,
} from "@tabler/icons-react";
import { usePanelAuth } from "../context/PanelAuthContext";
import { DESTEK_DEGISTI_OLAYI, panelApi, PanelOzet } from "../services/panelApi";
import LogoutConfirmModal from "../../components/common/LogoutConfirmModal";

const SES_ANAHTARI = "likya_destek_ses";
const BASLIK = "Likya Destek";

/** Kısa uyarı sesi (dosya gerekmez). Tarayıcı ilk tıklamadan önce sesi engelleyebilir; sessizce geçilir. */
const bipCal = () => {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new Ctx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.45);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.5);
    setTimeout(() => ctx.close().catch(() => undefined), 800);
  } catch {
    // ses yok
  }
};

const sesAcikMi = () => {
  try {
    return localStorage.getItem(SES_ANAHTARI) !== "0";
  } catch {
    return true;
  }
};

/** Destek paneli kabuğu: solda menü (ekip ve yönetim bölümleri ayrı), sayaçlar, yeni talep uyarısı (D18). */
const PanelLayout: React.FC = () => {
  const { personel, cikis } = usePanelAuth();
  const navigate = useNavigate();
  const kilitli = !!personel?.sifreDegismeli;
  const admin = personel?.rol === "ADMIN";
  const [ozet, setOzet] = useState<PanelOzet | null>(null);
  const [ses, setSes] = useState<boolean>(sesAcikMi);
  const [cikisSor, setCikisSor] = useState(false);
  const [cikiliyor, setCikiliyor] = useState(false);
  const onceki = useRef<PanelOzet | null>(null);
  const sesRef = useRef(ses);
  sesRef.current = ses;

  useEffect(() => {
    if (kilitli) return;
    let aktif = true;
    const yukle = () =>
      panelApi
        .ozet()
        .then((o) => {
          if (!aktif) return;
          const e = onceki.current;
          // Yeni talep geldi ya da okunmamış arttı: ses (açıksa)
          if (e && (o.sonTalepId > e.sonTalepId || o.okunmamis + o.sistemOkunmamis > e.okunmamis + e.sistemOkunmamis) && sesRef.current) bipCal();
          onceki.current = o;
          setOzet(o);
        })
        .catch(() => undefined);
    yukle();
    const z = setInterval(yukle, 20_000);
    window.addEventListener(DESTEK_DEGISTI_OLAYI, yukle);
    return () => {
      aktif = false;
      clearInterval(z);
      window.removeEventListener(DESTEK_DEGISTI_OLAYI, yukle);
    };
  }, [kilitli]);

  // Sekme başlığında bekleyen sayı (havuz + okunmamış)
  useEffect(() => {
    const n = ozet ? ozet.havuz + ozet.okunmamis + ozet.sistemOkunmamis : 0;
    document.title = n > 0 ? `(${n}) ${BASLIK}` : BASLIK;
  }, [ozet]);

  const sesDegistir = () => {
    const yeni = !ses;
    setSes(yeni);
    try {
      localStorage.setItem(SES_ANAHTARI, yeni ? "1" : "0");
    } catch {
      // tercih kaydedilemedi
    }
    if (yeni) bipCal();
  };

  const cikisYap = async () => {
    setCikiliyor(true);
    await cikis();
    setCikisSor(false);
    setCikiliyor(false);
    navigate("/giris", { replace: true });
  };

  const rozet = (sayi: number | undefined, renk = "danger", baslik?: string) =>
    sayi ? (
      <Badge bg={renk} text={renk === "warning" ? "dark" : undefined} pill className="ms-auto" title={baslik}>
        {sayi}
      </Badge>
    ) : null;

  const menuLink = (yol: string, baslik: string, ikon: React.ReactNode, ek?: React.ReactNode, tam = false) => (
    <NavLink key={yol} to={yol} end={tam} className={({ isActive }) => (isActive ? "aktif" : "")}>
      {ikon}
      <span>{baslik}</span>
      {ek}
    </NavLink>
  );

  return (
    <div className="adm-kabuk dsp-kabuk">
      <aside className="adm-yan">
        <div className="adm-marka">
          Likya Destek
          <small>{admin ? "Destek Admini" : "Destek Ekibi"}</small>
        </div>
        <nav className="adm-menu">
          {!kilitli && (
            <>
              {menuLink(
                "/",
                "Talepler",
                <IconMessage2 size={18} />,
                <span className="ms-auto d-flex gap-1">
                  {!!ozet?.havuz && (
                    <Badge bg="warning" text="dark" pill title="Atanmamış (havuz)">
                      {ozet.havuz}
                    </Badge>
                  )}
                  {!!(ozet && ozet.okunmamis + ozet.sistemOkunmamis) && (
                    <Badge bg="danger" pill title="Okunmamış">
                      {ozet.okunmamis + ozet.sistemOkunmamis}
                    </Badge>
                  )}
                </span>,
                true
              )}
              {menuLink("/musteriler", "Müşteriler", <IconBuildingStore size={18} />)}
              {menuLink("/bildirimler", "Bildirimler", <IconSpeakerphone size={18} />, rozet(ozet?.taslakBildirim, "warning", "Taslak bildirim"))}
              {admin && (
                <>
                  <div className="dsp-menu-baslik">Yönetim</div>
                  {menuLink("/personel", "Personel", <IconUsersGroup size={18} />)}
                  {menuLink("/hizli-cevaplar", "Hızlı Cevaplar", <IconMessageBolt size={18} />)}
                  {menuLink("/rapor", "Rapor", <IconChartBar size={18} />)}
                </>
              )}
            </>
          )}
          {menuLink("/sifre", "Şifre Değiştir", <IconKey size={18} />)}
        </nav>
      </aside>
      <div className="adm-govde">
        <header className="adm-ust">
          <div>
            <strong>{personel?.adSoyad}</strong> <span className="text-muted">@{personel?.kullaniciAdi}</span>
            {!admin && personel?.gorme === "ATANAN" && (
              <Badge bg="light" text="dark" className="ms-2 fw-normal border">
                Havuz + bana atananlar
              </Badge>
            )}
          </div>
          <div className="d-flex gap-2">
            <Button size="sm" variant="outline-secondary" onClick={sesDegistir} title={ses ? "Yeni talep sesi açık" : "Yeni talep sesi kapalı"}>
              {ses ? <IconVolume size={16} /> : <IconVolumeOff size={16} />}
            </Button>
            <Button size="sm" variant="outline-secondary" onClick={() => setCikisSor(true)}>
              <IconLogout size={16} className="me-1" />
              Çıkış
            </Button>
          </div>
        </header>
        <main className="adm-icerik">
          <Outlet />
        </main>
      </div>
      <LogoutConfirmModal show={cikisSor} onHide={() => setCikisSor(false)} onConfirm={cikisYap} isLoading={cikiliyor} />
    </div>
  );
};

export default PanelLayout;
