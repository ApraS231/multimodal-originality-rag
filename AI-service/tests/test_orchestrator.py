import pytest
from unittest.mock import patch, AsyncMock, MagicMock
from app.core.orchestrator import (
    filter_templates_node,
    verify_plagiarism_node,
    generate_feedback_node,
    app_graph
)

# Gunakan mark asyncio agar pytest dapat menjalankan fungsi test async
pytestmark = pytest.mark.anyio

def test_filter_templates_node():
    # Buat state input dengan 2 chunk:
    # 1. Chunk template (ada di cache in-memory)
    # 2. Chunk biasa (non-template)
    state = {
        "chunks": [
            {
                "chunk_index": 0,
                "text": "Alat dan bahan yang digunakan dalam praktikum ini adalah laptop dan Laragon.",
                "metadata": {"page": 1},
                "qdrant_matches": []
            },
            {
                "chunk_index": 1,
                "text": "Ini adalah analisis algoritma bubble sort yang dikembangkan sendiri.",
                "metadata": {"page": 1},
                "qdrant_matches": [
                    {
                        "id": "match1",
                        "score": 0.88,
                        "payload": {"is_template": True, "text": "Ini template"}
                    }
                ]
            },
            {
                "chunk_index": 2,
                "text": "Kalimat orisinal buatan mahasiswa yang tidak mirip apa pun.",
                "metadata": {"page": 2},
                "qdrant_matches": []
            }
        ],
        "verified_chunks": []
    }
    
    res = filter_templates_node(state)
    
    # Chunk 0 dan Chunk 1 harus terdeteksi sebagai template
    # Chunk 0: Dari in-memory cache match.
    # Chunk 1: Dari Qdrant matches (is_template = True & score = 0.88)
    assert len(res["verified_chunks"]) == 2
    assert res["verified_chunks"][0]["chunk_index"] == 0
    assert res["verified_chunks"][0]["plagiat"] is False
    assert "Template praktikum" in res["verified_chunks"][0]["reason"]
    
    assert res["verified_chunks"][1]["chunk_index"] == 1
    assert res["verified_chunks"][1]["plagiat"] is False
    
    # Sisanya (Chunk 2) harus tertinggal di list "chunks" untuk diproses node berikutnya
    assert len(res["chunks"]) == 1
    assert res["chunks"][0]["chunk_index"] == 2

@patch('app.core.orchestrator.call_ollama', new_callable=AsyncMock)
async def test_verify_plagiarism_node_online(mock_call_ollama):
    # Mock respons dari Ollama
    mock_call_ollama.return_value = {
        "text": '{"plagiat": true, "reason": "Teks A menjiplak dengan memodifikasi struktur kalimat"}',
        "prompt_tokens": 100,
        "completion_tokens": 20
    }
    
    state = {
        "chunks": [
            {
                "chunk_index": 0,
                "text": "Algoritma pencarian biner membagi ruang pencarian menjadi dua bagian.",
                "metadata": {"page": 2},
                "qdrant_matches": [
                    {
                        "id": "match_student",
                        "score": 0.82, # Similarity > 0.60
                        "payload": {"is_template": False, "text": "Pencarian biner membelah data menjadi dua."}
                    }
                ]
            }
        ],
        "verified_chunks": []
    }
    
    res = await verify_plagiarism_node(state)
    
    # Cek pemanggilan mock
    mock_call_ollama.assert_called_once()
    
    # Cek apakah ditandai plagiat sesuai keputusan LLM
    assert len(res["verified_chunks"]) == 1
    assert res["verified_chunks"][0]["plagiat"] is True
    assert "menjiplak" in res["verified_chunks"][0]["reason"]
    
    # Cek token usage
    assert res["token_usage"]["prompt_tokens"] == 100
    assert res["token_usage"]["completion_tokens"] == 20
    assert res["token_usage"]["total_tokens"] == 120

