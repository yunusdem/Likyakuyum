import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { EbelgeService } from "../services/ebelge.service.js";
import {
  ebelgeAyarSchema,
  ebelgeDogrulaSchema,
  ebelgeTaslakSchema,
  ebelgeTarihSchema,
  ebelgeArsivSenkronizeSchema, ebelgeArsivListeSchema, ebelgeArsivStatuSchema,
  ebelgeGiderPusulasiSchema,
  ebelgeIrsaliyeSchema,
} from "../schemas/ebelge.schema.js";
import { EbelgeSqlRepository } from "../models/ebelgeSql.repository.js";
import { ICE_BELGE_STATULERI } from "../services/ice/ice.efatura.js";

export class EbelgeController {
  private static getDbContext(req: Request) {
    return {
      dbServer: req.user?.dbServer || (req.query.dbServer as string) || (req.body?.dbServer as string),
      dbName: req.user?.dbName || (req.query.dbName as string) || (req.body?.dbName as string),
    };
  }

  private static getKullanici(req: Request): string {
    return req.user?.username || req.user?.userId || "bilinmiyor";
  }

  /**
   * GET /api/v1/e-belge/ayar
   */
  public static getAyar = asyncHandler(async (req: Request, res: Response) => {
    const ayar = await EbelgeService.getAyar(EbelgeController.getDbContext(req));
    return ApiResponse.ok(res, "e-Belge ayarları getirildi.", ayar);
  });

  /**
   * PUT /api/v1/e-belge/ayar
   */
  public static saveAyar = asyncHandler(async (req: Request, res: Response) => {
    const parsed = ebelgeAyarSchema.safeParse(req.body);
    if (!parsed.success) {
      throw ApiError.badRequest("e-Belge ayarları geçersiz.", parsed.error.format());
    }

    const sonuc = await EbelgeService.saveAyar(
      parsed.data,
      EbelgeController.getKullanici(req),
      EbelgeController.getDbContext(req)
    );
    return ApiResponse.ok(res, "e-Belge ayarları kaydedildi.", sonuc);
  });

  /**
   * POST /api/v1/e-belge/ayar/test
   * Health (oturumsuz) → Login → Get_Credit → Logout
   */
  public static testBaglanti = asyncHandler(async (req: Request, res: Response) => {
    const sonuc = await EbelgeService.testBaglanti(
      EbelgeController.getKullanici(req),
      EbelgeController.getDbContext(req)
    );

    const mesaj = sonuc.girisBasarili
      ? "Entegratör bağlantısı başarılı."
      : sonuc.servisAyakta
        ? "Servise ulaşıldı ancak giriş yapılamadı."
        : "Entegratör servisine ulaşılamadı.";

    return ApiResponse.ok(res, mesaj, sonuc);
  });

  /**
   * GET /api/v1/e-belge/kontor
   */
  public static getKontor = asyncHandler(async (req: Request, res: Response) => {
    const kontor = await EbelgeService.getKontor(
      EbelgeController.getKullanici(req),
      EbelgeController.getDbContext(req)
    );
    return ApiResponse.ok(res, "Kontör bilgisi getirildi.", kontor);
  });

  /* ======================================================================
     Gelen kutusu (Faz 3)
     ====================================================================== */

  /**
   * POST /api/v1/e-belge/gelen/senkronize
   */
  public static senkronizeGelen = asyncHandler(async (req: Request, res: Response) => {
    const sonuc = await EbelgeService.senkronizeGelen(
      EbelgeController.getKullanici(req),
      {
        gunSayisi: req.body?.gunSayisi != null ? Number(req.body.gunSayisi) : undefined,
        limit: req.body?.limit != null ? Number(req.body.limit) : undefined,
        okunmuslarDahil: req.body?.okunmuslarDahil !== false,
      },
      EbelgeController.getDbContext(req)
    );
    return ApiResponse.ok(res, `${sonuc.yazilan} belge güncellendi.`, sonuc);
  });

