import { ChatInterface } from '@/components/chat/chat-interface'
import Link from 'next/link'

// Force dynamic rendering to avoid React 19 context issues during static gen
export const dynamic = 'force-dynamic'

export default function ChatPage() {
  return (
    <div className="min-h-screen flex flex-col bg-zinc-50 dark:bg-black">
      {/* Header */}
      <header className="border-b border-zinc-200 dark:border-zinc-800 px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-50 transition"
            >
              &larr; Back
            </Link>
            <h1 className="font-semibold text-zinc-900 dark:text-zinc-50">
              Text Chat
            </h1>
          </div>
          <Link
            href="/voice"
            className="text-sm text-blue-600 hover:text-blue-700 transition"
          >
            Switch to Voice &rarr;
          </Link>
        </div>
      </header>

      {/* Chat */}
      <div className="flex-1">
        <ChatInterface />
      </div>
    </div>
  )
}
