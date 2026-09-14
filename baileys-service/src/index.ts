/**
 * Entry point: loads config, starts HTTP, then starts the single WhatsApp session.
 *
 * The HTTP server binds to 0.0.0.0 so it can run behind Railway's public
 * networking proxy. The linking QR is kept in memory only and exposed as a PNG
 * through the authenticated GET /qr endpoint.
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

      logger.info(
        "WhatsApp linking QR is available through the protected /qr endpoint"
      );
    },

    onConnected: () => {
      latestQr = null;
    },
  });

  const app = createApp({
    apiKey: config.apiKey,
    gateway: connection,
    getQr: () => latestQr,
  });

  // IMPORTANT:
  // Railway must be able to reach the server from outside the container.
  const server = app.listen(config.port, "0.0.0.0", () => {
    logger.info(`baileys-service listening on 0.0.0.0:${config.port}`);
  });

  // Start WhatsApp only after HTTP is already listening.
  try {
    await connection.start();
  } catch (err) {
    logger.error(
      `WhatsApp connection failed to start: ${
        (err as Error)?.message ?? "unknown error"
      }`
    );
  }

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
