import React, { useState, useEffect, useRef, useCallback } from "react";
import { Container, Row, Col, Card, Form, Button, Badge, Spinner } from "react-bootstrap";
import {
  IconDeviceTv,
  IconMaximize,
  IconMinimize,
  IconSettings,
  IconRefresh,
  IconTrendingUp,
  IconTrendingDown,
  IconClock,
  IconBuildingStore,
  IconSparkles,
} from "@tabler/icons-react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { PanoService, PanoModel, PanoSatiriModel } from "../../services/panoService";

interface ParsedStyle {
  fontFamily: string;
  fontSize: string;
  fontWeight: string;
  color: string;
  backgroundColor: string;
}

const parseStyleToCss = (styleStr: string, defaultFontSize: string = "18px"): ParsedStyle => {
  const defaults: ParsedStyle = {
    fontFamily: "Inter, sans-serif",
    fontSize: defaultFontSize,
    fontWeight: "600",
    color: "#ffffff",
    backgroundColor: "transparent",
  };
  if (!styleStr) return defaults;

  try {
    const parts = styleStr.split(";");
    const res = { ...defaults };
    parts.forEach((p) => {
      const [k, v] = p.split(":");
      if (!k || !v) return;
      const key = k.trim();
      const val = v.trim();
      if (key === "font") res.fontFamily = val;
      if (key === "size") res.fontSize = `${val}px`;
      if (key === "bold") res.fontWeight = val === "1" || val === "true" ? "bold" : "normal";
      if (key === "color") res.color = val;
      if (key === "bgColor") res.backgroundColor = val;
    });
    return res;
  } catch {
    return defaults;
  }
};

