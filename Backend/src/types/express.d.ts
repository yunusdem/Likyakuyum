import { JwtPayload } from "./auth.types.js";
import { AdminBaglam } from "./admin.types.js";

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
      accessToken?: string;
      admin?: AdminBaglam;
    }
  }
}

export {};
