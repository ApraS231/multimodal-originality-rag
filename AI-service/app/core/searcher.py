import logging
from app.config import settings
from app.db.supabase_client import vector_db
from app.core.embedder_text import get_text_embedder
from app.core.embedder_image import get_image_embedder

logger = logging.getLogger("AI-Service")

def rrf_combiner(dense_results: list[dict], sparse_results: list[dict], k: int = 60) -> list[dict]:
    """
    Menggabungkan hasil kueri pencarian semantik (dense) dan pencarian kata kunci (FTS)
    menggunakan algoritma Reciprocal Rank Fusion (RRF).
    """
    rrf_scores = {}
    
    # 1. Proses hasil dense
    for rank, item in enumerate(dense_results):
        point_id = str(item["id"])
        rank_val = rank + 1
        score = 1.0 / (k + rank_val)
        
        payload = {
            "id_laporan": item.get("id_laporan"),
            "id_mata_kuliah": str(item.get("id_mata_kuliah")) if item.get("id_mata_kuliah") else None,
            "page_number": item.get("page_number"),
            "text": item.get("text"),
            "bounding_box": item.get("bounding_box"),
            "program_studi": item.get("program_studi"),
            "mata_kuliah": item.get("mata_kuliah"),
            "tahun": item.get("tahun"),
            "author": item.get("author"),
            "is_template": item.get("is_template")
        }
        
        if point_id not in rrf_scores:
            rrf_scores[point_id] = {
                "rrf_score": score,
                "orig_score": float(item.get("similarity", 0.0)),
                "payload": payload,
                "dense_rank": rank_val,
                "sparse_rank": None
            }
        else:
            rrf_scores[point_id]["rrf_score"] += score
            rrf_scores[point_id]["dense_rank"] = rank_val
            
    # 2. Proses hasil sparse (PostgreSQL Full-Text Search)
    for rank, item in enumerate(sparse_results):
        point_id = str(item["id"])
        rank_val = rank + 1
        score = 1.0 / (k + rank_val)
        
        if point_id not in rrf_scores:
            payload = {
                "id_laporan": item.get("id_laporan"),
                "id_mata_kuliah": str(item.get("id_mata_kuliah")) if item.get("id_mata_kuliah") else None,
                "page_number": item.get("page_number"),
                "text": item.get("text"),
                "author": item.get("author"),
                "is_template": item.get("is_template")
            }
            rrf_scores[point_id] = {
                "rrf_score": score,
                "orig_score": float(item.get("rank", 0.0)),
                "payload": payload,
                "dense_rank": None,
                "sparse_rank": rank_val
            }
        else:
            rrf_scores[point_id]["rrf_score"] += score
            rrf_scores[point_id]["sparse_rank"] = rank_val
            
    # 3. Urutkan hasil gabungan berdasarkan rrf_score (descending)
    sorted_results = sorted(rrf_scores.items(), key=lambda x: x[1]["rrf_score"], reverse=True)
    
    combined_results = []
    for point_id, data in sorted_results:
        combined_results.append({
            "id": point_id,
            "score": data["orig_score"],
            "rrf_score": float(data["rrf_score"]),
            "payload": data["payload"],
            "dense_rank": data["dense_rank"],
            "sparse_rank": data["sparse_rank"]
        })
        
    return combined_results