@patch('app.core.orchestrator.call_ollama', new_callable=AsyncMock)
async def test_verify_plagiarism_node_offline_fallback(mock_call_ollama):
    # Buat Ollama melemparkan Exception (koneksi gagal)
    mock_call_ollama.side_effect = Exception("Connection Refused")
    
    state = {
        "chunks": [
            {
                "chunk_index": 0,
                "text": "Teks dengan kemiripan sangat tinggi.",
                "metadata": {"page": 2},
                "qdrant_matches": [{"id": "m1", "score": 0.85, "payload": {"text": "Teks pembanding sangat mirip"}}]
            },
            {
                "chunk_index": 1,
                "text": "Teks dengan kemiripan moderat.",
                "metadata": {"page": 2},
                "qdrant_matches": [{"id": "m2", "score": 0.68, "payload": {"text": "Teks pembanding moderat"}}]
            }
        ],
        "verified_chunks": []
    }
    
    res = await verify_plagiarism_node(state)
    
    # Cek apakah fallback heuristik bekerja
    assert len(res["verified_chunks"]) == 2
    
    # Chunk 0: score 0.85 > 0.78 -> Plagiat = True (fallback)
    assert res["verified_chunks"][0]["plagiat"] is True
    assert "fallback offline" in res["verified_chunks"][0]["reason"]
    
    # Chunk 1: score 0.68 <= 0.78 -> Plagiat = False (fallback)
    assert res["verified_chunks"][1]["plagiat"] is False
    assert "fallback offline" in res["verified_chunks"][1]["reason"]

def test_generate_feedback_node():
    state = {
        "verified_chunks": [
            {"chunk_index": 0, "plagiat": True},
            {"chunk_index": 1, "plagiat": False},
            {"chunk_index": 2, "plagiat": False},
            {"chunk_index": 3, "plagiat": False}
        ]
    }
    
    res = generate_feedback_node(state)
    # 1 dari 4 plagiat -> plagiarism = 25%, originality = 75%
    assert res["total_plagiarism_score"] == 25.0
    assert res["total_originality_score"] == 75.0

@patch('app.core.orchestrator.call_ollama', new_callable=AsyncMock)
async def test_full_graph_invocation(mock_call_ollama):
    mock_call_ollama.return_value = {
        "text": '{"plagiat": false, "reason": "Bukan plagiat berdasarkan penalaran LLM"}',
        "prompt_tokens": 50,
        "completion_tokens": 15
    }
    
    initial_state = {
        "chunks": [
            # Chunk 1: Template
            {
                "chunk_index": 0,
                "text": "Alat dan bahan yang digunakan dalam praktikum ini adalah",
                "metadata": {},
                "qdrant_matches": []
            },
            # Chunk 2: Butuh verifikasi LLM
            {
                "chunk_index": 1,
                "text": "Analisis orisinal mahasiswa terhadap data sorting praktikum.",
                "metadata": {},
                "qdrant_matches": [{"id": "m1", "score": 0.72, "payload": {"text": "Analisis orisinal pembanding."}}]
            }
        ],
        "verified_chunks": [],
        "token_usage": {},
        "total_originality_score": 0.0,
        "total_plagiarism_score": 0.0
    }
    
    # Jalankan StateGraph secara penuh
    final_state = await app_graph.ainvoke(initial_state)
    
    # Verifikasi hasil akhir graf
    assert len(final_state["verified_chunks"]) == 2
    assert final_state["total_originality_score"] == 100.0
    assert final_state["total_plagiarism_score"] == 0.0
    assert final_state["token_usage"]["prompt_tokens"] == 50
    assert final_state["token_usage"]["total_tokens"] == 65

def test_filter_templates_node_with_neural_proto():
    """Memverifikasi bahwa filter_templates_node memanggil Prototypical Head saat ada id_mata_kuliah."""
    dummy_proto_result = {
        "predicted_label": "template",
        "prob_template": 0.88,
        "prob_original": 0.12,
        "dist_template": 0.15,
        "dist_original": 0.95
    }

    state = {
        "chunks": [
            {
                "chunk_index": 0,
                "text": "Frasa unik instruksi modul praktikum yang belum terdaftar di cache regex",
                "metadata": {"page": 1},
                "embedding": [0.1] * 768,
                "vector_matches": []
            }
        ],
        "verified_chunks": [],
        "id_mata_kuliah": "matkul-uuid-123",
        "proto_confidence": {}
    }

    with patch("app.core.proto_trainer.get_proto_trainer") as mock_get_trainer:
        mock_trainer = MagicMock()
        mock_trainer.classify_chunk.return_value = dummy_proto_result
        mock_get_trainer.return_value = mock_trainer

        res = filter_templates_node(state)

        # Harus terdeteksi sebagai template melalui Neural Prototype
        assert len(res["verified_chunks"]) == 1
        assert res["verified_chunks"][0]["plagiat"] is False
        assert "Neural Prototype" in res["verified_chunks"][0]["reason"]
        assert res["proto_confidence"][0]["prob_template"] == 0.88

