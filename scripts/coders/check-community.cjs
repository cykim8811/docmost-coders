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
const allowedMethods = new Set(["GET", "POST", "PUT", "PATCH", "DELETE"]);
for (const endpoint of Object.values(manifest.endpoints)) {
  assert.ok(endpoint.methods.length <= 5);
  assert.ok(endpoint.methods.every((method) => allowedMethods.has(method)));
}
let files = 0;
let bytes = 0;
function measure(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    assert.ok(!entry.isSymbolicLink(), `Static symlink is forbidden: ${file}`);
    if (entry.isDirectory()) measure(file);
    else { files++; bytes += fs.statSync(file).size; }
  }
}
measure(manifest.frontend.directory);
assert.ok(files <= 256, `Core frontend file limit exceeded: ${files}/256`);
assert.ok(bytes <= 10_485_760, `Core frontend size limit exceeded: ${bytes}/10485760`);
console.log(`PASS Core frontend limits: ${files} files, ${bytes} bytes`);

const index = fs.readFileSync(path.join(manifest.frontend.directory, "index.html"), "utf8");
assert.ok(!/<link\s+rel=["']manifest["']/.test(index), "Core forbids web manifests");
for (const file of fs.readdirSync(path.join(manifest.frontend.directory, "assets"))) {
  if (file.endsWith(".css")) {
    assert.ok(!/data:font\//.test(fs.readFileSync(path.join(manifest.frontend.directory, "assets", file), "utf8")), "Core requires same-origin font files");
  }
}
