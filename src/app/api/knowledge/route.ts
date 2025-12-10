/**
 * Knowledge API
 * Returns the compiled system prompt for ElevenLabs agent
 * Primary source: Supabase (shared), Fallback: local files
 */

import { NextResponse } from 'next/server'
import {
  buildSystemPrompt,
  buildSystemPromptAsync,
  getKnowledgeSummary,
  getKnowledgeSummaryAsync,
  loadKnowledgeFiles,
  loadFromSupabase
} from '@/lib/knowledge-loader'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const format = searchParams.get('format') || 'prompt'
  const source = searchParams.get('source') || 'auto' // 'auto' | 'supabase' | 'local'

  // Use async/Supabase version for 'auto' or 'supabase'
  const useSupabase = source !== 'local'

  switch (format) {
    case 'summary':
      const summary = useSupabase
        ? await getKnowledgeSummaryAsync()
        : getKnowledgeSummary()
      const entries = useSupabase
        ? await loadFromSupabase()
        : loadKnowledgeFiles()

      return NextResponse.json({
        source: entries.length > 0 && entries[0].path.startsWith('supabase:') ? 'supabase' : 'local',
        summary,
        files: entries.map(f => ({
          title: f.title,
          priority: f.priority,
          category: f.category,
          length: f.content.length,
        })),
      })

    case 'json':
      const prompt = useSupabase
        ? await buildSystemPromptAsync()
        : buildSystemPrompt()

      return NextResponse.json({
        source: useSupabase ? 'supabase' : 'local',
        prompt,
        length: prompt.length,
      })

    case 'prompt':
    default:
      const systemPrompt = useSupabase
        ? await buildSystemPromptAsync()
        : buildSystemPrompt()

      return new Response(systemPrompt, {
        headers: { 'Content-Type': 'text/plain' },
      })
  }
}
