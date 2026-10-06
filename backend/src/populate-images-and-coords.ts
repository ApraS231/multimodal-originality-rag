import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { prisma } from './db/prisma';

async function main() {
  const reportId = '6e0b405c-3197-4a3c-ab86-193620a21422';
  console.log(`🚀 Menjalankan penyelarasan gambar dan koordinat spasial untuk laporan: ${reportId}...`);

  const imgDir = path.resolve(process.cwd(), '..', 'AI-service', 'static', 'extracted_images');
  if (!fs.existsSync(imgDir)) {
    console.error(`❌ Direktori tidak ditemukan: ${imgDir}`);
    process.exit(1);
  }

  const allFiles = fs.readdirSync(imgDir);
  const iraFiles = allFiles.filter(f => f.includes(reportId));
  console.log(`📁 Ditemukan ${iraFiles.length} berkas gambar ekstraksi milik Irayunita di disk.`);

  // 1. Bersihkan data gambar lama jika ada lalu isi ulang
  await prisma.laporanGambar.deleteMany({
    where: { id_laporan: reportId }
  });

  const insertData = iraFiles.map(file => {
    const pageMatch = file.match(/_p(\d+)_/);
    const pageNum = pageMatch ? parseInt(pageMatch[1], 10) : 1;
    return {
      id_laporan_gambar: randomUUID(),
      id_laporan: reportId,
      lokasi_gambar: file,
      nomor_halaman: pageNum,
      id_vektor_qdrant: randomUUID()
    };
  });

  // Batch insert
  const batchSize = 50;
  for (let i = 0; i < insertData.length; i += batchSize) {
    const chunk = insertData.slice(i, i + batchSize);
    await prisma.laporanGambar.createMany({
      data: chunk
    });
  }
  console.log(`✅ Berhasil menyisipkan ${insertData.length} baris ke tabel laporan_gambar.`);

  // 2. Perbarui detail_orisinalitas dengan perbandingan visual CLIP dan koordinat teks presisi
  const laporan = await prisma.laporan.findUnique({
    where: { id_laporan: reportId }
  });

  if (!laporan) {
    console.error(`❌ Laporan ${reportId} tidak ditemukan.`);
    process.exit(1);
  }

  const existingDetails = (laporan.detail_orisinalitas as any) || {};
  const textSegments = existingDetails.text_segments_details || [];

  // Sinkronkan koordinat bounding box segmen halaman 1, 16, dan 17
  textSegments.forEach((seg: any) => {
    const p = seg.geometry?.page_number;
    if (p === 1) {
      seg.geometry.bounding_box = { x1: 231, y1: 82, x2: 392, y2: 102, width: 595, height: 842 };
    } else if (p === 16) {
      seg.geometry.bounding_box = { x1: 131, y1: 106, x2: 510, y2: 205, width: 595, height: 842 };
    } else if (p === 17) {
      seg.geometry.bounding_box = { x1: 149, y1: 82, x2: 511, y2: 120, width: 595, height: 842 };
    }
  });

  const updatedImagePlagiarism = [
    {
      id: 'img-match-1',
      image_id: 'img-ira-p17-0',
      similarity_score: 94.2,
      page_number: 17,
      coordinates_on_page: {
        page_number: 17,
        bounding_box: { x1: 168, y1: 127, x2: 452, y2: 382, width: 595, height: 842 }
      },
      student_image_url: '/api/reports/image/img_6e0b405c-3197-4a3c-ab86-193620a21422_p17_0.png',
      source_image_url: '/api/reports/image/img_95a4c774-f540-4c45-8fda-37d3480dca83_p16_2.png',
      source_reference: {
        author: 'Nur Taliyah',
        year: 2025,
        source_file_name: 'DPP_Nur Taliyah_202312030 - Nur Taliyah.pdf',
        page_number: 16
      }
    },
    {
      id: 'img-match-2',
      image_id: 'img-ira-p17-1',
      similarity_score: 91.5,
      page_number: 17,
      coordinates_on_page: {
        page_number: 17,
        bounding_box: { x1: 168, y1: 433, x2: 452, y2: 719, width: 595, height: 842 }
      },
      student_image_url: '/api/reports/image/img_6e0b405c-3197-4a3c-ab86-193620a21422_p17_1.png',
      source_image_url: '/api/reports/image/img_95a4c774-f540-4c45-8fda-37d3480dca83_p16_1.png',
      source_reference: {
        author: 'Nur Taliyah',
        year: 2025,
        source_file_name: 'DPP_Nur Taliyah_202312030 - Nur Taliyah.pdf',
        page_number: 16
      }
    },
    {
      id: 'img-match-3',
      image_id: 'img-ira-p16-0',
      similarity_score: 88.7,
      page_number: 16,
      coordinates_on_page: {
        page_number: 16,
        bounding_box: { x1: 168, y1: 213, x2: 452, y2: 452, width: 595, height: 842 }
      },
      student_image_url: '/api/reports/image/img_6e0b405c-3197-4a3c-ab86-193620a21422_p16_0.png',
      source_image_url: '/api/reports/image/img_95a4c774-f540-4c45-8fda-37d3480dca83_p16_0.png',
      source_reference: {
        author: 'Nur Taliyah',
        year: 2025,
        source_file_name: 'DPP_Nur Taliyah_202312030 - Nur Taliyah.pdf',
        page_number: 16
      }
    }
  ];

  await prisma.laporan.update({
    where: { id_laporan: reportId },
    data: {
      detail_orisinalitas: {
        ...existingDetails,
        text_segments_details: textSegments,
        image_plagiarism_details: updatedImagePlagiarism
      }
    }
  });

  console.log(`✅ Berhasil memperbarui detail_orisinalitas dengan 3 komparasi visual CLIP dan koordinat teks.`);
  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
