---
title: i-View System Architecture
priority: 2
category: context
---

# i-View Mini - 267 Endpoints + 48 MCP Tools

Electron desktop app: **Terminal (left) + Browser (right)**

## API: `http://127.0.0.1:9877`

### Keyboard Brain - Unified Input (NEW)

Same API for human, agent, and voice:

**Logical Actions**
- `POST /input/logical` - Execute action (RELOAD_APP, OPEN_DEVTOOLS, etc.)
- `GET /input/context` - Get current focus context
- `POST /input/context` - Set context (terminal, browser, etc.)
- `POST /input/pointer-click` - Click by selector/text/coordinates

**Actions by Context:**
| Context | Actions |
|---------|---------|
| electron-shell | RELOAD_APP, OPEN_DEVTOOLS, QUIT_APP, TOGGLE_FULLSCREEN |
| terminal | FOCUS_TERMINAL, CLEAR_TERMINAL, NEW_TERMINAL |
| browser | FOCUS_WEBVIEW, GO_BACK, GO_FORWARD, STOP_LOADING |
| glow | SET_IDLE, SET_ACTIVE, SET_THINKING, SET_RECORDING |

**Command Dictionary**
- `POST /command-dict/run` - Run named command (health, screenshot, etc.)
- `GET /command-dict` - List all commands (27 total)
- `GET /command-dict/search` - Search commands

**Commands:** health, status, ping, reboot, uptime, logs, app_dev, app_build, db_status, db_studio, git_sync, input_reload, input_devtools, input_interrupt...

### Grok 4 Fast Executor (NEW)

Voice transcript → AI analysis → command execution (~900ms)

- `POST /grok-executor/start` - Start listening to voice
- `POST /grok-executor/stop` - Stop executor
- `POST /grok-executor/test` - Test with manual transcript
- `GET /grok-executor` - Status

### AI Endpoints (NEW)

- `POST /ai/ask` - Quick answer (non-reasoning, ~900ms)
- `POST /ai/reason` - Deep reasoning (~2.2s)
- `POST /ai/summarize` - Summarize text
- `POST /ai/extract` - Extract structured data

### Browser Control (45 endpoints)

**Navigation**
- `POST /navigate` - Go to URL
- `POST /webview/wait-navigation` - Wait for page load
- `POST /webview/wait` - Wait for element
- `POST /goBack` - Go back

**Interaction**
- `POST /webview/click` - Click element (selector or text)
- `POST /webview/fill` - Fill input
- `POST /webview/key` - Send key
- `POST /webview/scroll` - Scroll page
- `POST /webview/hover` - Hover element
- `POST /webview/execute` - Run JavaScript

**Query**
- `GET /webview/elements` - Find elements
- `GET /webview/page-info` - Title + URL
- `GET /webview/html` - Page HTML
- `GET /webview/console` - Console logs
- `GET /webview/errors` - Runtime errors
- `GET /webview/network` - XHR/fetch

**Screenshots**
- `GET /screenshot/webview` - Screenshot (presets: fast/balanced/quality)
- `GET /screenshot/webview/raw` - Raw binary
- `GET /webview/pdf` - Generate PDF

### Tab Management (12 endpoints)

- `GET /tabs/list` - List all tabs
- `POST /tabs/new` - Create tab
- `POST /tabs/open` - Open + wait for load
- `POST /tabs/switch` - Switch to tab
- `POST /tabs/close` - Close tab
- `POST /tabs/batch/open` - Open multiple
- `POST /tabs/batch/close` - Close multiple
- `GET /tabs/find` - Find by URL pattern

### Terminal Control (15 endpoints)

- `POST /terminal/write` - Write text
- `POST /terminal/key` - Send key (enter, ctrl+c, etc.)
- `GET /terminal/output` - Read output
- `POST /terminal/create` - New terminal
- `GET /terminal/list` - List terminals
- `POST /terminal/clear` - Clear buffer

