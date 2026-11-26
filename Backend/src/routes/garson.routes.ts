import { adisyonHatasi } from "../services/adisyon/hataSarmal.js";
import { Router, Request, Response, NextFunction } from "express";
import { adisyonGirisSiniri } from "../services/adisyon/girisSiniri.js";
import { AdisyonTanimSqlRepository } from "../models/adisyonTanimSql.repository.js";
import sql from "mssql";
import { GarsonAuthService, GarsonBaglam } from "../services/adisyon/garsonAuth.service.js";
import { AdisyonKimlik, AdisyonSqlRepository as A } from "../models/adisyonSql.repository.js";
import { AdisyonMutfakSqlRepository as MF } from "../models/adisyonMutfakSql.repository.js";
import { AdisyonIslemSqlRepository as IS } from "../models/adisyonIslemSql.repository.js";
import { AdisyonHesapSqlRepository as HS } from "../models/adisyonHesapSql.repository.js";
import { olaylaraAbone } from "../services/adisyon/adisyonOlay.service.js";
import { ApiError } from "../utils/ApiError.js";
import { MisafirService } from "../services/adisyon/misafir.service.js";

/**
 * Garson adresi uçları (docs/TICARI_ADISYON_YOL_HARITASI.md, TA23, D4; §11 G1–G4): kendi kimlik doğrulaması (garson jetonu; giriş
 * garson kartına bağlı kullanıcının adı + şifresiyle). Personel oturumu (normal giriş) istemez. Garson yalnız masaları ve sipariş ekranını kullanır; yetkiler sunucuda denetlenir.
 */
const router = Router();
const istemci = (req: Request) => ({ ip: String(req.ip || "").slice(0, 64), tarayici: String(req.headers["user-agent"] || "").slice(0, 400) });
const sar = (f: (req: Request, res: Response) => Promise<unknown>) => (req: Request, res: Response, next: NextFunction) => {
  f(req, res).then((v) => { if (!res.headersSent) res.json({ success: true, data: v }); }).catch((e) => adisyonHatasi(e, next, `${req.method} ${req.originalUrl.split("?")[0]}`));
};
const gb = (req: Request): GarsonBaglam => (req as any).garson;
const kimlik = (req: Request): AdisyonKimlik => { const b = gb(req); return { garsonId: b.garson.garsonId, kullaniciId: null, ad: b.garson.ad, yetkiler: b.garson.yetkiler }; };
const id = (req: Request) => { const n = Number(req.params.id); if (!Number.isInteger(n) || n <= 0) throw ApiError.badRequest("Geçersiz kayıt numarası."); return n; };

// Giriş (jetonsuz)
router.get("/bilgi", adisyonGirisSiniri, sar(async (req) => GarsonAuthService.bilgi(String(req.query.musteriNo || ""))));
router.post("/giris", adisyonGirisSiniri, sar(async (req) => GarsonAuthService.giris(req.body || {}, istemci(req))));

// Garson jetonu (Authorization: Bearer); personel jetonu burada geçmez
router.use((req: Request, _res: Response, next: NextFunction) => {
  const h = String(req.headers.authorization || "");
  if (!h.startsWith("Bearer ")) return next(ApiError.unauthorized("Garson girişi gerekli."));
  GarsonAuthService.baglam(h.slice(7)).then((b) => { (req as any).garson = b; next(); }).catch(next);
});
/**
 * Garson yalnız açık masa adisyonlarını görür ve işler (TA23; 26.11.2026 denetimi): kimlik deneyerek kapanmış / iptal adisyonlar
 * ve paket müşterilerinin adı, telefonu, adresi okunamaz. Az önce kapanan adisyon (10 dk) okunur: tahsilat sonrası ekran yenilemesi.
 */
