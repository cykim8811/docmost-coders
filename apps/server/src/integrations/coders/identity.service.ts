/* SPDX-License-Identifier: AGPL-3.0-only — Coders community adaptation. */
import {
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { sql } from 'kysely';
import { createHash, randomBytes } from 'node:crypto';
import { KyselyDB } from '../../database/types/kysely.types';
import { UserRepo } from '../../database/repos/user/user.repo';
import { WorkspaceRepo } from '../../database/repos/workspace/workspace.repo';
import { SignupService } from '../../core/auth/services/signup.service';
import { JwtType } from '../../core/auth/dto/jwt-payload';
import { UserRole } from '../../common/helpers/types/permission';
import { isUserDisabled } from '../../common/helpers';

export function codersIdentity(
  headers: Record<string, string | string[] | undefined>,
) {
  const userId = headers['coders-user-id'];
  const resourceId = headers['coders-resource-id'];
  const role = headers['coders-resource-role'];
  if (
    typeof userId !== 'string' ||
    typeof resourceId !== 'string' ||
    !/^[a-zA-Z0-9_:.-]{1,200}$/.test(userId) ||
    !/^[a-zA-Z0-9_:.-]{1,200}$/.test(resourceId) ||
    (role !== 'owner' && role !== 'member')
  ) {
    throw new UnauthorizedException('Verified Coders identity is required');
  }
  return { userId, resourceId, role };
}

function profile(externalId: string) {
  const key = createHash('sha256').update(externalId).digest('hex');
  return {
    name: `Coders ${key.slice(0, 8)}`,
    email: `${key}@users.coders.invalid`,
    password: randomBytes(32).toString('hex'),
  };
}

@Injectable()
export class CodersIdentityService {
  constructor(
    @InjectKysely() private readonly db: KyselyDB,
    private readonly users: UserRepo,
    private readonly workspaces: WorkspaceRepo,
    private readonly signup: SignupService,
  ) {}

  async authenticate(headers: Record<string, string | string[] | undefined>) {
    const { userId, resourceId, role } = codersIdentity(headers);
    const identity = await this.db.transaction().execute(async (trx) => {
      // One resource per database; serializes initial setup and concurrent joins.
      await sql`SELECT pg_advisory_xact_lock(724921674)`.execute(trx);
      let {
        rows: [resource],
      } = await sql<{
        resourceId: string;
        workspaceId: string;
      }>`SELECT resource_id, workspace_id FROM coders_resource`.execute(trx);
      if (resource && resource.resourceId !== resourceId)
        throw new ForbiddenException('Resource does not match this database');
      if (!resource) {
        if (role !== 'owner')
          throw new ForbiddenException({
            message: '리소스 소유자가 초기 설정을 완료해야 합니다.',
            code: 'coders_owner_setup_required',
          });
        // Refuse to silently adopt an existing unrelated Docmost database.
        const existing = await trx
          .selectFrom('workspaces')
          .select('id')
          .executeTakeFirst();
        if (existing)
          throw new ServiceUnavailableException(
            'Existing database requires an explicit Coders migration',
          );
        const { user, workspace } = await this.signup.initialSetup(
          { ...profile(userId), workspaceName: 'Coders 문서' },
          trx,
        );
        await this.users.updateUser(
          { locale: 'ko-KR' },
          user.id,
          workspace.id,
          trx,
        );
        resource = { resourceId, workspaceId: workspace.id };
        await sql`INSERT INTO coders_resource (resource_id, workspace_id) VALUES (${resourceId}, ${workspace.id})`.execute(
          trx,
        );
        await sql`INSERT INTO coders_identities (resource_id, external_user_id, user_id) VALUES (${resourceId}, ${userId}, ${user.id})`.execute(
          trx,
        );
      }
      let {
        rows: [mapping],
      } = await sql<{ userId: string }>`SELECT user_id FROM coders_identities
        WHERE resource_id = ${resourceId} AND external_user_id = ${userId}`.execute(
        trx,
      );
      if (!mapping) {
        const user = await this.signup.signup(
          profile(userId),
          resource.workspaceId,
          trx,
        );
        // After bootstrap, app administration is managed through Docmost policy.
        await this.users.updateUser(
          { role: UserRole.MEMBER, locale: 'ko-KR' },
          user.id,
          resource.workspaceId,
          trx,
        );
        mapping = { userId: user.id };
        await sql`INSERT INTO coders_identities (resource_id, external_user_id, user_id) VALUES (${resourceId}, ${userId}, ${user.id})`.execute(
          trx,
        );
      }
      return { userId: mapping.userId, workspaceId: resource.workspaceId };
    });
    const [user, workspace] = await Promise.all([
      this.users.findById(identity.userId, identity.workspaceId),
      this.workspaces.findById(identity.workspaceId),
    ]);
    if (!user || !workspace || isUserDisabled(user))
      throw new UnauthorizedException();
    return { user, workspace, authType: JwtType.ACCESS };
  }
}
