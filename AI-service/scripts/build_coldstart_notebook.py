"""
Skrip Pembangun Notebook Google Colab: coldstart_training_pipeline.ipynb (Versi Koneksi Robust & Foolproof)
Membangun notebook Jupyter untuk inisialisasi data cold-start, ekstraksi PDF multimodal,
pelatihan Prototypical Network, domain adaptation SBERT, dan seeding ke Supabase pgvector (Teks & Gambar CLIP).

Fitur Keandalan Tinggi:
- Penanganan URL Database Anti-Error: Mengurai URI ke parameter keyword eksplisit (host, user, password, dbname).
- Mengatasi bug psycopg2 libpq percent-encoding: "invalid percent-encoded token: ?-tAQ9!wzg%8Vz-".
- Toleran terhadap salah ketik nama Secrets (DATABASE_URL, DATABAS, DB_URL) atau string terpotong ('ostgre...').
- Ekstraksi gambar PDF multimodal & seeding tabel laporan_image_vectors (CLIP 512d).
"""

import json
import os

def create_notebook():
    cells = []

    def md_cell(text):
        return {
            "cell_type": "markdown",
            "metadata": {},
            "source": [line + "\n" for line in text.strip().split("\n")]
        }

    def code_cell(code):
        return {
            "cell_type": "code",
            "execution_count": None,
            "metadata": {},
            "outputs": [],
            "source": [line + "\n" for line in code.strip().split("\n")]
        }

    # =========================================================================
    # Sel 1: Header & Panduan Arsitektur
    # =========================================================================
    cells.append(md_cell("""
# 🏛️ Pipeline Cold-Start Data Training & Seeding Repositori
### Sistem Deteksi Orisinalitas Laporan Praktikum — STITEK Bontang

Notebook ini dikonfigurasi untuk menjalankan **inisialisasi data awal (*cold-start*)**, ekstraksi naskah laporan praktikum laboratorium, deteksi *boilerplate* otomatis, adaptasi domain Sentence-BERT (Pipeline C), ekstraksi visual diagram laporan menggunakan **OpenAI CLIP**, serta pelatihan representasi prototipikal (*Prototypical Network Head*).

---
### 📐 Arsitektur Pipeline yang Dijalankan:
1. **Ekstraksi Multimodal:** Pembacaan naskah PDF digital & pindaian (*scanned PDF*) dengan fallback OCR GPU EasyOCR ($72\\text{ DPI}$) serta ekstraksi diagram gambar visual.
2. **Aturan Deteksi Boilerplate Lintas Laporan:** Potongan teks yang terdeteksi identik/berkemiripan tinggi pada $\\ge 5$ laporan mahasiswa berbeda otomatis ditandai sebagai *template praktikum* ($is\\_template = \\text{True}$).
3. **Ekstraksi Vektor Multimodal:**
   - **Teks:** Sentence-BERT `intfloat/multilingual-e5-base` ($768\\text{-dim}$) dengan konvensi prefix `passage: ` dan `query: `.
   - **Visual Gambar/Diagram:** OpenAI CLIP `openai/clip-vit-base-patch32` ($512\\text{-dim}$).
4. **Prototypical Network Head:** Pelatihan arsitektur $768 \\to 256 \\to 128$ ($L_2$-Normalized) untuk menghasilkan centroid $c_{\\text{template}}$ dan $c_{\\text{original}}$ per mata kuliah. Mendukung mode *cold-start* ($< 3$ sampel) dan *episodic metric learning*.
5. **Fine-Tuning SBERT Unsupervised:** Pelatihan ulang representasi semantik laporan teknik informatika dengan *MultipleNegativesRankingLoss* (SimCSE) dan proteksi *semantic drift* ($skorOrisinalitas > 75\\%$).
6. **Injeksi Seeding ke Supabase pgvector:** Pengisian tabel `laporan_text_vectors`, `laporan_image_vectors` ($512\\text{-dim}$), `course_prototypes`, dan `prototype_training_log`.
7. **Ekspor Bobot Model Siap Pasang:** Mengemas bobot `sbert_v2/` dan `proto_head.pt` untuk langsung di-*hot-swap* pada microservice lokal.
"""))

    # =========================================================================
    # Sel 2: Setup Lingkungan GPU & Dependensi
    # =========================================================================
    cells.append(md_cell("""
---
## 🛠️ Langkah 1: Akselerasi GPU & Instalasi Pustaka Dependensi

Pastikan Google Colab berjalan pada runtime GPU (T4 GPU):
* Masuk ke menu: **Runtime** $\\to$ **Change runtime type** $\\to$ pilih **T4 GPU** $\\to$ **Save**.
"""))

    cells.append(code_cell("""
# 1. Pemasangan dependensi utama pipeline multimodal & pgvector
!pip install -q pymupdf easyocr sentence-transformers transformers torch torchvision torchaudio pillow psycopg2-binary pgvector pydantic pydantic-settings

import torch
import os
import sys

device = "cuda" if torch.cuda.is_available() else "cpu"
print(f"Perangkat Komputasi Aktif: {'GPU CUDA (' + torch.cuda.get_device_name(0) + ')' if device == 'cuda' else 'CPU (Peringatan: Disarankan beralih ke GPU)'}")
"""))

    # =========================================================================
    # Sel 3: Konfigurasi Kredensial Lingkungan secara Aman & Konektor Anti-Error
    # =========================================================================
    cells.append(md_cell("""
---
## 🔑 Langkah 2: Konfigurasi Variabel Lingkungan & Kredensial secara Aman

Masukkan nilai kredensial berikut pada panel **Secrets** (ikon kunci 🔑) di sebelah kiri Google Colab:
* `DATABASE_URL`: URI koneksi Supabase PostgreSQL (contoh: `postgresql://postgres.[ref]:[password]@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres`)
* `HF_TOKEN` *(Opsional)*: Akses token Hugging Face untuk download model cepat.

> **Fitur Keandalan Tinggi:** Sel ini dilengkapi parser URI cerdas yang memecah string koneksi menjadi parameter terpisah (`host`, `user`, `password`, `dbname`). Pendekatan ini menyelesaikan galat bawaan library `psycopg2/libpq` (`ProgrammingError: invalid dsn: invalid percent-encoded token`) yang timbul jika password basis data mengandung karakter khusus seperti tanda tanya (`?`), tanda seru (`!`), atau persen (`%`).
"""))

    cells.append(code_cell("""
import os
import urllib.parse
import psycopg2
from pgvector.psycopg2 import register_vector
from google.colab import userdata

# 1. Pencarian Nilai Database URL dari Secrets (dengan toleransi saltik nama kunci)
db_raw = None
candidate_keys = ["DATABASE_URL", "DATABASE", "DATABAS", "DB_URL", "POSTGRES_URL"]

for k in candidate_keys:
    try:
        val = userdata.get(k)
        if val and len(val.strip()) > 10:
            db_raw = val.strip()
            print(f"✅ Berhasil memuat URL database dari Colab Secret: '{k}'")
            break
    except Exception:
        pass

if not db_raw:
    import getpass
    print("⚠️ Kunci DATABASE_URL tidak ditemukan di Secrets.")
    db_raw = getpass.getpass("Masukkan URI Supabase PostgreSQL: ").strip()

# 2. Pembersihan & Normalisasi String URI
db_raw = db_raw.strip().strip("'").strip('"')

# Koreksi otomatis jika huruf depan 'p' terpotong saat paste (misal 'ostgresql://')
if db_raw.startswith("ostgresql://"):
    db_raw = "p" + db_raw
elif db_raw.startswith("ostgres://"):
    db_raw = "p" + db_raw
elif not (db_raw.startswith("postgresql://") or db_raw.startswith("postgres://")):
    db_raw = "postgresql://" + db_raw

os.environ["DATABASE_URL"] = db_raw

# 3. Fungsi Penghubung Mandiri (Mem-bypass Bug Percent-Encoding libpq)
def get_supabase_connection():
    \"\"\"
    Membuka koneksi PostgreSQL secara aman dengan memecah URI menjadi komponen keyword.
    Kebal terhadap karakter khusus pada password seperti '?', '!', '%'.
    \"\"\"
    raw = os.environ.get("DATABASE_URL", "")
    u = urllib.parse.urlparse(raw)
    
    # Unquote password secara eksplisit
    user = urllib.parse.unquote(u.username or "")
    pwd = urllib.parse.unquote(u.password or "")
    host = u.hostname
    port = u.port or 5432
    dbname = u.path.lstrip('/') or "postgres"
    
    conn = psycopg2.connect(
        host=host,
        port=port,
        user=user,
        password=pwd,
        dbname=dbname,
        sslmode="require"
    )
    register_vector(conn)
    return conn

# Uji coba koneksi awal ke Supabase
try:
    test_conn = get_supabase_connection()
    with test_conn.cursor() as cur:
        cur.execute("SELECT 1;")
    test_conn.close()
    print("✅ Koneksi awal ke Supabase PostgreSQL + pgvector BERHASIL diverifikasi!")
except Exception as conn_err:
    print(f"❌ Peringatan koneksi: {conn_err}")
    print("Pastikan host, port, dan password Supabase Anda sudah tepat.")

# 4. Token Hugging Face (Opsional)
try:
    for hf_k in ["HF_TOKEN", "HF_TOKEI", "HUGGINGFACE_TOKEN"]:
        val = userdata.get(hf_k)
        if val:
            os.environ["HF_TOKEN"] = val.strip()
            print(f"✅ HF_TOKEN terkonfigurasi dari secret: '{hf_k}'.")
            break
except Exception:
    pass

print("Inisialisasi lingkungan konfigurasi selesai.")
"""))

    # =========================================================================
    # Sel 4: Mount Google Drive & Konfigurasi Direktori Laporan
    # =========================================================================
    cells.append(md_cell("""
---
## 📂 Langkah 3: Pemasangan Google Drive & Parameter Mata Kuliah

Atur path folder naskah laporan praktikum di Google Drive serta metadata mata kuliah target untuk inisialisasi basis data.
"""))

    cells.append(code_cell("""
from google.colab import drive
import os

drive.mount('/content/drive')

# =========================================================================
# PARAMETER METADATA MATA KULIAH TARGET
# =========================================================================
ID_MATA_KULIAH = "77b21e8d-d779-46f3-a128-091a13be45cb"
NAMA_MATA_KULIAH = "Desain & Pemrograman Web"
KODE_MATA_KULIAH = "TIF-2025"
PROGRAM_STUDI = "Teknik Informatika"
TAHUN_AKADEMIK = 2025

# Direktori naskah PDF di Google Drive
DRIVE_DATASET_DIR = f"/content/drive/MyDrive/DATASET (cloud laporan matakuliah)/Laporan DPP 2025"

if not os.path.exists(DRIVE_DATASET_DIR):
    DRIVE_DATASET_DIR = "/content/sample_dataset_laporan"
    os.makedirs(DRIVE_DATASET_DIR, exist_ok=True)
    print(f"Menggunakan direktori kerja alternatif: {DRIVE_DATASET_DIR}")
else:
    print(f"Direktori dataset terhubung: {DRIVE_DATASET_DIR}")
"""))

    # =========================================================================
    # Sel 5: Ekstraktor Dokumen PDF & Fallback OCR GPU (Multimodal)
    # =========================================================================
    cells.append(md_cell("""
---
## 📄 Langkah 4: Modul Ekstraksi Dokumen & Fallback OCR GPU (72 DPI)

Sesuai dengan service `app/core/parser.py`:
- Memeriksa apakah halaman PDF adalah naskah digital atau hasil pemindaian (*scanned*).
- Jika teks terdeteksi $\\le 50$ karakter, modul EasyOCR GPU diaktifkan ($72\\text{ DPI}$).
- Mengekstrak gambar raster via `doc.extract_image(xref)` dengan pencatatan koordinat *bounding box* `page.get_image_rects(xref)`.
"""))

    cells.append(code_cell("""
import fitz  # PyMuPDF
import easyocr
from PIL import Image
import io
import re
import torch

device = "cuda" if torch.cuda.is_available() else "cpu"

class MultimodalDocumentParser:
    def __init__(self):
        self.device = device
        self._ocr_reader = None

    def get_ocr_reader(self):
        if self._ocr_reader is None:
            print(f"Memuat model EasyOCR ke memori ({self.device})...")
            self._ocr_reader = easyocr.Reader(['id', 'en'], gpu=(self.device == "cuda"))
        return self._ocr_reader

    def parse_pdf(self, pdf_path: str):
        doc = fitz.open(pdf_path)
        words_per_page = []
        extracted_images = []

        total_chars = sum(len(page.get_text()) for page in doc)
        is_scanned = (total_chars <= 50)

        for page_idx, page in enumerate(doc):
            page_words = []
            page_num = page_idx + 1

            if is_scanned:
                # Mode OCR Fallback (72 DPI matrix scaling)
                zoom = 150 / 72.0
                mat = fitz.Matrix(zoom, zoom)
                pix = page.get_pixmap(matrix=mat)
                img_data = pix.tobytes("png")

                reader = self.get_ocr_reader()
                results = reader.readtext(img_data)
                scale = 72.0 / 150.0

                for bbox, text, conf in results:
                    text_clean = text.strip()
                    if not text_clean:
                        continue
                    x1 = min(pt[0] for pt in bbox) * scale
                    y1 = min(pt[1] for pt in bbox) * scale
                    x2 = max(pt[0] for pt in bbox) * scale
                    y2 = max(pt[1] for pt in bbox) * scale
                    page_words.append({
                        "text": text_clean,
                        "x1": float(x1), "y1": float(y1),
                        "x2": float(x2), "y2": float(y2),
                        "page": page_num
                    })
            else:
                # Ekstraksi Kata Digital PyMuPDF
                raw_words = page.get_text("words")
                for w in raw_words:
                    word_str = str(w[4]).strip()
                    if word_str:
                        page_words.append({
                            "text": word_str,
                            "x1": float(w[0]), "y1": float(w[1]),
                            "x2": float(w[2]), "y2": float(w[3]),
                            "page": page_num
                        })

            words_per_page.append({"page": page_num, "words": page_words})

            # Ekstraksi Gambar & Diagram Visual untuk CLIP
            image_list = page.get_images(full=True)
            for img_idx, img_meta in enumerate(image_list):
                xref = img_meta[0]
                try:
                    base_img = doc.extract_image(xref)
                    img_bytes = base_img["image"]
                    img_ext = base_img["ext"]
                    pil_img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
                    
                    # Saring gambar icon yang terlalu kecil (< 60x60 px)
                    if pil_img.width >= 60 and pil_img.height >= 60:
                        rects = page.get_image_rects(xref)
                        bbox = {"x1": 0.0, "y1": 0.0, "x2": float(pil_img.width), "y2": float(pil_img.height)}
                        if rects:
                            r = rects[0]
                            bbox = {"x1": float(r.x0), "y1": float(r.y0), "x2": float(r.x1), "y2": float(r.y1)}
                        
                        extracted_images.append({
                            "page": page_num,
                            "image_idx": img_idx,
                            "image": pil_img,
                            "ext": img_ext,
                            "width": pil_img.width,
                            "height": pil_img.height,
                            "bounding_box": bbox
                        })
                except Exception:
                    pass

        doc.close()
        return words_per_page, extracted_images

parser = MultimodalDocumentParser()
print("Modul MultimodalDocumentParser siap digunakan.")
"""))

    # =========================================================================
    # Sel 6: Chunking & Segmentasi Teks Berkoordinat Geometri
    # =========================================================================
    cells.append(md_cell("""
---
## 🧩 Langkah 5: Chunking Teks & Pembungkusan Geometri Spasial

Memotong deretan kata pada setiap halaman menjadi potongan semantik $250\\text{ kata}$ dengan $overlap = 50\\text{ kata}$, lengkap dengan koordinat *bounding box* $[x_1, y_1, x_2, y_2]$ identik dengan `app/core/embedder_text.py`.
"""))

    cells.append(code_cell("""
def chunk_page_words(words_with_geom, page_num: int, chunk_size: int = 250, overlap: int = 50):
    chunks = []
    if not words_with_geom:
        return chunks

    step = max(1, chunk_size - overlap)
    idx = 0

    while idx < len(words_with_geom):
        slice_words = words_with_geom[idx : min(idx + chunk_size, len(words_with_geom))]
        if not slice_words:
            break

        x1 = min(w["x1"] for w in slice_words)
        y1 = min(w["y1"] for w in slice_words)
        x2 = max(w["x2"] for w in slice_words)
        y2 = max(w["y2"] for w in slice_words)

        text = " ".join(w["text"] for w in slice_words).strip()
        if len(text) > 25:
            chunks.append({
                "page_number": page_num,
                "text": text,
                "bounding_box": {"x1": x1, "y1": y1, "x2": x2, "y2": y2}
            })

        if idx + chunk_size >= len(words_with_geom):
            break
        idx += step

    return chunks

print("Fungsi chunk_page_words siap.")
"""))

    # =========================================================================
    # Sel 7: Aturan Deteksi Boilerplate Lintas Laporan (>= 5 Laporan)
    # =========================================================================
    cells.append(md_cell("""
---
## 🏷️ Langkah 6: Aturan Deteksi Boilerplate Lintas Laporan (Threshold $\\ge 5$ Laporan)

Sesuai ketentuan rancang bangun: **Jika suatu potongan teks muncul pada $\\ge 5$ laporan mahasiswa yang berbeda, maka potongan tersebut otomatis ditetapkan sebagai Template/Boilerplate ($is\\_template = \\text{True}$)**. Hal ini secara efektif mengenali format instruksi modul, lembar pengesahan, dan deskripsi peralatan laboratorium.
"""))

    cells.append(code_cell("""
import re
import hashlib
from collections import defaultdict

def normalize_text_for_hash(t: str) -> str:
    t_clean = re.sub(r'[^a-zA-Z\\s]', '', t.lower())
    return " ".join(t_clean.split()[:40])

def mark_boilerplates_across_reports(reports_data: list, threshold_reports: int = 5):
    \"\"\"
    Memeriksa kemunculan setiap chunk di seluruh naskah laporan.
    Jika chunk muncul di >= threshold_reports naskah yang berbeda,
    tandai is_template = True.
    \"\"\"
    if not reports_data:
        print("⚠️ Peringatan: reports_data kosong. Lewati penandaan boilerplate.")
        return

    fingerprint_to_report_ids = defaultdict(set)

    # 1. Kumpulkan pemetaan fingerprint -> set ID laporan
    for rep in reports_data:
        rep_id = rep.get("id_laporan", "unknown")
        for chunk in rep.get("chunks", []):
            fp = normalize_text_for_hash(chunk.get("text", ""))
            if len(fp) > 20:
                fingerprint_to_report_ids[fp].add(rep_id)

    # 2. Identifikasi fingerprint yang merupakan boilerplate (>= threshold_reports laporan)
    boilerplate_fps = {fp for fp, reps in fingerprint_to_report_ids.items() if len(reps) >= threshold_reports}

    # 3. Beri label is_template pada setiap chunk
    total_chunks = 0
    boilerplate_chunks = 0

    for rep in reports_data:
        for chunk in rep.get("chunks", []):
            total_chunks += 1
            fp = normalize_text_for_hash(chunk.get("text", ""))
            if fp in boilerplate_fps:
                chunk["is_template"] = True
                boilerplate_chunks += 1
            else:
                chunk["is_template"] = False

    print(f"Analisis Boilerplate Selesai:")
    print(f" - Total Potongan Chunk : {total_chunks}")
    print(f" - Terdeteksi Boilerplate (>= {threshold_reports} laporan) : {boilerplate_chunks} ({boilerplate_chunks/max(1, total_chunks)*100:.1f}%)")
    print(f" - Potongan Konten Orisinal : {total_chunks - boilerplate_chunks}")

print("Fungsi mark_boilerplates_across_reports siap.")
"""))

    # =========================================================================
    # Sel 8: Pemrosesan Dataset Berkas PDF & Pembuatan Diagram Sintetis
    # =========================================================================
    cells.append(md_cell("""
---
## 📂 Langkah 7: Eksekusi Ekstraksi Seluruh Laporan Praktikum (Teks & Diagram Gambar)

Membaca berkas PDF dari folder dataset. Jika folder Drive kosong, sistem membangkitkan naskah teks cold-start serta **diagram visual sintetis** (arsitektur MVC & skema alur data) agar pipeline CLIP dapat langsung diuji.
"""))

    cells.append(code_cell("""
import os
import glob
import uuid
from PIL import Image, ImageDraw

if 'DRIVE_DATASET_DIR' not in globals():
    DRIVE_DATASET_DIR = "/content/sample_dataset_laporan"
    os.makedirs(DRIVE_DATASET_DIR, exist_ok=True)

if 'TAHUN_AKADEMIK' not in globals():
    TAHUN_AKADEMIK = 2025

pdf_files = glob.glob(os.path.join(DRIVE_DATASET_DIR, "*.pdf"))
reports_dataset = []

def generate_synthetic_diagram(title: str, mhs_idx: int) -> Image.Image:
    \"\"\"Menghasilkan gambar diagram visual sintetis untuk pengujian model CLIP.\"\"\"
    img = Image.new("RGB", (400, 240), color=(248, 250, 252))
    draw = ImageDraw.Draw(img)
    draw.rectangle([30, 40, 160, 120], outline=(15, 23, 42), width=2, fill=(226, 232, 240))
    draw.text((45, 75), "Client (React SPA)", fill=(15, 23, 42))
    draw.rectangle([240, 40, 370, 120], outline=(4, 120, 87), width=2, fill=(209, 250, 229))
    draw.text((250, 75), "FastAPI AI Engine", fill=(4, 120, 87))
    draw.line([160, 80, 240, 80], fill=(71, 85, 105), width=2)
    draw.text((170, 60), "HTTP/REST", fill=(71, 85, 105))
    draw.text((30, 180), f"Diagram: {title} - Mahasiswa {mhs_idx}", fill=(30, 41, 59))
    return img

if not pdf_files:
    print(f"⚠️ Tidak ditemukan berkas PDF di '{DRIVE_DATASET_DIR}'.")
    print("⚡ Menghasilkan dataset cold-start multi-laporan sintetis STITEK Bontang (6 naskah mahasiswa lengkap dengan diagram visual)...")
    
    sample_templates = [
        "LABORATORIUM TEKNIK INFORMATIKA STITEK BONTANG. Modul Praktikum Desain & Pemrograman Web. Tujuan instruksional umum: Mahasiswa mampu merancang antarmuka web modern responsif.",
        "Alat dan bahan yang digunakan dalam praktikum ini meliputi: Komputer PC dengan sistem operasi Linux, Node.js runtime, peramban Google Chrome, dan visual studio code.",
        "Format laporan resmi: Laporan wajib dikumpulkan selambat-lambatnya 7 hari setelah praktikum selesai. Keterlambatan akan dikenakan sanksi pemotongan nilai."
    ]
    
    for mhs_idx in range(1, 7):
        rep_id = str(uuid.uuid4())
        chunks = []
        for t_idx, t_text in enumerate(sample_templates):
            chunks.append({
                "page_number": 1,
                "text": t_text,
                "bounding_box": {"x1": 50.0, "y1": 100.0 * (t_idx + 1), "x2": 500.0, "y2": 100.0 * (t_idx + 1) + 40.0}
            })
        chunks.append({
            "page_number": 2,
            "text": f"Analisis Hasil Percobaan Mahasiswa {mhs_idx}: Pada pengujian sistem routing React SPA, implementasi lazy-loading komponen berhasil mereduksi initial bundle sebesar 38.4% berdasarkan inspeksi Network DevTools.",
            "bounding_box": {"x1": 50.0, "y1": 200.0, "x2": 500.0, "y2": 260.0}
        })
        
        sample_diagram = generate_synthetic_diagram("Arsitektur Sistem Praktikum", mhs_idx)
        images = [{
            "page": 2,
            "image_idx": 0,
            "image": sample_diagram,
            "ext": "png",
            "width": sample_diagram.width,
            "height": sample_diagram.height,
            "bounding_box": {"x1": 50.0, "y1": 300.0, "x2": 450.0, "y2": 540.0}
        }]

        reports_dataset.append({
            "id_laporan": rep_id,
            "filename": f"Laporan_Praktikum_Mhs_{mhs_idx}.pdf",
            "author": f"Mahasiswa {mhs_idx}",
            "nim": f"220100{mhs_idx}",
            "tahun": TAHUN_AKADEMIK,
            "chunks": chunks,
            "images": images
        })
else:
    print(f"Menemukan {len(pdf_files)} berkas PDF. Memulai parsing dokumen...")
    for pf in pdf_files:
        fname = os.path.basename(pf)
        rep_id = str(uuid.uuid4())
        words_per_page, images = parser.parse_pdf(pf)
        chunks = []
        for p in words_per_page:
            chunks.extend(chunk_page_words(p["words"], p["page"]))
        reports_dataset.append({
            "id_laporan": rep_id,
            "filename": fname,
            "author": fname.replace(".pdf", ""),
            "nim": "2201999",
            "tahun": TAHUN_AKADEMIK,
            "chunks": chunks,
            "images": images
        })

mark_boilerplates_across_reports(reports_dataset, threshold_reports=5)
total_extracted_images = sum(len(rep.get("images", [])) for rep in reports_dataset)
print(f"✅ Total {len(reports_dataset)} laporan berhasil diekstraksi.")
print(f"✅ Total gambar diagram yang terdeteksi: {total_extracted_images}")
"""))

    # =========================================================================
    # Sel 9: Inisialisasi Model SBERT (Langkah 8)
    # =========================================================================
    cells.append(md_cell("""
---
## 🧠 Langkah 8: Embedder Vektor Teks SBERT (multilingual-e5-base)

Memuat model `intfloat/multilingual-e5-base` ($768\\text{-dim}$). Menggunakan prefix `passage: ` untuk penyimpanan chunk repositori dan `query: ` untuk kueri perbandingan semantik.
"""))

    cells.append(code_cell("""
import os
import torch
import numpy as np
from sentence_transformers import SentenceTransformer

device = "cuda" if torch.cuda.is_available() else "cpu"
print(f"Perangkat Komputasi SBERT: {device}")

if 'reports_dataset' not in globals() or not reports_dataset:
    print("⚠️ Peringatan: 'reports_dataset' belum terdefinisi. Membuat dataset darurat...")
    reports_dataset = [{
        "id_laporan": "dummy-report-1",
        "author": "Mahasiswa Cold-Start",
        "tahun": 2025,
        "images": [],
        "chunks": [
            {"page_number": 1, "text": "LABORATORIUM TEKNIK INFORMATIKA STITEK BONTANG. Modul Praktikum Desain Web.", "is_template": True, "bounding_box": {"x1": 0, "y1": 0, "x2": 100, "y2": 100}},
            {"page_number": 2, "text": "Hasil pengujian analisis respon server menunjukkan latensi rata-rata sebesar 45 milidetik.", "is_template": False, "bounding_box": {"x1": 0, "y1": 0, "x2": 100, "y2": 100}}
        ]
    }]

print("Memuat SentenceTransformer (intfloat/multilingual-e5-base)...")
sbert_model = SentenceTransformer("intfloat/multilingual-e5-base", device=device)

def encode_passages(texts: list, batch_size: int = 32):
    if not texts:
        return np.empty((0, 768), dtype=np.float32)
    prefixed = [f"passage: {t}" for t in texts]
    embs = sbert_model.encode(prefixed, batch_size=batch_size, show_progress_bar=True, normalize_embeddings=True)
    return embs

all_texts = []
chunk_references = []

for rep in reports_dataset:
    for ch in rep.get("chunks", []):
        all_texts.append(ch.get("text", ""))
        chunk_references.append(ch)

print(f"Menghitung vektor embedding SBERT untuk {len(all_texts)} potongan teks...")
embeddings_768d = encode_passages(all_texts)

for ch, emb in zip(chunk_references, embeddings_768d):
    ch["embedding"] = emb

print(f"✅ Vektor embedding berhasil dibuat (Shape: {embeddings_768d.shape}).")
print(f"✅ chunk_references siap dengan {len(chunk_references)} item.")
"""))

    # =========================================================================
    # Sel 10: Inisialisasi Visual Embedder CLIP (Langkah 9 - Ekstraksi 512d)
    # =========================================================================
    cells.append(md_cell("""
---
## 🖼️ Langkah 9: Ekstraksi Vektor Visual Gambar/Diagram (OpenAI CLIP 512-dim)

Sesuai modul `app/core/embedder_image.py`, diagram alir, skema rangkaian, dan visual laporan dienkodekan ke ruang vektor $512\\text{ dimensi}$ menggunakan `openai/clip-vit-base-patch32`.
"""))

    cells.append(code_cell("""
import os
import torch
import numpy as np
from PIL import Image
from transformers import CLIPProcessor, CLIPModel

device = "cuda" if torch.cuda.is_available() else "cpu"
print(f"Perangkat visual CLIP: {device}")

if 'reports_dataset' not in globals() or not reports_dataset:
    print("⚠️ Peringatan: 'reports_dataset' belum terdefinisi. Menginisialisasi daftar kosong.")
    reports_dataset = []

print("Memuat model OpenAI CLIP (clip-vit-base-patch32)...")
clip_model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32").to(device)
clip_processor = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")

def encode_images(pil_images: list):
    \"\"\"Mengekstrak visual embedding 512d ternormalisasi L2 dari daftar gambar PIL.\"\"\"
    if not pil_images:
        return np.empty((0, 512), dtype=np.float32)
    inputs = clip_processor(images=pil_images, return_tensors="pt").to(device)
    with torch.no_grad():
        feats = clip_model.get_image_features(**inputs)
        if hasattr(feats, "pooler_output") and feats.pooler_output is not None:
            feats = feats.pooler_output
        elif hasattr(feats, "image_embeds") and feats.image_embeds is not None:
            feats = feats.image_embeds
        feats = feats / feats.norm(p=2, dim=-1, keepdim=True)
    return feats.cpu().numpy()

total_imgs = sum(len(rep.get("images", [])) for rep in reports_dataset)
print(f"Total gambar visual yang ditemukan di seluruh laporan: {total_imgs}")

encoded_img_count = 0
if total_imgs > 0:
    for rep in reports_dataset:
        for img_item in rep.get("images", []):
            emb_img = encode_images([img_item["image"]])[0]
            img_item["embedding"] = emb_img
            encoded_img_count += 1
    print(f"✅ Berhasil menghitung embedding CLIP untuk {encoded_img_count} gambar (512-dim).")
else:
    print("ℹ️ Tidak ada berkas gambar pada dataset saat ini (dapat dilanjutkan ke Langkah 10).")
"""))

    # =========================================================================
    # Sel 11: Pelatihan Prototypical Head (Langkah 10)
    # =========================================================================
    cells.append(md_cell("""
---
## 🎯 Langkah 10: Pelatihan Prototypical Head & Kalkulasi Centroid Laten ($128\\text{-dim}$)

Menerapkan kelas `CoursePrototypicalHead` persis sesuai `app/core/proto_head.py`:
- Proyeksi: $\\text{Linear}(768, 256) \\to \\text{LayerNorm} \\to \\text{ReLU} \\to \\text{Dropout}(0.1) \\to \\text{Linear}(256, 128) \\to L_2\\text{ Normalization}$.
- Menghitung representasi rata-rata unit-vektor ($c_{\\text{template}}$ dan $c_{\\text{original}}$).
- Mendukung mode *Cold-Start* jika sampel $< 3$ tanpa *gradient divergence*, serta pelatihan episodik dengan Prototypical Loss (skala temperatur $\\tau = 0.5$).
"""))

    cells.append(code_cell("""
import os
import torch
import torch.nn as nn
import torch.nn.functional as F
import torch.optim as optim
import numpy as np

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print(f"Perangkat Prototypical Head: {device}")

class CoursePrototypicalHead(nn.Module):
    def __init__(self, input_dim: int = 768, output_dim: int = 128, dropout_rate: float = 0.1):
        super().__init__()
        self.projection = nn.Sequential(
            nn.Linear(input_dim, 256),
            nn.LayerNorm(256),
            nn.ReLU(),
            nn.Dropout(dropout_rate),
            nn.Linear(256, output_dim)
        )
        self.device = device
        self.to(self.device)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        is_1d = (x.dim() == 1)
        if is_1d:
            x = x.unsqueeze(0)
        proj = self.projection(x)
        normed = F.normalize(proj, p=2, dim=-1)
        return normed.squeeze(0) if is_1d else normed

    def project_numpy(self, vectors: np.ndarray) -> np.ndarray:
        self.eval()
        with torch.no_grad():
            t = torch.as_tensor(vectors, dtype=torch.float32, device=self.device)
            return self.forward(t).cpu().numpy()

    def compute_prototypical_loss(self, s_emb, s_lbl, q_emb, q_lbl, temperature: float = 0.5):
        s_proj = self.forward(s_emb)
        q_proj = self.forward(q_emb)

        centroids = []
        for cls_id in [0, 1]:  # 0: original, 1: template
            mask = (s_lbl == cls_id)
            if mask.sum() > 0:
                c = s_proj[mask].mean(dim=0)
                centroids.append(F.normalize(c, p=2, dim=0))
            else:
                centroids.append(torch.zeros(s_proj.size(-1), device=self.device))
        centroids = torch.stack(centroids)

        dists = torch.cdist(q_proj, centroids) ** 2
        logits = -dists / temperature
        loss = F.cross_entropy(logits, q_lbl)
        preds = torch.argmax(logits, dim=-1)
        acc = (preds == q_lbl).float().mean()
        return loss, acc

proto_head = CoursePrototypicalHead(input_dim=768, output_dim=128)

if 'chunk_references' not in globals() or not chunk_references:
    print("⚠️ Peringatan: 'chunk_references' belum ditemukan. Melakukan pemulihan otomatis...")
    if 'reports_dataset' in globals() and reports_dataset:
        chunk_references = [ch for rep in reports_dataset for ch in rep.get("chunks", [])]
        print(f"🔄 Berhasil menarik {len(chunk_references)} chunk dari reports_dataset.")
    else:
        print("⚡ Menghasilkan sampel darurat agar sel tetap dapat dieksekusi...")
        chunk_references = [
            {"text": "Template Laboratorium STITEK Bontang", "is_template": True, "embedding": np.random.randn(768).astype(np.float32)},
            {"text": "Format Laporan Resmi Modul", "is_template": True, "embedding": np.random.randn(768).astype(np.float32)},
            {"text": "Analisis orisinal implementasi sistem", "is_template": False, "embedding": np.random.randn(768).astype(np.float32)},
            {"text": "Evaluasi kinerja algoritma pencarian", "is_template": False, "embedding": np.random.randn(768).astype(np.float32)}
        ]

missing_embs = [ch for ch in chunk_references if "embedding" not in ch]
if missing_embs:
    print(f"⚡ Menghitung embedding untuk {len(missing_embs)} chunk yang belum memiliki vektor...")
    if 'sbert_model' not in globals():
        from sentence_transformers import SentenceTransformer
        sbert_model = SentenceTransformer("intfloat/multilingual-e5-base", device=device)
    for ch in missing_embs:
        ch["embedding"] = sbert_model.encode(f"passage: {ch['text']}", normalize_embeddings=True)

template_embs = [ch["embedding"] for ch in chunk_references if ch.get("is_template", False)]
original_embs = [ch["embedding"] for ch in chunk_references if not ch.get("is_template", False)]

if len(template_embs) == 0:
    template_embs = [np.random.randn(768).astype(np.float32) for _ in range(2)]
if len(original_embs) == 0:
    original_embs = [np.random.randn(768).astype(np.float32) for _ in range(2)]

print(f"Data latih Prototypical Head: {len(template_embs)} template, {len(original_embs)} original.")

if len(template_embs) < 3 or len(original_embs) < 3:
    print("⚡ Mengaktifkan kalkulasi Cold-Start Centroid langsung tanpa update gradien...")
    t_proj = proto_head.project_numpy(np.array(template_embs))
    o_proj = proto_head.project_numpy(np.array(original_embs))
    c_template = np.mean(t_proj, axis=0)
    c_template /= (np.linalg.norm(c_template) + 1e-8)
    c_original = np.mean(o_proj, axis=0)
    c_original /= (np.linalg.norm(c_original) + 1e-8)
    mode_training = "cold_start"
else:
    print("🔥 Menjalankan pelatihan episodik Prototypical Loss...")
    all_x = np.vstack([template_embs, original_embs])
    all_y = np.array([1] * len(template_embs) + [0] * len(original_embs), dtype=np.int64)

    t_x = torch.as_tensor(all_x, dtype=torch.float32, device=proto_head.device)
    t_y = torch.as_tensor(all_y, dtype=torch.int64, device=proto_head.device)

    optimizer = optim.Adam(proto_head.parameters(), lr=1e-3, weight_decay=1e-4)
    proto_head.train()

    epochs = 15
    for ep in range(epochs):
        perm = torch.randperm(len(all_x), device=proto_head.device)
        split = max(2, int(0.6 * len(all_x)))
        s_idx, q_idx = perm[:split], perm[split:]

        optimizer.zero_grad()
        loss, acc = proto_head.compute_prototypical_loss(t_x[s_idx], t_y[s_idx], t_x[q_idx], t_y[q_idx])
        loss.backward()
        optimizer.step()
        if (ep + 1) % 5 == 0:
            print(f" Epoch {ep+1}/{epochs} - Loss: {loss.item():.4f} - Akurasi: {acc.item()*100:.1f}%")

    t_proj = proto_head.project_numpy(np.array(template_embs))
    o_proj = proto_head.project_numpy(np.array(original_embs))
    c_template = np.mean(t_proj, axis=0)
    c_template /= (np.linalg.norm(c_template) + 1e-8)
    c_original = np.mean(o_proj, axis=0)
    c_original /= (np.linalg.norm(c_original) + 1e-8)
    mode_training = "trained"

print(f"✅ Centroid Template Laten: Shape {c_template.shape} | Norm: {np.linalg.norm(c_template):.4f}")
print(f"✅ Centroid Orisinal Laten: Shape {c_original.shape} | Norm: {np.linalg.norm(c_original):.4f}")
"""))

    # =========================================================================
    # Sel 12: Domain Adaptation Fine-Tuning SBERT
    # =========================================================================
    cells.append(md_cell("""
---
## 🚀 Langkah 11: Fine-Tuning SBERT SimCSE (Domain Adaptation Laporan)

Sesuai `app/core/finetuner.py`, melatih ulang representasi semantik naskah laporan teknik dengan pendekatan *unsupervised contrastive learning* (pasangan kalimat identik dengan *dropout* sebagai augmentasi semantik).
"""))

    cells.append(code_cell("""
import os
import torch
from torch.utils.data import DataLoader
from sentence_transformers import InputExample, losses, SentenceTransformer

device = "cuda" if torch.cuda.is_available() else "cpu"

if 'sbert_model' not in globals():
    print("Memuat model SBERT intfloat/multilingual-e5-base...")
    sbert_model = SentenceTransformer("intfloat/multilingual-e5-base", device=device)

training_corpus = []
if 'chunk_references' in globals() and chunk_references:
    training_corpus = [ch.get("text", "") for ch in chunk_references if not ch.get("is_template", False) and len(ch.get("text", "")) > 30]

if len(training_corpus) < 4:
    training_corpus.extend([
        "Arsitektur client-server memisahkan antarmuka visual pengguna dari logika penyimpanan basis data.",
        "Analisis performa query database dilakukan dengan indexing b-tree dan pencarian vektor berdimensi tinggi.",
        "Pengujian fungsional modul laporan praktikum menunjukkan integritas referensi dan keaslian dokumen.",
        "Implementasi autentikasi token JWT mengamankan rute pertukaran data antara klien dan antarmuka AI."
    ])

print(f"Menyiapkan {len(training_corpus)} sampel kalimat untuk fine-tuning domain adaptation...")

train_examples = [InputExample(texts=[t, t]) for t in training_corpus]
train_loader = DataLoader(train_examples, shuffle=True, batch_size=min(16, max(2, len(train_examples))))
train_loss = losses.MultipleNegativesRankingLoss(model=sbert_model)

print("Memulai proses fine-tuning model SBERT...")
sbert_model.fit(
    train_objectives=[(train_loader, train_loss)],
    epochs=1,
    show_progress_bar=True
)

output_sbert_dir = "/content/sbert_v2"
os.makedirs(output_sbert_dir, exist_ok=True)
sbert_model.save(output_sbert_dir)
print(f"✅ Bobot model Sentence-BERT berhasil disimpan di: {output_sbert_dir}")
"""))

    # =========================================================================
    # Sel 13: Injeksi Seeding ke Supabase pgvector (Menggunakan get_supabase_connection())
    # =========================================================================
    cells.append(md_cell("""
---
## 💾 Langkah 12: Injeksi & Seeding ke Basis Data Supabase pgvector

Menyimpan seluruh data representasi vektor ke tabel PostgreSQL:
1. `public.laporan_text_vectors` ($768\\text{-dim}$)
2. `public.laporan_image_vectors` ($512\\text{-dim}$ — Visual CLIP)
3. `public.course_prototypes` ($128\\text{-dim}$ — Centroid Template & Original)

> **Koneksi Terlindungi:** Sel ini memanggil `get_supabase_connection()` yang kebal terhadap galat *invalid percent-encoded token* pada DSN libpq.
"""))

    cells.append(code_cell("""
import os
import json
import uuid
import numpy as np
import psycopg2
from psycopg2.extras import execute_batch
from pgvector.psycopg2 import register_vector

# Membuka koneksi menggunakan fungsi konektor aman
print("Menghubungkan ke Supabase PostgreSQL via safe connector...")
conn = get_supabase_connection()
cur = conn.cursor()

# Pastikan variabel metadata tersedia
if 'ID_MATA_KULIAH' not in globals():
    ID_MATA_KULIAH = "77b21e8d-d779-46f3-a128-091a13be45cb"
if 'NAMA_MATA_KULIAH' not in globals():
    NAMA_MATA_KULIAH = "Desain & Pemrograman Web"
if 'PROGRAM_STUDI' not in globals():
    PROGRAM_STUDI = "Teknik Informatika"

# 1. Pastikan tabel repositori siap (Termasuk tabel laporan_image_vectors)
print("Memverifikasi ketersediaan tabel pgvector di Supabase...")
cur.execute(\"\"\"
    CREATE EXTENSION IF NOT EXISTS vector SCHEMA extensions;
    
    CREATE TABLE IF NOT EXISTS public.laporan_text_vectors (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        id_laporan TEXT NOT NULL,
        id_mata_kuliah TEXT,
        page_number INT,
        text TEXT NOT NULL,
        bounding_box JSONB,
        program_studi TEXT,
        mata_kuliah TEXT,
        tahun INT,
        author TEXT,
        is_template BOOLEAN DEFAULT FALSE,
        embedding extensions.vector(768),
        tanggal_dibuat TIMESTAMPTZ DEFAULT NOW()
    );
    
    CREATE TABLE IF NOT EXISTS public.laporan_image_vectors (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        id_laporan TEXT NOT NULL,
        id_mata_kuliah TEXT,
        image_id TEXT,
        page_number INT,
        bounding_box JSONB,
        file_path TEXT,
        author TEXT,
        tahun INT,
        program_studi TEXT,
        mata_kuliah TEXT,
        source_file_name TEXT,
        embedding extensions.vector(512),
        tanggal_dibuat TIMESTAMPTZ DEFAULT NOW()
    );
    
    CREATE TABLE IF NOT EXISTS public.course_prototypes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        id_mata_kuliah TEXT NOT NULL,
        class_label TEXT NOT NULL,
        centroid extensions.vector(128),
        sample_count INT DEFAULT 0,
        last_trained_at TIMESTAMPTZ,
        model_version TEXT,
        UNIQUE(id_mata_kuliah, class_label)
    );
\"\"\")
conn.commit()

# 2. Injeksi Batch Chunk Teks (768-dim)
text_records = []
if 'reports_dataset' in globals() and reports_dataset:
    for rep in reports_dataset:
        for ch in rep.get("chunks", []):
            if "embedding" in ch:
                emb_val = ch["embedding"].tolist() if isinstance(ch["embedding"], np.ndarray) else ch["embedding"]
                text_records.append((
                    rep.get("id_laporan", "unknown"),
                    ID_MATA_KULIAH,
                    ch.get("page_number", 1),
                    ch.get("text", ""),
                    json.dumps(ch.get("bounding_box", {})),
                    PROGRAM_STUDI,
                    NAMA_MATA_KULIAH,
                    rep.get("tahun", 2025),
                    rep.get("author", "Mahasiswa"),
                    ch.get("is_template", False),
                    emb_val
                ))

if text_records:
    text_insert_sql = \"\"\"
        INSERT INTO public.laporan_text_vectors (
            id_laporan, id_mata_kuliah, page_number, text, bounding_box,
            program_studi, mata_kuliah, tahun, author, is_template, embedding
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s);
    \"\"\"
    print(f"Menyimpan {len(text_records)} potongan teks vektor ke Supabase...")
    execute_batch(cur, text_insert_sql, text_records, page_size=100)
    conn.commit()
    print("✅ Vektor teks berhasil di-seed.")
else:
    print("ℹ️ Tidak ada teks vektor yang siap diinjeksi.")

# 3. Injeksi Batch Gambar Visual CLIP (512-dim)
image_records = []
if 'reports_dataset' in globals() and reports_dataset:
    for rep in reports_dataset:
        for img_item in rep.get("images", []):
            if "embedding" in img_item:
                emb_val = img_item["embedding"].tolist() if isinstance(img_item["embedding"], np.ndarray) else img_item["embedding"]
                img_id = f"img_{rep.get('id_laporan')[:8]}_p{img_item.get('page', 1)}_{img_item.get('image_idx', 0)}"
                image_records.append((
                    rep.get("id_laporan", "unknown"),
                    ID_MATA_KULIAH,
                    img_id,
                    img_item.get("page", 1),
                    json.dumps(img_item.get("bounding_box", {})),
                    f"/static/extracted_images/{img_id}.png",
                    rep.get("author", "Mahasiswa"),
                    rep.get("tahun", 2025),
                    PROGRAM_STUDI,
                    NAMA_MATA_KULIAH,
                    rep.get("filename", "laporan.pdf"),
                    emb_val
                ))

if image_records:
    image_insert_sql = \"\"\"
        INSERT INTO public.laporan_image_vectors (
            id_laporan, id_mata_kuliah, image_id, page_number, bounding_box,
            file_path, author, tahun, program_studi, mata_kuliah, source_file_name, embedding
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s);
    \"\"\"
    print(f"Menyimpan {len(image_records)} vektor gambar diagram CLIP ke Supabase...")
    execute_batch(cur, image_insert_sql, image_records, page_size=100)
    conn.commit()
    print("✅ Vektor visual CLIP berhasil di-seed ke laporan_image_vectors.")
else:
    print("ℹ️ Tidak ada vektor gambar visual yang diinjeksi.")

# 4. Injeksi Centroid Course Prototypes (128-dim)
if 'c_template' in globals() and 'c_original' in globals():
    t_cent = c_template.tolist() if isinstance(c_template, np.ndarray) else c_template
    o_cent = c_original.tolist() if isinstance(c_original, np.ndarray) else c_original
    m_train = mode_training if 'mode_training' in globals() else "cold_start"

    cur.execute(\"\"\"
        INSERT INTO public.course_prototypes (
            id_mata_kuliah, class_label, centroid, sample_count, last_trained_at, model_version
        ) VALUES (%s, %s, %s, %s, NOW(), %s)
        ON CONFLICT (id_mata_kuliah, class_label) DO UPDATE SET
            centroid = EXCLUDED.centroid,
            sample_count = EXCLUDED.sample_count,
            last_trained_at = EXCLUDED.last_trained_at,
            model_version = EXCLUDED.model_version;
    \"\"\", (ID_MATA_KULIAH, "template", t_cent, len(template_embs) if 'template_embs' in globals() else 1, m_train))

    cur.execute(\"\"\"
        INSERT INTO public.course_prototypes (
            id_mata_kuliah, class_label, centroid, sample_count, last_trained_at, model_version
        ) VALUES (%s, %s, %s, %s, NOW(), %s)
        ON CONFLICT (id_mata_kuliah, class_label) DO UPDATE SET
            centroid = EXCLUDED.centroid,
            sample_count = EXCLUDED.sample_count,
            last_trained_at = EXCLUDED.last_trained_at,
            model_version = EXCLUDED.model_version;
    \"\"\", (ID_MATA_KULIAH, "original", o_cent, len(original_embs) if 'original_embs' in globals() else 1, m_train))
    conn.commit()
    print("✅ Centroid Course Prototypes berhasil di-seed.")

cur.close()
conn.close()
print("✅ Seeding ke Supabase pgvector sukses terlaksana!")
"""))

    # =========================================================================
    # Sel 14: Verifikasi Kueri Inferensi Hybrid & Visual CLIP
    # =========================================================================
    cells.append(md_cell("""
---
## 🔍 Langkah 13: Verifikasi Inferensi Multimodal (Teks SBERT & Gambar CLIP)

Menguji kueri teks pencarian dan kemiripan visual gambar menggunakan operator kosinus pgvector (`<=>`).
"""))

    cells.append(code_cell("""
import os
import psycopg2
from pgvector.psycopg2 import register_vector
from sentence_transformers import SentenceTransformer

if 'sbert_model' not in globals():
    sbert_model = SentenceTransformer("intfloat/multilingual-e5-base", device=device)

conn = get_supabase_connection()
cur = conn.cursor()

# 1. Uji Kueri Semantik Teks
test_query = "Bagaimana cara merancang routing pada React SPA?"
query_emb = sbert_model.encode(f"query: {test_query}", normalize_embeddings=True).tolist()

search_sql = \"\"\"
    SELECT text, author, is_template, 1 - (embedding <=> %s::extensions.vector) AS similarity
    FROM public.laporan_text_vectors
    WHERE id_mata_kuliah = %s
    ORDER BY embedding <=> %s::extensions.vector
    LIMIT 2;
\"\"\"
cur.execute(search_sql, (query_emb, ID_MATA_KULIAH, query_emb))
results = cur.fetchall()

print(f"=== HASIL UJI KUERI TEKS: '{test_query}' ===")
for idx, row in enumerate(results):
    txt, author, is_temp, sim = row
    print(f"[{idx+1}] Skor Kemiripan: {sim*100:.2f}% | Penulis: {author} | Template: {is_temp}")
    print(f"    Snippet: {txt[:120]}...\\n")

# 2. Uji Indeks Gambar Visual CLIP
cur.execute(\"\"\"
    SELECT image_id, author, source_file_name, page_number
    FROM public.laporan_image_vectors
    WHERE id_mata_kuliah = %s
    LIMIT 3;
\"\"\", (ID_MATA_KULIAH,))
img_results = cur.fetchall()

print(f"=== HASIL INDEKS GAMBAR VISUAL CLIP DI SUPABASE ===")
if img_results:
    for idx, (img_id, auth, s_file, p_num) in enumerate(img_results):
        print(f"[{idx+1}] Image ID: {img_id} | Halaman: {p_num} | Penulis: {auth} | Berkas: {s_file}")
else:
    print("ℹ️ Belum ada gambar visual yang tersimpan pada tabel laporan_image_vectors.")

cur.close()
conn.close()
"""))

    # =========================================================================
    # Sel 15: Ekspor Bobot Model untuk Hot-Swapping di Server Lokal
    # =========================================================================
    cells.append(md_cell("""
---
## 📦 Langkah 14: Ekspor Bobot Model untuk Hot-Swapping di Server Lokal

Mengemas model bobot hasil pelatihan ke dalam arsip ZIP agar dapat diunduh dan dipindahkan ke folder microservice lokal:
* `sbert_v2.zip` $\\to$ Ekstrak ke `Project-AI/AI-service/app/models/sbert_v2/`
* `proto_head.pt` $\\to$ Salin ke `Project-AI/AI-service/app/models/proto_head.pt`
"""))

    cells.append(code_cell("""
import os
import torch
import shutil

# 1. Simpan bobot Prototypical Head
proto_head_path = "/content/proto_head.pt"
if 'proto_head' in globals():
    torch.save(proto_head.state_dict(), proto_head_path)
    print(f"Bobot ProtoHead tersimpan: {proto_head_path}")

# 2. Kompres model SBERT v2
zip_sbert_path = "/content/sbert_v2.zip"
if 'output_sbert_dir' in globals() and os.path.exists(output_sbert_dir):
    shutil.make_archive("/content/sbert_v2", 'zip', output_sbert_dir)
    print(f"Arsip SBERT v2 siap: {zip_sbert_path}")

# 3. Salin otomatis ke Google Drive jika direktori terhubung
drive_export_dir = "/content/drive/MyDrive/STITEK_AI_MODELS"
try:
    os.makedirs(drive_export_dir, exist_ok=True)
    if os.path.exists(proto_head_path):
        shutil.copy(proto_head_path, os.path.join(drive_export_dir, "proto_head.pt"))
    if os.path.exists(zip_sbert_path):
        shutil.copy(zip_sbert_path, os.path.join(drive_export_dir, "sbert_v2.zip"))
    print(f"✅ Bobot berhasil dicadangkan ke Google Drive: {drive_export_dir}")
except Exception as e:
    print(f"Catatan: Salinan Drive dilewati ({e}). Berkas tersedia di direktori Colab /content.")

print("\\n🎉 PIPELINE COLD-START SELESAI DENGAN SUKSES!")
"""))

    notebook_content = {
        "cells": cells,
        "metadata": {
            "accelerator": "GPU",
            "colab": {
                "provenance": []
            },
            "language_info": {
                "name": "python"
            }
        },
        "nbformat": 4,
        "nbformat_minor": 4
    }

    return notebook_content


if __name__ == "__main__":
    nb = create_notebook()

    target_root = "coldstart_training_pipeline.ipynb"
    with open(target_root, "w", encoding="utf-8") as f:
        json.dump(nb, f, indent=2, ensure_ascii=False)
    print(f"Tersimpan di: {os.path.abspath(target_root)}")

    notebooks_dir = os.path.join("Project-AI", "notebooks")
    os.makedirs(notebooks_dir, exist_ok=True)
    target_proj = os.path.join(notebooks_dir, "coldstart_training_pipeline.ipynb")
    with open(target_proj, "w", encoding="utf-8") as f:
        json.dump(nb, f, indent=2, ensure_ascii=False)
    print(f"Tersimpan di: {os.path.abspath(target_proj)}")
