/* SPDX-License-Identifier: AGPL-3.0-only */
import { Controller, Get } from '@nestjs/common';

@Controller('coders')
export class CodersSourceController {
  @Get('source')
  source() {
    return {
      sourceUrl:
        process.env.CODERS_SOURCE_URL || 'https://github.com/docmost/docmost',
      revision: process.env.CODERS_REVISION || 'development',
      license: 'AGPL-3.0-only',
      upstream: 'https://github.com/docmost/docmost',
      edition: 'community',
    };
  }
}
