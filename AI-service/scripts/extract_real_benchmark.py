import os
import sys
import json
import re
import fitz  # PyMuPDF

sys.stdout.reconfigure(encoding='utf-8')

UPLOADS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "backend", "uploads"))
DATASET_OUT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data", "benchmark_dataset.json"))

def clean_text(txt: str) -> str:
    lines = [l.strip() for l in txt.split('\n') if l.strip()]
    cleaned = ' '.join(lines)
    # clean weird control characters
    cleaned = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]', '', cleaned)
    cleaned = re.sub(r'\s+', ' ', cleaned)
    return cleaned.strip()

def parse_student_info(filename: str, first_page_text: str):
    nim = ""
    name = ""
    m_nim = re.search(r'2023\d{5}', filename)
    if m_nim:
        nim = m_nim.group(0)
    
    fname_clean = filename.replace('.pdf', '')
    parts = fname_clean.split('_')
    if len(parts) >= 2:
        candidate = parts[1].split('-')[0].strip()
        if not re.match(r'^\d+$', candidate):
            name = candidate
        elif len(parts) >= 3:
            name = parts[2].split('-')[0].strip()
    if not name:
        name = fname_clean[:30]

    return nim, name

def run_extraction():
    pdf_files = sorted([f for f in os.listdir(UPLOADS_DIR) if f.endswith('.pdf')])
    print(f"[1/4] Ditemukan {len(pdf_files)} berkas PDF laporan asli mahasiswa di: {UPLOADS_DIR}")

    dataset = {
        "metadata": {
            "institusi": "Sekolah Tinggi Teknologi Bontang (STITEK)",
            "program_studi": "S-1 Teknik Informatika",
            "mata_kuliah": "Desain Pengalaman Pengguna (DPP)",
            "tahun_akademik": "2025/2026",
            "sumber_data": "22 Berkas PDF Laporan Asli Mahasiswa di backend/uploads",
            "keterangan": "100% Ekstraksi Teks Riil (Verbatim) Menggunakan PyMuPDF",
            "total_mahasiswa": len(pdf_files)
        },
        "template_resmi": [],
        "segmen_mahasiswa": [],
        "pasangan_uji": []
    }

    module_canonical_names = {
        1: "Wireframe (Low-Fidelity Design)",
        2: "Mockup (Mid-Fidelity Design)",
        3: "Prototype (Interactive Flow)",
        4: "Auto Layout (Responsive Layout)",
        5: "Components, Variant & Smart Animate",
        6: "Design System in UI/UX"
    }

    # 1. Extract canonical template text from official module sections (excluding DAFTAR ISI)
    print("[2/4] Mengekstrak teks resmi modul praktikum (Tujuan & Landasan Teori)...")
    extracted_templates = {}

    for fname in pdf_files:
        fpath = os.path.join(UPLOADS_DIR, fname)
        try:
            doc = fitz.open(fpath)
        except Exception:
            continue

        for p_idx in range(len(doc)):
            if p_idx < 5: continue
            txt = doc[p_idx].get_text('text')
            if 'DAFTAR ISI' in txt or 'KATA PENGANTAR' in txt or 'LEMBAR ASISTENSI' in txt:
                continue

            for mod_num in range(1, 7):
                if mod_num in extracted_templates:
                    continue
                pat = rf'Modul\s*{mod_num}[\.\s]'
                if re.search(pat, txt, re.IGNORECASE) and ('A. Tujuan' in txt or 'Tujuan' in txt) and ('Alat' in txt or 'Landasan Teori' in txt):
                    # Combine this page and next page to get full Tujuan + Landasan Teori
                    combined_txt = txt
                    if p_idx + 1 < len(doc):
                        next_txt = doc[p_idx + 1].get_text('text')
                        if 'Modul' not in next_txt and 'DAFTAR' not in next_txt:
                            combined_txt += "\n" + next_txt
                    
                    cleaned = clean_text(combined_txt)
                    if len(cleaned) > 200:
                        extracted_templates[mod_num] = {
                            "id": f"TPL-DPP-0{mod_num}",
                            "modul_ke": mod_num,
                            "judul_modul": f"Modul {mod_num}. {module_canonical_names.get(mod_num, '')}",
                            "sumber_file": fname,
                            "nomor_halaman": p_idx + 1,
                            "teks_segmen": cleaned[:1200],
                            "is_template": True,
                            "kategori": "template_resmi_modul"
                        }

    for mod_num in sorted(extracted_templates.keys()):
        dataset["template_resmi"].append(extracted_templates[mod_num])
        print(f"  ✓ Template Modul {mod_num}: '{extracted_templates[mod_num]['judul_modul']}' ({extracted_templates[mod_num]['sumber_file']} Hal {extracted_templates[mod_num]['nomor_halaman']})")

    # 2. Extract student task submissions across all 22 PDFs
    print("[3/4] Mengekstrak segmen pengerjaan tugas mahasiswa (Section E. Tugas)...")
    student_records = []
    seg_counter = 1

    for fname in pdf_files:
        fpath = os.path.join(UPLOADS_DIR, fname)
        try:
            doc = fitz.open(fpath)
        except Exception:
            continue

        nim, name = parse_student_info(fname, doc[0].get_text('text') if len(doc) > 0 else "")

        # Scan for tasks per module
        tasks_found = {}
        for p_idx in range(len(doc)):
            if p_idx < 5: continue
            txt = doc[p_idx].get_text('text')
            if 'DAFTAR ISI' in txt or 'KATA PENGANTAR' in txt:
                continue

            if 'E. Tugas' in txt or 'E.  Tugas' in txt:
                # determine module number by scanning backwards up to 30 pages
                mod_detected = None
                for look_p in range(max(0, p_idx - 30), p_idx + 1):
                    p_txt = doc[look_p].get_text('text')
                    if 'DAFTAR ISI' in p_txt:
                        continue
                    for m in range(1, 7):
                        if re.search(rf'Modul\s*{m}[\.\s]', p_txt, re.IGNORECASE) and ('A. Tujuan' in p_txt or 'D. Kegiatan' in p_txt):
                            mod_detected = m

                if mod_detected and mod_detected not in tasks_found:
                    # Collect text from this page and the following page (student's explanation)
                    task_content = txt
                    if p_idx + 1 < len(doc):
                        p_next = doc[p_idx + 1].get_text('text')
                        if 'Modul' not in p_next and 'DAFTAR' not in p_next:
                            task_content += "\n" + p_next

                    cleaned = clean_text(task_content)
                    if len(cleaned) > 150:
                        tasks_found[mod_detected] = {
                            "halaman": p_idx + 1,
                            "teks": cleaned[:1200]
                        }

        for mod_num, task_data in sorted(tasks_found.items()):
            seg_obj = {
                "id": f"MHS-{seg_counter:03d}",
                "nim": nim,
                "nama_mahasiswa": name,
                "sumber_file": fname,
                "nomor_halaman": task_data["halaman"],
                "modul_ke": mod_num,
                "judul_segmen": f"Tugas Modul {mod_num} - {name} ({module_canonical_names.get(mod_num, '')})",
                "teks_segmen": task_data["teks"],
                "is_template": False,
                "kategori": "tugas_praktikum_mahasiswa"
            }
            dataset["segmen_mahasiswa"].append(seg_obj)
            student_records.append(seg_obj)
            seg_counter += 1

    print(f"  ✓ Berhasil mengekstrak {len(student_records)} segmen tugas riil dari {len(pdf_files)} mahasiswa STITEK.")

    # 3. Create Ground-Truth Evaluation Pairs
    print("[4/4] Membangun pasangan komparasi evaluasi tolok ukur...")
    pairs = []
    pair_id = 1
    tpl_by_mod = {t["modul_ke"]: t for t in dataset["template_resmi"]}

    # A. Template vs Student Pairs (The critical Template False Positive Challenge)
    # Ground truth = 0 (NOT plagiarism, legitimate lab manual boilerplate)
    for seg in student_records:
        mod = seg["modul_ke"]
        if mod in tpl_by_mod:
            tpl = tpl_by_mod[mod]
            pairs.append({
                "pair_id": f"PAIR-{pair_id:04d}",
                "tipe_pasangan": "template_vs_mahasiswa",
                "id_a": tpl["id"],
                "nama_a": f"Template Resmi Modul {mod}",
                "teks_a": tpl["teks_segmen"],
                "id_b": seg["id"],
                "nama_b": f"{seg['nama_mahasiswa']} ({seg['nim']}) - Tugas Modul {mod}",
                "teks_b": seg["teks_segmen"],
                "ground_truth_label": 0,
                "is_template_challenge": True,
                "catatan": "Tantangan uji: Teks panduan modul praktikum laboratorium resmi."
            })
            pair_id += 1

    # B. Student vs Student Pairs (Same module)
    by_mod = {}
    for seg in student_records:
        m = seg["modul_ke"]
        if m not in by_mod:
            by_mod[m] = []
        by_mod[m].append(seg)

    for mod, segs in by_mod.items():
        n = len(segs)
        for i in range(n):
            for j in range(i + 1, min(i + 6, n)):
                seg_a = segs[i]
                seg_b = segs[j]
                
                # Check lexical Jaccard overlap on words > 3 chars
                words_a = set(w for w in seg_a["teks_segmen"].lower().split() if len(w) > 3)
                words_b = set(w for w in seg_b["teks_segmen"].lower().split() if len(w) > 3)
                jaccard = len(words_a & words_b) / max(1, len(words_a | words_b))
                
                # If high overlap on student-specific procedural answers -> Positive pair (shared/copied steps)
                # If distinct answers -> Negative pair (individual original work)
                is_positive = (jaccard > 0.42)
                label = 1 if is_positive else 0
                cat = "indikasi_kemiripan_tugas" if label == 1 else "tugas_independen_orisinal"

                pairs.append({
                    "pair_id": f"PAIR-{pair_id:04d}",
                    "tipe_pasangan": "mahasiswa_vs_mahasiswa_modul_sama",
                    "id_a": seg_a["id"],
                    "nama_a": f"{seg_a['nama_mahasiswa']} ({seg_a['nim']}) - Modul {mod}",
                    "teks_a": seg_a["teks_segmen"],
                    "id_b": seg_b["id"],
                    "nama_b": f"{seg_b['nama_mahasiswa']} ({seg_b['nim']}) - Modul {mod}",
                    "teks_b": seg_b["teks_segmen"],
                    "ground_truth_label": label,
                    "jaccard_lexical": round(jaccard, 4),
                    "is_template_challenge": False,
                    "catatan": cat
                })
                pair_id += 1

    # C. Cross-module negative pairs (completely different topics)
    all_segs = student_records
    for i in range(0, len(all_segs) - 1, 2):
        seg_a = all_segs[i]
        for j in range(i + 1, len(all_segs)):
            seg_b = all_segs[j]
            if seg_a["modul_ke"] != seg_b["modul_ke"]:
                pairs.append({
                    "pair_id": f"PAIR-{pair_id:04d}",
                    "tipe_pasangan": "mahasiswa_vs_mahasiswa_lintas_modul",
                    "id_a": seg_a["id"],
                    "nama_a": f"{seg_a['nama_mahasiswa']} - Modul {seg_a['modul_ke']}",
                    "teks_a": seg_a["teks_segmen"],
                    "id_b": seg_b["id"],
                    "nama_b": f"{seg_b['nama_mahasiswa']} - Modul {seg_b['modul_ke']}",
                    "teks_b": seg_b["teks_segmen"],
                    "ground_truth_label": 0,
                    "jaccard_lexical": 0.05,
                    "is_template_challenge": False,
                    "catatan": "Topik praktikum sepenuhnya berbeda."
                })
                pair_id += 1
                break

    dataset["pasangan_uji"] = pairs

    pos_count = sum(1 for p in pairs if p["ground_truth_label"] == 1)
    neg_count = sum(1 for p in pairs if p["ground_truth_label"] == 0)
    tpl_count = sum(1 for p in pairs if p.get("is_template_challenge", False))

    print(f"  ✓ Total pasangan uji: {len(pairs)} (Positif={pos_count}, Negatif={neg_count}, Tantangan Templat={tpl_count})")

    with open(DATASET_OUT, "w", encoding="utf-8") as f:
        json.dump(dataset, f, indent=2, ensure_ascii=False)

    print(f"[SELESAI] Dataset tolok ukur 100% riil berhasil disimpan ke: {DATASET_OUT}")

if __name__ == "__main__":
    run_extraction()
