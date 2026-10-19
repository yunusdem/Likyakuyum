import { apiClient } from "./apiClient";
import { FastLookupCache } from "./fastLookupCache";

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

/**
 * Sanal, PDF, XPS, Fax veya sahte sistem yazıcılarını filtreler
 */
export const isVirtualSystemPrinter = (name?: string | null): boolean => {
  if (!name) return true;
  const n = name.toLowerCase().trim();
  if (!n) return true;
  const virtualKeywords = [
    "pdf",
    "xps",
    "onenote",
    "fax",
    "microsoft print to pdf",
    "microsoft xps",
    "document writer",
    "root print queue",
    "send to onenote",
    "samsung scx-4623",
    "usb printer p",
  ];
  return virtualKeywords.some((k) => n.includes(k));
};

export class PrinterService {
  public static isVirtualSystemPrinter = isVirtualSystemPrinter;
  /**
   * Bu bilgisayara özel benzersiz terminal cihaz kimliği (Terminal UUID)
   */
  public static getTerminalUUID(): string {
    if (typeof localStorage === "undefined") return "term-local-client";
    let uuid = localStorage.getItem("likya_terminal_uuid");
    if (!uuid) {
      uuid = "term-" + (typeof crypto !== "undefined" && typeof (crypto as any).randomUUID === "function"
        ? (crypto as any).randomUUID()
        : Math.random().toString(36).substring(2, 10) + Date.now().toString(36));
      localStorage.setItem("likya_terminal_uuid", uuid);
    }
    return uuid;
  }

