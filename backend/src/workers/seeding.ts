import { boss } from "../lib/queue";
import { generateServiceToken } from "../lib/jwt-helper";
import { CONFIG } from "../config";

export async function registerSeedingWorker() {
  try {
    await boss.createQueue("cloud-seeding");
  } catch (err) {
    // Queue mungkin sudah dibuat sebelumnya
  }

  await boss.work("cloud-seeding", async (job: any) => {
    const activeJob = Array.isArray(job) ? job[0] : job;
    const {
      queryKeywords,
      id_program_studi,
      id_kelas,
      id_mata_kuliah,
      tahun_akademik,
      id_pengunggah,
      folder_ids,
      taskId
    } = activeJob.data;

    console.log(`🚀 [Worker] Memulai eksekusi background job cloud seeding untuk Matkul: ${id_mata_kuliah} (Task ID: ${taskId || activeJob.id})...`);

    try {
      const token = await generateServiceToken({
        userId: id_pengunggah || "admin-system",
        role: "ADMIN",
        scope: "seeding_trigger"
      });

      const response = await fetch(`${CONFIG.FASTAPI_SERVICE_URL}/api/v1/seeding`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          keywords: queryKeywords || [],
          id_program_studi,
          id_kelas,
          id_mata_kuliah,
          tahun_akademik: parseInt(tahun_akademik),
          id_pengunggah,
          folder_ids: folder_ids || []
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`AI Service Seeding Error (HTTP ${response.status}): ${errorText}`);
      }

      const result = await response.json() as any;
      console.log(`✅ [Worker] Background job cloud seeding sukses dipicu. AI Service Task ID: ${result.task_id}`);
      return { success: true, aiTaskId: result.task_id };
    } catch (error: any) {
      console.error(`❌ [Worker] Gagal memproses background job cloud seeding:`, error);
      throw error;
    }
  });
}
