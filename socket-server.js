const { createServer } = require("http")
const { Server } = require("socket.io")
const express = require("express")
const cors = require("cors")

const app = express()
app.use(cors())

const server = createServer(app)
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:3010",
    methods: ["GET", "POST"],
    credentials: true
  }
})

// Track connected clients
const connectedClients = new Map()

// Event types
const EVENTS = {
  QUEUE_UPDATE: "queue-update",
  RECALL_EVENT: "recall-event",
  COUNTER_UPDATE: "counter-update",
  CONNECTION_STATUS: "connection-status"
}

// Handle socket connections
io.on("connection", (socket) => {
  const clientId = socket.id
  console.log(`Client connected: ${clientId}`)
  connectedClients.set(clientId, { id: clientId, timestamp: Date.now() })

  // Send initial connection status
  socket.emit(EVENTS.CONNECTION_STATUS, {
    connected: true,
    clientId,
    clientsCount: connectedClients.size
  })

  // Broadcast updated client count
  io.emit(EVENTS.CONNECTION_STATUS, {
    clientsCount: connectedClients.size
  })

  // Handle queue events from admin panels
  socket.on(EVENTS.QUEUE_UPDATE, (data) => {
    console.log(`Queue update received: ${JSON.stringify(data)}`)
    // Broadcast to all clients
    io.emit(EVENTS.QUEUE_UPDATE, {
      ...data,
      timestamp: Date.now()
    })
  })

  // Handle recall events
  socket.on(EVENTS.RECALL_EVENT, (data) => {
    console.log(`Recall event received: ${JSON.stringify(data)}`)
    io.emit(EVENTS.RECALL_EVENT, {
      ...data,
      timestamp: Date.now()
    })
  })

  // Handle counter updates
  socket.on(EVENTS.COUNTER_UPDATE, (data) => {
    console.log(`Counter update received: ${JSON.stringify(data)}`)
    io.emit(EVENTS.COUNTER_UPDATE, {
      ...data,
      timestamp: Date.now()
    })
  })

  // Send periodic heartbeats to verify connection
  const heartbeatInterval = setInterval(() => {
    socket.emit("heartbeat", { timestamp: Date.now() })
  }, 30000)

  // Handle disconnection
  socket.on("disconnect", () => {
    console.log(`Client disconnected: ${clientId}`)
    connectedClients.delete(clientId)
    clearInterval(heartbeatInterval)

    // Broadcast updated client count
    io.emit(EVENTS.CONNECTION_STATUS, {
      clientsCount: connectedClients.size
    })
  })
})

// API endpoint to emit events from REST calls
app.use(express.json())

app.post("/api/emit", (req, res) => {
  const { eventType, eventData } = req.body

  if (!eventType || !eventData) {
    return res
      .status(400)
      .json({ success: false, message: "Missing eventType or eventData" })
  }

  console.log(`Emitting ${eventType} via API`)
  io.emit(eventType, {
    ...eventData,
    timestamp: Date.now()
  })

  return res.json({ success: true, message: `Event ${eventType} emitted` })
})

// Status endpoint
app.get("/status", (req, res) => {
  res.json({
    status: "online",
    clients: connectedClients.size,
    uptime: process.uptime()
  })
})

const PORT = process.env.SOCKET_SERVER_PORT || 4010
server.listen(PORT, () => {
  console.log(`Socket.io server running on port ${PORT}`)
})
