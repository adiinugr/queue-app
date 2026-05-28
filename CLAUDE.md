# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development (runs Next.js on port 3010)
npm run dev

# Full dev with Socket.io server
./start-dev.sh

# Or manually in two terminals:
node socket-server.js          # Socket server on port 4010
npm run dev                    # Next.js on port 3010

# Build & start production
npm run build
npm run start

# Lint
npm run lint

# Database
npm run setup-db               # Initial DB setup
npm run generate               # Prisma client generation
npx prisma migrate dev --name <name>
npm run studio                 # Prisma Studio
```

## Environment Variables

Required in `.env.local`:
```
DATABASE_URL="postgresql://..."
NEXT_PUBLIC_SOCKET_URL=http://localhost:4010
SOCKET_SERVER_URL=http://localhost:4010
```

## Architecture

This is a queue management system (like a hospital/bank ticket system) built with Next.js 15, Prisma, PostgreSQL (Neon), and Socket.io.

### Two-Process Architecture

The app requires two separate processes:
1. **Next.js app** (`npm run dev`, port 3010) — handles UI and API routes
2. **Socket.io server** (`socket-server.js`, port 4010) — standalone Express + Socket.io server for real-time WebSocket broadcasting

API routes emit events to the socket server via its REST endpoint (`POST /api/emit`). The socket server then broadcasts to all connected browser clients.

### Pages / Roles

| Route | Purpose |
|-------|---------|
| `/` | Landing page |
| `/admin` | Admin panel — manage settings, counters, queue oversight |
| `/loket/[id]` | Counter operator interface — call next, complete, recall |
| `/display` | Public display screen with voice announcements (Web Speech API) |

### Data Model (Prisma)

- **Setting** (singleton `id="default"`) — system config: daily limit, start number, reset policy, video URL
- **Counter** — service windows with `counterType: OPERATOR | VERIFIKATOR`, `currentQueue` (one-to-one) and `queueHistory` relations
- **Queue** — queue tickets with `queueType: OPERATOR | VERIFIKATOR` and status: `WAITING | CALLED | SERVING | COMPLETED | SKIPPED`

**Two separate queues**: Operators (10 counters) and Verifikators (5 counters) each have their own independent queue pool (numbers 1–200 per type per day). Counter type must match queue type when calling next.

### Real-time Flow

1. Operator action hits Next.js API route (e.g., `POST /api/counters/[id]/next`)
2. API route updates DB via Prisma, then POSTs to socket server's `/api/emit`
3. Socket server broadcasts the event to all WebSocket clients
4. Browser components subscribe via hooks in `src/lib/socket-client.ts`:
   - `useQueueUpdates(callback)` — queue state changes
   - `useRecallEvents(callback)` — re-announce a queue number
   - `useCounterUpdates(callback)` — counter state changes
   - `useSocketEvent(eventType)` — generic hook

### Key Files

- `socket-server.js` — standalone Socket.io + Express server
- `src/lib/socket-client.ts` — `SocketManager` singleton + React hooks
- `src/lib/prisma.ts` — Prisma client singleton
- `src/app/api/` — Next.js API routes
- `src/app/api/middleware.ts` — shared error handling wrapper (`withErrorHandlerNoReq`)

### Build Notes

`next.config.ts` has `ignoreBuildErrors: true` and `ignoreDuringBuilds: true` for TypeScript and ESLint — builds skip type/lint checks.
