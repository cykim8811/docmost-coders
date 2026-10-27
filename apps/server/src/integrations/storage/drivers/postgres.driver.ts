/* SPDX-License-Identifier: AGPL-3.0-only — Coders community adaptation. */
import { Readable } from 'node:stream';
import { Kysely, sql } from 'kysely';
import { StorageDriver } from '../interfaces';

export const MAX_DATABASE_FILE_BYTES = 5 * 1024 * 1024;

/** Small attachments live in the resource DB, never the container filesystem. */
export class PostgresDriver implements StorageDriver {
  constructor(private readonly db: Kysely<any>) {}

  async upload(filePath: string, file: Buffer | Readable): Promise<void> {
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const part of Buffer.isBuffer(file) ? [file] : file) {
      const chunk = Buffer.isBuffer(part) ? part : Buffer.from(part);
      size += chunk.length;
      if (size > MAX_DATABASE_FILE_BYTES) {
        if (file instanceof Readable) file.destroy();
        throw new Error('Attachments are limited to 5 MiB');
      }
      chunks.push(chunk);
    }
    const data = Buffer.concat(chunks);
    await sql`INSERT INTO coders_files (path, data) VALUES (${filePath}, ${data})
      ON CONFLICT (path) DO UPDATE SET data = EXCLUDED.data`.execute(this.db);
  }

  async uploadStream(filePath: string, file: Readable): Promise<void> {
    await this.upload(filePath, file);
  }

  async copy(fromFilePath: string, toFilePath: string): Promise<void> {
    const result = await sql`INSERT INTO coders_files (path, data)
      SELECT ${toFilePath}, data FROM coders_files WHERE path = ${fromFilePath}
      ON CONFLICT (path) DO UPDATE SET data = EXCLUDED.data`.execute(this.db);
    if (result.numAffectedRows === 0n) throw new Error('File not found');
  }

  async read(filePath: string): Promise<Buffer> {
    const { rows } = await sql<{
      data: Buffer;
    }>`SELECT data FROM coders_files WHERE path = ${filePath}`.execute(this.db);
    if (!rows[0]) throw new Error('File not found');
    return Buffer.from(rows[0].data);
  }

  async readStream(filePath: string): Promise<Readable> {
    return Readable.from([await this.read(filePath)]);
  }

  async readRangeStream(
    filePath: string,
    range: { start: number; end: number },
  ): Promise<Readable> {
    if (
      !Number.isSafeInteger(range.start) ||
      !Number.isSafeInteger(range.end) ||
      range.start < 0 ||
      range.end < range.start
    ) {
      throw new Error('Invalid byte range');
    }
    const { rows } = await sql<{
      data: Buffer;
    }>`SELECT substring(data FROM ${range.start + 1} FOR ${range.end - range.start + 1}) AS data
      FROM coders_files WHERE path = ${filePath}`.execute(this.db);
    if (!rows[0]) throw new Error('File not found');
    return Readable.from([Buffer.from(rows[0].data)]);
  }

  async exists(filePath: string): Promise<boolean> {
    const { rows } =
      await sql`SELECT 1 FROM coders_files WHERE path = ${filePath}`.execute(
        this.db,
      );
    return rows.length > 0;
  }

  getUrl(_filePath: string): string {
    throw new Error(
      'Files must be served through the authenticated attachment controller',
    );
  }
  async getSignedUrl(_filePath: string, _expireIn: number): Promise<string> {
    throw new Error('Signed storage URLs are unavailable');
  }
  async delete(filePath: string): Promise<void> {
    await sql`DELETE FROM coders_files WHERE path = ${filePath}`.execute(
      this.db,
    );
  }
  getDriver() {
    return this.db;
  }
  getDriverName() {
    return 'postgres';
  }
  getConfig() {
    return { maxFileBytes: MAX_DATABASE_FILE_BYTES };
  }
}
