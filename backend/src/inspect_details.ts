import { prisma } from "./db/prisma";

async function inspectDetailOrisinalitas() {
  const rizky = await prisma.laporan.findUnique({
    where: { id_laporan: "4cd72c77-7ee2-466c-be67-f2ea1155946c" }
  });

  const details = (rizky?.detail_orisinalitas as any) || {};
  console.log("Keys in detail_orisinalitas:", Object.keys(details));

  const textSegs = details.text_segments_details || [];
  console.log(`\ntext_segments_details (${textSegs.length} items):`);
  for (const ts of textSegs.slice(0, 3)) {
    console.log(JSON.stringify(ts, null, 2));
  }

  const imgSegs = details.image_plagiarism_details || [];
  console.log(`\nimage_plagiarism_details (${imgSegs.length} items):`);
  for (const is of imgSegs.slice(0, 2)) {
    console.log(JSON.stringify(is, null, 2));
  }

  process.exit(0);
}

inspectDetailOrisinalitas();
