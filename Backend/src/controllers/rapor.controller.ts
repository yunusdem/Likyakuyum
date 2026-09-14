import { Request, Response } from "express";
import { z } from "zod";
import { RaporService } from "../services/rapor/rapor.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";

const tarih = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tarih YYYY-AA-GG olmalı").optional();
const saat = z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "Saat SS:DD olmalı").transform(s => (s.length === 5 ? s + ":00" : s)).optional();
const idOpt = z.preprocess(v => (v === "" || v === undefined || v === null ? undefined : v), z.coerce.number().int().positive().optional());
const parametreSema = z.object({
  tarih, baslangic: tarih, bitis: tarih, baslangicSaat: saat, bitisSaat: saat,
  vezneId: idOpt, paraId: idOpt, cariKartId: idOpt,
  fisTipi: z.preprocess(v => (v === "" || v === undefined ? undefined : v), z.coerce.number().int().min(0).max(1).optional()),
  kurTuru: z.preprocess(v => (v === "" || v === undefined ? undefined : v), z.coerce.number().int().optional()),
  kurTarihi: tarih, kurAlani: z.enum(["alis", "satis"]).optional(),
  arama: z.string().trim().max(100).optional(), kmt: z.string().trim().max(10).optional(),
  hareketTipi: z.preprocess(v => (v === "" || v === undefined ? undefined : v), z.coerce.number().int().min(0).max(5).optional()),
  // Aralık ve çoklu seçim
  cariBaslangic: z.string().trim().max(50).optional(), cariBitis: z.string().trim().max(50).optional(),
  vezneBaslangic: z.string().trim().max(50).optional(), vezneBitis: z.string().trim().max(50).optional(),
  paraIdler: z.preprocess(v => (v === "" || v === undefined ? undefined : String(v).split(",").map(x => Number(x.trim())).filter(n => Number.isInteger(n) && n > 0)),
    z.array(z.number().int().positive()).max(50).optional()),
});
const kodSema = z.string().trim().toUpperCase().regex(/^[A-Z0-9_]{1,20}$/);
const aramaKayitSema = z.object({
  parametreler: z.record(z.string(), z.union([z.string().max(500), z.number(), z.null()])).refine(o => Object.keys(o).length <= 40, "Çok fazla parametre."),
  ozet: z.string().trim().max(400).optional(),
});

export class RaporController {
  private static getDbContext(req: Request) {
    return {
      dbServer: req.user?.dbServer || (req.query.dbServer as string) || (req.body?.dbServer as string),
      dbName: req.user?.dbName || (req.query.dbName as string) || (req.body?.dbName as string),
    };
  }
  private static kullanici(req: Request) { return req.user?.username || "rapor"; }
  private static parametreler(req: Request) {
    const p = parametreSema.safeParse(req.query);
    if (!p.success) throw ApiError.badRequest(p.error.issues[0]?.message || "Rapor parametreleri geçersiz.", p.error.format());
    if (p.data.baslangic && p.data.bitis && p.data.baslangic > p.data.bitis) throw ApiError.badRequest("Başlangıç tarihi bitişten sonra olamaz.");
    if (p.data.cariBaslangic && p.data.cariBitis && p.data.cariBaslangic > p.data.cariBitis) throw ApiError.badRequest("Başlangıç cari kodu bitişten büyük olamaz.");
    if (p.data.vezneBaslangic && p.data.vezneBitis && p.data.vezneBaslangic > p.data.vezneBitis) throw ApiError.badRequest("Başlangıç vezne kodu bitişten büyük olamaz.");
    return p.data;
  }
  private static kod(req: Request) {
    const k = kodSema.safeParse(req.params.kod);
    if (!k.success) throw ApiError.badRequest("Rapor kodu geçersiz.");
    return k.data;
  }

  /** GET /api/v1/rapor/sablonlar */
  public static sablonlar = asyncHandler(async (req: Request, res: Response) =>
    ApiResponse.ok(res, "Raporlar listelendi.", await RaporService.sablonlar(RaporController.getDbContext(req))));

