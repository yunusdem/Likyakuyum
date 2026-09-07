import jwt from "jsonwebtoken";
import { env } from "../config/env.config.js";
export const generateAccessToken = (payload) => {
    const options = {
        expiresIn: env.JWT_ACCESS_EXPIRES_IN,
    };
    return jwt.sign(payload, env.JWT_ACCESS_SECRET, options);
};
export const generateRefreshToken = (payload) => {
    const options = {
        expiresIn: env.JWT_REFRESH_EXPIRES_IN,
    };
    return jwt.sign(payload, env.JWT_REFRESH_SECRET, options);
};
export const generateAuthTokens = (payload) => {
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);
    return { accessToken, refreshToken };
};
export const verifyAccessToken = (token) => {
    return jwt.verify(token, env.JWT_ACCESS_SECRET);
};
export const verifyRefreshToken = (token) => {
    return jwt.verify(token, env.JWT_REFRESH_SECRET);
};
