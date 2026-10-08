import { Elysia } from 'elysia'
import { cors } from '@elysiajs/cors'
import { jwt } from '@elysiajs/jwt'
import { rateLimit } from 'elysia-rate-limit'
import { CONFIG } from './config'
import { authRouter } from './api/auth'
import { adminRouter } from './api/admin'
import { reportsRouter } from './api/reports'
import { seedingRouter } from './api/seeding'
import { chatbotRouter } from './api/chatbot'
import { startQueue } from './lib/queue'
import { registerAnalyzeWorker } from './workers/analyze'
import { registerSeedingWorker } from './workers/seeding'

const app = new Elysia()
  .use(cors({
    origin: true,
    credentials: true
  }))
  .use(rateLimit({
    duration: 60000, // 1 menit
    max: 60 // Maksimal 60 request per IP per menit
  }))
  .use(
    jwt({
      name: 'jwt',
      secret: CONFIG.JWT_SECRET
    })
  )
  .use(authRouter)
  .use(adminRouter)
  .use(reportsRouter)
  .use(seedingRouter)
  .use(chatbotRouter)
  .get('/', () => ({ status: 'running', service: 'ElysiaJS Backend API Gateway' }))
  .listen(CONFIG.PORT)

console.log(`🦊 Elysia Backend is running at ${app.server?.hostname}:${app.server?.port}`)

// Jalankan background queue pg-boss dan worker
startQueue().then(() => {
  registerAnalyzeWorker();
  registerSeedingWorker();
}).catch(err => {
  console.error("❌ Gagal menyalakan antrean pg-boss:", err);
});

// Tangkap uncaught errors agar process gateway tidak runtuh bila terjadi network glitch pada database pool
process.on('uncaughtException', (err) => {
  console.warn("⚠️ Intercepted Uncaught Exception:", err?.message || err);
});

process.on('unhandledRejection', (reason) => {
  console.warn("⚠️ Intercepted Unhandled Rejection:", reason);
});

export type App = typeof app
