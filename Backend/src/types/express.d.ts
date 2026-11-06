import { JwtPayload } from "./auth.types.js";
import { AdminBaglam } from "./admin.types.js";
import { PersonelBaglam } from "./destekPanel.types.js";
import { MobilBaglam } from "./mobil.types.js";

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
      accessToken?: string;
      admin?: AdminBaglam;
      personel?: PersonelBaglam;
      /** Mobil cari oturumu (docs/MOBIL_CARI_YOL_HARITASI.md) */
      mobil?: MobilBaglam;
    }
  }
}

export {};
