import { PgBoss } from 'pg-boss';
import { CONFIG } from '../config';

// Gunakan DIRECT_URL (Port 5432 tanpa PgBouncer) agar koneksi persisten tidak diputus oleh pooler
const rawConn = process.env.DIRECT_URL || CONFIG.DATABASE_URL;
const directConn = rawConn.replace('?pgbouncer=true', '').replace('&pgbouncer=true', '');

export const boss = new PgBoss({
  connectionString: directConn,
  schema: 'pgboss',
  max: 5
});

boss.on('error', error => {
  // Tangkap error secara graceful agar tidak menyebabkan unhandled exception pada runtime
  console.warn("PgBoss Background Worker Warning:", error?.message || error);
});

export async function startQueue() {
  await boss.start();
  try {
    await boss.createQueue("analyze-document");
  } catch (err) {
    // Queue might already exist
  }
  console.log("🚀 PgBoss Background Queue started successfully.");
}
