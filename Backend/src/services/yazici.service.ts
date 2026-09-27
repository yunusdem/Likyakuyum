import { exec } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import net from "net";
import { YaziciSqlRepository, YaziciModel, YaziciInputDto } from "../models/yaziciSql.repository.js";
import { ApiError } from "../utils/ApiError.js";
import { logger } from "../utils/logger.js";

export interface DirectPrintDto {
  printerId?: number | string | null;
  printerName?: string | null;
  documentTitle?: string | null;
  htmlContent?: string | null;
  textContent?: string | null;
  isPos?: boolean;
  copies?: number;
}

export class YaziciService {
  public static async listYazicilar(
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<YaziciModel[]> {
    return YaziciSqlRepository.findAll(dbContext);
  }

  public static async getYaziciById(
    id: number | string,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<YaziciModel> {
    const yazici = await YaziciSqlRepository.findById(id, dbContext);
    if (!yazici) {
      throw ApiError.notFound(`Yazıcı (ID: ${id}) bulunamadı.`);
    }
    return yazici;
  }

  public static async createYazici(
    input: YaziciInputDto,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<YaziciModel> {
    if (!input.ad || !input.ad.trim()) {
      throw ApiError.badRequest("Yazıcı tanım adı zorunludur.");
    }

    return YaziciSqlRepository.create(
      {
        ...input,
        ad: input.ad.trim().slice(0, 200),
      },
      dbContext
    );
  }

  public static async updateYazici(
    id: number | string,
    input: YaziciInputDto,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<YaziciModel> {
    const existing = await YaziciSqlRepository.findById(id, dbContext);
    if (!existing) {
      throw ApiError.notFound(`Güncellenecek yazıcı (ID: ${id}) bulunamadı.`);
    }

    if (!input.ad || !input.ad.trim()) {
      throw ApiError.badRequest("Yazıcı tanım adı zorunludur.");
    }

    const updated = await YaziciSqlRepository.update(
      id,
      {
        ...input,
        ad: input.ad.trim().slice(0, 200),
      },
      dbContext
    );

    if (!updated) {
      throw ApiError.internal("Yazıcı güncellendi ancak güncel veri okunamadı.");
    }

    return updated;
  }

  public static async deleteYazici(
    id: number | string,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<boolean> {
    const existing = await YaziciSqlRepository.findById(id, dbContext);
    if (!existing) {
      throw ApiError.notFound(`Silinecek yazıcı (ID: ${id}) bulunamadı.`);
    }

    return YaziciSqlRepository.delete(id, dbContext);
  }

  /**
   * Doğrudan Yazıcıya Çıktı Gönderme (Direct Hardware / OS Print)
   */
  public static async directPrint(
    dto: DirectPrintDto,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<{ success: boolean; message: string; fallbackToBrowser?: boolean }> {
    let yazici: YaziciModel | null = null;

    if (dto.printerId) {
      yazici = await YaziciSqlRepository.findById(dto.printerId, dbContext);
    }

    if (!yazici && dto.printerName) {
      const all = await YaziciSqlRepository.findAll(dbContext);
      yazici =
        all.find(
          (y) =>
            y.ad.toLowerCase() === dto.printerName?.toLowerCase() ||
            (y.cihazAdi && y.cihazAdi.toLowerCase() === dto.printerName?.toLowerCase())
        ) || null;
    }

    const targetDevice = yazici?.cihazAdi || yazici?.ad || dto.printerName || "Varsayılan Yazıcı";
    const copies = dto.copies || yazici?.kopyaSayisi || 1;
    const content = dto.htmlContent || dto.textContent || "";

    // 1. Ağ / IP Yazıcısı (Raw TCP Socket 9100)
    if (yazici?.baglantiNoktasi && /^(\d{1,3}\.){3}\d{1,3}(:\d+)?$/.test(yazici.baglantiNoktasi.trim())) {
      const [ip, portStr] = yazici.baglantiNoktasi.trim().split(":");
      const port = portStr ? parseInt(portStr, 10) : 9100;

      try {
        await new Promise<void>((resolve, reject) => {
          const socket = new net.Socket();
          socket.setTimeout(4000);
          socket.connect(port, ip, () => {
            socket.write(content, () => {
              socket.end();
              resolve();
            });
          });
          socket.on("error", reject);
          socket.on("timeout", () => {
            socket.destroy();
            reject(new Error(`Ağ yazıcısına (${ip}:${port}) bağlantı zaman aşımına uğradı.`));
          });
        });

        logger.info(`[DirectPrint] Ağ yazıcısına başarıyla gönderildi: ${ip}:${port}`);
        return {
          success: true,
          message: `Ağ yazıcısına (${ip}) doğrudan gönderildi.`,
        };
      } catch (netErr: any) {
        logger.warn(`[DirectPrint] IP yazıcı hatası: ${netErr.message}`);
      }
    }

    // 2. Klasöre / Arşive Yazdırma (belgeYaziciDizini)
    if (yazici?.belgeYaziciDizini && yazici.belgeYaziciDizini.trim()) {
      try {
        const outDir = yazici.belgeYaziciDizini.trim();
        if (!fs.existsSync(outDir)) {
          fs.mkdirSync(outDir, { recursive: true });
        }
        const fileName = `fis_${Date.now()}.${dto.isPos ? "txt" : "html"}`;
        const filePath = path.join(outDir, fileName);
        fs.writeFileSync(filePath, content, "utf8");
        logger.info(`[DirectPrint] Dosyaya yazdırıldı: ${filePath}`);
        return {
          success: true,
          message: `Çıktı "${filePath}" konumuna kaydedildi.`,
        };
      } catch (dirErr: any) {
        logger.warn(`[DirectPrint] Klasöre yazdırma hatası: ${dirErr.message}`);
      }
    }

    // 3. İşletim Sistemi Spooler Yazdırması (CUPS / lp on macOS/Linux or PowerShell on Windows)
    if (targetDevice && targetDevice !== "Varsayılan Yazıcı") {
      try {
        const tmpFile = path.join(os.tmpdir(), `likya_print_${Date.now()}.${dto.isPos ? "txt" : "html"}`);
        fs.writeFileSync(tmpFile, content, "utf8");

        const isWin = process.platform === "win32";
        let cmd = "";

        if (isWin) {
          cmd = `powershell -NoProfile -Command "Start-Process -FilePath '${tmpFile}' -Verb PrintTo -ArgumentList '${targetDevice}'"`;
        } else {
          cmd = `lp -d "${targetDevice}" -n ${copies} "${tmpFile}"`;
        }

        const printed = await new Promise<boolean>((resolve) => {
          exec(cmd, { timeout: 5000 }, (error) => {
            // cleanup temp file after a bit
            setTimeout(() => {
              try { fs.unlinkSync(tmpFile); } catch {}
            }, 3000);

            if (error) {
              logger.warn(`[DirectPrint] OS print command failed (${cmd}): ${error.message}`);
              resolve(false);
            } else {
              logger.info(`[DirectPrint] OS print command succeeded: ${cmd}`);
              resolve(true);
            }
          });
        });

        if (printed) {
          return {
            success: true,
            message: `"${targetDevice}" yazıcısına doğrudan gönderildi.`,
          };
        }
      } catch (osErr: any) {
        logger.warn(`[DirectPrint] OS print error: ${osErr.message}`);
      }
    }

    // Fallback: Tarayıcı yazdırma motoru tetiklenecek
    return {
      success: false,
      fallbackToBrowser: true,
      message: `"${targetDevice}" için tarayıcı yazdırma motoruna yönlendirildi.`,
    };
  }
}
