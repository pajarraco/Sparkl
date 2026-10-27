import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import "../env.js";
import * as schema from "./schema.js";

function requireDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return url;
}

// Credentials come from the environment only — never hardcoded.
export const connection = postgres(requireDatabaseUrl());
export const db = drizzle(connection, { schema });

export type Db = typeof db;

export async function closeDb(): Promise<void> {
  await connection.end();
}
