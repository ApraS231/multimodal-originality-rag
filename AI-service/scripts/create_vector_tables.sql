-- ==============================================================================
-- DDL Skema Vektor & Audit Pelatihan Sistem Deteksi Orisinalitas STITEK Bontang
-- Ekstensi: pgvector (skema extensions)
-- ==============================================================================

-- 1. Memastikan ekstensi vector aktif pada skema extensions
CREATE EXTENSION IF NOT EXISTS vector SCHEMA extensions;

-- 2. Tabel representasi vektor potongan teks laporan
CREATE TABLE IF NOT EXISTS public.laporan_text_vectors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_laporan TEXT NOT NULL,
    id_mata_kuliah TEXT,
    page_number INT,
    text TEXT NOT NULL,
    bounding_box JSONB,
    program_studi TEXT,
    mata_kuliah TEXT,
    tahun INT,
    author TEXT,
    is_template BOOLEAN DEFAULT FALSE,
    embedding extensions.vector(768),
    tanggal_dibuat TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Tabel representasi visual gambar/diagram laporan (CLIP)
CREATE TABLE IF NOT EXISTS public.laporan_image_vectors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_laporan TEXT NOT NULL,
    id_mata_kuliah TEXT,
    image_id TEXT,
    page_number INT,
    bounding_box JSONB,
    file_path TEXT,
    author TEXT,
    tahun INT,
    program_studi TEXT,
    mata_kuliah TEXT,
    source_file_name TEXT,
    embedding extensions.vector(512),
    tanggal_dibuat TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Tabel prototype centroid representasi mata kuliah
CREATE TABLE IF NOT EXISTS public.course_prototypes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_mata_kuliah TEXT NOT NULL,
    class_label TEXT NOT NULL,
    centroid extensions.vector(128),
    sample_count INT DEFAULT 0,
    last_trained_at TIMESTAMPTZ,
    model_version TEXT,
    UNIQUE(id_mata_kuliah, class_label)
);

-- 5. Tabel log audit pelatihan prototype & model
CREATE TABLE IF NOT EXISTS public.prototype_training_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_mata_kuliah TEXT NOT NULL,
    trigger_type TEXT,
    template_samples INT,
    original_samples INT,
    loss_before FLOAT,
    loss_after FLOAT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Indeks HNSW (Hierarchical Navigable Small World) untuk pencarian kemiripan kosinus teks
CREATE INDEX IF NOT EXISTS idx_text_vec_hnsw 
  ON public.laporan_text_vectors 
  USING hnsw (embedding extensions.vector_cosine_ops);

-- 7. Indeks HNSW untuk pencarian visual gambar (CLIP)
CREATE INDEX IF NOT EXISTS idx_image_vec_hnsw 
  ON public.laporan_image_vectors 
  USING hnsw (embedding extensions.vector_cosine_ops);

-- 8. Indeks GIN untuk pencarian leksikal cepat (Full-Text Search BM25/FTS)
CREATE INDEX IF NOT EXISTS idx_text_vec_fts 
  ON public.laporan_text_vectors 
  USING gin (to_tsvector('indonesian', text));

-- 9. Indeks relasional untuk percepatan filter naskah & mata kuliah
CREATE INDEX IF NOT EXISTS idx_text_vec_laporan ON public.laporan_text_vectors (id_laporan);
CREATE INDEX IF NOT EXISTS idx_text_vec_matkul ON public.laporan_text_vectors (id_mata_kuliah);
CREATE INDEX IF NOT EXISTS idx_image_vec_laporan ON public.laporan_image_vectors (id_laporan);
