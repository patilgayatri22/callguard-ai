import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { logger } from '../lib/logger.js';
import { TOOLS } from './index.js';
import { validateToolScopes } from '../lib/middleware.js';
import { userContextStore } from '../lib/transport.js';
import { executeScalekitTool, ensureGmailConnected } from '../lib/scalekit-agent-client.js';

function getUserContext(context: any) {
  const sessions = Array.from(userContextStore.entries());
  if (sessions.length > 0) {
    sessions.sort((a, b) => {
      const aTime = parseInt(a[0].split('_')[1]);
      const bTime = parseInt(b[0].split('_')[1]);
      return bTime - aTime;
    });
    return sessions[0][1];
  }
  return null;
}

function validateUserScopes(context: any, toolName: keyof typeof TOOLS): boolean {
  const userContext = getUserContext(context);
  if (!userContext?.user) {
    logger.warn('No user context found for scope validation');
    return false;
  }
  const requiredScopes = TOOLS[toolName].requiredScopes;
  const userScopes = userContext.user.scopes || [];
  const hasValidScope = validateToolScopes(userScopes, requiredScopes);
  if (!hasValidScope) {
    logger.warn(`User lacks required scopes for tool ${toolName}`, {
      userId: userContext.user.id, userScopes, requiredScopes
    });
  }
  return hasValidScope;
}

async function requireGmailConnection(userContext: any): Promise<{ content: { type: string; text: string }[] } | null> {
  if (!userContext?.user?.id) {
    return { content: [{ type: 'text', text: 'Error: No user context found.' }] };
  }
  try {
    const status = await ensureGmailConnected(userContext.user.id);
    if (!status.connected) {
      const authLink = status.authLink || 'your Scalekit dashboard';
      return {
        content: [{
          type: 'text',
          text: `Your Gmail account is not connected yet. Please authorize access by visiting this link:\n\n${authLink}\n\nAfter connecting your Gmail, try this tool again.`
        }]
      };
    }
  } catch (error) {
    logger.error('Error checking Gmail connection:', error);
    return {
      content: [{ type: 'text', text: `Error checking Gmail connection: ${error instanceof Error ? error.message : String(error)}` }]
    };
  }
  return null;
}

