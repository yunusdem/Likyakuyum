import React, { useCallback, useEffect, useRef, useState } from "react";
import LookupModal, { LookupModalProps } from "./LookupModal";
import FisDurbunFiltre, { FisDurbunAlanlari, FisDurbunEtiketleri, FisDurbunSecenek } from "./FisDurbunFiltre";
import {
  FisDurbunFiltreDegeri,
  DURBUN_SINIRI,
  durbunSorguParametreleri,
  sinirUygula,
  varsayilanDurbunFiltresi,
} from "../../utils/fisDurbunFiltre";

/**
 * Kayıtlı fiş dürbünü: LookupModal + sunucu taraflı gelişmiş filtre (docs/FIS_TARIH_VE_DURBUN_YOL_HARITASI.md D1–D4).
 * Açılışta bu ay; filtre değişince gecikmeli (debounce) sunucu isteği; sınıra takılırsa alt satırda "daraltın" bilgisi.
 */
export interface FisDurbunModalProps<T> extends Omit<LookupModalProps<T>, "items" | "isLoading" | "filterFn" | "headerSlot" | "maxDisplayCount" | "footerInfo" | "onSearchTermChange"> {
  /** Sunucudan liste getirir; parametreler drb önekli filtreler (+ sunucuArama ise "search"), limit bir fazlasıyla istenir */
  getir: (parametreler: Record<string, string | number>, limit: number) => Promise<T[]>;
  alanlar: FisDurbunAlanlari;
  vezneler?: FisDurbunSecenek[];
  urunler?: FisDurbunSecenek[];
  tipler?: FisDurbunSecenek[];
  etiketler?: FisDurbunEtiketleri;
  /** Arama kutusu sunucuya gitsin mi (true: "search" parametresi, istemci süzgeci yok) */
  sunucuArama?: boolean;
  /** sunucuArama kapalıyken istemcide arama */
  filterFn?: (item: T, term: string) => boolean;
  /**
   * Yeni→eski karşılaştırıcı: liste eskiden yeniye gösteriliyorsa verilir; sınır aşımında en yeni kayıtlar kalır, gösterim sırası
   * korunur (baştan kesmek en yeni fişi düşürüyordu; ortak alan denetimi 19.11.2026, #36)
   */
  kesmeSirasi?: (a: T, b: T) => number;
}

const GECIKME_MS = 350;

/** Pencere her açılışta yeniden kurulur: filtre bu aya döner (D4) */
function FisDurbunIcerik<T extends Record<string, any>>(props: FisDurbunModalProps<T>) {
  const { getir, alanlar, vezneler, urunler, tipler, etiketler, sunucuArama, filterFn, kesmeSirasi, show, initialSearchTerm, ...lookup } = props;
  const [filtre, setFiltre] = useState<FisDurbunFiltreDegeri>(() => varsayilanDurbunFiltresi());
  const [arama, setArama] = useState<string>(initialSearchTerm || "");
  const [liste, setListe] = useState<T[]>([]);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [tasti, setTasti] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const istekNo = useRef(0);
  const ilkIstek = useRef(true);
  const getirRef = useRef(getir);
  getirRef.current = getir;
  const kesmeRef = useRef(kesmeSirasi);
  kesmeRef.current = kesmeSirasi;

  const yukle = useCallback(async (f: FisDurbunFiltreDegeri, a: string) => {
    const no = ++istekNo.current;
    setYukleniyor(true);
    setHata(null);
    try {
      const sonuc = await getirRef.current(durbunSorguParametreleri(f, sunucuArama ? a : undefined), DURBUN_SINIRI + 1);
      if (no !== istekNo.current) return;
      const s = sinirUygula(sonuc || [], DURBUN_SINIRI, kesmeRef.current);
      setListe(s.liste);
      setTasti(s.tasti);
    } catch (e: any) {
      if (no !== istekNo.current) return;
      setListe([]);
      setTasti(false);
      setHata(e?.message || "Liste alınamadı.");
    } finally {
      if (no === istekNo.current) setYukleniyor(false);
    }
  }, [sunucuArama]);

  useEffect(() => {
    if (!show) return;
    const bekle = ilkIstek.current ? 0 : GECIKME_MS;
    ilkIstek.current = false;
    const t = setTimeout(() => void yukle(filtre, arama), bekle);
    return () => clearTimeout(t);
  }, [show, filtre, sunucuArama ? arama : "", yukle]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <LookupModal<T>
      {...lookup}
      show={show}
      initialSearchTerm={initialSearchTerm}
      items={liste}
      isLoading={yukleniyor && liste.length === 0}
      filterFn={sunucuArama || !filterFn ? () => true : filterFn}
      onSearchTermChange={setArama}
      maxDisplayCount={DURBUN_SINIRI}
      headerSlot={
        <FisDurbunFiltre
          deger={filtre}
          onChange={setFiltre}
          alanlar={alanlar}
          vezneler={vezneler}
          urunler={urunler}
          tipler={tipler}
          etiketler={etiketler}
        />
      }
      footerInfo={
        hata ? <span className="text-danger">{hata}</span>
          : tasti ? <span className="text-warning-emphasis fw-semibold">İlk {DURBUN_SINIRI} kayıt gösteriliyor, filtreleri daraltın.</span>
            : yukleniyor ? <span>Yükleniyor…</span> : null
      }
    />
  );
}

export function FisDurbunModal<T extends Record<string, any>>(props: FisDurbunModalProps<T>) {
  if (!props.show) return null;
  return <FisDurbunIcerik<T> {...props} />;
}

export default FisDurbunModal;
