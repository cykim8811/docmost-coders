/* SPDX-License-Identifier: AGPL-3.0-only
 * Run against an isolated, disposable DB behind a simulated Core identity proxy.
 */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { resolve } from "node:path";
const serverRequire = createRequire(resolve("apps/server/package.json"));
const rootRequire = createRequire(resolve("package.json"));
const WebSocket = serverRequire("ws");
const { HocuspocusProvider, HocuspocusProviderWebsocket } = rootRequire(
  "@hocuspocus/provider",
);
const Y = rootRequire("yjs");
const base = process.env.TEST_APP_URL || "http://docmost-coders-test-app:8080";
const owner = process.env.TEST_OWNER_ID || "test-owner";
const resource = process.env.TEST_RESOURCE_ID || "test-resource";
const member = "test-member";
const headers = (user) => ({
  "Coders-User-Id": user,
  "Coders-Resource-Id": resource,
  "Coders-Resource-Role": user === owner ? "owner" : "member",
});

for (let attempt = 0; ; attempt++) {
  try {
    if ((await fetch(base + "/api/health")).ok) break;
  } catch {}
  if (attempt >= 30) throw new Error("The test app did not become healthy");
  await new Promise((resolve) => setTimeout(resolve, 500));
}

async function raw(
  target,
  {
    user = owner,
    method = "POST",
    body,
    extraHeaders = {},
    expected = 200,
  } = {},
) {
  const response = await fetch(
    `${base}/bridge?target=${encodeURIComponent(target)}`,
    {
      method,
      headers: {
        ...(user ? headers(user) : {}),
        ...(body === undefined || body instanceof FormData
          ? {}
          : { "Content-Type": "application/json" }),
        ...extraHeaders,
      },
      body:
        body === undefined
          ? undefined
          : body instanceof FormData
            ? body
            : JSON.stringify(body),
    },
  );
  assert.equal(
    response.status,
    expected,
    `${target}: ${response.status} ${response.status === expected ? "" : await response.text()}`,
  );
  return response;
}
const call = async (path, options) =>
  (await (await raw("/api" + path, options)).json()).data;

await raw("/api/users/me", { user: null, expected: 401 });
await raw("/api/auth/setup", { body: {}, expected: 403 });
await raw("/api/auth/login", { body: {}, expected: 403 });
await raw("/api/users/me", {
  extraHeaders: { "Coders-Resource-Role": "admin" },
  expected: 401,
});
// Set TEST_FRESH_DB=true when verifying an untouched database.
if (process.env.TEST_FRESH_DB === "true") {
  const denied = await raw("/api/users/me", { user: member, expected: 403 });
  assert.equal((await denied.json()).code, "coders_owner_setup_required");
}
const admin = await call("/users/me");
assert.equal(admin.user.role, "owner");
const first = await call("/users/me", { user: member });
assert.equal(first.user.role, "member");
assert.equal(first.workspace.id, admin.workspace.id);
assert.notEqual(first.user.id, admin.user.id);
await raw("/api/users/me", {
  extraHeaders: { "Coders-Resource-Id": "wrong-resource" },
  expected: 403,
});
await raw("/api/workspace/members/change-role", {
  user: member,
  body: { userId: first.user.id, role: "admin" },
  expected: 403,
});
console.log(
  "PASS identity, initial owner, resource isolation, admin authorization",
);

if (process.argv.includes("--restore")) {
  const { readFile } = await import("node:fs/promises");
  const state = JSON.parse(await readFile(process.env.TEST_STATE_FILE, "utf8"));
  const saved = await call("/pages/info", {
    user: member,
    body: { pageId: state.pageId },
  });
  assert.ok(JSON.stringify(saved.content).includes(String(state.stamp)));
  const download = await raw(`/api/files/${state.fileId}/smoke.txt`, {
    method: "GET",
    user: member,
  });
  assert.equal(await download.text(), "persistent attachment ✓");
  console.log("PASS document and attachment survive process restart");
  process.exit(0);
}

