/* SPDX-License-Identifier: AGPL-3.0-only
 * Run only against a disposable Redis with Core's ACL and resource limits.
 */
const assert = require("node:assert/strict");
const { createRequire } = require("node:module");
const { resolve } = require("node:path");
const serverRequire = createRequire(resolve("apps/server/package.json"));
const { Queue, Worker } = serverRequire("bullmq");
const Redis = serverRequire("ioredis");
const {
  QueueConnection,
} = require("../../apps/server/dist/integrations/queue/queue-connection.module");

(async () => {
  assert.equal(process.env.CODERS_MODE, "true");
  assert.ok(process.env.REDIS_URL);
  const shared = new QueueConnection({
    getRedisUrl: () => process.env.REDIS_URL,
  });
  const observer = new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: 0,
  });
  const queues = [];
  const workers = [];
  const errors = [];
  const timeout = setTimeout(() => {
    console.error("Redis smoke timed out");
    process.exit(1);
  }, 30_000);
  try {
    const memory = await observer.info("memory");
    assert.match(memory, /maxmemory:67108864\r?\n/);
    assert.match(memory, /maxmemory_policy:noeviction/);
    await assert.rejects(observer.config("GET", "maxclients"), /NOPERM/);
    const baseline = Number(
      (await observer.info("clients")).match(/connected_clients:(\d+)/)[1],
    );
    for (let i = 0; i < 13; i++) {
      const name = `coders-redis-smoke-${process.pid}-${i}`;
      const queue = new Queue(name, { connection: shared.getConnection() });
      queues.push(queue);
      if (i < 7) {
        const worker = new Worker(name, async (job) => job.data.value + 1, {
          connection: shared.getConnection(),
        });
        worker.on("error", (error) => errors.push(error));
        workers.push(worker);
      }
    }
    await Promise.all(
      [...queues, ...workers].map((item) => item.waitUntilReady()),
    );
    const info = await observer.info("clients");
    assert.match(info, /maxclients:32\r?\n/);
    const clients = Number(info.match(/connected_clients:(\d+)/)[1]);
    assert.ok(
      clients - baseline <= 8 && clients <= 32,
      `Shared queues exceeded connection budget: ${clients}`,
    );
    for (let i = 0; i < workers.length; i++) {
      const completed = new Promise((resolve, reject) => {
        workers[i].once("completed", (_job, result) => resolve(result));
        workers[i].once("failed", (_job, error) => reject(error));
      });
      await queues[i].add(
        "roundtrip",
        { value: i },
        { removeOnComplete: true, removeOnFail: true },
      );
      assert.equal(await completed, i + 1);
    }
    assert.deepEqual(errors, []);
    console.log(
      `PASS Core Redis ACL, 64MiB/noeviction, 13 queues + 7 workers: ${clients} connections including observer, job roundtrips`,
    );
  } finally {
    await Promise.all(workers.map((worker) => worker.close()));
    await Promise.all(queues.map((queue) => queue.close()));
    shared.onApplicationShutdown();
    observer.disconnect();
    clearTimeout(timeout);
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
