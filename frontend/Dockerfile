# =========================================================================
# STAGE 1: Build React SPA Bundle menggunakan Node 20 / Bun
# =========================================================================
FROM oven/bun:1-alpine AS builder

WORKDIR /app

# Salin berkas definisi dependensi
COPY package.json bun.lock ./

# Instalasi dependensi
RUN bun install

# Salin seluruh kode sumber frontend
COPY . .

# Argument build untuk URL backend (secara default diarahkan ke reverse proxy /api)
ARG VITE_API_BACKEND_URL=/api
ENV VITE_API_BACKEND_URL=$VITE_API_BACKEND_URL

# Kompilasi bundel produksi (HTML, JS, CSS, Font KaTeX)
RUN bun run build

# =========================================================================
# STAGE 2: Web Server Produksi Ringan Berbasis Nginx Alpine
# =========================================================================
FROM nginx:1.25-alpine AS runner

# Hapus konfigurasi bawaan Nginx
RUN rm -rf /etc/nginx/conf.d/*

# Salin konfigurasi kustom Nginx (SPA fallback + Reverse Proxy API + SSE Support)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Salin hasil kompilasi statis dari Stage 1
COPY --from=builder /app/dist /usr/share/nginx/html

# Ekspos port standar HTTP
EXPOSE 80

# Healthcheck untuk memastikan Nginx melayani halaman utama
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget -q --spider http://127.0.0.1/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
