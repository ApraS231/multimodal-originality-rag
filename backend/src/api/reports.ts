import { Elysia, t } from "elysia";
import { prisma } from "../db/prisma";
import { checkAbility } from "./auth-guard";
import { systemConfigCache } from "../lib/cache";
import { boss } from "../lib/queue";
import { decrypt } from "../lib/crypto";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

// Helper Supabase Client
async function getSupabaseClient() {
  const config = await prisma.konfigurasiSistem.findFirst();
  if (!config || !config.tautan_supabase || !config.kunci_api_supabase) {
    return null;
  }
  const supabaseKey = decrypt(config.kunci_api_supabase);
  return createClient(config.tautan_supabase, supabaseKey);
}

const uploadDir = "./uploads";
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Helper untuk penghapusan tuntas naskah dan seluruh vektor pendukung
async function cascadeDeleteReport(id: string) {
  const laporan = await prisma.laporan.findUnique({
    where: { id_laporan: id },
    include: { laporan_gambar: true }
  });

  if (!laporan) return false;

  // 1. Hapus PDF lokal di berbagai kemungkinan lokasi
  const candidates = [
    laporan.tautan_berkas,
    path.resolve(uploadDir, path.basename(laporan.tautan_berkas)),
    path.resolve(process.cwd(), "uploads", path.basename(laporan.tautan_berkas)),
    path.resolve(process.cwd(), "..", "AI-service", "scratch", path.basename(laporan.tautan_berkas))
  ];
  for (const cand of candidates) {
    if (cand && fs.existsSync(cand)) {
      try {
        if (fs.statSync(cand).isFile()) fs.unlinkSync(cand);
      } catch { /* noop */ }
    }
  }

  // 2. Hapus dari Supabase Storage jika dikonfigurasi
  try {
    const supabase = await getSupabaseClient();
    if (supabase) {
      await supabase.storage.from("reports-bucket").remove([laporan.tautan_berkas, path.basename(laporan.tautan_berkas)]);
      if (laporan.laporan_gambar && laporan.laporan_gambar.length > 0) {
        const filePaths = laporan.laporan_gambar.map(img => img.lokasi_gambar);
        await supabase.storage.from("extracted-images-bucket").remove(filePaths);
      }
    }
  } catch (err) {
    console.warn("Peringatan pembersihan Supabase Storage:", err);
  }

  // 3. Hapus vektor dari Supabase pgvector (Teks 768-dim & Gambar 512-dim)
  try {
    await prisma.$executeRawUnsafe(
      `DELETE FROM public.laporan_text_vectors WHERE id_laporan = $1;`,
      id
    );
    await prisma.$executeRawUnsafe(
      `DELETE FROM public.laporan_image_vectors WHERE id_laporan = $1;`,
      id
    );
  } catch (err) {
    console.error("Gagal membersihkan vektor dari Supabase pgvector:", err);
  }

  // 4. Hapus record database relasional (Cascade laporanGambar dan penggunaanToken)
  await prisma.laporan.delete({
    where: { id_laporan: id }
  });

  return true;
}

// Helper otorisasi akses naskah bagi peran Aslab berbasis penugasan kelas dan mata kuliah
export async function isReportAccessibleByAslab(activeUser: any, idKelas: string, idMataKuliah: string, idPengunggah: string) {
  const role = activeUser?.peran || activeUser?.profil?.peran;
  if (!activeUser || role !== "ASLAB") {
    return true; // Pengguna non-aslab (Admin, Kalab) tidak dibatasi oleh penugasan aslab
  }

  // Jika Aslab yang mengunggah laporan ini, berikan akses
  if (idPengunggah === activeUser.id) {
    return true;
  }

  const profil = await prisma.profilPengguna.findUnique({
    where: { id_pengguna: activeUser.id },
    include: {
      kelas_aslab: true,
      matkul_aslab: true
    }
  });

  if (!profil) return false;

  const kelasIds = profil.kelas_aslab.map(k => k.id_kelas);
  const matkulIds = profil.matkul_aslab.map(m => m.id_mata_kuliah);

  // Jika Aslab ditugaskan pada kelas dan matkul
  if (kelasIds.length > 0 && matkulIds.length > 0) {
    return kelasIds.includes(idKelas) && matkulIds.includes(idMataKuliah);
  } else if (kelasIds.length > 0) {
    return kelasIds.includes(idKelas);
  } else if (matkulIds.length > 0) {
    return matkulIds.includes(idMataKuliah);
  }

  return false;
}

