import pg from "pg";
import { env } from "../../config/env.js";

const { Pool } = pg;

export const databasePool = new Pool({
  connectionString: env.databaseUrl,
  max: 10,
  connectionTimeoutMillis: 3_000
});

export async function checkDatabaseConnection(): Promise<void> {
  await databasePool.query("select 1");
}

export async function closeDatabaseConnection(): Promise<void> {
  await databasePool.end();
}
