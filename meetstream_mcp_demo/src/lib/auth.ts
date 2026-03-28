import { Router } from 'express';
import crypto from 'node:crypto';
import { config } from '../config/config.js';
import { logger } from './logger.js';

export const oauthRouter = Router();

// In-memory state stores (use Redis in production)
const pendingStates = new Map<string, {
  clientId: string;
  redirectUri: string;
  codeChallenge?: string;
}>();
const authCodes = new Map<string, {
  sub: string;
  clientId: string;
  scopes: string[];
}>();

// RFC 9728 — OAuth Protected Resource Metadata
oauthRouter.get('/.well-known/oauth-protected-resource', (_req, res) => {
  if (config.protectedResourceMetadata) {
    try {
      res.json(JSON.parse(config.protectedResourceMetadata));
      return;
    } catch {
      // fall through to default
    }
  }
  res.json({
    resource: `${config.publicUrl}/`,
    authorization_servers: [config.skEnvUrl],
    bearer_methods_supported: ['header'],
    scopes_supported: ['openid', 'profile', 'email', 'gmail:read'],
  });
});

// RFC 7591 — Dynamic Client Registration
oauthRouter.post('/register', (req, res) => {
  const clientId = `client_${crypto.randomUUID()}`;
  logger.info('Dynamic client registered', { clientId });
  res.status(201).json({
    client_id: clientId,
    client_secret: crypto.randomUUID(),
    redirect_uris: req.body?.redirect_uris ?? [],
    grant_types: ['authorization_code'],
    response_types: ['code'],
    token_endpoint_auth_method: 'client_secret_post',
  });
});

// Authorization endpoint — redirects to Scalekit
oauthRouter.get('/oauth/authorize', (req, res) => {
  const { client_id, redirect_uri, state, scope, code_challenge } =
    req.query as Record<string, string>;
  const stateKey = state ?? crypto.randomUUID();

  pendingStates.set(stateKey, {
    clientId: client_id,
    redirectUri: redirect_uri,
    codeChallenge: code_challenge,
  });

  const authUrl = new URL(`${config.skEnvUrl}/oauth/authorize`);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('client_id', config.skClientId);
  authUrl.searchParams.set('redirect_uri', `${config.publicUrl}/oauth/callback`);
  authUrl.searchParams.set('scope', scope ?? 'openid profile email gmail:read');
  authUrl.searchParams.set('state', stateKey);

  logger.info('Redirecting to Scalekit', { authUrl: authUrl.toString() });
  res.redirect(authUrl.toString());
});

// OAuth callback from Scalekit
oauthRouter.get('/oauth/callback', async (req, res) => {
  const { code, state, error } = req.query as Record<string, string>;

  if (error) {
    logger.error('OAuth callback error', { error });
    res.status(400).send(`OAuth error: ${error}`);
    return;
  }

  const pending = pendingStates.get(state);
  if (!pending) {
    res.status(400).send('Invalid or expired state');
    return;
  }
  pendingStates.delete(state);

  try {
    const tokenRes = await fetch(`${config.skEnvUrl}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: `${config.publicUrl}/oauth/callback`,
        client_id: config.skClientId,
        client_secret: config.skClientSecret,
      }).toString(),
    });
    const tokenData = (await tokenRes.json()) as any;

    const mcpCode = crypto.randomUUID();
    authCodes.set(mcpCode, {
      sub: tokenData.sub ?? tokenData.user_id ?? 'user',
      clientId: pending.clientId,
      scopes: ['openid', 'profile', 'email', 'gmail:read'],
    });

    const redirectUrl = new URL(pending.redirectUri);
    redirectUrl.searchParams.set('code', mcpCode);
    redirectUrl.searchParams.set('state', state);
    res.redirect(redirectUrl.toString());
  } catch (err) {
    logger.error('Token exchange failed', { err });
    res.status(500).send('Token exchange failed');
  }
});

// Token endpoint
oauthRouter.post('/oauth/token', (req, res) => {
  const { grant_type, code, client_id } = req.body as Record<string, string>;

  if (grant_type !== 'authorization_code') {
    res.status(400).json({ error: 'unsupported_grant_type' });
    return;
  }

  const stored = authCodes.get(code);
  if (!stored || stored.clientId !== client_id) {
    res.status(400).json({ error: 'invalid_grant' });
    return;
  }
  authCodes.delete(code);

  const accessToken = process.env.MCP_BEARER_TOKEN || `token_${crypto.randomUUID()}`;

  res.json({
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: 3600,
    scope: stored.scopes.join(' '),
  });
});

// Health check
oauthRouter.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    proxyMode: !!process.env.MCP_UPSTREAM_URL,
    upstreamUrl: process.env.MCP_UPSTREAM_URL || null,
  });
});

// MCP server capabilities metadata
oauthRouter.get('/mcp-metadata', (_req, res) => {
  res.json({
    name: 'callguard-gmail-mcp',
    version: '1.0.0',
    description: 'Gmail MCP server with Scalekit OAuth + MeetStream proxy',
    proxyMode: !!process.env.MCP_UPSTREAM_URL,
    upstreamUrl: process.env.MCP_UPSTREAM_URL || null,
  });
});
