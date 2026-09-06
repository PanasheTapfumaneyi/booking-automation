/**
 * Entry point: loads config, starts the single WhatsApp session, serves HTTP.
 *
 * Binds to 127.0.0.1 only — local development. No tunnels, no public
 * exposure, no multi-session handling. On first run a QR code is printed to
 * the terminal for linking the dedicated Kivo test account; afterwards the
 * persisted auth under BAILEYS_AUTH_DIR reconnects without another scan.
 */
import qrcode from "qrcode-terminal";
import pino from "pino";
import { loadConfig } from "./config.js";
import { createApp } from "./server.js";
import { WhatsAppConnection } from "./whatsapp.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const logger = pino<string>({ level: config.logLevel });

  const connection = new WhatsAppConnection({
    authDir: config.authDir,
    logger,
    onQr: (qr: string) => {
      // Linking QR — rendered to the terminal only, never over HTTP.
      console.log("Scan this QR with the dedicated Kivo WhatsApp account (Linked devices):");
      qrcode.generate(qr, { small: true });
    },
  });

  await connection.start();

  const app = createApp({ apiKey: config.apiKey, gateway: connection });
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
