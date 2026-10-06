import { prisma } from "./db/prisma";

async function populateAllImagePlagiarism() {
  console.log("=== POPULATING IMAGE_PLAGIARISM_DETAILS ACROSS ALL REPORTS ===");

  const supabaseBaseUrl = "https://ksnzvgwgblydclymkuew.supabase.co/storage/v1/object/public/laporan_images";

  // Fetch all reports
  const reports = await prisma.laporan.findMany({
    select: {
      id_laporan: true,
      nama_mahasiswa: true,
      nim: true,
      detail_orisinalitas: true
    }
  });

  console.log(`Processing ${reports.length} reports...`);

  let updatedReportsCount = 0;

  for (const r of reports) {
    const repId = r.id_laporan;
    const authorName = r.nama_mahasiswa || "";

    // Query top cross-author matches for this report on page > 1
    const matches: any[] = await prisma.$queryRawUnsafe(`
      SELECT 
        rv.image_id as student_img_id,
        rv.page_number as student_page,
        rv.bounding_box as student_bbox,
        ov.author as source_author,
        ov.source_file_name as source_file,
        ov.page_number as source_page,
        ov.image_id as source_img_id,
        (1 - (rv.embedding <=> ov.embedding)) as similarity
      FROM public.laporan_image_vectors rv
      CROSS JOIN LATERAL (
        SELECT author, source_file_name, page_number, image_id, embedding
        FROM public.laporan_image_vectors ov
        WHERE ov.id_laporan != rv.id_laporan 
          AND (ov.author IS NULL OR ov.author != $2)
          AND ov.page_number > 1
        ORDER BY rv.embedding <=> ov.embedding ASC
        LIMIT 1
      ) ov
      WHERE rv.id_laporan = $1 
        AND rv.page_number > 1 
        AND (1 - (rv.embedding <=> ov.embedding)) >= 0.85
      ORDER BY similarity DESC
      LIMIT 10;
    `, repId, authorName);

    if (matches.length > 0) {
      const existingDetails = (r.detail_orisinalitas as any) || {};

      const imagePlagiarismItems = matches.map((m, idx) => {
        const studentFilename = `${m.student_img_id}.png`;
        const sourceFilename = `${m.source_img_id}.png`;
        const simScore = Math.min(100, Math.round(Number(m.similarity) * 1000) / 10);
        const bbox = typeof m.student_bbox === "string" ? JSON.parse(m.student_bbox) : (m.student_bbox || {});

        return {
          id: `img-match-${idx + 1}`,
          image_id: m.student_img_id,
          similarity_score: simScore,
          page_number: m.student_page,
          coordinates_on_page: {
            page_number: m.student_page,
            bounding_box: bbox
          },
          bounding_box: bbox,
          student_image_url: `${supabaseBaseUrl}/${studentFilename}`,
          source_image_url: `${supabaseBaseUrl}/${sourceFilename}`,
          source_reference: {
            author: m.source_author || "Mahasiswa Pembanding",
            year: 2025,
            source_file_name: m.source_file || "Laporan_Pembanding.pdf",
            page_number: m.source_page
          }
        };
      });

      const newDetails = {
        ...existingDetails,
        image_plagiarism_details: imagePlagiarismItems
      };

      await prisma.laporan.update({
        where: { id_laporan: repId },
        data: { detail_orisinalitas: newDetails }
      });

      updatedReportsCount++;
      console.log(`✅ [${updatedReportsCount}] Updated ${r.nama_mahasiswa} (${repId}): ${imagePlagiarismItems.length} visual plagiarism items.`);
    } else {
      console.log(`ℹ️ No cross-author matches >= 85% on page > 1 for ${r.nama_mahasiswa} (${repId})`);
    }
  }

  console.log(`\n🎉 Selesai! Berhasil memperbarui ${updatedReportsCount} laporan dengan data perbandingan visual CLIP.`);
  process.exit(0);
}

populateAllImagePlagiarism().catch(err => {
  console.error("Error populating image plagiarism:", err);
  process.exit(1);
});
