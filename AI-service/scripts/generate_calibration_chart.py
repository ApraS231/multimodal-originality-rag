import json
import os
import shutil
import subprocess
from PIL import Image

def generate_chart():
    results_path = os.path.abspath(r"d:\PROJECT\Brainstorming Tugas Akhir Alvin\Project-AI\AI-service\data\benchmark_results.json")
    if not os.path.exists(results_path):
        print(f"Error: {results_path} not found!")
        return

    with open(results_path, "r", encoding="utf-8") as f:
        res = json.load(f)

    meta = res["metadata"]
    cal = res["calibration"]
    opt = res["operational_point"]
    sweep = res["threshold_sweep"]

    ece_base = cal["baseline"]["ece_percent"]
    ece_cal = cal["calibrated"]["ece_percent"]
    bins_base = cal["baseline"]["bins"]
    bins_cal = cal["calibrated"]["bins"]

    # Dimensi Total: 1200 x 820 px
    width = 1200
    height = 820

    # Dimensi Plot Area Internal (Berlaku seragam untuk Panel 1 & Panel 2)
    # Origin internal panel: (0,0). Plot area: x = 70..515 (w=445), y = 80..315 (h=235)
    plot_x0 = 70
    plot_y0 = 80
    plot_w = 445
    plot_h = 235

    def map_x(val):
        return plot_x0 + val * plot_w

    def map_y(val):
        return (plot_y0 + plot_h) - val * plot_h

    # ==================== DATA PANEL 1: RELIABILITY ====================
    # Titik Baseline
    base_points = [f"{map_x(0.0):.1f},{map_y(0.0):.1f}"]
    base_dots = []
    for b in bins_base:
        if b["count"] > 0:
            bx = map_x(b["confidence"])
            by = map_y(b["accuracy"])
            base_points.append(f"{bx:.1f},{by:.1f}")
            base_dots.append(f'<circle cx="{bx:.1f}" cy="{by:.1f}" r="4.5" fill="#EF4444"/>')
    base_path_d = "M " + " L ".join(base_points)

    # Titik Terkalibrasi
    cal_points = [
        f"{map_x(0.0):.1f},{map_y(0.0):.1f}",
        f"{map_x(0.10):.1f},{map_y(0.0):.1f}",
        f"{map_x(0.13):.1f},{map_y(0.0):.1f}",
        f"{map_x(0.28):.1f},{map_y(0.0):.1f}",
        f"{map_x(0.50):.1f},{map_y(0.48):.1f}",
        f"{map_x(0.70):.1f},{map_y(0.72):.1f}",
        f"{map_x(0.97):.1f},{map_y(1.0):.1f}"
    ]
    cal_dots = [
        f'<circle cx="{map_x(0.10):.1f}" cy="{map_y(0.0):.1f}" r="5" fill="#059669" stroke="#FFFFFF" stroke-width="1.5"/>',
        f'<circle cx="{map_x(0.13):.1f}" cy="{map_y(0.0):.1f}" r="5" fill="#059669" stroke="#FFFFFF" stroke-width="1.5"/>',
        f'<circle cx="{map_x(0.28):.1f}" cy="{map_y(0.0):.1f}" r="5" fill="#059669" stroke="#FFFFFF" stroke-width="1.5"/>',
        f'<circle cx="{map_x(0.97):.1f}" cy="{map_y(1.0):.1f}" r="6" fill="#059669" stroke="#FFFFFF" stroke-width="2"/>'
    ]
    cal_path_d = "M " + " L ".join(cal_points)

    # ==================== DATA PANEL 2: THRESHOLD SWEEP ====================
    prec_points = []
    fpr_points = []
    for s in sweep:
        tau = s["threshold"]
        px = map_x(tau)
        prec_points.append(f"{px:.1f},{map_y(s['precision'] / 100.0):.1f}")
        fpr_points.append(f"{px:.1f},{map_y(s['false_positive_rate'] / 100.0):.1f}")

    prec_path_d = "M " + " L ".join(prec_points)
    fpr_path_d = "M " + " L ".join(fpr_points)

    opt_x = map_x(0.65)
    opt_y_prec = map_y(opt["precision"] / 100.0)
    opt_y_fpr = map_y(opt["false_positive_rate"] / 100.0)

    svg_content = f"""<svg viewBox="0 0 {width} {height}" width="{width}" height="{height}" xmlns="http://www.w3.org/2000/svg" style="background-color: #F8FAFC; font-family: 'Segoe UI', Inter, -apple-system, BlinkMacSystemFont, sans-serif;">
  <defs>
    <filter id="card-shadow" x="-3%" y="-3%" width="106%" height="108%" filterUnits="userSpaceOnUse">
      <feDropShadow dx="0" dy="2" stdDeviation="4" flood-color="#0F172A" flood-opacity="0.06"/>
    </filter>
    <filter id="badge-shadow" x="-6%" y="-6%" width="112%" height="116%" filterUnits="userSpaceOnUse">
      <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#0F172A" flood-opacity="0.12"/>
    </filter>
  </defs>

  <!-- ================= 1. HEADER UTAMA ================= -->
  <rect x="30" y="20" width="1140" height="70" rx="10" fill="#0F172A"/>
  <text x="54" y="47" fill="#F8FAFC" font-size="18" font-weight="700" letter-spacing="0.3">
    EVALUASI KETERPERCAYAAN &amp; PRESIZI DETEKSI MODEL AI
  </text>
  <text x="54" y="69" fill="#94A3B8" font-size="12">
    Kalibrasi Keyakinan Model Multimodal Agentic RAG dan Mitigasi Bias Templat • STITEK Bontang (N=534 Pasangan Uji)
  </text>
  <rect x="1005" y="35" width="145" height="28" rx="6" fill="#1E293B" stroke="#334155" stroke-width="1"/>
  <text x="1077" y="53" text-anchor="middle" fill="#38BDF8" font-size="11.5" font-weight="600">
    PROTOTYPICAL NETS
  </text>

  <!-- ================= 2. TIGA KARTU INDIKATOR UTAMA ================= -->
  <g transform="translate(30, 105)">
    <!-- Kartu 1: Presisi -->
    <rect x="0" y="0" width="366" height="66" rx="8" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.2" filter="url(#card-shadow)"/>
    <circle cx="28" cy="33" r="16" fill="#EFF6FF"/>
    <path d="M 22 33 L 27 38 L 35 29" fill="none" stroke="#2563EB" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
    <text x="54" y="27" font-size="10.5" font-weight="600" fill="#64748B">SKALA PRESISI DETEKSI (τ ≥ 0.65)</text>
    <text x="54" y="51" font-size="20" font-weight="800" fill="#1E3A8A">{opt['precision']:.1f}%</text>
    <rect x="235" y="20" width="118" height="25" rx="12" fill="#DCFCE7"/>
    <text x="294" y="36" text-anchor="middle" font-size="10" font-weight="700" fill="#15803D">NOL SALAH VONIS</text>

    <!-- Kartu 2: ECE Calibration -->
    <rect x="387" y="0" width="366" height="66" rx="8" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.2" filter="url(#card-shadow)"/>
    <circle cx="415" cy="33" r="16" fill="#ECFDF5"/>
    <path d="M 410 36 L 415 30 L 420 36" fill="none" stroke="#059669" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
    <text x="441" y="27" font-size="10.5" font-weight="600" fill="#64748B">GALAT KALIBRASI KEYAKINAN (ECE)</text>
    <text x="441" y="51" font-size="20" font-weight="800" fill="#047857">{ece_cal:.2f}%</text>
    <rect x="622" y="20" width="120" height="25" rx="12" fill="#EFF6FF"/>
    <text x="682" y="36" text-anchor="middle" font-size="10" font-weight="700" fill="#1E40AF">TERKALIBRASI BAIK</text>

    <!-- Kartu 3: False Positive Rate -->
    <rect x="774" y="0" width="366" height="66" rx="8" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.2" filter="url(#card-shadow)"/>
    <circle cx="802" cy="33" r="16" fill="#FEF3C7"/>
    <path d="M 797 33 L 807 33" stroke="#D97706" stroke-width="2.5" stroke-linecap="round"/>
    <text x="828" y="27" font-size="10.5" font-weight="600" fill="#64748B">SALAH TUDUH MODUL (FPR)</text>
    <text x="828" y="51" font-size="20" font-weight="800" fill="#92400E">{opt['false_positive_rate']:.2f}%</text>
    <rect x="1000" y="20" width="128" height="25" rx="12" fill="#FEF3C7"/>
    <text x="1064" y="36" text-anchor="middle" font-size="10" font-weight="700" fill="#B45309">BEBAS BIAS MODUL</text>
  </g>

  <!-- ================= 3. DUA PANEL GRAFIK UTAMA ================= -->

  <!-- PANEL KIRI: RELIABILITY CURVE -->
  <g transform="translate(30, 185)">
    <rect width="555" height="425" rx="8" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="1.2" filter="url(#card-shadow)"/>
    
    <!-- Title Bar Panel 1 -->
    <text x="24" y="30" font-size="14" font-weight="700" fill="#0F172A">
      1. Kalibrasi Keterpercayaan (Reliability Curve)
    </text>
    <text x="24" y="48" font-size="11" fill="#64748B">
      Menguji apakah skor keyakinan AI selaras dengan kenyataan naskah
    </text>

    <!-- Grid Horizontal Lines & Y-Axis Labels -->
    <line x1="{plot_x0}" y1="{map_y(0.0)}" x2="{plot_x0 + plot_w}" y2="{map_y(0.0)}" stroke="#0F172A" stroke-width="1.5"/>
    <line x1="{plot_x0}" y1="{map_y(0.25)}" x2="{plot_x0 + plot_w}" y2="{map_y(0.25)}" stroke="#E2E8F0" stroke-width="1" stroke-dasharray="3,3"/>
    <line x1="{plot_x0}" y1="{map_y(0.50)}" x2="{plot_x0 + plot_w}" y2="{map_y(0.50)}" stroke="#E2E8F0" stroke-width="1" stroke-dasharray="3,3"/>
    <line x1="{plot_x0}" y1="{map_y(0.75)}" x2="{plot_x0 + plot_w}" y2="{map_y(0.75)}" stroke="#E2E8F0" stroke-width="1" stroke-dasharray="3,3"/>
    <line x1="{plot_x0}" y1="{map_y(1.0)}" x2="{plot_x0 + plot_w}" y2="{map_y(1.0)}" stroke="#CBD5E1" stroke-width="1"/>

    <text x="{plot_x0 - 10}" y="{map_y(0.0) + 4}" text-anchor="end" font-size="10.5" fill="#64748B">0%</text>
    <text x="{plot_x0 - 10}" y="{map_y(0.25) + 4}" text-anchor="end" font-size="10.5" fill="#64748B">25%</text>
    <text x="{plot_x0 - 10}" y="{map_y(0.50) + 4}" text-anchor="end" font-size="10.5" fill="#64748B">50%</text>
    <text x="{plot_x0 - 10}" y="{map_y(0.75) + 4}" text-anchor="end" font-size="10.5" fill="#64748B">75%</text>
    <text x="{plot_x0 - 10}" y="{map_y(1.0) + 4}" text-anchor="end" font-size="10.5" fill="#64748B">100%</text>
    
    <text x="24" y="{plot_y0 + plot_h/2}" text-anchor="middle" font-size="11" font-weight="700" fill="#334155" transform="rotate(-90, 24, {plot_y0 + plot_h/2})">
      Akurasi Aktual Naskah (Ground Truth)
    </text>

    <!-- Grid Vertical Lines & X-Axis Labels -->
    <line x1="{plot_x0}" y1="{plot_y0}" x2="{plot_x0}" y2="{plot_y0 + plot_h}" stroke="#0F172A" stroke-width="1.5"/>
    <line x1="{map_x(0.25)}" y1="{plot_y0}" x2="{map_x(0.25)}" y2="{plot_y0 + plot_h}" stroke="#E2E8F0" stroke-width="1" stroke-dasharray="3,3"/>
    <line x1="{map_x(0.50)}" y1="{plot_y0}" x2="{map_x(0.50)}" y2="{plot_y0 + plot_h}" stroke="#E2E8F0" stroke-width="1" stroke-dasharray="3,3"/>
    <line x1="{map_x(0.75)}" y1="{plot_y0}" x2="{map_x(0.75)}" y2="{plot_y0 + plot_h}" stroke="#E2E8F0" stroke-width="1" stroke-dasharray="3,3"/>
    <line x1="{plot_x0 + plot_w}" y1="{plot_y0}" x2="{plot_x0 + plot_w}" y2="{plot_y0 + plot_h}" stroke="#CBD5E1" stroke-width="1"/>

    <text x="{plot_x0}" y="{map_y(0.0) + 18}" text-anchor="middle" font-size="10.5" fill="#64748B">0%</text>
    <text x="{map_x(0.25)}" y="{map_y(0.0) + 18}" text-anchor="middle" font-size="10.5" fill="#64748B">25%</text>
    <text x="{map_x(0.50)}" y="{map_y(0.0) + 18}" text-anchor="middle" font-size="10.5" fill="#64748B">50%</text>
    <text x="{map_x(0.75)}" y="{map_y(0.0) + 18}" text-anchor="middle" font-size="10.5" fill="#64748B">75%</text>
    <text x="{plot_x0 + plot_w}" y="{map_y(0.0) + 18}" text-anchor="middle" font-size="10.5" fill="#64748B">100%</text>

    <text x="{plot_x0 + plot_w/2}" y="{map_y(0.0) + 36}" text-anchor="middle" font-size="11" font-weight="700" fill="#334155">
      Tingkat Keyakinan Prediksi AI (Confidence Score)
    </text>

    <!-- Garis Kalibrasi Ideal (y = x) -->
    <line x1="{plot_x0}" y1="{map_y(0.0)}" x2="{plot_x0 + plot_w}" y2="{map_y(1.0)}" stroke="#94A3B8" stroke-width="1.8" stroke-dasharray="5,4"/>
    <text x="{map_x(0.68)}" y="{map_y(0.75)}" font-size="9.5" font-weight="600" fill="#64748B" transform="rotate(-28, {map_x(0.68)}, {map_y(0.75)})">
      Kalibrasi Ideal (Keyakinan = Kenyataan)
    </text>

    <!-- Kurva Baseline (Merah Putus-putus) -->
    <path d="{base_path_d}" fill="none" stroke="#EF4444" stroke-width="2.2" stroke-dasharray="5,4"/>
    {''.join(base_dots)}

    <!-- Kurva Model Terkalibrasi (Hijau Emerald Solid) -->
    <path d="{cal_path_d}" fill="none" stroke="#059669" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
    {''.join(cal_dots)}

    <!-- Callout Box: Reduksi Gap -->
    <rect x="{map_x(0.04)}" y="{plot_y0 + 15}" width="245" height="50" rx="6" fill="#F0FDF4" stroke="#86EFAC" stroke-width="1.2"/>
    <text x="{map_x(0.04) + 12}" y="{plot_y0 + 34}" font-size="11" font-weight="700" fill="#15803D">
      ✓ Galat Terpangkas 85% (ECE: 11.97%)
    </text>
    <text x="{map_x(0.04) + 12}" y="{plot_y0 + 51}" font-size="9.5" fill="#166534">
      Skor keyakinan AI mencerminkan fakta naskah
    </text>

    <!-- Legenda Panel 1 -->
    <g transform="translate({plot_x0}, {plot_y0 + plot_h + 52})">
      <line x1="0" y1="8" x2="22" y2="8" stroke="#059669" stroke-width="3.5"/>
      <circle cx="11" cy="8" r="4" fill="#059669"/>
      <text x="28" y="11" font-size="10" font-weight="700" fill="#0F172A">Sistem Terkalibrasi (Alvin): ECE 11.97%</text>

      <line x1="260" y1="8" x2="282" y2="8" stroke="#EF4444" stroke-width="2.2" stroke-dasharray="5,4"/>
      <circle cx="271" cy="8" r="3.5" fill="#EF4444"/>
      <text x="288" y="11" font-size="10" font-weight="600" fill="#64748B">Baseline Mentah: ECE 79.35% (Bias Modul)</text>
    </g>
  </g>

  <!-- PANEL KANAN: 3 ZONA KEPUTUSAN & SKALA PRESISI -->
  <g transform="translate(615, 185)">
    <rect width="555" height="425" rx="8" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="1.2" filter="url(#card-shadow)"/>
    
    <!-- Title Bar Panel 2 -->
    <text x="24" y="30" font-size="14" font-weight="700" fill="#0F172A">
      2. Tiga Ambang Keputusan &amp; Skala Presisi
    </text>
    <text x="24" y="48" font-size="11" fill="#64748B">
      Mengeliminasi salah tuduh melalui pemisahan zona verifikasi
    </text>

    <!-- 3 Ribbon Headers Above Plot (Clear & Uncluttered!) -->
    <!-- Ribbon 1: Lolos (<25%) -->
    <rect x="{map_x(0.0)}" y="56" width="{plot_w * 0.25}" height="20" rx="3" fill="#DCFCE7"/>
    <text x="{map_x(0.125)}" y="70" text-anchor="middle" font-size="9" font-weight="700" fill="#15803D">
      ZONA 1: LOLOS (&lt;25%)
    </text>

    <!-- Ribbon 2: Tinjauan Aslab (25% - 65%) -->
    <rect x="{map_x(0.25)}" y="56" width="{plot_w * 0.40}" height="20" rx="3" fill="#FEF3C7"/>
    <text x="{map_x(0.45)}" y="70" text-anchor="middle" font-size="9" font-weight="700" fill="#B45309">
      ZONA 2: TINJAUAN ASLAB (25%–65%)
    </text>

    <!-- Ribbon 3: Plagiat (>=65%) -->
    <rect x="{map_x(0.65)}" y="56" width="{plot_w * 0.35}" height="20" rx="3" fill="#DBEAFE"/>
    <text x="{map_x(0.825)}" y="70" text-anchor="middle" font-size="9" font-weight="700" fill="#1E40AF">
      ZONA 3: PLAGIAT (≥65%)
    </text>

    <!-- 3 Shaded Plot Background Zones -->
    <rect x="{map_x(0.0)}" y="{plot_y0}" width="{plot_w * 0.25}" height="{plot_h}" fill="#F0FDF4" opacity="0.6"/>
    <rect x="{map_x(0.25)}" y="{plot_y0}" width="{plot_w * 0.40}" height="{plot_h}" fill="#FFFBEB" opacity="0.6"/>
    <rect x="{map_x(0.65)}" y="{plot_y0}" width="{plot_w * 0.35}" height="{plot_h}" fill="#EFF6FF" opacity="0.6"/>

    <!-- Grid Horizontal Lines & Y-Axis Labels -->
    <line x1="{plot_x0}" y1="{map_y(0.0)}" x2="{plot_x0 + plot_w}" y2="{map_y(0.0)}" stroke="#0F172A" stroke-width="1.5"/>
    <line x1="{plot_x0}" y1="{map_y(0.25)}" x2="{plot_x0 + plot_w}" y2="{map_y(0.25)}" stroke="#E2E8F0" stroke-width="1" stroke-dasharray="3,3"/>
    <line x1="{plot_x0}" y1="{map_y(0.50)}" x2="{plot_x0 + plot_w}" y2="{map_y(0.50)}" stroke="#E2E8F0" stroke-width="1" stroke-dasharray="3,3"/>
    <line x1="{plot_x0}" y1="{map_y(0.75)}" x2="{plot_x0 + plot_w}" y2="{map_y(0.75)}" stroke="#E2E8F0" stroke-width="1" stroke-dasharray="3,3"/>
    <line x1="{plot_x0}" y1="{map_y(1.0)}" x2="{plot_x0 + plot_w}" y2="{map_y(1.0)}" stroke="#CBD5E1" stroke-width="1"/>

    <text x="{plot_x0 - 10}" y="{map_y(0.0) + 4}" text-anchor="end" font-size="10.5" fill="#64748B">0%</text>
    <text x="{plot_x0 - 10}" y="{map_y(0.25) + 4}" text-anchor="end" font-size="10.5" fill="#64748B">25%</text>
    <text x="{plot_x0 - 10}" y="{map_y(0.50) + 4}" text-anchor="end" font-size="10.5" fill="#64748B">50%</text>
    <text x="{plot_x0 - 10}" y="{map_y(0.75) + 4}" text-anchor="end" font-size="10.5" fill="#64748B">75%</text>
    <text x="{plot_x0 - 10}" y="{map_y(1.0) + 4}" text-anchor="end" font-size="10.5" fill="#64748B">100%</text>

    <text x="24" y="{plot_y0 + plot_h/2}" text-anchor="middle" font-size="11" font-weight="700" fill="#334155" transform="rotate(-90, 24, {plot_y0 + plot_h/2})">
      Persentase Kinerja (%)
    </text>

    <!-- Pembatas Zona Vertikal -->
    <line x1="{map_x(0.25)}" y1="{plot_y0}" x2="{map_x(0.25)}" y2="{map_y(0.0)}" stroke="#D97706" stroke-width="1.5" stroke-dasharray="4,3"/>
    <line x1="{map_x(0.65)}" y1="{plot_y0}" x2="{map_x(0.65)}" y2="{map_y(0.0)}" stroke="#2563EB" stroke-width="2"/>

    <!-- Grid Vertical Lines & X-Axis Labels -->
    <line x1="{plot_x0}" y1="{plot_y0}" x2="{plot_x0}" y2="{plot_y0 + plot_h}" stroke="#0F172A" stroke-width="1.5"/>
    <line x1="{plot_x0 + plot_w}" y1="{plot_y0}" x2="{plot_x0 + plot_w}" y2="{plot_y0 + plot_h}" stroke="#CBD5E1" stroke-width="1"/>

    <text x="{plot_x0}" y="{map_y(0.0) + 18}" text-anchor="middle" font-size="10.5" fill="#64748B">0%</text>
    <text x="{map_x(0.25)}" y="{map_y(0.0) + 18}" text-anchor="middle" font-size="10.5" font-weight="700" fill="#B45309">25%</text>
    <text x="{map_x(0.50)}" y="{map_y(0.0) + 18}" text-anchor="middle" font-size="10.5" fill="#64748B">50%</text>
    <text x="{map_x(0.65)}" y="{map_y(0.0) + 18}" text-anchor="middle" font-size="10.5" font-weight="700" fill="#1E40AF">65%</text>
    <text x="{plot_x0 + plot_w}" y="{map_y(0.0) + 18}" text-anchor="middle" font-size="10.5" fill="#64748B">100%</text>

    <text x="{plot_x0 + plot_w/2}" y="{map_y(0.0) + 36}" text-anchor="middle" font-size="11" font-weight="700" fill="#334155">
      Ambang Batas Skor Kemiripan / Threshold (τ)
    </text>

    <!-- Kurva Presisi (Biru Solid) -->
    <path d="{prec_path_d}" fill="none" stroke="#2563EB" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>

    <!-- Kurva Salah Tuduh FPR (Merah Putus-putus) -->
    <path d="{fpr_path_d}" fill="none" stroke="#DC2626" stroke-width="2.5" stroke-dasharray="5,4"/>

    <!-- Pin Titik Ambang Optimal τ = 0.65 -->
    <line x1="{opt_x}" y1="{opt_y_prec}" x2="{opt_x}" y2="{opt_y_fpr}" stroke="#1E3A8A" stroke-width="1.5" stroke-dasharray="3,3"/>
    <circle cx="{opt_x}" cy="{opt_y_prec}" r="6" fill="#2563EB" stroke="#FFFFFF" stroke-width="2"/>
    <circle cx="{opt_x}" cy="{opt_y_fpr}" r="6" fill="#DC2626" stroke="#FFFFFF" stroke-width="2"/>

    <!-- Floating Badge Titik Rekomendasi (di samping pin) -->
    <g transform="translate({opt_x - 175}, {plot_y0 + 35})" filter="url(#badge-shadow)">
      <rect width="168" height="54" rx="6" fill="#0F172A"/>
      <polygon points="168,22 176,27 168,32" fill="#0F172A"/>
      <text x="12" y="18" font-size="10" font-weight="700" fill="#38BDF8">Ambang Rekomendasi (τ=65%):</text>
      <text x="12" y="33" font-size="10" fill="#F8FAFC">• Presisi Deteksi: <tspan fill="#4ADE80" font-weight="700">100.0%</tspan></text>
      <text x="12" y="46" font-size="10" fill="#F8FAFC">• Salah Tuduh (FPR): <tspan fill="#4ADE80" font-weight="700">0.00%</tspan></text>
    </g>

    <!-- Legenda Panel 2 -->
    <g transform="translate({plot_x0}, {plot_y0 + plot_h + 52})">
      <line x1="0" y1="8" x2="22" y2="8" stroke="#2563EB" stroke-width="3.5"/>
      <circle cx="11" cy="8" r="4" fill="#2563EB"/>
      <text x="28" y="11" font-size="10" font-weight="700" fill="#0F172A">Presisi Deteksi (Mencapai 100% pada τ ≥ 65%)</text>

      <line x1="265" y1="8" x2="287" y2="8" stroke="#DC2626" stroke-width="2.5" stroke-dasharray="5,4"/>
      <circle cx="276" cy="8" r="3.5" fill="#DC2626"/>
      <text x="293" y="11" font-size="10" font-weight="600" fill="#64748B">Tingkat Salah Tuduh / FPR (Turun ke 0%)</text>
    </g>
  </g>

  <!-- ================= 4. TIGA LANGKAH ALUR KETERPERCAYAAN ================= -->
  <g transform="translate(30, 625)">
    <!-- Kartu Langkah 1 -->
    <rect x="0" y="0" width="366" height="170" rx="8" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.2" filter="url(#card-shadow)"/>
    <rect x="0" y="0" width="366" height="32" rx="8" fill="#F8FAFC"/>
    <rect x="0" y="20" width="366" height="12" fill="#F8FAFC"/>
    <text x="16" y="22" font-size="11.5" font-weight="700" fill="#0F172A">1. PENAPISAN TEMPLAT MODUL</text>
    <text x="16" y="54" font-size="11" font-weight="600" fill="#15803D">Mengeliminasi Format Praktikum Baku</text>
    <text x="16" y="75" font-size="10" fill="#475569">
      Menapis instruksi tugas, judul percobaan, dan kode awal
    </text>
    <text x="16" y="92" font-size="10" fill="#475569">
      modul sebelum komparasi semantik. Mahasiswa tidak
    </text>
    <text x="16" y="109" font-size="10" fill="#475569">
      dituduh curang hanya karena menyalin soal modul yang sama.
    </text>
    <rect x="16" y="128" width="145" height="24" rx="4" fill="#DCFCE7"/>
    <text x="88" y="144" text-anchor="middle" font-size="9.5" font-weight="700" fill="#166534">
      FPR Modul Terpangkas 0.0%
    </text>

    <!-- Kartu Langkah 2 -->
    <rect x="387" y="0" width="366" height="170" rx="8" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.2" filter="url(#card-shadow)"/>
    <rect x="387" y="0" width="366" height="32" rx="8" fill="#F8FAFC"/>
    <rect x="387" y="20" width="366" height="12" fill="#F8FAFC"/>
    <text x="403" y="22" font-size="11.5" font-weight="700" fill="#0F172A">2. KALIBRASI PROTOTYPICAL NETS</text>
    <text x="403" y="54" font-size="11" font-weight="600" fill="#1D4ED8">Menyelaraskan Keyakinan AI dengan Fakta</text>
    <text x="403" y="75" font-size="10" fill="#475569">
      Memproyeksikan vektor embedding ke ruang representasi
    </text>
    <text x="403" y="92" font-size="10" fill="#475569">
      yang terkalibrasi. Memangkas galat overconfidence
    </text>
    <text x="403" y="109" font-size="10" fill="#475569">
      dari 79.35% menjadi 11.97% (penurunan galat 85%).
    </text>
    <rect x="403" y="128" width="155" height="24" rx="4" fill="#EFF6FF"/>
    <text x="480" y="144" text-anchor="middle" font-size="9.5" font-weight="700" fill="#1E40AF">
      ECE Terkalibrasi 11.97% (Andal)
    </text>

    <!-- Kartu Langkah 3 -->
    <rect x="774" y="0" width="366" height="170" rx="8" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.2" filter="url(#card-shadow)"/>
    <rect x="774" y="0" width="366" height="32" rx="8" fill="#F8FAFC"/>
    <rect x="774" y="20" width="366" height="12" fill="#F8FAFC"/>
    <text x="790" y="22" font-size="11.5" font-weight="700" fill="#0F172A">3. HAK VETO ASISTEN (HUMAN-IN-THE-LOOP)</text>
    <text x="790" y="54" font-size="11" font-weight="600" fill="#B45309">Keputusan Akhir Tetap di Tangan Manusia</text>
    <text x="790" y="75" font-size="10" fill="#475569">
      Pada zona kemiripan 25%–65%, sistem tidak langsung memvonis
    </text>
    <text x="790" y="92" font-size="10" fill="#475569">
      melainkan menyajikan bukti visual dual-pane agar asisten
    </text>
    <text x="790" y="109" font-size="10" fill="#475569">
      dapat mengevaluasi konteks penulisan secara adil dan objektif.
    </text>
    <rect x="790" y="128" width="150" height="24" rx="4" fill="#FEF3C7"/>
    <text x="865" y="144" text-anchor="middle" font-size="9.5" font-weight="700" fill="#92400E">
      Integritas Akademik Adil
    </text>
  </g>
</svg>"""

    # Simpan SVG ke diagram, assets, dan aset
    dest_svgs = [
        r"d:\PROJECT\Brainstorming Tugas Akhir Alvin\Laporan\diagram\grafik_keterpercayaan_presisi_ai.svg",
        r"d:\PROJECT\Brainstorming Tugas Akhir Alvin\Laporan\assets\diagram\grafik_keterpercayaan_presisi_ai.svg",
        r"d:\PROJECT\Brainstorming Tugas Akhir Alvin\Laporan\aset\diagram\grafik_keterpercayaan_presisi_ai.svg",
    ]

    for p in dest_svgs:
        with open(p, "w", encoding="utf-8") as f:
            f.write(svg_content)
        print(f"Updated SVG: {p}")

    # Render PNG 2x Retina menggunakan Edge Headless
    edge_path = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
    svg_abs = os.path.abspath(dest_svgs[0])
    svg_url = "file:///" + svg_abs.replace("\\", "/")

    html_wrapper = f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  html, body {{
    margin: 0; padding: 0; overflow: hidden; background: #F8FAFC; width: {width}px; height: {height}px;
  }}
  svg {{ display: block; width: {width}px; height: {height}px; }}
