import { neon, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema/index";

neonConfig.fetchConnectionCache = true;

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL is not set. Copy .env.example to .env at the repo root and set DATABASE_URL to a Neon Postgres connection string.",
  );
}

const sql = neon(databaseUrl);

export const db = drizzle(sql, { schema, logger: process.env.LOG_LEVEL === "debug" });

export type Database = typeof db;
export { schema };
