import httpx
import logging
import json
from typing import Optional, Dict, Any
from app.config import settings, decrypt_aes_gcm
from app.db.supabase_client import vector_db

logger = logging.getLogger("AI-Service.Chatbot")

def get_active_credentials() -> Dict[str, str]:
    """
    Mengambil dan mendekripsi kredensial API LLM aktif dari database konfigurasi_sistem,
    dengan fallback ke variabel lingkungan (settings).
    """
    creds = {
        "model": settings.OLLAMA_MODEL,
        "groq_key": settings.KUNCI_API_GROQ,
        "gemini_key": settings.KUNCI_API_GEMINI,
        "openai_key": settings.KUNCI_API_OPENAI,
        "system_prompt": ""
    }
    
    try:
        query = """
            SELECT nama_model_ai, kunci_api_groq, kunci_api_gemini, kunci_api_openai, prompt_sistem 
            FROM public.konfigurasi_sistem 
            WHERE id_konfigurasi = 'global' 
            LIMIT 1;
        """
        rows = vector_db.execute_query(query)
        if rows and len(rows) > 0:
            db_row = rows[0]
            if db_row.get("nama_model_ai"):
                creds["model"] = db_row["nama_model_ai"]
            if db_row.get("prompt_sistem"):
                creds["system_prompt"] = db_row["prompt_sistem"]
                
            # Dekripsi jika terenkripsi
            if db_row.get("kunci_api_groq"):
                decrypted = decrypt_aes_gcm(db_row["kunci_api_groq"], settings.JWT_SECRET)
                if decrypted:
                    creds["groq_key"] = decrypted
            if db_row.get("kunci_api_gemini"):
                decrypted = decrypt_aes_gcm(db_row["kunci_api_gemini"], settings.JWT_SECRET)
                if decrypted:
                    creds["gemini_key"] = decrypted
            if db_row.get("kunci_api_openai"):
                decrypted = decrypt_aes_gcm(db_row["kunci_api_openai"], settings.JWT_SECRET)
                if decrypted:
                    creds["openai_key"] = decrypted
    except Exception as e:
        logger.warning(f"Tidak dapat memuat konfigurasi dari database: {e}. Menggunakan konfigurasi default.")
        
    return creds


def build_admin_context() -> Dict[str, Any]:
    """
    Mengumpulkan data operasional menyeluruh untuk aktor ADMIN (PRD §2.A).
    """
    context = {}
    try:
        # 1. Ringkasan umum laporan
        summary_query = """
            SELECT 
                COUNT(*) as total_laporan,
                ROUND(AVG(skor_orisinalitas)::numeric, 2) as rata_orisinalitas,
                SUM(CASE WHEN skor_orisinalitas < 70 THEN 1 ELSE 0 END) as indikasi_plagiat,
                SUM(CASE WHEN apakah_diverifikasi IS FALSE THEN 1 ELSE 0 END) as antrean_verifikasi
            FROM public.laporan;
        """
        summary = vector_db.execute_query(summary_query)
        if summary:
            context["ringkasan_laporan"] = summary[0]

        # 2. Rekapitulasi orisinalitas per program studi
        prodi_query = """
            SELECT 
                ps.nama_prodi,
                COUNT(l.id_laporan) as total_laporan,
                ROUND(AVG(l.skor_orisinalitas)::numeric, 2) as rata_rata_orisinalitas,
                SUM(CASE WHEN l.skor_orisinalitas < 70 THEN 1 ELSE 0 END) as kasus_kemiripan_tinggi
            FROM public.laporan l
            JOIN public.program_studi ps ON l.id_program_studi = ps.id_program_studi
            GROUP BY ps.nama_prodi;
        """
        prodi_stats = vector_db.execute_query(prodi_query)
        context["statistik_prodi"] = prodi_stats or []

        # 3. Mata kuliah dengan tingkat kemiripan tertinggi / orisinalitas terendah
        matkul_query = """
            SELECT 
                mk.nama_matkul,
                COUNT(l.id_laporan) as total_laporan,
                ROUND(AVG(l.skor_orisinalitas)::numeric, 2) as rata_rata_orisinalitas
            FROM public.laporan l
            JOIN public.mata_kuliah mk ON l.id_mata_kuliah = mk.id_mata_kuliah
            GROUP BY mk.nama_matkul
            ORDER BY rata_rata_orisinalitas ASC
            LIMIT 5;
        """
        matkul_stats = vector_db.execute_query(matkul_query)
        context["matkul_perhatian_khusus"] = matkul_stats or []

        # 4. Laporan yang memerlukan evaluasi khusus (kemiripan tinggi / orisinalitas rendah)
        kritis_query = """
            SELECT 
                l.id_laporan,
                l.nama_mahasiswa,
                l.nim,
                l.skor_orisinalitas,
                l.skor_plagiarisme,
                ps.nama_prodi,
                mk.nama_matkul
            FROM public.laporan l
            LEFT JOIN public.program_studi ps ON l.id_program_studi = ps.id_program_studi
            LEFT JOIN public.mata_kuliah mk ON l.id_mata_kuliah = mk.id_mata_kuliah
            WHERE l.skor_orisinalitas < 70 OR l.skor_plagiarisme > 30
            ORDER BY l.skor_orisinalitas ASC
            LIMIT 5;
        """
        kritis_stats = vector_db.execute_query(kritis_query)
        context["laporan_perlu_evaluasi"] = kritis_stats or []

        # 5. Log aktivitas admin terkini
        logs_query = """
            SELECT jenis_tindakan, entitas_target, deskripsi, tanggal_dibuat
            FROM public.aktivitas_admin
            ORDER BY tanggal_dibuat DESC
            LIMIT 5;
        """
        logs = vector_db.execute_query(logs_query)
        context["log_audit_terbaru"] = logs or []

        # 6. Statistik token
        token_query = """
            SELECT nama_model, SUM(total_token) as total_token, SUM(estimasi_biaya)::numeric(10, 4) as total_biaya
            FROM public.penggunaan_token
            GROUP BY nama_model;
        """
        token_stats = vector_db.execute_query(token_query)
        context["statistik_token"] = token_stats or []
    except Exception as e:
        logger.error(f"Galat saat membangun konteks admin: {e}")
        context["error"] = str(e)
        
    return context


