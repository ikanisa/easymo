import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { logger } from '@easymo/commons';
import { AppModule } from './app.module';
import { RawBodyMiddleware } from './common/raw-body.middleware';
import { RequestLoggerMiddleware } from './common/request-logger.middleware';
import { env } from './common/env';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  app.use(new RawBodyMiddleware().use);
  app.use(new RequestLoggerMiddleware().use);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.enableCors({ origin: true, credentials: true });
  await app.listen(env.port);
  logger.info({
    event: 'voice-api.startup',
    port: env.port,
    target: 'api-router',
    status: 'ok',
  });
}

bootstrap();
