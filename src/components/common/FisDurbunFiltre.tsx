import React, { useMemo } from "react";
import { Form, Button, ButtonGroup } from "react-bootstrap";
import { IconFilterOff } from "@tabler/icons-react";
import {
  FisDurbunFiltreDegeri,
  TarihKisayolu,
  tarihAraligi,
  hangiKisayol,
  varsayilanDurbunFiltresi,
} from "../../utils/fisDurbunFiltre";

/** Ekranın desteklediği filtreler; verilmeyen gizlenir (docs/FIS_TARIH_VE_DURBUN_YOL_HARITASI.md D3, §5) */
export interface FisDurbunAlanlari {
  tarih?: boolean;
  vezne?: boolean;
  urun?: boolean;
  tip?: boolean;
  cari?: boolean;
  tutar?: boolean;
  belgeNo?: boolean;
}

export interface FisDurbunSecenek {
  deger: string;
  ad: string;
}

export interface FisDurbunEtiketleri {
  vezne?: string;
  urun?: string;
  tip?: string;
  cari?: string;
  tutar?: string;
  belgeNo?: string;
}

export interface FisDurbunFiltreProps {
  deger: FisDurbunFiltreDegeri;
  onChange: (yeni: FisDurbunFiltreDegeri) => void;
  alanlar: FisDurbunAlanlari;
  vezneler?: FisDurbunSecenek[];
  /** Verilmezse ürün filtresi metin kutusu olur (ad / kod araması) */
  urunler?: FisDurbunSecenek[];
  tipler?: FisDurbunSecenek[];
  etiketler?: FisDurbunEtiketleri;
}

const KISAYOLLAR: { k: TarihKisayolu; ad: string }[] = [
  { k: "bugun", ad: "Bugün" },
  { k: "dun", ad: "Dün" },
  { k: "buHafta", ad: "Bu hafta" },
  { k: "buAy", ad: "Bu ay" },
];

const kutu: React.CSSProperties = { fontSize: "12px", height: "28px" };
const etiket: React.CSSProperties = { fontSize: "11px", marginBottom: 1 };

export const FisDurbunFiltre: React.FC<FisDurbunFiltreProps> = ({ deger, onChange, alanlar, vezneler, urunler, tipler, etiketler }) => {
  const aktifKisayol = useMemo(() => hangiKisayol(deger.baslangic, deger.bitis), [deger.baslangic, deger.bitis]);
  const degis = (alan: keyof FisDurbunFiltreDegeri, v: string) => onChange({ ...deger, [alan]: v });
  const e = etiketler || {};

  return (
    <div data-lookup-filtre="1" className="border rounded bg-light px-2 py-1 mb-2">
      {alanlar.tarih && (
        <div className="d-flex flex-wrap align-items-end gap-2 mb-1">
          <div>
            <div className="text-muted" style={etiket}>Başlangıç</div>
            <Form.Control type="date" size="sm" style={{ ...kutu, width: 135 }} value={deger.baslangic} onChange={(ev) => degis("baslangic", ev.target.value)} />
          </div>
          <div>
            <div className="text-muted" style={etiket}>Bitiş</div>
            <Form.Control type="date" size="sm" style={{ ...kutu, width: 135 }} value={deger.bitis} onChange={(ev) => degis("bitis", ev.target.value)} />
          </div>
          <ButtonGroup size="sm">
            {KISAYOLLAR.map(({ k, ad }) => (
              <Button
                key={k}
                variant={aktifKisayol === k ? "primary" : "outline-secondary"}
                style={{ fontSize: "11.5px", height: "28px" }}
                onClick={() => onChange({ ...deger, ...tarihAraligi(k) })}
              >
                {ad}
              </Button>
            ))}
          </ButtonGroup>
          <Button
            size="sm"
            variant="outline-secondary"
            className="ms-auto d-flex align-items-center gap-1"
            style={{ fontSize: "11.5px", height: "28px" }}
            title="Filtreleri temizle (bu ay)"
            onClick={() => onChange(varsayilanDurbunFiltresi())}
          >
            <IconFilterOff size={14} /> Temizle
          </Button>
        </div>
      )}
      <div className="d-flex flex-wrap align-items-end gap-2">
        {alanlar.vezne && (
          <div>
            <div className="text-muted" style={etiket}>{e.vezne || "Vezne"}</div>
            <Form.Select size="sm" style={{ ...kutu, width: 150, paddingTop: 2, paddingBottom: 2 }} value={deger.vezneId} onChange={(ev) => degis("vezneId", ev.target.value)}>
              <option value="">Hepsi</option>
              {(vezneler || []).map((v) => (
                <option key={v.deger} value={v.deger}>{v.ad}</option>
              ))}
            </Form.Select>
          </div>
        )}
        {alanlar.urun && (
          <div>
            <div className="text-muted" style={etiket}>{e.urun || "Ürün"}</div>
            {urunler ? (
              <Form.Select size="sm" style={{ ...kutu, width: 150, paddingTop: 2, paddingBottom: 2 }} value={deger.urunId} onChange={(ev) => degis("urunId", ev.target.value)}>
                <option value="">Hepsi</option>
                {urunler.map((u) => (
                  <option key={u.deger} value={u.deger}>{u.ad}</option>
                ))}
              </Form.Select>
            ) : (
              <Form.Control size="sm" style={{ ...kutu, width: 150 }} placeholder="Ad / kod" value={deger.urun} onChange={(ev) => degis("urun", ev.target.value)} />
            )}
          </div>
        )}
        {alanlar.tip && (
          <div>
            <div className="text-muted" style={etiket}>{e.tip || "Tip"}</div>
            <Form.Select size="sm" style={{ ...kutu, width: 120, paddingTop: 2, paddingBottom: 2 }} value={deger.tip} onChange={(ev) => degis("tip", ev.target.value)}>
              <option value="">Hepsi</option>
              {(tipler || []).map((t) => (
                <option key={t.deger} value={t.deger}>{t.ad}</option>
              ))}
            </Form.Select>
          </div>
        )}
        {alanlar.cari && (
          <div>
            <div className="text-muted" style={etiket}>{e.cari || "Cari / ünvan / VKN"}</div>
            <Form.Control size="sm" style={{ ...kutu, width: 170 }} value={deger.cari} onChange={(ev) => degis("cari", ev.target.value)} />
          </div>
        )}
        {alanlar.tutar && (
          <div>
            <div className="text-muted" style={etiket}>{e.tutar || "Tutar"}</div>
            <div className="d-flex align-items-center gap-1">
              <Form.Control size="sm" inputMode="decimal" style={{ ...kutu, width: 85 }} placeholder="En az" value={deger.tutarMin} onChange={(ev) => degis("tutarMin", ev.target.value)} />
              <span className="text-muted small">–</span>
              <Form.Control size="sm" inputMode="decimal" style={{ ...kutu, width: 85 }} placeholder="En çok" value={deger.tutarMax} onChange={(ev) => degis("tutarMax", ev.target.value)} />
            </div>
          </div>
        )}
        {alanlar.belgeNo && (
          <div>
            <div className="text-muted" style={etiket}>{e.belgeNo || "Belge / seri no"}</div>
            <Form.Control size="sm" style={{ ...kutu, width: 130 }} value={deger.belgeNo} onChange={(ev) => degis("belgeNo", ev.target.value)} />
          </div>
        )}
      </div>
    </div>
  );
};

export default FisDurbunFiltre;
