import React, { useEffect, useRef, useState } from "react";
import { Toast, ToastContainer } from "react-bootstrap";
import { Link, useLocation } from "react-router-dom";
import { apiClient } from "../../services/apiClient";
import { useMobilYetkisi } from "./useMobilYetkisi";

/**
 * Yeni mobil emir bildirimi (docs/MOBIL_CARI_YOL_HARITASI.md V7): Mobil modülü açık firmada 20 saniyede bir bekleyen emir
 * sayısına bakar; yeni emir gelince sağ altta bildirim çıkar (Mobil Emirler ekranındayken çıkmaz). E-posta buna ektir.
 */
const MobilEmirBildirimi: React.FC = () => {
  const { modulAcik } = useMobilYetkisi();
  const { pathname } = useLocation();
  const [bildirim, setBildirim] = useState<{ sayi: number; emirId: number } | null>(null);
  const son = useRef<number | null>(null);

  useEffect(() => {
    if (!modulAcik) return;
    let iptal = false;
    const bak = async () => {
      try {
        const r = await apiClient.get<{ sayi: number; sonEmirId: number | null }>("/mobil-yonetim/emirler/ozet", undefined, { silent: true });
        const d = r.data;
        if (iptal || !d) return;
        if (son.current !== null && d.sonEmirId && d.sonEmirId > son.current && d.sayi > 0) setBildirim({ sayi: d.sayi, emirId: d.sonEmirId });
        if (d.sonEmirId) son.current = Math.max(son.current ?? 0, d.sonEmirId);
        else if (son.current === null) son.current = 0;
      } catch {
        /* modül kapalı / oturum yok: sessiz */
      }
    };
    void bak();
    const t = setInterval(() => void bak(), 20_000);
    return () => {
      iptal = true;
      clearInterval(t);
    };
  }, [modulAcik]);

  if (!bildirim || pathname.startsWith("/mobil/emirler")) return null;
  return (
    <ToastContainer position="bottom-end" className="p-3" style={{ zIndex: 2000, position: "fixed" }}>
      <Toast bg="warning" onClose={() => setBildirim(null)} autohide delay={30_000}>
        <Toast.Header>
          <strong className="me-auto">Yeni mobil emir #{bildirim.emirId}</strong>
        </Toast.Header>
        <Toast.Body>
          Onay bekleyen {bildirim.sayi} emir var.{" "}
          <Link to="/mobil/emirler" onClick={() => setBildirim(null)}>
            Mobil Emirler
          </Link>
        </Toast.Body>
      </Toast>
    </ToastContainer>
  );
};

export default MobilEmirBildirimi;
