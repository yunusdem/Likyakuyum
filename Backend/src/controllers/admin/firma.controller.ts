import { Request, Response } from "express";
import { FirmaService } from "../../services/admin/firma.service.js";
import { FirmaBaglantiService } from "../../services/admin/firmaBaglanti.service.js";
import { EpostaDogrulamaService } from "../../services/admin/epostaDogrulama.service.js";
import { KlonService } from "../../services/admin/klon.service.js";
import { YedekService } from "../../services/admin/yedek.service.js";
import { SilmeService } from "../../services/admin/silme.service.js";
import { LisansKodService } from "../../services/admin/lisansKod.service.js";
import { AyarService } from "../../services/admin/ayar.service.js";
import { MerkezKurulumService } from "../../services/admin/merkezKurulum.service.js";
import { KurulumSqlRepository } from "../../models/admin/kurulumSql.repository.js";
import { SurumService } from "../../services/admin/surum.service.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

const id = (req: Request): number => Number(req.params.id);

export class FirmaController {
  public static ozet = asyncHandler(async (req: Request, res: Response) => {
    return ApiResponse.ok(res, "Özet getirildi.", await FirmaService.ozet());
  });

  public static listele = asyncHandler(async (req: Request, res: Response) => {
    return ApiResponse.ok(res, "Firmalar getirildi.", await FirmaService.listele());
  });

  public static getir = asyncHandler(async (req: Request, res: Response) => {
    return ApiResponse.ok(res, "Firma getirildi.", await FirmaService.getir(id(req)));
  });

  public static ekle = asyncHandler(async (req: Request, res: Response) => {
    return ApiResponse.created(res, "Firma oluşturuldu.", await FirmaService.ekle(req.admin!, req.body));
  });

  public static bulutDurum = asyncHandler(async (req: Request, res: Response) => {
    return ApiResponse.ok(res, "Bulut durumu getirildi.", KlonService.durum());
  });

  public static bulutEkle = asyncHandler(async (req: Request, res: Response) => {
    return ApiResponse.created(res, "Firma ve veritabanı oluşturuldu.", await KlonService.olustur(req.admin!, req.body));
  });

  public static yedekle = asyncHandler(async (req: Request, res: Response) => {
    return ApiResponse.ok(res, "Yedek alındı.", await YedekService.yedekle(req.admin!, id(req)));
  });

  public static yedekBaglantisi = asyncHandler(async (req: Request, res: Response) => {
    return ApiResponse.ok(res, "İndirme bağlantısı hazır.", await YedekService.indirmeBaglantisi(req.admin!, id(req)));
  });

  /** Açık uç: bağlantıdaki anahtarla yedek dosyası (oturum gerekmez; anahtar 15 dk geçerli). */
  public static indir = asyncHandler(async (req: Request, res: Response) => {
    await YedekService.indir(String(req.params.token), res);
  });

  public static silmeDurumu = asyncHandler(async (req: Request, res: Response) => {
    const firma = await FirmaService.getir(id(req));
    return ApiResponse.ok(res, "Silme durumu getirildi.", { silinemezNedeni: await SilmeService.silinemezNedeni(firma) });
  });

  public static sil = asyncHandler(async (req: Request, res: Response) => {
    return ApiResponse.ok(res, "Firma silinmek üzere işaretlendi.", await SilmeService.silmeIste(req.admin!, id(req), req.body.onay));
  });

  public static silmeyiGeriAl = asyncHandler(async (req: Request, res: Response) => {
    return ApiResponse.ok(res, "Silme geri alındı.", await SilmeService.geriAl(req.admin!, id(req)));
  });

  public static lisansKodu = asyncHandler(async (req: Request, res: Response) => {
    res.setHeader("Cache-Control", "no-store");
    const sonuc = await LisansKodService.kodUret(req.admin!, id(req), Number(req.params.lisansId), req.body.makineKimligi);
    return ApiResponse.ok(res, "Lisans kodu üretildi.", sonuc);
  });

  public static lisansIptal = asyncHandler(async (req: Request, res: Response) => {
    return ApiResponse.ok(res, "Lisans iptal edildi.", await LisansKodService.iptal(req.admin!, id(req), Number(req.params.lisansId)));
  });

  /** Kurulum (exe) firması: son bildirilen makine ve bildirim geçmişi */
  public static kurulumDurumu = asyncHandler(async (req: Request, res: Response) => {
    const firmaId = id(req);
    await FirmaService.getir(firmaId);
    return ApiResponse.ok(res, "Kurulum durumu getirildi.", {
      sonBildirilenMakine: await KurulumSqlRepository.sonBildirilenMakine(firmaId),
      gecmis: await KurulumSqlRepository.heartbeatGecmisi(firmaId, 30),
    });
  });

