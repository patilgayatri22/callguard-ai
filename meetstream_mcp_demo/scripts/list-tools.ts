import { Scalekit } from '@scalekit-sdk/node';
import dotenv from 'dotenv';

dotenv.config();

const scalekit = new Scalekit(
  process.env.SK_ENV_URL!,
  process.env.SK_CLIENT_ID!,
  process.env.SK_CLIENT_SECRET!
);

async function main() {
  console.log('Listing all available tools...\n');

  const result = await scalekit.tools.listTools({ pageSize: 100 });

  console.log('Tools found:', result.tools?.length || 0);
  console.log('---');

  for (const tool of result.tools || []) {
    console.log(`  Name: ${tool.name}`);
    console.log(`  Description: ${tool.description}`);
    console.log('---');
  }

  // Also list tools scoped to the user
  console.log('\nListing available tools for user usr_118421139654443783...\n');

  const available = await scalekit.tools.listAvailableTools('usr_118421139654443783', { pageSize: 100 });

  console.log('Available tools:', available.tools?.length || 0);
  for (const tool of available.tools || []) {
    const t = tool as any;
    console.log(`  ${t.definition?.name || t.id} | ${t.definition?.annotations?.title} | provider: ${t.provider} | readOnly: ${t.definition?.annotations?.read_only_hint}`);
  }
}

main().catch(console.error);