  /** GET /api/v1/rapor/:kod/tanim — parametre şeması + kolonlar (ekran filtre şeridi ve grid için) */
  public static tanim = asyncHandler(async (req: Request, res: Response) =>
    ApiResponse.ok(res, "Rapor tanımı.", RaporService.tanim(RaporController.kod(req))));

  /** GET /api/v1/rapor/:kod/veri?... — ekran grid'i */
  public static veri = asyncHandler(async (req: Request, res: Response) => {
    const v = await RaporService.veri(RaporController.kod(req), RaporController.parametreler(req), RaporController.getDbContext(req));
    return ApiResponse.ok(res, v.sinirAsildi ? `Rapor ${v.toplamKayit} satır üretiyor; üst sınır aşıldı. Tarih aralığını daraltın.` : "Rapor verisi.",
      { satirlar: v.satirlar, filtreOzeti: v.filtreOzeti, ekDipnot: v.ekDipnot, sinirAsildi: !!v.sinirAsildi, toplamKayit: v.toplamKayit, tanim: v.tanim });
  });

  /** GET /api/v1/rapor/:kod/pdf?...[&indir=1] */
  public static pdf = asyncHandler(async (req: Request, res: Response) => {
    const { pdf, tanim } = await RaporService.pdf(RaporController.kod(req), RaporController.parametreler(req), RaporController.kullanici(req), RaporController.getDbContext(req));
    const indir = ["1", "true"].includes(String(req.query.indir || ""));
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `${indir ? "attachment" : "inline"}; filename="${tanim.kod}.pdf"`);
    res.setHeader("Content-Length", String(pdf.length));
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).end(pdf);
  });

  /** GET /api/v1/rapor/:kod/aramalar — kullanıcının bu rapordaki kayıtlı aramaları (son 10) */
  public static aramalar = asyncHandler(async (req: Request, res: Response) =>
    ApiResponse.ok(res, "Kayıtlı aramalar.", await RaporService.aramalar(RaporController.kullanici(req), RaporController.kod(req), RaporController.getDbContext(req))));

  /** POST /api/v1/rapor/:kod/aramalar { parametreler, ozet? } — aynı parametreler varsa zamanı yenilenir */
  public static aramaKaydet = asyncHandler(async (req: Request, res: Response) => {
    const p = aramaKayitSema.safeParse(req.body || {});
    if (!p.success) throw ApiError.badRequest("Arama kaydı geçersiz.", p.error.format());
    const kayit = await RaporService.aramaKaydet(RaporController.kullanici(req), RaporController.kod(req), p.data.parametreler, p.data.ozet || "", RaporController.getDbContext(req));
    return ApiResponse.ok(res, "Arama kaydedildi.", kayit);
  });

  /** DELETE /api/v1/rapor/:kod/aramalar[/:id] — id yoksa kullanıcının bu rapordaki tüm aramaları */
  public static aramaSil = asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id === undefined ? undefined : Number(req.params.id);
    if (id !== undefined && (!Number.isInteger(id) || id <= 0)) throw ApiError.badRequest("Arama kimliği geçersiz.");
    const adet = await RaporService.aramaSil(RaporController.kullanici(req), RaporController.kod(req), id, RaporController.getDbContext(req));
    return ApiResponse.ok(res, adet ? "Arama silindi." : "Silinecek arama bulunamadı.", { adet });
  });

  /** GET /api/v1/rapor/:kod/excel?... */
  public static excel = asyncHandler(async (req: Request, res: Response) => {
    const { xlsx, tanim } = await RaporService.excel(RaporController.kod(req), RaporController.parametreler(req), RaporController.kullanici(req), RaporController.getDbContext(req));
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${tanim.kod}.xlsx"`);
    res.setHeader("Content-Length", String(xlsx.length));
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).end(xlsx);
  });
}