const stamp = Date.now();
const page = await call("/pages/create", {
  body: {
    title: `Coders smoke ${stamp}`,
    spaceId: admin.workspace.defaultSpaceId,
  },
});
assert.ok(page.id);
const viewed = await call("/pages/info", {
  user: member,
  body: { pageId: page.id },
});
assert.equal(viewed.id, page.id);
const privateSpace = await call("/spaces/create", {
  body: { name: "Private smoke", slug: `private-${stamp}` },
});
const privatePage = await call("/pages/create", {
  body: { title: "Private page", spaceId: privateSpace.id },
});
await raw("/api/pages/info", {
  user: member,
  body: { pageId: privatePage.id },
  expected: 404,
});
await call("/spaces/members/add", {
  body: {
    spaceId: privateSpace.id,
    userIds: [first.user.id],
    groupIds: [],
    role: "reader",
  },
});
const readOnly = await call("/pages/info", {
  user: member,
  body: { pageId: privatePage.id },
});
assert.equal(readOnly.permissions.canEdit, false);
await raw("/api/pages/update", {
  user: member,
  body: { pageId: privatePage.id, title: "Forbidden edit" },
  expected: 403,
});
await call("/spaces/members/change-role", {
  body: { spaceId: privateSpace.id, userId: first.user.id, role: "writer" },
});
await call("/pages/update", {
  user: member,
  body: { pageId: privatePage.id, title: "Allowed writer edit" },
});
await call("/spaces/members/change-role", {
  body: { spaceId: privateSpace.id, userId: first.user.id, role: "reader" },
});
await raw("/api/pages/update", {
  user: member,
  body: { pageId: privatePage.id, title: "Revoked writer edit" },
  expected: 403,
});
await call("/spaces/members/remove", {
  body: { spaceId: privateSpace.id, userId: first.user.id },
});
await raw("/api/pages/info", {
  user: member,
  body: { pageId: privatePage.id },
  expected: 404,
});
console.log("PASS private-space denial and reader write protection");

const form = new FormData();
form.append("pageId", page.id);
form.append(
  "file",
  new Blob(["persistent attachment ✓"], { type: "text/plain" }),
  "smoke.txt",
);
const uploaded = await (await raw("/api/files/upload", { body: form })).json();
const file = uploaded.data || uploaded;
assert.ok(file.id, JSON.stringify(uploaded));
const download = await raw(`/api/files/${file.id}/smoke.txt`, {
  method: "GET",
  user: member,
});
assert.equal(await download.text(), "persistent attachment ✓");
const range = await raw(`/api/files/${file.id}/smoke.txt`, {
  method: "GET",
  extraHeaders: { Range: "bytes=0-9" },
  expected: 206,
});
assert.equal(await range.text(), "persistent");
console.log(
  "PASS document creation, shared read access, DB attachments, range download",
);

async function connect(user, documentName = `page.${page.id}`) {
  class AuthenticatedSocket extends WebSocket {
    constructor(url, protocols) {
      super(url, protocols, { headers: headers(user) });
    }
  }
  const socket = new HocuspocusProviderWebsocket({
    url: base.replace(/^http/, "ws") + "/collab",
    WebSocketPolyfill: AuthenticatedSocket,
  });
  const document = new Y.Doc();
  const provider = new HocuspocusProvider({
    websocketProvider: socket,
    name: documentName,
    document,
    token: "core-identity",
  });
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error("Collaboration sync timed out")),
      15000,
    );
    provider.on("synced", () => {
      clearTimeout(timeout);
      resolve();
    });
    provider.on("authenticationFailed", ({ reason }) => {
      clearTimeout(timeout);
      reject(new Error(reason));
    });
    provider.attach();
  });
  return {
    document,
    provider,
    socket,
    close() {
      provider.destroy();
      socket.destroy();
      document.destroy();
    },
  };
}
const a = await connect(owner);
const b = await connect(member);
const block = new Y.XmlElement("paragraph");
const text = new Y.XmlText();
text.insert(0, `Collaborative document ${stamp}`);
block.insert(0, [text]);
a.document.getXmlFragment("default").push([block]);
const until = Date.now() + 10000;
while (
  !b.document.getXmlFragment("default").toString().includes(String(stamp))
) {
  if (Date.now() > until)
    throw new Error("Collaboration did not reach the other user");
  await new Promise((resolve) => setTimeout(resolve, 50));
}
a.close();
b.close();
// Test the same recovery path used after Core's 300-second connection rotation.
const c = await connect(member);
assert.ok(
  c.document.getXmlFragment("default").toString().includes(String(stamp)),
);
c.close();
await new Promise((resolve) => setTimeout(resolve, 3000));
const persisted = await call("/pages/info", {
  body: { pageId: page.id },
  user: member,
});
assert.ok(JSON.stringify(persisted.content).includes(String(stamp)));
console.log(
  "PASS two-user editing, disconnect/reconnect sync, document persistence",
);

if (process.env.TEST_STATE_FILE) {
  const { writeFile } = await import("node:fs/promises");
  await writeFile(
    process.env.TEST_STATE_FILE,
    JSON.stringify({ pageId: page.id, fileId: file.id, stamp }),
  );
}
console.log("All Coders smoke checks passed.");
process.exit(0);
