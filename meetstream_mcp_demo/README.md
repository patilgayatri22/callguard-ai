# Gmail MCP Server

A Model Context Protocol (MCP) server that provides secure, OAuth 2.0-authenticated read access to Gmail via Scalekit's Agent Actions (tool calling). Built as a demo for Meetstream.ai integration.

## Features

- **OAuth 2.0 Authentication** via Scalekit MCP Auth (Full Stack Auth)
- **Automatic Gmail Connection** — prompts users to connect their Google account on first use via Scalekit Agent Auth
- **8 Gmail Tools** via Scalekit Tool Calling (no direct Gmail API calls):
  - Fetch emails, get message by ID
  - List and get threads
  - List drafts
  - Get contacts, search people
  - Download attachments
- **Dynamic Client Registration** for easy MCP client setup
- **Deployable** to Render, ngrok, or any Node.js host

## Prerequisites

- **Node.js** 18.0.0 or higher
- **Scalekit Account** ([app.scalekit.com](https://app.scalekit.com)) with:
  - An application configured for Full Stack Auth
  - Google Mail connection enabled in Agent Actions
- **(Optional) ngrok** for local development with a public URL

## Quick Start

### 1. Install

```bash
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Fill in your `.env`:

```env
# Scalekit credentials (from Scalekit dashboard)
SK_ENV_URL=https://your-env.scalekit.dev
SK_CLIENT_ID=skc_your_client_id
SK_CLIENT_SECRET=test_your_client_secret

# Server
PORT=3002
PUBLIC_URL=http://localhost:3002   # or your ngrok/Render URL

# MCP Server ID (from Scalekit dashboard)
MCP_SERVER_ID=res_your_server_id

# Protected Resource Metadata (update resource and authorization_servers)
PROTECTED_RESOURCE_METADATA={"authorization_servers":["https://your-env.scalekit.dev/resources/res_your_server_id"],"bearer_methods_supported":["header"],"resource":"http://localhost:3002/","scopes_supported":["gmail:read"]}
```

### 3. Set Up Scalekit

1. Create an application in your [Scalekit dashboard](https://app.scalekit.com)
2. Switch to **Full Stack Auth** mode (avoids needing to specify organization/connection IDs)
3. Add redirect URLs:
   - `http://localhost:3002/oauth/callback` (local dev)
   - Your production callback URL when deploying
4. Enable **Google Mail** as a connection in Agent Actions
5. Register supported scopes: `openid`, `profile`, `email`, `gmail:read`

### 4. Run

```bash
# Development (hot reload)
npm run dev

# Production
npm run build
npm start
```

The server starts on port 3002 by default.

## Project Structure

```
src/
├── server.ts                    # Express app + MCP server entry point
├── config/
│   └── config.ts                # Environment configuration
├── lib/
│   ├── auth.ts                  # OAuth routes (discovery, register, authorize, token, callback)
│   ├── logger.ts                # Winston structured logging
│   ├── middleware.ts            # Auth middleware + scope validation
│   ├── scalekit.ts              # Scalekit SDK singleton
│   ├── scalekit-agent-client.ts # Connected account management + tool execution via SDK
│   └── transport.ts             # MCP StreamableHTTPServerTransport
└── tools/
    ├── index.ts                 # Tool registry with scope definitions
    └── gmail.ts                 # Gmail tool implementations
```

## Available Tools

All tools require the `gmail:read` scope.

| MCP Tool | Scalekit Tool Name | Description |
|----------|-------------------|-------------|
| `fetch_emails` | `gmail_fetch_mails` | Fetch recent emails, filter by label or search query |
| `get_message` | `gmail_get_message_by_id` | Get a specific email by message ID |
| `list_threads` | `gmail_list_threads` | List Gmail conversation threads |
| `get_thread` | `gmail_get_thread_by_id` | Get a specific thread by thread ID |
| `list_drafts` | `gmail_list_drafts` | List all draft emails |
| `get_contacts` | `gmail_get_contacts` | Fetch Google contacts |
| `search_people` | `gmail_search_people` | Search people by name or email |
| `get_attachment` | `gmail_get_attachment_by_id` | Download an email attachment |

## Authentication & Connection Flow

The server has two authentication layers:

1. **MCP Auth** (Scalekit OAuth) — authenticates the user to the MCP server
2. **Gmail Connection** (Scalekit Agent Auth) — connects the user's Google account for Gmail access

```
┌──────────────┐
│  MCP Client  │  (Claude Desktop, Meetstream, MCP Inspector)
│  (AI Agent)  │
└──────┬───────┘
       │ 1. Request tool (e.g. fetch_emails)
       ▼
┌──────────────┐
│  Gmail MCP   │  2. Validates Bearer token via Scalekit SDK
│   Server     │  3. Checks gmail:read scope
└──────┬───────┘
       │ 4. Checks Gmail connected account status
       │    → If not connected: returns authorization link
       │    → If connected: proceeds to step 5
       ▼
┌──────────────┐
│  Scalekit    │  5. Executes gmail_* tool via actions.executeTool()
│  Agent       │     using the Scalekit Node SDK
│  Actions     │
└──────┬───────┘
       │ 6. Returns Gmail data
       ▼
┌──────────────┐
│  Gmail MCP   │  7. Formats and returns result to MCP client
│   Server     │
└──────────────┘
```

### First-time Gmail Connection

When a user calls a Gmail tool for the first time, the server:
1. Calls `scalekit.actions.getOrCreateConnectedAccount()` to check status
2. If not active, calls `scalekit.actions.getAuthorizationLink()` to get a magic link
3. Returns the link to the user — they click it to authorize Gmail access via Google OAuth
4. On retry, the connected account is active and the tool executes

## Using with Claude Desktop

Add to your Claude Desktop config:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "gmail": {
      "url": "https://your-server-url.com",
      "oauth": {
        "type": "oauth2",
        "authorizationUrl": "https://your-server-url.com/oauth/authorize",
        "tokenUrl": "https://your-server-url.com/oauth/token",
        "registrationUrl": "https://your-server-url.com/register",
        "scope": "openid profile email gmail:read"
      }
    }
  }
}
```

Restart Claude Desktop, then ask Claude to read your emails.

## API Endpoints

### Public (no auth required)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/.well-known/oauth-protected-resource` | OAuth discovery metadata |
| POST | `/register` | Dynamic client registration |
| GET | `/oauth/authorize` | Start OAuth flow |
| POST | `/oauth/token` | Exchange code for token |
| GET | `/oauth/callback` | OAuth callback |
| GET | `/health` | Health check |
| GET | `/mcp-metadata` | MCP server capabilities |

