/* SPDX-License-Identifier: AGPL-3.0-only */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

for (const dir of ["apps/client/src/ee", "apps/server/src/ee", "packages/ee"]) {
  assert.ok(
    !fs.existsSync(dir),
    `Enterprise sources must not be included: ${dir}`,
  );
}
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(file);
    else if (/\.[jt]sx?$/.test(file)) {
      const source = fs.readFileSync(file, "utf8");
      assert.ok(
        !/(?:from\s*|import\s*\()\s*['"][^'"]*\bee\//.test(source),
        `Enterprise client import: ${file}`,
      );
    }
  }
}
walk("apps/client/src");
const manifest = JSON.parse(fs.readFileSync("coders.json", "utf8"));
assert.equal(manifest.version, 2);
assert.deepEqual(manifest.permissions, ["frontend"]);
assert.ok(
  fs.existsSync(path.join(manifest.frontend.directory, "index.html")),
  "Build and commit the static frontend before publishing",
);
console.log("PASS community-only source tree and Coders manifest");
