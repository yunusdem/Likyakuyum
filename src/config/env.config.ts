/**
 * Frontend Environment Configuration
 * Centralized reading of environment variables defined in .env
 */

interface FrontendEnvConfig {
  apiUrl: string;
  backendOrigin: string;
  appName: string;
  appEnv: string;
  apiTimeout: number;
}

export const envConfig: FrontendEnvConfig = {
  apiUrl: (import.meta as any).env?.VITE_API_URL || "/api/v1",
  backendOrigin: (import.meta as any).env?.VITE_BACKEND_ORIGIN || "http://localhost:5000",
  appName: (import.meta as any).env?.VITE_APP_NAME || "Likya Kuyum",

  appEnv: (import.meta as any).env?.VITE_APP_ENV || "development",
  apiTimeout: parseInt((import.meta as any).env?.VITE_API_TIMEOUT || "15000", 10),
};
