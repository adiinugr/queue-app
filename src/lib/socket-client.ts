import { useEffect, useRef, useState } from "react"
import io from "socket.io-client"
type Socket = ReturnType<typeof io>

// Event types for socket communication
export enum SOCKET_EVENTS {
  QUEUE_UPDATE = "queue-update",
  RECALL_EVENT = "recall-event",
  COUNTER_UPDATE = "counter-update",
  CONNECTION_STATUS = "connection-status",
  SETTINGS_UPDATE = "settings-update"
}

// Types for socket events
export interface QueueUpdateData {
  type: string
  queue: {
    id: string
    number: number
    queueType?: "OPERATOR" | "VERIFIKATOR"
    status: "WAITING" | "CALLED" | "SERVING" | "COMPLETED" | "SKIPPED"
    counterServingId: string | null
  }
  counter?: {
    id: string
    name: string
    number: number
    counterType: "OPERATOR" | "VERIFIKATOR"
    isActive: boolean
    currentQueue: Record<string, unknown> | null
  }
  timestamp?: number
}

export interface RecallEventData {
  type: string
  queueNumber: number
  counterNumber: number
  counterType?: "OPERATOR" | "VERIFIKATOR"
  timestamp?: number
}

export interface SettingsUpdateData {
  videoUrl?: string
  dailyQueueLimit?: number
  startNumber?: number
  resetQueueDaily?: boolean
  allowSimultaneous?: boolean
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

      // Listen for all defined event types and forward to registered listeners
      Object.values(SOCKET_EVENTS).forEach((eventType) => {
        this.socket?.on(eventType, (data: any) => {
          this.notifyEventListeners(eventType, data)
        })
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

// Generic hook: subscribes to a socket event and calls callback directly (no batching)
function useSocketEventCallback<T>(
  eventType: SOCKET_EVENTS,
  callback: (data: T) => void
): boolean {
  const [isConnected, setIsConnected] = useState(false)
  // Keep callback ref current so we never need to re-subscribe
  const callbackRef = useRef(callback)
  useEffect(() => {
    callbackRef.current = callback
  })

  useEffect(() => {
    const socketManager = SocketManager.getInstance()
    setIsConnected(socketManager.getConnectionStatus())

    const unsubConn = socketManager.addConnectionListener(setIsConnected)
    const unsubEvent = socketManager.addEventListener(eventType, (data: T) => {
      callbackRef.current(data)
    })

    return () => {
      unsubConn()
      unsubEvent()
    }
  // Only subscribe once — callbackRef keeps it current
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventType])

  return isConnected
}

// Hook for queue updates
export function useQueueUpdates(
  callback: (data: QueueUpdateData) => void
): boolean {
  return useSocketEventCallback<QueueUpdateData>(SOCKET_EVENTS.QUEUE_UPDATE, callback)
}

// Hook for recall events
export function useRecallEvents(
  callback: (data: RecallEventData) => void
): boolean {
  return useSocketEventCallback<RecallEventData>(SOCKET_EVENTS.RECALL_EVENT, callback)
}

// Hook for counter updates
export function useCounterUpdates(callback: (data: any) => void): boolean {
  return useSocketEventCallback(SOCKET_EVENTS.COUNTER_UPDATE, callback)
}

// Hook for settings updates
export function useSettingsUpdates(
  callback: (data: SettingsUpdateData) => void
): boolean {
  return useSocketEventCallback<SettingsUpdateData>(SOCKET_EVENTS.SETTINGS_UPDATE, callback)
}

// Function to emit events
export function emitSocketEvent(eventType: SOCKET_EVENTS, data: any): boolean {
  return SocketManager.getInstance().emit(eventType, data)
}

// Export the singleton instance
export const socketManager = SocketManager.getInstance()
