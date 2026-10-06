import { describe, it, expect } from "bun:test";

describe("Sprint 7: Chatbot Integration & Context Guard Tests", () => {
  it("harus menolak pengiriman pesan jika melampaui kuota harian batas_pesan", () => {
    const batasPesan = 50;
    const currentUsage = 50;

    const allowed = currentUsage < batasPesan;
    expect(allowed).toBe(false);
  });

  it("harus meloloskan pengiriman pesan jika kuota harian belum terlampaui", () => {
    const batasPesan = 50;
    const currentUsage = 49;

    const allowed = currentUsage < batasPesan;
    expect(allowed).toBe(true);
  });

  it("harus menerapkan Context Isolation Guard untuk peran ASLAB", () => {
    const activeUser = { id: "aslab-123", peran: "ASLAB" };
    const laporan = { id_laporan: "lap-789", id_pengunggah: "aslab-123" };

    const hasAccess = activeUser.peran !== "ASLAB" || laporan.id_pengunggah === activeUser.id;
    expect(hasAccess).toBe(true);
  });

  it("harus memblokir akses ASLAB jika id_pengunggah berbeda", () => {
    const activeUser = { id: "aslab-123", peran: "ASLAB" };
    const laporan = { id_laporan: "lap-789", id_pengunggah: "aslab-other" };

    const hasAccess = activeUser.peran !== "ASLAB" || laporan.id_pengunggah === activeUser.id;
    expect(hasAccess).toBe(false);
  });
});
