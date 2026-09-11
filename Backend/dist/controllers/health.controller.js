import { ApiResponse } from "../utils/ApiResponse.js";
import { ResponseMessages } from "../constants/responseMessages.js";
import { env } from "../config/env.config.js";
export class HealthController {
    static check = (req, res) => {
        return ApiResponse.ok(res, ResponseMessages.HEALTH_CHECK_OK, {
            status: "healthy",
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            environment: env.NODE_ENV,
            version: "1.0.0",
        });
    };
}
