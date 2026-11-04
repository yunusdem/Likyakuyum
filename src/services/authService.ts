/**
 * Enterprise AuthService for Kuyumcu ERP
 * Handles JWT token storage, login, logout, and user session state.
 */

import { apiClient } from "./apiClient";
import { UserProfileDto } from "./userService";
import { FastLookupCache } from "./fastLookupCache";

/** Giriş = Müşteri No + seçilen veritabanı (firmaId) + kullanıcı adı + şifre. DB bağlantısı sunucuda çözülür. */
export interface LoginCredentials {
  musteriNo: string;
  firmaId: number;
  username: string;
  password: string;
}

/** Müşteri noya bağlı veritabanı (giriş ekranındaki liste) */
export interface MusteriVeritabani {
  firmaId: number;
  unvan: string;
  dbName: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: string;
}

export interface AuthResponse {
  user: UserProfileDto;
  tokens: AuthTokens;
  baglanti?: { dbServer: string; dbName: string };
}

const ACCESS_TOKEN_KEY = "kuyumcu_erp_access_token";
const USER_KEY = "kuyumcu_erp_user";
const DB_SERVER_KEY = "kuyumcu_erp_active_server";
const DB_NAME_KEY = "kuyumcu_erp_active_db";
const DB_USER_KEY = "kuyumcu_erp_db_user";
const DB_PASSWORD_KEY = "kuyumcu_erp_db_password";
const CONNECTION_MODE_KEY = "kuyumcu_erp_connection_mode";
const LAST_SERVER_KEY = "kuyumcu_erp_last_server";
const LAST_DB_KEY = "kuyumcu_erp_last_db";

const PROTECTED_STORAGE_KEYS = new Set([
  ACCESS_TOKEN_KEY,
  USER_KEY,
  DB_SERVER_KEY,
  DB_NAME_KEY,
  CONNECTION_MODE_KEY,
  LAST_SERVER_KEY,
  LAST_DB_KEY,
  "kuyumcu_erp_firma_id",
  "kuyumcu_erp_musteri_no",
  "kuyumcu_erp_remember_me",
  "kuyumcu_erp_remember_user",
]);

function safeSetStorageItem(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    try {
      // QuotaExceededError durumunda kritik olmayan büyük localStorage kayıtlarını temizle
      const entries: { k: string; len: number }[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && !PROTECTED_STORAGE_KEYS.has(k)) {
          entries.push({ k, len: (localStorage.getItem(k) || "").length });
        }
      }
      entries.sort((a, b) => b.len - a.len);
      for (const entry of entries) {
        localStorage.removeItem(entry.k);
        try {
          localStorage.setItem(key, value);
          return;
        } catch {
          // Devam et
        }
      }
    } catch {
      // Ignore storage errors so session verification never crashes
    }
  }
}

export const AuthService = {
  /**
   * Giriş ekranı: müşteri no yazılınca o müşterinin veritabanları
   */
  async musteriVeritabanlari(musteriNo: string): Promise<MusteriVeritabani[]> {
    const res = await apiClient.get<MusteriVeritabani[]>("/auth/musteri-veritabanlari", { musteriNo });
    return res.data || [];
  },

  /**
   * Performs user login via backend API
   */
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const payload = {
      musteriNo: credentials.musteriNo.trim().toUpperCase(),
      firmaId: credentials.firmaId,
      username: credentials.username?.trim() || "",
      password: credentials.password || "",
    };

    const res = await apiClient.post<AuthResponse>("/auth/login", payload);
    if (res.data && res.data.tokens?.accessToken) {
      this.setSession(res.data.tokens.accessToken, res.data.user, res.data.baglanti?.dbServer, res.data.baglanti?.dbName);
    }
    return res.data;
  },

  /**
   * Logs out user, invalidates session locally and optionally on backend
   */
  async logout(): Promise<void> {
    try {
      if (this.getToken()) {
        await apiClient.post("/auth/logout").catch(() => {});
      }
    } finally {
      this.clearSession();
    }
  },

  /**
   * Fetches current authenticated user profile
   */
  async getMe(): Promise<UserProfileDto> {
    const res = await apiClient.get<UserProfileDto>("/auth/me");
    if (res.data) {
      safeSetStorageItem(USER_KEY, JSON.stringify(res.data));
    }
    return res.data;
  },

  /**
   * Kullanıcının kendi şifresini değiştirmesi (ilk girişteki zorunlu değişim dahil)
   */
  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    const res = await apiClient.post<{ tokens?: { accessToken?: string } }>("/auth/change-password", { currentPassword, newPassword });
    // Kurulumda (exe) şifre değişince eski jeton reddedilir; sunucunun verdiği yenisiyle oturum sürer
    AuthService.jetonuYenile((res.data as any)?.tokens?.accessToken);
  },

  /** Sunucunun verdiği yeni erişim jetonunu saklar (kurulumda şifre değişiminden sonra) */
  jetonuYenile(accessToken: string | null | undefined): void {
    if (accessToken) safeSetStorageItem(ACCESS_TOKEN_KEY, accessToken);
  },

  /**
   * Sets token, user and active database in localStorage
   */
  setSession(token: string, user: UserProfileDto, dbServer?: string, dbName?: string): void {
    try {
      FastLookupCache.clear();
    } catch {}
    safeSetStorageItem(ACCESS_TOKEN_KEY, token);
    safeSetStorageItem(USER_KEY, JSON.stringify(user));
    if (dbServer) {
      safeSetStorageItem(DB_SERVER_KEY, dbServer);
      safeSetStorageItem(LAST_SERVER_KEY, dbServer);
    }
    if (dbName) {
      safeSetStorageItem(DB_NAME_KEY, dbName);
      safeSetStorageItem(LAST_DB_KEY, dbName);
    }
    // DB kullanıcı adı / şifresi artık tarayıcıda tutulmaz (bağlantı sunucuda firma kaydından çözülür)
    localStorage.removeItem(DB_USER_KEY);
    localStorage.removeItem(DB_PASSWORD_KEY);
    safeSetStorageItem(CONNECTION_MODE_KEY, "cloud");
  },

  /**
   * Clears session from localStorage
   */
  clearSession(): void {
    try {
      FastLookupCache.clear();
    } catch {}
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },

  /**
   * Returns active connected server name
   */
  getActiveServer(): string {
    return localStorage.getItem(DB_SERVER_KEY) || "localhost";
  },

  /**
   * Returns active connected database name
   */
  getActiveDb(): string {
    return localStorage.getItem(DB_NAME_KEY) || "R2016_dvz";
  },

  /**
   * Returns current stored access token
   */
  getToken(): string | null {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  },


  /**
   * Returns current stored user object
   */
  getUser(): UserProfileDto | null {
    const userStr = localStorage.getItem(USER_KEY);
    if (!userStr) return null;
    try {
      return JSON.parse(userStr);
    } catch {
      return null;
    }
  },

  /**
   * Synchronous check if user has a token
   */
  isAuthenticated(): boolean {
    return !!this.getToken();
  },
};
