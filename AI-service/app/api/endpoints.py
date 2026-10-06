from fastapi import APIRouter, UploadFile, File, Form, BackgroundTasks, Depends, HTTPException, status
from sse_starlette.sse import EventSourceResponse
from pydantic import BaseModel
from typing import List, Optional
import logging
import asyncio
import tempfile
import shutil
import os
import json
import uuid
import datetime

from app.core.parser import parse_document
from app.core.finetuner import ModelFineTuner
from app.config import settings
from app.api.auth import RoleChecker, get_current_user
from fastapi.responses import FileResponse
from app.db.supabase_client import vector_db
from app.core.embedder_text import TextChunker, get_text_embedder
from app.core.embedder_image import get_image_embedder
from app.core.downloader import CloudDownloader
from app.core.searcher import get_hybrid_searcher
from app.core.orchestrator import (
    app_graph,
    _template_in_memory_cache,
    _TEMPLATE_REGEX_PATTERNS,
    _fetch_course_templates_from_db
)
from app.core.proto_trainer import get_proto_trainer
from app.core.chatbot import process_chat_message

logger = logging.getLogger("AI-Service")

router = APIRouter(prefix="/api/v1")

# Batasi maksimal 2 pekerjaan OCR/Embedding berat secara bersamaan (Memory/VRAM Protection)
heavy_tasks_semaphore = asyncio.Semaphore(2)

# In-memory progress store untuk melacak scraping/task progress
progress_store = {}

@router.get("/health")
async def health_check():
    return {"status": "ok", "message": "Core API routes are active"}

@router.get("/images/{filename}")
async def get_protected_image(filename: str, user: dict = Depends(get_current_user)):
    """Mengambil berkas gambar hasil ekstraksi naskah dengan proteksi JWT."""
    safe_name = os.path.basename(filename)
    image_path = os.path.join("static", "extracted_images", safe_name)

    if not os.path.isfile(image_path):
        raise HTTPException(status_code=404, detail="Gambar tidak ditemukan.")
    return FileResponse(image_path, media_type="image/png")

