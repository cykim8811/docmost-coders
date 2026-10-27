/* SPDX-License-Identifier: AGPL-3.0-only */
export type RecoveryOptions = {
  kind: "account" | "preparing" | "unknown";
  signal: AbortSignal;
  openAccount?: () => Promise<{ status: string; url?: string }>;
};
export type PendingRecovery = RecoveryOptions & {
  proceed(): void;
  cancel(): void;
};
let pending: PendingRecovery[] = [];
const listeners = new Set<() => void>();
export const subscribeRecovery = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
export const getPendingRecovery = () => pending;
function notify() {
  listeners.forEach((listener) => listener());
}

export function waitForCodersRetry(options: RecoveryOptions): Promise<void> {
  return new Promise((resolve, reject) => {
    const finish = (cancelled: boolean) => {
      options.signal.removeEventListener("abort", item.cancel);
      pending = pending.filter((entry) => entry !== item);
      notify();
      if (cancelled)
        reject(new DOMException("Request cancelled", "AbortError"));
      else resolve();
    };
    const item: PendingRecovery = {
      ...options,
      proceed: () => finish(false),
      cancel: () => finish(true),
    };
    if (options.signal.aborted) {
      item.cancel();
      return;
    }
    options.signal.addEventListener("abort", item.cancel, { once: true });
    pending = [...pending, item];
    notify();
  });
}
