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
  isOnline?: boolean;
  source?: "local_agent" | "user_assigned" | "browser" | "usb" | "serial" | "system" | "manual" | "server";
  details?: string;
}

export class PrinterService {
  /**
   * Tarayıcı yerel hafızasından bu kullanıcıya ve bilgisayara ait kayıtlı yazıcıları getirir
   */
  public static getClientStoredPrinters(userId?: string | number): SystemPrinterItem[] {
    const list: SystemPrinterItem[] = [];
    try {
      if (userId) {
        const userRaw = localStorage.getItem(`likya_user_printers_${userId}`);
        if (userRaw) {
          const parsed = JSON.parse(userRaw);
          if (Array.isArray(parsed)) list.push(...parsed);
        }
      }
      const raw = localStorage.getItem("likya_client_printers");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            if (!list.some((p) => p.name.toLowerCase() === item.name.toLowerCase())) {
              list.push(item);
            }
          }
        }
      }
    } catch {}
    return list;
  }

  /**
   * İstemci yazıcısını bu bilgisayarın ve kullanıcının tarayıcı hafızasına kaydeder
   */
  public static saveClientPrinter(printer: SystemPrinterItem, userId?: string | number): void {
    try {
      const current = PrinterService.getClientStoredPrinters(userId);
      const filtered = current.filter((p) => p.name.toLowerCase() !== printer.name.toLowerCase());
      filtered.unshift(printer);
      const toSave = filtered.slice(0, 30);
      localStorage.setItem("likya_client_printers", JSON.stringify(toSave));
      if (userId) {
        localStorage.setItem(`likya_user_printers_${userId}`, JSON.stringify(toSave));
      }
    } catch {}
  }

  /**
   * Doğrudan bu bilgisayardaki yazıcı/aygıta erişmek için tarayıcı izni ister (WebUSB / WebSerial / Web Printing)
   * Sunucunun değil, anlık tarayıcıdan siteye girilen bilgisayarın donanımlarına erişir.
   */
  public static async requestClientDevicePermission(userId?: string | number): Promise<SystemPrinterItem | null> {
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
          PrinterService.saveClientPrinter(item, userId);
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
          PrinterService.saveClientPrinter(item, userId);
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
          PrinterService.saveClientPrinter(item, userId);
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
   * Yalnızca gerçek ve canlı yazıcıları listeler (Statik/sahte veri içermez):
   * 1. Bu bilgisayardaki Yerel Yazıcı Servisi (http://127.0.0.1:5050/printers) - Windows Denetim Masası
   * 2. Bu bilgisayardaki Local Agent (http://127.0.0.1:25050/api/v1/yazici/system-printers)
   * 3. Sunucuda kayıtlı yazıcılar (TODVZ_YAZICI Veritabanı ve Giriş Yapan Kullanıcının Yazıcısı)
   * 4. Doğrudan bağlı WebUSB aygıtları
   * 5. Sunucu işletim sisteminde kurulu yazıcılar
   */
  public static async getSystemPrinters(
    currentUser?: { id?: number | string; fullName?: string; name?: string; username?: string; printerId?: string | number } | null
  ): Promise<SystemPrinterItem[]> {
    const results: SystemPrinterItem[] = [];

    // 1. Bu bilgisayarda çalışan Yerel Sessiz Yazıcı Servisini (localhost:5050) sorgula
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1200);
      const res = await fetch("http://127.0.0.1:5050/printers", {
        method: "GET",
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.printers) && data.printers.length > 0) {
          for (const p of data.printers) {
            const pName = String(p.name || "").trim();
            if (pName && !results.some((r) => r.name.toLowerCase() === pName.toLowerCase())) {
              results.push({
                name: pName,
                isDefault: Boolean(p.isDefault),
                isOnline: p.isOnline !== false,
                source: "local_agent",
                details: "Bu Bilgisayarın Denetim Masası Yazıcısı",
              });
            }
          }
        }
      }
    } catch {}

    // 2. Her bilgisayarda harici servis gerektirmeden çalışan standart tarayıcı yazdırma seçeneği
    results.push({
      name: "Tarayıcı / Windows Varsayılan Yazıcısı",
      isDefault: results.length === 0,
      source: "browser",
      details: "Bu bilgisayarın doğrudan varsayılan yazıcısı (Servis gerektirmez)",
    });

    // 3. Sunucuda kayıtlı yazıcılar (TODVZ_YAZICI Veritabanı ve Kullanıcı Tanımları)
    try {
      const allYazicilar = await PrinterService.getYazicilar().catch(() => []);
      const userPrinterTarget = currentUser?.printerId ? String(currentUser.printerId).trim() : null;

      for (const y of allYazicilar) {
        const printerName = String(y.cihazAdi || y.ad || "").trim();
        if (!printerName) continue;

        const isUserAssigned =
          userPrinterTarget && (String(y.id) === userPrinterTarget || String(y.siraNo) === userPrinterTarget);
        const existing = results.find((r) => r.name.toLowerCase() === printerName.toLowerCase());

        if (existing) {
          if (isUserAssigned) {
            existing.isDefault = true;
            existing.source = "user_assigned";
            existing.details = `Giriş Yapan Kullanıcının Yazıcısı (${currentUser?.fullName || currentUser?.username || "Kullanıcı"})`;
          }
        } else {
          results.push({
            name: printerName,
            isDefault: Boolean(isUserAssigned),
            source: isUserAssigned ? "user_assigned" : "server",
            details: isUserAssigned
              ? `Giriş Yapan Kullanıcının Yazıcısı (${currentUser?.fullName || currentUser?.username || "Kullanıcı"})`
              : `Sunucuda Kayıtlı: [${y.siraNo}] ${y.ad}`,
          });
        }
      }
    } catch {}

    // 4. Tarayıcıda önceden izin verilmiş fiziksel WebUSB cihazlarını ekle
    try {
      const navUsb = (navigator as any).usb;
      if (navUsb && typeof navUsb.getDevices === "function") {
        const devices = await navUsb.getDevices();
        if (Array.isArray(devices)) {
          for (const d of devices) {
            const dName = d.productName || d.manufacturerName || "USB Yazıcı";
            if (!results.some((r) => r.name.toLowerCase() === dName.toLowerCase())) {
              results.push({ name: dName, source: "usb", details: "Bağlı USB Cihaz" });
            }
          }
        }
      }
    } catch {}

    // Sıralama önceliği: Bu bilgisayarın yerel yazıcıları -> Tarayıcı -> Kullanıcı -> Sunucu
    results.sort((a, b) => {
      const score = (s?: string) => {
        if (s === "local_agent") return 1;
        if (s === "browser") return 2;
        if (s === "user_assigned") return 3;
        if (s === "usb") return 4;
        return 5;
      };
      return score(a.source) - score(b.source);
    });

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

  /**
   * Doğrudan Yazdırma:
   * 1. Öncelikle kullanıcının bilgisayarındaki Yerel Sessiz Yazıcı Servisine (localhost:5050/print) gönderir.
   *    Bu sayede kullanıcının yerel Windows yazıcısından önizleme penceresi açılmadan anında sessizce çıkar.
   * 2. Yerel servis çalışmıyorsa backend sunucusuna (/yazici/direct-print) iletir.
   * 3. İkisi de yoksa tarayıcının standart yazdırma motorunu yedek olarak devreye sokar.
   */
  public static async directPrint(
    payload: DirectPrintPayload
  ): Promise<{ success: boolean; message: string; fallbackToBrowser?: boolean }> {
    // 1. Kullanıcının bilgisayarındaki Yerel Servise (Port 5050) doğrudan POST et
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      const localRes = await fetch("http://127.0.0.1:5050/print", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          html: payload.htmlContent,
          text: payload.textContent,
          printerName: payload.printerName,
          copies: payload.copies || 1,
          title: payload.documentTitle || "Likya_Fis",
          isPos: payload.isPos ?? true,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (localRes.ok) {
        const localData = await localRes.json();
        return {
          success: true,
          message: localData.message || "Fiş kullanıcının yerel yazıcısına doğrudan iletildi.",
          fallbackToBrowser: false,
        };
      }
    } catch {}

    // 2. Ana sunucu doğrudan yazdırma endpoint'i
    try {
      const res = await apiClient.post<{ success: boolean; message: string; fallbackToBrowser?: boolean }>(
        "/yazici/direct-print",
        payload
      );
      if (res.data && res.data.success) {
        return res.data;
      }
    } catch (err: any) {
      console.warn("[PrinterService] Sunucu doğrudan yazdırma yanıt vermedi:", err);
    }

    return {
      success: false,
      message: "Yerel yazıcı servisi bulunamadı, tarayıcı yazdırma moduna aktarılıyor.",
      fallbackToBrowser: true,
    };
  }
}
