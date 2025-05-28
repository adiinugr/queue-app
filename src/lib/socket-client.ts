import { useEffect, useState } from "react"
import io from "socket.io-client"
import { type Socket } from "socket.io-client/dist/socket"

// Event types for socket communication
export enum SOCKET_EVENTS {
  QUEUE_UPDATE = "queue-update",
  RECALL_EVENT = "recall-event",
  COUNTER_UPDATE = "counter-update",
  CONNECTION_STATUS = "connection-status"
}

// Types for socket events
export interface QueueUpdateData {
  type: string
  queue: {
    id: string
    number: number
    status: "WAITING" | "CALLED" | "SERVING" | "COMPLETED" | "SKIPPED"
    counterServingId: string | null
  }
  counter?: {
    id: string
    name: string
    number: number
    isActive: boolean
    currentQueue: Record<string, unknown> | null
  }
  timestamp?: number
}

export interface RecallEventData {
  type: string
  queueNumber: number
  counterNumber: number
  timestamp?: number
}

export interface ConnectionStatusData {
  connected?: boolean
  clientId?: string
  clientsCount?: number
  timestamp?: number
}

// Generic type for event data
export type SocketEventData =
  | QueueUpdateData
  | RecallEventData
  | ConnectionStatusData
  | Record<string, unknown>

// Socket manager singleton
class SocketManager {
  private static instance: SocketManager
  private socket: Socket | null = null
  private listeners: Map<string, Set<(data: unknown) => void>> = new Map()
  private connectionListeners: Set<(status: boolean) => void> = new Set()
  private socketUrl =
    process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:4010"
  private isConnected = false
  private reconnectAttempts = 0
  private reconnectTimeout: NodeJS.Timeout | null = null
  private clientId: string | null = null

  private constructor() {
    if (typeof window !== "undefined") {
      this.initSocket()
    }
  }

  public static getInstance(): SocketManager {
    if (!SocketManager.instance) {
      SocketManager.instance = new SocketManager()
    }
    return SocketManager.instance
  }

  private initSocket() {
    console.log("🔌 Initializing socket connection to", this.socketUrl)

    try {
      this.socket = io(this.socketUrl, {
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        timeout: 10000,
        transports: ["websocket", "polling"]
      })

      this.socket.on("connect", () => {
        console.log("✅ Socket connected with ID:", this.socket?.id)
        this.isConnected = true
        this.reconnectAttempts = 0
        this.clientId = this.socket?.id || null
        this.notifyConnectionListeners(true)
      })

      this.socket.on("disconnect", (reason: string) => {
        console.log("❌ Socket disconnected:", reason)
        this.isConnected = false
        this.notifyConnectionListeners(false)
      })

      this.socket.on("connect_error", (error: Error) => {
        console.error("Socket connection error:", error)
        this.isConnected = false
        this.notifyConnectionListeners(false)
      })

      // Listen for connection status updates
      this.socket.on(
        SOCKET_EVENTS.CONNECTION_STATUS,
        (data: ConnectionStatusData) => {
          console.log("📊 Connection status update:", data)
          if (data.clientId) {
            this.clientId = data.clientId
          }
          // Forward to any registered listeners
          this.notifyEventListeners(SOCKET_EVENTS.CONNECTION_STATUS, data)
        }
      )

      // Setup heartbeat
      this.socket.on("heartbeat", (data: { timestamp: number }) => {
        console.log(
          "💓 Heartbeat received:",
          new Date(data.timestamp).toISOString()
        )
      })

      // DIRECT TEST LISTENER FOR QUEUE_UPDATE
      this.socket?.on(SOCKET_EVENTS.QUEUE_UPDATE, (data: QueueUpdateData) => {
        console.log(
          "🔥🔥🔥 [SocketManager] DIRECT LISTENER received <queue-update> event:",
          data
        )
        // We can also try to notify listeners from here directly as a test, though it might cause double processing if the main one also works.
        // this.notifyEventListeners(SOCKET_EVENTS.QUEUE_UPDATE, data);
      })

      // Setup event handlers for other event types
      console.log(
        "[SocketManager] About to set up listeners for all SOCKET_EVENTS. QUEUE_UPDATE is:",
        SOCKET_EVENTS.QUEUE_UPDATE
      )
      Object.values(SOCKET_EVENTS).forEach((eventType) => {
        // Ensure the eventType is a valid key of SOCKET_EVENTS to prevent listening to undefined event names.
        if (Object.values(SOCKET_EVENTS).includes(eventType as SOCKET_EVENTS)) {
          this.socket?.on(eventType, (data: any) => {
            console.log(
              `📩 [SocketManager] Received raw <${eventType}> event:`,
              data
            ) // Added eventType to log
            this.notifyEventListeners(eventType, data)
          })
        } else {
          console.warn(
            `[SocketManager] Skipping setup for unknown eventType: ${eventType}`
          )
        }
      })
    } catch (error) {
      console.error("Failed to initialize socket:", error)
    }
  }

