import os
import re
import shutil
import logging
import tempfile
import gdown
from typing import List, Callable, Optional

logger = logging.getLogger("AI-Service")

class CloudDownloader:
    """
    Modul pengunduh naskah akademik dari repositori cloud (Google Drive).
    Mendukung pengunduhan folder naskah publik secara rekursif serta
    melakukan verifikasi integritas format PDF sebelum diproses oleh pipeline.
    """

    @staticmethod
    def extract_folder_id(target: str) -> Optional[str]:
        """
        Mengekstrak ID folder Google Drive dari string URL atau ID mentah.
        """
        if not target or not isinstance(target, str):
            return None
            
        target = target.strip()
        
        # Pola URL folder Google Drive standar
        match_folder = re.search(r'drive\.google\.com/drive/(?:u/\d+/)?folders/([a-zA-Z0-9_-]+)', target)
        if match_folder:
            return match_folder.group(1)
            
        # Pola URL open?id=
        match_id = re.search(r'drive\.google\.com/open\?id=([a-zA-Z0-9_-]+)', target)
        if match_id:
            return match_id.group(1)
            
        # Jika masukan berupa ID alfa-numerik Google Drive langsung (panjang >= 15 karakter)
        if re.match(r'^[a-zA-Z0-9_-]{15,60}$', target):
            return target
            
        return None

    @staticmethod
    def is_valid_pdf(file_path: str) -> bool:
        """
        Memverifikasi bahwa berkas merupakan dokumen PDF valid berdasarkan magic bytes (%PDF-).
        """
        try:
            if not os.path.exists(file_path) or os.path.getsize(file_path) < 100:
                return False
            with open(file_path, "rb") as f:
                header = f.read(5)
                return header == b"%PDF-"
        except Exception as e:
            logger.warning(f"Kegagalan verifikasi PDF {file_path}: {e}")
            return False

    def download_folder(
        self, 
        target: str, 
        dest_dir: Optional[str] = None, 
        progress_callback: Optional[Callable[[str, int], None]] = None
    ) -> List[str]:
        """
        Mengunduh seluruh naskah PDF dari target folder Google Drive ke direktori tujuan.
        
        Args:
            target: URL folder Google Drive atau Folder ID.
            dest_dir: Direktori tujuan penyimpanan sementara. Jika None, dibuatkan temp directory.
            progress_callback: Fungsi callback untuk melaporkan status pemrosesan (pesan, persentase).
            
        Returns:
            List path berkas PDF yang valid dan siap diekstraksi.
        """
        folder_id = self.extract_folder_id(target)
        if not folder_id:
            raise ValueError(f"Target tidak valid sebagai Folder Google Drive: {target}")

        if dest_dir is None:
            dest_dir = tempfile.mkdtemp(prefix="cloud_seeding_")
            
        os.makedirs(dest_dir, exist_ok=True)
        folder_url = f"https://drive.google.com/drive/folders/{folder_id}"
        logger.info(f"Memulai pengunduhan repositori cloud dari URL: {folder_url} ke direktori: {dest_dir}")

        if progress_callback:
            progress_callback(f"Menghubungkan ke repositori Google Drive (Folder ID: {folder_id[:8]}...)", 10)

        valid_pdf_files: List[str] = []

        try:
            # Tahap 1: Dapatkan daftar berkas tanpa mengunduh seluruh isi (skip_download=True)
            # Ini mencegah pengunduhan berkas non-PDF (seperti model weights .safetensors 1GB+)
            logger.info(f"Mengambil metadata isi folder Google Drive {folder_id}...")
            file_items = gdown.download_folder(
                id=folder_id,
                skip_download=True,
                use_cookies=False,
                quiet=True
            )

            pdf_items = [f for f in (file_items or []) if hasattr(f, "path") and f.path.lower().endswith(".pdf")]
            logger.info(f"Ditemukan {len(pdf_items)} berkas PDF dari total {len(file_items or [])} berkas pada folder.")

            if pdf_items:
                # Batasi hingga 25 naskah PDF teratas per sesi ingesti untuk performa optimal
                selected_items = pdf_items[:25]
                logger.info(f"Memproses {len(selected_items)} naskah PDF acuan...")
                for idx, item in enumerate(selected_items):
                    clean_filename = os.path.basename(item.path)
                    target_file_path = os.path.join(dest_dir, clean_filename)
                    if progress_callback:
                        pct = 10 + int(((idx + 1) / len(selected_items)) * 14)
                        progress_callback(f"Mengunduh naskah ({idx+1}/{len(selected_items)}): {clean_filename[:35]}...", pct)
                    
                    try:
                        gdown.download(id=item.id, output=target_file_path, quiet=True, use_cookies=False)
                        if self.is_valid_pdf(target_file_path):
                            valid_pdf_files.append(target_file_path)
                    except Exception as item_err:
                        logger.warning(f"Gagal mengunduh berkas {clean_filename}: {item_err}")
            else:
                logger.info("Tidak ditemukan item PDF spesifik melalui pemindaian awal, mencoba unduh folder langsung...")
                gdown.download_folder(
                    id=folder_id,
                    output=dest_dir,
                    quiet=True,
                    use_cookies=False
                )

        except Exception as e:
            logger.error(f"Gagal mengunduh folder Google Drive via folder ID: {e}")
            # Coba fallback individual file jika target ternyata berkas tunggal
            try:
                single_target = os.path.join(dest_dir, f"document_{folder_id}.pdf")
                gdown.download(id=folder_id, output=single_target, quiet=True, use_cookies=False)
                if self.is_valid_pdf(single_target):
                    valid_pdf_files.append(single_target)
            except Exception as ex_single:
                logger.error(f"Fallback pengunduhan berkas tunggal juga gagal: {ex_single}")

        if progress_callback:
            progress_callback("Memindai dan memverifikasi integritas berkas PDF hasil unduhan...", 25)

        # Pemindaian rekursif tambahan di direktori tujuan jika belum ada berkas valid
        if not valid_pdf_files:
            for root, _, files in os.walk(dest_dir):
                for file in files:
                    if file.lower().endswith(".pdf"):
                        full_path = os.path.join(root, file)
                        if self.is_valid_pdf(full_path):
                            valid_pdf_files.append(full_path)
                        else:
                            logger.warning(f"Berkas diabaikan karena bukan PDF valid: {full_path}")

        logger.info(f"Ditemukan {len(valid_pdf_files)} berkas PDF valid untuk diproses.")
        return valid_pdf_files

    @staticmethod
    def cleanup_directory(directory_path: str) -> None:
        """
        Membersihkan direktori temporer setelah seluruh proses ekstraksi dan ingesti selesai.
        """
        try:
            if directory_path and os.path.exists(directory_path) and "cloud_seeding_" in directory_path:
                shutil.rmtree(directory_path, ignore_errors=True)
                logger.info(f"Direktori temporer seeding berhasil dibersihkan: {directory_path}")
        except Exception as e:
            logger.warning(f"Gagal membersihkan direktori {directory_path}: {e}")
