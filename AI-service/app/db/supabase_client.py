import psycopg2
from psycopg2.extras import RealDictCursor, execute_batch
from pgvector.psycopg2 import register_vector
from app.config import settings
import logging

logger = logging.getLogger("AI-Service")

class SupabaseVectorClient:
    """
    Koneksi PostgreSQL dengan ekstensi pgvector untuk penyimpanan
    dan kueri vektor teks dan gambar di Supabase.
    """
    def __init__(self):
        self._conn = None

    def get_connection(self):
        """
        Mengembalikan koneksi aktif dengan pgvector terdaftar.
        Melakukan auto-reconnect jika koneksi terputus.
        """
        try:
            if self._conn is None or self._conn.closed:
                logger.info("Membuka koneksi baru ke Supabase PostgreSQL...")
                self._conn = psycopg2.connect(settings.DATABASE_URL)
                register_vector(self._conn)
                logger.info("Koneksi pgvector ke Supabase berhasil diinisialisasi.")
            else:
                # Uji apakah koneksi masih sehat
                with self._conn.cursor() as cur:
                    cur.execute("SELECT 1")
        except Exception as e:
            logger.warning(f"Koneksi terputus ({e}), membuka koneksi ulang...")
            self._conn = psycopg2.connect(settings.DATABASE_URL)
            register_vector(self._conn)
            
        return self._conn

    def execute_query(self, query: str, params: tuple = None, fetch: bool = True):
        """
        Mengeksekusi satu kueri SQL dengan opsi pengembalian hasil (RealDictCursor).
        """
        conn = self.get_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(query, params)
                if fetch:
                    results = cur.fetchall()
                    # Ubah RealDictRow ke dict biasa
                    return [dict(row) for row in results]
                conn.commit()
                return None
        except Exception as e:
            conn.rollback()
            logger.error(f"Error mengeksekusi kueri SQL: {e}")
            raise e

    def execute_batch(self, query: str, params_list: list, page_size: int = 100):
        """
        Mengeksekusi batch insert/update efisien menggunakan psycopg2.extras.execute_batch.
        """
        if not params_list:
            return
        conn = self.get_connection()
        try:
            with conn.cursor() as cur:
                execute_batch(cur, query, params_list, page_size=page_size)
            conn.commit()
            logger.info(f"Berhasil mengeksekusi batch ({len(params_list)} baris).")
        except Exception as e:
            conn.rollback()
            logger.error(f"Error mengeksekusi batch SQL: {e}")
            raise e

    def test_connection(self) -> bool:
        """
        Menguji kesiapan koneksi dan fungsi pgvector.
        """
        try:
            res = self.execute_query("SELECT extensions.vector_dims(array_fill(0.0, ARRAY[768])::extensions.vector) AS dims;")
            if res and res[0].get("dims") == 768:
                return True
            return False
        except Exception as e:
            logger.error(f"Uji koneksi pgvector gagal: {e}")
            return False

    def reset(self):
        """
        Menutup koneksi lama agar terinisialisasi ulang pada kueri berikutnya.
        """
        if self._conn and not self._conn.closed:
            try:
                self._conn.close()
            except Exception:
                pass
        self._conn = None

    def upload_image_to_storage(
        self,
        image_bytes: bytes,
        filename: str,
        content_type: str = "image/png",
        bucket: str = "laporan_images"
    ):
        """
        Mengunggah berkas gambar ke Supabase Storage (REST API) dan mengembalikan URL publik.
        Jika terjadi kendala jaringan, mengembalikan None agar sistem dapat fallback ke URL lokal.
        """
        import httpx
        supabase_url = getattr(settings, "TAUTAN_SUPABASE", "") or "https://ksnzvgwgblydclymkuew.supabase.co"
        supabase_key = getattr(settings, "KUNCI_API_SUPABASE", "")
        if not supabase_url:
            return None

        clean_url = supabase_url.rstrip("/")
        endpoint = f"{clean_url}/storage/v1/object/{bucket}/{filename}"
        public_url = f"{clean_url}/storage/v1/object/public/{bucket}/{filename}"

        headers = {
            "Content-Type": content_type,
            "x-upsert": "true"
        }
        if supabase_key:
            headers["Authorization"] = f"Bearer {supabase_key}"
            headers["apikey"] = supabase_key

        try:
            with httpx.Client(timeout=10.0) as client:
                res = client.post(endpoint, content=image_bytes, headers=headers)
                if res.status_code in [200, 201]:
                    logger.info(f"Berhasil mengunggah gambar {filename} ke Supabase Storage: {public_url}")
                    return public_url
                else:
                    logger.warning(f"Respon Supabase Storage HTTP {res.status_code}: {res.text}")
                    if res.status_code == 400 and "Duplicate" in res.text:
                        return public_url
                    return public_url
        except Exception as e:
            logger.warning(f"Gagal mengunggah gambar {filename} ke Supabase Storage: {e}")
            return None

    def count_distinct_reports_for_text(
        self,
        embedding: list,
        id_mata_kuliah: str = None,
        threshold: float = 0.88,
        exclude_id_laporan: str = None
    ) -> int:
        """
        Menghitung berapa banyak laporan berbeda (COUNT DISTINCT id_laporan)
        yang memiliki kemiripan semantik >= threshold (0.88) dengan teks ini.
        Digunakan untuk deteksi boilerplate otomatis (N >= 5).
        """
        try:
            vec_arg = list(embedding) if hasattr(embedding, "tolist") else embedding
            query = """
                SELECT COUNT(DISTINCT id_laporan) AS doc_count
                FROM public.laporan_text_vectors
                WHERE (%s IS NULL OR id_mata_kuliah = %s)
                  AND (%s IS NULL OR id_laporan != %s)
                  AND (1 - (embedding <=> %s::extensions.vector)) >= %s;
            """
            params = (id_mata_kuliah, id_mata_kuliah, exclude_id_laporan, exclude_id_laporan, vec_arg, threshold)
            rows = self.execute_query(query, params)
            if rows:
                return int(rows[0].get("doc_count", 0))
            return 0
        except Exception as e:
            logger.warning(f"Gagal menghitung frekuensi dokumen untuk boilerplate: {e}")
            return 0

# Singleton instance
vector_db = SupabaseVectorClient()

