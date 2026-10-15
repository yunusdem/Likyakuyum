import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import {
  IconDeviceTv,
  IconPlayerPlay,
  IconPlayerPause,
  IconMaximize,
  IconMinimize,
  IconChevronLeft,
  IconChevronRight,
  IconBarcode,
  IconSparkles,
  IconRefresh,
  IconTag,
  IconScale,
  IconDiamond,
} from "@tabler/icons-react";
import { MenuItem, MenuService, KatalogUrun } from "../../services/menuService";
import { KurService, KurRowItem } from "../../services/kurService";
import { CompanyService, TodvzTanimDto } from "../../services/companyService";
import { useAuth } from "../../context/AuthContext";
import { getAppBrand } from "../../utils/brandHelper";

const getPlaceholderSvg = (brandText: string = "LİKYA KUYUMCULUK", subText: string = "ÖZEL VİTRİN KOLEKSİYONU") =>
  "data:image/svg+xml;utf8," +
  encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" width="100%" height="100%">
  <defs>
    <linearGradient id="gold" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFFFDE"/>
      <stop offset="35%" stop-color="#FDE075"/>
      <stop offset="70%" stop-color="#E8B84B"/>
      <stop offset="100%" stop-color="#B8822E"/>
    </linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="8" result="blur"/>
      <feComposite in="SourceGraphic" in2="blur" operator="over"/>
    </filter>
  </defs>
  <circle cx="300" cy="300" r="160" fill="none" stroke="url(#gold)" stroke-width="2" stroke-opacity="0.35" stroke-dasharray="6 6"/>
  <g transform="translate(180, 160)" stroke="url(#gold)" stroke-width="4" fill="none" stroke-linejoin="round" stroke-linecap="round" filter="url(#glow)">
    <polygon points="120,40 180,100 120,200 60,100" fill="rgba(253, 224, 117, 0.08)"/>
    <line x1="60" y1="100" x2="180" y2="100"/>
    <line x1="120" y1="40" x2="120" y2="200"/>
    <polygon points="120,40 150,100 120,200 90,100" fill="rgba(253, 224, 117, 0.15)"/>
    <path d="M 60,100 L 120,40 L 180,100" stroke-width="5"/>
  </g>
  <g fill="#FDE075" opacity="0.85">
    <path d="M 170,190 Q 185,190 185,175 Q 185,190 200,190 Q 185,190 185,205 Q 185,190 170,190 Z" />
    <path d="M 400,210 Q 412,210 412,198 Q 412,210 424,210 Q 412,210 412,222 Q 412,210 400,210 Z" />
    <path d="M 370,390 Q 380,390 380,380 Q 380,390 390,390 Q 380,390 380,400 Q 380,390 370,390 Z" />
  </g>
  <text x="300" y="440" text-anchor="middle" font-family="'Cinzel', serif" font-size="20" font-weight="700" fill="#FDE075" letter-spacing="3" opacity="0.95">${brandText}</text>
  <text x="300" y="470" text-anchor="middle" font-family="'Segoe UI', sans-serif" font-size="13" font-weight="600" fill="#cbd5e1" letter-spacing="2">${subText}</text>
