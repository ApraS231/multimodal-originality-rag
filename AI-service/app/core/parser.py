import fitz
import easyocr
import logging
import re
import os
import io
import uuid
import numpy as np
from PIL import Image

# Mitigasi pixel-flood / decompression bomb: batasi resolusi gambar maksimum agar tidak memicu OOM
Image.MAX_IMAGE_PIXELS = 50_000_000

# Setup logger
logger = logging.getLogger("AI-Service")

# Global singleton reader to lazy load EasyOCR models
_easyocr_reader = None

def get_easyocr_reader():
    """
    Mengambil instance singleton EasyOCR reader secara lazy-loaded.
    """
    global _easyocr_reader
    if _easyocr_reader is None:
        logger.info("Memuat model bahasa EasyOCR (Indonesian & English)...")
        # Inisialisasi EasyOCR reader untuk Bahasa Indonesia dan Inggris
        _easyocr_reader = easyocr.Reader(['id', 'en'])
        logger.info("Model EasyOCR berhasil dimuat.")
    return _easyocr_reader

def extract_cover_metadata(cover_text: str) -> dict:
    """
    Mengekstrak nama mahasiswa dan NIM dari halaman pertama (cover) menggunakan regex.
    """
    if not cover_text:
        return {"mahasiswa_nama": None, "nim": None}
        
    lines = cover_text.split("\n")
    
    # Regex patterns yang toleran terhadap variasi cover
    nama_pattern = re.compile(r'(?:Nama|Oleh|Disusun oleh)\s*:?\s*([A-Za-z\s\.\,\']{3,50})', re.IGNORECASE)
    nim_pattern = re.compile(r'(?:NIM|NRP)\s*:?\s*([0-9a-zA-Z]+)', re.IGNORECASE)
    
    mahasiswa_nama = None
    nim = None
    
    # Cari baris per baris agar lebih akurat dan menghindari interferensi baris lain
    for line in lines:
        line_strip = line.strip()
        if not line_strip:
            continue
            
        if not mahasiswa_nama:
            match = nama_pattern.search(line_strip)
            if match:
                val = match.group(1).strip()
                # Hindari kata kunci pencocokan yang terdeteksi sebagai nama
                if val.lower() not in ["nama", "oleh", "disusun oleh"]:
                    mahasiswa_nama = val
                    
        if not nim:
            match = nim_pattern.search(line_strip)
            if match:
                nim = match.group(1).strip()
                
    # Fallback pencarian global jika pencarian baris per baris gagal
    if not mahasiswa_nama:
        match = nama_pattern.search(cover_text)
        if match:
            mahasiswa_nama = match.group(1).strip()
            
    if not nim:
        match = nim_pattern.search(cover_text)
        if match:
            nim = match.group(1).strip()
            
    # Bersihkan nama dari interferensi NIM/NRP yang ikut tercocok akibat EasyOCR line joining
    if mahasiswa_nama:
        # Pisahkan jika ada kata kunci NIM atau NRP
        parts = re.split(r'\s+(?:NIM|NRP)\b', mahasiswa_nama, flags=re.IGNORECASE)
        mahasiswa_nama = parts[0].strip()
        # Bersihkan spasi ganda atau newline
        mahasiswa_nama = re.sub(r'\s+', ' ', mahasiswa_nama)
            
    return {
        "mahasiswa_nama": mahasiswa_nama,
        "nim": nim
    }

