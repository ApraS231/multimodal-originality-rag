import pytest
import jwt
import json
import hashlib
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock, AsyncMock

from app.main import app
from app.config import settings, decrypt_aes_gcm

client = TestClient(app)

def generate_token(role: str) -> str:
    payload = {
        "userId": "user-uuid-1",
        "email": "test@stitek.ac.id",
        "role": role
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm="HS256")

# AES-256-GCM Encryption Helper untuk testing config sync
def encrypt_aes_gcm(text: str, secret_key: str) -> str:
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    import os
    iv = os.urandom(12)
    key = hashlib.sha256(secret_key.encode()).digest()
    aesgcm = AESGCM(key)
    ciphertext_with_tag = aesgcm.encrypt(iv, text.encode('utf-8'), None)
    
    # Pisahkan ciphertext dan auth tag (16 bytes terakhir)
    ciphertext = ciphertext_with_tag[:-16]
    auth_tag = ciphertext_with_tag[-16:]
    return f"{iv.hex()}:{auth_tag.hex()}:{ciphertext.hex()}"

def test_unauthorized_access_missing_token():
    # Mengakses endpoint terproteksi tanpa header Authorization
    response = client.post("/api/v1/model/fine-tune")
    assert response.status_code == 403  # FastAPI HTTPBearer default status for missing credentials

def test_unauthorized_access_invalid_token():
    # Mengakses endpoint terproteksi dengan token yang ditandatangani key salah
    bad_token = jwt.encode({"role": "ADMIN"}, "wrong_secret", algorithm="HS256")
    response = client.post(
        "/api/v1/model/fine-tune",
        headers={"Authorization": f"Bearer {bad_token}"}
    )
    assert response.status_code == 401
    assert "tidak valid" in response.json()["detail"]

def test_rbac_aslab_forbidden_to_finetune():
    # Role ASLAB mengakses endpoint fine-tune
    aslab_token = generate_token("ASLAB")
    response = client.post(
        "/api/v1/model/fine-tune",
        headers={"Authorization": f"Bearer {aslab_token}"}
    )
    assert response.status_code == 403
    assert "Akses ditolak" in response.json()["detail"]