def build_kepala_lab_context() -> Dict[str, Any]:
    """
    Mengumpulkan data analitik eksekutif untuk Kepala Lab (PRD §2.A2).
    """
    context = {}
    try:
        # 1. Ringkasan performa per program studi
        prodi_query = """
            SELECT 
                ps.nama_prodi,
                COUNT(l.id_laporan) as total_laporan,
                ROUND(AVG(l.skor_orisinalitas)::numeric, 2) as rata_rata_orisinalitas,
                SUM(CASE WHEN l.skor_orisinalitas < 70 THEN 1 ELSE 0 END) as kasus_kemiripan_tinggi
            FROM public.laporan l
            JOIN public.program_studi ps ON l.id_program_studi = ps.id_program_studi
            GROUP BY ps.nama_prodi;
        """
        prodi_stats = vector_db.execute_query(prodi_query)
        context["statistik_prodi"] = prodi_stats or []

        # 2. Mata kuliah dengan tingkat kemiripan paling tinggi (orisinalitas terendah)
        matkul_query = """
            SELECT 
                mk.nama_matkul,
                COUNT(l.id_laporan) as total_laporan,
                ROUND(AVG(l.skor_orisinalitas)::numeric, 2) as rata_rata_orisinalitas
            FROM public.laporan l
            JOIN public.mata_kuliah mk ON l.id_mata_kuliah = mk.id_mata_kuliah
            GROUP BY mk.nama_matkul
            ORDER BY rata_rata_orisinalitas ASC
            LIMIT 5;
        """
        matkul_stats = vector_db.execute_query(matkul_query)
        context["matkul_perhatian_khusus"] = matkul_stats or []
    except Exception as e:
        logger.error(f"Galat saat membangun konteks kepala lab: {e}")
        context["error"] = str(e)
        
    return context