  public addConnectionListener(
    callback: (status: boolean) => void
  ): () => void {
    this.connectionListeners.add(callback)

    // Immediately notify with current status
    callback(this.isConnected)

    return () => {
      this.connectionListeners.delete(callback)
    }
  }

  public addEventListener(
    eventType: SOCKET_EVENTS,
    callback: (data: any) => void
  ): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set())
    }

    this.listeners.get(eventType)?.add(callback)

    return () => {
      const listeners = this.listeners.get(eventType)
      if (listeners) {
        listeners.delete(callback)
        if (listeners.size === 0) {
          this.listeners.delete(eventType)
        }
      }
    }
  }

  private notifyConnectionListeners(status: boolean) {
    this.connectionListeners.forEach((callback) => {
      try {
        callback(status)
      } catch (error) {
        console.error("Error in connection listener:", error)
      }
    })
  }

  private notifyEventListeners(eventType: string, data: any) {
    const listeners = this.listeners.get(eventType)
    if (!listeners || listeners.size === 0) return

    listeners.forEach((callback) => {
      try {
        callback(data)
      } catch (error) {
        console.error(`Error in ${eventType} listener:`, error)
      }
    })
  }

  public getConnectionStatus(): boolean {
    return this.isConnected
  }

  public getClientId(): string | null {
    return this.clientId
  }

  public emit(eventType: SOCKET_EVENTS, data: any): boolean {
    if (!this.socket || !this.isConnected) {
      console.error("Cannot emit event: socket not connected")
      return false
    }

    console.log(`📤 Emitting ${eventType} event:`, data)
    this.socket.emit(eventType, data)
    return true
  }

  public disconnect() {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }
    this.isConnected = false
  }
}

// React hook for connection status
export function useSocketConnection(): boolean {
  const [isConnected, setIsConnected] = useState(false)

  useEffect(() => {
    const socketManager = SocketManager.getInstance()

    // Initial status
    setIsConnected(socketManager.getConnectionStatus())

    // Listen for changes
    const unsubscribe = socketManager.addConnectionListener((status) => {
      setIsConnected(status)
    })

    return unsubscribe
  }, [])

  return isConnected
}

// Hook for listening to specific events
export function useSocketEvent<T = any>(
  eventType: SOCKET_EVENTS
): {
  isConnected: boolean
  lastEvent: T | null
} {
  const [isConnected, setIsConnected] = useState(false)
  const [lastEvent, setLastEvent] = useState<T | null>(null)

  useEffect(() => {
    const socketManager = SocketManager.getInstance()

    // Initial connection status
    setIsConnected(socketManager.getConnectionStatus())

    // Connection listener
    const connectionUnsubscribe = socketManager.addConnectionListener(
      (status) => {
        setIsConnected(status)
      }
    )

    // Event listener
    const eventUnsubscribe = socketManager.addEventListener(
      eventType,
      (data) => {
        setLastEvent(data as T)
      }
    )

    return () => {
      connectionUnsubscribe()
      eventUnsubscribe()
    }
  }, [eventType])

  return { isConnected, lastEvent }
}

// Hook for queue updates
export function useQueueUpdates(
  callback: (data: QueueUpdateData) => void
): boolean {
  const { isConnected, lastEvent } = useSocketEvent<QueueUpdateData>(
    SOCKET_EVENTS.QUEUE_UPDATE
  )

  useEffect(() => {
    if (lastEvent) {
      // console.log("🔄 [useQueueUpdates] Hook processing queue update via lastEvent:", lastEvent);
      callback(lastEvent)
    }
  }, [lastEvent, callback])

  return isConnected
}

// Hook for recall events
export function useRecallEvents(
  callback: (data: RecallEventData) => void
): boolean {
  const { isConnected, lastEvent } = useSocketEvent<RecallEventData>(
    SOCKET_EVENTS.RECALL_EVENT
  )

  useEffect(() => {
    if (lastEvent) {
      console.log("📣 Processing recall event:", lastEvent)
      callback(lastEvent)
    }
  }, [lastEvent, callback])

  return isConnected
}

// Add a new function to handle counter updates
export function useCounterUpdates(callback: (data: any) => void): boolean {
  const { isConnected, lastEvent } = useSocketEvent(
    SOCKET_EVENTS.COUNTER_UPDATE
  )

  useEffect(() => {
    if (lastEvent) {
      console.log("🏪 Processing counter update:", lastEvent)
      callback(lastEvent)
    }
  }, [lastEvent, callback])

  return isConnected
}

// Function to emit events
export function emitSocketEvent(eventType: SOCKET_EVENTS, data: any): boolean {
  return SocketManager.getInstance().emit(eventType, data)
}

// Export the singleton instance
export const socketManager = SocketManager.getInstance()
