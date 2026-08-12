import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AutentiqueModule } from './autentique/autentique.module';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { ResourcesModule } from './resources/resources.module';
import { RpcModule } from './rpc/rpc.module';
import { LocalStorageModule } from './storage/local-storage.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '../.env'] }),
    DatabaseModule,
    HealthModule,
    ResourcesModule,
    RpcModule,
    LocalStorageModule,
    AutentiqueModule,
  ],
})
export class AppModule {}
