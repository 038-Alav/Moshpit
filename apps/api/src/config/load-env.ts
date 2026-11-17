import { config } from "dotenv";
import { resolve } from "node:path";

// pnpm runs filtered workspace scripts from apps/api. Resolve the shared
// monorepo .env from that package directory. Production injects environment
// variables through systemd or the container runtime, so it does not load a file.
if (process.env.NODE_ENV !== "production") {
  const defaultEnvPath = resolve(process.cwd(), "../../.env");
  config({
    path: process.env.MOSHPIT_ENV_FILE ?? defaultEnvPath
  });
}
