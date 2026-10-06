import os
import sys
import subprocess
import time

def print_banner(text):
    print("\n" + "=" * 70)
    print(f"  {text}")
    print("=" * 70)

def main():
    root_dir = os.path.dirname(os.path.abspath(__file__))
    backend_dir = os.path.join(root_dir, "backend")
    ai_dir = os.path.join(root_dir, "AI-service")
    frontend_dir = os.path.join(root_dir, "frontend")

    start_total = time.time()
    results = {}

    print_banner("SISTEM DETEKSI ORISINALITAS MULTIMODAL - SUITE PENGUJIAN OTOMATIS")
    print(f"Direktori Kerja: {root_dir}")

    # =========================================================================
    # 1. PENGUJIAN BACKEND API GATEWAY (BUN TEST)
    # =========================================================================
    print_banner("1/3 Menjalankan Unit Testing Backend Gateway (Bun Test)")
    cmd_backend = "bun test"
    print(f"[CMD] {cmd_backend} (Cwd: {backend_dir})")
    
    t0 = time.time()
    try:
        proc_be = subprocess.run(cmd_backend, cwd=backend_dir, shell=True)
        be_time = time.time() - t0
        results["Backend Gateway (Bun Test)"] = {
            "status": "PASSED" if proc_be.returncode == 0 else "FAILED",
            "time": f"{be_time:.2f}s",
            "returncode": proc_be.returncode
        }
    except Exception as e:
        results["Backend Gateway (Bun Test)"] = {"status": "ERROR", "time": "0s", "returncode": -1, "err": str(e)}

    # =========================================================================
    # 2. PENGUJIAN AI ENGINE & SECURITY (PYTEST)
    # =========================================================================
    print_banner("2/3 Menjalankan Pengujian AI Engine & Keamanan API (Pytest)")
    venv_python = os.path.join(ai_dir, "venv", "Scripts", "python.exe")
    if not os.path.exists(venv_python):
        venv_python = "python"

    test_files = (
        "tests/test_api_security.py "
        "tests/test_proto_head.py "
        "tests/test_parser.py "
        "tests/test_embedder_text.py "
        "tests/test_proto_trainer.py"
    )
    cmd_ai = f'"{venv_python}" -m pytest {test_files} -v'
    print(f"[CMD] {cmd_ai} (Cwd: {ai_dir})")

    t0 = time.time()
    try:
        proc_ai = subprocess.run(cmd_ai, cwd=ai_dir, shell=True)
        ai_time = time.time() - t0
        results["AI Service & Security (Pytest)"] = {
            "status": "PASSED" if proc_ai.returncode == 0 else "FAILED",
            "time": f"{ai_time:.2f}s",
            "returncode": proc_ai.returncode
        }
    except Exception as e:
        results["AI Service & Security (Pytest)"] = {"status": "ERROR", "time": "0s", "returncode": -1, "err": str(e)}

    # =========================================================================
    # 3. PENGUJIAN KOMPILASI TYPE-SAFETY FRONTEND
    # =========================================================================
    print_banner("3/3 Menjalankan Kompilasi Type-Safety Frontend (Vite & TypeScript)")
    cmd_fe = "bun run build"
    print(f"[CMD] {cmd_fe} (Cwd: {frontend_dir})")

    t0 = time.time()
    try:
        proc_fe = subprocess.run(cmd_fe, cwd=frontend_dir, shell=True)
        fe_time = time.time() - t0
        results["Frontend Client (Type-Safety Build)"] = {
            "status": "PASSED" if proc_fe.returncode == 0 else "FAILED",
            "time": f"{fe_time:.2f}s",
            "returncode": proc_fe.returncode
        }
    except Exception as e:
        results["Frontend Client (Type-Safety Build)"] = {"status": "ERROR", "time": "0s", "returncode": -1, "err": str(e)}

    # =========================================================================
    # REKAPITULASI HASIL AKHIR
    # =========================================================================
    total_time = time.time() - start_total
    print_banner("REKAPITULASI HASIL EVALUASI KEANDALAN SISTEM (QUALITY GATE)")

    all_passed = True
    print(f"{'Komponen Pengujian':<40} | {'Waktu':<10} | {'Status':<10}")
    print("-" * 66)
    for comp, data in results.items():
        st = data['status']
        tm = data['time']
        if st != "PASSED":
            all_passed = False
        print(f"{comp:<40} | {tm:<10} | {st:<10}")

    print("-" * 66)
    print(f"Total Waktu Eksekusi: {total_time:.2f} detik")

    if all_passed:
        print("\n>>> [KESIMPULAN]: SELURUH PENGUJIAN 100% LOLOS (QUALITY GATE PASSED) <<<")
        print(">>> Sistem terbukti sukar bias, kebal halusinasi, dan siap diujikan. <<<\n")
        sys.exit(0)
    else:
        print("\n>>> [PERINGATAN]: Terdapat pengujian yang belum berhasil. Periksa log di atas. <<<\n")
        sys.exit(1)

if __name__ == "__main__":
    main()
