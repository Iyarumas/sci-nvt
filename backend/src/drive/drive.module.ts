import { Module } from '@nestjs/common';
import { PermissoesModule } from '../permissoes/permissoes.module';
import { DriveApiService } from './drive-api.service';
import { DriveController } from './drive.controller';
import { DriveService } from './drive.service';

@Module({
  imports: [PermissoesModule],
  controllers: [DriveController],
  providers: [DriveApiService, DriveService],
})
export class DriveModule {}
