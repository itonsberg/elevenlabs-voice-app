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
  // IMPORTANT: Tool names must match exactly what's configured in ElevenLabs agent dashboard
  const clientTools = {
    // ==========================================================================
    // Browser Navigation & Interaction (matches ElevenLabs v2 config)
    // ==========================================================================

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

    fill: async ({ selector, value }: { selector: string; value: string }) => {
      console.log('[Voice Tool] fill:', selector, value)
      const res = await fetch(`${AUTOMATION_URL}/webview/fill`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selector, value }),
      })
      const data = await res.json()
      return data.success ? `Filled ${selector}` : `Failed: ${data.error}`
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

    findElements: async ({ selector }: { selector: string }) => {
      console.log('[Voice Tool] findElements:', selector)
      const res = await fetch(`${AUTOMATION_URL}/webview/elements?selector=${encodeURIComponent(selector)}`)
      const data = await res.json()
      if (data.elements && data.elements.length > 0) {
        const summary = data.elements.slice(0, 5).map((el: any) =>
          `${el.tag}${el.text ? `: "${el.text.slice(0, 30)}"` : ''}`
        ).join(', ')
        return `Found ${data.count} elements: ${summary}${data.count > 5 ? '...' : ''}`
      }
      return `No elements found for: ${selector}`
    },

    scroll: async ({ direction, amount }: { direction: string; amount?: number }) => {
      console.log('[Voice Tool] scroll:', direction, amount)
      const body = direction === 'top' || direction === 'bottom'
        ? { to: direction }
        : { y: direction === 'down' ? (amount || 500) : -(amount || 500) }
      const res = await fetch(`${AUTOMATION_URL}/webview/scroll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      return data.success ? `Scrolled ${direction}` : `Failed: ${data.error}`
    },

    goBack: async () => {
      console.log('[Voice Tool] goBack')
      const res = await fetch(`${AUTOMATION_URL}/webview/back`, {
        method: 'POST',
      })
      const data = await res.json()
      return data.success ? 'Went back' : `Failed: ${data.error}`
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

    waitForPage: async () => {
      console.log('[Voice Tool] waitForPage')
      const res = await fetch(`${AUTOMATION_URL}/webview/wait-navigation`, {
        method: 'POST',
      })
      const data = await res.json()
      return data.success ? 'Page loaded' : `Failed: ${data.error}`
    },

    screenshot: async ({ preset }: { preset?: string } = {}) => {
      console.log('[Voice Tool] screenshot:', preset)
      const res = await fetch(`${AUTOMATION_URL}/screenshot/webview?preset=${preset || 'fast'}`)
      const data = await res.json()
      return data.base64
        ? `Screenshot captured (${data.width}x${data.height})`
        : 'Screenshot failed'
    },

    sendKey: async ({ key }: { key: string }) => {
      console.log('[Voice Tool] sendKey:', key)
      const res = await fetch(`${AUTOMATION_URL}/webview/key`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key }),
      })
      const data = await res.json()
      return data.success ? `Pressed ${key}` : `Failed: ${data.error}`
    },

    hover: async ({ selector }: { selector: string }) => {
      console.log('[Voice Tool] hover:', selector)
      const res = await fetch(`${AUTOMATION_URL}/webview/hover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selector }),
      })
      const data = await res.json()
      return data.success ? `Hovering over ${selector}` : `Failed: ${data.error}`
    },

    // ==========================================================================
    // Tab Management
    // ==========================================================================

    createTab: async ({ url }: { url?: string } = {}) => {
      console.log('[Voice Tool] createTab:', url)
      const res = await fetch(`${AUTOMATION_URL}/tabs/new`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      const data = await res.json()
      return data.success ? `Created tab${url ? ` at ${url}` : ''}` : `Failed: ${data.error}`
    },

    listTabs: async () => {
      console.log('[Voice Tool] listTabs')
      const res = await fetch(`${AUTOMATION_URL}/tabs/list`)
      const data = await res.json()
      if (data.tabs && data.tabs.length > 0) {
        const tabs = data.tabs
          .map((t: any) => `${t.id}: "${t.title?.slice(0, 30) || 'Untitled'}"${t.active ? ' (active)' : ''}`)
          .join(', ')
        return `Tabs: ${tabs}`
      }
      return 'No tabs available'
    },

    switchTab: async ({ tabId }: { tabId: string }) => {
      console.log('[Voice Tool] switchTab:', tabId)
      const res = await fetch(`${AUTOMATION_URL}/tabs/switch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tabId }),
      })
      const data = await res.json()
      return data.success ? `Switched to tab ${tabId}` : `Failed: ${data.error}`
    },

    closeTab: async ({ tabId }: { tabId: string }) => {
      console.log('[Voice Tool] closeTab:', tabId)
      const res = await fetch(`${AUTOMATION_URL}/tabs/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tabId }),
      })
      const data = await res.json()
      return data.success ? `Closed tab ${tabId}` : `Failed: ${data.error}`
    },

    setViewport: async ({ preset }: { preset: string }) => {
      console.log('[Voice Tool] setViewport:', preset)
      const res = await fetch(`${AUTOMATION_URL}/webview/viewport`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preset }),
      })
      const data = await res.json()
      return data.success ? `Set viewport to ${preset}` : `Failed: ${data.error}`
    },

    // ==========================================================================
    // Agent Control (matches ElevenLabs v2 config)
    // ==========================================================================

    sendToAgent: async ({ command }: { command: string }) => {
      console.log('[Voice Tool] sendToAgent:', command)
      // Send to the active terminal's agent
      const res = await fetch(`${AUTOMATION_URL}/terminal/write`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: command }),
      })
      const data = await res.json()
      if (data.success) {
        // Also send Enter to execute
        await fetch(`${AUTOMATION_URL}/terminal/key`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: 'enter' }),
        })
        return `Command sent to agent: ${command.slice(0, 50)}${command.length > 50 ? '...' : ''}`
      }
      return `Failed: ${data.error}`
    },

    getAgentOutput: async ({ lines }: { lines?: number } = {}) => {
      console.log('[Voice Tool] getAgentOutput:', lines)
      const params = new URLSearchParams()
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

    speak: async ({ text }: { text: string }) => {
      console.log('[Voice Tool] speak:', text)
      // This is handled by ElevenLabs TTS directly, but we log for debugging
      return `Speaking: ${text.slice(0, 50)}${text.length > 50 ? '...' : ''}`
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
