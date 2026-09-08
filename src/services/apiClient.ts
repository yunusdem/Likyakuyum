/**
 * Enterprise API Client for Kuyumcu ERP
 * Uses Fetch with automatic JSON parsing, request timeout, and error wrapping.
 * Fully configurable via .env variables.
 */

import { envConfig } from "../config/env.config";

interface RequestOptions extends RequestInit {
  params?: Record<string, any>;
  timeoutMs?: number;
}

export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data: T;
  meta?: any;
}

export type ConnectionMode = "cloud" | "local";

/**
 * Returns current active connection mode (default: cloud)
 */
export const getConnectionMode = (): ConnectionMode => {
  const saved = localStorage.getItem("kuyumcu_erp_connection_mode");
  if (saved === "cloud" || saved === "local") return saved;
  return "cloud";
};

/**
 * Sets active connection mode and notifies listeners
 */
export const setConnectionMode = (mode: ConnectionMode): void => {
  localStorage.setItem("kuyumcu_erp_connection_mode", mode);
  window.dispatchEvent(new CustomEvent("kuyumcu_connection_mode_changed", { detail: { mode } }));
};

/**
 * Returns active effective API Base URL (Standard backend /api/v1)
 */
export const getEffectiveApiUrl = (): string => {
  return envConfig.apiUrl || "/api/v1";
};

/**
 * Backward compatibility stub
 */
export const checkLocalAgentStatus = async (): Promise<boolean> => {
  return true;
};

class ApiClient {
  private buildUrl(path: string, params?: Record<string, any>): string {
    const cleanPath = path.startsWith("/") ? path : `/${path}`;
    const activeBaseUrl = getEffectiveApiUrl();
    let url = `${activeBaseUrl}${cleanPath}`;
    if (params) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, String(value));
        }
      });
      const queryString = searchParams.toString();
      if (queryString) {
        url += (url.includes("?") ? "&" : "?") + queryString;
      }
    }
    return url;
  }

  public async request<T = any>(endpoint: string, options: RequestOptions = {}): Promise<ApiResponse<T>> {
    const { params, headers, timeoutMs = envConfig.apiTimeout, ...restOptions } = options;
    const url = this.buildUrl(endpoint, params);

    const token = localStorage.getItem("kuyumcu_erp_access_token");
    const dbServer = localStorage.getItem("kuyumcu_erp_last_server") || localStorage.getItem("kuyumcu_erp_active_server");
    const dbName = localStorage.getItem("kuyumcu_erp_last_db") || localStorage.getItem("kuyumcu_erp_active_db");
    const dbUser = localStorage.getItem("kuyumcu_erp_db_user");
    const dbPassword = localStorage.getItem("kuyumcu_erp_db_password");

    const isLoginRequest = endpoint.includes("/auth/login");

    const defaultHeaders: HeadersInit = {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(!isLoginRequest && dbServer ? { "x-db-server": dbServer } : {}),
      ...(!isLoginRequest && dbName ? { "x-db-name": dbName } : {}),
      ...(!isLoginRequest && dbUser ? { "x-db-user": dbUser } : {}),
      ...(!isLoginRequest && dbPassword !== null && dbPassword !== undefined ? { "x-db-password": dbPassword } : {}),
      ...headers,
    };

    // Controller for request timeout
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        headers: defaultHeaders,
        signal: controller.signal,
        ...restOptions,
      });

      clearTimeout(timer);

      const json = await response.json().catch(() => ({}));

      if (!response.ok) {
        const errorMessage = json.message || json.error || `HTTP Hata ${response.status}: ${response.statusText}`;

        // Handle 401 Unauthorized / Token Expiration on authenticated requests
        if (response.status === 401 && !url.includes("/auth/login")) {
          localStorage.removeItem("kuyumcu_erp_access_token");
          localStorage.removeItem("kuyumcu_erp_user");
          window.dispatchEvent(new CustomEvent("kuyumcu_session_expired"));
        }

        throw new Error(errorMessage);
      }

      return json as ApiResponse<T>;
    } catch (error: any) {

      clearTimeout(timer);
      if (error.name === "AbortError") {
        throw new Error(`İstek zaman aşımına uğradı (${timeoutMs}ms). Sunucu yanıt vermedi.`);
      }
      if (error.message === "Failed to fetch" || error.name === "TypeError") {
        const mode = getConnectionMode();
        if (mode === "local") {
          throw new Error(
            "⚠️ Yerel SQL Köprüsü (Local Agent) çalışmıyor! Lütfen bilgisayarınızdaki 'start-agent.bat' dosyasını çalıştırarak yerel servisi başlatınız (Port: 25050)."
          );
        }
        throw new Error("Backend API sunucusuna ulaşılamadı. Sunucunun çalıştığından emin olunuz.");
      }

      // If it is an authentication/login error or invalid credentials, keep the console clean without stack trace
      if (url.includes("/auth/login") || error.message?.includes("Geçersiz") || error.message?.includes("şifre") || error.message?.includes("kullanıcı")) {
        console.warn(`[Giriş] ${error.message || "Kullanıcı adı veya şifre hatalı."}`);
      } else {
        console.error(`[API Client Error] ${options.method || "GET"} ${url}:`, error.message || error);
      }
      throw error;
    }


  }

  public get<T = any>(endpoint: string, params?: Record<string, any>, options?: RequestOptions) {
    return this.request<T>(endpoint, { method: "GET", params, ...options });
  }

  public post<T = any>(endpoint: string, data?: any, options?: RequestOptions) {
    return this.request<T>(endpoint, {
      method: "POST",
      body: data ? JSON.stringify(data) : undefined,
      ...options,
    });
  }

  public put<T = any>(endpoint: string, data?: any, options?: RequestOptions) {
    return this.request<T>(endpoint, {
      method: "PUT",
      body: data ? JSON.stringify(data) : undefined,
      ...options,
    });
  }

  public delete<T = any>(endpoint: string, options?: RequestOptions) {
    return this.request<T>(endpoint, { method: "DELETE", ...options });
  }
}

export const apiClient = new ApiClient();
