/**
 * Product Synchronization Service for Kuyumcu ERP
 * Enables live (zero page reload) updates across all Product Selection modals
 * (Ürün Seçimi, Para/Döviz Seçimi, Barkodlu Ürün Seçimi) whenever any product
 * is created, updated, or deleted.
 */

import { FastLookupCache } from "./fastLookupCache";

export type ProductChangeType = "all" | "para" | "altin" | "ozel";

export interface ProductChangeEvent {
  type: ProductChangeType;
  action?: "create" | "update" | "delete" | "refresh";
  payload?: any;
  timestamp: number;
}

const BROADCAST_CHANNEL_NAME = "likya_product_sync_channel";
const STORAGE_KEY = "likya_product_last_sync";
const WINDOW_EVENT_NAME = "likya:product-updated";

let broadcastChannel: BroadcastChannel | null = null;
if (typeof BroadcastChannel !== "undefined") {
  try {
    broadcastChannel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
  } catch {
    broadcastChannel = null;
  }
}

/**
 * Notifies all open pages, tabs, and modals that a product has been added, updated, or removed.
 */
export const notifyProductChanged = (
  type: ProductChangeType = "all",
  payload?: any,
  action: "create" | "update" | "delete" | "refresh" = "update"
): void => {
  // 1. Invalidate in-memory caches
  if (type === "all" || type === "para") {
    FastLookupCache.invalidate("urunler");
    FastLookupCache.invalidate("paralar");
  }
  if (type === "all" || type === "altin") {
    FastLookupCache.invalidate("altin");
  }
  if (type === "all" || type === "ozel") {
    FastLookupCache.invalidate("ozel");
  }

  const eventData: ProductChangeEvent = {
    type,
    action,
    payload,
    timestamp: Date.now(),
  };

  // 2. Dispatch local window event
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent<ProductChangeEvent>(WINDOW_EVENT_NAME, {
        detail: eventData,
      })
    );

    // 3. Update localStorage to notify other tabs via storage event
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(eventData));
    } catch {}
  }

  // 4. Send over BroadcastChannel to other active browser contexts
  if (broadcastChannel) {
    try {
      broadcastChannel.postMessage(eventData);
    } catch {}
  }
};

/**
 * Subscribes to live product change events.
 * Returns an unsubscription function.
 */
export const onProductChanged = (
  callback: (event: ProductChangeEvent) => void
): (() => void) => {
  if (typeof window === "undefined") {
    return () => {};
  }

  // Window CustomEvent handler (same tab/window)
  const handleCustomEvent = (e: Event) => {
    const custom = e as CustomEvent<ProductChangeEvent>;
    if (custom.detail) {
      callback(custom.detail);
    }
  };
  window.addEventListener(WINDOW_EVENT_NAME, handleCustomEvent);

  // BroadcastChannel handler (other tabs/windows)
  const handleBroadcastMessage = (e: MessageEvent<ProductChangeEvent>) => {
    if (e.data && e.data.timestamp) {
      callback(e.data);
    }
  };
  if (broadcastChannel) {
    broadcastChannel.addEventListener("message", handleBroadcastMessage);
  }

  // Storage event fallback (cross-tab if BroadcastChannel unsupported)
  const handleStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY && e.newValue) {
      try {
        const parsed = JSON.parse(e.newValue) as ProductChangeEvent;
        if (parsed && parsed.timestamp) {
          callback(parsed);
        }
      } catch {}
    }
  };
  window.addEventListener("storage", handleStorage);

  return () => {
    window.removeEventListener(WINDOW_EVENT_NAME, handleCustomEvent);
    if (broadcastChannel) {
      broadcastChannel.removeEventListener("message", handleBroadcastMessage);
    }
    window.removeEventListener("storage", handleStorage);
  };
};