  /**
   * Tarayıcı yerel hafızasından bu kullanıcıya ve bilgisayara ait kayıtlı yazıcıları getirir
   */
  public static getClientStoredPrinters(userId?: string | number): SystemPrinterItem[] {
    const list: SystemPrinterItem[] = [];
    try {
      const cleanRaw = (raw: string | null) => {
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.filter((p: any) => {
          const pName = (p?.name || "").toLowerCase();
          return pName && !pName.includes("usb printer p") && p?.source !== "usb";
        });
      };
      if (userId) {
        list.push(...cleanRaw(localStorage.getItem(`likya_user_printers_${userId}`)));
      }
      for (const item of cleanRaw(localStorage.getItem("likya_client_printers"))) {
        if (!list.some((p) => p.name.toLowerCase() === item.name.toLowerCase())) {
          list.push(item);
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
      if (!printer.name || isVirtualSystemPrinter(printer.name)) return;
      const current = PrinterService.getClientStoredPrinters(userId);
      const filtered = current.filter((p) => p.name.toLowerCase() !== printer.name.toLowerCase());
      filtered.unshift({
        ...printer,
        details: printer.details || "Bu Bilgisayara Bağlı Yazıcı",
      });
      const toSave = filtered.slice(0, 30);
      localStorage.setItem("likya_client_printers", JSON.stringify(toSave));
      if (userId) {
        localStorage.setItem(`likya_user_printers_${userId}`, JSON.stringify(toSave));
      }
      localStorage.setItem("likya_last_selected_printer", printer.name);
      localStorage.setItem("likya_terminal_last_printer", printer.name);
      localStorage.setItem("likya_terminal_uuid", PrinterService.getTerminalUUID());
    } catch {}
  }

  /**
   * Sadece o anki bilgisayara bağlı gerçek yazıcıları çeken fonksiyon
   * (Chromium queryLocalPrinters, Navigator printers API, WebUSB)
   */
  public static async fetchRealTimePrinters(): Promise<string[]> {
    let detectedList: string[] = [];

    // Yöntem 1: Chromium queryLocalPrinters API (Chrome / Edge / Opera)
    if (typeof (window as any).queryLocalPrinters === 'function') {
      try {
        const printers = await (window as any).queryLocalPrinters();
        for (const p of (printers || [])) {
          const pName = (p?.name || p || "").trim();
          if (pName && !isVirtualSystemPrinter(pName) && !detectedList.includes(pName)) {
            detectedList.push(pName);
          }
        }
      } catch (err: any) {
        console.debug("queryLocalPrinters izni verilmedi veya hata:", err);
      }
    }

    // Yöntem 2: Navigator Standart Printers API
    if ('printers' in navigator && typeof (navigator as any).printers?.queryPrinters === 'function') {
      try {
        const printers = await (navigator as any).printers.queryPrinters();
        for (const p of (printers || [])) {
          const pName = (p?.name || p || "").trim();
          if (pName && !isVirtualSystemPrinter(pName) && !detectedList.includes(pName)) {
            detectedList.push(pName);
          }
        }
      } catch (err: any) {
        console.debug("navigator.printers izni verilmedi:", err);
      }
    }

    // Yöntem 3: Navigator Printing API
    if ('printing' in navigator && typeof (navigator as any).printing?.getPrinters === 'function') {
      try {
        const printers = await (navigator as any).printing.getPrinters();
        for (const p of (printers || [])) {
          const pName = (p?.name || p?.id || p || "").trim();
          if (pName && !isVirtualSystemPrinter(pName) && !detectedList.includes(pName)) {
            detectedList.push(pName);
          }
        }
      } catch (err: any) {
        console.debug("navigator.printing izni verilmedi:", err);
      }
    }

    // Yöntem 4: Önceden yetkilendirilmiş WebUSB cihazları
    if (typeof navigator !== "undefined" && "usb" in navigator && typeof (navigator as any).usb?.getDevices === "function") {
      try {
        const usbDevs = await (navigator as any).usb.getDevices();
        for (const d of (usbDevs || [])) {
          const pName = (d.productName || "").trim();
          if (pName && !isVirtualSystemPrinter(pName) && !detectedList.includes(pName)) {
            detectedList.push(pName);
          }
        }
      } catch {}
    }

    return detectedList;
  }

  /**
   * Kullanıcı butonuna basıldığında tarayıcının yerel USB cihaz izin ve seçim penceresini doğrudan tetikler
   */
  public static async requestUsbPrinter(): Promise<string | null> {
    if (typeof navigator !== "undefined" && "usb" in navigator && typeof (navigator as any).usb?.requestDevice === "function") {
      try {
        const dev = await (navigator as any).usb.requestDevice({ filters: [] });
        if (dev && dev.productName) {
          const name = dev.productName.trim();
          if (!isVirtualSystemPrinter(name)) {
            PrinterService.saveClientPrinter({
              name,
              source: "browser",
              isDefault: true,
              details: "Bu Bilgisayara Bağlı USB Yazıcı",
            });
            return name;
          }
        }
      } catch (err: any) {
        console.debug("WebUSB cihaz seçimi iptal edildi / atlandı:", err);
      }
    }
    return null;
  }

  public static async fetchLocalPrinters(): Promise<string[]> {
    return PrinterService.fetchRealTimePrinters();
  }

  /**
   * Bilgisayara bağlı yerel yazıcıları listeler (Sanal/PDF/XPS sistem yazıcıları elenir)
   */
  public static async getSystemPrinters(
    currentUser?: { id?: number | string; fullName?: string; name?: string; username?: string; printerId?: string | number } | null
  ): Promise<SystemPrinterItem[]> {
    const results: SystemPrinterItem[] = [];

    // 1. Doğrudan Tarayıcı Web Printing & WebUSB API ile gerçek zamanlı dinamik tara
    try {
      const realPrinters = await PrinterService.fetchRealTimePrinters();
      if (Array.isArray(realPrinters) && realPrinters.length > 0) {
        for (const pName of realPrinters) {
          const cleanName = String(pName || "").trim();
          if (cleanName && !isVirtualSystemPrinter(cleanName) && !results.some((r) => r.name.toLowerCase() === cleanName.toLowerCase())) {
            const item: SystemPrinterItem = {
              name: cleanName,
              isDefault: results.length === 0,
              isOnline: true,
              source: "browser",
              details: "Bu Bilgisayara Bağlı Yazıcı",
            };
            results.push(item);
            PrinterService.saveClientPrinter(item, currentUser?.id);
          }
        }
      }
    } catch (err: any) {
      console.debug("Tarayıcı Web Printing tarama:", err?.message || err);
    }

    // 2. Bu bilgisayara önceden kaydedilmiş yerel yazıcılar (LocalStorage)
    try {
      const clientStored = PrinterService.getClientStoredPrinters(currentUser?.id);
      for (const cs of clientStored) {
        if (!isVirtualSystemPrinter(cs.name) && !results.some((r) => r.name.toLowerCase() === cs.name.toLowerCase())) {
          results.push(cs);
        }
      }
    } catch {}

    // 3. Son seçilen terminal yazıcısı
    try {
      const lastTerminal = localStorage.getItem("likya_terminal_last_printer");
      if (lastTerminal && !isVirtualSystemPrinter(lastTerminal) && !results.some((r) => r.name.toLowerCase() === lastTerminal.toLowerCase())) {
        results.push({
          name: lastTerminal,
          isDefault: results.length === 0,
          isOnline: true,
          source: "browser",
          details: "Bu Bilgisayarda Kayıtlı Yazıcı",
        });
      }
    } catch {}

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
    FastLookupCache.invalidate("printers");
    FastLookupCache.invalidate("vezneler");
    return res.data;
  }

  public static async updateYazici(id: number | string, data: YaziciFormData): Promise<YaziciItem> {
    const res = await apiClient.put<YaziciItem>(`/yazici/${id}`, data);
    FastLookupCache.invalidate("printers");
    FastLookupCache.invalidate("vezneler");
    return res.data;
  }

  public static async getYaziciUsage(id: number | string): Promise<YaziciUsageInfo> {
    const res = await apiClient.get<YaziciUsageInfo>(`/yazici/usage/${id}`);
    return res.data as YaziciUsageInfo;
  }

  public static async deleteYazici(id: number | string, options?: { force?: boolean }): Promise<boolean> {
    const url = options?.force ? `/yazici/${id}?force=true` : `/yazici/${id}`;
    const res = await apiClient.delete<{ id: string }>(url);
    FastLookupCache.invalidate("printers");
    FastLookupCache.invalidate("vezneler");
    return res.success;
  }

  /**
   * Doğrudan Yazdırma:
   * Kurulumsuz mimaride backend doğrudan yazdırma veya tarayıcı motoruyla kesintisiz çıktı üretir.
   */
  public static async directPrint(
    payload: DirectPrintPayload
  ): Promise<{ success: boolean; message: string; fallbackToBrowser?: boolean }> {
    // 1. Ana sunucu / yerel backend doğrudan yazdırma endpoint'i
    try {
      const res = await apiClient.post<{ success: boolean; message: string; fallbackToBrowser?: boolean }>(
        "/yazici/direct-print",
        payload,
        { silent: true }
      );
      if (res.data && res.data.success) {
        return res.data;
      }
    } catch {}

    return {
      success: true,
      message: `"${payload.printerName || 'Tanımlı Yazıcı'}" için yazdırma akışına yönlendirildi.`,
      fallbackToBrowser: true,
    };
  }
}
