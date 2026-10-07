import { env } from "../config/env.config.js";
import { DestekService } from "../services/destek/destek.service.js";
import { DestekKimlikService } from "../services/destek/destekKimlik.js";
import { DestekKurulumService } from "../services/destek/destekKurulum.service.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
/**
 * Kullanıcı uygulamasının destek uçları (/api/v1/destek). Bulutta kimlik merkezden çözülür;
 * kurulum (exe) modunda istekler merkeze köprülenir, internet yokken yerel kuyruk çalışır (K3, K21).
 */
const kurulum = () => env.KURULUM_MODU;
export class DestekController {
    static ozet = asyncHandler(async (req, res) => {
        if (kurulum())
            return ApiResponse.ok(res, "Destek özeti.", await DestekKurulumService.ozet(req.user));
        const kimlik = await DestekKimlikService.coz(req.user);
        return ApiResponse.ok(res, "Destek özeti.", await DestekService.kullaniciOzet(kimlik));
    });
    static konular = asyncHandler(async (req, res) => {
        const sekme = req.query.sekme || "tumu";
        if (kurulum())
            return ApiResponse.ok(res, "Konular.", await DestekKurulumService.konular(req.user, sekme));
        const kimlik = await DestekKimlikService.coz(req.user);
        return ApiResponse.ok(res, "Konular.", { konular: await DestekService.kullaniciKonulari(kimlik, sekme), cevrimdisi: false });
    });
    static konu = asyncHandler(async (req, res) => {
        const id = Number(req.params.id);
        if (kurulum())
            return ApiResponse.ok(res, "Konu.", await DestekKurulumService.konu(req.user, id));
        const kimlik = await DestekKimlikService.coz(req.user);
        return ApiResponse.ok(res, "Konu.", await DestekService.kullaniciKonu(kimlik, id));
    });
    static talepAc = asyncHandler(async (req, res) => {
        if (kurulum())
            return ApiResponse.created(res, "Talep oluşturuldu.", await DestekKurulumService.talepAc(req.user, req.body));
        const kimlik = await DestekKimlikService.coz(req.user);
        return ApiResponse.created(res, "Talep oluşturuldu.", await DestekService.talepAc(kimlik, req.body));
    });
    static mesajYaz = asyncHandler(async (req, res) => {
        const id = Number(req.params.id);
        if (kurulum())
            return ApiResponse.ok(res, "Mesaj gönderildi.", await DestekKurulumService.mesajYaz(req.user, id, req.body));
        const kimlik = await DestekKimlikService.coz(req.user);
        return ApiResponse.ok(res, "Mesaj gönderildi.", await DestekService.kullaniciMesaj(kimlik, id, req.body));
    });
    static okundu = asyncHandler(async (req, res) => {
        const konuId = req.body?.konuId ?? null;
        if (kurulum()) {
            await DestekKurulumService.okundu(req.user, konuId);
            return ApiResponse.ok(res, "Okundu.", null);
        }
        const kimlik = await DestekKimlikService.coz(req.user);
        await DestekService.okundu(kimlik, konuId);
        return ApiResponse.ok(res, "Okundu.", null);
    });
    static arsiv = asyncHandler(async (req, res) => {
        const id = Number(req.params.id);
        const deger = req.body?.deger !== false;
        if (kurulum()) {
            await DestekKurulumService.bayrak(req.user, id, "ARSIV", deger);
            return ApiResponse.ok(res, "Kaydedildi.", null);
        }
        const kimlik = await DestekKimlikService.coz(req.user);
        await DestekService.bayrak(kimlik, id, "ARSIV", deger);
        return ApiResponse.ok(res, "Kaydedildi.", null);
    });
    static onemliOkundu = asyncHandler(async (req, res) => {
        const id = Number(req.params.id);
        if (kurulum()) {
            await DestekKurulumService.bayrak(req.user, id, "ONEMLI_OKUNDU", true);
            return ApiResponse.ok(res, "Kaydedildi.", null);
        }
        const kimlik = await DestekKimlikService.coz(req.user);
        await DestekService.bayrak(kimlik, id, "ONEMLI_OKUNDU", true);
        return ApiResponse.ok(res, "Kaydedildi.", null);
    });
    static ek = asyncHandler(async (req, res) => {
        const id = Number(req.params.id);
        if (kurulum())
            return DestekKurulumService.ek(req.user, id, res);
        const kimlik = await DestekKimlikService.coz(req.user);
        const d = await DestekService.kullaniciEk(kimlik, id);
        res.setHeader("Cache-Control", "private, max-age=3600");
        res.type(d.mime);
        res.sendFile(d.yol);
    });
}
