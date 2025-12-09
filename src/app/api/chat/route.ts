/**
 * Chat API Route
 * Uses AI SDK with Anthropic for text generation + MCP tools
 * Server-side only - all SDK/MCP/keys stay on the server
 */

import { anthropic } from '@ai-sdk/anthropic'
import { streamText } from 'ai'
import { createMCPTools } from '@/lib/mcp-http-client'

// Allow streaming responses up to 60 seconds
export const maxDuration = 60

// MCP server URL - the i-Universe MCP gateway
const MCP_SERVER_URL = process.env.MCP_SERVER_URL || 'https://i-universe-mcp.vercel.app/api/mcp'

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

  const result = streamText({
    model: anthropic('claude-sonnet-4-20250514'),
    system: `You are a helpful AI assistant with access to browser automation tools via MCP.

You can help users with:
- Navigating to websites
- Taking screenshots
- Clicking elements and filling forms
- Reading page content
- Multi-tab browsing
- And more automation tasks

When a user asks you to interact with a website, use your available tools to accomplish the task.
Be concise and helpful in your responses.`,
    messages,
    tools,
    maxSteps: 10, // Allow multi-step tool use
  })

  return result.toDataStreamResponse()
}
