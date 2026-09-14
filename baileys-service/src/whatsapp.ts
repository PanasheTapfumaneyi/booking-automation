/**
 * Single-session WhatsApp connection owned by the Baileys service.
 *
 * Design notes:
 *  - One in-memory socket, created once; `start()` is idempotent and guards
 *    against concurrent creation.
 *  - Auth persists via `useMultiFileAuthState` under the configured dir;
 *    `creds.update` is always wired to `saveCreds`.
 *  - The QR string from `connection.update` is handed to an injected renderer
 *    (in-memory holder in production, served only as a PNG through the
 *    authenticated GET /qr endpoint). The raw QR string is never logged,
 *    returned as JSON, or written to disk.
 *  - The WA version is fetched dynamically with `fetchLatestBaileysVersion`
 *    and falls back to Baileys' built-in default when unreachable — no stale
 *    hardcoded version lives here.
 *  - Ordinary transient disconnects reconnect once after a short delay; an
 *    explicit logged-out state (Boom 401) stops reconnecting so the operator
 *    must relink. No duplicate reconnect loops: a single timer + state guard.
 */
import makeWASocket, {
  Browsers,
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
  type WASocket,
  type WAVersion,
} from "@whiskeysockets/baileys";
import type { Boom } from "@hapi/boom";
import pino from "pino";

export type ConnectionStateName =
  | "starting"
  | "qr_required"
  | "connected"
  | "disconnected"
  | "logged_out"
  | "error";

export interface ConnectionSnapshot {
  connected: boolean;
  state: ConnectionStateName;
}

export interface WhatsAppGateway {
  getStatus(): ConnectionSnapshot;
  /** Sends a text message; resolves with the provider message id. */
  sendText(toDigits: string, text: string): Promise<string>;
  start(): Promise<void>;
  stop(): Promise<void>;
}

interface WhatsAppConnectionOptions {
  authDir: string;
  logger?: pino.Logger<string>;
  /** Renders the linking QR (terminal by default). Never logs or stores it. */
  onQr?: (qr: string) => void;
  /** Fires once the socket reports `open` (linking succeeded). */
  onConnected?: () => void;
  versionFetcher?: () => Promise<{ version: WAVersion }>;
  socketFactory?: (args: {
    version: WAVersion | undefined;
    authDir: string;
    logger: pino.Logger<string>;
  }) => Promise<{ sock: WASocket; saveCreds: () => Promise<void> }>;
  reconnectDelayMs?: number;
}

const RECONNECT_DELAY_MS = 5_000;

function boomStatusCode(err: unknown): number | undefined {
  const output = (err as Partial<Boom> | undefined)?.output;
  return typeof output?.statusCode === "number" ? output.statusCode : undefined;
}

export function toIndividualJid(toDigits: string): string {
  return `${toDigits}@s.whatsapp.net`;
}

export class WhatsAppConnection implements WhatsAppGateway {
  private state: ConnectionStateName = "starting";
  private sock: WASocket | null = null;
  private saveCreds: (() => Promise<void>) | null = null;
  private startPromise: Promise<void> | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private stopped = false;

  constructor(private readonly opts: WhatsAppConnectionOptions) {}

  getStatus(): ConnectionSnapshot {
    return { connected: this.state === "connected", state: this.state };
  }

  async start(): Promise<void> {
    if (this.startPromise) return this.startPromise;
    this.stopped = false;
    this.startPromise = this.connect().finally(() => {
      this.startPromise = null;
    });
    return this.startPromise;
  }

  async stop(): Promise<void> {
    this.stopped = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.sock) {
      try {
        await this.sock.end(undefined);
      } catch {
        // Best effort — the process is shutting down or tests are tearing down.
      }
      this.sock = null;
    }
  }

  async sendText(toDigits: string, text: string): Promise<string> {
    const sock = this.sock;
    if (!sock || this.state !== "connected") {
      throw new Error(`not connected (state=${this.state})`);
    }
    const sent = await sock.sendMessage(toIndividualJid(toDigits), { text });
    const id = sent?.key?.id;
    if (!id) throw new Error("send accepted but no message id returned");
    return id;
  }

  private async resolveVersion(): Promise<WAVersion | undefined> {
    const fetcher = this.opts.versionFetcher ?? fetchLatestBaileysVersion;
    try {
      const { version } = await fetcher();
      return version;
    } catch {
      // Offline or upstream hiccup — Baileys' built-in default still works.
      return undefined;
    }
  }

  private async connect(): Promise<void> {
    this.setState("starting");
    const logger = this.opts.logger ?? pino({ level: "warn" });
    const version = await this.resolveVersion();
    const factory =
      this.opts.socketFactory ??
      (async ({ authDir: dir }: { authDir: string }) => {
        const { state, saveCreds } = await useMultiFileAuthState(dir);
        const sock = makeWASocket({
          version,
          auth: state,
          logger,
          browser: Browsers.appropriate("Kivo"),
          markOnlineOnConnect: false,
          syncFullHistory: false,
        });
        return { sock, saveCreds };
      });

    const { sock, saveCreds } = await factory({
      version,
      authDir: this.opts.authDir,
      logger,
    });
    this.sock = sock;
    this.saveCreds = saveCreds;

    sock.ev.on("creds.update", () => {
      void this.saveCreds?.()?.catch(() => {
        // Auth persistence failure surfaces on next restart; never crash here.
      });
    });

    sock.ev.on("connection.update", (update) => {
      void this.handleConnectionUpdate(update);
    });
  }

  private async handleConnectionUpdate(update: {
    connection?: "open" | "connecting" | "close";
    lastDisconnect?: { error?: Error };
    qr?: string;
  }): Promise<void> {
    if (update.qr) {
      this.setState("qr_required");
      try {
        this.opts.onQr?.(update.qr);
      } catch {
        // QR rendering must never break the connection loop.
      }
    }

    const connection = update.connection;
    if (connection === "open") {
      this.setState("connected");
      try {
        this.opts.onConnected?.();
      } catch {
        // Post-connect hooks must never break the connection loop.
      }
      return;
    }
    if (connection !== "close") return;

    const statusCode = boomStatusCode(update.lastDisconnect?.error);
    if (statusCode === DisconnectReason.loggedOut) {
      // Explicit logout (401): the stored creds are dead. Stop reconnecting —
      // the operator must delete auth/ and relink with a fresh QR.
      this.setState("logged_out");
      await this.stop();
      return;
    }
    if (this.stopped) {
      this.setState("disconnected");
      return;
    }
    this.setState("disconnected");
    this.scheduleReconnect();
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer || this.stopped) return;
    this.reconnectTimer = setTimeout(
      () => {
        this.reconnectTimer = null;
        if (this.stopped) return;
        void this.start().catch(() => {
          this.setState("error");
          this.scheduleReconnect();
        });
      },
      this.opts.reconnectDelayMs ?? RECONNECT_DELAY_MS,
    );
  }

  private setState(next: ConnectionStateName): void {
    this.state = next;
  }
}
