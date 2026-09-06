/**
 * Runtime configuration for the standalone Baileys service.
 *
 * Everything secret comes from environment variables (see .env.example).
 * Nothing here is ever logged — callers must treat the returned object,
 * especially `apiKey`, as sensitive.
 */
import dotenv from "dotenv";

dotenv.config();

export interface BaileysServiceConfig {
  port: number;
  apiKey: string;
  authDir: string;
  logLevel: string;
}

function parsePort(raw: string | undefined): number {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 && n <= 65_535 ? Math.floor(n) : 8081;
}

export function loadConfig(env: Record<string, string | undefined> = process.env): BaileysServiceConfig {
  const apiKey = (env.BAILEYS_API_KEY ?? "").trim();
  if (!apiKey) {
    throw new Error("BAILEYS_API_KEY is required (see .env.example). Refusing to start unauthenticated.");
  }
  return {
    port: parsePort(env.PORT),
    apiKey,
    authDir: (env.BAILEYS_AUTH_DIR ?? "./auth").trim() || "./auth",
    logLevel: (env.LOG_LEVEL ?? "warn").trim() || "warn",
  };
}
