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
 * Fare, Bluetooth, Kart Okuyucu veya 2.4G Alıcı gibi yazıcı olmayan donanımları filtreler
 */
export const isNonPrinterHardware = (name?: string | null): boolean => {
  if (!name) return true;
  const n = name.toLowerCase().trim();
  if (!n) return true;
  const nonPrinterKeywords = [
    "mouse",
    "fare",
    "keyboard",
    "klavye",
    "receiver",
    "alici",
    "alıcı",
    "2.4g",
    "card reader",
    "kart okuyucu",
    "bluetooth",
    "adapter",
    "hub",
    "controller",
    "bilinmeyen cihaz",
    "unknown device",
    "quanta computer",
    "imc networks",
    "realtek",
  ];
  return nonPrinterKeywords.some((k) => n.includes(k));
};

/**
 * Sanal (PDF, XPS, OneNote, Fax) yazıcıları ayırt eder (Sıralamada arkaya almak veya etiketlemek için)
 */
export const isVirtualSystemPrinter = (name?: string | null): boolean => {
  if (!name) return false;
  const n = name.toLowerCase().trim();
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
  ];
  return virtualKeywords.some((k) => n.includes(k));
};

export const getLocalPrintersFromStorage = (): string[] => {
  try {
    const raw = localStorage.getItem("local_printers");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed
          .map((item: any) => (typeof item === "string" ? item : item?.name))
          .filter((n: any) => typeof n === "string" && n.trim().length > 0);
      }
    }
  } catch {}

  // Geriye dönük uyumluluk: likya_client_printers
  try {
    const legacy = localStorage.getItem("likya_client_printers");
    if (legacy) {
      const parsed = JSON.parse(legacy);
      if (Array.isArray(parsed)) {
        const names = parsed
          .map((item: any) => (typeof item === "string" ? item : item?.name))
          .filter((n: any) => typeof n === "string" && n.trim().length > 0);
        if (names.length > 0) {
          saveLocalPrintersToStorage(names);
          return names;
        }
      }
    }
  } catch {}

  return [];
};

export const saveLocalPrintersToStorage = (printers: string[]): void => {
  try {
    const cleanList = Array.from(
      new Set(
        printers
          .map((p) => (typeof p === "string" ? p.trim() : ""))
          .filter((p) => p.length > 0)
      )
    );
    localStorage.setItem("local_printers", JSON.stringify(cleanList));
    const objList = cleanList.map((name) => ({
      name,
      source: isVirtualSystemPrinter(name) ? "system" : "browser",
      isDefault: false,
      details: "Bu Bilgisayara Özel Tanımlı Yerel Yazıcı",
    }));
    localStorage.setItem("likya_client_printers", JSON.stringify(objList));
  } catch {}
};

let lastPort5050FailTime = 0;

export class PrinterService {
  public static isVirtualSystemPrinter = isVirtualSystemPrinter;
  public static isNonPrinterHardware = isNonPrinterHardware;
  public static getLocalPrinters = getLocalPrintersFromStorage;
  public static saveLocalPrinters = saveLocalPrintersToStorage;

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
      // 1. Doğrudan bu bilgisayarın local_printers listesini al
      const localPrinters = getLocalPrintersFromStorage();
      for (const pName of localPrinters) {
        if (!list.some((p) => p.name.toLowerCase() === pName.toLowerCase())) {
          list.push({
            name: pName,
            isDefault: list.length === 0,
            isOnline: true,
            source: isVirtualSystemPrinter(pName) ? "system" : "browser",
            details: "Bu Bilgisayara Özel Tanımlı Yerel Yazıcı",
          });
        }
      }