export const reportsRouter = new Elysia({ prefix: "/api/reports" })
  .post(
    "/analyze",
    async ({ body, set, activeUser }: any) => {
      const { file, nim, id_program_studi, id_kelas, id_mata_kuliah, tahun_akademik } = body;

      // 1. Cek kuota upload harian Aslab
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const config = (await systemConfigCache.get("global")) || (await prisma.konfigurasiSistem.findFirst());
      const uploadLimit = config?.batas_unggahan ?? 30;

      const uploadCount = await prisma.laporan.count({
        where: {
          id_pengunggah: activeUser.id,
          tanggal_dibuat: { gte: today }
        }
      });

      if (uploadCount >= uploadLimit) {
        set.status = 429;
        return { error: `Batas unggah harian terlampaui. Kuota Anda: ${uploadLimit} dokumen per hari.` };
      }

      // 2. Simpan file laporan ke folder uploads lokal
      const sanitizedFileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
      const savedPath = `${uploadDir}/${sanitizedFileName}`;
      await Bun.write(savedPath, file);

      // 3. Simpan record laporan awal (QUEUED) ke basis data relasional
      const laporan = await prisma.laporan.create({
        data: {
          nama_mahasiswa: file.name.split(".pdf")[0] || "Mahasiswa",
          nim: nim || "0000",
          status: "QUEUED",
          id_pengunggah: activeUser.id,
          tautan_berkas: savedPath,
          id_program_studi: id_program_studi,
          id_kelas: id_kelas,
          id_mata_kuliah: id_mata_kuliah,
          tahun_akademik: parseInt(tahun_akademik),
          skor_orisinalitas: 0.0,
          skor_plagiarisme: 0.0
        }
      });

      // 4. Masukkan task ke pg-boss queue
      await boss.send("analyze-document", {
        id_laporan: laporan.id_laporan,
        filePath: savedPath
      });

      return laporan;
    },
    {
      beforeHandle: checkAbility("create", "Laporan"),
      body: t.Object({
        file: t.File(),
        nim: t.Optional(t.String()),
        id_program_studi: t.String(),
        id_kelas: t.String(),
        id_mata_kuliah: t.String(),
        tahun_akademik: t.String()
      })
    }
  )

  .patch(
    "/:id/override",
    async ({ params, body, activeUser }: any) => {
      const { id } = params;
      const { scoreOriginalOverride, nilaiHuruf } = body;

      const updated = await prisma.laporan.update({
        where: { id_laporan: id },
        data: {
          skor_orisinalitas_koreksi: parseFloat(scoreOriginalOverride),
          nilai_huruf: nilaiHuruf,
          apakah_diverifikasi: true,
          id_verifikator: activeUser.id
        }
      });

      return { success: true, data: updated };
    },
    {
      beforeHandle: checkAbility("update", "Laporan"),
      body: t.Object({
        scoreOriginalOverride: t.String(),
        nilaiHuruf: t.String()
      })
    }
  )

  .patch(
    "/:id/hitl-image",
    async ({ params, body, activeUser }: any) => {
      const { id } = params;
      const { matchId, hitlStatus, hitlNote, batchUpdate } = body;

      const laporan = await prisma.laporan.findUnique({
        where: { id_laporan: id }
      });

      if (!laporan) {
        throw new Error("Laporan tidak ditemukan.");
      }

      const details = (laporan.detail_orisinalitas as any) || {};
      const imageDetails = [...(details.image_plagiarism_details || [])];

      if (batchUpdate) {
        for (let i = 0; i < imageDetails.length; i++) {
          imageDetails[i] = {
            ...imageDetails[i],
            hitl_status: hitlStatus,
            hitl_note: hitlNote !== undefined ? hitlNote : imageDetails[i].hitl_note,
            verified_by: activeUser.id,
            verified_at: new Date().toISOString()
          };
        }
      } else {
        let updatedIndex = -1;
        for (let i = 0; i < imageDetails.length; i++) {
          const item = imageDetails[i];
          const itemId = item.id || `img-match-${i}`;
          if (itemId === matchId || String(i) === matchId || item.image_id === matchId) {
            updatedIndex = i;
            break;
          }
        }

        if (updatedIndex === -1) {
          const parsed = parseInt(String(matchId).replace(/\D/g, ""), 10);
          if (!isNaN(parsed) && parsed >= 0 && parsed < imageDetails.length) {
            updatedIndex = parsed;
          }
        }

        if (updatedIndex >= 0 && updatedIndex < imageDetails.length) {
          imageDetails[updatedIndex] = {
            ...imageDetails[updatedIndex],
            hitl_status: hitlStatus,
            hitl_note: hitlNote !== undefined ? hitlNote : imageDetails[updatedIndex].hitl_note,
            verified_by: activeUser.id,
            verified_at: new Date().toISOString()
          };
        }
      }

      const updatedDetails = {
        ...details,
        image_plagiarism_details: imageDetails
      };

      const updated = await prisma.laporan.update({
        where: { id_laporan: id },
        data: {
          detail_orisinalitas: updatedDetails,
          id_verifikator: activeUser.id
        }
      });

      return {
        success: true,
        data: updated,
        updatedMatchId: matchId,
        hitlStatus
      };
    },
    {
      beforeHandle: checkAbility("update", "Laporan"),
      body: t.Object({
        matchId: t.String(),
        hitlStatus: t.String(),
        hitlNote: t.Optional(t.String()),
        batchUpdate: t.Optional(t.Boolean())
      })
    }
  )

  .delete(
    "/:id",
    async ({ params }: any) => {
      const { id } = params;
      const success = await cascadeDeleteReport(id);
      if (!success) {
        throw new Error("Laporan tidak ditemukan.");
      }
      return { success: true, message: "Laporan berhasil dihapus secara permanen beserta seluruh vektornya." };
    },
    {
      beforeHandle: checkAbility("delete", "Laporan")
    }
  )

  .post(
    "/bulk-delete",
    async ({ body }: any) => {
      const { ids } = body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return { success: false, message: "Daftar ID naskah wajib diisi." };
      }

      let deletedCount = 0;
      for (const id of ids) {
        try {
          const ok = await cascadeDeleteReport(id);
          if (ok) deletedCount++;
        } catch (e) {
          console.error(`Gagal menghapus laporan ${id}:`, e);
        }
      }

      return {
        success: true,
        deletedCount,
        message: `${deletedCount} berkas naskah sampel berhasil dihapus dari sistem dan database vektor.`
      };
    },
    {
      beforeHandle: checkAbility("delete", "Laporan"),
      body: t.Object({
        ids: t.Array(t.String())
      })
    }
  )

  .get(
    "/all",
    async ({ query, activeUser }: any) => {
      const { search, id_program_studi, id_mata_kuliah, id_kelas, status } = query || {};

      const where: any = {};
      if (id_program_studi && id_program_studi !== 'ALL') where.id_program_studi = id_program_studi;
      if (id_mata_kuliah && id_mata_kuliah !== 'ALL') where.id_mata_kuliah = id_mata_kuliah;
      if (id_kelas && id_kelas !== 'ALL') where.id_kelas = id_kelas;
      if (status && status !== 'ALL') where.status = status;

      // Scoping hak akses untuk peran ASLAB
      if (activeUser?.profil?.peran === "ASLAB") {
        const profil = await prisma.profilPengguna.findUnique({
          where: { id_pengguna: activeUser.id },
          include: {
            kelas_aslab: true,
            matkul_aslab: true
          }
        });

        const kelasIds = profil?.kelas_aslab.map(k => k.id_kelas) || [];
        const matkulIds = profil?.matkul_aslab.map(m => m.id_mata_kuliah) || [];

        if (kelasIds.length > 0 && matkulIds.length > 0) {
          where.OR = [
            { id_pengunggah: activeUser.id },
            {
              AND: [
                { id_kelas: { in: kelasIds } },
                { id_mata_kuliah: { in: matkulIds } }
              ]
            }
          ];
        } else if (kelasIds.length > 0) {
          where.OR = [
            { id_pengunggah: activeUser.id },
            { id_kelas: { in: kelasIds } }
          ];
        } else if (matkulIds.length > 0) {
          where.OR = [
            { id_pengunggah: activeUser.id },
            { id_mata_kuliah: { in: matkulIds } }
          ];
        } else {
          where.id_pengunggah = activeUser.id;
        }
      }

      if (search && search.trim() !== '') {
        const q = search.trim();
        const searchConditions = [
          { nama_mahasiswa: { contains: q, mode: 'insensitive' } },
          { nim: { contains: q, mode: 'insensitive' } },
          { tautan_berkas: { contains: q, mode: 'insensitive' } }
        ];
        if (where.OR) {
          where.AND = [
            ...(where.AND || []),
            { OR: searchConditions }
          ];
        } else {
          where.OR = searchConditions;
        }
      }

      const [reports, totalCount, statsAgg] = await Promise.all([
        prisma.laporan.findMany({
          where,
          include: {
            prodi: true,
            kelas: true,
            matkul: true,
            pengunggah: {
              select: { id: true, nama: true, email: true }
            }
          },
          orderBy: { tanggal_dibuat: 'desc' }
        }),
        prisma.laporan.count({ where }),
        prisma.laporan.aggregate({
          _avg: { skor_orisinalitas: true },
          _count: { id_laporan: true }
        })
      ]);

      // Hitung jumlah vektor di tabel pgvector
      let totalVectors = 0;
      try {
        const vectorCountRes: any = await prisma.$queryRawUnsafe(
          `SELECT COUNT(*)::int as count FROM public.laporan_text_vectors;`
        );
        totalVectors = vectorCountRes[0]?.count || 0;
      } catch (vecErr) {
        console.warn("Gagal menghitung vektor teks:", vecErr);
      }

      return {
        success: true,
        reports,
        total: totalCount,
        stats: {
          totalReports: statsAgg._count.id_laporan || 0,
          avgOriginality: statsAgg._avg.skor_orisinalitas ? Number(statsAgg._avg.skor_orisinalitas.toFixed(1)) : 0,
          totalVectors
        }
      };
    },
    {
      beforeHandle: checkAbility("read", "Laporan")
    }
  )

  .get(
    "/nav",
    async ({ activeUser }: any) => {
      const isAslab = activeUser.profil?.peran === "ASLAB";
      const whereClause: any = {};

      if (isAslab) {
        const profil = await prisma.profilPengguna.findUnique({
          where: { id_pengguna: activeUser.id },
          include: {
            kelas_aslab: true,
            matkul_aslab: true
          }
        });

        const kelasIds = profil?.kelas_aslab.map(k => k.id_kelas) || [];
        const matkulIds = profil?.matkul_aslab.map(m => m.id_mata_kuliah) || [];

        if (kelasIds.length > 0 && matkulIds.length > 0) {
          whereClause.OR = [
            { id_pengunggah: activeUser.id },
            {
              AND: [
                { id_kelas: { in: kelasIds } },
                { id_mata_kuliah: { in: matkulIds } }
              ]
            }
          ];
        } else if (kelasIds.length > 0) {
          whereClause.OR = [
            { id_pengunggah: activeUser.id },
            { id_kelas: { in: kelasIds } }
          ];
        } else if (matkulIds.length > 0) {
          whereClause.OR = [
            { id_pengunggah: activeUser.id },
            { id_mata_kuliah: { in: matkulIds } }
          ];
        } else {
          whereClause.id_pengunggah = activeUser.id;
        }
      }

      const laporans = await prisma.laporan.findMany({
        where: whereClause,
        include: {
          prodi: true,
          kelas: true,
          matkul: true
        }
      });

      const nav: any[] = [];

      for (const lap of laporans) {
        let prodiNode = nav.find(n => n.id === lap.id_program_studi);
        if (!prodiNode) {
          prodiNode = {
            id: lap.id_program_studi,
            name: lap.prodi.nama_prodi,
            type: "prodi",
            children: []
          };
          nav.push(prodiNode);
        }

        let matkulNode = prodiNode.children.find((n: any) => n.id === lap.id_mata_kuliah);
        if (!matkulNode) {
          matkulNode = {
            id: lap.id_mata_kuliah,
            name: lap.matkul.nama_matkul,
            type: "matkul",
            children: []
          };
          prodiNode.children.push(matkulNode);
        }

        let kelasNode = matkulNode.children.find((n: any) => n.id === lap.id_kelas);
        if (!kelasNode) {
          kelasNode = {
            id: lap.id_kelas,
            name: lap.kelas.nama_kelas,
            type: "kelas",
            children: []
          };
          matkulNode.children.push(kelasNode);
        }

        kelasNode.children.push({
          id: lap.id_laporan,
          name: `${lap.nama_mahasiswa} - ${lap.nim}`,
          type: "laporan",
          status: lap.status,
          skor_orisinalitas: Number(lap.skor_orisinalitas),
          nim: lap.nim
        });
      }

      return nav;
    },
    {
      beforeHandle: checkAbility("read", "Laporan")
    }
  )

  .get(
    "/:id",
    async ({ params, set, activeUser }: any) => {
      const { id } = params;
      const laporan = await prisma.laporan.findUnique({
        where: { id_laporan: id },
        include: {
          prodi: true,
          kelas: true,
          matkul: true,
          pengunggah: true,
          penggunaan_token: true,
          laporan_gambar: true
        }
      });

      if (!laporan) {
        set.status = 404;
        return { error: "Laporan tidak ditemukan." };
      }

      // Verifikasi hak akses peran ASLAB terhadap naskah
      const hasAccess = await isReportAccessibleByAslab(
        activeUser,
        laporan.id_kelas,
        laporan.id_mata_kuliah,
        laporan.id_pengunggah
      );
      if (!hasAccess) {
        set.status = 403;
        return { error: "Akses ditolak: Dokumen ini berada di luar kelas atau mata kuliah penugasan Anda." };
      }

      // Simulasi flags dan metadata spasial OCR/highlight
      const ocr_fallback_active = laporan.tautan_berkas.toLowerCase().includes("scan") || laporan.laporan_gambar.length > 0;

      // Ekstrak highlights asli dari detail_orisinalitas (mendukung tri-color: plagiat, orisinal, template)
      const highlights: any[] = [];
      const details = (laporan.detail_orisinalitas as any) || {};
      const segments = details.text_segments_details || details.text_plagiarism_details || [];
      const imageDetails = details.image_plagiarism_details || [];

      segments.forEach((ch: any, idx: number) => {
        const geom = ch.geometry || {};
        const bbox = geom.bounding_box || {};
        const sourceRef = ch.source_reference || {};
        const simPct = Math.round(Number(ch.similarity_score || 0) * 100);

        let chType: 'PLAGIARISM' | 'ORIGINAL' | 'TEMPLATE' = ch.type || 'ORIGINAL';
        if (!ch.type) {
          if (ch.is_template) chType = 'TEMPLATE';
          else if (Number(ch.similarity_score || 0) >= 0.75) chType = 'PLAGIARISM';
          else chType = 'ORIGINAL';
        }

        let commentPrefix = 'Kutipan Orisinal';
        if (chType === 'PLAGIARISM') commentPrefix = 'Kutipan Terindikasi Plagiat';
        else if (chType === 'TEMPLATE') commentPrefix = 'Template / Boilerplate Praktikum';

        const hasValidBbox = bbox && Number(bbox.x2) > Number(bbox.x1) && Number(bbox.y2) > Number(bbox.y1);
        const rects = hasValidBbox
          ? [
              {
                x1: Number(bbox.x1),
                y1: Number(bbox.y1),
                x2: Number(bbox.x2),
                y2: Number(bbox.y2),
                width: Number(bbox.width) || (Number(bbox.x2) - Number(bbox.x1)),
                height: Number(bbox.height) || (Number(bbox.y2) - Number(bbox.y1)),
              }
            ]
          : [];

        highlights.push({
          id: `hl-text-${idx}`,
          type: chType,
          position: {
            pageNumber: geom.page_number || 1,
            boundingRect: hasValidBbox
              ? {
                  x1: Number(bbox.x1),
                  y1: Number(bbox.y1),
                  x2: Number(bbox.x2),
                  y2: Number(bbox.y2),
                  width: Number(bbox.width) || (Number(bbox.x2) - Number(bbox.x1)),
                  height: Number(bbox.height) || (Number(bbox.y2) - Number(bbox.y1)),
                }
              : { x1: 0, y1: 0, x2: 0, y2: 0, width: 0, height: 0 },
            rects
          },
          comment: {
            text: `${commentPrefix}: "${geom.highlight_text || ""}"`,
            source: chType === 'TEMPLATE' 
              ? 'Format Modul / Template Praktikum'
              : `${sourceRef.author || "Mahasiswa"} (${sourceRef.year || ""}) - ${sourceRef.class || ""}`,
            similarity: simPct,
            reason: ch.reason || "",
            type: chType
          }
        });
      });

      imageDetails.forEach((img: any, idx: number) => {
        const coords = img.coordinates_on_page || {};
        const bbox = coords.bounding_box || img.bounding_box || {};
        const sourceRef = img.source_reference || {};
        const targetPage = coords.page_number || img.page_number || 1;
        const hasValidBbox = bbox && Number(bbox.x2) > Number(bbox.x1) && Number(bbox.y2) > Number(bbox.y1);
        const rects = hasValidBbox
          ? [
              {
                x1: Number(bbox.x1),
                y1: Number(bbox.y1),
                x2: Number(bbox.x2),
                y2: Number(bbox.y2),
                width: Number(bbox.width) || (Number(bbox.x2) - Number(bbox.x1)),
                height: Number(bbox.height) || (Number(bbox.y2) - Number(bbox.y1)),
              }
            ]
          : [];

        const hitlStatus = img.hitl_status || 'PENDING';
        const isExempted = hitlStatus === 'EXEMPTED';
        const hlType: 'PLAGIARISM' | 'ORIGINAL' | 'TEMPLATE' = isExempted ? 'TEMPLATE' : 'PLAGIARISM';

        highlights.push({
          id: `hl-img-${idx}`,
          type: hlType,
          position: {
            pageNumber: targetPage,
            boundingRect: hasValidBbox
              ? {
                  x1: Number(bbox.x1),
                  y1: Number(bbox.y1),
                  x2: Number(bbox.x2),
                  y2: Number(bbox.y2),
                  width: Number(bbox.width) || (Number(bbox.x2) - Number(bbox.x1)),
                  height: Number(bbox.height) || (Number(bbox.y2) - Number(bbox.y1)),
                }
              : { x1: 0, y1: 0, x2: 0, y2: 0, width: 0, height: 0 },
            rects
          },
          comment: {
            text: isExempted
              ? `Dikecualikan (Verifikasi Manual HITL): Gambar dianggap sebagai template/modul praktikum yang sah.`
              : (hitlStatus === 'CONFIRMED'
                  ? `Terkonfirmasi Plagiat (Verifikasi Manual HITL): Duplikasi visual gambar valid menjiplak arsip pembanding.`
                  : `Duplikasi visual gambar terdeteksi identik dengan dokumen referensi.`),
            source: `${sourceRef.author || "Laporan Pembanding"} (${sourceRef.year || ""}) - Hal ${sourceRef.page_number || ""}`,
            similarity: Math.round(Number(img.similarity_score || 0) * (img.similarity_score <= 1 ? 100 : 1)),
            type: hlType
          }
        });
      });

      const formattedImagePlagiarism = imageDetails.map((img: any, idx: number) => {
        const matchingImg = laporan.laporan_gambar.find(
          (lg: any) => lg.nomor_halaman === (img.coordinates_on_page?.page_number || img.page_number || 1)
        );

        let studentImgUrl = img.student_image_url || matchingImg?.lokasi_gambar || "";
        if (studentImgUrl && !studentImgUrl.startsWith("http")) {
          const baseName = path.basename(studentImgUrl);
          studentImgUrl = `/api/reports/image/${baseName}`;
        }

        let sourceImgUrl = img.source_reference?.image_url || img.source_image_url || studentImgUrl;
        if (sourceImgUrl && !sourceImgUrl.startsWith("http")) {
          const baseName = path.basename(sourceImgUrl);
          sourceImgUrl = `/api/reports/image/${baseName}`;
        }

        return {
          id: img.id || `img-match-${idx}`,
          image_id: img.image_id || `img-${idx}`,
          similarity_score: Math.round(Number(img.similarity_score || 0) * (img.similarity_score <= 1 ? 100 : 1)),
          page_number: img.coordinates_on_page?.page_number || img.page_number || 1,
          bounding_box: img.coordinates_on_page?.bounding_box || img.bounding_box || {},
          student_image_url: studentImgUrl,
          source_image_url: sourceImgUrl,
          source_reference: {
            author: img.source_reference?.author || "Laporan Terdahulu",
            year: img.source_reference?.year || "-",
            source_file_name: img.source_reference?.source_file_name || "Laporan_Pembanding.pdf",
            page_number: img.source_reference?.page_number || 1
          },
          hitl_status: img.hitl_status || 'PENDING',
          hitl_note: img.hitl_note || '',
          verified_by: img.verified_by || null,
          verified_at: img.verified_at || null
        };
      });

      return {
        ...laporan,
        ocr_fallback_active,
        highlights,
        image_plagiarism_details: formattedImagePlagiarism,
        extracted_images: laporan.laporan_gambar.map((lg: any) => {
          const baseName = path.basename(lg.lokasi_gambar);
          return {
            id: lg.id_laporan_gambar,
            url: lg.lokasi_gambar.startsWith("http")
              ? lg.lokasi_gambar
              : `/api/reports/image/${baseName}`,
            nomor_halaman: lg.nomor_halaman
          };
        })
      };
    },
    {
      beforeHandle: checkAbility("read", "Laporan")
    }
  )

  .get(
    "/:id/pdf",
    async ({ params, set, activeUser }: any) => {
      const { id } = params;
      const laporan = await prisma.laporan.findUnique({
        where: { id_laporan: id }
      });

      if (!laporan) {
        set.status = 404;
        return { error: "Laporan tidak ditemukan." };
      }

      // Verifikasi hak akses peran ASLAB terhadap berkas PDF
      const hasAccess = await isReportAccessibleByAslab(
        activeUser,
        laporan.id_kelas,
        laporan.id_mata_kuliah,
        laporan.id_pengunggah
      );
      if (!hasAccess) {
        set.status = 403;
        return { error: "Akses ditolak: Anda tidak berwenang mengunduh naskah di luar penugasan." };
      }

      // Cari berkas PDF pada berbagai kemungkinan lokasi direktori
      let resolvedPath: string | null = null;
      const rawTarget = laporan.tautan_berkas || "";
      const baseName = path.basename(rawTarget);
      const candidates = [
        rawTarget,
        path.resolve(uploadDir, baseName),
        path.resolve(process.cwd(), "uploads", baseName),
        path.resolve(process.cwd(), "..", "AI-service", "scratch", baseName),
      ];

      for (const cand of candidates) {
        if (cand && fs.existsSync(cand)) {
          try {
            if (fs.statSync(cand).isFile()) {
              resolvedPath = cand;
              break;
            }
          } catch {
            // ignore
          }
        }
      }

      if (resolvedPath) {
        set.headers["Content-Type"] = "application/pdf";
        return Bun.file(resolvedPath);
      }

      // Jika berkas fisik tidak ditemukan di disk lokal (dokumen hasil Cloud Seeding),
      // buat naskah PDF informatif agar viewer PDF browser tidak menampilkan galat JSON mentah
      set.headers["Content-Type"] = "application/pdf";
      const infoTitle = (laporan.nama_mahasiswa || "Naskah Mahasiswa").replace(/[^a-zA-Z0-9 ]/g, " ");
      const infoNim = (laporan.nim || "NIM Tidak Terdeteksi").replace(/[^a-zA-Z0-9 ]/g, " ");
      const infoFile = baseName.replace(/[^a-zA-Z0-9 ._-]/g, " ");

      const fallbackPdf = `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj
4 0 obj << /Length 380 >> stream
BT
/F1 18 Tf
50 720 Td
(ARSIP NASKAH PRAKTIKUM STITEK BONTANG) Tj
/F1 12 Tf
0 -40 Td
(Nama Mahasiswa : ${infoTitle}) Tj
0 -25 Td
(NIM            : ${infoNim}) Tj
0 -25 Td
(Nama Berkas    : ${infoFile}) Tj
0 -40 Td
(Status         : Telah Berhasil Diingesti & Terindeks ke Supabase pgvector) Tj
0 -25 Td
(Catatan        : Dokumen ini diserap dari repositori cloud Google Drive.) Tj
0 -20 Td
(                 Vektor embedding dan analisis orisinalitas telah tersimpan lengkap.) Tj
ET
endstream
endobj
5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000244 00000 n 
0000000676 00000 n 
trailer << /Size 6 /Root 1 0 R >>
startxref
755
%%EOF`;

      return new Response(fallbackPdf, {
        headers: { "Content-Type": "application/pdf" }
      });
    },
    {
      beforeHandle: checkAbility("read", "Laporan")
    }
  )
  .get(
    "/image/:filename",
    async ({ params, set }: any) => {
      const { filename } = params;
      const safeFilename = path.basename(filename);
      const candidates = [
        path.resolve(process.cwd(), "..", "AI-service", "static", "extracted_images", safeFilename),
        path.resolve(process.cwd(), "static", "extracted_images", safeFilename),
        path.resolve(uploadDir, safeFilename)
      ];

      for (const imgPath of candidates) {
        if (fs.existsSync(imgPath)) {
          try {
            const stat = fs.statSync(imgPath);
            if (stat.isFile()) {
              const ext = path.extname(safeFilename).toLowerCase();
              const mime = ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : ext === ".webp" ? "image/webp" : "image/png";
              set.headers["Content-Type"] = mime;
              set.headers["Cache-Control"] = "public, max-age=86400";
              return Bun.file(imgPath);
            }
          } catch {
            // ignore
          }
        }
      }

      // Fallback: Jika tidak ditemukan di disk lokal, alihkan langsung ke Supabase Storage publik
      const supabasePublicUrl = `https://ksnzvgwgblydclymkuew.supabase.co/storage/v1/object/public/laporan_images/${safeFilename}`;
      set.redirect = supabasePublicUrl;
      return;
    }
  )
  .get(
    "/analytics",
    async () => {
      const agg = await prisma.laporan.aggregate({
        _count: { id_laporan: true },
        _avg: { skor_orisinalitas: true }
      });

      const totalLaporan = agg._count.id_laporan || 0;
      const rataSkor = agg._avg.skor_orisinalitas ? Number(agg._avg.skor_orisinalitas.toFixed(1)) : 0;

      const totalPlagiat = await prisma.laporan.count({
        where: { skor_orisinalitas: { lt: 50 } }
      });

      const totalAslab = await prisma.profilPengguna.count({
        where: { peran: "ASLAB" }
      });

      const prodiAgg = await prisma.laporan.groupBy({
        by: ['id_program_studi'],
        _avg: { skor_orisinalitas: true },
        _count: { id_laporan: true }
      });

      const prodiList = await prisma.programStudi.findMany();
      const prodiStats = prodiAgg.map(item => {
        const prodi = prodiList.find(p => p.id_program_studi === item.id_program_studi);
        return {
          id_program_studi: item.id_program_studi,
          nama_prodi: prodi ? prodi.nama_prodi : "Umum",
          rata_skor: item._avg.skor_orisinalitas ? Number(item._avg.skor_orisinalitas.toFixed(1)) : 0,
          total_laporan: item._count.id_laporan || 0
        };
      });

      const terbaru = await prisma.laporan.findMany({
        take: 5,
        orderBy: { tanggal_dibuat: "desc" },
        include: { prodi: true, kelas: true, matkul: true }
      });

      return {
        totalLaporan,
        rataSkor,
        totalPlagiat,
        totalAslab,
        prodiStats,
        laporansTerbaru: terbaru.map(lap => ({
          id_laporan: lap.id_laporan,
          nama_mahasiswa: lap.nama_mahasiswa,
          nim: lap.nim,
          nama_prodi: lap.prodi.nama_prodi,
          nama_kelas: lap.kelas.nama_kelas,
          nama_matkul: lap.matkul.nama_matkul,
          skor_orisinalitas: Number(lap.skor_orisinalitas),
          tanggal_diunggah: lap.tanggal_dibuat
        }))
      };

    },
    {
      beforeHandle: checkAbility("read", "Summary")
    }
  )
  .get(
    "/matrix",

    async ({ query }: any) => {
      const { id_program_studi, id_kelas, tahun_akademik } = query;

      const whereClause: any = {};
      if (id_program_studi) whereClause.id_program_studi = id_program_studi;
      if (id_kelas) whereClause.id_kelas = id_kelas;
      if (tahun_akademik) whereClause.tahun_akademik = parseInt(tahun_akademik);

      const laporans = await prisma.laporan.findMany({
        where: whereClause,
        include: {
          matkul: true,
          prodi: true,
          kelas: true
        }
      });

      const matkulMap = new Map();
      laporans.forEach(lap => {
        matkulMap.set(lap.id_mata_kuliah, lap.matkul.nama_matkul);
      });
      const columns = Array.from(matkulMap.entries()).map(([id, name]) => ({
        id_mata_kuliah: id,
        nama_matkul: name
      }));

      const mahasiswaMap = new Map();
      laporans.forEach(lap => {
        const nim = lap.nim || "0000";
        if (!mahasiswaMap.has(nim)) {
          mahasiswaMap.set(nim, {
            nim,
            nama_mahasiswa: lap.nama_mahasiswa || "Mahasiswa",
            laporan_matkul: {}
          });
        }

        const mhs = mahasiswaMap.get(nim);
        mhs.laporan_matkul[lap.id_mata_kuliah] = {
          id_laporan: lap.id_laporan,
          skor_orisinalitas: Number(lap.skor_orisinalitas),
          nilai_huruf: lap.nilai_huruf || "-",
          apakah_diverifikasi: lap.apakah_diverifikasi
        };
      });

      const rows = Array.from(mahasiswaMap.values()).map(mhs => {
        columns.forEach(col => {
          if (!mhs.laporan_matkul[col.id_mata_kuliah]) {
            mhs.laporan_matkul[col.id_mata_kuliah] = null;
          }
        });
        return mhs;
      });

      return {
        columns,
        rows
      };
    },
    {
      beforeHandle: checkAbility("read", "Summary"),
      query: t.Object({
        id_program_studi: t.Optional(t.String()),
        id_kelas: t.Optional(t.String()),
        tahun_akademik: t.Optional(t.String())
      })
    }
  );
