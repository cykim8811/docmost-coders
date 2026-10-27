// @vitest-environment node
import { describe, expect, it } from "vitest";
import { getPendingRecovery, waitForCodersRetry } from "./coders-recovery";

describe("explicit recovery of an existing Core request", () => {
  it("cancels an aborted request without leaving a recovery prompt behind", async () => {
    const controller = new AbortController();
    const pending = waitForCodersRetry({
      kind: "unknown",
      signal: controller.signal,
    });
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    expect(getPendingRecovery()).toHaveLength(0);
  });
  it("lets concurrent requests resume independently", async () => {
    const a = waitForCodersRetry({
      kind: "preparing",
      signal: new AbortController().signal,
    });
    const b = waitForCodersRetry({
      kind: "account",
      signal: new AbortController().signal,
    });
    const [first, second] = getPendingRecovery();
    first.proceed();
    await expect(a).resolves.toBeUndefined();
    expect(getPendingRecovery()).toEqual([second]);
    second.cancel();
    await expect(b).rejects.toMatchObject({ name: "AbortError" });
    expect(getPendingRecovery()).toHaveLength(0);
  });
});