@router.post("/analyze")
async def analyze_document(
    file: UploadFile = File(...),
    program_studi: str = Form(None),
    mata_kuliah: str = Form(None),
    id_mata_kuliah: str = Form(None),
    tahun: int = Form(None),
    user: dict = Depends(RoleChecker(["ADMIN", "ASLAB", "DOSEN", "MAHASISWA"]))
):
    # 0. Validasi keamanan berkas unggahan (Anti-DoS & Malicious File Upload)
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Hanya berkas PDF (.pdf) yang diizinkan.")
    
    max_bytes = settings.MAX_FILE_SIZE_MB * 1024 * 1024
    content = await file.read()
    if len(content) > max_bytes:
        raise HTTPException(status_code=400, detail=f"Ukuran berkas melebihi batas {settings.MAX_FILE_SIZE_MB} MB.")
    await file.seek(0)

    logger.info(f"Menerima request analisis berkas: {file.filename} (Mata Kuliah: {mata_kuliah}, ID: {id_mata_kuliah})")
    
    # 1. Ambil id_laporan dari service token, atau buat baru (fallback)
    id_laporan = user.get("laporanId")
    if not id_laporan:
        id_laporan = str(uuid.uuid4())
        
    logger.info(f"Menggunakan ID Laporan untuk analisis & indeks: {id_laporan}")
    
    # 2. Pemrosesan parser (digital + EasyOCR fallback)
    async with heavy_tasks_semaphore:
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_file_path = os.path.join(temp_dir, f"{uuid.uuid4().hex}.pdf")
            with open(temp_file_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
                
            with open(temp_file_path, "rb") as f:
                file_bytes = f.read()
                
            parsed_result = await asyncio.to_thread(parse_document, file_bytes)
            
    metadata_extracted = parsed_result["metadata_extracted"]
    
    # 3. Chunking teks & Hybrid Search (dense + FTS) pada database Supabase pgvector
    chunker = TextChunker()
    hybrid_searcher = get_hybrid_searcher()
    
    all_chunks = []
    chunk_idx = 0
    
    for page in parsed_result["pages"]:
        page_num = page["page_number"]
        words_with_geom = page["words_with_geometry"]
        
        page_chunks = chunker.chunk_page_words(words_with_geom, page_num)
        
        for ch in page_chunks:
            ch_text = ch["text"]
            ch_geom = ch["metadata"]["bounding_box"]
            
            # Cari plagiarisme pada dokumen lain (terisolasi per mata kuliah)
            vector_matches = hybrid_searcher.search_text(
                query_text=ch_text,
                program_studi=program_studi,
                mata_kuliah=mata_kuliah,
                tahun=tahun,
                limit=5,
                exclude_id_laporan=id_laporan,
                id_mata_kuliah=id_mata_kuliah
            )
            
            all_chunks.append({
                "chunk_index": chunk_idx,
                "text": ch_text,
                "metadata": {
                    "page_number": page_num,
                    "bounding_box": ch_geom
                },
                "vector_matches": vector_matches,
                "qdrant_matches": vector_matches  # Kompatibilitas mundur
            })
            chunk_idx += 1

    text_embedder = get_text_embedder()
    chunk_texts = [ch["text"] for ch in all_chunks]
    dense_embeddings = []
    if chunk_texts:
        dense_embeddings = text_embedder.encode_passages(chunk_texts)
        for idx, emb in enumerate(dense_embeddings):
            all_chunks[idx]["embedding"] = emb

    # 4. Validasi Neuro-Symbolic (LangGraph Decision Graph) dengan isolasi template per mata kuliah
    initial_state = {
        "chunks": all_chunks,
        "verified_chunks": [],
        "token_usage": {},
        "total_originality_score": 100.0,
        "total_plagiarism_score": 0.0,
        "id_mata_kuliah": id_mata_kuliah,
        "proto_confidence": {}
    }
    
    final_state = await app_graph.ainvoke(initial_state)
    
    # 5. Indeks teks laporan baru ke Supabase pgvector (laporan_text_vectors)
    existing_records = []
    try:
        existing_records = vector_db.execute_query(
            "SELECT 1 FROM public.laporan_text_vectors WHERE id_laporan = %s LIMIT 1;",
            (id_laporan,)
        )
        if existing_records:
            logger.info(f"Laporan {id_laporan} sudah terindeks di Supabase. Melewati proses indexing ulang.")
    except Exception as e:
        logger.warning(f"Gagal memeriksa redundansi teks: {str(e)}")
        
    if all_chunks and not existing_records:
        try:
            insert_query = """
                INSERT INTO public.laporan_text_vectors 
                (id, id_laporan, id_mata_kuliah, page_number, text, bounding_box, program_studi, mata_kuliah, tahun, author, is_template, embedding)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s::extensions.vector)
            """
            batch_params = []
            for idx, ch in enumerate(all_chunks):
                ch_text = ch["text"]
                ch_geom = ch["metadata"]["bounding_box"]
                page_num = ch["metadata"]["page_number"]
                dense_vec = dense_embeddings[idx]
                point_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"{id_laporan}_text_{idx}"))
                vec_list = list(dense_vec) if hasattr(dense_vec, "tolist") else dense_vec
                
                batch_params.append((
                    point_id,
                    id_laporan,
                    id_mata_kuliah if id_mata_kuliah else None,
                    page_num,
                    ch_text,
                    json.dumps(ch_geom),
                    program_studi,
                    mata_kuliah,
                    tahun,
                    metadata_extracted.get("mahasiswa_nama", "Unknown"),
                    False,
                    vec_list
                ))
            vector_db.execute_batch(insert_query, batch_params)
            logger.info(f"Berhasil mengindeks {len(batch_params)} text vectors ke Supabase pgvector.")
        except Exception as e:
            logger.error(f"Gagal mengindeks text vectors ke Supabase: {str(e)}")

    # 6. Pemrosesan visual gambar (CLIP + Image plagiarism search + indexing)
    image_embedder = get_image_embedder()
    image_plagiarism_details = []
    extracted_images_payload = []
    
    for img_idx, img in enumerate(parsed_result["extracted_images"]):
        img_id = img["image_id"]
        page_num = img["page_number"]
        geom = img["bounding_box"]
        file_path = img["file_path"]
        
        try:
            with open(file_path, "rb") as img_file:
                img_bytes = img_file.read()
                
            # Pencarian duplikasi visual (exclude current id_laporan)
            image_matches = hybrid_searcher.search_image(
                image_bytes=img_bytes,
                program_studi=program_studi,
                mata_kuliah=mata_kuliah,
                tahun=tahun,
                limit=5,
                exclude_id_laporan=id_laporan,
                id_mata_kuliah=id_mata_kuliah
            )
            
            if image_matches and image_matches[0]["score"] > 0.85:
                best_match = image_matches[0]
                user_role = user.get("role", "MAHASISWA")
                if user_role == "MAHASISWA":
                    author_val = f"Mahasiswa (Tahun {best_match['payload'].get('tahun', tahun)})"
                    source_file_val = "Dokumen Terindeks"
                else:
                    author_val = best_match["payload"].get("author", "Unknown")
                    source_file_val = best_match["payload"].get("source_file_name", "Laporan_Lama.pdf")

                image_plagiarism_details.append({
                    "image_id": img_id,
                    "similarity_score": best_match["score"],
                    "source_reference": {
                        "author": author_val,
                        "year": best_match["payload"].get("tahun", tahun),
                        "source_file_name": source_file_val,
                        "page_number": best_match["payload"].get("page_number", page_num)
                    },
                    "coordinates_on_page": {
                        "page_number": page_num,
                        "bounding_box": geom
                    }
                })
                
            # Indeks gambar baru ke Supabase pgvector
            img_vector = image_embedder.embed_image(img_bytes)
            img_point_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"{id_laporan}_image_{img_idx}"))
            
            if not existing_records and img_vector:
                try:
                    vec_list = list(img_vector) if hasattr(img_vector, "tolist") else img_vector
                    insert_img_query = """
                        INSERT INTO public.laporan_image_vectors
                        (id, id_laporan, id_mata_kuliah, image_id, page_number, bounding_box, file_path, author, tahun, program_studi, mata_kuliah, source_file_name, embedding)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s::extensions.vector)
                    """
                    vector_db.execute_query(
                        insert_img_query,
                        (
                            img_point_id,
                            id_laporan,
                            id_mata_kuliah if id_mata_kuliah else None,
                            img_id,
                            page_num,
                            json.dumps(geom),
                            file_path,
                            metadata_extracted.get("mahasiswa_nama", "Unknown"),
                            tahun,
                            program_studi,
                            mata_kuliah,
                            file.filename,
                            vec_list
                        ),
                        fetch=False
                    )
                except Exception as e:
                    logger.error(f"Gagal mengindeks image vector ke Supabase: {str(e)}")
            
            extracted_images_payload.append({
                "image_id": img_id,
                "page_number": page_num,
                "bounding_box": geom,
                "file_path": f"/api/v1/images/{os.path.basename(file_path)}",
                "vector_id": img_point_id,
                "qdrant_vector_id": img_point_id
            })
            
        except Exception as e:
            logger.error(f"Gagal memproses gambar {img_id}: {str(e)}")
            extracted_images_payload.append({
                "image_id": img_id,
                "page_number": page_num,
                "bounding_box": geom,
                "file_path": f"/api/v1/images/{os.path.basename(file_path)}",
                "vector_id": "",
                "qdrant_vector_id": ""
            })

    # 7. Rekap detail plagiarisme dan orisinalitas teks (dengan Role-based Privacy Masking)
    text_plagiarism_details = []
    text_segments_details = []
    user_role = user.get("role", "MAHASISWA")

    for ch in final_state["verified_chunks"]:
        ch_type = ch.get("type")
        if not ch_type:
            if ch.get("is_template") is True:
                ch_type = "TEMPLATE"
            elif ch.get("plagiat") is True:
                ch_type = "PLAGIARISM"
            else:
                ch_type = "ORIGINAL"

        if user_role == "MAHASISWA":
            author_val = f"Mahasiswa (Tahun {ch.get('matched_year', tahun)})"
            class_val = "Dokumen Terindeks"
        else:
            author_val = ch.get("matched_author", "Unknown Student")
            class_val = ch.get("matched_class", "Unknown Class")

        segment_info = {
            "chunk_index": ch["chunk_index"],
            "type": ch_type,
            "similarity_score": ch.get("similarity_score", 0.0),
            "reason": ch.get("reason", ""),
            "source_reference": {
                "author": author_val,
                "year": ch.get("matched_year", tahun),
                "class": class_val
            },
            "geometry": {
                "page_number": ch["metadata"]["page_number"],
                "bounding_box": ch["metadata"]["bounding_box"],
                "highlight_text": ch["text"]
            }
        }
        text_segments_details.append(segment_info)
        text_plagiarism_details.append(segment_info)

    # 8. Rekap pages response
    clean_pages = []
    for p in parsed_result["pages"]:
        clean_page_images = []
        for img in p["extracted_images"]:
            vec_id = ""
            for ep in extracted_images_payload:
                if ep["image_id"] == img["image_id"]:
                    vec_id = ep["vector_id"]
                    break
            clean_page_images.append({
                "image_id": img["image_id"],
                "page_number": img["page_number"],
                "bounding_box": img["bounding_box"],
                "file_path": f"/api/v1/images/{os.path.basename(img['file_path'])}",
                "vector_id": vec_id,
                "qdrant_vector_id": vec_id
            })
        clean_pages.append({
            "page_number": p["page_number"],
            "width": p["width"],
            "height": p["height"],
            "text": p["text"],
            "words_with_geometry": p["words_with_geometry"],
            "extracted_images": clean_page_images
        })

    # 9. Return payload lengkap
    return {
        "status": "success",
        "ocr_fallback_active": parsed_result["ocr_fallback_active"],
        "metadata_extracted": metadata_extracted,
        "document_summary": {
            "total_originality_score": final_state["total_originality_score"],
            "total_plagiarism_score": final_state["total_plagiarism_score"],
            "text_chunks_analyzed": len(all_chunks),
            "images_analyzed": len(extracted_images_payload),
            "proto_confidence": final_state.get("proto_confidence", {})
        },
        "token_usage": final_state.get("token_usage", {
            "model_name": settings.OLLAMA_MODEL,
            "prompt_tokens": 0,
            "completion_tokens": 0,
            "total_tokens": 0
        }),
        "pages": clean_pages,
        "extracted_images": extracted_images_payload,
        "text_plagiarism_details": text_plagiarism_details,
        "text_segments_details": text_segments_details,
        "image_plagiarism_details": image_plagiarism_details
    }

