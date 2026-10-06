import { prisma } from "./db/prisma";
import { randomUUID } from "crypto";

async function populateAllLaporanGambar() {
  console.log("=== POPULATING LAPORAN_GAMBAR FROM LAPORAN_IMAGE_VECTORS & SUPABASE STORAGE ===");

  const supabaseBaseUrl = "https://ksnzvgwgblydclymkuew.supabase.co/storage/v1/object/public/laporan_images";

  // 1. Fetch all vectors from laporan_image_vectors
  const vectors: any[] = await prisma.$queryRawUnsafe(`
    SELECT id, id_laporan, image_id, page_number
    FROM public.laporan_image_vectors
    ORDER BY id_laporan, page_number ASC;
  `);

  console.log(`Found ${vectors.length} image vectors across all reports.`);

  // 2. Clear existing laporan_gambar
  const deleted = await prisma.laporanGambar.deleteMany({});
  console.log(`Cleared ${deleted.count} existing records in laporan_gambar.`);

  // 3. Prepare data with Supabase Storage public URLs
  const data = vectors.map(v => {
    const filename = `${v.image_id}.png`;
    const publicUrl = `${supabaseBaseUrl}/${filename}`;
    return {
      id_laporan_gambar: randomUUID(),
      id_laporan: v.id_laporan,
      lokasi_gambar: publicUrl,
      nomor_halaman: v.page_number,
      id_vektor_qdrant: v.id
    };
  });

  // 4. Batch insert into laporan_gambar
  const batchSize = 500;
  for (let i = 0; i < data.length; i += batchSize) {
    const chunk = data.slice(i, i + batchSize);
    await prisma.laporanGambar.createMany({
      data: chunk
    });
    console.log(`Inserted chunk ${i + 1} - ${Math.min(i + batchSize, data.length)} / ${data.length}`);
  }

  // 5. Verify counts
  const totalCount = await prisma.laporanGambar.count();
  console.log(`\n✅ Total records in laporan_gambar now: ${totalCount}`);

  // Check Muhamad Rizky count
  const rizkyCount = await prisma.laporanGambar.count({
    where: { id_laporan: "4cd72c77-7ee2-466c-be67-f2ea1155946c" }
  });
  console.log(`✅ Muhamad Rizky (4cd72c77) image count in DB: ${rizkyCount}`);

  process.exit(0);
}

populateAllLaporanGambar().catch(err => {
  console.error("Error populating laporan_gambar:", err);
  process.exit(1);
});