</svg>
`);

const PLACEHOLDER_JEWELRY_SVG = getPlaceholderSvg();

export const TvKatalogPage: React.FC = () => {
  const { user } = useAuth();
  const brand = useMemo(() => getAppBrand(user), [user]);

  const [searchParams, setSearchParams] = useSearchParams();
  const initialMenuId = searchParams.get("menuId") ? Number(searchParams.get("menuId")) : null;

  const [menus, setMenus] = useState<MenuItem[]>([]);
  const [selectedMenuId, setSelectedMenuId] = useState<number | null>(initialMenuId);
  const [products, setProducts] = useState<KatalogUrun[]>([]);
  const [kurRows, setKurRows] = useState<KurRowItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Slayt durumu
  const [productIndex, setProductIndex] = useState<number>(0);
  const [imageIndex, setImageIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [imageTransition, setImageTransition] = useState<boolean>(false);
  const [slideProgress, setSlideProgress] = useState<number>(0);

  // Refs for background Web Worker state tracking (avoids stale closures)
  const productsRef = useRef<KatalogUrun[]>(products);
  productsRef.current = products;

  const productIndexRef = useRef<number>(productIndex);
  productIndexRef.current = productIndex;

  const imageIndexRef = useRef<number>(imageIndex);
  imageIndexRef.current = imageIndex;

  const isPlayingRef = useRef<boolean>(isPlaying);
  isPlayingRef.current = isPlaying;

  const workerRef = useRef<Worker | null>(null);
  const workerUrlRef = useRef<string | null>(null);
  const progressIntervalRef = useRef<any>(null);
  const progressStartTimeRef = useRef<number>(Date.now());

  const containerRef = useRef<HTMLDivElement>(null);
  const currentMenuIdRef = useRef<number | null>(selectedMenuId);
  currentMenuIdRef.current = selectedMenuId;

  // Firma Tanımlarından Katalog Sürelerini Yükle
  const [companyDefs, setCompanyDefs] = useState<TodvzTanimDto | null>(null);

  useEffect(() => {
    let isMounted = true;
    CompanyService.getDefinitions()
      .then((defs) => {
        if (isMounted && defs) {
          setCompanyDefs(defs);
        }
      })
      .catch((err) => console.error("Firma tanımları yüklenemedi:", err));
    return () => {
      isMounted = false;
    };
  }, []);

  const urunSuresiSec = Math.max(1, Number(companyDefs?.KATALOG_URUN_SURESI) || 5);
  const resimSuresiSec = Math.max(1, Number(companyDefs?.KATALOG_RESIM_SURESI) || 3);

  const urunSuresiSecRef = useRef<number>(urunSuresiSec);
  urunSuresiSecRef.current = urunSuresiSec;

  const resimSuresiSecRef = useRef<number>(resimSuresiSec);
  resimSuresiSecRef.current = resimSuresiSec;

  const currentDurationRef = useRef<number>(5000);

  // Menüleri yükle
  const fetchMenus = useCallback(async () => {
    try {
      const list = await MenuService.getMenus();
      setMenus(list);
      return list;
    } catch (err: any) {
      console.error("Menüler alınamadı:", err);
      return [];
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      const list = await fetchMenus();
      if (!selectedMenuId && list.length > 0) {
        const matched = initialMenuId ? list.find((m) => m.menuId === initialMenuId) : null;
        const chosen = matched || list.find((m) => m.aktif) || list[0];
        setSelectedMenuId(chosen.menuId);
      }
    };
    init();
  }, [fetchMenus]);

  // Canlı Döviz ve Altın Kurlarını Yükle & Dinle
  useEffect(() => {
    let isMounted = true;

    const loadKurlar = async () => {
      try {
        const [dovizTablo, altinTablo] = await Promise.all([
          KurService.getKurTablosu({ tur: 0 }).catch(() => null),
          KurService.getKurTablosu({ tur: 1 }).catch(() => null),
        ]);
        if (isMounted) {
          const rawList = [
            ...(dovizTablo?.satirlar || []),
            ...(altinTablo?.satirlar || []),
          ];
          const uniqueMap = new Map<string, KurRowItem>();
          for (const row of rawList) {
            const kod = (row.kod || "").toUpperCase();
            if (!kod) continue;
            const existing = uniqueMap.get(kod);
            const hasRate =
              (Number(row.efektifSatis) ||
                Number(row.dovizSatis) ||
                Number(row.efektifAlis) ||
                Number(row.dovizAlis) ||
                0) > 0;
            if (
              !existing ||
              (!((Number(existing.efektifSatis) || Number(existing.dovizSatis) || 0) > 0) &&
                hasRate)
            ) {
              uniqueMap.set(kod, row);
            }
          }
          setKurRows(Array.from(uniqueMap.values()));
        }
      } catch {}
    };

    loadKurlar();

    const unsub = KurService.onKurUpdated(() => {
      loadKurlar();
    });

    const interval = setInterval(loadKurlar, 30000);

    return () => {
      isMounted = false;
      if (unsub) unsub();
      clearInterval(interval);
    };
  }, []);

  // Seçili menünün ürünlerini yükle
  const loadProducts = useCallback(async (menuId: number | null, isSilent: boolean = false) => {
    try {
      if (!isSilent) {
        setLoading(true);
        setError(null);
      }
      const items = await MenuService.getKatalogUrunleri(menuId);
      setProducts((prev) => {
        const prevKey = prev.map((p) => `${p.urunTipi}-${p.urunId}-${p.satisFiyati}`).join(",");
        const nextKey = items.map((p) => `${p.urunTipi}-${p.urunId}-${p.satisFiyati}`).join(",");
        if (prevKey === nextKey) return prev;

        if (prev.length === 0 && items.length > 0) {
          setProductIndex(0);
          setImageIndex(0);
        }
        return items;
      });
      if (!isSilent) {
        setProductIndex(0);
        setImageIndex(0);
        setSlideProgress(0);
      }
    } catch (err: any) {
      if (!isSilent) {
        setError(err.message || "Katalog ürünleri yüklenirken hata oluştu.");
      }
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, []);

  // Canlı senkronizasyon fonksiyonu
  const refreshLive = useCallback(async () => {
    try {
      await fetchMenus();
      await loadProducts(currentMenuIdRef.current, true);
    } catch (err) {
      console.error("Canlı yenileme hatası:", err);
    }
  }, [fetchMenus, loadProducts]);

  useEffect(() => {
    if (selectedMenuId !== undefined) {
      loadProducts(selectedMenuId, false);
      if (selectedMenuId) {
        setSearchParams({ menuId: String(selectedMenuId) });
      } else {
        setSearchParams({});
      }
    }
  }, [selectedMenuId, loadProducts, setSearchParams]);

  // Canlı Otomatik Güncelleme (BroadcastChannel + Storage Event + 3s Polling)
  useEffect(() => {
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel("likya_katalog_tv");
      bc.onmessage = (event) => {
        if (event.data?.type === "PRODUCT_SAVED") {
          refreshLive();
        }
      };
    } catch {}

    const handleStorage = (e: StorageEvent) => {
      if (e.key === "likya_katalog_tv_update") {
        refreshLive();
      }
    };
    window.addEventListener("storage", handleStorage);

    const interval = setInterval(() => {
      refreshLive();
    }, 3000);

    return () => {
      clearInterval(interval);
      window.removeEventListener("storage", handleStorage);
      if (bc) bc.close();
    };
  }, [refreshLive]);

  // Ürün sayısı değiştiğinde index aşımını önle
  useEffect(() => {
    if (products.length > 0 && productIndex >= products.length) {
      setProductIndex(Math.max(0, products.length - 1));
      setImageIndex(0);
    }
  }, [products.length, productIndex]);

  const currentProduct: KatalogUrun | undefined = products[productIndex];

  // Özel ürün taş detaylarını güvenle ayrıştır
  const parsedOzelDetay = useMemo(() => {
    if (!currentProduct || currentProduct.urunTipi !== "ozel") return null;
    const raw = currentProduct.ozelDetay || (currentProduct as any).modelOzellik2;
    if (!raw) return null;
    try {
      const data = typeof raw === "string" ? JSON.parse(raw) : raw;
      const rawTaslar = Array.isArray(data.taslar) ? data.taslar : [];
      const validTaslar = rawTaslar.filter(
        (t: any) => t && (t.tasCinsi || t.miktar || t.renk || t.saflik || t.kesim)
      );
      return {
        monturGram: data.monturGram,
        monturHas: data.monturHas,
        monturIscilik: data.monturIscilik,
        monturIscilikBirim: data.monturIscilikBirim,
        monturIscilikParaKodu: data.monturIscilikParaKodu,
        taslar: validTaslar,
      };
    } catch {
      return null;
    }
  }, [currentProduct]);

  // Ürün Adı / Modeli (JSON kalıntılarını tamamen temizle)
  const resolvedProductTitle = useMemo(() => {
    if (!currentProduct) return "";
    let m = (currentProduct.model || "").trim();
    // Eğer model alanı ham JSON içeriyorsa kesinlikle başlık olarak gösterme
    if (m.startsWith("{") || m.startsWith("[") || m.includes('"montur') || m.includes('"taslar"')) {
      m = "";
    }
    if (m) return m;

    if (currentProduct.mamulTipi && currentProduct.mamulTipi.trim()) {
      return currentProduct.mamulTipi.trim();
    }

    if (currentProduct.urunTipi === "ozel") {
      const firstTas = parsedOzelDetay?.taslar?.[0];
      if (firstTas?.tasCinsi && firstTas.tasCinsi.trim()) {
        return `${firstTas.tasCinsi.trim()} Özel Tasarım`;
      }
      return currentProduct.grupKodu ? `${currentProduct.grupKodu} Özel Tasarım` : "Özel Tasarım Mücevher";
    }

    return currentProduct.grupKodu || "Altın Mücevher";
  }, [currentProduct, parsedOzelDetay]);

  // Ürünün mevcut görselleri
  const productImages = useMemo(() => {
    const brandName = `${brand.prefix} ${brand.suffix}`;
    const subTitle = currentProduct?.urunTipi === "ozel" ? "ÖZEL MÜCEVHER VİTRİNİ" : "ALTIN VİTRİN KOLEKSİYONU";
    const defaultPlaceholder = getPlaceholderSvg(brandName, subTitle);

    if (!currentProduct) return [defaultPlaceholder];
    if (currentProduct.resimler && currentProduct.resimler.length > 0) {
      const validImages = currentProduct.resimler
        .map((img) => {
          if (img.resimData) {
            return img.resimData.startsWith("data:")
              ? img.resimData
              : `data:image/jpeg;base64,${img.resimData}`;
          }
          if (img.dosyaYolu && img.dosyaYolu.trim() !== "") {
            return img.dosyaYolu.startsWith("http") ? img.dosyaYolu : img.dosyaYolu;
          }
          return null;
        })
        .filter(Boolean) as string[];

      if (validImages.length > 0) {
        return validImages;
      }
    }
    return [defaultPlaceholder];
  }, [currentProduct, brand]);

  const hasRealImage = useMemo(() => {
    if (!currentProduct || !currentProduct.resimler || currentProduct.resimler.length === 0) return false;
    const first = currentProduct.resimler[0];
    return Boolean(
      (first.resimData && first.resimData.length > 20) ||
      (first.dosyaYolu && first.dosyaYolu.length > 3)
    );
  }, [currentProduct]);

  const productImagesRef = useRef<string[]>(productImages);
  productImagesRef.current = productImages;

  // ─── SLAYT VE GÖRSEL GEÇİŞ MOTORU (FİRMA TANIMLARI SÜRELERİ İLE TAM ENTEGRE) ───
  // Kural:
  // 1. Tek görselli ürün: Math.max(urunSuresi, resimSuresi) sn kadar ekranda kalır.
  // 2. Çok görselli ürün (örn. 3 görsel, urunSuresi 5s, resimSuresi 3s):
  //    - 1. Görsel: 3 sn (resimSuresi)
  //    - 2. Görsel: 3 sn (resimSuresi)
  //    - 3. Görsel (Son Görsel): En az 3 sn (resimSuresi) ve varsa arta kalan hedef ürün süresi.
  //    - Kesinlikle ürünün tüm görselleri bitmeden ürün değişimi yapılmaz!
  const getSlideDurationMs = useCallback(
    (pIdx: number, iIdx: number, prodList?: KatalogUrun[]): number => {
      const list = prodList || productsRef.current;
      if (!list || list.length === 0) return 3000;
      const curProd = list[pIdx];
      const curImgs =
        curProd?.resimler && curProd.resimler.length > 0 ? curProd.resimler : [null];
      const totalImgs = curImgs.length;

      const uSec = Math.max(1, urunSuresiSecRef.current);
      const rSec = Math.max(1, resimSuresiSecRef.current);

      // Tek görselli ürün
      if (totalImgs <= 1) {
        return Math.max(uSec, rSec) * 1000;
      }

      // Çok görselli ürünün ara görselleri: Kesinlikle resim süresi kadar gösterilir
      if (iIdx < totalImgs - 1) {
        return rSec * 1000;
      }

      // Çok görselli ürünün son görseli:
      // Önceki görsellerde tüketilen süre: (totalImgs - 1) * rSec
      // Kalan ürün süresi hedefi: uSec - (totalImgs - 1) * rSec
      // Son görsel kesinlikle en az resim süresi (rSec) kadar kalır, ürün süresi henüz dolmadıysa onu da tamamlar
      const remainingSec = Math.max(0, uSec - (totalImgs - 1) * rSec);
      return Math.max(rSec, remainingSec) * 1000;
    },
    []
  );

  const restartWorkerTimer = useCallback(
    (customDuration?: number) => {
      const curDur =
        customDuration ||
        getSlideDurationMs(productIndexRef.current, imageIndexRef.current);
      currentDurationRef.current = curDur;
      progressStartTimeRef.current = Date.now();
      setSlideProgress(0);

      if (workerRef.current && isPlayingRef.current) {
        workerRef.current.postMessage({ type: "START", duration: curDur });
      }
    },
    [getSlideDurationMs]
  );

  const advanceSlide = useCallback(() => {
    const curProducts = productsRef.current;
    if (!curProducts || curProducts.length === 0) return;

    const curPIdx = productIndexRef.current;
    const curProduct = curProducts[curPIdx];
    const curIIdx = imageIndexRef.current;
    const curImgs =
      curProduct?.resimler && curProduct.resimler.length > 0
        ? curProduct.resimler
        : [null];
    const totalImgs = curImgs.length;

    let nextPIdx = curPIdx;
    let nextIIdx = curIIdx;

    if (totalImgs > 1 && curIIdx + 1 < totalImgs) {
      // Ürünün bir sonraki görseline geç (tüm görseller sırayla gösterilir)
      nextIIdx = curIIdx + 1;
    } else {
      // Ürünün tüm görselleri tamamlandı -> sonraki ürüne geç ve görseli sıfırla
      nextIIdx = 0;
      nextPIdx = (curPIdx + 1) % curProducts.length;
    }

    const nextDur = getSlideDurationMs(nextPIdx, nextIIdx, curProducts);
    currentDurationRef.current = nextDur;

    setImageTransition(true);
    setTimeout(() => {
      setImageIndex(nextIIdx);
      if (nextPIdx !== curPIdx) {
        setProductIndex(nextPIdx);
      }
      setImageTransition(false);
      progressStartTimeRef.current = Date.now();
      setSlideProgress(0);

      if (workerRef.current && isPlayingRef.current) {
        workerRef.current.postMessage({ type: "START", duration: nextDur });
      }
    }, 120);
  }, [getSlideDurationMs]);

  const advanceSlideRef = useRef(advanceSlide);
  advanceSlideRef.current = advanceSlide;

  // Web Worker Başlatma (Tarayıcı arka planda/minimize olsa dahi tam sürelerde kesintisiz çalışır)
  useEffect(() => {
    const workerScript = `
      let timer = null;
      self.onmessage = function(e) {
        var data = e.data;
        if (data && (data === 'START' || data.type === 'START')) {
          if (timer) clearTimeout(timer);
          var ms = Math.max(500, Number(data.duration) || 3000);
          timer = setTimeout(function() {
            self.postMessage('TICK');
          }, ms);
        } else if (data === 'STOP' || (data && data.type === 'STOP')) {
          if (timer) clearTimeout(timer);
          timer = null;
        }
      };
    `;
    const blob = new Blob([workerScript], { type: "application/javascript" });
    const workerUrl = URL.createObjectURL(blob);
    workerUrlRef.current = workerUrl;

    const worker = new Worker(workerUrl);
    workerRef.current = worker;

    worker.onmessage = (e) => {
      if (e.data === "TICK" && isPlayingRef.current) {
        advanceSlideRef.current();
      }
    };

    if (isPlaying && products.length > 0) {
      const initialDur = getSlideDurationMs(productIndexRef.current, imageIndexRef.current);
      currentDurationRef.current = initialDur;
      worker.postMessage({ type: "START", duration: initialDur });
    }

    // Aktif sekmede görsel ilerleme çubuğu için interval
    progressStartTimeRef.current = Date.now();
    progressIntervalRef.current = setInterval(() => {
      if (!isPlayingRef.current) return;
      const elapsed = Date.now() - progressStartTimeRef.current;
      const dur = currentDurationRef.current || 3000;
      const pct = Math.min(100, (elapsed / dur) * 100);
      setSlideProgress(pct);
    }, 30);

    return () => {
      worker.postMessage("STOP");
      worker.terminate();
      workerRef.current = null;
      if (workerUrlRef.current) {
        URL.revokeObjectURL(workerUrlRef.current);
      }
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, [getSlideDurationMs]);

  // isPlaying değiştiğinde worker'a bildir
  useEffect(() => {
    if (!workerRef.current) return;
    if (isPlaying && products.length > 0) {
      const dur = getSlideDurationMs(productIndexRef.current, imageIndexRef.current);
      currentDurationRef.current = dur;
      workerRef.current.postMessage({ type: "START", duration: dur });
      progressStartTimeRef.current = Date.now();
    } else {
      workerRef.current.postMessage({ type: "STOP" });
      setSlideProgress(0);
    }
  }, [isPlaying, products.length, getSlideDurationMs]);

  // Firma süreleri güncellendiğinde zamanlayıcıyı anında senkronize et
  useEffect(() => {
    if (isPlaying && products.length > 0 && workerRef.current) {
      const dur = getSlideDurationMs(productIndexRef.current, imageIndexRef.current);
      currentDurationRef.current = dur;
      workerRef.current.postMessage({ type: "START", duration: dur });
      progressStartTimeRef.current = Date.now();
      setSlideProgress(0);
    }
  }, [urunSuresiSec, resimSuresiSec, isPlaying, products.length, getSlideDurationMs]);

  // Manuel İleri / Geri Resim Değiştirme
  const handleNextSlide = useCallback(() => {
    const curProducts = productsRef.current;
    if (!curProducts || curProducts.length === 0) return;
    const curPIdx = productIndexRef.current;
    const curProduct = curProducts[curPIdx];
    const curIIdx = imageIndexRef.current;
    const curImgs =
      curProduct?.resimler && curProduct.resimler.length > 0
        ? curProduct.resimler
        : [null];
    const totalImgs = curImgs.length;

    let nextPIdx = curPIdx;
    let nextIIdx = curIIdx;

    if (totalImgs > 1 && curIIdx + 1 < totalImgs) {
      nextIIdx = curIIdx + 1;
    } else {
      nextIIdx = 0;
      nextPIdx = (curPIdx + 1) % curProducts.length;
    }

    const nextDur = getSlideDurationMs(nextPIdx, nextIIdx, curProducts);

    setImageTransition(true);
    setTimeout(() => {
      setImageIndex(nextIIdx);
      if (nextPIdx !== curPIdx) {
        setProductIndex(nextPIdx);
      }
      setImageTransition(false);
      restartWorkerTimer(nextDur);
    }, 120);
  }, [getSlideDurationMs, restartWorkerTimer]);

  const handlePrevSlide = useCallback(() => {
    const curProducts = productsRef.current;
    if (!curProducts || curProducts.length === 0) return;
    const curPIdx = productIndexRef.current;
    const curIIdx = imageIndexRef.current;

    let nextPIdx = curPIdx;
    let nextIIdx = curIIdx;

    if (curIIdx > 0) {
      nextIIdx = curIIdx - 1;
    } else {
      nextPIdx = (curPIdx - 1 + curProducts.length) % curProducts.length;
      const prevProduct = curProducts[nextPIdx];
      const prevProductImgs = prevProduct?.resimler?.length || 1;
      nextIIdx = Math.max(0, prevProductImgs - 1);
    }

    const nextDur = getSlideDurationMs(nextPIdx, nextIIdx, curProducts);

    setImageTransition(true);
    setTimeout(() => {
      setImageIndex(nextIIdx);
      if (nextPIdx !== curPIdx) {
        setProductIndex(nextPIdx);
      }
      setImageTransition(false);
      restartWorkerTimer(nextDur);
    }, 120);
  }, [getSlideDurationMs, restartWorkerTimer]);

  // Tam Ekran Kontrolü
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  // Klavye kısayolları
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === " " || e.code === "Space") {
        e.preventDefault();
        setIsPlaying((p) => !p);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        handleNextSlide();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        handlePrevSlide();
      } else if (e.key.toLowerCase() === "f") {
        toggleFullscreen();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleNextSlide, handlePrevSlide]);

  // Body ve Html arkaplanını zümrüt yeşili gradyana zorla (beyaz arka plan sızmasını tamamen engeller)
  useEffect(() => {
    const bgGradient = "radial-gradient(circle at 50% 45%, #057a55 0%, #046c4e 35%, #034e38 70%, #01281e 100%)";
    const origBodyBg = document.body.style.background;
    const origBodyBgColor = document.body.style.backgroundColor;
    const origHtmlBg = document.documentElement.style.background;
    const origHtmlBgColor = document.documentElement.style.backgroundColor;

    document.documentElement.classList.add("tv-katalog-active");
    document.body.classList.add("tv-katalog-active");

    document.body.style.setProperty("background", bgGradient, "important");
    document.body.style.setProperty("background-color", "#01281e", "important");
    document.documentElement.style.setProperty("background", bgGradient, "important");
    document.documentElement.style.setProperty("background-color", "#01281e", "important");

    return () => {
      document.documentElement.classList.remove("tv-katalog-active");
      document.body.classList.remove("tv-katalog-active");
      document.body.style.background = origBodyBg;
      document.body.style.backgroundColor = origBodyBgColor;
      document.documentElement.style.background = origHtmlBg;
      document.documentElement.style.backgroundColor = origHtmlBgColor;
    };
  }, []);

  // ─── SATIŞ FİYATI ÇÖZÜMLEME (DÖVİZ HESABI) ───
  // Kullanıcı Kuralı: "Satış Fiyatı bölümündeki sağda kalan fiyat ve para kodu gelmesi gerekiyor fiyatta"
  const getResolvedDisplayPrice = useCallback(
    (product?: KatalogUrun): { tutar: number; paraKodu: string } => {
      if (!product) return { tutar: 0, paraKodu: "TL" };

      // 1. Doğrudan sağ kutudaki döviz/TL fiyatı (satisDoviz) kaydedilmişse öncelikli olarak onu ve para kodunu al
      const directDoviz = Number(product.satisDoviz);
      let pKod = (product.satisParaKodu || "TL").toUpperCase().trim();
      if (pKod === "HAS" || !pKod) pKod = "TL";

      if (directDoviz > 0) {
        return { tutar: directDoviz, paraKodu: pKod };
      }

      // 2. Özel ürün (ozel): Zaten doğrudan para birimi cinsindedir
      if (product.urunTipi === "ozel") {
        return { tutar: Number(product.satisFiyati) || 0, paraKodu: pKod };
      }

      // 3. Altın ürün (altin):
      // Altın ürün ekranında sol kutudaki 'satisFiyati' HAS tutarıdır.
      // Sağ kutuda ise döviz/TL karşılığı (TL, USD, EUR vs.) hesaplanır.
      const rawHasFiyat = Number(product.satisFiyati) || 0;
      if (rawHasFiyat <= 0) {
        return { tutar: 0, paraKodu: pKod };
      }

      // HAS Kuru Bul (Satış kuru öncelikli)
      let activeHasKuru = 0;
      if (Number(product.hasKuru2) && Number(product.hasKuru2) > 100) {
        activeHasKuru = Number(product.hasKuru2);
      } else if (Number(product.hasKuru1) && Number(product.hasKuru1) > 100) {
        activeHasKuru = Number(product.hasKuru1);
      } else if (Number(product.altinKuru) && Number(product.altinKuru) > 1000) {
        activeHasKuru = Number(product.altinKuru);
      }

      if (activeHasKuru <= 0) {
        const hasRow = kurRows.find((r) => {
          const k = (r.kod || "").toUpperCase();
          const ad = (r.ad || "").toUpperCase();
          const val = Number(r.efektifSatis) || Number(r.dovizSatis) || Number(r.efektifAlis) || 0;
          return (k === "HAS" || k.includes("HAS") || ad.includes("HAS ALTIN") || ad.includes("HAS")) && val > 100;
        });
        if (hasRow) {
          activeHasKuru =
            Number(hasRow.efektifSatis) ||
            Number(hasRow.dovizSatis) ||
            Number(hasRow.efektifAlis) ||
            Number(hasRow.dovizAlis) ||
            0;
        }
      }

      // 22 ayardan türet
      if (activeHasKuru <= 0) {
        const altin22 = kurRows.find((r) => {
          const k = (r.kod || "").toUpperCase();
          const val = Number(r.efektifSatis) || Number(r.dovizSatis) || 0;
          return k.includes("22") && val > 100;
        });
        if (altin22) {
          const v22 = Number(altin22.efektifSatis) || Number(altin22.dovizSatis) || 0;
          if (v22 > 100) activeHasKuru = v22 / 0.916;
        }
      }

      // Fallback HAS kuru
      if (activeHasKuru <= 0) {
        activeHasKuru = 6000;
      }

      // Toplam TL Değeri = Has Tutarı * Has Kuru
      const toplamTL = rawHasFiyat * activeHasKuru;

      if (pKod === "TL" || pKod === "TRY" || pKod === "₺") {
        return { tutar: Math.round(toplamTL * 100) / 100, paraKodu: "TL" };
      }

      // Hedef Döviz Kuru Bul (USD, EUR, GBP vs.)
      let activeCurKuru = 0;
      if (pKod === "USD" || pKod === "$") {
        if (Number(product.usdKuru2) && Number(product.usdKuru2) > 1) {
          activeCurKuru = Number(product.usdKuru2);
        } else if (Number(product.usdKuru1) && Number(product.usdKuru1) > 1) {
          activeCurKuru = Number(product.usdKuru1);
        }
      }

      if (activeCurKuru <= 0) {
        const targetCurRow = kurRows.find((r) => {
          const k = (r.kod || "").toUpperCase();
          const val = Number(r.efektifSatis) || Number(r.dovizSatis) || 0;
          return (k === pKod || (pKod === "USD" && k === "$") || (pKod === "EUR" && (k === "€" || k === "EURO"))) && val > 0;
        });
        if (targetCurRow) {
          activeCurKuru =
            Number(targetCurRow.efektifSatis) ||
            Number(targetCurRow.dovizSatis) ||
            Number(targetCurRow.efektifAlis) ||
            0;
        }
      }

      if (activeCurKuru <= 0) {
        if (pKod === "USD" || pKod === "$") activeCurKuru = 47.08;
        else if (pKod === "EUR" || pKod === "€") activeCurKuru = 53.65;
        else activeCurKuru = 1;
      }

      const dovizTutari = activeCurKuru > 0 ? toplamTL / activeCurKuru : toplamTL;
      return { tutar: Math.round(dovizTutari * 100) / 100, paraKodu: pKod };
    },
    [kurRows]
  );

  // ─── SATIŞ FİYATI FORMATLAMA ───
  // Kullanıcı Kuralı: "Satış Fiyatı bölümündeki sağda kalan fiyat ve para kodu gelmesi gerekiyor fiyatta"
  const formatFiyat = (tutar: number, paraBirimi: string = "") => {
    const formatted = new Intl.NumberFormat("tr-TR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(tutar || 0);

    const p = (paraBirimi || "TL").toUpperCase().trim();
    return `${formatted} ${p}`;
  };

  return (
    <div
      ref={containerRef}
      className="tv-katalog-container position-fixed top-0 start-0 w-100 h-100 d-flex flex-column text-white overflow-hidden user-select-none"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: "100vw",
        height: "100vh",
        zIndex: 999999,
        background: "radial-gradient(circle at 50% 45%, #057a55 0%, #046c4e 35%, #034e38 70%, #01281e 100%)",
        backgroundColor: "#01281e",
        fontFamily: "'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif",
      }}
    >
      {/* Scoped CSS for Luxury Showcase & Sparkle Stars */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700;800;900&family=Outfit:wght@400;500;600;700;800;900&display=swap');

        /* Tüm ekranı, body ve root'u zümrüt yeşili gradyana zorla - BEYAZ ALAN KESİNLİKLE OLMAYACAK */
        html.tv-katalog-active,
        body.tv-katalog-active,
        #root {
          background: radial-gradient(circle at 50% 45%, #057a55 0%, #046c4e 35%, #034e38 70%, #01281e 100%) !important;
          background-color: #01281e !important;
          margin: 0 !important;
          padding: 0 !important;
          width: 100vw !important;
          height: 100vh !important;
          overflow: hidden !important;
        }

        .tv-katalog-container {
          position: fixed !important;
          top: 0 !important;
          left: 0 !important;
          right: 0 !important;
          bottom: 0 !important;
          width: 100vw !important;
          height: 100vh !important;
          background: radial-gradient(circle at 50% 45%, #057a55 0%, #046c4e 35%, #034e38 70%, #01281e 100%) !important;
          background-color: #01281e !important;
          z-index: 999999 !important;
        }

        .tv-katalog-header,
        .tv-katalog-main {
          background: transparent !important;
          background-color: transparent !important;
        }

        /* Sidebar Logo ve Yazı Birebir Tipografi */
        .tv-site-logo-text {
          display: inline-flex !important;
          align-items: center !important;
          font-family: 'Cinzel', 'Playfair Display', serif !important;
          font-weight: 800 !important;
          letter-spacing: 1px !important;
        }

        .tv-brand-likya,
        .tv-brand-kuyum {
          font-family: inherit !important;
          font-weight: 800 !important;
          background: linear-gradient(135deg, #FFFFDE 0%, #FDE075 35%, #E8B84B 70%, #B8822E 100%) !important;
          background-clip: text !important;
          -webkit-background-clip: text !important;
          -webkit-text-fill-color: transparent !important;
          color: #FDE075 !important;
          letter-spacing: 1px;
          display: inline-block;
        }

        /* 4 Kollu Parlayan Altın Yıldız İğnesi (Card Sparkle Flare) */
        .card-sparkle-star {
          position: absolute;
          width: 28px;
          height: 28px;
          pointer-events: none;
          z-index: 25;
          transform: translate(-50%, -50%);
        }
        .card-sparkle-star::before {
          content: "";
          position: absolute;
          top: 50%;
          left: -22px;
          right: -22px;
          height: 2px;
          background: linear-gradient(90deg, transparent, #ffffff, #FDE075, transparent);
          transform: translateY(-50%);
          box-shadow: 0 0 12px 2px #FDE075;
        }
        .card-sparkle-star::after {
          content: "";
          position: absolute;
          left: 50%;
          top: -22px;
          bottom: -22px;
          width: 2px;
          background: linear-gradient(180deg, transparent, #ffffff, #FDE075, transparent);
          transform: translateX(-50%);
          box-shadow: 0 0 12px 2px #FDE075;
        }
        .card-sparkle-star-center {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 8px;
          height: 8px;
          background: #ffffff;
          border-radius: 50%;
          transform: translate(-50%, -50%);
          box-shadow: 0 0 16px 4px #FDE075, 0 0 6px 2px #ffffff;
        }

        /* Sol Kart - Görsel Sahnesi */
        .tv-stage-card {
          background: #012e22;
          border: 1.5px solid #d4af37;
          border-radius: 20px;
          box-shadow: 0 20px 45px rgba(0, 0, 0, 0.45);
          position: relative;
        }

        /* Sağ Kart - Ürün Bilgisi (Sol Kart ile Aynı Yükseklikte ve Birebir Hizalı) */
        .tv-info-card {
          background: #012e22;
          border: 1.5px solid #d4af37;
          border-radius: 20px;
          box-shadow: 0 20px 45px rgba(0, 0, 0, 0.45);
          position: relative;
        }

        /* Görseldeki Sarı Yuvarlak Ok Butonları */
        .tv-nav-arrow-btn {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: #fde047;
          color: #1e293b;
          border: none;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          box-shadow: 0 4px 12px rgba(0,0,0,0.35);
          transition: transform 0.15s ease, background 0.15s ease;
          z-index: 20;
        }
        .tv-nav-arrow-btn:hover {
          background: #fef08a;
          transform: scale(1.08);
        }

        /* Kuyumcu Vitrin Fiyat Etiketi */
        .jewelry-price-tag {
          background: #ffffff;
          border-radius: 16px;
          position: relative;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.35);
          padding: 0.8rem 1.3rem 0.7rem 1.3rem;
          color: #1e293b;
        }

        /* Etiket Askı / Perçin Halkası */
        .jewelry-price-tag::before {
          content: "";
          position: absolute;
          top: -6px;
          left: 50%;
          transform: translateX(-50%);
          width: 12px;
          height: 12px;
          background: #fef3c7;
          border: 2px solid #b45309;
          border-radius: 50%;
          box-shadow: 0 2px 4px rgba(0,0,0,0.25);
          z-index: 2;
        }

        /* Etiket İç Kesikli Çizgi */
        .jewelry-price-tag .tag-inner-border {
          position: absolute;
          inset: 6px;
          border: 1px dashed rgba(217, 119, 6, 0.45);
          border-radius: 12px;
          pointer-events: none;
        }

        .jewelry-tag-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid #f1f5f9;
          padding-bottom: 0.35rem;
          margin-bottom: 0.35rem;
        }

        .jewelry-tag-price {
          font-family: 'Outfit', 'Cinzel', sans-serif;
          font-weight: 900;
          font-size: 2.75rem;
          line-height: 1.05;
          letter-spacing: -0.5px;
          color: #046c4e;
          text-shadow: 0 2px 6px rgba(4, 108, 78, 0.12);
        }

        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>

      {/* ─── 0. ÜST ZAMANLAMA İLERLEME ÇUBUĞU ─── */}
      <div
        className="w-100 position-absolute top-0 start-0"
        style={{
          height: "2px",
          background: "rgba(255, 255, 255, 0.12)",
          zIndex: 40,
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${slideProgress}%`,
            background: "linear-gradient(90deg, #F6C543, #fbbf24, #ffffff)",
            boxShadow: "0 0 8px #F6C543",
            transition: "width 30ms linear",
          }}
        />
      </div>

      {/* ─── 1. ÜST ŞERİT / KONTROL PANELİ (GÖRSEL İLE BİREBİR) ─── */}
      <div
        className="tv-katalog-header d-flex align-items-center justify-content-between px-3 px-md-4 py-2.5 flex-shrink-0"
        style={{
          background: "transparent",
          zIndex: 20,
        }}
      >
        {/* Sol: Logo + LİKYA ERP + (CANLI VİTRİN TV) */}
        <div className="d-flex align-items-center gap-2">
          <img
            src="/images/logo/logo.svg"
            alt="Likya Logo"
            className="flex-shrink-0"
            style={{ width: "32px", height: "32px", objectFit: "contain", display: "inline-block" }}
          />
          <span
            className="fw-bold tv-site-logo-text text-nowrap"
            style={{ fontSize: "1.25rem" }}
          >
            <span className="tv-brand-likya">{brand.prefix}</span>{" "}
            <span className="tv-brand-kuyum">{brand.suffix}</span>
          </span>
          <span
            className="badge rounded-pill px-2.5 py-1 text-uppercase fw-semibold ms-1"
            style={{
              backgroundColor: "rgba(2, 45, 32, 0.9)",
              color: "#F6C543",
              border: "1px solid #d4af37",
              fontSize: "0.65rem",
              letterSpacing: "1px",
            }}
          >
            CANLI VİTRİN TV
          </span>
        </div>

        {/* Orta: Katalog Menüsü: Beyaz Input + Yeşil Refresh Butonu */}
        <div className="d-flex align-items-center gap-2">
          <label className="small fw-semibold text-nowrap d-none d-lg-inline" htmlFor="tv-menu-select" style={{ color: "#F6C543" }}>
            Katalog Menüsü:
          </label>
          <select
            id="tv-menu-select"
            className="form-select form-select-sm fw-semibold text-dark"
            style={{
              background: "#ffffff",
              border: "1px solid #cbd5e1",
              minWidth: "220px",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "0.82rem",
            }}
            value={selectedMenuId ?? ""}
            onChange={(e) => setSelectedMenuId(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">
              Tüm Menüler ({menus.reduce((acc, m) => acc + (m.urunSayisi || 0), 0)} Ürün)
            </option>
            {menus.map((m) => (
              <option key={m.menuId} value={m.menuId}>
                {m.menuAdi} ({m.urunSayisi ?? 0} Ürün)
              </option>
            ))}
          </select>

          <button
            type="button"
            className="btn btn-sm d-flex align-items-center justify-content-center p-1.5 rounded-3"
            style={{
              background: "#022d20",
              border: "1px solid #d4af37",
              color: "#10b981",
            }}
            onClick={() => {
              fetchMenus();
              loadProducts(selectedMenuId, false);
            }}
            title="Ürünleri Canlı Yenile"
          >
            <IconRefresh size={15} />
          </button>
        </div>

        {/* Sağ: Sayaç, Oynat/Durdur ve Tam Ekran */}
        <div className="d-flex align-items-center gap-2">
          {products.length > 0 && (
            <div
              className="px-3 py-1 rounded-pill small fw-semibold d-none d-sm-block"
              style={{
                background: "rgba(2, 45, 32, 0.9)",
                border: "1px solid rgba(212, 175, 55, 0.6)",
                color: "#e2e8f0",
                fontSize: "0.78rem",
              }}
            >
              Ürün {productIndex + 1} / {products.length}
              {productImages.length > 1 && (
                <span className="text-warning ms-0.5">
                  (Resim {imageIndex + 1}/{productImages.length})
                </span>
              )}
            </div>
          )}

          {/* Oynatılıyor Butonu (Görseldeki gibi Sarı Pill) */}
          <button
            type="button"
            className="btn btn-sm px-3 py-1 rounded-pill fw-bold d-flex align-items-center gap-1.5 shadow-sm"
            style={{
              backgroundColor: isPlaying ? "#fde047" : "rgba(255, 255, 255, 0.15)",
              color: isPlaying ? "#1e293b" : "#ffffff",
              border: "none",
              fontSize: "0.78rem",
            }}
            onClick={() => setIsPlaying(!isPlaying)}
            title={isPlaying ? "Sunumu Duraklat (Space)" : "Sunumu Başlat (Space)"}
          >
            {isPlaying ? <IconPlayerPause size={14} /> : <IconPlayerPlay size={14} />}
            <span>{isPlaying ? "Oynatılıyor" : "Duraklatıldı"}</span>
          </button>

          {/* Tam Ekran Butonu */}
          <button
            type="button"
            className="btn btn-sm p-1.5 rounded-pill d-flex align-items-center justify-content-center"
            style={{
              background: "rgba(2, 45, 32, 0.9)",
              border: "1px solid rgba(212, 175, 55, 0.6)",
              color: "#F6C543",
            }}
            onClick={toggleFullscreen}
            title={isFullscreen ? "Tam Ekrandan Çık (F)" : "Tam Ekran Yap (F)"}
          >
            {isFullscreen ? <IconMinimize size={16} /> : <IconMaximize size={16} />}
          </button>
        </div>
      </div>

      {/* ─── 2. ANA SAHNE (GÖRSELLE BİREBİR KART YERLEŞİMİ) ─── */}
      <div
        className="tv-katalog-main flex-grow-1 position-relative d-flex align-items-center justify-content-center px-4 py-2 overflow-hidden"
        style={{ background: "transparent" }}
      >
        {loading ? (
          <div className="text-center">
            <div
              className="spinner-border mb-3"
              style={{ width: "3.5rem", height: "3.5rem", color: "#F6C543" }}
              role="status"
            />
            <h4 className="fw-light text-white">Katalog Ürünleri Yükleniyor...</h4>
          </div>
        ) : error ? (
          <div className="text-center p-4 rounded-4" style={{ background: "rgba(0,0,0,0.5)" }}>
            <h4 className="text-danger mb-2">Hata</h4>
            <p className="text-white-50">{error}</p>
            <button className="btn btn-warning mt-2" onClick={() => loadProducts(selectedMenuId, false)}>
              Tekrar Dene
            </button>
          </div>
        ) : products.length === 0 ? (
          <div
            className="text-center p-5 rounded-4 shadow-lg"
            style={{
              background: "#012e22",
              border: "1.5px solid #d4af37",
              maxWidth: "540px",
            }}
          >
            <IconDeviceTv size={56} className="text-warning mb-3" />
            <h3 className="fw-bold mb-2 text-white">Bu Menüde Ürün Bulunmuyor</h3>
            <p className="text-white-50 small mb-4">
              Altın ve Özel ürün barkodlama / düzeltme ekranlarında <strong>Katalog</strong> kutusunu işaretleyip bu
              menüyü seçtiğinizde ürünler burada otomatik ve canlı olarak dönecektir.
            </p>
            <button className="btn btn-outline-warning btn-sm" onClick={() => loadProducts(null, false)}>
              Tüm Katalog Ürünlerini Göster
            </button>
          </div>
        ) : currentProduct ? (
          <div
            className="d-flex align-items-center justify-content-center w-100 h-100"
            style={{ maxWidth: "1550px", gap: "2rem" }}
          >
            {/* ─── SOL KART: BÜYÜK ÜRÜN GÖRSEL SAHNESİ & PARLAYAN YILDIZLAR ─── */}
            <div
              className="tv-stage-card d-flex align-items-center justify-content-center position-relative"
              style={{
                height: "84vh",
                maxHeight: "750px",
                width: "680px",
                maxWidth: "54vw",
                padding: "1.25rem",
                flexShrink: 0,
              }}
            >
              {/* Görseldeki Üst Kenar Parlayan Altın Yıldız İğnesi */}
              <div className="card-sparkle-star" style={{ top: "0%", left: "24%" }}>
                <div className="card-sparkle-star-center" />
              </div>

              {/* Görseldeki Alt-Sol Kenar Parlayan Altın Yıldız İğnesi */}
              <div className="card-sparkle-star" style={{ bottom: "0%", left: "16%" }}>
                <div className="card-sparkle-star-center" />
              </div>

              {/* Sol Yön Oku (Sarı Yuvarlak Buton) */}
              <button
                type="button"
                className="tv-nav-arrow-btn position-absolute start-0 top-50 translate-middle-y ms-2.5"
                onClick={handlePrevSlide}
                title="Önceki Resim / Ürün (Sol Ok)"
              >
                <IconChevronLeft size={26} stroke={2.5} />
              </button>

              {/* Ürün Görseli veya Özel Tasarım Vitrin Sahnesi */}
              {!hasRealImage ? (
                /* Gerçek Fotoğrafı Henüz Yüklenmemiş Ürün İçin Lüks Vitrin Sahnesi */
                <div
                  className="d-flex flex-column align-items-center justify-content-center w-100 h-100 text-center position-relative user-select-none"
                  style={{ padding: "1.5rem" }}
                >
                  {/* Işıldayan Zümrüt & Altın Halo Halkası */}
                  <div
                    className="position-relative d-flex align-items-center justify-content-center mb-4"
                    style={{ width: "230px", height: "230px" }}
                  >
                    <div
                      className="position-absolute w-100 h-100 rounded-circle"
                      style={{
                        border: "2px dashed rgba(253, 224, 117, 0.45)",
                        animation: "spin 30s linear infinite",
                      }}
                    />
                    <div
                      className="position-absolute rounded-circle"
                      style={{
                        width: "180px",
                        height: "180px",
                        background: "radial-gradient(circle, rgba(253, 224, 117, 0.18) 0%, rgba(1, 46, 34, 0) 70%)",
                        boxShadow: "0 0 50px rgba(253, 224, 117, 0.25)",
                      }}
                    />
                    {/* Ortadaki Büyük Mücevher / Elmas İkonu */}
                    <div
                      style={{
                        transform: "scale(1.2)",
                        filter: "drop-shadow(0 0 16px rgba(253, 224, 117, 0.7))",
                      }}
                    >
                      {currentProduct.urunTipi === "ozel" ? (
                        <IconDiamond size={92} stroke={1.4} style={{ color: "#fde047" }} />
                      ) : (
                        <IconSparkles size={92} stroke={1.4} style={{ color: "#fde047" }} />
                      )}
                    </div>
                  </div>

                  {/* Rozet */}
                  <span
                    className="badge rounded-pill px-3 py-1 mb-2.5 text-uppercase fw-bold"
                    style={{
                      background: "rgba(212, 175, 55, 0.2)",
                      border: "1px solid #d4af37",
                      color: "#fde047",
                      letterSpacing: "1.5px",
                      fontSize: "0.76rem",
                    }}
                  >
                    {currentProduct.urunTipi === "ozel" ? "ÖZEL MÜCEVHER KOLEKSİYONU" : "ALTIN VİTRİN KOLEKSİYONU"}
                  </span>

                  {/* Marka Adı */}
                  <h2
                    className="fw-bold text-nowrap mb-1"
                    style={{
                      fontFamily: "'Cinzel', serif",
                      letterSpacing: "2px",
                      fontSize: "1.9rem",
                    }}
                  >
                    <span className="tv-brand-likya">{brand.prefix}</span>{" "}
                    <span className="tv-brand-kuyum">{brand.suffix}</span>
                  </h2>

                  {/* Ürün Tipi / Açıklama */}
                  <p
                    className="text-white-50 small mb-3 text-uppercase fw-semibold"
                    style={{ letterSpacing: "1.5px", fontSize: "0.85rem" }}
                  >
                    {resolvedProductTitle}
                  </p>

                  <div
                    className="px-3 py-1 rounded-pill small fw-medium text-white-50"
                    style={{
                      background: "rgba(0, 0, 0, 0.3)",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                      fontSize: "0.75rem",
                    }}
                  >
                    Görsel Çekim Aşamasında • Özel Vitrin Sunumu
                  </div>
                </div>
              ) : (
                <div
                  className="d-flex align-items-center justify-content-center w-100 h-100 overflow-hidden"
                  style={{ borderRadius: "8px" }}
                >
                  <img
                    src={productImages[imageIndex]}
                    alt={resolvedProductTitle}
                    style={{
                      maxHeight: "100%",
                      maxWidth: "100%",
                      objectFit: "contain",
                      borderRadius: "6px",
                      transition: "opacity 0.15s ease-in-out, transform 2s ease-out",
                      opacity: imageTransition ? 0.3 : 1,
                      transform: isPlaying ? "scale(1.02)" : "scale(1)",
                    }}
                    onError={(e: any) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = productImages[0];
                    }}
                  />
                </div>
              )}

              {/* Sağ Yön Oku (Sarı Yuvarlak Buton) */}
              <button
                type="button"
                className="tv-nav-arrow-btn position-absolute end-0 top-50 translate-middle-y me-2.5"
                onClick={handleNextSlide}
                title="Sonraki Resim / Ürün (Sağ Ok)"
              >
                <IconChevronRight size={26} stroke={2.5} />
              </button>

              {/* Görsel Altındaki Resim Gösterge Noktalı Bar (Daha Büyük, Geniş ve Belirgin) */}
              {productImages.length > 1 && (
                <div
                  className="position-absolute bottom-0 start-50 translate-middle-x mb-2.5 d-flex align-items-center gap-1.5 px-3 py-1 rounded-pill shadow-lg"
                  style={{
                    background: "rgba(1, 46, 34, 0.94)",
                    border: "1.5px solid rgba(212, 175, 55, 0.75)",
                    boxShadow: "0 6px 20px rgba(0, 0, 0, 0.55)",
                    zIndex: 25,
                    backdropFilter: "blur(6px)",
                  }}
                >
                  {productImages.map((_, idx) => (
                    <span
                      key={idx}
                      onClick={() => {
                        setImageIndex(idx);
                        restartWorkerTimer();
                      }}
                      title={`Resim ${idx + 1} / ${productImages.length}`}
                      style={{
                        width: imageIndex === idx ? "24px" : "8px",
                        height: "7px",
                        borderRadius: "4px",
                        backgroundColor: imageIndex === idx ? "#F6C543" : "rgba(255, 255, 255, 0.4)",
                        boxShadow: imageIndex === idx ? "0 0 10px #F6C543" : "none",
                        transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
                        cursor: "pointer",
                      }}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* ─── SAĞ KART: LÜKS ÜRÜN KİMLİĞİ & KUYUMCU FİYAT ETİKETİ (GÖRSELDEKİ BİREBİR YAPI) ─── */}
            {(() => {
              const displayPrice = getResolvedDisplayPrice(currentProduct);
              return (
                <div
                  className="tv-info-card d-flex flex-column justify-content-between position-relative"
                  style={{
                    width: "480px",
                    maxWidth: "40vw",
                    padding: "1.35rem 1.6rem",
                    borderRadius: "20px",
                    flexShrink: 0,
                  }}
                >
                  {/* Görseldeki Sağ Kart Üst Kenar Parlayan Altın Yıldız İğnesi */}
                  <div className="card-sparkle-star" style={{ top: "0%", left: "76%" }}>
                    <div className="card-sparkle-star-center" />
                  </div>

                  {/* Üst Bilgiler */}
                  <div className="d-flex flex-column align-items-center text-center w-100">
                    {/* 1. Rozetler: ALTIN MÜCEVHER (Turuncu) & AYAR (Sarı) - TAM ORTALI */}
                    <div className="d-flex align-items-center justify-content-center gap-2 mb-2 w-100">
                      <span
                        className="badge text-uppercase fw-bold rounded-pill px-3 py-1"
                        style={{
                          background: "#c25e19",
                          color: "#ffffff",
                          fontSize: "0.8rem",
                          letterSpacing: "0.5px",
                        }}
                      >
                        {currentProduct.urunTipi === "altin" ? "ALTIN MÜCEVHER" : "ÖZEL TASARIM"}
                      </span>

                      {currentProduct.ayar && (
                        <span
                          className="badge fw-bolder rounded-pill px-3 py-1"
                          style={{
                            backgroundColor: "#fde047",
                            color: "#1e293b",
                            fontSize: "0.8rem",
                            letterSpacing: "0.5px",
                          }}
                        >
                          <IconSparkles size={14} className="me-1" />
                          {currentProduct.ayar.toUpperCase().includes("AYAR")
                            ? currentProduct.ayar.toUpperCase()
                            : `${currentProduct.ayar.toUpperCase()} AYAR`}
                        </span>
                      )}
                    </div>

                    {/* 2. Ürün Adı / Modeli (Tam ortalı) */}
                    <h1
                      className="fw-bold mb-2 text-white text-center w-100"
                      style={{
                        fontFamily: "'Cinzel', 'Playfair Display', serif",
                        fontSize: "2.3rem",
                        lineHeight: "1.15",
                        letterSpacing: "1px",
                        wordBreak: "break-word",
                      }}
                    >
                      {resolvedProductTitle}
                    </h1>

                    {/* 3. Barkod Kodu Rozeti - TAM ORTALI */}
                    {currentProduct.barkod && (
                      <div className="d-flex justify-content-center w-100 mb-2">
                        <div
                          className="d-inline-flex align-items-center gap-1.5 px-3 py-1 rounded-pill"
                          style={{
                            background: "#01281d",
                            border: "1px solid rgba(212, 175, 55, 0.75)",
                            fontSize: "0.84rem",
                            color: "#fde047",
                            fontFamily: "monospace",
                            fontWeight: 600,
                          }}
                        >
                          <IconBarcode size={15} />
                          <span>{currentProduct.barkod}</span>
                        </div>
                      </div>
                    )}

                    {/* 3.1 DEĞERLİ TAŞ BİLGİLERİ (Özel Ürün Taş Kırılımı) */}
                    {currentProduct.urunTipi === "ozel" && parsedOzelDetay?.taslar && parsedOzelDetay.taslar.length > 0 && (
                      <div
                        className="w-100 p-2.5 rounded-3 mb-2.5 d-flex flex-column gap-1.5 text-start"
                        style={{
                          background: "rgba(0, 0, 0, 0.28)",
                          border: "1px solid rgba(212, 175, 55, 0.55)",
                        }}
                      >
                        <div className="d-flex align-items-center justify-content-between px-1">
                          <span
                            className="fw-bold text-uppercase d-flex align-items-center gap-1"
                            style={{ color: "#fde047", fontSize: "0.78rem", letterSpacing: "0.5px" }}
                          >
                            <IconDiamond size={15} style={{ color: "#fde047" }} />
                            DEĞERLİ TAŞ BİLGİLERİ
                          </span>
                          {parsedOzelDetay.taslar.length > 1 && (
                            <span className="badge rounded-pill bg-warning text-dark px-2" style={{ fontSize: "0.68rem" }}>
                              {parsedOzelDetay.taslar.length} Farklı Taş
                            </span>
                          )}
                        </div>

                        <div className="d-flex flex-wrap gap-1.5 justify-content-center">
                          {parsedOzelDetay.taslar.map((tas, idx) => {
                            const details = [
                              tas.renk ? `${tas.renk} Renk` : null,
                              tas.saflik ? tas.saflik : null,
                              tas.kesim ? `${tas.kesim} Kesim` : null,
                            ].filter(Boolean);

                            return (
                              <div
                                key={idx}
                                className="px-2.5 py-1.5 rounded-2 text-center flex-grow-1"
                                style={{
                                  background: "rgba(255, 255, 255, 0.05)",
                                  border: "1px solid rgba(212, 175, 55, 0.35)",
                                  minWidth: "120px",
                                }}
                              >
                                <div className="d-flex align-items-center justify-content-center gap-1.5">
                                  <span className="fw-bold text-white" style={{ fontSize: "0.88rem" }}>
                                    {tas.tasCinsi || "Değerli Taş"}
                                  </span>
                                  {tas.miktar && (
                                    <span className="badge bg-warning text-dark fw-bold px-1.5 py-0.5" style={{ fontSize: "0.75rem" }}>
                                      {tas.miktar} {tas.birim || "Ct"}
                                    </span>
                                  )}
                                </div>
                                {details.length > 0 && (
                                  <div className="text-white-50 mt-1" style={{ fontSize: "0.74rem", letterSpacing: "0.3px" }}>
                                    {details.join(" • ")}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* 4. NET AĞIRLIK / GRAMAJ: 5,00 Gr (Geniş Kapsül) */}
                    <div
                      className="w-100 py-1.5 px-3 rounded-pill mb-2.5 d-flex align-items-center justify-content-between"
                      style={{
                        background: "rgba(0, 0, 0, 0.2)",
                        border: "1px solid rgba(212, 175, 55, 0.6)",
                      }}
                    >
                      <div className="d-flex align-items-center gap-1.5">
                        <IconScale size={16} style={{ color: "#fde047" }} />
                        <span
                          className="text-uppercase fw-semibold"
                          style={{ letterSpacing: "0.5px", fontSize: "0.78rem", color: "#fde047" }}
                        >
                          {currentProduct.urunTipi === "ozel" ? "MONTÜR / NET AĞIRLIK:" : "NET AĞIRLIK / GRAMAJ:"}
                        </span>
                      </div>
                      <div className="fw-bold" style={{ fontSize: "1.05rem" }}>
                        <span className="text-white me-1">
                          {new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 5 }).format(currentProduct.miktar)}
                        </span>
                        <span style={{ color: "#fde047", fontSize: "0.85rem" }}>
                          {currentProduct.miktarBirimi || (currentProduct.urunTipi === "ozel" ? "Gram" : "Gr")}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* ─── 5. ALT KISIM: BEYAZ KUYUMCU VİTRİN FİYAT ETİKETİ - TAM ORTALI ─── */}
                  <div className="jewelry-price-tag w-100">
                    <div className="tag-inner-border" />

                    {/* Etiket Başlığı: SATIŞ FİYATI & GÜNCEL FİYAT - ORTALI */}
                    <div className="jewelry-tag-header position-relative d-flex align-items-center justify-content-center gap-2">
                      <div className="d-flex align-items-center gap-1.5">
                        <IconTag size={16} style={{ color: "#78350f" }} />
                        <span
                          className="fw-bold text-uppercase"
                          style={{
                            letterSpacing: "1px",
                            fontSize: "0.95rem",
                            color: "#78350f",
                            fontFamily: "'Cinzel', serif",
                          }}
                        >
                          SATIŞ FİYATI
                        </span>
                      </div>

                      <span
                        className="badge rounded-pill px-2.5 py-1 text-uppercase fw-semibold"
                        style={{
                          backgroundColor: "#ecfdf5",
                          color: "#047857",
                          border: "1px solid #a7f3d0",
                          fontSize: "0.7rem",
                          letterSpacing: "0.5px",
                        }}
                      >
                        GÜNCEL FİYAT
                      </span>
                    </div>

                    {/* BÜYÜK GÖZ ALICI SATIŞ FİYATI TUTARI (DÖVİZ HESABI: $, €, ₺) - TAM ORTALI */}
                    <div className="text-center py-1.5 position-relative d-flex align-items-center justify-content-center">
                      <div className="jewelry-tag-price" style={{ fontSize: "2.85rem" }}>
                        {formatFiyat(displayPrice.tutar, displayPrice.paraKodu)}
                      </div>
                    </div>

                    {/* Alt Etiket Dipnotu - ORTALI */}
                    <div
                      className="d-flex justify-content-center align-items-center gap-3 pt-2 mt-1 border-top small position-relative text-center"
                      style={{ fontSize: "0.74rem", borderColor: "#f1f5f9" }}
                    >
                      <span style={{ color: "#64748b" }}>
                        Barkod: <strong className="font-monospace" style={{ color: "#0f172a" }}>{currentProduct.barkod || `${currentProduct.grupKodu}-${currentProduct.urunNo}`}</strong>
                      </span>
                      <span className="text-muted">•</span>
                      <span className="fw-semibold" style={{ color: "#047857" }}>
                        KDV DAHİLDİR
                      </span>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default TvKatalogPage;
