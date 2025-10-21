import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { RawBodyMiddleware } from './common/raw-body.middleware';
import { env } from './common/env';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  app.use(new RawBodyMiddleware().use);
  app.enableCors({ origin: true, credentials: true });
  await app.listen(env.port);
  // eslint-disable-next-line no-console
  console.log(`Voice API listening on ${env.port}`);
}

bootstrap();
