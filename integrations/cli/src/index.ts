#!/usr/bin/env node
import { Command } from 'commander';
import { FileTokenStore, ShipClient } from '@ship/sdk';
import { homedir } from 'node:os';
import { join } from 'node:path';

const program = new Command();

function baseUrl(): string {
  return process.env.SHIP_API_URL ?? 'http://localhost:3001';
}

function clientId(): string {
  const id = process.env.SHIP_CLIENT_ID;
  if (!id) {
    throw new Error('Set SHIP_CLIENT_ID to your OAuth app client_id');
  }
  return id;
}

function tokenStore(): FileTokenStore {
  return new FileTokenStore(join(homedir(), '.ship', 'tokens.json'));
}

async function withClient(run: (client: ShipClient) => Promise<void>): Promise<void> {
  const store = tokenStore();
  const token = await store.getAccessToken();
  if (!token) {
    throw new Error('Not logged in. Run: ship login');
  }
  const client = new ShipClient({ baseUrl: baseUrl(), token });
  await run(client);
}

program.name('ship').description('Ship platform CLI');

program
  .command('login')
  .description('Device authorization login')
  .action(async () => {
    const client = await ShipClient.deviceLogin({
      baseUrl: baseUrl(),
      clientId: clientId(),
      scopes: ['documents:read', 'documents:write', 'webhooks:manage'],
      tokenStore: tokenStore(),
      onUserCode: (code, verifyUrl) => {
        console.log(`User code: ${code}`);
        console.log(`Verify at: ${verifyUrl}`);
        console.log('Enter the user code in the browser while logged into Ship.');
      },
    });
    const me = await client.me();
    console.log(`Logged in as ${me.email} (${me.client_id})`);
  });

const docs = program.command('docs').description('Document commands');

docs
  .command('ls')
  .description('List documents')
  .action(async () => {
    await withClient(async (client) => {
      const page = await client.documents.list({ limit: 20 });
      for (const doc of page.data) {
        console.log(`${doc.id}\t${doc.document_type}\t${doc.title}`);
      }
    });
  });

docs
  .command('get <id>')
  .description('Get document by id')
  .action(async (id: string) => {
    await withClient(async (client) => {
      const doc = await client.documents.getById(id);
      console.log(JSON.stringify(doc, null, 2));
    });
  });

docs
  .command('create')
  .description('Create a document')
  .requiredOption('--title <title>', 'Document title')
  .action(async (opts: { title: string }) => {
    await withClient(async (client) => {
      const doc = await client.documents.create({ title: opts.title });
      console.log(JSON.stringify(doc, null, 2));
    });
  });

const webhooks = program.command('webhooks').description('Webhook commands');
webhooks
  .command('tail')
  .description('Poll recent webhook deliveries')
  .action(async () => {
    await withClient(async (client) => {
      const deliveries = await client.webhooks.listDeliveries();
      for (const row of deliveries.data) {
        console.log(JSON.stringify(row));
      }
    });
  });

program.parseAsync(process.argv).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
