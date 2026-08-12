import { Module } from '@nestjs/common';
import { AutentiqueController } from './autentique.controller';
import { AutentiqueService } from './autentique.service';

@Module({
  controllers: [AutentiqueController],
  providers: [AutentiqueService],
})
export class AutentiqueModule {}
