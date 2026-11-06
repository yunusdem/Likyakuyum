import React, { useContext, useEffect, useState } from "react";
import { UNSAFE_NavigationContext } from "react-router-dom";
import { Button, Modal } from "react-bootstrap";
import { IconAlertTriangle } from "@tabler/icons-react";

/**
 * Vezne fiş sayfalarından (Sarraf / Döviz / Perakende - Kayıt & Düzeltme)
 * başka bir sayfaya geçişte veya tarayıcı sekmesi/penceresi kapatılırken
 * "Yine de Kapat / Vazgeç" uyarısı gösterir.
 */
export function useSayfaCikisUyarisi(aktif: boolean = true) {
  const { navigator } = useContext(UNSAFE_NavigationContext);
  const [bekleyenGecis, setBekleyenGecis] = useState<(() => void) | null>(null);

  useEffect(() => {
    if (!aktif) return;

    const tarayici = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
      return "";
    };
    window.addEventListener("beforeunload", tarayici);

    const nav = navigator as any;
    const push = nav.push;
    const replace = nav.replace;
    const go = nav.go;

    const hedefYol = (to: any): string => {
      try {
        if (typeof to === "string") return new URL(to, window.location.href).pathname;
        return to?.pathname || window.location.pathname;
      } catch {
        return "";
      }
    };

    const sar = (asil: (...a: any[]) => void) => (...a: any[]) => {
      // Aynı sayfada kalan geçişler (sorgu parametresi temizleme vb.) sorulmaz
      if (hedefYol(a[0]) === window.location.pathname) {
        return asil.apply(nav, a);
      }
      setBekleyenGecis(() => () => asil.apply(nav, a));
    };

    nav.push = sar(push);
    nav.replace = sar(replace);
    if (typeof go === "function") {
      nav.go = (...a: any[]) => {
        setBekleyenGecis(() => () => go.apply(nav, a));
      };
    }

    return () => {
      window.removeEventListener("beforeunload", tarayici);
      nav.push = push;
      nav.replace = replace;
      if (typeof go === "function") {
        nav.go = go;
      }
    };
  }, [aktif, navigator]);

  return {
    acik: Boolean(bekleyenGecis),
    vazgec: () => setBekleyenGecis(null),
    yineDeKapat: () => {
      const g = bekleyenGecis;
      setBekleyenGecis(null);
      g?.();
    },
  };
}

interface SayfaCikisUyarisiModalProps {
  acik: boolean;
  vazgec: () => void;
  yineDeKapat: () => void;
}

export const SayfaCikisUyarisiModal: React.FC<SayfaCikisUyarisiModalProps> = ({
  acik,
  vazgec,
  yineDeKapat,
}) => (
  <Modal show={acik} onHide={vazgec} centered size="sm">
    <Modal.Header closeButton className="py-2 bg-warning-subtle border-bottom">
      <Modal.Title className="fs-6 fw-bold d-flex align-items-center gap-2 text-dark">
        <IconAlertTriangle size={18} className="text-warning" />
        Sayfadan Çıkış Uyarısı
      </Modal.Title>
    </Modal.Header>
    <Modal.Body className="py-3">
      <div className="fw-semibold mb-1 text-dark" style={{ fontSize: "13px" }}>
        Bu sayfadan ayrılmak istediğinize emin misiniz?
      </div>
      <div className="small text-muted">
        Sayfayı kapatırsanız kaydedilmemiş bilgileriniz kaybolabilir.
      </div>
    </Modal.Body>
    <Modal.Footer className="py-2 d-flex justify-content-end gap-2">
      <Button variant="secondary" size="sm" autoFocus onClick={vazgec}>
        Vazgeç
      </Button>
      <Button variant="danger" size="sm" onClick={yineDeKapat}>
        Yine de Kapat
      </Button>
    </Modal.Footer>
  </Modal>
);

