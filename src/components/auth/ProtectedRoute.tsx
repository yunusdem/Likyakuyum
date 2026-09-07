import React from "react";
import { Navigate, useLocation, Outlet } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { Spinner } from "react-bootstrap";
import { IconShieldLock } from "@tabler/icons-react";

interface ProtectedRouteProps {
  children?: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div
        className="d-flex flex-column align-items-center justify-content-center min-vh-100"
        style={{
          background: "radial-gradient(circle at 50% 50%, #1e293b 0%, #0f172a 100%)",
          color: "#f8fafc",
        }}
      >
        <div
          className="p-4 rounded-4 shadow-lg text-center"
          style={{
            background: "rgba(30, 41, 59, 0.7)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(212, 175, 55, 0.2)",
            maxWidth: "340px",
            width: "90%",
          }}
        >
          <div
            className="d-inline-flex p-3 rounded-circle mb-3"
            style={{
              background: "linear-gradient(135deg, rgba(212, 175, 55, 0.2) 0%, rgba(245, 158, 11, 0.1) 100%)",
              border: "1px solid rgba(212, 175, 55, 0.3)",
            }}
          >
            <img
              src="/images/logo/logo.svg"
              alt="Likya Kuyum Logo"
              style={{ width: "56px", height: "56px", objectFit: "contain" }}
            />
          </div>
          <div className="d-flex align-items-center justify-content-center gap-2 mb-2">
            <img
              src="/images/logo/logo.svg"
              alt="Logo"
              style={{ width: "26px", height: "26px", objectFit: "contain" }}
            />
            <h6 className="fw-bold mb-0" style={{ fontSize: "1.15rem" }}>
              <span className="brand-text-likya">Likya</span>{" "}
              <span className="brand-text-kuyum">Kuyum</span>
            </h6>
          </div>

          <p className="small text-muted mb-3">Güvenlik ve oturum doğrulanıyor...</p>
          <Spinner
            animation="border"
            size="sm"
            style={{ color: "#d4af37" }}
          />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    // Redirect to login, preserving intended route
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children ? <>{children}</> : <Outlet />;
};

export default ProtectedRoute;
