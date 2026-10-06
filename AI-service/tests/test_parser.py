import pytest
import fitz
from app.core.parser import parse_document, extract_cover_metadata

def create_dummy_digital_pdf() -> bytes:
    """
    Membuat buffer PDF digital secara programatis berisi teks penanda.
    """
    doc = fitz.open()
    page = doc.new_page(width=595, height=842) # A4 Standard points
    
    # Menulis halaman cover
    page.insert_text((50, 100), "LAPORAN PRAKTIKUM BAS DATA", fontsize=20)
    page.insert_text((50, 150), "Disusun oleh: Alvin", fontsize=14)
    page.insert_text((50, 180), "NIM: 22001", fontsize=14)
    
    # Halaman 2 isi
    page2 = doc.new_page(width=595, height=842)
    page2.insert_text((50, 100), "Ini adalah halaman isi laporan dengan teks digital terstruktur.", fontsize=12)
    
    pdf_bytes = doc.write()
    doc.close()
    return pdf_bytes

def create_dummy_scanned_pdf() -> bytes:
    """
    Membuat buffer PDF hasil scan secara programatis.
    Teks dirender ke Pixmap (raster) lalu dimasukkan sebagai gambar murni ke PDF baru.
    """
    # 1. Buat PDF sementara untuk digambar teksnya
    temp_doc = fitz.open()
    temp_page = temp_doc.new_page(width=595, height=842)
    temp_page.insert_text((50, 100), "Cover Laporan", fontsize=20)
    temp_page.insert_text((50, 150), "Nama: Budi Santoso", fontsize=14)
    temp_page.insert_text((50, 180), "NIM: 99002", fontsize=14)
    temp_page.insert_text((50, 250), "Halaman ini disorot menggunakan EasyOCR fallback.", fontsize=12)
    
    # Render halaman sementara menjadi gambar
    pix = temp_page.get_pixmap(dpi=150)
    png_bytes = pix.tobytes("png")
    temp_doc.close()
    
    # 2. Masukkan gambar tadi ke PDF murni baru (scanned PDF)
    scanned_doc = fitz.open()
    scanned_page = scanned_doc.new_page(width=595, height=842)
    scanned_page.insert_image(scanned_page.rect, stream=png_bytes)
    
    scanned_pdf_bytes = scanned_doc.write()
    scanned_doc.close()
    return scanned_pdf_bytes

def test_extract_cover_metadata():
    # Uji regex nama dan NIM
    text = "LAPORAN PRAKTIKUM\nDisusun oleh : Alvin\nNIM: 22001\nSTITEK"
    meta = extract_cover_metadata(text)
    assert meta["mahasiswa_nama"] == "Alvin"
    assert meta["nim"] == "22001"
    
    # Uji format cover variasi 2
    text2 = "Tugas Akhir\nNama : Budi Santoso\nNRP : 99002"
    meta2 = extract_cover_metadata(text2)
    assert meta2["mahasiswa_nama"] == "Budi Santoso"
    assert meta2["nim"] == "99002"

def test_parse_digital_document():
    # Buat PDF digital dummy
    pdf_bytes = create_dummy_digital_pdf()
    
    # Jalankan parser
    result = parse_document(pdf_bytes)
    
    # Verifikasi data ekstraksi
    assert result["ocr_fallback_active"] is False
    assert result["metadata_extracted"]["mahasiswa_nama"] == "Alvin"
    assert result["metadata_extracted"]["nim"] == "22001"
    
    # Verifikasi halaman
    assert len(result["pages"]) == 2
    assert "LAPORAN" in result["pages"][0]["text"]
    
    # Pastikan koordinat kata terekstrak
    assert len(result["pages"][0]["words_with_geometry"]) > 0
    first_word = result["pages"][0]["words_with_geometry"][0]
    assert "text" in first_word
    assert "x1" in first_word
    assert "x2" in first_word

def test_parse_scanned_document():
    # Buat scanned PDF dummy
    pdf_bytes = create_dummy_scanned_pdf()
    
    # Jalankan parser
    result = parse_document(pdf_bytes)
    
    # Verifikasi fallback OCR aktif
    assert result["ocr_fallback_active"] is True
    assert result["metadata_extracted"]["mahasiswa_nama"] == "Budi Santoso"
    assert result["metadata_extracted"]["nim"] == "99002"
    
    # Verifikasi koordinat spasial
    assert len(result["pages"][0]["words_with_geometry"]) > 0
