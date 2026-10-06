import React, { useEffect, useState } from "react";
import LisansKilitPenceresi, { LisansKilitBilgisi } from "./LisansKilitPenceresi";

/**
 * Kurulum sürümünde program çalışırken lisans kilitlenirse (saat geri alındı, süre doldu…) API 423 döner;
 * apiClient "likya_lisans_kilit" olayını yayar, bu bileşen kapatılamayan kilit penceresini açar.
 * Lisans yüklenince sayfa yenilenir.
 */
const LisansKilitDinleyici: React.FC = () => {
  const [bilgi, setBilgi] = useState<LisansKilitBilgisi | null>(null);

  useEffect(() => {
    const dinle = (e: Event) => {
      const d = (e as CustomEvent).detail || {};
      setBilgi({ mesaj: d.mesaj, neden: d.neden, iletisim: d.iletisim, makineKimligi: d.makineKimligi });
    };
    window.addEventListener("likya_lisans_kilit", dinle);
    return () => window.removeEventListener("likya_lisans_kilit", dinle);
  }, []);

  return <LisansKilitPenceresi bilgi={bilgi} yuklendi={() => window.location.reload()} />;
};

export default LisansKilitDinleyici;
