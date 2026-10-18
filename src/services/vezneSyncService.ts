import { getEffectiveApiUrl } from "./apiClient";

const CHANNEL_NAME = "likya_vezne_bakiye_channel";
const CUSTOM_EVENT_NAME = "likya:vezne-bakiye-changed";
const STORAGE_KEY = "likya_vezne_bakiye_ts";

export type VezneChangeCallback = (data?: any) => void;

class VezneSyncService {
  private listeners: Set<VezneChangeCallback> = new Set();
  private broadcastChannel: BroadcastChannel | null = null;
  private eventSource: EventSource | null = null;
  private sseReconnectTimer: any = null;
  private debounceTimer: any = null;
  private isInitialized = false;

  public init(): void {
    if (this.isInitialized || typeof window === "undefined") return;
    this.isInitialized = true;

    // 1. BroadcastChannel across tabs/windows
    if (typeof BroadcastChannel !== "undefined") {
      try {
        this.broadcastChannel = new BroadcastChannel(CHANNEL_NAME);
        this.broadcastChannel.onmessage = (event) => {
          this.triggerListeners(event.data);
        };
      } catch (err) {
        console.warn("BroadcastChannel could not be initialized:", err);
      }
    }

    // 2. Custom DOM Event in same window
    window.addEventListener(CUSTOM_EVENT_NAME, (event: any) => {
      this.triggerListeners(event.detail);
    });

    // 3. Storage Event across tabs fallback
    window.addEventListener("storage", (event: StorageEvent) => {
      if (event.key === STORAGE_KEY && event.newValue) {
        this.triggerListeners({ type: "storage_event", timestamp: Number(event.newValue) });
      }
    });

    // 4. Server-Sent Events (SSE) for real-time backend notifications
    this.connectSSE();
  }

  private connectSSE(): void {
    if (typeof window === "undefined" || typeof EventSource === "undefined") return;

    try {
      if (this.eventSource) {
        this.eventSource.close();
        this.eventSource = null;
      }

      const baseUrl = getEffectiveApiUrl();
      const token = localStorage.getItem("kuyumcu_erp_access_token") || "";
      const streamUrl = `${baseUrl}/vezne/izleme/stream${token ? `?token=${encodeURIComponent(token)}` : ""}`;

      this.eventSource = new EventSource(streamUrl);

      this.eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data && data.type === "BAKIYE_CHANGED") {
            this.triggerListeners(data);
          }
        } catch {
          this.triggerListeners({ type: "sse_raw" });
        }
      };

      this.eventSource.onerror = () => {
        if (this.eventSource) {
          this.eventSource.close();
          this.eventSource = null;
        }
        if (!this.sseReconnectTimer) {
          this.sseReconnectTimer = setTimeout(() => {
            this.sseReconnectTimer = null;
            this.connectSSE();
          }, 3000);
        }
      };
    } catch (err) {
      console.warn("SSE connection error:", err);
    }
  }

  private triggerListeners(data?: any): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.listeners.forEach((callback) => {
        try {
          callback(data);
        } catch (e) {
          console.error("Vezne change callback error:", e);
        }
      });
    }, 40);
  }

  public notifyVezneChanged(details?: any): void {
    const payload = {
      type: "BAKIYE_CHANGED",
      timestamp: Date.now(),
      ...details,
    };

    // 1. Post to BroadcastChannel
    try {
      this.broadcastChannel?.postMessage(payload);
    } catch {}

    // 2. Dispatch local custom event
    try {
      window.dispatchEvent(new CustomEvent(CUSTOM_EVENT_NAME, { detail: payload }));
    } catch {}

    // 3. Update localStorage for storage event across tabs
    try {
      localStorage.setItem(STORAGE_KEY, Date.now().toString());
    } catch {}
  }

  public subscribe(callback: VezneChangeCallback): () => void {
    this.init();
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }
}

export const vezneSync = new VezneSyncService();
export const notifyVezneBakiyeChanged = (details?: any) => vezneSync.notifyVezneChanged(details);
