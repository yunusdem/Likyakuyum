import { Request, Response } from "express";
import { DestekPanelAuthService } from "../../services/destekPanel/destekPanelAuth.service.js";
import { DestekPanelService } from "../../services/destekPanel/destekPanel.service.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { istemciIp, istemciTarayici } from "../../utils/istemci.utils.js";

/** Destek paneli (destek.likyakuyum.com) — /api/v1/destek-panel */
export class DestekPanelController {
  // ---- Giriş
  public static giris = asyncHandler(async (req: Request, res: Response) =>
    ApiResponse.ok(res, "Giriş başarılı.", await DestekPanelAuthService.giris(req.body, { ip: istemciIp(req), tarayici: istemciTarayici(req) }))
  );
  public static cikis = asyncHandler(async (req: Request, res: Response) => {
    await DestekPanelAuthService.cikis(req.personel!.sid);
    return ApiResponse.ok(res, "Çıkış yapıldı.");
  });
  public static ben = asyncHandler(async (req: Request, res: Response) => ApiResponse.ok(res, "Hesap.", await DestekPanelAuthService.profil(req.personel!)));
  public static sifreDegistir = asyncHandler(async (req: Request, res: Response) => {
    await DestekPanelAuthService.sifreDegistir(req.personel!, req.body);
    return ApiResponse.ok(res, "Şifreniz değiştirildi.");
  });

  // ---- Talepler
  public static ozet = asyncHandler(async (req: Request, res: Response) => ApiResponse.ok(res, "Özet.", await DestekPanelService.ozet(req.personel!)));
  public static konular = asyncHandler(async (req: Request, res: Response) => {
    const q = req.query as Record<string, any>;
    return ApiResponse.ok(
      res,
      "Kayıtlar.",
      await DestekPanelService.konular(req.personel!, {
        sekme: q.sekme ?? "havuz",
        durum: q.durum,
        firmaId: q.firmaId ? Number(q.firmaId) : undefined,
        personelId: q.personelId ? Number(q.personelId) : undefined,
        kaynakKonuId: q.kaynakKonuId ? Number(q.kaynakKonuId) : undefined,
        arama: q.arama,
        sayfa: q.sayfa ? Number(q.sayfa) : undefined,
        sayfaBoyu: q.sayfaBoyu ? Number(q.sayfaBoyu) : undefined,
      })
    );
  });
  public static konu = asyncHandler(async (req: Request, res: Response) => ApiResponse.ok(res, "Kayıt.", await DestekPanelService.konu(req.personel!, Number(req.params.id))));
  public static mesaj = asyncHandler(async (req: Request, res: Response) =>
    ApiResponse.ok(res, req.body.icNot ? "İç not eklendi." : "Cevap gönderildi.", await DestekPanelService.mesaj(req.personel!, Number(req.params.id), req.body))
  );
  public static ustlen = asyncHandler(async (req: Request, res: Response) => ApiResponse.ok(res, "Kayıt üstlenildi.", await DestekPanelService.ustlen(req.personel!, Number(req.params.id))));
  public static aktar = asyncHandler(async (req: Request, res: Response) =>
    ApiResponse.ok(res, req.body.personelId ? "Kayıt aktarıldı." : "Kayıt havuza bırakıldı.", await DestekPanelService.aktar(req.personel!, Number(req.params.id), req.body.personelId))
  );
  public static durum = asyncHandler(async (req: Request, res: Response) =>
    ApiResponse.ok(res, req.body.durum === "KAPALI" ? "Kayıt kapatıldı." : "Kayıt yeniden açıldı.", await DestekPanelService.durum(req.personel!, Number(req.params.id), req.body.durum))
  );
  public static telefonTalebi = asyncHandler(async (req: Request, res: Response) =>
    ApiResponse.created(res, "Talep açıldı.", await DestekPanelService.telefonTalebi(req.personel!, req.body))
  );
  public static ek = asyncHandler(async (req: Request, res: Response) => {
    const d = await DestekPanelService.ek(req.personel!, Number(req.params.id));
    res.setHeader("Cache-Control", "private, max-age=3600");
    res.type(d.mime);
    res.sendFile(d.yol);
  });

