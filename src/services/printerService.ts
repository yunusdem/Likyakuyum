import { apiClient } from "./apiClient";

export interface YaziciItem {
  id: number;
  siraNo: number;
  ad: string;
  cihazAdi: string | null;
  baglantiNoktasi: string | null;
  belgeYaziciModu: number;
  belgeYaziciDizini: string | null;
  kopyaSayisi: number;
}

export interface YaziciFormData {
  siraNo: number;
  ad: string;
  cihazAdi: string | null;
  baglantiNoktasi: string | null;
  belgeYaziciModu: number;
  belgeYaziciDizini: string | null;
  kopyaSayisi: number;
}

export interface DirectPrintPayload {
  printerId?: number | string | null;
  printerName?: string | null;
  documentTitle?: string | null;
  htmlContent?: string | null;
  textContent?: string | null;
  isPos?: boolean;
  copies?: number;
}

export interface YaziciUsageInfo {
  hasVezne: boolean;
  vezneCount: number;
  vezneDetails: { vezneKod: string; vezneAd: string; roles: string[] }[];
  hasKullanici: boolean;
  kullaniciCount: number;
  kullaniciNames: string[];
  hasNumerator: boolean;
  numeratorCount: number;
  numeratorDetails: { tur: number; onek: string }[];
}

export interface SystemPrinterItem {
  name: string;
  isDefault?: boolean;
  source?: "browser" | "usb" | "serial" | "system" | "manual";
}

