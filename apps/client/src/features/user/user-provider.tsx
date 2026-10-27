import { useAtom, useSetAtom } from "jotai";
import { currentUserAtom } from "@/features/user/atoms/current-user-atom";
import React, { useEffect } from "react";
import useCurrentUser from "@/features/user/hooks/use-current-user";
import { useTranslation } from "react-i18next";
import { socketAtom } from "@/features/websocket/atoms/socket-atom.ts";
import { io } from "socket.io-client";
import { SOCKET_URL } from "@/features/websocket/types";
import { useQuerySubscription } from "@/features/websocket/use-query-subscription.ts";
import { useTreeSocket } from "@/features/websocket/use-tree-socket.ts";
import { useNotificationSocket } from "@/features/notification/hooks/use-notification-socket.ts";
import { useCollabToken } from "@/features/auth/queries/auth-query.tsx";
import { Error404 } from "@/components/ui/error-404.tsx";
import { useEntitlements } from "@/community/edition";
import { entitlementAtom } from "@/community/edition";
import { isCoders } from "@/lib/coders";

export function UserProvider({ children }: React.PropsWithChildren) {
  const [, setCurrentUser] = useAtom(currentUserAtom);
  const setEntitlements = useSetAtom(entitlementAtom);
  const { data, isLoading, error, isError, refetch } = useCurrentUser();
  const { data: entitlements } = useEntitlements();
  const { i18n } = useTranslation();
  const [, setSocket] = useAtom(socketAtom);
  // fetch collab token on load
  const { data: collab } = useCollabToken();

  useEffect(() => {
    if (isLoading || isError) {
      return;
    }

    const newSocket = io(SOCKET_URL, {
      path: isCoders() ? "/api/events" : "/socket.io",
      addTrailingSlash: !isCoders(),
      transports: ["websocket"],
      withCredentials: true,
    });

    // @ts-ignore
    setSocket(newSocket);

    newSocket.on("connect", () => {
      console.log("ws connected");
    });

    return () => {
      console.log("ws disconnected");
      newSocket.disconnect();
    };
  }, [isError, isLoading]);

  useQuerySubscription();
  useTreeSocket();
  useNotificationSocket();

  useEffect(() => {
    if (data && data.user && data.workspace) {
      setCurrentUser(data);
      i18n.changeLanguage(
        data.user.locale === "en" ? "en-US" : data.user.locale,
      );
    }
  }, [data, isLoading]);

  useEffect(() => {
    document.documentElement.lang =
      i18n.resolvedLanguage || i18n.language || "en-US";
  }, [i18n.language, i18n.resolvedLanguage]);

  useEffect(() => {
    if (entitlements) {
      setEntitlements(entitlements);
    }
  }, [entitlements]);

  if (isLoading) return <></>;

  if (isError && error?.["response"]?.status === 404) {
    return <Error404 />;
  }

  if (error) {
    if (isCoders()) {
      const status = error?.["response"]?.status;
      const payload = error?.["response"]?.data;
      const code = payload?.error?.code || payload?.code;
      const diagnosticCode =
        typeof code === "string" && /^[a-zA-Z0-9_-]{1,80}$/.test(code)
          ? code
          : undefined;
      const needsOwner = code === "coders_owner_setup_required";
      return (
        <main style={{ padding: 32 }}>
          <h1>문서를 열 수 없습니다</h1>
          <p>
            {needsOwner
              ? "워크스페이스 소유자가 먼저 문서 앱을 열어 초기 설정을 완료해야 합니다."
              : status === 202
                ? "앱을 준비하고 있습니다. 잠시 후 다시 시도해 주세요."
                : status === 402
                  ? "Coders 공동 계좌의 잔액과 실행 예산을 확인해 주세요."
                  : status === 401
                    ? "Coders에서 로그인과 이 프로젝트의 연결 승인을 확인해 주세요."
                    : status === 504
                      ? "Coders 원 서버의 응답 시간이 초과되었습니다. 잠시 후 다시 시도하고, 계속되면 운영 서버의 실행 로그를 확인해 주세요."
                      : status === 403
                        ? "Coders에서 워크스페이스 접근 권한과 앱 실행 권한을 확인해 주세요."
                        : "워크스페이스 연결이나 서버 설정을 확인한 뒤 다시 시도해 주세요."}
          </p>
          <p role="status">
            진단: {status ? `HTTP ${status}` : "API 응답을 받지 못했습니다"}
            {diagnosticCode ? ` · ${diagnosticCode}` : ""}
          </p>
          <button onClick={() => refetch()}>다시 시도</button>
        </main>
      );
    }
    return <></>;
  }

  return <>{children}</>;
}
