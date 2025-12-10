/**
 * Knowledge API
 * Returns the compiled system prompt for ElevenLabs agent
 */

import { NextResponse } from 'next/server'
import { buildSystemPrompt, getKnowledgeSummary, loadKnowledgeFiles } from '@/lib/knowledge-loader'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const format = searchParams.get('format') || 'prompt'

  switch (format) {
    case 'summary':
      return NextResponse.json({
        summary: getKnowledgeSummary(),
        files: loadKnowledgeFiles().map(f => ({
          title: f.title,
          priority: f.priority,
          category: f.category,
          length: f.content.length,
        })),
      })

    case 'json':
      return NextResponse.json({
        prompt: buildSystemPrompt(),
        length: buildSystemPrompt().length,
        files: loadKnowledgeFiles().length,
      })

    case 'prompt':
    default:
      return new Response(buildSystemPrompt(), {
        headers: { 'Content-Type': 'text/plain' },
      })
  }
}
