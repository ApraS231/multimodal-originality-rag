import pytest
import io
from PIL import Image
from unittest.mock import MagicMock, patch
from qdrant_client.http import models
from app.core.searcher import SparseEmbedder, rrf_combiner, HybridSearcher, get_hybrid_searcher

def generate_dummy_image_bytes() -> bytes:
    img = Image.new("RGB", (150, 150), color="red")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()

# Class mock sederhana untuk mensimulasikan ScoredPoint dari Qdrant
class MockScoredPoint:
    def __init__(self, id_val, score_val, payload_val=None):
        self.id = id_val
        self.score = score_val
        self.payload = payload_val or {}

def test_sparse_embedder_determinism_and_sorting():
    text = "Sistem Deteksi Orisinalitas Laporan Praktikum STITEK Bontang."
    
    # Run 1
    res1 = SparseEmbedder.encode(text)
    assert "indices" in res1
    assert "values" in res1
    assert len(res1["indices"]) == len(res1["values"])
    
    # Run 2 (cek determinisme)
    res2 = SparseEmbedder.encode(text)
    assert res1["indices"] == res2["indices"]
    assert res1["values"] == res2["values"]
    
    # Cek apakah terurut secara menaik (ascending)
    indices = res1["indices"]
    for i in range(len(indices) - 1):
        assert indices[i] < indices[i+1]
        
    # Input kosong
    res_empty = SparseEmbedder.encode("")
    assert res_empty["indices"] == []
    assert res_empty["values"] == []

def test_rrf_combiner():
    # Dense results (Rank 1: docA, Rank 2: docB)
    dense_res = [
        MockScoredPoint(id_val="docA", score_val=0.9, payload_val={"title": "Doc A"}),
        MockScoredPoint(id_val="docB", score_val=0.8, payload_val={"title": "Doc B"}),
    ]
    
    # Sparse results (Rank 1: docC, Rank 2: docA)
    sparse_res = [
        MockScoredPoint(id_val="docC", score_val=0.7, payload_val={"title": "Doc C"}),
        MockScoredPoint(id_val="docA", score_val=0.6, payload_val={"title": "Doc A"}),
    ]
    
    # Jalankan combiner dengan k=60
    k = 60
    combined = rrf_combiner(dense_res, sparse_res, k=k)
    
    # Verifikasi jumlah hasil unik (docA, docB, docC)
    assert len(combined) == 3
    
    # Hitung manual skor RRF
    # docA: dense_rank = 1 (score = 1 / (60+1)), sparse_rank = 2 (score = 1 / (60+2))
    # rrf(docA) = 1/61 + 1/62 = 0.01639344 + 0.01612903 = 0.03252247
    # docC: dense_rank = None, sparse_rank = 1 (score = 1 / (60+1))
    # rrf(docC) = 1/61 = 0.01639344
    # docB: dense_rank = 2 (score = 1 / (60+2)), sparse_rank = None
    # rrf(docB) = 1/62 = 0.01612903
    
    # Harus diurutkan: docA (0.0325), docC (0.0163), docB (0.0161)
    assert combined[0]["id"] == "docA"
    assert combined[1]["id"] == "docC"
    assert combined[2]["id"] == "docB"
    
    assert pytest.approx(combined[0]["rrf_score"], abs=1e-5) == (1/61 + 1/62)
    assert pytest.approx(combined[1]["rrf_score"], abs=1e-5) == (1/61)
    assert pytest.approx(combined[2]["rrf_score"], abs=1e-5) == (1/62)
    
    # Verifikasi payload terangkut dengan benar
    assert combined[0]["payload"]["title"] == "Doc A"
    assert combined[0]["dense_rank"] == 1
    assert combined[0]["sparse_rank"] == 2

@patch('app.core.searcher.qdrant_client')
def test_hybrid_searcher_text_and_image(mock_qdrant):
    # Mock search response
    mock_qdrant.search.side_effect = [
        # Response untuk dense search
        [MockScoredPoint(id_val="doc1", score_val=0.85, payload_val={"text": "paragraf 1"})],
        # Response untuk sparse search
        [MockScoredPoint(id_val="doc2", score_val=0.75, payload_val={"text": "paragraf 2"})]
    ]
    
    searcher = get_hybrid_searcher()
    assert searcher is not None
    
    # Jalankan search_text
    results = searcher.search_text(
        query_text="praktikum algoritma",
        program_studi="Teknik Informatika",
        mata_kuliah="Struktur Data",
        tahun=2026,
        limit=5
    )
    
    # Verifikasi pemanggilan mock qdrant.search sebanyak 2 kali (dense + sparse)
    assert mock_qdrant.search.call_count == 2
    
    # Verifikasi hasil gabungan RRF
    assert len(results) == 2
    assert results[0]["id"] == "doc1"
    assert results[1]["id"] == "doc2"
    
    # Reset mock call count dan bersihkan side_effect
    mock_qdrant.search.reset_mock()
    mock_qdrant.search.side_effect = None
    
    # Mock response untuk image search (CLIP)
    mock_qdrant.search.return_value = [
        MockScoredPoint(id_val="img1", score_val=0.92, payload_val={"image_id": "img_p3_0"})
    ]
    
    # Jalankan search_image dengan gambar dummy yang valid
    valid_image_bytes = generate_dummy_image_bytes()
    img_results = searcher.search_image(
        image_bytes=valid_image_bytes,
        program_studi="Teknik Informatika",
        limit=3
    )
    
    assert mock_qdrant.search.call_count == 1
    assert len(img_results) == 1
    assert img_results[0]["id"] == "img1"
    assert img_results[0]["score"] == 0.92
