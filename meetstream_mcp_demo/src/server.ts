#!/usr/bin/env node

import express from 'express';
import helmet from 'helmet';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { config } from './config/config.js';
import { logger } from './lib/logger.js';
import { authMiddleware } from './lib/middleware.js';
import { oauthRouter } from './lib/auth.js';
import { setupTransportRoutes } from './lib/transport.js';
import { registerTools } from './tools/index.js';

const app = express();

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: false
}));

// CORS configuration
app.use((req, res, next) => {
  const origin = req.headers.origin || '*';

  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, Origin, X-Requested-With, mcp-protocol-version');
  res.setHeader('Access-Control-Expose-Headers', 'WWW-Authenticate');
  res.setHeader('Access-Control-Allow-Credentials', 'false');

  if (req.method === 'OPTIONS') {
    logger.info('CORS Preflight:', {
      origin: req.headers.origin,
      method: req.headers['access-control-request-method'],
      headers: req.headers['access-control-request-headers']
    });
    return res.status(204).end();
  }

  next();
});

// Parse request bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    headers: {
      authorization: req.headers.authorization ? 'Bearer ***' : 'none',
      'content-type': req.headers['content-type']
    },
    body: req.body?.method || (req.body && Object.keys(req.body).length > 0 ? 'present' : 'empty')
  });
  next();
});

// Public routes (no auth required)
app.use(oauthRouter);

// MCP Server initialization
const mcpServer = new McpServer({
  name: config.serverName,
  version: config.serverVersion,
});

registerTools(mcpServer);

logger.info('MCP Server initialized:', {
  name: config.serverName,
  version: config.serverVersion
});

// Protected routes (auth required)
app.use('/', authMiddleware);

setupTransportRoutes(app, mcpServer);

// Error handling
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error:', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method
  });

  res.status(err.status || 500).json({
    error: 'internal_server_error',
    error_description: err.message || 'An unexpected error occurred'
  });
});

// Server startup
const server = app.listen(config.port, () => {
  logger.info('Gmail MCP Server Started', {
    port: config.port,
    publicUrl: config.publicUrl,
    environment: process.env.NODE_ENV || '',
    endpoints: {
      health: `${config.publicUrl}/health`,
      discovery: `${config.publicUrl}/.well-known/oauth-protected-resource`,
      authorization: `${config.publicUrl}/oauth/authorize`,
      token: `${config.publicUrl}/oauth/token`,
      registration: `${config.publicUrl}/register`,
      mcpMetadata: `${config.publicUrl}/mcp-metadata`
    }
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT signal received: closing HTTP server');
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Promise Rejection:', {
    reason,
    promise
  });
});

export default app;