def extract_double_check_metadata(doc: fitz.Document, cover_text: str, source_filename: str = "") -> dict:
    """
    Mekanisme ekstraksi ganda (double-check) untuk mendeteksi judul laporan, identitas mahasiswa,
    dan NIM dengan mengombinasikan teks halaman sampul (cover) dan dokumen metadata bawaan PDF.
    """
    # 1. Ekstraksi Penulis dan NIM dari Cover
    cover_meta = extract_cover_metadata(cover_text)
    mahasiswa_nama = cover_meta.get("mahasiswa_nama")
    nim = cover_meta.get("nim")
    
    # 2. Dokumen Metadata PDF
    pdf_meta = doc.metadata if (doc and hasattr(doc, "metadata") and doc.metadata) else {}
    raw_pdf_title = (pdf_meta.get("title") or "").strip()
    raw_pdf_author = (pdf_meta.get("author") or "").strip()
    
    # Pembersihan Metadata Author dari akun bawaan sistem
    generic_authors = {
        "admin", "administrator", "user", "owner", "asus", "lenovo", "acer", 
        "windows", "dell", "guest", "student", "toshiba", "pc", "hp", "microsoft"
    }
    if raw_pdf_author and raw_pdf_author.lower() in generic_authors:
        raw_pdf_author = ""
        
    # Jika nama mahasiswa belum ditemukan di cover, gunakan author dari PDF metadata
    if not mahasiswa_nama and raw_pdf_author and len(raw_pdf_author) >= 3:
        mahasiswa_nama = raw_pdf_author.title()
    elif not mahasiswa_nama:
        mahasiswa_nama = "Mahasiswa Non-Identifikasi"
        
    if not nim:
        nim = "NIM-TIDAK-TERDETEKSI"
        
    # 3. Ekstraksi Judul dari Cover
    cover_title = None
    if cover_text:
        lines = [line.strip() for line in cover_text.split("\n") if line.strip()]
        boilerplate_terms = [
            "kementerian", "sekolah tinggi", "stitek", "bontang", "program studi", "jurusan",
            "teknik informatika", "sistem informasi", "halaman judul", "diajukan untuk",
            "disusun oleh", "oleh:", "nama:", "nim:", "nrp:", "dosen pengampu", "laboratorium",
            "tahun akademik", "lembar pengesahan", "kata pengantar"
        ]
        
        candidate_lines = []
        for line in lines:
            line_lower = line.lower()
            if any(term in line_lower for term in boilerplate_terms):
                continue
            if re.match(r'^\d{4}$', line):  # tahun semata
                continue
            if 8 <= len(line) <= 180:
                candidate_lines.append(line)
                
        if candidate_lines:
            laporan_candidates = [c for c in candidate_lines if any(k in c.lower() for k in ["laporan", "praktikum", "tugas", "makalah", "sistem", "analisis", "rancang"])]
            if laporan_candidates:
                idx = candidate_lines.index(laporan_candidates[0])
                cover_title = " - ".join(candidate_lines[idx:idx+2])
            else:
                cover_title = candidate_lines[0]
                
    # 4. Pembersihan Judul dari PDF Metadata
    clean_pdf_title = ""
    if raw_pdf_title:
        cleaned = re.sub(r'^microsoft\s+word\s*-\s*', '', raw_pdf_title, flags=re.IGNORECASE).strip()
        cleaned = re.sub(r'\.docx?$', '', cleaned, flags=re.IGNORECASE).strip()
        cleaned = re.sub(r'\.pdf$', '', cleaned, flags=re.IGNORECASE).strip()
        if cleaned.lower() not in ["document1", "dokumen1", "untitled", "scan", "laporan"] and len(cleaned) >= 6:
            clean_pdf_title = cleaned
            
    # 5. Validasi Silang (Cross-Validation) Penentuan Judul Final
    final_judul = None
    if cover_title and len(cover_title) >= 10:
        final_judul = cover_title
    elif clean_pdf_title:
        final_judul = clean_pdf_title
    elif cover_title:
        final_judul = cover_title
    else:
        # Fallback ke nama berkas fisik
        if source_filename:
            base_name = os.path.splitext(os.path.basename(source_filename))[0]
            clean_name = re.sub(r'[_\-]+', ' ', base_name).strip()
            final_judul = clean_name.title() if clean_name else "Laporan Akademik Referensi"
        else:
            final_judul = "Laporan Akademik Referensi"
            
    final_judul = re.sub(r'\s+', ' ', final_judul).strip()
    
    return {
        "judul": final_judul,
        "mahasiswa_nama": mahasiswa_nama,
        "nama_mahasiswa": mahasiswa_nama,
        "nim": nim,
        "cover_title": cover_title,
        "pdf_title": clean_pdf_title,
        "pdf_metadata": pdf_meta
    }

