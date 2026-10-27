/* SPDX-License-Identifier: AGPL-3.0-only */
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const result = spawnSync("pnpm", ["--filter", "client", "build"], {
  stdio: "inherit",
  env: { ...process.env, VITE_CODERS: "true" },
});
if (result.status !== 0) process.exit(result.status || 1);
const destination = path.resolve("coders/public");
fs.rmSync(destination, { recursive: true, force: true });
fs.cpSync(path.resolve("apps/client/dist"), destination, { recursive: true });
console.log("Coders frontend prepared:", destination);
