import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.init();
  return app;
}

let app;
export default async function handler(req, res) {
  if (!app) {
    app = await bootstrap();
  }
  const instance = app.getHttpAdapter().getInstance();
  return instance(req, res);
}