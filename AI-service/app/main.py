from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.core.queue import analysis_queue
from app.core.embedder_text import get_text_embedder
from app.core.embedder_image import get_image_embedder
from app.db.supabase_client import vector_db
from app.api.endpoints import router as api_router
from contextlib import asynccontextmanager
import logging
import os


# Konfigurasi logging dasar untuk audit trail dan debugging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger("AI-Service")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup Event
    logger.info("Memulai inisialisasi AI Service...")
    
    # Membuat folder static/extracted_images jika belum ada
    static_dir = "static"
    extracted_images_dir = os.path.join(static_dir, "extracted_images")
    os.makedirs(extracted_images_dir, exist_ok=True)
    logger.info(f"Folder penyimpanan gambar siap di: {extracted_images_dir}")
    
    # 1. Menjalankan Task Queue worker
    analysis_queue.start()
    logger.info("Task Queue worker berhasil diaktifkan.")
    
    # 2. Uji konektivitas ke Supabase pgvector
    try:
        is_healthy = vector_db.test_connection()
        if is_healthy:
            logger.info("Koneksi ke Supabase PostgreSQL + ekstensi pgvector sukses terverifikasi.")
        else:
            logger.warning("Koneksi ke Supabase berhasil, namun ekstensi pgvector belum merespons normal.")
    except Exception as e:
        logger.error(f"Gagal terhubung ke Supabase pgvector: {str(e)}")
        
    # 3. Pre-load model SBERT
    try:
        logger.info("Pre-loading model SBERT (multilingual-e5-base)...")
        get_text_embedder()
        logger.info("Model SBERT siap digunakan.")
    except Exception as e:
        logger.error(f"Gagal memuat model SBERT pada startup: {str(e)}")
        
    # 4. Pre-load model CLIP
    try:
        logger.info("Pre-loading model CLIP (clip-vit-base-patch32)...")
        get_image_embedder()
        logger.info("Model CLIP siap digunakan.")
    except Exception as e:
        logger.error(f"Gagal memuat model CLIP pada startup: {str(e)}")

    # 5. Pre-load model Prototypical Head
    try:
        from app.core.proto_head import get_proto_head
        get_proto_head()
        logger.info("Prototypical Head siap digunakan.")
    except Exception as e:
        logger.warning(f"Prototypical Head belum dilatih atau gagal dimuat: {e}")
        
    yield
    # Shutdown Event
    logger.info("Menghentikan AI Service...")

app = FastAPI(
    title="Core AI Service Engine - STITEK Bontang",
    description="Backend microservice khusus untuk komputasi AI (SBERT, CLIP, RAG Chatbot, & LangGraph)",
    version="1.0.0",
    lifespan=lifespan
)

# Konfigurasi middleware CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.CORS_ALLOWED_ORIGINS.split(",") if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Registrasi router API utama
app.include_router(api_router)

@app.get("/")
def read_root():
    return {
        "status": "running",
        "engine": "FastAPI AI Core",
        "version": "1.0.0"
    }

