/* SPDX-License-Identifier: AGPL-3.0-only */
export const isCoders = () => import.meta.env.VITE_CODERS === "true";

export function codersApiUrl(path: string): string {
  if (!isCoders()) return path;
  const target = new URL(path, location.origin);
  if (target.origin !== location.origin || !target.pathname.startsWith("/api/"))
    return path;
  if (target.pathname === "/api/bridge") return path;
  return `/api/bridge?target=${encodeURIComponent(target.pathname + target.search)}`;
}

export function originalApiPath(url: string): string {
  const parsed = new URL(url, location.origin);
  if (isCoders() && parsed.pathname === "/api/bridge") {
    return new URL(parsed.searchParams.get("target") || "/", location.origin)
      .pathname;
  }
  return parsed.pathname;
}
