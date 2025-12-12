/**
 * Update ElevenLabs Agent with Client Tools
 *
 * This script updates the ElevenLabs agent to use client-side tools
 * instead of MCP server tools (since MCP servers can't reach localhost)
 */

const AGENT_ID = process.env.ELEVENLABS_AGENT_ID || 'agent_4901kbxwb73mf7car80w8fmvddf3'
const API_KEY = process.env.ELEVENLABS_API_KEY || ''

interface ToolParameter {
  type: string
  description: string
  enum?: string[] | null
  is_system_provided?: boolean
  dynamic_variable?: string
  constant_value?: string
}

interface ClientTool {
  type: 'client'
  name: string
  description: string
  response_timeout_secs?: number
  disable_interruptions?: boolean
  force_pre_tool_speech?: boolean
  assignments?: any[]
  tool_call_sound?: null
  tool_call_sound_behavior?: string
  parameters: {
    type: 'object'
    required: string[]
    description: string
    properties: Record<string, ToolParameter>
  }
  expects_response?: boolean
  dynamic_variables?: {
    dynamic_variable_placeholders: Record<string, unknown>
  }
  execution_mode?: string
}

// Define all client tools matching voice-interface.tsx
const clientTools: ClientTool[] = [
  // ======================= BROWSER NAVIGATION =======================
  {
    type: 'client',
    name: 'navigate',
    description: 'Navigate the browser to a URL. Use this to open websites.',
    response_timeout_secs: 15,
    expects_response: true,
    parameters: {
      type: 'object',
      required: ['url'],
      description: '',
      properties: {
        url: { type: 'string', description: 'The URL to navigate to (can be partial like "github.com")' },
      },
    },
  },
  {
    type: 'client',
    name: 'click',
    description: 'Click on an element in the browser by its text content or CSS selector.',
    response_timeout_secs: 10,
    expects_response: true,
    parameters: {
      type: 'object',
      required: [],
      description: '',
      properties: {
        text: { type: 'string', description: 'The visible text of the element to click' },
        selector: { type: 'string', description: 'CSS selector of the element to click' },
      },
    },
  },
  {
    type: 'client',
    name: 'fill',
    description: 'Fill text into an input field in the browser.',
    response_timeout_secs: 10,
    expects_response: true,
    parameters: {
      type: 'object',
      required: ['value'],
      description: '',
      properties: {
        value: { type: 'string', description: 'The text to fill into the input' },
        selector: { type: 'string', description: 'CSS selector of the input field' },
        text: { type: 'string', description: 'Text label or placeholder to identify the input' },
      },
    },
  },
  {
    type: 'client',
    name: 'scroll',
    description: 'Scroll the browser page in a direction.',
    response_timeout_secs: 5,
    expects_response: true,
    parameters: {
      type: 'object',
      required: ['direction'],
      description: '',
      properties: {
        direction: {
          type: 'string',
          description: 'Direction to scroll',
          enum: ['up', 'down', 'top', 'bottom'],
        },
      },
    },
  },
  {
    type: 'client',
    name: 'press_key',
    description: 'Press a key on the keyboard in the browser (e.g., Enter, Tab, Escape).',
    response_timeout_secs: 5,
    expects_response: true,
    parameters: {
      type: 'object',
      required: ['key'],
      description: '',
      properties: {
        key: { type: 'string', description: 'The key to press (e.g., Enter, Tab, Escape, ArrowDown)' },
      },
    },
  },
  {
    type: 'client',
    name: 'hover',
    description: 'Hover over an element in the browser.',
    response_timeout_secs: 5,
    expects_response: true,
    parameters: {
      type: 'object',
      required: [],
      description: '',
      properties: {
        text: { type: 'string', description: 'The visible text of the element to hover over' },
        selector: { type: 'string', description: 'CSS selector of the element to hover over' },
      },
    },
  },

  // ======================= BROWSER OBSERVATION =======================
  {
    type: 'client',
    name: 'get_page_info',
    description: 'Get the current page title and URL from the browser.',
    response_timeout_secs: 5,
    expects_response: true,
    parameters: { type: 'object', required: [], description: '', properties: {} },
  },
  {
    type: 'client',
    name: 'get_elements',
    description: 'Find elements on the page matching a CSS selector.',
    response_timeout_secs: 5,
    expects_response: true,
    parameters: {
      type: 'object',
      required: ['selector'],
      description: '',
      properties: {
        selector: { type: 'string', description: 'CSS selector to query (e.g., "button", ".class", "#id")' },
      },
    },
  },
  {
    type: 'client',
    name: 'get_buttons',
    description: 'Get all buttons on the current page.',
    response_timeout_secs: 5,
    expects_response: true,
    parameters: { type: 'object', required: [], description: '', properties: {} },
  },
  {
    type: 'client',
    name: 'get_inputs',
    description: 'Get all input fields on the current page.',
    response_timeout_secs: 5,
    expects_response: true,
    parameters: { type: 'object', required: [], description: '', properties: {} },
  },
  {
    type: 'client',
    name: 'get_links',
    description: 'Get all links on the current page.',
    response_timeout_secs: 5,
    expects_response: true,
    parameters: { type: 'object', required: [], description: '', properties: {} },
  },
  {
    type: 'client',
    name: 'get_console_errors',
    description: 'Get JavaScript console errors from the browser.',
    response_timeout_secs: 5,
    expects_response: true,
    parameters: { type: 'object', required: [], description: '', properties: {} },
  },

  // ======================= TERMINAL OPERATIONS =======================
  {
    type: 'client',
    name: 'get_terminal_output',
    description: 'Get the recent output from a terminal. Use this to see command results or Claude agent responses.',
    response_timeout_secs: 10,
    expects_response: true,
    parameters: {
      type: 'object',
      required: [],
      description: '',
      properties: {
        lines: { type: 'number', description: 'Number of lines to get (default: 20)' },
        terminalId: { type: 'string', description: 'Specific terminal ID (optional)' },
      },
    },
  },
  {
    type: 'client',
    name: 'run_command',
    description: 'Run a shell command in the terminal and get the output.',
    response_timeout_secs: 15,
    expects_response: true,
    parameters: {
      type: 'object',
      required: ['command'],
      description: '',
      properties: {
        command: { type: 'string', description: 'The shell command to run (e.g., "npm test", "git status")' },
      },
    },
  },
  {
    type: 'client',
    name: 'terminal_write',
    description: 'Write text to the terminal without pressing Enter.',
    response_timeout_secs: 5,
    expects_response: true,
    parameters: {
      type: 'object',
      required: ['text'],
      description: '',
      properties: {
        text: { type: 'string', description: 'Text to write to terminal' },
      },
    },
  },
  {
    type: 'client',
    name: 'terminal_key',
    description: 'Send a key to the terminal (e.g., enter, ctrl+c, up, down).',
    response_timeout_secs: 5,
    expects_response: true,
    parameters: {
      type: 'object',
      required: ['key'],
      description: '',
      properties: {
        key: { type: 'string', description: 'Key to send (e.g., "enter", "ctrl+c", "up", "down", "tab")' },
      },
    },
  },
  {
    type: 'client',
    name: 'submit_agent_input',
    description: 'Submit the current input to a Claude agent by pressing Enter.',
    response_timeout_secs: 5,
    expects_response: true,
    parameters: {
      type: 'object',
      required: [],
      description: '',
      properties: {
        sessionName: { type: 'string', description: 'Name of the session (optional)' },
      },
    },
  },
  {
    type: 'client',
    name: 'list_terminals',
    description: 'List all open terminal sessions.',
    response_timeout_secs: 5,
    expects_response: true,
    parameters: { type: 'object', required: [], description: '', properties: {} },
  },
  {
    type: 'client',
    name: 'create_terminal',
    description: 'Create a new terminal session.',
    response_timeout_secs: 5,
    expects_response: true,
    parameters: {
      type: 'object',
      required: [],
      description: '',
      properties: {
        name: { type: 'string', description: 'Name for the new terminal' },
      },
    },
  },

  // ======================= CLAUDE AGENT OPERATIONS =======================
  {
    type: 'client',
    name: 'spawn_claude_mini',
    description: 'Spawn a new Claude mini agent to help with tasks.',
    response_timeout_secs: 10,
    expects_response: true,
    parameters: {
      type: 'object',
      required: [],
      description: '',
      properties: {
        task: { type: 'string', description: 'Initial task for the agent' },
      },
    },
  },
  {
    type: 'client',
    name: 'send_to_agent',
    description: 'Send a message to a Claude agent.',
    response_timeout_secs: 10,
    expects_response: true,
    parameters: {
      type: 'object',
      required: ['message'],
      description: '',
      properties: {
        message: { type: 'string', description: 'Message to send to the agent' },
        terminalId: { type: 'string', description: 'Specific terminal ID (optional)' },
      },
    },
  },
  {
    type: 'client',
    name: 'list_agents',
    description: 'List all running Claude agents.',
    response_timeout_secs: 5,
    expects_response: true,
    parameters: { type: 'object', required: [], description: '', properties: {} },
  },

  // ======================= TAB MANAGEMENT =======================
  {
    type: 'client',
    name: 'list_tabs',
    description: 'List all open browser tabs.',
    response_timeout_secs: 5,
    expects_response: true,
    parameters: { type: 'object', required: [], description: '', properties: {} },
  },
  {
    type: 'client',
    name: 'open_tab',
    description: 'Open a new browser tab with a URL.',
    response_timeout_secs: 10,
    expects_response: true,
    parameters: {
      type: 'object',
      required: ['url'],
      description: '',
      properties: {
        url: { type: 'string', description: 'URL to open in new tab' },
      },
    },
  },
  {
    type: 'client',
    name: 'close_tab',
    description: 'Close a browser tab.',
    response_timeout_secs: 5,
    expects_response: true,
    parameters: {
      type: 'object',
      required: [],
      description: '',
      properties: {
        tabId: { type: 'string', description: 'Tab ID to close (closes current if not specified)' },
      },
    },
  },

  // ======================= SYSTEM SHORTCUTS =======================
  {
    type: 'client',
    name: 'reload_page',
    description: 'Reload the current browser page.',
    response_timeout_secs: 10,
    expects_response: true,
    parameters: { type: 'object', required: [], description: '', properties: {} },
  },
  {
    type: 'client',
    name: 'open_devtools',
    description: 'Open the browser developer tools.',
    response_timeout_secs: 5,
    expects_response: true,
    parameters: { type: 'object', required: [], description: '', properties: {} },
  },
  {
    type: 'client',
    name: 'focus_terminal',
    description: 'Focus the terminal panel.',
    response_timeout_secs: 5,
    expects_response: true,
    parameters: { type: 'object', required: [], description: '', properties: {} },
  },
  {
    type: 'client',
    name: 'focus_browser',
    description: 'Focus the browser panel.',
    response_timeout_secs: 5,
    expects_response: true,
    parameters: { type: 'object', required: [], description: '', properties: {} },
  },
  {
    type: 'client',
    name: 'interrupt_process',
    description: 'Interrupt the current process (Ctrl+C).',
    response_timeout_secs: 5,
    expects_response: true,
    parameters: { type: 'object', required: [], description: '', properties: {} },
  },
  {
    type: 'client',
    name: 'go_back',
    description: 'Go back to the previous page in browser history.',
    response_timeout_secs: 5,
    expects_response: true,
    parameters: { type: 'object', required: [], description: '', properties: {} },
  },
  {
    type: 'client',
    name: 'go_forward',
    description: 'Go forward in browser history.',
    response_timeout_secs: 5,
    expects_response: true,
    parameters: { type: 'object', required: [], description: '', properties: {} },
  },
  {
    type: 'client',
    name: 'health_check',
    description: 'Check the system health status.',
    response_timeout_secs: 5,
    expects_response: true,
    parameters: { type: 'object', required: [], description: '', properties: {} },
  },
  {
    type: 'client',
    name: 'get_system_status',
    description: 'Get overall system status including terminals, tabs, and active components.',
    response_timeout_secs: 5,
    expects_response: true,
    parameters: { type: 'object', required: [], description: '', properties: {} },
  },

  // ======================= MEMORY & KNOWLEDGE =======================
  {
    type: 'client',
    name: 'remember',
    description: 'Save something to memory for later recall.',
    response_timeout_secs: 5,
    expects_response: true,
    parameters: {
      type: 'object',
      required: ['content'],
      description: '',
      properties: {
        content: { type: 'string', description: 'The content to remember' },
      },
    },
  },
  {
    type: 'client',
    name: 'recall',
    description: 'Recall information from memory based on a query.',
    response_timeout_secs: 5,
    expects_response: true,
    parameters: {
      type: 'object',
      required: ['query'],
      description: '',
      properties: {
        query: { type: 'string', description: 'What to search for in memory' },
      },
    },
  },
  {
    type: 'client',
    name: 'get_knowledge',
    description: 'Get knowledge base entries.',
    response_timeout_secs: 5,
    expects_response: true,
    parameters: {
      type: 'object',
      required: [],
      description: '',
      properties: {
        category: { type: 'string', description: 'Category to filter by (optional)' },
      },
    },
  },
]

