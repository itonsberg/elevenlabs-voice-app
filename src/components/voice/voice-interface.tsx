'use client'

/**
 * Voice Interface Component
 * Uses ElevenLabs React SDK for real-time voice conversation
 * Features animated WebGL orb that responds to voice
 */

import { useConversation } from '@elevenlabs/react'
import { useState, useCallback } from 'react'
import { VoicePoweredOrb } from '@/components/ui/voice-powered-orb'

// Browser automation URL
const AUTOMATION_URL = process.env.NEXT_PUBLIC_AUTOMATION_URL || 'http://127.0.0.1:9877'

// Helper to safely call automation endpoints with timeout and error handling
async function safeAutomationCall<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ success: boolean; data?: T; error?: string }> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000) // 5s timeout

    const res = await fetch(`${AUTOMATION_URL}${endpoint}`, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })

    clearTimeout(timeout)

    if (!res.ok) {
      return { success: false, error: `HTTP ${res.status}` }
    }

    const data = await res.json()
    return { success: true, data }
  } catch (err) {
    // Don't let fetch errors crash the conversation
    const msg = err instanceof Error ? err.message : 'Connection failed'
    console.warn('[Voice Tool] Automation unavailable:', msg)
    return { success: false, error: 'Browser automation not available. I can still chat with you.' }
  }
}

type Status = 'idle' | 'connecting' | 'connected' | 'listening' | 'speaking' | 'error'

interface Message {
  role: 'user' | 'agent' | 'tool'
  content: string
  timestamp: number
}

interface VoiceInterfaceProps {
  agentId: string
}

