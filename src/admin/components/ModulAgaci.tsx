import React, { useMemo, useState } from "react";
import { Button, Form } from "react-bootstrap";
import { ModulKaydi } from "../services/adminApi";

/**
 * Modül ağacı: kullanıcı uygulamasının sol menüsü + üst kısayol çubuğu (tek kaynak: src/config/modulKatalogu.ts).
 * Firma Detay › Modüller ve Paket Tanımları aynı ağacı kullanır.
 */

export const agacYapisi = (katalog: ModulKaydi[]) => {
  const cocuklar = new Map<string | null, ModulKaydi[]>();
  const ustler = new Map<string, string | null>();
  for (const m of katalog) {
    ustler.set(m.modulKodu, m.ustKodu);
    cocuklar.set(m.ustKodu, [...(cocuklar.get(m.ustKodu) || []), m]);
  }
  const altSoyu = (kod: string): string[] => (cocuklar.get(kod) || []).flatMap((m) => [m.modulKodu, ...altSoyu(m.modulKodu)]);
  const yaprakMi = (kod: string) => !(cocuklar.get(kod) || []).length;
  return { cocuklar, ustler, altSoyu, yaprakMi };
};

/** Tik değişikliği: açılan öğenin tüm üstleri ve altları açılır; kapanan öğenin altları kapanır, altı kalmayan üst kapanır. */
export const tikUygula = (yapi: ReturnType<typeof agacYapisi>, acik: Set<string>, kod: string, ac: boolean): Set<string> => {
  const { cocuklar, ustler, altSoyu } = yapi;
  const yeni = new Set(acik);
  if (ac) {
    for (let u: string | null | undefined = kod; u; u = ustler.get(u)) yeni.add(u);
    altSoyu(kod).forEach((k) => yeni.add(k));
  } else {
    yeni.delete(kod);
    altSoyu(kod).forEach((k) => yeni.delete(k));
    for (let u = ustler.get(kod); u; u = ustler.get(u)) {
      if ((cocuklar.get(u) || []).some((m) => yeni.has(m.modulKodu))) break;
      yeni.delete(u);
    }
  }
  return yeni;
};

interface Props {
  katalog: ModulKaydi[];
  acik: Set<string>;
  onDegistir: (yeni: Set<string>) => void;
  disabled?: boolean;
  /** Form.Check id öneki (aynı sayfada iki ağaç olursa çakışmasın) */
  kimlik: string;
  /** Satırın sağında gösterilecek rozet (ör. "Elle açıldı") */
  rozet?: (m: ModulKaydi) => React.ReactNode;
}

const ModulAgaci: React.FC<Props> = ({ katalog, acik, onDegistir, disabled, kimlik, rozet }) => {
  const yapi = useMemo(() => agacYapisi(katalog), [katalog]);
  const [kapaliGruplar, setKapaliGruplar] = useState<Set<string>>(new Set());

  const dugum = (m: ModulKaydi, derinlik: number): React.ReactNode => {
    const altlar = yapi.cocuklar.get(m.modulKodu) || [];
    const altYapraklar = yapi.altSoyu(m.modulKodu).filter(yapi.yaprakMi);
    const acikAlt = altYapraklar.filter((k) => acik.has(k)).length;
    const daraltilmis = kapaliGruplar.has(m.modulKodu);

    return (
      <div key={m.modulKodu} className={derinlik === 0 ? "border rounded mb-2" : ""}>
        <div
          className={`d-flex align-items-center gap-2 ${derinlik === 0 ? "px-3 py-2 bg-light" : "py-1"}`}
          style={{ paddingLeft: derinlik === 0 ? undefined : 12 + derinlik * 22 }}
        >
          <Form.Check
            type={altlar.length ? "switch" : "checkbox"}
            id={`${kimlik}-${m.modulKodu}`}
            checked={acik.has(m.modulKodu)}
            disabled={disabled}
            onChange={(e) => onDegistir(tikUygula(yapi, acik, m.modulKodu, e.target.checked))}
            label={<span className={derinlik === 0 ? "fw-semibold" : ""}>{m.baslik}</span>}
            className="mb-0 flex-grow-1"
          />
          {rozet?.(m)}
          {altlar.length > 0 && (
            <>
              <span className="text-muted small text-nowrap">
                {acikAlt} / {altYapraklar.length}
              </span>
              <Button
                variant="link"
                size="sm"
                className="p-0 text-decoration-none"
                onClick={() => {
                  const y = new Set(kapaliGruplar);
                  daraltilmis ? y.delete(m.modulKodu) : y.add(m.modulKodu);
                  setKapaliGruplar(y);
                }}
              >
                {daraltilmis ? "Göster" : "Gizle"}
              </Button>
            </>
          )}
        </div>
        {altlar.length > 0 && !daraltilmis && <div className={derinlik === 0 ? "py-2" : ""}>{altlar.map((c) => dugum(c, derinlik + 1))}</div>}
      </div>
    );
  };

  return <>{(yapi.cocuklar.get(null) || []).map((m) => dugum(m, 0))}</>;
};

export default ModulAgaci;