// Add default fields to each tool
const toolsWithDefaults = clientTools.map((tool) => ({
  ...tool,
  disable_interruptions: false,
  force_pre_tool_speech: false,
  assignments: [],
  tool_call_sound: null,
  tool_call_sound_behavior: 'auto',
  dynamic_variables: { dynamic_variable_placeholders: {} },
  execution_mode: 'immediate',
  parameters: {
    ...tool.parameters,
    properties: Object.fromEntries(
      Object.entries(tool.parameters.properties).map(([key, value]) => [
        key,
        {
          ...value,
          is_system_provided: false,
          dynamic_variable: '',
          constant_value: '',
          enum: (value as any).enum ?? null,
        },
      ])
    ),
  },
}))

async function updateAgent() {
  if (!API_KEY) {
    console.error('ELEVENLABS_API_KEY is required')
    process.exit(1)
  }

  console.log(`Updating agent ${AGENT_ID} with ${toolsWithDefaults.length} client tools...`)

  // Build the update payload - keep the prompt tools array with client tools
  const updatePayload = {
    conversation_config: {
      agent: {
        prompt: {
          tools: toolsWithDefaults,
          // Remove MCP server IDs since we're using client tools now
          mcp_server_ids: [],
        },
      },
    },
  }

  try {
    const response = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${AGENT_ID}`, {
      method: 'PATCH',
      headers: {
        'xi-api-key': API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updatePayload),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Update failed:', response.status, errorText)
      process.exit(1)
    }

    const result = await response.json()
    console.log('✓ Agent updated successfully!')
    console.log(`  - ${toolsWithDefaults.length} client tools configured`)
    console.log('  - MCP server removed (client tools handle everything)')
    console.log('\nTools added:')
    toolsWithDefaults.forEach((t) => console.log(`  • ${t.name}`))
  } catch (err) {
    console.error('Error:', err)
    process.exit(1)
  }
}

updateAgent()
