import { Router } from "express";
import { AuthController } from "../controllers/auth.controller.js";
import { validate } from "../middlewares/validate.middleware.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authRateLimiter } from "../middlewares/rateLimiter.middleware.js";
import { loginSchema, registerSchema, refreshTokenSchema } from "../schemas/auth.schema.js";

const router = Router();

// Public Auth Endpoints
router.post("/login", authRateLimiter, validate(loginSchema), AuthController.login);
router.post("/register", authRateLimiter, validate(registerSchema), AuthController.register);
router.post("/refresh-token", validate(refreshTokenSchema), AuthController.refreshToken);

// Protected Auth Endpoints
router.post("/logout", authenticate, AuthController.logout);
router.get("/me", authenticate, AuthController.getMe);

export default router;
