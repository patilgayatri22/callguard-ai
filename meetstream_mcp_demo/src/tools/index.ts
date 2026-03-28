import { McpServer, RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerGmailTools } from './gmail.js';
import { logger } from '../lib/logger.js';

/**
 * Tool definitions for the Gmail MCP Server
 *
 * Mapped to actual Scalekit Agent Actions tool names.
 * All available Gmail tools are read-only.
 */

const toolsList = {
  fetch_emails: {
    name: 'fetch_emails',
    description: 'Fetch recent emails from Gmail. Can filter by label and control result count.',
    requiredScopes: ['gmail:read'],
  },
  get_message: {
    name: 'get_message',
    description: '[IMPORTANT]: invoke fetch_emails first to get message IDs. Retrieve a specific email by its Gmail message ID.',
    requiredScopes: ['gmail:read'],
  },
  list_threads: {
    name: 'list_threads',
    description: 'List Gmail threads (conversation threads). Returns thread IDs and snippets.',
    requiredScopes: ['gmail:read'],
  },
  get_thread: {
    name: 'get_thread',
    description: '[IMPORTANT]: invoke list_threads first to get thread IDs. Retrieve a specific Gmail thread by thread ID.',
    requiredScopes: ['gmail:read'],
  },
  list_drafts: {
    name: 'list_drafts',
    description: 'List all draft emails in the Gmail account.',
    requiredScopes: ['gmail:read'],
  },
  get_contacts: {
    name: 'get_contacts',
    description: 'Fetch Gmail/Google contacts.',
    requiredScopes: ['gmail:read'],
  },
  search_people: {
    name: 'search_people',
    description: 'Search for people in Google contacts by name or email.',
    requiredScopes: ['gmail:read'],
  },
  get_attachment: {
    name: 'get_attachment',
    description: 'Fetch an email attachment by its attachment ID and message ID.',
    requiredScopes: ['gmail:read'],
  },
} as const;

export type ToolKey = keyof typeof toolsList;

export type ToolDefinition = {
  name: ToolKey;
  description: string;
  registeredTool?: RegisteredTool;
  requiredScopes: string[];
};

export const TOOLS: { [K in ToolKey]: ToolDefinition & { name: K } } = Object.fromEntries(
  Object.entries(toolsList).map(([key, val]) => [
    key,
    { ...val, name: key, requiredScopes: [...val.requiredScopes] } as ToolDefinition & { name: typeof key },
  ])
) as any;

export function registerTools(server: McpServer) {
  logger.info('Starting tool registration...', {
    totalTools: Object.keys(TOOLS).length,
    toolNames: Object.keys(TOOLS)
  });

  try {
    registerGmailTools(server);

    const registeredCount = Object.values(TOOLS).filter(t => t.registeredTool).length;

    logger.info('Tool registration complete!', {
      registered: registeredCount,
      total: Object.keys(TOOLS).length,
      toolNames: Object.keys(TOOLS)
    });

    if (registeredCount === 0) {
      logger.error('WARNING: No tools were registered!');
    }
  } catch (error) {
    logger.error('Error during tool registration:', error);
    throw error;
  }
}
