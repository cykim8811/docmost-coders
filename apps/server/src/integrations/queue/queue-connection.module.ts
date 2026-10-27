/* SPDX-License-Identifier: AGPL-3.0-only */
import {
  Injectable,
  Logger,
  Module,
  OnApplicationShutdown,
} from '@nestjs/common';
import Redis from 'ioredis';
import { EnvironmentService } from '../environment/environment.service';
import { createRetryStrategy, parseRedisUrl } from '../../common/helpers';

@Injectable()
export class QueueConnection implements OnApplicationShutdown {
  private readonly logger = new Logger(QueueConnection.name);
  private shared?: Redis;

  constructor(private readonly environment: EnvironmentService) {}

  getConnection() {
    const config = {
      ...parseRedisUrl(this.environment.getRedisUrl()),
      retryStrategy: createRetryStrategy(),
    };
    if (process.env.CODERS_MODE !== 'true') return config;
    // BullMQ shares regular commands, but duplicates a blocking connection per
    // worker. Never share a subscriber or blocking connection with producers.
    if (!this.shared) {
      this.shared = new Redis({ ...config, maxRetriesPerRequest: null });
      this.shared.on('error', (error) => this.logger.error(error.message));
    }
    return this.shared;
  }

  onApplicationShutdown() {
    this.shared?.disconnect();
  }
}

@Module({ providers: [QueueConnection], exports: [QueueConnection] })
export class QueueConnectionModule {}
