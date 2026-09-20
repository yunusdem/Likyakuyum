import React from "react";
import { Button } from "react-bootstrap";

interface Props {
  sayfa: number;
  boyut: number;
  toplam: number;
  degistir: (sayfa: number) => void;
}

const Sayfalama: React.FC<Props> = ({ sayfa, boyut, toplam, degistir }) => {
  const sonSayfa = Math.max(1, Math.ceil(toplam / boyut));
  if (toplam <= boyut) return <div className="text-muted small mt-3">{toplam} kayıt</div>;
  return (
    <div className="d-flex justify-content-between align-items-center mt-3">
      <span className="text-muted small">
        {toplam} kayıt · sayfa {sayfa} / {sonSayfa}
      </span>
      <div className="d-flex gap-2">
        <Button size="sm" variant="outline-secondary" disabled={sayfa <= 1} onClick={() => degistir(sayfa - 1)}>
          Önceki
        </Button>
        <Button size="sm" variant="outline-secondary" disabled={sayfa >= sonSayfa} onClick={() => degistir(sayfa + 1)}>
          Sonraki
        </Button>
      </div>
    </div>
  );
};

export default Sayfalama;
