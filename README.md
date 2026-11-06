# CrossPost MCP Server

> [!WARNING]
> **This npm package is deprecated and no longer maintained.** Use the hosted PostingLy connector instead. It needs no install and no API key.
>
> 1. In Claude, add a custom connector with the URL `https://postingly.io/api/mcp`.
> 2. Click **Connect**.
> 3. Sign in to PostingLy and click **Allow**.
>
> The `npx crosspost-mcp` server, the `.mcpb` bundle and the `CROSSPOST_API_KEY` setup below are kept for reference only.

Cross-post to **X**, **Bluesky**, **LinkedIn**, **Threads**, and **Instagram** (Threads and Instagram: see [Supported Platforms](#supported-platforms)) from Claude, Cursor, or any MCP-compatible AI assistant. Write once, publish everywhere.

## Prerequisites

1. Create a free account at [postingly.io](https://postingly.io)
2. Connect your social media accounts on the dashboard
3. Generate an API key from **Settings → API Keys**

## Installation

### Option 1: Claude Desktop (one-click)

Download [`crosspost-mcp.mcpb`](https://postingly.io/downloads/crosspost-mcp.mcpb) and double-click it. Claude Desktop will prompt you for your API key — paste it in and you're done.

### Option 2: npx (works everywhere)

No installation needed. Add this to your MCP client config:

```json
{
  "mcpServers": {
    "crosspost": {
      "command": "npx",
      "args": ["-y", "crosspost-mcp"],
      "env": {
        "CROSSPOST_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

**Config file locations:**

| Client | Config path |
|---|---|
| Claude Desktop (macOS) | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Claude Desktop (Windows) | `%APPDATA%\Claude\claude_desktop_config.json` |
| Cursor | `.cursor/mcp.json` in your workspace, or `~/.cursor/mcp.json` globally |

### Option 3: Claude Code (CLI)

```bash
claude mcp add -s user crosspost \
  -e CROSSPOST_API_KEY=your-api-key-here \
  -e CROSSPOST_API_URL=https://postingly.io \
  -- npx -y crosspost-mcp
```

### Option 4: Manual (clone and build)

```bash
git clone https://github.com/jenny-ouyang/crosspost-mcp.git
cd crosspost-mcp
npm install && npm run build
```

Then point your MCP client to the built file:

```json
{
  "mcpServers": {
    "crosspost": {
      "command": "node",
      "args": ["/path/to/crosspost-mcp/dist/index.js"],
      "env": {
        "CROSSPOST_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

## Available Tools

| Tool | Description |
|---|---|
| `list_accounts` | See your connected platforms and their status |
| `create_post` | Publish or schedule a post across platforms |
| `list_posts` | View recent posts and their per-platform status |
| `get_post` | Get detailed info on a specific post |
| `cancel_post` | Cancel a scheduled post |
| `reschedule_post` | Change the time of a scheduled post |
| `list_scheduled` | View all upcoming scheduled posts |

## Supported Platforms

| Platform | Notes |
|---|---|
| X | Connect your own X account on the dashboard. |
| Bluesky | Connect with your handle and an app password. |
| LinkedIn | |
| Threads | The Meta app is still in development mode, so today only accounts added as testers in the Meta dashboard can connect. Open to everyone after Meta App Review. |
| Instagram | The Meta app is still in development mode, so today only accounts added as testers in the Meta dashboard can connect. Open to everyone after Meta App Review. Needs a professional (Business or Creator) account. Every Instagram post needs at least one image: pass public image URLs in `mediaUrls`. Image posts need crosspost-mcp 0.2.0 or later (npm still serves 0.1.0 until the next release). The hosted MCP endpoint cannot send images yet. |

## Usage Examples

Once installed, just talk to Claude naturally:

- "Post 'Hello world!' to all my platforms"
- "Post this to Bluesky and Threads: Just shipped a new feature!"
- "Schedule a post for tomorrow at 9am: Big announcement coming soon"
- "Post this photo to Instagram with the caption 'New launch': https://example.com/photo.jpg"
- "Show me my recent posts"
- "What accounts do I have connected?"

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `CROSSPOST_API_KEY` | Yes | Your API key from the CrossPost dashboard |
| `CROSSPOST_API_URL` | No | API URL (defaults to `https://postingly.io`). Only change if self-hosting. |

## License

MIT
