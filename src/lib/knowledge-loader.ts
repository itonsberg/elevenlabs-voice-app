/**
 * Knowledge Loader
 * Loads markdown files from knowledge/ directory and builds system prompt
 * with frontmatter parsing for priority ordering
 */

import { readFileSync, readdirSync, existsSync } from 'fs'
import { join } from 'path'

interface KnowledgeFile {
  path: string
  title: string
  priority: number
  category: string
  content: string
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
 * Export for use in API routes
 */
export const systemPrompt = buildSystemPrompt()
