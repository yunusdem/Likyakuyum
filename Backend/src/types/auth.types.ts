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
}
