import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: ['./src/db/schema.ts', '../web/auth-schema.ts'],
  out: './migrations',
  dialect: 'postgresql',
  tablesFilter: ['mkgt_*'],
  migrations: {
    table: 'mkgt_drizzle_migrations',
    schema: 'public',
  },
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgresql://markgit:markgit@localhost:5432/markgit',
  },
});
