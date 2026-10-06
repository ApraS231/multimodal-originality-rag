import os
import sys
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, HRFlowable
)
from reportlab.pdfgen import canvas

class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, page_count):
        self.saveState()
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#64748B"))
        
        # Header (pages > 1)
        if self._pageNumber > 1:
            self.drawString(54, 800, "STITEK Bontang — Dokumentasi Penguatan Keamanan & Privasi AI Service")
            self.setStrokeColor(colors.HexColor("#CBD5E1"))
            self.setLineWidth(0.5)
            self.line(54, 792, 541, 792)
        
        # Footer
        footer_text = f"Halaman {self._pageNumber} dari {page_count}"
        self.drawRightString(541, 36, footer_text)
        self.drawString(54, 36, "Klasifikasi: Dokumen Teknis Internal — Sistem Deteksi Orisinalitas Laporan")
        self.setStrokeColor(colors.HexColor("#CBD5E1"))
        self.setLineWidth(0.5)
        self.line(54, 48, 541, 48)
        self.restoreState()

def build_pdf(filename):
    doc = SimpleDocTemplate(
        filename,
        pagesize=A4,
        leftMargin=54,
        rightMargin=54,
        topMargin=54,
        bottomMargin=54
    )

    styles = getSampleStyleSheet()
    
    # Custom Palette
    primary = colors.HexColor("#0F172A")    # Dark slate
    accent = colors.HexColor("#1E40AF")     # Deep Blue
    text_color = colors.HexColor("#334155") # Slate body
    bg_light = colors.HexColor("#F8FAFC")
    border_color = colors.HexColor("#CBD5E1")

    # Typography Styles
    title_style = ParagraphStyle(
        "DocTitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=18,
        leading=22,
        textColor=primary,
        alignment=0,
        spaceAfter=4
    )
    subtitle_style = ParagraphStyle(
        "DocSubtitle",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=10.5,
        leading=14,
        textColor=accent,
        alignment=0,
        spaceAfter=10
    )
    h1_style = ParagraphStyle(
        "Heading1_Custom",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=12,
        leading=16,
        textColor=accent,
        spaceBefore=10,
        spaceAfter=5,
        keepWithNext=True
    )
    h2_style = ParagraphStyle(
        "Heading2_Custom",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=9.5,
        leading=13,
        textColor=primary,
        spaceBefore=7,
        spaceAfter=3,
        keepWithNext=True
    )
    body_style = ParagraphStyle(
        "Body_Custom",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8.2,
        leading=11.5,
        textColor=text_color,
        spaceAfter=4
    )
    code_style = ParagraphStyle(
        "Code_Custom",
        parent=styles["Normal"],
        fontName="Courier",
        fontSize=7.0,
        leading=9.0,
        textColor=colors.HexColor("#0F172A"),
        spaceAfter=0
    )
    test_code_style = ParagraphStyle(
        "TestCode_Custom",
        parent=styles["Normal"],
        fontName="Courier",
        fontSize=6.8,
        leading=8.5,
        textColor=colors.HexColor("#0F172A"),
        spaceAfter=0
    )
    table_cell = ParagraphStyle(
        "TableCell",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=7.5,
        leading=10,
        textColor=text_color
    )
    table_cell_center = ParagraphStyle(
        "TableCellCenter",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=7.5,
        leading=10,
        textColor=text_color,
        alignment=1
    )
    table_cell_bold = ParagraphStyle(
        "TableCellBold",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=7.5,
        leading=10,
        textColor=primary
    )
    table_cell_bold_center = ParagraphStyle(
        "TableCellBoldCenter",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=7.5,
        leading=10,
        textColor=primary,
        alignment=1
    )
    badge_pass = ParagraphStyle(
        "BadgePass",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=7,
        leading=9,
        textColor=colors.HexColor("#047857"),
        alignment=1
    )

    story = []

    # Title Banner Box
    meta_box = [
        [
            Paragraph("DOKUMENTASI TEKNIS PENGUATAN KEAMANAN & PRIVASI DATA", title_style),
        ],
        [
            Paragraph("Arsitektur Mitigasi Kerentanan & Perlindungan Data Akademik pada AI Service Engine", subtitle_style),
        ],
        [
            Paragraph(
                "<b>Sistem:</b> Deteksi Orisinalitas Laporan Praktikum STITEK Bontang &nbsp;|&nbsp; "
                "<b>Komponen:</b> Core AI Service (FastAPI, PyTorch, LangGraph) &nbsp;|&nbsp; "
                "<b>Status:</b> 100% Selesai & Terverifikasi (34/34 Tests PASS)",
                body_style
            )
        ]
    ]
    t_meta = Table(meta_box, colWidths=[487])
    t_meta.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), bg_light),
        ('BOX', (0,0), (-1,-1), 1, border_color),
        ('PADDING', (0,0), (-1,-1), 10),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(t_meta)
    story.append(Spacer(1, 8))

    # 1. Ringkasan Eksekutif
    story.append(Paragraph("1. Ringkasan Eksekutif", h1_style))
    story.append(Paragraph(
        "Laporan teknis ini mendokumentasikan implementasi penguatan keamanan (*security hardening*) dan mitigasi "
        "kebocoran data pribadi (*privacy mitigation*) pada microservice kecerdasan buatan (*Core AI Service*). "
        "Penguatan ini dirancang untuk memenuhi standar kepatuhan regulasi perlindungan data akademik mahasiswa "
        "dan mencegah eksploitasi infrastruktur komputasi AI dari serangan siber seperti <i>Indirect Prompt Injection</i>, "
        "<i>Insecure Deserialization</i>, <i>Decompression Bomb Denial-of-Service</i>, <i>Path Traversal</i>, dan kebocoran metadata identitas rekan mahasiswa (*peer author leakage*).",
        body_style
    ))
    story.append(Paragraph(
        "Seluruh 10 celah keamanan yang teridentifikasi dalam audit sistem telah ditutup secara menyeluruh "
        "pada 7 berkas kode sumber inti, didukung oleh penambahan 8 unit pengujian keamanan otomatis baru yang melengkapi "
        "keseluruhan suite pengujian menjadi 34 pengujian aktif tanpa kegagalan (100% kelulusan).",
        body_style
    ))

    # 2. Matriks 10 Celah Keamanan & Status Mitigasi
    story.append(Paragraph("2. Matriks Audit Celah Keamanan & Status Mitigasi", h1_style))
    
    headers = [
        Paragraph("<b>No</b>", table_cell_bold_center),
        Paragraph("<b>Celah Keamanan Teridentifikasi</b>", table_cell_bold),
        Paragraph("<b>Vektor Kerentanan / Risiko</b>", table_cell_bold),
        Paragraph("<b>Berkas Target</b>", table_cell_bold),
        Paragraph("<b>Status</b>", table_cell_bold_center)
    ]
    
    rows = [headers,
        [
            Paragraph("1", table_cell_center),
            Paragraph("CORS Wildcard (allow_origins=['*'])", table_cell),
            Paragraph("Pencurian kredensial via Cross-Origin Request", table_cell),
            Paragraph("app/main.py", code_style),
            Paragraph("TERTUTUP", badge_pass)
        ],
        [
            Paragraph("2", table_cell_center),
            Paragraph("Folder /static Terpasang Publik", table_cell),
            Paragraph("Akses tidak sah ke gambar naskah mahasiswa", table_cell),
            Paragraph("app/main.py", code_style),
            Paragraph("TERTUTUP", badge_pass)
        ],
        [
            Paragraph("3", table_cell_center),
            Paragraph("torch.load() tanpa weights_only=True", table_cell),
            Paragraph("Arbitrary Code Execution via Pickle Deserialization", table_cell),
            Paragraph("app/core/proto_head.py", code_style),
            Paragraph("TERTUTUP", badge_pass)
        ],
        [
            Paragraph("4", table_cell_center),
            Paragraph("Prompt LLM Tanpa Sandboxing Delimiter", table_cell),
            Paragraph("Indirect Prompt Injection manipulasi vonis plagiarisme", table_cell),
            Paragraph("app/core/orchestrator.py", code_style),
            Paragraph("TERTUTUP", badge_pass)
        ],
        [
            Paragraph("5", table_cell_center),
            Paragraph("Ketiadaan Guardrail Deterministik Skoring", table_cell),
            Paragraph("LLM menganulir kemiripan semantik tinggi (>85%)", table_cell),
            Paragraph("app/core/orchestrator.py", code_style),
            Paragraph("TERTUTUP", badge_pass)
        ],
        [
            Paragraph("6", table_cell_center),
            Paragraph("Ketiadaan Deteksi Centroid Drift HITL", table_cell),
            Paragraph("Kerusakan representasi prototipe mata kuliah", table_cell),
            Paragraph("app/core/proto_trainer.py", code_style),
            Paragraph("TERTUTUP", badge_pass)
        ],
        [
            Paragraph("7", table_cell_center),
            Paragraph("Ketiadaan Validasi Ukuran & Tipe Berkas", table_cell),
            Paragraph("Denial-of-Service (DoS) upload & eksekusi file non-PDF", table_cell),
            Paragraph("app/api/endpoints.py", code_style),
            Paragraph("TERTUTUP", badge_pass)
        ],
        [
            Paragraph("8", table_cell_center),
            Paragraph("Kebocoran Metadata Mahasiswa Pembanding", table_cell),
            Paragraph("Pelanggaran privasi identitas rekan mahasiswa", table_cell),
            Paragraph("app/api/endpoints.py", code_style),
            Paragraph("TERTUTUP", badge_pass)
        ],
        [
            Paragraph("9", table_cell_center),
            Paragraph("Ketiadaan Batas Image.MAX_IMAGE_PIXELS", table_cell),
            Paragraph("Decompression Bomb crash akibat alokasi memori berlebih", table_cell),
            Paragraph("app/core/parser.py", code_style),
            Paragraph("TERTUTUP", badge_pass)
        ],
        [
            Paragraph("10", table_cell_center),
            Paragraph("Cakupan Uji Keamanan Tidak Lengkap", table_cell),
            Paragraph("Regresi keamanan tidak terpantau dalam pipeline CI/CD", table_cell),
            Paragraph("tests/test_api_security.py", code_style),
            Paragraph("TERTUTUP", badge_pass)
        ],
    ]

    # Total width: 18 + 118 + 150 + 136 + 65 = 487 pt
    t_matrix = Table(rows, colWidths=[18, 118, 150, 136, 65])
    t_matrix.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#F1F5F9")),
        ('GRID', (0,0), (-1,-1), 0.5, border_color),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('PADDING', (0,0), (-1,-1), 3),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, bg_light]),
    ]))
    story.append(t_matrix)
    story.append(Spacer(1, 10))

    # Page 2: Pilar 1, 2, 3, 4
    story.append(PageBreak())
    story.append(Paragraph("3. Detail Arsitektur & Implementasi Teknis (4 Pilar Keamanan)", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=accent, spaceAfter=8))

    # Pilar 1
    story.append(Paragraph("Pilar 1: Privasi & Access Control", h2_style))
    story.append(Paragraph(
        "<b>a. Penyamaran Metadata Penulis (Role-Based Privacy Masking):</b> "
        "Berdasarkan prinsip <i>Least Privilege</i> dan regulasi kerahasiaan data mahasiswa, endpoint <code>/analyze</code> "
        "memvalidasi peran pengguna dari klaim JWT. Apabila pengguna memiliki peran <code>MAHASISWA</code>, nama lengkap dan asal kelas "
        "dari naskah pembanding yang terdeteksi plagiat secara otomatis disamarkan menjadi <code>Mahasiswa (Tahun {tahun})</code> "
        "dan asal sumber dokumen menjadi <code>Dokumen Terindeks</code>. Identitas asli hanya dibuka penuh bagi peran <code>DOSEN</code>, <code>ASLAB</code>, dan <code>ADMIN</code>.",
        body_style
    ))
    story.append(Paragraph(
        "<b>b. Endpoint Pengambilan Gambar Terproteksi JWT:</b> "
        "Mount folder publik <code>/static</code> telah dihapus sepenuhnya dari <code>app/main.py</code>. "
        "Akses ke seluruh berkas visual hasil ekstraksi laporan dialihkan ke rute API terproteksi <code>GET /api/v1/images/{filename}</code> "
        "yang memerlukan token otentikasi Bearer JWT. Sanitasi nama berkas dilakukan menggunakan <code>os.path.basename()</code> "
        "guna menolak upaya serangan <i>Path Traversal</i> (misal: <code>../../main.py</code>).",
        body_style
    ))

    # Pilar 2
    story.append(Paragraph("Pilar 2: Infrastruktur & Eksekusi Kode (Code Execution Defense)", h2_style))
    story.append(Paragraph(
        "<b>a. Deserialisasi Bobot Aman PyTorch:</b> "
        "Pada berkas <code>app/core/proto_head.py</code>, pemanggilan <code>torch.load()</code> dimodifikasi dengan menambahkan parameter "
        "<code>weights_only=True</code>. Hal ini memastikan mekanisme unpickler PyTorch hanya mengekstrak tensor bobot numerik dan menolak "
        "eksekusi objek arbitrer Python (RCE mitigasi).",
        body_style
    ))
    story.append(Paragraph(
        "<b>b. Strict Whitelisting CORS Dinamis:</b> "
        "CORS wildcard (<code>*</code>) pada <code>app/main.py</code> digantikan dengan pembacaan variabel lingkungan terkonfigurasi "
        "<code>settings.CORS_ALLOWED_ORIGINS</code> (default: <code>http://localhost:3000,http://localhost:5173,http://localhost:8080</code>), "
        "menjamin kepatuhan aturan konfigurasi tanpa hardcoding.",
        body_style
    ))
    story.append(Paragraph(
        "<b>c. Batas Maksimum Resolusi Gambar (Anti-Decompression Bomb):</b> "
        "Pada berkas <code>app/core/parser.py</code>, diatur <code>Image.MAX_IMAGE_PIXELS = 50_000_000</code>. "
        "Batas ini mencegah serangan berkas gambar kompresi tinggi berukuran kecil yang membengkak hingga puluhan gigabyte "
        "di dalam memori RAM saat didekompresi.",
        body_style
    ))

    # Pilar 3
    story.append(Paragraph("Pilar 3: Inti AI & Defensive Prompt Engineering", h2_style))
    story.append(Paragraph(
        "<b>a. Delimiter Sandboxing (Anti-Indirect Prompt Injection):</b> "
        "Pada node verifikasi LLM (<code>app/core/orchestrator.py</code>), teks laporan mahasiswa dan teks referensi pembanding diisolasi "
        "dalam tag delimiter XML tegas: <code>&lt;&lt;&lt;STUDENT_REPORT_TEXT&gt;&gt;&gt;</code> dan <code>&lt;&lt;&lt;REFERENCE_REPORT_TEXT&gt;&gt;&gt;</code>. "
        "Instruksi sistem eksplisit menetapkan bahwa teks di dalam tag merupakan data mentah dan segala perintah yang terkandung di dalamnya "
        "wajib diabaikan oleh model bahasa.",
        body_style
    ))
    story.append(Paragraph(
        "<b>b. Guardrail Deterministik Skoring:</b> "
        "Jika kemiripan semantik dense melebihi ambang batas kritis (skor &gt; 0.85) namun LLM memberikan keputusan false, "
        "sistem secara otomatis menandai status <code>[NEEDS REVIEW]</code> untuk mewajibkan tinjauan manual oleh Dosen/Asisten Laboratorium, "
        "mencegah bias <i>jailbreak</i> dari model bahasa.",
        body_style
    ))
    story.append(Paragraph(
        "<b>c. Deteksi Pergeseran Abnormal Centroid (Drift Detection):</b> "
        "Pada <code>app/core/proto_trainer.py</code>, saat retraining berbasis koreksi HITL berlangsung, pergeseran jarak Euclidean antar centroid dihitung: "
        "<b>Δc = || c_baru - c_lama ||_2</b>. Apabila Δc melebihi <code>DRIFT_ANOMALY_THRESHOLD</code> (0.50), sistem mencatat "
        "peringatan dan membukukan log anomali ke tabel <code>prototype_training_log</code> untuk peninjauan administrator.",
        body_style
    ))

    # Pilar 4
    story.append(Paragraph("Pilar 4: Pengujian Otomatis & Jaminan CI/CD", h2_style))
    story.append(Paragraph(
        "Seluruh fungsionalitas keamanan diverifikasi melalui penambahan 8 skenario pengujian komprehensif pada "
        "<code>tests/test_api_security.py</code>, melengkapi 7 pengujian yang telah ada sebelumnya menjadi total 15 pengujian keamanan.",
        body_style
    ))

    # Page 3: Hasil Pengujian & Tabel
    story.append(PageBreak())
    story.append(Paragraph("4. Rekapitulasi Hasil Pengujian Unit & Regresi", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=accent, spaceAfter=8))

    test_headers = [
        Paragraph("<b>No</b>", table_cell_bold_center),
        Paragraph("<b>Nama Skenario Uji (Test Case)</b>", table_cell_bold),
        Paragraph("<b>Aspek yang Divalidasi</b>", table_cell_bold),
        Paragraph("<b>Hasil</b>", table_cell_bold_center)
    ]
    
    test_rows = [test_headers,
        [
            Paragraph("1", table_cell_center),
            Paragraph("test_unauthorized_access_missing_token", test_code_style),
            Paragraph("Penolakan request tanpa header Authorization (HTTP 403)", table_cell),
            Paragraph("PASSED", badge_pass)
        ],
        [
            Paragraph("2", table_cell_center),
            Paragraph("test_unauthorized_access_invalid_token", test_code_style),
            Paragraph("Penolakan token dengan JWT signature tidak valid (HTTP 401)", table_cell),
            Paragraph("PASSED", badge_pass)
        ],
        [
            Paragraph("3", table_cell_center),
            Paragraph("test_rbac_aslab_forbidden_to_finetune", test_code_style),
            Paragraph("Penolakan role ASLAB pada rute khusus ADMIN (HTTP 403)", table_cell),
            Paragraph("PASSED", badge_pass)
        ],
        [
            Paragraph("4", table_cell_center),
            Paragraph("test_rbac_admin_allowed_to_finetune", test_code_style),
            Paragraph("Izin akses role ADMIN untuk memicu fine-tune model (HTTP 200)", table_cell),
            Paragraph("PASSED", badge_pass)
        ],
        [
            Paragraph("5", table_cell_center),
            Paragraph("test_aes_gcm_decryption", test_code_style),
            Paragraph("Dekripsi kredensial API runtime berbasis AES-256-GCM", table_cell),
            Paragraph("PASSED", badge_pass)
        ],
        [
            Paragraph("6", table_cell_center),
            Paragraph("test_config_sync_endpoint", test_code_style),
            Paragraph("Sinkronisasi hot-swap konfigurasi runtime dari gateway", table_cell),
            Paragraph("PASSED", badge_pass)
        ],
        [
            Paragraph("7", table_cell_center),
            Paragraph("test_sse_progress_stream", test_code_style),
            Paragraph("Stream Server-Sent Events untuk monitoring progress tugas", table_cell),
            Paragraph("PASSED", badge_pass)
        ],
        [
            Paragraph("8", table_cell_center),
            Paragraph("test_torch_load_weights_only", test_code_style),
            Paragraph("Verifikasi parameter weights_only=True pada unpickler PyTorch", table_cell),
            Paragraph("PASSED", badge_pass)
        ],
        [
            Paragraph("9", table_cell_center),
            Paragraph("test_privacy_masking_for_student_role", test_code_style),
            Paragraph("Penyamaran nama & kelas penulis pembanding bagi role MAHASISWA", table_cell),
            Paragraph("PASSED", badge_pass)
        ],
        [
            Paragraph("10", table_cell_center),
            Paragraph("test_privacy_unmasked_for_admin", test_code_style),
            Paragraph("Identitas naskah pembanding terbuka penuh bagi role ADMIN/DOSEN", table_cell),
            Paragraph("PASSED", badge_pass)
        ],
        [
            Paragraph("11", table_cell_center),
            Paragraph("test_unauthenticated_image_access_rejected", test_code_style),
            Paragraph("Penolakan akses publik ke gambar tanpa token Bearer (HTTP 403)", table_cell),
            Paragraph("PASSED", badge_pass)
        ],
        [
            Paragraph("12", table_cell_center),
            Paragraph("test_image_access_path_traversal_blocked", test_code_style),
            Paragraph("Pemblokiran path traversal ../../ pada route gambar (HTTP 404)", table_cell),
            Paragraph("PASSED", badge_pass)
        ],
        [
            Paragraph("13", table_cell_center),
            Paragraph("test_file_upload_invalid_extension", test_code_style),
            Paragraph("Penolakan upload berkas selain .pdf (misal .exe/.docx) (HTTP 400)", table_cell),
            Paragraph("PASSED", badge_pass)
        ],
        [
            Paragraph("14", table_cell_center),
            Paragraph("test_file_upload_size_limit", test_code_style),
            Paragraph("Penolakan berkas melebihi batas MAX_FILE_SIZE_MB (HTTP 400)", table_cell),
            Paragraph("PASSED", badge_pass)
        ],
        [
            Paragraph("15", table_cell_center),
            Paragraph("test_prompt_injection_delimiters", test_code_style),
            Paragraph("Inspeksi delimiter sandboxing XML & guardrail review pada prompt LLM", table_cell),
            Paragraph("PASSED", badge_pass)
        ]
    ]

    # Total width: 24 + 216 + 192 + 55 = 487 pt
    t_tests = Table(test_rows, colWidths=[24, 216, 192, 55])
    t_tests.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#F1F5F9")),
        ('GRID', (0,0), (-1,-1), 0.5, border_color),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('PADDING', (0,0), (-1,-1), 2.5),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, bg_light]),
    ]))
    story.append(t_tests)
    story.append(Spacer(1, 8))

    # Ringkasan Suite Penuh
    suite_summary = [
        [
            Paragraph("<b>Komponen Pengujian</b>", table_cell_bold),
            Paragraph("<b>Berkas Pengujian</b>", table_cell_bold),
            Paragraph("<b>Jumlah Kasus Uji</b>", table_cell_bold_center),
            Paragraph("<b>Status Kelulusan</b>", table_cell_bold_center)
        ],
        [
            Paragraph("Security & Privacy Hardening", table_cell),
            Paragraph("tests/test_api_security.py", code_style),
            Paragraph("15 Kasus", table_cell_center),
            Paragraph("100% PASS (15/15)", badge_pass)
        ],
        [
            Paragraph("Prototypical Neural Head", table_cell),
            Paragraph("tests/test_proto_head.py", code_style),
            Paragraph("5 Kasus", table_cell_center),
            Paragraph("100% PASS (5/5)", badge_pass)
        ],
        [
            Paragraph("HITL Training & Drift Engine", table_cell),
            Paragraph("tests/test_proto_trainer.py", code_style),
            Paragraph("5 Kasus", table_cell_center),
            Paragraph("100% PASS (5/5)", badge_pass)
        ],
        [
            Paragraph("Document Parser & OCR", table_cell),
            Paragraph("tests/test_parser.py", code_style),
            Paragraph("3 Kasus", table_cell_center),
            Paragraph("100% PASS (3/3)", badge_pass)
        ],
        [
            Paragraph("LangGraph Orchestration Pipeline", table_cell),
            Paragraph("tests/test_orchestrator.py", code_style),
            Paragraph("6 Kasus", table_cell_center),
            Paragraph("100% PASS (6/6)", badge_pass)
        ],
        [
            Paragraph("<b>TOTAL KESELURUHAN</b>", table_cell_bold),
            Paragraph("<b>5 Test Suites Aktif</b>", table_cell_bold),
            Paragraph("<b>34 Kasus Uji</b>", table_cell_bold_center),
            Paragraph("<b>100% PASS (34/34)</b>", badge_pass)
        ]
    ]
    t_suite = Table(suite_summary, colWidths=[140, 160, 97, 90])
    t_suite.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#E2E8F0")),
        ('BACKGROUND', (0,-1), (-1,-1), colors.HexColor("#F1F5F9")),
        ('GRID', (0,0), (-1,-1), 0.5, border_color),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('PADDING', (0,0), (-1,-1), 3),
    ]))
    story.append(t_suite)
    story.append(Spacer(1, 8))

    # 5. Kesimpulan & Rekomendasi
    story.append(Paragraph("5. Kesimpulan & Rekomendasi Operasional", h1_style))
    story.append(Paragraph(
        "Seluruh rangkaian penguatan keamanan microservice AI telah rampung diimplementasikan dengan sempurna tanpa "
        "menimbulkan regresi fungsi. Sistem kini memiliki ketahanan tinggi terhadap eksploitasi berbasis berkas, serangan injeksi "
        "prompt tidak langsung, serta menjamin kepatuhan penuh terhadap etika privasi data akademik perguruan tinggi.",
        body_style
    ))
    story.append(Paragraph(
        "<b>Rekomendasi Deployment Produksi:</b> "
        "1) Pastikan berkas <code>.env</code> di lingkungan server produksi telah diisi dengan nilai <code>CORS_ALLOWED_ORIGINS</code> yang mengarah "
        "hanya ke domain resmi institusi. 2) Pastikan API Gateway (ElysiaJS) selalu menyertakan header <code>Authorization: Bearer &lt;token&gt;</code> "
        "saat meminta berkas gambar naskah melalui rute <code>/api/v1/images/{filename}</code>. "
        "3) Nilai <code>MAX_FILE_SIZE_MB</code> dapat disesuaikan berkala sesuai batas throughput bandwidth jaringan kampus.",
        body_style
    ))

    # Build Document
    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"PDF Dokumentasi berhasil dibuat: {filename}")

if __name__ == "__main__":
    default_dest = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../dokumentasi/Dokumentasi_Penguatan_Keamanan_dan_Privasi_AI_Service.pdf"))
    out_path = sys.argv[1] if len(sys.argv) > 1 else default_dest
    build_pdf(out_path)