def build_aslab_context(id_laporan: Optional[str]) -> Dict[str, Any]:
    """
    Mengumpulkan konteks laporan spesifik untuk Aslab (PRD §2.B, §3.A) mencakup:
    - Informasi umum dan status verifikasi laporan
    - Analisis semantik teks berbasis BERT (segmen plagiat, template, orisinal)
    - Analisis kemiripan spasial visual berbasis CLIP (diagram/mockup hasil praktikum)
    - Data komparasi antarmahasiswa dan panduan brainstorming evaluasi
    """
    context = {}
    if not id_laporan:
        try:
            summary = vector_db.execute_query("""
                SELECT 
                    COUNT(*) as total_laporan,
                    ROUND(AVG(skor_orisinalitas)::numeric, 2) as rata_orisinalitas,
                    SUM(CASE WHEN skor_orisinalitas < 70 THEN 1 ELSE 0 END) as indikasi_plagiat
                FROM public.laporan;
            """)
            if summary:
                context["ringkasan_umum"] = summary[0]
            prodis = vector_db.execute_query("""
                SELECT 
                    ps.nama_prodi,
                    COUNT(l.id_laporan) as total_laporan,
                    ROUND(AVG(l.skor_orisinalitas)::numeric, 2) as rata_rata_orisinalitas
                FROM public.laporan l
                JOIN public.program_studi ps ON l.id_program_studi = ps.id_program_studi
                GROUP BY ps.nama_prodi;
            """)
            context["statistik_prodi"] = prodis or []
        except Exception as e:
            logger.warning(f"Galat ringkasan aslab: {e}")
        context["catatan"] = "Tidak ada laporan spesifik yang dipilih. Berikan asistensi umum panduan evaluasi atau informasi umum data yang tersedia."
        return context

    try:
        report_query = """
            SELECT 
                l.id_laporan,
                l.nama_mahasiswa,
                l.nim,
                l.skor_orisinalitas,
                l.skor_plagiarisme,
                l.skor_orisinalitas_koreksi,
                l.nilai_huruf,
                l.apakah_diverifikasi,
                l.status,
                l.detail_orisinalitas,
                mk.nama_matkul,
                ps.nama_prodi
            FROM public.laporan l
            LEFT JOIN public.mata_kuliah mk ON l.id_mata_kuliah = mk.id_mata_kuliah
            LEFT JOIN public.program_studi ps ON l.id_program_studi = ps.id_program_studi
            WHERE l.id_laporan = %s
            LIMIT 1;
        """
        report_data = vector_db.execute_query(report_query, (id_laporan,))
        if report_data:
            rep = report_data[0]
            context["informasi_laporan"] = {
                "id_laporan": rep["id_laporan"],
                "nama_mahasiswa": rep.get("nama_mahasiswa") or "Mahasiswa",
                "nim": rep.get("nim") or "-",
                "program_studi": rep.get("nama_prodi") or "-",
                "mata_kuliah": rep.get("nama_matkul") or "-",
                "skor_orisinalitas_ai": float(rep["skor_orisinalitas"] or 0.0),
                "skor_kemiripan_ai": float(rep["skor_plagiarisme"] or 0.0),
                "skor_koreksi_manual": float(rep["skor_orisinalitas_koreksi"]) if rep.get("skor_orisinalitas_koreksi") is not None else None,
                "nilai_huruf": rep.get("nilai_huruf"),
                "status_verifikasi": "TERVERIFIKASI" if rep.get("apakah_diverifikasi") else "MENUNGGU_VERIFIKASI"
            }

            details = rep.get("detail_orisinalitas")
            if isinstance(details, str):
                try:
                    details = json.loads(details)
                except Exception:
                    details = {}
            elif not isinstance(details, dict):
                details = {}

            # 1. Analisis Semantik Teks (BERT)
            text_segments = details.get("text_segments_details") or details.get("text_plagiarism_details") or []
            plagiarized_text = []
            template_text = []
            original_text = []

            for seg in text_segments:
                seg_type = seg.get("type", "ORIGINAL")
                if seg_type == "PLAGIARISM":
                    plagiarized_text.append(seg)
                elif seg_type == "TEMPLATE":
                    template_text.append(seg)
                else:
                    original_text.append(seg)

            top_plag_text = []
            for pt in sorted(plagiarized_text, key=lambda x: float(x.get("similarity_score") or 0.0), reverse=True)[:8]:
                geom = pt.get("geometry") or {}
                source_ref = pt.get("source_reference") or {}
                raw_text = geom.get("highlight_text") or ""
                snippet = raw_text[:250] + "..." if len(raw_text) > 250 else raw_text
                sim_pct = round(float(pt.get("similarity_score") or 0.0) * 100, 1)
                top_plag_text.append({
                    "halaman": geom.get("page_number", 1),
                    "kemiripan_persen": sim_pct,
                    "naskah_pembanding": source_ref.get("author") or "Arsip Mahasiswa",
                    "alasan": pt.get("reason", "Kemiripan semantik teks tinggi"),
                    "cuplikan_teks": snippet
                })

            top_template_text = []
            for tt in template_text[:5]:
                geom = tt.get("geometry") or {}
                raw_text = geom.get("highlight_text") or ""
                snippet = raw_text[:180] + "..." if len(raw_text) > 180 else raw_text
                top_template_text.append({
                    "halaman": geom.get("page_number", 1),
                    "kategori": "Boilerplate/Modul Praktikum",
                    "cuplikan_teks": snippet
                })

            context["analisis_teks_bert"] = {
                "total_segmen_dianalisis": len(text_segments),
                "segmen_plagiat_terdeteksi": len(plagiarized_text),
                "segmen_template_teridentifikasi": len(template_text),
                "segmen_orisinal": len(original_text),
                "kasus_plagiarisme_teks_signifikan": top_plag_text,
                "contoh_segmen_template_praktikum": top_template_text
            }

            # 2. Analisis Spasial Visual (CLIP)
            img_count_row = vector_db.execute_query(
                "SELECT COUNT(*) as total_gambar FROM public.laporan_gambar WHERE id_laporan = %s;",
                (id_laporan,)
            )
            total_gallery_imgs = img_count_row[0].get("total_gambar", 0) if img_count_row else 0

            image_plagiarism = details.get("image_plagiarism_details") or []
            top_plag_images = []

            confirmed_imgs = sum(1 for x in image_plagiarism if x.get("hitl_status") == "CONFIRMED")
            exempted_imgs = sum(1 for x in image_plagiarism if x.get("hitl_status") == "EXEMPTED")
            pending_imgs = sum(1 for x in image_plagiarism if x.get("hitl_status") not in ("CONFIRMED", "EXEMPTED"))

            for pi in sorted(image_plagiarism, key=lambda x: float(x.get("similarity_score") or 0.0), reverse=True)[:10]:
                source_ref = pi.get("source_reference") or {}
                sim_val = float(pi.get("similarity_score") or 0.0)
                sim_pct = round(sim_val if sim_val > 1 else sim_val * 100, 1)
                top_plag_images.append({
                    "halaman_praktikan": pi.get("page_number", 1),
                    "kemiripan_visual_clip_persen": sim_pct,
                    "penulis_pembanding": source_ref.get("author") or "Mahasiswa Lain",
                    "berkas_asal": source_ref.get("source_file_name") or "Laporan_Pembanding.pdf",
                    "halaman_naskah_asal": source_ref.get("page_number", 1),
                    "status_verifikasi_manual_hitl": pi.get("hitl_status", "PENDING"),
                    "catatan_evaluator": pi.get("hitl_note", ""),
                    "indikasi": "Duplikasi visual/tangkapan layar antarmuka/diagram praktikum identik"
                })

            context["analisis_visual_clip"] = {
                "total_gambar_naskah": total_gallery_imgs,
                "temuan_duplikasi_visual_clip": len(image_plagiarism),
                "rekapitulasi_hitl": {
                    "terkonfirmasi_plagiat": confirmed_imgs,
                    "dikecualikan_template": exempted_imgs,
                    "belum_diperiksa": pending_imgs
                },
                "rincian_duplikasi_gambar": top_plag_images
            }

            # 3. Poin-Poin Brainstorming & Rekomendasi Aslab
            context["topik_brainstorming_dan_evaluasi"] = {
                "fokus_diskusi": [
                    f"Kemiripan visual CLIP: Terdapat {len(image_plagiarism)} gambar pada naskah ini yang terdeteksi identik/sangat mirip dengan naskah mahasiswa lain. Diskusikan apakah diagram/mockup tersebut adalah karya mandiri atau duplikasi.",
                    f"Kemiripan teks BERT: Terdapat {len(plagiarized_text)} segmen teks dengan kemiripan tinggi. Namun, {len(template_text)} segmen telah diidentifikasi sebagai template/boilerplate praktikum yang TIDAK boleh dikurangi nilainya.",
                    "Human-in-the-Loop & Koreksi Nilai: Aslab dapat mendiskusikan penyesuaian skor akhir yang adil dan merumuskan umpan balik pembinaan untuk mahasiswa bersangkutan."
                ]
            }

    except Exception as e:
        logger.error(f"Galat saat membangun konteks aslab: {e}")
        context["error"] = str(e)
        
    return context


