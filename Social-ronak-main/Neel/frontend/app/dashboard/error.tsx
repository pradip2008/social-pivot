'use client'; // Error components must be Client Components
 
import { useEffect } from 'react';
import { FiAlertTriangle } from 'react-icons/fi';
 
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error(error)
  }, [error])
 
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6 space-y-4">
      <div className="bg-red-500/10 p-5 rounded-full mb-4 inline-block shadow-lg shadow-red-500/20">
        <FiAlertTriangle className="text-red-500 text-6xl drop-shadow-md" />
      </div>
      <h2 className="text-3xl font-bold text-white bg-clip-text">Something went wrong!</h2>
      <p className="text-gray-400 max-w-md">An unexpected error occurred while rendering this dashboard component. Don't worry, your data is safe.</p>
      
      <button
        className="mt-6 px-6 py-2 bg-primary hover:bg-cyan-500 text-black font-semibold rounded-lg shadow-md transition-all active:scale-95"
        onClick={
          // Attempt to recover by trying to re-render the segment
          () => reset()
        }
      >
        Try again
      </button>
    </div>
  )
}
