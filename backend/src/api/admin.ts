import { Elysia, t } from "elysia";
import { jwt } from "@elysiajs/jwt";
import { prisma } from "../db/prisma";
import { checkAbility } from "./auth-guard";
import { systemConfigCache } from "../lib/cache";
import { encrypt } from "../lib/crypto";
import { CONFIG } from "../config";
import { generateServiceToken } from "../lib/jwt-helper";

async function logAdminActivity(
  actorId: string,
  actionType: string,
  targetEntity: string,
  description: string,
  headers: Record<string, string | undefined>
) {
  const ipAddress = headers["x-forwarded-for"] || "127.0.0.1";
  const userAgent = headers["user-agent"] || "Unknown";
  await prisma.aktivitasAdmin.create({
    data: {
      id_aktor: actorId,
      jenis_tindakan: actionType,
      entitas_target: targetEntity,
      deskripsi: description,
      alamat_ip: ipAddress,
      agen_pengguna: userAgent
    }
  });
}

async function initializeDefaultConfig() {
  return await prisma.konfigurasiSistem.upsert({
    where: { id_konfigurasi: "global" },
    update: {},
    create: {
      id_konfigurasi: "global",
      nama_model_ai: "groq/llama3-8b-8192",
      prompt_sistem: "Anda adalah asisten akademik yang memvalidasi orisinalitas laporan praktikum STITEK Bontang.",
      rrf_k: 60,
      batas_unggahan: 30,
      batas_pesan: 50
    }
  });
}

