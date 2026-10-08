import torch
# Batasi alokasi thread PyTorch CPU ke 1 untuk efisiensi memori di shared server
torch.set_num_threads(1)
from sentence_transformers import SentenceTransformer
import logging

logger = logging.getLogger("AI-Service")

class TextChunker:
    def __init__(self, chunk_size: int = 250, overlap: int = 50):
        self.chunk_size = chunk_size
        self.overlap = overlap

    def chunk(self, words_or_text, page_number: int) -> list:
        return self.chunk_page_words(words_or_text, page_number, self.chunk_size, self.overlap)

    @staticmethod
    def chunk_page_words(words_with_geometry, page_number: int, chunk_size: int = 250, overlap: int = 50) -> list:
        """
        Memotong daftar kata berkoordinat atau string teks biasa dari suatu halaman PDF
        menjadi chunk-chunk teks berukuran maksimal chunk_size dengan overlap sejumlah kata tertentu.
        Menghasilkan bounding box gabungan untuk setiap chunk.
        """
        chunks = []
        if not words_with_geometry:
            return chunks

        # Jika masukan berupa string teks mentah, konversi ke format kata dengan geometri dasar
        if isinstance(words_with_geometry, str):
            words = words_with_geometry.split()
            words_with_geometry = [{"text": w, "x1": 0.0, "y1": 0.0, "x2": 0.0, "y2": 0.0} for w in words]

        step = chunk_size - overlap
        if step <= 0:
            step = chunk_size

        idx = 0
        while idx < len(words_with_geometry):
            end_idx = min(idx + chunk_size, len(words_with_geometry))
            words_slice = words_with_geometry[idx : end_idx]

            x1 = min(w.get("x1", 0.0) for w in words_slice)
            y1 = min(w.get("y1", 0.0) for w in words_slice)
            x2 = max(w.get("x2", 0.0) for w in words_slice)
            y2 = max(w.get("y2", 0.0) for w in words_slice)

            text = " ".join(w.get("text", "") for w in words_slice)

            bbox = {
                "x1": float(x1),
                "y1": float(y1),
                "x2": float(x2),
                "y2": float(y2)
            }

            chunks.append({
                "text": text,
                "page_number": page_number,
                "bounding_box": bbox,
                "metadata": {
                    "page_number": page_number,
                    "bounding_box": bbox
                }
            })

            if end_idx == len(words_with_geometry):
                break
            idx += step

        return chunks

import os

class TextEmbedder:
    def __init__(self, model_name: str = "intfloat/multilingual-e5-base"):
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        
        # Cek apakah ada local fine-tuned model sbert_v2
        local_model_path = os.path.abspath("app/models/sbert_v2")
        if os.path.exists(os.path.join(local_model_path, "config.json")):
            logger.info(f"Menemukan model SBERT hasil fine-tuning lokal. Memuat dari: {local_model_path}")
            model_name = local_model_path
            
        logger.info(f"Menginisialisasi TextEmbedder dengan model: {model_name} ({self.device})")
        self.model = SentenceTransformer(model_name, device=self.device)
        logger.info("TextEmbedder berhasil dimuat.")

    def load_model(self, model_path_or_name: str):
        """
        Hot-swapping bobot model secara runtime (aktif di memori) tanpa restart server.
        """
        logger.info(f"Memicu hot-swapping model SBERT ke: {model_path_or_name}")
        self.model = SentenceTransformer(model_path_or_name, device=self.device)
        logger.info("Hot-swapping model SBERT sukses.")


    def encode_passages(self, texts: list[str], batch_size: int = 32) -> list[list[float]]:
        """
        Mengodekan passages (paragraf/dokumen untuk database) dengan menyisipkan prefix 'passage: '
        sesuai spesifikasi model E5.
        """
        if not texts:
            return []
        processed_texts = [f"passage: {t}" for t in texts]
        embeddings = self.model.encode(processed_texts, batch_size=batch_size, show_progress_bar=False)
        return embeddings.tolist()

    def encode_queries(self, texts: list[str], batch_size: int = 32) -> list[list[float]]:
        """
        Mengodekan kueri pencarian dengan menyisipkan prefix 'query: ' sesuai spesifikasi model E5.
        """
        if not texts:
            return []
        processed_texts = [f"query: {t}" for t in texts]
        embeddings = self.model.encode(processed_texts, batch_size=batch_size, show_progress_bar=False)
        return embeddings.tolist()

# Singleton wrapper untuk menghemat memori
_text_embedder = None

def get_text_embedder():
    global _text_embedder
    if _text_embedder is None:
        _text_embedder = TextEmbedder()
    return _text_embedder
