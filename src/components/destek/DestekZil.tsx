import React, { useCallback, useEffect, useState } from "react";
import { Button } from "react-bootstrap";
import { IconBell } from "@tabler/icons-react";
import { useLocation, useNavigate } from "react-router-dom";
import NoficationList from "../common/NoficationList";
import TalepOlusturModal from "./TalepOlusturModal";
import OnemliBildirimModal from "./OnemliBildirimModal";
import { DESTEK_DEGISTI_OLAYI, DestekService, KonuOzet, KullaniciOzet } from "../../services/destekService";
import "./destek.scss";

const TAZELEME_MS = 30_000; // K13

/** Üst çubuktaki zil: okunmamış sayacı, sağ panel, Talep Oluştur ve girişteki önemli bildirim penceresi. */
const DestekZil: React.FC = () => {
  const navigate = useNavigate();
  const konum = useLocation();
  const [ozet, setOzet] = useState<KullaniciOzet | null>(null);
  const [panelAcik, setPanelAcik] = useState(false);
  const [talepAcik, setTalepAcik] = useState(false);
  const [onemliBekleyen, setOnemliBekleyen] = useState<KonuOzet[] | null>(null);
  const [onemliGosterildi, setOnemliGosterildi] = useState(false);

  const yukle = useCallback(async () => {
    try {
      const o = await DestekService.ozet();
      setOzet(o);
      if (!onemliGosterildi && o.onemli.length > 0 && !konum.pathname.startsWith("/login")) {
        setOnemliBekleyen(o.onemli);
        setOnemliGosterildi(true);
      }
    } catch {
      /* zil sessiz kalır; bir sonraki tazelemede denenir */
    }
  }, [onemliGosterildi, konum.pathname]);

  useEffect(() => {
    yukle();
    const z = setInterval(() => document.visibilityState === "visible" && yukle(), TAZELEME_MS);
    const dinle = () => yukle();
    window.addEventListener(DESTEK_DEGISTI_OLAYI, dinle);
    return () => {
      clearInterval(z);
      window.removeEventListener(DESTEK_DEGISTI_OLAYI, dinle);
    };
  }, [yukle]);

  const sayi = ozet?.okunmamis ?? 0;

  return (
    <>
      <Button
        variant="ghost"
        className="position-relative btn-icon rounded-circle d-flex align-items-center justify-content-center text-secondary p-0"
        onClick={() => setPanelAcik(true)}
        title={ozet?.kurulu === false ? "Destek" : sayi > 0 ? `${sayi} okunmamış` : "Destek ve bildirimler"}
        style={{ width: "32px", height: "32px" }}
      >
        <IconBell size={18} />
        {sayi > 0 && (
          <span className="badge rounded-pill bg-danger destek-zil-rozet">
            {sayi > 99 ? "99+" : sayi}
            <span className="visually-hidden">okunmamış bildirim</span>
          </span>
        )}
      </Button>

      <NoficationList
        isOpen={panelAcik}
        onClose={() => setPanelAcik(false)}
        onTalepOlustur={() => {
          setPanelAcik(false);
          setTalepAcik(true);
        }}
        cevrimdisi={!!ozet?.cevrimdisi}
      />

      <TalepOlusturModal
        show={talepAcik}
        onHide={() => setTalepAcik(false)}
        onAcildi={(d) => {
          setTalepAcik(false);
          navigate(`/destek?konu=${d.konu.konuId}`);
        }}
      />

      {onemliBekleyen && onemliBekleyen.length > 0 && (
        <OnemliBildirimModal
          bildirimler={onemliBekleyen}
          onKapandi={() => {
            setOnemliBekleyen(null);
            yukle();
          }}
        />
      )}
    </>
  );
};

export default DestekZil;
