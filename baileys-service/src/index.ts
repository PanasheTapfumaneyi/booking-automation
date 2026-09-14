/**
 * Entry point: loads config, starts the single WhatsApp session, serves HTTP.
 *
 * Binds to 127.0.0.1 only — local development. No tunnels, no public
 * exposure, no multi-session handling. On first run the linking QR is kept
 * in memory only and served as a PNG through the authenticated GET /qr
 * endpoint (terminal QR rendering is unreliable over remote shells); the QR
 * string is never printed, logged, returned as JSON, or written to disk.
 * Afterwards the persisted auth under BAILEYS_AUTH_DIR reconnects without
 * another scan.
 */
import pino from "pino";
import { loadConfig } from "./config.js";
import { createApp } from "./server.js";
import { WhatsAppConnection } from "./whatsapp.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const logger = pino<string>({ level: config.logLevel });

  // Latest linking QR, memory only. Cleared once the socket reports open.
  let latestQr: string | null = null;

  const connection = new WhatsAppConnection({
    authDir: config.authDir,
    logger,
    onQr: (qr: string) => {
      // Store only — never print or log the QR contents.
      latestQr = qr;
      logger.info("WhatsApp linking QR is available through the protected /qr endpoint");
    },
    onConnected: () => {
      latestQr = null;
    },
  });

  await connection.start();

  const app = createApp({
    apiKey: config.apiKey,
    gateway: connection,
    getQr: () => latestQr,
  });
  const server = app.listen(config.port, "127.0.0.1", () => {
    logger.info(`baileys-service listening on 127.0.0.1:${config.port}`);
  });

  const shutdown = async (signal: string): Promise<void> => {
    logger.info(`received ${signal}, shutting down`);
    server.close();
    await connection.stop();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((err: unknown) => {
  // Never print config or key material — message only.
  console.error(`baileys-service failed to start: ${(err as Error)?.message ?? "unknown error"}`);
  process.exit(1);
});
