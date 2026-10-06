-- CreateTable
CREATE TABLE "program_studi" (
    "id_program_studi" TEXT NOT NULL,
    "nama_prodi" TEXT NOT NULL,

    CONSTRAINT "program_studi_pkey" PRIMARY KEY ("id_program_studi")
);

-- CreateTable
CREATE TABLE "kelas" (
    "id_kelas" TEXT NOT NULL,
    "nama_kelas" TEXT NOT NULL,
    "id_program_studi" TEXT NOT NULL,

    CONSTRAINT "kelas_pkey" PRIMARY KEY ("id_kelas")
);

-- CreateTable
CREATE TABLE "mata_kuliah" (
    "id_mata_kuliah" TEXT NOT NULL,
    "nama_matkul" TEXT NOT NULL,

    CONSTRAINT "mata_kuliah_pkey" PRIMARY KEY ("id_mata_kuliah")
);

-- CreateTable
CREATE TABLE "pengguna" (
    "id_pengguna" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "kata_sandi" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "tanggal_dibuat" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pengguna_pkey" PRIMARY KEY ("id_pengguna")
);

-- CreateTable
CREATE TABLE "profil_pengguna" (
    "id_profil" TEXT NOT NULL,
    "id_pengguna" TEXT NOT NULL,
    "peran" TEXT NOT NULL DEFAULT 'ASLAB',
    "nim" TEXT,
    "kode_aslab" TEXT,
    "kode_kalab" TEXT,
    "tanggal_dibuat" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "profil_pengguna_pkey" PRIMARY KEY ("id_profil")
);

-- CreateTable
CREATE TABLE "sesi" (
    "id_sesi" TEXT NOT NULL,
    "id_pengguna" TEXT NOT NULL,
    "tanggal_kedaluwarsa" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sesi_pkey" PRIMARY KEY ("id_sesi")
);

-- CreateTable
CREATE TABLE "laporan" (
    "id_laporan" TEXT NOT NULL,
    "nama_mahasiswa" TEXT,
    "nim" TEXT,
    "tahun_akademik" INTEGER NOT NULL,
    "tautan_berkas" TEXT NOT NULL,
    "skor_orisinalitas" DECIMAL(5,2) NOT NULL,
    "skor_plagiarisme" DECIMAL(5,2) NOT NULL,
    "skor_orisinalitas_koreksi" DECIMAL(5,2),
    "nilai_huruf" TEXT,
    "apakah_diverifikasi" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "id_verifikator" TEXT,
    "id_program_studi" TEXT NOT NULL,
    "id_kelas" TEXT NOT NULL,
    "id_mata_kuliah" TEXT NOT NULL,
    "id_pengunggah" TEXT NOT NULL,
    "tanggal_dibuat" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "laporan_pkey" PRIMARY KEY ("id_laporan")
);

-- CreateTable
CREATE TABLE "laporan_gambar" (
    "id_laporan_gambar" TEXT NOT NULL,
    "lokasi_gambar" TEXT NOT NULL,
    "nomor_halaman" INTEGER NOT NULL,
    "id_vektor_qdrant" TEXT NOT NULL,
    "id_laporan" TEXT NOT NULL,

    CONSTRAINT "laporan_gambar_pkey" PRIMARY KEY ("id_laporan_gambar")
);

-- CreateTable
CREATE TABLE "penggunaan_token" (
    "id_penggunaan_token" TEXT NOT NULL,
    "nama_model" TEXT NOT NULL,
    "token_input" INTEGER NOT NULL,
    "token_output" INTEGER NOT NULL,
    "total_token" INTEGER NOT NULL,
    "estimasi_biaya" DECIMAL(10,5) NOT NULL,
    "id_laporan" TEXT,
    "id_program_studi" TEXT NOT NULL,
    "tanggal_dibuat" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "penggunaan_token_pkey" PRIMARY KEY ("id_penggunaan_token")
);

-- CreateTable
CREATE TABLE "aktivitas_admin" (
    "id_aktivitas_admin" TEXT NOT NULL,
    "id_aktor" TEXT NOT NULL,
    "jenis_tindakan" TEXT NOT NULL,
    "entitas_target" TEXT NOT NULL,
    "deskripsi" TEXT NOT NULL,
    "alamat_ip" TEXT NOT NULL,
    "agen_pengguna" TEXT NOT NULL,
    "tanggal_dibuat" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "aktivitas_admin_pkey" PRIMARY KEY ("id_aktivitas_admin")
);

-- CreateTable
CREATE TABLE "konfigurasi_sistem" (
    "id_konfigurasi" TEXT NOT NULL DEFAULT 'global',
    "nama_model_ai" TEXT NOT NULL DEFAULT 'groq/llama3-8b-8192',
    "kunci_api_gemini" TEXT,
    "kunci_api_openai" TEXT,
    "kunci_api_groq" TEXT,
    "tautan_supabase" TEXT,
    "kunci_api_supabase" TEXT,
    "kunci_api_qdrant" TEXT,
    "kunci_kustom" JSONB,
    "rrf_k" INTEGER NOT NULL DEFAULT 60,
    "prompt_sistem" TEXT NOT NULL,
    "batas_unggahan" INTEGER NOT NULL DEFAULT 30,
    "batas_pesan" INTEGER NOT NULL DEFAULT 50,
    "tanggal_diperbarui" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "konfigurasi_sistem_pkey" PRIMARY KEY ("id_konfigurasi")
);