router.use("/kayit/:id", (req: Request, _res: Response, next: NextFunction) => {
  const n = Number(req.params.id);
  if (!Number.isInteger(n) || n <= 0) return next(ApiError.badRequest("Geçersiz kayıt numarası."));
  AdisyonTanimSqlRepository.havuz(gb(req).ctx)
    .then((pool) => pool.request().input("A", sql.Int, n).query(`SELECT TUR, DURUM, CASE WHEN KAPANIS_ZAMANI > DATEADD(minute, -10, GETDATE()) THEN 1 ELSE 0 END AS YENI FROM dbo.TODVZ_ADISYON WHERE ADISYON_ID = @A`))
    .then((r) => {
      const a = r.recordset[0];
      if (!a || Number(a.TUR) !== 1) return next(ApiError.notFound("Adisyon bulunamadı."));
      const acik = Number(a.DURUM) === 0 || Number(a.DURUM) === 1;
      if (!acik && !(req.method === "GET" && a.YENI)) return next(ApiError.conflict("Adisyon kapanmış."));
      next();
    }).catch(next);
});
router.get("/ben", sar(async (req) => ({ garson: gb(req).garson })));
router.post("/cikis", sar(async (req) => GarsonAuthService.cikis(gb(req))));
router.get("/masalar", sar(async (req) => A.masalar(gb(req).ctx)));
router.get("/menu", sar(async (req) => A.menu(gb(req).ctx, req.query.bolgeId ? Number(req.query.bolgeId) || null : null)));
router.get("/kayit/:id", sar(async (req) => A.getir(gb(req).ctx, id(req))));
router.post("/siparis", sar(async (req) => A.siparis(gb(req).ctx, req.body || {}, kimlik(req))));
router.post("/kalem/servis", sar(async (req) => {
  if (!gb(req).garson.yetkiler.includes("siparis")) throw ApiError.forbidden("Sipariş yetkiniz yok.");
  return MF.servis(gb(req).ctx, req.body?.kalemIdler);
}));
// Masa işlemleri (D6): garsonun seviye + ek yetkileriyle (TA25)
router.post("/kayit/:id/ikram", sar(async (req) => IS.ikram(gb(req).ctx, id(req), req.body?.kalemler, req.body || {}, kimlik(req))));
router.post("/kayit/:id/iptal", sar(async (req) => IS.iptal(gb(req).ctx, id(req), req.body?.kalemler, req.body || {}, kimlik(req))));
router.post("/kayit/:id/adisyon-iptal", sar(async (req) => IS.adisyonIptal(gb(req).ctx, id(req), req.body || {}, kimlik(req))));
router.post("/kayit/:id/masa-tasi", sar(async (req) => IS.masaTasi(gb(req).ctx, id(req), Number(req.body?.masaId), kimlik(req))));
router.post("/kayit/:id/birlestir", sar(async (req) => IS.birlestir(gb(req).ctx, id(req), Number(req.body?.hedefAdisyonId), kimlik(req))));
// Hesap / tahsilat (D7): garsonun yetkisiyle (hesap iste: herkes; tahsilat / bölme: kasiyer seviyesi ya da ek yetki); vezne ayardan
router.get("/kayit/:id/hesap", sar(async (req) => HS.hesap(gb(req).ctx, id(req))));
router.post("/kayit/:id/hesap-iste", sar(async (req) => HS.hesapIste(gb(req).ctx, id(req), kimlik(req))));
// Misafir PIN'i (§11 M2–M3): sipariş yetkili garson masadaki misafire söyler / yeniler
router.post("/kayit/:id/misafir-pin", sar(async (req) => {
  if (!gb(req).garson.yetkiler.includes("siparis")) throw ApiError.forbidden("Sipariş yetkiniz yok.");
  return MisafirService.pin(gb(req).ctx, id(req), !!req.body?.yenile);
}));
/** Garson telefonda yalnız nakit / kart (cihazdan ayrıca çekilir) alır; cari ve banka hesabı kasadan (U37) */
const garsonOdemesi = (o: any) => {
  if (![0, 2].includes(Number(o?.arac))) throw ApiError.forbidden("Garson yalnız nakit ya da kart tahsilatı yapabilir; cari / havale kasadan alınır.");
  return { ...o, posIslemId: null, posCihaziId: null, cariKartId: null };
};
/** Fatura isteyen müşteri bilgisi garsondan alınır ama cari kart bağlanmaz (cari kasadan) */
const garsonMusterisi = (b: any) => (b?.musteri && typeof b.musteri === "object" ? { ...b.musteri, cariKartId: null } : null);
const garsonOdemeleri = (b: any) => (Array.isArray(b?.odemeler) ? b.odemeler : []).map(garsonOdemesi);
router.post("/kayit/:id/odeme", sar(async (req) => HS.odemeEkle(gb(req).ctx, id(req), { ...(req.body || {}), ...garsonOdemesi(req.body || {}), vezneId: null, musteri: garsonMusterisi(req.body) }, kimlik(req))));
router.delete("/odeme/:id", sar(async (req) => HS.odemeSil(gb(req).ctx, id(req), kimlik(req))));
router.post("/kayit/:id/kapat", sar(async (req) => HS.kapat(gb(req).ctx, id(req), { ...(req.body || {}), vezneId: null, odemeler: garsonOdemeleri(req.body), musteri: garsonMusterisi(req.body) }, kimlik(req))));
router.post("/kayit/:id/urun-ode", sar(async (req) => HS.urunleOde(gb(req).ctx, id(req), { ...(req.body || {}), vezneId: null, odemeler: garsonOdemeleri(req.body), musteri: garsonMusterisi(req.body) }, kimlik(req))));
router.post("/kayit/:id/secim-tutari", sar(async (req) => HS.secimTutari(gb(req).ctx, id(req), req.body?.kalemler)));
router.post("/kayit/:id/indirim", sar(async (req) => HS.indirim(gb(req).ctx, id(req), req.body || {}, kimlik(req))));
router.post("/kayit/:id/fiyat", sar(async (req) => IS.fiyatDegistir(gb(req).ctx, id(req), req.body || {}, kimlik(req))));
router.post("/kayit/:id/urun-tasi", sar(async (req) => IS.urunTasi(gb(req).ctx, id(req), req.body?.kalemler, { masaId: req.body?.masaId ?? null, adisyonId: req.body?.adisyonId ?? null, istekId: req.body?.istekId }, kimlik(req))));
router.put("/kayit/:id/kisi", sar(async (req) => {
  if (!gb(req).garson.yetkiler.includes("siparis")) throw ApiError.forbidden("Sipariş yetkiniz yok.");
  return A.kisiGuncelle(gb(req).ctx, id(req), req.body?.kisi);
}));
router.get("/olaylar", async (req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  if (typeof (res as any).flushHeaders === "function") (res as any).flushHeaders();
  let kapali = false;
  const yaz = (s: string) => { if (!kapali) { try { res.write(s); } catch { /* kapandı */ } } };
  let birak: (() => void) | null = null;
  const ping = setInterval(() => yaz(": ping\n\n"), 15000);
  // Y10: akış uzun açık kalır; oturum dakikada bir yeniden denetlenir (çıkış / şifre değişikliği / garson pasif → akış kapanır)
  const jeton = String(req.headers.authorization || "").slice(7);
  const denetim = setInterval(() => {
    GarsonAuthService.baglam(jeton).catch((e: any) => {
      if (Number(e?.statusCode) !== 401 && Number(e?.statusCode) !== 403) return; // geçici veritabanı hatasında akış kesilmez
      yaz(`event: oturum\ndata: ${JSON.stringify({ mesaj: String(e?.message || "Oturum kapandı").slice(0, 200) })}\n\n`);
      kapali = true; clearInterval(ping); clearInterval(denetim); birak?.();
      try { res.end(); } catch { /* kapandı */ }
    });
  }, 60000);
  req.on("close", () => { kapali = true; clearInterval(ping); clearInterval(denetim); birak?.(); });
  try {
    const a = await olaylaraAbone(gb(req).ctx, (olaylar) => yaz(`data: ${JSON.stringify(olaylar)}\n\n`));
    if (kapali) { a.birak(); return; }
    birak = a.birak;
    yaz(`event: hazir\ndata: ${JSON.stringify({ sonId: a.sonId })}\n\n`);
  } catch (e: any) {
    yaz(`event: hata\ndata: ${JSON.stringify({ mesaj: String(e?.message || e).slice(0, 200) })}\n\n`);
    clearInterval(ping); clearInterval(denetim);
    res.end();
  }
});

export default router;
