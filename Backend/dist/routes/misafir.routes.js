import { Router } from "express";
import { adisyonHatasi } from "../services/adisyon/hataSarmal.js";
import { adisyonGirisSiniri } from "../services/adisyon/girisSiniri.js";
import { MisafirService as M } from "../services/adisyon/misafir.service.js";
import { ApiError } from "../utils/ApiError.js";
/**
 * Masadaki misafir uçları (docs/TICARI_ADISYON_YOL_HARITASI.md §11, M1–M8): kendi jetonu (masa PIN'iyle alınır); personel / garson
 * oturumu istemez. Misafir yalnız kendi adisyonunu görür, menüden sipariş verir, hesap ister, garson çağırır.
 */
const router = Router();
const sar = (f) => (req, res, next) => {
    f(req, res).then((v) => { if (!res.headersSent)
        res.json({ success: true, data: v }); }).catch((e) => adisyonHatasi(e, next, `${req.method} ${req.originalUrl.split("?")[0]}`));
};
const mb = (req) => req.misafir;
// Jetonsuz (hız sınırlı)
router.get("/qr", adisyonGirisSiniri, sar(async (req) => M.qr(String(req.query.musteriNo || ""), String(req.query.q || ""))));
router.post("/giris", adisyonGirisSiniri, sar(async (req) => M.giris(req.body || {}, { ip: String(req.ip || "").slice(0, 64) })));
// Misafir jetonu (Authorization: Bearer)
router.use((req, _res, next) => {
    const h = String(req.headers.authorization || "");
    if (!h.startsWith("Bearer "))
        return next(ApiError.unauthorized("Masa PIN'iyle giriş gerekli."));
    M.baglam(h.slice(7)).then((b) => { req.misafir = b; next(); }).catch(next);
});
router.get("/ben", sar(async (req) => M.ozet(mb(req))));
router.get("/menu", sar(async (req) => M.menu(mb(req))));
router.post("/siparis", sar(async (req) => M.siparis(mb(req), req.body || {})));
router.post("/hesap-iste", sar(async (req) => M.hesapIste(mb(req))));
router.post("/garson-cagir", sar(async (req) => M.garsonCagir(mb(req))));
export default router;
