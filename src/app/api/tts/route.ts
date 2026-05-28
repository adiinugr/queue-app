import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  const text = req.nextUrl.searchParams.get("text") || ""
  if (!text) return new NextResponse(null, { status: 400 })

  const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=id&client=tw-ob`

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    })

    if (!response.ok) {
      return new NextResponse(null, { status: 502 })
    }

    const buffer = await response.arrayBuffer()

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "public, max-age=3600"
      }
    })
  } catch {
    return new NextResponse(null, { status: 502 })
  }
}
