import { Module } from '@nestjs/common';
import { AutentiqueController } from './autentique.controller';
import { AutentiqueService } from './autentique.service';
import { EnviosController } from './envios.controller';
import { EnviosService } from './envios.service';

@Module({
  controllers: [AutentiqueController, EnviosController],
  providers: [AutentiqueService, EnviosService],
})
export class AutentiqueModule {}
