---
title: Unified MCP Tool Reference
priority: 3
category: tools
---

# Unified MCP Tool Reference

All tools now route through `mahana-mcp-server` which calls i-View Mini directly (instant HTTP, no queuing).

## Architecture

```
Voice → MCP → i-View HTTP → Execute → Response (instant)
```

i-View Mini: `http://127.0.0.1:9877` (dev) or `9876` (prod)

## NEW: Keyboard Brain Shortcuts

Direct voice commands for common actions:

| Say | Routes To | Action |
|-----|-----------|--------|
| "reload" / "refresh" | `/input/logical` | RELOAD_APP |
| "devtools" / "inspect" | `/input/logical` | OPEN_DEVTOOLS |
| "screenshot" | `/command-dict/run` | screenshot command |
| "health check" | `/command-dict/run` | health command |
| "kill" / "stop" | `/input/logical` | INTERRUPT_PROCESS |
| "clear" / "clear screen" | `/input/logical` | CLEAR_SCREEN |
| "focus terminal" | `/input/logical` | FOCUS_TERMINAL |
| "focus browser" | `/input/logical` | FOCUS_WEBVIEW |
| "go back" | `/input/logical` | GO_BACK |
| "scroll down/up" | `/input/logical` | SCROLL_DOWN/UP |

**Why:** These bypass the tiered tool system for instant execution.

## `do` - Execute Actions

Routes based on action keywords:

| Pattern | Routes To | Example |
|---------|-----------|---------|
| open, go to, visit, navigate | `/navigate` | "open github.com" |
| click, press, tap | `/webview/click` | "click Sign In" |
| type, fill, enter text | `/webview/fill` | "type hello in search" |
| scroll | `/webview/scroll` | "scroll down" |
| key, press enter | `/webview/key` | "press enter" |
| hover | `/webview/hover` | "hover over menu" |
| run, execute, npm, git | `/terminal/write` + `/terminal/key` | "run npm test" |
| ask claude, have agent | `/terminal/write` (to claude session) | "ask claude to fix tests" |

**Combined Actions:**
- "open X and click Y" → `/navigate` then `/webview/click`
- "run npm test" → `/terminal/write` + `/terminal/key enter`

## `see` - Observe & Query

Routes based on what to see:

| Pattern | Routes To | Returns |
|---------|-----------|---------|
| screenshot, screen, view | `/screenshot/webview` | Base64 image |
| page, url, title | `/webview/page-info` | Title + URL |
| terminal, output | `/terminal/output` | Last N lines |
| buttons | `/webview/elements?selector=button` | Button list |
| inputs | `/webview/elements?selector=input` | Input list |
| links | `/webview/elements?selector=a` | Link list |
| errors, console | `mcp:i-view-console.get_errors` | Error log |
| network, api, requests | `mcp:i-view-console.get_webview_network` | XHR/fetch log |
| tabs | `/tabs/list` | Tab list |

## `find` - Search & Discover

Routes based on source context:

| Pattern | Routes To | Use For |
|---------|-----------|---------|
| notion, page, doc | `mcp:notion.search` | Notion workspace |
| table, database, schema | `mcp:neural-db.database_schema_search` | Database structure |
| docs, library, package | `context7` (or `/agent/search`) | Library documentation |
| file, code, *.tsx | `/agent/search` | Codebase search |

**Auto-Detection:**
- "project roadmap" → Notion (detected by content type)
- "users table schema" → Database (detected by "table", "schema")
- "react query caching" → Library docs (detected by known packages)

## `create` - Make New Things

Routes based on what to create:

| Pattern | Routes To | Result |
|---------|-----------|--------|
| tab [url] | `/tabs/new` | New browser tab |
| terminal | `/terminal/create` | New terminal instance |
| terminal mini | `/terminal/create` + spawn `claude` | Terminal with Claude Code (Haiku) |
| terminal opus | `/terminal/create` + spawn `claude --model opus` | Terminal with Claude Opus |
| notion page [title] | `mcp:notion.create-pages` | New Notion page |
| session [name] | `/session/new` | New i-View session |

**Compound Creates:**
- "terminal mini" = create terminal + write `claude` + press enter
- "tab github.com" = create tab + navigate to URL

