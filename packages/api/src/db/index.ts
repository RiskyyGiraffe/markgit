import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';

const connectionString = process.env.DATABASE_URL ?? 'postgresql://markgit:markgit@localhost:5432/markgit';

// Supabase's transaction pooler does not support prepared statements.
const client = postgres(connectionString, { prepare: false });
export const db = drizzle(client, { schema });
