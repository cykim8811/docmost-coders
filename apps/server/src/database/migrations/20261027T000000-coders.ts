/* SPDX-License-Identifier: AGPL-3.0-only */
import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await sql`CREATE TABLE coders_files (
    path text PRIMARY KEY,
    data bytea NOT NULL CHECK (octet_length(data) <= 5242880)
  )`.execute(db);
  await sql`CREATE TABLE coders_identities (
    resource_id text NOT NULL,
    external_user_id text NOT NULL,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY (resource_id, external_user_id),
    UNIQUE(user_id)
  )`.execute(db);
  await sql`CREATE TABLE coders_resource (
    singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
    resource_id text UNIQUE NOT NULL,
    workspace_id uuid NOT NULL REFERENCES workspaces(id)
  )`.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`DROP TABLE coders_resource`.execute(db);
  await sql`DROP TABLE coders_identities`.execute(db);
  await sql`DROP TABLE coders_files`.execute(db);
}
