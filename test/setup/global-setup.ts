import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { parse } from 'dotenv';
import { Client } from 'pg';

/**
 * Runs once before the e2e suite: applies committed migrations, empties every table and seeds
 * reference data. Refuses to touch any database whose name does not end in `_test`.
 */
export default async function globalSetup(): Promise<void> {
  const root = join(__dirname, '..', '..');
  const testEnv = parse(readFileSync(join(root, '.env.test')));
  const databaseUrl = testEnv.DATABASE_URL ?? '';
  const databaseName = new URL(databaseUrl).pathname.replace('/', '');
  if (!databaseName.endsWith('_test')) {
    throw new Error(`Refusing to reset non-test database "${databaseName}"`);
  }

  const env = { ...process.env, ...testEnv, NODE_ENV: 'test' };
  execSync('npx prisma migrate deploy', { cwd: root, env, stdio: 'ignore' });
  await truncateAllTables(databaseUrl);
  execSync('npx tsx prisma/seed.ts', { cwd: root, env, stdio: 'ignore' });
}

async function truncateAllTables(databaseUrl: string): Promise<void> {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const { rows } = await client.query<{ tablename: string }>(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`,
    );
    if (rows.length === 0) return;
    const tables = rows.map((row) => `"public"."${row.tablename}"`).join(', ');
    await client.query(`TRUNCATE TABLE ${tables} RESTART IDENTITY CASCADE`);
  } finally {
    await client.end();
  }
}
