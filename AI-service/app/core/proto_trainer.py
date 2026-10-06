import logging
import time
from typing import Dict, List, Optional, Tuple, Union

import numpy as np
import torch
import torch.optim as optim

from app.config import settings
from app.core.proto_head import get_proto_head
from app.db.supabase_client import vector_db

logger = logging.getLogger("AI-Service")

# In-memory runtime cache untuk centroid per mata kuliah
# Format: {id_mata_kuliah: {"template": np.ndarray, "original": np.ndarray, "cached_at": float}}
_COURSE_CENTROIDS_CACHE: Dict[str, dict] = {}
_HITL_CORRECTION_COUNTERS: Dict[str, int] = {}

class ProtoTrainer:
    """
    Manajer pelatihan dan lifecycle Prototypical Head per mata kuliah.
    Mengelola penarikan data latih dari Supabase, pelatihan episodik,
    penyimpanan centroid ke database, dan penyediaan centroid untuk inferensi.
    """
    def __init__(self):
        self.proto_head = get_proto_head()

    def collect_training_data(self, id_mata_kuliah: str) -> Tuple[List[np.ndarray], List[np.ndarray]]:
        """
        Menarik embedding template dan konten orisinal khusus mata kuliah dari Supabase.
        """
        if not id_mata_kuliah:
            return [], []

        # 1. Tarik sample template
        template_query = """
            SELECT embedding 
            FROM public.laporan_text_vectors 
            WHERE id_mata_kuliah = %s AND is_template = TRUE
            LIMIT 2000;
        """
        template_rows = vector_db.execute_query(template_query, (id_mata_kuliah,)) or []
        templates = []
        for r in template_rows:
            emb = r.get("embedding")
            if emb is not None:
                templates.append(np.array(emb, dtype=np.float32))

        # 2. Tarik sample orisinal (utamakan dari laporan terverifikasi)
        original_query = """
            SELECT ltv.embedding 
            FROM public.laporan_text_vectors ltv
            JOIN public.laporan l ON ltv.id_laporan::uuid = l.id_laporan
            WHERE ltv.id_mata_kuliah = %s 
              AND ltv.is_template IS NOT TRUE
              AND (l.skor_orisinalitas > 70.0 OR l.skor_orisinalitas_koreksi > 70.0)
              AND l.apakah_diverifikasi = TRUE
            LIMIT 2000;
        """
        original_rows = []
        try:
            original_rows = vector_db.execute_query(original_query, (id_mata_kuliah,)) or []
        except Exception as e:
            logger.warning(f"Gagal mengambil sample terverifikasi, menggunakan fallback: {e}")

        # Fallback jika belum ada laporan yang diverifikasi
        if len(original_rows) < 5:
            fallback_query = """
                SELECT embedding 
                FROM public.laporan_text_vectors 
                WHERE id_mata_kuliah = %s AND (is_template IS FALSE OR is_template IS NULL)
                LIMIT 2000;
            """
            original_rows = vector_db.execute_query(fallback_query, (id_mata_kuliah,)) or []

        originals = []
        for r in original_rows:
            emb = r.get("embedding")
            if emb is not None:
                originals.append(np.array(emb, dtype=np.float32))

        logger.info(
            f"Terkumpul data latih mata kuliah ({id_mata_kuliah}): "
            f"{len(templates)} template, {len(originals)} original."
        )
        return templates, originals

    def train_and_store(
        self,
        id_mata_kuliah: str,
        epochs: int = None,
        trigger_type: str = "manual_retrain"
    ) -> dict:
        """
        Melatih Prototypical Head untuk mata kuliah tertentu dan menyimpan
        centroid hasil proyeksi ke Supabase tabel course_prototypes.
        """
        if not id_mata_kuliah:
            return {"status": "error", "message": "id_mata_kuliah wajib disertakan"}

        epochs = epochs or settings.PROTO_EPOCHS
        templates, originals = self.collect_training_data(id_mata_kuliah)

        n_templates = len(templates)
        n_originals = len(originals)

        # Validasi batas minimal data
        if n_templates == 0 or n_originals == 0:
            logger.warning(
                f"Data tidak cukup untuk mata kuliah {id_mata_kuliah}: "
                f"{n_templates} template, {n_originals} original."
            )
            return {
                "status": "skipped",
                "message": "Data tidak cukup. Diperlukan minimal 1 sampel template dan 1 sampel orisinal.",
                "template_count": n_templates,
                "original_count": n_originals
            }

        # Kasus Cold-Start: Sampel sedikit (< 3), hitung centroid langsung tanpa gradient update
        if n_templates < 3 or n_originals < 3:
            logger.info(f"Menggunakan cold-start centroid calculation untuk mata kuliah {id_mata_kuliah}.")
            t_proj = self.proto_head.project_numpy(templates)
            o_proj = self.proto_head.project_numpy(originals)
            
            c_template = np.mean(t_proj, axis=0)
            c_template = c_template / (np.linalg.norm(c_template) + 1e-8)
            
            c_original = np.mean(o_proj, axis=0)
            c_original = c_original / (np.linalg.norm(c_original) + 1e-8)
            
            self._upsert_centroids(id_mata_kuliah, c_template, c_original, n_templates, n_originals, model_version="v0-coldstart")
            self._log_training(id_mata_kuliah, trigger_type, n_templates, n_originals, 0.0, 0.0)
            self._update_cache(id_mata_kuliah, c_template, c_original)
            
            return {
                "status": "success",
                "mode": "cold_start",
                "template_count": n_templates,
                "original_count": n_originals,
                "model_version": "v0-coldstart"
            }

        # Pelatihan Penuh dengan Prototypical Loss
        all_embeddings = np.vstack([templates, originals])
        all_labels = np.array([1] * n_templates + [0] * n_originals, dtype=np.int64)

        device = self.proto_head.device
        emb_tensor = torch.as_tensor(all_embeddings, dtype=torch.float32, device=device)
        lbl_tensor = torch.as_tensor(all_labels, dtype=torch.int64, device=device)

        optimizer = optim.Adam(self.proto_head.parameters(), lr=settings.PROTO_LR, weight_decay=1e-4)
        self.proto_head.train()

        loss_before = None
        loss_after = None

        # Episode loop
        n_samples = len(all_embeddings)
        batch_size = min(32, n_samples)
        
        for epoch in range(epochs):
            # Acak indeks untuk support set dan query set
            perm = torch.randperm(n_samples, device=device)
            split_idx = max(2, int(0.6 * n_samples))
            
            supp_idx = perm[:split_idx]
            query_idx = perm[split_idx:]
            
            # Pastikan kedua set memiliki kedua kelas jika memungkinkan
            s_emb, s_lbl = emb_tensor[supp_idx], lbl_tensor[supp_idx]
            q_emb, q_lbl = emb_tensor[query_idx], lbl_tensor[query_idx]
            
            if len(torch.unique(s_lbl)) < 2 or len(torch.unique(q_lbl)) < 2:
                # Fallback: gunakan split berstrata sederhana
                t_idx = torch.where(lbl_tensor == 1)[0]
                o_idx = torch.where(lbl_tensor == 0)[0]
                
                t_half = len(t_idx) // 2
                o_half = len(o_idx) // 2
                
                supp_idx = torch.cat([t_idx[:t_half], o_idx[:o_half]])
                query_idx = torch.cat([t_idx[t_half:], o_idx[o_half:]])
                
                s_emb, s_lbl = emb_tensor[supp_idx], lbl_tensor[supp_idx]
                q_emb, q_lbl = emb_tensor[query_idx], lbl_tensor[query_idx]

            optimizer.zero_grad()
            loss, acc = self.proto_head.compute_prototypical_loss(
                s_emb, s_lbl, q_emb, q_lbl, temperature=settings.PROTO_TEMPERATURE
            )
            
            if loss_before is None:
                loss_before = float(loss.item())
                
            loss.backward()
            optimizer.step()
            loss_after = float(loss.item())

        self.proto_head.eval()
        self.proto_head.save_weights()

        # Hitung Centroid Final menggunakan seluruh dataset yang telah diproyeksikan
        with torch.no_grad():
            final_proj = self.proto_head(emb_tensor)
            centroids_dict = self.proto_head.compute_centroids(final_proj, lbl_tensor)
            c_original = centroids_dict[0].cpu().numpy()
            c_template = centroids_dict[1].cpu().numpy()

        # Simpan ke Supabase
        self._upsert_centroids(id_mata_kuliah, c_template, c_original, n_templates, n_originals, model_version="v1")
        self._log_training(id_mata_kuliah, trigger_type, n_templates, n_originals, loss_before, loss_after)
        self._update_cache(id_mata_kuliah, c_template, c_original)

        logger.info(
            f"Selesai melatih Prototypical Head untuk mata kuliah ({id_mata_kuliah}): "
            f"Loss awal={loss_before:.4f}, Loss akhir={loss_after:.4f}"
        )

        return {
            "status": "success",
            "mode": "trained",
            "id_mata_kuliah": id_mata_kuliah,
            "template_count": n_templates,
            "original_count": n_originals,
            "loss_before": round(loss_before, 4) if loss_before else 0.0,
            "loss_after": round(loss_after, 4) if loss_after else 0.0,
            "model_version": "v1"
        }

    def _upsert_centroids(
        self,
        id_mata_kuliah: str,
        c_template: np.ndarray,
        c_original: np.ndarray,
        template_count: int,
        original_count: int,
        model_version: str = "v1"
    ):
        """Menyimpan atau memperbarui centroid di tabel course_prototypes."""
        upsert_query = """
            INSERT INTO public.course_prototypes 
                (id_mata_kuliah, class_label, centroid, sample_count, last_trained_at, model_version)
            VALUES 
                (%s, 'template', %s::extensions.vector, %s, NOW(), %s),
                (%s, 'original', %s::extensions.vector, %s, NOW(), %s)
            ON CONFLICT (id_mata_kuliah, class_label)
            DO UPDATE SET 
                centroid = EXCLUDED.centroid,
                sample_count = EXCLUDED.sample_count,
                last_trained_at = NOW(),
                model_version = EXCLUDED.model_version;
        """
        vector_db.execute_query(
            upsert_query,
            (
                id_mata_kuliah, c_template.tolist(), template_count, model_version,
                id_mata_kuliah, c_original.tolist(), original_count, model_version
            ),
            fetch=False
        )

    def _log_training(
        self,
        id_mata_kuliah: str,
        trigger_type: str,
        t_count: int,
        o_count: int,
        l_before: Optional[float],
        l_after: Optional[float]
    ):
        """Mencatat aktivitas pelatihan ke tabel prototype_training_log."""
        try:
            log_query = """
                INSERT INTO public.prototype_training_log
                    (id_mata_kuliah, trigger_type, template_samples, original_samples, loss_before, loss_after)
                VALUES (%s, %s, %s, %s, %s, %s);
            """
            vector_db.execute_query(
                log_query,
                (id_mata_kuliah, trigger_type, t_count, o_count, l_before, l_after),
                fetch=False
            )
        except Exception as e:
            logger.warning(f"Gagal mencatat log pelatihan prototype: {e}")

    def _update_cache(self, id_mata_kuliah: str, c_template: np.ndarray, c_original: np.ndarray):
        """Memperbarui cache in-memory untuk inferensi cepat."""
        _COURSE_CENTROIDS_CACHE[id_mata_kuliah] = {
            "template": c_template,
            "original": c_original,
            "cached_at": time.time()
        }

    def load_centroids(self, id_mata_kuliah: str) -> Optional[Dict[str, np.ndarray]]:
        """
        Memuat centroid untuk mata kuliah tertentu dari in-memory cache atau Supabase.
        """
        if not id_mata_kuliah:
            return None

        # Cek in-memory cache (TTL 10 menit)
        cached = _COURSE_CENTROIDS_CACHE.get(id_mata_kuliah)
        if cached and (time.time() - cached.get("cached_at", 0) < 600):
            return {
                "template": cached["template"],
                "original": cached["original"]
            }

        # Query database jika tidak di cache
        query = """
            SELECT class_label, centroid 
            FROM public.course_prototypes 
            WHERE id_mata_kuliah = %s;
        """
        try:
            rows = vector_db.execute_query(query, (id_mata_kuliah,))
            if not rows or len(rows) < 2:
                return None

            centroids = {}
            for r in rows:
                centroids[r["class_label"]] = np.array(r["centroid"], dtype=np.float32)

            if "template" in centroids and "original" in centroids:
                self._update_cache(id_mata_kuliah, centroids["template"], centroids["original"])
                return centroids
        except Exception as e:
            logger.warning(f"Gagal memuat centroid untuk mata kuliah {id_mata_kuliah}: {e}")

        return None

    def classify_chunk(
        self,
        raw_embedding: Union[List[float], np.ndarray],
        id_mata_kuliah: str
    ) -> Optional[dict]:
        """
        Mengklasifikasikan embedding chunk 768d terhadap centroid mata kuliah tertentu.
        
        Returns:
            Dict hasil klasifikasi jika centroid tersedia, atau None jika belum ada centroid.
        """
        centroids = self.load_centroids(id_mata_kuliah)
        if not centroids:
            return None

        projected = self.proto_head.project_numpy(raw_embedding)
        return self.proto_head.classify_with_centroids(
            projected,
            centroids,
            temperature=settings.PROTO_TEMPERATURE
        )

    def on_hitl_correction(self, id_mata_kuliah: str):
        """
        Dipanggil saat ada koreksi Human-in-the-Loop (HITL).
        Mengakumulasi hitungan dan memicu retraining otomatis saat batas ambang tercapai.
        """
        if not id_mata_kuliah:
            return

        current_count = _HITL_CORRECTION_COUNTERS.get(id_mata_kuliah, 0) + 1
        _HITL_CORRECTION_COUNTERS[id_mata_kuliah] = current_count
        logger.info(
            f"Akumulasi koreksi HITL mata kuliah ({id_mata_kuliah}): "
            f"{current_count}/{settings.PROTO_RETRAIN_BATCH_SIZE}"
        )

        if current_count >= settings.PROTO_RETRAIN_BATCH_SIZE:
            logger.info(f"Ambang batas koreksi tercapai. Memicu retraining otomatis untuk {id_mata_kuliah}...")
            # Simpan centroid lama untuk perbandingan drift
            old_centroids = self.load_centroids(id_mata_kuliah)

            _HITL_CORRECTION_COUNTERS[id_mata_kuliah] = 0
            result = self.train_and_store(id_mata_kuliah, trigger_type="hitl_correction")

            # Deteksi pergeseran centroid (drift)
            if old_centroids and result.get("status") == "success":
                new_centroids = self.load_centroids(id_mata_kuliah)
                if new_centroids:
                    drift_t = float(np.linalg.norm(new_centroids["template"] - old_centroids["template"]))
                    drift_o = float(np.linalg.norm(new_centroids["original"] - old_centroids["original"]))

                    if drift_t > settings.DRIFT_ANOMALY_THRESHOLD or drift_o > settings.DRIFT_ANOMALY_THRESHOLD:
                        logger.warning(
                            f"ANOMALY DRIFT terdeteksi untuk mata kuliah {id_mata_kuliah}: "
                            f"drift_template={drift_t:.4f}, drift_original={drift_o:.4f}"
                        )
                        # Log ke database agar admin dapat mengaudit
                        self._log_training(
                            id_mata_kuliah, "FLAGGED_DRIFT",
                            0, 0, drift_t, drift_o
                        )


# Singleton instance
_proto_trainer_instance: Optional[ProtoTrainer] = None

def get_proto_trainer() -> ProtoTrainer:
    """Mengembalikan singleton instance ProtoTrainer."""
    global _proto_trainer_instance
    if _proto_trainer_instance is None:
        _proto_trainer_instance = ProtoTrainer()
    return _proto_trainer_instance