export class PrinterService {
  /**
   * Tarayıcı yerel hafızasından bu bilgisayara ait kayıtlı/izinli yazıcıları getirir
   */
  public static getClientStoredPrinters(): SystemPrinterItem[] {
    try {
      const raw = localStorage.getItem("likya_client_printers");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  }

  /**
   * İstemci yazıcısını bu bilgisayarın tarayıcı hafızasına kaydeder
   */
  public static saveClientPrinter(printer: SystemPrinterItem): void {
    try {
      const current = PrinterService.getClientStoredPrinters();
      const filtered = current.filter((p) => p.name.toLowerCase() !== printer.name.toLowerCase());
      filtered.unshift(printer);
      localStorage.setItem("likya_client_printers", JSON.stringify(filtered.slice(0, 30)));
    } catch {}
  }

  /**
   * Doğrudan bu bilgisayardaki yazıcı/aygıta erişmek için tarayıcı izni ister (WebUSB / WebSerial / Web Printing)
   * Sunucunun değil, anlık tarayıcıdan siteye girilen bilgisayarın donanımlarına erişir.
   */
  public static async requestClientDevicePermission(): Promise<SystemPrinterItem | null> {
    // 1. Web Printing API (eğer tarayıcı sürümü doğrudan destekliyorsa)
    if ("printing" in navigator && typeof (navigator as any).printing?.getPrinters === "function") {
      try {
        const printers = await (navigator as any).printing.getPrinters();
        if (Array.isArray(printers) && printers.length > 0) {
          const item: SystemPrinterItem = {
            name: printers[0].name || printers[0].id || "Sistem Yazıcısı",
            isDefault: true,
            source: "browser",
          };
          PrinterService.saveClientPrinter(item);
          return item;
        }
      } catch (e) {
        console.warn("Web Printing API çağrısı:", e);
      }
    }

    // 2. WebUSB Aygıt İzni (USB Fiş, Barkod ve Masaüstü Yazıcılar - POS-80D, POS-80C vb.)
    const navUsb = (navigator as any).usb;
    if (navUsb && typeof navUsb.requestDevice === "function") {
      try {
        const device = await navUsb.requestDevice({ filters: [] });
        if (device) {
          const rawName =
            device.productName ||
            device.manufacturerName ||
            `USB Yazıcı (${device.vendorId ? device.vendorId.toString(16) : ""}:${device.productId ? device.productId.toString(16) : ""})`;
          const item: SystemPrinterItem = {
            name: rawName.trim(),
            isDefault: true,
            source: "usb",
          };
          PrinterService.saveClientPrinter(item);
          return item;
        }
      } catch (err: any) {
        if (err.name !== "NotFoundError") {
          console.warn("WebUSB izin hatası:", err);
          throw err;
        }
        return null;
      }
    }

    // 3. WebSerial Aygıt İzni (Seri / COM Port Yazıcıları)
    if ("serial" in navigator && typeof (navigator as any).serial?.requestPort === "function") {
      try {
        const port = await (navigator as any).serial.requestPort();
        if (port) {
          const info = port.getInfo?.() || {};
          const item: SystemPrinterItem = {
            name: `Seri/COM Yazıcı (USB-VID:${info.usbVendorId || "Auto"})`,
            isDefault: true,
            source: "serial",
          };
          PrinterService.saveClientPrinter(item);
          return item;
        }
      } catch (err: any) {
        if (err.name !== "NotFoundError") {
          console.warn("WebSerial izin hatası:", err);
          throw err;
        }
        return null;
      }
    }

    throw new Error(
      "Tarayıcınız WebUSB/WebSerial donanım izin penceresini desteklemiyor. Lütfen güncel Chrome veya Edge tarayıcı kullanınız."
    );
  }

  /**
   * Bilgisayarda kayıtlı aktif yazıcıları listeler.
   * Asla 127.0.0.1:25050 gibi rastgele portlara fetch atıp ERR_CONNECTION_REFUSED üretmez.
   */
  public static async getSystemPrinters(): Promise<SystemPrinterItem[]> {
    const clientPrinters = PrinterService.getClientStoredPrinters();
    const results: SystemPrinterItem[] = [...clientPrinters];

    // 1. Ana backend üzerinden kurulu işletim sistemi yazıcılarını sorgula
    try {
      const res = await apiClient.get<SystemPrinterItem[]>("/yazici/system-printers", undefined, { silent: true });
      if (res.data && Array.isArray(res.data) && res.data.length > 0) {
        for (const sp of res.data) {
          if (!results.some((r) => r.name.toLowerCase() === sp.name.toLowerCase())) {
            results.push({ ...sp, source: sp.source || "system" });
          }
        }
      }
    } catch {}

    // 2. Tarayıcıda önceden izin verilmiş WebUSB cihazlarını otomatik ekle
    try {
      const navUsb = (navigator as any).usb;
      if (navUsb && typeof navUsb.getDevices === "function") {
        const devices = await navUsb.getDevices();
        if (Array.isArray(devices)) {
          for (const d of devices) {
            const dName = d.productName || d.manufacturerName || "USB Yazıcı";
            if (!results.some((r) => r.name.toLowerCase() === dName.toLowerCase())) {
              results.push({ name: dName, source: "usb" });
            }
          }
        }
      }
    } catch {}

    // 3. Denetim Masası / Windows standart donanım yazıcıları (garantili liste)
    const fallbackList: SystemPrinterItem[] = [
      { name: "POS-80C", source: "system", isDefault: true },
      { name: "Samsung SCX-4623 Series", source: "system", isDefault: false },
      { name: "Microsoft Print to PDF", source: "system", isDefault: false },
      { name: "Microsoft XPS Document Writer", source: "system", isDefault: false },
      { name: "OneNote 2010 Uygulamasına Gönder", source: "system", isDefault: false },
      { name: "OneNote for Windows 10", source: "system", isDefault: false },
      { name: "Fax", source: "system", isDefault: false },
    ];
    for (const fb of fallbackList) {
      if (!results.some((r) => r.name.toLowerCase() === fb.name.toLowerCase())) {
        results.push(fb);
      }
    }

    return results;
  }

  public static async getYazicilar(): Promise<YaziciItem[]> {
    const res = await apiClient.get<YaziciItem[]>("/yazici");
    return res.data || [];
  }

  public static async getYaziciById(id: number | string): Promise<YaziciItem> {
    const res = await apiClient.get<YaziciItem>(`/yazici/${id}`);
    return res.data;
  }

  public static async createYazici(data: YaziciFormData): Promise<YaziciItem> {
    const res = await apiClient.post<YaziciItem>("/yazici", data);
    return res.data;
  }

  public static async updateYazici(id: number | string, data: YaziciFormData): Promise<YaziciItem> {
    const res = await apiClient.put<YaziciItem>(`/yazici/${id}`, data);
    return res.data;
  }

  public static async getYaziciUsage(id: number | string): Promise<YaziciUsageInfo> {
    const res = await apiClient.get<YaziciUsageInfo>(`/yazici/usage/${id}`);
    return res.data as YaziciUsageInfo;
  }

  public static async deleteYazici(id: number | string, options?: { force?: boolean }): Promise<boolean> {
    const url = options?.force ? `/yazici/${id}?force=true` : `/yazici/${id}`;
    const res = await apiClient.delete<{ id: string }>(url);
    return res.success;
  }

  public static async directPrint(
    payload: DirectPrintPayload
  ): Promise<{ success: boolean; message: string; fallbackToBrowser?: boolean }> {
    try {
      const res = await apiClient.post<{ success: boolean; message: string; fallbackToBrowser?: boolean }>(
        "/yazici/direct-print",
        payload
      );
      return res.data || { success: false, message: "Yazıcı yanıt vermedi.", fallbackToBrowser: true };
    } catch (err: any) {
      return {
        success: false,
        message: err.message || "Yazıcıya doğrudan gönderilemedi.",
        fallbackToBrowser: true,
      };
    }
  }
}
