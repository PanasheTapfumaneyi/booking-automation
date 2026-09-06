# kivo-baileys-service

Standalone transactional WhatsApp transport for Kivo booking notifications.

```
Kivo Next.js --(Authorization: Bearer)--> baileys-service --(Baileys WS)--> WhatsApp
```

One dedicated WhatsApp account/session for the Kivo pilot. No multi-tenant
sessions, broadcasting, bots, groups, or marketing features — text-only
transactional sends (`booking.created` / `booking.rescheduled` /
`booking.cancelled`).

## Layout

```
baileys-service/
  src/
    index.ts        entry point: config → WhatsApp session → HTTP
    whatsapp.ts     single-session connection (state, QR, reconnect, send)
    server.ts       express app factory (GET /health, GET /status, POST /send)
    config.ts       env-only configuration (never logs secrets)
    server.test.ts  HTTP-level tests (fake gateway, no real WhatsApp)
  auth/             persisted Baileys auth state (gitignored, created on run)
  .env              local secrets (gitignored — copy from .env.example)
```

## Requirements

- Node.js 22+, npm 10+
- One dedicated WhatsApp account for the Kivo pilot (not a personal account)

## Setup

```bash
cd baileys-service
npm install
cp .env.example .env   # Windows: copy .env.example .env
```

Generate a strong local API key (example):

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Put it in `.env` as `BAILEYS_API_KEY`. Environment:

| Variable         | Default       | Meaning                                  |
| ---------------- | ------------- | ---------------------------------------- |
| `PORT`           | `8081`        | HTTP listen port (bound to 127.0.0.1)    |
| `BAILEYS_API_KEY`| (required)    | Internal key, `Authorization: Bearer …`  |
| `BAILEYS_AUTH_DIR`| `./auth`     | Persisted session dir (gitignored)       |
| `LOG_LEVEL`      | `warn`        | pino level for the WhatsApp socket       |

## Run

```bash
npm run build
npm start
# or: node dist/index.js
```

## API

Auth: `POST /send` requires `Authorization: Bearer <BAILEYS_API_KEY>`.
`/health` and `/status` are unauthenticated but expose only safe state —
never credentials, QR data, keys, or phonebook data.

- `GET /health` → `{ "ok": true }`
- `GET /status` → `{ "service": "baileys", "connected": true, "state": "connected" }`
  - `state`: `starting` | `qr_required` | `connected` | `disconnected` |
    `logged_out` | `error`
- `POST /send` `{ "to": "23057123456", "text": "…" }`
  → `{ "success": true, "messageId": "…" }`
  - `401 { success:false, error:"UNAUTHORIZED" }` — missing/wrong key
  - `400 { success:false, error:"TEXT_REQUIRED" | "TEXT_TOO_LONG" | "INVALID_DESTINATION" | "INVALID_JSON" }`
  - `503 { success:false, error:"NOT_CONNECTED", state }` — WhatsApp down
  - `502 { success:false, error:"SEND_FAILED" }` — send failed, no internals

`to` accepts a normalized international number (`230…` or `+230…`;
formatting is stripped). It is converted to the Baileys individual-user JID
`<digits>@s.whatsapp.net` — never OpenWA's `@c.us` form.

## Manual validation (live WhatsApp required)

Do not claim live success until each step below is actually performed and
reported. No automatic retry exists yet (Phase 5).

1. `npm install` in `baileys-service/`.
2. Configure a new local `BAILEYS_API_KEY` in `.env` (gitignored).
3. `npm run build` then `npm start`.
4. Scan the terminal QR with the dedicated Kivo test WhatsApp account
   (WhatsApp → Linked devices). The QR is terminal-only, never over HTTP.
5. `GET http://localhost:8081/status` → `connected: true, state: "connected"`.
6. Direct test (one message only, to an explicitly provided test number):
   `POST http://localhost:8081/send` with the Bearer key, confirm delivery
   and capture `messageId`.
7. Restart the service (`Ctrl+C`, `npm start`).
8. Confirm `/status` is `connected` again WITHOUT another QR scan (auth
   persisted under `auth/`).
9. In Kivo's `.env.local`: `NOTIFICATION_PROVIDER=baileys`,
   `BAILEYS_BASE_URL=http://localhost:8081`, `BAILEYS_API_KEY=<same key>`.
10. Restart Kivo (`npm run dev`).
11. `GET http://localhost:3000/api/integrations/baileys/status` →
    `configured: true, reachable: true, sessionReady: true`.
12. Create a test booking via `/book`; verify customer + business WhatsApp
    arrive, both `notifications` rows are `sent`, and `provider_message_id`
    is stored.
13. Reschedule via the manage link; verify new notifications with old/new
    times and a new event id (no duplicate confirmation).
14. Cancel; verify cancellation messages, `sent` rows, booking stays
    `cancelled` in the DB.
15. Stop `baileys-service`, perform another booking operation: the booking
    must succeed while the notification row becomes `failed`
    (`BAILEYS_UNAVAILABLE` / `BAILEYS_SESSION_NOT_READY`).
16. Restart the service; verify the app operates normally again.
17. Re-trigger the same event where applicable and confirm idempotency
    (one `(event_id, recipient, channel)` → one send).

### Logged-out recovery

If `/status` reports `state: "logged_out"`, the stored credentials are dead
and the service will NOT reconnect on its own. Stop the service, delete the
`auth/` directory, start again, and scan a fresh QR.

## Notes / limitations

- Baileys version is resolved dynamically at startup with
  `fetchLatestBaileysVersion()` (falls back to the library default when
  offline) — no hardcoded WhatsApp Web version.
- `printQRInTerminal` is deprecated/removed in the installed Baileys
  release; this service renders the `qr` value from `connection.update`
  itself with `qrcode-terminal`.
- License reminder: Baileys/Web automation must comply with WhatsApp's
  terms; pilot use only, single test account, transactional messages.
