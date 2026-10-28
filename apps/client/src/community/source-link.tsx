/* SPDX-License-Identifier: AGPL-3.0-only */
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api-client";

const attribution =
  "Coders Docs는 Docmost 기반의 비공식 포크입니다. Docmost, Inc.와 제휴 관계가 없습니다.";

export function SourceLink({ compact = false }: { compact?: boolean }) {
  const { data } = useQuery<{ sourceUrl: string }>({
    queryKey: ["coders-source"],
    queryFn: async () => (await api.get("/coders/source")).data,
    staleTime: Infinity,
  });
  return (
    <div style={{ fontSize: 12, color: "inherit" }}>
      <a
        href={data?.sourceUrl || "https://github.com/cykim8811/docmost-coders"}
        target="_blank"
        rel="noopener noreferrer"
        title={`AGPL-3.0 · ${attribution}`}
        style={{ color: "inherit", whiteSpace: "nowrap" }}
      >
        {compact ? "소스 코드" : "소스 코드 · AGPL-3.0 · Based on Docmost"}
      </a>
      {!compact && (
        <p style={{ margin: "4px 0 0", fontSize: 11, whiteSpace: "normal" }}>
          {attribution}
        </p>
      )}
    </div>
  );
}
