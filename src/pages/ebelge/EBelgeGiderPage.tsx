import { useEffect, useState } from "react";
import { ButtonGroup, ToggleButton } from "react-bootstrap";
import { useSearchParams } from "react-router-dom";
import { ebelgeService } from "../../services/ebelgeService";
import { useUrunOzellikleri } from "../../hooks/useUrunOzellikleri";
import EBelgeGiderGenel from "./EBelgeGiderGenel";
import EBelgeGiderKuyum from "./EBelgeGiderKuyum";

type GiderTuru = "kuyum" | "genel";

/**
 * e-Gider Pusulası (docs/E_GIDER_YOL_HARITASI.md K18): "Kuyum" (kuyumcunun altın / gümüş alımı) ya da "Genel" (eski form,
 * olduğu gibi). Kuyum lisansında Kuyum seçili açılır; Kuyum ürünü olmayan firmada yalnız Genel. Seçim adreste (?tur=);
 * taslak hangi formla kaydedildiyse onunla açılır (eski taslaklar Genel).
 */
export default function EBelgeGiderPage() {
  const ozellik = useUrunOzellikleri();
  const [params, setParams] = useSearchParams();
  const taslakId = Number(params.get("taslak"));
  const adrestenTur = params.get("tur");
  const varsayilan: GiderTuru = ozellik.kuyum ? "kuyum" : "genel";
  const [tur, setTur] = useState<GiderTuru | null>(
    taslakId > 0 ? null : adrestenTur === "genel" || (adrestenTur === "kuyum" && ozellik.kuyum) ? (adrestenTur as GiderTuru) : varsayilan
  );

  // Taslak: içindeki giderTuru'na göre form seçilir
  useEffect(() => {
    if (!(taslakId > 0)) return;
    ebelgeService
      .yerelTaslakGetir<Record<string, unknown>>(taslakId)
      .then((t) => setTur(t.icerik?.giderTuru === "kuyum" && ozellik.kuyum ? "kuyum" : "genel"))
      .catch(() => setTur("genel"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taslakId]);

  if (!tur) return <div className="text-secondary small p-3">Taslak açılıyor…</div>;

  const turSecici = ozellik.kuyum && !(taslakId > 0) ? (
    <ButtonGroup size="sm" className="ms-auto me-2">
      {(["kuyum", "genel"] as GiderTuru[]).map((t) => (
        <ToggleButton key={t} id={`gider-tur-${t}`} type="radio" variant={tur === t ? "primary" : "outline-primary"}
          name="gider-tur" value={t} checked={tur === t}
          onChange={() => { setTur(t); setParams({ tur: t }, { replace: true }); }}>
          {t === "kuyum" ? "Kuyum" : "Genel"}
        </ToggleButton>
      ))}
    </ButtonGroup>
  ) : null;

  // key: tür değişince form sıfırdan açılır (iki form farklı alanlar tutar)
  return tur === "kuyum" ? <EBelgeGiderKuyum key="kuyum" turSecici={turSecici} /> : <EBelgeGiderGenel key="genel" turSecici={turSecici} />;
}