export const adminRouter = new Elysia({ prefix: "/api/admin" })
  .use(
    jwt({
      name: "jwt",
      secret: CONFIG.JWT_SECRET
    })
  )
  // Program Studi CRUD
  .get("/prodi", async () => {
    return await prisma.programStudi.findMany();
  })
  .post(
    "/prodi",
    async ({ body, headers, activeUser }: any) => {
      const prodi = await prisma.programStudi.create({
        data: { nama_prodi: body.nama_prodi }
      });
      await logAdminActivity(
        activeUser.id,
        "CREATE",
        "PROGRAM_STUDI",
        `Menambahkan Program Studi baru: ${body.nama_prodi}`,
        headers
      );
      return prodi;
    },
    {
      beforeHandle: checkAbility("create", "Prodi"),
      body: t.Object({
        nama_prodi: t.String()
      })
    }
  )
  .put(
    "/prodi/:id",
    async ({ params, body, headers, activeUser }: any) => {
      const { id } = params;
      const prodi = await prisma.programStudi.update({
        where: { id_program_studi: id },
        data: { nama_prodi: body.nama_prodi }
      });
      await logAdminActivity(
        activeUser.id,
        "UPDATE",
        "PROGRAM_STUDI",
        `Memperbarui Program Studi ID ${id} menjadi: ${body.nama_prodi}`,
        headers
      );
      return prodi;
    },
    {
      beforeHandle: checkAbility("update", "Prodi"),
      body: t.Object({
        nama_prodi: t.String()
      })
    }
  )
  .delete(
    "/prodi/:id",
    async ({ params, headers, activeUser }: any) => {
      const { id } = params;
      const prodi = await prisma.programStudi.delete({
        where: { id_program_studi: id }
      });
      await logAdminActivity(
        activeUser.id,
        "DELETE",
        "PROGRAM_STUDI",
        `Menghapus Program Studi: ${prodi.nama_prodi} (ID: ${id})`,
        headers
      );
      return { success: true };
    },
    {
      beforeHandle: checkAbility("delete", "Prodi")
    }
  )

  // Kelas CRUD
  .get("/kelas", async () => {
    return await prisma.kelas.findMany({
      include: { prodi: true }
    });
  })
  .post(
    "/kelas",
    async ({ body, headers, activeUser }: any) => {
      const kelas = await prisma.kelas.create({
        data: {
          nama_kelas: body.nama_kelas,
          id_program_studi: body.id_program_studi
        }
      });
      await logAdminActivity(
        activeUser.id,
        "CREATE",
        "KELAS",
        `Menambahkan kelas baru: ${body.nama_kelas} di Prodi ID ${body.id_program_studi}`,
        headers
      );
      return kelas;
    },
    {
      beforeHandle: checkAbility("create", "Kelas"),
      body: t.Object({
        nama_kelas: t.String(),
        id_program_studi: t.String()
      })
    }
  )
  .put(
    "/kelas/:id",
    async ({ params, body, headers, activeUser }: any) => {
      const { id } = params;
      const kelas = await prisma.kelas.update({
        where: { id_kelas: id },
        data: {
          nama_kelas: body.nama_kelas,
          id_program_studi: body.id_program_studi
        }
      });
      await logAdminActivity(
        activeUser.id,
        "UPDATE",
        "KELAS",
        `Memperbarui kelas ID ${id} menjadi: ${body.nama_kelas}`,
        headers
      );
      return kelas;
    },
    {
      beforeHandle: checkAbility("update", "Kelas"),
      body: t.Object({
        nama_kelas: t.String(),
        id_program_studi: t.String()
      })
    }
  )
  .delete(
    "/kelas/:id",
    async ({ params, headers, activeUser }: any) => {
      const { id } = params;
      const kelas = await prisma.kelas.delete({
        where: { id_kelas: id }
      });
      await logAdminActivity(
        activeUser.id,
        "DELETE",
        "KELAS",
        `Menghapus kelas: ${kelas.nama_kelas} (ID: ${id})`,
        headers
      );
      return { success: true };
    },
    {
      beforeHandle: checkAbility("delete", "Kelas")
    }
  )

  // Mata Kuliah CRUD dengan Agregasi Data Aslab & Laporan Terkumpul
  .get("/matkul", async () => {
    const matkulList = await prisma.mataKuliah.findMany({
      include: {
        matkul_aslab: {
          include: {
            profil: {
              include: {
                pengguna: {
                  select: {
                    id: true,
                    nama: true,
                    email: true,
                  }
                }
              }
            }
          }
        },
        laporan: {
          select: {
            id_laporan: true,
            nama_mahasiswa: true,
            nim: true,
            skor_orisinalitas: true,
            skor_plagiarisme: true,
            apakah_diverifikasi: true,
            status: true,
            tanggal_dibuat: true,
          },
          orderBy: {
            tanggal_dibuat: "desc"
          }
        }
      },
      orderBy: { nama_matkul: "asc" }
    });

    return matkulList.map((m) => {
      const aslabList = m.matkul_aslab.map((ma) => ({
        id_profil: ma.profil.id_profil,
        id_pengguna: ma.profil.pengguna.id,
        nama: ma.profil.pengguna.nama,
        email: ma.profil.pengguna.email,
        kode_aslab: ma.profil.kode_aslab,
        nim: ma.profil.nim,
      }));

      const totalLaporan = m.laporan.length;
      const laporanDiverifikasi = m.laporan.filter((l) => l.apakah_diverifikasi).length;
      const laporanMenunggu = totalLaporan - laporanDiverifikasi;
      
      const totalSkor = m.laporan.reduce((acc, l) => acc + Number(l.skor_orisinalitas || 0), 0);
      const rerataOrisinalitas = totalLaporan > 0 ? Number((totalSkor / totalLaporan).toFixed(1)) : 0;

      return {
        id_mata_kuliah: m.id_mata_kuliah,
        nama_matkul: m.nama_matkul,
        aslab: aslabList,
        ringkasan_laporan: {
          total: totalLaporan,
          diverifikasi: laporanDiverifikasi,
          menunggu: laporanMenunggu,
          rerata_orisinalitas: rerataOrisinalitas,
        },
        laporan_terbaru: m.laporan.slice(0, 5)
      };
    });
  })
  .post(
    "/matkul",
    async ({ body, headers, activeUser }: any) => {
      const matkul = await prisma.mataKuliah.create({
        data: { nama_matkul: body.nama_matkul }
      });
      await logAdminActivity(
        activeUser.id,
        "CREATE",
        "MATA_KULIAH",
        `Menambahkan Mata Kuliah baru: ${body.nama_matkul}`,
        headers
      );
      return matkul;
    },
    {
      beforeHandle: checkAbility("create", "Matkul"),
      body: t.Object({
        nama_matkul: t.String()
      })
    }
  )
  .put(
    "/matkul/:id",
    async ({ params, body, headers, activeUser }: any) => {
      const { id } = params;
      const matkul = await prisma.mataKuliah.update({
        where: { id_mata_kuliah: id },
        data: { nama_matkul: body.nama_matkul }
      });
      await logAdminActivity(
        activeUser.id,
        "UPDATE",
        "MATA_KULIAH",
        `Memperbarui Mata Kuliah ID ${id} menjadi: ${body.nama_matkul}`,
        headers
      );
      return matkul;
    },
    {
      beforeHandle: checkAbility("update", "Matkul"),
      body: t.Object({
        nama_matkul: t.String()
      })
    }
  )
  .delete(
    "/matkul/:id",
    async ({ params, headers, activeUser }: any) => {
      const { id } = params;
      const matkul = await prisma.mataKuliah.delete({
        where: { id_mata_kuliah: id }
      });
      await logAdminActivity(
        activeUser.id,
        "DELETE",
        "MATA_KULIAH",
        `Menghapus Mata Kuliah: ${matkul.nama_matkul} (ID: ${id})`,
        headers
      );
      return { success: true };
    },
    {
      beforeHandle: checkAbility("delete", "Matkul")
    }
  )

  // Konfigurasi AI & System Config
  .get(
    "/config",
    async () => {
      const config = (await prisma.konfigurasiSistem.findFirst({ where: { id_konfigurasi: "global" } })) || (await initializeDefaultConfig());
      return {
        ...config,
        kunci_api_gemini: config.kunci_api_gemini ? "AIzaSy••••" : null,
        kunci_api_openai: config.kunci_api_openai ? "sk-••••" : null,
        kunci_api_groq: config.kunci_api_groq ? "gsk_••••" : null,
        kunci_api_supabase: config.kunci_api_supabase ? "sb_••••" : null
      };
    },
    {
      beforeHandle: checkAbility("read", "Config")
    }
  )
  .patch(
    "/config",
    async ({ body, headers, activeUser, jwt }: any) => {
      const encryptedData: any = {};
      
      if (body.nama_model_ai !== undefined) encryptedData.nama_model_ai = body.nama_model_ai;
      if (body.rrf_k !== undefined) encryptedData.rrf_k = parseInt(body.rrf_k);
      if (body.prompt_sistem !== undefined) encryptedData.prompt_sistem = body.prompt_sistem;
      if (body.batas_unggahan !== undefined) encryptedData.batas_unggahan = parseInt(body.batas_unggahan);
      if (body.batas_pesan !== undefined) encryptedData.batas_pesan = parseInt(body.batas_pesan);
      if (body.tautan_supabase !== undefined) encryptedData.tautan_supabase = body.tautan_supabase;

      if (body.kunci_api_gemini) encryptedData.kunci_api_gemini = encrypt(body.kunci_api_gemini);
      if (body.kunci_api_openai) encryptedData.kunci_api_openai = encrypt(body.kunci_api_openai);
      if (body.kunci_api_groq) encryptedData.kunci_api_groq = encrypt(body.kunci_api_groq);
      if (body.kunci_api_supabase) encryptedData.kunci_api_supabase = encrypt(body.kunci_api_supabase);
      if (body.kunci_kustom !== undefined) encryptedData.kunci_kustom = body.kunci_kustom;

      const updatedConfig = await prisma.konfigurasiSistem.upsert({
        where: { id_konfigurasi: "global" },
        update: encryptedData,
        create: { id_konfigurasi: "global", ...encryptedData }
      });

      // Evict cache
      systemConfigCache.delete("global");

      // Sync ke FastAPI Core AI Service
      const token = await jwt.sign({
        userId: activeUser.id,
        role: "ADMIN",
        scope: "config_sync"
      });

      try {
        await fetch(`${CONFIG.FASTAPI_SERVICE_URL}/api/v1/config/sync`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify(encryptedData)
        });
      } catch (err) {
        console.error("Gagal melakukan sinkronisasi ke FastAPI AI Service:", err);
      }

      // Log Audit Trail
      await logAdminActivity(
        activeUser.id,
        "UPDATE",
        "CONFIG",
        `Memperbarui konfigurasi sistem global`,
        headers
      );

      return { success: true };
    },
    {
      beforeHandle: checkAbility("update", "Config"),
      body: t.Object({
        nama_model_ai: t.Optional(t.String()),
        rrf_k: t.Optional(t.Numeric()),
        prompt_sistem: t.Optional(t.String()),
        batas_unggahan: t.Optional(t.Numeric()),
        batas_pesan: t.Optional(t.Numeric()),
        tautan_supabase: t.Optional(t.String()),
        kunci_api_gemini: t.Optional(t.String()),
        kunci_api_openai: t.Optional(t.String()),
        kunci_api_groq: t.Optional(t.String()),
        kunci_api_supabase: t.Optional(t.String()),
        kunci_kustom: t.Optional(t.Any())
      })
    }
  )

  // Stuck queue monitoring & force-fail
  .get(
    "/queue/stuck",
    async () => {
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
      return await prisma.laporan.findMany({
        where: {
          status: { in: ["QUEUED", "PROCESSING"] },
          tanggal_dibuat: { lt: tenMinutesAgo }
        },
        include: {
          pengunggah: true,
          prodi: true,
          kelas: true,
          matkul: true
        }
      });
    },
    {
      beforeHandle: checkAbility("read", "Queue")
    }
  )
  .post(
    "/queue/force-fail",
    async ({ body, headers, activeUser }: any) => {
      const { id_laporan } = body;
      const updated = await prisma.laporan.update({
        where: { id_laporan },
        data: { status: "FAILED" }
      });
      await logAdminActivity(
        activeUser.id,
        "FORCE_FAIL",
        "LAPORAN",
        `Membatalkan secara paksa laporan ID ${id_laporan} yang tertahan.`,
        headers
      );
      return { success: true, data: updated };
    },
    {
      beforeHandle: checkAbility("update", "Queue"),
      body: t.Object({
        id_laporan: t.String()
      })
    }
  )

  // Analitik Biaya & Token LLM
  .get(
    "/analytics",
    async () => {
      const summary = await prisma.penggunaanToken.aggregate({
        _sum: {
          token_input: true,
          token_output: true,
          total_token: true,
          estimasi_biaya: true
        },
        _count: {
          id_penggunaan_token: true
        }
      });

      const prodiCost = await prisma.penggunaanToken.groupBy({
        by: ["id_program_studi"],
        _sum: {
          estimasi_biaya: true
        }
      });

      const prodiList = await prisma.programStudi.findMany();
      const prodiMap = new Map(prodiList.map(p => [p.id_program_studi, p.nama_prodi]));

      const prodiCostFormatted = prodiCost.map(pc => ({
        id_program_studi: pc.id_program_studi,
        nama_prodi: prodiMap.get(pc.id_program_studi) || "Unknown",
        total_biaya: pc._sum.estimasi_biaya || 0
      }));

      // Agregasi tren biaya 7 hari terakhir secara riil dari database
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      sevenDaysAgo.setHours(0, 0, 0, 0);

      const recentTokens = await prisma.penggunaanToken.findMany({
        where: {
          tanggal_dibuat: {
            gte: sevenDaysAgo
          }
        },
        select: {
          estimasi_biaya: true,
          tanggal_dibuat: true
        },
        orderBy: {
          tanggal_dibuat: "asc"
        }
      });

      const daysOfWeek = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
      const dailyMap = new Map<string, number>();

      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dayName = daysOfWeek[d.getDay()] || "";
        dailyMap.set(dayName, 0);
      }

      for (const tok of recentTokens) {
        const dayName = daysOfWeek[new Date(tok.tanggal_dibuat).getDay()] || "";
        if (dailyMap.has(dayName)) {
          const current = dailyMap.get(dayName) || 0;
          dailyMap.set(dayName, current + Number(tok.estimasi_biaya));
        }
      }

      const dailyCostTrend = Array.from(dailyMap.entries()).map(([name, cost]) => ({
        name,
        Biaya: Number(cost.toFixed(4))
      }));

      return {
        summary: {
          token_input: summary._sum.token_input || 0,
          token_output: summary._sum.token_output || 0,
          total_token: summary._sum.total_token || 0,
          estimasi_biaya: summary._sum.estimasi_biaya || 0,
          total_laporan_dianalisis: summary._count.id_penggunaan_token || 0
        },
        prodi_cost: prodiCostFormatted,
        daily_cost_trend: dailyCostTrend
      };
    },
    {
      beforeHandle: checkAbility("read", "Summary")
    }
  )

  // Audit Logs Histori Aktivitas
  .get(
    "/audit-logs",
    async ({ query }) => {
      const search = (query.search ?? "") as string;
      const action = (query.action ?? "") as string;
      const startDate = (query.startDate ?? "") as string;
      const endDate = (query.endDate ?? "") as string;
      const page = query.page ? parseInt(query.page as string) : 1;
      const limit = query.limit ? parseInt(query.limit as string) : 10;

      const where: any = {};

      if (search) {
        where.deskripsi = {
          contains: search,
          mode: "insensitive"
        };
      }

      if (action) {
        where.jenis_tindakan = action;
      }

      if (startDate || endDate) {
        where.tanggal_dibuat = {};
        if (startDate) {
          where.tanggal_dibuat.gte = new Date(startDate);
        }
        if (endDate) {
          where.tanggal_dibuat.lte = new Date(endDate);
        }
      }

      const total = await prisma.aktivitasAdmin.count({ where });

      const logs = await prisma.aktivitasAdmin.findMany({
        where,
        include: {
          aktor: {
            select: {
              id: true,
              nama: true,
              email: true
            }
          }
        },
        orderBy: {
          tanggal_dibuat: "desc"
        },
        skip: (page - 1) * limit,
        take: limit
      });

      return {
        total,
        page,
        limit,
        total_pages: Math.ceil(total / limit),
        data: logs
      };
    },
    {
      beforeHandle: checkAbility("read", "AuditLog"),
      query: t.Object({
        search: t.Optional(t.String()),
        action: t.Optional(t.String()),
        startDate: t.Optional(t.String()),
        endDate: t.Optional(t.String()),
        page: t.Optional(t.String()),
        limit: t.Optional(t.String())
      })
    }
  )

  .post(
    "/fine-tune",
    async ({ body, headers, activeUser, set }: any) => {
      const { epochs, batchSize, id_mata_kuliah } = body;

      const token = await generateServiceToken({
        userId: activeUser.id,
        role: "ADMIN",
        scope: "fine_tune_trigger"
      });

      try {
        const queryParam = id_mata_kuliah ? `?id_mata_kuliah=${encodeURIComponent(id_mata_kuliah)}` : "";
        const response = await fetch(`${CONFIG.FASTAPI_SERVICE_URL}/api/v1/model/fine-tune${queryParam}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify({
            epochs: epochs ? parseInt(String(epochs)) : undefined,
            batch_size: batchSize ? parseInt(String(batchSize)) : undefined,
            id_mata_kuliah: id_mata_kuliah || undefined
          })
        });

        if (!response.ok) {
          const errorText = await response.text();
          set.status = response.status;
          return { error: `Gagal memicu fine-tuning di AI Service: ${errorText}` };
        }

        const data = await response.json() as any;

        await logAdminActivity(
          activeUser.id,
          "TRIGGER",
          "MODEL_FINE_TUNE",
          `Memicu pelatihan ulang model Sentence-BERT (Mata Kuliah: ${id_mata_kuliah || "Global"}, Epochs: ${epochs || "default"}, Batch Size: ${batchSize || "default"})`,
          headers
        );

        return { success: true, taskId: data.task_id || data.job_id || "started", message: data.message || "Fine-tuning model SBERT berhasil dipicu di latar belakang." };
      } catch (err: any) {
        set.status = 500;
        return { error: `Gagal menghubungi AI Service: ${err.message}` };
      }
    },
    {
      beforeHandle: checkAbility("create", "FineTune"),
      body: t.Object({
        epochs: t.Optional(t.Union([t.String(), t.Number()])),
        batchSize: t.Optional(t.Union([t.String(), t.Number()])),
        id_mata_kuliah: t.Optional(t.String())
      })
    }
  )

  .post(
    "/cross-check",
    async ({ body, headers, activeUser, set }: any) => {
      const { id_mata_kuliah, similarity_threshold } = body;

      const token = await generateServiceToken({
        userId: activeUser.id,
        role: "ADMIN",
        scope: "cross_check"
      });

      try {
        const response = await fetch(`${CONFIG.FASTAPI_SERVICE_URL}/api/v1/cross-check`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify({
            id_mata_kuliah,
            similarity_threshold: similarity_threshold !== undefined ? parseFloat(similarity_threshold) : 0.85
          })
        });

        if (!response.ok) {
          const errorText = await response.text();
          set.status = response.status;
          return { error: `Gagal menjalankan cross-check di AI Service: ${errorText}` };
        }

        const data = await response.json() as any;

        await logAdminActivity(
          activeUser.id,
          "ANALYZE",
          "CROSS_COLLUSION",
          `Menjalankan analisis silang (cross-collusion) untuk mata kuliah ${id_mata_kuliah}`,
          headers
        );

        return data;
      } catch (err: any) {
        set.status = 500;
        return { error: `Gagal menghubungi AI Service: ${err.message}` };
      }
    },
    {
      beforeHandle: checkAbility("read", "Laporan"),
      body: t.Object({
        id_mata_kuliah: t.String(),
        similarity_threshold: t.Optional(t.Numeric())
      })
    }
  )

  // ═══════════════════════════════════════════════════
  // USER MANAGEMENT ENDPOINTS
  // ═══════════════════════════════════════════════════
  .get("/users", async () => {
    return await prisma.pengguna.findMany({
      include: {
        profil: {
          include: {
            kelas_aslab: {
              include: { kelas: true }
            },
            matkul_aslab: {
              include: { matkul: true }
            }
          }
        }
      },
      orderBy: {
        tanggal_dibuat: "desc"
      }
    });
  }, {
    beforeHandle: checkAbility("manage", "all")
  })

  .post("/users/:id/assignments", async ({ params, body, headers, activeUser, set }: any) => {
    const { id } = params;
    const { kelasIds, matkulIds } = body;

    const existingUser = await prisma.pengguna.findUnique({
      where: { id },
      include: { profil: true }
    });

    if (!existingUser || !existingUser.profil) {
      set.status = 404;
      return { error: "Pengguna atau profil tidak ditemukan." };
    }

    const idProfil = existingUser.profil.id_profil;

    await prisma.$transaction([
      prisma.kelasAslab.deleteMany({
        where: { id_profil: idProfil }
      }),
      prisma.matkulAslab.deleteMany({
        where: { id_profil: idProfil }
      }),
      ...(kelasIds && kelasIds.length > 0 ? [
        prisma.kelasAslab.createMany({
          data: kelasIds.map((id_kelas: string) => ({
            id_profil: idProfil,
            id_kelas
          }))
        })
      ] : []),
      ...(matkulIds && matkulIds.length > 0 ? [
        prisma.matkulAslab.createMany({
          data: matkulIds.map((id_mata_kuliah: string) => ({
            id_profil: idProfil,
            id_mata_kuliah
          }))
        })
      ] : [])
    ]);

    await logAdminActivity(
      activeUser.id,
      "UPDATE",
      "ASSIGNMENT",
      `Memperbarui penugasan bimbingan untuk Aslab: ${existingUser.nama} (${kelasIds?.length || 0} kelas, ${matkulIds?.length || 0} matkul)`,
      headers
    );

    const updatedUser = await prisma.pengguna.findUnique({
      where: { id },
      include: {
        profil: {
          include: {
            kelas_aslab: {
              include: { kelas: true }
            },
            matkul_aslab: {
              include: { matkul: true }
            }
          }
        }
      }
    });

    return {
      success: true,
      message: "Penugasan asisten laboratorium berhasil diperbarui secara permanen.",
      user: updatedUser
    };
  }, {
    beforeHandle: checkAbility("manage", "all"),
    body: t.Object({
      kelasIds: t.Array(t.String()),
      matkulIds: t.Array(t.String())
    })
  })

  .post("/users", async ({ body, headers, activeUser, set }: any) => {
    const { email, kata_sandi, nama, peran, nim, kode_aslab, kode_kalab } = body;

    const existingUser = await prisma.pengguna.findUnique({
      where: { email }
    });

    if (existingUser) {
      set.status = 400;
      return { error: "Email sudah digunakan oleh pengguna lain." };
    }

    const hashed = await Bun.password.hash(kata_sandi);

    const newUser = await prisma.$transaction(async (tx) => {
      const user = await tx.pengguna.create({
        data: {
          email,
          kata_sandi: hashed,
          nama
        }
      });

      const profile = await tx.profilPengguna.create({
        data: {
          id_pengguna: user.id,
          peran,
          nim: nim || null,
          kode_aslab: kode_aslab || null,
          kode_kalab: kode_kalab || null
        }
      });

      return { ...user, profil: profile };
    });

    await logAdminActivity(
      activeUser.id,
      "CREATE",
      "USER",
      `Membuat pengguna baru: ${nama} (${email}) dengan peran: ${peran}`,
      headers
    );

    return newUser;
  }, {
    beforeHandle: checkAbility("manage", "all"),
    body: t.Object({
      email: t.String({ format: "email" }),
      kata_sandi: t.String(),
      nama: t.String(),
      peran: t.String(),
      nim: t.Optional(t.Nullable(t.String())),
      kode_aslab: t.Optional(t.Nullable(t.String())),
      kode_kalab: t.Optional(t.Nullable(t.String()))
    })
  })

  .put("/users/:id", async ({ params, body, headers, activeUser, set }: any) => {
    const { id } = params;
    const { email, kata_sandi, nama, peran, nim, kode_aslab, kode_kalab } = body;

    const existingUser = await prisma.pengguna.findUnique({
      where: { id }
    });

    if (!existingUser) {
      set.status = 404;
      return { error: "Pengguna tidak ditemukan." };
    }

    // Periksa keunikan email baru
    if (email !== existingUser.email) {
      const emailConflict = await prisma.pengguna.findUnique({
        where: { email }
      });
      if (emailConflict) {
        set.status = 400;
        return { error: "Email sudah digunakan oleh pengguna lain." };
      }
    }

    const updatedUser = await prisma.$transaction(async (tx) => {
      const updateData: any = { email, nama };
      if (kata_sandi && kata_sandi.trim() !== "") {
        updateData.kata_sandi = await Bun.password.hash(kata_sandi);
      }

      const user = await tx.pengguna.update({
        where: { id },
        data: updateData
      });

      const profile = await tx.profilPengguna.upsert({
        where: { id_pengguna: id },
        update: {
          peran,
          nim: nim || null,
          kode_aslab: kode_aslab || null,
          kode_kalab: kode_kalab || null
        },
        create: {
          id_pengguna: id,
          peran,
          nim: nim || null,
          kode_aslab: kode_aslab || null,
          kode_kalab: kode_kalab || null
        }
      });

      return { ...user, profil: profile };
    });

    await logAdminActivity(
      activeUser.id,
      "UPDATE",
      "USER",
      `Memperbarui data pengguna ID ${id}: ${nama} (${email})`,
      headers
    );

    return updatedUser;
  }, {
    beforeHandle: checkAbility("manage", "all"),
    body: t.Object({
      email: t.String({ format: "email" }),
      kata_sandi: t.Optional(t.Nullable(t.String())),
      nama: t.String(),
      peran: t.String(),
      nim: t.Optional(t.Nullable(t.String())),
      kode_aslab: t.Optional(t.Nullable(t.String())),
      kode_kalab: t.Optional(t.Nullable(t.String()))
    })
  })

  .delete("/users/:id", async ({ params, headers, activeUser, set }: any) => {
    const { id } = params;

    const existingUser = await prisma.pengguna.findUnique({
      where: { id }
    });

    if (!existingUser) {
      set.status = 404;
      return { error: "Pengguna tidak ditemukan." };
    }

    // Cegah admin menghapus dirinya sendiri
    if (id === activeUser.id) {
      set.status = 400;
      return { error: "Anda tidak dapat menghapus akun Anda sendiri." };
    }

    await prisma.pengguna.delete({
      where: { id }
    });

    await logAdminActivity(
      activeUser.id,
      "DELETE",
      "USER",
      `Menghapus pengguna: ${existingUser.nama} (${existingUser.email})`,
      headers
    );

    return { success: true };
  }, {
    beforeHandle: checkAbility("manage", "all")
  })

  .put("/users/:id/approve", async ({ params, headers, activeUser, set }: any) => {
    const { id } = params;

    const profil = await prisma.profilPengguna.findFirst({
      where: { id_pengguna: id }
    });

    if (!profil) {
      set.status = 404;
      return { error: "Profil pengguna tidak ditemukan." };
    }

    const updated = await prisma.profilPengguna.update({
      where: { id_profil: profil.id_profil },
      data: { status_persetujuan: "APPROVED" }
    });

    await logAdminActivity(
      activeUser.id,
      "APPROVE",
      "USER",
      `Menyetujui akses akun asisten laboratorium ID ${id}`,
      headers
    );

    return { success: true, data: updated };
  }, {
    beforeHandle: checkAbility("manage", "all")
  })

  .put("/users/:id/reject", async ({ params, headers, activeUser, set }: any) => {
    const { id } = params;

    const profil = await prisma.profilPengguna.findFirst({
      where: { id_pengguna: id }
    });

    if (!profil) {
      set.status = 404;
      return { error: "Profil pengguna tidak ditemukan." };
    }

    const updated = await prisma.profilPengguna.update({
      where: { id_profil: profil.id_profil },
      data: { status_persetujuan: "REJECTED" }
    });

    await logAdminActivity(
      activeUser.id,
      "REJECT",
      "USER",
      `Menolak akses akun asisten laboratorium ID ${id}`,
      headers
    );

    return { success: true, data: updated };
  }, {
    beforeHandle: checkAbility("manage", "all")
  })

  // Prototypical Network Proxy Endpoints
  .post(
    "/proto/train",
    async ({ body, set }: any) => {
      const { id_mata_kuliah, epochs } = body;
      const token = await generateServiceToken({ role: "ADMIN", scope: "admin" });
      const res = await fetch(`${CONFIG.FASTAPI_SERVICE_URL}/api/v1/proto/train`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ id_mata_kuliah, epochs })
      });
      const data = await res.json();
      if (!res.ok) {
        set.status = res.status;
      }
      return data;
    },
    {
      beforeHandle: checkAbility("manage", "all"),
      body: t.Object({
        id_mata_kuliah: t.String(),
        epochs: t.Optional(t.Number())
      })
    }
  )

  .get(
    "/proto/status/:id_mata_kuliah",
    async ({ params, set }: any) => {
      const { id_mata_kuliah } = params;
      const token = await generateServiceToken({ role: "ADMIN", scope: "admin" });
      const res = await fetch(`${CONFIG.FASTAPI_SERVICE_URL}/api/v1/proto/status/${id_mata_kuliah}`, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (!res.ok) {
        set.status = res.status;
      }
      return data;
    },
    {
      beforeHandle: checkAbility("manage", "all")
    }
  )

  .post(
    "/proto/classify",
    async ({ body, set }: any) => {
      const { text, id_mata_kuliah } = body;
      const token = await generateServiceToken({ role: "ADMIN", scope: "admin" });
      const res = await fetch(`${CONFIG.FASTAPI_SERVICE_URL}/api/v1/proto/classify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ text, id_mata_kuliah })
      });
      const data = await res.json();
      if (!res.ok) {
        set.status = res.status;
      }
      return data;
    },
    {
      beforeHandle: checkAbility("manage", "all"),
      body: t.Object({
        text: t.String(),
        id_mata_kuliah: t.String()
      })
    }
  );


