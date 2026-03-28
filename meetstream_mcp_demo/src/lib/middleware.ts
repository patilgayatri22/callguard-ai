import type { Request, Response, NextFunction } from 'express';
import { logger } from './logger.js';

const STATIC_TOKEN = process.env.MCP_BEARER_TOKEN;

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  // Skip auth for public routes
  const publicPaths = [
    '/.well-known/oauth-protected-resource',
    '/register',
    '/oauth/authorize',
    '/oauth/token',
    '/oauth/callback',
    '/health',
    '/mcp-metadata',
  ];
  if (publicPaths.includes(req.path) || req.method === 'OPTIONS') {
    next();
    return;
  }

  const authHeader = req.headers['authorization'];
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({
      error: 'unauthorized',
      error_description: 'Missing or invalid Bearer token',
    });
    return;
  }

  const token = authHeader.slice(7);

  // Mode 1: static bearer token (for MeetStream ↔ ngrok proxy)
  if (STATIC_TOKEN) {
    if (token !== STATIC_TOKEN) {
      logger.warn('Static bearer token mismatch');
      res.status(401).json({ error: 'unauthorized', error_description: 'Invalid Bearer token' });
      return;
    }
    (req as any).scopes = ['gmail:read'];
    next();
    return;
  }

  // Mode 2: Scalekit OAuth introspection
  try {
    const { getScalekitClient } = await import('./scalekit.js');
    const sk = getScalekitClient();
    const introspection = await (sk as any).auth.introspectToken(token);
    if (!introspection.active) {
      res.status(401).json({ error: 'unauthorized', error_description: 'Token is not active' });
      return;
    }
    (req as any).tokenPayload = introspection;
    (req as any).scopes = (introspection.scope ?? '').split(' ');
    next();
  } catch (err) {
    logger.error('Token validation failed', { err });
    res.status(401).json({
      error: 'unauthorized',
      error_description: 'Token validation failed',
    });
  }
}

export function checkScope(scope: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const scopes: string[] = (req as any).scopes ?? [];
    if (!scopes.includes(scope)) {
      res.status(403).json({
        error: 'insufficient_scope',
        error_description: `Required scope: ${scope}`,
      });
      return;
    }
    next();
  };
}

/**
 * Checks whether a user's scope list satisfies all required scopes for a tool.
 */
export function validateToolScopes(userScopes: string[], requiredScopes: string[]): boolean {
  return requiredScopes.every((s) => userScopes.includes(s));
}
