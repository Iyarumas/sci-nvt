import { Module } from '@nestjs/common';
import { LocalStorageService } from '../storage/local-storage.service';
import { AutentiqueApiService } from './autentique-api.service';
import { AutentiqueController } from './autentique.controller';
import { AutentiqueService } from './autentique.service';
import { EnviosController } from './envios.controller';
import { EnviosService } from './envios.service';

@Module({
  controllers: [AutentiqueController, EnviosController],
  providers: [AutentiqueService, AutentiqueApiService, EnviosService, LocalStorageService],
})
export class AutentiqueModule {}
