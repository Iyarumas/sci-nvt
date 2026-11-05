import { Module } from '@nestjs/common';
import { FimPlantaoController, InicioPlantaoController } from './inicio-plantao.controller';
import { InicioPlantaoService } from './inicio-plantao.service';

@Module({ controllers: [InicioPlantaoController, FimPlantaoController], providers: [InicioPlantaoService] })
export class InicioPlantaoModule {}
