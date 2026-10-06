import pytest
import os
import shutil
from unittest.mock import patch, MagicMock
from app.core.finetuner import ModelFineTuner
from app.core.embedder_text import get_text_embedder

# Path lokal untuk model sbert_v2
LOCAL_MODEL_PATH = os.path.abspath("app/models/sbert_v2")

@pytest.fixture(autouse=True)
def cleanup_local_model():
    """
    Fixture untuk membersihkan model sbert_v2 hasil training sebelum dan setelah test dijalankan.
    """
    if os.path.exists(LOCAL_MODEL_PATH):
        shutil.rmtree(LOCAL_MODEL_PATH)
    yield
    if os.path.exists(LOCAL_MODEL_PATH):
        shutil.rmtree(LOCAL_MODEL_PATH)

@patch('app.core.finetuner.psycopg2.connect')
def test_get_verified_laporan_ids(mock_connect):
    # Mocking cursor dan query hasil database relasional
    mock_conn = MagicMock()
    mock_cur = MagicMock()
    mock_connect.return_value = mock_conn
    mock_conn.cursor.return_value = mock_cur
    
    # Simulasikan database mengembalikan 2 ID laporan
    mock_cur.fetchall.return_value = [("laporan-uuid-1",), ("laporan-uuid-2",)]
    
    tuner = ModelFineTuner()
    ids = tuner.get_verified_laporan_ids()
    
    # Pastikan query dipanggil dan koneksi ditutup
    mock_cur.execute.assert_called_once()
    mock_cur.close.assert_called_once()
    mock_conn.close.assert_called_once()
    
    assert ids == ["laporan-uuid-1", "laporan-uuid-2"]

@patch('app.core.finetuner.qdrant_client')
def test_get_training_texts(mock_qdrant):
    # Mocking scroll Qdrant response
    mock_point1 = MagicMock()
    mock_point1.payload = {"text": "Kalimat pertama dari laporan praktikum."}
    mock_point2 = MagicMock()
    mock_point2.payload = {"text": "Kalimat kedua tentang algoritma sorting."}
    
    mock_qdrant.scroll.return_value = ([mock_point1, mock_point2], None)
    
    tuner = ModelFineTuner()
    texts = tuner.get_training_texts(["uuid-1"])
    
    mock_qdrant.scroll.assert_called_once()
    assert len(texts) == 2
    assert "Kalimat pertama" in texts[0]
    assert "algoritma sorting" in texts[1]

@patch('app.core.finetuner.ModelFineTuner.get_verified_laporan_ids')
@patch('app.core.finetuner.ModelFineTuner.get_training_texts')
def test_run_fine_tuning(mock_get_texts, mock_get_ids):
    # Mocking data input agar tidak memicu database/Qdrant nyata
    mock_get_ids.return_value = ["laporan-uuid-1"]
    mock_get_texts.return_value = [
        "Metode sorting bubble sort melakukan penukaran data secara berulang.",
        "Algoritma merge sort membagi list menjadi dua bagian secara rekursif.",
        "Pengujian orisinalitas mendeteksi kesamaan kalimat laporan."
    ]
    
    # Dapatkan embedder aktif
    embedder = get_text_embedder()
    
    # Mocking model.fit dan model.save untuk mencegah crash PyTorch AdamW di Windows CPU
    with patch.object(embedder.model, 'fit') as mock_fit, \
         patch.object(embedder.model, 'save') as mock_save:
         
        # Definisikan efek mock_save: buat direktori dan config.json dummy
        def simulate_save(path):
            os.makedirs(path, exist_ok=True)
            with open(os.path.join(path, "config.json"), "w") as f:
                f.write('{"cohere_model": false}')
                
        mock_save.side_effect = simulate_save
        
        tuner = ModelFineTuner()
        
        # Mocking load_model pada embedder untuk mencegah pemuatan ulang riil model dummy
        with patch.object(embedder, 'load_model') as mock_load:
            success = tuner.run_fine_tuning()
            
            assert success is True
            mock_fit.assert_called_once()
            mock_save.assert_called_once_with(LOCAL_MODEL_PATH)
            mock_load.assert_called_once_with(LOCAL_MODEL_PATH)
