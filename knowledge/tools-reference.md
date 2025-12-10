---
title: Tiered Tool Routing Reference
priority: 3
category: tools
---

# Tool Routing Reference

Your 6 core tools route to 267 HTTP endpoints + 55 MCP tools. Here's how.

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

## MCP Tools Available (55+ across 11 servers)

### keyboard-brain (NEW)
- `send_logical_input` - Execute action (RELOAD_APP, etc.)
- `run_command` - Run named command (health, screenshot)
- `pointer_click` - Click by selector/text/coordinates
- `get_context` - Current focus context
- `set_context` - Set context (terminal, browser, etc.)
- `list_commands` - List available commands
- `search_commands` - Search commands

### i-view-session
- `get_session_info` - Current session
- `list_sessions` - All sessions

### i-view-console
- `get_console` - Full console log
- `get_errors` - Errors only
- `get_webview_console` - Page console
- `get_webview_errors` - Page errors
- `get_webview_network` - Network requests
- `get_screenshot` - Screenshot
- `check_app_status` - Health check

### notion (12 tools)
- `notion-search` - Search workspace
- `notion-fetch` - Get page content
- `notion-create-pages` - Create pages
- `notion-update-page` - Edit pages
- `notion-create-database` - Create database
- `notion-update-database` - Edit database
- `notion-get-comments` - Get comments
- `notion-create-comment` - Add comment
- Plus: move, duplicate, users, teams

### supabase (8 tools)
- Query, insert, update, delete
- Schema inspection
- RLS policies
- Migrations

### neural-db
- `database_schema_search` - AI semantic search over schema

### next-devtools (7 tools)
- `init` - Initialize MCP context
- `nextjs_docs` - Search docs
- `nextjs_index` - Discover servers
- `nextjs_call` - Call MCP tools
- `browser_eval` - Playwright automation
- `upgrade_nextjs_16` - Upgrade guide
- `enable_cache_components` - Cache components

### component-tester
- `screenshot_component` - Screenshot component
- `test_component_states` - Multi-state test
- `get_component_url` - Playground URL
- `get_console_logs` - Console logs
- `check_ielectron_status` - Server status

### context7
- Library documentation lookup

### figma-desktop
- Design file access
