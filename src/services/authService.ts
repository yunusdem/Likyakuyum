/**
 * Enterprise AuthService for Kuyumcu ERP
 * Handles JWT token storage, login, logout, and user session state.
 */

import { apiClient } from "./apiClient";
import { UserProfileDto } from "./userService";

export interface LoginCredentials {
  username: string;
  password?: string;
  dbServer?: string;
  dbName?: string;
  dbUser?: string;
  dbPassword?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: string;
}

export interface AuthResponse {
  user: UserProfileDto;
  tokens: AuthTokens;
}

const ACCESS_TOKEN_KEY = "kuyumcu_erp_access_token";
const USER_KEY = "kuyumcu_erp_user";
const DB_SERVER_KEY = "kuyumcu_erp_active_server";
const DB_NAME_KEY = "kuyumcu_erp_active_db";
const DB_USER_KEY = "kuyumcu_erp_db_user";
const DB_PASSWORD_KEY = "kuyumcu_erp_db_password";

export const AuthService = {
  /**
   * Performs user login via backend API
   */
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const serverVal = credentials.dbServer?.trim() || "localhost";
    const dbVal = credentials.dbName?.trim() || "R2016_dvz";
    const userVal = credentials.dbUser?.trim() || "SA";
    const passwordVal = credentials.dbPassword !== undefined && credentials.dbPassword !== null ? credentials.dbPassword : "";

    const payload = {
      username: credentials.username?.trim() || "",
      password: credentials.password || "",
      dbServer: serverVal,
      server: serverVal,
      serverName: serverVal,
      host: serverVal,
      dbName: dbVal,
      database: dbVal,
      dbUser: userVal,
      user: userVal,
      dbPassword: passwordVal,
      passwordDb: passwordVal,
    };

    const res = await apiClient.post<AuthResponse>("/auth/login", payload);
    if (res.data && res.data.tokens?.accessToken) {
      this.setSession(
        res.data.tokens.accessToken,
        res.data.user,
        serverVal,
        dbVal,
        userVal,
        passwordVal
      );
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
      localStorage.setItem(USER_KEY, JSON.stringify(res.data));
    }
    return res.data;
  },

  /**
   * Sets token, user and active database in localStorage
   */
  setSession(token: string, user: UserProfileDto, dbServer?: string, dbName?: string, dbUser?: string, dbPassword?: string): void {
    localStorage.setItem(ACCESS_TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    if (dbServer) localStorage.setItem(DB_SERVER_KEY, dbServer);
    if (dbName) localStorage.setItem(DB_NAME_KEY, dbName);
    if (dbUser) localStorage.setItem(DB_USER_KEY, dbUser);
    if (dbPassword !== undefined) localStorage.setItem(DB_PASSWORD_KEY, dbPassword);
  },

  /**
   * Clears session from localStorage
   */
  clearSession(): void {
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
