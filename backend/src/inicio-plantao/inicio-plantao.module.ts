import { Module } from '@nestjs/common';
import { InicioPlantaoController } from './inicio-plantao.controller';
import { InicioPlantaoService } from './inicio-plantao.service';

@Module({ controllers: [InicioPlantaoController], providers: [InicioPlantaoService] })
export class InicioPlantaoModule {}
