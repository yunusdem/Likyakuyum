import React, { useRef } from "react";
import { Button } from "react-bootstrap";
import { IconPhotoPlus } from "@tabler/icons-react";
import { EK_AZAMI_ADET, EK_TURLERI, ekDenetle } from "../../services/destekService";

export interface SecilenGorsel {
  dosya: File;
  onizleme: string;
}

interface Props {
  secilenler: SecilenGorsel[];
  onDegis: (yeni: SecilenGorsel[]) => void;
  onHata: (mesaj: string) => void;
  kucuk?: boolean;
}

/** Mesaja görsel ekleme (K6: png/jpg/webp, ≤ 3 MB, en çok 3). */
const GorselSecici: React.FC<Props> = ({ secilenler, onDegis, onHata, kucuk }) => {
  const girdi = useRef<HTMLInputElement>(null);

  const sec = (liste: FileList | null) => {
    if (!liste || liste.length === 0) return;
    const dosyalar = Array.from(liste);
    const hata = ekDenetle(dosyalar, secilenler.length);
    if (hata) return onHata(hata);
    onDegis([...secilenler, ...dosyalar.map((d) => ({ dosya: d, onizleme: URL.createObjectURL(d) }))]);
    if (girdi.current) girdi.current.value = "";
  };

  const kaldir = (i: number) => {
    URL.revokeObjectURL(secilenler[i].onizleme);
    onDegis(secilenler.filter((_, j) => j !== i));
  };

  return (
    <div className="d-flex align-items-center gap-2 flex-wrap">
      <input ref={girdi} type="file" accept={EK_TURLERI.join(",")} multiple hidden onChange={(e) => sec(e.target.files)} />
      <Button
        variant="outline-secondary"
        size="sm"
        type="button"
        disabled={secilenler.length >= EK_AZAMI_ADET}
        onClick={() => girdi.current?.click()}
        title="Görsel ekle (PNG/JPG, en çok 3 MB)"
      >
        <IconPhotoPlus size={16} className={kucuk ? "" : "me-1"} />
        {!kucuk && "Görsel ekle"}
      </Button>
      {secilenler.length > 0 && (
        <div className="destek-onizleme">
          {secilenler.map((g, i) => (
            <div className="destek-onizleme-kutu" key={g.onizleme}>
              <img src={g.onizleme} alt={g.dosya.name} />
              <button type="button" onClick={() => kaldir(i)} title="Kaldır">
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default GorselSecici;
