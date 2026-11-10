import { Module } from '@nestjs/common';
import { DriveApiService } from './drive-api.service';
import { DriveController } from './drive.controller';
import { DriveService } from './drive.service';

@Module({
  controllers: [DriveController],
  providers: [DriveApiService, DriveService],
})
export class DriveModule {}
