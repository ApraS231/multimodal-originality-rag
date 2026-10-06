# =========================================================================
# DOCKERFILE: Python FastAPI Multimodal AI Service (Production Ready)
# =========================================================================
FROM python:3.10-slim AS runner

WORKDIR /app

# Konfigurasi runtime Python agar output log langsung dialirkan ke stdout/stderr
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8000

# Instalasi dependensi sistem operasi untuk EasyOCR, PyMuPDF, OpenCV, dan curl
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libgl1 \
    libglib2.0-0 \
    libgomp1 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Salin daftar dependensi pustaka Python
COPY requirements.txt .

# Instalasi PyTorch CPU terlebih dahulu untuk efisiensi ukuran citra (image size)
# Jika server target memiliki GPU NVIDIA CUDA, baris ini dapat disesuaikan ke tag cu118/cu121
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir torch torchvision --index-url https://download.pytorch.org/whl/cpu

# Instalasi seluruh pustaka AI (Sentence-Transformers, PyMuPDF, EasyOCR, LangGraph, pgvector)
RUN pip install --no-cache-dir -r requirements.txt

# Salin seluruh kode sumber AI Service
COPY . .

# Buat direktori penyimpanan berkas gambar dan cache jika belum ada
RUN mkdir -p static/extracted_images

# Ekspos port layanan inferensi
EXPOSE 8000

# Pemeriksaan kesehatan endpoint /api/v1/health
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://127.0.0.1:8000/api/v1/health || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
