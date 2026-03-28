import { getScalekitClient } from './scalekit.js';
import { logger } from './logger.js';

const GMAIL_CONNECTION = 'gmail';

export async function ensureGmailConnected(
  identifier: string
): Promise<{ connected: boolean; authLink?: string }> {
  const sk = getScalekitClient();
  try {
    const resp = await (sk as any).actions.getOrCreateConnectedAccount({
      connectionName: GMAIL_CONNECTION,
      identifier,
    });
    const account = resp.connectedAccount ?? resp.connected_account;
    if (account?.status === 'ACTIVE') {
      logger.info('Gmail connected account active', { identifier, accountId: account.id });
      return { connected: true };
    }
    const linkResp = await (sk as any).actions.getAuthorizationLink({
      connectionName: GMAIL_CONNECTION,
      identifier,
    });
    return { connected: false, authLink: linkResp.link };
  } catch (err) {
    logger.error('Failed to get connected account', { err });
    throw err;
  }
}

export async function executeGmailTool(
  toolName: string,
  toolInput: Record<string, unknown>,
  identifier: string
): Promise<unknown> {
  const sk = getScalekitClient();
  const result = await (sk as any).actions.executeTool({
    toolName,
    identifier,
    toolInput,
  });
  return result.data ?? result;
}

/**
 * Execute a Scalekit tool for a given identifier.
 * Argument order: (identifier, toolName, toolInput) — matches gmail.ts call sites.
 */
export async function executeScalekitTool(
  identifier: string | undefined,
  toolName: string,
  toolInput: Record<string, unknown>
): Promise<unknown> {
  return executeGmailTool(toolName, toolInput, identifier ?? '');
}
