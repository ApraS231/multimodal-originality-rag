import os
import sys
import subprocess
import time
import signal

# Menyimpan referensi ke subproses
processes = []

def terminate_processes(sig=None, frame=None):
    """Menghentikan semua subproses secara bersih saat diinterupsi."""
    print("\n[Orchestrator] Menghentikan semua layanan...")
    for p in processes:
        if p.poll() is None:
            try:
                # Mengirim sinyal penghentian di Windows
                p.terminate()
                p.wait(timeout=3)
            except Exception:
                p.kill()
    print("[Orchestrator] Semua layanan dihentikan. Keluar.")
    sys.exit(0)

# Daftarkan penanganan interupsi
signal.signal(signal.SIGINT, terminate_processes)
signal.signal(signal.SIGTERM, terminate_processes)

def main():
    root_dir = os.path.dirname(os.path.abspath(__file__))
    
    ai_service_dir = os.path.join(root_dir, "AI-service")
    backend_dir = os.path.join(root_dir, "backend")
    frontend_dir = os.path.join(root_dir, "frontend")

    print("=================================================================")
    print("      Sistem Deteksi Orisinalitas STITEK Bontang Orchestrator    ")
    print("=================================================================")
    print("[Orchestrator] Menyiapkan peluncuran layanan paralel...")

    # 1. Menjalankan AI Service (FastAPI + Uvicorn)
    # Gunakan python virtual environment di Windows jika terdeteksi
    venv_python = os.path.join(ai_service_dir, "venv", "Scripts", "python")
    venv_uvicorn = os.path.join(ai_service_dir, "venv", "Scripts", "uvicorn")
    
    if os.path.exists(venv_uvicorn + ".exe"):
        ai_cmd = f'"{venv_uvicorn}" app.main:app --host 127.0.0.1 --port 8000 --reload'
    elif os.path.exists(venv_python + ".exe"):
        ai_cmd = f'"{venv_python}" -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload'
    else:
        ai_cmd = "uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload"

    print(f"[Orchestrator] Menjalankan AI-Service via CLI: {ai_cmd}")
    p_ai = subprocess.Popen(
        ai_cmd,
        cwd=ai_service_dir,
        shell=True
    )
    processes.append(p_ai)

    # Beri jeda agar uvicorn siap
    time.sleep(2)

    # 2. Menjalankan ElysiaJS Bun Backend
    backend_cmd = "bun --watch src/index.ts"
    print(f"[Orchestrator] Menjalankan Bun Backend via CLI: {backend_cmd}")
    p_backend = subprocess.Popen(
        backend_cmd,
        cwd=backend_dir,
        shell=True
    )
    processes.append(p_backend)

    # 3. Menjalankan Vite React Frontend
    frontend_cmd = "npm run dev"
    print(f"[Orchestrator] Menjalankan Vite Frontend via CLI: {frontend_cmd}")
    p_frontend = subprocess.Popen(
        frontend_cmd,
        cwd=frontend_dir,
        shell=True
    )
    processes.append(p_frontend)

    print("\n[Orchestrator] Semua layanan sedang berjalan paralel!")
    print("[Orchestrator] Tekan Ctrl+C untuk menghentikan seluruh proses secara bersamaan.\n")

    # Loop penantian agar orchestrator tetap aktif
    try:
        while True:
            # Periksa jika ada subproses yang mati mendadak
            for idx, p in enumerate(processes):
                if p.poll() is not None:
                    name = ["AI-Service", "Backend", "Frontend"][idx]
                    print(f"\n[Warning] Layanan {name} telah berhenti dengan exit code {p.returncode}")
                    terminate_processes()
            time.sleep(1)
    except KeyboardInterrupt:
        terminate_processes()

if __name__ == "__main__":
    main()
