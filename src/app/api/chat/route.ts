/**
 * Chat API Route
 * Uses AI SDK 6 with custom MCP HTTP client for i-View MCP server
 *
 * Note: Uses pure HTTP POST for MCP - no SSE required.
 * Compatible with Vercel serverless (no long-lived connections).
 *
 * FIX: Uses Gateway with 'only: ["anthropic"]' to avoid Bedrock.
 * Bedrock has stricter schema validation that strips type:object.
 * See: https://vercel.com/docs/ai-gateway/provider-options
 */

import { ToolLoopAgent, createAgentUIStreamResponse, stepCountIs, createGateway, type UIMessage, type ToolSet } from 'ai'
import { createMCPTools } from '@/lib/mcp-http-client'

/**
 * Tool categories for progressive disclosure
 * Safe tools are always available, others unlock based on context
 */
const TOOL_CATEGORIES = {
  // Always available - read-only, safe operations
  safe: [
    'get_current_time',
    'list_devices',
    'get_page_info',
    'get_page_elements',
    'list_tabs',
    'get_terminal_output',
    'list_terminals',
    'get_session_info',
    'list_sessions',
    'recall_memory',
    'get_console_logs',
    'list_viewport_presets',
    'visual_list_baselines',
    'voice_status',
    'supabase_query',
  ],
  // Navigation tools - unlock interaction
  navigation: [
    'navigate_browser',
    'create_tab',
    'switch_tab',
  ],
  // Interaction tools - require navigation first
  interaction: [
    'click_element',
    'fill_input',
    'scroll_page',
    'hover_element',
    'send_key',
    'wait_for_element',
    'query_element',
    'execute_javascript',
    'take_screenshot',
    'set_viewport',
    'visual_save_baseline',
    'visual_compare',
  ],
  // Terminal tools - potentially dangerous
  terminal: [
    'send_terminal_command',
    'create_terminal',
    'spawn_claude_session',
    'send_to_session',
    'broadcast_to_agents',
  ],
  // Database write tools - require explicit intent
  database_write: [
    'supabase_insert',
    'supabase_update',
    'supabase_delete',
  ],
  // Destructive tools - need confirmation context
  destructive: [
    'close_tab',
  ],
  // Memory tools
  memory: [
    'store_memory',
  ],
  // Voice tools
  voice: [
    'voice_speak',
    'voice_start_listening',
    'voice_stop_listening',
  ],
  // Agent draft tools
  agent_draft: [
    'draft_to_agent',
    'get_agent_input',
    'edit_agent_input',
    'clear_agent_input',
    'get_agent_conversation',
    'wait_for_agent_response',
    'list_agent_sessions',
    'get_session_output',
  ],
}

/**
 * Determine which tools to enable based on conversation state
 */
function getEnabledTools(
  allTools: ToolSet,
  previousSteps: Array<{ toolCalls?: Array<{ toolName: string }> }>
): ToolSet {
  const usedTools = new Set(
    previousSteps.flatMap(s => s.toolCalls?.map(c => c.toolName) || [])
  )

  // Track what's been done
  const hasNavigated = usedTools.has('navigate_browser') || usedTools.has('create_tab')
  const hasListedDevices = usedTools.has('list_devices')

  // Count screenshot usage for rate limiting
  const screenshotCount = previousSteps.filter(
    s => s.toolCalls?.some(c => c.toolName === 'take_screenshot')
  ).length

  // Build enabled tool list
  const enabledToolNames = new Set<string>()

  // Always enable safe tools
  TOOL_CATEGORIES.safe.forEach(t => enabledToolNames.add(t))

  // Always enable navigation (how else would they start?)
  TOOL_CATEGORIES.navigation.forEach(t => enabledToolNames.add(t))

  // Enable interaction tools only after navigation
  if (hasNavigated) {
    TOOL_CATEGORIES.interaction.forEach(t => enabledToolNames.add(t))

    // Rate limit screenshots (max 5 per conversation)
    if (screenshotCount >= 5) {
      enabledToolNames.delete('take_screenshot')
    }
  }

  // Enable terminal tools (always available but logged)
  TOOL_CATEGORIES.terminal.forEach(t => enabledToolNames.add(t))

  // Enable database write tools (always available for now)
  TOOL_CATEGORIES.database_write.forEach(t => enabledToolNames.add(t))

  // Enable destructive tools only if tabs exist
  if (hasNavigated || usedTools.has('list_tabs')) {
    TOOL_CATEGORIES.destructive.forEach(t => enabledToolNames.add(t))
  }

  // Memory tools always available
  TOOL_CATEGORIES.memory.forEach(t => enabledToolNames.add(t))

  // Voice tools always available
  TOOL_CATEGORIES.voice.forEach(t => enabledToolNames.add(t))

  // Agent draft tools always available
  TOOL_CATEGORIES.agent_draft.forEach(t => enabledToolNames.add(t))

  // Filter to only enabled tools that exist
  const enabledTools: ToolSet = {}
  for (const [name, toolDef] of Object.entries(allTools)) {
    if (enabledToolNames.has(name)) {
      enabledTools[name] = toolDef
    }
  }

  return enabledTools
}

