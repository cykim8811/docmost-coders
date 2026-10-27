// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import {
  createCodersFetch,
  type CodersClient,
  type CodersResult,
} from "./coders-sdk";

function result(
  response: Response,
  extra: Partial<CodersResult> = {},
): CodersResult {
  return {
    response,
    status: response.status,
    ok: response.ok,
    data: null,
    requiresAccountAction: false,
    accountActionUrl: null,
    retry: vi.fn(),
    ...extra,
  };
}
function setup(request: CodersClient["request"]) {
  const sdk = { request: vi.fn(request), openAccountWindow: vi.fn() };
  const recover = vi.fn(async () => {});
  return { sdk, recover, fetch: createCodersFetch(async () => sdk, recover) };
}

describe("Axios transport through the Coders browser SDK", () => {
  it("preserves binary responses and HTTP headers", async () => {
    const expected = new Uint8Array([0, 1, 254, 255]);
    const state = setup(async () =>
      result(
        new Response(expected, {
          headers: {
            "Content-Type": "application/octet-stream",
            "X-File": "yes",
          },
        }),
      ),
    );
    const response = await state.fetch(
      "https://app.example/api/bridge?target=/api/files/1/test",
    );
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(expected);
    expect(response.headers.get("X-File")).toBe("yes");
  });
  it("preserves multipart data and its browser-generated boundary", async () => {
    const form = new FormData();
    form.append("pageId", "page-1");
    form.append("file", new Blob(["attachment"]), "test.txt");
    const state = setup(async (_path, options) => {
      const request = new Request("https://app.example/api/bridge", options);
      const received = await request.formData();
      expect(received.get("pageId")).toBe("page-1");
      expect(await (received.get("file") as File).text()).toBe("attachment");
      return result(
        new Response("{}", { headers: { "Content-Type": "application/json" } }),
      );
    });
    await state.fetch(
      new Request("https://app.example/api/bridge", {
        method: "POST",
        body: form,
      }),
    );
  });
  it("uses result.retry after account confirmation rather than issuing a new request", async () => {
    const retry = vi.fn(async () => result(new Response("saved")));
    const state = setup(async () =>
      result(new Response("{}", { status: 402 }), {
        requiresAccountAction: true,
        accountActionUrl: "https://core.example/account",
        retry,
      }),
    );
    expect(
      await (await state.fetch("https://app.example/api/bridge")).text(),
    ).toBe("saved");
    expect(state.sdk.request).toHaveBeenCalledTimes(1);
    expect(retry).toHaveBeenCalledTimes(1);
    expect(state.recover).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "account" }),
    );
  });
  it("checks an uncertain network result with error.retry and keeps the original request", async () => {
    const retry = vi.fn(async () => result(new Response("existing result")));
    const state = setup(async () => {
      throw Object.assign(new Error("connection lost"), { retry });
    });
    expect(
      await (
        await state.fetch("https://app.example/api/bridge", {
          method: "POST",
          body: "original input",
        })
      ).text(),
    ).toBe("existing result");
    expect(state.sdk.request).toHaveBeenCalledTimes(1);
    expect(retry).toHaveBeenCalledTimes(1);
    expect(state.recover).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "unknown" }),
    );
  });
  it("passes ordinary authorization failures to Axios without retrying", async () => {
    const state = setup(async () =>
      result(new Response("forbidden", { status: 403 })),
    );
    expect((await state.fetch("https://app.example/api/bridge")).status).toBe(
      403,
    );
    expect(state.recover).not.toHaveBeenCalled();
  });
  it("retries preparation with the original result template", async () => {
    const retry = vi.fn(async () => result(new Response("ready")));
    const state = setup(async () =>
      result(new Response("{}", { status: 202 }), { retry }),
    );
    expect(
      await (await state.fetch("https://app.example/api/bridge")).text(),
    ).toBe("ready");
    expect(state.sdk.request).toHaveBeenCalledTimes(1);
    expect(retry).toHaveBeenCalledTimes(1);
  });
});