class FineTuneRequest(BaseModel):
    id_mata_kuliah: Optional[str] = None
    epochs: Optional[int] = 1
    batch_size: Optional[int] = 16

@router.post("/model/fine-tune", dependencies=[Depends(RoleChecker(["ADMIN"]))])
@router.post("/fine-tune", dependencies=[Depends(RoleChecker(["ADMIN"]))])
async def trigger_fine_tune(
    background_tasks: BackgroundTasks,
    payload: Optional[FineTuneRequest] = None,
    id_mata_kuliah: Optional[str] = None
):
    """
    Endpoint untuk memicu proses fine-tuning SBERT secara asinkronus.
    Dapat dibatasi per mata kuliah untuk isolasi model semantik.
    """
    target_mk = (payload.id_mata_kuliah if payload and payload.id_mata_kuliah else None) or id_mata_kuliah
    logger.info(f"Menerima request pemicuan fine-tuning model SBERT (Mata Kuliah: {target_mk}).")
    tuner = ModelFineTuner()
    background_tasks.add_task(tuner.run_fine_tuning, target_mk)
    return {
        "status": "processing",
        "task_id": str(uuid.uuid4()),
        "message": f"Fine-tuning model SBERT berhasil dipicu di latar belakang untuk target: {target_mk or 'GLOBAL'}."
    }

@router.post("/config/sync", dependencies=[Depends(RoleChecker(["ADMIN"]))])
async def sync_global_keys(body: dict):
    """
    Menerima pembaruan kredensial API eksternal yang dienkripsi AES-256-GCM.
    Mendekode secara lokal dan menerapkan pembaruan ke runtime secara dinamis.
    """
    logger.info("Menerima request sinkronisasi kredensial global.")
    settings.update_runtime_credentials(body)
    return {"status": "synchronized"}

class SeedingPayload(BaseModel):
    keywords: List[str]
    id_program_studi: str
    id_kelas: str
    id_mata_kuliah: str
    tahun_akademik: int
    id_pengunggah: Optional[str] = None
    folder_ids: Optional[List[str]] = None

def log_agent_activity(
    tid: str,
    agent: str,
    phase: str,
    message: str,
    progress: Optional[int] = None,
    details: Optional[dict] = None,
    status: str = "processing"
):
    """
    Mencatat aktivitas otonom agen AI (Agentic Workflow) selama proses seeding.
    Memperbarui progress_store untuk dikonsumsi secara real-time via Server-Sent Events (SSE)
    dan endpoint audit log.
    """
    now_str = datetime.datetime.now().strftime("%H:%M:%S")
    timestamp_iso = datetime.datetime.now().isoformat()
    formatted_msg = f"[{now_str}] [{agent}] {message}"

    if tid not in progress_store:
        progress_store[tid] = {
            "task_id": tid,
            "status": status,
            "progress": progress if progress is not None else 0,
            "message": formatted_msg,
            "agent": agent,
            "phase": phase,
            "logs": [],
            "new_logs": [],
            "activity_logs": []
        }

    store = progress_store[tid]
    if "logs" not in store:
        store["logs"] = []
    if "new_logs" not in store:
        store["new_logs"] = []
    if "activity_logs" not in store:
        store["activity_logs"] = []

    log_entry = {
        "timestamp": now_str,
        "timestamp_iso": timestamp_iso,
        "agent": agent,
        "phase": phase,
        "message": message,
        "formatted": formatted_msg,
        "progress": progress if progress is not None else store.get("progress", 0),
        "status": status,
        "details": details or {}
    }

    store["logs"].append(formatted_msg)
    store["new_logs"].append(formatted_msg)
    store["activity_logs"].append(log_entry)

    if progress is not None:
        store["progress"] = progress
    store["message"] = formatted_msg
    store["status"] = status
    store["agent"] = agent
    store["phase"] = phase
    store["details"] = details or {}

    logger.info(f"[{tid}] {formatted_msg}")

