import { exec } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import net from "net";
import { YaziciSqlRepository, YaziciModel, YaziciInputDto } from "../models/yaziciSql.repository.js";
import { ApiError } from "../utils/ApiError.js";
import { logger } from "../utils/logger.js";
import { altKlasorAdiDenetle, firmaKlasoru } from "./firmaKlasoru.js";

export interface DirectPrintDto {
  printerId?: number | string | null;
  printerName?: string | null;
  documentTitle?: string | null;
  htmlContent?: string | null;
  textContent?: string | null;
  isPos?: boolean;
  copies?: number;
}

export interface ClientPrinterInfo {
  name: string;
  isDefault?: boolean;
  isOnline?: boolean;
  isNetwork?: boolean;
  isLocal?: boolean;
  portName?: string;
  driverName?: string;
}

export interface WorkstationPrintersRecord {
  computerName?: string;
  userName?: string;
  clientIp: string;
  userId?: number | string;
  updatedAt: Date;
  printers: ClientPrinterInfo[];
}

const workstationPrintersMap = new Map<string, WorkstationPrintersRecord>();

export class YaziciService {
  public static registerClientPrinters(params: {
    clientIp: string;
    computerName?: string;
    userName?: string;
    userId?: number | string;
    printers: ClientPrinterInfo[];
  }) {
    const record: WorkstationPrintersRecord = {
      clientIp: params.clientIp,
      computerName: params.computerName,
      userName: params.userName,
      userId: params.userId,
      updatedAt: new Date(),
      printers: params.printers || [],
    };
    if (params.clientIp) workstationPrintersMap.set(params.clientIp, record);
    if (params.computerName) workstationPrintersMap.set(params.computerName.toUpperCase().trim(), record);
    if (params.userId) workstationPrintersMap.set(`user_${params.userId}`, record);
    logger.info(`[registerClientPrinters] Workstation ${params.computerName || params.clientIp} registered ${params.printers?.length || 0} printers.`);
    return { success: true, count: params.printers?.length || 0 };
  }

  public static getClientPrinters(params: {
    clientIp?: string;
    computerName?: string;
    userId?: number | string;
  }): ClientPrinterInfo[] {
    if (params.computerName && workstationPrintersMap.has(params.computerName.toUpperCase().trim())) {
      return workstationPrintersMap.get(params.computerName.toUpperCase().trim())!.printers;
    }
    if (params.userId && workstationPrintersMap.has(`user_${params.userId}`)) {
      return workstationPrintersMap.get(`user_${params.userId}`)!.printers;
    }
    if (params.clientIp && workstationPrintersMap.has(params.clientIp)) {
      return workstationPrintersMap.get(params.clientIp)!.printers;
    }
    // Also try without port if IP has port
    const strippedIp = params.clientIp?.replace(/:\d+$/, "");
    if (strippedIp && workstationPrintersMap.has(strippedIp)) {
      return workstationPrintersMap.get(strippedIp)!.printers;
    }
    return [];
  }
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

  public static async getYaziciUsage(
    id: number | string,
    dbContext?: { dbServer?: string; dbName?: string }
  ) {
    const existing = await YaziciSqlRepository.findById(id, dbContext);
    if (!existing) {
      throw ApiError.notFound(`Yazıcı (ID: ${id}) bulunamadı.`);
    }

    return YaziciSqlRepository.getYaziciUsage(id, dbContext);
  }

