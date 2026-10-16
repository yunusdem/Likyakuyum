import { Request, Response, NextFunction } from "express";
import { env } from "../config/env.config.js";
import { HttpStatus } from "../constants/httpStatusCodes.js";
import { API_MODULLERI, ModulService } from "../services/admin/modul.service.js";
import { KurulumLisansService } from "../services/kurulum/kurulumLisans.service.js";
import { raporModulKodlari } from "../services/rapor/raporMenu.js";
import { ApiError } from "../utils/ApiError.js";

/**
 * Oturumun firmaya açık modülleri; null = kısıt yok. Kullanıcı uygulaması menüyü aynı listeyle süzer (user.merkez.moduller):
 * kurulumda (exe) yüklü lisanstaki liste, bulutta merkezdeki firma ayarı. Merkez girişi kapalıyken (MERKEZ_GIRIS) ve
 * modül ayarı hiç yapılmamış firmada kısıt yoktur.
 */
export const oturumModulleri = async (req: Request): Promise<string[] | null> => {
  if (env.KURULUM_MODU) return (await KurulumLisansService.durum()).moduller ?? null;
  if (env.MERKEZ_GIRIS !== "zorunlu") return null;
  const { dbServer, dbName } = req.user || {};
  if (!dbServer || !dbName) return null;
  return ModulService.oturumModulleri(dbServer, dbName);
};

/** Verilen kodlardan en az biri oturumun firmasına açık mı */
export const modulAcikMi = async (req: Request, kodlar: string[]): Promise<boolean> => {
  if (kodlar.length === 0) return true;
  const acik = await oturumModulleri(req);
  return acik === null || kodlar.some((k) => acik.includes(k));
};

export const modulKapaliHatasi = (mesaj = "Bu modül hesabınıza açık değil.") =>
  new ApiError(HttpStatus.FORBIDDEN, mesaj, { kod: "MODUL_KAPALI" });

/**
 * /rapor/:kod uçlarında raporun kendi menü maddesi lisansta açık mı (services/rapor/raporMenu.ts). /rapor öneki geniş
 * bir listeyle açıldığı için ("vezne" açık her firma) lisansta kapalı bir raporun verisi de alınabiliyordu.
 */
export const raporLisansKapisi = (req: Request, _res: Response, next: NextFunction) => {
  const kodlar = raporModulKodlari(String(req.params.kod || ""));
  if (!kodlar) return next();
  modulAcikMi(req, kodlar)
    .then((acik) => next(acik ? undefined : modulKapaliHatasi("Bu rapor hesabınıza açık değil.")))
    .catch(next);
};

/**
 * Firma bazlı modül kısıtı (docs/ADMIN_PANEL_YOL_HARITASI.md, Faz 4). authenticate'ten SONRA çalışır.
 * apiOnek, API_MODULLERI'ndeki anahtardır: o listedeki modüllerden biri firmaya açıksa istek geçer.
 */
export const modulKapisi = (apiOnek: keyof typeof API_MODULLERI | string) => {
  const kodlar = API_MODULLERI[apiOnek] || [];
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (await modulAcikMi(req, kodlar)) return next();
      next(modulKapaliHatasi());
    } catch (err) {
      next(err);
    }
  };
};