CORE_SCOPE_AND_SECURITY_DIRECTIVES = """
================================================================================
BATASAN LINGKUP PEMBAHASAN & PERLINDUNGAN PRIVASI DATA (WAJIB DIPATUHI MUTLAK)
================================================================================
1. PEMBATASAN LINGKUP HANYA SEPUTAR SISTEM, APLIKASI, & BASIS DATA AKADEMIK:
   - Anda HANYA DAN HANYA DIPERBOLEHKAN menjawab pertanyaan yang berkaitan langsung dengan:
     a) Sistem dan Aplikasi VERITAS (Sistem Deteksi Orisinalitas Laporan STITEK Bontang).
     b) Alur kerja sistem, fungsionalitas antarmuka, arsitektur layanan, dan status operasional aplikasi.
     c) Metodologi deteksi kemiripan (ekstraksi koordinat PDF PyMuPDF Bounding Box, temu kembali hibrida RRF, kemiripan semantik teks SBERT/MiniLM-L6, kemiripan spasial visual CLIP, reranking Cross-Encoder, pemfilteran template praktikum).
     d) Data laporan praktikum, skor orisinalitas/plagiarisme, mata kuliah, program studi, kelas, verifikasi kelulusan, dan rekapitulasi nilai yang tersimpan di basis data sistem.
   - LARANGAN TOPIK DI LUAR SISTEM (OUT-OF-DOMAIN):
     Dilarang keras menjawab topik umum di luar sistem, seperti: resep masakan/kuliner (misalnya resep mangut lele atau makanan lainnya), tips memasak, hiburan, film, musik, politik, olahraga, ramalan, lelucon di luar konteks, atau pembuatan konten/skrip umum yang tidak berhubungan dengan sistem Veritas.
   - TINDAKAN JIKA DITANYA TOPIK DI LUAR LINGKUP:
     Wajib tolak secara tegas, sopan, dan singkat tanpa menjawab topik tersebut:
     "Mohon maaf, lingkup pembahasan asisten AI dibatasi khusus seputar sistem, aplikasi, metodologi deteksi orisinalitas, serta basis data laporan akademik VERITAS STITEK Bontang. Pertanyaan di luar konteks sistem (seperti resep makanan, hiburan, atau topik umum lainnya) tidak dapat diproses."

2. PERLINDUNGAN KETAT PRIVASI & KREDENSIAL PENGGUNA (KECUALI DATA USER):
   - Anda DILARANG KERAS membeberkan, membocorkan, menampilkan, atau membahas DATA PENGGUNA / DATA AKUN PRIBADI:
     a) Dilarang menampilkan kata sandi, hash kata sandi (bcrypt/argon2), salt, atau informasi kredensial login akun pengguna.
     b) Dilarang menampilkan token autentikasi (JWT secret, token sesi, cookie sesi).
     c) Dilarang membeberkan kunci rahasia API (API keys Groq, Gemini, OpenAI, database connection string, Qdrant keys).
     d) Dilarang menampilkan daftar data privat pengguna dari tabel 'pengguna' (seperti daftar email pengguna sistem, kontak pribadi, dll).
     *(Catatan: Nama mahasiswa praktikan dan NIM yang tercantum dalam naskah laporan bimbingan praktikum BOLEH dirujuk sebatas untuk kepentingan verifikasi naskah laporan).*
   - TINDAKAN JIKA PENGGUNA MEMINTA DATA USER / SANDI / KREDENSIAL:
     Wajib tolak secara tegas:
     "Mohon maaf, akses terhadap data akun pengguna, kredensial login, kata sandi, dan data sensitif pengguna diblokir demi menjaga keamanan sistem dan kepatuhan privasi data."
================================================================================
"""


