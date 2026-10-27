/* SPDX-License-Identifier: AGPL-3.0-only */
import { Global, Module } from '@nestjs/common';
import { AuthModule } from '../../core/auth/auth.module';
import { CodersIdentityService } from './identity.service';
import { CodersSourceController } from './source.controller';

@Global()
@Module({
  imports: [AuthModule],
  providers: [CodersIdentityService],
  exports: [CodersIdentityService],
  controllers: [CodersSourceController],
})
export class CodersModule {}