export const PanoPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const requestedId = Number(searchParams.get("id")) || 0;

  const [allPanos, setAllPanos] = useState<PanoModel[]>([]);
  const [activePano, setActivePano] = useState<PanoModel | null>(null);
  const [selectedPanoId, setSelectedPanoId] = useState<number>(requestedId);

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [lastUpdatedTime, setLastUpdatedTime] = useState<Date>(new Date());

  // Realtime clock
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  // Previous rate prices for flash animation
  const prevRatesRef = useRef<Map<number, { dovizAlis: number | null; dovizSatis: number | null }>>(new Map());
  const [flashedItems, setFlashedItems] = useState<Record<number, "up" | "down" | null>>({});

  // Clock interval
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch list of panos
  useEffect(() => {
    PanoService.getAllPanos()
      .then((list) => {
        setAllPanos(list);
        if (list.length > 0) {
          const matched = list.find((p) => p.panoId === selectedPanoId) || list[0];
          setSelectedPanoId(matched.panoId);
        }
      })
      .catch(() => {});
  }, [selectedPanoId]);

  // Load live board data for selected Pano
  const fetchLiveBoard = useCallback(async () => {
    if (!selectedPanoId || selectedPanoId <= 0) {
      // If no valid id, attempt loading all panos first
      try {
        const list = await PanoService.getAllPanos();
        if (list.length > 0) {
          setSelectedPanoId(list[0].panoId);
          return;
        }
      } catch {}
      setLoading(false);
      return;
    }

    try {
      const data = await PanoService.getLiveBoardData(selectedPanoId);

      // Check price changes for flash animation
      const newFlashes: Record<number, "up" | "down" | null> = {};
      data.satirlar.forEach((satir) => {
        const prev = prevRatesRef.current.get(satir.paraId);
        if (prev && satir.dovizSatis !== null && prev.dovizSatis !== null) {
          if (satir.dovizSatis > prev.dovizSatis) newFlashes[satir.paraId] = "up";
          else if (satir.dovizSatis < prev.dovizSatis) newFlashes[satir.paraId] = "down";
        }
        prevRatesRef.current.set(satir.paraId, {
          dovizAlis: satir.dovizAlis ?? null,
          dovizSatis: satir.dovizSatis ?? null,
        });
      });

      setFlashedItems(newFlashes);
      setActivePano(data);
      setLastUpdatedTime(new Date());
      setError(null);

      // Clear flashes after 1.5s
      setTimeout(() => setFlashedItems({}), 1500);
    } catch (err: any) {
      setError("Pano verisi çekilemedi: " + (err?.message || err));
    } finally {
      setLoading(false);
    }
  }, [selectedPanoId]);

  useEffect(() => {
    fetchLiveBoard();
  }, [fetchLiveBoard]);

  // Auto Refresh Interval
  useEffect(() => {
    if (!activePano) return;
    const intervalSec = Math.max(1, activePano.yenilemeAraligi || 5);
    const timer = setInterval(() => {
      fetchLiveBoard();
    }, intervalSec * 1000);

    return () => clearInterval(timer);
  }, [activePano, fetchLiveBoard]);

  // Fullscreen Handler
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  // Parsed Styles
  const firmaStyle = parseStyleToCss(activePano?.firmaAdiOzellikleri || "", "28px");
  const tarihStyle = parseStyleToCss(activePano?.tarihSaatOzellikleri || "", "16px");
  const baslikStyle = parseStyleToCss(activePano?.baslikOzellikleri || "", "18px");
  const satirStyle = parseStyleToCss(activePano?.satirOzellikleri || "", "22px");

  const visibleSatirlar = (activePano?.satirlar || []).filter((s) => s.gorunur);

  return (
    <div
      className="pano-live-page min-vh-100 d-flex flex-column"
      style={{
        backgroundColor: activePano?.zeminRengi || "#000000",
        color: "#ffffff",
        paddingLeft: `${activePano?.boslukSayisi || 0}px`,
        paddingRight: `${activePano?.boslukSayisi || 0}px`,
        transition: "background-color 0.3s ease",
      }}
    >
      {/* Top Control Bar (Hidden in Fullscreen mode if desired, or compact) */}
      {!isFullscreen && (
        <div className="bg-dark text-white p-2 border-bottom border-secondary d-flex align-items-center justify-content-between flex-wrap gap-2 print-none">
          <div className="d-flex align-items-center gap-2">
            <IconDeviceTv className="text-warning" size={22} />
            <span className="fw-bold text-light me-2">C- Canlı Döviz Panosu</span>
            {allPanos.length > 0 && (
              <Form.Select
                size="sm"
                value={selectedPanoId}
                onChange={(e) => setSelectedPanoId(Number(e.target.value))}
                className="bg-secondary text-white border-0 fw-semibold"
                style={{ width: "200px" }}
              >
                {allPanos.map((p) => (
                  <option key={p.panoId} value={p.panoId}>
                    {p.panoNo} - {p.firmaAdi}
                  </option>
                ))}
              </Form.Select>
            )}
          </div>

          <div className="d-flex align-items-center gap-2">
            <Badge bg="secondary" className="d-flex align-items-center gap-1 font-monospace">
              <IconRefresh size={12} className={loading ? "spin-icon" : ""} />
              <span>Yenileme: {activePano?.yenilemeAraligi || 5} sn</span>
            </Badge>

            <Button
              variant="outline-light"
              size="sm"
              onClick={fetchLiveBoard}
              title="Şimdi Yenile"
              className="py-1 px-2"
            >
              <IconRefresh size={16} />
            </Button>

            <Button
              variant="outline-warning"
              size="sm"
              onClick={() => navigate("/kur/pano-tanimi")}
              className="d-flex align-items-center gap-1 py-1 px-2.5 fw-semibold"
            >
              <IconSettings size={16} />
              <span>Pano Tanımı</span>
            </Button>

            <Button
              variant="primary"
              size="sm"
              onClick={toggleFullscreen}
              className="d-flex align-items-center gap-1 py-1 px-2.5 fw-bold"
            >
              {isFullscreen ? <IconMinimize size={16} /> : <IconMaximize size={16} />}
              <span>{isFullscreen ? "Çık" : "TV Tam Ekran"}</span>
            </Button>
          </div>
        </div>
      )}

      {/* Main Digital Board Body */}
      <Container fluid className="flex-grow-1 d-flex flex-column py-3 px-4">
        {loading && !activePano ? (
          <div className="m-auto text-center py-5">
            <Spinner animation="border" variant="warning" style={{ width: "3rem", height: "3rem" }} />
            <div className="mt-3 fs-5 text-light fw-medium">Dijital Pano Ekranı Yükleniyor...</div>
          </div>
        ) : error && !activePano ? (
          <div className="m-auto text-center py-5">
            <div className="text-danger fs-4 fw-bold mb-2">Pano Yüklenemedi</div>
            <div className="text-light small mb-3">{error}</div>
            <Button variant="warning" size="sm" onClick={() => navigate("/kur/pano-tanimi")}>
              Pano Tanımlarına Git
            </Button>
          </div>
        ) : (
          <div className="w-100 h-100 d-flex flex-column">
            {/* Header: Company Title & Real-time Date/Clock */}
            <div className="d-flex align-items-center justify-content-between pb-3 mb-3 border-bottom border-secondary border-2 flex-wrap gap-2">
              {/* Firma Adı */}
              <div
                style={{
                  fontFamily: firmaStyle.fontFamily,
                  fontSize: firmaStyle.fontSize,
                  fontWeight: firmaStyle.fontWeight as any,
                  color: firmaStyle.color,
                  backgroundColor: firmaStyle.backgroundColor,
                  letterSpacing: "0.5px",
                }}
                className="text-truncate"
              >
                {activePano?.firmaAdi || "KESKİNLER DÖVİZ SINIRLI YETKİLİ MÜESSESE A.Ş."}
              </div>

              {/* Realtime Date & Time Header */}
              <div
                className="d-flex align-items-center gap-3 font-monospace px-3 py-1.5 rounded border border-secondary"
                style={{
                  fontFamily: tarihStyle.fontFamily,
                  fontSize: tarihStyle.fontSize,
                  fontWeight: tarihStyle.fontWeight as any,
                  color: tarihStyle.color,
                  backgroundColor: tarihStyle.backgroundColor !== "transparent" ? tarihStyle.backgroundColor : "rgba(255,255,255,0.05)",
                }}
              >
                <IconClock size={20} className="text-warning" />
                <span>
                  {currentTime.toLocaleDateString("tr-TR", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                  })}
                </span>
                <span className="text-warning fw-bold">
                  {currentTime.toLocaleTimeString("tr-TR", {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                </span>
              </div>
            </div>

            {/* Rates Table Grid */}
            <div className="flex-grow-1 border border-secondary rounded-3 overflow-hidden shadow-lg bg-black bg-opacity-25">
              {/* Table Column Headers */}
              <div
                className="d-flex align-items-center px-4 py-3 border-bottom border-secondary text-uppercase fw-bold"
                style={{
                  fontFamily: baslikStyle.fontFamily,
                  fontSize: baslikStyle.fontSize,
                  fontWeight: baslikStyle.fontWeight as any,
                  color: baslikStyle.color,
                  backgroundColor: baslikStyle.backgroundColor !== "transparent" ? baslikStyle.backgroundColor : "rgba(255,255,255,0.08)",
                  letterSpacing: "1px",
                }}
              >
                {/* Column 1: Currency Code & Name */}
                <div style={{ width: `${activePano?.kodAlaniGenisligi || 60}%` }}>
                  {activePano?.paraBasligi || "DÖVİZ CİNSİ"}
                </div>

                {/* Column 2: Buy & Sell Rates */}
                <div
                  style={{ width: `${activePano?.kurAlaniGenisligi || 40}%` }}
                  className="d-flex align-items-center justify-content-between pe-3"
                >
                  <span className="text-end flex-fill me-3">
                    {activePano?.alisKuruBasligi || "ALIŞ"}
                  </span>
                  <span className="text-end flex-fill">
                    {activePano?.satisKuruBasligi || "SATIŞ"}
                  </span>
                </div>
              </div>

              {/* Data Rows */}
              <div className="d-flex flex-column">
                {visibleSatirlar.length === 0 ? (
                  <div className="text-center py-5 text-muted fs-5">
                    Bu panoda gösterilecek aktif para birimi bulunamadı.
                  </div>
                ) : (
                  visibleSatirlar.map((line, idx) => {
                    const flash = flashedItems[line.paraId];
                    const rowBg =
                      flash === "up"
                        ? "rgba(34, 197, 94, 0.25)"
                        : flash === "down"
                        ? "rgba(239, 68, 68, 0.25)"
                        : idx % 2 === 1
                        ? "rgba(255, 255, 255, 0.03)"
                        : "transparent";

                    return (
                      <div
                        key={`${line.paraId}-${idx}`}
                        className="d-flex align-items-center px-4 py-3 border-bottom border-secondary-subtle transition-all duration-300"
                        style={{
                          backgroundColor: rowBg,
                          fontFamily: satirStyle.fontFamily,
                          fontSize: satirStyle.fontSize,
                          fontWeight: satirStyle.fontWeight as any,
                          color: satirStyle.color,
                        }}
                      >
                        {/* Currency Code & Name */}
                        <div
                          style={{ width: `${activePano?.kodAlaniGenisligi || 60}%` }}
                          className="d-flex align-items-center gap-2 overflow-hidden"
                        >
                          <span className="fw-bold text-warning font-monospace me-2 me-md-3">
                            {line.kod}
                          </span>
                          <span className="text-truncate">
                            {line.gorunecekAd || line.ad}
                          </span>
                        </div>

                        {/* Buy & Sell Rates */}
                        <div
                          style={{ width: `${activePano?.kurAlaniGenisligi || 40}%` }}
                          className="d-flex align-items-center justify-content-between pe-3 font-monospace fw-bold"
                        >
                          {/* Alış Kuru */}
                          <span className="text-end flex-fill me-3" style={{ color: "#ff3333" }}>
                            {line.dovizAlis !== null && line.dovizAlis !== undefined && Number(line.dovizAlis) !== 0
                              ? Number(line.dovizAlis).toFixed(4)
                              : "-"}
                          </span>

                          {/* Satış Kuru */}
                          <span className="text-end flex-fill d-flex align-items-center justify-content-end gap-1" style={{ color: "#00ff66" }}>
                            {flash === "up" && <IconTrendingUp size={18} className="text-success me-1" />}
                            {flash === "down" && <IconTrendingDown size={18} className="text-danger me-1" />}
                            {line.dovizSatis !== null && line.dovizSatis !== undefined && Number(line.dovizSatis) !== 0
                              ? Number(line.dovizSatis).toFixed(4)
                              : "-"}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Footer ticker info */}
            <div className="d-flex align-items-center justify-content-between mt-3 pt-2 text-muted small font-monospace">
              <span>
                Pano No: <strong className="text-light">{activePano?.panoNo}</strong>
              </span>
              <span>
                Son Güncelleme: {lastUpdatedTime.toLocaleTimeString()}
              </span>
            </div>
          </div>
        )}
      </Container>
    </div>
  );
};

export default PanoPage;