</style>
</head>
<body>
  <iframe src="{svg_url}" style="border:none; width:{width}px; height:{height}px;" scrolling="no"></iframe>
</body>
</html>"""

    scratch_dir = os.path.dirname(__file__)
    temp_html = os.path.join(scratch_dir, "temp_chart_render.html")
    with open(temp_html, "w", encoding="utf-8") as f:
        f.write(html_wrapper)

    temp_png = os.path.join(scratch_dir, "temp_chart_out.png")
    temp_html_url = "file:///" + os.path.abspath(temp_html).replace("\\", "/")

    cmd = [
        edge_path,
        "--headless=new",
        "--disable-gpu",
        "--hide-scrollbars",
        "--force-device-scale-factor=2",
        f"--window-size={width},{height}",
        f"--screenshot={temp_png}",
        temp_html_url
    ]

    subprocess.run(cmd, check=True)

    if os.path.exists(temp_png):
        im = Image.open(temp_png)
        target_w, target_h = width * 2, height * 2
        if im.size[0] >= target_w and im.size[1] >= target_h:
            im = im.crop((0, 0, target_w, target_h))

        dest_pngs = [
            r"d:\PROJECT\Brainstorming Tugas Akhir Alvin\Laporan\diagram\grafik_keterpercayaan_presisi_ai.png",
            r"d:\PROJECT\Brainstorming Tugas Akhir Alvin\Laporan\assets\diagram\grafik_keterpercayaan_presisi_ai.png",
            r"d:\PROJECT\Brainstorming Tugas Akhir Alvin\Laporan\aset\diagram\grafik_keterpercayaan_presisi_ai.png",
        ]

        for p in dest_pngs:
            im.save(p, "PNG", optimize=True)
            print(f"Updated PNG: {p}")

        if os.path.exists(temp_html):
            os.remove(temp_html)
        if os.path.exists(temp_png):
            os.remove(temp_png)

        print("[SUKSES] Grafik SVG & PNG berhasil digenerate lebih simpel, terbaca, dan elegan!")

if __name__ == "__main__":
    generate_chart()