async def run_real_ingestion(tid: str, payload: SeedingPayload, admin_id: str):
    """
    Pipa ingesti data riil berbasis multi-agent otonom:
    1. Supervisor Agent: Inisialisasi orchestrator & validasi parameter.
    2. Cloud Scout Agent: Pencarian, deduplikasi, dan pengunduhan arsip PDF.
    3. Multi-Modal Perception Agent: Ekstraksi struktur naskah, OCR auto-fallback, dan parsing entitas cover.
    4. Neuro-Symbolic Triage Agent: Filter template instruksi laboratorium vs konten orisinal.
    5. Vector Ingestion Agent: Representasi vektor SBERT 768d & CLIP 512d ke Supabase pgvector.
    6. Continual Adaptation Agent: Rekalibrasi prototipe (Centroid) & fine-tuning asinkronus.
    7. Supervisor Agent: Agregasi telemetri akhir dan penerbitan event selesai.
    """
    try:
        log_agent_activity(
            tid=tid,
            agent="Supervisor Agent",
            phase="INITIALIZATION",
            message=f"Memulai orchestrator seeding cloud untuk Mata Kuliah ID: {payload.id_mata_kuliah} (Tahun: {payload.tahun_akademik}).",
            progress=3,
            details={"id_mata_kuliah": payload.id_mata_kuliah, "tahun_akademik": payload.tahun_akademik}
        )

        targets = []
        if payload.folder_ids:
            targets.extend(payload.folder_ids)
        if payload.keywords:
            targets.extend(payload.keywords)

        if not targets:
            log_agent_activity(
                tid=tid,
                agent="Cloud Scout Agent",
                phase="DISCOVERY_ERROR",
                message="Target repositori cloud kosong (tidak ada Google Drive Folder ID atau keyword yang ditentukan).",
                progress=0,
                status="failed",
                details={"targets": []}
            )
            return

        downloader = CloudDownloader()
        pdf_files = []
        temp_dest = tempfile.mkdtemp(prefix="cloud_seeding_")

        try:
            log_agent_activity(
                tid=tid,
                agent="Cloud Scout Agent",
                phase="DISCOVERY",
                message=f"Mendeteksi {len(targets)} target penyimpanan cloud. Menginisialisasi pemindaian repositori...",
                progress=5,
                details={"target_count": len(targets)}
            )

            for idx, target in enumerate(targets):
                log_agent_activity(
                    tid=tid,
                    agent="Cloud Scout Agent",
                    phase="DOWNLOADING",
                    message=f"Mengunduh arsip naskah dari target {idx+1}/{len(targets)}: '{target}'...",
                    progress=min(18, 6 + idx * 4),
                    details={"target": target, "index": idx + 1, "total": len(targets)}
                )
                try:
                    found_files = await asyncio.to_thread(
                        downloader.download_folder, target, temp_dest
                    )
                    pdf_files.extend(found_files)
                except Exception as dl_err:
                    logger.warning(f"Gagal mengunduh dari target {target}: {dl_err}")
                    log_agent_activity(
                        tid=tid,
                        agent="Cloud Scout Agent",
                        phase="DOWNLOAD_WARNING",
                        message=f"Gagal mengunduh dari target '{target}': {str(dl_err)}",
                        details={"target": target, "error": str(dl_err)}
                    )

            pdf_files = list(set(pdf_files))

            if not pdf_files:
                log_agent_activity(
                    tid=tid,
                    agent="Cloud Scout Agent",
                    phase="DISCOVERY_FAILED",
                    message="Tidak ditemukan berkas PDF valid pada repositori cloud yang ditentukan.",
                    progress=0,
                    status="failed"
                )
                return

            log_agent_activity(
                tid=tid,
                agent="Cloud Scout Agent",
                phase="INSPECTION",
                message=f"Verifikasi integritas arsip: Ditemukan {len(pdf_files)} berkas PDF valid siap diproses.",
                progress=20,
                details={"total_pdf_files": len(pdf_files)}
            )

            # Pastikan id_pengunggah valid di public.pengguna
            id_pengunggah = admin_id
            try:
                check_user = vector_db.execute_query("SELECT id_pengguna FROM public.pengguna WHERE id_pengguna = %s;", (id_pengunggah,))
                if not check_user:
                    user_rows = vector_db.execute_query("SELECT id_pengguna FROM public.pengguna ORDER BY tanggal_dibuat ASC LIMIT 1;")
                    if user_rows:
                        id_pengunggah = str(user_rows[0]["id_pengguna"])
            except Exception as u_err:
                logger.warning(f"Validasi pengguna pengunggah: {u_err}")

            total_docs = len(pdf_files)
            total_chunks_stored = 0
            total_images_stored = 0
            chunker = TextChunker(chunk_size=150, overlap=30)
            text_embedder = get_text_embedder()
            image_embedder = get_image_embedder()

            # Memuat template khusus mata kuliah untuk filter simbolik
            course_templates = set()
            try:
                course_templates = _fetch_course_templates_from_db(payload.id_mata_kuliah)
            except Exception as ct_err:
                logger.warning(f"Gagal memuat template mata kuliah: {ct_err}")

            for f_idx, pdf_path in enumerate(pdf_files):
                fname = os.path.basename(pdf_path)
                cur_percent = 20 + int((f_idx / total_docs) * 55)

                try:
                    with open(pdf_path, "rb") as f:
                        file_bytes = f.read()

                    file_size_kb = round(len(file_bytes) / 1024, 1)
                    log_agent_activity(
                        tid=tid,
                        agent="Perception Agent",
                        phase="PARSING",
                        message=f"Membaca struktur naskah ({f_idx+1}/{total_docs}): '{fname}' ({file_size_kb} KB)...",
                        progress=cur_percent,
                        details={"file_name": fname, "doc_index": f_idx + 1, "total_docs": total_docs, "size_kb": file_size_kb}
                    )

                    id_laporan = str(uuid.uuid4())

                    # Parsing dokumen PDF dengan ekstraksi ganda
                    parsed = await asyncio.to_thread(parse_document, file_bytes, id_laporan, fname)
                    meta = parsed.get("metadata_extracted", {})
                    nama_mhs = meta.get("nama_mahasiswa") or "Mahasiswa Non-Identifikasi"
                    nim_mhs = meta.get("nim") or "NIM-TIDAK-TERDETEKSI"
                    ocr_active = parsed.get("ocr_fallback_active", False)
                    ocr_label = "OCR Fallback Aktif (Raster)" if ocr_active else "Digital Native"

                    pages_list = parsed.get("pages", [])
                    extracted_images = parsed.get("extracted_images", [])

                    log_agent_activity(
                        tid=tid,
                        agent="Perception Agent",
                        phase="EXTRACTION",
                        message=f"Persepsi naskah selesai: {len(pages_list)} halaman, {len(extracted_images)} gambar ({ocr_label}). Entitas: {nama_mhs} ({nim_mhs}).",
                        progress=cur_percent + 1,
                        details={
                            "file_name": fname,
                            "page_count": len(pages_list),
                            "image_count": len(extracted_images),
                            "ocr_fallback_active": ocr_active,
                            "mahasiswa_nama": nama_mhs,
                            "nim": nim_mhs
                        }
                    )

                    # 0. Salin naskah ke direktori backend/uploads agar dapat diakses oleh penampil PDF
                    saved_tautan = fname
                    try:
                        backend_upload_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "backend", "uploads"))
                        os.makedirs(backend_upload_dir, exist_ok=True)
                        dest_pdf_path = os.path.join(backend_upload_dir, fname)
                        shutil.copyfile(pdf_path, dest_pdf_path)
                        saved_tautan = f"./uploads/{fname}"
                    except Exception as cp_err:
                        logger.warning(f"Gagal menyalin naskah ke backend uploads: {cp_err}")

                    # 2. Chunking teks & Triage filter template
                    doc_chunks = []
                    for page in pages_list:
                        p_num = page.get("page_number", 1)
                        p_txt = page.get("text", "")
                        if p_txt.strip():
                            doc_chunks.extend(chunker.chunk_page_words(p_txt, p_num))

                    template_chunks_count = 0
                    plagiarized_chunks_count = 0
                    text_segments_details = []
                    text_plagiarism_details = []

                    if doc_chunks:
                        chunk_texts = [c["text"] for c in doc_chunks]
                        embeddings = await asyncio.to_thread(text_embedder.encode_passages, chunk_texts)

                        vec_batch = []
                        for ch_idx, (chunk, emb) in enumerate(zip(doc_chunks, embeddings)):
                            emb_list = emb.tolist() if hasattr(emb, "tolist") else list(emb)
                            txt_clean = chunk["text"].lower().strip()
                            is_temp = False

                            # 1. Cek template mata kuliah spesifik
                            for c_temp in course_templates:
                                if c_temp in txt_clean or txt_clean in c_temp:
                                    is_temp = True
                                    break
                            if not is_temp:
                                for cached_t in _template_in_memory_cache:
                                    if cached_t in txt_clean or txt_clean in cached_t:
                                        is_temp = True
                                        break
                            if not is_temp:
                                for pat in _TEMPLATE_REGEX_PATTERNS:
                                    if pat.search(txt_clean):
                                        is_temp = True
                                        break

                            # 2. Aturan Boilerplate: Teks muncul di >= 5 laporan berbeda
                            if not is_temp:
                                try:
                                    doc_cnt = vector_db.count_distinct_reports_for_text(
                                        embedding=emb_list,
                                        id_mata_kuliah=payload.id_mata_kuliah,
                                        threshold=0.88,
                                        exclude_id_laporan=id_laporan
                                    )
                                    if doc_cnt >= 5:
                                        is_temp = True
                                except Exception as cnt_err:
                                    logger.warning(f"Evaluasi frekuensi seeding: {cnt_err}")

                            chunk["is_template"] = is_temp
                            ch_type = "TEMPLATE" if is_temp else "ORIGINAL"
                            similarity_score = 0.0
                            matched_author = "Unknown Student"
                            matched_year = payload.tahun_akademik
                            matched_class = "Dokumen Terindeks"
                            reason = "Template/Boilerplate instruksi praktikum" if is_temp else "Kalimat orisinal naskah"

                            # 3. Cross-Check Antar Laporan (jika bukan template)
                            if not is_temp:
                                try:
                                    matches = vector_db.execute_query(
                                        """
                                        SELECT author, tahun, mata_kuliah, similarity, text, id_laporan
                                        FROM match_text_vectors(
                                            query_embedding := %s::extensions.vector,
                                            match_threshold := 0.82,
                                            match_count := 1,
                                            filter_id_mata_kuliah := %s,
                                            exclude_id_laporan := %s
                                        );
                                        """,
                                        (emb_list, payload.id_mata_kuliah, id_laporan)
                                    )
                                    if matches and matches[0].get("similarity", 0.0) >= 0.82:
                                        ch_type = "PLAGIARISM"
                                        plagiarized_chunks_count += 1
                                        similarity_score = float(matches[0]["similarity"])
                                        matched_author = matches[0].get("author", "Mahasiswa Pembanding")
                                        matched_year = matches[0].get("tahun", payload.tahun_akademik)
                                        matched_class = matches[0].get("mata_kuliah", "Kelas Terindeks")
                                        reason = f"Kemiripan silang ({similarity_score*100:.1f}%) terdeteksi dengan naskah pembanding ({matched_author})"
                                except Exception as cc_err:
                                    logger.warning(f"Cross check chunk seeding {ch_idx}: {cc_err}")

                            if is_temp:
                                template_chunks_count += 1

                            segment_item = {
                                "chunk_index": ch_idx,
                                "type": ch_type,
                                "similarity_score": similarity_score,
                                "reason": reason,
                                "source_reference": {
                                    "author": matched_author,
                                    "year": matched_year,
                                    "class": matched_class
                                },
                                "geometry": {
                                    "page_number": chunk["page_number"],
                                    "bounding_box": chunk.get("bounding_box", {}),
                                    "highlight_text": chunk["text"]
                                }
                            }
                            text_segments_details.append(segment_item)
                            text_plagiarism_details.append(segment_item)

                            vec_batch.append((
                                str(uuid.uuid4()),
                                id_laporan,
                                payload.id_mata_kuliah,
                                chunk["page_number"],
                                chunk["text"],
                                json.dumps(chunk.get("bounding_box", {})),
                                payload.id_program_studi,
                                payload.id_mata_kuliah,
                                payload.tahun_akademik,
                                nama_mhs,
                                is_temp,
                                emb_list
                            ))

                        insert_text_query = """
                            INSERT INTO public.laporan_text_vectors (
                                id, id_laporan, id_mata_kuliah, page_number, text,
                                bounding_box, program_studi, mata_kuliah, tahun, author,
                                is_template, embedding, tanggal_dibuat
                            ) VALUES (
                                %s, %s, %s, %s, %s,
                                %s, %s, %s, %s, %s,
                                %s, %s, NOW()
                            );
                        """
                        vector_db.execute_batch(insert_text_query, vec_batch)
                        total_chunks_stored += len(vec_batch)

                        # Kalkulasi skor orisinalitas & plagiarisme naskah seeding
                        calculated_plag = round((plagiarized_chunks_count / len(doc_chunks)) * 100.0, 1)
                        calculated_orig = round(100.0 - calculated_plag, 1)
                    else:
                        calculated_plag = 0.0
                        calculated_orig = 100.0

                    # 1. Simpan metadata lengkap ke public.laporan dengan detail orisinalitas
                    detail_orisinalitas_payload = {
                        "text_plagiarism_details": text_plagiarism_details,
                        "text_segments_details": text_segments_details,
                        "image_plagiarism_details": []
                    }

                    try:
                        insert_laporan_query = """
                            INSERT INTO public.laporan (
                                id_laporan, nama_mahasiswa, nim, tahun_akademik, tautan_berkas,
                                skor_orisinalitas, skor_plagiarisme, apakah_diverifikasi, status,
                                detail_orisinalitas, id_verifikator, id_program_studi, id_kelas,
                                id_mata_kuliah, id_pengunggah, tanggal_dibuat
                            ) VALUES (
                                %s, %s, %s, %s, %s,
                                %s, %s, TRUE, 'COMPLETED',
                                %s, %s, %s, %s,
                                %s, %s, NOW()
                            )
                            ON CONFLICT (id_laporan) DO UPDATE SET
                                skor_orisinalitas = EXCLUDED.skor_orisinalitas,
                                skor_plagiarisme = EXCLUDED.skor_plagiarisme,
                                detail_orisinalitas = EXCLUDED.detail_orisinalitas;
                        """
                        vector_db.execute_query(insert_laporan_query, (
                            id_laporan,
                            nama_mhs,
                            nim_mhs,
                            payload.tahun_akademik,
                            saved_tautan,
                            calculated_orig,
                            calculated_plag,
                            json.dumps(detail_orisinalitas_payload),
                            id_pengunggah,
                            payload.id_program_studi,
                            payload.id_kelas,
                            payload.id_mata_kuliah,
                            id_pengunggah
                        ), fetch=False)
                    except Exception as lap_err:
                        logger.warning(f"Gagal menyimpan metadata relasional naskah {fname}: {lap_err}")

                    log_agent_activity(
                        tid=tid,
                        agent="Neuro-Symbolic Triage Agent",
                        phase="TRIAGE",
                        message=f"Pemisahan boilerplate & cross-check naskah '{fname}': {len(doc_chunks)} chunk ({template_chunks_count} boilerplate, {plagiarized_chunks_count} terindikasi plagiat, skor orisinalitas {calculated_orig}%).",
                        progress=cur_percent + 2,
                        details={
                            "file_name": fname,
                            "total_chunks": len(doc_chunks),
                            "template_chunks": template_chunks_count,
                            "plagiarized_chunks": plagiarized_chunks_count,
                            "originality_score": calculated_orig,
                            "plagiarism_score": calculated_plag
                        }
                    )

                    # 3. Ekstraksi dan embedding gambar pendukung
                    img_batch = []
                    if extracted_images:
                        for img in extracted_images:
                            raw_b = img.get("raw_bytes")
                            if raw_b:
                                img_emb = image_embedder.embed_image(raw_b)
                                if img_emb is not None:
                                    img_batch.append((
                                        str(uuid.uuid4()),
                                        id_laporan,
                                        payload.id_mata_kuliah,
                                        img["image_id"],
                                        img["page_number"],
                                        json.dumps(img["bounding_box"]),
                                        img["file_path"],
                                        nama_mhs,
                                        payload.tahun_akademik,
                                        payload.id_program_studi,
                                        payload.id_mata_kuliah,
                                        fname,
                                        img_emb.tolist() if hasattr(img_emb, "tolist") else list(img_emb)
                                    ))
                        if img_batch:
                            insert_img_query = """
                                INSERT INTO public.laporan_image_vectors (
                                    id, id_laporan, id_mata_kuliah, image_id, page_number,
                                    bounding_box, file_path, author, tahun, program_studi,
                                    mata_kuliah, source_file_name, embedding, tanggal_dibuat
                                ) VALUES (
                                    %s, %s, %s, %s, %s,
                                    %s, %s, %s, %s, %s,
                                    %s, %s, %s, NOW()
                                );
                            """
                            vector_db.execute_batch(insert_img_query, img_batch)
                            total_images_stored += len(img_batch)

                    log_agent_activity(
                        tid=tid,
                        agent="Vector Ingestion Agent",
                        phase="INDEXING",
                        message=f"Vektorisasi naskah '{fname}' selesai: Berhasil menyimpan {len(doc_chunks)} vektor teks (SBERT 768d) & {len(img_batch)} vektor visual (CLIP 512d) ke Supabase.",
                        progress=cur_percent + 3,
                        details={"file_name": fname, "text_vectors": len(doc_chunks), "image_vectors": len(img_batch)}
                    )

                except Exception as doc_err:
                    logger.warning(f"Terjadi kesalahan saat memproses naskah {fname}, dilanjutkan ke berkas berikutnya: {doc_err}")
                    log_agent_activity(
                        tid=tid,
                        agent="Perception Agent",
                        phase="DOCUMENT_WARNING",
                        message=f"Peringatan pemrosesan naskah '{fname}': {str(doc_err)} (dilanjutkan ke berkas berikutnya).",
                        details={"file_name": fname, "error": str(doc_err)}
                    )

            # 4. Rekalibrasi Titik Berat Prototipe (Continual Adaptation Agent)
            log_agent_activity(
                tid=tid,
                agent="Continual Adaptation Agent",
                phase="CALIBRATION",
                message=f"Mengkalibrasi ulang titik berat prototipe (Centroid) ruang laten untuk mata kuliah '{payload.id_mata_kuliah}'...",
                progress=80,
                details={"id_mata_kuliah": payload.id_mata_kuliah, "total_chunks": total_chunks_stored}
            )

            try:
                proto_trainer = get_proto_trainer()
                proto_result = await asyncio.to_thread(
                    proto_trainer.train_and_store,
                    payload.id_mata_kuliah,
                    None,
                    "cloud_seeding"
                )
                log_agent_activity(
                    tid=tid,
                    agent="Continual Adaptation Agent",
                    phase="PROTOTYPE_RECENTERED",
                    message=f"Kalibrasi Prototypical Head sukses: Centroid template & konten orisinal diperbarui ke basis data.",
                    progress=85,
                    details={"proto_result": proto_result}
                )
            except Exception as proto_err:
                logger.warning(f"Kalibrasi Prototypical Head dilewati: {proto_err}")
                log_agent_activity(
                    tid=tid,
                    agent="Continual Adaptation Agent",
                    phase="PROTOTYPE_SKIPPED",
                    message=f"Kalibrasi Prototypical Head dilewati: {str(proto_err)[:80]}...",
                    progress=85
                )

            # 5. Pelatihan Ulang SBERT (Fine-Tuning)
            log_agent_activity(
                tid=tid,
                agent="Continual Adaptation Agent",
                phase="FINE_TUNING",
                message=f"Menjadwalkan fine-tuning model semantik SBERT secara asinkronus berbasis {total_chunks_stored} vektor naskah acuan...",
                progress=90,
                details={"id_mata_kuliah": payload.id_mata_kuliah, "total_chunks": total_chunks_stored}
            )

            fine_tuner = ModelFineTuner()
            await fine_tuner.run_fine_tuning_async(payload.id_mata_kuliah)

            # 6. Penyelesaian Sukses (Supervisor Agent)
            log_agent_activity(
                tid=tid,
                agent="Supervisor Agent",
                phase="COMPLETION",
                message=f"Pipa Seeding Cloud sukses! Mengindeks {total_docs} naskah acuan ({total_chunks_stored} chunk teks, {total_images_stored} gambar grafis) ke Supabase.",
                progress=100,
                status="completed",
                details={
                    "total_documents": total_docs,
                    "total_text_chunks": total_chunks_stored,
                    "total_images": total_images_stored,
                    "id_mata_kuliah": payload.id_mata_kuliah
                }
            )
            logger.info(f"Task Seeding {tid} berhasil diselesaikan.")

        finally:
            downloader.cleanup_directory(temp_dest)

    except Exception as e:
        logger.error(f"Kegagalan pipeline seeding {tid}: {str(e)}", exc_info=True)
        log_agent_activity(
            tid=tid,
            agent="Supervisor Agent",
            phase="FAILURE",
            message=f"Kegagalan fatal pada pipeline seeding: {str(e)}",
            progress=0,
            status="failed",
            details={"error": str(e)}
        )

