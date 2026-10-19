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
  /**
   * Doğrudan Chromium / Web Printing API üzerinden istemci bilgisayara bağlı
   * yerel yazıcıları ek bir yazılım (.bat vb.) kurmadan tarar.
   */
  public static async fetchLocalPrinters(): Promise<string[]> {
    try {
      // 1. Yol: queryLocalPrinters API (Chromium / Chrome / Edge)
      if (typeof (window as any).queryLocalPrinters === "function") {
        const printers = await (window as any).queryLocalPrinters();
        return (printers || []).map((p: any) => p.name || p).filter(Boolean);
      }

      // 2. Yol: navigator.printers API
      if ("printers" in navigator && typeof (navigator as any).printers?.queryPrinters === "function") {
        const printers = await (navigator as any).printers.queryPrinters();
        return (printers || []).map((p: any) => p.name || p).filter(Boolean);
      }

      // 3. Yol: navigator.printing API
      if ("printing" in navigator && typeof (navigator as any).printing?.getPrinters === "function") {
        const printers = await (navigator as any).printing.getPrinters();
        return (printers || []).map((p: any) => p.name || p.id || p).filter(Boolean);
      }

      return [];
    } catch (error: any) {
      console.error("Yazıcı tarama hatası:", error);
      throw new Error("Yazıcı listesine erişim izni verilmedi veya desteklenmiyor.");
    }
  }

  /**
   * Bilgisayara bağlı yerel yazıcıları listeler:
   * 1. Doğrudan Tarayıcı Web Printing API (queryLocalPrinters / navigator.printers) - Sıfır yazılım / .bat gerektirmez
   * 2. Tarayıcı WebUSB / WebSerial doğrudan bağlı aygıtlar
   * 3. İstemci hafızası (localStorage) ve bulut senkronizasyonu
   */
  public static async getSystemPrinters(
    currentUser?: { id?: number | string; fullName?: string; name?: string; username?: string; printerId?: string | number } | null
  ): Promise<SystemPrinterItem[]> {
    const results: SystemPrinterItem[] = [];

    // 1. Doğrudan Tarayıcı Web Printing API ile tara (.bat veya harici kurulum OLMADAN)
    try {
      const browserPrinters = await PrinterService.fetchLocalPrinters();
      if (Array.isArray(browserPrinters) && browserPrinters.length > 0) {
        for (const p of browserPrinters) {
          const pName = String(p || "").trim();
          if (pName && !results.some((r) => r.name.toLowerCase() === pName.toLowerCase())) {
            const item: SystemPrinterItem = {
              name: pName,
              isDefault: results.length === 0,
              isOnline: true,
              source: "browser",
              details: "Windows / Denetim Masası Yazıcısı (Tarayıcı API)",
            };
            results.push(item);
            PrinterService.saveClientPrinter(item, currentUser?.id);
          }
        }
      }
    } catch (err: any) {
      console.warn("Tarayıcı Web Printing tarama:", err?.message || err);
    }

    // 2. Bu bilgisayara önceden izin verilmiş yerel yazıcılar (LocalStorage önbelleği)
    try {
      const clientStored = PrinterService.getClientStoredPrinters(currentUser?.id);
      for (const cs of clientStored) {
        if (!results.some((r) => r.name.toLowerCase() === cs.name.toLowerCase())) {
          results.push(cs);
        }
      }
    } catch {}

    // 3. Bulut sunucusuna bu bilgisayar/kullanıcı tarafından iletilmiş yazıcılar
    try {
      const storedComp = typeof localStorage !== "undefined" ? localStorage.getItem("likya_workstation_comp") : null;
      const queryParam = storedComp ? `?computerName=${encodeURIComponent(storedComp)}` : "";
      const clientRes = await apiClient.get<any[]>("/yazici/client-printers" + queryParam, undefined, { silent: true });
      const clientList = Array.isArray(clientRes.data) ? clientRes.data : [];
      for (const cp of clientList) {
        const cpName = String(cp.name || "").trim();
        if (cpName && !results.some((r) => r.name.toLowerCase() === cpName.toLowerCase())) {
          const item: SystemPrinterItem = {
            name: cpName,
            isDefault: Boolean(cp.isDefault),
            isOnline: cp.isOnline !== false,
            source: "local_agent",
            details: `Denetim Masası Yazıcısı${cp.portName ? ` (${cp.portName})` : ""}`,
          };
          results.push(item);
          PrinterService.saveClientPrinter(item, currentUser?.id);
        }
      }
    } catch {}

    // 4. Doğrudan bağlı WebUSB / Termal Fiş aygıtları
    try {
      const navUsb = (navigator as any).usb;
      if (navUsb && typeof navUsb.getDevices === "function") {
        const devices = await navUsb.getDevices();
        if (Array.isArray(devices)) {
          for (const d of devices) {
            const dName = d.productName || d.manufacturerName || "USB Fiş Yazıcısı";
            if (!results.some((r) => r.name.toLowerCase() === dName.toLowerCase())) {
              results.push({
                name: dName,
                isDefault: results.length === 0,
                source: "usb",
                details: "Doğrudan Bağlı USB Fiş / Barkod Cihazı",
              });
            }
          }
        }
      }
    } catch {}

    // 5. Yerel servis çalışıyorsa (127.0.0.1:5050) sorgula (hatasız / sessiz)
    if (results.length === 0) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 600);
        const res = await fetch("http://127.0.0.1:5050/printers", {
          method: "GET",
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (res.ok) {
          const data = await res.json();
          const list = Array.isArray(data) ? data : (Array.isArray(data.printers) ? data.printers : []);
          for (const p of list) {
            const pName = String(p.name || p.ad || "").trim();
            if (pName && !results.some((r) => r.name.toLowerCase() === pName.toLowerCase())) {
              const item: SystemPrinterItem = {
                name: pName,
                isDefault: Boolean(p.isDefault),
                isOnline: p.isOnline !== false,
                source: "local_agent",
                details: "Denetim Masası Yazıcısı",
              };
              results.push(item);
              PrinterService.saveClientPrinter(item, currentUser?.id);
            }
          }
        }
      } catch {}
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
