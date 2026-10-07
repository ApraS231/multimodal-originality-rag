# =========================================================================
# DOCKERFILE: Bun + ElysiaJS API Gateway (Production Ready)
# =========================================================================
FROM oven/bun:1-slim AS runner

WORKDIR /app

# Instalasi openssl dan curl untuk engine biner Prisma dan healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Salin berkas definisi dependensi
COPY package.json bun.lock ./

# Instalasi dependensi
RUN bun install

# Salin konfigurasi dan skema Prisma terlebih dahulu untuk kompilasi client
COPY prisma ./prisma
COPY prisma.config.ts ./

# Generate Prisma ORM Client untuk database PostgreSQL Supabase
RUN bunx prisma generate

# Salin seluruh kode sumber backend
COPY . .

# Konfigurasi variabel lingkungan produksi
ENV NODE_ENV=production
ENV PORT=3000

# Ekspos port API Gateway
EXPOSE 3000

# Pemeriksaan kesehatan endpoint /api/health
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://127.0.0.1:3000/api/health || exit 1

CMD ["bun", "run", "src/index.ts"]
