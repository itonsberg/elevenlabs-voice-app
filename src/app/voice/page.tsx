import { VoiceInterface } from '@/components/voice/voice-interface'
import Link from 'next/link'

export default function VoicePage() {
  // Get agent ID from environment variable
  const agentId = process.env.ELEVENLABS_AGENT_ID || ''

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
              Voice Chat
            </h1>
          </div>
          <Link
            href="/chat"
            className="text-sm text-blue-600 hover:text-blue-700 transition"
          >
            Switch to Text &rarr;
          </Link>
        </div>
      </header>

      {/* Voice Interface */}
      <div className="flex-1 flex items-center justify-center">
        {agentId ? (
          <VoiceInterface agentId={agentId} />
        ) : (
          <div className="text-center p-8">
            <p className="text-zinc-600 dark:text-zinc-400 mb-4">
              ElevenLabs Agent ID not configured.
            </p>
            <p className="text-sm text-zinc-500">
              Set <code className="bg-zinc-200 dark:bg-zinc-800 px-2 py-1 rounded">ELEVENLABS_AGENT_ID</code> in your environment variables.
            </p>
            <a
              href="https://elevenlabs.io/app/agents"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mt-4 text-blue-600 hover:text-blue-700"
            >
              Create an agent at ElevenLabs &rarr;
            </a>
          </div>
        )}
      </div>
    </div>
  )
}
