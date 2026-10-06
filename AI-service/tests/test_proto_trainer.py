import pytest
from unittest.mock import patch, MagicMock
import numpy as np
from app.core.proto_trainer import ProtoTrainer, _COURSE_CENTROIDS_CACHE, _HITL_CORRECTION_COUNTERS
from app.config import settings

@pytest.fixture(autouse=True)
def clean_cache():
    _COURSE_CENTROIDS_CACHE.clear()
    _HITL_CORRECTION_COUNTERS.clear()
    yield
    _COURSE_CENTROIDS_CACHE.clear()
    _HITL_CORRECTION_COUNTERS.clear()

def test_proto_trainer_insufficient_data():
    """Memverifikasi behavior ketika tidak ada sampel template atau original."""
    trainer = ProtoTrainer()
    with patch.object(trainer, "collect_training_data", return_value=([], [])):
        res = trainer.train_and_store("matkul-test-1")
        assert res["status"] == "skipped"
        assert res["template_count"] == 0
        assert res["original_count"] == 0

def test_proto_trainer_cold_start():
    """Memverifikasi behavior cold-start (< 3 sampel per kelas)."""
    trainer = ProtoTrainer()
    dummy_t = [np.random.randn(768).astype(np.float32) for _ in range(2)]
    dummy_o = [np.random.randn(768).astype(np.float32) for _ in range(2)]

    with patch.object(trainer, "collect_training_data", return_value=(dummy_t, dummy_o)), \
         patch.object(trainer, "_upsert_centroids") as mock_upsert, \
         patch.object(trainer, "_log_training") as mock_log:
        
        res = trainer.train_and_store("matkul-test-cold")
        assert res["status"] == "success"
        assert res["mode"] == "cold_start"
        assert res["model_version"] == "v0-coldstart"
        mock_upsert.assert_called_once()
        mock_log.assert_called_once()

def test_proto_trainer_full_training():
    """Memverifikasi full episodic training dengan dataset memadai."""
    trainer = ProtoTrainer()
    dummy_t = [np.random.randn(768).astype(np.float32) for _ in range(5)]
    dummy_o = [np.random.randn(768).astype(np.float32) for _ in range(5)]

    with patch.object(trainer, "collect_training_data", return_value=(dummy_t, dummy_o)), \
         patch.object(trainer, "_upsert_centroids") as mock_upsert, \
         patch.object(trainer, "_log_training") as mock_log, \
         patch.object(trainer.proto_head, "save_weights"):
        
        res = trainer.train_and_store("matkul-test-full", epochs=2)
        assert res["status"] == "success"
        assert res["mode"] == "trained"
        assert res["model_version"] == "v1"
        assert "loss_before" in res
        assert "loss_after" in res

def test_proto_trainer_cache_and_load():
    """Memverifikasi in-memory cache dan fallback query database."""
    trainer = ProtoTrainer()
    matkul_id = "matkul-cached-1"

    c_t = np.ones(128, dtype=np.float32)
    c_o = -np.ones(128, dtype=np.float32)
    trainer._update_cache(matkul_id, c_t, c_o)

    loaded = trainer.load_centroids(matkul_id)
    assert loaded is not None
    assert np.allclose(loaded["template"], c_t)
    assert np.allclose(loaded["original"], c_o)

def test_proto_trainer_hitl_counter_accumulation():
    """Memverifikasi akumulasi koreksi HITL dan trigger auto-retrain saat mencapai batch size."""
    trainer = ProtoTrainer()
    matkul_id = "matkul-hitl-1"

    with patch.object(trainer, "train_and_store") as mock_train:
        # Panggil sebanyak (batch_size - 1) kali
        for _ in range(settings.PROTO_RETRAIN_BATCH_SIZE - 1):
            trainer.on_hitl_correction(matkul_id)
        mock_train.assert_not_called()

        # Panggilan ke-batch_size harus memicu retraining
        trainer.on_hitl_correction(matkul_id)
        mock_train.assert_called_once_with(matkul_id, trigger_type="hitl_correction")
