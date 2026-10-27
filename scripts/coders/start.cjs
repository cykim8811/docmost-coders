/* SPDX-License-Identifier: AGPL-3.0-only */
const { createRequire } = require("node:module");
const { randomBytes } = require("node:crypto");
const { resolve } = require("node:path");
const serverRequire = createRequire(resolve("apps/server/package.json"));
const postgres = serverRequire("postgres");

async function start() {
  if (!process.env.DATABASE_URL || !process.env.REDIS_URL) {
    throw new Error("Enable the resource PostgreSQL and Redis services first");
  }
  const db = postgres(process.env.DATABASE_URL, {
    max: 1,
    connect_timeout: 15,
  });
  try {
    await db`CREATE TABLE IF NOT EXISTS coders_runtime (
      singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
      app_secret text NOT NULL
    )`;
    const candidate = randomBytes(48).toString("hex");
    await db`INSERT INTO coders_runtime (singleton, app_secret) VALUES (true, ${candidate}) ON CONFLICT DO NOTHING`;
    const [config] =
      await db`SELECT app_secret FROM coders_runtime WHERE singleton = true`;
    process.env.APP_SECRET = config.app_secret;
  } finally {
    await db.end({ timeout: 5 });
  }
  // No secrets are written to the image or filesystem. One resource owns this DB.
  process.chdir(resolve("apps/server"));
  require(resolve("dist/main.js"));
}

start().catch((error) => {
  // Do not print connection URLs or credential-bearing error objects.
  console.error("Coders startup failed:", error.code || error.name);
  process.exit(1);
});
