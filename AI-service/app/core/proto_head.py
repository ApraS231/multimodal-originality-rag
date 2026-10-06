import os
import logging
from typing import Dict, List, Optional, Tuple, Union

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F

from app.config import settings

logger = logging.getLogger("AI-Service")

class CoursePrototypicalHead(nn.Module):
    """
    Prototypical Network Projection Head untuk klasifikasi semantik
    template praktikum vs konten orisinal berbasis Metric Learning.
    
    Memproyeksikan dense vector 768d (SBERT/E5) ke ruang laten 128d
    yang di-normalisasi L2 agar jarak Euclidean sejalan dengan cosine distance.
    """
    def __init__(
        self,
        input_dim: int = 768,
        output_dim: int = 128,
        dropout_rate: float = 0.1
    ):
        super().__init__()
        self.input_dim = input_dim
        self.output_dim = output_dim
        
        self.projection = nn.Sequential(
            nn.Linear(input_dim, 256),
            nn.LayerNorm(256),
            nn.ReLU(),
            nn.Dropout(dropout_rate),
            nn.Linear(256, output_dim)
        )
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.to(self.device)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """
        Forward pass: Proyeksi dan L2-normalisasi.
        Mendukung input 1D [input_dim] atau 2D [batch_size, input_dim].
        """
        is_1d = (x.dim() == 1)
        if is_1d:
            x = x.unsqueeze(0)
            
        projected = self.projection(x)
        normalized = F.normalize(projected, p=2, dim=-1)
        
        if is_1d:
            return normalized.squeeze(0)
        return normalized

    def project_numpy(self, vectors: Union[np.ndarray, List[float], List[List[float]]]) -> np.ndarray:
        """
        Helper inferensi untuk memproyeksikan vektor numpy atau list ke ruang laten 128d.
        """
        self.eval()
        with torch.no_grad():
            if isinstance(vectors, list):
                vectors = np.asarray(vectors, dtype=np.float32)
            t = torch.as_tensor(vectors, dtype=torch.float32, device=self.device)
            out = self.forward(t)
            return out.cpu().numpy()

    @staticmethod
    def compute_centroids(
        embeddings: torch.Tensor,
        labels: torch.Tensor
    ) -> Dict[int, torch.Tensor]:
        """
        Menghitung representasi rata-rata (centroid) untuk setiap kelas.
        
        Args:
            embeddings: Tensor proyeksi [N, output_dim]
            labels: Tensor integer label [N] (0: original, 1: template)
            
        Returns:
            Dict pemetaan {class_id: centroid_tensor}
        """
        unique_labels = torch.unique(labels)
        centroids = {}
        for lbl in unique_labels:
            mask = (labels == lbl)
            cls_embeddings = embeddings[mask]
            centroid = cls_embeddings.mean(dim=0)
            # Normalisasi centroid ke unit sphere
            centroids[int(lbl.item())] = F.normalize(centroid, p=2, dim=0)
        return centroids

    def compute_prototypical_loss(
        self,
        support_embeddings: torch.Tensor,
        support_labels: torch.Tensor,
        query_embeddings: torch.Tensor,
        query_labels: torch.Tensor,
        temperature: float = 0.5
    ) -> Tuple[torch.Tensor, float]:
        """
        Menghitung Prototypical Loss (Negative Log-Likelihood dari jarak softmax Euclidean).
        
        Loss = NLL(softmax(-d(f(x_q), c_k) / tau), y_q)
        """
        # Proyeksikan support dan query
        proj_support = self.forward(support_embeddings)
        proj_query = self.forward(query_embeddings)
        
        # Hitung centroid dari support set
        centroids_dict = self.compute_centroids(proj_support, support_labels)
        
        # Urutkan centroid berdasarkan kelas (0, 1)
        classes = sorted(list(centroids_dict.keys()))
        centroid_matrix = torch.stack([centroids_dict[c] for c in classes], dim=0) # [C, output_dim]
        
        # Hitung jarak kuadrat Euclidean antara setiap query dan centroid
        query_norm = (proj_query ** 2).sum(dim=1, keepdim=True)       # [Q, 1]
        centroid_norm = (centroid_matrix ** 2).sum(dim=1).unsqueeze(0) # [1, C]
        dot_product = torch.mm(proj_query, centroid_matrix.t())        # [Q, C]
        
        dists = query_norm + centroid_norm - 2.0 * dot_product
        dists = torch.clamp(dists, min=0.0).sqrt()                     # [Q, C] Euclidean distance
        
        logits = -dists / max(temperature, 1e-5)                       # [Q, C]
        
        # Map labels ke class index
        class_to_idx = {cls: idx for idx, cls in enumerate(classes)}
        target_indices = torch.tensor([class_to_idx[int(lbl.item())] for lbl in query_labels], device=self.device)
        
        loss = F.cross_entropy(logits, target_indices)
        
        # Hitung akurasi
        preds = torch.argmax(logits, dim=1)
        accuracy = (preds == target_indices).float().mean().item()
        
        return loss, accuracy

    def classify_with_centroids(
        self,
        projected_query: Union[torch.Tensor, np.ndarray],
        centroids: Dict[str, Union[torch.Tensor, np.ndarray, List[float]]],
        temperature: float = 0.5
    ) -> Dict[str, Union[float, str]]:
        """
        Mengklasifikasikan vektor query 128d terhadap centroid kelas ('template', 'original').
        
        Returns:
            Dict: {
                "predicted_label": str ("template" / "original"),
                "prob_template": float,
                "prob_original": float,
                "dist_template": float,
                "dist_original": float
            }
        """
        if not centroids or "template" not in centroids or "original" not in centroids:
            return {
                "predicted_label": "unknown",
                "prob_template": 0.5,
                "prob_original": 0.5,
                "dist_template": 0.0,
                "dist_original": 0.0
            }
            
        # Ubah ke tensor jika masih numpy / list
        if isinstance(projected_query, (np.ndarray, list)):
            q = torch.as_tensor(projected_query, dtype=torch.float32, device=self.device)
        else:
            q = projected_query.to(self.device)
            
        c_template = torch.as_tensor(centroids["template"], dtype=torch.float32, device=self.device)
        c_original = torch.as_tensor(centroids["original"], dtype=torch.float32, device=self.device)
        
        # Jarak Euclidean
        d_temp = torch.norm(q - c_template, p=2).item()
        d_orig = torch.norm(q - c_original, p=2).item()
        
        # Softmax dengan temperature
        tau = max(temperature, 1e-5)
        exp_temp = np.exp(-d_temp / tau)
        exp_orig = np.exp(-d_orig / tau)
        total_exp = exp_temp + exp_orig
        
        if total_exp > 0:
            prob_temp = float(exp_temp / total_exp)
            prob_orig = float(exp_orig / total_exp)
        else:
            prob_temp = 0.5
            prob_orig = 0.5
            
        pred = "template" if prob_temp >= prob_orig else "original"
        
        return {
            "predicted_label": pred,
            "prob_template": round(prob_temp, 4),
            "prob_original": round(prob_orig, 4),
            "dist_template": round(d_temp, 4),
            "dist_original": round(d_orig, 4)
        }

    def save_weights(self, path: Optional[str] = None):
        """Menyimpan bobot model ke disk."""
        target_path = path or os.path.abspath("app/models/proto_head.pt")
        os.makedirs(os.path.dirname(target_path), exist_ok=True)
        torch.save(self.state_dict(), target_path)
        logger.info(f"Bobot CoursePrototypicalHead berhasil disimpan ke: {target_path}")

    def load_weights(self, path: Optional[str] = None) -> bool:
        """Memuat bobot model dari disk jika tersedia."""
        target_path = path or os.path.abspath("app/models/proto_head.pt")
        if os.path.exists(target_path):
            try:
                self.load_state_dict(torch.load(target_path, map_location=self.device, weights_only=True))
                self.eval()
                logger.info(f"Bobot CoursePrototypicalHead berhasil dimuat dari: {target_path}")
                return True
            except Exception as e:
                logger.warning(f"Gagal memuat bobot model Prototypical Head: {e}")
                return False
        return False


# Singleton wrapper
_proto_head_instance: Optional[CoursePrototypicalHead] = None

def get_proto_head() -> CoursePrototypicalHead:
    """Mengembalikan singleton instance CoursePrototypicalHead."""
    global _proto_head_instance
    if _proto_head_instance is None:
        _proto_head_instance = CoursePrototypicalHead(
            input_dim=768,
            output_dim=settings.PROTO_PROJECTION_DIM
        )
        _proto_head_instance.load_weights()
    return _proto_head_instance
