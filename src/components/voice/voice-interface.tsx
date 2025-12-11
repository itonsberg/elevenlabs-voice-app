'use client'

/**
 * Voice Interface Component
 * Uses ElevenLabs React SDK for real-time voice conversation
 * Features animated WebGL orb that responds to voice
 */

import { useConversation } from '@elevenlabs/react'
import { useState, useCallback, useEffect, useRef } from 'react'
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
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animationFrameRef = useRef<number>(0)

  // Create client tools for browser automation
  // IMPORTANT: Tool names must match exactly what's configured in ElevenLabs agent dashboard
  const clientTools = {
    // ==========================================================================
    // Browser Navigation & Interaction (matches ElevenLabs v2 config)
    // ==========================================================================

    navigate: async ({ url }: { url: string }) => {
      console.log('[Voice Tool] navigate:', url)
      const result = await safeAutomationCall('/navigate', {
        method: 'POST',
        body: JSON.stringify({ url }),
      })
      if (!result.success) return result.error!
      return (result.data as any)?.success ? `Navigated to ${url}` : `Failed: ${(result.data as any)?.error}`
    },

    click: async ({ selector, text }: { selector?: string; text?: string }) => {
      console.log('[Voice Tool] click:', selector || text)
      const result = await safeAutomationCall('/webview/click', {
        method: 'POST',
        body: JSON.stringify({ selector, text }),
      })
      if (!result.success) return result.error!
      return (result.data as any)?.success ? `Clicked ${selector || text}` : `Failed: ${(result.data as any)?.error}`
    },

    fill: async ({ selector, value }: { selector: string; value: string }) => {
      console.log('[Voice Tool] fill:', selector, value)
      const result = await safeAutomationCall('/webview/fill', {
        method: 'POST',
        body: JSON.stringify({ selector, value }),
      })
      if (!result.success) return result.error!
      return (result.data as any)?.success ? `Filled ${selector}` : `Failed: ${(result.data as any)?.error}`
    },

    getPageInfo: async () => {
      console.log('[Voice Tool] getPageInfo')
      const result = await safeAutomationCall('/webview/execute', {
        method: 'POST',
        body: JSON.stringify({
          script: 'JSON.stringify({ title: document.title, url: location.href })',
        }),
      })
      if (!result.success) return result.error!
      const data = result.data as any
      if (data?.success) {
        try {
          const info = JSON.parse(data.result)
          return `Page: "${info.title}" at ${info.url}`
        } catch {
          return 'Failed to parse page info'
        }
      }
      return 'Failed to get page info'
    },

    findElements: async ({ selector }: { selector: string }) => {
      console.log('[Voice Tool] findElements:', selector)
      const result = await safeAutomationCall(`/webview/elements?selector=${encodeURIComponent(selector)}`)
      if (!result.success) return result.error!
      const data = result.data as any
      if (data?.elements && data.elements.length > 0) {
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
      const result = await safeAutomationCall('/webview/scroll', {
        method: 'POST',
        body: JSON.stringify(body),
      })
      if (!result.success) return result.error!
      return (result.data as any)?.success ? `Scrolled ${direction}` : `Failed: ${(result.data as any)?.error}`
    },

    goBack: async () => {
      console.log('[Voice Tool] goBack')
      const result = await safeAutomationCall('/webview/back', { method: 'POST' })
      if (!result.success) return result.error!
      return (result.data as any)?.success ? 'Went back' : `Failed: ${(result.data as any)?.error}`
    },

    readText: async ({ selector }: { selector: string }) => {
      console.log('[Voice Tool] readText:', selector)
      const result = await safeAutomationCall('/webview/query', {
        method: 'POST',
        body: JSON.stringify({ selector }),
      })
      if (!result.success) return result.error!
      const data = result.data as any
      return data?.found ? data.text?.slice(0, 300) || '(empty)' : `Not found: ${selector}`
    },

    waitForPage: async () => {
      console.log('[Voice Tool] waitForPage')
      const result = await safeAutomationCall('/webview/wait-navigation', { method: 'POST' })
      if (!result.success) return result.error!
      return (result.data as any)?.success ? 'Page loaded' : `Failed: ${(result.data as any)?.error}`
    },

    screenshot: async ({ preset }: { preset?: string } = {}) => {
      console.log('[Voice Tool] screenshot:', preset)
      const result = await safeAutomationCall(`/screenshot/webview?preset=${preset || 'fast'}`)
      if (!result.success) return result.error!
      const data = result.data as any
      return data?.base64
        ? `Screenshot captured (${data.width}x${data.height})`
        : 'Screenshot failed'
    },

    sendKey: async ({ key }: { key: string }) => {
      console.log('[Voice Tool] sendKey:', key)
      const result = await safeAutomationCall('/webview/key', {
        method: 'POST',
        body: JSON.stringify({ key }),
      })
      if (!result.success) return result.error!
      return (result.data as any)?.success ? `Pressed ${key}` : `Failed: ${(result.data as any)?.error}`
    },

    hover: async ({ selector }: { selector: string }) => {
      console.log('[Voice Tool] hover:', selector)
      const result = await safeAutomationCall('/webview/hover', {
        method: 'POST',
        body: JSON.stringify({ selector }),
      })
      if (!result.success) return result.error!
      return (result.data as any)?.success ? `Hovering over ${selector}` : `Failed: ${(result.data as any)?.error}`
    },

    // ==========================================================================
    // Tab Management
    // ==========================================================================

    createTab: async ({ url }: { url?: string } = {}) => {
      console.log('[Voice Tool] createTab:', url)
      const result = await safeAutomationCall('/tabs/new', {
        method: 'POST',
        body: JSON.stringify({ url }),
      })
      if (!result.success) return result.error!
      return (result.data as any)?.success ? `Created tab${url ? ` at ${url}` : ''}` : `Failed: ${(result.data as any)?.error}`
    },

    listTabs: async () => {
      console.log('[Voice Tool] listTabs')
      const result = await safeAutomationCall('/tabs/list')
      if (!result.success) return result.error!
      const data = result.data as any
      if (data?.tabs && data.tabs.length > 0) {
        const tabs = data.tabs
          .map((t: any) => `${t.id}: "${t.title?.slice(0, 30) || 'Untitled'}"${t.active ? ' (active)' : ''}`)
          .join(', ')
        return `Tabs: ${tabs}`
      }
      return 'No tabs available'
    },

    switchTab: async ({ tabId }: { tabId: string }) => {
      console.log('[Voice Tool] switchTab:', tabId)
      const result = await safeAutomationCall('/tabs/switch', {
        method: 'POST',
        body: JSON.stringify({ tabId }),
      })
      if (!result.success) return result.error!
      return (result.data as any)?.success ? `Switched to tab ${tabId}` : `Failed: ${(result.data as any)?.error}`
    },

    closeTab: async ({ tabId }: { tabId: string }) => {
      console.log('[Voice Tool] closeTab:', tabId)
      const result = await safeAutomationCall('/tabs/close', {
        method: 'POST',
        body: JSON.stringify({ tabId }),
      })
      if (!result.success) return result.error!
      return (result.data as any)?.success ? `Closed tab ${tabId}` : `Failed: ${(result.data as any)?.error}`
    },

    setViewport: async ({ preset }: { preset: string }) => {
      console.log('[Voice Tool] setViewport:', preset)
      const result = await safeAutomationCall('/webview/viewport', {
        method: 'POST',
        body: JSON.stringify({ preset }),
      })
      if (!result.success) return result.error!
      return (result.data as any)?.success ? `Set viewport to ${preset}` : `Failed: ${(result.data as any)?.error}`
    },

    // ==========================================================================
    // Agent Control (matches ElevenLabs v2 config)
    // ==========================================================================

    sendToAgent: async ({ command }: { command: string }) => {
      console.log('[Voice Tool] sendToAgent:', command)
      // Send to the active terminal's agent
      const result = await safeAutomationCall('/terminal/write', {
        method: 'POST',
        body: JSON.stringify({ text: command }),
      })
      if (!result.success) return result.error!
      if ((result.data as any)?.success) {
        // Also send Enter to execute
        await safeAutomationCall('/terminal/key', {
          method: 'POST',
          body: JSON.stringify({ key: 'enter' }),
        })
        return `Command sent to agent: ${command.slice(0, 50)}${command.length > 50 ? '...' : ''}`
      }
      return `Failed: ${(result.data as any)?.error}`
    },

    getAgentOutput: async ({ lines }: { lines?: number } = {}) => {
      console.log('[Voice Tool] getAgentOutput:', lines)
      const params = new URLSearchParams()
      if (lines) params.set('lines', String(lines))
      const result = await safeAutomationCall(`/terminal/output?${params}`)
      if (!result.success) return result.error!
      const data = result.data as any
      if (data?.output) {
        // Return last portion to stay within reasonable response size
        const output = data.output.slice(-1000)
        return output || '(empty output)'
      }
      return `Failed: ${data?.error || 'unknown error'}`
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

  // Setup audio analysis for amplitude visualization
  const setupAudioAnalysis = useCallback(async (stream: MediaStream) => {
    try {
      const audioContext = new AudioContext()
      audioContextRef.current = audioContext

      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 256
      analyserRef.current = analyser

      const source = audioContext.createMediaStreamSource(stream)
      source.connect(analyser)

      const dataArray = new Uint8Array(analyser.frequencyBinCount)

      const updateAmplitude = () => {
        if (!analyserRef.current) return

        analyserRef.current.getByteFrequencyData(dataArray)
        // Calculate average amplitude
        const sum = dataArray.reduce((a, b) => a + b, 0)
        const avg = sum / dataArray.length / 255 // Normalize to 0-1
        setAmplitude(avg)

        animationFrameRef.current = requestAnimationFrame(updateAmplitude)
      }

      updateAmplitude()
    } catch (err) {
      console.error('[Voice] Audio analysis setup error:', err)
    }
  }, [])

  // Cleanup audio analysis
  const cleanupAudioAnalysis = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
    }
    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }
    analyserRef.current = null
    setAmplitude(0)
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupAudioAnalysis()
    }
  }, [cleanupAudioAnalysis])

  const start = useCallback(async () => {
    if (!agentId) {
      setError('Agent ID is required')
      return
    }

    try {
      setError(null)
      setMessages([])
      setStatus('connecting')

      // Request microphone permission and setup audio analysis
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      await setupAudioAnalysis(stream)

      // Get current URL for context
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

      // Start conversation with WebRTC (better quality for voice)
      await conversation.startSession({
        agentId,
        connectionType: 'webrtc',
      })
    } catch (err) {
      console.error('[Voice] Start error:', err)
      setError(err instanceof Error ? err.message : 'Failed to start')
      setStatus('error')
      cleanupAudioAnalysis()
    }
  }, [agentId, conversation, setupAudioAnalysis, cleanupAudioAnalysis])

  const stop = useCallback(async () => {
    try {
      await conversation.endSession()
      cleanupAudioAnalysis()
      setStatus('idle')
    } catch (err) {
      console.error('[Voice] Stop error:', err)
    }
  }, [conversation, cleanupAudioAnalysis])

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
