import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  const config = app.get(ConfigService);
  const prefix = config.get<string>('API_PREFIX', 'api');
  const frontendOrigin = config.get<string>('FRONTEND_ORIGIN', 'http://localhost:5173');

  app.use(json({
    limit: '25mb',
    // O webhook do Autentique confere a assinatura HMAC sobre o corpo exato que chegou.
    verify: (req, _res, buf) => {
      if ((req as { url?: string }).url?.includes('/autentique/webhook')) (req as { rawBody?: Buffer }).rawBody = Buffer.from(buf);
    },
  }));
  app.use(urlencoded({ extended: true, limit: '25mb' }));
  app.setGlobalPrefix(prefix);
  app.enableCors({
    origin: frontendOrigin.split(',').map((origin) => origin.trim()),
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: false,
    }),
  );

  const port = config.get<number>('PORT', 3333);
  await app.listen(port);
}

void bootstrap();