  /**
   * GET /api/v1/e-belge/gelen
   */
  public static listGelen = asyncHandler(async (req: Request, res: Response) => {
    const sonuc = await EbelgeService.listGelen(
      {
        sayfa: req.query.sayfa ? Number(req.query.sayfa) : 1,
        boyut: req.query.boyut ? Number(req.query.boyut) : 50,
        baslangicTarihi: (req.query.baslangicTarihi as string) || undefined,
        bitisTarihi: (req.query.bitisTarihi as string) || undefined,
        arama: (req.query.arama as string) || undefined,
        redKabul: (req.query.redKabul as any) || undefined,
      },
      EbelgeController.getDbContext(req)
    );
    return ApiResponse.ok(res, "Gelen belgeler listelendi.", sonuc);
  });

  /**
   * GET /api/v1/e-belge/gelen/:uuid?statuYenile=true
   */
  public static getGelenDetay = asyncHandler(async (req: Request, res: Response) => {
    const uuid = String(req.params.uuid || "").trim();
    if (!uuid) throw ApiError.badRequest("Belge UUID bilgisi zorunludur.");

    const detay = await EbelgeService.getGelenDetay(
      uuid,
      req.query.statuYenile === "true",
      EbelgeController.getKullanici(req),
      EbelgeController.getDbContext(req)
    );
    return ApiResponse.ok(res, "Belge detayı getirildi.", detay);
  });