  public static kurulumBaglantisi = asyncHandler(async (req: Request, res: Response) => {
    return ApiResponse.ok(res, "Kurulum bağlantısı hazır.", await MerkezKurulumService.kurulumBaglantisi(req.admin!, id(req)));
  });

  /** firma.lky (kurulum paketine konur) */
  public static firmaDosyasi = asyncHandler(async (req: Request, res: Response) => {
    const d = await MerkezKurulumService.firmaDosyasi(id(req));
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename="${d.dosyaAdi}"`);
    res.send(d.icerik);
  });

  public static surumler = asyncHandler(async (req: Request, res: Response) => {
    return ApiResponse.ok(res, "Sürümler getirildi.", await SurumService.listele());
  });

  public static surumGuncelle = asyncHandler(async (req: Request, res: Response) => {
    return ApiResponse.ok(res, "Sürüm güncellendi.", await SurumService.guncelle(req.admin!, String(req.params.surum), req.body));
  });

  public static hedefSurum = asyncHandler(async (req: Request, res: Response) => {
    return ApiResponse.ok(res, "Hedef sürüm kaydedildi.", await SurumService.hedefSurumAyarla(req.admin!, id(req), req.body.surum || null));
  });

  public static ayarlar = asyncHandler(async (req: Request, res: Response) => {
    return ApiResponse.ok(res, "Ayarlar getirildi.", await AyarService.getir());
  });

  public static ayarKaydet = asyncHandler(async (req: Request, res: Response) => {
    return ApiResponse.ok(res, "Ayarlar kaydedildi.", await AyarService.kaydet(req.admin!, req.body));
  });

  public static guncelle = asyncHandler(async (req: Request, res: Response) => {
    return ApiResponse.ok(res, "Firma güncellendi.", await FirmaService.guncelle(req.admin!, id(req), req.body));
  });

  public static durum = asyncHandler(async (req: Request, res: Response) => {
    return ApiResponse.ok(res, "Firma durumu değiştirildi.", await FirmaService.durumDegistir(req.admin!, id(req), req.body));
  });

  public static dogrulama = asyncHandler(async (req: Request, res: Response) => {
    return ApiResponse.ok(res, "Doğrulama kaydedildi.", await FirmaService.dogrulama(req.admin!, id(req), req.body));
  });

  public static dbTest = asyncHandler(async (req: Request, res: Response) => {
    const sonuc = await FirmaBaglantiService.dbTest(id(req));
    return ApiResponse.ok(res, sonuc.sonuc, { ...sonuc, firma: await FirmaService.getir(id(req)) });
  });

  public static masakKontrol = asyncHandler(async (req: Request, res: Response) => {
    const sonuc = await FirmaBaglantiService.masakKontrol(id(req));
    return ApiResponse.ok(res, sonuc.sonuc, { ...sonuc, firma: await FirmaService.getir(id(req)) });
  });

  public static mailDurumu = asyncHandler(async (req: Request, res: Response) => {
    return ApiResponse.ok(res, "Mail durumu getirildi.", EpostaDogrulamaService.mailDurumu());
  });

  public static epostaDogrulamaGonder = asyncHandler(async (req: Request, res: Response) => {
    return ApiResponse.ok(res, "Doğrulama maili gönderildi.", await EpostaDogrulamaService.gonder(req.admin!, id(req)));
  });

  public static epostaDogrulamaElle = asyncHandler(async (req: Request, res: Response) => {
    const firma = await EpostaDogrulamaService.elleAyarla(req.admin!, id(req), req.body.dogrulandi);
    return ApiResponse.ok(res, "E-posta doğrulaması güncellendi.", firma);
  });

  /** Herkese açık: maildeki bağlantıyı açan kişi düğmeye basınca çağrılır (oturum gerekmez). */
  public static epostaOnayla = asyncHandler(async (req: Request, res: Response) => {
    return ApiResponse.ok(res, "E-posta adresiniz doğrulandı.", await EpostaDogrulamaService.onayla(req.body.anahtar));
  });

  public static lisanslar = asyncHandler(async (req: Request, res: Response) => {
    return ApiResponse.ok(res, "Lisanslar getirildi.", await FirmaService.lisanslar(id(req)));
  });

  public static lisansEkle = asyncHandler(async (req: Request, res: Response) => {
    return ApiResponse.created(res, "Lisans eklendi.", await FirmaService.lisansEkle(req.admin!, id(req), req.body));
  });
}