def check_out_of_domain_intent(message: str) -> Optional[str]:
    """
    Pemeriksaan cepat untuk permintaan yang jelas melanggar batasan lingkup atau meminta data pengguna rahasia.
    """
    msg_lower = message.lower().strip()
    
    # 1. Cek upaya akses data user rahasia
    user_data_triggers = [
        "kata sandi", "password", "hash password", "hash kata sandi",
        "kunci api", "api key", "jwt_secret", "jwt secret", "session cookie",
        "token sesi", "daftar password", "bocorkan password", "lihat password",
        "select * from pengguna", "tabel pengguna", "data user", "data pengguna",
        "daftar pengguna", "daftar user", "email user", "email pengguna"
    ]
    for trigger in user_data_triggers:
        if trigger in msg_lower and any(kw in msg_lower for kw in ["tampilkan", "lihat", "bocorkan", "apa", "berikan", "minta", "cari", "tahu", "siapa", "semua"]):
            return (
                "Mohon maaf, akses terhadap data akun pengguna, kredensial login, kata sandi, dan data "
                "sensitif pengguna diblokir secara permanen demi menjaga keamanan sistem dan kepatuhan privasi data."
            )
            
    # 2. Cek pertanyaan kuliner/resep/makanan di luar lingkup
    recipe_triggers = [
        "resep", "mangut lele", "cara masak", "cara membuat makanan", "bumbu masak", 
        "resep masakan", "bumbu mangut", "cara memasak", "resep kue", "resep makanan",
        "kuliner", "bahan masakan"
    ]
    for trigger in recipe_triggers:
        if trigger in msg_lower:
            return (
                "Mohon maaf, lingkup pembahasan asisten AI dibatasi khusus seputar sistem, aplikasi, "
                "metodologi deteksi orisinalitas, serta basis data laporan akademik VERITAS STITEK Bontang. "
                "Permintaan mengenai resep masakan atau topik di luar sistem tidak dapat diproses."
            )
            
    return None


