import { Request, Response } from "express";
import { env } from "../config/env.config.js";
import { PanoApiHatasi, PanoApiService } from "../services/panoApi/panoApi.service.js";
import { hataGovdesi, html, ICERIK_TIPLERI, json, PanoBicimi, txt, xml } from "../services/panoApi/panoBicim.js";
import { adresler } from "../services/panoApi/panoEntegrasyon.service.js";

/**
 * Pano Entegrasyonu açık uçları (docs/PANO_API_YOL_HARITASI.md). Oturum yok; anahtar adreste. LED pano yazılımları
 * başlık gönderemediği için CORS herkese açık, cevap önbelleklenmez (sunucu kendi önbelleğini tutar).
 *   GET /api/v1/acik/pano/:anahtar.(json|xml|txt)
 *   GET /acik/pano/:anahtar   → girişsiz HTML pano
 */

const BICIMLER: PanoBicimi[] = ["json", "xml", "txt"];

const baslik = (res: Response, tip: string) => {
  res.setHeader("Content-Type", tip);
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  res.setHeader("X-Robots-Tag", "noindex");
  // helmet'in varsayılan CSP'si satır içi betiği / stili engeller; HTML pano kendi betiğiyle JSON adresini çeker
  if (tip.startsWith("text/html")) {
    res.setHeader("Content-Security-Policy", "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; img-src data:");
  }
};

/** Adreslerin başı: ters vekil arkasında x-forwarded-proto, yoksa isteğin protokolü */
export const adresKoku = (req: Request): string => {
  if (env.PANO_ACIK_KOK.trim()) return env.PANO_ACIK_KOK.trim();
  const ileri = String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim();
  const proto = ileri || req.protocol || "http";
  return `${proto}://${req.get("host") || "localhost"}`;
};

const hataYaz = (res: Response, bicim: PanoBicimi | "html", err: unknown) => {
  const h = err instanceof PanoApiHatasi ? err : new PanoApiHatasi(503, "BAGLANTI", "Sunucu şu an yanıt veremiyor.");
  if (!(err instanceof PanoApiHatasi)) console.error("[PANO-API]", (err as any)?.message || err);
  baslik(res, ICERIK_TIPLERI[bicim]);
  if (bicim === "html") {
    return res.status(h.durum).send(
      `<!DOCTYPE html><html lang="tr"><head><meta charset="utf-8"><meta http-equiv="refresh" content="30"><title>Pano</title></head>` +
        `<body style="margin:0;background:#0f172a;color:#f87171;font:20px Arial,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh">${h.message}</body></html>`
    );
  }
  return res.status(h.durum).send(hataGovdesi(bicim, h.kod, h.message));
};

export class AcikPanoController {
  /** :anahtar ve :bicim rota parametreleri (anahtar.json gibi) */
  public static veri = async (req: Request, res: Response) => {
    const bicim = String(req.params.bicim || "").toLowerCase() as PanoBicimi;
    if (!BICIMLER.includes(bicim)) {
      baslik(res, ICERIK_TIPLERI.json);
      return res.status(404).send(hataGovdesi("json", "BICIM_YOK", "Biçim json, xml ya da txt olmalı."));
    }
    try {
      const { veri } = await PanoApiService.getir(String(req.params.anahtar || ""));
      baslik(res, ICERIK_TIPLERI[bicim]);
      return res.status(200).send(bicim === "json" ? json(veri) : bicim === "xml" ? xml(veri) : txt(veri));
    } catch (err) {
      return hataYaz(res, bicim, err);
    }
  };

  public static sayfa = async (req: Request, res: Response) => {
    const anahtar = String(req.params.anahtar || "");
    try {
      const { veri, gorunum, kayit } = await PanoApiService.getir(anahtar);
      baslik(res, ICERIK_TIPLERI.html);
      return res.status(200).send(html(veri, gorunum, adresler(adresKoku(req), anahtar).json, kayit.onbellekSn));
    } catch (err) {
      return hataYaz(res, "html", err);
    }
  };
}
