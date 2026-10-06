import { LRUCache } from 'lru-cache'

const options = {
  max: 500, // Simpan maksimal 500 session/config aktif
  ttl: 1000 * 60 * 15 // Time to live: 15 menit
}

export const sessionCache = new LRUCache<string, any>(options)
export const chatbotConfigCache = new LRUCache<string, any>(options)
export const systemConfigCache = new LRUCache<string, any>(options)