def construct_system_prompt(role: str, context_data: Dict[str, Any]) -> str:
    """
    Menyusun System Prompt yang patuh PRD §4 dengan batasan keamanan, anti-bias, dan anti-halusinasi.
    """
    context_json = json.dumps(context_data, default=str, ensure_ascii=False, indent=2)

    if role == "ADMIN":
        return (
            f"{CORE_SCOPE_AND_SECURITY_DIRECTIVES}\n\n"
            "Anda adalah 'Integritas-Bot', asisten AI analitik data master dan operasional sistem "
            "pengecekan orisinalitas di STITEK Bontang. Tugas utama Anda adalah membantu Administrator "
            "menganalisis kesehatan sistem, rekapitulasi orisinalitas per program studi, mata kuliah yang memerlukan evaluasi, "
            "laporan dengan indikasi kemiripan tinggi, beban kerja token, dan transparansi log aktivitas.\n\n"
            "PANDUAN UTAMA (WAJIB DIPATUHI):\n"
            "1. LANDASAN DATA MUTLAK: Anda menjawab berdasarkan data JSON konteks sistem berikut. "
            "Jika pengguna bertanya mengenai rekapitulasi prodi, mata kuliah, atau laporan, rujuk langsung nilai metrik yang tertera pada data JSON.\n"
            "2. ANTI-HALUSINASI: Jangan pernah mengarang data statistik di luar angka yang tertera dalam data JSON.\n"
            "3. FORMAT: Gunakan visualisasi teks terstruktur (Markdown tabel atau daftar poin yang rapi).\n"
            "4. NETRALITAS & AKADEMIK: Berikan analisis dan rekomendasi teknis yang objektif, tanpa kata ganti orang pertama (saya/kami).\n"
            "5. BAHASA INDONESIA BAKU: Wajib selalu merespons dalam Bahasa Indonesia yang baik, benar, dan akademis (EYD V). Dilarang merespons dalam bahasa Inggris kecuali istilah teknis khusus.\n"
            "6. FORMAT TABEL & RUMUS MATEMATIKA: Jika menyajikan tabel Markdown yang memuat rumus matematika, WAJIB tuliskan rumus secara satu baris (inline) menggunakan $rumus$ atau \\(rumus\\). DILARANG menggunakan baris baru (newline) atau \\[...\\] di dalam sel tabel agar tabel Markdown tidak pecah.\n\n"
            f"--- BASIS DATA SISTEM SAAT INI ---\n{context_json}\n-----------------------------------"
        )
    elif role == "KEPALA_LAB":
        return (
            f"{CORE_SCOPE_AND_SECURITY_DIRECTIVES}\n\n"
            "Anda adalah 'Integritas-Eksekutif-Bot', asisten AI yang mendampingi Kepala Laboratorium "
            "STITEK Bontang dalam menganalisis data rekapitulasi orisinalitas laporan praktikum secara "
            "menyeluruh di tingkat Program Studi, Kelas, dan Mata Kuliah.\n\n"
            "PANDUAN EKSEKUTIF (WAJIB DIPATUHI):\n"
            "1. BATAS DATA: Hanya jawab berdasarkan data matriks rekapitulasi berikut. Anda dilarang membuka kunci API atau log teknis administrator.\n"
            "2. REKAPITULASI PRODI: Sajikan informasi terstruktur mengenai performa orisinalitas dan kelas yang memerlukan atensi kurikulum.\n"
            "3. VISUALISASI: Gunakan tabel Markdown atau poin ringkas yang mudah dibaca secara eksekutif.\n"
            "4. NETRALITAS: Sampaikan rekomendasi evaluasi secara objektif dan dorong koordinasi dengan asisten laboratorium.\n"
            "5. FORMAT TABEL & RUMUS: Rumus dalam sel tabel wajib satu baris ($rumus$). Jangan gunakan newline di dalam sel tabel.\n\n"
            f"--- DATA REKAPITULASI EKSEKUTIF ---\n{context_json}\n------------------------------------"
        )
    else:  # ASLAB
        return (
            f"{CORE_SCOPE_AND_SECURITY_DIRECTIVES}\n\n"
            "Anda adalah 'Veritas-Copilot-Evaluator', asisten AI cerdas dan mitra brainstorming interaktif "
            "untuk Asisten Laboratorium (ASLAB) STITEK Bontang dalam memeriksa, membedah, dan mendiskusikan orisinalitas laporan praktikum.\n\n"
            "KAPABILITAS & SUMBER DATA YANG ANDA MILIKI:\n"
            "1. ANALISIS SEMANTIK TEKS (BERT): Anda memiliki data lengkap segmen teks plagiat, segmen orisinal, serta segmen template praktikum, lengkap dengan persentase kemiripan, naskah pembanding, dan nomor halaman dokumen.\n"
            "2. ANALISIS SPASIAL VISUAL (CLIP): Anda memiliki data lengkap duplikasi gambar/diagram/mockup, persentase kemiripan kosinus CLIP (hingga 100%), nomor halaman praktikan vs halaman naskah rekan pembanding, dan nama penulis pembanding.\n"
            "3. BRAINSTORMING EVALUASI & KOMPARASI: Anda dapat diajak berdiskusi membandingkan naskah praktikan dengan naskah mahasiswa lain, membedah indikasi kecurangan, merumuskan saran pembinaan mahasiswa, serta merekomendasikan nilai koreksi manual yang adil (Human-in-the-Loop).\n\n"
            "PANDUAN EVALUASI & DISKUSI (WAJIB DIPATUHI):\n"
            "1. LANDASAN DATA MUTLAK: Rujuk data JSON konteks aktif berikut secara presisi. Sebutkan nama mahasiswa, nomor halaman, persentase skor, dan naskah pembanding secara nyata.\n"
            "2. PEMISAHAN PLAGIAT VS TEMPLATE (ATURAN EMAS):\n"
            "   - Segmen bertipe TEMPLATE (seperti format bab, daftar isi, alat dan bahan modul) adalah format baku dan TIDAK boleh dipotong nilainya.\n"
            "   - Bedakan antara template format dengan plagiarisme analisis kesimpulan atau duplikasi mockup/diagram praktikum.\n"
            "3. DISKUSI VISUAL CLIP: Jelaskan temuan duplikasi gambar secara spesifik dengan merujuk nomor halaman praktikan dan nama penulis pembanding (misalnya: 'Pada Halaman 34, 37, dan 44 terdeteksi kemiripan visual 99.9% - 100% terhadap naskah Elina Nurhaliza').\n"
            "4. GAYA KOMUNIKASI: Suportif, objektif, akademis, tanpa kata ganti orang pertama (saya/kami). Gunakan sudut pandang impersonal (misal: 'Sistem mendeteksi...', 'Berdasarkan data evaluasi...').\n"
            "5. FORMAT TABEL & RUMUS: Rumus di dalam tabel wajib satu baris inline ($rumus$). Jangan menyisipkan newline di dalam sel tabel.\n\n"
            f"--- DATA EVALUASI LAPORAN AKTIF (BERT & CLIP) ---\n{context_json}\n--------------------------------------------------"
        )


