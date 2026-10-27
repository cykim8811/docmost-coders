/* SPDX-License-Identifier: AGPL-3.0-only — optional Playwright browser verification. */
const assert = require("node:assert/strict");
const { chromium } = require("../../.coders-tools/node_modules/playwright");
const base = process.env.TEST_UI_URL || "http://127.0.0.1:33080";
const output = process.env.TEST_SCREENSHOT || "/app/.coders-tools/browser.png";

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox"],
  });
  try {
    const owner = await browser.newContext();
    const member = await browser.newContext();
    await member.addCookies([
      { name: "coders-test-user", value: "test-member", url: base },
    ]);
    const a = await owner.newPage();
    const b = await member.newPage();
    const errors = [];
    const recoveryKeys = [];
    let injectedAccountResponse = false;
    await a.route("**/api/bridge?**", async (route) => {
      if (
        new URL(route.request().url()).searchParams.get("target") !==
        "/api/users/me"
      )
        return route.continue();
      recoveryKeys.push(route.request().headers()["idempotency-key"]);
      if (!injectedAccountResponse) {
        injectedAccountResponse = true;
        return route.fulfill({
          status: 402,
          contentType: "application/json",
          body: JSON.stringify({
            error: { code: "insufficient_funds" },
            account_action_url: base + "/account/projects/test/popup",
          }),
        });
      }
      return route.continue();
    });
    let eventConnections = 0;
    for (const page of [a, b]) {
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("websocket", (socket) => {
        if (socket.url().includes("/api/events"))
          socket.on("framereceived", ({ payload }) => {
            if (String(payload).startsWith("40")) eventConnections++;
          });
      });
    }
    await a.goto(base + "/#/home");
    await a.getByRole("button", { name: "같은 요청 확인" }).click();
    await a.getByRole("link", { name: "Coders 문서", exact: true }).waitFor();
    assert.ok(recoveryKeys[0], "SDK must assign an idempotency key");
    assert.equal(
      recoveryKeys[0],
      recoveryKeys[1],
      "Account recovery must reuse the same request key",
    );
    console.log('PASS browser: Core SDK 402 recovery preserves the original idempotency key');
    await a.unroute("**/api/bridge?**");
    const call = async (target, body) => {
      const response = await owner.request.post(
        `${base}/api/bridge?target=${encodeURIComponent("/api" + target)}`,
        { data: body },
      );
      assert.ok(
        response.ok(),
        `${target}: ${response.status()} ${await response.text()}`,
      );
      return (await response.json()).data;
    };
    let me;
    for (let attempt = 0; ; attempt++) {
      try {
        me = await call("/users/me");
        break;
      } catch (error) {
        if (attempt >= 30) throw error;
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
    const page = await call("/pages/create", {
      title: "브라우저 협업 검증",
      spaceId: me.workspace.defaultSpaceId,
    });
    const url = `${base}/#/s/general/p/test-${page.slugId}`;
    await Promise.all([a.goto(url), b.goto(url)]);
    const editA = a.locator('[contenteditable="true"][aria-label]').last();
    const editB = b.locator('[contenteditable="true"][aria-label]').last();
    await Promise.all([
      editA.waitFor({ state: "visible" }),
      editB.waitFor({ state: "visible" }),
    ]);
    const textA = `Owner collaboration ${Date.now()}`;
    await editA.click();
    await a.keyboard.type(textA);
    await b.getByText(textA, { exact: false }).last().waitFor();
    await editB.click();
    await b.keyboard.press("End");
    await b.keyboard.type(" + member edit");
    await a.getByText("member edit", { exact: false }).last().waitFor();
    await a.waitForTimeout(2500);
    await a.reload();
    await a.getByText("member edit", { exact: false }).last().waitFor();
    const source = a.getByRole("link", { name: /소스 코드/ }).first();
    assert.ok(await source.isVisible());
    assert.ok(
      eventConnections >= 2,
      "Notification socket must authenticate for both users",
    );
    await a.screenshot({ path: output, fullPage: true });
    assert.deepEqual(errors, [], "Browser runtime exceptions");
    console.log(
      "PASS browser: Core identity, two-user editing, reload persistence, source link",
    );
    console.log("Screenshot:", output);
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
