/* SPDX-License-Identifier: AGPL-3.0-only */
import { ForbiddenException, Injectable, NestMiddleware } from '@nestjs/common';
import { CodersIdentityService } from './identity.service';

@Injectable()
export class CodersMiddleware implements NestMiddleware {
  constructor(private readonly identities: CodersIdentityService) {}

  async use(req: any, _res: any, next: () => void) {
    if (process.env.CODERS_MODE !== 'true') return next();
    // Middie can strip its mount path from req.url. originalUrl retains it.
    const incoming = new URL(req.originalUrl || req.url, 'http://localhost');
    const path =
      incoming.pathname === '/bridge'
        ? new URL(
            incoming.searchParams.get('target') || '/',
            'http://localhost',
          ).pathname
        : incoming.pathname;
    if (path === '/api/health' || path === '/api/health/live') return next();
    // Password auth, setup, reset and invitations cannot bypass Core identity.
    if (
      (path.startsWith('/api/auth/') && path !== '/api/auth/collab-token') ||
      path.startsWith('/api/workspace/invites') ||
      path.startsWith('/api/workspace/create')
    ) {
      throw new ForbiddenException(
        'Manage sign-in and membership through Coders',
      );
    }
    const auth = await this.identities.authenticate(req.headers);
    req.codersAuth = auth;
    req.workspace = auth.workspace;
    req.workspaceId = auth.workspace.id;
    next();
  }
}
