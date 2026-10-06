import pytest
import torch
import numpy as np
import os
import tempfile
from app.core.proto_head import CoursePrototypicalHead

def test_proto_head_forward_dimensions():
    """Memverifikasi bahwa input 768d diproyeksikan ke 128d dengan L2 normalization."""
    head = CoursePrototypicalHead(input_dim=768, output_dim=128)
    head.eval()

    # Test 2D batch
    x_batch = torch.randn(4, 768)
    out_batch = head(x_batch)
    assert out_batch.shape == (4, 128)

    # Verifikasi norma L2 bernilai 1.0 (unit sphere)
    norms = torch.norm(out_batch, p=2, dim=-1)
    for n in norms:
        assert torch.isclose(n, torch.tensor(1.0), atol=1e-5)

    # Test 1D single vector
    x_single = torch.randn(768)
    out_single = head(x_single)
    assert out_single.shape == (128,)
    assert torch.isclose(torch.norm(out_single, p=2), torch.tensor(1.0), atol=1e-5)

def test_proto_head_compute_centroids():
    """Memverifikasi perhitungan centroid rata-rata terpisah per kelas."""
    head = CoursePrototypicalHead(input_dim=768, output_dim=128)
    
    # 4 sample: 2 kelas 0 (orisinal), 2 kelas 1 (template)
    embeddings = torch.randn(4, 128)
    labels = torch.tensor([0, 0, 1, 1], dtype=torch.int64)

    centroids = head.compute_centroids(embeddings, labels)
    assert 0 in centroids
    assert 1 in centroids
    assert centroids[0].shape == (128,)
    assert centroids[1].shape == (128,)

    # Centroid harus unit-norm
    assert torch.isclose(torch.norm(centroids[0], p=2), torch.tensor(1.0), atol=1e-5)
    assert torch.isclose(torch.norm(centroids[1], p=2), torch.tensor(1.0), atol=1e-5)

def test_proto_head_prototypical_loss():
    """Memverifikasi perhitungan Prototypical Loss dan akurasi."""
    head = CoursePrototypicalHead(input_dim=768, output_dim=128)
    
    s_emb = torch.randn(6, 768)
    s_lbl = torch.tensor([0, 0, 0, 1, 1, 1], dtype=torch.int64)

    q_emb = torch.randn(4, 768)
    q_lbl = torch.tensor([0, 0, 1, 1], dtype=torch.int64)

    loss, acc = head.compute_prototypical_loss(s_emb, s_lbl, q_emb, q_lbl, temperature=0.5)
    assert isinstance(loss, torch.Tensor)
    assert loss.item() > 0.0
    assert 0.0 <= acc <= 1.0

def test_proto_head_classify_with_centroids():
    """Memverifikasi klasifikasi berbasis jarak Euclidean dan softmax."""
    head = CoursePrototypicalHead(input_dim=768, output_dim=128)
    
    # Buat centroid sintetis: template bergeser ke arah +1, original ke arah -1
    c_template = np.ones(128, dtype=np.float32)
    c_template /= np.linalg.norm(c_template)

    c_original = -np.ones(128, dtype=np.float32)
    c_original /= np.linalg.norm(c_original)

    centroids = {
        "template": c_template,
        "original": c_original
    }

    # Query yang sangat mirip template
    q_template = c_template + 0.01 * np.random.randn(128).astype(np.float32)
    q_template /= np.linalg.norm(q_template)

    res = head.classify_with_centroids(q_template, centroids, temperature=0.5)
    assert res["predicted_label"] == "template"
    assert res["prob_template"] > res["prob_original"]
    assert res["dist_template"] < res["dist_original"]
    assert abs((res["prob_template"] + res["prob_original"]) - 1.0) < 1e-3

def test_proto_head_save_and_load():
    """Memverifikasi persistensi bobot model."""
    head = CoursePrototypicalHead(input_dim=768, output_dim=128)
    with tempfile.TemporaryDirectory() as tmpdir:
        model_path = os.path.join(tmpdir, "proto_test.pt")
        head.save_weights(model_path)
        assert os.path.exists(model_path)

        head2 = CoursePrototypicalHead(input_dim=768, output_dim=128)
        loaded = head2.load_weights(model_path)
        assert loaded is True
