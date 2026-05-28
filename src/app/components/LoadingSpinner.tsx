interface LoadingSpinnerProps {
  fullScreen?: boolean
  message?: string
}

export default function LoadingSpinner({
  fullScreen = false,
  message = "Memuat..."
}: LoadingSpinnerProps) {
  const content = (
    <div className="flex flex-col items-center gap-6">
      {/* Layered ring spinner */}
      <div className="relative w-16 h-16">
        {/* Outer slow ring */}
        <div
          className="absolute inset-0 rounded-full border-2 border-transparent animate-spin"
          style={{
            borderTopColor: "#1A56DB",
            borderRightColor: "rgba(26,86,219,0.2)",
            animationDuration: "1.4s"
          }}
        />
        {/* Inner fast ring */}
        <div
          className="absolute inset-2 rounded-full border-2 border-transparent animate-spin"
          style={{
            borderTopColor: "#14B8A6",
            borderLeftColor: "rgba(20,184,166,0.2)",
            animationDuration: "0.9s",
            animationDirection: "reverse"
          }}
        />
        {/* Center dot */}
        <div
          className="absolute inset-0 flex items-center justify-center"
        >
          <div
            className="w-2 h-2 rounded-full"
            style={{
              background: "#3B82F6",
              boxShadow: "0 0 8px #3B82F6"
            }}
          />
        </div>
      </div>

      <div className="text-center">
        <p
          className="text-sm font-semibold text-white"
          style={{ fontFamily: "var(--font-jakarta)" }}
        >
          {message}
        </p>
        <p
          className="text-xs mt-1"
          style={{ color: "rgba(255,255,255,0.4)", fontFamily: "var(--font-jakarta)" }}
        >
          Harap tunggu sebentar...
        </p>
      </div>
    </div>
  )

  if (fullScreen) {
    return (
      <div
        className="fixed inset-0 flex flex-col items-center justify-center z-50"
        style={{
          background: "linear-gradient(160deg, #0A1628 0%, #0D1F35 100%)"
        }}
      >
        {/* Background glow */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage:
              "radial-gradient(circle at 50% 50%, rgba(26,86,219,0.12) 0%, transparent 60%)"
          }}
        />
        <div className="relative z-10 flex flex-col items-center gap-8">
          {/* Institution badge */}
          <div
            className="flex items-center gap-2 px-4 py-2 rounded-full"
            style={{
              background: "rgba(26,86,219,0.15)",
              border: "1px solid rgba(59,130,246,0.3)"
            }}
          >
            <div
              className="w-1.5 h-1.5 rounded-full animate-pulse"
              style={{ background: "#3B82F6" }}
            />
            <span
              className="text-xs font-semibold tracking-widest uppercase"
              style={{ color: "#93C5FD", fontFamily: "var(--font-jakarta)" }}
            >
              SPMB Jatim 2026 · SMAN 10 Surabaya
            </span>
          </div>

          {content}
        </div>
      </div>
    )
  }

  return (
    <div
      className="flex p-8 items-center justify-center rounded-xl"
      style={{ background: "rgba(255,255,255,0.03)" }}
    >
      {content}
    </div>
  )
}
