import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
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
