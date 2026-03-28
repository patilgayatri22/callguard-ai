import crypto from 'node:crypto';
import type { Express, Request, Response } from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { logger } from './logger.js';

const UPSTREAM_URL = process.env.MCP_UPSTREAM_URL?.replace(/\/$/, '');

/**
 * Shared store mapping session IDs to user context objects.
 * Used by tool handlers to look up the authenticated user.
 */
export interface UserContext {
  user?: {
    id: string;
    scopes?: string[];
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export const userContextStore = new Map<string, UserContext>();

/**
 * Proxy an authenticated request to the upstream ngrok MCP server.
 * Strips Authorization header — upstream has no auth.
 */
async function proxyToUpstream(req: Request, res: Response): Promise<void> {
  if (!UPSTREAM_URL) {
    res.status(502).json({ error: 'No upstream MCP server configured (set MCP_UPSTREAM_URL)' });
    return;
  }

  const upstreamUrl = `${UPSTREAM_URL}/`;
  const forwardedHeaders: Record<string, string> = {
    'content-type': (req.headers['content-type'] as string) ?? 'application/json',
    'accept': (req.headers['accept'] as string) ?? 'application/json, text/event-stream',
  };

  // Preserve MCP session ID for stateful connections
  if (req.headers['mcp-session-id']) {
    forwardedHeaders['mcp-session-id'] = req.headers['mcp-session-id'] as string;
  }

  logger.info('Proxying to upstream MCP server', { method: req.method, upstreamUrl });

  try {
    const upstream = await fetch(upstreamUrl, {
      method: req.method,
      headers: forwardedHeaders,
      body:
        req.method !== 'GET' && req.method !== 'HEAD'
          ? JSON.stringify(req.body)
          : undefined,
    });

    res.status(upstream.status);

    const skipHeaders = new Set(['transfer-encoding', 'connection', 'keep-alive', 'upgrade']);
    upstream.headers.forEach((value, key) => {
      if (!skipHeaders.has(key.toLowerCase())) res.setHeader(key, value);
    });

    const contentType = upstream.headers.get('content-type') ?? '';

    if (contentType.includes('text/event-stream')) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();

      const reader = upstream.body?.getReader();
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(value);
        }
      }
      res.end();
    } else {
      const body = await upstream.text();
      res.send(body);
    }
  } catch (err) {
    logger.error('Upstream proxy error', { err });
    res.status(502).json({ error: 'Upstream MCP server unreachable', detail: String(err) });
  }
}

/**
 * Sets up MCP transport routes on the Express app.
 *
 * Proxy mode  (MCP_UPSTREAM_URL set):  forward to upstream ngrok server
 * Direct mode (no MCP_UPSTREAM_URL):   handle locally with StreamableHTTPServerTransport
 */
export function setupTransportRoutes(app: Express, mcpServer: McpServer): void {
  if (UPSTREAM_URL) {
    logger.info('Transport: PROXY mode', { upstreamUrl: UPSTREAM_URL });

    app.all('/', async (req: Request, res: Response) => {
      await proxyToUpstream(req, res);
    });
  } else {
    logger.info('Transport: DIRECT mode (local StreamableHTTP)');

    app.post('/', async (req: Request, res: Response) => {
      try {
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => crypto.randomUUID(),
        });
        await mcpServer.connect(transport);
        await transport.handleRequest(req, res, req.body);
      } catch (err) {
        logger.error('MCP transport error', { err });
        if (!res.headersSent) {
          res.status(500).json({ error: 'MCP transport error', detail: String(err) });
        }
      }
    });

    // SSE GET for streaming transports
    app.get('/', async (req: Request, res: Response) => {
      try {
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => crypto.randomUUID(),
        });
        await mcpServer.connect(transport);
        await transport.handleRequest(req, res, req.body);
      } catch (err) {
        logger.error('MCP SSE transport error', { err });
        if (!res.headersSent) {
          res.status(500).json({ error: 'MCP SSE error', detail: String(err) });
        }
      }
    });

    // DELETE for session teardown
    app.delete('/', async (req: Request, res: Response) => {
      try {
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => crypto.randomUUID(),
        });
        await mcpServer.connect(transport);
        await transport.handleRequest(req, res, req.body);
      } catch (err) {
        logger.error('MCP DELETE transport error', { err });
        if (!res.headersSent) {
          res.status(500).json({ error: 'MCP session teardown error', detail: String(err) });
        }
      }
    });
  }
}
