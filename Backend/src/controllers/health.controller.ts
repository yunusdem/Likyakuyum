import { Request, Response } from "express";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ResponseMessages } from "../constants/responseMessages.js";
import { env } from "../config/env.config.js";
import { gocDurumu } from "../services/kurulum/gocDurumu.js";

export class HealthController {
  public static check = (req: Request, res: Response) => {
    // Kurulumda şema göçü bitmeden ya da hatalıyken sağlıklı sayılmaz: güncelleyici eski sürüme döner, kurulum hata verir
    const goc = gocDurumu();
    if (env.KURULUM_MODU && goc.durum !== "tamam") {
      return res.status(503).json({
        success: false,
        // Ayrıntı (SQL hata metni) girişsiz uçta verilmez; Lisans ve Sürüm ekranında görünür
        message: goc.durum === "hata" ? "Şema güncellemesi yapılamadı." : "Şema güncelleniyor.",
        data: { status: goc.durum === "hata" ? "migration_failed" : "migrating", timestamp: new Date().toISOString() },
      });
    }
    return ApiResponse.ok(res, ResponseMessages.HEALTH_CHECK_OK, {
      status: "healthy",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: env.NODE_ENV,
      version: "1.0.0",
    });
  };
}
