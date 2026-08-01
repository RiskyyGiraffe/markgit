import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

const productIds = process.argv.slice(2);
if (productIds.length === 0) throw new Error('Pass one or more product IDs');

const config = JSON.parse(await readFile(join(homedir(), '.config', 'markgit', 'config.json'), 'utf8'));
const envFile = execFileSync('ssh', ['penguin', 'sudo cat /etc/markgit/demo-provider.env'], {
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'inherit'],
});
const token = envFile.match(/^MARKGIT_PROVIDER_TOKEN=(.+)$/m)?.[1]?.trim();
if (!token) throw new Error('Penguin provider token is missing');

for (const productId of productIds) {
  const response = await fetch(`${String(config.apiUrl).replace(/\/$/, '')}/v1/products/${productId}/credentials/provider`, {
    method: 'PUT',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      authType: 'bearer',
      location: 'header',
      name: 'Authorization',
      value: token,
    }),
  });
  if (!response.ok) throw new Error(`Credential setup failed for ${productId}: ${response.status} ${await response.text()}`);
  console.log(`Configured encrypted provider credential for ${productId}`);
}
