import { describe, it, expect } from "bun:test";
import { defineRulesFor } from "../src/lib/ability";
import { sessionCache } from "../src/lib/cache";

describe("Sprint 1: Autentikasi & Otorisasi Tests", () => {
  describe("CASL Ability Rules", () => {
    it("harus memberikan izin penuh (manage, all) kepada peran ADMIN", () => {
      const profil = { peran: "ADMIN" };
      const rules = defineRulesFor(profil);
      expect(rules).toContainEqual({ action: "manage", subject: "all" });
    });

    it("harus memberikan izin read, create, update laporan kepada peran ASLAB", () => {
      const profil = { peran: "ASLAB" };
      const rules = defineRulesFor(profil);
      expect(rules).toContainEqual({ action: "read", subject: "Laporan" });
      expect(rules).toContainEqual({ action: "create", subject: "Laporan" });
      expect(rules).toContainEqual({ action: "update", subject: "Laporan" });
      expect(rules).not.toContainEqual({ action: "manage", subject: "AdminPanel" });
    });

    it("harus memberikan izin read-only (read laporan, read summary) kepada peran KEPALA_LAB", () => {
      const profil = { peran: "KEPALA_LAB" };
      const rules = defineRulesFor(profil);
      expect(rules).toContainEqual({ action: "read", subject: "Laporan" });
      expect(rules).toContainEqual({ action: "read", subject: "Summary" });
      expect(rules).not.toContainEqual({ action: "create", subject: "Laporan" });
      expect(rules).not.toContainEqual({ action: "update", subject: "Laporan" });
    });
  });

  describe("In-Memory LRU Cache", () => {
    it("harus menyimpan dan mengeluarkan data cache sesi dengan benar", () => {
      const sessionId = "mock-session-id";
      const sessionData = { user: { email: "test@stitek.ac.id", nama: "Alvin" } };

      sessionCache.set(sessionId, sessionData);
      const cached = sessionCache.get(sessionId);

      expect(cached).toEqual(sessionData);

      sessionCache.delete(sessionId);
      expect(sessionCache.get(sessionId)).toBeUndefined();
    });
  });
});
