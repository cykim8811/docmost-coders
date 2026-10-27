/* SPDX-License-Identifier: AGPL-3.0-only
 * TEST ONLY: simulates Core's verified identity and endpoint mapping locally.
 * The test cookie is deliberately not an authentication mechanism.
 * Publish this proxy only on host loopback. It is never part of the app image.
 */
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { createRequire } = require("node:module");
const mime = createRequire(path.resolve("apps/server/package.json"))(
  "mime-types",
);
const upstream = new URL(
  process.env.TEST_APP_URL || "http://docmost-coders-test-app:8080",
);
const root = path.resolve(process.env.TEST_FRONTEND || "apps/client/dist");

function requestOptions(req) {
  const selected = /(?:^|;\s*)coders-test-user=([a-zA-Z0-9_-]+)/.exec(
    req.headers.cookie || "",
  );
  return {
    hostname: upstream.hostname,
    port: upstream.port,
    method: req.method,
    path: req.url.replace(/^\/api\//, "/"),
    headers: {
      ...req.headers,
      host: upstream.host,
      "coders-user-id": selected?.[1] || "test-owner",
      "coders-resource-role":
        !selected || selected[1] === "test-owner" ? "owner" : "member",
      "coders-resource-id": process.env.TEST_RESOURCE_ID || "test-resource",
    },
  };
}
const server = http.createServer((req, res) => {
  if (req.url === "/_coders/sdk.js" && process.env.TEST_SDK_SOURCE) {
    // Read Core's local SDK for browser tests without copying it into this repo.
    const source = fs.readFileSync(process.env.TEST_SDK_SOURCE, "utf8");
    res.setHeader("Content-Type", "text/javascript");
    res.end(
      source.replace(
        "__CODERS_ACCOUNT_ORIGIN__",
        JSON.stringify("http://" + req.headers.host),
      ),
    );
    return;
  }
  if (req.url.startsWith("/api/")) {
    const outgoing = http.request(requestOptions(req), (incoming) => {
      res.writeHead(incoming.statusCode, incoming.headers);
      incoming.pipe(res);
    });
    outgoing.on("error", () => {
      res.writeHead(502);
      res.end("Test app unavailable");
    });
    req.pipe(outgoing);
    return;
  }
  const url = new URL(req.url, "http://localhost");
  let file;
  try {
    file = path.resolve(
      root,
      "." +
        decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname),
    );
  } catch {
    res.writeHead(400);
    res.end();
    return;
  }
  if (!file.startsWith(root + path.sep)) {
    res.writeHead(403);
    res.end();
    return;
  }
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404);
    res.end();
    return;
  }
  res.setHeader(
    "Content-Type",
    mime.lookup(file) || "application/octet-stream",
  );
  if (file.endsWith('index.html')) res.setHeader('Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-src 'none'; base-uri 'none'; form-action 'self'; object-src 'none'; worker-src 'none'; manifest-src 'none'");
  fs.createReadStream(file).pipe(res);
});
server.on("upgrade", (req, socket, head) => {
  if (!req.url.startsWith("/api/")) {
    socket.destroy();
    return;
  }
  const outgoing = http.request(requestOptions(req));
  outgoing.on("upgrade", (response, remote, remoteHead) => {
    socket.write(
      `HTTP/1.1 ${response.statusCode} Switching Protocols\r\n` +
        Object.entries(response.headers)
          .map(([key, value]) => `${key}: ${value}\r\n`)
          .join("") +
        "\r\n",
    );
    if (remoteHead.length) socket.write(remoteHead);
    if (head.length) remote.write(head);
    remote.pipe(socket);
    socket.pipe(remote);
    remote.on("error", () => socket.destroy());
    socket.on("error", () => remote.destroy());
  });
  outgoing.on("response", (response) => {
    socket.end(`HTTP/1.1 ${response.statusCode} Rejected\r\n\r\n`);
  });
  outgoing.on("error", () => socket.destroy());
  outgoing.end();
});
server.listen(8080, "0.0.0.0", () =>
  console.log("Local Core simulator listening on :8080"),
);
