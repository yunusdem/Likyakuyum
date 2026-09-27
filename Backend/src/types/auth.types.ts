import { UserRoleType } from "../constants/roles.js";
import { UserResponseDto } from "./user.types.js";

export interface JwtPayload {
  userId: string;
  username: string;
  role: UserRoleType;
  cashierCode?: string;
  dbServer?: string;
  dbName?: string;
  dbUser?: string;
  dbPassword?: string;
  /** Merkez (LIKYA_ADMIN) oturum kimliği; MERKEZ_GIRIS=zorunlu iken her istekte doğrulanır */
  sid?: string;
  /** Müşteri no ile girişte seçilen firma (LIKYA_ADMIN.ADM_FIRMA). Varsa DB bağlantısı her istekte buradan çözülür. */
  firmaId?: number;
  iat?: number;
  exp?: number;
}


export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponseData {
  user: UserResponseDto;
  tokens: TokenPair;
  /** Bağlanılan sunucu ve veritabanı adı (şifre yok) — ekranda gösterim için */
  baglanti?: { dbServer: string; dbName: string };
}
