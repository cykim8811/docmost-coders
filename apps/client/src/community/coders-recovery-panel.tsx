/* SPDX-License-Identifier: AGPL-3.0-only */
import { useState, useSyncExternalStore } from "react";
import { getPendingRecovery, subscribeRecovery } from "@/lib/coders-recovery";

export function CodersRecoveryPanel() {
  const pending = useSyncExternalStore(subscribeRecovery, getPendingRecovery);
  const [popupUrl, setPopupUrl] = useState<string>();
  const [checking, setChecking] = useState(false);
  const first = pending[0];
  if (!first) return null;

  const openAccount = async () => {
    setChecking(true);
    try {
      // The SDK opens and validates the popup from this user click handler.
      const result = await first.openAccount?.();
      if (result?.status === "checked") {
        getPendingRecovery()
          .filter((item) => item.kind === "account")
          .forEach((item) => item.proceed());
        setPopupUrl(undefined);
      } else if (result?.status === "blocked") setPopupUrl(result.url);
    } finally {
      setChecking(false);
    }
  };
  return (
    <aside
      role="alert"
      style={{
        position: "fixed",
        bottom: 20,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 100000,
        width: "min(480px, 92vw)",
        padding: 20,
        borderRadius: 12,
        border: "1px solid #c5c9d0",
        background: "var(--mantine-color-body)",
        boxShadow: "0 4px 24px #0002",
      }}
    >
      <p>
        {first.kind === "account"
          ? "Coders에서 잔액과 실행 권한을 확인해 주세요."
          : first.kind === "preparing"
            ? "앱을 준비하고 있습니다. 잠시 후 같은 요청을 확인해 주세요."
            : "응답을 확인하지 못했습니다. 같은 요청의 처리 결과를 확인할 수 있습니다."}
      </p>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {first.openAccount && (
          <button disabled={checking} onClick={openAccount}>
            계좌 확인
          </button>
        )}
        {popupUrl && (
          <a href={popupUrl} target="_blank" rel="noopener noreferrer">
            확인 창 열기
          </a>
        )}
        <button disabled={checking} onClick={() => first.proceed()}>
          같은 요청 확인
        </button>
        <button disabled={checking} onClick={() => first.cancel()}>
          취소
        </button>
      </div>
    </aside>
  );
}
