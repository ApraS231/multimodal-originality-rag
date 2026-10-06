import { boss } from "../lib/queue";
import { prisma } from "../db/prisma";
import { generateServiceToken } from "../lib/jwt-helper";
import { CONFIG } from "../config";

export async function registerAnalyzeWorker() {
  try {
    await boss.createQueue("analyze-document");
  } catch (err) {
    // Queue might already exist
  }
  await boss.work("analyze-document", async (job: any) => {
    const activeJob = Array.isArray(job) ? job[0] : job;
    const { id_laporan, filePath } = activeJob.data;

    try {
      const laporan = await prisma.laporan.findUnique({
        where: { id_laporan },
        include: { prodi: true, matkul: true }
      });

      if (!laporan) {
        console.error(`Laporan dengan ID ${id_laporan} tidak ditemukan.`);
        return;
      }

      await prisma.laporan.update({
        where: { id_laporan },
        data: { status: "PROCESSING" }
      });

      const token = await generateServiceToken({
        scope: "analyze",
        laporanId: id_laporan
      });

      const formData = new FormData();
      formData.append("file", Bun.file(filePath));
      formData.append("program_studi", laporan.prodi.nama_prodi);
      formData.append("mata_kuliah", laporan.matkul.nama_matkul);
      formData.append("id_mata_kuliah", laporan.id_mata_kuliah);
      formData.append("tahun", laporan.tahun_akademik.toString());

      const response = await fetch(`${CONFIG.FASTAPI_SERVICE_URL}/api/v1/analyze`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`FastAPI AI Service Error (HTTP ${response.status}): ${errorText}`);
      }

      const result = await response.json() as any;

      const totalOriginalityScore = result.document_summary?.total_originality_score ?? 100.0;
      const totalPlagiarismScore = result.document_summary?.total_plagiarism_score ?? 0.0;
      const namaMahasiswa = result.metadata_extracted?.mahasiswa_nama || laporan.nama_mahasiswa;
      const nim = result.metadata_extracted?.nim || laporan.nim;
      await prisma.$transaction(async (tx) => {
        await tx.laporan.update({
          where: { id_laporan },
          data: {
            status: "COMPLETED",
            skor_orisinalitas: totalOriginalityScore,
            skor_plagiarisme: totalPlagiarismScore,
            nama_mahasiswa: namaMahasiswa,
            nim: nim,
            detail_orisinalitas: {
              text_plagiarism_details: result.text_plagiarism_details || [],
              image_plagiarism_details: result.image_plagiarism_details || []
            }
          }
        });

        const modelName = result.token_usage?.model_name || "Llama-3-8B-Instruct";
        const promptTokens = result.token_usage?.prompt_tokens ?? 0;
        const completionTokens = result.token_usage?.completion_tokens ?? 0;
        const totalTokens = result.token_usage?.total_tokens ?? 0;
        const estimatedCost = totalTokens * 0.000002;

        await tx.penggunaanToken.create({
          data: {
            nama_model: modelName,
            token_input: promptTokens,
            token_output: completionTokens,
            total_token: totalTokens,
            estimasi_biaya: estimatedCost,
            id_laporan: id_laporan,
            id_program_studi: laporan.id_program_studi
          }
        });

        if (result.extracted_images && Array.isArray(result.extracted_images)) {
          const imagesData = result.extracted_images.map((img: any) => {
            const baseName = path.basename(img.file_path || "");
            const storageUrl = `https://ksnzvgwgblydclymkuew.supabase.co/storage/v1/object/public/laporan_images/${baseName}`;
            return {
              lokasi_gambar: storageUrl,
              nomor_halaman: img.page_number,
              id_vektor_qdrant: img.vector_id || img.qdrant_vector_id || crypto.randomUUID(),
              id_laporan: id_laporan
            };
          });

          await tx.laporanGambar.createMany({
            data: imagesData
          });
        }
      });

      console.log(`✅ Analisis laporan ${id_laporan} selesai sukses.`);
    } catch (error: any) {
      console.error(`❌ Gagal memproses analisis laporan ${id_laporan}:`, error);

      await prisma.laporan.update({
        where: { id_laporan },
        data: { status: "FAILED" }
      }).catch(err => console.error("Gagal memperbarui status ke FAILED:", err));

      throw error;
    }
  });
}
