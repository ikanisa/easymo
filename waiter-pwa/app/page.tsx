export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-primary-600 mb-4">
          🤖 Waiter AI
        </h1>
        <p className="text-lg text-gray-600">
          Your AI-powered restaurant assistant
        </p>
        <div className="mt-8 space-x-4">
          <a
            href="/chat"
            className="inline-block px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition"
          >
            Start Chat
          </a>
          <a
            href="/menu"
            className="inline-block px-6 py-3 border border-primary-600 text-primary-600 rounded-lg hover:bg-primary-50 transition"
          >
            View Menu
          </a>
        </div>
      </div>
    </main>
  )
}
