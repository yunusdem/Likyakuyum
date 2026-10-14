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
} from "@tabler/icons-react";
import { MenuItem, MenuService, KatalogUrun } from "../../services/menuService";
import { KurService, KurRowItem } from "../../services/kurService";
import { useAuth } from "../../context/AuthContext";
import { getAppBrand } from "../../utils/brandHelper";

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
    KurService.getKurTablosu({ tur: 0 })
      .then((t) => {
        if (isMounted && t?.satirlar) {
          setKurRows(t.satirlar);
        }
      })
      .catch(() => {});

    const unsub = KurService.onKurUpdated((updated) => {
      if (isMounted && updated?.satirlar) {
        setKurRows(updated.satirlar);
      }
    });

    return () => {
      isMounted = false;
      if (unsub) unsub();
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

  // Ürünün mevcut görselleri
  const productImages = useMemo(() => {
    if (!currentProduct) return [];
    if (currentProduct.resimler && currentProduct.resimler.length > 0) {
      return currentProduct.resimler.map((img) => {
        if (img.resimData) {
          return img.resimData.startsWith("data:") ? img.resimData : `data:image/jpeg;base64,${img.resimData}`;
        }
        if (img.dosyaYolu) {
          return img.dosyaYolu.startsWith("http") ? img.dosyaYolu : img.dosyaYolu;
        }
        return "/images/placeholder-jewelry.svg";
      });
    }
    return ["/images/placeholder-jewelry.svg"];
  }, [currentProduct]);

  const productImagesRef = useRef<string[]>(productImages);
  productImagesRef.current = productImages;

  // ─── SLAYT VE GÖRSEL GEÇİŞ MOTORU (WEB WORKER İLE ARKA PLANDA ASLA DURMAZ) ───
  // Her görsel 2 sn gösterilir, son görselin 2 sn si dolunca otomatik diğer ürün açılır,
  // son ürün bitince ilk ürüne döner. Tarayıcı arka planda / minimize olsa dahi Web Worker kesintisiz çalışır.
  const restartWorkerTimer = useCallback(() => {
    if (workerRef.current && isPlayingRef.current) {
      workerRef.current.postMessage("START");
    }
    progressStartTimeRef.current = Date.now();
    setSlideProgress(0);
  }, []);

  const advanceSlide = useCallback(() => {
    const curProducts = productsRef.current;
    if (!curProducts || curProducts.length === 0) return;

    const curPIdx = productIndexRef.current;
    const curProduct = curProducts[curPIdx];
    const curIIdx = imageIndexRef.current;
    const curImgs = curProduct?.resimler && curProduct.resimler.length > 0
      ? curProduct.resimler
      : [null];
    const totalImgs = curImgs.length;

    setImageTransition(true);
    setTimeout(() => {
      if (totalImgs > 1 && curIIdx + 1 < totalImgs) {
        // Ürünün bir sonraki görseline geç
        setImageIndex(curIIdx + 1);
      } else {
        // Ürünün son görselinin 2 saniyesi doldu -> sonraki ürüne geç ve görseli ilk resim yap
        setImageIndex(0);
        setProductIndex((prev) => (prev + 1) % curProducts.length);
      }
      setImageTransition(false);
      progressStartTimeRef.current = Date.now();
      setSlideProgress(0);
    }, 120);
  }, []);

  const advanceSlideRef = useRef(advanceSlide);
  advanceSlideRef.current = advanceSlide;

  // Web Worker Başlatma (Tarayıcı arka plana atılsa bile 2000ms aralıklarla kesintisiz tick atar)
  useEffect(() => {
    const workerScript = `
      let timer = null;
      self.onmessage = function(e) {
        if (e.data === 'START') {
          if (timer) clearInterval(timer);
          timer = setInterval(function() {
            self.postMessage('TICK');
          }, 2000);
        } else if (e.data === 'STOP') {
          if (timer) clearInterval(timer);
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
      worker.postMessage("START");
    }

    // Aktif sekmede görsel ilerleme çubuğu için interval
    progressStartTimeRef.current = Date.now();
    progressIntervalRef.current = setInterval(() => {
      if (!isPlayingRef.current) return;
      const elapsed = Date.now() - progressStartTimeRef.current;
      const pct = Math.min(100, (elapsed / 2000) * 100);
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
  }, []);

  // isPlaying değiştiğinde worker'a bildir
  useEffect(() => {
    if (!workerRef.current) return;
    if (isPlaying && products.length > 0) {
      workerRef.current.postMessage("START");
      progressStartTimeRef.current = Date.now();
    } else {
      workerRef.current.postMessage("STOP");
      setSlideProgress(0);
    }
  }, [isPlaying, products.length]);

  // Manuel İleri / Geri Resim Değiştirme
  const handleNextSlide = useCallback(() => {
    if (products.length === 0) return;
    const curImgs = productImagesRef.current;
    setImageTransition(true);
    setTimeout(() => {
      if (curImgs.length > 1 && imageIndexRef.current + 1 < curImgs.length) {
        setImageIndex((prev) => prev + 1);
      } else {
        setImageIndex(0);
        setProductIndex((prev) => (prev + 1) % products.length);
      }
      setImageTransition(false);
      restartWorkerTimer();
    }, 120);
  }, [products.length, restartWorkerTimer]);

  const handlePrevSlide = useCallback(() => {
    if (products.length === 0) return;
    const curImgs = productImagesRef.current;
    setImageTransition(true);
    setTimeout(() => {
      if (imageIndexRef.current > 0) {
        setImageIndex((prev) => prev - 1);
      } else {
        const prevIdx = (productIndexRef.current - 1 + products.length) % products.length;
        setProductIndex(prevIdx);
        // Yeni ürünün son görseline geç
        const prevProduct = products[prevIdx];
        const prevProductImgs = prevProduct?.resimler?.length || 1;
        setImageIndex(Math.max(0, prevProductImgs - 1));
      }
      setImageTransition(false);
      restartWorkerTimer();
    }, 120);
  }, [products, restartWorkerTimer]);

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
  // Kullanıcı Kuralı: "Satış Fiyatı : sağında Has kesinlikle değil dolar euro ne varsa orada 2 farklı hesap var biri has diğer döviz sağda kalan döviz hesabı fiyatı ne kadarsa o fiyat yazmalı"
  const getResolvedDisplayPrice = useCallback(
    (product?: KatalogUrun): { tutar: number; paraKodu: string } => {
      if (!product) return { tutar: 0, paraKodu: "USD" };

      // Özel ürün (ozel): Zaten doğrudan döviz/TL cinsindendir
      if (product.urunTipi === "ozel") {
        let pKod = (product.satisParaKodu || "USD").toUpperCase().trim();
        if (pKod === "HAS" || !pKod) pKod = "USD";
        return { tutar: Number(product.satisFiyati) || 0, paraKodu: pKod };
      }

      // Altın ürün (altin):
      // Altın ürün ekranında sol kutudaki 'satisFiyati' HAS tutarıdır.
      // Sağ kutuda ise döviz/TL karşılığı (USD, EUR, TL vs.) hesaplanır.
      // Ekranda sağ kutudaki döviz fiyatı ne kadarsa o fiyat gösterilmelidir!
      let pKod = (product.satisParaKodu || "USD").toUpperCase().trim();
      if (pKod === "HAS" || !pKod) {
        pKod = "USD"; // Asla HAS gösterilmez!
      }

      const rawHasFiyat = Number(product.satisFiyati) || 0;
      if (rawHasFiyat <= 0) {
        return { tutar: 0, paraKodu: pKod };
      }

      // 1. HAS Kuru Bul (Satış kuru öncelikli)
      const hasRow = kurRows.find((r) => {
        const k = (r.kod || "").toUpperCase();
        return k === "HAS" || k === "ALTIN" || k.includes("HAS");
      });
      const systemHasKuru = hasRow
        ? (Number(hasRow.efektifSatis) || Number(hasRow.dovizSatis) || Number(hasRow.efektifAlis) || Number(hasRow.dovizAlis) || 0)
        : 0;
      const itemHasKuru = Number(product.hasKuru2) || Number(product.hasKuru1) || Number(product.altinKuru) || 0;
      const activeHasKuru = systemHasKuru > 0 ? systemHasKuru : (itemHasKuru > 0 ? itemHasKuru : 1);

      // Toplam TL Değeri = Has Tutarı * Has Kuru
      const toplamTL = rawHasFiyat * activeHasKuru;

      if (pKod === "TL" || pKod === "TRY" || pKod === "₺") {
        return { tutar: toplamTL, paraKodu: "TL" };
      }

      // 2. Hedef Döviz Kuru Bul (USD, EUR, GBP vs.)
      const targetCurRow = kurRows.find((r) => (r.kod || "").toUpperCase() === pKod);
      const systemCurKuru = targetCurRow
        ? (Number(targetCurRow.efektifSatis) || Number(targetCurRow.dovizSatis) || Number(targetCurRow.efektifAlis) || Number(targetCurRow.dovizAlis) || 0)
        : 0;

      let itemCurKuru = 0;
      if (pKod === "USD" || pKod === "$") {
        itemCurKuru = Number(product.usdKuru2) || Number(product.usdKuru1) || 0;
      }
      const activeCurKuru = systemCurKuru > 0 ? systemCurKuru : (itemCurKuru > 0 ? itemCurKuru : 1);

      const dovizTutari = activeCurKuru > 0 ? toplamTL / activeCurKuru : toplamTL;
      return { tutar: dovizTutari, paraKodu: pKod };
    },
    [kurRows]
  );

  // ─── SATIŞ FİYATI FORMATLAMA ───
  // USD -> $ , EUR -> € , TL/TRY -> ₺ ; Asla 'HAS' yazılmaz!
  const formatFiyat = (tutar: number, paraBirimi: string = "") => {
    const formatted = new Intl.NumberFormat("tr-TR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(tutar || 0);

    const p = (paraBirimi || "").toUpperCase().trim();
    let sembol = "$";
    if (p === "USD" || p === "$" || p.includes("DOLAR") || p.includes("USD")) {
      sembol = "$";
    } else if (p === "EUR" || p === "€" || p.includes("EURO") || p.includes("EUR")) {
      sembol = "€";
    } else if (p === "GBP" || p === "£" || p.includes("STERLIN")) {
      sembol = "£";
    } else if (p === "TL" || p === "TRY" || p === "₺") {
      sembol = "₺";
    } else {
      sembol = "$";
    }

    return `${formatted} ${sembol}`;
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

              {/* Ürün Görseli (Portrait Oranlı, Temiz Kenarlı) */}
              <div
                className="d-flex align-items-center justify-content-center w-100 h-100 overflow-hidden"
                style={{ borderRadius: "8px" }}
              >
                <img
                  src={productImages[imageIndex]}
                  alt={currentProduct.model || "Katalog Ürünü"}
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
                    e.currentTarget.src = "/images/placeholder-jewelry.svg";
                  }}
                />
              </div>

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

                    {/* 2. Ürün Adı / Modeli (Görseldeki EFSD gibi büyük serif yazı) - TAM ORTALI */}
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
                      {currentProduct.model || "EFSD"}
                    </h1>

                    {/* 3. Barkod Kodu Rozeti - TAM ORTALI */}
                    {currentProduct.barkod && (
                      <div className="d-flex justify-content-center w-100 mb-2.5">
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
                          NET AĞIRLIK / GRAMAJ:
                        </span>
                      </div>
                      <div className="fw-bold" style={{ fontSize: "1.05rem" }}>
                        <span className="text-white me-1">
                          {new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 5 }).format(currentProduct.miktar)}
                        </span>
                        <span style={{ color: "#fde047", fontSize: "0.85rem" }}>
                          {currentProduct.miktarBirimi || "Gr"}
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
