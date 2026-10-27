/* SPDX-License-Identifier: AGPL-3.0-only */
import { QueueConnection } from './queue-connection.module';
import { EnvironmentService } from '../environment/environment.service';
import Redis from 'ioredis';

jest.mock('ioredis', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    disconnect: jest.fn(),
  })),
}));

describe('QueueConnection', () => {
  const mode = process.env.CODERS_MODE;
  const environment = {
    getRedisUrl: () => 'redis://127.0.0.1:6379/0',
  } as EnvironmentService;
  afterEach(() => {
    if (mode === undefined) delete process.env.CODERS_MODE;
    else process.env.CODERS_MODE = mode;
    jest.clearAllMocks();
  });

  it('reuses a worker-compatible client and releases it at shutdown', () => {
    process.env.CODERS_MODE = 'true';
    const service = new QueueConnection(environment);
    const first = service.getConnection();
    expect(service.getConnection()).toBe(first);
    expect(Redis).toHaveBeenCalledTimes(1);
    expect(Redis).toHaveBeenCalledWith(
      expect.objectContaining({ maxRetriesPerRequest: null }),
    );
    service.onApplicationShutdown();
    expect((first as Redis).disconnect).toHaveBeenCalledTimes(1);
  });

  it('keeps regular Docmost connection options outside Coders', () => {
    delete process.env.CODERS_MODE;
    const service = new QueueConnection(environment);
    expect(service.getConnection()).toMatchObject({
      host: '127.0.0.1',
      port: 6379,
      db: 0,
    });
    expect(Redis).not.toHaveBeenCalled();
    service.onApplicationShutdown();
  });
});
