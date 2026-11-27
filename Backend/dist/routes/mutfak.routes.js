import { adisyonHatasi } from "../services/adisyon/hataSarmal.js";
import { Router } from "express";
import { adisyonGirisSiniri } from "../services/adisyon/girisSiniri.js";
import { MutfakAuthService } from "../services/adisyon/mutfakAuth.service.js";
import { AdisyonMutfakSqlRepository as M } from "../models/adisyonMutfakSql.repository.js";
import { olaylaraAbone } from "../services/adisyon/adisyonOlay.service.js";
import { ApiError } from "../utils/ApiError.js";
/**
 * Mutfak ekranı (KDS) uçları (docs/TICARI_ADISYON_YOL_HARITASI.md, TA30, D5): bağlantı anahtarıyla giriş, kendi jetonu;
 * yalnız bağlantının hazırlık yerindeki kalemler görülür ve hazır yapılır.
 */
const router = Router();
const sar = (f) => (req, res, next) => {
    f(req).then((v) => { if (!res.headersSent)
        res.json({ success: true, data: v }); }).catch((e) => adisyonHatasi(e, next, `${req.method} ${req.originalUrl.split("?")[0]}`));
};
const mb = (req) => req.mutfak;
router.post("/giris", adisyonGirisSiniri, sar(async (req) => MutfakAuthService.giris(req.body || {})));
router.use((req, _res, next) => {
    const h = String(req.headers.authorization || "");
    if (!h.startsWith("Bearer "))
        return next(ApiError.unauthorized("Mutfak ekranı girişi gerekli."));
    MutfakAuthService.baglam(h.slice(7)).then((b) => { req.mutfak = b; next(); }).catch(next);
});
router.get("/ben", sar(async (req) => ({ yer: mb(req).yer, yerId: mb(req).yerId, kisaAd: mb(req).kisaAd })));
router.get("/siparisler", sar(async (req) => M.siparisler(mb(req).ctx, mb(req).yerId)));
router.post("/hazir", sar(async (req) => M.hazir(mb(req).ctx, req.body?.kalemIdler, req.body?.hazir !== false, mb(req).yerId)));
router.get("/olaylar", async (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    if (typeof res.flushHeaders === "function")
        res.flushHeaders();
    let kapali = false;
    const yaz = (s) => { if (!kapali) {
        try {
            res.write(s);
        }
        catch { /* kapandı */ }
    } };
    let birak = null;
    const ping = setInterval(() => yaz(": ping\n\n"), 15000);
    req.on("close", () => { kapali = true; clearInterval(ping); birak?.(); });
    try {
        // Yalnız bu yerin mutfak / hazır olayları iletilir
        const yerId = mb(req).yerId;
        const a = await olaylaraAbone(mb(req).ctx, (olaylar) => { const l = olaylar.filter((o) => o.yerId === yerId); if (l.length)
            yaz(`data: ${JSON.stringify(l)}\n\n`); });
        if (kapali) {
            a.birak();
            return;
        }
        birak = a.birak;
        yaz(`event: hazir\ndata: ${JSON.stringify({ sonId: a.sonId })}\n\n`);
    }
    catch (e) {
        yaz(`event: hata\ndata: ${JSON.stringify({ mesaj: String(e?.message || e).slice(0, 200) })}\n\n`);
        clearInterval(ping);
        res.end();
    }
});
export default router;
