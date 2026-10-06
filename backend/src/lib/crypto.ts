import crypto from "crypto";
import { CONFIG } from "../config";

const ENCRYPTION_KEY = crypto
  .createHash("sha256")
  .update(CONFIG.JWT_SECRET)
  .digest();

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

export function encrypt(text: string): string {
  if (!text) return "";
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");
  return `${iv.toString("hex")}:${authTag}:${encrypted}`;
}

export function decrypt(encryptedText: string): string {
  if (!encryptedText) return "";
  const parts = encryptedText.split(":");
  if (parts.length !== 3) return "";
  const iv = Buffer.from(parts[0] as string, "hex");
  const authTag = Buffer.from(parts[1] as string, "hex");
  const encrypted = parts[2] as string;
  const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encrypted, "hex", "utf8") as string;
  decrypted += decipher.final("utf8") as string;
  return decrypted;
}
