import { Module } from '@nestjs/common';
import { LocalStorageController } from './local-storage.controller';
import { LocalStorageService } from './local-storage.service';

@Module({
  controllers: [LocalStorageController],
  providers: [LocalStorageService],
})
export class LocalStorageModule {}
