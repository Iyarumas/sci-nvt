import { Module } from '@nestjs/common';
import { PtrbaResumoController } from './ptrba-resumo.controller';
import { ResourcesController } from './resources.controller';
import { ResourcesService } from './resources.service';

@Module({
  controllers: [ResourcesController, PtrbaResumoController],
  providers: [ResourcesService],
})
export class ResourcesModule {}
