interface LoadingSpinnerProps {
  fullScreen?: boolean
  message?: string
}

export default function LoadingSpinner({
  fullScreen = false,
  message = "Memuat..."
}: LoadingSpinnerProps) {
  const content = (
    <div className="text-center">
      <div className="relative mb-6">
        <div className="absolute top-0 left-0 h-16 w-16 animate-spin rounded-full border-t-4 border-rose-600"></div>
      </div>
      <h2 className="text-xl font-inter font-medium text-gray-800">
        {message}
      </h2>
      <p className="mt-2 text-sm text-gray-500 font-inter">
        Harap tunggu sebentar...
      </p>
    </div>
  )

  if (fullScreen) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-white z-50">
        <div className="w-full max-w-md px-6 py-8">{content}</div>
      </div>
    )
  }

  return <div className="flex p-8 items-center justify-center">{content}</div>
}
