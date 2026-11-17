import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Pool } from "pg";

export async function runMigrations(pool: Pool, migrationsDirectory?: string): Promise<string[]> {
  const candidates = migrationsDirectory
    ? [migrationsDirectory]
    : [resolve(process.cwd(), "migrations"), resolve(process.cwd(), "apps/api/migrations")];
  let directory: string | undefined;
  for (const candidate of candidates) {
    try {
      await readdir(candidate);
      directory = candidate;
      break;
    } catch {
      // Try the next supported launch location (workspace package or monorepo root).
    }
  }
  if (!directory) throw new Error(`Could not locate SQL migrations. Checked: ${candidates.join(", ")}`);

  await pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  const names = (await readdir(directory)).filter((name) => name.endsWith(".sql")).sort();
  const applied: string[] = [];

  for (const name of names) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const exists = await client.query("SELECT 1 FROM schema_migrations WHERE name = $1", [name]);
      if (exists.rowCount) {
        await client.query("COMMIT");
        continue;
      }
      const sql = await readFile(resolve(directory, name), "utf8");
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations(name) VALUES ($1)", [name]);
      await client.query("COMMIT");
      applied.push(name);
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }
  return applied;
}
