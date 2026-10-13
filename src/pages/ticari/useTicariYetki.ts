import { useEffect, useState } from "react";
import { TicariService } from "../../services/ticariService";

/** Stok yönetim yetkisi (docs/TICARI_ISLEMLER_YOL_HARITASI.md, T21): sistem yöneticisi ya da Stok Ayarları'nda yetki verilen kullanıcı */
export function useTicariYetki() {
  const [durum, setDurum] = useState<{ yukleniyor: boolean; yonetebilir: boolean; sistemYoneticisi: boolean }>({ yukleniyor: true, yonetebilir: false, sistemYoneticisi: false });
  useEffect(() => {
    let iptal = false;
    TicariService.yetki()
      .then((y) => !iptal && setDurum({ yukleniyor: false, ...y }))
      .catch(() => !iptal && setDurum({ yukleniyor: false, yonetebilir: false, sistemYoneticisi: false }));
    return () => { iptal = true; };
  }, []);
  return durum;
}

export const YETKI_YOK_MESAJI = "Bu ekran için stok yönetim yetkiniz yok. Sistem yöneticisi Ticari İşlemler › Stok Ayarları'ndan yetki verebilir.";