// Create Vercel AI Gateway instance
const gateway = createGateway({
  apiKey: process.env.VERCEL_AI_GATEWAY_API_KEY,
})

// i-View MCP Server URL (deployed on Vercel)
const MCP_SERVER_URL = process.env.MCP_SERVER_URL || 'https://i-universe-mcp.vercel.app/api/mcp'

// Allow streaming responses up to 60 seconds (MCP tools may take longer)
export const maxDuration = 60

/**
 * Transform standard chat messages to AI SDK 6 UIMessage format
 * AI SDK 6 agents expect messages with `id` and `parts` fields
 */
function toUIMessages(messages: Array<{ role: string; content: string; id?: string }>): UIMessage[] {
  return messages.map((msg, index) => ({
    id: msg.id || `msg-${index}-${Date.now()}`,
    role: msg.role as 'user' | 'assistant',
    parts: [{ type: 'text' as const, text: msg.content }],
  }))
}

export async function POST(request: Request) {
  const { messages: rawMessages } = await request.json()

  // Transform to AI SDK 6 UIMessage format
  const messages = toUIMessages(rawMessages)

  try {
    // Load tools from MCP server using custom HTTP client (no SSE)
    console.log('[Chat] Loading MCP tools...')
    const { tools, toolCount } = await createMCPTools(MCP_SERVER_URL)
    console.log(`[Chat] Loaded ${toolCount} tools`)

    // Create the browser automation agent with MCP tools
    const browserAgent = new ToolLoopAgent({
      model: gateway.languageModel('anthropic/claude-sonnet-4'),
      // Pass providerOptions to avoid Bedrock routing (has schema issues)
      providerOptions: {
        gateway: {
          only: ['anthropic'], // Avoid Bedrock - it strips type:object from schemas
        },
      },
      // Progressive tool disclosure - filter tools based on conversation state
      prepareStep: async ({ previousSteps }) => {
        const enabledTools = getEnabledTools(tools, previousSteps)
        const enabledCount = Object.keys(enabledTools).length

        console.log(`[Chat] prepareStep: ${enabledCount}/${toolCount} tools enabled (step ${previousSteps.length + 1})`)

        // Log what's locked if interaction tools aren't available yet
        if (!previousSteps.some(s => s.toolCalls?.some(c =>
          c.toolName === 'navigate_browser' || c.toolName === 'create_tab'
        ))) {
          console.log('[Chat] Interaction tools locked - navigate first')
        }

        return { tools: enabledTools }
      },
      instructions: `You are a helpful AI assistant with powerful browser and terminal automation capabilities.

## Available Tools (loaded from i-View MCP Server)
You have access to ${toolCount}+ tools including:

### Browser Automation
- navigate_browser: Navigate to URLs
- click_element: Click elements by selector or text
- fill_input: Fill form inputs
- take_screenshot: Capture the current page
- scroll_page: Scroll the page
- get_page_elements: Query elements on the page
- get_page_info: Get page title and URL
- hover_element: Hover over elements
- send_key: Send keyboard input

### Tab Management
- create_tab: Open new browser tabs
- list_tabs: List all open tabs
- switch_tab: Switch between tabs
- close_tab: Close tabs

### Terminal Control
- send_terminal_command: Run shell commands
- get_terminal_output: Get terminal output
- send_command_to_agent: Send commands to Claude Code
- start_claude_agent: Start a new Claude agent

### Device Management
- list_devices: List all online i-View devices

### Supabase Database
- supabase_query: Query data from tables
- supabase_insert: Insert records
- supabase_update: Update records
- supabase_delete: Delete records

### Memory
- store_memory: Store information for later
- recall_memory: Retrieve stored information

### Utilities
- get_current_time: Get current date/time
- execute_javascript: Run JS in browser context

## Guidelines
1. Use tools when asked to interact with web pages, terminals, or databases
2. Describe what you find after using tools
3. Be concise but informative
4. For browser tasks, start with navigate_browser then use other tools
5. Use list_devices first if you need to target a specific computer
6. Ask clarifying questions when needed`,
      tools,
      stopWhen: stepCountIs(10),
    })

    // Use AI SDK 6 agent streaming response
    return createAgentUIStreamResponse({
      agent: browserAgent,
      messages,
    })
  } catch (error) {
    console.error('[Chat] Error:', error)

    return new Response(
      JSON.stringify({
        error: 'Failed to process chat request',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
}
