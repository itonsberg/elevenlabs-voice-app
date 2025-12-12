'use client'

/**
 * Voice Interface Component
 * Uses ElevenLabs React SDK for real-time voice conversation
 * Features animated WebGL orb that responds to voice
 *
 * All browser automation tools run as CLIENT TOOLS (in browser)
 * because the ElevenLabs MCP server cannot reach localhost:9877
 */

import { useConversation } from '@elevenlabs/react'
import { useState, useCallback } from 'react'
import { VoicePoweredOrb } from '@/components/ui/voice-powered-orb'

// Browser automation URL - runs locally in i-View Mini
const AUTOMATION_URL = process.env.NEXT_PUBLIC_AUTOMATION_URL || 'http://127.0.0.1:9877'

// Helper to safely call automation endpoints with timeout and error handling
async function safeAutomationCall<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ success: boolean; data?: T; error?: string }> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000) // 8s timeout for complex ops

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
    const msg = err instanceof Error ? err.message : 'Connection failed'
    console.warn('[Voice Tool] Automation unavailable:', msg)
    return { success: false, error: `Automation unavailable: ${msg}` }
  }
}

// Helper to format terminal output for voice response
function formatTerminalOutput(output: string, maxLines = 10): string {
  const lines = output.split('\n').filter(l => l.trim())
  if (lines.length <= maxLines) return lines.join('\n')
  return [...lines.slice(0, maxLines), `... (${lines.length - maxLines} more lines)`].join('\n')
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

  // ============================================================================
  // CLIENT TOOLS - All run in browser (can reach localhost:9877)
  // These replace the MCP server tools since ElevenLabs can't reach localhost
  // ============================================================================
  const clientTools = {
    // -------------------------------------------------------------------------
    // BROWSER NAVIGATION & INTERACTION
    // -------------------------------------------------------------------------

    navigate: async ({ url }: { url: string }) => {
      console.log('[Voice Tool] navigate:', url)
      const fullUrl = url.startsWith('http') ? url : `https://${url}`
      const result = await safeAutomationCall('/navigate', {
        method: 'POST',
        body: JSON.stringify({ url: fullUrl }),
      })
      if (!result.success) return result.error!
      // Wait for navigation to complete
      await safeAutomationCall('/webview/wait-navigation', { method: 'POST' })
      return `Navigated to ${fullUrl}`
    },

    click: async ({ selector, text }: { selector?: string; text?: string }) => {
      console.log('[Voice Tool] click:', selector || text)
      const result = await safeAutomationCall('/webview/click', {
        method: 'POST',
        body: JSON.stringify(text ? { text } : { selector }),
      })
      if (!result.success) return result.error!
      return (result.data as any)?.success
        ? `Clicked ${text || selector}`
        : `Click failed: ${(result.data as any)?.error}`
    },

    fill: async ({ selector, value, text }: { selector?: string; value: string; text?: string }) => {
      console.log('[Voice Tool] fill:', selector || text, value)
      const result = await safeAutomationCall('/webview/fill', {
        method: 'POST',
        body: JSON.stringify({ selector, value, text }),
      })
      if (!result.success) return result.error!
      return (result.data as any)?.success
        ? `Filled "${value}" into ${text || selector}`
        : `Fill failed: ${(result.data as any)?.error}`
    },

    scroll: async ({ direction }: { direction: 'up' | 'down' | 'top' | 'bottom' }) => {
      console.log('[Voice Tool] scroll:', direction)
      const result = await safeAutomationCall('/webview/scroll', {
        method: 'POST',
        body: JSON.stringify({ direction }),
      })
      if (!result.success) return result.error!
      return `Scrolled ${direction}`
    },

    press_key: async ({ key }: { key: string }) => {
      console.log('[Voice Tool] press_key:', key)
      const result = await safeAutomationCall('/webview/key', {
        method: 'POST',
        body: JSON.stringify({ key }),
      })
      if (!result.success) return result.error!
      return `Pressed ${key}`
    },

    hover: async ({ selector, text }: { selector?: string; text?: string }) => {
      console.log('[Voice Tool] hover:', selector || text)
      const result = await safeAutomationCall('/webview/hover', {
        method: 'POST',
        body: JSON.stringify(text ? { text } : { selector }),
      })
      if (!result.success) return result.error!
      return `Hovering over ${text || selector}`
    },

    // -------------------------------------------------------------------------
    // BROWSER OBSERVATION
    // -------------------------------------------------------------------------

    get_page_info: async () => {
      console.log('[Voice Tool] get_page_info')
      const result = await safeAutomationCall<{ url: string; title: string }>('/webview/page-info')
      if (!result.success) return result.error!
      const { url, title } = result.data!
      return `Page: ${title}\nURL: ${url}`
    },

    get_elements: async ({ selector }: { selector: string }) => {
      console.log('[Voice Tool] get_elements:', selector)
      const result = await safeAutomationCall<{ elements: any[] }>(`/webview/elements?selector=${encodeURIComponent(selector)}`)
      if (!result.success) return result.error!
      const elements = result.data?.elements || []
      if (elements.length === 0) return `No elements found matching "${selector}"`
      return `Found ${elements.length} elements:\n${elements.slice(0, 10).map((e: any) => `- ${e.text || e.tagName || 'element'}`).join('\n')}`
    },

    get_buttons: async () => {
      console.log('[Voice Tool] get_buttons')
      const result = await safeAutomationCall<{ elements: any[] }>('/webview/elements?selector=button')
      if (!result.success) return result.error!
      const buttons = result.data?.elements || []
      if (buttons.length === 0) return 'No buttons found on page'
      return `Found ${buttons.length} buttons:\n${buttons.slice(0, 15).map((b: any) => `- "${b.text || b.innerText || 'unnamed'}"`).join('\n')}`
    },

    get_inputs: async () => {
      console.log('[Voice Tool] get_inputs')
      const result = await safeAutomationCall<{ elements: any[] }>('/webview/elements?selector=input,textarea,select')
      if (!result.success) return result.error!
      const inputs = result.data?.elements || []
      if (inputs.length === 0) return 'No input fields found on page'
      return `Found ${inputs.length} inputs:\n${inputs.slice(0, 15).map((i: any) => `- ${i.placeholder || i.name || i.id || i.type || 'input'}`).join('\n')}`
    },

    get_links: async () => {
      console.log('[Voice Tool] get_links')
      const result = await safeAutomationCall<{ elements: any[] }>('/webview/elements?selector=a')
      if (!result.success) return result.error!
      const links = result.data?.elements || []
      if (links.length === 0) return 'No links found on page'
      return `Found ${links.length} links:\n${links.slice(0, 15).map((l: any) => `- "${l.text || l.innerText || 'link'}"`).join('\n')}`
    },

    get_console_errors: async () => {
      console.log('[Voice Tool] get_console_errors')
      const result = await safeAutomationCall<{ errors: any[] }>('/webview/errors')
      if (!result.success) return result.error!
      const errors = result.data?.errors || []
      if (errors.length === 0) return 'No console errors found'
      return `Found ${errors.length} errors:\n${errors.slice(0, 5).map((e: any) => `- ${e.message || e}`).join('\n')}`
    },

    // -------------------------------------------------------------------------
    // TERMINAL OPERATIONS
    // -------------------------------------------------------------------------

    get_terminal_output: async ({ lines, terminalId }: { lines?: number; terminalId?: string }) => {
      console.log('[Voice Tool] get_terminal_output:', { lines, terminalId })
      const params = new URLSearchParams()
      if (lines) params.set('lines', String(lines))
      if (terminalId) params.set('terminalId', terminalId)
      const result = await safeAutomationCall<{ output: string; lines: string[] }>(`/terminal/output?${params}`)
      if (!result.success) return result.error!
      const output = result.data?.output || result.data?.lines?.join('\n') || ''
      return formatTerminalOutput(output, lines || 20)
    },

    run_command: async ({ command }: { command: string }) => {
      console.log('[Voice Tool] run_command:', command)
      // Write command then press enter
      const writeResult = await safeAutomationCall('/terminal/write', {
        method: 'POST',
        body: JSON.stringify({ text: command }),
      })
      if (!writeResult.success) return writeResult.error!

      const enterResult = await safeAutomationCall('/terminal/key', {
        method: 'POST',
        body: JSON.stringify({ key: 'enter' }),
      })
      if (!enterResult.success) return enterResult.error!

      // Wait a moment for output
      await new Promise(r => setTimeout(r, 1000))

      // Get the output
      const outputResult = await safeAutomationCall<{ output: string }>('/terminal/output?lines=20')
      const output = outputResult.data?.output || ''
      return `Ran: ${command}\n${formatTerminalOutput(output, 15)}`
    },

    terminal_write: async ({ text }: { text: string }) => {
      console.log('[Voice Tool] terminal_write:', text)
      const result = await safeAutomationCall('/terminal/write', {
        method: 'POST',
        body: JSON.stringify({ text }),
      })
      if (!result.success) return result.error!
      return `Wrote to terminal: ${text}`
    },

    terminal_key: async ({ key }: { key: string }) => {
      console.log('[Voice Tool] terminal_key:', key)
      const result = await safeAutomationCall('/terminal/key', {
        method: 'POST',
        body: JSON.stringify({ key }),
      })
      if (!result.success) return result.error!
      return `Sent key: ${key}`
    },

    submit_agent_input: async ({ sessionName }: { sessionName?: string }) => {
      console.log('[Voice Tool] submit_agent_input:', sessionName)
      const result = await safeAutomationCall('/terminal/key', {
        method: 'POST',
        body: JSON.stringify({ key: 'enter' }),
      })
      if (!result.success) return result.error!
      return `Submitted input${sessionName ? ` to ${sessionName}` : ''}`
    },

    list_terminals: async () => {
      console.log('[Voice Tool] list_terminals')
      const result = await safeAutomationCall<{ terminals: any[] }>('/terminal/list')
      if (!result.success) return result.error!
      const terminals = result.data?.terminals || []
      if (terminals.length === 0) return 'No terminals open'
      return `${terminals.length} terminals:\n${terminals.map((t: any) => `- ${t.id || t.name}: ${t.title || 'terminal'}`).join('\n')}`
    },

    create_terminal: async ({ name }: { name?: string }) => {
      console.log('[Voice Tool] create_terminal:', name)
      const result = await safeAutomationCall('/terminal/create', {
        method: 'POST',
        body: JSON.stringify({ name }),
      })
      if (!result.success) return result.error!
      return `Created terminal${name ? ` "${name}"` : ''}`
    },

    // -------------------------------------------------------------------------
    // CLAUDE AGENT OPERATIONS
    // -------------------------------------------------------------------------

    spawn_claude_mini: async ({ task }: { task?: string }) => {
      console.log('[Voice Tool] spawn_claude_mini:', task)
      const result = await safeAutomationCall('/quick/mini', {
        method: 'POST',
        body: JSON.stringify({ task }),
      })
      if (!result.success) return result.error!
      return `Spawned Claude mini${task ? ` with task: ${task}` : ''}`
    },

    send_to_agent: async ({ message, terminalId }: { message: string; terminalId?: string }) => {
      console.log('[Voice Tool] send_to_agent:', message)
      const result = await safeAutomationCall('/quick/agent', {
        method: 'POST',
        body: JSON.stringify({ message, terminalId }),
      })
      if (!result.success) return result.error!
      return `Sent to agent: ${message}`
    },

    list_agents: async () => {
      console.log('[Voice Tool] list_agents')
      const result = await safeAutomationCall<{ agents: any[] }>('/quick/agents')
      if (!result.success) return result.error!
      const agents = result.data?.agents || []
      if (agents.length === 0) return 'No Claude agents running'
      return `${agents.length} agents:\n${agents.map((a: any) => `- ${a.id}: ${a.status || 'active'}`).join('\n')}`
    },

    // -------------------------------------------------------------------------
    // TAB MANAGEMENT
    // -------------------------------------------------------------------------

    list_tabs: async () => {
      console.log('[Voice Tool] list_tabs')
      const result = await safeAutomationCall<{ tabs: any[] }>('/tabs/list')
      if (!result.success) return result.error!
      const tabs = result.data?.tabs || []
      if (tabs.length === 0) return 'No tabs open'
      return `${tabs.length} tabs:\n${tabs.map((t: any) => `- ${t.title || t.url || 'tab'}`).join('\n')}`
    },

    open_tab: async ({ url }: { url: string }) => {
      console.log('[Voice Tool] open_tab:', url)
      const fullUrl = url.startsWith('http') ? url : `https://${url}`
      const result = await safeAutomationCall('/tabs/open', {
        method: 'POST',
        body: JSON.stringify({ url: fullUrl }),
      })
      if (!result.success) return result.error!
      return `Opened tab: ${fullUrl}`
    },

    close_tab: async ({ tabId }: { tabId?: string }) => {
      console.log('[Voice Tool] close_tab:', tabId)
      const result = await safeAutomationCall('/tabs/close', {
        method: 'POST',
        body: JSON.stringify({ tabId }),
      })
      if (!result.success) return result.error!
      return tabId ? `Closed tab ${tabId}` : 'Closed current tab'
    },

    // -------------------------------------------------------------------------
    // SYSTEM STATUS & SHORTCUTS
    // -------------------------------------------------------------------------

    reload_page: async () => {
      console.log('[Voice Tool] reload_page')
      const result = await safeAutomationCall('/input/logical', {
        method: 'POST',
        body: JSON.stringify({ action: 'RELOAD_APP' }),
      })
      if (!result.success) return result.error!
      return 'Reloaded the page'
    },

    open_devtools: async () => {
      console.log('[Voice Tool] open_devtools')
      const result = await safeAutomationCall('/input/logical', {
        method: 'POST',
        body: JSON.stringify({ action: 'OPEN_DEVTOOLS' }),
      })
      if (!result.success) return result.error!
      return 'Opened DevTools'
    },

    focus_terminal: async () => {
      console.log('[Voice Tool] focus_terminal')
      const result = await safeAutomationCall('/input/logical', {
        method: 'POST',
        body: JSON.stringify({ action: 'FOCUS_TERMINAL' }),
      })
      if (!result.success) return result.error!
      return 'Focused terminal'
    },

    focus_browser: async () => {
      console.log('[Voice Tool] focus_browser')
      const result = await safeAutomationCall('/input/logical', {
        method: 'POST',
        body: JSON.stringify({ action: 'FOCUS_WEBVIEW' }),
      })
      if (!result.success) return result.error!
      return 'Focused browser'
    },

    interrupt_process: async () => {
      console.log('[Voice Tool] interrupt_process')
      const result = await safeAutomationCall('/input/logical', {
        method: 'POST',
        body: JSON.stringify({ action: 'INTERRUPT_PROCESS' }),
      })
      if (!result.success) return result.error!
      return 'Interrupted process (Ctrl+C)'
    },

    go_back: async () => {
      console.log('[Voice Tool] go_back')
      const result = await safeAutomationCall('/input/logical', {
        method: 'POST',
        body: JSON.stringify({ action: 'GO_BACK' }),
      })
      if (!result.success) return result.error!
      return 'Went back'
    },

    go_forward: async () => {
      console.log('[Voice Tool] go_forward')
      const result = await safeAutomationCall('/input/logical', {
        method: 'POST',
        body: JSON.stringify({ action: 'GO_FORWARD' }),
      })
      if (!result.success) return result.error!
      return 'Went forward'
    },

    health_check: async () => {
      console.log('[Voice Tool] health_check')
      const result = await safeAutomationCall<{ status: string; uptime: number }>('/quick/health')
      if (!result.success) return result.error!
      return `System healthy. Uptime: ${Math.round((result.data?.uptime || 0) / 1000)}s`
    },

    get_system_status: async () => {
      console.log('[Voice Tool] get_system_status')
      const result = await safeAutomationCall<any>('/quick/snapshot')
      if (!result.success) return result.error!
      const data = result.data || {}
      return `System Status:
- Terminals: ${data.terminals?.length || 0}
- Tabs: ${data.tabs?.length || 0}
- Active tab: ${data.activeTab?.title || 'none'}
- URL: ${data.url || 'none'}`
    },

    // -------------------------------------------------------------------------
    // MEMORY & KNOWLEDGE
    // -------------------------------------------------------------------------

    remember: async ({ content }: { content: string }) => {
      console.log('[Voice Tool] remember:', content)
      const result = await safeAutomationCall('/memory/save', {
        method: 'POST',
        body: JSON.stringify({ content, source: 'voice' }),
      })
      if (!result.success) return result.error!
      return `Remembered: ${content}`
    },

    recall: async ({ query }: { query: string }) => {
      console.log('[Voice Tool] recall:', query)
      const result = await safeAutomationCall<{ memories: any[] }>(`/memory/query?q=${encodeURIComponent(query)}`)
      if (!result.success) return result.error!
      const memories = result.data?.memories || []
      if (memories.length === 0) return `No memories found for "${query}"`
      return `Found ${memories.length} memories:\n${memories.slice(0, 5).map((m: any) => `- ${m.content}`).join('\n')}`
    },

    get_knowledge: async ({ category }: { category?: string }) => {
      console.log('[Voice Tool] get_knowledge:', category)
      const url = category ? `/knowledge?category=${encodeURIComponent(category)}` : '/knowledge'
      const result = await safeAutomationCall<{ entries: any[] }>(url)
      if (!result.success) return result.error!
      const entries = result.data?.entries || []
      if (entries.length === 0) return 'No knowledge entries found'
      return `${entries.length} entries:\n${entries.slice(0, 5).map((e: any) => `- ${e.title || e.content?.substring(0, 50)}`).join('\n')}`
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
