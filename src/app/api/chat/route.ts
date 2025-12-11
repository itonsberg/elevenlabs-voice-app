/**
 * Chat API Route
 * Uses AI SDK 5 with Vercel AI Gateway for text generation + MCP tools
 * Server-side only - all SDK/MCP/keys stay on the server
 *
 * AI Gateway automatically routes to Anthropic when you use "anthropic/model-name" format
 * Requires VERCEL_AI_GATEWAY_API_KEY env var (set in Vercel dashboard)
 */

import { streamText } from 'ai'
import { createMCPTools } from '@/lib/mcp-http-client'

// Allow streaming responses up to 60 seconds
export const maxDuration = 60

// MCP server URL - Mahana MCP Server (unified tools for voice + browser + terminal)
// Updated 2025-12: Now uses direct i-View HTTP calls instead of Supabase queue
// The /mcp suffix uses the Streamable HTTP transport (mcp-handler requirement)
const MCP_SERVER_URL = process.env.MCP_SERVER_URL || 'https://mahana-mcp-server.vercel.app/api/mcp/mcp'

// Cache tools to avoid fetching on every request
let cachedTools: Awaited<ReturnType<typeof createMCPTools>> | null = null
let toolsCacheTime = 0
const TOOLS_CACHE_TTL = 60000 // 1 minute

async function getTools() {
  const now = Date.now()
  if (cachedTools && (now - toolsCacheTime) < TOOLS_CACHE_TTL) {
    return cachedTools
  }

  try {
    console.log('[Chat API] Fetching MCP tools...')
    cachedTools = await createMCPTools(MCP_SERVER_URL)
    toolsCacheTime = now
    console.log(`[Chat API] Loaded ${cachedTools.toolCount} tools: ${cachedTools.toolNames.join(', ')}`)
    return cachedTools
  } catch (error) {
    console.error('[Chat API] Failed to fetch MCP tools:', error)
    // Return empty tools on error, chat still works without tools
    return { tools: {}, toolCount: 0, toolNames: [] }
  }
}

export async function POST(request: Request) {
  const { messages } = await request.json()

  // Get MCP tools (cached)
  const { tools } = await getTools()

  // AI SDK 5: Use model string format for AI Gateway routing
  // Format: "provider/model-name" - Gateway automatically routes to provider
  // This uses VERCEL_AI_GATEWAY_API_KEY from env (no ANTHROPIC_API_KEY needed!)
  const result = streamText({
    model: 'anthropic/claude-sonnet-4-20250514',
    system: `You are a helpful AI assistant with access to i-View Mini tools via MCP.

You can help users with:
**Terminal & Claude Agents:**
- Run shell commands (run_terminal_command)
- Spawn Claude mini agents (spawn_claude_mini)
- Send messages to Claude agents (send_to_agent)
- List terminals and agents (list_terminals, list_agents)
- Create sessions with optional agent spawn (create_terminal_session)

**Browser Automation:**
- Navigate to URLs (navigate_browser)
- Take screenshots (take_screenshot)
- Click elements (click_element)
- Fill inputs (fill_input)
- Query DOM elements (query_elements)
- Get console logs (get_console_logs)

**System:**
- Health check (get_system_health)
- Full snapshot (get_snapshot)
- Session memory (get_session_memory)
- Broadcast commands (broadcast_command)

When a user asks you to interact with the terminal, browser, or agents, use your available tools.
Be concise and helpful. Commands execute instantly via i-View's HTTP endpoints.`,
    messages,
    tools,
    maxSteps: 10, // Allow multi-step tool use
  })

  // AI SDK 5 uses toUIMessageStreamResponse() for chat UIs
  return result.toUIMessageStreamResponse()
}
