# Mahana Voice Agent Knowledge System

RAG-style knowledge base for the ElevenLabs voice agent.

## Structure

```
knowledge/
├── system.md           # Core system prompt (priority 1)
├── i-view-system.md    # Architecture context (priority 2)
├── tools-reference.md  # Tool documentation (priority 3)
└── voice-ux.md         # UX guidelines (priority 4)
```

## Frontmatter

Each knowledge file uses YAML frontmatter:

```yaml
---
title: Human-readable title
priority: 1          # Lower = higher priority (loaded first)
category: core       # core, context, tools, ux
---
```

## Usage

### From Shell (zsh)

```bash
# Load into environment variable
source ~/elevenlabs-voice-app/scripts/load-knowledge.sh export

# Print the compiled prompt
~/elevenlabs-voice-app/scripts/load-knowledge.sh print

# Save to file
~/elevenlabs-voice-app/scripts/load-knowledge.sh save

# Show summary
~/elevenlabs-voice-app/scripts/load-knowledge.sh summary
```

### From Next.js API

```bash
# Get raw prompt text
curl http://localhost:3000/api/knowledge

# Get as JSON with metadata
curl http://localhost:3000/api/knowledge?format=json

# Get file summary
curl http://localhost:3000/api/knowledge?format=summary
```

### In Code

```typescript
import { buildSystemPrompt, loadKnowledgeFiles } from '@/lib/knowledge-loader'

// Get compiled prompt
const prompt = buildSystemPrompt()

// Get individual files
const files = loadKnowledgeFiles()
```

## Adding Knowledge

1. Create a new `.md` file in `knowledge/`
2. Add frontmatter with title, priority, category
3. Write content in markdown
4. Lower priority numbers are loaded first

## ElevenLabs Integration

The system prompt can be:
1. Pasted directly into ElevenLabs agent dashboard
2. Passed via API when creating conversation
3. Loaded at runtime from `/api/knowledge`

## Files

| File | Priority | Content |
|------|----------|---------|
| `system.md` | 1 | Core identity, capabilities, tools |
| `i-view-system.md` | 2 | Architecture, endpoints, MCP |
| `tools-reference.md` | 3 | Detailed tool documentation |
| `voice-ux.md` | 4 | Voice UX best practices |