@patch('app.api.endpoints.ModelFineTuner.run_fine_tuning')
def test_rbac_admin_allowed_to_finetune(mock_run_fine_tuning):
    # Role ADMIN diperbolehkan memicu fine-tune
    admin_token = generate_token("ADMIN")
    response = client.post(
        "/api/v1/model/fine-tune",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert response.status_code == 200
    assert response.json()["status"] == "processing"

def test_aes_gcm_decryption():
    # Validasi logika dekripsi lokal AES-256-GCM
    plain_text = "kunci-api-groq-sangat-rahasia"
    encrypted_text = encrypt_aes_gcm(plain_text, settings.JWT_SECRET)
    
    decrypted_text = decrypt_aes_gcm(encrypted_text, settings.JWT_SECRET)
    assert decrypted_text == plain_text

def test_config_sync_endpoint():
    admin_token = generate_token("ADMIN")
    
    plain_key = "gemini-api-key-sync-test"
    encrypted_key = encrypt_aes_gcm(plain_key, settings.JWT_SECRET)
    
    payload = {
        "kunci_api_gemini": encrypted_key,
        "rrf_k": 75
    }
    
    response = client.post(
        "/api/v1/config/sync",
        headers={"Authorization": f"Bearer {admin_token}"},
        json=payload
    )
    
    assert response.status_code == 200
    assert response.json() == {"status": "synchronized"}
    
    # Pastikan kredensial di settings berhasil di-hot-swapped
    assert settings.KUNCI_API_GEMINI == plain_key
    assert settings.RRF_K == 75

def test_sse_progress_stream():
    from app.api.endpoints import progress_store
    progress_store["test-task-123"] = {
        "task_id": "test-task-123",
        "status": "completed",
        "progress": 100,
        "message": "Selesai"
    }
    # Memanggil endpoint Server-Sent Events scraping stream
    response = client.get("/api/v1/scrape/stream/test-task-123")
    assert response.status_code == 200
    assert "text/event-stream" in response.headers["content-type"]
    
    # Baca event-stream output baris demi baris
    events = []
    for line in response.iter_lines():
        if line:
            decoded_line = line if isinstance(line, str) else line.decode('utf-8')
            if decoded_line.startswith("data:"):
                # Parse data JSON
                data = json.loads(decoded_line[5:])
                events.append(data)
                
    assert len(events) > 0
    assert events[0]["task_id"] == "test-task-123"
    assert events[-1]["progress"] == 100
    assert events[-1]["status"] == "completed"

def test_torch_load_weights_only():
    from app.core.proto_head import CoursePrototypicalHead
    head = CoursePrototypicalHead()
    with patch("os.path.exists", return_value=True), \
         patch("torch.load") as mock_torch_load:
        mock_torch_load.return_value = head.state_dict()
        head.load_weights("dummy_path.pt")
        mock_torch_load.assert_called_once()
        _, kwargs = mock_torch_load.call_args
        assert kwargs.get("weights_only") is True

@patch("app.api.endpoints.parse_document")
@patch("app.api.endpoints.app_graph")
@patch("app.api.endpoints.get_hybrid_searcher")
@patch("app.api.endpoints.get_text_embedder")
@patch("app.api.endpoints.get_image_embedder")
def test_privacy_masking_for_student_role(mock_img_emb, mock_txt_emb, mock_searcher, mock_graph, mock_parser):
    mock_parser.return_value = {
        "metadata_extracted": {"mahasiswa_nama": "Alvin", "judul": "Judul Laporan"},
        "pages": [{"page_number": 1, "width": 595, "height": 842, "text": "Sample text", "words_with_geometry": [], "extracted_images": []}],
        "extracted_images": [],
        "ocr_fallback_active": False,
        "full_text": "Sample text",
        "total_pages": 1
    }
    mock_graph.ainvoke = AsyncMock(return_value={
        "verified_chunks": [{
            "chunk_index": 0,
            "similarity_score": 0.92,
            "plagiat": True,
            "matched_author": "Budi Raharjo",
            "matched_year": 2024,
            "matched_class": "Pemrograman Web",
            "text": "Sample text",
            "metadata": {"page_number": 1, "bounding_box": [10, 10, 100, 50]}
        }],
        "total_originality_score": 8.0,
        "total_plagiarism_score": 92.0,
        "proto_confidence": {},
        "token_usage": {}
    })
    student_token = generate_token("MAHASISWA")
    response = client.post(
        "/api/v1/analyze",
        headers={"Authorization": f"Bearer {student_token}"},
        files={"file": ("laporan.pdf", b"%PDF-1.4 dummy content", "application/pdf")},
        data={"tahun": 2025}
    )
    assert response.status_code == 200
    data = response.json()
    details = data["text_plagiarism_details"]
    assert len(details) == 1
    assert "Budi Raharjo" not in details[0]["source_reference"]["author"]
    assert "Mahasiswa" in details[0]["source_reference"]["author"]
    assert details[0]["source_reference"]["class"] == "Dokumen Terindeks"

@patch("app.api.endpoints.parse_document")
@patch("app.api.endpoints.app_graph")
@patch("app.api.endpoints.get_hybrid_searcher")
@patch("app.api.endpoints.get_text_embedder")
@patch("app.api.endpoints.get_image_embedder")
def test_privacy_unmasked_for_admin(mock_img_emb, mock_txt_emb, mock_searcher, mock_graph, mock_parser):
    mock_parser.return_value = {
        "metadata_extracted": {"mahasiswa_nama": "Alvin", "judul": "Judul Laporan"},
        "pages": [{"page_number": 1, "width": 595, "height": 842, "text": "Sample text", "words_with_geometry": [], "extracted_images": []}],
        "extracted_images": [],
        "ocr_fallback_active": False,
        "full_text": "Sample text",
        "total_pages": 1
    }
    mock_graph.ainvoke = AsyncMock(return_value={
        "verified_chunks": [{
            "chunk_index": 0,
            "similarity_score": 0.92,
            "plagiat": True,
            "matched_author": "Budi Raharjo",
            "matched_year": 2024,
            "matched_class": "Pemrograman Web",
            "text": "Sample text",
            "metadata": {"page_number": 1, "bounding_box": [10, 10, 100, 50]}
        }],
        "total_originality_score": 8.0,
        "total_plagiarism_score": 92.0,
        "proto_confidence": {},
        "token_usage": {}
    })
    admin_token = generate_token("ADMIN")
    response = client.post(
        "/api/v1/analyze",
        headers={"Authorization": f"Bearer {admin_token}"},
        files={"file": ("laporan.pdf", b"%PDF-1.4 dummy content", "application/pdf")},
        data={"tahun": 2025}
    )
    assert response.status_code == 200
    data = response.json()
    details = data["text_plagiarism_details"]
    assert len(details) == 1
    assert details[0]["source_reference"]["author"] == "Budi Raharjo"
    assert details[0]["source_reference"]["class"] == "Pemrograman Web"

def test_unauthenticated_image_access_rejected():
    response = client.get("/api/v1/images/sample.png")
    assert response.status_code == 403

def test_image_access_path_traversal_blocked():
    token = generate_token("MAHASISWA")
    response = client.get(
        "/api/v1/images/..%2F..%2Fmain.py",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 404

def test_file_upload_invalid_extension():
    token = generate_token("ADMIN")
    response = client.post(
        "/api/v1/analyze",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": ("malicious.exe", b"binary content", "application/octet-stream")}
    )
    assert response.status_code == 400
    assert "PDF" in response.json()["detail"]

def test_file_upload_size_limit():
    token = generate_token("ADMIN")
    with patch.object(settings, "MAX_FILE_SIZE_MB", 1):
        big_content = b"a" * (2 * 1024 * 1024)
        response = client.post(
            "/api/v1/analyze",
            headers={"Authorization": f"Bearer {token}"},
            files={"file": ("oversized.pdf", big_content, "application/pdf")}
        )
        assert response.status_code == 400
        assert "Ukuran berkas melebihi batas" in response.json()["detail"]

def test_prompt_injection_delimiters():
    import inspect
    from app.core.orchestrator import verify_plagiarism_node
    source = inspect.getsource(verify_plagiarism_node)
    assert "<<<STUDENT_REPORT_TEXT>>>" in source
    assert "<<<END_STUDENT_REPORT_TEXT>>>" in source
    assert "<<<REFERENCE_REPORT_TEXT>>>" in source
    assert "<<<END_REFERENCE_REPORT_TEXT>>>" in source
    assert "[NEEDS REVIEW]" in source
