import React, { useContext, useEffect, useState } from "react";
import { UNSAFE_NavigationContext } from "react-router-dom";
import { Button, Modal, Spinner } from "react-bootstrap";
import { IconAlertTriangle } from "@tabler/icons-react";

/**
 * Fiş kesilmeden ekrandan çıkma uyarısı. Sayfa yenileme / sekme kapatma tarayıcının kendi uyarısıyla (beforeunload),
 * uygulama içi geçiş (menü, üst çubuk, modül sekmesi, navigate) router'ın push/replace'i araya alınarak sorulur.
 * BrowserRouter'da useBlocker olmadığı için navigator geçici olarak sarılır; uyarı kalkınca eski hâline döner.
 */
export function useCikisUyarisi(aktif: boolean) {
  const { navigator } = useContext(UNSAFE_NavigationContext);
  const [bekleyenGecis, setBekleyenGecis] = useState<(() => void) | null>(null);

  useEffect(() => {
    if (!aktif) return;
    const tarayici = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", tarayici);

    const nav = navigator as any;
    const push = nav.push;
    const replace = nav.replace;
    const hedefYol = (to: any): string => {
      try {
        if (typeof to === "string") return new URL(to, window.location.href).pathname;
        return to?.pathname || window.location.pathname;
      } catch {
        return "";
      }
    };
    const sar = (asil: (...a: any[]) => void) => (...a: any[]) => {
      // Aynı sayfada kalan geçişler (sorgu parametresi vb.) sorulmaz
      if (hedefYol(a[0]) === window.location.pathname) return asil.apply(nav, a);
      setBekleyenGecis(() => () => asil.apply(nav, a));
    };
    nav.push = sar(push);
    nav.replace = sar(replace);
    return () => {
      window.removeEventListener("beforeunload", tarayici);
      nav.push = push;
      nav.replace = replace;
    };
  }, [aktif, navigator]);

  return {
    bekleyenGecis,
    vazgec: () => setBekleyenGecis(null),
    devam: () => {
      const g = bekleyenGecis;
      setBekleyenGecis(null);
      g?.();
    },
  };
}

interface Props {
  acik: boolean;
  ozet: string;
  bekletiliyor: boolean;
  kal: () => void;
  beklet: () => void;
  cik: () => void;
}

export const CikisUyarisiModal: React.FC<Props> = ({ acik, ozet, bekletiliyor, kal, beklet, cik }) => (
  <Modal show={acik} onHide={kal} centered>
    <Modal.Header closeButton className="py-2">
      <Modal.Title className="fs-6 d-flex align-items-center gap-2"><IconAlertTriangle size={18} className="text-warning" />Fiş kesilmedi</Modal.Title>
    </Modal.Header>
    <Modal.Body>
      <div className="fw-semibold mb-1">Sepet kaydedilmedi.</div>
      <div className="small text-muted">{ozet}</div>
      <div className="small mt-2">Çıkarsanız sepet silinir. Sonra devam etmek için beklemeye alabilirsiniz.</div>
    </Modal.Body>
    <Modal.Footer className="py-2">
      <Button variant="primary" autoFocus onClick={kal}>Sayfada kal</Button>
      <Button variant="warning" disabled={bekletiliyor} onClick={beklet}>{bekletiliyor ? <Spinner size="sm" className="me-1" /> : null}Beklet ve çık</Button>
      <Button variant="outline-danger" disabled={bekletiliyor} onClick={cik}>Sepeti sil, çık</Button>
    </Modal.Footer>
  </Modal>
);
