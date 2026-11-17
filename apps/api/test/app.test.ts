import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";

let app: FastifyInstance | undefined;

afterEach(async () => {
  if (app) {
    await app.close();
    app = undefined;
  }
});

test("GET /api/health reports that the API process is alive", async () => {
  app = buildApp({ logger: false });
  const response = await app.inject({ method: "GET", url: "/api/health" });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { status: "ok", service: "moshpit-api" });
});

test("authenticated endpoints reject missing guest sessions", async () => {
  app = buildApp({ logger: false });
  const response = await app.inject({ method: "GET", url: "/api/setlists" });
  assert.equal(response.statusCode, 401);
  assert.equal(response.json().error.code, "unauthorized");
});