def parse_document(file_bytes: bytes, id_laporan: str = None, source_filename: str = "") -> dict:
    """
    Membongkar file bytes PDF untuk mengekstrak teks digital/OCR, koordinat kata, 
    dan gambar pendukung praktikum yang berdimensi >= 150px.
    """
    if not id_laporan:
        id_laporan = str(uuid.uuid4())
        
    # Membuka dokumen PDF dari memori
    doc = fitz.open(stream=file_bytes, filetype="pdf")
    
    # 1. Menghitung total karakter digital untuk menentukan apakah scanned PDF
    total_digital_chars = 0
    digital_pages_text = []
    for page in doc:
        text = page.get_text("text")
        total_digital_chars += len(text.strip())
        digital_pages_text.append(text)
        
    # Fallback OCR aktif jika total karakter digital <= 50
    ocr_fallback_active = total_digital_chars <= 50
    
    pages_data = []
    all_extracted_images = []
    
    # Buat direktori static penyimpanan gambar
    static_dir = os.path.join("static", "extracted_images")
    os.makedirs(static_dir, exist_ok=True)
    
    cover_text = ""
    
    for page_idx, page in enumerate(doc):
        page_num = page_idx + 1
        width = page.rect.width
        height = page.rect.height
        
        page_text = ""
        words_with_geometry = []
        page_images = []
        
        # A. Proses Ekstraksi Teks dan Geometri
        if not ocr_fallback_active:
            # Menggunakan ekstraksi digital PyMuPDF
            page_text = digital_pages_text[page_idx]
            words = page.get_text("words")
            # Format w: (x0, y0, x1, y1, "word", block_no, line_no, word_no)
            for w in words:
                words_with_geometry.append({
                    "text": w[4],
                    "x1": float(w[0]),
                    "y1": float(w[1]),
                    "x2": float(w[2]),
                    "y2": float(w[3])
                })
        else:
            # Menggunakan Fallback OCR (EasyOCR)
            logger.info(f"Halaman {page_num}: PDF terdeteksi sebagai scanned. Menjalankan EasyOCR fallback...")
            
            # Render halaman PDF ke gambar beresolusi tinggi (DPI 150)
            zoom = 150.0 / 72.0
            mat = fitz.Matrix(zoom, zoom)
            pix = page.get_pixmap(matrix=mat)
            
            # Muat gambar ke numpy array
            img_bytes = pix.tobytes("png")
            img = Image.open(io.BytesIO(img_bytes))
            img_np = np.array(img)
            
            # Panggil EasyOCR reader
            reader = get_easyocr_reader()
            ocr_results = reader.readtext(img_np)
            
            # Normalisasi koordinat EasyOCR (piksel) ke standar PDF points (72 DPI)
            scale = 72.0 / 150.0
            ocr_texts = []
            
            for bbox, text, conf in ocr_results:
                x_min = float(min(pt[0] for pt in bbox) * scale)
                y_min = float(min(pt[1] for pt in bbox) * scale)
                x_max = float(max(pt[0] for pt in bbox) * scale)
                y_max = float(max(pt[1] for pt in bbox) * scale)
                
                words_with_geometry.append({
                    "text": text,
                    "x1": x_min,
                    "y1": y_min,
                    "x2": x_max,
                    "y2": y_max
                })
                ocr_texts.append(text)
                
            page_text = " ".join(ocr_texts)
            
        # Simpan teks cover (halaman pertama)
        if page_num == 1:
            cover_text = page_text
            
        # B. Proses Ekstraksi Gambar
        image_list = page.get_images(full=True)
        for img_idx, img_meta in enumerate(image_list):
            xref = img_meta[0]
            try:
                base_image = doc.extract_image(xref)
                image_bytes = base_image["image"]
                
                # Validasi resolusi gambar
                pil_img = Image.open(io.BytesIO(image_bytes))
                img_w, img_h = pil_img.size
                
                if img_w >= 150 and img_h >= 150:
                    # Dapatkan rect koordinat gambar di halaman PDF
                    rects = page.get_image_rects(xref)
                    bbox = {"x1": 0.0, "y1": 0.0, "x2": 0.0, "y2": 0.0}
                    if rects:
                        r = rects[0]
                        bbox = {
                            "x1": float(r.x0),
                            "y1": float(r.y0),
                            "x2": float(r.x1),
                            "y2": float(r.y1)
                        }
                        
                    # Simpan berkas gambar fisik secara lokal sebagai cache
                    image_filename = f"img_{id_laporan}_p{page_num}_{img_idx}.png"
                    image_filepath = os.path.join(static_dir, image_filename)
                    pil_img.save(image_filepath, format="PNG")
                    
                    # Coba unggah langsung ke Supabase Storage (bucket laporan_images)
                    web_filepath = f"/static/extracted_images/{image_filename}"
                    try:
                        from app.db.supabase_client import vector_db
                        storage_url = vector_db.upload_image_to_storage(
                            image_bytes=image_bytes,
                            filename=image_filename,
                            content_type="image/png",
                            bucket="laporan_images"
                        )
                        if storage_url:
                            web_filepath = storage_url
                    except Exception as upload_err:
                        logger.warning(f"Fallback penyimpanan lokal untuk {image_filename}: {upload_err}")
                    
                    img_data = {
                        "image_id": f"img_{id_laporan}_p{page_num}_{img_idx}",
                        "page_number": page_num,
                        "bounding_box": bbox,
                        "file_path": web_filepath,
                        "raw_bytes": image_bytes
                    }
                    page_images.append(img_data)
                    all_extracted_images.append(img_data)
            except Exception as e:
                logger.warning(f"Gagal mengekstrak gambar xref {xref} pada halaman {page_num}: {str(e)}")
                
        pages_data.append({
            "page_number": page_num,
            "width": float(width),
            "height": float(height),
            "text": page_text,
            "words_with_geometry": words_with_geometry,
            "extracted_images": page_images
        })
        
    # C. Ekstraksi cover dan metadata ganda (double-check)
    metadata = extract_double_check_metadata(doc, cover_text, source_filename)
    
    return {
        "ocr_fallback_active": ocr_fallback_active,
        "metadata_extracted": metadata,
        "pages": pages_data,
        "extracted_images": all_extracted_images
    }
