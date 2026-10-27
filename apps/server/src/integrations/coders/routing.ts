/* SPDX-License-Identifier: AGPL-3.0-only */
import type { IncomingMessage } from 'node:http';

/** One fixed Coders endpoint carries the existing Docmost REST routes. */
export function rewriteCodersUrl(req: IncomingMessage): string {
  if (process.env.CODERS_MODE !== 'true') return req.url;
  const incoming = new URL(req.url, 'http://localhost');
  if (incoming.pathname !== '/bridge') return req.url;
  const targets = incoming.searchParams.getAll('target');
  if (targets.length !== 1) return '/api/coders-invalid-route';
  const target = targets[0];
  // Routing stays inside Docmost; this is not an outbound HTTP proxy.
  if (
    !target.startsWith('/api/') ||
    target.includes('\\') ||
    /[\r\n#]/.test(target)
  )
    return '/api/coders-invalid-route';
  const parsed = new URL(target, 'http://localhost');
  if (
    parsed.origin !== 'http://localhost' ||
    !parsed.pathname.startsWith('/api/')
  )
    return '/api/coders-invalid-route';
  return parsed.pathname + parsed.search;
}