      const cleanRaw = (raw: string | null) => {
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.filter((p: any) => {
          const pName = (p?.name || "").toLowerCase().trim();
          return pName && !isNonPrinterHardware(pName);
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
      const terminalKey = `likya_terminal_printer_${PrinterService.getTerminalUUID()}`;
      const termPrinter = localStorage.getItem(terminalKey);
      if (termPrinter && !isNonPrinterHardware(termPrinter) && !list.some((p) => p.name.toLowerCase() === termPrinter.toLowerCase())) {
        list.unshift({
          name: termPrinter,
          isDefault: true,
          source: "browser",
          details: "Bu Bilgisayarın Seçili Terminal Yazıcısı",
        });
      }
    } catch {}
    return list;
  }

  /**
   * İstemci yazıcısını bu bilgisayarın ve kullanıcının tarayıcı hafızasına kaydeder
   */
  public static saveClientPrinter(printer: SystemPrinterItem, userId?: string | number): void {
    try {
      if (!printer.name || isNonPrinterHardware(printer.name)) return;
      const cleanName = printer.name.trim();

      // local_printers listesine ekle ve kaydet
      const currentStored = getLocalPrintersFromStorage();
      const updatedStored = Array.from(new Set([cleanName, ...currentStored]));
      saveLocalPrintersToStorage(updatedStored);

      const current = PrinterService.getClientStoredPrinters(userId);
      const filtered = current.filter((p) => p.name.toLowerCase() !== cleanName.toLowerCase());
      filtered.unshift({
        ...printer,
        name: cleanName,
        details: printer.details || "Bu Bilgisayara Bağlı Yazıcı",
      });
      const toSave = filtered.slice(0, 30);
      localStorage.setItem("likya_client_printers", JSON.stringify(toSave));
      if (userId) {
        localStorage.setItem(`likya_user_printers_${userId}`, JSON.stringify(toSave));
      }
      const termUUID = PrinterService.getTerminalUUID();
      localStorage.setItem(`likya_terminal_printer_${termUUID}`, cleanName);
      localStorage.setItem("likya_last_selected_printer", cleanName);
      localStorage.setItem("likya_terminal_last_printer", cleanName);
      localStorage.setItem("likya_terminal_uuid", termUUID);
    } catch {}
  }

  /**
   * Sadece o anki bilgisayara bağlı gerçek yazıcıları çok kanallı dinamik çeken fonksiyon
   * (LocalStorage local_printers, Yerel Spooler Port 5050, Chromium queryLocalPrinters, Navigator Printing)
   * Kural: Sunucu makinesinin backend yazıcılarını ASLA çekmez!
   */
  public static async fetchRealTimePrinters(): Promise<string[]> {
    const physicalList: string[] = [];
    const virtualList: string[] = [];

    const addPrinterName = (rawName?: string | null) => {
      if (!rawName) return;
      const name = rawName.trim();
      if (!name || isNonPrinterHardware(name)) return;
      const isVirtual = isVirtualSystemPrinter(name);
      const targetList = isVirtual ? virtualList : physicalList;
      if (!physicalList.some((p) => p.toLowerCase() === name.toLowerCase()) &&
          !virtualList.some((p) => p.toLowerCase() === name.toLowerCase())) {
        targetList.push(name);
      }
    };

    // 1. Bu bilgisayarın LocalStorage'ında kayıtlı yerel yazıcılar
    const stored = getLocalPrintersFromStorage();
    for (const p of stored) {
      addPrinterName(p);
    }

    // 2. printercekmeApp Yerel Köprü Servisi (Port 9100 - HTTP & WebSocket)
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1800);
      const res = await fetch("http://127.0.0.1:9100/api/printers", {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (res.ok) {
        const list = await res.json();
        if (Array.isArray(list)) {
          for (const item of list) {
            addPrinterName(item?.name);
          }
        }
      }
    } catch {}

    // 3. Yerel Windows Sessiz Yazdırma Servisi (Port 5050 - Client Makine Spooler)
    if (Date.now() - lastPort5050FailTime > 15000) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1500);
        const res = await fetch("http://127.0.0.1:5050/printers", {
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (res.ok) {
          const data = await res.json();
          const list = Array.isArray(data.printers) ? data.printers : [];
          for (const p of list) {
            addPrinterName(p?.name);
          }
        } else {
          lastPort5050FailTime = Date.now();
        }
      } catch {
        lastPort5050FailTime = Date.now();
      }
    }

    // 3. Chromium Web Printing API (window.queryLocalPrinters)
    if (typeof window !== "undefined" && typeof (window as any).queryLocalPrinters === "function") {
      try {
        const printers = await (window as any).queryLocalPrinters();
        for (const p of (printers || [])) {
          addPrinterName(p?.name || p?.id || p);
        }
      } catch (err: any) {
        console.debug("queryLocalPrinters izni verilmedi veya hata:", err);
      }
    }

    // 4. Chromium / WICG Web Printing API (window.printing.getPrinters)
    if (typeof window !== "undefined" && "printing" in window && typeof (window as any).printing?.getPrinters === "function") {
      try {
        const printers = await (window as any).printing.getPrinters();
        for (const p of (printers || [])) {
          const pName = typeof p?.cachedAttributes === "function" ? p.cachedAttributes()?.printerName : (p?.name || p?.id || p);
          addPrinterName(pName);
        }
      } catch (err: any) {
        console.debug("window.printing.getPrinters hata:", err);
      }
    }

    // 5. Navigator Printing Standart API
    if (typeof navigator !== "undefined" && "printing" in navigator && typeof (navigator as any).printing?.getPrinters === "function") {
      try {
        const printers = await (navigator as any).printing.getPrinters();
        for (const p of (printers || [])) {
          addPrinterName(p?.name || p?.id || p);
        }
      } catch {}
    }

    // Sunucudan (backend) yazıcı ÇEKİLMEZ - Sadece bu bilgisayarın yazıcıları listelenir.
    return [...physicalList, ...virtualList];
  }

  public static async fetchLocalPrinters(): Promise<string[]> {
    return PrinterService.fetchRealTimePrinters();
  }