  public static async deleteYazici(
    id: number | string,
    options?: { force?: boolean },
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<boolean> {
    const existing = await YaziciSqlRepository.findById(id, dbContext);
    if (!existing) {
      throw ApiError.notFound(`Silinecek yazıcı (ID: ${id}) bulunamadı.`);
    }

    return YaziciSqlRepository.delete(id, options, dbContext);
  }

  /**
   * Bilgisayarda (Windows / macOS / Linux) kurulu aktif sistem yazıcılarını listeler (Aygıtlar ve Yazıcılar)
   */
  public static async getSystemPrinters(): Promise<{ name: string; isDefault?: boolean }[]> {
    const isWin = process.platform === "win32";

    if (isWin) {
      // 1. PowerShell CIM / WMI ile Windows yazıcılarını al
      try {
        const cmd = `powershell -NoProfile -ExecutionPolicy Bypass -Command "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Get-CimInstance Win32_Printer | Select-Object Name, Default | ConvertTo-Json -Compress"`;
        const stdout = await new Promise<string>((resolve, reject) => {
          exec(cmd, { timeout: 6000, maxBuffer: 1024 * 1024 }, (err, out) => {
            if (err) reject(err);
            else resolve(out);
          });
        });

        if (stdout && stdout.trim()) {
          const parsed = JSON.parse(stdout.trim());
          const list = Array.isArray(parsed) ? parsed : [parsed];
          const valid = list
            .filter((p: any) => p && p.Name)
            .map((p: any) => ({
              name: String(p.Name).trim(),
              isDefault: Boolean(p.Default),
            }));
          if (valid.length > 0) return valid;
        }
      } catch (wmiErr: any) {
        logger.warn(`[getSystemPrinters] PowerShell CIM error: ${wmiErr.message}`);
      }

      // 2. PowerShell Get-Printer
      try {
        const cmd = `powershell -NoProfile -ExecutionPolicy Bypass -Command "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Get-Printer | Select-Object Name, @{Name='isDefault';Expression={$_.Default}} | ConvertTo-Json -Compress"`;
        const stdout = await new Promise<string>((resolve, reject) => {
          exec(cmd, { timeout: 6000, maxBuffer: 1024 * 1024 }, (err, out) => {
            if (err) reject(err);
            else resolve(out);
          });
        });

        if (stdout && stdout.trim()) {
          const parsed = JSON.parse(stdout.trim());
          const list = Array.isArray(parsed) ? parsed : [parsed];
          const valid = list
            .filter((p: any) => p && p.Name)
            .map((p: any) => ({
              name: String(p.Name).trim(),
              isDefault: Boolean(p.isDefault),
            }));
          if (valid.length > 0) return valid;
        }
      } catch (gpErr: any) {
        logger.warn(`[getSystemPrinters] PowerShell Get-Printer error: ${gpErr.message}`);
      }

      // 3. Fallback: WMIC komutu
      try {
        const cmd = `wmic printer get name,default /format:csv`;
        const stdout = await new Promise<string>((resolve, reject) => {
          exec(cmd, { timeout: 5000 }, (err, out) => {
            if (err) reject(err);
            else resolve(out);
          });
        });

        const lines = stdout.split(/\r?\n/).filter((l) => l.trim() && !l.toLowerCase().startsWith("node"));
        const results: { name: string; isDefault?: boolean }[] = [];
        for (const line of lines) {
          const parts = line.split(",");
          if (parts.length >= 2) {
            const isDef = parts[1]?.trim().toUpperCase() === "TRUE";
            const name = parts[2]?.trim() || parts[1]?.trim();
            if (name) results.push({ name, isDefault: isDef });
          }
        }
        if (results.length > 0) return results;
      } catch (wmicErr: any) {
        logger.warn(`[getSystemPrinters] WMIC error: ${wmicErr.message}`);
      }
    } else {
      // macOS / Linux (CUPS lpstat)
      try {
        const stdout = await new Promise<string>((resolve) => {
          exec("lpstat -p -d", { timeout: 4000 }, (_err, out) => {
            resolve(out || "");
          });
        });

        const printers: { name: string; isDefault?: boolean }[] = [];
        let defaultPrinter = "";
        const defaultMatch = stdout.match(/system default destination:\s*(.+)/i) || stdout.match(/saptanan hedef:\s*(.+)/i);
        if (defaultMatch) defaultPrinter = defaultMatch[1].trim();

        const lines = stdout.split("\n");
        for (const line of lines) {
          const m = line.match(/^printer\s+([^\s]+)/i) || line.match(/^yazıcı\s+([^\s]+)/i);
          if (m && m[1]) {
            const name = m[1].trim();
            printers.push({ name, isDefault: name === defaultPrinter });
          }
        }
        if (printers.length > 0) return printers;
      } catch (unixErr: any) {
        logger.warn(`[getSystemPrinters] Unix lpstat error: ${unixErr.message}`);
      }
    }

    return [];
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

    // 2. Klasöre / Arşive Yazdırma (belgeYaziciDizini): çıktı firmanın klasörüne, `Yazdirma\[alt klasör]` altına
    //    yazılır; tanımdaki değer yalnızca alt klasör adıdır (docs/FIRMA_OZEL_AYARLAR_YOL_HARITASI.md, K7–K8).
    if (yazici?.belgeYaziciDizini && yazici.belgeYaziciDizini.trim()) {
      try {
        const alt = altKlasorAdiDenetle(yazici.belgeYaziciDizini).ad;
        const outDir = await firmaKlasoru(dbContext, "Yazdirma", ...(alt ? [alt] : []));
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
        const isPos = Boolean(dto.isPos);
        const ext = isPos ? "txt" : "html";
        const tmpFile = path.join(os.tmpdir(), `likya_print_${Date.now()}.${ext}`);
        fs.writeFileSync(tmpFile, content, "utf8");

        const isWin = process.platform === "win32";
        let cmd = "";

        if (isWin) {
          if (isPos) {
            // Termal / Metin Fiş: PowerShell Out-Printer ile doğrudan sürücüye ilet
            cmd = `powershell -NoProfile -ExecutionPolicy Bypass -Command "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Get-Content -Raw -Encoding UTF8 '${tmpFile}' | Out-Printer -Name '${targetDevice}'"`;
          } else {
            // HTML / A4 Fatura: Microsoft Edge headless ile doğrudan yazdırma (Windows 10/11 yerleşik)
            cmd = `powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath msedge.exe -ArgumentList '--headless','--disable-gpu','--print-to-printer=\`"${targetDevice}\`"','\`"${tmpFile}\`"' -Wait -WindowStyle Hidden"`;
          }
        } else {
          cmd = `lp -d "${targetDevice}" -n ${copies} "${tmpFile}"`;
        }

        const printed = await new Promise<boolean>((resolve) => {
          exec(cmd, { timeout: 10000 }, (error) => {
            // cleanup temp file after a bit
            setTimeout(() => {
              try { fs.unlinkSync(tmpFile); } catch {}
            }, 4000);

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
