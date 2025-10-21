import 'dotenv/config';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { json, urlencoded } from 'express';
import { AppModule } from './module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  app.use(json({ limit: '1mb' }));
  app.use(urlencoded({ extended: true }));
  await app.listen(Number(process.env.SIP_WEBHOOK_PORT) || 3001);
  // eslint-disable-next-line no-console
  console.log(`sip-webhook listening on :${process.env.SIP_WEBHOOK_PORT || 3001}`);
}

bootstrap();
