import os
import logging
import asyncio
from torch.utils.data import DataLoader
from sentence_transformers import InputExample, losses

from app.db.supabase_client import vector_db
from app.core.embedder_text import get_text_embedder

logger = logging.getLogger("AI-Service")

class ModelFineTuner:
    def __init__(self):
        self.local_model_path = os.path.abspath("app/models/sbert_v2")

    def get_verified_laporan_ids(self, id_mata_kuliah: str = None) -> list[str]:
        """
        Mendapatkan ID laporan dari database relasional yang memenuhi kriteria drift protection:
        skor_orisinalitas > 75.0 AND apakah_diverifikasi = True.
        Dapat dibatasi per mata kuliah jika id_mata_kuliah diberikan.
        """
        try:
            logger.info("Menghubungkan ke Supabase untuk menarik ID laporan terverifikasi...")
            if id_mata_kuliah:
                query = """
                    SELECT id_laporan FROM public.laporan 
                    WHERE (skor_orisinalitas > 75.0 OR skor_orisinalitas_koreksi > 75.0) 
                      AND apakah_diverifikasi = TRUE
                      AND id_mata_kuliah = %s;
                """
                rows = vector_db.execute_query(query, (id_mata_kuliah,))
            else:
                query = """
                    SELECT id_laporan FROM public.laporan 
                    WHERE (skor_orisinalitas > 75.0 OR skor_orisinalitas_koreksi > 75.0) 
                      AND apakah_diverifikasi = TRUE;
                """
                rows = vector_db.execute_query(query)

            ids = [str(row["id_laporan"]) for row in rows if row.get("id_laporan")]
            logger.info(f"Berhasil menarik {len(ids)} ID Laporan terverifikasi.")
            return ids
        except Exception as e:
            logger.error(f"Gagal menarik ID laporan dari database relasional: {str(e)}")
            return []

    def get_training_texts(self, laporan_ids: list[str]) -> list[str]:
        """
        Menarik seluruh chunk teks non-template dari tabel laporan_text_vectors
        yang berasosiasi dengan ID laporan terverifikasi.
        """
        if not laporan_ids:
            return []
            
        logger.info(f"Menarik chunk teks dari Supabase untuk {len(laporan_ids)} laporan...")
        try:
            query = """
                SELECT text FROM public.laporan_text_vectors 
                WHERE id_laporan = ANY(%s) 
                  AND (is_template IS FALSE OR is_template IS NULL)
                  AND LENGTH(text) > 30;
            """
            rows = vector_db.execute_query(query, (laporan_ids,))
            texts = [r["text"].strip() for r in rows if r.get("text") and r["text"].strip()]
            logger.info(f"Berhasil mengumpulkan {len(texts)} kalimat latihan dari Supabase.")
            return texts
        except Exception as e:
            logger.error(f"Gagal menarik kalimat latihan: {str(e)}")
            return []

    def get_seeding_texts(self, id_mata_kuliah: str = None) -> list[str]:
        """
        Menarik chunk teks langsung dari tabel laporan_text_vectors
        (untuk mode seeding/cold-start saat laporan relasional baru saja di-ingest).
        """
        try:
            logger.info("Menarik naskah teks langsung dari laporan_text_vectors...")
            if id_mata_kuliah:
                query = """
                    SELECT text FROM public.laporan_text_vectors 
                    WHERE id_mata_kuliah = %s 
                      AND (is_template IS FALSE OR is_template IS NULL)
                      AND LENGTH(text) > 30
                    LIMIT 2500;
                """
                rows = vector_db.execute_query(query, (id_mata_kuliah,))
            else:
                query = """
                    SELECT text FROM public.laporan_text_vectors 
                    WHERE (is_template IS FALSE OR is_template IS NULL)
                      AND LENGTH(text) > 30
                    LIMIT 2500;
                """
                rows = vector_db.execute_query(query)
            texts = [r["text"].strip() for r in rows if r.get("text") and r["text"].strip()]
            logger.info(f"Berhasil mengumpulkan {len(texts)} kalimat seeding langsung dari vektor Supabase.")
            return texts
        except Exception as e:
            logger.error(f"Gagal menarik kalimat seeding dari laporan_text_vectors: {str(e)}")
            return []

    def run_fine_tuning(self, id_mata_kuliah: str = None) -> bool:
        """
        Menjalankan proses fine-tuning SBERT secara sinkronus.
        Memprioritaskan naskah terverifikasi (drift protection) dan 
        menggunakan naskah seeding dari laporan_text_vectors sebagai jalur sekunder.
        """
        try:
            # 1. Tarik ID laporan terverifikasi (drift protection)
            laporan_ids = self.get_verified_laporan_ids(id_mata_kuliah)
            
            # 2. Ambil kalimat latihan dari laporan terverifikasi
            texts = self.get_training_texts(laporan_ids)
            
            # 3. Fallback jalur seeding (mengambil langsung dari tabel vektor)
            if not texts:
                logger.info("Mencoba mengambil korpus latihan dari mode seeding...")
                texts = self.get_seeding_texts(id_mata_kuliah)
                
            # 4. Fallback jika basis data masih kosong
            if not texts:
                logger.info("Menggunakan dummy texts untuk keperluan testing/cold start model fine-tuning...")
                texts = [
                    "Ini adalah kalimat latihan untuk fine-tuning model Sentence-BERT.",
                    "Model Sentence-BERT dilatih menggunakan teknik representasi semantik.",
                    "Optimasi model drift protection membatasi dataset pada laporan orisinal.",
                    "Pencegahan data poisoning dilakukan dengan menyaring data laporan plagiat.",
                    "Sistem deteksi orisinalitas berjalan di lingkungan kampus STITEK Bontang."
                ]
                
            logger.info(f"Memulai proses training/fine-tuning SBERT dengan {len(texts)} sampel kalimat...")
            embedder = get_text_embedder()
            model = embedder.model
            
            # 5. Siapkan dataset (SimCSE unsupervised format: pair of identical sentences)
            train_examples = [InputExample(texts=[text, text]) for text in texts]
            batch_size = min(16, max(2, len(train_examples)))
            train_dataloader = DataLoader(train_examples, shuffle=True, batch_size=batch_size)
            train_loss = losses.MultipleNegativesRankingLoss(model=model)
            
            # 6. Latih model SBERT
            model.fit(
                train_objectives=[(train_dataloader, train_loss)],
                epochs=1,
                show_progress_bar=False
            )
            
            # 7. Simpan bobot baru ke folder local
            os.makedirs(self.local_model_path, exist_ok=True)
            model.save(self.local_model_path)
            logger.info(f"Model baru berhasil disimpan di: {self.local_model_path}")
            
            # 8. Memicu Hot-swapping model aktif pada TextEmbedder singleton
            embedder.load_model(self.local_model_path)
            
            # 9. Audit log pelatihan ke Supabase
            try:
                log_query = """
                    INSERT INTO public.prototype_training_log (
                        id_mata_kuliah, trigger_type, original_samples, created_at
                    ) VALUES (%s, %s, %s, NOW());
                """
                vector_db.execute_query(log_query, (id_mata_kuliah or "GLOBAL", "manual_retrain", len(texts)), fetch=False)
                logger.info("Log audit pelatihan prototype berhasil disimpan ke Supabase.")
            except Exception as log_err:
                logger.warning(f"Gagal mencatat log audit pelatihan prototype: {log_err}")
                
            return True
            
        except Exception as e:
            logger.error(f"Gagal menjalankan fine-tuning SBERT: {str(e)}")
            return False

    async def run_fine_tuning_async(self, id_mata_kuliah: str = None) -> bool:
        """
        Menjalankan proses fine-tuning secara asinkronus (di background threadpool).
        """
        return await asyncio.to_thread(self.run_fine_tuning, id_mata_kuliah)

