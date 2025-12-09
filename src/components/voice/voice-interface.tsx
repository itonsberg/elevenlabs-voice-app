'use client'

/**
 * Voice Interface Component
 * Uses ElevenLabs React SDK for real-time voice conversation
 */

import { useConversation } from '@elevenlabs/react'
import { useState, useCallback } from 'react'

// Browser automation URL
const AUTOMATION_URL = process.env.NEXT_PUBLIC_AUTOMATION_URL || 'http://127.0.0.1:9877'

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

  // Create client tools for browser automation
  const clientTools = {
    navigate: async ({ url }: { url: string }) => {
      console.log('[Voice Tool] navigate:', url)
      const res = await fetch(`${AUTOMATION_URL}/navigate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      const data = await res.json()
      return data.success ? `Navigated to ${url}` : `Failed: ${data.error}`
    },

    click: async ({ selector, text }: { selector?: string; text?: string }) => {
      console.log('[Voice Tool] click:', selector || text)
      const res = await fetch(`${AUTOMATION_URL}/webview/click`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selector, text }),
      })
      const data = await res.json()
      return data.success ? `Clicked ${selector || text}` : `Failed: ${data.error}`
    },

    screenshot: async () => {
      console.log('[Voice Tool] screenshot')
      const res = await fetch(`${AUTOMATION_URL}/screenshot/webview?preset=fast`)
      const data = await res.json()
      return data.base64
        ? `Screenshot captured (${data.width}x${data.height})`
        : 'Screenshot failed'
    },

    scroll: async ({ direction }: { direction: 'up' | 'down' | 'top' | 'bottom' }) => {
      console.log('[Voice Tool] scroll:', direction)
      const body = direction === 'top' || direction === 'bottom'
        ? { to: direction }
        : { y: direction === 'down' ? 500 : -500 }
      const res = await fetch(`${AUTOMATION_URL}/webview/scroll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      return data.success ? `Scrolled ${direction}` : `Failed: ${data.error}`
    },

    getPageInfo: async () => {
      console.log('[Voice Tool] getPageInfo')
      const res = await fetch(`${AUTOMATION_URL}/webview/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          script: 'JSON.stringify({ title: document.title, url: location.href })',
        }),
      })
      const data = await res.json()
      if (data.success) {
        const info = JSON.parse(data.result)
        return `Page: "${info.title}" at ${info.url}`
      }
      return 'Failed to get page info'
    },

    readText: async ({ selector }: { selector: string }) => {
      console.log('[Voice Tool] readText:', selector)
      const res = await fetch(`${AUTOMATION_URL}/webview/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selector }),
      })
      const data = await res.json()
      return data.found ? data.text?.slice(0, 300) || '(empty)' : `Not found: ${selector}`
    },

    // ==========================================================================
    // Agent Control Tools - Multi-agent orchestration via i-View Mini
    // ==========================================================================

    spawnAgent: async ({ name, command, terminalId }: {
      name: string
      command?: string
      terminalId?: string
    }) => {
      console.log('[Voice Tool] spawnAgent:', name, command, terminalId)
      const res = await fetch(`${AUTOMATION_URL}/agent/spawn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          command: command || `claude -p "You are ${name}. Help the user with their task."`,
          terminalId,
        }),
      })
      const data = await res.json()
      if (data.success) {
        return `Spawned agent "${name}" in terminal ${data.terminalId}${data.created ? ' (new terminal)' : ' (existing)'}`
      }
      return `Failed to spawn agent: ${data.error}`
    },

    sendToAgent: async ({ terminalId, message }: {
      terminalId: string
      message: string
    }) => {
      console.log('[Voice Tool] sendToAgent:', terminalId, message)
      const res = await fetch(`${AUTOMATION_URL}/agent/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ terminalId, message }),
      })
      const data = await res.json()
      return data.success
        ? `Message sent to ${terminalId}`
        : `Failed: ${data.error}`
    },

    getAgentRouter: async () => {
      console.log('[Voice Tool] getAgentRouter')
      const res = await fetch(`${AUTOMATION_URL}/agent/router`)
      const data = await res.json()
      if (data.terminals && Object.keys(data.terminals).length > 0) {
        const agents = Object.entries(data.terminals)
          .map(([id, info]: [string, any]) => `${id}: ${info.agentName || 'unnamed'}`)
          .join(', ')
        return `Active agents: ${agents}`
      }
      return 'No agents currently registered'
    },

    listTerminals: async () => {
      console.log('[Voice Tool] listTerminals')
      const res = await fetch(`${AUTOMATION_URL}/terminal/list`)
      const data = await res.json()
      if (data.terminals && data.terminals.length > 0) {
        const terminals = data.terminals
          .map((t: any) => `${t.id}${t.active ? ' (active)' : ''}`)
          .join(', ')
        return `Terminals: ${terminals}`
      }
      return 'No terminals available'
    },

    getTerminalOutput: async ({ terminalId, lines }: {
      terminalId?: string
      lines?: number
    }) => {
      console.log('[Voice Tool] getTerminalOutput:', terminalId, lines)
      const params = new URLSearchParams()
      if (terminalId) params.set('terminalId', terminalId)
      if (lines) params.set('lines', String(lines))
      const res = await fetch(`${AUTOMATION_URL}/terminal/output?${params}`)
      const data = await res.json()
      if (data.output) {
        // Return last portion to stay within reasonable response size
        const output = data.output.slice(-1000)
        return output || '(empty output)'
      }
      return `Failed: ${data.error || 'unknown error'}`
    },

    broadcastToAgents: async ({ message }: { message: string }) => {
      console.log('[Voice Tool] broadcastToAgents:', message)
      const res = await fetch(`${AUTOMATION_URL}/agent/broadcast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      })
      const data = await res.json()
      return data.success
        ? `Broadcast sent to ${data.sentTo?.length || 0} agents`
        : `Failed: ${data.error}`
    },

    getAgentPulse: async ({ terminalId }: { terminalId?: string }) => {
      console.log('[Voice Tool] getAgentPulse:', terminalId)
      const params = terminalId ? `?terminalId=${terminalId}` : ''
      const res = await fetch(`${AUTOMATION_URL}/agent/pulse${params}`)
      const data = await res.json()
      if (data.pulse) {
        return `${data.pulse} (${data.status}, ${data.activityLevel} activity)`
      }
      return `Status: ${data.status || 'unknown'}`
    },

    getAgentStatus: async ({ terminalId }: { terminalId?: string }) => {
      console.log('[Voice Tool] getAgentStatus:', terminalId)
      const params = terminalId ? `?terminalId=${terminalId}` : ''
      const res = await fetch(`${AUTOMATION_URL}/agent/status${params}`)
      const data = await res.json()
      if (data.isActive) {
        return `Agent ${data.isThinking ? 'is thinking' : data.isIdle ? 'is idle' : 'is active'}`
      }
      return 'No agent detected'
    },

    waitForAgent: async ({ terminalId, timeoutMs }: {
      terminalId?: string
      timeoutMs?: number
    }) => {
      console.log('[Voice Tool] waitForAgent:', terminalId, timeoutMs)
      const res = await fetch(`${AUTOMATION_URL}/agent/wait-done`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ terminalId, timeoutMs: timeoutMs || 30000 }),
      })
      const data = await res.json()
      return data.summary || `Waited ${data.waitedMs}ms${data.timedOut ? ' (timed out)' : ''}`
    },

    // ==========================================================================
    // Voice Pulse - Quick situational awareness
    // ==========================================================================

    getVoicePulse: async () => {
      console.log('[Voice Tool] getVoicePulse')
      const res = await fetch(`${AUTOMATION_URL}/voice/pulse`)
      const data = await res.json()
      return data.voiceSummary || 'Unable to get status'
    },

    // ==========================================================================
    // Session Management
    // ==========================================================================

    listSessions: async () => {
      console.log('[Voice Tool] listSessions')
      const res = await fetch(`${AUTOMATION_URL}/session/list`)
      const data = await res.json()
      if (data.sessions && data.sessions.length > 0) {
        const sessions = data.sessions
          .map((s: { id: string; name: string; active?: boolean }) =>
            `${s.name}${s.active ? ' (active)' : ''}`)
          .join(', ')
        return `Sessions: ${sessions}`
      }
      return 'No sessions'
    },

    switchSession: async ({ name }: { name: string }) => {
      console.log('[Voice Tool] switchSession:', name)
      // First find the session by name
      const listRes = await fetch(`${AUTOMATION_URL}/session/list`)
      const listData = await listRes.json()
      const session = listData.sessions?.find((s: { name: string }) =>
        s.name.toLowerCase().includes(name.toLowerCase()))

      if (!session) {
        return `Session "${name}" not found`
      }

      const res = await fetch(`${AUTOMATION_URL}/session/switch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: session.id }),
      })
      const data = await res.json()
      return data.success ? `Switched to session "${session.name}"` : `Failed: ${data.error}`
    },
  }

  const conversation = useConversation({
    clientTools,
    onConnect: () => {
      console.log('[Voice] Connected')
      setStatus('connected')
      setError(null)
    },
    onDisconnect: () => {
      console.log('[Voice] Disconnected')
      setStatus('idle')
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
      const errorMsg = typeof err === 'string' ? err : (err as Error)?.message || 'Unknown error'
      setError(errorMsg)
      setStatus('error')
    },
    onModeChange: (mode) => {
      console.log('[Voice] Mode:', mode.mode)
      if (mode.mode === 'speaking') {
        setStatus('speaking')
      } else if (mode.mode === 'listening') {
        setStatus('listening')
      }
    },
  })

  const start = useCallback(async () => {
    if (!agentId) {
      setError('Agent ID is required')
      return
    }

    try {
      setError(null)
      setMessages([])
      setStatus('connecting')

      // Request microphone permission
      await navigator.mediaDevices.getUserMedia({ audio: true })

      // Get current URL for context
      let currentUrl = ''
      try {
        const res = await fetch(`${AUTOMATION_URL}/webview/execute`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ script: 'location.href' }),
        })
        const data = await res.json()
        if (data.success) currentUrl = data.result
      } catch {
        // Ignore - URL not available
      }

      // Start conversation with WebRTC (better quality for voice)
      await conversation.startSession({
        agentId,
        connectionType: 'webrtc',
      })
    } catch (err) {
      console.error('[Voice] Start error:', err)
      setError(err instanceof Error ? err.message : 'Failed to start')
      setStatus('error')
    }
  }, [agentId, conversation])

  const stop = useCallback(async () => {
    try {
      await conversation.endSession()
      setStatus('idle')
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

      {/* Audio visualizer placeholder */}
      <div className="w-48 h-48 rounded-full bg-gray-100 flex items-center justify-center">
        {status === 'speaking' ? (
          <div className="flex gap-1">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="w-2 bg-blue-500 rounded-full animate-pulse"
                style={{
                  height: `${20 + Math.random() * 40}px`,
                  animationDelay: `${i * 100}ms`,
                }}
              />
            ))}
          </div>
        ) : status === 'listening' ? (
          <div className="w-16 h-16 rounded-full bg-green-500 animate-pulse" />
        ) : (
          <div className="w-16 h-16 rounded-full bg-gray-300" />
        )}
      </div>

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
