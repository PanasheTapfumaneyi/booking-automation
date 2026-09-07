# Production Deployment Guide

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                      Kivo Platform                       │
├──────────────────┬──────────────────┬───────────────────┤
│  Next.js App     │  Baileys Service │  Supabase (hosted)│
│  (Vercel/hosted) │  (persistent)    │  PostgreSQL + RLS │
└──────────────────┴──────────────────┴───────────────────┘
```

### Components

| Component | Role | Hosting |
|-----------|------|---------|
| **Next.js app** | Marketing, dashboard, booking flows, API routes | Vercel or equivalent Node.js host |
| **Supabase** | PostgreSQL database, auth, RLS | Supabase Cloud (managed) |
| **Baileys service** | WhatsApp message delivery | Persistent VPS/container with durable storage |
| **Reminder cron** | Timed booking reminders | Secure scheduled invocation (cron, external scheduler) |

## Required Environment Variables

### Supabase (required)

```
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service role key — SERVER ONLY>
```

### Application

```
APP_BASE_URL=https://<your-domain>
```

### Google Calendar (optional)

```
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=https://<your-domain>/api/integrations/google-calendar/callback
```

### WhatsApp / Baileys (optional)

```
NOTIFICATION_PROVIDER=baileys
BAILEYS_BASE_URL=http://<baileys-host>:8081
BAILEYS_API_KEY=<shared secret>
```

### Reminders (required for timed reminders)

```
REMINDER_CRON_SECRET=<random secret — SERVER ONLY>
```

### Optional

```
GOOGLE_TOKEN_ENCRYPTION_KEY=<base64 encoded 32-byte key>
GOOGLE_API_TIMEOUT_MS=10000
BAILEYS_TIMEOUT_MS=10000
```

## Supabase Production Setup

1. Create a new Supabase project at https://supabase.com
2. Run all migrations in order:
   ```bash
   supabase db push
   # or apply manually via SQL editor:
   # supabase/migrations/0001_init.sql
   # supabase/migrations/0002_generalize_booking_modes.sql
   # ... through 0009_demo_businesses.sql
   ```
3. Verify RLS is enabled on all tables
4. Verify the `create_booking` RPC function exists
5. (Optional) Run `0009_demo_businesses.sql` to seed demo data

## Next.js Deployment

### Vercel (recommended)

1. Connect GitHub repository to Vercel
2. Set environment variables in Vercel dashboard
3. Deploy — Vercel auto-detects Next.js
4. Configure custom domain

### Other Hosts

```bash
npm run build
npm run start
```

Ensure Node.js 22+ is available.

## Baileys Deployment

The Baileys service must run as a **persistent** process:

```bash
cd baileys-service
npm install
npm start
```

### Requirements

- **Persistent storage**: Baileys auth/session data must survive restarts
- **Internal network**: Expose on localhost or private network only
- **Bearer auth**: All calls from Kivo include `Authorization: Bearer <BAILEYS_API_KEY>`
- **Health check**: `GET /health` returns service status
- **Auto-reconnect**: Built-in reconnection logic

### systemd example

```ini
[Unit]
Description=Kivo Baileys WhatsApp Service
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/kivo/baileys-service
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production
Environment=PORT=8081

[Install]
WantedBy=multi-user.target
```

### Session persistence

Baileys stores auth state in `baileys_auth_info/` by default. Ensure this directory is on durable storage (not ephemeral container filesystem).

## Reminder Scheduler

Reminders are triggered via `POST /api/internal/reminders/run` with bearer auth.

### Cron example (every 15 minutes)

```
*/15 * * * * curl -X POST https://<your-domain>/api/internal/reminders/run \
  -H "Authorization: Bearer $REMINDER_CRON_SECRET"
```

### Security

- The endpoint requires `Authorization: Bearer <REMINDER_CRON_SECRET>`
- Never expose the cron secret to the client
- The endpoint is safe to call multiple times (idempotent)

## Domain Setup

1. Configure DNS for your domain
2. Enable HTTPS (automatic with Vercel, or via Let's Encrypt)
3. Set `APP_BASE_URL=https://<your-domain>` in environment
4. Update `GOOGLE_REDIRECT_URI` to use production domain
5. Update Supabase Auth redirect URLs

## Post-Deployment Smoke Testing

1. Open homepage — verify Kivo branding loads
2. Open `/demo` — verify 3 demo businesses appear
3. Open `/book/fade-area` — book an appointment
4. Open `/book/island-surf` — rent a surfboard
5. Open `/book/blue-lagoon` — join a session
6. Check manage link works
7. Check `/login` and `/signup` work
8. Check dashboard loads for authenticated user
9. Verify no console errors
10. Check `npx vitest run` passes

## Backup / Rollback

### Database

- Supabase provides automatic backups
- Manual backup: `pg_dump` or Supabase dashboard
- Rollback: restore from backup or re-apply migrations

### Application

- Vercel: instant rollback to previous deployment
- Other: keep previous build artifact available
- Database migrations are additive (safe to re-apply)

## Known Limitations

- Baileys requires persistent storage (not serverless)
- Google Calendar integration requires manual OAuth per business
- Demo businesses use prefix `10000000-` — notification-safe
- Reminder scheduler must be configured externally