## `remember` - Persistent Memory

Routes to memory endpoints:

| Pattern | Routes To | Action |
|---------|-----------|--------|
| Save statement | `/memory/save` | Store fact |
| Category name | `/memory/get?category=X` | Get category |
| Question (what, who, when) | `/memory/query` | Semantic search |
| Empty | `/memory/list` | Full memory dump |

**Memory Categories:**
- `user` - User info (name, preferences)
- `project` - Current project context
- `session` - Session-specific notes
- `preferences` - User preferences

**Examples:**
- "my name is Alex" → save to `user` category
- "working on auth feature" → save to `project` category
- "what project?" → query recent project context

## `check` - System Status

Routes based on what to check:

| Pattern | Routes To | Returns |
|---------|-----------|---------|
| all, status, empty | Multiple endpoints | Full system status |
| agent, claude | `/claude-code/status` | Agent session info |
| tabs | `/tabs/list` | Open browser tabs |
| terminal | `/terminal/list` | Terminal instances |
| nextjs | `mcp:next-devtools.nextjs_index` | Next.js dev server |
| supabase, database | `mcp:supabase.health` | Database connection |
| session | `/session/list` | i-View sessions |

---

## MCP Tools (mahana-mcp-server)

### Terminal & Claude Agents (Direct i-View HTTP)
| Tool | Description | i-View Endpoint |
|------|-------------|-----------------|
| `run_terminal_command` | Execute shell command | `/quick/run` |
| `get_terminal_output` | Read terminal output | `/terminal/output` |
| `spawn_claude_mini` | Start Claude mini agent | `/quick/mini` |
| `send_to_agent` | Send message to Claude | `/quick/agent` |
| `list_agents` | List Claude agents | `/quick/agents` |
| `list_terminals` | List terminals + state | `/quick/terminals` |
| `create_terminal_session` | Create session + optional agent | `/quick/session` |
| `list_sessions` | Sessions with neuropackets | `/quick/sessions` |
| `delete_session` | Delete session | `DELETE /quick/session` |
| `get_session_memory` | Get SESSION_MEMORY.md | `/quick/memory` |
| `broadcast_command` | Send to multiple terminals | `/quick/broadcast` |

### Browser Automation (Direct i-View HTTP)
| Tool | Description | i-View Endpoint |
|------|-------------|-----------------|
| `navigate_browser` | Go to URL | `/navigate` |
| `click_element` | Click by selector/text | `/webview/click` |
| `fill_input` | Fill input field | `/webview/fill` |
| `take_screenshot` | Screenshot (preset: fast) | `/screenshot/webview` |
| `get_console_logs` | Browser console | `/webview/console` |
| `query_elements` | Query DOM elements | `/webview/elements` |

### System Status (Direct i-View HTTP)
| Tool | Description | i-View Endpoint |
|------|-------------|-----------------|
| `get_system_health` | Health check | `/quick/health` |
| `get_snapshot` | Screenshot + console + terminal | `/quick/snapshot` |

### Cloud Data (Supabase)
| Tool | Description |
|------|-------------|
| `supabase_query` | Query table |
| `supabase_insert` | Insert record |
| `supabase_update` | Update records |
| `supabase_delete` | Delete records |
| `store_memory` | Store key-value |
| `recall_memory` | Retrieve memory |

### Mahana Toolkit
| Tool | Description |
|------|-------------|
| `get_system_toolkit` | All APIs, CLI, imports |
| `get_callable_commands` | Code snippets |
| `get_api_reference` | API endpoints |
| `get_cli_reference` | CLI commands |
| `get_cost_reference` | Operation costs |
| `get_pipeline_reference` | Pipeline stages |
| `lookup_data_path` | Data file paths |

---

## Additional MCP Servers (via external servers)

### i-view-session / i-view-console
- Direct access to i-View app state and console logs

### notion
- Search, create, update pages and databases

### supabase
- Database operations and migrations

### neural-db
- Semantic search over database schema

### next-devtools
- Next.js 16+ dev server integration

### context7
- Library documentation lookup

### component-tester
- UI component screenshot testing
