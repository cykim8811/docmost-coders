/* SPDX-License-Identifier: AGPL-3.0-only */
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api-client";

export function SourceLink({ compact = false }: { compact?: boolean }) {
  const { data } = useQuery<{ sourceUrl: string }>({
    queryKey: ["coders-source"],
    queryFn: async () => (await api.get("/coders/source")).data,
    staleTime: Infinity,
  });
  return (
    <a
      href={data?.sourceUrl || "https://github.com/cykim8811/docmost-coders"}
      target="_blank"
      rel="noopener noreferrer"
      title="AGPL-3.0 · Based on Docmost"
      style={{ fontSize: 12, color: "inherit", whiteSpace: "nowrap" }}
    >
      {compact ? "소스 코드" : "소스 코드 · AGPL-3.0 · Based on Docmost"}
    </a>
  );
}
