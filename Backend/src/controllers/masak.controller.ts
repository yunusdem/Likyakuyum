import { Request, Response } from "express";
import { MasakService } from "../services/masak.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";

export class MasakController {
  private static getDbContext(req: Request) {
    return {
      dbServer: req.user?.dbServer || (req.query.dbServer as string) || (req.body?.dbServer as string),
      dbName: req.user?.dbName || (req.query.dbName as string) || (req.body?.dbName as string),
    };
  }

  private static getKullanici(req: Request) {
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
  public static guncelle = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = MasakController.getDbContext(req);
    const kullanici = MasakController.getKullanici(req);

    // Liste kodları büyük harfe çevrilir; ekrandan "d" gelirse "D" olarak işlenir
    const kaynaklar = Array.isArray(req.body?.kaynaklar)
      ? req.body.kaynaklar.map((k: any) => ({
          ...k,
          listeKod: String(k?.listeKod ?? "").trim().toUpperCase(),
        }))
      : undefined;

    const rapor = await MasakService.guncelle(kaynaklar, kullanici, dbContext);

    const basarili = rapor.sonuclar.filter((s) => s.durum === "basarili").length;
    const hatali = rapor.sonuclar.length - basarili;
    const mesaj = hatali
      ? `${basarili} liste güncellendi, ${hatali} listede hata oluştu.`
      : "MASAK listeleri başarıyla güncellendi.";

    return ApiResponse.ok(res, mesaj, rapor);
  });

  /**
   * DELETE /api/v1/masak/liste/:listeKod
   * Kullanıcı tanımlı bir listeyi verisi ve geçmişiyle birlikte kaldırır.
   */
  public static sil = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = MasakController.getDbContext(req);
    const listeKod = String(req.params.listeKod || "").trim().toUpperCase();
    const sonuc = await MasakService.sil(listeKod, dbContext);
    return ApiResponse.ok(res, `${listeKod} listesi kaldırıldı.`, sonuc);
  });

  /**
   * GET /api/v1/masak/durum
   * Liste bazında kayıt sayısı, son güncelleme zamanı ve son kullanılan adres.
   */
  public static getDurum = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = MasakController.getDbContext(req);
    const durum = await MasakService.getDurum(dbContext);
    const toplamKayit = durum.reduce((t, d) => t + d.kayitSayisi, 0);
    const sonGuncelleme =
      durum
        .map((d) => d.sonGuncelleme)
        .filter((z): z is string => !!z)
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
  public static getListe = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = MasakController.getDbContext(req);

    const sayfa = await MasakService.listele(
      {
        listeKod: req.query.listeKod as string | undefined,
        q: req.query.q as string | undefined,
        kimlikNo: req.query.kimlikNo as string | undefined,
        page: req.query.page ? Number(req.query.page) : undefined,
        pageSize: req.query.pageSize ? Number(req.query.pageSize) : undefined,
      },
      dbContext
    );

    return ApiResponse.ok(res, "MASAK kayıtları listelendi.", sayfa);
  });

  /**
   * GET /api/v1/masak/kayit/:id
   */
  public static getKayit = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = MasakController.getDbContext(req);
    const kayit = await MasakService.getKayit(Number(req.params.id), dbContext);
    return ApiResponse.ok(res, "MASAK kaydı getirildi.", kayit);
  });

  /**
   * GET /api/v1/masak/sorgu?ad=&kimlikNo=&dogumTarihi=
   * Fiş / fatura / cari ekranları için skorlu eşleşme kontrolü.
   */
  public static sorgula = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = MasakController.getDbContext(req);

    const sonuc = await MasakService.sorgula(
      {
        ad: req.query.ad as string | undefined,
        kimlikNo: req.query.kimlikNo as string | undefined,
        dogumTarihi: req.query.dogumTarihi as string | undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
      },
      dbContext
    );

    const mesaj = sonuc.eslesmeVar
      ? `MASAK listelerinde ${sonuc.kayitlar.length} olası eşleşme bulundu.`
      : "MASAK listelerinde eşleşme bulunamadı.";

    return ApiResponse.ok(res, mesaj, sonuc);
  });

  /**
   * GET /api/v1/masak/gecmis?listeKod=&limit=
   */
  public static getGecmis = asyncHandler(async (req: Request, res: Response) => {
    const dbContext = MasakController.getDbContext(req);
    const listeKod = req.query.listeKod as string | undefined;
    const limit = req.query.limit ? Number(req.query.limit) : undefined;

    const gecmis = await MasakService.getGecmis({ listeKod, limit }, dbContext);
    return ApiResponse.ok(res, "MASAK güncelleme geçmişi listelendi.", gecmis);
  });
}
