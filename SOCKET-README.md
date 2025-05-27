# Real-Time Socket.io Implementation

This is a new real-time implementation using Socket.io for the queue management system, which provides significantly lower latency and more reliable real-time updates compared to the previous Server-Sent Events (SSE) approach.

## Why Socket.io?

- **Full-duplex communication**: Unlike SSE (which is unidirectional), Socket.io allows both server-to-client and client-to-server communication
- **Lower latency**: WebSockets provide lower latency than SSE
- **Better connection management**: Automatic reconnection and better cross-browser compatibility
- **Enhanced reliability**: More consistent performance across various network conditions
- **No polling fallback needed**: Eliminates the need for polling when the connection drops

## Setup

1. Install dependencies:

   ```
   npm install socket.io socket.io-client express cors
   npm install --save-dev @types/socket.io-client
   ```

2. Set environment variables in `.env.local`:

   ```
   NEXT_PUBLIC_SOCKET_URL=http://localhost:3001
   SOCKET_SERVER_URL=http://localhost:3001
   ```

3. Run both the socket server and Next.js app:

   ```
   ./start-dev.sh
   ```

   Or manually:

   ```
   # In terminal 1
   node socket-server.js

   # In terminal 2
   npm run dev
   ```

## Architecture

1. **Socket Server** (`socket-server.js`):

   - Standalone Node.js server that handles WebSocket connections
   - Maintains a list of connected clients
   - Broadcasts events to all connected clients
   - Provides REST API for emitting events from other services

2. **Socket Client** (`src/lib/socket-client.ts`):

   - Manages the connection to the socket server
   - Provides React hooks for subscribing to events
   - Implements connection monitoring and auto-reconnection

3. **API Integration** (`src/app/api/*/route.ts`):
   - Backend routes emit both SSE and Socket events
   - Uses the socket server's REST API to emit events

## React Hooks

The implementation provides several React hooks for your components:

```tsx
// Basic connection status
const isConnected = useSocketConnection()

// Listen for queue updates
const isConnected = useQueueUpdates((data) => {
  // Handle queue update data
  console.log(data)
})

// Listen for recall events
const isConnected = useRecallEvents((data) => {
  // Handle recall event data
  console.log(data)
})

// Generic event listener
const { isConnected, lastEvent } = useSocketEvent(SOCKET_EVENTS.COUNTER_UPDATE)
```

## Emitting Events

To emit events from the client:

```tsx
import { emitSocketEvent, SOCKET_EVENTS } from "../../lib/socket-client"

// Emit a queue update
emitSocketEvent(SOCKET_EVENTS.QUEUE_UPDATE, {
  type: "QUEUE_CALLED",
  queue: {
    id: "queue-123",
    number: 10,
    status: "CALLED",
    counterServingId: "counter-1"
  }
})
```

## Troubleshooting

- **No connection**: Check that the socket server is running and the environment variables are set correctly
- **Events not received**: Check the browser console for connection errors
- **High latency**: Ensure the socket server is running on the same network or has low latency to clients

## Maintenance

- The socket server is designed to be stateless and can be scaled horizontally
- Connection information is maintained in-memory, so if you need persistence, consider using Redis or similar
