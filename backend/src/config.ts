export const CONFIG = {
  PORT: process.env.PORT ? parseInt(process.env.PORT) : 3000,
  DATABASE_URL: process.env.DATABASE_URL || "",
  DIRECT_URL: process.env.DIRECT_URL || "",
  JWT_SECRET: process.env.JWT_SECRET || "super-secret-key-at-least-32-characters-long",
  FASTAPI_SERVICE_URL: process.env.FASTAPI_SERVICE_URL || "http://127.0.0.1:8000",
  NODE_ENV: process.env.NODE_ENV || "development"
};