@router.post("/seeding")
async def trigger_seeding(
    payload: SeedingPayload,
    user: dict = Depends(RoleChecker(["ADMIN"]))
):
    task_id = str(uuid.uuid4())
    logger.info(f"Memicu seeding riil dengan ID tugas: {task_id} untuk keywords: {payload.keywords}")

    admin_user_id = payload.id_pengunggah or user.get("userId") or user.get("id") or ""

    # Inisialisasi awal log aktivitas agen
    log_agent_activity(
        tid=task_id,
        agent="Supervisor Agent",
        phase="ENQUEUED",
        message="Mengantrekan tugas seeding cloud dan menginisialisasi pekerja latar belakang...",
        progress=2,
        details={"admin_user_id": admin_user_id, "keywords": payload.keywords}
    )

    asyncio.create_task(run_real_ingestion(task_id, payload, admin_user_id))

    return {"status": "success", "task_id": task_id}

@router.get("/scrape/status/{task_id}")
async def get_scrape_status(task_id: str):
    """Mengambil status pemrosesan tugas scraping secara REST polling."""
    progress = progress_store.get(task_id)
    if not progress:
        return {"status": "not_found", "progress": 0, "message": "Tugas tidak ditemukan."}
    return progress

@router.get("/seeding/logs/{task_id}")
async def get_seeding_logs(task_id: str):
    """
    Mengembalikan riwayat lengkap log aktivitas agen AI untuk tugas seeding tertentu.
    Digunakan untuk pemantauan audit trail dan verifikasi kepatuhan sistem.
    """
    store = progress_store.get(task_id)
    if not store:
        raise HTTPException(status_code=404, detail="ID tugas seeding tidak ditemukan.")
    return {
        "task_id": task_id,
        "status": store.get("status", "unknown"),
        "progress": store.get("progress", 0),
        "total_logs": len(store.get("logs", [])),
        "logs": store.get("logs", []),
        "activity_logs": store.get("activity_logs", [])
    }

