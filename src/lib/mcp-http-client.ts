/**
 * Custom MCP HTTP Client
 * Pure HTTP POST client for MCP servers - no SSE required
 *
 * This bypasses the @ai-sdk/mcp SSE requirement by making direct JSON-RPC calls
 *
 * IMPORTANT: Uses `inputSchema` (not `parameters`) with jsonSchema() wrapper.
 * The AI SDK internal code accesses `tool.inputSchema`, not `tool.parameters`.
 * See: https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling
 */

import { tool, jsonSchema } from 'ai'
import type { JSONSchema7 } from 'json-schema'

interface MCPTool {
  name: string
  description?: string
  inputSchema?: JSONSchema7
}

interface MCPToolsResponse {
  tools: MCPTool[]
}

interface MCPCallToolResponse {
  content: Array<{
    type: string
    text?: string
    data?: string
    mimeType?: string
  }>
  isError?: boolean
}

/**
 * Make a JSON-RPC request to the MCP server
 */
async function jsonRpcRequest<T>(url: string, method: string, params?: unknown): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method,
      params: params || {},
    }),
  })

  if (!response.ok) {
    throw new Error(`MCP request failed: ${response.status} ${response.statusText}`)
  }

  const result = await response.json()

  if (result.error) {
    throw new Error(`MCP error: ${result.error.message || JSON.stringify(result.error)}`)
  }

  return result.result as T
}

/**
 * Ensure the schema is a valid object type for Anthropic
 * Anthropic requires root type to be "object"
 */
function ensureObjectSchema(schema: JSONSchema7 | undefined): JSONSchema7 {
  // Default empty object schema
  const defaultSchema: JSONSchema7 = { type: 'object', properties: {} }

  if (!schema) {
    return defaultSchema
  }

  // If already an object type, use it
  if (schema.type === 'object') {
    return {
      type: 'object',
      properties: schema.properties || {},
      required: schema.required,
    }
  }

  // For any other type, wrap in empty object (tool takes no parameters)
  return defaultSchema
}

/**
 * Create AI SDK tools from MCP server
 * Uses jsonSchema() directly to pass MCP schemas to Anthropic without Zod conversion
 */
export async function createMCPTools(serverUrl: string) {
  console.log(`[MCP-HTTP] Fetching tools from ${serverUrl}...`)

  // Get tools list from MCP server
  const { tools: mcpTools } = await jsonRpcRequest<MCPToolsResponse>(
    serverUrl,
    'tools/list'
  )

  console.log(`[MCP-HTTP] Found ${mcpTools.length} tools`)

  // Convert MCP tools to AI SDK tools
  const tools: Record<string, ReturnType<typeof tool>> = {}

  for (const mcpTool of mcpTools) {
    // Use jsonSchema() to pass the JSON Schema directly to Anthropic
    // This bypasses Zod conversion issues with Zod 4
    const schema = ensureObjectSchema(mcpTool.inputSchema)

    tools[mcpTool.name] = tool({
      description: mcpTool.description || `MCP tool: ${mcpTool.name}`,
      inputSchema: jsonSchema<Record<string, unknown>>(schema),
      execute: async (args) => {
        console.log(`[MCP-HTTP] Calling tool: ${mcpTool.name}`, args)

        try {
          const result = await jsonRpcRequest<MCPCallToolResponse>(
            serverUrl,
            'tools/call',
            { name: mcpTool.name, arguments: args }
          )

          // Extract text content from response
          const textContent = result.content
            ?.filter(c => c.type === 'text')
            .map(c => c.text)
            .join('\n')

          // Check for embedded images
          const imageContent = result.content?.find(c => c.type === 'image')

          if (imageContent && imageContent.data) {
            return {
              text: textContent || 'Image captured',
              image: imageContent.data,
              mimeType: imageContent.mimeType || 'image/png'
            }
          }

          return textContent || JSON.stringify(result.content)
        } catch (error) {
          console.error(`[MCP-HTTP] Tool error: ${mcpTool.name}`, error)
          throw error
        }
      },
    })
  }

  return {
    tools,
    toolCount: mcpTools.length,
    toolNames: mcpTools.map(t => t.name),
  }
}