class HybridSearcher:
    def __init__(self):
        self.rrf_k = settings.RRF_K

    def search_text(
        self,
        query_text: str,
        program_studi: str = None,
        mata_kuliah: str = None,
        tahun: int = None,
        limit: int = 10,
        exclude_id_laporan: str = None,
        id_mata_kuliah: str = None,
        is_template: bool = None
    ) -> list[dict]:
        """
        Melakukan pencarian hibrida (dense cosine similarity + sparse full-text search)
        pada tabel Supabase laporan_text_vectors dan menggabungkannya dengan RRF.
        """
        if not query_text or not query_text.strip():
            return []
            
        # 1. Generate dense embedding
        text_embedder = get_text_embedder()
        dense_vectors = text_embedder.encode_queries([query_text])
        dense_vector = dense_vectors[0] if dense_vectors else []
        
        # 2. Jalankan dense search via match_text_vectors RPC
        dense_results = []
        if dense_vector:
            try:
                # Format vector sebagai string atau list float untuk pgvector
                vec_arg = list(dense_vector) if hasattr(dense_vector, "tolist") else dense_vector
                dense_results = vector_db.execute_query(
                    """
                    SELECT * FROM match_text_vectors(
                        query_embedding := %s::extensions.vector,
                        match_threshold := 0.0,
                        match_count := %s,
                        filter_id_mata_kuliah := %s,
                        filter_program_studi := %s,
                        filter_mata_kuliah := %s,
                        filter_tahun := %s,
                        filter_is_template := %s,
                        exclude_id_laporan := %s
                    )
                    """,
                    (vec_arg, limit * 2, id_mata_kuliah, program_studi, mata_kuliah, tahun, is_template, exclude_id_laporan)
                )
            except Exception as e:
                logger.error(f"Gagal melakukan dense vector search: {str(e)}")
                
        # 3. Jalankan keyword search via search_text_keyword RPC
        sparse_results = []
        try:
            sparse_results = vector_db.execute_query(
                """
                SELECT * FROM search_text_keyword(
                    query_text := %s,
                    match_count := %s,
                    filter_id_mata_kuliah := %s,
                    exclude_id_laporan := %s
                )
                """,
                (query_text, limit * 2, id_mata_kuliah, exclude_id_laporan)
            )
        except Exception as e:
            logger.error(f"Gagal melakukan keyword full-text search: {str(e)}")
            
        # 4. Gabungkan hasil dengan RRF
        combined = rrf_combiner(dense_results, sparse_results, k=self.rrf_k)
        return combined[:limit]

    def search_image(
        self,
        image_bytes: bytes,
        program_studi: str = None,
        mata_kuliah: str = None,
        tahun: int = None,
        limit: int = 5,
        exclude_id_laporan: str = None,
        id_mata_kuliah: str = None
    ) -> list[dict]:
        """
        Melakukan pencarian kemiripan visual pada tabel Supabase laporan_image_vectors
        menggunakan visual vector dari model CLIP.
        """
        if not image_bytes:
            return []
            
        # 1. Generate CLIP visual features
        image_embedder = get_image_embedder()
        image_vector = image_embedder.embed_image(image_bytes)
        if not image_vector:
            return []
            
        # 2. Jalankan visual search via match_image_vectors RPC
        try:
            vec_arg = list(image_vector) if hasattr(image_vector, "tolist") else image_vector
            results = vector_db.execute_query(
                """
                SELECT * FROM match_image_vectors(
                    query_embedding := %s::extensions.vector,
                    match_threshold := 0.0,
                    match_count := %s,
                    filter_id_mata_kuliah := %s,
                    exclude_id_laporan := %s
                )
                """,
                (vec_arg, limit, id_mata_kuliah, exclude_id_laporan)
            )
            
            output = []
            for row in results:
                output.append({
                    "id": str(row["id"]),
                    "score": float(row.get("similarity", 0.0)),
                    "payload": {
                        "id_laporan": row.get("id_laporan"),
                        "page_number": row.get("page_number"),
                        "image_id": row.get("image_id"),
                        "bounding_box": row.get("bounding_box"),
                        "file_path": row.get("file_path"),
                        "author": row.get("author"),
                        "tahun": row.get("tahun"),
                        "source_file_name": row.get("source_file_name")
                    }
                })
            return output
            
        except Exception as e:
            logger.error(f"Gagal melakukan image visual search: {str(e)}")
            return []

# Singleton wrapper untuk HybridSearcher
_hybrid_searcher = None

def get_hybrid_searcher():
    global _hybrid_searcher
    if _hybrid_searcher is None:
        _hybrid_searcher = HybridSearcher()
    return _hybrid_searcher
