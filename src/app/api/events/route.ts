import { NextResponse } from "next/server"

// This API route has been deprecated in favor of Socket.io
export async function GET() {
  return NextResponse.json(
    {
      success: false,
      message:
        "This SSE endpoint has been deprecated. Please use Socket.io instead.",
      socketEndpoint: "/api/socket.io"
    },
    { status: 410 } // Gone status code
  )
}

export async function POST() {
  return NextResponse.json(
    {
      success: false,
      message:
        "This SSE endpoint has been deprecated. Please use Socket.io instead.",
      socketEndpoint: "/api/socket.io"
    },
    { status: 410 } // Gone status code
  )
}
