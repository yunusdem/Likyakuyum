import { JwtPayload } from "./auth.types.js";

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
      accessToken?: string;
    }
  }
}

export {};
