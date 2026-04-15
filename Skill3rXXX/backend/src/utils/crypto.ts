/**
 * Encryption utilities using AES-256-GCM for sensitive field encryption
 * (e.g., PayPal emails, download URLs, ad placement codes).
 * The ENCRYPTION_KEY env var must be a 32-byte hex string.
 */
import crypto from "crypto";
import { config } from "../config";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;   // 96-bit IV for GCM
const AUTH_TAG_LENGTH = 16;

/**
 * Encrypts a plaintext string and returns a base64-encoded ciphertext
 * in the format:  iv:authTag:ciphertext
 */
export function encrypt(plaintext: string): string {
  const key = Buffer.from(config.encryption.key, "hex");
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    iv.toString("base64"),
    authTag.toString("base64"),
    encrypted.toString("base64"),
  ].join(":");
}

/**
 * Decrypts a string previously encrypted with encrypt().
 * Throws if the auth tag fails (tampered data).
 */
export function decrypt(ciphertext: string): string {
  const [ivB64, authTagB64, dataB64] = ciphertext.split(":");
  const key = Buffer.from(config.encryption.key, "hex");
  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(authTagB64, "base64");
  const data = Buffer.from(dataB64, "base64");

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

/**
 * Generates a cryptographically secure random token (hex string).
 */
export function generateToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString("hex");
}

/**
 * Constant-time string comparison to prevent timing attacks.
 */
export function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
