import { Controller, Get } from '@nestjs/common';
import { Public } from '../auth/auth.types';

@Controller('health')
export class HealthController {
  @Public()
  @Get()
  health() {
    return {
      ok: true,
      service: 'sescinc-api',
      commit: process.env.BUILD_COMMIT || 'local',
      timestamp: new Date().toISOString(),
    };
  }
}
