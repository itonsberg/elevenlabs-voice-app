import Link from 'next/link'

// Force dynamic rendering to avoid React 19 context issues during static gen
export const dynamic = 'force-dynamic'

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8 bg-zinc-50 dark:bg-black">
      <div className="max-w-2xl text-center">
        <h1 className="text-4xl font-bold mb-4 text-zinc-900 dark:text-zinc-50">
          ElevenLabs Voice AI
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400 mb-8">
          A modern voice AI application with browser automation capabilities.
          Built with Next.js 16, Vercel AI SDK 6, and ElevenLabs.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link
            href="/chat"
            className="block p-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl hover:shadow-lg transition"
          >
            <h2 className="text-xl font-semibold mb-2 text-zinc-900 dark:text-zinc-50">
              Text Chat
            </h2>
            <p className="text-zinc-500 dark:text-zinc-400 text-sm">
              Chat with the AI agent using text. Supports tool calling for browser automation.
            </p>
          </Link>

          <Link
            href="/voice"
            className="block p-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl hover:shadow-lg transition"
          >
            <h2 className="text-xl font-semibold mb-2 text-zinc-900 dark:text-zinc-50">
              Voice Chat
            </h2>
            <p className="text-zinc-500 dark:text-zinc-400 text-sm">
              Have a real-time voice conversation with the AI using ElevenLabs.
            </p>
          </Link>
        </div>

        <div className="mt-12 text-sm text-zinc-400">
          <p>Powered by:</p>
          <div className="flex flex-wrap justify-center gap-4 mt-2">
            <span>Next.js 16</span>
            <span>AI SDK 6</span>
            <span>AI Gateway</span>
            <span>ElevenLabs</span>
          </div>
        </div>
      </div>
    </main>
  )
}