async def call_groq_api(api_key: str, model_name: str, system_prompt: str, user_message: str) -> Optional[str]:
    """
    Memanggil Groq Cloud Chat Completion API dengan latensi ultra-cepat.
    Mendukung failover antar model aktif Groq.
    """
    # Prioritaskan model aktif yang didukung oleh endpoint Groq saat ini
    groq_models = ["openai/gpt-oss-20b", "openai/gpt-oss-120b", "qwen/qwen3.8-27b", "groq/compound"]
    if model_name and "8b-8192" not in model_name:
        groq_models.insert(0, model_name.split("/")[-1])

    # Dedup
    seen = set()
    unique_models = [m for m in groq_models if not (m in seen or seen.add(m))]

    url = "https://api.groq.com/openai/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }

    for g_model in unique_models:
        payload = {
            "model": g_model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message}
            ],
            "temperature": 0.3,
            "max_tokens": 2048
        }
        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                resp = await client.post(url, headers=headers, json=payload)
                if resp.status_code == 200:
                    result = resp.json()
                    return result["choices"][0]["message"]["content"]
                else:
                    logger.warning(f"Groq API error ({g_model}, status {resp.status_code})")
        except Exception as e:
            logger.warning(f"Groq API call ({g_model}) failed: {e}")
        
    return None


async def call_gemini_api(api_key: str, system_prompt: str, user_message: str) -> Optional[str]:
    """
    Memanggil Google Gemini API dengan auto-discovery model aktif.
    """
    if not api_key:
        return None

    gemini_models = ["gemini-3.6-flash", "gemini-flash-latest", "gemini-2.5-flash-lite"]
    headers = {"Content-Type": "application/json"}
    combined_prompt = f"{system_prompt}\n\n[Pertanyaan Pengguna]\n{user_message}"
    payload = {
        "contents": [
            {"role": "user", "parts": [{"text": combined_prompt}]}
        ],
        "generationConfig": {
            "temperature": 0.3,
            "maxOutputTokens": 2048
        }
    }

    for model_name in gemini_models:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"
        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                resp = await client.post(url, headers=headers, json=payload)
                if resp.status_code == 200:
                    result = resp.json()
                    candidates = result.get("candidates", [])
                    if candidates and "content" in candidates[0]:
                        parts = candidates[0]["content"].get("parts", [])
                        if parts and "text" in parts[0]:
                            return parts[0]["text"]
                else:
                    logger.warning(f"Gemini API error ({model_name}, status {resp.status_code})")
        except Exception as e:
            logger.warning(f"Gemini API ({model_name}) failed: {e}")
            
    return None


async def call_ollama_api(system_prompt: str, user_message: str) -> Optional[str]:
    """
    Memanggil Ollama local instance jika tersedia.
    """
    url = f"{settings.OLLAMA_URL}/api/chat"
    payload = {
        "model": settings.OLLAMA_MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message}
        ],
        "stream": False
    }
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(url, json=payload)
            if resp.status_code == 200:
                result = resp.json()
                return result.get("message", {}).get("content")
    except Exception:
        pass
    return None