  // ---- Bildirimler
  public static bildirimler = asyncHandler(async (req: Request, res: Response) => ApiResponse.ok(res, "Bildirimler.", await DestekPanelService.bildirimler(req.personel!)));
  public static hedefSecenekleri = asyncHandler(async (req: Request, res: Response) => ApiResponse.ok(res, "Hedef seçenekleri.", await DestekPanelService.hedefSecenekleri()));
  public static bildirimOlustur = asyncHandler(async (req: Request, res: Response) =>
    ApiResponse.created(res, req.body.gonder ? "Bildirim gönderildi." : "Taslak kaydedildi.", await DestekPanelService.bildirimOlustur(req.personel!, req.body))
  );
  public static bildirimGuncelle = asyncHandler(async (req: Request, res: Response) =>
    ApiResponse.ok(res, req.body.gonder ? "Bildirim gönderildi." : "Taslak kaydedildi.", await DestekPanelService.bildirimGuncelle(req.personel!, Number(req.params.id), req.body))
  );
  public static bildirimGeriCek = asyncHandler(async (req: Request, res: Response) =>
    ApiResponse.ok(res, "Bildirim geri çekildi.", await DestekPanelService.bildirimGeriCek(req.personel!, Number(req.params.id)))
  );

  // ---- Müşteriler
  public static musteriler = asyncHandler(async (req: Request, res: Response) =>
    ApiResponse.ok(res, "Müşteriler.", await DestekPanelService.musteriler((req.query as any).arama))
  );
  public static musteri = asyncHandler(async (req: Request, res: Response) => ApiResponse.ok(res, "Müşteri.", await DestekPanelService.musteri(req.personel!, Number(req.params.id))));

  // ---- Hızlı cevap
  public static hizliCevaplar = asyncHandler(async (req: Request, res: Response) =>
    ApiResponse.ok(res, "Hızlı cevaplar.", await DestekPanelService.hizliCevaplar(req.personel!, (req.query as any).hepsi === "1"))
  );
  public static hizliCevapYaz = asyncHandler(async (req: Request, res: Response) => ApiResponse.ok(res, "Kaydedildi.", await DestekPanelService.hizliCevapYaz(req.personel!, req.body)));

  // ---- Ekip / personel
  public static ekip = asyncHandler(async (req: Request, res: Response) => ApiResponse.ok(res, "Ekip.", await DestekPanelService.ekip()));
  public static personelListe = asyncHandler(async (req: Request, res: Response) => ApiResponse.ok(res, "Personel.", await DestekPanelService.personelListe(req.personel!)));
  public static personelEkle = asyncHandler(async (req: Request, res: Response) => ApiResponse.created(res, "Personel eklendi.", await DestekPanelService.personelEkle(req.personel!, req.body)));
  public static personelGuncelle = asyncHandler(async (req: Request, res: Response) =>
    ApiResponse.ok(res, "Personel güncellendi.", await DestekPanelService.personelGuncelle(req.personel!, Number(req.params.id), req.body))
  );
  public static personelSifre = asyncHandler(async (req: Request, res: Response) =>
    ApiResponse.ok(res, "Geçici şifre oluşturuldu.", await DestekPanelService.personelSifreSifirla(req.personel!, Number(req.params.id)))
  );
  public static personelKilitAc = asyncHandler(async (req: Request, res: Response) =>
    ApiResponse.ok(res, "Kilit açıldı.", await DestekPanelService.personelKilitAc(req.personel!, Number(req.params.id)))
  );

  // ---- Rapor
  public static rapor = asyncHandler(async (req: Request, res: Response) => {
    const q = req.query as Record<string, string>;
    return ApiResponse.ok(res, "Rapor.", await DestekPanelService.rapor(req.personel!, q.bas, q.bit));
  });
}