@router.get("/scrape/stream/{task_id}")
async def stream_progress(task_id: str):
    """
    Endpoint stream progress menggunakan Server-Sent Events (SSE) asinkronus.
    Memantau update progress dan log aktivitas multi-agent dari background task secara real-time.
    """
    async def event_generator():
        last_progress = -1
        last_log_count = 0
        heartbeat_ticks = 0
        while True:
            progress = progress_store.get(task_id)
            if not progress:
                progress = {
                    "task_id": task_id,
                    "status": "processing",
                    "progress": 0,
                    "message": "[Supervisor Agent] Mengantrekan tugas seeding...",
                    "logs": ["[Supervisor Agent] Mengantrekan tugas seeding..."],
                    "activity_logs": []
                }
                progress_store[task_id] = progress

            all_logs = progress.get("logs", [])
            current_log_count = len(all_logs)
            current_percent = progress.get("progress", 0)
            current_status = progress.get("status", "processing")

            has_new_logs = current_log_count > last_log_count
            progress_changed = current_percent != last_progress

            if has_new_logs or progress_changed or heartbeat_ticks >= 10:
                new_logs = all_logs[last_log_count:current_log_count] if has_new_logs else []
                last_log_count = current_log_count
                last_progress = current_percent
                heartbeat_ticks = 0

                payload = {
                    "task_id": task_id,
                    "status": current_status,
                    "progress": current_percent,
                    "message": progress.get("message", ""),
                    "agent": progress.get("agent", "Supervisor Agent"),
                    "phase": progress.get("phase", "INGESTION"),
                    "new_logs": new_logs,
                    "details": progress.get("details", {})
                }

                yield {
                    "event": "message",
                    "data": json.dumps(payload)
                }
            else:
                heartbeat_ticks += 1

            if current_status in ["completed", "failed"] and current_log_count == last_log_count:
                break

            await asyncio.sleep(0.3)

    return EventSourceResponse(event_generator(), ping=15)

