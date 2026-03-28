import dotenv from 'dotenv';

dotenv.config();

interface Config {
  serverName: string;
  serverVersion: string;
  port: number;
  skEnvUrl: string;
  skClientId: string;
  skClientSecret: string;
  logLevel: string;
  mcpServerId: string;
  protectedResourceMetadata: string;
  publicUrl: string;
}

const PORT = parseInt(process.env.PORT || '3002', 10);

export const config: Config = {
  serverName: 'Gmail MCP Server',
  serverVersion: '1.0.0',
  port: PORT,
  skEnvUrl: process.env.SK_ENV_URL || '',
  skClientId: process.env.SK_CLIENT_ID || '',
  skClientSecret: process.env.SK_CLIENT_SECRET || '',
  logLevel: process.env.LOG_LEVEL || 'info',
  mcpServerId: process.env.MCP_SERVER_ID || '',
  protectedResourceMetadata: process.env.PROTECTED_RESOURCE_METADATA || '',
  publicUrl: process.env.PUBLIC_URL || '',
};
