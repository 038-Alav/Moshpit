import "../../config/load-env.js";
import { databasePool, closeDatabaseConnection } from "./database.js";
import { runMigrations } from "./migrations.js";

try {
  const applied = await runMigrations(databasePool);
  console.info(applied.length ? `Applied migrations: ${applied.join(", ")}` : "Database schema is up to date.");
} finally {
  await closeDatabaseConnection();
}