# =========================================================================
# ENDPOINTS MANAJEMEN TEMPLATE DINAMIS & HUMAN-IN-THE-LOOP (HITL)
# =========================================================================

@router.post("/templates/index-master", dependencies=[Depends(RoleChecker(["ADMIN", "ASLAB"]))])
async def index_master_template(
    file: UploadFile = File(...),
    id_mata_kuliah: str = Form(...)
):
    """
    Mengindeks dokumen PDF modul acuan utama (master template) ke Supabase pgvector.
    Teks yang diekstraksi dari file ini secara otomatis ditandai sebagai is_template = True
    dan dibatasi khusus untuk id_mata_kuliah yang ditentukan.
    """
    file_bytes = await file.read()
    parsed = await asyncio.to_thread(parse_document, file_bytes)

    chunker = TextChunker()
    text_embedder = get_text_embedder()
    all_chunks = []
    chunk_idx = 0

    # Ekstraksi chunks
    for page in parsed["pages"]:
        page_num = page["page_number"]
        page_chunks = chunker.chunk_page_words(page["words_with_geometry"], page_num)
        for ch in page_chunks:
            all_chunks.append({
                "page_num": page_num,
                "text": ch["text"],
                "bounding_box": ch["metadata"]["bounding_box"],
                "chunk_idx": chunk_idx
            })
            chunk_idx += 1

    if not all_chunks:
        return {"status": "success", "total_chunks_indexed": 0}

    # Generate embeddings
    texts = [c["text"] for c in all_chunks]
    dense_embeddings = text_embedder.encode_passages(texts)

    insert_query = """
        INSERT INTO public.laporan_text_vectors
        (id, id_laporan, id_mata_kuliah, page_number, text, bounding_box, program_studi, mata_kuliah, tahun, author, is_template, embedding)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s::extensions.vector)
    """
    batch_params = []
    for idx, c in enumerate(all_chunks):
        point_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"master_{id_mata_kuliah}_{c['page_num']}_{c['chunk_idx']}"))
        dense_vec = dense_embeddings[idx]
        vec_list = list(dense_vec) if hasattr(dense_vec, "tolist") else dense_vec
        
        batch_params.append((
            point_id,
            f"master_template_{id_mata_kuliah}",
            id_mata_kuliah,
            c["page_num"],
            c["text"],
            json.dumps(c["bounding_box"]),
            None,
            None,
            datetime.datetime.now().year,
            "MASTER_TEMPLATE",
            True,
            vec_list
        ))

    vector_db.execute_batch(insert_query, batch_params)
    logger.info(f"Berhasil mengindeks {len(batch_params)} vector master template ke Supabase.")

    return {"status": "success", "total_chunks_indexed": len(batch_params)}

class AutoDiscoverPayload(BaseModel):
    id_mata_kuliah: str
    frequency_threshold_percentage: float = 40.0

@router.post("/templates/auto-discover", dependencies=[Depends(RoleChecker(["ADMIN"]))])
async def auto_discover_templates(payload: AutoDiscoverPayload):
    """
    Secara otomatis mengidentifikasi kalimat templat praktikum berbasis frekuensi kemunculan
    langsung di PostgreSQL Supabase. Kalimat yang sering muncul lintas laporan pada mata kuliah
    tersebut akan diberi tag is_template = True.
    """
    # 1. Hitung jumlah dokumen unik pada mata kuliah ini
    doc_count_res = vector_db.execute_query(
        "SELECT COUNT(DISTINCT id_laporan) AS total_docs FROM public.laporan_text_vectors WHERE id_mata_kuliah = %s;",
        (payload.id_mata_kuliah,)
    )
    total_docs = doc_count_res[0]["total_docs"] if doc_count_res else 0
    if total_docs < 2:
        return {"status": "skipped", "reason": "Jumlah dokumen di database terlalu sedikit untuk analisis statistik."}

    threshold_count = int(total_docs * (payload.frequency_threshold_percentage / 100.0))
    if threshold_count < 2:
        threshold_count = 2

    # 2. Update status is_template berbasis frekuensi kemunculan menggunakan CTE
    update_query = """
        WITH repeated AS (
            SELECT text, COUNT(DISTINCT id_laporan) AS doc_count
            FROM public.laporan_text_vectors
            WHERE id_mata_kuliah = %s AND LENGTH(text) > 30
            GROUP BY text
            HAVING COUNT(DISTINCT id_laporan) >= %s
        )
        UPDATE public.laporan_text_vectors ltv
        SET is_template = TRUE
        FROM repeated r
        WHERE ltv.text = r.text AND ltv.id_mata_kuliah = %s AND ltv.is_template IS NOT TRUE
        RETURNING ltv.id;
    """
    updated_rows = vector_db.execute_query(update_query, (payload.id_mata_kuliah, threshold_count, payload.id_mata_kuliah))
    updated_count = len(updated_rows) if updated_rows else 0

    return {
        "status": "success",
        "total_documents_analyzed": total_docs,
        "frequency_threshold_count": threshold_count,
        "updated_points_count": updated_count
    }

class OverrideTemplatePayload(BaseModel):
    point_ids: List[str]
    is_template: bool
    id_mata_kuliah: Optional[str] = None

@router.post("/templates/override", dependencies=[Depends(RoleChecker(["ADMIN", "ASLAB"]))])
async def override_template_status(payload: OverrideTemplatePayload, background_tasks: BackgroundTasks):
    """
    Human-in-the-Loop (HITL) Correction.
    Asisten Lab/Dosen dapat membatalkan atau menetapkan status is_template pada point vector tertentu.
    Memicu adaptasi representasi centroid Prototypical Head secara otomatis.
    """
    if not payload.point_ids:
        return {"status": "success", "updated_points_count": 0}

    update_query = """
        UPDATE public.laporan_text_vectors
        SET is_template = %s
        WHERE id = ANY(%s::uuid[])
        RETURNING id, id_mata_kuliah;
    """
    updated_rows = vector_db.execute_query(update_query, (payload.is_template, payload.point_ids))
    updated_count = len(updated_rows) if updated_rows else 0
    logger.info(f"HITL Override sukses mengeksekusi {updated_count} updates (is_template = {payload.is_template}).")

    target_matkul = payload.id_mata_kuliah
    if not target_matkul and updated_rows:
        target_matkul = str(updated_rows[0].get("id_mata_kuliah") or "")

    if target_matkul:
        from app.core.proto_trainer import get_proto_trainer
        trainer = get_proto_trainer()
        background_tasks.add_task(trainer.on_hitl_correction, target_matkul)

    return {"status": "success", "updated_points_count": updated_count}

