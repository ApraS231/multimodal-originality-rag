import pytest
import jwt
import json
import io
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock, AsyncMock

from app.main import app
from app.config import settings

client = TestClient(app)

def generate_token(role: str, laporan_id: str = "laporan-test-id") -> str:
    payload = {
        "userId": "user-uuid-1",
        "email": "test@stitek.ac.id",
        "role": role,
        "laporanId": laporan_id
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm="HS256")

@patch('app.api.endpoints.parse_document')
@patch('app.core.searcher.qdrant_client')
@patch('app.db.qdrant_client.qdrant_client')
@patch('app.core.orchestrator.call_ollama', new_callable=AsyncMock)
@patch('app.core.embedder_text.get_text_embedder')
@patch('app.core.embedder_image.get_image_embedder')
@patch('app.core.searcher.get_text_embedder')
@patch('app.core.searcher.get_image_embedder')
def test_analyze_document_full_pipeline(mock_searcher_get_image, mock_searcher_get_text, mock_get_image, mock_get_text, mock_call_ollama, mock_qdrant_db, mock_qdrant_searcher, mock_parse_document):
    # Mocking embedder outputs to avoid PyTorch loading and image format checks
    mock_text_embedder = MagicMock()
    mock_text_embedder.encode_passages.return_value = [[0.2] * 768]
    mock_text_embedder.encode_queries.return_value = [[0.2] * 768]
    
    mock_image_embedder = MagicMock()
    mock_image_embedder.embed_image.return_value = [0.1] * 512
    
    mock_get_text.return_value = mock_text_embedder
    mock_searcher_get_text.return_value = mock_text_embedder
    mock_get_image.return_value = mock_image_embedder
    mock_searcher_get_image.return_value = mock_image_embedder
    # Mocking parser output
    mock_parse_document.return_value = {
        "ocr_fallback_active": False,
        "metadata_extracted": {
            "mahasiswa_nama": "Alvin",
            "nim": "22001"
        },
        "pages": [
            {
                "page_number": 1,
                "width": 600,
                "height": 800,
                "text": "Analisis bubble sort dan merge sort.",
                "words_with_geometry": [
                    {"text": "Analisis", "x1": 10, "y1": 20, "x2": 50, "y2": 30},
                    {"text": "bubble", "x1": 60, "y1": 20, "x2": 100, "y2": 30},
                    {"text": "sort", "x1": 110, "y1": 20, "x2": 140, "y2": 30}
                ],
                "extracted_images": [
                    {
                        "image_id": "img_p1_0",
                        "page_number": 1,
                        "bounding_box": {"x1": 50, "y1": 100, "x2": 250, "y2": 300},
                        "file_path": "static/extracted_images/dummy.png"
                    }
                ]
            }
        ],
        "extracted_images": [
            {
                "image_id": "img_p1_0",
                "page_number": 1,
                "bounding_box": {"x1": 50, "y1": 100, "x2": 250, "y2": 300},
                "file_path": "static/extracted_images/dummy.png"
            }
        ]
    }
    
    # Mocking Qdrant search results
    # 1. Text search matches
    mock_text_match = MagicMock()
    mock_text_match.id = "match-text-id"
    mock_text_match.score = 0.88
    mock_text_match.payload = {
        "text": "Analisis sorting bubble sort pembanding.",
        "author": "Doni Setiawan",
        "year": 2025,
        "class": "Teknik Informatika"
    }
    
    # 2. Image search matches
    mock_image_match = MagicMock()
    mock_image_match.id = "match-img-id"
    mock_image_match.score = 0.94
    mock_image_match.payload = {
        "image_id": "img_old_0",
        "author": "Rian Saputra",
        "tahun": 2024,
        "source_file_name": "Laporan_Rian_Simulasi_OpAmp.pdf",
        "page_number": 4
    }
    
    mock_qdrant_searcher.search.side_effect = [
        [mock_text_match], # Text search dense
        [mock_text_match], # Text search sparse
        [mock_image_match]  # Image search
    ]
    
    # Mocking Ollama verification output (plagiat = True)
    mock_call_ollama.return_value = {
        "text": '{"plagiat": true, "reason": "Menjiplak dengan memparafrase kalimat."}',
        "prompt_tokens": 120,
        "completion_tokens": 35
    }
    
    # Generate valid ASLAB token
    token = generate_token("ASLAB", "laporan-test-uuid")
    
    # Create a dummy file object
    dummy_file = io.BytesIO(b"Dummy PDF Content")
    
    # Mocking builtin open for image bytes read
    real_open = open
    def mock_open_fn(file_path, mode='r', *args, **kwargs):
        if 'dummy.png' in str(file_path):
            return io.BytesIO(b"Dummy Image Content")
        return real_open(file_path, mode, *args, **kwargs)
        
    with patch("builtins.open", side_effect=mock_open_fn):
        response = client.post(
            "/api/v1/analyze",
            headers={"Authorization": f"Bearer {token}"},
            files={"file": ("laporan_alvin.pdf", dummy_file, "application/pdf")},
            data={"program_studi": "Teknik Informatika", "mata_kuliah": "Algoritma & Struktur Data", "tahun": 2026}
        )
    
    assert response.status_code == 200
    res_json = response.json()
    
    assert res_json["status"] == "success"
    assert res_json["metadata_extracted"]["mahasiswa_nama"] == "Alvin"
    assert res_json["metadata_extracted"]["nim"] == "22001"
    
    # Verifikasi document summary
    assert res_json["document_summary"]["total_originality_score"] == 0.0 # 1 chunk dan plagiat
    assert res_json["document_summary"]["total_plagiarism_score"] == 100.0
    assert res_json["document_summary"]["text_chunks_analyzed"] == 1
    assert res_json["document_summary"]["images_analyzed"] == 1
    
    # Verifikasi detail plagiarisme teks
    assert len(res_json["text_plagiarism_details"]) == 1
    assert res_json["text_plagiarism_details"][0]["source_reference"]["author"] == "Doni Setiawan"
    assert res_json["text_plagiarism_details"][0]["geometry"]["page_number"] == 1
    
    # Verifikasi detail plagiarisme gambar
    assert len(res_json["image_plagiarism_details"]) == 1
    assert res_json["image_plagiarism_details"][0]["source_reference"]["author"] == "Rian Saputra"
    assert res_json["image_plagiarism_details"][0]["source_reference"]["source_file_name"] == "Laporan_Rian_Simulasi_OpAmp.pdf"
