import { Elysia, t } from "elysia";
import { checkAbility } from "./auth-guard";
import { generateServiceToken } from "../lib/jwt-helper";
import { CONFIG } from "../config";
import { boss } from "../lib/queue";
import { prisma } from "../db/prisma";
import fs from "fs";
import path from "path";

export const seedingRouter = new Elysia({ prefix: "/api" })
  .post(
    "/seeding/upload",
    async ({ body, set, activeUser }: any) => {
      const { file, id_program_studi, id_kelas, id_mata_kuliah, tahun_akademik, nama_mahasiswa, nim } = body;

      if (!file || typeof file === "string") {
        set.status = 400;
        return { error: "Berkas PDF wajib dilampirkan." };
      }

      if (!file.name || !file.name.toLowerCase().endsWith(".pdf")) {
        set.status = 400;
        return { error: "Format berkas tidak didukung. Harap unggah dokumen berekstensi .pdf" };
      }

      const id_laporan = crypto.randomUUID();
      const uploadDir = path.resolve(process.cwd(), "uploads");
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      const filePath = path.join(uploadDir, `${id_laporan}.pdf`);
      await Bun.write(filePath, file);

      // Cari informasi nama mata kuliah
      const matkul = await prisma.mataKuliah.findUnique({
        where: { id_mata_kuliah }
      });

      // Simpan entri awal ke database
      await prisma.laporan.create({
        data: {
          id_laporan,
          id_program_studi,
          id_kelas,
          id_mata_kuliah,
          tahun_akademik: parseInt(tahun_akademik),
          tautan_berkas: filePath,
          skor_orisinalitas: 0,
          skor_plagiarisme: 0,
          status: "PROCESSING",
          id_pengunggah: activeUser.id,
          nama_mahasiswa: nama_mahasiswa || null,
          nim: nim || null
        }
      });

      // Generate service token untuk handshake ke FastAPI
      const token = await generateServiceToken({
        userId: activeUser.id,
        role: activeUser.profil?.peran || "ASLAB",
        scope: "analyze",
        laporanId: id_laporan
      });

      // Meneruskan berkas ke FastAPI AI Service
      try {
        const formData = new FormData();
        formData.append("file", file, file.name);
        formData.append("mata_kuliah", matkul?.nama_matkul || "");
        formData.append("id_mata_kuliah", id_mata_kuliah);
        formData.append("tahun", tahun_akademik);
        formData.append("program_studi", id_program_studi);

        const aiRes = await fetch(`${CONFIG.FASTAPI_SERVICE_URL}/api/v1/analyze`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token}`
          },
          body: formData
        });

        if (aiRes.ok) {
          const result = (await aiRes.json()) as any;
          const totalOriginality = result.document_summary?.total_originality_score ?? 100.0;
          const totalPlagiarism = result.document_summary?.total_plagiarism_score ?? 0.0;
          const extractedName = result.metadata_extracted?.mahasiswa_nama || nama_mahasiswa || null;
          const extractedNim = result.metadata_extracted?.nim || nim || null;

          await prisma.$transaction(async (tx) => {
            await tx.laporan.update({
              where: { id_laporan },
              data: {
                status: "COMPLETED",
                skor_orisinalitas: totalOriginality,
                skor_plagiarisme: totalPlagiarism,
                nama_mahasiswa: extractedName,
                nim: extractedNim,
                detail_orisinalitas: {
                  text_plagiarism_details: result.text_plagiarism_details || [],
                  image_plagiarism_details: result.image_plagiarism_details || []
                }
              }
            });

            if (result.extracted_images && Array.isArray(result.extracted_images)) {
              for (const img of result.extracted_images) {
                const baseName = path.basename(img.file_path || "");
                const storageUrl = `https://ksnzvgwgblydclymkuew.supabase.co/storage/v1/object/public/laporan_images/${baseName}`;
                await tx.laporanGambar.create({
                  data: {
                    id_laporan,
                    lokasi_gambar: storageUrl,
                    nomor_halaman: img.page_number,
                    id_vektor_qdrant: img.vector_id || img.qdrant_vector_id || randomUUID()
                  }
                });
              }
            }
          });

          return {
            success: true,
            id_laporan,
            message: "Dokumen berhasil dianalisis secara instan.",
            skor_orisinalitas: totalOriginality,
            skor_plagiarisme: totalPlagiarism
          };
        } else {
          // AI Service mengembalikan error -> limpahkan ke background queue
          await boss.send("analyze-document", { id_laporan });
          return {
            success: true,
            id_laporan,
            message: "Berkas disimpan. Analisis sedang diproses di antrean latar belakang.",
            backgroundJob: true
          };
        }
      } catch (err: any) {
        // Fallback antrean jika AI Service offline saat itu
        try {
          await boss.send("analyze-document", { id_laporan });
        } catch (queueErr) {
          console.warn("Peringatan antrean fallback:", queueErr);
        }

        return {
          success: true,
          id_laporan,
          message: "Berkas berhasil disimpan dan dijadwalkan dalam antrean analisis sistem.",
          backgroundJob: true
        };
      }
    },
    {
      beforeHandle: checkAbility("create", "Seeding"),
      body: t.Object({
        file: t.File({ maxSize: 25 * 1024 * 1024 }),
        id_program_studi: t.String(),
        id_kelas: t.String(),
        id_mata_kuliah: t.String(),
        tahun_akademik: t.String(),
        nama_mahasiswa: t.Optional(t.String()),
        nim: t.Optional(t.String())
      })
    }
  )

  .post(
    "/seeding",
    async ({ body, set, activeUser }: any) => {
      const { queryKeywords, id_program_studi, id_kelas, id_mata_kuliah, tahun_akademik } = body;

      const token = await generateServiceToken({
        userId: activeUser.id,
        role: "ADMIN",
        scope: "seeding_trigger"
      });

      try {
        // 1. Picu proses ingesti ke AI Service
        const response = await fetch(`${CONFIG.FASTAPI_SERVICE_URL}/api/v1/seeding`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify({
            keywords: queryKeywords,
            id_program_studi,
            id_kelas,
            id_mata_kuliah,
            tahun_akademik: parseInt(tahun_akademik),
            id_pengunggah: activeUser?.id,
            folder_ids: body.folder_ids || []
          })
        });

        if (!response.ok) {
          const errorText = await response.text();
          set.status = response.status;
          return { error: `Gagal memicu seeding di AI Service: ${errorText}` };
        }

        const data = await response.json() as any;
        const taskId = data.task_id;

        // 2. Daftarkan background job ke pg-boss untuk pemantauan antrean persisten
        try {
          await boss.send("cloud-seeding", {
            taskId,
            queryKeywords,
            id_program_studi,
            id_kelas,
            id_mata_kuliah,
            tahun_akademik,
            id_pengunggah: activeUser?.id,
            folder_ids: body.folder_ids || []
          });
        } catch (queueErr) {
          console.warn("Peringatan pendaftaran antrean pg-boss:", queueErr);
        }

        return { success: true, taskId, backgroundJob: true };
      } catch (err: any) {
        set.status = 500;
        return { error: `Gagal menghubungi AI Service: ${err.message}` };
      }
    },
    {
      beforeHandle: checkAbility("create", "Seeding"),
      body: t.Object({
        queryKeywords: t.Array(t.String()),
        id_program_studi: t.String(),
        id_kelas: t.String(),
        id_mata_kuliah: t.String(),
        tahun_akademik: t.String(),
        folder_ids: t.Optional(t.Array(t.String()))
      })
    }
  )

  .get("/scrape/stream/:taskId", async ({ params }: any) => {
    const { taskId } = params;

    try {
      const response = await fetch(`${CONFIG.FASTAPI_SERVICE_URL}/api/v1/scrape/stream/${taskId}`);
      if (!response.ok || !response.body) {
        return new Response("Gagal menghubungkan ke stream progress di AI Service.", {
          status: 502,
          headers: { "Content-Type": "text/plain" }
        });
      }

      return new Response(response.body, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive"
        }
      });
    } catch (err: any) {
      return new Response(`Koneksi stream gagal: ${err.message}`, {
        status: 500,
        headers: { "Content-Type": "text/plain" }
      });
    }
  })

  .get("/scrape/status/:taskId", async ({ params, set }: any) => {
    const { taskId } = params;
    try {
      const response = await fetch(`${CONFIG.FASTAPI_SERVICE_URL}/api/v1/scrape/status/${taskId}`);
      if (!response.ok) {
        set.status = response.status;
        return { status: "not_found", message: "Gagal mengambil status dari AI Service" };
      }
      return await response.json();
    } catch (err: any) {
      set.status = 502;
      return { error: `Gagal menghubungi AI Service: ${err.message}` };
    }
  })

  .get("/seeding/logs/:taskId", async ({ params, set }: any) => {
    const { taskId } = params;
    try {
      const response = await fetch(`${CONFIG.FASTAPI_SERVICE_URL}/api/v1/seeding/logs/${taskId}`);
      if (!response.ok) {
        set.status = response.status;
        return { error: "Gagal mengambil log aktivitas seeding dari AI Service" };
      }
      return await response.json();
    } catch (err: any) {
      set.status = 502;
      return { error: `Gagal menghubungi AI Service: ${err.message}` };
    }
  })

  .post(
    "/fine-tune",
    async ({ body, set, activeUser }: any) => {
      const token = await generateServiceToken({
        userId: activeUser.id,
        role: "ADMIN",
        scope: "fine_tuning"
      });

      try {
        const response = await fetch(`${CONFIG.FASTAPI_SERVICE_URL}/api/v1/fine-tune`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify(body || {})
        });

        if (!response.ok) {
          const errorText = await response.text();
          set.status = response.status;
          return { error: `Gagal menjalankan fine-tuning di AI Service: ${errorText}` };
        }

        const data = await response.json() as any;
        return data;
      } catch (err: any) {
        set.status = 500;
        return { error: `Gagal menghubungi AI Service: ${err.message}` };
      }
    },
    {
      beforeHandle: checkAbility("create", "Seeding"),
      body: t.Optional(
        t.Object({
          id_mata_kuliah: t.Optional(t.String())
        })
      )
    }
  );
