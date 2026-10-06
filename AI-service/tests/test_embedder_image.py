import pytest
import io
import math
from PIL import Image
from app.core.embedder_image import get_image_embedder

def generate_dummy_image_bytes() -> bytes:
    """
    Menghasilkan bytes gambar PNG dummy berukuran 200x200 piksel dengan warna solid.
    """
    img = Image.new("RGB", (200, 200), color="blue")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()

def test_image_embedder_loading():
    embedder = get_image_embedder()
    assert embedder is not None
    assert embedder.model is not None
    assert embedder.processor is not None

def test_embed_image():
    embedder = get_image_embedder()
    
    # Menghasilkan gambar dummy
    image_bytes = generate_dummy_image_bytes()
    
    # Jalankan embedding
    vector = embedder.embed_image(image_bytes)
    
    # Verifikasi representasi vektor
    assert vector is not None
    assert len(vector) == 512 # Dimensi output model CLIP ViT-B-32 adalah 512
    
    # Uji apakah vektor ternormalisasi L2 (panjang vektor mendekati 1.0)
    squared_sum = sum(x ** 2 for x in vector)
    vector_norm = math.sqrt(squared_sum)
    
    # Toleransi floating point
    assert math.isclose(vector_norm, 1.0, rel_tol=1e-5)