export function VoiceInterface({ agentId }: VoiceInterfaceProps) {
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [amplitude, setAmplitude] = useState<number>(0)

  // Create client tools for browser automation
  // IMPORTANT: Only include tools that are configured in ElevenLabs agent dashboard
  // The agent uses MCP server for most tools, only submit_agent_input is a client tool
  const clientTools = {
    // This is the ONLY client tool configured in the ElevenLabs agent
    // All other tools (navigate, click, etc.) are provided via MCP server
    submit_agent_input: async ({ sessionName }: { sessionName: string }) => {
      console.log('[Voice Tool] submit_agent_input:', sessionName)
      // Press Enter to submit the drafted input in the terminal
      const result = await safeAutomationCall('/terminal/key', {
        method: 'POST',
        body: JSON.stringify({ key: 'enter' }),
      })
      if (!result.success) return result.error!
      return (result.data as any)?.success
        ? `Submitted input to ${sessionName}`
        : `Failed: ${(result.data as any)?.error}`
    },
  }

  const conversation = useConversation({
    clientTools,
    onConnect: () => {
      console.log('[Voice] Connected successfully')
      setStatus('connected')
      setError(null)
    },
    onDisconnect: (details) => {
      console.log('[Voice] Disconnected')
      console.log('[Voice] Disconnect details:', details)
      // Log the full details object for debugging
      if (details) {
        console.log('[Voice] Disconnect reason code:', (details as any)?.code)
        console.log('[Voice] Disconnect reason message:', (details as any)?.reason || (details as any)?.message)
      }
      setStatus('idle')
      setAmplitude(0)
    },
    onMessage: (message) => {
      console.log('[Voice] Message:', message)
      if (message.source === 'user' && message.message) {
        setMessages((prev) => [...prev, {
          role: 'user',
          content: message.message,
          timestamp: Date.now(),
        }])
        setStatus('listening')
      } else if (message.source === 'ai' && message.message) {
        setMessages((prev) => [...prev, {
          role: 'agent',
          content: message.message,
          timestamp: Date.now(),
        }])
      }
    },
    onError: (err) => {
      console.error('[Voice] Error:', err)
      // Handle various error formats from ElevenLabs SDK
      let errorMsg = 'Unknown error'
      if (typeof err === 'string') {
        errorMsg = err
      } else if (err && typeof err === 'object') {
        // Handle error object with various properties
        const errObj = err as Record<string, unknown>
        errorMsg = (errObj.message as string) ||
                   (errObj.error as string) ||
                   (errObj.error_type as string) ||
                   JSON.stringify(err)
      }
      // Don't show error for graceful disconnects
      if (errorMsg.includes('undefined') || errorMsg === '{}') {
        console.warn('[Voice] Received malformed error, likely connection closed')
        setStatus('idle')
        return
      }
      setError(errorMsg)
      setStatus('error')
    },
    onModeChange: (mode) => {
      console.log('[Voice] Mode:', mode.mode)
      if (mode.mode === 'speaking') {
        setStatus('speaking')
        setAmplitude(0.6) // Simulated amplitude for orb animation
      } else if (mode.mode === 'listening') {
        setStatus('listening')
        setAmplitude(0.3) // Lower amplitude when listening
      }
    },
  })

  // Note: Audio analysis for amplitude visualization is disabled
  // The ElevenLabs SDK handles audio internally
  // We set amplitude based on status changes instead

  // Fetch signed URL from our API (keeps API key server-side)
  const getSignedUrl = async (): Promise<string | null> => {
    try {
      const response = await fetch('/api/signed-url')
      if (!response.ok) return null
      const data = await response.json()
      return data.signedUrl || null
    } catch {
      return null
    }
  }

  const start = useCallback(async () => {
    if (!agentId) {
      setError('Agent ID is required')
      return
    }

    try {
      setError(null)
      setMessages([])
      setStatus('connecting')

      // Request microphone permission first (ElevenLabs SDK will use it)
      // Don't create our own audio analysis stream - it can interfere with SDK
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true })
        console.log('[Voice] Microphone permission granted')
      } catch (micErr) {
        console.error('[Voice] Microphone permission denied:', micErr)
        setError('Microphone access is required')
        setStatus('error')
        return
      }

      // Get current URL for context (non-blocking)
      try {
        const res = await fetch(`${AUTOMATION_URL}/webview/execute`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ script: 'location.href' }),
        })
        const data = await res.json()
        if (data.success) console.log('[Voice] Current page:', data.result)
      } catch {
        // Ignore - URL not available
      }

      // Try signed URL first (works for private agents)
      // Falls back to agentId if signed URL not available
      const signedUrl = await getSignedUrl()

      if (signedUrl) {
        console.log('[Voice] Using signed URL (WebSocket)')
        console.log('[Voice] Signed URL:', signedUrl.substring(0, 80) + '...')
        const sessionId = await conversation.startSession({
          signedUrl,
          // clientTools are already passed to useConversation hook
        })
        console.log('[Voice] Session started with ID:', sessionId)
      } else {
        console.log('[Voice] Using agentId (WebRTC)')
        const sessionId = await conversation.startSession({
          agentId,
          // clientTools are already passed to useConversation hook
        })
        console.log('[Voice] Session started with ID:', sessionId)
      }
    } catch (err) {
      console.error('[Voice] Start error:', err)
      setError(err instanceof Error ? err.message : 'Failed to start')
      setStatus('error')
    }
  }, [agentId, conversation])

  const stop = useCallback(async () => {
    try {
      console.log('[Voice] Stopping conversation...')
      await conversation.endSession()
      setStatus('idle')
      setAmplitude(0)
      console.log('[Voice] Conversation stopped')
    } catch (err) {
      console.error('[Voice] Stop error:', err)
    }
  }, [conversation])

  const getStatusColor = () => {
    switch (status) {
      case 'connected':
      case 'listening':
        return 'bg-green-500'
      case 'speaking':
        return 'bg-blue-500'
      case 'connecting':
        return 'bg-yellow-500'
      case 'error':
        return 'bg-red-500'
      default:
        return 'bg-gray-400'
    }
  }

  return (
    <div className="flex flex-col items-center gap-6 p-6">
      {/* Status indicator */}
      <div className="flex items-center gap-2">
        <div className={`w-3 h-3 rounded-full ${getStatusColor()} ${
          status === 'listening' || status === 'speaking' ? 'animate-pulse' : ''
        }`} />
        <span className="text-sm font-medium capitalize">{status}</span>
      </div>

      {/* Voice-powered orb visualization */}
      <VoicePoweredOrb
        isSpeaking={status === 'speaking'}
        amplitude={status === 'speaking' || status === 'listening' ? amplitude : 0}
        colorA={status === 'speaking' ? '#3B82F6' : status === 'listening' ? '#22C55E' : '#6B7280'}
        colorB={status === 'speaking' ? '#8B5CF6' : status === 'listening' ? '#10B981' : '#9CA3AF'}
        colorC={status === 'speaking' ? '#06B6D4' : status === 'listening' ? '#34D399' : '#D1D5DB'}
        size={192}
      />

      {/* Control button */}
      <button
        onClick={status === 'idle' || status === 'error' ? start : stop}
        className={`px-8 py-3 rounded-full font-medium text-white transition ${
          status === 'idle' || status === 'error'
            ? 'bg-blue-600 hover:bg-blue-700'
            : 'bg-red-600 hover:bg-red-700'
        }`}
      >
        {status === 'idle' || status === 'error' ? 'Start Conversation' : 'Stop'}
      </button>

      {/* Error display */}
      {error && (
        <div className="bg-red-100 text-red-700 rounded-lg px-4 py-2 text-sm max-w-md">
          {error}
        </div>
      )}

      {/* Messages */}
      <div className="w-full max-w-md space-y-2 max-h-60 overflow-y-auto">
        {messages.slice(-5).map((msg, i) => (
          <div
            key={i}
            className={`text-sm p-2 rounded-lg ${
              msg.role === 'user'
                ? 'bg-blue-100 text-blue-900 ml-8'
                : 'bg-gray-100 text-gray-900 mr-8'
            }`}
          >
            {msg.content}
          </div>
        ))}
      </div>
    </div>
  )
}
