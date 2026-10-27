/* SPDX-License-Identifier: AGPL-3.0-only */
import { HealthIndicatorService } from '@nestjs/terminus';
import { Redis } from 'ioredis';
import { RedisHealthIndicator } from './redis.health';
import { EnvironmentService } from '../environment/environment.service';

jest.mock('ioredis', () => ({ Redis: jest.fn() }));

describe('RedisHealthIndicator connection cleanup', () => {
  it.each([false, true])(
    'disconnects after a probe, failure=%s',
    async (fail) => {
      const disconnect = jest.fn();
      (Redis as unknown as jest.Mock).mockImplementation(() => ({
        ping: fail
          ? jest.fn().mockRejectedValue(new Error('unavailable'))
          : jest.fn().mockResolvedValue('PONG'),
        disconnect,
      }));
      const result = { up: jest.fn(), down: jest.fn() };
      const service = new RedisHealthIndicator(
        { check: () => result } as unknown as HealthIndicatorService,
        { getRedisUrl: () => 'redis://127.0.0.1:6379/0' } as EnvironmentService,
      );
      await service.pingCheck('redis');
      expect(disconnect).toHaveBeenCalledTimes(1);
      expect(fail ? result.down : result.up).toHaveBeenCalledTimes(1);
    },
  );
});
