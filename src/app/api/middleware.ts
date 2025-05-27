import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

type ApiHandler = (req: NextRequest) => Promise<NextResponse>
type ApiHandlerWithParams = (
  req: NextRequest,
  context: { params: Record<string, string> }
) => Promise<NextResponse>
type ApiHandlerNoReq = () => Promise<NextResponse>

// Middleware untuk menangani error pada API dengan req parameter
export function withErrorHandler(handler: ApiHandler): ApiHandler
export function withErrorHandler(
  handler: ApiHandlerWithParams
): ApiHandlerWithParams
export function withErrorHandler(
  handler: ApiHandler | ApiHandlerWithParams
): ApiHandler | ApiHandlerWithParams {
  return async (
    req: NextRequest,
    context?: { params: Record<string, string> }
  ) => {
    try {
      // Use type assertion instead of ts-ignore
      return await (context
        ? (handler as ApiHandlerWithParams)(req, context)
        : (handler as ApiHandler)(req))
    } catch (error) {
      console.error("API Error:", error)
      return NextResponse.json(
        { error: "Terjadi kesalahan pada server" },
        { status: 500 }
      )
    }
  }
}

// Middleware untuk menangani error pada API tanpa req parameter
export function withErrorHandlerNoReq(handler: ApiHandlerNoReq): ApiHandler {
  return async (_req: NextRequest) => {
    try {
      return await handler()
    } catch (error) {
      console.error("API Error:", error)
      return NextResponse.json(
        { error: "Terjadi kesalahan pada server" },
        { status: 500 }
      )
    }
  }
}
