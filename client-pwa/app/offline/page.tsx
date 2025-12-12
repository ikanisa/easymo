"use client";

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4">
      <div className="text-center max-w-md">
        <div className="text-6xl mb-4">📡</div>
        <h1 className="text-2xl font-bold text-white mb-2">You're Offline</h1>
        <p className="text-slate-400 mb-6">
          Please check your internet connection and try again.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-3 bg-sky-500 text-white rounded-lg font-medium hover:bg-sky-600 transition-colors"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
