import { describe, it, expect } from "bun:test";
import { encrypt, decrypt } from "../src/lib/crypto";

describe("Sprint 2: CRUD Data Master & Audit Trail Tests", () => {
  describe("AES-256-GCM Encryption", () => {
    it("harus mengenkripsi dan mendekripsi string dengan benar dan menghasilkan nilai yang sama", () => {
      const originalText = "my-secret-api-key-12345";
      
      const encrypted = encrypt(originalText);
      expect(encrypted).not.toBe(originalText);
      expect(encrypted).toContain(":"); // Format iv:authTag:encrypted

      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe(originalText);
    });

    it("harus mengembalikan string kosong untuk data input kosong", () => {
      expect(encrypt("")).toBe("");
      expect(decrypt("")).toBe("");
    });
  });
});
