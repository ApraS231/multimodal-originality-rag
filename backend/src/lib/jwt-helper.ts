import { SignJWT } from "jose";
import { CONFIG } from "../config";

export async function generateServiceToken(payload: Record<string, any>) {
  const secret = new TextEncoder().encode(CONFIG.JWT_SECRET);
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("2h")
    .sign(secret);
}
