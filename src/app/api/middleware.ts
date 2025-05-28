import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

// For simple handlers taking only NextRequest
type ApiHandler = (req: NextRequest) => Promise<NextResponse>

// For handlers taking NextRequest and context with specific params type P
// P defaults to a common Next.js params shape.
type ApiHandlerWithParams<
  P extends Record<string, string | string[] | undefined> = Record<
    string,
    string | undefined
  >
> = (req: NextRequest, context: { params: P }) => Promise<NextResponse>

// Middleware untuk menangani error pada API dengan req parameter
export function withErrorHandler(handler: ApiHandler): ApiHandler
export function withErrorHandler<
  P extends Record<string, string | string[] | undefined>
>(handler: ApiHandlerWithParams<P>): ApiHandlerWithParams<P>
export function withErrorHandler<
  P extends Record<string, string | string[] | undefined>
>(
  handler: ApiHandler | ApiHandlerWithParams<P>
): ApiHandler | ApiHandlerWithParams<P> {
  return async (req: NextRequest, context?: { params: P }) => {
    try {
      // Check the arity of the handler to determine if it expects context.
      if (handler.length === 2) {
        // Assumes handlers with context always have 2 parameters
        if (!context) {
          // This case should ideally not be hit if a handler expecting context is used for a dynamic route,
          // as Next.js should provide the context.
          console.error(
            "API Error: Handler expects route parameters (context), but none were provided by Next.js."
          )
          // Throw an error or return a standard error response
          return NextResponse.json(
            {
              error:
                "Server configuration error: Route context missing for handler."
            },
            { status: 500 }
          )
        }
        // Handler is ApiHandlerWithParams<P>, context must be { params: P }
        return await (handler as ApiHandlerWithParams<P>)(req, context)
      } else {
        // Handler is ApiHandler (expects only req)
        return await (handler as ApiHandler)(req)
      }
    } catch (error) {
      console.error("API Error caught in withErrorHandler:", error)
      const errorMessage =
        error instanceof Error ? error.message : "Terjadi kesalahan pada server"
      return NextResponse.json({ error: errorMessage }, { status: 500 })
    }
  }
}

// Middleware untuk menangani error pada API tanpa req parameter
export function withErrorHandlerNoReq(
  handler: () => Promise<NextResponse>
): ApiHandler {
  return async (_req: NextRequest) => {
    if (_req) {
      /*ਤਰੇ */
    } // No-op to satisfy linter for _req
    try {
      return await handler()
    } catch (error) {
      console.error("API Error (NoReq):", error)
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Terjadi kesalahan pada server"
        },
        { status: 500 }
      )
    }
  }
}