@router.get("/templates", dependencies=[Depends(RoleChecker(["ADMIN", "ASLAB"]))])
async def get_all_templates(id_mata_kuliah: str):
    """
    Mendapatkan seluruh chunk teks yang terdaftar sebagai template praktikum (is_template = True)
    khusus untuk mata kuliah tertentu agar dapat ditampilkan dan dikoreksi pada dashboard admin.
    """
    query = """
        SELECT id AS point_id, text, page_number AS page, author, is_template
        FROM public.laporan_text_vectors
        WHERE is_template = TRUE AND id_mata_kuliah = %s
        ORDER BY tanggal_dibuat DESC
        LIMIT 500;
    """
    rows = vector_db.execute_query(query, (id_mata_kuliah,))
    templates = [
        {
            "point_id": str(r["point_id"]),
            "text": r.get("text", ""),
            "page": r.get("page", 1),
            "author": r.get("author", "Unknown"),
            "is_template": True
        }
        for r in rows
    ]
    return {"status": "success", "total_templates": len(templates), "templates": templates}

class ProtoTrainPayload(BaseModel):
    id_mata_kuliah: str
    epochs: Optional[int] = None

@router.post("/proto/train", dependencies=[Depends(RoleChecker(["ADMIN", "ASLAB"]))])
async def train_course_prototype(payload: ProtoTrainPayload, background_tasks: BackgroundTasks):
    """
    Memicu pelatihan Prototypical Head dan pembaruan centroid untuk mata kuliah tertentu secara asinkronus.
    """
    from app.core.proto_trainer import get_proto_trainer
    trainer = get_proto_trainer()
    background_tasks.add_task(trainer.train_and_store, payload.id_mata_kuliah, payload.epochs, "manual_retrain")
    return {
        "status": "success",
        "message": f"Pelatihan Prototypical Head untuk mata kuliah {payload.id_mata_kuliah} telah dijadwalkan.",
        "id_mata_kuliah": payload.id_mata_kuliah
    }

@router.get("/proto/status/{id_mata_kuliah}", dependencies=[Depends(RoleChecker(["ADMIN", "ASLAB"]))])
async def get_course_prototype_status(id_mata_kuliah: str):
    """
    Mendapatkan status representasi prototype (centroid) untuk mata kuliah tertentu.
    """
    query = """
        SELECT class_label, sample_count, last_trained_at, model_version
        FROM public.course_prototypes
        WHERE id_mata_kuliah = %s;
    """
    rows = vector_db.execute_query(query, (id_mata_kuliah,)) or []

    log_query = """
        SELECT trigger_type, template_samples, original_samples, loss_before, loss_after, created_at
        FROM public.prototype_training_log
        WHERE id_mata_kuliah = %s
        ORDER BY created_at DESC
        LIMIT 5;
    """
    logs = vector_db.execute_query(log_query, (id_mata_kuliah,)) or []

    return {
        "status": "success",
        "id_mata_kuliah": id_mata_kuliah,
        "has_prototypes": len(rows) >= 2,
        "prototypes": rows,
        "recent_training_logs": logs
    }

class ProtoClassifyPayload(BaseModel):
    text: str
    id_mata_kuliah: str

@router.post("/proto/classify", dependencies=[Depends(RoleChecker(["ADMIN", "ASLAB"]))])
async def classify_text_with_prototype(payload: ProtoClassifyPayload):
    """
    Mengklasifikasikan satu potongan teks terhadap model prototype mata kuliah tertentu.
    """
    from app.core.embedder_text import get_text_embedder
    from app.core.proto_trainer import get_proto_trainer

    text_embedder = get_text_embedder()
    emb = text_embedder.encode_passages([payload.text])[0]

    trainer = get_proto_trainer()
    result = trainer.classify_chunk(emb, payload.id_mata_kuliah)

    if not result:
        return {
            "status": "not_trained",
            "message": f"Centroid untuk mata kuliah {payload.id_mata_kuliah} belum tersedia di basis data.",
            "id_mata_kuliah": payload.id_mata_kuliah
        }

    return {
        "status": "success",
        "id_mata_kuliah": payload.id_mata_kuliah,
        "classification": result
    }

class CrossCheckPayload(BaseModel):
    id_mata_kuliah: str
    similarity_threshold: float = 0.85

@router.post("/cross-check", dependencies=[Depends(RoleChecker(["ADMIN"]))])
async def cross_collusion_check(payload: CrossCheckPayload):
    """
    Menganalisis kemiripan silang antar-laporan yang terindeks di Supabase
    untuk mata kuliah tertentu. Mendeteksi pasangan laporan yang saling
    terindikasi memiliki kesamaan konten semantik melampaui ambang batas.
    """
    logger.info(f"Memulai cross-collusion check untuk mata kuliah: {payload.id_mata_kuliah}")

    # 1. Ambil dokumen unik pada mata kuliah ini
    doc_rows = vector_db.execute_query(
        "SELECT DISTINCT id_laporan FROM public.laporan_text_vectors WHERE id_mata_kuliah = %s;",
        (payload.id_mata_kuliah,)
    )
    doc_ids = [r["id_laporan"] for r in doc_rows if r.get("id_laporan")]
    if len(doc_ids) < 2:
        return {
            "status": "success",
            "id_mata_kuliah": payload.id_mata_kuliah,
            "similarity_threshold": payload.similarity_threshold,
            "total_documents_analyzed": len(doc_ids),
            "total_collusion_pairs": 0,
            "collusion_matches": []
        }

    # 2. Cari pasangan dengan kemiripan tinggi antar-dokumen berbeda dalam mata kuliah yang sama
    collusion_query = """
        SELECT 
            a.id_laporan AS doc_a,
            b.id_laporan AS doc_b,
            (1 - (a.embedding <=> b.embedding))::FLOAT AS similarity,
            SUBSTRING(a.text FROM 1 FOR 150) AS text_a,
            SUBSTRING(b.text FROM 1 FOR 150) AS text_b,
            a.page_number AS page_a,
            b.page_number AS page_b
        FROM public.laporan_text_vectors a
        JOIN public.laporan_text_vectors b 
            ON a.id_mata_kuliah = b.id_mata_kuliah
            AND a.id_laporan < b.id_laporan
            AND (a.is_template IS NOT TRUE)
            AND (b.is_template IS NOT TRUE)
        WHERE a.id_mata_kuliah = %s
          AND (1 - (a.embedding <=> b.embedding)) >= %s
        ORDER BY similarity DESC
        LIMIT 100;
    """
    matches = vector_db.execute_query(collusion_query, (payload.id_mata_kuliah, payload.similarity_threshold))

    return {
        "status": "success",
        "id_mata_kuliah": payload.id_mata_kuliah,
        "similarity_threshold": payload.similarity_threshold,
        "total_documents_analyzed": len(doc_ids),
        "total_collusion_pairs": len(matches),
        "collusion_matches": matches
    }

class ChatbotMessagePayload(BaseModel):
    message: str
    id_laporan: Optional[str] = None
    role: str = "ASLAB"

@router.post("/chatbot/message", dependencies=[Depends(RoleChecker(["ADMIN", "ASLAB", "KEPALA_LAB"]))])
async def handle_chatbot_message(payload: ChatbotMessagePayload):
    """
    Endpoint perpesanan Chatbot Integritas Akademik dengan Role-Based Context Injection
    sesuai spesifikasi PRD Chatbot Integritas Akademik §2–§4.
    """
    try:
        response_text = await process_chat_message(
            message=payload.message,
            role=payload.role,
            id_laporan=payload.id_laporan
        )
        return {"status": "success", "response": response_text}
    except Exception as e:
        logger.error(f"Galat saat mengeksekusi chatbot message: {e}")
        raise HTTPException(status_code=500, detail=f"Gagal memproses pesan: {str(e)}")


