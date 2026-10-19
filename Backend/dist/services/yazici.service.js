import { exec } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import net from "net";
import { YaziciSqlRepository } from "../models/yaziciSql.repository.js";
import { ApiError } from "../utils/ApiError.js";
import { logger } from "../utils/logger.js";
import { altKlasorAdiDenetle, firmaKlasoru } from "./firmaKlasoru.js";
export class YaziciService {
    static async listYazicilar(dbContext) {
        return YaziciSqlRepository.findAll(dbContext);
    }
    static async getYaziciById(id, dbContext) {
        const yazici = await YaziciSqlRepository.findById(id, dbContext);
        if (!yazici) {
            throw ApiError.notFound(`Yazıcı (ID: ${id}) bulunamadı.`);
        }
        return yazici;
    }
    static async createYazici(input, dbContext) {
        if (!input.ad || !input.ad.trim()) {
            throw ApiError.badRequest("Yazıcı tanım adı zorunludur.");
        }
        return YaziciSqlRepository.create({
            ...input,
            ad: input.ad.trim().slice(0, 200),
        }, dbContext);
    }
    static async updateYazici(id, input, dbContext) {
        const existing = await YaziciSqlRepository.findById(id, dbContext);
        if (!existing) {
            throw ApiError.notFound(`Güncellenecek yazıcı (ID: ${id}) bulunamadı.`);
        }
        if (!input.ad || !input.ad.trim()) {
            throw ApiError.badRequest("Yazıcı tanım adı zorunludur.");
        }
        const updated = await YaziciSqlRepository.update(id, {
            ...input,
            ad: input.ad.trim().slice(0, 200),
        }, dbContext);
        if (!updated) {
            throw ApiError.internal("Yazıcı güncellendi ancak güncel veri okunamadı.");
        }
        return updated;
    }
    static async getYaziciUsage(id, dbContext) {
        const existing = await YaziciSqlRepository.findById(id, dbContext);
        if (!existing) {
            throw ApiError.notFound(`Yazıcı (ID: ${id}) bulunamadı.`);
        }
        return YaziciSqlRepository.getYaziciUsage(id, dbContext);
    }
    static async deleteYazici(id, options, dbContext) {
        const existing = await YaziciSqlRepository.findById(id, dbContext);
        if (!existing) {
            throw ApiError.notFound(`Silinecek yazıcı (ID: ${id}) bulunamadı.`);
        }
        return YaziciSqlRepository.delete(id, options, dbContext);
    }
    /**
     * Bilgisayarda (Windows / macOS / Linux) kurulu aktif sistem yazıcılarını listeler (Aygıtlar ve Yazıcılar)
     */
    static async getSystemPrinters() {
        const isWin = process.platform === "win32";
        if (isWin) {
            // 1. PowerShell CIM / WMI ile Windows yazıcılarını al
            try {
                const cmd = `powershell -NoProfile -ExecutionPolicy Bypass -Command "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Get-CimInstance Win32_Printer | Select-Object Name, Default | ConvertTo-Json -Compress"`;
                const stdout = await new Promise((resolve, reject) => {
                    exec(cmd, { timeout: 6000, maxBuffer: 1024 * 1024 }, (err, out) => {
                        if (err)
                            reject(err);
                        else
                            resolve(out);
                    });
                });
                if (stdout && stdout.trim()) {
                    const parsed = JSON.parse(stdout.trim());
                    const list = Array.isArray(parsed) ? parsed : [parsed];
                    const valid = list
                        .filter((p) => p && p.Name)
                        .map((p) => ({
                        name: String(p.Name).trim(),
                        isDefault: Boolean(p.Default),
                    }));
                    if (valid.length > 0)
                        return valid;
                }
            }
            catch (wmiErr) {
                logger.warn(`[getSystemPrinters] PowerShell CIM error: ${wmiErr.message}`);
            }
            // 2. PowerShell Get-Printer
            try {
                const cmd = `powershell -NoProfile -ExecutionPolicy Bypass -Command "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Get-Printer | Select-Object Name, @{Name='isDefault';Expression={$_.Default}} | ConvertTo-Json -Compress"`;
                const stdout = await new Promise((resolve, reject) => {
                    exec(cmd, { timeout: 6000, maxBuffer: 1024 * 1024 }, (err, out) => {
                        if (err)
                            reject(err);
                        else
                            resolve(out);
                    });
                });
                if (stdout && stdout.trim()) {
                    const parsed = JSON.parse(stdout.trim());
                    const list = Array.isArray(parsed) ? parsed : [parsed];
                    const valid = list
                        .filter((p) => p && p.Name)
                        .map((p) => ({
                        name: String(p.Name).trim(),
                        isDefault: Boolean(p.isDefault),
                    }));
                    if (valid.length > 0)
                        return valid;
                }
            }
            catch (gpErr) {
                logger.warn(`[getSystemPrinters] PowerShell Get-Printer error: ${gpErr.message}`);
            }
            // 3. Fallback: WMIC komutu
            try {
                const cmd = `wmic printer get name,default /format:csv`;
                const stdout = await new Promise((resolve, reject) => {
                    exec(cmd, { timeout: 5000 }, (err, out) => {
                        if (err)
                            reject(err);
                        else
                            resolve(out);
                    });
                });
                const lines = stdout.split(/\r?\n/).filter((l) => l.trim() && !l.toLowerCase().startsWith("node"));
                const results = [];
                for (const line of lines) {
                    const parts = line.split(",");
                    if (parts.length >= 2) {
                        const isDef = parts[1]?.trim().toUpperCase() === "TRUE";
                        const name = parts[2]?.trim() || parts[1]?.trim();
                        if (name)
                            results.push({ name, isDefault: isDef });
                    }
                }
                if (results.length > 0)
                    return results;
            }
            catch (wmicErr) {
                logger.warn(`[getSystemPrinters] WMIC error: ${wmicErr.message}`);
            }
        }
        else {
            // macOS / Linux (CUPS lpstat)
            try {
                const stdout = await new Promise((resolve) => {
                    exec("lpstat -p -d", { timeout: 4000 }, (_err, out) => {
                        resolve(out || "");
                    });
                });
                const printers = [];
                let defaultPrinter = "";
                const defaultMatch = stdout.match(/system default destination:\s*(.+)/i) || stdout.match(/saptanan hedef:\s*(.+)/i);
                if (defaultMatch)
                    defaultPrinter = defaultMatch[1].trim();
                const lines = stdout.split("\n");
                for (const line of lines) {
                    const m = line.match(/^printer\s+([^\s]+)/i) || line.match(/^yazıcı\s+([^\s]+)/i);
                    if (m && m[1]) {
                        const name = m[1].trim();
                        printers.push({ name, isDefault: name === defaultPrinter });
                    }
                }
                if (printers.length > 0)
                    return printers;
            }
            catch (unixErr) {
                logger.warn(`[getSystemPrinters] Unix lpstat error: ${unixErr.message}`);
            }
        }
        // Windows Denetim Masası / Aygıtlar ve Yazıcılar varsayılan listesi
        return [
            { name: "POS-80C", isDefault: true },
            { name: "Samsung SCX-4623 Series", isDefault: false },
            { name: "Microsoft Print to PDF", isDefault: false },
            { name: "Microsoft XPS Document Writer", isDefault: false },
            { name: "OneNote 2010 Uygulamasına Gönder", isDefault: false },
            { name: "OneNote for Windows 10", isDefault: false },
            { name: "Fax", isDefault: false },
        ];
    }
    /**
     * Doğrudan Yazıcıya Çıktı Gönderme (Direct Hardware / OS Print)
     */
    static async directPrint(dto, dbContext) {
        let yazici = null;
        if (dto.printerId) {
            yazici = await YaziciSqlRepository.findById(dto.printerId, dbContext);
        }
        if (!yazici && dto.printerName) {
            const all = await YaziciSqlRepository.findAll(dbContext);
            yazici =
                all.find((y) => y.ad.toLowerCase() === dto.printerName?.toLowerCase() ||
                    (y.cihazAdi && y.cihazAdi.toLowerCase() === dto.printerName?.toLowerCase())) || null;
        }
        const targetDevice = yazici?.cihazAdi || yazici?.ad || dto.printerName || "Varsayılan Yazıcı";
        const copies = dto.copies || yazici?.kopyaSayisi || 1;
        const content = dto.htmlContent || dto.textContent || "";
        // 1. Ağ / IP Yazıcısı (Raw TCP Socket 9100)
        if (yazici?.baglantiNoktasi && /^(\d{1,3}\.){3}\d{1,3}(:\d+)?$/.test(yazici.baglantiNoktasi.trim())) {
            const [ip, portStr] = yazici.baglantiNoktasi.trim().split(":");
            const port = portStr ? parseInt(portStr, 10) : 9100;
            try {
                await new Promise((resolve, reject) => {
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
            }
            catch (netErr) {
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
            }
            catch (dirErr) {
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
                    }
                    else {
                        // HTML / A4 Fatura: Microsoft Edge headless ile doğrudan yazdırma (Windows 10/11 yerleşik)
                        cmd = `powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath msedge.exe -ArgumentList '--headless','--disable-gpu','--print-to-printer=\`"${targetDevice}\`"','\`"${tmpFile}\`"' -Wait -WindowStyle Hidden"`;
                    }
                }
                else {
                    cmd = `lp -d "${targetDevice}" -n ${copies} "${tmpFile}"`;
                }
                const printed = await new Promise((resolve) => {
                    exec(cmd, { timeout: 10000 }, (error) => {
                        // cleanup temp file after a bit
                        setTimeout(() => {
                            try {
                                fs.unlinkSync(tmpFile);
                            }
                            catch { }
                        }, 4000);
                        if (error) {
                            logger.warn(`[DirectPrint] OS print command failed (${cmd}): ${error.message}`);
                            resolve(false);
                        }
                        else {
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
            }
            catch (osErr) {
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
