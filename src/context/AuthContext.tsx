import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { AuthService, LoginCredentials } from "../services/authService";
import { UserProfileDto } from "../services/userService";
import { SessionExpiredModal } from "../components/auth/SessionExpiredModal";

interface AuthContextType {
  user: UserProfileDto | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  triggerSessionExpired: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfileDto | null>(() => AuthService.getUser());
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSessionExpiredModalOpen, setIsSessionExpiredModalOpen] = useState<boolean>(false);

  const triggerSessionExpired = useCallback(() => {
    // Only show if not already on the login page
    if (!window.location.pathname.includes("/login")) {
      setIsSessionExpiredModalOpen(true);
    }
  }, []);

  const handleSessionExpiredConfirm = () => {
    setIsSessionExpiredModalOpen(false);
    AuthService.clearSession();
    setUser(null);
    window.location.href = "/login";
  };

  useEffect(() => {
    const initAuth = async () => {
      const token = AuthService.getToken();
      if (!token) {
        setUser(null);
        setIsLoading(false);
        return;
      }

      try {
        const profile = await AuthService.getMe();
        setUser(profile);
      } catch (err) {
        console.warn("JWT Token doğrulaması başarısız oldu veya süresi doldu:", err);
        AuthService.clearSession();
        setUser(null);
        triggerSessionExpired();
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, [triggerSessionExpired]);

  // Global listeners for Session Expiration & Token Removal
  useEffect(() => {
    const handleSessionExpiredEvent = () => {
      triggerSessionExpired();
    };

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "kuyumcu_erp_access_token" && !e.newValue && user) {
        // Token was removed externally or cleared
        triggerSessionExpired();
      }
    };

    window.addEventListener("kuyumcu_session_expired", handleSessionExpiredEvent);
    window.addEventListener("storage", handleStorageChange);

    return () => {
      window.removeEventListener("kuyumcu_session_expired", handleSessionExpiredEvent);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [triggerSessionExpired, user]);

  const login = async (credentials: LoginCredentials) => {
    setIsLoading(true);
    try {
      const res = await AuthService.login(credentials);
      setUser(res.user);
      setIsSessionExpiredModalOpen(false);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await AuthService.logout();
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshUser = async () => {
    if (AuthService.isAuthenticated()) {
      try {
        const profile = await AuthService.getMe();
        setUser(profile);
      } catch (err) {
        console.warn("Kullanıcı profili yenilenemedi:", err);
      }
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user && AuthService.isAuthenticated(),
        isLoading,
        login,
        logout,
        refreshUser,
        triggerSessionExpired,
      }}
    >
      {children}

      {/* Global Session Expired Modal */}
      <SessionExpiredModal
        show={isSessionExpiredModalOpen}
        onConfirm={handleSessionExpiredConfirm}
      />
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
