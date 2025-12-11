/**
 * Knowledge Loader
 * Loads knowledge from:
 * 1. Supabase (shared across all agents) - PRIMARY
 * 2. Local markdown files (fallback)
 */

import { readFileSync, readdirSync, existsSync } from 'fs'
import { join } from 'path'
import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Lazy-loaded Supabase client (only created when credentials available)
let _supabase: SupabaseClient | null = null

function getSupabase(): SupabaseClient | null {
  if (_supabase) return _supabase

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    return null
  }

  _supabase = createClient(url, key)
  return _supabase
}

interface KnowledgeFile {
  path: string
  title: string
  priority: number
  category: string
  content: string
}

interface SupabaseKnowledge {
  id: string
  category: string
  title: string
  priority: number
  content: string
  summary?: string
  tags: string[]
}

interface Frontmatter {
  title?: string
  priority?: number
  category?: string
}

/**
 * Parse YAML frontmatter from markdown content
 */
function parseFrontmatter(content: string): { frontmatter: Frontmatter; body: string } {
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)

  if (!fmMatch) {
    return { frontmatter: {}, body: content }
  }

  const fmContent = fmMatch[1]
  const body = fmMatch[2]

  const frontmatter: Frontmatter = {}

  // Simple YAML parsing (key: value)
  for (const line of fmContent.split('\n')) {
    const match = line.match(/^(\w+):\s*(.+)$/)
    if (match) {
      const [, key, value] = match
      if (key === 'priority') {
        frontmatter.priority = parseInt(value, 10)
      } else if (key === 'title') {
        frontmatter.title = value.trim()
      } else if (key === 'category') {
        frontmatter.category = value.trim()
      }
    }
  }

  return { frontmatter, body }
}

/**
 * Load all knowledge files from directory
 */
export function loadKnowledgeFiles(knowledgeDir?: string): KnowledgeFile[] {
  const dir = knowledgeDir || join(process.cwd(), 'knowledge')

  if (!existsSync(dir)) {
    console.warn(`[Knowledge] Directory not found: ${dir}`)
    return []
  }

  const files = readdirSync(dir).filter(f => f.endsWith('.md'))
  const knowledge: KnowledgeFile[] = []

  for (const file of files) {
    const filePath = join(dir, file)
    const content = readFileSync(filePath, 'utf-8')
    const { frontmatter, body } = parseFrontmatter(content)

    knowledge.push({
      path: filePath,
      title: frontmatter.title || file.replace('.md', ''),
      priority: frontmatter.priority ?? 99,
      category: frontmatter.category || 'general',
      content: body.trim(),
    })
  }

  // Sort by priority (lower = higher priority)
  return knowledge.sort((a, b) => a.priority - b.priority)
}

/**
 * Build complete system prompt from knowledge files
 */
export function buildSystemPrompt(knowledgeDir?: string): string {
  const files = loadKnowledgeFiles(knowledgeDir)

  if (files.length === 0) {
    return getDefaultPrompt()
  }

  const sections = files.map(f => f.content)
  return sections.join('\n\n---\n\n')
}

/**
 * Get knowledge summary
 */
export function getKnowledgeSummary(knowledgeDir?: string): string {
  const files = loadKnowledgeFiles(knowledgeDir)

  const lines = files.map(f =>
    `  [${f.priority}] ${f.title} (${f.category})`
  )

  return [
    '=== Knowledge Files ===',
    ...lines,
    `Total: ${files.length} files`,
  ].join('\n')
}

/**
 * Default prompt if no knowledge files found
 */
function getDefaultPrompt(): string {
  return `You are Mahana, a voice assistant for browser automation.

You can:
- Navigate to URLs
- Click elements
- Fill forms
- Read page content
- Control browser tabs
- Send commands to Claude agents

Keep responses short and conversational - this is voice, not text.
Confirm actions briefly: "Done" "Got it" "Navigating now"
`
}

/**
 * Load knowledge from Supabase (primary source)
 */
export async function loadFromSupabase(): Promise<KnowledgeFile[]> {
  const supabase = getSupabase()
  if (!supabase) {
    console.warn('[Knowledge] Supabase not configured, skipping')
    return []
  }

  try {
    const { data, error } = await supabase
      .from('agent_knowledge')
      .select('*')
      .order('priority', { ascending: true })
      .limit(30)

    if (error || !data) {
      console.warn('[Knowledge] Supabase fetch failed:', error?.message)
      return []
    }

    return (data as SupabaseKnowledge[]).map(entry => ({
      path: `supabase:${entry.id}`,
      title: entry.title,
      priority: entry.priority,
      category: entry.category,
      content: entry.content,
    }))
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.warn('[Knowledge] Supabase error:', message)
    return []
  }
}

/**
 * Build system prompt from Supabase (async version)
 */
export async function buildSystemPromptAsync(): Promise<string> {
  // Try Supabase first
  const supabaseKnowledge = await loadFromSupabase()

  if (supabaseKnowledge.length > 0) {
    console.log(`[Knowledge] Loaded ${supabaseKnowledge.length} entries from Supabase`)
    const sections = supabaseKnowledge.map(f => f.content)
    return sections.join('\n\n---\n\n')
  }

  // Fallback to local files
  console.log('[Knowledge] Falling back to local files')
  return buildSystemPrompt()
}

/**
 * Get knowledge summary from Supabase (async)
 */
export async function getKnowledgeSummaryAsync(): Promise<string> {
  const entries = await loadFromSupabase()

  if (entries.length === 0) {
    return getKnowledgeSummary()
  }

  const lines = entries.map(f =>
    `  [${f.priority}] ${f.title} (${f.category})`
  )

  return [
    '=== Knowledge (Supabase) ===',
    ...lines,
    `Total: ${entries.length} entries`,
  ].join('\n')
}

/**
 * Export for use in API routes
 */
export const systemPrompt = buildSystemPrompt()