### Protected (auth required)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/` | MCP protocol endpoint |

## Deployment

### Docker

```bash
docker build -t gmail-mcp-server .
docker run -p 3002:3002 --env-file .env gmail-mcp-server
```

### Render

1. Push to a Git repository
2. Create a new **Web Service** on Render
3. Set environment to **Node**
4. Set build command: `npm install && npm run build`
5. Set start command: `npm start`
6. Add all environment variables from `.env`
7. Update `PUBLIC_URL` to your Render URL (e.g. `https://your-app.onrender.com`)
8. Update `PROTECTED_RESOURCE_METADATA` — set `resource` to your Render URL
9. Add the Render callback URL in Scalekit dashboard

### ngrok (local dev)

```bash
npm run dev
ngrok http 3002

# Update .env:
# PUBLIC_URL=https://your-id.ngrok-free.app
```

Update the redirect URL in Scalekit dashboard to match.

## Testing with MCP Inspector

```bash
npx @mcpjam/inspector@latest
```

Enter your server URL and OAuth details in the inspector to test tools interactively.

## Troubleshooting

### "Missing or invalid Bearer token"
- Ensure `Authorization: Bearer <token>` header is present
- Check that the token hasn't expired

### "Token validation failed" / unexpected "aud" claim
- The server tries multiple audience values (PUBLIC_URL, MCP_SERVER_ID, resource URL)
- Verify `PUBLIC_URL` and `MCP_SERVER_ID` in `.env` are correct
- Check `SK_ENV_URL` is correct

### "Gmail account is not connected yet"
- The user needs to click the authorization link returned by the tool
- After authorizing, retry the tool call
- Check connected account status in the Scalekit dashboard

### "failed to get tool: tool_name"
- Run `npx tsx scripts/list-tools.ts` to see available tools in your Scalekit environment
- Verify Google Mail is enabled as a connection in Agent Actions

### "invalid_connection_selector"
- Switch to **Full Stack Auth** mode in Scalekit dashboard
- Or set `SK_ORGANIZATION_ID` in `.env` if using Modular Auth

## License

MIT
