@echo off
title Eksekusi Pengujian Keandalan Sistem STITEK Bontang
echo =================================================================
echo        SISTEM DETEKSI ORISINALITAS MULTIMODAL STITEK BONTANG
echo             PENGUJIAN KEANDALAN: ANTI-BIAS & ANTI-HALUSINASI
echo =================================================================
cd /d "%~dp0"
python run_all_tests.py
pause