**Keys:** enter, tab, escape, ctrl+c, ctrl+d, ctrl+z, ctrl+l, up, down, f1-f12

### Viewport & Devices (8 endpoints)

- `GET /webview/viewport/presets` - List device presets
- `POST /webview/viewport` - Set device

**Presets:** iphone-14, ipad-pro, desktop, macbook-pro, etc.

### Visual Diff (6 endpoints)

- `POST /visual/baseline/save` - Save baseline
- `POST /visual/compare` - Compare vs baseline
- `GET /visual/baselines` - List baselines

### Session Management (12 endpoints)

- `GET /session/list` - List sessions
- `POST /session/new` - Create session
- `POST /session/switch` - Switch session
- `POST /session/rename` - Rename session
- `POST /session/delete` - Delete session

### Memory (Persistent) (6 endpoints)

- `POST /memory/save` - Save fact
- `GET /memory/get` - Get by category
- `GET /memory/query` - Semantic search
- `GET /memory/list` - List all
- `DELETE /memory/delete` - Remove fact

### Zones (4 endpoints)

- `GET /zones/status` - Current zone
- `POST /zones/switch` - Switch zone (agent/human)

### Neuropacket (Log Compression) (6 endpoints)

- `GET /neuropacket/status` - Compression status
- `POST /neuropacket/compress` - Trigger compression
- `GET /neuropacket/list` - List packets
- `GET /neuropacket/memory` - Session memory

### Claude Code (4 endpoints)

- `GET /claude-code/status` - Session info
- `POST /agent/pulse` - Heartbeat
- `GET /agent/router` - Agent routing info

### UI Control (3 endpoints)

- `GET /glow` - Get glow state
- `POST /glow` - Set glow (off/idle/active/thinking/recording)

---

## MCP Servers (11 servers, 55+ tools)

| Server | Tools | Purpose |
|--------|-------|---------|
| keyboard-brain | 7 | Unified input (actions, commands, clicks) |
| i-view-session | 2 | Session info |
| i-view-console | 9 | Console/errors/network |
| notion | 12 | Pages, databases, search |
| supabase | 8 | Database CRUD |
| neural-db | 1 | AI schema search |
| next-devtools | 7 | Next.js debugging |
| component-tester | 5 | Visual component testing |
| context7 | 2 | Library docs |
| figma-desktop | 2 | Design files |
| Bright Data | 3 | Web scraping |

---

## Quick Examples

```bash
# Navigate and wait
curl -X POST localhost:9877/navigate -d '{"url":"https://github.com"}'
curl -X POST localhost:9877/webview/wait-navigation

# Click by text
curl -X POST localhost:9877/webview/click -d '{"text":"Sign in"}'

# Screenshot (fast)
curl localhost:9877/screenshot/webview?preset=fast

# Terminal command
curl -X POST localhost:9877/terminal/write -d '{"text":"npm test"}'
curl -X POST localhost:9877/terminal/key -d '{"key":"enter"}'

# Memory
curl -X POST localhost:9877/memory/save -d '{"category":"user","key":"name","value":"Alex"}'
curl localhost:9877/memory/get?category=user
```

---

## Architecture

```
i-view-mini/
├── src/main/
│   ├── automation-server-v2.ts    # HTTP API entry
│   └── automation/routes/         # Route modules
│       ├── browser.ts             # Navigation, interaction
│       ├── elements.ts            # Element queries
│       ├── tabs.ts                # Tab management
│       ├── terminal.ts            # Terminal control
│       ├── session.ts             # Session management
│       ├── memory.ts              # Persistent memory
│       └── mapper.ts              # Mahana Mapper
├── src/renderer/
│   ├── App.tsx                    # Split view UI
│   └── components/
│       ├── Browser.tsx            # Webview container
│       ├── Terminal.tsx           # xterm.js terminal
│       └── DualZoneTabBar.tsx     # Tab management
└── mcp-servers/                   # MCP server configs
```
