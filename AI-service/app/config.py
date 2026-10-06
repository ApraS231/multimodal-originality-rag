from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    JWT_SECRET: str
    DATABASE_URL: str
    FASTAPI_PORT: int = 8000
    RRF_K: int = 60
    OLLAMA_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "llama3:8b"
    KUNCI_API_GEMINI: str = ""
    KUNCI_API_OPENAI: str = ""
    KUNCI_API_GROQ: str = ""
    KUNCI_API_SUPABASE: str = ""
    TAUTAN_SUPABASE: str = ""
    PROTO_TEMPERATURE: float = 0.5
    PROTO_TEMPLATE_THRESHOLD: float = 0.75
    PROTO_REVIEW_THRESHOLD: float = 0.50
    PROTO_RETRAIN_BATCH_SIZE: int = 5
    PROTO_PROJECTION_DIM: int = 128
    PROTO_LR: float = 1e-3
    PROTO_EPOCHS: int = 10
    MAX_FILE_SIZE_MB: int = 25
    CORS_ALLOWED_ORIGINS: str = "http://localhost:3000,http://localhost:5173,http://localhost:8080"
    DRIFT_ANOMALY_THRESHOLD: float = 0.50

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    def update_runtime_credentials(self, credentials: dict):
        import logging
        logger = logging.getLogger("AI-Service")
        logger.info("Memperbarui kredensial runtime global...")
        
        # 1. Dekripsi data kunci
        decrypted_keys = {}
        for key, val in credentials.items():
            if val is None:
                continue
            
            if key in ["kunci_api_gemini", "kunci_api_openai", "kunci_api_groq", "kunci_api_supabase"]:
                decrypted_val = decrypt_aes_gcm(val, self.JWT_SECRET)
                decrypted_keys[key] = decrypted_val
            else:
                decrypted_keys[key] = val
                
        # 2. Update self attributes
        for key, val in decrypted_keys.items():
            mapped_key = key.upper()
            if key == "kunci_api_gemini":
                mapped_key = "KUNCI_API_GEMINI"
            elif key == "kunci_api_openai":
                mapped_key = "KUNCI_API_OPENAI"
            elif key == "kunci_api_groq":
                mapped_key = "KUNCI_API_GROQ"
            elif key == "kunci_api_supabase":
                mapped_key = "KUNCI_API_SUPABASE"
            elif key == "tautan_supabase":
                mapped_key = "TAUTAN_SUPABASE"
            elif key == "database_url":
                mapped_key = "DATABASE_URL"
            elif key == "rrf_k":
                mapped_key = "RRF_K"
                
            if hasattr(self, mapped_key):
                setattr(self, mapped_key, val)
                logger.info(f"Kredensial {mapped_key} berhasil di-hot-swapped.")
                
        # 3. Reset client pgvector jika ada pembaruan DATABASE_URL
        if "database_url" in decrypted_keys:
            from app.db.supabase_client import vector_db
            vector_db.reset()
            logger.info("Klien Supabase pgvector global berhasil di-reset.")

import hashlib
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
import logging

def decrypt_aes_gcm(encrypted_text: str, secret_key: str) -> str:
    if not encrypted_text:
        return ""
    try:
        parts = encrypted_text.split(":")
        if len(parts) != 3:
            return ""
        
        iv = bytes.fromhex(parts[0])
        auth_tag = bytes.fromhex(parts[1])
        ciphertext = bytes.fromhex(parts[2])
        
        full_ciphertext = ciphertext + auth_tag
        key = hashlib.sha256(secret_key.encode()).digest()
        
        aesgcm = AESGCM(key)
        decrypted_bytes = aesgcm.decrypt(iv, full_ciphertext, None)
        return decrypted_bytes.decode('utf-8')
    except Exception as e:
        logger = logging.getLogger("AI-Service")
        logger.error(f"Gagal melakukan dekripsi AES-GCM: {str(e)}")
        return ""

settings = Settings()