def generate_academic_fallback_response(role: str, user_message: str, context: Dict[str, Any]) -> str:
    """
    Mesin inferensi aturan cerdas (Deterministic Academic Reasoner) yang memberikan jawaban
    akurat dan kaya informasi berdasarkan konteks database riil saat layanan LLM cloud offline
    atau kunci API belum dikonfigurasi.
    """
    # 0. Cek guardrail out-of-domain pada fallback
    refusal = check_out_of_domain_intent(user_message)
    if refusal:
        return refusal

    if role == "ADMIN":
        ringkasan = context.get("ringkasan_laporan", {})
        total = ringkasan.get("total_laporan", 0)
        rata = ringkasan.get("rata_orisinalitas", "N/A")
        antrean = ringkasan.get("antrean_verifikasi", 0)
        plagiat = ringkasan.get("indikasi_plagiat", 0)

        return (
            f"### Ringkasan Operasional Sistem (Admin)\n\n"
            f"Berdasarkan data master sistem saat ini:\n"
            f"- **Total Laporan Terarsip:** {total} laporan\n"
            f"- **Rata-Rata Skor Orisinalitas:** {rata}%\n"
            f"- **Antrean Menunggu Verifikasi:** {antrean} dokumen\n"
            f"- **Indikasi Plagiarisme (<70%):** {plagiat} dokumen\n\n"
            f"Untuk pertanyaan: *\"{user_message}\"*, semua pipa layanan deteksi vektor "
            f"dan penyimpanan Supabase beroperasi normal. Konfigurasikan Kunci API Groq "
            f"di menu Pengaturan AI Admin untuk mengaktifkan pemrosesan bahasa alami generatif."
        )

    elif role == "KEPALA_LAB":
        prodi_list = context.get("statistik_prodi", [])
        prodi_text = ""
        if prodi_list:
            prodi_text = "\n".join([
                f"- **{p.get('nama_prodi')}:** {p.get('total_laporan')} laporan (Rata-rata: {p.get('rata_rata_orisinalitas')}%)"
                for p in prodi_list
            ])
        else:
            prodi_text = "*(Belum ada data laporan yang cukup untuk kalkulasi per prodi)*"

        return (
            f"### Rekapitulasi Eksekutif Laboratorium Komputer\n\n"
            f"Berikut adalah ringkasan integritas akademik lintas Program Studi:\n"
            f"{prodi_text}\n\n"
            f"Menanggapi pertanyaan Anda: *\"{user_message}\"*, sistem merekomendasikan peninjauan terfokus "
            f"pada mata kuliah dengan tingkat kemiripan tinggi bersama Asisten Laboratorium pengampu "
            f"sebelum penerbitan nilai akhir praktikum."
        )

    else:  # ASLAB
        info = context.get("informasi_laporan", {})
        if info:
            mhs = info.get("nama_mahasiswa", "Mahasiswa")
            nim = info.get("nim", "-")
            mk = info.get("mata_kuliah", "-")
            skor_ori = info.get("skor_orisinalitas", 0.0)
            skor_plag = info.get("skor_kemiripan", 0.0)
            status_verif = info.get("status_verifikasi", "MENUNGGU_VERIFIKASI")

            rekomendasi = ""
            if skor_ori >= 80:
                rekomendasi = "Tingkat orisinalitas sangat baik. Laporan memenuhi standar kelulusan praktikum."
            elif skor_ori >= 60:
                rekomendasi = "Tingkat kemiripan sedang. Periksa apakah kesamaan berasal dari template modul atau penulisan kode sumber."
            else:
                rekomendasi = "Tingkat kemiripan tinggi. Disarankan melakukan wawancara verifikasi atau meminta revisi penjelasan logika mandiri."

            return (
                f"### Analisis Laporan Praktikum (Asisten Lab)\n\n"
                f"- **Praktikan:** {mhs} ({nim})\n"
                f"- **Mata Kuliah:** {mk}\n"
                f"- **Skor Orisinalitas:** **{skor_ori}%** (Kemiripan: {skor_plag}%)\n"
                f"- **Status:** `{status_verif}`\n\n"
                f"**Rekomendasi Evaluator:**\n"
                f"{rekomendasi}\n\n"
                f"> **Catatan Human-in-the-Loop:** Keputusan akhir penilaian tetap berada pada evaluator Aslab. "
                f"Pastikan membedakan antara format baku praktikum (template) dengan kesamaan analisis data."
            )
        else:
            return (
                f"Halo Asisten Laboratorium. Sistem AI Evaluator aktif.\n\n"
                f"Untuk analisis mendalam segmen teks atau perbandingan gambar, silakan buka laporan "
                f"spesifik melalui menu **Detail Laporan** agar konteks naskah dapat dimuat secara presisi."
            )


async def process_chat_message(message: str, role: str, id_laporan: Optional[str] = None) -> str:
    """
    Fungsi utama pemroses pesan chatbot dengan Context Injection,
    System Prompt Formatting, Out-of-Domain Guardrail, dan Multi-tier LLM Dispatcher.
    """
    logger.info(f"Memproses pesan chatbot. Role: {role}, Laporan: {id_laporan}")

    # 0. Pemeriksaan Guardrail Domain & Keamanan Akun Pengguna
    refusal = check_out_of_domain_intent(message)
    if refusal:
        logger.info(f"Pesan ditolak oleh Domain/Security Guardrail: '{message[:50]}'")
        return refusal

    # 1. Bangun konteks berbasis Role
    if role == "ADMIN":
        context_data = build_admin_context()
    elif role == "KEPALA_LAB":
        context_data = build_kepala_lab_context()
    else:
        context_data = build_aslab_context(id_laporan)

    # 2. Susun System Prompt
    system_prompt = construct_system_prompt(role, context_data)

    # 3. Dapatkan kredensial aktif
    creds = get_active_credentials()

    # 4. Coba panggil provider LLM secara berurutan
    # Prioritas 1: Groq Cloud
    if creds["groq_key"]:
        logger.info("Mencoba memanggil Groq Cloud LLM...")
        resp = await call_groq_api(creds["groq_key"], creds["model"], system_prompt, message)
        if resp:
            return resp

    # Prioritas 2: Gemini API
    if creds["gemini_key"]:
        logger.info("Mencoba memanggil Google Gemini API...")
        resp = await call_gemini_api(creds["gemini_key"], system_prompt, message)
        if resp:
            return resp

    # Prioritas 3: Ollama lokal
    logger.info("Mencoba memanggil Ollama lokal...")
    resp = await call_ollama_api(system_prompt, message)
    if resp:
        return resp

    # Prioritas 4: Intelligent Deterministic Academic Fallback
    logger.info("Menggunakan Deterministic Academic Reasoner Fallback...")
    return generate_academic_fallback_response(role, message, context_data)
