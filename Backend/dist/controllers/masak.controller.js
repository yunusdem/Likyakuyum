import { MasakService } from "../services/masak.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
export class MasakController {
    static getDbContext(req) {
        return {
            dbServer: req.user?.dbServer || req.query.dbServer || req.body?.dbServer,
            dbName: req.user?.dbName || req.query.dbName || req.body?.dbName,
        };
    }
    static getKullanici(req) {
        return {
            kullaniciAdi: req.user?.username || null,
            kullaniciId: req.user?.userId ? String(req.user.userId) : null,
        };
    }
    /**
     * POST /api/v1/masak/guncelle
     * Body: { kaynaklar?: [{ listeKod: "A"|"B"|"C"|"3AB", url?: string }] }
     * Gövde boşsa dört listenin tamamı, son kullanılan (yoksa varsayılan) adreslerle güncellenir.
     */
    static guncelle = asyncHandler(async (req, res) => {
        const dbContext = MasakController.getDbContext(req);
        const kullanici = MasakController.getKullanici(req);
        const rapor = await MasakService.guncelle(req.body?.kaynaklar, kullanici, dbContext);
        const basarili = rapor.sonuclar.filter((s) => s.durum === "basarili").length;
        const hatali = rapor.sonuclar.length - basarili;
        const mesaj = hatali
            ? `${basarili} liste güncellendi, ${hatali} listede hata oluştu.`
            : "MASAK listeleri başarıyla güncellendi.";
        return ApiResponse.ok(res, mesaj, rapor);
    });
    /**
     * GET /api/v1/masak/durum
     * Liste bazında kayıt sayısı, son güncelleme zamanı ve son kullanılan adres.
     */
    static getDurum = asyncHandler(async (req, res) => {
        const dbContext = MasakController.getDbContext(req);
        const durum = await MasakService.getDurum(dbContext);
        const toplamKayit = durum.reduce((t, d) => t + d.kayitSayisi, 0);
        const sonGuncelleme = durum
            .map((d) => d.sonGuncelleme)
            .filter((z) => !!z)
            .sort()
            .pop() || null;
        return ApiResponse.ok(res, "MASAK liste durumu getirildi.", {
            toplamKayit,
            sonGuncelleme,
            listeler: durum,
        });
    });
    /**
     * GET /api/v1/masak/liste?listeKod=&q=&kimlikNo=&page=&pageSize=
     * Sayfalı listeleme + arama (MASAK grid ekranı)
     */
    static getListe = asyncHandler(async (req, res) => {
        const dbContext = MasakController.getDbContext(req);
        const sayfa = await MasakService.listele({
            listeKod: req.query.listeKod,
            q: req.query.q,
            kimlikNo: req.query.kimlikNo,
            page: req.query.page ? Number(req.query.page) : undefined,
            pageSize: req.query.pageSize ? Number(req.query.pageSize) : undefined,
        }, dbContext);
        return ApiResponse.ok(res, "MASAK kayıtları listelendi.", sayfa);
    });
    /**
     * GET /api/v1/masak/kayit/:id
     */
    static getKayit = asyncHandler(async (req, res) => {
        const dbContext = MasakController.getDbContext(req);
        const kayit = await MasakService.getKayit(Number(req.params.id), dbContext);
        return ApiResponse.ok(res, "MASAK kaydı getirildi.", kayit);
    });
    /**
     * GET /api/v1/masak/sorgu?ad=&kimlikNo=&dogumTarihi=
     * Fiş / fatura / cari ekranları için skorlu eşleşme kontrolü.
     */
    static sorgula = asyncHandler(async (req, res) => {
        const dbContext = MasakController.getDbContext(req);
        const sonuc = await MasakService.sorgula({
            ad: req.query.ad,
            kimlikNo: req.query.kimlikNo,
            dogumTarihi: req.query.dogumTarihi,
            limit: req.query.limit ? Number(req.query.limit) : undefined,
        }, dbContext);
        const mesaj = sonuc.eslesmeVar
            ? `MASAK listelerinde ${sonuc.kayitlar.length} olası eşleşme bulundu.`
            : "MASAK listelerinde eşleşme bulunamadı.";
        return ApiResponse.ok(res, mesaj, sonuc);
    });
    /**
     * GET /api/v1/masak/gecmis?listeKod=&limit=
     */
    static getGecmis = asyncHandler(async (req, res) => {
        const dbContext = MasakController.getDbContext(req);
        const listeKod = req.query.listeKod;
        const limit = req.query.limit ? Number(req.query.limit) : undefined;
        const gecmis = await MasakService.getGecmis({ listeKod, limit }, dbContext);
        return ApiResponse.ok(res, "MASAK güncelleme geçmişi listelendi.", gecmis);
    });
}
