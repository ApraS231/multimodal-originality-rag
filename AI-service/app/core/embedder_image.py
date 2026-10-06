import torch
from transformers import CLIPProcessor, CLIPModel
from PIL import Image
import io
import logging

logger = logging.getLogger("AI-Service")

class ImageEmbedder:
    def __init__(self, model_name: str = "openai/clip-vit-base-patch32"):
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        logger.info(f"Menginisialisasi ImageEmbedder dengan model: {model_name} ({self.device})")
        self.model = CLIPModel.from_pretrained(model_name).to(self.device)
        self.processor = CLIPProcessor.from_pretrained(model_name)
        logger.info("ImageEmbedder berhasil dimuat.")

    def embed_image(self, image_bytes: bytes) -> list[float] | None:
        """
        Mengekstrak representasi vektor 512 dimensi menggunakan CLIP Vision Encoder,
        dan menormalisasi hasilnya (L2 Normalization).
        """
        try:
            # 1. Konversi bytes ke PIL Image
            pil_image = Image.open(io.BytesIO(image_bytes))
            
            # 2. Normalisasi mode warna ke RGB
            if pil_image.mode != "RGB":
                pil_image = pil_image.convert("RGB")
                
            # 3. Proses input menggunakan CLIPProcessor
            inputs = self.processor(images=pil_image, return_tensors="pt").to(self.device)
            
            # 4. Hitung visual feature embeddings (forward pass)
            with torch.no_grad():
                image_features = self.model.get_image_features(**inputs)
                
                # Penanganan adaptif jika model mengembalikan BaseModelOutputWithPooling (transformers >= 5.x)
                if not isinstance(image_features, torch.Tensor):
                    if hasattr(image_features, "image_embeds") and image_features.image_embeds is not None:
                        image_features = image_features.image_embeds
                    elif hasattr(image_features, "pooler_output") and image_features.pooler_output is not None:
                        image_features = image_features.pooler_output
                    elif hasattr(image_features, "last_hidden_state") and image_features.last_hidden_state is not None:
                        image_features = image_features.last_hidden_state
                
            # 5. L2 Normalization pada output tensor
            image_features = torch.nn.functional.normalize(image_features, p=2, dim=-1)
            
            # 6. Konversi ke list float
            vector = image_features[0].cpu().numpy().tolist()
            return vector
            
        except Exception as e:
            logger.error(f"Gagal menghasilkan embedding gambar CLIP: {str(e)}")
            return None

    def encode_image_bytes(self, image_bytes: bytes) -> list[float] | None:
        """Alias untuk kompatibilitas pipa ingesti."""
        return self.embed_image(image_bytes)

# Singleton instance wrapper untuk menghemat memori
_image_embedder = None

def get_image_embedder():
    global _image_embedder
    if _image_embedder is None:
        _image_embedder = ImageEmbedder()
    return _image_embedder