  /**
   * GET /api/v1/e-belge/gelen/:uuid/goruntu?format=html|pdf
   *
   * HTML metin olarak döner (frontend sandbox'lı iframe'e koyar);
   * PDF ikili akış olarak döner — base64 JSON gövdesinde taşınmaz.
   */
  public static getGelenGoruntu = asyncHandler(async (req: Request, res: Response) => {
    const uuid = String(req.params.uuid || "").trim();
    if (!uuid) throw ApiError.badRequest("Belge UUID bilgisi zorunludur.");

    const format = String(req.query.format || "html").toLowerCase();
    const kullanici = EbelgeController.getKullanici(req);
    const dbContext = EbelgeController.getDbContext(req);

    if (format === "pdf") {
      const pdf = await EbelgeService.getGelenPdf(uuid, kullanici, dbContext);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `inline; filename="${uuid}.pdf"`);
      res.setHeader("Content-Length", String(pdf.length));
      return res.status(200).end(pdf);
    }

    if (format !== "html") {
      throw ApiError.badRequest("Geçerli biçimler: html, pdf");
    }

    const html = await EbelgeService.getGelenHtml(uuid, kullanici, dbContext);
    return ApiResponse.ok(res, "Belge görüntüsü getirildi.", { format: "html", html });
  });

  /**
   * POST /api/v1/e-belge/gelen/:uuid/cevap
   * Gövde: { redKabul: "Kabul" | "Red", aciklama?: string }
   *
   * GERİ ALINAMAZ işlem.
   */
  public static gelenCevapVer = asyncHandler(async (req: Request, res: Response) => {
    const uuid = String(req.params.uuid || "").trim();
    if (!uuid) throw ApiError.badRequest("Belge UUID bilgisi zorunludur.");

    const redKabul = String(req.body?.redKabul || "").trim();
    if (redKabul !== "Kabul" && redKabul !== "Red") {
      throw ApiError.badRequest('Cevap "Kabul" veya "Red" olmalıdır.');
    }

    const aciklama = String(req.body?.aciklama || "").trim();

    const sonuc = await EbelgeService.cevapVer(
      uuid,
      redKabul,
      aciklama,
      EbelgeController.getKullanici(req),
      EbelgeController.getDbContext(req)
    );

    return ApiResponse.ok(res, `Belgeye "${redKabul}" cevabı gönderildi.`, sonuc);
  });

  /**
   * POST /api/v1/e-belge/gelen/:uuid/statu
   * Gövde: { statu: "Okundu" | "Okunmadı" | "Islendi" | "Islenmedi" }
   */
  public static gelenStatuIsle = asyncHandler(async (req: Request, res: Response) => {
    const uuid = String(req.params.uuid || "").trim();
    if (!uuid) throw ApiError.badRequest("Belge UUID bilgisi zorunludur.");

    const statu = String(req.body?.statu || "").trim();
    if (!ICE_BELGE_STATULERI.includes(statu as any)) {
      throw ApiError.badRequest(`Geçerli statüler: ${ICE_BELGE_STATULERI.join(", ")}`);
    }

    const sonuc = await EbelgeService.statuIsle(
      uuid,
      statu as any,
      EbelgeController.getKullanici(req),
      EbelgeController.getDbContext(req)
    );

    return ApiResponse.ok(res, "Belge statüsü güncellendi.", sonuc);
  });

  /* ======================================================================
     Giden belge — doğrulama (Faz 5)
     ====================================================================== */

  /**
   * POST /api/v1/e-belge/giden/dogrula
   *
   * UBL-TR faturayı üretir ve ICE'ye **göndermeden** şema + schematron doğrulatır.
   * Belge oluşturmaz, mali sonuç doğurmaz.
   */
  public static dogrulaGidenBelge = asyncHandler(async (req: Request, res: Response) => {
    const parsed = ebelgeDogrulaSchema.safeParse(req.body);
    if (!parsed.success) {
      throw ApiError.badRequest("Belge bilgileri geçersiz.", parsed.error.format());
    }

    const { onizleme, ...girdi } = parsed.data;

    const sonuc = await EbelgeService.dogrulaGidenBelge(
      girdi as any,
      EbelgeController.getKullanici(req),
      onizleme,
      EbelgeController.getDbContext(req)
    );

    const mesaj =
      sonuc.semaGecerli && sonuc.schematronGecerli
        ? "Belge şema ve schematron doğrulamasından geçti."
        : "Belge doğrulamadan geçemedi.";

    return ApiResponse.ok(res, mesaj, sonuc);
  });

  /**
   * GET /api/v1/e-belge/giden/son-belge-no?seri=ABC&belgeTuru=EFatura&yil=2026
   */
  public static getSonBelgeNo = asyncHandler(async (req: Request, res: Response) => {
    const seri = String(req.query.seri || "").trim();
    const belgeTuru = String(req.query.belgeTuru || "EFatura").trim();
    const yil = Number(req.query.yil) || new Date().getFullYear();

    if (!seri) throw ApiError.badRequest("Seri bilgisi zorunludur.");

    const sonuc = await EbelgeService.getSonBelgeNo(
      seri,
      belgeTuru,
      yil,
      EbelgeController.getDbContext(req)
    );
    return ApiResponse.ok(res, "Son belge numarası getirildi.", sonuc);
  });

  /* ======================================================================
     Giden belge — taslak (Faz 6). GİB'e gönderim YOK.
     ====================================================================== */

  /**
   * GET /api/v1/e-belge/mukellef?vkn=1234567890
   */
  public static mukellefSorgula = asyncHandler(async (req: Request, res: Response) => {
    const vkn = String(req.query.vkn || "").trim();
    if (!vkn) throw ApiError.badRequest("vkn parametresi zorunludur.");

    const sonuc = await EbelgeService.mukellefSorgula(
      vkn,
      EbelgeController.getKullanici(req),
      EbelgeController.getDbContext(req)
    );

    return ApiResponse.ok(
      res,
      sonuc.mukellefMi ? "Alıcı e-Fatura mükellefi." : "Alıcı e-Fatura mükellefi değil (e-Arşiv kesilmeli).",
      sonuc
    );
  });

  /**
   * POST /api/v1/e-belge/giden/taslak
   *
   * Belgeyi ICE'de TASLAK olarak oluşturur. GİB'e GÖNDERMEZ.
   */
  public static taslakGonder = asyncHandler(async (req: Request, res: Response) => {
    const parsed = ebelgeTaslakSchema.safeParse(req.body);
    if (!parsed.success) {
      throw ApiError.badRequest("Belge bilgileri geçersiz.", parsed.error.format());
    }

    const sonuc = await EbelgeService.taslakGonder(
      parsed.data as any,
      EbelgeController.getKullanici(req),
      EbelgeController.getDbContext(req)
    );

    return ApiResponse.created(res, "Taslak oluşturuldu. Belge GİB'e gönderilmedi.", sonuc);
  });

  /**
   * POST /api/v1/e-belge/giden/:uuid/iptal
   * Taslağı iptal eder (DraftCancel).
   */
  public static taslakIptal = asyncHandler(async (req: Request, res: Response) => {
    const uuid = String(req.params.uuid || "").trim();
    if (!uuid) throw ApiError.badRequest("Belge UUID bilgisi zorunludur.");

    const sonuc = await EbelgeService.taslakIptal(
      uuid,
      EbelgeController.getKullanici(req),
      EbelgeController.getDbContext(req)
    );

    return ApiResponse.ok(res, "Taslak iptal edildi.", sonuc);
  });

  /**
   * GET /api/v1/e-belge/giden
   */
  public static listGiden = asyncHandler(async (req: Request, res: Response) => {
    const sonuc = await EbelgeService.listGiden(
      {
        sayfa: req.query.sayfa ? Number(req.query.sayfa) : 1,
        boyut: req.query.boyut ? Number(req.query.boyut) : 50,
        arama: (req.query.arama as string) || undefined,
        durum: (req.query.durum as string) || undefined,
      },
      EbelgeController.getDbContext(req)
    );
    return ApiResponse.ok(res, "Giden belgeler listelendi.", sonuc);
  });

  /* ======================================================================
     e-Arşiv (Faz 8a) — MALİ SONUÇ DOĞURUR
     ====================================================================== */

  /**
   * POST /api/v1/e-belge/earsiv/gonder
   */
  public static earsivGonder = asyncHandler(async (req: Request, res: Response) => {
    const parsed = ebelgeTaslakSchema.safeParse({ ...req.body, senaryo: "EARSIVFATURA" });
    if (!parsed.success) {
      throw ApiError.badRequest("Belge bilgileri geçersiz.", parsed.error.format());
    }

    const sonuc = await EbelgeService.earsivGonder(
      parsed.data as any,
      EbelgeController.getKullanici(req),
      EbelgeController.getDbContext(req)
    );

    return ApiResponse.created(res, "e-Arşiv faturası gönderildi.", sonuc);
  });

  public static earsivArsivSenkronize = asyncHandler(async (req: Request, res: Response) => {
    const parsed = ebelgeArsivSenkronizeSchema.safeParse(req.body);
    if (!parsed.success) throw ApiError.badRequest("Arşiv sorgu bilgileri geçersiz.", parsed.error.format());
    const sonuc = await EbelgeService.senkronizeEarsivArsiv({
      baslangic: new Date(`${parsed.data.baslangic}T00:00:00+03:00`),
      bitis: new Date(`${parsed.data.bitis}T23:59:59.999+03:00`), limit: parsed.data.limit,
    }, EbelgeController.getKullanici(req), EbelgeController.getDbContext(req));
    return ApiResponse.ok(res, "ICE arşiv sorgusu tamamlandı.", sonuc);
  });

  public static earsivArsivListe = asyncHandler(async (req: Request, res: Response) => {
    const parsed = ebelgeArsivListeSchema.safeParse(req.query);
    if (!parsed.success) throw ApiError.badRequest("Liste parametreleri geçersiz.", parsed.error.format());
    const sonuc = await EbelgeSqlRepository.listEarsivArsiv(parsed.data.sayfa, parsed.data.arama, EbelgeController.getDbContext(req));
    return ApiResponse.ok(res, "ICE arşiv kayıtları listelendi.", sonuc);
  });

  public static earsivArsivStatu = asyncHandler(async (req: Request, res: Response) => {
    const parsed = ebelgeArsivStatuSchema.safeParse({ uuid: req.params.uuid, statu: req.body?.statu });
    if (!parsed.success) throw ApiError.badRequest("Arşiv işareti geçersiz.", parsed.error.format());
    const sonuc = await EbelgeService.earsivArsivIsaretle(parsed.data.uuid, parsed.data.statu,
      EbelgeController.getKullanici(req), EbelgeController.getDbContext(req));
    return ApiResponse.ok(res, "ICE arşiv işareti güncellendi.", sonuc);
  });

  /**
   * POST /api/v1/e-belge/earsiv/:uuid/iptal
   * Gövde: { iptalTarihi?: "YYYY-MM-DD" }
   */
  public static earsivIptal = asyncHandler(async (req: Request, res: Response) => {
    const uuid = String(req.params.uuid || "").trim();
    if (!uuid) throw ApiError.badRequest("Belge UUID bilgisi zorunludur.");

    const ham = String(req.body?.iptalTarihi || "").trim();
    const tarih = ham || new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" });
    if (!ebelgeTarihSchema.safeParse(tarih).success) {
      throw ApiError.badRequest("İptal tarihi geçersiz.");
    }
    const iptalTarihi = new Date(tarih);

    const sonuc = await EbelgeService.earsivIptal(
      uuid,
      iptalTarihi,
      EbelgeController.getKullanici(req),
      EbelgeController.getDbContext(req)
    );

    return ApiResponse.ok(res, "e-Arşiv iptal bildirimi gönderildi.", sonuc);
  });

  /**
   * GET /api/v1/e-belge/earsiv/durum?ettn=a,b,c
   */
  public static earsivDurum = asyncHandler(async (req: Request, res: Response) => {
    const ham = String(req.query.ettn || "").trim();
    const ettnler = ham.split(",").map((e) => e.trim()).filter(Boolean);
    if (!ettnler.length) throw ApiError.badRequest("ettn parametresi zorunludur.");

    const sonuc = await EbelgeService.earsivDurum(
      ettnler,
      EbelgeController.getKullanici(req),
      EbelgeController.getDbContext(req)
    );
    return ApiResponse.ok(res, "e-Arşiv durum bilgisi getirildi.", sonuc);
  });

  /**
   * POST /api/v1/e-belge/giden/:uuid/mail
   * Gövde: { alicilar: [{ eposta, unvan? }] }
   *
   * Belgeyi alıcıya e-posta ile gönderir. Tekrar çağrılırsa alıcıya yeniden mail gider.
   */
  public static belgeMailGonder = asyncHandler(async (req: Request, res: Response) => {
    const uuid = String(req.params.uuid || "").trim();
    if (!uuid) throw ApiError.badRequest("Belge UUID bilgisi zorunludur.");

    const ham = req.body?.alicilar;
    if (!Array.isArray(ham) || !ham.length) {
      throw ApiError.badRequest("En az bir e-posta alıcısı gereklidir.");
    }
    if (ham.length > 20) {
      throw ApiError.badRequest("Tek seferde en fazla 20 alıcıya gönderilebilir.");
    }

    const alicilar = ham.map((a: any) => ({
      unvan: a?.unvan ? String(a.unvan).slice(0, 150) : undefined,
      eposta: String(a?.eposta || "").slice(0, 150),
    }));

    const sonuc = await EbelgeService.belgeMailGonder(
      uuid,
      alicilar,
      EbelgeController.getKullanici(req),
      EbelgeController.getDbContext(req)
    );

    return ApiResponse.ok(
      res,
      sonuc.basarisiz > 0
        ? `${sonuc.gonderilen} alıcıya gönderildi, ${sonuc.basarisiz} alıcıda hata oluştu.`
        : `${sonuc.gonderilen} alıcıya e-posta gönderildi.`,
      sonuc
    );
  });

  /**
   * GET /api/v1/e-belge/earsiv/:uuid/pdf
   */
  public static earsivPdf = asyncHandler(async (req: Request, res: Response) => {
    const uuid = String(req.params.uuid || "").trim();
    if (!uuid) throw ApiError.badRequest("Belge UUID bilgisi zorunludur.");

    const pdf = await EbelgeService.earsivPdf(
      uuid,
      EbelgeController.getKullanici(req),
      EbelgeController.getDbContext(req)
    );

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${uuid}.pdf"`);
    res.setHeader("Content-Length", String(pdf.length));
    return res.status(200).end(pdf);
  });

  /* ======================================================================
     e-İrsaliye (Faz 9)
     ====================================================================== */

  /**
   * POST /api/v1/e-belge/irsaliye/dogrula — belge GÖNDERİLMEZ
   */
  public static irsaliyeDogrula = asyncHandler(async (req: Request, res: Response) => {
    const parsed = ebelgeIrsaliyeSchema.safeParse(req.body);
    if (!parsed.success) {
      throw ApiError.badRequest("İrsaliye bilgileri geçersiz.", parsed.error.format());
    }
    const { onizleme, aliciAlias, ...girdi } = parsed.data;

    const sonuc = await EbelgeService.dogrulaIrsaliyeBelgesi(
      girdi as any,
      EbelgeController.getKullanici(req),
      onizleme,
      EbelgeController.getDbContext(req)
    );

    const mesaj =
      sonuc.semaGecerli && sonuc.schematronGecerli
        ? "İrsaliye şema ve schematron doğrulamasından geçti."
        : "İrsaliye doğrulamadan geçemedi.";

    return ApiResponse.ok(res, mesaj, sonuc);
  });

  /**
   * POST /api/v1/e-belge/irsaliye/gonder — GİB'E GİDER, GERİ ALINAMAZ
   */
  public static irsaliyeGonder = asyncHandler(async (req: Request, res: Response) => {
    const parsed = ebelgeIrsaliyeSchema.safeParse(req.body);
    if (!parsed.success) {
      throw ApiError.badRequest("İrsaliye bilgileri geçersiz.", parsed.error.format());
    }
    const { onizleme, ...girdi } = parsed.data;

    const sonuc = await EbelgeService.irsaliyeGonder(
      girdi as any,
      EbelgeController.getKullanici(req),
      EbelgeController.getDbContext(req)
    );

    return ApiResponse.created(res, "e-İrsaliye GİB'e gönderildi.", sonuc);
  });

  /**
   * GET /api/v1/e-belge/irsaliye/mukellef?vkn=
   */
  public static irsaliyeMukellef = asyncHandler(async (req: Request, res: Response) => {
    const vkn = String(req.query.vkn || "").trim();
    if (!vkn) throw ApiError.badRequest("vkn parametresi zorunludur.");

    const sonuc = await EbelgeService.irsaliyeMukellefSorgula(
      vkn,
      EbelgeController.getKullanici(req),
      EbelgeController.getDbContext(req)
    );

    return ApiResponse.ok(
      res,
      sonuc.mukellefMi
        ? "Alıcı e-İrsaliye mükellefi."
        : "Alıcı e-İrsaliye mükellefi değil (kâğıt irsaliye düzenlenmeli).",
      sonuc
    );
  });

  /**
   * GET /api/v1/e-belge/irsaliye?yon=IN&gunSayisi=30
   */
  public static irsaliyeListe = asyncHandler(async (req: Request, res: Response) => {
    const yon = String(req.query.yon || "IN").toUpperCase() === "OUT" ? "OUT" : "IN";
    const sonuc = await EbelgeService.irsaliyeListe(
      {
        yon,
        gunSayisi: req.query.gunSayisi ? Number(req.query.gunSayisi) : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
      },
      EbelgeController.getKullanici(req),
      EbelgeController.getDbContext(req)
    );
    return ApiResponse.ok(res, "İrsaliyeler listelendi.", sonuc);
  });

  /**
   * GET /api/v1/e-belge/irsaliye/statu?uuid=a,b&yon=OUT
   */
  public static irsaliyeStatu = asyncHandler(async (req: Request, res: Response) => {
    const ham = String(req.query.uuid || "").trim();
    const uuidler = ham.split(",").map((x) => x.trim()).filter(Boolean);
    if (!uuidler.length) throw ApiError.badRequest("uuid parametresi zorunludur.");
    const yon = String(req.query.yon || "OUT").toUpperCase() === "IN" ? "IN" : "OUT";

    const sonuc = await EbelgeService.irsaliyeStatu(
      uuidler,
      yon,
      EbelgeController.getKullanici(req),
      EbelgeController.getDbContext(req)
    );
    return ApiResponse.ok(res, "İrsaliye statüsü getirildi.", sonuc);
  });

  /**
   * GET /api/v1/e-belge/irsaliye/:ettn/pdf
   */
  public static irsaliyePdf = asyncHandler(async (req: Request, res: Response) => {
    const ettn = String(req.params.ettn || "").trim();
    if (!ettn) throw ApiError.badRequest("ETTN bilgisi zorunludur.");

    const pdf = await EbelgeService.irsaliyePdf(
      ettn,
      EbelgeController.getKullanici(req),
      EbelgeController.getDbContext(req)
    );

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${ettn}.pdf"`);
    res.setHeader("Content-Length", String(pdf.length));
    return res.status(200).end(pdf);
  });

  /* ======================================================================
     e-Fatura gerçek gönderimi (Faz 7) — GİB'E GİDER, GERİ ALINAMAZ
     ====================================================================== */

  /**
   * POST /api/v1/e-belge/giden/gonder
   *
   * ⚠️ Belgeyi doğrudan GİB'e gönderir. Geri alınamaz.
   */
  public static faturaGonder = asyncHandler(async (req: Request, res: Response) => {
    const parsed = ebelgeTaslakSchema.safeParse(req.body);
    if (!parsed.success) {
      throw ApiError.badRequest("Fatura bilgileri geçersiz.", parsed.error.format());
    }

    const sonuc = await EbelgeService.faturaGonder(
      parsed.data as any,
      EbelgeController.getKullanici(req),
      EbelgeController.getDbContext(req)
    );

    return ApiResponse.created(res, "e-Fatura GİB'e gönderildi.", sonuc);
  });

  /**
   * POST /api/v1/e-belge/giden/:uuid/onayla
   * Taslağı onaylayıp GİB'e gönderir (DraftApproval). Geri alınamaz.
   */
  public static taslakOnayla = asyncHandler(async (req: Request, res: Response) => {
    const uuid = String(req.params.uuid || "").trim();
    if (!uuid) throw ApiError.badRequest("Belge UUID bilgisi zorunludur.");

    const sonuc = await EbelgeService.taslakOnayla(
      uuid,
      EbelgeController.getKullanici(req),
      EbelgeController.getDbContext(req)
    );

    return ApiResponse.ok(res, "Taslak onaylandı ve GİB'e gönderildi.", sonuc);
  });

  /**
   * GET /api/v1/e-belge/giden/:uuid/statu
   */
  public static gidenStatuYenile = asyncHandler(async (req: Request, res: Response) => {
    const uuid = String(req.params.uuid || "").trim();
    if (!uuid) throw ApiError.badRequest("Belge UUID bilgisi zorunludur.");

    const sonuc = await EbelgeService.gidenStatuYenile(
      uuid,
      EbelgeController.getKullanici(req),
      EbelgeController.getDbContext(req)
    );

    return ApiResponse.ok(res, "Belge statüsü getirildi.", sonuc);
  });

  /* ======================================================================
     e-Gider Pusulası (Faz 8d) — MALİ SONUÇ DOĞURUR, ÖN DOĞRULAMA YOK
     ====================================================================== */

  /**
   * POST /api/v1/e-belge/gider-pusulasi/gonder
   */
  public static giderPusulasiGonder = asyncHandler(async (req: Request, res: Response) => {
    const parsed = ebelgeGiderPusulasiSchema.safeParse(req.body);
    if (!parsed.success) {
      throw ApiError.badRequest("Gider pusulası bilgileri geçersiz.", parsed.error.format());
    }

    const sonuc = await EbelgeService.giderPusulasiGonder(
      parsed.data as any,
      EbelgeController.getKullanici(req),
      EbelgeController.getDbContext(req)
    );

    return ApiResponse.created(res, "e-Gider Pusulası gönderildi.", sonuc);
  });

  /**
   * GET /api/v1/e-belge/gider-pusulasi/:uuid/pdf
   */
  public static giderPusulasiPdf = asyncHandler(async (req: Request, res: Response) => {
    const uuid = String(req.params.uuid || "").trim();
    if (!uuid) throw ApiError.badRequest("Belge UUID bilgisi zorunludur.");

    const pdf = await EbelgeService.giderPusulasiPdf(
      uuid,
      EbelgeController.getKullanici(req),
      EbelgeController.getDbContext(req)
    );

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${uuid}.pdf"`);
    res.setHeader("Content-Length", String(pdf.length));
    return res.status(200).end(pdf);
  });

  /**
   * GET /api/v1/e-belge/log?limit=50
   */
  public static getLogs = asyncHandler(async (req: Request, res: Response) => {
    const limit = Number(req.query.limit) || 50;
    const logs = await EbelgeService.getLogs(limit, EbelgeController.getDbContext(req));
    return ApiResponse.ok(res, "e-Belge işlem kayıtları getirildi.", logs);
  });
}
