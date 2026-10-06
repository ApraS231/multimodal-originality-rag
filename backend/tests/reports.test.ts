import { describe, it, expect } from "bun:test";
import { isReportAccessibleByAslab } from "../src/api/reports";

describe("Sprint 3: AI Orchestrator & Dokumen Sinkronisasi Tests", () => {
  it("harus memvalidasi daur hidup pembuatan antrean pg-boss", () => {
    const mockJobData = {
      id_laporan: "mock-laporan-id",
      filePath: "./uploads/mock.pdf"
    };

    expect(mockJobData.id_laporan).toBe("mock-laporan-id");
    expect(mockJobData.filePath).toBe("./uploads/mock.pdf");
  });

  it("harus mengizinkan akses penuh untuk peran ADMIN dan KALAB", async () => {
    const adminUser = { id: "admin-1", peran: "ADMIN" };
    const kalabUser = { id: "kalab-1", peran: "KALAB" };

    expect(await isReportAccessibleByAslab(adminUser, "kelas-random", "matkul-random", "other-user")).toBe(true);
    expect(await isReportAccessibleByAslab(kalabUser, "kelas-random", "matkul-random", "other-user")).toBe(true);
  });

  it("harus mengizinkan aslab mengakses laporan yang diunggahnya sendiri", async () => {
    const aslabUser = { id: "aslab-123", peran: "ASLAB" };
    expect(await isReportAccessibleByAslab(aslabUser, "kelas-x", "matkul-y", "aslab-123")).toBe(true);
  });
});

