'use client'

/**
 * Chat Interface Component
 * Uses AI SDK 6 useChat hook with tool call visualization
 */

import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithToolCalls } from 'ai'
import { useState, useRef, useEffect, useMemo } from 'react'

export function ChatInterface() {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [input, setInput] = useState('')

  // Create transport once with useMemo to avoid re-creating on every render
  const transport = useMemo(
    () => new DefaultChatTransport({ api: '/api/chat' }),
    []
  )

  const { messages, sendMessage, status, error, addToolOutput } = useChat({
    transport,
    // Auto-submit when all tool results are available
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    // Handle client-side tool calls from the agent
    async onToolCall({ toolCall }) {
      // Handle dynamic tools
      if (toolCall.dynamic) {
        return
      }
      // Handle agent protocol tools (submit_agent_input, etc.)
      if (toolCall.toolName === 'submit_agent_input') {
        addToolOutput({
          tool: 'submit_agent_input',
          toolCallId: toolCall.toolCallId,
          output: { acknowledged: true },
        })
        return
      }
      // For any other unhandled client tools, acknowledge them
      console.log('Unhandled client tool:', toolCall.toolName)
      addToolOutput({
        tool: toolCall.toolName,
        toolCallId: toolCall.toolCallId,
        output: { handled: false, toolName: toolCall.toolName },
      })
    },
  })

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  return (
    <div className="flex flex-col h-full max-w-3xl mx-auto">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 mt-8">
            <p className="text-lg font-medium">Browser Automation Agent</p>
            <p className="text-sm mt-2">
              Ask me to navigate, click, fill forms, take screenshots, and more.
            </p>
            <div className="mt-4 space-y-2 text-sm text-left max-w-md mx-auto">
              <p className="text-gray-400">Try:</p>
              <button
                onClick={() => setInput('Go to github.com and tell me what you see')}
                className="block w-full text-left px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition"
              >
                &quot;Go to github.com and tell me what you see&quot;
              </button>
              <button
                onClick={() => setInput('Take a screenshot of the current page')}
                className="block w-full text-left px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition"
              >
                &quot;Take a screenshot of the current page&quot;
              </button>
            </div>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                message.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-900'
              }`}
            >
              {/* Tool calls and text display */}
              {message.parts?.map((part, i) => {
                // Handle text parts
                if (part.type === 'text') {
                  return <p key={i}>{part.text}</p>
                }
                // Handle tool parts (type is 'tool-{toolName}')
                if (part.type.startsWith('tool-') && 'toolCallId' in part) {
                  const toolName = part.type.slice(5) // Remove 'tool-' prefix
                  const toolPart = part as { type: string; toolCallId: string; state?: string; output?: unknown }
                  return (
                    <div key={i} className="mb-2 p-2 bg-gray-200 rounded-lg text-sm">
                      <div className="font-mono text-xs text-gray-600">
                        Tool: {toolName}
                      </div>
                      {toolPart.state === 'output-available' && toolPart.output !== undefined ? (
                        <div className="mt-1 text-gray-700">
                          {String(toolPart.output)}
                        </div>
                      ) : null}
                    </div>
                  )
                }
                return null
              })}
            </div>
          </div>
        ))}

        {(status === 'submitted' || status === 'streaming') && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-2xl px-4 py-2">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100" />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200" />
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-100 text-red-700 rounded-lg p-3 text-sm">
            Error: {error.message}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (input.trim()) {
            sendMessage({ text: input })
            setInput('')
          }
        }}
        className="p-4 border-t"
      >
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask me to do something..."
            className="flex-1 px-4 py-2 border rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={status !== 'ready'}
          />
          <button
            type="submit"
            disabled={status !== 'ready'}
            className="px-6 py-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  )
}