  /**
   * Bilgisayara bağlı yerel yazıcıları listeler (Fiziksel donanımlar önde, sanal yazıcılar arkada)
   */
  public static async getSystemPrinters(
    currentUser?: { id?: number | string; fullName?: string; name?: string; username?: string; printerId?: string | number } | null
  ): Promise<SystemPrinterItem[]> {
    const results: SystemPrinterItem[] = [];

    // 1. Çok kanallı gerçek zamanlı tarama
    try {
      const realPrinters = await PrinterService.fetchRealTimePrinters();
      if (Array.isArray(realPrinters) && realPrinters.length > 0) {
        for (const pName of realPrinters) {
          const cleanName = String(pName || "").trim();
          if (cleanName && !isNonPrinterHardware(cleanName) && !results.some((r) => r.name.toLowerCase() === cleanName.toLowerCase())) {
            const isVirtual = isVirtualSystemPrinter(cleanName);
            const item: SystemPrinterItem = {
              name: cleanName,
              isDefault: results.length === 0,
              isOnline: true,
              source: isVirtual ? "system" : "browser",
              details: isVirtual ? "Sanal Yazıcı / Belge Çıktısı" : "Bu Bilgisayara Bağlı Yazıcı (Denetim Masası)",
            };
            results.push(item);
          }
        }
      }
    } catch (err: any) {
      console.debug("Yazıcı tarama:", err?.message || err);
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

  /**
   * printercekmeApp (Yerel Ajan - Port 9100) üzerinden işletim sistemi yazıcılarını çeker.
   * 1. Öncelik WebSocket (ws://127.0.0.1:9100) — Canlı HTTPS sayfalarında Mixed Content / PNA engeline takılmaz.
   * 2. Sadece localhost ortamında çalışırken fallback olarak fetch('http://127.0.0.1:9100/api/printers') kullanır.
   */
  public static async fetchFromPrinterCekmeApp(): Promise<{
    success: boolean;
    printers: SystemPrinterItem[];
    error?: string;
  }> {
    // 1. Öncelik WebSocket (ws://127.0.0.1:9100)
    if (typeof WebSocket !== "undefined") {
      try {
        const wsPrinters = await new Promise<SystemPrinterItem[] | null>((resolve) => {
          let resolved = false;
          let ws: WebSocket | null = null;

          const finish = (result: SystemPrinterItem[] | null) => {
            if (!resolved) {
              resolved = true;
              clearTimeout(timer);
              if (ws) {
                try { ws.close(); } catch {}
              }
              resolve(result);
            }
          };

          const timer = setTimeout(() => {
            finish(null);
          }, 1500);

          try {
            ws = new WebSocket("ws://127.0.0.1:9100");

            ws.onopen = () => {
              try {
                ws?.send(JSON.stringify({ action: "get_printers" }));
              } catch {}
            };

            ws.onmessage = (event) => {
              try {
                const parsed = JSON.parse(event.data);
                const rawList = Array.isArray(parsed) ? parsed : (parsed.data || parsed.printers || []);
                if (Array.isArray(rawList)) {
                  const list: SystemPrinterItem[] = rawList
                    .map((item: any) => ({
                      name: String(item.name || "").trim(),
                      isDefault: Boolean(item.isDefault),
                      isOnline: item.status !== "Çevrimdışı",
                      source: "local_agent" as const,
                      details: `🔌 printercekmeApp (${item.status || "Hazır"})`,
                    }))
                    .filter((p) => p.name.length > 0);
                  finish(list);
                }
              } catch {}
            };

            ws.onerror = () => {
              finish(null);
            };
          } catch {
            finish(null);
          }
        });

        if (wsPrinters && wsPrinters.length > 0) {
          return { success: true, printers: wsPrinters };
        }
      } catch (wsErr) {
        console.warn("[printerService] WebSocket bağlantı hatası:", wsErr);
      }
    }

    // 2. Sadece localhost / HTTP ortamında çalışırken fallback olarak HTTP GET /api/printers
    const isLocalhostOrHttp =
      typeof window !== "undefined" &&
      (window.location.protocol === "http:" ||
        window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1");

    if (isLocalhostOrHttp) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);
        const res = await fetch("http://127.0.0.1:9100/api/printers", {
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            const list: SystemPrinterItem[] = data
              .map((item: any) => ({
                name: String(item.name || "").trim(),
                isDefault: Boolean(item.isDefault),
                isOnline: item.status !== "Çevrimdışı",
                source: "local_agent" as const,
                details: `🔌 printercekmeApp (${item.status || "Hazır"})`,
              }))
              .filter((p) => p.name.length > 0);
            return { success: true, printers: list };
          }
        }
      } catch (httpErr) {
        console.warn("[printerService] Localhost HTTP /api/printers başarısız:", httpErr);
      }
    }

    return {
      success: false,
      printers: [],
      error: "Yerel yazıcı servisine (PrinterAgent.exe) ulaşılamadı. Lütfen PrinterAgent uygulamasının açık olduğundan emin olun.",
    };
  }
}