-- CreateTable
CREATE TABLE "sesi_obrolan" (
    "id_sesi_obrolan" TEXT NOT NULL,
    "judul_sesi" TEXT NOT NULL,
    "id_pengguna" TEXT NOT NULL,
    "id_laporan" TEXT,
    "tanggal_dibuat" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tanggal_diperbarui" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sesi_obrolan_pkey" PRIMARY KEY ("id_sesi_obrolan")
);

-- CreateTable
CREATE TABLE "pesan_obrolan" (
    "id_pesan_obrolan" TEXT NOT NULL,
    "id_sesi_obrolan" TEXT NOT NULL,
    "pengirim" TEXT NOT NULL,
    "teks" TEXT NOT NULL,
    "tanggal_dibuat" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pesan_obrolan_pkey" PRIMARY KEY ("id_pesan_obrolan")
);

-- CreateTable
CREATE TABLE "penggunaan_chatbot" (
    "id_penggunaan_chatbot" TEXT NOT NULL,
    "id_pengguna" TEXT NOT NULL,
    "jumlah" INTEGER NOT NULL DEFAULT 0,
    "tanggal" TEXT NOT NULL,
    "tanggal_dibuat" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "penggunaan_chatbot_pkey" PRIMARY KEY ("id_penggunaan_chatbot")
);

-- CreateIndex
CREATE UNIQUE INDEX "program_studi_nama_prodi_key" ON "program_studi"("nama_prodi");

-- CreateIndex
CREATE UNIQUE INDEX "mata_kuliah_nama_matkul_key" ON "mata_kuliah"("nama_matkul");

-- CreateIndex
CREATE UNIQUE INDEX "pengguna_email_key" ON "pengguna"("email");

-- CreateIndex
CREATE UNIQUE INDEX "profil_pengguna_id_pengguna_key" ON "profil_pengguna"("id_pengguna");

-- CreateIndex
CREATE UNIQUE INDEX "penggunaan_chatbot_id_pengguna_tanggal_key" ON "penggunaan_chatbot"("id_pengguna", "tanggal");

-- AddForeignKey
ALTER TABLE "kelas" ADD CONSTRAINT "kelas_id_program_studi_fkey" FOREIGN KEY ("id_program_studi") REFERENCES "program_studi"("id_program_studi") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profil_pengguna" ADD CONSTRAINT "profil_pengguna_id_pengguna_fkey" FOREIGN KEY ("id_pengguna") REFERENCES "pengguna"("id_pengguna") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sesi" ADD CONSTRAINT "sesi_id_pengguna_fkey" FOREIGN KEY ("id_pengguna") REFERENCES "pengguna"("id_pengguna") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "laporan" ADD CONSTRAINT "laporan_id_verifikator_fkey" FOREIGN KEY ("id_verifikator") REFERENCES "pengguna"("id_pengguna") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "laporan" ADD CONSTRAINT "laporan_id_program_studi_fkey" FOREIGN KEY ("id_program_studi") REFERENCES "program_studi"("id_program_studi") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "laporan" ADD CONSTRAINT "laporan_id_kelas_fkey" FOREIGN KEY ("id_kelas") REFERENCES "kelas"("id_kelas") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "laporan" ADD CONSTRAINT "laporan_id_mata_kuliah_fkey" FOREIGN KEY ("id_mata_kuliah") REFERENCES "mata_kuliah"("id_mata_kuliah") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "laporan" ADD CONSTRAINT "laporan_id_pengunggah_fkey" FOREIGN KEY ("id_pengunggah") REFERENCES "pengguna"("id_pengguna") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "laporan_gambar" ADD CONSTRAINT "laporan_gambar_id_laporan_fkey" FOREIGN KEY ("id_laporan") REFERENCES "laporan"("id_laporan") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "penggunaan_token" ADD CONSTRAINT "penggunaan_token_id_laporan_fkey" FOREIGN KEY ("id_laporan") REFERENCES "laporan"("id_laporan") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "penggunaan_token" ADD CONSTRAINT "penggunaan_token_id_program_studi_fkey" FOREIGN KEY ("id_program_studi") REFERENCES "program_studi"("id_program_studi") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aktivitas_admin" ADD CONSTRAINT "aktivitas_admin_id_aktor_fkey" FOREIGN KEY ("id_aktor") REFERENCES "pengguna"("id_pengguna") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sesi_obrolan" ADD CONSTRAINT "sesi_obrolan_id_pengguna_fkey" FOREIGN KEY ("id_pengguna") REFERENCES "pengguna"("id_pengguna") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sesi_obrolan" ADD CONSTRAINT "sesi_obrolan_id_laporan_fkey" FOREIGN KEY ("id_laporan") REFERENCES "laporan"("id_laporan") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pesan_obrolan" ADD CONSTRAINT "pesan_obrolan_id_sesi_obrolan_fkey" FOREIGN KEY ("id_sesi_obrolan") REFERENCES "sesi_obrolan"("id_sesi_obrolan") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "penggunaan_chatbot" ADD CONSTRAINT "penggunaan_chatbot_id_pengguna_fkey" FOREIGN KEY ("id_pengguna") REFERENCES "pengguna"("id_pengguna") ON DELETE CASCADE ON UPDATE CASCADE;
