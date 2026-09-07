import crypto from "crypto";
import bcrypt from "bcryptjs";

const HASH_SECRET = process.env.JWT_ACCESS_SECRET || "kuyumcu_erp_secure_salt_2026";

/**
 * Hashes a plaintext password into a secure 28-30 character Base64 cryptographic hash
 * that fits perfectly in SQL Server varchar(30) without truncation.
 */
export const hashPassword = async (password: string): Promise<string> => {
  if (!password) return "";
  return crypto.createHmac("sha256", HASH_SECRET).update(password).digest("base64").substring(0, 30);
};

/**
 * Compares plaintext password with stored hash or plaintext
 */
export const comparePassword = async (password: string, storedHashOrPlain: string): Promise<boolean> => {
  if (!password || !storedHashOrPlain) return false;
  if (password === storedHashOrPlain) return true;

  // Compare HMAC-SHA256 hash
  const computed = crypto.createHmac("sha256", HASH_SECRET).update(password).digest("base64").substring(0, 30);
  if (computed === storedHashOrPlain) return true;

  // Fallback to bcrypt comparison if legacy hash
  try {
    return await bcrypt.compare(password, storedHashOrPlain);
  } catch {
    return false;
  }
};