export function registerGmailTools(server: McpServer) {

  // ============================================================
  // FETCH EMAILS -> gmail_fetch_mails
  // ============================================================

  TOOLS.fetch_emails.registeredTool = (server as any).tool(
    'fetch_emails',
    TOOLS.fetch_emails.description,
    {
      max_results: z.string().describe('Maximum number of emails to fetch (1-10, default: "5")'),
      label_ids: z.string().describe('Comma-separated Gmail label IDs to filter (e.g. "INBOX", "SENT", "UNREAD"). Default: INBOX'),
      query: z.string().describe('Gmail search query to filter emails (e.g. "is:unread", "from:user@example.com"). Leave empty for no filter.'),
    },
    async (args: any, context: any) => {
      logger.info('Invoked fetch_emails tool', { args });

      if (!validateUserScopes(context, 'fetch_emails')) {
        return { content: [{ type: 'text', text: 'Error: Insufficient permissions. You need gmail:read scope.' }] };
      }

      const userContext = getUserContext(context);
      const connectionError = await requireGmailConnection(userContext);
      if (connectionError) return connectionError;

      try {
        const params: any = {};
        if (args.max_results) params.max_results = parseInt(args.max_results, 10) || 5;
        if (args.label_ids) params.label_ids = args.label_ids.split(',').map((l: string) => l.trim()).filter(Boolean);
        if (args.query) params.query = args.query;

        const result = await executeScalekitTool(userContext?.user.id, 'gmail_fetch_mails', params);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: 'text', text: `Error fetching emails: ${error instanceof Error ? error.message : String(error)}` }] };
      }
    }
  );

  // ============================================================
  // GET MESSAGE -> gmail_get_message_by_id
  // ============================================================

  TOOLS.get_message.registeredTool = (server as any).tool(
    'get_message',
    TOOLS.get_message.description,
    {
      message_id: z.string().describe('The Gmail message ID to retrieve'),
    },
    async (args: any, context: any) => {
      logger.info('Invoked get_message tool', { messageId: args.message_id });

      if (!validateUserScopes(context, 'get_message')) {
        return { content: [{ type: 'text', text: 'Error: Insufficient permissions. You need gmail:read scope.' }] };
      }

      const userContext = getUserContext(context);
      const connectionError = await requireGmailConnection(userContext);
      if (connectionError) return connectionError;

      try {
        const result = await executeScalekitTool(userContext?.user.id, 'gmail_get_message_by_id', { message_id: args.message_id });
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: 'text', text: `Error fetching message: ${error instanceof Error ? error.message : String(error)}` }] };
      }
    }
  );

  // ============================================================
  // LIST THREADS -> gmail_list_threads
  // ============================================================

  TOOLS.list_threads.registeredTool = (server as any).tool(
    'list_threads',
    TOOLS.list_threads.description,
    {
      max_results: z.string().describe('Maximum number of threads to return (default: "10")'),
      query: z.string().describe('Gmail search query to filter threads. Leave empty for no filter.'),
    },
    async (args: any, context: any) => {
      logger.info('Invoked list_threads tool', { args });

      if (!validateUserScopes(context, 'list_threads')) {
        return { content: [{ type: 'text', text: 'Error: Insufficient permissions. You need gmail:read scope.' }] };
      }

      const userContext = getUserContext(context);
      const connectionError = await requireGmailConnection(userContext);
      if (connectionError) return connectionError;

      try {
        const params: any = {};
        if (args.max_results) params.max_results = parseInt(args.max_results, 10) || 10;
        if (args.query) params.query = args.query;

        const result = await executeScalekitTool(userContext?.user.id, 'gmail_list_threads', params);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: 'text', text: `Error listing threads: ${error instanceof Error ? error.message : String(error)}` }] };
      }
    }
  );

  // ============================================================
  // GET THREAD -> gmail_get_thread_by_id
  // ============================================================

  TOOLS.get_thread.registeredTool = (server as any).tool(
    'get_thread',
    TOOLS.get_thread.description,
    {
      thread_id: z.string().describe('The Gmail thread ID to retrieve'),
    },
    async (args: any, context: any) => {
      logger.info('Invoked get_thread tool', { threadId: args.thread_id });

      if (!validateUserScopes(context, 'get_thread')) {
        return { content: [{ type: 'text', text: 'Error: Insufficient permissions. You need gmail:read scope.' }] };
      }

      const userContext = getUserContext(context);
      const connectionError = await requireGmailConnection(userContext);
      if (connectionError) return connectionError;

      try {
        const result = await executeScalekitTool(userContext?.user.id, 'gmail_get_thread_by_id', { thread_id: args.thread_id });
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: 'text', text: `Error fetching thread: ${error instanceof Error ? error.message : String(error)}` }] };
      }
    }
  );

  // ============================================================
  // LIST DRAFTS -> gmail_list_drafts
  // ============================================================

  TOOLS.list_drafts.registeredTool = (server as any).tool(
    'list_drafts',
    TOOLS.list_drafts.description,
    {
      max_results: z.string().describe('Maximum number of drafts to return (default: "10")'),
    },
    async (args: any, context: any) => {
      logger.info('Invoked list_drafts tool');

      if (!validateUserScopes(context, 'list_drafts')) {
        return { content: [{ type: 'text', text: 'Error: Insufficient permissions. You need gmail:read scope.' }] };
      }

      const userContext = getUserContext(context);
      const connectionError = await requireGmailConnection(userContext);
      if (connectionError) return connectionError;

      try {
        const params: any = {};
        if (args.max_results) params.max_results = parseInt(args.max_results, 10) || 10;

        const result = await executeScalekitTool(userContext?.user.id, 'gmail_list_drafts', params);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: 'text', text: `Error listing drafts: ${error instanceof Error ? error.message : String(error)}` }] };
      }
    }
  );

  // ============================================================
  // GET CONTACTS -> gmail_get_contacts
  // ============================================================

  TOOLS.get_contacts.registeredTool = (server as any).tool(
    'get_contacts',
    TOOLS.get_contacts.description,
    {},
    async (_args: any, context: any) => {
      logger.info('Invoked get_contacts tool');

      if (!validateUserScopes(context, 'get_contacts')) {
        return { content: [{ type: 'text', text: 'Error: Insufficient permissions. You need gmail:read scope.' }] };
      }

      const userContext = getUserContext(context);
      const connectionError = await requireGmailConnection(userContext);
      if (connectionError) return connectionError;

      try {
        const result = await executeScalekitTool(userContext?.user.id, 'gmail_get_contacts', {});
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: 'text', text: `Error fetching contacts: ${error instanceof Error ? error.message : String(error)}` }] };
      }
    }
  );

  // ============================================================
  // SEARCH PEOPLE -> gmail_search_people
  // ============================================================

  TOOLS.search_people.registeredTool = (server as any).tool(
    'search_people',
    TOOLS.search_people.description,
    {
      query: z.string().describe('Search query for people (name or email)'),
    },
    async (args: any, context: any) => {
      logger.info('Invoked search_people tool', { query: args.query });

      if (!validateUserScopes(context, 'search_people')) {
        return { content: [{ type: 'text', text: 'Error: Insufficient permissions. You need gmail:read scope.' }] };
      }

      const userContext = getUserContext(context);
      const connectionError = await requireGmailConnection(userContext);
      if (connectionError) return connectionError;

      try {
        const result = await executeScalekitTool(userContext?.user.id, 'gmail_search_people', { query: args.query });
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: 'text', text: `Error searching people: ${error instanceof Error ? error.message : String(error)}` }] };
      }
    }
  );

  // ============================================================
  // GET ATTACHMENT -> gmail_get_attachment_by_id
  // ============================================================

  TOOLS.get_attachment.registeredTool = (server as any).tool(
    'get_attachment',
    TOOLS.get_attachment.description,
    {
      message_id: z.string().describe('The Gmail message ID containing the attachment'),
      attachment_id: z.string().describe('The attachment ID to retrieve'),
    },
    async (args: any, context: any) => {
      logger.info('Invoked get_attachment tool', { messageId: args.message_id, attachmentId: args.attachment_id });

      if (!validateUserScopes(context, 'get_attachment')) {
        return { content: [{ type: 'text', text: 'Error: Insufficient permissions. You need gmail:read scope.' }] };
      }

      const userContext = getUserContext(context);
      const connectionError = await requireGmailConnection(userContext);
      if (connectionError) return connectionError;

      try {
        const result = await executeScalekitTool(userContext?.user.id, 'gmail_get_attachment_by_id', {
          message_id: args.message_id,
          attachment_id: args.attachment_id,
        });
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: 'text', text: `Error fetching attachment: ${error instanceof Error ? error.message : String(error)}` }] };
      }
    }
  );

  // Registration summary
  const toolsRegistered = Object.entries(TOOLS).map(([key, tool]) => ({
    name: key, registered: !!tool.registeredTool, scopes: tool.requiredScopes
  }));

  logger.info('Tool registration summary:', {
    tools: toolsRegistered,
    successCount: toolsRegistered.filter(t => t.registered).length,
    failedCount: toolsRegistered.filter(t => !t.registered).length
  });

  logger.info('All Gmail tools registered successfully');
}
