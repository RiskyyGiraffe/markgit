import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

const connectionString = process.env.DATABASE_URL!;
// Supabase's transaction pooler does not support prepared statements.
const client = postgres(connectionString, { prepare: false });
export const db = drizzle(client);
