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

import { tool, jsonSchema, type ToolSet } from 'ai'
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

// API key for authenticated MCP access
const MCP_API_KEY = process.env.MCP_API_KEY

/**
 * Make a JSON-RPC request to the MCP server
 *
 * mcp-handler uses Streamable HTTP transport which returns SSE-formatted responses.
 * We need to parse the "event: message\ndata: {...}" format.
 */
async function jsonRpcRequest<T>(url: string, method: string, params?: unknown): Promise<T> {
  // Build headers - include API key if configured
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/event-stream',
  }

  if (MCP_API_KEY) {
    headers['x-api-key'] = MCP_API_KEY
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
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

  // Response is in SSE format: "event: message\ndata: {...}"
  const text = await response.text()

  // Parse SSE format - extract the JSON from "data: {...}" line
  const dataMatch = text.match(/^data: (.+)$/m)
  if (!dataMatch) {
    // Try parsing as plain JSON (fallback)
    try {
      const result = JSON.parse(text)
      if (result.error) {
        throw new Error(`MCP error: ${result.error.message || JSON.stringify(result.error)}`)
      }
      return result.result as T
    } catch {
      throw new Error(`Failed to parse MCP response: ${text.substring(0, 200)}`)
    }
  }

  const result = JSON.parse(dataMatch[1])

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tools: ToolSet = {}

  for (const mcpTool of mcpTools) {
    // Use jsonSchema() to pass the JSON Schema directly to Anthropic
    // This bypasses Zod conversion issues with Zod 4
    const schema = ensureObjectSchema(mcpTool.inputSchema)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
