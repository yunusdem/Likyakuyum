import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { EbelgeYerelTaslakTuru, ebelgeService } from "../../services/ebelgeService";

/**
 * Yerel taslak kancası — docs/ebelge-revizyon.md K3. Form `?taslak=ID` ile açıldıysa içeriği `uygula`ya verir;
 * `kaydet` aynı taslağı günceller (yoksa yenisini açar), `gonderildi` belge kesildikten sonra taslağı siler.
 */
export function useYerelTaslak<T extends Record<string, unknown>>(belgeTuru: EbelgeYerelTaslakTuru, uygula: (icerik: T) => void) {
  const [searchParams] = useSearchParams();
  const [taslakId, setTaslakId] = useState<number | null>(null);
  const [taslakMesaj, setTaslakMesaj] = useState("");
  const [taslakHata, setTaslakHata] = useState("");
  const [taslakBusy, setTaslakBusy] = useState(false);
  const uygulaRef = useRef(uygula); uygulaRef.current = uygula;

  useEffect(() => {
    const id = Number(searchParams.get("taslak"));
    if (!Number.isInteger(id) || id <= 0) return;
    ebelgeService.yerelTaslakGetir<T>(id).then((t) => {
      if (t.belgeTuru !== belgeTuru) { setTaslakHata("Bu taslak başka bir belge türüne ait."); return; }
      setTaslakId(id); uygulaRef.current(t.icerik);
      setTaslakMesaj(`Yerel taslak #${id} açıldı. Bu taslak GİB'e gönderilmedi; düzenleyip Gönder ile kesebilirsiniz.`);
    }).catch((e: any) => setTaslakHata(e?.message || "Taslak açılamadı."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const kaydet = async (ozet: { belgeNo?: string; aliciVkn?: string; aliciUnvan?: string; tutar?: number | null; paraBirimi?: string }, icerik: T) => {
    setTaslakBusy(true); setTaslakHata(""); setTaslakMesaj("");
    try {
      const { id } = await ebelgeService.yerelTaslakKaydet({ id: taslakId ?? undefined, belgeTuru, ...ozet, icerik });
      setTaslakId(id);
      setTaslakMesaj(`Taslaklara kaydedildi (yerel taslak #${id}). Belge GİB'e gönderilmedi ve numara kullanılmadı; Giden Kutusu › Taslak'tan yeniden açabilirsiniz.`);
    } catch (e: any) { setTaslakHata(e?.message || "Taslak kaydedilemedi."); }
    finally { setTaslakBusy(false); }
  };

  /** Belge kesildi: kaynağı olan taslak silinir. Silinemezse gönderim sonucu etkilenmez. */
  const gonderildi = async () => {
    if (!taslakId) return;
    await ebelgeService.yerelTaslakSil(taslakId).catch(() => undefined);
    setTaslakId(null);
  };

  return { taslakId, taslakMesaj, taslakHata, taslakBusy, kaydet, gonderildi };
}
